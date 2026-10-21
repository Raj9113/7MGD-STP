import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { requireLabViewer } from '@/lib/lab-export/auth';
import { labFileName, readRange } from '@/lib/lab-export/names';
import { parsePhotoSrc, readLabPhoto } from '@/lib/lab-export/photos';
import type { DayPhotoBytes } from '@/lib/daily-report/build';
import { buildLabDoc } from '@/lib/daily-report/doc';
import { renderPdf } from '@/lib/report-doc/pdf';

const MAX_BYTES = 4_300_000; // what the host can return in one response (Vercel: 4.5 MB)

/**
 * GET /api/lab/export/pdf?from=2026-09-10&to=2026-09-15&photos=1
 * One page per day (days that have lab readings): limits table, sample photos and the energy-meter reading.
 */
export async function GET(request: Request) {
  const denied = await requireLabViewer();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const range = readRange(q);
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const { from, to } = range;
  const withPhotos = q.get('photos') !== '0';

  const { data } = await loadLab();
  const days = data.months.flatMap((m) => m.days).filter((d) => d.date >= from && d.date <= to).map((d) => d.date);
  if (days.length === 0) return NextResponse.json({ error: 'There are no lab readings in that period.' }, { status: 404 });

  const photos = new Map<string, DayPhotoBytes[]>();
  if (withPhotos) {
    await Promise.all(days.map(async (d) => {
      const list: DayPhotoBytes[] = [];
      for (const p of data.reports[d]?.photos ?? []) {
        const ref = parsePhotoSrc(p.src);
        const bytes = ref && (await readLabPhoto(ref.month, ref.file));
        if (bytes) list.push({ kind: p.kind, bytes });
      }
      if (list.length) photos.set(d, list);
    }));
  }

  try {
    const dir = path.join(process.cwd(), 'templates', 'report');
    const logos = { left: await readFile(path.join(dir, 'logo-left.png')), right: await readFile(path.join(dir, 'logo-right.png')) };
    const stamp = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
    const generated = `Generated ${stamp.slice(8, 10)}-${stamp.slice(5, 7)}-${stamp.slice(0, 4)} ${stamp.slice(11, 16)} IST`;
    const doc = buildLabDoc(days, data, photos, generated);

    let pdf: Uint8Array | null = null;
    for (const width of withPhotos ? [1000, 700, 480] : [1000]) {
      pdf = await renderPdf(doc, logos, width);
      if (pdf.length <= MAX_BYTES) break;
    }
    if (!pdf || pdf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'This report is too large to download in one go. Choose fewer days, or untick photographs.' }, { status: 413 });
    }
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${labFileName(from, to)}.pdf"`, 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[lab pdf export]', err);
    return NextResponse.json({ error: 'Could not create the PDF. Please try again.' }, { status: 500 });
  }
}
