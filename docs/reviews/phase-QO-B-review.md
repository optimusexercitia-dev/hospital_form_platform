# QO·B — QA review (round 1)

**Phase:** QO·B — quality-office oversight, Phase B: the `org_admin` / `hospital_admin`
CONTENT WALL (ADR [0100](../decisions/0100-quality-office-oversight.md) **D12**, PO rulings
Q1–Q9) + the BUG-QOB-003 UI-coherence close-out.
**Branch:** `feat/quality-office-oversight` (local-only, 15 commits) · **Reviewer:** `qa`
· **Date:** 2026-08-09.

## ⛔ VERDICT: **CHANGES REQUESTED**

One **BLOCKER**: the PO-ratified §4.4 case-plane CUT list is materially unfulfilled, and
**BUG-QOB-002 — *"a tenancy admin could WRITE case content it could not READ"* — is
recorded CLOSED in PROGRESS.md while remaining live**. Measured by execution on a fresh
`supabase db reset` (328 registered == 328 files), under `set local role authenticated`,
with a cross-org control that discriminates and a coordinator twin.

Everything else in this phase is strong, and most of it I re-proved rather than read: the
M1–M3 table cuts, the M5/M6 door cuts, the storage half, the B.8 keystones' non-vacuity,
hospital_admin parity, the KEEP side's freedom from over-cut, and the whole TS/UI half all
hold. The blocker is a **population-derivation** defect in one migration, not a collapse of
the phase.

---

## Method

Per CLAUDE.md's binding graphify exception, **no claim below comes from migration or SQL
file text** — every schema/RLS/RPC statement is read from the live catalog
(`pg_proc`/`prosecdef`, `pg_policies`, `pg_get_functiondef`) on a DB I own for this review.
Behavioural claims are executed against the seeded stack in rolled-back transactions with a
discriminating control. Where I mutated state I said so and reset.

Three method corrections I had to make on myself, recorded because each would have produced
a wrong finding:

1. **Token presence ≠ an authority arm.** `create_case` matches
   `is_commission_admin_of`, but at the *self-grant skip*, not the gate — its authority
   block is `is_staff_admin_of OR is_admin OR member_can` and it correctly `42501`s a
   tenancy admin. Every occurrence below was read **in context** before it was called a
   finding.
2. **`proname` granularity is not signature granularity.** My first extraction attributed a
   line to `create_case` that belongs elsewhere in the same body. Re-derived per `oid`.
3. **⚠ My first door probe ran as `postgres`, which is RLS-exempt** — so "ADMITTED" measured
   only the authority gate and over-reported the INVOKER doors. Re-run under
   `set local role authenticated`; the INVOKER results changed materially (see MAJOR-2).
   *A probe that does not assume the caller's role is not measuring the wall.*

---

## ⛔ BLOCKER-1 — the ratified §4.4 case-plane CUT list was never executed; BUG-QOB-002 is still live

**Requirement violated:** inventory §4.4 (*"✂ CUT — case-plane **write** doors"*), ratified
in §6 with only five named KEEP exceptions (Q8/Q9: the three `*_case_access` doors +
`set_case_visibility` + `set_case_confidentiality`); ADR 0100 D12; Architecture Rule 1.

### The mechanism

M4 (`20260915000300`) does **not** cut the ratified list. It cuts a **proxy population**,
and its own header states the substitution as fact:

> *"POPULATION — DERIVED, NOT HAND-LISTED. The case-content mutators are exactly the
> functions carrying A4-Unit-2's exclusion guard, `app.assert_not_case_excluded` (31 of
> them); 23 of those also admit the tenancy admin."*

**That premise is false.** `assert_not_case_excluded` was applied by a *different* wave
(A4 Unit 2) to *its* enumeration. Every §4.4-listed door that does not happen to carry that
guard was outside M4's population by construction — and stayed armed. From the live catalog:

```
door                          DEF/INV  tenancy_arm  assert_not_case_excluded
update_case_meta               DEF        false            true      <- in M4's population, CUT
reopen_case                    DEF        false            true      <- CUT
create_interview               DEF        false            true      <- CUT
dispose_case_phi               DEF        false            true      <- CUT
--------------------------------------------------------------------------
remove_case_participant        DEF        TRUE            false      <- NOT in the population
record_recusal                 DEF        TRUE            false
set_case_participant_role      DEF        TRUE            false
add_case_participant           DEF        TRUE            false
set_primary_subject            DEF        TRUE            false
schedule_ethics_hearing        DEF        TRUE            false
delete_ad_hoc_case_narrative   DEF        TRUE            false
delete_ad_hoc_case_phase       DEF        TRUE            false
lift_recusal                   DEF        TRUE            false
case_tag_report                DEF        TRUE            false
case_viewer_capabilities       DEF        TRUE            false
bulk_create_cases              DEF        TRUE            false
create_case_from_template      DEF        TRUE            false
close_case                     INV        TRUE            false
cancel_case                    INV        TRUE            false
set_case_outcome               INV        TRUE            false
update_case_narrative_body     INV        TRUE            false
```

