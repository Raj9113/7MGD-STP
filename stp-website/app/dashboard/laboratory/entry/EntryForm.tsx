'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { saveLabEntry, type SaveLabState } from '@/app/actions/lab';
import { navigate } from '@/lib/nav-pending';
import LoadingOverlay from '../../LoadingOverlay';
import {
  DEFAULT_MULTIPLIER, ENTRY_FIELDS, MAX_PHOTO_BYTES, PHOTO_KINDS, PHOTO_LABEL, fieldName, type PhotoKind,
} from '../entry-fields';

export type EntryMeta = { kind: 'new' } | { kind: 'file' } | { kind: 'live'; by: string | null; at: string };
export interface RecentDay { date: string; state: 'complete' | 'readings' | 'missing' }

interface EntryFormProps {
  date: string;
  today: string;
  defaults: Record<string, string>;
  limits: Record<string, { min?: number; max?: number }>;
  photos: Partial<Record<PhotoKind, string>>;
  meta: EntryMeta;
  recent: RecentDay[];
  /** the logged-in user (recorded on the report automatically) */
  userName: string;
  isAdmin: boolean;
}

const INIT: SaveLabState = { success: false, message: '' };

const inputCls =
  'h-10 w-full rounded-lg border bg-white px-2 text-sm tabular-nums text-gray-800 outline-none focus:ring-2 focus:ring-[#0062b8]';

function limitText(l?: { min?: number; max?: number }) {
  if (!l) return null;
  if (l.min !== undefined && l.max !== undefined) return `${l.min} – ${l.max}`;
  return l.max !== undefined ? `≤ ${l.max}` : null;
}

function isBad(l: { min?: number; max?: number } | undefined, raw: string | undefined) {
  if (!l || raw === undefined || raw.trim() === '' || !Number.isFinite(Number(raw))) return null;
  const v = Number(raw);
  return (l.max !== undefined && v > l.max) || (l.min !== undefined && v < l.min);
}

