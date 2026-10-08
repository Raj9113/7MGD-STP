import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { limitStatus, type DayRecord, type DayReport, type ParamKey } from '@/app/dashboard/laboratory/lab';
import { imageInfo, type ImageKind } from './image';

/**
 * Daily laboratory reports in the lab team's own Word layout. The template (templates/lab/daily-report-template.docx) is
 * one page of their SEP-26 report (header table, parameter table, the two dashed photo frames, power table, footer, page
 * size); every selected day becomes a copy of that page with the values, shading and photographs replaced.
 */

export interface DayPhoto { kind: 'olms' | 'sample'; bytes: Buffer }
export interface WordDay { day: DayRecord; report?: DayReport; photos: DayPhoto[] }

const ROW_KEYS: (ParamKey | 'flow')[] = ['flow', 'temp', 'ph', 'bod', 'cod', 'tss', 'phos', 'alk', 'do', 'tn', 'nh4', 'oil', 'coliform'];
const EXCEED_FILL = 'FBEAE8';
const EXCEED_TEXT = 'C0392B';
const NORMAL_TEXT = '333333';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const setText = (cell: string, text: string) => cell.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/, `<w:t>${esc(text)}</w:t>`);

// ── value formatting, as printed in the lab team's reports ───────────────────

const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : null);

function paramValues(key: ParamKey | 'flow', d: DayRecord): { in: string; out: string } {
  if (key === 'flow') return { in: num(d.flow?.pumping) ?? '-', out: num(d.flow?.treated) ?? '-' };
  const dash = key === 'coliform' ? '--' : '-';
  return { in: num(d[key]?.in) ?? (key === 'do' ? 'NIL' : dash), out: num(d[key]?.out) ?? dash };
}

const fixed2 = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(2) : '-');

// ── table helpers ────────────────────────────────────────────────────────────

const mapRows = (tbl: string, fn: (row: string, i: number) => string) => {
  let i = 0;
  return tbl.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, (row) => fn(row, i++));
};
const mapCells = (row: string, fn: (cell: string, i: number) => string) => {
  let i = 0;
  return row.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (cell) => fn(cell, i++));
};

function fillParameterTable(tbl: string, d: DayRecord): string {
  return mapRows(tbl, (row, r) => {
    if (r === 0) return row; // header row
    const key = ROW_KEYS[r - 1];
    const v = paramValues(key, d);
    const baseFill = row.match(/w:fill="([0-9A-Fa-f]{6})"/)![1];
    // the lab report shades an outlet value that is above the permissible limit
    const exceeded = key !== 'flow' && limitStatus(key, d[key]?.out) !== 'ok' && limitStatus(key, d[key]?.out) !== 'na';
    return mapCells(row, (cell, c) => {
      if (c === 2) return setText(cell, v.in);
      if (c !== 3) return cell;
      let out = setText(cell, v.out)
        .replace(/w:fill="[0-9A-Fa-f]{6}"/, `w:fill="${exceeded ? EXCEED_FILL : baseFill}"`)
        .replace(/<w:b\/><w:bCs\/>/g, '')
        .replace(/<w:color w:val="[0-9A-Fa-f]{6}"\/>/, `<w:color w:val="${NORMAL_TEXT}"/>`);
      if (exceeded) out = out.replace(`<w:color w:val="${NORMAL_TEXT}"/>`, `<w:b/><w:bCs/><w:color w:val="${EXCEED_TEXT}"/>`);
      return out;
    });
  });
}

function fillPowerTable(tbl: string, p: DayReport['power']): string {
  const values: Record<number, string[]> = {
    1: [fixed2(p?.open), fixed2(p?.close), fixed2(p?.diff)],
    3: [fixed2(p?.diff), num(p?.multiplier) ?? '-', num(p?.units) ?? '-', fixed2(p?.pf)],
  };
  return mapRows(tbl, (row, r) => {
    const v = values[r];
    if (!v) return row;
    // row 1: label + open / close / difference; row 3: total reading / multiplication factor / total unit / P.F.
    return mapCells(row, (cell, c) => (r === 1 ? (c === 0 ? cell : setText(cell, v[c - 1])) : setText(cell, v[c])));
  });
}

// ── photographs ──────────────────────────────────────────────────────────────

interface Placed { rid: string; ext: ImageKind; bytes: Buffer }

/** Fit an image inside the template picture's box (keeping its proportions) and centre it there */
function placePhoto(drawing: string, photo: DayPhoto, rid: string): string {
  const info = imageInfo(photo.bytes)!;
  const ext = drawing.match(/<wp:extent cx="(\d+)" cy="(\d+)"/)!;
  const [boxW, boxH] = [Number(ext[1]), Number(ext[2])];
  const scale = Math.min(boxW / info.width, boxH / info.height);
  const [w, h] = [Math.round(info.width * scale), Math.round(info.height * scale)];
  const posH = Number(drawing.match(/<wp:positionH relativeFrom="margin"><wp:posOffset>(-?\d+)/)![1]);
  const posV = Number(drawing.match(/<wp:positionV relativeFrom="paragraph"><wp:posOffset>(-?\d+)/)![1]);

  return drawing
    .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${w}" cy="${h}"/>`)
    .replace(/(<pic:spPr[^>]*><a:xfrm><a:off x="0" y="0"\/>)<a:ext cx="\d+" cy="\d+"\/>/, `$1<a:ext cx="${w}" cy="${h}"/>`)
    .replace(/(<wp:positionH relativeFrom="margin"><wp:posOffset>)-?\d+/, `$1${Math.round(posH + (boxW - w) / 2)}`)
    .replace(/(<wp:positionV relativeFrom="paragraph"><wp:posOffset>)-?\d+/, `$1${Math.round(posV + (boxH - h) / 2)}`)
    .replace(/r:embed="[^"]+"/, `r:embed="${rid}"`);
}

