-- B1 blocker (qa) — a LOCKED source must not be served as a PRÉVIA.
--
-- ADR 0125 D5's fourth cell has TWO directions and only one was enforced:
--   FINAL + prévia footer   -> blocked by `documentProvenance` (a type narrowing)
--   REGISTERING source + prévia footer -> blocked NOWHERE
--
-- Measured: `GET /api/previa/meeting/<in_signature id>` served a PDF footed
-- "PRÉVIA — sem valor de registro, não verificável" for a source that REGISTERS
-- under D1. The page derives the affordance correctly; the DOOR did not — which
-- is Architecture Rule 1 (never rely on UI hiding), and the same class as HC0DP.
--
-- ⭐ WHY THE GUARD IN `provenance.ts` DOES NOT COVER THIS. It refuses only when
-- `watermark !== 'draft'`, and `meetingWatermarkFor('in_signature') = 'draft'` —
-- an in_signature ata registers while still stamped RASCUNHO (D1's separating
-- case). So D5's stated mechanism, *"a locked source always registers"*, held for
-- `form_response` ONLY because 0125 Amendment 2 made its two axes re-coincide.
-- That is EXPLOITING the coincidence both ADRs say must be recorded and not
-- exploited — right conclusion, wrong mechanism, in shipped code.
--
-- ⛔ THE FIX BELONGS HERE, NOT IN THE ROUTE. The route's `render -> LOG -> stream`
-- ordering makes this door the boundary: a refusal at log time means NO BYTES
-- LEAVE. A route-side check is a nicer error message, never the enforcement.
do $patch$
declare v_src text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'log_document_previa';
  if v_src is null then raise exception 'log_document_previa not found'; end if;

  v_new := replace(v_src,
    E'  -- Commission scoping for the audit row, per kind.',
    E'  -- ⛔ A LOCKED SOURCE IS NOT PREVIEWABLE (ADR 0125 D5, the other direction).'
    || E'\n  -- The registering half of the fourth cell: a source that REGISTERS must be'
    || E'\n  -- EMITTED, never served under a footer that disclaims it. Enforced HERE'
    || E'\n  -- because the route logs BEFORE it streams, so a raise means no bytes leave.'
    || E'\n  -- ⚠ Kind-agnostic: one call to the dispatch, no per-kind site.'
    || E'\n  if app.print_source_registers(p_source_kind, p_source_id) then'
    || E'\n    raise exception'
    || E'\n      ''este registro já está travado; emita o documento em vez de gerar uma prévia'''
    || E'\n      using errcode = ''HC0DV'';'
    || E'\n  end if;'
    || E'\n'
    || E'\n  -- Commission scoping for the audit row, per kind.');
  if v_new = v_src then raise exception 'PATCH ANCHOR MISSED: registration term'; end if;
  execute v_new;
  raise notice 'log_document_previa: locked-source refusal (HC0DV) installed.';
end $patch$;

do $verify$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'log_document_previa'
       and p.prosrc like '%if app.print_source_registers(p_source_kind, p_source_id) then%') then
    raise exception 'PREVIA GATE MISSING: log_document_previa does not refuse a registering source';
  end if;
  if has_function_privilege('public', 'public.log_document_previa(text,uuid,text)', 'execute') then
    raise exception 'ACL REGRESSION: log_document_previa is PUBLIC-executable';
  end if;
  raise notice 'B1 verified from the catalog: prévia refuses a registering source; ACL intact.';
end $verify$;
