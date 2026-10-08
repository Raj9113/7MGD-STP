import type { PDFImage, RGB } from 'pdf-lib';
import { LIMITED, PARAM, dayLabel, fmtFlow, limitStatus, limitText, mean, type DayRecord, type DayReport, type LabData, type ParamKey } from '@/app/dashboard/laboratory/lab';
import { imageInfo } from '@/lib/lab-export/image';
import { SCHEMAS, asRow, asRows, attention, num, showValue, statusTone, type DeptData, type DeptSchema, type DeptSlug, type Field, type Row, type Section, type Tone } from '@/lib/dept-report/schema';
import { COLORS, CONTENT_W, Kit, PAGE, type CellStyle, type Logos } from './pdf-kit';

export interface ActivityRow {
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  department: string | null;
  action: string;
  details: string | null;
}

export interface DayPhotoBytes { kind: 'olms' | 'sample'; bytes: Buffer }
export interface DeptDayReport { data: DeptData; created_by_name: string | null; updated_by_name: string | null; updated_at: string }

export interface DailyReportInput {
  /** ISO dates, ascending */
  days: string[];
  /** File-based history merged with portal entries */
  lab: LabData;
  /** Mechanical / Electrical / Housekeeping daily reports, keyed `${dept}|${date}` */
  dept: Map<string, DeptDayReport>;
  activity: ActivityRow[];
  photos: Map<string, DayPhotoBytes[]>;
  generated: string;
  logos: Logos;
  /** Photos are re-encoded to this width (px); smaller = smaller file */
  photoWidth?: number;
}

const IST_MS = 5.5 * 3600 * 1000;
const istDate = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(0, 10);
const istTime = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(11, 16);
const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Login', LOGOUT: 'Logout', INVITE_USER: 'Invited user', UPDATE_ROLE: 'Role change', DELETE_USER: 'Deleted user',
  DATA_ENTRY: 'Data entry', DATA_UPDATE: 'Data update', DATA_DELETE: 'Data delete',
};

const RECORDED_TAG = { text: 'RECORDED DATA', fg: COLORS.good, bg: COLORS.goodBg };
const NO_DATA_TAG = { text: 'NO REPORT ENTERED', fg: COLORS.muted, bg: COLORS.grayBg };

const DEPT_COLOR: Record<DeptSlug, RGB> = { mechanical: COLORS.orange, electrical: COLORS.amber, housekeeping: COLORS.green };
const TONE_COLOR: Record<Tone, RGB> = { good: COLORS.good, warn: COLORS.amber, bad: COLORS.bad, info: COLORS.blue, muted: COLORS.muted };

const val = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const num2 = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(2) : '-');

type Row13 = ParamKey | 'flow';
const ROWS: { key: Row13; label: string; unit: string }[] = [
  { key: 'flow', label: 'Flow', unit: 'MGD' },
  { key: 'temp', label: 'Temperature', unit: '°C' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'bod', label: 'BOD', unit: 'mg/l' },
  { key: 'cod', label: 'COD', unit: 'mg/l' },
  { key: 'tss', label: 'TSS', unit: 'mg/l' },
  { key: 'phos', label: 'Phosphorus', unit: 'mg/l' },
  { key: 'alk', label: 'Total Alkalinity', unit: 'mg/l' },
  { key: 'do', label: 'Dissolved Oxygen - DO', unit: 'mg/l' },
  { key: 'tn', label: 'Total Nitrogen - TN', unit: 'mg/l' },
  { key: 'nh4', label: 'NH4-N', unit: 'mg/l' },
  { key: 'oil', label: 'Oil & Grease', unit: 'mg/l' },
  { key: 'coliform', label: 'Total Coliform', unit: 'MPN/100 ml' },
];

function readings(key: Row13, d: DayRecord | undefined): { in: string; out: string } {
  if (key === 'flow') return { in: val(d?.flow?.pumping) ?? '-', out: val(d?.flow?.treated) ?? '-' };
  const dash = key === 'coliform' ? '--' : '-';
  return { in: val(d?.[key]?.in) ?? (key === 'do' ? 'NIL' : dash), out: val(d?.[key]?.out) ?? dash };
}

