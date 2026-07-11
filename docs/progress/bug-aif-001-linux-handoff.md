# BUG-AIF-001 — Linux repro CONFIRMED; root-cause handoff

> ## ★ RESOLVED 2026-07-11 (session 2) — read this first
>
> **Root cause: an upstream Next.js App-Router bug, NOT a server-side RSC truncation.**
> A `loading.tsx` Suspense boundary in the route chain + the server-action **deferred
> `router.refresh()`** trip [`vercel/next.js` PR #95391](https://github.com/vercel/next.js/pull/95391)
> (regression from #82674: a discarded action advances the router action queue against stale
> state while a nav is in flight, so the deferred refresh never flushes → the transition stays
> pending). Matches issues **#86151** ("loading.js soft-nav stuck **despite receiving the page
> from the server**"; removing `loading.tsx` fixes it), **#86055**, disc **#82289**.
>
> **The "silent RSC truncation / body never delivered" framing below is WRONG** — `CDP
> getResponseBody: No data` happens because React already **consumed** the fetch body then
> aborted it (the same "ERR_ABORTED after consuming the payload" note is the tell). The response
> arrives; the client router just fails to apply it. The "minimal app is clean → not a Next bug"
> test was under-powered: it had **no `loading.tsx`** and trivial content, the two ingredients
> the upstream repros require. A queue/timing bug is load-dependent → minimal clean, heavy hangs.
>
> **Proven on this app (prod standalone build, local Supabase), 3-run control matrix:**
> | run | next | loading.tsx | AC-ActionItems |
> | --- | --- | --- | --- |
> | 1 baseline | 16.2.9 | present | **HANGS** (dialog `toHaveCount(0)` never met) |
> | 2 remove boundary | 16.2.9 | both ancestors removed | **PASS (6.8s)** |
> | 3 upgrade | 16.3.0-preview.5 | present | **PASS (6.1s)** |
>
> **Fix landed:** `next` 16.2.9 → **16.3.0-preview.5** (carries #95391); keeps every loading
> skeleton and fixes the whole class app-wide (all `action→refresh` dialogs, not just cases).
> Move to **16.3.0 stable** when it ships (a 16.2.x backport of #95391 would also do). No
> react/react-dom change needed (the fix is in Next, not react-dom). The Docker/Linux harness
> below is now moot for root-causing but kept for the record. Full trail → memory
> `case-dialog-prod-refresh-layout-revalidate`.

---

**Status (2026-07-11):** the prior session's **KEY OPEN QUESTION is now ANSWERED**.
BUG-AIF-001 (real-app server-action RSC responses silently truncated → `useActionState`
dialogs hang on "Salvando…/Enviando…" after a successful write) **REPRODUCES ON NATIVE
LINUX**, not just the Windows prod-standalone build. It is therefore a **real
production / pilot blocker** (Coolify deploys Linux/Docker — ADR 0059), NOT a
Windows-local-standalone artifact.

Per the product owner, the **root-cause investigation continues in a new dedicated
session**. This doc is the handoff: the decisive finding, the exact reproducible harness,
what's ruled out, the remaining confound to close, and the prime suspect + next steps.

---

## The decisive experiment (what settled it)

Topology that eliminates ALL Windows networking from the browser↔app path:
- App = the **real deploy Dockerfile** image (`node:22-alpine`, Next 16.2.9 standalone,
  `node server.js`) — Linux.
- Browser = Playwright **Linux** container.
- Both on a user-defined Docker network (`aifnet`); browser hits the app by container name
  (`http://hforms-aif:3000`). This traffic stays **inside Docker Desktop's Linux VM** — no
  Windows userspace port-proxy, no Windows Node server.

Result: `AC-ActionItems` (`e2e/cases-extras.spec.ts:486` — a pure form server action, the
original non-F2 BUG-AIF-001 repro) **hung**: the action-item dialog stayed open for the full
15 s (`aiDialog` `toHaveCount(0)` never satisfied, "34 × locator resolved to 1 element").
Disambiguation confirmed it is the **truncation**, not an action failure:
- **The write LANDED** — `action_items` count increased after the run.
- **No server-side error** — `docker logs hforms-aif` clean during the action.
- The spec reached line 513 (deep), so login + nav + dialog-open + submit all worked; only
  the server-action **response** hung.

This matches the prior session's signature exactly (200 `text/x-component`, body never
delivered, write lands, no error) — now on Linux.

> The earlier "Windows-specific" framing was wrong. The truncation is **real-app-specific**
> (a minimal Next 16.2.9 app is clean on Linux Node 22/24 — prior session) **and reproduces
> on Linux**. The two are consistent: the minimal app doesn't trigger it; the heavy real app
> does, on any platform.

---

## Reproducible harness (rebuild in ~10 min)

Local Supabase must be up (`supabase status`). The single trick that makes host-browser and
container agree on one Supabase URL: **`host.docker.internal`** resolves on the Windows host
(→ host LAN IP) AND inside containers (→ host), and local Kong is published on
`0.0.0.0:54321`, so `http://host.docker.internal:54321` reaches the same local stack from
both. (Confirmed: `ping host.docker.internal` → 192.168.15.6; container `node -e fetch(...auth/v1/health)` → GoTrue OK.)

**1. App image** (reads the local anon key inline — never commit it):
```bash
set -a; source <(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local); set +a
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t hforms-aif:latest .
```

**2. Derived runtime env** (all of `.env.local`, URL rewritten to host.docker.internal):
```bash
sed 's|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321|' \
  .env.local > <scratch>/aif.env
```

**3. Run app + network:**
```bash
docker run -d --name hforms-aif -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  --env-file <scratch>/aif.env hforms-aif:latest
docker network create aifnet && docker network connect aifnet hforms-aif
# health: curl http://127.0.0.1:3000/api/health  → 200
```

**4. Playwright Linux runner image** — `Dockerfile.pw`:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.60.0-noble
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx playwright install chromium
```
```bash
docker build -f <scratch>/Dockerfile.pw -t hforms-pw:latest .
```

**5. Override config** — `playwright.aif.config.ts` (repo root; **gitignore or delete after** —
do not commit):
```ts
import base from './playwright.config'
import { defineConfig } from '@playwright/test'
export default defineConfig({
  ...base,
  webServer: undefined,                                  // app container already running
  use: { ...(base.use ?? {}), baseURL: process.env.APP_URL ?? 'http://hforms-aif:3000' },
})
```

**6. Run the decisive spec** (pure-Linux path). **GOTCHAS:**
- `.dockerignore` excludes `e2e/`, so **bind-mount** it (the pw image has no specs).
- Mount it **WRITABLE** — `F2-4` writes `e2e/_tmp_f2_case.pdf` (EROFS if `:ro`). **Prefer
  `AC-ActionItems`** — pure form action, no temp file, cleanest signal.
- Pass `--env-file aif.env` (specs' audit-row REST checks need `SUPABASE_SERVICE_ROLE_KEY`;
  reachable via host.docker.internal).
```bash
supabase db reset --local            # clean seed baseline
docker run --rm --network aifnet \
  --add-host=host.docker.internal:host-gateway \
  --env-file <scratch>/aif.env -e APP_URL=http://hforms-aif:3000 \
  -v "<repo>/e2e:/work/e2e" \
  hforms-pw:latest \
  npx playwright test -g "AC-ActionItems" --project=chromium --workers=1 \
    --reporter=line --config=playwright.aif.config.ts
# HANG (dialog toHaveCount(0) times out) + action_items count +1 = BUG-AIF-001 on Linux.
```

Confirm the write: `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres
-c "select count(*) from public.action_items where created_at > now() - interval '15 min';"`

---

## Ruled out (prior session + this one — each by experiment)

- **NOT a Next 16.2.9 / Node / OS version regression** — minimal app clean on Windows Node 24,
  Linux Node 22, Linux Node 24. (Do NOT downgrade Next.)
- **NOT Windows-only** — reproduces on native Linux (this session). ← the update.
- **NOT the `@supabase/ssr` proxy** (`src/proxy.ts`) — bisected.
- **NOT `revalidatePath`** (path nor scope), **NOT response size/latency** (300 KB + 1.2 s
  repaints fine), **NOT the dialog wiring** (`useActionState`+effect and `useTransition`+await
  both hang; both work in the minimal repro).
- **`net::ERR_ABORTED` is a red herring** — appears even when the action resolves fine (React
  cancels the fetch after consuming the payload). The real signal is the response **body
  unreadable / dialog never closes**, not the abort.

## Residual confound to close FIRST in the new session

The app container's **RSC re-render after the action still fetches data over
`host.docker.internal` (crosses to the Windows host)** for its server-component queries. Low
probability it matters (the original Windows-native repro used fast pure-local Supabase and
still truncated; no server errors; latency already ruled out) — but to make the Linux result
airtight, **run Supabase itself inside `aifnet`** (fully containerized, zero host-crossing):
attach the app + pw containers to `supabase_network_azkbbhskturikxpgmafq` (or point the app at
`http://supabase_kong_azkbbhskturikxpgmafq:8000`) so nothing touches Windows. Re-run
AC-ActionItems; a hang there is 100% Linux.

## Prime suspect + next steps

The truncation is specific to the **real app's heavier RSC output** on the prod Node server
(minimal app can't reproduce). Suspects: a specific component/dependency in the heavy
case-detail tree (`manage/cases/[caseId]`) that breaks React Flight streaming under prod, or a
Node HTTP response-stream flush edge case that only bites larger real-app RSC payloads.

Suggested attack:
1. **Instrument the Node server's response stream** — wrap/observe the outgoing
   `text/x-component` server-action response in the standalone server (or a small custom
   `server.js` shim) and log bytes-written vs the flight renderer's intended length; see
   whether the server flushes short (server truncation) vs the socket closes early.
2. **Bisect the case-detail component tree** — progressively strip components/providers from
   `manage/cases/[caseId]` (GSAP islands, heavy client trees, markdown/recharts, etc.) and
   re-run AC-ActionItems until it stops truncating → the offending subtree.
3. **Compare page weight / streaming boundaries** — the action re-renders the *current route*;
   look for Suspense/streaming boundaries or a component that emits a very large or
   never-closing flight chunk.

## Temp artifacts from this session

- Docker images `hforms-aif:latest`, `hforms-pw:latest`; network `aifnet`; container
  `hforms-aif` (may be stopped). Reusable by the new session; rebuild via the harness above.
- `playwright.aif.config.ts` (repo root) — **removed** at end of this session (content above);
  recreate it. `Dockerfile.pw` + `aif.env` were in scratchpad (session-temp; `aif.env` holds
  secrets — recreate from `.env.local`, never commit).

Related memories: [[case-dialog-prod-refresh-layout-revalidate]] (updated with this finding),
[[e2e-standalone-server-not-next-start]], [[e2e-gate-prod-build]], [[e2e-prod-build-flaky-baseline]].
