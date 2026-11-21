import type { GpuApi } from '../../../gpu';
import { FRAME_UNIFORM_BYTES } from '../../frame';
import { wgsl } from '../../shader-chunks';
import tonemapWgsl from './tonemap.wgsl?raw';

/** Final pass: exposure, AgX, sRGB encode from the HDR target to the canvas. */
export class TonemapFeature {
  readonly pipeline: GPURenderPipeline;
  readonly layout: GPUBindGroupLayout;

  private constructor(pipeline: GPURenderPipeline, layout: GPUBindGroupLayout) {
    this.pipeline = pipeline;
    this.layout = layout;
  }

  static async create(api: GpuApi, canvasFormat: GPUTextureFormat): Promise<TonemapFeature> {
    const layout = api.device.createBindGroupLayout({
      label: 'tonemap-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform', minBindingSize: FRAME_UNIFORM_BYTES },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'unfilterable-float' },
        },
      ],
    });
    const module = await api.createShaderModule(
      'tonemap',
      wgsl.frame + wgsl.fullscreen + tonemapWgsl,
    );
    const pipeline = await api.createRenderPipeline({
      label: 'tonemap',
      layout: api.device.createPipelineLayout({
        label: 'tonemap-layout',
        bindGroupLayouts: [layout],
      }),
      vertex: { module, entryPoint: 'vs_fullscreen' },
      fragment: {
        module,
        entryPoint: 'fs_tonemap',
        targets: [{ format: canvasFormat }],
        constants: { ENCODE_SRGB: canvasFormat.endsWith('-srgb') ? 0 : 1 },
      },
    });
    return new TonemapFeature(pipeline, layout);
  }

  bindGroup(device: GPUDevice, frameBuffer: GPUBuffer, hdrView: GPUTextureView): GPUBindGroup {
    return device.createBindGroup({
      label: 'tonemap-bind-group',
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: hdrView },
      ],
    });
  }
}
