import { useState } from 'react';
import type { Engine } from '../engine';
import {
  parseAppParams,
  parseSceneParams,
  parseSimParams,
  sceneParamsJsonSchema,
  simIds,
  simParamsJsonSchema,
} from '../schema';
import { SelectField } from './fields';
import { useStore } from './hooks';
import { SchemaForm } from './SchemaForm';
import { Transport } from './Transport';

const sceneSchema = sceneParamsJsonSchema();

export function SidePanel({ engine }: { engine: Engine }) {
  const [open, setOpen] = useState(true);
  const { app, scene, sim } = useStore(engine.params);
  const status = useStore(engine.status);

  if (!open) {
    return (
      <button
        type="button"
        className="panel-toggle"
        aria-expanded="false"
        onClick={() => {
          setOpen(true);
        }}
      >
        Controls
      </button>
    );
  }

  return (
    <aside className="panel" aria-label="Controls">
      <header className="panel-header">
        <h1>Open World Sandbox</h1>
        <button
          type="button"
          className="icon-button"
          aria-label="Hide controls"
          aria-expanded="true"
          onClick={() => {
            setOpen(false);
          }}
        >
          ×
        </button>
      </header>

      <div className="panel-body">
        <SelectField
          label="Simulation"
          value={app.sim}
          options={simIds()}
          onChange={(id) => {
            const result = parseAppParams({ ...app, sim: id });
            if (result.ok) engine.setApp(result.value);
          }}
        />
        {status.loading && <p className="status">Loading {status.id}…</p>}
        {status.error && (
          <p className="status status-error" role="alert">
            {status.error}
          </p>
        )}

        <Transport engine={engine} app={app} />

        <details className="section" open>
          <summary>Simulation parameters</summary>
          <SchemaForm
            key={app.sim}
            schema={simParamsJsonSchema(app.sim)}
            value={sim}
            onChange={(next) => {
              const result = parseSimParams(app.sim, next);
              if (result.ok) engine.setSimParams(result.value);
            }}
          />
        </details>

        <details className="section" open>
          <summary>Scene</summary>
          <SchemaForm
            schema={sceneSchema}
            value={scene}
            exclude={['camera']}
            onChange={(next) => {
              const result = parseSceneParams(next);
              if (result.ok) engine.setScene(result.value);
            }}
          />
        </details>

        <p className="hint">
          Drag to orbit · right-drag to pan · scroll to zoom · <kbd>`</kbd> performance
        </p>
      </div>
    </aside>
  );
}
