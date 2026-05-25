import { kv } from '@vercel/kv';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `ratelimit:auth:${ip}`;

  // Atomic increment
  const count = await kv.incr(key);

  // Set TTL only on first request in window
  if (count === 1) {
    await kv.expire(key, WINDOW_SECONDS);
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - count);
  return { allowed: count <= MAX_ATTEMPTS, remaining };
}
