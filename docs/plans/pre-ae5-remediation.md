# Pre-AE5 remediation — the nine follow-up batches

**Status:** live plan · **Owner:** lead (orchestration), backend (build), qa (review), PO (rulings)
**Program:** AUTHZ — ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) ·
**Ruled:** 2026-09-04 (lead session `9346f622`) · **Last updated:** 2026-09-08 in the Batch 4 **merge
session** on branch `authz-enforcement-manifest` — Batch 3 **and** Batch 4 (with Batch 5 inside it)
are now on `main`; ⛔ the shas live in §2 rows 3–4 and are measured there, never quoted from here
(superseded values, in order: *"2026-09-07 at `main` @ `d7964398`"* → *"2026-09-08 on branch
`authz-writepath-baseline`, Batch 3 closed at `e4a16b33` and ⛔ not yet merged into `main`"*)

> Continuation of this plan happens in a **different session**. Everything a resuming lead needs is
> here or one link away: what was concluded (§2), what remains and why it comes before AE5 (§3),
> the protocol each batch follows (§4), and the standing facts that bite (§5). Live unit state is
> never here — it is the hub, via [docs/features/INDEX.md](../features/INDEX.md).

## 1. Why these batches exist, and why "before AE5"

**AE5 is post-pilot by ruling.** ADR 0155 G1 / ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md):
*"AE0–AE4 gate the pilot. AE5 is post-pilot."* AE5 substitutes the eleven remaining roles into the
authz catalog one at a time, each through **the AE4 per-role template** (matrix → seed →
differential → wrapper cutover → re-key the enforcement sites → sweep → runbook → Record).

So "before AE5" means two things, and the batches were derived from both:

1. **What the documents literally say must precede it.** Gate AE4 QA review: *"Add the converse arm
   (a declared class must be findable) before AE5, when non-empty rows first appear."* Implementation
   audit F5: *"Decide and encode the model before AE5."* Gate AE4 re-review N4: *"a re-key at the policy
   leaves the DEFINER surface on its legacy gate, and this template is what AE5 will copy."*
2. **Every defect in the instruments and the template that AE5 would run or copy eleven times.** The
   open follow-up register carries **no entry worded as an AE5 blocker**; the batches were derived
   (2026-09-04) from the plan, the ADRs, the reviews and each entry's own mechanism. A gate whose
   instrument is blind is worse than no gate — it manufactures an all-clear.

**Dependency order** (why the numbering is what it is): Batches 1–3 each need a multi-hour **full
sweep** on the mutation harnesses, so the harnesses had to be crash-safe first (Batch 0); Batches 2–3
re-baseline committed findings files, so the case deriver and the full-run **merge** had to work
first (Batch 1); Batch 4's re-key needs a working diff-scoped sweep (Batches 1–2); Batch 7's revokes
must not create sweep blindness (Batch 2's domain). Batch 6 is the inter-phase window's own work.
Batch 9 is not a fix — it is the AE5 plan's opening ADR.

## 2. Concluded — Batches 0, 1, 2, 3, 4, 6, 7 (Batch 5 rode inside Batch 4)

> ⚠ **This heading said "all QA-approved" until 2026-09-08. Batch 6 is the exception and it is
> named rather than absorbed:** its four QA rounds were **every one `CHANGES REQUESTED`**, and the
> PO **skipped round 5 by decision**, closing §6 step 3 without an `APPROVED` report. Round 4 states
> the code is done and could not be broken, and every finding in rounds 2–4 was documentation about
> measurements rather than a gate defect. ⛔ A gate met by ruling is not a gate met by report.

> ⚠ **EDITED 2026-09-08.** The heading read *"Concluded — Batches 0, 1, 2 (all on `main`, all
> PO-approved, all QA-approved)"*. Batch 3 is concluded but **not on `main`** at the time of writing,
> so the parenthetical could not be extended as-is; the superseded text is quoted here and the
> per-row merge state is measured in the `Merged` column, which is the only place it belongs.
> ✅ **2026-09-08, later the same day:** Batch 3 merged and was pushed, and Batch 4 merged after it
> by the ruled order — the heading now names both. The banner is kept because its *reason* still
> governs: a heading cannot carry merge state, and the `Merged` column is where it is measured.

Each row's authority is its hub (summary) and record (log); this table is a pointer, never a
restatement. **Re-measure anything you rely on.**

