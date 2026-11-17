import ical from 'node-ical';
import { istDayBounds } from './time';

export type CalEvent = { title: string; start: string; end: string; allDay: boolean; cal: string };

function sources() {
  const out: { url: string; name: string }[] = [];
  if (process.env.CAL_URL_1) out.push({ url: process.env.CAL_URL_1, name: process.env.CAL_NAME_1 || 'Calendar 1' });
  if (process.env.CAL_URL_2) out.push({ url: process.env.CAL_URL_2, name: process.env.CAL_NAME_2 || 'Calendar 2' });
  return out;
}

function sameInstant(a: any, b: Date) {
  return Math.abs(new Date(a).getTime() - b.getTime()) < 60000;
}

export async function eventsBetween(start: Date, end: Date): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  for (const src of sources()) {
    try {
      const res = await fetch(src.url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data: any = ical.sync.parseICS(await res.text());
      for (const k of Object.keys(data)) {
        const ev = data[k];
        if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;
        if (String(ev.status || '').toUpperCase() === 'CANCELLED') continue;
        const s0 = new Date(ev.start);
        const e0 = ev.end ? new Date(ev.end) : new Date(s0.getTime() + 3600000);
        const dur = Math.max(e0.getTime() - s0.getTime(), 0);
        const allDay = ev.datetype === 'date';
        const title = typeof ev.summary === 'string' ? ev.summary : ev.summary?.val || '(no title)';

        if (ev.rrule) {
          const occ: Date[] = ev.rrule.between(new Date(start.getTime() - dur), end, true);
          for (const o of occ) {
            const exdates = ev.exdate ? Object.values(ev.exdate) : [];
            if (exdates.some((x: any) => sameInstant(x, o))) continue;
            const over = ev.recurrences
              ? Object.values(ev.recurrences).find((r: any) => r.recurrenceid && sameInstant(r.recurrenceid, o))
              : null;
            const os = over ? new Date((over as any).start) : o;
            const oe = over && (over as any).end ? new Date((over as any).end) : new Date(os.getTime() + dur);
            if (os < end && oe > start) {
              const t = over ? ((over as any).summary?.val || (over as any).summary || title) : title;
              out.push({ title: String(t), start: os.toISOString(), end: oe.toISOString(), allDay, cal: src.name });
            }
          }
        } else if (s0 < end && e0 > start) {
          out.push({ title, start: s0.toISOString(), end: e0.toISOString(), allDay, cal: src.name });
        }
      }
    } catch {
      // A broken calendar link should never stop the brief.
    }
  }
  return out.sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

export async function eventsForDay(dateStr: string) {
  const { start, end } = istDayBounds(dateStr);
  return eventsBetween(start, end);
}
