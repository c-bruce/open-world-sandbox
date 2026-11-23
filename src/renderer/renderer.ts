import type { CanvasSize, GpuApi, GpuContext, GpuProfiler, UniformBuffer } from '../gpu';
import type { SceneParams } from '../schema';
import { projectionMatrix, sunDirection, viewMatrix, orbitEye } from './camera';
import {
  createGridPipeline,
  createSkyPipeline,
  MeshFeature,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
  ShadowFeature,
  TonemapFeature,
} from './features';
import { FRAME_UNIFORM_BYTES, writeFrameUniforms } from './frame';
import { createLayouts, DEPTH_FORMAT, HDR_FORMAT, type Layouts } from './layouts';
import { createMeshLibrary, destroyMesh } from './meshes';
import type { MeshLibrary, Renderable, RenderStats } from './types';

/** Everything one frame of rendering depends on. */
export interface RenderInput {
  scene: SceneParams;
  renderables: readonly Renderable[];
  /** Simulation time in seconds. */
  time: number;
}

interface SizedTargets {
  hdr: GPUTexture;
  hdrView: GPUTextureView;
  depth: GPUTexture;
  depthView: GPUTextureView;
  tonemapBindGroup: GPUBindGroup;
}

/** Owns every render pass: shadow → main HDR (meshes, grid, sky) → tone map. */
export class Renderer {
  readonly meshes: MeshLibrary;
  private stats: RenderStats = { drawCalls: 0, triangles: 0 };
  private targets: SizedTargets;
  private size: CanvasSize;
  private readonly gpu: GpuContext;
  private readonly api: GpuApi;
  private readonly profiler: GpuProfiler;
  private readonly frameUniforms: UniformBuffer;
  private readonly frameBindGroup: GPUBindGroup;
  private readonly shadowFrameBindGroup: GPUBindGroup;
  private readonly shadow: ShadowFeature;
  private readonly mesh: MeshFeature;
  private readonly grid: GPURenderPipeline;
  private readonly sky: GPURenderPipeline;
  private readonly tonemap: TonemapFeature;

  private constructor(
    deps: { gpu: GpuContext; api: GpuApi; profiler: GpuProfiler; size: CanvasSize },
    features: {
      layouts: Layouts;
      mesh: MeshFeature;
      grid: GPURenderPipeline;
      sky: GPURenderPipeline;
      tonemap: TonemapFeature;
    },
  ) {
    this.gpu = deps.gpu;
    this.api = deps.api;
    this.profiler = deps.profiler;
    this.size = deps.size;
    this.mesh = features.mesh;
    this.grid = features.grid;
    this.sky = features.sky;
    this.tonemap = features.tonemap;
    this.meshes = createMeshLibrary(this.api);
    this.shadow = new ShadowFeature(this.api);
    this.frameUniforms = this.api.createUniformBuffer('frame-uniforms', FRAME_UNIFORM_BYTES);

    const { device } = this.api;
    const { layouts } = features;
    this.frameBindGroup = device.createBindGroup({
      label: 'frame-bind-group',
      layout: layouts.frame,
      entries: [
        { binding: 0, resource: { buffer: this.frameUniforms.buffer } },
        { binding: 1, resource: this.shadow.view },
        { binding: 2, resource: this.shadow.sampler },
      ],
    });
    this.shadowFrameBindGroup = device.createBindGroup({
      label: 'shadow-frame-bind-group',
      layout: layouts.shadowFrame,
      entries: [{ binding: 0, resource: { buffer: this.frameUniforms.buffer } }],
    });
    this.targets = this.createTargets(deps.size);
  }

  /** Compiles every pipeline in parallel; call `resize` afterwards if the canvas may have changed. */
  static async create(
    gpu: GpuContext,
    api: GpuApi,
    profiler: GpuProfiler,
    size: CanvasSize,
  ): Promise<Renderer> {
    const layouts = createLayouts(api.device);
    const [mesh, grid, sky, tonemap] = await Promise.all([
      MeshFeature.create(api, layouts),
      createGridPipeline(api, layouts),
      createSkyPipeline(api, layouts),
      TonemapFeature.create(api, gpu.format),
    ]);
    return new Renderer({ gpu, api, profiler, size }, { layouts, mesh, grid, sky, tonemap });
  }

