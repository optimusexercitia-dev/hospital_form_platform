-- ----------------------------------------------------------------------------
-- Phase 22 — column-level lockdown of the PHI-bearing free-text on case_referral
-- ----------------------------------------------------------------------------
-- Completes the PHI free-text lockdown (after 20260620015000 tightened
-- frozen_body_md / result_md). Two columns on the BROADLY-readable case_referral
-- table are PHI-bearing free text that should only ever surface via the audited
-- get_referral_detail door, never on a direct SELECT by a plain member of either
-- committee:
--   * description_md — A's cover note on the referral (sanitized Markdown).
--   * decline_note   — B's free-text rationale when declining (can carry context).
-- The detail door already gates description_md to can_read_referral_phi; this file
-- adds the matching DIRECT-read lock (the same leak we closed for the body tables)
-- by replacing the table-level SELECT grant with a COLUMN-level grant that omits
-- those two columns. INSERT/UPDATE/DELETE stay table-level (RLS-gated). The DEFINER
-- get_referral_detail (owner postgres) still reads + serves both columns to PHI
-- readers, so there is zero functional impact — the hub/list never select them.
--
-- NOTE: a column-level SELECT grant means `SELECT *` on case_referral by
-- `authenticated` now errors (it would touch the ungranted columns). Every
-- data-access read selects an EXPLICIT column list that omits description_md /
-- decline_note (verified), so nothing legitimate breaks.

REVOKE SELECT ON TABLE "public"."case_referral" FROM "authenticated";

GRANT SELECT (
  "id", "code", "source_case_id", "source_commission_id", "target_commission_id",
  "referral_type_id", "type_label", "subject", "status", "response_expected",
  "target_case_id", "has_patient", "created_by",
  "sent_at", "sent_by", "received_at", "received_by", "decided_at", "decided_by",
  "concluded_at", "concluded_by", "withdrawn_at", "withdrawn_by",
  "created_at", "updated_at"
) ON TABLE "public"."case_referral" TO "authenticated";

-- service_role keeps full table-level SELECT (it bypasses RLS and is server-only).
GRANT SELECT ON TABLE "public"."case_referral" TO "service_role";

COMMENT ON COLUMN "public"."case_referral"."description_md" IS 'PHI-bearing free-text cover note A wrote (sanitized Markdown, Rule 7). Direct SELECT is REVOKED from authenticated (column-level grant omits it); loaded ONLY via the audited get_referral_detail door, gated by can_read_referral_phi; NEVER on list/hub paths; NEVER copied into the audit log (Rule 11).';
COMMENT ON COLUMN "public"."case_referral"."decline_note" IS 'PHI-bearing free-text decline rationale B wrote. Direct SELECT is REVOKED from authenticated (column-level grant omits it); loaded ONLY via the audited get_referral_detail door, gated by can_read_referral_phi.';

-- ===========================================================================
-- get_referral_detail — gate decline_note with the bodies (it was flowing
-- unconditionally). Re-emit the function with the single-line change so a
-- metadata-only reader gets decline_note = NULL. (description_md was already gated
-- in 20260620015000; the rest of the body is unchanged.)
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
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- Originator exemption (from the body-view audit) is STRICTLY the source
  -- coordinator — NOT is_admin() (a QPS-admin is not the originator and IS audited).
  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());

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
    -- PHI-bearing free text — gated with the bodies.
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
    -- PHI-bearing free text — gated with the bodies.
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
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
