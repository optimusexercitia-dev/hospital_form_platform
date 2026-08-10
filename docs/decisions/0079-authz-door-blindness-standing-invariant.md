# ADR 0079 — AUTHZ door-blindness: the standing invariant + the write-policy keystone-isolation rule

- **Status:** Accepted (2026-07-18)
- **Context:** AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14). Branch `fix/authz-audit-door-blindness`.
- **Supersedes/relates:** ADR 0078 (authorization capability model); this records the FIX-B/FIX-C
  mechanism from the door-audit triage (`docs/reviews/authz-door-audit-triage.md`).

## Decision

**1. A door-blindness regression gate is now a standing invariant, not a one-off audit.**
`supabase/tests/mutation/p0-authz-invariant.sh` codifies §7.14 with two arms:

- **ARM 1 — BLIND ⊆ allowlist.** Re-runs the neutralization sweeps
  (`p0-authz-{door,writepath}-audit.sh`), unions their BLIND set, and asserts it is a subset of the
  committed `authz-blind-allowlist.txt`. A BLIND not on the allowlist fails the gate — that is a NEW
  authz gate no keystone exercises (the exact regression the known-3 rode). The allowlist is a
  **tracked follow-up backlog**, not a silent cap: every gate FIX-C keystones is deleted from it in
  the same commit.
- **ARM 2 — never-called-door floor.** With `track_functions=all`, after a full pgTAP run, asserts
  every `authenticated`-reachable `public` `prosecdef=t` door has `calls > 0`, except
  `authz-neverclled-door-allowlist.txt` (door-only / E2E-only). Catches a door that regresses to
  zero pgTAP coverage even if a policy audit would look complete.

The full ARM-1 sweep is ~90 min (the lead runs it in the background); a `FROMFINDINGS=1` fast mode
compares the committed findings for a light CI check. ARM 2 is ~1 min.

**2. Isolating an RLS *write* policy in a keystone requires a reader-non-writer principal, not a
fully-foreign one.**
An `UPDATE … WHERE` / `DELETE … WHERE` must locate the target row, and row location applies the
table's **SELECT** policy as well as the write policy. A fully-foreign (cross-org) principal fails the
SELECT policy, so the row is invisible and the statement touches 0 rows **regardless of the write
policy** — the keystone then passes even if the write policy is wide open (it is really testing the
SELECT gate). This is door-blindness *inside the keystone*. Proven live: opening
`case_referral_update_coord`/`_delete_draft_source` to `using(true)` did **not** let a rede-B principal
write, because `case_referral_select_readable` still hid the row.

**Rule:** a write-policy isolation keystone uses a principal who **can read** the row (passes the
SELECT policy) but is **not** authorized to write it (fails the write policy). For `case_referral` that
is a source-commission `staff` member (reads via `is_member_of`, cannot manage via
`is_staff_admin_of_for`). The write policy is then the sole gate under test, and opening it reddens the
keystone (mutation-proven). INSERT policies have no SELECT dependency, so a foreign principal is fine
there.

## Consequences

- Every FIX-C write-policy keystone is mutation-proven by reverting the policy to its OPEN form and
  requiring the keystone to redden (`p0b-isolation-mutation-audit.sh`); the reader-non-writer principal
  is what makes that redness attributable to the write policy.
- Each keystone carries a POSITIVE twin (the authorized principal DOES act) so a fail-closed regression
  (cf. [[d11]] stale-status delete) cannot masquerade as passing isolation. The mutation harness
  requires the negative to redden AND the twin to stay green.
- The two allowlists are living backlogs; ARM 1/ARM 2 surface additions and (non-fatally) flag stale
  entries that are now COVERED, to be pruned as batches land.

## Amendment 1 — the invariant becomes a PHASE STEP, scoped to the diff (2026-08-04)

