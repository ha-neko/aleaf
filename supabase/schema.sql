-- Dashboard alternative to the migration in supabase/migrations.
-- Run this in Supabase SQL Editor, then enroll the administrator separately
-- with supabase/enroll-admin.example.sql.

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
        select 1 from public.admin_users where user_id = (select auth.uid())
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

-- Moderated public interactions, private inbox, curated gallery, and visitor count.

create table public.guestbook_entries (
    id bigint generated always as identity primary key,
    display_name text not null,
    message text not null,
    approved boolean not null default false,
    created_at timestamptz not null default now(),
    moderated_at timestamptz,
    owner_reply text,
    replied_at timestamptz,
    constraint guestbook_display_name_valid check (
        display_name = btrim(display_name)
        and char_length(display_name) between 1 and 80
    ),
    constraint guestbook_message_valid check (
        message = btrim(message)
        and char_length(message) between 1 and 2000
    ),
    constraint guestbook_owner_reply_valid check (
        owner_reply is null
        or (
            owner_reply = pg_catalog.btrim(owner_reply)
            and pg_catalog.char_length(owner_reply) between 1 and 2000
        )
    )
);

create table public.inbox_messages (
    id bigint generated always as identity primary key,
    message text not null,
    is_read boolean not null default false,
    created_at timestamptz not null default now(),
    constraint inbox_message_valid check (
        message = btrim(message)
        and char_length(message) between 1 and 5000
    )
);

create table public.gallery_items (
    id bigint generated always as identity primary key,
    title text not null,
    alt_text text not null,
    caption text,
    storage_path text not null unique,
    public_url text not null,
    sort_order integer not null default 0,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint gallery_title_valid check (
        title = btrim(title)
        and char_length(title) between 1 and 160
    ),
    constraint gallery_alt_text_valid check (
        alt_text = btrim(alt_text)
        and char_length(alt_text) between 1 and 500
    ),
    constraint gallery_caption_valid check (
        caption is null
        or (caption = btrim(caption) and char_length(caption) between 1 and 2000)
    ),
    constraint gallery_storage_path_valid check (
        storage_path = btrim(storage_path)
        and char_length(storage_path) between 1 and 1024
        and storage_path !~ '(^|/)\.\.(/|$)'
        and storage_path !~ '^/'
    ),
    constraint gallery_public_url_valid check (
        public_url = btrim(public_url)
        and char_length(public_url) between 8 and 2048
        and public_url ~ '^https?://'
    )
);

create table public.hotbuttons (
    id bigint generated always as identity primary key,
    button_name text not null,
    site_url text not null,
    image_url text not null,
    note text,
    status text not null default 'pending',
    created_at timestamptz not null default pg_catalog.now(),
    moderated_at timestamptz,
    constraint hotbuttons_name_valid check (button_name = pg_catalog.btrim(button_name) and pg_catalog.char_length(button_name) between 1 and 80),
    constraint hotbuttons_site_url_valid check (site_url = pg_catalog.btrim(site_url) and pg_catalog.char_length(site_url) between 8 and 2048 and site_url operator(pg_catalog.~) '^https?://[^[:space:]]+$'),
    constraint hotbuttons_image_url_valid check (image_url = pg_catalog.btrim(image_url) and pg_catalog.char_length(image_url) between 8 and 2048 and image_url operator(pg_catalog.~) '^https?://[^[:space:]]+$'),
    constraint hotbuttons_note_valid check (note is null or (note = pg_catalog.btrim(note) and pg_catalog.char_length(note) between 1 and 300)),
    constraint hotbuttons_status_valid check (status in ('pending', 'approved', 'rejected')),
    constraint hotbuttons_moderation_valid check ((status = 'pending' and moderated_at is null) or (status in ('approved', 'rejected') and moderated_at is not null))
);

create index hotbuttons_status_created_at_idx on public.hotbuttons (status, created_at desc);

create table private.site_visitor_ips (
    ip_hash text primary key,
    first_seen_at timestamptz not null default pg_catalog.now(),
    constraint site_visitor_ip_hash_valid check (
        ip_hash operator(pg_catalog.~) '^[0-9a-f]{64}$'
    )
);

create table private.guestbook_captcha_challenges (
    challenge_id uuid primary key,
    expected_tokens uuid[] not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default pg_catalog.now(),
    constraint guestbook_captcha_expected_tokens_valid check (
        pg_catalog.cardinality(expected_tokens) = 3
    )
);

create index guestbook_captcha_challenges_expires_at_idx
on private.guestbook_captcha_challenges (expires_at);

alter table public.guestbook_entries enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.gallery_items enable row level security;
alter table public.hotbuttons enable row level security;
alter table private.site_visitor_ips enable row level security;
alter table private.guestbook_captcha_challenges enable row level security;

