# FF-4 (Power Authoring) — QA Review

**Reviewer:** qa · **Date:** 2026-08-03 · **Verdict:** ✅ **APPROVED**

**Scope:** ADR [0092](../decisions/0092-ff4-power-authoring.md) (9 rulings + Amendments 1–2).
Commits `4df14d7`…`87fbdde`. This is the fifth and last of the Flexible-Forms phases ADR 0086
pulls pre-pilot (ruling 2) — the last gate before the hospital pilot deploy.

**Method.** Per CLAUDE.md's binding graphify exception, all schema/RLS/RPC claims below were
verified against the **live local catalog** (`pg_proc`, `pg_policies`/`pg_policy`, `pg_constraint`,
`information_schema.role_table_grants`, `proacl`) via direct `psql` access to the local Supabase
Postgres container — never from migration file text. Function bodies were pulled live with
`pg_get_functiondef`. In addition to reading, I ran the phase's own pgTAP suite
(`supabase test db --local supabase/tests/00_setup.sql supabase/tests/277_ff4_power_authoring.sql`)
and independently performed one live RLS mutation (tenant-scope over-grant twin, in a rolled-back
transaction against real seed personas) rather than accepting the ADR's mutation-proof narrative
at face value.

## Verdict rationale

No P0. No MAJOR. Every gate keystone I spot-checked is real (the guard's removal produces the
predicted failure), the two new DEFINER doors added in Amendment 2 are correctly gated, and
ruling 3 (condition closure) — flagged as "the sharpest risk in the phase" — is implemented
exactly as specified, on both the refuse-at-save and rewrite-at-insert sides. BUG-FF4-001's fix is
correct and its regression test is non-vacuous. I find nothing that should block the pilot.

## Independent verification performed

### 1. Catalog facts (all confirmed live, not from migration text)

| Fact | Verified |
|---|---|
| `power_authoring` flag | `enabled = t` in `app.feature_flags` (description and value agree) |
| Migrations registered | 241/241, max `20260903000500` |
| Four doors `prosecdef` | all `t` (`save_block_to_library`, `insert_block_from_library`, `update_block_library_entry`, `delete_block_library_entry`) |
| Four doors `proacl` | `{postgres=X,service_role=X,authenticated=X}` — **no `public`/`anon` entry** on any of the four |
| `form_block_library` RLS | `relrowsecurity = t`; **one** policy, `form_block_library_select`, `FOR SELECT TO authenticated USING (is_staff_admin_of(commission_id) OR is_commission_admin_of(commission_id))` |
| `form_block_library` grants | `authenticated`: **SELECT only**. No INSERT/UPDATE/DELETE grant anywhere for `authenticated` |
| `form_items` CHECKs | `form_items_default_source_xor` (literal XOR dynamic) and `form_items_default_source_type_check` (exact 5-token → type-set mapping from ruling 5) present and match the ADR table verbatim |
| `form_block_library.commission_id` | real FK → `commissions(id) ON DELETE CASCADE` (correct — this is the tenant-scope column, unlike the deliberately-FK-less provenance columns) |
| No stray reader | `select * from pg_proc where prosrc ilike '%form_block_library%'` returns **only** the four intended doors — no dashboard/report function touches the table, so there is no `prosecdef`-beside-`pg_policies` blind spot here (ADR 0078/0079 concern) |

### 2. Live function bodies read in full (`pg_get_functiondef`)

`public.save_block_to_library`, `public.insert_block_from_library`,
`app._insert_block_child_rows`, `app.rewrite_condition_keys`, `app.resolve_default_source`,
`app.seed_default_answers`, `public.start_or_resume_response`.

Findings:
- **Authority-first ordering holds.** Both write doors resolve the commission and run the
  `is_staff_admin_of OR is_commission_admin_of` check *before* touching any row that would
  disclose the entry's or item's shape — matching the ADR 0079 lesson explicitly cited in both
  functions' comments.
- **Ruling-3 closure is real.** `save_block_to_library` computes the subtree's own key set, then
  the set of `question_key`s referenced by any `visible_when`/`required_if` in the subtree (via
  `app.visibility_conditions`, which normalizes both the single-condition and `{match,
  conditions[]}` group shapes), and raises `HC0Q6` with the offending keys in `DETAIL` if any
  referenced key isn't in the subtree's own set. `insert_block_from_library` rewrites conditions
  through `app.rewrite_condition_keys`, which **also** handles both shapes (branches on `p_condition
  ? 'conditions'`) — a single-condition-only rewrite would have been the exact ruling-3 defect the
  ADR warns is invisible to structural tests.
