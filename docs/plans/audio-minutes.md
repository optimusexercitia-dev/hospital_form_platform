# Plan — Meeting audio → generated ata (`audio_minutes`)

**ADR:** [0099](../decisions/0099-meeting-audio-minutes.md) (D1–D18 below refer to
it). **Service repo:** `minute_generator` — its ADRs 0004/0005/0006 and its own
implementation plan `docs/plans/platform-integration-v2.md` are the contract half;
**that plan completes first** (contract-first, D17). **Branch:**
`feat/meeting-minutes` (worktree off `main`; rebase after AFF merges, before the
gate). **Flag:** `audio_minutes`, default OFF, enable-migration authored with the
phase but the flag row ships disabled (a flag without its seed/enable path leaves
the phase dark after `db push`).

⚠ Standing caveats that bind every task here:
- This document is **not authoritative on substrate**. Any SQL fact below
  (predicate names, policy shapes, column lists on existing tables) is verified
  against the **live catalog after a fresh `supabase db reset`** at build time.
- Two sessions may share the local stack — allocate migration versions above the
  highest **registered** version at build time, not the highest file here.
- Every DEFINER touched or created: re-apply grants in the same migration,
  `current_setting('role')` not `current_user`, gate neither weaker nor stronger
  than the RLS it displaces, `prosecdef` audited beside `pg_policies`.

## Teammates & sequencing

| Owner | Tasks |
| --- | --- |
| backend | B0–B8 (schema, RPCs, module, webhook, env) |
| frontend | F1–F5 (Ata card states, upload dialog, review page, badge) — `frontend-design` skill first |
| tester | T1–T3 (E2E specs, signed-callback fixtures, bug filing) |
| qa | Final review vs this plan + ADR 0099 |

```
minute_generator W0–W3 (other repo, first)
        │
B0 → B1 → B2 → B3 ─→ B4 → B5 → B6 → B7 → B8
              │        (F1, F2 may start against the B2 RPC contract)
              └─────→ F1 → F2 → F3 → F4 → F5
                                  │
                     T1 (pgTAP, with B2) · T2 (unit, with B4–B6) · T3 (E2E, after F3)
```

---

## B0 — Preflight (backend)

1. Rebase onto post-AFF `main`; fresh `supabase db reset`; confirm
   registered == files.
2. From the **catalog**: the exact predicate the Ata editor's write path uses
   (`update_meeting_minutes`'s gate — the plan calls it "the canEdit predicate"
   throughout; copy its real form), the meetings RLS SELECT policy shape, the
   `action_items` insert door (RPC or direct-with-RLS?), and
   `app.enqueue_notification`'s signature.
3. Decide `meetings` FK behavior for job rows against the meetings module's
   existing delete posture (cascade vs restrict — mirror whatever
   `meeting_agenda_items` does).
4. Record the reserved migration window in PROGRESS.md.

## B1 — Migration 1: storage + table (backend)