revoke all on table public.guestbook_entries from public, anon, authenticated;
revoke all on table public.inbox_messages from public, anon, authenticated;
revoke all on table public.gallery_items from public, anon, authenticated;
revoke all on table public.hotbuttons from public, anon, authenticated;
revoke all on table private.site_visitor_ips from public, anon, authenticated, service_role;
revoke all on table private.guestbook_captcha_challenges from public, anon, authenticated, service_role;
revoke all on sequence public.guestbook_entries_id_seq from public, anon, authenticated;
revoke all on sequence public.inbox_messages_id_seq from public, anon, authenticated;
revoke all on sequence public.gallery_items_id_seq from public, anon, authenticated;
revoke all on sequence public.hotbuttons_id_seq from public, anon, authenticated;

grant select on table public.guestbook_entries to anon, authenticated;
grant update, delete on table public.guestbook_entries to authenticated;
grant select, update, delete on table public.inbox_messages to authenticated;
grant select on table public.gallery_items to anon, authenticated;
grant insert, update, delete on table public.gallery_items to authenticated;
grant usage, select on sequence public.gallery_items_id_seq to authenticated;
grant select on table public.hotbuttons to anon, authenticated;
grant update, delete on table public.hotbuttons to authenticated;

create policy "Public can read approved guestbook entries"
on public.guestbook_entries for select
to anon, authenticated
using (approved);

create policy "Admins can read all guestbook entries"
on public.guestbook_entries for select
to authenticated
using (private.is_site_admin());

create policy "Admins can moderate guestbook entries"
on public.guestbook_entries for update
to authenticated
using (private.is_site_admin())
with check (private.is_site_admin());

create policy "Admins can delete guestbook entries"
on public.guestbook_entries for delete
to authenticated
using (private.is_site_admin());

create policy "Admins can read inbox messages"
on public.inbox_messages for select
to authenticated
using (private.is_site_admin());

create policy "Admins can delete inbox messages"
on public.inbox_messages for delete
to authenticated
using (private.is_site_admin());

create policy "Admins can update inbox messages"
on public.inbox_messages for update
to authenticated
using (private.is_site_admin())
with check (private.is_site_admin());

create policy "Public can read published gallery items"
on public.gallery_items for select
to anon, authenticated
using (published);

create policy "Admins can read all gallery items"
on public.gallery_items for select
to authenticated
using (private.is_site_admin());

create policy "Admins can insert gallery items"
on public.gallery_items for insert
to authenticated
with check (private.is_site_admin());

create policy "Admins can update gallery items"
on public.gallery_items for update
to authenticated
using (private.is_site_admin())
with check (private.is_site_admin());

create policy "Admins can delete gallery items"
on public.gallery_items for delete
to authenticated
using (private.is_site_admin());

create policy "Public can read approved hotbuttons"
on public.hotbuttons for select
to anon, authenticated
using (status = 'approved');

create policy "Admins can read all hotbuttons"
on public.hotbuttons for select
to authenticated
using (private.is_site_admin());

create policy "Admins can moderate hotbuttons"
on public.hotbuttons for update
to authenticated
using (private.is_site_admin())
with check (private.is_site_admin());

create policy "Admins can delete hotbuttons"
on public.hotbuttons for delete
to authenticated
using (private.is_site_admin());

