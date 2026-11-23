import type { GpuApi } from '../../gpu';
import type { MeshHandle, MeshLibrary } from '../types';
import { cubeGeometry, uvSphereGeometry, type MeshData } from './geometry';

export function uploadMesh(api: GpuApi, label: string, data: MeshData): MeshHandle {
  return {
    label,
    vertexBuffer: api.createBufferWithData(
      `${label}-vertices`,
      data.vertices,
      GPUBufferUsage.VERTEX,
    ),
    indexBuffer: api.createBufferWithData(`${label}-indices`, data.indices, GPUBufferUsage.INDEX),
    indexCount: data.indices.length,
    bounds: data.bounds,
  };
}

export function createMeshLibrary(api: GpuApi): MeshLibrary {
  return {
    cube: uploadMesh(api, 'cube', cubeGeometry()),
    sphere: uploadMesh(api, 'sphere', uvSphereGeometry()),
  };
}

export function destroyMesh(api: GpuApi, mesh: MeshHandle): void {
  api.destroy(mesh.vertexBuffer);
  api.destroy(mesh.indexBuffer);
}
