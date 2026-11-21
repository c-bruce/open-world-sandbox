struct Material {
  color: vec3f,
  roughness: f32,
  receivesShadow: u32,
}

// Static: 4 vec4 columns per instance (mat4). posRadius: one vec4 (xyz, radius) per instance.
@group(1) @binding(0) var<storage, read> instanceData: array<vec4f>;
@group(1) @binding(1) var<uniform> material: Material;

struct VertexIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
}

fn staticModel(instance: u32) -> mat4x4f {
  let i = instance * 4u;
  return mat4x4f(instanceData[i], instanceData[i + 1u], instanceData[i + 2u], instanceData[i + 3u]);
}

fn posRadiusModel(instance: u32) -> mat4x4f {
  let pr = instanceData[instance];
  return mat4x4f(
    vec4f(pr.w, 0.0, 0.0, 0.0),
    vec4f(0.0, pr.w, 0.0, 0.0),
    vec4f(0.0, 0.0, pr.w, 0.0),
    vec4f(pr.xyz, 1.0),
  );
}

// Models use uniform scale only, so the upper 3x3 transforms normals correctly once renormalised.
fn litVertex(v: VertexIn, model: mat4x4f) -> VertexOut {
  let world = model * vec4f(v.position, 1.0);
  var out: VertexOut;
  out.position = frame.viewProj * world;
  out.worldPos = world.xyz;
  out.normal = (model * vec4f(v.normal, 0.0)).xyz;
  return out;
}

@vertex
fn vs_static(v: VertexIn, @builtin(instance_index) instance: u32) -> VertexOut {
  return litVertex(v, staticModel(instance));
}

@vertex
fn vs_pos_radius(v: VertexIn, @builtin(instance_index) instance: u32) -> VertexOut {
  return litVertex(v, posRadiusModel(instance));
}

@vertex
fn vs_shadow_static(v: VertexIn, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f {
  return frame.lightViewProj * staticModel(instance) * vec4f(v.position, 1.0);
}

@vertex
fn vs_shadow_pos_radius(v: VertexIn, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f {
  return frame.lightViewProj * posRadiusModel(instance) * vec4f(v.position, 1.0);
}

@fragment
fn fs_lit(in: VertexOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  var shadow = 1.0;
  if (material.receivesShadow != 0u) {
    shadow = shadowFactor(in.worldPos, n);
  }
  return vec4f(shadeLit(material.color, material.roughness, n, in.worldPos, shadow), 1.0);
}
