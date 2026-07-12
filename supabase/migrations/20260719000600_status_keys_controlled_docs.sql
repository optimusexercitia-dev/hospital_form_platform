-- =============================================================================
-- F-cleanup · D11 · G4 — anglicize status-enum internal keys (controlled documents):
--   #8 controlled_documents.status + controlled_document_versions.status :
--        rascunho→draft, em_aprovacao→in_approval, vigente→effective, obsoleto→obsolete
--   (both columns share the identical 4-value vocabulary; the header status mirrors
--    the current version's status.)
--
-- Internal stored keys only (NOT user-facing labels — Rule 10 pt-BR values stay).
-- Reset-OK: migrations apply to an empty DB (seed runs after) — no data backfill.
--
-- SHARED-LITERAL DISCIPLINE: em_aprovacao / vigente / obsoleto are UNIQUE to this
-- enum. `rascunho` is SHARED with case_referral (G5, still pt-BR) — verified against
-- the live catalog that the controlled-document functions and the referral functions
-- are DISJOINT sets (no function references both tables), so scoping the rewrite to
-- functions that reference controlled_document* (plus the blank-table guard
-- guard_controlled_document_status) and that do NOT reference case_referral moves the
-- ctrl-docs 'rascunho' without touching the referral 'rascunho'.
--
-- Method: explicit CHECK + default ALTERs, then a programmatic catalog rewrite over
-- normal functions (prokind='f'; pg_get_functiondef ERRORS on aggregates → fetch the
-- def INSIDE the loop). No partial indexes / views / RETURNS TABLE output columns
-- carry any G4 literal (verified against the live catalog).
-- =============================================================================

-- --- CHECK constraints + column defaults (explicit) -------------------------
alter table public.controlled_documents alter column status set default 'draft';
alter table public.controlled_documents drop constraint if exists controlled_documents_status_check;
alter table public.controlled_documents add constraint controlled_documents_status_check
  check (status = any (array['draft', 'in_approval', 'effective', 'obsolete']));

alter table public.controlled_document_versions alter column status set default 'draft';
alter table public.controlled_document_versions drop constraint if exists controlled_document_versions_status_check;
alter table public.controlled_document_versions add constraint controlled_document_versions_status_check
  check (status = any (array['draft', 'in_approval', 'effective', 'obsolete']));

-- --- Programmatic catalog rewrite — ctrl-docs function set × G4 map ----------
do $d11g4$
declare
  v_pairs text[] := array[
    'rascunho',     'draft',
    'em_aprovacao', 'in_approval',
    'vigente',      'effective',
    'obsoleto',     'obsolete'
  ];
  r record;
  v_def text;
  v_orig text;
  i int;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.prokind = 'f'      -- exclude aggregates: pg_get_functiondef raises on them
  loop
    v_def := pg_get_functiondef(r.oid);

    -- INCLUSION: references a controlled-document table, or is the blank-table guard.
    -- EXCLUSION: must NOT reference case_referral (the other 'rascunho' owner, G5).
    if ( position('controlled_document' in v_def) > 0
         or r.proname = 'guard_controlled_document_status' )
       and v_def !~ '\ycase_referral\y'
    then
      v_orig := v_def;
      i := 1;
      while i < array_length(v_pairs, 1) loop
        v_def := replace(v_def, quote_literal(v_pairs[i]), quote_literal(v_pairs[i + 1]));
        i := i + 2;
      end loop;
      if v_def <> v_orig then
        execute v_def;
      end if;
    end if;
  end loop;
end
$d11g4$;
