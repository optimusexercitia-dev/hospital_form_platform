# QA Review — Form data-model normalization

- **Branch:** `feat/form-model-normalization` (merge-base `c6f7d91`; original head
  `ba4c94c`; re-review head `e158e91`)
- **Reviewer:** `qa`
- **Date:** 2026-07-01 (original CHANGES REQUESTED) → 2026-07-01 (re-review APPROVED)
- **Gate context:** T-1 E2E green (evidence-based); pgTAP **1180/1180**; Vitest 170/170;
  lint 0; typecheck clean.

## Verdict: **APPROVED** (2026-07-01, re-review)

> **Re-review update (head `e158e91`):** MAJOR-1 is **fixed and verified at both
> layers** — verdict flipped from CHANGES REQUESTED to **APPROVED**. The per-row
> position loop is replaced by a single-transaction SECURITY INVOKER RPC
> `reconcile_item_options` (migration `20260630017000`). I reproduced my exact
> original repro (move an option UP into an occupied slot + rename + add) live
> through the RPC — **no unique violation**, correct final order, codes preserved.
> The RPC is confirmed `prosecdef = f` (INVOKER), and reconciling a **published**
> item's options is still blocked by `guard_published_structure` ("UPDATE on a
> published version's structure is blocked (immutable)") — verified live. Coverage
> added: pgTAP `61_option_reconcile.sql` (9 assertions incl. the exact repro, codes
> preserved, atomic add+remove+reorder, kept-row update with frozen code, HC013
> duplicate rejection) and E2E **NORM-5** (edit-dialog reorder of existing options
> into an occupied slot → persists + codes preserved + survives reload +
> condition-on-reordered-code resolves + publishes). Fix diff (`ba4c94c..e158e91`)
> is scoped to the reconcile path + RPC + tests; the evaluator and shared vectors
> remain **byte-for-byte unchanged**. See "Re-review — MAJOR-1 resolution" below.

**Original verdict (head `ba4c94c`): CHANGES REQUESTED.** One **MAJOR** functional
defect (now resolved, above): reordering the options of an **existing** choice item
(the reconcile path in `updateItem`) failed with a duplicate-key error for a common
reorder pattern, silently discarding the change, and was not covered by the E2E
suite (which only exercised reorder on the safe *add* path). Everything else — the
two new tables' RLS, the immutability guards, the evaluator-non-drift insulation,
the clone/publish/validate rewrites, the caught `case_phase_answer_map` bug, and the
full author-facing wishlist — was correctly delivered and, in most places, notably
well done.

---

## 1. Requirements audit — PASS (wishlist delivered)

