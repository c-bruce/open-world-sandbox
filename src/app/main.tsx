import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createGpuApi,
  GpuProfiler,
  initGpu,
  observeCanvasSize,
  WebGpuUnsupportedError,
  type CanvasSize,
  type GpuApi,
} from '../gpu';
import { App, type FatalError } from '../ui';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');
const root = createRoot(rootElement);
const canvas = document.createElement('canvas');

function render(error?: FatalError) {
  root.render(
    <StrictMode>
      <App canvas={canvas} error={error} />
    </StrictMode>,
  );
}

render();

try {
  const gpu = await initGpu(canvas, {
    onUncapturedError: (message) => {
      console.error(message);
    },
    onDeviceLost: (message) => {
      render({ title: 'GPU device lost', message });
    },
  });
  startClearLoop(gpu.device, gpu.canvasContext, createGpuApi(gpu.device), gpu.hasTimestampQuery);
} catch (err) {
  render(
    err instanceof WebGpuUnsupportedError
      ? { title: 'WebGPU unavailable', message: `${err.message} Try a current Chrome or Edge.` }
      : { title: 'Failed to start', message: err instanceof Error ? err.message : String(err) },
  );
}

// Temporary M2 dev loop: clears to a colour; replaced by the renderer in M3.
function startClearLoop(
  device: GPUDevice,
  context: GPUCanvasContext,
  api: GpuApi,
  hasTimestampQuery: boolean,
) {
  const profiler = new GpuProfiler(api.memory, hasTimestampQuery);
  let hdr: GPUTexture | null = null;
  const recreate = ({ width, height }: CanvasSize) => {
    if (hdr) api.destroy(hdr);
    hdr = api.createTexture({
      label: 'hdr',
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  };
  observeCanvasSize(canvas, device, recreate);

  let lastLog = 0;
  const frame = (now: number) => {
    profiler.beginFrame();
    const encoder = device.createCommandEncoder({ label: 'frame' });
    const pass = encoder.beginRenderPass({
      label: 'clear',
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.18, g: 0.32, b: 0.48, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      timestampWrites: profiler.timestampWrites('clear'),
    });
    pass.end();
    profiler.endFrame(encoder);
    device.queue.submit([encoder.finish()]);
    profiler.afterSubmit();

    if (now - lastLog > 2000) {
      lastLog = now;
      const memory = api.memory.snapshot();
      console.debug('[gpu]', {
        canvas: `${String(canvas.width)}×${String(canvas.height)}`,
        memoryBytes: memory.totalBytes,
        byLabel: Object.fromEntries(memory.byLabel),
        timings: profiler.results(),
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
