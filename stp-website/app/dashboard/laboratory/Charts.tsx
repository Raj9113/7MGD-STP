// Small dependency-free SVG charts (server-rendered). Gaps in the data (null) break the line instead of faking a value.

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
}

interface ChartProps {
  title: string;
  subtitle?: string;
  unit?: string;
  labels: string[];
  series: Series[];
  /** Permissible limit drawn as a dashed red line */
  limit?: number;
  /** Show every n-th x label */
  labelEvery?: number;
  decimals?: number;
}

const W = 640;
const H = 230;
const PAD = { l: 44, r: 14, t: 14, b: 30 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function tickLabel(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 2 : 1);
}

function Legend({ series, limit }: { series: Series[]; limit?: number }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {series.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
      {limit !== undefined && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500" />
          Limit {limit}
        </span>
      )}
    </div>
  );
}

function Frame({ title, subtitle, children, legend }: { title: string; subtitle?: string; children: React.ReactNode; legend: React.ReactNode }) {
  return (
    <figure className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <figcaption className="mb-2">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </figcaption>
      {children}
      <div className="mt-2">{legend}</div>
    </figure>
  );
}

export function LineChart({ title, subtitle, unit = '', labels, series, limit, labelEvery = 1, decimals = 1 }: ChartProps) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const hasData = all.length > 0;
  const top = niceMax(Math.max(...all, limit ?? 0, 0) * 1.08);
  const x = (i: number) => PAD.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);

  return (
    <Frame title={title} subtitle={subtitle} legend={<Legend series={series} limit={limit} />}>
      {!hasData ? (
        <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">No readings for this period</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#9ca3af">{tickLabel(t)}</text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#9ca3af">{l}</text>
            ) : null,
          )}
          {limit !== undefined && (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(limit)} y2={y(limit)} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 4" />
            </g>
          )}
          {series.map((s) => {
            // Split into continuous runs so missing days leave a gap
            const runs: { i: number; v: number }[][] = [];
            s.values.forEach((v, i) => {
              if (v === null) { runs.push([]); return; }
              if (!runs.length) runs.push([]);
              runs[runs.length - 1].push({ i, v });
            });
            return (
              <g key={s.name}>
                {runs.filter((r) => r.length > 1).map((r, k) => (
                  <polyline key={k} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                    points={r.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} />
                ))}
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <circle key={i} cx={x(i)} cy={y(v)} r={labels.length > 40 ? 2.5 : 3} fill="#fff" stroke={s.color} strokeWidth={2}>
                      <title>{`${s.name} · ${labels[i]}: ${v.toLocaleString('en-IN', { maximumFractionDigits: decimals })}${unit ? ' ' + unit : ''}`}</title>
                    </circle>
                  ),
                )}
              </g>
            );
          })}
        </svg>
      )}
    </Frame>
  );
}

interface BarChartProps {
  title: string;
  subtitle?: string;
  unit?: string;
  labels: string[];
  values: (number | null)[];
  color: string;
  labelEvery?: number;
  decimals?: number;
}

export function BarChart({ title, subtitle, unit = '', labels, values, color, labelEvery = 1, decimals = 0 }: BarChartProps) {
  const nums = values.filter((v): v is number => v !== null);
  const top = niceMax(Math.max(...nums, 0) * 1.08);
  const slot = (W - PAD.l - PAD.r) / labels.length;
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);

  return (
    <Frame title={title} subtitle={subtitle} legend={<Legend series={[{ name: unit || 'Value', color, values: [] }]} />}>
      {nums.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">No readings for this period</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#9ca3af">{tickLabel(t)}</text>
            </g>
          ))}
          {values.map((v, i) =>
            v === null ? null : (
              <rect key={i} x={PAD.l + i * slot + slot * 0.15} y={y(v)} width={slot * 0.7} height={H - PAD.b - y(v)} rx={2} fill={color}>
                <title>{`${labels[i]}: ${v.toLocaleString('en-IN', { maximumFractionDigits: decimals })}${unit ? ' ' + unit : ''}`}</title>
              </rect>
            ),
          )}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#9ca3af">{l}</text>
            ) : null,
          )}
        </svg>
      )}
    </Frame>
  );
}
