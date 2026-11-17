import { BUCKETS, BUCKET_KEYS } from './buckets';
import { nowIstLabel, istDateStr } from './time';

const GROQ = 'https://api.groq.com/openai/v1';

function key() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing');
  return process.env.GROQ_API_KEY;
}

async function chat(messages: { role: string; content: string }[], json: boolean) {
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.1,
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
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

export type Parsed = { intent: 'add' | 'query'; items: ParsedItem[]; question?: string };

function systemPrompt() {
  const buckets = BUCKET_KEYS.map((k) => `- ${k}: ${BUCKETS[k].hint}`).join('\n');
  return `You are Dex, the personal assistant of Aman Pathan in Maharashtra, India.
Aman sends quick notes in English, Hindi, Marathi or a mix. Turn each message into structured items.
Right now it is ${nowIstLabel()} (India time, +05:30). Today is ${istDateStr()}.

Return ONLY JSON: {"intent":"add"|"query","items":[...],"question":"..."}
Use intent "query" when Aman is asking something (what's due, what did I spend, what's tomorrow). Then items is [] and question restates it in English.
Otherwise intent "add". One message can hold several items: split them.

Each item:
{"kind": "task|event|expense|note|milestone|waiting",
 "title": "short clear English, max 10 words, keep names",
 "bucket": one of ${BUCKET_KEYS.join(', ')},
 "tag": for expenses a category (food, travel, books, bills, rent, health, shopping, work, other); else null,
 "due_at": ISO 8601 with +05:30 or null,
 "remind_at": ISO 8601 with +05:30 only if Aman asks to be reminded at a specific time, else null,
 "amount": number in rupees for expenses, else null,
 "person": the other person's name if any, else null,
 "recurrence": "daily"|"weekly"|"monthly" if it repeats, else null}

Buckets:
${buckets}

Rules:
- expense = money spent or paid (bucket money). Amounts like "450", "1.2k" = 1200.
- waiting = Aman is waiting on someone else to do something. due_at = when to follow up if said.
- milestone = a bigger goal with a target date (bucket milestones).
- event = something at a fixed time with others (meeting, call, session).
- note = idea or information with no action.
- Dates: "kal" means tomorrow, "parso" day after tomorrow, "Friday tak" means due Friday. If only a date is given and no time, use 18:00 on that date.
- Never invent dates. If no date is given, due_at is null.`;
}

export async function parseMessage(text: string): Promise<Parsed> {
  const out = await chat(
    [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: text },
    ],
    true,
  );
  let j: any;
  try { j = JSON.parse(out); } catch { j = { intent: 'add', items: [{ kind: 'note', title: text.slice(0, 80), bucket: 'personal' }] }; }
  const items: ParsedItem[] = Array.isArray(j.items) ? j.items : [];
  for (const it of items) {
    if (!BUCKET_KEYS.includes(it.bucket)) it.bucket = it.kind === 'expense' ? 'money' : 'personal';
    if (!it.title) it.title = text.slice(0, 80);
    if (it.amount != null) it.amount = Number(it.amount) || null;
  }
  return { intent: j.intent === 'query' ? 'query' : 'add', items, question: j.question };
}

export async function answerQuestion(question: string, context: string) {
  return chat(
    [
      {
        role: 'system',
        content: `You are Dex, Aman's assistant. It is ${nowIstLabel()} India time. Answer his question using ONLY the data below. Be short: a few lines, plain text, no markdown headings, no em dashes. Reply in the language he asked in. If the data doesn't have the answer, say so.\n\nDATA:\n${context}`,
      },
      { role: 'user', content: question },
    ],
    false,
  );
}
