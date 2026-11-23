import type { GpuApi, GpuContext, GpuProfiler } from '../gpu';
import type { Renderer } from '../renderer';
import {
  defaultAppParams,
  defaultSceneParams,
  defaultSimParams,
  parseSceneParams,
  sceneParamsJsonSchema,
  type AppParams,
  type JsonSchema,
  type SceneParams,
  type SimId,
  type SimParamsFor,
} from '../schema';
import { emptyMetrics, FrameHistory, MetricsAggregator, type MetricsSnapshot } from './metrics';
import { attachOrbitControls, type OrbitRanges } from './orbit';
import type { SimContext, SimRegistry, Simulation } from './simulation';
import { createStore, type Store, type WritableStore } from './store';
import { FixedTimestep } from './timestep';

const METRICS_PUBLISH_MS = 250;

/** Every user-tweakable value. Treated as immutable: writers replace it, readers compare by reference. */
export interface ParamsState {
  app: AppParams;
  scene: SceneParams;
  sim: SimParamsFor<SimId>;
}

/** Load state of the current sim. */
export interface SimStatus {
  id: SimId;
  loading: boolean;
  /** Message from a failed `init`, or null. */
  error: string | null;
}

/** Everything the engine needs; built by app/main.tsx. */
export interface EngineOptions {
  gpu: GpuContext;
  api: GpuApi;
  profiler: GpuProfiler;
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  registry: SimRegistry;
  /** Starting values; anything omitted uses the schema defaults. */
  initial?: { app?: AppParams; sim?: SimParamsFor<SimId> };
}

/** Frame loop, timestep, sim lifecycle and the stores the UI reads. */
export class Engine {
  readonly params: Store<ParamsState>;
  readonly metrics: Store<MetricsSnapshot>;
  readonly status: Store<SimStatus>;
  readonly frameHistory = new FrameHistory();

  private readonly paramsStore: WritableStore<ParamsState>;
  private readonly metricsStore: WritableStore<MetricsSnapshot>;
  private readonly statusStore: WritableStore<SimStatus>;
  private readonly options: EngineOptions;
  private readonly ctx: SimContext;
  private readonly timestep = new FixedTimestep();
  private readonly aggregator = new MetricsAggregator();
  private readonly detachControls: () => void;
  private sim: Simulation<SimParamsFor<SimId>> | null = null;
  private loadToken = 0;
  private simTime = 0;
  private rafId = 0;
  private lastFrameTime: number | null = null;
  private lastPublish = 0;
  private appliedSimParams: SimParamsFor<SimId> | null = null;

  constructor(options: EngineOptions) {
    this.options = options;
    this.ctx = { device: options.gpu.device, gpu: options.api, meshes: options.renderer.meshes };
    const app = options.initial?.app ?? defaultAppParams();
    this.paramsStore = createStore<ParamsState>({
      app,
      scene: defaultSceneParams(),
      sim: options.initial?.sim ?? defaultSimParams(app.sim),
    });
    this.metricsStore = createStore(emptyMetrics);
    this.statusStore = createStore<SimStatus>({ id: app.sim, loading: true, error: null });
    this.params = this.paramsStore;
    this.metrics = this.metricsStore;
    this.status = this.statusStore;

    const sceneProps: Record<string, JsonSchema | undefined> =
      sceneParamsJsonSchema().properties ?? {};
    const cameraProps: Record<string, JsonSchema | undefined> = sceneProps.camera?.properties ?? {};
    const range = (key: string, fallback: [number, number]): [number, number] => [
      cameraProps[key]?.minimum ?? fallback[0],
      cameraProps[key]?.maximum ?? fallback[1],
    ];
    const ranges: OrbitRanges = {
      distance: range('distance', [1, 200]),
      pitch: range('pitch', [1, 89]),
    };
    this.detachControls = attachOrbitControls(
      options.canvas,
      {
        get: () => this.paramsStore.getSnapshot().scene.camera,
        set: (camera) => {
          this.paramsStore.update((s) => ({ ...s, scene: { ...s.scene, camera } }));
        },
      },
      ranges,
    );

    void this.loadSim(app.sim, this.paramsStore.getSnapshot().sim);
  }

