# ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases

**Status:** **Accepted — design PO-ratified 2026-08-21** (design/grilling session; this ADR is
the record of that approval and of its scope — see D11, **as extended by Amendment 1**) ·
**IN BUILD** (PO build-go 2026-08-21; Step 0 ✅ done · **Increment 1 ✅ gated §6 1–5, QA APPROVED r3,
PO-approved and MERGED to `main` 2026-08-21 (`6e364203`)** · Increment 2 not started · **no remote
`db push`**) — ⚠ *this line read "code built but not gated, nothing merged" until 2026-08-22; corrected
by measurement, not by memory* — implementation plan:
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

1. **The split's meaning, in one sentence** — ⭐ **AMENDED 2026-08-22 by Amendment 3 (PO-ruled);
   this is the live text and the one Increment 2 is judged against:** *`/casos` shows the case as
   its readers see it, plus your own name-attributed work. Among the viewers who can open that
   page, nothing on it varies by capability or by case-wide grant — an affordance may appear on
   `/casos` only if it is name-attributed, or if its door admits **every member who can open the
   page**. Anything case-wide you may do because of what you hold lives behind one uniform
   "Gerenciar caso" button on `/manage/cases/[caseId]`.* An affordance claiming the
   "admits every member" exception must show its door's guard **from the live catalog** (A3.5
   condition 1); the exception is a property of the **door**, never of the affordance's importance.
   ~~*Ratified 2026-08-21, superseded:* `/casos` shows the case as the committee sees it plus your
   own name-attributed work; anything case-wide you are allowed to do lives behind one uniform
   "Gerenciar caso" button. **The carve-outs go to zero.**~~ ⛔ The struck sentence was **observably
   false on `main` from the day it was ratified** — two write affordances on `/casos` never consulted
   `caps` at all and neither could be relocated (A3.1, measured). It is kept because "the carve-outs
   go to zero" was quoted as an acceptance criterion in three places, and a reader who finds only the
   new text cannot tell which claim those citations were making.
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
   rest. ⭐ **AMENDED 2026-08-22 by Amendment 4 (PO-ruled): the arm is bounded by `not v_eg`**, so an
   `explicit_grants_only` case is invisible to it — reach there rides an explicit grant (S3) or
   nothing, exactly as for S5 and S7. As first written this clause had no bound at all. S8 confers **`read_case_content` only** — content authorship (`canWriteContent`)
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

