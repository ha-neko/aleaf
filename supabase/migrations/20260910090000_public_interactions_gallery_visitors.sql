-- Moderated public interactions, private inbox, curated gallery, and visitor count.

create table public.guestbook_entries (
    id bigint generated always as identity primary key,
    display_name text not null,
    message text not null,
    approved boolean not null default false,
    created_at timestamptz not null default now(),
    moderated_at timestamptz,
    constraint guestbook_display_name_valid check (
        display_name = btrim(display_name)
        and char_length(display_name) between 1 and 80
    ),
    constraint guestbook_message_valid check (
        message = btrim(message)
        and char_length(message) between 1 and 2000
    )
);

create table public.inbox_messages (
    id bigint generated always as identity primary key,
    sender_name text not null,
    reply_contact text,
    message text not null,
    is_read boolean not null default false,
    created_at timestamptz not null default now(),
    constraint inbox_sender_name_valid check (
        sender_name = btrim(sender_name)
        and char_length(sender_name) between 1 and 80
    ),
    constraint inbox_reply_contact_valid check (
        reply_contact is null
        or (reply_contact = btrim(reply_contact) and char_length(reply_contact) between 1 and 320)
    ),
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

create table private.site_visitors (
    visitor_id uuid primary key,
    first_seen_at timestamptz not null default now(),
    constraint visitor_id_not_nil check (visitor_id <> '00000000-0000-0000-0000-000000000000'::uuid)
);

alter table public.guestbook_entries enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.gallery_items enable row level security;
alter table private.site_visitors enable row level security;

revoke all on table public.guestbook_entries from public, anon, authenticated;
revoke all on table public.inbox_messages from public, anon, authenticated;
revoke all on table public.gallery_items from public, anon, authenticated;
revoke all on table private.site_visitors from public, anon, authenticated;
revoke all on sequence public.guestbook_entries_id_seq from public, anon, authenticated;
revoke all on sequence public.inbox_messages_id_seq from public, anon, authenticated;
revoke all on sequence public.gallery_items_id_seq from public, anon, authenticated;

grant select on table public.guestbook_entries to anon, authenticated;
grant update, delete on table public.guestbook_entries to authenticated;
grant select, update, delete on table public.inbox_messages to authenticated;
grant select on table public.gallery_items to anon, authenticated;
grant insert, update, delete on table public.gallery_items to authenticated;
grant usage, select on sequence public.gallery_items_id_seq to authenticated;

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

create or replace function public.submit_guestbook_entry(
    p_display_name text,
    p_message text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_display_name text := btrim(p_display_name);
    v_message text := btrim(p_message);
    v_id bigint;
begin
    if v_display_name is null or char_length(v_display_name) not between 1 and 80 then
        raise exception using errcode = '22023', message = 'display_name must be between 1 and 80 characters';
    end if;

    if v_message is null or char_length(v_message) not between 1 and 2000 then
        raise exception using errcode = '22023', message = 'message must be between 1 and 2000 characters';
    end if;

    insert into public.guestbook_entries (display_name, message)
    values (v_display_name, v_message)
    returning id into v_id;

    return v_id;
end;
$$;

create or replace function public.submit_inbox_message(
    p_sender_name text,
    p_reply_contact text,
    p_body text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_sender_name text := btrim(p_sender_name);
    v_reply_contact text := nullif(btrim(p_reply_contact), '');
    v_message text := btrim(p_body);
    v_id bigint;
begin
    if v_sender_name is null or char_length(v_sender_name) not between 1 and 80 then
        raise exception using errcode = '22023', message = 'sender_name must be between 1 and 80 characters';
    end if;

    if v_reply_contact is not null and char_length(v_reply_contact) not between 1 and 320 then
        raise exception using errcode = '22023', message = 'reply_contact must be at most 320 characters';
    end if;

    if v_message is null or char_length(v_message) not between 1 and 5000 then
        raise exception using errcode = '22023', message = 'message must be between 1 and 5000 characters';
    end if;

    insert into public.inbox_messages (sender_name, reply_contact, message)
    values (v_sender_name, v_reply_contact, v_message)
    returning id into v_id;

    return v_id;
end;
$$;

create or replace function public.record_visit(p_visitor_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_total bigint;
begin
    if p_visitor_id is null or p_visitor_id = '00000000-0000-0000-0000-000000000000'::uuid then
        raise exception using errcode = '22023', message = 'visitor_id must be a non-nil UUID';
    end if;

    insert into private.site_visitors (visitor_id)
    values (p_visitor_id)
    on conflict (visitor_id) do nothing;

    select count(*) into v_total from private.site_visitors;
    return v_total;
end;
$$;

create or replace function public.get_total_visitors()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select count(*) from private.site_visitors;
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

revoke all on function public.submit_guestbook_entry(text, text) from public;
revoke all on function public.submit_inbox_message(text, text, text) from public;
revoke all on function public.record_visit(uuid) from public;
revoke all on function public.get_total_visitors() from public;
revoke all on function public.is_current_user_admin() from public;

grant execute on function public.submit_guestbook_entry(text, text) to anon, authenticated;
grant execute on function public.submit_inbox_message(text, text, text) to anon, authenticated;
grant execute on function public.record_visit(uuid) to anon, authenticated;
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
