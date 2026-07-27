# Phase FF-1 — Repeating Groups · QA Review (r1)

**Date:** 2026-07-27 · **Reviewer:** `qa` · **Branch:** `ff/flexible-forms-program` @ `3b5d9c7`
**Audited against:** ADR [0087](../decisions/0087-ff1-repeating-groups.md) (six rulings + Amendment 1 +
§Gate keystones) · [program plan](../plans/flexible-forms-program.md) §3 FF-1 (superseded by the ADR in
six places) · ARCHITECTURE.md Rules 1–12 · CLAUDE.md §8.

# ⛔ VERDICT: CHANGES REQUESTED

**1 P0 · 2 MAJOR · 3 MINOR · 5 INFO.**

The engine is good work. The instance model, the two-tier overlay, the dispatch-by-`item_type`
refactor, the publish-time condition gate and the INVOKER/RLS posture are all correct in the **live
catalog**, and most of the suite's keystones are genuinely mutation-capable — I re-ran 16 mutations
myself and 11 went red exactly as documented.

It fails the gate on two counts:

1. **P0-1** — a **live, silent data-loss defect** that FF-1 activates: correcting a submitted response
   drops every *choice* answer inside a repeating group. Proven live, on both correction authorities,
   with both correction flags currently `enabled = true`.