const STATUS_STYLE = (s: ReturnType<typeof limitStatus>): { text: string; color: RGB; bold: boolean } =>
  s === 'ok' ? { text: 'Within limit', color: COLORS.good, bold: false }
  : s === 'over' ? { text: 'ABOVE LIMIT', color: COLORS.bad, bold: true }
  : s === 'under' ? { text: 'BELOW LIMIT', color: COLORS.bad, bold: true }
  : { text: '-', color: COLORS.muted, bold: false };

// ── images ───────────────────────────────────────────────────────────────────

async function embed(kit: Kit, bytes: Buffer, width: number): Promise<PDFImage | null> {
  try {
    const sharp = (await import('sharp')).default;
    return await kit.pdf.embedJpg(await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer());
  } catch {
    const info = imageInfo(bytes);
    if (info?.kind === 'jpeg') return kit.pdf.embedJpg(bytes);
    if (info?.kind === 'png') return kit.pdf.embedPng(bytes);
    return null;
  }
}

// ── department sections, drawn from their schemas ────────────────────────────

const WEIGHT: Record<string, number> = { name: 2.4, title: 2.6, desc: 2.8, task: 2.2, area: 2.2, destination: 2, remarks: 2.2, point: 2, item: 2.2, model: 2 };
const weight = (f: Field) => WEIGHT[f.key] ?? (f.type === 'text' ? 1.3 : f.type === 'select' ? 1.15 : f.type === 'date' ? 1.1 : f.type === 'time' ? 0.8 : 0.95);
const header = (f: Field) => (f.unit && f.type === 'number' ? `${f.label} (${f.unit})` : f.label);
const cellText = (f: Field, v: Row[string] | undefined) => (f.type === 'number' && typeof v === 'number' ? String(v) : showValue({ ...f, unit: undefined }, v));

const isDone = (sec: Section, r: Row) => !!sec.doneWhen && sec.doneWhen.values.includes(String(r[sec.doneWhen.key] ?? ''));
const rowBad = (sec: Section, r: Row) => !isDone(sec, r) && sec.fields.some((f) => (f.status && statusTone(r[f.key]) === 'bad') || f.warn?.(r[f.key], r) === 'bad');

/** Column widths by weight, but never narrower than the longest header word (so headers never break mid-word) */
function fitColumns(kit: Kit, fields: Field[], size: number): number[] {
  const min = fields.map((f) => Math.max(...header(f).split(' ').map((w) => kit.width(w, size, true))) + 10);
  const total = fields.reduce((a, f) => a + weight(f), 0);
  let widths = fields.map((f) => (weight(f) / total) * CONTENT_W);
  for (let pass = 0; pass < 4; pass++) {
    const short = widths.map((w, i) => Math.max(0, min[i] - w));
    const need = short.reduce((a, b) => a + b, 0);
    if (need < 0.5) break;
    const spare = widths.map((w, i) => Math.max(0, w - min[i]));
    const spareTotal = spare.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map((w, i) => (short[i] > 0 ? min[i] : w - (spare[i] / spareTotal) * need));
  }
  return widths;
}

function fieldStyle(f: Field, row: Row): CellStyle | undefined {
  const lv = f.warn?.(row[f.key], row);
  if (lv === 'bad') return { color: COLORS.bad, bold: true };
  if (lv === 'warn') return { color: COLORS.amber, bold: true };
  const tone = f.status ? statusTone(row[f.key]) : undefined;
  return tone ? { color: TONE_COLOR[tone], bold: tone === 'bad' } : undefined;
}

