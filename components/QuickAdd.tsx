'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickAdd() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setMsg({ text: 'Type something first.', err: true }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const j = await r.json();
      if (!r.ok) setMsg({ text: j.error || 'Could not save that.', err: true });
      else if (j.filed) { setMsg({ text: [j.answer, ...(j.filed || []).map((f: string) => '· ' + f)].filter(Boolean).join('\n') }); setText(''); router.refresh(); }
      else setMsg({ text: j.answer });
    } catch {
      setMsg({ text: 'No connection. Try again.', err: true });
    }
    setBusy(false);
  }

  return (
    <div className="quick">
      <form onSubmit={submit}>
        <label htmlFor="dump" style={{ position: 'absolute', left: -9999 }}>Dump anything</label>
        <input id="dump" value={text} onChange={(e) => { setText(e.target.value); setMsg(null); }}
          placeholder="Dump anything: task, expense, idea, or ask a question" autoComplete="off" />
        <button className="btn" disabled={busy}>{busy ? 'Filing…' : 'Add'}</button>
      </form>
      {msg && <div className={'notice' + (msg.err ? ' err' : '')} role="status">{msg.text}</div>}
    </div>
  );
}
