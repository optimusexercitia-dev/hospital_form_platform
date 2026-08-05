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

## Amendment 3 — ARM 3, the census that stops the sixteenth (2026-08-04)

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

**Decision.** `ARM=census` (~2 s, no suite run, no mutation): every `prosecdef` boolean
function in `app`/`public` and every RLS policy **of every `polcmd`** in the live catalog
must carry a verdict — a row in a committed findings md (BLIND | COVERED | ERROR | SKIPPED)
or a line in the new **`authz-unswept-backlog.txt`**. Anything in neither fails the gate.
CLAUDE.md §6 step 1 runs it **every phase**; cost is the point, since Amendment 1's own
argument is that an expensive gate gets satisfied nominally.

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

