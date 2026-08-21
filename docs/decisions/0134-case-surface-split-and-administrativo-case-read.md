# ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases

**Status:** **Accepted — design PO-ratified 2026-08-21** (design/grilling session; this ADR is
the record of that approval and of its scope — see D11, **as extended by Amendment 1**) ·
**IN BUILD** on `feat/case-surface-split` (PO build-go 2026-08-21; Step 0 ✅ done, Increment 1
code built but **not gated**, Increment 2 not started, **nothing merged**) — implementation plan:
[docs/plans/case-surface-split.md](../plans/case-surface-split.md) · **Date:** 2026-08-21 ·
**Feature:** completes the `/casos` ↔ `/manage/cases` split begun by `8675b7cd` (2026-08-19,
"make /casos a reading surface") and settles the design question underneath
`BUG-QO-STALE-CASOS` · **Relates / amends:** ADR
[0033](./0033-case-access-control.md) (amends the Q3 boundary — see its Amendment 1), ADR
[0061](./0061-administrativo-delegated-role.md) (the capability menu gains a fifth entry — see
its Amendment 1), ADR 0100 (the quality-oversight spec whose pairing re-anchors), ADR 0078 A35
(noun rule — bears on `multiplos`), ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (sweep obligations). **Binding
rules:** 1 (RLS is the boundary — every route change here is UX, not security), 10 (pt-BR UI),
11 (audit), 12 (PHI minimum-necessary).

## Context

`8675b7cd` split the case detail into a reading surface (`/casos/[caseId]`) and a management
surface (`/manage/cases/[caseId]`), narrowing a coordinator's caps at one site
(`case-detail-view.tsx` `readingAsMember`) with "Gerenciar caso" as the escape hatch. Its
stated principle — *"between read-only and full management is the state the split exists to
abolish"* — shipped with **two carve-outs that are exactly that state**: an administrativo's
explicit caps survive on `/casos` (because the manage detail layout hard-404s anyone whose
`access.role !== "staff_admin"` — `/casos` is their *only* surface), and a write-grantee's
content affordances survive there too (the commit's own differential control proves it).
`BUG-QO-STALE-CASOS` (`quality-oversight.spec.ts:569`/`:627` red on `main` since 2026-08-19)
is the spec still asserting coordinator write affordances on `/casos`; its recorded trap: the
test's purpose was *pairing* a coordinator's affordance against `quality.a`'s absence on the
same URL, so "change the URL" makes it vacuous.

Facts measured 2026-08-21 (live catalog + code; citations with file:line in the plan's
baseline — **re-verify at build time, never quote**):

- **The manage area is already drifting to capability gates.** `manage/cases` (list) admits an
  administrativo (`canInCommission(access, "create_cases")` + a standing check that includes
  `isAdministrativo`); the interviews detail admits **any role** with write as a per-viewer
  flag. Only the case-detail layout, `correcoes`, and `fase/respostas` hard-require
  `staff_admin` — and `multiplos` requires the `staff_admin` *role* `∨ context.isAdmin`, so an
  administrativo holding the `create_cases` *capability* reaches single-case creation but not
  bulk.
- **The read boundary excludes administrativo entirely.** `app._case_caps` — the sole resolver
  every case predicate bottoms out in (`can_read_case`, `can_write_case_content`,
  `list_cases_board` per-row, `get_case_detail` viewer caps) — has seven arms (S1 coordinator …
  S7 quality_reviewer) and **none consults `app.member_can` or administrativo appointment**. An
  administrativo therefore reads only granted (S3) / assigned (S4) / self-created cases; their
  board is otherwise empty, and no route change can alter that.
- **Name-attributed work is already fully DB-supported on the reading surface**:
  `case_phases.assigned_to`, `case_narratives.assigned_to` (ADR 0033 Q14),
  `action_items.assigned_to` (the advance/complete DEFINER door's first disjunct is
  `assigned_to = auth.uid()` — no case-wide grant needed), and referral attribution lives in
  `referral_assignments` with **no** write affordance embedded on the case route (links to
  `encaminhamentos` only).

## Decision

1. **The split's meaning, in one sentence:** *`/casos` shows the case as the committee sees it
   plus your own name-attributed work; anything case-wide you are allowed to do lives behind
   one uniform "Gerenciar caso" button on `/manage/cases/[caseId]`.* The carve-outs go to
   zero — this is what makes `8675b7cd`'s "reading surface" literally true.
2. **The `/casos` narrowing extends to every case-wide capability.** `readingAsMember` triggers
   for `canWriteContent` holders, not only `canManageLifecycle`; the three props that today
   bypass the narrowing by construction (`canManagePhaseResults`, `canAssignPhases`,
   `canEditMeta`) narrow with it. Identity-attributed writes are untouched (my phase, my
   narrative, my action item — the assignee checks precede capability checks, ADR 0033
   Q14 / CA-002).
3. **Manage-detail entry predicate:** `staff_admin ∨ isAdministrativo ∨
   canWriteContent(this case)`. A pure read-grantee, a plain committee member, and a quality
   reviewer 404 — their surface is `/casos` — and the "Gerenciar caso" button renders for
   exactly the set that passes the gate. Admitting read-grantees to a disabled-everything
   manage view was rejected: it recreates "between read-only and full management" one level
   down.
4. **Button, never redirect; one label.** The coordinator pattern extends verbatim to every
   manage-capable viewer ("see the case as a member sees it" stays one click away, deep links
   stay stable). The label is uniform — a per-role label fork is a new E2E locator axis for
   zero information gain.
5. **The cases area opens by capability, fail-closed.** `multiplos` re-gates on the
   `create_cases` capability + the list page's standing check, dropping the role gate (and the
   `context.isAdmin` bypass is verified against the noun rule — ADR 0078 A35 — and removed if
   it admits `platform_admin` into commission content). Every subroute not explicitly
   capability-mapped stays `staff_admin`-only: `correcoes`, `fase/respostas`. Interviews keeps
   its own participant model.
