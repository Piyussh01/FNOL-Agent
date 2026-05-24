-- Replace the 0007 trigger so every brand-new policyholder gets ALL THREE
-- policy kinds (auto + home + renters) — not just auto. Demo flows for any
-- claim kind work for any signed-in email without per-account setup.
--
-- Seeded users (0004) and prior auto-only signups (0007) already have at
-- least one policy; the `not exists` guard per-kind makes this idempotent
-- and additive — it backfills missing kinds without duplicating existing
-- rows on next sign-in.
--
-- Forward-only: do not edit 0007 in place. This file supersedes it.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_suffix text;
  v_auto_policy_id uuid;
  v_home_policy_id uuid;
  v_renters_policy_id uuid;
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

  v_suffix := upper(substr(replace(v_user_id::text, '-', ''), 1, 8));

  -- 2a) AUTO policy + vehicle.
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'auto'
  ) then
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
    returning id into v_auto_policy_id;

    insert into public.vehicles (policy_id, vin, make, model, year, plate)
    values (
      v_auto_policy_id,
      'DEMO' || v_suffix || '0000000',
      'Honda',
      'Civic',
      2022,
      'DEMO' || substr(v_suffix, 1, 3)
    )
    on conflict (vin) do nothing;
  end if;

  -- 2b) HOME policy + property.
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'home'
  ) then
    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-HOME-' || v_suffix,
      v_user_id,
      'home',
      'CA',
      '{
        "deductibles": {"all_peril": 1000, "wind_hail": 2500},
        "limits": {
          "dwelling": 500000,
          "other_structures": 50000,
          "personal_property": 250000,
          "loss_of_use": 100000,
          "liability": 300000
        },
        "perils": {
          "fire": true, "theft": true, "vandalism": true,
          "wind": true, "hail": true, "lightning": true,
          "water_sudden": true, "flood": false, "earthquake": false
        }
      }'::jsonb,
      current_date,
      current_date + interval '1 year'
    )
    returning id into v_home_policy_id;

    insert into public.properties (policy_id, address_json, property_type, year_built)
    values (
      v_home_policy_id,
      '{"street":"123 Demo Lane","city":"San Francisco","state":"CA","zip":"94110"}'::jsonb,
      'single_family',
      1985
    );
  end if;

  -- 2c) RENTERS policy + property.
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'renters'
  ) then
    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-RENT-' || v_suffix,
      v_user_id,
      'renters',
      'CA',
      '{
        "deductibles": {"all_peril": 250},
        "limits": {
          "personal_property": 50000,
          "liability": 100000,
          "loss_of_use": 10000
        },
        "perils": {
          "theft": true, "fire": true, "vandalism": true,
          "water_sudden": true, "flood": false, "earthquake": false
        }
      }'::jsonb,
      current_date,
      current_date + interval '1 year'
    )
    returning id into v_renters_policy_id;

    insert into public.properties (policy_id, address_json, property_type, year_built)
    values (
      v_renters_policy_id,
      '{"street":"500 Demo Ave Apt 4B","city":"San Francisco","state":"CA","zip":"94105"}'::jsonb,
      'apartment',
      2005
    );
  end if;

  return new;
end;
$$;

-- Backfill: any existing user who is missing a kind gets it attached now,
-- so accounts created under the 0007 (auto-only) trigger become demo-ready
-- without requiring sign-out / sign-in.
do $$
declare
  r record;
  v_suffix text;
  v_policy_id uuid;
begin
  for r in select id from public.users loop
    v_suffix := upper(substr(replace(r.id::text, '-', ''), 1, 8));

    if not exists (
      select 1 from public.policies
      where holder_user_id = r.id and kind = 'home'
    ) then
      insert into public.policies (
        policy_number, holder_user_id, kind, state, coverage_json,
        active_from, active_to
      )
      values (
        'ACME-HOME-' || v_suffix,
        r.id,
        'home',
        'CA',
        '{
          "deductibles": {"all_peril": 1000, "wind_hail": 2500},
          "limits": {
            "dwelling": 500000,
            "other_structures": 50000,
            "personal_property": 250000,
            "loss_of_use": 100000,
            "liability": 300000
          },
          "perils": {
            "fire": true, "theft": true, "vandalism": true,
            "wind": true, "hail": true, "lightning": true,
            "water_sudden": true, "flood": false, "earthquake": false
          }
        }'::jsonb,
        current_date,
        current_date + interval '1 year'
      )
      on conflict (policy_number) do nothing
      returning id into v_policy_id;

      if v_policy_id is not null then
        insert into public.properties (policy_id, address_json, property_type, year_built)
        values (
          v_policy_id,
          '{"street":"123 Demo Lane","city":"San Francisco","state":"CA","zip":"94110"}'::jsonb,
          'single_family',
          1985
        );
      end if;
    end if;

    v_policy_id := null;

    if not exists (
      select 1 from public.policies
      where holder_user_id = r.id and kind = 'renters'
    ) then
      insert into public.policies (
        policy_number, holder_user_id, kind, state, coverage_json,
        active_from, active_to
      )
      values (
        'ACME-RENT-' || v_suffix,
        r.id,
        'renters',
        'CA',
        '{
          "deductibles": {"all_peril": 250},
          "limits": {
            "personal_property": 50000,
            "liability": 100000,
            "loss_of_use": 10000
          },
          "perils": {
            "theft": true, "fire": true, "vandalism": true,
            "water_sudden": true, "flood": false, "earthquake": false
          }
        }'::jsonb,
        current_date,
        current_date + interval '1 year'
      )
      on conflict (policy_number) do nothing
      returning id into v_policy_id;

      if v_policy_id is not null then
        insert into public.properties (policy_id, address_json, property_type, year_built)
        values (
          v_policy_id,
          '{"street":"500 Demo Ave Apt 4B","city":"San Francisco","state":"CA","zip":"94105"}'::jsonb,
          'apartment',
          2005
        );
      end if;
    end if;
  end loop;
end$$;
