import { describe, expect, it } from 'vitest';
import { defaultSimParams } from '../schema';
import { decodeParams, encodeParams, formatRoute, parseRoute } from './routing';

const defaults = defaultSimParams('bouncing-ball');

describe('routing', () => {
  it('uses defaults for an empty or unknown hash', () => {
    expect(parseRoute('')).toEqual({ sim: 'bouncing-ball', perf: false, params: defaults });
    expect(parseRoute('#/does-not-exist?perf=1')).toEqual({
      sim: 'bouncing-ball',
      perf: true,
      params: defaults,
    });
  });

  it('round-trips non-default params and the perf flag', () => {
    const route = {
      sim: 'bouncing-ball' as const,
      perf: true,
      params: { ...defaults, restitution: 0.9 },
    };
    const hash = formatRoute(route);
    expect(hash).toMatch(/^#\/bouncing-ball\?perf=1&p=[A-Za-z0-9_-]+$/);
    expect(parseRoute(hash)).toEqual(route);
  });

  it('omits the query when everything is default', () => {
    expect(formatRoute({ sim: 'bouncing-ball', perf: false, params: defaults })).toBe(
      '#/bouncing-ball',
    );
  });

  it('only encodes params that differ from the defaults', () => {
    const hash = formatRoute({
      sim: 'bouncing-ball',
      perf: false,
      params: { ...defaults, gravity: 3.7 },
    });
    const p = new URLSearchParams(hash.split('?')[1]).get('p') ?? '';
    expect(decodeParams(p)).toEqual({ gravity: 3.7 });
  });

  it('falls back to defaults for invalid or out-of-range params', () => {
    expect(parseRoute('#/bouncing-ball?p=not*base64').params).toEqual(defaults);
    expect(parseRoute(`#/bouncing-ball?p=${encodeParams({ restitution: 5 })}`).params).toEqual(
      defaults,
    );
    expect(parseRoute(`#/bouncing-ball?p=${encodeParams([1, 2])}`).params).toEqual(defaults);
  });

  it('uses base64url without padding', () => {
    const encoded = encodeParams({ a: '>>>???' });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeParams(encoded)).toEqual({ a: '>>>???' });
  });
});
