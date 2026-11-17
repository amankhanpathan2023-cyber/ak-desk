import Shell from '@/components/Shell';
import ItemRow from '@/components/ItemRow';
import { openItems } from '@/lib/items';
import { fmtDay } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function Goals() {
  const goals = (await openItems()).filter((i) => i.kind === 'milestone');
  const left = (iso: string) => Math.ceil((+new Date(iso) - Date.now()) / 86400000);
  const horizon = (iso: string | null) => {
    if (!iso) return 'Someday';
    const d = left(iso);
    if (d <= 90) return 'Next 3 months';
    if (d <= 180) return 'Next 6 months';
    return 'This year and beyond';
  };
  const groups = ['Next 3 months', 'Next 6 months', 'This year and beyond', 'Someday'];

  return (
    <Shell active="/goals">
      <h1>Milestones</h1>
      <p className="sub">The long game. Dex reminds you a week before each target date.</p>
      {groups.map((g) => {
        const rows = goals.filter((i) => horizon(i.due_at) === g);
        if (!rows.length) return null;
        return (
          <section key={g}>
            <h2>{g}</h2>
            <div className="card list">
              {rows.map((i) => (
                <ItemRow key={i.id} id={i.id} title={i.title}
                  meta={i.due_at ? `${fmtDay(i.due_at)} · ${left(i.due_at)} days left` : 'no target date'}
                  late={!!i.due_at && left(i.due_at) < 0} />
              ))}
            </div>
          </section>
        );
      })}
      {!goals.length && <div className="card empty" style={{ marginTop: 24 }}>No milestones yet. Tell Dex "goal: finish the Char Yaar fractions module by March".</div>}
    </Shell>
  );
}