- **Deep-copy ordering is correct.** `_insert_block_child_rows` inserts `form_item_validations`
  after the item row (with `parent_item_id` already set on the child branch), matching
  `app.copy_version_children`'s requirement that `guard_item_validation_row` see a resolved parent
  type.
- **Tenant scoping in `insert_block_from_library` is enforced at the SQL level, not merely by RLS**:
  the library-entry lookup is `where id = p_library_entry_id and commission_id =
  v_target_commission_id` — a cross-commission id resolves as not-found inside the DEFINER body,
  which reads without RLS. This is the correct shape (RLS is bypassed for DEFINER callers; the door
  must re-enforce the perimeter itself).
- **`app.seed_default_answers` blast radius is bounded as designed.** It is `SECURITY INVOKER`
  (not DEFINER), runs only from `start_or_resume_response`'s CREATE branch (never on resume — the
  RESUME branch returns before it's reached), is a no-op behind `feature_enabled('power_authoring')`,
  and its `INSERT … ON CONFLICT (response_id, item_id) WHERE group_instance_id IS NULL DO NOTHING`
  is the actual idempotency mechanism (independently exercised, see below). It resolves only from
  the actor's own profile and the version's commission — no join reaches PHI, no new read path.
- **`resolve_default_source`** is parametrized (no dynamic SQL), `STABLE`, and its `else` branch
  returns `null` for an unreachable token rather than raising — consistent with the codebase's
  "forgiving reader" convention and mirrored by the TS `toDefaultSource` narrowing.

### 3. pgTAP — ran live, not just trusted

```
supabase test db --local supabase/tests/00_setup.sql supabase/tests/277_ff4_power_authoring.sql
→ Files=2, Tests=62, Result: PASS
```
All 61 FF-4 assertions (§0–§L) pass on a fresh run. Confirmed the run is transactional
(`begin`…`rollback`) and does not disturb the shared local seed data (`commissions` count 6,
`forms` count 7, unchanged before/after).

### 4. One independent live mutation (not from the ADR's narrative)

Using real seed personas (`chefe.ccih@test.local` / staff_admin of CCIH, org A;
`chefe.farm@test.local` / staff_admin of Farmácia, sibling commission same org;
`staff1.qual.b@test.local` / staff_admin, org B) inside a single rolled-back transaction:

1. As Chefe CCIH, saved a block via `save_block_to_library` into commission A1's library.
2. As Chefe Farmácia (sibling, same org): `select count(*) from form_block_library where id = …` →
   **0**.
3. As the org-B staff_admin: same query → **0**.
4. **Over-grant twin**, live: `alter policy form_block_library_select … using (true)`, then re-ran
   step 2 as Chefe Farmácia → **1** (the leak appears).
5. `rollback` — no lasting change.

This independently confirms the tenant-scoping keystone is not vacuous: the policy is doing real
work, and removing it produces exactly the predicted leak.

### 5. BUG-FF4-001 fix — read, not just accepted as fixed

