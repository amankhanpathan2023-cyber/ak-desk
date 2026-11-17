import { BUCKETS, BUCKET_KEYS } from './buckets';
import { nowIstLabel, istDateStr } from './time';

const GROQ = 'https://api.groq.com/openai/v1';

function key() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing');
  return process.env.GROQ_API_KEY.trim();
}

// Groq retires models often. Try the configured one first, then known-good fallbacks,
// and remember whichever answers so later calls skip the dead ones.
const FALLBACK_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
let workingModel: string | null = null;

function modelList() {
  const env = (process.env.GROQ_MODEL || '').trim();
  const list = [workingModel, env, ...FALLBACK_MODELS].filter(Boolean) as string[];
  return [...new Set(list)];
}

async function chat(messages: { role: string; content: string }[], json: boolean) {
  let lastErr = '';
  for (const model of modelList()) {
    const r = await fetch(`${GROQ}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (r.ok) {
      workingModel = model;
      const j = await r.json();
      return j.choices?.[0]?.message?.content || '';
    }
    const body = (await r.text()).slice(0, 300);
    lastErr = `Groq ${r.status} (${model}): ${body}`;
    const dead = r.status === 404 || /model_not_found|decommissioned|does not exist/i.test(body);
    if (!dead) break;
    if (workingModel === model) workingModel = null;
  }
  throw new Error(lastErr);
}

export async function transcribe(buf: ArrayBuffer, filename: string) {
  const fd = new FormData();
  fd.append('file', new Blob([buf]), filename || 'voice.ogg');
  fd.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
  const r = await fetch(`${GROQ}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}` },
    body: fd,
  });
  if (!r.ok) throw new Error(`Groq voice ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.text || '').trim();
}

export type ParsedItem = {
  kind: 'task' | 'event' | 'expense' | 'note' | 'milestone' | 'waiting';
  title: string;
  bucket: string;
  tag?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  amount?: number | null;
  person?: string | null;
  recurrence?: 'daily' | 'weekly' | 'monthly' | null;
};

export type ItemUpdate = {
  ref: string;
  action: 'done' | 'drop' | 'edit';
  title?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  bucket?: string | null;
};

export type Parsed = {
  intent: 'add' | 'query' | 'chat' | 'update';
  items: ParsedItem[];
  updates: ItemUpdate[];
  question?: string;
  reply: string;
};

export type Turn = { r: 'u' | 'd'; t: string };

