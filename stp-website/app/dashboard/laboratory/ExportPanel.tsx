'use client';

import { useState } from 'react';
import { fetchFile, saveBlob } from '@/lib/download';
import LoadingOverlay from '../LoadingOverlay';
import FormatPicker, { FORMAT_INFO, type Format } from '../FormatPicker';

interface ExportPanelProps {
  month: string;
  monthLabel: string;
  selectedDay?: string;
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

export default function ExportPanel({ month, monthLabel, selectedDay, firstDate, lastDate }: ExportPanelProps) {
  const [mode, setMode] = useState<Mode>(selectedDay ? 'day' : 'month');
  const [format, setFormat] = useState<Format>('docx');
  const [from, setFrom] = useState(selectedDay ?? `${month}-01`);
  const [to, setTo] = useState(selectedDay ?? lastDate);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const range: [string, string] =
    mode === 'day' ? [selectedDay ?? from, selectedDay ?? from] : mode === 'month' ? [`${month}-01`, monthEnd] : [from, to];
  const badDates = mode === 'range' && (!from || !to || to < from);
  const crossMonth = format === 'xlsx' && mode === 'range' && !badDates && from.slice(0, 7) !== to.slice(0, 7);
  const invalid = badDates || crossMonth;

  async function download() {
    setError(null);
    setBusy(true);
    try {
      const url =
        format === 'xlsx'
          ? mode === 'month' ? `/api/lab/export/excel?month=${month}` : `/api/lab/export/excel?from=${range[0]}&to=${range[1]}`
          : `/api/lab/export/${format === 'pdf' ? 'pdf' : 'word'}?from=${range[0]}&to=${range[1]}&photos=${photos ? 1 : 0}`;
      const { blob, name } = await fetchFile(url);
      saveBlob(blob, name ?? `Lab Report ${range[0]}${FORMAT_INFO[format].ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Download reports">
      <LoadingOverlay show={busy} text={FORMAT_INFO[format].busy} />
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">⬇ Download reports</h3>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600">Which days</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Which days">
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
        </div>

        {mode === 'range' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-gray-600">
              From
              <input type="date" id="lab-export-from" value={from} min={firstDate} max={lastDate} onChange={(e) => setFrom(e.target.value)} className={`${dateInput} mt-1 block`} />
            </label>
            <label className="text-xs font-medium text-gray-600">
              To
              <input type="date" id="lab-export-to" value={to} min={from || firstDate} max={lastDate} onChange={(e) => setTo(e.target.value)} className={`${dateInput} mt-1 block`} />
            </label>
          </div>
        )}

        <div className="mt-3">
          <FormatPicker value={format} onChange={setFormat} disabled={busy} />
        </div>

        <p className="mt-3 text-sm text-gray-700">
          {badDates
            ? 'Choose a valid From and To date.'
            : crossMonth
              ? 'An Excel sheet covers one month: choose dates inside one month, or pick Word / PDF.'
              : mode === 'month'
                ? <>Report for <b>{monthLabel}</b></>
                : range[0] === range[1]
                  ? <>Report for <b>{longDate(range[0])}</b></>
                  : <>Reports from <b>{longDate(range[0])}</b> to <b>{longDate(range[1])}</b></>}
        </p>

        {format !== 'xlsx' && (
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="h-4 w-4 accent-[#0062b8]" />
            Include photographs
          </label>
        )}

        <button
          id="lab-download"
          type="button"
          onClick={download}
          disabled={busy || invalid}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0062b8] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#004f96] disabled:opacity-60"
        >
          {busy ? 'Preparing…' : `⬇ Download ${FORMAT_INFO[format].label} (${FORMAT_INFO[format].ext})`}
        </button>
        <p className="mt-2 text-xs text-gray-400">Up to 31 days at a time. Days without readings are skipped (Excel lists every date in the sheet).</p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠️ {error}</p>
      )}
    </section>
  );
}
