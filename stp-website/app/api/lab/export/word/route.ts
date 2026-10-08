import { NextResponse } from 'next/server';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { sheetLabel } from '@/lib/lab-export/excel';
import { requireLabViewer } from '@/lib/lab-export/auth';
import { parsePhotoSrc, readLabPhoto } from '@/lib/lab-export/photos';
import { buildDailyReports, ExportTooLarge, type DayPhoto } from '@/lib/lab-export/word';

const MAX_DAYS = 31;
const isDate = (s: string | null): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-');

/**
 * GET /api/lab/export/word?from=2026-09-10&to=2026-09-15&photos=1
 * One page per day (days that have lab readings) in the lab team's own Word layout (see lib/lab-export/word.ts).
 */
export async function GET(request: Request) {
  const denied = await requireLabViewer();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const from = q.get('from');
  const to = q.get('to') ?? from;
  if (!isDate(from) || !isDate(to)) return NextResponse.json({ error: 'Choose a valid date or date range.' }, { status: 400 });
  if (to < from) return NextResponse.json({ error: 'The “to” date is before the “from” date.' }, { status: 400 });
  if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > MAX_DAYS) {
    return NextResponse.json({ error: `Choose at most ${MAX_DAYS} days at a time.` }, { status: 400 });
  }
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
    const lastOfMonth = `${to.slice(0, 7)}-${String(new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
    const name =
      from === to ? `Lab Report ${ddmmyyyy(from)}`
      : from.endsWith('-01') && from.slice(0, 7) === to.slice(0, 7) && to === lastOfMonth ? `${sheetLabel(from.slice(0, 7))} Lab Report`
      : `Lab Report ${ddmmyyyy(from)} to ${ddmmyyyy(to)}`;
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
