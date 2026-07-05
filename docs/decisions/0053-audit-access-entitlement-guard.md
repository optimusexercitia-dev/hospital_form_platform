# ADR 0053 — Audit-access entitlement guard (C-4): dispatch to the entity's own read predicate, not a revoke

**Status:** Accepted (planned) · **Date:** 2026-07-04 · **Feature:** Pre-Pilot DB
Hardening — WS-2 (C-4). Closes the who-read-what forgery vector in
`public.log_audit_access`. Part of the pre-pilot hardening program
([pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §1 WS-2);
triage in [external-db-audit-2026-07-evaluation.md](../reviews/external-db-audit-2026-07-evaluation.md)
§2 C-4. Builds on the audit trail (ADR [0029](./0029-audit-trail.md), Architecture Rule 11)
and the PHI posture (ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md) /
[0035](./0035-lgpd-anvisa-regulatory-posture.md), Rule 12).

## Context

`public.log_audit_access` is the single `SECURITY DEFINER` wrapper through which the app
(and the SQL DEFINER read-doors) record sensitive **reads** — foreign-response opens, CSV
exports, and every PHI-identifier read / clinical detail-open (`event_patient.read`,
`safety_event.viewed`, `referral_patient.read`, `case_patient.read`, …). It is `public`,
granted to `authenticated`. Before this change it validated **only** that `p_action` is in
a 14-verb allow-list, then passed the caller-supplied `p_entity_id` / `p_commission` /
`p_metadata` straight to `app.audit_write` with **no standing check**.

**The vulnerability (C-4, confirmed reachable via PostgREST alone):** any authenticated user
could call `log_audit_access` directly and mint a chain-valid but fictitious "who-read-what"
row into **any** commission's append-only, hash-chained audit trail — a row that passes
`verify_audit_chain`, lands in the audit UI/exports, and is unremovable by design. The actor
is server-derived in `audit_write` (`v_actor := auth.uid()`), so a forger **cannot frame
another user**; the real and only cross-tenant vector is **injecting a row into a commission
they have no relationship with**.

### Two rejected fixes

- **Revoke the `authenticated` EXECUTE grant.** Rejected: it breaks the **6 app-layer
  callers** that invoke `log_audit_access` (via the TS `logAuditAccess`/`auditClinicalView`
  wrappers) as `authenticated` after a successful RLS read — `meetings.ts`, `interviews.ts`,
  `safety-events.ts`, `submissions.ts`, `triage.ts`, `rca.ts`, `capa.ts`, and the two export
  routes. They legitimately need it.
- **Check the caller is a member of `p_commission`.** Rejected: it breaks legitimate PHI-door
  callers whose standing is on a **different** commission/hospital than the (correct)
  attribution commission:
  - `transfer_event_custody` can move an event to a commission in **another hospital**; a
    member/staff_admin of the *current-owner* commission then legitimately reads the event
    (via `can_read_event`'s owner-commission arm) but logs with
    `p_commission = reporting_commission_id`, where they have no membership.
  - a **PQS operator** (per-hospital coordinator or enrolled member) reads PHI via the
    hospital-scoped `is_pqs_operator_of` arm — they are **not** a `commission_members` row of
    the reporting commission at all.

## Decision

Add an entitlement guard **inside** `log_audit_access` (keep the grant, keep the verb
allow-list). A new internal `app._audit_access_authorized(p_action, p_entity_id, p_commission)`
(`SECURITY DEFINER`, `search_path` pinned, owner postgres, PUBLIC-revoked) **dispatches on the
action to the entity's OWN read predicate**, keyed on `(p_entity_id, auth.uid())`:

> *If you could legitimately read this entity, you may audit that read.*

This is byte-for-byte the authorization every legitimate caller already passed before
logging, so **all callers succeed by construction**; a forger passing a foreign `p_entity_id`
they cannot read fails with `42501`.

**Per-action dispatch map** (every allow-listed action MUST have an arm — fail-closed
otherwise; a completeness pgTAP asserts allow-list ⊆ map so a future `.viewed` action cannot
silently fall through):

| Action | entity_id | Standing predicate on `auth.uid()` |
|---|---|---|
| `case.opened` | case id | `can_read_case` |
| `case_patient.read` | case id | `can_read_case_patient` |
| `event_patient.read` | event id | `can_read_event_patient` |
| `safety_event.viewed` / `triage.viewed` | event id | `can_read_event` |
| `rca.viewed` | rca id | `can_read_event(rca.event_id)` (inline resolve) |
| `capa.viewed` | capa_plan id | `can_read_capa` |
| `referral.viewed` / `referral_patient.read` | referral id | `can_read_referral_phi` |
| `meeting.viewed` | meeting id | `is_member_of(commission) OR is_commission_admin_of` |
| `interview.viewed` | interview id | `is_member_of(commission) OR is_commission_admin_of` |
| `response.opened_foreign` | response id | `is_staff_admin_of(response.commission) OR is_commission_admin_of` |
| `response.exported` / `audit.exported` | form/opaque id | `is_staff_admin_of(p_commission) OR is_commission_admin_of` (coarse) |

Platform admin (`is_admin()`) has standing everywhere (mirrors the audit read tier). Standing
is **not** checked against `p_commission` for the entity-scoped actions — the caller's standing
may be on a different commission/hospital than the attribution commission (custody transfer /
PQS operator, above). `auth.uid()` resolves inside the DEFINER helper (it reads the
request-scoped JWT GUC regardless of the function's security context).

## Residual (accepted; not blocking pre-pilot)

1. **Entity-scoped actions:** a user who *can* read an entity can still emit a *false-content*
   `*.viewed`/`*.read` row about a read they didn't actually perform — but ONLY for entities
   they're entitled to, scoped to that entity's commission. Same-actor, same-scope, entitled.
2. **Coarse export actions** (`response.exported`, `audit.exported`): `p_entity_id` (a
   form/opaque id) is **not** cross-checked against `p_commission`, because those ids have no
   per-entity read predicate. Standing is checked against `p_commission` instead. A caller
   still cannot pass a `p_commission` they lack `staff_admin`/`commission_admin` standing in,
   so the cross-tenant injection vector is closed; the residual is same-actor/same-scope.

The **cross-tenant** vector — a chain-valid row in a commission/entity the caller has no
relationship with — is closed in all cases. The fuller design (emit each audit row only from
inside the DEFINER read door, never from a client-callable wrapper) is **deferred hardening**,
not required pre-pilot.

## Consequences

- One new coordination point: the action→predicate map in `_audit_access_authorized`. A new
  audited-read action must be added to BOTH the `log_audit_access` allow-list and the dispatch
  map; the `191_grant_hardening.sql` completeness test fails loudly if the allow-list gains a
  verb without a dispatch arm.
- No caller signature changes; no attribution change (the row's commission/org derivation in
  `audit_write` is untouched). No behavioural change for any legitimate caller.
- Locked by pgTAP (`191`): a member of commission A calling with a commission-B entity raises;
  the legit entity-scoped + export + PHI-door paths still emit their rows; the allow-list ⊆
  dispatch-map completeness check; an entitled caller passes / an unentitled caller fails
  (empirically confirming `auth.uid()` resolves inside the DEFINER helper).
