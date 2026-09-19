import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { canViewDept, isReadOnly } from '@/lib/access';
import LiveCamera from '../LiveCamera';

// ── Mock STP Data ─────────────────────────────────────────────────────────────

const PUMPS = [
  { id: 'P1', name: 'Inlet Pump 1', status: 'Running', flow: '2.2 MLD', current: '18.4 A', hours: 1240, health: 92 },
  { id: 'P2', name: 'Inlet Pump 2', status: 'Running', flow: '2.1 MLD', current: '17.9 A', hours: 980, health: 88 },
  { id: 'P3', name: 'Inlet Pump 3', status: 'Standby', flow: '—', current: '0 A', hours: 650, health: 95 },
  { id: 'SP1', name: 'Sludge Pump 1 (RAS)', status: 'Running', flow: '0.8 MLD', current: '12.1 A', hours: 870, health: 90 },
  { id: 'SP2', name: 'Sludge Pump 2 (WAS)', status: 'Running', flow: '0.3 MLD', current: '8.6 A', hours: 620, health: 94 },
];

const BLOWERS = [
  { id: 'B1', name: 'Aeration Blower 1', status: 'Running', airflow: '1200 m³/hr', pressure: '0.52 bar', temp: '68°C', health: 87 },
  { id: 'B2', name: 'Aeration Blower 2', status: 'Running', airflow: '1150 m³/hr', pressure: '0.51 bar', temp: '71°C', health: 83 },
  { id: 'B3', name: 'Aeration Blower 3', status: 'Standby', airflow: '—', pressure: '—', temp: '42°C', health: 97 },
];

const CLARIFIERS = [
  { id: 'PC1', name: 'Primary Clarifier', sludgeBlanket: '0.45 m', weir: 'Normal', scraper: 'Running', efficiency: '62%' },
  { id: 'SC1', name: 'Secondary Clarifier 1', sludgeBlanket: '0.38 m', weir: 'Normal', scraper: 'Running', efficiency: '94%' },
  { id: 'SC2', name: 'Secondary Clarifier 2', sludgeBlanket: '0.41 m', weir: 'Normal', scraper: 'Running', efficiency: '93%' },
];

const FLOW_READINGS = [
  { point: 'Inlet Flow Meter', value: '6.4 MLD', time: '14:30', trend: '↗' },
  { point: 'Effluent Flow Meter', value: '5.9 MLD', time: '14:30', trend: '→' },
  { point: 'RAS Flow', value: '0.8 MLD', time: '14:30', trend: '→' },
  { point: 'WAS Flow', value: '0.3 MLD', time: '14:30', trend: '↘' },
];

const DO_READINGS = [
  { zone: 'Aeration Zone 1', do: 2.4, unit: 'mg/L', status: 'OK' },
  { zone: 'Aeration Zone 2', do: 2.1, unit: 'mg/L', status: 'OK' },
  { zone: 'Aeration Zone 3', do: 1.8, unit: 'mg/L', status: 'Low' },
  { zone: 'Aeration Zone 4', do: 2.6, unit: 'mg/L', status: 'OK' },
];

