import Link from 'next/link';
import Shell from '@/components/Shell';
import ItemRow from '@/components/ItemRow';
import { openItems } from '@/lib/items';
import { BUCKETS } from '@/lib/buckets';
import { metaOf, isOverdue } from '@/lib/view';

export const dynamic = 'force-dynamic';

const ORDER = ['pratham', 'freelance', 'mba', 'projects', 'personal'];
const KIND_ORDER = ['task', 'event', 'waiting', 'note'];
const KIND_TITLE: Record<string, string> = { task: 'To do', event: 'Events', waiting: 'Waiting on', note: 'Notes and ideas' };

export default async function Buckets({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const active = b && ORDER.includes(b) ? b : 'pratham';
  const open = (await openItems()).filter((i) => i.kind !== 'milestone');
  const count = (k: string) => open.filter((i) => i.bucket === k).length;
  const mine = open.filter((i) => i.bucket === active);

  return (
    <Shell active="/buckets">
      <h1>Buckets</h1>
      <div className="tabs">
        {ORDER.map((k) => (
          <Link key={k} href={`/buckets?b=${k}`} className={k === active ? 'on' : ''}>
            {BUCKETS[k].label}<span className="n">{count(k)}</span>
          </Link>
        ))}
      </div>
      {KIND_ORDER.map((kind) => {
        const rows = mine.filter((i) => i.kind === kind);
        if (!rows.length) return null;
        return (
          <section key={kind}>
            <h2>{KIND_TITLE[kind]}</h2>
            <div className="card list">
              {rows.map((i) => (
                <ItemRow key={i.id} id={i.id} title={i.title} meta={metaOf(i, { hideBucket: true })}
                  late={kind !== 'note' && isOverdue(i)} checkable={kind !== 'note'} />
              ))}
            </div>
          </section>
        );
      })}
      {!mine.length && <div className="card empty" style={{ marginTop: 24 }}>Nothing open in {BUCKETS[active].label}.</div>}
    </Shell>
  );
}
