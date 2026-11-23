import type { GpuApi } from '../gpu';
import type { MeshLibrary, Renderable } from '../renderer';
import type { SceneParams, SimId, SimParamsFor } from '../schema';

/** What the engine hands a sim in `init`; the sim keeps it for later use. */
export interface SimContext {
  device: GPUDevice;
  /** Buffer/pipeline/shader helpers with memory tracking. */
  gpu: GpuApi;
  /** Shared procedural meshes. */
  meshes: MeshLibrary;
}

/** Scene settings a sim can override; groups are merged over the scene defaults. */
export type SceneOverrides = { [K in keyof SceneParams]?: Partial<SceneParams[K]> };

/**
 * The contract every sim implements. The engine owns the frame loop and all passes; a sim owns
 * its GPU resources, records compute work into the engine's pass, and describes what to draw.
 */
export interface Simulation<P> {
  /** Create buffers and pipelines and set the initial state. A throw is shown as the sim's error. */
  init(ctx: SimContext, params: P): Promise<void>;
  /** Live update; no reset. */
  setParams(params: P): void;
  /** Restore the initial state from the current params. */
  reset(): void;
  /** Called once per fixed substep inside the engine's `sim` compute pass. */
  step(dt: number, pass: GPUComputePassEncoder): void;
  /** Return stable objects; the renderer caches GPU resources per renderable. */
  renderables(): readonly Renderable[];
  /** Applied over the scene defaults each time this sim loads, e.g. to frame the camera. */
  sceneOverrides?(): SceneOverrides;
  /** Destroy every resource created in `init`, through `ctx.gpu.destroy`. */
  dispose(): void;
}

/** Creates an uninitialised sim; the engine calls `init` next. */
export type SimFactory<Id extends SimId = SimId> = () => Simulation<SimParamsFor<Id>>;

/** One factory per `SimId`; a schema without a factory is a type error in app/registry.ts. */
export type SimRegistry = { [Id in SimId]: SimFactory<Id> };