function deptSections(kit: Kit, schema: DeptSchema, data: DeptData, color: RGB) {
  kit.accent = color;
  for (const sec of schema.sections) {
    if (sec.kind === 'fields') {
      const row = asRow(data[sec.key]);
      const fields = sec.fields.filter((f) => row[f.key] !== undefined);
      if (!fields.length) continue;
      kit.subheading(sec.title, color);
      const lines: string[][] = [];
      for (let i = 0; i < fields.length; i += 2) {
        const [a, b] = [fields[i], fields[i + 1]];
        lines.push([a.label, showValue(a, row[a.key]), b?.label ?? '', b ? showValue(b, row[b.key]) : '']);
      }
      kit.table(
        [{ header: 'Item', w: 150 }, { header: 'Value', w: 107.64 }, { header: 'Item', w: 150 }, { header: 'Value', w: CONTENT_W - 407.64 }],
        lines,
        { size: 8, cell: (r, c) => (c === 1 || c === 3 ? (fields[r * 2 + (c === 3 ? 1 : 0)] ? fieldStyle(fields[r * 2 + (c === 3 ? 1 : 0)], row) : undefined) : c === 0 || c === 2 ? { bold: true } : undefined) },
      );
    } else {
      const rows = asRows(data[sec.key]);
      if (!rows.length) continue;
      kit.subheading(`${sec.title} (${rows.length})`, color);
      const widths = fitColumns(kit, sec.fields, 7.8);
      kit.table(
        sec.fields.map((f, i) => ({ header: header(f), w: widths[i], align: f.type === 'number' ? ('right' as const) : undefined })),
        rows.map((r) => sec.fields.map((f) => cellText(f, r[f.key]))),
        {
          size: 7.8,
          cell: (ri, ci) => {
            const r = rows[ri];
            const st = fieldStyle(sec.fields[ci], r);
            return rowBad(sec, r) ? { ...(st ?? {}), fill: COLORS.badBg } : st;
          },
        },
      );
    }
  }
  if (typeof data.remarks === 'string' && data.remarks) {
    kit.subheading('Remarks / observations', color);
    kit.note(data.remarks, { size: 8.5 });
  }
  kit.accent = COLORS.teal;
}

// ── one day ──────────────────────────────────────────────────────────────────

interface DayFacts {
  date: string;
  day?: DayRecord;
  power?: DayReport['power'];
  photos: number;
  over: ParamKey[];
  ok: number;
  measured: number;
  events: ActivityRow[];
  pageViews: number;
  depts: Record<DeptSlug, DeptDayReport | undefined>;
  deptCount: number;
  energyKwh: number | null;
  energySource: string;
}

function facts(date: string, input: DailyReportInput): DayFacts {
  const { lab, activity, dept } = input;
  const day = lab.months.flatMap((m) => m.days).find((d) => d.date === date);
  const states = LIMITED.map((k) => ({ k, s: limitStatus(k, day?.[k]?.out) })).filter((x) => x.s !== 'na');
  const all = activity.filter((a) => istDate(a.created_at) === date);
  const depts = { mechanical: dept.get(`mechanical|${date}`), electrical: dept.get(`electrical|${date}`), housekeeping: dept.get(`housekeeping|${date}`) };
  const power = lab.reports[date]?.power;
  const electricalKwh = depts.electrical ? num(asRow(depts.electrical.data.energy).units) : null;
  return {
    date, day, power, photos: lab.reports[date]?.photos.length ?? 0,
    over: states.filter((x) => x.s !== 'ok').map((x) => x.k), ok: states.filter((x) => x.s === 'ok').length, measured: states.length,
    events: all.filter((a) => a.action !== 'PAGE_VIEW'), pageViews: all.filter((a) => a.action === 'PAGE_VIEW').length,
    depts, deptCount: (day ? 1 : 0) + Object.values(depts).filter(Boolean).length,
    energyKwh: electricalKwh ?? power?.units ?? null,
    energySource: electricalKwh !== null ? 'electrical report' : power?.units != null ? 'lab energy meter' : 'no reading',
  };
}

