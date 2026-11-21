export type Vec3 = readonly [number, number, number];

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface MeshHandle {
  label: string;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  bounds: Bounds;
}

export interface MeshLibrary {
  /** Unit cube centred on the origin (side 1 m). */
  cube: MeshHandle;
  /** UV sphere centred on the origin (radius 1 m). */
  sphere: MeshHandle;
}

export interface LitMaterial {
  kind: 'lit';
  color: Vec3;
  roughness: number;
}

export type InstanceSource =
  | { kind: 'static'; transforms: Float32Array }
  | {
      kind: 'storage';
      buffer: GPUBuffer;
      count: number;
      layout: 'posRadius';
      /** Conservative world bounds of every instance; used to fit the shadow map. */
      bounds: Bounds;
    };

/**
 * Something the renderer draws. Return the same object each frame for as long as it
 * should exist: GPU resources are cached per object and freed once it stops appearing.
 */
export interface Renderable {
  label: string;
  mesh: MeshHandle;
  material: LitMaterial;
  instances: InstanceSource;
  castsShadow: boolean;
  receivesShadow: boolean;
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
}
