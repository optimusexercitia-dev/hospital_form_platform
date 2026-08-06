# QA review — MIN · Meeting audio → generated ata (`audio_minutes`)

- **Reviewer:** `qa` · **Date:** 2026-08-06
- **Branch:** `feat/meeting-minutes` · **Range:** `8f2aaf7..831d5a8` (14 commits)
- **Contract:** ADR [0099](../decisions/0099-meeting-audio-minutes.md) D1–D18 ·
  [plan](../plans/audio-minutes.md) (+ its binding B0 preamble) ·
  [B0 findings](../plans/audio-minutes-b0-findings.md) O1–O3 ·
  [UI brief](../design/audio-minutes-ui.md) §3/§9 · CLAUDE.md Architecture Rules
- **Method:** every SQL claim resolved against the **live catalog** (`pg_proc.prosrc`,
  `prosecdef`, `pg_policy`, `information_schema.column_privileges`, `storage.buckets`,
  `pg_indexes`), never migration text; authorization asserted **empirically** by seeding a
  `done` job with a transcript and probing five personas under `set local role` +
  `request.jwt.claims` in a rolled-back transaction. `docs/progress/authz-handoff.md` §7 read first.

## Verdict summary

| Severity | Count |
| --- | --- |
| BLOCKER | **1** |
| MAJOR | 2 |
| MINOR | 7 |
| INFO | 6 |

---

## BLOCKER

### B1 — Apply never deletes the meeting audio. Three documents say it does.

**Requirement violated:** ADR 0099 **D2** — "the platform deletes the audio at the earliest
of: callback with `audio_release=true`, **apply**, cancel, failure-acknowledged, or a 24 h
hard TTL"; ADR 0099 **Consequences** — "the platform holds meeting audio transiently
(≤ 24 h)"; plan **acceptance criterion 4** — "applied/cancelled jobs hold no
result/draft/transcript **and the bucket object is gone**"; runbook
[§5:98-99](../deployment/audio-minutes-runbook.md) repeats the same list including `apply`.

**Evidence.** There is no audio deletion on the apply path, and no later pass reaches it.

1. `src/lib/minutes-jobs/actions.ts:290-328` — `applyMinutesReview` calls
   `save_minutes_draft` then `apply_minutes_review` then `revalidateMinutes()`. No
   `deleteAudio`.
2. Catalog, `public.apply_minutes_review` `prosrc` — the purge UPDATE is
   `set status='applied', applied_at=now(), result=null, draft=null, transcript=null,
   purged_at=now()`. It never touches `audio_deleted_at` and its return value is
   `{agenda_updated, agenda_created, actions_created, actions_unassigned, meeting_id}` —
   **no `audio_path`**, so the action could not delete even if it wanted to. (Contrast
   `cancel_minutes_job`, which deliberately returns `audio_path` for exactly this purpose,
   and `actions.ts:254-256`, which uses it.)
3. Every `deleteAudio` call site in the tree — cancel (`actions.ts:255`), submit-failure
   (`actions.ts:229`), reconcile TTL (`reconcile.ts:62`), reconcile fail
   (`reconcile.ts:135`), callback done+release (`webhook.ts:71`), callback fail
   (`webhook.ts:111`). Apply is absent from that list.
4. No later pass rescues it. `reconcile.ts:68` — `if (job.status !== 'uploading' && job.status
   !== 'processing') return 'noop'` (the `done` arm returned at :60-66), so **`applied` is
   never reconciled**; and `queries.ts:89` returns `null` for any status outside
   `DISPLAYABLE = ['uploading','processing','done','failed']` **before** the reconcile call
   at :91, so an applied row is never even handed to the reconciler.

**Why this is live, not theoretical.** The only reason the object is usually gone by apply
time is the callback's `audio_release`. That flag is `false` in the documented pilot mode —
`src/lib/audio-jobs/types.ts:214-217`: *"False while something downstream (the service's
shadow comparison) still needs the audio: the platform must NOT delete the object until
this is true"* — which ADR 0099 D2 names explicitly ("also covers the pilot's
`audio_release=false`-while-shadow-runs case"). In that mode the normal, intended user
journey — callback → notification → review → Concluir, all inside 24 h — ends with the job
`applied` and the recording **retained in `meeting-audio` indefinitely**. The 24 h TTL
never fires on it, because the TTL arm only exists for `done`.

