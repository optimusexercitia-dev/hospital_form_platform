# Plan — Meeting audio → generated ata (`audio_minutes`)

**ADR:** [0099](../decisions/0099-meeting-audio-minutes.md) (all D-numbers below
refer to it). **Service repo:** `minute_generator` (sibling checkout; its ADRs
0004/0005 are the contract changes). **Branch:** `feat/meeting-minutes` (worktree
off `main`). **Flag:** `audio_minutes`, default OFF, enable-migration ships with the
phase (a flag without its enable migration leaves the phase dark after `db push`).

⚠ Plan-doc caveat (standing): this document is NOT authoritative on substrate. Every
task that touches SQL verifies against the live catalog after a fresh
`supabase db reset`, never against this text or migration files.

---

## 0. Contract (build first, in minute_generator)

The platform consumes; the service publishes. Land these before platform work that
depends on them, each with its ADR and tests:

**S0 — contract v2: job-type discrimination** (service ADR 0006, D18)
- `JobRequest`: required `job_type` enum (only `meeting_minutes`) + discriminated
  `context` union; `committee_name`/`meeting_date`/`attendees`/`agenda`/
  `template_sections` move into `MeetingMinutesContext`. Unknown `job_type` → 422.
- `CallbackPayload`: gains `job_type`; hardcoded `minutes` field becomes a
  discriminated `result` union (`MeetingMinutesResult` = today's `Minutes` +
  `transcript`).
- Pipeline: per-type processor registry (`app/pipeline/processors/`) for
  naming + summarization; ASR/diarization/merge stay shared and kind-blind;
  `worker.py` dispatches, never branches.
- `schema_version` → 2.0. Do this FIRST — S1 lands inside the v2 shape.

**S1 — `minutes_md` on `Minutes`** (service ADR 0004, D5)
- `app/schemas.py`: `minutes_md: str | None = None` on `Minutes`.
- `app/pipeline/summarize.py`: the summarization prompt additionally produces a
  formal pt-BR ata narrative in Markdown (structure: abertura, per-topic sections
  following the agenda, deliberações, encerramento). Attendee roster stays in the
  user message, never in the JSON schema (existing caching rule).
- `schema_version` stays 1.x (additive).

**S2 — `POST /jobs/{id}/cancel`** (service ADR 0005, D9)
- Queued → dequeue and delete job state; processing → best-effort RQ stop
  (`send_stop_job_command`), then claim the callback latch (`queue.claim_callback`)
  so no callback can ever fire for this job; workspace cleanup runs.
- Unknown / already-terminal job → 2xx no-op (idempotent).
- Auth: same bearer `API_KEY` as `POST /jobs`.
- `GET /jobs/{id}` gains a `cancelled` coarse status.

**S3 — smoke fixture** — a canned callback payload (valid `Minutes` incl.
`minutes_md`) exported for the platform's E2E fixtures so the two repos share one
specimen (D16).

## 1. Platform schema (backend)

Allocate migration versions ABOVE the highest registered version at implementation
time (AFF is merging ahead of this branch; shared-stack rule).

**T1.1 — bucket** `meeting-audio`: private; NO client-facing storage policies
(reads/writes happen via server-minted signed URLs only); path
`<meeting_id>/<job_id>/<sanitized_filename>`.

**T1.2 — table `meeting_minutes_jobs`** (D4, D8):
- `id uuid pk`, `meeting_id fk → meetings`, `requested_by fk → profiles`,
  `status audio_job_status` — a **shared enum type** minted now (D18: future
  interview-job tables reuse it; lifecycle column names below are the convention
  those tables mirror), values
  `('uploading','processing','done','failed','cancelled','applied')`
  (`uploading` = signed-upload minted, not yet submitted; `processing` covers
  submitted+queued — the service returns 202 immediately, coarse states suffice),
  `audio_path text`, `audio_deleted_at timestamptz`, `service_job_id text`,
  `error_code text`, `error_message text`, `result jsonb`, `draft jsonb`,
  `transcript text`, `received_at`, `applied_at`, `cancelled_at`, `purged_at`,
  timestamps.
- Partial unique index: one row per meeting where
  `status in ('uploading','processing','done')`.
- RLS: SELECT only for the meeting's commission `canEdit` circle (mirror the Ata
  editor's policy predicate — copy from the live catalog, not from a file); **no
  content columns in the client SELECT grant for `transcript`** — transcript goes
  through the audited door (T1.4). No client INSERT/UPDATE/DELETE — mutations via
  RPCs + service-role webhook only. Column-level grants: remember every new column
  needs its own GRANT or reads 42501.

