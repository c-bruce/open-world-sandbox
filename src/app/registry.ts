import type { SimRegistry } from '../engine';
import { createBouncingBallSim } from '../sims/bouncing-ball';

export const registry = {
  'bouncing-ball': createBouncingBallSim,
} satisfies SimRegistry;