Confirmed each locked decision (memory `form-model-normalization-decisions`) is honored:

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| 1 | Options = per-question, version-scoped rows, cloned + frozen | ✅ | `form_item_options` FK to `form_versions`; `guard_published_options_trg` (§2); clone copy (§below) |
| 2 | `code` auto slug+suffix, immutable, hidden, copied verbatim on clone | ✅ | `generateOptionCode` (`actions.ts:876`); `form_item_options_code_immutable_trg`; clone is a pure INSERT so the immutable trigger never fires; `reconcileOptionRows` never rewrites a kept code |
| 3 | `analytics_code` optional free-text, no vocabulary | ✅ | column + `OptionsEditor` "Código de análise" field |
| 4 | `score` single nullable numeric, stored-only | ✅ | `score numeric`; `OptionsEditor` "Pontuação" (decimal comma→dot) |
| 5 | Translations deferred — **no column**, additive later | ✅ | No translation column anywhere; `ItemOption` shape has no half-built i18n field |
| 6 | Future types: principles only, no structure | ✅ | `config` jsonb retained; no premature axis/matrix columns |
| 7 | Selections normalized into `answer_selected_options` rows | ✅ | table + wizard `selectionsByItemId` emit (`responses/actions.ts:213`) |
| 8 | Selection = hard FK to option UUID; conditions/rulesets store **code** | ✅ | `answer_selected_options_option_id_fkey`; `answer_map` emits codes; validators check codes |
| 9 | Squash + full reset, no flag | ✅ (packaging deferred to BE-7 per migration header; not this gate's concern) |

Author-facing wishlist — **all present**: label, color (7-token), score, ordering,
analytics code, stable identity (hidden `code` + row UUID). Translations correctly
absent. `id`/`code`/`position` are platform-managed and never surfaced in the editor.

## 2. Security / RLS — PASS

**`form_item_options`** (`20260630010000_form_item_options.sql`):
- `form_item_options_select`: `is_member_of(commission_of_version(form_version_id))
  OR is_org_admin_of_commission(...)` — **byte-identical** to the current
  post-multitenancy `form_items_select`
  (`20260626000000_multitenancy_rls_rewrite.sql:143`). ✅
- `form_item_options_staff_admin_write` (FOR ALL): mirrors current
  `form_items_staff_admin_write` (`…:146`) exactly. ✅
- The denormalized `form_version_id` is trigger-synced from the parent item
  (`form_item_options_sync_version`, SECURITY DEFINER), so RLS + the published guard
  key on it without a join and it cannot be spoofed by the client (BEFORE
  INSERT/UPDATE overwrites any supplied value). ✅
- No cross-commission/cross-org read or write leakage: both policies resolve the
  commission via `commission_of_version(form_version_id)`.

**`answer_selected_options`**:
- `answer_selected_options_select`: own / `is_org_admin_of_commission` /
  (`submitted` + `is_staff_admin_of`) — **byte-identical** to the current
  `answers_select` (`…multitenancy…:3182`). ✅
- `answer_selected_options_write_own_draft`: creator + `in_progress` (USING +
  WITH CHECK) — mirrors `answers_write_own_draft`
  (`20260620004000_responses.sql:1474`). Creator-scoped, so no admin clause is
  needed (correctly matches the original). ✅

**Triggers — sound and complete:**
- `guard_published_structure` (reused, keys on `form_version_id`) → options are
  **frozen** on published/archived versions (INSERT/UPDATE/DELETE all blocked).
- `guard_submitted_children` (reused, keys on `response_id`, honors the
  `app.in_submit_rpc` GUC) → selections are **frozen** on submitted responses;
  `submit_response` sets the GUC around its own cleanup so it can delete stray
  selections while flipping to submitted. No bypass.
- `form_item_options_code_immutable` (BEFORE UPDATE OF code, raises only on an
  actual change) → the analytics identity cannot be rewritten; a no-op rewrite is
  tolerated; clone (pure INSERT) never trips it. ✅
- `form_item_options_parent_is_choice` → only `multiple_choice/dropdown/checkbox`
  may own option rows.
- `reject_invalid_selection` → rejects a selection on a display item AND binds the
  option to its item (`v_option_item is distinct from new.item_id` → raise). This
  is *stricter* than the FK (which only proves existence). ✅
- No service-role key is reachable client-side; the DEFINER helpers are all
  `search_path`-pinned. ✅

**DB invariants hold:** published/submitted immutability (above), display-item
answer rejection (`reject_invalid_selection` + the re-stated
`form_items_input_vs_display` CHECK), per-version `question_key` (unchanged),
one-draft-per-user (unchanged), signer rules (unchanged). `submit_response`
remains the submission authority; the SQL and TS evaluators agree (§3).

## 3. Evaluator non-drift — PASS (verified byte-for-byte)

- `git diff c6f7d91 HEAD -- src/lib/queries/conditions.ts
  'src/lib/queries/__fixtures__/*'` → **empty**. TS evaluator + shared vectors
  unchanged.
- No migration redefines `app.eval_condition` / `app.eval_visibility` (grep of
  `create … function app.(eval_condition|eval_visibility)` over the refactor
  migrations → no match). They are only *called*.
- **`app.answer_map`** (`20260630011000`) reconstructs the correct shapes from the
  two tables: single-select → scalar code (`to_jsonb(min(code))`), checkbox →
  array of codes ordered by `option.position`, scalars → raw `answers.value`; a
  choice item with zero selections contributes no key (missing-answer semantics).
- **`app.answer_map_by_item`** (`20260630016000`) is the item_id-keyed twin (same
  shapes), the canonical SQL home for the by-item materialization used by the
  sign-off review surface.
- pgTAP `21_answer_map` (11 tests) proves all reconstructions, position-ordering
  (checkbox options inserted out of order on purpose), and — crucially — tests (7)
  and (8) run the **unchanged** `eval_condition` over the rebuilt map and confirm
  `equals`/`in` still match. This is the SQL half of the non-drift gate; the TS
  half is the untouched Vitest vectors. Insulation is correct and proven.

## 4. Code quality — PASS (one MAJOR bug, itemized below)

- **PGRST201 fix (BUG-FMN-001, `8e073a9`):** `VERSION_TREE_SELECT`
  (`forms.ts:460`) pins the embed to `form_item_options!form_item_options_item_id_fkey`.
  This is the correct disambiguation now that `answer_selected_options` introduces
  a second relationship path between `form_items` and `form_item_options`.
  `toItem` correctly forces `null` for non-choice items and `[]` for choice items
  with no rows yet.
- **App-side code gen:** `slugifyLabel` (NFD-decompose → ASCII slug, `pergunta`
  fallback) + `shortSuffix` + `generateOptionCode` (10-attempt in-memory collision
  retry, DB `unique(item_id, code)` as backstop). Sound; mirrors the existing
  `question_key` generation.
- **Save/submit rewrite (`20260630012000`):** REPLACE semantics for selections
  (delete keyed items' rows, re-insert one per code resolved to *that item's*
  option row); cross-version guard + code-existence guard (HC013) on every keyed
  item; "answered" = scalar value present OR ≥1 selection; hidden-section/item
  cleanup deletes BOTH tables; the `in_submit_rpc` GUC bracket is correct.
  `response_required_complete` widened symmetrically.
- **Clone/publish/validate (`20260630013000` + `…013500`):** clone copies option
  rows verbatim (`code/label/color_token/score/analytics_code/position`) via an
  item-id remap keyed on the unique `(section_id, position)` — safe; publish now
  enforces "≥1 option per choice item" (relocated from the dropped shape CHECK) and
  validates that condition/recommend-when/result-ruleset value **codes actually
  exist** on the target choice question (`assert_condition_value_codes`, no-op for
  non-choice targets). Previously the value was unvalidated. Good hardening.
- **`case_phase_answer_map` fix (`20260630015000`):** a **real bug the refactor
  caught** — this map feeds the cross-phase recommendation engine and the
  per-phase result evaluator, and before the fix choice answers (now in
  `answer_selected_options`) were invisible to it, so result/recommendation
  conditions over choice questions never matched. The fix mirrors `answer_map`
  exactly with the Phase-7 submitted-only scoping preserved. Sound and important.
- **Dashboards (`20260630014000`):** group by stable `code`, resolve the CURRENT
  label from the latest published version (fallback to code), so a renamed label no
  longer fragments analytics. Security gate (`is_staff_admin_of OR is_admin`)
  preserved on both `dashboard_distributions` and `dashboard_export_rows`. This is
  the whole point of the refactor and it is correctly realized.
- **BUG-FMN-002 fix (`eacbe2f`):** `get_response_for_signoff` now sources
  `answers_by_item` from `app.answer_map_by_item`, so choice answers render on the
  review-and-sign surface; the 3 access gates are re-stated unchanged.

### UX & a11y — PASS
- `OptionsEditor`: `sr-only` label per option, `htmlFor`/`id` pairing on
  score/analytics inputs, `aria-label` on every icon button (move up/down, remove),
  the colour dropdown carries `aria-label` + `aria-pressed` and descriptive
  titles. Keyboard-operable (NORM-4 is a keyboard-only reorder). ✅
- Wizard renders **labels** resolved from codes, with a graceful fallback to the
  raw code for an unknown/deleted code (`answer-summary.tsx`) — nothing silently
  disappears. ✅
- All strings pt-BR; error mapping routes through `mapWriteError` → pt-BR
  `MESSAGES.generic`, no raw Postgres string reaches the UI (confirmed for the
  reorder-failure path too). ✅

---

## Findings

### MAJOR-1 — ✅ RESOLVED (`e13081f` + `e158e91`, verified 2026-07-01) — Reordering an **existing** choice item's options fails with a duplicate-key error (silent data loss of the reorder)

`reconcileOptionRows` (`src/lib/forms/actions.ts:931-1002`, called by `updateItem`
at `:1152`) updates each **kept** option row's `position` to its new array index
**one row at a time, via a separate `supabase.from('form_item_options').update()`
call** (each its own transaction). The `unique(item_id, position)` constraint
(`form_item_options_item_id_position_key`) is `DEFERRABLE` but **NOT** `INITIALLY
DEFERRED` — so it is checked at the end of each *statement*, and the deferral does
**not** span the separate per-row transactions.

Result: any reorder that moves an option into a slot still occupied by another
kept row collides. Example (the exact NORM-1 reorder, applied to *existing* rows):
existing `Baixo=0, Médio=1, Alto=2`; author moves `Alto` up to index 1; reconcile
issues `Alto → position 1` while `Médio` still holds 1 →

```
ERROR: duplicate key value violates unique constraint "form_item_options_item_id_position_key"
DETAIL: Key (item_id, "position")=(<item>, 1) already exists.
```

`reconcileOptionRows` returns `{ ok: false }`, `updateItem` returns
`MESSAGES.generic`, and **the reorder is not persisted** — the author sees a
generic failure with no reason. (Reproduced live against the running local DB on
both a temp table and the real `public.form_item_options` table; see the empirical
run in the review session.)

**Why the green E2E did not catch it:** NORM-1 and NORM-4 both reorder during the
**add** flow, where `insertOptionRows` writes all rows in a single batched
`.insert(rows)` after the in-memory reorder (positions assigned by array index) —
no collision. NORM-1's *edit* path only **renames** an existing option's label; it
never reorders existing rows. So the reconcile-reorder collision is entirely
uncovered. The block-card edit dialog exposes the same up/down move buttons on
existing options (`item-editor-dialog.tsx:106` seeds from `existing?.options`), so
this is reachable in normal use.

**Severity rationale:** MAJOR, not BLOCKER — no RLS/immutability breach, no data
corruption (the failing statement aborts atomically), and the error is pt-BR (no
raw-error leak). But "ordering" is an explicit wishlist deliverable, and reordering
existing options is a routine builder action that fails for a very common pattern
(moving an option up). It should not ship silently broken.

**Suggested fix (backend/query owner — do NOT let the tester edit `src`):** make
the position reconcile collision-free. Options, in rough order of preference:
1. Do the whole reconcile inside one RPC (single transaction) and either set the
   constraint `INITIALLY DEFERRED` for that unit of work, or bulk-update positions
   in one statement.
2. Two-phase in-memory: first bump all kept rows to a disjoint temporary band
   (e.g. `position = position + <count>` or negative), then set final positions.
3. Delete-then-reinsert the item's option rows within one transaction (preserving
   `code` verbatim so the analytics identity survives) — simplest, and the code is
   the stable identity anyway.

