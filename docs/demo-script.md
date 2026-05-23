# FNOL demo script — what to say, what to watch for

Two end-to-end scenarios that exercise every value-creating piece of the
system: Tavus CVI conversation, Raven emotional intelligence, the 18-tool
function-calling registry, Claude Vision damage assessment, mock partner
adapters, and the safety/escalation path. Each scenario lists the exact
words to say to Sam and the corresponding signals to watch on the admin
dashboard at `/admin`.

> **Setup once before demoing:**
> 1. `bun dev` running.
> 2. Migrations 0001–0005 applied to your Supabase project.
> 3. `TAVUS_PERSONA_ID_EN` and `TAVUS_PERSONA_ID_ES` set in `.env`.
> 4. Sign out of any prior session.
> 5. Open three tabs:
>    - **Tab A**: `/` — where you'll do the claim
>    - **Tab B**: `/admin` — live ops view; refresh after each tool call
>    - **Tab C** (optional): Supabase Studio → Table Editor on `events` and `photos` so you can show the audit trail

---

## Seed users you can sign in as

The migrations seed three demo users with deterministic data. **In the
verify_identity tool, the last-4 SSN is captured but only the name is
checked** against the seed (intentional: keeps SSN out of the demo
database). Use any 4 digits — they're persisted to `events` for audit but
don't gate verification.

| Email                  | Name             | Lang | Policy                                 | Vehicle / Property                                 |
| ---------------------- | ---------------- | ---- | -------------------------------------- | -------------------------------------------------- |
| `maya@example.com`     | Maya Rodriguez   | EN   | `ACME-AUTO-1001` (auto, CA)            | Honda Accord, VIN `1HGCM82633A123456`, plate `7ABC123` |
| `daniel@example.com`   | Daniel Park      | EN   | `ACME-HOME-2001` (home, CA)            | 742 Evergreen Ter, San Francisco                   |
| `daniel@example.com`   | Daniel Park      | EN   | `ACME-RENT-3001` (renters, CA)         | 500 Market St #12B, San Francisco                  |
| `sofia@example.com`    | Sofia García     | ES   | `ACME-AUTO-1002` (auto, CA)            | Toyota Camry, plate `6QRS789`                      |
| `sofia@example.com`    | Sofia García     | ES   | `ACME-RENT-3002` (renters, CA)         |                                                    |

Suggested "last 4 SSN" to volunteer if Sam asks: **`4521`** (Maya),
**`8814`** (Daniel), **`9032`** (Sofia). Any 4 digits work — pick one that
sounds plausible.

---

## Scenario 1 — Auto fender-bender, distressed driver (English, video)

**What this demonstrates**

| Capability                              | Where it shows up                          |
| --------------------------------------- | ------------------------------------------ |
| Tavus CVI: face-to-face, sub-600ms      | Video iframe responsiveness                |
| Raven perception — distress detection   | `/admin` → Distress alerts panel           |
| Tool calling: 7 different tools fired   | `/admin` → Incidents + `events` table      |
| Claude Vision damage assessment         | Sam's verbal recap; `photos.vision_json`   |
| Mock partner bookings (tow + rental)    | `/claim/<id>/summary` Booked services list |
| State machine progression               | `/admin` → Stage funnel + `events` rows    |

### Step 1 — Sign in and start a video claim (30 s)

1. Tab A → `/` → click **File a claim** → sign in with `maya@example.com`.
2. Open the magic-link in the same browser (PKCE cookies stay put), land on `/claim/new`.
3. Click **Auto** → video session opens with Sam.

### Step 2 — Open with distress (60 s)

Say these lines to Sam, **slowly, with audible breath catches and a
slightly shaky voice**. Tavus's Raven layer is reading your face + voice;
the goal is to push your `distress_score` above the 0.7 threshold in
`persona/guardrails.json`.

> "Hi… um, I'm sorry, I'm a little — I just got rear-ended on the 101 about
> ten minutes ago. My hands are still shaking. I don't really know what
> I'm supposed to do right now."

