# FNOL build progress

Tracking module-by-module completion. Updated after each commit.

## Modules

- [x] **M0** — Bootstrap Next.js + landing
- [x] **M1** — DB schema, RLS, magic-link auth, seed
- [x] **M2** — Tavus persona EN+ES, KB, setup script
- [ ] **M3** — Bare conversational loop (no tools)
- [ ] **M4** — Read-side tools (verify_identity, get_policy_details, validate_coverage)
- [ ] **M5** — Write-side tools + state machine
- [ ] **M6** — Photo capture + upload (Twilio SMS)
- [ ] **M7** — Claude Vision pipeline
- [ ] **M8** — Partner adapters (mock) + booking tools
- [ ] **M9** — Estimate, submit, summary tools
- [ ] **M10** — Safety: escalation, emergency, distress
- [ ] **M11** — Chat fallback with same tool registry
- [ ] **M12** — Tavus Memory for returning users
- [ ] **M13** — Spanish locale full parity
- [ ] **M14** — PWA + mobile polish
- [ ] **M15** — Admin live ops dashboard
- [ ] **M16** — Observability (PostHog/Helicone) + rate limiting
- [ ] **M17** — Hardening + launch checklist

## Credentials state

| Service     | Status         | Notes                                     |
| ----------- | -------------- | ----------------------------------------- |
| Tavus       | provided       | Persona to be created via M2 script       |
| Supabase    | provided       | Migrations apply in M1                    |
| Anthropic   | provided       | Used for chat (M11) + vision (M7)         |
| Twilio      | not provisioned | SMS adapter falls back to console + log   |
| Resend      | not provisioned | Email adapter falls back to console + log |
| Upstash     | not provisioned | Rate limiter no-ops; M16 toggles on       |
| PostHog     | not provisioned | Optional; env-gated                       |
| Helicone    | not provisioned | Optional; routes through if base URL set  |

Adapters use a shared "feature flag if env present" pattern so missing
credentials never break the build — they just log to console instead.

## Notes

- Package manager: **bun**. Run `bun install`, `bun dev`.
- Repo initialized as standalone; not tied to a parent monorepo.
