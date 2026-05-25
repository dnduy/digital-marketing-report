import { kv } from '@vercel/kv';
import type { ProjectState } from '@/lib/types';

const KEY_PREFIX = 'state';

function stateKey(projectId: string): string {
  return `${KEY_PREFIX}:${projectId}`;
}

export async function getProjectState(
  projectId: string
): Promise<ProjectState | null> {
  try {
    const state = await kv.get<ProjectState>(stateKey(projectId));
    return state ?? null;
  } catch (err) {
    console.error('[kv] getProjectState failed', projectId, err);
    return null;
  }
}

export async function setProjectState(
  projectId: string,
  state: ProjectState
): Promise<void> {
  try {
    await kv.set(stateKey(projectId), state);
  } catch (err) {
    console.error('[kv] setProjectState failed', projectId, err);
  }
}

export function buildDefaultState(projectId: string): ProjectState {
  return {
    project_id: projectId,
    last_run_at: new Date().toISOString(),
    websites: {},
    facebook_pages: {},
    google_maps_places: {},
  };
}
