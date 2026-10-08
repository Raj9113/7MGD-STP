import { createAdminClient } from '@/lib/supabase/admin';
import { lab, mergeLive, type LabData, type LiveRow } from './lab';

export interface LoadedLab {
  data: LabData;
  /** True when the `lab_daily` table / storage bucket has not been created yet (run supabase/lab-entry.sql) */
  setupNeeded: boolean;
}

/** Table does not exist: Postgres 42P01, or PostgREST schema-cache miss PGRST205 */
export const isMissingTable = (err: { code?: string } | null) => err?.code === '42P01' || err?.code === 'PGRST205';

/**
 * The file-based history plus every day entered on the portal. Server-only (uses the service-role key); callers must
 * already have checked that the signed-in user may view the Laboratory page.
 */
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
    return { data: mergeLive(lab, (data ?? []) as LiveRow[]), setupNeeded: false };
  } catch (err) {
    console.error('[lab] live data unavailable:', err);
    return { data: lab, setupNeeded: false };
  }
}
