-- AE1 close condition #6 (AE0 finding F-AE0-4) — normalize every `TO public` RLS policy
-- to `TO authenticated`.
--
-- ⛔ F-AE0-4'S COUNTS ARE WRONG IN BOTH HALVES, AND ITS TOTAL IS RIGHT, WHICH IS WHY
-- NOBODY NOTICED. It reads: "six `process_template_*` tables gate on `TO public`" and "the
-- other 2 tables in the same feature use `TO authenticated`". Measured 2026-08-27 against
-- `pg_policies`: the family is 8 tables, but the split is **5 / 3**, not 6 / 2 —
--   TO public  : process_template_{custom_fields,narratives,outcomes,phases,versions}
--   TO authent.: process_template_{phase_allowed_results,phase_offered_results}, process_templates
-- and the unit is POLICIES, not tables: those 5 tables carry **10** policies (a `_select`
-- and a `_staff_admin_write` each). The plan's close condition compressed this further, to
-- "the six `TO public` process-template policies" — a third figure, matching neither.
--
-- ⛔ AND THERE IS AN ELEVENTH, OUTSIDE THE FEATURE F-AE0-4 SCOPED ITSELF TO:
--     case_referral.case_referral_delete_draft_source  (cmd=DELETE, roles={public})
-- on a Rule 12 PHI-module table. A finding that names a feature bounds its own sweep to
-- that feature; the PROPERTY ("roles contains public") does not stop at the feature edge.
-- Swept by the property here: 11 policies over 6 tables, and 0 remain afterwards.
--
-- ✅ WHY THIS IS BEHAVIOUR-PRESERVING, measured rather than assumed. Only three roles hold
-- any grant on the six tables: `authenticated`, `postgres`, `service_role`. `postgres` and
-- `service_role` both have `rolbypassrls = true`, so no RLS policy ever applies to them;
-- `anon` and `authenticator` hold NO grant on any of the six, so they cannot reach the
-- tables at all. `authenticated` is therefore the only role these policies have ever
-- actually gated, and naming it explicitly changes nothing about who passes.
--
-- ✅ WHY DO IT AT ALL, since F-AE0-4 correctly says it is "not an exposure today": the
-- containment lives ENTIRELY in the grant layer. One future `grant select on ... to anon`
-- turns a `{public}` policy into an evaluated one, and Architecture Rule 1 puts the
-- security boundary in RLS, not in the grant layer alone. This makes the role bound a
-- property the policy DECLARES instead of one the environment happens to supply.

alter policy process_template_custom_fields_select              on public.process_template_custom_fields   to authenticated;
alter policy process_template_custom_fields_staff_admin_write   on public.process_template_custom_fields   to authenticated;
alter policy process_template_narratives_select                 on public.process_template_narratives      to authenticated;
alter policy process_template_narratives_staff_admin_write      on public.process_template_narratives      to authenticated;
alter policy process_template_outcomes_select                   on public.process_template_outcomes        to authenticated;
alter policy process_template_outcomes_staff_admin_write        on public.process_template_outcomes        to authenticated;
alter policy process_template_phases_select                     on public.process_template_phases          to authenticated;
alter policy process_template_phases_staff_admin_write          on public.process_template_phases          to authenticated;
alter policy process_template_versions_select                   on public.process_template_versions        to authenticated;
alter policy process_template_versions_staff_admin_write        on public.process_template_versions        to authenticated;
alter policy case_referral_delete_draft_source                  on public.case_referral                    to authenticated;

-- Fail the migration rather than the next reader's assumption.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and 'public' = any(roles);
  if n <> 0 then
    raise exception 'expected 0 TO public policies after normalization, found %', n;
  end if;
end $$;
