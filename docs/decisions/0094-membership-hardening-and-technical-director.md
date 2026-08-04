# ADR 0094 — Membership-model hardening + Diretor Técnico (technical director) backend

**Status:** Proposed (awaiting human approval; no phase started) · **Date:** 2026-08-04
**Inputs:** external membership audit
([handoff](../design/temp/membership-model-audit-handoff.md)), catalog-verified internal
analysis ([response](../design/temp/membership-model-internal-analysis.md)), PO feature
decisions of 2026-08-04 (recorded below). Plan:
[docs/plans/membership-hardening-technical-director.md](../plans/membership-hardening-technical-director.md).
Complements ADR 0075 (write-path split), 0078/0079 (authz lessons), 0037 (referrals PHI).

## Context

The external audit affirmed the single `public.memberships` table and flagged four gaps
(expiry parity, commission-role cardinality, service-role write bypasses, trigger-only
integrity). The internal analysis verified all four against the live catalog, sharpened
two (the dual-role state is UI-reachable via `addStaff`; `grant_role` has zero TS
callers — every commission-tier grant is raw service-role DML), and found the audit's
cardinality fix incomplete (the new unique index would raise unhandled `23505` out of
`grant_role` and three UI actions). Separately, the PO specified a new legally-mandated
role: every Brazilian hospital has a **Diretor Técnico** — an elected physician,
technically responsible for all hospital committees — who must be able to receive a
committee's `Case` for analysis, without gaining standing access to committee or QPS
content. Backend only; no frontend in this program.

## Decisions

**Membership hardening (adopting the internal analysis §4):**

1. **Retain the single `memberships` table** (reaffirms MEM/ADR 0075). No four-table
   split, no generic `scope_id`, no partitioning at current scale.
2. **Package A — invariants, with the full writer sweep**: partial unique index
   `(principal_id, commission_id) WHERE commission_id IS NOT NULL`; a defined
   role-replacement semantic implemented in `grant_role` (no unhandled `23505` can
   reach a caller) and adopted by every commission-tier writer (`addStaff`,
   `assignStaffAdmin`, `registerUser`, `assignCommitteeRole`); composite FKs replace the
   hospital↔org and title↔commission trigger guards (triggers retired same migration);
   index on `granted_by`; catalog-driven pgTAP with revert-the-fix mutation checks.
3. **One session authority snapshot**: a DEFINER RPC `app.session_context()` returns the
   caller's effective grants (expiry- and `is_active`-filtered) in one read;
   `getSessionContext` consumes it. Effective-grant semantics live in SQL once.
4. **One real mutation door (Package B)**: the door body refactors to an internal
   `(p_actor, …)` kernel; the existing `grant_role`/`revoke_role` become
   `auth.uid()` wrappers; a **service-only** `grant_role_for`/`revoke_role_for`
   (EXECUTE revoked from `authenticated`) serves actor-less provisioning paths.
   End state: application code performs **no raw `memberships` DML**, enforced by a
   repo grep gate in addition to review.
5. **Expiry defused, not built**: `expires_at` stays; `session_context()` filters it
   from day one; `trg_audit_memberships` gains an `expires_at`-change audit arm; a
   pgTAP invariant pins "no supported door sets expiry". Full expiry semantics
   (audit's Package C) only when a product feature commits to it.
6. **Extensibility posture**: role-addition checklist recorded in
   `docs/backend-state.md`, backed by a completeness pgTAP grid over the role
   vocabulary; fine-grained permissions extend the administrativo capability plane,
   never the role enum; `platform_role_grants` deferred until a second real vendor
   role exists (and must then re-decide the JWT-claim revocation residual, ADR 0009).

**Diretor Técnico (PO decisions 2026-08-04):**

7. **Two new hospital-scope roles** in `memberships`: `technical_director` (titular)
   and `technical_director_deputy` (substituto) — English keys (Rule 10; the D11
   anglicization lesson), pt-BR labels at the UI layer later. Scope shape = the
   hospital tier (`organization_id` + `hospital_id` set, `commission_id` NULL).
   **Exactly one titular per hospital**, DB-enforced by a partial unique index
   (`(hospital_id) WHERE role = 'technical_director'`); deputies unbounded.
8. **Appointment**: granted through the door by an `org_admin` of the hospital's org
   OR a `hospital_admin` of that hospital. The grant arm **enforces the physician
   requirement**: the target's `profiles.professional_category_id` must resolve to
   `professional_categories.key = 'physician'` (dedicated error code otherwise).
   Appointing a titular where one exists is refused by `grant_role`; a wrapper RPC
   `appoint_technical_director` performs the atomic audited replacement
   (revoke incumbent + grant appointee in one transaction).
9. **Case analysis via the referral plane** (not standing access, not a new module):
   `case_referral` gains a second target type — `target_type`
   (`'commission' | 'technical_director'`) + `target_hospital_id`;
   `target_commission_id` becomes nullable under an exactly-one-target CHECK. A DT
   submission must target the **source commission's own hospital** (enforced in the
   door; `commissions.hospital_id` is NOT NULL, so it always resolves). The DT
   audience (titular + deputies of the target hospital) inherits the target-side
   referral machinery: receive, reply, dialogue, resolution — the reply row records
   the acting individual.
