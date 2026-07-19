# Referrals v2 — Dialogue & Governance — build plan

**Status:** PLANNED (design accepted by the product owner 2026-07-12; not implemented).
**Owner:** platform lead → `backend` (+ `frontend` per named UI). **Track:** pre-pilot
expansion of the shipped Phase-22 referral module (flag `case_referrals`).
**Posture:** pre-pilot, **reset-OK** — no live referral data yet, so every change is
**additive / forward-only**, no back-compat migration, folded into the final pilot reset
(memory `prelaunch-db-reset-ok`).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never
contradict), Rule 6 (storage immutability), Rule 10 (pt-BR UI / English code), Rule 11
(append-only audit), Rule 12 (PHI isolation + audited single door).
**Sources:** ADR [0037](../decisions/0037-inter-committee-case-referrals.md) **Amendment 1**
(the decision record) · evaluation
[referral_data_model_evaluation.md](../design/temp/referral_data_model_evaluation.md) ·
partner handoff [inter_committee_referral_data_model.md](../design/temp/inter_committee_referral_data_model.md).

> **⚠ Reconciled to ADR [0078](../decisions/0078-authorization-capability-model.md) (2026-07-18; catalog-verified
> on the live stack). PO-locked (2026-07-18): build FULL R2→R5; R3 = full `answered`/`resolved` lifecycle; R5 trims
> to notes+receipts+redaction (context-versions **DEFERRED** — overlaps 0078's reserved post-pilot F-full); QPS
> excludes internal notes.** The F1 five-way referral-predicate split is LIVE (catalog-confirmed): `can_read_referral`
> (legacy, still present), **`can_read_referral_metadata`** (metadata tier), `can_read_referral_phi` (PHI door),
> **`can_write_referral_response`** (write gate), **`referral_target_analyst`** (re-anchored on `case_access_grants`),
> + the `can_manage_referral_{source,target,phi_disclosure}` family. Per-increment reconciliation:
> - **R2** — PHI-free triage fields project through **`can_read_referral_metadata`** (⚠ verify vs `can_read_referral`
>   at build — both exist; gate metadata-tier fields on the *current* metadata predicate). HC0A3/HC0A4.
> - **R3** — `resolve_referral`/`reopen_referral` are **SOURCE-coordinator** actions → gate on **`app.can_manage_referral_source`**
>   (catalog-corrected 2026-07-19: `can_write_referral_response` = `can_manage_referral_target`, the *target* side — wrong for resolve;
>   authority fails **`42501`-first**, distinct from state). Status CHECK **+= `answered`,`resolved`** + `parent_referral_id`;
>   `conclude_referral` reply-expected → `answered` (else `completed`); source `resolve_referral` → `resolved`; `reopen_referral` → `in_review`.
>   close_case block set = R1 set **+ `answered`** (`answered` blocks, `resolved` releases; **`draft` stays non-blocking**). HC0A5/HC0A6.
> - **R4** — assignments/links grant **no** extra read; the primary target link stays `case_referral.target_case_id`
>   (read by `referral_target_analyst`, now `case_access_grants`-anchored). ⚠ a `link_referral_case` RPC already exists
>   — R4's `referral_case_links` is the ADDITIONAL typed-links table; reconcile naming at build. HC0A7/HC0A8.
> - **R5** — internal-notes keystone (source≠target) via a new `can_read_referral_internal_note`; **context-versions
>   DEFERRED**; keep receipts + redaction. HC0A9.

---

## 0. Why

Pilot-prep testing surfaced the one interaction the shipped model cannot do: **mid-review,
two-way dialogue**. Today the target committee (B) can only *decline with a note* or
*conclude with a single structured reply* — there is no channel to **ask the source (A) a
clarifying question and receive an answer before concluding**. A partner team's from-scratch
referral model was evaluated feature-by-feature; this plan implements the **Essential** and
**Deferred** adoptions and records (again, for builders) the **Avoided** items. The Phase-22
security core — frozen-snapshot disclosure boundary, PHI single-door, QPS oversight plane,
hash-chained audit — is **extended, never contradicted**.

**Scope in:** the two Essential items + the twelve Deferred items, sequenced R1→R5 behind a
design/contract gate R0. **Scope out (Avoided — §5):** `row_version`, `referral_status_events`,
PHI-in-`structured_context`, `referral_participants` ACL, a referral-local outbox.

---

## 1. The three-bucket disposition (summary — full rationale in the evaluation doc)

| Tier | Items | Phase |
|---|---|---|
| **Essential** | shared message thread (`referral_messages`); `awaiting_information` + `waiting_on_committee_id` | **R1** |
| **Defer** | priority · `requested_action` vocab · `response_due_at`+overdue · non-PHI decline-reason | **R2** |
| **Defer** | reopen + answered/resolved split (`referral_resolutions`) · `parent_referral_id` lineage | **R3** |
| **Defer** | `referral_assignments` (responsibility ≠ access) · multi typed `referral_case_links` | **R4** |
| **Defer** | committee-private `referral_internal_notes` · snapshot `referral_context_versions` · `referral_read_receipts` · per-message redaction · idempotency keys | **R5** |
| **Avoid** | `row_version` · `referral_status_events` · PHI `structured_context` · `referral_participants` ACL · referral-local outbox | — (§5) |

R1 is **pilot-critical**; R2–R5 target the same pre-pilot window but may slip to fast-follow
if the pilot date compresses — R1 alone makes referrals usable.

---

## 2. Design spine — cross-cutting rules every phase conforms to

These are the load-bearing constraints; the per-phase reviews are conformance checks, not
re-litigation.

1. **PHI gating for every new free-text body.** `referral_messages.body`,
   `referral_internal_notes.body`, `referral_resolutions.summary_md`, and any re-disclosed
   `referral_context_versions.case_summary` are **PHI-bearing by classification** (ADR 0036 /
   Rule 12). Each inherits the exact `frozen_body_md`/`result_md` treatment:
   - **Column-level `REVOKE SELECT … FROM authenticated`**; the row's `SELECT` policy is
     **`app.can_read_referral_phi`** (not the broad `can_read_referral`).
   - Bodies are served **only** through the audited DEFINER door **`get_referral_detail`**
     (extended), **nulled** for a metadata-only (`can_read_referral`) reader.
   - Writes go **only** through DEFINER command RPCs (direct DML REVOKED), which lock the
     `case_referral` row `FOR UPDATE` (house concurrency pattern — no `row_version`).
2. **PHI-free projections stay PHI-free (Decision 16).** Hub / inbox / QPS dashboard show
   **counts + metadata only** — status, priority, type, `last_message_at`, unread count,
   waiting-on, due/overdue. **Never** a message-body or "last message" text preview.
3. **Tenant scoping follows the incumbent referral-child pattern.** New child tables key on
   `referral_id → case_referral(id)` (as `referral_shared_item`/`referral_reply` do) — **not**
   the partner doc's `(organization_id, id)` composite-FK convention. Commission/hospital/org
   is resolved through the parent referral.
4. **Audit (Rule 11).** New verbs — `referral.message_created`, `referral.message_viewed`
   (R5 receipts; body reads otherwise ride the existing `referral.viewed`),
   `referral.note_created`, `referral.note_viewed`, `referral.message_redacted` — are added to
   **`log_audit_access`** + its **`_audit_access_authorized`** dispatch
   (`20260711000100_grant_hardening.sql:111–264`), each resolving a `can_read_referral*` gate,
   **PHI-free metadata only**. `trg_audit_referral` continues to emit
   `referral.created`/`.status_changed`/`.updated`; reopen/resolve ride `.status_changed`.
   Every **new `public.*` RPC** does `REVOKE ALL … FROM PUBLIC` **before** `GRANT`
   (memory `new-public-rpc-revoke-from-public` — the t19 pgTAP guard).
5. **Disposal composition (Rule 12).** Every phase that adds a PHI-bearing column **extends
   `dispose_referral_phi`** to purge it, layered in phase order (like the foundations program's
   disposal-compose discipline).
6. **QPS oversight scope.** QPS (`app.is_pqs_member` / operator) extends its read to the new
   **official-record** tables (messages, resolutions, assignments, case-links, context
   versions). **Open decision (§7):** QPS does **not** read `referral_internal_notes` by default
   — deliberative scratchpad, not the official record.
7. **SQLSTATE block.** Referrals hold `HC070–HC079`; the current HC high-water is **HC098**
   (F2), HC099 reserved. This program claims **`HC0A0–HC0A9`** (confirm the base against the
   live high-water at R0 — the point is *contiguous, above HC099*; a collision is caught by
   build/pgTAP). Per-phase allocation in §3.
8. **Flag.** All v2 tables/RPCs ship behind the existing **`case_referrals`** flag; the
   pilot's referral-enablement is a product-owner decision (§7).
9. **Lifecycle keys are extended, not renamed.** Current anglicized set — `draft, sent,
   received, accepted, rejected, in_review, completed, withdrawn` — gains `awaiting_information`
   (R1), `answered` + `resolved` (R3). Labels pt-BR via `REFERRAL_STATUS_LABELS`.

---

## 3. Phased sequence

> All phases: `backend`-owned migrations, forward-only (reset-OK), sequential timestamp
> windows, **contract-first** (`backend` posts typed stubs in `src/lib/referrals/{types,
> messages,actions}` + `queries/referrals.ts` before `frontend` starts), one Phase Gate each
> (CLAUDE.md §6). File-ownership binding: two teammates never edit one file per phase.

### R0 — Design & contract gate  *(design; tiny/no migration)*
- **Deliverable:** this plan + ADR 0037 Amendment 1 + PHASES/PROGRESS rows (done at planning);
  ratify the SQLSTATE base (`HC0A0`), the audit-verb set, and the R1 typed contract stubs.
  Confirm the pilot referral-flag decision (§7).
- **🔴 review:** the message/notes **PHI-gating design** (the one security-critical piece) —
  reviewed once here so R1/R5 are conformance.
- **Gate:** lead + human sign-off; no build to test. **Unblocks:** R1.

### R1 — Dialogue core  *(ESSENTIAL; flag `case_referrals`)*
- **Schema:**
  - **`public.referral_messages`** — `id`, `referral_id → case_referral(id)`,
    `sequence_number int` (`UNIQUE(referral_id, sequence_number)`), `sender_commission_id`
    (= source or target, CHECK), `sender_user_id → profiles`, `message_type text` CHECK
    `∈ {general, information_request, information_response, clarification}`, **`body text`
    (PHI — column-REVOKED)**, `created_at`. Reserved-inert for R5: `in_reply_to_message_id`,
    `supersedes_message_id`, `redacted_at/by/reason`.
  - **`case_referral`** += `waiting_on_committee_id uuid NULL` (CHECK = source or target),
    `last_message_at timestamptz NULL` (inbox cache); **status CHECK widened** with
    `awaiting_information`.
- **RPCs (DEFINER, REVOKE→GRANT):** `post_referral_message(referral, type, body)` — gate
  `can_read_referral_phi` writer + non-terminal status; locks `case_referral FOR UPDATE`,
  allocates `sequence_number`, updates `last_message_at`/`updated_at`, emits
  `referral.message_created` (**HC0A0** shape/entitlement). `request_referral_information(referral,
  body)` — target coordinator/analyst; posts `information_request`, sets
  `status=awaiting_information`, `waiting_on=source` (**HC0A1** wrong status).
  `provide_referral_information(referral, body)` — source coordinator; posts
  `information_response`, sets `waiting_on=target`, `status=in_review`. **Extend
  `get_referral_detail`** to return the ordered thread with `body` nulled for metadata-only
  readers (bodies ride the existing `referral.viewed` audit).
- **RLS:** `referral_messages` SELECT = `can_read_referral_phi`; INSERT via RPC only (DML
  REVOKED). Hub count/`last_message_at` flow via the `case_referral` `can_read_referral`
  projection.
- **Close-gate:** *no change needed* — `awaiting_information` is non-terminal, so `close_case`
  (HC076, `NOT IN (completed,rejected,withdrawn)`) already blocks on it. (R3 adds `resolved` to
  the release set.)
- **Frontend:** referral-detail **thread panel** (sequence, sender-committee, type badge, body)
  + composer with **"Solicitar informação"** (target) / **"Responder"** (source) / **"Comentar"**;
  `awaiting_information` badge + waiting-on indicator; hub gains an **unread / last-activity**
  column (metadata only). pt-BR, keyboard-accessible, reduced-motion-safe GSAP.
- **Gate / pgTAP keystones:** `sequence_number` concurrency (two concurrent posts → distinct
  seq); **body PHI-lockdown** (metadata reader → NULL body; PHI reader → body + one
  `referral.viewed`); non-participant → nothing; request/provide set `waiting_on`+status;
  `close_case` blocks while `awaiting_information`; message on a foreign referral rejected.

### R2 — Triage, SLA & requested-action  *(DEFER; all PHI-free metadata)*
- **Schema:** `case_referral` += `priority text NOT NULL default 'routine'` CHECK
  `∈ {routine, high, urgent, critical}`; `requested_action_id → referral_requested_actions`
  + `requested_action_label` (snapshot); `response_due_at timestamptz NULL`;
  `decline_reason_code text NULL` CHECK `∈ {outside_jurisdiction, duplicate, wrong_committee,
  insufficient_information, conflict_of_interest, other}` (**PHI-free**, distinct from the PHI
  `decline_note`). New vocab **`referral_requested_actions`** (mirrors `referral_types`:
  key/label/description/color_token/position/is_active; seeded). Overdue is **computed**
  (`response_due_at < now()` AND status non-terminal) — reuse `isOverdue`
  (`src/components/cases/format.ts`) in TS + a SQL predicate for QPS aging.
- **RPCs:** extend `create_referral_draft`/`update_referral_draft` (priority, requested-action,
  due); extend `decline_referral` with `p_decline_reason_code`; vocab CRUD for requested-actions
  (**HC0A3**); optional coordinator "set deadline" (**HC0A4** past-date on send).
- **Frontend:** priority selector+badge; requested-action picker; due-date picker + **overdue
  chip**; QPS aging keyed on `response_due_at`; **non-PHI decline-reason** select on the decline
  dialog + on the metadata view (**closes the deferred WS-4 C-6c item**).
- **Gate:** priority/action/due/decline-reason are **PHI-free** — assert they appear in
  `can_read_referral` projections/inbox with **no** PHI leak; overdue predicate == `isOverdue`;
  `decline_note` stays PHI-gated while `decline_reason_code` shows to non-PHI readers.

### R3 — Resolution cycles, reopening & lineage  *(DEFER; 🔴 state-machine change)*
- **Schema:** **`public.referral_resolutions`** — `id`, `referral_id`, `resolution_number int`
  (`UNIQUE(referral_id, resolution_number)`), `resolved_by_commission_id` (=source),
  `resolved_by_user_id`, **`summary_md` (PHI — REVOKED)**, `follow_up_required bool`,
  `final_reply_id → referral_reply` NULL, `resolved_at`, `reopened_at/by/reason`; partial-unique
  **one active resolution** (`reopened_at IS NULL`) per referral. `case_referral` **status +=
  `answered`, `resolved`** and `+= parent_referral_id uuid NULL` (self-FK; CHECK ≠ self;
  same-tenant).
- **Lifecycle (amends ADR 0037 D4/D5):** reply-expected → `conclude_referral` now targets
  **`answered`** (B delivered the formal response, awaiting A) → source **`resolve_referral`** →
  **`resolved`**. No-reply-expected keeps **`completed`** (B acknowledges, terminal). `close_case`
  release set becomes `NOT IN (completed, resolved, rejected, withdrawn)` — **`answered` blocks**
  until A resolves.
- **RPCs:** `resolve_referral(referral, summary?, follow_up?)` (source coordinator; `answered→
  resolved`, writes resolution, clears `waiting_on`; **HC0A5**). `reopen_referral(referral,
  reason)` (source; marks active resolution `reopened`, `→ in_review`/`awaiting_information`,
  new `resolution_number` on next resolve; append-only). `conclude_referral` amended to route
  reply-expected → `answered`. `create_referral_draft` accepts `p_parent_referral_id` (**HC0A6**
  invalid). Extend `dispose_referral_phi` to purge `summary_md`.
- **Frontend:** source-side **"Resolver" / "Reabrir"** + resolution history; `answered` vs
  `resolved` badges; **"Encaminhar adiante"** pre-filling `parent_referral_id`; QPS **chain**
  view by lineage.
- **Gate:** `answered` blocks close / `resolved` releases; reopen preserves the prior resolution
  row (append-only) + increments `resolution_number`; **downstream child shares nothing
  automatically** (parent snapshot not reachable from child unless re-shared) — the ADR 0037 D15
  invariant, pgTAP-locked.

### R4 — Responsibility & multi-linkage  *(DEFER)*
- **Schema:** **`public.referral_assignments`** — `id`, `referral_id`, `commission_id` (source
  or target), `assignee_user_id`, `assignment_role text` CHECK `∈ {referral_coordinator,
  primary_reviewer, secondary_reviewer, clinical_reviewer, legal_reviewer, committee_chair}`,
  `status text` CHECK `∈ {pending, accepted, in_progress, completed, cancelled}`, `due_at`,
  `assigned_by`, `assigned_at`, `completed_at`, `cancelled_at`; index on `(assignee_user_id)
  WHERE status IN (pending,accepted,in_progress)`. **`public.referral_case_links`** — `id`,
  `referral_id`, `case_id`, `commission_id`, `relationship_type text` CHECK `∈ {related_case,
  follow_up_case, escalated_case, duplicate_case}`, `created_by`, `created_at` (the *primary*
  target link stays `case_referral.target_case_id`, which `referral_target_analyst` reads; this
  table is **additional** typed links).
- **RPCs:** `assign_referral_reviewer` / `update_referral_assignment` / `cancel_referral_assignment`
  (coordinator of that side; **HC0A7**); `list_my_referral_assignments`;
  `link_referral_related_case` / `unlink_referral_case` (**HC0A8**). Assignment ≠ access:
  responsibility does not widen reads (PHI access still via coordinators/analyst/QPS).
- **Frontend:** assignment panel (reviewer, role, status, due) + **"Minhas atribuições de
  encaminhamento"** list; related-cases panel (typed links).
- **Gate:** assignment grants **no** extra read; `referral_case_links` grants **no** case access
  (independent `can_read_case`, external §10.5), pgTAP-locked; assignment status guards.

### R5 — Private notes, disclosure controls & hardening  *(DEFER)*
- **Schema:** **`public.referral_internal_notes`** — `id`, `referral_id`, `committee_id`
  (owning side), `author_user_id`, **`body` (PHI — REVOKED)**, `created_at`, `redacted_at/by/
  reason`; **RLS: readable only by users authorized to represent *that* committee for *that*
  referral** — source participants read source notes, target read target notes, **never cross**
  (predicate `can_read_referral_internal_note`). **`public.referral_context_versions`** — OR
  extend `referral_shared_item` with `version_number` + `superseded_at` (partial-unique current
  version) for **re-disclosure** (A shares an updated snapshot alongside an
  `information_response`). **`public.referral_read_receipts`** — `(message_id, user_id)` PK,
  `delivered_at`, `read_at`, `acknowledged_at`. **Redaction** — the reserved
  `redacted_at/by/reason` on messages + notes, filled by a privileged
  `redact_referral_message`/`redact_referral_note` (coordinator; **HC0A9**), body served as
  `[redigido]` to all but audited who/why (distinct from `dispose_referral_phi`, which purges).
  **Idempotency** — optional `p_idempotency_key` on command RPCs → dedup table.
- **Audit:** add `referral.note_created` / `referral.note_viewed` / `referral.message_viewed`
  (receipts) / `referral.message_redacted` to the allow-list + dispatch. Extend
  `dispose_referral_phi` to purge note/context bodies.
- **Frontend:** per-committee **internal-notes panel** (private); **"Compartilhar contexto
  atualizado"** (context version); read/ack indicators; privileged redaction + `[redigido]`
  rendering.
- **Gate (keystone):** **source can NEVER read target internal notes and vice-versa** (the
  security keystone, pgTAP); context-version supersede keeps exactly one current; redaction
  stays append-only + audited; idempotency dedups a double-submit.

---

## 4. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4)

- **R1:** `…_referral_messages.sql` (table + `case_referral` cols + status widen + RLS + column
  REVOKE) · `…_referral_dialogue_rpcs.sql` (`post`/`request`/`provide` + `get_referral_detail`
  override + audit-verb add). Regen types.
- **R2:** `…_referral_triage.sql` (priority/action/due/decline-reason cols + `referral_requested_actions`
  vocab + seed + vocab CRUD RPCs + draft/decline RPC extensions). Regen types.
- **R3:** `…_referral_resolutions.sql` (table + status widen + `parent_referral_id`) ·
  `…_referral_resolution_rpcs.sql` (`resolve`/`reopen` + `conclude` amend + `close_case` release-set
  update + `dispose_referral_phi` compose). Regen types.
- **R4:** `…_referral_assignments_links.sql` (both tables + RPCs). Regen types.
- **R5:** `…_referral_notes_disclosure.sql` (notes + context versions + receipts + redaction +
  idempotency + audit verbs + `dispose_referral_phi` compose). Regen types.
- **Remote deploy** is **user-authorized** per phase (`supabase db push` / a folded pilot reset;
  background agents auto-denied — memory `remote-db-push-needs-user-auth`). Local first
  (`supabase migration up`); regen `database.ts` after each.

---

## 5. Avoided items (recorded so builders don't reintroduce them)

| Rejected | Why (we already have equal-or-better) |
|---|---|
| **`row_version` optimistic concurrency** | House model = DEFINER RPC + `FOR UPDATE` + RLS (zero `row_version` in-tree). We keep the partner `sequence_number` lock; no compare-and-set. |
| **`referral_status_events` history table** | Redundant with the tamper-evident hash-chained `audit_log` (Rule 11). A timeline UI reads a **view over `audit_log`**, not a second write log. |
| **`structured_context` jsonb with clinical/patient data** | Violates Rule 12 (PHI outside the isolated `referral_patient` door). Any such field must be **PHI-free**. |
| **`referral_participants` per-user ACL** | Forks the auth model; `can_read_referral` / `can_read_referral_phi` / `referral_target_analyst` already enforce least-privilege PHI access. Revisit only for concrete non-member guest access. |
| **Referral-local transactional outbox** | No outbox anywhere today (only `audit_log`); notifications are platform-wide → **Phase 20**, not this module. |

---

## 6. Testing & gates

- **pgTAP is the lock.** Each phase extends `supabase/tests/150_referrals.sql` (currently 44
  assertions) with its §-named keystones; re-run the **full ordered** `supabase test db` on a
  **fresh reset** (memory `pgtap-needs-fresh-reset-vs-e2e-leftovers`), confirming the
  `case_referrals` flag is actually enabled in the fixture.
- **E2E (Playwright).** Extend `e2e/phase22-referrals.spec.ts` (29 tests, serial) per phase; the
  **lead** runs the full suite as a background command against a **prod-standalone** server via
  `npm run e2e:prod` (memory `e2e-gate-run-mechanics`, `subagent-cannot-run-full-e2e`); triage
  against the flaky baseline before calling regression.
- **Each phase = one Phase Gate:** build (lint/tsc/vitest) → tester full-suite green → qa review
  (`docs/reviews/…`) → human approval → Record (PROGRESS + `docs/backend-state.md` referral
  surface + graphify `update .`). Record step also applies the ADR 0037 / ARCHITECTURE Rule-12
  wording slice for that phase and updates the CLAUDE.md referral one-liner once R1 lands.

---

## 7. Risks & open decisions for the product owner

1. **R1 is the pilot gate; R2–R5 target the same window but may fast-follow.** If the pilot date
   compresses, ship R1 (dialogue) and slip R2–R5 — R1 alone makes referrals usable.
2. **Enable `case_referrals` for the pilot?** The module ships behind the flag; v2 assumes the
   pilot **uses** referrals. Confirm — if the pilot excludes referrals, this whole program can
   defer to fast-follow.
3. **R3 changes the terminal lifecycle** (adds `answered`/`resolved`; reply-expected no longer
   auto-`completed`). It's the governance-correct model (requester confirms closure) but touches
   `conclude_referral`, the close-gate, seed, pgTAP, E2E, and every status renderer — the 🔴 item.
   Alternative if churn is unwanted: keep `completed` for all and add only `reopen` (lose the
   explicit A-confirms-closure step).
4. **Does QPS oversight include `referral_internal_notes`?** Default here = **no** (deliberative
   scratchpad ≠ official record; preserves each committee's private-work guarantee). Flip to yes
   only if accreditation requires QPS to audit deliberation.
5. **Effort (rough):** R0 ≈ 0.5d · **R1 ≈ 3–5 backend + 2–3 frontend** · R2 ≈ 2–3 + 2 ·
   R3 ≈ 3–4 + 2 · R4 ≈ 2–3 + 2 · R5 ≈ 3–4 + 2–3. All front-loaded to the gate, not production
   (reset-OK = no data migration). Total ≈ 3–4 build-weeks for the full program; R1 ≈ 1 week.
6. **`referral_read_receipts` / redaction / idempotency (R5)** are the softest items — the partner
   doc itself defers receipts. If the window is tight, R5 is the first to trim to notes-only.

**Bottom line:** one program, one design gate (R0), five gated builds. R1 (dialogue) is the
pilot-critical increment that closes the tested gap; R2–R5 layer triage, governance, and
disclosure controls. Everything is additive on the shipped Phase-22 core, PHI-gated to the same
single-door discipline, and lands pre-pilot on a disposable DB behind `case_referrals`.
