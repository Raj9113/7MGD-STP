import raw from '@/data/lab/lab-data.json';

// ── Types ─────────────────────────────────────────────────────────────────────
// The JSON is generated from the lab team's Excel/Word files by scripts/build-lab-data.py.

export type ParamKey =
  | 'temp' | 'ph' | 'bod' | 'cod' | 'tss' | 'phos' | 'alk' | 'do' | 'tn' | 'nh4' | 'oil' | 'coliform';

export interface Side { in?: number | null; out?: number | null }
export interface Flow { pumping?: number; treated?: number }

export type DayRecord = { date: string; flow?: Flow } & Partial<Record<ParamKey, Side>>;

export interface Limit { min?: number; max?: number }

export interface PowerReading {
  open: number | null; close: number | null; diff: number | null;
  multiplier: number | null; units: number | null; pf: number | null;
}
export interface DayReport {
  date: string;
  lab?: Partial<Record<ParamKey | 'flow', Side>>;
  power?: PowerReading;
  photos: { kind: 'olms' | 'sample'; src: string }[];
}

export interface LabMonth { key: string; sheet: string; days: DayRecord[] }

export interface LabData {
  generatedAt: string;
  source: { xlsx: string; docx: string[] };
  limits: Partial<Record<ParamKey, Limit>>;
  months: LabMonth[];
  reports: Record<string, DayReport>;
  /** Days entered through the portal form (not from the Excel/Word files): who saved them and when */
  live?: Record<string, { by: string | null; at: string }>;
}

/** The history generated from the lab team's files. Live entries from the portal are merged on top (see mergeLive). */
export const lab = raw as unknown as LabData;

// ── Entries made on the portal ────────────────────────────────────────────────

export interface LiveRow {
  date: string;
  readings: Record<string, unknown>;
  power: PowerReading | null;
  photos: { kind: 'olms' | 'sample'; path: string }[];
  updated_at: string;
  updated_by_name: string | null;
}

/**
 * Overlays portal entries (table `lab_daily`) on the file-based history. A portal entry replaces that day's readings;
 * photos and power fall back to the file-based report for anything the portal entry doesn't have.
 */
export function mergeLive(base: LabData, rows: LiveRow[]): LabData {
  const months: LabMonth[] = base.months.map((m) => ({ ...m, days: [...m.days] }));
  const reports = { ...base.reports };
  const live: NonNullable<LabData['live']> = {};

  for (const row of rows) {
    const key = row.date.slice(0, 7);
    let month = months.find((m) => m.key === key);
    if (!month) {
      month = { key, sheet: 'Entered on the portal', days: [] };
      months.push(month);
    }
    const day = { date: row.date, ...row.readings } as DayRecord;
    const at = month.days.findIndex((d) => d.date === row.date);
    if (at >= 0) month.days[at] = day;
    else month.days.push(day);

    const prev = base.reports[row.date];
    const version = new Date(row.updated_at).getTime();
    const photos = (['sample', 'olms'] as const).flatMap((kind) => {
      const mine = row.photos.find((p) => p.kind === kind);
      if (mine) return [{ kind, src: `/api/lab/photo/${mine.path}?v=${version}` }];
      const old = prev?.photos.find((p) => p.kind === kind);
      return old ? [old] : [];
    });
    const power = row.power ?? prev?.power;
    if (photos.length || power) reports[row.date] = { date: row.date, photos, power };
    live[row.date] = { by: row.updated_by_name, at: row.updated_at };
  }

  months.sort((a, b) => a.key.localeCompare(b.key));
  months.forEach((m) => m.days.sort((a, b) => a.date.localeCompare(b.date)));
  return { ...base, months, reports, live };
}

// ── Parameter catalogue ───────────────────────────────────────────────────────

export interface ParamMeta {
  key: ParamKey;
  label: string;
  short: string;
  unit: string;
  decimals: number;
}

export const PARAMS: ParamMeta[] = [
  { key: 'ph', label: 'pH', short: 'pH', unit: '', decimals: 1 },
  { key: 'bod', label: 'Biochemical Oxygen Demand', short: 'BOD', unit: 'mg/l', decimals: 0 },
  { key: 'cod', label: 'Chemical Oxygen Demand', short: 'COD', unit: 'mg/l', decimals: 0 },
  { key: 'tss', label: 'Total Suspended Solids', short: 'TSS', unit: 'mg/l', decimals: 0 },
  { key: 'phos', label: 'Phosphorus', short: 'Phos.', unit: 'mg/l', decimals: 1 },
  { key: 'tn', label: 'Total Nitrogen', short: 'TN', unit: 'mg/l', decimals: 1 },
  { key: 'nh4', label: 'Ammonia Nitrogen (NH4-N)', short: 'NH4-N', unit: 'mg/l', decimals: 1 },
  { key: 'alk', label: 'Total Alkalinity', short: 'Alk.', unit: 'mg/l', decimals: 0 },
  { key: 'do', label: 'Dissolved Oxygen', short: 'DO', unit: 'mg/l', decimals: 1 },
  { key: 'temp', label: 'Temperature', short: 'Temp.', unit: '°C', decimals: 1 },
  { key: 'oil', label: 'Oil & Grease', short: 'O&G', unit: 'mg/l', decimals: 1 },
];

