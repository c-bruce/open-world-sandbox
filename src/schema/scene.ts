import { z } from 'zod';

const sun = z.object({
  azimuth: z.number().min(0).max(360).default(300).meta({ label: 'Sun azimuth (°)', step: 1 }),
  elevation: z.number().min(-5).max(90).default(10).meta({ label: 'Sun elevation (°)', step: 0.5 }),
  intensity: z.number().min(0).max(20).default(4).meta({ label: 'Sun intensity', step: 0.1 }),
});

const sky = z.object({
  turbidity: z.number().min(1.7).max(10).default(2.5).meta({ label: 'Sky turbidity', step: 0.1 }),
});

const grid = z.object({
  cellSize: z.number().min(0.1).max(10).default(1).meta({ label: 'Cell size (m)', step: 0.1 }),
  majorInterval: z
    .number()
    .int()
    .min(2)
    .max(20)
    .default(10)
    .meta({ label: 'Major line every (cells)', step: 1 }),
  fadeDistance: z
    .number()
    .min(10)
    .max(1000)
    .default(150)
    .meta({ label: 'Fade distance (m)', step: 10 }),
});

const camera = z.object({
  target: z
    .object({ x: z.number().default(0), y: z.number().default(0.5), z: z.number().default(0) })
    .prefault({})
    .meta({ label: 'Target (m)' }),
  distance: z.number().min(1).max(200).default(12).meta({ label: 'Distance (m)', step: 0.5 }),
  yaw: z.number().min(-180).max(180).default(35).meta({ label: 'Yaw (°)', step: 1 }),
  pitch: z.number().min(1).max(89).default(12).meta({ label: 'Pitch (°)', step: 1 }),
  fov: z.number().min(20).max(120).default(50).meta({ label: 'Field of view (°)', step: 1 }),
});

export const sceneParamsSchema = z.object({
  sun: sun.prefault({}).meta({ label: 'Sun' }),
  sky: sky.prefault({}).meta({ label: 'Sky' }),
  exposure: z.number().min(-6).max(6).default(0).meta({ label: 'Exposure (EV)', step: 0.1 }),
  grid: grid.prefault({}).meta({ label: 'Grid' }),
  camera: camera.prefault({}).meta({ label: 'Camera' }),
});
