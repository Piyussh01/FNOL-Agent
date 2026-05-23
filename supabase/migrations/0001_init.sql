-- FNOL schema. Run in dependency order: extensions → enums → tables.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type claim_kind as enum ('auto', 'home', 'renters');

create type claim_stage as enum (
  'greeting',
  'identifying',
  'verifying',
  'intake',
  'coverage_check',
  'photos',
  'assessing',
  'booking',
  'reviewing',
  'submitted',
  'escalated',
  'closed'
);

create type session_modality as enum ('video', 'chat', 'sms');

create type message_role as enum ('user', 'assistant', 'system', 'tool');

create type task_kind as enum (
  'tow',
  'rental',
  'repair',
  'adjuster_callback',
  'inspection',
  'emergency',
  'human_callback'
);

create type task_status as enum (
  'pending',
  'scheduled',
  'completed',
  'cancelled',
  'failed'
);

-- ============================================================================
-- USERS
-- ============================================================================

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  name text,
  email text unique,
  phone text,
  preferred_lang text not null default 'en' check (preferred_lang in ('en', 'es')),
  created_at timestamptz not null default now()
);

-- Auto-create users row when supabase auth creates auth.users row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- POLICIES + INSURED ASSETS
-- ============================================================================

create table policies (
  id uuid primary key default gen_random_uuid(),
  policy_number text unique not null,
  holder_user_id uuid not null references users(id) on delete cascade,
  kind claim_kind not null,
  state text not null,
  coverage_json jsonb not null,
  active_from date not null,
  active_to date not null,
  created_at timestamptz not null default now()
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  vin text unique,
  make text,
  model text,
  year int,
  plate text
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references policies(id) on delete cascade,
  address_json jsonb not null,
  property_type text check (
    property_type in ('single_family', 'condo', 'apartment', 'townhouse')
  ),
  year_built int
);

-- ============================================================================
-- CLAIMS
-- ============================================================================

create table claims (
  id uuid primary key default gen_random_uuid(),
  claim_number text generated always as (
    'CL-' || to_char(created_at, 'YYYY') || '-' || substr(id::text, 1, 8)
  ) stored,
  policy_id uuid references policies(id) on delete set null,
  user_id uuid not null references users(id) on delete cascade,
  kind claim_kind not null,
  stage claim_stage not null default 'greeting',
  status text not null default 'open',
  incident_at timestamptz,
  location geography(point, 4326),
  location_label text,
  details_json jsonb not null default '{}'::jsonb,
  estimate_range_low_usd int,
  estimate_range_high_usd int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger claims_set_updated_at
  before update on claims
  for each row execute function public.set_updated_at();

create table claim_parties (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  party_type text check (
    party_type in ('other_driver', 'witness', 'passenger', 'third_party')
  ),
  name text,
  contact text,
  insurance_json jsonb,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  storage_path text not null,
  kind text check (
    kind in (
      'four_corners', 'license_plate', 'damage_closeup',
      'property_overview', 'interior', 'inventory_item'
    )
  ),
  vision_json jsonb,
  uploaded_at timestamptz not null default now(),
  analyzed_at timestamptz
);

-- ============================================================================
-- SESSIONS + MESSAGES + EVENTS
-- ============================================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  modality session_modality not null,
  tavus_conversation_id text,
  distress_flagged boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  recording_url text
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  role message_role not null,
  channel session_modality not null,
  content text,
  tool_calls_json jsonb,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TASKS (booked partner services)
-- ============================================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  kind task_kind not null,
  status task_status not null default 'pending',
  partner_ref text,
  payload_json jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- REPAIR SHOPS (seed data for geo lookup)
-- ============================================================================

create table repair_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  location geography(point, 4326) not null,
  in_network boolean not null default true,
  rating numeric(2, 1),
  specialties text[]
);

-- ============================================================================
-- CLAIM STAGE-CHANGE EVENTS (audit trail)
-- ============================================================================

create or replace function public.log_claim_stage_change()
returns trigger language plpgsql as $$
begin
  if (old.stage is distinct from new.stage) then
    insert into events (claim_id, type, payload_json)
    values (
      new.id,
      'stage_change',
      jsonb_build_object('from', old.stage, 'to', new.stage)
    );
  end if;
  return new;
end;
$$;

create trigger claims_log_stage_change
  after update on claims
  for each row execute function public.log_claim_stage_change();
