import type { DeptSchema, Field } from '../schema';
import { above, equipStatus, hot, names, pmSection, sparesSection, workOrderSection } from './common';

const pfWarn = (v: number | string | undefined) => (typeof v === 'number' && v < 0.9 ? ('warn' as const) : undefined);

const phase = (key: string, label: string, unit: string, max: number, step = '0.1'): Field => ({ key, label, type: 'number', unit, max, step });

export const ELECTRICAL: DeptSchema = {
  slug: 'electrical', label: 'Electrical', role: 'Electrical', icon: '⚡',
  blurb: '11 kV supply, VCB, transformers, PMCC, MCC panels and VFDs, energy, SCADA and preventive maintenance',
  accent: { ring: 'border-yellow-200', text: 'text-yellow-700', bg: 'bg-yellow-50', solid: 'bg-yellow-600' },
  sections: [
    {
      key: 'power', title: '11 kV incoming supply (BSES)', icon: '🔌', kind: 'fields', view: 'stats',
      help: 'Readings of the incomer from the BSES RMU / metering room.',
      fields: [
        phase('v_ry', 'Line voltage R-Y', 'kV', 15, '0.01'), phase('v_yb', 'Line voltage Y-B', 'kV', 15, '0.01'), phase('v_br', 'Line voltage B-R', 'kV', 15, '0.01'),
        phase('i_r', 'Current R', 'A', 5000), phase('i_y', 'Current Y', 'A', 5000), phase('i_b', 'Current B', 'A', 5000),
        { key: 'freq', label: 'Frequency', type: 'number', unit: 'Hz', max: 70, step: '0.01' },
        { key: 'pf', label: 'Power factor', type: 'number', max: 1, step: '0.01', warn: pfWarn },
        { key: 'load', label: 'Total load', type: 'number', unit: 'kW', max: 100_000, step: '0.1' },
        { key: 'kva', label: 'Apparent load', type: 'number', unit: 'kVA', max: 100_000, step: '0.1' },
        { key: 'supply', label: 'Supply', type: 'select', options: ['Normal', 'Interruption', 'Low voltage', 'High voltage'] },
        { key: 'outage', label: 'Outage today', type: 'number', unit: 'min', max: 1440, step: '1', warn: above(0, 'warn') },
      ],
    },
    {
      key: 'energy', title: 'Energy consumption', icon: '📊', kind: 'fields', view: 'stats',
      help: 'The plant total used today. The laboratory report\'s energy-meter reading is entered in the next section.',
      fields: [
        { key: 'units', label: 'Energy used today', type: 'number', unit: 'kWh', max: 1_000_000, step: '1' },
        { key: 'max_demand', label: 'Maximum demand', type: 'number', unit: 'kVA', max: 100_000, step: '0.1' },
      ],
    },
    {
      key: 'meter', title: 'Energy meter 1 (laboratory report)', icon: '🧮', kind: 'fields', view: 'stats',
      help: 'The reading printed on the laboratory daily report (Word / PDF). Open is yesterday\'s close. Difference and total units are worked out for you: units = (close - open) x multiplication factor.',
      fields: [
        { key: 'open', label: 'Open reading', type: 'number', max: 10_000_000, step: '0.01', carryFrom: 'close' },
        { key: 'close', label: 'Close reading', type: 'number', max: 10_000_000, step: '0.01' },
        { key: 'multiplier', label: 'Multiplication factor', type: 'number', min: 1, max: 1_000_000, step: '1', carry: true },
        { key: 'pf', label: 'Power factor (meter)', type: 'number', max: 1, step: '0.01', warn: pfWarn },
        { key: 'diff', label: 'Difference', type: 'number', derive: (r) => (typeof r.open === 'number' && typeof r.close === 'number' && r.close >= r.open ? Math.round((r.close - r.open) * 100) / 100 : undefined) },
        { key: 'units', label: 'Total units', type: 'number', unit: 'kWh', derive: (r) => (typeof r.open === 'number' && typeof r.close === 'number' && r.close >= r.open ? Math.round(((r.close - r.open) * (typeof r.multiplier === 'number' ? r.multiplier : 1)) * 100) / 100 : undefined) },
      ],
      seed: [{ multiplier: 2000 }],
      check: (r) => ((typeof r.open === 'number') !== (typeof r.close === 'number') ? { field: 'close', message: 'Enter both the open and the close reading.' }
        : typeof r.open === 'number' && typeof r.close === 'number' && r.close < r.open ? { field: 'close', message: 'Close reading cannot be lower than the open reading.' } : undefined),
    },
    {
      key: 'vcb', title: 'HT switchgear - 11 kV VCB', icon: '🔀', kind: 'table', view: 'cards', addLabel: 'Add breaker', titleKeys: ['name'],
      help: '11 kV VCB, 1 incomer and 2 outgoing (L&T VK10L25H, 800 A, 26.3 kA).',
      fields: [
        { key: 'name', label: 'Breaker', type: 'text', carry: true },
        { key: 'state', label: 'State', type: 'select', options: ['In service', 'Off', 'Tripped'], status: true },
        { key: 'spring', label: 'Spring', type: 'select', options: ['Charged', 'Not charged'], status: true },
        { key: 'relay', label: 'Protection relay', type: 'select', options: ['Healthy', 'Alarm', 'Trip'], status: true },
        phase('current', 'Load current', 'A', 2000),
        { key: 'ops', label: 'Operations counter', type: 'number', max: 1_000_000, step: '1' },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['VCB 1 - 11 kV incomer', 'VCB 2 - outgoing to transformer 1', 'VCB 3 - outgoing to transformer 2']),
    },
    {
      key: 'transformers', title: 'Transformers - 11 kV / 0.433 kV, 1250 kVA', icon: '🏭', kind: 'table', view: 'cards', addLabel: 'Add transformer', titleKeys: ['name'],
      help: 'Two ONAN transformers (Voltamps). Oil above 85 °C or winding above 95 °C is flagged.',
      fields: [
        { key: 'name', label: 'Transformer', type: 'text', carry: true },
        { key: 'state', label: 'State', type: 'select', options: ['In service', 'Standby', 'Tripped', 'Under maintenance'], status: true },
        { key: 'lv_v', label: 'LV voltage', type: 'number', unit: 'V', max: 1000, step: '1' },
        { key: 'lv_i', label: 'LV current', type: 'number', unit: 'A', max: 5000, step: '1' },
        { key: 'load', label: 'Load', type: 'number', unit: '%', bar: true, max: 150, min: 0, step: '1', warn: above(100, 'warn') },
        { key: 'oil_t', label: 'Oil temperature', type: 'number', unit: '°C', max: 200, step: '1', warn: hot(85) },
        { key: 'wdg_t', label: 'Winding temperature', type: 'number', unit: '°C', max: 250, step: '1', warn: hot(95) },
        { key: 'oil_lvl', label: 'Oil level', type: 'select', options: ['Normal', 'Low oil'], status: true },
        { key: 'relays', label: 'Buchholz / PRV', type: 'select', options: ['Normal', 'Alarm', 'Trip'], status: true },
        { key: 'silica', label: 'Silica gel', type: 'select', options: ['Blue (good)', 'Pink (change)'] },
        { key: 'tap', label: 'Tap position', type: 'number', max: 30, step: '1' },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Transformer 1 (1250 kVA)', 'Transformer 2 (1250 kVA)']),
    },
    {
      key: 'pmcc', title: 'LT PMCC panel - incomers', icon: '🗄', kind: 'table', view: 'cards', addLabel: 'Add incomer', titleKeys: ['name'],
      help: 'LT PMCC with 3 incomers and 415 V outgoing feeders to MCC-1 to MCC-5.',
      fields: [
        { key: 'name', label: 'Incomer', type: 'text', carry: true },
        { key: 'breaker', label: 'Breaker', type: 'select', options: ['In service', 'Off', 'Tripped'], status: true },
        phase('volt', 'Voltage', 'V', 1000, '1'),
        phase('current', 'Current', 'A', 5000, '1'),
        phase('load', 'Load', 'kW', 5000),
        { key: 'pf', label: 'Power factor', type: 'number', max: 1, step: '0.01', warn: pfWarn },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['Incomer 1 (from transformer 1)', 'Incomer 2 (from transformer 2)', 'Incomer 3 (bus coupler / standby)']),
    },
    {
      key: 'mcc', title: 'MCC panels with PLC', icon: '🎛', kind: 'table', view: 'cards', addLabel: 'Add panel', titleKeys: ['name'],
      help: 'MCC-1 (preliminary / general), MCC-2 (RAS, 3 VFD), MCC-3 (WAS, 2 VFD), MCC-4 (UV), MCC-5 (WWPS, 5 VFD). Make: IMTB.',
      fields: [
        { key: 'name', label: 'Panel', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Healthy', 'Alert', 'Fault'], status: true },
        phase('volt', 'Incoming voltage', 'V', 1000, '1'),
        phase('current', 'Incoming current', 'A', 5000, '1'),
        { key: 'tripped', label: 'Tripped feeders', type: 'number', max: 1000, step: '1', warn: above(0) },
        { key: 'plc', label: 'PLC', type: 'select', options: ['Online', 'Offline', 'Fault'], status: true },
        { key: 'temp', label: 'Panel / room temp', type: 'number', unit: '°C', max: 100, step: '1', warn: above(45, 'warn') },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['MCC-1 (PMCC room)', 'MCC-2 (RAS pumps, 3 VFD)', 'MCC-3 (WAS pumps, 2 VFD)', 'MCC-4 (UV system)', 'MCC-5 (WWPS pumps, 5 VFD)']),
    },
    {
      key: 'vfds', title: 'VFD drives', icon: '🎚', kind: 'table', view: 'table', addLabel: 'Add drive', titleKeys: ['name'],
      help: 'Heat sink above 70 °C is flagged. Write the fault code shown on the drive, if any.',
      fields: [
        { key: 'name', label: 'Drive', type: 'text', carry: true },
        { key: 'status', label: 'Status', type: 'select', options: equipStatus, status: true },
        { key: 'hz', label: 'Output', type: 'number', unit: 'Hz', max: 60, step: '0.1' },
        phase('current', 'Current', 'A', 1000),
        { key: 'heat', label: 'Heat sink', type: 'number', unit: '°C', max: 150, step: '1', warn: hot(70) },
        { key: 'fault', label: 'Fault code', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names([
        'MCC-5 VFD 1 - raw pump 1', 'MCC-5 VFD 2 - raw pump 2', 'MCC-5 VFD 3 - raw pump 3', 'MCC-5 VFD 4 - raw pump 4', 'MCC-5 VFD 5 - raw pump 5',
        'MCC-2 VFD 1 - RAS pump 1', 'MCC-2 VFD 2 - RAS pump 2', 'MCC-2 VFD 3 - RAS pump 3', 'MCC-3 VFD 1 - WAS pump 1', 'MCC-3 VFD 2 - WAS pump 2',
      ]),
    },
    {
      key: 'scada', title: 'SCADA & instrumentation', icon: '🖥', kind: 'fields', view: 'stats',
      help: 'The plant is fully automated with PLC / SCADA.',
      fields: [
        { key: 'server', label: 'SCADA server', type: 'select', options: ['Online', 'Offline', 'Fault'], status: true },
        { key: 'comms', label: 'PLC communication', type: 'select', options: ['Normal', 'Intermittent', 'Lost'], status: true },
        { key: 'plc_fault', label: 'PLC faults', type: 'number', max: 1000, step: '1', warn: above(0, 'warn') },
        { key: 'backup', label: 'Last data backup', type: 'date' },
        { key: 'sensors', label: 'Instruments needing calibration', type: 'text', placeholder: 'e.g. DO probe, level sensor' },
      ],
    },
    {
      key: 'rooms', title: 'Electrical rooms - inspection', icon: '🚪', kind: 'table', view: 'table', addLabel: 'Add room', titleKeys: ['name'],
      fields: [
        { key: 'name', label: 'Room / area', type: 'text', carry: true },
        { key: 'fire', label: 'Fire extinguisher', type: 'select', options: ['OK', 'Expired', 'Missing'], status: true },
        { key: 'mat', label: 'Rubber mat / SLD', type: 'select', options: ['OK', 'Missing'], status: true },
        { key: 'cooling', label: 'Ventilation / AC', type: 'select', options: ['OK', 'Faulty'], status: true },
        { key: 'seepage', label: 'Water seepage', type: 'select', options: ['None', 'Seepage'], status: true },
        { key: 'remarks', label: 'Remarks', type: 'text' },
      ],
      seed: names(['BSES RMU room', 'BSES metering unit room', 'HT & switch yard room', 'Transformer area', 'LT PMCC panel room', 'Blower room panels']),
    },
    {
      key: 'alarms', title: 'Alarm history - today', icon: '🚨', kind: 'table', view: 'table', addLabel: 'Add alarm', titleKeys: ['id', 'desc'],
      carryMode: 'open-rows', doneWhen: { key: 'status', values: ['Cleared'] },
      help: 'Alarms that are not Cleared are carried to the next day.',
      fields: [
        { key: 'id', label: 'ID', type: 'text', carry: true },
        { key: 'time', label: 'Time', type: 'time', carry: true },
        { key: 'desc', label: 'Description', type: 'text', carry: true },
        { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High'], status: true, carry: true },
        { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Acknowledged', 'Cleared'], status: true },
      ],
    },
    pmSection([
      { equipment: '11 kV VCB (3)', task: 'Clean, check spring charging and operate on no load', frequency: 'Quarterly' },
      { equipment: 'Protection relays', task: 'Check settings, test trip circuits', frequency: 'Half-yearly' },
      { equipment: 'Transformers (2)', task: 'Check oil level, silica gel, tighten terminations, thermography', frequency: 'Monthly' },
      { equipment: 'Transformers (2)', task: 'Oil BDV test and dissolved gas check', frequency: 'Yearly' },
      { equipment: 'LT PMCC and MCC panels', task: 'Clean busbars and chambers, tighten connections, thermography', frequency: 'Quarterly' },
      { equipment: 'VFD drives (10)', task: 'Clean cooling fans and filters, check heat sink', frequency: 'Monthly' },
      { equipment: 'Motors (all)', task: 'Insulation resistance test', frequency: 'Half-yearly' },
      { equipment: 'Earthing and lightning protection', task: 'Earth pit resistance measurement', frequency: 'Yearly' },
      { equipment: 'PLC / SCADA', task: 'Backup programs and data, check UPS of the panel', frequency: 'Monthly' },
      { equipment: 'Energy meters', task: 'Compare meter reading with the BSES meter', frequency: 'Monthly' },
      { equipment: 'Lighting and small power', task: 'Check plant, road and room lighting', frequency: 'Weekly' },
    ]),
    workOrderSection(),
    sparesSection([
      { item: 'HRC fuses (assorted)', unit: 'nos' }, { item: 'Contactors', unit: 'nos' }, { item: 'Overload relays', unit: 'nos' }, { item: 'MCB / MCCB (assorted)', unit: 'nos' },
      { item: 'Indication lamps', unit: 'nos' }, { item: 'VFD cooling fans', unit: 'nos' }, { item: 'Cable lugs and glands', unit: 'nos' }, { item: 'Transformer silica gel', unit: 'kg' },
    ]),
  ],
};
