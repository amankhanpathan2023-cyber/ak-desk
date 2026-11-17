import { db, kvGet, kvSet } from './db';
import { parseMessage, answerQuestion, ParsedItem, ItemUpdate, Turn } from './ai';
import { bucketLabel, KIND_LABEL, BUCKET_KEYS } from './buckets';
const BUCKET_KEYS_SET = new Set<string>(BUCKET_KEYS);
import { istDateStr, istParts, istAt, istDayBounds, addDays, fmtWhen, fmtTime, rupees } from './time';
import { eventsForDay, eventsBetween, calendarStatus } from './calendar';

export type Item = {
  id: string; kind: string; title: string; bucket: string; tag: string | null;
  due_at: string | null; remind_at: string | null; reminded_at: string | null;
  amount: number | null; person: string | null; recurrence: string | null;
  status: string; done_at: string | null; created_at: string;
};

// ---------- reminder timing ----------

export function defaultRemind(it: ParsedItem): string | null {
  if (it.remind_at) return it.remind_at;
  if (it.kind === 'expense' || it.kind === 'note') return null;
  if (it.kind === 'waiting') {
    if (it.due_at) return it.due_at;
    return new Date(Date.now() + 3 * 86400000).toISOString();
  }
  if (!it.due_at) return null;
  const due = new Date(it.due_at);
  const p = istParts(due);
  if (it.kind === 'milestone') return istAt(addDays(istDateStr(due), -7), 9).toISOString();
  // date-only (18:00): nudge at 9am that day. Timed: one hour before.
  if (p.h === 18 && p.min === 0) return istAt(istDateStr(due), 9).toISOString();
  return new Date(due.getTime() - 3600000).toISOString();
}

// ---------- writes ----------

export async function saveParsed(items: ParsedItem[], raw: string, source: string) {
  if (!items.length) return [] as Item[];
  const rows = items.map((it) => ({
    kind: it.kind,
    title: it.title,
    bucket: it.kind === 'expense' ? 'money' : it.kind === 'milestone' ? 'milestones' : it.bucket,
    tag: it.tag || null,
    due_at: it.kind === 'expense' ? null : it.due_at || null,
    remind_at: defaultRemind(it),
    amount: it.amount ?? null,
    person: it.person || null,
    recurrence: it.recurrence || null,
    raw,
    source,
  }));
  const { data, error } = await db().from('items').insert(rows).select('*');
  if (error) throw new Error(error.message);
  return data as Item[];
}

