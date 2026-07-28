# FF-2 — Matrix & Risk Matrix · QA Review, Round 2

**Phase:** FF-2 (ADR [0089](../decisions/0089-ff2-matrix-risk-matrix.md)) · **Reviewed range:** `bdcd023..a8891a1`
(3 commits) · **Branch:** `ff/flexible-forms-program` · **Reviewer:** `qa` · **Date:** 2026-07-27 · **Round:** 2
· **Round 1:** [ff-2-review.md](ff-2-review.md) (⛔ CHANGES REQUESTED)

## Verdict

# ✅ APPROVED

**0 BLOCKING · 0 MAJOR · 1 pre-commit condition (tree state, not code) · 5 MINOR + 2 INFO carried from r1.**

All three r1 blockers are fixed and **verified by re-running my own r1 probes**, which now pass.
All six mutation proofs `backend` claims are real — **I re-ran every one** — and I added **four more**
that were not claimed, including the two halves the lead specifically asked me not to take on faith.
The sweep table in `a8891a1` is **accurate against `pg_policies` / `pg_proc`**, including both
"deliberately absent" entries. Full pgTAP on the committed tree: **4050 ok / 0 not ok** across all
138 files, run file-by-file by me.

The one condition below is about the **working tree**, not the phase: it now carries an uncommitted,
unreviewed migration that widens three authorization policies. That must be resolved before the
phase is committed, but it is not a defect in FF-2.

---

## 1. The three r1 blockers — closed, verified by the r1 probes themselves

I did not re-read the fixes and agree with them. I re-ran the exact probes that produced the r1
findings, unchanged, against the fixed code.

| r1 finding | r1 result | r2 result |
|---|---|---|
| **B-1** targeted respondent cannot save a matrix cell | `T4` red — `42501` at `assert_matrix_answer_writable` line 18; `T5` `have: 0` | **`T4` + `T5` green** — the cell saves and persists |
| **B-2** corrector reads 0 predecessor cells | `X2` `have: 0 want: 4`, `X3` `have: 0 want: 1` | **`X1`/`X2`/`X3` all green** — 4 cells + 1 risk row |
| **B-3** no gate-flip migration | flag ON only via `seed.sql` | **fixed — and proven independent of the seed** (below) |

> `probe_targeted_matrix.sql` still reports one red: `T3`, my own throwaway shape probe, labelled
> *"(shape probe, ignore)"* in r1 and red then too. It asserts nothing about the product.

**B-3, verified rather than read.** Migration text is stale by design in this repo, so I proved the
flip comes from the migration and not the seed: set `matrix_fields = false` directly, replayed
**only** `20260830001200_enable_matrix_fields.sql` (no seed), and read the flag back —
`after migration: true`. `20260830001200/001300/001400` are all registered. Production `db push`
will now enable FF-2.

**Live catalog matches the migration text** for all four rewritten policies and for
`app.assert_matrix_answer_writable` — checked against `pg_policies` / `pg_proc`, not the diff.

**K9 survived the second round of policy edits.** All four matrix tables: `authenticated` still has
**SELECT only**, no `anon` grant, `relrowsecurity = t`. §S1–S4 assert this rather than argue it,
which is the right instinct for a phase that has now touched these policies twice.

---

## 2. Mutation proofs — all six re-run, plus four of mine

Method as in r1: revert the fix **in the live catalog**, re-run, require red, restore, require green.
Baseline before each: `271` **90/90**, `272` **27/27**.

### The six claimed

| # | Revert I applied | Observed | Verdict |
|---|---|---|---|
| **M1** | `if app.can_write_targeted_response(...) then return;` deleted from `app.assert_matrix_answer_writable` | **O2 + O3 red**, O1 control green | ✅ |
| **M2** | targeted arm dropped from `form_matrix_rows_select` **only** | **O3 red** | ✅ |
| **M2b** | targeted arm dropped from `form_matrix_columns_select` **only** | **O3 red** | ✅ |
| **M3** | `can_read_correction_response` dropped from `answer_matrix_cells_select` | **P2 red** (+ R6 collateral, same read), P1 control green | ✅ |
| **M3b** | …and from `answer_risk_matrix_select` | **P3 red** | ✅ |
| **M4** | both per-instance arms → the pre-FF-2 inlined value/selection test | **Q3 + Q4 red; Q1/Q2 green** | ✅ |
| **M5** | `answer_matrix_cells` copy block deleted from `start_correction_draft` | **R2 + R3 + R4 red** | ✅ |
| **M5b** | `answer_risk_matrix` copy block deleted from the same RPC | **R5 red** | ✅ |

