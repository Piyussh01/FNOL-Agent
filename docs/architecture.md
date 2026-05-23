# FNOL — Architecture overview

A high-level map of how the system fits together. For module-by-module
status, see [`PROGRESS.md`](PROGRESS.md). For ops, see
[`runbook.md`](runbook.md). For a live demo walkthrough, see
[`demo-script.md`](demo-script.md).

---

## What the system does

A policyholder opens the web app, signs in via magic link, and is greeted
by **Sam** — a Tavus Conversational Video Interface agent. Sam walks the
caller through filing an auto, home, or renters insurance claim
end-to-end: identity verification, coverage check, fact intake, photo
capture with computer-vision damage assessment, booking partner services
(tow, rental, repair shop, adjuster), and final submission. A text-chat
fallback runs the same toolset against Anthropic Claude. Returning users
are recognized via a memory hint injected at conversation start.

---

## Stack at a glance

| Layer                       | Choice                                            |
| --------------------------- | ------------------------------------------------- |
| Framework + hosting         | Next.js 14 App Router on Vercel                   |
| Database / Auth / Storage   | Supabase (Postgres + RLS, Auth, Storage, Realtime)|
| Geo                         | PostGIS extension                                 |
| Conversational video        | Tavus CVI (Daily WebRTC transport, Phoenix-4 model)|
| Perception                  | Tavus Raven (distress, gaze, environment)         |
| Chat brain                  | Anthropic Claude Sonnet (tool use)                |
| Vision                      | Anthropic Claude Sonnet (multimodal)              |
| Email                       | Resend (no-op when creds absent)                  |
| Rate limit                  | Upstash Redis at Next.js middleware               |
| Analytics                   | PostHog (server-side capture)                     |
| LLM observability           | Helicone (proxies Anthropic when `ANTHROPIC_BASE_URL` is set) |
| Validation                  | Zod (single source of truth for tool I/O)         |
| Auth tokens                 | `jose` JWT (HS256, 1h) for tool dispatch          |
| Package manager / runtime   | bun                                               |

---

