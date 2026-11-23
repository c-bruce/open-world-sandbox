export { Engine, type EngineOptions, type ParamsState, type SimStatus } from './engine';
export { FRAME_HISTORY_LENGTH, FrameHistory, type MetricsSnapshot } from './metrics';
export type { SceneOverrides, SimContext, SimFactory, SimRegistry, Simulation } from './simulation';
export type { Store } from './store';
// TEMPORARY: deliberate boundary violation to prove CI catches it. Do not merge.
export type { FatalError } from '../ui';
