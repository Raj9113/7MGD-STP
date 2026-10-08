-- Laboratory daily entry — run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (everything is "if not exists").
--
-- The website reads and writes these only from the server with the service-role key (after checking the user's
-- role), so Row Level Security is switched on with NO policies: the browser (anon / signed-in keys) can't touch them.

-- 1. One row per day. `readings` holds the same shape the Laboratory page already uses, e.g.
--    {"flow":{"pumping":0.71,"treated":0.63},"ph":{"in":7,"out":7.2},"bod":{"in":140,"out":6}, ...}
create table if not exists public.lab_daily (
  date             date primary key,
  readings         jsonb       not null default '{}'::jsonb,
  power            jsonb,
  photos           jsonb       not null default '[]'::jsonb,  -- [{"kind":"sample"|"olms","path":"2026-10/07-sample.jpeg"}]
  created_by       uuid,
  created_by_name  text,
  updated_by       uuid,
  updated_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.lab_daily enable row level security;

-- 2. Private bucket for the sample / OLMS photographs (4 MB each, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-photos', 'lab-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
