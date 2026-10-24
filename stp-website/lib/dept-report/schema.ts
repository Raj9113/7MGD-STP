import { MECHANICAL } from './defs/mechanical';
import { ELECTRICAL } from './defs/electrical';
import { HOUSEKEEPING } from './defs/housekeeping';

export type DeptSlug = 'mechanical' | 'electrical' | 'housekeeping';
export const DEPT_SLUGS: DeptSlug[] = ['mechanical', 'electrical', 'housekeeping'];

export type FieldType = 'number' | 'text' | 'select' | 'date' | 'time';
export type Cell = string | number;
export type Row = Record<string, Cell>;
export type DeptData = { [section: string]: Row | Row[] | string | undefined } & { remarks?: string };

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';
export type Level = 'bad' | 'warn' | undefined;

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  status?: boolean;
  bar?: boolean;
  carry?: boolean;
  loginName?: boolean;
  carryFrom?: string;
  derive?: (row: Row) => number | undefined;
  warn?: (v: number | string | undefined, row: Row) => Level;
}

export interface Section {
  key: string;
  title: string;
  icon: string;
  help?: string;
  kind: 'fields' | 'table';
  fields: Field[];
  titleKeys?: string[];
  maxRows?: number;
  addLabel?: string;
  view?: 'stats' | 'cards' | 'table';
  shift?: { from: number; to: number };
  carryMode?: 'columns' | 'open-rows';
  doneWhen?: { key: string; values: string[] };
  seed?: Row[];
  check?: (row: Row) => { field: string; message: string } | undefined;
}

export interface DeptSchema {
  slug: DeptSlug;
  label: string;
  role: string;
  icon: string;
  blurb: string;
  accent: { ring: string; text: string; bg: string; solid: string };
  sections: Section[];
}

const TONES: Record<string, Tone> = {
  running: 'good', ok: 'good', normal: 'good', healthy: 'good', done: 'good', completed: 'good', cleared: 'good', 'auto-standby': 'info',
  standby: 'warn', medium: 'warn', open: 'warn', pending: 'warn', 'under maintenance': 'warn', 'on battery': 'warn', 'high do': 'warn',
  fault: 'bad', alert: 'bad', high: 'bad', active: 'bad', breakdown: 'bad', choked: 'bad', overflowing: 'bad', 'low do': 'bad',
  'in progress': 'info', acknowledged: 'info', low: 'muted', steady: 'muted', falling: 'muted', stopped: 'muted', off: 'muted',
  good: 'good', clean: 'good', clear: 'good', uniform: 'good', smooth: 'good', none: 'good', online: 'good', 'in service': 'good', charged: 'good', available: 'good', auto: 'good', 'cleaned today': 'good',
  noisy: 'warn', minor: 'warn', slight: 'warn', patchy: 'warn', dirty: 'warn', fouled: 'warn', intermittent: 'warn', 'slightly turbid': 'warn', 'algae growth': 'warn', 'hard to operate': 'warn',
  'manual mode': 'warn', 'not charged': 'warn', 'low oil': 'warn', 'needs attention': 'warn', 'reading doubtful': 'warn', 'not done': 'warn', 'not available': 'warn', 'lamp fault': 'bad',
  'low intensity': 'warn', leaking: 'bad', damaged: 'bad', stuck: 'bad', clogged: 'bad', torn: 'bad', heavy: 'bad', turbid: 'bad', trip: 'bad', tripped: 'bad', offline: 'bad', lost: 'bad',
  faulty: 'bad', expired: 'bad', missing: 'bad', seepage: 'bad', 'ballast fault': 'bad', 'out of order': 'bad', 'pink (change)': 'warn', 'blue (good)': 'good',
};
export const statusTone = (text: string | number | undefined): Tone | undefined => TONES[String(text ?? '').toLowerCase()];

