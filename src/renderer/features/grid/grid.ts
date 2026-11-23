import type { GpuApi } from '../../../gpu';
import { DEPTH_FORMAT, HDR_FORMAT, type Layouts } from '../../layouts';
import { wgsl } from '../../shader-chunks';
import gridWgsl from './grid.wgsl?raw';

/** Infinite ground plane at y = 0, ray-cast per pixel; writes real depth and receives shadows. */
export async function createGridPipeline(
  api: GpuApi,
  layouts: Layouts,
): Promise<GPURenderPipeline> {
  const module = await api.createShaderModule(
    'grid',
    wgsl.frame + wgsl.lighting + wgsl.fullscreen + gridWgsl,
  );
  return api.createRenderPipeline({
    label: 'grid',
    layout: api.device.createPipelineLayout({
      label: 'grid-layout',
      bindGroupLayouts: [layouts.frame],
    }),
    vertex: { module, entryPoint: 'vs_fullscreen' },
    fragment: { module, entryPoint: 'fs_grid', targets: [{ format: HDR_FORMAT }] },
    depthStencil: { format: DEPTH_FORMAT, depthCompare: 'greater', depthWriteEnabled: true },
  });
}