**On M2 — confirmed, and this is the important one.** The lead asked me to verify that *both halves
are individually load-bearing* rather than believe it. They are: reverting **either** axis policy
alone turns O3 red, independently. §O3's join reads through `form_matrix_rows` **and**
`form_matrix_columns`, so neither half can hide behind the other. The self-correction recorded in
`a8891a1` — *"M2's first run stayed GREEN … the keystone was proving the assertion, not the fix"* —
is exactly right, and catching it inside the phase rather than at review is the standard this repo
has been reaching for.

### The four I added

| # | Revert | Observed | What it proves |
|---|---|---|---|
| **M2c** | `can_access_targeted_response` dropped from `answer_matrix_cells_select` | **O3 red** | the round trip needs the *answer*-side targeted arm too, not just the two axis policies — a third half, also load-bearing |
| **M4b** | `app.item_required_satisfied` body → `select true` | **Q1 + Q2 red** | **§Q is bidirectional.** M4 alone only proves the positive direction; without this, a predicate hard-wired to `true` would pass Q3/Q4 unnoticed |
| **M6** | ARM-1's ownership test deleted from `app.assert_matrix_answer_writable` | **O5 red** | the widening is genuinely **bounded** — O5 is not resting on the `responses` policy that already stops O4 |
| **§J** | both matrix arms deleted from `app.instance_is_empty` | **6 red** (J1/J4/J5 + K4/K5/K6) | r1's proofs still hold after the r2 policy rewrites |

**On M4 — confirmed, and the lead's reading is right.** Reverting both per-instance arms turns
**Q3/Q4 red and leaves Q1/Q2 green**: the reverted test reports a matrix as unanswered *always*, so
"blocks when incomplete" still passes for the wrong reason. A keystone written only in the blocking
direction would have been vacuous here. **But that also means M4 alone does not prove Q1/Q2 are
load-bearing** — which is why I ran M4b. Both directions are now independently proven. §Q6 pins that
the hidden repeating group's matrix child really is `required = true`, closing the deadlock-negative
arm §G never covered.

**One structural note on `272`, not a defect.** A failure in §Q aborts the transaction, so §P/§R
never execute (visible in the M4 run: `ok=11` with 31 downstream `transaction is aborted`). That is
normal pgTAP behaviour, but it means a red §Q *masks* §P/§R rather than adding to them. Worth knowing
when triaging a future failure; not worth restructuring the file for.

---

## 3. The sweep table — verified independently, and it is accurate

Read from `pg_policies` / `pg_proc`, not from `a8891a1`. Every row checks out.

**Policies.** One query over the whole form→answer chain confirms the arm matrix exactly as recorded:
`form_versions` / `form_sections` / `form_items` each carry a separate `_select_targeted` policy;
`form_matrix_rows` / `form_matrix_columns` now carry the arm inline; both matrix answer tables carry
**both** arms. The three "reported, not fixed" rows are also exactly as stated —
`form_item_options_select`, both `answer_selected_options` policies, and `answer_references_select`
(missing **both** arms, correctly deferred as the binding FF-5 obligation).

**The two "deliberately absent" door entries are correct**, and I checked them the way a wrong one
would be indistinguishable from an oversight:

- `app.matrix_cells_by_item` / `app.risk_matrix_by_item` — a `prosrc` sweep for callers returns
  **exactly one**: `public.get_response_for_signoff`, which is itself gated (exists + `in_progress`,
  then coordinator/commission-admin/`view_signoffs`, then a pending sign-off section). No door needed. ✅
