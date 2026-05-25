import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import type { PatchMapPlaceBody } from '@/lib/types/project';

type Params = { params: Promise<{ id: string; mapId: string }> };

// PATCH /api/projects/[id]/maps/[mapId]
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id, mapId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const idx = project.google_maps_places.findIndex((m) => m.id === mapId);
  if (idx === -1) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<PatchMapPlaceBody>;
  const place = project.google_maps_places[idx];
  if (patch.place_id !== undefined) place.place_id = patch.place_id;
  if (patch.name !== undefined) place.name = patch.name;
  if (patch.enabled !== undefined) place.enabled = patch.enabled;

  await saveProject(project);
  return NextResponse.json(toProjectDetail(project));
}

// DELETE /api/projects/[id]/maps/[mapId]
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const { id, mapId } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  project.google_maps_places = project.google_maps_places.filter((m) => m.id !== mapId);
  await saveProject(project);
  return NextResponse.json({ ok: true });
}
