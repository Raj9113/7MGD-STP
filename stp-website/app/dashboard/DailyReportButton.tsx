'use client';

import { useState } from 'react';
import { fetchFile, saveBlob } from '@/lib/download';

type Mode = 'day' | 'range';

const dateInput =
  'h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#0062b8]';

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Admin-only: opens a small panel to pick a date or a custom range and downloads the all-department daily report as a PDF. */
export default function DailyReportButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('day');
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range: [string, string] = mode === 'day' ? [day, day] : [from, to];
  const invalid = !range[0] || !range[1] || range[1] < range[0] || range[1] > today;

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const { blob, name } = await fetchFile(`/api/reports/daily-pdf?from=${range[0]}&to=${range[1]}&photos=${photos ? 1 : 0}`);
      saveBlob(blob, name ?? `Daily Plant Report ${range[0]}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Daily report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-800">📄 Daily plant report</p>
          <p className="text-xs text-gray-500">All departments in one PDF: laboratory, electrical, mechanical, housekeeping and portal activity.</p>
        </div>
        <button
          id="daily-report-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0062b8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96]"
        >
          📄 Daily Report (PDF) <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
      </div>

      {open && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose dates">
            {([['day', 'Particular date'], ['range', 'Custom range']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                  mode === key ? 'border-[#0062b8] bg-[#0062b8] text-white' : 'border-blue-200 bg-white text-blue-700 hover:border-[#0062b8]'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            {mode === 'day' ? (
              <label className="text-xs font-medium text-gray-600">
                Date
                <input id="daily-report-date" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={`${dateInput} mt-1 block`} />
              </label>
            ) : (
              <>
                <label className="text-xs font-medium text-gray-600">
                  From
                  <input id="daily-report-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className={`${dateInput} mt-1 block`} />
                </label>
                <label className="text-xs font-medium text-gray-600">
                  To
                  <input id="daily-report-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className={`${dateInput} mt-1 block`} />
                </label>
              </>
            )}
          </div>

          <p className="mt-3 text-sm text-gray-700">
            {invalid
              ? 'Choose valid dates (not in the future).'
              : range[0] === range[1]
                ? <>Report for <b>{longDate(range[0])}</b></>
                : <>One report per day from <b>{longDate(range[0])}</b> to <b>{longDate(range[1])}</b></>}
          </p>

          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="h-4 w-4 accent-[#0062b8]" />
            Include laboratory photographs
          </label>

          <button
            id="daily-report-download"
            type="button"
            onClick={download}
            disabled={busy || invalid}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0062b8] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96] disabled:opacity-60"
          >
            {busy ? 'Preparing PDF…' : '⬇ Download PDF'}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Up to 31 days at a time. Each day has its own pages. A department that did not enter a report for a date shows
            <b> “No report entered”</b> for that day.
          </p>
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {error}</p>}
        </div>
      )}
    </section>
  );
}
