# Phase FF-1 — Repeating Groups · QA Review

**Reviewer:** `qa` · **Branch:** `ff/flexible-forms-program`
**Audited against:** ADR [0087](../decisions/0087-ff1-repeating-groups.md) (six rulings + Amendment 1 +
§Gate keystones) · [program plan](../plans/flexible-forms-program.md) §3 FF-1 (superseded by the ADR in
six places) · ARCHITECTURE.md Rules 1–12 · CLAUDE.md §8.

| Round | Date | Commit | Verdict |
|---|---|---|---|
| **r2** | 2026-07-27 | `7e72006` | ✅ **APPROVED** |
| r1 | 2026-07-27 | `3b5d9c7` | ⛔ CHANGES REQUESTED — 1 P0 / 2 MAJOR ([record below](#r1-record--changes-requested)) |

---

# ✅ r2 VERDICT: APPROVED

**0 P0 · 0 MAJOR · 4 MINOR (non-blocking) · 6 INFO.**

All three blocking findings are fixed at `7e72006`, and I re-proved each myself rather than accepting
the reported table. Every r1 surviving mutant is now killed, each cleanly and in isolation — one
failure, no cascade, no SQL errors. The two new *arming* assertions were separately mutation-tested,
because an arming assertion that does not arm is the same vacuity one level down; both go red when
their premise is removed.

---

## r2 · 1. Method

Same evidence rules as r1: **live catalog only** (`pg_proc` incl. `prosecdef`, `pg_policies`,
`pg_constraint`, `pg_class.relacl`, `app.feature_flags.enabled`), values resolved rather than nouns,
rows asserted under `set local role` rather than predicate return values. Migration registration
verified clean first: **197 files / 197 registered** (r1 was 196/196 — one new migration,
`20260828000800`, which rewrites two function bodies and changes no schema).

pgTAP + `test_helpers` reinstalled, suite run standalone (**baseline 52/52**, up from 46), 13
mutations spliced in after `begin;` so the trailing `rollback;` undoes them. **Every mutation carries
an in-transaction `MUT-APPLIED …residual=N` probe reading the mutated object back out of the catalog**
before the suite runs — no mutation below was trusted to have applied. Survivors were confirmed by
counting `ok` / `not ok` / `ERROR` lines, not by grep alone. Stack restored and verified afterwards
(all six mutated objects back; `pgtap` + `test_helpers` dropped).

I did **not** run `e2e:prod`. The `2026-07-27e` triage stands.

---

## r2 · 2. P0-1 — RESOLVED ✅

**Fix (live catalog, both functions).** `public.supersede_response` and
`public.start_correction_draft` now resolve old→new through the instance **rows** on the preserved
`(group_item_id, position)` identity:

```sql
and new_a.group_instance_id is not distinct from (
      select ngi.id
      from public.response_group_instances ogi
      join public.response_group_instances ngi
        on ngi.response_id   = v_new.id            -- v_draft in start_correction_draft
       and ngi.group_item_id = ogi.group_item_id
       and ngi.position      = ogi.position
      where ogi.id = old_a.group_instance_id
    )
```

Verified in `pg_proc`: the new expression present in **2 of 2** functions, the unsatisfiable predicate
**0 of 2**. `NULL` in → the scalar subquery is `NULL` → `is not distinct from` still matches top-level
to top-level, so one expression covers both cases with no branch. The subquery cannot return more than
one row: `(response_id, group_item_id, parent_instance_id, position)` is `UNIQUE NULLS NOT DISTINCT`
and the depth-1 cap (ruling 1) forces `parent_instance_id IS NULL` everywhere. The migration is an
anchored body rewrite that **raises loudly** if either anchor has drifted — the right shape for this
repo.

**K4 re-proven by me.** Reverting the join in **both** functions (`old_predicate_present = 2`,
`new_predicate = 0`) reddens **K4 and only K4** — K1, K2 and K3 stay green. That reproduces the r1
finding exactly: the answers-counting keystones were structurally blind, and K4 is the assertion that
sees it. K4 is also self-arming — H3b asserts the selection exists pre-submit, written through the
**real save path** rather than inserted, so a broken arming turns K4 red rather than green.

**Extra probe beyond the suite.** K4 exercises one single-select code in one instance, which cannot
detect cross-attachment. I built a harder case live — a **top-level** `multiple_choice`, plus a
repeating group with **both** a single-select and a **checkbox** child, across **two** instances, filled
through `save_section_answers`, submitted, then `supersede_response`:

```
PREDECESSOR 0 => im,manha,oral      SUCCESSOR 0 => im,manha,oral
PREDECESSOR 1 => ev,tarde           SUCCESSOR 1 => ev,tarde
PREDECESSOR top-level => t2         SUCCESSOR top-level => t2
                                    SUCCESSOR total selection rows = 6
```

All six rows copy, each lands on the **correct** instance (no cross-attachment between siblings), and
top-level stays top-level. The fix is correct beyond what the keystone tests.

---

## r2 · 3. MAJOR-1 and MAJOR-2 — RESOLVED ✅

### The four r1 survivors are now killed

| Mutation (applied + residual-verified) | r1 | r2 |
|---|---|---|
| `rrc` flat arm: drop `and app.eval_visibility(i.visible_when, v_answers)` | ❌ 46/46 | ✅ **H1b red** (51/52, 0 errors) |
| `rrc` group arm: neutralise the hidden-group `continue` | ❌ 46/46 | ✅ **H1b red** (51/52, 0 errors) |
| `submit_response`: neutralise the hidden-container branch | ❌ 46/46 | ✅ **H1c red** (51/52, 0 errors) |
| drop `created_by = auth.uid()` from the `FOR ALL` qual | ❌ 46/46 | ✅ **J1b red** (51/52, 0 errors) |

**Both** rrc mutations redden H1b, which is the load-bearing detail: it proves H1a arms **both**
blockers independently, not one of them. The two mutations are disjoint — the first touches only the
flat arm's item predicate (so with the gate closed the group is still skipped), the second only the
group arm (so `extra` is still hidden). Each can therefore only flip H1b through its own blocker.
H1c is the coverage that did not exist at all in r1: `submit_response`'s hidden-container branch.

### The arming assertions genuinely arm

This is the check I was asked to make, and it is not redundant — H1a and J1a are exactly the shape
that can pass while establishing nothing.

- **H1a** (`not rrc` at the armed state — `extra` unanswered, all instances deleted against
  `min = 2`). Forcing `app.response_required_complete` to `return true` turns **H1a red** (along with
  H4a and H2, the suite's other negatives). So H1a is a real negative assertion, not a tautology, and
  it fails loudly if the two arming DELETEs ever stop taking effect.
- **J1a** (the org_admin reads **1** foreign-draft instance). Removing the `is_commission_admin_of`
  arm from `response_group_instances_select` turns **J1a red and only J1a** — so J1a's green depends
  specifically on the read authority it names, and J1b is then unambiguously about the write qual.
  Confirming the other direction: under the qual-widening mutation only J1b fails, J1a stays green.
- The persona is genuinely an `org_admin` of the fixture org (`claims_for(…, false)` → `is_admin`
  false; `memberships(organization_id = org_b, role = 'org_admin')`), which is the right choice —
  r1 established that a `staff_admin` reads **0** foreign instances because
  `is_commission_admin_of ≠ is_staff_admin_of`. J1a asserts **rows read** under `set local role`, not
  a predicate's return value.

`response_group_instances`'s policy pair is unchanged and still correct: the `FOR ALL` qual
(`created_by = auth.uid() AND status = 'in_progress'`) remains **strictly narrower** than the SELECT
qual, so ruling 5's reader-non-writer argument continues to hold — but it is now *tested* rather than
merely argued.

---

## r2 · 4. Regression sweep — the r1-proven keystones survived the rework

The §K fixture gained a `multiple_choice` child and every position after it shifted, so I re-ran the
r1 red-provers against the new fixture rather than assuming:

| Mutation | Result |
|---|---|
| drop `form_items_no_nested_container` (ruling 1) | ✅ A2 red |
| neutralise the outside-in ban in `validate_visible_when` (ruling 2) | ✅ E2, E5 red; positives E1/E3 stay green |
| flat-arm predicate → literal `parent_item_id IS NULL` (Amendment 1.2) | ✅ H2 red |
| `app.answer_map_scoped`: drop the instance filter (substrate 5) | ✅ G1b, I3, K3, M2 red |
| `submit_response`: remove the empty-instance prune (ruling 3) | ✅ I1, I2, I4 red |

Also re-verified in the live catalog: `app.assert_item_bounds` carries `p_group_instance_id` and
scopes **both** of its lookups with `a.group_instance_id is not distinct from p_group_instance_id` —
Amendment 1.3's second half, correct.

**BE-8 (deferred in r1, checked now).** The dashboard explode is covered discriminatingly by E2E
FF1-8: a 3-instance denominator yielding 2/67% + 1/33%, plus a `≤ 100%` bound over every rendered
share — which is exactly what would have caught the pre-fix 300%. Supersession-tolerance is inherited
from `app.submitted_form_responses` and pinned by L1a/L1b, which assert the *set*, not a count.

---

## r2 · 5. Gate status

`npm run lint` **0 errors / 0 warnings** · `npm run typecheck` **clean** · `npx vitest run`
**490/490 across 37 files**. `src/lib/types/database.ts` is untouched by `7e72006`, consistent with
"function bodies only". Backend's reported full ordered `supabase test db` (136 files / 3925 tests
PASS on a fresh reset) is consistent with my standalone 52/52 on `270_ff1_repeating_groups.sql`.

### ADR 0087 §Gate keystones — final state

| Keystone | Can fail |
|---|---|
| `nesting_depth_capped` | ✅ re-proven |
| `condition_outside_in_rejected` | ✅ re-proven (3 negatives + 2 positives) |
| `condition_parity_vectors_instances` | ✅ 21/21 SQL↔JSON payloads byte-equal (verified mechanically in r1) |
| `completeness_deadlock_negative_groups` | ✅ **fixed** — H1a/H1b (rrc) + H1c (submit) |
| `empty_instance_pruned_at_submit` | ✅ re-proven |
| `conditional_required_honoured` (top level **and** per-instance) | ✅ **fixed** — H1b covers top level in `rrc`; H3 covers per-instance; E2E FF1-5 covers `submit_response` |
| `group_instances_post_submit_immutable` | ✅ |
| `group_instances_cross_user_denied` | ✅ **fixed** — J1a arms, J1b bites |
| `plain_group_child_required_blocks` | ✅ re-proven |
| `correction_copies_group_instances` | ✅ **fixed** — K4 by value |
| `completeness_authorities_agree` | ⚠ one-directional in pgTAP — MINOR-1, E2E carries the blocking direction |
| `supersession_group_answers_excluded` | ✅ |
| E2E wizard lifecycle + keyboard pass | ✅ FF1-1…FF1-9, 9/9 prod build |

---

## r2 · 6. Carried-forward and new findings — none blocking

- **MINOR-1 (unchanged) — `completeness_authorities_agree` is still one-directional in pgTAP.**
  Re-tested at `7e72006`: neutralising *every* blocking arm of `submit_response` (both `HC011` raises
  and the `HC0N5` minInstances raise) still leaves the suite at **52/52**. H1c does not change this —
  it is a `lives_ok`, asserting submit *succeeds*. `HC0N5`'s only occurrence in `supabase/tests/` is
  inside H1c's *description string*, never a `throws_ok`. The blocking direction remains E2E-only
  (FF1-4 asserts `/exige ao menos 1 item/` **and not** `/há perguntas obrigatórias/`; FF1-5 asserts the
  per-instance `HC011`), so there is no live hole — but the fast gate cannot see a submit-side group
  blocking regression. One `throws_ok(… 'HC0N5')` at the H4a state closes it.
- **MINOR-2 (unchanged) — the header documents a keystone that does not exist.** *"MUTATION F5: drop
  the re-pack UPDATE from `remove_group_instance` → F5 red."* There is still no F5, and
  `remove_group_instance` is still never called in `supabase/tests/`. E2E covers it (FF1-3, and FF1-9
  removes position 0 of 2 so the re-pack is exercised).
- **MINOR-3 (unchanged) — MUTATION F3's named mutation is the wrong one.** Removing `set constraints …
  deferred` leaves the suite green; the real guard is BE-1's `DEFERRABLE` alter (proven both
  directions in r1: non-deferrable ⇒ the same naive swap raises `23505`). F3 *is* a keystone — for the
  alter, not for the in-function `set constraints`.
- **MINOR-4 (new; the item handed to me to rule on) — the stale comment in `supersede_response`.**
  **Ruling: MINOR, not blocking — but the defect is the asymmetry, not the sentence.**
  Rationale: it has zero functional effect; the corrected mechanism is spelled out in the comment
  **immediately below it** and in the migration header; and forcing a migration whose entire content
  is a comment rewrite adds another body-rewrite to a chain this repo already treats as a hazard
  (CLAUDE.md §graphify — migration file text is stale *because* of this pattern), which is a real cost
  for no behavioural gain. What tips it above INFO is that `start_correction_draft`'s copy is gone
  while `supersede_response`'s remains: two sibling functions now carry contradictory premises about
  the same join, and a reader who finds only one of them cannot tell which is current.
  **Disposition:** let it ride the next migration that touches those bodies rather than minting one for
  it — and that migration is coming (see INFO-6). Track it as a follow-up so it does not simply
  evaporate.
- **INFO-6 (new, forward-looking) — the same trap is already loaded for FF-2 and FF-5.**
  `answer_matrix_cells`, `answer_risk_matrix` and `answer_references` all hang off **`answer_id`**,
  exactly like `answer_selected_options`. Both correction RPCs currently copy **only**
  `answer_selected_options` (verified against `prosrc`), which is correct today — all three tables hold
  **0 rows** and are write-inert (`authenticated = r`, K9 §C). But the moment FF-2 lands matrix/risk
  answers and FF-5 lands references, each needs its own copy block routed through the **same** instance
  remap, and nothing in the repo would catch a repeat: K4 covers selections only. This is the identical
  premise-repeal shape, one phase ahead. Worth carrying into FF-2's ADR as a named requirement rather
  than rediscovering it as a second P0.
- **INFO-2 (unchanged)** — no CHECK/trigger ties `response_group_instances.group_item_id` to a
  `repeating_group` of the response's own `form_version` on the **direct-DML** path (the FK is only
  `→ form_items(id)`). The RPC path is fully gated (`assert_group_writable`, `HC0N4`); ruling 5
  deliberately leaves direct DML open, so the exposure is a user writing junk into **their own** draft —
  no cross-tenant read, no PHI. A coherence trigger belongs with FUP-FF1-1.
- **INFO-3 (unchanged)** — `src/lib/responses/actions.ts:384-390`: the `p_instance_answers` comment
  block is duplicated verbatim.
- **INFO-4 (unchanged)** — the parity vectors are hand-mirrored SQL ↔ JSON with no drift detector.
  Byte-equal today (21/21); matches the pre-existing `condition-vectors.json` convention, so not an
  FF-1 regression, but Rule 3 calls drift phase-blocking and nothing detects it.
- **INFO-5 (unchanged)** — no `…_enable_repeating_groups.sql` yet; the flag is `t` locally **only** via
  `supabase/seed.sql`. That is the planned shape (enable migration at the gate) — a Record-step item,
  together with `docs/backend-state.md`'s `HC098 → HC0N5` high-water correction.

**Rule 12 / PHI:** re-confirmed for `7e72006`. The new migration touches two function bodies and no
PHI table; FF-1 remains PHI-free end to end.

---

## r2 · 7. Note for the record

Three of this phase's five defects share one shape, and the backend engineer named it himself in the
migration header: **the code did not rot, its premise was repealed.** The
`form_items_conditional_not_required` CHECK made a live branch dead; that dead branch stayed unproven;
and Amendment 1.3 repealed the "repeating groups are inert" premise that a join two lines away depended
on. The mitigation the header proposes — *when a phase falsifies a premise, grep for the code that
assumed the old one* — is the right one, and INFO-6 is that grep run one phase forward. It would be
worth carrying into ADR 0088 as a standing pre-flight rather than leaving it in a commit message.

---
---

# r1 record — CHANGES REQUESTED

*(2026-07-27, commit `3b5d9c7`. Preserved as the record; §§2–3 below are resolved at `7e72006` and
re-verified in r2. §§4–8 remain accurate except where r2 supersedes them.)*

**1 P0 · 2 MAJOR · 3 MINOR · 5 INFO.**

The engine is good work. The instance model, the two-tier overlay, the dispatch-by-`item_type`
refactor, the publish-time condition gate and the INVOKER/RLS posture are all correct in the **live
catalog**, and most of the suite's keystones are genuinely mutation-capable — I re-ran 16 mutations
myself and 11 went red exactly as documented.

It failed the gate on two counts:

1. **P0-1** — a **live, silent data-loss defect** that FF-1 activates: correcting a submitted response
   drops every *choice* answer inside a repeating group. Proven live, on both correction authorities,
   with both correction flags `enabled = true`.
2. **MAJOR-1/-2** — three of the ADR's own §Gate keystones **cannot fail**. ADR 0087 ruling 4 makes
   mutation-provenness an explicit acceptance condition of the CHECK-drop widening ("A keystone that
   cannot fail is not a keystone"). For the widening's headline guard — *visibility wins* — that
   condition was **not met**.

## r1 · 1. Method

Per CLAUDE.md §graphify and the ADR-0078 scars, **every** schema / RLS / RPC / authorization claim
below was resolved from the **live catalog** on `supabase_db_azkbbhskturikxpgmafq`. No claim rests on
migration text. Migration registration was verified clean first: **196 files / 196 registered**.

Mutation harness: pgTAP + `test_helpers` installed, `270_ff1_repeating_groups.sql` run standalone
(baseline **46/46**), each mutation spliced in after `begin;` so the trailing `rollback;` undoes the
DDL. Every mutation carried an in-transaction residual probe read back out of the catalog. Surviving
mutants were re-verified by counting `ok` / `not ok` / `ERROR` lines. Stack restored afterwards.

## r1 · 2. P0-1 — correcting a response silently destroys every choice answer inside a repeating group

*(RESOLVED at `7e72006` — see r2 §2.)*

**Where.** `public.supersede_response` and `public.start_correction_draft` — identical code:

```sql
join public.answers new_a
  on new_a.response_id = v_new.id
 and new_a.item_id     = old_a.item_id
 and new_a.group_instance_id is not distinct from old_a.group_instance_id   -- ← never true
```

**Why it was wrong.** Amendment 1.3 (correctly) gives the successor its **own** instance rows and
**remaps** the copied `answers.group_instance_id`. That is precisely what makes this predicate
unsatisfiable: the two sides hold different ids. Top-level answers were unaffected
(`NULL is not distinct from NULL`), so the defect was invisible outside repeating groups.

**Proven live:**

```
PROBE pre-submit instance selections   = 2
PROBE successor instances              = 2   ← Amendment 1.3's half works
PROBE successor instance ANSWERS       = 2   ← …and the answers are remapped
PROBE successor instance SELECTIONS    = 0   ← every selection is gone
```

**Blast radius.** `case_corrections = t`, `response_correction = t` (values read, not descriptions).
A corrector would get a draft with its repetitions silently blanked; if the child is `required`, the
correction then blocks with *"há perguntas obrigatórias sem resposta"* pointing at a field the user
never emptied; if not, the corrected record silently differs from the original.

**Why the keystone missed it.** `correction_copies_group_instances` (K1/K2/K3) counted rows in
`answers` only, and the fixture used `short_text` children exclusively, so no selection ever existed.

## r1 · 3. MAJOR findings

*(Both RESOLVED at `7e72006` — see r2 §3.)*

### MAJOR-1 — `completeness_deadlock_negative_groups` and the top-level half of `conditional_required_honoured` cannot fail

| # | Mutation (applied + residual-verified) | Expected red | Actual |
|---|---|---|---|
| m4 | `rrc` flat arm: drop `and app.eval_visibility(i.visible_when, v_answers)` | H1 | **46/46 GREEN** |
| m4b | `rrc` group arm: neutralise the hidden-group skip | H1 | **46/46 GREEN** |
| m6 | `submit_response`: neutralise the hidden-container branch | — | **46/46 GREEN** |

**Root cause:** H1's savepoint state satisfied everything independently of visibility — two non-empty
instances against `minInstances = 2`, and `extra` answered. **The branch was real:** on a minimal form
with the conditional item **unanswered**, `rrc` returned `true` unmutated and `false` under m4. And
`app.response_required_complete` is a live authority — called by `list_signoff_queue`,
`save_section_answers` and `compute_due_notifications`.

*(Positive controls: m4c → H3 red; m4d — `rrc` forced to `return true` — → H4a + H2 red.)*

### MAJOR-2 — `group_instances_cross_user_denied` (J1) does not test the clause it names

Dropping `created_by = auth.uid()` from the `FOR ALL` qual left the suite **46/46 green**. J1 refused
the write on **`responses` RLS** — `st_x2` is an ordinary member and `responses_select` hides the
foreign draft — not on the clause it claimed to guard. The shipped policy was correct; the keystone
was not.

## r1 · 4. Security / RLS review

### Ruling 5's posture — independently verified, and it holds

Read out of `pg_policies`:

```
response_group_instances_select      SELECT : created_by = auth.uid()
                                              OR is_commission_admin_of(commission_id)
                                              OR (status = 'submitted' AND is_staff_admin_of(commission_id))
response_group_instances_write_own_draft ALL : created_by = auth.uid() AND status = 'in_progress'
                                              (identical USING and WITH CHECK)
```

- **Reads:** the `FOR ALL` policy **is** a read policy (permissive union). Its qual implies the SELECT
  policy's first disjunct, so it is **strictly narrower** — the union is exactly the SELECT qual. No
  read over-grant.
- **Writes:** governed by the `FOR ALL` policy alone, whose qual contains `created_by = auth.uid()`
  literally. Writes ⊆ own in-progress drafts.
- **ADR-0079 reader-non-writer genuinely does not apply.** That rule targets a `FOR ALL` qual *broader*
  than the intended read set; here the inclusion runs the other way.
- **Live assertion, not predicate-reading:** under `set local role authenticated` a commission
  `staff_admin` reads **0** instances of another member's draft; INSERT → `42501`, UPDATE → 0 rows,
  DELETE → 0 rows.
- `prosecdef` sweep: all three writers **and** their shared gate `app.assert_group_writable` are
  **INVOKER** — no DEFINER quietly replaces RLS on the write path. ACL `authenticated=arwdDxtm`,
  matching the `answers` fill-path convention.
- Post-submit immutability is doubly locked: `guard_submitted_group_instances_trg` **and** the RLS
  qual's `status = 'in_progress'`. I4 red-proves the trigger.
- The sign-off DEFINER door `get_response_for_signoff` builds its payload — including the new
  `instances` key — only **after** three gates. FF-1 adds no new reach.
- `assert_group_writable` pins `i.form_version_id = v_version` and `item_type = 'repeating_group'`
  (`HC0N4`), so the RPC path cannot bind an instance to a foreign or non-repeating item.

### Rule 12 / PHI — clean ✅

No migration references `event_patient`, `referral_patient`, `patient_identifiers` or
`patient_participants`; the diff's only matches are documentation prose. No new PHI column, no change
to a PHI door, no audit-payload change. `SUPABASE_SERVICE_ROLE_KEY` appears only in
`src/lib/supabase/admin.ts` (server-only, untouched).

### Other invariants

- **Rule 1** — RLS is the boundary; the actions' `authorizeMember` pre-check is documented as *copy
  quality*, never the authority.
- **Rule 5** — `app.validate_group_layout` is a **publish-time** gate (correct: a draft mid-edit
  legitimately passes through non-contiguous states), red-proven by D2 and D3.
- **Rule 7** — display children render through the existing sanitized-Markdown path; no new HTML sink.
- **Rule 11** — no per-instance audit trigger, consistent with the fill path's response-level
  `audit_responses_trg`; ruling 5 tracks the coherent hardening as FUP-FF1-1.

## r1 · 5. Mutation proofs re-run in r1

Baseline reproduced standalone: **46/46**.

| # | Deliv. | Mutation | Result |
|---|---|---|---|
| m1 | BE-1 | drop `form_items_no_nested_container` | ✅ A2 red |
| m2 | BE-6 | neutralise BOTH outside-in raises in `validate_visible_when` | ✅ E2, E4, E5 red — E1/E3 stay green |
| m3 | BE-5 | `submit_response`: neutralise both `HC011` arms **and** `HC0N5` | ⚠ survives — MINOR-1 |
| m4 | BE-5 | `rrc` flat arm: drop item visibility-wins | ❌ survives — MAJOR-1 |
| m4b | BE-5 | `rrc` group arm: drop the hidden-group skip | ❌ survives — MAJOR-1 |
| m4c | BE-5 | `rrc` group arm: drop per-instance child visibility | ✅ H3 red |
| m4d | BE-5 | `rrc` → `return true` (positive control) | ✅ H4a, H2 red |
| m5 | Amdt 1.2 | flat arm predicate → literal `parent_item_id IS NULL` | ✅ H2 red |
| m6 | BE-5 | `submit_response`: neutralise the hidden-container branch | ❌ survives — MAJOR-1 |
| m7 | BE-2 | `app.answer_map_scoped`: drop the instance filter | ✅ G1b, I3, K3, M2 red |
| m8 | BE-3/RLS | drop `created_by = auth.uid()` from the `FOR ALL` qual | ❌ survives — MAJOR-2 |
| m9 | BE-3 | `add_group_instance`: drop the `maxInstances` branch | ✅ F2 red |
| m10 | BE-3 | `reorder_group_instances`: remove `set constraints … deferred` | ⚠ survives — MINOR-3 |
| m11 | BE-3 | `reorder_group_instances`: permutation → subset check | ✅ F4 red |
| m12 | BE-4 | `save_section_answers`: restore the unscoped `p_clear_item_ids` delete | ✅ G2, G2b, H3, I1, I2 red |
| m13 | BE-5 | `submit_response`: remove the empty-instance prune | ✅ I1, I2, I4 red |
| m14 | Amdt 1.3 | `supersede_response`: remove the instance-copy CTE | ✅ hard red (`23505` at §K) |
| m15 | BE-4 | `app.answer_map_by_item_scoped`: drop the instance filter | ✅ M3 red |

Three live probes: the P0-1 selections probe; the visibility-wins probe (`rrc` true → false under m4);
and the reorder-collision probe (a naive single-statement swap **succeeds** while the constraint is
`DEFERRABLE`, and raises `23505` once it is not — so BE-1's alter is the real guard).

## r1 · 6. Requirements coverage

### ADR 0087 rulings

| Ruling | Implemented (live catalog) | Tested | Test can fail (r1) |
|---|---|---|---|
| **1** depth-1 cap in the schema | ✅ two independent objects — `form_items_no_nested_container` CHECK **and** composite FK `(parent_item_id, form_version_id, parent_is_container)` | ✅ A1/A2/A3 | ✅ m1 |
| **2** inside-out resolves, outside-in forbidden at publish | ✅ item arm + section arm; `rg.item_type = 'repeating_group'` keeps plain-group children legal; pt-BR `check_violation` | ✅ E1–E5 | ✅ m2 |
| **3** empty instance is not there | ✅ `submit_response` prunes → re-packs → checks; `rrc` skips via the shared `app.instance_is_empty` | ✅ H3/H4a/H4b/I2 + E2E FF1-4 | ✅ m13 |
| **4** drop `form_items_conditional_not_required` globally | ✅ constraint absent; branch present in both authorities | ⚠ | ❌ MAJOR-1 |
| **5** INVOKER writers, RLS is the boundary | ✅ verified independently | ⚠ | ❌ MAJOR-2 |
| **6** both containers; `group` is purely visual | ✅ flat-arm predicate `parent_item_id IS NULL OR p.item_type = 'group'` | ✅ E3, H2, E2E FF1-6 | ✅ m5 |

### Amendment 1

| # | Status (r1) |
|---|---|
| 1.1 SQLSTATE lane | ✅ `HC0N0`–`HC0N5` in use, above the `HC0M9` water line; TS constants mirror them. |
| 1.2 flat-arm predicate | ✅ correct predicate live; H2 red-proven by m5. |
| 1.3 correction copies instances | ⚠ half delivered — instance rows + answer remap ✅ (m14 hard-red); **selections ✗ — P0-1**. |

## r1 · 7. MINOR / INFO (r1 wording)

- **MINOR-1** — `completeness_authorities_agree` is one-directional in pgTAP; m3 survives. The
  blocking direction lives solely in E2E. `HC0N5` has zero `throws_ok` coverage.
- **MINOR-2** — the header documents MUTATION F5 for a keystone that does not exist;
  `remove_group_instance` is never called in `supabase/tests/` (E2E covers it).
- **MINOR-3** — MUTATION F3's named mutation is the wrong one; the guard is BE-1's `DEFERRABLE` alter.
- **INFO-1** — stale comment in both correction RPCs: *"…while repeating groups are inert"*.
  *(r2: removed from `start_correction_draft`; retained in `supersede_response` → MINOR-4.)*
- **INFO-2** — no CHECK/trigger ties `response_group_instances.group_item_id` to a `repeating_group` of
  the response's own version on the **direct-DML** path.
- **INFO-3** — `src/lib/responses/actions.ts:384-390`: duplicated comment block.
- **INFO-4** — parity vectors hand-mirrored SQL ↔ JSON with no drift detector (byte-equal today).
- **INFO-5** — no enable migration yet; the flag is `t` locally only via `supabase/seed.sql`.

## r1 · 8. Code quality — clean

`npm run lint` **0/0** · `npm run typecheck` clean · `npx vitest run` **490/490 across 37 files**. No
`any` introduced anywhere in the FF-1 diff. Data access flows through `src/lib/queries/`; the wizard
never inlines supabase-js. New read-only renderers are Server Components; `"use client"` only where
interaction requires it. `buildGroupInstances` is wired into all three read doors — no `instances: []`
placeholder survives.

**`.rpc()` sweep spot-check (independent).** I re-derived the sweep: **385** `.rpc('name', {…})` sites
extracted from `src/`, each argument set cross-checked against `pg_proc.proargnames`. **Two** flagged,
**both artifacts of my own extractor**, verified by reading the sites. **No FF-1 mismatch** —
corroborating backend's "no fourth instance". On its known blind spot (an action that never calls
`.rpc()`), I checked the FF-1 seam by hand: all three instance writers and `saveSection` reach real
RPCs, and the `p_instance_answers` entry keys the TS action emits (`instance_id`, `answers`,
`selections`, `observations`, `other_text`, `clear_item_ids`) match the six keys
`app.save_instance_answers` reads out of `prosrc`, 1:1.

**UX / a11y.** All user-facing strings pt-BR; `mapGroupError` translates every `HC0N*` SQLSTATE to
static copy so no Postgres text reaches the UI. Instance chrome carries position-naming labels
(*"Remover a repetição 2 de 3"*), an `<ol>`/`<li>` structure, `<section aria-labelledby>` +
`aria-describedby` per instance, `aria-hidden` on decorative icons, and a `role="status"` region.
Cardinality copy is about repetitions (*"Adicione ao menos mais 1 repetição preenchida"*), never
*"campo obrigatório"*, exactly as ruling 3 requires.

**Bug Log.** All five FF-1 bugs re-verified as genuinely fixed against the live catalog + source. The
spec's two remaining RPC bypasses are documented, justified (client-unreachable by construction), and
were re-verified live by `tester`.

---

*Read-only review, both rounds. No application code, migration, spec or query was modified. The shared
local stack was restored after each round (constraint, both policies and every mutated function body
verified back in `pg_catalog`) and `pgtap` + `test_helpers` were dropped.*
