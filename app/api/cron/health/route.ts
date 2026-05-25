export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { projects } from '@/lib/config/projects.config';
import { runHealthCheckForProject } from '@/lib/workflows/health';

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = [];
  for (const project of projects) {
    try {
      const result = await runHealthCheckForProject(project);
      results.push({ project: project.id, ok: true, checks: result });
    } catch (err) {
      console.error(`[health] ${project.id} failed`, err);
      results.push({ project: project.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ success: true, results });
}