Confirmed in `src/lib/queries/responses.ts:452-460` (`buildAnswerMaps`): `answersByItemId[a.item_id]
= a.value` runs unconditionally (keeps the `null` row); `answersByKey[a.question_key] = a.value`
only runs `if (a.value !== null)`. Confirmed the SQL twin `app.answer_map_scoped` carries `and
a.value is not null` in its own `jsonb_object_agg` (live body, line matches). Confirmed
`prepare.ts:49-54`'s `toAnswerState` gates on `value === undefined` (not `== null`), so a `null`
row is correctly treated as "answered, cleared" rather than "never answered," which is what lets
`use-wizard.ts`'s `withDefaults` (`if (item.id in initialAnswers) continue`) skip re-seeding.
The Vitest parity guard (`src/lib/queries/responses.test.ts:236`, "PARITY GUARD: answersByKey never
carries a null-valued entry for a cleared scalar answer") asserts
`hasOwnProperty(answersByKey, 'campo') === false` — a revert of the exclusion would flip this
red, so the guard is not vacuous.

### 6. Client/server consistency

`block-card.tsx:126` gates the "Salvar na biblioteca" affordance on `!isChild`, mirroring
`save_block_to_library`'s own `HC0Q8` refusal for a non-top-level item — the UI never offers what
the door would reject, rather than relying on the door alone (defense in depth, not a substitute
for it).

### 7. UI / a11y / pt-BR spot check

`block-library-picker.tsx` and `edit-library-entry-dialog.tsx`: every icon-only button carries
`aria-label` + `title`; delete goes through `AlertDialog` with copy that states the safety property
("Isso não afeta nenhum formulário que já usa este bloco — inserir sempre copia o conteúdo, nunca
vincula a esta entrada"); rename/delete confirmations are announced through a picker-level
`role="status"` banner rather than a per-card live region (correctly reasoned in the code comment:
a per-card region would unmount with a deleted card before assistive tech finishes reading it). All
user-facing strings are pt-BR. Error paths render through `FormBanner`/`role="alert"`, never a raw
Postgres message. The rename list (Amendment 1) renders as a read-only old→new list with no fake
edit affordance — matches the amendment's explicit finding that no rename door exists anywhere in
the schema.

## Items reviewed and NOT treated as blocking

- **BUG-P15-001** (`phase15-indicators.spec.ts` AC-4, month-boundary seed-date fragility) —
  confirmed pre-existing, confirmed not touched by `seed_default_answers` (that mechanism only
  writes on the CREATE branch; AC-4's responses are long-submitted pre-existing fixtures), and
  confirmed reproducible only on the 1st–4th of any month by seed arithmetic, not FF-4 logic. I
  concur this doesn't block FF-4's own acceptance criteria. **INFO**, not MINOR: it's not FF-4's
  code and doesn't touch anything FF-4 shipped — but it's real and will keep firing near every
  month boundary until `seed.sql`'s date arithmetic is made month-safe. Worth a ticket independent
  of this gate.
- **File-ownership deviation** (`backend` added two tests to `use-wizard.test.ts`, nominally
  `frontend`'s file) — confirmed no concurrent edit occurred and nothing was lost; the tests
  themselves are correctly scoped regression coverage for the shared `withDefaults` bug. **MINOR**
  process note, not a code defect: CLAUDE.md §4's file-ownership rule exists to prevent silent
  conflicts, which did not happen here and was disclosed rather than hidden. No action needed
  beyond what's already recorded in PROGRESS.md.
- **Gate-script COVERAGE-denominator defect** (`scripts/e2e-prod-gate.sh` drops a `reset FAILED`
  batch from its own denominator) — real, but not FF-4 code, and the phase's actual gate was not
  fooled by it: the lead's Test Run Summary shows the affected batch's 66 tests were identified and
  independently re-run 66/66. **INFO** for this gate; flagged as a standing risk to future gates
  that don't re-run the dropped batch by hand.
- **`session_replication_role=replica` FK-cascade leak** in FF-1/2/3/5's shared `purge()` helpers —
  confirmed this file's own `purge()` in `ff4-power-authoring.spec.ts` already avoids the pattern
  (explicit table-by-table deletes). Not this phase's defect; queued separately per PROGRESS.md.
- **`bulk-case-creation` AC2 non-idempotency** — unrelated pre-existing item, not in this phase's
  surface.

None of the above touches FF-4's own RLS perimeter, DEFINER doors, condition-closure logic, or the
default-resolution mechanism, and none is a security hole.

## What I did not do

I did not re-run the full `e2e:prod` gate (901 passed, reported by the lead) — Test Run Summary and
Bug Log entries were read and cross-checked against the Bug Log's own root-cause traces rather than
re-executed, since a subagent's foreground budget doesn't cover the full suite (per CLAUDE.md
memory) and the lead's own reported numbers were internally consistent with the targeted spec run
(`ff4-power-authoring.spec.ts` 7/7) and the BUG-FF4-001 fix I verified independently at the code
level.

## Conclusion

FF-4 is the smallest of the five Flexible-Forms phases by surface (ADR 0092's own framing), and the
audit bears that out: one table, four DEFINER doors, one nullable column, no new read perimeter
beyond the single library SELECT policy. Every claim I could independently verify — the RLS
tenant-scope keystone (via a live over-grant mutation, not just reading pgTAP), the ruling-3
closure/rewrite logic (via live function bodies), the ACL revokes (via `proacl`), the CHECK
constraints (via `pg_constraint`), and the BUG-FF4-001 fix (via the actual TS source and its
parity-guard test) — checked out exactly as documented. No P0, no MAJOR.

**Verdict: APPROVED.**
