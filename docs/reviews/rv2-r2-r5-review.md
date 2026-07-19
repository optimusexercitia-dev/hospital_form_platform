# QA Review — Referrals v2 (RV2) R2–R5 governance track

**Reviewer:** `qa` (qa-reviewer) · **Date:** 2026-07-19 · **Round:** r1
**Branch:** `feat/rv2-governance` · **Diff:** `main...HEAD` (commits R2 `8d2125b`, R3 `dd5d090`,
R4 `b9cad33`, R5 `c301a14`, FE `027db02`)
**Scope:** 4 backend increments (R2 triage/SLA · R3 resolution lifecycle · R4 assignments/links ·
R5 notes/receipts/redaction) + FE. Acceptance contract = the R2–R5 **Gate** bullets and the
cross-cutting **design spine §2** of `docs/plans/referrals-v2-dialogue-governance.md`, reconciled
to ADR 0078 (per the plan's top banner).
**Method:** Live catalog is the sole truth. All security claims verified against `pg_proc` /
`pg_policies` / column privileges on the running stack (`supabase_db_azkbbhskturikxpgmafq`), and the
crux keystones asserted **live under `set local role authenticated`** with real row reads, not
predicate return values. Migrations registered == files (158 == 158); `case_referrals` flag ON.

---

## VERDICT: ⛔ CHANGES REQUESTED

One **MAJOR** conformance gap (a PHI-read door with no audit, violating Rule 11 + the plan's
own audited-door invariant) and one **MINOR** a11y polish. **No P0** — the access-control
security core is airtight and fully proven live. The MAJOR is a one-line fix; everything else in
this track is exemplary.

| # | Sev | Item |
|---|-----|------|
| 1 | **MAJOR** | `list_referral_internal_notes` (the only door serving PHI note bodies) emits **no read audit**; verb `referral.note_viewed` is defined in the plan but wired **nowhere**. Violates Rule 11 + design-spine §2.1. |
| 2 | MINOR | Send-wizard "Aguardar resposta" checkbox: accessible name absorbs the full helper paragraph (should use `aria-describedby`). |
| 3 | INFO | R5 idempotency keys: not implemented. Confirm this is intended under the PO-locked "notes+receipts+redaction" trim. |

---

## Dimension 1 — Requirements (per-increment acceptance)

All present-scope schema landed; the one DEFERRED item is confirmed absent.

| Item | Evidence (live catalog) | Status |
|------|------------------------|--------|
| R2 priority / requested-action / due / PHI-free decline-reason | `case_referral.priority`, `.response_due_at`, `.decline_reason_code` present; `referral_requested_actions` vocab seeded (5 rows) | ✅ |
| R3 `answered`+`resolved` lifecycle | `case_referral_status_check` includes both; `conclude_referral` routes reply-expected→`answered`, no-reply→`completed` | ✅ |
| R3 `parent_referral_id` lineage | column present | ✅ |
| R3 close-gate | `close_case` block set = `sent,received,accepted,in_review,awaiting_information,answered`; `answered` **blocks**, `resolved`/`draft` **do not** — exactly per plan §R3 | ✅ |
| R4 `referral_assignments` + `referral_case_links` | both tables present with SELECT-only grants for `authenticated` | ✅ |
| R5 internal notes + receipts + redaction | `referral_internal_notes`, `referral_read_receipts` present; redaction RPCs present | ✅ |
| R5 context-versions **DEFERRED** | `referral_context_versions` table **does not exist** — correct | ✅ |

## Dimension 2 — Security / RLS (the crux) — verified LIVE

### R4 residue sweep — assignment ≠ access, link ≠ access (CLEAN)
Swept **every** read predicate body from `pg_proc`. Neither `referral_assignments` nor
`referral_case_links` appears in `can_read_referral`, `can_read_referral_metadata`,
`can_read_referral_phi`, `referral_target_analyst`, `can_read_case`, or the case resolver
(`has_case_capability` / `_case_caps` → both `f/f`). The two R4 tables are referenced **only** by
their own management/list RPCs plus `get_referral_detail` (display of already-authorized
referral-scoped metadata). **No read-predicate residue.** Linking a case therefore grants no
`read_case_content` capability; assigning a reviewer grants no PHI read.

### R5 internal-notes keystone (source ≠ target ≠ QPS) — PROVEN LIVE
`can_read_referral_internal_note` binds `n.committee_id` to that side's membership; there is **no
PQS arm** and cross-side is structural. Wired as the SELECT policy on `referral_internal_notes`.
Asserted live (rolled-back txn, real notes on both sides of a completed A1→B1 referral):

| Reader | Rows visible | Expected |
|--------|-------------|----------|
| source member (`...003`) | **only** the source note | ✅ |
| target member (`...006`) | **only** the target note | ✅ |
| QPS operator (`admin ...001`, pqs_member of the hospital) | **0** | ✅ (no PQS arm) |
| dual member (`multi ...008`, member of both) | 2 | ✅ (legitimate) |
| `body` column read by an authorized reader | `permission denied for table` | ✅ (PHI REVOKE forces the door) |

### PHI column REVOKEs (CLEAN)
`has_column_privilege('authenticated', …, 'SELECT')` = **false** for `referral_internal_notes.body`,
`referral_resolutions.summary_md`, `case_referral.decline_note`, `referral_messages.body`. PHI-free
siblings (`priority`, `decline_reason_code`) = true → R2 triage fields project at the metadata tier
while `decline_note` stays PHI-gated. Direct DML on the PHI tables is REVOKED
(`referral_internal_notes`/`referral_resolutions`: no INSERT/UPDATE/DELETE) → writes are RPC-only.
RLS enabled on all six new tables.

### R3 authority-FIRST — PROVEN NON-VACUOUS
`resolve_referral` and `reopen_referral` check `app.can_manage_referral_source`
(= `is_staff_admin_of_for(source_commission_id)`, source-side) → **`42501`**, **before** the state
check → **`HC0A5`**, distinct SQLSTATEs. Live proof on a `completed` (non-`answered`) referral:

- target member (non-source) → **`42501`** (authority-first; state is *also* wrong but authority wins)
- source staff_admin → **`HC0A5`** (authority passes, state fails)

The two SQLSTATEs diverging by caller identity is the non-vacuity guarantee (memory
`no-regression-claim-needs-overgrant-twin`). Both `set … waiting_on = null` on resolve; reopen is
append-only (marks the active resolution `reopened_at`, preserved).

### Redaction — append-only, audited, non-purging (CLEAN)
`redact_referral_note`/`redact_referral_message`: authority-first per owning side (`42501`),
second redaction rejected (`HC0A9`), sets `redacted_at/by/reason` (does **not** purge the body),
emits `referral.message_redacted`. Read door serves `'[redigido]'` when `redacted_at` is set —
distinct from `dispose_referral_phi`'s `[PHI removido]`. `dispose_referral_phi` composes the purge
of all four new PHI columns (notes body, `summary_md`, `decline_note`, message body).

### ADR 0079 / t19 grants (CLEAN)
Every new `public.*` RV2 RPC has PUBLIC EXECUTE **revoked** and `authenticated` + `service_role`
granted — verified for all 17 (`resolve/reopen_referral`, assignment CRUD +
`list_my_referral_assignments`, `link/unlink_referral_related_case`, `create/list_referral_internal_note`,
`redact_referral_{message,note}`, `record_referral_message_receipt`, `set_referral_deadline`,
`create/update_referral_requested_action`, `decline_referral`). New DEFINER doors follow the
reader-non-writer discipline; `get_referral_detail` does **not** project internal-note bodies
(comment-only reference — verified it is not code, avoiding the "text-is-not-truth" trap), so the
per-committee keystone is the sole note-body path.

### MAJOR-1 — internal-note PHI reads are UNAUDITED
`referral_internal_notes.body` is classified PHI (plan §2.1) and treated as PHI at rest (column
REVOKE + DEFINER door). Design-spine §2.1 is explicit: PHI bodies are *"served **only** through the
audited DEFINER door,"* and §2.4 names `referral.note_viewed` as a verb to wire. But:

- `list_referral_internal_notes` — the **only** door that serves note bodies — contains **no**
  `audit_write` call (grep of the live `pg_proc` body: no audit).
- The verb `referral.note_viewed` is emitted by **no** function anywhere in the catalog.
- No trigger on `referral_internal_notes` supplies it either.

Contrast: message bodies read via `get_referral_detail` ride `referral.viewed`; receipts ride
`referral.message_viewed` via `record_referral_message_receipt`; note *creation* rides
`referral.note_created`. Only the note **read** path is silent. This is a **Rule 11** gap ("every
PHI read is logged — records *that* + *who*") on a PHI-classified body, and it breaks the plan's
audited-door invariant and the ADR-0079 standing audit-completeness posture. It is **not** a
confidentiality breach — the access-control keystone holds — so it is MAJOR, not P0. Fix: one
`app.audit_write('referral.note_viewed', …)` (PHI-free metadata only) inside
`list_referral_internal_notes`, gated to rows the caller may read.

## Dimension 3 — Code quality (CLEAN)

- **No service-role key** reachable client-side (grep of changed `src/**`: none).
- **No unjustified `any`** in the RV2 additions (the sole `any` hit is the word inside a doc comment).
- **Data access:** `src/lib/referrals/actions.ts` uses the SSR server factory (`@/lib/supabase/server`)
  and routes 32 mutations through `.rpc()` DEFINER doors; the one direct `.delete()`
  (`deleteReferralDraft`) is the documented pre-existing R1 exception where **RLS is the sole
  authority** (`case_referral_delete_draft_source` = `status='draft' AND can_manage_referral_source`,
  backed by the `guard_referral_status` DELETE arm). I re-verified that policy predicate is **current**
  (`status = 'draft'`, English key — the D11 stranded-predicate bug is fixed). Reads live in
  `src/lib/queries/referrals.ts`.
- **pt-BR** user-facing strings; errors mapped via `mapReferralError` (no raw Postgres to UI).

## Dimension 4 — UX & a11y

- **MINOR-2:** In `referral-send-wizard.tsx` (~L644–659) the "Aguardar resposta" `<input
  type="checkbox">` is nested in a `<label>` whose content is the title span **plus** the full
  two-sentence helper paragraph, so the control's accessible name becomes the entire paragraph.
  The control *is* labeled, keyboard-operable, and has a visible focus ring — hence MINOR — but the
  helper text should move to `aria-describedby` so the accessible name is just "Aguardar resposta".

## Dimension 5 — Hygiene

- Migrations registered == files; flag ON; disposal composition extended per phase (Rule 12).
- **INFO-3:** R5 idempotency keys are not implemented. The plan flags them as the softest,
  droppable item and the PO-locked trim names only "notes+receipts+redaction," so this is likely
  intentional — confirm with the PO rather than treat as a finding.

---

## What blocks / what to fix
- **MAJOR-1** (blocking): add the `referral.note_viewed` PHI-read audit to
  `list_referral_internal_notes`. Then re-run the referral pgTAP suite (extend a keystone that a
  note read emits exactly one audit row, PHI-free) and this review re-checks only the audit path.
- **MINOR-2** (fold into the same round): `aria-describedby` on the send-wizard checkbox.

Everything else — the entire access-control surface (R4 residue-free, R5 source≠target≠QPS keystone,
PHI REVOKEs, R3 authority-first non-vacuity, redaction, t19 grants) — is verified live and correct.
