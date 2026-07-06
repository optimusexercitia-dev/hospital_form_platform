# ADR 0059 — Coolify as the pre-Phase-9 dev/staging deployment target

**Date:** 2026-07-06
**Status:** Accepted
**Phase:** ahead of Phase 9

## Context

Phase 9 (Deployment) is still 🔜 not started; PHASES.md's plan for it is a
hand-rolled `docker-compose` + Caddy (auto-HTTPS) stack on the DigitalOcean
droplet, gated behind the pilot (ADR 0057). The user wants an earlier,
low-effort deployment reachable now, on a droplet already running Coolify (a
self-hosted PaaS), so the app is browsable before the accreditation-track
pilot triggers the formal Phase 9 gate. This is explicitly a dev/staging
deployment, not a production launch, and must not disturb local development
(`npm run dev` against local Supabase Docker).

## Decision

Deploy via Coolify's "Dockerfile" application type against the existing
multi-stage `Dockerfile` (added `db966f9`, unmodified — build-tested clean in
this session: `docker build` + a running container serving `/login` 200 /
`/` 307). No `docker-compose`/Caddy is added: Coolify's built-in Traefik proxy
already supplies TLS + domain routing, so a compose/Caddy stack would
duplicate that and add drift risk. `docker/` stays reserved and empty for a
possible future non-Coolify option.

The deployment targets the existing linked remote Supabase Cloud project
(`azkbbhskturikxpgmafq`) — never local Supabase. All secrets are supplied
through Coolify's environment-variable UI, never committed; `NEXT_PUBLIC_*`
vars must be marked as **build** variables (Next.js inlines them into the
client bundle at `next build`, confirmed via `src/lib/supabase/browser.ts`).
Runbook: [docs/deploy-coolify.md](../deploy-coolify.md).

## Consequences

- Not a Phase-9 completion. Phase 9's CI pipeline, the full `docs/DEPLOY.md`
  runbook with backup notes, and the production Supabase checklist remain
  open and still gate the eventual pilot launch.
- It DOES exercise the already-flagged ADR 0009 prod-auth gap (asymmetric
  JWT signing keys / JWKS against Supabase Cloud — PROGRESS.md Follow-ups)
  ahead of schedule. Per that follow-up, a legacy HS256 project doesn't hard-
  fail; `getClaims()` silently falls back to a per-request `getUser()` GoTrue
  call, re-introducing the P2-002 login race under concurrent load. The
  runbook's pre-flight step makes checking/fixing this explicit so it's
  caught here, not at the pilot.
- Remote DB must be brought current (`supabase db push`) before this
  deployment is useful — remote is missing the Phase-15 (`indicators_*`)
  migrations as of this ADR. That push is a one-time human action (background
  agents can't authorize a remote push) and is not repeated by this ADR for
  every future deploy.
- Local development is untouched: no changes to `next.config.ts`,
  `package.json`, `.env.local`/`.env.example`, or any app code.
