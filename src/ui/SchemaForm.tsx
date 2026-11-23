import type { JsonSchema } from '../schema';
import { NumberField, SelectField, ToggleField } from './fields';

type Values = Record<string, unknown>;

interface SchemaFormProps {
  schema: JsonSchema;
  value: Values;
  onChange: (next: Values) => void;
  /** Top-level keys to leave out. */
  exclude?: readonly string[];
}

/** Renders controls for every property of a JSON Schema object, recursing into groups. */
export function SchemaForm({ schema, value, onChange, exclude = [] }: SchemaFormProps) {
  const entries = Object.entries(schema.properties ?? {}).filter(([key]) => !exclude.includes(key));
  return (
    <>
      {entries.map(([key, prop]) => (
        <SchemaField
          key={key}
          name={key}
          schema={prop}
          value={value[key]}
          onChange={(next) => {
            onChange({ ...value, [key]: next });
          }}
        />
      ))}
    </>
  );
}

interface SchemaFieldProps {
  name: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (next: unknown) => void;
}

function SchemaField({ name, schema, value, onChange }: SchemaFieldProps) {
  const label = schema.label ?? name;

  if (schema.type === 'object' && schema.properties && isRecord(value)) {
    return (
      <details className="group" open>
        <summary>{label}</summary>
        <SchemaForm schema={schema} value={value} onChange={onChange} />
      </details>
    );
  }
  if (schema.enum && typeof value === 'string') {
    return (
      <SelectField
        label={label}
        value={value}
        options={schema.enum.map(String)}
        onChange={onChange}
      />
    );
  }
  if (schema.type === 'boolean' && typeof value === 'boolean') {
    return <ToggleField label={label} value={value} onChange={onChange} />;
  }
  if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
    const min = schema.minimum ?? Math.min(0, value);
    const max = schema.maximum ?? Math.max(1, value * 2);
    const step = schema.step ?? (schema.type === 'integer' ? 1 : (max - min) / 200);
    return (
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    );
  }
  return null;
}

function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null;
}
