# Pre-AE5 remediation — the nine follow-up batches

**Status:** live plan · **Owner:** lead (orchestration), backend (build), qa (review), PO (rulings)
**Program:** AUTHZ — ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) ·
**Ruled:** 2026-09-04 (lead session `9346f622`) · **Last updated:** 2026-09-07 at `main` @ `d7964398`

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

## 2. Concluded — Batches 0, 1, 2 (all on `main`, all PO-approved, all QA-approved)

Each row's authority is its hub (summary) and record (log); this table is a pointer, never a
restatement. **Re-measure anything you rely on.**

| # | Unit (hub · record) | Merged | Closed | What it made true |
|---|---|---|---|---|
| 0 | `HARNESS-CRASH-SAFETY` — [hub](../features/harness-crash-safety.md) · [record](../progress/harness-crash-safety.md) · ADR [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md) | `76d87a4f` 2026-09-04 | `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` · `FUP-AUTHZ-HARNESS-PRECONDITIONS` · `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` · `FUP-AUTHZ-HARNESS-TRANSACTIONAL` (PO: **detect-only**, marker not built by decision) | A restore is believed only when the **catalog** agrees (psql rc **and** md5); a failed restore **keeps** the sentinel; `RECOVER=1` in all three sentinel-bearing harnesses; both verdict preconditions asserted and printed; `SUITE=` is a subset; the C2 neutralizer bounds tail drift (`RESET_EVERY`, interlock, retry-once). ⚠ **Mis-scoped as closed**: the tail-drift fix reached the C2 harness only — Batch 2 paid for that (its archive amendment says so). |
| 1 | `DOOR-SWEEP-DERIVER` — [hub](../features/door-sweep-deriver.md) · [record](../progress/door-sweep-deriver.md) · ADR [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) (amends 0173, 0079) | `bbda5392` 2026-09-05 | `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` (on a **visibly amended** condition — ADR 0079 hazard 4) · `…MARKER-BLIND-TO-CONTINUATION-LINES` · `…DERIVER-BLIND-TO-ALTER-FUNCTION` · `…DERIVER-SPANS-THE-WHOLE-WORKING-TREE` · `…FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` · `FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN` | The deriver **lifts** `PRED_DOMAIN` from the harness (ABORT on drift) instead of copying it; a door is a **catalog** fact and `CASES=` is the sweepable tier only; `ALTER FUNCTION … SECURITY DEFINER` read like `ALTER POLICY`; the whole `door-sweep-targets:` declaration parsed; per-case provenance and a quotable `SCOPE:` line on every exit; the four sweeps' full-run emit **merges** into the committed baseline, preserving every line the generator did not produce (verifier proven on the old helper's real losses); `SELFTEST=1` over committed fixtures (34 scenarios). QA took four rounds — round 1 found a genuine blocker (the merge destroyed hand-authored material at exit 0). |
| 2 | `PRED-DOMAIN` — [hub](../features/pred-domain.md) · [record](../progress/pred-domain.md) · ADR [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md) (amends 0173, 0079) | `d7964398` 2026-09-07 | `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` + `…GAP-WIDENED-BY-SET-VALUED-RESOLVERS` (jointly) · `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` · `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` · `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` · `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` | `PRED_DOMAIN` gains the `authz` **schema axis** (bounded to boolean); selection delta exactly `candidate_has_permission` + `scope_reaches`; the `SETOF uuid` resolvers get a committed **targeted-case home** (scheduled in lead-playbook §4); `NOTICED` = a fourth outcome, PO-ruled **evidence not a verdict** (disclosed, non-blocking); the read arm opens `using` only (11 `(ALL)` flips work-listed); a per-run `DOMAIN-STATEMENT` with ADR 0187 D1's sentence byte-exact; the door harness gained Batch 0's tail-drift design after run 1's 78-row drift tail was proven with **no originating case**; the door baseline **re-earned** through a bounded run (353 cases, 40 resets: 294 COVERED · 36 BLIND · 23 NOTICED · 0 ERROR), 275 CARRIED rows dispositioned per PO ruling, 31 hand notes preserved. |

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
pre-existing and unreadable until this lands — 12 stale rows, never allowlist them**) ·
`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET` 🟠 · `FUP-AUTHZ-SETVALUED-HOME-DOES-NOT-EMIT-ROWS` 🟡 ·
`FUP-AUTHZ-MERGE-HEADERS-RELOCATE-AND-MALFORMED-ARM-HAS-NO-SELFTEST` 🟡 · `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING` 🟠.

## 3. Remaining — Batches 3 to 9, in dependency order

Severities and ids were re-verified against `docs/followups/follow-ups-open.md` at `d7964398`.
Every batch closes its follow-ups **on their own quoted `Closes when` clause**, never on a summary.

