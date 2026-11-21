import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from '../engine';
import {
  createGpuApi,
  GpuProfiler,
  initGpu,
  observeCanvasSize,
  WebGpuUnsupportedError,
  type GpuContext,
} from '../gpu';
import { Renderer } from '../renderer';
import { App, type FatalError } from '../ui';
import { registry } from './registry';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');
const root = createRoot(rootElement);
const canvas = document.createElement('canvas');
let engine: Engine | null = null;

function render(error?: FatalError) {
  root.render(
    <StrictMode>
      <App canvas={canvas} engine={engine} error={error} />
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
      engine?.stop();
      render({ kind: 'error', title: 'GPU device lost', message });
    },
  });
  engine = await start(gpu);
  render();
} catch (err) {
  render(
    err instanceof WebGpuUnsupportedError
      ? { kind: 'unsupported', title: 'WebGPU unavailable', message: err.message }
      : {
          kind: 'error',
          title: 'Failed to start',
          message: err instanceof Error ? err.message : String(err),
        },
  );
}

async function start(gpu: GpuContext): Promise<Engine> {
  const api = createGpuApi(gpu.device);
  const profiler = new GpuProfiler(api.memory, gpu.hasTimestampQuery);
  let renderer: Renderer | null = null;
  const sizer = observeCanvasSize(canvas, gpu.device, (size) => renderer?.resize(size));
  renderer = await Renderer.create(gpu, api, profiler, sizer.current());
  // The canvas may have resized while pipelines were compiling.
  renderer.resize(sizer.current());

  const engine = new Engine({ gpu, api, profiler, renderer, canvas, registry });
  engine.start();
  // Dev-only console handle for inspecting stores and metrics.
  if (import.meta.env.DEV) Object.assign(window, { engine });
  return engine;
}
