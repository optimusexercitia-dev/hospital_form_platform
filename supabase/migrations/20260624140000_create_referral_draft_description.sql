-- Fix: create_referral_draft dropped the description.
--
-- The send-referral wizard collects a "Descrição" on its first step and passes it
-- (descriptionMd) into createReferralDraft, but create_referral_draft never accepted
-- a description parameter — so the draft was always created with description_md =
-- NULL. A referral filled with a description but NO narratives/documents then failed
-- send_referral's "needs >= 1 shared item OR a non-empty description" guard
-- ("adicione ao menos uma narrativa, documento ou descrição antes de enviar"), even
-- though the coordinator had typed a description.
--
-- Add p_description_md and persist it on insert, mirroring update_referral_draft's
-- existing description handling. The description is stored verbatim (sanitization is
-- applied at render time per Architecture Rule 7, exactly as for the draft editor).
--
-- The old 5-arg signature is DROPPED first: a CREATE OR REPLACE that merely appends a
-- DEFAULTed parameter would leave BOTH overloads in place, making a no-description
-- call ambiguous for PostgREST. Existing positional 5-arg callers (pgTAP tests) keep
-- working against the new 6-arg function via the appended DEFAULT.

DROP FUNCTION IF EXISTS "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean);

CREATE OR REPLACE FUNCTION "public"."create_referral_draft"("p_source_case_id" "uuid", "p_target_commission_id" "uuid", "p_referral_type_id" "uuid", "p_subject" "text", "p_response_expected" boolean DEFAULT NULL::boolean, "p_description_md" "text" DEFAULT NULL::"text") RETURNS "public"."case_referral"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_source_commission uuid;
  v_type public.referral_types;
  v_response_expected boolean;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select commission_id into v_source_commission from public.cases where id = p_source_case_id;
  if v_source_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  -- Authority: staff_admin of the SOURCE case's commission (same authority as
  -- close_case) OR platform admin.
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid()) or app.is_admin_for(auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;
  if v_source_commission = p_target_commission_id then
    raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.commissions where id = p_target_commission_id) then
    raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
  end if;
  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

ALTER FUNCTION "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean, "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean, "text") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean, "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_referral_draft"("uuid", "uuid", "uuid", "text", boolean, "text") TO "service_role";