export const num = (v: Cell | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export { MECHANICAL, ELECTRICAL, HOUSEKEEPING };

export const SCHEMAS: Record<DeptSlug, DeptSchema> = { mechanical: MECHANICAL, electrical: ELECTRICAL, housekeeping: HOUSEKEEPING };

export const REMARKS_MAX = 2000;

export function isEmptyRow(row: Row): boolean {
  return Object.values(row).every((v) => v === '' || v === undefined || v === null);
}

export function rowTitle(sec: Section, row: Row, index: number): string {
  const parts = (sec.titleKeys ?? []).map((k) => String(row[k] ?? '')).filter(Boolean);
  return parts.length ? parts.join(' - ') : `${sec.addLabel?.replace(/^Add /, '') ?? 'Row'} ${index + 1}`;
}

export function showValue(f: Field, v: Cell | undefined): string {
  if (v === undefined || v === '') return '-';
  if (f.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('-');
  return f.unit && f.type === 'number' ? `${v} ${f.unit}` : String(v);
}

export const asRows = (v: DeptData[string]): Row[] => (Array.isArray(v) ? v : []);
export const asRow = (v: DeptData[string]): Row => (v && !Array.isArray(v) && typeof v === 'object' ? (v as Row) : {});

export function startingData(schema: DeptSchema, existing: DeptData | null, previous: DeptData | null): DeptData {
  if (existing) return existing;
  const out: DeptData = {};
  for (const sec of schema.sections) {
    const prev = previous?.[sec.key];
    if (sec.kind === 'fields') {
      const row: Row = {};
      const src = prev ? asRow(prev) : ({} as Row);
      for (const f of sec.fields) {
        if (f.carry && src[f.key] !== undefined) row[f.key] = src[f.key];
        else if (f.carryFrom && src[f.carryFrom] !== undefined) row[f.key] = src[f.carryFrom];
      }
      for (const [k, v] of Object.entries(sec.seed?.[0] ?? {})) if (row[k] === undefined && (!prev || sec.fields.find((f) => f.key === k)?.carry)) row[k] = v;
      out[sec.key] = row;
    } else {
      const carried: Row[] = [];
      for (const r of asRows(prev)) {
        if (sec.carryMode === 'open-rows') {
          if (sec.doneWhen && sec.doneWhen.values.includes(String(r[sec.doneWhen.key] ?? ''))) continue;
          carried.push({ ...r });
        } else {
          const row: Row = {};
          for (const f of sec.fields) if (f.carry && r[f.key] !== undefined) row[f.key] = r[f.key];
          carried.push(row);
        }
      }
      out[sec.key] = prev ? carried : (sec.seed ?? []).map((r) => ({ ...r }));
    }
  }
  return out;
}

export const inShift = (sec: Section, hour: number) => !sec.shift || (sec.shift.from < sec.shift.to ? hour >= sec.shift.from && hour < sec.shift.to : hour >= sec.shift.from || hour < sec.shift.to);

export const istHour = (now = Date.now()) => new Date(now + 5.5 * 3600 * 1000).getUTCHours();

export const runningShifts = (schema: DeptSchema, hour: number): Section[] =>
  schema.sections.filter((s) => s.kind === 'fields' && s.shift && s.fields.some((f) => f.loginName) && inShift(s, hour));

export function applyLoginNames(schema: DeptSchema, data: DeptData, existing: DeptData | null, who: string, hour: number, chosen?: string | null): DeptData {
  const running = runningShifts(schema, hour);
  const target = chosen && running.some((s) => s.key === chosen) ? chosen : running.length === 1 ? running[0].key : null;
  const out: DeptData = { ...data };
  for (const sec of schema.sections) {
    if (sec.kind !== 'fields') continue;
    for (const f of sec.fields) {
      if (!f.loginName) continue;
      const saved = asRow(existing?.[sec.key])[f.key];
      const value: Cell | undefined = saved !== undefined ? saved : !sec.shift || sec.key === target ? who : undefined;
      const row: Row = { ...asRow(out[sec.key]) };
      if (value !== undefined) row[f.key] = value;
      else delete row[f.key];
      if (Object.keys(row).length) out[sec.key] = row;
      else delete out[sec.key];
    }
  }
  return out;
}

export function attention(schema: DeptSchema, data: DeptData | null): { alerts: number; notes: string[] } {
  if (!data) return { alerts: 0, notes: [] };
  const notes: string[] = [];
  let alerts = 0;
  for (const sec of schema.sections) {
    if (sec.kind === 'table') {
      const bad = asRows(data[sec.key]).filter((r) => sec.fields.some((f) => f.status && statusTone(r[f.key]) === 'bad') || sec.fields.some((f) => f.warn?.(r[f.key], r) === 'bad'));
      const open = sec.doneWhen ? bad.filter((r) => !sec.doneWhen!.values.includes(String(r[sec.doneWhen!.key] ?? ''))) : bad;
      if (open.length) { alerts += open.length; notes.push(`${open.length} in ${sec.title}`); }
    } else {
      const row = asRow(data[sec.key]);
      const bad = sec.fields.filter((f) => (f.status && statusTone(row[f.key]) === 'bad') || f.warn?.(row[f.key], row) === 'bad');
      if (bad.length) { alerts += bad.length; notes.push(`${bad.map((f) => f.label).join(', ')} (${sec.title})`); }
    }
  }
  return { alerts, notes };
}
