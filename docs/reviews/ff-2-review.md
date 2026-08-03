# FF-2 — Matrix & Risk Matrix · QA Review

**Phase:** FF-2 (ADR [0089](../decisions/0089-ff2-matrix-risk-matrix.md)) · **Range:** `b656ad4..ae2886b`
(22 commits, 96 files) · **Branch:** `ff/flexible-forms-program` · **Reviewer:** `qa` · **Date:** 2026-07-27 · **Round:** 1

## Verdict

# ⛔ CHANGES REQUESTED

**3 BLOCKING · 2 MAJOR (coverage) · 5 MINOR · 2 INFO.**

Two of the blockers are **live-proven defects**, not review opinions: a targeted respondent
cannot save a matrix answer at all, and a designated corrector reads every predecessor grid
as blank. Both fail closed, both are invisible to the entire committed suite, and both are the
same structural class — **FF-2's new doors did not inherit the two OR-arms that the sibling
answer path already carries**. The third blocker is a missing ADR-declared deliverable
(the `matrix_fields` gate-flip migration) without which the whole phase is dark in production.

Everything the lead asked me to re-prove, I re-proved, and **all four mutation proofs hold**.
The engineering here is genuinely strong — §M and §N in particular are the best-constructed
keystones I have audited in this repo, and the `item_required_satisfied` collapse is the right
call. The findings below are all at the **seams between FF-2 and features it did not touch**,
which is exactly where this phase's own nine defects also lived.

---

## 1. What I re-proved myself (all green — no finding)

The lead asked me not to accept the mutation proofs from the reports. I did not. I established a
fast standalone loop (clean `db reset` → `create extension pgtap` → `00_setup.sql` →
`271_ff2_matrix_fields.sql` via `psql`), verified the **baseline is 90 ok / 0 not ok**, and then
reverted each fix **in the live catalog** and required red.

| Keystone | Mutation I applied | Observed | Verdict |
|---|---|---|---|
| **§J** `instance_not_empty_with_matrix_only` | both matrix arms deleted from `app.instance_is_empty` | **6 red** — J1, J4, J5 + K4/K5/K6 collateral | ✅ non-vacuous |
| **§K** `correction_copies_matrix_answers` (cells) | instance-resolving subquery in `supersede_response`'s cells block → `new_a.group_instance_id is not distinct from old_a.group_instance_id` | **exactly 2 red** — K4, K5. **K2/K3 stayed green** | ✅ non-vacuous **and instance-aware** |
| **§K** (risk half) | whole `answer_risk_matrix` copy block deleted from `supersede_response` | **1 red** — K3 | ✅ non-vacuous |
| **§M** `supersession_matrix_excluded` | `not exists (… succ.status = 'submitted')` arm deleted from `app.submitted_form_responses` | **4 red** — M3 `have: mc_no,mc_yes`, M4 `have: 2`, M5 `have: 27`, M6 `have: altaxfreq=27,baixaxraro=3` | ✅ non-vacuous; **a count could not carry it** — the asserted values are `mc_no` / `3` / `baixaxraro=3` |
| **§N** (fix direction) | `<> ''` → `<> ''''` restored in both per-instance filters of `get_response_for_signoff` | **2 red** — N2, N4; N1/N3 green | ✅ |
| **§N** (twin direction) | `and false` appended to the per-instance observation filter | **1 red** — N3 | ✅ **both directions genuinely pinned** |

All eight mutations restored; suite returns to 90/90 after each. **§K's design is the correct
generalisation of FF-1's K4 blindness** — two instances with *different* cell values, asserted by
value on `gi.position`, so a cross-instance mix-up is distinguishable from a correct copy.

I also confirmed, against the live catalog:

- **K9 holds after the writers shipped.** All four matrix tables: `authenticated` has **SELECT
  only**, exactly one SELECT policy each, `relrowsecurity = t`, no `anon` grant. §A proves both
  halves under `set local role authenticated` (denial *and* the door working), which is the
  ETH·E1 discipline.
- **Ruling 1** — `UNIQUE (answer_id, row_id)` **and** `UNIQUE (answer_id, row_id, col_id)` both
  present on `answer_matrix_cells`. True of the table, not just the writer.
