# ADR 0099 — Meeting audio → generated ata (minute_generator integration)

- **Status:** Accepted (PO-ruled 2026-08-06, full grilling session)
- **Feature flag:** `audio_minutes` (default OFF)
- **Companion ADRs (service repo):** minute_generator ADR 0004 (consumer-facing
  `minutes_md`), ADR 0005 (job cancellation), ADR 0006 (job-type-discriminated
  contract v2)
- **Plan:** [docs/plans/audio-minutes.md](../plans/audio-minutes.md)

## Context

Commissions record their meetings; today the secretary types the ata by hand. A
separate service (`minute_generator`, sibling repo) already exists for exactly this
seam: `POST /jobs {audio_url, callback_url, attendees[ref], agenda[ref], metadata}`
→ `202 {job_id}` → an exactly-once HMAC-signed callback carrying structured
`Minutes` JSON (agenda items ref-matched to ours, resolutions, action items with
resolved+verbatim owner/deadline, next-meeting suggestion, speaker attribution) plus
a verbatim transcript. The service is ephemeral by design (hospital PHI); the
platform owns audio custody. Processing takes 5–40 min, so the platform side must be
fully asynchronous: upload, walk away, come back to a review page, apply.

## Decisions

**D1 — Eligibility.** The feature is offered only on a meeting in status **`held`**,
gated by the same `canEdit` circle as the Ata editor (commission `staff_admin` incl.
the `administrativo` delegated grant). A meeting still `scheduled` gets a nudge to
mark it held first (captures `held_at`, which anchors relative deadlines).
*Rejected:* `scheduled` too — writes discussion/resolutions into a meeting that
never formally happened.

**D2 — Audio custody.** New private bucket **`meeting-audio`**; no client read
policy — the server mints the signed URL the service downloads from. The platform
deletes the audio at the earliest of: callback with `audio_release=true`, apply,
cancel, failure-acknowledged, or a **24 h hard TTL** (backstop the service README
itself prescribes; also covers the pilot's `audio_release=false`-while-shadow-runs
case — the shadow re-download is best-effort and non-fatal by the service's own
design). The ata text is the durable record; the platform never retains recordings.
*Rejected:* keeping audio as a meeting attachment — a standing PHI-bearing artifact
with 20-yr-regime retention questions, for no committee need.

**D3 — Upload path.** Browser → bucket directly via server-minted signed-upload URL
(resumable for large files), progress UI, **500 MB cap**, common audio types
(m4a/aac, mp3, wav, ogg/opus, webm). Nothing streams through the Next.js container.

