import type { Bounds } from '../types';

/** Interleaved position (xyz) + normal (xyz) per vertex. */
export const VERTEX_FLOATS = 6;

export interface MeshData {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint32Array<ArrayBuffer>;
  bounds: Bounds;
}

const CUBE_FACES: readonly { n: [number, number, number]; u: [number, number, number] }[] = [
  { n: [1, 0, 0], u: [0, 0, -1] },
  { n: [-1, 0, 0], u: [0, 0, 1] },
  { n: [0, 1, 0], u: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0] },
  { n: [0, 0, 1], u: [1, 0, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0] },
];

/** Unit cube centred on the origin, 4 vertices per face so normals stay flat. */
export function cubeGeometry(): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const { n, u } of CUBE_FACES) {
    const v = cross(n, u);
    const base = vertices.length / VERTEX_FLOATS;
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      for (let i = 0; i < 3; i++) {
        vertices.push(0.5 * (n[i] + su * u[i] + sv * v[i]));
      }
      vertices.push(...n);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
  };
}

/** Unit-radius UV sphere; counter-clockwise winding seen from outside. */
export function uvSphereGeometry(segments = 48, rings = 24): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const x = Math.sin(phi) * Math.sin(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.cos(theta);
      vertices.push(x, y, z, x, y, z);
    }
  }
  const stride = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * stride + s;
      const b = a + stride;
      if (r > 0) indices.push(a, b, a + 1);
      if (r < rings - 1) indices.push(a + 1, b, b + 1);
    }
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
