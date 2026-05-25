export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getAllDecryptedProjects } from '@/lib/db/projects';
import { runDailyForProject } from '@/lib/workflows/daily';

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const projects = (await getAllDecryptedProjects()).filter((p) => p.enabled);

  const results = [];
  for (const project of projects) {
    try {
      const result = await runDailyForProject(project);
      results.push({ project: project.id, ok: true, ...result });
    } catch (err) {
      console.error(`[daily] ${project.id} failed`, err);
      results.push({ project: project.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ success: true, results });
}
