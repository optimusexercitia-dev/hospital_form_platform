-- =============================================================================
-- DM3 · M6 — the no-PHI stance for controlled documents, enforced where PHI can
-- actually be requested.
--
-- ADR 0114 D13: "PHI-tier input on a controlled document fails closed."
-- Plan §3 M6 + §8 item 4.
--
-- ⚠ THAT SENTENCE HAS NO TARGET AT THE UPLOAD DOOR, which is why this is a
-- separate migration rather than a line in M2. `begin_document_upload` DERIVES
-- the tier server-side (`case`/`interview` → phi, else standard) and never
-- accepts it from the caller, so a controlled-document upload is `standard` by
-- construction — a guard there would cover an impossible input while leaving
-- the reachable one open. `reclassify_document(p_document_id, p_target_tier)`
-- is the only caller-facing PHI-tier input in the model, and it accepts 'phi'
-- for ANY home type.
--
-- ⚠ SPLIT FROM M2 DELIBERATELY. With M2 landed and this absent, DM3·T1 is red
-- on the REAL catalog for the right reason: with a clean, bound, servable file
-- in place the call genuinely SUCCEEDS ("caught: no exception", observed
-- 2026-08-13). Merged into M2, T1 would have been born green — vacuous.
--
-- The refusal is placed EARLY, right after the tier validation and before the
-- file lookups, so it expresses the INTENT ("this document may never be PHI")
-- rather than depending on the document's current file state.
-- =============================================================================

do $rewrite$
declare src text; mutated text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'reclassify_document';

  mutated := replace(src,
$anchor$  if exists (select 1 from public.document_legal_holds h$anchor$,
$new$  -- DM3 (ADR 0114 D13): a controlled document is a NO-PHI citizen. Refused
  -- before any file state is consulted, so the stance is about the DOCUMENT,
  -- not about what happens to be attached right now.
  if p_target_tier = 'phi'
     and exists (select 1 from public.documents d
                 join public.securable_resources s on s.id = d.home_resource_id
                 where d.id = p_document_id
                   and s.resource_type = 'controlled_document') then
    raise exception 'documentos controlados não podem conter dados de paciente (PHI)'
      using errcode = 'HC0DH';
  end if;
  if exists (select 1 from public.document_legal_holds h$new$);

  -- A no-op replace would leave the door wide open while this migration reports
  -- success — the exact way a guard ships absent. Refuse instead.
  if mutated = src then
    raise exception 'M6: reclassify_document anchor drifted — refusing to ship an unguarded door';
  end if;

  execute mutated;
end $rewrite$;
