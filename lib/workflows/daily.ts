import { fetchGa4ForProject } from '@/lib/api/ga4';
import { fetchGscForProject } from '@/lib/api/gsc';
import { fetchMetaForProject } from '@/lib/api/meta';
import { fetchPlacesForProject } from '@/lib/api/places';
import { fetchWordpressForProject } from '@/lib/api/wordpress';
import { getProjectState, setProjectState, buildDefaultState } from '@/lib/db/kv';
import { appendDailyLog, appendAlert } from '@/lib/db/sheets';
import { generateGeminiSummary } from '@/lib/ai/gemini';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { calcDeltaPercent, getTodayDateICT } from '@/lib/utils/date';
import { env } from '@/lib/env';
import type { ProjectConfig } from '@/lib/config/projects.config';
import type { ProjectState, DailyLogRow, DailySummaryInput } from '@/lib/types';

export interface DailyRunResult {
  websites_processed: number;
  errors: string[];
}

export async function runDailyForProject(
  project: ProjectConfig
): Promise<DailyRunResult> {
  const chatId = env.getRequired(project.telegram_chat_id_env_key);
  const today = getTodayDateICT();
  const errors: string[] = [];

  // Step 1: Load previous state
  const prevState = (await getProjectState(project.id)) ?? buildDefaultState(project.id);

  // Step 2: Fetch all sources in parallel (independent APIs)
  const [ga4Results, gscResults, metaResults, placesResults, wpResults] =
    await Promise.all([
      fetchGa4ForProject(project).catch((err) => {
        console.error(`[daily:${project.id}] ga4 fatal`, err);
        errors.push(`ga4: ${String(err)}`);
        return [];
      }),
      fetchGscForProject(project).catch((err) => {
        console.error(`[daily:${project.id}] gsc fatal`, err);
        errors.push(`gsc: ${String(err)}`);
        return [];
      }),
      fetchMetaForProject(
        project,
        Object.fromEntries(
          Object.entries(prevState.facebook_pages).map(([k, v]) => [k, v.last_comment_ids])
        )
      ).catch((err) => {
        console.error(`[daily:${project.id}] meta fatal`, err);
        errors.push(`meta: ${String(err)}`);
        return [];
      }),
      fetchPlacesForProject(
        project,
        Object.fromEntries(
          Object.entries(prevState.google_maps_places).map(([k, v]) => [k, v.last_review_ids])
        )
      ).catch((err) => {
        console.error(`[daily:${project.id}] places fatal`, err);
        errors.push(`places: ${String(err)}`);
        return [];
      }),
      fetchWordpressForProject(
        project,
        Object.fromEntries(
          Object.entries(prevState.websites).map(([k, v]) => [k, v.last_wp_post_id ?? 0])
        )
      ).catch((err) => {
        console.error(`[daily:${project.id}] wp fatal`, err);
        errors.push(`wp: ${String(err)}`);
        return [];
      }),
    ]);

  // Collect per-source errors into errors array
  [...ga4Results, ...gscResults, ...metaResults, ...placesResults, ...wpResults].forEach(
    (r) => {
      if ('error' in r && r.error) errors.push(`${r.error}`);
    }
  );

  // Step 3: Build summary input and diff
  const summaryInput: DailySummaryInput = {
    project_name: project.name,
    date: today,
    websites: project.sources.websites.map((site) => {
      const ga4 = ga4Results.find((r) => r.domain === site.domain);
      const gsc = gscResults.find((r) => r.domain === site.domain);
      const wp = wpResults.find((r) => r.domain === site.domain);
      const prevSite = prevState.websites[site.domain];

      const sessions = ga4?.sessions ?? 0;
      const sessionsDelta = calcDeltaPercent(sessions, prevSite?.sessions_yesterday ?? 0);

      return {
        domain: site.domain,
        sessions,
        sessions_delta_percent: sessionsDelta,
        conversions: ga4?.conversions ?? 0,
        clicks: gsc?.clicks ?? 0,
        impressions: gsc?.impressions ?? 0,
        new_wp_posts: (wp?.new_posts ?? []).map((p) => ({
          title: p.title.rendered,
          link: p.link,
        })),
      };
    }),
    facebook: metaResults.map((r) => ({
      page_name: r.page_name,
      new_posts_count: r.posts.length,
      new_comments: r.new_comments.map((c) => ({
        author: c.from?.name ?? 'Anonymous',
        message: c.message,
        post_id: c.post_id,
      })),
    })),
    google_maps: placesResults.map((r) => ({
      place_name: r.place_name,
      rating: r.rating,
      total_reviews: r.total_reviews,
      new_reviews: r.new_reviews.map((rv) => ({
        author: rv.author,
        rating: rv.rating,
        text: rv.text,
      })),
    })),
    errors: errors.map((e) => ({ source: 'cron', message: e })),
  };

  // Step 4: Generate AI summary
  const summary = await generateGeminiSummary(summaryInput);

  // Step 5: Send Telegram
  try {
    await sendTelegramMessage(chatId, summary);
  } catch (err) {
    console.error(`[daily:${project.id}] telegram failed`, err);
    errors.push(`telegram: ${String(err)}`);
  }

  // Step 6: Append to Google Sheets
  const dailyRows: DailyLogRow[] = project.sources.websites.map((site) => {
    const ga4 = ga4Results.find((r) => r.domain === site.domain);
    const gsc = gscResults.find((r) => r.domain === site.domain);
    const wp = wpResults.find((r) => r.domain === site.domain);
    const meta = metaResults;
    const places = placesResults;

    return {
      date: today,
      project_id: project.id,
      website: site.domain,
      sessions: ga4?.sessions ?? 0,
      conversions: ga4?.conversions ?? 0,
      clicks: gsc?.clicks ?? 0,
      impressions: gsc?.impressions ?? 0,
      ctr: gsc?.ctr ?? 0,
      new_wp_posts: wp?.new_posts.length ?? 0,
      new_fb_posts: meta.reduce((sum, m) => sum + m.posts.length, 0),
      new_fb_comments: meta.reduce((sum, m) => sum + m.new_comments.length, 0),
      new_gmb_reviews: places.reduce((sum, p) => sum + p.new_reviews.length, 0),
      avg_rating:
        places.length > 0
          ? Math.round((places.reduce((sum, p) => sum + p.rating, 0) / places.length) * 10) / 10
          : 0,
    };
  });

  await appendDailyLog(project.google_sheet_id, dailyRows);

  // Log errors to Alerts sheet
  for (const err of errors) {
    await appendAlert(project.google_sheet_id, {
      timestamp: new Date().toISOString(),
      project_id: project.id,
      type: 'error',
      source: 'cron/daily',
      message: err,
    });
  }

  // Step 7: Update KV state
  const newState: ProjectState = {
    project_id: project.id,
    last_run_at: new Date().toISOString(),
    websites: Object.fromEntries(
      project.sources.websites.map((site) => {
        const ga4 = ga4Results.find((r) => r.domain === site.domain);
        const gsc = gscResults.find((r) => r.domain === site.domain);
        const wp = wpResults.find((r) => r.domain === site.domain);
        const maxPostId = wp?.posts.reduce((max, p) => Math.max(max, p.id), 0) ?? 0;
        return [
          site.domain,
          {
            sessions_yesterday: ga4?.sessions ?? 0,
            clicks_yesterday: gsc?.clicks ?? 0,
            impressions_yesterday: gsc?.impressions ?? 0,
            last_wp_post_id: maxPostId || undefined,
          },
        ];
      })
    ),
    facebook_pages: Object.fromEntries(
      metaResults.map((r) => {
        const allCommentIds = r.new_comments.map((c) => c.id);
        const prev = prevState.facebook_pages[r.page_id]?.last_comment_ids ?? [];
        const combined = Array.from(new Set(prev.concat(allCommentIds))).slice(-50);
        return [
          r.page_id,
          {
            last_post_id: r.posts[0]?.id,
            last_comment_ids: combined,
          },
        ];
      })
    ),
    google_maps_places: Object.fromEntries(
      placesResults.map((r) => {
        const newIds = r.new_reviews.map((rv) => rv.reviewId);
        const prev = prevState.google_maps_places[r.place_id]?.last_review_ids ?? [];
        const combined = Array.from(new Set(prev.concat(newIds))).slice(-50);
        return [
          r.place_id,
          {
            last_review_ids: combined,
            rating: r.rating,
            total_reviews: r.total_reviews,
          },
        ];
      })
    ),
  };

  await setProjectState(project.id, newState);

  console.info(`[daily:${project.id}] completed. errors: ${errors.length}`);
  return { websites_processed: project.sources.websites.length, errors };
}
