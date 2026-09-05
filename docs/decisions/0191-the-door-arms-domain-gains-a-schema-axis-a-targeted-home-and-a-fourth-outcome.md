# ADR 0191 — The door arm's domain gains a SCHEMA axis, the set-valued resolvers get a committed home, the read arm stops being mirror-ambiguous, and a fourth outcome stops discarding a real signal

**Status:** proposed (unit PRED-DOMAIN, Batch 2 of the pre-AE5 remediation batches; awaiting PO
approval of the unit)
**Date:** 2026-09-05 (branch `authz-pred-domain`)
**Area:** authorization / the door-blindness sweep / measurement domains / findings baselines
**Amends:** ADR [0173](./0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) (§4
"`PRED_DOMAIN` is NOT widened. The bound is NAMED and ROUTED to C2" — the bound is now widened
along a THIRD axis §4 did not consider, and §4's own reason is why that is consistent) · ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (Amendment 9's "NAME *or* PROPERTY"
domain gains a third admitting disjunct; the §7.15 shape classifier gains a fourth outcome; the
arm gains a printed DOMAIN STATEMENT)
**Related:** ADR [0182](./0182-statement-scoped-authorized-scope-ids.md) (the set-valued
resolvers; it records NO suite shape and NO verdict tokens, which is why they owe FIRST verdicts)
· ADR [0184](./0184-c2-sweep-runs-against-the-current-branch-schema.md) point 4 + ADR
[0187](./0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md) D1 (the
uncovered populations a gate record must state — this ADR adds the fourth) · ADR
[0190](./0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) (the deriver
LIFTS `PRED_DOMAIN`, so this widening needs no deriver change; and the merge this re-baseline is
the first real exercise of) · ADR [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
· ADR [0171](./0171-c2-tier-2-deferred.md) · ADR [0176](./0176-ae49-resolver-contract.md) D4 ·
`FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` ·
`FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` ·
`FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` ·
`FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` ·
`FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN`

## Context

`supabase/tests/mutation/p0-authz-door-audit.sh` is the instrument behind CLAUDE.md §6 step 1: it
neutralizes each authorization gate, runs the whole pgTAP suite, and reads whether **anything**
noticed. ADR 0079's governing sentence is that **a green arm bounds its own domain** — a verdict
is meaningless without the domain printed beside it.

Five open follow-ups all said the same thing about this arm from five directions: **its domain is
smaller than its name**, and in one place its verdict claims more than it measured.

AE5's eleven per-role increments re-key enforcement sites onto exactly the population the arm
cannot select. That is what made this a batch rather than a backlog item.

## Problem

1. **`authz.scope_reaches` and `authz.candidate_has_permission` are `prosecdef` BOOLEANS in no
   arm's domain.** They match neither `PRED_NAME_RE` nor `PRED_IDENTITY_RE` — measured on the live
   catalog 2026-09-05, `by_name = f` and `by_identity = f` for both, because their bodies reach
   identity only through `authz.*` helpers the identity regex does not name. `authz.has_permission`
   *is* in domain, by `^has_`. So the resolver family was swept **on one axis only** and the green
   from that axis read as if it covered the family. `candidate_has_permission` held **no verdict of
   any kind**.
2. **Three more are excluded by RETURN TYPE.** `authz.authorized_scope_ids`,
   `authz.candidate_authorized_scope_ids` and `app.current_professional_read_organizations` return
   `SETOF uuid`, so `t.typname='bool'` drops them before any regex runs. A regex cannot fix a
   type bound.
3. **A `FOR ALL` COVERED was mirror-ambiguous.** The read arm bounded itself `polcmd in ('r','*')`
   and opened `using (true)` **and** `with check (true)` together, so a COVERED on an ALL policy
   could be earned entirely by a **write** keystone — the mirror of the defect the write arm had
   already fixed for itself. Two arms, one bug, one of them corrected.
4. **A broad gate that makes a file ABORT threw away a real signal.** `app.event_current_custodian`
   opens → `140_patient_safety.sql` reds its test 11 and then aborts, the denominator moves, and
   §7.15 recorded ERROR. The suite plainly noticed; ERROR says *unclassifiable* and sits beside 28
   genuine harness bugs.
5. **Trigger enforcers can never enter this arm, and nothing said so.** Postgres invokes a trigger
   from the TABLE, so a trigger function has no call edge from the door that fires it and no
   boolean to flip. `public.reopen_interview` came back BLIND while `121_interviews.sql` pins its
   `HC038` — because the `HC038` observed belongs to `app.guard_interview_status`, a trigger. A
   trigger-caused BLIND and an absent-assertion BLIND need **different** remedies and the findings
   file cannot tell them apart.

## Decisions

### D1 — `PRED_DOMAIN` gains a THIRD admitting disjunct: `n.nspname = 'authz'`, bounded at `bool`

A `prosecdef` **boolean** in the `authz` schema is an authorization predicate **by virtue of its
schema**. No application role holds USAGE on `authz` (pgTAP 401 §18), so a `SECURITY DEFINER`
function there exists to answer an authorization question; there is nothing else it could be.

**Written LITERALLY, not as a fourth sub-variable** (PO ruling Q4). `scripts/door-sweep-cases.sh`
lifts `PRED_DOMAIN` verbatim and expands exactly three sub-variables, aborting on any surviving
`$`; a new variable would have required a deriver edit and put its 34/0 self-test at risk for no
gain.

⛔ **Bounding it at `bool` is load-bearing, and it is MEASURED rather than defensive.** Ten
`prosecdef` functions live in `authz`; only **4** are boolean. An unbounded `n.nspname='authz'`
would admit the other **6** — `assignment_facts`, `authorized_scope_ids`,
`candidate_authorized_scope_ids`, `entailed_grants`, `explain_permission`,
`rebuild_implication_closure` — which the direction classifier labels `positive`, whose
neutralization is `select true`, which does not type-check against `record` / `SETOF uuid` /
`permission_explanation` / `int4`. That is **6 guaranteed ERROR rows**: the widening-by-TYPE trap
the script's own header declined, re-entered through the schema door.

⭐ **This is why ADR 0173 §4's refusal does not reach this axis.** §4 declined to widen
`PRED_DOMAIN` because doing so would change the **neutralization model**, and its four subjects
return `int4`/`responses`. The `bool` bound leaves the neutralization model untouched: the two
newcomers are `language sql` booleans classified `positive`, neutralized to `select true` exactly
like the other 125. §4 is amended in its scope, not contradicted in its reasoning.

**Selection is the success criterion, and it was proven by SELECTION, not by a passing sweep**
(ADR 0173 §4's own words). Measured on a fresh reset, running the real script's own worklist
queries at HEAD and at the widened text:

| | before | after |
| --- | --- | --- |
| `PRED_TOTAL` | 125 | **127** |
| `PRED_OUT` (§7.17b census) | 37 | **35** |
| delta (in after, not before) | — | **exactly** `authz.candidate_has_permission`, `authz.scope_reaches` |
| reverse delta (in before, not after) | — | **0 rows** |
| newly OUTSIDE the census | — | **0 rows** |
| the legitimately-outside set | 35 | **35, unchanged** |
| policy worklist | — | **byte-identical** |

⚠ The `!~ '^is_valid_'` clause is **pre-existing** (ADR 0079 Amendment 9's "minus `^is_valid_`"),
not part of this widening, and is **measured inert**: zero `prosecdef` booleans match
`^is_valid_` on this catalog. It is kept because dropping it would edit a bound ADR 0079 recorded,
for no measured effect.

### D2 — The bound, stated as this arm's domain and accepted as such

> `prosecdef` boolean in app/public/authz by authz-shaped **name**, identity-touching **body**, or
> `authz` **schema** membership, minus the 2 side-effecting writers; the 35 outside are enumerated
> per run in §7.17b and in the `DOMAIN-STATEMENT`.

PO-accepted 2026-09-05 as the arm's stated domain. It is still an **approximation** of "is an
authorization predicate" — a gate reaching identity only indirectly through a helper the regex
does not name, in `app` or `public`, remains outside — and the census is what keeps that admission
attached to every report.

### D3 — The set-valued resolvers are swept by TARGETED cases with a committed, scheduled home

`supabase/tests/mutation/authz-setvalued-targeted-cases.sh`. Only a boolean predicate is sweepable
by the door arm's mechanism (ADR 0079 hazard 4), so this family cannot be fixed by any widening of
`PRED_DOMAIN`.

⛔ **The scope is an EXPLICIT RECORDED LIST of three, not a derived property, and the correction
matters.** The follow-up proposed "a scope-id set **consumed by a policy**" as the selecting
property. **Measured 2026-09-05, that property selects exactly ONE of the three**: only
`app.current_professional_read_organizations` is named by an RLS policy
(`professional_profiles_select`); the two `authz.*` resolvers are reached only **transitively**,
through it. A property that selects 1 of 3 while being described as selecting the family is
precisely the shape this program exists to catch, so the list is written down and its
**cardinality** is asserted instead (§4b): the live population of `prosecdef` `SETOF uuid`
functions must equal the **five** the file rules on — 3 in scope, plus `app.eligible_voters`
(recipient computation under ADR 0173 §4's "iterate → recipients; branch → authority" discharge,
and `authenticated`-EXECUTE-able so it owes the **census** its verdict) and
`app.person_authority_orgs` (an affiliation footprint; EXECUTE for no application role) named out
of scope **with their dispositions**. A sixth appearing reds there rather than passing silently.

**Neutralization = the UNIVERSAL SET**, signature / `SETOF uuid` / `STABLE` / `SECURITY DEFINER` /
`search_path` preserved. ⭐ That is strictly stronger than `select true` could be for this shape:
it does not merely grant, it grants **every** scope, so a caller that had begun ignoring its own
scope argument is still measured.

⛔ **It ships its own degeneracy arm, because the existing one cannot see this shape.**
`DEGENERATE_PREDICATE` matches `select true` / `begin return true; end` / `begin return; end`; a
universal-set body matches none, so a crash residue of this harness would not stop the sibling
sweeps. Two locks of **different kinds**:
- **§4a — residue by PROPERTY, baseline-free.** Every `prosecdef` `SETOF uuid` function whose
  comment-stripped body references no authorization term is residue. Enumerated to **0** on a
  clean tree, and **proven able to fire on every run**: while each mutation is live the check must
  NAME that function, or the harness aborts. The proof is the run itself, not a knob.
- **the MARKER form**, added to BOTH hand-kept `DEGENERATE_PREDICATE` copies, so this harness's
  residue stops the p0 sweeps the way theirs stop each other.

⚠ ADR 0182 records **no** suite shape and **no** verdict tokens for these three, so the verdicts
they hold are hand-run and un-anchored. The verdicts earned here are their **first recorded**
ones. ⚠ And a verdict is recorded **at a suite shape**: 0182's own increment had to RE-EARN a
verdict when pgTAP 413 grew five assertions.

### D4 — The read arm opens the `using` half ALONE

At the policy arm's open: `alter policy … using (true)`, with no `with check (true)`. Capture,
restore and the in-flight probe still cover **both** halves — the restore must return the policy
exactly as it was.

⚠ **Measured precondition, not assumed:** all **62** `FOR ALL` policies in domain carry a non-null
`polwithcheck`. That matters, because Postgres falls back to `qual` for the check when
`polwithcheck IS NULL` — on such a policy `using (true)` alone would open the write half anyway
and the fix would be **vacuous** for it. The harness now derives that set every run and
**discloses** any member; today it is empty.

⛔ **This is strictly weaker, so only COVERED → BLIND flips are possible**, bounded by the 51
COVERED `(ALL)` rows in the baseline. Those flips are **findings, not regressions**: each one is a
`FOR ALL` policy whose read half no keystone exercises, which was previously masked by a write
keystone. **They are disclosed, never relabelled** (PO ruling Q1) and carried as a named keystone
work-list in `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`.

**D4a — the direction column stays `open->true` (deferred, deliberately).** Re-keying it to
`open using->true` would change columns 1–4 of all 62 ALL rows; the merge splices only when
columns 1–4 are identical, so every one of them would land in `CARRIED` as pure formatting noise
for a human to re-file. The half is recorded in **prose** — in `emit_body`'s domain paragraph, in
the `DOMAIN-STATEMENT`, and on the run banner. ⚠ The option is deferred, not rejected: the moment
a re-baseline is happening for another reason, re-keying costs nothing extra.

**D4b — row KEYS are unchanged, and that is not cosmetic.** `p0-authz-invariant.sh` labels these
`relname.polname (ALL)` and `verdicts_from_findings` keys on column 1. A key migration would leave
62 ALL policies **UNKNOWN** in `ARM=census` — an arm going green because it stopped recognising
its own subjects.

### D5 — A FOURTH classifier outcome: `NOTICED`

Shape moved **AND** `Result: FAIL` → `NOTICED`. Every **other** shape move stays `ERROR`.

The follow-up's option (a) — a bespoke neutralization per aborting case — is the wrong instrument
for this class: the abort is `140`'s own value assertion whose subject now raises (LEARN-083), not
a defect in the neutralization, so there is nothing bespoke to write. And the class grows as the
arm's domain grows: a broader gate is exactly the kind whose opening makes some file abort.

⛔ **`NOTICED` never collapses into COVERED and is never a pass.** It has its own count on the
report line and its own place in the tables; it is in the DIRTY test, so it exits 1 exactly like a
BLIND; and it claims strictly **less** than COVERED, because with the denominator moved the
failing assertions may belong to a different gate entirely. `COVERED` is computed as the residual,
so `NOTICED` is subtracted there too — a fourth outcome must not inflate COVERED by arithmetic
after being kept out of it by logic.

Proven on four constructed strings with **the control named**: (shape-moved, PASS) → ERROR is what
distinguishes this from renaming ERROR. The instrument was itself proven able to fail, and the
pre-change classifier was run over the identical strings.

### D6 — Every run prints a `DOMAIN-STATEMENT`, and it names FOUR uncovered populations

Quotable exactly like the deriver's `SCOPE:` line, printed on stdout and emitted into the findings
header. It states, **derived from the live catalog each run, never literal**:

1. **Tier 2 — 190 doors, deferred by ADR 0171, not cleared** (ADR 0187 D1's required wording).
2. The `HCDS*` family (60 raises) and `28000` (6) — structurally absent from the C2 worklist.
3. The C2 ERROR class — ~10 enforcers expected, no verdict.
4. ⭐ **Trigger enforcers** — `prosecdef` trigger functions behind wired triggers (**174 / 268**
   today, re-derived every run). A trigger has no call edge from the door that fires it, so a
   trigger-caused BLIND is **indistinguishable here** from an absent-assertion BLIND: the first is
   discharged only by a keystone on a fixture the **trigger** does not already refuse, the second
   by a keystone on the door. A defence-in-depth pair can therefore look like a gap.

Plus this arm's own bounds: `PRED_OUT`, the 2 side-effecting writers, the value-returning
raise-guards, the set-valued family with a pointer to its home, and the `using`-half statement.

⛔ **Not an allowlist entry**, which the follow-up explicitly rules out: `reopen_interview` is not
never-called and its verdict is not wrong. What was missing is the **domain beside the verdict**.

### D7 — The findings baseline is re-earned through the merge, and every CARRIED row is a human decision

The full run is the **first real exercise** of ADR 0190's merge on the committed door baseline.
Provenance is fixed by measurement, not by trust: the committed file's `cksum`/`md5` are
snapshotted before the run; the merge is verified three ways after it (bare rc; a `MERGE_VERIFY`
pass over the merged file; enumeration of all 9 `HAND-MERGED` blocks and the `CARRIED` block row by
row); and `git status --short` must show only that file changed.

⛔ **No `CARRIED` row is re-attached silently.** They are enumerated for the PO — key, current
verdict, note, which arm's file the row belongs to, and a recommended disposition (re-attach /
retire-to-another-arm / delete deliberately) — and the re-baselined file is committed only after
that ruling.

## Considered options (and why they lost)

- **Widen `PRED_DOMAIN` by RETURN TYPE.** Rejected — it changes the neutralization model and
  manufactures 6 guaranteed ERROR rows in `authz` alone (ADR 0173 §4 was right about this).
- **Rename the resolvers to `has_*` / `is_*`.** Rejected — ADR 0079 Amendment 9 already recorded
  that the rename workaround makes coverage depend on a naming convention no gate enforces.
- **Select the set-valued family by "consumed by a policy".** Rejected by measurement: it selects
  1 of 3.
- **Allowlist the trigger enforcers.** Rejected by the follow-up's own close condition.
- **Fold the abort case into COVERED.** Rejected — the failing assertions may belong to another
  gate; the whole point of §7.15 is that an assertion which never ran is not evidence.
- **Re-key the direction column now.** Deferred (D4a) — 62 rows of formatting noise for a human.

## Consequences

- The arm's domain is **127 + 226**; two resolvers AE5 re-keys onto are inside it, and
  `candidate_has_permission` holds a verdict for the first time.
- The findings baseline moves, and `ARM=census` gains two accounted gates — so the two backlog
  entries for the same resolvers are **removed** in the same change, or the census double-accounts
  them through `allow_body "$UNSWEPT"`.
- A run can now end DIRTY for a **third** reason (`NOTICED`), and a gate record must quote four
  counts, not three.
- **A gate record citing this arm must quote the `DOMAIN-STATEMENT`**, not merely say "the arms
  hold".
- The set-valued home needs a **scheduling line** in the lead playbook, or it becomes the thing it
  was built to replace: cases that run when someone remembers.
- ⚠ **Residual, filed not fixed**: `DEGENERATE_PREDICATE` remains **two hand-kept copies**; no arm
  reds on a stale `authz-unswept-backlog.txt` entry that has since earned a verdict; the deriver's
  exit code conflates "derived some" with "derived all owed".
