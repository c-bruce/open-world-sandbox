import type { GpuApi } from '../../../gpu';
import { DEPTH_FORMAT, HDR_FORMAT, type Layouts } from '../../layouts';
import { wgsl } from '../../shader-chunks';
import skyWgsl from './sky.wgsl?raw';

/** Preetham sky + sun disc; drawn last at the far plane so covered pixels are skipped. */
export async function createSkyPipeline(api: GpuApi, layouts: Layouts): Promise<GPURenderPipeline> {
  const module = await api.createShaderModule(
    'sky',
    wgsl.frame + wgsl.atmosphere + wgsl.fullscreen + skyWgsl,
  );
  return api.createRenderPipeline({
    label: 'sky',
    layout: api.device.createPipelineLayout({
      label: 'sky-layout',
      bindGroupLayouts: [layouts.frame],
    }),
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_sky', targets: [{ format: HDR_FORMAT }] },
    depthStencil: { format: DEPTH_FORMAT, depthCompare: 'equal', depthWriteEnabled: false },
  });
}
