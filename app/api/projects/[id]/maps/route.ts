import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import type { AddMapPlaceBody } from '@/lib/types/project';
import { randomUUID } from 'node:crypto';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/maps
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { place_id, name } = (body ?? {}) as Partial<AddMapPlaceBody>;
  if (!place_id || !name) {
    return NextResponse.json({ error: 'place_id and name are required' }, { status: 400 });
  }

  project.google_maps_places.push({ id: randomUUID(), place_id, name, enabled: true });
  await saveProject(project);
  return NextResponse.json(toProjectDetail(project), { status: 201 });
}
