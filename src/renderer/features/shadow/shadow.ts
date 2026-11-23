import type { Mat4 } from 'wgpu-matrix';
import type { GpuApi } from '../../../gpu';
import { unionBounds } from '../../bounds';
import { SHADOW_FORMAT } from '../../layouts';
import type { Bounds, Vec3 } from '../../types';
import { fitLightViewProj } from './lightfit';

export const SHADOW_MAP_SIZE = 2048;
/** World-space offset along the receiver normal before the shadow lookup (m). */
export const SHADOW_NORMAL_BIAS = 0.02;
/** Half-size of the region around the origin that always receives shadows (m). */
const MIN_EXTENT = 8;

const MIN_BOUNDS: Bounds = { min: [-MIN_EXTENT, 0, -MIN_EXTENT], max: [MIN_EXTENT, 2, MIN_EXTENT] };

/** Single directional shadow map; the renderer opens the pass, meshes draw into it. */
export class ShadowFeature {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly sampler: GPUSampler;
  private readonly api: GpuApi;

  constructor(api: GpuApi) {
    this.api = api;
    this.texture = api.createTexture({
      label: 'shadow-map',
      size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE],
      format: SHADOW_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.view = this.texture.createView({ label: 'shadow-map-view' });
    this.sampler = api.device.createSampler({
      label: 'shadow-sampler',
      compare: 'greater-equal',
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  lightViewProj(sunDir: Vec3, casterBounds: readonly Bounds[]): Mat4 {
    const bounds = unionBounds([MIN_BOUNDS, ...casterBounds]) ?? MIN_BOUNDS;
    return fitLightViewProj(sunDir, bounds);
  }

  passDescriptor(timestampWrites?: GPURenderPassTimestampWrites): GPURenderPassDescriptor {
    return {
      label: 'shadow',
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.view,
        depthClearValue: 0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
      timestampWrites,
    };
  }

  destroy(): void {
    this.api.destroy(this.texture);
  }
}