- `app.item_required_satisfied` / `app.instance_is_empty` — callers are
  `app.response_required_complete` and `public.submit_response` only; `app` is not in
  `config.toml`'s exposed `schemas`. ✅

  > **One precision point (INFO).** The recorded justification — *"read-only booleans … conferring no
  > authority"* — is the weaker half of the argument. Both are `prosecdef = true`, take an arbitrary
  > `p_response_id`, and carry the **default** ACL (`PUBLIC EXECUTE`); a caller who could reach them
  > would have a completeness oracle over *any* response. What actually makes that unreachable is
  > that `app` is not PostgREST-exposed — which is the platform-wide posture and is fine. I would
  > phrase the table entry as "unreachable: `app` is not exposed" rather than "confers no authority",
  > so a future phase that adds a `public` wrapper does not read this row as a blanket clearance.

**The fourth gap was real and the review missed it.** `form_matrix_rows` / `form_matrix_columns`
lacked `can_access_targeted_version` while `form_versions` / `form_sections` / `form_items` all
carried it. B-1's fix alone would have let the respondent write a cell into a grid they cannot render.
I stated B-1 as a write-side finding and B-2 as a read-side finding and **neither pointed at the axis
tables** — the systematic sweep found what the two findings, taken literally, did not. That is the
right lesson from this round and it belongs in the phase record, where it now is: *a fix that
satisfies the finding exactly can still leave the user unable to use the feature.* §O3 asserting the
**round trip** rather than the write is what surfaced it, and every new keystone in `273` follows
that shape.

---

## 4. Full pgTAP, run by me

I ran **every** file in `supabase/tests/` individually against a clean reset:

```
=== TOTAL ok=4050  not_ok=8 ===
FAIL 273_eth_targeted_choice_lane.sql not_ok=8      ← UNCOMMITTED; see §5
```

On the **committed** tree (`a8891a1`, 215 migrations) that is **4050 ok / 0 not ok**. Suites most
exposed to a SELECT-policy widening are green, including the one that matters most:
**`255_ethics_e2_targeted` 26/26** — its "reaches nothing else" block is the over-grant twin for
exactly this widening, and it still proves the targeted respondent reads zero rows of
`cases` / `case_participants` / `ethics_*` / `case_decisions` / `case_votes`. Also green:
`271` 90/90 · `272` 27/27 · `270` 52/52 · `264` 39/39 · `209` 40/40 · `51` 11/11.

My four r1 probes are green against the fixed code (`probe_correction_read` 3/3,
`probe_required_instance` 7/7, `probe_scd_matrix` 6/6, `probe_targeted_matrix` 5/6 with the
labelled throwaway).

---

## 5. ⚠ PRE-COMMIT CONDITION — the working tree is not the tree I was given

**Not a defect in FF-2, and not a reason to withhold approval of the phase — but it must be resolved
before the phase is committed, and before the human-approval summary is written.**

The brief said `215 == 215`. As of this review the worktree holds **216 migration files** and two
**untracked** files:

```
?? supabase/migrations/20260830001500_eth_targeted_choice_lane.sql
?? supabase/tests/273_eth_targeted_choice_lane.sql
```

`20260830001500` was **not applied** when I began, so `registered(215) != files(216)` and `273` ran
**8/14 red** — the drift shape the repo's own rule warns about, and the reason my full-suite run
above shows a failure that does not exist in the committed phase.

Three things the lead needs:

1. **It is real work and it is sound.** I applied `001500` temporarily and re-ran: `273` goes
   **14/14**, with **no regression** in `255` (26/26) or `272` (27/27). It creates five policies —
   `form_item_options_select_targeted`, `answer_selected_options_select_targeted` /
   `_write_targeted`, `response_group_instances_select_targeted` / `_write_targeted` — and modifies
   `app.assert_group_writable`.
2. **It covers a gap the brief did not mention.** The lead's message named two pre-existing gaps
   (`form_item_options`, `answer_selected_options`). I independently found a **third** —
   `response_group_instances` carries the targeted arm on **neither** its SELECT nor its write
   policy, so a targeted respondent cannot create or read a repeating-group instance. `001500`
   fixes it too. Worth noting because it bounds a claim: **B-1's fix makes a targeted respondent
   able to fill a matrix at *top level*.** A matrix inside a repeating group stays unfillable for
   that persona until `001500` (or its successor) lands — for FF-1's reason, not FF-2's.