/** A section with content starts a new page unless a good part of the current one is still free */
const sectionStart = (kit: Kit, hasData: boolean) => {
  if (hasData && kit.y > PAGE.top + 330) kit.addPage();
  else kit.space(16);
};

async function dayChapter(kit: Kit, f: DayFacts, input: DailyReportInput) {
  const { lab } = input;
  const monthKey = f.date.slice(0, 7);
  const monthAvg = mean(lab.months.find((m) => m.key === monthKey)?.days.map((d) => lab.reports[d.date]?.power?.units) ?? []);
  const live = lab.live?.[f.date];
  const tile = (key: ParamKey, label: string) => {
    const v = f.day?.[key]?.out;
    const st = limitStatus(key, v);
    const lim = lab.limits[key];
    return {
      label, value: val(v) ?? '-', sub: lim?.max !== undefined ? `limit <= ${lim.max} mg/l` : '',
      color: st === 'ok' ? COLORS.good : st === 'na' ? COLORS.muted : COLORS.bad, bg: st === 'ok' ? COLORS.goodBg : st === 'na' ? COLORS.grayBg : COLORS.badBg,
    };
  };
  const attn = (slug: DeptSlug) => attention(SCHEMAS[slug], f.depts[slug]?.data ?? null);

  // 1. Day summary
  kit.addPage();
  kit.text('DAILY PLANT REPORT', { size: 9, bold: true, color: COLORS.muted });
  kit.text(longDay(f.date), { size: 20, bold: true, color: COLORS.blue, gap: 6 });
  kit.tiles([
    { label: 'PUMPED FLOW (MGD)', value: fmtFlow(f.day?.flow?.pumping), sub: 'inlet', color: COLORS.blue },
    { label: 'TREATED FLOW (MGD)', value: fmtFlow(f.day?.flow?.treated), sub: 'outlet', color: COLORS.blue },
    tile('bod', 'OUTLET BOD'), tile('cod', 'OUTLET COD'),
    tile('tss', 'OUTLET TSS'), tile('phos', 'OUTLET PHOSPHORUS'),
    { label: 'ENERGY USED (kWh)', value: f.energyKwh != null ? f.energyKwh.toLocaleString('en-IN') : '-', sub: f.energySource, color: COLORS.amber, bg: COLORS.amberBg },
    { label: 'DEPARTMENT REPORTS', value: `${f.deptCount}/4`, sub: 'entered for this date', color: f.deptCount === 4 ? COLORS.good : COLORS.purple, bg: f.deptCount === 4 ? COLORS.goodBg : COLORS.stripe },
  ]);
  if (f.measured) {
    kit.note(
      f.over.length === 0
        ? `All ${f.measured} measured outlet parameters were within their permissible limits.`
        : `${f.ok} of ${f.measured} measured outlet parameters were within limits. Above limit: ${f.over.map((k) => (k === 'phos' ? 'Phosphorus' : PARAM[k].short)).join(', ')}.`,
      { fg: f.over.length ? COLORS.bad : COLORS.good, bg: f.over.length ? COLORS.badBg : COLORS.goodBg },
    );
  }

  kit.subheading('Department summary', COLORS.blue);
  const deptLine = (slug: DeptSlug): [string, string] => {
    const r = f.depts[slug];
    if (!r) return ['No report entered', `No ${SCHEMAS[slug].label.toLowerCase()} report was entered for this date`];
    const a = attn(slug);
    return ['Report entered', `By ${r.created_by_name ?? 'unknown'}. ${a.alerts ? `${a.alerts} item${a.alerts > 1 ? 's' : ''} need attention: ${a.notes.join('; ')}.` : 'Nothing flagged.'}`];
  };
  const rows: [string, string, string][] = [
    ['Laboratory', f.day ? 'Report entered' : 'No report entered', f.day ? `${f.photos ? `${f.photos} photograph${f.photos > 1 ? 's' : ''}` : 'No photographs'}${live ? ', entered on the portal' : ', from the lab Excel/Word files'}. ${f.over.length ? `${f.over.length} outlet value${f.over.length > 1 ? 's' : ''} above limit.` : f.measured ? 'All limits met.' : ''}` : 'No laboratory report was recorded for this date'],
    ['Mechanical', ...deptLine('mechanical')],
    ['Electrical', ...deptLine('electrical')],
    ['Housekeeping', ...deptLine('housekeeping')],
    ['Portal activity', f.events.length ? 'Recorded' : 'None', `${f.events.length} event${f.events.length === 1 ? '' : 's'} logged${f.pageViews ? ` (+${f.pageViews} page views not listed)` : ''}`],
  ];
  kit.table(
    [{ header: 'Department', w: 90 }, { header: 'Report', w: 90 }, { header: 'Status', w: CONTENT_W - 180 }],
    rows,
    { cell: (_r, c, t) => (c === 0 ? { bold: true } : c === 1 ? (t === 'No report entered' || t === 'None' ? { color: COLORS.muted } : { color: COLORS.good, bold: true }) : undefined) },
  );

  // 2. Laboratory
  kit.addPage();
  kit.banner('LABORATORY - daily analysis report', COLORS.teal, f.day ? RECORDED_TAG : NO_DATA_TAG);
  if (!f.day) {
    kit.note('No laboratory readings were recorded for this date.', { fg: COLORS.muted });
  } else {
    kit.table(
      [{ header: 'Parameter', w: 190 }, { header: 'Permissible limit', w: 105, align: 'center' }, { header: 'Inlet', w: 70, align: 'center' }, { header: 'Outlet', w: 70, align: 'center' }, { header: 'Status', w: CONTENT_W - 435, align: 'center' }],
      ROWS.map((r) => {
        const v = readings(r.key, f.day);
        const st = r.key === 'flow' ? 'na' : limitStatus(r.key, f.day?.[r.key]?.out);
        return [`${r.label}${r.unit ? ` (${r.unit})` : ''}`, r.key === 'flow' ? '-' : limitText(lab.limits[r.key]).replace('≤', '<='), v.in, v.out, STATUS_STYLE(st).text];
      }),
      {
        cell: (ri, ci) => {
          const r = ROWS[ri];
          const st = r.key === 'flow' ? 'na' : limitStatus(r.key, f.day?.[r.key]?.out);
          const bad = st === 'over' || st === 'under';
          if (ci === 3) return bad ? { color: COLORS.bad, bold: true, fill: COLORS.badBg } : { bold: true };
          if (ci === 4) return { color: STATUS_STYLE(st).color, bold: STATUS_STYLE(st).bold };
          return undefined;
        },
      },
    );
    kit.text('Flow: inlet is the pumped quantity, outlet the treated quantity. "-" = not tested that day.   Shaded outlet value = above the permissible discharge limit.', { size: 7.5, color: COLORS.muted, gap: 6 });
    if (live) kit.text(`Entered on the portal${live.by ? ` by ${live.by}` : ''} at ${istTime(live.at)} IST on ${istDate(live.at)}.`, { size: 8, color: COLORS.muted, gap: 6 });

    const shots = input.photos.get(f.date) ?? [];
    if (shots.length) {
      kit.subheading('Sample photographs');
      const olms = shots.find((s) => s.kind === 'olms');
      const sample = shots.find((s) => s.kind === 'sample');
      const boxW = (CONTENT_W - 12) / 2;
      const boxH = 190;
      kit.ensure(boxH + 24);
      const top = kit.y;
      let drawn = 0;
      for (const [i, shot, cap] of [[0, olms, 'OLMS analyser display'], [1, sample, 'Inlet & outlet samples']] as const) {
        if (!shot) continue;
        const img = await embed(kit, shot.bytes, input.photoWidth ?? 1000);
        if (!img) continue;
        kit.y = top;
        const x = 40 + i * (boxW + 12);
        const { w, h } = kit.image(img, x, boxW, boxH);
        kit.page.drawRectangle({ x, y: kit.page.getHeight() - top - h, width: w, height: h, borderColor: COLORS.line, borderWidth: 0.6 });
        kit.page.drawText(cap, { x, y: kit.page.getHeight() - top - boxH - 11, size: 8, font: kit.regular, color: COLORS.muted });
        drawn++;
      }
      kit.y = top + (drawn ? boxH + 20 : 0);
    }

    if (f.power) {
      kit.subheading('Power consumption - energy meter 1 (laboratory report)');
      kit.table(
        [{ header: 'Open', w: CONTENT_W / 6, align: 'center' }, { header: 'Close', w: CONTENT_W / 6, align: 'center' }, { header: 'Difference', w: CONTENT_W / 6, align: 'center' }, { header: 'Multiplication factor', w: CONTENT_W / 6, align: 'center' }, { header: 'Total units (kWh)', w: CONTENT_W / 6, align: 'center' }, { header: 'P.F.', w: CONTENT_W / 6, align: 'center' }],
        [[num2(f.power.open), num2(f.power.close), num2(f.power.diff), val(f.power.multiplier) ?? '-', val(f.power.units) ?? '-', num2(f.power.pf)]],
        { headFill: COLORS.tealDark },
      );
    }
  }

  // 3. Electrical, 4. Mechanical, 5. Housekeeping: from each department's own daily report
  for (const slug of ['electrical', 'mechanical', 'housekeeping'] as DeptSlug[]) {
    const r = f.depts[slug];
    const schema = SCHEMAS[slug];
    const hasData = !!r || (slug === 'electrical' && !!f.power);
    sectionStart(kit, hasData);
    kit.banner(`${schema.label.toUpperCase()} - daily report`, DEPT_COLOR[slug], r ? RECORDED_TAG : NO_DATA_TAG);
    if (r) {
      kit.text(`Entered by ${r.created_by_name ?? 'unknown'}${r.updated_by_name && r.updated_by_name !== r.created_by_name ? `, updated by ${r.updated_by_name}` : ''} on ${istDate(r.updated_at)} at ${istTime(r.updated_at)} IST.`, { size: 8, color: COLORS.muted, gap: 4 });
      const a = attn(slug);
      if (a.alerts) kit.note(`${a.alerts} item${a.alerts > 1 ? 's' : ''} need attention: ${a.notes.join('; ')}.`, { fg: COLORS.bad, bg: COLORS.badBg });
      deptSections(kit, schema, r.data, DEPT_COLOR[slug]);
    } else {
      kit.note(`No ${schema.label.toLowerCase()} report was entered for this date.`, { fg: COLORS.muted });
    }
    if (slug === 'electrical' && f.power) {
      const mon = monthAvg != null && f.power.units != null ? ` (${f.power.units >= monthAvg ? '+' : ''}${(((f.power.units - monthAvg) / monthAvg) * 100).toFixed(0)}% vs the month average of ${Math.round(monthAvg).toLocaleString('en-IN')} kWh)` : '';
      kit.text(`Laboratory energy-meter reading: ${f.power.units?.toLocaleString('en-IN') ?? '-'} kWh, power factor ${num2(f.power.pf)}${mon}.`, { size: 8.5, color: COLORS.text, gap: 4 });
    }
  }

  // 6. Portal activity
  sectionStart(kit, f.events.length > 0);
  kit.banner('PORTAL ACTIVITY', COLORS.purple, f.events.length ? RECORDED_TAG : NO_DATA_TAG);
  const SHOWN = 60;
  kit.table(
    [{ header: 'Time (IST)', w: 48 }, { header: 'User', w: 110 }, { header: 'Department', w: 75 }, { header: 'Action', w: 80 }, { header: 'Details', w: CONTENT_W - 313 }],
    f.events.slice(0, SHOWN).map((a) => [istTime(a.created_at), a.user_name || a.user_email || '-', a.department ?? '-', ACTION_LABEL[a.action] ?? a.action, (a.details ?? '').slice(0, 140)]),
    { size: 8, headFill: COLORS.purple, empty: 'No portal activity was logged on this date.' },
  );
  if (f.events.length > SHOWN) kit.text(`... and ${f.events.length - SHOWN} more events (see the activity log in the Admin panel).`, { size: 8, color: COLORS.muted });
  if (f.pageViews) kit.text(`${f.pageViews} page-view events are not listed.`, { size: 8, color: COLORS.muted });
}

