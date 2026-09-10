# ADR 0205 — The per-object grant plane convention: root ledgers, computed participation, catalog-named abilities — decided now, built after AE5

**Status:** accepted 2026-09-10 (PO, in a grilling session over the live catalog; every Decision below is a PO ruling, attributed inline where it reversed the lead's recommendation)
**Date:** 2026-09-10
**Area:** authorization / per-user per-object grants (`case_access_grants` and the ledgers its future siblings will need) / the seam between the domain adapters and the `authz` permission layer
**Amends:** ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (D7 — its clause *"`case_access_grants` … stay where they are, adapted to the shared vocabulary"* is given its content: **this convention is the adaptation**, D4 below; nothing else in D7 moves) · ADR [0078](./0078-authorization-capability-model.md) (three points: the B6 org-admin door arm's justification gains a second case, the **absent** coordinator, D6·3; the two PHI parameters of `grant_case_access` are ruled **unreachable from the screen**, D10; and the grant **door** gains a terminal-status refusal for write grants, D9 — ⛔ the resolver is untouched, A24·3's *"no lifecycle step in `_case_caps`"* stands) · ADR [0033](./0033-case-access-control.md) (D6 — its rejection of cross-commission grants survives as this ADR's D6 default; its "write grants are not allowed on a terminal case" rule moves from the screen into the DOOR, D9; its computed-attribution rule is generalized as D3)
**Related:** [0050](./0050-action-items-fold-visibility-scope-case-access-expiry.md) / [0102](./0102-extend-on-regrant-expiry-seam.md) / [0103](./0103-case-access-null-expiry-is-permanent.md) (expiry semantics) · [0061](./0061-administrativo-delegated-role.md) / [0130](./0130-dsr-subject-request-workflow.md) (the two scope-level capability planes this convention explicitly does NOT govern, D11) · [0114](./0114-document-model-redesign.md) (D6 + D16 — the document access plane lands at Phase 19 and now starts from this convention) · [0176](./0176-authz-permission-layer-made-real.md) (D8 — nothing here is picked off inside a role increment) · [0182](./0182-statement-scoped-authorized-scope-ids.md) · [0201](./0201-the-keying-asymmetry-is-the-model.md)
⛔ Supersedes nothing.
⚠ **Numbering:** 0204 is reserved by `docs/plans/pre-ae5-remediation.md` for the `D`-ceiling / `search_path` conventions and 0202 is an unfillable hole; this ADR takes 0205 as that plan instructs.
**Amended (2026-09-10):** § **Amendment 1** below — after an external design audit of this ADR ([docs/reviews/adr-0205-design-qa-review.md](../reviews/adr-0205-design-qa-review.md), verdict *NEEDS REVISION*, five major findings re-derived by the lead on the live catalog, all holding), the PO ruled sub-clauses **D2·2, D4·2, D5·2, D6·5, D7·2, D12·2** in a second grilling session (two rounds, 16 questions). Each amended D carries a ⚠ marker; the 2026-09-10 rulings D1–D12 are unchanged in text except the two editorial corrections the amendment names. Unit: `GRANT-PLANE-CONVENTION-A1`.

---

## Context — measured on the live catalog

Container `supabase_db_azkbbhskturikxpgmafq`, migration head `20261003007360`, `main` @ `eb52f1c1`,
2026-09-10. ⛔ No figure below is quoted from migration text (ADR 0078's methodology finding).

**The Case grant plane is three separable things, and only one of them is Case-specific.**

1. **A ledger** — `public.case_access_grants`: surrogate `id`; the single anchor `case_id`
   (⚠ no composite tenant FK — a recorded lead ruling that diverges from ADR 0078 D5·2);
   `principal_id`; `source` CHECK-bound to four values of which only `manual_grant` has a writer;
   a **bare** `source_entity_id uuid` with no FK (a second divergence from D5·2's
   column-per-scope rule, flagged by the migration's own header); five boolean capability
   columns held in a lattice by CHECKs (`write ⇒ read`, `restricted ⇒ standard`, non-empty);
   `max_confidentiality` (7 labels, **no reachable writer**); `reason_code` (3 values) + `reason`;
   `granted_by/at`; `expires_at`; soft revocation `revoked_at/by` with a shape CHECK; active
   partial unique `(case_id, principal_id, source, source_entity_id) NULLS NOT DISTINCT`; two
   active partial indexes. RLS on, one policy (own row, SELECT); ACL `authenticated = r` only —
   **no DML**; trigger `app.trg_audit_case_access` emits `case_access.granted|updated|revoked`
   over a column allow-list with `entity_id = case_id`.
2. **A resolver arm** — source S3 of `app._case_caps`, evaluated after the `is_active` outer
   gate and after the respondent/recusal hard denies; expiry tested at read time, never by a job.
   Consumers: 18 policies through `can_read_case`, 3 through `can_write_case_content`, 16
   through `is_case_excluded`; **seven** functions read the ledger directly outside the resolver
   (`app.can_read_document`, `app.confidentiality_clearance_ok`, `app.referral_target_analyst`,
   `public.get_member_overview`, `public.get_referral_case_access_summary`, `public.list_my_cases`,
   `public.list_case_access`).
3. **A door trio and a screen** — `grant_case_access` / `revoke_case_access` / `list_case_access`
   (DEFINER, `REVOKE ALL FROM PUBLIC` then explicit grants) over the INVOKER kernel
   `app._grant_case_access_unchecked` (also the creator self-grant path of `create_case`);
   authority = `is_staff_admin_of(commission) OR is_tenancy_admin_of(commission)`, then
   `assert_not_case_excluded` (`HC0F1`), then level, then grantee membership (`HC021`), then
   future expiry; `src/lib/case-access/actions.ts` + `src/components/cases/case-access-panel.tsx`.
   27 pgTAP files pin the plane; `e2e/case-access.spec.ts` exercises it end to end.

**The platform has more per-user per-object planes than the Case one, and they share no shape.**

| plane | shape | decides access where | expiry / soft revoke |
| --- | --- | --- | --- |
| `case_access_grants` | boolean per capability | resolver S3 + 7 direct readers | yes / yes |
| `commission_administrativo_capabilities` | enum capability rows, per commission | `member_can_for` → doors, 1 policy, resolver S8 | no / DELETE |
| `hospital_dpos` | administrativo's shape copied "arm for arm", per hospital | `is_dpo_of_for` | no / yes |
| `document_approvals` | a PENDING row grants read | 3 policies + a storage policy | no / by decision |
| `rca_members` · `case_interview_interviewers` | role string; non-observer / any row ⇒ write | `can_write_rca`, `can_write_interview`, 6 policies + a storage policy | no / DELETE |
| `action_item_assignments` (+ `visibility_scope = 'assignees_only'`) | role string | `can_read_action_item` | no / DELETE |
| `meeting_closed_session_item_readers` | bare reader row | DEFINER doors only, zero policies | no / DELETE |
| `capa_action.assignee_user_id` | column | inside DEFINER doors — invisible in `pg_policies` | – |
| `case_phases.assigned_to` · `case_narratives.assigned_to` | column | resolver S4, **computed, never stored** (ADR 0033) | – |
| `referral_assignments` | role string | **grants nothing** by ruling (K-R4-1) | – |

**The next planes are already ordered, each told to copy a different shape.** Phase 18's auditor
rounds are told to *"mirror the interview participant-write shape"*; Phase 19's surveyor grants
were re-scoped by ADR 0114 D16 into *"the general document access plane"* because the platform had
answered *"a non-member needs to see specific things"* **three times, bespoke**, and F-14 — a
load-bearing bug — lived inside one of them; Phase 20's break-glass has its `source` value reserved
on the case ledger with no writer; the handoff's NSP-investigation and referral-disclosure stages
are the other two reserved values. The 2026-08-26 authorization audit (§F2) named the gap: the
case module is *"the best model in the codebase"* and *"this depth is case-specific"*.

**Two facts the round-1 premise got wrong, measured before the ruling.** (a) The org-admin arm on
the grant/revoke doors was **not** built for a commission with no coordinator. ADR 0078 (at
*"The deadlock, and the PO's resolution"*) records the case it was built for: a single-coordinator
commission where that coordinator is the **respondent or recused** on one case, so step 4 of the
resolver strips `manage_case_access` from the only person who holds it. (b) Nothing enforces
coordinator presence: `grant_role_impl` lets only a tenancy admin seat a `staff_admin`, `revoke_role`
carries no last-coordinator guard, and **two seeded commissions** (Ética, Segurança A2) have none.
Also measured: `authorizeCommission` in `src/lib/case-access/actions.ts` returns true for a
`platform_admin` — whom the door **refuses** (42501) and ADR 0078 A35's noun rule bars — and
omits the tenancy-admin arm the door **accepts**; and the two PHI parameters of the door are never
sent by any TypeScript caller.

## Problem

Standardize, centralize, or fold into the permission layer — and when. Four rulings already on
record bound the answer: ADR 0155 D7 (*domain adapters, not a universal interpreter; never query
an arbitrary table from a caller-provided resource type*), ADR 0114 D16 (the document plane is
Phase 19's, both directions), ADR 0176 D8 (AE5-bundle decisions, the administrativo plane among
them, may not be picked off), and the handoff's *"avoid a generic unvalidated polymorphic PHI
ACL"*. Pre-pilot is the only cheap window for a storage hard cut (ADR 0078 D5·1's precedent), while
Phase 19, Phase 20 and AE5 are all post-pilot.

## Decision

**D1 — Goal order.** Drift prevention first; future build cost second; a cross-resource "what does
this person hold" view is a read-only nice-to-have, not a requirement. ⚠ If (b) ever becomes a
requirement, the C-vs-D choice in D12 must be re-opened, because a single management screen is the
one thing that wants one table.

**D2 — Only a ROOT securable gets a ledger; children inherit, with a read-only narrowing.** Roots
today: case, meeting, referral, controlled document. Children: interview, action item, meeting
agenda item, document version. A child never carries its own ledger; whoever holds the root's
ability holds it on the child, subject to the child's own ceilings (the confidentiality clearance on
interviews stays exactly where it is). A person who must see ONE child without the root is written
as a **root grant narrowed to that child** (`limited_to_resource_id`, a typed FK to the child's row),
so the root's exclusion rules — recusal, respondent — stay in force by position. **The narrowing is
read-only** until a real user asks for a write half; interviewers already write through their
participation row (D3). ⚠ **Amended — see Amendment 1, D2·2** (the narrowing's typed mechanism, the registry parent link, the per-root children list, the action-item root).

**D3 — Participation is NEVER mirrored into a ledger.** Interviewer rows, RCA members, meeting
attendees, phase/narrative assignees, action-item assignees are participation records, read directly
by their predicates; no grant row is ever written for them. Consequence, to be stated in the revoke
dialog of every ledger: revoking a grant does not remove access a person holds through
participation — they are removed from the participation instead. (ADR 0033's rejection of
materializing attribution, and the handoff §3.3, generalized.)

**D4 — Abilities are named by the catalog's permission codes.** A new ledger records abilities as
rows named by `authz.permissions.code`, never as table-specific booleans. The case ledger is **not
physically changed**: a projection maps its bits to codes. Four map today — `read_case_content` →
`commission.cases.read`, `write_case_content` → `commission.cases.manage`, `read_standard_phi` →
`commission.cases.phi.read`, `manage_case_access` → `commission.cases.access.manage`; three have no
code (`read_case_deliberation`, `read_restricted_phi`, `view_case_overview`) and are listed as
**domain-only** until their codes are added with the build (D12) — ⛔ never as placeholder manifest
rows now, which is the *"both models shipped, one inert"* state ADR 0176 D1 rejected. This is what
ADR 0155 D7's *"adapted to the shared vocabulary"* means. ⚠ **Amended — D4·2** (one grant = a header + ability child rows; the ability catalog).

**D5 — Seven mandatory columns on every ledger** (⚠ the 2026-09-10 text said *five* and listed these seven; count corrected by Amendment 1)**:** `granted_by`, `granted_at`, `expires_at`
(nullable = permanent, the ADR 0103 semantics; enforced at READ time in the predicate and validated
future-at-grant in the DOOR, never by a table CHECK), `revoked_at` + `revoked_by` (soft, shape
CHECK `(revoked_at is null) = (revoked_by is null)`), and `reason` (+ a constrained
`reason_code`). Plus the posture: RLS on, one own-row SELECT policy, **no DML privilege to
`authenticated`**, an active partial unique `NULLS NOT DISTINCT` over the grant tuple, writes only
through an audited DEFINER door over an INVOKER kernel. ⚠ **Amended — D5·2** (the tuple, expiry and revocation live on the grant header).

**D6 — Grantee and grantor.** (1) The grantee must be a **member of the resource's commission**
(`HC021` generalized), with a documented exception per root — referrals will need one on the
receiving side. External people (surveyors) are a token-based plane outside this rule and must say so.
(2) The grantor is the **coordinator**, plus the **tenancy-admin fallback** on every root's door
(PO ruling, Q21): an `org_admin` of the organization or a `hospital_admin` of the hospital may grant
and revoke and **reads nothing**, with the two safeguards written into every door — grantee must be
a member, and no self-grant. (3) That fallback now serves **two** situations, recorded here because
round 1 assumed only one: the sole coordinator **recused or respondent** on the case (ADR 0078's
original reason) and the **absent** coordinator. The PO ruled coordinator presence stays a
**practice, not a database rule** (Q12 → option b): no last-coordinator guard is added. (4) An
**administrativo never grants** (Q22): granting is an authority act, and that plane is AE5.6's. ⚠ **Amended — D6·5** (the reference door made conforming pre-pilot — it had no self-grant check; the grantee's commission is the root adapter's answer; technical-director referrals; the management surface).

**D7 — One audit convention.** `entity_type` = the plane (`case_access`, later `meeting_access`,
…), `entity_id` = **the resource** the grant is on, the grantee always in `metadata`, exactly three
event names `<plane>.granted` / `<plane>.updated` / `<plane>.revoked`, emitted by **one shared
trigger function** parameterized by trigger arguments, whose tenant anchors come from
`securable_resources`. Existing tables keep their current emission until D11's ruling reaches them. ⚠ **Amended — D7·2** (tenant anchors come from the root's adapter, defaulting to the registry — the referral registry row is anchored on the SOURCE side).

**D8 — Provenance is typed.** A non-manual `source` gets **one typed FK column per source** when
that source ships (ADR 0065 App-A dialect 1); the case ledger's bare `source_entity_id` is corrected
the same way when its first non-manual source lands, post-pilot. A bare id the database cannot
check is exactly the tenant-mismatch class the typed column prevents.

**D9 — A write grant on a terminal resource is refused by the DOOR.** Today the case screen greys
out "Edição" on a closed case while the door stores the grant, inert only because content tables
refuse writes. Every ledger's grant door refuses a write ability on a terminal resource; read grants
stay allowed (ADR 0033 D6). ⛔ This is door validation — the resolver keeps no lifecycle step (ADR
0078 A24·3). Landed for cases pre-pilot (D12).

**D10 — Two levels on the screen, many abilities underneath.** Every grant dialog offers read and
write; each root defines what those expand to. PHI abilities are **never on the screen** — the two
PHI parameters of `grant_case_access` stay reachable only from SQL, by ruling, until a decision with
a reason requirement says otherwise.

**D11 — Scope and classification.** This convention governs **object-level** ledgers only. The
scope-level capability planes — `commission_administrativos` + its capabilities (ADR 0061) and
`hospital_dpos` (ADR 0130) — are **explicitly outside it**; their retrofit waits for the AE5 opening
bundle (ADR 0176 D8, F8 / AE5.6). The future conformance keystone (D12) discovers grant-shaped
tables by property and applies **an allow-list with a named owner and an expiry per entry** to those
two (Q16 → a), classifies participation records (D3) as *not ledgers*, and lets nothing sit red.

| existing table | class under this ADR |
| --- | --- |
| `case_access_grants` | ledger (root: case) — the reference shape |
| `meeting_closed_session_item_readers` | ledger fragment — folds into a meeting ledger as an item-narrowed grant when that ledger is built |
| `document_approvals` | participation record whose pending state confers read; not a ledger |
| `rca_members`, `case_interview_interviewers`, `meeting_attendees`, `action_item_assignments`, `case_phases/narratives.assigned_to`, `capa_action.assignee_user_id` | participation records |
| `referral_assignments`, `referral_case_links` | workflow pointers; grant nothing (K-R4-1/2) |
| `commission_administrativo_capabilities`, `hospital_dpos` | scope-level capability planes — outside this ADR |

**D12 — Timing: text now, two small fixes pre-pilot, the build after AE5-complete.**
- **Now:** this ADR; the path-scoped rule `.claude/rules/grant-plane-convention.md` (the
  placeholder for the keystone until it exists — ADR 0127's admitted case); the Phase 18 / Phase 19
  text amended to start from this convention.
- **Pre-pilot, case-only, no AE5 contact:** (i) `authorizeCommission` mirrors the door exactly —
  the `platform_admin` pass goes, the tenancy-admin arm comes; (ii) D9 on `grant_case_access`
  with its RED-first pgTAP keystone.
- **After AE5-complete, at the first consumer** (the Phase 19 plane ADR or Phase 20 break-glass):
  the scaffold **script** (prints table, doors, trigger attachment and test skeleton from a name and
  an ability list — Q17 → b), the shared trigger (D7), the shared dialog and action factory, the
  conformance keystone (D11), the read-only union roster (Q18 → with the first ledger), the three
  missing codes (D4), and the first stamped ledger.
- **Deferred choice:** whether ledgers converge on **one shared table anchored on
  `securable_resources`** or become a **provider inside the `authz` layer** is taken at the Phase 19
  plane ADR, on a settled AE5 and real data. C is a mechanical step from D4/D5-conforming ledgers
  (a union with a type column); D is mechanical on the LEDGER side only (a new fact source beside
  `authz.assignment_facts`) — its resolver side goes through the AE7 door, as Option D below states
  (⚠ wording corrected by Amendment 1; the 2026-09-10 text called both "mechanical").
- **Hypothetical roots, decided so the convention is not abstract:** meetings keep the attendee row
  as a computed read source on `participants_only` meetings and absorb the reserved-session reader
  list (Q14 → a); referrals grant on the **receiving side only**, so no side column (Q15 → a);
  interviews get no ledger (D2). ⚠ **Amended — D12·2** (a third pre-pilot fix; the post-AE5 build list widened).

## Considered options

- **A · keep copying the shape per feature** — what the phase docs prescribed. Zero cost now; the
  price is already visible (`hospital_dpos` inlines a predicate and hand-maintains a sibling list;
  five vocabularies; F-14). Rejected.
- **B · one convention, per-root ledgers, shared trigger/dialog/scaffold/keystone — CHOSEN.** Fits
  ADR 0155 D7 word for word, leaves the door-sweep baselines intact, keeps PHI columns physically
  confined to the case ledger, and makes C and D mechanical later.
- **C · one physical ledger on `securable_resources`.** Admissible only because the registry makes
  it typed; needs a `(resource_type, ability)` catalog so PHI abilities are impossible on non-PHI
  rows, a closed CASE for per-type grantor authority, and a migration across 27 pgTAP files and 7
  direct readers whose cheap window is the pilot-gating one. Deferred to the Phase 19 plane ADR.
- **D · a provider inside the `authz` layer** (object scope kinds, grants as role bundles). The
  `scope_kind` domain is closed, `has_permission` fails closed on a kind a permission does not
  resolve at, ADR 0201 ratified a role-wide hat that a grant is not, and ADR 0155 D6 / plan AE7 defer
  generic scopes behind five entry conditions. Proposable only through that door, post-AE5.
- **E · materialize assignment-derived access into the ledger.** Rejected by ADR 0033 and the
  handoff §3.3; re-rejected as D3.

## Consequences

- **Accepted cost, stated:** if Phase 19 chooses C, the case ledger migrates after the pilot against
  live data. D4/D5 conformance is what makes that a union, not a redesign.
- **A follow-up owns the deferred build** — `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5`, parked,
  *Revisit when* AE5-complete and the first consumer opens. The rule file retires when the keystone
  lands (`docs/progress/rules-archive.md`, verbatim).
- **Unit of record:** hub `docs/features/grant-plane-convention.md`, log
  `docs/progress/grant-plane-convention.md`; the pre-pilot fixes' migration and pgTAP `416` are
  recorded there, the seam slice in `docs/backend-state/cases-and-ethics.md`.
- **What this ADR does NOT do:** it builds no ledger, changes no storage, adds no permission code,
  and touches neither `app._case_caps` nor the AE5 bundle. A builder who creates a grant-shaped
  table before AE5-complete is acting against D12, and the rule file says so at the moment of
  writing the migration.
- **Amended 2026-09-10** — § Amendment 1: the external audit's findings ruled in place; its own
  consequences (unit, follow-ups, corpus edits) are listed there.

## Amendment 1 — the external design audit's five findings ruled; the reusable shape made exact

**2026-09-10 · PO rulings in a second grilling session (two rounds, 16 questions), the lead
recommending; every clause below was measured on the live catalog before it was put to the PO.**
Trigger: an external design QA of this ADR, committed verbatim as
[docs/reviews/adr-0205-design-qa-review.md](../reviews/adr-0205-design-qa-review.md) (verdict
*NEEDS REVISION*; five major findings, four additional concerns). The lead re-derived every claim on
the live catalog rather than from the migration text the audit cites: all five held, two were
understated, and two related defects the audit missed were found on the way (D6·5·2, D2·2·3). Unit
of record: `GRANT-PLANE-CONVENTION-A1` (hub `docs/features/grant-plane-convention-a1.md`).

**What the amendment does NOT change.** The direction (Option B), D1, D3, D8, D9, D10, D11, the
timing rule *no ledger before AE5-complete*, and the C-vs-D deferral all stand. The audit's caution
that centralization must not be described as decided needed no change — no document described it
so. Its claim that a single narrowing column *"cannot be a typed FK to several child tables"* is
true of a bare FK and false of the composite typed reference the registry already exposes
(`action_items.securable_type` uses it today) — D2·2 names that mechanism rather than inventing one.

### D2·2 — Narrowing is a typed registry reference; ownership is proven by a parent link; the children are listed per root

1. **Mechanism.** `limited_to_resource_id` is written as the composite typed reference
   `(limited_to_resource_id, limited_to_resource_type)` → `securable_resources(id, resource_type)`,
   with a CHECK pinning the type to the root's listed children. Never a bare uuid (D8's reasoning).
2. **Ownership invariant.** `securable_resources` gains a nullable **typed composite parent
   reference** `(parent_id, parent_type)` → `securable_resources(id, resource_type)`, stamped by the
   existing `ensure_securable_resource_*` triggers at registration: a root carries none, a child
   carries its root. One generic guard on every ledger asserts *grant resource = child's parent*, so
   the conformance keystone checks D2 without knowing the root. Lands with the first ledger (D12·2),
   not now. Rejected: a per-root child-to-root function alone (not keystone-checkable); both
   (two authorities for one fact).
3. **Narrowable children, per root** — a child outside the registry's type domain is registered when
   that root's ledger is built; an unregistered child is not narrowable. Measured: the domain today is
   `case · meeting · interview · action_item · controlled_document · case_referral · rca ·
   capa_action · form_response`, so agenda items, closed-session items and document versions are
   all missing.

   | root | narrowable children |
   | --- | --- |
   | case | interview; **case-sourced** action item |
   | meeting | agenda item; closed-session item (absorbing `meeting_closed_session_item_readers`, D11); **meeting-sourced** action item |
   | controlled document | document version |
   | referral | none — whole-referral grants only |

   RCA stays out: its parent is a patient-safety event, which is not a D2 root.
4. **The action-item root is its `source_*` provenance** (`source_type ∈ {case, meeting, manual}`,
   CHECK-bound). `linked_case_id` is a workflow pointer that grants nothing (the K-R4 class); a
   **manual** action item has no root and cannot be narrowed to — its *"one person must see it"*
   path is `assignees_only` participation (D3). Rejected: a linked case as a second root (breaks
   *"exclusion rules stay in force by position"*).

### D4·2 — One Grant is a header with ability child rows; abilities come from an ability catalog

1. **Cardinality.** A ledger is a **grant header** — principal, resource, narrowing (D2·2),
   provenance (D8), the seven D5 columns, the active partial unique `NULLS NOT DISTINCT` tuple —
   plus an **ability child table** keyed `(grant_id, permission_code)`. Grant, re-grant, revoke and
   audit act on the header; a re-grant **replaces the child set atomically**; expiry and soft
   revocation are the header's. Rejected: an ability array (no per-element FK to the catalog); one
   row per ability (lifecycle fragments across rows); deferring the choice (the scaffold cannot be
   deterministic without it — the audit's finding 1).
2. **Ability catalog.** A small table keyed `(root_type, permission_code)`, seeded by the scaffold
   from the root's ability list, FK'd from every child table. It is what makes a PHI code
   **physically impossible** on a non-PHI root (the property Option C wanted) and the one thing the
   keystone asserts per ledger. Rejected: door-only validation.
3. **The lattice lives in the door.** *write ⇒ read* and *restricted ⇒ standard* are enforced by the
   door's D10 expansion, never by table CHECKs — the case ledger's boolean CHECKs are its own.
4. **Audit (D7) fires on the header only**: `.granted` on insert, `.updated` when the ability set or
   expiry changes, `.revoked` on soft revoke; the code set travels in `metadata`. Child-row changes
   emit nothing of their own.
5. **The case ledger is projected** into this shape (one row → one header + up to five child rows)
   for the union roster and for Option C; it is still not physically changed (D4).

### D5·2 — The count, and where the tuple lives

The mandatory set is **seven** columns (the 2026-09-10 text said *five* and listed seven; corrected
in place): `granted_by`, `granted_at`, `expires_at`, `revoked_at`, `revoked_by`, `reason`,
`reason_code`. Under D4·2 they, the unique tuple, the RLS posture and the no-DML ACL are the
**header's**; the child table carries the same posture and no lifecycle columns of its own.

### D6·5 — The reference door made conforming; the grantee's commission is the adapter's answer; the surface

1. **No self-grant, built pre-pilot (Fix 3).** Measured on the live body: `grant_case_access` checks
   authority (42501) → actor exclusion (`HC0F1`) → level → grantee membership (`HC021`) → future
   expiry → terminal status (`HC0U0`) → kernel, and never compares the grantee to `auth.uid()`; its
   own comment names grantee membership as the anti-self-escalation guard. That guard is empty for
   the one arm D6·2 says *"reads nothing"*: resolver S2 gives a tenancy admin `manage_case_access`
   ONLY, so an `org_admin` / `hospital_admin` who also holds a plain membership in the commission
   passes both gates and can grant themselves content and, through the SQL-only PHI parameters,
   PHI. ⚠ The audit graded this *"not presently a privilege escalation"*; on that arm it is one.
   **Ruling:** the public door refuses `p_user = auth.uid()` **immediately after the authority gate
   and the exclusion check, before level, membership and expiry** — a caller with no standing still
   gets 42501, and a self-grant is refused as an act, not as a payload — with a new `HC` SQLSTATE
   mapped to pt-BR in `src/lib/case-access/actions.ts`; the access panel's grantee picker
   **excludes the actor**. The INVOKER kernel and `create_case`'s creator self-grant are untouched;
   `revoke_case_access` is unchanged (giving access up is not an authority act). RED-first pgTAP,
   with the exploit persona — a tenancy admin who also holds a plain membership — as the keystone's
   subject. Rejected: text-only now (leaves a live path open through the pilot).

   ⚠ **Corrected by measurement during the build (2026-09-10, `backend`, pgTAP `417`; the ratified
   paragraph above is kept verbatim — read both).** The tenancy-admin self-grant was **not** reachable:
   `app.has_role` carries the ACT hat conjunct `(p_user_id is distinct from auth.uid() or p_role is not
   distinct from app.active_role())` (BUG-ACT-NULLHAT-1), so for the *self* grantee the membership check
   collapses onto the caller's own hat — under the `org_admin` hat the door answered `HC021`, under the
   `staff` hat `42501`; the two gates could not both pass in one session. That closure was *incidental*
   (a hat conjunct at a later gate, asserted by nothing — LEARN-058), which is why the ruled *position*
   of the refusal still matters. The arm that **was open** is the **coordinator's**: under the
   `staff_admin` hat a self-grant **succeeded** pre-migration, and D5·6 lets a coordinator *issue*
   `read_restricted_phi` without holding it — so she could issue it to herself through the SQL-only
   PHI parameters. The remedy is unchanged and closes strictly more than the paragraph claimed; `417`
   keeps the tenancy-admin persona (K1, K2) beside the coordinator (K3, K3c) and the ordering twin.
   Also measured: `create_case` **skips** the creator self-grant for a coordinator (ADR 0061 revised);
   only the non-coordinator capability arm reaches the kernel — the kernel path is proven with that
   persona, and the kernel writes `source = 'manual_grant'` with `reason_code = 'creator_self_grant'`.
2. **"Member of the resource's commission" means the commission the root's adapter names (D7·2).**
   One function answers *which commission is this resource's, for grant purposes* and serves both
   this check and the audit anchor, so the two cannot drift apart again. For referrals that is the
   **target** commission (D12's receiving-side ruling). Measured, and missed by the audit: a
   **technical-director** referral (`case_referral.target_type = 'technical_director'`) carries a
   `target_hospital_id` and **no commission** — the adapter returns nothing and the door refuses:
   **no ledger grants on technical-director referrals** until a real user asks. Rejected: a
   target-hospital affiliation rule (invents a grantee class no user asked for).
3. **The management surface is a convention, built with the factory.** Every root's grant plane has
   a **metadata-only management surface** reachable from the grantor's own area — for the
   tenancy-admin fallback, the commission page under `/o/[org]/manage/comissoes/[commissionSlug]` —
   through a DEFINER door that resolves the resource's commission and lists its grants **without
   content**. Field ceiling, ruled: case **code, status, created date, commission** and the roster
   (grantee, level, expiry, granted by/at); ⛔ never title, description or any content field (a
   title can carry a name; a code cannot). Rejected: the title; a paste-the-id lookup (unusable in
   the deadlock it exists for). **Pre-pilot the fallback arm stays SQL / service-role only** — the
   ruling that archives `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE`; its
   build moves into the build follow-up. Rejected: building the case surface pre-pilot (the deadlock
   needs a recused sole coordinator on a commission with no second one, and a service-role exit
   exists — if the pilot proves otherwise, this is the clause to reopen).

### D7·2 — Tenant anchors come from the root's adapter

Measured: `app.ensure_securable_resource_referral` stamps every referral on its **source**
commission and that commission's org and hospital (4/4 seed rows anchored on source, 0 on target),
while D12 puts referral grants on the receiving side; built literally, D7's *"anchors from
`securable_resources`"* would stamp a receiving-side grant with the source-side anchors — and a
technical-director referral with the wrong hospital. **Ruling:** the shared trigger takes its three
anchors from a **per-root adapter function** passed as a trigger argument; the default adapter
reads the registry row; the referral adapter returns the target commission and its hospital and
org. The registry is untouched. Rejected: re-anchoring the registry to the target side (moves a
DM4 tenancy decision, and every registry reader, to fix an audit stamp); registering a referral
twice.

### D12·2 — Timing, widened

- **Pre-pilot, case-only, no AE5 contact** gains **(iii) Fix 3** — D6·5·1, with its RED-first
  pgTAP keystone and the picker change.
- **After AE5-complete, at the first consumer** gains: the ability catalog and the header-plus-child
  scaffold shape (D4·2); the registry's typed parent link and the generic ownership guard (D2·2);
  the missing child types registered per root as its ledger lands (D2·2·3); one adapter per root
  serving D6·5·2 and D7·2; the metadata-only management surface and its door (D6·5·3), the case one
  first.
- **The C-vs-D sentence** is corrected in place (D12): C is mechanical from conforming ledgers; D is
  mechanical on the ledger side only — measured, the `resolution_scope_kind` domain is closed to
  `organization | hospital | commission` and `has_permission` fails closed on a mismatch — so the
  resolver side goes through the AE7 door, as Option D always said.

### Consequences of Amendment 1

- **Unit of record:** `GRANT-PLANE-CONVENTION-A1` — hub `docs/features/grant-plane-convention-a1.md`,
  record `docs/progress/grant-plane-convention-a1.md`; the original unit stays `complete` (a
  completed hub is not reopened — the precedent is a new unit code). The audit file is cited from
  this ADR permanently and listed on the new hub's `reviews:` while it is open.
- **Follow-ups:** `FUP-GRANT-PLANE-CONVENTION-TENANCY-ADMIN-GRANT-PATH-UNREACHABLE` is **archived** on
  the D6·5·3 ruling; its build half folds into `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5`, whose
  *Closes when* now also names the ability catalog, the parent link, the adapters, the child types
  and the surface — one home for the build (ADR 0186).
- **Text made consistent:** the rule file's one-liners; Phase 18's pgTAP acceptance line (*"per-round
  auditor write grant"* → the assigned-auditor participation write, D3); this ADR's D5 count and
  D12 sentence, in place; a PROGRESS.md § Phase Status row for the unit.
- **Accepted cost, restated:** the case ledger's projection now has two halves (booleans → codes;
  one row → header + children). If Phase 19 chooses C, that projection is the migration.
