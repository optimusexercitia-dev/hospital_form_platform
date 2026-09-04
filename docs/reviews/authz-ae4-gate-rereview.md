# QA RE-REVIEW — Gate AE4, both prior review verdicts re-signed

# ⛔ VERDICT: CHANGES REQUESTED

- **Subject:** the findings of the two open AE4 QA reviews, re-established at the current HEAD —
  [`authz-ae4-gate-review.md`](./authz-ae4-gate-review.md) (branch `authz-ae4-catalog` @ `e897b452`,
  2026-09-02) and [`authz-ae4-if9-statement-scoped-review.md`](./authz-ae4-if9-statement-scoped-review.md)
  (branch `authz-ae4-scope-reaches-fix` @ `9f7fa68d`, 2026-09-03).
- **Branch:** `main` · **Commit:** `e331a095` · **Date:** 2026-09-03/04 · **Reviewer:** `qa`
  (read-only on application code, migrations, specs and queries).
- **Scope note:** the PO has separately ruled Gate AE4's **final approval HELD until C2 closes**. This
  verdict is about the two reviews' findings, **not** about the gate as a whole. C2 is out of my scope
  and is recorded below as open-by-design, not as a finding of mine.

> ## ⚠ Why this is a new file, and how it was measured
>
> **Both prior reviews are stale against `main`, and re-filing their findings would have been a wrong
> verdict.** Most IA-F9 findings were fixed by `9a4bbd22` — the commit that answers that very review —
> and **every line number either review cites is stale by roughly 58–74 lines.** A reviewer who greps a
> cited line and finds defect-shaped text there is reading unrelated content. So every finding below was
> re-established **at HEAD, from the artifact itself or the live catalog**, never from the review's own
> description and never from a cited line number.
>
> A new file, rather than a verdict appended to either existing one, for the reason the IA-F9 review
> itself gives: a review file's name and rows assert its own subject, and ruling 3's lesson is that a
> verdict keyed to a name survives a change of predicate.

**Catalog identity, confirmed before any reading:** 523 migration files = 523 rows in
`supabase_migrations.schema_migrations`, head `20261003007340`. The catalog *is* this branch.

**⚠ HEAD moved TWICE during this review, and a clean `git status` is an instant, not a lease.** The
brief named `cbe565c6`; `9f382b99` landed while I was measuring (docs only, +34); then `e331a095`
landed *after* the first draft of this report, clearing three of my own new findings. Neither commit
touches `src/`, a migration, or a test — `git diff --stat cbe565c6 e331a095` is three `docs/` files —
so no catalog or gate measurement below is invalidated. **Everything is read at `e331a095`**, working
tree clean; § 5 records which findings the second commit cleared and which it did not.

---

## 1. Verdict in one paragraph

**All four grounds the broad review refused the gate on are discharged, and I found no security
finding.** F-BLOCK-1 is genuinely fixed — all six `commission.forms.edit` policies are re-keyed in both
halves on the live catalog, the site-axis gate that could not see the defect exists, and I reproduced its
discrimination independently rather than accepting its table. F-BLOCK-3 is settled by a PO ruling with
the competing claim deleted. F-MAJOR-1's remediation (a) is an honest disclosure, and the depth
correction it rests on reproduces **exactly** on the catalog. F-BLOCK-2's items are discharged, deferred
with a hazard banner, or out of scope. On the IA-F9 side, MED-1 is fixed at the catalog *and* gated by a
new suite bound on the property rather than the symptom, and MAJOR-1 / 2a / 2b / MED-2 / MED-3 / MED-4
are all corrected in place with labelled correction notes.

I am nevertheless refusing to sign, on two grounds. **(1) Ten of the broad review's own findings are
still open**, including three it named in its `APPROVED` conditions: the ADR-0173-mandatory
`door-sweep-targets:` marker (F-MAJOR-3), an assertion in a gate suite that is **provably incapable of
failing alone** (F-MAJOR-4b), and gate 12's discrimination suite still chained to nothing (F-MAJOR-5).
**(2) New findings of my own** (§ 5), including a measured instrument-contamination hazard in a
phase-gate arm and a gate verdict that exists only in a commit message.

> ⭐ **A third ground was withdrawn during the review, and the withdrawal is the point.** My first draft
> blocked primarily on **N1** — the tree stating ADR 0182's approval two contradictory ways. The lead
> fixed it in `e331a095` and self-reported it as *"the same defect as F-BLOCK-3, one artifact later,
> committed by the session that had just closed F-BLOCK-3."* **I re-measured and N1 is clean.** The
> verdict does **not** turn on it, and did not before: grounds (1) and (2) each carry it alone.
> Removing the closed item rather than leaving it to pad the refusal is why this is stated here.

Nothing here is an RLS hole, an over-grant, or a regression. The residue is conformance and record
defects — which is the class this program exists to eliminate, and the class that reads as green.

---

## 2. Disposition — the broad Gate AE4 review (`authz-ae4-gate-review.md`)