function systemPrompt(openList: string, history: Turn[]) {
  const buckets = BUCKET_KEYS.map((k) => `- ${k}: ${BUCKETS[k].hint}`).join('\n');
  const convo = history.length
    ? history.map((h) => `${h.r === 'u' ? 'Aman' : 'Dex'}: ${h.t}`).join('\n')
    : '(nothing yet)';
  return `You are Dex, Aman Pathan's personal assistant. Aman lives in Maharashtra, India. He works at Pratham, freelances, studies an MBA and runs side projects.
Think like a sharp human PA who knows him: understand what he means, connect it to what he said a moment ago, and reply like a person, not a form.
Right now it is ${nowIstLabel()} (India time, +05:30). Today is ${istDateStr()}.

RECENT CONVERSATION (oldest first). Use it to resolve words like "that day", "it", "same time", "usko":
${convo}

HIS OPEN ITEMS (ref | what | due | reminder):
${openList || '(none)'}

Return ONLY JSON:
{"intent":"add|query|chat|update","items":[...],"updates":[...],"question":"...","reply":"..."}

intent:
- "add": he is telling you something to keep (task, plan, expense, idea, goal, someone owes him something). One message can hold several items: split them.
- "update": he is changing or closing something already in OPEN ITEMS ("done with the report", "move leave reminder to 11", "cancel the call"). Fill updates, items is [].
- "query": he is asking about his stuff (what's due, what did I spend, what's tomorrow). items [] and question restates it in English. reply "".
- "chat": greetings, thanks, small talk, or something unclear. items [], reply naturally. If unclear, ask one short question.

Each item:
{"kind": "task|event|expense|note|milestone|waiting",
 "title": "short clear English, max 10 words, keep names, add the context that makes it make sense later (e.g. 'Apply for leave for 20 Nov shifting')",
 "bucket": one of ${BUCKET_KEYS.join(', ')},
 "tag": for expenses a category (food, travel, books, bills, rent, health, shopping, work, other); else null,
 "due_at": ISO 8601 with +05:30 or null,
 "remind_at": ISO 8601 with +05:30 when he asks to be reminded at a time, else null,
 "amount": number in rupees for expenses, else null,
 "person": the other person's name if any, else null,
 "recurrence": "daily"|"weekly"|"monthly" if it repeats, else null}

Each update:
{"ref": the ref from OPEN ITEMS, "action": "done|drop|edit", "title": new title or null, "due_at": new ISO or null, "remind_at": new ISO or null, "bucket": new bucket or null}

Buckets:
${buckets}

Rules:
- expense = money spent or paid (bucket money). "450", "1.2k" = 1200.
- waiting = he is waiting on someone else. due_at = when to follow up if said.
- milestone = a bigger goal with a target date.
- event = something happening at a fixed date or time (meeting, call, shifting, trip, function).
- note = idea or information with no action.
- "kal" = tomorrow, "parso" = day after, "Friday tak" = due Friday. "morning" alone = 9:00, "evening" = 18:00, "night" = 21:00.
- If only a date is given with no time, use 18:00 on that date.
- Never invent dates.

reply (for add, update and chat):
- Talk to him like a friend who is on top of things. 1 to 3 short sentences. Match his language: English, Hindi or Hinglish as he wrote.
- Say back what you understood in plain words, with day names ("Friday, 20 Nov"), and when you will remind him if he asked for a reminder.
- Connect the dots when it helps: if he mentions a related task (leave for the shifting day), say so.
- If something important is missing (a deadline-type task with no date), ask one short question at the end.
- Once in a while, if genuinely useful, suggest one next step. Don't lecture.
- No em dashes, no bullet points, no "Filed", no robotic labels, at most one emoji and usually none.`;
}

export async function parseMessage(text: string, openList = '', history: Turn[] = []): Promise<Parsed> {
  const out = await chat(
    [
      { role: 'system', content: systemPrompt(openList, history) },
      { role: 'user', content: text },
    ],
    true,
  );
  let j: any;
  try { j = JSON.parse(out); } catch { j = { intent: 'add', items: [{ kind: 'note', title: text.slice(0, 80), bucket: 'personal' }], reply: 'Noted.' }; }
  const items: ParsedItem[] = Array.isArray(j.items) ? j.items : [];
  for (const it of items) {
    if (!BUCKET_KEYS.includes(it.bucket)) it.bucket = it.kind === 'expense' ? 'money' : 'personal';
    if (!it.title) it.title = text.slice(0, 80);
    if (it.amount != null) it.amount = Number(it.amount) || null;
  }
  const updates: ItemUpdate[] = Array.isArray(j.updates) ? j.updates.filter((u: any) => u && u.ref) : [];
  const intent = ['add', 'query', 'chat', 'update'].includes(j.intent) ? j.intent : 'add';
  return { intent, items, updates, question: j.question, reply: String(j.reply || '').replace(/\s*\u2014\s*/g, ', ').trim() };
}

export async function answerQuestion(question: string, context: string, history: Turn[] = []) {
  const convo = history.slice(-6).map((h) => `${h.r === 'u' ? 'Aman' : 'Dex'}: ${h.t}`).join('\n');
  const out = await chat(
    [
      {
        role: 'system',
        content: `You are Dex, Aman's personal assistant, talking to him like a sharp friend who keeps his life organised. It is ${nowIstLabel()} India time.
Answer using ONLY the data below. Keep it short and natural: a line or two, or a short list if there are several things. Lead with what matters most (overdue or today first). Match his language (English, Hindi or Hinglish). Plain text, no headings, no em dashes. If the data doesn't have it, say so simply.

RECENT CONVERSATION:
${convo || '(none)'}

DATA:
${context}`,
      },
      { role: 'user', content: question },
    ],
    false,
  );
  return out.replace(/\s*\u2014\s*/g, ', ').replace(/\*\*/g, '').trim();
}
