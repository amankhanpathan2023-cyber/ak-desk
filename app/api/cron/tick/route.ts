import { NextRequest, NextResponse } from 'next/server';
import { db, kvGet, kvSet } from '@/lib/db';
import { send, keyboard, actionRow, esc } from '@/lib/telegram';
import { morningBrief, eveningWrap, weeklyReview, line, Item } from '@/lib/items';
import { istDateStr, istParts } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called every 10 minutes by Supabase (see supabase/2-scheduler.sql).
export async function GET(req: NextRequest) {
  const key = req.headers.get('x-cron-key') || req.nextUrl.searchParams.get('key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const p = istParts(now);
  const today = istDateStr(now);
  const quiet = p.h >= 22 || p.h < 7;
  const done: string[] = [];

  // 8:00 morning brief (sent once, any time 8:00 to 11:59 if a tick was missed)
  if (p.h >= 8 && p.h < 12 && !(await kvGet(`brief:${today}`))) {
    await kvSet(`brief:${today}`, '1');
    const b = await morningBrief();
    await send(b.text);
    for (const t of b.top) await send(esc(line(t)), keyboard([actionRow(t.id)]));
    done.push('brief');
  }

  // 20:00 evening wrap
  if (p.h >= 20 && p.h < 22 && !(await kvGet(`wrap:${today}`))) {
    await kvSet(`wrap:${today}`, '1');
    const w = await eveningWrap();
    await send(w.text);
    for (const t of w.left) await send(esc(line(t)), keyboard([actionRow(t.id)]));
    done.push('wrap');
  }

  // Sunday 19:00 weekly review
  if (p.dow === 0 && p.h >= 19 && p.h < 22 && !(await kvGet(`review:${today}`))) {
    await kvSet(`review:${today}`, '1');
    await send(await weeklyReview());
    done.push('review');
  }

  // Deadline nudges, held during quiet hours (10 pm to 7 am), max 5 per tick.
  if (!quiet) {
    const { data } = await db().from('items').select('*')
      .eq('status', 'open').is('reminded_at', null).lte('remind_at', now.toISOString())
      .order('remind_at', { ascending: true }).limit(5);
    for (const it of (data || []) as Item[]) {
      await db().from('items').update({ reminded_at: now.toISOString() }).eq('id', it.id);
      const prefix = it.kind === 'waiting' ? 'Follow up' : it.kind === 'milestone' ? 'Milestone coming up' : 'Reminder';
      await send(`<b>${prefix}</b>\n${esc(line(it))}`, keyboard([actionRow(it.id)]));
      done.push('nudge');
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), done });
}
