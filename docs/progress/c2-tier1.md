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
