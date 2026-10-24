import { NextResponse } from 'next/server';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { requireLabViewer } from '@/lib/lab-export/auth';
import { labFileName, readRange } from '@/lib/lab-export/names';
import { parsePhotoSrc, readLabPhoto } from '@/lib/lab-export/photos';
import { buildDailyReports, ExportTooLarge, type DayPhoto } from '@/lib/lab-export/word';

export async function GET(request: Request) {
  const denied = await requireLabViewer();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const range = readRange(q);
  if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
  const { from, to } = range;
  const withPhotos = q.get('photos') !== '0';

  const { data } = await loadLab();
  const days = data.months.flatMap((m) => m.days).filter((d) => d.date >= from && d.date <= to);
  if (days.length === 0) return NextResponse.json({ error: 'There are no lab readings in that period.' }, { status: 404 });

  const items = await Promise.all(
    days.map(async (day) => {
      const report = data.reports[day.date];
      const photos: DayPhoto[] = [];
      if (withPhotos) {
        for (const p of report?.photos ?? []) {
          const ref = parsePhotoSrc(p.src);
          const bytes = ref && (await readLabPhoto(ref.month, ref.file));
          if (bytes) photos.push({ kind: p.kind, bytes });
        }
      }
      return { day, report, photos };
    }),
  );

  try {
    const file = await buildDailyReports(items);
    const name = labFileName(from, to);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${name}.docx"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof ExportTooLarge) return NextResponse.json({ error: err.message }, { status: 413 });
    console.error('[lab word export]', err);
    return NextResponse.json({ error: 'Could not create the Word file. Please try again.' }, { status: 500 });
  }
}
