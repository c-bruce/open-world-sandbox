import { describe, expect, it } from 'vitest';
import { mat4, vec3, vec4 } from 'wgpu-matrix';
import { skyAmbient, sunTransmittance } from './atmosphere';
import { transformBounds, unionBounds } from './bounds';
import { orbitEye, projectionMatrix, sunDirection } from './camera';
import { fitLightViewProj } from './features/shadow';
import { FRAME_UNIFORM_BYTES } from './frame';
import { cubeGeometry, uvSphereGeometry, VERTEX_FLOATS, type MeshData } from './meshes';
import type { Bounds, Vec3 } from './types';

const close = (a: ArrayLike<number>, b: ArrayLike<number>, digits = 5) => {
  expect(Array.from(a).length).toBe(Array.from(b).length);
  Array.from(a).forEach((v, i) => {
    expect(v).toBeCloseTo(b[i], digits);
  });
};

describe('camera', () => {
  it('places the orbit eye from yaw, pitch and distance', () => {
    const target = { x: 1, y: 2, z: 3 };
    close(orbitEye({ target, distance: 10, yaw: 0, pitch: 0, fov: 50 }), [1, 2, 13]);
    close(orbitEye({ target, distance: 10, yaw: 90, pitch: 0, fov: 50 }), [11, 2, 3]);
    close(orbitEye({ target, distance: 10, yaw: 0, pitch: 90, fov: 50 }), [1, 12, 3]);
  });

  it('uses reversed-Z with an infinite far plane', () => {
    const proj = projectionMatrix(60, 1);
    const depthAt = (z: number) => {
      const clip = vec4.transformMat4([0, 0, -z, 1], proj);
      return clip[2] / clip[3];
    };
    expect(depthAt(0.05)).toBeCloseTo(1, 5);
    expect(depthAt(10)).toBeGreaterThan(depthAt(1000));
    expect(depthAt(1e9)).toBeGreaterThan(0);
    expect(depthAt(1e9)).toBeLessThan(1e-6);
  });

  it('converts sun azimuth/elevation to a unit vector', () => {
    close(sunDirection(0, 0), [0, 0, -1]);
    close(sunDirection(90, 0), [1, 0, 0]);
    close(sunDirection(123, 90), [0, 1, 0]);
    expect(vec3.length(sunDirection(300, 10))).toBeCloseTo(1, 6);
  });
});

describe('bounds', () => {
  const unit: Bounds = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };

  it('transforms bounds by every instance matrix', () => {
    const transforms = new Float32Array([
      ...mat4.translation([2, 0, 0]),
      ...mat4.multiply(mat4.translation([0, 3, 0]), mat4.scaling([2, 2, 2])),
    ]);
    expect(transformBounds(unit, transforms)).toEqual({ min: [-1, -0.5, -1], max: [2.5, 4, 1] });
  });

  it('unions bounds and returns null for none', () => {
    expect(unionBounds([])).toBeNull();
    expect(unionBounds([unit, { min: [0, 0, 0], max: [3, 1, 1] }])).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [3, 1, 1],
    });
  });
});

describe('fitLightViewProj', () => {
  const bounds: Bounds = { min: [-8, 0, -8], max: [8, 5, 8] };
  const sun = sunDirection(300, 10);
  const lightVP = fitLightViewProj(sun, bounds);
  const project = (p: Vec3) => {
    const clip = vec4.transformMat4([...p, 1], lightVP);
    return [clip[0], clip[1], clip[2]];
  };

  it('keeps every bounds corner inside the light frustum', () => {
    for (const x of [-8, 8])
      for (const y of [0, 5])
        for (const z of [-8, 8]) {
          const [cx = 0, cy = 0, cz = 0] = project([x, y, z]);
          expect(Math.abs(cx)).toBeLessThanOrEqual(1 + 1e-5);
          expect(Math.abs(cy)).toBeLessThanOrEqual(1 + 1e-5);
          expect(cz).toBeGreaterThan(0);
          expect(cz).toBeLessThan(1);
        }
  });

  it('maps points closer to the sun to larger depth (reversed-Z)', () => {
    const towardsSun = project([sun[0] * 2, sun[1] * 2 + 1, sun[2] * 2])[2] ?? 0;
    const awayFromSun = project([-sun[0] * 2, 1, -sun[2] * 2])[2] ?? 0;
    expect(towardsSun).toBeGreaterThan(awayFromSun);
  });
});

describe('procedural meshes', () => {
  function check(mesh: MeshData) {
    const vertexCount = mesh.vertices.length / VERTEX_FLOATS;
    expect(Number.isInteger(vertexCount)).toBe(true);
    expect(mesh.indices.length % 3).toBe(0);
    for (const index of mesh.indices) expect(index).toBeLessThan(vertexCount);
    const at = (i: number): Vec3 => [
      mesh.vertices[i * VERTEX_FLOATS] ?? 0,
      mesh.vertices[i * VERTEX_FLOATS + 1] ?? 0,
      mesh.vertices[i * VERTEX_FLOATS + 2] ?? 0,
    ];
    for (let i = 0; i < vertexCount; i++) {
      const n = mesh.vertices.subarray(i * VERTEX_FLOATS + 3, i * VERTEX_FLOATS + 6);
      expect(vec3.length(n)).toBeCloseTo(1, 5);
    }
    // Counter-clockwise from outside: face normal points away from the centre.
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => at(mesh.indices[t + k] ?? 0)) as [Vec3, Vec3, Vec3];
      const normal = vec3.cross(vec3.subtract(b, a), vec3.subtract(c, a));
      const centroid = vec3.scale(vec3.add(vec3.add(a, b), c), 1 / 3);
      expect(vec3.dot(normal, centroid)).toBeGreaterThan(0);
    }
  }

  it('builds a closed, outward-facing cube', () => {
    const cube = cubeGeometry();
    expect(cube.vertices.length / VERTEX_FLOATS).toBe(24);
    expect(cube.indices.length).toBe(36);
    check(cube);
  });

  it('builds an outward-facing unit sphere', () => {
    const sphere = uvSphereGeometry(16, 8);
    check(sphere);
    for (let i = 0; i < sphere.vertices.length; i += VERTEX_FLOATS) {
      expect(vec3.length(sphere.vertices.subarray(i, i + 3))).toBeCloseTo(1, 5);
    }
  });
});

describe('atmosphere', () => {
  it('reddens sunlight as the sun gets lower and removes it below the horizon', () => {
    const [rLow, , bLow] = sunTransmittance(sunDirection(0, 5), 2.5);
    const [rHigh, , bHigh] = sunTransmittance(sunDirection(0, 60), 2.5);
    expect(rLow / bLow).toBeGreaterThan(rHigh / bHigh);
    expect(sunTransmittance(sunDirection(0, -5), 2.5)).toEqual([0, 0, 0]);
  });

  it('gives a blue-ish ambient from a midday sky', () => {
    const { sky } = skyAmbient(sunDirection(0, 60), 2.5, 4);
    expect(sky[2]).toBeGreaterThan(sky[0]);
  });
});

describe('frame uniforms', () => {
  it('fit in the declared byte size', () => {
    expect(FRAME_UNIFORM_BYTES % 16).toBe(0);
    expect(FRAME_UNIFORM_BYTES / 4).toBeGreaterThanOrEqual(112);
  });
});