**Why the green bar cannot see it.** `e2e/helpers/minutes.ts:489` and `:504` hard-code
`audio_release: true` on both fixtures, and the happy-path spec asserts the deletion
*before* apply, with a comment saying so:

```
e2e/meeting-audio-minutes.spec.ts:222
    // audio_release=true on the fixture — the object is deleted right on completion,
    // not waiting for apply/cancel.
```

So acceptance criterion 4's "the bucket object is gone" is demonstrated only through the
callback path. Scenario 3 covers cancel (`:415-418`). The apply path has **no** audio
assertion anywhere in the spec. This is the structural case the role exists to catch: the
suite is green and the requirement is unmet.

**What closing it needs:** `apply_minutes_review` returns `audio_path` (as
`cancel_minutes_job` already does), `applyMinutesReview` calls `deleteAudio` after a
successful apply, and the E2E happy path adds a `listStorageObjects` assertion **after
Concluir** driven by an `audio_release: false` fixture — otherwise the new code is as
untested as the missing code was.

---

## MAJOR

### M1 — The "24 h sweep for objects with no live job" does not exist; two documents state it does.

**Requirement:** B0 findings **PO decision O3** — "orphaned audio is left to the 24 h TTL
sweep (**extended to cover objects with no live job**); no delete hook in v1."
Runbook [§5:107-109](../deployment/audio-minutes-runbook.md) — "A cascaded delete … orphans
the storage object. There is no delete hook in v1 (PO decision O3); **the object is swept by
the same 24 h rule.**" PROGRESS.md repeats it as decided-and-done.

**Evidence.** `reconcileMinutesJob` takes a `ReconcilableJob` (`reconcile.ts:26-40`) and is
called from exactly two places, both of which have already read a job **row**
(`queries.ts:91`, `queries.ts:167`). Nothing anywhere enumerates `storage.objects` in
`meeting-audio`. `meeting_minutes_jobs.meeting_id` is `ON DELETE CASCADE` (B0 §6), so
deleting a meeting removes the job row and with it the only pointer to the object. The
"same 24 h rule" it is deferred to has no code path that can ever look at it.

This is the standing *a comment is an assertion that goes stale silently* failure, promoted
to a runbook: an incident responder reading §5 would conclude a control is running that was
never built. Fix is either the sweep or an honest correction to both documents — but not
silence.

### M2 — The audio TTL is lazy, so "transiently (≤ 24 h)" is not true as built.

`reconcile.ts:60-66` deletes a `done` job's audio past 24 h **only when someone loads the
meeting or review page**. D10 chose laziness deliberately, and its rationale — "a stale row
nobody is looking at harms nobody until they look" — is sound *for job state*. It does not
transfer to a retention promise over a recording: a meeting whose page is never reopened
keeps its audio past 24 h for as long as the row survives, and the person harmed is not the
one looking. ADR 0099's Consequences bullet and runbook §5 both assert a ≤ 24 h ceiling that
the implementation does not enforce.

Not a defect against the letter of D10, and reasonable to accept for a flag-OFF pilot — but
it must be an *accepted* deviation recorded in the ADR, not an unnoticed gap between the
promise and the mechanism. Together with B1 and M1 the honest current statement is: audio is
deleted promptly on cancel, on failure, and on a callback with `audio_release=true`;
everything else retains it until a page load, or forever.

---

## MINOR

- **N1 — file input has no accessible name.** `src/components/meetings/minutes-upload-dialog.tsx:245-255`:
  the "Arquivo de áudio" text is a `<span>`, not a `<label>`, and there is no
  `aria-label`/`htmlFor`. `aria-describedby` supplies a description, never a name. Against
  CLAUDE.md §8. (Mirrors the pre-existing `attachment-upload.tsx:115-117` pattern — copied,
  not invented, but this feature is where it is being reviewed.)
- **N2 — progress percentage announced on every tick.** `minutes-upload-dialog.tsx:277-290`
  puts `${step2Uploading} ${upload.progress}%` inside `aria-live="polite"`, and `progress`
  updates on every `xhr.upload.onprogress` (`:145-149`). On a 500 MB upload that is a
  continuous screen-reader stream. Keep the phase in the live region; move the percentage to
  a non-live `progressbar` with `aria-valuenow`.