| # | Unit (hub · record) | Merged | Closed | What it made true |
|---|---|---|---|---|
| 0 | `HARNESS-CRASH-SAFETY` — [hub](../features/harness-crash-safety.md) · [record](../progress/harness-crash-safety.md) · ADR [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md) | `76d87a4f` 2026-09-04 | `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` · `FUP-AUTHZ-HARNESS-PRECONDITIONS` · `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` · `FUP-AUTHZ-HARNESS-TRANSACTIONAL` (PO: **detect-only**, marker not built by decision) | A restore is believed only when the **catalog** agrees (psql rc **and** md5); a failed restore **keeps** the sentinel; `RECOVER=1` in all three sentinel-bearing harnesses; both verdict preconditions asserted and printed; `SUITE=` is a subset; the C2 neutralizer bounds tail drift (`RESET_EVERY`, interlock, retry-once). ⚠ **Mis-scoped as closed**: the tail-drift fix reached the C2 harness only — Batch 2 paid for that (its archive amendment says so). |
| 1 | `DOOR-SWEEP-DERIVER` — [hub](../features/door-sweep-deriver.md) · [record](../progress/door-sweep-deriver.md) · ADR [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) (amends 0173, 0079) | `bbda5392` 2026-09-05 | `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` (on a **visibly amended** condition — ADR 0079 hazard 4) · `…MARKER-BLIND-TO-CONTINUATION-LINES` · `…DERIVER-BLIND-TO-ALTER-FUNCTION` · `…DERIVER-SPANS-THE-WHOLE-WORKING-TREE` · `…FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` · `FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN` | The deriver **lifts** `PRED_DOMAIN` from the harness (ABORT on drift) instead of copying it; a door is a **catalog** fact and `CASES=` is the sweepable tier only; `ALTER FUNCTION … SECURITY DEFINER` read like `ALTER POLICY`; the whole `door-sweep-targets:` declaration parsed; per-case provenance and a quotable `SCOPE:` line on every exit; the four sweeps' full-run emit **merges** into the committed baseline, preserving every line the generator did not produce (verifier proven on the old helper's real losses); `SELFTEST=1` over committed fixtures (34 scenarios). QA took four rounds — round 1 found a genuine blocker (the merge destroyed hand-authored material at exit 0). |
| 2 | `PRED-DOMAIN` — [hub](../features/pred-domain.md) · [record](../progress/pred-domain.md) · ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) (amends 0173, 0079) | `d7964398` 2026-09-07 | `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` + `…GAP-WIDENED-BY-SET-VALUED-RESOLVERS` (jointly) · `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` · `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` · `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` · `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` | `PRED_DOMAIN` gains the `authz` **schema axis** (bounded to boolean); selection delta exactly `candidate_has_permission` + `scope_reaches`; the `SETOF uuid` resolvers get a committed **targeted-case home** (scheduled in lead-playbook §4); `NOTICED` = a fourth outcome, PO-ruled **evidence not a verdict** (disclosed, non-blocking); the read arm opens `using` only (11 `(ALL)` flips work-listed); a per-run `DOMAIN-STATEMENT` with ADR 0187 D1's sentence byte-exact; the door harness gained Batch 0's tail-drift design after run 1's 78-row drift tail was proven with **no originating case**; the door baseline **re-earned** through a bounded run (353 cases, 40 resets: 294 COVERED · 36 BLIND · 23 NOTICED · 0 ERROR), 275 CARRIED rows dispositioned per PO ruling, 31 hand notes preserved. |
| 3 | `WRITEPATH-BASELINE` — [hub](../features/writepath-baseline.md) · [record](../progress/writepath-baseline.md) · [review](../reviews/writepath-baseline-review.md) · ADR [0192](../decisions/0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md) (amends 0189, 0153) | ✅ **MERGED and PUBLISHED — measured 2026-09-08**, not asserted: `main` @ `1fba8729` contains `e4a16b33`, `git branch --list authz-writepath-baseline` is **empty** (branch deleted), and `origin/main` = `1fba8729` with push distance **0** — the PO directed the push so the second machine can rebase onto merged Batch 3 (§3 Batch 4 item 2). Superseded text, quoted so nothing is lost: *"⛔ **NOT MERGED as of 2026-09-08** — complete, PO-approved and QA-approved on branch `authz-writepath-baseline` @ `e4a16b33`; the `git merge --ff-only` is the **lead's** step and is ordered **before** Batch 4's (§3 Batch 4 item 1)."* ⚠ **Measure this cell, never quote it** — the hub's `branch:` is nulled at the Record step and is ⛔ not a claim that it merged; a deleted branch is not one either (it is deleted at the same step) — what proves the merge is the ancestry check `git merge-base --is-ancestor e4a16b33 main`, run bare, which is how the ✅ above was earned | `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` (⚠ its **title figure was stale at 39**, not 33, when it closed — title figures are not amended retroactively) · `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` (closed from the **plain** run; the predicted ownership blocker was measured and **DISPROVEN** — `supautils.policy_grants` grants POLICY DDL outside `pg_class.relowner`) · `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` (Parts 2–4; closed on the **recovery step** + the **nine policies actually swept**, ⛔ never on the exit codes) | ⭐ **Ownership is a PROXY, not the property** — a permission question is answered by attempting the permission or reading every grant path, never by reading `relowner` alone; the approved superuser escalation was **dropped** and its corrected predicate kept as a **detector** (dormant on 0 of 107, so proven able to fire only by a plant). `CASES=""` no longer degrades to a full run **in the write arm** (⛔ the door arm's identical defect is FILED, not fixed). `RESET_EVERY` **ported, not copied** — the door's `periodic_reset()` re-derives two catalog worklists while Arm 1 is a **static** `GUARD_KEYS`, so Arm 1 got its own post-reset OID check. The recovery step Part 4 owed is prose in the harness header naming `git checkout -- docs/reviews/authz-writepath-audit-findings.md` + the sentinel/`RECOVER=1` protocol + the **working-tree/suite-shape** clause. The write baseline **re-earned** through one 3.88 h detached run (120 cases, `resets=8`: **102 COVERED · 15 BLIND · 3 ERROR**, bare **rc 1 = DIRTY**, the correct outcome), coverage **51 of 120 → 120 of 120 measured**, guard arm **12 of 13 → 13 of 13**; 45 CARRIED rows dispositioned per PO ruling (9 re-filed, 36 deleted), all 11 hand-annotated rows preserved by byte comparison. ⚠ **Eleven instrument faults caught**, every one reading like a live defect; ⛔ the 15 BLINDs and the 3 UNVERDICTED `process_template_*` ERRORs are **findings, never allowlisted**, and `297_process_template_versioning.sql` is **correctly not fixed here** (the fix moves `Tests=`, and `Tests=` **is** the shape the run asserted 120 times). |
| 4 (+5) | `ENFORCEMENT-MANIFEST` — [hub](../features/enforcement-manifest.md) · [record](../progress/enforcement-manifest.md) · [review](../reviews/enforcement-manifest-review.md) · [re-review](../reviews/enforcement-manifest-rereview.md) · [re-review 2](../reviews/enforcement-manifest-rereview-2.md) · ADR [0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md) (amends 0176, 0178) | `74459926` 2026-09-08 — ⛔ **rebased**, so this sha is NOT the one the record and the three reviews cite (`bb85f0c4` pre-rebase; `dab3cc87`, the PO approval, no longer resolves) | `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` (**the one literal "before AE5" sentence** in the corpus) · `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` · `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` · `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` · **`FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR`** (Batch 5, riding along) — each on its own quoted clause; 2 filed | `hardDenyClasses` became a **committed claim** instead of `[]`, so pgTAP `410` §6.2 has an arm that can fail — and its search is now **transitive over the composed-call closure**, not one hop, with planted and natural controls. One migration re-keys `public.set_item_validations` onto the permission, closing the template defect **AE5 would have copied eleven times** (a re-key at the policy that leaves the DEFINER writer on its legacy gate); seven DEFINER splits declared in `definerSurface`; the two undeclared consumers recorded — `current_professional_read_organizations` as a **site**, `app._audit_access_authorized` as a **non-enforcement** consumer with a partition arm, so changing the authorizer can no longer move the audit gate unnoticed. Rollback runbook §6 rewritten for six policies plus the DEFINER door (six stale figures re-measured). ⚠ The `hardDenyClasses` values are a **claim that ages**: any migration changing a call chain reds §6.2 by design (ADR 0193 D8), and the missing instrument for gateless classes is **filed, not built**. ⭐ Merged through a **rebase**, so the gate was re-earned at the rebased tip; `ARM=census` moved **604 → 608** verdicts, which is the arithmetic that says Batch 3 landed *underneath* this unit rather than beside it. |
| 7 | `PRIVILEGE-SURFACE` — [hub](../features/privilege-surface.md) · [record](../progress/privilege-surface.md) · [review](../reviews/privilege-surface-review.md) · [re-review](../reviews/privilege-surface-rereview.md) · [re-review 2](../reviews/privilege-surface-rereview-2.md) · ADR [0195](../decisions/0195-a-committed-number-needs-one-home-and-a-gated-mirror.md) (**amends nothing** — stated as a claim, since every sibling batch ADR amends something) | ff-merged to `main` 2026-09-08, ancestry proven **bare** before the branch was deleted. ⚠ **PUSH: approved by PO ruling but NOT YET DONE at the time of writing** (the standing §6 instruction is *"do not push"*; overridden for this push only, as for Batch 4) — held pending a **live** check of Coolify Automatic Deployment, because the lead could not verify an external system and the PO chose to verify it rather than let the record stand in for it. ⛔ Re-measure `git rev-list --count origin/main..main`; never quote a push state | 3 closed, **5 filed** | The ceiling moved **752 → 759 by PO ruling** with all seven attributed across **three** heads (the clause named two; keyed on the **pair** `(max(version), count)` because a head alone does not identify a migration set). **Four of the seven are referenced inside live RLS policies**, so *"revoke the unjustified grants"* was largely unavailable. AE1's 233 revokes **deferred with a written re-open condition**, partition re-derived (44/5/23/161 reproduces; ⛔ all **six** arm predicates had moved). The `app` PUBLIC floor keeps its **config** bound, now gated as text. `npm run lint` gains **gates 14 and 15** and has **15**, not 13. ⛔ **`PATHSPEC_BYTES=0`** — no migration, no ACL change, no `src/` |

> ⚠ **Batch 6 is named in this heading but has NO ROW in the table above** — it was concluded without one, and Batch 7 (2026-09-08) added its own rather than silently inheriting that gap. ⛔ Stated rather than fixed: reconstructing a row after the fact is the `LEDGER-COMPLETENESS` shape, and it belongs to whoever re-derives the set, not to a passing batch. Batch 6's conclusion is recorded in §3 under its CONCLUDED banner and in the phase ledger.

