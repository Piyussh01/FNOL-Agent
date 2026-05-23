-- Seed data for demos. Real `users` are created on first magic-link login,
-- so we seed policy-holder records keyed on email — the user trigger fills
-- the gap when the seeded email signs in.

-- ============================================================================
-- DEMO USERS (placeholders; real rows created on first sign-in)
-- ============================================================================

insert into users (id, name, email, phone, preferred_lang)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Maya Rodriguez',
    'maya@example.com',
    '+15555550101',
    'en'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Daniel Park',
    'daniel@example.com',
    '+15555550102',
    'en'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Sofia García',
    'sofia@example.com',
    '+15555550103',
    'es'
  )
on conflict (id) do nothing;

-- ============================================================================
-- POLICIES
-- ============================================================================

insert into policies (id, policy_number, holder_user_id, kind, state, coverage_json, active_from, active_to)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'ACME-AUTO-1001',
    '11111111-1111-1111-1111-111111111111',
    'auto',
    'CA',
    '{
      "deductibles": {"collision": 500, "comprehensive": 250},
      "limits": {"liability_bodily": 250000, "liability_property": 100000, "uninsured": 100000},
      "perils": {
        "collision": true,
        "comprehensive": true,
        "vandalism": true,
        "theft": true,
        "weather": true,
        "fire": true
      },
      "rental_reimbursement": {"daily_cap_usd": 50, "max_days": 30}
    }'::jsonb,
    '2025-01-01',
    '2026-12-31'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ACME-HOME-2001',
    '22222222-2222-2222-2222-222222222222',
    'home',
    'CA',
    '{
      "deductibles": {"all_peril": 1000, "wind_hail": 2500},
      "limits": {"dwelling": 650000, "other_structures": 65000, "personal_property": 325000, "loss_of_use": 130000, "liability": 300000},
      "perils": {
        "fire": true, "theft": true, "vandalism": true, "wind": true, "hail": true,
        "lightning": true, "water_sudden": true, "flood": false, "earthquake": false
      }
    }'::jsonb,
    '2025-06-01',
    '2026-05-31'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'ACME-RENT-3001',
    '22222222-2222-2222-2222-222222222222',
    'renters',
    'CA',
    '{
      "deductibles": {"all_peril": 250},
      "limits": {"personal_property": 50000, "liability": 100000, "loss_of_use": 10000},
      "perils": {
        "theft": true, "fire": true, "vandalism": true, "water_sudden": true,
        "flood": false, "earthquake": false
      }
    }'::jsonb,
    '2025-03-01',
    '2026-02-28'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'ACME-RENT-3002',
    '33333333-3333-3333-3333-333333333333',
    'renters',
    'CA',
    '{
      "deductibles": {"all_peril": 500},
      "limits": {"personal_property": 35000, "liability": 100000, "loss_of_use": 7500},
      "perils": {"theft": true, "fire": true, "vandalism": true, "water_sudden": true}
    }'::jsonb,
    '2025-02-15',
    '2026-02-14'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ACME-AUTO-1002',
    '33333333-3333-3333-3333-333333333333',
    'auto',
    'CA',
    '{
      "deductibles": {"collision": 1000, "comprehensive": 500},
      "limits": {"liability_bodily": 100000, "liability_property": 50000},
      "perils": {"collision": true, "comprehensive": true, "vandalism": true, "theft": true}
    }'::jsonb,
    '2025-04-01',
    '2026-03-31'
  )
on conflict (id) do nothing;

-- ============================================================================
-- VEHICLES + PROPERTIES
-- ============================================================================

insert into vehicles (policy_id, vin, make, model, year, plate)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1HGCM82633A123456', 'Honda', 'Accord', 2019, '7ABC123'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '5YJ3E1EA9KF000316', 'Tesla',  'Model 3', 2020, '8XYZ456'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'JT2BF22K1W0123456', 'Toyota', 'Camry',   2017, '6QRS789')
on conflict (vin) do nothing;

