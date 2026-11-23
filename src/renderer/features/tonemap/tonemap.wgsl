@group(0) @binding(1) var hdr: texture_2d<f32>;

// False when the canvas format is already *-srgb and the hardware encodes on store.
override ENCODE_SRGB: bool = true;

// Minimal AgX (Wrensch 2023, after Sobotka): log2 encoding + sigmoid fit, then back to linear.
const AGX_IN = mat3x3f(
  0.842479062253094, 0.0423282422610123, 0.0423756549057051,
  0.0784335999999992, 0.878468636469772, 0.0784336,
  0.0792237451477643, 0.0791661274605434, 0.879142973793104,
);
const AGX_OUT = mat3x3f(
  1.19687900512017, -0.0528968517574562, -0.0529716355144438,
  -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
  -0.0990297440797205, -0.0989611768448433, 1.15107367264116,
);
const AGX_MIN_EV = -12.47393;
const AGX_MAX_EV = 4.026069;

fn agxContrast(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx(color: vec3f) -> vec3f {
  var v = AGX_IN * max(color, vec3f(1e-10));
  v = clamp(log2(v), vec3f(AGX_MIN_EV), vec3f(AGX_MAX_EV));
  v = (v - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV);
  v = agxContrast(v);
  v = AGX_OUT * v;
  return pow(max(v, vec3f(0.0)), vec3f(2.2));
}

fn linearToSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

// Interleaved gradient noise; ±0.5 LSB dither hides banding in smooth sky gradients.
fn dither(p: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715)))) - 0.5;
}

@fragment
fn fs_tonemap(in: FullscreenOut) -> @location(0) vec4f {
  let hdrColor = textureLoad(hdr, vec2i(in.position.xy), 0).rgb * exp2(frame.exposure);
  var color = clamp(agx(hdrColor), vec3f(0.0), vec3f(1.0));
  if (ENCODE_SRGB) {
    color = linearToSrgb(color) + dither(in.position.xy) / 255.0;
  }
  return vec4f(color, 1.0);
}
