-- Dex database. Run once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'task'
               check (kind in ('task','event','expense','note','milestone','waiting')),
  title        text not null,
  bucket       text not null default 'personal',
  tag          text,
  due_at       timestamptz,
  remind_at    timestamptz,
  reminded_at  timestamptz,
  amount       numeric,
  person       text,
  recurrence   text check (recurrence in ('daily','weekly','monthly')),
  status       text not null default 'open' check (status in ('open','done','dropped')),
  done_at      timestamptz,
  raw          text,
  source       text default 'telegram',
  created_at   timestamptz not null default now()
);

create index if not exists items_status_due on items (status, due_at);
create index if not exists items_remind on items (remind_at) where reminded_at is null;
create index if not exists items_kind_created on items (kind, created_at);

-- Small key/value store so each brief is sent once per day.
create table if not exists kv (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- Lock both tables: only the app's server key can read or write.
alter table items enable row level security;
alter table kv enable row level security;