## Amendment 2 — 2026-08-21 (**✅ ACCEPTED — PO ruled option D**; authored as PROPOSED, see the status block): creation-scoped PHI entry for `administrativo`, and the resolution of OPEN-4

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
| M2 | `app.can_read_case_patient` = `app.has_case_capability(case, uid, 'read_standard_phi')`. ⛔ **Corrected 2026-08-22 by re-measurement: the bit has THREE writes in TWO arms, not "exactly two sources"** — S1 coordinator, S3 iff the grant's own `read_standard_phi` column is set, **and S3 again iff the grant's `read_restricted_phi` column is set** (restricted ⇒ standard). The substantive claim survives: it is never inferred from a read or write grant (A16). A count stated one short is how an over-grant twin gets aimed at the wrong arm. |
| M3 | `public.patient_identifiers` / `public.patient_participants`: RLS **on**, **0 policies**, **no `authenticated` ACL**. The DEFINER door does not supplement RLS here — it **is** the entire boundary, so a widening cannot be scoped row-wise by policy. |
| M4 | A write to `patient_identifiers` fires `trg_derive_patient_keys` **and** `trg_xref_maintain_patient_identifiers` → the cross-module patient index. **Case PHI is not case-local.** ⛔ **Corrected 2026-08-22: the gate is not one gate.** `public.search_patient_xref` is `is_pqs_operator_of ∨ is_dpo_of`; **`public.get_patient_trajectory_for_entity` is PQS-only, with no DPO arm**; and `app.patient_trajectory_bundle` holds no `authenticated` EXECUTE, so it is not a door at all. One gate quoted for three surfaces reads like a proof about all three. |
| M5 | `app.trg_audit_patient_identifiers` writes `case_patient.updated` with `'{}'::jsonb` — no payload, by Rule 11. A write is attributable but **not reconstructable**. |
| M6 | `public.dispose_case_phi` is coordinator-only. |
| M7 | `public.create_case` and `public.create_case_from_template` **already admit** `app.member_can(commission,'create_cases')`; the non-coordinator creator self-grant is level `'read'` with `p_read_standard_phi` **false**. ⇒ an administrativo who creates a PHI-collecting case today **cannot read its identifiers**. |
| M8 | `app.member_can` = `feature_enabled('administrativo') ∧ is_active(uid) ∧ is_member_of(commission) ∧ ∃ capability row` — flag-aware **and** membership-aware. (Corrects the docblock falsified as F-3 in the Increment-1 review: it does **not** gate on the capability row alone.) ⛔ **Corrected 2026-08-22 by mutation, not by reading: that is FOUR terms but only THREE independent ones.** `app.is_member_of(_for)` is itself `is_active(u) ∧ has_role_any(...)`, so the explicit `is_active` term is implied by the membership term — deleting it alone leaves the whole S8 suite **71/71 green**. Not a hole (membership still covers it), but not the belt-and-braces the phrasing implies, and ⚠ **a sweep asserting `is_active` is PRESENT would pass on a body where it had been deleted.** |
| M9 | The create dialog shows the PHI block on `casePatientEnabled && selectedTemplate?.collectsPatient` — **no viewer condition** (`create-case-dialog.tsx:223`); the bulk grid pre-selects Nome + Prontuário (`DEFAULT_PHI_KEYS`, `bulk-create-wizard.tsx:92`). The dead end is the **default** path, not a deliberate one. |
| M10 | `createCaseFromTemplate` mints the case, then writes PHI in a second RPC; on refusal it returns `{ ok:false, caseId, error }` — **the case survives without its identifiers** (`src/lib/cases/actions.ts` **:494-501**, return at **:499**). ⛔ **Corrected 2026-08-22: the shape exists at TWO sites, not one** — `createCase` carries the identical block at **:570-577** (return at **:575**), and its own comment says so (*"exactly as createCaseFromTemplate does"*). Naming one site makes a two-site fix read as done. Bulk instead re-raises and rolls the **whole batch** back. |
| M11 | Post-creation surfaces already behave correctly for a write-once actor: `CasePatientPanel` receives `canEdit={caps.canManageLifecycle}` (coordinator-only) and an unentitled reveal renders a **designed denial**, not an error. ⛔ **Line ref corrected 2026-08-22:** the mount is `case-detail-view.tsx` **:866-871** (`canEdit` on **:868**); the cited `:822` is inside `CaseOutboundReferralsCard`, a different component. Behaviour CONFIRMED; the pointer was not. |
| M12 | **22** functions set the `app.in_case_rpc` GUC — incl. `close_case`, `cancel_case`, `reopen_case`, `approve_correction`, `dispose_case_phi`. It is a **trigger-guard bypass**, not an identity signal. |
| M13 | `supabase/tests/189_bulk_create_cases.sql` **:162-168** is a live keystone pinning "an administrativo holding `create_cases` is denied bulk (42501)". Any widening must **invert it deliberately**, keeping its anti-vacuity PRE at **:160-161** (`member_can → true`, which is what stops the deny reading as a missing-capability deny). ⛔ **Line ref corrected 2026-08-22 by re-measurement:** this row said `:153` from filing until the build, and `:153` is the fixture INSERT — the row is the reason the correction was findable, and the reason to re-derive rather than quote. |

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

   > ⛔ **NARROWED AT BUILD TIME, 2026-08-22 (lead ruling; the PO may overrule and this note exists to
   > be overruled).** The mitigation ships, but **the server returns no identifier value.** The
   > confirmation is built **client-side from the payload the user just submitted**; the creation
   > response carries a **non-PHI structural result only** — per row, the outcome, the `caseId`, and
   > *which* identifier fields were set, never their values.
   >
   > **Why:** option D grants a **write** and grants **no read, ever** (§A2.3). A response body carrying
   > identifier values back to a principal holding no `read_standard_phi` is a PHI read path wearing a
   > different name, and it is the first thing an auditor finds in the module where Rule 12 says
   > minimum-necessary. This clause's own parenthetical — *"the client already holds them"* — is
   > simultaneously the justification for echoing and the reason the **server** need not be the one to
   > do it. The stated purpose (*a typo is caught at the keyboard, not months later by a coordinator
   > who cannot know who typed it*) is met in full by showing the user their own submission.
   >
   > **Narrowing what a PHI path moves is safe; widening is not** — that asymmetry is why this was
   > ruled rather than escalated. ⚠ **What the narrowing does NOT catch, stated rather than
   > discovered:** a **server-side normalization** surprise (`nullif(btrim(…))`, the derived keys, the
   > ADR-0038 name-or-MRN floor) is invisible to a client-side echo, because the client shows what was
   > typed rather than what was stored. A2.4's risk is a **typing** error and that is covered; a
   > *storage* mismatch is not, and remains uncovered by design.
   >
   > **Pinned both directions:** the creation response for a `create_cases` administrativo contains
   > **no identifier value** (asserted on the returned payload, not in a comment), **and** the write
   > nonetheless landed in `patient_identifiers`. ⚠ The absence half is the one that can go vacuous —
   > the fixture must write a value that *could* have appeared.
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

---