6. **A new `_case_caps` arm (S8): administrativo commission-wide case READ, keyed on a new
   fifth ADR 0061 capability `read_cases`** (default-checked in the appoint dialog), routed
   through the flag-aware chokepoint so the `administrativo` kill switch darkens it with the
   rest. S8 confers **`read_case_content` only** — content authorship (`canWriteContent`)
   still requires an explicit per-case grant, exactly like any staff member; `close_case` /
   `cancel_case` stay coordinator-only. Their existing administrative doors (`create_case*`,
   `activate_phase` / `reassign_phase`, `update_case_meta`, `list_signoff_queue`) are
   unchanged and now bite commission-wide because read no longer blocks them. **This amends
   ADR 0033 Q3's restrictive boundary** ("no attribution + no grant ⇒ cannot see the case;
   coordinators/admins always pass") by adding capability-appointed administrativos to the
   always-pass-for-read set. Management ≠ authorship.
7. **Write-grant semantics are unchanged** (ADR 0033 Q2: content scope — narratives, action
   items, documents, tags, events; no lifecycle, no meta, no assigning). The design session's
   grill question — *name one real task a write-grantee is blocked from that is not
   lifecycle/meta/assignment* — returned nothing, so the "write-grantee ≈ per-case
   administrativo" instinct is resolved as UI shape (D1–D3), not as a permissions gap. A
   per-case `manage` grant level stays in the drawer as a possible future ADR.
8. **`BUG-QO-STALE-CASOS` is repaired now, independently of the increments** (tester-owned):
   the `:569` no-lockout pairing re-anchors on **"Gerenciar caso" presence (coordinator) vs
   absence (`quality.a`) on the same `/casos` URL** — the surviving differential affordance,
   so the pairing stays non-vacuous and survives this redesign — and the `Editar` / `Reabrir
   caso` assertions move to `/manage/cases/[caseId]`. Lands before AFF2 pins its e2e baseline.
