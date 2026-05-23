-- Row Level Security. Enable on every table, then per-table policies.
-- Service role bypasses RLS; tool handlers re-verify caller against
-- claim.user_id before service-role bypass.

alter table users           enable row level security;
alter table policies        enable row level security;
alter table vehicles        enable row level security;
alter table properties      enable row level security;
alter table claims          enable row level security;
alter table claim_parties   enable row level security;
alter table photos          enable row level security;
alter table sessions        enable row level security;
alter table messages        enable row level security;
alter table events          enable row level security;
alter table tasks           enable row level security;
alter table repair_shops    enable row level security;

-- Helper: current user's users.id (NULL if anon).
create or replace function public.current_user_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from users where auth_id = auth.uid() limit 1;
$$;

-- USERS: row visible only to its owner.
create policy users_select_self on users
  for select using (auth_id = auth.uid());

create policy users_update_self on users
  for update using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- POLICIES: visible if holder is current user.
create policy policies_select_holder on policies
  for select using (holder_user_id = public.current_user_id());

-- VEHICLES + PROPERTIES: visible via parent policy.
create policy vehicles_select_via_policy on vehicles
  for select using (
    exists (
      select 1 from policies p
      where p.id = vehicles.policy_id
        and p.holder_user_id = public.current_user_id()
    )
  );

create policy properties_select_via_policy on properties
  for select using (
    exists (
      select 1 from policies p
      where p.id = properties.policy_id
        and p.holder_user_id = public.current_user_id()
    )
  );

-- CLAIMS: visible if user_id matches current user.
create policy claims_select_owner on claims
  for select using (user_id = public.current_user_id());

create policy claims_insert_owner on claims
  for insert with check (user_id = public.current_user_id());

create policy claims_update_owner on claims
  for update using (user_id = public.current_user_id());

-- CLAIM_PARTIES, PHOTOS: visible if owning claim is visible.
create policy claim_parties_select_via_claim on claim_parties
  for select using (
    exists (
      select 1 from claims c
      where c.id = claim_parties.claim_id
        and c.user_id = public.current_user_id()
    )
  );

create policy photos_select_via_claim on photos
  for select using (
    exists (
      select 1 from claims c
      where c.id = photos.claim_id
        and c.user_id = public.current_user_id()
    )
  );

create policy photos_insert_via_claim on photos
  for insert with check (
    exists (
      select 1 from claims c
      where c.id = photos.claim_id
        and c.user_id = public.current_user_id()
    )
  );

-- SESSIONS, MESSAGES: owner-scoped.
create policy sessions_select_owner on sessions
  for select using (user_id = public.current_user_id());

create policy messages_select_via_claim on messages
  for select using (
    exists (
      select 1 from claims c
      where c.id = messages.claim_id
        and c.user_id = public.current_user_id()
    )
  );

-- TASKS: visible via claim.
create policy tasks_select_via_claim on tasks
  for select using (
    exists (
      select 1 from claims c
      where c.id = tasks.claim_id
        and c.user_id = public.current_user_id()
    )
  );

-- EVENTS: write open to authenticated within scope; read only via service role.
-- (We rely on service role for reads from /admin; the policy below denies
-- general selects via authenticated role.)
create policy events_insert_via_claim on events
  for insert with check (
    claim_id is null or exists (
      select 1 from claims c
      where c.id = events.claim_id
        and c.user_id = public.current_user_id()
    )
  );
-- No select policy for authenticated → reads forbidden. Service role bypass.

-- REPAIR_SHOPS: select-all for authenticated (directory data).
create policy repair_shops_select_authenticated on repair_shops
  for select to authenticated using (true);
