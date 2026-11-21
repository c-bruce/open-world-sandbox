import { mat4, type Mat4 } from 'wgpu-matrix';
import type { SceneParams } from '../schema';
import { skyAmbient, sunTransmittance } from './atmosphere';
import type { Vec3 } from './types';

/** Byte size of the `Frame` struct in frame.wgsl. */
export const FRAME_UNIFORM_BYTES = 448;

export interface FrameValues {
  view: Mat4;
  proj: Mat4;
  lightViewProj: Mat4;
  cameraPos: Vec3;
  sunDir: Vec3;
  time: number;
  scene: SceneParams;
  viewport: { width: number; height: number };
  shadowMapSize: number;
  shadowNormalBias: number;
}

/** Packs `values` into `f32` using the layout of `Frame` in frame.wgsl. */
export function writeFrameUniforms(f32: Float32Array, values: FrameValues): void {
  const viewProj = mat4.multiply(values.proj, values.view);
  f32.set(values.view, 0);
  f32.set(values.proj, 16);
  f32.set(viewProj, 32);
  f32.set(mat4.inverse(viewProj), 48);
  f32.set(values.lightViewProj, 64);
  f32.set([...values.cameraPos, values.time], 80);
  const { sun, sky, exposure, grid } = values.scene;
  const transmittance = sunTransmittance(values.sunDir, sky.turbidity);
  const ambient = skyAmbient(values.sunDir, sky.turbidity, sun.intensity);
  f32.set([...values.sunDir, sun.intensity], 84);
  f32.set([...transmittance.map((t) => t * sun.intensity), sky.turbidity], 88);
  f32.set([...ambient.sky, exposure], 92);
  f32.set([...ambient.ground, 0], 96);
  f32.set([grid.cellSize, grid.majorInterval, grid.fadeDistance, 0], 100);
  const { width, height } = values.viewport;
  f32.set([width, height, 1 / width, 1 / height], 104);
  f32.set([1 / values.shadowMapSize, values.shadowNormalBias, 0, 0], 108);
}