9. **No new feature flag; one program, two increments, 1 before 2.** Increment 1 is
   routing/UI only (no DB); Increment 2 is the S8 arm and its authz bill. Pre-pilot big-bang
   is this project's precedent (ADR 0106), the `administrativo` flag is already permanently
   ON, and a seed-flipped flag ships OFF to production while every local gate is green.
10. **The action-item completion asymmetry is a recorded design, not a defect:** only the
    scalar `action_items.assigned_to` may advance/complete; `action_item_assignments`
    (side-table) assignees contribute updates and checklists but cannot complete. Single
    accountable owner. Recorded here so it is not re-litigated; revisit only on a product
    request.
11. **Approval scope** (an approval's scope is a fact that must be written down): the PO
    ratified D1–D10 in the 2026-08-21 design session — this ADR is that record; there is no
    other. NOT authorized by that approval: any remote `db push` (standing discipline —
    user-authorized deploys only), any phase assignment or build start (implementation happens
    in a future session, per the PO), and any widening beyond D6's read-only arm.

## Alternatives rejected

- **Capability mirror** — rebuild `/casos` as a cap-gated copy of `/manage` (pre-`8675b7cd`,
  ADR 0033 Q7). Restores the exact state that commit was written to abolish, three months
  after Q7 was ratified, and re-duplicates every affordance's maintenance.
- **A third route** for administrativo + write-grantees. Not a coherent audience (commission-
  wide delegate vs per-case collaborator would be gated apart *inside* the route immediately),
  and a route is not a capability boundary (Rule 1) — it's option D1 with a third set of
  pages, locators, and specs to keep in sync.
- **Widening the existing write grant** to per-case admin caps — silently changes the meaning
  of every grant already issued.
- **Appointment-keyed S8** (any administrativo reads all cases) — bundles commission-wide case
  read into a `schedule_meetings`-only appointment; the capability key preserves ADR 0061's
  curated-menu contract and gives the audit trail a name.
- **Auto-granting read on every case creation** instead of an arm — B wearing a disguise: an
  insert-time sweep that must never miss, versus five lines in the resolver.
- **Commission-wide content authorship for administrativo** — turns an administrative delegate
  into the commission's universal author; ADR 0061 never granted it and "management" does not
  imply it.
- **Auto-redirect from `/casos`** for manage-capable viewers — breaks "see what the committee
  sees", forks behavior per role, destabilizes shared links.

## Obligations (each blocks the increment that ships it)

**Increment 1 (routing/UI, no DB):** the entry gate is fail-closed-tested for every excluded
class (read-grantee, plain member, quality reviewer, cross-commission); `org_admin`'s mapping
at the new gate is *verified*, not assumed (their `_case_caps` arm is `manage_case_access`
only — they must not silently pass); the `multiplos` `isAdmin` bypass is resolved against the
noun rule; E2E re-anchors (`administrativo`, `case-access`, `quality-oversight` — D8 lands
first) with the full §6 step-1 gate set green on a fresh reset.

**Increment 2 (the S8 arm):** pgTAP differential with **all six directions** — positive (an
administrativo with zero grants reads a grantless case), negative (appointment or capability
revoked ⇒ read gone), flag-dark (the `administrativo` kill switch darkens S8), the over-grant
twin (arm reverted ⇒ the positive goes red), the audit row (an S8-derived open emits
`case.opened` — Rule 11), and the **PHI non-leak proof**: `app.can_read_case_patient` must be
shown, from the catalog, not to inherit S8 — an administrativo gaining commission-wide
*patient-identifier* read as a side effect is a Rule 12 violation, not a feature. Then the
§6 authz gates: all four ARMs, and the diff-scoped door sweep over exactly the changed
objects (ADR 0079 Amendment 1 recipe, list derived from the migration diff) — noting ADR
0129's lesson that the recipe's syntax filter can return an **empty** case list for a
resolver-body change, in which case the sweep runs **by the property** (open S8 alone; require
red). `gen:types` after the migrations (Rule 8). The Amendment 1 stubs in ADRs 0033/0061 are
updated from "not yet built" to the build record in the same change.

## Consequences

- `/casos` becomes literally a reading surface; the two carve-outs `8675b7cd` left are gone,
  and the one-sentence rule (D1) is teachable to users and to specs alike.
- The quality-oversight pairing regains a stable, non-vacuous anchor that survives the
  redesign, and `main`'s e2e declare-green baseline stops being red for a known-stale reason
  before AFF2 pins it.
- After Increment 2, an administrativo's board fills with the commission's cases and their
  four existing capabilities become exercisable without per-case coordinator grants — the
  delegation finally takes load *off* the coordinator instead of adding a grant step.
- ADR 0033 Q3's boundary sentence and ADR 0061's four-capability menu are both amended (their
  Amendment 1 stubs point here) — left as written they would assert stale claims silently.
- Out of scope, stated: lifecycle for administrativo, write-grant widening, a per-case
  `manage` level, any change to action-item completion authority, remote push.

---

## Amendment 1 — 2026-08-21 (PO-ruled at build start): the two OPEN items, and D5 widens to bulk

**Status:** Accepted, PO-ruled 2026-08-21 during the build session that opened
`feat/case-surface-split`. Recorded here because **D11 withheld build start and bounded the
ratified scope** — one of these rulings extends that bound, so leaving it in PROGRESS.md alone
would leave the ADR asserting a scope that is no longer the decision.

### A1.1 — OPEN-1: no backfill (confirms the plan's recommendation)

Existing `administrativo` appointees do **not** receive the new `read_cases` capability
retroactively. The coordinator opts in per appointee, so the capability's audit trail always has
a coordinator action behind it; a backfill would widen reach with no such action. `supabase/seed.sql`
grants it explicitly to `staff2.ccih` — a fixture decision, and the seed header roster note moves
in the same change.

### A1.2 — OPEN-2: bulk case creation opens under the **same** `create_cases` key

**This amends D5 and extends D11's scope.** D5 assumed an administrativo holding `create_cases`
should reach bulk creation; the build measured the door and found `public.bulk_create_cases`
gated by `app.is_staff_admin_of` **only** — no `member_can` arm — so D5's letter would have
admitted them to a wizard whose commit always raises `42501`. Increment 1 therefore shipped the
**narrowing half only** (dropping the dead `context.isAdmin` bypass), and the widening was
referred to the PO because it is a change to administrativo **write** authority, which D11 placed
outside the ratified scope.

**PO ruling:** open it, under the existing key. In the PO's words — *an `administrativo` role is
granted to a responsible healthcare professional; creating many cases carries the same logical
responsibility as creating one.*

**The counter-argument was put and rejected, and is recorded so it is not re-litigated as if
unseen:** `create_cases` today authorises **one** case, while `bulk_create_cases` creates up to
**200 in one atomic call and assigns them across members**, so reusing the key changes the reach
of every checkbox already ticked without anyone re-ticking it. The PO ruled the responsibility is
the same in kind, and that a sixth menu key would split one delegation into two for no
governance gain. **Rejected: a separate sixth capability key.**

### Consequences

- Increment 2 gains a second migration: a `member_can(commission, 'create_cases')` arm on
  `bulk_create_cases`, routed through the **flag-aware chokepoint** so the `administrativo` kill
  switch darkens it exactly as it darkens `update_case_meta`.
- It carries the **same** pgTAP obligations as the S8 arm — positive, negative (capability and
  appointment revoked), flag-dark, and the **over-grant twin** (arm reverted ⇒ the positive goes
  red). A widening without its twin is the one shape this program has refused throughout.
- Only **after** that door admits it do `multiplos` and the "Múltiplos casos" link re-gate onto
  the capability. ⚠ **Increment 1's T4 narrowing is superseded, not reversed as an error:** it
  was correct when shipped, because the route must never out-run the door. Sequence, not
  flip-flop — and any build record that shows T4 tightening then loosening must say which.
- The existing `create_cases` checkbox's **meaning changes for appointees who already hold it**.
  That is the accepted cost of the ruling, not an oversight; it is stated here so a later reader
  does not discover it as a surprise and file it as a defect.

---

## Amendment 2 — 2026-08-21 (**PROPOSED — PO ruling requested**): creation-scoped PHI entry for `administrativo`, and the resolution of OPEN-4

**Status: ✅ ACCEPTED — the PO ruled OPTION D on 2026-08-21**, in the build session, when asked
explicitly which option they were ruling. *(The text below was authored as a PROPOSED amendment and
is preserved as the record of the question and its analysis; only this status block and §A2.7's
scope note are post-ruling. The ruling was **asked for rather than inferred**: this document was
pointed to with "the problem has been solved", but it was written to withhold authorization, and
option D is the platform's first PHI write path not held by a coordinator — not a thing to derive
from a summary.)*

**What the ruling authorizes is exactly §A2.7's "yes on D" list** — the A2.2 split-writer mechanism,
its migrations, the A2.5 test bill, and the A2.6 record updates, **locally on
`feat/case-surface-split`**. It does **not** authorize any remote `db push`, any merge to `main`,
PHI **read** for administrativo in any form, PHI write outside the creation path, or any change to
`dispose_case_phi` / the xref gates. ⛔ It is **Increment 2** work and does not start until
Increment 1 has passed its gate (currently **QA: CHANGES REQUESTED**).

~~**Status: PROPOSED. This amendment records a question put to the PO, not a ruling.** ⛔ It
authorizes nothing~~ — no migration, no route change, no merge, no remote push. It is written down as
an amendment rather than left in a session because it would **extend D11's bounded scope a second
time**, and because it is a **Rule 12** change: Amendment 1 §A1.2 opened *bulk creation* to a
`create_cases` administrativo, and measurement then found that the same wizard's **patient block**
is refused by a different door — the open item recorded as **OPEN-4** (PROGRESS.md § Now).

**Decides:** OPEN-4. **Amends, if accepted:** D6's read-only boundary (this is a **write** arm),
Amendment 1 §A1.2's Consequences (door 2 gains a further migration), and the "audited single door"
language in ADRs [0030](./0030-patient-safety-phi-and-pqs-architecture.md) /
[0038](./0038-case-patient-identifiers.md) / [0066](./0066-patient-xref-participant-rekey.md) +
CLAUDE.md §1 / §3 Rule 12. **Binding rules:** 1 (RLS is the boundary), 11 (audit), 12 (PHI
minimum-necessary).

### The decision, in one paragraph

An `administrativo` may open cases. On a process that records a patient, the case-creation form
shows the patient fields — and always has, because it keys on **the process**, not on **the
viewer**. The database then refuses the write: case PHI is coordinator-only. So the helper types
identifiers and loses them — one case today, and **up to 200 rows plus a whole-batch rollback**
once A1.2's bulk door opens. The question is *not* whether administrativos should see patient data:
under every option below they still cannot, ever, including the rows they typed. The question is
whether they may **type identifiers in, once, while the case is being created**, with no ability to
read, edit, or dispose of them afterwards.

### Measured baseline (live catalog + code, 2026-08-21)

⚠ **Re-derive every row by its property at build time; never quote this table.** This program's
baselines have been wrong three times in two days, always the same way — naming the instance found
instead of the class (plan §1's warning box).

| # | Fact |
| --- | --- |
| M1 | `public.set_participant_patient` (`prosecdef = t`) has **one** authority branch: `app.is_staff_admin_of(commission)` — no `member_can`, no `can_write_case_content`, no `is_admin`. `public.set_case_patient` is a **gate-less** compat wrapper delegating to it. |
| M2 | `app.can_read_case_patient` = `app.has_case_capability(case, uid, 'read_standard_phi')`. In `app._case_caps` that bit has **exactly two** sources: S1 coordinator, and S3 iff the grant's own `read_standard_phi` **column** is set (never inferred from a read or write grant — A16). |
| M3 | `public.patient_identifiers` / `public.patient_participants`: RLS **on**, **0 policies**, **no `authenticated` ACL**. The DEFINER door does not supplement RLS here — it **is** the entire boundary, so a widening cannot be scoped row-wise by policy. |
| M4 | A write to `patient_identifiers` fires `trg_derive_patient_keys` **and** `trg_xref_maintain_patient_identifiers` → the cross-module patient index behind `public.search_patient_xref` / `app.patient_trajectory_bundle` (gate: `is_pqs_operator_of ∨ is_dpo_of`, hospital-scoped). **Case PHI is not case-local.** |
| M5 | `app.trg_audit_patient_identifiers` writes `case_patient.updated` with `'{}'::jsonb` — no payload, by Rule 11. A write is attributable but **not reconstructable**. |
| M6 | `public.dispose_case_phi` is coordinator-only. |
| M7 | `public.create_case` and `public.create_case_from_template` **already admit** `app.member_can(commission,'create_cases')`; the non-coordinator creator self-grant is level `'read'` with `p_read_standard_phi` **false**. ⇒ an administrativo who creates a PHI-collecting case today **cannot read its identifiers**. |
| M8 | `app.member_can` = `feature_enabled('administrativo') ∧ is_active(uid) ∧ is_member_of(commission) ∧ ∃ capability row` — flag-aware **and** membership-aware. (Corrects the docblock falsified as F-3 in the Increment-1 review: it does **not** gate on the capability row alone.) |
| M9 | The create dialog shows the PHI block on `casePatientEnabled && selectedTemplate?.collectsPatient` — **no viewer condition** (`create-case-dialog.tsx:223`); the bulk grid pre-selects Nome + Prontuário (`DEFAULT_PHI_KEYS`, `bulk-create-wizard.tsx:92`). The dead end is the **default** path, not a deliberate one. |
| M10 | `createCaseFromTemplate` mints the case, then writes PHI in a second RPC; on refusal it returns `{ ok:false, caseId, error }` — **the case survives without its identifiers** (`src/lib/cases/actions.ts` ~:492). Bulk instead re-raises and rolls the **whole batch** back. |
| M11 | Post-creation surfaces already behave correctly for a write-once actor: `CasePatientPanel` receives `canEdit={caps.canManageLifecycle}` (coordinator-only) and an unentitled reveal renders a **designed denial**, not an error (`case-detail-view.tsx:822`, `case-patient-panel.tsx:195`). |
| M12 | **22** functions set the `app.in_case_rpc` GUC — incl. `close_case`, `cancel_case`, `reopen_case`, `approve_correction`, `dispose_case_phi`. It is a **trigger-guard bypass**, not an identity signal. |
| M13 | `supabase/tests/189_bulk_create_cases.sql:153` is a live keystone pinning "an administrativo holding `create_cases` is denied bulk (42501)". Any widening must **invert it deliberately**. |

### The options put to the PO

- **A — Suppress the affordance (no DB change).** Pass a server-computed `canWritePatientPhi`
  (mirroring M1) into the create dialog and the bulk wizard; when false: no PHI columns, no PHI
  block, `patient: null`. Coordination fills identifiers afterwards on the case detail. *Cheapest,
  changes no rights, and is honest — but it weakens the delegation exactly on patient-bearing
  processes, and the coordinator must revisit every case the helper opened.*
- **B — Block `create_cases` on patient-collecting processes.** Rejected in analysis: it disables
  the delegation precisely where committees carry the most volume, and couples an **authority**
  decision to **template configuration**, which any coordinator can change without an authority
  review.
- **C — Ship as-is and accept the `42501`.** Rebuilds, at 200× the cost, exactly the dead-end door
  T4 was overruled to avoid. Not recommended under any reading.
- **D — Creation-scoped PHI write (RECOMMENDED).** A `create_cases` administrativo may supply
  patient identifiers **as part of creating a case**, single or bulk. No read, no later edit, no
  disposal.

> **Direction change, recorded:** the analysis session first recommended **A**, then moved to **D**
> once the overwrite hazard was measured to be **edit-time only** — M1 is an upsert, but a case
> being minted has no participant chain, so the creation path can only ever *insert*. A remains a
> coherent choice; D is recommended. Stated so a later reader does not read the shift as drift.

### A2.1 — Proposed decision (if the PO accepts D)

A member holding the `create_cases` capability may write patient identifiers **only** through the
case-creation path (`create_case`, `create_case_from_template`, `bulk_create_cases`). Everything
else about case PHI is unchanged: they may not read it (M2 untouched), may not edit it afterwards,
may not dispose of it (M6), and gain no access to the cross-module patient index (M4's gate is
untouched).

### A2.2 — Mechanism (binding if D is accepted — here the mechanism *is* the decision)

**Two mechanisms are rejected, for reasons that outlive this feature:**

1. ⛔ **A GUC-conditioned gate** (`current_setting('app.in_case_rpc')`). Per **M12**, 22 functions
   set that GUC, and it means "a sanctioned case RPC is running", not "this caller is entitled".
   Promoting it to an authority predicate makes all 22 sites — and every future one — PHI
   authorization sites. It is also outside every ARM's domain (they bound by `prosecdef` and policy
   presence), i.e. a door-blindness shape by construction (ADR 0079).
2. ⛔ **Widening `public.set_participant_patient` with a "no identifiers yet" condition.** That door
   checks the **commission**, never the caller's relationship to the **case** (M1). A `member_can`
   disjunct there would admit writing identities into **any** patient-capable case in the commission
   that has none — including the coordinator's and ethics cases — and S8's commission-wide read
   would make those targets enumerable. *"First write wins" is not "a case I am creating".*

**Accepted mechanism — one writer, two explicit gates.** Split the writer:

- `app._set_participant_patient_unchecked(...)` — the whole body (flag, exclusion, `patient_enabled`,
  disposal, sex, the ADR-0038 name-or-MRN floor, the participant chain, the upsert), **no authority
  check**, in the `app` schema so it is unreachable from PostgREST. Naming precedent already in the
  codebase: `app._grant_case_access_unchecked`.
- `public.set_participant_patient` — keeps its coordinator gate (M1), then calls the helper.
- The three creation RPCs — which have already gated on "may you create cases here" and hold a case
  they minted **in the same transaction** — call the helper directly.

Creation-scope is then **structural, not predicate-based**: no other caller exists. The audit
trigger is table-level (M5) so it fires on every path, and the floor/flag checks live in one body,
so the two doors cannot drift apart. Single-case creation must take the patient payload as an
**argument** (today it is a second round-trip, M10) — a signature change + `gen:types` (Rule 8);
`bulk_create_cases` swaps `public.set_case_patient` for the helper.

### A2.3 — What D does **not** grant (each verifiable from the catalog)

`read_standard_phi` (M2 keeps two sources — the S8 non-leak obligation is untouched) · editing
identifiers after creation · `dispose_case_phi` (M6) · `search_patient_xref` /
`patient_trajectory_bundle` (M4's gate) · anything in the `event_patient` or `referral_patient`
modules · `close_case` / `cancel_case` / `set_case_outcome`.

### A2.4 — Residual risks, accepted explicitly rather than discovered later

1. **Cross-module amplification is NOT mitigated by creation-scoping (the strongest objection).**
   Per M4, a 200-row batch seeds a hospital-wide identity graph read by PQS operators and the DPO,
   typed by someone who can neither read it back nor search the index for an existing match. A
   mistyped MRN mislinks a trajectory in modules the administrativo has no standing in.
2. **Correction becomes a coordinator queue, and the detector is not the author.** Only a
   coordinator can see the error; only the administrativo made it. **Mitigation required in the
   same change:** the create/bulk response echoes the identifiers just written (the client already
   holds them) so a typo is caught at the keyboard, not months later.
3. **Duplicate patient chains scale with batch size.** No read, no xref ⇒ no dedup check. Not a
   regression (coordinators cannot check either), but it grows with volume.
4. **The "single audited door" claim becomes false as written** unless A2.6 lands in the same
   commit. A stale record here is the failure mode this repo pays for most often.

### A2.5 — Obligations (each blocks the migration that ships it)

- **The keystone that makes "creation-only" true rather than decorative:** the same administrativo,
  **one call later**, is refused on `set_case_patient` / `set_participant_patient` for the case they
  just created. Without it, "creation-only" is a comment.
- pgTAP differential, all directions: positive (single **and** bulk, with PHI) · negative
  (capability revoked · appointment revoked · membership removed — M8 covers all three) · flag-dark
  (`administrativo` off; `case_patient` off) · **over-grant twin** (revert the arm ⇒ the positive
  goes red) · audit row `case_patient.updated` with the administrativo as actor (Rule 11) ·
  **PHI non-leak proof from the catalog**: `app.can_read_case_patient` is still false for them
  **after** they have written.
- **Invert M13 deliberately**, in the same change, with the new intent stated in the test header.
- §6 authz gates: all four ARMs, plus **`ARM=census`** specifically — a brand-new gate is in no
  BLIND set and so passes `ARM=policy` **vacuously** (ADR 0079 Amdt 3) — plus the diff-scoped door
  sweep over exactly the changed objects, list derived from the migration diff.
- `gen:types` after the migrations (Rule 8); the route may re-gate onto the capability **only after**
  the door admits it (the program's standing ordering rule — the route must never out-run the door).

### A2.6 — Records that must change in the same commit (if D is accepted)

CLAUDE.md §1 + §3 Rule 12 (the case module has one writer with **two** gates) · ADRs 0030 / 0038 /
0066 single-door language · ADR [0061](./0061-administrativo-delegated-role.md)'s PHI note — its
claim that `create_cases` lets an administrativo "enter and read patient context" is **false today
in both halves** (M7) and would become half-true under D · this ADR's D6 and Amendment 1 §A1.2 ·
PROGRESS.md OPEN-4.

### A2.7 — Approval scope (an approval's scope is a fact that must be written down)

A PO "yes" on **D** authorizes: the A2.2 mechanism, its migrations, the A2.5 test bill, and the A2.6
record updates — **locally, on `feat/case-surface-split`**. It does **not** authorize: any remote
`db push`, any merge to `main` (a separate call per increment), PHI **read** for administrativo in
any form, PHI write outside the creation path, or any change to `dispose_case_phi` / the xref gates.
A "yes" on **A** authorizes only the UI suppression and closes OPEN-4 with no DB change.

### Consequences

- OPEN-4 closes either way; under **D** it closes by making the door accept rather than by hiding an
  affordance, and the post-creation surfaces (M11) already read correctly with no suppression work.
- Under **D** the administrativo delegation finally covers patient-bearing processes end to end —
  where committee volume concentrates — extending D6's take-load-off-the-coordinator goal from
  *read* to *intake*.
- Under **D** the platform gains its first PHI write path not held by a coordinator. That is the
  fact a future auditor will find first; A2.4 exists so they find the reasoning attached to it.
