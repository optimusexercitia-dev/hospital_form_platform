# Deploying to DigitalOcean + Coolify (test environment)

This runbook stands up the platform on a **DigitalOcean droplet running
[Coolify](https://coolify.io)**, with the app talking to the **existing Supabase
Cloud project** (`azkbbhskturikxpgmafq`). It also sets up **auto-deploy on git
push**, so the local-dev → push → live loop works while you keep building.

> **Scope:** this is a *test* deployment, not the formal Phase 9 gate. It builds
> the deploy substrate (Dockerfile image, health probe, env contract, Supabase
> Cloud config) that Phase 9 will later formalize (CI, Caddy/runbook, backups).

---

## Architecture

```
 GitHub (optimusexercitia-dev/hospital_form_platform)
    │  push to the deploy branch  ──►  webhook
    ▼
 Coolify (DigitalOcean droplet)
    │  builds the Dockerfile (Next.js standalone image)   ← NEXT_PUBLIC_* baked in
    │  runs the container on :3000, TLS via Coolify proxy
    ▼
 Supabase Cloud project  azkbbhskturikxpgmafq
    (Postgres + Auth + Storage + RLS)   ← migrations pushed with the Supabase CLI
```

The app is **stateless**: all data, auth, and files live in Supabase Cloud. The
container holds no state, so redeploys are safe and disposable. The database is
deployed **separately** from the app (Supabase CLI), never from inside the image
— `supabase/` is `.dockerignore`d.

---

## One-time prerequisites

1. **DigitalOcean droplet with Coolify installed.** A 2 vCPU / 4 GB droplet is a
   comfortable minimum (Coolify + a Node build). Install per
   <https://coolify.io/docs/installation>. Point a DNS `A` record (e.g.
   `app.yourdomain.com`) at the droplet IP.
2. **Coolify ↔ GitHub connected.** In Coolify → *Sources*, connect the GitHub
   account/org (`optimusexercitia-dev`) via the GitHub App (preferred — gives
   automatic webhooks) or a deploy key.
3. **Supabase CLI locally**, logged in and able to reach the project
   (`supabase login`). You already have `db:*` npm scripts wired to it (below).

---

## Step 1 — Bring the Cloud database up to the current schema

The remote project is **behind local** (many migrations were applied only
locally) and the migration history was **squash-baselined** (`20260620000000`).
For a test project the clean, reliable path is a **destructive linked reset** —
it drops the remote schema and replays every migration + the seed from scratch.

> ⚠️ **`db:reset:linked` is destructive** — it wipes ALL data in the remote
> project. That's intended here (test project), but never run it against a
> project holding real data.

```bash
npm run db:link           # supabase link --project-ref azkbbhskturikxpgmafq
npm run db:reset:linked   # supabase db reset --linked  (drops + replays all 57 migrations + seed)
npm run gen:types:linked  # regenerate src/lib/types from the linked schema (optional sanity check)
```

After it completes, verify in the Supabase Dashboard:
- **Table Editor** shows the full schema (profiles, commissions, forms, cases,
  meetings, audit_log, NSP/referral tables, etc.).
- **Storage** shows the buckets the migrations create (e.g. `form-assets`,
  `meeting-attachments`, and the PHI-tiered buckets). They are created by
  migrations, not `config.toml`.
- The seeded personas exist (see the platform README / `supabase/seed.sql`):
  `admin@test.local`, `chefe.ccih@test.local`, `staff1.ccih@test.local`, plus the
  commission-B equivalents. Password for all: `Test1234!`.

**Ongoing:** once a feature adds new migrations locally, ship them to the remote
with an **incremental push** (non-destructive) *before* the app deploy that needs
them:

```bash
npm run db:push           # supabase db push  — applies only new migrations
```

---

## Step 2 — Configure the Supabase Cloud project (Dashboard)

These are Cloud-only settings that are **not** pushed by the CLI (`config.toml`
is local-dev config and is not applied to Cloud).

### 2.1 — Auth → URL Configuration

- **Site URL:** `https://app.yourdomain.com` (your Coolify domain). This is the
  default post-auth redirect target and is baked into the invite/recovery email
  links.
- **Redirect URLs (allowlist):** add `https://app.yourdomain.com/**`. Supabase
  only redirects to URLs that match this allowlist, so without it every
  invite/recovery link and post-login `redirect` bounce is rejected. Keep the
  local entries (`http://localhost:3000/**`) so local dev still works.

### 2.2 — JWT signing keys: migrate to asymmetric (the ADR 0009 "prod-auth gap")

**This is the highest-risk step.** The auth gate in `src/proxy.ts` and every
identity read in `getSessionContext()` establish who you are with
`supabase.auth.getClaims()`. Per the Supabase docs, `getClaims()`:

