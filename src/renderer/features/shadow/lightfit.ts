import { mat4, vec3, type Mat4 } from 'wgpu-matrix';
import { boundsCorners } from '../../bounds';
import type { Bounds, Vec3 } from '../../types';

const DEPTH_MARGIN = 1;

/**
 * Orthographic light view-projection looking along -sunDir, tightly enclosing `bounds`.
 * Depth is reversed like the main pass: nearest to the sun maps to 1.
 */
export function fitLightViewProj(sunDir: Vec3, bounds: Bounds): Mat4 {
  const center = vec3.lerp(bounds.min, bounds.max, 0.5);
  const radius = vec3.distance(bounds.min, bounds.max) / 2;
  const eye = vec3.addScaled(center, sunDir, radius * 2 + DEPTH_MARGIN);
  const up: Vec3 = Math.abs(sunDir[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const view = mat4.lookAt(eye, center, up);

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const corner of boundsCorners(bounds)) {
    const [x = 0, y = 0, z = 0] = vec3.transformMat4(corner, view);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  // View space looks down -z; passing (far, near) to ortho reverses depth.
  const near = -maxZ - DEPTH_MARGIN;
  const far = -minZ + DEPTH_MARGIN;
  const proj = mat4.ortho(minX, maxX, minY, maxY, far, near);
  return mat4.multiply(proj, view);
}
