create table if not exists public.activity_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('generated_formula', 'scanned_image')),
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_user_id on public.activity_log(user_id);
create index if not exists idx_activity_log_created_at on public.activity_log(created_at desc);
create index if not exists idx_activity_log_action_type on public.activity_log(action_type);

alter table public.activity_log enable row level security;

grant select, insert on public.activity_log to authenticated;

drop policy if exists "Users can read their own activity" on public.activity_log;
drop policy if exists "Users can insert their own activity" on public.activity_log;

create policy "Users can read their own activity"
  on public.activity_log
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own activity"
  on public.activity_log
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.admin_overview_stats()
returns table(total_users bigint, formulas_generated_today bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.jwt() ->> 'email' <> 'berkanurekk@gmail.com' then
    raise exception 'forbidden';
  end if;

  return query
  select
    (select count(*) from auth.users),
    (select count(*)
       from public.activity_log al
      where al.action_type = 'generated_formula'
        and al.created_at >= date_trunc('day', now()));
end;
$$;

create or replace function public.admin_recent_users(p_limit int default 50)
returns table(
  id uuid,
  email text,
  provider text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.jwt() ->> 'email' <> 'berkanurekk@gmail.com' then
    raise exception 'forbidden';
  end if;

  return query
  select
    u.id,
    u.email,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
    u.created_at
  from auth.users u
  order by u.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

create or replace function public.admin_recent_activity(p_limit int default 50)
returns table(
  id bigint,
  user_id uuid,
  email text,
  action_type text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.jwt() ->> 'email' <> 'berkanurekk@gmail.com' then
    raise exception 'forbidden';
  end if;

  return query
  select
    al.id,
    al.user_id,
    u.email,
    al.action_type,
    al.created_at
  from public.activity_log al
  join auth.users u on u.id = al.user_id
  order by al.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

grant execute on function public.admin_overview_stats() to authenticated;
grant execute on function public.admin_recent_users(int) to authenticated;
grant execute on function public.admin_recent_activity(int) to authenticated;
