import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { canViewDept, canViewAdmin } from '@/lib/access';
import { LIMITED, fmtFlow, limitStatus } from './laboratory/lab';
import { loadLab } from './laboratory/lab-live';
import { SCHEMAS, asRow, attention, num, type DeptSlug } from '@/lib/dept-report/schema';
import { loadLatestEach } from '@/lib/dept-report/load';
import CameraFeed from './camera/CameraFeed';
import DailyReportButton from './DailyReportButton';
import { todayIST } from './laboratory/entry-fields';

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/** "Updated today" / "Last report 06 Oct" / "No report yet", with a colour that fades as the report ages */
function freshness(date: string | undefined, today: string): { status: string; statusColor: string } {
  if (!date) return { status: 'No report yet', statusColor: 'bg-gray-100 text-gray-600' };
  if (date === today) return { status: 'Updated today', statusColor: 'bg-green-100 text-green-700' };
  const age = (Date.parse(today) - Date.parse(date)) / 86400000;
  return { status: `Last report ${shortDate(date)}`, statusColor: age <= 2 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700' };
}

const COLOR: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  red: 'border-red-200 bg-red-50 text-red-700',
};

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  // Everything below comes from the real reports: the lab files / entry form and the department daily reports
  const today = todayIST();
  const [{ data: lab }, latest] = await Promise.all([loadLab(), loadLatestEach(today)]);
  const lastLab = lab.months.flatMap((m) => m.days).filter((d) => d.date <= today).at(-1);
  const labStates = LIMITED.map((k) => limitStatus(k, lastLab?.[k]?.out)).filter((s) => s !== 'na');
  const labOver = labStates.filter((s) => s !== 'ok').length;
  const bodIn = lastLab?.bod?.in;
  const bodOut = lastLab?.bod?.out;
  const attn = (['mechanical', 'electrical', 'housekeeping'] as DeptSlug[]).map((s) => attention(SCHEMAS[s], latest[s]?.data ?? null));
  const attnTotal = attn.reduce((a, x) => a + x.alerts, 0);
  const energy = latest.electrical ? num(asRow(latest.electrical.data.energy).units) : null;
  const energyDate = latest.electrical?.date;

  const stats = [
    { label: 'Design Capacity', value: '7 MGD', sub: 'treatment plant', icon: '💧', color: 'blue' },
    { label: 'Treated Flow', value: lastLab?.flow?.treated !== undefined ? `${fmtFlow(lastLab.flow.treated)} MGD` : '—', sub: lastLab ? `lab report ${shortDate(lastLab.date)}` : 'no lab data', icon: '📊', color: 'green' },
    { label: 'Effluent Quality', value: labStates.length ? (labOver === 0 ? 'Within Limit' : `${labOver} above limit`) : '—', sub: !lastLab ? 'no lab data' : labStates.length ? `${labStates.length - labOver}/${labStates.length} limits met, ${shortDate(lastLab.date)}` : `no limit values entered, ${shortDate(lastLab.date)}`, icon: labOver ? '⚠️' : '✅', color: labOver ? 'red' : 'green' },
    { label: 'BOD Removal', value: typeof bodIn === 'number' && typeof bodOut === 'number' && bodIn > 0 ? `${(((bodIn - bodOut) / bodIn) * 100).toFixed(1)}%` : '—', sub: lastLab ? `inlet to outlet, ${shortDate(lastLab.date)}` : 'no lab data', icon: '⚡', color: 'yellow' },
    { label: 'Energy Used', value: energy !== null ? `${energy.toLocaleString('en-IN')} kWh` : '—', sub: energyDate ? `electrical report ${shortDate(energyDate)}` : 'no electrical report', icon: '🔌', color: 'blue' },
    { label: 'Needs Attention', value: String(attnTotal), sub: 'in the latest department reports', icon: '🚨', color: attnTotal ? 'red' : 'green' },
  ];

  const deptCards = [
    ...(['mechanical', 'electrical', 'housekeeping'] as DeptSlug[]).map((slug, i) => ({
      slug, label: SCHEMAS[slug].label, icon: SCHEMAS[slug].icon, summary: SCHEMAS[slug].blurb, alerts: attn[i].alerts, ...freshness(latest[slug]?.date, today),
    })),
    { slug: 'laboratory' as const, label: 'Laboratory', icon: '🧪', summary: 'Effluent quality, daily lab reports, sample photos, power use', alerts: labOver, ...freshness(lastLab?.date, today) },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const accessibleDepts = deptCards.filter((d) => canViewDept(role, d.slug));

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div className="bg-white rounded-xl border-l-4 border border-gray-200 shadow-sm p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {greeting}, {profile?.full_name || user.email} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            7 MGD STP Sonia Vihar — Plant Control Portal
          </p>
        </div>
        <p className="text-sm text-gray-400">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Daily plant report PDF (Admin only) */}
      {canViewAdmin(role) && <DailyReportButton today={todayIST()} />}

      {/* Plant Stats */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Plant Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-4 flex flex-col gap-1 ${COLOR[s.color]}`}
            >
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-semibold opacity-70 leading-tight">{s.label}</p>
              <p className="text-lg font-bold leading-tight">{s.value}</p>
              <p className="text-[11px] leading-tight opacity-70">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Live NVR Camera Feed ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Live Camera
        </h3>
        <CameraFeed />
      </div>

      {/* Department Quick-Access */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Departments
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accessibleDepts.map((d) => (
            <Link
              key={d.slug}
              href={`/dashboard/${d.slug}`}
              className="group bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-[#0062b8] hover:shadow-md transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">{d.icon}</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${d.statusColor}`}>
                  {d.status}
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 group-hover:text-[#0062b8] transition-colors">
                  {d.label}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{d.summary}</p>
              </div>
              {d.alerts > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                  <span>⚠️</span>
                  <span>{d.alerts} active alert{d.alerts > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="text-xs text-[#0062b8] font-semibold group-hover:underline mt-auto">
                View Details →
              </div>
            </Link>
          ))}

          {canViewAdmin(role) && (
            <Link
              href="/dashboard/admin"
              className="group bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-purple-400 hover:shadow-md transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">🛡️</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                  Admin
                </span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 group-hover:text-purple-700 transition-colors">
                  Admin Panel
                </p>
                <p className="text-sm text-gray-500 mt-0.5">User management, roles, access control</p>
              </div>
              <div className="text-xs text-purple-600 font-semibold group-hover:underline mt-auto">
                Manage Users →
              </div>
            </Link>
          )}
        </div>

        {accessibleDepts.length === 0 && !canViewAdmin(role) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 text-center">
            <p className="font-semibold">⚠️ Profile not assigned</p>
            <p className="text-sm mt-1">Your account has no department assigned. Contact Admin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
