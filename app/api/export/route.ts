export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getStoredProject } from '@/lib/db/projects';
import { decrypt } from '@/lib/utils/crypto';
import { readAllDailyLog } from '@/lib/db/sheets';
import { getTodayDateICT } from '@/lib/utils/date';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('project');
  if (!projectId) {
    return new Response('Missing project param', { status: 400 });
  }

  const project = await getStoredProject(projectId);
  if (!project) {
    return new Response('Project not found', { status: 404 });
  }

  const sheetId = decrypt(project.google_sheet_id);
  const rows = await readAllDailyLog(sheetId);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'DailyLog');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = getTodayDateICT();
  const filename = `${project.id}-${today}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
