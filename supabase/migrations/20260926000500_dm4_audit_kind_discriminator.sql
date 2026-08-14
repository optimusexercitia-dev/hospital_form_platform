-- =============================================================================
-- DM4 M5 — the referral.viewed STRUCTURED discriminator (ADR 0119 D10;
-- DM4-AUDIT-1 ruling, lead-routed 2026-08-14).
--
-- Two semantically different PHI accesses shared one verb, one entity and an
-- EMPTY metadata object — distinguishable only by a translatable pt-BR
-- sentence, which made exit criterion 2 ("exactly one audit row per open")
-- unassertable by anything but prose-regexing (a Rule-10 string no one knows
-- a gate depends on). The VERB stays coarse DELIBERATELY: a new verb would
-- enter the K10 read-verb registry and fragment the QPS/audit count surfaces
-- and 150's count pins. The discriminator is metadata.kind, on BOTH emitters
-- so the field is total over all new rows:
--   document_open — the byte corridor (open_referral_snapshot_document);
--                   carries the shared_item/version ids so an LGPD review can
--                   tell WHICH snapshot was opened (ids are references, never
--                   payloads — Rule 11's no-PHI-in-the-log line holds).
--   content_view  — the PHI detail-page read (get_referral_detail).
-- Historical rows predate the field (kind absent) — consumers must treat
-- absence as 'pre-DM4 row', never as a third event type.
-- Consumer sweep before this change (catalog + repo): metadata on this verb
-- was '{}' at both call sites and NO pgTAP pin, registry arm, or TS consumer
-- reads it. Pins: 340 C10c / D8c (both observed RED before this migration).
--
-- Only the two log_audit_access METADATA arguments change; both functions are
-- otherwise byte-identical CREATE OR REPLACE of the live bodies (ACLs kept).
-- =============================================================================

create or replace function public.open_referral_snapshot_document(p_shared_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_item public.referral_shared_item;
  v_referral public.case_referral;
  v_ver public.document_versions;
  v_doc public.documents;
  v_file public.file_objects;
begin
  perform app.assert_referrals_enabled();
  select * into v_item from public.referral_shared_item where id = p_shared_item_id;
  if v_item.id is null or v_item.kind <> 'document' then
    return null;                       -- absence ≡ denial
  end if;
  select * into v_referral from public.case_referral where id = v_item.referral_id;
  if v_referral.id is null then
    return null;
  end if;
  if not app.can_read_referral_phi(v_item.referral_id, auth.uid()) then
    return null;                       -- denial mints NO audit row (D11)
  end if;

  if v_item.frozen_tombstoned_at is not null or v_item.frozen_document_version_id is null then
    raise exception 'o documento deste encaminhamento não está mais disponível'
      using errcode = 'HC0DS';
  end if;

  select * into v_ver from public.document_versions
   where id = v_item.frozen_document_version_id;
  select * into v_doc from public.documents where id = v_ver.document_id;
  -- ADR 0119 D5: disposal-track fails closed; 'soft_deleted' deliberately
  -- SERVES (the frozen disclosure record outlives the source's retraction).
  if v_doc.status in ('disposal_pending', 'disposed') then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;

  select f.* into v_file
    from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = v_ver.id and vf.rendition_kind = 'source'
   order by vf.created_at desc
   limit 1;
  if v_file.id is null then
    raise exception 'arquivo ainda não disponível' using errcode = 'HC0D8';
  end if;
  if v_file.disposal_state <> 'none' then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_file.upload_state not in ('clean', 'unscanned_accepted') then
    raise exception 'arquivo indisponível para download' using errcode = 'HC0D8';
  end if;

  -- EXACTLY ONE audit row per served open (exit criterion 2), discriminated
  -- by a STRUCTURED field (ADR 0119 D10) — never by the pt-BR sentence.
  perform public.log_audit_access(
    'referral.viewed', 'referral', v_item.referral_id, v_referral.source_commission_id,
    'Documento do encaminhamento ' || coalesce(v_referral.code, '') || ' acessado',
    jsonb_build_object(
      'kind', 'document_open',
      'shared_item_id', v_item.id,
      'document_version_id', v_ver.id));

  return jsonb_build_object(
    'document_id', v_doc.id,
    'document_version_id', v_ver.id,
    'file_object_id', v_file.id,
    'title', v_doc.title,
    'mime_type', v_file.mime_type,
    'size_bytes', v_file.size_bytes,
    'sensitivity_tier', v_file.sensitivity_tier);
end;
$$;

-- get_referral_detail: ONLY the audit metadata changes (the symmetric marker).
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.get_referral_detail(uuid)'::regprocedure);
  d := replace(d,
    $old$'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);$old$,
    $new$'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado',
      jsonb_build_object('kind', 'content_view'));$new$);
  if d not like '%content_view%' then
    raise exception 'DM4 M5: the get_referral_detail metadata replace matched nothing';
  end if;
  execute d;
end $$;
