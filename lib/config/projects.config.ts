// V1 legacy interfaces — kept for reference only.
// In V2, projects are stored in Vercel KV via lib/db/projects.ts.
// Use the migration script: pnpm tsx scripts/migrate-v1-to-v2.ts

export interface FacebookPage {
  id: string;
  name: string;
  token_env_key: string;
}

export interface GoogleMapPlace {
  id: string;
  name: string;
}

export interface WebsiteData {
  domain: string;
  wp_api_url?: string;
  ga4_property_id?: string;
  gsc_url?: string;
}

export interface AdsAccount {
  google_ads_id?: string;
  meta_ads_id?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  telegram_chat_id_env_key: string;
  google_sheet_id: string;
  sources: {
    websites: WebsiteData[];
    facebook_pages: FacebookPage[];
    google_maps_places: GoogleMapPlace[];
    ads_accounts?: AdsAccount;
  };
}
