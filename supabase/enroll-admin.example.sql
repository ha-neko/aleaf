-- Run this once in the hosted SQL Editor after creating the auth user.
-- Replace the email before running. This file is not executed by db push.

do $$
declare
    target_user_id uuid;
begin
    select id into target_user_id
    from auth.users
    where lower(email) = lower('admin@example.com')
    limit 1;

    if target_user_id is null then
        raise exception 'No authentication user exists for that email';
    end if;

    insert into public.admin_users (user_id)
    values (target_user_id)
    on conflict (user_id) do nothing;
end;
$$;