The exact arm, verbatim from `pg_get_functiondef`, is the disjunct §4.1's own analysis says
the cut removes:

```sql
if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
```

### Measured: two confirmed content writes, cross-org control discriminating

Fixture asserted real first — `is_commission_admin_of_for(CCIH, orgadmin.a) = true`,
`is_staff_admin_of_for(CCIH, orgadmin.a) = false`, **`can_read_case(c1, orgadmin.a) = false`**.
Controls: `orgadmin.b` (org B — must be denied), `chefe.ccih` (`staff_admin` — the
no-regression twin).

| door | `orgadmin.a` (tenancy admin) | `orgadmin.b` (control) | `chefe.ccih` (twin) |
|---|---|---|---|
| `remove_case_participant` | **ADMITTED — `removed_at` SET** | `HC0E4` denied | ADMITTED, `removed_at` set |
| `record_recusal` | **ADMITTED — `case_recusals` 0 → 1** | `P0002` denied | ADMITTED, 0 → 1 |
| `set_case_participant_role` | passes authority → `HC0E3` (*validation*) | stopped at `HC0E4` (*authority*) | `HC0E3` |
| `add_case_participant` | passes authority → `P0002` (*validation*) | stopped at `HC0E4` | `P0002` |
| `schedule_ethics_hearing` | passes authority → `HC0J0` (*state*) | stopped at `HC0J1` (*authority*) | `HC0J0` |
| `case_viewer_capabilities` | `{"can_read": false, "can_write_content": false, "can_manage_lifecycle": true}` | `…lifecycle: false` | all `true` |

The distinct-SQLSTATE discipline this phase's own `314` §9 header defines is what makes the
middle three unambiguous: `orgadmin.b` is stopped at the **authority** code while
`orgadmin.a` reaches a **later** gate on the identical fixture. The arm is the discriminator.

**`case_viewer_capabilities` is the one to look at twice.** It is the door the UI asks
"what may this person do with this case", and it answers `can_read: false` **and**
`can_manage_lifecycle: true` — it advertises lifecycle authority over a case whose contents
the principal cannot see. That is BUG-QOB-002's shape stated by the platform about itself.

**Both tiers.** Re-measured as `hospitaladmin.a1`: `remove_case_participant` ADMITTED with
`removed_at` set, `record_recusal` wrote its row. PO ruling Q4 ("the same wall") is
unfulfilled symmetrically.

### The TS layer is currently the only thing closing part of this

`src/lib/case-narratives/actions.ts:168-174` correctly keeps the membership-only guard on
`upsertNarrativeBody`, and annotates it:

> *"their DB substrates carry no tenancy arm; `update_case_narrative_body` is on the
> ratified §4.4 CUT list"*

The first clause is **false against the catalog** — `update_case_narrative_body` still
carries the arm. So a correct guard rests on an incorrect premise, and the only barrier on
that path is application code. That inverts **Architecture Rule 1** (*RLS is the security
boundary; never rely on UI hiding*). The guard is right; its justification is not, and the
justification is what a future author will trust.

### Why every gate was green over this

This is §6.3's finding (*"M1–M4 cut the TABLES and left the DOORS"*) **recurring one level
up**, and it is worth naming precisely because the phase already learned the lesson once:

- **M4's own postcondition** asserts `family = 31 AND admits = 23` — it validates the size of
  the *proxy* population, not its **correspondence to the ratified list**. It cannot fail on
  this defect; it is designed to detect drift *within* the proxy.
- **`b1`'s `restore_case_door_arm`** mutates a door M4 *did* cut, so it reds correctly and
  proves nothing about the doors M4 never saw. **31/31 RED-PROVEN is true and not
  reassuring here** — a mutation audit's coverage is its case list, and the case list
  inherited the same wrong population.
- **`314`** carries no case-plane door keystone at all (§9 is the response plane, §10
  documents).
- **The A/B matrix** measures table rows under RLS (self-audit ⑤); `cases` was already
  walled by A4, so the matrix reads clean while the doors are open — *by construction*.
- **`ARM=floor`** asks whether a door is called; **the 0079 sweep** neutralizes boolean
  gates and these are `void`/record-returning. Both correctly reported no problem.

