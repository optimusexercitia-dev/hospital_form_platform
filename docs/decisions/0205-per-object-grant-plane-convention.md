# ADR 0205 — The per-object grant plane convention: root ledgers, computed participation, catalog-named abilities — decided now, built after AE5

**Status:** accepted 2026-09-10 (PO, in a grilling session over the live catalog; every Decision below is a PO ruling, attributed inline where it reversed the lead's recommendation)
**Date:** 2026-09-10
**Area:** authorization / per-user per-object grants (`case_access_grants` and the ledgers its future siblings will need) / the seam between the domain adapters and the `authz` permission layer
**Amends:** ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (D7 — its clause *"`case_access_grants` … stay where they are, adapted to the shared vocabulary"* is given its content: **this convention is the adaptation**, D4 below; nothing else in D7 moves) · ADR [0078](./0078-authorization-capability-model.md) (three points: the B6 org-admin door arm's justification gains a second case, the **absent** coordinator, D6·3; the two PHI parameters of `grant_case_access` are ruled **unreachable from the screen**, D10; and the grant **door** gains a terminal-status refusal for write grants, D9 — ⛔ the resolver is untouched, A24·3's *"no lifecycle step in `_case_caps`"* stands) · ADR [0033](./0033-case-access-control.md) (D6 — its rejection of cross-commission grants survives as this ADR's D6 default; its "write grants are not allowed on a terminal case" rule moves from the screen into the DOOR, D9; its computed-attribution rule is generalized as D3)
**Related:** [0050](./0050-action-items-fold-visibility-scope-case-access-expiry.md) / [0102](./0102-extend-on-regrant-expiry-seam.md) / [0103](./0103-case-access-null-expiry-is-permanent.md) (expiry semantics) · [0061](./0061-administrativo-delegated-role.md) / [0130](./0130-dsr-subject-request-workflow.md) (the two scope-level capability planes this convention explicitly does NOT govern, D11) · [0114](./0114-document-model-redesign.md) (D6 + D16 — the document access plane lands at Phase 19 and now starts from this convention) · [0176](./0176-authz-permission-layer-made-real.md) (D8 — nothing here is picked off inside a role increment) · [0182](./0182-statement-scoped-authorized-scope-ids.md) · [0201](./0201-the-keying-asymmetry-is-the-model.md)
⛔ Supersedes nothing.
⚠ **Numbering:** 0204 is reserved by `docs/plans/pre-ae5-remediation.md` for the `D`-ceiling / `search_path` conventions and 0202 is an unfillable hole; this ADR takes 0205 as that plan instructs.

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
participation row (D3).

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
ADR 0155 D7's *"adapted to the shared vocabulary"* means.

**D5 — Five mandatory columns on every ledger:** `granted_by`, `granted_at`, `expires_at`
(nullable = permanent, the ADR 0103 semantics; enforced at READ time in the predicate and validated
future-at-grant in the DOOR, never by a table CHECK), `revoked_at` + `revoked_by` (soft, shape
CHECK `(revoked_at is null) = (revoked_by is null)`), and `reason` (+ a constrained
`reason_code`). Plus the posture: RLS on, one own-row SELECT policy, **no DML privilege to
`authenticated`**, an active partial unique `NULLS NOT DISTINCT` over the grant tuple, writes only
through an audited DEFINER door over an INVOKER kernel.

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
**administrativo never grants** (Q22): granting is an authority act, and that plane is AE5.6's.

**D7 — One audit convention.** `entity_type` = the plane (`case_access`, later `meeting_access`,
…), `entity_id` = **the resource** the grant is on, the grantee always in `metadata`, exactly three
event names `<plane>.granted` / `<plane>.updated` / `<plane>.revoked`, emitted by **one shared
trigger function** parameterized by trigger arguments, whose tenant anchors come from
`securable_resources`. Existing tables keep their current emission until D11's ruling reaches them.

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
  plane ADR, on a settled AE5 and real data. Either is a mechanical step from D4/D5-conforming
  ledgers: a union with a type column, or a new fact source beside `authz.assignment_facts`.
- **Hypothetical roots, decided so the convention is not abstract:** meetings keep the attendee row
  as a computed read source on `participants_only` meetings and absorb the reserved-session reader
  list (Q14 → a); referrals grant on the **receiving side only**, so no side column (Q15 → a);
  interviews get no ledger (D2).

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
