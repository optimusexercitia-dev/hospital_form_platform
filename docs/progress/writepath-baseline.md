# WRITEPATH-BASELINE — progress record

Write-arm baseline: pre-AE5 remediation Batch 3. The unit's **summary** is its hub,
[docs/features/writepath-baseline.md](../features/writepath-baseline.md) § Current state; this file
is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/p0-authz-writepath-audit.sh` (the write arm: its domain lifted
at run time as every `pg_policy` row with `polcmd <> 'r'`, its accounting, its exit paths, its
crash safety), the committed baseline `docs/reviews/authz-writepath-audit-findings.md` (re-earned
through `scripts/lib/merge-findings-baseline.sh`), and the deriver `scripts/door-sweep-cases.sh`
only as the thing that prints the write-arm command. Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (a green arm bounds its own
domain), [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) (a subset run writes to
scratch), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) §4
(selection is the success criterion), [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md) (the
in-flight sentinel and `RESET_EVERY`), [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
(the merge), [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(D8: the reset design ported into the door arm; NOTICED as evidence). ADR **0192** is reserved
for this unit (plan §3, Batch 4 note 4).

## Session log

### 2026-09-07 — unit opened (lead)

**Why now.** Batch 3 of the pre-AE5 batches ruled 2026-09-04. Every AE5 re-key is a write-policy
re-key, and the write arm's committed baseline holds verdicts for 37 of the 107 policies its
widened domain selects; a `FROMFINDINGS=1` arm compares against committed rows and cannot see an
absent one, so 70 policies pass it vacuously. Batches 0–2 made this run safe and its merge
proven: the crash sentinel (Batch 0), the merge that preserves hand-authored material (Batch 1),
and the door arm's full run through that merge with the tail-drift lesson (Batch 2). This is the
**first** full write-arm run through the merge.

**Scope.** Three follow-ups (hub § Acceptance criteria). Explicitly NOT: any change to a
production function, policy or migration (Batch 4 owns re-keys, on another machine); the
`FROMFINDINGS=1 ARM=policy` red (unreadable until its own FUP lands; ⛔ never allowlist its
twelve); Tier 2's 190 doors (deferred by ADR 0171, **not** cleared).
⚠ **AMENDED 2026-09-08 (QA B2): twelve PLUS FIVE** — this unit's baseline adds 5 off-allowlist
BLINDs to that arm's offender set (0 → 5; named in the 2026-09-08 QA-fix § Session log entry).
⛔ Still never allowlisted, and the 5 is derived from committed artifacts, not observed from a run.

**Facts at open** (from the follow-up bodies and the tree; every figure to be re-measured by the
builder on a fresh reset — the catalog has moved since each was filed):
- Domain, as filed 2026-09-02 (`d2069603`): `pg_policy` rows with `polcmd <> 'r'`, every schema,
  lifted at run time — 107 = 62 `ALL` + 17 INSERT + 17 UPDATE + 11 DELETE. An `ALL` policy opens
  its `with check` half alone. A full run was measured at ~50 min for 120 cases **before** any
  reset design; the plan budgets ~13 h with `RESET_EVERY`, which is a guess to be re-derived.
- The committed findings file is 137 lines, 37 verdict rows (33 with hand-merged annotations,
  4 AE4.9 D6 rows that are `snapshot:ABSENT`). Hand material the merge must preserve: 2 `## Note`
  sections, 1 blockquote region, ~9 annotated rows, a `---`. All of it will land in CARRIED.
- `p0-authz-writepath-audit.sh` has **0** `RESET_EVERY` hits; `p0-authz-door-audit.sh` has 33.
  The reset design is owed here first, proven as Batch 2 proved it (record § 2026-09-06 retrofit).
- The three `storage.objects` INSERT policies hold no verdict from any arm, ever.
- `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` § REPAIR 2026-08-29 claims all four exit paths proven and
  kill safety in both harnesses; Part 3's domain half was fixed 2026-09-02. What the plan still
  names: exit over an EMPTY case set, the nine Part-3 policies against the widened domain, and
  crash behaviour re-verified on this harness after Batch 0.
- Batch 4 runs in parallel on a separate machine; merge order is Batch 3 first; ADR 0192 is ours.

**Branch:** `authz-writepath-baseline` off `main` @ `23ec1fa5`.

---

### 2026-09-07 — `backend`, BUILD turn. Harness built and proven; **STOPPED at the pre-launch checklist; the run was NOT launched**

⛔ **The headline: ruling R11's premise is refuted by measurement, so pre-launch item 2 cannot pass,
and R12 forbids launching on a failed item.** Every other checklist item is green.

**Stack discrimination (stated every time it matters).** Two local stacks are up. Ours is
`supabase_db_azkbbhskturikxpgmafq`, discriminated by the `authz` schema: `authz_schema=1,
policies=283` against `supabase_db_escalume`'s `authz_schema=0, policies=43`. Every measurement
below was taken against the first.

#### Corrections to the facts filed at open (dated notes; the originals stand)

| filed above | measured 2026-09-07 |
|---|---|
| "37 verdict rows (33 annotated + 4 AE4.9 D6)" | **51** verdict rows — 39 policy (34 COVERED + 3 BLIND + 2 ERROR) + 12 guard; 6 are `snapshot:ABSENT`. Agrees with the file's own `## Note` at `:24`. |
| coverage "33 of 107" / "37" | **39 of 107** policies and — a gap nobody had stated — **12 of 13** guards: `public.set_primary_subject(uuid)` is in `GUARD_KEYS` and has NEVER been verdicted. **Total coverage is 51 of 120 cases.** |
| "~9 annotated rows" | **11**. The 9 came from a decorative-token pattern (⭐ ⚠ ⛔ `**` `[merged`); rows `:60` and `:61` carry hand prose in plain English and the pattern cannot see them. ⭐ This reproduces the merge library's own doctrine on its own file: a warning whose number comes from a filter is only as true as the filter. |
| "the write arm exits 0 over an empty case set" | Two states share that name and behave **oppositely** — see the R1/R13 note below. |
| "~13 h with `RESET_EVERY`" | **≈ 3.6–5.0 h**, derived below rather than quoted. |
| "the three `storage.objects` policies cannot be opened as `postgres`" | **False.** All three sweep and verdict COVERED as plain `postgres`. |

#### What was built — `supabase/tests/mutation/p0-authz-writepath-audit.sh`, the only file changed

1. **`CASES` set-ness.** `CASES_EXPLICIT` captured *before* the `${CASES:-}` default; `want()` and
   the `$FINDINGS` placement both keyed on set-ness; placement extracted into `set_placement()` so
   the self-test EXERCISES the rule instead of restating it; a `SELECTION-SOURCE` line names which
   of the three states a run is in.
