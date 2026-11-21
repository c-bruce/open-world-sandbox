import { defaultSimParams, parseSimParams, simIds, type SimId, type SimParamsFor } from '../schema';

export interface Route {
  sim: SimId;
  perf: boolean;
  params: SimParamsFor<SimId>;
}

/** Parses `#/<simId>?perf=1&p=<base64url JSON>`; anything invalid falls back to defaults. */
export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const ids = simIds();
  const fallback = ids.at(0);
  if (fallback === undefined) throw new Error('No simulations registered');
  const sim = ids.find((id) => id === decodeURIComponent(path)) ?? fallback;
  const search = new URLSearchParams(query);
  const encoded = search.get('p');
  const decoded = encoded === null ? {} : decodeParams(encoded);
  const parsed = parseSimParams(sim, decoded ?? {});
  return {
    sim,
    perf: search.get('perf') === '1',
    params: parsed.ok ? parsed.value : defaultSimParams(sim),
  };
}

/** Inverse of `parseRoute`; only params that differ from the defaults are encoded. */
export function formatRoute({ sim, perf, params }: Route): string {
  const defaults: Record<string, unknown> = defaultSimParams(sim);
  const changed = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => !Object.is(value, defaults[key])),
  );
  const search = new URLSearchParams();
  if (perf) search.set('perf', '1');
  if (Object.keys(changed).length > 0) search.set('p', encodeParams(changed));
  const query = search.toString();
  return `#/${encodeURIComponent(sim)}${query ? `?${query}` : ''}`;
}

export function encodeParams(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeParams(encoded: string): unknown {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}
