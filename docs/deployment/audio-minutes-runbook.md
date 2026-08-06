# Runbook — meeting audio → generated ata (`audio_minutes`)

ADR [0099](../decisions/0099-meeting-audio-minutes.md) · plan
[audio-minutes.md](../plans/audio-minutes.md) · service repo `minute_generator`.

The feature ships with the flag **OFF** and is enabled per tenant only after the
service's DPA gates (AssemblyAI / RunPod) close and a production smoke passes (D17).

---

## 1. Environment (all server-only)

| Variable | Required | Notes |
| --- | --- | --- |
| `MINUTES_SERVICE_URL` | yes | Service base URL, no trailing slash. |
| `MINUTES_SERVICE_API_KEY` | yes | Must equal the service's `API_KEY`. Sent as `Authorization: Bearer`. |
| `MINUTES_CALLBACK_HMAC_SECRET` | yes | Must equal the service's `CALLBACK_HMAC_SECRET`. |
| `MINUTES_CALLBACK_BASE_URL` | no | Origin override for the callback URL. Leave unset unless the **service's** view of the app differs from a **browser's** (see §3). |

None of these carry `NEXT_PUBLIC_`. A `NEXT_PUBLIC_` prefix on any of them is a
phase-blocking bug — `MINUTES_CALLBACK_HMAC_SECRET` in the client bundle would let
anyone forge a "your ata is ready" callback.

With the flag OFF all four may be absent. With the flag ON and any of the first three
absent, `submitMinutesJob` fails immediately with a pt-BR message and terminates the
job — it does not hang.

## 2. The three size ceilings

A 500 MB upload has to clear **all three**, and only the first is in the migration.

1. **Bucket** — `storage.buckets.file_size_limit = 524288000` for `meeting-audio`,
   set by `20260910000100`. Applies everywhere `db push` reaches.
2. **Local only** — `supabase/config.toml` `[storage] file_size_limit`, raised to
   `512MiB` in the same commit. It is a **global cap above every bucket**, it is read
   at container start, and it is a **committed file**, so:
   - it applies to every worktree at once, and
   - picking it up requires **`supabase stop && supabase start`** — a `db reset` alone
     will not do it.
3. **Cloud** — the project's storage upload-size setting, whose maximum is
   plan-dependent. **Confirm the pilot project's plan admits 500 MB BEFORE enabling the
   flag** and record the value here:

   > Pilot project upload limit as configured: _(fill in at cutover)_

## 3. Callback reachability

The service POSTs to `<origin>/api/webhooks/audio-jobs`. The origin is
`MINUTES_CALLBACK_BASE_URL` when set, else derived from the incoming request
(`origin`, else `x-forwarded-proto` + `host`).

- **Normal production**: leave `MINUTES_CALLBACK_BASE_URL` unset. The user's browser and
  the service both reach the app on the same public URL.
- **Local smoke (T5)**: the browser says `http://localhost:3000` but the service runs in
  its own container, so set
  `MINUTES_CALLBACK_BASE_URL=http://host.docker.internal:3000`.
- **Behind a Host-rewriting proxy**: set it explicitly to the public origin.

The route is excluded from the session gate in `src/proxy.ts` (`api/webhooks` in the
matcher's negative lookahead). If that exclusion is ever lost, every callback is
redirected to `/login`, the job sits `processing`, and the only symptom 24 hours later
is a TTL failure that says nothing about auth. **Verify after any middleware change:**

```bash
curl -i -X POST http://localhost:3000/api/webhooks/audio-jobs -d '{}'
# expect: HTTP/1.1 401  {"error":"unauthorized"}      ← reached the handler
# NOT:    HTTP/1.1 307  location: /login              ← the gate ate it
```

A 401 here is the healthy answer: it proves the request reached the route and failed
signature verification, which is exactly what an unsigned probe should do.

## 4. Key rotation

Both secrets are shared with the service, and the platform holds **one** value for each,
so a rotation is a brief coordinated outage rather than a seamless roll. Chosen policy —
**accept the gap**, because the blast radius is small and bounded:

**`MINUTES_CALLBACK_HMAC_SECRET`**
1. Stop submitting new jobs (flag OFF for the tenant, or simply pick a quiet window).
2. Let in-flight jobs drain, or accept that they will fail their callback and be marked
   failed by the 24 h TTL — the audio is deleted and the user can re-run.
3. Rotate **service-side first**, then platform-side. In the gap, callbacks signed with
   the new secret are rejected 401 and the service retries; once the platform has the new
   value those retries succeed. Rotating the platform first inverts this and drops
   callbacks that will never be retried again.

**`MINUTES_SERVICE_API_KEY`**
1. Rotate **platform-side first**, then service-side, and the gap only affects new
   submissions (they fail cleanly in pt-BR, the job terminates, the user retries).
   In-flight jobs are unaffected — the API key is not used on the callback path.

If a seamless rotation is ever needed, the change is to accept a comma-separated list of
callback secrets and try each — noted here as the known fix, deliberately not built.

## 5. Audio custody (D2)

Audio lives in the private `meeting-audio` bucket and is deleted at the earliest of:
callback with `audio_release=true`, **apply**, cancel, failure, or the **24 h TTL**.

The first four are event-driven and prompt. **The TTL is not a timer** — there is no
cron (D10), so it is evaluated only when something happens. Two triggers run the sweep:

- **every webhook callback delivery** (machine-driven — does not wait for a human), and
- **a page load** that reconciles a job.

Each runs `sweepStaleAudio` (`src/lib/minutes-jobs/sweep.ts`), a bounded pass over
`public.list_stale_meeting_audio` that deletes **every** `meeting-audio` object older
than 24 h and stamps `audio_deleted_at` on the owning job row when one still exists.
It is throttled to once per 10 minutes per app instance.

⚠ **Read ADR 0099 Amendment 1 before quoting a retention figure to anyone.** The real
ceiling is "≤ 24 h plus the gap to the next activity in that tenant", not a wall-clock
guarantee. In a tenant where nothing happens at all, nothing triggers.

Three behaviours worth knowing during an incident:

- A `done` job past 24 h loses its **audio only**. The job stays `done` and keeps its
  transcript/draft: destroying a review the user can already see would be data loss
  wearing a TTL costume.
- A cascaded delete (the meeting row is deleted) takes the job row with it and orphans
  the storage object. There is no delete hook in v1 (PO decision O3) — the **sweep**
  reclaims it, and it is the only thing that can, because every other deletion path
  starts from a job row that no longer exists.
- The sweep's predicate is deliberately blunt: *any* object past 24 h, with no
  per-status branching. A delete that failed, a crashed request and an orphan all
  collapse into the same rule.

To check the sweep's backlog by hand (service-role connection):

```sql
select * from public.list_stale_meeting_audio(24, 50);
-- rows = objects past the TTL awaiting a trigger. job_id NULL = cascade-orphaned.
-- Empty is the healthy steady state.
```

## 6. Pre-enable checklist

- [ ] Service deployed, `GET /health` green, DPA gates closed.
- [ ] All three env vars set on the app, matching the service's values exactly.
- [ ] Cloud storage upload limit ≥ 500 MB confirmed and recorded in §2.
- [ ] `curl` probe in §3 returns **401**, not a redirect.
- [ ] Manual smoke passed (`docs/testing/audio-minutes-smoke.md`).
- [ ] Flag flipped for the pilot tenant only.
