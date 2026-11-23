import { createBufferWithData, UniformBuffer, writeBuffer } from './buffers';
import { MemoryTracker } from './memory';
import { createShaderModule } from './shaders';

type Labelled<T> = T & { label: string };

/** Resource helpers with memory tracking; every resource must carry a label. */
export interface GpuApi {
  readonly device: GPUDevice;
  readonly memory: MemoryTracker;
  createBuffer(desc: Labelled<GPUBufferDescriptor>): GPUBuffer;
  createBufferWithData(
    label: string,
    data: ArrayBufferView<ArrayBuffer>,
    usage: GPUBufferUsageFlags,
  ): GPUBuffer;
  writeBuffer(buffer: GPUBuffer, data: ArrayBufferView<ArrayBuffer>, byteOffset?: number): void;
  createUniformBuffer(label: string, byteSize: number): UniformBuffer;
  createTexture(desc: Labelled<GPUTextureDescriptor>): GPUTexture;
  destroy(resource: GPUBuffer | GPUTexture): void;
  createShaderModule(label: string, code: string): Promise<GPUShaderModule>;
  createComputePipeline(desc: Labelled<GPUComputePipelineDescriptor>): Promise<GPUComputePipeline>;
  createRenderPipeline(desc: Labelled<GPURenderPipelineDescriptor>): Promise<GPURenderPipeline>;
}

export function createGpuApi(device: GPUDevice): GpuApi {
  const memory = new MemoryTracker(device);
  return {
    device,
    memory,
    createBuffer: (desc) => memory.createBuffer(desc),
    createBufferWithData: (label, data, usage) => createBufferWithData(memory, label, data, usage),
    writeBuffer: (buffer, data, byteOffset) => {
      writeBuffer(device, buffer, data, byteOffset);
    },
    createUniformBuffer: (label, byteSize) => new UniformBuffer(memory, label, byteSize),
    createTexture: (desc) => memory.createTexture(desc),
    destroy: (resource) => {
      memory.destroy(resource);
    },
    createShaderModule: (label, code) => createShaderModule(device, label, code),
    createComputePipeline: (desc) => device.createComputePipelineAsync(desc),
    createRenderPipeline: (desc) => device.createRenderPipelineAsync(desc),
  };
}
