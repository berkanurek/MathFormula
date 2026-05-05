alter table public.user_formulas enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.user_formulas to authenticated;

drop policy if exists "Users can read their own formulas" on public.user_formulas;
drop policy if exists "Users can insert their own formulas" on public.user_formulas;
drop policy if exists "Users can update their own formulas" on public.user_formulas;
drop policy if exists "Users can delete their own formulas" on public.user_formulas;

create policy "Users can read their own formulas"
  on public.user_formulas
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own formulas"
  on public.user_formulas
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own formulas"
  on public.user_formulas
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own formulas"
  on public.user_formulas
  for delete
  to authenticated
  using (auth.uid() = user_id);