- **N3 — N buttons, one identical accessible name.** `review/agenda-review-card.tsx:141-153`:
  every loose resolution renders "Anexar a um item"; `title={r.text}` (`:149`) does not
  contribute to the accessible name when contents exist. Needs
  `aria-label={\`Anexar: ${r.text}\`}`.
- **N4 — deadline picker has no accessible name.** `review/actions-review.tsx:101-109`: the
  "Prazo" `<span>` is unassociated and `DatePicker` (`date-picker.tsx:33-51`) accepts `id`
  and `aria-describedby` but not `aria-label`, so every row's trigger announces only
  "Selecionar data". Internally inconsistent — the two sibling `NativeSelect`s in the same
  file do carry `aria-label` (`:85`, `:128`).
- **N5 — a raw UUID can reach the UI.** `review/speakers-panel.tsx:38` renders `s.label`,
  which `normalize.ts:146` falls back to `a.ref` — an attendee row id — when the name lookup
  misses. Not a Postgres error, but a machine identifier shown to a user (Rule 10 spirit).
- **N6 — `HC000`/`HC021` are not in the TS mapping switch.** `minutes-jobs/messages.ts:110-111`
  declares them as bare constants; `mapMinutesError`'s switch (`:83-96`) covers only
  HC0S0–HC0S6. This is **correct today** — I confirmed from the catalog that
  `apply_minutes_review` catches both inside its transaction and re-raises `HC0S6` with pt-BR
  text, and no MIN action calls `create_committee_action_item` directly — and an escapee
  would land on the pt-BR generic (`:104-105`). Flagged because the safety property lives
  only in a TS comment describing SQL: delete that `exception` block and the TS side goes
  wrong silently.
- **N7 — two `src/lib/audio-jobs/` modules lack `import 'server-only'`.** `hmac.ts` and
  `metadata.ts`, unlike their four siblings. `hmac.ts` reads no env (the secret is a
  parameter) and imports `node:crypto`, so it fails closed if bundled — but it is the
  webhook's entire security boundary and the guard costs one line.

---

## INFO

- **I1 — RLS enabled, not FORCEd** on `meeting_minutes_jobs` (`relforcerowsecurity = f`).
  Matches **all 158** `public` tables (0 force it); the DEFINER doors run as the owner by
  design. Plan text said "enable + force"; backend already reported the deviation. No action.
- **I2 — RPCs live in `public`, not `app`** as the plan wrote. Required: `config.toml`
  exposes only `public` to PostgREST. Already reported. No action.
- **I3 — a `platform_admin` can write a spurious `minutes_transcript.read` audit row.**
  `app._audit_access_authorized` short-circuits `if coalesce(app.is_admin(), false) then
  return true` above its `case`, and `log_audit_access` is executable by `authenticated`; my
  probe confirmed the call succeeds for `platform@test.local`. This grants **no** transcript
  access — the door gates itself first (verified below) — and it is a pre-existing property
  of all 18 arms, correctly called out in the new arm's own comment. Recording it so the
  audit-integrity implication is on the record somewhere other than a code comment.
- **I4 — agenda `discussion_notes`/`resolution` are not sanitized on the apply write.**
  `sanitizeDraft` (`sanitize.ts:52-54`) cleans `minutes_md` only, and
  `apply_minutes_review`'s HC0S5 backstop likewise inspects only `minutes_md`. This is parity
  with the existing agenda editor and the durable defence is render-time `MarkdownRenderer`
  (Rule 7 as the module documents it), so not a regression — but the belt-and-braces is
  narrower than the write.
- **I5 — dead strings.** Never referenced: `MINUTES_UI.transcriptExpand`,
  `transcriptCollapse`, `looseResolutionAttached`, `dirtyUnsaved`, `revisaoAtaBreadcrumb`,
  `step1Back`; `MINUTES_MESSAGES.newAgendaItemNeedsTitle`, `draftTooLarge`,
  `reviewUnavailable`, `applyFailed`. Also `actions.ts:214/259/320` return success text in
  the `error` field, which `use-minutes-action.ts:32-37` only surfaces when `!ok` — three
  unreachable strings.
