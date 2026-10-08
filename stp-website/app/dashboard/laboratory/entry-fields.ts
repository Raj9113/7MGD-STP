// Shared by the entry form (browser) and the save action (server). Pure data: no imports of the big lab-data JSON.

export type Side = 'in' | 'out';

export interface EntryField {
  key: string;
  label: string;
  unit: string;
  sides: Side[];
  step: string;
  min: number;
  max: number;
}

/** Analysis rows in the order of the printed daily report. Ranges only catch typing mistakes, they are not plant limits. */
export const ENTRY_FIELDS: EntryField[] = [
  { key: 'temp', label: 'Temperature', unit: '°C', sides: ['in', 'out'], step: '0.1', min: 0, max: 60 },
  { key: 'ph', label: 'pH', unit: '', sides: ['in', 'out'], step: '0.01', min: 0, max: 14 },
  { key: 'bod', label: 'BOD', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 2000 },
  { key: 'cod', label: 'COD', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 5000 },
  { key: 'tss', label: 'TSS', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 5000 },
  { key: 'phos', label: 'Phosphorus', unit: 'mg/l', sides: ['in', 'out'], step: '0.01', min: 0, max: 100 },
  { key: 'alk', label: 'Total Alkalinity', unit: 'mg/l', sides: ['in', 'out'], step: '1', min: 0, max: 2000 },
  { key: 'do', label: 'Dissolved Oxygen (DO)', unit: 'mg/l', sides: ['out'], step: '0.1', min: 0, max: 20 },
  { key: 'tn', label: 'Total Nitrogen (TN)', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 500 },
  { key: 'nh4', label: 'NH4-N', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 500 },
  { key: 'oil', label: 'Oil & Grease', unit: 'mg/l', sides: ['in', 'out'], step: '0.1', min: 0, max: 500 },
  { key: 'coliform', label: 'Total Coliform', unit: 'MPN/100 ml', sides: ['in', 'out'], step: '1', min: 0, max: 100000000 },
];

export const FLOW_MAX = 15; // MGD (plant design capacity is 7)
export const DEFAULT_MULTIPLIER = 2000;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // after the browser has compressed it
export const PHOTO_KINDS = ['sample', 'olms'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const PHOTO_LABEL: Record<PhotoKind, string> = {
  sample: 'Inlet & outlet sample photograph',
  olms: 'OLMS analyser display photograph',
};

export const fieldName = (key: string, side: Side) => `${key}_${side}`;

/** Today's date in India (the plant's timezone) as YYYY-MM-DD */
export function todayIST(now = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