2. **MAJOR-1/-2** — three of the ADR's own §Gate keystones **cannot fail**. ADR 0087 ruling 4 makes
   mutation-provenness an explicit acceptance condition of the CHECK-drop widening ("A keystone that
   cannot fail is not a keystone"). For the widening's headline guard — *visibility wins* — that
   condition is **not met**.

---

## 1. Method

Per CLAUDE.md §graphify and the ADR-0078 scars, **every** schema / RLS / RPC / authorization claim
below was resolved from the **live catalog** (`pg_proc` incl. `prosecdef`, `pg_policies`, `pg_policy`,
`pg_constraint`, `pg_trigger`, `pg_class.relacl`, `app.feature_flags.enabled`) on
`supabase_db_azkbbhskturikxpgmafq`. No claim rests on migration text. Migration registration was
verified clean first: **196 files / 196 registered**.

**Mutation harness (mine, not the recorded runs).** I installed pgTAP + `test_helpers` and ran
`supabase/tests/270_ff1_repeating_groups.sql` standalone (baseline **46/46 green**, reproduced). Each
mutation was spliced in immediately after the suite's `begin;` so the trailing `rollback;` undoes the
DDL — nothing persisted. **Every mutation carries an in-transaction `MUTATION-APPLIED …residual=N`
probe that reads the mutated object back out of `pg_proc` / `pg_constraint` / `pg_policies`**,
because a mutation patch has silently no-op'd on this repo twice. Every mutation below reported
`residual = 0` (or the equivalent) before the suite ran. Surviving mutants were re-verified by
counting `ok` / `not ok` / `ERROR` lines, after a grep artifact briefly disguised one hard failure as
a pass.

Afterwards I verified the shared stack was restored (constraint back, both policies back, all four
mutated function bodies back) and dropped `pgtap` + `test_helpers`.

I did **not** re-run the full `e2e:prod` gate (lead instruction; the triage in Test Run Summary
`2026-07-27e` is internally consistent — collapses that migrate between runs are not code
regressions, and the FF-1 spec is 9/9 with 0 connection errors). I accept it as-is and did not
challenge it.

---

## 2. P0-1 — correcting a response silently destroys every choice answer inside a repeating group

**Severity: P0 (blocking).** Silent data loss, on a shipped and flag-ON governance workflow, on the
exact path ADR 0087 Amendment 1.3 exists to repair. No test covers it.

**Where.** `public.supersede_response` (standalone corrections, ADR 0074) and
`public.start_correction_draft` (case-phase corrections, ADR 0085) — identical code, live bodies:

```sql
insert into public.answer_selected_options (answer_id, option_id)
select new_a.id, aso.option_id
from public.answer_selected_options aso
join public.answers old_a on old_a.id = aso.answer_id
join public.answers new_a
  on new_a.response_id = v_new.id          -- (v_draft in start_correction_draft)
 and new_a.item_id     = old_a.item_id
 and new_a.group_instance_id is not distinct from old_a.group_instance_id   -- ← never true
where old_a.response_id = p_response_id;
```

**Why it is wrong.** Amendment 1.3's fix (correctly) gives the successor its **own** instance rows and
**remaps** the copied `answers.group_instance_id` through the `old_id → new_id` map. That is precisely
what makes this join predicate unsatisfiable: `new_a.group_instance_id` is the **new** instance id,
`old_a.group_instance_id` is the **old** one. `is not distinct from` is therefore `false` for every
instance-scoped answer. Top-level answers are unaffected (`NULL is not distinct from NULL` → true), so
the defect is invisible outside repeating groups. The predicate needs to route through the same
`map` CTE the answers copy uses.

**Proven live** (probe: repeating group with a `multiple_choice` child, two instances, one selection
each, submit, `supersede_response`):

```
PROBE pre-submit instance selections   = 2
PROBE successor instances              = 2   ← Amendment 1.3's half works
PROBE successor instance ANSWERS       = 2   ← …and the answers are remapped
PROBE successor instance SELECTIONS    = 0   ← every selection is gone
```

**Blast radius.** `app.feature_flags`: `case_corrections = t`, `response_correction = t` (values read,
not descriptions). The moment `repeating_groups` is enabled beyond local/E2E, any corrector of a form
with a repeating group containing a `multiple_choice` / `dropdown` / `checkbox` child gets a draft
whose repetitions are silently blanked. If that child is `required`, the correction then blocks with
*"há perguntas obrigatórias sem resposta"* pointing at a field the user never emptied; if it is not
required, the corrected record silently differs from the original — an accreditation artifact that
misreports what was answered (Rule 11's spirit).

**Why the keystone missed it.** `correction_copies_group_instances` (K1/K2/K3) counts rows in
`answers` only. K3 (`3` instance-scoped answers copied) passes while zero selections are copied. The
fixture uses only `short_text` children, so no choice item ever reaches the selections copy.

**Requested change.** Fix both functions (route the selections join through the instance map), and
extend §K with a **choice** child so K-something asserts
`count(answer_selected_options) on the successor = count on the predecessor` per instance. Confirm
non-vacuity by reverting the fix.

**Adjacent, non-blocking (INFO-1).** The comment above both blocks still reads *"…which is the
one-row-per-item key **while repeating groups are inert**"*. That premise stopped being true in this
phase and is the sentence that should have flagged the join.

---

## 3. MAJOR findings

### MAJOR-1 — `completeness_deadlock_negative_groups` and the top-level half of `conditional_required_honoured` cannot fail

ADR 0087 ruling 4: *"This is a **widening**, so per ADR 0079 it lands with deadlock-negative keystones
that are **mutation-proven**: restore the CHECK, or **break visibility-wins**, and the keystone must go
red."* I broke visibility-wins in three separate places. The suite stayed at a clean **46/46, zero
SQL errors**, every time:

| # | Mutation (applied + residual-verified) | Expected red | Actual |
|---|---|---|---|
| m4 | `app.response_required_complete` — flat arm, drop `and app.eval_visibility(i.visible_when, v_answers)` | H1 | **46/46 GREEN** |
| m4b | `app.response_required_complete` — group arm, neutralise `if not app.eval_visibility(r_group.visible_when, v_answers) then continue` | H1 | **46/46 GREEN** |
| m6 | `submit_response` — neutralise the hidden-container branch (`v_hidden_containers`) | — | **46/46 GREEN** |

**Root cause: H1's savepoint state satisfies everything independently of visibility.** At H1 the
fixture has two non-empty instances against `minInstances = 2`, and the conditional+required top-level
item `extra` **is answered** (`'"x"'`, inserted at fixture time and never removed). So closing the gate
(`porta = 'nao'`) changes nothing observable: `rrc` returns `true` whether visibility wins or not. H1
is the *sole* assertion carrying both keystones.

**The branch is real and behaviour-carrying** — this is not a "dead code, who cares" finding. Direct
probe on a minimal form (one gate + one conditional+required item, gate answered `"nao"`, the
conditional item **unanswered**):

```
unmutated      → rrc = true    (visibility wins, as ruling 4 intends)
with m4 applied → rrc = false   (the branch is load-bearing)
```

And `app.response_required_complete` is a **live authority**, not a spare: `pg_proc` shows it called by
`public.list_signoff_queue`, `public.save_section_answers` and `public.compute_due_notifications` — the
sign-off queue's completeness signal, the wizard's save-time state, and notification generation.

**No other test covers it.** No pre-FF-1 suite can: before ruling 4 dropped the CHECK, the
conditional+required combination was *unconstructible*, which is the ADR's own argument for why the
branch was dead code. E2E `FF1-5` covers `submit_response` at top level and per-instance (genuinely
discriminating — gate `"Não"`, required child hidden **and blank**, submit succeeds), but nothing
exercises `response_required_complete`, and **nothing anywhere hides a repeating-group container**.

Net coverage of the widening, authority × level:

| | `app.response_required_complete` | `public.submit_response` |
|---|---|---|
| top-level conditional+required item | ❌ m4 survives | ✅ E2E FF1-5 |
| per-instance conditional+required child | ✅ m4c → H3 red | ✅ E2E FF1-5 |
| **hidden repeating-group container** | ❌ m4b survives | ❌ m6 survives |

**Requested change.** Make H1 discriminating, or split it. Cheapest correct shape: take the H1
savepoint at a state where the hidden things *would* block — e.g. delete `extra`'s answer inside the
savepoint, and assert a second savepoint where the group is one non-empty instance short. Then revert
each guard and require red. `completeness_deadlock_negative_groups` additionally needs a submit-side
hidden-container assertion (a hidden repeating group with a required child must not block, and its
instances must be cleaned).

*(Positive control: m4c → H3 red, and m4d — `rrc` forced to `return true` — → H4a + H2 red. So `rrc`
does have negative coverage; it is specifically the two visibility branches that are unguarded.)*

### MAJOR-2 — `group_instances_cross_user_denied` (J1) does not test the clause it names

The suite header states: *"MUTATION: widen `response_group_instances_write_own_draft`'s qual to drop
`created_by = auth.uid()` → J1 goes red."*

I dropped exactly that clause (verified: `qual_has_created_by = false`). **46/46 green.**

J1 still refuses the write, but on a different authority: the persona is `st_x2`, an ordinary member,
and `responses_select` hides another member's `in_progress` row from him, so the policy's own
`exists (select … from responses …)` subquery returns no row. J1 passes on **`responses` RLS**, not on
the clause it claims to guard. Same for J2.

**The shipped policy is correct** — I verified ruling 5's security argument independently rather than
taking the ADR's word (see §4). This is a keystone-integrity defect, not a live hole. But it is the
keystone that *replaced* the retired `reader_non_writer`, so it is the one thing standing behind
ruling 5's "RLS remains the boundary".

**Requested change.** Re-target J1 at a persona who *can* `SELECT` the foreign draft — i.e. one
satisfying `app.is_commission_admin_of(commission_id)` (note: **not** a `staff_admin`;
`is_commission_admin_of ≠ is_staff_admin_of`, and `test_helpers.bootstrap`'s `sa_x` reads **0** foreign
instances, which I confirmed live). With the clause present that persona must be denied the write
while still reading; with it dropped, the write must succeed. That makes the keystone fail on the
clause it names.

---

## 4. Security / RLS review

### Ruling 5's posture — independently verified, and it holds

I did not accept the ADR's reasoning; I read both quals out of `pg_policies`:

```
response_group_instances_select      SELECT  : created_by = auth.uid()
                                              OR is_commission_admin_of(commission_id)
                                              OR (status = 'submitted' AND is_staff_admin_of(commission_id))
response_group_instances_write_own_draft ALL  : created_by = auth.uid() AND status = 'in_progress'
                                              (identical USING and WITH CHECK)
```

- **Reads:** the `FOR ALL` policy **is** a read policy (permissive union). Its qual implies the SELECT
  policy's first disjunct, so it is **strictly narrower** — the union is exactly the SELECT qual. **No
  read over-grant.** ADR 0087's claim is correct.
- **Writes:** INSERT/UPDATE/DELETE are governed by the `FOR ALL` policy alone, whose qual contains
  `created_by = auth.uid()` literally. **Writes ⊆ own in-progress drafts.** No write over-grant.
- **ADR-0079 reader-non-writer genuinely does not apply here.** The failure mode that rule exists for
  is a `FOR ALL` qual *broader* than the intended read set leaking writes to readers. Here the
  inclusion runs the other way. Recording it not-applicable is right.
- **Live assertion, not predicate-reading** (the ETH·E1 lesson): under `set local role authenticated`
  a commission `staff_admin` reads **0** instances of another member's draft, and INSERT → `42501`,
  UPDATE → 0 rows, DELETE → 0 rows.
- `prosecdef` sweep: `add_/remove_/reorder_group_instances` = **INVOKER** (`f`), and their shared gate
  `app.assert_group_writable` = **INVOKER** (`f`) too — so no DEFINER quietly replaces RLS anywhere on
  the write path. ACL `authenticated=arwdDxtm`, matching the `answers` fill-path convention the ruling
  cites.
- Post-submit immutability: `guard_submitted_group_instances_trg` (BEFORE INSERT/UPDATE/DELETE →
  `guard_submitted_children`) is live, **and** the RLS qual's `status = 'in_progress'` is a second
  independent lock. I4 red-proves the trigger.
- The sign-off DEFINER door `public.get_response_for_signoff` (`prosecdef = t`) builds its payload —
  including the new `instances` key — only **after** three gates (exists+in_progress; staff_admin /
  commission_admin / `member_can('view_signoffs')`; a pending visible unsigned staff_admin section).
  FF-1 adds no new reach to it.
- `assert_group_writable` also pins `i.form_version_id = v_version` and `item_type = 'repeating_group'`
  (`HC0N4`), so the RPC path cannot bind an instance to a foreign or non-repeating item.

### Rule 12 / PHI — clean ✅

FF-1 touches **no** PHI surface. None of the seven migrations references `event_patient`,
`referral_patient`, `patient_identifiers` or `patient_participants`; the diff's only matches for those
nouns are documentation prose. No new PHI column, no change to a PHI door, no audit-payload change.
`SUPABASE_SERVICE_ROLE_KEY` appears only in `src/lib/supabase/admin.ts` (server-only, untouched by this
phase); no client bundle reaches it.

### Other invariants

- **Rule 1** — RLS is the boundary throughout; the server actions' `authorizeMember` pre-check is
  explicitly documented as *copy quality*, never as the authority.
- **Rule 3** — one draft per user per version unaffected; SQL↔TS parity verified mechanically (below).
- **Rule 5** — published immutability unaffected; `app.validate_group_layout` is a **publish-time**
  gate (correct: a draft mid-edit legitimately passes through non-contiguous states), red-proven by D2
  and D3.
- **Rule 7** — display children render through the existing sanitized-Markdown path; no new HTML sink.
- **Rule 11** — no per-instance audit trigger, consistent with the fill path's response-level
  `audit_responses_trg`; ruling 5 tracks the coherent hardening as FUP-FF1-1.

---

## 5. Mutation proofs I re-ran myself

Baseline reproduced standalone: **46/46**. `✅` = the keystone went red as documented.

| # | Deliv. | Mutation | Result |
|---|---|---|---|
| m1 | BE-1 | drop `form_items_no_nested_container` | ✅ A2 red (A3 cascades) |
| m2 | BE-6 | neutralise BOTH outside-in raises in `validate_visible_when` (item + section arms) | ✅ E2, E4, E5 red — **and E1/E3 stay green**, so the ban is not vacuously strict |
| m3 | BE-5 | `submit_response`: neutralise both `HC011` arms **and** the `HC0N5` minInstances arm | ⚠ **survives** (46/46) — see MINOR-1 |
| m4 | BE-5 | `rrc` flat arm: drop item visibility-wins | ❌ **survives** — MAJOR-1 |
| m4b | BE-5 | `rrc` group arm: drop the hidden-group skip | ❌ **survives** — MAJOR-1 |
| m4c | BE-5 | `rrc` group arm: drop per-instance child visibility | ✅ H3 red |
| m4d | BE-5 | `rrc` → `return true` (positive control) | ✅ H4a, H2 red |
| m5 | Amdt 1.2 | flat arm predicate → literal `parent_item_id IS NULL` (substrate 4 taken literally) | ✅ H2 red |
| m6 | BE-5 | `submit_response`: neutralise the hidden-container branch | ❌ **survives** — MAJOR-1 |
| m7 | BE-2 | `app.answer_map_scoped`: drop the instance filter (substrate 5) | ✅ G1b, I3, K3, M2 red |
| m8 | BE-3/RLS | drop `created_by = auth.uid()` from the `FOR ALL` qual | ❌ **survives** — MAJOR-2 |
| m9 | BE-3 | `add_group_instance`: drop the `maxInstances` branch | ✅ F2 red (+F3/F3b/H4b) |
| m10 | BE-3 | `reorder_group_instances`: remove `set constraints … deferred` | ⚠ survives — see MINOR-3 |
| m11 | BE-3 | `reorder_group_instances`: permutation check → subset check | ✅ F4 red |
| m12 | BE-4 | `save_section_answers`: restore the unscoped `p_clear_item_ids` delete | ✅ G2, G2b, H3, I1, I2 red |
| m13 | BE-5 | `submit_response`: remove the empty-instance prune | ✅ I1, I2, I4 red |
| m14 | Amdt 1.3 | `supersede_response`: remove the instance-copy CTE | ✅ hard red (`23505 answers_uq_top` at §K — the suite cannot complete) |
| m15 | BE-4 | `app.answer_map_by_item_scoped`: drop the instance filter | ✅ M3 red |

Three live probes beyond the suite:

- **P0-1 probe** — instance selections lost across `supersede_response` (§2).
- **Visibility-wins probe** — `rrc` true → false under m4 on a minimal form, proving the branch is
  load-bearing while unguarded (MAJOR-1).
- **Reorder-collision probe** — a naive single-statement swap **succeeds** while the constraint is
  `DEFERRABLE` and raises `23505` once it is not. So BE-1's `DEFERRABLE` alter is the real guard, and
  F3 *is* a keystone for it; only the header's *named* mutation is wrong (MINOR-3).

---

## 6. Requirements coverage

### ADR 0087 rulings

| Ruling | Implemented (live catalog) | Tested | Test can fail |
|---|---|---|---|
| **1** depth-1 cap in the schema | ✅ two independent objects — `form_items_no_nested_container` CHECK **and** composite FK `(parent_item_id, form_version_id, parent_is_container) → (id, form_version_id, is_container)` | ✅ A1/A2/A3 | ✅ m1 |
| **2** inside-out resolves, outside-in forbidden at publish | ✅ item arm `v_ref_group is not null and v_ref_group is distinct from v_dep_group`; section arm blanket; `rg.item_type = 'repeating_group'` keeps plain-group children legal; pt-BR `check_violation` | ✅ E1–E5 (3 positives + 3 negatives) | ✅ m2 |
| **3** empty instance is not there | ✅ `submit_response` **prunes then re-packs then checks** `minInstances`; `rrc` **skips** via the shared `app.instance_is_empty` | ✅ H3/H4a/H4b/I2 + E2E FF1-4 | ✅ m13 |
| **4** drop `form_items_conditional_not_required` globally | ✅ constraint absent from `pg_constraint`; the un-deadened branch present in **both** authorities | ⚠ per-instance ✅, top-level ✅ only in `submit_response` (E2E) | ❌ **MAJOR-1** |
| **5** INVOKER writers, RLS is the boundary | ✅ verified independently (§4) — no read or write over-grant | ⚠ J1/J2 present | ❌ **MAJOR-2** |
| **6** both containers; `group` is purely visual | ✅ plain-group children answer top-level; no instance rows; flat-arm predicate `parent_item_id IS NULL OR p.item_type = 'group'` | ✅ E3, H2, E2E FF1-6 | ✅ m5 |

### Amendment 1

| # | Status |
|---|---|
| 1.1 SQLSTATE lane | ✅ `HC0N0`–`HC0N5` in use, above the `HC0M9` water line; TS constants mirror them. `docs/backend-state.md`'s `HC098` correction is still pending — a Record-step item, non-blocking. |
| 1.2 flat-arm predicate | ✅ correct predicate live; `plain_group_child_required_blocks` (H2) red-proven by m5. |
| 1.3 correction copies instances | ⚠ **half delivered.** Instance rows + answer remap: ✅, hard-red-proven by m14. **Selections: ✗ — P0-1.** |

### §Gate keystones

| Keystone | Present | Can fail |
|---|---|---|
| `nesting_depth_capped` | ✅ A1+A2, deliberately two objects | ✅ |
| `condition_outside_in_rejected` | ✅ E2/E4/E5 + positives E1/E3 | ✅ |
| `condition_parity_vectors_instances` | ✅ 21 vectors, SQL ↔ JSON **byte-equal** (I diffed all 21 payloads mechanically: 0 mismatches) | ✅ (`app.overlay_answer_map` is the shared seam) |
| `completeness_deadlock_negative_groups` | ⚠ min-instances half ✅; **hidden-group half ✗** | ❌ MAJOR-1 |
| `empty_instance_pruned_at_submit` | ✅ I2 | ✅ m13 |
| `conditional_required_honoured` | ⚠ per-instance ✅; top level ✅ only for `submit_response` | ❌ MAJOR-1 |
| `group_instances_post_submit_immutable` | ✅ I4 | ✅ (trigger + RLS both) |
| `group_instances_cross_user_denied` | ⚠ present | ❌ MAJOR-2 |
| `plain_group_child_required_blocks` | ✅ H2 | ✅ m5 |
| `correction_copies_group_instances` | ⚠ answers-only | ❌ **P0-1** (selections invisible to it) |
| `completeness_authorities_agree` | ⚠ one-directional in pgTAP | ⚠ MINOR-1 (E2E carries the blocking direction) |
| `supersession_group_answers_excluded` | ✅ L1a/L1b assert the **set**, not a count | ✅ (inherited from `app.submitted_form_responses`) |
| E2E wizard lifecycle + keyboard pass | ✅ FF1-1…FF1-9, 9/9 on a prod build; FF1-9 is a real keyboard-only pass | ✅ |

---

## 7. MINOR / INFO

- **MINOR-1 — `completeness_authorities_agree` is one-directional in pgTAP.** m3 removes *every*
  blocking arm of `submit_response` (both `HC011`, the `HC0N5` minInstances raise) and the suite stays
  46/46: I1 only asserts *"submit succeeds when `rrc` says complete"*. The blocking direction lives
  solely in E2E (FF1-4 asserts `/exige ao menos 1 item/` **and not** `/há perguntas obrigatórias/`;
  FF1-5 asserts the per-instance `HC011`) — so there is no live hole, and both E2E cases are honest
  about their deliberate RPC bypass. But `HC0N5` has **zero** occurrences anywhere in `supabase/tests/`,
  so a refactor that breaks submit-side group blocking passes the fast gate silently. Add one
  `throws_ok(… 'HC0N5')` and one negative-agreement assertion at the H4a state.
- **MINOR-2 — the suite header documents a keystone that does not exist.** *"MUTATION F5: drop the
  re-pack UPDATE from `remove_group_instance` → F5 red."* There is no F5, and
  `remove_group_instance` is never called in `supabase/tests/`. E2E covers it (FF1-3 line 845, FF1-9
  line 1430, the latter removing position 0 of 2 so the re-pack is exercised), so this is a
  documentation defect plus a pgTAP gap, not a hole.
- **MINOR-3 — MUTATION F3's named mutation is the wrong one.** Removing `set constraints …
  deferred` from `reorder_group_instances` leaves the suite green, because the constraint is
  `DEFERRABLE` (BE-1) and a deferrable unique is checked at end-of-statement regardless. Proven both
  directions: with the constraint made non-deferrable, the same naive swap raises `23505`. F3 *is* a
  real keystone — for BE-1's `DEFERRABLE` alter, not for the in-function `set constraints`. Correct the
  header; the explicit `set constraints` is harmless belt-and-braces.
- **INFO-1** — stale comment in both correction RPCs: *"…while repeating groups are inert"* (§2).
- **INFO-2** — no CHECK/trigger ties `response_group_instances.group_item_id` to a `repeating_group`
  of the response's own `form_version` on the **direct-DML** path; the FK is only
  `→ form_items(id)`. The RPC path is fully guarded (`assert_group_writable`, `HC0N4`), and ruling 5
  deliberately leaves direct DML open, so the exposure is a user writing junk into **their own** draft
  — no cross-tenant read, no PHI. Worth a coherence trigger when FUP-FF1-1 revisits the fill path.
- **INFO-3** — `src/lib/responses/actions.ts:384-390`: the `p_instance_answers` comment block is
  duplicated verbatim.
- **INFO-4** — the parity vectors are hand-mirrored SQL ↔ JSON with **no drift detector**. They are
  byte-equal today (verified, 21/21), and this matches the pre-existing `condition-vectors.json`
  convention, so it is not an FF-1 regression — but Rule 3 calls drift phase-blocking and nothing
  detects it.
- **INFO-5** — no `…_enable_repeating_groups.sql` exists yet; the flag is `t` locally **only** via
  `supabase/seed.sql`. That is the planned shape ("flipped by its own enable migration at the FF-1
  gate"), so it is a Record-step item, not a defect. §0 asserting the seed rather than forcing the flag
  is the right call (the `pgtap-fixture-flag-gaps` scar).

---

## 8. Code quality — clean

`npm run lint` **0 errors / 0 warnings** · `npm run typecheck` **clean** · `npx vitest run` **490/490
across 37 files**. No `any` introduced anywhere in the FF-1 diff (`git diff main...HEAD -- src/**`).
Data access flows through `src/lib/queries/`; the wizard never inlines supabase-js. New read-only
renderers (`instance-answers-readonly.tsx`) are Server Components; `"use client"` appears only where
interaction requires it. `buildGroupInstances` is wired into all three read doors — no `instances: []`
placeholder survives.

**`.rpc()` sweep spot-check (independent).** I re-derived the sweep rather than trusting it: extracted
**385** `.rpc('name', {…})` sites from `src/` and cross-checked each argument set against
`pg_proc.proargnames`. **Two** flagged, **both regex artifacts** of my own extractor (a non-greedy body
match spilling into the following call) — verified by reading both sites. **No FF-1 mismatch.** That
corroborates backend's "no fourth instance" conclusion. On its known blind spot — an action that never
calls `.rpc()` at all — I checked the FF-1 seam by hand: all three instance writers and `saveSection`
reach real RPCs, and the `p_instance_answers` entry keys the TS action emits
(`instance_id`, `answers`, `selections`, `observations`, `other_text`, `clear_item_ids`) match the six
keys `app.save_instance_answers` reads out of `prosrc`, 1:1. BUG-FF1-005's fix is coherent with the
live function.

**UX / a11y.** All user-facing strings pt-BR; `mapGroupError` translates every `HC0N*` SQLSTATE to
static copy so no Postgres text reaches the UI. Instance chrome carries position-naming labels
(*"Remover a repetição 2 de 3"*), an `<ol>`/`<li>` structure, `<section aria-labelledby>` +
`aria-describedby` per instance, `aria-hidden` on decorative icons, and a `role="status"` region — the
right call, since three identical icon buttons per row are otherwise indistinguishable. Cardinality
copy is about repetitions (*"Adicione ao menos mais 1 repetição preenchida"*), never
*"campo obrigatório"*, exactly as ruling 3 requires.

**Bug Log.** All five FF-1 bugs re-verified as genuinely fixed against the live catalog + source; the
three sharing the "server action does not reach a correct RPC" root cause are closed with real fixes,
not spec edits. The spec's two remaining RPC bypasses are documented, justified (client-unreachable by
construction), and were re-verified live by `tester`.

---

## 9. What must change to reach APPROVED

| # | Sev | Change |
|---|-----|--------|
| 1 | **P0** | Fix the `answer_selected_options` copy in **`supersede_response`** and **`start_correction_draft`** — route the join through the `old_id → new_id` instance map instead of `new_a.group_instance_id is not distinct from old_a.group_instance_id`. Extend §K with a **choice** child and assert selection parity per instance; revert the fix and require red. Fix INFO-1's comment in the same pass. |
| 2 | **MAJOR** | Make H1 discriminating so **m4**, **m4b** and **m6** each go red: take the savepoint at a state where the hidden group / hidden required item *would* block, and add a submit-side hidden-repeating-group assertion. |
| 3 | **MAJOR** | Re-target J1 at a persona satisfying `app.is_commission_admin_of` (who *can* `SELECT` the foreign draft) so dropping `created_by = auth.uid()` makes it red. |
| 4 | MINOR | Add `HC0N5` + a negative-agreement assertion so `completeness_authorities_agree` bites in the blocking direction (m3 must go red). |
| 5 | MINOR | Correct the header's MUTATION F3 (the guard is BE-1's `DEFERRABLE` alter) and either add an F5 for `remove_group_instance`'s re-pack or drop the claim. |

INFO-2…INFO-5 are non-blocking; INFO-5 (the enable migration) and the `docs/backend-state.md`
`HC098 → HC0N5` correction are Record-step items for the lead.

---

*Read-only review. No application code, migration, spec or query was modified. The shared local stack
was restored (constraint, both policies and all four mutated function bodies verified back in
`pg_catalog`) and `pgtap` + `test_helpers` were dropped.*