10. **PHI included, audited**: a DT submission may carry the patient exactly as
    inter-committee referrals do — the isolated `referral_patient` module
    (Rule 12), read through the existing audited predicates with a DT arm added to
    `app.can_read_referral_phi` (and target-side siblings). No change to the case-PHI
    (`patient_identifiers`) door's audience; disposal flow unchanged.
11. **Feature-flagged, backend-only**: everything lands behind a `technical_director`
    flag (with an explicit enable decision at ship time — the dark-flag lesson);
    no frontend surfaces in this program; existing referral E2E must stay green.

## Consequences

- The DT feature becomes the **first consumer of the extensibility posture** (decision
  6): its two roles exercise the checklist, the completeness grid, and the Package A
  replacement semantic. Sequencing therefore matters — hardening first, DT last.
- Extending the referral target type touches every target-side authority function.
  The enumeration is **derived from the catalog** (`prosrc` referencing
  `target_commission_id` — 21 functions, 0 policies at analysis time), never from a
  hand-maintained list (ADR 0079).
- `grant_role`'s arms grow (2 roles × grant/revoke + physician check + titular
  replacement refusal). This is accepted: the whole point of the single kernel is that
  such rules are written once and inherited by the wrappers and (post-Package B) the
  service path.
- Program placement relative to Phase 16 and the pilot deploy is the human's call;
  the plan recommends Package A pre-pilot and the rest as one gated post-pilot phase
  sequence.

## Amendment 1 — the four open items, closed (PO, 2026-08-04)

1. **Placement/scope:** build **W1 → W4 straight through** on
   `feat/membership-hardening-technical-director`, reporting once at the end.
2. **T1.0 replacement semantic:** **atomic replace** (not refusal, not
   replace-only-when-widening).
3. **`platform_admin` may NOT appoint a Diretor Técnico.** Appointment is a tenant
   governance act with legal weight; it stays with `org_admin` of the hospital's org
   or `hospital_admin` of that hospital. pgTAP asserts platform_admin is refused.
4. **The `technical_director` flag ships ENABLED** — W4 includes the enable migration.

## Amendment 2 — build-time corrections to decision 2 (W1, verified against the catalog)

The plan's W1 section is not authoritative on the substrate (its own header says so).
Four of its prescriptions were wrong against the live catalog and were corrected in
build; each is pinned by a pgTAP keystone that is mutation-proven to go red.

- **T1.0 is an in-place `UPDATE`, not "delete old + insert new".** The plan asked for
  delete+insert *"so the audit stream shows `role_changed` semantics"*, but those two
  clauses contradict each other: `app.trg_audit_memberships` emits
  `membership.role_changed` only on its **UPDATE** arm — a delete+insert fires the
  DELETE and INSERT arms and emits `membership.revoked` + `membership.granted`. The
  UPDATE additionally preserves the membership's row **identity** (audit `entity_id`)
  and the member's per-commission **title**, both of which delete+insert destroys.
  Keystones 4.4–4.7 in `291`; the `naive_delete_insert` mutation proves they can tell
  the two implementations apart.
- **The replacement semantic requires authority over the OUTGOING role.** Not in the
  plan. `grant_role`'s `staff` arm admits a plain `is_staff_admin_of`; with naive
  replacement, a plain staff_admin could DEMOTE a peer staff_admin — a destructive
  write on a role the `staff_admin` arm deliberately excludes. Replacing a
  `staff_admin` row therefore requires `is_admin() OR is_commission_admin_of`, making
  the role-pin symmetric in both directions.
