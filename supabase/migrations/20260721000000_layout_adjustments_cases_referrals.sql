-- Layout adjustments — Cases / Referrals / Meetings / Action Items
--
-- A. Cases: delete ad-hoc phases + ad-hoc narratives (coordinator, open case,
--    ad-hoc-only, never when responses exist) + the missing DELETE audit arms.
-- B. Referrals: revive the DEAD draft-delete policy, reword the send gate, and
--    close the draft read LEAK (target committee could read an UNSENT draft).
--
-- Every definition below was read from the LIVE CATALOG (pg_proc / pg_policy),
-- never from migration file text — several earlier migrations rewrite function
-- bodies programmatically, so the files are stale.
--
-- SQLSTATE allocation: the HC0D0 block is the first fully-free block (HC000–HC098,
-- HC0A0–HC0A1, HC0B0–HC0B2, HC0C0–HC0C1, HC0E0–HC0E7 are taken).
--   HC0D0 — the slot is TEMPLATE-derived (not `is_ad_hoc`) → not deletable.
--   HC0D1 — the ad-hoc phase has responses → not deletable (never cascade).
--   HC0D2 — another phase's `recommend_when` depends on this phase.

-- ===========================================================================
-- A3. Audit — the missing `deleted` arms (Rule 11: append-only; no payloads/PHI)
-- ===========================================================================
--
-- Live-catalog reality (differs from the brief): neither trigger MISLABELS a
-- delete — `audit_case_narratives_trg` is `AFTER INSERT OR UPDATE` and
-- `audit_case_phases_trg` is `AFTER UPDATE` only, so a DELETE emitted NO audit row
-- at all. That is a Rule-11 gap, not a mislabel. Widen both triggers to DELETE and
-- branch on `tg_op` FIRST (on DELETE the `new` record is unassigned — touching
-- `new.status` there would raise).
--
-- CASCADE GUARD: `cases → case_phases/case_narratives` is ON DELETE CASCADE, so a
-- case deletion fires these DELETE arms for every child AFTER the parent row is
-- gone. `commission_of_case` then returns NULL, which would push the rows onto the
-- PLATFORM audit chain (wrong chain, pure noise). When the parent case is already
-- gone the delete is a cascade and the case's own audit row covers it — skip.
-- This mirrors `app.guard_case_narrative_frozen`'s "parent gone (cascade) → allow".

create or replace function app.trg_audit_case_narratives()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_cols constant text[] := array['type_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to', 'is_ad_hoc'];
  v_comm uuid;
begin
  if tg_op = 'DELETE' then
    v_comm := app.commission_of_case(old.case_id);
    -- Parent case already gone → this is the case cascade; its own audit row
    -- covers the deletion. Emitting here would land on the platform chain.
    if v_comm is null then
      return null;
    end if;
    perform app.audit_write('case_narrative.deleted', 'case_narrative', old.id,
      v_comm,
      'Narrativa do caso excluída: ' || coalesce(old.type_label, ''),
      app.audit_diff(to_jsonb(old), null, v_cols));
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative.created', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso criada: ' || coalesce(new.type_label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative.updated', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso atualizada: ' || coalesce(new.type_label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

drop trigger if exists audit_case_narratives_trg on public.case_narratives;
create trigger audit_case_narratives_trg
  after insert or update or delete on public.case_narratives
  for each row execute function app.trg_audit_case_narratives();

create or replace function app.trg_audit_case_phases()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_comm uuid;
begin
  if tg_op = 'DELETE' then
    v_comm := app.commission_of_case(old.case_id);
    if v_comm is null then
      return null;  -- case cascade; see the note above
    end if;
    perform app.audit_write('case_phase.deleted', 'case_phase', old.id, v_comm,
      'Fase avulsa ' || old.position || ' excluída',
      app.audit_diff(to_jsonb(old), null,
        array['status', 'position', 'title', 'is_ad_hoc', 'assigned_to']));
    return null;
  end if;

  -- Unchanged UPDATE arm (the trigger stays AFTER UPDATE for status changes).
  if new.status is distinct from old.status then
    v_comm := app.commission_of_case(new.case_id);
    perform app.audit_write('case_phase.status_changed', 'case_phase', new.id, v_comm,
      'Status da fase ' || new.position || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new),
        array['status', 'position', 'result_id', 'result_override_id']));
  end if;
  return null;
end;
$$;

drop trigger if exists audit_case_phases_trg on public.case_phases;
create trigger audit_case_phases_trg
  after update or delete on public.case_phases
  for each row execute function app.trg_audit_case_phases();

-- ===========================================================================
-- A1. delete_ad_hoc_case_phase
-- ===========================================================================

