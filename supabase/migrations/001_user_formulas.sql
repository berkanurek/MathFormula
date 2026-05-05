create extension if not exists "pgcrypto";

create table if not exists public.user_formulas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  latex_code text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_formulas_user_id on public.user_formulas(user_id);
create index if not exists idx_user_formulas_created_at on public.user_formulas(created_at desc);

alter table public.user_formulas enable row level security;

drop policy if exists "Users can read their own formulas" on public.user_formulas;
drop policy if exists "Users can insert their own formulas" on public.user_formulas;
drop policy if exists "Users can update their own formulas" on public.user_formulas;
drop policy if exists "Users can delete their own formulas" on public.user_formulas;

create policy "Users can read their own formulas"
  on public.user_formulas
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own formulas"
  on public.user_formulas
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own formulas"
  on public.user_formulas
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own formulas"
  on public.user_formulas
  for delete
  using (auth.uid() = user_id);
