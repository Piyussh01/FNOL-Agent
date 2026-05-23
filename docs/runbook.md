# FNOL runbook

Operational reference for on-call. Pair with `docs/PROGRESS.md` for what's
shipped vs. what's stub.

## Critical secrets

All live in Vercel env (production) + Supabase env (Edge Functions) — never
in the repo.

| Var                            | Owner / where used                       |
| ------------------------------ | ---------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`    | Server-only. Bypasses RLS. Treat as root.|
| `TAVUS_API_KEY`                | Server-only. Persona + conversation API. |
| `TAVUS_WEBHOOK_SECRET`         | HMAC for `/api/tavus/webhook`.            |
| `ANTHROPIC_API_KEY`            | Chat + vision.                            |
| `TOOL_JWT_SECRET`              | Signs JWTs passed to Tavus tool calls.    |
| `RESEND_API_KEY`               | Email (photo link + summary).             |
| `UPSTASH_REDIS_REST_TOKEN`     | Rate limiter.                             |

## Rollback

A bad release? `vercel rollback` to the previous deployment. Supabase
migrations are forward-only — never `down`-migrate prod. Re-apply a
corrective migration instead.

## Secret rotation

1. Generate new value.
2. Add it to Vercel as a new var (e.g. `TOOL_JWT_SECRET_NEXT`).
3. Deploy a build that accepts either old or new in `lib/auth/tool-jwt.ts`.
4. Wait for the old value's longest TTL to drain (tool JWTs: 1 hour).
5. Promote new var to the canonical name, remove the old.

## Incident response

1. **Acknowledge in /admin** — open `/admin`, see Distress alerts +
   Incidents panel.
2. **Triage** — for emergencies (`type='emergency_flagged'`) call the user
   directly using the phone on `users`.
3. **Hot-patch** — if a tool is broken: deploy `lib/tools/handlers/<name>.ts`
   throwing a friendly error → Sam can apologize and offer escalation.
4. **Pause new claims** — set `NEXT_PUBLIC_DISABLE_NEW_CLAIMS=true` (M17
   hook in `app/claim/new/page.tsx` reads this and redirects to a status
   page).

## Daily checks

- Supabase: backups enabled (Daily, 7-day retention).
- Helicone: token spend trend; alert at $X/day.
- PostHog: claim_started → claim_submitted funnel; alert on sharp drops.

## Demo reset

To wipe non-prod data and re-seed:

```bash
supabase db reset           # destroys local DB
supabase db push            # reapplies migrations 0001-0005
```

The seed (`0004_seed.sql`) creates 3 users with deterministic UUIDs so
manual testing works the same each time.
