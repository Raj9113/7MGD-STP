import type { DeptSchema, Field, Row, Section } from '../schema';
import { names, sparesSection } from './common';

const taskFields: Field[] = [
  { key: 'area', label: 'Area', type: 'text', carry: true },
  { key: 'task', label: 'Task', type: 'text', carry: true },
  { key: 'status', label: 'Status', type: 'select', options: ['Done', 'In Progress', 'Pending'], status: true },
  { key: 'by', label: 'Done by', type: 'text' },
  { key: 'remarks', label: 'Remarks', type: 'text' },
];

const rows = (list: [string, string][]): Row[] => list.map(([area, task]) => ({ area, task }));

const supervisor = (key: string, title: string, icon: string, from: number, to: number): Section => ({
  key, title, icon, kind: 'fields', view: 'stats', shift: { from, to }, fields: [{ key: 'supervisor', label: 'Supervisor', type: 'text', loginName: true }],
});

const tasks = (key: string, title: string, seed?: Row[]): Section => ({
  key, title, icon: '🧽', kind: 'table', view: 'table', addLabel: 'Add task', titleKeys: ['area'], fields: taskFields, seed,
});

const okAttention = ['OK', 'Needs attention', 'Missing'];

export const HOUSEKEEPING: DeptSchema = {
  slug: 'housekeeping', label: 'Housekeeping', role: 'Housekeeping', icon: '🧹',
  blurb: 'Shift cleaning rounds, waste and sludge disposal, sanitation, greenery, pest control, safety checks, consumables and PPE',
  accent: { ring: 'border-green-200', text: 'text-green-700', bg: 'bg-green-50', solid: 'bg-green-600' },
  sections: [
    supervisor('morning', 'Morning shift (07:00-15:00)', '🌅', 7, 15),
    tasks('morning_tasks', 'Morning shift - process area cleaning', rows([
      ['WWPS - receiving chamber & coarse screen chamber', 'Clear debris and screenings, wash down'],
      ['WWPS - pump house & wet well platform', 'Sweep, mop and remove oil / water spills'],
      ['Inlet chamber & fine screen channels', 'Remove screenings, wash walkways and grating'],
      ['Grit chambers & classifier area', 'Remove grit spillage, wash platform'],
      ['Anaerobic, anoxic & aeration tank walkways', 'Sweep, remove scum and floating matter from edges'],
      ['Secondary tube settler tanks', 'Clean weirs and launders, remove floating sludge'],
      ['Disc filter tanks & UV channel', 'Clean walkways, remove algae and growth from edges'],
      ['Sludge holding tank, RAS & WAS pump houses', 'Clean floors and drains, check odour'],
      ['Blower room', 'Dusting, floor mopping, oil spill check'],
    ])),
    supervisor('general', 'General shift (09:00-17:00)', '🏢', 9, 17),
    tasks('general_tasks', 'General shift - buildings & offices', rows([
      ['Administration building - offices, corridors & stairs', 'Sweep, mop and dust'],
      ['Administration building - toilets', 'Clean and disinfect'],
      ['Laboratory room', 'Bench cleaning and waste disposal'],
      ['Control room / SCADA room', 'Dust-free cleaning, AC filter check'],
      ['Chemical & store room', 'Sweep and arrange stock'],
      ['LT PMCC panel room, RMU / metering / HT rooms', 'Dry cleaning only, with electrical staff present'],
      ['Drinking water points', 'Clean and refill'],
    ])),
    supervisor('evening', 'Evening shift (15:00-23:00)', '🌇', 15, 23),
    tasks('evening_tasks', 'Evening shift - roads, drains & outdoor', rows([
      ['Plant roads and boundary', 'Sweeping, remove litter'],
      ['Transformer area & switch yard surroundings', 'Weed removal, keep area clear'],
      ['Open drains and sumps', 'Clear blockages and silt'],
      ['Effluent outlet and treated water channel', 'Clean and inspect'],
      ['Staff toilets and rest room', 'Clean and disinfect'],
      ['Garbage bins', 'Empty and clean'],
    ])),
    supervisor('night', 'Night shift (23:00-07:00)', '🌙', 23, 7),
    tasks('night_tasks', 'Night shift - rounds', rows([
      ['Plant lighting and walkways', 'Check lights, report any dark areas'],
      ['Tank walkways and handrails', 'Look for spills and slip hazards'],
      ['Odour points (inlet, sludge holding tank)', 'Check and report odour'],
    ])),
    {
      key: 'chemicals', title: 'Laboratory chemicals & consumables stock', icon: '🧪', kind: 'table', view: 'table', addLabel: 'Add item', titleKeys: ['name'], maxRows: 150,
      help: 'Copied from the U.K. Scientific Industries register of 27-07-2026 (received / used / balance). Update "Used so far" when stock is used and "Received" when new stock comes; the balance is worked out for you and turns red at or below the reorder level.',
      fields: [
        { key: 'name', label: 'Item', type: 'text', carry: true },
        { key: 'kind', label: 'Type', type: 'select', options: ['Chemical', 'Glassware & consumables', 'Filter paper', 'Instrument'], carry: true },
        { key: 'received', label: 'Received', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'used', label: 'Used so far', type: 'number', max: 1_000_000, step: '1', carry: true },
        {
          key: 'balance', label: 'Balance', type: 'number',
          derive: (r) => (typeof r.received === 'number' ? Math.max(0, r.received - (typeof r.used === 'number' ? r.used : 0)) : undefined),
          warn: (_v, r) => (typeof r.received === 'number' && typeof r.reorder === 'number' && r.received - (typeof r.used === 'number' ? r.used : 0) <= r.reorder ? 'bad' : undefined),
        },
        { key: 'reorder', label: 'Reorder level', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: [
        { name: 'Manganous Sulphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Sodium Hydroxide 500 gm', kind: 'Chemical', received: 3, used: 1 },
        { name: 'Potassium Iodide 500 gm', kind: 'Chemical', received: 1 },
        { name: 'Sodium Thiosulphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Starch 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Glass Microfiber Filters (GFC paper)', kind: 'Filter paper', received: 5 },
        { name: 'Filter Paper No. 1, 125 mm', kind: 'Filter paper', received: 2 },
        { name: 'Filter Paper 42, 125 mm', kind: 'Filter paper', received: 2 },
        { name: 'Filter Paper No. 41, 125 mm', kind: 'Filter paper', received: 2 },
        { name: 'Glassware Cleaning Liquid (1 L)', kind: 'Glassware & consumables', received: 5, used: 1 },
        { name: 'Petri dish 80 x 17 mm', kind: 'Glassware & consumables', received: 6 },
        { name: 'Zinc Acetate 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Iodine 100 gm', kind: 'Chemical', received: 1 },
        { name: 'Stannous Chloride 250 gm', kind: 'Chemical', received: 4, used: 1 },
        { name: 'Glycerol (Glycerine) 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Ammonium Molybdate 250 gm', kind: 'Chemical', received: 4, used: 1 },
        { name: 'Magnesium Sulphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Ferric Chloride 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Calcium Chloride 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Potassium Dihydrogen Phosphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Di-Potassium Hydrogen Phosphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Di-Sodium Hydrogen Phosphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Ammonium Chloride 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Nessler\'s Reagent 100 ml', kind: 'Chemical', received: 2 },
        { name: 'Zinc Sulphate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Silver Nitrate 25 gm', kind: 'Chemical', received: 2 },
        { name: 'Potassium Chromate 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Methyl Orange 25 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Potassium Permanganate 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Ethyl Alcohol 500 ml', kind: 'Chemical', received: 2 },
        { name: 'Sodium Chloride 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Sodium Carbonate 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Sodium Sulphate 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Sulphamic Acid 500 gm', kind: 'Chemical', received: 2 },
        { name: 'Potassium Iodide 250 gm (1)', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Iodine 100 gm (2)', kind: 'Chemical', received: 10 },
        { name: 'Ascorbic Acid 500 gm', kind: 'Chemical', received: 1 },
        { name: 'Nitric Acid 500 ml', kind: 'Chemical', received: 2 },
        { name: 'Petroleum Ether 500 ml', kind: 'Chemical', received: 2 },
        { name: 'EDTA Di Sodium Salt 100 gm', kind: 'Chemical', received: 2 },
        { name: 'Sulphuric Acid 2.5 Ltr', kind: 'Chemical', received: 2 },
        { name: 'Hydrochloric Acid 2.5 Ltr', kind: 'Chemical', received: 1 },
        { name: 'Potassium Iodide 250 gm (2)', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Copper Sulphate (Cupric Sulphate)', kind: 'Chemical', received: 2 },
        { name: 'Silica Gel 500 gm', kind: 'Chemical', received: 2, used: 1 },
        { name: 'Silica Crucible 25 ml', kind: 'Glassware & consumables', received: 2, used: 1 },
        { name: 'Burette Borosil 25 ml', kind: 'Glassware & consumables', received: 1 },
        { name: 'Burette Borosil 50 ml', kind: 'Glassware & consumables', received: 1 },
        { name: 'Burette Stand', kind: 'Instrument', received: 1 },
        { name: 'DO Meter Benchtop', kind: 'Instrument', received: 1 },
        { name: 'Potassium Dichromate', kind: 'Chemical' },
        { name: 'Silver Sulphate 25 g', kind: 'Chemical' },
        { name: 'Ferrion Indicator', kind: 'Chemical' },
        { name: 'Ferrous Ammonium Sulphate (FAS)', kind: 'Chemical' },
        { name: 'Mercuric Sulphate (HgSO4)', kind: 'Chemical' },
      ],
    },
    {
      key: 'waste', title: 'Waste & sludge disposal - today', icon: '🚛', kind: 'table', view: 'table', addLabel: 'Add trip', titleKeys: ['material', 'vehicle'],
      help: 'Screenings and grit from both plants, sludge and general waste leaving the site.',
      fields: [
        { key: 'material', label: 'Material', type: 'select', options: ['Screenings', 'Grit', 'Sludge', 'General waste', 'Garden waste'] },
        { key: 'quantity', label: 'Quantity', type: 'number', unit: 'MT', max: 10_000, step: '0.1' },
        { key: 'vehicle', label: 'Vehicle no.', type: 'text' },
        { key: 'driver', label: 'Driver', type: 'text' },
        { key: 'destination', label: 'Destination', type: 'text' },
        { key: 'time', label: 'Time', type: 'time' },
      ],
    },
    {
      key: 'sanitation', title: 'Toilets & drinking water', icon: '🚻', kind: 'table', view: 'table', addLabel: 'Add block', titleKeys: ['name'],
      fields: [
        { key: 'name', label: 'Toilet block / water point', type: 'text', carry: true },
        { key: 'cleaned', label: 'Times cleaned', type: 'number', max: 50, step: '1' },
        { key: 'water', label: 'Water', type: 'select', options: ['Available', 'Low', 'Not available'], status: true },
        { key: 'supplies', label: 'Soap / supplies', type: 'select', options: ['OK', 'Low', 'Missing'], status: true },
        { key: 'condition', label: 'Condition', type: 'select', options: ['Clean', 'Needs attention', 'Out of order'], status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Administration building toilets', 'Staff toilets', 'WWPS toilet', 'Drinking water cooler / points']),
    },
    {
      key: 'greenery', title: 'Greenery & landscaping', icon: '🌿', kind: 'fields', view: 'stats',
      fields: [
        { key: 'watered', label: 'Plants watered', type: 'select', options: ['Yes', 'No', 'Not needed'] },
        { key: 'water_used', label: 'Treated water used', type: 'number', unit: 'kL', max: 10_000, step: '0.1' },
        { key: 'mowed', label: 'Lawn mowed / trimmed', type: 'select', options: ['Yes', 'No', 'Not needed'] },
        { key: 'waste', label: 'Garden waste removed', type: 'number', unit: 'kg', max: 100_000, step: '1' },
      ],
    },
    {
      key: 'pest', title: 'Pest & mosquito control', icon: '🦟', kind: 'table', view: 'table', addLabel: 'Add area', titleKeys: ['area'],
      fields: [
        { key: 'area', label: 'Area', type: 'text', carry: true },
        { key: 'type', label: 'Treatment', type: 'text', carry: true },
        { key: 'today', label: 'Done today', type: 'select', options: ['Done', 'Not done', 'Not due'], status: true },
        { key: 'last_done', label: 'Last done', type: 'date', carry: true },
        { key: 'next_due', label: 'Next due', type: 'date', carry: true },
      ],
      seed: [
        { area: 'Inlet chamber, grit chambers & screens', type: 'Fly and mosquito spray' }, { area: 'Sludge holding tank & surroundings', type: 'Larvicide / fogging' },
        { area: 'Tank edges, drains and standing water', type: 'Mosquito larvicide' }, { area: 'Administration building & store room', type: 'Rodent bait / cockroach control' },
        { area: 'Plant boundary and gardens', type: 'Fogging' },
      ],
    },
    {
      key: 'safety', title: 'Safety & hygiene checks', icon: '🦺', kind: 'table', view: 'table', addLabel: 'Add check', titleKeys: ['name'],
      help: 'Daily walk-round.',
      fields: [
        { key: 'name', label: 'Check', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: okAttention, status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names([
        'Fire extinguishers in place and in date', 'First-aid boxes stocked', 'Emergency eyewash / shower working', 'Walkway handrails and gratings secure',
        'Manhole and chamber covers in place', 'Safety signs and PPE notices visible', 'Confined-space entry permits followed', 'Slip hazards on walkways cleared',
      ]),
    },
    {
      ...sparesSection([
      { item: 'Phenyl / floor disinfectant', unit: 'litres' }, { item: 'Floor cleaner', unit: 'litres' }, { item: 'Toilet cleaner', unit: 'litres' },
      { item: 'Bleaching powder', unit: 'kg' }, { item: 'Hand wash / soap', unit: 'litres' }, { item: 'Garbage bags', unit: 'packs' },
      { item: 'Brooms, mops and brushes', unit: 'nos' },
      ]),
      key: 'consumables', title: 'Cleaning materials & consumables', icon: '🧴',
    },
    {
      key: 'ppe', title: 'PPE stock', icon: '🧤', kind: 'table', view: 'table', addLabel: 'Add item', titleKeys: ['item'],
      fields: [
        { key: 'item', label: 'Item', type: 'text', carry: true },
        { key: 'stock', label: 'In stock', type: 'number', max: 1_000_000, step: '1', carry: true, warn: (v, row) => (typeof v === 'number' && typeof row.required === 'number' && v < row.required ? 'bad' : undefined) },
        { key: 'required', label: 'Required', type: 'number', max: 1_000_000, step: '1', carry: true },
        { key: 'issued', label: 'Issued today', type: 'number', max: 100_000, step: '1' },
        { key: 'unit', label: 'Unit', type: 'text', carry: true, placeholder: 'pcs / pairs' },
      ],
      seed: [
        { item: 'Safety helmets', unit: 'pcs' }, { item: 'Rubber boots', unit: 'pairs' }, { item: 'Chemical-resistant gloves', unit: 'pairs' },
        { item: 'Safety goggles', unit: 'pcs' }, { item: 'Half-face respirators', unit: 'pcs' }, { item: 'Reflective vests', unit: 'pcs' },
      ],
    },
  ],
};
