# QA Review — Controlled-Document Redesign (Phase 17 v2, ADR 0081)

**Branch:** `feat/document-control-redesign` · **Reviewer:** `qa` · **Date:** 2026-07-21 (r1)
**Scope reviewed:** commits `5752aa9` (BE W1) · `a8dbb7e` (BE W2.5a) · `ba29228`…`7e7630c` (FE) ·
`e2d2530`…`f87165e` (tester), diffed against `main`.
**Method:** live-catalog interrogation of the local Postgres (`pg_proc`/`prosecdef`, `pg_policy`/ACL,
`pg_constraint`, `pg_trigger`, `pg_get_functiondef`) — never migration-file text; plus a read-only pass
over the frontend/action diff.

## Verdict: ✅ APPROVED

0 BLOCKER · 0 MAJOR · 0 MINOR · 4 INFO. Every locked ADR-0081 decision is delivered; the security crux
(two new DEFINER doors) holds under catalog inspection; the B0 anglicization did not weaken any authority
check and left zero residual pt-BR enum literals in controlled-docs function bodies. The INFO notes are
observations for the record, not change requests.

---

## Security / RLS (the crux) — PASS

### New DEFINER read `list_commission_documents` — verified live
- `prosecdef = t`; owner `postgres`; `search_path` pinned to `app, public, pg_catalog`.
- **Flag gate** first: `perform app.assert_controlled_docs_enabled()`.
- **Commission-authority gate** in the body: `if not (app.is_member_of(p_commission) or
  app.is_commission_admin_of(p_commission)) then return;` — a non-member/foreign-commission caller
  gets an empty set (no rows, no leak).
- **ACL**: `authenticated=X` + `service_role=X` only; **no PUBLIC and no anon grant** (no empty-grantee
  ACL entry). REVOKE-from-PUBLIC confirmed.
- Approval counters use the English `decision = 'approved'` key (anglicization intact).

### New RPC `remind_document_approver` — verified live
- `prosecdef = t`; `search_path` pinned; ACL `authenticated`/`service_role` only, **no PUBLIC/anon**.
- **Authority enforced server-side** (not UI-only): `if not (app.is_staff_admin_of(v_commission) or
  app.is_commission_admin_of(v_commission)) then raise 42501`. Also gated on version status =
  `in_approval` (HC089) and on the target being a *still-pending named approver of THIS version*
  (`decision is null`, else HC091) — so it cannot be aimed at an arbitrary user or across versions.
- Recipient of the enqueued notification is the scoped `p_approver_id` under the owning `v_commission`;
  deduped per approver per day. No cross-commission/tenant reach.

