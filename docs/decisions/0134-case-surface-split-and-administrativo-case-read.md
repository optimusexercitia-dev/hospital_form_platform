# ADR 0134 — The case split is read vs manage: one management surface, and administrativo can read the commission's cases

**Status:** **Accepted — design PO-ratified 2026-08-21** (design/grilling session; this ADR is
the record of that approval and of its scope — see D11) · **NOT built** — implementation plan:
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
