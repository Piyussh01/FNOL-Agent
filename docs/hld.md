# FNOL intake agent, architecture overview

This is a First Notice of Loss intake app for a fictional carrier called Acme Insurance. A policyholder signs in with a magic link, lands on a claim page, and talks to "Sam", a Tavus video agent. Sam handles the full intake: identity check, coverage lookup, fact gathering, photo capture, booking partner services (tow, rental, repair shop, adjuster), and final submission. If video isn't available the same flow runs over text chat backed by Anthropic Claude.

## The pieces

The frontend is Next.js 14 on the App Router, hosted on Vercel. Auth, database, storage, and realtime all sit in Supabase. Postgres has PostGIS turned on so we can search repair shops by distance. The video agent is Tavus CVI (Daily WebRTC under the hood); the chat fallback is Claude Sonnet with tool use. Rate limiting uses Upstash Redis at the Next.js middleware. Resend sends outbound email. PostHog and Helicone are wired up for product analytics and LLM observability, but none of those last three are required to boot. The code no-ops cleanly if the env vars are missing, which keeps the dev loop fast.

## How a request flows

The interesting bit of this system is that there are two agent interfaces (video and chat) but only one set of tool handlers behind them. Both paths funnel into the same registry in `lib/tools/`, and both validate input with the same Zod schemas. When Tavus decides Sam should call a tool, it fires a signed webhook at our API. The chat side runs a tool-use loop server-side. Either way, the handler ends up writing to Postgres, and after every mutating call we re-derive the claim's stage from current DB state.

```mermaid
flowchart TD
    A[User in browser] -->|video| B[Tavus CVI]
    A -->|chat fallback| C[/api/chat/stream]
    B -->|signed webhook| D[/api/tavus/webhook]
    C --> E[Claude Sonnet]
    D --> F[Tool registry, 18 handlers]
    E --> F
    F --> G[(Supabase Postgres + RLS)]
    F --> H[Mock partner adapters]
    F --> I[Claude vision on photos]
    G --> J[Claim state machine]
```

## Auth on tool calls

There are two trust checks on every Tavus tool call. First, the webhook body is HMAC-signed by Tavus and we verify it with a constant-time compare. Second, when the conversation is created we mint a short-lived JWT (HS256, 1 hour) carrying the claim_id and user_id, and embed it in Tavus's `conversational_context`. Tavus echoes it back on every tool call. We re-verify the JWT and confirm that `claim.user_id` matches the JWT subject before any handler runs. That second check matters because handlers use the service-role Supabase client, which bypasses RLS. RLS is still enforced everywhere else in the app; the tool path just gets an extra ownership check on top.

## Claim state machine

Claims advance strictly forward through stages: greeting, identifying, verifying, intake, coverage check, photos, assessing, booking, reviewing, submitted. There's also a terminal "escalated" stage for lawyers, complex cases, and emergencies. The transitions live in a pure module with no I/O, which makes them trivial to unit test. A thin wrapper reads the claim's current rows (photos uploaded, parties added, tasks booked) and bumps the stage if the next one's entry requirements are satisfied. Tool handlers call the wrapper after any write.

## The tools

There are 18 tools in the registry, and Sam's whole job is essentially deciding which one to call next. Three handle the opening of a claim: `verify_identity` matches the caller against the policyholder record, `get_policy_details` pulls the active policy and covered vehicles or properties, and `validate_coverage` checks that the loss type is actually covered before Sam goes any further. Once we know who's on the line and what's covered, `start_claim` opens the claim row, `record_incident_details` captures the kind-specific facts (date, location, description, plus auto or home or renters specifics validated by separate Zod schemas), and `add_party` records any other drivers, witnesses, or affected people. Photos come next: `request_photo_upload` generates signed Supabase Storage URLs and emails the upload link, and `analyze_photos` runs Claude vision against each uploaded image to produce a structured damage assessment (severity, parts affected, estimated repair range, drivability or habitability). Partner booking is four tools, one per service: `dispatch_tow`, `book_rental`, `find_nearby_repair_shops` (a PostGIS proximity search), and `schedule_adjuster_callback`. To close out, `estimate_claim_value` rolls the vision output and partner costs into a rough number, `submit_claim` flips the stage to submitted, `send_summary` emails the recap, and `check_claim_status` lets a returning user ask where things stand. Two more tools sit outside the happy path: `file_emergency` triggers on safety keywords like "injured" or "gas leak" and surfaces emergency resources, and `escalate_to_human` creates a callback task whenever a caller mentions attorneys, disputes, or anything Sam isn't authorized to handle. Every tool validates input with Zod, writes an `events` row for audit, and calls the state machine wrapper afterward so the claim stage stays in sync with reality.

## What's mocked

Partner services (tow, rental, repair, adjuster) are deterministic mocks with realistic looking confirmation codes and 200 to 800ms simulated latency. Swapping in a real partner is a one-file change because callers only see an interface. Anything else that needs a third-party key (Resend, PostHog, Helicone, Upstash) falls back to a console log when the key is missing. The result is that a fresh checkout boots and runs end-to-end with credentials for just three services: Tavus, Supabase, and Anthropic.
