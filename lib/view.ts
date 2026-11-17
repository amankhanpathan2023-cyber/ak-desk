import { bucketLabel, KIND_LABEL } from './buckets';
import { fmtWhen, rupees, istParts, istDateStr } from './time';
import type { Item } from './items';

export function metaOf(it: Item, opts: { hideDue?: boolean; hideBucket?: boolean } = {}) {
  const bits: string[] = [];
  if (!opts.hideBucket) bits.push(bucketLabel(it.bucket));
  if (it.kind !== 'task') bits.push(KIND_LABEL[it.kind] || it.kind);
  if (it.person) bits.push(it.person);
  if (it.amount) bits.push(rupees(Number(it.amount)));
  if (it.due_at && !opts.hideDue) bits.push(fmtWhen(it.due_at));
  if (it.recurrence) bits.push('repeats ' + it.recurrence);
  return bits.join(' · ');
}

export function hasTime(iso: string) {
  const p = istParts(new Date(iso));
  return !(p.h === 18 && p.min === 0);
}

export function isOverdue(it: Item) {
  return !!it.due_at && istDateStr(new Date(it.due_at)) < istDateStr();
}