/** Parameters judged against a permissible discharge limit, in display order. */
export const LIMITED: ParamKey[] = ['bod', 'cod', 'tss', 'phos', 'tn', 'ph'];

export const PARAM = Object.fromEntries(PARAMS.map((p) => [p.key, p])) as Record<ParamKey, ParamMeta>;

export function limitText(l?: Limit): string {
  if (!l) return '—';
  if (l.min !== undefined && l.max !== undefined) return `${l.min} – ${l.max}`;
  return `≤ ${l.max}`;
}

// ── Month / day selection ─────────────────────────────────────────────────────

export function getMonth(months: LabMonth[], key: string | undefined) {
  return months.find((m) => m.key === key) ?? months[months.length - 1];
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: style, year: style === 'long' ? 'numeric' : '2-digit', timeZone: 'UTC',
  });
}

export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ── Maths ─────────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function mean(values: (number | null | undefined)[]): number | null {
  const xs = values.filter(isNum);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export type LimitStatus = 'ok' | 'over' | 'under' | 'na';

export function limitStatus(key: ParamKey, value: number | null | undefined): LimitStatus {
  const l = lab.limits[key];
  if (!l || !isNum(value)) return 'na';
  if (l.max !== undefined && value > l.max) return 'over';
  if (l.min !== undefined && value < l.min) return 'under';
  return 'ok';
}

export function fmt(v: number | null | undefined, decimals = 1): string {
  if (!isNum(v)) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Flow values range from 0.004 to ~1.5 MGD and are logged to 2–3 decimals: show 3 only when the third digit matters. */
export function fmtFlow(v: number | null | undefined): string {
  if (!isNum(v)) return '—';
  return v.toFixed(3).replace(/0$/, '');
}

export interface ParamSummary {
  key: ParamKey;
  inAvg: number | null;
  outAvg: number | null;
  /** % reduction between the average inlet and average outlet, over days where both were measured */
  removal: number | null;
  daysChecked: number;
  daysOk: number;
}

export function summarize(days: DayRecord[], key: ParamKey): ParamSummary {
  const both = days.filter((d) => isNum(d[key]?.in) && isNum(d[key]?.out));
  const inAvg = mean(days.map((d) => d[key]?.in));
  const outAvg = mean(days.map((d) => d[key]?.out));
  const inBoth = mean(both.map((d) => d[key]!.in));
  const outBoth = mean(both.map((d) => d[key]!.out));
  const checked = days.filter((d) => limitStatus(key, d[key]?.out) !== 'na');
  return {
    key,
    inAvg,
    outAvg,
    removal: inBoth && outBoth !== null ? ((inBoth - outBoth) / inBoth) * 100 : null,
    daysChecked: checked.length,
    daysOk: checked.filter((d) => limitStatus(key, d[key]?.out) === 'ok').length,
  };
}

/** A day is "fully compliant" when every measured limit parameter (BOD, COD, TSS, Phos., TN, pH) is within its limit. */
export function dayCompliance(d: DayRecord): 'pass' | 'fail' | 'na' {
  const states = LIMITED.map((k) => limitStatus(k, d[k]?.out)).filter((s) => s !== 'na');
  if (states.length < 3) return 'na';
  return states.every((s) => s === 'ok') ? 'pass' : 'fail';
}

/** How many limit parameters are outside their permissible limit at the outlet on this day. */
export function exceedCount(d: DayRecord): number {
  return LIMITED.filter((k) => ['over', 'under'].includes(limitStatus(k, d[k]?.out))).length;
}

export function monthStats(days: DayRecord[]) {
  const compliance = days.map(dayCompliance).filter((c) => c !== 'na');
  return {
    avgTreated: mean(days.map((d) => d.flow?.treated)),
    avgPumping: mean(days.map((d) => d.flow?.pumping)),
    daysReported: days.length,
    compliantDays: compliance.filter((c) => c === 'pass').length,
    complianceDays: compliance.length,
  };
}

/** Series of one value per calendar day of the month (null where there is no reading). */
export function dailySeries(key: string, days: DayRecord[], pick: (d: DayRecord) => number | null | undefined) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return Array.from({ length: daysInMonth(key) }, (_, i) => {
    const d = byDate.get(`${key}-${String(i + 1).padStart(2, '0')}`);
    const v = d ? pick(d) : null;
    return isNum(v) ? v : null;
  });
}
