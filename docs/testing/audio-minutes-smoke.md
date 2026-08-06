# Manual smoke — meeting audio → generated ata (T5)

Referenced by the runbook §6 ([audio-minutes-runbook.md](../deployment/audio-minutes-runbook.md))
and plan §T5. This is the one gate the E2E suite cannot cover: the spec suite signs its
callbacks itself, so nothing green has ever traversed the **real** service corridor
(upload → AssemblyAI → LLM → signed callback → review → apply). Required before the
pilot-tenant flag flips (D17).

## Prerequisites

- Docker Desktop up; local Supabase stack running. If the stack has **not** been
  restarted since the MIN merge landed `[storage] file_size_limit = "512MiB"` in
  `supabase/config.toml`, restart it — the cap is read at container start:
  `supabase stop && supabase start`, then `supabase db reset --local`.
  (A short clip clears the old 50 MiB cap either way; restart anyway so the smoke
  exercises the shipped config.)
- `minute_generator/.env` exists (created 2026-08-06, secrets minted and mirrored into
  the platform's `.env.local`). Two placeholders must be filled by hand before compose
  will start: `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`. Startup fails listing missing
  names, so a typo'd var is loud.
- Platform `.env.local` carries the `MINUTES_*` block (same shared secrets;
  `MINUTES_CALLBACK_BASE_URL=http://host.docker.internal:3000` — the service runs in
  Docker and cannot reach `localhost:3000`, runbook §3).
- ⚠ **Port flip**: the standing `.env.local` value is
  `MINUTES_SERVICE_URL=http://localhost:8891` — the **E2E stub's** port. For this
  smoke ONLY, set it to `http://localhost:8000` (the real service), and set it back
  afterwards or the next E2E dev-server run times out on submit. `next dev` reloads
  `.env.local` live; no server restart needed.
- A short **pt-BR** audio file, 1–3 min, ideally ≥2 speakers (m4a/mp3/wav).
  ⚠ **Non-medical test content only** — the service's `.env` has
  `ARTIFACT_RETAIN_TEXT=true`, which retains transcript text under
  `minute_generator/artifacts/` for pilot evaluation.

## Steps

1. **Service up**: in `minute_generator/`, `docker compose up --build`
   (redis + api :8000 + worker + shadow-worker; shadow is disabled by `.env`).
   `curl http://localhost:8000/health` → green.
2. **Platform up**: `npm run dev` (one dev server only).
3. **Webhook probe** (runbook §3 — do this after ANY middleware change too):
   `curl -i -X POST http://localhost:3000/api/webhooks/audio-jobs -d '{}'`
   → expect **401** `{"error":"unauthorized"}`, NOT a 307 to `/login`.
4. **Login** `chefe.ccih@test.local` / `Test1234!` (`staff_admin` CCIH). The
   `audio_minutes` flag is forced ON locally by `seed.sql`. Note `administrativo`
   is excluded from audio by design (PO decision O1).
5. Open **Reuniões**, pick (or create and hold) a meeting in **Realizada** status,
   open its detail page.
6. **Upload** through the ata-generation dialog (`MinutesUploadDialog`): choose the
   audio; the progress bar is a raw-XHR PUT to a signed storage URL. On submit the
   job row goes `processing`.
7. **Wait for the callback** (a 2-min clip ≈ 2–5 min with AssemblyAI + LLM). Status
   updates on page reload / reconcile — reload if it looks idle. If it sits
   `processing` >15 min, check `docker compose logs api worker` and the §3 probe
   before suspecting the pipeline.
8. **Review**: transcript panel opens (disclosure), draft ata shows agenda items,
   resolutions, action items; speaker labels are names, never raw UUIDs.
9. **Apply**: the ata lands on the meeting, resolutions attach, action items are
   created through the guarded door, and the **audio object is deleted** (D2/B1).
   Verify custody:

   ```
   docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -c \
     "select name from storage.objects where bucket_id='meeting-audio';"
   ```

   → 0 rows for the applied job; the job row carries `audio_deleted_at`.
10. **Notification**: the meeting notification emitted by the webhook RPC exists for
    an attendee.
11. **Failure leg (recommended)**: submit a second job and cancel it → audio deleted,
    job terminal, no callback applied. Optionally stop compose and submit → immediate
    pt-BR failure, job terminated (no hang).

## What a pass proves (record it)

Upload 202 + job row · signed callback accepted (and the unsigned probe 401'd) ·
review renders transcript + draft · apply writes the ata AND deletes the audio ·
errors reach the user in pt-BR. Record pass/fail, date, audio duration, and the
callback `metrics` (total_seconds, token spend) in PROGRESS.md → FUP-MIN-CUTOVER.
