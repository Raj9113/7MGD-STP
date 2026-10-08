import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEditDept } from '@/lib/access';
import { todayIST } from '@/app/dashboard/laboratory/entry-fields';
import { SCHEMAS, startingData, type DeptSlug } from '@/lib/dept-report/schema';
import { loadDates, loadPrevious, loadReport } from '@/lib/dept-report/load';
import DeptEntryForm, { type EntryMeta, type RecentDay } from './DeptEntryForm';

export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** The daily entry form of one department (shared by /dashboard/{mechanical,electrical,housekeeping}/entry). */
export default async function DeptEntryPage({ dept, searchParams }: { dept: DeptSlug; searchParams: SearchParams }) {
  const schema = SCHEMAS[dept];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('department, full_name').eq('id', user.id).single();

  if (!canEditDept(profile?.department ?? 'Unknown', dept)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">Only the {schema.label} team and Admin can enter this report.</p>
        <Link href={`/dashboard/${dept}`} className="mt-4 inline-block text-sm font-semibold text-[#0062b8] hover:underline">← Back to {schema.label}</Link>
      </div>
    );
  }

  const today = todayIST();
  const sp = await searchParams;
  const asked = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;

  const [{ value: report, setupNeeded }, { value: previous }, { value: dates }] = await Promise.all([loadReport(dept, date), loadPrevious(dept, date), loadDates(dept)]);

  const userName = profile?.full_name || user.email || 'Unknown';
  const isAdmin = profile?.department === 'Admin';
  const initial = startingData(schema, report?.data ?? null, previous?.data ?? null);
  const meta: EntryMeta = report ? { kind: 'existing', by: report.updated_by_name, at: report.updated_at } : previous ? { kind: 'carried', from: previous.date } : { kind: 'starter' };
  const have = new Set(dates);
  const recent: RecentDay[] = Array.from({ length: 10 }, (_, i) => {
    const t = new Date(`${today}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() - i);
    const d = t.toISOString().slice(0, 10);
    return { date: d, done: have.has(d) };
  }).reverse();

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href={`/dashboard/${dept}`} className="text-sm font-semibold text-[#0062b8] hover:underline">← {schema.label}</Link>
        <h2 className="mt-1 text-2xl font-bold text-gray-800">📝 {schema.label} daily report entry</h2>
        <p className="mt-1 text-sm text-gray-500">Record today’s status and readings. Leave a box empty if it was not checked.</p>
      </div>

      {setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Daily entry is not set up yet</p>
          <p className="mt-1">
            The database table for these reports has not been created, so saving will fail. The administrator needs to run{' '}
            <code className="rounded bg-amber-100 px-1">supabase/dept-entry.sql</code> once in the Supabase SQL editor.
          </p>
        </div>
      )}

      <DeptEntryForm key={date} dept={dept} date={date} today={today} initial={initial} meta={meta} recent={recent} userName={userName} isAdmin={isAdmin} />
    </div>
  );
}
