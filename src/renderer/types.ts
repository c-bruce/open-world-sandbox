export type Vec3 = readonly [number, number, number];

/** Axis-aligned bounding box in metres. */
export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** Indexed triangle mesh on the GPU: interleaved position + normal, uint32 indices. */
export interface MeshHandle {
  label: string;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  /** Local-space bounds, before instance transforms. */
  bounds: Bounds;
}

/** Shared meshes owned by the renderer; sims reference them and never destroy them. */
export interface MeshLibrary {
  /** Unit cube centred on the origin (side 1 m). */
  cube: MeshHandle;
  /** UV sphere centred on the origin (radius 1 m). */
  sphere: MeshHandle;
}

/** Opaque surface lit by the sun and sky. */
export interface LitMaterial {
  kind: 'lit';
  /** Linear RGB albedo, 0..1 (not sRGB). */
  color: Vec3;
  /** 0 (glossy) .. 1 (matte). */
  roughness: number;
}

/** Where per-instance transforms come from. */
export type InstanceSource =
  /** CPU transforms, uploaded once: 16 floats (column-major mat4) per instance. */
  | { kind: 'static'; transforms: Float32Array }
  /** A sim-owned STORAGE buffer, read directly by the vertex shader with no copy. */
  | {
      kind: 'storage';
      buffer: GPUBuffer;
      count: number;
      /** `array<vec4f>`: xyz = centre, w = uniform scale (radius for the unit sphere). */
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

/** Counts from the last `Renderer.encode`, shown in the performance overlay. */
export interface RenderStats {
  drawCalls: number;
  triangles: number;
}
