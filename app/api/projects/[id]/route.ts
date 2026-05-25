import { NextResponse } from 'next/server';
import {
  getStoredProject,
  saveProject,
  deleteProject,
  toProjectSummary,
  toProjectDetail,
} from '@/lib/db/projects';
import { encrypt } from '@/lib/utils/crypto';
import type { PatchProjectBody } from '@/lib/types/project';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — detail with masked secrets
export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(toProjectDetail(project));
}

// PATCH /api/projects/[id] — update metadata / secrets
export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch = (body ?? {}) as Partial<PatchProjectBody>;

  if (patch.name !== undefined) project.name = patch.name;
  if (patch.enabled !== undefined) project.enabled = patch.enabled;
  if (patch.telegram_chat_id) {
    project.telegram_chat_id = encrypt(patch.telegram_chat_id);
  }
  if (patch.google_sheet_id) {
    project.google_sheet_id = encrypt(patch.google_sheet_id);
  }

  await saveProject(project);
  return NextResponse.json(toProjectSummary(project));
}

// DELETE /api/projects/[id]
export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
