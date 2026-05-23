# Launch checklist

Sign off before flipping production traffic.

## Secrets

- [ ] All vars from `.env.example` populated in Vercel production env
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `TOOL_JWT_SECRET` are NOT in the repo
- [ ] `TOOL_JWT_SECRET` is at least 32 random bytes (cryptographically generated)
- [ ] `TAVUS_WEBHOOK_SECRET` configured in Tavus persona dashboard

## Database

- [ ] Migrations 0001–0005 applied
- [ ] RLS enabled on every table (run `tests/unit/rls.test.ts`)
- [ ] PostGIS extension confirmed (`select * from pg_extension where extname='postgis'`)
- [ ] Daily backups enabled (Supabase dashboard → Settings → Backups)
- [ ] Service role key NEVER returned in any RSC / route response

## Auth + AuthZ

- [ ] Magic-link login round-trip verified end-to-end
- [ ] As user A, cannot SELECT user B's claim via Supabase REST
- [ ] As user A, cannot dispatch tool against user B's claim (verify 403 from `/api/tools/<name>`)

## Webhooks

- [ ] Tavus → `/api/tavus/webhook` HMAC: tamper test returns 401
- [ ] Expired JWT → tool dispatch returns 401
- [ ] Storage event → Edge Function `analyze-photos` triggers (check logs)

## Rate limiting

- [ ] 11th tool call within 60s from same IP returns 429
- [ ] Conversation create limit: 30/min/IP

## Observability

- [ ] PostHog receiving `claim_started`, `claim_submitted`, `escalated`
- [ ] Helicone showing Anthropic token spend per session
- [ ] Admin dashboard accessible (and locked down to staff only — TODO in M17)

## UX

- [ ] Lighthouse PWA score ≥ 90
- [ ] "Add to Home Screen" works on iOS Safari + Android Chrome
- [ ] Photo capture flow works on iOS Safari 17+
- [ ] Spanish locale full parity verified by native speaker

## Persona

- [ ] EN + ES personas live in Tavus dashboard
- [ ] All 18 tools registered on persona's LLM layer
- [ ] Raven perception layer enabled with distress queries
- [ ] KB documents uploaded (`auto.md`, `home.md`, `renters.md`, `glossary.md`)

## Load

- [ ] 50 concurrent video sessions sustained for 10 minutes
- [ ] Tool dispatch p95 < 2s

## Runbook

- [ ] `docs/runbook.md` reviewed by on-call
- [ ] On-call rotation set up with paging for `emergency_flagged` events
