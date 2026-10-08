'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { navigate } from '@/lib/nav-pending';

export type ShowFilter = 'all' | 'photos' | 'exceed';

interface DayItem { date: string; hasReport: boolean; exceed: number }

interface ReportFiltersProps {
  month: string;
  show: ShowFilter;
  counts: Record<ShowFilter, number>;
  selected?: string;
  days: DayItem[];
}

const FILTERS: { key: ShowFilter; label: string }[] = [
  { key: 'all', label: 'All days' },
  { key: 'photos', label: '📷 With photos' },
  { key: 'exceed', label: '▲ Above a limit' },
];

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function href(month: string, day: string | undefined, show: ShowFilter) {
  const q = new URLSearchParams({ month });
  if (day) q.set('day', day);
  if (show !== 'all') q.set('show', show);
  return `?${q.toString()}#daily-report`;
}

function optionLabel(d: DayItem) {
  const [y, m, dd] = d.date.split('-').map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${String(dd).padStart(2, '0')} ${wd}${d.hasReport ? ' · 📷' : ''}${d.exceed ? ` · ▲ ${d.exceed} above limit` : ''}`;
}

const arrow =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition-colors';

export default function ReportFilters({ month, show, counts, selected, days }: ReportFiltersProps) {
  const router = useRouter();
  const i = days.findIndex((d) => d.date === selected);
  const prev = i > 0 ? days[i - 1] : undefined;
  const next = i >= 0 && i < days.length - 1 ? days[i + 1] : undefined;

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Day selector with previous / next */}
        <div className="flex items-center gap-2">
          {prev ? (
            <Link href={href(month, prev.date, show)} className={`${arrow} border-gray-200 hover:border-[#0062b8] hover:text-[#0062b8]`} aria-label="Previous day">‹</Link>
          ) : (
            <span className={`${arrow} cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300`} aria-hidden>‹</span>
          )}
          <select
            id="lab-day-select"
            aria-label="Select a day"
            value={selected ?? ''}
            disabled={days.length === 0}
            onChange={(e) => navigate(router, href(month, e.target.value, show))}
            className="h-9 min-w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#0062b8] disabled:bg-gray-50"
          >
            {days.length === 0 && <option value="">No days</option>}
            {days.map((d) => (
              <option key={d.date} value={d.date}>{optionLabel(d)}</option>
            ))}
          </select>
          {next ? (
            <Link href={href(month, next.date, show)} className={`${arrow} border-gray-200 hover:border-[#0062b8] hover:text-[#0062b8]`} aria-label="Next day">›</Link>
          ) : (
            <span className={`${arrow} cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300`} aria-hidden>›</span>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter days">
          {FILTERS.map((f) => {
            const active = show === f.key;
            return (
              <Link
                key={f.key}
                href={href(month, undefined, f.key)}
                aria-pressed={active}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                  active ? 'border-[#0062b8] bg-[#0062b8] text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-[#0062b8] hover:text-[#0062b8]'}`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{counts[f.key]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Day chips */}
      {days.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Days in this month">
          {days.map((d) => {
            const active = d.date === selected;
            return (
              <Link
                key={d.date}
                href={href(month, d.date, show)}
                role="tab"
                aria-selected={active}
                title={optionLabel(d)}
                className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                  active
                    ? 'border-[#0062b8] bg-[#0062b8] text-white'
                    : d.exceed
                      ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-400'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[#0062b8] hover:text-[#0062b8]'}`}
              >
                {Number(d.date.slice(8))}
                {d.hasReport && <span className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${active ? 'bg-[#ffcc00]' : 'bg-cyan-500'}`} />}
              </Link>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">
        Showing {days.length} of {counts.all} days · <span className="text-cyan-600">●</span> photos &amp; power reading available ·{' '}
        <span className="text-red-500">red</span> = an outlet value above its limit
      </p>
    </div>
  );
}
