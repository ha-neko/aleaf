-- Run this in Supabase SQL Editor after creating the administrator in
-- Authentication > Users. Replace the UUID near the bottom before running.

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

alter table public.admin_users enable row level security;
alter table public.site_content enable row level security;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.admin_users where user_id = auth.uid()
    );
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
on public.site_content for select
to anon, authenticated
using (id = 'main');

drop policy if exists "Admins can insert site content" on public.site_content;
create policy "Admins can insert site content"
on public.site_content for insert
to authenticated
with check (public.is_site_admin() and id = 'main');

drop policy if exists "Admins can update site content" on public.site_content;
create policy "Admins can update site content"
on public.site_content for update
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin() and id = 'main');

insert into public.site_content (id, content)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Replace this value with the UUID shown in Authentication > Users.
insert into public.admin_users (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict (user_id) do nothing;

-- Public media bucket. Uploads and changes are restricted to the administrator.
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
with check (bucket_id = 'site-media' and public.is_site_admin());

drop policy if exists "Admins can update site media" on storage.objects;
create policy "Admins can update site media"
on storage.objects for update
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin())
with check (bucket_id = 'site-media' and public.is_site_admin());

drop policy if exists "Admins can delete site media" on storage.objects;
create policy "Admins can delete site media"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-media' and public.is_site_admin());
