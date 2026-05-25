import { NextResponse } from 'next/server';
import {
  getAllStoredProjects,
  saveProject,
  buildNewProject,
  toProjectSummary,
  isValidProjectId,
  listProjectIds,
} from '@/lib/db/projects';
import type { CreateProjectBody } from '@/lib/types/project';

// GET /api/projects — list all projects (no secrets)
export async function GET(): Promise<Response> {
  try {
    const projects = await getAllStoredProjects();
    return NextResponse.json(projects.map(toProjectSummary));
  } catch (err) {
    console.error('[api/projects] GET failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects — create new project
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, name, telegram_chat_id, google_sheet_id } =
    (body ?? {}) as Partial<CreateProjectBody>;

  if (!id || !name || !telegram_chat_id || !google_sheet_id) {
    return NextResponse.json(
      { error: 'id, name, telegram_chat_id, google_sheet_id are required' },
      { status: 400 }
    );
  }

  if (!isValidProjectId(id)) {
    return NextResponse.json(
      { error: 'id must be lowercase alphanumeric + dash, 2-32 chars' },
      { status: 400 }
    );
  }

  // Check for duplicate
  const ids = await listProjectIds();
  if (ids.includes(id)) {
    return NextResponse.json(
      { error: `Project "${id}" already exists` },
      { status: 409 }
    );
  }

  const project = buildNewProject(id, name, telegram_chat_id, google_sheet_id);
  await saveProject(project);

  return NextResponse.json(toProjectSummary(project), { status: 201 });
}
