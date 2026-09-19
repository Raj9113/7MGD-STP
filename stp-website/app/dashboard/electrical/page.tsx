import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { canViewDept, isReadOnly } from '@/lib/access';
import LiveCamera from '../LiveCamera';

// ── Mock Electrical Data ───────────────────────────────────────────────────────

const POWER_PARAMS = [
  { label: 'Incoming Voltage (R)', value: '231 V', status: 'Normal' },
  { label: 'Incoming Voltage (Y)', value: '229 V', status: 'Normal' },
  { label: 'Incoming Voltage (B)', value: '233 V', status: 'Normal' },
  { label: 'Frequency', value: '49.9 Hz', status: 'Normal' },
  { label: 'Power Factor', value: '0.87 lag', status: 'Low' },
  { label: 'Total Load', value: '186 kW', status: 'Normal' },
];

const MCC_PANELS = [
  { id: 'MCC-1', name: 'MCC 1 — Inlet Pumps', load: '82 kW', breakers: 12, tripped: 0, status: 'Healthy' },
  { id: 'MCC-2', name: 'MCC 2 — Aeration Blowers', load: '74 kW', breakers: 8, tripped: 1, status: 'Alert' },
  { id: 'MCC-3', name: 'MCC 3 — Sludge & Misc.', load: '30 kW', breakers: 10, tripped: 0, status: 'Healthy' },
];

const DG_SET = {
  model: 'Kirloskar 250 kVA',
  status: 'Auto-Standby',
  fuelLevel: 74,
  lastRun: '22 Jul 2026, 06:15 AM',
  runDuration: '2 hrs 20 min',
  totalHours: 4820,
  nextService: '250 hrs remaining',
};

const ENERGY_LOG = [
  { day: 'Mon 21', units: 1240 },
  { day: 'Tue 22', units: 1185 },
  { day: 'Wed 23', units: 1260 },
  { day: 'Thu 24', units: 930 }, // partial day
];

const ALARMS = [
  { id: 'ALM-018', time: '13:42', desc: 'MCC-2 Blower B2 — Phase C Overcurrent Trip', severity: 'High', status: 'Acknowledged' },
  { id: 'ALM-017', time: '09:15', desc: 'Power Factor Below 0.90 Threshold', severity: 'Low', status: 'Active' },
  { id: 'ALM-016', time: 'Yesterday 22:30', desc: 'UPS Battery — Low Charge Warning', severity: 'Medium', status: 'Cleared' },
  { id: 'ALM-015', time: 'Yesterday 14:10', desc: 'Main Incomer — Voltage Sag (R Phase)', severity: 'Medium', status: 'Cleared' },
];

