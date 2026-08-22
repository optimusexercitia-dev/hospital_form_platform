# ADR 0033 — Case Access Control (per-case read/write grants, attribution-driven access & "Meus Casos")

**Status:** Proposed (pending human approval of the increment plan) · **Date:** 2026-06-19
· **Feature:** Case Access Control — an additive, feature-flagged increment extending the
Cases feature (Phases 7/12; Case Narratives ADR [0032](./0032-case-narratives.md)).
Supersedes nothing; tightens the Cases RLS surface established in ADR
[0017](./0017-multi-phase-cases.md).

## Context

Today a **Case** (a multi-phase committee evaluation) is visible *in full* only to the
**coordinator** (`staff_admin`): the detail route `/c/[slug]/manage/cases/[caseId]` 404s for
plain staff, and the `get_case_detail` / `list_cases_board` DEFINER reads are
`is_staff_admin_of`-gated. A staff member's only relationship to a case is the single phase
they were assigned (`case_phases.assigned_to`), surfaced as cards in **"Minhas fases"**; they
fill it through the wizard and never see the rest of the case. **Narratives** (ADR 0032) have
**no assignee** at all — any coordinator authors them inline.

The stakeholder wants attribution to carry **context**: whoever is given work on a case should
be able to *see the whole case* to understand its standing, and a coordinator should be able to
hand out access deliberately. Four requirements: (1) a phase assignee can view the case in full;
(2) any phase/narrative attribution auto-grants full read, with write scoped to the attributed
item; (3) staff get **"Meus Casos"** (cases, not phases) with a full-case read view *or* a jump
to their item; (4) the coordinator can grant read and/or write to any commission member even
without attribution.

The load-bearing constraint this collides with is the **Phase-7 invariant**: cross-member answer
visibility is **submitted-only** (`app.case_phase_answer_map`), and no one — not even a
coordinator — sees another member's *in-progress* draft. The closest existing precedents are the
patient-safety **access-follows-custody** predicate `app.can_read_event` (ADR 0030) and the
interviews participant-write predicate `app.can_write_interview` (ADR 0026); we mirror both.

## Decision

1. **Two uid-pure DEFINER predicates are the spine; phase-fill stays identity-bound.**
   `app.can_read_case(case, uid)` = `staff_admin`/admin of the commission **OR** a `case_access`
   row (read|write) **OR** the assignee of any phase **OR** the assignee of any narrative in the
   case. `app.can_write_case_content(case, uid)` = `staff_admin`/admin **OR** a `case_access`
   row at level `write`. **Phase filling is unchanged** — `case_phases.assigned_to = uid` is the
   sole authority (`HC022`, one-response-per-phase); a case-write grant does **not** let anyone
   fill another member's phase. All **lifecycle and assignment** (activate / skip / reassign /
   close / cancel / add-ad-hoc / grant / assign-narrative) stays `staff_admin`/admin only.

2. **Restrictive boundary.** Base `SELECT` on `cases`, `case_phases`, `case_narratives` and the
   case child tables (`case_action_items`, `case_documents`, `case_events`, `case_tags` +
   assignments, `case_interviews`*, `case_offered_outcomes`) tightens from `is_member_of` →
   `app.can_read_case`. A member with no attribution and no grant cannot see the case at all
   (route + RLS, not UI hiding). *(Interviews keep their own `commission_of_interview` member-read
   for now; case-scoping them is a follow-up — see Consequences.)*

3. **Read depth = coordinator-grade, submitted-only.** A read-grantee sees exactly what the
   coordinator sees — all **submitted** phase answers, all authored narrative bodies, plus
   timeline / documents / tags / action-items / interviews / outcomes — and **never** anyone's
   in-progress draft. `get_case_detail`'s gate broadens `is_staff_admin_of` → `can_read_case`;
   its answer projection stays **submitted-only**, so the Phase-7 invariant is untouched.

