import { google } from 'googleapis';
import { env } from '@/lib/env';
import type { DailyLogRow, AlertRow } from '@/lib/types';

const DAILY_LOG_SHEET = 'DailyLog';
const ALERTS_SHEET = 'Alerts';

const DAILY_LOG_HEADERS = [
  'Date', 'ProjectID', 'Website', 'Sessions', 'Conversions',
  'Clicks', 'Impressions', 'CTR', 'NewWPPosts', 'NewFBPosts',
  'NewFBComments', 'NewGMBReviews', 'AvgRating',
];

const ALERTS_HEADERS = [
  'Timestamp', 'ProjectID', 'Type', 'Source', 'Message',
];

function getAuthClient() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_CLIENT_EMAIL,
      private_key: env.GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function ensureSheetExists(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === sheetName
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  }
}

export async function appendDailyLog(
  spreadsheetId: string,
  rows: DailyLogRow[]
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExists(sheets, spreadsheetId, DAILY_LOG_SHEET, DAILY_LOG_HEADERS);

    const values = rows.map((r) => [
      r.date, r.project_id, r.website, r.sessions, r.conversions,
      r.clicks, r.impressions, r.ctr, r.new_wp_posts, r.new_fb_posts,
      r.new_fb_comments, r.new_gmb_reviews, r.avg_rating,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${DAILY_LOG_SHEET}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  } catch (err) {
    console.error('[sheets] appendDailyLog failed', spreadsheetId, err);
  }
}

export async function appendAlert(
  spreadsheetId: string,
  row: AlertRow
): Promise<void> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await ensureSheetExists(sheets, spreadsheetId, ALERTS_SHEET, ALERTS_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${ALERTS_SHEET}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[row.timestamp, row.project_id, row.type, row.source, row.message]],
      },
    });
  } catch (err) {
    console.error('[sheets] appendAlert failed', spreadsheetId, err);
  }
}

export async function readAllDailyLog(
  spreadsheetId: string
): Promise<string[][]> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${DAILY_LOG_SHEET}!A:M`,
    });

    return (response.data.values as string[][] | null | undefined) ?? [];
  } catch (err) {
    console.error('[sheets] readAllDailyLog failed', spreadsheetId, err);
    return [];
  }
}
