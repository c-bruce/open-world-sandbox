import { useId, useState } from 'react';
import { formatNumber } from './format';

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function NumberField({ label, value, min, max, step, onChange }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(Math.max(v, min), max);

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed));
    setDraft(null);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            onChange(Number(e.target.value));
          }}
        />
        <input
          className="number-input"
          type="number"
          aria-label={`${label} value`}
          min={min}
          max={max}
          step={step}
          value={draft ?? formatNumber(value, step)}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDraft();
            if (e.key === 'Escape') setDraft(null);
          }}
        />
      </div>
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleField({ label, value, onChange }: ToggleFieldProps) {
  const id = useId();
  return (
    <div className="field field-inline">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="toggle"
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
