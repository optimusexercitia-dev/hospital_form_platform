# F-cleanup — residual DB-hardening plan (D3, D8, D10, D11)

> **Status:** PLAN ONLY — awaiting lead plan-approval. No SQL/app code written yet.
> **Branch:** `f-cleanup`. **Posture:** reset-OK / pre-launch (memory `prelaunch-db-reset-ok`) —
> design the correct shape, no back-compat migration gymnastics.
> **Migrations:** forward-only, additive; new files start at `20260719000000…`
> (high-water = `20260718000200_flexible_forms_operators.sql`).
> **Source specs:** `pre-pilot-foundations-program.md` §F-cleanup; `pre-pilot-db-hardening-program.md`
> WS-3 D3 (L100) + WS-8 D8/D10/D11 (L149-152).

## Implementation status — SHIPPED (local; 2026-07-12)

D3-mid + D10 + D8 (pgTAP-lock) **and D11 (all 12 status enums)** built and applied
**locally** — D11 detail → [f-cleanup-d11.md](./f-cleanup-d11.md). QA APPROVED
(0B/0M/2m/3i); Minor-1 closed — the dropped `*_allowed_shape` invariant (a non-emitting
phase carries no allowed results) is **re-enforced** in `add_/update_template_phase` +
`create_case_from_template` (errcode **HC067**). ADRs
[0068](../decisions/0068-result-engine-fk-junctions.md) (D3) ·
[0069](../decisions/0069-status-key-anglicization.md) (D11). Remote deploy **deferred**
(folds into the pilot reset). Full local gate green:

| Gate | Result |
|---|---|
| pgTAP (full ordered, fresh reset) | **2100 PASS** / 86 files / 0 fail (D3 keystone `210` incl. HC067; D8/D10 `211`; D11 locks `212`–`222`) |
| Full standalone-prod E2E | **all 51 specs green** (gate caught 3 stale test assertions — fixed; 0 app/schema regressions) |
| typecheck / lint / vitest / `next build` | clean / 0 warnings / **356/356** / success |
| Frontend-component ripple | **ZERO** (domain shapes preserved; all query-layer changes are backend-owned) |

