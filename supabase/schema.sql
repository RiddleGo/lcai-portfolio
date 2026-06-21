-- Russshare 人生中枢 · Supabase 云同步
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

create table if not exists public.life_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.life_state enable row level security;

drop policy if exists "life_state_select_own" on public.life_state;
drop policy if exists "life_state_insert_own" on public.life_state;
drop policy if exists "life_state_update_own" on public.life_state;

create policy "life_state_select_own"
  on public.life_state for select
  using (auth.uid() = user_id);

create policy "life_state_insert_own"
  on public.life_state for insert
  with check (auth.uid() = user_id);

create policy "life_state_update_own"
  on public.life_state for update
  using (auth.uid() = user_id);

create or replace function public.handle_life_state_updated()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists life_state_updated on public.life_state;
create trigger life_state_updated
  before update on public.life_state
  for each row execute function public.handle_life_state_updated();
