import Link from 'next/link';
import {
  PARAM, dayLabel, fmt, fmtFlow, lab, limitStatus, limitText,
  type DayRecord, type DayReport, type LimitStatus, type ParamKey,
} from './lab';

// Row order follows the printed daily report
const ROWS: (ParamKey | 'flow')[] = ['flow', 'temp', 'ph', 'bod', 'cod', 'tss', 'phos', 'alk', 'do', 'tn', 'nh4', 'oil', 'coliform'];

const LABEL: Record<string, { name: string; unit: string }> = {
  flow: { name: 'Flow', unit: 'MGD' },
  coliform: { name: 'Total Coliform', unit: 'MPN/100 ml' },
  temp: { name: 'Temperature', unit: '°C' },
  ph: { name: 'pH', unit: '' },
  bod: { name: 'BOD', unit: 'mg/l' },
  cod: { name: 'COD', unit: 'mg/l' },
  tss: { name: 'TSS', unit: 'mg/l' },
  phos: { name: 'Phosphorus', unit: 'mg/l' },
  alk: { name: 'Total Alkalinity', unit: 'mg/l' },
  do: { name: 'Dissolved Oxygen (DO)', unit: 'mg/l' },
  tn: { name: 'Total Nitrogen (TN)', unit: 'mg/l' },
  nh4: { name: 'NH4-N', unit: 'mg/l' },
  oil: { name: 'Oil & Grease', unit: 'mg/l' },
};

const STATUS_STYLE: Record<LimitStatus, string> = {
  ok: 'bg-green-100 text-green-700 border-green-200',
  over: 'bg-red-100 text-red-700 border-red-200',
  under: 'bg-red-100 text-red-700 border-red-200',
  na: 'bg-gray-50 text-gray-400 border-gray-100',
};
const STATUS_TEXT: Record<LimitStatus, string> = { ok: 'Within limit', over: 'Above limit', under: 'Below limit', na: '—' };
const STATUS_ICON: Record<LimitStatus, string> = { ok: '✓', over: '▲', under: '▼', na: '—' };

function valuesOf(key: ParamKey | 'flow', d: DayRecord) {
  if (key === 'flow') return { in: d.flow?.pumping, out: d.flow?.treated };
  return { in: d[key]?.in, out: d[key]?.out };
}

function show(key: ParamKey | 'flow', v: number | null | undefined) {
  if (key === 'flow') return fmtFlow(v);
  if (key === 'coliform') return fmt(v, 0);
  return fmt(v, PARAM[key].decimals);
}

// ── Report card ──────────────────────────────────────────────────────────────

