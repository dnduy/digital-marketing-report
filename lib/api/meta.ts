import axios from 'axios';
import { getYesterdayUnixStart } from '@/lib/utils/date';

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
  all_comments_seen: MetaComment[]; // ALL fetched comments (for state dedup §13.2)
  error?: string;
}

// Input shape from DecryptedProject
export interface MetaPageInput {
  fb_page_id: string;
  name: string;
  access_token: string; // plaintext, decrypted before call
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
    params: { fields: 'id,from,message,created_time', access_token: token },
  });
  return (response.data.data ?? []).map((c) => ({ ...c, post_id: postId }));
}

async function fetchSinglePage(
  page: MetaPageInput,
  knownCommentIds: string[]
): Promise<MetaPageResult> {
  const sinceUnix = getYesterdayUnixStart();
  const posts = await fetchPagePosts(page.fb_page_id, page.access_token, sinceUnix);

  // Fetch comments for up to 5 recent posts to avoid rate limits
  const recentPosts = posts.slice(0, 5);
  const commentSettled = await Promise.allSettled(
    recentPosts.map((p) => fetchPostComments(p.id, page.access_token))
  );

  const allComments: MetaComment[] = [];
  commentSettled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      allComments.push(...s.value);
    } else {
      console.error(
        `[meta] comment fetch failed for post ${recentPosts[i].id}`,
        s.reason
      );
    }
  });

  const newComments = allComments.filter((c) => !knownCommentIds.includes(c.id));

  return {
    page_id: page.fb_page_id,
    page_name: page.name,
    posts,
    new_comments: newComments,
    all_comments_seen: allComments, // full set for state update
  };
}

export async function fetchMetaForPages(
  pages: MetaPageInput[],
  knownCommentIdsByPage: Record<string, string[]>
): Promise<MetaPageResult[]> {
  const settled = await Promise.allSettled(
    pages.map((page) =>
      fetchSinglePage(page, knownCommentIdsByPage[page.fb_page_id] ?? [])
    )
  );

  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    console.error(`[meta] failed for page ${pages[i].fb_page_id}`, s.reason);
    return {
      page_id: pages[i].fb_page_id,
      page_name: pages[i].name,
      posts: [],
      new_comments: [],
      all_comments_seen: [],
      error: String(s.reason),
    };
  });
}