- verifies the JWT **locally** against the project's JWKS
  (`/.well-known/jwks.json`) using WebCrypto **only if the project uses
  asymmetric signing keys (ECC/RSA)** — no network call on the hot path;
- otherwise (legacy shared **HS256** secret) it **falls back to a network
  request** to validate every token.

That fallback is exactly the per-request GoTrue round trip ADR 0009 removed
because it raced and spuriously logged users out (~40% of logins) under load.
The local Supabase stack already signs with ES256 + publishes a JWKS, so this
path works in dev — but the Cloud project has historically used the legacy HS256
secret, so **it has never actually run the local-verification path in
production.** Fix it before trusting the deploy:

1. Dashboard → **Project Settings → JWT Keys** (a.k.a. "JWT Signing Keys").
2. If the project is still on the **legacy / shared secret (HS256)**, start the
   migration: create/generate a **current asymmetric key** (ECC `ES256` is the
   default) → this becomes the *standby* key → **rotate** it to *current* so new
   tokens are signed with it. Supabase keeps the previous key as *previously
   used* so sessions issued under the old key stay valid until they expire.
3. Confirm the JWKS endpoint now serves the public key:
   `curl https://azkbbhskturikxpgmafq.supabase.co/auth/v1/.well-known/jwks.json`
   should return a key set with your ECC/RSA key (not an empty `{"keys":[]}`).
4. **API keys note:** Supabase no longer lets you rotate the *legacy* anon/
   service_role/JWT secrets, and steers projects to the new **publishable/secret
   API keys** alongside JWT signing keys. Whichever key set the project ends up
   on, copy the **current anon/publishable key** into
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the **service_role/secret key** into
   `SUPABASE_SERVICE_ROLE_KEY` in Coolify (Step 4). The `.env.local` values are
   the OLD project keys — always re-copy from the Dashboard after this step.

### 2.3 — Enable the custom access-token hook (the `is_admin` claim)

The second half of the ADR 0009 posture (via ADR 0002): admin UI trusts the
`is_admin` **claim** injected by a Postgres auth hook — `getSessionContext()`
reads `claims.is_admin` and **fails closed** (treats you as non-admin) if the
claim is absent. The hook is registered in `config.toml` for local dev, but
**that file is not applied to Cloud**, so you must enable it in the Dashboard or
every admin (including `admin@test.local`) silently loses the admin area.

1. The hook function `public.custom_access_token_hook` and its
   `supabase_auth_admin` grants are already created by the migrations you pushed
   in Step 1 — nothing to write.
2. Dashboard → **Authentication → Hooks (Auth Hooks)** → **Customize Access Token
   (JWT) Claims** → set to a **Postgres function** → schema `public`, function
   `custom_access_token_hook` → **Enable**.
3. This takes effect on the **next token issuance**, so sign out / sign back in
   after enabling it before checking admin access.

### 2.4 — SMTP + email verification (optional at first)

