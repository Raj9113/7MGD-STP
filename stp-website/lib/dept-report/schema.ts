/**
 * What each department records every day. One schema per department drives everything: the entry form, server-side
 * validation, the department page, the PDF report and the overview tiles. Pure data + small helpers (no server imports),
 * so it can be used from client components too.
 */

export type DeptSlug = 'mechanical' | 'electrical' | 'housekeeping';
export const DEPT_SLUGS: DeptSlug[] = ['mechanical', 'electrical', 'housekeeping'];

export type FieldType = 'number' | 'text' | 'select' | 'date' | 'time';
export type Cell = string | number;
export type Row = Record<string, Cell>;
/** The stored report of one day: a Row for `fields` sections, Row[] for `table` sections, plus free-text remarks. */
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
  /** Shown as a coloured status badge in the views */
  status?: boolean;
  /** 0-100 value drawn as a progress bar in the views */
  bar?: boolean;
  /** Kept when tomorrow's blank form is started from the last report (names, ids, capacities...) */
  carry?: boolean;
  /** Highlights a value (red / amber) in the form and the views */
  warn?: (v: number | string | undefined, row: Row) => Level;
}

export interface Section {
  key: string;
  title: string;
  icon: string;
  help?: string;
  kind: 'fields' | 'table';
  fields: Field[];
  /** table: how a row is titled in the form / cards */
  titleKeys?: string[];
  maxRows?: number;
  addLabel?: string;
  /** How the department page draws it */
  view?: 'stats' | 'cards' | 'table';
  /** table: what tomorrow's blank form starts from: only the `carry` columns (default), or whole rows that are still open */
  carryMode?: 'columns' | 'open-rows';
  /** table (open-rows): a row counts as finished when this column holds one of these values */
  doneWhen?: { key: string; values: string[] };
  /** Rows used the very first time, before any report exists (names only: readings stay blank) */
  seed?: Row[];
}

export interface DeptSchema {
  slug: DeptSlug;
  label: string;
  role: string;
  icon: string;
  blurb: string;
  /** Tailwind colour families for the pages */
  accent: { ring: string; text: string; bg: string; solid: string };
  sections: Section[];
}

// ── status words → colour, shared by the form, the pages and the PDF ───────────

const TONES: Record<string, Tone> = {
  running: 'good', ok: 'good', normal: 'good', healthy: 'good', done: 'good', completed: 'good', cleared: 'good', 'auto-standby': 'info',
  standby: 'warn', medium: 'warn', open: 'warn', pending: 'warn', 'under maintenance': 'warn', 'on battery': 'warn', 'high do': 'warn',
  fault: 'bad', alert: 'bad', high: 'bad', active: 'bad', breakdown: 'bad', choked: 'bad', overflowing: 'bad', 'low do': 'bad',
  'in progress': 'info', acknowledged: 'info', low: 'muted', steady: 'muted', falling: 'muted', stopped: 'muted', off: 'muted',
};
export const statusTone = (text: string | number | undefined): Tone | undefined => TONES[String(text ?? '').toLowerCase()];