**Backend-surface delta** (for `docs/backend-state.md` at the lead's Record step):
- **Migrations:** `20260719000000_phase_result_junctions.sql` (D3, atomic), `20260719000200_updated_at_touch_triggers.sql` (D10).
- **New tables (3, RLS from creation, FK CASCADE to `phase_results` + parent, `GRANT … authenticated/service_role`):** `process_template_phase_allowed_results` (template allowed subset, `position`-ordered), `process_template_phase_offered_results` (template FK-integrity shadow = allowed ∪ ruleset ∪ default), `case_phase_allowed_results` (case allowed subset, snapshot).
- **New helpers:** `app.commission_of_template_phase(uuid)`, `app.case_of_case_phase(uuid)` (RLS resolvers, SECURITY DEFINER), `app.recompute_template_phase_offered_results(uuid)` (SECURITY DEFINER; single source of the offered-shadow union), `app.touch_updated_at()` (D10 generic touch).
- **Rewritten functions (7; signatures UNCHANGED, now junction-backed):** `add_template_phase`, `update_template_phase`, `create_case_from_template`, `set_case_phase_result_override`, `app.validate_template_phase_result`, `app.validate_template_recommend_when`. `compute_case_phase_result` **UNCHANGED** (reads `case_phases.result_ruleset` + `case_phase_offered_results` — Rule 3 held).
- **Dropped:** `process_template_phases.allowed_result_ids`, `case_phases.allowed_result_ids` (+ their `*_allowed_shape` CHECKs); the two `*_result_emits` CHECKs rewritten to `emits_result OR (result_ruleset IS NULL)` (the "non-emitting ⇒ no allowed" arm moved to the RPCs).
- **D10:** `updated_at timestamptz NOT NULL DEFAULT now()` on `cases` / `commissions` / `forms` + `touch_{cases,commissions,forms}_updated_at` BEFORE UPDATE triggers. Metadata — not in any audit allow-list.
- **D8:** no schema change; regression pgTAP (`211`) locks the two Phase-15 indicator FKs + asserts `capa_plan.source_audit_finding_id` stays intentionally FK-less (add FK at Phase 18).
- **No new SQLSTATEs** (reused HC016/HC058/HC059/HC062/HC063/HC064).
- **TS (backend-owned):** `src/lib/queries/process-templates.ts` (`TEMPLATE_SELECT` embeds the allowed junction; `mapPhase` re-aggregates to `allowedResultIds: string[] | null`), `src/lib/queries/cases.ts` (`allowedFromJunction` helper + `CasePhaseModeRow`/`PhaseFillRow` + 2 selects + 2 consumers repointed), `src/lib/types/database.ts` (regen). No `actions.ts` change (RPC signatures preserved). **No `src/app` / `src/components` edits.**

**Two extra consumers found during implementation (both backend-owned, handled — not
frontend ripple):** `validate_template_recommend_when` + `validate_template_phase_result`
(read the source phase's allowed set at publish/validate) and `cases.ts` (reads
`case_phases.allowed_result_ids` for the manual-result picker). All re-pointed to the
junction with the domain shapes preserved.

---

## TL;DR — per-item verdict

| Item | What | Verdict | Flag | Recommended migration(s) |
|---|---|---|---|---|
| **D3** | Move `phase_results.id` refs out of jsonb/arrays into FK-backed junctions (case-phase result engine) | Real (preventive) work. Case side is **already** FK-covered by `case_phase_offered_results`; the genuine hole is **template-side only**. Evaluator must stay byte-for-byte. | 🔴 | `20260719000000_phase_result_junctions.sql` (atomic) |
| **D8** | Guard/exclude forward-compat UUID-no-FK columns | **Near no-op.** `responses.supersedes_id` **does not exist** (doc-note only). The one actionable hook (indicators) was already FK'd in Phase 15. Residue is legitimately pending / intentionally FK-less. | 🟢 | none needed (optional 1-line COMMENT migration) |
| **D10** | Uniform `updated_at` touch trigger on `cases`/`commissions`/`forms` | Straightforward. All three confirmed to **lack** the column. Reuse the existing trivial touch pattern. | 🟢 | `20260719000200_updated_at_touch_triggers.sql` |
| **D11** | Harmonize Portuguese status-enum internal keys → English | **12 enums, hundreds of sites across SQL + hand-written TS unions + components + e2e.** A cross-team refactor, **not** an opportunistic backend cleanup. | 🔴 (scope decision) | its own staged effort — **do NOT bundle** |

---

## D3 — jsonb/array → junction (case-phase result engine)  🔴

### Current state

`phase_results(id, commission_id, label, color_token, is_adverse, archived, position, …)` is the
per-commission result vocabulary (`baseline` L7239). It is **soft-deleted only** —
`archive_phase_result` sets `archived = true` (L7257); there is **no hard-delete RPC**. The only
hard-delete path is `phase_results.commission_id → commissions ON DELETE CASCADE` (L20974). So a
dangling reference can arise only on a commission delete (which cascades everything) or a *future*
hard-delete path — this is why the audit calls D3 **preventive** ("no reachable defect; prevents
future dangling UUIDs"), and why the shipped `reorder_template_phase` is **not** a bug to fix.

The `phase_results.id` UUIDs live in these columns with **no FK backing**:

| Column | Shape | File:line | FK today? | Consumers |
|---|---|---|---|---|
| `process_template_phases.allowed_result_ids` | jsonb array of uuid | `baseline` L6880 | ❌ none | read: `process-templates.ts` `TEMPLATE_SELECT` L200 → `allowedResultIds: string[]`; write: `add_template_phase` L6904 / `update_template_phase` L17462; validated by `app.validate_template_allowed_results` L5053 |
| `process_template_phases.result_ruleset` (`rules[].result_id`, `default_result_id`) | jsonb object | `baseline` L6878 | ❌ none | read: `TEMPLATE_SELECT` → `resultRuleset`; write: same 2 RPCs; validated by `app.validate_template_result_ruleset` (**live def in `20260713001000` L25**, not baseline) |
| `case_phases.allowed_result_ids` | jsonb array of uuid | `baseline` L5589 | ⚠ transitively (see below) | read/validate: `set_case_phase_result_override` L15029/L15071 (manual-pick gate) |
| `case_phases.result_ruleset` (`rules[].result_id`, `default_result_id`) | jsonb object (**SNAPSHOT**) | `baseline` L5580 | ⚠ transitively | read by the **evaluator** `app.compute_case_phase_result` L1728 (Rule 3 — must not change) |
| `process_template_phases.blocks` / `case_phases.blocks` | `integer[]` (phase **positions**) | `baseline` L6876 / L5578 | n/a (not UUIDs) | `guard_phase_blocks_shape` trigger L2784; `validate_template_phase_blocks` L5097; `reorder_template_phase` L14212 (atomic remap); `set_template_phase_blocks` |

**Key finding — the case side is already FK-covered.** The existing junction
`case_phase_offered_results(case_id, result_id)` (`baseline` L18083; **PK `(case_id, result_id)`**;
`result_id → phase_results ON DELETE CASCADE` L20559; RLS L21526/L21530 scoped via
`can_read_case(case_id)` / `is_staff_admin_of(commission_of_case(case_id))`) is populated at case
creation from **allowed ∪ ruleset rules ∪ default** (`create_case_from_template` L9121-9135) and is
the authority the evaluator gates on (`compute_case_phase_result` L1786: a computed result not in
the offered set is nulled). So on the case side, deleting a `phase_results` row **cascades** the
offered row and the evaluator correctly yields no result — **no dangling UUID reaches behavior**.
The `case_phases` jsonb copies stay stale-but-harmless (the offered junction is the gate) — this is
the *existing, blessed* pattern the task says to follow.

**Key finding — the ruleset validator does NOT enforce `ruleset ⊆ allowed`.**
`validate_template_result_ruleset` checks each `rule.result_id` / `default_result_id` against
`phase_results` independently (`20260713001000` L64-127). So a ruleset result-id need not be in the
allowed set — meaning the allowed junction alone would **not** FK-cover every ruleset result-id
unless we add that invariant (see decision D3-Q1).

**Latest definitions D3 must `CREATE OR REPLACE` from (not the baseline copy):**
`create_case_from_template` → `20260714000200`; `compute_case_phase_result` → `20260713000700`;
`validate_template_result_ruleset` → `20260713001000`. All other touched functions
(`add_template_phase`, `update_template_phase`, `set_case_phase_result_override`,
`validate_template_allowed_results`, `set_template_phase_blocks`, `reorder_template_phase`) are
latest in `baseline`.

### Proposed change — three tiers (lead picks; **middle recommended**)

Because the keystone is defined *the way the existing case side already behaves* (delete a result →
the **FK'd junction** row cascades → the compute/read path yields no dangling result; the jsonb
denorm cache is allowed to stay stale), there is a genuine spectrum:

| Tier | New tables | jsonb dropped | Contract change | Closes keystone? | Notes |
|---|---|---|---|---|---|
| **D3-min** (additive shadow) | `process_template_phase_offered_results` (1) | none | **zero** (frontend/queries/actions all untouched) | yes | template-grain twin of `case_phase_offered_results`; recompute on template writes. Leaves the arrays un-normalized (doesn't literally "move arrays to junctions"). |
| **D3-mid** ⭐ **recommended** | + normalize allowed arrays: `process_template_phase_allowed_results`, `case_phase_allowed_results` (total 3) | `*.allowed_result_ids` ×2 | backend-only (read shape reconstructed by aggregation; RPC signatures unchanged) | yes | ruleset stays jsonb (structure + evaluator input); its refs FK-covered by the offered shadow (template) + existing `case_phase_offered_results` (case). Fully "moves arrays → junctions"; evaluator byte-for-byte. |
| **D3-max** (full ruleset normalization) | + `process_template_phase_result_rules` + `default_result_id` FK col (×2 tables) | ruleset jsonb too | recompose ruleset on read + decompose on write | yes | removes *all* result-ids from jsonb. Heaviest; touches the snapshot the evaluator reads → Rule-3-adjacent risk. Not recommended pre-pilot. |

**Recommended = D3-mid.** New objects (all with **RLS from creation**, mirroring
`case_phase_offered_results` scoping; writes stay via the existing INVOKER RPCs so the junctions
need the *same* member/staff_admin policies the parent phase tables carry):

```
-- 1. Authored allowed subset, template grain (replaces process_template_phases.allowed_result_ids)
CREATE TABLE process_template_phase_allowed_results (
  template_phase_id uuid NOT NULL REFERENCES process_template_phases(id) ON DELETE CASCADE,
  result_id         uuid NOT NULL REFERENCES phase_results(id)          ON DELETE CASCADE,
  position          integer NOT NULL,
  PRIMARY KEY (template_phase_id, result_id));
-- + index on (result_id); RLS SELECT = member-of(commission_of_template); write = staff_admin/org_admin.

-- 2. FK-integrity shadow = allowed ∪ ruleset rules ∪ default  (template twin of case_phase_offered_results)
CREATE TABLE process_template_phase_offered_results (
  template_phase_id uuid NOT NULL REFERENCES process_template_phases(id) ON DELETE CASCADE,
  result_id         uuid NOT NULL REFERENCES phase_results(id)          ON DELETE CASCADE,
  PRIMARY KEY (template_phase_id, result_id));   -- recomputed by add/update_template_phase

-- 3. Authored allowed subset, case grain (replaces case_phases.allowed_result_ids)
CREATE TABLE case_phase_allowed_results (
  case_phase_id uuid NOT NULL REFERENCES case_phases(id)  ON DELETE CASCADE,
  result_id     uuid NOT NULL REFERENCES phase_results(id) ON DELETE CASCADE,
  position      integer NOT NULL,
  PRIMARY KEY (case_phase_id, result_id));       -- snapshotted from table (1) at case creation
-- RLS SELECT = can_read_case(case_of_phase); write = staff_admin(commission_of_case).
```

- **`result_ruleset` (both tables): KEEP jsonb.** Structure (the `when` conditions) is not
  FK-bearing; the evaluator reads `case_phases.result_ruleset` verbatim (Rule 3). Result-ids get FK
  visibility via table (2) on the template and the existing `case_phase_offered_results` on the case.
- **`blocks` (both tables): KEEP `integer[]`, no junction.** Positions carry **no** dangling-UUID
  risk; normalizing to phase-id FKs would require rewriting the atomic reorder the audit says not to
  touch. (Optional stretch — a `*_phase_blocks(phase_id, blocked_phase_id)` FK junction that
  *removes* the reorder remap — is out of scope for F-cleanup unless the lead wants it; see D3-Q2.)

**Function changes (all backend-owned):**

| Function | Change |
|---|---|
| `add_template_phase` | signature **unchanged** (still `p_allowed_result_ids jsonb`, `p_result_ruleset jsonb`). Internally: validate the incoming jsonb (existing validators), then write table (1) rows + recompute table (2) = allowed ∪ ruleset refs. Drop the jsonb column from the INSERT. |
| `update_template_phase` | signature **unchanged**. Clear/replace/keep semantics now applied to table (1) rows; recompute table (2). ruleset jsonb path unchanged. |
| `validate_template_allowed_results` / `_result_ruleset` | keep validating the **incoming jsonb** before persist (least churn); no read-from-junction needed. `validate_template_allowed_results` may become a thin check the RPC calls pre-write. |
| `create_case_from_template` (latest `20260714000200`) | snapshot table (1) → table (3); ruleset jsonb copied as today; `case_phase_offered_results` populated **from table (3) ∪ ruleset refs** (same union as today, just sourced from the junction). |
| `set_case_phase_result_override` | manual-pick "is it allowed?" gate reads **table (3)** instead of `case_phases.allowed_result_ids` jsonb (L15071). |
| `compute_case_phase_result` | **UNCHANGED** (reads `case_phases.result_ruleset` + `case_phase_offered_results`). Rule 3 preserved. |
| `reorder_template_phase`, `set_template_phase_blocks`, `guard_phase_blocks_shape`, `validate_template_phase_blocks` | **UNCHANGED** (blocks kept as `integer[]`). |

### Migration file

`20260719000000_phase_result_junctions.sql` — **single atomic migration** (dropping
`*.allowed_result_ids` and rewriting the RPCs that reference them must land together; a half-applied
drop breaks `add_template_phase`/`update_template_phase`/`create_case_from_template`/
`set_case_phase_result_override`). Contains: 3 `CREATE TABLE` + RLS enable + 6 policies + FKs +
`(result_id)` indexes; `CREATE OR REPLACE` of the 5 functions above (from their **latest** defs);
`ALTER TABLE … DROP COLUMN allowed_result_ids` ×2 + their `*_allowed_shape` CHECKs; t19 grant
hygiene on every recreated function. No data backfill (reset-OK). Then regen types (Rule 8).

### pgTAP tests (`supabase/tests/…_phase_result_junctions.sql`)

- **NEG / keystone:** author a template phase offering result R (in allowed + offered) → **DELETE the
  `phase_results` row R directly** (simulating commission-cascade / a future hard-delete) → assert
  the `process_template_phase_allowed_results` **and** `process_template_phase_offered_results` rows
  for R are gone (FK CASCADE) → **no dangling reference the DB is unaware of**. Repeat on the case
  side (`case_phase_allowed_results` + `case_phase_offered_results` cascade; `compute_case_phase_result`
  yields no result).
- **NEG:** via `add_template_phase`/`update_template_phase`, add an allowed result from a **different
  commission** → `HC059` (validator still fires).
- **POS:** `reorder_template_phase` up/down still validates and blocks-remap holds (blocks untouched).
- **POS:** `create_case_from_template` snapshots allowed (1)→(3) and populates
  `case_phase_offered_results` identically; a case's manual/automatic result resolves as before.
- **POS / read-back:** aggregated `allowedResultIds` equals the authored set **and order**.
- **GOLDEN (Rule 3):** reuse the existing phase-result compute vectors — `compute_case_phase_result`
  output unchanged.

### App-layer ripple

- **Backend-owned (I edit):** `src/lib/queries/process-templates.ts` (`TEMPLATE_SELECT` L200 → embed
  `process_template_phase_allowed_results(result_id …)` ordered by `position`; mapper L221-225
  re-aggregates to `allowedResultIds: string[]` — **domain type unchanged**); `src/lib/types/database.ts`
  (regen). `src/lib/queries/phase-results.ts` — **no change expected** (it references
  allowed/ruleset only in comments; consumed via RPC). `src/lib/process-templates/actions.ts` —
  **no change** (RPC signatures preserved; still posts `p_allowed_result_ids`/`p_result_ruleset` jsonb).
- **Frontend-owned (flag for lead — expected ZERO change if the domain type is preserved):**
  `result-ruleset-editor.tsx` (incl. `AllowedResultsPicker` L529), `recommend-when-editor.tsx`,
  `phase-slot-dialog.tsx`, `phase-slot-card.tsx`. They consume `ProcessTemplatePhase.allowedResultIds`
  / `.resultRuleset` — both shapes preserved, so no edit is anticipated. **Verify** during
  implementation; if PostgREST embed forces a mapper-visible shape change, escalate to the lead.

### Review flag: 🔴 (new tables + RLS + touches the result engine). **Open decisions → D3-Q1, D3-Q2.**

---

## D8 — forward-compat UUID-no-FK columns  🟢

### Current state (full sweep)

| Column | File:line | Has FK? | Written? | Classification | Recommendation |
|---|---|---|---|---|---|
| `responses.supersedes_id` | **does not exist** — forward NOTE only (ARCHITECTURE Rule 2 §"Supersession correction"; ADR 0065 §8 / 0060 Gap 38) | n/a | no | documented *future* column, deliberately not pre-added (freeze principle) | **nothing to do** — the task's premise is stale |
| `attachments.supersedes_id` | `20260717000000` L70 | ✅ self-FK `→ attachments(id) ON DELETE SET NULL` | RPC | already correct | none |
| `capa_plan.source_indicator_id` | FK added `20260712000300` L24-26 (`ON DELETE SET NULL`) | ✅ `→ indicators(id)` | `open_capa_plan` | resolved in Phase 15 | none |
| `capa_measure.indicator_id` | FK added `20260712000300` L28-30 | ✅ `→ indicators(id)` | RPC | resolved in Phase 15 | none |
| `capa_plan.source_audit_finding_id` | `baseline` L7519 (COMMENT: "FK-LESS forward hook (Phase 18 — public.audit_findings)") | ❌ | not yet | **legitimately pending** — `audit_findings` table not built (Phase 18) | leave FK-less; add FK when Phase 18 lands (exactly as Phase 15 did). Cannot FK to a non-existent table. |
| `audit_log.organization_id` | `20260709000300` L28 (COMMENT: "carries NO FK — consistency call, flagged") | ❌ intentional | trigger | **intentional** — audit_log is append-only/hash-chained; a cascade would violate immutability (Rule 11) | keep FK-less; already documented |
| `attachments.owner_id` | `20260717000000` (dialect-2 owner-dispatch) | ❌ intentional | RPC | **sanctioned polymorphism** (Appendix A dialect 2) | exclude by design |
| `form_items.parent_item_id` / `answers.group_instance_id` | baseline | ✅ self-FK / `→ response_group_instances` | inert | reserved but FK'd | none |

### Proposed change

**No structural change required.** Every forward-compat UUID column is already one of: FK'd,
intentionally polymorphic (dialect 2), or legitimately pending its future phase. The one item the
task flagged (`responses.supersedes_id`) is not a column. The one class that was ever actionable
(indicator hooks) was FK'd in Phase 15.

Optional, if the lead wants a paper-trail: a tiny `20260719000100_forward_column_notes.sql` that
re-affirms the two deliberate FK-less columns via `COMMENT` (they already have comments) and/or an
ADR line "audit_log.organization_id and capa_plan.source_audit_finding_id are excluded from FK
guards by design; add the audit_finding FK at Phase 18." **Recommendation: skip the migration**,
record the rationale in this plan + `docs/backend-state.md`.

### pgTAP tests
Regression lock only: assert the two Phase-15 FKs still exist
(`capa_plan_source_indicator_id_fkey`, `capa_measure_indicator_id_fkey`) so a future refactor can't
silently drop them. (Optional) assert `capa_plan.source_audit_finding_id` has no FK yet + a
"remember at Phase 18" note.

### App-layer ripple: **none.**  ### Review flag: 🟢. **Open decision → D8-Q1 (skip vs COMMENT migration).**

---

## D10 — uniform `updated_at` touch trigger (`cases` / `commissions` / `forms`)  🟢

### Current state
All three tables have `created_at` but **no `updated_at`** (confirmed: `cases` `baseline` L7560-7578;
`commissions`; `forms`). The baseline touch pattern is a trivial `BEFORE UPDATE` trigger calling a
per-domain function whose body is byte-identical everywhere:

```
app.touch_case_narrative_updated_at() / app.touch_interview_updated_at() /
app.touch_hospital_department_updated_at()   -- all: begin new.updated_at := now(); return new; end;
```
(e.g. `baseline` L4144-4166; triggers wired `CREATE TRIGGER … BEFORE UPDATE … EXECUTE FUNCTION`
L20167-20183). There is **no single generic** `app.touch_updated_at()`.

### Proposed change
1. `ALTER TABLE {cases,commissions,forms} ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();`
2. Add **one** generic `app.touch_updated_at()` (same trivial body, `search_path`-pinned,
   `OWNER TO postgres`) and wire a `BEFORE UPDATE … FOR EACH ROW` trigger on each of the three tables.
   The three existing per-domain copies are left as-is (repointing them is out of scope). See D10-Q1
   for "generic vs reuse an existing name."

Safe by construction: additive column (DEFAULT backfills; reset-OK anyway); `BEFORE UPDATE` touch is
independent of the `cases` auto-status recompute + terminal-state guards (it just stamps the same
UPDATE). `updated_at` is metadata → **not** added to any audit allow-list (stays out of the log,
Rule 11). No RLS impact.

### Migration file
`20260719000200_updated_at_touch_triggers.sql` (standalone, independent of D3). Regen types after.

### pgTAP tests
- **POS:** after `INSERT`, `updated_at = created_at` (both `now()`).
- **POS:** after `UPDATE`, `updated_at > pre-update updated_at` on each of `cases`/`commissions`/`forms`.
- **POS:** the trigger exists on all three tables (catalog assertion).

### App-layer ripple
Regen `database.ts` adds `updated_at` to the three Row types (additive, backward-compatible). No
query/action edits required; optionally surface it later. **No frontend change.**

### Review flag: 🟢. **Open decision → D10-Q1.**

---

## D11 — harmonize Portuguese status-enum keys → English  🔴 (scope decision)

### Current state — structural findings
- **No Postgres `ENUM` types exist.** Every status enum is a `text` column + `CHECK (status = ANY(ARRAY[…]))`.
  Consequence: generated `src/lib/types/database.ts` types these as **plain `string`, not unions** —
  anglicizing keys does **not** regenerate any column union (the **only** Portuguese status literals
  in `database.ts` are the indicator-dashboard RPC *return field names* `na_meta`/`fora_da_meta`/
  `sem_dados`, L8675-8686). The authoritative TS types are **hand-written unions in `src/lib`**.
- The stored key is often **also a map key** in label/visual dictionaries (`interview-labels.ts`,
  `capa-types.ts`, `capa-visuals.ts`, …) → those **keys** must change; the pt-BR string *values* stay
  (Rule 10 untouched).

### The 12 Portuguese-keyed status enums (blast radius, cheapest → most expensive)

| # | Enum (table.column) | Portuguese keys | Definition | Coupling / risk |
|---|---|---|---|---|
| 1 | `indicators.status` | ativo/arquivado | `20260712000000` L47 | trivial (~4 SQL, 1 union, 0 seed) |
| 2 | `meeting_attendees.attendance` | convocado/presente/ausente/justificado | `baseline` L6226 | small |
| 3 | `case_narratives.status` | aberta/concluida | `baseline` L16561 | small-med (timeline/derive + 4 components) |
| 4 | `indicator_measurements.status` | na_meta/fora_da_meta/sem_dados | `20260712000000` L98 | **keys double as RPC output column names** → perturbs generated `database.ts` + `queries/indicators.ts` mapping |
| 5 | `capa_action.status` | pendente/em_andamento/concluida/cancelada | `baseline` L182 | med |
| 6 | `case_interviews.status` | rascunho/agendada/em_andamento/concluida/cancelada | `baseline` L7704 | med |
| 7 | `capa_plan.status` | aberto/em_execucao/em_verificacao/concluido/cancelado | `baseline` L7500 | med (nsp rollup counts) |
| 8 | `controlled_documents(+_versions).status` | rascunho/em_aprovacao/vigente/obsoleto | `20260713000000` L36/L73 | med-high (**2 columns**, ~15 RPC sites, phase17 ~51 e2e) |
| 9 | `case_referral.status` | rascunho/enviada/recebida/aceita/recusada/em_analise/concluida/retirada | `baseline` L883 | high (8-state chain, resolved/in-flight Sets) |
| 10 | `meetings.status` | agendada/realizada/em_assinatura/assinada/distribuida/cancelada | `baseline` L7774 | high (3 dashboard views + conclude flow; phase10 ~60 e2e) |
| 11 | `cases.status` | nao_iniciado/pendente/em_revisao/concluido/cancelado | `baseline` L7573 | **very high** — auto-computed; terminal gate `('concluido','cancelado')` in ~15 RPCs / 6+ migrations |
| 12 | `case_phases.status` | pendente/ativa/concluida/nao_necessaria | `baseline` L5595 | **most expensive** — drives the `cases.status` recompute (`baseline` L3879 `bool_or(status='ativa'/'concluida')`), transition guards, activate/skip/close, timeline, ~8 components |

**Hard coupling:** #11 `cases.status` and #12 `case_phases.status` are joined at `baseline` L3879
(case status is recomputed from phase statuses) → they **must be anglicized in one migration** or the
recompute breaks. The literal `concluida` (feminine) is shared by enums #3/#5/#6/#12/#9 and
`concluido` (masculine) by #7/#11 → a blind find-replace is unsafe; each enum's sites must move as a
unit and disambiguate feminine/masculine → the same English key (`completed`/`concluded`).

**Rough magnitude:** the heaviest keys alone — `concluida` ≈ 41 SQL + 36 src + 11 e2e; `concluido`
≈ 51 SQL + 13 src + 15 e2e (some counts include substring false positives like `narrativa`). Total
across the 12 enums: **hundreds of edit sites**, a large fraction in **frontend-owned components**
and **tester-owned e2e specs**.

### Proposed change & recommendation
D11's only benefit is convention (Rule 10 "internal keys in English"); its risk is a subtle
state-machine break from a missed literal, and it is **inherently cross-team** (backend SQL +
frontend components + tester e2e). It is therefore **not** an "opportunistic while a migration is
open" item.

**Recommendation:** treat D11 as its **own staged mini-track**, decided by the lead/PO on cost/benefit
(see D11-Q1), and if approved:
1. Do it **cheapest-first**, **one coupled-group per migration** (start with #1 `indicators.status`,
   #2 attendance, #3 narratives as low-risk pilots; end with the #11+#12 pair as a single migration).
2. Each enum: new `CHECK` with English keys; rewrite **every** SQL write/compare literal (grep the
   exact key across all migrations — a missed compare site is the failure mode, memory
   `pgtap-fixture-flag-gaps`); update the hand-written TS union + map keys; update `seed.sql`; the
   **lead assigns** the component edits to `frontend` and the spec edits to `tester` (file-ownership).
3. Full pgTAP per enum (NEG old key rejected / POS new key accepted / POS every transition RPC still
   moves) **plus** the full E2E status-flow suite — this is what makes it expensive.

**Do NOT bundle D11 into `20260719000000` (D3) or `20260719000200` (D10).**

### Migration file(s) (only if approved)
`20260719000300_status_keys_english_<group>.sql`, one per coupled group. Regen types after each
(mostly to refresh Row `string` typing + the indicator RPC field-name change in #4).

### App-layer ripple
Extensive and **cross-team** — hand-written unions + label/visual **map keys** in `src/lib/{queries,
cases,safety,referrals,indicators,documents,interviews,meetings}` and their components; `seed.sql`;
the per-feature e2e specs (`phase10`/`phase11`/`phase14d`/`phase17`/`phase22`/`cases-*`/`case-*`).
The D11 investigation produced a per-enum file:line map (available on request) for whoever implements.

### Review flag: 🔴 scope. **Open decisions → D11-Q1, D11-Q2.**

---

## Open questions for the lead

- **D3-Q1 (shape).** Pick a tier: **D3-min** (1 additive shadow, zero contract change) /
  **D3-mid** ⭐ (3 tables, normalize allowed arrays, ruleset stays jsonb) / **D3-max** (also
  normalize the ruleset). Recommend **D3-mid**. Sub-question: adopt the invariant
  **`ruleset result-ids ⊆ allowed`**? If **yes**, D3-mid needs no template offered-shadow (the allowed
  junction FK-covers everything) → 2 tables, but it's a *new validation rule* that could reject
  templates the current model permits (create_case unions allowed ∪ ruleset today). If **no** (keep
  current union semantics), keep the offered-shadow → 3 tables. Recommend **no** (lower behavior-change
  risk, faithful to the existing pattern).
- **D3-Q2 (blocks).** Confirm we **leave `blocks integer[]` as-is** (recommended — no dangling-UUID
  risk, don't touch the atomic reorder). Or approve the optional stretch: a `*_phase_blocks(phase_id,
  blocked_phase_id)` FK junction that *removes* the reorder remap (bigger, touches the tested reorder).
- **D8-Q1.** Accept "no structural change" (record rationale here + backend-state), or want the
  optional `20260719000100` COMMENT-only migration? Also: log a reminder to add the
  `capa_plan.source_audit_finding_id` FK when Phase 18 lands.
- **D10-Q1.** OK to add a single generic `app.touch_updated_at()` for the three triggers (recommended),
  vs reuse an existing per-domain function name on unrelated tables (odd naming), vs also repoint the
  three existing copies to the generic (extra churn, not needed)?
- **D11-Q1 (go/no-go + scope).** Is anglicizing internal status keys worth a cross-team, hundreds-of-site
  refactor pre-pilot for a convention-only benefit? Options: **(a) defer past pilot**, record the
  convention exception now; **(b) do a low-risk subset** (#1-#4) only; **(c) full 12-enum staged track**.
  My recommendation: **(a) or (b)** — the #10/#11/#12 group is high-regression-risk for no functional gain.
- **D11-Q2 (secondary enums).** Does D11 also cover the ~13 **non-status** Portuguese enum columns
  (`classification`, `modality`, member/interviewer `role`, attachment `kind`, indicator `kind/
  direction/frequency/data_source`, etc.)? Recommend **excluding** them (out of "status enum" scope).

## Effort estimate (backend days; excludes the cross-team D11 component/e2e work)

| Item | Estimate | Notes |
|---|---|---|
| **D3-mid** | ~1.5–2.5 d | 3 tables + RLS + FKs; recompute logic in 3 RPCs + `set_case_phase_result_override`; query re-aggregation; pgTAP incl. golden parity. (D3-min ≈ 0.5–1 d; D3-max ≈ +1–2 d.) |
| **D8** | ~0.25 d | rationale + regression pgTAP (+ optional COMMENT migration). |
| **D10** | ~0.25–0.5 d | column + generic touch fn + 3 triggers + pgTAP + types. |
| **D11** | **not estimated as backend-only** | cross-team; if approved, ~0.5 d backend **per coupled group** + frontend + tester per group + full E2E status-flow gate. #11/#12 pair is the tail risk. |

**Suggested batch for this F-cleanup pass:** D3-mid + D10 (+ D8 rationale). Land D3 and D10 as two
independent migrations (`20260719000000`, `20260719000200`); carry D11 as a separate lead/PO decision.
