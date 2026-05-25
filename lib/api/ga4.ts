import { google } from 'googleapis';
import { env } from '@/lib/env';
import { getYesterdayDateICT } from '@/lib/utils/date';
import type { StoredWebsite } from '@/lib/types/project';

export interface Ga4Result {
  property_id: string;
  domain: string;
  sessions: number;
  conversions: number;
  error?: string;
}

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_CLIENT_EMAIL,
      private_key: env.GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
}

async function fetchSingleGa4(
  propertyId: string,
  domain: string
): Promise<Ga4Result> {
  const auth = getAuthClient();
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const yesterday = getYesterdayDateICT();

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: yesterday, endDate: yesterday }],
      metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    },
  });

  const row = response.data.rows?.[0];
  const sessions = parseInt(row?.metricValues?.[0]?.value ?? '0', 10);
  const conversions = parseInt(row?.metricValues?.[1]?.value ?? '0', 10);

  return { property_id: propertyId, domain, sessions, conversions };
}

export async function fetchGa4ForProject(
  websites: StoredWebsite[]
): Promise<Ga4Result[]> {
  const targets = websites.filter((w) => w.enabled && w.ga4_property_id);

  const settled = await Promise.allSettled(
    targets.map((w) => fetchSingleGa4(w.ga4_property_id!, w.domain))
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[ga4] failed for ${targets[i].domain}`, s.reason);
    return {
      property_id: targets[i].ga4_property_id!,
      domain: targets[i].domain,
      sessions: 0,
      conversions: 0,
      error: String(s.reason),
    };
  });
}
