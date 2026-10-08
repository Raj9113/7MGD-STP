'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { saveDeptReport, type SaveDeptState } from '@/app/actions/dept-report';
import { errorKey } from '@/lib/dept-report/validate';
import { navigate } from '@/lib/nav-pending';
import LoadingOverlay from '../LoadingOverlay';
import {
  REMARKS_MAX, SCHEMAS, asRow, asRows, rowTitle, statusTone,
  type Cell, type DeptData, type DeptSlug, type Field, type Level, type Row, type Section,
} from '@/lib/dept-report/schema';

export type EntryMeta = { kind: 'existing'; by: string | null; at: string } | { kind: 'carried'; from: string } | { kind: 'starter' };
export interface RecentDay { date: string; done: boolean }

interface Props {
  dept: DeptSlug;
  date: string;
  today: string;
  initial: DeptData;
  meta: EntryMeta;
  recent: RecentDay[];
}

type Form = Record<string, Record<string, string> | Record<string, string>[] | string>;

const INIT: SaveDeptState = { success: false, message: '' };
const WIDE = new Set(['name', 'title', 'desc', 'remarks', 'task', 'area', 'destination', 'point', 'item', 'model', 'last_run', 'next_service']);

const inputCls = 'h-10 w-full rounded-lg border bg-white px-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0062b8]';
const toStr = (v: Cell | undefined) => (v === undefined ? '' : String(v));
const rowToStr = (r: Row) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toStr(v)]));

function toForm(dept: DeptSlug, data: DeptData): Form {
  const f: Form = {};
  for (const sec of SCHEMAS[dept].sections) {
    f[sec.key] = sec.kind === 'fields' ? rowToStr(asRow(data[sec.key])) : asRows(data[sec.key]).map(rowToStr);
  }
  f.remarks = typeof data.remarks === 'string' ? data.remarks : '';
  return f;
}

