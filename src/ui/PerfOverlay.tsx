import { useEffect, useRef } from 'react';
import { FRAME_HISTORY_LENGTH, type Engine, type FrameHistory } from '../engine';
import { formatBytes, formatCount } from './format';
import { useStore } from './hooks';

const PASSES = ['sim', 'shadow', 'main', 'tonemap'] as const;
const TIMING_NOTE =
  'Browsers may coarsen GPU timestamps unless WebGPU developer features are enabled ' +
  '(chrome://flags/#enable-webgpu-developer-features).';

export function PerfOverlay({ engine }: { engine: Engine }) {
  const m = useStore(engine.metrics);
  const gpuTotal = m.gpuMs ? Object.values(m.gpuMs).reduce((sum, v) => sum + v, 0) : 0;

  return (
    <div className="perf" role="status" aria-label="Performance">
      <div className="perf-headline">
        <span className="perf-big">{m.fps.toFixed(0)}</span>
        <span className="perf-unit">fps</span>
        <dl className="perf-inline">
          <dt>frame</dt>
          <dd>
            {m.frameMsAvg.toFixed(1)} / {m.frameMsP99.toFixed(1)} ms
          </dd>
          <dt>1% low</dt>
          <dd>{m.onePercentLowFps.toFixed(0)}</dd>
        </dl>
      </div>
      <p className="perf-caption">frame avg / p99</p>

      <Sparkline history={engine.frameHistory} />

      <table className="perf-table">
        <tbody>
          <tr>
            <th>CPU</th>
            <td>{m.cpuMsAvg.toFixed(2)} ms</td>
          </tr>
          <tr>
            <th>substeps</th>
            <td>{m.substeps}</td>
          </tr>
        </tbody>
        <tbody title={m.gpuMs ? TIMING_NOTE : `timestamp-query is not supported. ${TIMING_NOTE}`}>
          {m.gpuMs ? (
            <>
              {PASSES.map((pass) => (
                <tr key={pass}>
                  <th>GPU {pass}</th>
                  <td>{m.gpuMs?.[pass] === undefined ? '–' : `${m.gpuMs[pass].toFixed(2)} ms`}</td>
                </tr>
              ))}
              <tr className="perf-total">
                <th>GPU total</th>
                <td>{gpuTotal.toFixed(2)} ms</td>
              </tr>
            </>
          ) : (
            <tr>
              <th>GPU</th>
              <td className="perf-muted">timing unavailable</td>
            </tr>
          )}
        </tbody>
        <tbody>
          <tr>
            <th>draws</th>
            <td>{m.drawCalls}</td>
          </tr>
          <tr>
            <th>triangles</th>
            <td>{formatCount(m.triangles)}</td>
          </tr>
          <tr>
            <th>GPU memory</th>
            <td>{formatBytes(m.gpuMemoryBytes)}</td>
          </tr>
          <tr>
            <th>resolution</th>
            <td>
              {m.canvas.width}×{m.canvas.height} @{m.canvas.dpr.toFixed(2)}x
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SPARK_WIDTH = 200;
const SPARK_HEIGHT = 36;
const TARGET_MS = 1000 / 60;

/** Frame-time history drawn imperatively every animation frame, outside React rendering. */
function Sparkline({ history }: { history: FrameHistory }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = devicePixelRatio;
    canvas.width = SPARK_WIDTH * dpr;
    canvas.height = SPARK_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    const style = getComputedStyle(canvas);
    const line = style.getPropertyValue('--spark-line').trim() || '#7fd3ff';
    const guide = style.getPropertyValue('--spark-guide').trim() || '#ffffff33';

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { values, head, count } = history;
      let peak = TARGET_MS * 2;
      for (let i = 0; i < count; i++) peak = Math.max(peak, values[i] ?? 0);
      const y = (ms: number) => SPARK_HEIGHT - (ms / peak) * (SPARK_HEIGHT - 2) - 1;

      ctx.clearRect(0, 0, SPARK_WIDTH, SPARK_HEIGHT);
      ctx.strokeStyle = guide;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y(TARGET_MS)) + 0.5);
      ctx.lineTo(SPARK_WIDTH, Math.round(y(TARGET_MS)) + 0.5);
      ctx.stroke();

      ctx.strokeStyle = line;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      const start = count < FRAME_HISTORY_LENGTH ? 0 : head;
      for (let i = 0; i < count; i++) {
        const value = values[(start + i) % FRAME_HISTORY_LENGTH] ?? 0;
        const x = SPARK_WIDTH - ((count - 1 - i) / (FRAME_HISTORY_LENGTH - 1)) * SPARK_WIDTH;
        if (i === 0) ctx.moveTo(x, y(value));
        else ctx.lineTo(x, y(value));
      }
      ctx.stroke();
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [history]);

  return (
    <canvas
      ref={ref}
      className="sparkline"
      style={{ width: SPARK_WIDTH, height: SPARK_HEIGHT }}
      aria-label="Frame time history; the line marks 16.7 ms"
      role="img"
    />
  );
}