## The 30-second mental model

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER (browser)                         │
│  ┌────────────────────┐    ┌────────────────────┐               │
│  │  /claim/[id]/video │    │  /claim/[id]/chat  │               │
│  │  (Tavus iframe)    │    │  (SSE stream)      │               │
│  └─────────┬──────────┘    └──────────┬─────────┘               │
└────────────┼──────────────────────────┼─────────────────────────┘
             │                          │
             ▼                          ▼
       ┌─────────────┐         ┌──────────────────┐
       │ Tavus CVI   │         │  /api/chat/stream│
       │ (Daily/WebRTC)        │  Anthropic + tools
       └──────┬──────┘         └────────┬─────────┘
              │ webhook (signed)         │
              ▼                          ▼
       ┌─────────────────────────────────────────┐
       │     Tool registry (lib/tools/*)         │
       │   18 handlers · Zod-validated I/O       │
       └──────────────┬──────────────────────────┘
                      ▼
       ┌─────────────────────────────────────────┐
       │   Supabase (Postgres + RLS + Storage)   │
       │   claims · photos · tasks · events …    │
       └──────────────┬──────────────────────────┘
                      ▼
       ┌──────────────────────┐   ┌──────────────────┐
       │ Mock partner adapters│   │ Claude Vision    │
       │ tow/rental/repair/adj│   │ (Edge function)  │
       └──────────────────────┘   └──────────────────┘
```

Two interfaces (video + chat), one tool registry, one database. The same
Zod schemas define inputs/outputs for both interfaces.

---

## Components

### 1. Next.js app (`app/`)

- **`/`** — Marketing landing with "File a claim" CTA.
- **`/login`** — Magic-link sign-in via `@supabase/ssr` browser client.
  The browser client is used (not a server action) so the PKCE code
  verifier lands in a cookie the `/callback` route can read.
- **`/callback`** — Exchanges the OAuth code for a session.
- **`/claim/new`** — Kind picker (auto/home/renters) → POSTs to
  `/api/conversations/create`.
- **`/claim/[id]/video`** — Embeds the Tavus CVI iframe with the
  conversation URL returned from the create endpoint.
- **`/claim/[id]/chat`** — SSE-streaming chat backed by Claude.
- **`/claim/[id]/photos`** — Mobile-first camera capture page (file input
  with `capture="environment"`).
- **`/claim/[id]/summary`** — Post-submission recap.
- **`/admin`** — Live ops dashboard (claims table, distress alerts,
  incident log, stage funnel).

### 2. Tavus CVI integration (`lib/tavus/`)

- **`client.ts`** — Thin Tavus API wrapper (`createPersona`,
  `createConversation`, `endConversation`).
- **`persona.ts`** — Loads `sam.{en,es}.md`, `objectives.json`,
  `guardrails.json`, KB markdown files.
- **`tools-schema.ts`** — OpenAI-style function specs for all 18 tools.
  Shared with `lib/tools/anthropic-tools.ts` so chat mode sees the same
  signatures.
- **`webhook-verify.ts`** — HMAC-SHA256 verification with
  `timingSafeEqual` (no string compare).
- **`scripts/setup-tavus-persona.ts`** — One-shot persona creator. Reads
  prompts + KB + tools schema, calls Tavus, prints the two persona IDs.

### 3. Tool registry (`lib/tools/`)

The conceptual heart of the system. Every interaction with the database
or a partner goes through a tool handler.

```
lib/tools/
├── registry.ts             # registerTool, getTool, loadAllTools
├── anthropic-tools.ts      # Registry → Anthropic tool schema adapter
└── handlers/               # 18 handler files, one per tool
    ├── _events.ts          # Audit-trail writes
    ├── verify-identity.ts
    ├── get-policy-details.ts
    ├── validate-coverage.ts
    ├── start-claim.ts
    ├── record-incident-details.ts
    ├── add-party.ts
    ├── request-photo-upload.ts
    ├── analyze-photos.ts
    ├── dispatch-tow.ts
    ├── book-rental.ts
    ├── find-nearby-repair-shops.ts
    ├── schedule-adjuster-callback.ts
    ├── estimate-claim-value.ts
    ├── submit-claim.ts
    ├── send-summary.ts
    ├── check-claim-status.ts
    ├── escalate-to-human.ts
    └── file-emergency.ts
```

Each handler:
1. Validates input with Zod.
2. Receives an already-authenticated `ToolContext` (claim + caller
   verified by the dispatcher).
3. Performs business logic via the service-role Supabase client.
4. Writes a `tool_call` or `tool_error` row to `events` for audit.
5. Returns a JSON-serializable result.

### 4. Supabase data model (`supabase/migrations/`)

Five migrations: schema, RLS, indexes, seed, repair-shop RPC.

```
users
  └─ policies ─┬─ vehicles (auto)
               └─ properties (home/renters)

claims
  ├─ claim_parties (other drivers, witnesses)
  ├─ photos (vision_json populated by Edge fn)
  ├─ tasks (booked tow / rental / adjuster / emergency)
  ├─ sessions (one per modality engagement)
  ├─ messages (unified video + chat)
  └─ events (audit trail; service role reads, RLS-scoped writes)

repair_shops (PostGIS-indexed; queried via repair_shops_near RPC)
```

Triggers:
- `handle_new_auth_user` on `auth.users` → auto-creates a `users` row.
- `set_claim_number` on `claims` → assigns `CL-YYYY-xxxxxxxx`.
- `set_updated_at` on `claims` → keeps `updated_at` fresh.
- `log_claim_stage_change` on `claims` → writes `stage_change` events.

RLS: every table is enabled. Owner-scoped policies via the
`current_user_id()` SECURITY DEFINER helper. The `events` table has no
SELECT policy for `authenticated` — only the service role can read it.

### 5. Claim state machine (`lib/claims/`)

- **`state-machine.ts`** — Pure functions: `nextStage`, `deriveObjectives`,
  `canEnter`, `progress`. No I/O.
- **`advance.ts`** — I/O wrapper: reads claim + counts (photos, tasks,
  parties), derives objectives, computes next stage, updates the row.
  Called from any write-side tool handler.
- **`details-schema.ts`** — Per-kind Zod schemas (`AutoDetailsSchema`,
  `HomeDetailsSchema`, `RentersDetailsSchema`) validated by
  `record_incident_details`.

Stages flow strictly forward:

```
greeting → identifying → verifying → intake → coverage_check
       → photos → assessing → booking → reviewing → submitted
                                    ↓
                                 escalated (terminal)
```

The transition table in `STAGE_ENTRY_REQUIREMENTS` enforces which
objectives must be present before each stage opens. Sam can't jump past
`photos` until `photos_uploaded` is in the derived set.

### 6. Claude Vision pipeline (`lib/vision/` + Edge function)

Two execution paths, same prompts:

```
                  photo upload to Storage
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
  Storage webhook fires       analyze_photos tool called
            │                           │
            ▼                           ▼
  Edge fn analyze-photos      Inline fallback in
  (Deno, supabase/functions)  lib/tools/handlers/analyze-photos.ts
            │                           │
            └─────────────┬─────────────┘
                          ▼
            Claude Sonnet (vision)
            prompt: lib/vision/prompts/{auto,home,renters}.ts
                          │
                          ▼
            Strict JSON → VisionResultSchema validator
                          │
                          ▼
            UPDATE photos.vision_json
                          │
                          ▼
            synthesize() across all photos for the claim
                          │
                          ▼
            Sam paraphrases naturally to the caller
```

The schema is rigid: `severity`, `parts_affected[]`,
`estimated_repair_range_usd: [low, high]`, `drivable_likely | null`,
`habitable_likely | null`, `notes`. Auto results force
`habitable_likely=null`; home forces `drivable_likely=null`. If Claude
returns prose instead of JSON, `parseVisionJson` falls back to an
"empty" result with a `notes` explanation — Sam never crashes, just asks
for another angle.

### 7. Mock partner adapters (`lib/partners/`)

```
types.ts                # Interface definitions (TowProvider, etc.)
tow.ts                  # mockTowProvider — vendors, ETA, confirmation
rental.ts               # mockRentalProvider — class-priced rates
repair.ts               # repairShopDirectory — calls repair_shops_near RPC
adjuster.ts             # mockAdjusterScheduler — picks adjuster name + slot
```

Mocks return deterministic-feeling data with 200–800ms simulated latency
and vendor-specific confirmation code patterns (`TOW-XXXXXX`,
`RNT-XXXXXXXX`, `ADJ-XXXXXX`). To swap to a real partner, replace one
file — call sites never change because they only see the interface.

### 8. Safety + escalation

Three layers, in order of severity:

1. **`file_emergency`** — Fires on any guardrails-listed keyword
   (`911`, `injured`, `gas leak`, etc., from `persona/guardrails.json`).
   Surfaces emergency resources, creates a `tasks` row of kind
   `emergency`, halts the claim flow until the caller acknowledges.
2. **`escalate_to_human`** — Fires on lawsuits, attorneys,
   complex/out-of-policy requests. Creates a `human_callback` task with
   urgency-derived scheduling (15 min / 2 h / 24 h).
3. **Raven distress detection** — Webhook payload `score >= 0.7` flips
   `sessions.distress_flagged` and writes a `distress_flag` event. Sam's
   persona instructions tell it to soften pacing and offer a supervisor.

### 9. Webhook + tool auth flow

The trickiest piece. There are two kinds of trust the system must
establish on every Tavus tool callback:

1. **Tavus → us**: the webhook payload is signed with
   `TAVUS_WEBHOOK_SECRET`. `verifyTavusSignature` does HMAC + timing-safe
   compare.
2. **Caller → claim**: a short-lived JWT (`TOOL_JWT_SECRET`, 1 h,
   HS256) is minted at conversation create and embedded into Tavus's
   `conversational_context`. Tavus echoes it back inside tool calls; we
   verify and look up the claim, and reject if `claim.user_id !=
   jwt.user_id`. This is the defense-in-depth check on top of the
   service-role bypass.

```
conversation create:
  user (browser, magic-link auth)
    └─→ /api/conversations/create
          ├─ open claim row
          ├─ mint tool JWT { claim_id, user_id, session_id, exp=+1h }
          └─ tavus.createConversation({ conversational_context: { tool_jwt, ... } })
                └─ returns conversation_url (Daily room) to iframe

tool call:
  user speaks → Tavus LLM decides "call verify_identity"
    └─→ Tavus webhook POST /api/tavus/webhook
          ├─ verify HMAC signature
          ├─ extract tool_jwt from conversational_context
          ├─ verify JWT + look up claim by JWT.claim_id
          ├─ check claim.user_id == JWT.user_id
          ├─ Zod-validate tool input
          ├─ dispatch to handler
          └─ return { tool_call_id, result } within 5 s
```

### 10. Internationalization

- **`lib/i18n/{en,es}.json`** — UI string tables with identical keys.
  Parity enforced by `tests/unit/i18n.test.ts`.
- **`lib/i18n/server.ts`** — Locale resolution: `users.preferred_lang` →
  cookie → `Accept-Language` → `en`.
- **`persona/sam.{en,es}.md`** — Native-language personas (not
  translations).
- **`scripts/setup-tavus-persona.ts`** creates two personas in Tavus;
  `personaIdFor(locale)` routes the conversation to the right one.

### 11. Observability

- **`lib/observability/logger.ts`** — Structured JSON to stdout. No
  external dep; works in every runtime.
- **`lib/observability/posthog.ts`** — Server-side capture for funnel
  events (`claim_started`, `claim_submitted`, `escalated`, etc.). No-ops
  when `NEXT_PUBLIC_POSTHOG_KEY` is unset.
- **`lib/observability/ratelimit.ts`** — Upstash sliding-window
  limiters per route family. No-ops when Upstash env is absent. Imports
  `@upstash/redis/cloudflare` so the Edge-runtime middleware doesn't
  bundle Node-only APIs.
- **Helicone** — When `ANTHROPIC_BASE_URL=https://anthropic.helicone.ai`
  is set, all Anthropic calls are proxied through Helicone for per-call
  spend + latency tracking.
- **`events` table** — The system's own audit log. Every tool call,
  stage change, escalation, distress flag, and webhook receipt is one
  row. `/admin` reads from this.

---

## Lifecycle: one full claim, end-to-end

```
1.  User → /  → click "File a claim"
2.  User → /login → enter email
3.  Browser → supabase.auth.signInWithOtp (PKCE; verifier cookie set)
4.  User clicks magic link in email
5.  /callback → exchangeCodeForSession → session cookie set
6.  Redirect → /claim/new → user picks "Auto"
7.  POST /api/conversations/create
      → insert claims row (stage='greeting')
      → insert sessions row (modality='video')
      → mint tool JWT
      → tavus.createConversation({ persona_id, context with JWT })
      → set tavus_conversation_url cookie
      → 303 → /claim/<id>/video
8.  Iframe loads → user + Sam are talking
9.  Sam decides to verify identity:
      Tavus → POST /api/tavus/webhook (event_type='conversation.tool_call')
        → verify HMAC, verify JWT
        → dispatch verify_identity handler
        → handler queries users + policies, writes event row
        → respond { result } within 5s
10. Sam paraphrases result, walks through stages, calling tools as needed
11. Sam requests photos → request_photo_upload tool
      → generates signed Storage URLs
      → sendEmail() (Resend if configured, else logs)
12. User opens email link → /claim/<id>/photos
      → PUT to signed URL → /api/photos/finalize → photos row inserted
13. Storage webhook → Edge fn analyze-photos → Claude vision → vision_json
14. Sam calls analyze_photos → polls vision_json, synthesizes, paraphrases
15. Sam books tow/rental/adjuster (mock partners), then estimate_claim_value
16. User confirms → submit_claim → claim stage='submitted'
17. send_summary → email recap, link to /claim/<id>/summary
18. Session ends → webhook event_type='conversation.ended'
      → sessions.ended_at + recording_url stored
```

---

## Key trade-offs

| Decision                                 | Why                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| One persona prompt, two interfaces       | Lower drift risk than two stylistically different personas; chat re-uses video tone   |
| Service-role bypass + per-tool authz     | RLS is the floor; tool handlers add caller-vs-claim ownership as defense in depth     |
| JWTs in `conversational_context`         | Tavus has no first-class auth-pass-through; embedding a signed JWT is the safest cheap option |
| Mock partners with realistic latency     | Demos look real; production swap is a one-file change                                  |
| Inline + Edge vision fallback            | Edge fn handles bulk; inline pass covers dev environments without the webhook         |
| Pure state machine + I/O wrapper         | All transitions unit-testable without a database                                       |
| No Sentry                                | User preference; structured stdout + PostHog cover the gap                            |
| `bun test` swapped for `vitest run`      | vitest has `vi.mock`, bun's native runner doesn't; same syntax otherwise              |

---

## What's mocked vs real

| Real                                       | Mocked                                              |
| ------------------------------------------ | --------------------------------------------------- |
| Tavus persona + conversation API           | Tow / rental / repair / adjuster (deterministic)    |
| Supabase Postgres + Auth + Storage + RLS   | Email when no Resend creds (logs to stdout)         |
| Anthropic Claude Sonnet (chat + vision)    | PostHog / Helicone / Upstash when env unset (no-op) |
| HMAC webhook verification                  | "Last 4 SSN" verification (captured but not checked) |
| JWT tool dispatch                          | Storage webhook is documented but not auto-installed |
| PostGIS proximity search                   | Push notifications (service worker fires, no real push provider) |
| Magic-link auth via Supabase               |                                                     |
| Sentry — intentionally not used            |                                                     |

The "feature flag if env present" pattern across notifications, analytics,
rate limiting, and observability means a fresh checkout boots and runs
end-to-end with only Tavus, Supabase, and Anthropic credentials.
