import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pw = String(form.get('password') || '');
  if (!process.env.APP_PASSWORD || pw !== process.env.APP_PASSWORD) {
    return NextResponse.redirect(new URL('/login?e=1', req.url), 303);
  }
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
