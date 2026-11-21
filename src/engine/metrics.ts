import type { PassTimings } from '../gpu';

export const METRICS_WINDOW_SECONDS = 2;
export const FRAME_HISTORY_LENGTH = 240;

export interface FrameSample {
  /** Wall-clock time of the frame (ms, performance.now()). */
  time: number;
  /** Interval since the previous frame (ms). */
  frameMs: number;
  /** Main-thread time spent producing the frame (ms). */
  cpuMs: number;
  substeps: number;
  drawCalls: number;
  triangles: number;
}

export interface MetricsSnapshot {
  fps: number;
  frameMsAvg: number;
  frameMsP99: number;
  /** Average FPS over the slowest 1% of frames in the window. */
  onePercentLowFps: number;
  cpuMsAvg: number;
  /** ms per pass label, or null when timestamp queries are unavailable. */
  gpuMs: PassTimings | null;
  substeps: number;
  drawCalls: number;
  triangles: number;
  gpuMemoryBytes: number;
  canvas: { width: number; height: number; dpr: number };
}

export const emptyMetrics: MetricsSnapshot = {
  fps: 0,
  frameMsAvg: 0,
  frameMsP99: 0,
  onePercentLowFps: 0,
  cpuMsAvg: 0,
  gpuMs: null,
  substeps: 0,
  drawCalls: 0,
  triangles: 0,
  gpuMemoryBytes: 0,
  canvas: { width: 0, height: 0, dpr: 1 },
};

/** Nearest-rank percentile (p in 0..100) of an ascending-sorted array. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? 0;
}

/** Mean of the slowest `fraction` of frame times (at least one frame). */
export function slowestMean(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const count = Math.max(1, Math.round(sorted.length * fraction));
  const slowest = sorted.slice(sorted.length - count);
  return slowest.reduce((sum, v) => sum + v, 0) / slowest.length;
}

/** Ring of recent frame times for the sparkline; read without copying. */
export class FrameHistory {
  readonly values = new Float32Array(FRAME_HISTORY_LENGTH);
  /** Index of the next write; the oldest sample sits here once full. */
  head = 0;
  count = 0;

  push(frameMs: number): void {
    this.values[this.head] = frameMs;
    this.head = (this.head + 1) % this.values.length;
    this.count = Math.min(this.count + 1, this.values.length);
  }
}

/** Rolling-window aggregation of per-frame samples. */
export class MetricsAggregator {
  private samples: FrameSample[] = [];

  record(sample: FrameSample): void {
    this.samples.push(sample);
    const cutoff = sample.time - METRICS_WINDOW_SECONDS * 1000;
    let drop = 0;
    while (drop < this.samples.length && (this.samples[drop]?.time ?? 0) < cutoff) drop++;
    if (drop > 0) this.samples = this.samples.slice(drop);
  }

  snapshot(extra: Pick<MetricsSnapshot, 'gpuMs' | 'gpuMemoryBytes' | 'canvas'>): MetricsSnapshot {
    const { samples } = this;
    const last = samples.at(-1);
    if (!last) return { ...emptyMetrics, ...extra };
    const frameTimes = samples.map((s) => s.frameMs).sort((a, b) => a - b);
    const totalMs = frameTimes.reduce((sum, v) => sum + v, 0);
    const lowMs = slowestMean(frameTimes, 0.01);
    return {
      fps: totalMs > 0 ? (1000 * samples.length) / totalMs : 0,
      frameMsAvg: totalMs / samples.length,
      frameMsP99: percentile(frameTimes, 99),
      onePercentLowFps: lowMs > 0 ? 1000 / lowMs : 0,
      cpuMsAvg: samples.reduce((sum, s) => sum + s.cpuMs, 0) / samples.length,
      substeps: last.substeps,
      drawCalls: last.drawCalls,
      triangles: last.triangles,
      ...extra,
    };
  }
}
