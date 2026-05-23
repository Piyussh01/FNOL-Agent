-- Give every brand-new policyholder a default auto policy + vehicle so the
-- demo end-to-end flow works for accounts that aren't in the 0004 seed.
--
-- Without this, a newly signed-in user has no row in `policies`, and Sam's
-- `verify_identity` tool returns verified=false → he cannot advance past the
-- Verify stage. With this trigger, every new user can immediately file an
-- auto claim against a deterministic placeholder policy. The policy_number
-- is derived from the user uuid so it's stable and unique without a sequence.
--
-- Seeded users (Maya/Daniel/Sofia) already have policies attached by
-- migration 0004, so the `not exists` guard prevents double-attaching.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_policy_id uuid;
  v_suffix text;
begin
  -- 1) Link or create the public.users row for this auth.users insert.
  update public.users
     set auth_id = new.id
   where email = new.email
     and auth_id is null
   returning id into v_user_id;

  if v_user_id is null then
    insert into public.users (auth_id, email, name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
    )
    on conflict (email) do update
      set auth_id = excluded.auth_id
    returning id into v_user_id;
  end if;

  -- 2) If this user has no policies yet, give them a default auto policy.
  if not exists (select 1 from public.policies where holder_user_id = v_user_id) then
    v_suffix := upper(substr(replace(v_user_id::text, '-', ''), 1, 8));

    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-AUTO-' || v_suffix,
      v_user_id,
      'auto',
      'CA',
      '{
        "deductibles": {"collision": 500, "comprehensive": 250},
        "limits": {
          "liability_bodily": 100000,
          "liability_property": 50000,
          "uninsured": 100000
        },
        "perils": {
          "collision": true,
          "comprehensive": true,
          "vandalism": true,
          "theft": true,
          "weather": true,
          "fire": true
        },
        "rental_reimbursement": {"daily_cap_usd": 40, "max_days": 30}
      }'::jsonb,
      current_date,
      current_date + interval '1 year'
    )
    returning id into v_policy_id;

    -- Default vehicle so Sam has something concrete to reference.
    insert into public.vehicles (policy_id, vin, make, model, year, plate)
    values (
      v_policy_id,
      'DEMO' || v_suffix || '0000000',
      'Honda',
      'Civic',
      2022,
      'DEMO' || substr(v_suffix, 1, 3)
    )
    on conflict (vin) do nothing;
  end if;

  return new;
end;
$$;
