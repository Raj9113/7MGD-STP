import { createAdminClient } from '@/lib/supabase/admin';
import { asRow, num, type DeptData } from '@/lib/dept-report/schema';
import { lab, mergeLive, type LabData, type LiveRow, type PowerReading } from './lab';

export interface LoadedLab {
  data: LabData;
  setupNeeded: boolean;
}

export const isMissingTable = (err: { code?: string } | null) => err?.code === '42P01' || err?.code === 'PGRST205';

export function meterReading(data: DeptData): PowerReading | null {
  const m = asRow(data.meter);
  const open = num(m.open), close = num(m.close);
  if (open === null || close === null) return null;
  const mainPf = num(asRow(data.power).pf);
  return { open, close, diff: num(m.diff), multiplier: num(m.multiplier), units: num(m.units), pf: num(m.pf) ?? mainPf };
}

export async function loadLab(): Promise<LoadedLab> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('lab_daily')
      .select('date, readings, power, photos, updated_at, updated_by_name')
      .order('date', { ascending: true });

    if (error) {
      if (!isMissingTable(error)) console.error('[lab] could not read lab_daily:', error.message);
      return { data: lab, setupNeeded: isMissingTable(error) };
    }
    const merged = mergeLive(lab, (data ?? []) as LiveRow[]);

    const { data: electrical, error: elError } = await admin.from('dept_daily').select('date, data').eq('dept', 'electrical').limit(5000);
    if (elError && !isMissingTable(elError)) console.error('[lab] could not read electrical meter readings:', elError.message);
    for (const row of (electrical ?? []) as { date: string; data: DeptData }[]) {
      const power = meterReading(row.data);
      if (!power) continue;
      const old = merged.reports[row.date];
      merged.reports[row.date] = { date: row.date, photos: old?.photos ?? [], ...(old?.lab ? { lab: old.lab } : {}), power };
    }
    return { data: merged, setupNeeded: false };
  } catch (err) {
    console.error('[lab] live data unavailable:', err);
    return { data: lab, setupNeeded: false };
  }
}
