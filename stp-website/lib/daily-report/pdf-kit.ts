import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';

/**
 * A tiny layout toolkit on top of pdf-lib: flowing text, wrapped tables that continue across pages, KPI tiles, section
 * banners, images, and a header (logos + title) / footer (page numbers) on every page. Standard PDF fonts only, so
 * text is passed through pdfSafe() which swaps the few characters those fonts cannot draw.
 */

export const hex = (h: string): RGB => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);

export const COLORS = {
  teal: hex('0E6E6B'), tealDark: hex('073332'), stripe: hex('F4F9F9'), line: hex('BFD9D8'),
  text: hex('333333'), muted: hex('777777'), white: hex('FFFFFF'),
  bad: hex('C0392B'), badBg: hex('FBEAE8'), good: hex('1E8449'), goodBg: hex('E8F6EE'),
  blue: hex('0062B8'), amber: hex('B9770E'), amberBg: hex('FEF5E7'), orange: hex('D35400'), green: hex('1E8449'), purple: hex('6C3483'),
  grayBg: hex('F2F3F4'),
};

// ── text that standard fonts can draw ────────────────────────────────────────

const SWAP: Record<string, string> = {
  '≤': '<=', '≥': '>=', '→': '->', '↗': 'up', '↘': 'down', '↑': 'up', '↓': 'down', '✓': 'OK', '✔': 'OK', '▲': '^', '▼': 'v',
  '■': '•', '≈': '~', '−': '-', '₂': '2', '‑': '-', ' ': ' ', '\t': ' ', ' ': ' ',
};
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function pdfSafe(s: string): string {
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)!;
    if (SWAP[ch] !== undefined) out += SWAP[ch];
    else if (ch === '\n') out += '\n';
    else if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
    else if (c <= 0xff || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else out += '?';
  }
  return out;
}

// ── layout ───────────────────────────────────────────────────────────────────

export const PAGE = { w: 595.28, h: 841.89, margin: 40, top: 92, bottom: 50 };
export const CONTENT_W = PAGE.w - PAGE.margin * 2;

export interface Column { header: string; w: number; align?: 'left' | 'center' | 'right' }
export interface CellStyle { color?: RGB; bold?: boolean; fill?: RGB }

export interface Logos { left?: Uint8Array; right?: Uint8Array }

export class Kit {
  pdf!: PDFDocument;
  regular!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  /** distance from the top of the page */
  y = 0;
  /** colour of table header rows (set per department section) */
  accent: RGB = COLORS.teal;
  private logoL?: PDFImage;
  private logoR?: PDFImage;

  static async create(logos: Logos = {}): Promise<Kit> {
    const k = new Kit();
    k.pdf = await PDFDocument.create();
    k.regular = await k.pdf.embedFont(StandardFonts.Helvetica);
    k.bold = await k.pdf.embedFont(StandardFonts.HelveticaBold);
    if (logos.left) k.logoL = await k.pdf.embedPng(logos.left);
    if (logos.right) k.logoR = await k.pdf.embedPng(logos.right);
    return k;
  }

  // ── pages ──
  addPage() {
    this.page = this.pdf.addPage([PAGE.w, PAGE.h]);
    this.y = PAGE.top;
  }
  get pageCount() { return this.pdf.getPageCount(); }
  ensure(h: number) {
    if (!this.page || this.y + h > PAGE.h - PAGE.bottom) this.addPage();
  }
  space(h: number) { this.y += h; }
  private py(fromTop: number) { return PAGE.h - fromTop; }

  // ── text ──
  width(s: string, size: number, bold = false) {
    return (bold ? this.bold : this.regular).widthOfTextAtSize(pdfSafe(s), size);
  }

