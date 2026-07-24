import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { canViewDept, isReadOnly } from '@/lib/access';

// ── Mock Housekeeping Data ─────────────────────────────────────────────────────

const SHIFTS = [
  {
    shift: 'Morning (06:00–14:00)',
    supervisor: 'Meena Sharma',
    areas: [
      { area: 'Inlet Chamber & Bar Screen', task: 'Cleaning & Debris Removal', status: 'Done', by: 'Ram Lal' },
      { area: 'Grit Chamber', task: 'Desanding & Washing', status: 'Done', by: 'Suresh K.' },
      { area: 'Aeration Tank Walkway', task: 'Sweeping & Mopping', status: 'Done', by: 'Arun S.' },
      { area: 'Blower Room', task: 'Dusting & Oil Spill Check', status: 'In Progress', by: 'Mohan D.' },
      { area: 'Control Room', task: 'Cleaning & AC Filter', status: 'Done', by: 'Priya R.' },
      { area: 'Laboratory', task: 'Bench Cleaning & Waste Disposal', status: 'Pending', by: 'Unassigned' },
    ],
  },
  {
    shift: 'Evening (14:00–22:00)',
    supervisor: 'Rajesh Verma',
    areas: [
      { area: 'Effluent Outlet Area', task: 'Cleaning & Inspection', status: 'Pending', by: 'Scheduled' },
      { area: 'Sludge Drying Beds', task: 'Turning & Levelling', status: 'Pending', by: 'Scheduled' },
      { area: 'Toilet Blocks (Staff)', task: 'Cleaning & Disinfection', status: 'Pending', by: 'Scheduled' },
      { area: 'Plant Boundary & Roads', task: 'Sweeping', status: 'Pending', by: 'Scheduled' },
    ],
  },
];

const CHEMICALS = [
  { name: 'Sodium Hypochlorite', unit: 'Litres', stock: 420, capacity: 500, threshold: 100, lastAdded: '22 Jul', usage: '18 L/day' },
  { name: 'Ferric Chloride', unit: 'Kg', stock: 180, capacity: 500, threshold: 100, lastAdded: '20 Jul', usage: '22 Kg/day' },
  { name: 'Polyelectrolyte (Polymer)', unit: 'Kg', stock: 65, capacity: 200, threshold: 50, lastAdded: '18 Jul', usage: '5 Kg/day' },
  { name: 'Lime (Calcium Hydroxide)', unit: 'Kg', stock: 380, capacity: 600, threshold: 120, lastAdded: '21 Jul', usage: '30 Kg/day' },
  { name: 'Alum (Aluminium Sulphate)', unit: 'Kg', stock: 95, capacity: 300, threshold: 75, lastAdded: '19 Jul', usage: '12 Kg/day' },
];

const SLUDGE_LOG = [
  { date: '24 Jul 2026', quantity: '8.2 MT', vehicle: 'DL-1C-2345', destination: 'Compost Site, Narela', driver: 'Ramesh P.' },
  { date: '23 Jul 2026', quantity: '7.8 MT', vehicle: 'DL-1C-2345', destination: 'Compost Site, Narela', driver: 'Ramesh P.' },
  { date: '22 Jul 2026', quantity: '9.1 MT', vehicle: 'HR-26-AB-1122', destination: 'Agriculture Farm, Kundli', driver: 'Vijay S.' },
  { date: '21 Jul 2026', quantity: '7.4 MT', vehicle: 'DL-1C-2345', destination: 'Compost Site, Narela', driver: 'Ramesh P.' },
  { date: '20 Jul 2026', quantity: '8.6 MT', vehicle: 'HR-26-AB-1122', destination: 'Agriculture Farm, Kundli', driver: 'Vijay S.' },
];

const PPE_STOCK = [
  { item: 'Safety Helmets', stock: 24, required: 20, unit: 'pcs', status: 'OK' },
  { item: 'Rubber Boots', stock: 18, required: 20, unit: 'pairs', status: 'Low' },
  { item: 'Chemical-resistant Gloves', stock: 32, required: 30, unit: 'pairs', status: 'OK' },
  { item: 'Safety Goggles', stock: 15, required: 15, unit: 'pcs', status: 'OK' },
  { item: 'Half-face Respirators', stock: 8, required: 12, unit: 'pcs', status: 'Low' },
  { item: 'Reflective Vests', stock: 22, required: 20, unit: 'pcs', status: 'OK' },
];