**PO rulings taken so far** (each recorded in the ADR / record it belongs to): Batch 0 Q2 —
transactional residual **detect-only**; Batch 1 — approval ratified three closures whose register field
read `PO to rule`; Batch 2 Q1 — `(ALL)` flips → work-list + follow-up; Q3 — the widened domain's bound
**accepted**; CARRIED dispositions **accepted as recommended**; NOTICED **disclosed, non-blocking,
work-listed**.

**Follow-ups FILED by the concluded batches (open, owners assigned)** — none blocks the next batch,
each is named so nobody re-discovers it: `FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL` 🟠 ·
`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡 · `FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO` 🟡 ·
`FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` 🟡 · `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` 🟠 (the 11) ·
`FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` 🟠 (⛔ **`FROMFINDINGS=1 ARM=policy` is RED
pre-existing and unreadable until this lands — 12 stale rows, never allowlist them** · ⚠ **2026-09-08:
that `12` is one of THREE grains and ⛔ must not be rewritten to any of the others** — the arm reports
**12**, the door findings file measurably holds **38** section-vs-verdict disagreements, and Batch 3
added **5** off-allowlist BLINDs the red cannot register. All three, with the merge mechanism and what
is deliberately not fixed, are in §5's dated note; the item now owns the *reader* and the *writer*
halves both) ·
`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET` 🟠 · `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` 🟡 ·
`FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST` 🟡 · `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING` 🟠.

## 3. Remaining — Batches 8 to 9, in dependency order

> ⚠ **EDITED 2026-09-08 (Batch 6 Record step).** The heading read *"Batches 6 to 9"*. Batch 6 is
> concluded; its block below is **kept, not deleted** — it carries the derivation a later batch
> still reads — and now opens with a CONCLUDED banner, because ⛔ a block under a "Remaining"
> heading is an instruction to do the work, and the banner is what stops a reader acting on one
> twice.

> ⚠ **EDITED 2026-09-08 (Batch 4 merge session).** The heading read *"Remaining — Batches 3 to 9"*.
> Batches 3, 4 and 5 are concluded and their rows are in §2; their blocks below are **kept, not
> deleted** — each carries the derivation and the hand-off notes a later batch still reads — and each
> now opens with a CONCLUDED banner. ⛔ A block under a "Remaining" heading is an instruction to do
> the work; the banner is what stops a reader acting on one twice.

Severities and ids were re-verified against `docs/followups/follow-ups-open.md` at `d7964398`.
Every batch closes its follow-ups **on their own quoted `Closes when` clause**, never on a summary.

> ⚠ **2026-09-08 — the remaining set is now Batches 4 to 9.** Batch 3 concluded (§2 row 3, unmerged);
> its block is retained below in full under a `⚠ SUPERSEDED` banner rather than deleted, because what
> the plan **predicted** and what the run **measured** differ in four places and the difference is the
> instructive part.

### Batch 3 — Write-arm baseline (`supabase/tests/mutation/p0-authz-writepath-audit.sh`) — owner backend

> ⚠ **SUPERSEDED 2026-09-08 — this block is the plan as ruled 2026-09-04; the unit is CONCLUDED and
> four of its figures were overturned by measurement.** ⛔ Retained, not rewritten: the live state is
> §2 row 3 → the hub `docs/features/writepath-baseline.md` → the record `docs/progress/writepath-baseline.md`.
> Read nothing below as current. What measurement overturned, each figure beside the one it replaces:
>
> - **"passes vacuously over 74 of 107 policies"** (below, *Why before AE5*) → **0**. The run swept
>   `policy=107/107` and `guard=13/13` — **120 of 120 cases measured**. ⭐ And the *baseline* figure
>   the whole batch was named for was itself wrong at open: **39 of 107, not 33** (the 33 omitted the
>   2 rows merged from the `BUG-AE49-D6-REKEY-INCOMPLETE` subset run of 2026-09-03, and 4 from
>   AE4.9 D6). The follow-up's **title** still says 33 and was stale by six when it closed.
> - **"~13 h"** (below, and again in the Batch 4 block) → **3.88 h**, measured. The 13 h was inherited
>   rhetoric with no measured parent — the only sweep in this repo near it is the C2 command-door
>   neutralizer (~9.5 h), a **different harness**. The write arm's own header documented ~50 min for
>   its full domain; the true cost is `per-case × 120 + resets × reset cost`, derived before launch.
> - **"~9 annotated rows"** → **11**. The 9 came from a decorative-token pattern (`⭐ ⚠ ⛔ ** [merged`)
>   that ⭐ **cannot see hand prose written without decoration** (`authz-writepath-audit-findings.md:60`
>   and `:61`). Two independent methods — a token-keyed classifier and a reader inspection — agreed on
>   a wrong number because they shared one blind spot; agreement between methods with the same blind
>   spot is not corroboration. All 11 survived 120 merge rewrites, delta 0, re-asserted by byte
>   comparison.
> - **"the write arm's empty-set exit made a FINDING"** → ⛔ **that criterion named a state that was
>   ALREADY handled.** `CASES` set to tokens matching nothing had reached `exit 3 UNPROVEN` since the
>   2026-08-29 repair; Batch 3 **proved** it rather than building it. The real defect was one grain
>   over: `CASES` **set to the empty string** was indistinguishable from `CASES` **unset**, so a caller
>   that captured the deriver's stdout without consuming its exit code got a full 120-case run writing
>   the **committed** baseline with the UNPROVEN door unreachable. Fixed in the write arm; ⛔ **filed,
>   not fixed, in the door arm** (`FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN`).
> - ⚠ **Also predicted and DISPROVEN:** the three `storage.objects` INSERT policies were expected to
>   land `ERROR — must be owner of table objects`. All three verdicted **COVERED** as plain
>   `postgres`: `supautils.policy_grants` grants POLICY DDL outside `pg_class.relowner`. **Ownership
>   was a proxy for a permission granted by another route** — and a superuser escalation was approved
>   on that false inference before being dropped (ADR 0192).

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` | 🟠 | The committed write-path findings file holds verdicts for **33 of 107** write policies; a `FROMFINDINGS=1` arm compares against the committed rows and *cannot see the 74 absent ones* — a door absent from the findings passes vacuously. |
| `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` | 🟠 | Three `storage.objects` INSERT policies sat outside every arm's domain (census bounded to `public`); they owe a first verdict each. ⛔ Never allowlist one. |
| `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` (Parts 2–4) | 🟠 | Part 1 landed as ruling 4 in the deriver's header. Remaining: the write arm exits 0 over an empty set; nine policies fall in neither arm's domain; the write arm's crash behaviour (now inherited from Batch 0 — re-verify, don't assume). |

