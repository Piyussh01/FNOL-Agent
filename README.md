# FNOL — Acme Insurance

AI First-Notice-of-Loss intake agent for a fictional carrier. A policyholder
opens the web app, signs in via magic link, and is greeted by **Sam**, a Tavus
CVI agent who walks them through filing an auto / home / renters claim end-to-end.

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase (Postgres + RLS, Auth, Storage, Edge Functions, Realtime, PostGIS)
- Tavus CVI for video; Daily transport
- Anthropic Claude Sonnet (chat + vision)
- Resend email

## Quickstart

```bash
bun install
cp .env.example .env.local        # fill in what you have
bun dev
```

Open <http://localhost:3000>. The "File a claim" CTA on the landing page is the
front door.