export const num = (v: Cell | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── MECHANICAL ────────────────────────────────────────────────────────────────

const equipStatus = ['Running', 'Standby', 'Under maintenance', 'Fault', 'Stopped'];
const percent = { min: 0, max: 100, step: '1' } as const;
const healthWarn = (v: Cell | undefined): Level => (typeof v === 'number' ? (v < 75 ? 'bad' : v < 90 ? 'warn' : undefined) : undefined);

export const MECHANICAL: DeptSchema = {
  slug: 'mechanical', label: 'Mechanical', role: 'Mechanical', icon: '⚙️',
  blurb: 'Pumps, blowers, clarifiers, flow meters, dissolved oxygen and maintenance work orders',
  accent: { ring: 'border-orange-200', text: 'text-orange-700', bg: 'bg-orange-50', solid: 'bg-orange-600' },
  sections: [
    {
      key: 'flows', title: 'Flow meter readings', icon: '💧', kind: 'table', view: 'cards', addLabel: 'Add flow meter', titleKeys: ['point'],
      fields: [
        { key: 'point', label: 'Flow meter', type: 'text', carry: true },
        { key: 'value', label: 'Reading', type: 'number', unit: 'MLD', max: 100, step: '0.01' },
        { key: 'time', label: 'Time', type: 'time' },
        { key: 'trend', label: 'Trend', type: 'select', options: ['Rising', 'Steady', 'Falling'] },
      ],
      seed: [{ point: 'Inlet Flow Meter' }, { point: 'Effluent Flow Meter' }, { point: 'RAS Flow' }, { point: 'WAS Flow' }],
    },
    {
      key: 'pumps', title: 'Pump station', icon: '🔄', kind: 'table', view: 'table', addLabel: 'Add pump', titleKeys: ['id', 'name'],
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'name', label: 'Pump', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'flow', label: 'Flow rate', type: 'number', unit: 'MLD', max: 100, step: '0.01' },
        { key: 'current', label: 'Current', type: 'number', unit: 'A', max: 5000, step: '0.1' },
        { key: 'hours', label: 'Run hours (total)', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
        { key: 'health', label: 'Health', type: 'number', unit: '%', bar: true, warn: healthWarn, ...percent },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: [{ id: 'P1', name: 'Inlet Pump 1' }, { id: 'P2', name: 'Inlet Pump 2' }, { id: 'P3', name: 'Inlet Pump 3' }, { id: 'SP1', name: 'Sludge Pump 1 (RAS)' }, { id: 'SP2', name: 'Sludge Pump 2 (WAS)' }],
    },
    {
      key: 'blowers', title: 'Aeration blowers', icon: '💨', kind: 'table', view: 'cards', addLabel: 'Add blower', titleKeys: ['id', 'name'],
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'name', label: 'Blower', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'airflow', label: 'Air flow', type: 'number', unit: 'm³/hr', max: 100_000, step: '1' },
        { key: 'pressure', label: 'Discharge pressure', type: 'number', unit: 'bar', max: 50, step: '0.01' },
        { key: 'temp', label: 'Bearing temperature', type: 'number', unit: '°C', max: 250, step: '1', warn: (v) => (typeof v === 'number' && v > 75 ? 'bad' : undefined) },
        { key: 'health', label: 'Health', type: 'number', unit: '%', bar: true, warn: healthWarn, ...percent },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: [{ id: 'B1', name: 'Aeration Blower 1' }, { id: 'B2', name: 'Aeration Blower 2' }, { id: 'B3', name: 'Aeration Blower 3' }],
    },
    {
      key: 'do', title: 'Dissolved oxygen - aeration tank', icon: '🫧', kind: 'table', view: 'cards', addLabel: 'Add zone', titleKeys: ['zone'],
      fields: [
        { key: 'zone', label: 'Zone', type: 'text', carry: true },
        { key: 'value', label: 'DO', type: 'number', unit: 'mg/L', max: 20, step: '0.1' },
        { key: 'status', label: 'Status', type: 'select', options: ['OK', 'Low DO', 'High DO'], status: true },
      ],
      seed: [{ zone: 'Aeration Zone 1' }, { zone: 'Aeration Zone 2' }, { zone: 'Aeration Zone 3' }, { zone: 'Aeration Zone 4' }],
    },
    {
      key: 'clarifiers', title: 'Clarifiers', icon: '🏊', kind: 'table', view: 'cards', addLabel: 'Add clarifier', titleKeys: ['name'],
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'name', label: 'Clarifier', type: 'text', carry: true },
        { key: 'blanket', label: 'Sludge blanket', type: 'number', unit: 'm', max: 20, step: '0.01' },
        { key: 'weir', label: 'Weir overflow', type: 'select', options: ['Normal', 'Choked', 'Overflowing'], status: true },
        { key: 'scraper', label: 'Scraper', type: 'select', options: ['Running', 'Stopped', 'Fault'], status: true },
        { key: 'efficiency', label: 'Removal efficiency', type: 'number', unit: '%', bar: true, ...percent },
      ],
      seed: [{ id: 'PC1', name: 'Primary Clarifier' }, { id: 'SC1', name: 'Secondary Clarifier 1' }, { id: 'SC2', name: 'Secondary Clarifier 2' }],
    },
    {
      key: 'workorders', title: 'Maintenance work orders', icon: '🔧', kind: 'table', view: 'table', addLabel: 'Add work order', titleKeys: ['id', 'title'],
      carryMode: 'open-rows', doneWhen: { key: 'status', values: ['Completed'] },
      help: 'Open work orders are carried to the next day automatically. Mark one Completed on the day it is finished.',
      fields: [
        { key: 'id', label: 'WO #', type: 'text', carry: true },
        { key: 'title', label: 'Title', type: 'text', carry: true },
        { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], status: true, carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Completed'], status: true },
        { key: 'due', label: 'Due date', type: 'date', carry: true },
        { key: 'assignee', label: 'Assignee', type: 'text', carry: true },
      ],
    },
  ],
};

// ── ELECTRICAL ────────────────────────────────────────────────────────────────

