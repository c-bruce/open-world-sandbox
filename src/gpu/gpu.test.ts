import { describe, expect, it } from 'vitest';
import { alignTo, extent3d, textureByteSize } from './bytes';
import { timestampsToMs } from './profiler';
import { SlotRing } from './ring';

describe('alignTo', () => {
  it('rounds up to the alignment', () => {
    expect(alignTo(0, 16)).toBe(0);
    expect(alignTo(1, 16)).toBe(16);
    expect(alignTo(16, 16)).toBe(16);
    expect(alignTo(17, 4)).toBe(20);
  });
});

describe('textureByteSize', () => {
  it('multiplies texels by format size', () => {
    expect(textureByteSize({ format: 'rgba16float', width: 1920, height: 1080 })).toBe(
      1920 * 1080 * 8,
    );
    expect(textureByteSize({ format: 'depth32float', width: 2048, height: 2048 })).toBe(
      2048 * 2048 * 4,
    );
  });

  it('sums the mip chain, clamping each level to 1 texel', () => {
    expect(textureByteSize({ format: 'r8unorm', width: 4, height: 2, mipLevelCount: 3 })).toBe(
      8 + 2 + 1,
    );
  });

  it('accounts for layers and samples', () => {
    expect(
      textureByteSize({
        format: 'rgba8unorm',
        width: 2,
        height: 2,
        depthOrArrayLayers: 6,
        sampleCount: 4,
      }),
    ).toBe(2 * 2 * 6 * 4 * 4);
  });

  it('throws for unknown formats', () => {
    expect(() => textureByteSize({ format: 'astc-4x4-unorm', width: 4, height: 4 })).toThrow();
  });
});

describe('extent3d', () => {
  it('handles both sequence and dictionary forms', () => {
    expect(extent3d([8, 4])).toEqual({ width: 8, height: 4, depth: 1 });
    expect(extent3d({ width: 8, depthOrArrayLayers: 6 })).toEqual({
      width: 8,
      height: 1,
      depth: 6,
    });
  });
});

describe('SlotRing', () => {
  it('hands out slots round-robin and returns null when all are busy', () => {
    const ring = new SlotRing(3);
    expect([ring.acquire(), ring.acquire(), ring.acquire()]).toEqual([0, 1, 2]);
    expect(ring.acquire()).toBeNull();
    ring.release(1);
    expect(ring.acquire()).toBe(1);
    ring.release(0);
    ring.release(2);
    expect(ring.acquire()).toBe(2);
    expect(ring.acquire()).toBe(0);
  });
});

describe('timestampsToMs', () => {
  it('converts begin/end pairs to milliseconds per label', () => {
    const times = new BigUint64Array([1_000_000n, 3_500_000n, 4_000_000n, 4_250_000n]);
    expect(timestampsToMs(times, ['sim', 'main'])).toEqual({ sim: 2.5, main: 0.25 });
  });

  it('clamps out-of-order timestamps to zero', () => {
    expect(timestampsToMs(new BigUint64Array([5n, 1n]), ['x'])).toEqual({ x: 0 });
  });
});
