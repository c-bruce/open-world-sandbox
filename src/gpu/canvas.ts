export interface CanvasSize {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Keeps the canvas backing store at device-pixel resolution and reports changes,
 * so size-dependent textures can be recreated.
 */
export function observeCanvasSize(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  onResize: (size: CanvasSize) => void,
): { current(): CanvasSize; dispose(): void } {
  const max = device.limits.maxTextureDimension2D;
  let size: CanvasSize = { width: canvas.width, height: canvas.height, dpr: devicePixelRatio };

  const observer = new ResizeObserver((entries) => {
    const entry = entries.at(-1);
    if (!entry) return;
    const dpr = devicePixelRatio;
    // Missing in browsers without device-pixel-content-box support.
    const devicePixelSizes = entry.devicePixelContentBoxSize as
      readonly ResizeObserverSize[] | undefined;
    const devicePixels = devicePixelSizes?.at(0);
    const cssBox = entry.contentBoxSize.at(0);
    const width = devicePixels?.inlineSize ?? Math.round((cssBox?.inlineSize ?? 0) * dpr);
    const height = devicePixels?.blockSize ?? Math.round((cssBox?.blockSize ?? 0) * dpr);
    const next = {
      width: clamp(width, 1, max),
      height: clamp(height, 1, max),
      dpr,
    };
    if (next.width === size.width && next.height === size.height && next.dpr === size.dpr) return;
    canvas.width = next.width;
    canvas.height = next.height;
    size = next;
    onResize(size);
  });

  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    observer.observe(canvas, { box: 'content-box' });
  }

  return {
    current: () => size,
    dispose: () => {
      observer.disconnect();
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
