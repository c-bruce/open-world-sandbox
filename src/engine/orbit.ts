import type { SceneParams } from '../schema';

type Camera = SceneParams['camera'];
type Range = readonly [number, number];

/** Clamp ranges for camera distance (m) and pitch (degrees), read from the scene schema. */
export interface OrbitRanges {
  distance: Range;
  pitch: Range;
}

const ROTATE_DEG_PER_PX = 0.3;
const ZOOM_PER_WHEEL_PX = 0.0015;

const clamp = (v: number, [min, max]: Range) => Math.min(Math.max(v, min), max);
const wrapDegrees = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

export function orbit(camera: Camera, dxPx: number, dyPx: number, ranges: OrbitRanges): Camera {
  return {
    ...camera,
    yaw: wrapDegrees(camera.yaw - dxPx * ROTATE_DEG_PER_PX),
    pitch: clamp(camera.pitch + dyPx * ROTATE_DEG_PER_PX, ranges.pitch),
  };
}

/** Grab-the-ground pan in the camera's horizontal frame; `viewHeightPx` scales pixels to metres. */
export function pan(camera: Camera, dxPx: number, dyPx: number, viewHeightPx: number): Camera {
  const metresPerPx =
    (2 * camera.distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(viewHeightPx, 1);
  const yaw = (camera.yaw * Math.PI) / 180;
  const right = [Math.cos(yaw), -Math.sin(yaw)] as const;
  const forward = [-Math.sin(yaw), -Math.cos(yaw)] as const;
  const { x, y, z } = camera.target;
  return {
    ...camera,
    target: {
      x: x + (-right[0] * dxPx + forward[0] * dyPx) * metresPerPx,
      y,
      z: z + (-right[1] * dxPx + forward[1] * dyPx) * metresPerPx,
    },
  };
}

export function zoom(camera: Camera, factor: number, ranges: OrbitRanges): Camera {
  return { ...camera, distance: clamp(camera.distance * factor, ranges.distance) };
}

/**
 * Drag to orbit, right-drag / shift-drag / two fingers to pan, wheel / pinch to zoom.
 * Returns a function that removes the listeners.
 */
export function attachOrbitControls(
  element: HTMLElement,
  camera: { get(): Camera; set(next: Camera): void },
  ranges: OrbitRanges,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let panning = false;

  const centroidAndSpread = () => {
    const points = [...pointers.values()];
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const spread =
      points.length >= 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    return { cx, cy, spread };
  };

  const onPointerDown = (e: PointerEvent) => {
    element.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    panning = e.button === 2 || e.button === 1 || e.shiftKey;
  };

  const onPointerMove = (e: PointerEvent) => {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    const before = centroidAndSpread();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    let next = camera.get();
    if (pointers.size >= 2) {
      const after = centroidAndSpread();
      next = pan(next, after.cx - before.cx, after.cy - before.cy, element.clientHeight);
      if (before.spread > 0 && after.spread > 0) {
        next = zoom(next, before.spread / after.spread, ranges);
      }
    } else {
      const dx = e.clientX - previous.x;
      const dy = e.clientY - previous.y;
      next = panning ? pan(next, dx, dy, element.clientHeight) : orbit(next, dx, dy, ranges);
    }
    camera.set(next);
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) panning = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    camera.set(zoom(camera.get(), Math.exp(px * ZOOM_PER_WHEEL_PX), ranges));
  };

  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  element.style.touchAction = 'none';
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerUp);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);
  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerUp);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('contextmenu', onContextMenu);
  };
}
