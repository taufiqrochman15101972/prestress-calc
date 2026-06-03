-- PRESTRESS-CALC: Design Projects table
-- Run this in Supabase SQL Editor or via supabase db push

create table if not exists public.design_projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  name        text        not null,
  description text        default '',
  inputs      jsonb       not null,
  results     jsonb,
  is_public   boolean     default false
);

create index if not exists idx_design_projects_user_updated
  on public.design_projects(user_id, updated_at desc);

-- Row Level Security
alter table public.design_projects enable row level security;

-- Users can do anything with their own projects
create policy "Users manage own projects"
  on public.design_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone can read public projects
create policy "Public projects readable"
  on public.design_projects
  for select
  using (is_public = true);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger design_projects_updated_at
  before update on public.design_projects
  for each row execute function update_updated_at();
