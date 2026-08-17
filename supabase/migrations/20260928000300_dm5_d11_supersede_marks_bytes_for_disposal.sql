-- ADR 0121 D3 + D5 — the D11 INFLOW: superseding a print marks its BYTES for disposal.
-- Closes FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES.
--
-- ── The gap, measured from the live catalog ─────────────────────────────────
--
-- `public.mint_printed_document` is the ONLY writer of `printed_documents.superseded_at`
-- (verified by scanning every `prosrc` for the column, not by reading migrations). When a
-- new print supersedes an old one it flips the REGISTRY row to 'superseded' — and does
-- nothing whatever to the PDF. The chain
--   printed_documents.document_version_id -> document_version_files -> file_objects
-- keeps `disposal_state = 'none'` forever, so nothing can ever retire those bytes.
--
-- ⚠ ADR 0121 D1 is why this migration is not shippable alone: an inflow with no outflow
-- converts silent retention into a growing pile of `disposal_pending` rows nothing clears,
-- while D11 reads as honoured. The outflow ships in the same gate.
--
-- ── D3: why a NEW reason category and not `duplicate` ───────────────────────
--
-- The live CHECK admits {retention_expired, subject_request, entered_in_error, duplicate,
-- other}. `duplicate` is the trap: its exemption lane in `complete_document_disposal`
-- requires EVIDENCE — a live, servable, same-`sha256` sibling bound to the SAME document.
-- Under ADR 0120 D13 a print mints its version on its OWN `documents` row, so a superseded
-- print's replacement is a DIFFERENT document and that sibling probe finds nothing.
-- Marking these `duplicate` would fail the exemption silently and, under a provisional
-- retention policy, block the disposal with HC0DR while claiming a lane it never had.
--
-- ── D5: a superseded print under provisional retention stays BLOCKED ────────
--
-- Stated so it is not later rediscovered as a bug. This migration MARKS; it grants no
-- exemption. A marked file under a provisional `document_retention` row still raises
-- HC0DR at completion until ratification. That is the intended behaviour.
--
-- ── The legal-hold interaction, which the trigger would otherwise turn into an outage ──
--
-- ⭐ `app.guard_file_object_transition` permits none -> disposal_pending, but RAISES
-- ('descarte bloqueado por retenção legal ativa') when any unreleased
-- `document_legal_holds` row covers the object. That exception would abort the whole
-- `mint_printed_document` transaction — i.e. **placing a legal hold on an old print would
-- make it impossible to issue a new one.** A hold must freeze bytes, never block issuing
-- a fresh document. So the marking below EXCLUDES held objects in its own WHERE clause
-- rather than letting the trigger fire: a held print is simply left `none` (retained,
-- which is exactly what a hold means) and the mint proceeds.
-- Found by reading the trigger body before writing the UPDATE, not by hitting it in a test.

-- ── 1 · D3 — widen the reason vocabulary FIRST, or the function below cannot write it ──
alter table public.file_objects
  drop constraint if exists file_objects_disposal_reason_check;

alter table public.file_objects
  add constraint file_objects_disposal_reason_check
  check (
    disposal_reason_category is null
    or disposal_reason_category = any (array[
      'retention_expired', 'subject_request', 'entered_in_error',
      'duplicate', 'superseded', 'other'
    ])
  );

-- ── 2 · Targeted replace of the supersession block ──────────────────────────
--
-- ⛔ The migration FILE text for this function is stale by design — several DM5
-- migrations rewrite bodies at runtime via pg_get_functiondef() + replace(). The live
-- catalog is the only truth, so this reads the body, asserts the anchor is UNIQUE,
-- rewrites, and verifies. Never a CREATE OR REPLACE pasted from a file.
do $mig$
declare
  v_src     text;
  v_new     text;
  v_anchor  constant text :=
    '  update public.printed_documents' || E'\n' ||
    '     set status = ''superseded'', superseded_at = now()' || E'\n' ||
    '   where source_kind = p_source_kind' || E'\n' ||
    '     and source_id = p_source_id' || E'\n' ||
    '     and template_key = p_template_key' || E'\n' ||
    '     and status = ''active'';';
  v_replacement constant text :=
    '  -- ADR 0121 D3/D5 (D11 INFLOW): supersession also marks the old print''s BYTES.' || E'\n' ||
    '  -- Held objects are EXCLUDED here on purpose — guard_file_object_transition would' || E'\n' ||
    '  -- raise on them and abort this whole mint, making a legal hold on an old print' || E'\n' ||
    '  -- block issuing a new one. A held print stays ''none'' = retained.' || E'\n' ||
    '  with superseded as (' || E'\n' ||
    '    update public.printed_documents' || E'\n' ||
    '       set status = ''superseded'', superseded_at = now()' || E'\n' ||
    '     where source_kind = p_source_kind' || E'\n' ||
    '       and source_id = p_source_id' || E'\n' ||
    '       and template_key = p_template_key' || E'\n' ||
    '       and status = ''active''' || E'\n' ||
    '    returning document_version_id' || E'\n' ||
    '  )' || E'\n' ||
    '  update public.file_objects f' || E'\n' ||
    '     set disposal_state = ''disposal_pending'',' || E'\n' ||
    '         disposal_reason_category = ''superseded''' || E'\n' ||
    '    from public.document_version_files vf' || E'\n' ||
    '   where vf.file_object_id = f.id' || E'\n' ||
    '     and vf.document_version_id in (select document_version_id from superseded)' || E'\n' ||
    '     and f.disposal_state = ''none''' || E'\n' ||
    '     and not exists (' || E'\n' ||
    '       select 1' || E'\n' ||
    '         from public.document_version_files dvf2' || E'\n' ||
    '         join public.document_versions dv2 on dv2.id = dvf2.document_version_id' || E'\n' ||
    '         join public.document_legal_holds h on h.document_id = dv2.document_id' || E'\n' ||
    '        where dvf2.file_object_id = f.id and h.released_at is null' || E'\n' ||
    '     );';
  v_acl_before text;
  v_acl_after  text;
begin
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl, ' ; '), '(default)')
    into v_src, v_acl_before
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mint_printed_document';

  if v_src is null then
    raise exception 'D11 inflow: public.mint_printed_document not found in the live catalog';
  end if;

  -- Idempotence: already carrying the inflow, nothing to do.
  if position('D11 INFLOW' in v_src) > 0 then
    raise notice 'D11 inflow already present in mint_printed_document — skipping';
    return;
  end if;

  -- The anchor must occur EXACTLY once. A 0 means the body moved out from under this
  -- migration; a 2 means the replace would hit a site nobody reviewed.
  if (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception
      'D11 inflow: supersession anchor occurs % time(s) in mint_printed_document, expected exactly 1',
      (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
  end if;

  v_new := replace(v_src, v_anchor, v_replacement);
  execute v_new;

  -- Verify the rewrite actually landed in the CATALOG, not merely in a local variable.
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl, ' ; '), '(default)')
    into v_src, v_acl_after
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mint_printed_document';

  if position('D11 INFLOW' in v_src) = 0
     or position('disposal_pending' in v_src) = 0 then
    raise exception 'D11 inflow: post-replace body does not contain the marking — rewrite failed silently';
  end if;

  -- A CREATE OR REPLACE preserves the ACL, but a rebuild that lost it would fail OPEN
  -- and no test would notice. Diff it from the catalog rather than trusting the idiom.
  if v_acl_before is distinct from v_acl_after then
    raise exception 'D11 inflow: mint_printed_document ACL changed (% -> %)', v_acl_before, v_acl_after;
  end if;
end $mig$;