function fillPhotos(page: string, photos: DayPhoto[], nextRid: () => string, placed: Placed[]): string {
  return page.replace(/<w:drawing>(?:(?!<\/w:drawing>)[\s\S])*?<\/w:drawing>/g, (drawing) => {
    if (!drawing.includes('<pic:pic')) return drawing; // the dashed photo frames stay as they are
    // In the template the OLMS picture sits in the left frame and the sample picture in the right one
    const left = Number(drawing.match(/<wp:positionH relativeFrom="margin"><wp:posOffset>(-?\d+)/)![1]) < 1_000_000;
    const photo = photos.find((p) => p.kind === (left ? 'olms' : 'sample'));
    const info = photo && imageInfo(photo.bytes);
    if (!photo || !info) return ''; // no photo that day: leave the frame empty
    const rid = nextRid();
    placed.push({ rid, ext: info.kind, bytes: photo.bytes });
    return placePhoto(drawing, photo, rid);
  });
}

// ── one page ─────────────────────────────────────────────────────────────────

function fillPage(template: string, wd: WordDay, nextRid: () => string, placed: Placed[]): string {
  const [y, m, d] = wd.day.date.split('-');
  let page = template.replace(/<w:t>\d{2}\.\d{2}\.\d{4}<\/w:t>/, `<w:t>${d}.${m}.${y}</w:t>`);

  page = page.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) =>
    tbl.includes('Permissible Limit') ? fillParameterTable(tbl, wd.day) : tbl.includes('Energy Meter') ? fillPowerTable(tbl, wd.report?.power) : tbl,
  );
  return fillPhotos(page, wd.photos, nextRid, placed);
}

export class ExportTooLarge extends Error {}

/** Photos are re-encoded smaller when a download would otherwise exceed what the host can return (Vercel: 4.5 MB). */
async function shrink(photos: DayPhoto[]): Promise<DayPhoto[]> {
  try {
    const sharp = (await import('sharp')).default;
    return await Promise.all(
      photos.map(async (p) => ({ ...p, bytes: await sharp(p.bytes).rotate().resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 62 }).toBuffer() })),
    );
  } catch {
    return photos; // sharp not available: keep the originals
  }
}

export async function buildDailyReports(days: WordDay[], maxBytes = 4_300_000): Promise<Buffer> {
  if (days.length === 0) throw new Error('No days to export.');
  const zip = await JSZip.loadAsync(await readFile(path.join(process.cwd(), 'templates', 'lab', 'daily-report-template.docx')));
  const doc = await zip.file('word/document.xml')!.async('string');

  const bodyStart = doc.indexOf('<w:body>') + '<w:body>'.length;
  const sect = doc.lastIndexOf('<w:sectPr');
  const pageTemplate = doc.slice(bodyStart, sect);

  const build = async (items: WordDay[]) => {
    const placed: Placed[] = [];
    let n = 0;
    const pages = items.map((wd) => fillPage(pageTemplate, wd, () => `rIdLabPhoto${++n}`, placed));
    pages[pages.length - 1] = pages[pages.length - 1].replace(/<w:p [^>]*><w:r><w:br w:type="page"\/><\/w:r><\/w:p>$/, ''); // no blank last page

    let body = pages.join('');
    // Unique drawing ids; and drop the optional Word revision ids, which would be duplicated by the copies
    let id = 1000;
    body = body.replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${++id}"`).replace(/ (?:w14:paraId|w14:textId|wp14:anchorId|wp14:editId)="[0-9A-F]+"/g, '');

    const out = new JSZip();
    for (const name of Object.keys(zip.files)) {
      const f = zip.files[name];
      if (f.dir || name === 'word/document.xml' || name === 'word/_rels/document.xml.rels' || name === '[Content_Types].xml') continue;
      out.file(name, await f.async('nodebuffer'));
    }
    out.file('word/document.xml', doc.slice(0, bodyStart) + body + doc.slice(sect));

    const rels = (await zip.file('word/_rels/document.xml.rels')!.async('string')).replace(
      '</Relationships>',
      placed.map((p, i) => `<Relationship Id="${p.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/labphoto${i + 1}.${p.ext}"/>`).join('') + '</Relationships>',
    );
    out.file('word/_rels/document.xml.rels', rels);
    placed.forEach((p, i) => out.file(`word/media/labphoto${i + 1}.${p.ext}`, p.bytes));

    let types = await zip.file('[Content_Types].xml')!.async('string');
    for (const ext of new Set(placed.map((p) => p.ext))) {
      if (!types.includes(`Extension="${ext}"`)) {
        types = types.replace('<Default ', `<Default Extension="${ext}" ContentType="image/${ext}"/><Default `);
      }
    }
    out.file('[Content_Types].xml', types);
    return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  };

  let result = await build(days);
  if (result.length > maxBytes && days.some((d) => d.photos.length)) {
    result = await build(await Promise.all(days.map(async (d) => ({ ...d, photos: await shrink(d.photos) }))));
  }
  if (result.length > maxBytes) {
    throw new ExportTooLarge(`This download is ${(result.length / 1048576).toFixed(1)} MB, which is more than the server can send in one go. Choose fewer days, or download without photographs.`);
  }
  return result;
}

