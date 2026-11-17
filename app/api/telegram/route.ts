import { NextRequest, NextResponse } from 'next/server';
import { send, tg, keyboard, actionRow, downloadFile, esc } from '@/lib/telegram';
import { transcribe } from '@/lib/ai';
import { BUCKETS, BUCKET_KEYS, bucketByCode, bucketLabel } from '@/lib/buckets';
import {
  handleDump, line, markDone, moveTomorrow, snooze, setBucket, removeItem,
  morningBrief, weeklyReview, openItems, expensesBetween,
} from '@/lib/items';
import { istDateStr, istAt, addDays, fmtWhen, fmtDay, rupees } from '@/lib/time';
import { eventsBetween, calendarStatus } from '@/lib/calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HELP = `<b>Dex</b> files anything you send.

Just type or send a voice note:
· <i>CT block report due Friday</i>
· <i>paid 450 auto Satara</i>
· <i>waiting on Shankar for attendance sheet</i>
· <i>every Monday 10am team call</i>
· <i>goal: finish Char Yaar fractions by March</i>
· <i>kal kya due hai?</i>

Commands
/today  your day
/open  everything open
/waiting  people you're waiting on
/money  spending this month
/review  the weekly review now
/cal  your calendar for the next 7 days
/app  open the app`;

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = await req.json();
  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (e: any) {
    const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (chatId && isOwner(chatId)) await send(`Something went wrong: ${esc(String(e?.message || e)).slice(0, 300)}`, {}, chatId);
  }
  return NextResponse.json({ ok: true });
}

function isOwner(chatId: number | string) {
  return String(chatId) === String(process.env.TELEGRAM_CHAT_ID);
}

async function onMessage(msg: any) {
  const chatId = msg.chat.id;
  if (!process.env.TELEGRAM_CHAT_ID) {
    await send(`Hi! Your chat ID is <code>${chatId}</code>. Add it in Vercel as TELEGRAM_CHAT_ID, then redeploy.`, {}, chatId);
    return;
  }
  if (!isOwner(chatId)) return; // Dex only answers Aman.

  let text: string = msg.text || msg.caption || '';
  const voice = msg.voice || msg.audio;
  if (voice) {
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
    const { buf, name } = await downloadFile(voice.file_id);
    text = await transcribe(buf, name);
    if (!text) { await send('I could not hear anything in that voice note. Try again?'); return; }
  }
  if (!text) return;

  const cmd = text.trim().split(/\s|@/)[0].toLowerCase();
  if (cmd.startsWith('/')) return onCommand(cmd);

  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const res = await handleDump(text, voice ? 'voice' : 'telegram');
  const heard = voice ? `<i>Heard: "${esc(text)}"</i>\n\n` : '';

  if (res.kind === 'answer') {
    await send(heard + esc(res.answer));
    return;
  }
  // Dex's own words first, then a quiet line per item so you can see exactly what was stored.
  const details = res.saved
    .filter((it) => it.status === 'open')
    .map((it) => `· ${esc(line(it, true))}`)
    .join('\n');
  const body = `${heard}${esc(res.answer)}${details ? `\n\n<i>${details}</i>` : ''}`;
  if (res.kind === 'updated') { await send(body); return; }
  const many = res.saved.length > 1;
  const rows = res.saved.map((it, n) => [
    { text: many ? `Bucket ${n + 1}` : 'Change bucket', callback_data: `f:${it.id}` },
    { text: many ? `Undo ${n + 1}` : 'Undo', callback_data: `x:${it.id}` },
  ]);
  await send(body, keyboard(rows));
}

async function onCommand(cmd: string) {
  if (cmd === '/start' || cmd === '/help') return send(HELP);
  if (cmd === '/today') {
    const b = await morningBrief();
    await send(b.text);
    for (const t of b.top) await send(esc(line(t)), keyboard([actionRow(t.id)]));
    return;
  }
  if (cmd === '/review') return send(await weeklyReview());
  if (cmd === '/cal') {
    const today = istDateStr();
    const evs = await eventsBetween(istAt(today, 0), istAt(addDays(today, 8), 0));
    const missing = calendarStatus().filter((c) => !c.ok).map((c) => c.name);
    const list = evs.slice(0, 20).map((e) => `· ${esc(e.allDay ? fmtDay(e.start) + ', all day' : fmtWhen(e.start))}  ${esc(e.title)}`).join('\n');
    const head = missing.length ? `I can't see your ${esc(missing.join(' and '))} calendar yet.\n\n` : '';
    return send(`${head}${list ? `<b>Next 7 days</b>\n${list}` : missing.length ? '' : 'Nothing on your calendar for the next 7 days.'}`.trim());
  }
  if (cmd === '/app') return send(process.env.APP_URL ? `Open the app: ${process.env.APP_URL}` : 'APP_URL is not set yet.');
  if (cmd === '/open' || cmd === '/waiting') {
    const open = (await openItems()).filter((i) => (cmd === '/waiting' ? i.kind === 'waiting' : i.kind !== 'note'));
    if (!open.length) return send(cmd === '/waiting' ? 'You are not waiting on anyone.' : 'Nothing open. Clear desk.');
    const groups: Record<string, string[]> = {};
    for (const i of open) (groups[i.bucket] ||= []).push('· ' + esc(line(i)));
    const out = BUCKET_KEYS.filter((k) => groups[k]).map((k) => `<b>${BUCKETS[k].label}</b>\n${groups[k].slice(0, 12).join('\n')}`);
    return send(out.join('\n\n').slice(0, 4000));
  }
  if (cmd === '/money') {
    const today = istDateStr();
    const spent = await expensesBetween(istAt(today.slice(0, 8) + '01', 0), new Date(Date.now() + 86400000));
    if (!spent.length) return send('No spending logged this month.');
    const byTag: Record<string, number> = {};
    let total = 0;
    for (const e of spent) { const v = Number(e.amount || 0); total += v; byTag[e.tag || 'other'] = (byTag[e.tag || 'other'] || 0) + v; }
    const lines = Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${t}: ${rupees(v)}`);
    return send(`<b>This month: ${rupees(total)}</b>\n${lines.join('\n')}\n\nLast 5:\n${spent.slice(0, 5).map((e) => '· ' + esc(e.title) + ' ' + rupees(Number(e.amount || 0))).join('\n')}`);
  }
  return send(HELP);
}

async function onButton(q: any) {
  const chatId = q.message?.chat?.id;
  if (!isOwner(chatId)) return tg('answerCallbackQuery', { callback_query_id: q.id });
  const [action, id, extra] = String(q.data || '').split(':');
  const msgId = q.message.message_id;
  let toast = '';

  if (action === 'd') {
    const it = await markDone(id);
    toast = 'Done';
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', text: `<s>${esc(it?.title || '')}</s>  ✓${it?.recurrence ? '  (next one scheduled)' : ''}` });
  } else if (action === 't') {
    const it = await moveTomorrow(id);
    toast = 'Moved to tomorrow';
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', text: `${esc(it ? line(it) : '')}\n<i>moved to tomorrow</i>` });
  } else if (action === 's') {
    await snooze(id, 2);
    toast = 'I will remind you in 2 hours';
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
  } else if (action === 'x') {
    await removeItem(id);
    toast = 'Removed';
  } else if (action === 'f') {
    const rows: any[][] = [];
    const keys = BUCKET_KEYS.filter((k) => k !== 'money');
    for (let i = 0; i < keys.length; i += 3) {
      rows.push(keys.slice(i, i + 3).map((k) => ({ text: BUCKETS[k].label, callback_data: `b:${id}:${BUCKETS[k].code}` })));
    }
    await send('Which bucket?', keyboard(rows));
  } else if (action === 'b') {
    const bucket = bucketByCode(extra);
    await setBucket(id, bucket);
    toast = `Moved to ${bucketLabel(bucket)}`;
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `Moved to ${bucketLabel(bucket)}` });
  }
  await tg('answerCallbackQuery', { callback_query_id: q.id, text: toast });
}
