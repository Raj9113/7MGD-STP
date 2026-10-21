import { PARAM, dayLabel, fmtFlow, limitStatus, limitText, type LabData, type ParamKey } from '@/app/dashboard/laboratory/lab';
import { SCHEMAS, asRow, asRows, attention, showValue, statusTone, type DeptSchema, type DeptData, type DeptSlug, type Field, type Row, type Section } from '@/lib/dept-report/schema';
import type { Block, Chapter, Doc, DocCell, Tone } from '@/lib/report-doc/model';
import {
  ACTION_LABEL, ROWS, cellText as deptCellText, facts, header as deptHeader, istDate, istTime, isDone, longDay, num2, readings, rowBad, shortDay, val,
  type DailyReportInput, type DayFacts, type DayPhotoBytes,
} from './build';

/**
 * The daily plant report and the laboratory report as a Doc (see lib/report-doc): the same content the plant PDF draws,
 * in a form the Word and Excel writers (and the generic PDF writer) can render.
 */

const DEPT_HEX: Record<DeptSlug, string> = { mechanical: 'D35400', electrical: 'B9770E', housekeeping: '1E8449' };
const TEAL = '0E6E6B';

const statusWord = (s: ReturnType<typeof limitStatus>) => (s === 'ok' ? 'Within limit' : s === 'over' ? 'ABOVE LIMIT' : s === 'under' ? 'BELOW LIMIT' : '-');
const statusToneOf = (s: ReturnType<typeof limitStatus>): Tone | undefined => (s === 'ok' ? 'good' : s === 'over' || s === 'under' ? 'bad' : 'muted');

function fieldTone(f: Field, row: Row): Tone | undefined {
  const lv = f.warn?.(row[f.key], row);
  if (lv === 'bad') return 'bad';
  if (lv === 'warn') return 'warn';
  const t = f.status ? statusTone(row[f.key]) : undefined;
  return t === 'bad' || t === 'warn' || t === 'good' || t === 'info' || t === 'muted' ? t : undefined;
}

const cell = (text: string, tone?: Tone): DocCell => (tone ? { text, tone } : text);

// ── laboratory ───────────────────────────────────────────────────────────────

/** One day of the laboratory report: parameter table, photographs and the energy meter */
export function labBlocks(date: string, lab: LabData, shots: DayPhotoBytes[], opts: { showEmpty?: boolean } = {}): Block[] {
  const day = lab.months.flatMap((m) => m.days).find((d) => d.date === date);
  const live = lab.live?.[date];
  const power = lab.reports[date]?.power;
  const out: Block[] = [];

  if (!day) {
    if (opts.showEmpty !== false) out.push({ t: 'note', text: 'No laboratory readings were recorded for this date.' });
  } else {
    out.push({
      t: 'table',
      head: ['Parameter', 'Permissible limit', 'Inlet', 'Outlet', 'Status'],
      weights: [3.4, 2, 1.2, 1.2, 1.7],
      align: ['left', 'center', 'center', 'center', 'center'],
      rows: ROWS.map((r) => {
        const v = readings(r.key, day);
        const st = r.key === 'flow' ? 'na' : limitStatus(r.key, day[r.key]?.out);
        return [
          `${r.label}${r.unit ? ` (${r.unit})` : ''}`,
          r.key === 'flow' ? '-' : limitText(lab.limits[r.key]).replace('≤', '<='),
          v.in,
          cell(v.out, st === 'over' || st === 'under' ? 'bad' : undefined),
          cell(statusWord(st), statusToneOf(st)),
        ];
      }),
    });
    out.push({ t: 'p', small: true, text: 'Flow: inlet is the pumped quantity, outlet the treated quantity. "-" = not tested that day. Red outlet value = above the permissible discharge limit.' });
    if (live) out.push({ t: 'p', small: true, text: `Entered on the portal${live.by ? ` by ${live.by}` : ''} at ${istTime(live.at)} IST on ${istDate(live.at)}.` });
  }

  const olms = shots.find((s) => s.kind === 'olms');
  const sample = shots.find((s) => s.kind === 'sample');
  const items = [olms && { bytes: olms.bytes, caption: 'OLMS analyser display', slot: 'left' as const }, sample && { bytes: sample.bytes, caption: 'Inlet & outlet samples', slot: 'right' as const }].filter(Boolean) as { bytes: Buffer; caption: string; slot: 'left' | 'right' }[];
  if (items.length) {
    out.push({ t: 'h3', text: 'Sample photographs' }, { t: 'images', items });
  }

  if (power) {
    out.push(
      { t: 'h3', text: 'Power consumption - energy meter 1' },
      {
        t: 'table',
        head: ['Open', 'Close', 'Difference', 'Multiplication factor', 'Total units (kWh)', 'P.F.'],
        align: ['center', 'center', 'center', 'center', 'center', 'center'],
        rows: [[num2(power.open), num2(power.close), num2(power.diff), val(power.multiplier) ?? '-', val(power.units) ?? '-', num2(power.pf)]],
      },
      { t: 'p', small: true, text: 'Entered by the Electrical department. Units = difference x multiplication factor.' },
    );
  }
  return out;
}

