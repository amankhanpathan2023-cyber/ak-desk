import Shell from '@/components/Shell';
import ItemRow from '@/components/ItemRow';
import { openItems } from '@/lib/items';
import { eventsForDay } from '@/lib/calendar';
import { istDateStr, istDayBounds, addDays, fmtTime, fmtDay, TZ } from '@/lib/time';
import { metaOf, hasTime, isOverdue } from '@/lib/view';

export const dynamic = 'force-dynamic';

export default async function Today() {
  const today = istDateStr();
  const { start, end } = istDayBounds(today);
  const soonEnd = istDayBounds(addDays(today, 3)).end;
  const [events, open] = await Promise.all([eventsForDay(today), openItems()]);
  const actionable = open.filter((i) => i.kind === 'task' || i.kind === 'waiting' || i.kind === 'event');

  const overdue = actionable.filter((i) => i.kind !== 'event' && isOverdue(i));
  const todayItems = actionable.filter((i) => i.due_at && new Date(i.due_at) >= start && new Date(i.due_at) < end);
  const timed = todayItems.filter((i) => hasTime(i.due_at!));
  const untimed = todayItems.filter((i) => !hasTime(i.due_at!));
  const soon = actionable.filter((i) => i.due_at && new Date(i.due_at) >= end && new Date(i.due_at) < soonEnd);
  const inbox = open.filter((i) => !i.due_at && i.kind === 'task').slice(0, 8);

  type Slot = { at: string; node: React.ReactNode };
  const timeline: Slot[] = [
    ...events.map((e, n) => ({
      at: e.allDay ? start.toISOString() : e.start,
      node: (
        <div className="row" key={'e' + n}>
          <span className="time">{e.allDay ? 'All day' : fmtTime(e.start)}</span>
          <div className="main">
            <div className="title">{e.title}</div>
            <div className="meta"><span className="pill cal">{e.cal}</span>{e.allDay ? '' : `until ${fmtTime(e.end)}`}</div>
          </div>
        </div>
      ),
    })),
    ...timed.map((i) => ({
      at: i.due_at!,
      node: <ItemRow key={i.id} id={i.id} title={i.title} meta={metaOf(i, { hideDue: true })} time={fmtTime(i.due_at!)} />,
    })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  const dateLabel = new Date().toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Shell active="/">
      <h1>{dateLabel}</h1>
      <p className="sub">
        {events.length} meeting{events.length === 1 ? '' : 's'} · {untimed.length + timed.length} due today
        {overdue.length ? ` · ${overdue.length} overdue` : ''}
      </p>

      <h2>Timeline</h2>
      <div className="card list">
        {timeline.length ? timeline.map((s) => s.node) : <div className="empty">No meetings or timed tasks today.</div>}
      </div>

      <h2>Due today</h2>
      <div className="card list">
        {overdue.map((i) => <ItemRow key={i.id} id={i.id} title={i.title} meta={metaOf(i)} late />)}
        {untimed.map((i) => <ItemRow key={i.id} id={i.id} title={i.title} meta={metaOf(i, { hideDue: true })} />)}
        {!overdue.length && !untimed.length && <div className="empty">Nothing due. Pick something from a milestone.</div>}
      </div>

      {soon.length > 0 && (
        <>
          <h2>Next 3 days</h2>
          <div className="card list">
            {soon.map((i) => <ItemRow key={i.id} id={i.id} title={i.title} meta={`${fmtDay(i.due_at!)} · ${metaOf(i, { hideDue: true })}`} />)}
          </div>
        </>
      )}

      {inbox.length > 0 && (
        <>
          <h2>No date yet</h2>
          <div className="card list">
            {inbox.map((i) => <ItemRow key={i.id} id={i.id} title={i.title} meta={metaOf(i)} />)}
          </div>
        </>
      )}
    </Shell>
  );
}
