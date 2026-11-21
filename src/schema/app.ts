import { z } from 'zod';
import { simIdList, type SimId } from './sims';

export const appParamsSchema = z.object({
  sim: z
    .enum(simIdList as [SimId, ...SimId[]])
    .default('hello')
    .meta({ label: 'Simulation' }),
  paused: z.boolean().default(false).meta({ label: 'Paused' }),
  timeScale: z.number().min(0).max(4).default(1).meta({ label: 'Time scale', step: 0.05 }),
  fixedTimestep: z
    .number()
    .min(1 / 1000)
    .max(1 / 30)
    .default(1 / 60)
    .meta({ label: 'Fixed timestep (s)', step: 0.001 }),
  substeps: z.number().int().min(1).max(32).default(4).meta({ label: 'Substeps', step: 1 }),
  perfOverlay: z.boolean().default(false).meta({ label: 'Performance overlay' }),
});
