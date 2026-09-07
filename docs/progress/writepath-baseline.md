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
| case ~12 | elapsed since `baseline OK` ÷ cases done, against **91 s/case** | record the corrected rate BESIDE the estimate, never over it |
| continuously, from `progress.tsv` | rows off the baseline shape · distinct off-baseline `Tests=` values · **longest consecutive run of the same off-baseline value** | **≥3 consecutive identical off-baseline shapes.** A per-case abort VARIES and the suite RECOVERS; drift never recovers. With `RESET_EVERY=20` this should be impossible — if it happens the reset did not fire and the run is VOID, not patchable |
| at every `--- PERIODIC RESET ---` | preflight clean · policy worklist re-derived UNCHANGED · all 13 `GUARD_KEYS` still resolve · post-reset baseline PASS at the true shape | any `*** ABORT` ends the run |
| at the end | `preconditions: resets=N` | **`resets=0` on a 120-case full run is the exact state that voided the door arm's run 1.** Quote this line in the gate record |

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
