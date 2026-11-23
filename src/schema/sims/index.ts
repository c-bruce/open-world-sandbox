import type { z } from 'zod';
import { bouncingBallParamsSchema } from './bouncing-ball';

/** One params schema per sim; adding a key here adds a `SimId`. */
export const simSchemas = {
  'bouncing-ball': bouncingBallParamsSchema,
} as const;

export type SimId = keyof typeof simSchemas;
export type SimParamsFor<Id extends SimId> = z.output<(typeof simSchemas)[Id]>;

export const simIdList = Object.keys(simSchemas) as SimId[];
