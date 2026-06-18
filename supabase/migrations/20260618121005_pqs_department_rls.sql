-- Phase 14a / QA fix M1: add the missing RLS SELECT policy on public.pqs_department.
--
-- public.pqs_department had RLS enabled (migration ...121000) but ZERO policies —
-- deny-by-default, which violates Architecture Rule 1 ("explicit policies on every
-- table") and would silently break the 14b triage RPCs/UI that read
-- rca_default_due_days directly. No 14a TypeScript code reads this table today; this
-- is purely additive (no existing migration or policy is touched).
--
-- DECISION (lead): grant SELECT to `authenticated` with `using (true)`. The row is a
-- NON-PHI singleton governance config (the NSP display name + the RCA default
-- due-window). anon remains excluded (no `to public`/`anon`). A deny-by-default would
-- silently break 14b's direct reads, so an explicit always-true SELECT for any signed-in
-- member is the right minimum. The DEFINER RPCs bypass RLS, so this policy only governs
-- direct / UI reads — it is not the security boundary for any write. No INSERT / UPDATE /
-- DELETE policy: writes stay DEFINER-only, consistent with the rest of the 14a tables.

create policy pqs_department_select on public.pqs_department
  for select to authenticated using (true);

comment on policy pqs_department_select on public.pqs_department is
  'Non-PHI singleton NSP config (name + rca_default_due_days) is readable by any '
  'authenticated member; anon excluded. Satisfies Architecture Rule 1 and unblocks '
  '14b direct reads. Writes stay DEFINER-only (no write policy).';