**`meeting-audio` bucket.** Private. ⚠ Every existing bucket is 25 MiB with no
audio MIME types (fact from the service repo's integration notes) — this bucket
needs its own `file_size_limit` (500 MB, D3) and `allowed_mime_types`
(`audio/mp4`, `audio/aac`, `audio/mpeg`, `audio/wav`, `audio/x-wav`,
`audio/ogg`, `audio/webm` — verify the exact strings browsers emit for `.m4a`
at build time). Check local `supabase/config.toml` global `file_size_limit`
doesn't clamp below 500 MB, and note the Cloud project setting in the deploy
runbook. **No storage RLS policies for `authenticated`** — all object access is
server-side (signed upload URL minted by B5; signed download URL for the
service; service-role delete). Path convention:
`<meeting_id>/<job_id>/<sanitized_filename>`.

**Shared enum** (D18): `create type public.audio_job_status as enum
('uploading','processing','done','failed','cancelled','applied')`. Minted as the
cross-kind vocabulary; future interview-job tables reuse it.

**Table `public.meeting_minutes_jobs`:**

```
id                uuid pk default gen_random_uuid()
meeting_id        uuid not null references meetings(id)   -- delete behavior per B0.3
requested_by      uuid not null references profiles(id)
status            audio_job_status not null default 'uploading'
audio_path        text                                    -- storage object path
audio_deleted_at  timestamptz
service_job_id    text                                    -- minute_generator job id
error_code        text
error_message     text                                    -- pt-BR-safe, user-visible
result            jsonb                                   -- callback payload as received (immutable)
draft             jsonb                                   -- review working copy
transcript        text
received_at       timestamptz
applied_at        timestamptz
cancelled_at      timestamptz
purged_at         timestamptz
created_at / updated_at timestamptz not null default now() (+ touch trigger per house pattern)
```

- Partial unique index `meeting_minutes_jobs_active_uidx` on `(meeting_id)`
  `where status in ('uploading','processing','done')` — D4/D13's one-active-job
  rule, enforced by the DB not the UI.
- Index on `(status, created_at)` for the reconciliation scan.
- **RLS:** enable + force. One SELECT policy: requester's commission canEdit
  predicate (B0.2's real form) over the job's meeting. **Column-level SELECT
  grant excludes `transcript`** (grant the explicit column list; `transcript`
  is reachable only through the B2 door — and remember: a column the grant list
  omits reads 42501, which is the point). No INSERT/UPDATE/DELETE policies for
  `authenticated` at all — mutations are RPC/service-role only.
- Comments on table + sensitive columns (transcript: substance-tier, purged at
  terminal states, read via audited door).

## B2 — Migration 2: RPCs, doors, audit, flag (backend)

All RPCs `security definer`, `set search_path = ''`, explicit
`grant execute to authenticated` (webhook helpers: `service_role`), revoke from
`public`/`anon`. Guard order inside each: flag → existence → role gate → state
gate → work (RLS-equivalent denial first, integrity second).

- `app.create_minutes_job(p_meeting_id uuid, p_filename text) returns uuid` —
  guards: flag `audio_minutes` ON; meeting exists + status `held` (D1); caller
  passes the canEdit predicate; no active job (rely on the partial unique index
  for the race — catch `unique_violation` into a pt-BR-coded error). Inserts
  `uploading` row with `audio_path` composed server-side; audit
  `meeting_minutes_job_created`.
- `app.submit_minutes_job(p_job_id uuid, p_service_job_id text)` — guards:
  canEdit; status `uploading`. Sets `processing` + `service_job_id`; audit
  `meeting_minutes_job_submitted`.
- `app.cancel_minutes_job(p_job_id uuid)` — guards: canEdit; status in
  (`uploading`,`processing`,`done`) — cancelling an unreviewed `done` job is
  legal (user gives up on review). Sets `cancelled` + `cancelled_at`, purges
  `result`/`draft`/`transcript` (+`purged_at`); audit
  `meeting_minutes_job_cancelled`. (Audio delete + service cancel are app-side,
  B5 — storage and HTTP don't belong in SQL.)
- `app.save_minutes_draft(p_job_id uuid, p_draft jsonb)` — guards: canEdit;
  status `done`; `p_draft` size sanity cap (~2 MB) so a broken client can't
  balloon the row. Overwrites `draft`.
- `app.apply_minutes_review(p_job_id uuid) returns jsonb` (counts for the
  banner + audit) — the D5–D7/D12 transaction:
  1. Guards: flag; canEdit; job `done`; meeting still `held`.
  2. From `draft` (never `result`): for each kept agenda entry — ref matches a
     live `meeting_agenda_items` row of THIS meeting → update
     `discussion_notes` / `resolution`; dangling or null ref → insert appended
     at the end (position = max+1, respecting the deferrable-unique ordering).
  3. Kept action items → `action_items` hub rows via the B0.2-verified door
     (owner user_id when resolved, else unassigned; verbatim text folded into
     description app-side before save, so SQL stays dumb).
  4. `meetings.minutes_md := draft->>'minutes_md'` (already sanitized app-side,
     B5 — the RPC additionally rejects raw `<` HTML as belt-and-braces per
     Rule 7).
  5. Job → `applied`, purge content columns, `applied_at`/`purged_at`; audit
     `meeting_minutes_job_applied` with `{agenda_updated, agenda_created,
     actions_created}` counts (counts, never content).
- `app.read_minutes_transcript(p_job_id uuid) returns text` — the audited door
  (D8/D15): canEdit + status `done`; emits the read-audit row (who/that; the
  house audited-free-text-read pattern from the safety module, resolved from
  catalog at build); returns `transcript`.
- Webhook helpers (`service_role`-only execute): `app.complete_minutes_job(
  p_job_id, p_result jsonb, p_transcript text)` — `processing → done`, stores
  `result`, seeds `draft := result`-derived shape, `received_at`; and
  `app.fail_minutes_job(p_job_id, p_error_code, p_error_message)` — both
  idempotent no-ops on non-`processing` rows (D9/D10 latch) returning a
  did-anything boolean so the route can log.
- **Flag:** insert `audio_minutes` disabled into the flag store (house pattern
  from the latest `enable_*` migration) + add the key to `FeatureFlags` in
  [feature-flags.ts](../../src/lib/queries/feature-flags.ts).
- **Audit event kinds** registered per the house enum/CHECK if one exists
  (verify B0) — all six `meeting_minutes_job_*` kinds (D15).

## B3 — Types (backend)

`npm run gen:types` with pgTAP dropped; commit `database.ts`. TS domain types for
the callback payload come from B4, not from hand-rolled interfaces in components.

## B4 — Generic audio-jobs client `src/lib/audio-jobs/` (backend, D18)

Kind-agnostic; **zero meeting knowledge**:

- `types.ts` — the v2 service contract mirrored in TS: `JobType`
  (`'meeting_minutes'`), `AudioJobRequest<TContext>`, `CallbackPayload`
  discriminated on `job_type` (`MeetingMinutesResult` = `minutes` incl.
  `minutes_md` + `transcript`), `ErrorCode`. Source of truth is the service's
  `app/schemas.py` — keep a comment pinning the `schema_version` (`2.0`) this
  mirrors.
- `client.ts` — `submitAudioJob({jobType, audioUrl, callbackUrl, context,
  metadata})` → `POST {MINUTES_SERVICE_URL}/jobs` bearer
  `MINUTES_SERVICE_API_KEY`; `cancelAudioJob(serviceJobId)` (2xx and 404 both
  fine — D9); `getAudioJobStatus(serviceJobId)`. Timeouts + pt-BR error
  mapping; never throws raw fetch errors upward.
- `hmac.ts` — `verifyCallbackSignature(rawBody, signature, timestamp)`:
  `sha256` HMAC over `"<timestamp>.<rawBody>"` with
  `MINUTES_CALLBACK_HMAC_SECRET`, constant-time compare
  (`crypto.timingSafeEqual`), staleness window ±5 min. Pure, unit-testable.
- `metadata.ts` — build/parse `{platform_job_id, job_type}`.

## B5 — Meeting module `src/lib/minutes-jobs/` (backend)

`actions.ts` (server actions; Rule 9 — all data access through queries/RPCs),
`queries.ts`, `messages.ts` (pt-BR):

- `startMinutesJob(meetingId, filename, contentType, size)` — validate
  size/type app-side too; RPC `create_minutes_job`; mint signed upload URL
  (`storage.createSignedUploadUrl`) for the job's path; return
  `{jobId, path, token}`.
- `submitMinutesJob(jobId)` — after the client reports upload complete:
  compose `MeetingMinutesContext` (D14: commission display name;
  `held_at ?? scheduled_start`; attendees `[ref=attendee.id, name (profile or
  guest), role]`; agenda `[ref=item.id, title]` **titles only** — the composer
  is written so descriptions are never even read); mint signed **download**
  URL (TTL ≥ service `JOB_TIMEOUT_SECONDS` + queue headroom — 6 h);
  `submitAudioJob(...)`; RPC `submit_minutes_job`. Service unreachable →
  `fail` path + audio delete + pt-BR error.
- `cancelMinutesJob(jobId)` — RPC first (immediate, D9), then best-effort
  `cancelAudioJob`, then storage delete + mark `audio_deleted_at`.
- `saveMinutesDraft(jobId, draft)` — sanitize `minutes_md` (house Rule 7
  sanitizer) before the RPC.
- `applyMinutesReview(jobId)` — RPC; revalidate meeting + review paths; return
  counts for the banner.
- `reconcileMinutesJob(jobId)` (called from page loads on stale jobs, D10):
  `processing` > 3 h → `getAudioJobStatus`; service says done-but-we-missed-it →
  leave to callback retry, log; says error/cancelled/unknown → `fail_minutes_job`
  + audio delete; > 24 h regardless → fail + delete (also the audio TTL
  backstop, D2).
- `queries.ts` — `getActiveMinutesJob(meetingId)` (for the Ata card + list
  badge), `getMinutesJobForReview(jobId)` (draft + meeting context joined),
  `readMinutesTranscript(jobId)` (the audited door).

## B6 — Webhook `src/app/api/webhooks/audio-jobs/route.ts` (backend, D10/D18)

`POST` only; raw body read **before** JSON parse (signature is over bytes);
`verifyCallbackSignature` → 401 on failure; parse; dispatch on
`metadata.job_type`: `meeting_minutes` → handler; unknown → log + 200 (a newer
service must not retry-storm an older platform). Handler: flag check (flag OFF →
200 + log — the service is not at fault); resolve `platform_job_id` → job row
via service-role client; `status=done` → `complete_minutes_job` (draft seeded
from result: minutes_md sanitized, agenda/action arrays normalized to the
review shape) + notification (B7) + audio delete iff `audio_release`;
`status=error` → `fail_minutes_job` + notification + audio delete (service sets
`audio_release=true` on failures). Idempotency comes from the RPC no-op booleans
→ 200 either way. Route exports `dynamic = 'force-dynamic'` and is excluded from
any auth middleware matcher (verify `src/proxy.ts` / middleware config at build).

## B7 — Notification (backend, D11)

On done/failed: `app.enqueue_notification` (signature per B0.2) to
`requested_by` — pt-BR title/body, deep link to
`…/meetings/[meetingId]/revisao-ata` (done) or the meeting page (failed).

## B8 — Env & runbook (backend)

`MINUTES_SERVICE_URL`, `MINUTES_SERVICE_API_KEY`,
`MINUTES_CALLBACK_HMAC_SECRET` — server-only; callback URL composed from the
existing public-base-URL var (verify name at build; do NOT mint a second one).
`.env.example` + deployment runbook: new vars, bucket size/MIME config on Cloud,
HMAC/API-key rotation procedure (rotate service-side first, platform tolerates
both during the window — or accept the brief 401 gap; document the choice).

## F1 — Ata card states (frontend)

[meeting-minutes-editor.tsx](../../src/components/meetings/meeting-minutes-editor.tsx)
header gains a right-aligned slot (new client child, e.g.
`minutes-audio-slot.tsx`): flag + `held` + canEdit + no job → `Usar áudio`
button; job `uploading/processing` → chip "Processando áudio…" + elapsed +
cancel (confirm dialog); `done` → highlighted `Revisar ata gerada` linking the
review page; `failed` → error chip + pt-BR message + retry (relaunches F2).
Poll cadence: light `router.refresh()` interval (~45 s) only while a job is
active on the open page; the durable signal is the notification.

## F2 — Upload dialog (frontend, D1/D3/D11/D13)

Two-step dialog: (1) attendee roster + warning ("a atribuição de falas usa esta
lista"), link to attendees panel, zero attendees blocks, "join multi-part files
first" note; (2) file input (accept list; client-side size/type check with pt-BR
errors) → `startMinutesJob` → direct upload to signed URL with progress →
`submitMinutesJob` → close into chip state. Abandoned mid-upload rows
(`uploading`, stale) are cleaned by B5 reconciliation. Upload uses the
supabase-js signed-URL upload (`uploadToSignedUrl`); verify at build whether the
installed version supports resumable/TUS against signed URLs — if not, plain
upload with progress events is acceptable for v1 (500 MB over hospital wifi is
the risk; document retry-from-scratch behavior).

## F3 — Review page (frontend, D12)

`src/app/o/[org]/c/[commission]/meetings/[meetingId]/revisao-ata/page.tsx`
(+`loading.tsx`/`error.tsx`; guards redirect to the meeting page). Components
under `src/components/meetings/review/`:

- `review-shell.tsx` — client orchestrator: draft state, debounced
  `saveMinutesDraft` autosave (+saved/dirty indicator), section nav.
- `ata-editor.tsx` — `minutes_md` markdown editor; overwrite warning banner
  when the meeting's current `minutes_md` is non-empty (shows a collapsible
  diff/side-by-side of the current text).
- `agenda-review-card.tsx` — one per extracted item: matched → existing
  discussion/resolution side-by-side with extracted, editable, include toggle;
  new → editable + removable; attach-resolution select for index-less
  resolutions.
- `actions-review.tsx` — rows with owner select (attendees with `user_id`),
  date picker, verbatim `owner_text`/`deadline_text` shown as hints, include
  toggle.
- `next-meeting-card.tsx` — suggestion display; post-apply the success state
  offers "Agendar próxima reunião" opening the existing create-meeting dialog
  prefilled (D7).
- `speakers-panel.tsx` — attributions + unidentified voices, read-only, with
  the explicit "não é lista de presença" note (D12).
- `transcript-panel.tsx` — collapsed; first expand calls the audited door and
  keeps the text client-side thereafter (one audit row per page visit, not per
  toggle).
- `conclude-bar.tsx` — sticky: `Concluir revisão` (confirm dialog restating
  overwrite + counts) → `applyMinutesReview` → redirect + success banner.

GSAP micro-animations per the design system; every control keyboard-reachable;
labels + visible focus (house a11y bar).

## F4 — Meetings list badge (frontend, D11)

Small chip on rows whose meeting has an active/reviewable job (`processing` /
`done`), fed by `getActiveMinutesJob` batched into the existing list query
(avoid N+1 — one join/lateral in the list read, verify pattern in B0).

## F5 — Middleware/nav polish (frontend)

Review route in the commission-area nav guard matrix; `conta-inativa` and flag-
off render nothing (no dead links); breadcrumb "Revisão da ata".

## T1 — pgTAP (backend authors with B2; numbering = next free after rebase)

- RLS: job row visible to commission staff_admin/administrativo; invisible to
  same-org other-commission staff, cross-org, platform_admin (noun rule: this
  is commission content), respondent-style personas as applicable; `transcript`
  column read denied via direct select (42501 asserts the column-grant gap).
- One-active-job: second `create_minutes_job` under an active row → the coded
  error, under EVERY active status.
- Guard matrix per RPC: flag off / wrong meeting status / non-canEdit / wrong
  job status / cross-tenant id probing (existence oracle: same error shape for
  "not found" and "not yours").
- Apply semantics: matched update, dangling ref → create, ref-null create,
  action insert incl. unassigned, minutes_md replace, purge (+`purged_at`),
  audit rows with counts, second apply → no-op error.
- Webhook helpers: idempotent no-op on non-processing rows; `service_role`-only
  execute (authenticated call → denied).
- Transcript door: read logs exactly one audit row; denied personas log none.
- Keystones by neutralization (revert the guard → require red), incl. the
  reader-non-writer rule for the door; fixture enables the flag explicitly
  (pgtap-fixture-flag-gaps lesson).

## T2 — Unit (owner beside the code)

`hmac.test.ts` (valid/garbled/stale/future/replayed-timestamp, byte-exact body
sensitivity), `metadata.test.ts`, context-composer test asserting agenda
**descriptions are never read** (mock the query surface — the D14 keystone),
draft-normalizer (callback → review shape; hostile markdown sanitized), webhook
route handler with `Request` fixtures (401 paths, unknown job_type 200,
idempotent re-delivery).

## T3 — E2E (tester; fixtures from the service's W3, signed with the env secret)

`e2e/meeting-audio-minutes.spec.ts` (+helpers in `e2e/helpers/minutes.ts`):

1. Happy path: chefe.ccih marks meeting held → Usar áudio → warning step →
   upload small fixture file → chip appears → test POSTs signed done-callback →
   notification + Revisar ata gerada → edit ata text, strike one agenda item,
   fix one action owner → Concluir → meeting page shows new minutes_md, agenda
   updated+created rows, action items; job row terminal.
2. Overwrite warning shown when minutes_md pre-existing.
3. Cancel mid-processing → button returns; re-run allowed.
4. Failure callback → error chip + retry.
5. Flag OFF → no button, review route redirects, webhook 200-drops.
6. Non-canEdit persona sees no button and gets redirected from review.
7. Invalid-signature webhook → 401 and no state change (request-level, no UI).
8. Keyboard-only: full review + conclude flow.
9. Fresh-reset seed survival: specs create their own meeting; delete by
   identity in teardown (positional-cleanup lesson).

## T4 — Gate extras

`ARM=census` + `ARM=floor`; diff-scoped `ARM=policy` sweep over exactly the B1/B2
doors (list derived from the migration diff); then
`git checkout -- docs/reviews/authz-door-audit-findings.md`. Record all three
arms by name in PROGRESS.md.

## T5 — Manual smoke (documented in `docs/testing/audio-minutes-smoke.md`)

Local platform + local minute_generator via its docker compose (service `.env`
pointing callback at `http://host.docker.internal:3000/api/webhooks/audio-jobs`);
one real short pt-BR audio through upload → callback → review → apply. Required
before pilot-tenant flag enablement, alongside the service's DPA gates (D17).

## Acceptance criteria (phase gate)

1. All D1–D18 behaviors demonstrable; T3 specs green in `npm run e2e:prod`.
2. pgTAP green on fresh reset; all three authz arms named + green.
3. `transcript` unreachable except via the audited door (pgTAP-proven).
4. Purge proven: applied/cancelled jobs hold no result/draft/transcript and the
   bucket object is gone (E2E asserts the storage delete).
5. Flag OFF = feature invisible end-to-end.
6. Lint (0 warnings) + `lint:css-vars` + typecheck + unit + `next build` green.

## Risks / verify-at-build

- **Signed-upload mechanics + 500 MB**: bucket-level limit vs global
  `config.toml` limit vs Cloud setting; TUS availability against signed URLs.
- **Callback reachability**: only the deployed pilot proves the real path (T5
  local + one prod smoke).
- **Download-URL TTL vs queue depth**: 6 h chosen against the service's job
  budget; confirm against its deployed `JOB_TIMEOUT_SECONDS`.
- **`action_items` insert path**: hub door shape assumed RPC-or-RLS; B0.2
  resolves; if it's a guarded DEFINER, `apply_minutes_review` must call it, not
  re-implement it (a new door must inherit every sibling arm).
- **Draft concurrency**: last-write-wins accepted for v1 (small canEdit circle).
- **Meeting deleted / status changed mid-job**: apply re-guards `held`; job rows
  on deleted meetings follow B0.3's FK decision.
- **Masked agenda titles (A7/O6)**: the context composer reads agenda titles as
  the *uploader* sees them — a respondent-masked title never reaches the
  composer because the uploader is canEdit staff, but assert in T2 that the
  composer uses the server-side unmasked-for-staff query, not a client payload.
