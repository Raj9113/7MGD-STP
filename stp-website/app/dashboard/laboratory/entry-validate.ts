import { DEFAULT_MULTIPLIER, ENTRY_FIELDS, FLOW_MAX, fieldName } from './entry-fields';

export interface EntryReadings {
  flow?: { pumping?: number; treated?: number };
  [param: string]: { in?: number; out?: number; pumping?: number; treated?: number } | undefined;
}

export interface EntryPower {
  open: number | null;
  close: number | null;
  diff: number | null;
  multiplier: number | null;
  units: number | null;
  pf: number | null;
}

export type ParsedEntry =
  | { ok: true; date: string; readings: EntryReadings; power: EntryPower | null }
  | { ok: false; errors: Record<string, string> };

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Turns the submitted form values into clean data, or a list of field errors.
 * `get(name)` returns the raw string for an input (empty / missing = not measured).
 */
export function parseEntry(get: (name: string) => string | null | undefined, today: string): ParsedEntry {
  const errors: Record<string, string> = {};

  const date = (get('date') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    errors.date = 'Choose a valid date.';
  } else if (date > today) {
    errors.date = 'The date cannot be in the future.';
  }

  const read = (name: string, min: number, max: number, label: string): number | undefined => {
    const raw = (get(name) ?? '').trim();
    if (raw === '') return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v)) { errors[name] = `${label}: enter a number.`; return undefined; }
    if (v < min || v > max) { errors[name] = `${label}: must be between ${min} and ${max}.`; return undefined; }
    return v;
  };

  const readings: EntryReadings = {};
  const pumping = read('flow_pumping', 0, FLOW_MAX, 'Pumped flow');
  const treated = read('flow_treated', 0, FLOW_MAX, 'Treated flow');
  if (pumping !== undefined || treated !== undefined) {
    readings.flow = {};
    if (pumping !== undefined) readings.flow.pumping = pumping;
    if (treated !== undefined) readings.flow.treated = treated;
  }
  for (const f of ENTRY_FIELDS) {
    for (const side of f.sides) {
      const v = read(fieldName(f.key, side), f.min, f.max, `${f.label} ${side === 'in' ? 'inlet' : 'outlet'}`);
      if (v !== undefined) (readings[f.key] ??= {})[side] = v;
    }
  }
  if (Object.keys(readings).length === 0 && !errors.date) {
    errors.form = 'Enter at least one reading before saving.';
  }

  // Power: units = (close - open) x multiplication factor
  const open = read('power_open', 0, 1e7, 'Meter open');
  const close = read('power_close', 0, 1e7, 'Meter close');
  const multiplier = read('power_multiplier', 1, 1e6, 'Multiplication factor');
  const pf = read('power_pf', 0, 1, 'Power factor');
  let power: EntryPower | null = null;
  if (open !== undefined || close !== undefined || pf !== undefined) {
    if ((open === undefined) !== (close === undefined)) {
      errors.power_close = 'Enter both the meter open and close readings.';
    } else if (open !== undefined && close !== undefined && close < open) {
      errors.power_close = 'Meter close cannot be lower than meter open.';
    }
    const mf = multiplier ?? DEFAULT_MULTIPLIER;
    const diff = open !== undefined && close !== undefined ? round(close - open, 2) : null;
    power = {
      open: open ?? null,
      close: close ?? null,
      diff,
      multiplier: mf,
      units: diff === null ? null : round(diff * mf, 0),
      pf: pf ?? null,
    };
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, date, readings, power };
}