**Why.** The 2026-08-04 full ARM-1 sweep (the first since this ADR was written) returned
**INVARIANT VIOLATED: 15 BLIND gates**. Dating every BLIND policy by its creating migration gives
**20 allowlisted, all ≤ 2026-07-17; 15 violations, all ≥ 2026-07-18 — zero overlap.** 2026-07-18 is
the day the allowlist was written. The violations were not oversights by five teams; they were
*every RLS policy added since the invariant last ran*, from ETH·E2, Referrals-v2, Case Corrections,
an out-of-phase ETH hotfix, and Phase 16.

Decision 1 called this a "standing invariant" **in prose, but never in CLAUDE.md §6's numbered
list** — so it ran when someone remembered, which was never. Worse, Phase 16 *did* run it and logged
"INVARIANT HOLDS" having executed only `ARM=floor`; its own `accreditation_standards_select` passes
ARM 2 and fails ARM 1. A gate record naming the **script** instead of the **arm** reads as full
coverage while delivering the cheap half.

**Decision.** CLAUDE.md §6 step 1 now requires ARM 2 (~1 min) every phase, plus a **diff-scoped**
ARM 1 whenever the phase touched an RLS policy or a `prosecdef` boolean gate. Step 5 requires the
**arm** to be named in the record.

**The full sweep is deliberately NOT a phase step.** It is 302 cases / ~5 h and grows linearly with
the suite; mandating it per phase would reproduce the failure it is meant to fix (too expensive ⇒
satisfied nominally). It stays a periodic audit — pre-pilot, pre-release — lead-run in the
background. The evidence supports the split: of 83 BLINDs, **all 15 violations were newly-added
policies and none was an old gate that drifted** (the full sweep's only news about old surface was 4
entries that had *improved* and were pruned). New blindness is what a phase can cause; drift is what
a periodic audit catches.

**Adoptability was the deciding argument.** A "full ARM 1 must pass" gate cannot be switched on
while 15 violations are open — it would fail on day one, and the honest fixes are weeks of keystone
work. A diff-scoped gate examines only what the phase added, so it is adoptable **immediately** with
the 15 worked off as a backlog (FUP-AUTHZ-2).

### The recipe (derive the case list from the diff, never by hand)

```bash
git diff --name-only <phase-base>..HEAD -- supabase/migrations/ \
  | xargs grep -ohiE "create (or replace )?function (app|public)\.[a-z0-9_]+" \
  | sed 's/^.*\.//' | sort -u | grep -E "^(is_|can_|has_)" | grep -v "^is_valid_"
# + any `create policy <name>` added by the same diff
WORK=<scratch> CASES="<that list>" bash supabase/tests/mutation/p0-authz-door-audit.sh
```

Measured 2026-08-04 on MEM W4: **4 gates → 4m20s**, verdicts `3 COVERED / 1 ERROR / 0 BLIND`.

⚠ **Three operational hazards, each observed rather than predicted:**
1. **A subset run OVERWRITES `docs/reviews/authz-door-audit-findings.md`** with only its own cases —
   observed truncating the committed report from 300 lines to 2. `FINDINGS` is a fixed path with no
   env override. Always `git checkout --` it afterwards, or every phase silently destroys the audit
   record and the next full sweep's diff looks like a mass regression.
2. **`WORK` is hardcoded to a stale session scratchpad.** Override it, or the BLIND `.tsv`s that
   ARM 1 reads back are written somewhere else and the comparison is against the wrong run.
3. **The baseline must be green** — run on a fresh `supabase db reset`. The sweep aborts on a dirty
   baseline (§7.3), which is correct but wastes the run.

### `ERROR` is a recorded ceiling, not a pass

30 of 302 cases (28 door + 2 write-path) score `ERROR (run-shape!=baseline)`: neutralizing them
aborts files mid-transaction, so assertions never run and the harness refuses to score them either
way — a run that did not happen is not evidence. **The gap correlates with gate centrality**, which
is the inverse of where assurance is wanted: `app.has_role` alone leaves 259 tests unexecuted, then
`can_manage_referral_{source,target}` (101/61), `is_active`, `is_member_of_for`, `is_staff_admin_of*`,
`is_admin`. For the membership primitives ARM 1 can therefore **never** be the evidence; the
per-workstream targeted mutation audits are (`291` 9/9 · `292` 9/9 · `293` 8/8 · `294` 8/8 ·
`295` 13/13). A phase whose new gate scores `ERROR` owes a targeted mutation case instead.

