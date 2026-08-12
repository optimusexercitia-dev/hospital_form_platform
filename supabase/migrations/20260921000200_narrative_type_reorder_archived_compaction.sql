-- =============================================================================
-- Fix the case_narrative_types reorder ↔ archive 23505 (RDR MINOR-1's one
-- surviving site — REG·KIND / ADR 0110 deleted the `referral_note_types`
-- mirror and its reorder RPC outright, so the "ONE platform-wide fix at two
-- sites" argument (RDR plan amendment A6) no longer applies).
--
-- Substrate (live catalog, 2026-08-12 — verified in pg_constraint, not prose):
--   - archived rows KEEP their NOT NULL `position` (archive_case_narrative_type
--     only flips `archived`);
--   - `case_narrative_types_commission_position_key` is
--     UNIQUE (commission_id, position) DEFERRABLE INITIALLY IMMEDIATE — its
--     check runs at END OF STATEMENT, which shields transient duplicates among
--     the rows one UPDATE touches, but NOT a stale position held by an archived
--     row the statement never touches.
--   So: actives A(1) B(2) C(3); archive B; reorder [C, A] assigns C=1, A=2 —
--   and B still holds 2 → 23505 at statement end.
--
-- FIX (the "two-phase renumber", folded into ONE statement so the existing
-- deferrable-by-statement-end property is the only shield needed): the
-- reorder's UPDATE now renumbers the caller-ordered actives 1..N AND compacts
-- the commission's remaining archived rows to N+1.. (ordered by previous
-- position, then id). Repeated reorders are stable — archived rows re-compact
-- to the same slots, no unbounded position drift. The constraint itself is
-- untouched (no schema change).
--
-- Unchanged, deliberately: a caller that omits some ACTIVE ids from
-- p_ordered_ids can still collide with the untouched rows and fail closed with
-- 23505 — garbage in, loud refusal out. The product caller always sends the
-- full active list.
--
-- RLS note: the door is SECURITY INVOKER; the `case_narrative_types_staff_admin_write`
-- FOR ALL policy carries no archived filter (catalog-verified), so the
-- compaction arm reaches archived rows under the caller's own rights.
--
-- Keystone: pgTAP 324 (t4 observed RED with 23505 pre-fix).
-- CREATE OR REPLACE — same signature, so the ACL/owner survive; properties
-- diffed before/after as part of the change record.
-- =============================================================================

create or replace function public.reorder_case_narrative_types(
  p_commission_id uuid,
  p_ordered_ids uuid[]
) returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types d
  set position = o.ord
  from (
    -- The caller-ordered (active) list takes 1..N …
    select t.id, t.ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
    union all
    -- … and the commission's remaining ARCHIVED rows compact to N+1..
    -- (they keep a NOT NULL position but must never poison the active range —
    -- the pre-fix 23505: an archived non-last row retained its old slot).
    select ct.id,
           (cardinality(p_ordered_ids)
             + row_number() over (order by ct.position, ct.id))::integer as ord
    from public.case_narrative_types ct
    where ct.commission_id = p_commission_id
      and ct.archived
      and ct.id <> all (p_ordered_ids)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;