3. **It contains unreviewed authorization widenings.** Two of the five are `FOR ALL` **write**
   policies. Nothing in `bdcd023..a8891a1` includes them and I did not review them as part of this
   verdict. Committing the phase with these files present would sweep unreviewed authz into a
   `phase(FF-2): complete` commit; leaving them untracked means the next `db reset` in this worktree
   produces a schema the FF-2 gate never ran against — which is what happened to me.

**Asked for, before commit:** either stash/move `001500` + `273` out of the phase commit and re-run
the gate at 215, or commit them as their own out-of-phase change **and send them back through
review** (they are ETH·E2 / FF-1 tables and deserve the same treatment BUG-FF1-006/007 got). Please
also state which, in PROGRESS.md, so the next reader knows why `216 != 215`.

> **Stack state.** I reset the DB twice. It is currently at **216 registered == 216 files**,
> `max = 20260830001500` — i.e. it **includes the untracked migration**, because a reset applies
> whatever is on disk. Every mutation proof in §2 was run *before* that, against the committed
> 215 state. `pgtap` was installed for the standalone loop and is gone after the final reset —
> regenerate `database.ts` only from a post-reset state.

---

## 6. Carried from r1 — non-blocking, none addressed (correctly)

The lead dispatched the three blockers and the two coverage gaps only. These stand as follow-ups:

| id | Item | Status |
|---|---|---|
| **m-1** | `dashboard_matrix_cells` / `_risk_scores` gate on `app.is_admin()`, so a **platform_admin reads commission response aggregates** (re-verified live this round: `have: 1 want: 0`, while the raw table read stays 0). Pre-existing pattern in 2 of 5 sibling dashboard RPCs; 3 use `is_commission_admin_of`. Noun-rule tension (ADR 0078 A35). | open — **lead's ruling still owed**; the sweep table records it as "match" against `dashboard_distributions`, which is true but is a match to the wider of two in-repo precedents |
| **m-2** | `ARCHITECTURE.md:50-56` still calls `matrix`/`risk_matrix` *"F3-reserved inert … forced `required = false`"* — contradicted by this phase | open |
| **m-3** | `271`'s file header still says `supersession_matrix_excluded` *"is NOT here"*; §M is at line 939 | open |
| **m-4** | `answer-summary.tsx:77-91` returns a `<div>` into a `<dl>` on three read surfaces | open |
| **m-5** | `matrix-axes-editor.tsx:150` announces a fresh weight field as `aria-invalid` before any input | open |
| **i-1 / i-2** | `<fieldset>` helper text not linked via `aria-describedby`; dead `if (item.questionExplanation) {}` in `block-card.tsx:525` | open |

Plus, new this round: **i-3**, the "deliberately absent" wording in the sweep table (§3 above).

None of these blocks the phase. **m-1 and m-2 should not reach the pilot unresolved** — m-1 because
it is an authorization posture question that only gets harder to change once dashboards are in use,
m-2 because ARCHITECTURE.md is the binding doc and is now wrong about a shipped feature.

---

## 7. Closing assessment

Three findings I raised in r1 came back fixed, mutation-proven, and with a fourth gap the fixes
themselves exposed. The two coverage gaps came back as keystones that go red when I revert the fix
and stay green otherwise — and one of them (§Q) is red in a direction I had not fully specified,
which `backend` found and documented rather than papered over. The two self-corrections recorded in
`a8891a1` — *a mutation that reverts only part of a fix is as vacuous as a keystone that cannot
fail*, and *M4 is only visible in the positive direction* — are both generalisable, both verified by
me, and both worth carrying into FF-3 and FF-5.

**The phase is approved.** Resolve §5 before committing it.

## Re-review contract (none required)

No round 3. If §5 is resolved by committing `001500` + `273` as an out-of-phase change, that change
needs its own review — it carries two `FOR ALL` write policies — but it does not reopen FF-2.
