# 0013 — Fix form_versions INSERT RLS self-reference

Date: 2026-06-12
Status: Accepted
Phase: 4 (Form Builder & Versioning)

## Context

`form_versions_staff_admin_write` (M6) authorized writes with
`app.is_staff_admin_of(app.commission_of_version(id))`, where
`commission_of_version(id)` runs
`select f.commission_id from form_versions v join forms f ... where v.id = id`.

On INSERT, the candidate row is not yet visible to that helper's OWN query, so
`commission_of_version(<new id>)` returns NULL → `is_staff_admin_of(NULL)` is
false → the WITH CHECK rejects **every** direct INSERT into `form_versions`.
Phase 1's seed never hit this because it runs as `postgres` (RLS-bypassed);
Phase 4's builder is the first flow to insert a version under the
`authenticated` role, via the `security invoker` `create_form` /
`clone_form_version` RPCs, which failed end-to-end.

`form_sections` / `form_items` carry the same self-referential WITH CHECK
*shape*, but they resolve commission via `form_version_id`, which points at a
version row written in a PRIOR statement (already visible) — so those were never
broken and are left untouched.

## Options considered

1. **Repair the policy** (chosen) — resolve commission through the parent that
   already exists at INSERT-check time, `form_id → forms.commission_id`, instead
   of the self-referential `commission_of_version(id)`.
2. **Route around it with a `SECURITY DEFINER` RPC** + an explicit in-function
   authz check. Rejected: it would be the first builder RPC to bypass RLS
   (its invoker siblings `publish_form_version` / `submit_response` do not),
   leaving the broken policy in place as a latent defect that bites the next
   flow to insert a version directly (and that QA's RLS review would flag).

## Decision

Option 1. In migration `20260612100010_form_builder_rpcs.sql`, DROP/CREATE
`form_versions_staff_admin_write` so both USING and WITH CHECK read
`app.is_admin() OR app.is_staff_admin_of((select f.commission_id from
public.forms f where f.id = form_versions.form_id))`. The RPCs stay
`security invoker`; RLS remains the authority (Architecture Rule 1).

Repairing a genuinely-buggy applied policy via DROP/CREATE POLICY in a new,
forward-only migration (not editing the applied M6 file) is the sanctioned path.

## Consequences

- `create_form` and `clone_form_version` now pass end-to-end under invoker RLS:
  the `forms` insert checks `commission_id` directly; the `form_versions` insert
  resolves via the just-inserted `forms` row (prior statement, visible); the
  default-section insert resolves via the just-inserted version (prior statement,
  visible).
- A direct `INSERT` of a draft version by a staff_admin of the owning commission
  now succeeds (previously impossible). pgTAP `60_builder.sql` locks this plus
  the rejections: a foreign staff_admin and a plain staff member are denied.
- `app.commission_of_version(id)` is retained — it is still used (correctly) by
  the `form_sections` / `form_items` SELECT/WRITE policies, where its argument is
  always an already-committed version id.
