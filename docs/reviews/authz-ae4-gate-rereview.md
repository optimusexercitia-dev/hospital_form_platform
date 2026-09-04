# QA RE-REVIEW — Gate AE4, both prior review verdicts re-signed

# ✅ VERDICT: APPROVED
*(round 1 was **CHANGES REQUESTED**; flipped at round 3 on measurement — see § 1 and the § 9 log)*

- **Subject:** the findings of the two open AE4 QA reviews, re-established at the current HEAD —
  [`authz-ae4-gate-review.md`](./authz-ae4-gate-review.md) (branch `authz-ae4-catalog` @ `e897b452`,
  2026-09-02) and [`authz-ae4-if9-statement-scoped-review.md`](./authz-ae4-if9-statement-scoped-review.md)
  (branch `authz-ae4-scope-reaches-fix` @ `9f7fa68d`, 2026-09-03).
- **Branch:** `main` · **Commit:** `1ac811fe` · **Date:** 2026-09-03/04 · **Reviewer:** `qa`
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

**⚠ HEAD moved FIVE times during this review, and a clean `git status` is an instant, not a lease.**
The brief named `cbe565c6`; then `9f382b99`, `967caf0a`, `27ec066a`, `e331a095`, `f6a8ec28` and
`1ac811fe` landed while I measured — the last of which reworks six findings this report had recorded as
open. **This report is therefore versioned, not final-on-first-write**, and § 9 logs every amendment.
**Everything below is read at `1ac811fe`.** ⛔ The catalog is unchanged across all of it — 523 migration
files = 523 rows, head `20261003007340` — so `1ac811fe`'s only SQL-touching edit is a **comment-only**
annotation to an already-applied migration, and every catalog measurement in § 4 still stands. Nothing
that ships changed, so the `e2e:prod` green still describes the tree.

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

I refused to sign at rounds 1 and 2, on two grounds: ten of the broad review's own findings still open
— three of them named in its own `APPROVED` conditions — and new findings of my own. **Both grounds are
now gone, and they went by measurement rather than by assertion.** At `1ac811fe` the five F-MAJOR items
and F-REC-8 were each closed with a claimed failure proof; I re-ran or re-constructed **five of those
six proofs myself** (§ 4.5) rather than crediting the claims, and every one reproduced. `f6a8ec28`
closed F-REC-2 and F-REC-3; `967caf0a` closed four of my own new findings; `e331a095` closed two more.

**⛔ The verdict flipped because I measured, not because the list got shorter.** The single most
load-bearing check is F-MAJOR-4b, which was my own finding and whose repair could have been cosmetic: I
constructed the full before/after contrast — declare a sixth label in `authz.scope_kind`'s domain CHECK
and the **new** § 5.1 reds while § 4.1 stays 11/11, and **under the identical mutation the old § 5.1
returns 0 and stays green**. Both halves ran. That is the difference between an assertion repaired and
an assertion reworded, and it is the half a one-directional check would have missed.

**What remains open is not blocking and I say so explicitly.** It is: the **C2 Tier-1 subset**, which is
outside my scope and which the PO has ruled gates approval; one **PO-deferred** runbook deferral that
carries an explicit ⛔ DO-NOT-RUN hazard banner naming its own remedy; and a tail of **eight LOW record
and caption corrections**, every one of which the review that filed it classified as a non-blocking
follow-up. None makes a gate vacuous, a claim false, or a door open. They are listed in § 7 as
pre-Record housekeeping, and the Record step's own gates (`lint:progress`, `lint:registers`) will hold
them.