## Amendment 2 — one mutation is not sufficient evidence of vacuity (2026-08-04)

**Why this belongs in THIS ADR.** The neutralization oracle as this ADR states it — neutralize a
gate, require the suite to go red — is satisfiable by a **single probe**. That is enough to prove an
assertion *can* fail. It is **not** enough to prove that an assertion which stayed green under one
probe is therefore redundant. Amendment 2 closes that gap; it is a correction to the discipline
above, not a separate practice.

**The evidence** (TV phase, `VersionHistoryPanel`, 2026-08-04). Two ordering assertions. Round 1
mutated the component to sort **ascending**: test #1 reddened, test #2 stayed green. The available
and tempting conclusion — the one a competent engineer writes up — is *"#2 is vacuous, it reads as a
near-duplicate of #1, delete it."* Round 2 mutated to sort **descending** instead: **#2 reddened and
#1 stayed green.**

They are complementary, and each is irreplaceable: #1 pins *"do not sort ascending"*; #2 pins *"do
not stop sorting at all, even in the direction that happens to look right"*. One probe told a clean,
confident, wrong story.

**Rule.** When a probe leaves an assertion green and you are about to call it vacuous, **probe the
opposite direction first**. Report vacuity only when the assertion survives probes that move the
property both ways. A single surviving probe is evidence of nothing.

**The second shape, which is the commoner one — a FORK, where either probe certifies half the
behaviour and reports green.** Same phase, `BeginTemplateEditButton`: it confirms before forking a
published version but navigates straight through when a draft already exists. Mutating it to
*always* confirm reds only the resume arm; mutating it to *never* confirm reds only the fork arm.
Either probe alone leaves half the branch unexercised while the suite reports green — and, worse, a
green result under one probe reads as "this behaviour is covered".

The panel case above is "two assertions, opposite directions of **one property**". This is "one
**branch**, two collapses". They generalise differently, and this one is what you meet more often:
**any conditional needs a probe per arm.** Neutralizing the condition in a single direction proves
only that the arm you happened to break was reachable.

**The corollary is the dangerous part.** A test that *looks* like a near-duplicate is simultaneously
(a) the most likely to be deleted in a tidy-up, and (b) the most likely to be the one guarding the
non-obvious direction. So the vacuity verdict must be **recorded next to the assertions**, naming
which is load-bearing under which mutation — otherwise the next cleanup re-derives the wrong answer
from the same tempting surface. Compare the honest-limit disclosure in `296` §H1: knowing *which* of
three assertions actually catches the mutation is what stops the wrong two surviving a cleanup.

**Scope.** This is not authz-specific — it applies to every mutation-proven keystone in the repo,
pgTAP and Vitest alike. It is filed here because it amends this ADR's oracle. ⚠ It was first written
into PROGRESS.md's *Current Phase Tasks*, which §5 rotation archives at phase close — a cross-phase
lesson in a per-phase container, which would have filed it away exactly when it became useful. That
was a lead error; cross-phase records belong in `docs/decisions/` or `docs/testing/`.

## Amendment 3 — ARM 3, the census that stops the sixteenth (2026-08-04, extended 2026-08-05)

**Why.** Amendment 1 made the sweep a phase step, which fixes "nobody ran it". It does not
fix the deeper hole: **ARM 1 cannot see a gate that was never swept.** ARM 1 asserts
`BLIND ⊆ allowlist`. A policy added today is in no BLIND set, so it is in neither side of
that comparison and passes — *instantly and silently* in `FROMFINDINGS` mode, which reads a
committed findings md the new policy is simply absent from. ARM 2 never looks at policies at
all. So on the day each of the 15 landed, **every arm of the invariant passed**.