## Amendment 3 — 2026-08-22 (**✅ ACCEPTED — PO-ruled 2026-08-22**; authored as PROPOSED, see the status block): D1's wording — the invariant `/casos` protects is capability-invariance, not the absence of writes

**Status: ✅ ACCEPTED — the PO approved the refined wording on 2026-08-22**, in the session that
drafted it. **D1's sentence is replaced by §A3.2 above in the Decision list**, and the replacement is
live from this ruling: Increment 2's `/casos` surface is judged against the refined sentence, not the
ratified one.

**What this approval covers (§A3.8, restated because scope is a fact that must be written down):**
the D1 replacement text, the §A3.7 items 1–2 record edits (the plan's two restatements,
`reading-surface.ts`'s docblock, the two site comments), and judging Increment 2 against the refined
sentence. **It does NOT cover:** any new affordance on `/casos`, any change to
`narrowToReadingSurface` or D3's entry predicate, any DB change, any remote `db push`, or any merge.
⛔ **It did not close `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY`** — that is a D6 question and was ruled
**separately, in the same session**, as **Amendment 4** below. Two rulings, two records; neither
inherits the other's scope.

*(The text below was authored as a PROPOSED amendment and is preserved as the record of the question
and its analysis; only this status block is post-ruling.)*

~~**Status: PROPOSED. This amendment authorizes nothing and changes no code.** Until the PO rules,
**D1 as ratified on 2026-08-21 stands exactly as written**, and any surface argument must be made
against that sentence, not this one.~~ ⛔ Amendment 2 was authored in this same shape and was briefly
treated as its own approval because a summary pointed at it — *a pointer to this section is the
analysis, never the ruling.* QA cannot adopt it either: D1 is PO-ratified text, which is why r2 §7.9
judged the refinement sound and **referred** it here instead of applying it.

**Why it is filed now, and not later.** Increment 2 (D6/S8) admits a new viewer class to `/casos` —
an `administrativo` holding `read_cases`, who can suddenly reach every case in the commission. D1 is
the sentence that increment's acceptance will be judged against, and as ratified it is **observably
false on `main` today**. Judging a new increment against a rule its own codebase already contradicts
is how Increment 1 spent two review rounds.

### A3.1 — What is false about D1's letter, measured

D1's *"the carve-outs go to zero"* is false in exactly one direction: `/casos` still renders **write
affordances that `caps` does not close**, because they never consulted `caps` at all. The narrowing
transform (`narrowToReadingSurface`) zeroes `canManageLifecycle` and `canWriteContent`; an affordance
that reads neither is untouched by it. Both members of that class are annotated at their sites
(`case-detail-view.tsx:484` and `:660`) and their doors were re-measured from the live catalog on
2026-08-22 — `pg_get_functiondef`, comments stripped, **every** `if` branch read, never a
line-filtered `prosrc`:

| Affordance on `/casos` | Rendered when | Its door (`prosecdef = t`) | The door's **authorization** guard |
| --- | --- | --- | --- |
| `NotifyEventDialog` — notify a patient-safety event | `patientSafetyEnabled && !isOversight` | `public.notify_safety_event` | `app.is_member_of(reporting_commission)` **only**, itself `is_active(uid) ∧ has_role_any('commission', …)`. No capability, no grant, no specific role. |
| "Corrigir…" — file a correction request | `correctionsEnabled && !isOversight`, `canFile: isOpen` | `public.file_correction_request` | `app.can_read_case(case, uid) ∧ ¬app.is_oversight_only_reader(case, uid)`, then `is_active`, then target/lifecycle validations (not authorization). |

⚠ **The count "two" is QA r1 §F-1's enumeration restated in the code, not a fresh sweep.** Re-derive
it by the property — *every `/casos` route that renders a write affordance* — before relying on the
number. A short hand-list is the hazard this program has already been burned by, which is why
Increment 1 replaced the checklist with a function in the first place.

**Neither can be relocated, and that is the point.** `/manage` 404s plain members by D3 — and plain
members are exactly the population both affordances exist for. Reporting a safety event and asking
for a correction are the two things a committee member must be able to do on a case they do not
manage. Obeying D1's letter would mean **deleting an authority to satisfy a sentence.**

### A3.2 — The proposed replacement wording

> **`/casos` shows the case as its readers see it, plus your own name-attributed work. Among the
> viewers who can open that page, nothing on it varies by capability or by case-wide grant** — an
> affordance may appear on `/casos` only if it is name-attributed, or if its door admits **every
> member who can open the page**. Anything case-wide you may do *because of what you hold* lives
> behind one uniform "Gerenciar caso" button on `/manage/cases/[caseId]`.

### A3.3 — Why the second clause is a strengthening, not a loophole

The rule is enforced by a **differential**: two viewer classes, the same `/casos` URL, compare what
each is offered. Its entire power comes from *variation between the classes*.

An affordance whose door admits every member who can open the page is **identical on both sides of
that comparison**. It cancels out. It cannot make a broken narrowing look fixed, cannot mask a
capability leak, and is outside the differential's domain **by construction rather than by
permission**. The ratified wording, by contrast, is stricter than the property the test can measure
*and* stricter than reality — and a rule stricter than reality is not obeyed, it is excepted, one
undocumented affordance at a time. Restating D1 as capability-invariance makes it, for the first
time, a sentence the E2E differential actually proves.

### A3.4 — "Among the viewers who can open the page" — the clause Increment 2 forces

QA's proposed phrasing was *"name-attributed or member-universal"*. Measured against the two live
members, that phrasing admits `NotifyEventDialog` and **refuses "Corrigir…"**, whose door keys on
`app.can_read_case` rather than on membership. Refusing it would be wrong, and the reason is
structural:

- `/casos/[caseId]` **is itself gated on the same predicate**. The route loads the case and 404s when
  it comes back unreadable (`getCaseDetail → notFound()`), and `app.can_read_case` is a thin
  projection of `read_case_content`. So the page's audience **is** the `can_read_case` set.
- An affordance keyed on the page's own admission test is therefore invariant across everyone who can
  see the page — trivially, since failing it means never seeing the page.

**S8 widens the AUDIENCE; it does not introduce VARIATION inside it.** That distinction is what the
clause exists to state, and it is what makes the sentence stable across Increment 2 instead of
needing a fourth amendment the moment `read_cases` ships.

⚠ **The test does real work here — it surfaced an unbounded arm.** Applying it to "Corrigir…" for the
*new* S8 audience requires that an S8 administrativo pass `¬is_oversight_only_reader`, which is
`read_case_content ∧ ¬read_case_deliberation`. Measured: S8 as specified in D6 confers
`read_case_content` **only**, and the deliberation bit would come from **S5**
(`committee_member_default`) — which is bounded by `not v_eg`, i.e. it does **not** fire on a case
whose access policy is `explicit_grants_only`. Neither this ADR nor the plan mentions that bound
anywhere (measured: zero occurrences). Consequences, both of which belong to D6 and **not** to this
wording question — filed as `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY`, to be ruled before the M2
migration is written:

1. If S8 is unbounded, it **overrides `explicit_grants_only`** — the policy whose entire purpose is
   that only explicit grants confer reach.
2. On such a case the administrativo becomes content-without-deliberation, which is **the exact
   bit-shape of a quality reviewer**, so every door keyed on `is_oversight_only_reader` would classify
   them as one — starting with a "Corrigir…" button that renders and then raises `42501`. A dead-end
   door, the same shape Amendment 1 §A1.2 caught for `bulk_create_cases`.

### A3.5 — Conditions carried into the wording

QA r2 §7.9's two conditions, adopted verbatim, plus one this measurement added:

1. **"Admits every member" is earned at the door, never claimed.** Show the guard from the **live
   catalog** (`pg_get_functiondef`, comments stripped, every `if`/`elsif` branch) — a line-filtered
   `prosrc` under-reports multiline guards and always in the reassuring direction. A door whose guard
   cannot be shown is not eligible for the exception. Without this condition the exception becomes the
   hole through which capability-varying affordances re-enter `/casos` one at a time.
2. **Say "member" / "audience", never "universal".** The oversight reviewer's exclusion
   (`!isOversight`) is ADR 0100 D7's rule on a **different axis** — reviewers are read-only by design
   and both affordances close to them correctly. D1 governs variation **among members** and says
   nothing about that axis; conflating them would quietly claim a reviewer is included.
3. **(added) The exception is a property of the DOOR, not of the affordance's importance.** "Members
   really need this" is not the test and never becomes it. "Its door admits every member who can open
   this page" is.

### A3.6 — What this does not change

- **D2–D11 are untouched**, including D2's narrowing rule and D3's entry predicate. This amends the
  wording of D1 only.
- **The narrowing transform is untouched.** `narrowToReadingSurface` still zeroes both case-wide bits;
  nothing about the exception flows through `caps`.
- **Rule 1 still holds** — none of this is a security control. Every door decides for itself; this
  governs what a reading surface may *offer*.
- **It authorizes nothing new on `/casos`.** It describes the two affordances already there and sets
  the test any future one must pass. Adding a third is a new decision, not an application of this one.

### A3.7 — Obligations if accepted (each in the same delivery, not after)

1. D1's sentence is replaced in this ADR by A3.2's text; the one-sentence rule quoted in
   [docs/plans/case-surface-split.md](../plans/case-surface-split.md) moves with it.
2. `src/components/cases/reading-surface.ts`'s docblock gains the exception **and its admission test**;
   the two site comments (`case-detail-view.tsx:484`, `:660`) repoint at A3 instead of each restating
   the rule locally — that local restatement is what let the rule drift per-file before.
3. `FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED` closes **against the refined sentence**: absence on
   `/casos` paired with presence on `/manage`, per member of the case-wide class, **plus a presence
   assertion for each claimed exception across two member classes**. The second half is what makes the
   exception falsifiable instead of an excuse — without it, "member-universal" is unmeasured prose.
4. Increment 2 adds the `read_cases` administrativo as a **third column** of that differential.
5. `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` (A3.4) is ruled before M2 is written. It is a D6 question,
   not a D1 one, and must not be closed by this amendment's acceptance.
6. **If the PO refuses the refinement:** the ruling must name which of the two affordances is deleted
   from `/casos` and where its authority goes for a plain member. "Leave them and keep the sentence" is
   the one outcome not available, because that is the state this amendment exists to end.

### A3.8 — Approval scope (an approval's scope is a fact that must be written down)

A PO "yes" authorizes: **the D1 replacement text in A3.2, the record edits in A3.7 items 1–2, and
judging Increment 2's `/casos` surface against the refined sentence.** It does **not** authorize: any
new affordance on `/casos`, any change to `narrowToReadingSurface` or to D3's entry predicate, any DB
change, any remote `db push`, any merge, or a ruling on `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY`.

### Consequences

- D1 becomes a **testable property** rather than an aspiration, and the property is the one the E2E
  differential already measures. That is the substantive gain: the sentence and the test finally have
  the same subject.
- The reading surface acquires a **named, bounded exception class with an admission procedure**. The
  cost is that the class can grow; the control is condition 1 — every future member must show its
  door's guard from the catalog, and A3.7 item 3 requires each one to carry a presence assertion.
- Increment 2's new viewer class needs **no further wording change**, because A3.4 separates widening
  the audience from varying what the audience is offered.
- The amendment's own test found an unbounded S8 arm before the migration was written (A3.4). Recorded
  because it is the argument for doing wording work *ahead* of the increment rather than after it.

---

## Amendment 4 — 2026-08-22 (**✅ ACCEPTED — PO-ruled**): D6's S8 arm is bounded by the case-access policy, exactly like its siblings

**Status: ✅ ACCEPTED — the PO ruled on 2026-08-22**, in the same session as Amendment 3 and
**separately from it**. This amends **D6**. It resolves `FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY`,
which Amendment 3 §A3.7 item 5 explicitly refused to close, because a wording question about `/casos`
cannot settle a reach question about a resolver arm.

### A4.1 — The ruling

**S8 fires only when `not v_eg`** — i.e. an appointed `administrativo` holding `read_cases` gets
`read_case_content` on the commission's cases **except** those whose access policy is
`explicit_grants_only`. On such a case the arm confers nothing, and the appointee reaches it the same
way a plain member or a quality reviewer does: **through an explicit grant (S3), or not at all.**

D6's other clauses are unchanged — `read_case_content` only, no authorship, no lifecycle, routed
through the flag-aware chokepoint so the `administrativo` kill switch darkens it.

### A4.2 — Why (measured 2026-08-22 from the live catalog; full detail in the follow-up)

- **Both sibling read arms already carry the bound.** S5 · `committee_member_default` is
  `if v_member and not v_eg`; S7 · `quality_reviewer` is `if not v_eg …`, and its comment states the
  intent outright — *"Locked cases (`v_eg`) are fully invisible to the arm (D6) — exceptions ride
  `case_access_grants` (S3)."* A new read arm that omits the bound inherits none of that intent, and
  **no authz arm can see a door that omits a check its siblings all make** — the omission is invisible
  to every sweep this repo runs.
- **Unbounded, a capability checkbox would silently outrank a per-case access policy.** The whole
  purpose of `explicit_grants_only` is that only explicit grants confer reach; an arm that ignores it
  makes the appoint dialog a way around it, with no coordinator action on the case itself.
- **The bound also closes a bit-shape collision, in both directions.** `app.is_oversight_only_reader`
  is not a role test — it is `read_case_content ∧ ¬read_case_deliberation`, the quality reviewer's
  exact shape. With the bound: on an ordinary case the appointee holds content (S8) **and**
  deliberation (S5, since they are a member), so the predicate is false; on a locked case S8 confers
  nothing, so it is false there too. **Unbounded**, a locked case would have produced content without
  deliberation — an administrativo classified as a quality reviewer by every door keyed on that
  predicate, starting with `file_correction_request` refusing them `42501` while `/casos` renders the
  "Corrigir…" button, because the UI's `isOversight` is `access.isQualityViewer`, **a different test
  from the door's**. ⚠ This paragraph's two-directions claim is **derived from the measured arm
  conditions, not executed** — P10 below is what turns it into evidence.

### A4.3 — Binding on M2 (the migration may not be written without these)

1. **The arm's condition carries `not v_eg`**, written in `_case_caps`' own style and positioned with
   the other positive arms — after STEP 4's hard denies, so it inherits them by position exactly as
   S5/S7 do. `CREATE OR REPLACE` starts from `pg_get_functiondef`, never from a migration file's text.
2. **P9 · locked-case negative:** an appointee with `read_cases` gets **nothing** on an
   `explicit_grants_only` case — `can_read_case` false, absent from `list_cases_board`,
   `get_case_detail` refuses.
3. **P9-twin · over-grant, in the bound's direction:** remove `not v_eg` from the arm and **P9 must go
   RED**. Without this twin the bound is asserted, not proven — and a bound is the half of an arm that
   nothing else in the gate set can see.
4. **P10 · the bit-shape pin:** on an ordinary case the appointee is **not** `is_oversight_only_reader`
   (they hold both bits); on a locked case they hold neither. Pin both, because A4.2's claim is
   currently derivation.
5. **P11 · the grant still works:** an explicit S3 grant on a locked case confers reach to the same
   appointee — the bound narrows the *arm*, it must not narrow the *grant path*.
6. **The door set keyed on `is_oversight_only_reader` is enumerated by property** — every routine whose
   comment-stripped `prosrc` references it — and the enumeration is recorded. ⚠ Still owed:
   `file_correction_request` is the one member found while measuring something else, so the set's size
   is **not established**. Never enumerate it by recalling which doors feel oversight-related.

### A4.4 — Approval scope

This ruling authorizes: **the `not v_eg` bound on S8 and the A4.3 test bill, inside Increment 2,
locally.** It does **not** authorize: starting Increment 2, any remote `db push`, any merge, any
change to S5/S7/S3 or to `is_oversight_only_reader`, or a decision about the doors the A4.3 item 6
enumeration turns up — those are read as findings first.

### Consequences

- **`FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY` is RULED, not discharged.** The design question is
  settled; the implementation, the five pins and the door-set enumeration remain open work inside
  Increment 2, and the follow-up stays open until they land.
- The `read_cases` capability now has a **stated ceiling**: it widens reach across the commission's
  ordinary cases and stops at the same wall every other non-granted reader stops at. That sentence is
  what the appoint dialog's help text should say.
- Recorded for the build session: the gap was found by applying Amendment 3's wording test to an
  affordance, **before the migration existed**. That is the argument for settling wording ahead of an
  increment rather than after it — the same increment's worth of rework it would otherwise have been.

---

## Amendment 5 — 2026-08-22 (**✅ ACCEPTED — PO-ruled at build start**): "default-checked" means the appointment **grants** `read_cases`, not that a box is pre-ticked

**Status: ✅ ACCEPTED — the PO ruled on 2026-08-22**, in the Increment-2 build session, when asked
which of two readings D6's parenthetical carries. This amends **D6**. It was asked rather than
inferred because the two readings produce materially different work and different default reach.

### A5.1 — The measurement that forced the question

D6 says the new `read_cases` capability is *"(default-checked in the appoint dialog)"*. Measured
2026-08-22 from the live code, **that dialog has no defaults at all**:
`src/components/members/member-administrativo-controls.tsx` renders one checkbox per capability with
`checked = caps.has(c.key)`, where `caps` is initialised from **server state**
(`capabilitiesByUser[member.userId] ?? []`). A newly appointed administrativo starts with **zero**
capability rows, and none of the four is pre-ticked. ⇒ "default-checked" is not a UI default that
exists to be set; it can only be made true by a **grant**.

⛔ The third reading — tick the box in the client without a grant behind it — is **rejected outright
and must not be implemented**. That is a mirror wider than its door, the exact defect class
`FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED` was closed for one commit earlier.

### A5.2 — The ruling

**Appointing an administrativo grants `read_cases`.** `public.appoint_administrativo` (`prosecdef = t`)
inserts the `read_cases` capability row alongside the appointment, attributed to the appointing
coordinator, so the checkbox is checked because the grant exists. The coordinator may untick it, which
revokes it like any other capability.

### A5.3 — What this does and does not disturb

- **It does not reopen OPEN-1.** A1.1's no-backfill ruling governs **existing** appointees, who stay
  as they are; A5.2 governs **new** appointments only. The migration must state this and must not
  touch existing rows — and a pgTAP negative must pin that an appointee predating the migration still
  holds exactly their four.
- **The coordinator-action-in-the-audit-trail rationale survives**, because the appointment itself is
  that action and the grant is attributed to the appointer. This is the reason the two rulings do not
  contradict: A1.1's concern was a grant with *no* coordinator act behind it.
- **The seed is unaffected by the door.** `supabase/seed.sql` appoints `staff2.ccih` by **direct
  INSERT**, bypassing the DEFINER doors, so it gains nothing automatically — the seed must add
  `read_cases` explicitly (the plan §4 M1 already requires this) and the two paths must be asserted
  separately, or the seed's row would be read as evidence about the door.
- **The other four capabilities are untouched** — `appoint_administrativo` grants `read_cases` and
  nothing else.
- ⚠ **Every existing assertion that a fresh appointment confers zero capabilities becomes false** and
  must be updated deliberately, not discovered. Enumerate them by property before writing the
  migration; do not close on the ones you can recall.

### A5.4 — Approval scope

Authorizes: the `read_cases` auto-grant inside `appoint_administrativo`, its pins, and the D6 wording
correction — **inside Increment 2, locally**. Does **not** authorize: auto-granting any other
capability, a backfill to existing appointees, any change to `revoke_administrativo`'s cascade
behaviour, a remote `db push`, or a merge.

### Consequences

- D6's parenthetical is now a **grant** rule, so the reach it describes is real rather than cosmetic:
  from this migration on, appointing an administrativo confers commission-wide case read on the
  commission's ordinary cases — bounded by Amendment 4's `not v_eg`.
- The appoint door gains its first side-effect beyond the appointment row. That is the fact a later
  reader will find surprising; it is written here so they find the reasoning attached to it.

---

## Amendment 6 — 2026-08-22 (**lead ruling at build time**, PO informed): D6 names a chokepoint that cannot answer the question S8 asks

**Status: ACCEPTED by the lead during the Increment-2 build; recorded rather than substituted
silently.** This amends **D6** and plan §4's **V-G / M2**. It is a **mechanism** correction: the
*property* D6 requires — the `administrativo` kill switch darkens S8 with the rest of ADR 0061 — is
preserved exactly. Nothing is widened, and no reach changes. ⛔ The PO may overrule it; it is written
here so there is something to overrule.

### A6.1 — What was measured (live catalog, twice, independently)

D6 and plan §4 M2 both say S8 routes "through the flag-aware chokepoint `app.member_can`".

`app.member_can(p_commission_id uuid, p_capability text)` takes **two arguments and no uid**. Its body
is `feature_enabled('administrativo') ∧ is_active(auth.uid()) ∧ is_member_of(p_commission_id) ∧
∃ capability row WHERE c.user_id = auth.uid()` — and `app.is_member_of` is itself `auth.uid()`-bound.
It answers **about the caller**, and cannot be asked about a passed principal.

`app._case_caps(p_case_id, p_uid)` is a **`(case, uid)` resolver**. Every other helper it uses has a
`_for` twin for exactly this reason — `is_member_of_for`, `is_staff_admin_of_for`,
`is_tenancy_admin_of_for`, `is_quality_reviewer_of_for` all exist. **`member_can_for` does not.** That
gap is the whole finding.

### A6.2 — Why using `member_can` as written would have been a defect, not a shortcut

- **Cross-uid callers would get the caller's answer.** A property sweep of `can_read_case` call sites
  passing a uid other than `auth.uid()` returns **14**, including `public.file_correction_request`
  (which asks whether a *nominated corrector* may reach the case), `app.can_read_case_committee`,
  `app.can_read_document` and `app._audit_access_authorized`. An S8 keyed on `auth.uid()` inside a
  `p_uid` resolver answers the wrong question at every one of them.
- **It would re-open the collision Amendment 4 exists to close, through a different door.** With the
  caller's `member_can` true and `p_uid` a different, non-member principal, S8 sets `read_case_content`
  for someone S5 will not give `read_case_deliberation` to — `app.is_oversight_only_reader`'s exact bit
  shape. ⛔ And **no ARM can see it**: it is a uid-source mismatch inside a DEFINER body, not a missing
  gate.
- **The P1 keystone could not have been written honestly.** pgTAP asserts reach in owner context, where
  `auth.uid()` is NULL; S8 would be silently dark and P1 red for the wrong reason. Wrapping every
  assertion in `claims_for()` would have hidden the defect rather than fixed it.

### A6.3 — The ruling: one implementation, not two

`app.member_can_for(p_commission_id, p_capability, p_user_id)` becomes the **single** implementation of
the predicate, and **`app.member_can` delegates to it**. S8 calls `member_can_for`. The four conjuncts,
the flag row, and the `enabled` column are unchanged, so the kill switch still short-circuits the arm
before any membership or capability probe.

**The rejected alternative, and why** — adding `member_can_for` *beside* an untouched `member_can`
(cheaper, zero regression surface on the 12 existing consumers) would leave **two hand-copies of an
authorization predicate whose first term is the kill switch**. That is the shape
this repo pays for most often, and it is the same shape the M1 migration had just closed for the
capability vocabulary. A drift *detector* is worth less than removing the possibility of drift.

⛔ **The cost argument against delegating was checked and did not survive.** It was that `member_can`
is `LANGUAGE sql STABLE` and therefore inlinable into the three `meetings_staff_admin_*` policies, so
a nesting level would cost the init-plan hoist. **Measured with a four-arm probe** (`EXPLAIN (VERBOSE,
COSTS OFF)`, inlining visible as the body decomposed into the plan vs an opaque `Filter: fn(...)`):
plain → **INLINED**; `SET search_path` only → not inlined; `SECURITY DEFINER` only → not inlined; both
(= `member_can`'s shape) → **not inlined**. The plain arm is the positive control and it flips, so
"not inlined" is a finding rather than a blind detector. ⇒ **there was no hoist to lose.** The three
consumers are also **write-path** policies (INSERT/UPDATE/DELETE on `meetings`), not a hot SELECT scan.

⚠ **Mechanism corrected, in the direction of less certainty:** the lead's stated reason was
"`SECURITY DEFINER`, which Postgres never inlines". That is *a* sufficient blocker — but the probe shows
`SET search_path` **alone** blocks inlining too, and `member_can` carries **both**. So `prosecdef` is not
demonstrably *the* operative cause here. The conclusion is measured; the single-cause explanation was
inferred, and an inferred mechanism reported as a measured one is the error this ADR keeps catching.
⭐ The first probe run was invalid in exactly that way — it carried `SET search_path` on *both* arms, so
neither flipped and the whole effect would have been attributed to `prosecdef`. **Two probes sharing a
blind spot agreeing is worth nothing.**

### A6.4 — Binding conditions (the migration may not be written without these)

1. **`member_can_for`'s ACL is derived from the catalog by property** — matching what
   `app.is_member_of_for` actually holds. ⚠ A NULL `proacl` is the permissive default, not a lock.
2. ⛔ **The obvious drift pin is VACUOUS under this ruling and must not be counted as coverage.**
   `member_can(c,cap) = member_can_for(c,cap,auth.uid())` is true **by construction** once one delegates
   to the other, and a property guaranteed structurally cannot be pinned by asserting it. What is pinned
   instead: (i) **one behavioural pin per conjunct** on `member_can_for`, each proven able to fail by
   neutralizing that conjunct alone; and (ii) a **catalog** assertion that `member_can`'s body delegates
   — that it carries no second copy of the conjunct list — in the shape
   `314_qob_org_admin_content_wall.sql` already uses. That one can fail.
3. **Regression evidence names the 12 consumers** (9 routines + the 3 `meetings_staff_admin_*` policies)
   and states explicitly whether any suite exercises the **meetings write path**. "The suite is green" is
   not the same claim.
4. **`ARM=census` is run on `member_can_for`.** A brand-new gate is in no BLIND set, so `ARM=policy`
   passes it **vacuously** (ADR 0079 Amdt 3).

### Consequences

- **Amendment 4 §A4.2's derivation gets stronger, not weaker.** `member_can_for`'s membership conjunct
  **is literally** `app.is_member_of_for(v_commission, p_uid)` — the same call that assigns `v_member`
  in `_case_caps`. So "an S8 appointee is necessarily also an S5 member on an ordinary case, therefore
  not `is_oversight_only_reader`" holds **by construction** rather than by argument. P10 must say which
  of those two it is; only one survives a refactor.
- The `_for` family gains its fifth member, closing an asymmetry that had no reason behind it — every
  other membership/role helper in `app` already had one.
- ⛔ **Correction, 2026-08-22, from the build's own mutation runs: this predicate has THREE independent
  terms, not four.** The four-conjunct phrasing in the ruling above, in Amendment 2's **M8** row, and in
  the TS mirror's docblock all over-count: `app.is_member_of_for(c,u)` is `is_active(u) ∧
  has_role_any('commission',c,u)`, so `member_can_for`'s explicit `is_active(p_user_id)` is **implied by
  its own third term** — deleting that term alone leaves 71/71 green. The term was **kept** (it holds the
  two bodies term-for-term comparable with the pre-amendment predicate) and the pin was **re-labelled**
  rather than left claiming a conjunct it does not isolate. ⚠ The reusable consequence: **a sweep that
  checks `is_active` is PRESENT would pass on a body where it had been deleted.**
- ⭐ Recorded for whoever writes the next arm: **the plan and the ADR both named this mechanism, and
  both were wrong** — the error survived a design session, a ratification, four amendments and a written
  implementation plan, because naming a real function that does a similar thing reads exactly like having
  checked. It was caught by reading the signature at build time.
