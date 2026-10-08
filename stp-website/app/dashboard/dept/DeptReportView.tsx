import {
  asRow, asRows, rowTitle, showValue, statusTone,
  type Cell, type DeptData, type DeptSchema, type Field, type Level, type Row, type Section, type Tone,
} from '@/lib/dept-report/schema';

const BADGE: Record<Tone, string> = {
  good: 'bg-green-100 text-green-700 border-green-200',
  warn: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  bad: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  muted: 'bg-gray-100 text-gray-600 border-gray-200',
};

function Badge({ text }: { text: Cell | undefined }) {
  if (text === undefined || text === '') return <span className="text-gray-300">—</span>;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${BADGE[statusTone(text) ?? 'muted']}`}>{String(text)}</span>;
}

function Bar({ pct, level }: { pct: number; level: Level }) {
  const color = level === 'bad' ? 'bg-red-500' : level === 'warn' ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <span className="w-10 text-right text-xs font-semibold text-gray-600">{pct}%</span>
    </div>
  );
}

const lvl = (f: Field, row: Row): Level => f.warn?.(row[f.key], row);
const levelText: Record<'bad' | 'warn', string> = { bad: 'text-red-600', warn: 'text-amber-600' };

function Value({ f, row }: { f: Field; row: Row }) {
  const v = row[f.key];
  if (f.status) return <Badge text={v} />;
  if (f.bar && typeof v === 'number') return <Bar pct={v} level={lvl(f, row)} />;
  const l = lvl(f, row);
  return <span className={l ? `font-bold ${levelText[l]}` : 'font-semibold text-gray-800'}>{showValue(f, v)}</span>;
}

const isDone = (sec: Section, r: Row) => !!sec.doneWhen && sec.doneWhen.values.includes(String(r[sec.doneWhen.key] ?? ''));
const rowIsBad = (sec: Section, r: Row) =>
  !isDone(sec, r) && (sec.fields.some((f) => f.status && statusTone(r[f.key]) === 'bad') || sec.fields.some((f) => lvl(f, r) === 'bad'));

function SectionHead({ sec, count }: { sec: Section; count?: number }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-gray-500">
      <span>{sec.icon}</span>{sec.title}{count !== undefined && <span className="rounded-full bg-gray-100 px-2 text-xs font-bold text-gray-500">{count}</span>}
    </h3>
  );
}

function Empty({ sec }: { sec: Section }) {
  return (
    <div>
      <SectionHead sec={sec} />
      <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-400">Nothing was recorded for this section on this date.</p>
    </div>
  );
}

function Stats({ sec, row }: { sec: Section; row: Row }) {
  return (
    <div>
      <SectionHead sec={sec} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {sec.fields.filter((f) => row[f.key] !== undefined).map((f) => {
          const l = lvl(f, row);
          const tone = f.status ? statusTone(row[f.key]) : undefined;
          return (
            <div key={f.key} className={`rounded-xl border p-4 ${l === 'bad' || tone === 'bad' ? 'border-red-200 bg-red-50' : l === 'warn' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
              <p className="mb-1.5 text-xs leading-tight text-gray-500">{f.label}</p>
              {f.status || f.bar ? <Value f={f} row={row} /> : <p className={`text-xl font-bold ${l === 'bad' ? 'text-red-600' : l === 'warn' ? 'text-amber-600' : 'text-[#0062b8]'}`}>{showValue(f, row[f.key])}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cards({ sec, rows }: { sec: Section; rows: Row[] }) {
  const statusField = sec.fields.find((f) => f.status);
  const hidden = new Set([...(sec.titleKeys ?? []), statusField?.key]);
  return (
    <div>
      <SectionHead sec={sec} count={rows.length} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => {
          const bad = rowIsBad(sec, r);
          return (
            <div key={i} className={`rounded-xl border bg-white p-5 shadow-sm ${bad ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="font-bold text-gray-800">{rowTitle(sec, r, i)}</p>
                {statusField && <Badge text={r[statusField.key]} />}
              </div>
              <div className="space-y-2 text-sm">
                {sec.fields.filter((f) => !hidden.has(f.key) && r[f.key] !== undefined).map((f) => (
                  <div key={f.key} className={f.bar ? '' : 'flex items-center justify-between gap-3'}>
                    <span className="text-gray-500">{f.label}</span>
                    {f.bar ? <div className="mt-1"><Value f={f} row={r} /></div> : <span className="text-right"><Value f={f} row={r} /></span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Table({ sec, rows }: { sec: Section; rows: Row[] }) {
  return (
    <div>
      <SectionHead sec={sec} count={rows.length} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>{sec.fields.map((f) => <th key={f.key} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{f.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className={rowIsBad(sec, r) ? 'bg-red-50/60' : 'hover:bg-gray-50'}>
                {sec.fields.map((f) => <td key={f.key} className={`px-4 py-3 ${f.bar ? 'w-36' : ''}`}><Value f={f} row={r} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Draws one day's department report from its schema: stat tiles, equipment cards and tables, then the remarks. */
export default function DeptReportView({ schema, data }: { schema: DeptSchema; data: DeptData }) {
  return (
    <div className="space-y-6">
      {schema.sections.map((sec) => {
        if (sec.kind === 'fields') {
          const row = asRow(data[sec.key]);
          return Object.keys(row).length ? <Stats key={sec.key} sec={sec} row={row} /> : <Empty key={sec.key} sec={sec} />;
        }
        const rows = asRows(data[sec.key]);
        if (!rows.length) return <Empty key={sec.key} sec={sec} />;
        return sec.view === 'cards' ? <Cards key={sec.key} sec={sec} rows={rows} /> : <Table key={sec.key} sec={sec} rows={rows} />;
      })}
      {typeof data.remarks === 'string' && data.remarks && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">📝 Remarks / observations</h3>
          <p className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">{data.remarks}</p>
        </div>
      )}
    </div>
  );
}
