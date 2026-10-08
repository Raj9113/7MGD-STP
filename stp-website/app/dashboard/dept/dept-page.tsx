import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canEditDept, canViewDept } from '@/lib/access';
import { SCHEMAS, asRow, attention, num, type DeptSlug } from '@/lib/dept-report/schema';
import { loadDates, loadRange, loadReport } from '@/lib/dept-report/load';
import LiveCamera from '../LiveCamera';
import DateSelect from './DateSelect';
import DeptReportView from './DeptReportView';
import type { SearchParams } from './entry-page';

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** Energy used over the 14 days up to a date (Electrical) */
async function EnergyTrend({ date }: { date: string }) {
  const from = new Date(`${date}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 13);
  const { value } = await loadRange('electrical', from.toISOString().slice(0, 10), date);
  const points = value.map((r) => ({ date: r.date, units: num(asRow(r.data.energy).units) })).filter((p): p is { date: string; units: number } => p.units !== null);
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.units));
  const total = points.reduce((a, p) => a + p.units, 0);
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">📈 Energy consumption (kWh) - last 14 days</h3>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex h-40 items-end gap-2">
          {points.map((p) => (
            <div key={p.date} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-[#0062b8]">{p.units}</span>
              <div className="flex w-full items-end" style={{ height: '100px' }}>
                <div className={`w-full rounded-t-md ${p.date === date ? 'bg-[#ffcc00]' : 'bg-[#0062b8]'}`} style={{ height: `${Math.round((p.units / max) * 100)}%` }} title={`${p.date}: ${p.units} kWh`} />
              </div>
              <span className="text-[10px] text-gray-500">{Number(p.date.slice(8))}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-500">
          Total of {points.length} reported days: <b className="text-gray-800">{total.toLocaleString('en-IN')} kWh</b> · average <b className="text-gray-800">{Math.round(total / points.length).toLocaleString('en-IN')} kWh/day</b>
        </p>
      </div>
    </div>
  );
}

/** A department page: the chosen day's report drawn from its schema, with date navigation and an entry button. */
export default async function DeptPage({ dept, searchParams }: { dept: DeptSlug; searchParams: SearchParams }) {
  const schema = SCHEMAS[dept];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('department').eq('id', user.id).single();
  const role = profile?.department ?? 'Unknown';

  if (!canViewDept(role, dept)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view the {schema.label} department page.</p>
      </div>
    );
  }

  const canEdit = canEditDept(role, dept);
  const sp = await searchParams;
  const asked = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const { value: dates, setupNeeded } = await loadDates(dept);
  const date = asked && dates.includes(asked) ? asked : dates[0];
  const report = date ? (await loadReport(dept, date)).value : null;
  const attn = attention(schema, report?.data ?? null);
  const entryHref = `/dashboard/${dept}/entry${date ? `?date=${date}` : ''}`;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{schema.icon} {schema.label} Department</h2>
          <p className="mt-0.5 text-sm text-gray-500">{schema.blurb} — 7 MGD STP Sonia Vihar</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <>
              <Link href={`/dashboard/${dept}/entry`} id="dept-add-report-btn" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0062b8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96]">
                ➕ Today’s report
              </Link>
              {date && <Link href={entryHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-[#0062b8] hover:border-[#0062b8]">✏️ Edit this day</Link>}
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">👁 Read-only View</div>
          )}
          {dates.length > 0 && <DateSelect base={`/dashboard/${dept}`} dates={dates} current={date} />}
        </div>
      </div>

      {canEdit && setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Daily entry is not set up yet</p>
          <p className="mt-1">Ask the administrator to run <code className="rounded bg-amber-100 px-1">supabase/dept-entry.sql</code> once in the Supabase SQL editor.</p>
        </div>
      )}

      <LiveCamera />

      {!report || !date ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-4xl">📋</p>
          <p className="mt-2 text-lg font-bold text-gray-700">No {schema.label.toLowerCase()} reports yet</p>
          <p className="mt-1 text-sm text-gray-500">{canEdit ? 'Enter the first daily report to start tracking.' : `The ${schema.label} team has not entered a report yet.`}</p>
          {canEdit && <Link href={`/dashboard/${dept}/entry`} className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0062b8] px-5 text-sm font-semibold text-white hover:bg-[#004f96]">➕ Enter today’s report</Link>}
        </div>
      ) : (
        <>
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm ${schema.accent.ring}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Report for</p>
              <p className="text-lg font-bold text-gray-800">{longDate(date)}</p>
            </div>
            <p className="text-xs text-gray-500">Entered by <b>{report.created_by_name ?? '—'}</b>{report.updated_by_name && report.updated_by_name !== report.created_by_name ? ` · updated by ${report.updated_by_name}` : ''} · {when(report.updated_at)}</p>
          </div>

          {attn.alerts > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-bold">🚨 {attn.alerts} item{attn.alerts > 1 ? 's' : ''} need attention</p>
              <p className="mt-1">{attn.notes.join(' · ')}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">✅ Nothing flagged in this report.</div>
          )}

          <DeptReportView schema={schema} data={report.data} />
          {dept === 'electrical' && <EnergyTrend date={date} />}
        </>
      )}
    </div>
  );
}