Measuring the census on 2026-08-04 found the hole is wider than the 15, and structural:
**46 live authz gates carried no verdict from any sweep**, because the two sweeps enumerate
different incomplete domains —

- the door audit's policy arm filters `polcmd in ('r','*')`: **every INSERT/UPDATE/DELETE
  policy is out of its domain by construction**;
- the write-path audit covers those, but from a **33-row snapshot embedded 2026-07-18** plus
  a 7-name hardcoded guard list. The snapshot never grew;
- the door audit's predicate arm filters on a **name prefix** (`^(is_|can_|has_|…)`), so
  `member_can` (the ADR 0061 capability resolver), `confidentiality_clearance_ok`,
  `capa_viewer_can_manage`, `interview_viewer_can_write` and `rca_writer_can_write` have
  never been in any worklist. *An enumeration whose boundary is a naming convention is the
  same mistake as one whose boundary is a filename.*

**Decision.** `ARM=census` (~2 s, no suite run, no mutation): every gate in the live catalog
must carry a verdict — a row in a committed findings md (BLIND | COVERED | ERROR | SKIPPED)
or a line in the new **`authz-unswept-backlog.txt`**. Anything in neither fails the gate.
CLAUDE.md §6 step 1 runs it **every phase**; cost is the point, since Amendment 1's own
argument is that an expensive gate gets satisfied nominally.

The census domain is, as of 2026-08-05:

1. every `prosecdef` **boolean** function in `app`/`public` (no name filter);
2. every RLS policy **of every `polcmd`**;
3. every **authenticated-reachable `prosecdef` function that RETURNS ROWS**.

**(3) was added a day after (1)–(2) shipped, and the reason is the point of this whole
amendment.** BUG-AUTHZ-002 — two `prosecdef` doors, `hospital_document_register` and
`hospital_indicator_rollup`, returning commission content to `platform_admin` against ADR
0078 A35's noun rule — was open in the bug log the whole time, and **the census as first
written could not have caught it**: both return `TABLE(...)`, and the domain was booleans and
policies. The arm written to close an enumeration hole had one of its own, of exactly the
kind it indicts. The justification for (3) is this repo's own standing rule — *a DEFINER's
gate REPLACES RLS* — so for a row-returning door the gate inside it is the entire boundary.
A boolean predicate is a gate you can neutralize; a row-returning door is a gate you can walk
through. The extension added **45** doors, all registered as `gate:` debt.

⛔ **What the census still cannot see, stated so that "INVARIANT HOLDS" is not read as more
than it is: AUDIT-INVOKER-WRAPPER.** A `prosecdef = f` INVOKER wrapper whose hand-written
`if not exists (…)` probe is the only gate in front of an `app.` DEFINER body carries no
`prosecdef` flag and no policy, so no part of the domain above reaches it — and **130 of 281
`app` DEFINERs are PUBLIC-executable**, which makes the wrapper the whole boundary each time.
Proven live in FF-3. Scheduling is a PO decision; the obligation here is that ARM 3 holding is
**not evidence** about that class, and the backlog header says so.

**A verdict needs somewhere to land (added 2026-08-05).** ARM 3 reads verdicts out of the
committed findings md — but Amendment 1's diff-scoped recipe *ends by discarding that file*,
because a subset run overwrites it. So the sweep the phase gate actually mandates had no way
to record a verdict, and a correctly-swept, correctly-keystoned gate would have read as
UNSWEPT forever. The backlog gains a **`swept:`** section as that destination: the gate, its
verdict, and the keystone holding it. Found when the PCI+TV merge landed six keystoned
policies whose verdicts existed only in a report the recipe had thrown away.

**`authz-unswept-backlog.txt` is deliberately NOT the BLIND allowlist.** That file means
*we swept it and no keystone noticed*; this one means *we have never swept it, so we do not
know*. Merging them would let an unswept entry silence a genuine BLIND finding later. It is
seeded with the 46, each classified `gate:` (18 — owes a sweep) or `helper:` (28 — the result
does not depend on who is asking: flag readers, structural validators, state predicates).
The helpers are **listed rather than regex-filtered** so the classification is a reviewable
record instead of an exclusion nobody reads.