/** Laboratory daily reports, one page per day (PDF) */
export function buildLabDoc(days: string[], lab: LabData, photos: Map<string, DayPhotoBytes[]>, generated: string): Doc {
  const chapters: Chapter[] = days.map((date) => ({
    name: shortDay(date),
    blocks: [
      { t: 'p', small: true, text: 'LABORATORY DAILY REPORT' },
      { t: 'h1', text: longDay(date) },
      ...labBlocks(date, lab, photos.get(date) ?? []),
    ],
  }));
  const range = days.length === 1 ? dayLabel(days[0]) : `${dayLabel(days[0])} to ${dayLabel(days[days.length - 1])}`;
  return { title: '7 MGD STP SONIA VIHAR - Laboratory Report', subtitle: range, generated, chapters };
}

// ── departments ──────────────────────────────────────────────────────────────

function deptBlocks(schema: DeptSchema, data: DeptData): Block[] {
  const out: Block[] = [];
  for (const sec of schema.sections as Section[]) {
    if (sec.kind === 'fields') {
      const row = asRow(data[sec.key]);
      const fields = sec.fields.filter((f) => row[f.key] !== undefined);
      if (!fields.length) continue;
      const lines: DocCell[][] = [];
      for (let i = 0; i < fields.length; i += 2) {
        const [a, b] = [fields[i], fields[i + 1]];
        lines.push([{ text: a.label, bold: true }, cell(showValue(a, row[a.key]), fieldTone(a, row)), b ? { text: b.label, bold: true } : '', b ? cell(showValue(b, row[b.key]), fieldTone(b, row)) : '']);
      }
      out.push({ t: 'h3', text: sec.title }, { t: 'table', head: ['Item', 'Value', 'Item', 'Value'], weights: [2.4, 1.7, 2.4, 1.7], rows: lines });
    } else {
      const rows = asRows(data[sec.key]);
      if (!rows.length) continue;
      out.push({
        t: 'h3',
        text: `${sec.title} (${rows.length})`,
      }, {
        t: 'table',
        head: sec.fields.map(deptHeader),
        align: sec.fields.map((f) => (f.type === 'number' ? 'right' : 'left')),
        weights: sec.fields.map((f) => (['name', 'title', 'desc', 'task', 'area', 'destination', 'remarks', 'point', 'item', 'model'].includes(f.key) ? 2.4 : f.type === 'text' ? 1.4 : 1)),
        rows: rows.map((r) => sec.fields.map((f) => cell(deptCellText(f, r[f.key]), fieldTone(f, r) ?? (rowBad(sec, r) && !isDone(sec, r) && f.key === sec.fields[0].key ? 'bad' : undefined)))),
      });
    }
  }
  if (typeof data.remarks === 'string' && data.remarks) out.push({ t: 'h3', text: 'Remarks / observations' }, { t: 'note', text: data.remarks });
  return out;
}

// ── one day, and the whole report ────────────────────────────────────────────

