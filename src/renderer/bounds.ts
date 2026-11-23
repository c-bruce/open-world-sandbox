import type { Bounds, Vec3 } from './types';

export function boundsCorners({ min, max }: Bounds): Vec3[] {
  const corners: Vec3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z]);
  return corners;
}

export function boundsFromPoints(points: Iterable<Vec3>): Bounds | null {
  let min: [number, number, number] | null = null;
  let max: [number, number, number] = [0, 0, 0];
  for (const p of points) {
    if (!min) {
      min = [p[0], p[1], p[2]];
      max = [p[0], p[1], p[2]];
      continue;
    }
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i] ?? 0, p[i] ?? 0);
      max[i] = Math.max(max[i] ?? 0, p[i] ?? 0);
    }
  }
  return min ? { min, max } : null;
}

export function unionBounds(all: Iterable<Bounds>): Bounds | null {
  const points: Vec3[] = [];
  for (const b of all) points.push(b.min, b.max);
  return boundsFromPoints(points);
}

/** Bounds of `local` under each column-major mat4 packed in `transforms`. */
export function transformBounds(local: Bounds, transforms: Float32Array): Bounds | null {
  const corners = boundsCorners(local);
  const points: Vec3[] = [];
  for (let base = 0; base + 16 <= transforms.length; base += 16) {
    const m = (i: number) => transforms[base + i] ?? 0;
    for (const [x, y, z] of corners) {
      points.push([
        m(0) * x + m(4) * y + m(8) * z + m(12),
        m(1) * x + m(5) * y + m(9) * z + m(13),
        m(2) * x + m(6) * y + m(10) * z + m(14),
      ]);
    }
  }
  return boundsFromPoints(points);
}
