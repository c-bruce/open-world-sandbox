import { z } from 'zod';

export const bouncingBallParamsSchema = z.object({
  radius: z.number().min(0.05).max(2).default(0.5).meta({ label: 'Radius (m)', step: 0.05 }),
  dropHeight: z.number().min(0.5).max(50).default(5).meta({ label: 'Drop height (m)', step: 0.5 }),
  gravity: z.number().min(0).max(30).default(9.81).meta({ label: 'Gravity (m/s²)', step: 0.01 }),
  restitution: z.number().min(0).max(1).default(0.7).meta({ label: 'Restitution', step: 0.01 }),
  drag: z.number().min(0).max(2).default(0.05).meta({ label: 'Linear drag (1/s)', step: 0.01 }),
  initialVelocityX: z
    .number()
    .min(-10)
    .max(10)
    .default(1)
    .meta({ label: 'Initial horizontal velocity (m/s)', step: 0.1 }),
});