function dayChapter(f: DayFacts, input: DailyReportInput): Chapter {
  const { lab } = input;
  const attn = (slug: DeptSlug) => attention(SCHEMAS[slug], f.depts[slug]?.data ?? null);
  const live = lab.live?.[f.date];
  const out = (key: ParamKey, label: string): DocCell[] => {
    const v = f.day?.[key]?.out;
    const st = limitStatus(key, v);
    const lim = lab.limits[key];
    return [label, cell(val(v) ?? '-', st === 'ok' ? 'good' : st === 'na' ? 'muted' : 'bad'), lim?.max !== undefined ? `limit <= ${lim.max} mg/l` : ''];
  };

  const blocks: Block[] = [
    { t: 'p', small: true, text: 'DAILY PLANT REPORT' },
    { t: 'h1', text: longDay(f.date) },
    {
      t: 'table',
      head: ['Key figure', 'Value', 'Detail'],
      weights: [3, 1.6, 3.4],
      rows: [
        ['Pumped flow (MGD)', fmtFlow(f.day?.flow?.pumping), 'inlet'],
        ['Treated flow (MGD)', fmtFlow(f.day?.flow?.treated), 'outlet'],
        out('bod', 'Outlet BOD (mg/l)'), out('cod', 'Outlet COD (mg/l)'), out('tss', 'Outlet TSS (mg/l)'), out('phos', 'Outlet phosphorus (mg/l)'),
        ['Energy used (kWh)', f.energyKwh != null ? f.energyKwh.toLocaleString('en-IN') : '-', f.energySource],
        ['Department reports', cell(`${f.deptCount} of 4`, f.deptCount === 4 ? 'good' : undefined), 'entered for this date'],
      ],
    },
  ];
  if (f.measured) {
    blocks.push({
      t: 'note',
      tone: f.over.length ? 'bad' : 'good',
      text: f.over.length === 0
        ? `All ${f.measured} measured outlet parameters were within their permissible limits.`
        : `${f.ok} of ${f.measured} measured outlet parameters were within limits. Above limit: ${f.over.map((k) => (k === 'phos' ? 'Phosphorus' : PARAM[k].short)).join(', ')}.`,
    });
  }

  const deptLine = (slug: DeptSlug): DocCell[] => {
    const r = f.depts[slug];
    const label = SCHEMAS[slug].label;
    if (!r) return [label, cell('No report entered', 'muted'), `No ${label.toLowerCase()} report was entered for this date`];
    const a = attn(slug);
    return [label, cell('Report entered', 'good'), `By ${r.created_by_name ?? 'unknown'}. ${a.alerts ? `${a.alerts} item${a.alerts > 1 ? 's' : ''} need attention: ${a.notes.join('; ')}.` : 'Nothing flagged.'}`];
  };
  blocks.push(
    { t: 'h3', text: 'Department summary' },
    {
      t: 'table',
      head: ['Department', 'Report', 'Status'],
      weights: [1.6, 1.6, 6],
      rows: [
        ['Laboratory', f.day ? cell('Report entered', 'good') : cell('No report entered', 'muted'),
          f.day ? `${f.photos ? `${f.photos} photograph${f.photos > 1 ? 's' : ''}` : 'No photographs'}${live ? ', entered on the portal' : ', from the lab Excel/Word files'}. ${f.over.length ? `${f.over.length} outlet value${f.over.length > 1 ? 's' : ''} above limit.` : f.measured ? 'All limits met.' : ''}` : 'No laboratory report was recorded for this date'],
        deptLine('mechanical'), deptLine('electrical'), deptLine('housekeeping'),
        ['Portal activity', f.events.length ? cell('Recorded', 'good') : cell('None', 'muted'), `${f.events.length} event${f.events.length === 1 ? '' : 's'} logged${f.pageViews ? ` (+${f.pageViews} page views not listed)` : ''}`],
      ],
    },
  );

  blocks.push({ t: 'h2', text: 'LABORATORY - daily analysis report', color: TEAL, tag: f.day ? 'RECORDED DATA' : 'NO REPORT ENTERED' }, ...labBlocks(f.date, lab, input.photos.get(f.date) ?? []));

  for (const slug of ['electrical', 'mechanical', 'housekeeping'] as DeptSlug[]) {
    const r = f.depts[slug];
    const schema = SCHEMAS[slug];
    blocks.push({ t: 'h2', text: `${schema.label.toUpperCase()} - daily report`, color: DEPT_HEX[slug], tag: r ? 'RECORDED DATA' : 'NO REPORT ENTERED' });
    if (!r) {
      blocks.push({ t: 'note', text: `No ${schema.label.toLowerCase()} report was entered for this date.` });
      continue;
    }
    blocks.push({ t: 'p', small: true, text: `Entered by ${r.created_by_name ?? 'unknown'}${r.updated_by_name && r.updated_by_name !== r.created_by_name ? `, updated by ${r.updated_by_name}` : ''} on ${istDate(r.updated_at)} at ${istTime(r.updated_at)} IST.` });
    const a = attn(slug);
    if (a.alerts) blocks.push({ t: 'note', tone: 'bad', text: `${a.alerts} item${a.alerts > 1 ? 's' : ''} need attention: ${a.notes.join('; ')}.` });
    blocks.push(...deptBlocks(schema, r.data));
  }

  const SHOWN = 60;
  blocks.push(
    { t: 'h2', text: 'PORTAL ACTIVITY', color: '6C3483', tag: f.events.length ? 'RECORDED DATA' : 'NO REPORT ENTERED' },
    f.events.length
      ? {
        t: 'table', head: ['Time (IST)', 'User', 'Department', 'Action', 'Details'], weights: [1, 2.2, 1.5, 1.6, 4.4], headColor: '6C3483',
        rows: f.events.slice(0, SHOWN).map((a) => [istTime(a.created_at), a.user_name || a.user_email || '-', a.department ?? '-', ACTION_LABEL[a.action] ?? a.action, (a.details ?? '').slice(0, 140)]),
      }
      : { t: 'note', text: 'No portal activity was logged on this date.' },
  );
  if (f.events.length > SHOWN) blocks.push({ t: 'p', small: true, text: `... and ${f.events.length - SHOWN} more events (see the activity log in the Admin panel).` });
  if (f.pageViews) blocks.push({ t: 'p', small: true, text: `${f.pageViews} page-view events are not listed.` });
  return { name: shortDay(f.date), blocks };
}