create or replace function public.delete_ad_hoc_case_phase(p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_is_ad_hoc boolean;
  v_position integer;
  v_case_status text;
  v_commission uuid;
  v_responses integer;
  v_dependents integer;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.is_ad_hoc, cp.position
    into v_case_id, v_is_ad_hoc, v_position
  from public.case_phases cp where cp.id = p_phase_id;
  if v_case_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;

  select status, commission_id into v_case_status, v_commission
  from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  -- Coordinator gate. Mirrors the `case_phases_staff_admin_write` RLS policy
  -- EXACTLY — INCLUDING its ethics-recusal arm. This function is SECURITY
  -- DEFINER, so RLS never runs and this gate is the ONLY barrier; dropping
  -- `is_case_excluded` here would let a RECUSED coordinator delete phases from a
  -- case they are excluded from (the add-RPCs omit it — see the report).
  if not (
    (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission))
    and not app.is_case_excluded(v_case_id, auth.uid())
  ) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Template-derived phases are part of the process definition — never deletable.
  if not v_is_ad_hoc then
    raise exception 'apenas fases avulsas podem ser excluídas; esta fase faz parte do processo'
      using errcode = 'HC0D0';
  end if;

  -- PO decision: refuse on ANY response (any status). Never cascade — response
  -- data is never destroyed by a layout edit. (`responses.case_phase_id` is also
  -- FK NO ACTION, so a cascade is impossible anyway; this is the clean pt-BR door.)
  select count(*) into v_responses
  from public.responses r where r.case_phase_id = p_phase_id;
  if v_responses > 0 then
    raise exception 'Esta fase possui respostas e não pode ser excluída.'
      using errcode = 'HC0D1';
  end if;

  -- Beyond the brief: another phase's `recommend_when` may reference this phase by
  -- POSITION (`from_phase`). `recompute_recommendations` resolves that position to
  -- an id and silently yields no recommendation when it dangles — deleting the
  -- referenced phase would quietly break the dependent rule rather than fail.
  select count(*) into v_dependents
  from public.case_phases cp,
       lateral app.recommend_when_conditions(cp.recommend_when) cond
  where cp.case_id = v_case_id
    and cp.id <> p_phase_id
    and cp.recommend_when is not null
    and (cond ->> 'from_phase')::integer = v_position;
  if v_dependents > 0 then
    raise exception 'Outra fase depende desta fase para ser recomendada; ajuste a recomendação antes de excluir.'
      using errcode = 'HC0D2';
  end if;

  -- `app.guard_case_phase_status` blocks a direct delete of a TERMINAL phase
  -- outside the RPCs; the flag is the sanctioned door (mirrors add_ad_hoc_phase).
  perform set_config('app.in_case_rpc', 'on', true);
  delete from public.case_phases where id = p_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case_id);
end;
$$;

comment on function public.delete_ad_hoc_case_phase(uuid) is
  'Delete an AD-HOC case phase from an OPEN case (coordinator-only, recusal-aware). '
  'Refuses template-derived phases (HC0D0), phases with any response (HC0D1), and '
  'phases another phase''s recommend_when depends on (HC0D2). Never cascades responses.';

revoke all on function public.delete_ad_hoc_case_phase(uuid) from public;
grant execute on function public.delete_ad_hoc_case_phase(uuid) to authenticated, service_role;

-- ===========================================================================
-- A2. delete_ad_hoc_case_narrative
-- ===========================================================================

create or replace function public.delete_ad_hoc_case_narrative(p_narrative_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_is_ad_hoc boolean;
  v_case_status text;
  v_commission uuid;
begin
  perform app.assert_narratives_enabled();

  select cn.case_id, cn.is_ad_hoc into v_case_id, v_is_ad_hoc
  from public.case_narratives cn where cn.id = p_narrative_id;
  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;

  select status, commission_id into v_case_status, v_commission
  from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  -- Coordinator gate — mirrors `case_narratives_staff_admin_write` EXACTLY,
  -- including the recusal arm (see the note on delete_ad_hoc_case_phase).
  if not (
    (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission))
    and not app.is_case_excluded(v_case_id, auth.uid())
  ) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if not v_is_ad_hoc then
    raise exception 'apenas narrativas avulsas podem ser excluídas; esta narrativa faz parte do processo'
      using errcode = 'HC0D0';
  end if;

  -- NOTE: `add_ad_hoc_narrative` may have minted a `case_narrative_types` row for an
  -- inline new type. It is deliberately NOT garbage-collected — the types are a
  -- SHARED per-commission catalog (other narratives + the picker reference it).
  --
  -- `referral_shared_item.source_narrative_id` is FK ON DELETE SET NULL; the shared
  -- item keeps its `frozen_body_md` snapshot, so a referral's content survives the
  -- narrative's deletion (that is exactly what the frozen snapshot is for).
  perform set_config('app.in_narrative_rpc', 'on', true);
  delete from public.case_narratives where id = p_narrative_id;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