### Batch 3 — Write-arm baseline (`supabase/tests/mutation/p0-authz-writepath-audit.sh`) — owner backend

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

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` | 🟠 | `hardDenyClasses` is `[]` on 43/43 manifest rows; lint arm M7 iterates an empty list and **cannot fail**; §6.2 has no discrimination control and searches only depth 1. PO took remediation (a) — a *disclosure*; (b) is still owed and must land as **one change** (populate or convert the loop + a discrimination control + a transitive search). **The one literal "before AE5" sentence** in the corpus (Gate AE4 review: "when non-empty rows first appear"). |
| `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` | 🟠 | The re-keyed `form_item_validations` policy is **unreachable** (`authenticated` holds SELECT only); the real writer `public.set_item_validations` still gates on `is_staff_admin_of` — layer 1. Either re-key the DEFINER onto the permission or record the split deliberately in the manifest row. ⚠ Unswept class: *every `_staff_admin_write` policy in the tree* — enumerate it. This is the template defect the re-review named ("a re-key at the policy leaves the DEFINER surface on its legacy gate, and this template is what AE5 will copy"). |
| `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` | 🟡 | `app.current_professional_read_organizations` carries the literal `org.professionals.read` and appears in no `enforcementSites` row — deliberate, undeclared, held green by a by-name pin in pgTAP `410 §8.5`. **PO call**: add it to the row or record a reviewed exclusion; delete the pin in the same change. |
| `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` | 🟡 | `app._audit_access_authorized` is a fourth consumer of `can_read_professional_profile`; nothing records that changing the authorizer moves the audit gate. A note in the manifest row's qualifier or `backend-state.md`. ⛔ NOT added to `enforcementSites` (that would make the site-axis closure check measure a fiction). |

**Why before AE5:** the manifest is the per-role template's oracle; F-BLOCK-1's recurrence "AE5
multiplies by 11". Any re-key here is a **migration** → the diff-scoped sweep is owed, **both arms**,
derived by the Batch 1 deriver with its `SCOPE:` line quoted (Batches 1–2 are its prerequisites).

### Batch 5 — Rollback runbook (`docs/deployment/authz-rollback-runbook.md`) — owner backend, docs-only

`FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` 🟠 — §6.2 hard-codes four tables and `EXPECT 4 rows`; the
re-key made it six, so an unamended revert "fails silently green" and leaves two tables re-keyed. The
runbook is titled for *every AE5 per-role increment* (ADR 0162 §1 binds its shape). PO-deferred to
post-merge — the window is now. Also re-measure §6.1's `can_manage_case_vocabulary` expiry note. Can
ship inside Batch 4's commit range.

### Batch 6 — Register / gate hygiene — owner lead (scripts under `scripts/check-*.mjs`, `build-adr-index.mjs`)

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE` | 🟡 | `hubHasLedgerRow` cannot match a bold id; the review-verdict regex is case-sensitive and emoji-intolerant. **Every Record step since AE4 has used the unbolded-id workaround** (four rows now: AE4, HARNESS-CRASH-SAFETY, DOOR-SWEEP-DERIVER, PRED-DOMAIN). Fix both regexes, proven able to fire, then re-bold the rows. |
| `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE` | 🟠 | 13 broken ADR-to-ADR links; gate 9 never resolves a link *target*. ⛔ *"must not be added mid-phase, or it blocks Gate AE4 on unrelated debt"* — the inter-batch window is the only time. AE5 adds ≥ 11 ADRs. |
| `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` | 🟠 | A shipped, approved phase has no ledger row. Write it (marked reconstructed) and **derive** whether it is the only one — never by eye. |
| `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` | 🟡 | Closures move the body verbatim but delete the register entry block — the `Closes when` field survives only in git. Batches 1–2 archived the entry block beside the body as the interim practice; make the rotation do it, or `lint:progress` assert it. |

**Why before AE5:** cheap, and the window is structural — a gate added mid-phase blocks that phase.

### Batch 7 — Privilege surface — owner lead + **PO** (rulings), backend (execution)

| Follow-up | Sev | The gap |
|---|---|---|
| `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` | 🟠 | The `authenticated`-executable DEFINER budget is **759 against a ceiling of 752**; six of the seven are unattributed. Attribute by diffing heads `…005300` → `…007330`; then the PO either moves the ceiling by ruling or the unjustified grants are revoked. ⛔ Editing the ceiling is reserved to the PO. The durable form is a `lint:*` gate. |
| `FUP-AE1-REVOKE-SET-EXECUTION` | 🟠 | AE1 classified **233** revokes and executed **none**; 137 reach `authenticated` only via `PUBLIC` (`proacl IS NULL`), so a naive `revoke … from authenticated` is a silent no-op. PO to rule on execution; ⚠ a revoke **may not create sweep blindness** — Batch 2's widened domain is the prerequisite. |
| `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` | 🟢 | Informational anchor: 237 of 467 `app` functions carry `anon` EXECUTE, bounded by a *config line*, not the ACLs. Not a hole; the ambient floor the permission layer sits on. |

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
- **A full run through the merge yields a CARRIED block** that a human dispositions (Batch 2: 275 rows,
  31 hand notes). Budget it; bring the enumeration to the PO before committing the file; the three
  census-mandatory re-files (`app.storage_upload_reserved`, `public.commission_cadence_overview`,
  `public.document_delete_affordances`) recur on every door re-baseline until their rows are permanent.
- **`FROMFINDINGS=1 ARM=policy` is RED** (pre-existing; 24 offenders, 12 section-stale COVERED rows) and
  unreadable until `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` lands. It is not one of
  §6's four arms. ⛔ Never allowlist the twelve.
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

## 6. Where the next session starts

1. `git status` clean on `main`; `git log --oneline -1` shows `d7964398` or later; `docs/features/INDEX.md`
   shows no `in_progress` hub. If either is false, stop and read the hub that is in progress.
2. Read Batch 2's [record](../progress/pred-domain.md) § "run 1 voided by tail drift" and § "the CARRIED
   enumeration" — Batch 3 repeats both shapes on the write arm.
3. Say **"initiate Batch 3"** to the lead. The lead opens the hub + record, cuts `authz-writepath-baseline`,
   and spawns `backend` for the plan — never the build first.