- **Ruling 2** — `app.save_risk_matrix_answers` computes `r.weight * col.weight` and **never
  reads a `score`/`risk_score` key from the payload**. §E sends `"risk_score": 999` and asserts 27;
  E4 proves recomputation on re-answer.
- **Ruling 4** — `guard_matrix_axis_code_immutable` is wired as `BEFORE UPDATE FOR EACH ROW`
  (`tgtype = 19`) on **both** axis tables and does **not** consult version status.
- **Ruling 3 (flat half)** — `app.item_required_satisfied` is dispatched from all four sites:
  `app.response_required_complete` (flat + per-instance) and `submit_response` (flat +
  per-instance). Body confirmed correct on all four paths, including the load-bearing
  `exists (rows)` anti-vacuity guard and the `is not distinct from p_instance_id` scoping.
- **Aggregation resolves through `code`, never `row_id`/`col_id`** — `dashboard_matrix_cells`
  and `dashboard_risk_scores` both project `r.code` / `c.code`, and the label/position meta is
  joined `on … .code = t.row_code`. A relabel cannot split a series; a clone cannot fragment one.
- **`slugifyLabel`** — independently confirmed (see §5) that all four call sites mint forward,
  none re-derives a slug to look an existing code up, `resolveOptionCodes` returns a submitted
  code verbatim, and **no migration rewrites a stored `code` or `question_key`**.
- **`upsert_matrix_axes`** checks authority **first** with `42501`, distinct from every `HC0P*` —
  the ADR-0079 "authority before validity" discipline, correctly applied.

---

## 2. BLOCKING findings

### 🔴 B-1 — A **targeted respondent cannot save a matrix answer**. The DEFINER gate is stricter than the RLS it displaced.

**Requirement violated:** ADR 0079 / the rule this phase *already learned once* — recorded in
PROGRESS.md's own Wave-2 entry: *"the rule a DEFINER gate must satisfy is neither weaker nor
stronger than the policy it replaces"* (that entry was about `app.copy_version_children`). The
same sweep was never applied to the answer writers.

`app.save_matrix_answers` / `app.save_risk_matrix_answers` are `SECURITY DEFINER` (they must be —
K9 denies direct DML), so they reconstruct the `answers` write rule in
**`app.assert_matrix_answer_writable`**. That reconstruction implements **only one of the two
arms** the live `answers` policies grant:

```
answers_write_own_draft   (ALL)    : created_by = auth.uid() AND status = 'in_progress'
answers_insert_targeted   (INSERT) : app.can_write_targeted_response(response_id, auth.uid())
answers_update_targeted   (UPDATE) : app.can_write_targeted_response(response_id, auth.uid())
```

`app.assert_matrix_answer_writable` implements the first only:

```
  if v_owner is null or v_owner is distinct from (select auth.uid()) then
    raise exception 'você não pode editar esta resposta' using errcode = '42501';
```

**Live proof** (`scratchpad/probe_targeted_matrix.sql`, on a clean reset — ethics case, published
form with one `short_text` + one `matrix`, response created by the coordinator `sa_x` and targeted
via `target_case_response` at a linked professional resolving to `st_y`; every assertion read as
`st_y` under `set local role authenticated`):

```
ok  1 - T1. the RLS predicate says this respondent MAY write answers to this response
ok  2 - T2. CONTROL — a scalar answer saves through the targeted path
not ok 4 - T4. SUBJECT — the targeted respondent can save a MATRIX cell
   died: 42501: você não pode editar esta resposta
     CONTEXT: PL/pgSQL function assert_matrix_answer_writable(uuid) line 18 at RAISE
              app.save_matrix_answers(uuid,uuid,jsonb,uuid) line 11 at PERFORM
              save_section_answers(...) line 198 at PERFORM
not ok 5 - T5. …and the cell really persisted        have: 0  want: 1
ok  6 - T6. the scalar control answer is there
```

T2 is the control that makes this unambiguous: **the same user, the same RPC, the same
transaction** saves a scalar answer and is refused a matrix cell. `app.save_instance_answers` is
INVOKER, so it runs under RLS and inherits the targeted arm for free — which is exactly why the
scalar half works and the matrix half does not.

