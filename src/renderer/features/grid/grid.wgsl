const GROUND_ALBEDO = vec3f(0.32, 0.32, 0.30);
const MINOR_ALBEDO = vec3f(0.17, 0.17, 0.16);
const MAJOR_ALBEDO = vec3f(0.07, 0.07, 0.07);

struct GridOut {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
}

/** Anti-aliased line coverage for a grid of `spacing`, `widthPx` wide; fades once cells shrink to pixels. */
fn gridLines(p: vec2f, spacing: f32, widthPx: f32) -> f32 {
  let coord = p / spacing;
  let deriv = max(fwidth(coord), vec2f(1e-6));
  let dist = abs(fract(coord - 0.5) - 0.5) / deriv;
  let coverage = 1.0 - min(min(dist.x, dist.y) / widthPx, 1.0);
  let lod = 1.0 - smoothstep(0.15, 0.5, max(deriv.x, deriv.y));
  return coverage * lod;
}

@fragment
fn fs_grid(in: FullscreenOut) -> GridOut {
  // Ray through this pixel (reversed-Z: near plane at depth 1).
  let nearH = frame.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  let midH = frame.invViewProj * vec4f(in.ndc, 0.5, 1.0);
  let origin = frame.cameraPos;
  let dir = normalize(midH.xyz / midH.w - nearH.xyz / nearH.w);
  let t = -origin.y / dir.y;
  let hit = origin + dir * abs(t);

  // Derivatives are taken before any discard to stay in uniform control flow.
  let cell = frame.grid.x;
  let minor = gridLines(hit.xz, cell, 1.0);
  let major = gridLines(hit.xz, cell * frame.grid.y, 1.5);

  if (!(t > 0.0)) {
    discard;
  }

  let dist = length(hit - origin);
  let lineFade = 1.0 - smoothstep(frame.grid.z * 0.4, frame.grid.z, dist);
  var albedo = mix(GROUND_ALBEDO, MINOR_ALBEDO, minor * lineFade);
  albedo = mix(albedo, MAJOR_ALBEDO, major * lineFade);

  let up = vec3f(0.0, 1.0, 0.0);
  let lit = shadeLit(albedo, 0.9, up, hit, shadowFactor(hit, up));
  // Aerial haze so the ground meets the sky at the horizon.
  let haze = 1.0 - exp(-dist / (frame.grid.z * 2.5));
  let color = mix(lit, skyRadiance(dir), haze);

  let clip = frame.viewProj * vec4f(hit, 1.0);
  var out: GridOut;
  out.color = vec4f(color, 1.0);
  out.depth = clip.z / clip.w;
  return out;
}