// ── whole document ───────────────────────────────────────────────────────────

export async function buildDailyReportPdf(input: DailyReportInput): Promise<Uint8Array> {
  const kit = await Kit.create(input.logos);
  const all = input.days.map((d) => facts(d, input));
  const multi = all.length > 1;

  if (multi) {
    kit.addPage();
    kit.text('DAILY PLANT REPORT', { size: 9, bold: true, color: COLORS.muted });
    kit.text(`${dayLabel(all[0].date)}  to  ${dayLabel(all[all.length - 1].date)}`, { size: 18, bold: true, color: COLORS.blue, gap: 4 });
    kit.text(`${all.length} days. Every day that follows has its own pages: summary, laboratory, electrical, mechanical, housekeeping and portal activity.`, { size: 9, color: COLORS.muted, gap: 8 });
    kit.subheading('Period summary', COLORS.blue);
    const keys: ParamKey[] = ['bod', 'cod', 'tss', 'phos', 'tn'];
    kit.table(
      [
        { header: 'Date', w: 46 }, { header: 'Treated (MGD)', w: 50, align: 'right' }, { header: 'BOD', w: 34, align: 'right' }, { header: 'COD', w: 34, align: 'right' },
        { header: 'TSS', w: 34, align: 'right' }, { header: 'Phos.', w: 34, align: 'right' }, { header: 'TN', w: 34, align: 'right' }, { header: 'Limits met', w: 50, align: 'center' },
        { header: 'Energy (kWh)', w: 52, align: 'right' }, { header: 'Reports (of 4)', w: 50, align: 'center' }, { header: 'Items needing attention', w: CONTENT_W - 418, align: 'center' },
      ],
      all.map((f) => [
        shortDay(f.date), fmtFlow(f.day?.flow?.treated), ...keys.map((k) => val(f.day?.[k]?.out) ?? '-'),
        f.measured ? `${f.ok}/${f.measured}` : '-', f.energyKwh != null ? String(f.energyKwh) : '-', `${f.deptCount}/4`,
        String(f.over.length + (['mechanical', 'electrical', 'housekeeping'] as DeptSlug[]).reduce((a, s) => a + attention(SCHEMAS[s], f.depts[s]?.data ?? null).alerts, 0)),
      ]),
      {
        size: 8,
        cell: (r, c) => {
          const f = all[r];
          if (c >= 2 && c <= 6) {
            const s = limitStatus(keys[c - 2], f.day?.[keys[c - 2]]?.out);
            return s === 'over' || s === 'under' ? { color: COLORS.bad, bold: true, fill: COLORS.badBg } : undefined;
          }
          if (c === 7 && f.measured) return f.over.length ? { color: COLORS.bad, bold: true } : { color: COLORS.good, bold: true };
          if (c === 9) return f.deptCount === 4 ? { color: COLORS.good, bold: true } : { color: COLORS.muted };
          if (c === 10) return { bold: true };
          return undefined;
        },
      },
    );
    kit.text('Red = outlet value above its permissible limit. "-" = not recorded. Limits met = laboratory parameters within limit out of those measured. Items needing attention = laboratory values above limit plus flagged equipment, alarms and work orders in the department reports.', { size: 7.5, color: COLORS.muted });
  }

  for (const f of all) await dayChapter(kit, f, input);

  const range = multi ? `${dayLabel(all[0].date)} to ${dayLabel(all[all.length - 1].date)}` : dayLabel(all[0].date);
  return kit.finish({ title: '7 MGD STP SONIA VIHAR - Daily Plant Report', subtitle: range, generated: input.generated });
}
