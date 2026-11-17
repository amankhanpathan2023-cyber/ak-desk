import Link from 'next/link';
import Shell from '@/components/Shell';
import ItemRow from '@/components/ItemRow';
import { expensesBetween } from '@/lib/items';
import { istDateStr, istAt, rupees, fmtDay } from '@/lib/time';

export const dynamic = 'force-dynamic';

function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: istAt(`${ym}-01`, 0), to: istAt(`${next}-01`, 0), next };
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export default async function Money({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const thisMonth = istDateStr().slice(0, 7);
  const ym = m && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth;
  const { from, to, next } = monthBounds(ym);
  const spent = await expensesBetween(from, to);
  const total = spent.reduce((s, e) => s + Number(e.amount || 0), 0);
  const byTag: Record<string, number> = {};
  for (const e of spent) byTag[e.tag || 'other'] = (byTag[e.tag || 'other'] || 0) + Number(e.amount || 0);
  const tags = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  const label = from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <Shell active="/money">
      <h1>{label}</h1>
      <div className="tabs">
        <Link href={`/money?m=${prevMonth(ym)}`}>← Previous</Link>
        {ym !== thisMonth && <Link href={`/money?m=${next}`}>Next →</Link>}
        <a href="/api/export">Download backup (CSV)</a>
      </div>
      <div className="stats">
        <div className="card stat"><div className="v">{rupees(total)}</div><div className="k">spent</div></div>
        <div className="card stat"><div className="v">{spent.length}</div><div className="k">entries</div></div>
      </div>
      {tags.length > 0 && (
        <>
          <h2>By category</h2>
          <div className="card list">
            {tags.map(([t, v]) => (
              <div className="row" key={t}>
                <div className="main">
                  <div className="title" style={{ textTransform: 'capitalize' }}>{t}</div>
                  <div className="bar"><span style={{ width: `${Math.round((v / total) * 100)}%` }} /></div>
                </div>
                <strong>{rupees(v)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      <h2>Entries</h2>
      <div className="card list">
        {spent.length ? spent.map((e) => (
          <ItemRow key={e.id} id={e.id} checkable={false} title={`${e.title}  ${rupees(Number(e.amount || 0))}`}
            meta={`${fmtDay(e.created_at)} · ${e.tag || 'other'}`} />
        )) : <div className="empty">No spending logged. Tell Dex "paid 450 auto Satara".</div>}
      </div>
    </Shell>
  );
}
