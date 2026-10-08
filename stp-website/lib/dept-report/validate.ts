import { REMARKS_MAX, isEmptyRow, type Cell, type DeptData, type DeptSchema, type Field, type Row } from './schema';

export type ParsedReport = { ok: true; data: DeptData } | { ok: false; errors: Record<string, string> };

const TEXT_MAX = 120;
const DEFAULT_MAX_ROWS = 40;
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** error keys: `section.field` for single-value sections, `section[3].field` for the 4th row of a table */
export const errorKey = (section: string, field: string, row?: number) => (row === undefined ? `${section}.${field}` : `${section}[${row}].${field}`);

function cell(f: Field, raw: unknown, key: string, errors: Record<string, string>): Cell | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.replace(CONTROL, '').trim() : '';
  if (s === '') return undefined;

  switch (f.type) {
    case 'number': {
      const v = Number(s);
      const [min, max] = [f.min ?? 0, f.max ?? 10_000_000];
      if (!Number.isFinite(v)) errors[key] = `${f.label}: enter a number.`;
      else if (v < min || v > max) errors[key] = `${f.label}: must be between ${min} and ${max}.`;
      else return v;
      return undefined;
    }
    case 'select':
      if (!f.options?.includes(s)) { errors[key] = `${f.label}: choose one of the listed options.`; return undefined; }
      return s;
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) { errors[key] = `${f.label}: enter a valid date.`; return undefined; }
      return s;
    case 'time':
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) { errors[key] = `${f.label}: enter a time like 14:30.`; return undefined; }
      return s;
    default:
      if (s.length > TEXT_MAX) { errors[key] = `${f.label}: at most ${TEXT_MAX} characters.`; return undefined; }
      return s;
  }
}

function row(fields: Field[], raw: unknown, section: string, index: number | undefined, errors: Record<string, string>): Row {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Row = {};
  for (const f of fields) {
    const v = cell(f, src[f.key], errorKey(section, f.key, index), errors);
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

/** Cleans the submitted report (any shape) into stored data, or lists what is wrong. Blank = not recorded. */
export function parseReport(schema: DeptSchema, raw: unknown): ParsedReport {
  const errors: Record<string, string> = {};
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const data: DeptData = {};

  for (const sec of schema.sections) {
    const val = input[sec.key];
    if (sec.kind === 'fields') {
      const r = row(sec.fields, val, sec.key, undefined, errors);
      if (!isEmptyRow(r)) data[sec.key] = r;
    } else {
      const list = Array.isArray(val) ? val : [];
      const max = sec.maxRows ?? DEFAULT_MAX_ROWS;
      if (list.length > max) errors[sec.key] = `${sec.title}: at most ${max} rows.`;
      const rows = list.slice(0, max).map((r, i) => row(sec.fields, r, sec.key, i, errors)).filter((r) => !isEmptyRow(r));
      if (rows.length) data[sec.key] = rows;
    }
  }

  const remarks = typeof input.remarks === 'string' ? input.remarks.replace(CONTROL, '').trim() : '';
  if (remarks.length > REMARKS_MAX) errors.remarks = `Remarks: at most ${REMARKS_MAX} characters.`;
  else if (remarks) data.remarks = remarks;

  if (Object.keys(errors).length === 0 && Object.keys(data).length === 0) errors.form = 'Enter at least one value before saving.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
