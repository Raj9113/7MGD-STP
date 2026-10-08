'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { canEditDept } from '@/lib/access';
import { logActivity } from '@/lib/supabase/logger';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { DEPT_SLUGS, SCHEMAS, type DeptSlug } from '@/lib/dept-report/schema';
import { parseReport } from '@/lib/dept-report/validate';
import { isMissingTable } from '@/lib/dept-report/load';
import { todayIST } from '@/app/dashboard/laboratory/entry-fields';

export interface SaveDeptState {
  success: boolean;
  message: string;
  date?: string;
  /** keys as produced by lib/dept-report/validate.ts (section.field / section[row].field / remarks / form / date) */
  errors?: Record<string, string>;
}

const MAX_PAYLOAD = 200_000;

export async function saveDeptReport(_prev: SaveDeptState, formData: FormData): Promise<SaveDeptState> {
  try {
    const dept = String(formData.get('dept') ?? '') as DeptSlug;
    if (!DEPT_SLUGS.includes(dept)) return { success: false, message: 'Unknown department.' };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Please sign in again.' };
    const { data: profile } = await supabase.from('profiles').select('full_name, department').eq('id', user.id).single();
    if (!canEditDept(profile?.department ?? 'Unknown', dept)) {
      return { success: false, message: `Only the ${SCHEMAS[dept].label} team and Admin can enter this report.` };
    }

    const date = String(formData.get('date') ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      return { success: false, message: 'Choose a valid date.', errors: { date: 'Choose a valid date.' } };
    }
    if (date > todayIST()) return { success: false, message: 'The date cannot be in the future.', errors: { date: 'The date cannot be in the future.' } };

    const raw = String(formData.get('payload') ?? '');
    if (raw.length > MAX_PAYLOAD) return { success: false, message: 'The report is too large to save.' };
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return { success: false, message: 'The form data could not be read. Please reload the page.' }; }

    const parsed = parseReport(SCHEMAS[dept], payload);
    if (!parsed.ok) return { success: false, message: 'Please correct the highlighted fields.', errors: parsed.errors };

    const admin = createAdminClient();
    const { data: existing, error: readErr } = await admin.from('dept_daily').select('created_by, created_by_name').eq('dept', dept).eq('date', date).maybeSingle();
    if (readErr) {
      return {
        success: false,
        message: isMissingTable(readErr)
          ? 'Daily entry is not set up yet: the administrator must run supabase/dept-entry.sql in Supabase once.'
          : `Could not save: ${readErr.message}`,
      };
    }

    const who = profile?.full_name || user.email || 'Unknown';
    const { error: saveErr } = await admin.from('dept_daily').upsert(
      {
        dept, date, data: parsed.data,
        created_by: existing?.created_by ?? user.id, created_by_name: existing?.created_by_name ?? who,
        updated_by: user.id, updated_by_name: who, updated_at: new Date().toISOString(),
      },
      { onConflict: 'dept,date' },
    );
    if (saveErr) return { success: false, message: `Could not save: ${saveErr.message}` };

    await logActivity({
      userId: user.id, userName: profile?.full_name, userEmail: user.email, department: profile?.department,
      action: existing ? 'DATA_UPDATE' : 'DATA_ENTRY',
      details: `${SCHEMAS[dept].label} report ${date} ${existing ? 'updated' : 'entered'}`,
      request: { headers: await headers() },
    });

    revalidatePath(`/dashboard/${dept}`);
    revalidatePath('/dashboard');
    return { success: true, date, message: existing ? `${SCHEMAS[dept].label} report for ${date} updated.` : `${SCHEMAS[dept].label} report for ${date} saved.` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
  }
}
