'use client';

import { useState } from 'react';

interface ExportPanelProps {
  month: string;
  monthLabel: string;
  /** The day currently open in the daily report */
  selectedDay?: string;
  /** Range of dates that have readings (limits the pickers) */
  firstDate: string;
  lastDate: string;
}

type Mode = 'day' | 'month' | 'range';

const MODES: { key: Mode; label: string }[] = [
  { key: 'day', label: 'This day' },
  { key: 'month', label: 'Whole month' },
  { key: 'range', label: 'Custom dates' },
];

const dateInput =
  'h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#0062b8]';

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function fetchFile(url: string): Promise<{ blob: Blob; name: string | null }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `The download failed (${res.status}).`);
  }
  return { blob: await res.blob(), name: /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? null };
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function ExportPanel({ month, monthLabel, selectedDay, firstDate, lastDate }: ExportPanelProps) {
  const [mode, setMode] = useState<Mode>(selectedDay ? 'day' : 'month');
  const [from, setFrom] = useState(selectedDay ?? `${month}-01`);
  const [to, setTo] = useState(selectedDay ?? lastDate);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState<'excel' | 'word' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const range: [string, string] =
    mode === 'day' ? [selectedDay ?? from, selectedDay ?? from] : mode === 'month' ? [`${month}-01`, monthEnd] : [from, to];
  const invalid = mode === 'range' && (!from || !to || to < from);

  async function run(kind: 'excel' | 'word') {
    setError(null);
    setBusy(kind);
    try {
      const url = kind === 'excel'
        ? `/api/lab/export/excel?month=${month}`
        : `/api/lab/export/word?from=${range[0]}&to=${range[1]}&photos=${photos ? 1 : 0}`;
      const { blob, name } = await fetchFile(url);
      save(blob, name ?? (kind === 'excel' ? `Lab Report ${month}.xlsx` : `Lab Report ${range[0]}.docx`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Download reports">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">⬇ Download reports</h3>
      <p className="mb-4 text-xs text-gray-400">Files come out in the same layout as the lab team’s Excel workbook and Word daily report.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Excel */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-800">📗 Excel — monthly sheet</p>
          <p className="mt-1 text-xs text-green-700">All days of <b>{monthLabel}</b> in the lab workbook’s sheet format, with averages.</p>
          <button
            id="lab-download-excel"
            type="button"
            onClick={() => run('excel')}
            disabled={busy !== null}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {busy === 'excel' ? 'Preparing…' : `Download ${monthLabel} (.xlsx)`}
          </button>
        </div>

        {/* Word */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-800">📘 Word — daily reports</p>
          <p className="mt-1 text-xs text-blue-700">One page per day with limits, sample photos and power reading. Choose the days:</p>

          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which days">
            {MODES.map((m) => {
              const disabled = m.key === 'day' && !selectedDay;
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={mode === m.key}
                  onClick={() => setMode(m.key)}
                  className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    mode === m.key ? 'border-[#0062b8] bg-[#0062b8] text-white' : 'border-blue-200 bg-white text-blue-700 hover:border-[#0062b8]'}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {mode === 'range' && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-gray-600">
                From
                <input type="date" id="lab-word-from" value={from} min={firstDate} max={lastDate} onChange={(e) => setFrom(e.target.value)} className={`${dateInput} mt-1 block`} />
              </label>
              <label className="text-xs font-medium text-gray-600">
                To
                <input type="date" id="lab-word-to" value={to} min={from || firstDate} max={lastDate} onChange={(e) => setTo(e.target.value)} className={`${dateInput} mt-1 block`} />
              </label>
            </div>
          )}

          <p className="mt-3 text-sm text-gray-700">
            {invalid
              ? 'Choose a valid From and To date.'
              : range[0] === range[1]
                ? <>Report for <b>{longDate(range[0])}</b></>
                : <>Reports from <b>{longDate(range[0])}</b> to <b>{longDate(range[1])}</b></>}
          </p>

          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="h-4 w-4 accent-[#0062b8]" />
            Include photographs
          </label>

          <button
            id="lab-download-word"
            type="button"
            onClick={() => run('word')}
            disabled={busy !== null || invalid}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0062b8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96] disabled:opacity-60"
          >
            {busy === 'word' ? 'Preparing…' : 'Download Word (.docx)'}
          </button>
          <p className="mt-2 text-xs text-gray-400">Up to 31 days at a time. Days without readings are skipped.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠️ {error}</p>
      )}
    </section>
  );
}
