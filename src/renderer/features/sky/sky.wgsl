const SUN_ANGULAR_RADIUS = 0.0095;
const SUN_DISC_BOOST = 40.0;

@fragment
fn fs_sky(in: FullscreenOut) -> @location(0) vec4f {
  let nearH = frame.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  let midH = frame.invViewProj * vec4f(in.ndc, 0.5, 1.0);
  let dir = normalize(midH.xyz / midH.w - nearH.xyz / nearH.w);

  var color = skyRadiance(dir);
  let cosToSun = dot(dir, frame.sunDir);
  let disc = smoothstep(cos(SUN_ANGULAR_RADIUS * 1.15), cos(SUN_ANGULAR_RADIUS), cosToSun);
  color += disc * frame.sunRadiance * SUN_DISC_BOOST * step(0.0, dir.y);
  return vec4f(color, 1.0);
}
