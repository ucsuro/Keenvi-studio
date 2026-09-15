-- After applying this migration, add the intended Supabase Auth user to
-- public.admin_users. Until an administrator is added, browser writes are denied.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.gallery_items enable row level security;
alter table public.site_settings enable row level security;

revoke insert, update, delete on table public.gallery_items from anon;
revoke insert, update, delete on table public.site_settings from anon;
grant select on table public.gallery_items to anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update, delete on table public.gallery_items to authenticated;
grant insert, update, delete on table public.site_settings to authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('gallery_items', 'site_settings')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

create policy "Public can read gallery items"
on public.gallery_items for select
to anon, authenticated
using (true);

create policy "Administrators can insert gallery items"
on public.gallery_items for insert
to authenticated
with check ((select public.is_admin()));

create policy "Administrators can update gallery items"
on public.gallery_items for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Administrators can delete gallery items"
on public.gallery_items for delete
to authenticated
using ((select public.is_admin()));

create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

create policy "Administrators can insert site settings"
on public.site_settings for insert
to authenticated
with check ((select public.is_admin()));

create policy "Administrators can update site settings"
on public.site_settings for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Administrators can delete site settings"
on public.site_settings for delete
to authenticated
using ((select public.is_admin()));
