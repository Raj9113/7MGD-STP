import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEditLab } from '@/lib/access';
import { DEFAULT_MULTIPLIER, ENTRY_FIELDS, fieldName, todayIST } from '../entry-fields';
import { lab, type DayRecord } from '../lab';
import { loadLab } from '../lab-live';
import EntryForm, { type EntryMeta, type RecentDay } from './EntryForm';

export default async function LabEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('department, full_name').eq('id', user.id).single();
  if (!canEditLab(profile?.department ?? 'Unknown')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">Only the Laboratory team and Admin can enter lab reports.</p>
        <Link href="/dashboard/laboratory" className="mt-4 inline-block text-sm font-semibold text-[#0062b8] hover:underline">← Back to Laboratory</Link>
      </div>
    );
  }

  const today = todayIST();
  const sp = await searchParams;
  const asked = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;

  const { data, setupNeeded } = await loadLab();
  const allDays = new Map<string, DayRecord>(data.months.flatMap((m) => m.days).map((d) => [d.date, d]));
  const day = allDays.get(date);
  const report = data.reports[date];
  const live = data.live?.[date];

  // Pre-fill every input from what is already recorded for this date
  const defaults: Record<string, string> = {};
  const put = (name: string, v: number | null | undefined) => {
    if (typeof v === 'number') defaults[name] = String(v);
  };
  put('flow_pumping', day?.flow?.pumping);
  put('flow_treated', day?.flow?.treated);
  for (const f of ENTRY_FIELDS) {
    for (const side of f.sides) put(fieldName(f.key, side), (day as Record<string, { in?: number | null; out?: number | null }> | undefined)?.[f.key]?.[side]);
  }
  put('power_open', report?.power?.open);
  put('power_close', report?.power?.close);
  put('power_pf', report?.power?.pf);
  defaults.power_multiplier = String(report?.power?.multiplier ?? DEFAULT_MULTIPLIER);

  // A new day's meter "open" reading is the previous day's "close"
  if (!report?.power?.open) {
    const before = Object.values(data.reports)
      .filter((r) => r.date < date && typeof r.power?.close === 'number')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (before?.power?.close != null) defaults.power_open = String(before.power.close);
  }

  const meta: EntryMeta = live
    ? { kind: 'live', by: live.by, at: live.at }
    : day
      ? { kind: 'file' }
      : { kind: 'new' };

  // Last 10 days: which ones still need a report
  const recent: RecentDay[] = Array.from({ length: 10 }, (_, i) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - i);
    const d = t.toISOString().slice(0, 10);
    return { date: d, state: data.reports[d]?.photos.length ? 'complete' : allDays.has(d) ? 'readings' : 'missing' } as RecentDay;
  }).reverse();

  const limits = Object.fromEntries(Object.entries(lab.limits).map(([k, v]) => [k, v ?? {}]));
  const photos = {
    sample: report?.photos.find((p) => p.kind === 'sample')?.src,
    olms: report?.photos.find((p) => p.kind === 'olms')?.src,
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/laboratory" className="text-sm font-semibold text-[#0062b8] hover:underline">← Laboratory</Link>
          <h2 className="mt-1 text-2xl font-bold text-gray-800">📝 Daily lab report entry</h2>
          <p className="mt-1 text-sm text-gray-500">Enter the day’s readings, meter reading and photographs. Leave a box empty if it was not tested.</p>
        </div>
      </div>

      {setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Daily entry is not set up yet</p>
          <p className="mt-1">
            The database table and photo storage have not been created, so saving will fail. The administrator needs to run{' '}
            <code className="rounded bg-amber-100 px-1">supabase/lab-entry.sql</code> once in the Supabase SQL editor.
          </p>
        </div>
      )}

      <EntryForm
        key={date}
        date={date}
        today={today}
        defaults={defaults}
        limits={limits}
        photos={photos}
        meta={meta}
        recent={recent}
        userName={profile?.full_name || user.email || 'Unknown'}
        isAdmin={profile?.department === 'Admin'}
      />
    </div>
  );
}
