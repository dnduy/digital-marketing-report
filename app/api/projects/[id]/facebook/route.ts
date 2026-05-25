import { NextResponse } from 'next/server';
import { getStoredProject, saveProject, toProjectDetail } from '@/lib/db/projects';
import { encrypt } from '@/lib/utils/crypto';
import type { AddFacebookPageBody } from '@/lib/types/project';
import { randomUUID } from 'node:crypto';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/facebook
export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  const project = await getStoredProject(id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fb_page_id, name, access_token } =
    (body ?? {}) as Partial<AddFacebookPageBody>;
  if (!fb_page_id || !name || !access_token) {
    return NextResponse.json(
      { error: 'fb_page_id, name, access_token are required' },
      { status: 400 }
    );
  }

  project.facebook_pages.push({
    id: randomUUID(),
    fb_page_id,
    name,
    access_token: encrypt(access_token),
    enabled: true,
  });

  await saveProject(project);
  return NextResponse.json(toProjectDetail(project), { status: 201 });
}
