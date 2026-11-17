import Shell from '@/components/Shell';
import ItemRow from '@/components/ItemRow';
import { openItems } from '@/lib/items';
import { metaOf } from '@/lib/view';

export const dynamic = 'force-dynamic';

export default async function Waiting() {
  const waiting = (await openItems()).filter((i) => i.kind === 'waiting')
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const days = (iso: string) => Math.floor((Date.now() - +new Date(iso)) / 86400000);

  return (
    <Shell active="/waiting">
      <h1>Waiting on</h1>
      <p className="sub">People who owe you something. Oldest first. Tick when it arrives.</p>
      <div className="card list" style={{ marginTop: 16 }}>
        {waiting.length ? waiting.map((i) => (
          <ItemRow key={i.id} id={i.id} title={`${i.person ? i.person + ': ' : ''}${i.title}`}
            meta={`${days(i.created_at)} days · ${metaOf(i, { hideBucket: false })}`} late={days(i.created_at) > 3} />
        )) : <div className="empty">You are not waiting on anyone. Tell Dex "waiting on Shankar for the attendance sheet".</div>}
      </div>
    </Shell>
  );
}