**Expect:** Sam acknowledges your feelings *first* before asking
anything: something like *"Hey, that sounds really scary — first, are you
and anyone with you okay?"* Sam will NOT push straight to "what's your
policy number?"

**Verify in Tab B (`/admin`):**
- Refresh. Within ~10 seconds you should see a row in **Distress alerts**
  with a score like `0.78`.
- In Supabase Table Editor on `events`, filter by
  `type = 'distress_flag'` — you'll see the raw Raven payload.

### Step 3 — Verify identity (60 s)

Reply to Sam's "are you okay?" with:

> "Yeah… yeah, no one's hurt. The other car drove off. I just need to figure
> out what to do next."

Sam will ask for your name and last 4 of your SSN. Say:

> "My name is Maya Rodriguez. Last four of my social is **4521**."

**Expect:** Sam calls `verify_identity`, then `get_policy_details`, and
confirms back to you in plain English — something like *"Got it, Maya —
I have your auto policy out of California, ACME-AUTO-1001, with a $500
collision deductible. That sound right?"*

**Verify:** `events` table now has rows where
`payload_json -> 'tool'` is `verify_identity` and `get_policy_details`.

### Step 4 — Open the claim and gather facts (90 s)

Say:

> "Yes that's me. So I was stopped at a red light on the 101 onramp at
> Cesar Chavez, around 4:30. A black SUV rear-ended me. They drove off
> before I could get the plate. My car still drives but the trunk won't
> close."

**Expect:** Sam calls `validate_coverage` with peril `collision`, tells
you *"Good news — collision is covered, your deductible is $500"*, calls
`start_claim`, reads back the claim number (format `CL-2026-xxxxxxxx`),
then calls `record_incident_details`. Sam will also probe injuries and
add_party for the other driver.

### Step 5 — Photos + Claude Vision (90 s)