**And add E2E coverage:** a test that opens the **edit** dialog on an *existing*
multi-option choice item, moves an option **up**, saves, and asserts the new
`order=position.asc` persisted. That single test would have caught this.

### INFO-1 — Constraint deferrability is a latent footgun

`form_item_options_item_id_position_key` being `DEFERRABLE` but not `INITIALLY
DEFERRED` reads as if it were meant to tolerate transient overlap during a reorder
(the migration comment at `20260630010000:110` says exactly that). It only helps
*within a single transaction*; the current per-row-per-transaction reconcile does
not benefit. Whatever fix MAJOR-1 takes, keep the intent and the mechanism aligned
(either make the reorder a single transaction so the deferral applies, or drop the
reliance on it).

### INFO-2 — `dashboard_distributions` / `dashboard_export_rows` remain `SECURITY DEFINER` with an internal `is_staff_admin_of`/`is_admin` gate

Unchanged from the pre-refactor pattern and correct, but noting for the record: the
access decision lives inside the function body (early `return` when not authorized),
not in RLS. Consistent with the existing dashboard RPC posture; no action needed.

---

## Re-review checklist (for the fix loop)
1. `reconcileOptionRows` reorder of existing options no longer errors; moving an
   option up **persists** the new order.
2. New E2E: edit-dialog reorder of an existing choice item's options, asserted at
   the DB by `position`.
