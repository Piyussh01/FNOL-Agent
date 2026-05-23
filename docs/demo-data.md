# Demo data & how to test end-to-end

This is the cheat sheet for driving the FNOL demo without setting up email
delivery. All three users are seeded in `supabase/migrations/0004_seed.sql`
and can be signed in with one click from `/login`.

## One-click sign-in

The `/login` page exposes a **Demo accounts** section. Each row hits
`GET /api/auth/dev-login?email=…` which calls
`supabase.auth.admin.generateLink({ type: 'magiclink' })` server-side and
redirects through `/callback` so cookies are set exactly like the real magic
link flow. The endpoint is gated by an allowlist (the three seed emails) — it
will refuse any other address.

If you want to skip the UI, just hit the URL directly:

```
http://localhost:3000/api/auth/dev-login?email=maya@example.com
```

## Hardcoded policyholders

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

## Default policy for brand-new sign-ups

Any user who signs in with an email that's **not** in the 0004 seed gets a
default auto policy automatically attached by the `handle_new_auth_user`
trigger (migration `0007_default_policy_for_new_users.sql`). This means the
demo end-to-end flow works for any email, not just the three named seeds.

The default policy that gets written:

| Field | Value |
| --- | --- |
| Policy number | `ACME-AUTO-<first 8 chars of user uuid, uppercased>` |
| Kind | `auto` |
| State | CA |
| Active window | today → today + 1 year |
| Collision deductible | $500 |
| Comprehensive deductible | $250 |
| Liability — bodily / property | $100k / $50k |
| Uninsured motorist | $100k |
| Perils covered | collision, comprehensive, vandalism, theft, weather, fire |
| Rental reimbursement | $40/day, 30 day cap |
| Default vehicle | 2022 Honda Civic (VIN + plate derived from the same uuid suffix) |

`users.name` is derived from the local part of the email (e.g. `bob@example.com`
→ `bob`). `verify_identity` accepts a first-name match, so saying "Hi, I'm
Bob" will pass verification against an auto-generated account.

If you want a *different* default (e.g. add a home policy, change deductibles),
edit the `insert into public.policies` block in
`supabase/migrations/0007_default_policy_for_new_users.sql` and write a
follow-up forward-only migration to update the trigger — never edit 0007 in
place once it has been applied to a shared environment.

## Does Sam remember anything across conversations?

**No persistent transcript memory.** What he does have:

1. **Per-conversation `memory_hint`.** When you start a claim,
   `app/api/conversations/create/route.ts` queries open claims for the user
   and packs a string into Tavus's `conversational_context` — e.g.
   *"Returning user. They have 1 open claim(s): CL-2026-… (auto,
   stage=evidence). Offer to resume…"* That hint lives for one conversation
   and is rebuilt from DB state every time, not from prior transcripts.

2. **Identity verification is policy-keyed.** `verify_identity`
   (`lib/tools/handlers/verify-identity.ts`) matches the caller's name
   against `users.name` and optionally a policy number against
   `policies.policy_number`. Because every new user now gets a default
   policy via the trigger above, this passes for any signed-in account.

3. **Sam still won't *create* a policy at runtime.** The auto-attach is a
   DB trigger, not an agent tool. None of the 18 registered tools
   (`lib/tools/registry.ts` → `loadAllTools()`) write to `policies`,
   `vehicles`, or `properties` — no `quote_policy`, no `bind_policy`, no
   underwriting flow. Sam treats the policy as pre-existing context.

**Assumptions baked into the demo:**
- Onboarding (KYC, underwriting, payment) is out of scope. The trigger
  fabricates a policy purely so the FNOL happy-path is testable end-to-end.
- The default is **auto** because that's the primary demo scenario; new
  users trying to file home or renters will fail coverage validation.
- `users.name` is the verification source of truth — no real DOB/SSN. Prod
  would compare a hashed SSN/DOB; demo accepts a first-name match.
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