  wrap(s: string, size: number, maxW: number, bold = false): string[] {
    const font = bold ? this.bold : this.regular;
    const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxW;
    const lines: string[] = [];
    for (const para of pdfSafe(s).split('\n')) {
      let line = '';
      for (let word of para.split(' ')) {
        // break a word that is wider than the whole line
        while (!fits(word) && word.length > 1) {
          let cut = word.length - 1;
          while (cut > 1 && !fits(word.slice(0, cut))) cut--;
          if (line) { lines.push(line); line = ''; }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        const next = line ? `${line} ${word}` : word;
        if (fits(next)) line = next;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  }

  /** A paragraph at the current position (wraps, flows onto the next page). */
  text(s: string, o: { size?: number; bold?: boolean; color?: RGB; x?: number; maxW?: number; gap?: number; align?: 'left' | 'center' | 'right' } = {}) {
    const size = o.size ?? 9;
    const x = o.x ?? PAGE.margin;
    const maxW = o.maxW ?? CONTENT_W - (x - PAGE.margin);
    const lh = size * 1.35;
    for (const line of this.wrap(s, size, maxW, o.bold)) {
      this.ensure(lh);
      const w = this.width(line, size, o.bold);
      const dx = o.align === 'center' ? (maxW - w) / 2 : o.align === 'right' ? maxW - w : 0;
      this.page.drawText(line, { x: x + dx, y: this.py(this.y + size), size, font: o.bold ? this.bold : this.regular, color: o.color ?? COLORS.text });
      this.y += lh;
    }
    this.y += o.gap ?? 0;
  }

  // ── blocks ──
  /** Full-width coloured title bar for a section; `tag` is a small pill on the right (e.g. SAMPLE DATA). */
  banner(title: string, color: RGB, tag?: { text: string; fg: RGB; bg: RGB }) {
    this.ensure(30);
    const h = 24;
    this.page.drawRectangle({ x: PAGE.margin, y: this.py(this.y + h), width: CONTENT_W, height: h, color });
    this.page.drawText(pdfSafe(title), { x: PAGE.margin + 10, y: this.py(this.y + 16), size: 11.5, font: this.bold, color: COLORS.white });
    if (tag) {
      const tw = this.width(tag.text, 8, true) + 14;
      this.page.drawRectangle({ x: PAGE.margin + CONTENT_W - tw - 8, y: this.py(this.y + 19), width: tw, height: 14, color: tag.bg });
      this.page.drawText(pdfSafe(tag.text), { x: PAGE.margin + CONTENT_W - tw - 1, y: this.py(this.y + 15), size: 8, font: this.bold, color: tag.fg });
    }
    this.y += h + 8;
  }

  subheading(s: string, color: RGB = COLORS.teal) {
    this.ensure(78); // heading + the table header and a first row
    this.text(s, { size: 10.5, bold: true, color, gap: 3 });
  }

  /** Tinted note box with wrapped text. */
  note(s: string, o: { fg?: RGB; bg?: RGB; size?: number } = {}) {
    const size = o.size ?? 8.5;
    const lines = this.wrap(s, size, CONTENT_W - 20);
    const h = lines.length * size * 1.35 + 12;
    this.ensure(h + 4);
    this.page.drawRectangle({ x: PAGE.margin, y: this.py(this.y + h), width: CONTENT_W, height: h, color: o.bg ?? COLORS.grayBg });
    let ly = this.y + 7;
    for (const line of lines) {
      this.page.drawText(line, { x: PAGE.margin + 10, y: this.py(ly + size), size, font: this.regular, color: o.fg ?? COLORS.text });
      ly += size * 1.35;
    }
    this.y += h + 8;
  }

  /** Row(s) of equal tiles: label, big value, small sub line; border/value colour shows status. */
  tiles(items: { label: string; value: string; sub?: string; color?: RGB; bg?: RGB }[], perRow = 4) {
    const gap = 8;
    const w = (CONTENT_W - gap * (perRow - 1)) / perRow;
    const h = 54;
    for (let i = 0; i < items.length; i += perRow) {
      this.ensure(h + gap);
      items.slice(i, i + perRow).forEach((t, j) => {
        const x = PAGE.margin + j * (w + gap);
        const col = t.color ?? COLORS.teal;
        this.page.drawRectangle({ x, y: this.py(this.y + h), width: w, height: h, color: t.bg ?? COLORS.stripe, borderColor: col, borderWidth: 0.8 });
        this.page.drawText(pdfSafe(t.label), { x: x + 8, y: this.py(this.y + 14), size: 7.5, font: this.bold, color: COLORS.muted });
        this.page.drawText(pdfSafe(t.value), { x: x + 8, y: this.py(this.y + 34), size: 17, font: this.bold, color: col });
        if (t.sub) this.page.drawText(pdfSafe(t.sub), { x: x + 8, y: this.py(this.y + 47), size: 7, font: this.regular, color: COLORS.muted });
      });
      this.y += h + gap;
    }
  }

  /** Table with a coloured header row that repeats on every page it spans. */
  table(
    cols: Column[],
    rows: string[][],
    o: { headFill?: RGB; size?: number; cell?: (r: number, c: number, text: string) => CellStyle | undefined; zebra?: boolean; empty?: string } = {},
  ) {
    const size = o.size ?? 8.5;
    const pad = 4;
    const lh = size * 1.3;
    const headFill = o.headFill ?? this.accent;

    const drawHeader = () => {
      const lines = cols.map((c) => this.wrap(c.header, size, c.w - pad * 2, true));
      const h = Math.max(...lines.map((l) => l.length)) * lh + pad * 2;
      let x = PAGE.margin;
      cols.forEach((c, i) => {
        this.page.drawRectangle({ x, y: this.py(this.y + h), width: c.w, height: h, color: headFill });
        lines[i].forEach((ln, k) => {
          const tw = this.width(ln, size, true);
          const dx = c.align === 'center' ? (c.w - tw) / 2 : c.align === 'right' ? c.w - tw - pad : pad;
          this.page.drawText(ln, { x: x + dx, y: this.py(this.y + pad + size + k * lh), size, font: this.bold, color: COLORS.white });
        });
        x += c.w;
      });
      this.y += h;
    };

    if (rows.length === 0) {
      this.note(o.empty ?? 'Nothing recorded.');
      return;
    }

    const measure = (row: string[], r: number) => {
      const lines = row.map((t, i) => this.wrap(t ?? '', size, cols[i].w - pad * 2, o.cell?.(r, i, t)?.bold));
      return { lines, h: Math.max(...lines.map((l) => l.length)) * lh + pad * 2 };
    };

    this.ensure(measure(rows[0], 0).h + 40);
    drawHeader();
    rows.forEach((row, r) => {
      const m = measure(row, r);
      if (this.y + m.h > PAGE.h - PAGE.bottom) {
        this.addPage();
        drawHeader();
      }
      let x = PAGE.margin;
      row.forEach((t, i) => {
        const st = o.cell?.(r, i, t) ?? {};
        const fill = st.fill ?? (o.zebra !== false && r % 2 === 1 ? COLORS.stripe : COLORS.white);
        this.page.drawRectangle({ x, y: this.py(this.y + m.h), width: cols[i].w, height: m.h, color: fill, borderColor: COLORS.line, borderWidth: 0.5 });
        const font = st.bold ? this.bold : this.regular;
        m.lines[i].forEach((ln, k) => {
          const tw = font.widthOfTextAtSize(ln, size);
          const al = cols[i].align;
          const dx = al === 'center' ? (cols[i].w - tw) / 2 : al === 'right' ? cols[i].w - tw - pad : pad;
          this.page.drawText(ln, { x: x + dx, y: this.py(this.y + pad + size + k * lh), size, font, color: st.color ?? COLORS.text });
        });
        x += cols[i].w;
      });
      this.y += m.h;
    });
    this.y += 8;
  }

  /** Draws an image scaled to fit the box (left aligned); returns the drawn height. */
  image(img: PDFImage, x: number, maxW: number, maxH: number): { w: number; h: number } {
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s;
    const h = img.height * s;
    this.page.drawImage(img, { x, y: this.py(this.y + h), width: w, height: h });
    return { w, h };
  }

  // ── header / footer on every page, then serialise ──
  async finish(opts: { title: string; subtitle: string; generated: string }): Promise<Uint8Array> {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      const hh = 42;
      const lh = this.logoL ? Math.min(hh, 40) : 0;
      if (this.logoL) {
        const s = lh / this.logoL.height;
        p.drawImage(this.logoL, { x: PAGE.margin, y: PAGE.h - 20 - lh, width: this.logoL.width * s, height: lh });
      }
      if (this.logoR) p.drawImage(this.logoR, { x: PAGE.w - PAGE.margin - hh, y: PAGE.h - 20 - hh, width: hh, height: hh });
      const cx = (s: string, size: number, bold: boolean) => (PAGE.w - (bold ? this.bold : this.regular).widthOfTextAtSize(pdfSafe(s), size)) / 2;
      p.drawText(pdfSafe(opts.title), { x: cx(opts.title, 13, true), y: PAGE.h - 36, size: 13, font: this.bold, color: COLORS.blue });
      p.drawText(pdfSafe(opts.subtitle), { x: cx(opts.subtitle, 9, false), y: PAGE.h - 50, size: 9, font: this.regular, color: COLORS.muted });
      p.drawLine({ start: { x: PAGE.margin, y: PAGE.h - 70 }, end: { x: PAGE.w - PAGE.margin, y: PAGE.h - 70 }, thickness: 1.5, color: hex('FFCC00') });
      p.drawLine({ start: { x: PAGE.margin, y: PAGE.h - 72.5 }, end: { x: PAGE.w - PAGE.margin, y: PAGE.h - 72.5 }, thickness: 0.6, color: COLORS.blue });

      p.drawLine({ start: { x: PAGE.margin, y: 38 }, end: { x: PAGE.w - PAGE.margin, y: 38 }, thickness: 0.5, color: COLORS.line });
      p.drawText(pdfSafe(opts.generated), { x: PAGE.margin, y: 26, size: 7.5, font: this.regular, color: COLORS.muted });
      const num = `Page ${i + 1} of ${pages.length}`;
      p.drawText(num, { x: PAGE.w - PAGE.margin - this.regular.widthOfTextAtSize(num, 7.5), y: 26, size: 7.5, font: this.regular, color: COLORS.muted });
    });
    this.pdf.setTitle(pdfSafe(opts.title));
    this.pdf.setSubject(pdfSafe(opts.subtitle));
    this.pdf.setProducer('7 MGD STP portal');
    return this.pdf.save();
  }
}