**T1.3 — RPCs** (each a new door → ADR 0079 gates apply):
- `create_minutes_job(meeting_id, filename)` — guards flag + status `held` +
  canEdit + no active job; inserts `uploading` row; returns job id (signed upload
  URL minted app-side).
- `submit_minutes_job(job_id)` — flips `uploading → processing` after the app has
  POSTed to the service; records `service_job_id`.
- `cancel_minutes_job(job_id)` — D9 platform half: immediate local cancel + audio
  delete marker; app then best-effort calls the service cancel.
- `save_minutes_draft(job_id, draft)` — guards status `done`; overwrites `draft`.
- `apply_minutes_review(job_id)` — the transactional apply (D5–D7, D12):
  re-guards meeting still `held` + canEdit + status `done`; reads `draft`;
  updates/creates `meeting_agenda_items` (dangling refs → create), inserts
  `action_items` hub rows, replaces `meetings.minutes_md` (sanitized), marks job
  `applied`, purges `transcript`/`result`/`draft` (`purged_at`), emits audit rows
  with counts. Integrity guards ordered so RLS denies first.
- Failure-acknowledge purge path for `failed`/`cancelled` (can fold into a small
  `purge_minutes_job` internal).
- ⚠ Every DEFINER rebuild rule applies: ACLs re-granted in the same migration,
  `current_setting('role')` not `current_user`, gates neither weaker nor stronger
  than the RLS they displace.

**T1.4 — audited transcript door** `read_minutes_transcript(job_id)` — DEFINER,
canEdit-gated, logs a read-audit row (who/that, never content), returns the text
(D8, D15). Follows the safety module's audited free-text read precedent.

**T1.5 — audit events** (D15): `meeting_minutes_job_created / _submitted /
_callback_received / _cancelled / _applied / _purged` via the standard audit emit
pattern.

**T1.6 — feature flag** `audio_minutes` + its enable migration (default OFF row;
the enable migration is what flips it later — do not ship enabled).

**T1.7 — types**: `npm run gen:types` (with pgtap dropped), types imported from
`src/lib/types/` only.

## 2. Platform server layer (backend)

**T2.0 — generic service client `src/lib/audio-jobs/`** (D18): the kind-agnostic
half every audio module wraps — service auth (bearer), payload envelope
(`job_type`, `audio_url`, `callback_url`, `metadata {platform_job_id, job_type}`),
HMAC verification helper for the webhook, submit/cancel/`GET /jobs/{id}`
reconcile calls, and the callback-payload discriminated-union types. No meeting
knowledge in this module.

**T2.1 — module `src/lib/minutes-jobs/`** (`actions.ts` + `queries.ts`, Rule 9;
wraps T2.0 with everything meeting-shaped):
- `startMinutesJob` — calls `create_minutes_job`, mints the signed-upload URL,
  returns it to the client.
- `submitMinutesJob` — after upload completes: mints a signed **download** URL
  (TTL ≥ service max poll window), composes the D14 payload
  (`committee_name`, `meeting_date = held_at ?? scheduled_start`,
  `attendees [ref=id, name, role]` incl. guests, `agenda [ref=id, title]` only,
  `metadata {platform_job_id}`), POSTs to `MINUTES_SERVICE_URL/jobs` with bearer
  `MINUTES_SERVICE_API_KEY`, then `submit_minutes_job`. Service unreachable →
  job → `failed` with a pt-BR readable error.
- `cancelMinutesJob` — RPC first (immediate), then best-effort service cancel,
  then audio delete.
- `saveMinutesDraft`, `applyMinutesReview` — thin wrappers.
- `reconcileMinutesJob` — D10 lazy repair: called from page loads when a job is
  `processing` older than 3 h → `GET /jobs/{id}`; >24 h unheard → `failed` + audio
  delete. Also the audio-TTL backstop.

**T2.2 — webhook `src/app/api/webhooks/audio-jobs/route.ts`** (D10, D18): ONE
endpoint for every audio kind — raw-body HMAC verify (`sha256`,
`"<timestamp>.<body>"`, constant-time compare), timestamp staleness window, then
dispatch on `metadata.job_type` to the owning module's handler
(`meeting_minutes` only today; unknown type → logged 200 no-op). The meeting
handler: flag check, look up job by `metadata.platform_job_id`
(service-role client), idempotent no-op for non-active jobs (also the D9 late-
callback latch), on `done`: store `result` + `transcript`, seed `draft := result`,
notify requester (T2.3), delete audio when `audio_release=true`. On `error`:
`failed` + error fields + audio delete per D2. Always 2xx on verified duplicates;
non-2xx only when a retry could succeed.

**T2.3 — notification** (D11): in-app notification to `requested_by` on
done/failed via the existing notifications module, deep-linking the review page.

