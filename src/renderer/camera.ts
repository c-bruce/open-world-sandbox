import { mat4, type Mat4 } from 'wgpu-matrix';
import type { Vec3 } from './types';

const NEAR = 0.05;
const deg = Math.PI / 180;

export interface OrbitCamera {
  target: { x: number; y: number; z: number };
  distance: number;
  yaw: number;
  pitch: number;
  fov: number;
}

/** Eye position for an orbit camera; yaw 0 looks along -z, pitch > 0 is above the target. */
export function orbitEye({ target, distance, yaw, pitch }: OrbitCamera): Vec3 {
  const cp = Math.cos(pitch * deg);
  return [
    target.x + distance * cp * Math.sin(yaw * deg),
    target.y + distance * Math.sin(pitch * deg),
    target.z + distance * cp * Math.cos(yaw * deg),
  ];
}

export function viewMatrix(camera: OrbitCamera): Mat4 {
  const { x, y, z } = camera.target;
  return mat4.lookAt(orbitEye(camera), [x, y, z], [0, 1, 0]);
}

/** Reversed-Z, infinite far plane: near maps to depth 1, infinity to depth 0. */
export function projectionMatrix(fovDeg: number, aspect: number): Mat4 {
  return mat4.perspectiveReverseZ(fovDeg * deg, aspect, NEAR, Infinity);
}

/**
 * Unit vector pointing towards the sun. Azimuth is clockwise from -z (north) towards
 * +x (east); elevation is above the horizon.
 */
export function sunDirection(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * deg;
  const el = elevationDeg * deg;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}