| # | Finding | Disposition | Evidence at HEAD |
| --- | --- | --- | --- |
| **F-BLOCK-1** | 4 of 7 sites re-keyed; no site-axis closure | ✅ **DISCHARGED** | Live catalog: **all six** `_staff_admin_write` policies (`forms`, `form_versions`, `form_sections`, `form_items`, `form_item_options`, `form_item_validations`) carry `app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid()))` in **both halves**, `md5(USING) = md5(WITH CHECK)` on each. `form_block_library` confirmed to hold no write policy. Manifest `enforcementSites` 4 → **6**. Site-axis arm exists as `410` § 8 (six assertions) — see § 4.1 for my independent reproduction of its discrimination. Matrix row 1 also **rules on the D sites** (`0 carry a permission literal; 22 DEFINER functions gate form-family tables on is_staff_admin_of and none is re-keyed`), which was the second half of the close condition. |
| **F-BLOCK-2 · 1** — perf on the FINAL path | ✅ **DISCHARGED (measurement)** | `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` carries a *"MEASUREMENT DISCHARGED 2026-09-03 (runs 6 + 7)"* section with **four self-disclosed bounds**. The principal proof is a machine assertion, not prose (acceptance § 4.1 = ten VOIDing checks, one per competing arm, principal read from `ae4perf.fixture_meta`, never a literal), and run 7's OID-keyed counter excludes the off-path `holds_role` term by name: `A = 7 = asi 1 + entailed_grants 3 + holds_role 3`, residual **0**. ⚠ The entry stays `open` because its `Closes when` is `PO to rule` — administrative, not measurement. |
| **F-BLOCK-2 · 2** — C2 Tier-1 | ⛔ **OPEN BY DESIGN** | Out of my scope; PO has held approval on it. Not a finding of mine. |
| **F-BLOCK-2 · 3** — runbook § 6 | 🟡 **PARTIALLY DISCHARGED** | § 6 is written (`## 6. Worked example — reverting the AE4.9 D6 re-key`, subsections 6.0–6.9) with an honest *"the revert itself has NOT been executed"* provenance caveat. § 6.2 is **still scoped to four policies** and carries an explicit ⛔ **"DO NOT RUN IT AS WRITTEN"** hazard banner naming the exact remedy (add both tables, expect six rows, revert both halves). Full rewrite **PO-deferred**, tracked as `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR`. Acceptable as a disclosed deferral. |
| **F-BLOCK-3** | oracle states its approval scope three ways | ✅ **DISCHARGED** | Matrix header now carries `✅ SCOPE RULED BY THE PO 2026-09-03 … the 2026-09-01 approval covers all 42, and row 43 is inside it as an amendment`. § 4's competing "33 rows / nine rows of delta" claim is **deleted** and replaced with a prohibition: *"The approval scope is stated in the header and NOWHERE ELSE."* No "33 rows" text survives in the file. |
| **F-MAJOR-1** | `hardDenyClasses` empty on 43/43, blind to a live instance | ✅ **DISCHARGED as remediation (a)** | Provenance renamed `measured-at-declared-sites` → **`measured-depth1-at-sites-and-authorizer`** (manifest + `catalogSnapshot.hardDenyProvenanceValues` + `410` § 6.2/§ 6.3 + regenerated fixtures). § 6.2's caption now reads *"…DEPTH 1, STATED AS DEPTH 1 … ⛔ THE ZERO IS A SEARCH HORIZON, NOT AN ABSENCE"* and names the classes that **are** enforced with their depths; § 6.3 says out loud it is a cardinality and **not** a discrimination control. The manifest's own `_comment` carries the same table. See § 4.2 — the depths are correct. Underlying `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` correctly stays **open**; (a) is a disclosure, not a closure, and both artifacts say so. |
| **F-MAJOR-2** | `ARM=catalog` / `ARM=sites` last held at AE4.7b | ✅ **DISCHARGED — by my own run** | I ran both at `9f382b99` (they are pure read-only SELECT arms). **`ARM=catalog` (ARM 6): INVARIANT HOLDS, exit 0** — 1 non-legacy role, both artifacts, vacuity control OK. **`ARM=sites` (ARM 7): INVARIANT HOLDS, exit 0** — wrapper family 2, `staff_admin` **14 sites** all wrapper-family or allowlisted, both halves of the paired vacuity control OK, no allowlist rot. ⚠ **The record still owes the line**, named by arm per CLAUDE.md § 6 step 5. |
| **F-MAJOR-3** | `20261003007180` is a rewrite migration with no `door-sweep-targets:` marker | ⛔ **STILL OPEN** | `grep door-sweep-targets supabase/migrations/20261003007180_*.sql` → zero matches. No follow-up, ADR or record disposes of it; it is absent from the 2026-09-03 clearance list. ADR 0173 § 2 — this phase's own ADR — makes the declaration **mandatory**. |
| **F-MAJOR-4a** | `409` § 2.5 `form_versions` baseline with no mutated twin | ⛔ **STILL OPEN** | § 2 now carries twins for site 5 (2.10a/2.10b) added by `e3f986b1`, and a backstop disclosure for site 6 (2.6d/2.6e) — but **`form_versions` still has a baseline and no mutated re-probe**, and the one-sidedness is still **not** disclosed in 2.5's message, where `form_items` gets exactly that treatment in 2.1. |
| **F-MAJOR-4b** | `411` § 5.1 cannot fire unless § 4.1 has already fired | ⛔ **STILL OPEN** | Text byte-identical, file untouched since `69561819`. § 4.1 still asserts `count(*) = 11` over a join on `allowed_scope_kind`; if all 11 pass, every `scope_kind` is by construction in `select distinct allowed_scope_kind`. The false parenthetical justification survives verbatim. This remains **the only assertion in the six suites provably incapable of failing alone** — in a phase whose subject is vacuous gates. |
| **F-MAJOR-4c** | `409` § 1.1/§ 1.3 unquoted, unanchored `LIKE` needles | ⛔ **STILL OPEN** | `from b join authz.permissions pm on b.src like '%' || pm.code || '%'` still stands inside `pg_temp.code_sites()`. ⚠ The **same file** now demonstrates the correct idiom 280 lines below at § 2.10c (`position('''commission.forms.edit''' in …)` with an explicit caption), so the hazard is documented twice in the tree and fixed at neither § 1 site. No live false positive. |
| **F-MAJOR-5** | generators' `--self-test` invoked by no gate | ⛔ **STILL OPEN** | `package.json` `lint:authz-vectors` is still `--check && --check`. `docs/lint-gates.md` states it as a known gap. ⭐ **CV8 is closed by me, though**: I ran both self-tests at HEAD — `gen-authz-matrix-cells --self-test` **exit 0** (7 mutations caught + *"caught nothing on the real spec"* discrimination control), `gen-authz-differential-cells --self-test` clean with its own discrimination control. So the proof works and is unchained, not broken. |
| **F-REC-1** | `backend-state.md` said 17 where 18 | ✅ **DISCHARGED** (went re-stale mid-review; re-closed at `e331a095`) | Header read `…007330, **21**; pgTAP 401–413, **13**` — internally correct for the ranges stated, but the *endpoints* had gone stale (**N5**). Now reads `20261003007100–…007340, **22**; pgTAP 401–414, **14**`, which matches my independent counts **exactly** (22 and 14). |
| **F-REC-2** | ADRs 0177 / 0178 carry literally opposite sentences | ⛔ **STILL OPEN** | Both survive unreconciled and uncross-referenced. |
| **F-REC-3** | matrix § 12.8 "Granted to `staff_admin` and `org_admin`" vs catalog | ⛔ **STILL OPEN** | Text unchanged, and unannotated — in contrast to row 1, which now carries a dated `⛔ CORRECTED … against the live catalog` stamp. Catalog side re-confirmed by me: `authz.role_permissions` holds rows for `staff_admin` only. |
| **F-REC-4** | matrix row 1 says "(7 ALL)" | ✅ **DISCHARGED** | Row 1 now names **six** `ALL` policies, reclassifies `form_block_library` as a `D` site with no write policy, discloses `form_item_validations` as an unreachable backstop, and rules on the DEFINER form functions (correcting "8" to **22**). |
| **F-REC-5** | `role-catalog.ts` "Pure, no I/O" vs a value import | ⛔ **STILL OPEN** | Comment and value import both unchanged. |
| **F-REC-6** | mid-phase review carries no verdict line | ⛔ **STILL OPEN** | No verdict, no banner; the file's only banner predates the finding (`e40fc699`, 2026-09-01) and has had no commit since. |
| **F-REC-7** | handoff live in the tree | ✅ **DISCHARGED** | `docs/handoffs/` holds `README.md` only; `authz-ae4-catalog.md` deleted in `35090ac1`, narrative folded into the record. |
| **F-REC-8** | landing seam divergence unpinned | ⛔ **STILL OPEN** | No assertion added; `hospital_admin` fixtures still hand-built with a hospital, and `session_context()`'s projection into `g.hospital` is still unasserted. |