  /** Begin the requestAnimationFrame loop (idempotent). */
  start(): void {
    if (this.rafId) return;
    const frame = (now: number) => {
      this.rafId = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Pause the frame loop; the sim and its resources are kept. */
  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.lastFrameTime = null;
  }

  /** Replace app params. Changing `app.sim` loads that sim with its default params. */
  setApp(app: AppParams): void {
    const previous = this.paramsStore.getSnapshot();
    // Compared as strings: SimId can be a single literal type.
    const nextId: string = app.sim;
    if (nextId !== previous.app.sim) {
      const sim = defaultSimParams(app.sim);
      this.paramsStore.set({ ...previous, app, sim });
      void this.loadSim(app.sim, sim);
    } else {
      this.paramsStore.set({ ...previous, app });
    }
  }

  /** Switch to `id` (or reload it) starting from `params`. */
  setSim<Id extends SimId>(id: Id, params: SimParamsFor<Id>): void {
    this.paramsStore.update((s) => ({ ...s, app: { ...s.app, sim: id }, sim: params }));
    void this.loadSim(id, params);
  }

  /** Replace scene params; used from the next frame. */
  setScene(scene: SceneParams): void {
    this.paramsStore.update((s) => ({ ...s, scene }));
  }

  /** Replace the current sim's params; `sim.setParams` runs at the start of the next frame. */
  setSimParams(sim: SimParamsFor<SimId>): void {
    this.paramsStore.update((s) => ({ ...s, sim }));
  }

  /** Advance exactly one fixed step on the next frame (while paused). */
  stepOnce(): void {
    this.timestep.requestStep();
  }

  /** Restart the current sim from its initial state and zero the sim clock. */
  reset(): void {
    this.sim?.reset();
    this.simTime = 0;
    this.timestep.reset();
  }

  /** Dispose the current sim and load `id` again from scratch. */
  reloadSim(): Promise<void> {
    const { app, sim } = this.paramsStore.getSnapshot();
    return this.loadSim(app.sim, sim);
  }

  /** Stop the loop, detach input handlers and dispose the sim. */
  dispose(): void {
    this.stop();
    this.detachControls();
    this.loadToken++;
    this.sim?.dispose();
    this.sim = null;
  }

  private async loadSim(id: SimId, params: SimParamsFor<SimId>): Promise<void> {
    const token = ++this.loadToken;
    this.sim?.dispose();
    this.sim = null;
    this.appliedSimParams = null;
    this.statusStore.set({ id, loading: true, error: null });

    const sim = this.options.registry[id]();
    try {
      await sim.init(this.ctx, params);
    } catch (err) {
      sim.dispose();
      if (token === this.loadToken) {
        this.statusStore.set({
          id,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
    if (token !== this.loadToken) {
      sim.dispose();
      return;
    }

    this.sim = sim;
    this.appliedSimParams = params;
    this.simTime = 0;
    this.timestep.reset();
    const scene = parseSceneParams(sim.sceneOverrides?.() ?? {});
    this.paramsStore.update((s) => ({
      ...s,
      scene: scene.ok ? scene.value : defaultSceneParams(),
    }));
    this.statusStore.set({ id, loading: false, error: null });
  }

  private frame(now: number): void {
    const cpuStart = performance.now();
    const frameMs = this.lastFrameTime === null ? 0 : now - this.lastFrameTime;
    this.lastFrameTime = now;

    const { app, scene, sim: simParams } = this.paramsStore.getSnapshot();
    const { sim } = this;
    if (sim && simParams !== this.appliedSimParams) {
      sim.setParams(simParams);
      this.appliedSimParams = simParams;
    }

    const plan = this.timestep.advance(frameMs / 1000, app);
    const { device } = this.options.gpu;
    const { profiler, renderer } = this.options;
    profiler.beginFrame();
    const encoder = device.createCommandEncoder({ label: 'frame' });

    // Opened even with zero substeps so the `sim` timing row stays continuous.
    if (sim) {
      const pass = encoder.beginComputePass({
        label: 'sim',
        timestampWrites: profiler.timestampWrites('sim'),
      });
      for (let i = 0; i < plan.substeps; i++) sim.step(plan.substepDt, pass);
      pass.end();
      this.simTime += plan.simSeconds;
    }

    renderer.encode(encoder, { scene, renderables: sim?.renderables() ?? [], time: this.simTime });
    profiler.endFrame(encoder);
    device.queue.submit([encoder.finish()]);
    profiler.afterSubmit();

    const stats = renderer.lastStats();
    if (frameMs > 0) {
      this.frameHistory.push(frameMs);
      this.aggregator.record({
        time: now,
        frameMs,
        cpuMs: performance.now() - cpuStart,
        substeps: plan.substeps,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
      });
    }
    if (now - this.lastPublish >= METRICS_PUBLISH_MS) {
      this.lastPublish = now;
      const { canvas } = this.options;
      this.metricsStore.set(
        this.aggregator.snapshot({
          gpuMs: profiler.results(),
          gpuMemoryBytes: this.options.api.memory.snapshot().totalBytes,
          canvas: { width: canvas.width, height: canvas.height, dpr: devicePixelRatio },
        }),
      );
    }
  }
}
