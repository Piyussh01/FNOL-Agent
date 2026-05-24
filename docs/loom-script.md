# Loom Video Script — FNOL Take-Home Demo

A simple, talk-it-out guide for the Loom. Aim for **5–7 minutes**. Speak in plain
English, like you're explaining it to a friend who has never seen the project.

---

## 0. Before you hit record (30 seconds of prep)

- Have these tabs open in this order:
  1. The landing page (`/`)
  2. A fresh email inbox (for the magic link)
  3. The `/admin` dashboard in a second window
- Mic check. Close Slack. Phone on silent.

---

## 1. Opening — who you are and what this is (30 seconds)

> "Hey, I'm Piyussh. This is my take-home for Tavus. I built an AI claims
> intake agent for a fake insurance company called Acme. When someone has a
> car accident or their roof leaks, instead of waiting on hold for an hour,
> they sign in and talk face-to-face with **Sam**, an AI video agent who
> files the whole claim with them in about five minutes. Let me show you."

---

## 2. The value — why this matters (45 seconds)

Keep this short. Two sentences each.

- **For the customer:** Filing a claim today is awful. You're already stressed,
  and you get an IVR phone tree. Sam is a calm face on the screen who asks
  the right questions in the right order.
- **For the carrier:** Every claim Sam handles is one a human adjuster doesn't
  have to. And Sam is consistent — never forgets to ask about injuries, never
  skips the coverage check.
- **Why video, not just chat:** People share more honestly when they see a
  face. Tavus also gives me **perception** — Sam can tell when the caller is
  upset and slow down, or escalate to a human.

---

## 3. Live demo — the golden path (2.5 minutes)

Walk through this on screen. Narrate as you click.

1. **Landing → Login.** "Magic-link sign-in through Supabase. No passwords."
2. **Click the magic link.** "Now I'm in. Pick a claim type — I'll do auto."
3. **Sam's face loads in the iframe.** "This is the Tavus CVI player. Sam
   greets me by name because we passed a memory hint at conversation start."
4. **Say:** *"Hi Sam, I rear-ended someone at the intersection of 5th and
   Main about an hour ago."*
   - Sam will: verify identity → check coverage → take incident details →
     ask for photos.
5. **Photo step.** "Sam just sent me a link to upload photos from my phone.
   I'll use the desktop one for the demo. Behind the scenes, Claude vision
   looks at the photos and tells Sam the damage severity and a repair
   estimate range."
6. **Booking.** "Now Sam offers a tow and a rental car. These are mock
   partner adapters — same interface a real Geico or Enterprise API would
   have, swappable in one file."
7. **Submit.** "And we're submitted. Email recap goes out, claim is in the
   system."

If a step glitches, just say so and move on — don't fight it on camera.

---

## 4. The Tavus pieces I used (1 minute)

Call these out by name. This is what the reviewer wants to hear.

- **CVI (Conversational Video Interface)** — the video agent itself.
  Phoenix-4 model, Daily WebRTC transport.
- **Personas with tools** — I provisioned two personas, one English, one
  Spanish, both with the same 18 function tools attached. The setup script
  is `bun run tavus:setup`.
- **Webhooks** — Tavus calls back into my server with signed HMAC events:
  `conversation.tool_call`, `conversation.perception_analysis`,
  `conversation.ended`. I verify the signature with `timingSafeEqual`.
- **Conversational context for auth** — Tavus has no first-class
  auth-passthrough, so I mint a short-lived JWT at conversation create and
  embed it in `conversational_context`. It comes back on every tool call,
  and I re-verify claim ownership server-side. That was the trickiest piece
  to get right.
- **Raven perception** — distress detection. Score ≥ 0.7 flags the session
  and tells Sam to soften pacing. The threshold lives in
  `persona/guardrails.json`.
- **Memory hint** — returning users get a short "you helped this person
  with X last week" injected at conversation start, so Sam feels continuous.