**Broad review: 9 discharged · 1 partially discharged · 10 still open** (of which one — C2 — is
open by design and out of scope).

---

## 3. Disposition — the IA-F9 statement-scoped review (§ 7's actionable list)

| # | Finding | Disposition | Evidence at HEAD |
| --- | --- | --- | --- |
| **MED-1** | DEFINER `search_path` is one nonexistent schema, and `413` pins it | ✅ **DISCHARGED, and over-delivered** | Catalog: `app.current_professional_read_organizations` `proconfig` = `search_path=app, public, pg_catalog` in **list form**, byte-matching all three sibling authorizers (I checked the raw array element for the dquote signature, not the rendered value). Migration `20261003007330`. `413`'s § 1 composite now **deliberately excludes** `search_path` and asserts it separately. ⭐ And a **new suite `414`** closes the sweep half of `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`, **bound on the property** (*every named schema resolves in `pg_namespace`*) rather than the symptom (*the value contains a quote*) — I ran it: **7/7 green**. |
| **MAJOR-1** | DC3's spec ≠ the DC3 that ran; DC3a/DC3b credited jointly | ✅ **DISCHARGED (both halves)** | § 13.2's DC3 row rewritten to the implemented criterion with a labelled `⛔ CORRECTED 2026-09-03 (QA review)` note stating that 0 rows is the **failure** condition; matches the harness verbatim. § 13.6's coverage row **split in two**, DC3a marked *"⛔ not a discrimination half"* and DC3b carrying *"the whole discrimination weight"*, with its own correction note. |
| **MAJOR-2a** | "ruled and written before the run" is false for DC2 | ✅ **DISCHARGED** | § 14 now carries the qualifier explicitly, the header banner repeats it, and § 13.2's DC2 row is out of the `UNCHANGED` group and reads `⛔ RE-AIMED, and re-aimed AFTER a failing reading` with the `1.15×` reading quoted. |
| **MAJOR-2b** | header says "NOT MET" while § 14 says "MET" | ✅ **DISCHARGED** | Run-6 `MET` banner added; run-5 `NOT MET` struck through and marked superseded, per the file's own convention. ⚠ Residual → **N7**. |
| **MAJOR-3** | Phase Gate step 2 (E2E) not run | ✅ **DISCHARGED** | Full `npm run e2e:prod` **GATE GREEN 2026-09-03** against the re-key: 1 256 passed · 0 failed · 0 infra · 6 flaky · 0 did-not-run · 21 batches · exit 0. The finding asked only for a `SPECS=`-scoped subset, so the full suite exceeds it. I verified the artifact still describes the tree: `git diff --name-only e3f986b1 HEAD` outside `docs/` is **four test/vector files only** — no `src/`, no migration, nothing that ships. |
| **MAJOR-4** | no authorising party recorded for ADR 0182 | ✅ **DISCHARGED** (was contested — see N1) | ADR 0182 carries `**Approved:** **the PO**, 2026-09-03`, and as of `e331a095` `docs/features/ae4.md:98` agrees: *"✅ IA-F9 MAJOR-4 **CLOSED** — ADR 0182's authorising party is **the PO**, confirmed directly 2026-09-03 … 'operator' had named a seat, not an authority."* The contradiction I blocked on is gone and its cause is recorded. ⚠ **ADR 0183 still carries no `Approved:` line at all** — the same class, one ADR later; folded into LOW-5. |
| **MAJOR-5** | door sweep's read-arm verdict unconfirmed | 🟡 **PARTIALLY DISCHARGED — see N3** | The re-run happened (`1d913daf`: fresh reset, `CASES="professional_profiles_select"`, 1 policy case of 226, **COVERED**, **exit 0 read bare**, findings file byte-unchanged — which I corroborated: that file's last touch is `e3f986b1`, and its row still reads `COVERED`). But the figures live **only in a commit message**, and **only one of the sweep's two arms was run**, with no write-arm result and no explicit "0 write cases" disclosure. |
| **MED-2** | P7 never shown able to fail | ✅ **DISCHARGED** | § 13.2 amended: P7 now ships a negative control on the pre-change predicate, run 6's PASS is explicitly recorded as *"a bare positive"*, and the control is measured — `CONTROL [hashed=f,loops1=f,never=f]`. |
| **MED-3** | `413` § 5 exercised by 2 rows × 1 principal | ✅ **DISCHARGED** | Population widened to fixture rows ∪ a deterministic 40-row slice, principals from `select distinct pid from f413cells`, and a **§ 5b non-vacuity guard** added requiring both polarities. |
| **MED-4** | `413` § 2 exercises 2 of 4 `CASE` branches | ✅ **DISCHARGED as a documented bound** | New § 2d/§ 2e pin the reached branch set by name and the **mechanism of each absence separately** (`commission→hospital` unreachable because no permission resolves at hospital scope; `hospital→organization` because no hospital-scope membership entails an org-scope permission) — falsifiable assertions, not prose. |
| **LOW-1** | `413` test 5's caption overclaims what `pronargs = 0` measures | ⛔ **STILL OPEN** | Assertion and caption unchanged; no `prosrc` probe added. |
| **LOW-2** | migration postflight claims "BOTH polarities" without measuring | ⛔ **STILL OPEN** | Comment unchanged; no later migration corrects it. |
| **LOW-3** | three stale assertion messages | ⛔ **STILL OPEN (all three)** | ⚠ Two are now **self-contradictions inside one file**: `401` asserts TEN `authz` functions and 27 probes while its own prose says "eight" and "fifteen"; `409` § 1.1 asserts FOUR pairs while its prose says "three hits". |
| **LOW-4** | FUP title + § 13.4's stale "DC1's new subject" | ✅ **DISCHARGED** | FUP title rewritten; § 13.4 **struck rather than deleted**, with the reason recorded. |
| **LOW-5** | ADR 0182 carries no `Amends:`; ADR 0178's as-built record stale with no back-pointer | ⛔ **STILL OPEN** | 0182's header has neither label; `INDEX.md` shows its amends column empty. ADR 0178 has no back-pointer block and its stale `professional_profiles` as-built text is unannotated. ⚠ ADR **0183** likewise carries **no `Approved:` line at all** — the same class, one ADR later. |
| **LOW-6** | `8.3 ms` vs `~2.8 ms` | ✅ **DISCHARGED** | Reconciled in **both** directions with an explicit apparatus note in each (pre-commit `8.3 ms` vs post-commit `3.842 ms`, buffer count `402` identical across all three). |
| **LOW-7** | `⭐ AMENDED` markers on unamended rows; DC2 unmarked | ✅ **DISCHARGED** | Markers gone from P2/P3 (now `RETIRED` / `NARROWED`); **DC2 now carries the marker** with the "re-aimed AFTER it FAILED" qualifier attached. |
| **LOW-8** | three-vs-one, no bridging note | ⛔ **STILL OPEN** | FUP still says three; the backlog still records one; nothing states why. |