**Impact.** ETH·E2's targeted-submission flow (ADR 0073 §D13) is shipped and live. From the moment
`matrix_fields` is on, any published form a coordinator targets at a respondent becomes unfillable
if it contains a `matrix` or `risk_matrix` — the respondent gets a permission error on a form they
were formally instructed to complete, with no path forward. Fails closed (no data corruption), but
it is a functional dead end on a governance-critical flow, and it is the pilot's most sensitive one.

**Why nothing caught it:** no fixture anywhere crosses *matrix* with *targeted response*. `271` has
no targeted response; `255_ethics_e2_targeted` has no matrix.

**Asked for:** widen `app.assert_matrix_answer_writable` to the **union** of the two arms
(`(creator AND in_progress) OR app.can_write_targeted_response(...)`), and add a keystone that is
mutation-proven in both directions — the targeted respondent saves a cell, and a *non*-targeted
non-creator still gets `42501`. Please also sweep for a third arm before fixing: assert the union
against `pg_policies` for `answers` rather than against this report.

---

### 🔴 B-2 — A designated **corrector reads every predecessor grid as blank**. Both matrix SELECT policies are missing the `can_read_correction_response` arm its sibling has.

**Requirement violated:** ADR 0089 §B (the correction path is in FF-2's scope) and the PO ruling
that pulled **FUP-FF2-1 into gate scope** — *"a signer reviewing a section containing a matrix
currently sees every other answer and an empty grid, then signs."* That defect was fixed on the
sign-off and submission surfaces and **left standing on the correction-review surface**.

Catalog comparison — `answer_selected_options` (the direct sibling FF-1 shipped, and the one ADR
0089 §B explicitly says to model the copy blocks on) carries a second OR-arm that FF-2's two tables
do not:

| Table | SELECT policy has `can_read_correction_response` arm |
|---|---|
| `answers` | ✅ |
| `answer_selected_options` | ✅ |
| **`answer_matrix_cells`** | ❌ |
| **`answer_risk_matrix`** | ❌ |

**Live proof** (`scratchpad/probe_correction_read.sql`, clean reset — predecessor submitted by
`st_x` with a top-level grid, a risk answer and two repeating-group instance grids; correction
request filed with `permitted_corrector = st_x2`, a plain staff member with a `read_case_content`
grant, who is **not** the creator, **not** a commission admin and **not** a staff_admin; all reads
as `st_x2` under `set local role authenticated`):

```
ok     1 - X1. the corrector CAN read the predecessor answers rows (can_read_correction_response arm)
not ok 2 - X2. …and its MATRIX CELLS — parity with answer_selected_options   have: 0  want: 4
not ok 3 - X3. …and its RISK answer                                          have: 0  want: 1
```

X1 is the control: the arm exists and fires for `answers`. The corrector therefore opens the
response they were asked to correct, sees every text answer and every choice selection, and sees
**every grid empty and every risk score absent** — while the copy blocks (correctly) put real cells
in their own draft. The two views disagree, and the one that is wrong is the one they compare against.

**Asked for:** add the `can_read_correction_response` arm to `answer_matrix_cells_select` and
`answer_risk_matrix_select`, byte-aligned with `answer_selected_options_select`. Keystone it by
reading rows as the corrector under `set local role`, not by asserting the predicate's return
value, and mutation-prove it (drop the arm ⇒ counts go to 0).

---

### 🔴 B-3 — There is **no gate-flip migration** for `matrix_fields`. The phase is dark in production.

**Requirement violated:** ADR 0089 front matter, verbatim — *"**Flag:** `matrix_fields` (seeded
OFF; **flipped by its own enable migration at the FF-2 gate**)"* — and §Consequences, which lists
the flag among the phase's new artifacts.

Live catalog + file sweep: `matrix_fields` is created **disabled** by
`20260830000100_ff2_matrix_flag.sql` and enabled in exactly one place —
**`supabase/seed.sql:2113`**. `grep -rn "matrix_fields" supabase/migrations/` returns only the
insert and the three `feature_enabled` gate reads. No enable migration exists.

