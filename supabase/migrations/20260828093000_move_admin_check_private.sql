-- Keep the security-definer authorization helper outside exposed API schemas.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_site_admin()
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

revoke all on function private.is_site_admin() from public;
grant execute on function private.is_site_admin() to authenticated;

drop policy if exists "Admins can insert site content" on public.site_content;
create policy "Admins can insert site content"
on public.site_content for insert
to authenticated
with check (private.is_site_admin() and id = 'main');

drop policy if exists "Admins can update site content" on public.site_content;
create policy "Admins can update site content"
on public.site_content for update
to authenticated
using (private.is_site_admin())
with check (private.is_site_admin() and id = 'main');

drop policy if exists "Admins can upload site media" on storage.objects;
create policy "Admins can upload site media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-media' and private.is_site_admin());

drop policy if exists "Admins can update site media" on storage.objects;
create policy "Admins can update site media"
on storage.objects for update
to authenticated
using (bucket_id = 'site-media' and private.is_site_admin())
with check (bucket_id = 'site-media' and private.is_site_admin());

drop policy if exists "Admins can delete site media" on storage.objects;
create policy "Admins can delete site media"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-media' and private.is_site_admin());

drop function if exists public.is_site_admin();
