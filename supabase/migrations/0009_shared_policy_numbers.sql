-- Make policy numbers demo-friendly and shared across every signed-in user.
--
-- Why: the 0007/0008 triggers derived policy_number from the user uuid
-- (`ACME-AUTO-60B4BED6` etc.). That was unique per user but unmemorable
-- and unspeakable mid-demo. We want every brand-new account to land with
-- `ACME-AUTO-1001`, `ACME-HOME-1001`, `ACME-RENT-1001` so the user can
-- simply say "my auto policy" and resolve unambiguously within their own
-- account.
--
-- This requires dropping the unique constraint on policies.policy_number
-- (multiple users will share the same number). All tool handlers already
-- scope policy lookups by `holder_user_id = ctx.caller.user_id`, so the
-- collapse is safe.

-- 1) Drop unique constraint. Keep the underlying index for lookup speed.
alter table policies drop constraint if exists policies_policy_number_key;
create index if not exists policies_policy_number_idx on policies (policy_number);

-- 2) Renumber existing trigger-generated rows (8-hex-char uuid suffix
--    format) to the stable 1001 number. Seeded rows from 0004
--    (`ACME-AUTO-1001` for Maya, `ACME-HOME-2001` for Daniel, etc.) keep
--    their original numbers — the regex only matches the auto-generated
--    hex-suffix format.
update policies
   set policy_number = 'ACME-AUTO-1001'
 where kind = 'auto'
   and policy_number ~ '^ACME-AUTO-[0-9A-F]{8}$';

update policies
   set policy_number = 'ACME-HOME-1001'
 where kind = 'home'
   and policy_number ~ '^ACME-HOME-[0-9A-F]{8}$';

update policies
   set policy_number = 'ACME-RENT-1001'
 where kind = 'renters'
   and policy_number ~ '^ACME-RENT-[0-9A-F]{8}$';

-- 3) Replace the trigger so all NEW signups get the shared 1001 numbers.
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
  -- Link or create the public.users row for this auth.users insert.
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

  -- Vehicle VIN still needs to be globally unique; derive from uuid.
  v_suffix := upper(substr(replace(v_user_id::text, '-', ''), 1, 8));

  -- AUTO
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'auto'
  ) then
    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-AUTO-1001',
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
          "collision": true, "comprehensive": true, "vandalism": true,
          "theft": true, "weather": true, "fire": true
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

  -- HOME
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'home'
  ) then
    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-HOME-1001',
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

  -- RENTERS
  if not exists (
    select 1 from public.policies
    where holder_user_id = v_user_id and kind = 'renters'
  ) then
    insert into public.policies (
      policy_number, holder_user_id, kind, state, coverage_json,
      active_from, active_to
    )
    values (
      'ACME-RENT-1001',
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
