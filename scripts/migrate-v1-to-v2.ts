/**
 * Migration: V1 (static projects.config.ts + env vars) → V2 (KV storage)
 * Usage: pnpm tsx scripts/migrate-v1-to-v2.ts
 *
 * Requires .env.local with:
 *   KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN, KV_REST_API_READ_ONLY_TOKEN
 *   ENCRYPTION_KEY
 *   All META_TOKEN_*, TELEGRAM_CHAT_ID_* vars for existing projects
 */

import 'dotenv/config';
import { saveProject, buildNewProject, getStoredProject } from '../lib/db/projects';
import { encrypt } from '../lib/utils/crypto';
import { randomUUID } from 'node:crypto';
import type { StoredProject } from '../lib/types/project';

// ── V1 config snapshot — copy your projects here before migrating ──────────────
interface V1FacebookPage {
  id: string;
  name: string;
  token_env_key: string;
}

interface V1Website {
  domain: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
}

interface V1Place {
  id: string;
  name: string;
}

interface V1Project {
  id: string;
  name: string;
  telegram_chat_id_env_key: string;
  google_sheet_id: string;
  sources: {
    websites: V1Website[];
    facebook_pages: V1FacebookPage[];
    google_maps_places: V1Place[];
  };
}

// Paste your V1 projects here:
const V1_PROJECTS: V1Project[] = [
  // Example — remove and add yours:
  // {
  //   id: 'my-project',
  //   name: 'My Project',
  //   telegram_chat_id_env_key: 'TELEGRAM_CHAT_ID_MYPROJECT',
  //   google_sheet_id: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
  //   sources: {
  //     websites: [{ domain: 'example.com', ga4_property_id: '123' }],
  //     facebook_pages: [{ id: '10000000000', name: 'My Page', token_env_key: 'META_TOKEN_MYPROJECT' }],
  //     google_maps_places: [{ id: 'ChIJxxxxxxxx', name: 'My Place' }],
  //   },
  // },
];

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

async function migrate() {
  if (V1_PROJECTS.length === 0) {
    console.log('No V1 projects defined. Edit V1_PROJECTS in this script first.');
    return;
  }

  for (const v1 of V1_PROJECTS) {
    console.log(`\nMigrating project: ${v1.id} (${v1.name})`);

    const existing = await getStoredProject(v1.id).catch(() => null);
    if (existing) {
      console.log(`  ⚠️  Project "${v1.id}" already exists in KV — skipping.`);
      continue;
    }

    const telegramChatId = requireEnv(v1.telegram_chat_id_env_key);

    const project: StoredProject = {
      id: v1.id,
      name: v1.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      enabled: true,
      telegram_chat_id: encrypt(telegramChatId),
      google_sheet_id: encrypt(v1.google_sheet_id),
      websites: v1.sources.websites.map((w) => ({
        id: randomUUID(),
        domain: w.domain,
        wp_api_url: w.wp_api_url,
        ga4_property_id: w.ga4_property_id,
        gsc_url: w.gsc_url,
        enabled: true,
      })),
      facebook_pages: v1.sources.facebook_pages.map((p) => {
        const token = requireEnv(p.token_env_key);
        return {
          id: randomUUID(),
          fb_page_id: p.id,
          name: p.name,
          access_token: encrypt(token),
          enabled: true,
        };
      }),
      google_maps_places: v1.sources.google_maps_places.map((m) => ({
        id: randomUUID(),
        place_id: m.id,
        name: m.name,
        enabled: true,
      })),
    };

    await saveProject(project);
    console.log(`  ✅ Migrated: ${v1.id}`);
  }

  console.log('\nMigration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
