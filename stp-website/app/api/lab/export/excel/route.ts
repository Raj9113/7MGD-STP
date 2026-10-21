import { NextResponse } from 'next/server';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { buildMonthWorkbook, sheetLabel } from '@/lib/lab-export/excel';
import { requireLabViewer } from '@/lib/lab-export/auth';
import { labFileName, readRange } from '@/lib/lab-export/names';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * GET /api/lab/export/excel?month=2026-09                   the whole month
 * GET /api/lab/export/excel?from=2026-09-10&to=2026-09-15   a day or custom dates (inside one month)
 * A sheet in the lab team's own Excel layout (see lib/lab-export/excel.ts).
 */
export async function GET(request: Request) {
  const denied = await requireLabViewer();
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const { data } = await loadLab();

  if (q.get('from')) {
    const range = readRange(q);
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
    const { from, to } = range;
    if (from.slice(0, 7) !== to.slice(0, 7)) {
      return NextResponse.json({ error: 'An Excel sheet covers one month. Choose dates inside one month, or download Word / PDF for a longer period.' }, { status: 400 });
    }
    const month = data.months.find((m) => m.key === from.slice(0, 7));
    if (!month || !month.days.some((d) => d.date >= from && d.date <= to)) {
      return NextResponse.json({ error: 'There are no lab readings in that period.' }, { status: 404 });
    }
    const dates = Array.from({ length: (Date.parse(to) - Date.parse(from)) / 86400000 + 1 }, (_, i) => new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10));
    const file = await buildMonthWorkbook(month.key, month.days, dates);
    return new NextResponse(new Uint8Array(file), {
      headers: { 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename="${labFileName(from, to)}.xlsx"`, 'Cache-Control': 'private, no-store' },
    });
  }

  const month = q.get('month') ?? '';
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Choose a month.' }, { status: 400 });
  const found = data.months.find((m) => m.key === month);
  if (!found || found.days.length === 0) return NextResponse.json({ error: 'There are no lab readings for that month.' }, { status: 404 });

  const file = await buildMonthWorkbook(month, found.days);
  return new NextResponse(new Uint8Array(file), {
    headers: { 'Content-Type': XLSX, 'Content-Disposition': `attachment; filename="Lab Report 7MGD STP SV - ${sheetLabel(month)}.xlsx"`, 'Cache-Control': 'private, no-store' },
  });
}