export default function DailyReport({
  day,
  report,
  live,
  canEdit = false,
}: {
  day: DayRecord;
  report?: DayReport;
  /** Set when this day was entered through the portal form */
  live?: { by: string | null; at: string };
  canEdit?: boolean;
}) {
  const over = ROWS.filter((k) => k !== 'flow' && k !== 'coliform' && ['over', 'under'].includes(limitStatus(k, valuesOf(k, day).out)));
  const power = report?.power;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#ffcc00] bg-[#0062b8] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">7 MGD STP Sonia Vihar</p>
          <h4 className="text-lg font-bold text-white">Daily Laboratory Analysis Report</h4>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-white">{dayLabel(day.date)}</p>
          {canEdit && (
            <Link href={`/dashboard/laboratory/entry?date=${day.date}`} className="text-xs font-semibold text-[#ffcc00] hover:underline">
              ✏️ Edit this day
            </Link>
          )}
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
            over.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {over.length === 0 ? '✓ All outlet limits met' : `${over.length} outlet value${over.length > 1 ? 's' : ''} above limit`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 sm:p-5 lg:grid-cols-5">
        {/* Analysis table */}
        <div className="min-w-0 lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-2 sm:pr-3">Parameter</th>
                  <th className="px-1.5 py-2 text-center sm:px-3">Limit</th>
                  <th className="px-1.5 py-2 text-right sm:px-3">Inlet</th>
                  <th className="px-1.5 py-2 text-right sm:px-3">Outlet</th>
                  <th className="py-2 pl-1.5 text-right sm:pl-3"><span className="sr-only sm:not-sr-only">Status</span></th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((key) => {
                  const v = valuesOf(key, day);
                  const status = key === 'flow' ? 'na' : limitStatus(key, v.out);
                  const meta = LABEL[key];
                  return (
                    <tr key={key} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-2 font-medium text-gray-800 sm:pr-3">
                        {meta.name}
                        {meta.unit && <span className="ml-1 text-xs font-normal text-gray-400">({meta.unit})</span>}
                      </td>
                      <td className="px-1.5 py-2 text-center text-xs text-gray-500 sm:px-3">{key === 'flow' ? '—' : limitText(lab.limits[key])}</td>
                      <td className="px-1.5 py-2 text-right tabular-nums text-gray-500 sm:px-3">{show(key, v.in)}</td>
                      <td className={`px-1.5 py-2 text-right tabular-nums font-bold sm:px-3 ${status === 'over' || status === 'under' ? 'text-red-600' : 'text-gray-800'}`}>
                        {show(key, v.out)}
                      </td>
                      <td className="py-2 pl-1.5 text-right sm:pl-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-bold sm:px-2 ${STATUS_STYLE[status]}`}
                          title={STATUS_TEXT[status]}
                        >
                          <span className="sm:hidden" aria-hidden>{STATUS_ICON[status]}</span>
                          <span className={status === 'na' ? 'hidden' : 'sr-only sm:not-sr-only'}>{STATUS_TEXT[status]}</span>
                          {status === 'na' && <span className="hidden sm:inline">—</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {live && (
            <p className="mt-3 text-xs text-gray-500">
              Entered on the portal{live.by ? ` by ${live.by}` : ''} · {new Date(live.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Inlet flow is the pumped quantity and outlet flow the treated quantity. “—” means the test was not carried out that day.
          </p>
        </div>

        {/* Photos + power */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {report ? (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Sample photographs</p>
                {report.photos.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-400">No photographs attached to this day’s report.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {report.photos.map((p) => (
                      <a key={p.src} href={p.src} target="_blank" rel="noopener noreferrer" className="group block">
                        <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                          {/* Plain <img>: the optimiser fetches without the user's session cookie, which this signed-in-only route needs */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.src}
                            alt={p.kind === 'olms' ? `OLMS analyser display, ${dayLabel(day.date)}` : `Inlet and outlet samples, ${dayLabel(day.date)}`}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 group-hover:text-[#0062b8]">
                          {p.kind === 'olms' ? 'OLMS analyser display' : 'Inlet & outlet samples'}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Power consumption</p>
                {power ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-3xl font-bold text-gray-800">
                      {power.units !== null ? power.units.toLocaleString('en-IN') : '—'}
                      <span className="ml-1 text-sm font-medium text-gray-400">kWh</span>
                    </p>
                    <p className="text-xs text-gray-500">Total units for the day · power factor <b className="text-gray-700">{fmt(power.pf, 2)}</b></p>
                    <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        ['Open', fmt(power.open, 2)],
                        ['Close', fmt(power.close, 2)],
                        ['Diff', fmt(power.diff, 2)],
                        ['× MF', power.multiplier?.toLocaleString('en-IN') ?? '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md bg-white p-2 ring-1 ring-gray-200">
                          <dt className="text-gray-400">{k}</dt>
                          <dd className="font-bold tabular-nums text-gray-800">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-xs text-gray-400">Energy meter 1 · units = difference × multiplication factor</p>
                  </div>
                ) : (
                  <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-400">No power reading recorded.</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
              <p className="text-3xl">📷</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">Photos and power reading not available</p>
              <p className="mt-1 text-xs text-gray-400">
                Only the analysis values from the monthly Excel sheet exist for this day. Photographs and the energy-meter reading come from the
                daily Word report, which has not been added for this month yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