- **The composite FKs REPLACE the single-column FKs; they do not join them.** A second
  FK to an already-reachable target is the PGRST201 ambiguous-embed shape, and
  `session.ts`, `members.ts` and `meetings.ts` all carry un-hinted embeds today —
  `session.ts` is the session bootstrap, so an ambiguity there fails every page for
  hospital-tier principals. `186_member_titles.sql` §4a already pinned "exactly one FK
  backs the members→titles embed". The new constraints reuse the OLD NAMES so the one
  FK-hinted embed (`org.ts`) keeps resolving. Verified empirically: PostgREST embeds
  resolve over composite FKs, with non-null controls.
- **The title FK needs `on delete set null (title_id)` — the column list is
  mandatory.** A bare composite `SET NULL` nulls `commission_id` as well, which
  `memberships_scope_shape` then rejects, making commission titles **undeletable**.
  Found by probe before the migration was written; keystones 1.4 / 3.5 / 3.6.
- **The shape CHECKs stay and are now load-bearing.** A composite FK defaults to MATCH
  SIMPLE, so `(hospital_id set, organization_id NULL)` would bypass it; only
  `memberships_scope_shape` makes that unreachable. MATCH FULL is not an option —
  org-tier rows are legitimately mixed-NULL and MATCH FULL rejects them outright.

**Consequence for the test suite.** The invariant made five pgTAP fixtures illegal:
they promoted a bootstrap `staff` to `staff_admin` by inserting a SECOND row. Three
used an **untargeted `on conflict do nothing`**, which silently absorbed the new
index's 23505 and left the principal unauthorized — ~23 keystones in `229`/`233`/`236`
then denied with `HC0E4` (want of authority) instead of the exclusion code under test,
passing while asserting nothing. All five now promote via an explicitly targeted
upsert. The two sites with no `on conflict` clause failed loudly and were the safer
shape.

## Amendment 3 — W4 build state (2026-08-04)

W4 is **partially built**. What landed (migration `20260905000400`, pgTAP `294`,
`w4-technical-director-mutation-audit.sh` 8/8 RED-PROVEN):

- **T4.1** both roles admitted to `memberships_role_check`, both given hospital-tier
  arms in `memberships_scope_shape` (which keeps its `else false` terminator), and
  `memberships_one_technical_director_uq` enforcing exactly one titular per hospital.
- **T4.2** kernel arms in `app.grant_role_impl` / `app.revoke_role_impl`: authority =
  org_admin of the hospital's org OR hospital_admin of that hospital — **and no
  `is_admin_for` branch**, per decision 3 of Amendment 1. This makes the DT arm the
  only grant arm in the kernel without one; the asymmetry is deliberate and pgTAP
  asserts it so a future "consistency" edit cannot quietly restore it. Physician
  requirement resolved on `professional_categories.key = 'physician'` **and
  `is_active`**; titular-already-exists refused with `HC0G4`; self-grant inherited.
- **T4.3** `public.appoint_technical_director(p_hospital, p_user)` — atomic audited
  replacement. It re-checks nothing: authority, the flag and the physician rule are
  the kernel's, and a second copy would be a second thing to keep in sync.
- Revoke deliberately carries **no** flag check and **no** physician check: turning the
  feature off, or correcting a professional category, must never strand an existing
  appointment beyond the administrators who granted it.

**The `technical_director` flag ships DARK in this migration** — the enable migration
(T4.9, PO decision 4 of Amendment 1: ships enabled) is the LAST step of W4 and has NOT
landed. Nothing is half-live: the grant arms refuse while the flag is off, so the roles
cannot be handed out before the feature they exist for is complete.

**Not built:** T4.4 (server actions), T4.5–T4.8 (the referral-plane submission channel:
`case_referral.target_type` / `target_hospital_id`, the target-audience arms, the
submission door, the PHI arm), T4.9 (the enable migration), T4.10 (seed personas),
T4.11–T4.13 (their tests). The T4.6 enumeration was re-derived from the live catalog and
**matches the analysis exactly — 21 functions referencing `target_commission_id`, 0
policies** — so the next session starts from a verified set rather than a hand-list.