- **I6 — minor a11y polish.** `review/transcript-panel.tsx:49` renders `aria-controls`
  pointing at an id that only exists while expanded; `review/ata-editor.tsx:50-59` has
  `aria-expanded` with no `aria-controls`; the include-checkbox labels in
  `agenda-review-card.tsx:76-82` / `actions-review.tsx:57-63` rename themselves on toggle
  instead of holding a stable name with `aria-checked` (the `<label>`-wrapping-`<Checkbox>`
  pattern itself is house standard).

---

## What I verified as correct

Recorded so a re-review does not re-derive it, and so the things that were *not* rubber-stamped
are visible.

**The transcript door (brief item 1) — clean, and independently proven.**
`public.read_minutes_transcript` (DEFINER) resolves the meeting and commission, then refuses
on `v_meeting is null or v_commission is null or not app.can_read_minutes_transcript(...)`
**before** `log_audit_access` — not-found, not-yours and not-done are one indistinguishable
`42501`. `app.can_read_minutes_transcript` is `status = 'done' AND
app.is_staff_admin_of_for(app.commission_of_meeting(...), p_uid)`; chasing it down,
`is_staff_admin_of_for` → `app.is_active(u) AND app.has_role('commission', c, 'staff_admin', u)`
→ a pure `memberships` existence check. **No admin arm, no `administrativo` arm** (PO decision
O1 honoured). Both audited-read registries — `public.log_audit_access`'s literal allowlist and
`app._audit_access_authorized`'s `case` — carry the `minutes_transcript.read` arm (B0 §3).

Empirically, against a seeded `done` job carrying a sentinel transcript:

| Persona | Rows visible | `read_minutes_transcript` | Other doors |
| --- | --- | --- | --- |
| `chefe.ccih` (staff_admin CCIH) | 1 | returns the text | — |
| `platform@test.local` (**platform_admin**) | **0** | **42501** | apply / cancel / save / submit / create all **42501**; complete / fail **denied at the ACL** |
| `orgadmin.a` (org_admin A) | 0 | 42501 | — |
| `multi` (plain staff of A and B) | 0 | 42501 | — |
| `anon` | denied at the ACL | denied at the ACL | — |

The **noun rule holds row-level and door-level.** Two consecutive successful reads wrote
**exactly two** `minutes_transcript.read` rows and refusals wrote none; `summary`/`metadata`
carry `{meeting_id}` only, and a `like '%<sentinel>%'` sweep of `audit_log` returned **0**.

**Column exclusion — stronger than asked.** The `authenticated` SELECT grant lists 16 columns;
**both `transcript` and `result`** are absent (the plan asked only for `transcript`). Probed:
`select transcript`, `select result` and `select *` all return 42501 for `authenticated`.
`queries.ts` uses explicit column lists throughout (`JOB_SUMMARY_COLUMNS`, `:31`) with the
hazard documented at `:23-26`. No `select('*')` anywhere in the module.

**Purge (brief item 2).** `apply` / `cancel` / `fail` each null `result`, `draft` **and**
`transcript` and stamp `purged_at` — verified in all three `prosrc` bodies. The >24 h `done`
case is **audio-delete-only** and does not fail the job (`reconcile.ts:55-66`), matching the
lead decision. Storage-object deletion is correct on cancel and on failure; **apply is B1.**

**The apply transaction (brief item 3).** Source is `j.draft`, never `result`. Ref matched
against `meeting_agenda_items` of *this* meeting → UPDATE; null **or dangling** → INSERT at
`max(position)+1`, with a `v_ref_map` so an action item's `agenda_ref` can still bind to the
row this same apply just created. Action items go through
`public.create_committee_action_item` — never a direct insert — with `HC000`/`HC021` caught
and re-raised as pt-BR `HC0S6`, and a non-member assignee **downgraded to unassigned** rather
than aborting (PO decision O2), counted as `actions_unassigned`. The `minutes_md` UPDATE is
wrapped in `set_config('app.in_meeting_rpc','on',true)` … `'off'`. The meeting's `held` status
is **re-guarded inside the transaction** (`HC0S1`) after the row was read. The audit row
carries four counts and `meeting_id` — no content. A second apply hits `HC0S3`.

**HMAC + route (brief item 4).** `await request.text()` before any parse (`route.ts:49`);
signature is over `"<timestamp>.<rawBody>"` so the timestamp cannot be swapped; length
pre-check then `timingSafeEqual` (`hmac.ts:96-101` — the pre-check exists because
`timingSafeEqual` *throws* on length mismatch, which would be both an oracle and a 500);
±300 s in **both** directions, future included; **fails closed on a missing secret**
(`:72`). 401 for signature only; 200 for unparseable body, bad metadata, flag off, unknown
job id, unknown `job_type`, and re-delivery. `src/proxy.ts:112` excludes `api/webhooks` from
the matcher, with the reasoning recorded at `:102-110`.