const PEST_CONTROL = [
  { area: 'Inlet Chamber', lastDone: '15 Jul 2026', nextDue: '29 Jul 2026', type: 'Mosquito Spray' },
  { area: 'Sludge Beds', lastDone: '10 Jul 2026', nextDue: '24 Jul 2026', type: 'Fly Control' },
  { area: 'Utility Rooms', lastDone: '18 Jul 2026', nextDue: '01 Aug 2026', type: 'Rodent Bait' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Done: 'bg-green-100 text-green-700 border-green-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    Pending: 'bg-gray-100 text-gray-500 border-gray-200',
    OK: 'bg-green-100 text-green-700 border-green-200',
    Low: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function ChemicalBar({ stock, capacity, threshold }: { stock: number; capacity: number; threshold: number }) {
  const pct = Math.round((stock / capacity) * 100);
  const threshPct = Math.round((threshold / capacity) * 100);
  const isLow = stock <= threshold;
  const color = isLow ? 'bg-red-500' : pct > 60 ? 'bg-green-500' : 'bg-yellow-500';
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 bg-gray-100 rounded-full h-2">
        {/* threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 rounded"
          style={{ left: `${threshPct}%` }}
        />
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 ${isLow ? 'text-red-600' : 'text-gray-600'}`}>{pct}%</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HousekeepingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  const role = profile?.department ?? 'Unknown';

  if (!canViewDept(role, 'housekeeping')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-800 max-w-md mx-auto mt-12">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-lg font-bold">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view the Housekeeping department page.</p>
      </div>
    );
  }

  const readOnly = isReadOnly(role);
  const lowChemicals = CHEMICALS.filter((c) => c.stock <= c.threshold);
  const lowPPE = PPE_STOCK.filter((p) => p.status === 'Low');

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🧹 Housekeeping Department</h2>
          <p className="text-gray-500 text-sm mt-0.5">Cleaning schedules, chemical stock, sludge disposal, and PPE inventory</p>
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

      {/* Quick alerts */}
      {(lowChemicals.length > 0 || lowPPE.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-wrap gap-4">
          <span className="font-semibold text-red-800 text-sm">⚠️ Alerts:</span>
          {lowChemicals.map((c) => (
            <span key={c.name} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              {c.name} — Low Stock ({c.stock} {c.unit})
            </span>
          ))}
          {lowPPE.map((p) => (
            <span key={p.item} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              {p.item} — Below Required
            </span>
          ))}
        </div>
      )}

      {/* Shift Cleaning Log */}
      {SHIFTS.map((s) => (
        <div key={s.shift}>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>📋 {s.shift}</SectionTitle>
            <span className="text-xs text-gray-500">Supervisor: <span className="font-semibold text-gray-700">{s.supervisor}</span></span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Area', 'Task', 'Status', 'Assigned To'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                  {!readOnly && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {s.areas.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800">{a.area}</td>
                    <td className="px-4 py-3 text-gray-600">{a.task}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{a.by}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        {a.status !== 'Done' && (
                          <button className="text-xs text-[#0062b8] hover:underline font-semibold">Mark Done</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Chemical Inventory */}
      <div>
        <SectionTitle>🧪 Chemical Inventory</SectionTitle>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Chemical', 'Stock', 'Usage/Day', 'Days Remaining', 'Level', 'Last Added'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
                {!readOnly && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CHEMICALS.map((c) => {
                const daysLeft = Math.floor(c.stock / parseFloat(c.usage));
                const isLow = c.stock <= c.threshold;
                return (
                  <tr key={c.name} className={`hover:bg-gray-50 transition-colors ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                        {c.stock} {c.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.usage}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${daysLeft <= 5 ? 'text-red-600' : daysLeft <= 10 ? 'text-yellow-600' : 'text-green-700'}`}>
                        {daysLeft} days
                      </span>
                    </td>
                    <td className="px-4 py-3 w-36">
                      <ChemicalBar stock={c.stock} capacity={c.capacity} threshold={c.threshold} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.lastAdded}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        <button className="text-xs text-[#0062b8] hover:underline font-semibold">+ Replenish</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sludge Disposal + PPE side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sludge Disposal Log */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>🗑 Sludge Disposal Log</SectionTitle>
            {!readOnly && <button className="text-xs text-[#0062b8] font-semibold hover:underline">+ Add Entry</button>}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Quantity', 'Vehicle', 'Destination'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SLUDGE_LOG.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{s.date}</td>
                    <td className="px-4 py-2.5 font-bold text-gray-800">{s.quantity}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.vehicle}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{s.destination}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PPE Inventory */}
        <div>
          <SectionTitle>🦺 PPE Inventory</SectionTitle>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            {PPE_STOCK.map((p) => (
              <div key={p.item} className={`flex items-center justify-between p-3 rounded-lg ${p.status === 'Low' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.item}</p>
                  <p className="text-xs text-gray-500">
                    {p.stock} / {p.required} {p.unit} required
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {!readOnly && p.status === 'Low' && (
                    <button className="text-xs text-[#0062b8] font-semibold hover:underline">Order</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pest Control */}
      <div>
        <SectionTitle>🐛 Pest Control Schedule</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PEST_CONTROL.map((p) => {
            const isDue = p.nextDue === '24 Jul 2026';
            return (
              <div key={p.area} className={`bg-white rounded-xl border shadow-sm p-4 ${isDue ? 'border-yellow-300' : 'border-gray-200'}`}>
                <p className="font-bold text-gray-800">{p.area}</p>
                <p className="text-xs text-gray-500 mt-1">{p.type}</p>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Last Done</span><span className="text-gray-700">{p.lastDone}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Next Due</span>
                    <span className={`font-semibold ${isDue ? 'text-yellow-700' : 'text-gray-700'}`}>{p.nextDue}</span>
                  </div>
                </div>
                {isDue && !readOnly && (
                  <button className="mt-3 w-full text-xs text-yellow-700 border border-yellow-300 rounded-lg py-1.5 hover:bg-yellow-50 font-semibold transition-all">
                    Schedule Now
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
