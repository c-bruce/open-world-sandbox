import type { SimRegistry } from '../engine';
import { createHelloSim } from '../sims/hello';

export const registry = {
  hello: createHelloSim,
} satisfies SimRegistry;
