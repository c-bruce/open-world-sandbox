import type { Vec3 } from './types';

/** Must match SKY_SCALE in atmosphere.wgsl. */
export const SKY_SCALE = 0.0045;

type Perez = readonly [number, number, number, number, number];

function perez(cosTheta: number, gamma: number, cosGamma: number, p: Perez): number {
  return (
    (1 + p[0] * Math.exp(p[1] / Math.max(cosTheta, 0.01))) *
    (1 + p[2] * Math.exp(p[3] * gamma) + p[4] * cosGamma * cosGamma)
  );
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** CPU twin of `skyRadiance` in atmosphere.wgsl (Preetham, linear Rec.709). */
export function skyRadiance(dirIn: Vec3, sunDir: Vec3, turbidity: number, intensity: number): Vec3 {
  const t = turbidity;
  const sun = normalize([sunDir[0], Math.max(sunDir[1], 0.02), sunDir[2]]);
  const thetaS = Math.acos(sun[1]);
  const dir = normalize([dirIn[0], Math.max(dirIn[1], 0), dirIn[2]]);
  const cosGamma = Math.min(Math.max(dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2], -1), 1);
  const gamma = Math.acos(cosGamma);

  const pY: Perez = [
    0.1787 * t - 1.463,
    -0.3554 * t + 0.4275,
    -0.0227 * t + 5.3251,
    0.1206 * t - 2.5771,
    -0.067 * t + 0.3703,
  ];
  const px: Perez = [
    -0.0193 * t - 0.2592,
    -0.0665 * t + 0.0008,
    -0.0004 * t + 0.2125,
    -0.0641 * t - 0.8989,
    -0.0033 * t + 0.0452,
  ];
  const py: Perez = [
    -0.0167 * t - 0.2608,
    -0.095 * t + 0.0092,
    -0.0079 * t + 0.2102,
    -0.0441 * t - 1.6537,
    -0.0109 * t + 0.0529,
  ];

  const chi = (4 / 9 - t / 120) * (Math.PI - 2 * thetaS);
  const zY = (4.0453 * t - 4.971) * Math.tan(chi) - 0.2155 * t + 2.4192;
  const th = thetaS;
  const th2 = th * th;
  const th3 = th2 * th;
  const zx =
    t * t * (0.00166 * th3 - 0.00375 * th2 + 0.00209 * th) +
    t * (-0.02903 * th3 + 0.06377 * th2 - 0.03202 * th + 0.00394) +
    (0.11693 * th3 - 0.21196 * th2 + 0.06052 * th + 0.25886);
  const zy =
    t * t * (0.00275 * th3 - 0.0061 * th2 + 0.00317 * th) +
    t * (-0.04214 * th3 + 0.0897 * th2 - 0.04153 * th + 0.00516) +
    (0.15346 * th3 - 0.26756 * th2 + 0.0667 * th + 0.26688);

  const cosThetaS = Math.cos(thetaS);
  const Y = (zY * perez(dir[1], gamma, cosGamma, pY)) / perez(1, thetaS, cosThetaS, pY);
  const x = (zx * perez(dir[1], gamma, cosGamma, px)) / perez(1, thetaS, cosThetaS, px);
  const y = (zy * perez(dir[1], gamma, cosGamma, py)) / perez(1, thetaS, cosThetaS, py);

  const X = (x / y) * Y;
  const Z = ((1 - x - y) / y) * Y;
  const scale = SKY_SCALE * intensity * smoothstep(-0.1, 0.05, sunDir[1]);
  return [
    Math.max(3.2406 * X - 1.5372 * Y - 0.4986 * Z, 0) * scale,
    Math.max(-0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0) * scale,
    Math.max(0.0557 * X - 0.204 * Y + 1.057 * Z, 0) * scale,
  ];
}

/** Fraction of sunlight reaching the ground: Rayleigh + turbidity-scaled Mie over the air mass. */
export function sunTransmittance(sunDir: Vec3, turbidity: number): Vec3 {
  const zenithDeg = Math.min(
    90 - (Math.asin(Math.min(Math.max(sunDir[1], -1), 1)) * 180) / Math.PI,
    90,
  );
  const airMass =
    1 / (Math.cos((zenithDeg * Math.PI) / 180) + 0.50572 * Math.pow(96.07995 - zenithDeg, -1.6364));
  const mie = 0.021 * turbidity;
  const horizon = smoothstep(-0.03, 0.02, sunDir[1]);
  return [0.058, 0.135, 0.331].map(
    (rayleigh) => Math.exp(-airMass * (rayleigh + mie)) * horizon,
  ) as [number, number, number];
}

export interface Ambient {
  /** Cosine-weighted sky radiance seen by an up-facing surface. */
  sky: Vec3;
  /** Light bounced up from the ground (assumed albedo 0.3). */
  ground: Vec3;
}

const GROUND_BOUNCE_ALBEDO = 0.3;

/** Integrates the sky dome once per frame so shaders can use a constant ambient term. */
export function skyAmbient(sunDir: Vec3, turbidity: number, intensity: number): Ambient {
  const sky: [number, number, number] = [0, 0, 0];
  const rings = 8;
  const segments = 16;
  let weightSum = 0;
  for (let r = 0; r < rings; r++) {
    const theta = ((r + 0.5) / rings) * (Math.PI / 2);
    const weight = Math.cos(theta) * Math.sin(theta);
    for (let s = 0; s < segments; s++) {
      const phi = ((s + 0.5) / segments) * Math.PI * 2;
      const dir: Vec3 = [
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      ];
      const radiance = skyRadiance(dir, sunDir, turbidity, intensity);
      for (let i = 0; i < 3; i++) sky[i] = (sky[i] ?? 0) + (radiance[i] ?? 0) * weight;
      weightSum += weight;
    }
  }
  for (let i = 0; i < 3; i++) sky[i] = (sky[i] ?? 0) / weightSum;

  const sun = sunTransmittance(sunDir, turbidity);
  const sunOnGround = intensity * Math.max(sunDir[1], 0);
  const ground = sky.map((s, i) => GROUND_BOUNCE_ALBEDO * (s + (sun[i] ?? 0) * sunOnGround)) as [
    number,
    number,
    number,
  ];
  return { sky, ground };
}
