import axios from 'axios';
import { getYesterdayISOStart } from '@/lib/utils/date';
import type { ProjectConfig, WebsiteData } from '@/lib/config/projects.config';

// TODO: If WordPress REST API requires auth, add token via Authorization header here.

export interface WpPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
}

export interface WpResult {
  domain: string;
  posts: WpPost[];
  new_posts: WpPost[];
  error?: string;
}

async function fetchSingleWp(
  site: WebsiteData,
  lastSeenPostId: number
): Promise<WpResult> {
  const afterISO = getYesterdayISOStart();
  const url = site.wp_api_url!;

  const response = await axios.get<WpPost[]>(url, {
    params: {
      after: afterISO,
      per_page: 20,
      _fields: 'id,title,link,date',
      orderby: 'date',
      order: 'desc',
    },
    timeout: 15000,
  });

  const posts = response.data ?? [];
  const newPosts = posts.filter((p) => p.id > lastSeenPostId);

  return {
    domain: site.domain,
    posts,
    new_posts: newPosts,
  };
}

export async function fetchWordpressForProject(
  project: ProjectConfig,
  lastSeenPostIdByDomain: Record<string, number>
): Promise<WpResult[]> {
  const targets = project.sources.websites.filter((w) => w.wp_api_url);

  const settled = await Promise.allSettled(
    targets.map((w) =>
      fetchSingleWp(w, lastSeenPostIdByDomain[w.domain] ?? 0)
    )
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[wp] failed for ${targets[i].domain}`, s.reason);
    return {
      domain: targets[i].domain,
      posts: [],
      new_posts: [],
      error: String(s.reason),
    };
  });
}
