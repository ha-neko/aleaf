-- Guestbook replies, one-way inbox submissions, and server-recorded IP-hash visits.

alter table public.guestbook_entries
add column owner_reply text,
add column replied_at timestamptz,
add constraint guestbook_owner_reply_valid check (
    owner_reply is null
    or (
        owner_reply = pg_catalog.btrim(owner_reply)
        and pg_catalog.char_length(owner_reply) between 1 and 2000
    )
);

revoke all on function public.submit_inbox_message(text, text, text)
from public, anon, authenticated, service_role;
drop function public.submit_inbox_message(text, text, text);

alter table public.inbox_messages
drop column if exists reply_contact;

create function public.submit_inbox_message(
    p_sender_name text,
    p_body text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_sender_name text := pg_catalog.btrim(p_sender_name);
    v_message text := pg_catalog.btrim(p_body);
    v_id bigint;
begin
    if v_sender_name is null
       or pg_catalog.char_length(v_sender_name) not between 1 and 80 then
        raise exception using errcode = '22023', message = 'sender_name must be between 1 and 80 characters';
    end if;

    if v_message is null
       or pg_catalog.char_length(v_message) not between 1 and 5000 then
        raise exception using errcode = '22023', message = 'message must be between 1 and 5000 characters';
    end if;

    insert into public.inbox_messages (sender_name, message)
    values (v_sender_name, v_message)
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.submit_inbox_message(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.submit_inbox_message(text, text) to anon, authenticated;

revoke all on function public.record_visit(uuid)
from public, anon, authenticated, service_role;
drop function public.record_visit(uuid);

revoke all on function public.get_total_visitors()
from public, anon, authenticated, service_role;
drop function public.get_total_visitors();

drop table private.site_visitors;

create table private.site_visitor_ips (
    ip_hash text primary key,
    first_seen_at timestamptz not null default pg_catalog.now(),
    constraint site_visitor_ip_hash_valid check (
        ip_hash operator(pg_catalog.~) '^[0-9a-f]{64}$'
    )
);

alter table private.site_visitor_ips enable row level security;
revoke all on table private.site_visitor_ips
from public, anon, authenticated, service_role;

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

revoke all on function public.record_ip_visit(text)
from public, anon, authenticated, service_role;
grant execute on function public.record_ip_visit(text) to service_role;

revoke all on function public.get_total_visitors()
from public, anon, authenticated, service_role;
grant execute on function public.get_total_visitors() to anon, authenticated;
