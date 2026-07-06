# Coolify Deployment — Dev/Staging Runbook

Scope: get the current `main` branch running on a Coolify-managed DigitalOcean
droplet as a reachable dev/staging deployment. This is **not** Phase 9
(Deployment) — see [ADR 0059](decisions/0059-coolify-deployment-target.md).
Phase 9's CI pipeline, backup runbook, and full production checklist are
still open and gate the eventual pilot launch. This doc only covers getting
one instance of the app up, pointed at the existing remote Supabase Cloud
project, safely.

**This never touches local development.** Nothing here changes
`next.config.ts`, `package.json`, `.env.local`, or app code. The container
image is built from a `git clone` of `main` on the droplet; your local
`npm run dev` + local Supabase Docker stack keep working exactly as before.

The app already ships a working multi-stage `Dockerfile` (root of the repo,
added `db966f9`) — build-tested in this session (`docker build` succeeds,
container serves `/login` → 200, `/` → 307 as expected for an unauthenticated
request). No changes were needed to it.

---

## 0. What you're pointing at

This deployment uses the **remote Supabase Cloud project**
(`azkbbhskturikxpgmafq`, the same one already linked via
`supabase link --project-ref azkbbhskturikxpgmafq`), not local Supabase — a
container on the droplet can't reach your laptop's `127.0.0.1:54321`. Use the
**REMOTE** block already present (commented out) in your `.env.local` for the
URL/anon key/service-role key values you'll paste into Coolify — never the
local block.

---

## 1. Pre-flight on Supabase Cloud (one-time, before the first deploy)

### 1.1 Push pending migrations

Remote is currently missing the Phase-15 (Quality Indicators) migrations —
`main` has them, remote doesn't yet (deploy was deferred to the pilot).
Deploying the current `main` against remote as-is means any indicator page
will error with "relation does not exist". From your machine (this needs your
own Supabase auth — a background agent cannot authorize a remote push):

```bash
supabase link --project-ref azkbbhskturikxpgmafq   # if not already linked in this shell
supabase db push
```

Confirm it applied everything through `20260712000300_indicators_capa_hook.sql`.

### 1.2 Verify asymmetric JWT signing keys (known gap — ADR 0009)

The app verifies session JWTs **locally** (`getClaims()`, ES256 + JWKS) on
every request instead of calling GoTrue, for performance (ADR 0009). This
needs the Supabase project on **asymmetric (ES256/RS256) signing keys**, not
the legacy shared HS256 secret. This has never been validated against
Supabase Cloud (tracked as an open PROGRESS.md follow-up) — this deployment
is a good place to find out.

- Supabase Dashboard → your project → **Project Settings → API → JWT Keys**
  (or **JWT Settings**, naming varies by dashboard version).
- If it shows a **Legacy JWT Secret** only, migrate to the new signing-keys
  system (Supabase supports in-place rotation that preserves existing
  sessions).
- If it's already on asymmetric keys, nothing to do.

If this is missed, the app doesn't hard-fail — `getClaims()` falls back to a
per-request `getUser()` GoTrue call, which silently re-introduces the
P2-002-style login race under concurrent load. Worth fixing properly, not
urgent enough to block a first single-user smoke test.

### 1.3 Register the custom access-token hook

`is_admin` is injected into the JWT by a Postgres hook (ADR 0002); without it
registered on Cloud, admin UI fails closed (safe, but broken).

- Dashboard → **Authentication → Hooks** → "Customize Access Token (JWT)
  Claims hook" → enable → select the Postgres function
  **`public.custom_access_token_hook`**.

### 1.4 Note your keys

From Dashboard → **Project Settings → API**, copy:
- Project URL (`https://azkbbhskturikxpgmafq.supabase.co`)
- `anon` / publishable key
- `service_role` / secret key (never expose client-side)

You'll paste these into Coolify's environment variables in §3. (They're also
already sitting in the commented-out REMOTE block of your local
`.env.local`.)

### 1.5 Email (defer for now)

Leave `AUTH_EMAIL_VERIFICATION=off` (matches current practice — admin sets an
initial password directly, no SMTP dependency). Only revisit SMTP + the
pt-BR email templates (tracked separately in PROGRESS.md Follow-ups) if you
later flip this on.

---

## 2. Get the repo onto the droplet

The repo (`git@github-optimus:optimusexercitia-dev/hospital_form_platform.git`)
is private, so Coolify needs read access. Two options — pick one:

