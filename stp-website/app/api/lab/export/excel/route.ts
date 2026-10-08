import { NextResponse } from 'next/server';
import { loadLab } from '@/app/dashboard/laboratory/lab-live';
import { buildMonthWorkbook, sheetLabel } from '@/lib/lab-export/excel';
import { requireLabViewer } from '@/lib/lab-export/auth';

/**
 * GET /api/lab/export/excel?month=2026-09
 * The month as a sheet in the lab team's own Excel layout (see lib/lab-export/excel.ts).
 */
export async function GET(request: Request) {
  const denied = await requireLabViewer();
  if (denied) return denied;

  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Choose a month.' }, { status: 400 });

  const { data } = await loadLab();
  const found = data.months.find((m) => m.key === month);
  if (!found || found.days.length === 0) return NextResponse.json({ error: 'There are no lab readings for that month.' }, { status: 404 });

  const file = await buildMonthWorkbook(month, found.days);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Lab Report 7MGD STP SV - ${sheetLabel(month)}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
