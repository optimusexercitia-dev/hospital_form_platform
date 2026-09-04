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

#### Phase B1 — the 18 suite-abort enforcers converted from aborts into scored assertions

**25 statement edits across 21 files, 21 `plan(N)` bumps, net +24 assertions.** New baseline,
measured on a fresh `supabase db reset --local`:

```
Files=262, Tests=8788, 87 wallclock secs
Result: PASS
```

Zero `not ok`, zero `Bad plan`, zero `Dubious`; every one of the 21 files also verified individually
before the full run. ⚠ **8788, not the diagnosis's projected ≈8789** — see correction 5 below.

⭐ **`public.assume_role` → COVERED**, run twice, the second time on the freshly reset DB:

```
| `public.assume_role(p_role platform_role)` | 1 | 2 | **COVERED** | a keystone asserts through this guard (red under mutation, green restored) |
```

The ADR 0171 / sizing §10 obligation — *"`assume_role` remains ERROR-shaped, not COVERED, and must be
resolved within Tier 1"* — is **discharged**, pending Phase C's full confirmation.

**The `406:243` ruling, and the evidence it was conditioned on.** The `ok()` + `skip()` conversion
landed with the `position(v_cut in v_src) = 0` predicate **byte-identical**: the preflight still
refuses to run a no-op mutation, and now reports that refusal as scored test 5.0 instead of raising.
Both conditions the lead attached were then met by **measurement, not argument** — the C2 mutation
was reproduced on `public.set_professional_link_state` (harness anchor byte-for-byte, oid 23316,
`h0 = ac10494454a7d8b1d0f2822339dda926`, restored byte-identical) and 406's TAP captured:

- **the skips count toward the plan** — `Tests=19` against `plan(19)` with no `Bad plan`, so the
  run's shape is unchanged and the harness reads a clean FAIL rather than an ERROR;
- **the door's own assertions still fail in the same run** — tests 13, 14 and 16 (§4's door-coverage
  arms, all upstream of the edit) are red. The file fails four ways, three of them about the door.

5.1 and 5.2 skip rather than run, which is the point: with the bound already removed by the C2
harness, running 5.1 would have reported a **false green** attributable to the wrong mutation.

**Ten places the diagnosis was wrong when applied.** Recorded because the pattern — a remedy that
reads correct and fails on contact — is the reusable part:

1. **`max(organization_id)` does not compile.** §2.15 names it literally; PG 17.6 answers
   `ERROR: function max(uuid) does not exist`. Replaced with `order by seq limit 1`.
2. ⭐ **`315:194` is not one statement, it is two.** The very next assertion reads the *same*
   multi-row subquery and would have aborted one line later. **Without catching this, `assume_role`
   would still have scored ERROR** — the fix would have moved the abort, not removed it. This is
   exactly the diagnosis's own §0 caveat ("I did not check whether any aborting statement is
   load-bearing for a later assertion") biting on the highest-value row in the batch.
3. **`305:638` is +0, not +1.** The remedy says "add a cardinality assertion and aggregate", but the
   assertion on the line immediately above **already is** that cardinality check on the identical
   predicate — the diagnosis calls this row "the cleanest illustration in the whole class" without
   noticing that makes half of its own remedy redundant. Aggregated only; a second would be padding.
4. **`406` §5 is +1, not plan-neutral** (18 → 19): the preflight *must* become a scored assertion or
   the file passes while noticing nothing about §5. Corrections 3 and 4 cancel; the total stays +24.
5. **The projected total was off by one**: 8764 + 24 = **8788**, not 8789.
6. ⭐ **Four "W" sites name only the FIRST of a run of statements that all fail under mutation** —
   `30` (three inserts), `121` (`add_interview_subject` + `conclude_interview`), `141`
   (`save_triage` + `confirm_triage`), `143` (`complete_capa_action` + `close_capa_plan`). Wrapping
   only the named line **moves the abort down one line** rather than removing it. Each run wrapped
   in a single `lives_ok` (plpgsql `EXECUTE` accepts a multi-statement string), keeping the site +1.
7. ⭐ **Three "W" sites are CTAS, where a plain wrap is not available.** `150:1225`, `281:222`,
   `321:463` build a temp table *from* the RPC; **a CTAS whose query raises leaves no relation**, so
   the downstream assertions would abort with `relation does not exist` — trading one abort for
   another. Replaced with create-empty-then-`insert`-under-`lives_ok`, so a refused call leaves the
   reads returning NULL (scored) instead of crashing. Same shape for the three value-capture sites.
