import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canViewAdmin } from '@/lib/access';
import { exportLogsToExcel, type ActivityLog } from '@/app/actions/logs';
import type { Doc } from '@/lib/report-doc/model';
import { renderPdf } from '@/lib/report-doc/pdf';
import { renderDocx } from '@/lib/report-doc/docx';

const MAX_ROWS = 1000;
const MAX_BYTES = 4_300_000;

const FORMATS = {
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  pdf: { mime: 'application/pdf', ext: 'pdf' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
} as const;
type Format = keyof typeof FORMATS;

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('department, full_name').eq('id', user.id).single();
  if (!canViewAdmin(profile?.department ?? 'Unknown')) return NextResponse.json({ error: 'Only the Admin can download the activity log.' }, { status: 403 });

  const format = (new URL(request.url).searchParams.get('format') ?? 'xlsx') as Format;
  if (!(format in FORMATS)) return NextResponse.json({ error: 'Choose PDF, Word or Excel.' }, { status: 400 });

  const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
  const stamp = `${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)}`;
  const send = (bytes: Uint8Array, name: string) =>
    new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': FORMATS[format].mime, 'Content-Disposition': `attachment; filename="${name}.${FORMATS[format].ext}"`, 'Cache-Control': 'private, no-store' },
    });

  try {
    if (format === 'xlsx') {
      const res = await exportLogsToExcel();
      if (!res.success || !res.base64) return NextResponse.json({ error: res.message ?? 'Export failed.' }, { status: 500 });
      return send(Buffer.from(res.base64, 'base64'), `7MGD-STP-Activity-Log-${stamp}`);
    }

    const { data, error, count } = await createAdminClient()
      .from('activity_logs')
      .select('created_at, user_name, user_email, department, action, details', { count: 'exact' })
      .neq('action', 'PAGE_VIEW')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const logs = (data ?? []) as Pick<ActivityLog, 'created_at' | 'user_name' | 'user_email' | 'department' | 'action' | 'details'>[];

    const doc: Doc = {
      title: '7 MGD STP SONIA VIHAR - Activity Log',
      subtitle: `Newest ${logs.length} events (page views not listed)`,
      generated: `Generated ${stamp} by ${profile?.full_name || user.email || 'Admin'}`,
      chapters: [{
        name: 'Activity log',
        blocks: [
          { t: 'h1', text: 'Portal activity log' },
          ...((count ?? 0) > logs.length ? [{ t: 'note' as const, text: `Showing the newest ${logs.length} events. The Excel download holds the whole log.` }] : []),
          {
            t: 'table', head: ['Date & time (IST)', 'User', 'Department', 'Action', 'Details'], weights: [1.8, 2.4, 1.5, 1.5, 4.2],
            rows: logs.map((l) => [when(l.created_at), l.user_name || l.user_email || '-', l.department ?? '-', l.action, (l.details ?? '').slice(0, 200)]),
          },
        ],
      }],
    };

    const dir = path.join(process.cwd(), 'templates', 'report');
    const logos = { left: await readFile(path.join(dir, 'logo-left.png')), right: await readFile(path.join(dir, 'logo-right.png')) };
    const bytes = format === 'pdf' ? await renderPdf(doc, logos) : await renderDocx(doc, logos);
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'The log is too large for one file. Download the Excel version.' }, { status: 413 });
    return send(bytes, `7MGD-STP-Activity-Log-${stamp}`);
  } catch (err) {
    console.error('[activity log export]', err);
    return NextResponse.json({ error: 'Could not create the file. Please try again.' }, { status: 500 });
  }
}
