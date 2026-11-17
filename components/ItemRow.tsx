'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ItemRow({ id, title, meta, time, late, checkable = true }: {
  id: string; title: string; meta: string; time?: string; late?: boolean; checkable?: boolean;
}) {
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const router = useRouter();

  async function act(action: string) {
    if (action === 'done') setDone(true); else setGone(true);
    await fetch('/api/items', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    router.refresh();
  }

  if (gone) return null;
  return (
    <div className={'row' + (done ? ' done' : '')}>
      {time !== undefined && <span className="time">{time}</span>}
      {checkable && (
        <button className={'check' + (done ? ' on' : '')} aria-label={`Mark ${title} done`} onClick={() => act('done')}>
          {done ? '✓' : ''}
        </button>
      )}
      <div className="main">
        <div className="title">{title}</div>
        <div className="meta">{late && <span className="pill late">overdue</span>}{meta}</div>
      </div>
      {checkable && !done && <button className="ghost" onClick={() => act('tomorrow')}>Tomorrow</button>}
      <button className="ghost" aria-label={`Remove ${title}`} onClick={() => act('remove')}>Remove</button>
    </div>
  );
}