**Proven, not asserted** (the keystone rule applied to the gate itself): deleting one line
from the backlog makes ARM 3 print that gate and exit 1; restoring it returns `INVARIANT
HOLDS`. A gate that has never been shown to fail is not a gate.

⚠ Under **Amendment 2** that single probe is not sufficient on its own — it exercises only the
"live gate missing from the backlog" direction. The opposite direction is the **ghost check**
(a backlog line with no live gate behind it), and both have since fired in anger: the ghost
check named the five `validate_template_*` signatures ADR 0096 re-keyed to
`p_template_version_id`, and it caught three policy names that had been entered from a commit
message instead of the catalog. Two directions, two real catches.


## Amendment 4 — ARM 1 gains a THIRD sweep: row-returning doors (2026-08-05)

**Why.** Amendment 3 put row-returning DEFINER doors into the *census* domain, which asks only
"has anything ever asked?". It could not put them into ARM 1, which asks "does a keystone
notice when this opens?" — because **there was no mechanism to open one**. The boolean sweep
neutralizes a gate by rewriting its body to `select true`; a function returning `TABLE(...)`
has no boolean to open. So all 45 landed in `authz-unswept-backlog.txt` as `gate:` debt with a
verdict in no direction, and the note said the blocker was harness work, not triage. This
amendment is that harness work (FUP-AUTHZ-3).

**Decision.** A third sweep, `p0-authz-rowdoor-audit.sh`, joins ARM 1. Domain: every
`prosecdef`, `authenticated`-reachable, row-returning function in `app`/`public`. It opens a
door's **identity guard** — `if <cond> then` → `if false then` — so the door returns the rows
it would have withheld, then runs the full pgTAP suite and reads `Result:` exactly as the
other two do. Header, signature, return type, volatility, DEFINER and `search_path` are
untouched; only the body changes (§7.15b), and the restore is byte-compared (§7.5).

**The condition, never the deny arm.** Blanking the `raise`/`return` instead would also open
guards that are not authorization — `list_case_access` raises `no_data_found` for a missing
case — and a keystone noticing *that* would be recorded as a keystone noticing the authz gate.
**A false COVERED is worse than no verdict**: it is "audit one layer, infer the next" (§7.14)
wearing the audit's own badge. So a guard is rewritten only when its condition references an
identity primitive (`app.is_*`, `app.can_*`, `app.has_*`, `app.member_can`, `public.is_*`,
`auth.uid`). A feature-flag guard matches none of those and is deliberately left closed: a
flag decides whether a feature exists, never who may use it.

**UNSUPPORTED is a first-class outcome, and it is NOT a verdict.** 11 of the 45 state their
gate as a conjunct inside the query (`where m.principal_id = auth.uid()`) or as a `declare`d
array of the caller's hospitals. There is no statement to rewrite, so the harness records
UNSUPPORTED with the reason, and those doors **stay in the backlog**. ARM 3 was given a
row-door-specific extractor that filters on the verdict column precisely so an UNSUPPORTED row
cannot be mistaken for a sweep result — otherwise a door could be deleted from the census
backlog on the strength of the harness *admitting it could not test it*, reopening the exact
hole Amendment 3 closed. They owe a walk-through keystone in the shape of
`supabase/tests/299_hospital_content_door_noun_rule.sql` §4: a computed enumeration plus a
row-count assertion per principal, never a predicate call.

⚠ **The first version of this harness reported 0 guards in all 45 doors and was wrong.** The
tag regex was written as an E-string (`E'\nAS (\$[^$]*\$)'`, copied from the boolean sweep's
`DO` block) and returns NULL when evaluated directly; the plain form `'\nAS (\$[^$]*\$)'`
works. Every door would have been filed UNSUPPORTED — a *complete* false negative that looks
exactly like an honest result, since "no door has an openable guard" is a coherent finding. It
was caught only by dry-running the detector against the catalog before the sweep and comparing
its count to a hand classification of the bodies. **A detector that finds nothing must be
proven able to find something**, on the same evidence, before its silence is believed. The same
class bit a second time in the same hour: ARM 3's new extractor used `-F' *\| *'`, where awk
treats `\|` as alternation matching the empty string, and printed nothing — which would have
left ARM 3 passing via the backlog while never parsing the report at all.