8. **`80:276` has a second assertion on the same raising call** (`80:279-284`, the
   `observations_by_item` projection), unmentioned in the diagnosis. One capture serves both.
9. **`80`'s temp table needed `grant select`, not just `insert`** — the reads run under
   `set local role authenticated`. Observed red (`permission denied for table sgn_payload`, plan 20
   ran 16) and fixed.
10. Two files carry a header `-- Assertion count: N` line that also had to move (`203`, `305`).

⚠ **Residual risk Phase C owns, stated by the agent that did the work.** Fixing an abort at
statement N says nothing about statement N+k. That loop was closed **by measurement for exactly two
doors** — `assume_role` (COVERED) and `set_professional_link_state` (clean FAIL, shape 19). For the
other **16** the claim "ERROR → COVERED" is still a **prediction**. ⛔ A row that does not come back
COVERED in Phase C is a finding, not a retry.

#### Phase B2a — 18 keystones written, **18/18 COVERED**

Clusters 9, 6, 1, 3, 4. Commit `400b6d2c` (the 7 test files; the allowlist deletions ride with
batch B). Suite baseline **8788 → 8819, PASS** (94 s; a second fresh run gave the identical shape).

Every one of the 18 came back **COVERED** — *"a keystone asserts through this guard (red under
mutation, green restored)"*. ⛔ Nothing stayed BLIND, so no door in this batch needs a mechanism
read. Verdicts, from `$WORK/c2-command-door-findings.SUBSET.md` (ADR 0153 — the committed baseline
was cksum-verified untouched throughout; **Phase C owes the merge of these rows**):

`withdraw_referral` · `update_event` · `unassign_referral_internal_note` · `unassign_narrative` ·
`transfer_event_custody` · `start_correction_draft` · `set_event_patient` ·
`save_correction_draft_body` · `review_correction` · `resubmit_correction` · `reopen_triage` ·
`reopen_referral` · `reject_correction` · `conclude_referral` · `cancel_event` · `assign_narrative` ·
`approve_correction` · `add_reserved_item` — all **COVERED**.

