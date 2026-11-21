export class WebGpuUnsupportedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WebGpuUnsupportedError';
  }
}

export interface GpuErrorHandlers {
  onUncapturedError(message: string): void;
  onDeviceLost(message: string): void;
}

export interface GpuContext {
  device: GPUDevice;
  canvasContext: GPUCanvasContext;
  format: GPUTextureFormat;
  hasTimestampQuery: boolean;
  adapterInfo: GPUAdapterInfo;
}

export async function initGpu(
  canvas: HTMLCanvasElement,
  handlers: GpuErrorHandlers,
): Promise<GpuContext> {
  if (!('gpu' in navigator)) {
    throw new WebGpuUnsupportedError('This browser does not support WebGPU.');
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    throw new WebGpuUnsupportedError(
      'WebGPU is available, but no compatible GPU adapter was found.',
    );
  }

  const hasTimestampQuery = adapter.features.has('timestamp-query');
  const device = await adapter.requestDevice({
    label: 'device',
    requiredFeatures: hasTimestampQuery ? ['timestamp-query'] : [],
  });

  device.addEventListener('uncapturederror', (event) => {
    handlers.onUncapturedError(event.error.message);
  });
  void device.lost.then((info) => {
    if (info.reason !== 'destroyed') handlers.onDeviceLost(info.message || 'GPU device lost.');
  });

  const canvasContext = canvas.getContext('webgpu');
  if (!canvasContext) {
    throw new WebGpuUnsupportedError('Could not create a WebGPU canvas context.');
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  canvasContext.configure({ device, format, alphaMode: 'opaque' });

  return { device, canvasContext, format, hasTimestampQuery, adapterInfo: adapter.info };
}
