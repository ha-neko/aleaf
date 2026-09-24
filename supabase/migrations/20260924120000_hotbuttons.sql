-- Moderated visitor-submitted 88x31 website buttons.

create table public.hotbuttons (
    id bigint generated always as identity primary key,
    button_name text not null,
    site_url text not null,
    image_url text not null,
    note text,
    status text not null default 'pending',
    created_at timestamptz not null default pg_catalog.now(),
    moderated_at timestamptz,
    constraint hotbuttons_name_valid check (
        button_name = pg_catalog.btrim(button_name)
        and pg_catalog.char_length(button_name) between 1 and 80
    ),
    constraint hotbuttons_site_url_valid check (
        site_url = pg_catalog.btrim(site_url)
        and pg_catalog.char_length(site_url) between 8 and 2048
        and site_url operator(pg_catalog.~) '^https?://[^[:space:]]+$'
    ),
    constraint hotbuttons_image_url_valid check (
        image_url = pg_catalog.btrim(image_url)
        and pg_catalog.char_length(image_url) between 8 and 2048
        and image_url operator(pg_catalog.~) '^https?://[^[:space:]]+$'
    ),
    constraint hotbuttons_note_valid check (
        note is null
        or (
            note = pg_catalog.btrim(note)
            and pg_catalog.char_length(note) between 1 and 300
        )
    ),
    constraint hotbuttons_status_valid check (
        status in ('pending', 'approved', 'rejected')
    ),
    constraint hotbuttons_moderation_valid check (
        (status = 'pending' and moderated_at is null)
        or (status in ('approved', 'rejected') and moderated_at is not null)
    )
);

create index hotbuttons_status_created_at_idx
on public.hotbuttons (status, created_at desc);

alter table public.hotbuttons enable row level security;

revoke all on table public.hotbuttons from public, anon, authenticated;
revoke all on sequence public.hotbuttons_id_seq from public, anon, authenticated;

grant select on table public.hotbuttons to anon, authenticated;
grant update, delete on table public.hotbuttons to authenticated;

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
    if v_button_name is null
       or pg_catalog.char_length(v_button_name) not between 1 and 80 then
        raise exception using errcode = '22023', message = 'button_name must be between 1 and 80 characters';
    end if;

    if v_site_url is null
       or pg_catalog.char_length(v_site_url) not between 8 and 2048
       or v_site_url operator(pg_catalog.!~) '^https?://[^[:space:]]+$' then
        raise exception using errcode = '22023', message = 'site_url must be a valid HTTP or HTTPS URL';
    end if;

    if v_image_url is null
       or pg_catalog.char_length(v_image_url) not between 8 and 2048
       or v_image_url operator(pg_catalog.!~) '^https?://[^[:space:]]+$' then
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

revoke all on function public.submit_hotbutton(text, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.submit_hotbutton(text, text, text, text)
to anon, authenticated;