**Option A — Deploy key (simplest, read-only, works with any Git host)**
1. In Coolify: **Sources** (or when creating the app, "Add a Private Key") →
   generate a new SSH key pair.
2. Copy the generated public key.
3. On GitHub: repo → **Settings → Deploy keys → Add deploy key** → paste it,
   read-only (no write access needed).
4. Use `git@github.com:optimusexercitia-dev/hospital_form_platform.git` as
   the repository URL in Coolify (the `github-optimus` host alias only
   exists in your local `~/.ssh/config` — Coolify needs the real host).

**Option B — GitHub App (adds auto-deploy-on-push webhooks for free)**
1. In Coolify: **Sources → GitHub App → Connect**, install it scoped to just
   this repo.
2. Select the repo when creating the application.

Either way, target branch: `main`.

---

## 3. Create the application in Coolify

1. **+ New Resource → Application**, pick the source from §2.
2. **Build Pack: Dockerfile.** Dockerfile location: `Dockerfile` (repo root —
   already there, no path override needed).
3. **Ports Exposes: `3000`** (matches the Dockerfile's `EXPOSE 3000` /
   `PORT=3000`).
4. **Environment Variables** — add these in the Coolify UI (never commit
   them):

   | Name | Value | Build variable? | Notes |
   | ---- | ----- | :--------------: | ----- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://azkbbhskturikxpgmafq.supabase.co` | ✅ yes | Inlined into the client bundle at build time — must be a build var or the browser client breaks. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key from §1.4) | ✅ yes | Same reason. |
   | `SUPABASE_SERVICE_ROLE_KEY` | (service-role key from §1.4) | ❌ no | Server-only. Never mark as a build variable, never prefix `NEXT_PUBLIC_`. |
   | `AUTH_EMAIL_VERIFICATION` | `off` | ❌ no | Matches current practice (§1.5). |
   | `RESEND_API_KEY` | *(leave unset)* | ❌ no | Only needed if you later flip email verification on. |

   Leave `NODE_ENV`, `PORT`, `HOSTNAME` alone — the Dockerfile already sets
   them.

5. **Health check**: path `/login`, expect `200`. **Not** `/` — an
   unauthenticated request to `/` redirects (307) to `/login` by design (the
   auth gate in `src/proxy.ts`), which a strict health check would read as
   unhealthy.
6. **Domain**: assign a subdomain or use Coolify's auto-generated preview
   domain for the first smoke test. Coolify provisions Let's Encrypt TLS
   automatically once a real domain is attached.

## 4. Deploy

Click **Deploy** and watch the build log in Coolify. Expect roughly what the
local smoke build showed: Turbopack compile → typecheck → static page
generation → image export, then the container starts and logs `Ready`.

## 5. Post-deploy Supabase config

Once you know the deployment's URL:
- Dashboard → **Authentication → URL Configuration** → set **Site URL** to
  that URL, and add it to **Redirect URLs**. Needed for the password-reset
  (`/recuperar-senha` → `/redefinir-senha`) and invite flows to build correct
  links.

## 6. Verify

- Visit the domain → should redirect to `/login`.
- Log in with a real remote-project user (whatever admin/staff accounts
  already exist on that Supabase Cloud project — this is real remote data,
  not the local `seed.sql` personas).
- Spot-check one form fill + one dashboard view to confirm RLS/queries work
  end-to-end against Cloud.

## 7. Redeploying later

Whenever `main` gets new commits:
- If it includes new migrations, run `supabase db push` first (§1.1) — the
  app and the DB schema must stay in lockstep; this repo's migrations are
  additive, not auto-applied by the container.
- Trigger a redeploy in Coolify (automatic if you used the GitHub App +
  webhook from §2 Option B; manual "Redeploy" button otherwise).

## 8. What this deliberately does NOT cover

Left for the real Phase 9 gate (ADR 0057, pilot-gated):
- CI (lint + unit + E2E on PR, build-and-deploy on merge to `main`).
- Backup/restore runbook.
- Production Supabase checklist beyond §1 here (email templates upload,
  SMTP, final redirect-URL hygiene for a real domain).
- The BUG-AIF-001 open question (whether the Windows-only prod-standalone
  RSC-truncation bug reproduces on Linux/Docker) — worth a deliberate check
  once this deployment is up, since it's the first time the app runs on
  Linux in a prod-standalone configuration.
