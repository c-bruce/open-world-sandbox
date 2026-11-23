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
import { defaultAppParams } from '../schema';
import { App, type FatalError } from '../ui';
import { registry } from './registry';
import { formatRoute, parseRoute, type Route } from './routing';

const URL_DEBOUNCE_MS = 250;

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

  const route = parseRoute(location.hash);
  const engine = new Engine({
    gpu,
    api,
    profiler,
    renderer,
    canvas,
    registry,
    initial: {
      app: { ...defaultAppParams(), sim: route.sim, perfOverlay: route.perf },
      sim: route.params,
    },
  });
  syncRoute(engine);
  engine.start();
  // Dev-only console handle for inspecting stores and metrics.
  if (import.meta.env.DEV) Object.assign(window, { engine });
  return engine;
}

/** Keeps `#/<simId>?perf=1&p=<params>` in step with the engine, in both directions. */
function syncRoute(engine: Engine) {
  const current = (): Route => {
    const { app, sim } = engine.params.getSnapshot();
    return { sim: app.sim, perf: app.perfOverlay, params: sim };
  };
  const writeUrl = () => {
    const hash = formatRoute(current());
    if (hash !== location.hash) history.replaceState(null, '', hash);
  };
  // Normalise the URL straight away, e.g. replacing invalid params with defaults.
  writeUrl();

  let timer: ReturnType<typeof setTimeout> | undefined;
  engine.params.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(writeUrl, URL_DEBOUNCE_MS);
  });

  window.addEventListener('hashchange', () => {
    const route = parseRoute(location.hash);
    const now = current();
    // Compared as strings: SimId can be a single literal type.
    const nextSim: string = route.sim;
    if (nextSim !== now.sim) {
      engine.setSim(route.sim, route.params);
    } else if (formatRoute(route) !== formatRoute({ ...now, perf: route.perf })) {
      engine.setSimParams(route.params);
    }
    const { app } = engine.params.getSnapshot();
    if (route.perf !== app.perfOverlay) engine.setApp({ ...app, perfOverlay: route.perf });
  });
}