const level = (f: Field, row: Record<string, string>): Level => {
  if (!f.warn) return undefined;
  const raw = row[f.key];
  const typed = f.type === 'number' ? (raw === undefined || raw === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw)) : raw;
  const typedRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v !== '' && Number.isFinite(Number(v)) ? Number(v) : v])) as Row;
  return f.warn(typed, typedRow);
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function Input({ f, value, onChange, error, warn, id }: { f: Field; value: string; onChange: (v: string) => void; error?: string; warn: Level; id: string }) {
  const border = error ? 'border-red-400' : warn === 'bad' ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : warn === 'warn' ? 'border-amber-400 bg-amber-50' : 'border-gray-200';
  const tone = f.status ? statusTone(value) : undefined;
  const statusBorder = tone === 'bad' ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : tone === 'good' ? 'border-green-300 bg-green-50' : tone === 'warn' ? 'border-amber-400 bg-amber-50' : '';
  return (
    <div className={WIDE.has(f.key) ? 'col-span-2' : ''}>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600">
        {f.label}
        {f.unit && <span className="ml-1 font-normal text-gray-400">({f.unit})</span>}
      </label>
      {f.type === 'select' ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mt-1 ${statusBorder || border}`}>
          <option value="">—</option>
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type={f.type === 'number' ? 'number' : f.type}
          {...(f.type === 'number' ? { step: 'any', inputMode: 'decimal' as const } : {})}
          placeholder={f.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} mt-1 ${border}`}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function DeptEntryForm({ dept, date, today, initial, meta, recent }: Props) {
  const schema = SCHEMAS[dept];
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveDeptReport, INIT);
  const [form, setForm] = useState<Form>(() => toForm(dept, initial));
  // unsaved changes = edits made after the version that was last submitted successfully
  const [version, setVersion] = useState(0);
  const [submittedVersion, setSubmittedVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.success) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state]);

  const dirty = version > (state.success ? submittedVersion : 0);

  const touch = (fn: (f: Form) => Form) => { setForm(fn); setVersion((v) => v + 1); };
  const setField = (sec: Section, key: string, v: string) =>
    touch((f) => ({ ...f, [sec.key]: { ...(f[sec.key] as Record<string, string>), [key]: v } }));
  const setCell = (sec: Section, i: number, key: string, v: string) =>
    touch((f) => ({ ...f, [sec.key]: (f[sec.key] as Record<string, string>[]).map((r, k) => (k === i ? { ...r, [key]: v } : r)) }));
  const addRow = (sec: Section) => touch((f) => ({ ...f, [sec.key]: [...(f[sec.key] as Record<string, string>[]), {}] }));
  const removeRow = (sec: Section, i: number) => touch((f) => ({ ...f, [sec.key]: (f[sec.key] as Record<string, string>[]).filter((_, k) => k !== i) }));

  function go(d: string) {
    if (!d || d > today) return;
    if (dirty && !window.confirm('You have unsaved changes on this form. Discard them and open another date?')) return;
    navigate(router, `?date=${d}`, { replace: true });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSubmittedVersion(version);
    const fd = new FormData();
    fd.set('dept', dept);
    fd.set('date', date);
    fd.set('payload', JSON.stringify(form));
    startTransition(async () => { await formAction(fd); setBusy(false); });
  }

  const err = (k: string) => state.errors?.[k];
  const listed = Object.entries(state.errors ?? {}).filter(([k]) => k !== 'form' && k !== 'date');
  const working = pending || busy;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <LoadingOverlay show={working} text={`Saving ${schema.label.toLowerCase()} report…`} />
      {state.message && (
        <div role="status" className={`rounded-xl border p-4 text-sm ${state.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <p className="font-semibold">{state.success ? '✅' : '⚠️'} {state.message}</p>
          {state.success && (
            <p className="mt-1">
              <Link href={`/dashboard/${dept}?date=${date}`} className="font-semibold underline">View the report →</Link>
            </p>
          )}
          {!state.success && err('form') && <p className="mt-1">{err('form')}</p>}
          {!state.success && listed.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">{listed.slice(0, 12).map(([k, m]) => <li key={k}>{m}</li>)}{listed.length > 12 && <li>…and {listed.length - 12} more</li>}</ul>
          )}
        </div>
      )}

      {/* Date + recent days */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <label htmlFor="dept-entry-date" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Report date</label>
            <input id="dept-entry-date" type="date" value={date} max={today} onChange={(e) => go(e.target.value)} className={`${inputCls} mt-1 w-44 border-gray-200 font-semibold`} />
            {err('date') && <p className="mt-1 text-xs text-red-600">{err('date')}</p>}
          </div>
          <p className="max-w-lg pb-1 text-sm text-gray-500">
            {meta.kind === 'existing' && <>Already entered{meta.by ? ` by ${meta.by}` : ''} · {when(meta.at)}. Saving will update it.</>}
            {meta.kind === 'carried' && <>New report. Equipment, names and still-open items are carried over from the report of <b>{meta.from.split('-').reverse().join('-')}</b>; fill in today’s readings.</>}
            {meta.kind === 'starter' && <>First report. The equipment lists below are a starting point: rename, add or remove rows to match your plant. They will be remembered for the next day.</>}
          </p>
        </div>
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" aria-label="Last 10 days">
          {recent.map((r) => (
            <button
              key={r.date}
              type="button"
              onClick={() => go(r.date)}
              title={`${r.date}: ${r.done ? 'report entered' : 'no report yet'}`}
              className={`inline-flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold ${
                r.date === date ? 'border-[#0062b8] bg-[#0062b8] text-white' : r.done ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}
            >
              <span className="text-sm">{Number(r.date.slice(8))}</span>
              <span className="text-[10px] font-normal">{r.done ? '✓' : 'missing'}</span>
            </button>
          ))}
        </div>
      </section>

      {schema.sections.map((sec) => (
        <section key={sec.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">{sec.icon} {sec.title}</h3>
          {sec.help && <p className="mt-1 text-xs text-gray-400">{sec.help}</p>}

          {sec.kind === 'fields' ? (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              {sec.fields.map((f) => {
                const row = form[sec.key] as Record<string, string>;
                return <Input key={f.key} id={`${sec.key}.${f.key}`} f={f} value={row[f.key] ?? ''} onChange={(v) => setField(sec, f.key, v)} error={err(errorKey(sec.key, f.key))} warn={level(f, row)} />;
              })}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {(form[sec.key] as Record<string, string>[]).length === 0 && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-400">Nothing added yet.</p>}
              {(form[sec.key] as Record<string, string>[]).map((row, i) => {
                const typed = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v])) as Row;
                return (
                  <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-gray-700">{rowTitle(sec, typed, i)}</p>
                      <button type="button" onClick={() => removeRow(sec, i)} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50" aria-label={`Remove ${rowTitle(sec, typed, i)}`}>
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {sec.fields.map((f) => (
                        <Input key={f.key} id={`${sec.key}.${i}.${f.key}`} f={f} value={row[f.key] ?? ''} onChange={(v) => setCell(sec, i, f.key, v)} error={err(errorKey(sec.key, f.key, i))} warn={level(f, row)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {err(sec.key) && <p className="text-xs text-red-600">{err(sec.key)}</p>}
              <button type="button" onClick={() => addRow(sec)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 text-sm font-semibold text-[#0062b8] hover:border-[#0062b8]">
                ➕ {sec.addLabel ?? 'Add row'}
              </button>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label htmlFor="dept-remarks" className="text-sm font-semibold uppercase tracking-widest text-gray-500">📝 Remarks / observations</label>
        <textarea
          id="dept-remarks"
          rows={4}
          maxLength={REMARKS_MAX}
          value={(form.remarks as string) ?? ''}
          onChange={(e) => touch((f) => ({ ...f, remarks: e.target.value }))}
          placeholder="Anything else worth recording today: breakdowns, visitors, instructions given, follow-ups…"
          className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0062b8]"
        />
        {err('remarks') && <p className="mt-1 text-xs text-red-600">{err('remarks')}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          id="dept-entry-save-btn"
          type="submit"
          disabled={working}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0062b8] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#004f96] disabled:opacity-60"
        >
          {working ? 'Saving…' : meta.kind === 'existing' ? '💾 Update report' : '💾 Save report'}
        </button>
        <Link href={`/dashboard/${dept}`} className="text-sm font-semibold text-gray-500 hover:text-[#0062b8]">Cancel</Link>
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
      </div>
    </form>
  );
}
