import JSZip from 'jszip';
import { imageInfo } from '@/lib/lab-export/image';
import { TONE_FILL, TONE_HEX, cellBold, cellText, cellTone, type Doc } from './model';

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN_X = 1134;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const EMU = 9525;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

interface Media { rId: string; file: string; kind: 'jpeg' | 'png'; bytes: Buffer; w: number; h: number }

interface RunOpts { size?: number; bold?: boolean; color?: string }
const run = (text: string, o: RunOpts = {}) => {
  const parts = esc(text).split('\n');
  const rpr = `<w:rPr>${o.bold ? '<w:b/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.size ?? 20}"/><w:szCs w:val="${o.size ?? 20}"/></w:rPr>`;
  return `<w:r>${rpr}${parts.map((p, i) => `${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${p}</w:t>`).join('')}</w:r>`;
};

interface ParaOpts extends RunOpts {
  fill?: string;
  before?: number;
  after?: number;
  keepNext?: boolean;
  pageBreak?: boolean;
  align?: 'left' | 'center' | 'right';
  indent?: number;
}
const para = (inner: string, o: ParaOpts = {}) =>
  `<w:p><w:pPr>${o.keepNext ? '<w:keepNext/>' : ''}${o.pageBreak ? '<w:pageBreakBefore/>' : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}` +
  `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 80}"/>${o.indent ? `<w:ind w:left="${o.indent}" w:right="${o.indent}"/>` : ''}${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>${inner}</w:p>`;
const textPara = (text: string, o: ParaOpts = {}) => para(run(text, o), o);

const BORDER = (c: string, sz = 4) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="${sz}" w:space="0" w:color="${c}"/>`).join('');

function cell(width: number, inner: string, fill?: string) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}</w:tcPr>${inner}</w:tc>`;
}

export interface DocxLogos { left?: Buffer; right?: Buffer }