3. Re-run T-1 (the refactor-touched specs) + the new reorder test; pgTAP unchanged.

No other changes required — RLS, immutability, evaluator non-drift, clone/publish
validation, dashboards-by-code, and the two already-fixed bugs (FMN-001/002) are
all sound.

---

## Re-review — MAJOR-1 resolution (2026-07-01, head `e158e91`)

**Fix:** `reconcileOptionRows` (`src/lib/forms/actions.ts:931`) no longer updates
positions per-row across separate transactions. It now builds one ordered payload
(kept codes preserved, new codes app-generated per Decision 2) and delegates the
whole reconcile to a single SECURITY INVOKER RPC `public.reconcile_item_options`
(migration `20260630017000`). The RPC, in one transaction: rejects duplicate codes
(HC013) → DELETEs removed codes → UPDATEs kept rows' content (not position yet) →
INSERTs new rows in a high temp position band (`1000000 + i`) → assigns **all** final
positions in **one** `UPDATE` (the `reorder_phase_results` `unnest … with ordinality`
pattern), so the `DEFERRABLE unique(item_id, position)` tolerates the transient
collision *within the statement*. The `versionId` param is correctly dropped (the
sync trigger fills `form_version_id`).

**Verification (independent, live against the running local DB):**
1. **Exact repro passes.** Seeded `Baixo=0, Médio=1, Alto=2`, called the RPC with the
   reordered payload `[Baixo(renamed), Alto, Médio, +Novo]` — i.e. moved `Alto` UP
   into occupied slot 1 while renaming and adding a new option. Result: **no unique
   violation**; final order `Baixo(0), Alto(1), Médio(2), Novo(3)`; all original
   codes preserved; scores intact; the new option inserted at position 3.
