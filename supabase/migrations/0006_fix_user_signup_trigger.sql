-- Forward-only fix: handle_new_auth_user collided with seeded users rows.
--
-- Seed rows (migration 0004) insert demo users by email with auth_id = NULL.
-- The previous trigger did INSERT ... ON CONFLICT (auth_id) DO NOTHING, which
-- did not catch the unique (email) collision and failed sign-in with
-- "Database error saving new user". This rewrite links the seed row when the
-- email already exists, otherwise inserts a fresh row.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set auth_id = new.id
   where email = new.email
     and auth_id is null;

  if not found then
    insert into public.users (auth_id, email, name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
    )
    on conflict (email) do update
      set auth_id = excluded.auth_id;
  end if;

  return new;
end;
$$;
