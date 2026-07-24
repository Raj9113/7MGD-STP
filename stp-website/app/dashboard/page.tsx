import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { canViewDept, canViewAdmin } from '@/lib/access';

const PLANT_STATS = [
  { label: 'Design Capacity', value: '7 MLD', icon: '💧', color: 'blue' },
  { label: "Today's Flow", value: '6.4 MLD', icon: '📊', color: 'green' },
  { label: 'Effluent Quality', value: 'Within Limit', icon: '✅', color: 'green' },
  { label: 'Plant Efficiency', value: '91.4%', icon: '⚡', color: 'yellow' },
  { label: 'Uptime (30d)', value: '98.7%', icon: '🕐', color: 'blue' },
  { label: 'Active Alarms', value: '2', icon: '🚨', color: 'red' },
];

const COLOR: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  red: 'border-red-200 bg-red-50 text-red-700',
};

const DEPT_CARDS = [
  {
    slug: 'mechanical' as const,
    label: 'Mechanical',
    icon: '⚙️',
    summary: 'Pumps, Blowers, Clarifiers, Flow Meters',
    status: 'Operational',
    statusColor: 'bg-green-100 text-green-700',
    alerts: 1,
  },
  {
    slug: 'electrical' as const,
    label: 'Electrical',
    icon: '⚡',
    summary: 'Power Supply, DG Set, MCC, Energy Log',
    status: 'Stable',
    statusColor: 'bg-green-100 text-green-700',
    alerts: 1,
  },
  {
    slug: 'housekeeping' as const,
    label: 'Housekeeping',
    icon: '🧹',
    summary: 'Cleaning Schedule, Chemicals, Sludge Disposal',
    status: 'On Track',
    statusColor: 'bg-blue-100 text-blue-700',
    alerts: 0,
  },
];

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

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const accessibleDepts = DEPT_CARDS.filter((d) => canViewDept(role, d.slug));

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

      {/* Plant Stats */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Plant Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PLANT_STATS.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-4 flex flex-col gap-1 ${COLOR[s.color]}`}
            >
              <span className="text-2xl">{s.icon}</span>
              <p className="text-xs font-semibold opacity-70 leading-tight">{s.label}</p>
              <p className="text-lg font-bold leading-tight">{s.value}</p>
            </div>
          ))}
        </div>
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
