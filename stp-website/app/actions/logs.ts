'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  department: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
}

// ── Assert Admin ──────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  if (profile?.department !== 'Admin') {
    throw new Error('Forbidden — Admin access required.');
  }
}

// ── Get Logs ─────────────────────────────────────────────────────────────────

export interface GetLogsOptions {
  limit?: number;
  offset?: number;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetLogsResult {
  success: boolean;
  logs: ActivityLog[];
  total: number;
  message?: string;
}

export async function getLogs(options: GetLogsOptions = {}): Promise<GetLogsResult> {
  try {
    await assertAdmin();

    const admin = createAdminClient();
    const {
      limit = 50,
      offset = 0,
      action,
      userId,
      dateFrom,
      dateTo,
    } = options;

    let query = admin
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action && action !== 'ALL') {
      query = query.eq('action', action);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Add 1 day to include the full end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    const { data, count, error } = await query;

    if (error) {
      return { success: false, logs: [], total: 0, message: error.message };
    }

    return {
      success: true,
      logs: (data as ActivityLog[]) ?? [],
      total: count ?? 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, logs: [], total: 0, message };
  }
}

// ── Export to Excel ───────────────────────────────────────────────────────────

export async function exportLogsToExcel(): Promise<{
  success: boolean;
  base64?: string;
  filename?: string;
  message?: string;
}> {
  try {
    await assertAdmin();

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, message: error.message };
    }

    const logs = (data as ActivityLog[]) ?? [];

    // Format rows for Excel
    const rows = logs.map((log) => ({
      'Date & Time': log.created_at
        ? new Date(log.created_at).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '',
      'User Name': log.user_name ?? '',
      'User Email': log.user_email ?? '',
      'Department': log.department ?? '',
      'Action': log.action,
      'Details': log.details ?? '',
      'IP Address': log.ip_address ?? '',
      'City': log.city ?? '',
      'Country': log.country ?? '',
      'Device / Browser': log.user_agent ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = [
      { wch: 22 }, // Date & Time
      { wch: 20 }, // User Name
      { wch: 30 }, // User Email
      { wch: 14 }, // Department
      { wch: 14 }, // Action
      { wch: 50 }, // Details
      { wch: 16 }, // IP Address
      { wch: 16 }, // City
      { wch: 16 }, // Country
      { wch: 60 }, // Device / Browser
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');

    // Return as base64 so we can stream it from the server action to the client
    const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' }) as string;

    const now = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).replace(/ /g, '-');

    return {
      success: true,
      base64,
      filename: `7MGD-STP-Activity-Log-${now}.xlsx`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}