**T2.4 — env**: `MINUTES_SERVICE_URL`, `MINUTES_SERVICE_API_KEY`,
`MINUTES_CALLBACK_HMAC_SECRET` — server-only (never `NEXT_PUBLIC_`), plus the
public base URL for composing `callback_url`. `.env.example` updated; deployment
runbook gets the key-rotation note (ADR 0099 consequences).

## 3. Frontend (frontend — `frontend-design` skill first)

**T3.1 — Ata card header states** (D11): `Usar áudio` button (flag + `held` +
canEdit) → processing chip (elapsed time, cancel w/ confirm) → `Revisar ata
gerada` highlighted button (status `done`). Failed → error state with retry.
GSAP micro-transitions per the design system; all states keyboard-accessible.

**T3.2 — upload dialog** (D1, D3, D11, D13): step 1 shows current attendees +
the attribution warning + link to attendees panel (zero attendees blocks); step 2
file pick (accept list, 500 MB client-side check, pt-BR errors) → direct-to-bucket
upload with progress (resumable) → auto-submit → close to chip state. Copy notes
multi-part recordings must be joined first.

**T3.3 — review page `meetings/[meetingId]/revisao-ata`** (D12): guarded server
component + client sections: Ata markdown editor (existing-minutes overwrite
warning when applicable), Pauta cards (matched: side-by-side existing text,
include/exclude, editable; new: editable, removable), Ações (owner select from
attendees w/ user_id, date picker, verbatim text shown), Próxima reunião
(suggestion + post-apply prefilled create-meeting button), Falantes (read-only),
Transcrição (collapsed; fetch via the audited door on expand). Draft autosave
(debounced) with saved/dirty indicator. `Concluir revisão` → apply → redirect +
success banner.

**T3.4 — meetings list badge** (D11) for a meeting with an active/reviewable job.

## 4. Tests

**T4.1 — pgTAP** (backend): RLS shapes for `meeting_minutes_jobs` (positive +
denied-role + cross-commission), one-active-job index, every RPC's guard matrix
(flag off, wrong status, non-canEdit, cross-tenant), apply semantics (matched
update / dangling ref → create / action-item insert / minutes replace / purge),
transcript door logs its read. Keystone by neutralization (revert-the-fix red),
not call-counting.

**T4.2 — unit** (backend/frontend): HMAC verifier (valid/invalid/stale/replay),
payload composer (D14 minimization — asserts descriptions NEVER leave), merge
mapper, upload validation.

**T4.3 — E2E** (tester, D16): specs drive upload → chip → signed fixture callback
(shared specimen from S3) → notification → review page edits → apply → meeting
page shows ata/agenda/actions; cancel path; re-run path; flag-off invisibility;
one keyboard-only flow. No real service in the gate.

**T4.4 — authz gates**: `ARM=census` + `ARM=floor` + diff-scoped door sweep over
exactly the new doors (derived from the migration diff); then restore
`docs/reviews/authz-door-audit-findings.md`.

**T4.5 — manual smoke** (documented, pre-pilot-enable): local docker compose of
minute_generator against local platform, one real short audio through the full
loop.

## 5. Sequencing & gate

1. S0–S3 in minute_generator (contract-first; its own suite green; S0 before S1).
2. T1.* schema → T1.7 types → T2.* server → T3.* UI (T3.1/T3.2 can start against
   the RPC contract once T1.3 lands).
3. Standard Phase Gate: fresh-reset pgTAP, lint/typecheck/unit, authz arms (named
   individually in the record), tester E2E green via `npm run e2e:prod`, QA review,
   human approval. Phase ships with flag OFF (D17).
4. Post-AFF-merge rebase before the gate run (this branch rides `main`).

## 6. Risks / open items

- **Resumable uploads**: exact supabase-js resumable/TUS mechanics + the bucket
  file-size limit knob (local `config.toml` and Cloud project setting must both
  allow 500 MB) — verify at T1.1/T3.2 time, not assumed here.
- **Webhook reachability**: full loop only works deployed (or full-local). The
  smoke (T4.5) is the only pre-pilot proof of the real seam.
- **Signed-URL TTL vs service queue depth**: download URL must outlive worst-case
  queue wait; align TTL with the service's `JOB_TIMEOUT_SECONDS` budget.
- **Draft concurrency**: single-editor assumption (canEdit circle is small);
  last-write-wins on `draft` is accepted for v1.
- **DPA gates** (service side) block real-audio enablement, not this build (D17).
- **Meeting deleted mid-job**: FK cascade vs orphan cleanup — decide at T1.2
  against the meetings module's existing delete posture (verify in catalog).
