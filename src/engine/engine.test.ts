import { describe, expect, it } from 'vitest';
import { FrameHistory, MetricsAggregator, percentile, slowestMean } from './metrics';
import { orbit, pan, zoom, type OrbitRanges } from './orbit';
import { createStore } from './store';
import { FixedTimestep, MAX_FRAME_SECONDS, MAX_STEPS_PER_FRAME } from './timestep';

const settings = { fixedTimestep: 1 / 60, substeps: 4, timeScale: 1, paused: false };

describe('FixedTimestep', () => {
  it('accumulates real time into whole fixed steps', () => {
    const ts = new FixedTimestep();
    expect(ts.advance(0.01, settings).fixedSteps).toBe(0);
    const plan = ts.advance(0.01, settings);
    expect(plan.fixedSteps).toBe(1);
    expect(plan.substeps).toBe(4);
    expect(plan.substepDt).toBeCloseTo(1 / 240);
    expect(plan.simSeconds).toBeCloseTo(1 / 60);
  });

  it('scales time', () => {
    const ts = new FixedTimestep();
    expect(ts.advance(1 / 60, { ...settings, timeScale: 2 }).fixedSteps).toBe(2);
    expect(ts.advance(1 / 60, { ...settings, timeScale: 0 }).fixedSteps).toBe(0);
  });

  it('clamps long frames and caps steps per frame', () => {
    const ts = new FixedTimestep();
    const plan = ts.advance(5, settings);
    expect(plan.fixedSteps).toBe(MAX_STEPS_PER_FRAME);
    expect(ts.advance(0, settings).fixedSteps).toBe(0);

    const fine = new FixedTimestep();
    const fineSettings = { ...settings, fixedTimestep: 0.1 };
    expect(fine.advance(5, fineSettings).fixedSteps).toBe(Math.floor(MAX_FRAME_SECONDS / 0.1));
  });

  it('does nothing while paused except a requested single step', () => {
    const ts = new FixedTimestep();
    const paused = { ...settings, paused: true };
    expect(ts.advance(0.1, paused).fixedSteps).toBe(0);
    ts.requestStep();
    expect(ts.advance(0.1, paused).fixedSteps).toBe(1);
    expect(ts.advance(0.1, paused).fixedSteps).toBe(0);
  });

  it('does not carry paused time into resumed play', () => {
    const ts = new FixedTimestep();
    ts.advance(0.01, settings);
    ts.advance(1, { ...settings, paused: true });
    expect(ts.advance(0.001, settings).fixedSteps).toBe(0);
  });
});

describe('metrics', () => {
  it('computes nearest-rank percentiles', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 99)).toBe(0);
  });

  it('averages the slowest fraction of frames', () => {
    const sorted = [...Array.from({ length: 198 }, () => 10), 40, 60];
    expect(slowestMean(sorted, 0.01)).toBe(50);
    expect(slowestMean([5, 9], 0.01)).toBe(9);
  });

  it('aggregates a rolling window', () => {
    const agg = new MetricsAggregator();
    const extra = { gpuMs: null, gpuMemoryBytes: 0, canvas: { width: 1, height: 1, dpr: 1 } };
    for (let i = 0; i < 300; i++) {
      agg.record({ time: i * 10, frameMs: 10, cpuMs: 1, substeps: 4, drawCalls: 5, triangles: 27 });
    }
    const snap = agg.snapshot(extra);
    expect(snap.fps).toBeCloseTo(100);
    expect(snap.frameMsAvg).toBeCloseTo(10);
    expect(snap.drawCalls).toBe(5);
    // 2 s window at 10 ms per frame.
    agg.record({ time: 3000, frameMs: 50, cpuMs: 1, substeps: 4, drawCalls: 5, triangles: 27 });
    expect(agg.snapshot(extra).frameMsP99).toBe(10);
    expect(agg.snapshot(extra).onePercentLowFps).toBeCloseTo(1000 / 30);
  });

  it('keeps a fixed-length frame-time ring', () => {
    const history = new FrameHistory();
    for (let i = 0; i < history.values.length + 3; i++) history.push(i);
    expect(history.count).toBe(history.values.length);
    expect(history.head).toBe(3);
    expect(history.values[2]).toBe(history.values.length + 2);
  });
});

describe('orbit controls', () => {
  const camera = {
    target: { x: 0, y: 0.5, z: 0 },
    distance: 10,
    yaw: 0,
    pitch: 20,
    fov: 50,
  };
  const ranges: OrbitRanges = { distance: [1, 200], pitch: [1, 89] };

  it('rotates and clamps pitch above the ground', () => {
    expect(orbit(camera, -100, 0, ranges).yaw).toBeCloseTo(30);
    expect(orbit(camera, 0, -1000, ranges).pitch).toBe(1);
    expect(orbit(camera, 0, 1000, ranges).pitch).toBe(89);
    expect(orbit({ ...camera, yaw: 179 }, -10, 0, ranges).yaw).toBeCloseTo(-178);
  });

  it('pans on the ground plane without changing height', () => {
    const moved = pan(camera, 100, 0, 1000);
    expect(moved.target.x).toBeLessThan(0);
    expect(moved.target.y).toBe(0.5);
    expect(moved.target.z).toBeCloseTo(0);
    expect(pan(camera, 0, 100, 1000).target.z).toBeLessThan(0);
  });

  it('zooms multiplicatively within range', () => {
    expect(zoom(camera, 0.5, ranges).distance).toBe(5);
    expect(zoom(camera, 1000, ranges).distance).toBe(200);
  });
});

describe('store', () => {
  it('notifies subscribers on change only', () => {
    const store = createStore({ n: 1 });
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.update((s) => ({ n: s.n + 1 }));
    store.set(store.getSnapshot());
    expect(calls).toBe(1);
    expect(store.getSnapshot().n).toBe(2);
    unsubscribe();
    store.set({ n: 3 });
    expect(calls).toBe(1);
  });
});
