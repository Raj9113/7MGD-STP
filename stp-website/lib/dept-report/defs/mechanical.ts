import type { DeptSchema, Field, Section } from '../schema';
import { equipFields, equipStatus, hot, names, pmSection, sparesSection, vibration, workOrderSection } from './common';

/**
 * Mechanical: equipment of the 12 MGD WWPS (Rajiv Nagar) and the 7 MGD WWTP (Sonia Vihar, IFAS + A2O with BNR, disc filters and UV),
 * taken from the plant's work performance certificate (Annexure A, E&M components). Row names are the starting lists;
 * every list can be edited on the form and is carried to the next day.
 */

const rotating = (extra: Field[] = []): Field[] => [
  { key: 'name', label: 'Pump', type: 'text', carry: true },
  { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
  { key: 'freq', label: 'VFD frequency', type: 'number', unit: 'Hz', max: 60, step: '0.1' },
  { key: 'current', label: 'Motor current', type: 'number', unit: 'A', max: 5000, step: '0.1' },
  ...extra,
  { key: 'pressure', label: 'Discharge pressure', type: 'number', unit: 'bar', max: 50, step: '0.01' },
  { key: 'temp', label: 'Bearing temp', type: 'number', unit: '°C', max: 250, step: '1', warn: hot(75) },
  { key: 'vib', label: 'Vibration', type: 'number', unit: 'mm/s', max: 100, step: '0.1', warn: vibration },
  { key: 'hours', label: 'Run hours (total)', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

const equipment = (key: string, title: string, icon: string, list: string[], help?: string): Section => ({
  key, title, icon, kind: 'table', view: 'table', addLabel: 'Add equipment', titleKeys: ['name'], help, fields: equipFields, seed: names(list),
});

export const MECHANICAL: DeptSchema = {
  slug: 'mechanical', label: 'Mechanical', role: 'Mechanical', icon: '⚙️',
  blurb: '12 MGD WWPS and 7 MGD WWTP: pumps, screens, grit, IFAS reactors, blowers, disc filters, UV, sludge pumps, preventive maintenance',
  accent: { ring: 'border-orange-200', text: 'text-orange-700', bg: 'bg-orange-50', solid: 'bg-orange-600' },
  sections: [
    // ── 12 MGD WWPS (Rajiv Nagar) ──
    {
      key: 'wwps_levels', title: 'WWPS - receiving chamber & wet well', icon: '🌊', kind: 'fields', view: 'stats',
      help: '12 MGD raw sewage pumping station: receiving chamber, coarse screen chamber and the 18 m dia. wet well (raw sump).',
      fields: [
        { key: 'wet_well', label: 'Wet well level', type: 'number', unit: 'm', max: 30, step: '0.01' },
        { key: 'receiving', label: 'Receiving chamber level', type: 'number', unit: 'm', max: 30, step: '0.01' },
        { key: 'screenings', label: 'Screenings removed', type: 'number', unit: 'kg', max: 100_000, step: '1' },
        { key: 'pumps_running', label: 'Pumps running', type: 'number', max: 5, step: '1' },
        { key: 'sump_check', label: 'Wet well / sump condition', type: 'select', options: ['Normal', 'Silt build-up', 'Floating scum', 'Odour complaint'] },
      ],
    },
    equipment('wwps_inlet', 'WWPS - coarse screen & conveyor', '🧹', ['Coarse bar screen - mechanical multi rake (Eurotek)', 'Belt conveyor (Eurotek)'], 'Daily check of the multi-rake screen and the screenings conveyor.'),
    {
      key: 'wwps_pumps', title: 'WWPS - raw sewage transfer pumps', icon: '🔄', kind: 'table', view: 'cards', addLabel: 'Add pump', titleKeys: ['name'],
      help: 'Five pumps, 90 HP / 54.58 kW / 900 m³/hr each (Aqua), VFD driven from MCC-5. Bearing temperature above 75 °C and vibration above 7.1 mm/s are flagged.',
      fields: rotating([{ key: 'flow', label: 'Flow', type: 'number', unit: 'm³/hr', max: 5000, step: '1' }]),
      seed: names(['RSP-1 Raw sewage pump 1', 'RSP-2 Raw sewage pump 2', 'RSP-3 Raw sewage pump 3', 'RSP-4 Raw sewage pump 4', 'RSP-5 Raw sewage pump 5']),
    },
    {
      key: 'wwps_valves', title: 'WWPS - delivery valves & actuators', icon: '🚰', kind: 'table', view: 'table', addLabel: 'Add valve set', titleKeys: ['name'],
      help: 'Per pump: NRV-450 and KGV-450 (Jupiter) with Rotork actuator; and the common NRV-800 / KGV-800 with 3.3 kW Rotork actuator.',
      fields: [
        { key: 'name', label: 'Valve set', type: 'text', carry: true },
        { key: 'nrv', label: 'Non-return valve', type: 'select', options: ['OK', 'Leaking', 'Stuck'], status: true },
        { key: 'kgv', label: 'Knife gate valve', type: 'select', options: ['OK', 'Leaking', 'Stuck'], status: true },
        { key: 'actuator', label: 'Actuator', type: 'select', options: ['Auto', 'Manual mode', 'Faulty'], status: true },
        { key: 'position', label: 'Position', type: 'select', options: ['Open', 'Closed', 'Partly open'] },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Pump 1 - NRV/KGV-450', 'Pump 2 - NRV/KGV-450', 'Pump 3 - NRV/KGV-450', 'Pump 4 - NRV/KGV-450', 'Pump 5 - NRV/KGV-450', 'Common header - NRV/KGV-800']),
    },
    // ── 7 MGD WWTP: preliminary treatment ──
    {
      key: 'prelim_waste', title: 'WWTP - screenings & grit removed today', icon: '🗑', kind: 'fields', view: 'stats',
      fields: [
        { key: 'screenings', label: 'Screenings (fine screens)', type: 'number', unit: 'kg', max: 100_000, step: '1' },
        { key: 'grit', label: 'Grit removed', type: 'number', unit: 'kg', max: 100_000, step: '1' },
        { key: 'organic', label: 'Organic matter pumped', type: 'number', unit: 'kg', max: 100_000, step: '1' },
      ],
    },
    equipment('prelim', 'WWTP - fine screens, conveyor & grit chambers', '🧰', [
      'Fine bar screen 1 - multi rake (Eurotek)', 'Fine bar screen 2 - multi rake (Eurotek)', 'Belt conveyor (Eurotek)',
      'Grit mechanism 1 (Shivpad 1.1 kW)', 'Grit mechanism 2 (Shivpad 1.1 kW)', 'Screw classifier 1 (Shivpad 1.1 kW)', 'Screw classifier 2 (Shivpad 1.1 kW)',
      'Organic pump 1 (Shivpad 0.7 kW)', 'Organic pump 2 (Shivpad 0.7 kW)',
    ], 'Two fine screen channels and two grit chambers.'),
    {
      key: 'gates', title: 'Sluice gates', icon: '🚪', kind: 'table', view: 'table', addLabel: 'Add gate', titleKeys: ['name'],
      help: 'CI sluice gates (Jash). Record the position they are left in and whether they moved smoothly.',
      fields: [
        { key: 'name', label: 'Gate', type: 'text', carry: true },
        { key: 'position', label: 'Position', type: 'select', options: ['Open', 'Closed', 'Partly open'] },
        { key: 'operation', label: 'Operation', type: 'select', options: ['Smooth', 'Hard to operate', 'Faulty'], status: true },
        { key: 'greased', label: 'Last greased', type: 'date', carry: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names([
        'WWPS inlet gate 1 (1100 x 1100)', 'WWPS inlet gate 2 (1100 x 1100)',
        'Fine screen gate 1 (900 x 1200)', 'Fine screen gate 2 (900 x 1200)', 'Fine screen gate 3 (900 x 1200)', 'Fine screen gate 4 (900 x 1200)',
        'Grit chamber gate 1 (900 x 1200)', 'Grit chamber gate 2 (900 x 1200)',
        'Distribution gate 1 (900 x 1200)', 'Distribution gate 2 (900 x 1200)', 'Anaerobic feed gate (1000 x 1200)',
        'Disc filter gate 1 (1200 x 600)', 'Disc filter gate 2 (1200 x 600)', 'UV channel gate (900 x 900)',
      ]),
    },
    // ── 7 MGD WWTP: biological reactors (A2O + IFAS) ──
    {
      key: 'bio_zones', title: 'Anaerobic & anoxic tanks (BNR)', icon: '🧫', kind: 'table', view: 'cards', addLabel: 'Add tank', titleKeys: ['zone'],
      help: 'Phosphorus release (anaerobic) and nitrogen removal (anoxic). Anoxic dissolved oxygen should stay near zero; above 0.5 mg/L is flagged.',
      fields: [
        { key: 'zone', label: 'Tank', type: 'text', carry: true },
        { key: 'do', label: 'Dissolved oxygen', type: 'number', unit: 'mg/L', max: 20, step: '0.01', warn: (v, row) => (typeof v === 'number' && /anoxic|anaerobic/i.test(String(row.zone ?? '')) && v > 0.5 ? 'warn' : undefined) },
        { key: 'orp', label: 'ORP', type: 'number', unit: 'mV', min: 0, max: 1000, step: '1' },
        { key: 'ph', label: 'pH', type: 'number', max: 14, step: '0.1', warn: (v) => (typeof v === 'number' && (v < 6 || v > 9) ? 'bad' : undefined) },
        { key: 'temp', label: 'Temperature', type: 'number', unit: '°C', max: 60, step: '0.1' },
        { key: 'surface', label: 'Surface', type: 'select', options: ['Normal', 'Foaming', 'Scum', 'Odour'] },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Anaerobic tank 1', 'Anaerobic tank 2', 'Anoxic tank 1', 'Anoxic tank 2']).map((r) => ({ zone: r.name })),
    },
    equipment('mixers', 'Anoxic mixers, IR gates & IFAS media', '🌀', [
      'Anoxic mixer 1 (Eurotek 5.5 kW)', 'Anoxic mixer 2 (Eurotek 5.5 kW)',
      'IR gate 1 + actuator (Auma / Limitorque)', 'IR gate 2 + actuator (Auma / Limitorque)',
      'IFAS media floating cages - anoxic (8 nos)', 'IFAS media floating cages - aeration (26 nos)',
    ], 'Internal-recycle gates move nitrate back to the anoxic zone. Note any cage that is tilted, broken or has lost media.'),
    {
      key: 'aeration', title: 'IFAS aeration tanks', icon: '🫧', kind: 'table', view: 'cards', addLabel: 'Add tank', titleKeys: ['zone'],
      help: 'Target dissolved oxygen about 2 mg/L. Below 1 mg/L is red, 1 to 1.5 or above 4 mg/L is amber.',
      fields: [
        { key: 'zone', label: 'Tank', type: 'text', carry: true },
        { key: 'do', label: 'Dissolved oxygen', type: 'number', unit: 'mg/L', max: 20, step: '0.01', warn: (v) => (typeof v === 'number' ? (v < 1 ? 'bad' : v < 1.5 || v > 4 ? 'warn' : undefined) : undefined) },
        { key: 'mlss', label: 'MLSS', type: 'number', unit: 'mg/L', max: 20_000, step: '10' },
        { key: 'ph', label: 'pH', type: 'number', max: 14, step: '0.1', warn: (v) => (typeof v === 'number' && (v < 6 || v > 9) ? 'bad' : undefined) },
        { key: 'temp', label: 'Temperature', type: 'number', unit: '°C', max: 60, step: '0.1' },
        { key: 'air', label: 'Air distribution', type: 'select', options: ['Uniform', 'Patchy', 'Clogged'], status: true },
        { key: 'surface', label: 'Surface', type: 'select', options: ['Normal', 'Foaming', 'Scum', 'Odour'] },
        { key: 'media', label: 'IFAS media', type: 'select', options: ['OK', 'Clogged', 'Damaged'], status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: [{ zone: 'IFAS aeration tank 1' }, { zone: 'IFAS aeration tank 2' }],
    },
    {
      key: 'blowers', title: 'Turbo blowers', icon: '💨', kind: 'table', view: 'cards', addLabel: 'Add blower', titleKeys: ['name'],
      help: 'Three turbo blowers, NX150-C070, 5914 m³/hr, 415 V (Usha Neuros). Bearing temperature above 75 °C and vibration above 7.1 mm/s are flagged.',
      fields: [
        { key: 'name', label: 'Blower', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'airflow', label: 'Air flow', type: 'number', unit: 'm³/hr', max: 100_000, step: '1' },
        { key: 'pressure', label: 'Discharge pressure', type: 'number', unit: 'bar', max: 50, step: '0.01' },
        { key: 'current', label: 'Motor current', type: 'number', unit: 'A', max: 5000, step: '0.1' },
        { key: 'temp', label: 'Bearing temp', type: 'number', unit: '°C', max: 250, step: '1', warn: hot(75) },
        { key: 'vib', label: 'Vibration', type: 'number', unit: 'mm/s', max: 100, step: '0.1', warn: vibration },
        { key: 'filter', label: 'Intake filter', type: 'select', options: ['Clean', 'Dirty', 'Choked'], status: true },
        { key: 'hours', label: 'Run hours (total)', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['TB-1 Turbo blower 1', 'TB-2 Turbo blower 2', 'TB-3 Turbo blower 3']),
    },
    {
      key: 'diffusers', title: 'Diffusers & air headers', icon: '🔲', kind: 'table', view: 'table', addLabel: 'Add tank', titleKeys: ['name'],
      help: 'Strip type diffusers (4 m x 300 mm, Eurotek). Check the bubble pattern and the air header joints.',
      fields: [
        { key: 'name', label: 'Tank', type: 'text', carry: true },
        { key: 'bubbles', label: 'Bubble pattern', type: 'select', options: ['Uniform', 'Patchy', 'Clogged'], status: true },
        { key: 'header', label: 'Air header', type: 'select', options: ['OK', 'Leaking'], status: true },
        { key: 'maintained', label: 'Last cleaned / replaced', type: 'date', carry: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['IFAS aeration tank 1', 'IFAS aeration tank 2']),
    },
    // ── 7 MGD WWTP: clarification and tertiary ──
    {
      key: 'settlers', title: 'Secondary tube settlers', icon: '🏊', kind: 'table', view: 'cards', addLabel: 'Add settler', titleKeys: ['name'],
      help: 'Two tube settler tanks (tube deck media, MM Aqua) with KGV-450 sludge valves (Jupiter).',
      fields: [
        { key: 'name', label: 'Settler', type: 'text', carry: true },
        { key: 'weir', label: 'Overflow weir', type: 'select', options: ['Normal', 'Choked', 'Overflowing'], status: true },
        { key: 'float', label: 'Floating sludge', type: 'select', options: ['None', 'Minor', 'Heavy'], status: true },
        { key: 'tubes', label: 'Tube deck', type: 'select', options: ['OK', 'Algae growth', 'Damaged'], status: true },
        { key: 'water', label: 'Treated water', type: 'select', options: ['Clear', 'Slightly turbid', 'Turbid'], status: true },
        { key: 'valve', label: 'Sludge valve KGV-450', type: 'select', options: ['OK', 'Leaking', 'Stuck'], status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Secondary tube settler 1', 'Secondary tube settler 2']),
    },
    {
      key: 'discfilters', title: 'Disc filters (tertiary)', icon: '💿', kind: 'table', view: 'cards', addLabel: 'Add filter', titleKeys: ['name'],
      help: 'Two disc filters, MSF 20/100, 2983 m³/hr each (Mita).',
      fields: [
        { key: 'name', label: 'Disc filter', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'dp', label: 'Level difference', type: 'number', unit: 'mm', max: 2000, step: '1' },
        { key: 'backwash', label: 'Backwashes today', type: 'number', max: 1000, step: '1' },
        { key: 'current', label: 'Drive current', type: 'number', unit: 'A', max: 500, step: '0.1' },
        { key: 'cloth', label: 'Filter cloth', type: 'select', options: ['OK', 'Choked', 'Torn'], status: true },
        { key: 'turbidity', label: 'Filtrate turbidity', type: 'number', unit: 'NTU', max: 1000, step: '0.1' },
        { key: 'hours', label: 'Run hours (total)', type: 'number', unit: 'hrs', max: 1_000_000, step: '1' },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Disc filter 1', 'Disc filter 2']),
    },
    {
      key: 'uv', title: 'UV disinfection banks', icon: '🔆', kind: 'table', view: 'cards', addLabel: 'Add bank', titleKeys: ['name'],
      help: '3 banks of 20 lamps each (Xylem), 46.31 kW. Lamps working below 20 is amber, below 18 is red.',
      fields: [
        { key: 'name', label: 'UV bank', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'lamps', label: 'Lamps working (of 20)', type: 'number', max: 20, step: '1', warn: (v) => (typeof v === 'number' ? (v < 18 ? 'bad' : v < 20 ? 'warn' : undefined) : undefined) },
        { key: 'intensity', label: 'UV intensity', type: 'number', unit: '%', max: 100, step: '1', warn: (v) => (typeof v === 'number' && v < 70 ? 'bad' : undefined) },
        { key: 'lamp_hours', label: 'Lamp hours', type: 'number', unit: 'hrs', max: 100_000, step: '1' },
        { key: 'sleeves', label: 'Quartz sleeves', type: 'select', options: ['Clean', 'Fouled', 'Cleaned today'], status: true },
        { key: 'alarm', label: 'Alarm', type: 'select', options: ['None', 'Lamp fault', 'Low intensity', 'Ballast fault'], status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['UV bank 1', 'UV bank 2', 'UV bank 3']),
    },
    // ── sludge ──
    {
      key: 'sludge_pumps', title: 'RAS & WAS pumps', icon: '🔁', kind: 'table', view: 'cards', addLabel: 'Add pump', titleKeys: ['name'],
      help: 'RAS: 3 pumps, 17.5 HP / 10.4 kW / 425 m³/hr (Aqua), MCC-2. WAS: 2 pumps, 60 HP / 45 kW / 50 m³/hr (Kirloskar), MCC-3. All VFD driven.',
      fields: rotating([
        { key: 'flow', label: 'Flow', type: 'number', unit: 'm³/hr', max: 5000, step: '1' },
        { key: 'valves', label: 'NRV / KGV', type: 'select', options: ['OK', 'Leaking', 'Stuck'], status: true },
      ]),
      seed: names(['RAS pump 1', 'RAS pump 2', 'RAS pump 3', 'WAS pump 1', 'WAS pump 2']),
    },
    {
      key: 'sludge_tanks', title: 'Sludge holding tank & RAS sump', icon: '🛢', kind: 'fields', view: 'stats',
      fields: [
        { key: 'holding', label: 'Sludge holding tank level', type: 'number', unit: 'm', max: 20, step: '0.01' },
        { key: 'ras_sump', label: 'RAS sump level', type: 'number', unit: 'm', max: 20, step: '0.01' },
        { key: 'ras_conc', label: 'RAS concentration', type: 'number', unit: 'mg/L', max: 50_000, step: '10' },
        { key: 'was_vol', label: 'WAS wasted today', type: 'number', unit: 'm³', max: 100_000, step: '1' },
        { key: 'condition', label: 'Condition', type: 'select', options: ['Normal', 'Odour', 'Foaming', 'Overflow risk'] },
      ],
    },
    // ── instruments ──
    {
      key: 'flows', title: 'Flow meters', icon: '💧', kind: 'table', view: 'cards', addLabel: 'Add flow meter', titleKeys: ['point'],
      help: 'Instantaneous flow and the totaliser reading at the time of the round. The 800 mm electromagnetic meter on the WWPS delivery line is by Siemens.',
      fields: [
        { key: 'point', label: 'Flow meter', type: 'text', carry: true },
        { key: 'value', label: 'Flow', type: 'number', unit: 'm³/hr', max: 100_000, step: '0.1' },
        { key: 'total', label: 'Totaliser', type: 'number', unit: 'm³', max: 1_000_000_000, step: '1' },
        { key: 'time', label: 'Time', type: 'time' },
        { key: 'trend', label: 'Trend', type: 'select', options: ['Rising', 'Steady', 'Falling'] },
        { key: 'check', label: 'Meter', type: 'select', options: ['OK', 'Reading doubtful', 'Faulty'], status: true },
      ],
      seed: [{ point: 'WWPS delivery - 800 mm EM flow meter' }, { point: '7 MGD WWTP inlet' }, { point: 'Treated water outlet' }, { point: 'RAS flow' }, { point: 'WAS flow' }],
    },
    // ── maintenance ──
    pmSection([
      { equipment: 'Raw sewage pumps (5) and motors', task: 'Grease bearings, check coupling, gland / seal', frequency: 'Monthly' },
      { equipment: 'Raw sewage pumps (5)', task: 'Check alignment, vibration and noise', frequency: 'Quarterly' },
      { equipment: 'Delivery valves and Rotork actuators', task: 'Operate and grease, check limit switches', frequency: 'Monthly' },
      { equipment: 'Coarse / fine bar screens and conveyors', task: 'Check rake chain, gearbox oil, scrapers, belt tension', frequency: 'Weekly' },
      { equipment: 'Grit mechanisms and screw classifiers', task: 'Gearbox oil level, scraper and screw wear', frequency: 'Monthly' },
      { equipment: 'Sluice gates (all)', task: 'Operate through full travel and grease stems', frequency: 'Monthly' },
      { equipment: 'Anoxic mixers', task: 'Check gearbox oil, mounting and vibration', frequency: 'Monthly' },
      { equipment: 'Turbo blowers (3)', task: 'Clean intake filters, check bearing and vibration trend', frequency: 'Weekly' },
      { equipment: 'Diffusers and air headers', task: 'Inspect bubble pattern, flush headers', frequency: 'Quarterly' },
      { equipment: 'Disc filters (2)', task: 'Inspect and clean filter cloth, check drive and backwash nozzles', frequency: 'Monthly' },
      { equipment: 'UV banks (3)', task: 'Clean quartz sleeves, check lamp hours and ballasts', frequency: 'Monthly' },
      { equipment: 'RAS / WAS pumps (5)', task: 'Grease bearings, check seals and valves', frequency: 'Monthly' },
      { equipment: 'Tube settlers', task: 'Clean weirs and remove algae from tube decks', frequency: 'Weekly' },
    ]),
    workOrderSection(),
    sparesSection([
      { item: 'Grease (bearing grade)', unit: 'kg' }, { item: 'Gearbox oil', unit: 'litres' }, { item: 'Mechanical seals / gland packing', unit: 'sets' },
      { item: 'Bearings (pump / motor)', unit: 'nos' }, { item: 'UV lamps', unit: 'nos' }, { item: 'UV quartz sleeves', unit: 'nos' },
      { item: 'Disc filter cloth / panels', unit: 'nos' }, { item: 'Blower intake filters', unit: 'nos' }, { item: 'Screen rake chain links', unit: 'nos' },
    ]),
  ],
};