> ⚠ **This verdict is about the two reviews' findings, not about Gate AE4 as a whole.** PO approval
> remains HELD until C2 closes; a second `e2e:prod` is owed after C2 lands migrations. I am re-signing
> the two open review verdicts, which the gate's acceptance list named as its last open item — nothing
> more.

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
| **F-MAJOR-3** | `20261003007180` is a rewrite migration with no `door-sweep-targets:` marker | ✅ **DISCHARGED (`1ac811fe`)** | Four marker lines present. I verified the edit is **comment-only** (the diff's non-comment, non-blank lines are empty), the applied catalog is unchanged (523 files = 523 rows, head `20261003007340`), and the precedent `9d8ac6d3` is real (it annotated an already-applied migration the same way). ⭐ **And I ran the deriver rather than trusting the marker's presence**: `BASE=1ac811fe^ TIP=1ac811fe scripts/door-sweep-cases.sh` → **exit 0, `DERIVED — 4 case(s)`, read arm 4 / write arm 4**, naming all four rewritten bodies. Before the marker a runtime-rewrite migration derived nothing. The reasoning holds too: the deriver greps migration *text*, so the file is the declaration's home, and nothing that ships changed, so the E2E green survives. |
| **F-MAJOR-4a** | `409` § 2.5 `form_versions` baseline with no mutated twin | ✅ **DISCHARGED (`1ac811fe`)** | New § 2.9a, `throws_ok … '42501'` on a fresh `version_number` 9092 so the unique index's `23505` cannot be misread as the authority gate, with § 2.5 named as its discrimination half (proving `authenticated` holds INSERT, so the 42501 is the policy and not a missing grant — the exact trap § 2.6d records). ⭐ **Proof re-constructed by me**: a doctored copy that restores the one `authz.role_permissions` row across § 2.9a alone yields **`ok=72 notok=1`, and the failure is § 2.9a**. As committed the suite is **73/73**. |
| **F-MAJOR-4b** | `411` § 5.1 provably incapable of failing alone | ✅ **DISCHARGED (`1ac811fe`) — repaired, not deleted** | § 5.1 re-pointed at the **declared** vocabulary (`authz.scope_kind`'s domain CHECK) minus `capability_plane` — a grain § 3/§ 4 genuinely do not entail — plus a new three-part discrimination control § 5.2 that a subtraction-built expectation needs. ⭐ **Full contrast constructed by me** (§ 4.5): under a sixth declared label, **new § 5.1 RED · § 4.1 still 11 · old § 5.1 still 0 (green)**. Both halves ran, so the repair is real and not a rewording. Suite is **8/8**. |
| **F-MAJOR-4c** | `409` § 1.1/§ 1.3 unquoted, unanchored `LIKE` needles | ✅ **DISCHARGED (`1ac811fe`)** | `pg_temp.code_sites()` now uses `position('''' \|\| pm.code \|\| '''' in src)`. ⭐ **Verified both ways by me**: on the live catalog the two needles are equivalent (`EXCEPT` **0 in both directions**, 4 pairs each), and under **planted input the old needle is demonstrably wrong on both of its hazards** — a body carrying `'x_commission.forms.edit_suffix'` is counted as an enforcement site by `LIKE` and rejected by `position` (quote anchoring), and a body carrying `'org.caseXvocabulary.manage'` matches `LIKE '%org.case_vocabulary.manage%'` because `_` is a wildcard (**7 live codes contain an underscore**). |
| **F-MAJOR-5** | generators' `--self-test` invoked by no gate | ✅ **DISCHARGED (`1ac811fe`)** | `lint:authz-vectors` is now `--self-test && --check` per generator; **gate count still 13**; `docs/lint-gates.md` updated at both places that recorded it as a gap. Gate runs **exit 0**. ⭐ **Red proof constructed by me, both polarities in the same scratch tree** so the tree is not the variable: blinding `coverage()` to report zero failures → **32 `NOT CAUGHT`, exit 1**; the unmodified generator beside it → **0 `NOT CAUGHT`, 33 caught, exit 0**. `&&` propagates the nonzero exit (read from `package.json`, not assumed). ⚠ My count differs from the implementer's claimed 31 because the doctoring differs — same conclusion, independently reached. |
| **F-REC-1** | `backend-state.md` said 17 where 18 | ✅ **DISCHARGED** (went re-stale mid-review; re-closed at `e331a095`) | Header read `…007330, **21**; pgTAP 401–413, **13**` — internally correct for the ranges stated, but the *endpoints* had gone stale (**N5**). Now reads `20261003007100–…007340, **22**; pgTAP 401–414, **14**`, which matches my independent counts **exactly** (22 and 14). |
| **F-REC-2** | ADRs 0177 / 0178 carry literally opposite sentences | ✅ **DISCHARGED (`f6a8ec28`)** | Both now state the reconciled both-directions form, and 0178 explains which converse each was refusing rather than deleting one side. |
| **F-REC-3** | matrix § 12.8 "Granted to `staff_admin` and `org_admin`" vs catalog | ✅ **DISCHARGED (`f6a8ec28`)** | Row 43 carries a dated `⛔ CORRECTED 2026-09-04 against the live catalog` stamp; row 30 now says *"as legacy REACH, not as a catalog row"*, which is the distinction the finding turned on. |
| **F-REC-4** | matrix row 1 says "(7 ALL)" | ✅ **DISCHARGED** | Row 1 now names **six** `ALL` policies, reclassifies `form_block_library` as a `D` site with no write policy, discloses `form_item_validations` as an unreachable backstop, and rules on the DEFINER form functions (correcting "8" to **22**). |
| **F-REC-5** | `role-catalog.ts` "Pure, no I/O" vs a value import | ⛔ **STILL OPEN — LOW, non-blocking** | Comment and value import both unchanged. Correct today; a future `server-only` marker on `session-grants.ts` would break `next build` in three client components with no gate warning. |
| **F-REC-6** | mid-phase review carries no verdict line | ⛔ **STILL OPEN — LOW, and now largely moot** | No verdict, no banner. ⚠ Moot in substance because **this file** carries the verdict for its subject; the residual value is only that a reader landing on the mid-phase file cannot tell it from an abandoned one. |
| **F-REC-7** | handoff live in the tree | ✅ **DISCHARGED** | `docs/handoffs/` holds `README.md` only; `authz-ae4-catalog.md` deleted in `35090ac1`, narrative folded into the record. |
| **F-REC-8** | landing seam divergence unpinned | ✅ **DISCHARGED (`1ac811fe`) — and the finding was partly mis-stated; see § 4.5** | New § 1.9a pins the hospital **identity** (id + slug) against the membership's own `hospital_id`; § 1.9b is its discrimination half. ⭐ **Proof re-constructed by me**: corrupting only the slug in `session_context()` in-transaction yields **`ok=26 notok=1`, the failure being § 1.9a, while § 1.9 stays green** — so § 1.9 could not have caught it. Suite is **27/27** as committed. |

**Broad review: 16 discharged · 1 partially discharged · 3 still open** (of which one — C2 — is
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
| **MAJOR-5** | door sweep's read-arm verdict unconfirmed | ✅ **DISCHARGED (`27ec066a`)** (was partial — see N3) | The re-run itself was real (fresh reset, `CASES="professional_profiles_select"`, **COVERED**, exit 0 read bare, findings file byte-unchanged — which I corroborated: that file's last touch is `e3f986b1` and its row still reads `COVERED`). My residual N3 was that the figures lived only in a commit message and only one arm was reported; `27ec066a` puts **both arms** in the record and **attributes** the write arm's zero to the harness's own apparatus gap rather than leaving it silent. |
| **MED-2** | P7 never shown able to fail | ✅ **DISCHARGED** | § 13.2 amended: P7 now ships a negative control on the pre-change predicate, run 6's PASS is explicitly recorded as *"a bare positive"*, and the control is measured — `CONTROL [hashed=f,loops1=f,never=f]`. |
| **MED-3** | `413` § 5 exercised by 2 rows × 1 principal | ✅ **DISCHARGED** | Population widened to fixture rows ∪ a deterministic 40-row slice, principals from `select distinct pid from f413cells`, and a **§ 5b non-vacuity guard** added requiring both polarities. |
| **MED-4** | `413` § 2 exercises 2 of 4 `CASE` branches | ✅ **DISCHARGED as a documented bound** | New § 2d/§ 2e pin the reached branch set by name and the **mechanism of each absence separately** (`commission→hospital` unreachable because no permission resolves at hospital scope; `hospital→organization` because no hospital-scope membership entails an org-scope permission) — falsifiable assertions, not prose. |
| **LOW-1** | `413` test 5's caption overclaims what `pronargs = 0` measures | ⛔ **STILL OPEN** | Assertion and caption unchanged; no `prosrc` probe added. |
| **LOW-2** | migration postflight claims "BOTH polarities" without measuring | ⛔ **STILL OPEN** | Comment unchanged; no later migration corrects it. |
| **LOW-3** | three stale assertion messages | 🟡 **1 of 3 FIXED — 2 STILL OPEN, LOW** | `401`'s *"the eight `authz.*` functions"* is gone. Still live, and now **self-contradictions inside one file**: `409` asserts FOUR pairs at § 1.1 while its prose says *"three hits"*; `401` asserts 27 probes while its prose says *"fifteen falses"*. No gate can see assertion prose. |
| **LOW-4** | FUP title + § 13.4's stale "DC1's new subject" | ✅ **DISCHARGED** | FUP title rewritten; § 13.4 **struck rather than deleted**, with the reason recorded. |
| **LOW-5** | ADR 0182 carries no `Amends:`; ADR 0178's as-built record stale with no back-pointer | ⛔ **STILL OPEN** | 0182's header has neither label; `INDEX.md` shows its amends column empty. ADR 0178 has no back-pointer block and its stale `professional_profiles` as-built text is unannotated. ⚠ ADR **0183** likewise carries **no `Approved:` line at all** — the same class, one ADR later. |
| **LOW-6** | `8.3 ms` vs `~2.8 ms` | ✅ **DISCHARGED** | Reconciled in **both** directions with an explicit apparatus note in each (pre-commit `8.3 ms` vs post-commit `3.842 ms`, buffer count `402` identical across all three). |
| **LOW-7** | `⭐ AMENDED` markers on unamended rows; DC2 unmarked | ✅ **DISCHARGED** | Markers gone from P2/P3 (now `RETIRED` / `NARROWED`); **DC2 now carries the marker** with the "re-aimed AFTER it FAILED" qualifier attached. |
| **LOW-8** | three-vs-one, no bridging note | ⛔ **STILL OPEN** | FUP still says three; the backlog still records one; nothing states why. |

**IA-F9 review: 13 discharged · 1 partially discharged · 4 still open.** ⚠ Two rows moved mid-review:
MAJOR-4 from *contested* to *discharged* at `e331a095` (**N1**), and MAJOR-5 from *partial* to
*discharged* at `27ec066a`, which put both sweep arms in the record and attributed the write arm's zero
(**N3**). The four open are LOW-1, LOW-2, LOW-5 and LOW-8, and the partial is LOW-3 — all filed by that
review itself as non-blocking follow-ups. ⭐ LOW-3 is **1 of 3 fixed**: `401`'s *"the eight `authz.*` functions"* is
gone, but `409`'s *"three hits"* (now four) and `401`'s *"fifteen falses"* (now 27) both survive.

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

### 4.5 Round 3 — the six closures at `1ac811fe`, re-proven rather than credited

Each was asserted to come with a failure proof. **I re-ran or re-constructed five of the six myself.**
All three suites are green as committed: `409` **73/73**, `411` **8/8**, `292` **27/27**.

| finding | the proof I constructed | result |
| --- | --- | --- |
| **F-MAJOR-4b** ⭐ | Declare a **sixth** label in `authz.scope_kind`'s domain CHECK, in a rolled-back transaction, and evaluate three expressions before and after. The fixture was **extracted from `411` itself**, never hand-typed, and the old § 5.1 was taken **from git**, not from the new file's description of it. | baseline → § 4.1 = 11 · new § 5.1 **PASS** · old § 5.1 = 0. after → § 4.1 = **11 (still passes)** · new § 5.1 **RED** · old § 5.1 **= 0, still green**. ⭐ **Both halves ran.** The new assertion fails independently of § 4.1 — the property my finding said it lacked — and the old one is confirmed blind under the identical mutation. Domain intact after rollback. |
| **F-MAJOR-4a** | Doctor a copy of `409` so the one deleted `authz.role_permissions` row is restored across § 2.9a **alone** (with the role juggling the file's own mutation block uses), then read the TAP counts. | **`ok=72 notok=1`**, and the single failure is **§ 2.9a**. Exactly the claimed shape, 1 of 73. |
| **F-MAJOR-4c** | (a) Compare the old `LIKE` needle and the new `position` needle on the live catalog with `EXCEPT` in **both** directions. (b) Plant two function bodies, one per hazard. | (a) **0 / 0**, 4 pairs each — behaviour-preserving today. (b) the old needle counts `'x_commission.forms.edit_suffix'` as an enforcement site (no quote anchoring) **and** matches `'org.caseXvocabulary.manage'` against `org.case_vocabulary.manage` (`_` is a `LIKE` wildcard; **7 live codes contain an underscore**). The new needle rejects both. |
| **F-MAJOR-5** | Copy the generator into a scratch tree, blind `coverage()` so it reports zero failures, and run `--self-test` beside an unmodified copy in the **same** tree. | blinded → **32 `NOT CAUGHT`, exit 1**; control → **0 `NOT CAUGHT`, 33 caught, exit 0**. `&&` propagates the exit (read from `package.json`). ⚠ 32 vs the claimed 31 — different doctoring, same conclusion. |
| **F-REC-8** | Rewrite `session_context()` in-transaction so `g.hospital` keeps its id and parent org but loses its **slug identity**, with the plant asserting it landed. | **`ok=26 notok=1`**, the failure being **§ 1.9a**, while **§ 1.9 stays green** — so § 1.9 provably could not have caught it. Live function intact after rollback. |
| **F-MAJOR-3** | Run the deriver over the commit that added the marker, reading the exit code bare. | **exit 0, `DERIVED — 4 case(s)`, read arm 4 / write arm 4**, naming all four rewritten bodies. Marker edit confirmed **comment-only**; applied catalog unchanged. |

**⭐ My ruling on F-REC-8's framing, since the implementer raised it.** The finding was **substantively
correct and partly mis-stated**, and both halves of that are worth recording. Mis-stated: it read as
though nothing about `g.hospital` was asserted, when § 1.9 already pinned non-nullness *and* the parent
org — so the gap was narrower than the finding implied. Correct: the review's own words were *"projects
**that column** into `g.hospital`"*, and projecting **that column** is exactly an identity claim, which
is exactly what was missing and exactly what § 1.9a now pins. Its remedy — *"one assertion closes it"* —
was also right. ⛔ So *"mis-stated"* overstates it in the other direction; the accurate word is
**imprecise about the size of the gap, correct about its location**. The implementer is separately right
that § 1.9's own caption (*"carries hospital + parent org"*) over-claimed relative to what it measured.

**One observation, not a finding.** `supabase_migrations.schema_migrations.statements` is non-null and
holds the *applied* statements, so a comment-only edit to an applied migration leaves the stored text
and the file text divergent. It is benign — `db reset` re-applies from files, and `db push` will not
re-run an existing version — and it is precedented (`9d8ac6d3`). Recorded so the next reader does not
rediscover it as drift. ⚠ Separately: the marker's *value* is only realised when someone runs the four
cases it now makes derivable; the deriver prints a **selection, not a verdict**, and says so.

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

### ✅ N2 · was MEDIUM — **RESOLVED at `967caf0a`, re-measured** — `ARM=census`'s domain had no extension exclusion, and CLAUDE.md § 6 step 1 orders pgTAP and the arms together

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

> **✅ CLOSED — verified.** `p0-authz-invariant.sh` now carries BOTH polarities of the predicate —
> `NOT_EXTENSION_OWNED` / `IS_EXTENSION_OWNED`, keyed on `pg_depend … deptype = 'e'`, the same property
> pgTAP `100` uses — the second half feeding a control. ⭐ I re-tested the hazard end-to-end in round 3:
> I installed `pgtap` to run three suites and then dropped it, and `ARM=census` returned **exit 0 both
> before and after** — where at round 2 the same installation drove it to exit 1 with ~700 pgTAP
> UNKNOWNs.

### ✅ N3 · was MEDIUM — **RESOLVED at `27ec066a`** — MAJOR-5's re-run result existed only in a commit message, and only one of the sweep's two arms was run

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

> **✅ CLOSED — verified.** The record now names both arms and **attributes** the write arm's zero to the
> harness's own apparatus gap rather than leaving it silent — the stronger of the two closures I
> offered, since an unexplained zero is exactly what the standing rule warns about. IA-F9 **MAJOR-5**
> moves to discharged with it.

### ✅ N4 · was MEDIUM — **RESOLVED at `967caf0a`** — the "flips the production door" clause was unqualified where the PO reads it

`docs/plans/authz-evolution.md:1077` (§ Gate AE4's acceptance list) and `:1032`, and ADR 0178:

> the grant-deletion mutation flips the **production door** for each of the three representatives

At HEAD the oracle qualifies this and the plan does not. Matrix row 1 now says *"22 DEFINER functions
gate form-family tables on `is_staff_admin_of` and none is re-keyed, so 'the production door' for this
row means the **policy** door"*, and discloses that one of the six policies is unreachable; `409`
§ 2.10c pins the same bound as an assertion captioned *"THE DISCLOSED LIMIT OF REPRESENTATIVE 1, PINNED
SO IT CANNOT BE READ AS DONE"*. The disclosure is excellent — it is just absent from the sentence the PO
signs.

**Required to close:** one clause — *"flips the production **policy** door"* — in the plan's acceptance
list and in ADR 0178's Consequences.

> **✅ CLOSED — verified.** The qualified phrase now appears in **both** `docs/plans/authz-evolution.md`
> and ADR 0178, so the sentence the PO signs carries the bound the oracle and `409` § 2.10c already had.
 This is F-BLOCK-1's option-(b) wording obligation, which taking
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

### ✅ N6 · was LOW — **RESOLVED at `967caf0a`, re-measured** — three artifacts attributed to the QA review a phrase it does not contain

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

> **✅ CLOSED — verified at all three sites**, including the one I had missed when I filed it: `grep -c`
> now returns **0** for *"The review's phrase"* in `410`, **0** for *"The review paraphrase"* in the
> shipped manifest JSON, and **0** for *"the review's 'depth 2' is WRONG"* in the hub.

### ⛔ N7 · LOW — **STILL OPEN** — the acceptance document's always-read header is keyed to run 6, and run 6's retired `P2 PASS` still stands unmarked in place

The header banner declares *"STATUS after run 6 … MET"* and never mentions **run 7** (§ 17), which is the
run that actually scores P2 and which the follow-up cites for its discharge. Meanwhile § 16.4 rules P2
`UNRUN` until run 7 and § 6.1's P2 row is struck as `RETIRED`, but **§ 14's and § 15.2's run-6 rows still
read a bare `P2 PASS`** on the retired instrument, 270 lines before the retirement is disclosed. ⚠ Also,
the follow-up's phrasing *"run 6's P2 PASS was **withdrawn**"* is stronger than § 16.4's actual ruling
(*"stands as recorded … not retroactively converted into a fail"*); the accurate word is **not inherited
as evidence**.

### ✅ N8 · was LOW — **RESOLVED at `1ac811fe`** — one record clause mixed the two reviews' namespaces

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
>
> **✅ CLOSED — verified.** The ambiguous clause is gone from `docs/progress/authz-ae4.md`, replaced by an
> explicit disambiguation naming *"the broad review's F-MAJOR-5"* by prefix. ⚠ That new line records
> F-MAJOR-5 as still open; it is **discharged** as of `1ac811fe` (§ 2), so it needs one more touch at the
> Record step — a consequence of the fix, not a defect in it.

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

## 7. What remains — pre-Record housekeeping, none of it blocking

**Nothing in this list withholds the verdict.** Every item is a caption, comment or record correction
that the review which filed it classified as non-blocking, plus two items that are not mine to close.
Ranked by who owns them.

**Not mine to close, and not defects:**

1. **F-BLOCK-2 · 2 — the C2 Tier-1 subset.** Outside my scope; the PO has ruled Gate AE4's approval
   held until it closes. Tracked on its own hub.
2. **F-BLOCK-2 · 3 — rollback runbook § 6.2**, still scoped to four policies under an explicit ⛔
   DO-NOT-RUN banner naming its own remedy. **PO-deferred**, tracked as
   `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR`. A disclosed deferral, not a gap.

**One-line corrections, owed before the Record step:**

3. **N7** — the acceptance document's always-read header says *"STATUS after run 6 … MET"* and never
   mentions **run 7**, which is the run that scores P2; and § 14 / § 15.2's run-6 `P2 PASS` rows still
   stand unmarked on the retired instrument, 270 lines before the retirement is disclosed.
4. **LOW-3 (2 of 3)** — `409` asserts FOUR pairs while its prose says *"three hits"*; `401` asserts 27
   probes while its prose says *"fifteen falses"*. Both are now self-contradictions inside one file.
5. **LOW-5** — ADR 0182 carries no `Supersedes:`/`Amends:` label and ADR 0178's stale as-built record of
   the `professional_profiles` surface has no back-pointer; **ADR 0183 still carries no `Approved:` line
   at all**, which is the class N1 was about, one ADR later.
6. **LOW-1** — `413` test 5's caption claims a binding (`auth.uid()` bound internally) that `pronargs = 0`
   does not measure. Covered behaviourally by § 3b/§ 3c; fix the caption or add the assertion.
7. **LOW-2** — the `20261003007320` postflight comment claims *"BOTH polarities"* while nothing measures
   that both are present.
8. **LOW-8** — a follow-up records three functions outside `PRED_DOMAIN`, `authz-unswept-backlog.txt`
   records one, and nothing bridges the two counts.
9. **F-REC-5** — `role-catalog.ts`'s *"Pure, no I/O"* comment beside a value import. Correct today; a
   future `server-only` marker on `session-grants.ts` breaks `next build` in three client components
   with no gate warning. Add the caveat at the import site.
10. **F-REC-6** — the mid-phase review still carries no verdict line. Largely moot now that **this** file
    carries the verdict for its subject; a one-line "not a verdict-bearing artifact" banner closes it.

**Two consequences of the round-3 fixes, not defects in them:**

11. `docs/progress/authz-ae4.md`'s new disambiguation line records the broad review's **F-MAJOR-5** as
    still open; it is **discharged** as of `1ac811fe`. One touch at the Record step.
12. `20261003007180`'s marker now makes **four** gates derivable that were previously invisible to the
    diff-scoped sweep. The deriver prints a **selection, not a verdict** — running those four is the
    thing that realises the marker's value, and it is not owed by this verdict.

⛔ **Still owed by Gate AE4 itself, and outside this verdict:** a second `e2e:prod` after C2 lands
migrations, and the PO's approval. Neither is a finding.

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

Round 3 deserves its own sentence. Six findings were closed in one commit and **every one arrived with
a constructed failure proof rather than a claim** — and where I re-built those proofs independently,
all five reproduced, including the two whose repairs could most easily have been cosmetic. The
`411` § 5.1 repair in particular was made by finding the one grain § 3/§ 4 do not entail, rather than by
deleting the assertion or rewording its caption; that is the harder and the right answer.

Both prior reviewers found real defects and both were answered seriously. **No security finding, no
over-grant, no regression, no RLS hole** — and now no unmet condition either, beyond the C2 carve-out
that is not mine and the housekeeping in § 7.

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

| A6 | rebased onto `1ac811fe`; **VERDICT FLIPPED to APPROVED** | Round 3 closed F-MAJOR-3 / 4a / 4b / 4c / 5 and F-REC-8 (`1ac811fe`), F-REC-2 / F-REC-3 (`f6a8ec28`), and my N2 / N3 / N4 / N6 (`967caf0a`, `27ec066a`). **I re-ran or re-constructed five of the six round-3 proofs myself** (§ 4.5) instead of crediting them; all five reproduced. IA-F9 MAJOR-5 moved partial → discharged with N3. Counts now **36 discharged/resolved · 2 partial · 8 open** — the two reviews contributing 29 · 2 · 7 (broad 16 · 1 · 3 of 20; IA-F9 13 · 1 · 4 of 18) and my own eight findings 7 · 0 · 1. ⚠ Both partials and all eight opens re-derived from this file's own tables rather than tallied by hand; the first hand count of this line was wrong twice. None is blocking. Also ruled on the implementer's claim that F-REC-8 was *mis-stated*: **imprecise about the size of the gap, correct about its location** — recorded in § 4.5 rather than accepted as filed. |

⭐ **A6's discipline, stated so the flip is auditable.** A verdict that moves when a list gets shorter is
not a verdict. The flip rests on **five proofs I constructed myself**, of which the load-bearing one is
F-MAJOR-4b's two-sided contrast: a repair that only reds the new assertion is indistinguishable from a
rewording until you show the **old** assertion staying green under the identical mutation. I ran both
halves. Had only the first half held, F-MAJOR-4b would still be open and this would still say CHANGES
REQUESTED.

⭐ **A5 is the one worth keeping.** *"A detector that finds nothing must be proven able to find
something"* is this tree's own standing lesson and it was correctly aimed at me; the right answer was to
run the control, not to concede. Anyone re-checking an attribution in this tree should normalise the
markdown before grepping — and prove the instrument alive on a phrase that IS present — before treating
a zero as evidence.

— `qa`, 2026-09-04