**Outcome of the first full row-door sweep (2026-08-05).** 45 doors: **32 COVERED, 1
BLIND-and-allowlisted, 1 ERROR, 11 UNSUPPORTED**. Nine came back BLIND on the first clean
run; `supabase/tests/300_rowdoor_gate_keystones.sql` was written for them and moved
**eight** to COVERED, each assertion a row count through the door with a non-vacuity twin
(the outsider reads 0 *and* the legitimate authority still reads the counts measured on
the seed — a denial assertion against a door that returns nothing to anybody passes with
the gate wide open). The denial principal is `chefe.farm`, staff_admin of a sibling
commission in the SAME org: a fully foreign principal can be stopped by the tenant
boundary before the door's own gate is reached, and the keystone would then be exercising
cross-org isolation while claiming to pin the commission gate.

**The ninth is the interesting one, and it stayed BLIND.** `get_case_meeting_links`'s
guard is `if not app.can_read_case(...) then return;` — but its query carries a second,
independent gate, `app.can_reach_meeting(mc.meeting_id, v_uid)`. Measured, not argued:
with the guard rewritten to `if false then`, the outsider **still reads 0 rows** while the
legitimate staff_admin still reads 1. No row-count assertion through that door can
distinguish the guard's presence from its absence, so it is allowlisted as a genuine
backstop with that experiment as the justification. The keystone file keeps its assertion
— the behaviour is worth pinning — but says explicitly that it is **not** a keystone for
the guard. Writing 9 assertions, watching 8 red, and then claiming the ninth "obviously"
holds too is the "7 keystones that could not fail" error committed inside the file written
to end it. The sweep is what caught it; reading the file could not have.

**`open_attachment` is recorded ERROR, deliberately not upgraded.** Opening its guard lets
an unauthorized principal reach `log_audit_access`, which RAISES — so `208_attachments.sql`
aborts (planned 50, ran 36) and the run shape stops matching baseline. Something plainly
noticed (`228_ethics_e1.sql` also failed a real assertion), so in substance the door is
covered. It stays ERROR anyway: the shape rule exists to stop verdicts being awarded by
judgement, and an audit that exempts itself from its own rule is the failure this program
keeps finding in others. It owes a clean verdict.

## Amendment 5 — the census is blind to WRITE-PATH doors, and ARM 1's write sweep is a frozen list (2026-08-06)

**Found in AFF/W2** (ADR [0097](./0097-hospital-affiliation-person-identity.md)), by the
`backend` teammate noticing that a diff-scoped `ARM=policy` run reported `0 BLIND` over five
brand-new DEFINER doors **having swept none of them** — their boolean-predicate arm printed
empty, because the doors return `uuid`, not `boolean`. Investigated by the lead; the hole is
wider than the observation.

**The measurement, from the live catalog.** ARM 3's LIVE domain is `prosecdef` functions in
`app`/`public` where the return type is `bool` **or** (`proretset` and
`authenticated`-executable), plus every RLS policy. A **scalar- or void-returning DEFINER
door is in none of those sets.** It does not need a verdict to pass the census; it is not
*seen* by the census. `ARM=census` therefore reports HOLDS over such a door **because the
door is invisible, not because it is accounted** — which is precisely the vacuity Amendment 3
exists to close, recurring in a shape Amendment 3's own filter cannot express.

ARM 1 does have a write-path sweep (`p0-authz-writepath-audit.sh`), and it is the right
harness. But its domain is **two frozen enumerations**: a hand-written list of **7** named
raise-guards, and a **captured snapshot** of 33 write policies embedded in the script. Neither
is derived from the catalog, so **nothing added since it was written has ever entered it** —
the "a remembered-doors allowlist is blind in exactly the case that matters" lesson, now
holding at the harness level rather than in the code it audits.

