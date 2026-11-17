export const TZ = 'Asia/Kolkata';
const IST_MS = 330 * 60 * 1000;

export function istParts(d: Date = new Date()) {
  const s = new Date(d.getTime() + IST_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    min: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

const p2 = (n: number) => String(n).padStart(2, '0');

export function istDateStr(d: Date = new Date()) {
  const p = istParts(d);
  return `${p.y}-${p2(p.m)}-${p2(p.d)}`;
}

export function istAt(dateStr: string, hh: number, mm = 0) {
  return new Date(`${dateStr}T${p2(hh)}:${p2(mm)}:00+05:30`);
}

export function istDayBounds(dateStr: string) {
  const start = istAt(dateStr, 0);
  return { start, end: new Date(start.getTime() + 86400000) };
}

export function addDays(dateStr: string, n: number) {
  return istDateStr(new Date(istAt(dateStr, 12).getTime() + n * 86400000));
}

export function nowIstLabel() {
  return new Date().toLocaleString('en-IN', {
    timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(iso: string | Date) {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtWhen(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = istParts(d);
  const dateOnly = p.h === 18 && p.min === 0;
  const today = istDateStr();
  const day = istDateStr(d);
  let label = fmtDay(d);
  if (day === today) label = 'today';
  else if (day === addDays(today, 1)) label = 'tomorrow';
  else if (day === addDays(today, -1)) label = 'yesterday';
  return dateOnly ? label : `${label}, ${fmtTime(d)}`;
}

export function rupees(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
