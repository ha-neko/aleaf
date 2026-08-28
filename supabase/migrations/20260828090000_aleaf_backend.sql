-- Aleaf public content, administrator authorization, and media storage.

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.site_content (
    id text primary key,
    content jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint site_content_main_only check (id = 'main')
);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.admin_users enable row level security;
alter table public.site_content enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.site_content to anon, authenticated;
grant insert, update on table public.site_content to authenticated;

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

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
on public.site_content for select
to anon, authenticated
using (id = 'main');

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

insert into public.site_content (id, content)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-media',
    'site-media',
    true,
    10485760,
    array['image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/ogg']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