**Blast radius, measured not estimated.** Filtering the catalog by the *property* rather than
the return type — `prosecdef`, `authenticated`-reachable, scalar/void, whose comment-stripped
`prosrc` both references an identity primitive (`app.is_*`/`can_*`/`has_*`/`member_can`,
`public.is_*`, `auth.uid`) **and** raises `42501` or an `HC*` code — yields **201** functions.
**6** of them are named in any of the three findings reports.

**What this does and does not claim.** It does **not** claim 201 leaks. Most are certainly
covered in substance by keystones that assert through them; AFF's own
`affiliate_person_impl` / `end_affiliation_impl` / `grant_role_impl` are in the class and are
covered in substance — `302_affiliation_doors.sql` carries mutation-proven keystones through
each (opening the D13 tenant check, granting the `_for` twin to `authenticated`, and narrowing
the any-tier blocker check all go red). The claim is narrower and worse: **they carry no sweep
verdict, and the arm whose entire job is to detect a missing verdict cannot see that they are
missing one.** "Covered in substance" is what every gate this program has caught looked like
right up to the moment someone opened it.

**Two caveats, recorded so the follow-up does not inherit a false premise.** The 201 is a
*candidate* domain from a regex, not a classification — a `prosrc` regex matches comments (the
standing lesson; `--` comments were stripped here, `/* */` were not), so the real count is
lower. And the class is not per-function: AFF's gate lives in an
owner-only kernel (`app.*_impl`, ACL `postgres=X`) while reachability lives in its
`authenticated` wrapper, whose own body names no identity primitive. **A per-function domain
misses that door from both ends** — the domain has to follow the call edge, which is why this
is harness work and not a filter tweak.

**It recurred inside the same workstream, after being written down.** AFF/W3 created four more
gates (`app.update_affiliation_impl`, `public.update_affiliation`, `public.update_affiliation_for`,
`app.trg_audit_hospital_affiliations`) and changed **zero** policies. Its diff-scoped run printed
`PREDICATE ARM: empty · POLICY ARM: empty · BLIND 0 · ERROR 0` — **it examined none of them.** A
second instance one workstream later, with the amendment already drafted, is the argument against
treating this as an AFF curiosity: the arm reports a clean result **in the same words** whether it
swept everything or nothing, and only reading its per-arm output distinguishes the two. Until
FUP-AFF-1 lands, **a diff-scoped `0 BLIND` over new doors is not evidence of coverage** — the run
must state which arm saw which gate, and a phase citing it must cite the keystones instead.

**Decision.** Recorded now, scheduled as **FUP-AFF-1**, not built inside AFF — the same call
Amendment 4 made when row-doors were found to need harness work rather than triage. It does
**not** block AFF: AFF's doors are covered in substance and mutation-proven, and AFF's gate
record must say exactly that rather than citing `ARM=census` as their coverage. Scope when it
runs: derive the write-path domain from the catalog by the property (following the
wrapper→kernel call edge), fold it into ARM 3's LIVE set, and give
`p0-authz-writepath-audit.sh` a derived worklist in place of its two frozen enumerations.
⚠ **And dry-run the new detector against a hand-classified sample before believing its
output** — Amendment 4's harness reported 0 guards in all 45 doors and was completely wrong,
and "no write-path door needs a verdict" is exactly as coherent a false result.

### Amendment 5a — the diff-derivation command must be case-INSENSITIVE (2026-08-06)

Found in AFF remediation, by the `backend` teammate, in the tool it was using to check
Amendment 5. Amendment 1 requires the diff-scoped case list be derived from the migration
diff, never by hand. That derivation was run with a **case-sensitive** grep for
`create or replace function` — but a migration that regenerates a body from
`pg_get_functiondef` emits **uppercase** `CREATE OR REPLACE FUNCTION`, which is precisely
what the standing "regenerate from live, never from migration text" rule *forces* such
migrations to contain. The first derivation therefore listed **one** of four changed gates
and silently dropped three kernels.

