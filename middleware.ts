import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

const OPEN = ['/login', '/api/login', '/api/telegram', '/api/cron', '/api/setup', '/manifest.json', '/icon.svg'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (OPEN.some((p) => path.startsWith(p))) return NextResponse.next();
  if (!process.env.APP_PASSWORD) return new NextResponse('Set APP_PASSWORD in Vercel first.', { status: 503 });
  const ok = req.cookies.get(COOKIE)?.value === (await sessionToken());
  if (ok) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.json({ error: 'login required' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
