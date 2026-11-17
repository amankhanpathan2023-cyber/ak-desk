export const BUCKETS: Record<string, { label: string; code: string; hint: string }> = {
  pratham:    { label: 'Pratham',    code: 'pr', hint: 'Pratham Education Foundation work: CT programme in Satara, maths group, number sense, TCS, ZP, field team, Suchitra, Shankar, trainings, reports' },
  freelance:  { label: 'Freelance',  code: 'fr', hint: 'paid side work: 321 Education Foundation workbooks, OLF caselets, Circuit website, invoices, clients' },
  mba:        { label: 'MBA',        code: 'mb', hint: 'NMIMS MBA: assignments, exams, project, lectures, fees' },
  projects:   { label: 'Projects',   code: 'pj', hint: 'personal projects: Char Yaar, portfolio site AK Creates, LinkedIn posts, PAAUL, TFI alumni chapter, poetry' },
  personal:   { label: 'Personal',   code: 'ps', hint: 'home, family, health, errands, bills to pay, travel, friends' },
  money:      { label: 'Money',      code: 'mo', hint: 'money spent or received' },
  milestones: { label: 'Milestones', code: 'ml', hint: 'long-term goals with a target date (3, 6, 12 months)' },
};

export const BUCKET_KEYS = Object.keys(BUCKETS);

export function bucketByCode(code: string) {
  return BUCKET_KEYS.find((k) => BUCKETS[k].code === code) || 'personal';
}

export function bucketLabel(key: string) {
  return BUCKETS[key]?.label || key;
}

export const KIND_LABEL: Record<string, string> = {
  task: 'task', event: 'event', expense: 'expense', note: 'note', milestone: 'milestone', waiting: 'waiting on',
};