**Why before AE5:** every AE5 re-key is a **write-policy** re-key, and the write arm today passes
vacuously over 74 of 107 policies. **The work:** ONE full write-path sweep over the widened domain
(~13 h, detached, `RESET_EVERY` on — confirm the writepath harness carries Batch 0's design, or port it
first exactly as Batch 2 did for the door arm), rows **merged** into the committed file (never
replacing the 33 annotated rows — the merge from Batch 1 does this; its hand-authored material is 2
`## Note` sections, 1 blockquote region, ~9 annotated rows and a `---`, all of which will land in
CARRIED for a PO ruling like Batch 2's); the three storage policies verdicted; the write arm's empty-set
exit made a FINDING. Expect the Batch 2 shape: a run, a CARRIED enumeration, a PO ruling, a re-file,
then the closures. **Read Batch 2's record first** — it is the template, including what went wrong.

### Batch 4 — Enforcement manifest + the template's re-key defect — owner backend, one PO item

> ✅ **CONCLUDED 2026-09-08 — merged. Row and gate figures: §2.** Superseded status line, quoted so
> nothing is lost: *"**Status 2026-09-07: BUILT, QA-APPROVED (round 3), PO-APPROVED at `dab3cc87`,
> GATED on branch `authz-enforcement-manifest` (second machine, macOS) — NOT merged, by the ruled
> order below.**"* ⛔ **`dab3cc87` no longer resolves** — the merge session rebased the branch onto
> merged Batch 3 (base `23ec1fa5` → `main`, 25 commits replayed, tip `bb85f0c4` → `74459926`), so
> every sha this unit's record and reviews cite belongs to the pre-rebase line. That is the price of
> the ruled order, paid knowingly; the old line stays readable on `origin/authz-enforcement-manifest`
> until the ref is deleted.
> Hub [enforcement-manifest.md](../features/enforcement-manifest.md) · record
> [enforcement-manifest.md](../progress/enforcement-manifest.md) · ADR 0193 `accepted`. Batch 5 rode
> along and closed in the same branch. The merge session's checklist was the hub's `### Next`.

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` | 🟠 | `hardDenyClasses` is `[]` on 43/43 manifest rows; lint arm M7 iterates an empty list and **cannot fail**; §6.2 has no discrimination control and searches only depth 1. PO took remediation (a) — a *disclosure*; (b) is still owed and must land as **one change** (populate or convert the loop + a discrimination control + a transitive search). **The one literal "before AE5" sentence** in the corpus (Gate AE4 review: "when non-empty rows first appear"). |
| `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` | 🟠 | The re-keyed `form_item_validations` policy is **unreachable** (`authenticated` holds SELECT only); the real writer `public.set_item_validations` still gates on `is_staff_admin_of` — layer 1. Either re-key the DEFINER onto the permission or record the split deliberately in the manifest row. ⚠ Unswept class: *every `_staff_admin_write` policy in the tree* — enumerate it. This is the template defect the re-review named ("a re-key at the policy leaves the DEFINER surface on its legacy gate, and this template is what AE5 will copy"). |
| `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` | 🟡 | `app.current_professional_read_organizations` carries the literal `org.professionals.read` and appears in no `enforcementSites` row — deliberate, undeclared, held green by a by-name pin in pgTAP `410 §8.5`. **PO call**: add it to the row or record a reviewed exclusion; delete the pin in the same change. |
| `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` | 🟡 | `app._audit_access_authorized` is a fourth consumer of `can_read_professional_profile`; nothing records that changing the authorizer moves the audit gate. A note in the manifest row's qualifier or `backend-state.md`. ⛔ NOT added to `enforcementSites` (that would make the site-axis closure check measure a fiction). |

> ⭐ **HAND-OFF FROM BATCH 3, added 2026-09-08 — five `_staff_admin_write` / `_admin_write` policies
> already enumerated WITH VERDICTS.** `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` (row above) says
> *"⚠ Unswept class: every `_staff_admin_write` policy in the tree — enumerate it."* Batch 3's full
> write-arm run enumerated the whole class and five came back **BLIND and off-allowlist**. ⛔ Do not
> re-derive them; ⛔ do not allowlist them — a BLIND is a real finding to keystone. All five are
> `(ALL)` policies whose `with check` half opens to `true` with **no test noticing**
> (`docs/reviews/authz-writepath-audit-findings.md`, `## BLIND`, lines 71/74/75/78/81):
>
> `cases.cases_staff_admin_write` · `commission_member_titles.member_titles_staff_admin_write` ·
> `commissions.commissions_admin_write` · `phase_results.phase_results_staff_admin_write` ·
> `process_template_versions.process_template_versions_staff_admin_write`
>
> Each carries `[snapshot:ABSENT — no §7.2 drift tripwire on this verdict]`, so none has a drift
> tripwire either. Filed as a set, keyed on the **property** and never on a name pattern — the set
> Batch 3 found spans at least four shapes (`*_staff_admin_write`, `*_admin_write`, `*_update_own`,
> `*_write_admin`) and ⭐ **every name-based boundary guessed during that run was wrong within two
> cases**. Counter-evidence that the arm discriminates rather than blanket-failing on the family
> name: `form_items`, `form_sections` and `form_versions` `*_staff_admin_write` all verdict COVERED.
>
> ⛔ **Two disclosure conditions on re-using these five.** (1) The BLIND count moved **3 → 15** and
> off-allowlist **0 → 5** across Batch 3; because `FROMFINDINGS=1 ARM=policy` is **already red**, ⚠
> *no gate can register that change* — whoever repairs the red meets five offenders and this note is
> their provenance. (2) The **5** is **derived from the committed artifacts, not observed from an arm
> run** (QA could not run that arm; it is red). State it that way wherever it is quoted.
>
> ⚠ Three further `process_template_*` write policies are **UNVERDICTED**, not BLIND and not COVERED:
> opening them aborts `supabase/tests/297_process_template_versioning.sql` (`Bad plan`), which moves
> the suite shape. ⭐ **Assertions FIRED and named the file** — *absence of a verdict is not absence
> of coverage*. If Batch 4 re-keys any `process_template_*` policy, that test file is in its blast
> radius and the three owe a re-sweep in whichever unit repairs it.

**Why before AE5:** the manifest is the per-role template's oracle; F-BLOCK-1's recurrence "AE5
multiplies by 11". Any re-key here is a **migration** → the diff-scoped sweep is owed, **both arms**,
derived by the Batch 1 deriver with its `SCOPE:` line quoted (Batches 1–2 are its prerequisites).

**Runs on a SEPARATE MACHINE, in parallel with Batch 3 (ruled 2026-09-07).** ⚠ **EDITED 2026-09-08:
Batch 3's sweep is FINISHED — it took `3.88 h`, not the `~13 h` this sentence budgeted, and the dev
machine's local stack is free.** (Superseded text, quoted so nothing is lost: *"Batch 3's ~13 h
`RESET_EVERY` sweep owns the dev machine's local stack for a day"*. The `~13 h` had no measured
parent; see the SUPERSEDED banner on the Batch 3 block.) The separate-machine arrangement stands as
built and ⛔ **the merge-order and rebase obligations below are unchanged** — they are about the
artifacts, not the schedule. Batch 4 needs the stack for hours,
so it runs on its own clone + Docker stack. Code files are disjoint (Batch 3: the writepath harness +
its findings file; Batch 4: migrations, the manifest, pgTAP `410`, `backend-state.md`, the runbook if
Batch 5 rides along). What is NOT independent — care before merging Batch 4 from the other machine:

1. **Merge order is fixed: Batch 3 first, then Batch 4.** Batch 3 rewrites the committed write-path
   findings file; Batch 4 re-keys write policies (and possibly the whole `_staff_admin_write` class).
   Merged the other way round, Batch 3's baseline measures policies that no longer exist.
   ✅ **SATISFIED, measured 2026-09-08**: Batch 3 is on `main` **and** on `origin/main` @ `1fba8729`
   (the PO directed the push so the second machine could rebase). The rule stands for the reader —
   it is why the order was fixed — but the wait it imposed on Batch 4 is over.
2. **Batch 4 rebases onto merged Batch 3 and RE-RUNS its diff-scoped sweep, both arms**, with the
   `SCOPE:` line re-quoted — its write-arm verdicts must land in the re-baselined findings file, and
   the rebase changes the case list the deriver sees. Re-run `npm run lint` MID-merge (a clean
   auto-merge can undo a bulk repair). ⭐ **The base is now fetchable, not hand-carried**:
   `git fetch origin && git rebase origin/main` on the second machine. `origin/main` was `1fba8729`
   when this line was written — ⛔ measure it, never quote it; `main` may have moved since.
