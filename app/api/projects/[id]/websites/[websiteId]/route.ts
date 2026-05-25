import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import type { PatchWebsiteBody } from '@/lib/types/project';

type Params = { params: Promise<{ id: string; websiteId: string }> };

// PATCH /api/projects/[id]/websites/[websiteId]
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id, websiteId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const idx = project.websites.findIndex((w) => w.id === websiteId);
  if (idx === -1) return NextResponse.json({ error: 'Website not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<PatchWebsiteBody>;
  const site = project.websites[idx];
  if (patch.domain !== undefined) site.domain = patch.domain;
  if (patch.wp_api_url !== undefined) site.wp_api_url = patch.wp_api_url;
  if (patch.ga4_property_id !== undefined) site.ga4_property_id = patch.ga4_property_id;
  if (patch.gsc_url !== undefined) site.gsc_url = patch.gsc_url;
  if (patch.enabled !== undefined) site.enabled = patch.enabled;

  await saveProject(project);
  return NextResponse.json(toProjectDetail(project));
}

// DELETE /api/projects/[id]/websites/[websiteId]
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const { id, websiteId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  project.websites = project.websites.filter((w) => w.id !== websiteId);
  await saveProject(project);
  return NextResponse.json({ ok: true });
}