**PHI / content posture (brief item 5).** D14 is enforced three ways, not one: the agenda read
goes through `public.get_meeting_agenda_items` with `.select('id, title')` (`context.ts:117-120`),
`buildAgendaRefs` constructs each ref field-by-field (`:57-61`), and
`ServiceAgendaRef.description` is typed `never` upstream so a regression fails the build. No
description, discussion note or resolution can reach the payload. Notifications carry the
meeting title and a fixed pt-BR sentence — no generated content (`complete_minutes_job` /
`fail_minutes_job` `prosrc`). `webhook.ts:76-84` explicitly refuses to forward the service's
English `payload.error` to the user's chip.

**Rules 9 / 10 (brief item 6).** Zero supabase-js in any component or page — the only
`@supabase/` token under `src/components/meetings/**` is a doc comment. Every rendered string
across `minutes-labels.ts`, `messages.ts`, the 8 review components, the dialog, slot, badge,
banner and the three route files is pt-BR, including `aria-label`/`placeholder`/`title`. No
raw Postgres text reaches the UI: `mapMinutesError` passes `error.message` through only for
`HC0S1`–`HC0S6`, and I confirmed from the catalog that every one of those raises is a pt-BR
sentence; `42501` is deliberately *not* passed through (`messages.ts:97-99`); unmapped codes
hit a pt-BR generic. The only writers of the user-visible `error_message` column are three
call sites, all passing pt-BR literals.

**One-active-job (brief item 7).** `meeting_minutes_jobs_active_uidx` is
`UNIQUE (meeting_id) WHERE status IN ('uploading','processing','done')` — verified in
`pg_indexes` — and `create_minutes_job` catches `unique_violation` into `HC0S2`, so the race is
the DB's and the message is the app's.

