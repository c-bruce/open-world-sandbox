import { extent3d, textureByteSize } from './bytes';

export interface MemorySnapshot {
  totalBytes: number;
  byLabel: ReadonlyMap<string, number>;
}

/** Tallies bytes of live GPU buffers and textures by label. */
export class MemoryTracker {
  private readonly live = new Map<GPUBuffer | GPUTexture, { label: string; bytes: number }>();

  readonly device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  createBuffer(desc: GPUBufferDescriptor & { label: string }): GPUBuffer {
    const buffer = this.device.createBuffer(desc);
    this.live.set(buffer, { label: desc.label, bytes: desc.size });
    return buffer;
  }

  createTexture(desc: GPUTextureDescriptor & { label: string }): GPUTexture {
    const texture = this.device.createTexture(desc);
    const { width, height, depth } = extent3d(desc.size);
    const bytes = textureByteSize({
      format: desc.format,
      width,
      height,
      depthOrArrayLayers: depth,
      mipLevelCount: desc.mipLevelCount,
      sampleCount: desc.sampleCount,
    });
    this.live.set(texture, { label: desc.label, bytes });
    return texture;
  }

  destroy(resource: GPUBuffer | GPUTexture): void {
    this.live.delete(resource);
    resource.destroy();
  }

  snapshot(): MemorySnapshot {
    const byLabel = new Map<string, number>();
    let totalBytes = 0;
    for (const { label, bytes } of this.live.values()) {
      byLabel.set(label, (byLabel.get(label) ?? 0) + bytes);
      totalBytes += bytes;
    }
    return { totalBytes, byLabel };
  }
}
