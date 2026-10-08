import { LIMITED, PARAM, fmt, fmtFlow, lab, limitText, type DayRecord, type ParamSummary } from './lab';

interface KpiProps {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone: 'blue' | 'green' | 'cyan' | 'amber';
}

const TONE: Record<KpiProps['tone'], string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
};

function Kpi({ icon, label, value, unit, hint, tone }: KpiProps) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${TONE[tone]}`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-xs font-semibold opacity-70 leading-tight">{label}</p>
      <p className="text-2xl font-bold leading-tight">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold opacity-70">{unit}</span>}
      </p>
      {hint && <p className="text-xs opacity-70">{hint}</p>}
    </div>
  );
}

interface SummaryProps {
  days: DayRecord[];
  stats: { avgTreated: number | null; avgPumping: number | null; compliantDays: number; complianceDays: number };
  summaries: Record<string, ParamSummary>;
}

export function KpiRow({ days, stats, summaries }: SummaryProps) {
  const pct = stats.complianceDays ? Math.round((stats.compliantDays / stats.complianceDays) * 100) : null;
  const removal = (k: string) => {
    const r = summaries[k]?.removal;
    return r === null || r === undefined ? '—' : r.toFixed(1);
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      <Kpi icon="💧" label="Avg treated flow" value={fmtFlow(stats.avgTreated)} unit="MGD"
        hint={`Pumped ${fmtFlow(stats.avgPumping)} MGD · ${days.length} days`} tone="blue" />
      <Kpi icon="🧫" label="BOD removal" value={removal('bod')} unit="%" hint="Inlet → outlet, monthly average" tone="green" />
      <Kpi icon="⚗️" label="COD removal" value={removal('cod')} unit="%" hint="Inlet → outlet, monthly average" tone="green" />
      <Kpi icon="🌫️" label="TSS removal" value={removal('tss')} unit="%" hint="Inlet → outlet, monthly average" tone="green" />
      <Kpi icon="✅" label="Days within all limits" value={pct === null ? '—' : `${stats.compliantDays}/${stats.complianceDays}`}
        hint={pct === null ? 'No limit data' : `${pct}% of days with readings`} tone={pct !== null && pct >= 75 ? 'cyan' : 'amber'} />
    </div>
  );
}

export function QualityCards({ summaries }: { summaries: Record<string, ParamSummary> }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {LIMITED.map((key) => {
        const s = summaries[key];
        const p = PARAM[key];
        const limit = lab.limits[key];
        const out = s?.outAvg;
        const over = limit?.max !== undefined && out !== null && out !== undefined && out > limit.max;
        const dayRatio = s && s.daysChecked ? s.daysOk / s.daysChecked : null;
        // Bar: the dashed tick marks the limit; the fill shows where the monthly average outlet sits against it.
        const fill = limit?.max && out ? Math.min(out / limit.max, 1.5) / 1.5 : 0;
        return (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-800">{p.short}</p>
                <p className="text-xs text-gray-400">{p.label}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                over ? 'border-red-200 bg-red-100 text-red-700' : out === null || out === undefined ? 'border-gray-200 bg-gray-100 text-gray-500' : 'border-green-200 bg-green-100 text-green-700'}`}>
                {out === null || out === undefined ? 'No data' : over ? 'Above limit' : 'Within limit'}
              </span>
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-800">
              {fmt(out, p.decimals + (key === 'bod' || key === 'tss' || key === 'cod' ? 1 : 0))}
              <span className="ml-1 text-sm font-medium text-gray-400">{p.unit}</span>
            </p>
            <p className="text-xs text-gray-500">Average outlet · limit {limitText(limit)} {p.unit}</p>

            {key !== 'ph' && (
              <div className="relative mt-3 h-2.5 rounded-full bg-gray-100">
                <div className={`h-2.5 rounded-full ${over ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${fill * 100}%` }} />
                <div className="absolute -top-1 h-4.5 border-l-2 border-dashed border-gray-500" style={{ left: `${(1 / 1.5) * 100}%` }} title="Permissible limit" />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                Inlet avg <b className="text-gray-700">{fmt(s?.inAvg, p.decimals)}</b>
              </span>
              {s?.removal !== null && s?.removal !== undefined && key !== 'ph' && (
                <span>Removal <b className="text-gray-700">{s.removal.toFixed(1)}%</b></span>
              )}
              <span>
                <b className={dayRatio === 1 ? 'text-green-600' : dayRatio !== null && dayRatio < 0.5 ? 'text-red-600' : 'text-amber-600'}>
                  {s?.daysOk ?? 0}/{s?.daysChecked ?? 0}
                </b>{' '}
                days OK
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
