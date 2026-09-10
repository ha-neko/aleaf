-- Server-validated, one-use image captcha for guestbook submissions.

create table private.guestbook_captcha_catalog (
    asset_path text primary key,
    is_mizuki boolean not null,
    constraint guestbook_captcha_asset_path_valid check (
        asset_path ~ '^captcha/c0[1-9]\.jpg$'
    )
);

create table private.guestbook_captcha_challenges (
    challenge_id uuid primary key,
    expected_tokens uuid[] not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default pg_catalog.now(),
    constraint guestbook_captcha_expected_tokens_valid check (
        pg_catalog.cardinality(expected_tokens) = 2
    )
);

create index guestbook_captcha_challenges_expires_at_idx
on private.guestbook_captcha_challenges (expires_at);

alter table private.guestbook_captcha_catalog enable row level security;
alter table private.guestbook_captcha_challenges enable row level security;

revoke all on table private.guestbook_captcha_catalog from public, anon, authenticated, service_role;
revoke all on table private.guestbook_captcha_challenges from public, anon, authenticated, service_role;

insert into private.guestbook_captcha_catalog (asset_path, is_mizuki)
values
    ('captcha/c01.jpg', true),
    ('captcha/c02.jpg', false),
    ('captcha/c03.jpg', true),
    ('captcha/c04.jpg', false),
    ('captcha/c05.jpg', false),
    ('captcha/c06.jpg', true),
    ('captcha/c07.jpg', false),
    ('captcha/c08.jpg', false),
    ('captcha/c09.jpg', false);

create function public.issue_guestbook_captcha()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    v_challenge_id uuid := pg_catalog.gen_random_uuid();
    v_expires_at timestamptz := pg_catalog.clock_timestamp() + interval '5 minutes';
    v_asset_paths text[];
    v_asset_path text;
    v_token uuid;
    v_expected_tokens uuid[] := '{}'::uuid[];
    v_choices jsonb := '[]'::jsonb;
begin
    delete from private.guestbook_captcha_challenges
    where expires_at <= pg_catalog.clock_timestamp();

    select pg_catalog.array_agg(selected.asset_path order by pg_catalog.random())
    into v_asset_paths
    from (
        (select asset_path
         from private.guestbook_captcha_catalog
         where is_mizuki
         order by pg_catalog.random()
         limit 2)
        union all
        (select asset_path
         from private.guestbook_captcha_catalog
         where not is_mizuki
         order by pg_catalog.random()
         limit 4)
    ) as selected;

    foreach v_asset_path in array v_asset_paths loop
        v_token := pg_catalog.gen_random_uuid();
        v_choices := v_choices || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'token', v_token,
                'asset_path', v_asset_path
            )
        );

        if (select is_mizuki
            from private.guestbook_captcha_catalog
            where asset_path = v_asset_path) then
            v_expected_tokens := pg_catalog.array_append(v_expected_tokens, v_token);
        end if;
    end loop;

    insert into private.guestbook_captcha_challenges (
        challenge_id,
        expected_tokens,
        expires_at
    )
    values (v_challenge_id, v_expected_tokens, v_expires_at);

    return pg_catalog.jsonb_build_object(
        'challenge_id', v_challenge_id,
        'expiry', v_expires_at,
        'choices', v_choices
    );
end;
$$;

revoke all on function public.issue_guestbook_captcha() from public, anon, authenticated, service_role;
grant execute on function public.issue_guestbook_captcha() to anon, authenticated;

revoke all on function public.submit_guestbook_entry(text, text) from public, anon, authenticated;
drop function public.submit_guestbook_entry(text, text);

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

revoke all on function public.submit_guestbook_entry(text, text, uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.submit_guestbook_entry(text, text, uuid, uuid[]) to anon, authenticated;