4. **Write = case-wide "collaborator", with item-scoped exceptions.** A `write` grant lets a
   member author **un-attributed** narratives and manage non-identity-bound case content (action
   items, documents, tags, events) — like a content co-coordinator — but **not** run lifecycle and
   **not** fill phases. **Narrative ownership is respected (Q14):** narrative write =
   coordinator/admin **OR** the narrative's `assigned_to` **OR** (`can_write_case_content` **AND**
   `assigned_to IS NULL`). An attributed narrative is reserved to its assignee.

5. **Narratives gain a single assignee and a minimal lifecycle.** `case_narratives` gets
   `assigned_to` (FK `profiles`, nullable — single assignee, mirroring phases) plus a status
   `aberta → concluida` (`concluded_at` / `concluded_by`). The assignee fills `body_md` and
   "Conclui" it (freezes the body); the coordinator can reopen. No activation/blocker gate —
   narratives are assignable and fillable anytime while the case is non-terminal. The existing
   case-terminal freeze (`app.guard_case_narrative_frozen`) still applies on top.

6. **A per-case ACL table, with attribution-derived read computed (not stored).**
   `public.case_access (case_id, user_id, level ∈ {read,write}, granted_by, granted_at,
   unique(case_id,user_id))`; `write` implies `read`. Writes go through DEFINER RPCs only
   (`grant_case_access` / `revoke_case_access`), `staff_admin`/admin-gated, target must be a
   current commission member (`HC021`). Read that flows from *attribution* is **computed** inside
   `can_read_case`, never materialized — so reassigning/unassigning a phase or narrative moves the
   read automatically, and an assignee's full-case read can't be revoked without unassigning them
   (attribution always implies full read).

7. **"Meus Casos" is a unified list; one capability-gated detail page.** "Minhas fases" is
   replaced by **"Meus Casos"** — every case the member can access (attributed *or* granted),
   one per card, with the member's attributed items listed inline (direct
   Preencher/Abrir/Concluir actions) plus a "Ver caso completo" button. The full-case view is the
   **same component** as the coordinator's detail page, driven by a capability set
   (`canManageLifecycle` / `canWriteContent` / `canRead`) — generalizing the interviews
   `viewerCanWrite` pattern — mounted at a staff route and at `/manage/...`. The assignee's
   "go directly to the narrative" target is a focused editor page; inline narrative editing
   remains on the detail page for coordinators/write-grantees.

8. **Case opens are audited; access is strictly PHI-free.** A `case.opened` access event is added
   to the `log_audit_access` allow-list (Rule 11) and emitted when a non-coordinator opens a full
   case detail (mirroring `response.opened_foreign` / `event_patient.read`). Case access **never**
   widens PHI access (Rule 12 / ADR 0030): `can_read_event` is untouched, linked safety events
   appear only as the existing PHI-free projection, and click-through stays custody-gated.

