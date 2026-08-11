# QO·B — Quality-office oversight, Phase B: the org_admin/hospital_admin CONTENT WALL

**COMPLETE 2026-08-09** · QA **APPROVED (r2)** ([review](../reviews/phase-QO-B-review.md) — r1 ⛔
BLOCKER remediated by M7 → r2 ✅ re-proved on the reviewer's own fixtures) · **human approval
2026-08-09** · ADR [0100](../decisions/0100-quality-office-oversight.md) **D12** · PO rulings
**Q1–Q9** (2026-08-08) · [inventory + classification + findings](../plans/quality-office-oversight-phase-b-inventory.md)
· [author self-audit](../reviews/phase-QO-B-self-audit.md) · branch `feat/quality-office-oversight`
→ `main`. *(At close this read "LOCAL-ONLY — no push, per standing PO hold; remote `db push` pending
with the PO." **Both discharged 2026-08-10:** pushed to `origin`, and the remote `db push` applied all
**12** `2026091[5-7]*` migrations — catalog-verified, remote total 345 == 345 local files.)*

**⚠ Registered as OPEN at close (live in PROGRESS.md — Bug Log + Follow-ups FUP-QOB-1/FUP-QOB-2):**
BUG-QOB-004 (referrals reach ruling) · FUP-QOB-1 (J1c provisional pin ratification) · the
2026-08-09 lead-rulings Decisions row (ratification package). All parked for a future session by
PO instruction 2026-08-09.

**The phase's transferable lesson, proven twice at two levels:** a CUT executed by enumeration
diverged from the ratified list both times (M1–M4 cut tables and left 16 DEFINER doors → M5/M6;
M4 cut a proxy population and left ~17 §4.4 doors → M7). The end-of-any-subtractive-phase check
is: **re-read the ratified list against the live catalog, item by item** — no harness performs it,
and postconditions must assert CORRESPONDENCE to enumerated names, never a count.

---

The task table, gate evidence and closed-bug records below are rotated verbatim from PROGRESS.md
at the §6 Record step (2026-08-09).

### ⬛ QO·B task table (final state; the "BUILD COMPLETE, QA NOT STARTED" era header removed at rotation — the phase closed QA-APPROVED r2 + human-approved 2026-08-09)

ADR [0100](docs/decisions/0100-quality-office-oversight.md) **D12** · PO rulings **Q1–Q9**
(2026-08-08) · [inventory + classification + findings](docs/plans/quality-office-oversight-phase-b-inventory.md)
· [author self-audit](docs/reviews/phase-QO-B-self-audit.md) (⚠ **not** a QA review, issues no verdict)
· branch `feat/quality-office-oversight`, **13 commits, LOCAL-ONLY** (no push, per standing PO hold).

| # | Task | State |
|---|---|---|
| B.0 | `311` §6 S3/S4 fixture isolation (QA r3 MINOR, *"land before Phase B"*) | ✅ already landed (`f140905`) — verified, not re-done |
| B.1 | Catalog inventory: 87 policies + 144 functions route an admin predicate | ✅ committed |
| B.2 | **PO ratifies the content-vs-configuration classification** (D12 step ②) | ✅ Q1–Q9 ratified |
| B.3 | M1 responses · M2 documents · M3 indicator measurements · M4 18 case write doors | ✅ |
| B.4 | **M5 response DOORS · M6 document DOORS** — the hole M1–M4 left | ✅ |
| B.5 | A/B matrix · `b1` mutation audit (17/17) · ARM gates · 3 door sweeps | ✅ |
| B.6 | E2E `qob-org-admin-content-wall.spec.ts` | ✅ 6/6 GATE GREEN |
| B.7 | **`qa` review (gate step 3)** → **human approval (step 4)** → Record (step 5) | ⛔ **r1 CHANGES REQUESTED** ([review](docs/reviews/phase-QO-B-review.md)) → remediated in B.15 → awaiting r2 |
| B.15 | **backend: QA r1 BLOCKER-1 + MAJOR-1 remediation — M7** (`20260916000000_qob_m7_case_door_wall_completion.sql`). M4 cut a PROXY population (*"functions carrying `assert_not_case_excluded`"*, a different wave's enumeration), leaving ~16 §4.4 doors armed; QA reproduced live writes at both tenancy tiers. **M7 derives the population from the RATIFIED §4.4 LIST ITSELF**, item by item against the live catalog: **20 functions edited** (16 armed doors incl. the QA-listed `remove_case_participant`/`record_recusal`/`case_viewer_capabilities` + the measured `add_case_participant`/`bulk_create_cases`/`lift_recusal` + 4 masked-token strips on `get_case_detail`/`list_my_cases`/`create_case`/`create_case_from_template`) + **3 `case_events` policy arms**. Postcondition asserts **CORRESPONDENCE to the enumerated §4.4 names**, not a count. **MAJOR-1:** `cancel_case`/`close_case` (the two doors that actually exhibited silent-success — `set_case_outcome`/`update_case_narrative_body` deny at their RLS lookup, measured) gain a **zero-row not-found guard**. Re-measured post-M7: every door DENIES both tiers, `orgadmin.b`+coordinator controls discriminate. Keystoned `314` **§11 +35 (plan 111)**; `b1` **31→39 cases, 39/39 RED-PROVEN** (2 vacuous arm-restores deliberately omitted — masked tokens behind an RLS lookup, covered by 11.34 catalog correspondence), RESTORE byte-identical, CONTROLS 111+53. Fixed **229** (its M1·2 positive twin used `sa_y`/org_admin to lift a recusal as a fixture side-effect — M7 removed that reach, cascading exclusion into 12 downstream tests; flipped to a wall assertion + direct recusal teardown, 89/89). Corrected the false `case-narratives/actions.ts` comment. **Gates:** fresh reset **329=329** · pgTAP **175f/5616/PASS** · diff-scoped door sweep **0 BLIND / 0 ERROR** (case_events_select COVERED; 2 write-check policies are narrowings, the ADR 0079 Amdt 5 write-path gap, pinned by 11.33) · `ARM=census`+`ARM=floor` **HOLD** · lint 0/0 · tsc · vitest 1194. Re-opened **BUG-QOB-002** (QA r1 finder) | ✅ backend 2026-08-09 (awaiting QA r2) |
| B.8 | **backend:** behavioural keystones + red-proofs for the M5/M6 doors that had only structural cover (self-audit risk #1). Population **re-derived from the live catalog**: **13 doors, not 12** (`dashboard_completion_by_member`'s 7.3 zero had no twin and no red-proof; the "nine + four" count in the brief was off by one) · `revoke_printed_document` re-confirmed a **deliberate KEEP** (ADR 0104 D11; M6 postcondition (c) + `314` 8.5 pin it) · the 4 correction doors never carried the tenancy arm (catalog-verified) so they were never in the hole. `314` §9/§10 **+27 assertions (plan 76)**, every denial twinned (distinct-SQLSTATE discipline: authority 42501/HC0J1/P0002-gate-2 precedes state gates) · `b1` extended **17→31 cases, 31/31 RED-PROVEN**, RESTORE byte-identical, CONTROLS 76+53 green | ✅ backend 2026-08-09 |
| B.9 | **backend: FUP-QOB-1** — `270` §J **J1c** catalog pin on `response_group_instances_write_own_draft` (existence + `created_by = auth.uid()` in BOTH qual/with_check), **PROVISIONAL pending PO ratification**; red-proven by b1 `fup_qob1_drop_created_by` — **J1c reds while J1b stays green** (`ok 40` / `not ok 41`), demonstrating the recorded vacuity live | ✅ backend 2026-08-09 (PO ratification open) |
| B.10 | **backend: BUG-QOB-003 backend half** — `session.ts` coercion removed (`role` = membership only), new `CommissionAccess.isTenancyAdmin` flag + `canConfigureCommission()` config seam (Q1–Q9 KEEP), `submissions.ts` `canCorrect` stale tenancy mirror cut. **UI half open → frontend** (commission layout currently 404s a bare tenancy admin) | ✅ backend 2026-08-09 |
| B.11 | **backend: KEEP-surface action guards routed through the config seam** (`60719df`) — lead-ruled in-phase: TS guards refusing tenancy admins on ratified-KEEP surfaces silently converted KEEP into CUT (same incoherence class as BUG-QOB-003). New `canConfigureCommissionById()`; **full guard-site enumeration** of `src/lib` + 2 backend route handlers: **8 KEEP-routed** (forms 18 sites · process-templates 17 · outcomes/results/tags/narrative-types/meeting-config · audit CSV export), **5 KEEP-already-correct** (members/titles/indicators/case-types/meeting-type INVOKER RPCs), **CUT halves verified armless** (+ do-not-route annotations). Every routed substrate **catalog-verified armed first** (so no guard opens onto a 42501). ⚠ `setTemplateCaseType` deliberately NOT routed — its DB door (`set_template_case_type`, ADR 0088) is staff_admin-only; a Q2-consistency change would be a DB wave, flagged for the PO. Pre-existing `context.isAdmin` platform-admin arms on content pre-checks recorded OUT of scope (noun-rule sweep candidate) | ✅ backend 2026-08-09 |
| B.12 | **frontend: BUG-QOB-003 UI half** (`1dfc3fb`, 21 files) — commission layout admits `isTenancyAdmin`; `AppSidebar` gains `navScope` tri-state + a **fail-closed `configuration` allowlist** (a later nav item is invisible to tenancy admins until opted in) + the `role === null` "show-everything" branch hardened to `role !== null` (the exact shape that produced this bug class); **17 KEEP pages** re-gated on `canConfigureCommission`; CUT routes 404 by construction; indicator detail **SPLIT** per Q3 (definition renders, the 4 measurement reads skipped entirely — an empty chart would misreport); commission root renders a **configuration landing** for a bare tenancy admin (all 5 member cards link to CUT surfaces). **Browser-verified** server-rendered output: `orgadmin.a` + `orgadmin.b` = 7-item KEEP nav, 13 KEEP routes render, 18 CUT routes 404, audit CSV real; `chefe.ccih` all 21 nav items + 14 routes — **no coordinator regression**; `multi` unchanged; cross-org 404 intact. ⚠ `staff`+tenancy-admin nav case unexercised (no seed persona) → tester. ⚠ Verification trap recorded: `preview_start` served MAIN's dev server, not the worktree — check the server cwd | ✅ frontend 2026-08-09 |
| B.13 | **tester: E2E for the UI half** (`42defc3`) — `qob-org-admin-content-wall.spec.ts` **6 → 19 tests** (7-item KEEP nav allowlist, configuration landing, Q3 split, CUT 404s, coordinator no-regression, cross-org, keyboard-only flow, `member-and-configuration` manufactured live via the real `addStaff` door + identity-scoped teardown) · old-contract sweep updated 4 specs (`phase15-indicators` AC-5b re-anchored on the real `open_capa_plan` door; `hospital-admin-tier` response-read over-reach retired → ratified 404; `phase22-referrals` 3d/5a persona swap + a silently-vacuous 404-fallthrough fixed; `nsp-per-hospital` AC-7 persona swap + a stale no-such-arm comment corrected against the catalog) · **scoped runs all green on fresh reset + worktree prod-standalone (cwd verified): qob 19/19 ×2 / 12/12 / 38/38 / 40/40 / 32/32 / 2/2 / 2/2** · filed **BUG-QOB-004** (referrals reach regression — see Bug Log) rather than canonizing an unratified loss | ✅ tester 2026-08-09 |
| B.16 | **lead: full `e2e:prod` declare-green gate #2, post-M7 tree** (`a5b40e1`, REBUILD=1) — **GATE GREEN: 1046 passed · 0 failed · 1 flaky · 0 did-not-run · 17 batches · accounted 1047/1052** (the constant 5 permanent skips) · 1 INFRA re-run, classified automatically. Supersedes B.14 as the phase's declare-green run (B.14's tree predated M7) | ✅ lead 2026-08-09 |
| B.14 | **lead: full `e2e:prod` declare-green gate** (REBUILD=1, defaults; post-B.13 tree) — **GATE: 1036 passed · 8 failed · 3 flaky (within the documented baseline, passed on retry) · 0 did-not-run · 17 batches, no gaps, 0 `reset FAILED` · accounted 1047/1052** (the constant 5 = the suite's 5 permanent `test.skip(true)` tests, in-file documented pgTAP-covered/seed-dependent — same 5 in every historical gate). **All 8 failures = ONE root cause, NOT QO·B:** both PDF-printing specs failed at mint because the WORKTREE's untracked `.env.local` predates the PDF module (missing `PDF_RENDERER_URL`/`PDF_VERIFICATION_BASE_URL`; yesterday's green P2 gate ran from the main tree). Synced env (+ stale `MINUTES_SERVICE_URL` :8891→:8000) → scoped gate re-runs on fresh resets: `pdf-printing` **14/14 GATE GREEN**, `pdf-printing-meetings` **5/5 GATE GREEN** — all 8 re-proven. ⚠ Lesson for the worktree doc: `.env.local` does not follow merges — sync it when a fast-forward crosses a feature that added env vars | ✅ lead 2026-08-09 |

**Gate evidence (final, post-M7 / QA r2):** fresh reset **329 == 329** · pgTAP **175f / 5616 /
PASS** · A/B **LOST = ratified cells only · GAINED = 0 · KEEP 0/0** · `b1` **39/39 RED-PROVEN**,
RESTORE byte-identical, controls 111+53 · `ARM=census` (450/460) + `ARM=floor` (80 allowlisted)
**HOLD** · diff-scoped door sweeps **0 BLIND** (M5/M6 wave + M7 `case_events`) · full `e2e:prod`
**GATE GREEN 1046/0/1 flaky** (B.16) · lint 0/0 · tsc · vitest **1194**. Closes **BUG-QOB-001**
+ **BUG-QOB-002** (re-opened r1, re-closed by M7, r2-confirmed) + **BUG-QOB-003**.

⛔ **The finding that matters more than the green table:** M1–M4 cut the **tables** and left
**16 DEFINER doors** open — `orgadmin.a` still read **6 free-text answers** through
`dashboard_free_text` while `responses` returned 0. **Four green gates were each blind to it
in a different way** (the A/B matrix sees only tables; the ADR 0079 sweep neutralizes only
BOOLEAN gates; `ARM=floor` asks *called*, not *correct*; `314` asserted tables). Closed by
M5+M6. Found by re-reading the ratified CUT list against the catalog — **a check no harness
performs**, and one to run at the end of any subtractive phase.

⚠ **Open at gate step 4 (everything below is a PO decision, not missing work):**
**human approval** of the phase · ratification of the **2026-08-09 lead rulings** (Decisions log:
BUG-QOB-003 fix shape · audit=KEEP · charter/acreditação membership-gated · dual-hat precedence ·
`setTemplateCaseType` non-route) · **FUP-QOB-1**'s provisional J1c pin · **BUG-QOB-004** (referrals
reach: UI now 404s tenancy admins while `create_referral_draft`/`dispose_referral_phi` still carry
the tenancy arm — never classified by D12; rule KEEP-and-surface or CUT-the-arms).

## Closed bugs owned by this phase (rotated from the Bug Log)

⬛ **BUG-QOB-001 — `responses_admin_all` let a tenancy admin DELETE other users' in-progress
work.** Filed **and fixed** 2026-08-08 during QO·B step ① (kept here, not archived, until QO·B
passes its §6 gate). **[CAT]** the policy was a bare `FOR ALL` with a single term,
`app.is_commission_admin_of(commission_id)` — which is the **tenancy** admin (org_admin OR
hospital_admin), *not* the committee's staff_admin. **Proven by execution, pre-fix:** as
`orgadmin.a`, `delete from responses where status='in_progress' and created_by <> me` removed
**6 rows** owned by `staff1`/`staff2`/others; the same principal read **9** of their draft
answers. **Control:** identical statement as plain `staff` → **0 rows** (RLS filtered them
away), so the probe discriminates. On **submitted** rows the delete was stopped only by the
`guard_submitted_response` **trigger** — a data-integrity guard doing an authorization job by
accident; for **in-progress** rows nothing stood in the way. **Fixed** by QO·B M1
(`20260915000000`), which drops the policy outright; post-fix the same statement returns no
rows and `orgadmin.a` reads 0 responses / 0 answers, while the `staff_admin` control holds.
Not a Phase-A regression — it predates the QO program; the inventory is what found it.
⚠ **Counts corrected 2026-08-08:** the "6 rows / 9 answers / 36 / 81 / 25 / 49" figures above were
measured on a **live E2E-mutated DB**, not a fresh reset, so they are inflated. On a clean seed the
same principals read `responses` **13 / 13 / 7 / 5** and `answers` **50 / 50 / 26 / 15**
(org_admin / hospital_admin / staff_admin / staff). Mechanism, controls and verdict unchanged; the
tenancy admin still reads ~2× the committee's own coordinator. **Lesson: an A/B baseline is
invalidated by a `db reset` — capture and compare within one DB lifetime.**

🔴 **BUG-QOB-003 — the UI still resolves a tenancy admin to `staff_admin`, so QO·B's wall closes
underneath coordinator affordances that now cannot work.** Filed 2026-08-08 (QO·B, found while
writing the E2E spec). **Not a security defect** — the DB wall holds and Architecture Rule 1 never
relied on UI hiding — but a real UX/consistency defect that **Phase B introduces**.
**[V-SRC]** [session.ts:459](src/lib/queries/session.ts:459):
`const role = memberRole ?? (isCommAdmin ? 'staff_admin' : null)` — an org_admin/hospital_admin
holding **no membership row** resolves to the coordinator role, and `canUseCapability` (~L530)
opens on exactly `role === 'staff_admin'`. So after M1–M4 a tenancy admin still gets rendered
write buttons and content surfaces, which then return empty lists or raise `sem permissão`.
⚠ **Phase A already solved this shape and wrote the reason down** (session.ts ~L386): the
quality_reviewer is *"a FLAG, never a member role — mapping it to `'staff_admin'` would open every
`role === 'staff_admin'` write gate"*. Phase B needs the same treatment for the tenancy admins.
**Precedent for the fix exists:** `e2e/cases-board-access.spec.ts` records that the cases board
already **404s** an administration-only principal rather than showing an empty board.
**Needs a PO ruling + frontend work** — options: (a) make the tenancy admin a flag and hide content
surfaces; (b) 404 the content routes, mirroring the cases board; (c) accept. Owner: frontend.
**➜ BACKEND HALF DONE (backend, 2026-08-09 — B.10):** `session.ts` no longer coerces — `role` is
the MEMBERSHIP role only; tenancy-admin standing is the new `CommissionAccess.isTenancyAdmin`
flag (exactly the Phase-A quality_reviewer treatment), and configuration affordances gate through
the new `canConfigureCommission()` (= membership coordinator OR tenancy admin — the Q1–Q9 KEEP
seam: form definitions/builder, process templates, taxonomy + meeting settings, member
management, indicator DEFINITIONS), while `canInCommission` closes for a bare tenancy admin by
construction (all four ADR-0061 capabilities are content). Also cut the stale `canCorrect`
mirror in `src/lib/queries/submissions.ts`, which still offered "Corrigir" to a tenancy admin
whose `supersede_response` call M5 now 42501s. **UI half open (frontend):** the commission
layout gate (`src/app/o/[org]/c/[commission]/layout.tsx:70`) now 404s a bare tenancy admin
(`role === null`, not a viewer) — frontend must admit `isTenancyAdmin` there, route it to the
KEEP surfaces only, and re-gate the ~25 `access.role !== 'staff_admin'` pages per the
KEEP/CUT split (precise list in the backend B.10 report to the lead). The PO presentation
ruling above is still open; the contract no longer blocks on it.
**➜ UI HALF TESTER-VERIFIED 2026-08-09** (frontend shipped it in `1dfc3fb`): the 7-item KEEP nav
allowlist, the configuration landing at the commission root, the indicator-detail Q3 split
(definition renders, measurement withheld), all CUT routes 404ing with no leak, the
`"member-and-configuration"` tri-state (manufactured live via the real member-add door — no seed
persona held it), and coordinator no-regression are all pinned in
`e2e/qob-org-admin-content-wall.spec.ts` (19/19, run twice, 0 flake) — see the Test Run Summary
row below. Uncovered a related, separate finding while verifying — **BUG-QOB-004**.

🔴 **BUG-QOB-002 — a tenancy admin could WRITE case content it could not READ. RE-OPENED
2026-08-09 (QA r1 finder) → FIXED by M7 2026-08-09 (backend), pending QA r2 re-verification.**
Filed 2026-08-08 (QO·B step ①). ⚠ **Was recorded CLOSED-by-M4 prematurely** — M4 cut a PROXY
population (*"the functions carrying `assert_not_case_excluded`"*, a different wave's
enumeration), so ~17 §4.4 doors that never carried that guard **stayed armed**. QA r1
re-measured on a fresh reset and reproduced live writes at BOTH tenancy tiers:
`remove_case_participant` set `removed_at`; `record_recusal` wrote a `case_recusals` row;
`case_viewer_capabilities` reported `can_manage_lifecycle:true` over an unreadable case.
**[MEAS]**, original repro: `get_case_detail(case_a)` denied (`caso … não encontrado`), `cases`
0 rows, while `update_case_meta` SUCCEEDED. **Mechanism:** A4 narrowed the case *read* plane
and left the *write* doors on the tenancy predicate; M4 cut only the subset carrying A4's
guard. **Fix — M7 (`20260916000000`):** population derived from the **ratified §4.4 list
itself**, item by item against the live catalog (20 functions edited: 16 armed doors + 4
masked-token strips; 3 `case_events` policy arms). Post-M7 re-measurement, same fixtures:
every door DENIES the tenancy admin at authority/not-found; `orgadmin.b` cross-org control and
`chefe.ccih` coordinator twin both discriminate. Keystoned in `314` §11 (35 assertions,
plan 111) and red-proven in `b1` (41/41, RESTORE byte-identical). The postcondition asserts
CORRESPONDENCE to the enumerated §4.4 names, not a count (QA r1's core lesson: M4's
count-shaped postcondition validated the proxy, not the list).
⚠ **Also fixed under this bug (QA r1 MAJOR-1):** `cancel_case`/`close_case` are INVOKER doors
whose authority admitted and whose terminal DML then no-op'd under RLS — they **returned
SUCCESS writing nothing** for an authority-passing-but-RLS-invisible principal (an excluded
staff_admin). M7 adds a zero-row not-found guard to those two (red-proven in `b1`); the other
two QA named (`set_case_outcome`/`update_case_narrative_body`) were measured to deny at their
RLS lookup and never had the silent-success shape — recorded honestly in `314` §11d.
