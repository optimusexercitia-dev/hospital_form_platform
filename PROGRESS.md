# PROGRESS.md — Live Project State

> **LIVE STATE ONLY** — current phase and next actions, non-complete phase rows, OPEN
> bugs, the measured State block, Critical FUP, and the OPEN follow-up index. An entry
> leaves the moment its work merges and is recorded. Update state here first.
>
> **The contract lives elsewhere, deliberately** — judgment in
> [progress-contract.md](.claude/rules/progress-contract.md), mechanics in
> `npm run lint:progress` (gate 7), and **that script is the authority**. Restating a
> check here creates the second copy that drifts, which is what this file is recovering
> from: one claim about it was replicated into four documents and true in none.

## Now — current phase & next actions

_Lead-owned. This section replaces the old "Current Phase Tasks" + "🛑 START HERE"
banners; the full DM-FUP triage narrative those banners carried is preserved verbatim
in [dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md)._

- **🟢 AE3 CUTOVER COMPLETE 2026-09-01** — schema-first discharged end to end: 5 migrations applied → **catalog-verified on the remote** → `git push main` → Coolify green (after one build break, `a12b7c1d`) → § 3 smoke **PASSED**. Narrative + every figure → [2026-Q3.md](docs/progress/2026-Q3.md); runbook → [ae3-cutover-runbook.md](docs/deployment/ae3-cutover-runbook.md). ⛔ **TWO CLOSING OBLIGATIONS STILL OWED — the operator’s, not a session’s: (1) ROTATE THE REMOTE DB PASSWORD** (§ 4.1 — typed on a workstation during an incident-shaped procedure; treat it as exposed rather than reasoning about whether it was), **(2) DESTROY `~/ae3-preimage.csv.gpg` TOGETHER WITH ITS PASSPHRASE** (destroying one without the other discharges nothing). ⚠ **Neither leaves an artifact in the tree — no gate, and no later session, can notice they were skipped.** This line is the only witness; delete it only when both are done.
- **✅ C2 FULL SWEEP COMPLETE 2026-09-02 — the DB window is CLOSED and the stack is FREE.** ⭐ **171 of 171 enforcers swept — the FIRST verdicts the C2 command-door class has ever had** (before this it was sized and instrumented, never run). ⭐ **COVERED 109 · BLIND 40 · ERROR 22** — ⚠ the committed [findings file](docs/reviews/c2-command-door-findings.md) says 106/40/25 and is **derived, do not hand-edit**; three of its ERROR rows are tail-drift artifacts re-measured to COVERED in isolation (`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`). Baseline `Files=259, Tests=8685, PASS`; **53 s/run, ~5 h** — ⛔ the design doc's ~2.2 h assumed ~23 s and was wrong. ⭐ **Verdict integrity is stronger than the counts look:** COVERED demands a red-then-**green** pair and BLIND demands the baseline shape, so all 149 real verdicts were taken at `Tests=8685` — **drift cannot masquerade as coverage.** DB verified restored (`Files=259, Tests=8685, PASS` after reset; **zero** `ROLLBACK FAILED`). ⛔ **C2 IS NOT CLOSED — see the three bounds in ADR [0180](docs/decisions/0180-c2-sweep-runs-against-the-current-branch-schema.md) points 4–5.**
- **⚖ PO RULING 2026-09-02 — the C2 branch-order hold is LIFTED, and the sweep runs against THIS branch (519 migrations, AE4's 18 included), not `main`'s 501.** Facts that unblocked it: C2's entire apparatus (neutralizer, worklist, sizing script, design doc) **is already merged to `main`** — the branch named `authz-c2-tier1` carries 104 commits of **AE4** work, so the name is a misnomer. ⛔ **This CONTRADICTS ADR [0162](docs/decisions/0162-authz-evolution-plan-audit-corrections.md) §3** (*"runs as its own increment, never folded into AE1's or AE4's branch"*). The PO accepted the tradeoff knowingly: broader coverage in one pass, at the cost that **C2's findings are NOT independently mergeable to `main` until AE4 lands**. ⛔ **An ADR amending 0162 §3 is OWED at the Record step** ⭐ **Context that makes the ruling coherent (2026-09-02): `origin/authz-c2-tier1` IS the shared AE4+C2 line** — it carries the other machine's IA-F9 and AE4-run commits, and **AE4 is under implementation on that machine, BLOCKED awaiting C2 to land**. So C2 is not being folded into a foreign branch; it is landing on the integration line AE4 already shares. ▶ **Delivery path: commit the findings, then push to `origin/authz-c2-tier1`** — that branch, not a merge to `main`, is how C2 reaches the waiting session. — without it the next session reads 0162 §3 as current law and treats this run as a protocol breach. 0162 §3's corollary still binds: state the uncovered door population beside the covered one.
- **🟠 nvm still defaults to Node 20, and `npm run lint` DIES AT GATE 8 there** (`globSync` needs 22+).
  `.nvmrc` + `engines` are set; **`nvm alias default 24` is not**. ⛔ **CORRECTED 2026-08-31: this said
  `default 22`, and following it literally still left the tree BELOW the pin** — `.nvmrc` is **24** and
  `engines` is **`>=24.0.0`** (measured, not quoted). The bullet's own remedy was the stale half. ⛔ Kept live deliberately when the
  gate-tooling bullet was rotated 2026-08-25: it is the one item in that ✅-marked bullet with an
  unfired resolution event, it exists in **no other file**, and rotating the bullet whole would have
  buried an open action under a completed heading — owner: whoever next hits it.
- **▶ Next, in order** (PO-sequenced 2026-08-18; **the 0125/0126 build that jumped this queue
  has SHIPPED**, so these resume their order):
  1. **C1a** — ✅ **DISCHARGED 2026-08-31**: § 3 steps A–D ran end-to-end **twice** (`standard` +
     **`phi`** tier) via the `subject_request` lane; byte proof earned (−168 B per run). Narrative +
     the six instruction defects → [2026-Q3.md](docs/progress/2026-Q3.md); run log →
     [phi-backup-run-log.md](docs/deployment/phi-backup-run-log.md). ▶ **Still owed:** the runbook's
     `NEVER EXECUTED END-TO-END` banner is now **FALSE** · § 3 Step B needs a **retention-gate
     warning** (delete-then-`HC0DR` manufactures the § 4 orphan class) · ⛔ **after a fresh reset the
     disposal queue is EMPTY** — `seed.sql` creates **zero** `file_objects`, so constructing the
     pending state is a mandatory first step the runbook omits. ⛔ **C1b (Cloud) NOT discharged** —
     the byte proof is local-only by construction; column PHI is a different procedure.
     ⚠ **`HC0DR` is still live**: ADR 0114 O1's provisional catch-all blocks every file whose reason
     is neither `subject_request` nor `duplicate`. The run went *around* that gate by the lane
     designed for it — it did **not** open it.
  2. **C2 Tier 1** — ✅ **SIZED + RE-GRAINED 2026-08-31.** The 2026-08-18 predicate returned
     **405/427 (94.8 %)** and did not partition; PO ruled **re-grain**. Adopted: a door is Tier 1
     when its **GATE-AWARE closure** (never descending into a boolean-returning predicate — a gate
     that *checks* PHI access is not a PHI-touching door) reaches a relation that is **door-only for
     `authenticated`** or carries a **positive-polarity PHI comment**. ⭐ **Tier 1 = 237 of 427
     (55.5 %), Tier 2 = 190**; all six positive controls pass, **no hand-list**. ⛔ **The TENANCY
     disjunct is DROPPED, not re-grained** — a **domain tautology** (92.5 → 81.0 → 74.5 % across
     every grain and exclusion tried, driven by `cases`/`memberships`/`meetings`). Those doors are
     **Tier 2 = deferred, NOT cleared**; tenant isolation still rides on `ARM=hat`/`floor`/`policy`.
     Instrument `scripts/authz-c2-tier1-sizing.sql`; worklist (derived, **255** lines — ⚠ this said
     *237*; re-measured 2026-09-01, and the file was last written by the re-grain commit itself)
     `supabase/tests/mutation/c2-tier1-doors.txt`; record + rejected variants →
     [authz-c2-tier1-sizing.md](docs/design/authz-c2-tier1-sizing.md) §8b.
     ⭐ **AE4 reached this same population from a different direction (ADR [0173](docs/decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)) — cross-reference rotated 2026-09-02 to [authz-c2-tier1-sizing.md](docs/design/authz-c2-tier1-sizing.md).** ⛔ Not a second exposure and not a second population.
     ⭐ **THE LONG POLE IS BUILT — `supabase/tests/mutation/c2-command-door-neutralizer.sh`**
     ([design](docs/design/authz-c2-command-door-neutralizer.md)). It rewrites an authz `raise` to
     `null;` — **guard gone, EFFECT intact**; stubbing a delegating body instead removes the work
     too and reads as a **false COVERED**. ⭐ **Its unit is the ENFORCER, not the door** — the 237
     doors share **243** enforcers (**72** already in the bool arm, **171** new), so the door list is
     the *attribution* map, not the worklist. ✅ **PROVEN ON BOTH POLARITIES — 5 COVERED, 3 BLIND**
     against a `Files=248, Tests=8289` baseline; the BLIND polarity was proven **deliberately**,
     because five identical verdicts cannot show a detector able to return the other one. The 3
     BLIND are real findings → 🟠 `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`.
     ✅ **THE FULL SWEEP HAS NOW RUN — 2026-09-02, 171 of 171: COVERED 109 · BLIND 40 · ERROR 22.** ⛔ **C2 still does NOT close**, and the reason is the instrument, not the doors: the anchor `errcode = '(42501|HC0[A-Z0-9]{2})'` is a **SYNTAX, not a property** — it excludes `HCDS*` (60 raises, the LGPD Art. 18 lane) and `28000` from the worklist **entirely** (the gate-fn filter shares the anchor), AND sweeps in non-authz **state** guards (`HC038`, `HC043`) alongside real ones (`HC039`). So a verdict here means **`HC0*`-coded-guard coverage, not authorization coverage**. Plus **22 doors carry no verdict at all** — 16 abort a pgTAP file (`FUP-C2-SUITE-ABORT-ERROR-CLASS`, incl. ⚠ `submit_response`, the Rule 3 authority), 5 are the semicolon anchor defect (**fix VALIDATED: 2294/2294, 0 regressions**), 1 ruled. → `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`. ⭐ Blindness is **not uniform** — correction workflow 4/5 BLIND and interview 6/9, vs referral 3/16: keystone effort belongs there, not spread evenly.
     Both absorbed items stay open; `assume_role` stays ERROR-shaped.
  3. **`FUP-DM4-PRODROW`** — now actionable: re-derive a magnitude, or rule that it
     cannot be (TRIAGE #9 already forbids closing it as "reconciled").
- **⚠ Two facts a session must not trip over** (full context in the
  [triage narrative](docs/progress/dm-fup-triage-2026-08-18.md)):
  1. The remote DB holds **NO REAL CUSTOMER DATA** — but ⛔ it is **NOT empty**: it carries the E2E
     SEED FIXTURE (measured 2026-08-21: `auth.users` = 36, all `@test.local`, plus synthetic PHI).
     This line said *"is EMPTY"* until 2026-08-23 and was contradicted by § State's own correction
     the whole time — the **conclusion** (safe to touch) survives, the **premise** did not, and the
     premise is what other decisions rested on. ⛔ **Re-measure, never quote** (stale 5×). It
     **expires when the pilot loads data**.
  2. **C1 split into C1a (local) + C1b (Cloud); the pilot bound is C1b** — a green
     local rehearsal does NOT release the pilot (§ Critical FUP C1).
- **Worktrees — ⛔ NEVER read a count from this file.** It has been wrong **three times running**
  (NONE while three existed → TWO while one did), and no warning ever fixed that; the count is
  gone rather than re-stated. `git worktree list --porcelain` is the only source.
  ⚠ In a worktree, check `.env.local` **and** a **non-empty** `node_modules` before any gate
  ([worktrees.md](docs/worktrees.md)) — the second fails silently by borrowing the parent's.
- **📐 ADR 0155 — the authz-evolution program.** ▶ **AE0–AE3 ✅ COMPLETE, merged and PUSHED** (AE3 2026-08-31, push 2026-09-01) — concluded narrative rotated to [2026-Q3.md](docs/progress/2026-Q3.md); per-phase detail → [authz-ae0](docs/progress/authz-ae0.md) · [ae1](docs/progress/authz-ae1.md) · [ae2](docs/progress/authz-ae2.md) · [ae3](docs/progress/authz-ae3.md). ▶ **AE4 IN FLIGHT** on branch `authz-ae4-catalog` — **AE4.1–AE4.6 + AE4.7a/b/c all BUILT and GATED**; increment detail, every figure and each increment's "what it did NOT do" → [authz-ae4.md](docs/progress/authz-ae4.md); mid-phase QA → [authz-ae4-review.md](docs/reviews/authz-ae4-review.md); ADRs [0172](docs/decisions/0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md) · [0173](docs/decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) · [0174](docs/decisions/0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md) (⛔ AE4.7c has **no ADR** by PO ruling — matrix § 12.8 is its home). ▶ **AE4.8 ✅ BUILT 2026-09-02 — the app-side seam collapse.** ⭐ **Narrative ROTATED 2026-09-02 to [authz-ae4.md § AE4.8](docs/progress/authz-ae4.md)** . ⛔ **Any re-run must give EVERY test a verdict — a serial abort is unmeasured, never passing.** (The gate's *"1 failure"* was really TWO from one cause; that narrative rotated 2026-09-02 → [bug-log-archive.md](docs/progress/bug-log-archive.md) § BUG-AE47C-LINKAGE-001.) ⛔ **The live carry-overs, which do NOT travel with it:** every red at this tree was **connection-level, never an assertion**, and the next full run still needs a **QUIET MACHINE**. ⛔ **TWO QUALIFIERS OWED TO THE GATE RECORD:** §20 is **ONE HOP**, not the transitive closure; and after D3, `can_read_professional_profile`'s arms 1/3 are **EXERCISED BUT NOT ORACLED** (403 §7.2/§7.3 assert they cannot grant in this fixture) — *"the differential is green"* may not be written without it. ⚠ **The deriver exited 1 and is RULED, not waived** (`20261003007240` is comment-only — catalog-verified `prosrc` byte-identical). ⚠ Both FUPs are **documented / downgraded, NOT closed**. ⛔ **PO-RULED: HOLD EVERYTHING ON THE BRANCH** — no merge, no `db:push`, no `git push`; the **whole phase merges at Gate AE4**, and the schema-first rule ([rule](.claude/rules/push-schema-before-code.md)) is **armed but not yet owed** — it fires at that merge. ⛔ **Re-measure `main` vs the branch, never quote it.** ⚠ **One lead finding must survive to the gate record:** the MATCH FULL keystone is **unreachable on the real `memberships`** — `memberships_role_check` / `memberships_scope_shape` reject the garbage row first, so on that table it measures a *different* control. Split scratch-table (FK semantics) from real-table (FK existence, **not** MATCH-FULL-specific), and record MATCH FULL's value as **prospective** — it is what survives the AE5-complete CHECK retirement. ⛔ **C2 is NOT a prerequisite** — ADR 0162 § 3 puts its Tier-1 subset before **Gate AE4's PO approval**, never before the branch-cut, and says it runs as its own increment "never folded into AE4's branch". ⛔ AE3's G2 authorization was single-use and **expires when the pilot loads data**; AE4 does not inherit it. ▶ **AE4.9 do-now 1+2 ✅ BUILT 2026-09-02 (backend) — ADR [0177](docs/decisions/0177-ae49-resolver-contract-implementation-choices.md)**; every figure + what it did NOT do → [authz-ae4.md § AE4.9](docs/progress/authz-ae4.md). Migrations `20261003007250` (D4) + `20261003007260` (D7); the resolver PAIR became a QUARTET — `has_permission` (runtime, `authoritative` only, fails closed) · `candidate_has_permission` (pre-cutover oracle, also sees `test_validation`, **never** EXECUTE-granted) · `explain_permission` · `entailed_grants` (the ONE copy of the entailment join). ⛔ **The `ARM=census` red was REAL and is the arm doing its job** — it flagged both new booleans as UNKNOWN; it returns to 0 only because each was classified with a named reason **and a mutation-proven compensating keystone** in `authz-unswept-backlog.txt`, never by widening a filter. ⛔ **Door sweep BOTH arms = 3 UNPROVEN, recorded as UNPROVEN and NOT as a pass:** READ swept 1/COVERED 1/BLIND 0; **WRITE measured NOTHING** (0 gates selected — it cannot tell "no blind gate" from "no gate looked at"). ⚠ **Three of the four new objects carry NO sweep verdict, for three DIFFERENT reasons** (name-bounded predicate arm · scalar non-bool = C2 · set-returning-and-unreachable), and `public.assume_role` is a fifth that `ARM=census` **structurally cannot see** because it kept its name and changed its body. ⭐ **AE4.9 D6+D5 BUILT 2026-09-02 — the re-key landed and §6 step 2 is EARNED**; every figure, the four ARMs, both sweep arms and what it did NOT do → [authz-ae4.md § AE4.9 D6](docs/progress/authz-ae4.md). 3 reps re-keyed (grant deletion now flips the **production door**), manifest 43 rows no-default-arm, **40 `pending-rekey`**; ADR [0178](docs/decisions/0178-ae49-d6-rekey-as-built.md). ⭐ **`e2e:prod` GATE GREEN in a SINGLE run** (`GATE_EXIT=0`, 1h43m, 1273/1273 accounted, 3 infra re-runs all `server_dead=1`) — this **supersedes the 3-run COMPOSITE**. ⚠ **The honest sentence is NOT "3 of 43 on layer 3"**: 3 sites call layer 3 on the `staff_admin` path and **5 non-permission grant paths survive INSIDE** them (410 §4.6 pins them by name). ⛔ **Door-sweep WRITE arm = UNPROVEN (exit 3), 0 gates selected — NOT a pass**; and **performance evidence (IA-F9) still does not exist**.
- **▶ GATE-AE4 WAVE — 3 of 4 BACK 2026-09-02; perf still running.** ⛔ **A FINAL `e2e:prod` IS NOW CERTAIN:** F-BLOCK-1's fix is a migration, so the *"the existing single-run green already describes the merged tree"* reading is **dead** — it was only ever contingent on the E2E-invalidating set being empty. ✅ **WRITE-ARM INSTRUMENT FIXED** (`d2069603`) — its domain was an embedded **33-row snapshot** bounded on `cmd in (INSERT,UPDATE,DELETE)`: a **syntax, not the property**, and `FOR ALL` is a write command. Live catalog = **107** write-capable policies (62 `ALL` + 17 + 17 + 11), so **74 were invisible**, including all four D6 policies and **3 `storage.objects` INSERT policies `ARM=census` also misses** (it bounds to `public`). New bound: every `pg_policy` with `polcmd <> 'r'`, lifted at run time, in every schema; an `ALL` policy opens its **`with check` half ALONE** — the read arm already opens `using`, so opening it here lets a READ keystone earn a false WRITE `COVERED`. ⛔ **STILL UNPROVEN — the sweep was NOT run** (it mutates the shared stack): an instrument is not a measurement, and 4 gates *selected* is not 4 gates *measured*. ⚠ The committed findings file covers **33 of 107** and now says so; `FROMFINDINGS` arms re-measure nothing, so they **cannot** see that gap — it closes only when a full sweep merges its rows in. ⚠ Full-sweep cost **~19 → ~50 min** (120 cases; `p0-authz-invariant.sh:308` runs it in the non-`FROMFINDINGS` arm). ✅ **ROLLBACK RUNBOOK §6 WORKED EXAMPLE LANDED** (`3634a3ad`) — the last IA-F10 gap; **6 runbook/template defects found FALSE en route** (D1 blind to the shape D6 shipped · Section A guards only the function, never the policy · an unanchored `like` · a hardcoded `language sql` · `lint:authz-vectors` never touches a DB, so a post-rollback green there proves nothing · arm order is not uniform and `387` C1 hashes TEXT). ⛔ Its revert was **NEVER EXECUTED** — every post-revert value is a **labelled derived expectation** carrying a 6-step closure list owed to the DB window. ⛔ **GATE AE4 QA = CHANGES REQUESTED** (`a6ff4ad0`, reviewed at `e897b452`, tree has moved since) → [review](docs/reviews/authz-ae4-gate-review.md); ⚠ the early-review ordering is **PROVISIONAL — the PO ratifies it**. ⭐ **THE DB WINDOW HAS FOUR QUEUED JOBS, cheapest first:** write-arm sweep (4 cases, minutes) → rollback §6 verification (fresh reset · mint the migration · `test:db` · then `git checkout` it away) → IA-F9 measurement → **C2 Tier 1 (~6 h)**. ⛔ **CORRECTION, reached independently by THREE agents:** `org.case_vocabulary.manage` was **NOT re-keyed** — ADR 0178 §4 explicitly rejects that; it is a fourth **differential** representative in `403`. The gate record says **three re-keys, four representatives**, and a plan listing *"four sites to revert"* sends an operator hunting an object that does not exist.
- ✅ **Gate 7’s cap breach is CLEARED** — rotated 2026-09-02; `npm run lint` re-measured **12/12, exits read DIRECTLY**, so the AE4.9 D6 record’s `lint 12/12` no longer rests on a pre-red measurement. Incident, and why rotation **cannot** reach the soft target (the OPEN index + § Critical FUP are **61 %** of the file, measured 2026-09-02) → [2026-Q3.md](docs/progress/2026-Q3.md).
- ⚠ **AFF4's unfiled residue is still live** — ~16 QA-review obligations + ~20 plan-discovered follow-ups were never converted into `FUP-*` index lines at its Record step, so they are invisible to the register the PO reads from (pointer list: [aff4.md](docs/progress/aff4.md) § "Residue this Record step did NOT file"). ⛔ The one AFF4 item that has NOT concluded.
## Phase Status — live rows only

> **Completed rows live in [phase-ledger.md](docs/progress/phase-ledger.md)** —
> append-only, every phase forever, moved there 2026-08-18. Only rows **not yet
> `✅ complete`** stay here; at the §6 Record step the completing phase's row moves
> to the ledger **verbatim** (the gate fails on a `✅ complete` row here). Verbose
> cell prose for old rows: [phase-status-archive.md](docs/progress/phase-status-archive.md).

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 9 | Deployment | 🔜 not started | – | – | – | – | – | – |
| 18 | Self-Assessment & Internal Audit | 🔜 not started | – | – | – | – | – | – |
| 19 | Surveyor Access & Evidence Export | 🔜 not started | – | – | – | – | – | – |
| DLB | **Deliberation & Voting Model** [0115](docs/decisions/0115-deliberation-and-voting-model.md) ([plan](docs/plans/deliberations.md)) | ADR PROPOSED — NOT ratified; nothing built and nothing may start | – | – | – | ⛔ **not ratified** | – | taken |

## Bug Log

### 🔴 OPEN — the live bugs

⛔ **OPEN bugs only — closed rows rotate to the archive (or the owning phase's record) at each §6
Record step, and you derive that boundary by the PROPERTY (is this CLOSED?), never by markup.** Open bugs here
carry bold markers, not headings, so a sweep bounded by heading syntax archives them; this heading
exists because without it an open production blocker (BUG-BOOTSTRAP-001, since **closed** 2026-08-31 on disposition (a) — the provenance stands, the bug does not) read as filed under
*Closed*. Its provenance, and the three closed rows that were still listed here after the
2026-08-18 rotation put them in the archive, rotated 2026-08-19 →
[archive § "Rotated 2026-08-19"](docs/progress/bug-log-archive.md).

⛔ **No live bug count appears in this section, deliberately.** Two attempts already went stale inside
a single day — first the heading, then a note saying "back to three" — in the one paragraph of this
file whose whole subject is that a count is wrong the moment after it is right. Count the rows below.

🔴 **BUG-AE49-D6-REKEY-INCOMPLETE — `commission.forms.edit` is re-keyed at 4 of the 7 policy sites
its PO-approved matrix names, and NOTHING REDS.** Filed 2026-09-02 (lead, from Gate AE4 QA
F-BLOCK-1) — **corroborated independently** by the rollback-runbook agent, which recorded the same
two policies as live twins of the **pre-cutover** text while solving an unrelated problem.
`form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write` (both `ALL`)
still read `app.is_staff_admin_of(app.commission_of_version(form_version_id)) OR
app.is_tenancy_admin_of(…)`, while the manifest declares 4 sites, `status: "re-keyed"`,
`callGraphBoundary: null`. ⛔ **NOT an exposure — nothing widened.** It is a **conformance** defect,
and it makes the D6 gate line *"the three representatives, each end-to-end"* **4/7 true for
representative 1**. ⚠ `form_block_library` carries **no** `_staff_admin_write` policy at all, though
the matrix says "7 ALL". ⛔ **Why no gate saw it:** `410`'s set differences run on the **permission**
axis; `enforcementSites` completeness is checked in **neither direction**, so the **site axis has no
closure check** at all. ⛔ **The fix is a MIGRATION** — it lands in the E2E-invalidating set and is
why a final `e2e:prod` is now certain → [review](docs/reviews/authz-ae4-gate-review.md).

🔴 **BUG-CASEEVT-KIND-001 — a case writer can DELETE, or silently RE-KIND, a procedural `case_events`
row: the UPDATE/DELETE policies carry no `kind` gate.** Filed 2026-08-23 (lead). Surfaced by ADR 0137
D12's `CaseEvent.kind` widening, **not caused by it. Measured from the live catalog:**
`case_events_writer_update` / `…_staff_admin_update` hold `app.is_manual_case_event_kind(kind)` in
**`WITH CHECK` only** — that constrains the **new** kind, never **which rows may be touched**; their
`USING` is `app.can_write_case_content(case_id, auth.uid())` alone. `case_events_writer_delete` /
`…_staff_admin_delete` have **no kind gate at all**. So `decision_issued → note` satisfies both clauses
and the row is silently re-kinded, and any procedural row can simply be deleted. ⛔ **No second lock — and this line's EVIDENCE was corrected 2026-08-25 (QA N-5): it said "zero
non-internal triggers on `case_events`", which was true when filed and is now FALSE.** P3/D15 added
`bump_case_print_revision` (AFTER ROW I/D/U) — tamper-**evidence**, not a lock, and it writes no
audit row. **No** routine references both `case_events` and `audit_log`, and writes go
**direct-table** over PostgREST — so the deletion is still **unaudited** (a Rule 11 gap). ⭐ P3 also
**raised the stakes**: it seals these rows into a hash-verified artifact with a public verification
URL, so a silent re-kind before a mint yields an *authentically signed* dossier that misrepresents a
procedural decision. ⚠ **The only control today is the UI suppression D12 added, which Rule 1
forbids counting as one.** ⛔ **Deliberately NOT fixed in this batch:** changing two RLS policies is a
live authz change owing its own keystone + diff-scoped door sweep. **Bounded:** requires
`can_write_case_content` on that case — in-case records integrity, **not** a tenant-isolation break.
⭐ The review lesson: three real filters were cited as refusing this write; all three gate the **new**
kind, so **none** of them bounds the claim they were cited for.
⭕ **SECOND AXIS, added 2026-08-24 (QA r2, re-measured from `pg_policies` by the lead): the writer
policies carry no VISIBILITY conjunct either — write is reachable where READ is not.**
`case_events_select` is `can_read_case(…) AND (visibility = 'case_readers' OR is_staff_admin_of(…))`,
but `case_events_writer_delete` / `…_writer_update` are `can_write_case_content(case_id, auth.uid())`
**alone**. So a plain writer who is not a `staff_admin` can **DELETE or EDIT a `coordinator_only` row
they cannot SELECT** — unauditedly, per the no-second-lock finding above. ⚠ The `…_staff_admin_*`
variants at least carry `NOT app.is_case_excluded(…)`; the writer pair carries nothing.
⛔ This is a **distinct property from the `kind` gate** — fixing `kind` alone leaves it standing, so
the eventual fix owes **two** keystones, not one.

### Closed → [bug-log-archive.md](docs/progress/bug-log-archive.md)

Closed rows, their closure narratives, and the 2026-08-19 record of where this section's old
standing warnings were re-homed (rule files, retirements, and the one not admitted for want of a
verifiable anchor) all live in the archive → § "Rotated 2026-08-25". **BUG-BOOTSTRAP-001** closed
2026-08-31 on PO disposition (a) → § "Rotated from PROGRESS.md 2026-08-31", which records that its
*"appears in no runbook"* impact statement had been false for **19 days** — the runbook step
([coolify.md](docs/deployment/coolify.md) § 2.5) named the bug while the bug knew nothing of it.
**BUG-SUSPENSION-DATE** + **BUG-MEUSDADOS-HOSPITAL-NAME-001** both closed 2026-08-31 in one
batched pre-AE4 increment → § "Rotated from PROGRESS.md 2026-08-31 — two bugs CLOSED". **BUG-AE47C-LINKAGE-001** closed 2026-09-02 (both casualties tester-verified 13/13, exit 0 on a fresh reset); its closure line rotated 2026-09-02 → § "Rotated from PROGRESS.md § Bug Log 2026-09-02".

## Test Run Summary

> **Retention: the most recent gate only, ONE ROW each.** Prior gate rows and their triage
> narratives (dispositions, mutation proofs; full history Phases 0 → ACT) rotate at each §6 Record
> → [test-run-archive.md](docs/progress/test-run-archive.md) (each rotation recorded there).

| Date | Run | Result |
| --- | --- | --- |
| 2026-09-02 | **AE4.9 D6+D5 re-key + manifest** (⛔ build gates, **NOT** Gate AE4) | pgTAP **259f/8685** · lint 12/12 · tsc 0 · vitest 151f/2056 · **4 ARMs HOLD** · sweep **READ CLEAN 7/7** · ⛔ **WRITE UNPROVEN exit 3 — NOT a pass** · ⭐ **`e2e:prod` GREEN, SINGLE run**, 1273/1273 — supersedes the composite → [detail](docs/progress/authz-ae4.md) |

## QA Verdicts

<!-- ONE LINE per phase/feature: verdict + date + link. The full analysis lives in
     docs/reviews/*.md — never restate rationale here or in the archive.
     Struck-through rows are superseded rounds, kept only to show a phase looped.
     Retention: current milestone only. Older concluded rows move VERBATIM to
     qa-verdicts-archive.md's "Collapsed one-line index" (the index is not rationale —
     it preserves the feature-name → review-file mapping). -->

| Phase / Feature | Verdict | Date | Report |
| --- | --- | --- | --- |
| **AE4** — Gate AE4 review (AE4.1–4.9 incl. D5+D6), branch `authz-ae4-catalog` @ `e897b452`; ⚠ run EARLY, before the final `e2e:prod` — ordering provisional, PO to ratify | ⛔ **CHANGES REQUESTED** — F-BLOCK-1 (`commission.forms.edit` at **4 of 7** approved sites; no site-axis closure check) · F-BLOCK-2 (IA-F9 · C2 · rollback §6 absent) · F-BLOCK-3 · F-MAJOR-1, +4 MED +8 LOW. IA-F1 **answered**; 9 figures reproduced exactly | 2026-09-02 | [review](docs/reviews/authz-ae4-gate-review.md) |
| **AE4** — external implementation audit of `authz-ae4-catalog` at `a0b27f3c` (AE0–AE3 as history, AE4.1–4.8 as built) | ⛔ **CHANGES REQUESTED** — F1 BLOCKER (the permission half has **zero production callers**) **reproduced on the catalog**; F2 + F10 BLOCKER; F3–F9. Disposition: **Option A**, ADR [0176](docs/decisions/0176-authz-permission-layer-made-real.md) | 2026-09-02 | [audit](docs/reviews/authz-evolution-implementation-audit-2026-09-02.md) |
| _Six prior rotations_ (the 2026-08-25 pair: PDF·P3 + user-profile · ADR 0136 · ADR 0137 · the AFF2 pair · the seven DM rows · the 2026-08-14 verbose collapse) — each rotation's own date is recorded at the destination | — | — | [archive](docs/progress/qa-verdicts-archive.md) |
| **147** concluded rows — ⛔ re-derived by counting 2026-08-27, never incremented (the hand-maintained **118** had drifted **27** low) | — | — | [collapsed index](docs/progress/qa-verdicts-archive.md) |

## Decisions

<!-- One line per decision; full rationale in docs/decisions/ (ADR) + docs/progress/decisions-log.md -->

| Date | Decision | Ref |
| --- | --- | --- |
| 2026-09-02 | ⛔ **THE RE-KEY BROKE THE AE4.5 DIFFERENTIAL REDUCTION; the reduction was RESTORED (a 4th representative), not the assertion relaxed.** ⛔ Raising 19.2b 1→2 was REJECTED — it greens the test and **deletes its subject**: the subject is the *argument*, not the number | ADR [0178](docs/decisions/0178-ae49-d6-rekey-as-built.md) §4 |
| 2026-09-02 | ⚠ **A PRESERVED LEGACY ARM LIVES INSIDE THE AUTHORIZER, not beside it at the policy** (0176 D2). ⛔ Cost accepted with a gated control — the arm is then invisible to a `pg_policies` audit, so 410 §4.6 pins the **5 residual arms BY NAME**. ⛔ The honest sentence is **NOT** "3 of 43 on layer 3" | ADR [0178](docs/decisions/0178-ae49-d6-rekey-as-built.md) §2 |
| 2026-09-02 | ⛔ **403 §7.2/§7.3's "arms 1/3 cannot grant" is true of 403's OWN FIXTURE, not of the seed** — on a fresh reset arm 3 **grants**. The owed qualifier becomes "exercised but not oracled, **and arm 3 is OPEN on the seed**". A real filter quoted at the wrong grain reads as a proof | ADR [0178](docs/decisions/0178-ae49-d6-rekey-as-built.md) §3 |
| 2026-09-02 | ✅ **OPTION A — MAKE PERMISSIONS REAL** (audit F1 reproduced): three layers, product paths call only `app.can_*` authorizers; `holds_role` = layer 1, callers → 0 by AE5-complete; enforcement manifest, **no default arm**. F6/F8/`platform_role`/F7 → AE5 bundle | ADR [0176](docs/decisions/0176-authz-permission-layer-made-real.md) (amends 0155 D7 + 0174) · plan § AE4.9 |
| 2026-09-02 | ✅ **GATE AE4 MINIMUM RE-KEY SCOPE = THE THREE REPRESENTATIVES** (`commission.forms.edit`, `org.professionals.create`, `org.professionals.read`), each end-to-end with the grant-deletion mutation flipping its **production door**; all other permissions `pending-rekey` | ADR [0176](docs/decisions/0176-authz-permission-layer-made-real.md) D6 |
| 2026-09-01 | ⚠ **PO BATCH D3: 403 CALLS THE REAL DOOR NOW; arm 3's org-scope divergence is ruled in AE5, NOT AE4** (lead recommended a named divergence, **overruled**). ⛔ **OWED TO THE GATE RECORD: arms 1/3 are EXERCISED but NOT ORACLED** — "the differential is green" needs that qualifier | ADR [0175](docs/decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) D3 |
| 2026-09-01 | ✅ **AE4.5 DENY-CLASS TABLE APPROVED — 9 rows** (PO), the oracle's **second** hand-encoded input. Row 5 ruled a **LAYER distinction**: `pending` denies at **auth**, not the resolver (`is_active` never reads `email_confirmed_at`) — axes file cross-referenced, **not** contradicted | [table](docs/design/authz-ae45-deny-class-effects.md) |
| 2026-09-01 | ⚠ **Two APPROVED LIMITATIONS ride with it into the gate record** — `suspended` is **not independently observable** (one predicate folds it with `inactive`); `cross_org` holds by the **UUID id-space**, not an org term. ⛔ Neither reads as "the resolver enforces tenant isolation" | [table](docs/design/authz-ae45-deny-class-effects.md) |
| 2026-09-01 | ⛔ **THE DOOR-SWEEP DERIVER IS BLIND TO THE HOUSE REWRITE PATTERN** — it matches migration TEXT for `create function`, which `pg_get_functiondef`+`replace`+`execute` migrations never contain. **33 such migrations**, several authz-door work. PO: **amend it NOW, inside AE4** | ADR 0079 amendment owed |
| 2026-09-01 | ⛔ **A SECOND, INDEPENDENT BLINDNESS: `PRED_DOMAIN` requires `typname='bool'`** — a door embedding its authz decision inline is outside **both** harnesses, whatever its migration. **20 fns, 19 DEFINER** — ⚠ **a domain to TRIAGE, not 20 exposures.** Discharge = the iterate-vs-branch test | plan rule 4 · pgTAP 402 |
| 2026-09-01 | **Historical scoping: the CHEAP LOOKUP first** (PO) — do the 33 migrations' doors already hold periodic-sweep verdicts? ⛔ A lookup against the committed findings, **not** an audit, and **absent** is its own category — a door absent from findings passes `ARM=wrapper` vacuously | ADR [0079](docs/decisions/0079-authz-door-blindness-standing-invariant.md) |
| 2026-09-01 | ✅ **AE4.3 MATRIX APPROVED — 42 rows** (PO; 33 + a **9-row delta**, 3 PHI, from four completeness passes). The **regression oracle** from cutover. ⛔ **A 43rd row needs its own approval** — this is what was approved, never a current count. ⚠ Row 30 approved as *today* only | [matrix](docs/design/authz-ae43-staff-admin-permission-matrix.md) |
| 2026-09-01 | **Recusal compatibility exception EXPIRES 2026-12-01** (PO) — ADR 0169's owed date, with teeth: merged fix by then, or it **blocks the next increment touching meeting content**. ⛔ An extension is its own recorded ruling with its own date, never a silent renewal | ADR [0169](docs/decisions/0169-meeting-content-recusal-divergence-is-a-time-boxed-exception.md) |

> ↩ **This table is the HEAD of the log, not the log.** Eight rotations (2026-08-04 · 08-17 · 08-18 · 08-20 ×2 · 08-24 · 08-25 ×2) moved **125 concluded/superseded rows** verbatim → **[decisions-log.md](docs/progress/decisions-log.md)**, each under its own dated § heading there. The 7 per-rotation notes that stood here — **including the two corrections they carried** — were themselves rotated 2026-08-26 → § "Rotated from PROGRESS.md § Decisions 2026-08-26".

## State — the three live remote facts (measure, never quote)

_Concluded measurements → [backend-state.md](docs/backend-state.md) § REMOTE CENSUS
2026-08-18 (every figure with its deriving query); standing rules — the re-measure
recipes, the editable window, "a git push is not a `db push`", the flags posture —
→ backend-state.md § "Remote discipline — standing rules". The block's full narrative
and its three-times-stale correction history →
[dm-fup-triage-2026-08-18.md](docs/progress/dm-fup-triage-2026-08-18.md). Only facts
still awaiting a concluding event stay here:_

| live fact | concludes when |
| --- | --- |
| ⚠ **Remote storage byte-loss is UNQUANTIFIED — the "~49 vanished" figure is WITHDRAWN 2026-08-18.** `n_tup_ins − n_tup_del` compares two units: 5 uploads move `ins` by **+6**, 5 deletes move `del` by **+5** (measured). And by the probe below, any surviving bytes are **unobservable** anyway | a magnitude re-derived from something other than the `pg_stat` counters — or PO ruling that it cannot be ([FUP-DM4-PRODROW](docs/progress/follow-ups-open.md)) |
| ⛔ **CORRECTED 2026-08-21 — the remote holds the E2E SEED FIXTURE, not nothing.** This row said *"it holds no data and no users"* (census 2026-08-18). **Measured 2026-08-21 against the linked project: `auth.users` = 36, all `@test.local`, created 2026-08-19 — i.e. AFTER that census; 0 non-test accounts; 1 pre-promoted `platform_admin`; `cases` 10, `responses` 17; synthetic PHI `patient_identifiers` 2 / `event_patient` 3 / `referral_patient` 3.** ⭐ **No real customer data** — so the *conclusion* (safe to touch) survives; the *premise* did not, and the premise is what other decisions were resting on. ⚠ This is the **fifth** time a claim about the remote has gone stale in this file. ⛔ **Re-measure `auth.users` and `schema_migrations` before citing this row — never quote it.** | **expires at pilot data-load**, when it must be REPLACED by the rehearsed C1b disposal bound (§ Critical FUP C1), never just deleted |


## ⭐⭐ Critical FUP — the must-not-be-forgotten list

_**PO-curated. Entries land here ONLY on the PO's explicit instruction.** No implementer, reviewer or
lead may promote an item into this section, and nothing arrives here as a side effect of a review
round. It is the short list of follow-ups whose loss would be materially costly, kept **separate from
the general register precisely so that register's length cannot bury them**._

⛔ **NEVER ROTATE THIS SECTION — at any file size.** Since ADR
[0179](docs/decisions/0179-follow-up-register-consolidation.md) it is the **only** protected section
left in this file: the general § Follow-ups index no longer lives here at all, so this is not a
carve-out from a size discipline any more — it is the one list that stays. ⚠ An entry leaves only
when the work has **landed**, which is not the same as the phase it was filed in closing — *a
deliverable assigned to a slice disappears when that slice closes cleanly* (ADR 0120's own O1/O2
correction, and the reason this section exists). ⚠ **These rows are ADDITIVE, not the item's record**:
each adds a trigger and a deadline to an item that keeps its full entry in
[follow-ups-open.md](docs/progress/follow-ups-open.md). A row here whose entry is missing there is an
orphan, and gate 7 now reds on it.

| # | item | what must happen | trigger — the point it can no longer wait | owner |
|---|---|---|---|---|
| **C1** | 🔒 **`FUP-DM5-DISPOSAL-JOB`** — the PHI-disposal path is **manual and UNREHEARSED**. `disposal_state` records an **intent, not a destruction guarantee**: **4 SET-form writers** put rows into `disposal_pending` — 3 `authenticated`-reachable (`request_document_disposition`, `dispose_case_phi`, `dispose_referral_phi`) **plus `complete_document_reclassification`, service-role-only** — against **exactly ONE** outflow door, and **nothing automated calls it** (no `pg_cron`, no cron schema, single-process Dockerfile). ⚠ *Corrected 2026-08-18: this said "three inflow doors", which is right only bounded to JWT-reachable doors — **the queue is fed wider than the item said**.* | ⭕ **SPLIT IN TWO 2026-08-18 (DM-FUP TRIAGE #3) — and C1 does NOT close on C1a.** **C1a (local)** — execute [`phi-disposal-runbook.md`](docs/deployment/phi-disposal-runbook.md) end-to-end against local test data, once, and record the run. ⭕ **PARTIAL 2026-08-19: the § 6b BACKUP half is DONE** — executed, verified, destroyed, recorded in [`phi-backup-run-log.md`](docs/deployment/phi-backup-run-log.md), which discharged `FUP-DM5-BACKUP-IS-PHI-EXPORT`'s destination path. ⛔ **The § 3 DISPOSAL half — which is what C1a is FOR — has still not run.** ⭐ **CORRECTED 2026-08-19:** it was recorded as blocked by `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE`; **it never was** — the runbook is the `file_objects`/Storage path and `dispose_meeting_minutes` is disjoint from it in the catalog (writes no `file_objects` row, never sets `disposal_pending`; the runbook says "meeting" zero times). That FUP is resolved anyway (ADR 0129), but § 3 is un-run for its own reasons, not newly released. The two halves are independently executable; do not read the backup run as C1a. **C1b (Cloud)** — the same run against the linked project; ⚠ it **cannot inherit** the backup half, which has no Cloud form at all (`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`). ⛔ **Why the split is not bookkeeping:** the runbook itself says a local rehearsal *"runs against a local stack by construction, so it cannot exercise the Cloud paths"* (§6) — so a local-only run discharges this row's **wording** while leaving its **purpose** undischarged, which is [[a-predicate-quoted-at-the-wrong-grain]] in the highest-severity item in the register. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** PO-accepted 2026-08-18 as a pilot risk **bounded by this rehearsal** (ADR 0121 **Amdt 3**) — the acceptance is not open-ended, and the pilot may not admit real PHI ahead of it. ⭐ **The bound is C1b, not C1a**: the pilot runs on Cloud, so a green local rehearsal does **not** release it. | PO (executor = whoever holds service-role reach — an ACL fact, not a choice) |
| **C2** | 🟠 **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`** — **427** reachable command doors sit outside `ARM=census`'s domain — ⛔ **re-derived by property 2026-08-31** (`prosecdef` ∧ not trigger ∧ not set-returning ∧ return ≠ `bool` ∧ `authenticated`/`anon` holds EXECUTE), **never incremented**; was 426 at the AE1 Record step and 407 on 2026-08-17. ⭐ **The figure is now DERIVED by `ARM=census`'s own banner each run**, so this row records a measurement rather than owning one — the banner printed the frozen 407 beside four green arms for two weeks. ⭐ **Decomposed, because the halves differ** (⛔ **re-derived 2026-08-31 with the headline; QA r2 B4 caught the OLD decomposition pasted beside the NEW total — 344+82 sums to 426, not 427**): **345** are `public` and therefore still inside `ARM=floor`'s domain (which carries no return-type filter); **82** are `app` and sit in **no** arm bounded on client-reachability (`ARM=census` is bounded to `bool`/set-returning; these return `jsonb`/`void`). ⛔ **NO LONGER 'covered-but-unpinned' — FALSIFIED 2026-08-31 (ADR 0171).** That reading rested on a 3-door sample from 2026-08-17 and stood two weeks; the purpose-built neutralizer found **3 BLIND** in its first 8 measurements (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`). *Three COVERED results were evidence about three doors, never about the population.* | **Tier 1 — sweep the subset that touches PHI or crosses a tenant boundary**, derived as a property over the catalog, never hand-listed ([[enumeration-boundary-is-a-syntax-not-a-property]]). **Tier 2 — the remainder is DEFERRED.** Each swept door gets a recorded verdict, so a regression reds and a **new** door cannot pass by absence. ⭕ **Tier 1 ABSORBED TWO ITEMS 2026-08-18** — `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` (successor named: `app.resolve_document_version_bytes`) and `FUP-DM5-SIBLING-GUARD-DIFF`. All three want the same door-mutation machinery over `prosecdef` gates; building it three times was declined. ⚠ **Absorption is not closure** — each keeps its own index line and its own verdict. | **Tier 1: SIZED 2026-08-31** — instrument `scripts/authz-c2-tier1-sizing.sql` (re-derives every figure; quotes none), record [authz-c2-tier1-sizing.md](docs/design/authz-c2-tier1-sizing.md). ⛔ **The split does not split — the ruled predicate returns 405/427 (94.8 %), leaving a Tier 2 of 22 internal helpers.** The **tenancy disjunct is the vacuous half** (395 alone / 92.5 %): a DEFINER door bypasses RLS and must re-establish tenancy itself, so every gated door reaches `profiles` (354), `memberships` (346), `commissions` (246) — it measures *is tenancy-gated*, not *crosses a boundary*. ⛔ **The PHI comment convention is NOT a usable marker** — prose polarity is not machine-decidable (a positive regex captures `patient_xref`'s *"is NOT a PHI store"*), and 50 base tables carry no comment; the PHI arm rides on the hard `has_table_privilege` door-only fact instead (6/6 canonical stores). ⛔ **Depth-0 grain is FALSIFIED** (drops `create_case` + `set_participant_patient`), as is the only population-cutting variant (hand-list, and falsified on `assume_role`). ▶ **PO ruling owed** — §8. ⚠ **No command-door neutralizer exists**: all three harnesses open a boolean gate or a policy `USING`; these doors return `jsonb`/`uuid`/`void`. **Tier 2: after the pilot ships, once there are real customers.** | lead + backend |
| **C3** | 🔴 **`FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM`** — § 6b's backup mechanism is `docker exec … tar`, **local-only by construction**. On Cloud: managed backups + PITR **exclude Storage objects by documented design**, *"Restore to a new project"* does not copy them, and `supabase storage cp -r` has **no streaming form** ⇒ **the pilot platform has NO Storage recovery point at all**, and § 6b's *"encrypted AT CREATION"* is **unsatisfiable** there. ⭐ **It INVERTS its parent**: `FUP-DM5-BACKUP-IS-PHI-EXPORT` graded an over-wide copy **existing**; this grades **no copy existing** — opposite failure, opposite remedy, which is why it is a separate item and not absorbed into that close. | **PO decision, two shapes:** (a) accept no Storage recovery point pre-pilot and say so **where the pilot decision is made**, not only here; or (b) **name a mechanism** — ⭐ only one shape can satisfy "encrypted at creation": the **S3 protocol endpoint** streamed into a client-side encryptor (`rclone crypt` and peers), which makes this **the same measurement as `FUP-DM5-CLOUD-ORPHAN-SURFACE`** (that endpoint is **UNPROBED**). ⛔ **Any destination inherits the SOURCE's blindness** — changing the bucket cannot change what the endpoint can enumerate, and a source-count ↔ destination-count check compares **metadata to metadata**. Then rehearse it **restore included**, and prove the restore recreates `storage.objects` rows and not merely bytes. Also owed for any new processor: **BAA posture + LGPD cross-border basis**. | ⛔ **BEFORE ANY REAL PATIENT RECORD IS LOADED.** From the moment the pilot holds data with no recovery point, every day is unrecoverable-loss exposure. ⚠ **Distinct from C1's trigger, and they are easy to conflate:** C1 is about **destroying** bytes on request; this is about **not being able to get them back**. | PO decision, then backend + lead |
| **C4** | 🟠 **`FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED`** — § 6b's five values are scoped **literally** to *"a Storage backup" / "the archive"*, yet the same section requires a `supabase db dump` restored into a **scratch database** to earn the words *"verified good"*. **Neither artifact has a location, reader-set, retention or destruction rule**, and nothing tells the operator to drop the scratch DB — which this same page calls *"a data leak wearing one"* (**90 of 274** RLS policies restored). ⭐ The parent item's own sting one level down, **inside the section that resolved it**. | **PO extends the five values explicitly to both artifacts, OR rules the restore test out of the procedure.** ⚠ The interim mitigation already written into the runbook — apply the values by analogy, **drop the scratch DB as soon as the comparison is recorded**, record both in the run log — is a stopgap and **is not the decision**. | **The first time anyone runs `supabase db dump --linked`** — ⚠ **reachable on Cloud TODAY** (it needs only the DB password, unlike C3), and it is the natural next step of a C1b rehearsal. ⛔ Do not let a C1b run be the first execution of an ungoverned procedure. | PO decision, then backend |

## Follow-ups / Deferred Items

> ⛔ **THE REGISTER MOVED — new follow-ups are filed in
> [docs/progress/follow-ups-open.md](docs/progress/follow-ups-open.md), NOT here.**
>
> That file is now the **single** open-follow-up register: severity, id, title, owner, origin and
> body live together in **one entry**, so there is nothing to keep in sync. The append template,
> the required fields (including the **origin** — the phase / increment / review that produced the
> item) and the state-change rules are in its header. **Read the header before filing.**
>
> ⛔ **Do not re-open an index here.** The one-line index that lived in this section from
> 2026-08-08 to 2026-09-02 was 125 lines and 51 KB — **53 % of this file** — and it grew
> monotonically because the contract forbids rotating an open line. Adding "just one line" here
> restarts exactly that. Ruled by the PO 2026-09-02; recorded in ADR
> [0179](docs/decisions/0179-follow-up-register-consolidation.md).

**Where a follow-up goes** — the three-way test is unchanged, only the destination is:

| The item is… | Goes to |
| --- | --- |
| Open, and someone could act on it next session | **[follow-ups-open.md](docs/progress/follow-ups-open.md)** — the register |
| Open, but nobody can act on it next session | [deferred-backlog.md](docs/progress/deferred-backlog.md) |
| Resolved | [follow-ups-archive.md](docs/progress/follow-ups-archive.md), moved verbatim |
| A standing prohibition with no resolution event | `.claude/rules/`, path-scoped (ADR 0127) |
| Must-not-be-forgotten, with a trigger and a deadline | § Critical FUP **above** — PO-curated, and it stays in this file |

To read the register at a glance (the entry headings **are** the index — nothing to regenerate):

```bash
grep -n '^### ' docs/progress/follow-ups-open.md
```
