import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { canViewAdmin } from '@/lib/access';
import InviteUserForm from './InviteUserForm';
import UsersTable from './UsersTable';
import ActivityLogPanel from './ActivityLog';
import { getLogs } from '@/app/actions/logs';

const DEPT_BADGE: Record<string, string> = {
  Mechanical: 'bg-orange-100 text-orange-700',
  Electrical: 'bg-yellow-100 text-yellow-700',
  Housekeeping: 'bg-green-100 text-green-700',
  Laboratory: 'bg-cyan-100 text-cyan-700',
  Admin: 'bg-purple-100 text-purple-700',
  Viewer: 'bg-gray-100 text-gray-600',
};

const DEPT_ORDER = ['Mechanical', 'Electrical', 'Housekeeping', 'Laboratory', 'Viewer', 'Admin'];

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  if (!canViewAdmin(role)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Admin Access Only</p>
        <p className="text-sm mt-1">This page is restricted to Admin users only.</p>
      </div>
    );
  }

  // Use Supabase client — RLS "Admins can view all profiles" policy handles this
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, department, employee_id, created_at')
    .order('created_at', { ascending: false });

  const profiles = allProfiles ?? [];

  const deptCounts = profiles.reduce<Record<string, number>>((acc, p) => {
    const dept = p.department ?? 'Unknown';
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {});

  // Fetch initial logs (first 25, no filter)
  const logsResult = await getLogs({ limit: 25, offset: 0 });

  // Fetch pending registration + role requests
  const adminDb = createAdminClient();
  const { data: regRequests } = await adminDb
    .from('registration_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const { data: roleRequests } = await adminDb
    .from('role_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const pendingReg  = regRequests  ?? [];
  const pendingRole = roleRequests ?? [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">🛡️ Admin Panel</h2>
        <p className="text-gray-500 text-sm mt-0.5">
          Invite users, assign roles, and manage portal access
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-[#0062b8]/20 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-[#0062b8] mt-1">{profiles.length}</p>
        </div>
        {DEPT_ORDER.map((d) => (
          <div key={d} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500">{d}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{deptCounts[d] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Invite Form */}
      <InviteUserForm />

      {/* Pending Registration Requests */}
      {pendingReg.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-2">
            <span className="text-amber-600 text-lg">📋</span>
            <div>
              <h3 className="font-bold text-amber-800">Pending Registration Requests</h3>
              <p className="text-xs text-amber-600">{pendingReg.length} request{pendingReg.length !== 1 ? 's' : ''} awaiting approval</p>
            </div>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingReg.map((r) => (
              <div key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{r.full_name}</p>
                  <p className="text-xs text-gray-500">{r.email} · {r.department}{r.employee_id ? ` · ${r.employee_id}` : ''}</p>
                  {r.notes && <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{r.notes}&rdquo;</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`${siteUrl}/api/admin/approve-registration?token=${r.token}`}
                    target="_blank"
                    className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all"
                  >
                    ✅ Approve
                  </a>
                  <a
                    href={`${siteUrl}/api/admin/reject-registration?token=${r.token}`}
                    target="_blank"
                    className="text-xs bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-all"
                  >
                    ❌ Reject
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Role Requests */}
      {pendingRole.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-blue-200 flex items-center gap-2">
            <span className="text-blue-600 text-lg">⬆️</span>
            <div>
              <h3 className="font-bold text-blue-800">Pending Role Promotion Requests</h3>
              <p className="text-xs text-blue-600">{pendingRole.length} request{pendingRole.length !== 1 ? 's' : ''} awaiting approval</p>
            </div>
          </div>
          <div className="divide-y divide-blue-100">
            {pendingRole.map((r) => (
              <div key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{r.user_name}</p>
                  <p className="text-xs text-gray-500">{r.user_email}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="font-medium">{r.current_department}</span>
                    <span className="mx-1.5 text-gray-400">→</span>
                    <span className="font-bold text-[#0062b8]">{r.requested_department}</span>
                  </p>
                  {r.reason && <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{r.reason}&rdquo;</p>}
                </div>
                <a
                  href={`${siteUrl}/api/admin/approve-role?token=${r.token}`}
                  target="_blank"
                  className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all shrink-0"
                >
                  ✅ Approve Role Change
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <UsersTable profiles={profiles} />

      {/* Role Reference */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Role Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { role: 'Mechanical', icon: '⚙️', access: 'Mechanical dept page only. Can log entries and update work orders.' },
            { role: 'Electrical', icon: '⚡', access: 'Electrical dept page only. Can log entries and acknowledge alarms.' },
            { role: 'Housekeeping', icon: '🧹', access: 'Housekeeping dept page only. Can update tasks and log sludge disposal.' },
            { role: 'Laboratory', icon: '🧪', access: 'Laboratory dept page only. Lab analysis reports and effluent quality trends.' },
            { role: 'Viewer', icon: '👁', access: 'All 4 dept pages — read-only. Cannot edit, comment or trigger any action.' },
            { role: 'Admin', icon: '🛡️', access: 'Full access to all pages + Admin Panel. Can invite users and manage roles.' },
          ].map((r) => (
            <div key={r.role} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{r.icon}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DEPT_BADGE[r.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {r.role}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{r.access}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Activity Log */}
      <ActivityLogPanel
        initialLogs={logsResult.logs}
        initialTotal={logsResult.total}
      />

    </div>
  );
}
