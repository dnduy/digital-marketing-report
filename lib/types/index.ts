// Re-export config types
export type {
  ProjectConfig,
  WebsiteData,
  FacebookPage,
  GoogleMapPlace,
  AdsAccount,
} from '@/lib/config/projects.config';

// ── KV State ─────────────────────────────────────────────────────────────────

export interface WebsiteState {
  sessions_yesterday: number;
  clicks_yesterday: number;
  impressions_yesterday: number;
  last_wp_post_id?: number;
}

export interface FacebookPageState {
  last_post_id?: string;
  last_comment_ids: string[];
}

export interface GoogleMapState {
  last_review_ids: string[];
  rating: number;
  total_reviews: number;
}

export interface ProjectState {
  project_id: string;
  last_run_at: string;
  websites: Record<string, WebsiteState>;
  facebook_pages: Record<string, FacebookPageState>;
  google_maps_places: Record<string, GoogleMapState>;
}

// ── Google Sheets rows ────────────────────────────────────────────────────────

export interface DailyLogRow {
  date: string;
  project_id: string;
  website: string;
  sessions: number;
  conversions: number;
  clicks: number;
  impressions: number;
  ctr: number;
  new_wp_posts: number;
  new_fb_posts: number;
  new_fb_comments: number;
  new_gmb_reviews: number;
  avg_rating: number;
}

export interface AlertRow {
  timestamp: string;
  project_id: string;
  type: string;
  source: string;
  message: string;
}

// ── AI Summary input ──────────────────────────────────────────────────────────

export interface DailySummaryInput {
  project_name: string;
  date: string;
  websites: Array<{
    domain: string;
    sessions: number;
    sessions_delta_percent: number | null;
    conversions: number;
    clicks: number;
    impressions: number;
    new_wp_posts: Array<{ title: string; link: string }>;
  }>;
  facebook: Array<{
    page_name: string;
    new_posts_count: number;
    new_comments: Array<{ author: string; message: string; post_id: string }>;
  }>;
  google_maps: Array<{
    place_name: string;
    rating: number;
    total_reviews: number;
    new_reviews: Array<{ author: string; rating: number; text: string }>;
  }>;
  errors: Array<{ source: string; message: string }>;
}