When Sam says "I'm going to email you a link to take some photos,"
check the inbox of `maya@example.com` (Resend dashboard → Logs if you
haven't set up the inbox). The terminal will also log:

```
{"level":"info","msg":"email_sent","to":"maya@example.com","id":"..."}
```

The link in that email is the real photo-upload page. Open it (`token=…`
auth-bypass works for one hour) and upload three photos of any damaged
car — pulled from the web or your phone gallery.

**The Vision pipeline:** the moment a photo lands in Supabase Storage, the
`analyze-photos` Edge Function runs Claude Sonnet vision against it
using the prompt in `lib/vision/prompts/auto.ts`, parses strict JSON, and
writes the result to `photos.vision_json`. Sam then calls `analyze_photos`,
which polls for up to 15s and synthesizes across all photos.

**Expect Sam to say something like:**

> "Looks like your rear bumper and trunk lid took the hit, severity moderate,
> probably $1,500 to $3,500 to repair. Looks drivable from the photos —
> matches what you said about the trunk."

**Verify in Tab C (Supabase Studio):**
- `photos` table → click into the `vision_json` column on a row. You'll
  see real Claude output: `severity`, `parts_affected`, `estimated_repair_range_usd`,
  `drivable_likely`, `notes`.
- `events` table → row with `type = 'tool_call'`, payload `{tool:
  'analyze_photos', analyzed_count: 3, severity: 'moderate'}`.

### Step 6 — Book everything, submit (60 s)

Say:

> "I think the trunk thing is going to bother me on the freeway. Can we get
> a tow and a rental?"

**Expect:** three tool calls in quick succession:
- `dispatch_tow` → returns vendor + ETA + `TOW-XXXXXX` confirmation
- `book_rental` → economy vehicle, `RNT-XXXXXXXX`
- `schedule_adjuster_callback` → adjuster name + confirmation `ADJ-XXXXXX`

Then Sam will recap, ask for your verbal OK to submit:

> "Yes please, submit it."

**Expect:** `submit_claim` + `send_summary` fire. The video session
naturally winds down with Sam saying *"Your claim number is CL-2026-…,
an adjuster will reach out within 24 to 48 business hours."*

**Verify:**
- `/claim/<id>/summary` shows the estimate range, three booked services
  with confirmation codes, and the "submitted" badge.
- `/admin` → Live claims table shows your claim at stage `submitted`.
- PostHog (if wired): event `claim_submitted` captured.

### Total time: ~6 minutes. Tool calls demonstrated:

`verify_identity` → `get_policy_details` → `validate_coverage` →
`start_claim` → `record_incident_details` → `add_party` →
`request_photo_upload` → `analyze_photos` → `dispatch_tow` →
`book_rental` → `schedule_adjuster_callback` → `estimate_claim_value` →
`submit_claim` → `send_summary` (14 of the 18 tools).

---

## Scenario 2 — Home water damage, chat → video switch, safety hard-stop (English)

**What this demonstrates**

| Capability                                  | Where it shows up                           |
| ------------------------------------------- | ------------------------------------------- |
| Same tool registry works in chat mode       | `/claim/<id>/chat` typed convo with tool calls |
| Modality switch preserves context           | Switch to video; Sam picks up mid-flow      |
| Emergency keyword auto-fires `file_emergency` | `/admin` → Incidents pane, type `emergency_flagged` |
| Different vision prompt for home claims     | `home.ts` prompt; `habitable_likely` flag   |
| Memory hint on returning user               | Day-2 Sam offers to resume                  |

### Step 1 — Start in chat (45 s)

1. Sign in as `daniel@example.com`.
2. `/claim/new` → click **Home**. Even though the card defaults to video,
   you can change the modality with the toggle on the chat page — but the
   simplest path: in the URL bar after the redirect, change `/video` to
   `/chat`, OR submit the form modified to send `modality=chat` (the API
   route accepts both).

Type to Sam:

> "Hi Sam. I came down to the basement this morning and there's about an
> inch of water on the floor. A pipe in the ceiling burst sometime
> overnight."

**Expect:** Sam, in chat, asks if anyone's hurt and confirms the basement
isn't actively flooding (mitigation question). Sam calls
`verify_identity`, `get_policy_details` (ACME-HOME-2001),
`validate_coverage` with peril `water_sudden`.

Identity: respond with **"Daniel Park, last four 8814."**

### Step 2 — The hard-stop test (30 s)

Mid-conversation, type:

> "Wait — I think I smell gas down here too."

**Expect IMMEDIATELY:** Sam calls `file_emergency` *before continuing the
claim*. Response includes the 911 line and gas-leak protocol (leave the
building, don't use light switches). Sam will not return to the claim
flow until you say something like "OK I'm outside, I called the fire
department."

**Verify in Tab B:**
- `/admin` → Incidents pane shows a `emergency_flagged` event with
  `situation: "gas leak suspected"` (or whatever Sam paraphrased).
- `tasks` table in Supabase now has a row with `kind='emergency'` for
  this claim.

This is the **highest-value safety feature**: the guardrails in
`persona/guardrails.json` instruct Sam to interrupt the claim flow on any
emergency keyword. The keyword list lives in
`guardrails.json → emergency_keywords` and `gas leak` is in it.

### Step 3 — Switch to video to walk through damage (90 s)

Type:

> "OK I'm outside on the sidewalk, fire department's on the way. I have my
> phone — can we keep going on video so I can show you the basement once
> it's safe to go back?"

Tap the **Video** toggle in the header (it calls
`/api/conversations/create` with `resume_from_claim_id=<id>`). A new
Tavus conversation opens — Sam already knows everything from the chat
because the persona's `conversational_context` includes the recent
transcript and the claim's `details_json`.

**Expect Sam to say something like:**

> "Glad you're outside. Whenever it's safe, I'd love to see the basement
> floor and the pipe overhead. Take three or four photos so we can get
> a sense of the damage."

This is the chat→video continuity proof.

### Step 4 — Vision on home photos (60 s)

Upload three photos via the email link (or directly on the photos page).
Use photos of any water damage you can find online. The Edge Function
uses `lib/vision/prompts/home.ts` — different from the auto prompt — and
returns `habitable_likely: true | false | null` instead of
`drivable_likely`.

**Expect Sam to say something like:**

> "I see standing water on the basement floor, drywall on the north wall
> looks wicked, and the ceiling around the burst pipe is sagging.
> Severity moderate, estimated $4,000 to $8,000 in repair. The basement
> itself looks uninhabitable until it's dried out, but the rest of the
> house should be fine."

**Verify:** open the `photos.vision_json` row — note the JSON shape is
home-specific (`habitable_likely`, area names like `basement_floor`,
`drywall_north_wall`).

### Step 5 — Book adjuster + mitigation note + submit (60 s)

Say:

> "Can someone come out to look in person? And do you cover the dry-out
> service? I called ServiceMaster, they're on their way."

**Expect:** `schedule_adjuster_callback` (in-person preferred, so use
`channel: video` for the demo), and Sam acknowledges mitigation in
`record_incident_details` (`mitigation_taken: "called ServiceMaster..."`).
The `home` claim kind requires the `mitigation_taken` objective per
`persona/objectives.json`, so this advances the state machine.

Approve submission. Watch `/admin` → claim stage flips to `submitted`.

### Step 6 (optional) — Returning-user memory (Day 2 simulation, 30 s)

Don't actually wait a day. Instead, in Supabase Studio run:

```sql
update claims set stage='photos', submitted_at=null, status='open'
where claim_number='CL-2026-...'  -- the one you just made
```

Then sign out, sign back in, click **File a claim** → video. The
`/api/conversations/create` route detects an open claim and injects a
`memory_hint` into the Tavus persona's `conversational_context`. The
persona's instructions tell Sam to greet you with:

> "Welcome back, Daniel. I see your claim CL-2026-… is at the photos
> stage — want to pick up there, or start fresh?"

That memory-hint logic lives in
`app/api/conversations/create/route.ts` around the comment
`// 1b. Memory recall`.

---

## What to point out as you demo (the "value creation" elevator pitch)

1. **One persona file, two interfaces.** `persona/sam.en.md` powers both
   the Tavus video persona AND the chat-mode system prompt. Single source
   of truth for tone, guardrails, and the conversational arc.
2. **One tool schema, two LLMs.** `lib/tavus/tools-schema.ts` and the
   Anthropic adapter in `lib/tools/anthropic-tools.ts` both consume the
   same Zod schemas in `lib/tools/registry.ts`. Adding a tool means
   editing one Zod + one handler, and both video and chat pick it up.
3. **Raven catches what a phone tree can't.** Distress detection isn't a
   keyword filter — it's reading the user's face and voice in real time.
   The threshold (`raven_distress_threshold = 0.7`) is a published config
   knob in `persona/guardrails.json`.
4. **Vision is grounded.** Every dollar figure Sam quotes comes from a
   tool call that includes the disclaimer "subject to adjuster review."
   Persona rule: `never promise specific payout amounts`.
5. **Mock partners are real-shaped.** `lib/partners/types.ts` declares
   interfaces; `mockTowProvider` etc. implement them with realistic
   latency and confirmation codes. Swap to a real partner = replace one
   file, no call-site changes.
6. **Auditable end-to-end.** Every tool call writes an `events` row.
   Every stage change writes an `events` row. Every distress flag writes
   an `events` row. Show Tab C during the demo — the table is the receipt.

---

## Troubleshooting in front of an audience

| Symptom                                | Likely cause                                  | Quick fix                                              |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Sam responds slowly, ~3s lag           | First Tavus session of the day (cold replica) | Do a 30-s warm-up call before the demo                 |
| "PKCE code verifier not found"         | Magic link opened in different browser        | Use the same browser; or use Chrome incognito + open the link in the same window |
| Photo upload page 404s                 | `claim-photos` bucket not yet created         | Visit one claim's photo page once to auto-create it     |
| Vision returns "Could not parse..."    | Claude returned prose, not JSON               | The prompt forces strict JSON; usually a 1-off. Re-upload the photo |
| `analyze_photos` returns 0 photos      | Storage webhook not yet wired                 | Inline analyzer in the handler runs anyway if `ANTHROPIC_API_KEY` is set — give it 15s |
