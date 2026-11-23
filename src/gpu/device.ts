/** Thrown when this browser or machine can't run WebGPU; the UI shows the unsupported screen. */
export class WebGpuUnsupportedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WebGpuUnsupportedError';
  }
}

/** Callbacks for errors that happen after startup. */
export interface GpuErrorHandlers {
  /** Validation or out-of-memory errors not caught by an error scope. */
  onUncapturedError(message: string): void;
  /** The device is gone (not by our `destroy()`); the app must stop. */
  onDeviceLost(message: string): void;
}

/** The device and the configured canvas, created once at startup. */
export interface GpuContext {
  device: GPUDevice;
  canvasContext: GPUCanvasContext;
  /** Preferred canvas format; only the tone-map pass renders to it. */
  format: GPUTextureFormat;
  /** Whether `timestamp-query` was enabled, i.e. per-pass GPU timings are available. */
  hasTimestampQuery: boolean;
  adapterInfo: GPUAdapterInfo;
}

/** Request a high-performance adapter and device, and configure `canvas` for it. */
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