---

## 5. What I built around Tavus to make it work (1 minute)

> "Tavus is the face. Everything underneath is mine. Three things mattered."

1. **One tool registry, two brains.** I have 18 tools — verify identity,
   start claim, dispatch tow, analyze photos, etc. The exact same handlers
   run for both the Tavus video agent **and** an Anthropic Claude chat
   fallback. Same Zod schemas, same database writes. So if video fails or
   the user prefers text, nothing breaks.
2. **A strict forward-only state machine.** Claims move through ten stages:
   greeting → identifying → verifying → intake → coverage check → photos →
   assessing → booking → reviewing → submitted. Sam literally cannot skip
   stages — each one has entry requirements that get re-derived from the
   database after every tool call.
3. **Adapter pattern with env feature flags.** Resend email, Upstash rate
   limit, PostHog, Helicone, the partner mocks — every external thing
   no-ops if its credentials aren't set. So a fresh checkout boots and runs
   end-to-end with only Tavus, Supabase, and Anthropic keys. That mattered
   for keeping the demo reliable.

Quick screen share of `/admin`: "Live ops dashboard — claims, distress
alerts, stage funnel, full audit log of every tool call."

---

## 6. The hard problems I hit (1 minute)

Be honest here. Reviewers like seeing real engineering scars.

- **Webhook auth was the hardest piece.** Tavus tool calls arrive
  service-side. I had to prove three things on every callback: the webhook
  is really from Tavus (HMAC), the JWT in the context is mine and not
  expired, and the caller actually owns the claim. Service role bypasses
  Supabase RLS, so without that ownership check, any authenticated user
  could touch any claim. I learned this the hard way and added a test for
  it (`tests/unit/rls.test.ts`).
- **Tavus tool calls have a 5-second response window.** Some handlers
  (analyze photos, find repair shops via PostGIS) can be slow. I had to
  make sure nothing in the hot path waits on a slow external call —
  Claude vision runs asynchronously via a Supabase Edge function, and
  the `analyze_photos` tool just polls the already-stored result.
- **Edge runtime vs Node runtime.** The persona loader uses `fs`. The
  rate limiter middleware runs on Edge. Anything that touches `jose`,
  `fs`, or the persona files has to declare `runtime = "nodejs"`. Got
  burned a few times on Vercel deploys before I locked this down.
- **Vision returning prose instead of JSON.** Claude vision sometimes
  decides to explain the damage in English instead of returning the
  schema. I added a `parseVisionJson` fallback that returns an empty
  result with notes, so Sam never crashes — he just asks for another
  angle.
- **Spanish parity.** I built English first, then Spanish. Keeping two
  personas in lockstep (same tool list, same KB, same guardrails, same
  pacing) was more work than I expected. There's a parity test for the
  i18n strings.
- **`bun test` vs `vitest run`.** Bun's native test runner picks up the
  wrong files and doesn't have `vi.mock`. I switched everything to vitest.
  Tiny thing, big time sink.

---

## 7. Close — what I'd do next (30 seconds)

> "If I had another week, I'd: (1) wire a real push notification provider
> so the photo-upload link reaches the phone instantly, (2) add a Tavus
> screen-share mode so Sam can walk callers through the policy doc, and
> (3) load-test the webhook path — 5 seconds is tight if Tavus retries.
> Thanks for watching."

---

## Cheat sheet — say these exact phrases at least once

- "Tavus CVI" — name-drop it
- "Conversational context" — shows you understand their auth model
- "Raven perception" — shows you used more than just the talking head
- "Same tool registry, two brains" — your core architectural idea
- "Forward-only state machine" — shows reliability thinking
- "Defense in depth on RLS" — shows security thinking

## Things to avoid saying

- "It's pretty simple" — undersells the work
- "I just used Tavus" — sells short what's underneath
- Apologizing for anything that doesn't work on camera. Acknowledge, move on.
