import { NextRequest, NextResponse } from 'next/server';
import { tg } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// Open once in the browser after deploying:
//   https://YOUR-APP.vercel.app/api/setup?key=YOUR_CRON_SECRET
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.nextUrl.searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'wrong key' }, { status: 401 });
  }
  const raw = process.env.TELEGRAM_BOT_TOKEN;
  const t = (raw || '').trim();
  const tokenCheck = {
    present: !!raw,
    hasSpacesAround: !!raw && raw !== t,
    looksRight: /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(t),
    length: t.length,
  };
  if (!tokenCheck.looksRight) {
    return NextResponse.json({ ok: false, problem: 'TELEGRAM_BOT_TOKEN is missing or not in the right shape', tokenCheck });
  }
  const me = await tg('getMe', {});
  if (!me.ok) {
    return NextResponse.json({ ok: false, problem: 'Telegram does not recognise this token. Copy it again from BotFather.', tokenCheck });
  }
  const base = `https://${req.headers.get('host')}`;
  const hook = await tg('setWebhook', {
    url: `${base}/api/telegram`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  const cmds = await tg('setMyCommands', {
    commands: [
      { command: 'today', description: 'Your day: calendar and top 3' },
      { command: 'open', description: 'Everything open, by bucket' },
      { command: 'waiting', description: 'People you are waiting on' },
      { command: 'money', description: 'Spending this month' },
      { command: 'review', description: 'Weekly review now' },
      { command: 'app', description: 'Open the app' },
      { command: 'help', description: 'How to use Dex' },
    ],
  });
  const desc = await tg('setMyDescription', {
    description: 'Dex files anything you send: tasks, expenses, meetings, ideas. Type or send a voice note.',
  });
  return NextResponse.json({ bot: me.result?.username, webhook: hook, webhookUrl: `${base}/api/telegram`, commands: cmds.ok, description: desc.ok });
}