/** Shrinks a phone photo (often 4–8 MB) to about 1600 px / a few hundred KB before upload. */
async function compress(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (blob && blob.size < file.size) return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    // unreadable format (e.g. HEIC in some browsers): send the original and let the server decide
  }
  return file;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export default function EntryForm({ date, today, defaults, limits, photos, meta, recent, userName, isAdmin }: EntryFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveLabEntry, INIT);
  const [vals, setVals] = useState<Record<string, string>>(defaults);
  const [files, setFiles] = useState<Partial<Record<PhotoKind, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<PhotoKind, string>>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  useEffect(() => {
    if (state.success) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state]);

  const set = (name: string, v: string) => setVals((p) => ({ ...p, [name]: v }));
  const err = (name: string) => state.errors?.[name];

  const { diff, units } = useMemo(() => {
    const open = parseFloat(vals.power_open ?? '');
    const close = parseFloat(vals.power_close ?? '');
    const mf = parseFloat(vals.power_multiplier ?? '') || DEFAULT_MULTIPLIER;
    if (!Number.isFinite(open) || !Number.isFinite(close) || close < open) return { diff: null, units: null };
    const d = Math.round((close - open) * 100) / 100;
    return { diff: d, units: Math.round(d * mf) };
  }, [vals.power_open, vals.power_close, vals.power_multiplier]);

  const overCount = ENTRY_FIELDS.filter((f) => f.sides.includes('out') && isBad(limits[f.key], vals[fieldName(f.key, 'out')])).length;

  async function pick(kind: PhotoKind, list: FileList | null) {
    setPhotoError(null);
    const f = list?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setPhotoError('Please choose an image file.'); return; }
    const small = await compress(f);
    if (small.size > MAX_PHOTO_BYTES) { setPhotoError(`${PHOTO_LABEL[kind]} is still too large (${(small.size / 1048576).toFixed(1)} MB). Try a smaller photo.`); return; }
    setFiles((p) => ({ ...p, [kind]: small }));
    setPreviews((p) => {
      if (p[kind]) URL.revokeObjectURL(p[kind]!);
      return { ...p, [kind]: URL.createObjectURL(small) };
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.set('date', date);
    for (const [k, v] of Object.entries(vals)) fd.set(k, v);
    for (const kind of PHOTO_KINDS) {
      const f = files[kind];
      if (f) fd.set(`photo_${kind}`, f, f.name);
    }
    startTransition(async () => {
      await formAction(fd);
      setBusy(false);
    });
  }

  const working = pending || busy;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <LoadingOverlay show={working} text="Saving laboratory report and photos…" />
      {/* Result */}
      {state.message && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${state.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          <p className="font-semibold">{state.success ? '✅' : '⚠️'} {state.message}</p>
          {state.success && (
            <p className="mt-1">
              <Link href={`/dashboard/laboratory?month=${date.slice(0, 7)}&day=${date}#daily-report`} className="font-semibold underline">
                View the report →
              </Link>
            </p>
          )}
          {!state.success && state.errors?.form && <p className="mt-1">{state.errors.form}</p>}
        </div>
      )}

      {/* Date */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <label htmlFor="lab-entry-date" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Report date</label>
            <input
              id="lab-entry-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && navigate(router, `?date=${e.target.value}`, { replace: true })}
              className={`${inputCls} mt-1 w-44 border-gray-200 font-semibold`}
            />
            {err('date') && <p className="mt-1 text-xs text-red-600">{err('date')}</p>}
          </div>
          <div>
            <p className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Prepared by</p>
            <div className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800" title="Your login name is recorded on the report automatically">
              <span aria-hidden>👤</span>
              <span className="truncate">{userName}</span>
              {isAdmin && <span className="rounded-full bg-purple-100 px-2 text-xs font-bold text-purple-700">Admin</span>}
            </div>
          </div>
          <p className="max-w-md pb-1 text-sm text-gray-500">
            {meta.kind === 'live' && <>Already entered on the portal{meta.by ? ` by ${meta.by}` : ''} · {fmtWhen(meta.at)}. Saving will update it.</>}
            {meta.kind === 'file' && <>This day comes from the monthly Excel/Word report. Saving replaces its readings; photos and power stay unless you change them.</>}
            {meta.kind === 'new' && <>No report for this date yet.</>}
          </p>
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Last 10 days">
          {recent.map((r) => (
            <Link
              key={r.date}
              href={`?date=${r.date}`}
              title={`${r.date}: ${r.state === 'complete' ? 'report with photos' : r.state === 'readings' ? 'readings only' : 'no report yet'}`}
              className={`inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold ${
                r.date === date ? 'border-[#0062b8] bg-[#0062b8] text-white' :
                r.state === 'complete' ? 'border-green-200 bg-green-50 text-green-700' :
                r.state === 'readings' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                'border-red-200 bg-red-50 text-red-600'}`}
            >
              <span className="text-sm">{Number(r.date.slice(8))}</span>
              <span className="text-[10px] font-normal">{r.state === 'complete' ? '✓' : r.state === 'readings' ? 'no 📷' : 'missing'}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Flow (MGD)</h3>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          {[['flow_pumping', 'Pumped'], ['flow_treated', 'Treated']].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-xs font-medium text-gray-600">{label}</label>
              <input id={name} type="number" step="any" inputMode="decimal" value={vals[name] ?? ''} onChange={(e) => set(name, e.target.value)}
                className={`${inputCls} mt-1 ${err(name) ? 'border-red-400' : 'border-gray-200'}`} />
              {err(name) && <p className="mt-1 text-xs text-red-600">{err(name)}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Analysis */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Laboratory analysis</h3>
          {overCount > 0 && (
            <span className="rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              ▲ {overCount} outlet value{overCount > 1 ? 's' : ''} above limit
            </span>
          )}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem_1.5rem] items-center gap-x-2 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_2rem] sm:gap-x-3">
          <span />
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Inlet</span>
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Outlet</span>
          <span />
          {ENTRY_FIELDS.map((f) => {
            const limit = limits[f.key];
            const outName = fieldName(f.key, 'out');
            const bad = isBad(limit, vals[outName]);
            return (
              <FieldRow key={f.key}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{f.label} {f.unit && <span className="text-xs font-normal text-gray-400">({f.unit})</span>}</p>
                  {limitText(limit) && <p className="text-xs text-gray-400">limit {limitText(limit)}</p>}
                </div>
                {(['in', 'out'] as const).map((side) => {
                  const name = fieldName(f.key, side);
                  if (!f.sides.includes(side)) return <span key={side} className="text-center text-xs text-gray-300">—</span>;
                  return (
                    <div key={side}>
                      <input
                        id={name}
                        aria-label={`${f.label} ${side === 'in' ? 'inlet' : 'outlet'}`}
                        type="number" step="any" inputMode="decimal"
                        value={vals[name] ?? ''}
                        onChange={(e) => set(name, e.target.value)}
                        className={`${inputCls} ${err(name) ? 'border-red-400' : side === 'out' && bad ? 'border-red-400 bg-red-50 font-bold text-red-700' : 'border-gray-200'}`}
                      />
                    </div>
                  );
                })}
                <span className={`text-center text-sm font-bold ${bad === null ? 'text-gray-300' : bad ? 'text-red-600' : 'text-green-600'}`} title={bad ? 'Above permissible limit' : bad === false ? 'Within limit' : ''}>
                  {bad === null ? '' : bad ? '▲' : '✓'}
                </span>
              </FieldRow>
            );
          })}
        </div>
        {Object.entries(state.errors ?? {}).filter(([k]) => k !== 'form' && k !== 'date' && !k.startsWith('photo_')).length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-red-600">
            {Object.entries(state.errors ?? {}).filter(([k]) => k !== 'form' && k !== 'date' && !k.startsWith('photo_')).map(([k, m]) => <li key={k}>{m}</li>)}
          </ul>
        )}
      </section>

      {/* Power */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Power consumption — energy meter 1</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['power_open', 'Open reading'], ['power_close', 'Close reading'], ['power_multiplier', 'Multiplication factor'], ['power_pf', 'Power factor']].map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-xs font-medium text-gray-600">{label}</label>
              <input id={name} type="number" step="any" inputMode="decimal" value={vals[name] ?? ''} onChange={(e) => set(name, e.target.value)}
                className={`${inputCls} mt-1 ${err(name) ? 'border-red-400' : 'border-gray-200'}`} />
              {err(name) && <p className="mt-1 text-xs text-red-600">{err(name)}</p>}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Difference <b className="text-gray-800">{diff ?? '—'}</b> × factor → total units{' '}
          <b className="text-gray-800">{units !== null ? units.toLocaleString('en-IN') : '—'} kWh</b>
          <span className="block text-xs text-gray-400">Open is pre-filled from the previous day’s close reading.</span>
        </p>
      </section>

      {/* Photos */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Photographs</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHOTO_KINDS.map((kind) => {
            const shown = previews[kind] ?? photos[kind];
            return (
              <div key={kind}>
                <p className="mb-1.5 text-sm font-medium text-gray-800">{PHOTO_LABEL[kind]}</p>
                <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
                  {shown ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shown} alt={PHOTO_LABEL[kind]} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">No photo yet</div>
                  )}
                </div>
                <label className="mt-2 inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-[#0062b8] hover:border-[#0062b8]">
                  📷 {shown ? 'Replace photo' : 'Take / choose photo'}
                  <input type="file" accept="image/*" className="sr-only" id={`photo_${kind}`} onChange={(e) => { void pick(kind, e.target.files); e.target.value = ''; }} />
                </label>
                {previews[kind] && <p className="mt-1 text-xs text-green-600">New photo ready to upload ({((files[kind]?.size ?? 0) / 1024).toFixed(0)} KB)</p>}
                {err(`photo_${kind}`) && <p className="mt-1 text-xs text-red-600">{err(`photo_${kind}`)}</p>}
              </div>
            );
          })}
        </div>
        {photoError && <p className="mt-3 text-sm text-red-600">{photoError}</p>}
        <p className="mt-3 text-xs text-gray-400">Photos are shrunk on your phone before upload and are visible only to signed-in staff.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          id="lab-entry-save-btn"
          type="submit"
          disabled={working}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0062b8] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#004f96] disabled:opacity-60"
        >
          {working ? 'Saving…' : meta.kind === 'new' ? '💾 Save report' : '💾 Update report'}
        </button>
        <Link href="/dashboard/laboratory" className="text-sm font-semibold text-gray-500 hover:text-[#0062b8]">Cancel</Link>
      </div>
    </form>
  );
}

/** Lets a row's cells take part in the parent grid without an extra wrapper box */
function FieldRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
