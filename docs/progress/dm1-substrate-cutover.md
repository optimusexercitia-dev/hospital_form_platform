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
| T2 | M2 `securable_resources` + pins + backfill + triggers | ✅ 2026-08-12 | §Turn-2 record below; ADR 0116 §2–4 |
| T2b | M3 core tables + guards + K3/K7 keystones + guard twins | ✅ 2026-08-12 | 328 = 43/43 planned/ran on BOTH stacks; 3 twins proven |
| T3 | M4 kernel + RLS · M5 buckets · M6 audit/flags · `gen:types` | ⬜ | |
| T4 | 328 K4/K5/K6/K9/K10 + remaining mutation-twin runlog | ⬜ | |
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

## Turn-2 record (M2 + M3, 2026-08-12)

- **Backfill proven on the POPULATED stack** (lead watch-item 1): M2 applied via
  `supabase migration up` against the seeded DB (8 cases / 3 meetings /
  1 interview / 1 action_item present BEFORE the migration) — registry counts
  after: case 8 · meeting 3 · interview 1 · action_item 1; anti-join **0**;
  reverse orphans **0**. The fresh reset exercises only the TRIGGER path (the
  backfill is a no-op on an empty DB forever); 328 K3 asserts both directions
  on both paths.
- **RESTRICT fail-safe witnessed now, not in DM2** (lead watch-item 2):
  keystone K3g hand-plants a document on a fresh case → `DELETE` the case →
  **23503** (AFTER DELETE trigger → `documents.home_resource_id` RESTRICT);
  K3h/K3i: remove the document → delete proceeds → registry row swept. The
  K3g/K3h pair is differential (same statement, one variable), self-proving.
- **328 = 43/43, planned 43 / ran 43, zero aborts**, on the populated post-M3
  stack AND on the fresh post-reset stack (run-shape checked on both).
- **Guard mutation twins (each in a rolled-back txn, rollback verified):**
  TWIN1 drop `trg_ensure_securable_resource` → case insert fails **23503**
  (the composite pin fails closed without the mint trigger — the two halves
  hold each other) · TWIN2 drop `guard_file_object_transition` → a born-clean
  insert **succeeds** (K7c would red — the guard is load-bearing) · TWIN3 drop
  `guard_document_version_immutable` → a version UPDATE **succeeds** (K7g1
  would red). K7h1–h3 (hold blocks) are differential by construction
  (hold present → HC0D3; released → proceeds).
- Guard SQLSTATEs minted: HC0D1/HC0D2/HC0D3/HC0D4 (ADR 0116 §5).

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
