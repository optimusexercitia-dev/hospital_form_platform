# ADR 0187 — C2 closes on DISCLOSURE, its BLIND set is labelled by PROPERTY, and three of ADR 0184's recorded populations were mis-measured

**Status:** accepted
**Date:** 2026-09-04 (three rulings given directly by the PO; the six corrections were re-measured
against the live catalog before this ADR was written, per the PO's instruction not to inherit them)
**Area:** authorization / mutation-coverage measurement / gate records
**Amends:** ADR 0184 — its point 4 (the `HCDS*`/`28000` bullet: both the diagnosis *and* the
remedy), its point 5 (a required property label is added), and the Consequences clause that names
"the anchor widened" as the whole fix. Point 4's **disclosure obligation** and point 5's
**anti-promotion rule** both stand and are strengthened. Nothing in points 1–3 changes.
**Related:** ADR [0171](./0171-c2-tier1-regrain-and-the-command-door-neutralizer.md) (Tier 2's
deferral, which this ADR declines to disturb) · ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (a gate record names the arm and its
domain, never the script) · ADR [0162](./0162-authz-evolution-plan-audit-corrections.md) §3 (the
cutline C2 discharges) · ADR [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
(why the findings file is never hand-edited) · ADR
[0186](./0186-documentation-consolidation-one-home-per-fact.md) D3 (hub = summary, record = log) ·
[c2-command-door-findings.md](../reviews/c2-command-door-findings.md) (⛔ derived — the corrections
below live here and in the record, never in that file).

> **Number.** 0187 = the highest number on **any** live branch + 1 (CLAUDE.md §8), verified by
> enumerating `docs/decisions/` across every `refs/heads` and `refs/remotes` ref rather than by
> trusting the index's "next free": `main` tops out at **0186**, `origin/authz-c2-tier1` at
> **0180**, and `git worktree list` shows a single worktree. No `0187-*.md` exists on any ref; the
> only `0187` string in the tree is INDEX.md's own next-free line. This project has taken the same
> next-free number twice (0180, 0183), which is why the enumeration was run.

## Context

C2 (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, Critical FUP C2) is the class of reachable `prosecdef`,
non-trigger, scalar, non-`bool` command doors that sit outside every `p0-authz-invariant.sh` arm's
domain. Its Tier-1 subset — 237 PHI-touching doors, 171 distinct enforcers — was swept in full for
the first time on 2026-09-02 by `supabase/tests/mutation/c2-command-door-neutralizer.sh`, at a cost
of ~5 h and 342 consecutive pgTAP suite runs.

ADR 0184 recorded that sweep and, correctly, refused to call C2 closed. It named **three uncovered
populations** a gate record citing the sweep "must state", and it warned that a COVERED/BLIND
verdict from this run means `HC0*`-coded-guard coverage and not authorization coverage.

Since then two things happened. First, the hub `docs/features/c2-tier1.md` restated 0184 point 4's
obligation as *"must be **resolved** before the class can be called swept"* — turning a disclosure
into a closure blocker, and with it turning ADR 0171's deliberate deferral of Tier 2's 190 doors
into a C2 blocker. Second, several of the figures 0184 and the hub carry were written while the
sweep was still running, or extrapolated from its first 8 measurements, and were never re-measured
once it finished.

## Problem

Three questions had to be ruled, and six recorded facts had to be re-measured before any of them
could be answered honestly.

1. **Does C2 close while Tier 2 is deferred?** As the hub reads it, no — which makes C2 unclosable
   by construction, because ADR 0171 deferred Tier 2 *on purpose* and nothing has un-deferred it.
2. **How do the BLIND doors whose anchored raise is not an authorization guard get to COVERED?** A
   keystone written against `HC038` ("*esta entrevista não pode ser cancelada neste estado*") flips
   that door's verdict to COVERED, and the resulting green then reads — in a summary, in a gate
   record, in a reviewer's skim — as authorization coverage. That is exactly what 0184 point 5
   forbids, and nothing in the harness prevents it.
3. **Is every BLIND row a gap?** At least one row's anchored raise is not a guard of any kind.
4. **Do 0184's own numbers survive re-measurement?** Some do not.

## Decision (PO, 2026-09-04)

### D1 — Tier 2 is a DISCLOSURE obligation, not a closure blocker

ADR 0184 point 4's wording governs: a gate record **must state** the three uncovered populations.
The C2 hub's *"must be resolved"* is a **drafting error** and is corrected to *"must be stated"*.

C2 closes on three things and no more: **the anchor fix**, **the ERROR class re-swept**, and **the
keystones**. Tier 2's **190 doors stay deferred by ADR 0171 and are NOT cleared**, and every gate
record citing this sweep must say so in those words. A record that omits the sentence is
non-conforming even if every other C2 item is green.

### D2 — the 15 BLIND doors with no authorization raise close via keystones carrying an EXPLICIT PROPERTY LABEL

15 of the 40 BLIND enforcers raise no authorization exception at all in their own body (measured
below, D-M2). They are closed by **state-guard keystones**, and the resulting COVERED **must be
recorded as state / lifecycle / validation coverage** — ⛔ **never** as authorization coverage.

**The label is the condition of the closure, not a nicety.** A keystone landed without it does not
discharge its row. This operationalises 0184 point 5, which stated the prohibition but named no
artifact that carries the distinction: the label is that artifact, and it lives in the keystone's
test-name string and in the row's record entry, where a summary cannot drop it silently.

### D3 — `app.print_source_series` is ruled OUT of the BLIND set

Recorded as a **defensive bound on a walk, not an authorization guard**. Its only anchored raise is
`HC0H4`, fired at supersession-chain depth > 1000. The function's own comment — read from
`pg_proc.prosrc`, not from a migration file — records the shape as unconstructible under
`guard_supersession_coherent` plus the `responses_one_successor_per_superseded` unique index, and
says so in the same breath as its reason for raising anyway: an unbounded walk would hang the mint
instead of failing it.

The reason is recorded **so nobody later attempts a 1001-row fixture**. Its BLIND verdict is
correct and uninteresting: nothing in the suite noticed the guard vanish because nothing in the
suite can reach depth 1001.

**Keystone count drops 40 → 39.**

## Corrections of record

Each was re-measured against the live catalog or the committed artifact before being written here.

**C1 — the keystone design covers 3 doors, not 40.** `docs/design/authz-c2-blind-keystone-designs.md`
is titled *"Keystone design for the three BLIND command-door guards"* and has exactly three door
sections (§1 `nsp_org_capa_rollup`, §2 `cancel_event`, §3 `cancel_session`). The hub's *"designs
complete"* is **false**; **36 of the 39 doors have no design**.

**C2 — the ERROR population is 22, not "~10".** The "~10" in 0184 point 4 was an in-flight
extrapolation (2 of the first 33 ≈ 6 % × 171) taken while the sweep was still running. The
committed findings file reads COVERED 106 · BLIND 40 · ERROR 25; three of its ERROR rows are
tail-drift artifacts re-measured to COVERED in isolation
(`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`). The corrected tally reconciles exactly:

| class | count | source |
| --- | ---: | --- |
| suite-abort (`run SHAPE changed`) | 16 | `FUP-C2-SUITE-ABORT-ERROR-CLASS` |
| semicolon-spanning (`MUTATION DID NOT LAND`) | 5 | anchor defect |
| `save_block_to_library` (`UNMUTABLE`) | 1 | its own entry |
| **ERROR total** | **22** | |
| COVERED 106 + 3 tail-drift | **109** | |
| BLIND | **40** | |
| **total** | **171** | |

⛔ The correction lives here, in the C2 record and in the register — **never** in the findings file,
which is derived per run (ADR 0153).

**C3 — the `HCDS*`/`28000` population is 8 functions, and 0184's diagnosis of it is factually wrong
on the live catalog.** 0184 point 4 says the `HCDS*` family (*"60 raises"*) and `28000` (*"6"*) are
*"structurally absent from the worklist"* because *"the gate-fn filter uses the same anchor"*, and
that they appear in the findings *"neither as a verdict nor as an ERROR"*.

Measured from `pg_proc`: nine `public`/`app` functions mention `HCDS` or `'28000'`; one
(`list_dsr_disposable_meetings`) raises neither, leaving **8 functions**. **All 8 also raise an
anchored `42501`.** The gate-fn filter at `c2-command-door-neutralizer.sh:153` admits a function
whose body matches `errcode = '(42501|HC0[A-Z0-9]{2})'` — so **none of the 8 is excluded by it**.
Four are present in the 171 today (`create_dsr_request` COVERED, `complete_dsr_task` COVERED,
`assume_role` ERROR, `adjudicate_dsr_request` ERROR); four are absent
(`appoint_hospital_dpo`, `attest_dsr_task`, `close_dsr_request`, `revoke_hospital_dpo`) — and they
are absent for a **Tier-1 membership** reason, not an anchor reason: the worklist's other join
requires reachability from a Tier-1 door, and none of the four appears in
`supabase/tests/mutation/c2-tier1-doors.txt`.

**C4 — the hub's "`main` is not pushed" blocker is false.** Measured 2026-09-04: `origin/main` and
`main` were identical at `27ec066a`, with remote migration head `20261003007340`. The blocker is
struck. (`main` moves ahead of `origin/main` continuously as work lands; that is ordinary tracking
state on a pushable branch, not a C2 blocker, and C2's remaining work has `main` as its home.)

**C5 — the cluster figures are wrong, and the conclusion is stronger than they said.** The hub and
the record quote *"correction workflow 4/5 BLIND, interview 6/9, referral 3/16"*. Measured from the
findings table against a base rate of **40/171 = 23 %**:

| cluster | BLIND / enforcers | rate |
| --- | ---: | ---: |
| correction workflow | **6 / 8** | 75 % |
| interview + session | **11 / 21** | 52 % |
| referral | 4 / 32 | 13 % |

The conclusion — blindness is **clustered, not spread** — holds and is stronger. ⛔ The old numbers
must not be re-quoted.

**C6 — the keystone design's §1.2 premise is wrong.** It says `nsp_org_event_rollup` and
`nsp_org_roster` are both exercised in `supabase/tests/189_nsp_per_hospital_isolation.sql` §9
*"including a `42501` deny arm"*. Measured: the deny arm is on `nsp_org_event_rollup` **only**
(L224/227, *"GATE: … as pqs.a (not nsp_org_admin) raises 42501"*). `nsp_org_roster` is called once,
on the allow leg (L215) — which is precisely why it came back BLIND, and why it is one of the 39.

### D-M1 — the dominant finding: the work is deny legs, not new tests

**36 of the 40 BLIND doors are already invoked by the pgTAP suite**, across **24 distinct test
files**; only four (`app.assert_ethics_typed`, `public.add_capa_action_evidence`,
`public.cancel_event`, `public.nsp_org_capa_rollup`) have zero references. They are BLIND because
the tests enter the function only on a path where the guard is not deciding — an allow leg, or a
deny leg that trips a *different* raise. `public.assign_narrative` is the clean illustration: it
carries three `throws_ok` arms on `HC0F1` in `237_authz_exclusion_perimeter_u2.sql` and is still
BLIND, because the mutated raise is its `42501`, not its `HC0F1`.

⚠ The PO's estimate for this finding was *"34 of 40, 16 files"*; the measurement is **36 of 40, 24
files**. The shape of the work is confirmed — **add deny legs to existing files** — and the file
count is the *host* count, not a count of files needing edits, because the sweep did not record
which doors already carry a deny arm on the *mutated* raise.

### D-M2 — the 39 keystones, split by property

| property label | count | basis |
| --- | ---: | --- |
| authorization (`42501` in own body) | 12 | catalog |
| authorization (`HC0*`, permission-worded message) | 13 | catalog + message text |
| **state / lifecycle / validation** (D2's label) | **14** | 15 measured, minus `print_source_series` (D3) |
| **total keystones** | **39** | 40 BLIND − 1 (D3) |

## Considered options

**On D1 — treat Tier 2 as a blocker (the hub's reading).** Rejected: it makes C2 unclosable while
ADR 0171's deferral stands, and it silently re-opens a decision nobody re-opened. Worse, it invites
the fix nobody wants — quietly re-scoping "the class" so the sentence becomes true.

**On D1 — drop the Tier-2 sentence from gate records once C2 closes.** Rejected: an uncovered
population that stops being written down stops being remembered. The disclosure is the whole
mechanism; ADR 0184 point 4 exists because the sweep's headline number reads like coverage.

**On D2 — write authorization keystones for all 39.** Rejected as impossible for 14 of them: those
doors have no authorization raise in their own body to assert through. Their authority, where it
exists, is one call deeper — a separate worklist row with its own verdict.

**On D2 — leave the 14 BLIND and closed nothing.** Rejected: a state guard that vanishes with the
whole suite green is a real gap (0184 point 5 says so explicitly). Closing them with an honest
label is strictly better than leaving them open with none.

**On D2 — carry the label in the record only.** Rejected: records are summarised, and the summary
is where the promotion happens. The label goes in the keystone's own test name, where the TAP
output carries it and a reviewer reading only the suite still sees it.

**On D3 — write the 1001-row fixture.** Rejected: it would construct a state the schema forbids, to
assert a bound whose only job is to fail rather than hang. The cost is real and the coverage bought
is zero.

**On the 0184 relationship — file this as an erratum, not an amendment.** Rejected, and the
reasoning is the deliverable: 0184 point 4's *"structurally absent from the worklist because the
mutation anchor and the gate-fn filter share one syntax"* is not a supporting fact beside the
decision — it is the **reason the population is uncovered**, and it is what 0184's own Consequences
turn into a **remedy** (*"Closing the cutline needs the anchor widened and the ERROR class
re-swept"*). C3 shows half that population is already in the worklist and carries verdicts, and the
absent half is absent for a Tier-1 membership reason the anchor fix cannot touch. So the prescribed
remedy changes: widening the anchor is no longer sufficient for that bullet, and four doors need a
Tier-1 membership ruling instead. A change to a prescribed remedy is an amendment. D2 likewise adds
a **required artifact** to point 5's prohibition. Hence `**Amends:** 0184`, and the back-pointer it
generates is the only way a reader of 0184 learns any of this.

## Consequences

- **C2's closure condition is now three items**: the anchor fix landed, the ERROR class re-swept,
  and 39 keystones written with D2's labels. Tier 2 is stated, not resolved.
- **Every gate record citing this sweep carries the Tier-2 sentence verbatim** — "Tier 2's 190
  doors stay deferred by ADR 0171 and are NOT cleared" — plus the corrected tally 109/40/22 and the
  D2 label split. A record naming the script instead of the arm and its domain is non-conforming
  (ADR 0079).
- **The `HCDS*` delta run is re-scoped.** It is no longer "widen the anchor and re-sweep a missing
  population": 4 of the 8 doors already have verdicts, and the other 4 need a ruling on whether the
  DSR/DPO lane is Tier-1 (it touches `mrn` and `file_ref`, which is why the question is live). The
  anchor fix remains owed for the 5 semicolon-spanning ERROR rows, which is a different population.
- **0184's "60 raises + 6" figures are retired.** They do not correspond to any measurement that
  survives re-derivation; the population is 8 functions and is cited that way from here on.
- ⛔ **`docs/reviews/c2-command-door-findings.md` still reads 106/40/25 and must not be edited.** It
  is regenerated per run. The corrected tally lives in ADR 0187, the C2 record, and the register.
- **The keystone design doc is now known to cover 3 of 39** and its §1.2 premise is corrected in
  place by C6. Whoever writes the remaining 36 designs starts from the D-M1 finding: the doors are
  already called, and the deliverable is a deny leg in a file that already exists.
- **This ADR corrects no measurement it did not re-take.** Every figure above was measured on
  2026-09-04 against the live catalog (`pg_proc.prosrc`, `prosecdef`), the committed findings table,
  or the tracked worklist — never against a migration file and never against graphify, per the
  binding exception in CLAUDE.md § graphify.
