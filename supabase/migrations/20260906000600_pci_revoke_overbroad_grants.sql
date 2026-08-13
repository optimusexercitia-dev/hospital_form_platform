-- PCI/M5 (process-case integrity audit, finding M5) — drop TRUNCATE / TRIGGER /
-- REFERENCES from the client roles on the process/case cluster.
--
-- Every table in the cluster granted `authenticated` the full
-- `DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE` set. Three of those
-- seven are never used by any client and two are actively dangerous:
--
--   TRUNCATE   — ⚠ **RLS DOES NOT GATE TRUNCATE.** A policy-shaped audit sees the
--                per-row predicates and concludes the table is protected; TRUNCATE
--                does not consult them at all. It is the single most consequential
--                privilege in the set and the one least visible to review.
--   TRIGGER    — lets the grantee attach a trigger function to the table, i.e.
--                execute code inside every writer's transaction, including the
--                SECURITY DEFINER RPCs.
--   REFERENCES — lets the grantee create FKs against the table, which pins rows
--                against deletion from outside the tenant boundary.
--
-- ── "UNREACHABLE" IS NOT A SECURITY PROPERTY ───────────────────────────────────
--
-- No PostgREST verb maps to TRUNCATE today, which is the argument for leaving this
-- alone. It is the same argument that made BUG-AUTHZ-001 survive review: the
-- dashboard grants were "unreachable" until five SECURITY DEFINER functions
-- reached them, through a gate RLS never evaluates. A privilege that nothing needs
-- costs nothing to remove and closes the class rather than the instance.
--
-- ── SCOPE, STATED HONESTLY ─────────────────────────────────────────────────────
--
-- ⚠ This migration revokes on the EIGHTEEN tables of the audited cluster only. The
-- same overbroad grant is the Supabase default and almost certainly holds across
-- the rest of the schema. That sweep has a much larger blast radius (it touches
-- every table's grants and wants its own full E2E run), so it is deliberately NOT
-- bundled here. Do not read this migration as "the platform no longer grants
-- TRUNCATE". The remaining offenders are enumerable with:
--
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and grantee in ('authenticated','anon')
--     and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
--   order by table_name;
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §M5 asserts the three privileges
-- are absent for both roles across all eighteen tables, and that SELECT/INSERT/
-- UPDATE/DELETE SURVIVE (a revoke that took too much would otherwise pass a
-- "privilege is gone" test while breaking every writer).

do $$
declare
  t text;
  tables constant text[] := array[
    'process_templates',
    'process_template_phases',
    'process_template_narratives',
    'process_template_outcomes',
    'process_template_custom_fields',
    'process_template_phase_allowed_results',
    'process_template_phase_offered_results',
    'cases',
    'case_phases',
    'case_narratives',
    'case_narrative_types',
    'case_narrative_revisions',
    'phase_results',
    'case_phase_allowed_results',
    'case_phase_offered_results',
    'case_outcomes',
    'case_offered_outcomes',
    'case_custom_field_values'
  ];
begin
  foreach t in array tables loop
    execute format(
      'revoke truncate, trigger, references on table public.%I from authenticated, anon',
      t
    );
  end loop;
end
$$;