Leave `AUTH_EMAIL_VERIFICATION=off` (Step 4 env) until email works — registration
then creates accounts active with an admin-set password and no email round trip.
To enable the invite/recovery flow later: **Auth → SMTP Settings** → configure
Resend (host `smtp.resend.com`, user `resend`, your API key as the password, a
verified sender). Then **Auth → Email Templates** → paste the pt-BR templates
from `supabase/templates/invite.html` and `supabase/templates/recovery.html`
(the defaults link to a route the server can't read — BUG-UREG-002). Only then
flip `AUTH_EMAIL_VERIFICATION=on` in Coolify and redeploy.

### 2.5 — Bootstrap the FIRST `platform_admin` (manual SQL — there is no in-app path)

⚠ **On a production database that was not seeded, this step is mandatory and nothing
in the product can do it for you.** `profiles.is_admin` is written only by direct SQL,
and the in-app promote guard requires an **existing** admin to promote another — so the
admin set is *closed under the product*. A fresh Cloud database starts with it empty,
and no screen, action or RPC can open it. Skip this step and Step 6.3 fails with the
"logs in but never lands on `/admin`" symptom **even when the Step 2.3 hook is correctly
enabled**, because the hook is faithfully reporting `is_admin = false`.

⛔ **Do not "fix" this by weakening the promote guard.** The closure is deliberate — it
is exactly what stops a normal user self-promoting. The gap is that the bootstrap is
manual, not that the guard is wrong.

1. Create the account through the normal sign-up / invite flow first, so GoTrue owns the
   identity and a `profiles` row exists. Do **not** hand-insert into `auth.users`.
2. Dashboard → **SQL Editor**, promote that one account **by email**:

   ```sql
   update public.profiles p
      set is_admin = true
     from auth.users u
    where u.id = p.id
      and u.email = 'the-real-admin@yourdomain.com';
   ```

3. Confirm exactly one row came back, and that it is the intended person:

   ```sql
   select u.email, p.is_admin
     from public.profiles p
     join auth.users u on u.id = p.id
    where p.is_admin;
   ```

4. Have that user **sign out and back in** — `is_admin` rides the access-token claim
   (Step 2.3), so an already-issued token keeps the old value until it is re-minted.

Every later `platform_admin` goes through the admin UI. This SQL is a one-time
bootstrap per environment, not an operational tool.

> Why this is written down: tracked as **BUG-BOOTSTRAP-001**. Local and E2E never hit it
> because `supabase/seed.sql` supplies `platform@test.local` already promoted — which is
> precisely why the gap is invisible to every gate and surfaces for the first time on a
> real deploy.

---

## Step 3 — Create the Coolify application

1. Coolify → your project → **+ New → Application → Public/Private Repository**,
   pick `optimusexercitia-dev/hospital_form_platform`.
2. **Branch:** choose your deploy branch (e.g. `main`, or a dedicated `deploy`
   branch — see Step 5).
3. **Build Pack: `Dockerfile`.** Coolify auto-detects the root `Dockerfile`
   (multi-stage Next.js standalone). No compose file is needed — the app is a
   single container pointing at external Supabase.
4. **Port:** `3000` (the Dockerfile `EXPOSE`s it).
5. **Domain:** set `https://app.yourdomain.com`. Coolify provisions Let's Encrypt
   TLS automatically once DNS resolves.
6. **Health check:** path `/api/health`, port `3000`, expect `200`. (The image
   also carries a Docker `HEALTHCHECK` hitting the same route.)

---

## Step 4 — Environment variables in Coolify

Add these under the application's **Environment Variables** tab. Full annotated
list in [`.env.production.example`](../../.env.production.example).

| Variable | Value | Build Variable? | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://azkbbhskturikxpgmafq.supabase.co` | **Yes** | Baked into the client bundle at build AND read at runtime. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Dashboard → Settings → API → anon key)* | **Yes** | Public/anon key; safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Dashboard → Settings → API → service_role)* | **No** | Server-only secret. Bypasses RLS. Never a build var. |
| `AUTH_EMAIL_VERIFICATION` | `off` | No | Flip to `on` only after SMTP works (Step 2). |
| `RESEND_API_KEY` | *(blank)* | No | Only if a server route sends mail directly; Cloud auth mail uses Dashboard SMTP. |
| `MINUTES_SERVICE_URL` | `https://minutes.yourdomain.com` *(no trailing slash)* | No | MIN · audio → ata. Base URL of the deployed `minute_generator`. |
| `MINUTES_SERVICE_API_KEY` | *(= the service's `API_KEY`)* | No | Server-only. Mint a NEW production value — never the local smoke pair. |
| `MINUTES_CALLBACK_HMAC_SECRET` | *(= the service's `CALLBACK_HMAC_SECRET`)* | No | Server-only. A mismatch makes every callback a silent 401 and the job dies at the 24 h TTL. |
| `MINUTES_CALLBACK_BASE_URL` | *(unset)* | No | Leave unset in normal production; set only behind a Host-rewriting proxy (runbook §3). |
| `PDF_RENDERER_URL` | `http://<coolify-service-name>:3000` | No | PDF·P1 · Gotenberg sidecar, on the app's internal network — never a public domain. Container port is always 3000. |
| `PDF_VERIFICATION_BASE_URL` | `https://app.yourdomain.com` *(no trailing slash)* | No | Printed inside every QR. **Configured, never derived** — a spoofable `Host` must not reach paper. |

> **Why "Build Variable" matters:** `NEXT_PUBLIC_*` values are compiled into the
> JS at `next build`. Coolify passes build variables as `--build-arg`, which the
> Dockerfile consumes (`ARG NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY`). If you
> forget the toggle, the browser bundle ships with empty Supabase config and the
> app can't reach the backend even though the server env is set.

> **The `MINUTES_*` block is inert until you activate MIN.** All four are gated by
> the `audio_minutes` feature flag, which ships **OFF** — with the flag off they may
> be absent and nothing breaks. They also need the `minute_generator` service
> deployed as its **own Coolify resource** (a Docker Compose build pack, not this
> application). Deploy order, the pre-enable gates, callback reachability and key
> rotation: [`audio-minutes-runbook.md`](./audio-minutes-runbook.md).

> **The `PDF_*` pair is inert until you activate PDF·P1.** Both are gated by the
> `document_printing` feature flag, which ships **OFF**. The Gotenberg sidecar is
> its own Coolify resource — type *Docker Image*, pinned
> **`gotenberg/gotenberg:8.24.0`** (never `latest`, never `8`) — with **no public
> domain and no HTTPS route**: from P3 onward the HTML it receives IS the PHI, so it
> must be reachable only on the app's internal Docker network. Sidecar setup,
> resource caps (~1 GB / ~1 CPU, so a render OOM kills the renderer and not the web
> app) and the pin-upgrade protocol: [`pdf-renderer.md`](./pdf-renderer.md).

---

## Step 5 — Auto-deploy on git push

- If you connected via the **GitHub App** (Step, prereq 2), Coolify installs the
  webhook automatically. In the application's **Settings → General**, enable
  **"Automatic Deployment"** and confirm the **branch** matches Step 3.
- Every push to that branch now triggers: pull → `docker build` → health-checked
  rolling replace. Watch progress under the app's **Deployments** tab.

**Recommended branch strategy for "test locally, then deploy":**
- Keep building and testing on feature branches / `main` **locally** (local
  Supabase stack — see the workflow below).
- Point Coolify at a **`deploy`** branch (or `main` if you prefer). When a change
  is ready to test on the server, `git push origin <branch>` → Coolify redeploys.
- **Order of operations when a change includes DB migrations:** run
  `npm run db:push` **first** (so the Cloud schema is ready), *then* push code so
  Coolify redeploys against the migrated DB. App-then-DB risks the new build
  querying columns that don't exist yet.

---

## Step 6 — First deploy + smoke test

1. Trigger the first deploy (push, or Coolify **Deploy** button).
2. **Liveness:** `curl https://app.yourdomain.com/api/health` → `{"status":"ok",…}`.
3. **Auth (the ADR 0009 validation):** open the site, log in as
   `admin@test.local` / `Test1234!`. Two distinct things are being validated —
   map the symptom to the fix:
   - **Login bounces straight back to `/login`** (or logs you out on the next
     click) → the `getClaims()` local-verification path is failing against Cloud
     JWTs → revisit **Step 2.2** (asymmetric signing keys / JWKS endpoint).
   - **Login succeeds but you do NOT land on `/admin`** (treated as a normal
     user, no admin area) → the `is_admin` claim is missing or is `false`. Two
     different causes, check both: revisit **Step 2.3** (custom access-token hook
     not enabled → claim absent), and **Step 2.5** (no `platform_admin` was ever
     bootstrapped → claim present but `false`). Then sign out and back in.

   ⚠ On a **non-seeded** production database there is no `admin@test.local` at all —
   use the account you bootstrapped in **Step 2.5**. The seed personas named in this
   step exist only on local/E2E databases and on a Cloud project you reset with
   `npm run db:reset:linked`.
4. Log in as `chefe.ccih@test.local` and open a commission dashboard to confirm
   RLS-scoped reads work end to end (validates the hook + JWKS path for a
   non-admin, role-scoped session too).

---

## Local vs remote — the day-to-day workflow

**Local development (unchanged):** `.env.local` points at the local Supabase
stack. Nothing here changes it.

```bash
supabase start          # local Docker stack
npm run dev             # http://localhost:3000 against local Supabase
# ...build + test a feature; add migrations under supabase/migrations/...
npm run test && npm run e2e
```

**Promote to the remote test server:**

```bash
npm run db:push                 # 1. apply any NEW migrations to Cloud (skip if none)
git push origin <deploy-branch> # 2. Coolify auto-builds + redeploys the app
# 3. verify at https://app.yourdomain.com/api/health and smoke-test the feature
```

Local dev and the remote deploy stay fully isolated — different Supabase
backends, different env files. You never point the local dev server at Cloud
(unless you deliberately swap in the commented remote block in `.env.local`).

---

## Known risks & gotchas

- **ADR 0009 prod-auth gap (highest risk).** Local JWT verification vs Cloud
  signing keys has never run in production. Signing-key config (Step 2.2) is the
  make-or-break item; smoke-test login first (Step 6.3).
- **`NEXT_PUBLIC_*` not marked as Build Variables** → empty client-side Supabase
  config. Most common Coolify misconfig; see Step 4.
- **Migration/app ordering** → deploy the DB before the app for migration-bearing
  changes (Step 5).
- **BUG-AIF-001** (open) is a *Windows local prod-standalone* RSC artifact — the
  mutation-dialog-stuck-on-success bug. It is **not** expected on Linux/Docker,
  but confirming it's absent here is a useful side benefit of this deployment.
- **PHI / BAA.** This project carries PHI in the NSP + referral modules. The
  existing Cloud project is the BAA-covered infrastructure; keep the
  service-role key server-only and don't seed real patient data into this test
  environment.
