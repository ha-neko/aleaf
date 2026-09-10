-- Accept dynamic Edge-issued captcha tokens and anonymous inbox messages.

revoke all on function public.issue_guestbook_captcha()
from public, anon, authenticated, service_role;
drop function public.issue_guestbook_captcha();

drop table private.guestbook_captcha_catalog;

alter table private.guestbook_captcha_challenges
drop constraint guestbook_captcha_expected_tokens_valid;

delete from private.guestbook_captcha_challenges;

alter table private.guestbook_captcha_challenges
add constraint guestbook_captcha_expected_tokens_valid check (
    pg_catalog.cardinality(expected_tokens) = 3
);

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

revoke all on function public.create_guestbook_captcha_challenge(uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.create_guestbook_captcha_challenge(uuid[])
to service_role;

revoke all on function public.submit_inbox_message(text, text)
from public, anon, authenticated, service_role;
drop function public.submit_inbox_message(text, text);

alter table public.inbox_messages
drop column sender_name;

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

revoke all on function public.submit_inbox_message(text)
from public, anon, authenticated, service_role;
grant execute on function public.submit_inbox_message(text) to anon, authenticated;
