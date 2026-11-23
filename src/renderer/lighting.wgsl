@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

const SHADOW_TAPS = array<vec2f, 16>(
  vec2f(-0.94201624, -0.39906216), vec2f(0.94558609, -0.76890725),
  vec2f(-0.09418410, -0.92938870), vec2f(0.34495938, 0.29387760),
  vec2f(-0.91588581, 0.45771432), vec2f(-0.81544232, -0.87912464),
  vec2f(-0.38277543, 0.27676845), vec2f(0.97484398, 0.75648379),
  vec2f(0.44323325, -0.97511554), vec2f(0.53742981, -0.47373420),
  vec2f(-0.26496911, -0.41893023), vec2f(0.79197514, 0.19090188),
  vec2f(-0.24188840, 0.99706507), vec2f(-0.81409955, 0.91437590),
  vec2f(0.19984126, 0.78641367), vec2f(0.14383161, -0.14100790),
);
const SHADOW_RADIUS_TEXELS = 2.5;

/** 1 = fully lit, 0 = fully shadowed. Reversed-Z: larger depth is closer to the sun. */
fn shadowFactor(worldPos: vec3f, normal: vec3f) -> f32 {
  let biased = worldPos + normal * frame.shadowParams.y;
  let clip = frame.lightViewProj * vec4f(biased, 1.0);
  let ndc = clip.xyz / clip.w;
  let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) {
    return 1.0;
  }
  // Beyond the far plane is behind every caster (shadowed); in front of near is lit.
  let depth = clamp(ndc.z, 0.0, 1.0);
  let texel = frame.shadowParams.x * SHADOW_RADIUS_TEXELS;
  var taps = SHADOW_TAPS;
  var lit = 0.0;
  for (var i = 0; i < 16; i++) {
    lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv + taps[i] * texel, depth);
  }
  return lit / 16.0;
}

/** Sky light on a surface with normal `n`: the integrated dome above, ground bounce below. */
fn skyAmbient(n: vec3f) -> vec3f {
  return mix(frame.groundAmbient, frame.skyAmbient, n.y * 0.5 + 0.5);
}

/** Lambert diffuse + normalised Blinn-Phong specular under the sun, plus sky ambient. */
fn shadeLit(albedo: vec3f, roughness: f32, n: vec3f, worldPos: vec3f, shadow: f32) -> vec3f {
  let l = frame.sunDir;
  let v = normalize(frame.cameraPos - worldPos);
  let h = normalize(l + v);
  let ndl = max(dot(n, l), 0.0);
  let shininess = exp2(10.0 * (1.0 - roughness) + 1.0);
  let spec = 0.04 * (shininess + 8.0) / (8.0 * PI) * pow(max(dot(n, h), 0.0), shininess);
  let direct = frame.sunRadiance * ndl * shadow;
  return albedo * (direct + skyAmbient(n)) + direct * spec;
}