export const ELECTRICAL: DeptSchema = {
  slug: 'electrical', label: 'Electrical', role: 'Electrical', icon: '⚡',
  blurb: 'Power supply, MCC panels, DG set, UPS, energy consumption and alarms',
  accent: { ring: 'border-yellow-200', text: 'text-yellow-700', bg: 'bg-yellow-50', solid: 'bg-yellow-600' },
  sections: [
    {
      key: 'power', title: 'Main incoming - power parameters', icon: '🔌', kind: 'fields', view: 'stats',
      fields: [
        { key: 'v_r', label: 'Incoming voltage (R)', type: 'number', unit: 'V', max: 1000, step: '0.1' },
        { key: 'v_y', label: 'Incoming voltage (Y)', type: 'number', unit: 'V', max: 1000, step: '0.1' },
        { key: 'v_b', label: 'Incoming voltage (B)', type: 'number', unit: 'V', max: 1000, step: '0.1' },
        { key: 'freq', label: 'Frequency', type: 'number', unit: 'Hz', max: 70, step: '0.01' },
        { key: 'pf', label: 'Power factor', type: 'number', max: 1, step: '0.01', warn: (v) => (typeof v === 'number' && v < 0.9 ? 'warn' : undefined) },
        { key: 'load', label: 'Total load', type: 'number', unit: 'kW', max: 100_000, step: '0.1' },
      ],
    },
    {
      key: 'energy', title: 'Energy consumption', icon: '📊', kind: 'fields', view: 'stats',
      help: 'The laboratory report also holds a meter reading; enter the plant total used today here.',
      fields: [
        { key: 'units', label: 'Energy used today', type: 'number', unit: 'kWh', max: 1_000_000, step: '1' },
        { key: 'max_demand', label: 'Maximum demand', type: 'number', unit: 'kVA', max: 100_000, step: '0.1' },
      ],
    },
    {
      key: 'mcc', title: 'MCC panels', icon: '🗄', kind: 'table', view: 'cards', addLabel: 'Add panel', titleKeys: ['id', 'name'],
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'name', label: 'Panel', type: 'text', carry: true },
        { key: 'load', label: 'Total load', type: 'number', unit: 'kW', max: 100_000, step: '0.1' },
        { key: 'breakers', label: 'Breakers', type: 'number', max: 1000, step: '1', carry: true },
        { key: 'tripped', label: 'Tripped', type: 'number', max: 1000, step: '1', warn: (v) => (typeof v === 'number' && v > 0 ? 'bad' : undefined) },
        { key: 'status', label: 'Status', type: 'select', options: ['Healthy', 'Alert', 'Fault'], status: true },
      ],
      seed: [{ id: 'MCC-1', name: 'MCC 1 - Inlet Pumps' }, { id: 'MCC-2', name: 'MCC 2 - Aeration Blowers' }, { id: 'MCC-3', name: 'MCC 3 - Sludge & Misc.' }],
    },
    {
      key: 'dg', title: 'DG set', icon: '🔋', kind: 'fields', view: 'stats',
      fields: [
        { key: 'model', label: 'Model', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Auto-Standby', 'Running', 'Off', 'Fault'], status: true },
        { key: 'fuel', label: 'Fuel level', type: 'number', unit: '%', bar: true, warn: (v) => (typeof v === 'number' ? (v < 25 ? 'bad' : v < 50 ? 'warn' : undefined) : undefined), ...percent },
        { key: 'last_run', label: 'Last run', type: 'text', placeholder: 'e.g. 22 Jul 2026, 06:15 AM' },
        { key: 'duration', label: 'Run duration', type: 'text', placeholder: 'e.g. 2 hrs 20 min' },
        { key: 'hours', label: 'Total hours', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
        { key: 'next_service', label: 'Next service', type: 'text', placeholder: 'e.g. 250 hrs remaining' },
      ],
      seed: [{ model: 'Kirloskar 250 kVA' }],
    },
    {
      key: 'ups', title: 'UPS', icon: '🔌', kind: 'fields', view: 'stats',
      fields: [
        { key: 'capacity', label: 'Capacity', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Normal', 'On battery', 'Fault'], status: true },
        { key: 'battery', label: 'Battery charge', type: 'number', unit: '%', bar: true, warn: (v) => (typeof v === 'number' ? (v < 50 ? 'bad' : v < 80 ? 'warn' : undefined) : undefined), ...percent },
        { key: 'load', label: 'Current load', type: 'number', unit: 'kW', max: 1000, step: '0.1' },
        { key: 'runtime', label: 'Backup runtime', type: 'text', placeholder: 'e.g. 4 hrs 30 min' },
      ],
      seed: [{ capacity: '20 kVA' }],
    },
    {
      key: 'alarms', title: 'Alarm history - today', icon: '🚨', kind: 'table', view: 'table', addLabel: 'Add alarm', titleKeys: ['id', 'desc'],
      carryMode: 'open-rows', doneWhen: { key: 'status', values: ['Cleared'] },
      help: 'Alarms that are not Cleared are carried to the next day.',
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'time', label: 'Time', type: 'time', carry: true },
        { key: 'desc', label: 'Description', type: 'text', carry: true },
        { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High'], status: true, carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Acknowledged', 'Cleared'], status: true },
      ],
    },
  ],
};