The check that caught §6.3 — *re-read the ratified CUT list and ask the catalog, item by
item, "did I actually cut this?"* — was run against the **response and document** planes and
produced M5/M6. **The case plane's own §4.4 block was never put through it.** The union of
scoped re-reads is not a re-read.

### What I need to see to clear it

1. Cut the tenancy disjunct from every §4.4 door that is not one of the five ratified KEEPs,
   with the population **derived from the ratified list itself** (or from a property that is
   *proven* co-extensive with it, not assumed).
2. A behavioural keystone per cut door in `314`, with the §9 twin discipline already
   established there — including a positive assertion that
   `case_viewer_capabilities(case).can_manage_lifecycle` is `false` for a tenancy admin.
3. `b1` cases red-proving each, with a restore verified byte-identical.
4. Re-open **BUG-QOB-002** in PROGRESS.md rather than filing a new bug — the original record
   is accurate and was closed prematurely.
5. Correct `case-narratives/actions.ts`'s annotation once the DB is actually armless.

---

## 🟠 MAJOR-1 — four INVOKER doors return SUCCESS while writing nothing

`close_case`, `cancel_case`, `set_case_outcome` and `update_case_narrative_body` are
`prosecdef = false`. Their authority gate admits the tenancy admin (BLOCKER-1), but the
subsequent DML runs under RLS on `cases` / `case_narratives`, which A4 already walled. The
net effect measured as `orgadmin.a`:

```
cancel_case(c1)  -> ADMITTED (no exception)   STATE: status = 'pending'   (unchanged)
close_case(c1)   -> ADMITTED (no exception)   STATE: status = 'pending'   (unchanged)
  twin chefe.ccih: cancel_case -> STATE 'cancelled';  close_case -> HC031 (a real state gate)
```

So the data is safe here — but the door **reports success and does nothing**, and
`close_case` additionally *skips* the phase-completion gate (`HC031`) that stops the
legitimate coordinator, because the phases it counts are themselves RLS-invisible. A UI
built on this shows a confirmation for an action that did not happen.

This is a distinct defect class from BLOCKER-1 and survives independently of it: even after
the arm is cut these should raise, not silently no-op. Recommend the fix that makes them
`raise` when the DML affects zero rows, so the failure is legible.

*(This is also the finding my first probe got wrong in the dangerous direction — as
`postgres` the update landed and I briefly had a much larger blocker. The role matters.)*

---

## 🟡 MINOR-1 — residual masked tenancy arms on the case plane

`case_events_select`, `case_events_writer_insert`, `case_events_writer_update` and
`get_case_detail` / `list_my_cases` still name `is_commission_admin_of`, but every occurrence
sits **inside** a conjunction with `can_read_case` / `can_write_case_content`, which A4
already denies. Verified unreachable: `get_case_detail` → `P0002`, `list_my_cases` → `[]`
for `orgadmin.a` (control `chefe.ccih` → 1 row).

These are correct today and would become live the moment any outer predicate widens. They
are also the reason a token-level sweep of this plane reads alarming. Either strip them or
annotate them in-body as deliberately masked, so the next sweep does not have to re-derive
what I just re-derived.

## 🟡 MINOR-2 — the B.14 gate evidence is no longer reconcilable from its own artifacts

`/tmp/e2e-prod-gate/spec-counts.txt` now contains a **single line**
(`5 pdf-printing-meetings.spec.ts`) — the scoped PDF re-runs overwrote the full-gate
denominator file, and `batch-1.log` is likewise the 5-test scoped run, not the gate's batch
1. Timestamps across the directory span `00:24`–`23:47`, interleaving at least two runs, and
`batch-*-preresume-void.log` / `batch-13-unrun.log` markers are present.

