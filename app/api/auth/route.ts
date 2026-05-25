import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { signAuthToken, timingSafeEqual } from '@/lib/utils/auth';
import { checkAuthRateLimit } from '@/lib/utils/rate-limit';

export async function POST(req: Request): Promise<Response> {
  // Rate limit by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const { allowed, remaining } = await checkAuthRateLimit(ip);
  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '900' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).password !== 'string'
  ) {
    return new Response('Bad request', { status: 400 });
  }

  const { password } = body as { password: string };
  const isValid = timingSafeEqual(password, env.ADMIN_PASSWORD);

  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = await signAuthToken({ sub: 'admin' });
  const isProd = process.env.NODE_ENV === 'production';

  const response = NextResponse.json({ ok: true, remaining });
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}

export async function DELETE(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('auth_token');
  return response;
}