// ── HOUSEKEEPING ──────────────────────────────────────────────────────────────

const taskFields: Field[] = [
  { key: 'area', label: 'Area', type: 'text', carry: true },
  { key: 'task', label: 'Task', type: 'text', carry: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Done', 'In Progress', 'Pending'], status: true },
  { key: 'by', label: 'Done by', type: 'text' },
];

export const HOUSEKEEPING: DeptSchema = {
  slug: 'housekeeping', label: 'Housekeeping', role: 'Housekeeping', icon: '🧹',
  blurb: 'Cleaning schedule, chemicals, sludge disposal, PPE and pest control',
  accent: { ring: 'border-green-200', text: 'text-green-700', bg: 'bg-green-50', solid: 'bg-green-600' },
  sections: [
    { key: 'morning', title: 'Morning shift (06:00-14:00)', icon: '🌅', kind: 'fields', view: 'stats', fields: [{ key: 'supervisor', label: 'Supervisor', type: 'text' }] },
    {
      key: 'morning_tasks', title: 'Morning shift - tasks', icon: '🧽', kind: 'table', view: 'table', addLabel: 'Add task', titleKeys: ['area'], fields: taskFields,
      seed: [
        { area: 'Inlet Chamber & Bar Screen', task: 'Cleaning & Debris Removal' }, { area: 'Grit Chamber', task: 'Desanding & Washing' },
        { area: 'Aeration Tank Walkway', task: 'Sweeping & Mopping' }, { area: 'Blower Room', task: 'Dusting & Oil Spill Check' },
        { area: 'Control Room', task: 'Cleaning & AC Filter' }, { area: 'Laboratory', task: 'Bench Cleaning & Waste Disposal' },
      ],
    },
    { key: 'evening', title: 'Evening shift (14:00-22:00)', icon: '🌇', kind: 'fields', view: 'stats', fields: [{ key: 'supervisor', label: 'Supervisor', type: 'text' }] },
    {
      key: 'evening_tasks', title: 'Evening shift - tasks', icon: '🧽', kind: 'table', view: 'table', addLabel: 'Add task', titleKeys: ['area'], fields: taskFields,
      seed: [
        { area: 'Effluent Outlet Area', task: 'Cleaning & Inspection' }, { area: 'Sludge Drying Beds', task: 'Turning & Levelling' },
        { area: 'Toilet Blocks (Staff)', task: 'Cleaning & Disinfection' }, { area: 'Plant Boundary & Roads', task: 'Sweeping' },
      ],
    },
    {
      key: 'chemicals', title: 'Chemical stock', icon: '🧪', kind: 'table', view: 'cards', addLabel: 'Add chemical', titleKeys: ['name'],
      fields: [
        { key: 'name', label: 'Chemical', type: 'text', carry: true },
        { key: 'unit', label: 'Unit', type: 'text', carry: true, placeholder: 'Kg / Litres' },
        { key: 'stock', label: 'Stock now', type: 'number', max: 1_000_000, step: '0.1', carry: true, warn: (v, row) => (typeof v === 'number' && typeof row.threshold === 'number' && v <= row.threshold ? 'bad' : undefined) },
        { key: 'capacity', label: 'Storage capacity', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'threshold', label: 'Reorder level', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'used', label: 'Used today', type: 'number', max: 1_000_000, step: '0.1' },
        { key: 'added_on', label: 'Last added on', type: 'date', carry: true },
      ],
      seed: [
        { name: 'Sodium Hypochlorite', unit: 'Litres', capacity: 500, threshold: 100 }, { name: 'Ferric Chloride', unit: 'Kg', capacity: 500, threshold: 100 },
        { name: 'Polyelectrolyte (Polymer)', unit: 'Kg', capacity: 200, threshold: 50 }, { name: 'Lime (Calcium Hydroxide)', unit: 'Kg', capacity: 600, threshold: 120 },
        { name: 'Alum (Aluminium Sulphate)', unit: 'Kg', capacity: 300, threshold: 75 },
      ],
    },
    {
      key: 'sludge', title: 'Sludge disposal - today', icon: '🚛', kind: 'table', view: 'table', addLabel: 'Add trip', titleKeys: ['vehicle'],
      fields: [
        { key: 'quantity', label: 'Quantity', type: 'number', unit: 'MT', max: 10_000, step: '0.1' },
        { key: 'vehicle', label: 'Vehicle no.', type: 'text' },
        { key: 'destination', label: 'Destination', type: 'text' },
        { key: 'driver', label: 'Driver', type: 'text' },
      ],
    },
    {
      key: 'ppe', title: 'PPE stock', icon: '🦺', kind: 'table', view: 'table', addLabel: 'Add item', titleKeys: ['item'],
      fields: [
        { key: 'item', label: 'Item', type: 'text', carry: true },
        { key: 'stock', label: 'In stock', type: 'number', max: 1_000_000, step: '1', carry: true, warn: (v, row) => (typeof v === 'number' && typeof row.required === 'number' && v < row.required ? 'bad' : undefined) },
        { key: 'required', label: 'Required', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'unit', label: 'Unit', type: 'text', carry: true, placeholder: 'pcs / pairs' },
      ],
      seed: [
        { item: 'Safety Helmets', unit: 'pcs' }, { item: 'Rubber Boots', unit: 'pairs' }, { item: 'Chemical-resistant Gloves', unit: 'pairs' },
        { item: 'Safety Goggles', unit: 'pcs' }, { item: 'Half-face Respirators', unit: 'pcs' }, { item: 'Reflective Vests', unit: 'pcs' },
      ],
    },
    {
      key: 'pest', title: 'Pest control', icon: '🦟', kind: 'table', view: 'table', addLabel: 'Add area', titleKeys: ['area'],
      fields: [
        { key: 'area', label: 'Area', type: 'text', carry: true },
        { key: 'type', label: 'Treatment', type: 'text', carry: true },
        { key: 'last_done', label: 'Last done', type: 'date', carry: true },
        { key: 'next_due', label: 'Next due', type: 'date', carry: true },
      ],
      seed: [{ area: 'Inlet Chamber', type: 'Mosquito Spray' }, { area: 'Sludge Beds', type: 'Fly Control' }, { area: 'Utility Rooms', type: 'Rodent Bait' }],
    },
  ],
};

export const SCHEMAS: Record<DeptSlug, DeptSchema> = { mechanical: MECHANICAL, electrical: ELECTRICAL, housekeeping: HOUSEKEEPING };

// ── helpers ───────────────────────────────────────────────────────────────────

export const REMARKS_MAX = 2000;

export function isEmptyRow(row: Row): boolean {
  return Object.values(row).every((v) => v === '' || v === undefined || v === null);
}

/** A readable one-line name for a table row */
export function rowTitle(sec: Section, row: Row, index: number): string {
  const parts = (sec.titleKeys ?? []).map((k) => String(row[k] ?? '')).filter(Boolean);
  return parts.length ? parts.join(' - ') : `${sec.addLabel?.replace(/^Add /, '') ?? 'Row'} ${index + 1}`;
}

/** Value + unit as shown on a page / in the PDF ("2.2 MLD", "Running", "-") */
export function showValue(f: Field, v: Cell | undefined): string {
  if (v === undefined || v === '') return '-';
  if (f.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('-');
  return f.unit && f.type === 'number' ? `${v} ${f.unit}` : String(v);
}

export const asRows = (v: DeptData[string]): Row[] => (Array.isArray(v) ? v : []);
export const asRow = (v: DeptData[string]): Row => (v && !Array.isArray(v) && typeof v === 'object' ? (v as Row) : {});

/**
 * The blank form for a date: whatever that day already holds; otherwise the last report's structure (names, ids,
 * capacities and any still-open rows) with the readings left empty; otherwise the department's starter rows.
 */
export function startingData(schema: DeptSchema, existing: DeptData | null, previous: DeptData | null): DeptData {
  if (existing) return existing;
  const out: DeptData = {};
  for (const sec of schema.sections) {
    const prev = previous?.[sec.key];
    if (sec.kind === 'fields') {
      const row: Row = {};
      const src = prev ? asRow(prev) : ({} as Row);
      for (const f of sec.fields) if (f.carry && src[f.key] !== undefined) row[f.key] = src[f.key];
      if (!prev && sec.seed?.[0]) Object.assign(row, sec.seed[0]);
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

/** Counts of things needing attention, for the overview cards and the PDF summary */
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
