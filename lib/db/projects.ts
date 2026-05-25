import { kv } from '@vercel/kv';
import { encrypt, decrypt, maskSecret } from '@/lib/utils/crypto';
import type {
  StoredProject,
  DecryptedProject,
  ProjectSummary,
  ProjectDetail,
} from '@/lib/types/project';

const INDEX_KEY = 'projects:index';
const projectKey = (id: string) => `project:${id}`;

// ── Index helpers ─────────────────────────────────────────────────────────────

export async function listProjectIds(): Promise<string[]> {
  return (await kv.get<string[]>(INDEX_KEY)) ?? [];
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getStoredProject(id: string): Promise<StoredProject | null> {
  return (await kv.get<StoredProject>(projectKey(id))) ?? null;
}

export async function getAllStoredProjects(): Promise<StoredProject[]> {
  const ids = await listProjectIds();
  const results = await Promise.all(ids.map((id) => getStoredProject(id)));
  return results.filter((p): p is StoredProject => p !== null);
}

export async function getDecryptedProject(id: string): Promise<DecryptedProject | null> {
  const stored = await getStoredProject(id);
  if (!stored) return null;
  try {
    return decryptProject(stored);
  } catch (err) {
    console.error('[projects] decrypt failed for', id, err);
    return null;
  }
}

export async function getAllDecryptedProjects(): Promise<DecryptedProject[]> {
  const ids = await listProjectIds();
  const results = await Promise.all(ids.map((id) => getDecryptedProject(id)));
  return results.filter((p): p is DecryptedProject => p !== null);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveProject(project: StoredProject): Promise<void> {
  const ids = await listProjectIds();
  if (!ids.includes(project.id)) {
    await kv.set(INDEX_KEY, [...ids, project.id]);
  }
  await kv.set(projectKey(project.id), {
    ...project,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProject(id: string): Promise<void> {
  const ids = await listProjectIds();
  await kv.set(INDEX_KEY, ids.filter((x) => x !== id));
  await kv.del(projectKey(id));
  await kv.del(`state:${id}`); // clean up run state too
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildNewProject(
  id: string,
  name: string,
  telegramChatId: string,
  googleSheetId: string
): StoredProject {
  const now = new Date().toISOString();
  return {
    id,
    name,
    created_at: now,
    updated_at: now,
    enabled: true,
    telegram_chat_id: encrypt(telegramChatId),
    google_sheet_id: encrypt(googleSheetId),
    websites: [],
    facebook_pages: [],
    google_maps_places: [],
  };
}

// ── Projection helpers ────────────────────────────────────────────────────────

/** Full decrypt — plaintext only used in server-side workflows, never sent to client. */
export function decryptProject(stored: StoredProject): DecryptedProject {
  return {
    ...stored,
    telegram_chat_id: decrypt(stored.telegram_chat_id),
    google_sheet_id: decrypt(stored.google_sheet_id),
    facebook_pages: stored.facebook_pages.map((p) => ({
      id: p.id,
      fb_page_id: p.fb_page_id,
      name: p.name,
      access_token: decrypt(p.access_token),
      enabled: p.enabled,
    })),
  };
}

/** Safe summary for list endpoint — no secrets. */
export function toProjectSummary(stored: StoredProject): ProjectSummary {
  return {
    id: stored.id,
    name: stored.name,
    enabled: stored.enabled,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
    counts: {
      websites: stored.websites.length,
      facebook_pages: stored.facebook_pages.length,
      google_maps_places: stored.google_maps_places.length,
    },
  };
}

/** Detail view with masked secrets — safe for client. */
export function toProjectDetail(stored: StoredProject): ProjectDetail {
  let telegramMasked = '(chưa nhập)';
  let sheetMasked = '(chưa nhập)';
  try {
    telegramMasked = maskSecret(decrypt(stored.telegram_chat_id));
    sheetMasked = maskSecret(decrypt(stored.google_sheet_id));
  } catch {
    // decrypt failed (wrong key?) — keep masked placeholder
  }

  return {
    id: stored.id,
    name: stored.name,
    enabled: stored.enabled,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
    telegram_chat_id_masked: telegramMasked,
    google_sheet_id_masked: sheetMasked,
    websites: stored.websites,
    facebook_pages: stored.facebook_pages.map((p) => {
      let tokenMasked = '(chưa nhập)';
      try {
        tokenMasked = maskSecret(decrypt(p.access_token));
      } catch {
        // keep placeholder
      }
      return {
        id: p.id,
        fb_page_id: p.fb_page_id,
        name: p.name,
        access_token_masked: tokenMasked,
        enabled: p.enabled,
      };
    }),
    google_maps_places: stored.google_maps_places,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Validate slug: lowercase alphanumeric + dash, 2–32 chars */
export function isValidProjectId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,31}$/.test(id);
}