### B0 anglicization did not weaken authority — verified live
- `publish_document`'s all-must-approve gate reads `where document_version_id = p_version_id and
  (decision is null or decision <> 'approved')` → HC090 — the English key survived; the gate is intact
  and non-vacuous.
- CHECK constraints are all English: `controlled_documents.doc_type` ∈
  `policy/sop/protocol/bylaws/manual/other`; `document_approvals.decision` ∈ `approved/rejected`;
  `controlled_document_versions.obsolete_kind` ∈ `superseded/retired`.
- Catalog sweep for `'aprovado'|'rejeitado'|'politica'|'protocolo'|'regimento'|'pop'|'outro'` inside any
  `document`/`controlled` function body returned **empty**. The pt-BR literals that remain in the catalog
  belong to the **out-of-scope ethics module** (`case_decisions`, `ethics_decision_details`) — correctly
  untouched (function-scoped replace, not blanket — exactly per ADR 0081 §Consequences / ADR 0069).

### Notification producers — no cross-commission leak
- `submit_document_for_approval`: recipients are the named approvers, each validated via
  `is_entitled_document_approver(v_hospital, v_approver)` (hospital-scoped, active) before insert;
  duplicate/invalid approvers rejected (HC091/HC092). Notifications scoped to `v_commission`.
- `publish_document`: notifies only the document author (`created_by`), scoped to `v_commission`,
  skipping self-notify.
- `app.enqueue_notification` is a DEFINER helper whose recipient/commission are supplied by the caller;
  every caller scopes them from the version's own roster/header — no tenant crossover.
- New notification enum values are accepted by the table CHECKs (`kind` ∋ `document_approval`,
  `document_review_due`; `entity_type` ∋ `controlled_document_version`, `controlled_document`), so
  producers enqueue rather than silently constraint-fail.

### Audit posture (Rule 11) — PASS
- `trg_audit_controlled_documents` payload whitelist `c_cols = {code, doc_type, status,
  review_cycle_months}` — `category`/`tags`/`description`/`title` are **excluded from the payload**
  (same low-sensitivity treatment as `title`), while every INSERT/UPDATE/DELETE still emits an audit row
  (a metadata-only UPDATE takes the unconditional `document.updated` branch). Bodies never audited.

### PHI (Rule 12) — N/A confirmed
- No new PHI module or column. `category`/`tags`/`description` are committee-document metadata on the
  header (same class as `title`); nothing new introduced patient data.

### Approver isolation preserved
- `notificationHref` routes `controlled_document_version` deep-links to the **org-level**
  `documentos-pendentes/<docId>` sign page (an approver may sit outside the commission), and
  `controlled_document` to the commission-scoped detail — consistent with the existing Phase-17
  isolation model; no new commission-area exposure for outside approvers.

### Chained actions bypass no gate
- `createAndSubmitDocument` / `supersedeAndSubmitDocument` call the same DEFINER RPCs
  (`create_controlled_document` → `set_document_version_file` → `submit_document_for_approval`; or
  `supersede_document` → …), each of which re-enforces `is_staff_admin_of/is_commission_admin_of`. The
  chain is a convenience over the staged path, not a privilege shortcut.

---

## Requirements — PASS (every locked decision delivered)

| ADR-0081 decision | Status | Evidence |
| --- | --- | --- |
| All-in-one create wizard + Save-as-draft | ✅ | `create-wizard.tsx` (4-step); `createAndSubmitDocument` + `createDraftOnly` chained actions |
| New-version wizard (locked identity) + `supersedeAndSubmitDocument` | ✅ | `nova-versao/page.tsx`; `supersedeAndSubmitDocument` takes no title/type/category/tags (identity frozen) |
| Gap a — approver notifications + Remind | ✅ | producers in `submit_document_for_approval`/`publish_document`; `remind_document_approver` RPC + `remind-approver-button.tsx` |
| Gap b — version compare | ✅ | `version-compare-modal.tsx` (metadata + change-summary side-by-side) |
| Gap c — category + tags | ✅ | `controlled_documents.category` / `tags text[]`; `tag-field.tsx`; register filters |
| Gap d — retired vs superseded (`obsolete_kind`) | ✅ | publish stamps `superseded`; `mark_document_obsolete` stamps `retired`; CHECK `{superseded,retired}` |
| Register full-adopt (KPI/chips/search/table/mini-bar) | ✅ | `document-kpi-strip.tsx`, `document-register-filters.tsx`, `document-register-table.tsx` |
| B0 enum-key anglicization (English keys, pt-BR labels) | ✅ | constraints English; `DOC_TYPE_LABELS`/`APPROVAL_DECISION_LABELS` keys English, values pt-BR (`Política`/`POP`/`Protocolo`/`Regimento`/`Aprovado`/`Rejeitado`) |
| PO adds — new-version wizard, `description` field | ✅ | `description` column present + returned by `list_commission_documents`; Descrição step in wizard |
| pt-BR labels render (not English keys) | ✅ | label maps hold pt-BR values; tester asserts *Protocolo*/*Aprovado* badges |

---

## Code quality — PASS

- **Client/server boundary**: no client component imports `@/lib/**` as a value (grep found only
  `import type`); actions bound via server-page props (WizardRunner pattern). Server Components default.
- **TS strict / `any`**: no `any` in the changed `src/lib/documents/**`, `src/components/documents/**`,
  or new `src/components/ui/**` composites. (One `as never` cast on the jsonb approvers param — a
  supabase-js typing workaround, not `any`; see INFO-3.)
- **Error handling**: chained actions validate submit-only inputs *up front* (no orphan draft on trivial
  invalidity); after the point-of-no-return every failure returns `documentId` + a mapped pt-BR banner
  (`MESSAGES.draftSavedUploadLater`/`draftSavedSubmitLater`) and never swallows — matches ADR 0081 B3.
  `mapDocumentError` used for the supersede RPC error; no raw Postgres text reaches the UI.
- **a11y**: `Stepper` renders `<ol aria-label>` + `<button aria-current="step">`; `CompareModal` uses the
  Radix `Dialog` (focus-trap/restore/Escape/scrim for free); labelled controls throughout.

---

## INFO (for the record — no action required)

- **INFO-1** — `list_commission_documents` denies by returning an empty set rather than raising. Correct
  and consistent for a list read (a raise would leak existence); noted so the pattern is on record.
- **INFO-2** — `remind_document_approver` and `publish_document` gate on `is_staff_admin_of OR
  is_commission_admin_of` — a deliberate superset of ADR 0081's "staff_admin-gated" wording
  (`is_commission_admin_of` = org/hospital admins who manage the commission). This matches the authority
  used across all other document RPCs; not a weakening.
- **INFO-3** — `parsedApprovers.payload as never` in `actions.ts` is a supabase-js jsonb-param typing
  workaround. Benign; a typed RPC-args helper could remove it in a future cleanup.
- **INFO-4** — The 8 pre-existing pgTAP reds in `250`/`251`/`252` are base-branch (per the lead's
  verification) and explicitly out of this phase's attribution; the `document_approvals` keystone red
  reads a hardcoded id seeded nowhere on `main` and is filed for separate triage.

---

## Gate context relied upon (not re-run)
tsc 0 / lint 0 / Vitest 369/369; tester 25/25 chromium on fresh resets, 0 app bugs; full `e2e:prod`
green declaration running separately (lead). This review adds the independent security/requirements/
code-quality audit on top of those.
