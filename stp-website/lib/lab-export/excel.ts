import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DayRecord, ParamKey } from '@/app/dashboard/laboratory/lab';

/**
 * One month as a worksheet in the lab team's own layout. The template (templates/lab/month-sheet-template.xlsx) is the
 * Sep-26 sheet of their workbook: same title block with both logos, merged headers, column widths, cell styles, frozen
 * panes, landscape fit-to-page setup, Average row and the Chemist / Authorised sign line. Only the values change.
 */

const TEMPLATE_DATA_ROWS = 30; // the template sheet is a 30-day month: data rows 5..34, Average row 35, footer rows 36..43
const FIRST_DATA_ROW = 5;

// Column order of the sheet after Date / Pumping / Treated: inlet then outlet of each parameter
const PARAM_COLUMNS: ParamKey[] = ['temp', 'ph', 'bod', 'cod', 'tss', 'phos', 'alk', 'do', 'tn', 'nh4', 'oil'];

const colLetter = (i: number) => String.fromCharCode(65 + i); // A..Y (25 columns)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The sheet / file label the lab team uses: SEP-26 */
export const sheetLabel = (monthKey: string) => `${MONTHS[Number(monthKey.slice(5)) - 1]}-${monthKey.slice(2, 4)}`;

const excelSerial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569;
};

type Cell = { kind: 'num'; v: number } | { kind: 'text'; v: string };

/** The 25 values of one day's row, in column order A..Y. Blank = "-", and the DO inlet is "NIL", as in the sheets. */
function rowCells(monthKey: string, dayNo: number, d: DayRecord | undefined): Cell[] {
  const iso = `${monthKey}-${String(dayNo).padStart(2, '0')}`;
  const n = (v: number | null | undefined): Cell => (typeof v === 'number' && Number.isFinite(v) ? { kind: 'num', v } : { kind: 'text', v: '-' });
  const cells: Cell[] = [{ kind: 'num', v: excelSerial(iso) }, n(d?.flow?.pumping), n(d?.flow?.treated)];
  for (const key of PARAM_COLUMNS) {
    const side = d?.[key];
    cells.push(key === 'do' ? { kind: 'text', v: 'NIL' } : n(side?.in), n(side?.out));
  }
  return cells;
}

const cellXml = (ref: string, style: string, c: Cell) =>
  c.kind === 'num'
    ? `<c r="${ref}" s="${style}"><v>${c.v}</v></c>`
    : `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${esc(c.v)}</t></is></c>`;

/** Re-numbers a template row (and the row number inside every cell reference) */
function moveRow(row: string, to: number): string {
  return row.replace(/^<row r="\d+"/, `<row r="${to}"`).replace(/<c r="([A-Z]+)\d+"/g, `<c r="$1${to}"`);
}

export async function buildMonthWorkbook(monthKey: string, days: DayRecord[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await readFile(path.join(process.cwd(), 'templates', 'lab', 'month-sheet-template.xlsx')));
  const sheetFile = zip.file('xl/worksheets/sheet1.xml')!;
  const xml = await sheetFile.async('string');

  const open = xml.indexOf('<sheetData>');
  const close = xml.indexOf('</sheetData>');
  let head = xml.slice(0, open);
  const tail = xml.slice(close + '</sheetData>'.length);

  const rows = new Map<number, string>();
  for (const m of xml.slice(open, close).matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)) rows.set(Number(m[1]), m[0]);

  const [year, month] = [Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7))];
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const shift = dayCount - TEMPLATE_DATA_ROWS;
  const lastData = FIRST_DATA_ROW + dayCount - 1;
  const avgRow = lastData + 1;

  // Rows 1-4: the title block as is, with the month title replaced
  const title = `Lab. Report ${MONTHS_TITLE[month - 1]}-${year}`;
  const out: string[] = [1, 2, 3, 4].map((n) => {
    const r = rows.get(n)!;
    return n === 2 ? r.replace(/<c r="A2"([^>]*?) t="s"><v>\d+<\/v><\/c>/, `<c r="A2"$1 t="inlineStr"><is><t>${esc(title)}</t></is></c>`) : r;
  });

  // Data rows: every calendar day of the month, styled like the template's first data row
  const styles = [...rows.get(FIRST_DATA_ROW)!.matchAll(/<c r="[A-Z]+\d+" s="(\d+)"/g)].map((m) => m[1]);
  const rowOpen = rows.get(FIRST_DATA_ROW)!.match(/^<row [^>]*>/)![0];
  const columns: (number | null)[][] = Array.from({ length: 25 }, () => []);
  for (let d = 1; d <= dayCount; d++) {
    const n = FIRST_DATA_ROW + d - 1;
    const cells = rowCells(monthKey, d, byDate.get(`${monthKey}-${String(d).padStart(2, '0')}`));
    cells.forEach((c, i) => columns[i].push(c.kind === 'num' ? c.v : null));
    out.push(`${rowOpen.replace(/ r="\d+"/, ` r="${n}"`)}${cells.map((c, i) => cellXml(`${colLetter(i)}${n}`, styles[i], c)).join('')}</row>`);
  }

  // Average row: live formulas (as in the workbook) plus the computed values, so viewers that don't recalculate still show them
  out.push(
    moveRow(rows.get(35)!, avgRow).replace(/<c r="([B-Y])\d+"( s="\d+")[^>]*?>[\s\S]*?<\/c>/g, (_m, col: string, style: string) => {
      const i = col.charCodeAt(0) - 65;
      const nums = columns[i].filter((v): v is number => v !== null);
      const f = `<f>IFERROR(AVERAGE(${col}${FIRST_DATA_ROW}:${col}${lastData}),"-")</f>`;
      return nums.length
        ? `<c r="${col}${avgRow}"${style}>${f}<v>${nums.reduce((a, b) => a + b, 0) / nums.length}</v></c>`
        : `<c r="${col}${avgRow}"${style} t="str">${f}<v>-</v></c>`;
    }),
  );

  // Footer rows (blank styled rows and the Chemist Sign / Authorised Sign line) follow the last data row
  for (let n = 36; n <= 43; n++) if (rows.has(n)) out.push(moveRow(rows.get(n)!, n + shift)); // blank rows are absent from the sheet XML

  head = head
    .replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:AD${43 + shift}"/>`)
    .replace(/<pane [^>]*\/>/, '<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>')
    .replace(/<selection [^>]*\/>/, '<selection pane="bottomLeft" activeCell="A5" sqref="A5"/>');

  zip.file('xl/worksheets/sheet1.xml', `${head}<sheetData>${out.join('')}</sheetData>${tail}`);
  const workbook = await zip.file('xl/workbook.xml')!.async('string');
  zip.file('xl/workbook.xml', workbook.replace('{{SHEET_NAME}}', sheetLabel(monthKey)));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