2. **SECURITY INVOKER confirmed.** `pg_proc.prosecdef = f` for
   `reconcile_item_options` — the caller's `staff_admin`-write RLS + the published
   guard apply; no privilege escalation.
3. **Immutability preserved.** Reconciling a **published** item's options through the
   RPC is blocked by `guard_published_structure` ("UPDATE on a published version's
   structure is blocked (immutable)") — verified live. No immutability regression.
4. **Codes stable** (Decision 2): kept rows keep their DB-frozen code through the
   reorder; only new rows get a fresh app-generated code.

**Coverage — adequate at both layers:**
- **pgTAP `61_option_reconcile.sql` (9 assertions):** the exact reorder-into-occupied-
  slot repro (`lives_ok`), resulting order, codes preserved (no regeneration), atomic
  add+remove+reorder, removed-option deleted, kept-row content update with code frozen,
  and HC013 duplicate-code rejection. Full pgTAP suite **1180/1180**.
- **E2E `NORM-5`:** creates a 4-option MC, **saves** (so the edit reconciles existing
  rows — the bug path), re-opens the editor, moves "Documentação" UP twice into an
  occupied slot, saves → asserts the dialog closes, the new order persists, codes are
  byte-for-byte preserved, positions are a clean 0..3, the reorder **survives a
  reload**, and a **section condition keyed on the reordered option's code** still
  resolves and **publishes** (code-existence validation is the authority). This is
  exactly the edit-dialog reorder test the original review asked for. 5/5 NORM green
  in isolation.

**Scope check:** `git diff ba4c94c e158e91` touches only the reconcile path
(`actions.ts`), the new RPC migration, generated types (the RPC signature), the two
coverage files, and PROGRESS.md. `git diff ba4c94c e158e91 -- src/lib/queries/conditions.ts
'src/lib/queries/__fixtures__/*'` is **empty** — the evaluator and shared vectors
remain byte-for-byte unchanged. No regression to any previously-passed dimension.

**INFO-1 is now moot** — the reconcile is a single transaction, so the DEFERRABLE
constraint's deferral applies as intended; intent and mechanism are aligned.

**Outcome: MAJOR-1 resolved. Verdict → APPROVED.** No blockers, no open findings.
Cleared for human approval and the BE-7 squash.
