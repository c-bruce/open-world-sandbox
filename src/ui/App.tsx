import { useEffect, useRef } from 'react';
import type { Engine } from '../engine';
import { parseAppParams } from '../schema';
import { FatalScreen, type FatalError } from './FatalScreen';
import { useStore } from './hooks';
import { PerfOverlay } from './PerfOverlay';
import { SidePanel } from './SidePanel';
import './styles.css';

interface AppProps {
  /** Created before the GPU is ready; App mounts it into the viewport. */
  canvas: HTMLCanvasElement;
  /** Null until startup finishes; only the canvas is shown until then. */
  engine: Engine | null;
  /** When set, shown instead of the panel and overlay. */
  error?: FatalError;
}

export function App({ canvas, engine, error }: AppProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, [canvas]);

  return (
    <>
      <div ref={hostRef} className="viewport" />
      {error ? <FatalScreen error={error} /> : engine && <EngineUi engine={engine} />}
    </>
  );
}

function EngineUi({ engine }: { engine: Engine }) {
  const { app } = useStore(engine.params);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
      const current = engine.params.getSnapshot().app;
      const result = parseAppParams({ ...current, perfOverlay: !current.perfOverlay });
      if (result.ok) engine.setApp(result.value);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [engine]);

  return (
    <>
      {app.perfOverlay && <PerfOverlay engine={engine} />}
      <SidePanel engine={engine} />
    </>
  );
}
