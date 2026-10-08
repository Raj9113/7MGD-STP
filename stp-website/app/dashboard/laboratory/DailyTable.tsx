import Link from 'next/link';
import { PARAM, dayLabel, fmt, fmtFlow, lab, limitStatus, type DayRecord, type DayReport, type ParamKey } from './lab';

// Column order follows the lab team's Excel sheet
const COLS: { key: ParamKey; sides: ('in' | 'out')[] }[] = [
  { key: 'temp', sides: ['in', 'out'] },
  { key: 'ph', sides: ['in', 'out'] },
  { key: 'bod', sides: ['in', 'out'] },
  { key: 'cod', sides: ['in', 'out'] },
  { key: 'tss', sides: ['in', 'out'] },
  { key: 'phos', sides: ['in', 'out'] },
  { key: 'alk', sides: ['in', 'out'] },
  { key: 'do', sides: ['out'] },
  { key: 'tn', sides: ['in', 'out'] },
  { key: 'nh4', sides: ['in', 'out'] },
  { key: 'oil', sides: ['in', 'out'] },
];

const th = 'sticky z-10 bg-gray-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap';

interface DailyTableProps {
  month: string;
  days: DayRecord[];
  reports: Record<string, DayReport>;
  selected?: string;
}

export default function DailyTable({ month, days, reports, selected }: DailyTableProps) {
  return (
    <div className="max-h-136 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th rowSpan={2} className={`${th} left-0 top-0 z-20 text-left border-r border-b border-gray-200`}>Date</th>
            <th colSpan={2} className={`${th} top-0 h-9 border-b border-gray-200 border-l`}>Flow (MGD)</th>
            {COLS.map((c) => (
              <th key={c.key} colSpan={c.sides.length} className={`${th} top-0 h-9 border-b border-l border-gray-200`}>
                {PARAM[c.key].short}{PARAM[c.key].unit && <span className="ml-1 font-normal normal-case text-gray-400">({PARAM[c.key].unit})</span>}
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${th} top-9 border-b border-l border-gray-200 font-medium`}>Pumped</th>
            <th className={`${th} top-9 border-b border-gray-200 font-medium`}>Treated</th>
            {COLS.flatMap((c) =>
              c.sides.map((s, i) => (
                <th key={`${c.key}-${s}`} className={`${th} top-9 border-b border-gray-200 font-medium ${i === 0 ? 'border-l' : ''}`}>
                  {s === 'in' ? 'In' : 'Out'}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const isSel = d.date === selected;
            const hasReport = Boolean(reports[d.date]);
            const rowBg = isSel ? 'bg-blue-50' : 'bg-white';
            return (
              <tr key={d.date} className={`${rowBg} hover:bg-blue-50/60`}>
                <td className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-gray-100 px-3 py-2 ${rowBg}`}>
                  <Link
                    href={`?month=${month}&day=${d.date}#daily-report`}
                    scroll
                    className="font-semibold text-[#0062b8] hover:underline"
                    title={hasReport ? 'Open daily report with photos' : 'Open daily report'}
                  >
                    {dayLabel(d.date).slice(0, 6)}
                  </Link>
                  {hasReport && <span className="ml-1.5" aria-label="Photos and power reading available">📷</span>}
                </td>
                <td className="border-b border-l border-gray-100 px-3 py-2 text-center tabular-nums text-gray-700">{fmtFlow(d.flow?.pumping)}</td>
                <td className="border-b border-gray-100 px-3 py-2 text-center tabular-nums text-gray-700">{fmtFlow(d.flow?.treated)}</td>
                {COLS.flatMap((c) =>
                  c.sides.map((s, i) => {
                    const v = d[c.key]?.[s];
                    const out = s === 'out' && limitStatus(c.key, v) !== 'ok' && limitStatus(c.key, v) !== 'na';
                    return (
                      <td
                        key={`${c.key}-${s}`}
                        className={`border-b border-gray-100 px-3 py-2 text-center tabular-nums ${i === 0 ? 'border-l' : ''} ${
                          out ? 'bg-red-50 font-bold text-red-600' : s === 'in' ? 'text-gray-400' : 'text-gray-800'}`}
                        title={out ? `Above permissible limit (${lab.limits[c.key]?.max ?? ''})` : undefined}
                      >
                        {fmt(v, PARAM[c.key].decimals)}
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
          {days.length === 0 && (
            <tr>
              <td colSpan={25} className="px-6 py-10 text-center text-gray-400">No readings recorded for this month.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