const WORK_ORDERS = [
  { id: 'WO-241', title: 'Inlet Pump P1 — Bearing Inspection', priority: 'High', status: 'In Progress', due: '25 Jul 2026', assignee: 'Ravi Kumar' },
  { id: 'WO-240', title: 'Bar Screen — Wire Mesh Replacement', priority: 'Medium', status: 'Open', due: '27 Jul 2026', assignee: 'Suresh M.' },
  { id: 'WO-239', title: 'Blower B2 — Air Filter Cleaning', priority: 'Low', status: 'Open', due: '28 Jul 2026', assignee: 'Mohan D.' },
  { id: 'WO-238', title: 'Secondary Clarifier — Scraper Arm Lubrication', priority: 'Medium', status: 'Completed', due: '23 Jul 2026', assignee: 'Ravi Kumar' },
  { id: 'WO-237', title: 'Grit Chamber — Desanding', priority: 'High', status: 'Completed', due: '22 Jul 2026', assignee: 'Team Mech' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Running: 'bg-green-100 text-green-700 border-green-200',
    Standby: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Fault: 'bg-red-100 text-red-700 border-red-200',
    Stopped: 'bg-gray-100 text-gray-600 border-gray-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    Open: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Completed: 'bg-green-100 text-green-700 border-green-200',
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-gray-100 text-gray-600',
    OK: 'bg-green-100 text-green-700',
    Low_DO: 'bg-red-100 text-red-700',
  };
  const key = status === 'Low' && status.length < 4 ? 'Low_DO' : status;
  const cls = map[key] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function HealthBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
      {children}
    </h3>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MechanicalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  if (!canViewDept(role, 'mechanical')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view the Mechanical department page.</p>
      </div>
    );
  }

  const readOnly = isReadOnly(role);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">⚙️ Mechanical Department</h2>
          <p className="text-gray-500 text-sm mt-0.5">Real-time status of all mechanical equipment — 7 MGD STP Sonia Vihar</p>
        </div>
        {readOnly ? (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm font-semibold">
            👁 Read-only View
          </div>
        ) : (
          <button className="bg-[#0062b8] text-white text-sm font-semibold px-4 py-2 rounded-lg border-2 border-transparent hover:border-[#ffcc00] transition-all">
            + New Work Order
          </button>
        )}
      </div>

      {/* Live Camera */}
      <LiveCamera />

      {/* Flow Readings */}
      <div>
        <SectionTitle>💧 Live Flow Readings</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FLOW_READINGS.map((f) => (
            <div key={f.point} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium">{f.point}</p>
              <p className="text-xl font-bold text-[#0062b8] mt-1">{f.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">Updated {f.time} {f.trend}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pumps */}
      <div>
        <SectionTitle>🔄 Pump Station</SectionTitle>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Name', 'Status', 'Flow Rate', 'Current', 'Run Hours', 'Health'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
                {!readOnly && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PUMPS.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{p.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-700">{p.flow}</td>
                  <td className="px-4 py-3 text-gray-700">{p.current}</td>
                  <td className="px-4 py-3 text-gray-600">{p.hours} hrs</td>
                  <td className="px-4 py-3 w-32"><HealthBar pct={p.health} /></td>
                  {!readOnly && (
                    <td className="px-4 py-3">
                      <button className="text-xs text-[#0062b8] hover:underline font-semibold">Log Entry</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blowers */}
      <div>
        <SectionTitle>💨 Aeration Blowers</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BLOWERS.map((b) => (
            <div key={b.id} className={`bg-white rounded-xl border shadow-sm p-5 ${b.status === 'Running' ? 'border-green-200' : 'border-yellow-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500 font-mono">{b.id}</p>
                  <p className="font-bold text-gray-800">{b.name}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Air Flow</span><span className="font-semibold">{b.airflow}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Discharge Pressure</span><span className="font-semibold">{b.pressure}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bearing Temp</span><span className={`font-semibold ${parseInt(b.temp) > 75 ? 'text-red-600' : 'text-gray-800'}`}>{b.temp}</span></div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Health</p>
                <HealthBar pct={b.health} />
              </div>
              {!readOnly && (
                <button className="mt-3 w-full text-xs border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:border-[#0062b8] hover:text-[#0062b8] transition-all font-semibold">
                  Log Inspection
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DO Levels */}
      <div>
        <SectionTitle>🫧 Dissolved Oxygen — Aeration Tank</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DO_READINGS.map((d) => (
            <div key={d.zone} className={`rounded-xl border p-4 ${d.status === 'Low' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <p className="text-xs text-gray-500 font-medium mb-1">{d.zone}</p>
              <p className={`text-3xl font-bold ${d.status === 'Low' ? 'text-red-600' : 'text-[#0062b8]'}`}>{d.do}</p>
              <p className="text-xs text-gray-400">{d.unit}</p>
              <div className="mt-2"><StatusBadge status={d.status} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Clarifiers */}
      <div>
        <SectionTitle>🏊 Clarifiers</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CLARIFIERS.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex justify-between items-start mb-3">
                <p className="font-bold text-gray-800">{c.name}</p>
                <StatusBadge status="Running" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Sludge Blanket</span><span className="font-semibold">{c.sludgeBlanket}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Weir Overflow</span><span className="font-semibold">{c.weir}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Scraper</span><span className="font-semibold">{c.scraper}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Removal Efficiency</span><span className="font-bold text-green-700">{c.efficiency}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Work Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>🔧 Maintenance Work Orders</SectionTitle>
          {!readOnly && (
            <button className="text-xs text-[#0062b8] font-semibold hover:underline">View All</button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['WO #', 'Title', 'Priority', 'Status', 'Due Date', 'Assignee'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
                {!readOnly && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {WORK_ORDERS.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{w.id}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium max-w-xs">{w.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={w.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{w.due}</td>
                  <td className="px-4 py-3 text-gray-600">{w.assignee}</td>
                  {!readOnly && (
                    <td className="px-4 py-3">
                      {w.status !== 'Completed' && (
                        <button className="text-xs text-[#0062b8] hover:underline font-semibold">Update</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
