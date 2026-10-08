'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DateSelectProps {
  base: string;
  /** dates that have a report, newest first */
  dates: string[];
  current?: string;
}

const label = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

const btn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition-colors';

export default function DateSelect({ base, dates, current }: DateSelectProps) {
  const router = useRouter();
  const i = current ? dates.indexOf(current) : -1;
  const older = i >= 0 ? dates[i + 1] : undefined;
  const newer = i > 0 ? dates[i - 1] : undefined;

  return (
    <div className="flex items-center gap-2">
      {older ? (
        <Link href={`${base}?date=${older}`} className={`${btn} border-gray-200 hover:border-[#0062b8] hover:text-[#0062b8]`} aria-label="Previous report">‹</Link>
      ) : (
        <span className={`${btn} cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300`} aria-hidden>‹</span>
      )}
      <select
        id="dept-date-select"
        aria-label="Choose report date"
        value={current ?? ''}
        onChange={(e) => router.push(`${base}?date=${e.target.value}`)}
        className="h-9 min-w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#0062b8]"
      >
        {dates.map((d) => <option key={d} value={d}>{label(d)}</option>)}
      </select>
      {newer ? (
        <Link href={`${base}?date=${newer}`} className={`${btn} border-gray-200 hover:border-[#0062b8] hover:text-[#0062b8]`} aria-label="Next report">›</Link>
      ) : (
        <span className={`${btn} cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300`} aria-hidden>›</span>
      )}
    </div>
  );
}