**IA-F9 review: 12 discharged · 1 partially discharged · 5 still open.** ⚠ MAJOR-4 moved from
*contested* to *discharged* at `e331a095`, mid-review — see **N1**. The five open are LOW-1, LOW-2,
LOW-3, LOW-5, LOW-8, all of which that review itself filed as non-blocking follow-ups.

---

## 4. What I re-measured myself, rather than accepting a table

### 4.1 The site-axis arm's vacuity proof — **it holds, reproduced independently**

`410` § 8.1 and § 8.4 caption their red-proofs as *historical* measurements ("measured at head
`20261003007330`, with the fix migration NOT applied…"). Those cannot be re-run without reverting, so I
reconstructed § 8's `t410_carriers` + `reaches_code` predicate in a rolled-back transaction and evaluated
it against live bodies and a **counterfactual** one:

| probe | result | meaning |
| --- | --- | --- |
| the six live re-keyed policy bodies | **all `t`** | § 8.2's positive half reproduces — the detector is not stuck on FALSE |
| the exact **pre-re-key** predicate text (`is_staff_admin_of(commission_of_version(…)) OR is_tenancy_admin_of(…)`) | **`f`** | ⭐ **§ 8.1 would have RED-ed on the pre-fix bodies.** The detector is not stuck on TRUE |
| `form_item_options_select` / `_select_targeted` (permissive siblings on a subject table) | **`f`** | § 8.3's negative half reproduces, anchored on something correct **by design** |
| § 8.6's triple, re-derived from the catalog + manifest | **12 / 8 / 4** | matches the pinned string exactly |
| § 8.5's carrier classification | the same four, incl. `app.current_professional_read_organizations` **[UNDECLARED]** | the arm's own first-run finding reproduces |

The claim that the arm reds in **both** directions is therefore sound: 8.1 by the counterfactual above,
8.4 by set-difference over a non-empty 8-policy domain that 8.6 pins. And the discrimination pair
(8.2/8.3) is anchored on a live correct-by-design object rather than on a defect, which is what
distinguishes it from the pre-existing § 3.5 — § 3.5 compares the manifest with **itself**; § 8 compares
it with the **catalog**. **I could not fault this section.**

### 4.2 The depth correction — **correct, and the review's own figure was not wrong**

Re-derived on the live catalog by recursive closure over comment-stripped `prosrc`, under the artifacts'
own convention (depth 1 = the enumerated site bodies + the domain authorizer; a gate's depth = the depth
of the body that *invokes* it):

| row | permission arm | preserved / legacy arm |
| --- | --- | --- |
| `commission.forms.edit` | `has_permission` → `entailed_grants` → **`assignment_facts` (depth 4)** | `is_tenancy_admin_of_for` (**depth 2**) |
| `org.professionals.create` | same chain, **depth 4** | `can_manage_professional` → `is_org_admin_of` (**depth 3**) |
| `org.professionals.read` | same chain, **depth 4** | `is_org_admin_of` (**depth 3**); and `can_read_case_committee` → `is_oversight_only_reader` → `has_case_capability` → `_case_caps` → `is_case_respondent` (**depth 5**) |

**All four figures reproduce exactly.** The correction is right and the ⛔ warning it draws — that raising
the search one hop is *a partial fix that reads as a complete one* — is right too. ⚠ But see **N6**: the
correction misattributes.

### 4.3 The two new follow-ups — **both verified on the catalog**

- **`FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` — TRUE.** `authenticated` holds **`r` (SELECT) only** on
  `public.form_item_validations` (table ACL; zero column ACLs), so no PostgREST write reaches the
  re-keyed policy. The real writer is `public.set_item_validations(uuid, jsonb)` — `SECURITY DEFINER`,
  `EXECUTE` granted to `authenticated`, gating on
  `app.is_staff_admin_of(v_commission) or app.is_tenancy_admin_of(v_commission)` — **layer 1, not
  re-keyed.** By contrast `form_item_options` grants `authenticated` INSERT/UPDATE/DELETE, so **that**
  policy genuinely is the door.
  **What this means for the claim, plainly:** deleting `staff_admin → commission.forms.edit` now closes
  **five of the six** re-keyed policy doors; at `form_item_validations` it closes a door nothing opens,
  while the door that is actually used still answers to the legacy role check. The re-key at that site is
  **conformance-only**. This is honestly disclosed in three places — the FUP, matrix row 1, and `409`
  § 2.6d/§ 2.6e/§ 2.10c as machine assertions — but **not** in the sentence the PO reads. See **N8**.
- **`FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` — TRUE.** Exactly four objects in the database
  carry a permission-code literal; `app.current_professional_read_organizations` is one of them, carries
  `org.professionals.read`, and appears in **no** `enforcementSites` entry (that row's three sites are
  `professional_profiles_select`, `professional_participants_select`, `get_case_professional`). Correctly
  pinned by name as a visible disclosure in `410` § 8.5 rather than silently absorbed.

### 4.4 Gates I executed at HEAD

| gate | result |
| --- | --- |
| pgTAP `409` | **72/72**, plan `1..72`, 0 not-ok |
| pgTAP `410` | **40/40**, plan `1..40`, 0 not-ok |
| pgTAP `411` | **7/7** · `413` **29/29** · `414` **7/7** |
| `ARM=catalog` (ARM 6) | **INVARIANT HOLDS, exit 0** |
| `ARM=sites` (ARM 7) | **INVARIANT HOLDS, exit 0** — 14 sites, both vacuity halves OK, no allowlist rot |
| `ARM=census` (ARM 3) | **INVARIANT HOLDS, exit 0** — 581 live gates / 625 verdicts, no unswept newcomer *(after the correction in **N2**)* |
| `lint:progress` · `lint:registers` · `lint:adr-index` · `lint:vacuous` · `lint:authz-vectors` | all **exit 0** |
| both generators' `--self-test` | **pass**, each with its own discrimination control — closes the prior review's CV8 |

**Disclosure of what I did to the local stack:** I created the `pgtap` extension (the standalone
single-file run workflow this tree documents), ran the five suites, and **dropped it again**; all three
arms ran with `WORK` overridden to scratch. `git status` is clean and
`git diff --stat -- docs/reviews/authz-door-audit-findings.md` is empty.

---

## 5. NEW findings

### ✅ N1 · was MAJOR (blocking) — **RESOLVED at `e331a095`, re-measured 2026-09-04**

**Kept in full, because a finding that is deleted on closure cannot be audited.** As filed:

`docs/decisions/0182-statement-scoped-authorized-scope-ids.md:15`:

> **Approved:** **the PO**, 2026-09-03 — ⭐ *the authorising party was recorded as "operator" until
> 2026-09-03, when the PO confirmed directly that this ADR is theirs…*

`docs/features/ae4.md:97`, § Blockers, same HEAD:

> - ADR 0182 records **no authorising party** though § 12.4 required its own approval (IA-F9 MAJOR-4) —
>   awaiting the PO; ⛔ **not to be invented.**

Both are live. The `Approved:` line was written into the ADR by `bb180e2a`, whose message asserts the
confirmation; unlike ADR 0181's precedent there is no separate dated PO-ruling artifact it cites, and
acceptance § 15.1 records the closure as *"names **what** was approved and **when**"* — not **who**.

I take no position on whether the PO gave the approval; I cannot, and neither can any agent-authored
text. What I can say is that **the record contradicts itself about an approval, in the phase whose gate
turns on approvals** — the exact defect F-BLOCK-3 was blocking for, one artifact later. One of the two
sentences is false and only the PO can say which.

**Required to close:** a PO sentence, then delete whichever line it falsifies. ⚠ And ADR **0183** carries
no `Approved:` line at all (LOW-5's tail) — rule on it in the same pass, or the class recurs.

> **✅ CLOSED — verified by me at `e331a095`, 2026-09-04.** The lead reports the PO confirmed directly
> that ADR 0182 is theirs, and that the contradiction arose because the hub line was written *before*
> the confirmation and left standing *after* the ADR header was fixed. `docs/features/ae4.md:98` now
> reads:
>
> > ✅ IA-F9 MAJOR-4 **CLOSED** — ADR 0182's authorising party is **the PO**, confirmed directly
> > 2026-09-03; the ADR header carries it. "operator" had named a seat, not an authority. ⛔ This line
> > previously said the ADR "records no authorising party — awaiting the PO" and was left standing after
> > the header was fixed, so the tree asserted an approval two contradictory ways (re-review N1) — **the
> > same defect as F-BLOCK-3, one artifact later, committed by the session that had just closed
> > F-BLOCK-3.**
>
> The two artifacts now agree, and the record names its own defect class rather than quietly
> overwriting the line. That is the right shape and it exceeds what I asked for. ⛔ **What I verified is
> that the CONTRADICTION is gone — not that the PO approved.** I cannot verify the latter and no
> agent-authored text can; it remains **CV6**, now bearing a named party and date rather than nothing.
> ⚠ ADR **0183**'s missing `Approved:` line is untouched and still owed.

### 🟠 N2 · MEDIUM — `ARM=census`'s domain has no extension exclusion, and CLAUDE.md § 6 step 1 orders pgTAP and the arms together

Measured today, both directions, on this stack:

```
with the pgtap extension installed   → ARM=census: *** INVARIANT VIOLATED, exit 1
                                        (a wall of UNKNOWN gates: public.todo_start(), public.trigger_is(...),
                                         public.type_owner_is(...), … ~700 pgTAP functions)
after `drop extension pgtap cascade` → ARM=census: === INVARIANT HOLDS, exit 0
```

The mechanism is the arm's own `public INVOKER plpgsql` domain clause, which pgTAP's functions satisfy.
⭐ **This exact class is already known in this tree and already fixed at a sibling site**: pgTAP `100`'s
header records `FUP-QO-5` (2026-08-07) — *"`create extension pgtap` … puts ~1079 extension-owned
functions there … Measured both ways: pgtap present → 1079; after a reset that drops it → 0"* — and `100`
was given an extension-owned exclusion. `p0-authz-invariant.sh` was not. This is the tree's own *"a fix
correct at most sites hides that it is wrong"* shape.

The damage direction here is a **spurious RED**, not a false green — but a phase-gate arm that reds with
700 lines of noise is precisely what tempts an operator to widen a filter, and CLAUDE.md § 6 step 1 puts
`npm run test:db` and the four authz arms in the **same step** without saying the extension must be gone
first.

**Required to close:** exclude extension-owned functions from the census domain (`pg_depend` on the
extension, the same predicate `100` uses), or state the ordering constraint in § 6 step 1. Not a code
change to the phase; a gate-hygiene fix.

### 🟠 N3 · MEDIUM — MAJOR-5's re-run result exists only in a commit message, and only one of the sweep's two arms was run

The figures — fresh reset, `CASES="professional_profiles_select"`, 1 policy case of 226, `COVERED`,
exit 0 read bare, findings file byte-unchanged — appear **only** in `1d913daf`'s trailing paragraph. The
doc-side records carry no exit code, no BLIND count, no gate count and no `git diff --stat` confirmation:
acceptance § 15.2 says only *"door-sweep read arm **CLEAN/COVERED**"*, and `docs/progress/authz-ae4.md`
carries a bare pointer. And the recorded run names `policy arm 1 selected of 226` — the **read** harness
only. This tree's own standing rule says the sweep is **two arms** and that running one leaves the other
unmeasured (`scripts/door-sweep-cases.sh:43-46`; `docs/progress/authz-ae4.md:1220-1221`;
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`). No write-arm result and no explicit *"0 write cases, because the
subject is a SELECT policy"* disclosure exists for this re-run.

It is very probably fine in substance — but the substance is not the finding. A gate verdict that lives
only in a commit message is not in the record, and a half-run sweep recorded as *"door-sweep read arm
CLEAN/COVERED"* reads as the sweep having run.

**Required to close:** put the figures in the record with both arms named (or the write arm's zero
explicitly disclosed), and update `docs/features/ae4.md:85,89`, which still list this re-run under
**In progress** and **Next**.

### 🟠 N4 · MEDIUM — the "flips the production door" clause is unqualified where the PO reads it

`docs/plans/authz-evolution.md:1077` (§ Gate AE4's acceptance list) and `:1032`, and ADR 0178:

> the grant-deletion mutation flips the **production door** for each of the three representatives

At HEAD the oracle qualifies this and the plan does not. Matrix row 1 now says *"22 DEFINER functions
gate form-family tables on `is_staff_admin_of` and none is re-keyed, so 'the production door' for this
row means the **policy** door"*, and discloses that one of the six policies is unreachable; `409`
§ 2.10c pins the same bound as an assertion captioned *"THE DISCLOSED LIMIT OF REPRESENTATIVE 1, PINNED
SO IT CANNOT BE READ AS DONE"*. The disclosure is excellent — it is just absent from the sentence the PO
signs.

**Required to close:** one clause — *"flips the production **policy** door"* — in the plan's acceptance
list and in ADR 0178's Consequences. This is F-BLOCK-1's option-(b) wording obligation, which taking
option (a) satisfied for policies and not for the DEFINER surface.

### ✅ N5 · was LOW — **RESOLVED at `e331a095`, re-measured 2026-09-04**

The corrected header reads `20261003007100–…007330, **21**; pgTAP 401–413, **13**`. I counted: those
figures are right **for the ranges as stated**. But AE4 has since landed `20261003007340` (the
F-BLOCK-1 fix) and pgTAP `414` (the MED-1 gate) — measured, 22 and 14 respectively. So the durable
backend-surface map omits exactly the two artifacts that closed the two blocking findings, and CLAUDE.md
§ 6 step 5 requires it updated when the backend surface changed. ⚠ Note the shape: this is **not** an
arithmetic error like F-REC-1 was — the endpoints went stale — so "off by one" would be the wrong
correction to write down.

> **✅ CLOSED — verified.** The header now reads `20261003007100`–`…007340`, **22**; pgTAP `401`–`414`,
> **14**, and both figures match my independent counts exactly. ⭐ The fix moved the **endpoints**, not
> the arithmetic, which is the correction the finding actually called for.

### 🟡 N6 · LOW — **three** artifacts attribute to the QA review a phrase it does not contain, and one calls a correct statement wrong

> ⚠ **The lead referred to this finding as "N7". It is N6.** N7 is the acceptance-header / run-6 item
> below, which is untouched and still open. Acting on the wrong number would leave both unfixed.

`410` § 6.2's header: *"⛔ The review's phrase **"depth 2 on both arms"** holds for ONE arm of ONE row."*
`docs/features/ae4.md`: *"⛔ **The review's "depth 2" is WRONG** and was propagated here."*

**⚠ CHALLENGED BY THE LEAD, AND RE-MEASURED. THE FINDING STANDS AND IS WIDER THAN I FILED IT.**
The lead refuted this, hypothesising that my zero was an instrument failure: the review's inline
markdown bold (`invoked **directly** at`) would defeat a grep for the rendered sentence, and *"a
detector that finds nothing must be proven able to find something."* That reasoning is right in general
and I applied it. It does not apply here, for two reasons.

**1. The refutation measures a different string.** The lead measured
`grep -c "no hard-deny gate is invoked" …` → **1**, which is correct and which I never disputed. That
phrase is § 6.2's **caption**, quoted faithfully from the review's F-MAJOR-1 option (a) — I credited it
in § 2 as remediation (a) correctly applied. My finding is about a **different sentence in the same
header**, four lines below the caption, which does not quote the review but *characterises* it.

**2. My detector is proven able to find something, and the zero survives normalisation.** I re-ran it
with markdown emphasis and code ticks stripped and all whitespace collapsed, so `**both**`, a line wrap
or an indent cannot hide a match, and swept the whole tree rather than one file:

| needle, normalised | in `authz-ae4-gate-review.md` |
| --- | --- |
| `no hard-deny gate is invoked` *(the lead's string — the discrimination control)* | **1** ✅ instrument alive |
| `depth-2` · `depth 2` · `layer 1` · `one hop below` | **2 · 1 · 3 · 1** ✅ instrument alive |
| **`depth 2 on both arms`** · `depth 2 on both` · `on both arms` | **0 · 0 · 0** |

Tree-wide, the phrase occurs **five** times and **none is in the review**. Two are this report quoting
the finding. The three substantive ones split two-to-one *against* the attribution:

- `docs/followups/FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL.md:42` — *"…and **the AE4 hub recorded** 'depth 2
  on BOTH arms'"* ✅ **correct**, and it names the true source.
- `supabase/tests/410_…manifest.sql:472` — *"**The review's phrase** 'depth 2 on both arms'…"* ✗
- `supabase/tests/vectors/authz-enforcement-manifest.json:46` — *"**The review paraphrase** 'depth 2 on
  both arms'…"* ✗ — **a third site I had not named when I filed this.**

So three artifacts written in the same remediation attribute one phrase to two different sources, and
the follow-up has it right while the gate suite and the shipped manifest have it wrong.

**What the review actually wrote**, verbatim: *"there is a live **depth-2** instance it cannot see"*
(`:235`) about `app.is_tenancy_admin_of_for` — which § 4.2 confirms **is** at depth 2 — and *"through
`authz.assignment_facts` at **layer 1**"* (`:261`) about the other path, using *layer*, not *depth*. The
review never generalised across arms. The generalisation was introduced downstream.

**The second half, sharpened — it applies to the hub ALONE, and here is the exact statement.**
`docs/features/ae4.md:54`: *"⛔ **The review's "depth 2" is WRONG and was propagated here**"*. The
review's only depth-2 claim is the `:235` sentence above, and it is **correct** — I re-derived it on the
catalog. The hub therefore calls a correct statement wrong. `410:472` and the manifest do **not** do
this; they say the phrase *"holds for ONE arm of ONE row"*, which is true of the hub's phrase and merely
misattributed. So: **misattribution at three sites (one correct, two wrong); "calls a correct statement
wrong" at the hub only.**

This is the tree's own *"a paraphrase can invert the sentence it summarizes"* lesson, live, inside the
correction written to fix a paraphrase — and the near-miss above is worth keeping for the reason the
lead gave: **the next person who checks an attribution with grep should normalise the markdown first,
and prove the detector alive before trusting a zero.** Mine was; that is why the zero is evidence.

### 🟡 N7 · LOW — the acceptance document's always-read header is keyed to run 6, and run 6's retired `P2 PASS` still stands unmarked in place

The header banner declares *"STATUS after run 6 … MET"* and never mentions **run 7** (§ 17), which is the
run that actually scores P2 and which the follow-up cites for its discharge. Meanwhile § 16.4 rules P2
`UNRUN` until run 7 and § 6.1's P2 row is struck as `RETIRED`, but **§ 14's and § 15.2's run-6 rows still
read a bare `P2 PASS`** on the retired instrument, 270 lines before the retirement is disclosed. ⚠ Also,
the follow-up's phrasing *"run 6's P2 PASS was **withdrawn**"* is stronger than § 16.4's actual ruling
(*"stands as recorded … not retroactively converted into a fail"*); the accurate word is **not inherited
as evidence**.

### 🟡 N8 · LOW — one record clause mixes the two reviews' namespaces, and the finding it reads as closing is open

`docs/progress/authz-ae4.md:1247`: *"F-MAJOR-1 remediation (a) and **MAJOR-5** (`1d913daf`)"*. In context
that is IA-F9's MAJOR-5 (the door sweep). But the clause pairs it with a `F-`-prefixed finding from the
other review, and the broad review's **F-MAJOR-5** (gate 12's `--self-test`) is **still open**. A reader
takes the sentence to close it. Two review namespaces differing only by one character need the prefix on
both.

> **🟡 PARTIALLY CLOSED at `e331a095` — verified, and the commit message overstates it.** The hub is
> disambiguated in two places (`review: MED-1/…/MED-2 and **IA-F9's** MAJOR-5`, plus a new ⛔ *"Two
> different 'MAJOR-5's exist"* warning). But **the site this finding cites is untouched**:
> `docs/progress/authz-ae4.md:1247` still reads *"F-MAJOR-1 remediation (a) and MAJOR-5"*, and
> `git show --stat e331a095` confirms that commit changed only `docs/backend-state.md` and
> `docs/features/ae4.md`. Its message nonetheless says *"N1/N5/N8 cleared"*.
> ⭐ ⚠ **This is the record defect the same file self-reported one commit earlier** — *"a record that is
> true and incomplete reads as complete"* — reproduced by the commit that was clearing findings about
> records. The hub is the ephemeral artifact; `authz-ae4.md` is the durable one that outlives it, and it
> is the one still carrying the ambiguity. One prefix closes it.

---

## 6. ⛔ Could-not-verify — a work item, not a disclaimer

| # | Not verified by me | Who closes it |
| --- | --- | --- |
| CV1 | **`npm run e2e:prod` at HEAD.** Not re-run (a subagent cannot run the full gate). I verified only that nothing which ships has changed since the green: `git diff --name-only e3f986b1 HEAD` outside `docs/` is four test/vector files. ⚠ The hub itself notes this is **not the final pre-approval run** — C2 will land migrations and a second is owed. | lead |
| CV2 | **The full pgTAP suite** (`Files=262, Tests=8760`). I executed **5 of 262** files (409/410/411/413/414 — all green, plans matching). The rest is taken from `1d913daf`'s message. | lead, on a fresh `db reset` |
| CV3 | **`ARM=hat`, `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper`.** These mutate; my mandate was read-only. I ran the three read-only arms (`census`, `catalog`, `sites`) — all exit 0. | lead |
| CV4 | **The door sweep's own COVERED verdict** for `professional_profiles_select`. I confirmed the findings file is byte-unchanged since `e3f986b1` and its row reads `COVERED`, but did not execute the sweep. Its **write arm holds no verdict from anyone** (N3). | lead/backend |
| CV5 | **`410` § 8.1/§ 8.4's historical red-proofs** as captioned (at head `20261003007330`; with sites removed). Not re-runnable without reverting. I reproduced the **equivalent counterfactual** on the detector expression instead — § 4.1 — which is corroboration, not the same measurement. | — (accept as recorded) |
| CV6 | **Whether the PO actually approved ADR 0182** (N1). Only the PO can settle this. No agent-authored text, including mine, is evidence of it. | PO |
| CV7 | **The full 13-gate `npm run lint`, `typecheck`, and vitest.** I ran 5 of the 13 gates (all exit 0) and both generator self-tests; the remainder is from the record. | lead |
| CV8 | **The re-key's 6 204-cell equivalence proof** (0 disagreements, discrimination control firing exactly 5). Not re-run. I verified structurally instead: the new predicates are byte-identical in commission derivation to the four already re-pointed, both halves match by `md5`, and `409` runs 72/72. | backend |

---

## 7. What would turn this into `APPROVED`

Ranked by cost. Nothing here is large, and none of it is a security change.

> ✅ **N1 and N5 are done** (`e331a095`, re-measured); **N8 is half done** — the durable record still
> carries the ambiguous clause. The list below is what remains.

1. **F-MAJOR-3** — add `20261003007180`'s `door-sweep-targets:` marker (a comment; the migration is
   already applied), or record a ruling that ADR 0173 § 2 does not bind it.
2. **F-MAJOR-4b** — `411` § 5.1: make it capable of failing alone, or delete it and say why. An
   assertion that cannot fail is this phase's own subject.
3. **N3** — put MAJOR-5's sweep figures in the record with **both arms** named, and clear the two stale
   `docs/features/ae4.md` rows.
4. **N4** — one clause: *"flips the production **policy** door"*, in the plan's Gate AE4 acceptance list
   and ADR 0178's Consequences.
5. **F-MAJOR-2** — the record line, naming `ARM=catalog` and `ARM=sites` **by arm** (both HOLD at HEAD;
   figures in § 4.4 — you may cite them).
6. **F-MAJOR-5** — chain `--self-test` into gate 12 (both pass today; § 4.4).
7. **F-MAJOR-4a / 4c** — the `form_versions` mutated twin or an honest one-sidedness disclosure in 2.5's
   message; and `409` § 1's `LIKE` needles, using the `position()` idiom the same file already
   demonstrates at § 2.10c.
8. **N2** — exclude extension-owned functions from `ARM=census`'s domain, or state the ordering
   constraint in CLAUDE.md § 6 step 1.
9. **N6 · N7 · N8 (its open half), F-REC-2 / 3 / 5 / 6 / 8, LOW-1 / 2 / 3 / 5 / 8** — record and caption
    corrections, one line each.
10. **Re-run `e2e:prod`** if any of the above touches `src/` or a migration. On the current list, none
    does — items 2, 3, 7 and 8 touch migrations-as-comments, tests and `package.json` only.

**Out of scope for this verdict:** the C2 Tier-1 subset (F-BLOCK-2 item 2), which the PO has ruled gates
approval and which is tracked on its own hub.

---

## 8. What is right, and should not be lost in the list above

The engineering answer to F-BLOCK-1 is the best kind: the defect was fixed **and** the gate that could
not see it was built, in both directions, with a discrimination pair anchored on something correct by
design rather than on the defect — and it found something new on its first real run (§ 8.5's
`[UNDECLARED]` carrier) which was then **pinned as a visible disclosure** rather than absorbed. The
F-MAJOR-1 remediation is a disclosure that says so in its own label, in its caption, and in the manifest
header, with a depth table I could reproduce exactly; the follow-up stays open, correctly, and states
what would close it and what must **not** be mistaken for closing it. `414` is bound on the property
rather than the symptom and says why in both directions. `413`'s § 2d/§ 2e pin the **mechanism of an
absence** instead of widening a fixture. And the newest record entry volunteers two process defects in
its own recording — including an unreviewed commit — that nobody would have found otherwise.

Both prior reviewers found real defects and both were answered seriously. The residue I am refusing on
is a tail of one-line corrections, most of which the first review itself listed as its conditions.
**No security finding, no over-grant, no regression, no RLS hole.**

---

## 9. Amendment log

Kept because a report that is silently rewritten cannot be audited, and because one amendment was
forced by a challenge I had to test rather than accept.

| # | 2026-09-04 | Change |
| --- | --- | --- |
| A1 | rebased onto `e331a095` | HEAD moved twice mid-review (`cbe565c6` → `9f382b99` → `e331a095`), all `docs/`-only. Header, § 2, § 3, § 5 and § 7 re-read at `e331a095`. Counts now **21 discharged · 2 partial · 15 open** (was 20 · 2 · 16). |
| A2 | **N1 → RESOLVED** | The ADR 0182 approval contradiction is fixed and the fix names its own defect class. The verdict's first ground is withdrawn; grounds (1) and (2) in § 1 each carry the refusal alone. IA-F9 **MAJOR-4 → DISCHARGED**. |
| A3 | **N5 → RESOLVED** | `backend-state.md` now reads `…007340, 22` / `401–414, 14`, matching my independent counts exactly. **F-REC-1 → discharged** (it had gone re-stale mid-review). |
| A4 | **N8 → PARTIALLY RESOLVED** | Hub disambiguated; the durable record (`authz-ae4.md:1247`) untouched, while the clearing commit's message claims otherwise. |
| A5 | **N6 → CHALLENGED, RE-MEASURED, WIDENED** | The lead refuted the attribution half, hypothesising my grep was defeated by inline markdown bold. ⭐ The hypothesis is sound in general and **wrong here**: the refutation measured a *different string* (§ 6.2's caption, which I had already credited), and my zero survives markdown-stripped, whitespace-collapsed, tree-wide search whose discrimination control — the lead's own phrase — returns 1. The finding **stands** and gained a **third site** I had missed (the shipped manifest JSON). Its second half is narrowed to the hub alone, with the exact sentence named. |

⭐ **A5 is the one worth keeping.** *"A detector that finds nothing must be proven able to find
something"* is this tree's own standing lesson and it was correctly aimed at me; the right answer was to
run the control, not to concede. Anyone re-checking an attribution in this tree should normalise the
markdown before grepping — and prove the instrument alive on a phrase that IS present — before treating
a zero as evidence.

— `qa`, 2026-09-04
