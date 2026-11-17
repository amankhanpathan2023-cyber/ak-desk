import { NextRequest, NextResponse } from 'next/server';
import { tg } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// Open once in the browser after deploying:
//   https://YOUR-APP.vercel.app/api/setup?key=YOUR_CRON_SECRET
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.nextUrl.searchParams.get('key') !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'wrong key' }, { status: 401 });
  }
  const base = process.env.APP_URL || `https://${req.headers.get('host')}`;
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
  return NextResponse.json({ webhook: hook, commands: cmds.ok, description: desc.ok });
}
