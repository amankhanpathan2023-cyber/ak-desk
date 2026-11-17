import { NextRequest, NextResponse } from 'next/server';
import { handleDump, line, markDone, moveTomorrow, removeItem, setBucket } from '@/lib/items';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Quick-add from the app.
export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || !String(text).trim()) return NextResponse.json({ error: 'Type something first.' }, { status: 400 });
  try {
    const res = await handleDump(String(text).trim(), 'app');
    if (res.kind === 'answer') return NextResponse.json({ answer: res.answer });
    return NextResponse.json({ answer: res.answer, filed: res.saved.filter((i) => i.status === 'open').map((i) => line(i, true)) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// Row actions: done, tomorrow, remove, bucket.
export async function PATCH(req: NextRequest) {
  const { id, action, bucket } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  if (action === 'done') await markDone(id);
  else if (action === 'tomorrow') await moveTomorrow(id);
  else if (action === 'remove') await removeItem(id);
  else if (action === 'bucket' && bucket) await setBucket(id, bucket);
  else return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
