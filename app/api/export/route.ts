import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { istDateStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

const COLS = ['created_at', 'kind', 'bucket', 'title', 'status', 'due_at', 'amount', 'tag', 'person', 'recurrence', 'done_at', 'source', 'raw'];

function cell(v: any) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const { data } = await db().from('items').select('*').order('created_at', { ascending: true }).limit(10000);
  const csv = [COLS.join(','), ...(data || []).map((r: any) => COLS.map((c) => cell(r[c])).join(','))].join('\n');
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dex-backup-${istDateStr()}.csv"`,
    },
  });
}