Every comparable phase shipped one, and FF-1's names the convention explicitly:

| Flag | Enable migration |
|---|---|
| `case_custom_fields` | `20260822000000_enable_case_custom_fields.sql` |
| `cases_bulk_create` | `20260824000000_enable_cases_bulk_create.sql` |
| `case_corrections` | `20260825000600_enable_case_corrections.sql` |
| `repeating_groups` | `20260828000900_enable_repeating_groups.sql` |
| **`matrix_fields`** | **— missing —** |

**Impact.** `supabase db push` carries migrations, not `seed.sql`. On the pilot deployment the flag
is `false`, so `upsert_matrix_axes` and both answer writers refuse with `HC0P2` and the "Matrizes"
group never appears in **Adicionar bloco**. Local dev and the whole E2E gate are green *because
the seed turns it on*, which is precisely the shape of gap the seed-vs-migration split is designed
to hide. Read paths are correctly ungated, so no stored data is affected either way.

**Asked for:** a `20260830001200_enable_matrix_fields.sql` following the FF-1 template — or, if the
PO intends FF-2 to ship dark and flip after FF-3/FF-5, say so in PROGRESS.md and amend ADR 0089,
because as written the ADR promises the flip.

---

## 3. MAJOR — coverage gaps (behaviour verified CORRECT by me; a regression would be undetectable)

Both of these I proved by the ADR-0079 method: **revert the fix and require red.** Neither went
red. I then wrote my own probes, verified the shipped behaviour is right, and mutation-proved the
probes themselves so this section is not an opinion either.

### 🟠 M-1 — ADR 0089 **ruling 3's per-instance half** has zero committed coverage, in either direction.

The ruling is explicit: *"adds a matrix arm to `app.response_required_complete` — in **both** its
flat and per-instance loops, because a matrix may sit inside a repeating group."*

`271`'s fixture item `…014` (`matriz_inst`, the repeating group's matrix child) is created **without
`required`**, so the per-instance loop never evaluates a required matrix. §L5–L7 call
`app.item_required_satisfied` *directly* with an instance id — which proves the predicate, not the
loop that dispatches to it. §G's deadlock-negative covers hidden item / hidden **plain** group /
hidden section, not a required matrix in a repeating group.

**Mutation performed (mine):** reverted the per-instance arm of `app.response_required_complete`,
and separately of `submit_response`, to the pre-FF-2 inlined value/selection presence test.

```
271_ff2_matrix_fields      ok=90  notok=0     ← the FF-2 suite
270_ff1_repeating_groups   ok=52  notok=0
209_flexible_forms         ok=40  notok=0
51_item_visibility_validation ok=11 notok=0   ← every suite that touches the function
```

Nothing goes red. **The regression this ruling exists to prevent is invisible to the platform.**

**My probe** (`scratchpad/probe_required_instance.sql` — a repeating group whose matrix child is
`required = true`, one instance non-empty via a sibling `short_text` but holding 1 of 2 grid rows)
returns **7/7 green** against the shipped code: the incomplete instance grid is seen by
`response_required_complete`, `submit_response` raises `HC011`, completing the row makes both pass,
and the instance survives submit with both cells. **Probe mutation-proven:** with both arms
reverted, Q4/Q5/Q6 go red — a required matrix inside a repeating group **deadlocks submit
permanently**. Restored; 7/7 again.

So the code is right and a regression is a permanently unsubmittable form that no test would report.
`app.response_required_complete` additionally feeds `public.list_signoff_queue` and
`public.compute_due_notifications`, so a divergence there is user-visible beyond the wizard.

**Asked for:** add `required = true` to a matrix inside the repeating group in `271`'s fixture (or a
second one, to keep §J/§K's fixture untouched) and pin all four cells: incomplete blocks
`response_required_complete` **and** `submit_response`; complete passes both. Plus the missing
deadlock-negative arm: a required matrix inside a **hidden repeating group** blocks nothing.

### 🟠 M-2 — Only **2 of the ADR's 4** correction copy blocks are keystoned. `start_correction_draft` has none.

