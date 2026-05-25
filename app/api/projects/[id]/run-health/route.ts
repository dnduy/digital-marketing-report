import { NextResponse } from 'next/server';
import { getDecryptedProject } from '@/lib/db/projects';
import { runHealthCheckForProject } from '@/lib/workflows/health';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/run-health
export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getDecryptedProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await runHealthCheckForProject(project);
    return NextResponse.json({ ok: true, checks: result });
  } catch (err) {
    console.error(`[run-health:${id}]`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