function shiftDate(iso: string, rec: string) {
  const d = new Date(iso);
  if (rec === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (rec === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

export async function markDone(id: string) {
  const { data: it } = await db().from('items').select('*').eq('id', id).maybeSingle();
  if (!it) return null;
  await db().from('items').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id);
  if (it.recurrence && it.due_at) {
    const next = shiftDate(it.due_at, it.recurrence);
    await db().from('items').insert({
      kind: it.kind, title: it.title, bucket: it.bucket, tag: it.tag, person: it.person,
      recurrence: it.recurrence, due_at: next,
      remind_at: it.remind_at ? shiftDate(it.remind_at, it.recurrence) : null,
      source: 'repeat',
    });
  }
  return it as Item;
}

export async function moveTomorrow(id: string) {
  const { data: it } = await db().from('items').select('*').eq('id', id).maybeSingle();
  if (!it) return null;
  const base = it.due_at ? new Date(it.due_at) : istAt(istDateStr(), 18);
  const due = new Date(base.getTime() + 86400000);
  const keepTime = it.due_at && !(istParts(base).h === 18 && istParts(base).min === 0);
  const remind = keepTime ? new Date(due.getTime() - 3600000) : istAt(istDateStr(due), 9);
  const due2 = it.due_at ? due : istAt(addDays(istDateStr(), 1), 18);
  await db().from('items').update({ due_at: due2.toISOString(), remind_at: remind.toISOString(), reminded_at: null }).eq('id', id);
  return { ...it, due_at: due2.toISOString() } as Item;
}

export async function snooze(id: string, hours = 2) {
  await db().from('items')
    .update({ remind_at: new Date(Date.now() + hours * 3600000).toISOString(), reminded_at: null })
    .eq('id', id);
}

export async function setBucket(id: string, bucket: string) {
  await db().from('items').update({ bucket }).eq('id', id);
}

export async function removeItem(id: string) {
  await db().from('items').update({ status: 'dropped' }).eq('id', id);
}

// ---------- reads ----------

export async function openItems(limit = 300) {
  const { data } = await db().from('items').select('*').eq('status', 'open')
    .neq('kind', 'expense').order('due_at', { ascending: true, nullsFirst: false }).limit(limit);
  return (data || []) as Item[];
}

export async function expensesBetween(from: Date, to: Date) {
  const { data } = await db().from('items').select('*').eq('kind', 'expense').neq('status', 'dropped')
    .gte('created_at', from.toISOString()).lt('created_at', to.toISOString())
    .order('created_at', { ascending: false });
  return (data || []) as Item[];
}

export async function doneBetween(from: Date, to: Date) {
  const { data } = await db().from('items').select('*').eq('status', 'done')
    .gte('done_at', from.toISOString()).lt('done_at', to.toISOString());
  return (data || []) as Item[];
}

// ---------- text formatting ----------

export function line(it: Item, withReminder = false) {
  const bits = [bucketLabel(it.bucket)];
  if (it.kind !== 'task') bits.push(KIND_LABEL[it.kind] || it.kind);
  if (it.amount) bits.push(rupees(it.amount));
  if (it.person && it.kind === 'waiting') bits.push(it.person);
  if (it.due_at) bits.push(fmtWhen(it.due_at));
  if (withReminder && it.remind_at && !it.reminded_at) bits.push('reminder ' + fmtWhen(it.remind_at).replace(/^(today|tomorrow|yesterday)$/, '$1, ' + fmtTime(it.remind_at)));
  if (it.recurrence) bits.push('repeats ' + it.recurrence);
  return `${it.title}  ·  ${bits.join(' · ')}`;
}

// ---------- short conversation memory, so "that day" / "usko" make sense ----------

async function getHistory(): Promise<Turn[]> {
  try { return JSON.parse((await kvGet('chat_history')) || '[]'); } catch { return []; }
}

async function pushHistory(user: string, dex: string) {
  const h = await getHistory();
  h.push({ r: 'u', t: user.slice(0, 400) }, { r: 'd', t: dex.slice(0, 400) });
  await kvSet('chat_history', JSON.stringify(h.slice(-12)));
}

function openListForAi(open: Item[]) {
  return open.slice(0, 60).map((i) => [
    i.id.slice(0, 6),
    `${KIND_LABEL[i.kind] || i.kind}: ${i.title}${i.person ? ' (' + i.person + ')' : ''}`,
    i.due_at ? new Date(i.due_at).toISOString() : '-',
    i.remind_at && !i.reminded_at ? new Date(i.remind_at).toISOString() : '-',
  ].join(' | ')).join('\n');
}

async function applyUpdates(updates: ItemUpdate[], open: Item[]) {
  const changed: Item[] = [];
  for (const u of updates) {
    const it = open.find((i) => i.id.startsWith(String(u.ref).trim()));
    if (!it) continue;
    if (u.action === 'done') { await markDone(it.id); changed.push({ ...it, status: 'done' }); continue; }
    if (u.action === 'drop') { await removeItem(it.id); changed.push({ ...it, status: 'dropped' }); continue; }
    const patch: Record<string, any> = {};
    if (u.title) patch.title = u.title;
    if (u.bucket && BUCKET_KEYS_SET.has(u.bucket)) patch.bucket = u.bucket;
    if (u.due_at) patch.due_at = u.due_at;
    if (u.remind_at) { patch.remind_at = u.remind_at; patch.reminded_at = null; }
    else if (u.due_at) {
      patch.remind_at = defaultRemind({ kind: it.kind as any, title: it.title, bucket: it.bucket, due_at: u.due_at });
      patch.reminded_at = null;
    }
    if (!Object.keys(patch).length) continue;
    const { data } = await db().from('items').update(patch).eq('id', it.id).select('*').maybeSingle();
    if (data) changed.push(data as Item);
  }
  return changed;
}

// ---------- the main entry: any dump from Telegram or the app ----------

export async function handleDump(text: string, source: string) {
  const [open, history] = await Promise.all([openItems(200), getHistory()]);
  const parsed = await parseMessage(text, openListForAi(open), history);

  let res: { kind: 'answer' | 'saved' | 'updated'; answer: string; saved: Item[] };
  if (parsed.intent === 'query') {
    const answer = await answerQuestion(parsed.question || text, await contextForQuestion(), history);
    res = { kind: 'answer', answer, saved: [] };
  } else if (parsed.intent === 'chat' || (parsed.intent === 'add' && !parsed.items.length && parsed.reply)) {
    res = { kind: 'answer', answer: parsed.reply || 'Hey. Tell me anything: a task, a plan, an expense.', saved: [] };
  } else if (parsed.intent === 'update') {
    const changed = await applyUpdates(parsed.updates, open);
    res = changed.length
      ? { kind: 'updated', answer: parsed.reply || 'Updated.', saved: changed }
      : { kind: 'answer', answer: "I couldn't find which item you mean. Can you say it a bit differently?", saved: [] };
  } else {
    const items = parsed.items.length ? parsed.items : [{ kind: 'note' as const, title: text.slice(0, 80), bucket: 'personal' }];
    const saved = await saveParsed(items, text, source);
    res = { kind: 'saved', answer: parsed.reply || 'Got it.', saved };
  }
  await pushHistory(text, res.answer).catch(() => {});
  return res;
}

async function contextForQuestion() {
  const today = istDateStr();
  const open = await openItems(200);
  const monthStart = istAt(today.slice(0, 8) + '01', 0);
  const spent = await expensesBetween(monthStart, new Date(Date.now() + 86400000));
  const cal = await eventsBetween(istAt(today, 0), istAt(addDays(today, 8), 0));
  const events = cal.map((e) => `${fmtWhen(e.start)}${e.allDay ? ' (all day)' : ''} ${e.title} [${e.cal}]`);
  const calNote = calendarStatus().map((c) => `${c.name}: ${c.note}`).join('; ');
  return [
    `Today is ${today}.`,
    'OPEN ITEMS:', ...open.map((i) => line(i, true)),
    `CALENDAR (next 7 days). Status: ${calNote}. If a calendar is not connected, say in a few words that you can't see that calendar yet, never claim he has no meetings.`,
    ...(events.length ? events : ['(no events in this window)']),
    'EXPENSES THIS MONTH:', ...spent.map((e) => `${istDateStr(new Date(e.created_at))} ${e.title} ${rupees(Number(e.amount || 0))} [${e.tag || 'other'}]`),
  ].join('\n');
}

// ---------- briefs ----------

function isDueBy(it: Item, end: Date) {
  return it.due_at && new Date(it.due_at) < end;
}

export async function morningBrief() {
  const today = istDateStr();
  const { end } = istDayBounds(today);
  const [events, open] = await Promise.all([eventsForDay(today), openItems()]);
  const actionable = open.filter((i) => i.kind === 'task' || i.kind === 'waiting');
  const due = actionable.filter((i) => isDueBy(i, end));
  const overdue = due.filter((i) => new Date(i.due_at!) < istAt(today, 0));
  const top = [...overdue, ...due.filter((i) => !overdue.includes(i))].slice(0, 3);
  const staleWaiting = open.filter((i) => i.kind === 'waiting' && Date.now() - +new Date(i.created_at) > 3 * 86400000);

  const out: string[] = [`<b>Good morning, Aman.</b> ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })}`];
  out.push('');
  if (events.length) {
    out.push(`<b>Calendar</b> (${events.length})`);
    for (const e of events.slice(0, 8)) out.push(`${e.allDay ? 'All day' : fmtTime(e.start)}  ${escapeHtml(e.title)}  <i>${e.cal}</i>`);
  } else out.push('<b>Calendar</b>: nothing scheduled.');
  out.push('');
  if (top.length) {
    out.push('<b>Top 3 today</b>');
    top.forEach((t, n) => out.push(`${n + 1}. ${escapeHtml(line(t))}`));
  } else out.push('<b>Top 3 today</b>: nothing due. Good day to move a milestone.');
  if (due.length > 3) out.push(`<i>+${due.length - 3} more due today</i>`);
  if (staleWaiting.length) out.push('', `<b>Chase up</b>: ${staleWaiting.map((w) => escapeHtml(w.person || w.title)).join(', ')}`);
  return { text: out.join('\n'), top };
}

export async function eveningWrap() {
  const today = istDateStr();
  const { start, end } = istDayBounds(today);
  const [done, open, spent] = await Promise.all([doneBetween(start, end), openItems(), expensesBetween(start, end)]);
  const left = open.filter((i) => (i.kind === 'task' || i.kind === 'waiting') && isDueBy(i, end));
  const spentTotal = spent.reduce((s, e) => s + Number(e.amount || 0), 0);
  const out = [`<b>Day wrap.</b> Done: ${done.length}. Still open: ${left.length}.`];
  if (spentTotal) out.push(`Spent today: ${rupees(spentTotal)}`);
  if (left.length) out.push('', 'Tap to close or move each one:');
  return { text: out.join('\n'), left: left.slice(0, 6) };
}

export async function weeklyReview() {
  const today = istDateStr();
  const weekStart = istAt(addDays(today, -6), 0);
  const now = new Date();
  const next7 = istAt(addDays(today, 8), 0);
  const monthStart = istAt(today.slice(0, 8) + '01', 0);
  const [done, open, weekSpent, monthSpent] = await Promise.all([
    doneBetween(weekStart, now), openItems(), expensesBetween(weekStart, now), expensesBetween(monthStart, now),
  ]);
  const overdue = open.filter((i) => (i.kind === 'task' || i.kind === 'waiting') && i.due_at && new Date(i.due_at) < istAt(today, 0));
  const coming = open.filter((i) => i.kind !== 'milestone' && i.due_at && new Date(i.due_at) >= istAt(today, 0) && new Date(i.due_at) < next7);
  const milestones = open.filter((i) => i.kind === 'milestone');
  const waiting = open.filter((i) => i.kind === 'waiting');
  const sum = (xs: Item[]) => xs.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byTag: Record<string, number> = {};
  for (const e of weekSpent) byTag[e.tag || 'other'] = (byTag[e.tag || 'other'] || 0) + Number(e.amount || 0);

  const out = ['<b>Sunday review</b>', ''];
  out.push(`Done this week: <b>${done.length}</b>`);
  if (overdue.length) { out.push('', `<b>Slipped</b> (${overdue.length})`); overdue.slice(0, 8).forEach((i) => out.push('· ' + escapeHtml(line(i)))); }
  if (coming.length) { out.push('', `<b>Next 7 days</b> (${coming.length})`); coming.slice(0, 10).forEach((i) => out.push('· ' + escapeHtml(line(i)))); }
  if (waiting.length) { out.push('', `<b>Waiting on</b>`); waiting.slice(0, 8).forEach((i) => out.push(`· ${escapeHtml(i.person || '')} ${escapeHtml(i.title)}`)); }
  out.push('', `<b>Money</b>: ${rupees(sum(weekSpent))} this week, ${rupees(sum(monthSpent))} this month`);
  const tags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (tags.length) out.push(tags.map(([t, v]) => `${t} ${rupees(v)}`).join('  ·  '));
  if (milestones.length) { out.push('', '<b>Milestones</b>'); milestones.slice(0, 6).forEach((m) => out.push('· ' + escapeHtml(line(m)))); }
  if (process.env.APP_URL) out.push('', `Backup: <a href="${process.env.APP_URL}/api/export">download everything as CSV</a>`);
  return out.join('\n');
}

export function escapeHtml(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