ADR 0089 §B: *"FF-2 adds a copy block for each, to **both RPCs** — four blocks."* §K exercises
`supersede_response` only, and its own header says so. The other consumer of those blocks —
`public.start_correction_draft`, the ADR-0085 case-correction path, flag **ON** and shipped — is
touched by exactly one test file, `264_correction_requests.sql`, which mentions "matrix" **zero
times**.

**Mutation performed (mine):** deleted **both** matrix copy blocks from `start_correction_draft`
(catalog-verified: `prosrc like '%answer_matrix_cells%'` → `f`).

```
264_correction_requests    ok=39  notok=0
271_ff2_matrix_fields      ok=90  notok=0
```

The FF-1 P0 class — a correction silently destroying every matrix answer — is reproducible in this
RPC with the whole suite green.

**My probe** (`scratchpad/probe_scd_matrix.sql` — full case + phase + submitted response with a
top-level grid, a risk answer and two instance grids, driven through `file_correction_request` →
`start_correction_draft`) returns **6/6 green** against the shipped code: the draft gets its own
instance rows, both grids and the risk score arrive by value on the correct instances, and the
predecessor keeps its own. **Probe mutation-proven:** with the two blocks removed, P2/P3/P4/P5 go
red. Restored; 6/6 again.

**Asked for:** a §K-shaped section for `start_correction_draft` — the same two-instance,
different-values construction — mutation-proven the same way.

> **On the lead's stated gap.** *"`correction_copies_matrix_answers` has no E2E coverage — pgTAP §K
> only"* is a defensible ruling on the E2E axis, and I would not block on it. But the ruling is
> **under-informed**: the real gap is not E2E-vs-pgTAP, it is that §K covers **one of the two RPCs
> the ADR names**. Please re-take that decision with M-2 in hand.

---

## 4. MINOR

### 🟡 m-1 — `dashboard_matrix_cells` / `dashboard_risk_scores` let a **platform_admin** read commission response content. · **RESOLVED 2026-08-03** (`20260903000700`)

> **This finding was correct and was under-rated at 🟡.** Filed as BUG-AUTHZ-001, PO-ruled 2026-08-03,
> fixed by replacing `app.is_admin()` with `app.is_commission_admin_of(v_commission_id)` on all five
> functions that carried it; pgTAP `270_authz_dashboard_gate_uniformity.sql` (8/8) now holds the
> invariant against `pg_proc`. FF-2's own call — inherit the sibling's arm rather than deviate — was
> the right one; the sibling was the stale half of an incomplete conversion (see `phase-8-review.md`).
> What neither this review nor the filing caught: those same functions **denied**
> `is_commission_admin_of`, so `org_admin`/`hospital_admin` — who reach `/dashboard` via the ADR 0051
> D1 mirror — were served empty Matriz/Risco panels. The gate was wrong in *both* directions.

Both new DEFINER doors gate on `app.is_staff_admin_of(v_commission_id) **or app.is_admin()**`, and
`app.is_admin()` resolves to `profiles.is_admin` — i.e. `platform_admin`. CLAUDE.md's noun rule
(ADR 0078 A35) says platform_admin *"May NOT touch commission content or PHI — cases, **responses**,
narratives, meetings"*.

**Live proof** (`scratchpad/probe_padmin.sql`): as the bootstrap `admin` persona,
`dashboard_matrix_cells` returns **1 row** of a commission's submitted grid aggregate
(`have: 1  want: 0`), while a direct read of `answer_matrix_cells` under the same claims returns
**0** — RLS denies the table, the DEFINER door does not. This is the "`prosecdef` belongs beside
`pg_policies`" lesson exactly.

**Pre-existing pattern, propagated.** `dashboard_distributions` and `dashboard_export_rows` use the
same `is_admin()` arm; `dashboard_completion_by_member`, `dashboard_form_totals` and
`dashboard_free_text` use `is_commission_admin_of` instead. FF-2 picked the wider of two in-repo
precedents without recording the choice. Not FF-2's to resolve unilaterally — but it is FF-2's two
new doors, so **the lead should rule**: align the two new doors with `is_commission_admin_of` (my
recommendation, since aggregate answer content is commission content), or record in the ADR that
`is_admin()` is deliberate and open a follow-up to reconcile the five siblings.

