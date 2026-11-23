import type { SimContext, Simulation } from '../../engine';
import type { UniformBuffer } from '../../gpu';
import type { Bounds, Renderable } from '../../renderer';
import type { SimParamsFor } from '../../schema';
import bouncingBallWgsl from './bouncing-ball.wgsl?raw';

type BouncingBallParams = SimParamsFor<'bouncing-ball'>;

const BALL_COUNT = 1;
const WORKGROUP_SIZE = 64;
/** Horizontal travel assumed for the shadow bounds when drag is too low to stop the ball (m). */
const MAX_TRAVEL = 50;

interface Resources {
  ctx: SimContext;
  posRadius: GPUBuffer;
  velocity: GPUBuffer;
  uniforms: UniformBuffer;
  stepPipeline: GPUComputePipeline;
  projectPipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
  renderable: Renderable;
}

/** Conservative world bounds: drop height vertically, drag-limited travel along x. */
export function bouncingBallBounds(params: BouncingBallParams): Bounds {
  const r = params.radius;
  const travel =
    params.drag > 0
      ? Math.min(Math.abs(params.initialVelocityX) / params.drag, MAX_TRAVEL)
      : MAX_TRAVEL;
  const reach = Math.sign(params.initialVelocityX) * travel;
  return {
    min: [Math.min(0, reach) - r, 0, -r],
    max: [Math.max(0, reach) + r, Math.max(params.dropHeight, r) + r, r],
  };
}

class BouncingBallSim implements Simulation<BouncingBallParams> {
  private res: Resources | null = null;
  private params: BouncingBallParams | null = null;
  private dt = 0;

  async init(ctx: SimContext, params: BouncingBallParams): Promise<void> {
    const { gpu } = ctx;
    const module = await gpu.createShaderModule('bouncing-ball', bouncingBallWgsl);
    const layout = ctx.device.createBindGroupLayout({
      label: 'bouncing-ball-bind-group-layout',
      entries: [0, 1, 2].map((binding) => ({
        binding,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: binding === 2 ? ('uniform' as const) : ('storage' as const) },
      })),
    });
    const pipelineLayout = ctx.device.createPipelineLayout({
      label: 'bouncing-ball-layout',
      bindGroupLayouts: [layout],
    });
    const [stepPipeline, projectPipeline] = await Promise.all(
      ['step', 'project'].map((entryPoint) =>
        gpu.createComputePipeline({
          label: `bouncing-ball-${entryPoint}`,
          layout: pipelineLayout,
          compute: { module, entryPoint },
        }),
      ),
    );
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    const posRadius = gpu.createBuffer({
      label: 'bouncing-ball-pos-radius',
      size: BALL_COUNT * 16,
      usage,
    });
    const velocity = gpu.createBuffer({
      label: 'bouncing-ball-velocity',
      size: BALL_COUNT * 16,
      usage,
    });
    const uniforms = gpu.createUniformBuffer('bouncing-ball-params', 32);
    const bindGroup = ctx.device.createBindGroup({
      label: 'bouncing-ball-bind-group',
      layout,
      entries: [
        { binding: 0, resource: { buffer: posRadius } },
        { binding: 1, resource: { buffer: velocity } },
        { binding: 2, resource: { buffer: uniforms.buffer } },
      ],
    });
    const renderable: Renderable = {
      label: 'bouncing-ball',
      mesh: ctx.meshes.sphere,
      material: { kind: 'lit', color: [0.75, 0.12, 0.08], roughness: 0.35 },
      instances: {
        kind: 'storage',
        buffer: posRadius,
        count: BALL_COUNT,
        layout: 'posRadius',
        bounds: bouncingBallBounds(params),
      },
      castsShadow: true,
      receivesShadow: true,
    };
    this.res = {
      ctx,
      posRadius,
      velocity,
      uniforms,
      stepPipeline,
      projectPipeline,
      bindGroup,
      renderable,
    };
    this.setParams(params);
    this.reset();
  }

  setParams(params: BouncingBallParams): void {
    this.params = params;
    const { res } = this;
    if (!res) return;
    this.writeUniforms(res, params);
    if (res.renderable.instances.kind === 'storage') {
      res.renderable.instances = {
        ...res.renderable.instances,
        bounds: bouncingBallBounds(params),
      };
    }
    // Re-apply radius and ground contact now, so edits show even while paused.
    const encoder = res.ctx.device.createCommandEncoder({ label: 'bouncing-ball-project' });
    const pass = encoder.beginComputePass({ label: 'bouncing-ball-project' });
    this.dispatch(pass, res.projectPipeline, res);
    pass.end();
    res.ctx.device.queue.submit([encoder.finish()]);
  }

  reset(): void {
    const { res, params } = this;
    if (!res || !params) return;
    const posRadius = new Float32Array(BALL_COUNT * 4);
    const velocity = new Float32Array(BALL_COUNT * 4);
    for (let i = 0; i < BALL_COUNT; i++) {
      posRadius.set([0, Math.max(params.dropHeight, params.radius), 0, params.radius], i * 4);
      velocity.set([params.initialVelocityX, 0, 0, 0], i * 4);
    }
    res.ctx.gpu.writeBuffer(res.posRadius, posRadius);
    res.ctx.gpu.writeBuffer(res.velocity, velocity);
  }

  step(dt: number, pass: GPUComputePassEncoder): void {
    const { res, params } = this;
    if (!res || !params) return;
    if (dt !== this.dt) {
      this.dt = dt;
      this.writeUniforms(res, params);
    }
    this.dispatch(pass, res.stepPipeline, res);
  }

  renderables(): readonly Renderable[] {
    return this.res ? [this.res.renderable] : [];
  }

  sceneOverrides() {
    return { camera: { target: { x: 2, y: 1.5, z: 0 }, distance: 14 } };
  }

  dispose(): void {
    const { res } = this;
    if (!res) return;
    res.ctx.gpu.destroy(res.posRadius);
    res.ctx.gpu.destroy(res.velocity);
    res.uniforms.destroy();
    this.res = null;
  }

  private dispatch(pass: GPUComputePassEncoder, pipeline: GPUComputePipeline, res: Resources) {
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, res.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(BALL_COUNT / WORKGROUP_SIZE));
  }

  private writeUniforms(res: Resources, params: BouncingBallParams): void {
    res.uniforms.f32.set([params.gravity, params.restitution, params.drag, this.dt, params.radius]);
    res.uniforms.u32[5] = BALL_COUNT;
    res.uniforms.upload();
  }
}

export function createBouncingBallSim(): Simulation<BouncingBallParams> {
  return new BouncingBallSim();
}
