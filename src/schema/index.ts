import { z } from 'zod';
import { appParamsSchema } from './app';
import { sceneParamsSchema } from './scene';
import { simIdList, simSchemas, type SimId, type SimParamsFor } from './sims';

export type { SimId, SimParamsFor };
/** Shared environment: sun, sky, exposure, grid and camera. */
export type SceneParams = z.output<typeof sceneParamsSchema>;
/** App-level settings: current sim, transport and overlay. */
export type AppParams = z.output<typeof appParamsSchema>;

/** Result of validating untrusted input (UI edits, URL params). */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Plain JSON Schema (draft 2020-12) with this project's `label`/`step` metadata. */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: readonly (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  label?: string;
  step?: number;
  [key: string]: unknown;
}

// Mapped type so indexing by a generic Id keeps the id → params correlation.
const typedSimSchemas: { [Id in SimId]: z.ZodType<SimParamsFor<Id>> } = simSchemas;

function parseWith<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

function defaultsOf<T>(schema: z.ZodType<T>): T {
  return schema.parse({});
}

function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { io: 'input' }) as JsonSchema;
}

/** Registered sim ids, in declaration order; routing falls back to the first. */
export function simIds(): readonly SimId[] {
  return simIdList;
}

/** Validate `input` against sim `id`'s schema, filling missing fields with defaults. */
export function parseSimParams<Id extends SimId>(
  id: Id,
  input: unknown,
): ParseResult<SimParamsFor<Id>> {
  return parseWith(typedSimSchemas[id], input);
}

/** Every field of sim `id` at its default. */
export function defaultSimParams<Id extends SimId>(id: Id): SimParamsFor<Id> {
  return defaultsOf(typedSimSchemas[id]);
}

/** JSON Schema of sim `id`'s params; the UI builds its controls from this. */
export function simParamsJsonSchema(id: SimId): JsonSchema {
  return jsonSchemaOf(typedSimSchemas[id]);
}

export function parseSceneParams(input: unknown): ParseResult<SceneParams> {
  return parseWith(sceneParamsSchema, input);
}

export function defaultSceneParams(): SceneParams {
  return defaultsOf(sceneParamsSchema);
}

export function sceneParamsJsonSchema(): JsonSchema {
  return jsonSchemaOf(sceneParamsSchema);
}

export function parseAppParams(input: unknown): ParseResult<AppParams> {
  return parseWith(appParamsSchema, input);
}

export function defaultAppParams(): AppParams {
  return defaultsOf(appParamsSchema);
}

export function appParamsJsonSchema(): JsonSchema {
  return jsonSchemaOf(appParamsSchema);
}