comment on function public.delete_ad_hoc_case_narrative(uuid) is
  'Delete an AD-HOC case narrative from an OPEN case (coordinator-only, recusal-aware). '
  'Refuses template-derived narratives (HC0D0). The narrative TYPE catalog row is never '
  'garbage-collected (shared per-commission vocabulary).';

revoke all on function public.delete_ad_hoc_case_narrative(uuid) from public;
grant execute on function public.delete_ad_hoc_case_narrative(uuid) to authenticated, service_role;

-- ===========================================================================
-- B4. Revive the DEAD draft-delete policy
-- ===========================================================================
--
-- `case_referral_delete_draft_source` tested `status = 'rascunho'`, but the live
-- CHECK constraint only admits draft|sent|received|accepted|rejected|in_review|
-- awaiting_information|completed|withdrawn. The predicate could NEVER match, so
-- draft deletion was impossible (empirically: a source staff_admin DELETE of a real
-- draft removed 0 rows and the draft survived). The `authenticated` DELETE grant and
-- `app.guard_referral_status` (`old.status <> 'draft'`) were already correct — the
-- policy was the sole blocker.

drop policy if exists case_referral_delete_draft_source on public.case_referral;
create policy case_referral_delete_draft_source on public.case_referral
  for delete
  using (status = 'draft' and app.can_manage_referral_source(id, auth.uid()));

-- ===========================================================================
-- B5. send_referral — reword the gate message ONLY (logic unchanged)
-- ===========================================================================
--
-- The rule `v_item_count = 0 AND description is blank → raise` is CORRECT: a
-- description ALONE suffices. Only the pt-BR text implied a narrative/document was
-- mandatory. Body reproduced verbatim from the live catalog with the single message
-- line changed.

create or replace function public.send_referral(p_referral_id uuid)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_referral public.case_referral;
  v_item_count integer;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode enviar o encaminhamento'
      using errcode = 'HC071';
  end if;
  if v_referral.status <> 'draft' then
    raise exception 'apenas rascunhos podem ser enviados' using errcode = 'HC070';
  end if;

  select count(*) into v_item_count from public.referral_shared_item where referral_id = p_referral_id;
  if v_item_count = 0 and btrim(coalesce(v_referral.description_md, '')) = '' then
    raise exception 'Informe uma descrição, ou anexe ao menos uma narrativa ou documento, antes de enviar.'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set status = 'sent', sent_at = now(), sent_by = auth.uid(), updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);

  return v_row;
end;
$$;

-- ===========================================================================
-- B6. Close the DRAFT read LEAK
-- ===========================================================================
--
-- `app.can_read_referral` / `app.can_read_referral_phi` were STATUS-BLIND: they
-- granted read to `is_member_of_for(target_commission_id)` the moment a draft was
-- minted, so a TARGET-committee staff could read an UNSENT draft (empirically
-- confirmed: 1 row). A draft is the source committee's private workspace until
-- `send_referral` flips it.
--
-- New rule: a `draft` is readable ONLY by source-commission members + PQS (ADR 0037
-- D6 makes QPS a reader of EVERY referral — preserved here at the RLS layer). Every
-- NON-draft branch is byte-for-byte the previous predicate: the only change is that
-- each TARGET-side arm is now qualified by `r.status <> 'draft'`.

create or replace function app.can_read_referral(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        -- PQS reads every referral at every status (ADR 0037 D6) — unchanged.
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        -- The SOURCE committee authors the draft and must see it on the case card.
        or app.is_member_of_for(r.source_commission_id, p_uid)
        -- The TARGET committee only once the referral has actually been SENT.
        or (r.status <> 'draft' and app.is_member_of_for(r.target_commission_id, p_uid))
      )
  );
$$;

create or replace function app.can_read_referral_phi(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or (r.status <> 'draft' and app.is_staff_admin_of_for(r.target_commission_id, p_uid))
        -- The target analyst arm was a top-level OR outside the EXISTS; folding it in
        -- keeps it identical for non-draft (a target case cannot exist for a draft
        -- anyway) while ensuring a draft never reaches the target side.
        or (r.status <> 'draft' and app.referral_target_analyst(p_referral_id, p_uid))
      )
  );
$$;

comment on function app.can_read_referral(uuid, uuid) is
  'Referral read predicate. A DRAFT is the SOURCE committee''s private workspace: '
  'source members + PQS only. Non-draft: source members, target members, PQS.';
comment on function app.can_read_referral_phi(uuid, uuid) is
  'Referral PHI read predicate (Rule 12). A DRAFT is readable by source staff_admins '
  '+ PQS only; the target side (staff_admins / analysts) only once SENT.';
