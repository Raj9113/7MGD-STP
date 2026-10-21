import type { Cell, Field, Level, Row, Section } from '../schema';

/**
 * Building blocks shared by the Mechanical, Electrical and Housekeeping reports. Types only are imported from ../schema
 * (no runtime import), so schema.ts can import the department definitions without a cycle.
 */

export const equipStatus = ['Running', 'Standby', 'Under maintenance', 'Fault', 'Stopped'];
export const percent = { min: 0, max: 100, step: '1' } as const;

/** A number above `limit` is flagged (red by default) */
export const above = (limit: number, level: 'bad' | 'warn' = 'bad') => (v: Cell | undefined): Level => (typeof v === 'number' && v > limit ? level : undefined);

/** Bearing / winding temperature: red above the limit */
export const hot = (limit: number) => above(limit);

/** Vibration velocity (mm/s RMS), ISO 10816 style: amber above 4.5, red above 7.1 */
export const vibration = (v: Cell | undefined): Level => (typeof v === 'number' ? (v > 7.1 ? 'bad' : v > 4.5 ? 'warn' : undefined) : undefined);

/** A task / equipment row marked on the day: name carried, status picked */
export const equipFields: Field[] = [
  { key: 'name', label: 'Equipment', type: 'text', carry: true },
  { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
  { key: 'current', label: 'Current', type: 'number', unit: 'A', max: 5000, step: '0.1' },
  { key: 'hours', label: 'Run hours', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
  { key: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Noisy', 'Leaking', 'Damaged'], status: true },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

export const names = (list: string[]): Row[] => list.map((name) => ({ name }));

/** Preventive maintenance list: what is done, how often, last done and next due */
export const pmSection = (seed: Row[]): Section => ({
  key: 'pm', title: 'Preventive maintenance schedule', icon: '🗓', kind: 'table', view: 'table', addLabel: 'Add task', titleKeys: ['equipment', 'task'],
  help: 'The list stays from day to day. Mark Done on the day a task is carried out and update Last done / Next due.',
  fields: [
    { key: 'equipment', label: 'Equipment', type: 'text', carry: true },
    { key: 'task', label: 'Maintenance task', type: 'text', carry: true },
    { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly'], carry: true },
    { key: 'last_done', label: 'Last done', type: 'date', carry: true },
    { key: 'next_due', label: 'Next due', type: 'date', carry: true },
    { key: 'status', label: 'Today', type: 'select', options: ['Done', 'Pending', 'Not due'], status: true },
    { key: 'by', label: 'Done by', type: 'text' },
  ],
  seed,
});

/** Breakdowns, corrective jobs and other work orders; open ones carry over to the next day */
export const workOrderSection = (): Section => ({
  key: 'workorders', title: 'Breakdown & work orders', icon: '🔧', kind: 'table', view: 'table', addLabel: 'Add work order', titleKeys: ['id', 'title'],
  carryMode: 'open-rows', doneWhen: { key: 'status', values: ['Completed'] },
  help: 'Open work orders are carried to the next day automatically. Mark one Completed on the day it is finished.',
  fields: [
    { key: 'id', label: 'WO #', type: 'text', carry: true },
    { key: 'equipment', label: 'Equipment', type: 'text', carry: true },
    { key: 'title', label: 'Problem / job', type: 'text', carry: true },
    { key: 'type', label: 'Type', type: 'select', options: ['Breakdown', 'Corrective', 'Preventive', 'Modification'], carry: true },
    { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], status: true, carry: true },
    { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Completed'], status: true },
    { key: 'reported', label: 'Reported on', type: 'date', carry: true },
    { key: 'downtime', label: 'Downtime', type: 'number', unit: 'hrs', max: 10_000, step: '0.1' },
    { key: 'assignee', label: 'Assigned to', type: 'text', carry: true },
  ],
});

/** Spares and consumables with a reorder level */
export const sparesSection = (seed: Row[]): Section => ({
  key: 'spares', title: 'Spares & consumables', icon: '📦', kind: 'table', view: 'table', addLabel: 'Add item', titleKeys: ['item'],
  help: 'Stock turns red at or below the reorder level.',
  fields: [
    { key: 'item', label: 'Item', type: 'text', carry: true },
    { key: 'unit', label: 'Unit', type: 'text', carry: true, placeholder: 'nos / litres / kg' },
    { key: 'stock', label: 'In stock', type: 'number', max: 1_000_000, step: '1', carry: true, warn: (v, row) => (typeof v === 'number' && typeof row.minimum === 'number' && v <= row.minimum ? 'bad' : undefined) },
    { key: 'minimum', label: 'Reorder level', type: 'number', max: 1_000_000, step: '1', carry: true },
    { key: 'used', label: 'Used today', type: 'number', max: 1_000_000, step: '1' },
    { key: 'added_on', label: 'Last added on', type: 'date', carry: true },
  ],
  seed,
});