const UPS = { capacity: '20 kVA', load: '6.2 kW', battery: 88, runtime: '4 hrs 30 min', status: 'Normal' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Normal: 'bg-green-100 text-green-700 border-green-200',
    Healthy: 'bg-green-100 text-green-700 border-green-200',
    Alert: 'bg-red-100 text-red-700 border-red-200',
    Low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Active: 'bg-red-100 text-red-700 border-red-200',
    Acknowledged: 'bg-blue-100 text-blue-700 border-blue-200',
    Cleared: 'bg-gray-100 text-gray-500 border-gray-200',
    'Auto-Standby': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function FuelBar({ pct }: { pct: number }) {
  const color = pct > 50 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className={`h-3 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-10">{pct}%</span>
    </div>
  );
}

const MAX_ENERGY = Math.max(...ENERGY_LOG.map((e) => e.units));

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ElectricalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  if (!canViewDept(role, 'electrical')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view the Electrical department page.</p>
      </div>
    );
  }

  const readOnly = isReadOnly(role);

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">⚡ Electrical Department</h2>
          <p className="text-gray-500 text-sm mt-0.5">Power systems, MCC panels, DG set, and energy monitoring</p>
        </div>
        {readOnly ? (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm font-semibold">
            👁 Read-only View
          </div>
        ) : (
          <button className="bg-[#0062b8] text-white text-sm font-semibold px-4 py-2 rounded-lg border-2 border-transparent hover:border-[#ffcc00] transition-all">
            + Log Entry
          </button>
        )}
      </div>

      {/* Live Camera */}
      <LiveCamera />

      {/* Power Parameters */}
      <div>
        <SectionTitle>🔌 Main Incoming — Power Parameters</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {POWER_PARAMS.map((p) => (
            <div
              key={p.label}
              className={`rounded-xl border p-4 ${p.status === 'Low' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}
            >
              <p className="text-xs text-gray-500 leading-tight mb-2">{p.label}</p>
              <p className={`text-xl font-bold ${p.status === 'Low' ? 'text-yellow-700' : 'text-[#0062b8]'}`}>{p.value}</p>
              <div className="mt-2"><StatusBadge status={p.status} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* MCC Panels + DG Set side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MCC Panels — 2/3 width */}
        <div className="lg:col-span-2">
          <SectionTitle>🗄 MCC Panels</SectionTitle>
          <div className="space-y-3">
            {MCC_PANELS.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 ${m.status === 'Alert' ? 'border-red-200' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs text-gray-400">{m.id}</p>
                    <p className="font-bold text-gray-800">{m.name}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-gray-500 text-xs">Total Load</p><p className="font-bold text-gray-800">{m.load}</p></div>
                  <div><p className="text-gray-500 text-xs">Breakers</p><p className="font-bold text-gray-800">{m.breakers}</p></div>
                  <div>
                    <p className="text-gray-500 text-xs">Tripped</p>
                    <p className={`font-bold ${m.tripped > 0 ? 'text-red-600' : 'text-green-600'}`}>{m.tripped}</p>
                  </div>
                </div>
                {!readOnly && m.status === 'Alert' && (
                  <button className="text-sm text-red-600 border border-red-200 rounded-lg py-1.5 hover:bg-red-50 font-semibold transition-all">
                    ⚠ Acknowledge Alert
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* DG Set + UPS — 1/3 width */}
        <div className="space-y-4">
          <div>
            <SectionTitle>🔋 DG Set</SectionTitle>
            <div className="bg-white rounded-xl border border-yellow-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between">
                <p className="font-bold text-gray-800">{DG_SET.model}</p>
                <StatusBadge status={DG_SET.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Fuel Level</p>
                <FuelBar pct={DG_SET.fuelLevel} />
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Last Run</span><span className="text-gray-700 font-medium text-xs">{DG_SET.lastRun}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-semibold">{DG_SET.runDuration}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Hours</span><span className="font-semibold">{DG_SET.totalHours} hrs</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Next Service</span><span className="text-yellow-700 font-semibold text-xs">{DG_SET.nextService}</span></div>
              </div>
              {!readOnly && (
                <button className="w-full text-xs border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:border-[#0062b8] hover:text-[#0062b8] transition-all font-semibold">
                  Log Trial Run
                </button>
              )}
            </div>
          </div>

          <div>
            <SectionTitle>🔌 UPS</SectionTitle>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-gray-800">{UPS.capacity}</p>
                <StatusBadge status={UPS.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Battery Charge</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${UPS.battery}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700">{UPS.battery}%</span>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Current Load</span><span className="font-semibold">{UPS.load}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Backup Runtime</span><span className="font-semibold">{UPS.runtime}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Energy Log */}
      <div>
        <SectionTitle>📊 Energy Consumption (kWh) — Last 4 Days</SectionTitle>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-end gap-4 h-40">
            {ENERGY_LOG.map((e) => {
              const pct = Math.round((e.units / MAX_ENERGY) * 100);
              return (
                <div key={e.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-[#0062b8]">{e.units}</span>
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div
                      className="w-full bg-[#0062b8] rounded-t-md hover:bg-[#004f96] transition-colors"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{e.day}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Total (4 days): <span className="font-bold text-gray-800">{ENERGY_LOG.reduce((a, b) => a + b.units, 0)} kWh</span></span>
            <span className="text-gray-500">Avg per MLD: <span className="font-bold text-gray-800">~194 kWh/MLD</span></span>
          </div>
        </div>
      </div>

      {/* Alarm History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>🚨 Alarm History — Today</SectionTitle>
          {!readOnly && (
            <button className="text-xs text-[#0062b8] font-semibold hover:underline">View All Alarms</button>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ID', 'Time', 'Description', 'Severity', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
                {!readOnly && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ALARMS.map((a) => (
                <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${a.status === 'Active' ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.id}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{a.time}</td>
                  <td className="px-4 py-3 text-gray-800">{a.desc}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  {!readOnly && (
                    <td className="px-4 py-3">
                      {a.status === 'Active' && (
                        <button className="text-xs text-blue-600 hover:underline font-semibold">Acknowledge</button>
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
