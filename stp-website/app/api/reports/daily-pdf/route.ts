import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canViewAdmin } from '@/lib/access';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { todayIST } from '@/app/dashboard/laboratory/entry-fields';
import { parsePhotoSrc, readLabPhoto } from '@/lib/lab-export/photos';
import { loadAllRange } from '@/lib/dept-report/load';
import { buildDailyReportPdf, type ActivityRow, type DayPhotoBytes } from '@/lib/daily-report/build';

const MAX_DAYS = 31;
const MAX_BYTES = 4_300_000; // what the host can return in one response (Vercel: 4.5 MB)
const isDate = (s: string | null): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-');

/**
 * GET /api/reports/daily-pdf?from=2026-09-15&to=2026-09-15&photos=1
 *
 * Admin only. A PDF with one chapter per day: summary, laboratory (readings, photos, power), and the daily reports of the
 * Electrical, Mechanical and Housekeeping departments, then that day's portal activity.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('full_name, department').eq('id', user.id).single();
  if (!canViewAdmin(profile?.department ?? 'Unknown')) {
    return NextResponse.json({ error: 'Only the Admin can download the daily report.' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams;
  const from = q.get('from');
  const to = q.get('to') ?? from;
  if (!isDate(from) || !isDate(to)) return NextResponse.json({ error: 'Choose a valid date or date range.' }, { status: 400 });
  if (to < from) return NextResponse.json({ error: 'The “to” date is before the “from” date.' }, { status: 400 });
  if (to > todayIST()) return NextResponse.json({ error: 'The report cannot include future dates.' }, { status: 400 });
  const span = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (span > MAX_DAYS) return NextResponse.json({ error: `Choose at most ${MAX_DAYS} days at a time.` }, { status: 400 });
  const withPhotos = q.get('photos') !== '0';

  const days = Array.from({ length: span }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10));
  const { data: lab } = await loadLab();

  // Portal activity for the period (IST day boundaries)
  let activity: ActivityRow[] = [];
  try {
    const { data } = await createAdminClient()
      .from('activity_logs')
      .select('created_at, user_name, user_email, department, action, details')
      .gte('created_at', `${from}T00:00:00+05:30`)
      .lte('created_at', `${to}T23:59:59.999+05:30`)
      .order('created_at', { ascending: true })
      .limit(5000);
    activity = (data ?? []) as ActivityRow[];
  } catch (err) {
    console.error('[daily report] activity log unavailable:', err);
  }

  // Mechanical / Electrical / Housekeeping daily reports for the period
  const { value: stored } = await loadAllRange(from, to);
  const dept = new Map(
    [...stored].map(([k, r]) => [k, { data: r.data, created_by_name: r.created_by_name, updated_by_name: r.updated_by_name, updated_at: r.updated_at }]),
  );

  const photos = new Map<string, DayPhotoBytes[]>();
  if (withPhotos) {
    await Promise.all(days.map(async (d) => {
      const list: DayPhotoBytes[] = [];
      for (const p of lab.reports[d]?.photos ?? []) {
        const ref = parsePhotoSrc(p.src);
        const bytes = ref && (await readLabPhoto(ref.month, ref.file));
        if (bytes) list.push({ kind: p.kind, bytes });
      }
      if (list.length) photos.set(d, list);
    }));
  }

  const dir = path.join(process.cwd(), 'templates', 'report');
  const logos = { left: await readFile(path.join(dir, 'logo-left.png')), right: await readFile(path.join(dir, 'logo-right.png')) };
  const stamp = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
  const generated = `Generated ${stamp.slice(8, 10)}-${stamp.slice(5, 7)}-${stamp.slice(0, 4)} ${stamp.slice(11, 16)} IST by ${profile?.full_name || user.email || 'Admin'}`;

  try {
    // Photos dominate the size: step the resolution down until it fits what the host can return
    let pdf: Uint8Array | null = null;
    for (const width of withPhotos ? [1000, 700, 480] : [1000]) {
      pdf = await buildDailyReportPdf({ days, lab, dept, activity, photos, generated, logos, photoWidth: width });
      if (pdf.length <= MAX_BYTES) break;
    }
    if (!pdf || pdf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'This report is too large to download in one go. Choose fewer days, or untick photographs.' }, { status: 413 });
    }
    const name = from === to ? `Daily Plant Report ${ddmmyyyy(from)}` : `Daily Plant Report ${ddmmyyyy(from)} to ${ddmmyyyy(to)}`;
    return new NextResponse(Buffer.from(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}.pdf"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[daily report]', err);
    return NextResponse.json({ error: 'Could not create the PDF. Please try again.' }, { status: 500 });
  }
}