export function buildDailyReportDoc(input: DailyReportInput): Doc {
  const all = input.days.map((d) => facts(d, input));
  const chapters: Chapter[] = [];

  if (all.length > 1) {
    const keys: ParamKey[] = ['bod', 'cod', 'tss', 'phos', 'tn'];
    const alerts = (f: DayFacts) => f.over.length + (['mechanical', 'electrical', 'housekeeping'] as DeptSlug[]).reduce((a, s) => a + attention(SCHEMAS[s], f.depts[s]?.data ?? null).alerts, 0);
    chapters.push({
      name: 'Period summary',
      blocks: [
        { t: 'p', small: true, text: 'DAILY PLANT REPORT' },
        { t: 'h1', text: `${dayLabel(all[0].date)} to ${dayLabel(all[all.length - 1].date)}` },
        { t: 'p', text: `${all.length} days. Every day that follows has its own pages: summary, laboratory, electrical, mechanical, housekeeping and portal activity.` },
        {
          t: 'table',
          head: ['Date', 'Treated (MGD)', 'BOD', 'COD', 'TSS', 'Phos.', 'TN', 'Limits met', 'Energy (kWh)', 'Reports (of 4)', 'Items needing attention'],
          align: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'center', 'right', 'center', 'center'],
          weights: [1.2, 1.3, 0.9, 0.9, 0.9, 0.9, 0.9, 1.2, 1.3, 1.3, 1.6],
          rows: all.map((f) => [
            shortDay(f.date), fmtFlow(f.day?.flow?.treated),
            ...keys.map((k) => { const s = limitStatus(k, f.day?.[k]?.out); return cell(val(f.day?.[k]?.out) ?? '-', s === 'over' || s === 'under' ? 'bad' : undefined); }),
            f.measured ? cell(`${f.ok}/${f.measured}`, f.over.length ? 'bad' : 'good') : '-',
            f.energyKwh != null ? String(f.energyKwh) : '-',
            cell(`${f.deptCount}/4`, f.deptCount === 4 ? 'good' : 'muted'),
            { text: String(alerts(f)), bold: true },
          ]),
        },
        { t: 'p', small: true, text: 'Red = outlet value above its permissible limit. "-" = not recorded. Limits met = laboratory parameters within limit out of those measured. Items needing attention = laboratory values above limit plus flagged equipment, alarms and work orders in the department reports.' },
      ],
    });
  }
  for (const f of all) chapters.push(dayChapter(f, input));

  const range = all.length > 1 ? `${dayLabel(all[0].date)} to ${dayLabel(all[all.length - 1].date)}` : dayLabel(all[0].date);
  return { title: '7 MGD STP SONIA VIHAR - Daily Plant Report', subtitle: range, generated: input.generated, chapters };
}
