// ── Encrypted value wrapper (AES-256-GCM) ────────────────────────────────────
export interface EncryptedString {
  iv: string;   // base64
  tag: string;  // base64 auth tag
  data: string; // base64 ciphertext
}

// ── Source item types ─────────────────────────────────────────────────────────
export interface StoredWebsite {
  id: string;              // uuid — dùng để edit/delete trong UI
  domain: string;          // "example.com" (không có https://)
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
  enabled: boolean;
}

export interface StoredFacebookPage {
  id: string;                    // uuid (KHÔNG phải FB page ID)
  fb_page_id: string;            // Facebook Page ID thật
  name: string;
  access_token: EncryptedString; // encrypted plaintext token
  enabled: boolean;
}

export interface StoredGoogleMapPlace {
  id: string;      // uuid
  place_id: string; // Google Place ID
  name: string;
  enabled: boolean;
}

// ── Main stored project (persisted in KV as "project:{id}") ──────────────────
export interface StoredProject {
  id: string;         // slug, vd "chillax"
  name: string;
  created_at: string; // ISO timestamp
  updated_at: string;
  enabled: boolean;   // toggle bật/tắt toàn project

  // Encrypted secrets
  telegram_chat_id: EncryptedString;
  google_sheet_id: EncryptedString;

  // Sources
  websites: StoredWebsite[];
  facebook_pages: StoredFacebookPage[];
  google_maps_places: StoredGoogleMapPlace[];
}

// ── Decrypted runtime view (used by workflows, never sent to client) ──────────
export interface DecryptedProject extends Omit<StoredProject,
  'telegram_chat_id' | 'google_sheet_id' | 'facebook_pages'
> {
  telegram_chat_id: string;
  google_sheet_id: string;
  facebook_pages: Array<{
    id: string;
    fb_page_id: string;
    name: string;
    access_token: string; // plaintext, only in memory during cron
    enabled: boolean;
  }>;
}

// ── API response shapes (safe for client — no plaintext secrets) ──────────────
export interface ProjectSummary {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  counts: {
    websites: number;
    facebook_pages: number;
    google_maps_places: number;
  };
}

export interface ProjectDetail {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  telegram_chat_id_masked: string;
  google_sheet_id_masked: string;
  websites: StoredWebsite[];
  facebook_pages: Array<{
    id: string;
    fb_page_id: string;
    name: string;
    access_token_masked: string;
    enabled: boolean;
  }>;
  google_maps_places: StoredGoogleMapPlace[];
}

// ── Request body shapes ───────────────────────────────────────────────────────
export interface CreateProjectBody {
  id: string;
  name: string;
  telegram_chat_id: string;
  google_sheet_id: string;
}

export interface PatchProjectBody {
  name?: string;
  enabled?: boolean;
  telegram_chat_id?: string; // undefined/empty → keep existing
  google_sheet_id?: string;
}

export interface AddWebsiteBody {
  domain: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
}

export interface PatchWebsiteBody {
  domain?: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
  enabled?: boolean;
}

export interface AddFacebookPageBody {
  fb_page_id: string;
  name: string;
  access_token: string;
}

export interface PatchFacebookPageBody {
  fb_page_id?: string;
  name?: string;
  access_token?: string; // empty/absent → keep existing
  enabled?: boolean;
}

export interface AddMapPlaceBody {
  place_id: string;
  name: string;
}

export interface PatchMapPlaceBody {
  place_id?: string;
  name?: string;
  enabled?: boolean;
}
