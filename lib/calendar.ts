import ical from 'node-ical';
import { istDayBounds } from './time';

export type CalEvent = { title: string; start: string; end: string; allDay: boolean; cal: string };

function sources() {
  const out: { url: string; name: string }[] = [];
  const add = (u?: string, n?: string, d = 'Calendar') => {
    const url = (u || '').trim().replace(/^["']|["']$/g, '').trim().replace(/^webcal:\/\//i, 'https://');
    if (url) out.push({ url, name: (n || '').trim() || d });
  };
  add(process.env.CAL_URL_1, process.env.CAL_NAME_1, 'Calendar 1');
  add(process.env.CAL_URL_2, process.env.CAL_NAME_2, 'Calendar 2');
  return out;
}

// Describe a link without revealing it, so problems can be diagnosed safely.
function linkKind(url: string) {
  if (!/^https:\/\//i.test(url)) return 'link does not start with https://';
  if (!/calendar\.google\.com/i.test(url)) return 'not a Google Calendar link';
  if (/\/public\/basic\.ics/i.test(url)) return 'this is the PUBLIC address; use the SECRET address';
  if (/\/private-[a-z0-9]+\/basic\.ics/i.test(url)) return 'secret address, looks right, so Google is refusing it';
  if (/\/embed|\?cid=|\/r\b|\/u\/\d/i.test(url)) return 'this is a share or embed link, not the iCal address';
  return 'link shape not recognised, it may be cut off';
}

// What happened on the last read of each calendar, so Dex can say "not connected" instead of "no calls".
export type CalStatus = { name: string; ok: boolean; note: string };
let lastStatus: CalStatus[] = [];
export function calendarStatus(): CalStatus[] {
  if (!sources().length) return [{ name: 'Calendar', ok: false, note: 'no calendar link is set (CAL_URL_1 missing in Vercel)' }];
  return lastStatus;
}

function sameInstant(a: any, b: Date) {
  return Math.abs(new Date(a).getTime() - b.getTime()) < 60000;
}

export async function eventsBetween(start: Date, end: Date): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  const status: CalStatus[] = [];
  for (const src of sources()) {
    try {
      const res = await fetch(src.url, { cache: 'no-store' });
      if (!res.ok) { status.push({ name: src.name, ok: false, note: `link returned error ${res.status} (${linkKind(src.url)})` }); continue; }
      const body = await res.text();
      if (!body.includes('BEGIN:VCALENDAR')) { status.push({ name: src.name, ok: false, note: 'link did not return a calendar (wrong link, or the org blocks sharing)' }); continue; }
      const data: any = ical.sync.parseICS(body);
      const evCount = Object.values(data).filter((e: any) => e?.type === 'VEVENT').length;
      status.push({ name: src.name, ok: true, note: `connected, ${evCount} events in the feed` });
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
    } catch (e: any) {
      // A broken calendar link should never stop the brief.
      status.push({ name: src.name, ok: false, note: 'could not read: ' + String(e?.message || e).slice(0, 80) });
    }
  }
  lastStatus = status;
  return out.sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

export async function eventsForDay(dateStr: string) {
  const { start, end } = istDayBounds(dateStr);
  return eventsBetween(start, end);
}
