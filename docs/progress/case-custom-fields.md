# Case Custom Fields (ADR 0083) — full task ledger

> Rotated verbatim from PROGRESS.md § Follow-ups / Deferred Items on 2026-07-28 during the
> git-vs-docs reconciliation. **COMPLETE + MERGED 2026-07-23** — flag `case_custom_fields`
> flipped **ON permanently** (`fde76d3`), branch `worktree-adr-0083-case-custom-fields` merged
> and deleted (`c857193`), migrations `20260821000000` + `20260822000000` tracked in `main`.
> Durable pointers: the PROGRESS.md phase-status row ·
> [review](../reviews/adr-0083-case-custom-fields-review.md) · ADR
> [0083](../decisions/0083-case-custom-fields.md).
>
> ⚠ **Why this file exists.** The ledger below sat under "Follow-ups / Deferred Items" headed
> "QA + human approval pending … **Not yet merged to `main`**" for five days *after* it merged.
> Three sources disagreed (this ledger, the ADR header, git); git was right. The **§6 step-5
> Record was never run** — that is the process defect, not the build. Reconciled 2026-07-28.
> One residual gap, recorded rather than papered over: the final `[ ] human approval` box was
> never ticked anywhere, so the merge is git-attested but the **approval event itself is
> unrecorded**. Treat the merge + permanent flag flip as the lead's closure signal.

---

### ✅ Case custom fields — COMPLETE + MERGED 2026-07-23 (ADR 0083)

Template-defined, non-PHI administrative descriptor fields, defined per process template and
captured in "Novo caso". Design: [ADR 0083](../decisions/0083-case-custom-fields.md).

- [x] **Backend** (`9108b02`) — `process_template_custom_fields` + `case_custom_field_values`
  (RLS mirrored from the live `case_offered_outcomes`/`process_template_outcomes` predicates,
  incl. the `is_case_excluded` arm), `create_case_from_template` extended with `p_custom_fields`
  (re-emitted from the live body), `update_case_custom_field_values` RPC (`HC068` required),
  the `case_custom_fields` flag, types, query layer, pgTAP `188` (28/28).
- [x] **Def-authoring actions** (`8e5aea3`) — create/update/delete/reorder in
  `process-templates/actions.ts`; draft-only enforced action-side (D5).
- [x] **Frontend** (`613680c`) — builder authoring card, "Novo caso" reveal + PHI warning +
  required-gating, case-detail display + edit, opt-in list column/search. Browser-verified
  end-to-end.
- [x] **E2E seed fixtures** (`2365f1f`) — published template "Descritores de Óbito", 2 defs
  (`numero_declaracao_obito` required, `turno_obito` dropdown), 1 seeded case (label "Óbito
  enfermaria leito 3"), deterministic fixed UUIDs.
- [x] lint / typecheck / vitest (369) green.
- [x] **E2E specs** (`c298215`, tester) — `e2e/case-custom-fields.spec.ts`, 8 tests covering
  AC-1..AC-7 + AC-8 best-effort. **8/8, run 3× clean** (serial, `--repeat-each=2`→16/16, default
  parallel workers). 0 app bugs. Detail → [test-run-archive.md](test-run-archive.md) (2026-07-23).
- [x] **`e2e:prod` full-suite gate** (lead, `REBUILD=1`, prod standalone, 11 batches) —
  **735 passed / 7 failed / 2 flaky**. Feature spec **8/8 green on the prod build** (batch-2).
  Triage: **1 regression (mine, fixed) + 6 pre-existing** (all in specs byte-identical to `main`,
  i.e. red on `main` too — this full gate had not been run clean since several schema/UI changes):
  - `case-access.spec.ts:483` — **my** seed inserted the CF case before the outcomes block, taking
    CCIH `case_number 2` and bumping "Óbito UTI leito 3" (2→3), breaking its "caso 0002" assert.
    **Fixed `e5d9a34`** (reorder seed blocks → leito3=2, CF case=3; others unchanged); re-verified.
  - `charters-cadence.spec.ts` — stale `action_items.case_id` (renamed → `linked_case_id`, mig
    `20260818000300`). **Fixed `a54ad23`** (tester); lead re-verified 10/10.
  - `action-items-satellites.spec.ts` — **REAL app bug BUG-AISAT-002** (not stale): the one call
    site the rename missed — `listMeetingActionItems()` (`src/lib/queries/meeting-action-items.ts`)
    selected dead `case_id` → 400 swallowed → meeting "Itens de ação" panel empty on **every**
    meeting on `main`. Filed (Bug Log, `95ae651`). **RESOLVED `a9af7a7`** (`case_id`→`linked_case_id`
    + loud error-guard); `action-items-satellites.spec.ts` 9/9 green on fresh reset.
  - `documents-changes-requested.spec.ts` + `documents-redesign.spec.ts` — `Tipo` expects
    `protocol`, gets `sop` (ADR 0082 dropdown). Task-chipped (stale-spec-or-bug, off `main`).
  - `phase22-referrals.spec.ts:428` — ENC-0001 subject not in hub. Task-chipped (off `main`).
  - `ethics-e2-procedure.spec.ts` FLOW-7 — known keyboard-vote flake (already a filed follow-up).
  Final lead verification on a fresh reset: **charters + case-access + case-custom-fields = 41/41**.
- [x] **QA review** (`qa`, 2026-07-23) — ✅ **APPROVED** (0 P0 · 0 MAJOR · 1 MINOR · 2 INFO)
  [review](../reviews/adr-0083-case-custom-fields-review.md). Direct-table write-bypass closed at the
  table (live-catalog `pg_policies` verified; pgTAP `188` re-run green 28/28); both RPCs `SECURITY DEFINER`
  + PUBLIC-revoked; `create_case_from_template` rebuilt from live def with no lost logic; edit path
  authority-gated/exclusion-aware/terminal-safe/audited (Rule 11); Rule 12 holds (non-PHI by design);
  D1–D10 all met. MINOR-1 **cleared** (`857ed38`): `HC0F1` on the edit path now surfaces the RPC's
  specific pt-BR "impedido" message (mirrors `case-recusals`). INFO: D5 draft-freeze is action-layer (matches the outcomes sibling);
  the branch migration was applied forward to the local DB to obtain live-catalog truth (was absent from
  the prior reset). ⚠ Note: local DB state changed (ADR-0083 objects now present; a `db reset` recreates them).
- [x] **merge to `main`** — `c857193` (merge) + `fde76d3` (flag ON permanently), 2026-07-23.
      Branch `worktree-adr-0083-case-custom-fields` deleted. *Git-attested; see the ⚠ note above
      on the unrecorded approval event.*
