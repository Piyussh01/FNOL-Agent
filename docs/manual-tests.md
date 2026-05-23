# Manual test scripts

These scenarios require live Tavus / Anthropic / Twilio and cannot be
automated cheaply. Run before any tagged release.

## 1. Auto fender-bender, video, distressed user

1. Sign in as `maya@example.com` (seeded user with ACME-AUTO-1001).
2. `/claim/new` → auto → video.
3. Tell Sam: "I just got hit on Mission Street. My voice is shaking. I
   don't know what to do." Speak unevenly. Pause. Sniffle.
4. **Expect:** Sam slows down, acknowledges distress before pushing
   identification. Admin dashboard shows a distress flag within 10s.
5. Continue. Sam verifies identity, opens claim, asks who's involved.
6. Provide other-driver info. Sam adds party.
7. Take 3 photos via the SMS link Sam sends.
8. **Expect:** Sam summarizes damage in human language, dispatches tow,
   books economy rental, schedules adjuster.

## 2. Home water damage, chat → video switch

1. Sign in as `daniel@example.com` (ACME-HOME-2001).
2. `/claim/new` → home → **chat**. From a phone, say in chat: "My basement
   flooded — pipe burst overnight."
3. Continue in chat. Sam asks the right home-specific questions
   (peril_identified → property_verified → habitable → mitigation_taken).
4. Switch to video via the toggle.
5. **Expect:** Sam picks up where chat left off — references the burst
   pipe without making you re-state.

## 3. Returning user

1. Submit a claim as `daniel@example.com`, then sign out.
2. Run `update claims set stage='photos' where user_id=...` to roll the
   claim back to mid-flow.
3. Sign in again the next day. `/claim/new` → video.
4. **Expect:** Sam opens with the memory hint: "Welcome back, Daniel. I
   see your claim CL-… is at the photos stage — want to pick up there?"

## 4. Spanish renters theft

1. Sign in as `sofia@example.com` (preferred_lang=es).
2. `/claim/new` → renters → video.
3. Entire conversation in Spanish.
4. Walk through inventory aloud — TV, laptop, jewelry.
5. **Expect:** Sam asks for police report number, prompts for inventory,
   sends SMS in Spanish.

## 5. Emergency interrupt

1. Mid-conversation, say "Espera, creo que huelo gas."
2. **Expect:** Sam immediately calls `file_emergency`, surfaces 911, stops
   the claim flow.
3. Admin dashboard shows emergency_flagged within 5s.
