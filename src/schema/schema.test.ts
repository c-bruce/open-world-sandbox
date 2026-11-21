import { describe, expect, it } from 'vitest';
import {
  appParamsJsonSchema,
  defaultAppParams,
  defaultSceneParams,
  defaultSimParams,
  parseAppParams,
  parseSceneParams,
  parseSimParams,
  sceneParamsJsonSchema,
  simIds,
  simParamsJsonSchema,
} from './index';

describe('defaults', () => {
  it.each(simIds())('sim %s defaults parse back unchanged', (id) => {
    const defaults = defaultSimParams(id);
    expect(parseSimParams(id, defaults)).toEqual({ ok: true, value: defaults });
  });

  it('scene defaults fill nested groups', () => {
    const scene = defaultSceneParams();
    expect(scene.sun.elevation).toBe(10);
    expect(scene.camera.target).toEqual({ x: 0, y: 0.5, z: 0 });
    expect(parseSceneParams(scene)).toEqual({ ok: true, value: scene });
  });

  it('partial scene input is completed with defaults', () => {
    const result = parseSceneParams({ sun: { azimuth: 90 } });
    expect(result.ok && result.value.sun).toEqual({ ...defaultSceneParams().sun, azimuth: 90 });
  });

  it('app defaults point at a registered sim', () => {
    const app = defaultAppParams();
    expect(simIds()).toContain(app.sim);
    expect(parseAppParams(app)).toEqual({ ok: true, value: app });
  });
});

describe('validation', () => {
  it('rejects out-of-range sim params', () => {
    expect(parseSimParams('hello', { restitution: 1.5 }).ok).toBe(false);
    expect(parseSimParams('hello', { radius: 0 }).ok).toBe(false);
  });

  it('rejects out-of-range scene params', () => {
    expect(parseSceneParams({ sun: { elevation: 120 } }).ok).toBe(false);
    expect(parseSceneParams({ grid: { majorInterval: 2.5 } }).ok).toBe(false);
  });

  it('rejects unknown sim ids and bad app values', () => {
    expect(parseAppParams({ sim: 'nope' }).ok).toBe(false);
    expect(parseAppParams({ substeps: 0 }).ok).toBe(false);
  });

  it('returns a readable error message', () => {
    const result = parseSimParams('hello', { gravity: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/gravity/);
  });
});

describe('JSON Schema', () => {
  it('includes min/max, defaults and labels for sim params', () => {
    const radius = simParamsJsonSchema('hello').properties?.radius;
    expect(radius).toMatchObject({
      type: 'number',
      minimum: 0.05,
      maximum: 2,
      default: 0.5,
      label: 'Radius (m)',
    });
  });

  it('keeps nested groups and labels for scene params', () => {
    const sun = sceneParamsJsonSchema().properties?.sun;
    expect(sun?.label).toBe('Sun');
    expect(sun?.properties?.elevation).toMatchObject({
      minimum: -5,
      maximum: 90,
      label: 'Sun elevation (°)',
    });
  });

  it('exposes integers and enums for app params', () => {
    const props = appParamsJsonSchema().properties;
    expect(props?.substeps).toMatchObject({ type: 'integer', minimum: 1, maximum: 32 });
    expect(props?.sim.enum).toEqual(simIds());
  });
});