**Secrets.** `MINUTES_CALLBACK_HMAC_SECRET` read only in the route handler;
`MINUTES_SERVICE_*` and `MINUTES_CALLBACK_BASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in
files carrying `import 'server-only'`. **No `NEXT_PUBLIC_` var is introduced.** No
`"use client"` file references any secret.

**Flag (D17).** Migration `20260910000200:55` inserts `('audio_minutes', false, …)`;
`seed.sql` flips it ON for local/E2E only, with the consequence for T3 scenario 5 written
into the seed comment. Ships OFF as decided.

**Bucket (D2/D3).** `meeting-audio`: `public = f`, `file_size_limit = 524288000`, 15 audio
MIME types. **Zero `storage.objects` policies reference it** — all access is server-minted,
as designed.

**Function ACLs.** `complete_minutes_job` / `fail_minutes_job` are `service_role`-only (my
probe confirmed an `authenticated` caller is refused at the ACL, not inside the body). `PUBLIC`
and `anon` hold no EXECUTE on any MIN function.

**Also confirmed honoured:** D7's post-apply "Agendar próxima reunião" prefilling the existing
create-meeting dialog; D12's speakers panel read-only with the explicit not-an-attendance-list
note; D13's re-run (`cancelled`/`applied` collapse to "no active job"); the review route's
three guards all redirecting indistinguishably; `coerceDraft`'s preserve-by-default spread and
its build-breaking `Record<keyof MinutesDraft, true>` guard (the fix for the
`unassigned_resolutions` data-loss class found mid-build).

---

## Required to clear this review

1. **B1** — delete the audio on apply, and prove it with an `audio_release: false` E2E fixture
   asserting the object is gone **after** Concluir. The assertion matters as much as the fix:
   the current one passes whether or not the code exists.
2. **M1** — either implement the orphan sweep O3 promised, or correct runbook §5:107-109 and
   the PROGRESS O3 line to say plainly that a cascade-orphaned object is never reclaimed in v1.
3. **M2** — record the lazy-TTL limitation as an accepted deviation in ADR 0099 (D2 or
   Consequences), so the ≤ 24 h ceiling is not asserted where it is not enforced.

MINOR and INFO items are non-blocking and may be scheduled; N1–N4 are a coherent a11y batch
worth doing together.

---

**CHANGES REQUESTED** *(round 1 — superseded by round 2 below)*

---

# Round 2 — re-review of the remediation delta

- **Date:** 2026-08-06 · **Range:** `831d5a8..b015513`
- **Fix commits:** `cba04fd` (frontend a11y) · `0939437` (backend B1 / M1 / M2 / N6 / N7 / I5) ·
  `6e4d4a6` (tester proof) · migration `20260910000400_audio_minutes_audio_reclaim.sql`
- **Method:** same standard as round 1 — the catalog and the code, never the fix reports.
  Every claim below was re-derived from `pg_proc` / `pg_policy` / ACLs or from the file, and
  the round-1 authz probe was re-run in full as a regression check.

## Round-1 findings — disposition

| # | Finding | Status |
| --- | --- | --- |
| **B1** | Apply never deletes the audio | ✅ **FIXED — and proven** |
| **M1** | The O3 orphan sweep does not exist | ✅ **FIXED — built, not just documented** |
| **M2** | Lazy TTL ≠ the asserted ≤ 24 h ceiling | ✅ **ACCEPTED — ADR 0099 Amendment 1** |
| N1–N5, I6 | a11y batch + raw UUID | ✅ Fixed, and now **verified live** |
| N6, N7, I5 | error map, `server-only`, dead strings | ✅ Fixed (N7 with a cost — see R3) |

### B1 — verified fixed, and the proof is the part that matters

**Catalog.** `public.apply_minutes_review` now reads `j.audio_path` into `v_audio_path` in
its opening `select` (line 31-32 of `prosrc`) and returns it alongside the counts. The
rebuild preserved everything a `DROP`+`CREATE` silently loses: `prosecdef = t`, owner
`postgres`, `proconfig = {search_path=app, public, pg_catalog}`, and
`proacl` still carrying `authenticated=X` — checked explicitly, because a rebuilt DEFINER
losing its ACL is a standing failure mode in this codebase.

**Code.** `actions.ts:319-334` deletes **after** the RPC and wraps it in `try/catch` that is
deliberately swallowed. That ordering is right: the ata is written and the review committed
by that point, so a storage hiccup must not surface as a failed apply — and the sweep is now
a real backstop for the miss.

**Proof.** `e2e/meeting-audio-minutes.spec.ts:458-530` (scenario 1b) is exactly the assertion
round 1 said was absent, and it is **non-vacuous**: it establishes a baseline that the object
genuinely exists after upload (`:481`), asserts it **survives** the `audio_release: false`
callback with `audio_deleted_at` still null (`:502-505`) — the pre-fix state, asserted
positively rather than assumed — and only then asserts gone + stamped after Concluir
(`:522-526`). It would have failed before `0939437`. `DoneCallbackRefs.audioRelease` defaults
to `true`, so scenario 1's existing callback-path coverage is unchanged rather than traded
away. pgTAP `7.15a` asserts the returned `audio_path` equals the row's actual value, not
merely non-null.

### M1 — verified built; the blunter predicate is accepted, and is better than what O3 wrote

`public.list_stale_meeting_audio(int, int)` — `prosecdef = t`, returns
`TABLE(object_path text, job_id uuid)`, `proacl = {postgres=X, service_role=X}`. No
`authenticated`, no `anon`, no `PUBLIC`.

I probed the door rather than reading its grant: **`authenticated` (both `chefe.ccih` and
`platform@test.local`) and `anon` are all refused at the ACL.** It enumerates every tenant's
object paths, so that split is load-bearing, and pgTAP `11.6`/`11.7` assert it **both ways** —
11.7 exists precisely so 11.6 could not pass for a function that was simply dead.

**I proved the detector can find something**, rather than accepting an empty result as health.
Seeding four objects in one rolled-back transaction:

| specimen | expected | actual |
| --- | --- | --- |
| 30 h old, **no job row at all** (cascade orphan) | found, `job_id` NULL | ✅ found, NULL |
| 30 h old, owned by an **`applied`** job (the B1 leftover) | found, with its `job_id` | ✅ found, with id |
| fresh object in `meeting-audio` | **not** swept | ✅ excluded |
| 99 h old in `form-assets` | **not** swept | ✅ excluded |

**On the blunter predicate.** Round 1 asked for "the sweep O3 promised **or** an honest
correction". This delivers both, and deliberately overshoots O3's wording: every
`meeting-audio` object past 24 h, no per-status branching. I accept it, and I think it is the
better rule. "Objects with no live job" would have left the failed-delete case unswept — which
is precisely the class that produced B1. A deviation that makes a reclamation rule *wider* and
*less branched* is the safe direction; the one to refuse would be the reverse. `sweep.ts:14-19`
argues this in the file rather than leaving it to a commit message.

Round 1 also faulted the runbook for asserting a control that did not exist. Runbook §5 is
now rewritten to describe the mechanism that was actually built, names both triggers, warns
explicitly against quoting a retention figure without reading Amendment 1, and adds an
operator query (`select * from public.list_stale_meeting_audio(24, 50);`) with "empty is the
healthy steady state". That closes the documentation half properly.

### M2 — accepted

ADR 0099 **Amendment 1** does what round 1 asked and rather more: it separates what D2
promises from what the mechanism guarantees, states the residual in one plain sentence
("≤ 24 h **plus the gap to the next activity in that tenant**, not a wall-clock guarantee"),
explains why `pg_cron` is not worth taking for a flag-OFF feature, and lists what would
reopen it. The last trigger is the sharp one and I want it on the record here too: **a D18
interview recording is case-PHI, and a Class-1 PHI recording outliving its ceiling is a
different severity of problem from a committee meeting doing so.** Whoever builds interviews
inherits this amendment, not just this decision.

### MINOR / INFO batch

Verified at the markup level and, more importantly, through the **accessibility API** in the
new E2E assertions — which closes round 1's real gap here, since the frontend's own pass could
not hydrate a browser and could only argue structurally.

- **N1** — the file input resolves through `getByLabel("Arquivo de áudio")` in
  `uploadAudioAndSubmit`, exercised by every uploading test. `getByLabel` only matches a
  genuine label/`aria-label` association, so the locator *is* the assertion.
- **N2** — the percentage moved onto `role="progressbar"` with `aria-valuemin`/`max` asserted,
  and only the phase text remains in `role="status" aria-live="polite"`. The spec holds the
  uploading phase open with a routed delay on the PUT to assert it at all — a real test, not a
  snapshot.
- **N3** — `aria-label={formatAttachResolutionLabel(r.text)}`, truncated at 80 chars
  (`minutes-labels.ts:137-141`). See R1 below for the residual.
- **N4** — `date-picker.tsx` gained an optional `"aria-label"` prop, applied to the trigger.
  I checked the shape myself because it is a shared component across 22 files: it is **purely
  additive** — an optional prop that resolves to `undefined` at every other call site, which
  React omits. No behavior change anywhere else. Per-row names `"Prazo — <title>"` asserted.
- **N5** — fixed at the render boundary, which is the right place:
  `displaySpeakerLabel` (`minutes-labels.ts:147-150`) tests the label against a UUID regex and
  falls back to a pt-BR unknown-speaker label, so a normalizer regression cannot put a machine
  id on screen.
- **I6** — `aria-controls` targets now always exist (`hidden` attribute rather than conditional
  mount); the include checkboxes hold the stable name `"Incluir na ata"` with state carried by
  Radix's `aria-checked`, and both scenario 1 and the keyboard-only scenario 8 now drive them
  by role + `toBeChecked()`.
- **N6 / N7 / I5** — error map, `server-only`, dead strings: fixed. The three misrouted
  success strings are gone and `ActionState.error` is now an error channel only; the success
  banner supplies the pt-BR confirmation, asserted in the spec.

## New observations from the delta (none blocking)

**R1 (MINOR) — N3's fix is per-resolution, not per-target, and that is my spec's fault.**
The attach button now announces `"Anexar: <resolution text>"`, but the same resolution renders
one button **per agenda card** (the spec asserts `toHaveCount(3)`), so a screen-reader user
hears three identically-named buttons and must rely on card context to know which item they
are attaching to. Frontend implemented exactly the `aria-label` round 1 prescribed; the
residual is in what I prescribed. Folding the target into the name
(`"Anexar '<resolução>' a '<item>'"`) would close it. Non-blocking.

**R2 (MINOR, open follow-up) — an undiagnosed click-delivery anomaly, mitigated not explained.**
The tester records that `transcript-panel.tsx`'s disclosure click intermittently never reaches
React when the spec file declares ≥ 8 tests (bisected: 7 always passes, 8+ always misses), with
the failure landing in scenario 1, which runs *first* — ruling out shared browser or DB state.
It is mitigated by a retry helper that always re-checks the real `aria-expanded`, so the
assertion is not weakened. I accept the "environment artifact" reading: it corroborates the
independent hydration oddity frontend hit in the same sandbox (`document.hidden: true`,
`requestAnimationFrame` never firing, on *pre-existing unrelated* buttons). But a click that
never reaches React is not self-evidently harness-only, and the mechanism is unexplained.
Worth one look on different hardware before the pilot; not worth blocking a flag-OFF feature.

**R3 (INFO) — my N7 had a cost I did not foresee, and on `hmac.ts` it was probably not worth it.**
Adding `import 'server-only'` to `hmac.ts` made it unimportable from Playwright's esbuild
loader (Next aliases that package per-bundle; the alias is webpack-only), so
`e2e/helpers/minutes.ts:15-22` now carries an **inlined copy of `signCallbackBody`**. D16's
property — "it tests our verification for real" — is now "against a transcribed twin". Drift
**fails closed** (a scheme change in `hmac.ts` would red every MIN scenario with a 401), so
this is safe, and it is flagged in PROGRESS.md. But `hmac.ts` reads no env and takes the secret
as a parameter, so it would have failed closed if bundled anyway — the guard bought little and
cost a duplicated security routine. Either keeping it or reverting it on `hmac.ts` alone is
fine by me; `metadata.ts` should keep it.

**R4 (INFO) — the sweep is a global maintenance task triggered per-tenant.** Any tenant's
callback or page load runs a bounded pass (200 objects / 10 min / instance) over **every**
tenant's stale objects. Correct for a TTL and no disclosure risk — the door is unreachable by
any user role — but the throttle is per-instance and global, not per-tenant. Immaterial at
pilot volume; worth knowing if audio volume ever grows.

**R5 (INFO) — `search_path` is the house pattern, not the plan's `''`.** All three MIN DEFINERs
carry `search_path=app, public, pg_catalog`, shared by **671** DEFINER functions here. Not a
shadowing risk: the path is pinned in `proconfig` (a caller cannot inject), the bodies are
fully qualified, and `authenticated`/`anon` hold **no CREATE** on `app`, `public` or `storage`
(verified). Closing the loop since the plan text said otherwise.

## Regression check

The delta touched a migration that rebuilds an existing DEFINER, so I re-ran round 1's
authorization probe in full rather than assuming. **Identical results:** `platform_admin` sees
0 rows and is refused by all six user-facing doors (`sem permissão`) and by the ACL on both
webhook helpers; `org_admin`, plain staff and `anon` likewise; `chefe.ccih` reads normally.
`meeting_minutes_jobs` still carries **exactly one** policy (SELECT, `authenticated`, unchanged
qual), the `authenticated` grant still lists **16** columns with `transcript` and `result`
excluded, and `read_minutes_transcript`'s body hash is unchanged. No new policy and one new
`prosecdef`, whose ACL I probed directly.

Local DB left canonical: all probes ran in rolled-back transactions — 0 job rows, 0
`meeting-audio` objects, `audio_minutes` still `t` as seeded.

## Still open at sign-off (none blocking)

- **R1** — N3's per-resolution name is ambiguous across target cards.
- **R2** — the undiagnosed click-delivery anomaly; retry-mitigated, worth one look elsewhere.
- **R3** — the duplicated `signCallbackBody` in the E2E helper (or revert `server-only` on `hmac.ts`).
- **T5 manual smoke** — still owed by the owners before the flag is enabled anywhere, per D17.
- **Cutover** — migrations `20260910000100/200/300/400` are local-only; `db push` needs the
  human's authorization and must be sequenced with the AFF push. Dark either way while the flag
  is OFF.
- The Cloud storage upload limit (runbook §2) is still blank and is a **pre-enable** gate, not a
  merge gate.

## Verdict

The blocker is fixed at the layer that had the defect, the proof that was missing now exists
and is non-vacuous, the sweep was **built** rather than documented away, and the one thing that
genuinely could not be fixed without reopening D10 was recorded as an accepted deviation
that names its own reopening conditions. Round 1's authorization posture is unregressed.

---

**APPROVED**
