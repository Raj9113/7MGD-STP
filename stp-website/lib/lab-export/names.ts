import { sheetLabel } from './excel';

export const isDate = (s: string | null): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-');

export const MAX_DAYS = 31;

export function readRange(q: URLSearchParams): { from: string; to: string } | { error: string } {
  const from = q.get('from');
  const to = q.get('to') ?? from;
  if (!isDate(from) || !isDate(to)) return { error: 'Choose a valid date or date range.' };
  if (to < from) return { error: 'The “to” date is before the “from” date.' };
  if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > MAX_DAYS) return { error: `Choose at most ${MAX_DAYS} days at a time.` };
  return { from, to };
}

export function labFileName(from: string, to: string): string {
  const lastOfMonth = `${to.slice(0, 7)}-${String(new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
  return from === to ? `Lab Report ${ddmmyyyy(from)}`
    : from.endsWith('-01') && from.slice(0, 7) === to.slice(0, 7) && to === lastOfMonth ? `${sheetLabel(from.slice(0, 7))} Lab Report`
    : `Lab Report ${ddmmyyyy(from)} to ${ddmmyyyy(to)}`;
}
