-- Daily reports for the Mechanical, Electrical and Housekeeping departments.
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to re-run.
--
-- One row per department per day. `data` holds that day's whole report as JSON (equipment status, readings,
-- work orders, shift tasks, chemical stock, ...). The website reads and writes this table only from the server with
-- the service-role key, after checking the user's role, so Row Level Security is on with NO policies: the browser
-- (anon / signed-in keys) cannot touch it.

create table if not exists public.dept_daily (
  dept             text        not null check (dept in ('mechanical', 'electrical', 'housekeeping')),
  date             date        not null,
  data             jsonb       not null default '{}'::jsonb,
  created_by       uuid,
  created_by_name  text,
  updated_by       uuid,
  updated_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (dept, date)
);

create index if not exists dept_daily_date_idx on public.dept_daily (date desc);

alter table public.dept_daily enable row level security;
