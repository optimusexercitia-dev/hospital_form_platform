# External audit response — AE4/IA-F9 statement-scoped permission path

**Reviewer:** `backend` · **Date:** 2026-09-03 · **Subject:** external audit of branch
`authz-ae4-scope-reaches-fix` @ `1be52b26` (worktree
`.claude/worktrees/friendly-spence-607f77`), which alters `professional_profiles_select`
per ADR 0182.
**Contract:** a disposition record, not a Phase Gate review — CLAUDE.md §6 step 3 is not
reached here (see §2 below). Every catalog/RLS/RPC claim was re-verified against the
**live catalog**, never migration text (CLAUDE.md's binding exception); performance claims
were independently reproduced with rolled-back probes, not read off the audit's numbers.
**Verdict:** four findings, none upheld as filed. **Finding 1 (HIGH)** — mechanism
confirmed, severity overstated, and the audit's own condemning data point is buried
evidence for a real defect it never names: P2's instrument cannot tell a resolver
invocation from an off-path node. Being fixed under **ADR 0183**. **Finding 2
(BLOCKER)** — declined; it quotes the tree's own self-labels back at it and blocks a
merge nobody proposed. **Finding 3 (MEDIUM)** — half accepted: the test critique is
sharper than filed and is fixed; the `search_path = ''` remedy is mis-scoped and
deferred to an existing follow-up. **Finding 4 (LOW)** — mostly accepted, one item
mis-diagnosed as a contradiction when it is an undisclosed change of apparatus, and
already filed internally, unactioned, as QA `LOW-6`.

## 0. Why a new file

`docs/reviews/authz-ae4-if9-statement-scoped-review.md` carries a verdict about a
*different subject*: internal QA's Phase-Gate-shaped audit of the same migration, scored
against CLAUDE.md §6 step 3 (⛔ CHANGES REQUESTED, since corrected — PROGRESS.md line 21).
This file's subject is a **third-party** audit with its own severity scale (HIGH /
BLOCKER / MEDIUM / LOW) and its own four numbered findings, filed after that QA round
closed. Appending to the QA file would attach a new verdict, on a different rubric, from
a different author, to a file whose header already asserts a closed one — the same
failure mode `authz-ae4-if9-statement-scoped-review.md` §0 itself exists to avoid ("a
verdict is keyed to a gate's NAME"). A separate, dated file keeps the two records
separable, matching the `<subject>-audit`/`-findings`/`-response` + date-stamp convention
used elsewhere in this directory.

## 1. Finding 1 (HIGH) — O(M²) shape, P2 blind to it

**Verdict: mechanism CONFIRMED, severity OVERSTATED, and the instrument half is
UNDER-stated — that half is the real, accepted defect.**

**Confirmed from the live catalog.** `authz.authorized_scope_ids` performs 1 ×
`assignment_facts` (the materialized candidate CTE) + **D × `has_permission`**, each
re-entering `entailed_grants` → `assignment_facts`. Both functions are `SECURITY
DEFINER`, so Postgres never inlines them — genuinely `1 + D` executions per statement.
This is **not concealed**: the migration header
(`supabase/migrations/20261003007320_ae4_statement_scoped_authorized_scope_ids.sql:101`)
already states "⚠ SHAPE BOUND. This is O(distinct candidate scopes) `has_permission`
calls per statement, and O(1) in protected rows."

**Independently reproduced**, not taken from the audit — rolled-back two-factor probes,
cost fitted as `buffers ≈ (1 + D) · (96 + 5.7·M)`:

| M (D fixed at 3) | buffers | D (M rising 6→15) | buffers |
| --- | --- | --- | --- |
| 7 | 409 | 2 | 342 |
| 32 | 1017 | 3 | 417 |
| 57 | 1617 | 5 | 585 |
| 107 | 2833 | 8 | 744 |
| — | — | 10 | 843 |

**The audit's operating point is fabricated.** `D` is the count of distinct
organizations a principal holds any membership under. The fixture ceiling, measured, is
**M = 20, D = 5**, and only **13 organizations exist** in the fixture. The audit's `D =
82` requires roughly 80 synthetic organizations — one person holding `staff_admin`
memberships across 82 tenants, a shape nothing in this schema's seed, fixture, or
tenancy model constructs.

**Strict improvement holds even at the audit's own worst case.** The recorded change is
`1 001 345 buffers → 402`; the audit's own condemning data point, `28 376` buffers, is
still far cheaper than the pre-change path measured at M = 20 — and the pre-change path
scaled with M too. "The work was displaced into an unbounded loop" is the wrong framing:
the residual term (`1 + D` confirmations) is smaller than the term it replaced (one
`has_permission` call per protected row) at every M and D this platform can construct.

**ACCEPTED — the finding the audit buries under the D=82 framing.** The acceptance doc's
own §13.2 re-statement (the ADR 0182 amendment) says `assignment_facts` is invoked
"once per STATEMENT." Perf run 6 recorded
**7** invocations and scored **PASS**, justified by "every node `loops=1`" — a property
invariant to D and therefore incapable of failing. This is now being fixed under **ADR
0183** (in progress on this branch, another workstream): P2 is re-specified as a bound
`A = 1 + U` (U = the resolver's own measured candidate cardinality) with an executable
checker keyed on `pg_stat_get_function_calls(oid)`, replacing the `loops=1` grep.

**Correction to the audit, and to an earlier reading of my own.** The `7` decomposes
cleanly and is not anomalous. Verified against
`docs/design/authz-ae4-perf-run6-passB.txt`, M1-nested region (lines 857–5960):

| line | caller | rows |
| --- | --- | --- |
| 2818 | the `candidate` CTE in `authorized_scope_ids` | 20 (= M) |
| 1820, 2746 | `entailed_grants` — the two candidate confirmations | 16 + 4 = 20 |
| 3822 | `entailed_grants` from the **ELSE arm** (foreign org) | 0 |
| 4049, 4792, 5535 | `authz.holds_role` via `can_manage_professional` | 0 (each `loops=1`) |

Three of the seven (`1 + D`, D = 2 — exactly as predicted) are resolver invocations; four
are not. M1-nested is `limit 200` **unfiltered**, so one row fell through the set arm to
`app.can_read_professional_profile`, whose ELSE-arm `has_permission` call and three
`holds_role` calls under `can_manage_professional` are legitimate, separate authorization
work — not resolver re-entry. Nothing here is a shape defect. **The actual defect is
that run 6's P2 evidence counted off-path nodes into its subject** — a criterion that
cannot distinguish its own subject from its neighbours fails the same way as one whose
observable cannot move at all, and it is what let the wrong `7` read as a pass worth
recording.

⭐ **And this was not a subtle omission — the harness forbids it in its own header.**
`scripts/authz-ae4-perf-harness.sql:41-44`:

```
-- ⛔ NEVER `authz.holds_role` alone. It is not even ON this path: has_permission
--    reaches assignment_facts directly through entailed_grants. holds_role is
--    the layer-1 sibling used by app.is_staff_admin_of{,_for}. Measuring it
--    measures the pre-D6 world.
```

Run 6's P2 evidence counted **three `holds_role`-sourced nodes** into its subject. So the
P2 verdict did not merely apply a criterion that could not fail — it broke a rule stated
forty lines into the file that produced the evidence. Neither the external audit nor the
internal QA review caught this, and it is the single clearest argument for re-specifying
P2 over an executable checker rather than a grep: **the rule existed, in the right place,
and prose could not enforce it.**

## 2. Finding 2 (BLOCKER) — E2E/review gates missing

**Verdict: DECLINED as written.**

Both lines the finding cites are the tree's own self-labels, not an omission the audit
discovered:

- PROGRESS.md line 187 (the phase-status row for this work) is titled `⛔ build gates,
  NOT Gate AE4` and ends `⛔ no e2e`.
- PROGRESS.md line 21 (the corrected-QA row) ends `⛔ No merge, no db:push, no git push —
  the AE4 hold stands.`
- PROGRESS.md line 88 (§ Now, the AE4 program row) states `⛔ PO-RULED: HOLD EVERYTHING
  ON THE BRANCH — no merge, no db:push, no git push; the whole phase merges at Gate
  AE4`.

The branch is not merged (still on `authz-ae4-scope-reaches-fix`, currently 111 commits
ahead of `main`), and two prior QA reviews on this exact predicate change both returned
⛔ CHANGES REQUESTED before this session's corrections. The finding blocks a merge
nobody has proposed, against a gate the repository's own tracker says has not been
reached. The residue this finding correctly gestures at — `e2e:prod` owed at Gate AE4 —
was already recorded by the repo first, at the same PROGRESS.md line the finding cites.

## 3. Finding 3 (MEDIUM) — DEFINER `search_path`

**Verdict: half accepted.**

**The test critique is correct, and sharper than the finding states.** pgTAP
`413_ae4_authorized_scope_ids.sql`'s assertion at the affected lines defined "safe
`search_path`" as **equality with a mutable sibling function's value** — if both drifted
to the same unsafe value together, the assertion would still pass. That is not a security
pin; a pin that can drift with its own reference value is not a pin. Fixed in this branch
(a concurrent workstream) with the house direct-constant pattern
(`is(array_to_string(p.proconfig, ','), 'search_path=app, public, pg_catalog', ...)`,
matching `341_dm5_s2_nsp_evidence_substrate.sql:222-225`, `393:241-244`, `396:157-161`,
`292:42-45`), plus a new class-wide sweep,
`supabase/tests/414_definer_search_path_resolves.sql`, asserting every `prosecdef`
function in `app`/`public`/`authz` resolves its `search_path` to schemas that exist in
`pg_namespace`. Measured 2026-09-03: **890** functions in domain, **0** offenders,
**890/890** declaring a `search_path` at all. ⛔ A sweep that starts green is worth
nothing unless it is shown able to bite, so `414` carries three controls that must fire —
a planted collapsed DEFINER, a **dead-instrument** control (the live-population assertion
stays green while the control assertion reds, which is the VOID-not-PASS reading), and a
naive-comma-split control proving the tokenizer is what prevents the broken form being
shredded into three plausible-looking fragments.

⚠ **A correction to that follow-up's own reasoning, found while implementing it.** The
entry argued that quote-matching fails because it "does not survive someone writing
`set search_path to 'app'`". Measured in a rolled-back transaction: Postgres stores that
as `{search_path=app}` — **the quotes are not stored**, so a quote-matcher never sees it,
and the value is harmless anyway. The shape that actually defeats a quote-matcher is the
opposite one: `set search_path to no_such_schema` stores as `{search_path=no_such_schema}`
— no quote, and genuinely broken. (The historical bug shape does store one:
`to 'app, public, pg_catalog'` → `{search_path="app, public, pg_catalog"}`.) The
follow-up's conclusion was right and its supporting example was the wrong case; the
false **negative**, not the false positive, is why the property beats the symptom.

**The `search_path = ''` recommendation is mis-scoped, and declined as filed.** Measured
directly against the live catalog:

```
schema app, prosecdef, proconfig set:
  search_path=app, public, pg_catalog  → 400 functions
  search_path=""                       →   7 functions
  search_path=public, pg_catalog       →   6 functions
  search_path=app, pg_catalog          →   2 functions
```

Flipping one function's `search_path` to `''` against a 400-function house convention
buys no measurable risk reduction and creates a fresh inconsistency. It is also not
closing a live exploit: no application role holds `CREATE` on `app`, `public`, or
`authz` (`pg_namespace.nspacl`: `app` grants `USAGE` only to `authenticated` /
`service_role`; `authz` grants nothing to either) — the collapsed-`search_path`
vulnerability class this recommendation guards against requires a writable schema ahead
of the DEFINER's fixed path, which does not exist here. The repository's own existing
follow-up, `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`
(`docs/followups/follow-ups-open.md`), already names this and prescribes the property-based
close implemented above — a better close than the audit's per-function value change, and
one the audit did not need to independently derive.

## 4. Finding 4 (LOW) — record contradictions

**Verdict: mostly accepted; one item mis-diagnosed as a contradiction.**

**The `8.3 ms` vs `~2.8 ms` pair is not a contradiction — it is an undisclosed change of
apparatus.** `docs/decisions/0182-statement-scoped-authorized-scope-ids.md:130` reports
`402 buffers / 8.3 ms` from a pre-commit candidate measured inside a rolled-back
transaction and read off `EXPLAIN`. `docs/design/authz-ae4-performance-acceptance.md:1144`
reports `402 buffers / ~2.8 ms` from run 6's P5 timing harness, best-of-5. Different
instruments, both individually defensible, presented as if they measured the same thing.

**Worse than the audit found: the `~2.8 ms` figure is stale against its own committed
artifact.** The harness best-of-5 for the permission arm, as actually recorded, is
`3.996` ms (`docs/design/authz-ae4-perf-run6-passA.txt:947`, `P5/permission-arm`). The
coherent `EXPLAIN`-apparatus pair is `402 buffers / 3.842 ms`
(`docs/design/authz-ae4-perf-run6-passA.txt:340` Buffers line + `:348` Execution Time).
§14's own acceptance table (`authz-ae4-performance-acceptance.md:1223`) already carries
the correct P5 figure, `3.996`, so §14.1's prose contradicts its own section's table, not
just the ADR. Correcting forward: name both apparatuses at each site (a concurrent
workstream is making that edit to the acceptance doc and to ADR 0182's Corrections
section, per plan; the applied migration comment is left as committed, corrected in the
ADR instead, per this repo's "prefer correcting forward" convention for applied
migrations).

**Already filed internally, and never actioned.** This exact pair is recorded as QA
`LOW-6` in `docs/reviews/authz-ae4-if9-statement-scoped-review.md:489-490`: "ADR
0182:121 records `402 buffers / 8.3 ms`; §14.1 and the commit message record `402
buffers / ~2.8 ms`. Two labels for the same result, quoted side by side elsewhere,
unreconciled." The external audit rediscovered a defect this repository's own QA had
already named and left open.

**The `git diff --check` item is real but not actioned — cosmetic, declined.** The
trailing whitespace the audit flags is `psql` column padding inside the captured
artifacts `authz-ae4-perf-run6-passA.txt` / `run6-passB.txt`. No gate runs `git diff --check`
against this tree — no `npm` script, no CI workflow, no husky hook (verified: no match
in `package.json` or any `.husky/`/`.github/` config). Editing captured measurement
artifacts to satisfy a check nothing enforces would itself be a change to evidence;
declined.

## 5. A finding this review raised against the audit, and then withdrew

⛔ **Recorded rather than quietly dropped**, per the same rule §13.5 of the acceptance doc
applies to a killed control.

This review initially credited the audit with catching a documentation drift it had not
claimed: the audit said *"all twelve lint gates passed"* while `CLAUDE.md` §8 was said to
state **eleven**. That was **wrong, and wrong in a specific way worth naming.**

**Measured 2026-09-03.** `CLAUDE.md` §8 reads `**TWELVE gates chained**` and lists
`lint:authz-vectors` at **both** audited commits — `git show 9f7fa68d:CLAUDE.md` and
`git show 1be52b26:CLAUDE.md` agree. The twelfth gate landed with AE4 Increment 1
(`f9352511`, 2026-09-01), which `git merge-base --is-ancestor f9352511 1be52b26` confirms
predates the audit. **This tree was never stale, and the audit's figure simply matched it.**

**Where the eleven came from.** The reviewing session's working directory was the *primary
checkout*, on branch `claude/friendly-spence-607f77` — a different branch, whose `CLAUDE.md`
does still say **ELEVEN**. `CLAUDE.md` is auto-loaded from the session's own cwd, so the
stale copy was read and attributed to the audited worktree without either being compared.

**The lesson, which is not about lint gates.** An always-loaded file is read from the tree
the *session* sits in, not the tree under review — and when a review runs against a worktree,
those are different trees that share a filename. A claim about "the project's documentation"
is a claim about a **commit**, and must be measured with `git show <commit>:<path>`, never
read out of ambient context. Zero edits were made to `CLAUDE.md` on this branch as a result.

⚠ The drift on `claude/friendly-spence-607f77` is real but **out of scope here**; it belongs
to whoever owns that branch.
