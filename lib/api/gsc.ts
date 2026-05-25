import { google } from 'googleapis';
import { env } from '@/lib/env';
import { getTwoDaysAgoDateICT } from '@/lib/utils/date';
import type { ProjectConfig } from '@/lib/config/projects.config';

export interface GscResult {
  domain: string;
  gsc_url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  error?: string;
}

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_CLIENT_EMAIL,
      private_key: env.GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
}

async function fetchSingleGsc(
  gscUrl: string,
  domain: string
): Promise<GscResult> {
  const auth = getAuthClient();
  const webmasters = google.searchconsole({ version: 'v1', auth });
  const date = getTwoDaysAgoDateICT();

  const response = await webmasters.searchanalytics.query({
    siteUrl: gscUrl,
    requestBody: {
      startDate: date,
      endDate: date,
      dimensions: [],
    },
  });

  const row = response.data.rows?.[0];
  return {
    domain,
    gsc_url: gscUrl,
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: Math.round((row?.ctr ?? 0) * 10000) / 100, // percent, 2 decimals
    position: Math.round((row?.position ?? 0) * 10) / 10,
  };
}

export async function fetchGscForProject(
  project: ProjectConfig
): Promise<GscResult[]> {
  const targets = project.sources.websites.filter((w) => w.gsc_url);

  const settled = await Promise.allSettled(
    targets.map((w) => fetchSingleGsc(w.gsc_url!, w.domain))
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[gsc] failed for ${targets[i].domain}`, s.reason);
    return {
      domain: targets[i].domain,
      gsc_url: targets[i].gsc_url!,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      error: String(s.reason),
    };
  });
}