**Two checks the build proved are load-bearing** (both caught by mutation, neither by
review):
1. The kernel's guards MASK each other in order — flag, then authority, then physician,
   then titular-uniqueness, then self-grant. A deny-code assertion has to name the guard
   it means, or it measures whichever fires first.
2. The physician check's `is_active` clause was untestable against a principal with NO
   category: the join fails on the missing row and raises `HC0G3` regardless, so the
   keystone passed while asserting nothing. Give the fixture a real physician category
   first, then retire it.

## Amendment 4 — the DT referral plane, settled by interview (PO, 2026-08-04)

Decisions 9–10 named the referral plane as the submission channel but left its shape
open. Nine questions were put to the PO; the answers below are binding. Full rationale
and the task breakdown are in the plan's W4 section.

- **D1 — Titular ≡ deputy.** Flat authority over the whole target side. One DT arm in
  `app.can_manage_referral_target`, not two tiers. A *substituto* that cannot decide is
  decorative, and a referral would stall whenever the titular is away; `received_by` /
  `decided_by` keep accountability per-person.
- **D2 — The DT inherits the FULL target lifecycle**, decline included.
  `conflict_of_interest` and `insufficient_information` are precisely why a DT must be
  able to refuse, even though the jurisdiction-flavoured reasons are meaningless
  same-hospital.
- **D3 — `referral_messages.sender_commission_id` becomes nullable; NULL means "the DT
  of the referral's target hospital".** No `sender_hospital_id`, no `sender_side` —
  both would store derivable data twice. Coherence is enforced in the existing
  `app.guard_referral_message` trigger, because a CHECK cannot read `case_referral`.
- **D4 — The audience is the OFFICE, resolved live.** Replacing a DT immediately
  transfers the referral and its PHI to the incoming holder and removes both from the
  outgoing one. No person-snapshot (it would leave a standing PHI grant with someone no
  longer responsible) and no grace window (it would re-introduce the expiry semantics
  W2 deliberately defused).
- **D5 — Snapshot `target_hospital_name`**, rendered `Direção Técnica — <hospital>`.
  Not `target_commission_name` (the column name would lie) and not the DT's personal
  name (that copies Class-2 professional identity outside `professional_profiles` and
  contradicts D4).
- **D6 — No DT disposal arm.** `can_dispose_referral_phi` already resolves for DT rows
  through the source commission-admin and the source-hospital PQS operator — which the
  same-hospital rule makes the DT's own hospital. Granting the recipient the power to
  destroy the requester's record is the shape ADR 0078/M2 removed.
- **D7 — `target_type` is KEPT** exactly as decision 9 specifies. A CHECK must pin it in
  agreement with which target id is non-null.
- **D8 — No DT internal notes.** Both note predicates take an explicit
  *commission-target-only, DT n/a* disposition. Internal notes exist for multi-member
  committee deliberation; the DT audience is one office that answers directly.
- **D9 — Add `waiting_on_hospital_id`.** Without it, `provide_referral_information`
  writes NULL for a DT row and the existing CHECK permits it, so "the technical director
  is holding this" silently reads as "nobody is waiting" — a fail-open state on a
  clinical referral.

**Three catalog findings that change the shape of the remaining work** (they belong here
because they invalidate a Consequence recorded above):

1. The Consequence *"extending the referral target type touches every target-side
   authority function"* is **true but misleading about cost**. The whole target-side
   lifecycle funnels through `app.assert_referral_target_acts` →
   `app.can_manage_referral_target`, so ONE arm carries receive/accept/decline/review/
   conclude. The 21 functions collapse to a handful of edits plus explicit dispositions.
2. ⚠ **Three RPCs bypass that predicate with a raw inline
   `is_staff_admin_of(<ref>.target_commission_id)`** — `get_referral_detail`,
   `post_referral_message`, `request_referral_information`. They inherit nothing and must
   be found by a `prosrc` sweep, not by reading the lifecycle.
3. **A DT referral can never have a target case** (`cases.commission_id` is NOT NULL and
   a DT has no commission), so `app.referral_target_analyst` — which requires
   `target_case_id` — can never fire for a DT row. The DT read path is a NEW arm, and
   `link_referral_case` / `link_referral_related_case` / `assign_referral_reviewer` are
   structurally n/a.
