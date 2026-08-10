-- Two things, both PO-ruled 2026-08-09 after `dispose_event_phi` was examined:
--   1. restore the TENANCY BACKSTOP on referral PHI disposal (partially reversing
--      `20260917000000`, deliberately and narrowly);
--   2. fix three stale pt-BR authority messages.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · THE BACKSTOP. Why this partially reverses a ruling made the same day.
--
-- BUG-QOB-004 was ruled CUT on the D5 precedent ("a principal with zero PHI bits does not
-- destroy Rule 12 data"), and executed. Examining `dispose_event_phi` afterwards produced
-- two facts that were not in front of the PO at the time:
--
--   · **A hospital can have ZERO NSP operators.** Measured on the seed: `Hospital Unico C`
--     has none, and NSP staffing is a separate onboarding step, so this is a realistic
--     production state. With referral disposal NSP-only, such a hospital has NOBODY who can
--     honour an LGPD Art. 18 erasure request — an obligation that sits with the
--     organization (the *controlador*), not with a clinical nurse.
--   · **This platform already rules the other way for acts of this shape.** ADR 0104 D11
--     keeps the tenancy arm on `revoke_printed_document` because revocation is a GOVERNANCE
--     act that REVEALS NO CONTENT, and pgTAP `314` 8.5 guards that ruling explicitly.
--     Disposal is the same shape: it discloses nothing, it destroys.
--
-- ⚠ SCOPE IS DELIBERATELY NARROW — this restores a BACKSTOP, not the old reach:
--   · `create_referral_draft` stays CUT. Composing a referral is an ordinary content act
--     with a live coordinator path; it needs no backstop and gets none.
--   · The UI wall stays. `encaminhamentos/**` still 404s a bare tenancy admin.
--   · So for a BARE tenancy admin this capability is reachable only out-of-band (a support
--     procedure, service-role, or a future admin surface) — it is an authorization
--     backstop, not a product affordance. Stated plainly because an unreachable capability
--     is exactly what BUG-QOB-004 was filed about; the difference is that this one is
--     unreachable BY DESIGN and recorded as such, rather than by accident and unnoticed.
--     A tenancy admin who is also a committee member reaches it through the normal UI.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.can_dispose_referral_phi(p_referral_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    -- ⬅ ADR 0078 A35 / M2 removed the platform-admin bypass and it stays removed.
    -- BUG-QOB-004 removed the tenancy tier; the 2026-08-09 backstop ruling RESTORED it
    -- for disposal only (never for drafting), because an unstaffed-NSP hospital would
    -- otherwise have no one able to honour an erasure request.
    --
    -- ⚠ THIS COMMENT DELIBERATELY DOES NOT SPELL THE PLATFORM-ADMIN ARM. Migration
    -- postconditions in this repo grep `prosrc`, and `prosrc` INCLUDES comments — an
    -- earlier author's self-check matched their own comment instead of an arm. `text is
    -- not truth` holds for the text you write while describing the text.
    exists (
      select 1 from public.case_referral r
      where r.id = p_referral_id
        and (
          app.is_tenancy_admin_of(r.source_commission_id)
          or app.is_pqs_operator_of(app.hospital_of_commission(r.source_commission_id))
          or app.is_pqs_operator_of(app.hospital_of_commission(r.target_commission_id))
        )
    );
$function$;

-- The destructive door. Body preserved verbatim from `20260917000000` except the authority
-- line and its message — which move together, always.
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_tenancy_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
          or app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.referral_patient where referral_id = p_referral_id;

  update public.case_referral
     set subject = v_redacted, description_md = null, decline_note = null
   where id = p_referral_id;
  update public.referral_reply set result_md = null where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;
  -- RV2 R3: the resolution narrative is PHI — purge it.
  update public.referral_resolutions set summary_md = null where referral_id = p_referral_id;
  -- RV2 R5: internal-note bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_internal_notes set body = v_redacted where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_referral_id;

  perform app.audit_write(
    'referral_patient.disposed', 'referral_patient', p_referral_id, v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · THE STALE MESSAGES.
--
-- Three doors have had an authority arm move without their pt-BR sentence moving with it.
-- One was fixed in `20260917000000`; the other two are fixed here. This is invisible to
-- every automated gate in the repo — no test reads prose — and it is user-facing, so a
-- wrong sentence either promises access a user does not have or hides access they do.
--
-- Done by TARGETED REPLACE on the live `pg_get_functiondef`, not by retyping the bodies:
-- both functions are long, and re-authoring a body to change one string is how a rebuild
-- silently loses a property it never meant to touch.
-- ─────────────────────────────────────────────────────────────────────────────
do $msg$
declare
  v_n int;
begin
  -- (a) dispose_case_phi PROMISES an org-admin arm that QO·B removed. Its only arm is
  --     `is_staff_admin_of`, so the sentence offers access nobody has.
  execute replace(
    (select pg_get_functiondef(p.oid) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = 'dispose_case_phi'),
    'apenas a coordenação da comissão ou um administrador da organização pode descartar dados do paciente',
    'apenas a coordenação da comissão pode descartar dados do paciente');

  -- (b) revoke_printed_document OMITS the tenancy arm it actually carries (ADR 0104 D11
  --     keeps it deliberately — revocation is a governance act that reveals no content).
  --     The inverse error: it hides access that exists.
  execute replace(
    (select pg_get_functiondef(p.oid) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = 'revoke_printed_document'),
    'apenas a coordenação da comissão pode anular um documento emitido',
    'apenas a coordenação da comissão ou um administrador da organização pode anular um documento emitido');

  select count(*) into v_n from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('dispose_case_phi', 'revoke_printed_document')
     and p.prosrc like '%administrador da organização%';
  raise notice 'MESSAGES: % of 2 rewritten doors now name the organizational tier', v_n;
end
$msg$;

-- ─────────────────────────────────────────────────────────────────────────────
-- POSTCONDITION — every claim asserted by NAME, on both sides.
-- ─────────────────────────────────────────────────────────────────────────────
do $post$
declare
  v_src text;
begin
  -- (1) The backstop is present on BOTH disposal doors...
  foreach v_src in array array['dispose_referral_phi', 'can_dispose_referral_phi'] loop
    if (select p.prosrc from pg_proc p
         where p.pronamespace = 'public'::regnamespace and p.proname = v_src) !~ 'is_tenancy_admin_of' then
      raise exception 'BACKSTOP postcondition: public.% did not regain the tenancy arm', v_src;
    end if;
    if (select p.prosrc from pg_proc p
         where p.pronamespace = 'public'::regnamespace and p.proname = v_src) !~ 'is_pqs_operator_of' then
      raise exception 'BACKSTOP postcondition: public.% lost its NSP arm (over-restore)', v_src;
    end if;
  end loop;

  -- (2) ...and ABSENT from drafting, which the ruling deliberately left cut. Without this
  --     the migration could quietly restore the whole pre-QOB-004 reach.
  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'create_referral_draft';
  if v_src ~ 'is_tenancy_admin_of' then
    raise exception 'BACKSTOP postcondition: create_referral_draft regained a tenancy arm — the ruling restores DISPOSAL only';
  end if;

  -- (3) dispose_event_phi is UNTOUCHED and keeps both arms (the PO KEEP ruling). Asserted
  --     here so this migration cannot be read as having swept the disposal family.
  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'dispose_event_phi';
  if v_src !~ 'is_tenancy_admin_of' or v_src !~ 'is_pqs_operator_of' then
    raise exception 'BACKSTOP postcondition: dispose_event_phi lost an arm — the 2026-08-09 ruling KEEPS both';
  end if;

  -- (4) The messages now match the arms. Both directions, by name.
  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'dispose_case_phi';
  if v_src like '%ou um administrador da organização pode descartar%' then
    raise exception 'BACKSTOP postcondition: dispose_case_phi still promises an org-admin arm it does not have';
  end if;
  if v_src !~ 'is_staff_admin_of' then
    raise exception 'BACKSTOP postcondition: dispose_case_phi lost its coordinator arm (the replace hit more than the message)';
  end if;

  select p.prosrc into v_src from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'revoke_printed_document';
  if v_src not like '%ou um administrador da organização pode anular%' then
    raise exception 'BACKSTOP postcondition: revoke_printed_document still hides the tenancy arm it carries';
  end if;
  if v_src !~ 'is_tenancy_admin_of_for' then
    raise exception 'BACKSTOP postcondition: revoke_printed_document lost its tenancy arm (ADR 0104 D11)';
  end if;

  raise notice 'BACKSTOP postcondition: OK — disposal backstop restored, drafting still cut, event untouched, messages match arms';
end
$post$;