2. **`RESET_EVERY` port** — the file had **0** occurrences. `resets_enabled()` as one predicate read
   by all three sites; `periodic_reset()` with the in-flight interlock FIRST; `cd "$ROOT"` and
   `</dev/null` both load-bearing; a post-reset degenerate preflight; worklist re-derivation to
   `.reset`; baseline re-capture; a retry-once net; a `preconditions: resets=N` summary line.
   ⛔ **The door's design is not portable as-is**, and the three adaptations are recorded in the
   file: the drift key here is `ERROR`, not the door's `NOTICED`; there is no `derive_worklists()`
   (one catalog worklist plus a STATIC `GUARD_KEYS`, so the Arm-1 half needs its own post-reset
   OID-resolution check, which the door's design does not cover at all); and there is no
   `degenerate_gates()` — the discriminator here is a degenerate **NON-SELECT policy**, enumerated,
   never counted, because a bare count reads ~11 on a clean stack.
3. **Owner-aware connection role** — see the refutation below.
4. **A `SELFTEST` arm.** The file had none (the door has 16 hits). Three tables: `classify()`'s
   verdict *and* the `SHAPE_MOVED` flag the retry net reads; `resets_enabled()` polarity; the
   `CASES` selection and placement.
5. **The DRYRUN banner's count derived** from `GUARD_KEYS`. It printed a hardcoded `7` while the
   list held 13 and the loop beneath it iterated all 13. Observed after: `ARM 1: 13 authz raise-guards`.
6. `run_suite`'s "~23s" comment corrected to the measured ~93 s — it is the source of the
   downstream "~50 min for 120 cases" budget, wrong by four times.

#### ⛔ THE REFUTATION — R11's ownership predicate is not the property

R11 approved a superuser escalation because three `storage.objects` INSERT policies were predicted
to land `ERROR — must be owner of table objects`. The catalog **agrees with the premise**:

    storage.objects | owner=supabase_storage_admin | pg_has_role('postgres',relowner,'USAGE')=false
    rolsuper(postgres)=false | rolsuper(supabase_admin)=true | is_superuser=off
    postgres member_of: pg_read_all_data, pg_monitor, pg_signal_backend, pg_create_subscription,
                        authenticated, anon, service_role, supabase_privileged_role, authenticator,
                        supabase_functions_admin      -- supabase_storage_admin is NOT among them

**And the `ALTER POLICY` succeeds anyway.** The harness **at HEAD**, unmodified, swept all three
end to end as plain `postgres`:

    ARM-DOMAIN guard=0/13 policy=3/107 · baseline OK: Result: PASS, Files=262, Tests=8876
      COVERED  objects.documents_phi_obj_insert_reserved
      COVERED  objects.documents_std_obj_insert_reserved
      COVERED  objects.form_assets_insert_staff_admin
    SWEPT: 3   COVERED: 3   BLIND: 0   ERROR(harness): 0   SKIPPED(vacuous): 0
    === RESULT: CLEAN — 3 gate(s) measured, all COVERED. ===          bare rc 0

All three predicates restored byte-exact; `degenerate_NON_SELECT = 0`; no sentinel; committed
baseline cksum unchanged at `1903941766 13882`.

**The mechanism, named rather than left as "it works somehow": `supautils`.** This stack sets
`supautils.policy_grants = {"postgres":[… "storage.objects", "storage.buckets", "auth.users" …]}`,
and the extension's utility hook grants POLICY DDL on Supabase-managed tables to the privileged
role entirely outside `pg_class.relowner`. `pg_has_role(role, relowner, 'USAGE')` is therefore a
**proxy** for a permission this server grants by another route — a predicate quoted at the wrong
grain, and the same shape as *text is not truth: resolve the VALUE, not the noun*.

⚠ Two of my own predictions died with it: that the three would land ERROR (they land COVERED), and
that `BLIND ×3` was plausible because pgTAP `325` is a by-name pin. It is — but `143_capa`,
`312_printed_documents`, `328_dm1_document_substrate` and `330_dm3_controlled_documents` all assert
*through* these policies.

**What was built instead.** The predicate is now the disjunction, both halves read live from the
server per case: *(a)* the role has privs of `pg_class.relowner`, **OR** *(b)* `nsp.tbl` appears in
`supautils.policy_grants` for that role. Still an evaluated predicate — never a schema name, never
a list of policy names. Under it, **0 of 107** in-domain policies require the escalated role, and
the run's DOMAIN-STATEMENT prints that zero instead of implying the branch was used:

    DOMAIN-STATEMENT connection roles: ordinary=postgres; owner-capable fallback=supabase_admin (a SUPERUSER on this stack).
        3 of 107 in-domain policies sit on tables postgres does NOT own —
        ⇒ 0 of 107 actually REQUIRE the escalated role.
        ⛔ ZERO. The escalation branch is present and UNEXERCISED on this stack …

and the verdict ROW carries the role and its route, not just the banner:
`… [role=postgres via supautils.policy_grants (owner=supabase_storage_admin)]`.

⇒ **R11.2's second half — "a storage policy observed opening as the escalated role" — is
unsatisfiable.** No case requires it, and manufacturing one would be building a test to fit what I
built. R11.3's "prove recovery on a storage policy" is satisfiable only at `postgres`, which is the
role the predicate actually chooses. Filed as `FUP-WRITEPATH-BASELINE-ESCALATED-ROLE-ARM-UNEXERCISED`.
The sentinel/`RECOVER=1` role plumbing R11.3 asked for is **built regardless**: `$SENTINEL.role`
travels with the sentinel and `RECOVER=1` restores with it, saying so out loud when a sentinel
predates the protocol.

#### Proofs — every exit code read BARE: never through a pipe, never consumed by a `;` chain

| # | proof | observed |
|---|---|---|
| P1 | fixed harness, `CASES=""` EXPLICIT | `guard=0/13 policy=0/107`, `RESULT: UNPROVEN`, bare **rc 3**; baseline cksum unchanged |
| NC | **pre-change predicates**, same `CASES=""` (DRYRUN, decision only) | `FULL SWEEP — this run MERGES into the committed baseline`, `guard=13/13 policy=107/107`, bare **rc 0** — the R13 defect, reproduced |
| DH | fixed harness, `CASES` **unset** (opposite polarity) | still a full run, `guard=13/13 policy=107/107`, bare rc 0 |
| P3 | HEAD harness, the three storage policies | 3/3 COVERED, bare **rc 0** |
| P4 | **current** harness, one storage policy, end to end | COVERED, bare **rc 0**, role and route on the row, `preconditions: resets=0 (… SUPPRESSED: the DEFAULT never fires on a SUBSET run)` |
| P5 | **planted**: the open statement names a policy that does not exist | `SWEPT: 2 COVERED: 0 ERROR: 2`, `RESULT: DIRTY`, bare **rc 1** — R1's all-ERROR half, proven live |

**Self-tests came back 16/16 and 17/17 — and green on a first run is a FINDING, so each table was
shown able to FAIL before its green was believed.**

- SELFTEST against the **pre-change** `want()`/placement predicates → trial C `NOT OK … selects=yes
  writes=committed`, bare **rc 1**.
- One flipped expectation per table → `NOT OK`, bare **rc 1** each.
- The RESET trials pointed at the **pre-port** harness → the extractor REFUSES (`extraction of
  resets_enabled found 0 line(s)`), bare **rc 2**: it cannot fabricate what is not there.
- The RESET trials against a copy with the **in-flight interlock removed** → trial D `NOT OK …
  reset=yes rc=0`, bare **rc 1**. Trial D measures the interlock, not a coincidence.
- ⚠ **One control injected NOTHING and still reported green** (`cmp` rc 0, "0 failed") — the
  *a mutation that did not fully apply reports GREEN* shape, caught only because every injector is
  `cmp`-verified before its result is read. Re-injected properly; it then reddened.
- ⛔ Batch 2's trial G was a false pass from a quoting error, so all **six** abort trials now print
  the reason they aborted, and the six reasons are **distinct**: interlock · reset failed ·
  degenerate after reset · worklist moved · **GUARD_KEYS no longer resolves** · suite RED after reset.

⚠ **Instrument fault, recorded rather than quietly fixed.** The first attempt at P2 ran a scratch
copy whose `ROOT` is derived from `${BASH_SOURCE[0]}`, so `supabase test db` ran in the scratchpad
and the run died at `baseline is NOT green (Result: <none>)`. A wrong instrument read exactly like
a live defect — and like a *different* one. Every scratch copy now pins `ROOT`, and each copy's
`diff` against its source is shown to be exactly the intended injection and nothing else.

#### R5(a) — `$BASELINE_SNAPSHOT` is taken ONCE, proven by selection AND by outcome

- **Selection**: the only two write sites are lines 326 and 328, both at top level (between
  `set_placement`'s end at 290 and `baseline_sum`'s start at 332). The per-case path
  (`emit_report` 1690–1709, `record` 1711–1714) only READS it.
- **Outcome**: after a three-case run the snapshot's mtime is `18:33:43` and the generated report's
  is `18:40:09` — 6 m 26 s apart. Taken before case 1, never re-taken.

#### R14 — 9 vs 11 settled by test. **Delta 0.**

Ran the merge classifier — a scratch copy whose ONLY diff is three `cp` lines, shown by `diff` —
over the committed baseline and a REAL generated file, emitting its actual protected set:
`PRESERVED 51 hand-authored prose line(s), 0 hand suffix(es); CARRIED 51 whole row(s)`.
All **11** reader-visible hand-annotated rows are in `carried_rows` **and** survive into the merged
output, verbatim; all four prose blocks (2 `## Note`, the `HAND-MERGED` blockquote, the bare `---`)
are in the protected prose set. ⇒ the reader inventory of **11 is right**; the pattern-derived **9
was wrong by two** (`:60` `set_commission_oversight`, `:61` `create_external_participant`, whose
notes carry no decorative token); nothing a human authored is unprotected.

⭐ A bonus that AMENDS R10.4: the merge **replaces** two stale statistics rather than stranding
them — `Arm 1 guards: 7` and `Baseline: Files=156, Tests=4796` are both classified as regenerated
statistics and re-emitted correctly. They need no hand edit and must not get one.
⚠ Every census was proven able to find a known sentence before any zero was believed (R17);
`grep -rn` only, never `-i` combined with `-F`/`-f`.

#### Duration, derived rather than quoted (R7)

Measured on this stack today: `supabase test db` **87 s** (Files=262, Tests=8876, PASS) ·
`supabase db reset --local` **63 s** · the merge **3 s** · a full CASE **~96 s** (P3: 386 s for
startup + baseline + 3 cases), so **~99 s** with the merge a full run adds.
`120 × 99 s = 3.30 h` + `5 scheduled resets × (63 + 87 + ~15 s) = 14 min` + retries at the door
run's observed 6.5 % (≈ 8 × 264 s = 35 min) ⇒ **≈ 4.1 h; window ≈ 3.6–5.0 h.**

#### Gate-relevant state at the stop

`npm run lint` bare **rc 0** (eslint `--max-warnings=0`; registers OK) · `npm run typecheck` bare
**rc 0** · `npm run test:db` bare **rc 0** on a **fresh** `supabase db reset --local`, shape
**unmoved** at Files=262, Tests=8876 · `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` **EMPTY** · `git status --porcelain` shows only the harness ·
`degenerate_NON_SELECT = 0` · no sentinel at any path · committed baseline `1903941766 13882`,
byte-identical to the start of the turn.
⛔ Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT cleared**.
⛔ `FROMFINDINGS=1 ARM=policy` is RED pre-existing, is **not** one of CLAUDE.md §6's four arms, and
its twelve are not allowlisted.
⚠ **AMENDED 2026-09-08 beside the original (QA finding B2): after this unit it is twelve PLUS FIVE.**
The sentence above stays because it was true when written; it is no longer complete. This unit's
baseline takes the write arm's ARM-1 offender set from **0** off-allowlist BLINDs to **5**, named in
the § Session log entry of 2026-09-08 (QA fix loop) and in
`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES`. ⛔ **Zero allowlist entries were
added** — `authz-blind-allowlist.txt` is byte-identical to `main`. The 5 is **derived from the
committed artifacts** with the harness's own extractors, **not observed from an arm run**.

#### Follow-ups filed this turn

`FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` (names both arms; fixed in the write arm, filed
against the door arm) · `FUP-WRITEPATH-BASELINE-HARDCODED-COUNTS-IN-HARNESS-BANNERS` (the class across five
harnesses) · `FUP-WRITEPATH-BASELINE-REGISTER-CLOSES-WHEN-TRUNCATED` (R21 — check for a length gate before
restoring) · `FUP-WRITEPATH-BASELINE-ESCALATED-ROLE-ARM-UNEXERCISED`.

#### Not done, and why

- **The full run was NOT launched.** R12: a failed pre-launch item means stop and report.
- **ADR 0192 is not written.** Three of its four subjects are settled — the `CASES` fix, the
  `RESET_EVERY` port and why the door's design was not portable as-is, and the recovery step. The
  fourth, the connection role, is exactly what the open ruling decides, and an ADR recording a
  decision nobody has taken would have to be rewritten. It is blocked on the ruling, not deferred
  behind the run.
- The recovery step's prose goes into the harness header and ADR 0192 **before** any launch.
  ⚠ **It cannot go into `.claude/rules/mutation-harnesses-are-not-killable.md`** as the plan §9
  assumed: that file is **2032 of its 2048-byte cap**, 16 bytes of headroom, and compressing a
  record to fit a cap selects against its QUALIFIERS — the bound gets cut, not the fact. Measured
  instead: the rule **already** carries the generic recovery step and already names this harness
  (*"A kill is CAUGHT — only where a harness has a SENTINEL: C2 + `p0-authz-{door,writepath}-audit.sh`"*),
  already forbids deleting the sentinel, already demands catalog verification with the
  `cmd <> 'SELECT'` discriminator, and already carries the working-tree/suite-shape clause
  (*"DB silence is the wrong ask … Freeze the TREE"*). The only write-arm-specific addition owed is
  `git checkout -- docs/reviews/authz-writepath-audit-findings.md`, and its home is the harness
  header plus ADR 0192.

#### R20 — the 13 rows Batch 2 retired from the door arm, PRE-checked by name

⚠ **First finding: the door record NAMES none of them.** `pred-domain.md:1616` records
`RETIRE to p0-authz-writepath-audit.sh | 13 | 0` as a COUNT, and a retirement recorded as a count
cannot be checked name-by-name — which is precisely what R20 asks for. The names were recovered
from the deletion itself (`git show b59d4bbf -- docs/reviews/authz-door-audit-findings.md`, 279
deleted verdict rows, of which **13** name a non-SELECT policy — matching the recorded count; the
census control finds 107 `(SELECT)` rows with the same filter, so the filter can match).

All **13 are PRESENT in the write arm's live domain today, each at the command the door row
recorded** (`ABSENT_TOTAL=0` against the 107-row live lift):

`case_interviews_{insert,update,delete}` · `case_referral_{insert_source_coord,update_coord,delete_draft_source}` ·
`meeting_cases_staff_admin_{insert,update,delete}` · `meeting_signatures_insert` ·
`profiles_update_self` · `signoffs_insert` · `responses_delete_own_draft`.

⇒ The retirement's destination WILL receive all thirteen. The domain axis is clear; the verdict
axis is what the run settles, and R20's final check is that each appears in the run's output.

#### The MID-RUN CHECKPOINT SCHEDULE (R8), written down BEFORE any launch

⛔ The drift observable is computed from `$WORK/writepath_progress.tsv`, **never** from the summary:
a drift tail is *cases whose verdict has no originating cause*, and a summary cannot show that.
⛔ And `docs/reviews/authz-writepath-audit-findings.md` is a MOVING TARGET while the run is live
(`emit_report` rewrites it after every case) — no agent may read it as truth mid-run. Cite
`$WORK/authz-writepath-audit-findings.baseline.md` instead.

| when | what is sampled | the observable that says VOID IT NOW |
|---|---|---|
| at the banner, before case 1 | `SELECTION-SOURCE`, `ARM-DOMAIN guard=13/13 policy=107/107`, `DOMAIN-SOURCE … live catalog … 107`, the DOMAIN-STATEMENT role lines, the degenerate preflight, `baseline OK: … Files=262, Tests=8876`, `FULL SWEEP — this run MERGES …` | any of them wrong ⇒ kill NOW: before case 1 there is nothing to contaminate |
| case ~5 | the on-disk merged file still holds 2/2 `## Note`, the `HAND-MERGED` blockquote and the `---`; the merge's `PRESERVED … CARRIED …` line is non-zero | `PRESERVED 0`, or a hand block gone ⇒ the merge is losing material |
| case ~12 | elapsed since the `baseline OK` timestamp ÷ cases done | record the corrected rate BESIDE the estimate, never over it |
| continuously, from `progress.tsv` | rows whose `Files=`/`Tests=` shape is off-baseline · distinct off-baseline `Tests=` values · **longest consecutive run of the same off-baseline value** | **≥3 consecutive identical off-baseline shapes.** A per-case abort VARIES and the suite RECOVERS; drift never recovers. With `RESET_EVERY=20` this should be impossible — if it happens the reset did not fire and the run is VOID, not patchable |
| at every `--- PERIODIC RESET ---` | the four lines after it: preflight clean · policy worklist re-derived UNCHANGED · all 13 `GUARD_KEYS` still resolve · post-reset baseline PASS at the true shape | any `*** ABORT` ends the run |
| at the end | `preconditions: resets=N` | **`resets=0` on a 120-case full run is the exact state that voided the door arm's run 1.** Quote this line in the gate record beside the counts |

---

### 2026-09-07 — `backend`, RULING R23 applied: the escalation REMOVED, the predicate kept as a DETECTOR and proven able to fire; checklist re-earned; **the full run LAUNCHED**

**The headline.** The lead's R11 premise was refuted by measurement last turn; PO ruling R23 drops
the escalation and keeps the corrected predicate as a **detector**. Everything the removal touches
was **re-earned, not carried** — including two proofs that had passed on the escalated harness.

#### What was removed, and why the removal is not just deletion

| removed | why |
|---|---|
| `PSQL_ROLE_ELEVATED` (`supabase_admin`, a superuser) and the whole escalation branch | its premise was false; `postgres` can already do the DDL |
| `psql_c_as` / `psql_f_as` (role-parameterised) | with one role they would carry one caller value forever — a parameter nobody varies |
| `$SENTINEL.role` and the role-aware `RECOVER=1` restore | ⭐ **a field that can only ever hold one value is a guard that can only ever read one value.** It looks like a check and checks nothing — the MAJOR class QA found twice in Batch 0. R11.3 withdrawn with R11 |
| `resolve_open_role()` (a **router**) | replaced by `policy_ddl_detector()` (a **detector**) |

**Kept and re-aimed:** the ownership-**OR**-`supautils.policy_grants` disjunction, both halves read
live per case, each reported **separately** so a failure can name its half. On rc 1 the harness
emits `*** POLICY-DDL BLOCKED — <policy> is UNVERDICTED. NOT swept, NOT a pass, NOT skipped.` to
**both** stdout and stderr (a finding that reaches only stderr is invisible to a caller that
captured stdout), records the policy as an `ERROR` row ⇒ the run exits **DIRTY (1)**, and never
routes, substitutes, skips or allowlists. Each verdict row now carries its grant route.

#### ⭐ The detector fires on 0 of 107, so it was PROVEN able to fire (R23.5)

The plant is a scratch copy whose `diff` against the harness is **exactly two injections and
nothing else** (shown, not asserted): `ROOT` pinned, and both predicate halves forced false for one
table. ⛔ Never the real tree, never the real catalog, never the real GUC.

| half | observed |
|---|---|
| **PLANT (positive)** | `*** POLICY-DDL BLOCKED — public.responses.responses_insert_own is UNVERDICTED` … `ownership=NO (owner=postgres, pg_has_role USAGE false), supautils.policy_grants=NO (public.responses absent from the GUC for 'postgres')` — both halves named — `RESULT: DIRTY`, bare **rc 1** |
| **DISCRIMINATION** (same run, sibling on another table) | `COVERED response_section_signoffs.signoffs_insert`; detector fired on **1 of 2** — it discriminates, it does not blanket-fire |
| **NEGATIVE CONTROL** (real harness, clean tree, same 2 cases) | `POLICY-DDL DETECTOR: 0 of 107 … ⛔ ZERO — the detector is DORMANT`, **0** firings, both COVERED, `RESULT: CLEAN`, bare **rc 0** |

The DOMAIN-STATEMENT's non-zero branch is exercised by the plant too (`4 of 107 policies are
unopenable by BOTH routes` — the four policies on the planted table), so neither branch of that
banner is first executed during the real run.

#### Both grant routes proven live ON A ROW — the disjunction is not half-decorative

Re-earned on the escalation-free harness after a fresh reset:

- `3 [role=postgres via supautils.policy_grants (owner=supabase_storage_admin)]` — the three
  `storage.objects` INSERT policies, **all COVERED**, bare **rc 0**;
- `2 [role=postgres via ownership (owner=postgres)]` — the public policies in the negative control.

⇒ `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN`'s blocker was **predicted, measured and
DISPROVEN**, and the mechanism is named: **`supautils.policy_grants`**. Dated note added to the
register; the item closes when the full run merges the verdicts into the committed baseline.

#### ⚠ A THIRD self-inflicted instrument fault — kept as a witness, per R25

The RESET trial table came back **9 of 17 failed** against the new harness. It read exactly like a
live defect in the port. It was not: I invoked `reset-trials.sh` as `cd $SP/proofs && bash
reset-trials.sh`, so `$(dirname "$0")` was `.` and `$W`/`$CALLS` were **relative** — and the subject
under test does `cd "$ROOT"` inside `periodic_reset`'s subshell, so the stub's recorder appended into
a path that no longer existed. Every "failure" showed the reset firing correctly in its own output.
Re-run with an absolute path: **0 failed, bare rc 0**.

⭐ **A relative path in a test harness becomes a live fault the moment the subject under test
changes directory** — and it fails toward "the control did not fire", the direction that reads as a
defect in the subject. Same family as last turn's `ROOT`-in-the-scratchpad fault: *a wrong
instrument reads exactly like a live defect, and like a different one*.

#### Proofs — every exit code read BARE, never through a pipe, never consumed by a `;` chain

| # | proof | observed |
|---|---|---|
| D1 | plant: detector fires, names both halves | `SWEPT: 2 COVERED: 1 ERROR: 1`, DIRTY, bare **rc 1** |
| D2 | clean-tree negative control | `SWEPT: 2 COVERED: 2 ERROR: 0`, detector `0 of 2`, CLEAN, bare **rc 0** |
| D3 | storage ×3, escalation-free | `SWEPT: 3 COVERED: 3`, CLEAN, bare **rc 0**, all rows `via supautils.policy_grants` |
| R1 | RESET trial table vs the CURRENT harness (absolute paths) | **0 failed**, bare **rc 0** — extractor took `resets_enabled` 4 / `retry_suppressed_note` 7 / `periodic_reset` 84 / `maybe_periodic_reset` 5 lines and `bash -n` rc 0 |
| R2 | control: interlock REMOVED from the **current** harness (`diff` = only that) | trial D `NOT OK … reset=yes rc=0`, bare **rc 1**, and **only 1** of 17 failed — the table discriminates |
| R3 | control: ONE flipped expectation (S3) | `NOT OK S3`, bare **rc 1**, 1 of 17 |
| V1 | `RECOVER=1` on a **storage** policy, no `.role` sidecar | `restoring as role postgres (this harness has exactly one connection role)` · `*** RESTORE APPLIED and VERIFIED against the catalog` · md5 back to `fcaa80aa…` · sentinel moved to `.recovered` · `degenerate_NON_SELECT = 0` · bare **rc 2** (the by-design RECOVER exit) |
| V2 | discrimination: same restore, **corrupted `.want`** | `*** RESTORE FAILED` · **sentinel KEPT** · catalog still correct · bare **rc 2** ⇒ the "VERIFIED" in V1 is load-bearing, not decoration |
| P1 | `CASES=""` EXPLICIT | `SELECTION-SOURCE: CASES set and EMPTY -> selects NOTHING`, `guard=0/13 policy=0/107`, `RESULT: UNPROVEN`, bare **rc 3** |
| P5 | all-ERROR selection (plant, 1 case) | `SWEPT: 1 COVERED: 0 ERROR: 1`, `RESULT: DIRTY`, bare **rc 1** |
| S1 | `SELFTEST=1` (3 tables) | **16/16 ok, 0 failed**, bare **rc 0**; committed baseline cksum verified unchanged |

#### THE RE-EARNED PRE-LAUNCH CHECKLIST (R12(a) — every item observed BARE)

| item | observed |
|---|---|
| `RESET_EVERY` ported and proven (plant, negative control, discrimination) | ✅ R1/R2/R3 above |
| ~~owner-aware role, both directions + storage recovery~~ → **superseded by R23**: detector proven able to fire + both grant routes exercised on rows + recovery re-earned on a storage policy | ✅ D1/D2/D3 + V1/V2 |
| `CASES=""` no longer degrades to a full run | ✅ P1, bare rc 3 |
| empty-`CASES` at exit 3 · all-ERROR at exit 1 | ✅ P1 rc 3 · P5 rc 1 |
| `$BASELINE_SNAPSHOT` taken **once**, by selection | ✅ one write site, `:365`, **top level**; `emit_report` (`:1722`) only READS it |
| merge protected set reconciled | ✅ **settled at 11 by R24, delta 0** — the merge library is untouched by this turn; my 9 was wrong by two because `:60`/`:61` carry **undecorated hand prose**. ⭐ *a pattern that counts hand-authorship by decoration cannot see undecorated hand prose* |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | ✅ **EMPTY** (full diff vs `main`: the harness + 3 docs only) |
| `npm run lint` 0/0 bare · `npm run test:db` on a **fresh reset** | ✅ lint bare **rc 0** · typecheck bare **rc 0** · `db reset` bare rc 0 then `test:db` bare **rc 0**, shape **UNMOVED** at `Files=262, Tests=8876, Result: PASS` |
| derived duration + mid-run checkpoint schedule written down | ✅ below |

#### Duration — re-derived from a TWO-POINT measurement, not an assumed intercept (R7)

Measured today on this stack, after a fresh reset: **1-case run = 183 s**, **3-case run = 365 s**.

    slope     = (365 - 183) / (3 - 1)          = 91 s per case
    intercept = 183 - 91                       = 92 s  (startup + domain lift + preflight + baseline
                                                        suite; the suite alone measured 85 s, so ~7 s
                                                        of startup — self-consistent)
    cases     = 120 x 91 s                     = 10 920 s = 3.03 h
    resets    = 5 x (62 + 85 + ~10) s          =    785 s = 13 min   (RESET_EVERY=20 fires at
                                                                      DONE = 21/41/61/81/101)
    retries   = 8 x (157 + 91) s               =  1 984 s = 33 min   (door run's observed 6.5 %)
    TOTAL     = 10 920 + 92 + 785 + 1 984      = 13 781 s ≈ 3.8 h

**Window ≈ 3.2–4.6 h** (3.2 h with no retries; 4.6 h at double the observed retry rate).

**`RESET_EVERY=20` defended in one sentence:** 5 resets cost 13 min — **5.7 %** of the run — and cap
a drift tail at 20 cases (17 % of the run) instead of the 78 that voided the door arm's run 1;
`RESET_EVERY=10` would cap it at 10 for +2.7 % duration, which is not worth re-tuning a ported
default that Batch 2 already proved at 20.

---

### ⛔ THE RESUME NOTE — this run OUTLIVES the agent that launched it

**Launched** 2026-09-07 20:11 -0300 (attempt **2**), detached via PowerShell `Start-Process` on
`C:\Program Files\Git\usr\bin\bash.exe` with **`MSYSTEM=MINGW64`** set and the arguments
`-l` + the script as **argv[1]** (the `-c` form silently starts nothing here; `nohup setsid` does
not exist).

#### ⚠ LAUNCH ATTEMPT 1 ABORTED — a FOURTH instrument fault, and the most operationally dangerous

Attempt 1 (20:09) ran the same `bash.exe` **without `MSYSTEM=MINGW64`**. That is a *different
environment*: the D: drive resolves at `/mnt/d` instead of `/d`, `date` returns empty, and `docker`
is not on PATH. The domain lift therefore returned `rows=0` and the harness **aborted at bare exit
2**, printing `*** ABORT — could not lift ARM 2's domain from the live catalog` and, in terms, its
reason for having no fallback:

> ⛔ There is deliberately NO fallback to the embedded snapshot here. That snapshot is 33 of the 107
> policies that can permit a write, and running against it would print a confident number about a
> third of the domain.

⭐ **That refusal is the whole ADR-0079 design working.** A harness with a fallback would have swept
33 of 107 in the wrong environment and reported a number. Nothing was opened, no sentinel was armed,
and the committed baseline stayed byte-identical at `1903941766 13882`.

⭐ **The lesson, which is not about this harness:** a detached launch runs in a shell you did not
inspect. `which bash` and `cygpath` both named `C:\Program Files\Git\usr\bin\bash.exe` — the *same
binary* — and it still produced a different environment, because the environment is `MSYSTEM`, not
the path. **A wrong instrument reads exactly like a live defect** (fourth time in this unit), and a
detached one reads like it for hours.

**Fixed, and the fix is proven able to refuse.** The launcher now runs an environment preflight
before it will start the harness at all: `uname -s` must be `MINGW64*`, `/d` must resolve, `/mnt/d`
must **not**, `date(1)` must produce output, `pwd` after `cd` must equal the repo root, `docker` must
see `supabase_db_azkbbhskturikxpgmafq`, the non-SELECT policy count must be > 0, **and the `authz`
schema must be present** (the stack discriminator — the other stack, `supabase_db_escalume`, has
`authz_schema=0`). Proven by re-running the launcher in exactly attempt 1's wrong shell:
`*** LAUNCH REFUSED: wrong shell — uname -s = …, expected MINGW64*`, bare **rc 98**, and the harness
**never started**. The good-shell control then passed the preflight and started the run.

| what | where |
|---|---|
| launcher | `C:\Users\micha\AppData\Local\Temp\authz-b3-launch.sh` (= `/tmp/authz-b3-launch.sh`) |
| command | `WORK=/tmp/authz-b3-full bash supabase/tests/mutation/p0-authz-writepath-audit.sh`, **`CASES` UNSET** (unset = FULL run = merges the committed baseline; `CASES=""` would exit 3) |
| WORK dir | `/tmp/authz-b3-full` = `C:\Users\micha\AppData\Local\Temp\authz-b3-full` |
| log | `/tmp/authz-b3-run.log` |
| bare rc | `/tmp/authz-b3-rc.txt` — **written before anything can consume it**; absent = still running |
| sentinel | `/tmp/authz-writepath-INFLIGHT.sql` — the **DEFAULT** path, deliberately: the default is what the NEXT run checks, so a crash is found by whoever runs next |
| progress TSV | `/tmp/authz-b3-full/writepath_progress.tsv` — **the drift observable, never the summary** |
| baseline snapshot | `/tmp/authz-b3-full/authz-writepath-audit-findings.baseline.md` |
| expected finish | ≈ **00:00 -0300**; window **23:25 – 00:45** |

⛔ **`docs/reviews/authz-writepath-audit-findings.md` is a MOVING TARGET while the run is live** —
`emit_report()` rewrites it after every case. No agent may read it as truth mid-run; cite the
baseline snapshot above instead.
⛔ **FREEZE THE WORKING TREE.** The baseline is the suite's SHAPE, so adding one file under
`supabase/tests/` invalidates the run as effectively as touching the DB. ⛔ Never edit the harness
while a run executes it.

**RECOVERY, if it dies anyway** (full six steps in the harness header):

1. `ls -l /tmp/authz-writepath-INFLIGHT.sql` — non-empty means a gate is OPEN right now. ⛔ **Never
   delete the sentinel.**
2. `RECOVER=1 WORK=/tmp/authz-b3-full bash supabase/tests/mutation/p0-authz-writepath-audit.sh`
   (there is no role to choose — one connection role, ADR 0192).
3. ⛔ VERIFY IN THE CATALOG, never from the message — `pg_policies` where `qual`/`with_check` is
   `'true'` **and `cmd <> 'SELECT'`** must return **ZERO ROWS**. ENUMERATE; a bare count reads ~11.
4. If the restore refuses: `supabase db reset --local` **from the repo root** (the `cd` is
   load-bearing — a second stack, `supabase_db_escalume`, is up on this machine).
5. ⛔ **The committed baseline may be half-rewritten:**
   `git checkout -- docs/reviews/authz-writepath-audit-findings.md`
6. ⛔ The killed run's verdicts are **discarded** — `writepath_progress.tsv` is never merged.

**MID-RUN CHECKPOINT SCHEDULE** — as written before the previous launch, plus one row for the
detector. The drift observable is computed from the **progress TSV**, never the summary: a drift
tail is *cases whose verdict has no originating cause*, and a summary cannot show that.

| when | sampled | the observable that says VOID IT NOW |
|---|---|---|
| at the banner, before case 1 | `SELECTION-SOURCE`, `ARM-DOMAIN guard=13/13 policy=107/107`, `DOMAIN-SOURCE … live catalog … 107`, `POLICY-DDL DETECTOR: 0 of 107`, degenerate preflight, `baseline OK: … Files=262, Tests=8876`, `FULL SWEEP — this run MERGES …` | any of them wrong ⇒ kill NOW: before case 1 there is nothing to contaminate |
| **new** — continuously | any `*** POLICY-DDL BLOCKED` line | the detector firing in a real run is a **finding**, not a void: record the policy as unverdicted and let the run finish |
| case ~5 | the merged file still holds 2/2 `## Note`, the `HAND-MERGED` blockquote and the `---`; the merge's `PRESERVED … CARRIED …` line is non-zero | `PRESERVED 0`, or a hand block gone ⇒ the merge is losing material |

⚠ **Reading trap found AT the case-5 checkpoint, recorded before it can mislead the final report:
the merge banner's `— N row line(s)` is NOT the verdict count.** At 5 verdicts it printed `7 row
line(s)`; the generated file's `^|` lines were **9** = 5 verdict rows + 2 table headers + 2
separators. The counts reconcile, the merge is behaving correctly, and nothing here is a defect —
but a reader taking `N row lines` for coverage over-reports by the table's own furniture. **The
verdict count is `wc -l` of `writepath_progress.tsv`, and nothing else.** Same family as R6's
hardcoded DRYRUN banner: *a count in banner text is an assertion about something, and not
necessarily about what the reader thinks.*
| case ~12 | elapsed since `baseline OK` ÷ cases done, against **91 s/case** | record the corrected rate BESIDE the estimate, never over it |
| continuously, from `progress.tsv` | rows off the baseline shape · distinct off-baseline `Tests=` values · **longest consecutive run of the same off-baseline value** | **≥3 consecutive identical off-baseline shapes.** A per-case abort VARIES and the suite RECOVERS; drift never recovers. With `RESET_EVERY=20` this should be impossible — if it happens the reset did not fire and the run is VOID, not patchable |
| at every `--- PERIODIC RESET ---` | preflight clean · policy worklist re-derived UNCHANGED · all 13 `GUARD_KEYS` still resolve · post-reset baseline PASS at the true shape | any `*** ABORT` ends the run |
| at the end | `preconditions: resets=N` | **`resets=0` on a 120-case full run is the exact state that voided the door arm's run 1.** Quote this line in the gate record |

#### Mid-run checkpoints AS OBSERVED (filled in as the run proceeds)

| checkpoint | observed |
|---|---|
| banner, before case 1 | ✅ all of it: `SELECTION-SOURCE: CASES UNSET -> FULL run` · `Repo: /d/Development/…` (attempt 1 had `/mnt/d`) · `ARM-DOMAIN guard=13/13 policy=107/107` · `DOMAIN-SOURCE policy arm: live catalog (pg_policy, polcmd <> 'r') — 107` · `POLICY-DDL DETECTOR: 0 of 107 … ⛔ ZERO — DORMANT` · degenerate preflight `clean — 0` · `baseline OK: Result: PASS, Files=262, Tests=8876` · `FULL SWEEP — this run MERGES into the committed baseline` |
| case ~5 | ✅ `PRESERVED 51 hand-authored prose line(s), 0 hand suffix(es)` on **every** merge — exactly the R14 number, stable; `CARRIED` falling (50 → 49 → 48) as verdicts replace carried rows, which is the merge working; the merged file holds 2/2 `## Note`, the `HAND-MERGED` blockquote and the bare `---`; two identical reads ⇒ not a partial read |
| case ~12 (rate) | ⚠ **measured 100 s/case against the estimated 91** — recorded BESIDE the estimate, never over it. Revised: 92 s + 120×100 s + 13 min resets + ~33 min retries ≈ **4.1 h**, finish ≈ 00:15 -0300 — still inside the stated 3.2–4.6 h window. 12/12 guard rows, all COVERED |

#### Recorded per R24/R25, settled without further work

- **R14 settled at 11, delta 0.** ⭐ *A pattern that counts hand-authorship by decoration cannot see
  undecorated hand prose* — `:60`/`:61` carry plain-English hand commentary with no ⭐/⚠/⛔/`**`/
  `[merged` token, so the token-keyed count returned 9. The reader inventory of 11 stands.
- **Line 13's stale tail** (`Arm 2 write policies: from the embedded snapshot.`) → **DELETE** in the
  CARRIED disposition: the domain is lifted live, so the sentence is now factually false. This
  **amends R10.4**, which was half right — the merge *replaces* `Arm 1 guards: 7` (a regenerated
  statistic) but *preserves* line 13 (prose it cannot match).
- **R20 method:** ⚠ **a count is not an identity.** `pred-domain.md:1616` filed the retirement as
  `RETIRE to p0-authz-writepath-audit.sh | 13 | 0` — a COUNT — so it could not be checked
  name-by-name, which is exactly what R20 asks for. The names were recovered from the deletion
  commit instead. **The door record should have named its 13 rows**; that is a records defect worth
  a line of its own.
- **Both self-inflicted instrument faults from the previous turn are kept in the record as
  witnesses** (the scratch copy's `ROOT` pointing `supabase test db` at the scratchpad; the vacuity
  control that injected nothing yet reported green, caught only by its `cmp` guard). Today's
  relative-path fault joins them. They are more instructive than the passes.
- **The recovery step's home** (harness header, not the 2032/2048-byte rule file) is accepted
  unchanged: compressing a record to fit a cap selects against its qualifiers.

#### Follow-ups this turn

`FUP-WRITEPATH-BASELINE-ESCALATED-ROLE-ARM-UNEXERCISED` — **re-purposed, not withdrawn** (R23): its
original subject (the escalated arm) no longer exists, the **dormancy moves to the detector**, and
the entry says so in terms, because a follow-up silently retargeted is a follow-up nobody can audit.
`FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` — dated note: blocker predicted, measured,
**disproven**, `supautils.policy_grants` named.
`FUP-WRITEPATH-BASELINE-REFUSED-RESTORE-ASSERTS-A-STATE-IT-DID-NOT-MEASURE` — **new**, found by V2:
a restore whose verification fails prints *"The gate is STILL OPEN"*, a catalog claim that path never
established (V2's catalog was correct). Safe direction, but it states a fact it did not read.

**ADR 0192** written and indexed (`next free 0193`; back-pointers updated in 0153 and 0189). Its
fourth subject is the transferable one: **ownership is a proxy, not the property; a permission
question is answered by attempting the permission or by reading every grant path, never by reading
`relowner` alone.**

⛔ Standing, unchanged: Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT cleared**.
⛔ `FROMFINDINGS=1 ARM=policy` is RED pre-existing, is **not** one of CLAUDE.md §6's four arms, and
its twelve are not allowlisted.
⚠ **AMENDED 2026-09-08 beside the original (QA finding B2): after this unit it is twelve PLUS FIVE.**
The sentence above stays because it was true when written; it is no longer complete. This unit's
baseline takes the write arm's ARM-1 offender set from **0** off-allowlist BLINDs to **5**, named in
the § Session log entry of 2026-09-08 (QA fix loop) and in
`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES`. ⛔ **Zero allowlist entries were
added** — `authz-blind-allowlist.txt` is byte-identical to `main`. The 5 is **derived from the
committed artifacts** with the harness's own extractors, **not observed from an arm run**.

---

### 2026-09-08 — `backend`, THE FULL RUN COMPLETED. 120 of 120 swept, bare rc 1 (DIRTY)

**20:11:08 → 00:04:08 = 3.88 h.** Derived estimate 3.8 h, stated window 3.2–4.6 h ⇒ **inside the
window, within 2 % of the arithmetic.** The two-point measurement (91 s/case slope, 92 s intercept)
held; the case-12 correction to 100 s/case over-corrected, because the later cases ran faster.

    ARM-DOMAIN guard=13/13 policy=107/107
    SWEPT: 120   COVERED: 102   BLIND: 15   ERROR(harness): 3   SKIPPED(vacuous): 0
    preconditions: resets=8 (RESET_EVERY=20, explicit=0, subset=0 — ENABLED)
    connection role: postgres only (no escalation — ADR 0192). POLICY-DDL detector fired on 0 of 120.
    === RESULT: DIRTY — 15 BLIND, 3 ERROR. ===                             bare rc 1

**Coverage moved 51 of 120 → 120 of 120 measured**, of which **117 carry a verdict** (102 COVERED +
15 BLIND) and 3 are UNVERDICTED. The guard arm is **13 of 13** — `public.set_primary_subject(uuid)`,
the gap R15 found and nobody had stated, came back **COVERED** naming
`314_qob_org_admin_content_wall.sql, 321_eth_e4_participant_seating.sql, 409_ae49_d6_rekey_differential.sql`.

#### The run's own health — the things that voided the door arm's run 1

| observable | measured |
|---|---|
| suite shape per case, all 120 runlogs | **117 at `Files=262, Tests=8876`**; 3 off-baseline, and each off-baseline case **IS** one of the 3 ERRORs — every off-baseline shape has an originating cause |
| longest consecutive OFF-BASELINE run | **1** (threshold for VOID was ≥3). No drift tail |
| `preconditions: resets` | **8** = 5 scheduled (cases 21/41/61/81/101) + 3 retries. ⛔ Not `resets=0`, the exact state that voided the door run |
| every reset's post-conditions | preflight clean · **all 13 `GUARD_KEYS` still resolve** · post-reset baseline `PASS (Files=262, Tests=8876)` · worklist `107 (unchanged)` — on all 8 |
| aborts / contamination / restore failures | **0 / 0 / 0** |
| sentinel after the run · `degenerate_NON_SELECT` | absent · **0** |
| production diff vs `main` | **EMPTY** (`supabase/migrations`, `seed.sql`, `src`) |
| `npm run lint` | bare **rc 0** |

⭐ **The `RESET_EVERY` port earned itself in this run**, and not only on the schedule: the **retry
net** fired 3 times on drift-shaped ERRORs and each retry ran a full reset + fresh baseline before
re-running the case. Without it those three would have been recorded as ERRORs with no way to tell
a crashed test file from a contaminated DB — which is exactly what the retry established.

#### R19 — ERROR triage. All 3 are ONE defect, measured rather than inferred from the family name

All three blame **`supabase/tests/297_process_template_versioning.sql`**, which plans 37 tests and
**exits 3** partway when a `process_template_*` write policy is opened (ran 35 / 36 / 34). Not
drift — each survived a reset with a verified-clean post-reset baseline.
⭐ **A test file that DIES when a gate is opened converts a COVERED into an ERROR**: the suite *did*
notice (assertions failed, naming the file), but the same mutation crashed the file, and a crashed
file is indistinguishable **by shape** from a contaminated database. ⛔ Not recorded as COVERED —
that would infer a verdict the instrument refused to give. Filed as
`FUP-WRITEPATH-BASELINE-297-TEST-FILE-ABORTS-AND-CONVERTS-COVERED-INTO-ERROR`; the 3 policies are
**UNVERDICTED** and block the swept claim for themselves only.
⇒ **Zero drift-tripwire ERRORs and zero POLICY-DDL BLOCKED firings.** The detector stayed dormant in
production exactly as the plant predicted.

#### R20 — the 13 rows Batch 2 retired from the door arm: **13 PRESENT, 0 missing, all COVERED**

`case_interviews_{insert,update,delete}` · `case_referral_{insert_source_coord,update_coord,delete_draft_source}` ·
`meeting_cases_staff_admin_{insert,update,delete}` · `meeting_signatures_insert` · `profiles_update_self` ·
`signoffs_insert` · `responses_delete_own_draft` — each checked **by name** against the run's own
progress TSV. **No verdict was orphaned by the retirement.**
⚠ **A count is not an identity:** `pred-domain.md:1616` filed the retirement as `… | 13 | 0`, a
count, so it could not be checked name-by-name; the names were recovered from the deletion commit
`b59d4bbf`. The door record should have named its 13 rows — a records defect worth its own line.
⚠ The matcher was proven before any "ABSENT" was believed: it finds real rows, reports a genuine
absence, and rejects both a `_decoy` suffix and a truncated prefix.

#### THE CARRIED ENUMERATION — 45 rows, with dispositions

⚠ **I nearly published "CARRIED: none."** My first enumeration anchored on `^|` and found nothing,
while the merge's own line said `CARRIED 45 whole row(s)` — the carried rows are **indented** inside
the block the merge appends. ⭐ *An enumeration boundary is a syntax, not a property* — caught only
because the merge prints its own count and the two disagreed. **Always reconcile an enumeration
against the producer's count.**

| # | class | disposition |
|---|---|---|
| **9** | carried note holds **hand commentary** the regenerated row lacks — the 3 `professional_*` guards and the 6 `form*`/`forms` `*_staff_admin_write` rows | **RE-FILE** the commentary onto the live row, then delete the carried copy |
| **34** | carried note's files are a strict **subset** of the live row's (the live row names the same files **plus** new ones) | **DELETE** — the live row supersedes and says more |
| **2** | `profiles.profiles_admin_update`, `profiles.profiles_update_self` — carried note is `run-shape!=baseline (Files=156 Tests=4788)`, a **stale statistic against a retired baseline**, and both are now genuinely **COVERED** | **DELETE** — keeping them asserts two policies are unverdicted when they are not |
| **0** | carried row naming a file the live row does **not** | — |

That last row is the load-bearing one: **category C is 0**, so deleting the 34 (and the 2) loses no
information. Without it "the live row supersedes" would have been an assumption.

**Verdict transitions across the 45:** `COVERED -> COVERED` 40 · `BLIND -> BLIND` 2 ·
**`BLIND -> COVERED` 1** (`responses.responses_delete_own_draft` — a real improvement) ·
**`ERROR -> COVERED` 2** (the two `profiles` rows above). Nothing regressed.

#### ⭐ The two `11`s are NOT the same 11 — and that is the interesting part

R24 settled the hand-annotated inventory at **11** and recorded that my token-keyed pattern's **9**
was wrong by two. The merge handled them by **two different mechanisms**, which the run made visible:

- **9** carried as whole rows (their hand commentary sits in the note column), and
- **2** preserved as **hand suffixes re-attached to the regenerated live rows** —
  `public.set_commission_oversight(uuid,text)` → `(QO·A hand-merge — see header note)` and
  `public.create_external_participant(uuid,text,text)` → `(RE-SWEPT 2026-09-01, AE4.7c …)`.

Those two are **exactly** R4's `:60`/`:61`, the pair whose prose carries no decorative token. So the
"9" was not simply wrong — it was the correct count of a **different, real subset**. ⇒ **All 11
survive; nothing hand-authored was lost.** The merge reported `PRESERVED 51 hand-authored prose
line(s), 2 hand suffix(es); CARRIED 45`, and 9 + 36 = 45 reconciles.
⚠ My own classifier mis-binned the 2 stale-`profiles` ERROR rows as "hand commentary" because their
note contains prose; reading the actual text corrected it. *A prose-detector is not an
authorship-detector.*

#### CARRIED, other dispositions

- **Line 13's stale tail** — `Arm 2 write policies: from the embedded snapshot.` survived the merge
  as predicted (now at **line 27**; the file grew to 401 lines). **DELETE** per R24: the domain is
  lifted live, so the sentence is factually false.
- **The regenerated statistics are now CORRECT and need no hand edit** — `Baseline: Files=262,
  Tests=8876, Result: PASS.` and `Arm 1 guards: 13`. Both were stale (`Files=156, Tests=4796` and
  `7`) and the merge replaced them. R10.4's prediction confirmed in both directions: the merge
  **replaces** regenerated statistics and **preserves** prose it cannot match.
- ⚠ **The file's hand-material inventory CHANGED**: the merge added an **HTML comment block** (the
  CARRIED header). R4 recorded *"no HTML comment block in this file"* — true of the pre-run
  baseline, false now. A future merge's protected-set reconciliation must use the new inventory.

#### Findings filed from the run

`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES` (R18: verdicts recorded, the set
named, **never allowlisted**) — 15 policies, clustered: `process_template_*` (5), commission
vocabulary/settings (4), tenancy + cases (2), **self-scoped UPDATE (2)**, referral vocabulary (2).
⚠ The two self-scoped ones are sharpest: `notification_preferences_update_own` and
`notifications_update_own` opened to `true` and unnoticed means nothing asserts a user cannot update
another user's rows. Both were `BLIND -> BLIND`, so a re-confirmation, not a regression.
⭐ It **discriminates**: 102 of 120 came back COVERED, including six sibling `*_staff_admin_write`
policies. The naming shape is not the predictor — the subsystem is.

`FUP-WRITEPATH-BASELINE-297-TEST-FILE-ABORTS-AND-CONVERTS-COVERED-INTO-ERROR` (R19).

⛔ Standing, unchanged: Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT cleared**.
⛔ `FROMFINDINGS=1 ARM=policy` is RED pre-existing, is **not** one of CLAUDE.md §6's four arms, and
its twelve are not allowlisted.
⚠ **AMENDED 2026-09-08 beside the original (QA finding B2): after this unit it is twelve PLUS FIVE.**
The sentence above stays because it was true when written; it is no longer complete. This unit's
baseline takes the write arm's ARM-1 offender set from **0** off-allowlist BLINDs to **5**, named in
the § Session log entry of 2026-09-08 (QA fix loop) and in
`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES`. ⛔ **Zero allowlist entries were
added** — `authz-blind-allowlist.txt` is byte-identical to `main`. The 5 is **derived from the
committed artifacts** with the harness's own extractors, **not observed from an arm run**.

---

### 2026-09-08 — `backend`, the CARRIED disposition APPLIED (PO ruling R30), and why test file 297 is deliberately NOT fixed here

**What changed on disk:** `docs/reviews/authz-writepath-audit-findings.md` only — 401 → 251
lines, LF throughout.
⛔ **CORRECTED 2026-09-08 (QA finding N1): it is 401 → 256, not 251, and has been since `3c763ffe`.**
⭐ The gap is *exactly* the **5** lines this same turn added and then did not re-measure — the 4-line
HTML comment and the 1-line `SUPERSEDED` marker. 251 + 5 = 256. **A count measured before the last
edit and quoted after it**: the fourth instance of a printed quantity contradicting its own sentence
in this batch, and the first one where the sentence and the expression were both mine. The 120 verdict rows are byte-identical except the 9 that were re-filed
onto, and the CARRIED block is replaced by a dated `## Note` that is the disposition's own
audit trail.

#### R30 condition 1 — **0 rows caught**, and here is how the zero was earned

The condition excludes from deletion any carried row whose live replacement does **not** cite at
least the files the carried row cited. Measured as set inclusion `carried_files ⊆ live_files`
over **all 45** rows, not over the 36: **every** carried row's citations are a subset of its live
row's. ⇒ **0 exclusions**, and the 36 deletions lose no citation.

⭐ **A zero from a matcher is worth nothing until the matcher is shown able to find something**,
so three controls ran before the zero was believed:

| control | result |
|---|---|
| strict `\b\d{3}[A-Za-z0-9_]*\.sql\b` vs loose `[A-Za-z0-9_./-]*\.sql`, over all 45 notes | **zero delta** — the strict pattern misses no `.sql` token |
| broader filename-shaped scan over the same 45 notes | only `7.2` and `AE4.7c` — **no non-`.sql` citation exists**, so nothing lives outside the matcher's alphabet |
| positive control (a planted `999_probe_file.sql`) · discrimination (a decoy with a trailing letter after the extension, and a bare extension) | found · both rejected |

#### ⚠ FINDING — for 6 of the 9, "hand commentary" was **not** hand commentary

The disposition the PO approved described the 9 as *"carried note holds hand commentary the
regenerated row lacks"*. Byte-diffing each carried note against its live note shows that is true
of **3** and false of **6**:

- **3 guard rows** (`ensure_professional_participant`, `create_professional_profile`,
  `set_professional_link_state`) carry real hand prose whose substance still qualifies the LIVE
  verdict. `set_professional_link_state`'s is load-bearing: its **BOUNDED VERDICT** note says the
  neutralizer opens only the population gate, so its COVERED says nothing about the
  `link_state = 'unknown'` bound. Losing it would let a reader over-read a live COVERED.
  ⇒ re-filed **verbatim**.
- **6 `form*`/`forms` `*_staff_admin_write` rows**: the *entire* delta between carried and live
  note is the 55-character clause `merged 2026-09-0X from a subset run per ADR 0079 Amdt 1`.
  Its substantive companion (`snapshot:ABSENT — no §7.2 drift tripwire on this verdict`) is
  **already on the live row**. And the clause is **provenance of the superseded verdict** — this
  run's COVERED came from the full sweep, not from a 2026-09-02/03 subset merge. Splicing it
  verbatim onto the live note would assert something **false of the live verdict** — precisely
  what the CARRIED block's own header warns against: *"a note earned against one verdict is not a
  claim about another."*
  ⇒ re-filed **verbatim but explicitly attributed**:
  `[prior provenance, carried 2026-09-08 — describes the SUPERSEDED verdict, NOT this one: "…"]`.
  The clause's bytes were copied programmatically from the carried note, never retyped (R30.2);
  only the trailing separator — punctuation joining it to a clause already present — was dropped.

⭐ **The shape, and it is the third instance in this batch.** My token-keyed classifier called
these 6 "hand commentary" because they wear a bracket; the lead's R4 reader-inspection counted
them for the same reason. Both were reading **decoration**, not **authorship**. Earlier in this
same batch: *a prose-detector is not an authorship-detector* (the 2 stale `profiles` rows), and
*a decoration-keyed pattern cannot see undecorated hand prose* (R24's `:60`/`:61`). Same class,
third occurrence. ⛔ The lead may prefer these 6 clauses simply DELETED as superseded provenance;
attributing rather than deleting was chosen because R30 approved **9** re-filings, and reducing
that to 3 unilaterally would have been a disposition change, not an application of one.

#### R30 condition 4 — R14 re-asserted **by byte comparison**, and the 51 / 2 / 6 reconciled

A pre-edit snapshot captured **15** byte-exact strings — 3 guard commentaries, 6 form clauses,
the 2 spliced hand suffixes, and the 4 hand prose blocks (the `HAND-MERGED` blockquote 585 ch,
the 39-of-107 `## Note` 347 ch, the `---` rule, the AE4.7c `## Note` 1850 ch). Post-edit, all 15
are present as substrings; the 120 row identities, arms, directions and verdicts are unchanged;
the verdict census is unchanged (`COVERED 102 · BLIND 15 · ERROR 3`); and **exactly** the 9
re-filed notes differ, each strictly GREW (the pre-edit note is a substring of the post-edit one).
Bare **rc 0**.

⭐ **The verifier was proven able to go RED before its green was believed** — three mutations on a
scratch copy, each bare **rc 1**, each naming the right subject:
`BOUNDED VERDICT, stated rather than` → `…rather then` ⇒ FAIL on `set_professional_link_state` ·
one byte added inside the `HAND-MERGED` blockquote ⇒ FAIL on `blockquote_HAND-MERGED` ·
`forms.forms_staff_admin_write` flipped COVERED→BLIND ⇒ FAIL on both the row-triple check and the
census check.

**The 51 / 2 / 6 that were standing unexplained are three counters over three populations, and
none counts the same material as another.** The merge's banner is
`PRESERVED $NHAND hand-authored prose line(s), $NSUFF hand suffix(es); CARRIED $NCROW whole row(s)`
(`scripts/lib/merge-findings-baseline.sh:684`):

| counter | population | value | derivation (measured, not read off the banner) |
|---|---|---|---|
| `NHAND` | hand-authored **prose LINES** preserved in place | **51** | the 137-line pre-run baseline holds **63** non-blank non-table lines; the generator re-emits **10** verbatim; the merge *replaced* **2** stale statistics (`Baseline: Files=156, Tests=4796…`, `Arm 1 guards: 7…`) instead of preserving them. 63 − 10 − 2 = 51 |
| `NSUFF` | hand **SUFFIXES** spliced onto regenerated rows | **2** | `set_commission_oversight` and `create_external_participant` — R24's `:60`/`:61`. ⭐ **Neither contains a `merged 2026-09-0` string**, so the 6 could not have been these 2 under any reading |
| `NCROW` | whole **ROWS** carried | **45** | of which **6** contain a `merged 2026-09-0…` string, all 6 inside the CARRIED block (in the 401-line post-run file, *before* this disposition: `:288 :292 :296 :300 :304 :308` — ⚠ those line numbers are dead against the 256-line file this turn produced — ⛔ *corrected 2026-09-08 from "251-line", QA N1*; the identities are the six `form*`/`forms` `*_staff_admin_write` rows, and identities are what survive a re-count), **none** on a live row |

⇒ The file's 6 belonged to the 45. Two numbers about *different* material were standing side by
side; there was never a contradiction to resolve, only a grain to state. ⭐ The derivation also
**explains** why line 27's stale tail survived the merge: `` `assert_condition_value_codes`). Arm 2
write policies: from the embedded snapshot.`` is a hand-MODIFIED line the generator does not emit
verbatim, so it counted inside the 51 and was preserved as prose. R24 predicted the mechanism;
this is the measurement of it.

#### R30 condition 3 — line 27's stale tail DELETED

`` `assert_condition_value_codes`). Arm 2 write policies: from the embedded snapshot.`` — located
by its text, not by the remembered line number (it moved 13 → **27** as the file grew to 401
lines). Factually false since 2026-09-02: the domain is lifted live from `pg_policy`.

#### One action BEYOND R30's three, stated so it can be reverted in one line

The `## Note — 2026-09-03: THIS FILE COVERS 39 OF 107 … no full sweep has run since` sits at the
top of the file and its second clause is now false. It is protected hand prose, so it was **not**
rewritten; a dated `⛔ SUPERSEDED 2026-09-08` line was **added beneath it** naming the real state
(120 of 120 cases, 117 verdicted, 3 UNVERDICTED, the 297 follow-up named). This follows the
project's dated-correction-beside-the-original convention rather than R30's letter; it is one
added line and nothing else.

#### R31 — why `297_process_template_versioning.sql` is CORRECTLY not fixed in this unit

⭐ **Fixing it would change `Tests=`, and `Tests=` IS the baseline shape this run asserted 120
times.** Every one of the 120 cases was judged by comparing its run shape against
`Files=262, Tests=8876`; the reset design re-verified that exact shape at all 8 resets. Repairing
file 297 moves `Tests=`, which retroactively invalidates the comparison that every verdict in this
file rests on — **the fix and the run cannot coexist in one unit**. It is filed as
`FUP-WRITEPATH-BASELINE-297-TEST-FILE-ABORTS-AND-CONVERTS-COVERED-INTO-ERROR`, and the unit that
repairs it re-sweeps the three `process_template_*` write policies against the new shape.
⭐ And the entry must keep saying what the run showed: **the assertions FIRED** — the tests noticed
and named the file; the same mutation also crashed it. *Absence of a verdict is not absence of
coverage.* Without that sentence a later reader files these 3 beside the 15 BLINDs and concludes
the exact opposite of what the run measured.

⛔ Standing, unchanged: Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT cleared**.
⛔ `FROMFINDINGS=1 ARM=policy` is RED pre-existing, is **not** one of CLAUDE.md §6's four arms, and
its twelve are not allowlisted.
⚠ **AMENDED 2026-09-08 beside the original (QA finding B2): after this unit it is twelve PLUS FIVE.**
The sentence above stays because it was true when written; it is no longer complete. This unit's
baseline takes the write arm's ARM-1 offender set from **0** off-allowlist BLINDs to **5**, named in
the § Session log entry of 2026-09-08 (QA fix loop) and in
`FUP-WRITEPATH-BASELINE-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES`. ⛔ **Zero allowlist entries were
added** — `authz-blind-allowlist.txt` is byte-identical to `main`. The 5 is **derived from the
committed artifacts** with the harness's own extractors, **not observed from an arm run**.

---

### 2026-09-08 — `backend`, GATE AT THE TIP (R32 step 2). Every exit code read **bare**, no pipes

Tip = `3c763ffe` (the disposition commit), branch `authz-writepath-baseline`, 8 commits ahead of
local `main` (`5a0ec8d5`), which is itself **1** ahead of `origin/main` (`23ec1fa5`) — R16's push
distance re-measured and confirmed at **1**.

⚠ **The four authz arms are NOT in this record.** From Batch 2 on, someone other than the builder
runs them at the tip, and the lead does. ⛔ `FROMFINDINGS=1 ARM=policy` stays RED pre-existing, is
**not** one of CLAUDE.md §6's four arms, and its twelve are never allowlisted.
⚠ **AMENDED 2026-09-08 (QA B2): twelve PLUS FIVE.** That arm's offender set gains 5 off-allowlist
BLINDs from this unit's baseline (0 → 5). ⭐ Because the arm is *already* red, **no gate can register
the change** — which is the whole reason it is written here rather than left to a gate: a standing
red is where a new regression lands invisibly. ⛔ Never allowlisted; derived, not observed.

| gate | command | bare rc | observed |
|---|---|---|---|
| lint | `npm run lint` | **0** | `eslint --max-warnings=0` silent ⇒ **0 errors, 0 warnings**; all 13 chained gates green |
| typecheck | `npm run typecheck` | **0** | `tsc --noEmit`, no output |
| fresh reset | `npx supabase db reset --local` from the repo root | **0** | `Finished supabase db reset on branch authz-writepath-baseline` |
| pgTAP | `npm run test:db` | **0** | `All tests successful.` · **`Files=262, Tests=8876`** · `Result: PASS` — ⭐ **the shape did not move**: byte-identical to the baseline this run asserted 120 times |
| deriver self-test | `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0` |
| door harness self-test | `SELFTEST=1 bash supabase/tests/mutation/p0-authz-door-audit.sh` | **0** | `SELFTEST TOTAL: 23/23 ok, 0 failed`; committed door baseline VERIFIED unchanged by cksum |
| set-valued targeted home | `bash supabase/tests/mutation/authz-setvalued-targeted-cases.sh`, detached | **0** | `=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ===` · `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)` |
| production diff | `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | **0** | **EMPTY** |

#### The diff-scoped deriver — `SCOPE:` line quoted **verbatim**

Run over **both** candidate bases, because `main` and the commit the record names as the cut point
are not the same object (local `main` = `5a0ec8d5`, the unit-opening commit; `origin/main` =
`23ec1fa5`). Both agree, and the deriver's own warning — *"If the phase DID add a migration, the
`<phase-base>` is wrong"* — is therefore discharged from two directions:

    bash scripts/door-sweep-cases.sh main            -> bare rc 3
    SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
           0 case(s) — nothing was derived, and the line above is what the gate record
           quotes to say so.

    bash scripts/door-sweep-cases.sh 23ec1fa5        -> bare rc 3
    SCOPE: 0 file(s) — 0 committed (23ec1fa5..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
           0 case(s) — nothing was derived, and the line above is what the gate record
           quotes to say so.

`=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ===` **This exit 3 IS the "no gate
changed" claim** (CLAUDE.md §6 step 1), and it is checkable, not a pass.

⭐ **A zero from a file-counter is a dead instrument until it is shown able to count.** Positive
control, same script, same syntax, a base whose range **does** contain a migration:

    bash scripts/door-sweep-cases.sh 01628bb2^       -> bare rc 0
      migrations : 1 file(s) touched
      === RESULT: DERIVED (0) — 1 case(s). This is a SELECTION, not a verdict. ===
      SCOPE: 1 file(s) — 1 committed (01628bb2^..HEAD), … | derivation: catalog

⇒ the counter sees a migration when one exists and reaches the catalog; the 0 on our two bases is
a measurement.

#### The production-diff EMPTY is also a proven zero, not a silently-empty pathspec

⚠ *A phantom worktree makes every pathspec filter silently empty.* Three controls, same syntax:
`git diff --name-only main...` over ALL paths returns **9** files; over `docs/reviews` returns the
one file this turn changed; `git worktree list` shows **one** worktree at the repo root. ⇒ the
filter is live and its emptiness is real. **The only source file this branch changes is
`supabase/tests/mutation/p0-authz-writepath-audit.sh` — a HARNESS change, not a gate change.**

#### The set-valued targeted home — restore verified three ways, and its detector fired on every case

Launched **detached** (PowerShell `Start-Process` on `C:\Program Files\Git\usr\bin\bash.exe`,
`MSYSTEM=MINGW64`, script as argv[1], with the environment preflight the 2026-09-07 launch fault
bought). ⛔ Never under a tool timeout — a killed run leaves a resolver sitting on the universal
set. §4b held: **5 live, 3 in scope, 2 out of scope with a recorded disposition**. All three came
back **COVERED**, and the restore was verified three ways, exactly as its header promises:

    fingerprint before/restored, all three cases, byte-identical:
      7e82cd4e9ef62edffede45520154c5e2   authz.authorized_scope_ids(uuid,text,text)
      c48b844826147d749d0e795cc19ea17a   authz.candidate_authorized_scope_ids(uuid,text,text)
      88a65e5b0fbe20a19ed1959f8b287c28   app.current_professional_read_organizations()
    (2) §4a residue: 0 rows   (3) suite after restore: Result: PASS (Files=262, Tests=8876)
    (4) sentinel + sidecars: absent

⭐ **Its §4a detector proved itself on this run rather than by a knob** — while each mutation was
live the check NAMED that resolver, and it enumerated to zero on the clean tree before and after.
A detector that finds nothing must be proven able to find something; here the run is the proof.

#### ⚠ TWO instrument faults of my own during this gate, both caught, both recorded

1. **A liveness watcher built on a command that does not exist.** I armed a monitor whose
   "is it still running" half was `pgrep -f authz-setvalued…`. **`pgrep` is not on this msys**, so
   the check failed the way a missing binary fails, the loop read that as *the process is gone*,
   and it emitted `SETVALUED PROCESS GONE with no rc file` **while the harness was mid-case-2**.
   ⭐ Had that alarm been believed, the correct-looking response — investigate a half-finished
   mutation run — is exactly the response that contaminates one. *A detector must be proven able
   to find something before its finding is believed, and that applies to a liveness check as much
   as to a security one.* Verified with an instrument that does work (PowerShell `Get-Process`:
   14 bash/supabase processes alive) and the log's own progress, and the alarm was discarded.
2. **A residue query I invented, at the wrong grain.** Checking the post-run state I ran a
   `prosecdef … SETOF uuid` count over `authz`/`app` and got **4** — which is neither the
   population the harness rules on (**5**) nor a test of whether anything sits on a universal set.
   It measured the wrong property with an authoritative-looking number. ⛔ Discarded in favour of
   the harness's own §4a check (`0 rows`) and its byte-exact fingerprint comparison. *A wrong
   instrument reads exactly like a live defect* — the fifth occurrence in this unit.

#### Stack discrimination — stated, not assumed

Two Supabase stacks are up. Ours is **`supabase_db_azkbbhskturikxpgmafq`**, discriminated by the
`authz` schema and confirmed in **both** directions: ours reports `authz schema: 1` and
`write policies: 107` (the run's exact domain); `supabase_db_escalume` reports `authz schema: 0`.

⛔ Standing, unchanged: Tier 2's **190 doors stay deferred by ADR 0171 and are NOT cleared**.

### 2026-09-08 — `backend`, the LAST BUILD TURN before QA: three closures, the R27 fix proven at the SECOND reset, and a third instance of that class

Ruled by the lead as **R35** (with **R33** correcting R30's premise and **R34** accepting the prior
turn's measurements). Everything below was measured on this tree; exit codes are read **bare**.

#### R33 — the premise correction, recorded BESIDE the approval, not folded into it

⛔ The PO's **R30** approval described the 9 re-filings as *"carried notes holding hand commentary
the regenerated row lacks"*. Byte-diffing says that is true of **3** and **false of 6**: for the six
`form*`/`forms` rows the entire delta is the 55-character clause `merged 2026-09-0X from a subset run
per ADR 0079 Amdt 1` — provenance of the **superseded** verdict and false of the live one, whose
substantive half (`snapshot:ABSENT …`) already sits on the live row.

**The as-built form STAYS** (R33). All 9 were re-filed — 3 verbatim, 6 verbatim but **labelled**
`[prior provenance, carried 2026-09-08 — describes the SUPERSEDED verdict, NOT this one: "…"]` —
rather than reduced to 3 unilaterally, because **reducing the count is a disposition CHANGE, not an
application of one**, and the PO approved a disposition. The form is compliant (9 re-filed, 36
deleted, exactly as approved) and honest (each of the six now says what it describes). ⛔ The
approval is **not** restated as though it had been given on the corrected premise; this note sits
beside it.

⭐ **Third instance in this unit of *decoration read as authorship*.** My token-keyed classifier and
the lead's R4 reader-inspection both counted those six, for the same reason — a bracket. **Two
methods agreeing while sharing one blind spot is not corroboration.** R14's "11" was right that
those lines are not generator output and wrong to call all 11 *commentary*.
⭐ `set_professional_link_state`'s **BOUNDED VERDICT** note is the load-bearing re-filing: without it
a reader over-reads its live COVERED. That one alone justifies the re-file column existing.

#### R27 — the reset banner now prints the DELTA (commit `22402505`)

`maybe_periodic_reset` interpolated `$((DONE - 1))` — the **cumulative** case count — into the
sentence *"case(s) swept since the last baseline"*. The **trigger** was always correct
(`(DONE-1) % RESET_EVERY == 0` fired at 20 and 40 in the full run); the **number** was not. At reset
2 with `RESET_EVERY=20` it read **40** where the true delta is **20**, and it diverges further every
reset (60, 80, 100). The mid-run checkpoint schedule instructs the operator to read exactly that
line, so a banner reading 40 where 20 is due reads as *a reset was missed* — the drift-void
condition. The instrument the run's safety rests on was lying in the reader's direction.

**The fix computes the delta**, wording untouched (the operator needs the delta, so the sentence was
the correct half); the interpolated expression is now
`$(( (DONE - 1) - LAST_BASELINE_SWEPT ))`.

`LAST_BASELINE_SWEPT` is initialised to 0 (the preflight baseline is captured before case 1) and
updated in **exactly one place**: the END of `periodic_reset`, after the post-reset baseline was
actually re-captured and asserted green. ⛔ Never in `maybe_periodic_reset` — `periodic_reset` can
return at its own suppression gate having re-captured nothing, and an anchor advanced there would
under-report every later delta silently. The anchor is `DONE - 1` at **both** call paths and means
the same thing at both (case `$DONE` is the one about to be (re-)swept against the NEW baseline), so
a **retry** reset moves the anchor mid-window and the next scheduled banner reports the true 16
rather than 20 — a quantity no re-labelling of `DONE - 1` can produce.

> **Deriving a number does not make it the number the sentence claims.**

⭐ The class is **not** "hardcoded counts". R6's DRYRUN defect was a **literal** (`7`) and deriving it
was the cure; this one **derives cleanly from live state and measures the wrong quantity**. Had the
prescription been "derive it", this instance would have passed review as already-compliant. That is
why the existing entry was **widened** rather than a second one opened.

**SELFTEST ARM 4, and why it reads the SECOND reset.** `LAST_BASELINE_SWEPT` is 0 until the first
re-capture, so at reset 1 the cumulative count and the delta are **equal** — a check that stops
there goes green on the defect it exists to catch. ⭐ *When a counter is claimed as a DELTA, the
first sample cannot distinguish it from a CUMULATIVE one.*

⛔ **The arm LIFTS both functions from this file's own text rather than keeping a copy.**
`periodic_reset` and `maybe_periodic_reset` are defined ~380 lines BELOW the SELFTEST block, so they
do not exist yet when it runs; the only alternative to lifting is a hand-written copy of production
text inside the harness that tests it — *a harness can hold a hand-written copy of production text*,
and the copy goes stale silently while its table stays green. The lift is itself asserted (a `sed`
range matching nothing defines nothing, and that must red rather than skip quietly). Four primitives
are stubbed — including a shell function named `supabase`, which **shadows the binary**, so the
`db reset` subshell touches no database. Everything else in `periodic_reset` runs for real: the
interlock, the gate, the worklist comparison, the `GUARD_KEYS` resolution loop, the post-reset
assertions, and the anchor update under test.

| # | assertion | expected | why it is here |
|---|---|---|---|
| 4a | reset 1 delta | 20 | ⚠ **INERT by construction** — the cumulative expression agrees here |
| 4b | reset 2 delta | 20 | ⭐ **THE DISCRIMINATOR** (pre-fix: 40) |
| 4b' | resets actually fired | 2 | else 4a/4b compare against an empty capture |
| 4c | retry at case 25 moves the anchor → next scheduled delta | 16 | the cumulative counter cannot express this at all |
| 4c' | resets fired | 3 | 2 scheduled + 1 retry |
| 4d | suppressed reset: anchor UNMOVED | 7 | the negative half, run for real — no stub is reached |
| 4d' | suppressed reset: none counted | 0 | pairs with 4d |

**Unmutated: 25/25 ok, bare rc 0.** ⛔ Green on a first run is a finding, not a pass, so four mutants
were run on a `cmp`-verified scratch copy, each with its `diff` shown to be exactly the intended hunk:

| mutant | observed | bare rc |
|---|---|---|
| PRE-CHANGE predicate restored (`$((DONE - 1))`) | **4a stays `ok` at 20**; 4b NOT OK **40 vs 20**; 4c NOT OK 40 vs 16 — 23/25 | **1** |
| one expectation flipped (4d `7`→`8`) | NOT OK 4d — 24/25 | **1** |
| the LIFT killed (`sed` range matches nothing) | NOT OK `lift periodic_reset() -> lifted 0 line(s)`, arm body skipped — **16/17**, i.e. 8 rows silently gone and one row saying why | **1** |
| anchor update moved ABOVE the suppression gate | NOT OK 4d **30 vs 7** — 24/25 | **1** |

⭐ The first mutant **is** the R27 proof: under the defect, reset 1 is green and only reset 2 reds.
⚠ No repo file was touched by any mutant — the scratch copy's `ROOT` resolves into the scratchpad,
and its own closing cksum line names that path rather than the repo's. That is the R25 ROOT trap
avoided by construction, and visible in the output rather than assumed.

#### A THIRD instance of the same class, found while fixing the second

The harness header's recovery block read **`READ ALL FIVE STEPS BEFORE ACTING`** above **SIX**
numbered steps — the comment form this file's own header warns about (*"a count in a comment is an
assertion, and this one was false for four additions"*). It sits inside the very block that
discharges the Part 4 clause closed today. ⛔ **Not repaired by typing "SIX"**: there is no runtime
list to derive from, and a fresh literal is the same defect with a newer number. The **numeral is
deleted** — the reader was going to read every step anyway, so it carried no information and only a
way to go stale. `bash -n` rc **0**, `SELFTEST` 25/25 rc **0** after the edit.
⛔ `FUP-WRITEPATH-BASELINE-HARDCODED-COUNTS-IN-HARNESS-BANNERS` stays **open** and now says so: three
instances fixed **in one file** is not the class fixed, and the four sibling harnesses are unswept
for both forms — the derived-but-wrong-quantity form as much as the literal one.

#### The three closures (R35.1) — each against its OWN quoted `Closes when`

The rotation was **mechanical**: entry block and body file moved as bytes, the destination verified
**before** any source was cut, then the entries removed and the two body files deleted. Archive
10312 → 10935 lines; open register 1791 → 1769.
⛔ **CORRECTED 2026-09-08 (QA finding N5): both figures are off by one at each end.** Measured across
this turn's own commit (`22402505` → `6d0db87a`): archive **10311 → 10934** (+623); open register
**1790 → 1770**, a delta of **−20**, not the −22 the line above implies. ⚠ The rotation itself was
byte-verified and is unaffected — but ⭐ *a delta quoted from two hand-read endpoints is two chances
to be wrong, and here it was both*: the endpoints were read, not computed, so the error survived a
turn whose whole subject was verifying bytes at the destination.

| item | discharged by | ⛔ NOT discharged by |
|---|---|---|
| `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` | the **documented recovery step** (harness header, `5e0173bd`, six steps naming `RECOVER=1`, the enumerating catalog query, `git checkout -- docs/reviews/authz-writepath-audit-findings.md`, and the working-tree/suite-shape clause) **+ the nine policies swept**, each COVERED, named individually | the exit-code halves — Part 1 → deriver ruling 4, Part 2 → the 2026-08-29 REPAIR, Part 3 domain half → `d2069603`; P1 rc 3 and P5 rc 1 are cited as **evidence the tree is as claimed**, not as the discharge |
| `FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` | the full sweep **merged** into the committed file (137 → 401 lines, census sums 120 + 45 = 165, `PRESERVED 51 … 2 hand suffixes` re-asserted by byte comparison) | a green `FROMFINDINGS=1` run · the 2026-09-02 domain fix · the 37-of-107 subset merge |
| `FUP-STORAGE-OBJECTS-INSERT-POLICIES-NEWLY-IN-DOMAIN` | the **plain** run — three rows, three COVERED verdicts, each carrying `via supautils.policy_grants`; none in `authz-blind-allowlist.txt` (checked, zero hits) | any escalated path — the escalation was removed before the run |

⚠ **The title figure was stale and the title is NOT amended** (headings are never edited once
filed): the true pre-run coverage was **39 of 107** policy rows — 33 predating the widening + 4 from
AE4.9 D6 + **2** merged from the `BUG-AE49-D6-REKEY-INCOMPLETE` subset run on 2026-09-03 — and **51
of 120** counting the guard arm, `set_primary_subject` never verdicted. The closure says so; the
heading keeps `33-OF-107` for ever.

⚠ **The `Closes when` of the half-aimed item is TRUNCATED in the register** (ends in a literal `…`).
Both halves are quoted in the closure — the register field as the register held it, then the body's
tail verbatim from where it stops — and ⛔ nothing is paraphrased into the gap. The truncation is
**not** repaired by this closure: the field travelled into the archive still carrying its `…`, so
`FUP-WRITEPATH-BASELINE-REGISTER-CLOSES-WHEN-TRUNCATED` stays open, and its entry now carries a
dated note saying that (a) its subject moved and (b) its own citation
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED.md:143-147` names a **file this closure deleted**. ⭐ *A rename
orphans a name-keyed reference* — the citation was correct when written and became false through no
edit of its own.

#### ⚠ Instrument fault number SEVEN, caught in the verification of the closures themselves

My first verbatim check located each moved body by **the last archive line matching the body's first
line**. Two of the three bodies open with the byte-identical line
`Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open`, so the
locator resolved both to the SAME block and reported `*** MISMATCH ***` for
`FUP-WRITEPATH-FINDINGS-FILE-COVERS-33-OF-107` — a fabricated defect that read exactly like a
data-loss bug in the rotation. ⭐ *Fixture-shared ids fabricate a defect AND an all-clear*: had the
two entries been ordered the other way it would have printed **identical** for a block it never
compared. Re-anchored on each entry's own `### ✅ …` heading and re-run: **all three bodies and all
three entry field-blocks byte-identical** to `git show HEAD:` — 224, 24 and 15 body lines, and 3, 3
and 4 field lines respectively. ⛔ Zero `**Body:**` tokens in the archive (`lint:registers`, ADR
0185 D5).

That is **seven** instrument faults in this unit, every one of which read like a live defect.

#### Suite shape — why `npm run test:db` was NOT re-run for this turn

R35.3 conditions it on touching something that could move the suite shape. This turn touched
`supabase/tests/mutation/p0-authz-writepath-audit.sh` (a `.sh`) and Markdown. `supabase test db`
collects `.sql` files, and `.sh` files **already** live in `supabase/tests/mutation/` — the
`Files=262, Tests=8876` baseline was measured with them present, twice on this branch — so editing
one cannot move `Files=`. The condition is not met; the shape check belongs to the lead's gate at
the tip, on a fresh reset.

---

### 2026-09-08 — `backend`, QA fix loop iteration 1 of ≤5 (`docs/reviews/writepath-baseline-review.md`: CHANGES REQUESTED, B1–B4 blocking + N1–N5)

All four blocking findings accepted by the lead (R37) without argument; QA is right on every one.
Three are prose-about-a-measurement. **B1 is not** — it is a live functional defect in a file a gate
reads, and it is the most serious thing this unit produced.

#### B1 — a COVERED row inside the `## BLIND` table. Fixed, and its MECHANISM measured

`docs/reviews/authz-writepath-audit-findings.md:75` carried
`responses.responses_delete_own_draft (DELETE) … | COVERED |` **inside** `## BLIND`.
`p0-authz-invariant.sh:133-136`'s `blind_from_findings()` filters on `/^## BLIND/` and never reads
column 4, so it returned **16** labels where the run measured 15 — pinning a policy the sweep found
COVERED as BLIND for ever, and disabling ARM 1's stale-allowlist prune, the one mechanism that would
have surfaced the staleness. **Row relocated by hand** into the COVERED table, in the alphabetical
slot the generator itself uses. Re-verified with the consumer's own extractor, replicated verbatim:
**15 labels**, not 16.

⛔ **Census, never a sample** (the lead's instruction). An `awk` census over every table row, keyed
on `section × column 4`:

| file | rows scanned | section/verdict disagreements |
|---|---|---|
| `main` | 51 | **0** |
| HEAD `6d0db87a` | 120 | **1** — B1's row, and only it |
| after the fix | 120 | **0** |

Parts sum on both bases (`main` 46+3+2 = 51; HEAD 101+15+3+1 = 120), so the census is not silently
dropping a class. **The detector was proven able to find something before its zeros were believed:**
a planted `COVERED` inside `main`'s BLIND table was found; a planted `BLIND` inside HEAD's COVERED
table — **the opposite polarity, which no real file exercises** — was also found.

⭐ **Instrument fault 8, caught by a guard rather than by luck.** The first negative-control plant
targeted a policy name that does not exist in `main`'s 3-row BLIND table, so it changed nothing and
the census reported a clean **0** — a *dead plant reading exactly like a passing control*. Caught by
a `diff` between the source and the planted copy, which was empty. Re-planted on a row that exists,
and the plant then fired. ⛔ A plant is not evidence until you have shown it applied.

**The mechanism — measured on constructed inputs through the real merge library, not inferred.**
`emit_body` places strictly by verdict (`$4=="BLIND"` / `$4!="BLIND"`), so the **generator cannot**
produce this state. `merge-findings-baseline.sh` step 3 aligns baseline against generated by `diff`
over row-key placeholders and emits each merged row at the **first** aligned position, deleting the
key so the second occurrence emits nothing. Both polarities run through the library:

| baseline | run | table the merge chose | correct? |
|---|---|---|---|
| BLIND | COVERED | `## BLIND` (the baseline's) | ❌ — B1 |
| COVERED | BLIND | `## BLIND` (the run's) | ✅ |

⭐ **The merge is correct only for the direction that makes things worse.** Because `## BLIND`
precedes the COVERED table, "first position wins" files a **regression** correctly and misfiles an
**improvement**. The arm therefore over-reports BLIND and can never under-report — it fails closed,
which is exactly why nothing caught it for 38 door rows and now 1 write row. ⚠ The real run
exercised only the failing polarity (1 `BLIND -> COVERED`, **zero** `COVERED -> BLIND`), so the
correct half is a constructed observation, not a run witness.

**Filed against the existing item, so both halves live together:**
`FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` already owns the *reader* half (the arm
trusts the section); the *writer* half (the merge writes the section) is now recorded there with the
measurement above. ⛔ The hand relocation closes neither: it is a data fix.

⚠ **A third correction to that entry, measured rather than argued.** Its `Closes when` says a
re-sort *"is undone by the next merge"*. Re-running the merge with the corrected file as baseline
and a generator-shaped report as input left the row in the COVERED table with **0** disagreements
and spliced its hand suffix back (`PRESERVED … 1 hand suffix(es)` — the splice path, so the test was
not the `brow == grow` identity fast path). A re-sort is undone only for a row whose verdict
**crosses the boundary again**; that is still reason enough not to close on one, so the rule stands
and only its factual half is corrected.

⭐⭐ **The transferable lesson, and it indicts my own control.** R30 condition 4 asserted the 120
rows' identities, arms, directions and verdicts were **unchanged across the disposition edit**. That
control was green *because* the row was already misplaced before the edit. **A verification anchored
on a DELTA cannot see a defect that predates the delta** — invariance across an edit is not
correctness, and I chose invariance because the edit was what I was afraid of. The property the
control should also have asserted is stateless: *every row's section agrees with its column 4*. That
is now the census above, and it costs four lines of `awk`.

#### B2 — five new off-allowlist BLINDs, disclosed (⛔ never allowlisted)

Re-derived independently with the harness's own `blind_from_findings` + `allow_body`:

| | write-arm BLIND labels | of which NOT on `authz-blind-allowlist.txt` |
|---|---|---|
| `main` | 3 | **0** |
| this branch, after B1's fix | 15 | **5** |

The five, named: `cases.cases_staff_admin_write`,
`commission_member_titles.member_titles_staff_admin_write`,
`commissions.commissions_admin_write`, `phase_results.phase_results_staff_admin_write`,
`process_template_versions.process_template_versions_staff_admin_write`. The other **10** are already
allowlist entries — tracked backlog, not newcomers. ⛔ **Zero entries were added**:
`git diff --quiet main -- supabase/tests/mutation/authz-blind-allowlist.txt` is **rc 0**, byte-identical.

⚠ **Labelled derived-not-observed everywhere it is stated (R39).** `FROMFINDINGS=1 ARM=policy` was
**not run** — it is red pre-existing and unreadable until its own follow-up lands — so this is
arithmetic over two committed artifacts using the consumer's extraction logic, not an arm's printed
offender list. Its printed total may differ, because it also draws on the door and rowdoor findings
files this branch did not touch.

⭐ **Why disclosure IS the remedy here.** Because the arm is *already* red, no gate can register the
change: *an escape hatch for the unmeasurable also silences the measured*. Stated beside **every**
"its twelve" sentence — the record's four standing blocks plus `:34` and `:836`, ADR 0192 `:205`,
the hub § Current state, and the 15-BLIND follow-up. ⛔ Still never allowlisted; the fix is keystones.

#### B3 — the direction census was wrong, and it inverted its own conclusion

`FUP-…-15-BLIND-WRITE-POLICIES-NO-TEST-NOTICES` claimed *"Twelve `ALL` … Three single-command
policies opened `open->true`"*. Measured over the committed file: **13** `ALL` / `open
with-check->true`, and **2** `UPDATE` / `open using+check->true` — a token the entry did not
contain. ⭐ 12 + 3 = 15 summed while the partition was wrong: **a census whose parts sum is not
thereby right.** Worse than the digits: the two are opened on **both halves**, so their BLIND is a
claim about the **whole policy**, while the paragraph filed them under a "`with check` half only"
reading — it inverted its own conclusion for the two rows it goes on to call the sharpest. Corrected
in place with the original quoted beside it; the cluster list said 2 all along and was never wrong.

⚠ **And the over-claim.** *"Nothing asserts that one user cannot update another user's rows"* is
contradicted by `authz-blind-allowlist.txt:33-36`, which records
`notification_preferences_update_own` as *"fully backstopped by `select_own`"*. **A BLIND means no
keystone exercises THIS POLICY; it does not mean no mechanism constrains the behaviour.** Corrected
to say the first without implying the second — the gap is still real and still worth a keystone,
because the backstop is a side effect of a different policy and an unrelated edit can remove it.
`notifications_update_own` has no recorded backstop and the entry now says that is **unmeasured**,
not clear. *An incidental guard closes a hole the definition predicts.*

#### B4 — the baseline no longer denies being the audit's result

`:37-54` still opened *"⛔ Do not read this file as the write-path audit's result"* and *"The gap
closes only when a full sweep runs"*, in the future tense, in bold, at the top of the unit's central
deliverable. Given the same dated `⛔ SUPERSEDED 2026-09-08` treatment the adjacent `## Note` got at
`:36` — ⛔ **beside** the original, not a rewrite and not a deletion, because it was true when
written. The marker names all three now-false claims **and** the half that does not expire: *absence
of a row is absence of a VERDICT, never a COVERED*, which is why the 3 `process_template_*` rows are
`ERROR`/UNVERDICTED rather than scored.

#### N1–N5

- **N1** `401 → 251` is **256**, and has been since `3c763ffe`. ⭐ The gap is *exactly* the 5 lines
  that same turn added (a 4-line HTML comment + the 1-line `SUPERSEDED`) and never re-measured —
  **a count measured before the last edit and quoted after it**. Corrected in the hub and at both
  record sites. ⚠ The file is **311** lines *as committed at `a608e240`* — ⛔ **anchored to a commit
  on purpose, because this very sentence reproduced N1 once more:** it was written saying **304**,
  measured before the last edit of the loop (the instrument-fault-9 repair below) and quoted after
  it. Caught by re-measuring against the committed blob rather than re-reading the sentence. ⭐ That
  is the **sixth** instance of the class in this unit and the second in the note correcting the
  fourth — the durable remedy is not a better number, it is *citing a count with the commit it was
  measured at*, so a reader can re-run `git show <sha>:<path> | wc -l` instead of trusting prose.
- **N2** `p0-authz-writepath-audit.sh:21` claimed `RAISE-GUARDS — 11` while `GUARD_KEYS` holds
  **13** — the fifth instance of the class, sitting **inside the sentence that warns about it**.
  Both halves done: the numeral **deleted** (no runtime list a comment can derive from, so a fresh
  literal is the same defect with a newer number — the `READ ALL FIVE STEPS` route), and the
  follow-up's `Closes when` **widened from "an executed banner" to "an executed banner or a header
  comment"**. ⭐ The old boundary was drawn from where the *first* instance happened to live; the
  `FIVE`/`SIX` instance it already counted was a comment too, so the scope word was wrong before
  this instance existed. ⛔ Four repaired instances in one file is still not the class — the other
  four harnesses are unswept.
- **N3** hub `adrs:` gains `0192`; `npm run features:index` re-run (rc 0, no INDEX diff — the index
  does not render that field, so the omission was hub-local).
- **N4** acceptance criteria 4–6 checked, with B1's finding recorded as a quote block under 4.
- **N5** archive/open-register deltas corrected against this turn's own commit range
  (`22402505` → `6d0db87a`): archive **10311 → 10934**, open **1790 → 1770** (**−20**, not −22).
  ⭐ *A delta quoted from two hand-read endpoints is two chances to be wrong*, and here it was both.

#### R39 — the durable finding, filed rather than papered over

`FUP-AUTHZ-PROOFS-CITED-BY-RECORDS-ARE-NOT-REPRODUCIBLE-FROM-THE-REPO` (🟠 high). Every proof this
unit rests on — now **nine** instrument faults, four mutants, the planted drift reproducer, the
policy-DDL detector's plant, the `RECOVER=1` storage restore, every discrimination half — lives in
out-of-repo scratch plus prose here. QA's phrase is exact: *"attested, not audited"*. When the
scratch is cleared the claims become **unfalsifiable**, which is not the same as wrong and is worse
to review. ⛔ Not fixed by committing logs (a log re-runs nothing); the model is the committed
`SELFTEST=1` arms, which is why R36 could quote `hat` 7/7 as a gate line.

#### Gates for this turn, read BARE

- `node scripts/check-docs-registers.mjs` — rc **0**, OK, ratchets unmoved (`longHeadings=97/97`,
  so the new entry's heading is within cap). ⚠ Its first run this turn was read **through a pipe**
  and printed `rc=0` beside 2 findings; re-run bare it was **rc 1**. *A pipe erases the exit code* —
  caught here, again, on the first gate command of the turn.
- `npm run features:index` — rc **0**.
- ⛔ **`npm run test:db` deliberately NOT re-run.** This turn touched Markdown and one **comment**
  in a `.sh` under `supabase/tests/mutation/`; `supabase test db` collects `.sql`, and those `.sh`
  files were present when `Files=262, Tests=8876` was measured. Nothing here can move the shape.
- ⛔ **The four authz arms NOT run by me** (protocol §4 — the lead runs them at the tip). Which arm
  inputs moved was **measured over all three consumers of this file**, not read off QA's sentence:

  | consumer of `WP_FINDINGS` | arm | before | after |
  |---|---|---|---|
  | `blind_from_findings` (`:325`) | `FROMFINDINGS=1 ARM=policy` — **not** one of §6's four | 16 | **15** |
  | `verdicts_from_findings` (`:542`) | ARM 3, `ARM=census` | 120 | **120**, set byte-identical |
  | `skipped_from_findings` (`:550`) | ARM 3, `ARM=census` | 0 | **0** |

  So exactly one arm's input changed, and it is not a §6 arm. ⭐ **`ARM=census` DOES read this file**
  — QA's "the four arms do not read the `## BLIND` section" is true and is not the same claim as
  "they do not read this file". It survives the row move only because ARM 3 reads labels from
  **every** verdict table, so moving a row *between* tables leaves its input identical as a set.
- ⛔⛔ **Instrument fault 9 — and this one was MINE, introduced by the B1 fix itself.** The first
  draft of the relocation note illustrated the merge's two polarities with a **Markdown table**.
  `verdicts_from_findings` greps `^\| ` and filters only `^\|---` and `gate . policy`, so those four
  lines injected three phantom swept-gate labels — `baseline verdict`, `BLIND`, `COVERED` — taking
  `ARM=census`'s input from 120 to **123**. Found by running the comparison above instead of
  asserting it; repaired by **indenting** the illustration, which is exactly why the merge indents
  CARRIED rows. ⭐ *A fix for a findings-file defect that adds rows to the findings file is the same
  class of defect, one turn later* — and it would have reached the lead's gate run, because the
  arm's verdict tolerates extra labels, so it would have shifted `gates carrying a verdict` from 608
  to 611 in a quoted domain line and failed nothing.
- Production diff still **EMPTY**; Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT
  cleared**; ⛔ nothing was allowlisted.
