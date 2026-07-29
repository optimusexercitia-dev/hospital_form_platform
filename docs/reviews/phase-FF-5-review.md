# FF-5 Entity Reference — QA Review

**Phase:** FF-5 (ADR [0091](../decisions/0091-ff5-entity-reference.md) + Amendments 1–2) ·
**Flag:** `entity_refs` · **Date:** 2026-07-28 · **Reviewer:** `qa`
**Range:** `f0cc3ac`…`4959c7d` (22 commits) · **Branch:** `ff/flexible-forms-program`
**Round:** r2 (r1 was cut off mid-review by an API limit; its frontend findings were fixed and
are not re-litigated here — see *Scope* below).

## Verdict: ⛔ CHANGES REQUESTED

**No code defect and no security hole was found.** Every security property this phase claims, I
verified against the live catalog, and all of them hold. The two blocking items are **keystone
gaps** — assertions that ADR 0091's own "Gate keystones" section commits to and that the suite
does not contain. Both are pgTAP-only; neither requires an application-code change, a migration,
or a full E2E re-run.

I am not approving because the phase's load-bearing security argument (ruling 1) and the PO's own
ruling 2 are, between them, held up by **zero executable assertions** — and this repository's
entire scar history (ADR 0078/0079: seven keystones that could not fail; "a green bar misses the
wired seam") is that a verified-today property with no keystone is exactly how the next
regression ships. The remediation below is small and mechanical.

---

## Scope of this round

r1 swept and found clean: Rule 10 (pt-BR), Rule 9, Rule 7/XSS, RSC boundaries, zero `any`, no raw
Postgres errors on the save path, and all six `referencesByItemId` production call sites. It found
and the team fixed M-2 and m-1…m-4/i-1. **This round audits the backend/SQL half r1 never
reached**, plus the late sign-off fixes in `1c773de`.

**Method.** Live catalog only (`pg_proc`, `pg_policy`, `pg_constraint`, `pg_trigger`,
`information_schema.role_table_grants`, `nspacl`, `proacl`) per the CLAUDE.md graphify exception —
never migration text. Behavioural claims were executed under `set local role authenticated` inside
transactions that were **rolled back**; no DB state was mutated. Catalog baseline verified first:
**235/235 migrations registered**, max version `20260902000900`, matching the last file on disk.

---

## What I verified and could not break

These are stated so the PO can see what the verdict is *not* about.

| Claim | Evidence |
|---|---|
| **Ruling 1's substrate is true** | Exhaustive `pg_proc` sweep: **exactly two** writers of `participants` — `set_participant_patient` and `dispose_case_phi`, **both SECURITY DEFINER**. The first hardcodes the literal `'Paciente'`; the second writes a redaction constant. Neither accepts a caller-supplied label. `authenticated` holds **SELECT only** on `participants`. `patient_identifiers` and `patient_participants` are RLS-on with **zero policies and zero grants**. Ruling 1's *conclusion* is sound. |
| **Ruling 2 is a boundary, not a filter** | `guard_reference_coherent` is a table-level `BEFORE INSERT OR UPDATE` trigger on `answer_references` — it governs **every** write path, including the DEFINER door, not just the search. All three lanes fail **closed** (`not exists → raise`); a null org resolves to a NULL comparison and raises. |
| **Ruling 2 actually works** | Executed and rolled back against real case data: from a case-linked response, the **own-case** patient IS a candidate (1) and a **different case's** patient in the same org is NOT (0). |
| **Ruling 3 holds** | `reference_candidates` is `prosecdef = f` (INVOKER). Because it is INVOKER, passing a *foreign* `p_item_id` to switch lanes cannot widen anything — every lane's `select` is still gated by `participants_select` / `commissions_select_member_or_admin` / `profiles_select_self_or_admin`. This is ruling 3 paying off exactly as argued. |
| **Door parity (K9)** | `answer_references` carries `answer_references_select` (base + `can_read_correction_response`) and `answer_references_select_targeted` (`can_access_targeted_response`) — **byte-parallel** to `answer_selected_options`. `authenticated` holds **SELECT only**, with **no write policy and no write grant**, while the sibling carries full DML. K9 is structural, not incidental. |
| **Amendment 2 is closed** | Neither `reference_candidates` nor `save_section_answers` has a PUBLIC entry in `proacl`. |
| **Ruling 5 holds** | `app.answer_map`, `app.instance_answer_map`, `app.is_valid_condition`, `app.eval_visibility` — none references `answer_references`. Rule 3 parity is structurally untouched, as claimed. |
| **The sign-off fix is correct and complete** | Live body: top-level `observations_by_item` and `other_text_by_item` both now carry `group_instance_id is null`; all four helper-backed top-level projections pass `null`; all six per-instance projections scope to `gi.id`. I checked **every** aggregate in the function — the only unscoped one is `signoffs`, which has no instance dimension. **The class is closed in the function.** References are projected at both scopes and do reach the signer. |

### `app.copy_response_answers` — adversarial read (item 5), clears

The extraction is sound, and the failure mode that destroyed data in FF-1's P0-1 is **structurally
unreachable here**:

- **8 of 14 `answers` columns are copied.** The other six are all derived, and I confirmed each:
  `id` and `answered_at` from column defaults; `value_number`/`value_date`/`value_time` by
  `sync_answer_typed_values_trg` (BEFORE INSERT); `form_version_id` by `derive_answer_version_trg`,
  whose body derives from `new.response_id` — i.e. **the destination**, which is the correct
  behaviour, not a carried-over source value. Nothing is silently dropped.
- **The resolving join cannot silently copy nothing.** `form_items_no_nested_container`
  (`parent_item_id IS NULL OR item_type NOT IN ('group','repeating_group')`) makes containers
  un-nestable, so `parent_instance_id` is **always NULL** (0 rows in the DB confirm it). The
  `(group_item_id, position)` map key is therefore unique per response, and `answers_uq_top` /
  `answers_uq_inst` make the answer side 1:1. The map is provably bijective.
- **It fails loud, not silent.** If step 1 ever failed to create instances, in-instance answers
  would collapse to `group_instance_id = NULL` and collide on `answers_uq_top` (23505) rather than
  vanishing. That is the opposite of P0-1's signature.
- §J's J3 pins the successor instance **by value and by identity**, with both mutations recorded
  as verified. This is the strongest section in the suite.

### Keystones I attempted to break and failed to

Reported per the brief, so the PO knows the sampling was real:

1. **§F org-vs-case confound (my strongest lead — dissolved).** I suspected F2/F3 were passing on
   *org* containment rather than ruling 2's case-scoping, since the patient `…a9` is created with
   `(select org_b from k)`. F1's control proves `org_b` **is** the response's own org, so the org
   filter does not exclude `…a9` and §F genuinely isolates the patient branch. Sound.
2. **§G `pg_depend` vacuity** — already found and replaced by the author with a neutralization
   oracle carrying **its own control** (G1: a probe that *does* read PHI must fail), a split claim
   (G2/G3), the documented exception pinned executably (G4), and a restore check (G5). This is the
   best-constructed section in the file; I could not weaken it.
3. **§B measuring the wrong table** — already found; the row ids are now captured as owner into a
   temp table and every assertion reads `answer_references` **alone**, with B4 as a genuine
   over-grant twin. Correct.
4. **§M vacuity** — fails closed in both degenerate directions (`array_agg` over zero rows → NULL
   vs the array). Correct, and it genuinely closes the half `item-type-sets.test.ts` cannot.
5. **§K expected-value tuning** — K2 keys on `f5_rg_part` precisely because it exists on exactly
   two responses; K1/K3 are real controls. Correct.
6. **My own probe was vacuous once** and I caught it: a `pg_proc` writer sweep using `\b` returned
   zero rows because Postgres regex uses `\y` (`\b` is backspace). Re-run with `\y` it returned the
   two real writers. Recording it because it is the same class of error this phase is auditing.

---

## Blocking findings

### B-1 (MAJOR) — Ruling 2's patient lane has **zero positive coverage anywhere**

*Violates:* ADR 0091 "Gate keystones" → `patient_candidates_case_scoped`, which commits to **three**
clauses: "a patient participant of *another case* is not a candidate; the same participant *is* one
from its own case's response. Standalone response ⇒ zero patient candidates."

**Only the third clause is implemented.** `case_participants`, `case_phases` and `case_phase_id`
appear **zero times** in `supabase/tests/276_ff5_references.sql` — the fixture builds no
case-linked response at all. The E2E spec is the same: `e2e/ff5-references.spec.ts` uses only
`participantTypes: ['Setor']` / `jsonb_build_array('department')`.

Consequence: the `exists (select 1 from case_participants …)` clause in **both**
`reference_candidates` and `app.guard_reference_coherent` is never satisfied in any test, in either
direction. §F's F1 control uses a **department** participant, which short-circuits on
`p.participant_type <> 'patient'` and never reaches the case-scoping branch. **The entire ruling-2
mechanism could be inert (always-deny) and §F would be fully green**, because F2 and F3 are both
negatives — the mirror image of the "no-regression claim needs an over-grant twin" lesson.

I confirmed by execution that the lane **is** correct today (own-case patient → 1; other-case
patient → 0), so this is regression protection, not a live bug. But ruling 2 is the PO's own
minimum-necessary PHI boundary, and it is currently unguarded.

**Remediation** (pgTAP only): extend the §F fixture with a case, two `case_participants` patients
in *different* cases, and a case-linked response; assert (a) the own-case patient IS a candidate,
(b) the other-case patient is NOT, (c) the trigger accepts (a) and refuses (b). The seed already
contains a usable shape — cases `d0000000-…-c1` and `dba00000-…-b1` hold patients
`e0000000-…-c1` and `e0000000-…-b9` in the same org.

### B-2 (MAJOR) — The ruling-1 surrogate keystone is missing

*Violates:* ADR 0091 ruling 1 — "The obligation FF-5 does carry is the opposite one — **prove** the
lane cannot reach PHI, which is a keystone (`references_never_read_phi`), not a door."

§G proves the *read paths* touch no PHI **tables**. Nothing asserts the premise that makes that
sufficient: that `participants.display_name` is a **surrogate**. Today that rests on two DEFINER
writers, a hardcoded `'Paciente'`, and a SELECT-only grant — all of which I verified, and none of
which is pinned. A future writer (or a widened `set_participant_patient` signature) that accepts a
caller-supplied label silently falsifies ruling 1, **nothing goes red**, and the frontend
structurally cannot detect it because it renders whatever the column holds.

This is the claim that **retired a Rule 12 amendment and a PHI-audit door**. It is the highest-stakes
untested premise in the phase.

**Remediation** (pgTAP only, in `276` beside the others — cheap): assert (a) the writer set of
`participants` is exactly `{set_participant_patient, dispose_case_phi}` and both are `prosecdef`,
(b) `authenticated` holds no INSERT/UPDATE/DELETE on `participants`, (c) behaviourally —
`set_participant_patient` called with a name argument still yields `display_name = 'Paciente'`.
(c) is the one that actually pins the surrogate; (a)/(b) pin the perimeter that makes (c) exhaustive.

**On the PO question — gate-blocking or scheduled follow-up?** My call: **fix now, at this gate.**
Not because the property is broken (it is not), but because ruling 1 is the reason this phase ships
*without* a PHI door and *without* a Rule 12 amendment. An untested premise carrying that much
weight is precisely ADR 0079's standing-invariant argument. The cost is one pgTAP section on a
suite that is already open in front of the author; deferring it trades a ~30-minute fix for a
permanently unguarded Rule 12 boundary.

---

## Non-blocking findings

### m-1 (MINOR) — §N: the `other_text_by_item` top-level scope filter is unpinned

The §N fixture's instance answer carries `observation` but **no `other_text`**
(`276_ff5_references.sql:1046-1048`). So deleting `and a.group_instance_id is null` from the
**`other_text_by_item`** block of `get_response_for_signoff` leaves N1–N5 **all green**: N2 still
sees the key, N4's item is top-level and still resolves, N5 inspects only the observations map.
Migration `20260902000900` fixed the filter in the block it added, and the keystone does not hold
that block. Fix: give the fixture instance an `other_text`, add an N6 mirroring N5.

### m-2 (MINOR) — §N5 asserts cardinality, not identity

*Answering the brief's question directly:* **a key-set assertion cannot catch a wrong value under a
correct key, so N2 pins bug (a) only.** §N is not vacuous on bug (b), because N5 counts the
top-level observations map and requires `1` — under the original defect it would read 2. But N5 is
count-shaped: if the filter were written **inverted** (`is not null`), the map holds exactly one
key — *the instance's* observation, rendered to the signer as a top-level answer — and **N5
passes** while displaying precisely the data bug (b) is about. Fix: assert the key's identity and
value (`->> '…018' = 'Observação de topo'` and `->> '…01a' is null`), the N4 treatment.

### m-3 (MINOR) — §N2's enumeration boundary is a naming convention

`where k like '%_by_item' or k = 'instances'` (`:1068`). `instances` already had to be
special-cased because it broke the pattern — which is the proof the boundary is wrong. Any future
answer shape not named `*_by_item` passes N2 silently, so the header claim at `:992-993` ("this reds
when a future phase adds an answer shape and forgets this door") overstates it. This is the
repo's own "if your enumeration's boundary is a filename, it's wrong" lesson, one level down.

### m-4 (MINOR) — the program plan still asserts the premise ruling 1 reversed

`docs/plans/flexible-forms-program.md` still reads "**FF-5 Entity Reference** … discharges INFO-2
(PHI-read audit door)" (§0) and "Rule 12 (PHI — FF-5's participant lane touches it)" (header). ADR
0091 states it "corrects the program plan §3 FF-5 … and §7 risk 3", but the plan was never
amended. A reader sent to "§3 FF-5" hits the superseded premise first. Add a superseded-by pointer.

### m-5 (MINOR) — PROGRESS.md's FF-5 row is stale

Line 56 records migrations `20260902000000`–`…000600` (now `…000900`), pgTAP 4220 (now 4226) and
Vitest 834 (now 851), and the commit range `f0cc3ac`…`7272258` (now `4959c7d`). Written before the
late fix commits. Rule §7 makes PROGRESS the status authority; refresh it at gate close.

### m-6 (MINOR) — un-mirrored whitespace predicate in the sign-off door

Top-level uses `btrim(a.observation) <> ''`; the per-instance arms use bare `a.observation <> ''`;
the TS sibling uses `!== ''`. A whitespace-only observation is dropped at top level and kept
per-instance. Cosmetic — but this is a function whose entire defect history is un-mirrored
predicates between its two scopes.

### i-1 (INFO) — the user lane cannot reference a commission-less admin

Both `reference_candidates` and `guard_reference_coherent` require a **live commission**
membership (`m.commission_id is not null`). An `org_admin` or `hospital_admin` holding only an
org/hospital-scoped membership is therefore unreferenceable. The two sites **agree**, so there is
no divergence bug, and it is defensible as minimum-necessary — but it is a product behaviour the
ADR does not state, and "reference the org admin" is a plausible governance-form need. Worth a PO
confirmation, not a change.

### i-2 (INFO) — `buildGroupInstances` returns wrong-by-construction stubs

`src/lib/queries/responses.ts:544-549` returns `matrixCellsByItemId: {}` / `referencesByItemId: {}`,
and **both** current callers spread the real maps over them (`responses.ts:918-926`,
`submissions.ts:724-731`). Not a live bug. But it is a builder that returns a value it knows is
wrong and relies on every caller remembering to patch it — a third caller that forgets gets a
silent `{}`, which is the FF-5 bug class exactly.

### i-3 (INFO) — unstable ordering in the candidate search

`order by p.display_name … limit 50` has no tiebreaker. In the patient lane every label is the
identical `'Paciente'`, so row order is not stable across calls; in the org lane the 50-row
truncation is arbitrary among ties. Add `, p.id` as a tiebreaker.

---

## The three deferred items — my verdicts

**1. Missing ruling-1 surrogate keystone → BLOCKING (B-2).** Rationale above. The conclusion is
sound and I verified it independently; it is the *absence of a guard on the premise that retired a
Rule 12 obligation* that I am not willing to wave through. Cheap to close.

**2. Patient-lane sublabel degeneracy → ship as a documented limitation, but not silently.**
Confirmed structurally by execution: a patient row renders label `'Paciente'` + sublabel
`'Paciente afetado'` (the `case_participant_roles.display_name`). Two patients in the **same case
with the same role** are byte-identical and unorderable (see i-3), and a mis-pick aggregates onto
the wrong patient id with no visible error. That is a real integrity risk on a governance record.
But the fix space is genuinely bad — every disambiguator that would work (initials, MRN fragment,
DOB) is PHI, and adding one would reverse ruling 1 and re-open the Rule 12 amendment this phase
just closed. **My call: ship.** The mitigation is not a UI change but a process one — require
distinct `case_participant_roles` per patient within a case (the vocabulary already supports it),
and have the picker say so when it detects duplicate (label, sublabel) pairs. Do **not** hold FF-5
for it; do put it in front of the PO before the patient lane reaches a real committee, because the
answer is a workflow rule, not code.

**3. `app.*` schema-wide PUBLIC EXECUTE → accept, and it is safer than stated.** 194 of 374 `app`
functions carry the PUBLIC default. But there is a **second barrier the note does not cite**:
`app`'s `nspacl` is `{postgres=UC/postgres,authenticated=U/postgres,service_role=U/postgres}` —
there is **no PUBLIC (`=U/`) entry**, so `anon` has no USAGE on the schema and cannot resolve any
of them regardless of EXECUTE. Combined with `PGRST_DB_SCHEMAS=public,graphql_public` (verified on
the running container), there is no reachable path. Pre-existing, correctly out of FF-5's scope.
Worth a standing keystone on the `nspacl` itself someday, since that is now the load-bearing half.

---

## Re-gate guidance

B-1 and B-2 are **pgTAP-only**; m-1…m-3 are edits to `276` §N. No application code, no migration,
no type regeneration. A re-gate should need `npm run test:db` on a fresh reset plus the standing
`p0-authz-invariant.sh` sweep — **not** a full `e2e:prod` rerun, since no shipped surface changes.
m-4/m-5 are doc edits and can land with the gate-close commit.
