struct FullscreenOut {
  @builtin(position) position: vec4f,
  @location(0) ndc: vec2f,
}

// One oversized triangle at depth 0 (the reversed-Z far plane) covering the viewport.
@vertex
fn vs_fullscreen(@builtin(vertex_index) index: u32) -> FullscreenOut {
  let p = vec2f(f32((index << 1u) & 2u), f32(index & 2u)) * 2.0 - 1.0;
  var out: FullscreenOut;
  out.position = vec4f(p, 0.0, 1.0);
  out.ndc = p;
  return out;
}
