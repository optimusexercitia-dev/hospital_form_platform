# DM1 — substrate cutover: phase record (backend task log)

> Program: Document Model Redesign (ADR 0114; plan
> [document-model-redesign.md](../plans/document-model-redesign.md); approved
> implementation plan
> [dm1-substrate-cutover-plan.md](../plans/dm1-substrate-cutover-plan.md);
> decisions ADR 0116 — pending, written at M2–M6 landing).
> Branch: `docs/dm1-plan-amendments` (PO: nothing to `main`, nothing remote).
> Backend-owned file; the lead owns the Phase Status table.

## Task log

| # | Task | Status | Evidence |
|---|------|--------|----------|
| T1a | Suite `328` K1/K2/K8 authored + observed **RED pre-M1** | ✅ 2026-08-12 | §Red-first record below |
| T1b | M1 `20260923000100_dm1_drop_attachment_substrate.sql` (6 patches + drop set) | ✅ 2026-08-12 | applied clean; 328 → 20/20 |
| T1c | `seed.sql` surgery (3 fixture inserts + `attachments` flag flip removed; frozen-snapshot fixture kept, provenance NULL) | ✅ 2026-08-12 | fresh `db reset` exit 0 |
| T1d | `208_attachments.sql` deleted (coverage → 328 now, DM2 specs later); allowlist hygiene (blind-allowlist −2 policies, neverclled −2 doors, unswept-backlog ERROR resolved-by-deletion note) | ✅ 2026-08-12 | commit message carries the justification |
| T1e | FUP-DM1-E2E + FUP-DM1-DISPOSE filed (index + body) | ✅ 2026-08-12 | PROGRESS.md + follow-ups.md |
| T2 | M2 `securable_resources` + pins + backfill + triggers | ⬜ | |
| T3 | M3 core tables + guards · M4 kernel + RLS · M5 buckets · M6 audit/flags · `gen:types` | ⬜ | |
| T4 | 328 K3–K7/K9/K10 + mutation-twin runlog | ⬜ | |
| T5 | pgTAP triage of attachment-touching suites + full `test:db` green on fresh reset | ⬜ | |
| T6 | TS stubs (`src/lib/attachments/*`, `src/lib/queries/attachments.ts`, wrapper actions, `src/lib/audit/access.ts`) + lint/typecheck/vitest | ⬜ | |
| T7 | Authz arms (census fail→verdicts→green, hat, floor, FROMFINDINGS wrapper) + diff-scoped door sweep (case count checked nonzero) | ⬜ | |

## Red-first record (lead condition 5)

Suite `328` was authored and run against the **pre-M1** catalog (2026-08-12, HEAD
`61bb0ce`, 361 migrations, fresh stack). Observed:

- **K1 — all 7 sub-assertions RED**, `have` vs `want 0`:
  K1a routines **12** (14 `%attachment%` minus the 2 allowlisted) · K1b policies
  **6** (9 minus 3) · K1c relations **3** · K1d client EXECUTE grants **12** ·
  K1e surviving bodies referencing dropped routine names **7** · K1f surviving
  bodies referencing dropped relations **8** · K1g storage policies quoting the
  `attachments`/`attachments-phi` bucket literals **3**.
- **K8 — all 3 RED with `caught: no exception`**: `add_referral_shared_item`
  (document arm), `add_rca_evidence` (document citation),
  `issue_ethics_notification` (related document) each **succeeded** pre-patch —
  the genuine the-arm-was-live red, not a wrong-arm error (§7.1 shape 1/3 avoided
  by full valid fixtures: seeded draft-referral fixture + seeded RCA
  `f3000000-…a3` + seeded ethics case `ca000000-…e1`).
- K2 (7 allowlist pins) + 3 flag preconditions green on both sides by design.
- Run shape verified: `1..20` planned, 20 ran, 0 aborts (pre-M1). ⚠ One §7.15
  instance caught in-turn: the FIRST post-reset run aborted at `test_helpers`
  (schema is minted by `00_setup.sql`, wiped by reset) and printed 17 ok with no
  `not ok` — rerun with setup applied: **20/20, abort-free**.

Post-M1: 328 = **20/20 green** (post-`migration up` AND post-fresh-reset).
Mutation twin (K1): `app.probe_attachment_stub()` created in a txn → K1a count
**1** (red); rollback → **0**. Rollback verified before trusting the harness.

## PROD-VERIFY checklist (lead condition 2 — for the later lead-authorized `db push`; NO remote action was taken this phase)

Before/with applying `20260923000100` to the remote:

1. `attachments` table has exactly the **4 dangling rows** of the 2026-08-11
   census and both `attachments`/`attachments-phi` buckets are still **empty**
   (Storage API count, not `storage.objects` guesswork).
2. `rca_evidence`: **0 rows** with `cited_document_id IS NOT NULL` — the new
   CHECK `rca_evidence_cited_document_parked` validates existing rows at ADD; a
   nonzero count aborts the push → escalate to the lead, do not NULL blindly.
3. `ethics_decision_details.decision_letter_document_id` /
   `ethics_notifications.related_document_id`: expect **0 non-null** (local: 0).
4. `referral_shared_item.source_document_id`: record the non-null count (the
   census's "1 frozen path referencing no object" is expected here; the FK drop
   tolerates it — DM4 reconciles).
5. `meeting-attachments` bucket absent in prod (expect no-op; record).
6. Post-push: re-run the K1 catalog queries against the remote (the 7 counts
   must be 0 there too) and confirm `case_documents_select_member` +
   `app.can_read_snapshot_document` survive.

## Parked seams (what DM1 deliberately left behind)

| Column | Protection after DM1 | Re-point owner |
|---|---|---|
| `referral_shared_item.source_document_id` | no authenticated write policy + `add_referral_shared_item` document arm raises `HC0DM` | DM4 |
| `rca_evidence.cited_document_id` | CHECK `rca_evidence_cited_document_parked` + writer raises `HC0DM` (table has a live authenticated FOR ALL write policy — the CHECK is load-bearing) | Wave D (DM5) |
| `ethics_decision_details.decision_letter_document_id` | SELECT-only grants; no writer exists | **OPEN — plan Q1 (PO)** |
| `ethics_notifications.related_document_id` | SELECT-only grants + `issue_ethics_notification` raises `HC0DM` | **OPEN — plan Q1 (PO)** |

`HC0DM` is the parked-seam SQLSTATE minted for this program (distinct code so the
K8 keystones cannot be satisfied by a neighboring validation error — §7.1).
