# 0088 — Case-type assignment: resolving ETH·E3a's Open decision O-1

- **Status:** Accepted
- **Date:** 2026-07-27
- **Supersedes:** nothing. **Resolves:** ETH·E3a Open decision **O-1**
  (`docs/phases/ethics-e3-surfacing.md`).
- **Related:** ADR [0064](./0064-case-subject-generalization-participants.md) Decision 4
  (case types + terminology), ADR [0072](./0072-ethics-access-spine.md) (`can_read_case`),
  ADR 0078 A1 (the ethics type's `explicit_grants_only` correction).

## Context

ETH·E3a shipped `cases.case_type_id`, the terminology reader, and an **optional**
`p_case_type_id` on `create_case` / `create_case_from_template`. It explicitly deferred
**where a case gets its type from** as Open decision O-1, "flagged for a lead call".
O-1 was never called.

The consequence was larger than terminology. `p_case_type_id` was the **only** channel
into `cases.case_type_id` (verified against `pg_proc` — only those two functions write the
column; there is no update path), and **no caller ever passed it**. So:

- Every app-created case landed `case_type_id` NULL.
- Each `case_types` row's `default_visibility_policy` / `default_confidentiality_level`
  were therefore **inert** — the branch that reads them is guarded by
  `p_case_type_id is not null`.
- The seeded Ethics type resolves `explicit_grants_only` / `ethics_investigation`
  (the ADR 0078 A1 correction), but an ethics case created through the UI fell to the
  hardcoded `commission_default` / `non_phi_internal` — **visible to the whole
  commission**. `seed.sql` asserted this hole was closed; it was not.

Proven live (rolled back), calling `create_case` exactly as `src/lib/cases/actions.ts` did:

```
as the app called it:  visibility=commission_default    confidentiality=non_phi_internal
with the param passed: visibility=explicit_grants_only  confidentiality=ethics_investigation
```

ADR 0064 D4 already specified the intended channel — "a process template references a
`case_type`; a `case` snapshots its `case_type_id`" — but
`process_templates.case_type_id` was never built, which is why nothing could inherit.

## Decision

Build ADR 0064 D4's channel, in both directions:

1. **`process_templates.case_type_id`** (nullable FK, `on delete set null`) — the template
   DECLARES its type. Written through `set_template_case_type` (staff_admin,
   non-archived), with a `before insert or update` trigger enforcing that the type's
   organization matches the template's commission's organization (`HC0F7`). A **trigger,
   not a composite FK** — a new composite FK breaks un-hinted PostgREST embeds elsewhere
   (PGRST201; BUG-NPH-003).
2. **`create_case_from_template` INHERITS** the template's declared type when the caller
   passes none. An explicit `p_case_type_id` still overrides.
3. **The create-case dialog picks a type only on the process-less path**, where there is
   no template to inherit from and the picker is the sole channel.
4. **Org-admin CRUD** for `case_types` at `/o/[org]/manage/tipos-de-caso`. No new RPC —
   `case_types_admin_write` (`FOR ALL`, `app.is_org_admin_of`) plus the `authenticated`
   grants already make an RLS-scoped write the door.

Three deliberate calls worth recording:

- **The templated create path does NOT expose an override.** The RPC still accepts one,
  but surfacing it in the dialog would let a case creator DOWNGRADE the posture an ethics
  process declares — reopening the exact gap this closes.
- **`set_template_case_type` accepts `active` templates**, unlike the draft-only
  `set_template_collects_patient`. `collects_patient` changes the case-creation form's
  SHAPE; `case_type_id` only supplies defaults to cases created afterwards. Draft-only
  would leave a live untyped ethics process unfixable without cloning it — the precise
  remediation this ADR exists to enable.
- **No retro-fit.** Existing cases keep the posture they snapshotted at creation
  (the `case_outcomes` D11 propagation rule). Cases created before this ADR that should
  be restricted must be moved with `set_case_visibility`.

`NULL` stays legal end to end: an untyped case behaves exactly as before and resolves the
platform-default terminology bundle.

## Consequences

- Ethics (and any future sensitive) processes can finally be born locked-down, which is
  what the ADR 0078 A1 / O-1 ruling intended.
- `case_types` rows become **access configuration**. The org-admin screen says so, and
  widening a type's visibility widens every case created after the change.
- The `case_types` flag now gates real behaviour, not dormant schema: with it off the
  pickers do not render and the inheritance branch does not run.
- Lesson recorded: E3a's QA verified the RPC's inheritance *branch* but never that any
  caller reached it. A guarded branch with no caller is indistinguishable from a working
  feature under branch-level review — the check that catches it is "who calls this?", not
  "does this work?".
