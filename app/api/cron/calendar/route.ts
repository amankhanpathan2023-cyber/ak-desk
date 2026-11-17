import { NextRequest, NextResponse } from 'next/server';
import { kvSet } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Google Apps Script inside Aman's own calendar account posts his upcoming events here every 30 minutes.
// This works even when the organisation blocks iCal sharing links.
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-cron-key') || req.nextUrl.searchParams.get('key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET.trim()) {
    return NextResponse.json({ ok: false, error: 'wrong key' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const name = String(body?.calendar || 'Calendar').slice(0, 40);
  const events = Array.isArray(body?.events) ? body.events : [];
  const clean = events.slice(0, 500).map((e: any) => ({
    title: String(e.title || '(no title)').slice(0, 200),
    start: new Date(e.start).toISOString(),
    end: new Date(e.end || e.start).toISOString(),
    allDay: !!e.allDay,
    location: e.location ? String(e.location).slice(0, 120) : '',
  })).filter((e: any) => !isNaN(+new Date(e.start)));
  await kvSet(`cal_push:${name}`, JSON.stringify({ at: new Date().toISOString(), events: clean }));
  return NextResponse.json({ ok: true, calendar: name, saved: clean.length });
}
