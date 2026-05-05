create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_formulas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  image_url text,
  folder_id uuid references public.folders(id) on delete set null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_folders_user_id on public.folders(user_id);
create index if not exists idx_saved_formulas_user_id on public.saved_formulas(user_id);
create index if not exists idx_saved_formulas_folder_id on public.saved_formulas(folder_id);
create index if not exists idx_saved_formulas_favorite on public.saved_formulas(is_favorite);
create index if not exists idx_saved_formulas_created_at on public.saved_formulas(created_at desc);

alter table public.folders enable row level security;
alter table public.saved_formulas enable row level security;

grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.saved_formulas to authenticated;

drop policy if exists "Users can read their own folders" on public.folders;
drop policy if exists "Users can insert their own folders" on public.folders;
drop policy if exists "Users can update their own folders" on public.folders;
drop policy if exists "Users can delete their own folders" on public.folders;

create policy "Users can read their own folders"
  on public.folders
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own folders"
  on public.folders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own folders"
  on public.folders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own folders"
  on public.folders
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own saved formulas" on public.saved_formulas;
drop policy if exists "Users can insert their own saved formulas" on public.saved_formulas;
drop policy if exists "Users can update their own saved formulas" on public.saved_formulas;
drop policy if exists "Users can delete their own saved formulas" on public.saved_formulas;

create policy "Users can read their own saved formulas"
  on public.saved_formulas
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own saved formulas"
  on public.saved_formulas
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own saved formulas"
  on public.saved_formulas
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved formulas"
  on public.saved_formulas
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into public.saved_formulas (user_id, content, created_at)
select uf.user_id, uf.latex_code, uf.created_at
from public.user_formulas uf
where not exists (
  select 1
  from public.saved_formulas sf
  where sf.user_id = uf.user_id
    and sf.content = uf.latex_code
    and sf.created_at = uf.created_at
);
