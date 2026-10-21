import type { PDFImage } from 'pdf-lib';
import { COLORS, CONTENT_W, Kit, hex, type CellStyle, type Logos } from '@/lib/daily-report/pdf-kit';
import { imageInfo } from '@/lib/lab-export/image';
import { TONE_FILL, TONE_HEX, cellBold, cellText, cellTone, type Doc } from './model';

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

/** Draws a Doc: every chapter starts on a new page; tables continue across pages with a repeated header. */
export async function renderPdf(doc: Doc, logos: Logos, photoWidth = 1000): Promise<Uint8Array> {
  const kit = await Kit.create(logos);

  for (const chapter of doc.chapters) {
    kit.addPage();
    for (const b of chapter.blocks) {
      switch (b.t) {
        case 'h1':
          kit.text(b.text, { size: 18, bold: true, color: COLORS.blue, gap: 6 });
          break;
        case 'h2':
          kit.space(4);
          kit.banner(b.text, b.color ? hex(b.color) : COLORS.teal, b.tag ? { text: b.tag, fg: COLORS.good, bg: COLORS.goodBg } : undefined);
          break;
        case 'h3':
          kit.subheading(b.text);
          break;
        case 'p':
          kit.text(b.text, { size: b.small ? 7.5 : 8.5, color: b.tone ? hex(TONE_HEX[b.tone]) : b.small ? COLORS.muted : COLORS.text, gap: 4 });
          break;
        case 'note':
          kit.note(b.text, { fg: hex(TONE_HEX[b.tone ?? 'muted']), bg: b.tone ? hex(TONE_FILL[b.tone]) : COLORS.grayBg });
          break;
        case 'table': {
          const weights = b.weights ?? b.head.map(() => 1);
          const total = weights.reduce((a, c) => a + c, 0);
          const cols = b.head.map((h, i) => ({ header: h, w: (weights[i] / total) * CONTENT_W, align: b.align?.[i] }));
          kit.table(cols, b.rows.map((r) => r.map(cellText)), {
            size: b.head.length > 8 ? 7.5 : 8,
            headFill: b.headColor ? hex(b.headColor) : undefined,
            cell: (r, c): CellStyle | undefined => {
              const cell = b.rows[r][c];
              const tone = cellTone(cell);
              if (tone) return { color: hex(TONE_HEX[tone]), bold: cellBold(cell), ...(tone === 'bad' ? { fill: hex(TONE_FILL.bad) } : {}) };
              return cellBold(cell) ? { bold: true } : undefined;
            },
          });
          break;
        }
        case 'images': {
          const [left, right] = await Promise.all((['left', 'right'] as const).map(async (slot, i) => {
            const item = b.items.find((it) => it.slot === slot) ?? (b.items.every((it) => !it.slot) ? b.items[i] : undefined);
            return item ? embed(kit, item.bytes, photoWidth) : null;
          }));
          kit.photoFrame(left ?? undefined, right ?? undefined);
          break;
        }
      }
    }
  }

  return kit.finish({ title: doc.title, subtitle: doc.subtitle, generated: doc.generated });
}