I therefore **cannot independently corroborate** B.14's `1047/1052 accounted · 0 did not
run · 17 batches, no gaps`. I am not disputing it — `reset FAILED` appears in no log, and
the 8-failure PDF root cause (`.env.local` predating the PDF module) is coherent and was
re-proven scoped. But this is the *exact* hazard the phase already recorded for the door
sweep (*"a partial sweep overwrites the committed findings file"*) reproduced on the E2E
gate, and the retained-evidence discipline that the "gate summary can hide unrun tests"
lesson depends on is currently defeated. Retain the full-gate artifacts under a run-scoped
directory before any scoped re-run.

## ℹ️ INFO-1 — `bulk_create_cases` / `create_case_from_template` unresolved, not cleared

Both carry the arm and both are on §4.4. My probes were non-discriminating (the template
lookup failed for both principals for fixture reasons, not authority), so I am reporting
them as **unmeasured**, not as safe. They belong in BLOCKER-1's remediation set and need
their own twins.

## ℹ️ INFO-2 — `lift_recusal` denied both principals

`HC0E1` for `orgadmin.a` *and* `orgadmin.b` on a hand-made recusal — a lookup gate fires
before authority. Non-discriminating; the arm is present but I could not demonstrate reach.
Treat as unmeasured.

---

## ✅ What I verified as SOUND (re-proved, not read)

**The table cuts (M1–M3) are real.** `responses_admin_all` no longer exists;
`responses_select`, `answers_select`, all four answer satellites,
`response_group_instances`, `controlled_documents(_versions)`, `document_approvals`,
`printed_documents` and `indicator_measurements` carry **no** tenancy arm in `pg_policies`.
`app.is_member_of` is commission-scope only (`has_role_any('commission', …)`), so the
`is_member_of`-based document/measurement policies do not readmit a tenancy admin through
the back door — checked, because that would have been the elegant way to fail.

**The M5 response doors hold, with a real twin.** `dashboard_free_text(form a001)`:
`orgadmin.a` **0** / `chefe.ccih` **6**. `dashboard_export_rows` 0 / 6.
`dashboard_completion_by_member` 0 / 2. The 6 free-text answers named in §6.3 as the
headline leak are now withheld, and the twin proves the zero is the wall.

**The M6 document doors hold.** `list_commission_documents` 0 / 2;
`documents_due_for_review` 0 / 1.

**Storage is clean — self-audit ④ closes favourably.** From `pg_policies` in the `storage`
schema: `controlled_documents_obj_insert_writable` → `is_staff_admin_of` alone;
`controlled_documents_obj_select_member` → `can_read_document_object` (M2-cut). No tenancy
arm survives in the bucket policies the self-audit flagged as outside the sweep's population.

**B.8's keystones are non-vacuous — I neutralized two gates myself.** Restoring the pre-cut
disjunct to `list_commission_documents` and `supersede_response` and re-running `314`:

```
# Failed test 45: "8.1 ⭐⭐ WALL (M6): org_admin lists ZERO controlled documents through the door…"
# Failed test 51: "9.2 ⭐ WALL (M5): supersede_response refuses the tenancy admin on AUTHORITY…"
Looks like you failed 3 tests of 76        (55 is 9.6's knock-on: 9.2's supersede landed first)
```

Restore verified **byte-identical** on both (`diff` clean), residual-mutation check `0`.
`314` §9/§10 are the best-constructed keystones I have reviewed in this program: real
fixtures rather than borrowed personas, distinct-SQLSTATE attribution reasoned in the
header, and a stated argument for *which gate* each denial discriminates on.

**hospital_admin parity is now MEASURED — self-audit ③ closes on the walled surfaces.**
As `hospitaladmin.a1` (predicate asserted `true` first): `responses` 0 · `answers` 0 ·
`indicator_measurements` 0 · `controlled_documents` 0 · `dashboard_free_text` 0 ·
`list_commission_documents` 0; KEEP side `list_addable_commission_members` **17** ·
`forms` **4**. Q4's ruling is satisfied everywhere except the case plane (BLOCKER-1).

**No over-cut on the KEEP side.** As `orgadmin.a`: `list_addable_commission_members` 17 ·
`list_approver_candidates` 13 · `indicator_kpis` 1 · forms/process-template/taxonomy/meeting
policies all retain the disjunct. The five ratified case-access/classification KEEPs still
carry it, and `revoke_printed_document` correctly retains it per the ADR 0104 D11 ruling.

**The session contract (B.10) is correct and well-reasoned.** The coercion is gone;
`role` is membership-only; `isTenancyAdmin` is a flag with an explicit in-code prohibition
against adding it to `canInCommission`. `canConfigureCommissionById` fails closed on
inactive accounts and on an unreadable commission. I found no consumer still assuming a
tenancy admin reaches `role === 'staff_admin'`.

**The guard routing (B.11) splits rather than switches.** Mixed action files are split
per-function with a written justification on each side; content actions (`setCaseOutcome`,
`overrideCasePhaseResult`, `assign/unassignCaseTag`, `upsertNarrativeBody`, all meeting
content) keep the membership-only guard. **No CUT action gained a tenancy arm** — I checked
the dangerous direction specifically.

**The UI half (B.12) is fail-closed by design.** `app-sidebar.tsx:539` hardens the predicate
to `role !== null && item.roles.includes(role)`; the KEEP set is a **positive allowlist**
(`configuration: true`), so a nav item added later is invisible to a tenancy admin until
someone opts it in — the right polarity. The Q3 indicator split withholds at the **read**
(`access.role !== null ? await loadMeasurementHalf(indicator) : null`), not at the render,
with the correct reasoning recorded: an empty chart would misreport the committee as having
measured nothing.

**BUG-QOB-004 is accurately filed.** Catalog-verified: `create_referral_draft`,
`dispose_referral_phi` and `can_dispose_referral_phi` are all `prosecdef = true` and all
still carry the tenancy arm. The tenancy admin holds live DB authorization on referrals
while the UI 404s the route — a capability-reach regression, not a security defect, exactly
as the tester recorded it. Filing it rather than canonizing the loss was the right call.

**FUP-QOB-1's J1c pin is honest.** J1b is annotated vacuous rather than deleted (the A2
precedent), J1c is labelled `PROVISIONAL` and `STRUCTURAL`, and the b1 case
`fup_qob1_drop_created_by` demonstrates the vacuity live (J1c reds while J1b stays green).
The provisional status is correctly surfaced for PO ratification rather than absorbed.

**The Decisions-log records are accurate.** I spot-checked the 2026-08-08 Q1–Q9 row and the
2026-08-09 lead-rulings row against the inventory §6 table and the ADR; each ruling is
traceable and none is overstated. The `revoke_printed_document` KEEP row correctly records
that the older ADR 0104 D11 ruling overrode the newer §4.3 draft.

---

## Carried forward (not blocking)

- **FUP-QOB-1** — PO ratification of the J1c provisional pin.
- **BUG-QOB-004** — referral capability-reach regression; needs a PO ruling on scope.
- **Q6** — the `is_commission_admin_of` → `is_tenancy_admin_of` rename, deferred by ruling to
  its own wave. BLOCKER-1 is direct evidence for it: the name misled this phase's own
  population derivation.
- **`setTemplateCaseType`** not routed to the config seam (ADR 0088 door is staff_admin-only)
  — flagged for the PO as a Q2-consistency question.
- Pre-existing `context.isAdmin` platform-admin arms on content pre-checks — recorded
  out-of-scope noun-rule sweep candidates.

## One methodological note for the next phase

The self-audit's own header says it best and its base rate held: **six for six, nothing in
this phase was found by re-reading.** BLOCKER-1 was not found by reading M4 either — it was
found by asking the catalog which functions still carry the arm, then calling each one as a
real principal with a control. The self-audit's risk ② said exactly this (*"the ratified CUT
list was executed by hand, and I got it wrong twice… re-derive the population independently
rather than re-run mine"*). It was right, and it was pointing at the plane it did not check.

---
---

# QO·B — QA review, ROUND 2

**Under test:** M7 (`e84994b`, migration `20260916000000_qob_m7_case_door_wall_completion.sql`)
· records + comment fix (`a5b40e1`) · post-M7 declare-green gate B.16 (`3039b30`).
**Reviewer:** `qa` · **Date:** 2026-08-09 · fresh `supabase db reset`, **329 registered ==
329 files** verified before any reading.

Backend's B.15 disposition table was read as **the claim under test, not as evidence**.
Every closure below is my own re-probe on my own fixtures.

## ✅ VERDICT: **APPROVED**

BLOCKER-1 and MAJOR-1 are closed and I re-proved both. All four r1 MINOR/INFO items are
resolved. M7 introduces no over-cut and no regression. One new **MINOR** — a stale
PROGRESS.md summary block that contradicts its own section body — is record hygiene for the
lead, not a gate blocker.

---

## ⛔ → ✅ BLOCKER-1 — CLOSED

### Correspondence, re-derived independently

I did **not** re-run M7's list. I extracted the 32 §4.4 names from the **inventory document
itself** and asked the catalog:

```
CUT-SIDE STILL ARMED   : (none)          <- 27 names (32 minus the 5 ratified KEEPs)
MISSING FROM CATALOG   : (none)          <- non-vacuity: every §4.4 name still exists
KEEP STILL ARMED (5/5) : grant_case_access, revoke_case_access, list_case_access,
                         set_case_visibility, set_case_confidentiality
