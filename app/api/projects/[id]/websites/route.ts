import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import type { AddWebsiteBody } from '@/lib/types/project';
import { randomUUID } from 'node:crypto';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/websites
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { domain, wp_api_url, ga4_property_id, gsc_url } =
    (body ?? {}) as Partial<AddWebsiteBody>;
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 });
  }

  project.websites.push({
    id: randomUUID(),
    domain,
    wp_api_url,
    ga4_property_id,
    gsc_url,
    enabled: true,
  });

  await saveProject(project);
  return NextResponse.json(toProjectDetail(project), { status: 201 });
}
