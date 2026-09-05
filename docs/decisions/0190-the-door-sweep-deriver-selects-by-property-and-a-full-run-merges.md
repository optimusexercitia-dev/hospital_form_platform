# ADR 0190 — The door-sweep deriver selects doors by PROPERTY, scopes what it swept, and a full run MERGES the findings baseline

**Status:** accepted (written at the build step of unit DOOR-SWEEP-DERIVER, Batch 1 of the
pre-AE5 follow-up batches; PO approval pending at the Record step)
**Date:** 2026-09-05 (unit DOOR-SWEEP-DERIVER, branch `authz-door-sweep-deriver`)
**Area:** authorization / door sweep / the diff-scoped case deriver / findings baselines
**Amends:** ADR [0173](./0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) (the
`door-sweep-targets:` notation — §2's single-line grammar becomes a multi-line one, and §4's
declined per-file array gate is taken) · ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (Amendment 1's recipe and Amendment
8's rulings — the deriver's selection boundary, its exit-1 sub-cases and the `SCOPE:` line the
gate record quotes)
**Related:** ADR [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
(subset → scratch; the FULL run is the residual this ADR closes) · ADR
[0148](./0148-ever-held-affiliation-read-visibility.md) ·
`FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` ·
`FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` ·
`FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION` ·
`FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` ·
`FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` ·
`FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN` ·
`FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO` · record
`docs/progress/door-sweep-deriver.md`

> **Number.** 0190 = the highest number on **any** live ref + 1, verified by enumerating
> `docs/decisions/` across every `refs/heads` and `refs/remotes` rather than trusting the
> index's next-free line: `authz-door-sweep-deriver` and `main` top out at **0189**,
> `origin/main` and `origin/HEAD` at **0186**, `origin/authz-c2-tier1` at **0180**. The index
> agreed (**0190**); both were checked because parallel branches collide in sequential
> numbering and the index alone has been wrong before.

---

## Context

`scripts/door-sweep-cases.sh` derives the `CASES=` list for CLAUDE.md §6 step 1's diff-scoped
sweep. It is not a convenience: the recipe says the list is derived by the script, *never by
hand*, and every phase and every AE5 per-role increment will run it. Five follow-ups stood
against it, and a sixth defect was measured while planning this unit.

Every number below was measured on 2026-09-05 against a live local catalog at head
`20261003007340`, with exit codes read bare.

---

## Problem

**P1 — the selection boundary was a SYNTAX.** A function entered `CASES` if its NAME matched
`^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)`, or if its migration
TEXT asserted `security definer` + `returns boolean` + an identity primitive. So
`BASE=9a4bbd22^ TIP=9a4bbd22` — a diff that ADDED the `prosecdef` door
`app.current_professional_read_organizations` — derived **zero** cases, exit 1, and the sweep
that ran used a hand-widened list indistinguishable downstream from a derived one.

**P2 — the hand copy of the arm's domain had already DRIFTED.** `PRED_DOMAIN`
(`p0-authz-door-audit.sh`) carries `or p.proname = 'assert_not_case_excluded'` OUTSIDE its
`t.typname='bool'` clause. Catalog: that function is `void`, `prosecdef = t`, and the domain
evaluates **IN**. The deriver's hand copy demanded `returns boolean` and dropped it — so a
migration touching it derived zero cases from a gate the arm would have swept. ⭐ The drift was
standing inside the file whose own header forbids exactly this.

**P3 — the deriver already OVER-selected into UNPROVEN**, unfiled until this unit. On
`731abda0^..HEAD`: **42** tokens derived, of which **3** resolve to no catalog object at all,
**1** is an INVOKER (another harness's class) and **21** are `prosecdef` functions outside
`PRED_DOMAIN`. `p0-authz-door-audit.sh` reports every unmatched token and the whole run ends
**UNPROVEN**. The paste-able command the deriver printed therefore made an AE5 increment
touching the authz resolvers unprovable.

**P4 — the ADR 0173 declaration was read by a parser narrower than its notation, on a code
path that never ran for the file the follow-up is about.** The marker grep was anchored per
line, so continuation lines were silently unread (three migrations in tree use the form). And
the whole marker block sat inside `if … grep -qiE 'pg_get_functiondef'`, while
`20261003007250` contains `pg_get_functiondef` **zero** times: its declaration path never
executed at all, its targets surviving on the unrelated `create or replace` name path. The two
paths agreeing is what hid it.

**P5 — `alter function … security definer` was invisible.** The function branch matched a
`create function` CHUNK BODY; an `ALTER` has no body. ADR 0079 Amendment 8 ruling 1 fixed
exactly this for `alter policy`; ⭐ the same defect survived one branch over. A `prosecdef`
flip on an existing boolean gate derived zero cases and read as clean.

**P6 — the file set was a UNION reported as one diff.** Committed range ∪ working tree ∪
untracked, with no attribution. At AE1.3: **53 cases derived where AE1.3 owned 1**. Dropping
the working-tree and untracked sources is not the fix — that is the blindness the script's own
header exists to prevent.

**P7 — a FULL sweep destroyed the committed findings baseline's hand-authored material.** ADR
0153 sent a SUBSET run to scratch, by design covering the subset half only. A full run still
emitted `docs/reviews/authz-door-audit-findings.md` through a truncating redirect, and that
file is not purely generated: by the property it carries **eight kinds** of hand-authored
material across 924 lines. The follow-up names three of them. The door harness's own startup
warning matched **8** blocks; the write-path twin's wider pattern matched **16** on the same
file.

---

## Decision

### D1 — A DOOR is a catalog fact. SWEEPABLE is a strictly narrower second question.

> A **door** is an object the diff creates, replaces, alters or declares that the **live
> catalog** resolves to either (a) an RLS policy, or (b) a function in `app`/`public`/`authz`
> with `prosecdef = true`.
> **Sweepable** additionally satisfies `PRED_DOMAIN`, lifted verbatim from the arm and
> **evaluated by the catalog**.

`CASES` is **tier 2 only**. Tier 1 ∖ tier 2 is printed as *"doors identified, not sweepable by
this arm"* with the catalog's reason (return type, `setof`), and owes a **targeted** mutation
case. ⛔ Putting tier 1 in `CASES` is forbidden: ADR 0079:161-169 hazard 4 — a requested token
the arm cannot match makes the whole run UNPROVEN, so over-selection does not cost "~1 min of
sweep", it costs every verdict in the run.

Nothing is dropped silently. Every text-derived candidate lands in exactly one **printed**
bucket: `CASES` · DOORS-NOT-SWEEPABLE · INVOKER (routed by name to
`p0-authz-invoker-audit.sh`) · UNRESOLVED.

*Measured:* `731abda0^..HEAD` 42 → **20** cases, tier 1 = 41 doors identified, and **0** tokens
resolving to neither `pg_policies.policyname` nor `pg_proc.proname` (was 3). Three doors the
name filter had dropped entirely — `current_professional_read_organizations`,
`authorized_scope_ids`, `candidate_authorized_scope_ids` — are now identified, so P1's class
closes past the one name that raised it.

### D2 — The deriver ASKS for `PRED_DOMAIN`; it never copies it. Residual `$` is an ABORT.

The nine-line `PRED_DOMAIN` string is lifted whole (`grep -m1` returns the single character
`(` for it, which is worse than failing), and its three sub-variables are expanded by
**explicit substitution, never `eval`** — the value is SQL, not shell. If any `$` survives all
three, the arm's domain has grown a variable this script cannot resolve and the run **ABORTS
(2)** printing the unresolved domain. ⛔ It does not fall back to a remembered filter: that is
the drift the lift exists to end.

### D3 — Absent from the catalog is an UNRESOLVED OBLIGATION, never an ABORT.

Measured over the last 15 migrations: 2 of 22 function names (`explain_direct_permission`,
`has_direct_permission`) resolve to nothing because a **later** migration dropped them. "Absent
→ exit 2" would therefore abort ordinary historical ranges. UNRESOLVED names both causes — *the
migration is not applied yet* (run `supabase db reset --local` and re-derive) and *the object
never existed or was later dropped* — and the token stays out of `CASES`.

### D4 — With NO catalog the deriver falls back to the text heuristics, loudly, and never goes blind.

The classification is skipped entirely, the pre-2026-09-05 union is derived verbatim under a
provisional banner, and an `ALTER`-derived name becomes an obligation rather than a case
(nothing can say what an altered function returns without the catalog). *Measured:* the
no-catalog derivation was byte-identical to the pre-change 42-token list at the point D1
landed. ⚠ The consequence is honest and pinned by the self-test: with the stack down,
`assert_not_case_excluded` is **not** derived, because the property fix is catalog-based. The
run says so.

### D5 — The `door-sweep-targets:` grammar is multi-line, read unconditionally, and CONSUME-OR-STOP.

Amending ADR 0173 §2:

```
declaration       := marker-line continuation-line*
marker-line       := ^\s*--\s*door-sweep-targets:\s* target-list
continuation-line := ^\s*--\s+ target-list        (only directly after a declaration line)
target-list       := target ( \s*,\s* target )* \s*,?
target            := (app|public|authz).name [ '(' … ')' ]
```

The read is **unconditional** — the declaration is a notation about DOORS, not about rewrites,
and gating it on `pg_get_functiondef` is the same class of defect as parsing only its first
line. A `--` line carrying ≥1 `(app|public|authz).name` token is a continuation and every token
on it is consumed; a `--` line with **no** such token ends the declaration silently, because
`20261003007180:9` and `20261003007190:6` are bare `--` lines and strict rejection would red two
committed migrations at every gate. A continuation bearing a schema prefix with no name, or an
unclosed argument list, is a **named** parse error at `<file>:<line>` and the run continues — a
parse error in a comment must not decide a sweep.

*Measured:* the wider read added **zero** cases on `731abda0^..HEAD` and exactly one new
UNRESOLVED token; over all 11 marker-bearing migrations in the tree, **0** parse errors.

### D6 — `alter function … security definer` is grepped like `alter policy`.

The `security definer` clause is mandatory in the match: `20260620000000_baseline.sql` carries
**449** `ALTER FUNCTION … OWNER TO "postgres"` lines and yields **0** under the committed regex,
while the tree's only real instance yields 1. The name goes through D1's catalog resolution like
every other candidate, and the run says that an ALTER keeps the NAME while changing what the gate
IS — ruling 3's logic, one branch over.

### D7 — Extraction is PER FILE; a case carries its provenance and a run carries its SCOPE.

Every file gets its own extraction; the aggregate lists are the union. Cross-file reconciliation
(a policy dropped in one file and recreated in another; a name selected in one file and excluded
in another) stays global — per file it would manufacture an orphan or a false exclusion.

The run prints **one `SCOPE:` line the gate record quotes VERBATIM**:

```
SCOPE: 14 file(s) — 14 committed (731abda0^..HEAD), 0 worktree, 0 untracked | filter: none
       18 case(s), attributed (a case named by two files is counted in both): …
```

plus a PROVENANCE block mapping every derived case to the file(s) that named it, and two
filters, `SCOPE=<migration-id floor>` and `PATHS=<prefix>`, echoed in the header and in the
`SCOPE:` line. ⚠ Quote it; do not paraphrase it — "53 cases" is exactly the kind of number a
paraphrase keeps while dropping the bound that made it meaningful.

**This also takes the fix ADR 0173 declined.** 0173:387-393 measured that the `array[` gate was
evaluated over the CONCATENATED content, so one migration building an array enabled the fallback
for every other migration in the range, and recorded the fix as a structural change "not taken
here". Per-file assembly is here for attribution, and the gate came with it. *Measured:* 20 → 18
cases; the two dropped are `is_active` and `has_role` — a replacement literal and quoted
`replace()` operands, exactly as 0173 predicted in writing.

### D8 — A FULL run MERGES the findings baseline. The property is the COMPLEMENT, not a pattern list.

> **Hand-authored** = any line of the committed baseline **this run's generator did not
> produce**.

`scripts/lib/merge-findings-baseline.sh` is shared by all four sweeps (ADR 0153 D3 already ruled
the property bound). Each harness's `emit_report` is split into a pure `emit_body` generator and
a placement step; a full run merges against a snapshot of the baseline taken **once** at startup,
so every per-case emit is idempotent and a mid-run kill still leaves a coherent partial report
carrying the hand material. A subset run still copies to scratch.

Rows are keyed on column 1 exactly as `p0-authz-invariant.sh` keys them, **plus an ordinal** —
the door baseline carries `app.can_sign_section(…)` twice and keying on the name alone silently
lost 5 rows in this helper's first run. Then:

| case | what happens |
|---|---|
| key only in the generated file | newcomer — emitted |
| column 5 identical | nothing hand-authored — emitted |
| verdict UNCHANGED and the baseline note starts with the generated note | the remainder is a hand suffix, **spliced back byte-for-byte** |
| verdict CHANGED, or the generated part of the note moved | the row is re-emitted WITHOUT the old suffix and the note is **CARRIED** with `old -> new` |
| key only in the baseline | the gate is absent from this run's domain — the row is removed and the note carried |

⛔ A RENAME is indistinguishable from disappear + newcomer and is deliberately **not** detected;
the baseline's own `## Note — a RENAME moves a gate's verdict` carries that semantics, and a
guess here would move a verdict onto a predicate nobody measured.

⛔ **Do not close P7 by extending the subset guard to full runs.** A full run *should* rewrite the
generated rows; the property to preserve is the hand-authored material, not the file.

### D9 — The merge SELF-VERIFIES, and the verification is proven able to fail.

Every hand-authored line and every hand suffix must be present in the output, and the generated
row multiset must equal the merged one — or the merge **ABORTS (2)**, the output is not written,
and the committed baseline is left exactly as it was. The harness says so loudly and continues;
the verdicts it has earned live in the generated report and in `progress.tsv`.

`MERGE_FAULT=drop-hand-block` / `drop-suffix` (self-test only) delete one item from the output
just before verification; both ABORT, at all four call sites. ⚠ **Deleting a hand block from the
INPUT copy does NOT fire the verification** (measured: rc 0) — the verifier is keyed on its own
input, so removing material from the input moves the expectation with it. Only a fault in the
merge can fire it, and that is what the fault injection is for.

**One heuristic exists and it is disclosed.** Inside a diff CHANGED group an old line is dropped
when some new line in the same group is identical once digits and repeated blanks are removed
(`Baseline: Files=156, Tests=4796` → `Files=256, Tests=8579`); without it a regenerated statistic
would be duplicated rather than replaced. It decides **placement, never preservation**: every
line it drops is printed as `REPLACED … (the only legitimate drop)` and excluded from the
survival set explicitly.

### D10 — Exit codes keep their meanings. Exit 1 gains three named sub-cases.

`0` DERIVED · `1` FINDING · `2` ABORT · `3` NOT-APPLICABLE — unchanged. Exit 1 now names which
finding it is: **no doors at all** (catalog-resolved, so obligation (b) is a checkable claim
rather than a filter's silence) · **doors identified, none sweepable by this arm** (obligation
(b) is provably FALSE — do not write it) · **no catalog, so "no door" has not been checked**.
Exit 2 gains exactly one new trigger, D2's lift drift. ⛔ There is still no `ACK` env var.

### D11 — `SELFTEST=1` is a Phase-Gate-step-1 instrument, not a lint gate.

`SELFTEST=1 bash scripts/door-sweep-cases.sh` runs 15 scenarios over committed fixtures in a
throwaway repo holding `cmp`-verified copies of the real scripts. It is **not** in
`npm run lint` — it needs `$TMPDIR` and, for most scenarios, the local stack, and lint must stay
runnable with the stack down. Catalog scenarios SKIP loudly and the summary prints the COUNT.
Four scenarios pin the pre-fix behaviour as ABSENT. *Measured:* 15 PASS / 0 FAIL on this branch;
**3 PASS / 12 FAIL, rc 1, against the pre-unit deriver with the same fixtures and assertions**.

### D12 — Two in-tree assertions are now FALSE and are named here as superseded.

Migrations are forward-only, so neither can be edited:

- **`supabase/migrations/20261003007180_d2_notification_expiry_term.sql:18-23`**, the paragraph
  beginning *"⚠ WHY FOUR SEPARATE MARKER LINES RATHER THAN ONE WITH CONTINUATIONS"*. It states
  that a continuation line *"does not match that prefix and is silently unread"* and that
  `20261003007250`'s other three targets *"survive only because it is a DROP+CREATE"*. Both
  clauses were TRUE when written and are FALSE under D5: the continuation form is the notation,
  and `…007250`'s targets now derive from the declaration path alone (proven with its
  `create or replace` lines removed). The file's four one-line declarations stay valid — the
  reasoning for them is historical, not a constraint. ⚠ Cited by content as well as by line
  number, because a line number rots when its artefact moves.
- **`supabase/tests/mutation/p0-authz-door-audit.sh`**, the §7.17a heading that reads
  *"WHY THIS IS A PROPERTY NOW AND NOT ONLY A NAME (FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME;
  ADR 0079 Amendment …)"* — it cited **Amendment 8**, and that follow-up belongs to **Amendment
  9** (Amendment 8 is the ALTER-POLICY / stale-verdict ruling). Corrected in this unit, verified
  against ADR 0079's own headings. A citation is an assertion that goes stale silently, and this
  one pointed a reader at the wrong decision. ⚠ The unit brief inherited the line number `:433`
  from an earlier snapshot; at HEAD the line is `:461`, which is exactly why the anchor here is
  the heading text.

---

## Considered options

**A. Widen `PRED_NAME_RE` to admit the missing door.** ⛔ Rejected, and the follow-up says so
explicitly: it fixes one name and leaves the boundary a syntax, so the next door named outside
the pattern reproduces the defect exactly.

**B. Put every identified door in `CASES` and let the sweep sort it out.** ⛔ Rejected: ADR 0079
hazard 4. A token the arm cannot match makes the run UNPROVEN — the very outcome P3 measures.

**C. Widen `PRED_DOMAIN` here so `current_professional_read_organizations` becomes sweepable.**
⛔ Out of scope and not this unit's to take (Batch 2, `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS`).
⭐ Because the deriver now **lifts** the domain, that widening will admit the door with **no
deriver change** — the hand-off is mechanical.

**D. "Absent from the catalog" ABORTS the derivation.** ⛔ Rejected on a measurement: 2 of the
last 22 names are absent because a later migration dropped them, so it would abort ordinary
historical ranges.

**E. Reject an unmatched `--` line after a marker as a parse error.** ⛔ Rejected on a
measurement: two committed migrations end their declaration with a bare `--` and would red at
every gate. Consume-or-stop is the rule; the loud case is narrowed to a token that fails to
parse.

**F. Detect renames in the merge.** ⛔ Rejected: indistinguishable from disappear + newcomer, and
a wrong guess moves a verdict onto a predicate nobody measured.

**G. Extend ADR 0153's subset guard to full runs.** ⛔ Rejected by the follow-up itself: a full
run should rewrite the generated rows.

**H. Keep a pattern list for the hand-authored blocks and widen it.** ⛔ Rejected: the two
existing patterns disagree by a factor of two on the same file, and by the property that file
carries eight kinds. A warning whose number comes from a filter is only as true as the filter.

---

## Consequences

- The diff-scoped sweep's case list is now a claim about the **catalog**, and a hand-widened
  list is visibly a widening. `CASES` on `731abda0^..HEAD` drops 42 → 18 while the DOORS
  IDENTIFIED count (41) makes what was removed visible rather than absent.
- ⚠ Everything the deriver says about doors now **depends on a reachable catalog**. With the
  stack down it degrades to the old text heuristics, says so, and cannot be read as a
  property-based derivation. The gate record must quote the `SCOPE:` line, which names the
  filter but not the catalog — so an operator reading a provisional run must not record it as
  derived-by-property.
- A full sweep can now be run without hand-restoring the baseline afterwards, which is the
  precondition Batches 2 and 3 were waiting on. ⛔ No full sweep was run in this unit: the merge
  is proven on COPIES, and the four committed baselines are byte-identical.
- Two doors that the array-gate over-selection used to add (`is_active`, `has_role`) are no
  longer swept. They were never doors this range touched; if a future migration genuinely
  rewrites them, its own marker names them.
- `p0-authz-invariant.sh`'s `verdicts_from_findings` and `blind_from_findings` keep working
  against a merged file: the merge writes rows in their key format and puts carried notes in
  bullets, which neither extractor reads.
- The deriver is slower: it now runs one catalog query and, per candidate, a lookup. On a
  14-file range this is seconds. Over the whole migration history it is minutes — a range that
  large is not a use this instrument is for, and the per-file loop makes the cost linear in
  files rather than in the concatenation.