**The +31 reconciles exactly: 20 deny arms + 5 new effect assertions + 1 new allow leg + 5 PRE
fixture arms**, counted from the diff per file (2/5/8/6/1/8/1) with every `plan(N)` matching its
file's real count. **No keystone landed deny-only**, so `ARM=floor` has a recorded call for all 18 —
which matters because a deny-only keystone leaves a door at 0 recorded calls and the floor arm still
reds. Two ADR 0187 D2 labels, on exactly the two class-B arms (`cancel_event`'s `HC043` **state**,
`conclude_referral`'s `HC075` **validation**); the 16 A1/A2 arms carry none, where a label would be
wrong.

On the two doors whose allowlist lines were retired: **`cancel_event`** was the only door in the
batch with *zero* successful calls anywhere in the suite, so it got the full triple — deny `HC044` +
deny `HC043` + a **new** `lives_ok` allow leg (`140:427`) + a **new** `is(status='cancelled')` effect
(`140:430`) — and that new allow leg is what makes deleting its line legal. **`conclude_referral`**
already had three successful calls with standing effect assertions, so its line **was stale before
anyone touched it** (specs §6.5 suspected exactly this): deleting it retires a dead entry rather than
earning a new one.

⚠ **One honest caveat carried forward: `set_event_patient`'s effect assertion is INDIRECT.**
`event_patient` has direct `SELECT` revoked from `authenticated` (`140:283-300`), so no test can read
the written row back. Its allow leg is proven at `140:317-325`, which asserts the
`event_patient.updated` **audit row** exists and is PHI-free — that subquery returns NULL and fails
if the door did nothing, so it is a genuine effect assertion, reached via Architecture Rule 11 rather
than a row read.

**Five things the specs got wrong, found by applying them:**

1. ⭐ **§5.6's persona is unusable — the file promotes it.** `237:49-55` deliberately promotes both
   candidate principals to `staff_admin` (its own PRE arms assert this). The prescribed
   `claims_for(st_x, false, 'staff')` would have raised `HC0F1`, or worse produced a **hat-driven**
   denial — `app.has_role`'s trailing hat clause failing for a principal who *is* `staff_admin` —
   which reads as a passing authorization keystone and proves nothing. A genuine plain member was
   added instead, with its PRE arm measured through the 3-arg `*_for` predicates whose hat condition
   short-circuits when `p_user_id <> auth.uid()`, so the denial is attributable to the missing role.
2. ⚠ **§5.6's message does not discriminate, and §3.3 over-generalises.** Both narrative doors raise
   `42501` · *sem permissão*, and **94 `public`/`app` functions raise that exact pair** (measured on
   the live catalog). The batch's other 16 pins are globally unique (code, message) pairs; these two
   are not. Nothing in *their* call path re-raises it, so the keystones are sound — but §3.3's *"the
   message is what distinguishes two worklist rows that share a code"* has **no purchase here**, and
   the PRE arm is what gives these two a subject.
3. **§5.1 cannot work for `save_correction_draft_body`.** It refuses a *phase* request at an
   **unanchored** `check_violation` (*esta solicitação não é de narrativa*) whenever
   `case_narrative_id is null` — **before** `HC0M1`. The prescribed r9-shaped fixture would have died
   on a code the mutation cannot touch and measured nothing. It needs the narrative request.
4. **Line numbers and plans drifted**, exactly as the specs' own §0 predicted: `150` is `plan(220)`
   (spec: 218), `141` is `plan(45)` (spec: 44), `264` ends at K13 not "K12 ~L526".
5. **A fourth instance of the downstream-enforcer trap.** Under mutation `start_correction_draft`
   caught `42501` · *você não pode corrigir esta fase* from **`guard_supersession_coherent`**, further
   down the write path — the same geometry as `reopen_interview`/`app.guard_interview_status`. The
   trap is not confined to interviews, and a code-only pin there would have had no subject.

**⭐ The hazard that dictated placement in three files → LEARN-081.** Under mutation the door **does
not refuse — it succeeds and performs its effect**, so a deny arm is a *live fixture mutation* in the
mutated run. Placed upstream of a bare (unwrapped) call on the same object, it consumes the state
that call needs; the call raises, the file **aborts**, the suite shape changes, and the harness scores
**`ERROR`, not `COVERED`** — a correct keystone whose measurement is thrown away. **Rule: place a
deny arm downstream of every bare lifecycle call on the object it targets, or point it at a dedicated
fixture nothing else reads.** It bit in `150` (a mutated `conclude_referral` would have concluded the
referral the bare call at `150:885` needs), `141` (a `reopen_triage` arm before `141:281` would have
consumed the `triaged` state), and `140` (a dedicated two-row fixture was hand-rolled so a mutated
`transfer_event_custody` or `cancel_event` could not move `e1` out from under the file's state
machine). ⭐ This is the **same failure class Phase A spent itself eliminating, arriving from the
opposite direction**: Phase A removed 25 pre-existing aborts; a careless keystone creates new ones.

**Incident — the not-killable rule was broken, and the harness could not see it → LEARN-082 and
`FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`.** The first sweep was launched under the
Bash tool's 10-minute maximum timeout on a ~60-minute run and was killed at the deadline, stranding
`public.cancel_event` with **both anchored raises rewritten to `null;`** — its `HC044` custody gate
open for roughly four minutes. ⚠ **Local development database only**; no remote was touched and the
ADR 0153 committed-baseline guard held throughout. Restored by `supabase db reset --local` and
re-verified against the catalog: `cancel_event` back to 2 anchored raises, **171/171** enforcers at
full baseline count, 0 degenerate non-SELECT policies. The killed run's three verdicts were
**discarded** — measured correctly, but the rule says discard — and the whole sweep re-run from a
clean DB as a detached process with an isolated `WORK`. The verdicts above are that re-run's.

⛔ **The second finding is the durable one: neither of the harness's crash-safety mechanisms can see
this.** `restore_inflight` (`:88-93`) truncates its sentinel **unconditionally**, so when the
restoring `psql` dies in the same process group the restore does not happen *and* the sentinel that
would have told the next run to redo it is erased in the same breath — confirmed by the file
timestamps (`INFLIGHT.sql.body` holding the real 1194-byte body at 09:38, `INFLIGHT.sql` emptied at
09:39). And the `DEGEN` preflight (`:101-106`) matches only a whole body replaced by a constant — the
*boolean-gate* audits' shape — which a `raise → null;` rewrite never produces. The traps at `:94-95`
cover `EXIT INT TERM HUP`; a `SIGKILL` or job-tree teardown runs none of them. Detection was possible
only by comparing per-enforcer anchored-raise counts against `worklist.tsv`, which found it
immediately — and is the proposed second preflight arm.

**Handoff to batch B: every remaining owed allowlist line has SHIFTED by 2.** Re-derived after the
two deletions: `add_capa_action_evidence` **47** · `cancel_session` **73** · `nsp_org_capa_rollup`
**97** · `set_interview_interviewer_participant` **125** · `set_interview_subject_participant` **126**
· `update_interview` **138** · `update_interview_subject` **140** · `update_session` **145**. Specs
§6.5's numbers are now wrong for seven of the eight, and they shift again with each deletion — match
on the **entry text**, never on a line number.

#### Phase B2b — the remaining 21 keystones, **21/21 COVERED**. All 39 are now written and measured.

Clusters 2, 5, 7, 8. Commit `2cefae8e` (7 test files + all 10 allowlist deletions). Sweep verbatim:

```
=== DONE — swept 21 of 171 derived enforcer(s) ===
    COVERED=21  BLIND=0  ERROR=0   (skipped by CASES: 150)
```

82 minutes, detached outside the tool's job tree with its own `WORK` and `C2_INFLIGHT`, **not
killed**. Post-run catalog: 0 degenerate bodies, all 21 doors carrying their anchored raises again,
INFLIGHT sentinel 0 bytes. Suite **8819 → 8866, `Files=262`, PASS** on a fresh reset (86 s), and the
per-file assertion counts reconcile **exactly**: 121 +18 · 228 +8 · 142 +5 · 143 +7 · 189 +4 · 176 +1
· 258 +4 = **+47**.

**14 ADR 0187 D2 property labels across 13 class-B doors** — 9 `lifecycle`, 5 `validation`;
`submit_ethics_appeal` carries one of each on its two arms. The 8 A1/A2 doors carry none, where a
label would be wrong. ⇒ With batch A's 2, **16 labels stand across the 39**, and closure item 3 is
complete.

**All 10 allowlist entries retired under one commit.** Batch A's two deletions were deliberately held
back from `400b6d2c` so the whole retirement lands together; the agent caught that they were sitting
in the working tree owned by no commit, which was correct and worth catching.

**Five pins are NOT globally unique (code, message) pairs — measured on the live catalog, after the
sweep** (a mid-sweep `prosrc` scan would read a neutralized body and undercount):

| pin | bodies carrying it | what supplies the subject |
| --- | ---: | --- |
| `HC048` · *você não pode editar…* | 3 | the CALL — `add_rca_member` reads its predicates directly and delegates to no other `HC048` raiser |
| `HC0J0` · *ação inválida para o status…* | 5 | `create_case_decision`'s closure contains none of the other four |
| `HC039` · *sem permissão para editar…* | 5 | the call + the object each arm targets; it **does** discriminate against the delegate `app.assert_interview_writable`, whose `HC039` string differs — the confusion that actually mattered |
| `42501` · *…pode ver este relatório* | 2 | the call — `nsp_org_capa_rollup` and `nsp_org_event_rollup` share the identical string |
| `HC0B1` / `HC0B2` | 2 each | the call — door plus its `create`/`add` sibling |

⭐ In every case **the sweep is the independent check**: mutating the door *alone* turned the full
suite red, which it could not do if a sibling were supplying the raise. Batch A's `42501` ·
*sem permissão* = **94** was re-measured and confirmed.

**Nine more things the specs got wrong.** The two that change what was believed:

1. ⛔ **§3.1's predicted resolution is FALSIFIED, and the real mechanism is sharper.** The spec
   predicted the `258:89` comment mis-attributes `HC0J0`. The catalog says the comment is **correct**
   — `create_case_decision` *does* call `app.assert_ethics_typed`. The actual mechanism is that
   `create_case_decision` **also raises `HC0J0` inline two lines later** on the same non-ethics
   fixture, and the pin at `:92` passes `null` for the message, so neutralizing the delegate is
   **silently absorbed by the inline raise**. Callers of `assert_ethics_typed` are exactly
   `add_ethics_allegation`, `create_case_decision`, `decide_admissibility`,
   `issue_ethics_notification`, `submit_ethics_appeal` — `schedule_ethics_hearing` and
   `target_case_response` never call it, which is the part the spec got right.
2. ⛔ **§3.2 resolves to a THIRD branch the spec never enumerated**, confirming Phase A: under
   mutation `reopen_interview` reaches its UPDATE and **`app.guard_interview_status`, a trigger**,
   refuses `cancelled → in_progress` with the *same* `HC038` the null-message pin accepts. So
   `app.assert_interview_writable` raises `HC039`, branch (a) is false, and **`cancel_interview`
   needs no D3 ruling**.

And the operational ones: §5.2's claim that 228's subject/interviewer rows "are all standing" is
false — the file contains **zero** `add_interview_subject`/`add_interview_interviewer` calls, so both
fixtures had to be built; `update_interview_subject`'s prescribed host was wrong for the same reason
and moved to 121; `add_capa_action_evidence`'s "BUILD on two tables" over-states the work but
**misses the real precondition** — `app.guard_capa_child_lock` refuses evidence writes on a completed
plan regardless of the feature flag, and reopening the plan is both the fix *and*
`reopen_capa_plan`'s allow leg; §5.7's message claim is backwards (the two rollups share the
identical string, the roster's differs); and plan lines drifted again (143 is `plan(39)`, 121 is
`plan(61)`).

⭐ **§5.2's discriminator does not transfer, and the fix was to change the CALLER.** `iv` is
`legal_privileged`, so the prescribed principal reads **zero** `interview_sessions` under RLS: the
`record_session_attendance` arm, written the way the file's own sibling writes it, refused with
`P0002` *sessão não encontrada* — an **earlier guard** — leaving `HC039` untested. Observed live as a
red test, then fixed by resolving the session id as owner. ⛔ The expectation was never touched.

**Two defects introduced and repaired, both self-caught:**

1. Multi-line `plan()` comments shifted every line below them in six files, **rotting the line
   citations inside the agent's own descriptions** and any pre-existing reference. Collapsed back to
   bare `select plan(N);` after the sweep, with every citation re-verified to resolve.
2. Three claims written into comments were **falsified by the agent's own uniqueness scan** — *"only
   the MESSAGE gives an arm a subject"*, *"differ only in the message tail"*, and the `HC048`
   attribution. All three corrected in place with the measurement that falsified them.

Both repairs were comment-only — no assertion, plan or shape change — so the sweep measurement
stands, re-verified by the fresh reset and full suite above.

⭐ **Method note worth adopting: the SUITE-scoped pre-flight.** The same harness pointed at just a
keystone's host file (`SUITE=`) returned the identical 21/21 COVERED in **~4 minutes** against the
full sweep's **82**. It caught nothing here only because the design work was done first — as a cheap
red-first screen before committing an hour of wall clock, it should be standard.

#### Phase C+D and the residual aborts — **C2 CLOSES. 170 COVERED · 1 BLIND · 0 ERROR = 171.**

Commits `f33d9ba7` (the last 4 abort sites + the merged findings). Suite **8876, PASS**, fresh reset,
86 s. The findings file was merged **row by row by signature match, never copied** (ADR 0153): 171
data rows intact, baseline cksum verified unchanged by the harness's own guard.

**All three of ADR 0187 D1's closure conditions are discharged by measurement, not by argument:**

| item | evidence |
| --- | --- |
| the anchor fix | `ca328539` — 813/813 in Postgres ARE, 0 overmatch, 0 regression; blast radius proven as **replace-output inequality** over 1081 functions, not a count comparison |
| the ERROR class re-swept | 25 → **0**. Every row carries a scored verdict |
| the 39 keystones | **39/39 COVERED**, 16 ADR 0187 D2 property labels across them |

Sweep arithmetic, each step reconciling to 171: 106/40/25 → *(tail-drift re-measured)* 109/40/22 →
*(anchor fix)* 113/40/18 → *(B1's 25 statement edits)* 131/40/0 → *(batch A)* 149/22/0 → *(batch B)*
170/1/0. ⚠ Phase C measured **166/1/4** first — the target was **not** met on that pass, and the
four-row shortfall was a real finding, not a rounding error.

**The four ERROR rows were one defect, and it was Phase B1's.** B1 fixed the **first** aborting
statement in each file; a **later, independent** statement aborted under the same mutation, so every
delta *shrank* rather than vanishing (52→39, 71→59, 12→8, 2→1) — the abort moved down. This is B1's
own recorded correction 6 left unfixed at a second site. ⛔ Two of the four diagnoses handed to the
fix pass were **wrong on contact** (`312` was a bare `insert into public.responses` colliding on
`responses_one_draft_per_user_idx`, not §10's `printed_documents` inserts; `305`'s "prime suspect"
bare CTAS was harmless), and **a third site appeared in `274`** — fixing an abort moves it down until
the whole *run* of statements is wrapped.

⭐ **A new failure shape, measured and registered (LEARN-083,
`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`).** A pgTAP **value** assertion
(`is`/`isnt`/`ok`/`cmp_ok`) evaluates its subject expression **before** the assertion is entered, so
a door raising inside it **aborts the file instead of failing the test** — the harness reads a shape
change and scores `ERROR`, so the verdict is *lost rather than earned*. `throws_ok`/`lives_ok` are
immune, taking the statement as text and `EXECUTE`-ing it inside a handler. It was hit **four times
in one day**, and `305` had already documented two *other* variants in its own comments. Census over
the suite: **6216 value-assertion sites scanned, 296 latent across 60 of 262 files**, by a
balanced-paren scan honouring dollar-quotes — an **upper** bound on latent aborts and a **lower**
bound where a door is reached through a helper outside the 265-name population.

**The four arms, on the final tree from a fresh reset, each named with its DOMAIN (ADR 0079):**

- **`ARM=census`** — no unswept newcomer *within the prosecdef-bool / set-returning / INVOKER-plpgsql
  / RLS-policy domain*. **HOLDS**, exit 0. ⚠ That domain **explicitly excludes** the C2 population,
  so this arm says nothing about command doors — which is why C2 exists.
- **`ARM=floor`** — every never-called *authenticated-reachable `public` SECURITY DEFINER door* is
  allowlisted and every allowlist entry resolves live. **HOLDS**, exit 0. ⭐ The **10 deleted
  allowlist entries are earned**: each of the ten has ≥ 1 recorded call in `pg_stat_user_functions`.
  ⚠ **Eight sit at exactly one call — zero slack**, so losing any single allow leg reds this arm.
- **`ARM=hat`** — ACT hat-blind sweep; 4 findings, all reasoned-allowlisted. **HOLDS**, exit 0.
- **`FROMFINDINGS=1 ARM=wrapper`** — *invoker-wrapper* BLIND set of 41 ⊆ allowlist. **HOLDS**, exit 0.

No BLIND block; no `ERROR`.

**The suite-shape assumption, stated rather than buried.** The 106 pre-existing COVERED rows were not
re-swept (a full 171-enforcer run costs ~8 h at the measured 87 s/run). The lead's argument was that
nothing deleted an assertion, so no red mutated run can have gone green — **verified, not assumed**:
no `.sql` assertion was removed or weakened anywhere — **zero** deleted `throws_ok`, zero
`'CODE','message'` → NULL narrowings, zero changed expected values, and all 31 `plan()` changes
upward. ⚠ The earlier phrasing — *"the only deletions are the 10 allowlist lines"* — is **literally
false**: the range carries 128 further deleted lines (comments, `plan()` lines being rewritten
upward, statements rewritten under `lives_ok`). All are benign and the conclusion survives, but the
sentence did not, and a reviewer checked it rather than reading past it. ⭐ The stronger form,
found by that review: **no migration and no `src/` file changed anywhere in the range** — so the
doors themselves are byte-identical to what the 106 rows were measured against. ⛔ **But that argument covers only the PASS/FAIL
axis.** COVERED also requires *shape stability*, and shape is **not** monotone under adding tests: a
new arm that raises under some *other* door's mutation aborts its file and turns that door's COVERED
into ERROR (LEARN-081, which bit three times inside B2a). That direction is **conservative** — it can
only downgrade a real verdict to unmeasurable, never manufacture a false COVERED — so none of the 106
can be a false positive; at worst the file overstates how many carry a live verdict. Positive
evidence the assumption holds: all 4 anchor rows were COVERED at 8764 and again at 8866 across all of
B1 and all 39 keystones; `assume_role` COVERED at 8788 and again at 8866; and the four residual
aborts all lived in files **untouched** by the keystone commits.

---

### ⛔ The disclosure block — required verbatim by ADR 0187 D1 in every gate record citing this sweep

**1. Tier 2 — STILL UNCOVERED.** ⛔ **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT
cleared.** Nothing in this work touched them.

**2. The `HCDS*` / `28000` lane — ⭕ DISCHARGED, and ADR 0184's diagnosis of it was wrong.** 0184
recorded them as *"structurally absent from the worklist … because the gate-fn filter uses the same
anchor"*. Measured: it is **8 functions**, not "60 raises + 6"; **all 8 raise an anchored `42501`**,
so **none is excluded by the `:153` filter** (ADR 0187 C3). Four are in the 171 and now all COVERED
(`create_dsr_request`, `complete_dsr_task`, `assume_role`, `adjudicate_dsr_request`). The other four
are **correctly outside Tier 1**, and that is now a **measurement, not the ruling 0187 C3 said was
owed**: their gate-aware closure reaches no PHI-marked relation, because `dsr_requests` is hash-only
by design and says so in its own table comment — an explicitly *negative*-polarity PHI statement.

**3. The ERROR class — ⭕ CLOSED.** 0184 estimated "~10 enforcers"; 0187 C2 corrected it to 22; it is
now **0**.

**4. ⭕ A FOURTH population, not in ADR 0184's three — UNCOVERED.** A **trigger** function has no call
edge from the door whose write fires it, so it can never enter the worklist's call-edge closure:
`app.guard_interview_status` is in **0 of the 171** while being the enforcer that actually refuses
`reopen_interview` on the fixture the suite uses. A door whose refusal is delivered by a trigger
reads BLIND for a reason the findings file cannot express — a *correct* BLIND that is not actionable
as one. `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`.

**The anti-promotion sentence (ADR 0184 point 5, operationalised by 0187 D2).** A COVERED verdict
from this sweep means **`HC0*`-coded-guard coverage, not authorization coverage**, except where the
row's keystone carries an explicit property label. The 39 keystoned doors split **A1 12 / A2 13 /
B 14 = 39 BY DOOR** under the caller-input rule; the **14 class-B doors' COVERED is state /
lifecycle / validation coverage** and says so in its test-name string.

⚠ **The label count and the class count are different denominators, and reading them as one makes
them look contradictory.** Measured in the tree: **16 labels** (9 `lifecycle` · 1 `state` ·
6 `validation`) across **15 doors** — the 14 class-B doors **plus `public.cancel_event`**, an **A2**
door whose *second* arm (`HC043`, already-terminal event) is a state guard and is labelled as one.
`public.submit_ethics_appeal` carries two labels on its two arms. So: **classes count DOORS, labels
count ARMS**, and 12 + 13 + 14 = 39 while 16 labels sit on 15 doors. Neither figure is wrong; the
record previously stated both without the distinction. ⛔ The **106 pre-existing COVERED rows are not
classified** — 0184 point 5 stands for them unchanged.

**The single remaining BLIND, named so it is not read as an oversight.** `app.print_source_series`
stays **BLIND by ruling** (ADR 0187 D3): its only anchored raise `HC0H4` fires at supersession-chain
depth > 1000, a shape its own body comment records as unconstructible under
`guard_supersession_coherent` plus the one-successor unique index. ⛔ Recorded so nobody later
attempts a 1001-row fixture.

---

### ⚠ The tally is a COMPOSITE, and ADR 0188 is the ruling that makes it admissible

⛔ **170/1/0 was never produced by a single sweep.** Its 171 rows were measured across **six** suite
shapes as the work proceeded: `Tests=8685` (the 2026-09-02 full sweep — 106 COVERED rows still stand
from it) · `8764` (the anchor fix's 6) · `8788` (`assume_role`, `set_professional_link_state`) ·
`8819` (batch A's 18) · `8866` (batch B's 21, then the 25-enforcer ERROR/tail-drift sweep) · `8876`
(the four residual aborts). A full 171-enforcer re-sweep costs **~8 h** at the measured 87 s/run.

ADR [0188](../decisions/0188-a-closure-tally-may-be-composited-across-suite-shapes.md) rules the
composite admissible on three conditions, all checked here: no assertion deleted or weakened; **no
migration and no `src/` change in the range**, so the doors are byte-identical to what the earlier
rows were measured against; and the one unproven direction — COVERED → ERROR, via a newly-added arm
aborting a file — is **conservative**, since it can only downgrade a real verdict to unmeasurable
and can never manufacture a false COVERED. ⇒ the file may **overstate how many rows carry a live
verdict**; it cannot assert coverage that was not measured.

⚠ **A residual ADR 0188 does not remove:** the harness records a **suite-level** flip, not which
assertion flipped. A COVERED verdict therefore attributes coverage to the **door**, never to a
specific keystone — a keystone redundant with a pre-existing arm is indistinguishable from a
load-bearing one. The closure review names this the highest-value instrument fix available; it is
not done.

⚠ **The merge tool is line-oriented and left 5 orphaned `CONTEXT:` fragments** — tails of the old
multi-line `MUTATION DID NOT LAND` notes whose rows had been replaced. They broke the markdown table
and were removed by hand after the review found them; 171 rows and the tally were re-verified
unchanged. ⛔ It will recur on the next merge that replaces a multi-line note.

### What C2 discharges, and what it does not

**Discharges:** Critical FUP C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`), and with it Gate AE4's acceptance
clause *"the C2 subset closed (pilot cutline)"* (`docs/plans/authz-evolution.md:1067`) — the only
external precondition gating on C2 in the plan or the phase docs.

**Does not discharge, and must not be read as doing so:** Tier 2 (190 doors, deferred); the four
follow-ups this work left open — `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`,
`FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`,
`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`, and
`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` (its harness defect — a baseline captured
once at the top of a long run — is untouched, even though its three rows now carry full-scale
verdicts); and **PO approval of Gate AE4 itself**, which is a separate decision.

#### Hub `## Current state` at closure — cut from the hub 2026-09-04 (ADR 0186 D8)

The hub carries no `## Current state` once its status is `complete`; the gate enforces it.
Verbatim, as it stood at closure:

---

## Current state

**Updated:** 2026-09-04 — ✅ **measurement COMPLETE**, awaiting QA review + PO approval

### Objective

Sweep the 237 command doors that touch PHI (Tier 1, gate-aware closure over `ARM=census`'s population) and close C2 on ADR 0187 D1's three items. ✅ **All three discharged by measurement 2026-09-04**; the unit stays `gated` until a review verdict and PO approval exist.

### Done since start

- Full sweep 2026-09-02 — 171/171 enforcers (COVERED 109 · BLIND 40 · ERROR 22 after correction). ADR **0184**, then ADR **0187**'s three PO rulings and six corrections (2026-09-04).
- ✅ **The anchor fix** (`ca328539`) — larger than the fix on record, which had been validated against migration text against a denominator that excluded the shape it missed. 813/813 in Postgres ARE.
- ✅ **The ERROR class** — 25 → **0**. Phase A found all 18 suite-abort doors were a *scoring* gap, not a coverage gap (`ba876c1c`); B1 landed 25 statement edits (`97ff9f22`); 4 residual sites closed at `f33d9ba7`.
- ✅ **The 39 keystones** — **39/39 COVERED** (`400b6d2c`, `2cefae8e`), **16** D2 labels across **15** doors (classes count doors, labels count arms — `cancel_event` is A2 with a state-labelled second arm), all **10** allowlist entries retired and **earned** (each door has ≥1 recorded call).
- ✅ **Final tally `170 COVERED · 1 BLIND · 0 ERROR = 171`**, merged row-by-row (ADR 0153). All four arms HOLD, each recorded with its **domain**. Suite **8876, PASS**.

### In progress

- **QA review** of the closure — the gate will not accept `complete` without a linked review whose verdict line says APPROVED, or a phase-ledger row (ADR 0186 D8).

### Next

- **PO approval** of the closure, then the ledger row / hub `complete`.
- **PO approval of Gate AE4** — C2 discharges its acceptance clause *"the C2 subset closed (pilot cutline)"* ([plan](../plans/authz-evolution.md):1067), the only external precondition gating on C2. That approval is a separate decision.

### Blockers

- C2 is **measured** but not **approved** — the three ADR 0187 D1 items are discharged; the closure verdict is not yet written. ⛔ **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared** — required verbatim in every gate record citing this sweep (ADR 0187 D1).
- ⚠ Four follow-ups remain open and are **not** discharged by this closure: `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` (a fourth uncovered population), `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`, `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` (296 latent sites), and `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`.
- ⚠ `ARM=floor` has **zero slack**: 8 of the 10 newly-retired doors sit at exactly one recorded call, so losing any single allow leg reds it.
