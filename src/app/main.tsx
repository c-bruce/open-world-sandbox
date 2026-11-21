import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { mat4 } from 'wgpu-matrix';
import {
  createGpuApi,
  GpuProfiler,
  initGpu,
  observeCanvasSize,
  WebGpuUnsupportedError,
  type GpuContext,
} from '../gpu';
import { Renderer, type Renderable } from '../renderer';
import { defaultSceneParams } from '../schema';
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
  await startDevScene(gpu);
} catch (err) {
  render(
    err instanceof WebGpuUnsupportedError
      ? { title: 'WebGPU unavailable', message: `${err.message} Try a current Chrome or Edge.` }
      : { title: 'Failed to start', message: err instanceof Error ? err.message : String(err) },
  );
}

// Temporary M3 dev scene: fixed camera and a static cube; replaced by the engine in M4.
async function startDevScene(gpu: GpuContext) {
  const api = createGpuApi(gpu.device);
  const profiler = new GpuProfiler(api.memory, gpu.hasTimestampQuery);
  let renderer: Renderer | null = null;
  const sizer = observeCanvasSize(canvas, gpu.device, (size) => renderer?.resize(size));
  renderer = await Renderer.create(gpu, api, profiler, sizer.current());
  // The canvas may have resized while pipelines were compiling.
  renderer.resize(sizer.current());
  const scene = defaultSceneParams();

  const cube: Renderable = {
    label: 'dev-cube',
    mesh: renderer.meshes.cube,
    material: { kind: 'lit', color: [0.8, 0.8, 0.8], roughness: 0.5 },
    instances: { kind: 'static', transforms: mat4.translation([0, 0.5, 0]) },
    castsShadow: true,
    receivesShadow: true,
  };

  let lastLog = 0;
  const frame = (now: number) => {
    profiler.beginFrame();
    const encoder = gpu.device.createCommandEncoder({ label: 'frame' });
    renderer.encode(encoder, { scene, renderables: [cube], time: now / 1000 });
    profiler.endFrame(encoder);
    gpu.device.queue.submit([encoder.finish()]);
    profiler.afterSubmit();

    if (now - lastLog > 2000) {
      lastLog = now;
      console.debug('[dev]', {
        stats: renderer.lastStats(),
        memoryBytes: api.memory.snapshot().totalBytes,
        timings: profiler.results(),
      });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
