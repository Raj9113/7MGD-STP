'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MonthPickerProps {
  months: { key: string; label: string }[];
  current: string;
  prev?: string;
  next?: string;
}

const btn =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[#0062b8] hover:text-[#0062b8] transition-colors';
const btnOff = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed';

export default function MonthPicker({ months, current, prev, next }: MonthPickerProps) {
  const router = useRouter();
  const years = [...new Set(months.map((m) => m.key.slice(0, 4)))].reverse();

  return (
    <div className="flex items-center gap-2">
      {prev ? (
        <Link href={`?month=${prev}`} scroll={false} className={btn} aria-label="Previous month">‹</Link>
      ) : (
        <span className={btnOff} aria-hidden>‹</span>
      )}
      <select
        id="lab-month-select"
        value={current}
        onChange={(e) => router.push(`?month=${e.target.value}`, { scroll: false })}
        aria-label="Select month"
        className="h-9 min-w-40 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#0062b8]"
      >
        {years.map((y) => (
          <optgroup key={y} label={y}>
            {[...months].reverse().filter((m) => m.key.startsWith(y)).map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {next ? (
        <Link href={`?month=${next}`} scroll={false} className={btn} aria-label="Next month">›</Link>
      ) : (
        <span className={btnOff} aria-hidden>›</span>
      )}
    </div>
  );
}
