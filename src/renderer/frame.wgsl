struct Frame {
  view: mat4x4f,
  proj: mat4x4f,
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  lightViewProj: mat4x4f,
  cameraPos: vec3f,
  time: f32,
  sunDir: vec3f,
  sunIntensity: f32,
  sunRadiance: vec3f,
  turbidity: f32,
  skyAmbient: vec3f,
  exposure: f32,
  groundAmbient: vec3f,
  _pad0: f32,
  grid: vec4f, // cell size, major interval, fade distance, -
  viewport: vec4f, // width, height, 1/width, 1/height
  shadowParams: vec4f, // texel size, normal bias, -, -
}

@group(0) @binding(0) var<uniform> frame: Frame;
