-- =====================================================================================
-- AE3.2 step 4 (final) -- drop profiles.cpf / .date_of_birth / .phone.
--
-- ADR 0155 D4, plan docs/plans/authz-evolution.md "Phase AE3".
-- Ordering is load-bearing: 006600 created and BACKFILLED the destination, 006700
-- re-pointed all five SQL consumers AND removed the three arms from
-- guard_profile_privileged_columns. Only now do the columns go.
--
-- ⛔ NO `CASCADE`, DELIBERATELY. The AE3.1 census asked the authoritative question -- not
-- "does a view's TEXT name these columns" (which misses `select *`) but "does any
-- pg_rewrite entry DEPEND on them" -- and the answer was zero, on local and on the linked
-- remote. A plain DROP turns any dependency the census missed into a loud failure here.
-- `CASCADE` would silently delete whatever that dependency was, which is the same class of
-- mistake the census was built to avoid.
--
-- The CHECK (`profiles_cpf_valid`) and the partial unique index (`profiles_cpf_key`) are
-- dropped WITH their column by Postgres. Their moved counterparts on
-- profile_private_details were created in 006600 as the same statements, not re-typed
-- equivalents.
--
-- ⚠ DEPLOYMENT: past this migration a still-deployed OLD application build fails on every
-- profiles.cpf / .date_of_birth / .phone read or write -- PostgREST returns an error and
-- neither tsc, eslint nor vitest can see it, because the column list is a runtime string.
-- This migration set is applied inside the maintenance window in
-- docs/deployment/ae3-cutover-runbook.md, never ahead of the code deploy.
-- =====================================================================================

alter table public.profiles drop column cpf;
alter table public.profiles drop column date_of_birth;
alter table public.profiles drop column phone;