add_case_participant / bulk_create_cases armed? : (none)
case_events policies armed? : 0
```

**M7's postcondition is the right shape**, and this was r1's core objection. It enumerates
**names** — `v_cutside[29]` checked item-by-item for the token (a) — plus an explicit
**non-vacuity existence check** (b) so a renamed door cannot make (a) pass over its absence,
a KEEP-side over-cut guard (c), a `case_events` policy check (d), and a MAJOR-1
guard-presence check (e). Its regex is bare `is_commission_admin_of`, not `\y…\y`, so it
matches the `_for` variant — the §6.3 word-boundary lesson is applied, not merely cited.

### Behavioural — my r1 probes, re-run, both tiers

Preconditions asserted first: `is_commission_admin_of_for(CCIH, orgadmin.a) = true`,
`is_staff_admin_of_for = false`, **`can_read_case = false`**; same predicate `true` for
`hospitaladmin.a1`.

| door | r1 `orgadmin.a` | **r2 `orgadmin.a`** | **r2 `hospitaladmin.a1`** | `chefe.ccih` twin |
|---|---|---|---|---|
| `remove_case_participant` | ADMITTED, `removed_at` SET | **`HC0E4`, NOT-REMOVED** | **`HC0E4`, NOT-REMOVED** | ADMITTED, `removed_at` set |
| `record_recusal` | wrote 0 → 1 | **`P0002`, recusals 0** | **`P0002`, recusals 0** | ADMITTED, 0 → 1 |
| `set_case_participant_role` | reached `HC0E3` (validation) | **`HC0E4` (authority)** | **`HC0E4`** | `HC0E3` |
| `add_case_participant` | reached `P0002` (validation) | **`HC0E4`** | **`HC0E4`** | `P0002` |
| `set_primary_subject` | reached validation | **`HC0E4`** | **`HC0E4`** | ADMITTED |
| `schedule_ethics_hearing` | reached `HC0J0` (state) | **`HC0J1` (authority)** | **`HC0J1`** | `HC0J0` |
| `case_viewer_capabilities` | `can_manage_lifecycle: true` | **`false`** | **`false`** | all `true` |

**The polarity is exactly inverted from r1**: the tenancy tiers are now the ones stopped at
the *authority* code while the coordinator reaches the *later* gate. That is the
distinct-SQLSTATE discipline doing the work it was built for, and it means these zeros
cannot be a dead door.

`case_viewer_capabilities` no longer contradicts itself — the door that told the UI a
principal could manage the lifecycle of a case it cannot read now answers `false` at both
tiers while the coordinator keeps `true`.

`case_tag_report` now gates on `is_staff_admin_of` alone and `return`s empty rather than
raising. On the clean seed both principals read 0 (the seed holds no case tags), so my probe
alone cannot discriminate — but **`314` 11.22 supplies the fixture and asserts the
coordinator reads `> 0`**, which is precisely the coverage-honesty the phase owes on an
empty-in-seed surface. Covered.

### Keystone non-vacuity — I neutralized two of the NEW §11 gates

Restored the pre-M7 disjunct to `remove_case_participant` and `case_viewer_capabilities`:

```
# Failed test 77:  11.1  remove_case_participant refuses the tenancy admin on AUTHORITY
# Failed test 78:  11.2  set_case_participant_role refuses on AUTHORITY
# Failed test 79:  11.3  set_primary_subject refuses the tenancy admin
# Failed test 92:  11.16 case_viewer_capabilities reports can_manage_lifecycle=FALSE
# Failed test 93:  11.17 (Q4) hospital_admin is refused by the same shared predicate
# Failed test 94:  11.18 ...and case_viewer_capabilities denies hospital_admin too
# Failed test 110: 11.34 CATALOG correspondence: all 29 §4.4 CUT-side doors armless
Looks like you failed 9 tests of 111
```

Seven intended keystones red, **including both Q4 hospital_admin assertions and the
correspondence invariant** (11.19/11.26 are the same fixture-order knock-on as r1's test 55).
Restore **byte-identical** on both (`diff` clean); residual-mutation check across all 29
CUT-side names = **0**.

**BUG-QOB-002: I confirm re-closure.** It was correctly re-opened with r1 as finder; the
defect is now behaviourally absent at both tenancy tiers with a discriminating twin.

---

## 🟠 → ✅ MAJOR-1 — CLOSED, and backend's narrowing of my set is CORRECT

I claimed four doors had the silent-success shape. Backend claims only two did. **I verified
the correction rather than accepting it**, and backend is right:

```
orgadmin.a:  cancel_case                -> 42501  (arm cut; authority denies)
             close_case                 -> 42501
             set_case_outcome           -> P0002  (its own RLS-bound lookup)
             update_case_narrative_body -> P0002  (its own RLS-bound join)
