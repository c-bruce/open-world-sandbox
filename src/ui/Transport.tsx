import type { Engine } from '../engine';
import { appParamsJsonSchema, parseAppParams, type AppParams, type JsonSchema } from '../schema';
import { SchemaForm } from './SchemaForm';

const appSchema = appParamsJsonSchema();
const transportSchema: JsonSchema = {
  type: 'object',
  properties: Object.fromEntries(
    Object.entries(appSchema.properties ?? {}).filter(([key]) =>
      ['timeScale', 'substeps'].includes(key),
    ),
  ),
};

interface TransportProps {
  engine: Engine;
  app: AppParams;
}

export function Transport({ engine, app }: TransportProps) {
  const setApp = (next: unknown) => {
    const result = parseAppParams(next);
    if (result.ok) engine.setApp(result.value);
  };

  return (
    <section className="section" aria-label="Transport">
      <div className="transport-buttons">
        <button
          type="button"
          className="primary"
          onClick={() => {
            setApp({ ...app, paused: !app.paused });
          }}
        >
          {app.paused ? 'Play' : 'Pause'}
        </button>
        <button
          type="button"
          disabled={!app.paused}
          title={app.paused ? 'Advance one fixed step' : undefined}
          onClick={() => {
            engine.stepOnce();
          }}
        >
          Step
        </button>
        <button
          type="button"
          onClick={() => {
            engine.reset();
          }}
        >
          Reset
        </button>
      </div>
      <SchemaForm schema={transportSchema} value={app} onChange={setApp} />
    </section>
  );
}