### 🟡 m-2 — ARCHITECTURE.md still describes what FF-2 just changed.

`ARCHITECTURE.md:52-55` — the binding, authoritative schema doc — still reads:

> **F3-reserved inert** {group, repeating_group, matrix, risk_matrix, reference} … with no
> renderer/answer path until each type's FF phase … `matrix`/`risk_matrix`/`reference` are
> answerable yet **forced `required = false`** until their completeness wiring lands

FF-2 relaxed exactly that arm of `form_items_input_vs_display` and added `weight` to both axis
tables. A teammate reading the authoritative doc would conclude matrix items are inert. (The
adjacent `parent_item_id … always NULL (no repeating-group UX)` on line 47 is FF-1's stale line,
not FF-2's — flagging it here because the same edit closes both.)

### 🟡 m-3 — `271`'s file header contradicts the file.

`supabase/tests/271_ff2_matrix_fields.sql:13-17` states `supersession_matrix_excluded` *"is NOT
here"* and explains why it was deliberately omitted. §M has been at line 939 since `f2e7401`. The
comment is now the kind of authoritative-sounding-but-false text ADR 0078's "text is not truth"
lesson is about, sitting at the top of the file a future auditor reads first.

### 🟡 m-4 — The matrix branch of `AnswerSummary` puts invalid content inside a `<dl>`, on all three read surfaces.

`src/components/responses/wizard/answer-summary.tsx:77-91` returns a `<div>` wrapping `<h3>` +
`<table>` rather than a `<dt>`/`<dd>` pair, while every FF-2 call site nests it directly in a `<dl>`:
`review-screen.tsx:233-241` and `:283-295`, `signoffs/review-and-sign.tsx:314-332`,
`responses/instance-answers-readonly.tsx:51-70`. A `<dl>`'s content model admits only `dt`/`dd`
groups; every prior answer type renders a real pair through the same component, so the matrix branch
is what introduces the violation. Assistive-technology impact varies (some AT exposes the `<dl>` as
a generic list and the untyped node disturbs item-count heuristics), but this is a phase whose
sign-off surface is a legal attestation, so I would not leave it.

### 🟡 m-5 — Eager `aria-invalid` on a brand-new weight field.

`src/components/forms/matrix-axes-editor.tsx:150` sets `aria-invalid={entry.weight === null ? true :
undefined}`, and `blankAxisEntry()` (`src/lib/forms/matrix.ts:229`) seeds `weight: null`. A
screen-reader user who adds a severity row and tabs into the weight field hears it announced as
**invalid before typing anything** — inconsistent with every other field in the same dialog.

---

## 5. INFO (no action required)

- **i-1** — `matrix-axes-editor.tsx:108` and `risk-bands-editor.tsx:63`: the `<fieldset>`'s helper
  paragraph is not linked via `aria-describedby`, so a user landing on the legend does not get the
  guidance. The rest of the builder uses `FieldDescription`/`aria-describedby` pairs.
- **i-2** — `src/components/forms/block-card.tsx:525-527`: a no-op `if (item.questionExplanation) {}`
  containing only a comment. Harmless; reads as unfinished.

**Verified clean, no findings:** pt-BR across all 16 FF-2 UI files (aria-labels included) · no
`error.message`/SQLSTATE reaches any component (all surfaces render the mapped pt-BR strings) ·
sanitized Markdown only (`react-markdown` + `rehype-sanitize`, no `rehype-raw`, no
`dangerouslySetInnerHTML` anywhere in the diff) · the radio grid's a11y is genuinely good
(`<caption>`, `th[scope]` both ways, `headers` on every `<td>`, one **native** radio group per row,
`aria-labelledby` announcing both coordinates, visible focus) · colour is never the only channel in
either dashboard card · **zero** added `any` · **zero** inline `supabase.from(`/`.rpc(` outside
`src/lib/queries/` · every new `"use client"` file genuinely needs interactivity · no client
component value-imports a server query module (BUG-FBE-005 avoided) · every `.rpc()` call site
matches its live `pg_proc` signature and every declared parameter has a caller (the
`declared-param-no-caller` sweep is clean — notable, given ETH·E3a and BUG-FF2-001).

---

## 6. Assessment of the lead's five carried gaps

| Gap | My call |
|---|---|
| `correction_copies_matrix_answers` has no E2E coverage — pgTAP §K only | **Mis-ruled, but not for the stated reason.** The E2E axis is fine. The real gap is M-2: §K covers 1 of the 2 RPCs the ADR names, and I proved the second is uncovered. Re-take the decision. |
| FF2V-3 / FF2V-4 not mutation-proven — non-vacuity bought by construction | **Correctly ruled.** Three deliberately asymmetric submissions is real non-vacuity, `tester` cannot edit app code, and the SQL half of the same aggregation **is** mutation-proven at §M with property-shaped assertions. Flagging it as weaker rather than letting you assume otherwise was the right call. |
| FUP-FF2-3 deferred (whitespace-only observation, per-instance) | **Correctly ruled.** I confirmed both canonical writers normalise with `nullif(btrim(...), '')`, so it is legacy-row-only; and the scope-discipline reasoning is sound. §N's fixture writes the empty string *as the owner* precisely because the writer nullifies it — that is honest test construction. |
| Two out-of-phase fixes ruled in — BUG-FF1-006 (`HC0N2`), BUG-FF1-007 (`''''`) | **Correctly ruled in.** Both are 3–4 line pt-BR correctness fixes in functions already open this wave; both are live user-facing Rule 10 defects in a shipped phase; both are mutation-proven (I re-proved §N in **both** directions myself). The `prosrc like '%''''%'` sweep that read each of the two hits rather than blind-replacing — correctly sparing the vendor `storage` function where `''''` is legitimate inside dynamic SQL — is exemplary. |
| Three pre-existing deterministic E2E reds filed to owning phases | **Correctly ruled.** FF-2's diff has zero files on the referrals path and BUG-FF1-008 blames to `633e688 feat(ff-1)`. Refusing to make FF-2 the drain is right. Separately: **BUG-P22-001 should be triaged before the pilot, not before this gate** — a `completed` referral invisible on its own committee's hub is a plausible live defect on a shipped module. |

**One further observation for the record.** The lead's batch-level conn-error triage (`>0` = infra,
`0` = real) is the only reason three deterministic reds surfaced from inside a 55-failure run. That
technique belongs in `docs/testing/e2e-prod-build-gate.md` as a documented step, not re-derived per
lead — FUP-E2E-1 already says so, and it is the most valuable durable output of this gate.