```

`set_case_outcome` and `update_case_narrative_body` never reach DML for a principal who
cannot see the row — they deny at the lookup, so they never had the shape. My r1 finding
over-generalized from `cancel_case`'s behaviour to the family.

**The reachable instance is the one that matters, and I built it.** Post-cut the tenancy
admin is stopped at authority, so the only principal who can pass authority *and* be
RLS-invisible is an **excluded `staff_admin`**. Fixture asserted real
(`is_case_excluded = true` **and** `is_staff_admin_of_for = true`):

```
EXCLUDED-SA  cancel_case / close_case / set_case_outcome / update_case_narrative_body
             -> P0002 not-found, all four
POST STATE   status=pending · outcome_is_null=true · narrative_untouched=true
CONTROL      the SAME coordinator, NOT excluded, cancel_case -> status=cancelled
```

**Zero success-report-with-no-write across all four doors and every principal I could
construct**, with a positive control proving the door still works. The `close_case` variant
of the defect — skipping the `HC031` phase gate because the phases were RLS-invisible — is
gone with it.

### The two declined b1 red-proofs: the reasoning HOLDS

`314` §11d declines to red-prove the zero-row guard on `set_case_outcome` /
`update_case_narrative_body` because on those doors the guard is a *defensive backstop*, not
the load-bearing gate. I judged whether that hides a gap. It does not, for a reason worth
stating: **11.29/11.30 still assert the denial behaviourally**, so the invariant *"an
excluded coordinator is denied"* remains red-provable — if the RLS lookup were ever removed
and the backstop failed to catch it, those two go red. What is *not* proven is the
**attribution** of the denial to a specific mechanism. That is a real but narrow limit, and
§11d states it in those terms rather than claiming coverage it does not have. A red-proof
that can only pass is worse than an honest annotation; this is the annotation.

---

## r1 MINORs and INFOs — all resolved

**MINOR-1 (masked arms) — CLOSED.** `get_case_detail`, `list_my_cases`,
`create_case`/`create_case_from_template`'s self-grant skips, and all three `case_events`
policy arms no longer name the predicate (catalog: 0). M7 chose to **strip rather than
annotate**, which is the stronger of the two options I offered. Pinned by 11.32/11.33.

**INFO-1 / INFO-2 — CLOSED; all three now measured and discriminating.**

```
lift_recusal              orgadmin.a -> HC0E4 (authority), lifted_at NULL
                          chefe.ccih -> ADMITTED, lifted_at set
