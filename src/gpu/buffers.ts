import { alignTo } from './bytes';
import type { MemoryTracker } from './memory';

export function createBufferWithData(
  memory: MemoryTracker,
  label: string,
  data: ArrayBufferView<ArrayBuffer>,
  usage: GPUBufferUsageFlags,
): GPUBuffer {
  const buffer = memory.createBuffer({
    label,
    size: alignTo(data.byteLength, 4),
    usage: usage | GPUBufferUsage.COPY_DST,
  });
  writeBuffer(memory.device, buffer, data);
  return buffer;
}

export function writeBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: ArrayBufferView<ArrayBuffer>,
  byteOffset = 0,
): void {
  device.queue.writeBuffer(buffer, byteOffset, data.buffer, data.byteOffset, data.byteLength);
}

/** CPU-side mirror of a uniform buffer; write through `f32`/`u32`, then `upload()`. */
export class UniformBuffer {
  readonly buffer: GPUBuffer;
  readonly f32: Float32Array<ArrayBuffer>;
  readonly u32: Uint32Array<ArrayBuffer>;
  private readonly memory: MemoryTracker;

  constructor(memory: MemoryTracker, label: string, byteSize: number) {
    this.memory = memory;
    const size = alignTo(byteSize, 16);
    const data = new ArrayBuffer(size);
    this.f32 = new Float32Array(data);
    this.u32 = new Uint32Array(data);
    this.buffer = memory.createBuffer({
      label,
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  upload(): void {
    writeBuffer(this.memory.device, this.buffer, this.f32);
  }

  destroy(): void {
    this.memory.destroy(this.buffer);
  }
}
