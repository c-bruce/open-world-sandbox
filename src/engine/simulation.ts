import type { GpuApi } from '../gpu';
import type { MeshLibrary, Renderable } from '../renderer';
import type { SceneParams, SimId, SimParamsFor } from '../schema';

export interface SimContext {
  device: GPUDevice;
  /** Buffer/pipeline/shader helpers with memory tracking. */
  gpu: GpuApi;
  /** Shared procedural meshes. */
  meshes: MeshLibrary;
}

/** Scene settings a sim can override; groups are merged over the scene defaults. */
export type SceneOverrides = { [K in keyof SceneParams]?: Partial<SceneParams[K]> };

export interface Simulation<P> {
  init(ctx: SimContext, params: P): Promise<void>;
  /** Live update; no reset. */
  setParams(params: P): void;
  /** Restore the initial state from the current params. */
  reset(): void;
  /** Called once per fixed substep inside the engine's `sim` compute pass. */
  step(dt: number, pass: GPUComputePassEncoder): void;
  /** Return stable objects; the renderer caches GPU resources per renderable. */
  renderables(): readonly Renderable[];
  sceneOverrides?(): SceneOverrides;
  dispose(): void;
}

export type SimFactory<Id extends SimId = SimId> = () => Simulation<SimParamsFor<Id>>;

export type SimRegistry = { [Id in SimId]: SimFactory<Id> };