create function public.create_guestbook_captcha_challenge(
    p_expected_tokens uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_expected_tokens uuid[];
    v_challenge_id uuid := pg_catalog.gen_random_uuid();
    v_expires_at timestamptz := pg_catalog.clock_timestamp() + interval '5 minutes';
begin
    if p_expected_tokens is null
       or pg_catalog.cardinality(p_expected_tokens) <> 3
       or pg_catalog.array_position(p_expected_tokens, null::uuid) is not null
       or (select pg_catalog.count(distinct token)
           from pg_catalog.unnest(p_expected_tokens) as tokens(token)) <> 3 then
        raise exception using
            errcode = '22023',
            message = 'expected_tokens must contain exactly 3 distinct non-null UUIDs';
    end if;

    select pg_catalog.array_agg(token order by token)
    into v_expected_tokens
    from pg_catalog.unnest(p_expected_tokens) as tokens(token);

    delete from private.guestbook_captcha_challenges
    where expires_at <= pg_catalog.clock_timestamp();

    insert into private.guestbook_captcha_challenges (
        challenge_id,
        expected_tokens,
        expires_at
    )
    values (v_challenge_id, v_expected_tokens, v_expires_at);

    return pg_catalog.jsonb_build_object(
        'challenge_id', v_challenge_id,
        'expires_at', v_expires_at
    );
end;
$$;

create function public.submit_guestbook_entry(
    p_display_name text,
    p_message text,
    p_challenge_id uuid,
    p_selected_tokens uuid[]
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_display_name text := pg_catalog.btrim(p_display_name);
    v_message text := pg_catalog.btrim(p_message);
    v_expected_tokens uuid[];
    v_expires_at timestamptz;
    v_normalized_expected uuid[];
    v_normalized_selected uuid[];
    v_id bigint;
begin
    delete from private.guestbook_captcha_challenges
    where challenge_id = p_challenge_id
    returning expected_tokens, expires_at
    into v_expected_tokens, v_expires_at;

    if not found or v_expires_at <= pg_catalog.clock_timestamp() then
        return null;
    end if;

    select coalesce(pg_catalog.array_agg(token order by token), '{}'::uuid[])
    into v_normalized_expected
    from (select distinct token from pg_catalog.unnest(v_expected_tokens) as tokens(token)) normalized;

    select coalesce(pg_catalog.array_agg(token order by token), '{}'::uuid[])
    into v_normalized_selected
    from (select distinct token from pg_catalog.unnest(p_selected_tokens) as tokens(token)) normalized;

    if v_normalized_selected <> v_normalized_expected then
        return null;
    end if;

    if v_display_name is null
       or pg_catalog.char_length(v_display_name) not between 1 and 40 then
        return null;
    end if;

    if v_message is null
       or pg_catalog.char_length(v_message) not between 2 and 500 then
        return null;
    end if;

    insert into public.guestbook_entries (display_name, message, approved)
    values (v_display_name, v_message, false)
    returning id into v_id;

    return v_id;
end;
$$;

create function public.submit_inbox_message(p_body text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_message text := pg_catalog.btrim(p_body);
    v_id bigint;
begin
    if v_message is null
       or pg_catalog.char_length(v_message) not between 1 and 5000 then
        raise exception using errcode = '22023', message = 'message must be between 1 and 5000 characters';
    end if;

    insert into public.inbox_messages (message)
    values (v_message)
    returning id into v_id;

    return v_id;
end;
$$;

create function public.submit_hotbutton(
    p_button_name text,
    p_site_url text,
    p_image_url text,
    p_note text default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_button_name text := pg_catalog.btrim(p_button_name);
    v_site_url text := pg_catalog.btrim(p_site_url);
    v_image_url text := pg_catalog.btrim(p_image_url);
    v_note text := nullif(pg_catalog.btrim(p_note), '');
    v_id bigint;
begin
    if v_button_name is null or pg_catalog.char_length(v_button_name) not between 1 and 80 then
        raise exception using errcode = '22023', message = 'button_name must be between 1 and 80 characters';
    end if;
    if v_site_url is null or pg_catalog.char_length(v_site_url) not between 8 and 2048 or v_site_url operator(pg_catalog.!~) '^https?://[^[:space:]]+$' then
        raise exception using errcode = '22023', message = 'site_url must be a valid HTTP or HTTPS URL';
    end if;
    if v_image_url is null or pg_catalog.char_length(v_image_url) not between 8 and 2048 or v_image_url operator(pg_catalog.!~) '^https?://[^[:space:]]+$' then
        raise exception using errcode = '22023', message = 'image_url must be a valid HTTP or HTTPS URL';
    end if;
    if v_note is not null and pg_catalog.char_length(v_note) > 300 then
        raise exception using errcode = '22023', message = 'note must not exceed 300 characters';
    end if;
    insert into public.hotbuttons (button_name, site_url, image_url, note)
    values (v_button_name, v_site_url, v_image_url, v_note)
    returning id into v_id;
    return v_id;
end;
$$;

create function public.record_ip_visit(p_ip_hash text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_total bigint;
begin
    if p_ip_hash is null
       or p_ip_hash operator(pg_catalog.!~) '^[0-9a-f]{64}$' then
        raise exception using errcode = '22023', message = 'ip_hash must be a lowercase SHA-256 hex digest';
    end if;

    insert into private.site_visitor_ips (ip_hash)
    values (p_ip_hash)
    on conflict (ip_hash) do nothing;

    select pg_catalog.count(*)
    into v_total
    from private.site_visitor_ips;

    return v_total;
end;
$$;

create function public.get_total_visitors()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select pg_catalog.count(*) from private.site_visitor_ips;
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select private.is_site_admin();
$$;

revoke all on function public.create_guestbook_captcha_challenge(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.submit_guestbook_entry(text, text, uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.submit_inbox_message(text) from public, anon, authenticated, service_role;
revoke all on function public.submit_hotbutton(text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.record_ip_visit(text) from public, anon, authenticated, service_role;
revoke all on function public.get_total_visitors() from public, anon, authenticated, service_role;
revoke all on function public.is_current_user_admin() from public;

grant execute on function public.create_guestbook_captcha_challenge(uuid[]) to service_role;
grant execute on function public.submit_guestbook_entry(text, text, uuid, uuid[]) to anon, authenticated;
grant execute on function public.submit_inbox_message(text) to anon, authenticated;
grant execute on function public.submit_hotbutton(text, text, text, text) to anon, authenticated;
grant execute on function public.record_ip_visit(text) to service_role;
grant execute on function public.get_total_visitors() to anon, authenticated;
grant execute on function public.is_current_user_admin() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'gallery-media',
    'gallery-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can read gallery media"
on storage.objects for select
to authenticated
using (bucket_id = 'gallery-media' and private.is_site_admin());

create policy "Admins can upload gallery media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery-media' and private.is_site_admin());

create policy "Admins can update gallery media"
on storage.objects for update
to authenticated
using (bucket_id = 'gallery-media' and private.is_site_admin())
with check (bucket_id = 'gallery-media' and private.is_site_admin());

create policy "Admins can delete gallery media"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery-media' and private.is_site_admin());
