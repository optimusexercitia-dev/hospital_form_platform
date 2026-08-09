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
