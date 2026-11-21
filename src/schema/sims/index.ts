import type { z } from 'zod';
import { helloParamsSchema } from './hello';

export const simSchemas = {
  hello: helloParamsSchema,
} as const;

export type SimId = keyof typeof simSchemas;
export type SimParamsFor<Id extends SimId> = z.output<(typeof simSchemas)[Id]>;

export const simIdList = Object.keys(simSchemas) as SimId[];