export async function renderDocx(doc: Doc, logos: DocxLogos = {}, photoWidth = 900): Promise<Buffer> {
  const media: Media[] = [];
  let docPr = 1;

  async function addMedia(bytes: Buffer, resize?: number): Promise<Media | null> {
    let data = bytes;
    if (resize) {
      try {
        const sharp = (await import('sharp')).default;
        data = await sharp(bytes).rotate().resize({ width: resize, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      } catch {
        data = bytes;
      }
    }
    const info = imageInfo(data);
    if (!info || (info.kind !== 'jpeg' && info.kind !== 'png')) return null;
    const n = media.length + 1;
    const m: Media = { rId: `rIdImg${n}`, file: `image${n}.${info.kind === 'jpeg' ? 'jpg' : 'png'}`, kind: info.kind, bytes: data, w: info.width, h: info.height };
    media.push(m);
    return m;
  }

  const picture = (m: Media, maxWpx: number, maxHpx: number) => {
    const s = Math.min(maxWpx / m.w, maxHpx / m.h, 1e6);
    const cx = Math.round(m.w * s * EMU);
    const cy = Math.round(m.h * s * EMU);
    const id = docPr++;
    return (
      `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${m.file}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${m.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
      `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    );
  };

  const body: string[] = [];
  let first = true;
  for (const chapter of doc.chapters) {
    let atStart = true;
    for (const b of chapter.blocks) {
      switch (b.t) {
        case 'h1':
          body.push(textPara(b.text, { size: 36, bold: true, color: '0062B8', after: 120, pageBreak: !first && atStart, keepNext: true }));
          break;
        case 'h2':
          body.push(textPara(b.tag ? `${b.text}    [${b.tag}]` : b.text, { size: 23, bold: true, color: 'FFFFFF', fill: b.color ?? '0E6E6B', before: 200, after: 100, keepNext: true, indent: 60 }));
          break;
        case 'h3':
          body.push(textPara(b.text, { size: 21, bold: true, color: '0E6E6B', before: 120, after: 60, keepNext: true }));
          break;
        case 'p':
          body.push(textPara(b.text, { size: b.small ? 16 : 18, color: b.tone ? TONE_HEX[b.tone] : b.small ? '777777' : '333333', after: 80 }));
          break;
        case 'note':
          body.push(textPara(b.text, { size: 18, color: TONE_HEX[b.tone ?? 'muted'], fill: b.tone ? TONE_FILL[b.tone] : 'F2F3F4', before: 40, after: 120, indent: 60 }));
          break;
        case 'table': {
          const w = b.weights ?? b.head.map(() => 1);
          const total = w.reduce((a, c) => a + c, 0);
          const widths = w.map((x) => Math.floor((x / total) * CONTENT_W));
          widths[widths.length - 1] += CONTENT_W - widths.reduce((a, c) => a + c, 0);
          const size = b.head.length > 8 ? 15 : 17;
          const cellPara = (text: string, align: 'left' | 'center' | 'right' | undefined, o: RunOpts) => para(run(text, { size, ...o }), { after: 0, align });
          const head = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${b.head.map((h, i) => cell(widths[i], cellPara(h, b.align?.[i] === 'right' ? 'right' : 'center', { bold: true, color: 'FFFFFF' }), b.headColor ?? '0E6E6B')).join('')}</w:tr>`;
          const rows = b.rows.map((r, ri) =>
            `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => {
              const tone = cellTone(c);
              return cell(widths[i], cellPara(cellText(c), b.align?.[i], { bold: cellBold(c), color: tone ? TONE_HEX[tone] : '333333' }), tone === 'bad' ? TONE_FILL.bad : ri % 2 === 1 ? 'F4F9F9' : undefined);
            }).join('')}</w:tr>`).join('');
          body.push(
            `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders>${BORDER('BFD9D8')}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
            `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
            `<w:tblGrid>${widths.map((x) => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>${head}${rows}</w:tbl>`,
            para('', { after: 100 }),
          );
          break;
        }
        case 'images': {
          const items = (await Promise.all(b.items.slice(0, 2).map(async (it) => ({ it, m: await addMedia(it.bytes, photoWidth) })))).filter((x) => x.m);
          if (!items.length) break;
          const half = Math.floor(CONTENT_W / 2);
          const blank = () => cell(half, para('', { after: 0 }));
          const slotted = (slot: 'left' | 'right') => items.find((x) => x.it.slot === slot) ?? (items.every((x) => !x.it.slot) ? items[slot === 'left' ? 0 : 1] : undefined);
          const cells = (['left', 'right'] as const).map((slot) => {
            const x = slotted(slot);
            return x ? cell(half, para(picture(x.m!, 290, 250), { after: 0, align: 'center' })) : blank();
          });
          body.push(
            `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="dashed" w:sz="8" w:space="0" w:color="426E6C"/>`).join('')}<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
            `<w:tblGrid><w:gridCol w:w="${half}"/><w:gridCol w:w="${CONTENT_W - half}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join('')}</w:tr></w:tbl>`,
            para('', { after: 100 }),
          );
          break;
        }
      }
      atStart = false;
    }
    first = false;
  }

  const logoL = logos.left ? await addMedia(logos.left) : null;
  const logoR = logos.right ? await addMedia(logos.right) : null;
  const headerMedia = [logoL, logoR].filter(Boolean) as Media[];
  const third = Math.floor(CONTENT_W / 6);
  const header =
    `<w:hdr ${NS}><w:tbl><w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="12" w:space="4" w:color="FFCC00"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${third}"/><w:gridCol w:w="${CONTENT_W - third * 2}"/><w:gridCol w:w="${third}"/></w:tblGrid><w:tr>` +
    cell(third, para(logoL ? picture(logoL, 120, 44) : '', { after: 0 })) +
    cell(CONTENT_W - third * 2, textPara(doc.title, { size: 26, bold: true, color: '0062B8', after: 0, align: 'center' }) + textPara(doc.subtitle, { size: 18, color: '777777', after: 0, align: 'center' })) +
    cell(third, para(logoR ? picture(logoR, 60, 44) : '', { after: 0, align: 'right' })) +
    `</w:tr></w:tbl>${para('', { after: 0 })}</w:hdr>`;

  const field = (instr: string) => `<w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  const footer =
    `<w:ftr ${NS}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="BFD9D8"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${CONTENT_W}"/></w:tabs><w:spacing w:before="0" w:after="0"/></w:pPr>` +
    `${run(doc.generated, { size: 15, color: '777777' })}<w:r><w:tab/></w:r>${run('Page ', { size: 15, color: '777777' })}${field('PAGE')}${run(' of ', { size: 15, color: '777777' })}${field('NUMPAGES')}</w:p></w:ftr>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}` +
    `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:footerReference w:type="default" r:id="rIdFtr"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/>` +
    `<w:pgMar w:top="1700" w:right="${MARGIN_X}" w:bottom="1000" w:left="${MARGIN_X}" w:header="500" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

  const zip = new JSZip();
  const mediaTypes = [...new Set(media.map((m) => (m.kind === 'jpeg' ? 'jpg' : 'png')))];
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
    mediaTypes.map((e) => `<Default Extension="${e}" ContentType="image/${e === 'jpg' ? 'jpeg' : 'png'}"/>`).join('') +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
    `<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
  );
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const imgRel = (m: Media) => `<Relationship Id="${m.rId}" Type="${REL}/image" Target="media/${m.file}"/>`;
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdSty" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdHdr" Type="${REL}/header" Target="header1.xml"/><Relationship Id="rIdFtr" Type="${REL}/footer" Target="footer1.xml"/>` +
    media.filter((m) => !headerMedia.includes(m)).map(imgRel).join('') + `</Relationships>`,
  );
  zip.file('word/_rels/header1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${headerMedia.map(imgRel).join('')}</Relationships>`);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', styles);
  zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${header}`);
  zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${footer}`);
  for (const m of media) zip.file(`word/media/${m.file}`, m.bytes);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
