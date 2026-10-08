-- Allow the new "Laboratory" department/role. Run ONCE in the Supabase SQL Editor (safe to re-run).
--
-- profiles.department has a CHECK rule listing the allowed departments (Mechanical, Electrical, Housekeeping, Admin,
-- Viewer). The access/role request tables usually have the same kind of rule. This finds every such rule on those
-- three tables and re-creates it with 'Laboratory' added, keeping its name and everything else about it.

do $$
declare
  c record;
  new_def text;
begin
  for c in
    select cl.relname as tbl, con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public'
      and cl.relname in ('profiles', 'registration_requests', 'role_requests')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%department%'
      and pg_get_constraintdef(con.oid) like '%''Housekeeping''::text%'
      and pg_get_constraintdef(con.oid) not like '%''Laboratory''::text%'
  loop
    new_def := replace(c.def, '''Housekeeping''::text', '''Housekeeping''::text, ''Laboratory''::text');
    execute format('alter table public.%I drop constraint %I', c.tbl, c.conname);
    execute format('alter table public.%I add constraint %I %s', c.tbl, c.conname, new_def);
    raise notice 'Updated %.%: %', c.tbl, c.conname, new_def;
  end loop;
end
$$;

-- Check: every department rule should now mention 'Laboratory'
select cl.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as rule
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
where cl.relnamespace = 'public'::regnamespace
  and cl.relname in ('profiles', 'registration_requests', 'role_requests')
  and con.contype = 'c'
  and pg_get_constraintdef(con.oid) ilike '%department%';
