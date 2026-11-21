import type { GpuApi, UniformBuffer } from '../../../gpu';
import { transformBounds } from '../../bounds';
import { DEPTH_FORMAT, HDR_FORMAT, type Layouts } from '../../layouts';
import { VERTEX_FLOATS } from '../../meshes';
import { wgsl } from '../../shader-chunks';
import type { Bounds, Renderable, RenderStats } from '../../types';
import meshWgsl from './mesh.wgsl?raw';

const MATERIAL_BYTES = 32;

interface Entry {
  instanceBuffer: GPUBuffer;
  ownsInstanceBuffer: boolean;
  material: UniformBuffer;
  bindGroup: GPUBindGroup;
  count: number;
  bounds: Bounds | null;
  lastFrame: number;
}

interface Pipelines {
  main: GPURenderPipeline;
  shadow: GPURenderPipeline;
}

const vertexLayout: GPUVertexBufferLayout = {
  arrayStride: VERTEX_FLOATS * 4,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
  ],
};

/** Lit meshes in the main pass and depth-only casters in the shadow pass. */
export class MeshFeature {
  private readonly entries = new Map<Renderable, Entry>();
  private frameIndex = 0;
  private readonly api: GpuApi;
  private readonly layouts: Layouts;
  private readonly pipelines: Record<'static' | 'storage', Pipelines>;

  private constructor(
    api: GpuApi,
    layouts: Layouts,
    pipelines: Record<'static' | 'storage', Pipelines>,
  ) {
    this.api = api;
    this.layouts = layouts;
    this.pipelines = pipelines;
  }

  static async create(api: GpuApi, layouts: Layouts): Promise<MeshFeature> {
    const module = await api.createShaderModule('mesh', wgsl.frame + wgsl.lighting + meshWgsl);
    const mainLayout = api.device.createPipelineLayout({
      label: 'mesh-layout',
      bindGroupLayouts: [layouts.frame, layouts.instance],
    });
    const shadowLayout = api.device.createPipelineLayout({
      label: 'mesh-shadow-layout',
      bindGroupLayouts: [layouts.shadowFrame, layouts.instance],
    });

    const main = (label: string, entryPoint: string) =>
      api.createRenderPipeline({
        label,
        layout: mainLayout,
        vertex: { module, entryPoint, buffers: [vertexLayout] },
        fragment: { module, entryPoint: 'fs_lit', targets: [{ format: HDR_FORMAT }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: { format: DEPTH_FORMAT, depthCompare: 'greater', depthWriteEnabled: true },
      });
    // Reversed-Z: negative bias pushes stored depth away from the sun to avoid acne.
    const shadow = (label: string, entryPoint: string) =>
      api.createRenderPipeline({
        label,
        layout: shadowLayout,
        vertex: { module, entryPoint, buffers: [vertexLayout] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: {
          format: DEPTH_FORMAT,
          depthCompare: 'greater',
          depthWriteEnabled: true,
          depthBias: -4,
          depthBiasSlopeScale: -2,
        },
      });

    const [mainStatic, mainStorage, shadowStatic, shadowStorage] = await Promise.all([
      main('mesh-static', 'vs_static'),
      main('mesh-pos-radius', 'vs_pos_radius'),
      shadow('mesh-shadow-static', 'vs_shadow_static'),
      shadow('mesh-shadow-pos-radius', 'vs_shadow_pos_radius'),
    ]);
    return new MeshFeature(api, layouts, {
      static: { main: mainStatic, shadow: shadowStatic },
      storage: { main: mainStorage, shadow: shadowStorage },
    });
  }

  /**
   * Syncs cached GPU resources with this frame's renderables, frees those no longer present,
   * and returns world bounds of shadow casters.
   */
  prepare(renderables: readonly Renderable[]): Bounds[] {
    this.frameIndex++;
    const casterBounds: Bounds[] = [];
    for (const renderable of renderables) {
      const entry = this.entryFor(renderable);
      entry.lastFrame = this.frameIndex;
      const { color, roughness } = renderable.material;
      entry.material.f32.set([...color, roughness]);
      entry.material.u32[4] = renderable.receivesShadow ? 1 : 0;
      entry.material.upload();
      if (renderable.castsShadow && entry.bounds) casterBounds.push(entry.bounds);
    }
    for (const [renderable, entry] of this.entries) {
      if (entry.lastFrame !== this.frameIndex) this.release(renderable, entry);
    }
    return casterBounds;
  }

  drawShadow(pass: GPURenderPassEncoder, renderables: readonly Renderable[], stats: RenderStats) {
    for (const renderable of renderables) {
      if (renderable.castsShadow) this.draw(pass, renderable, 'shadow', stats);
    }
  }

  drawMain(pass: GPURenderPassEncoder, renderables: readonly Renderable[], stats: RenderStats) {
    for (const renderable of renderables) this.draw(pass, renderable, 'main', stats);
  }

  destroy(): void {
    for (const [renderable, entry] of this.entries) this.release(renderable, entry);
  }

  private draw(
    pass: GPURenderPassEncoder,
    renderable: Renderable,
    kind: keyof Pipelines,
    stats: RenderStats,
  ): void {
    const entry = this.entries.get(renderable);
    if (!entry || entry.count === 0) return;
    const { mesh } = renderable;
    pass.setPipeline(this.pipelines[renderable.instances.kind][kind]);
    pass.setBindGroup(1, entry.bindGroup);
    pass.setVertexBuffer(0, mesh.vertexBuffer);
    pass.setIndexBuffer(mesh.indexBuffer, 'uint32');
    pass.drawIndexed(mesh.indexCount, entry.count);
    stats.drawCalls++;
    stats.triangles += (mesh.indexCount / 3) * entry.count;
  }

  private entryFor(renderable: Renderable): Entry {
    const source = renderable.instances;
    const existing = this.entries.get(renderable);
    if (existing) {
      if (source.kind === 'static' || existing.instanceBuffer === source.buffer) {
        if (source.kind === 'storage') {
          existing.count = source.count;
          existing.bounds = source.bounds;
        }
        return existing;
      }
      this.release(renderable, existing);
    }

    const { api } = this;
    const material = api.createUniformBuffer(`${renderable.label}-material`, MATERIAL_BYTES);
    const isStatic = source.kind === 'static';
    const instanceBuffer = isStatic
      ? api.createBufferWithData(
          `${renderable.label}-instances`,
          new Float32Array(source.transforms),
          GPUBufferUsage.STORAGE,
        )
      : source.buffer;
    const entry: Entry = {
      instanceBuffer,
      ownsInstanceBuffer: isStatic,
      material,
      bindGroup: api.device.createBindGroup({
        label: `${renderable.label}-instance-bind-group`,
        layout: this.layouts.instance,
        entries: [
          { binding: 0, resource: { buffer: instanceBuffer } },
          { binding: 1, resource: { buffer: material.buffer } },
        ],
      }),
      count: isStatic ? Math.floor(source.transforms.length / 16) : source.count,
      bounds: isStatic ? transformBounds(renderable.mesh.bounds, source.transforms) : source.bounds,
      lastFrame: 0,
    };
    this.entries.set(renderable, entry);
    return entry;
  }

  private release(renderable: Renderable, entry: Entry): void {
    entry.material.destroy();
    if (entry.ownsInstanceBuffer) this.api.destroy(entry.instanceBuffer);
    this.entries.delete(renderable);
  }
}