---

## 7. What I did not verify

- **The sign-off screen's composition on its own route** remains unproven in a browser, exactly as
  `frontend` recorded. The renderer (6 mutation-proven tests on the real `ReviewAndSign`) and the
  door (backend pgTAP §N + the projection) are each covered; their composition on that route is not.
  Given B-2 — a blank-grid defect on a *different* read surface that the same sweep missed — I would
  not clear this by inspection. It needs the spec `frontend` asked for.
- **The full `e2e:prod` gate.** I relied on the lead's independently-verified triage and did not
  re-run it; the FF-2 spec results (`ff2-matrix` 11/11, `ff2-matrix-views` 5/5,
  `ff1-repeating-groups` 9/9, `phase5-wizard` 12/12) are taken as given.
- **Remote/production catalog.** All catalog work was against the local stack.

## 8. Stack state

I owned the DB for this review. I ran `supabase db reset` at the start and again at the end; the
stack is **pristine at `20260830001100`, 212 registered == 212 files**, with every mutated function
restored by full replay rather than by hand. `pgtap` was installed mid-review for the standalone
loop and is gone after the final reset — regenerate `database.ts` only from a post-reset state
(the `gen-types + pgtap pollution` scar). No application file, migration, spec or query was modified.

---

## Re-review contract

Round 2 will re-run, from a clean reset: the eight mutations in §1 (they must still go red), the two
live probes B-1 / B-2 (they must go **green**), the two coverage probes M-1 / M-2 against the newly
committed keystones (each must go red when its fix is reverted), and a catalog check that the
`matrix_fields` enable migration is registered. Please **do not** hand me the new keystones' output —
I will revert the fixes and require red myself.
