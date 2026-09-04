# C2-TIER1 — progress record

Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure over `ARM=census`'s
population (ADR 0162 §3, amended on branch-order by ADR 0184). The unit's **summary** is its hub,
[docs/features/c2-tier1.md](../features/c2-tier1.md) § Current state; this file is its **log**
(ADR 0186 D3): one dated subsection per session, appended.

Plan: [docs/plans/authz-evolution.md](../plans/authz-evolution.md). Decisions: ADR
[0162](../decisions/0162-authz-evolution-plan-audit-corrections.md),
[0171](../decisions/0171-c2-tier1-regrain-and-the-command-door-neutralizer.md),
[0184](../decisions/0184-c2-sweep-runs-against-the-current-branch-schema.md).

## Session log

### 2026-09-03 — folded from the C2 handoff at ADR 0186 Wave 3

Folded from `docs/handoffs/c2-tier1-2026-09-03.md` (created 2026-08-31, deleted this wave per ADR
0186 D3) before deletion. The handoff's RESUME HERE and Trust sections are resume-layer content
with no residual value once the branch is landed and the file is gone; not carried forward.

**Goal and scope boundary.** C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`) is the class of reachable
`prosecdef`, non-trigger, scalar, non-`bool` command doors that sit outside every
`p0-authz-invariant.sh` arm's domain. This branch sized Tier 1, re-grained its predicate, and
built the instrument that can sweep it. Explicitly NOT: a sweep of Tier 2 (190 doors, deferred);
a closure of `FUP-DM5-Q1-OPEN-BYTES-CUT-BROKEN` or `FUP-DM5-SIBLING-GUARD-DIFF` (`assume_role`
stays ERROR-shaped); a new ARM (the neutralizer is a separate periodic harness); the AE3 cutover
(see Open questions/blockers below, historical).

**State — Done, VERIFIED:**

| What | Witness | When |
| --- | --- | --- |
| Parent population **427** (345 `public` + 82 `app`) | `scripts/authz-c2-tier1-sizing.sql` (agrees with `ARM=census`'s banner) | 2026-08-31 |
| **Tier 1 = 237 (55.5 %)**, Tier 2 = 190, 6/6 positive controls | same instrument, "TIER 1 — THE RE-GRAINED PREDICATE" + controls block | 2026-08-31 |
| Worklist of 237 doors | `supabase/tests/mutation/c2-tier1-doors.txt` (derived; regenerate + diff, never edit) | 2026-08-31 |
| **243** enforcers in the Tier-1 closures; **72** in the bool arm's domain, **171** outside | `c2-command-door-neutralizer.sh` worklist derivation (`$WORK/worklist.tsv`, 171 rows) | 2026-08-31 |
| 458 authz raises across the 171; **457** match the mutation anchor | worklist columns 5/6 (`nraise` vs `nanchored`) | 2026-08-31 |
| Full sweep: **171/171, COVERED 109 · BLIND 40 · ERROR 22** | `bash supabase/tests/mutation/c2-command-door-neutralizer.sh`; [findings](../reviews/c2-command-door-findings.md) | 2026-09-02 |
| Suite baseline `Files=259, Tests=8685, PASS`, **53 s/run** (not the design doc's ~23 s) | `npx supabase test db`, timed | 2026-09-02 |
| DB restored after the sweep — zero `ROLLBACK FAILED` | fresh reset → `Files=259, Tests=8685, PASS` | 2026-09-02 |
| `npm run lint` 12/12, exit 0 (gate 12 needed a `python`→`python3` fix) | `npm run lint; echo $?` | 2026-09-02 |
| pgTAP baseline `Files=248, Tests=8289, PASS` on a fresh reset | harness baseline capture | 2026-08-31 |
| `npm run lint` 11/11, exit 0 | `npm run lint > /tmp/lint.log 2>&1; echo $?` | 2026-08-31 |
| C1a discharged — §3 A–D end-to-end on `standard` and `phi` tier | `docs/deployment/phi-backup-run-log.md` § 2026-08-31 (second run) | 2026-08-31 |
| `seed.sql` creates zero `file_objects`; post-reset disposal queue EMPTY | `grep -c file_objects supabase/seed.sql` = 0; post-reset count = 0 | 2026-08-31 |
| Local Storage volume 372 files / 108 PHI-tier vs `storage.objects` 0 after reset | `node scripts/storage-manifest.mjs walk` | 2026-08-31 |
| PROGRESS.md de-duplicated 96,352 → 77,855 B; over-form index lines 78 → 23 | `npm run lint:progress` | 2026-08-31 |

⛔ The committed [findings file](../reviews/c2-command-door-findings.md) reads 106/40/25; the
corrected tally is 109/40/22, because 3 of its ERROR rows are tail-drift artifacts re-measured to
COVERED in isolation (`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`). The correction
lives here and in the register, never in the file — it is derived, never hand-edit it.

**The anchor is a syntax, not a property — why the sweep did not close C2.** The harness anchors
on `errcode = '(42501|HC0[A-Z0-9]{2})'`, wrong in three directions
(`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`): (1) too narrow — ~~`HCDS*` (60 raises, the
LGPD Art. 18 lane) and `28000` need a literal `0` in position 3 and are excluded; the gate-fn
filter at `:153` uses the same anchor, so those doors are structurally absent from the worklist~~
⛔ **FALSIFIED 2026-09-04 (0187 C3): 8 functions, all also raising an anchored `42501`, so NONE is
excluded by the `:153` filter; "60 raises" is retired and must not be re-quoted**,
neither a verdict nor an ERROR. (2) too broad — `HC0*` is the whole application error space;
`HC038`/`HC043` are state guards, `HC039` is the authorization one, so a verdict here means
`HC0*`-coded-guard coverage, NOT authorization coverage. (3) cannot span a `;` in the message — 35
raises fail closed as ERROR, never a false COVERED. The fix was validated: 2294/2294 matched, 0
regressions (`docs/reviews/c2-anchor-regex-fix-validation.txt`); patch staged at
`scratchpad/apply-anchor-fix.sh` — patch the `regexp_replace` only, the counters must keep the
errcode-only anchor.

**Written but UNVERIFIED (as of the handoff):**

- The full-sweep cost was measured after being extrapolated: a full pgTAP suite run is 53 s
  (`Files=259, Tests=8685`), not the design doc's ~23 s, so the sweep is 171 × 2 × 53 s ≈ 5 h.
- `docs/reviews/c2-command-door-findings.md` exists, 171 rows, but reads 106/40/25 against the
  corrected 109/40/22 (see above) — never hand-edit it.

**Not started (as of the handoff, still true 2026-09-03 — see hub):**

> ⛔ **AMENDED 2026-09-04 (ADR 0187) — three of the four bullets below are falsified; this file
> records the same corrections at § C1/C3 further down, so it contradicted itself for a day.**
> **C1** — *"designs complete"* is **FALSE**: the design doc covers **3** doors, so **36 of 39 have
> no design**. **D3** — keystones are **39**, not 40 (`app.print_source_series` ruled out of the
> BLIND set). **C3** — the `HCDS*`/`28000` delta is **re-scoped, not a new population**: 8
> functions, all raising an anchored `42501`, 4 already carrying verdicts and 4 absent for a
> **Tier-1 membership** reason that widening the anchor cannot deliver.

- Keystones — ⛔ designs **NOT** complete, 3 of 39 (`docs/design/authz-c2-blind-keystone-designs.md`), incl. the
  warning that `cancel_session`'s anchored raise is HC038 (a STATE guard); its authz is HC039 in a
  different worklist row, so the "obvious" HC039 keystone would not flip the verdict.
- ~~The delta sweep for `HCDS*`/`28000` after widening the anchor — a NEW population, needs
  re-derivation, not a refresh.~~ ⛔ **Re-scoped 2026-09-04 (0187 C3): not a new population.**
- The 16 suite-abort doors (`FUP-C2-SUITE-ABORT-ERROR-CLASS`), incl. `submit_response`.
- Classifying `HC0*` by property so verdicts can be labelled honestly.
- The 23 PARTIAL follow-up index lines (move-then-cut; order matters).

**Tree (as of the handoff):** branch `authz-c2-tier1`, ~115 commits ahead of `origin/main`. The
name was a MISNOMER — its body was AE4 work; C2's apparatus was already merged to `main` before it
started. (Historical — the branch no longer exists; see the hub's Blockers for current state.)

**Gates:**

| Arm / suite | SHA | Result | Exit |
| --- | --- | --- | --- |
| `npm run lint` (12 gates) | 2026-09-02 | OK | 0 |
| pgTAP full suite | 2026-09-02 | `Files=259, Tests=8685` PASS | 0 |
| `c2-command-door-neutralizer.sh` FULL, 171/171 | 2026-09-02 | COVERED 109 · BLIND 40 · ERROR 22 | 1 (BLIND) |

⛔ Did NOT run, as of the handoff: `ARM=census`, `ARM=hat`, `ARM=floor`, `ARM=policy`,
`ARM=wrapper`, the diff-scoped door sweep (both arms), `npm run test` (vitest), `npm run e2e:prod`.
Absence of a verdict is not absence of coverage — and it is not coverage.

**Dead ends, recording the mechanism each failed by:**

- Sweeping per DOOR. The 237 doors share 243 enforcers; `app.assert_rca_writable` alone backs 22.
  The unit is the enforcer; the door list is an attribution map.
- Stubbing a door's body to neutralize it. `public.grant_role`'s body is
  `perform app.grant_role_impl(...)`; stubbing removes the work with the guard and reads as
  COVERED for the wrong reason. The mutation must rewrite the authz `raise` to `null;` and leave
  the effect.
- Depth-0 grain (door body only) — cheaper (194 vs 387) and falsified by its own controls: drops
  `create_case` and `set_participant_patient`, which delegate PHI writes to
  `app._set_participant_patient_unchecked`.
- Rescuing the TENANCY disjunct — 92.5 % → 81.0 % (gate-aware) → 74.5 % (minus tenancy roots and
  the hash-chained audit sink). A domain tautology: a DEFINER door bypasses RLS and must
  re-establish tenancy itself. Dropped, not re-grained (ADR 0171).
- PHI comment convention as a marker — prose polarity is not machine-decidable: a positive regex
  captures `patient_xref` ("is NOT a PHI store") and `printed_documents` ("ZERO PHI in columns");
  a column-comment rule captures 0 of 6 canonical PHI stores; 50 base tables carry no comment.
  Usable only in UNION with the hard `has_table_privilege` door-only fact, where it can only widen.
- "15 `public` doors have no gate" — a measurement artifact, nearly reported as a P0.
  `get_case_patient`, `set_case_patient`, `grant_role` are thin delegating wrappers; the gate is
  one call deeper. Ask the question over the delegation closure, never the door's own body.
- `supabase storage cp` on the local stack — `LegacyStorageUnsupportedOperationError`. No CLI
  route exists to put an object into local Storage; a `@supabase/supabase-js` service-role client
  is required, and the helper must live inside the repo (Node resolves `node_modules` from the
  script's path, not cwd). A typeless `new Blob([…])` is refused by the buckets'
  `allowed_mime_types`.
- Impersonating a coordinator with only `sub` + `role` claims. `auth.uid()` resolves and
  `app.can_write_document(doc, uid)` called directly as `postgres` returns true, yet the door
  refuses: `app.is_staff_admin_of_for` is hat-dependent (ADR 0106) and false under `authenticated`
  with no `active_role`. Add `"active_role":"staff_admin"` — the shape `test_helpers.claims_for`
  builds.
- Running one pgTAP file as the harness suite. `npx supabase test db <file>` gives `Files=1,
  Tests=0` and a FAIL for most files — full suite is the only viable mode.
- Four harness bugs, none of which failed loudly (detail in
  `docs/design/authz-c2-command-door-neutralizer.md` §6): a shape detector grepping raw TAP
  against a `prove`-style runner passed vacuously for every case; `swept 0 of 171` exited 0; a
  read loop taking 6 TSV columns into 5; a VERDICTS comment promising a restored re-run the code
  never did.
- Piping a running sweep through `head` can SIGPIPE it mid-mutation and leave a live gate open.
  Redirect to a file (`.claude/rules/mutation-harnesses-are-not-killable.md`).

**Decisions made in flight:**

- RULED (PO), ADR 0171 — Tier 1 re-grained to a gate-aware closure over a PHI-marked relation;
  tenancy disjunct dropped as a domain tautology.
- RULED (PO) — C1a is rehearsed through the `subject_request` exemption lane; the provisional
  retention policy is NOT ratified. ADR 0114 O1 keeps a retention row provisional until three
  further questions are ruled; `HC0DR` therefore still blocks every file whose reason is neither
  `subject_request` nor `duplicate`.
- PROVISIONAL — the BLIND-candidate heuristic (intersect the worklist with
  `authz-neverclled-door-allowlist.txt`) is a candidate generator, not a predictor: a deny-only
  `throws_ok` never registers as a call. 3 of 3 held; nobody has ruled it a method.
- RULED (PO), 2026-09-02 — the C2 branch-order hold is LIFTED; the sweep runs against the
  branch's own schema (519 migrations, AE4's 18 included), not `main`'s 501. This CONTRADICTS ADR
  0162 §3 ("runs as its own increment, never folded into AE1's or AE4's branch"); the PO accepted
  the tradeoff knowingly — an ADR amending 0162 §3 was owed at the Record step and landed as ADR
  0184.

**Open questions / blockers (as of the handoff; current status in the hub):**

- 3 BLIND need keystones, not allowlist entries — allowlisting would make `ARM=floor` and this
  harness AGREE while both measure nothing. `cancel_session` is the sharp one.
- `public.save_block_to_library` — 5 authz raises, 4 anchored; the harness records it
  ERROR · UNMUTABLE rather than partially mutate. Someone must decide whether the 5th raise is
  authz-relevant. Still open 2026-09-03.
- 19 doors have no enforcer anywhere in their closure — 16 `app` (structural resolvers, believed
  not PostgREST-reachable) and 3 `public` (`session_context`, `get_feature_flags`,
  `list_my_referral_assignments`, believed self-scoped). BELIEVED, not measured.
- The retention gate is the steady state, not a fixture quirk, until ADR 0114 O1's three
  questions are ruled.
- ✅ CLEARED 2026-09-01 — the AE3 schema-first cutover is DISCHARGED (push → catalog-verified on
  the remote → Coolify green → §3 smoke PASSED; see `docs/progress/2026-Q3.md`). Two operator
  obligations left no artifact in the tree: rotate the remote DB password, and destroy
  `~/ae3-preimage.csv.gpg` together with its passphrase. Kept here as the record of what the
  blocker WAS (it carried 5 unpushed migrations, incl. dropping `profiles.cpf`/`date_of_birth`/
  `phone`, and 9 `src/` files with 32 references to `public.profile_private_details`, governed by
  `docs/deployment/ae3-cutover-runbook.md`; rule: `.claude/rules/push-schema-before-code.md`).

**UNKNOWN, named so it does not read as covered:**

- The verdict of the other 163 enforcers — 3 BLIND in the first 8 was not a rate.
- Whether the 3 (now 40) BLIND are reachable/exploitable through the app; only the DB side was
  measured.
- ✅ RESOLVED 2026-09-02 by code reading — the mutation's regex cannot mis-slice a body whose
  message string contains `;`. The anchor is `[^;]*?`, a negated semicolon class, so a `;` yields
  a clean non-match, never a bad slice; three independent guards (the `v_before`/`v_after`
  counters, the downstream `execute v_new`, the `h0 = h1` hash check) make ERROR the only
  reachable outcome. The handoff's premise was wrong in the safe direction.
- NEW, more serious than the item it replaced — the anchor's own blind spot: ~~`HCDS*` (60 raises)
  and `28000` (6) are outside `errcode = '(42501|HC0[A-Z0-9]{2})'`, and because the gate-fn filter
  at `:153` uses the same anchor, doors whose authz raises are only those are structurally absent
  from the 171, not merely unmutatable.~~ ⛔ **FALSIFIED 2026-09-04 (0187 C3)** — the population is
  **8 functions**, every one also raising an anchored `42501`, so none is excluded by the `:153`
  filter and none is structurally absent; 4 already carry verdicts, 4 are absent for a **Tier-1
  membership** reason. The "60 + 6" counts are retired. The LGPD Art. 18 DSR lane is the affected surface
  (`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`).

**Next task (as of the handoff; current version in the hub § Next):** write the keystones first —
cheapest, converts known BLIND findings into pinned tests; each needs an allow leg (a successful
call), not just a deny-only `throws_ok`, and the matching `authz-neverclled-door-allowlist.txt`
line is deleted in the same commit. Target the clusters, not the list — blindness is not uniform
(~~correction workflow 4 of 5 BLIND, interview 6 of 9, referral 3 of 16~~ ⛔ **CORRECTED 2026-09-04
(0187 C5), and the old numbers must not be re-quoted: correction workflow 6/8 (75 %) · interview +
session 11/21 (52 %) · referral 4/32 (13 %), against a base rate of 40/171 = 23 %**). Then, in cost order: apply
the staged anchor fix + delta sweep, diagnose the 16 abort doors, classify `HC0*` by property.
Before the next FULL sweep, fix tail drift
(`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`): ~342 consecutive suite runs against
one DB degraded it at enforcer 169 and the last three were lost — reset periodically inside the
sweep and re-capture `BASE_S`.

**Re-derivation appendix:**

- Tier 1, the population, the controls, the worklist — `docs/design/authz-c2-tier1-sizing.md`
  names the invocation; the script prints every figure.
- The enforcer worklist — run the harness; it derives `$WORK/worklist.tsv` per run.
- Harness self-test (proves it can mutate and undo) — `SELFTEST=1 bash …`.
- Local DB / branch state — `git rev-list --count origin/main..HEAD`, `git status`,
  `select count(*) from supabase_migrations.schema_migrations`.
- Any schema / RLS / RPC / authorization question — the live catalog only (`pg_proc` incl.
  `prosecdef`, `pg_policies`, ACLs). Never a migration file, never graphify.

**Carried from the hub block (history purged 2026-09-03, ADR 0186 Wave 3):**

- Git-archaeology paragraph removed from Blockers: `git log authz-c2-tier1 -1` measured
  `77d94b60` (2026-09-02, a handoff-carry commit only) — the local `authz-c2-tier1` ref never
  advanced. The 13 real sweep commits were on `origin/authz-c2-tier1` (tip `8ad1f2a4`), which is
  what merged into `authz-ae4-catalog`. The stale local `authz-c2-tier1` ref was deleted
  2026-09-03 (fully contained in `main`); `origin/authz-c2-tier1` remains on the remote until a
  push is authorized. `authz-ae4-catalog` was fast-forwarded into `main` (`898cb0ab`) and deleted
  the same day.
- Merge-conflict narrative trimmed from "Done since start": the 13 commits merged into
  `authz-ae4-catalog` 2026-09-03 (`3b21826b`) hit three textual conflicts plus one collision git
  reported as CLEAN — both branches had minted ADR `0180`; C2's sweep ADR was renumbered to 0184,
  its 8 hand-written references rewritten, back-pointers + INDEX regenerated (182 ADRs, next free
  0185). Verified mechanically: 0 missing of 344 ours / 300 theirs in the register alone.
- Run-number detail trimmed from "Done since start": full sweep baseline `Files=259, Tests=8685,
  PASS`, ~53 s/run (design doc assumed ~23 s); anchor-regex fix validated 2294/2294 matched, 0
  regressions; PO ruling covered 519 migrations (AE4's 18 included) vs `main`'s 501.

### 2026-09-04 — three PO rulings and six corrections; C2's closure condition fixed (ADR 0187)

Phase 0 of closing C2: record only — no code, no migrations, no test files. Everything below was
**re-measured before being written** (the PO's instruction was explicit: do not inherit the numbers).
Decision: ADR [0187](../decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md),
which **amends ADR 0184** (points 4 and 5 and the Consequences remedy clause).

**Number check.** 0187 = highest on any live branch + 1, verified by enumerating `docs/decisions/`
across every `refs/heads`/`refs/remotes` ref (`main` → 0186, `origin/authz-c2-tier1` → 0180) plus
`git worktree list` (one worktree). No `0187-*.md` exists on any ref. Not taken from INDEX.md's
next-free line, which this project has trusted into a collision twice (0180, 0183).

#### The three rulings (PO, given directly 2026-09-04)

1. **Tier 2 is a DISCLOSURE obligation, not a closure blocker.** ADR 0184 point 4's "a gate record
   **must state** the three uncovered populations" governs. The hub's "must be **resolved**" was a
   drafting error and is corrected. C2 closes on: the anchor fix, the ERROR class re-swept, and the
   keystones. Tier 2's **190 doors stay deferred by ADR 0171 and are NOT cleared**, and every gate
   record must say so.
2. **The 15 BLIND doors with no authorization raise in their own body close via state-guard
   keystones carrying an EXPLICIT PROPERTY LABEL.** Their resulting COVERED is recorded as
   state/lifecycle/validation coverage and ⛔ **never** as authorization coverage — that promotion
   is exactly what ADR 0184 point 5 forbids. **The label is the condition of the closure, not a
   nicety.**
3. **`app.print_source_series` is ruled OUT of the BLIND set** — a **defensive bound on a walk, not
   an authorization guard**. Its only anchored raise (`HC0H4`) fires at supersession-chain depth
   > 1000, a shape its own body comment records as unconstructible under
   `guard_supersession_coherent` + the one-successor unique index. ⛔ Recorded **so nobody later
   attempts a 1001-row fixture.** Keystone count 40 → **39**.

#### The six corrections, and how each was measured

| # | Correction | Method | Result |
| --- | --- | --- | --- |
| C1 | The keystone design covers **3** doors, not 40 | read `docs/design/authz-c2-blind-keystone-designs.md` — title "…the **three** BLIND command-door guards", three door sections (§1 `nsp_org_capa_rollup`, §2 `cancel_event`, §3 `cancel_session`) | **CONFIRMED** — hub's "designs complete" is false; **36 of 39** have no design |
| C2 | The ERROR population is **22**, not "~10" | verdict counts off the findings table (`106/40/25`) + `FUP-C2-SUITE-ABORT-ERROR-CLASS`'s own split | **CONFIRMED, reconciles exactly** — 16 suite-abort + 5 semicolon-spanning + 1 `save_block_to_library` = 22; 106 + 3 tail-drift = **109**; 109+40+22 = **171** |
| C3 | The `HCDS*`/`28000` population is **8 functions**, not "60 raises + 6" | `pg_proc.prosrc` regex over `public`+`app`, counting actual `raise … errcode` per family; then `grep` each against `supabase/tests/mutation/c2-tier1-doors.txt` | **CONFIRMED** — 9 mention the codes, 1 (`list_dsr_disposable_meetings`) raises none → **8**; **all 8 also raise an anchored `42501`**, so none is excluded by the `:153` gate-fn filter |
| C4 | The "`main` is not pushed" blocker is **false** | `git rev-parse main origin/main`; `ls supabase/migrations \| tail` | **CONFIRMED** at `27ec066a`, head `20261003007340`. ⚠ `main` advances past `origin/main` continuously as work lands — ordinary tracking state, not a C2 blocker |
| C5 | The cluster figures are wrong | verdict tally per name-cluster off the findings table | **CONFIRMED** — correction workflow **6/8**, interview+session **11/21**, referral 4/32, base rate 40/171 = **23 %**. Hub said 4/5 and 6/9 |
| C6 | The keystone design's §1.2 premise is wrong | `grep -n` for both names in `supabase/tests/189_nsp_per_hospital_isolation.sql` | **CONFIRMED** — the `42501` deny arm (L224/227) is on `nsp_org_event_rollup` **only**; `nsp_org_roster` is called once on the allow leg (L215), which is why it came back BLIND |

**C3's mechanism, stated because it changes the remedy.** The `:153` gate-fn filter is
`f.body ~* 'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})'''` or a gate-name match. All 8 pass it. The
join that actually excludes four of them is the *other* one — reachability from a Tier-1 door
(`clo_full` ⋈ `tier1`). Measured: `create_dsr_request`, `complete_dsr_task`, `assume_role`,
`adjudicate_dsr_request` are in `c2-tier1-doors.txt` **and in the 171** (COVERED, COVERED, ERROR,
ERROR); `appoint_hospital_dpo`, `attest_dsr_task`, `close_dsr_request`, `revoke_hospital_dpo` are in
neither. ⇒ **a Tier-1 membership reason, not an anchor reason**, and widening the anchor cannot
reach them. That is why ADR 0187 is an **amendment** to 0184 rather than an erratum: 0184's own
Consequences prescribe "the anchor widened" as the remedy for this bullet, and that prescription is
now insufficient.

#### Measurements taken in support (not among the six)

- ⭐ **Dominant finding: 36 of the 40 BLIND doors are already invoked by the pgTAP suite**, across
  **24 distinct test files**. Only four have zero references (`app.assert_ethics_typed`,
  `public.add_capa_action_evidence`, `public.cancel_event`, `public.nsp_org_capa_rollup`). They are
  BLIND because the tests enter the function only on a path where the guard is not deciding. ⇒ the
  work is **adding deny legs to files that exist**, not writing 39 new tests. ⚠ The estimate
  offered was "34 of 40, 16 files"; the measured figures are **36 and 24**, and the 24 is a *host*
  count — the sweep did not record which doors already carry a deny arm on the *mutated* raise, so
  the number of files needing an edit is ≤ 24 and was not derived.
  Method: `grep -rlE "\b<name>\s*\(" supabase/tests/*.sql` per BLIND enforcer; the one comment-only
  hit (`382_zero_policy_tables_are_door_only.sql:45`) was excluded by reading it.
- **`public.assign_narrative` is the clean illustration** — three `throws_ok` arms on `HC0F1` in
  `237_authz_exclusion_perimeter_u2.sql`, still BLIND, because the mutated raise is its `42501`.
  An existing deny arm does not imply coverage of the raise the harness removes.
- **The 39 keystones split by property** (ADR 0187 D-M2), from `pg_proc.prosrc`: **12** raise
  `42501` in their own body; **13** raise only `HC0*` but with a permission-worded message
  (`sem permissão…`, `apenas o corretor designado…`, `apenas quem detém a custódia…`); **14** are
  state / lifecycle / validation only. 12 + 13 + 14 = 39, and 15 − 1 (`print_source_series`, D3) =
  14 reproduces the PO's "15" exactly.
- **`app.print_source_series` verified in the findings** at row 157 — BLIND, 1 Tier-1 door
  depending, **1** anchored raise, i.e. `HC0H4` is its only one. Body read from `pg_proc`, never
  from a migration file.

#### Not measured, named so it does not read as covered

- Whether the four absent `HCDS*` doors (`appoint_hospital_dpo`, `attest_dsr_task`,
  `close_dsr_request`, `revoke_hospital_dpo`) *should* be Tier 1. They touch `mrn` and `file_ref`,
  which is why the question is live, but the Tier-1 predicate was not re-run against them. **This
  is a ruling owed, not a measurement owed.**
- The remote migration head `20261003007340` was corroborated only against the **local**
  `supabase/migrations/` listing; no remote query was made (the DB is read-only for this session and
  the remote was not contacted).
- The `HC0*`-by-property classification is done **only for the 40 BLIND rows**. The 109 COVERED rows
  are still labelled `HC0*`-coded-guard coverage, not authorization coverage (ADR 0184 point 5
  stands for them).

#### Correction to this record's own history

⛔ The "Next task (as of the handoff)" paragraph above quotes **"correction workflow 4 of 5 BLIND,
interview 6 of 9, referral 3 of 16"**. Those figures are **wrong** and are superseded by C5's
measured 6/8, 11/21 and 4/32. The paragraph is left standing as the historical record of what the
handoff said; the numbers in it must not be re-quoted.

#### Artifacts touched

- **Written:** `docs/decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md`
  (`**Amends:** 0184`), `docs/decisions/INDEX.md` (regenerated).
- **Corrected:** `docs/features/c2-tier1.md` — acceptance criteria (state/resolve, the 8-function
  and 22-ERROR figures, D2's label), `## Current state` (designs 3-of-39, cluster figures,
  `main`-not-pushed struck, 40 → 39). Block is 33 lines, under the 60 cap.
- ⛔ **Untouched by design:** `docs/reviews/c2-command-door-findings.md`. It still reads 106/40/25
  and is **derived per run** (ADR 0153) — the correction lives here, in ADR 0187 and in the register.
- ⛔ **Untouched by ownership:** `supabase/tests/`, `supabase/migrations/`, `package.json`,
  `src/lib/role/` — a backend agent held them concurrently. Catalog access was read-only; no reset,
  no write.

### 2026-09-04 (second session) — closure item 1 landed; the keystone set specified; the ERROR class re-shaped

Phase 1 of actually closing C2, after the morning's record-only session. Everything below was
measured this session unless it cites a commit. Commits: `ca328539` (the anchor fix),
`40c3c588` (the keystone specs).

**Environment baseline, re-measured — both figures on record were stale.** Fresh
`supabase db reset --local`, then `npx supabase test db`: **Files=262, Tests=8764, PASS, ~100–106 s
per run** (11 harness runs in 19m05s). The record carried 53 s/run and the harness header carried
~23 s. A full 171-enforcer sweep therefore costs **~9.5 h**, not the ~2.2 h the header advertised or
the ~5 h the record implies. The header's cost claim was corrected in the same commit.

#### Closure item 1 — the anchor fix. LANDED, and it is not the fix that was on record.

⛔ **The fix recorded as "FIX VALIDATED OFFLINE 2026-09-02 — 35 fixed, 0 regressions, 0 residue" was
incomplete, and its "0 residue" is an artifact of its own denominator.** Measured in Postgres ARE —
where the harness actually runs — against `pg_proc.prosrc` over the 706 `prosecdef` non-trigger
functions in `public`+`app`:

| anchor | `migrations/*.sql` | live `pg_proc` |
| --- | --- | --- |
| the one in the harness | 2259 / 2302 | 793 / 813 — 15 functions short |
| the recorded fix | 2294 / 2302 | 807 / 813 — 5 functions short |
| what landed | **2302 / 2302** | **813 / 813** — 0 short, 0 overmatch, 0 regression |

The recorded validation reproduces **exactly** against `supabase/migrations/*.sql` (2259 → 2294) and
not at all against the catalog. It was run on **migration file text**, the corpus this project's own
rules call stale by design, and its "residue still unmatched by candidate: 0" was computed against a
denominator of **2294** — which already excluded the eight raises it misses. A census whose parts do
not sum, one layer up from the thing being measured.

The residue's shape is uniform: `using errcode = 'X', detail = <expr>;` — a **trailing USING-option
list** after the errcode, which a terminating `…'\s*;` cannot cross. It occurs in
`app.end_affiliation_impl`, `app.end_org_affiliation_impl`, `app.void_affiliation_impl`,
`app.void_org_affiliation_impl` and `public.save_block_to_library`. The landed anchor keeps the
recorded fix's message-literal consumption (`'(?:[^']|'')*'`, which crosses a `;` *inside* the
message) and replaces the terminator with `[^;]*;`.

**Three sites moved, one deliberately did not** — the ruling on each matters more than the regex:

- **The worklist's column 6 (`nanchored`) had to move in lockstep, and this was load-bearing.** It
  was never the anchor; it was a *proxy* — "an errcode followed by a `;`" — which is neither the
  anchor nor a bound on it. It was wrong in **both** directions: it let 5 enforcers past the
  UNMUTABLE guard whose mutation then could not land, while refusing 1 it could have mutated.
  ⛔ `docs/progress/c2-tier1.md`'s own instruction *"patch the `regexp_replace` only, the counters
  must keep the errcode-only anchor"* errs in the dangerous direction: it would have cleared the 5
  `MUTATION DID NOT LAND` rows while leaving `save_block_to_library` UNMUTABLE forever.
- **`v_before` / `v_after` keep the errcode keying but DROP the terminator.** Tracking the anchor
  there would be **vacuous** — a global `regexp_replace` cannot leave one of its own matches behind
  (`null;` carries neither a raise nor an errcode), so an anchor-keyed `v_after` can only ever read
  0. A dead instrument wearing the name of a guard; measured residue 0 for all 1081 functions.
  Keeping the *terminated* form is worse than redundant: its blind spot is **congruent with the
  anchor's old one** — it reads 0 residue for exactly the `, detail = …` shape — so the day the
  anchor gains a new gap of that shape, the guard passes and `execute v_new` installs a
  **half-mutated function with one authz guard still live**, which is the false COVERED the
  UNMUTABLE guard exists to prevent. Spurious-fire ruled out: anchor-class errcodes inside `--` and
  `/* */` comments = 0; `occ(pg_get_functiondef)` == `occ(comment-stripped prosrc)` for all 1081.
- **The gate-fn filter (`:153`) was left alone, deliberately.** It is the **population**, not the
  anchor — changing it changes who is in the 171 and invalidates every verdict recorded against that
  denominator. Measured non-binding: **0** functions in the whole catalog are admitted by it yet
  unmutable by the new anchor. Independently re-confirms ADR 0187 C3.

**Blast radius was measured as replace-OUTPUT inequality, not as a count comparison** — a count can
match while the replacement differs. **21 functions differ over all 1081**, of which **exactly 6 are
in the freshly derived 171**; the other 165 produce byte-identical mutation text under both anchors.
⚠ The lead's stated blast radius of 15 was population-bounded (`prosecdef` non-trigger only) and
under-reported by 6; the extra 6 are trigger-returning or `prosecdef=false`, none in the worklist, so
the conclusion survived but the boundary did not.

**Proofs:** `SELFTEST=1` PASSED (hash moves, restore exact, 0 degenerate bodies). Re-derived worklist
= **171 rows, `sum(nraise) = sum(nanchored) = 460`, 0 UNMUTABLE**. Simulating both harness paths over
all 171: OLD → 1 UNMUTABLE + 5 DID-NOT-LAND with survivor counts 2,1,2,1,1 matching the committed
baseline byte-for-byte; NEW → 0 refused, 0 survivors.

**Subset sweep of the 6 affected enforcers** (`$WORK`, ADR 0153; committed baseline cksum verified
unchanged at `1361193000 35013`):

| enforcer | before | after |
| --- | --- | --- |
| `set_referral_patient` | ERROR · DID NOT LAND (2 survived) | **COVERED** |
| `save_block_to_library` | ERROR · UNMUTABLE (5 raises, 4 anchored) | **COVERED** |
| `log_document_previa` | ERROR · DID NOT LAND (1 survived) | **COVERED** |
| `delete_ad_hoc_case_narrative` | ERROR · DID NOT LAND (1 survived) | **COVERED** |
| `set_professional_link_state` | ERROR · DID NOT LAND (1 survived) | **ERROR · suite abort** 8764→8762 |
| `mint_printed_document` | ERROR · DID NOT LAND (2 survived) | **ERROR · suite abort** 8764→8752 |

⭐ **The honest framing, and it is the finding of this session: landing a mutation is not the same as
producing a verdict.** All six mutations now land — no row returns `MUTATION DID NOT LAND` or
`UNMUTABLE` any more — but two then **abort** the suite instead of failing it, and the harness
correctly refuses a verdict. **The anchor fix converts part of the semicolon-spanning ERROR class
into the suite-abort ERROR class rather than into verdicts.** ERROR drops by 4, not 6, and
`FUP-C2-SUITE-ABORT-ERROR-CLASS`'s population **grows 16 → 18** — both new rows PHI-lane doors
(`professional_profiles` link state, printed-document mint). Closure item 1 is discharged; closure
item 2 is **not** discharged by it and now has more work than before.

**Corrected tally: COVERED 113 · BLIND 40 · ERROR 18 = 171.**

⚠ **A bug introduced and caught inside this work, worth more than the fix.** SQL comments placed
inside `mutate()`'s **unquoted** heredoc (`<<MUTSQL`, unquoted because it must expand the oid) are
expanded by bash: backticks there **run as a command** and their text is silently deleted from the
generated SQL. Proven at runtime — `raise: command not found`, a glob into `/LICENSE.txt` which bash
then tried to execute, and a `mut.sql` with the comment gutted — **while `bash -n` stayed green**,
because an even number of backticks parses fine. Prose moved outside the heredoc; backticks and bare
`$` banned inside it, documented in place. Also recorded there: psql's `\copy` parser **rejects
dollar-quoted regexes** (`parse error at end of line`), which is why both regex sites hand-double
their quotes and must be kept in lockstep.

#### Closure item 3 — all 39 keystones specified (`docs/design/authz-c2-blind-keystone-specs.md`)

**The property split reproduces ADR 0187 D-M2 exactly — 12 / 13 / 14 — by an auditable rule** rather
than by message text: *a raise is authorization iff the guard immediately preceding it takes the
**caller** as an input* (`auth.uid()`, `app.is_*_of`, `app.can_*`). B splits lifecycle 9 / validation
5 by guard, but lifecycle 8 / validation 6 **by keystone**, because `update_interview` must pin
`HC0B1` rather than its possibly-unreachable `HC038` branch.

⛔ A regex over the messages gives 12/18/9 and is **wrong by 5 doors** — `reopen_capa_plan`,
`reopen_interview`, `reopen_rca`, `submit_rca_for_review`, `submit_ethics_appeal` — every one
over-called on **`apenas`** where `apenas` governs an *object*, not a principal (*"apenas um plano
concluído pode ser reaberto"*). `apenas` is a syntax, not a property: the same failure class as the
harness anchor, one layer up, and no better word list can fix it. This was the lead's error, caught
by the adjudication.

⛔ **ADR 0187 D-M1's "36 of the 40 BLIND doors are already invoked, only four with zero references"
over-counts by 5 and should read 31 of 39.** Three have no mention at all; five more are
grep-positive but **never entered**, appearing only in t19 `has_function_privilege` catalog
assertions (`cancel_session`, `update_session`, `update_interview`,
`set_interview_subject_participant`, `set_interview_interviewer_participant`). The mechanism is the
one `authz-c2-blind-keystone-designs.md` §4.3 predicted **in writing** — an enumeration bounded by
*the name appearing* rather than *the function being entered* — and §4.3's own worked example,
`cancel_session`, sits inside D-M1's "36".

⛔ **The existing design's mutation fact #2 ("all anchored raises go at once, so pinning any one is
sufficient") has an exception.** `approve_correction`'s `HC061` sits inside
`exception when others then … if sqlstate = 'HC061' then raise … end if; raise;`. Neutralized it
becomes `null;` and the bare `raise;` **re-raises the delegate's `HC061` with the same SQLSTATE** —
so a code-only keystone there stays **green under mutation**. Pin its `42501` instead.

**Two contradictions, neither of which may be keystoned before a catalog read** (specs §6.4):
`public.reopen_interview` (`121_interviews.sql:292-294` pins `HC038`, its only anchored raise, in its
own body) and `app.assert_ethics_typed` (three `null`-message `HC0J0` pins at `258:92`, `256:118`,
`255:137`). Shared mechanism: **a `null`-message `throws_ok` on a code that more than one enforcer in
the chain raises** — which is what makes §4.2's "pin the message" give an assertion a *subject*,
rather than merely defending against a missing EXECUTE grant. `public.cancel_interview` is a
downstream casualty: if the read goes one way, its only anchored raise is unreachable and it needs an
ADR 0187 D3-style ruling, not a test.

Also recorded: **6 codes have zero pins anywhere in the suite** (`HC074`, `HC075`, `HC0M1`, `HC0M3`,
`HC0M6`, `HC0M9` — the whole correction-draft authority lane plus both `conclude_referral` validation
codes); **10 allowlist lines owed for deletion**, each needing a working ALLOW leg plus an effect
assertion because a deny-only keystone leaves the door at 0 recorded calls and `ARM=floor` still
reds — and **9 of those 10 are also in the not-invoked set**, i.e. the allowlist entry and the
blindness are the same fact; and that the existing design's own `cancel_session` (§3.3) and
`cancel_event` `HC043` (§2.3) strings are **non-conforming with D2**, which post-dates them.

#### PO ruling, given directly 2026-09-04

**The three doors where the caller-input rule and a message reading disagree are labelled B
(state / lifecycle / validation), provisionally** — `public.add_capa_action_evidence` (`HC0D8`),
`public.submit_ethics_appeal` (`HC0J0` #1), and `app.assert_ethics_typed` (`HC0J0`, whose message
says *status* while its guard checks row existence — "text is not truth" sitting inside the
classification input itself). Rationale accepted: D2's label is precisely what prevents promotion, so
the conservative call can only ever understate coverage, never commit the promotion ADR 0184 point 5
forbids.

#### The `HCDS*` question ADR 0187 C3 left open is DISCHARGED — it was a measurement, not a ruling

0187 C3 recorded *"whether the four absent `HCDS*` doors **should** be Tier 1 … is a ruling owed, not
a measurement owed."* Applying the Tier-1 predicate verbatim — a command door whose gate-aware call
closure reaches a PHI-marked relation, where PHI-marked (`scripts/authz-c2-tier1-sizing.sql:99-113`)
is `not has_table_privilege('authenticated', rel, 'SELECT')` **or** a positive-polarity comment
matching `isolated phi|phi[- ]bearing|class[- ]1 phi`:

| relation | door-only | PHI comment | marked |
| --- | --- | --- | --- |
| `patient_xref`, `case_referral` | yes | yes | **YES** |
| `patient_safety_event`, `meetings` | no | yes | **YES** |
| `dsr_requests`, `dsr_tasks`, `hospital_dpos`, `commissions`, `cases` | no | no | no |

`create_dsr_request` reaches `patient_xref`; `complete_dsr_task` reaches `case_referral` and
`patient_safety_event`; `adjudicate_dsr_request` reaches `meetings` — all three in Tier 1, as found.
`attest_dsr_task` and `close_dsr_request` reach only `dsr_requests`/`dsr_tasks`;
`appoint_hospital_dpo` and `revoke_hospital_dpo` only `hospital_dpos`/`commissions` — **all four
correctly out.** `dsr_requests`' own comment states it is HASH-ONLY (`patient_key` is
`app.derive_patient_key` output; identity documents stay in the hospital's files) — an explicitly
**negative**-polarity PHI statement, so neither marker arm fires; `dsr_tasks.attested_by_name` is
labelled *"THE REVIEWER — a STAFF member's name, never the data subject's (Rule 12)"*.

⇒ The 4/4 split is exactly what the predicate produces. **No gap, and no ruling owed** — what the
record was missing was the *mechanism*, not a decision. ⚠ Caveat: the closure walked here is a
body-level relation scan plus one level of called functions, not the sizing script's full gate-aware
transitive closure; the stronger statement rests on the derivation itself, since
`c2-tier1-doors.txt` **is** that script's output and the four are absent from it.

#### Dead ends and stale citations found

- The "staged patch" this record cites at its own `:65-66` — `scratchpad/apply-anchor-fix.sh` — and
  `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000.md:152`'s `scratchpad/regex-fix-validation.txt`
  **do not exist anywhere in the tree**; there is no `scratchpad/` directory and it is not
  gitignored. Only the regex text and the committed
  `docs/reviews/c2-anchor-regex-fix-validation.txt` survived. Both citations are stale.
- An `awk` classification pass gave 12/17/10 and was discarded on inspection: `awk` was not matching
  accented UTF-8 in the pattern, so `add_rca_member`'s *"você não pode editar…"* fell to B. The wrong
  matcher read exactly like a live defect. Re-run in Postgres, then superseded entirely by the
  caller-input rule above.

#### Sequencing constraint, discovered and now binding on the remaining phases

Nothing under `supabase/tests/**` may be edited while a sweep runs — it changes the suite's shape
(`Files`/`Tests`) and voids the in-flight baseline the harness captured at the top of its run. So:
**Phase A** diagnose the 18 suite-abort rows and run the 2 catalog reads (DB, no edits) → **Phase B**
write the 39 keystones + the abort fixes + the 10 allowlist deletions (edits, no sweeps) → **Phase C**
verification subset sweep, rows merged into the findings file, never copied over it →
**Phase D** `ARM=census`, `ARM=floor`, `ARM=hat`, `FROMFINDINGS=1 ARM=wrapper`, then the records.

#### Artifacts

- **Written:** `docs/design/authz-c2-blind-keystone-specs.md` (`40c3c588`).
- **Changed:** `supabase/tests/mutation/c2-command-door-neutralizer.sh` (`ca328539`) — anchor,
  worklist column 6, both counters, the header's stale cost claim, and the heredoc trap documented
  in place.
- ⛔ **Untouched by design:** `docs/reviews/c2-command-door-findings.md` — derived per run (ADR
  0153); cksum verified unchanged before and after every sweep. It still reads 106/40/25 against the
  corrected 113/40/18, and the correction lives here.
- **Not committed, not mine:** `docs/progress/phase-ledger.md` carries an uncommitted set of
  2026-09-04 corrections from the previous session; left for the PO to rule on rather than folded
  into a C2 commit.

#### Phase A — the 18 suite-abort enforcers diagnosed (`docs/reviews/c2-suite-abort-diagnosis.md`)

⭐ **The dichotomy this phase was specified around does not fit, and the answer is better than either
branch.** The brief offered (a) *the abort is at a statement that directly exercises the guard* →
convert it to an assertion, or (b) *the abort is collateral* → a real keystone is owed. Measured
across all 18: **(a) = 0 · (b) = 0 · unclassifiable = 0.** Every one of the 18 falls into a third
shape the dichotomy has no name for:

> **(c) — the abort is collateral, AND the suite noticed the guard anyway.** Each of the 18 produced
> a genuine `# Failed test N … caught: no exception … wanted: <code>` **before** its file aborted.
> The abort is always downstream: a fixture write, or a uniqueness/cardinality violation caused by
> the door proceeding where it should have been refused.

⛔ **Keystones owed by this class: ZERO.** ADR 0187 D1's keystone count stays at **39**. The
suite-abort class is a **scoring** problem, not a coverage gap — the opposite of what its register
entry implies. The commonest abort mechanism is a **second enforcement layer noticing**:
`guard_submitted_response` / `_children` / `_signoffs`, `guard_capa_child_lock`,
`guard_interview_child_lock`, `guard_professional_linkage`, or a unique index. **The suite aborts
because the database is defended in depth.** Six of the 18 already have a file that fails *without*
aborting (`submit_response`→`276`, `activate_phase`→`114`+`90`, `assume_role`→`408`,
`link_referral_related_case`→`295`, `set_professional_link_state`→`229`,
`mint_printed_document`→`313`/`342`/`368`).

**`public.assume_role` — the ADR 0171 / sizing §10 obligation, resolved.**
`315_act_stage3_hat_condition.sql` aborts at the assertion spanning `:190-194` with *more than one
row returned by a subquery*. Mechanism, read from `pg_proc`: `assume_role` upserts
`active_role_selections … on conflict (session_id) do update` — one row, overwritten, exactly what
t8 reports — but `audit_write`s with `entity_id = session_id`, so the mutation's second,
should-have-been-denied call leaves **two** audit rows. `408_ae49` meanwhile fails cleanly, twice,
with the message pinned. **One edit at `315:190-194`** converts ERROR → scored COVERED, and it adds
*"exactly one `active_role.assumed` row per session"* — **a real Architecture Rule 11 property that
nothing in the suite asserts today**. Cheapest of the 18; leads Phase B.

**`public.submit_response` — the sharp one, diagnosed.** Δ **190** reproduced exactly. Seven files
show effect, six abort (`271` −34, `272` −18, `274` −52, `30` −7, `367` −75, `80` −4); **`276_ff5_references`
fails cleanly with 5 failures.** Uniform mechanism: the required/sign-off/validation guards vanish →
the response flips to `submitted` → Architecture Rule 3/5 immutability then refuses every later
fixture write. ⚠ Its `HC0P9` message is a bare `%`, so **no message pin is possible** — a named limit
of the "pin the message, not just the code" discrimination rule, not a defect in it.

**Catalog read 1 — `public.reopen_interview`: neither specs branch holds; branch (c) does, and it
exposes a structural blind spot.** `app.assert_interview_writable` raises **`HC039`**, so the
existing design §3.1 is right and branch (a) is false. Re-measured with the mutation landed, `121`
returns `Files=1, Tests=60, PASS` — so branch (b) is false too and the **BLIND verdict is correct**.
The `HC038` that `121:292-294` pins comes from **`app.guard_interview_status`, a TRIGGER on
`case_interviews`**: `cancelled → in_progress` is not in its allowlist, and `reopen_interview` sets
`app.in_interview_rpc='on'` so execution reaches it.

⭐ **That trigger is in 0 of the 171 — trigger functions get no call edge, so the worklist cannot
contain it.** This is a door whose refusal is delivered by an enforcer **this instrument
structurally cannot score**, which is a different failure from a door nothing tests. Filed as
`FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`. Consequences for Phase B:
`reopen_interview`'s keystone must use a **`scheduled`/`awaiting_follow_up`** fixture plus a message
pin; and **`cancel_interview` needs NO ADR 0187 D3-style ruling** — its `HC038` *is* reachable — but
its keystone must use an **already-`cancelled`** interview, because a `completed` one is satisfied by
the trigger rather than by the door.

**Catalog read 2 — `app.assert_ethics_typed`: the pins have the wrong subject, BLIND stands.**
`schedule_ethics_hearing` and `target_case_response` **do not call `assert_ethics_typed` at all**
(they raise `HC0J0` inline, 1× and 3×); `create_case_decision` calls it *and* raises inline 1×.
**15 functions raise `HC0J0` inline** — it is a **lane marker, not a delegate signature** — and the
attributing comment at `258:89` is wrong. This is the `null`-message-`throws_ok` mechanism the specs
§3.3 named, confirmed in its sharpest form.

**Phase B owes from this class: 25 statement edits across 21 files + 21 `plan(N)` bumps** — 19
`lives_ok` wraps, 5 cardinality-assertion fixes, 1 special; `305:358` serves two doors in one edit.
Projected shape `Files=262, Tests≈8789` — ⚠ **projected, not measured**; whatever the post-edit reset
measures becomes the next baseline, and Phase C's shape guard depends on it.

**Ruling given (lead, 2026-09-04) on `406:243`.** It is the file's own anti-vacuity preflight
(*"the mutation would be a no-op and the twin would report green"*) firing **as designed**. ⛔ It is
not to be softened or deleted — that would reintroduce exactly the vacuity it prevents. The
`ok()` + `skip()` conversion is authorised **on condition** that a skip still counts toward the plan
(so the run's shape is unchanged) and the door's genuine failing assertion still fires elsewhere in
the same run; if the conversion would make the file pass while noticing nothing, it must not land.

**Corrections to the lead's brief, found by measurement:**

- `app.assert_respondent_linkage_resolved` aborts in **2 files, not 1** — `229` (−20) + `321` (−27)
  = 47. Found via the catalog's caller closure, not by grep, and caught by reconciling the plan sums.
  The lead's candidate map was built by grep and missed the delegated call path.
- `confirm_triage`: only `141` aborts; `142` and `143` pass unchanged. `submit_response`: **7** files
  show effect, not the 18 the grep map suggested.
- ⭕ **The 2026-09-02 deltas reproduce EXACTLY against the 8764 baseline.** Re-deriving them was
  correct discipline, but the figures were safe: a delta is a property of the **aborting file's own
  plan**, and is invariant under suite growth elsewhere.
- `FUP-C2-SUITE-ABORT-ERROR-CLASS`'s `Files=259` and its localization table are stale, and its
  "16 enforcers" is now **18**.