bulk_create_cases         orgadmin.a -> 42501
create_case_from_template orgadmin.a -> P0002 (RLS-bound template lookup), 0 new cases
                          chefe.ccih -> ADMITTED, 1 new case
```

⚠ **r1's non-discrimination on `lift_recusal` was my own fixture bug, not a property of the
door**: I resolved the recusal id *after* switching to `authenticated`, so RLS hid the row
and I passed `NULL` into the door, which returned `HC0E1` for every principal. Resolving the
id as `postgres` before the role switch makes it discriminate cleanly. A probe whose
*fixture lookup* runs under the role being tested measures the fixture, not the gate.

**MINOR-2 (gate artifacts) — DISCHARGED.** B.16 supersedes B.14 as the declare-green run
(B.14's tree predated M7, so it could not have been the phase's gate regardless): **1046
passed · 0 failed · 1 flaky · 0 did-not-run · accounted 1047/1052**, with the same constant 5
permanent skips. The concern was that a *superseded* run's artifacts had been overwritten;
the declare-green run is now a different, later, all-green one. The retention lesson still
belongs in the worktree/gate doc — keep full-gate artifacts under a run-scoped directory
before any scoped re-run — but it no longer bears on this phase's verdict.

**The `case-narratives/actions.ts` comment — CORRECTED, and correctly.** It now cites M7 by
migration number, states the INVOKER-lookup mechanism, and closes with *"RLS/the RPC is the
boundary (Architecture Rule 1)"* — the guard is re-framed as a pt-BR-message mirror of the
DB wall rather than as the wall.

---

## M7's own new surface — nothing found

**No over-cut, measured as a delta.** r1 counted **93** functions carrying the token; the
catalog now holds **73**. `93 − 20 = 73` matches M7's claimed 20 edits **exactly** — no
collateral edit hid inside the wave. The KEEP estate is intact: `forms` 15 policies ·
`process_template*` 16 · taxonomy/meeting 12 · `audit_log` 1, all still armed; behaviourally
for `orgadmin.a`, forms 4 · addable members 17 · `indicator_kpis` 1 · process templates 2;
and the five ratified KEEP case doors (`list_case_access`, `grant_case_access`,
`set_case_visibility` probed) all still ADMIT.

*My own over-cut detector produced five false positives* — `list_org_people`,
`list_org_eligible_users`, `set_commission_oversight`, `reorder_departments`,
`set_standard_ownership` "lost" an arm they never had: they route `is_org_admin_of` /
`is_hospital_admin_of` directly. Checked before believing it; `list_org_people` still returns
**28** rows to `orgadmin.a`. Recorded because a detector's hits are a hypothesis.

**The `create_case` self-grant delta is confined.** Stripping the tenancy disjunct from the
skip condition widens grants for exactly one persona (a member-creator who is also a tenancy
admin, who would otherwise create a case they cannot read). It does **not** leak onto
coordinators: a `staff_admin` creating a case yields **0** `case_access_grants` rows and
still reads it (`can_read_case = true` via the coordinator arm).

**The `229` re-anchor is sound — and I verified the re-homing rather than accepting it.**
Converting M1·2's positive twin to a wall assertion could have quietly deleted an
exclusion-durability property belonging to a *different* program (ADR 0078 M1). It did not:
the distinct-SQLSTATE argument is preserved in place (`HC0E4` authority ≠ `HC0F1` exclusion,
so the `throws_ok` cannot false-pass off the over-grant twin above it), the fixture teardown
is done **directly rather than through the door** and is labelled teardown rather than
assertion, and the lost positive property is re-homed to **`314` 11.25**, which I confirmed
is a real `lives_ok` — a non-excluded coordinator lifting a live recusal. The reason the
fixture has no clean coordinator (both `st_x`/`st_x2` are respondents, `sa_x` is the recused
party) is stated, which is also why M1 originally reached for the org arm.

**Findings-file integrity confirmed:** `docs/reviews/authz-door-audit-findings.md` is **393
lines** and the tree is clean — the partial-sweep truncation was restored.

**Regression, reproduced independently:** full pgTAP on my own fresh reset —
**Files=175, Tests=5616, Result: PASS**, matching B.15's figure exactly. M7's blast radius is
`supabase/` only (1 migration + 3 test/harness files); `a5b40e1` touches PROGRESS.md and one
comment. No application code changed in the remediation.

---

## 🟡 NEW MINOR-3 — PROGRESS.md's summary blocks contradict their own section body

Not a code defect; a §7 *"PROGRESS.md is the single source of truth"* defect, and the chronic
marker-not-moved class.

- **Phase Status row (line 71)** still reads `🟡 build complete, QA not started`,
  `db reset 328=328`, `pgTAP 175f/5553`, `6 migrations (20260915000000–000500)`, QA column
  `⬜ not started`, and closes with **"Closes BUG-QOB-001 · BUG-QOB-002"**.
- **The "Gate evidence" block (line ~108-113)** likewise still reads `328 == 328`,
  `175f / 5553`, `b1 17/17`, and **"Closes BUG-QOB-001 + BUG-QOB-002"**.

Both predate M7 and both assert BUG-QOB-002 closed, while B.15 twelve lines below re-opens
it and the Bug Log at line 361 carries it as 🔴 **RE-OPENED**. A reader who scans the status
table — which is what the table is *for* — gets the pre-r1 picture. Update to 329 == 329 ·
175f/5616 · 7 migrations · `b1` 39/39 · QA `⛔ r1 → ✅ r2`, and drop BUG-QOB-002 from the
"Closes" list until this verdict is recorded. These are the lead's rows.

---

## Carried forward (unchanged from r1, none blocking)

- **FUP-QOB-1** — PO ratification of the J1c provisional pin.
- **BUG-QOB-004** — referral capability-reach regression; PO ruling on scope.
- **Q6** — the `is_commission_admin_of` → `is_tenancy_admin_of` rename. r1 called BLOCKER-1
  evidence for it; r2 does not weaken that. The predicate that reads as "the commission's own
  admin" misled M4's population derivation, and it still reads that way in 73 places.
- **`setTemplateCaseType`** not routed to the config seam (ADR 0088 door is staff_admin-only).
- Pre-existing `context.isAdmin` platform-admin arms on content pre-checks — noun-rule sweep
  candidates, out of scope.
- **Gate-artifact retention** — keep full-gate logs under a run-scoped directory so a later
  scoped run cannot overwrite the denominator file.

## What r1 → r2 actually demonstrated

r1's BLOCKER was a **population** defect: M4 substituted a proxy property for the ratified
list and asserted the substitution as fact, and every green gate validated the proxy. M7's
answer is the right one structurally — *the postcondition enumerates the names* — and the
lesson generalizes past this phase: **a derived population needs a proof of correspondence to
the thing it claims to derive, not a proof of its own size.** A count-shaped postcondition
cannot fail on the one mistake that matters.

Two smaller notes for the record, both about probes rather than code: my r1 four-door MAJOR-1
set was one measurement too broad, and my r1 `lift_recusal` INFO was a fixture bug of my own
(the lookup ran under the role being tested). Both were corrected by re-measuring, not by
re-reading — which is the same conclusion this phase keeps reaching from the other side.
