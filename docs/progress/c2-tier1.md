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
(`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`): (1) too narrow — `HCDS*` (60 raises, the
LGPD Art. 18 lane) and `28000` need a literal `0` in position 3 and are excluded; the gate-fn
filter at `:153` uses the same anchor, so those doors are structurally absent from the worklist,
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

- Keystones — designs complete (`docs/design/authz-c2-blind-keystone-designs.md`), incl. the
  warning that `cancel_session`'s anchored raise is HC038 (a STATE guard); its authz is HC039 in a
  different worklist row, so the "obvious" HC039 keystone would not flip the verdict.
- The delta sweep for `HCDS*`/`28000` after widening the anchor — a NEW population, needs
  re-derivation, not a refresh.
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
- NEW, more serious than the item it replaced — the anchor's own blind spot: `HCDS*` (60 raises)
  and `28000` (6) are outside `errcode = '(42501|HC0[A-Z0-9]{2})'`, and because the gate-fn filter
  at `:153` uses the same anchor, doors whose authz raises are only those are structurally absent
  from the 171, not merely unmutatable. The LGPD Art. 18 DSR lane is the affected surface
  (`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`).

**Next task (as of the handoff; current version in the hub § Next):** write the keystones first —
cheapest, converts known BLIND findings into pinned tests; each needs an allow leg (a successful
call), not just a deny-only `throws_ok`, and the matching `authz-neverclled-door-allowlist.txt`
line is deleted in the same commit. Target the clusters, not the list — blindness is not uniform
(correction workflow 4 of 5 BLIND, interview 6 of 9, referral 3 of 16). Then, in cost order: apply
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
