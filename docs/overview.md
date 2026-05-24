# FNOL — High-Level Overview

A 5-minute read for stakeholders. For implementation depth, see
[`architecture.md`](architecture.md).

---

## What it is

An AI **First-Notice-of-Loss** intake agent for Acme Insurance. A
policyholder signs in via magic link and is greeted by **Sam**, a
Tavus CVI video agent, who walks them through filing an auto, home, or
renters claim end-to-end — identity, coverage, intake, photos with
vision-based damage assessment, partner bookings (tow/rental/repair/
adjuster), and submission. A text-chat fallback runs the same toolset
against Anthropic Claude.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router on Vercel | RSC + edge middleware, one repo for UI + API |
| Conversational video | **Tavus CVI** (Phoenix-4 + Daily WebRTC) | Real-time photoreal agent with sub-second turn-taking |
| Perception | **Tavus Raven** | Distress, gaze, environment signals |
| Chat brain | Anthropic Claude Sonnet (tool use) | Same 18-tool registry as Tavus |
| Vision | Anthropic Claude Sonnet (multimodal) | Photo damage assessment → strict JSON |
| Data / Auth / Storage | Supabase (Postgres + RLS, Auth, Storage, PostGIS) | One vendor for the entire data plane |
| Validation | Zod | Single source of truth for tool I/O |
| Tool auth | `jose` JWT (HS256, 1h) | Per-conversation caller binding for webhooks |
| Email / Rate limit / Analytics | Resend / Upstash Redis / PostHog | Feature-flagged — no-op when env absent |
| LLM observability | Helicone | Drop-in proxy for spend + latency |
| Runtime / PM | bun | Faster installs, native TS |

---

## System architecture

```mermaid
flowchart TB
    User([Policyholder])

    subgraph Browser
        Video["/claim/[id]/video<br/>Tavus iframe (Daily/WebRTC)"]
        Chat["/claim/[id]/chat<br/>SSE stream"]
        Photos["/claim/[id]/photos<br/>Mobile camera capture"]
    end

    subgraph Tavus["Tavus CVI"]
        Phoenix[Phoenix-4<br/>video model]
        Raven[Raven<br/>perception]
        Persona[Sam persona<br/>EN + ES]
    end

    subgraph NextAPI["Next.js API"]
        Webhook["/api/tavus/webhook<br/>HMAC + JWT verify"]
        Stream["/api/chat/stream<br/>Anthropic tool loop"]
        Create["/api/conversations/create<br/>mint JWT"]
    end

    subgraph Registry["Tool Registry · 18 handlers · Zod-validated"]
        Tools[verify_identity · get_policy<br/>start_claim · record_incident<br/>analyze_photos · dispatch_tow<br/>book_rental · find_repair_shops<br/>schedule_adjuster · submit_claim<br/>escalate_to_human · file_emergency · ...]
    end

    subgraph Data["Supabase"]
        DB[(Postgres<br/>+ RLS + PostGIS)]
        Storage[(Storage<br/>signed URLs)]
        EdgeFn[Edge fn<br/>analyze-photos]
    end

    subgraph External["External"]
        Claude[Anthropic Claude<br/>Sonnet · chat + vision]
        Partners[Mock partners<br/>tow/rental/repair/adjuster]
        Resend[Resend email]
    end

    User --> Video & Chat & Photos
    Video <--> Phoenix
    Phoenix --> Raven
    Persona --> Phoenix
    Phoenix -- "tool_call (signed)" --> Webhook
    Raven -- "perception_analysis" --> Webhook
    Chat <--> Stream
    Stream <--> Claude
    Webhook --> Registry
    Stream --> Registry
    Create --> Tavus
    Registry <--> DB
    Photos --> Storage
    Storage --> EdgeFn
    EdgeFn --> Claude
    EdgeFn --> DB
    Registry --> Partners
    Registry --> Resend
```

**Two interfaces, one tool registry, one database.** The same Zod
schemas define inputs/outputs for both video and chat — zero drift.

---

## Claim flow

```mermaid
stateDiagram-v2
    [*] --> greeting
    greeting --> identifying: verify_identity
    identifying --> verifying: get_policy_details
    verifying --> intake: validate_coverage
    intake --> coverage_check: record_incident_details
    coverage_check --> photos: start_claim
    photos --> assessing: request_photo_upload
    assessing --> booking: analyze_photos
    booking --> reviewing: dispatch_tow / book_rental / schedule_adjuster
    reviewing --> submitted: submit_claim
    submitted --> [*]: send_summary

    greeting --> escalated: file_emergency
    intake --> escalated: escalate_to_human
    assessing --> escalated: distress >= 0.7
    escalated --> [*]
```

