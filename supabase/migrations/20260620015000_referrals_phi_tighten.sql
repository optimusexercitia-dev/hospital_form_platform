-- ----------------------------------------------------------------------------
-- Phase 22 — tighten the PHI-bearing free-text bodies to can_read_referral_phi
-- ----------------------------------------------------------------------------
-- Forward-only refinement of the SELECT scope on the two PHI-bearing free-text
-- columns: referral_shared_item.frozen_body_md (snapshotted source-case narrative
-- text) and referral_reply.result_md (B's reply narrative). Both were reachable
-- under the BROAD can_read_referral (any member of either committee). They must
-- follow the TIGHT can_read_referral_phi (coordinators + assigned target analyst +
-- QPS), for three reasons:
--   1. Internal consistency — a snapshot DOCUMENT is already PHI-gated
--      (app.can_read_snapshot_document), so the narrative TEXT beside it must be too.
--   2. case_access integrity — the snapshot copies source-case narratives, which
--      with case_access ON are gated by can_read_case (assignees/grantees/coords).
--      can_read_referral (any member) is broader, so a plain staff member walled
--      out of the source case could read its narrative through the snapshot. Same
--      for result_md on B's side.
--   3. Decision 16 / isolation — PHI read scope is coordinators + analyst + QPS,
--      not every member of both committees.
--
-- The PHI-FREE metadata (kind, frozen_title, outcome_label, statuses, counts,
-- attachment metadata) keeps flowing to can_read_referral readers so the hub/detail
-- still render for everyone. No contract/shape change (the body fields just arrive
-- NULL for a metadata-only reader; the frontend already handles empty bodies).

-- ===========================================================================
-- 1. SELECT policies → can_read_referral_phi on the two body-bearing tables.
-- The list/detail of these rows now requires PHI entitlement. case_referral,
-- referral_reply_attachment metadata, and the hub stay on can_read_referral.
-- NOTE: get_referral_detail (DEFINER) is the metadata read path for broad readers
-- — it re-gates can_read_referral and nulls the bodies for non-PHI readers, so the
-- hub/detail still render. These table SELECT policies govern any DIRECT read.
-- ===========================================================================
DROP POLICY IF EXISTS "referral_shared_item_select_readable" ON "public"."referral_shared_item";
CREATE POLICY "referral_shared_item_select_phi" ON "public"."referral_shared_item"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral_phi"("referral_id", "auth"."uid"()));

DROP POLICY IF EXISTS "referral_reply_select_readable" ON "public"."referral_reply";
CREATE POLICY "referral_reply_select_phi" ON "public"."referral_reply"
  FOR SELECT TO "authenticated"
  USING ("app"."can_read_referral_phi"("referral_id", "auth"."uid"()));

-- ===========================================================================
-- 2. get_referral_detail — serve frozen_body_md / result_md ONLY to a
-- can_read_referral_phi reader; null them otherwise. PHI-free metadata still flows
-- to every can_read_referral reader so the detail renders for the whole committee.
-- 3. Audit refinement — referral.viewed fires when the PHI bodies are ACTUALLY
-- served to an entitled reader who is NOT the source coordinator (the originator
-- who authored the content). This INCLUDES QPS body-reads (parity with
-- get_referral_patient, which audits every entitled read). A metadata-only reader
-- (bodies nulled) does NOT trigger a body-view audit row.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."get_referral_detail"("p_referral_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  -- Broad gate: any member of either committee (or QPS) may load the metadata.
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- The "originator" exemption from the body-view audit is STRICTLY the source
  -- coordinator (the author who already holds the content). It must NOT fold in
  -- app.is_admin(): a QPS member who is also a platform admin is NOT the originator
  -- and must be audited (parity with get_referral_patient). So the exemption is
  -- is_staff_admin_of(source) only — not is_admin().
  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  -- Tight gate: coordinators + assigned target analyst + QPS read the free-text
  -- bodies (frozen narrative + reply). Everyone else gets metadata only.
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());

  -- AUDIT (Rule 11/12): a PHI-BODY read by an entitled reader who is NOT the source
  -- coordinator (the originator already holds the content). Fires for the target
  -- coordinator/analyst AND for QPS (parity with get_referral_patient). A
  -- metadata-only open writes no body-view row. Attributed to the source
  -- (provenance) commission; never any body/PHI in the metadata.
  if v_can_phi and not v_is_source_coord then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    -- description_md is PHI-bearing free text A wrote — gate it with the bodies.
    'description_md', case when v_can_phi then v_referral.description_md else null end,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    'decline_note', v_referral.decline_note,
    -- shared_items: metadata always; frozen_body_md ONLY for a PHI reader.
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        'frozen_storage_path', s.frozen_storage_path,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- reply: metadata (outcome_label/flags/attachments) always; result_md ONLY for
    -- a PHI reader.
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', case when v_can_phi then r.result_md else null end,
        'acknowledged_only', r.acknowledged_only,
        'replied_by', r.replied_by,
        'replied_by_name', (select full_name from public.profiles where id = r.replied_by),
        'replied_at', r.replied_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'referral_id', a.referral_id, 'title', a.title,
            'storage_path', a.storage_path, 'mime_type', a.mime_type,
            'size_bytes', a.size_bytes, 'uploaded_by', a.uploaded_by,
            'uploaded_by_name', (select full_name from public.profiles where id = a.uploaded_by),
            'created_at', a.created_at
          ) order by a.created_at)
          from public.referral_reply_attachment a where a.referral_id = p_referral_id
        ), '[]'::jsonb)
      ) end
      from public.referral_reply r where r.referral_id = p_referral_id
    ),
    'sent_at', v_referral.sent_at,
    'received_at', v_referral.received_at,
    'decided_at', v_referral.decided_at,
    'concluded_at', v_referral.concluded_at,
    'withdrawn_at', v_referral.withdrawn_at,
    'created_at', v_referral.created_at,
    'updated_at', v_referral.updated_at
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_referral_detail"("p_referral_id" "uuid") OWNER TO "postgres";
