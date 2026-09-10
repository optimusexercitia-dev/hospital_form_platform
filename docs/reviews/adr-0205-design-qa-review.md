# QA Review — ADR 0205 per-object grant-plane design

**Reviewed:** ADR 0205 against the current Case grant implementation, the authorization catalog,
the securable-resource registry, and the planned Meeting, Interview, Referral, and document access
needs.

**Verdict: NEEDS REVISION**

ADR 0205 has the right architectural direction and would substantially reduce authorization drift,
but it is not yet precise enough to guarantee one reusable grant model across Cases, Meetings,
Referrals, and Controlled Documents.

It establishes a strong convention; it does not yet define an implementation-ready shared model.
The first new ledger should not be generated until the major findings below are resolved.

## Major findings

### 1. The storage unit for one Grant with several abilities is undefined

D4 says abilities are stored as rows named by permission code, while D5 attaches lifecycle and
audit metadata to the ledger, D7 expects one grant event, and D10 expands one UI level into several
abilities. The ADR never chooses between:

- one ledger row per ability;
- one Grant header plus ability child rows; or
- one row containing an ability collection.

These choices produce different uniqueness, re-grant, downgrade, expiry, revocation, audit-event,
and roster behavior. Consequently, the promised scaffold cannot generate a deterministic design,
and future features could still choose incompatible shapes. See [ADR 0205 D4–D5](../decisions/0205-per-object-grant-plane-convention.md#d4--abilities-are-named-by-the-catalogs-permission-codes)
and [D7/D10](../decisions/0205-per-object-grant-plane-convention.md#d7--one-audit-convention).

**Required ruling:** define the logical aggregate. The recommended shape is a Grant header containing
principal, root, narrowing, provenance, reason, expiry, and revocation, with a child relation keyed
by `(grant_id, permission_code)`. Grant, re-grant, revoke, and auditing should operate atomically on
the header and its ability set.

### 2. Receiving-side Referral grants conflict with the registry used for tenancy and auditing

D7 requires audit tenant anchors to come from `securable_resources`; D12 says Referral grants
belong to the receiving side. But every Referral registry row is intentionally anchored to the
**source** commission, both on creation and backfill. See [ADR 0205 D7](../decisions/0205-per-object-grant-plane-convention.md#d7--one-audit-convention),
[D12](../decisions/0205-per-object-grant-plane-convention.md#d12--timing-text-now-two-small-fixes-pre-pilot-the-build-after-ae5-complete),
and the [Referral registry implementation](../../supabase/migrations/20260926000100_dm4_referral_securable_registry.sql).

Built literally, the shared trigger would stamp receiving-side grant activity with the source-side
tenant anchor.

**Required ruling:** either change D7 to use a root-specific tenant-anchor adapter, with Referral
resolving its target commission, or deliberately change the registry model. The current statements
cannot both hold.

### 3. Child narrowing is not sufficiently typed or parent-bound

A single `limited_to_resource_id` cannot be a typed FK to several child tables. The problem is
visible immediately:

- Case may narrow to an Interview or Action Item.
- Meeting has agenda items and closed-session items.
- Closed-session items are not listed in D2 even though their reader rows are to be folded into the
  Meeting ledger.
- Action Items may be manual, Meeting-sourced, and optionally Case-linked, so they do not have one
  unambiguous root.

See [ADR 0205 D2](../decisions/0205-per-object-grant-plane-convention.md#d2--only-a-root-securable-gets-a-ledger-children-inherit-with-a-read-only-narrowing),
the [Action Item shape](../../supabase/migrations/20260706000000_shared_action_items.sql), and
[closed-session items](../../supabase/migrations/20260807000000_authz_c4_closed_session_tables.sql).

The ADR also does not require proof that the narrowed child actually belongs to the named root.

**Required ruling:** define child-kind discrimination, typed FK mechanics, and a database-enforced
root/child ownership invariant. Also decide the authoritative root for manual and multi-linked
Action Items.

### 4. D6's grant-door invariants do not match the Case reference implementation

D6 says every grant door has both member validation and a no-self-grant safeguard. The current
`grant_case_access` door checks authority, exclusion, level, membership, and expiry, but contains no
`p_user <> auth.uid()` check. See [ADR 0205 D6](../decisions/0205-per-object-grant-plane-convention.md#d6--grantee-and-grantor)
and the [Case door](../../supabase/migrations/20260802000000_authz_b_case_access_grants_hard_cut.sql).
The later terminal-status migration explicitly preserves those existing validations rather than
adding self-grant protection.

This is not presently a privilege escalation for a coordinator, who already holds access, but it
makes the designated reference shape non-conforming and permits misleading manual Grant history.

**Required ruling:** enforce no self-grant on the public/manual door while explicitly preserving the
intentional creator self-grant through the trusted kernel. The distinction belongs in ADR 0205 and
its future keystone.

### 5. The tenancy-admin fallback lacks a reusable management interface

D6 gives tenancy administrators authority to manage grants while reading no resource content. The
existing Case application path cannot exercise that authority because it first reads `cases`
through content RLS. This is already documented as an
[open medium-severity follow-up](../followups/follow-ups-open.md#-fup-grant-plane-convention-tenancy-admin-grant-path-unreachable--the-fallback-arm-passes-the-app-check-then-the-case-read-refuses-it).

The future shared dialog/action factory is supposed to be lifted from this Case implementation, so
the same unreachable-authority defect could be copied to every root.

**Required ruling:** add a conventional metadata-only access-management interface through which
coordinators and tenancy administrators can locate the root, list its grants, and mutate them
without obtaining content access.

## Additional concerns

- ADR 0205 standardizes future implementations but does **not** currently centralize storage or
  enforcement. The C-versus-D choice remains deferred. That is acceptable if the goal is primarily
  consistency, but the project should not describe centralization as already decided.
- Calling the `authz` provider option "mechanical" is optimistic. Permission codes currently have
  one tenant-level `resolution_scope_kind`, limited to organization, hospital, or commission, and
  the resolver rejects a scope-kind mismatch. Object-level resolution therefore requires a real
  resolver-model change, not just another fact provider. See the
  [resolution domain](../../supabase/migrations/20261003007140_ae44a_permissions_resolution_scope_kind.sql)
  and [fail-closed resolver check](../../supabase/migrations/20261003007250_ae49_d4_resolver_contract.sql).
- D5 says "five mandatory columns" but names seven fields. This should be corrected so the
  conformance keystone has an exact contract.
- Phase 18 correctly classifies the auditor as participation, but its acceptance text still calls
  that a "per-round auditor write grant," contrary to the new ubiquitous language. See
  [Phase 18](../phases/accreditation-track.md#phase-18--self-assessment-internal-audit--mock-tracer-autoavaliação--auditoria-interna).

## What ADR 0205 gets right

- Explicit Grants are separated from participation-derived access.
- Ledgers belong to root resources, preventing a table per child feature.
- Domain authorizers retain recusal, respondent, confidentiality, lifecycle, and tenancy ceilings.
- Grant metadata, expiry, soft revocation, audited doors, and no authenticated DML are standardized.
- Permission codes provide a shared vocabulary without forcing one universal authorization
  interpreter.
- External token access and scope-level capability planes are correctly excluded rather than forced
  into an unsafe polymorphic ACL.
- A scaffold, shared audit machinery, shared UI machinery, and catalog-driven conformance gate are
  the right mechanisms for preventing future drift.

## Final assessment

ADR 0205 will achieve the stated goal **after amendment**, particularly as a convention-backed
family of domain adapters. As currently written, it is a good direction but not a complete reusable
design: future implementers must still invent the Grant/ability cardinality, child-narrowing schema,
Referral tenant anchoring, and administration interface.

**Recommended disposition:** retain the architectural direction, amend the five major points above,
and require those resolutions before the first non-Case ledger or the scaffold is built.