  /** Recreate the size-dependent HDR and depth targets (no-op if unchanged). */
  resize(size: CanvasSize): void {
    if (size.width === this.size.width && size.height === this.size.height) return;
    this.destroyTargets();
    this.size = size;
    this.targets = this.createTargets(size);
  }

  /** Records the shadow, main and tone-map passes into `encoder`. */
  encode(encoder: GPUCommandEncoder, { scene, renderables, time }: RenderInput): void {
    const { width, height } = this.size;
    const sunDir = sunDirection(scene.sun.azimuth, scene.sun.elevation);
    const casterBounds = this.mesh.prepare(renderables);
    writeFrameUniforms(this.frameUniforms.f32, {
      view: viewMatrix(scene.camera),
      proj: projectionMatrix(scene.camera.fov, width / height),
      lightViewProj: this.shadow.lightViewProj(sunDir, casterBounds),
      cameraPos: orbitEye(scene.camera),
      sunDir,
      time,
      scene,
      viewport: { width, height },
      shadowMapSize: SHADOW_MAP_SIZE,
      shadowNormalBias: SHADOW_NORMAL_BIAS,
    });
    this.frameUniforms.upload();

    const stats: RenderStats = { drawCalls: 0, triangles: 0 };

    const shadowPass = encoder.beginRenderPass(
      this.shadow.passDescriptor(this.profiler.timestampWrites('shadow')),
    );
    shadowPass.setBindGroup(0, this.shadowFrameBindGroup);
    this.mesh.drawShadow(shadowPass, renderables, stats);
    shadowPass.end();

    const mainPass = encoder.beginRenderPass({
      label: 'main',
      colorAttachments: [
        {
          view: this.targets.hdrView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.targets.depthView,
        depthClearValue: 0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
      timestampWrites: this.profiler.timestampWrites('main'),
    });
    mainPass.setBindGroup(0, this.frameBindGroup);
    this.mesh.drawMain(mainPass, renderables, stats);
    for (const pipeline of [this.grid, this.sky]) {
      mainPass.setPipeline(pipeline);
      mainPass.draw(3);
      stats.drawCalls++;
      stats.triangles++;
    }
    mainPass.end();

    const tonemapPass = encoder.beginRenderPass({
      label: 'tonemap',
      colorAttachments: [
        {
          view: this.gpu.canvasContext.getCurrentTexture().createView({ label: 'canvas-view' }),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      timestampWrites: this.profiler.timestampWrites('tonemap'),
    });
    tonemapPass.setPipeline(this.tonemap.pipeline);
    tonemapPass.setBindGroup(0, this.targets.tonemapBindGroup);
    tonemapPass.draw(3);
    stats.drawCalls++;
    stats.triangles++;
    tonemapPass.end();

    this.stats = stats;
  }

  /** Draw calls and triangles recorded by the last `encode`. */
  lastStats(): RenderStats {
    return this.stats;
  }

  destroy(): void {
    this.mesh.destroy();
    this.shadow.destroy();
    this.destroyTargets();
    this.frameUniforms.destroy();
    destroyMesh(this.api, this.meshes.cube);
    destroyMesh(this.api, this.meshes.sphere);
  }

  private createTargets({ width, height }: CanvasSize): SizedTargets {
    const hdr = this.api.createTexture({
      label: 'hdr',
      size: [width, height],
      format: HDR_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const depth = this.api.createTexture({
      label: 'depth',
      size: [width, height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const hdrView = hdr.createView({ label: 'hdr-view' });
    return {
      hdr,
      hdrView,
      depth,
      depthView: depth.createView({ label: 'depth-view' }),
      tonemapBindGroup: this.tonemap.bindGroup(this.api.device, this.frameUniforms.buffer, hdrView),
    };
  }

  private destroyTargets(): void {
    this.api.destroy(this.targets.hdr);
    this.api.destroy(this.targets.depth);
  }
}