3. **⚠ EDITED 2026-09-08 (Batch 3 closed) — the by-hand check is still owed, but for the DOOR arm, and
   for the write arm only until Batch 3 merges.** The superseded instruction read, in full: *"**The
   write arm's empty-set trap is still open while Batch 4 runs** — Batch 3 is what makes 'exit 0 over
   zero cases' a FINDING. Until it lands, check BY HAND that the deriver's write-arm case list is
   non-empty before reading the arm's exit code as a pass."* It is edited rather than annotated
   because it is an **operational instruction** an operator acts on, and Batch 3 changed what the
   correct action is. What is true now, measured on branch `authz-writepath-baseline` @ `e4a16b33`:
   - **Two states share the name "empty" and behave oppositely.** (a) `CASES` set to tokens matching
     nothing **already** reached `exit 3 UNPROVEN` before Batch 3 (built by the 2026-08-29 REPAIR);
     Batch 3 **proved** it, did not build it. (b) `CASES` set to the **empty string** was
     indistinguishable from `CASES` **unset**, so a caller that captured the deriver's stdout without
     consuming its exit code got a **full 120-case run writing the COMMITTED baseline**, with (a)'s
     door unreachable. (b) was the real trap.
   - **Fixed in the WRITE arm only** (`p0-authz-writepath-audit.sh`; ADR 0192): set-ness is captured
     **before** the `${CASES:-}` default, so set-and-empty reaches the UNPROVEN exit.
   - ⛔ **NOT fixed in the DOOR arm.** `p0-authz-door-audit.sh` carries the identical defect,
     deliberately untouched (fixing one of two reads as fixing the class, and Batch 2's unit is
     merged). Filed as `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` 🟠, **open**.
   - **So, the action for Batch 4:** for the **door arm**, check BY HAND that the deriver's case list
     is non-empty before reading that arm's exit code as a pass — that check is owed permanently until
     the follow-up above lands. For the **write arm**, the same by-hand check is owed only while your
     checkout predates the Batch 3 merge; after the rebase in item 2 the arm distinguishes the two
     states itself. ⛔ Consume the deriver's **exit code**; capturing only its stdout is the caller
     shape that produced the trap.
4. **ADR numbers reserved up front** (parallel branches collide in sequential numbering, twice on
   record): **0192 → Batch 3, 0193 → Batch 4.** Renumber inside the rebase stop if either moved.
5. **Tracker files conflict, resolvably**: both branches edit `follow-ups-open.md`,
   `docs/features/INDEX.md`, `docs/decisions/INDEX.md`. Regenerate the indexes after the rebase
   (`npm run adr:index`, `npm run features:index`), never hand-merge them.
6. **The second machine** needs its own clone, Docker, Supabase CLI, `.env.local`, and a fresh
   `supabase db reset` before any catalog work. The detach recipe in §5 is Windows-specific; Batch 4
   is the interactive batch (a PO ruling mid-way), so it needs no detach.

### Batch 5 — Rollback runbook (`docs/deployment/authz-rollback-runbook.md`) — owner backend, docs-only

> ✅ **CONCLUDED 2026-09-08 — it rode inside Batch 4's branch**, exactly as the last line of this
> block allowed. `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` is closed and archived; §6 of the
> runbook was rewritten for six policies plus the DEFINER door, six stale figures re-measured. Row
> and gate figures: §2. ⛔ Do not re-open it from this block.

`FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` 🟠 — §6.2 hard-codes four tables and `EXPECT 4 rows`; the
re-key made it six, so an unamended revert "fails silently green" and leaves two tables re-keyed. The
runbook is titled for *every AE5 per-role increment* (ADR 0162 §1 binds its shape). PO-deferred to
post-merge — the window is now. Also re-measure §6.1's `can_manage_case_vocabulary` expiry note. Can
ship inside Batch 4's commit range.

### Batch 6 — Register / gate hygiene — owner lead (`scripts/check-*.mjs`, `build-adr-index.mjs`, and — added 2026-09-08 — `supabase/tests/mutation/p0-authz-door-audit.sh` + the deriver self-test + lead-playbook §4)