insert into properties (policy_id, address_json, property_type, year_built)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '{"street":"742 Evergreen Ter","city":"San Francisco","state":"CA","zip":"94110"}',
    'single_family',
    1962
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{"street":"500 Market St Apt 12B","city":"San Francisco","state":"CA","zip":"94105"}',
    'apartment',
    1998
  );

-- ============================================================================
-- REPAIR SHOPS (15 within ~50mi of SF; lon/lat = -122.4194/37.7749)
-- ============================================================================

insert into repair_shops (name, address, phone, location, in_network, rating, specialties)
values
  ('Mission Auto Body',         '2100 Mission St, San Francisco, CA',     '+14155550201', st_setsrid(st_makepoint(-122.4194, 37.7634), 4326)::geography, true,  4.7, array['collision','paint']),
  ('Golden Gate Collision',     '1500 Geary Blvd, San Francisco, CA',     '+14155550202', st_setsrid(st_makepoint(-122.4310, 37.7846), 4326)::geography, true,  4.5, array['collision','frame']),
  ('SOMA AutoCare',             '300 Brannan St, San Francisco, CA',      '+14155550203', st_setsrid(st_makepoint(-122.3925, 37.7820), 4326)::geography, true,  4.8, array['mechanical','collision']),
  ('Sunset Auto Repair',        '2800 Judah St, San Francisco, CA',       '+14155550204', st_setsrid(st_makepoint(-122.4912, 37.7611), 4326)::geography, true,  4.4, array['mechanical']),
  ('Bayshore Body Works',       '5000 3rd St, San Francisco, CA',         '+14155550205', st_setsrid(st_makepoint(-122.3895, 37.7350), 4326)::geography, true,  4.6, array['collision']),
  ('Daly City Auto Body',       '6000 Mission St, Daly City, CA',         '+16505550206', st_setsrid(st_makepoint(-122.4660, 37.6879), 4326)::geography, true,  4.3, array['collision','paint']),
  ('Oakland Premier Collision', '500 Hegenberger Rd, Oakland, CA',        '+15105550207', st_setsrid(st_makepoint(-122.1972, 37.7345), 4326)::geography, true,  4.6, array['collision','paint','frame']),
  ('Berkeley Auto Specialists', '2000 University Ave, Berkeley, CA',      '+15105550208', st_setsrid(st_makepoint(-122.2682, 37.8716), 4326)::geography, true,  4.7, array['mechanical']),
  ('Alameda Auto Body',         '1500 Webster St, Alameda, CA',           '+15105550209', st_setsrid(st_makepoint(-122.2585, 37.7611), 4326)::geography, false, 4.2, array['collision']),
  ('San Mateo Collision',       '100 W 25th Ave, San Mateo, CA',          '+16505550210', st_setsrid(st_makepoint(-122.3186, 37.5527), 4326)::geography, true,  4.5, array['collision','paint']),
  ('Hayward Truck & Auto',      '500 W A St, Hayward, CA',                '+15105550211', st_setsrid(st_makepoint(-122.0808, 37.6688), 4326)::geography, true,  4.1, array['mechanical','truck']),
  ('Walnut Creek Auto Body',    '2000 N Main St, Walnut Creek, CA',       '+19255550212', st_setsrid(st_makepoint(-122.0633, 37.9070), 4326)::geography, true,  4.8, array['collision','paint']),
  ('Marin Collision Center',    '300 Bellam Blvd, San Rafael, CA',        '+14155550213', st_setsrid(st_makepoint(-122.5114, 37.9735), 4326)::geography, true,  4.4, array['collision']),
  ('Redwood City Auto',         '900 Veterans Blvd, Redwood City, CA',    '+16505550214', st_setsrid(st_makepoint(-122.2186, 37.4852), 4326)::geography, true,  4.3, array['mechanical','collision']),
  ('Pacifica Auto Body',        '2000 Palmetto Ave, Pacifica, CA',        '+16505550215', st_setsrid(st_makepoint(-122.4845, 37.6138), 4326)::geography, false, 4.0, array['collision']);
