-- PRESTRESS-CALC: Design Projects table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- or via `supabase db push`.
--
-- NOTE: the app (src/lib/cloudStorage.ts + CloudModal.tsx) connects with the
-- public ANON key and has NO sign-in flow — rows are inserted without a user_id.
-- The RLS policy below therefore grants the `anon` role full access. This makes
-- every saved project readable/writable by anyone holding the (public) anon key,
-- which is the intended behaviour of this single-tenant design tool. To move to
-- per-user projects later: add `user_id uuid references auth.users(id)`, a sign-in
-- flow, and replace the policy with `auth.uid() = user_id`.

create extension if not exists pgcrypto;   -- gen_random_uuid()

create table if not exists public.design_projects (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  name        text        not null,
  description text        default '',
  inputs      jsonb       not null,
  results     jsonb,
  is_public   boolean     default false
);

create index if not exists idx_design_projects_updated
  on public.design_projects(updated_at desc);

-- Row Level Security
alter table public.design_projects enable row level security;

-- App uses the anon key without authentication → allow the anon role full access.
drop policy if exists "anon full access" on public.design_projects;
create policy "anon full access"
  on public.design_projects
  for all
  to anon
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists design_projects_updated_at on public.design_projects;
create trigger design_projects_updated_at
  before update on public.design_projects
  for each row execute function update_updated_at();
