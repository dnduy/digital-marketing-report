import axios from 'axios';
import { env } from '@/lib/env';
import { getYesterdayUnixStart } from '@/lib/utils/date';
import type { ProjectConfig, FacebookPage } from '@/lib/config/projects.config';

const GRAPH_API = 'https://graph.facebook.com/v20.0';

export interface MetaPost {
  id: string;
  message?: string;
  created_time: string;
}

export interface MetaComment {
  id: string;
  from?: { name: string; id: string };
  message: string;
  created_time: string;
  post_id: string;
}

export interface MetaPageResult {
  page_id: string;
  page_name: string;
  posts: MetaPost[];
  new_comments: MetaComment[];
  error?: string;
}

async function fetchPagePosts(
  pageId: string,
  token: string,
  sinceUnix: number
): Promise<MetaPost[]> {
  const url = `${GRAPH_API}/${pageId}/posts`;
  const response = await axios.get<{ data: MetaPost[] }>(url, {
    params: {
      fields: 'id,message,created_time',
      since: sinceUnix,
      access_token: token,
    },
  });
  return response.data.data ?? [];
}

async function fetchPostComments(
  postId: string,
  token: string
): Promise<MetaComment[]> {
  const url = `${GRAPH_API}/${postId}/comments`;
  const response = await axios.get<{
    data: Array<{
      id: string;
      from?: { name: string; id: string };
      message: string;
      created_time: string;
    }>;
  }>(url, {
    params: {
      fields: 'id,from,message,created_time',
      access_token: token,
    },
  });
  return (response.data.data ?? []).map((c) => ({ ...c, post_id: postId }));
}

async function fetchSinglePage(
  page: FacebookPage,
  knownCommentIds: string[]
): Promise<MetaPageResult> {
  const token = env.getRequired(page.token_env_key);
  const sinceUnix = getYesterdayUnixStart();

  const posts = await fetchPagePosts(page.id, token, sinceUnix);

  // Fetch comments for each new post; cap at 5 posts to avoid rate limits
  const recentPosts = posts.slice(0, 5);
  const commentSettled = await Promise.allSettled(
    recentPosts.map((p) => fetchPostComments(p.id, token))
  );

  const allComments: MetaComment[] = [];
  commentSettled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      allComments.push(...s.value);
    } else {
      console.error(`[meta] comment fetch failed for post ${recentPosts[i].id}`, s.reason);
    }
  });

  const newComments = allComments.filter((c) => !knownCommentIds.includes(c.id));

  return {
    page_id: page.id,
    page_name: page.name,
    posts,
    new_comments: newComments,
  };
}

export async function fetchMetaForProject(
  project: ProjectConfig,
  knownCommentIdsByPage: Record<string, string[]>
): Promise<MetaPageResult[]> {
  const pages = project.sources.facebook_pages;

  const settled = await Promise.allSettled(
    pages.map((page) =>
      fetchSinglePage(page, knownCommentIdsByPage[page.id] ?? [])
    )
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[meta] failed for page ${pages[i].id}`, s.reason);
    return {
      page_id: pages[i].id,
      page_name: pages[i].name,
      posts: [],
      new_comments: [],
      error: String(s.reason),
    };
  });
}
