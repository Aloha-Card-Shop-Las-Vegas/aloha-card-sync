-- 1) Make sure the UUID generator exists
create extension if not exists pgcrypto;  -- provides gen_random_uuid()

-- 2) Ensure the id column is uuid, has values, and auto-fills going forward
-- (works whether id is text or uuid already)
alter table print_jobs
  alter column id drop default;

-- If id is TEXT, convert it to UUID or generate one if invalid/empty
do $$
begin
  if (select data_type from information_schema.columns
      where table_name='print_jobs' and column_name='id') = 'text' then
    alter table print_jobs
      alter column id type uuid
      using (case
               when id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 then id::uuid
               else gen_random_uuid()
             end);
  end if;
end $$;

-- Backfill any NULL ids (if the column was already uuid but missing values)
update print_jobs
set id = gen_random_uuid()
where id is null;

-- Enforce default + not null + PK
alter table print_jobs
  alter column id set default gen_random_uuid(),
  alter column id set not null;

-- Add PK if missing
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.print_jobs'::regclass and contype = 'p'
  ) then
    alter table print_jobs add primary key (id);
  end if;
end $$;