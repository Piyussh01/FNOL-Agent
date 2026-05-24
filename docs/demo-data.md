# Demo data & how to test end-to-end

This is the cheat sheet for driving the FNOL demo. **Any email works** —
sign in with the magic link (or use the three seeded accounts below if you
own their inboxes). Every brand-new account is auto-provisioned with
**all three** policy kinds (auto + home + renters) by migration
`0008_default_all_policies_for_new_users.sql`, so you can exercise any
flow on `/claim/new` regardless of which email you signed in with.

## Hardcoded policyholders (seeded fixtures, optional)

### 1. Maya Rodriguez — auto only

| Field | Value |
| --- | --- |
| Email | `maya@example.com` |
| Phone | `+15555550101` |
| Language | English |
| Policy | `ACME-AUTO-1001` (CA, active 2025-01-01 → 2026-12-31) |
| Collision deductible | $500 |
| Comprehensive deductible | $250 |
| Liability — bodily / property | $250k / $100k |
| Rental reimbursement | $50/day, 30 day cap |
| Vehicles | 2019 Honda Accord (VIN `1HGCM82633A123456`, plate 7ABC123) · 2020 Tesla Model 3 (VIN `5YJ3E1EA9KF000316`, plate 8XYZ456) |

**Best test scenario:** rear-end collision in San Francisco. Tell Sam
*"I rear-ended someone on the 101 near the Cesar Chavez exit about twenty
minutes ago — my Accord's front bumper is crumpled, airbags went off, I'm
okay."* Walks the full auto path: verify → coverage check → start claim →
photos → tow → rental → repair shop pick (Mission Auto Body et al.) → adjuster.

### 2. Daniel Park — home + renters

| Field | Value |
| --- | --- |
| Email | `daniel@example.com` |
| Phone | `+15555550102` |
| Language | English |
| Home policy | `ACME-HOME-2001` — 742 Evergreen Ter, SF · dwelling $650k · all-peril deductible $1k · wind/hail $2.5k |
| Renters policy | `ACME-RENT-3001` — 500 Market St Apt 12B, SF · personal property $50k · deductible $250 |
| Perils covered | fire, theft, vandalism, wind, hail, lightning, sudden water (flood and earthquake **excluded**) |

**Best test scenarios:** kitchen fire (home) or laptop stolen from apartment
(renters — will trigger the `police_report_if_theft` objective).

### 3. Sofía García — Spanish, auto + renters

| Field | Value |
| --- | --- |
| Email | `sofia@example.com` |
| Phone | `+15555550103` |
| Language | **Spanish** (loads `persona/sam.es.md`) |
| Auto policy | `ACME-AUTO-1002` — 2017 Toyota Camry · collision $1k · comprehensive $500 |
| Renters policy | `ACME-RENT-3002` — personal property $35k · deductible $500 |

**Best test scenario:** hailstorm dented the Camry overnight (auto comprehensive)
— good way to exercise the Spanish persona end-to-end.

## Reference data also seeded

- **15 repair shops** around SF (Mission Auto Body, Golden Gate Collision,
  SOMA AutoCare, etc.), with PostGIS `geography` coordinates so
  `find_nearby_repair_shops` returns realistic distances.
- Two are out-of-network (Alameda Auto Body, Pacifica Auto Body) so you can
  test the in-network filter.

## Default policies for brand-new sign-ups

Every user who signs in gets **three** policies auto-attached by the
`handle_new_auth_user` trigger (migration
`0008_default_all_policies_for_new_users.sql`, supersedes 0007). The
policy numbers are derived from the user's uuid so they're stable per
account:

| Kind    | Policy number suffix       | Asset attached                            |
| ------- | -------------------------- | ----------------------------------------- |
| auto    | `ACME-AUTO-<8 uuid chars>` | 2022 Honda Civic                          |
| home    | `ACME-HOME-<8 uuid chars>` | 123 Demo Lane, San Francisco, CA 94110    |
| renters | `ACME-RENT-<8 uuid chars>` | 500 Demo Ave Apt 4B, San Francisco, CA    |