**Decision.** The derivation is case-insensitive (`grep -i`, or equivalent). More generally:
**a regenerated body does not look like hand-written SQL**, so any tooling that reads
migration text to find changed objects must assume the catalog's own casing and quoting,
not the house style.

Recorded because of where it happened, not its size: the miss was the **same defect class as
the finding being remediated** (an enumeration bounded by a syntax rather than a property),
committed inside the check for it. The tooling that audits the invariant is itself subject to
the invariant.

⚠ **Related, same pass: a widened detector's first version produced a FALSE positive** by
reading *all* door migrations as live and demanding an arm for a superseded raise. Migrations
are forward-only, so superseded text must never be edited; a `prosrc`-derived detector must
resolve **last-write-wins per function**, exactly as applying the chain does. *A detector that
cries wolf gets ignored, which is the same failure as one that stays silent* — Amendment 4's
"prove it can find something" therefore has a twin: **prove it does not find what is not
there.**

## Amendment 6 — the census's population must be derived from CALL-SITE BINDING, not signature shape (2026-08-10)

**Found by:** the ACT Stage 3 QA review (BLOCKER-1), on the ADR 0106 branch.

**What this ADR's arms could not see.** `ARM=census` counts *boolean authz gates* and asks
whether each carries a verdict. `ARM=floor` asks whether every door is *called*. A diff-scoped
`ARM=policy` asks whether anything *notices* when a gate is opened. All three passed — and all
three were blind to a gate that was **correct in shape and wrong about whose uid it held**.

`app.is_admin_for(p_user_id uuid)` was classified as a third-party helper because its
*signature takes a uuid*. Its only two callers, `app.grant_role_impl` and
`app.revoke_role_impl`, receive `p_actor` from `public.grant_role` / `revoke_role`, which bind
it to `(select auth.uid())`. It was therefore the **caller gate on the membership-grant door**,
and it lacked the ADR 0106 D11 active-role condition its niladic sibling `app.is_admin()` had
just been given — a platform_admin wearing any other hat could seat an `org_admin` or a
`hospital_admin`. Every gate in this ADR passed while that was true, because none of them asks
*whether the uid a gate tests is the caller's*.

**Amendment.** When deriving the sweep population, a helper of the shape `*_for(uuid)` — or any
gate taking a principal parameter — **may not be classified as third-party from its signature.**
Classification is a property of its **call sites**: it is a third-party door only if **no**
caller binds that parameter to the caller's identity, transitively. Concretely, the derivation
must:

1. Extract call arguments with a **balanced-paren** parser, never a regex. `(select auth.uid())`
   is this codebase's house style and defeats one-level-nesting patterns — it is precisely what
   hid this defect through two separate sweep attempts.
2. Match arguments to **parameter positions**, then **propagate caller-boundness transitively
   through the call graph** until it converges (2 hops sufficed on the 928-function corpus).
3. Build edges on `name[[:space:]]*\(`, never a bare name substring — a *column* named
   `is_admin` otherwise matches the *function* `app.is_admin` and manufactures a false edge
   that makes an uncovered gate look already-covered.

Applied once, this yields a real population rather than a list of instances: ~4,500
call-argument observations → **61 caller-bound `(callee, param)` pairs**, of which 51 reach a
hat gate and 10 are correctly hat-free. That is the artifact a closure claim needs.

**The generalization, which is this ADR's own recurring theme:** *the boundary of an enumeration
must be the property, not the syntax.* "Takes a uuid ⇒ third-party" is a syntactic boundary. So
was "greps for the short helper name" (the `\yname\y` / `name_for` finding) and "the files in
this directory". Each shipped a confident closure that was false. Full write-up with the method
to repeat: `docs/progress/authz-handoff.md` §7.17. Fix + keystone: `20260918002800`,
`supabase/tests/318_act_hat_blind_caller_gate_siblings.sql`.
