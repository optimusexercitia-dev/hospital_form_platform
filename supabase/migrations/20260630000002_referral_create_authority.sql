-- Fix: create_referral_draft rejects org admins, but the "Encaminhar caso" button
-- is shown to them — a button/RPC authority mismatch (HC071 on submit).
--
-- The multitenancy rewrite (…626000) dropped the is_admin_for() arm from
-- create_referral_draft (correct: the vendor platform_admin is not a tenant-path
-- grant, ADR 0041), narrowing the authority to staff_admin of the SOURCE commission
-- ONLY. But the case-detail capability `can_manage_lifecycle` — which gates the
-- "Encaminhar caso" button (and the close/cancel/activate/skip/reassign lifecycle
-- controls) — is `is_staff_admin_of_for(commission) OR is_org_admin_of_commission_for(
-- commission)`. So an ORG ADMIN who is not a commission-level staff_admin sees the
-- button, fills the wizard, and is rejected on submit with HC071.
--
-- Referral creation is documented to mirror close_case authority, and an org admin
-- CAN run a case's lifecycle (that is what can_manage_lifecycle grants). So the RPC
-- is too strict, not the button: broaden the authority to add the org-admin arm,
-- matching can_manage_lifecycle exactly. Platform_admin stays walled off (ADR 0041).
--
-- Body is the canonical …630000 (NSP-per-org) version VERBATIM — including the
-- cross-org guard (BUG-NSP-001) — with ONLY the authority predicate widened.

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
  -- Authority = staff_admin OR org_admin of the SOURCE commission (mirrors the
  -- can_manage_lifecycle capability that gates the "Encaminhar caso" button +
  -- close_case). …626000 correctly dropped is_admin_for (vendor platform_admin is
  -- walled off tenant paths, ADR 0041); this re-adds ONLY the org-admin arm.
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid())
          or app.is_org_admin_of_commission_for(v_source_commission, auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;
  if v_source_commission = p_target_commission_id then
    raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.commissions where id = p_target_commission_id) then
    raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
  end if;
  -- FORBID CROSS-ORG: source and target must be in the SAME organization (a referral
  -- is an intra-org, possibly cross-hospital, channel — never cross-customer PHI).
  if app.org_of_commission(v_source_commission) is distinct from app.org_of_commission(p_target_commission_id) then
    raise exception 'o encaminhamento deve permanecer dentro da mesma organização'
      using errcode = 'check_violation';
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
