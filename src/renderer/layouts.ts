import { FRAME_UNIFORM_BYTES } from './frame';

export const HDR_FORMAT: GPUTextureFormat = 'rgba16float';
export const DEPTH_FORMAT: GPUTextureFormat = 'depth32float';
export const SHADOW_FORMAT: GPUTextureFormat = 'depth32float';

export interface Layouts {
  /** Main pass: frame uniforms, shadow map, comparison sampler. */
  frame: GPUBindGroupLayout;
  /** Shadow pass: frame uniforms only (the shadow map is the render target). */
  shadowFrame: GPUBindGroupLayout;
  /** Per renderable: instance data + material. */
  instance: GPUBindGroupLayout;
}

export function createLayouts(device: GPUDevice): Layouts {
  const frameUniform: GPUBindGroupLayoutEntry = {
    binding: 0,
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    buffer: { type: 'uniform', minBindingSize: FRAME_UNIFORM_BYTES },
  };
  return {
    frame: device.createBindGroupLayout({
      label: 'frame-layout',
      entries: [
        frameUniform,
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    }),
    shadowFrame: device.createBindGroupLayout({
      label: 'shadow-frame-layout',
      entries: [frameUniform],
    }),
    instance: device.createBindGroupLayout({
      label: 'instance-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    }),
  };
}