> ✅ **CONCLUDED 2026-09-08 — unit `REGISTER-GATE-HYGIENE`, ADR 0194 (amends 0192), ADR 0079
> § The recipe EDITED.** All five follow-ups (six ids) closed on their own quoted clauses and
> archived **with their entry blocks**, so `Closes when` survived the closure — the practice this
> batch turned into a gate. ⭐ The batch found two of its own subjects: gate 13's branch check could
> never pass on Windows (quotes added to fix `/bin/sh` on macOS — the same check, the same message,
> the opposite platform), and gate 11 blamed a rule's content for CRLF that git cannot show you.
> ⛔ **The batch's own recurring defect, recorded because it outlasted six corrections:** SEVEN
> times it asserted a count it had not derived — twice inside the correction of the previous one,
> and the seventh *beside* it, when the removal was scoped to the phrase the last round argued
> about rather than to the class. The standing repair is that no live count is stated in this
> unit's files; the derivation is (`live-facts-measure-dont-quote`).
> ⚠ Two items were deliberately NOT taken: the residual verdict shapes
> (`FUP-REGISTER-GATE-HYGIENE-VERDICT-SHAPES`, now carrying two conditions of opposite polarity
> because one clause could be satisfied **by the bug**), and the `c2-command-door-neutralizer`
> port, filed with its measured line numbers and why it is not a mechanical port.

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE` | 🟡 | `hubHasLedgerRow` cannot match a bold id; the review-verdict regex is case-sensitive and emoji-intolerant. **Every Record step since AE4 has used the unbolded-id workaround** (⚠ **six** rows as of 2026-09-08, re-measured by `grep -c '^\| <id> \|' docs/progress/phase-ledger.md` = 1 for each: AE4, HARNESS-CRASH-SAFETY, DOOR-SWEEP-DERIVER, PRED-DOMAIN, **WRITEPATH-BASELINE, ENFORCEMENT-MANIFEST** — the last two added by Batches 3 and 4, which had to use the workaround for the same reason; the entry said *"four rows now"*, correct when written). Fix both regexes, proven able to fire, then re-bold the rows — ⛔ all six, derived from the ledger, never from this list. |
| `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE` | 🟠 | 13 broken ADR-to-ADR links; gate 9 never resolves a link *target*. ⛔ *"must not be added mid-phase, or it blocks Gate AE4 on unrelated debt"* — the inter-batch window is the only time. AE5 adds ≥ 11 ADRs. |
| `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` | 🟠 | A shipped, approved phase has no ledger row. Write it (marked reconstructed) and **derive** whether it is the only one — never by eye. |
| `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` | 🟡 | Closures move the body verbatim but delete the register entry block — the `Closes when` field survives only in git. Batches 1–2 archived the entry block beside the body as the interim practice; make the rotation do it, or `lint:progress` assert it. |
| `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` **+** `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` | 🟠 | ⚠ **Two entries, ONE mechanism** — filed the same day by two machines that could not see each other (Batches 3 and 4, in parallel), one **by construction** on the write arm and one by a **live incident** on the door arm. Added to this batch 2026-09-08 at the Batch 4 merge, where the collision surfaced. `supabase/tests/mutation/p0-authz-door-audit.sh` cannot tell `CASES` **unset** from `CASES` **set-and-empty**, so it takes the full-run branch and rewrites the committed baseline; the caller that produces the empty string is the recipe in CLAUDE.md §6 step 1 — `CASES="$(bash scripts/door-sweep-cases.sh <base>)"` — because the deriver's **exit 1 FINDING prints no case list**, and command substitution discards the exit code that was the whole signal. It has fired for real once (2026-09-07, the lead tip gate): ⚠ **~10 min, not hours, and both committed findings files came out byte-unchanged** — the record measures it, the follow-up body says *hours* and *already rewriting the baseline*, and the record wins. ⛔ That is not a reason to downgrade it: the run was stopped by an **unrelated merge abort and a human noticing**, not by any guard. ⛔ **Do not consolidate the two ids to close this** — retiring an id orphans every citation naming it; the fix closes both, and the register tidies itself when they archive together. Fix `p0-authz-door-audit.sh` the way ADR 0192 fixed its sibling — ⛔ **ported, not copied** (the two harnesses differ inside; Batch 3's record says why) — **plus** a self-test scenario passing `CASES=""` that proves the FINDING exit fires, **plus** the lead-playbook §4 recipe made to read the deriver's exit code **before** substituting its stdout. Close on the **first** entry's clause, which is the stricter of the two. |

**Why before AE5:** cheap, and the window is structural — a gate added mid-phase blocks that phase.
⚠ **The empty-`CASES` item added 2026-09-08 is not "cheap register hygiene" and does not share that
reasoning.** It is here because the owner and the window match, and because AE5 runs the diff-scoped
sweep **eleven more times** through the very recipe that produces the empty string. ⛔ It is the only
item in this batch that touches a mutation harness, so it is planned before it is edited and every
new guard is proven able to fire — the rest of the batch may not silently set the bar for it.

### Batch 7 — Privilege surface — owner lead + **PO** (rulings), backend (execution)

> ✅ **CONCLUDED 2026-09-08 — unit `PRIVILEGE-SURFACE`, ADR 0195, QA APPROVED at `52959b8a` after three review rounds and four fix iterations; PO-approved, ff-merged, pushed.** The block below is **kept, not deleted** — it carries the derivation a later batch still reads — and this banner is what stops a reader acting on it twice.
>
> ⛔ **Two of its own clauses were WRONG when this block was written, and both are corrected here rather than left to be re-discovered:**
> **(a)** the ceiling row says *"Attribute by diffing heads `…005300` → `…007330`"*. By the time the batch ran, the live head was **`…007350`** — the run used **three** heads, and diffing only the named pair would have satisfied the clause while leaving the newer delta invisible.
> **(b)** the AE1 row says *"137 reach `authenticated` only via `PUBLIC` (`proacl IS NULL`)"*. `proacl IS NULL` re-measures at exactly **137**, but the **effective** silent-no-op class is **138** — `app.latest_published_version` carries a *non-NULL* `proacl` holding an explicit PUBLIC grant. ⛔ *"`proacl IS NULL` includes PUBLIC"* is true; its converse is **false**, and keying the class on the ACL-shaped predicate is what hid it. State **both**, with what each counts — they are different predicates, not a stale figure and a fresh one.
> **(c)** the green row's *"237 of 467"* is now **236 of 526** — ⛔ *both halves* had moved.

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` | 🟠 | The `authenticated`-executable DEFINER budget is **759 against a ceiling of 752**; six of the seven are unattributed. Attribute by diffing heads `…005300` → `…007330`; then the PO either moves the ceiling by ruling or the unjustified grants are revoked. ⛔ Editing the ceiling is reserved to the PO. The durable form is a `lint:*` gate. |
| `FUP-AE1-REVOKE-SET-EXECUTION` | 🟠 | AE1 classified **233** revokes and executed **none**; 137 reach `authenticated` only via `PUBLIC` (`proacl IS NULL`), so a naive `revoke … from authenticated` is a silent no-op. PO to rule on execution; ⚠ a revoke **may not create sweep blindness** — Batch 2's widened domain is the prerequisite. |
| `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` | 🟢 | Informational anchor: **236 of 526** `app` functions carry `anon` EXECUTE, bounded by a *config line*, not the ACLs. Not a hole; the ambient floor the permission layer sits on. ⚠ **Read `237 of 467` until 2026-09-08** (Batch 7's own execution); re-measured at head `20261003007350` — **both halves had moved**: +59 functions landed and the `anon` set fell by one. ⛔ The `236` here is the **effective** `has_function_privilege('anon', …)` predicate, **not** `320` §U1's ACL-shaped 236 — they coincide today by accident and were proven able to disagree. |

**Why before AE5:** AE5 substitutes on top of this surface; the plan calls these *"pre-live
liabilities to retire while the same team is already inside authorization."*

### Batch 8 — `app.can_manage_professional`'s self-check arm — owner backend, **PO-gated**

`FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` 🟠 — the function is parameterised on a third party but
its first arm is `coalesce(app.is_admin(), false)`, which reads `auth.uid()` — it answers about the
**caller**, never `p_uid`. Its blocker `BUG-PROF-INACTIVE-001` is **fixed** (2026-09-01), so it is
unblocked and awaits the PO. It sits on the re-keyed representative chain
(`can_create_professional → can_manage_professional`) that AE5's `org_admin` increment substitutes
through. Needs its own reachability analysis; a migration → diff-scoped sweep, both arms.

### Batch 9 — Not a fix: the AE5 plan's opening ADR — owner lead + PO

The decisions the corpus explicitly bundles for AE5's first step, none of which may be *"picked off
inside a role increment"* (ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) D8):

- The **D8 bundle**, one compatibility migration: F6 exact-assignment active context vs the role-wide
  hat (audit scope must match whichever wins) · F8 `administrativo` out of `authz.roles` ·
  `platform_role` retirement (⚠ the implementation audit recommended retiring it *now*; the binding
  decision defers it *into* AE5 — do not report these as agreeing) · F7 one manifest entry per role.
- Audit F5: *"Decide and encode the model before AE5"* — the entitlement / hard-deny / lifecycle /
  sensitivity seam; the classification columns (`risk_class`, `sensitivity_ceiling`, `resource_kind`)
  have **no reader** (ADR 0172 defers them) — a consumer appears or the column is removed with a reason.
- ADR 0175 D3's inheritance: the **arm-3 divergent cells** arrive already enumerated for AE5's matrix.
- `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` 🟡 — a stated ceiling on `D` (scopes per principal) or a
  ruling that the tenancy model makes a large `D` unreachable, with the census that shows it.
- `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` 🟡 — the pgTAP sweep half is done (`414`); the
  `search_path = ''` convention is *"a platform-wide decision owing an ADR"*.
- The per-role checklist's own corrections from Batches 0–2: quote the `SCOPE:` line; run
  `SELFTEST=1` and the set-valued targeted home beside the four arms; `NOTICED` is evidence not a
  verdict; `RESET_EVERY` on every full run; the CARRIED ruling as a step.

### Not recommended before AE5 (ruled 2026-09-04; re-check the register, entries move)

- **Probable register rot — close by writing, not working:** `FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN` 🟠 —
  its close condition ("a migration re-planning the ascent … then the acceptance re-run against it")
  was met by ADR 0180's `20261003007310` + runs 6/7 (P1 PASS, P5 at 0.00×). Verify against the run
  artifacts, then close. `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH` 🟠 — measurement discharged;
  open only as `PO to rule`.
- **Bounded residuals, ruling not work:** `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW` 🟡,
  `FUP-PERF-ANALYZE-ENDS-AE0-COMPARABILITY` 🟠 (a sequencing note for the next perf window),
  `FUP-ZERO-ARG-APP-PREDICATES-NOT-HOISTED`, `FUP-READ-ACCESS-RIDES-ON-A-WRITE-POLICY`.
- **Own increments, unrelated to the template:** `FUP-SEED-PENDING-PERSONA-CANNOT-REACH-ITS-LAYER`
  (⛔ never fix `seed.sql` in passing); `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` 🟠
  (296-site triage; now also carries Batch 2's 23 NOTICED rows as a dated work-list — the lint-pass
  form is the cheaper close); `FUP-C2-TIER1-FLOOR-ARM-HAS-ZERO-SLACK`.
- **Precede AE5 by definition (pilot gate) but are not AE5 work:** `FUP-ONE-SUPABASE-PROJECT-SERVES-TEST-AND-PRODUCTION` 🟠
  (⛔ before the pilot loads real data) · `FUP-AUTHZ-AE3-CUTOVER-OPERATOR-OBLIGATIONS-OWED` 🔴 (the only
  🔴 that says "must not reach the pilot"; no tree artifact) · Critical C1/C3/C4 ·
  `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` 🟠.

## 4. The protocol every batch follows (measured over three batches)

1. **Open the unit before the branch**: hub `docs/features/<slug>.md` (frontmatter + `## Acceptance
   criteria` = the follow-ups' own quoted `Closes when` + a proven-to-fire criterion + the gate) and
   record `docs/progress/<slug>.md`; `npm run features:index`; gates 7 + 13; commit; cut
   `authz-<slug>` off `main`.
2. **Plan first, full plan** — the subjects are harnesses that open live gates or files that decide
   what the gate sweeps. `backend` returns a plan; the lead approves with rulings written into ONE
   scratch file the build turn reads; PO questions go to the PO **before** the build where they change
   scope (Batch 2's Q1/Q3), **after** where they need a measurement (CARRIED, NOTICED).
3. **Build with proofs**: every detector/arm/widening proven able to fire on a planted reproducer
   with the OBSERVED exit code + output, paired with a clean-tree negative control and a
   discrimination half; every widening proven by **selection** (before/after sets from the live
   catalog); every restore verified in the catalog three ways; plants live in a fake repo or the
   harness's own neutralizations, never the real tree; exit codes read **bare**; runs > 5 min
   **detached** (`Start-Process` on `bash.exe` with the script as argv[1] — the `-c` form silently
   starts nothing), never under a tool timeout; **one agent on the tree** — an agent that reports
   "finished" while holding a background waiter is not finished (Batch 2, 08:11–08:23).
4. **Gate at the tip**: `npm run lint` 0/0 · `typecheck` · `test:db` on a fresh reset (shape must not
   move) · the four arms with **domains quoted** · `SELFTEST=1` (deriver + door harness) · the
   set-valued targeted home · the diff-scoped deriver over `main...HEAD` with its `SCOPE:` line ·
   `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` (empty unless the batch
   is a migration, in which case the sweep is owed both arms). From Batch 2 on, **someone other than
   the builder** runs the arms at the tip (QA asked; the lead did).
5. **QA review → fix loop (≤ 5 iterations, each fixing something new) → re-review**. QA has been
   right every time it blocked; its blocking findings have all been one shape — *a prose claim about a
   measurement, written beside a correct measurement, that no gate can contradict*. Corrections are
   **dated notes beside the original**, never rewrites.
6. **PO approval** (`AskUserQuestion`: built / tests / QA / open risks), then the **Record step**
   (lead): residual F-RECs folded by `backend`, the playbook lines the lead owns, ledger row (id
   **unbolded** until Batch 6 fixes the gate), hub → `complete` with its `## Current state` cut
   verbatim into the record (`cmp` before the cut), ADR → `accepted` and removed from
   `proposed-review.json`, indexes, lint bare, `phase(<ID>): complete`, `git merge --ff-only`, branch
   deleted. **Do not push**; measure the push distance and say it.

## 5. Standing facts that bite (verified during Batches 0–2)

- **Tail drift is real and has no originating case.** A long sweep degrades its own DB cumulatively;
  the door harness and the C2 neutralizer bound it with `RESET_EVERY` — **the writepath, rowdoor and
  invoker harnesses do not yet** (check before any full run; port first, prove as Batch 2 did).
  - ⚠ **CORRECTED 2026-09-08, beside the original — the writepath harness NOW HAS `RESET_EVERY`;
    only `rowdoor` and `invoker` remain.** Ported by Batch 3 (ADR 0192) and ⛔ **not a copy**: the
    door's `periodic_reset()` re-derives **two** catalog worklists, while the write arm's Arm 1 is
    the **static** `GUARD_KEYS`, so the Arm-1 half needed its own post-reset check (every entry
    still resolves to an OID) and the write arm has no `degenerate_gates()` analogue at all. ⛔ The
    instruction stands verbatim for the other two: **port first, prove by a planted drift
    reproducer, and pair it with a clean-tree negative control and a discrimination half** — a
    reset that cannot be shown to fire is not a bound. ⭐ And the port is proven **by selection**,
    never assumed inherited: Batch 0's closure was mis-scoped exactly that way and Batch 2 paid for
    it with a voided run. Evidence it worked here: 120 cases, `resets=8`, longest consecutive
    off-baseline run **0** against a void threshold of 3. ⚠ `resets=0` on a full run is the state
    that voided the door arm's run 1 — quote the `resets=N` line, never assume it.
- **A full run through the merge yields a CARRIED block** that a human dispositions (Batch 2: 275 rows,
  31 hand notes). Budget it; bring the enumeration to the PO before committing the file; the three
  census-mandatory re-files (`app.storage_upload_reserved`, `public.commission_cadence_overview`,
  `public.document_delete_affordances`) recur on every door re-baseline until their rows are permanent.
- **`FROMFINDINGS=1 ARM=policy` is RED** (pre-existing; 24 offenders, 12 section-stale COVERED rows) and
  unreadable until `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` lands. It is not one of
  §6's four arms. ⛔ Never allowlist the twelve.
  - ⚠ **2026-09-08 — read the figure above at ITS OWN GRAIN, and add a second grain and a delta.**
    ⛔ **Do not rewrite `12` to `38`; both are true, of different things.**
    - **12 — what the ARM REPORTS.** The red's own description (24 offenders / 12 section-stale
      COVERED rows) is unchanged and still the number a reader of that arm's output sees.
    - **38 — what the DOOR FILE HOLDS.** An `awk` census over section × column 4 at `dc643256`
      measured `docs/reviews/authz-door-audit-findings.md` at 74 `## BLIND` rows / 256 `## COVERED`
      rows with **38 disagreements** — every one in the `BLIND → COVERED` direction, none opposite.
      The write file measured **0** after QA finding B1. ⭐ **Mechanism:**
      `merge-findings-baseline.sh` step 3 emits a merged row at the **first** diff-aligned
      placeholder and `## BLIND` comes first, so an improving verdict misfiles and a worsening one
      files correctly — ⭐ *the merge is correct only for the direction that makes things worse. It
      fails closed*, which is exactly why no gate hunting for under-reporting could trip on it.
      A 38-of-38 one-directional result is itself the confirmation that the cause is the placement
      rule and not chance. ⛔ **NOT fixed here** — those rows live in Batch 2's **merged** baseline
      and repairing them re-opens a merged unit; measured onto
      `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`, which now owns **both halves**,
      the *reader* (the arm reads the section) and the *writer* (the merge writes the section).
      ⚠ Five documents describe the red as *"12 section-stale rows"*; the standing figure understates
      the door file by **26**, and because that arm is red ⛔ **no gate can contradict the number** —
      the precise condition under which a register figure rots.
    - **+5 — what Batch 3 ADDED that the red cannot register.** BLIND went **3 → 15** and
      off-allowlist **0 → 5** (`cases_staff_admin_write`, `member_titles_staff_admin_write`,
      `commissions_admin_write`, `phase_results_staff_admin_write`,
      `process_template_versions_staff_admin_write` — enumerated with verdicts in the Batch 4
      hand-off note in §3). ⛔ **Nothing was allowlisted; the rule was obeyed.** The defect is
      **disclosure**: ⭐ *an escape hatch for the UNMEASURABLE also silences the MEASURED* — a
      standing red is where new regressions land invisibly. Whoever repairs the red meets twelve
      **plus five**. ⚠ The **5** is **derived from committed artifacts, not observed from an arm
      run**. ⛔ Never allowlist the twelve, the thirty-eight, or the five.
- **Two Supabase stacks are up on the dev machine** (`supabase_db_azkbbhskturikxpgmafq` is ours;
  `escalume` is not). `supabase db reset --local` applies the directory you stand in; a catalog check
  that picks the first `supabase_db_*` container reads the wrong one (it happened). Discriminate by the
  `authz` schema.
- **`nohup setsid` does not exist in this Git Bash.** Detach with PowerShell `Start-Process` on
  `bash.exe`, script as argv[1], own `WORK` and sentinel, poll a log; read `rc.txt` bare.
- **`grep -rniF` aborts under this msys (rc 134)** and, with stderr silenced, reports zero hits — a
  dead census that reads as "none found". Use ripgrep, and prove the census can find a known sentence.
- **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared** — every gate record citing the
  door sweep says so in those words (ADR 0187 D1).
- **The CLAUDE.md review queue** was processed 2026-09-05 (four fixes applied on `main`); the Record
  step's step 7 re-checks it before each unit opens.
- `main` is far ahead of `origin/main` (97 commits at `d7964398`) and **unpushed**; push state is
  measured, never quoted.
  - ⚠ **CORRECTED 2026-09-08, beside the original — and the correction is the line's own clause
    proving itself.** `main` has since been **published**: `origin/main` = `23ec1fa5`, pushed
    2026-09-07 06:23 -0300. **Push distance measured at `e4a16b33`: `1`**, not 97. So the Record
    step's *"do not push; measure the push distance and say it"* now says **1**. ⭐ The bullet
    ended *"push state is measured, never quoted"* and was itself quoted, stale, for a day — a
    standing fact about an **external** system goes stale with no gate able to contradict it.
    ⛔ Re-run `git rev-list --count origin/main..main`; do not carry the `1` forward either.
  - ⚠ **RE-MEASURED 2026-09-08 — and the `1` above is NOT carried forward, it is superseded by a
    command.** After Batch 3's ff-merge the **PO directed the push** (Batch 4 runs on a second
    machine and item 2 of §3's Batch 4 block has it rebase onto merged Batch 3): `npm run lint`
    green at the tip, then `git push origin main` fast-forward `23ec1fa5..1fba8729`. Measured
    immediately after: `origin/main` = `1fba8729`, `git rev-list --count origin/main..main` = **0**.
    ⭐ A clean push state is an **instant, not a lease** — the next commit on `main` makes this line
    stale and only re-running the command can say so. Pushing `main` is **deploy-safe**: Coolify
    **Automatic Deployment is off** (`docs/deployment/coolify.md` — "Pushing to `main` is therefore
    safe"), so a push is publication, never a release.

## 6. Where the next session starts

> ⚠ **EDITED 2026-09-08 — this checklist now reads BATCH 8.** It is an **operational instruction**,
> so it is edited rather than annotated (R45). The superseded checklist read BATCH 7; ⛔ its facts are
> not lost and are not repeated here — every measurement it carried now lives in **§2 row 7** and in
> the Batch 7 block's CONCLUDED banner in §3, which is that fact's one home.
>
> ⛔ **The superseded text also said "Do not push"** (§4 step 6). The PO **overrode it by ruling on
> 2026-09-08**, for Batch 7's merge, on the grounds that `origin/main` was 27 commits behind before
> the merge and 52 after. ⚠ Scoped in writing to **that push**, exactly as the Batch 4 override was —
> ⛔ **not a standing licence.** Pushing `main` is deploy-safe *only while* Coolify's Automatic
> Deployment is off; ⭐ that was **re-verified at the push**, not quoted from
> `docs/deployment/coolify.md` — a record's claim about an external system goes stale silently.

Batches 0–7 are concluded (§2). **Batch 8 is next.**

1. **Measure, do not assume, where the tree stands.** `git status` clean on `main`;
   `git rev-list --count origin/main..main` (⛔ re-run it — a clean push state is an **instant, not a
   lease**, and Batch 6 proved a branch can appear mid-session); `docs/features/INDEX.md` shows no
   `in_progress` hub. If any is false, stop and read the hub that is in progress.
   ⛔ **A deleted branch is not evidence of a merge** — the proof is
   `git merge-base --is-ancestor <unit tip> main`, run **bare**.

2. **Read Batch 8's block in §3.** It is **one** follow-up,
   `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` 🟠, and it is **PO-gated**: its blocker
   `BUG-PROF-INACTIVE-001` is fixed (2026-09-01), so it is unblocked and awaits a ruling.
   ⚠ **Unlike Batch 7, this one is a MIGRATION.** `app.can_manage_professional` is parameterised on a
   third party but its first arm is `coalesce(app.is_admin(), false)`, which reads `auth.uid()` — it
   answers about the **caller**, never `p_uid`. ⇒ It owes its own reachability analysis, and then a
   migration → **diff-scoped sweep, BOTH ARMS**, over the derived case list. ⛔ Batch 7's empty
   `PATHSPEC_BYTES=0` assertion will **not** apply, and E2E may be owed.

3. Say **"initiate Batch 8"** to the lead. The lead opens the hub + record **before** the branch
   (gate 13's branch check is live on Windows since Batch 6, and it wants the branch to exist), then
   plans before touching anything.

4. After Batch 8: **9** (§3). Batch 9 is not a fix — it is AE5's opening ADR, and AE5 itself stays
   **post-pilot** by ADR 0155 G1.

### ⭐ What Batch 7 learned that the next batch should not re-learn

- ⛔ **A follow-up's `Closes when` can name STALE HEADS, a WRONG PREDICATE, or a case that cannot
  fail.** Batch 7's three clauses contained all three faults. Read the **body**, re-measure what it
  names, and correct the clause *before* closing on it — never around it.
- ⛔ **A count is not a set.** The budget was **identical** at two heads and the set diff was still
  the only instrument that could see an add/remove pair. A zero delta is what a compensating pair
  looks like.
- ⛔ **"Head N" does not identify a migration set.** Key reproduction on the **pair**
  `(max(version), count(*))`.
- ⛔ **Before building a gate, grep for its incumbent.** `320` §U1 already pinned an overlapping
  population with its own merge rule; a second home would have been two ratchets and two rules over
  one surface.
- ⛔ **A committed number needs ONE home and a GATED mirror**, and a live-catalog count cannot be a
  `npm run lint` step (no Docker) — it buys *"the next Phase Gate noticed"*, never *"the next commit
  noticed"*. Say which you delivered.
- ⛔ **Fixtures derived from the real artefact are poisoned by the plant they exist to detect** —
  gate 14 nearly shipped with its one real red unreachable and its exit code **inverted** from
  *finding* to *checker broken*.
- ⛔ **A "derived" sweep that is piped through `head` is a hand-list wearing a label.** Batch 7 filed
  a follow-up naming that exact failure and then committed it one commit later, over 132 matching
  lines. ⭐ Four of the batch's findings were the **lead's own**, and this was the sharpest.
