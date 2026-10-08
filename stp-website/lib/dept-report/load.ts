import { createAdminClient } from '@/lib/supabase/admin';
import type { DeptData, DeptSlug } from './schema';

/** Server-only: reads the daily department reports (table `dept_daily`). Callers must already have checked the user's role. */

export interface StoredReport {
  dept: DeptSlug;
  date: string;
  data: DeptData;
  updated_at: string;
  updated_by_name: string | null;
  created_by_name: string | null;
}

const COLUMNS = 'dept, date, data, updated_at, updated_by_name, created_by_name';
export const isMissingTable = (err: { code?: string } | null | undefined) => err?.code === '42P01' || err?.code === 'PGRST205';

export interface Loaded<T> { value: T; setupNeeded: boolean }

async function run<T>(empty: T, fn: (db: ReturnType<typeof createAdminClient>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, pick: (data: unknown) => T): Promise<Loaded<T>> {
  try {
    const { data, error } = await fn(createAdminClient());
    if (error) {
      if (!isMissingTable(error)) console.error('[dept report] read failed:', error.message);
      return { value: empty, setupNeeded: isMissingTable(error) };
    }
    return { value: pick(data), setupNeeded: false };
  } catch (err) {
    console.error('[dept report] unavailable:', err);
    return { value: empty, setupNeeded: false };
  }
}

export const loadReport = (dept: DeptSlug, date: string) =>
  run<StoredReport | null>(null, (db) => db.from('dept_daily').select(COLUMNS).eq('dept', dept).eq('date', date).maybeSingle(), (d) => (d as StoredReport | null) ?? null);

/** Dates that have a report, newest first */
export const loadDates = (dept: DeptSlug, limit = 366) =>
  run<string[]>([], (db) => db.from('dept_daily').select('date').eq('dept', dept).order('date', { ascending: false }).limit(limit), (d) => ((d as { date: string }[]) ?? []).map((r) => r.date));

/** The report just before a date (what tomorrow's blank form starts from) */
export const loadPrevious = (dept: DeptSlug, date: string) =>
  run<StoredReport | null>(null, (db) => db.from('dept_daily').select(COLUMNS).eq('dept', dept).lt('date', date).order('date', { ascending: false }).limit(1).maybeSingle(), (d) => (d as StoredReport | null) ?? null);

/** Every report of one department in a period, oldest first */
export const loadRange = (dept: DeptSlug, from: string, to: string) =>
  run<StoredReport[]>([], (db) => db.from('dept_daily').select(COLUMNS).eq('dept', dept).gte('date', from).lte('date', to).order('date', { ascending: true }), (d) => (d as StoredReport[]) ?? []);

/** All three departments in a period, as { 'mechanical|2026-09-15': report } */
export async function loadAllRange(from: string, to: string): Promise<Loaded<Map<string, StoredReport>>> {
  const out = new Map<string, StoredReport>();
  const res = await run<StoredReport[]>([], (db) => db.from('dept_daily').select(COLUMNS).gte('date', from).lte('date', to).order('date', { ascending: true }).limit(5000), (d) => (d as StoredReport[]) ?? []);
  for (const r of res.value) out.set(`${r.dept}|${r.date}`, r);
  return { value: out, setupNeeded: res.setupNeeded };
}

/** The latest report of each department on or before a date (for the overview cards) */
export async function loadLatestEach(onOrBefore: string): Promise<Partial<Record<DeptSlug, StoredReport>>> {
  const out: Partial<Record<DeptSlug, StoredReport>> = {};
  await Promise.all((['mechanical', 'electrical', 'housekeeping'] as DeptSlug[]).map(async (dept) => {
    const r = await run<StoredReport | null>(null, (db) => db.from('dept_daily').select(COLUMNS).eq('dept', dept).lte('date', onOrBefore).order('date', { ascending: false }).limit(1).maybeSingle(), (d) => (d as StoredReport | null) ?? null);
    if (r.value) out[dept] = r.value;
  }));
  return out;
}
