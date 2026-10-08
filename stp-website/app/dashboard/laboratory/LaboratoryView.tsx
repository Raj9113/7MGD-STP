import { BarChart, LineChart } from './Charts';
import DailyReport from './DailyReport';
import DailyTable from './DailyTable';
import ExportPanel from './ExportPanel';
import MonthPicker from './MonthPicker';
import Link from 'next/link';
import ReportFilters, { type ShowFilter } from './ReportFilters';
import { loadLab } from './lab-live';
import { KpiRow, QualityCards } from './Summary';
import {
  LIMITED, dailySeries, dayLabel, daysInMonth, exceedCount, getMonth, lab, mean, monthLabel, monthStats, summarize,
} from './lab';

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">{children}</h3>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const BLUE = '#0062b8';
const SLATE = '#94a3b8';
const GREEN = '#16a34a';
const AMBER = '#d97706';
const PURPLE = '#7c3aed';

export default async function LaboratoryView({
  searchParams,
  canEdit = false,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  /** Chemist / assistant / Admin: show the "add or correct a report" shortcuts */
  canEdit?: boolean;
}) {
  const { data, setupNeeded } = await loadLab();
  const MONTH_KEYS = data.months.map((m) => m.key);

  // ── Selection from the URL (?month=2026-09&day=2026-09-15) ─────────────────
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const month = getMonth(data.months, one(sp.month));
  const { days } = month;

  // Day filter for the report browser: all days, only days with photos/power (Word report), or only days above a limit
  const showParam = one(sp.show);
  const show: ShowFilter = showParam === 'photos' || showParam === 'exceed' ? showParam : 'all';
  const counts = {
    all: days.length,
    photos: days.filter((d) => data.reports[d.date]).length,
    exceed: days.filter((d) => exceedCount(d) > 0).length,
  };
  const listed = days.filter((d) => (show === 'photos' ? data.reports[d.date] : show === 'exceed' ? exceedCount(d) > 0 : true));
  const day =
    listed.find((d) => d.date === one(sp.day)) ??
    [...listed].reverse().find((d) => data.reports[d.date]) ??
    listed[listed.length - 1];

  const idx = MONTH_KEYS.indexOf(month.key);
  const days_n = daysInMonth(month.key);
  const dayNums = Array.from({ length: days_n }, (_, i) => String(i + 1));
  const stats = monthStats(days);
  const summaries = Object.fromEntries(LIMITED.concat(['nh4', 'alk', 'temp', 'oil', 'do']).map((k) => [k, summarize(days, k)]));
  const outSeries = (k: Parameters<typeof summarize>[1]) => dailySeries(month.key, days, (d) => d[k]?.out);

  // Power readings from the daily Word reports of this month
  const powerSeries = dailySeries(month.key, days, (d) => data.reports[d.date]?.power?.units);
  const powerDays = powerSeries.filter((v) => v !== null) as number[];
  const powerTotal = powerDays.reduce((a, b) => a + b, 0);
  const powerPeakIdx = powerSeries.indexOf(Math.max(...powerDays));
  const powerPeak = { value: powerSeries[powerPeakIdx] ?? 0, date: `${month.key}-${String(powerPeakIdx + 1).padStart(2, '0')}` };
  const powerPf = mean(days.map((d) => data.reports[d.date]?.power?.pf));

  // Long-term view: monthly averages across every month in the workbook
  const monthsWithData = data.months.filter((m) => m.days.length > 0);
  const trendLabels = monthsWithData.map((m) => monthLabel(m.key, 'short'));
  const monthlyOut = (k: Parameters<typeof summarize>[1]) => monthsWithData.map((m) => mean(m.days.map((d) => d[k]?.out)));

  const updated = new Date(lab.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🧪 Laboratory Department</h2>
          <p className="mt-1 text-sm text-gray-500">
            Effluent quality, daily analysis reports and sample records — 7 MGD STP Sonia Vihar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && (
            <Link
              href="/dashboard/laboratory/entry"
              id="lab-add-report-btn"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0062b8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96]"
            >
              ➕ Add / update report
            </Link>
          )}
          <MonthPicker
            months={data.months.map((m) => ({ key: m.key, label: monthLabel(m.key) }))}
            current={month.key}
            prev={MONTH_KEYS[idx - 1]}
            next={MONTH_KEYS[idx + 1]}
          />
        </div>
      </div>

      {canEdit && setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Daily entry is not set up yet</p>
          <p className="mt-1">
            The database table for new entries has not been created. Ask the administrator to run{' '}
            <code className="rounded bg-amber-100 px-1">supabase/lab-entry.sql</code> once in the Supabase SQL editor. Existing reports keep working.
          </p>
        </div>
      )}

      {days.length > 0 && (
        <ExportPanel
          key={`${month.key}-${day?.date}`}
          month={month.key}
          monthLabel={monthLabel(month.key)}
          selectedDay={day?.date}
          firstDate={data.months.find((m) => m.days.length)!.days[0].date}
          lastDate={[...data.months].reverse().find((m) => m.days.length)!.days.at(-1)!.date}
        />
      )}

      {/* Month summary */}
      <section>
        <SectionTitle hint={`${days.length} of ${days_n} days have readings`}>{monthLabel(month.key)} at a glance</SectionTitle>
        {days.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400">
            No readings recorded for {monthLabel(month.key)}.
          </div>
        ) : (
          <div className="space-y-4">
            <KpiRow days={days} stats={stats} summaries={summaries} />
            <QualityCards summaries={summaries} />
          </div>
        )}
      </section>

      {days.length > 0 && (
        <>
          {/* Charts */}
          <section>
            <SectionTitle hint="Dashed red line = permissible discharge limit">Day-by-day trends</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              <LineChart
                title="Plant flow" subtitle="Pumped vs treated" unit="MGD" decimals={3} labels={dayNums} labelEvery={days_n > 16 ? 3 : 1}
                series={[
                  { name: 'Pumped', color: SLATE, values: dailySeries(month.key, days, (d) => d.flow?.pumping) },
                  { name: 'Treated', color: BLUE, values: dailySeries(month.key, days, (d) => d.flow?.treated) },
                ]}
              />
              <LineChart
                title="Outlet BOD, TSS & Total Nitrogen" subtitle="Treated water quality (mg/l)" unit="mg/l" limit={10}
                labels={dayNums} labelEvery={days_n > 16 ? 3 : 1}
                series={[
                  { name: 'BOD', color: GREEN, values: outSeries('bod') },
                  { name: 'TSS', color: AMBER, values: outSeries('tss') },
                  { name: 'TN', color: PURPLE, values: outSeries('tn') },
                ]}
              />
              <LineChart
                title="Outlet COD" subtitle="Treated water quality (mg/l)" unit="mg/l" limit={lab.limits.cod?.max}
                labels={dayNums} labelEvery={days_n > 16 ? 3 : 1}
                series={[{ name: 'COD', color: BLUE, values: outSeries('cod') }]}
              />
              <LineChart
                title="Outlet Phosphorus" subtitle="Treated water quality (mg/l)" unit="mg/l" limit={lab.limits.phos?.max}
                labels={dayNums} labelEvery={days_n > 16 ? 3 : 1} decimals={1}
                series={[{ name: 'Phosphorus', color: PURPLE, values: outSeries('phos') }]}
              />
            </div>
          </section>

          {/* Daily readings table */}
          <section>
            <SectionTitle hint="Red cells are above the permissible limit · 📷 = report with photos">Daily readings</SectionTitle>
            <DailyTable month={month.key} days={days} reports={data.reports} selected={day?.date} />
          </section>

          {/* Daily report */}
          <section id="daily-report" className="scroll-mt-4">
            <SectionTitle hint={day ? dayLabel(day.date) : undefined}>Daily laboratory report</SectionTitle>
            <ReportFilters
              month={month.key}
              show={show}
              counts={counts}
              selected={day?.date}
              days={listed.map((d) => ({ date: d.date, hasReport: Boolean(data.reports[d.date]), exceed: exceedCount(d) }))}
            />
            {day ? (
              <DailyReport day={day} report={data.reports[day.date]} live={data.live?.[day.date]} canEdit={canEdit} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400">
                No days in {monthLabel(month.key)} match this filter.
              </div>
            )}
          </section>

          {/* Power */}
          {powerDays.length > 0 && (
            <section>
              <SectionTitle hint="From the energy-meter section of each daily report">Power consumption</SectionTitle>
              <div className="grid gap-4 lg:grid-cols-2">
                <BarChart
                  title="Daily energy use" subtitle={`${monthLabel(month.key)} · ${powerDays.length} days recorded`} unit="kWh"
                  labels={dayNums} labelEvery={days_n > 16 ? 3 : 1} values={powerSeries} color={BLUE}
                />
                <div className="grid grid-cols-2 gap-3 content-start">
                  {[
                    { label: 'Total energy', value: powerTotal.toLocaleString('en-IN'), unit: 'kWh' },
                    { label: 'Daily average', value: Math.round(powerTotal / powerDays.length).toLocaleString('en-IN'), unit: 'kWh' },
                    { label: 'Peak day', value: powerPeak.value.toLocaleString('en-IN'), unit: 'kWh', hint: dayLabel(powerPeak.date).slice(0, 6) },
                    { label: 'Average power factor', value: powerPf === null ? '—' : powerPf.toFixed(2), unit: '' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">
                      <p className="text-xs font-semibold opacity-70">{s.label}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {s.value}
                        {s.unit && <span className="ml-1 text-sm font-semibold opacity-70">{s.unit}</span>}
                      </p>
                      {s.hint && <p className="text-xs opacity-70">{s.hint}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Long-term trend */}
      <section>
        <SectionTitle hint={`Monthly averages · ${monthLabel(MONTH_KEYS[0], 'short')} – ${monthLabel(MONTH_KEYS[MONTH_KEYS.length - 1], 'short')}`}>
          Long-term performance
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineChart title="Outlet BOD" subtitle="Monthly average" unit="mg/l" limit={lab.limits.bod?.max} labels={trendLabels} labelEvery={3}
            series={[{ name: 'BOD', color: GREEN, values: monthlyOut('bod') }]} />
          <LineChart title="Outlet COD" subtitle="Monthly average" unit="mg/l" limit={lab.limits.cod?.max} labels={trendLabels} labelEvery={3}
            series={[{ name: 'COD', color: BLUE, values: monthlyOut('cod') }]} />
          <LineChart title="Outlet TSS" subtitle="Monthly average" unit="mg/l" limit={lab.limits.tss?.max} labels={trendLabels} labelEvery={3}
            series={[{ name: 'TSS', color: AMBER, values: monthlyOut('tss') }]} />
          <LineChart title="Average treated flow" subtitle="Monthly average" unit="MGD" decimals={2} labels={trendLabels} labelEvery={3}
            series={[{ name: 'Treated', color: BLUE, values: monthsWithData.map((m) => mean(m.days.map((d) => d.flow?.treated))) }]} />
        </div>
      </section>

      <p className="border-t border-gray-200 pt-4 text-xs text-gray-400">
        Source: {lab.source.xlsx} (monthly sheets) and {lab.source.docx.join(', ')} (daily reports) · data refreshed {updated}.
        Permissible limits are those printed on the daily report: pH 5.5–9.0, BOD ≤ 10, COD ≤ 50, TSS ≤ 10, Phosphorus ≤ 1, Total Nitrogen ≤ 10 (mg/l) and
        are applied to all months. Blank values were not measured that day.
      </p>
    </div>
  );
}