Coverage shape per kind:

- **Auto** — $500 collision / $250 comprehensive deductible. Liability
  $100k bodily / $50k property. Rental reimbursement $40/day, 30-day cap.
  Perils: collision, comprehensive, vandalism, theft, weather, fire.
- **Home** — $1k all-peril / $2.5k wind-hail deductible. Dwelling $500k,
  personal property $250k, liability $300k. Perils: fire, theft,
  vandalism, wind, hail, lightning, sudden water (flood and earthquake
  excluded).
- **Renters** — $250 all-peril deductible. Personal property $50k,
  liability $100k, loss of use $10k. Perils: theft, fire, vandalism,
  sudden water.

`users.name` is derived from the local part of the email (e.g.
`bob@example.com` → `bob`). **`verify_identity` does not check the name**
— it trusts whatever the caller says because the session is already
pinned to a specific `user_id` by the JWT. Name and DOB/SSN values are
written to the `events` audit log only.

The 0008 migration also **backfills** missing policy kinds for any user
who was created under the old 0007 (auto-only) trigger, so existing
accounts become demo-ready without a re-signup.

To change the default coverage shape, edit migration `0008` only if it
has not yet been applied to a shared environment; otherwise write a new
forward-only migration that replaces the trigger.

## Does Sam remember anything across conversations?

**No persistent transcript memory.** What he does have:

1. **Per-conversation `memory_hint`.** When you start a claim,
   `app/api/conversations/create/route.ts` queries open claims for the user
   and packs a string into Tavus's `conversational_context` — e.g.
   *"Returning user. They have 1 open claim(s): CL-2026-… (auto,
   stage=evidence). Offer to resume…"* That hint lives for one conversation
   and is rebuilt from DB state every time, not from prior transcripts.

2. **Identity verification is session-keyed.** `verify_identity`
   (`lib/tools/handlers/verify-identity.ts`) trusts the name the caller
   says — the authenticated session already pins `ctx.caller.user_id`.
   Because every new user gets all three policy kinds via the trigger
   above, any kind of claim works for any signed-in account.

3. **Sam still won't *create* a policy at runtime.** The auto-attach is a
   DB trigger, not an agent tool. None of the 18 registered tools
   (`lib/tools/registry.ts` → `loadAllTools()`) write to `policies`,
   `vehicles`, or `properties` — no `quote_policy`, no `bind_policy`, no
   underwriting flow. Sam treats the policy as pre-existing context.

**Assumptions baked into the demo:**
- Onboarding (KYC, underwriting, payment) is out of scope. The trigger
  fabricates the three policies purely so the FNOL happy-path is testable
  end-to-end for any signed-in email.
- The authenticated session (JWT → `ctx.caller.user_id`) is the real
  verification gate. `verify_identity` accepts any name and any DOB/SSN
  string in the demo and only logs them for audit. Prod would compare a
  hashed SSN/DOB and the legal name on file.
- Service-role writes from tool handlers always re-check ownership against
  `claim.user_id` after JWT verification (defense in depth, per CLAUDE.md).
- "Memory" across sessions = the `claims`, `events`, `messages` rows in
  Postgres. Resuming is surfaced via `memory_hint`, not transcript replay.

To exercise the returning-user greeting: sign in, file a claim, leave it
open (don't `submit_claim`), sign back in. The next conversation's
`memory_hint` will read *"Returning user. They have 1 open claim(s)…"* and
Sam greets by name + offers to resume.

## Resetting the demo

```bash
supabase db reset && supabase db push   # re-applies 0001–0006, re-seeds
```

Migrations are forward-only — `0006_fix_user_signup_trigger.sql` is the patch
that lets seeded emails sign in without the *"Database error saving new
user"* trigger collision.
