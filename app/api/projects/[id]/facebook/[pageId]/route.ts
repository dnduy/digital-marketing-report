import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import { encrypt } from '@/lib/utils/crypto';
import type { PatchFacebookPageBody } from '@/lib/types/project';

type Params = { params: Promise<{ id: string; pageId: string }> };

// PATCH /api/projects/[id]/facebook/[pageId]
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id, pageId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const idx = project.facebook_pages.findIndex((p) => p.id === pageId);
  if (idx === -1) return NextResponse.json({ error: 'Page not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<PatchFacebookPageBody>;
  const page = project.facebook_pages[idx];
  if (patch.fb_page_id !== undefined) page.fb_page_id = patch.fb_page_id;
  if (patch.name !== undefined) page.name = patch.name;
  if (patch.access_token) page.access_token = encrypt(patch.access_token); // empty = keep old
  if (patch.enabled !== undefined) page.enabled = patch.enabled;

  await saveProject(project);
  return NextResponse.json(toProjectDetail(project));
}

// DELETE /api/projects/[id]/facebook/[pageId]
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const { id, pageId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  project.facebook_pages = project.facebook_pages.filter((p) => p.id !== pageId);
  await saveProject(project);
  return NextResponse.json({ ok: true });
}
