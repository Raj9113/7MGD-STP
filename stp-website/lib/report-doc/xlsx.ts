import JSZip from 'jszip';
import { TONE_FILL, TONE_HEX, cellBold, cellText, cellTone, type Doc, type Tone } from './model';

/**
 * Writes a Doc as an Excel workbook (.xlsx) from scratch: one sheet per chapter, coloured section bars, styled table
 * headers, status colours, frozen title rows and landscape print setup. Photographs are not placed in workbooks.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = (i: number) => {
  let n = i + 1;
  let s = '';
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

// ── styles ────────────────────────────────────────────────────────────────────

const FILL_COLORS = ['0E6E6B', '0062B8', 'D35400', 'B9770E', '1E8449', '6C3483', 'F4F9F9', ...Object.values(TONE_FILL), 'FFFFFF'];
const fillIndex = (hex: string) => {
  const i = FILL_COLORS.indexOf(hex);
  return i < 0 ? 0 : i + 2; // 0 and 1 are reserved by the format
};
const FONTS: { b?: boolean; color: string; sz: number }[] = [
  { color: '333333', sz: 10 }, // 0 normal
  { b: true, color: 'FFFFFF', sz: 10 }, // 1 white bold
  { b: true, color: '0062B8', sz: 16 }, // 2 title
  ...(['good', 'bad', 'warn', 'muted', 'info'] as Tone[]).map((t) => ({ b: t !== 'muted' && t !== 'info', color: TONE_HEX[t], sz: 10 })), // 3..7
  { b: true, color: '333333', sz: 10 }, // 8 bold
  { color: '777777', sz: 9 }, // 9 small
];
const TONE_FONT: Record<Tone, number> = { good: 3, bad: 4, warn: 5, muted: 6, info: 7 };

// cellXfs: [fontId, fillHex | null, border, halign, wrap]
type Xf = [number, string | null, boolean, 'left' | 'center' | 'right', boolean];
const XFS: Xf[] = [];
const xfIndex = (font: number, fill: string | null, border: boolean, h: Xf[3], wrap: boolean) => {
  const i = XFS.findIndex((x) => x[0] === font && x[1] === fill && x[2] === border && x[3] === h && x[4] === wrap);
  if (i >= 0) return i;
  XFS.push([font, fill, border, h, wrap]);
  return XFS.length - 1;
};

function stylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${FONTS.length}">${FONTS.map((f) => `<font>${f.b ? '<b/>' : ''}<sz val="${f.sz}"/><color rgb="FF${f.color}"/><name val="Calibri"/></font>`).join('')}</fonts>` +
    `<fills count="${FILL_COLORS.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${FILL_COLORS.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${['left', 'right', 'top', 'bottom'].map((s) => `<${s} style="thin"><color rgb="FFBFD9D8"/></${s}>`).join('')}<diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${XFS.length}">${XFS.map(([font, fill, border, h, wrap]) => `<xf numFmtId="0" fontId="${font}" fillId="${fill ? fillIndex(fill) : 0}" borderId="${border ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${h}" vertical="top"${wrap ? ' wrapText="1"' : ''}/></xf>`).join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  );
}

// ── sheets ────────────────────────────────────────────────────────────────────

interface Cell { v: string | number; s: number }

const NUMERIC = /^-?\d+(\.\d+)?$/;

function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, '-').trim().slice(0, 31) || 'Sheet';
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

export async function renderXlsx(doc: Doc): Promise<Buffer> {
  XFS.length = 0;
  xfIndex(0, null, false, 'left', false); // default style must be index 0
  const used = new Set<string>();
  const sheets = doc.chapters.map((ch) => {
    const name = sheetName(ch.name, used);
    const rows: { cells: Cell[]; height?: number }[] = [];
    const merges: string[] = [];
    const widths: number[] = [];
    let width = 8; // columns of the widest table: titles and notes merge across them
    const grow = (i: number, len: number) => { widths[i] = Math.min(46, Math.max(widths[i] ?? 9, len + 2)); };
    for (const b of ch.blocks) if (b.t === 'table') width = Math.max(width, b.head.length);

    const wide = (text: string, style: number, lines = 1, size = 10) => {
      const r = rows.length + 1;
      rows.push({ cells: [{ v: text, s: style }], height: Math.max(1, lines) * (size + 5) });
      merges.push(`A${r}:${colName(width - 1)}${r}`);
    };
    const linesFor = (text: string) => text.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / (width * 11))), 0);

    for (const b of ch.blocks) {
      switch (b.t) {
        case 'h1':
          wide(b.text, xfIndex(2, null, false, 'left', false), 1, 16);
          break;
        case 'h2': {
          rows.push({ cells: [], height: 6 });
          wide(b.tag ? `${b.text}   [${b.tag}]` : b.text, xfIndex(1, b.color && FILL_COLORS.includes(b.color) ? b.color : '0E6E6B', false, 'left', false), 1, 11);
          break;
        }
        case 'h3':
          wide(b.text, xfIndex(8, null, false, 'left', false));
          break;
        case 'p':
          wide(b.text, xfIndex(b.tone ? TONE_FONT[b.tone] : b.small ? 9 : 0, null, false, 'left', true), linesFor(b.text));
          break;
        case 'note':
          wide(b.text, xfIndex(b.tone ? TONE_FONT[b.tone] : 6, b.tone ? TONE_FILL[b.tone] : 'F2F3F4', false, 'left', true), linesFor(b.text));
          break;
        case 'table': {
          const head = xfIndex(1, b.headColor && FILL_COLORS.includes(b.headColor) ? b.headColor : '0E6E6B', true, 'center', true);
          rows.push({ cells: b.head.map((h) => ({ v: h, s: head })), height: 30 });
          b.head.forEach((h, i) => grow(i, Math.min(h.length, 16)));
          b.rows.forEach((r, ri) => {
            const cells = r.map((c, i): Cell => {
              const text = cellText(c);
              const tone = cellTone(c);
              const fill = tone === 'bad' ? TONE_FILL.bad : ri % 2 === 1 ? 'F4F9F9' : null;
              const font = tone ? TONE_FONT[tone] : cellBold(c) ? 8 : 0;
              grow(i, text.length);
              const isNum = NUMERIC.test(text) && text.length < 16;
              return { v: isNum ? Number(text) : text, s: xfIndex(font, fill, true, isNum ? 'right' : b.align?.[i] ?? 'left', true) };
            });
            const tallest = Math.max(...r.map((c, i) => Math.ceil(cellText(c).length / Math.max(6, (widths[i] ?? 9) - 1))));
            rows.push({ cells, height: tallest > 1 ? tallest * 14 : undefined });
          });
          rows.push({ cells: [], height: 8 });
          break;
        }
        case 'images':
          wide(`Photographs: ${b.items.map((i) => i.caption).join(', ')} (included in the PDF and Word versions)`, xfIndex(9, null, false, 'left', true));
          break;
      }
    }

    const cols = Array.from({ length: width }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i] ?? 12}" customWidth="1"/>`).join('');
    const sheetData = rows
      .map((r, i) => {
        const n = i + 1;
        const cells = r.cells.map((c, ci) => (typeof c.v === 'number'
          ? `<c r="${colName(ci)}${n}" s="${c.s}"><v>${c.v}</v></c>`
          : `<c r="${colName(ci)}${n}" s="${c.s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`)).join('');
        return `<row r="${n}"${r.height ? ` ht="${r.height}" customHeight="1"` : ''}>${cells}</row>`;
      })
      .join('');
    const xml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${cols}</cols><sheetData>${sheetData}</sheetData>` +
      (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') +
      `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
    return { name, xml };
  });

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + `</Types>`,
  );
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + `</sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file('xl/styles.xml', stylesXml());
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, s.xml));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