Stages flow strictly forward. A pure state machine
(`lib/claims/state-machine.ts`) derives objectives from DB state after
every mutating tool call — Sam can't skip ahead.

---

## Trust boundary on every tool call

```mermaid
sequenceDiagram
    participant U as User
    participant T as Tavus CVI
    participant W as /api/tavus/webhook
    participant H as Tool handler
    participant DB as Supabase

    Note over U,T: Conversation create:<br/>mint JWT{claim_id, user_id, exp+1h}<br/>embed in conversational_context

    U->>T: "My car was rear-ended"
    T->>T: LLM decides: call verify_identity
    T->>W: POST tool_call + HMAC signature
    W->>W: 1. verifyTavusSignature (HMAC SHA-256, timing-safe)
    W->>W: 2. jose.jwtVerify(tool_jwt)
    W->>DB: 3. SELECT claim WHERE id = jwt.claim_id
    W->>W: 4. assert claim.user_id == jwt.user_id
    W->>W: 5. Zod-validate tool input
    W->>H: dispatch(toolCtx)
    H->>DB: business logic (service role)
    H->>DB: INSERT into events (audit trail)
    H-->>W: result JSON
    W-->>T: { tool_call_id, result } < 5s
    T-->>U: Sam paraphrases naturally
```

RLS is the floor; per-tool caller-vs-claim ownership is the
defense-in-depth wall on top.

---

## Where Tavus creates value

| Tavus feature | What it gives us | Business value |
|---|---|---|
| **Phoenix-4 photoreal video** | A face, not a chatbox. Sub-second latency, natural turn-taking, lip-sync. | Trust + empathy at the worst moment of a customer's day. NPS lift vs. an IVR or text bot is the whole pitch. |
| **CVI tool calling** | Sam invokes our 18-tool registry mid-conversation — same surface as Anthropic tool-use. | No "transfer to agent." Identity check, coverage validation, tow dispatch, photo upload, claim submit all happen *during* the conversation. |
| **Raven perception** | Per-turn distress score + gaze/environment signals streamed via webhook. | At `score >= 0.7` we flip `sessions.distress_flagged`, log an event, and Sam softens pacing + offers a supervisor. Empathy that scales. |
| **Conversational context** | Arbitrary JSON injected at conversation create, echoed back on every tool call. | Carrier of our **tool JWT** — short-lived, claim-scoped, HMAC-verified. Lets us authenticate every tool callback without Tavus knowing our auth model. |
| **Memory / returning-user hint** | Recap last claim state in the persona context. | "Welcome back — last time we were waiting on adjuster photos. Want to pick up there?" Reduces re-explanation friction. |
| **Multi-persona by language** | Two native-language personas (EN / ES) keyed by `users.preferred_lang`. | Spanish parity is a native experience, not a translation layer. Routed via `personaIdFor(locale)`. |
| **Signed webhooks** | HMAC-SHA256 on every callback. | Lets us trust Tavus → us without a private network. Pairs with our JWT for end-to-end caller binding. |
| **Daily WebRTC transport** | Reliable real-time A/V baked in. | We never touch SFUs, ICE, or jitter buffers. Ship to mobile + desktop from day one. |
| **Recording URL on session end** | `conversation.ended` event carries the artifact. | Compliance + QA review without building our own recorder. |

### Why it matters for FNOL specifically

Filing a claim is a **high-anxiety, high-friction** event. The
traditional path — phone tree → human agent → callback queue →
adjuster scheduling — averages days. With Tavus:

1. **Time-to-first-resolution drops from days to one session.**
   Identity, coverage check, tow dispatch, rental booking, and
   submission all happen in a single conversation.
2. **Empathy is observable.** Raven distress flags let us soften
   pacing or escalate to a human *before* the customer asks.
3. **Cost per claim falls** without sacrificing CX, because the agent
   handles long-tail intake variability that rule-based IVRs can't.
4. **Same agent, two surfaces.** Customers who can't or won't do video
   get an identical experience in chat — no feature gap, no second
   prompt to maintain.

---

## What's mocked vs real

| Real | Mocked |
|---|---|
| Tavus persona + conversation API | Tow / rental / repair / adjuster (deterministic latency, vendor-flavored confirmation codes) |
| Supabase Postgres + Auth + Storage + RLS | Email when no Resend creds (logs to stdout) |
| Anthropic Claude Sonnet (chat + vision) | PostHog / Helicone / Upstash when env unset (no-op) |
| HMAC webhook verification | "Last 4 SSN" verification (captured but not checked) |
| PostGIS proximity search | Push notifications (service worker only) |

The **"feature flag if env present"** pattern means a fresh checkout
boots and runs end-to-end with only Tavus, Supabase, and Anthropic
credentials. Production swaps are one-file changes — call sites only
see the interface.