**D4 — Job + draft persistence.** One table **`meeting_minutes_jobs`**: lifecycle
status, storage path, service `job_id`, requester, error, `result` JSONB (as
received, immutable), `draft` JSONB (the review page's working copy, autosaved).
Partial unique index: **one active job per meeting**. Apply is one transactional
RPC reading `draft`. *Rejected:* relational staging tables (more surface for a
short-lived payload); client-only edits (loses work on tab close — conflicts with
the walk-away requirement).

**D5 — Ata content.** The **service** composes the ata: a new `minutes_md` field in
its `Minutes` schema — an LLM-written formal pt-BR ata in Markdown (service ADR
0004). On apply it **replaces** `meetings.minutes_md`; if the meeting already had
non-empty minutes the review page warns explicitly before conclusion. Ingested
markdown is sanitized platform-side (Architecture Rule 7). *Rejected:* platform-side
template composition (stilted; the LLM saw the full transcript and writes better
minutes than a template).

**D6 — Agenda merge.** Ref-matched extracted items **update** the existing
`meeting_agenda_items` row (`discussion_notes`, + `resolution` when a resolution
back-references it); the review page shows existing non-empty text side-by-side so
every overwrite is a seen decision, and any item can be struck from the apply.
Ref-null items (raised on the day) are **created**, appended at the end. Index-less
resolutions are attachable to an item on the review page, else live only in the ata
narrative.

**D7 — Action items & next meeting.** Kept action items become rows in the shared
`action_items` hub (meeting source): assignee = the attendee's `user_id` when
`owner_ref` resolves to a member; guests/unresolved → unassigned with verbatim
`owner_text` folded into the description; unparsed deadlines keep `deadline_text`
in the description. The review page allows fixing owner/date before apply.
`next_meeting` is **advisory** (service ADR 0002 contract): after apply, an
"Agendar próxima reunião" button opens the existing create-meeting dialog
prefilled — never auto-created.

**D8 — Transcript retention.** The verbatim transcript is stored on the job row and
readable **only** by the commission's `canEdit` circle, through an audited single
door (read logged, never content). It is **purged** — with `result` and `draft` —
when the job reaches `applied`/`cancelled`/failed-acknowledged. The job row itself
survives as content-free history. No standing verbatim-speech store; this stays
within the substance-tier free-text posture, not a fourth Rule-12 PHI module.

**D9 — Cancel.** New service endpoint `POST /jobs/{id}/cancel` (service ADR 0005):
queued → dequeued; processing → best-effort stop; the callback latch is claimed so
no callback ever fires afterwards. The platform marks its row cancelled
**immediately** (not waiting on the service), deletes the audio, and the webhook
ignores callbacks for non-active jobs — cancel works even with the service down.

**D10 — Delivery & recovery.** Route handler `/api/webhooks/audio-jobs`: verifies HMAC
over `"<timestamp>.<body>"`, rejects stale timestamps, idempotent (terminal job →
200 no-op), writes via service-role client keyed by our own job UUID carried in
`metadata.platform_job_id`, dispatching on `metadata.job_type` to the owning
module's handler (D18). Recovery is **lazy**: when a page loads a job processing
past ~3 h, the server polls `GET /jobs/{id}` and repairs state; past a 24 h TTL the
job is marked failed and the audio deleted. No new cron infrastructure. *Rejected:*
pg_cron sweeper — a stale row nobody is looking at harms nobody until they look.

**D11 — UI states.** "Usar áudio" (Ata card header) opens a dialog whose first step
shows the current attendee list with the warning that speaker attribution uses it
(zero attendees = blocked; few = proceed allowed). While processing: status chip in
the Ata card header (elapsed time + cancel) and a badge on the meetings list row.
On completion: chip becomes "Revisar ata gerada", and the requester gets an in-app
notification (existing notifications module) — covering the closed-browser case.

**D12 — Review page.** Sub-route `meetings/[meetingId]/revisao-ata`, guarded (job
`done`, meeting still `held`, `canEdit`). Sections: Ata (markdown editor) → Pauta
(per-item cards, side-by-side existing text, include/exclude) → Ações → Próxima
reunião → Falantes (spoke / unidentified voices, **display-only** — never writes
attendance; presence is quorum-bearing and the audio cannot prove it, service ADR
0002) → Transcrição (collapsed; opening it logs the audited read). Edits autosave
to `draft`. "Concluir revisão" calls one apply RPC: dangling refs degrade to
new-item creation, job → `applied`, content purged, redirect with success banner.
**Meeting status is untouched** — concluding the meeting remains the existing flow.

**D13 — Re-runs.** After `applied`/`failed`/`cancelled`, a new attempt is always
available while the meeting is `held` (re-apply overwrites again, same warning).
One audio file per job; multi-part recordings are out of scope v1 (dialog says to
join files first).

**D14 — Job payload (minimum-necessary).** Sent as the v2 contract's
`MeetingMinutesContext` (D18): `committee_name` = commission name;
`meeting_date` = `held_at` (fallback `scheduled_start`); `attendees` =
`[ref: attendee row id, name, role]` incl. guests; `agenda` =
`[ref: agenda item id, title]` — **titles only, never descriptions** (substance
tier stays home); `metadata` = `{platform_job_id, job_type}`. Audio goes to the ASR processor
(AssemblyAI during the service's pilot; DPA-gated on the service side); the textual
context goes only into Anthropic prompts (ZDR).

**D15 — Audit (Rule 11).** Lifecycle events emit audit rows: created, sent,
callback received (status only), cancelled, applied (with counts), purged.
Transcript reads go through the audited door (D8). Apply's writes to
agenda/action-item tables ride those tables' existing mutation audit. Never
payloads.

**D16 — Testing seam.** The E2E gate never calls the real service: specs drive the
full platform flow and then POST a realistic **signed** callback (HMAC secret from
env) to the webhook with fixture Minutes JSON — deterministic, seconds, and it
tests our verification for real. The genuine seam is covered by minute_generator's
own suite plus one documented manual smoke (local docker compose of the service
against the local platform) before pilot enablement.

**D17 — Sequencing & rollout.** Built now, as its own phase, on `feat/meeting-minutes`
(branched from `main`), **after AFF merges** — schema lands while `supabase db reset`
is still free. Ships with the pilot deploy with the flag **OFF**; enabled per-tenant
only after the service's DPA gates (AssemblyAI / RunPod) close and a production
smoke passes. Service changes land contract-first in minute_generator.

**D18 — Audio-type extensibility (PO-ruled 2026-08-06, second session).** More
audio kinds are coming (case **interviews** next, possibly others). Prepared now,
while the contract and schema are free to change:
- **Service contract v2** (service ADR 0006): required `job_type` discriminator,
  kind-specific request fields nested in a discriminated `context`, callback
  `result` a discriminated union, per-type processor registry behind shared
  ASR/diarization. Only `meeting_minutes` is a valid `job_type` today.
- **Platform: per-domain tables, shared kind machinery.** `meeting_minutes_jobs`
  stays domain-owned; interviews later get their own table **inside the case
  module's isolation** (an interview transcript is case-PHI — it must live behind
  that module's doors, not in a shared relation). What is generic from day one:
  the `audio_job_status` enum + lifecycle column conventions, `metadata =
  {platform_job_id, job_type}` on every service job, ONE webhook dispatching on
  `job_type` to per-module handlers, a generic `src/lib/audio-jobs/` service
  client (auth, HMAC, submit/cancel/reconcile) each module wraps, and
  kind-prefixed audit event naming.
- *Rejected:* one generic `audio_processing_jobs` table with kind-branched RLS —
  mixes substance-tier and Class-1 PHI rows in one relation (muddying the Rule 12
  three-module isolation story) and recreates the "new door must inherit every
  sibling arm" audit failure mode; a table boundary is the only authz boundary
  that has reliably survived this project's audits. No Interview feature is built
  now — this decision only shapes what already ships.

## Consequences

- Two new authorization doors (apply RPC, transcript read door) — both must clear
  the ADR 0079 gates: `ARM=census`, `ARM=floor`, and the diff-scoped door sweep.
- A new externally reachable route (`/api/webhooks/audio-jobs`) whose only guard is
  HMAC + timestamp — key rotation procedure belongs in the deployment runbook.
- The service's contract restructures to the v2 job-type-discriminated shape,
  `Minutes` grows `minutes_md`, and the API grows a cancel endpoint — consumer-
  driven changes recorded in the service's own ADRs 0004/0005/0006.
- Interviews (and any later kind) inherit a proven template: enum value + context/
  result models + processor on the service; table + policies + webhook handler on
  the platform. Nothing generic needs reopening.
- The platform holds meeting audio transiently (≤ 24 h — but see Amendment 1, which
  qualifies this) and transcript text for the life of a job — both inside RLS +
  audited doors, neither as a standing store.

## Amendment 1 (2026-08-06) — the ≤ 24 h audio ceiling is LAZY-ENFORCED

**Status:** accepted deviation, recorded at the QA gate
([review](../reviews/min-audio-minutes-review.md) M2). It qualifies D2 and the
Consequences bullet above; it does not change either decision.

**What D2 promises.** Audio is deleted at the earliest of: a callback with
`audio_release = true`, apply, cancel, failure-acknowledged, or a 24 h hard TTL.

**What the mechanism actually guarantees.** The first four are *event-driven* and
prompt — each is a line of code on a path a user or the service has just taken.
The fifth is not a timer. D10 chose **lazy recovery with no cron**, so the TTL is
evaluated only when something happens:

- on every webhook callback delivery (machine-driven, needs no human), and
- on a page load that reconciles a job,

each of which now also runs the O3 sweep — a bounded pass that deletes **every**
`meeting-audio` object older than 24 h, including those whose job row was
cascade-deleted with its meeting and therefore has no per-row path to it at all.

**The residual, stated plainly.** In a tenant where *nothing happens* — no
callbacks arriving, nobody opening a meeting or review page — nothing triggers, and
an object can outlive 24 h until the next event. The ceiling is therefore
"≤ 24 h plus the gap to the next activity in that tenant", not a wall-clock
guarantee. The window is bounded in practice by any single callback or page view,
which is why the sweep is hooked to the webhook and not only to page loads.

**Why this is accepted rather than fixed.** Adding `pg_cron` would buy a wall-clock
guarantee at the cost of the "no new cron infrastructure" decision in D10, a
scheduled job to monitor, and a second execution context with service-role reach
over storage. For a feature that ships flag-OFF, whose audio is *already* deleted
promptly on all four event paths, and whose data class is a transient recording the
platform never intended to keep, that trade is not worth taking now.

**What would reopen it.** A pilot tenant observed retaining audio materially past
24 h; a regulator or DPA asking for an enforceable ceiling rather than a
best-effort one; or the arrival of a second audio kind (D18 interviews) whose
recordings are case-PHI — that last one alone should force the cron conversation,
because a Class-1 PHI recording outliving its ceiling is a different severity of
problem from a committee meeting doing so.