9. **Feature-flagged with a permissive fallback.** A new `case_access` flag gates the new RPC
   surface and the grant UI; crucially, while the flag is **OFF**, `can_read_case` falls back to
   `is_member_of` (today's behavior) so the restrictive boundary does not bite until the feature
   ships. Flipped **ON** in-increment (the established pattern). New SQLSTATEs continue from
   `HC055` (HC054 is Case Narratives).

## Alternatives rejected

- **Additive view-filter (leave base member-read intact).** Rejected — it isn't a real boundary;
  any direct read path still leaks case rows to all members. The stakeholder asked for *adjustable*
  access, which only the restrictive model delivers.
- **Full case-wide write including phase-fill** (generalize fill auth to "assignee OR
  case-writer"). Rejected — it tears up the one-assignee/one-response identity model and weakens
  audit accountability for who authored a phase's answers.
- **Materializing attribution-derived read as `case_access` rows.** Rejected — it creates a
  sync burden (every assign/reassign/unassign would have to insert/delete grant rows) and an
  ambiguity between "granted" and "derived" read. Computing it in the predicate is single-sourced.
- **Multiple assignees per narrative** (a join table). Rejected — co-authoring is already covered
  by the case-write grant; attribution stays singular = "whose to-do is this."
- **Cross-commission grants.** Rejected for v1 — `can_read_case` could no longer assume membership
  and it loosens the boundary every RLS policy rests on. Deferred to a separate feature.
- **A separate read-only staff case page.** Rejected — the write-grantee case isn't read-only, so
  a copy would have to duplicate the collaborator editors too and would drift; one capability-gated
  page is DRY.
- **Pre-assigning pending phases (decouple `assigned_to` from status).** Rejected for v1 — the
  explicit read grant already covers "let someone prepare before their phase is live," so the
  tested phase state-machine stays untouched and there's no "assigned-but-not-fillable" state.

## Consequences

- **RLS-shape change with ripples.** Tightening base case reads means every place that currently
  shows case data to *all* members must tolerate `can_read_case` — notably `meeting_cases` linkage
  labels and any member-facing case reference. Each read path is audited during the build; a pgTAP
  truth-table for `can_read_case` / `can_write_case_content` guards the predicate.
- **`get_case_detail` and the narrative RPCs are `CREATE OR REPLACE`d** on their current bodies
  (ADR 0032 finals), adding the capability descriptor + narrative `assigned_to`/`status` and the
  broadened gate, while preserving the submitted-only answer projection.
- **Interviews stay member-read for now.** Case-scoping `case_interviews` to `can_read_case` is
  noted as a fast-follow so the restrictive boundary is complete; v1 keeps the existing
  `commission_of_interview` member-read to bound blast radius.
- **DB reset** (pre-production) reseeds personas with attributed + granted example cases so the
  E2E suite can exercise every access path.
- **Coordinators are unaffected** (they pass both predicates) and additionally gain their own
  "Meus Casos" for cases where they are personally attributed, alongside the management board.

## Amendment 1 — the Q3 boundary gains an administrativo read arm; the write-grant SURFACE moves

**2026-08-21 design PO-ratified · ⚙ BUILT LOCALLY 2026-08-22** on `feat/case-surface-split-2` (ADR
[0134](./0134-case-surface-split-and-administrativo-case-read.md) Increment 2) — **NOT merged, NOT
pushed**, QA **CHANGES REQUESTED** at the time of writing. ⚠ *This stub said "NOT yet built" for the
whole day the arm was being built; it is an explicit obligation of 0134 and its twin in ADR 0061 was
opened while this one was not.* ⛔ **Two clauses below are amended by measurement — read the corrections
underneath, not only the ratified text.**

> **Correction 1 — the read arm is BOUNDED.** The amendment below describes administrativos joining the
> always-pass-for-read set without qualification. Measured and ruled since (0134 **Amendment 4**): the S8
> arm carries `not v_eg`, so a case whose access policy is **`explicit_grants_only` is invisible to it**.
> On such a case the appointee reaches it the way any other non-granted reader does — through an explicit
> S3 grant, or not at all. Q3's boundary therefore gains a **bounded** class, not an unconditional one.
>
> **Correction 2 — the capability is granted by the APPOINTMENT.** 0134 **Amendment 5** rules that
> `appoint_administrativo` grants `read_cases` on a new appointment; existing appointees are **not**
> backfilled. So the class Q3 gains is "appointed administrativo holding `read_cases`", and that holding
> is the default for appointments made from this migration onward.

> Two decisions of this ADR are amended by 0134; neither is reversed in spirit:
>
> - **Q3's restrictive boundary** ("no attribution + no grant ⇒ cannot see the case;
>   coordinators/admins always pass") **adds one class to the always-pass-for-read set**: an
>   administrativo (ADR 0061) appointed with the new `read_cases` capability, via a new
>   `app._case_caps` arm conferring `read_case_content` only. Content write stays grant-gated
>   exactly as Q2 decided — 0134 D6/D7.
> - **Q7's "both routes mount the capability-gated view"** was already narrowed by `8675b7cd`
>   (2026-08-19, `/casos` as a reading surface); 0134 D1–D3 completes that narrowing: the
>   write grant's *semantics* are unchanged, but its *surface* is `/manage/cases/[caseId]`
>   (entry: `staff_admin ∨ isAdministrativo ∨ canWriteContent`), and `/casos` keeps only
>   name-attributed writes (Q14's assignee checks are untouched).
