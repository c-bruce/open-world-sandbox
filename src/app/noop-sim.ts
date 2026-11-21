import { mat4 } from 'wgpu-matrix';
import type { SimContext, SimFactory } from '../engine';
import type { Renderable } from '../renderer';

// Temporary M4 test sim: allocates GPU memory and draws a cube so sim switching can be checked.
export const createNoopSim: SimFactory = () => {
  let ctx: SimContext | null = null;
  let buffer: GPUBuffer | null = null;
  let renderables: Renderable[] = [];
  return {
    init(context) {
      ctx = context;
      buffer = context.gpu.createBuffer({
        label: 'noop-scratch',
        size: 1 << 20,
        usage: GPUBufferUsage.STORAGE,
      });
      renderables = [
        {
          label: 'noop-cube',
          mesh: context.meshes.cube,
          material: { kind: 'lit', color: [0.8, 0.8, 0.8], roughness: 0.5 },
          instances: { kind: 'static', transforms: mat4.translation([0, 0.5, 0]) },
          castsShadow: true,
          receivesShadow: true,
        },
      ];
      return Promise.resolve();
    },
    setParams() {},
    reset() {},
    step() {},
    renderables: () => renderables,
    dispose() {
      if (ctx && buffer) ctx.gpu.destroy(buffer);
      buffer = null;
      renderables = [];
    },
  };
};
