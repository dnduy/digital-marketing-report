import { NextResponse } from 'next/server';
import { getDecryptedProject } from '@/lib/db/projects';
import { runDailyForProject } from '@/lib/workflows/daily';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/run-daily
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getDecryptedProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await runDailyForProject(project);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error(`[run-daily:${id}]`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
