const PI = 3.14159265359;
// Maps Preetham luminance (kcd/m²) into the same scale as sun intensity; matches atmosphere.ts.
const SKY_SCALE = 0.0045;

struct Perez { a: f32, b: f32, c: f32, d: f32, e: f32 }

fn perez(cosTheta: f32, gamma: f32, cosGamma: f32, p: Perez) -> f32 {
  return (1.0 + p.a * exp(p.b / max(cosTheta, 0.01)))
    * (1.0 + p.c * exp(p.d * gamma) + p.e * cosGamma * cosGamma);
}

// Preetham is only defined for a sun above the horizon; clamp it and fade through dusk.
fn skySun() -> vec3f {
  return normalize(vec3f(frame.sunDir.x, max(frame.sunDir.y, 0.02), frame.sunDir.z));
}

/** Analytic Preetham sky radiance in linear Rec.709; below the horizon sees the horizon. CPU twin in atmosphere.ts. */
fn skyRadiance(dirIn: vec3f) -> vec3f {
  let t = frame.turbidity;
  let sun = skySun();
  let thetaS = acos(sun.y);
  let dir = normalize(vec3f(dirIn.x, max(dirIn.y, 0.0), dirIn.z));
  let cosGamma = clamp(dot(dir, sun), -1.0, 1.0);
  let gamma = acos(cosGamma);

  let pY = Perez(0.1787 * t - 1.4630, -0.3554 * t + 0.4275, -0.0227 * t + 5.3251, 0.1206 * t - 2.5771, -0.0670 * t + 0.3703);
  let px = Perez(-0.0193 * t - 0.2592, -0.0665 * t + 0.0008, -0.0004 * t + 0.2125, -0.0641 * t - 0.8989, -0.0033 * t + 0.0452);
  let py = Perez(-0.0167 * t - 0.2608, -0.0950 * t + 0.0092, -0.0079 * t + 0.2102, -0.0441 * t - 1.6537, -0.0109 * t + 0.0529);

  let chi = (4.0 / 9.0 - t / 120.0) * (PI - 2.0 * thetaS);
  let zY = (4.0453 * t - 4.9710) * tan(chi) - 0.2155 * t + 2.4192;
  let th = thetaS;
  let th2 = th * th;
  let th3 = th2 * th;
  let zx = t * t * (0.00166 * th3 - 0.00375 * th2 + 0.00209 * th)
    + t * (-0.02903 * th3 + 0.06377 * th2 - 0.03202 * th + 0.00394)
    + (0.11693 * th3 - 0.21196 * th2 + 0.06052 * th + 0.25886);
  let zy = t * t * (0.00275 * th3 - 0.00610 * th2 + 0.00317 * th)
    + t * (-0.04214 * th3 + 0.08970 * th2 - 0.04153 * th + 0.00516)
    + (0.15346 * th3 - 0.26756 * th2 + 0.06670 * th + 0.26688);

  let cosThetaS = cos(thetaS);
  let Y = zY * perez(dir.y, gamma, cosGamma, pY) / perez(1.0, thetaS, cosThetaS, pY);
  let x = zx * perez(dir.y, gamma, cosGamma, px) / perez(1.0, thetaS, cosThetaS, px);
  let y = zy * perez(dir.y, gamma, cosGamma, py) / perez(1.0, thetaS, cosThetaS, py);

  let xyz = vec3f(x / y * Y, Y, (1.0 - x - y) / y * Y);
  let xyzToRgb = mat3x3f(
    3.2406, -0.9689, 0.0557,
    -1.5372, 1.8758, -0.2040,
    -0.4986, 0.0415, 1.0570,
  );
  let dusk = smoothstep(-0.1, 0.05, frame.sunDir.y);
  return max(xyzToRgb * xyz, vec3f(0.0)) * SKY_SCALE * frame.sunIntensity * dusk;
}
