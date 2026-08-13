-- =============================================================================
-- Referrals v2 (RV2) · R5 follow-up — audit internal-note READS (Rule 11).
-- =============================================================================
-- QA MAJOR-1 (docs/reviews/rv2-r2-r5-review.md §MAJOR-1): the note body is
-- PHI-classified and served ONLY through the audited DEFINER door
-- `list_referral_internal_notes`, but that door emitted NO read audit — a Rule 11
-- gap ("every PHI read is logged — records *that* + *who*, never the payload").
-- Every OTHER PHI/foreign read on the platform rides `public.log_audit_access`
-- (allow-list) → `app._audit_access_authorized` (dispatch) → `app.audit_write`;
-- the note-read path was the sole PHI door missing from that mechanism.
--
-- FIX (mirrors the `referral_patient.read` pattern in `get_referral_patient`):
--   1. New referral-level predicate `app.can_read_referral_internal_notes` — TRUE
--      iff the caller may read at least one internal note of the referral (source
--      member at any status, OR target member once the referral is SENT). This is
--      the referral-scoped counterpart of the per-note `can_read_referral_internal_note`
--      (which stays UNTOUCHED — the K-R5-1 security keystone is unchanged). Whenever
--      a note is readable, this predicate holds → the dispatch below never spuriously
--      denies (42501) a legitimate reader.
--   2. `app._audit_access_authorized` — add the `referral.note_viewed` dispatch arm.
--   3. `public.log_audit_access` — add `referral.note_viewed` to the allow-list.
--   4. `public.list_referral_internal_notes` — emit ONE `referral.note_viewed` row
--      via the door WHEN it serves ≥1 note. Payload is PHI-FREE: `referral_id` +
--      `note_count` only (never the body/summary/redaction text); WHO is captured by
--      the audit_log.actor_id column (= auth.uid()). A cross-side / unauthorized
--      caller is served 0 notes → NO PHI is read → NO audit row is written.
--
-- Additive / forward-only (reset-OK). Behind the existing `case_referrals` flag.
-- Binding rules 1/9/10/11/12. No schema change; no new grants (the verb rides the
-- pre-existing log_audit_access DEFINER door).
-- =============================================================================

-- 1. Referral-level "may read any internal note" predicate. -------------------
-- Deliberately NO QPS arm (mirrors can_read_referral_internal_note; QPS reads
-- NEITHER side's notes) and NO admin arm (platform_admin holds no commission
-- content). is_active mirrors the per-note predicate so the two agree row-for-row.
create or replace function app.can_read_referral_internal_notes(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_uid) and exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_member_of_for(r.source_commission_id, p_uid)
        or (r.status <> 'draft' and app.is_member_of_for(r.target_commission_id, p_uid))
      )
  );
$$;

comment on function app.can_read_referral_internal_notes(uuid, uuid) is
  'RV2 R5: TRUE iff p_uid may read at least one internal note of the referral '
  '(source member any status, or target member once SENT). Referral-scoped '
  'counterpart of can_read_referral_internal_note; gates the referral.note_viewed '
  'read audit. No QPS/admin arm.';

-- 2. Dispatch: authorize the referral.note_viewed read audit. -----------------
-- Full current body (catalog truth) + the new `referral.note_viewed` arm.
create or replace function app._audit_access_authorized(p_action text, p_entity_id uuid, p_commission uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
  v_att_owner_type text;
  v_att_owner_id uuid;
begin
  if v_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  case p_action
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);
    when 'professional_profile.read' then
      return app.can_read_professional_profile(p_entity_id, v_uid);

    -- ADR 0063 F2: the entity is the attachment id; resolve its owner and gate.
    when 'attachment.read' then
      select a.owner_type, a.owner_id into v_att_owner_type, v_att_owner_id
        from public.attachments a where a.id = p_entity_id;
      return v_att_owner_type is not null
             and app.can_read_attachment(v_att_owner_type, v_att_owner_id, v_uid);

    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));

    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    -- RV2 R5 (Rule 11): the audited internal-note READ. Entity is the referral id.
    when 'referral.note_viewed' then
      return app.can_read_referral_internal_notes(p_entity_id, v_uid);

    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_commission_admin_of(v_resp_commission));

    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));

    else
      return false;
  end case;
end;
$function$;

-- 3. Allow-list: register referral.note_viewed as a permitted read verb. -------
-- Full current body (catalog truth) + the new verb.
create or replace function public.log_audit_access(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    'referral_patient.read', 'referral.viewed',
    -- RV2 R5 (Rule 11): the audited internal-note read.
    'referral.note_viewed',
    'case_patient.read',
    'professional_profile.read',
    -- ADR 0063 F2: the audited attachment PHI-blob open.
    'attachment.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$function$;

-- 4. The door emits the read audit when it serves ≥1 note. --------------------
-- Full current body (catalog truth) + the PHI-free read audit. The note-selection
-- SELECT and its per-note can_read_referral_internal_note gate are UNCHANGED
-- (K-R5-1 keystone untouched); the audit is a pure addition after the result set
-- is built, gated to a non-empty result.
create or replace function public.list_referral_internal_notes(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_count int;
  v_ref public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'referral_id', n.referral_id,
           'committee_id', n.committee_id,
           'author_user_id', n.author_user_id,
           'author_name', (select full_name from public.profiles where id = n.author_user_id),
           -- Redacted notes render [redigido] (the real body stays in the table,
           -- append-only + audited); distinct from disposal's [PHI removido].
           'body', case when n.redacted_at is not null then '[redigido]' else n.body end,
           'created_at', n.created_at,
           'redacted_at', n.redacted_at,
           'redacted_by', n.redacted_by,
           'redacted_by_name', (select full_name from public.profiles where id = n.redacted_by),
           'redacted_reason', n.redacted_reason
         ) order by n.created_at), '[]'::jsonb)
    into v_result
  from public.referral_internal_notes n
  where n.referral_id = p_referral_id
    and app.can_read_referral_internal_note(n.id, v_uid);

  -- Rule 11: a served note body is a PHI read → log THAT + WHO (never the payload).
  -- No notes served (cross-side / unauthorized reader) → nothing read → no audit.
  v_count := jsonb_array_length(v_result);
  if v_count > 0 then
    select * into v_ref from public.case_referral where id = p_referral_id;
    perform public.log_audit_access(
      'referral.note_viewed', 'referral', p_referral_id,
      v_ref.source_commission_id,
      'Leitura de ' || v_count || ' nota(s) interna(s) do encaminhamento '
        || coalesce(v_ref.code, ''),
      jsonb_build_object('referral_id', p_referral_id, 'note_count', v_count)
    );
  end if;

  return v_result;
end;
$function$;
