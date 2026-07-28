-- =============================================================================
-- FF-5 (ADR 0091) — Entity Reference, part 2 of 7: the DOOR, the GUARD and the
-- CANDIDATE SEARCH.
--
-- Three things land here, and the split between them is the phase's whole
-- security argument:
--
--   * `app.assert_reference_answer_writable` — a DEFINER gate that must be
--     NEITHER WEAKER NOR STRONGER than the `answers` write policies it stands in
--     for. Built arm-for-arm from pg_policies, not from the sibling's source.
--   * `app.guard_reference_coherent` — a TRIGGER, so it holds on every path into
--     the table, not just the door. Tenant containment and the ADR-0091 ruling-2
--     patient case-scoping live HERE and not in the search, because a search
--     filter is a convenience and a trigger is a boundary (Rule 1: never rely on
--     the UI, and by extension never on the picker's query).
--   * `public.reference_candidates` — INVOKER-rights (ADR 0091 ruling 3). It
--     inherits participants_select / commissions_select_member_or_admin /
--     profiles_select_self_or_admin unchanged and CANNOT widen them. A DEFINER
--     search would *replace* all three (ADR 0078 A28 / 0079) and have to
--     re-derive them by hand.
--
-- SQLSTATEs allocated: HC0Q3 (feature off), HC0Q4 (not a reference item of this
-- version), HC0Q5 (target not reachable — wrong tenant, or a patient outside
-- this response's case). High-water was HC0Q2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · Extract the generic answer-row ensurer.
--
--     `app.ensure_matrix_answer_rows` was never matrix-specific — it upserts the
--     parent `answers` row for a set of items at a scope. FF-5 needs exactly the
--     same thing, and a second copy would be two bodies to keep in step. Extract
--     it, then delegate; FF-2's pgTAP proves the delegation is behaviour-preserving.
-- -----------------------------------------------------------------------------
create or replace function app.ensure_answer_rows(
  p_response_id uuid,
  p_item_ids uuid[],
  p_instance_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_instance_id is null then
    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, null, now()
    from public.form_items i
    where i.id = any (p_item_ids)
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();
  else
    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, p_instance_id, now()
    from public.form_items i
    where i.id = any (p_item_ids)
    on conflict (response_id, item_id, group_instance_id) where group_instance_id is not null
    do update set answered_at = now();
  end if;
end;
$$;

comment on function app.ensure_answer_rows(uuid, uuid[], uuid) is
  'FF-5 (ADR 0091) — upserts the parent answers row for a set of items at a scope '
  '(top level when p_instance_id is null, else that instance). Extracted verbatim from '
  'app.ensure_matrix_answer_rows, which now delegates here.';

create or replace function app.ensure_matrix_answer_rows(
  p_response_id uuid,
  p_item_ids uuid[],
  p_instance_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.ensure_answer_rows(p_response_id, p_item_ids, p_instance_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1 · The write gate.
--
--     Live `answers` write policies (pg_policies, 2026-07-28):
--       answers_write_own_draft (ALL)    : created_by = auth.uid() AND status = 'in_progress'
--       answers_insert_targeted (INSERT) : app.can_write_targeted_response(response_id, auth.uid())
--       answers_update_targeted (UPDATE) : app.can_write_targeted_response(response_id, auth.uid())
--
--     `app.can_write_targeted_response` already contains the in_progress test, so
--     the union below is arm-for-arm identical — not merely similar. Arm ORDER is
--     load-bearing for the error the caller sees, and for correctness: a targeted
--     respondent is NOT the creator, so testing ownership first would reject them
--     before the targeted arm is ever reached. That exact inversion was FF-2's QA
--     r1 blocker B-1.
-- -----------------------------------------------------------------------------
create or replace function app.assert_reference_answer_writable(p_response_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
  v_status text;
  v_uid uuid := (select auth.uid());
begin
  if not app.feature_enabled('entity_refs') then
    raise exception 'o recurso de referências não está disponível'
      using errcode = 'HC0Q3';
  end if;

  select created_by, status into v_owner, v_status
  from public.responses where id = p_response_id;

  if v_owner is null then
    raise exception 'você não pode editar esta resposta'
      using errcode = '42501';
  end if;

  -- ARM 2 first — self-contained (it re-checks in_progress itself) and reached
  -- by a caller who is deliberately not the creator.
  if app.can_write_targeted_response(p_response_id, v_uid) then
    return;
  end if;

  -- ARM 1 — the creator's own draft.
  if v_owner is distinct from v_uid then
    raise exception 'você não pode editar esta resposta'
      using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2 · The coherence trigger — ADR 0091 rulings 2 and 8.
--
--     Enforces what a CHECK cannot, because it spans tables:
--       a. the answer's item really is a `reference` item;
--       b. TENANT CONTAINMENT — the target belongs to the response's own
--          organization, on all three lanes;
--       c. the ruling-2 PATIENT NARROWING — a `patient` participant must be a
--          live `case_participants` row of the case owning this response. A
--          standalone response therefore admits no patient at all.
--
--     (c) is in the trigger and not only in the search on purpose. The search is
--     what the picker calls; the trigger is what a hand-rolled RPC call has to
--     get past. Putting the narrowing only in the search would make the picker
--     the security boundary, which is exactly what Rule 1 forbids.
-- -----------------------------------------------------------------------------
create or replace function app.guard_reference_coherent()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_item_id uuid;
  v_item_type text;
  v_response_id uuid;
  v_commission_id uuid;
  v_org_id uuid;
  v_case_id uuid;
  v_ptype text;
begin
  select a.item_id, a.response_id into v_item_id, v_response_id
  from public.answers a where a.id = new.answer_id;

  select i.item_type into v_item_type
  from public.form_items i where i.id = v_item_id;

  if v_item_type is distinct from 'reference' then
    raise exception 'esta pergunta não é um campo de referência'
      using errcode = 'HC0Q4';
  end if;

  select r.commission_id, cp.case_id
    into v_commission_id, v_case_id
  from public.responses r
  left join public.case_phases cp on cp.id = r.case_phase_id
  where r.id = v_response_id;

  v_org_id := app.org_of_commission(v_commission_id);

  -- ---- participant lane ----
  if new.reference_kind = 'participant' then
    select p.participant_type into v_ptype
    from public.participants p
    where p.id = new.participant_id and p.organization_id = v_org_id;

    if v_ptype is null then
      raise exception 'o participante referenciado não pertence a esta organização'
        using errcode = 'HC0Q5';
    end if;

    -- Ruling 2: patients are CASE-SCOPED. Every other participant_type stays
    -- org-scoped and is already satisfied by the containment test above.
    if v_ptype = 'patient' then
      if v_case_id is null then
        raise exception 'referências a pacientes só existem em respostas vinculadas a um caso'
          using errcode = 'HC0Q5';
      end if;

      if not exists (
        select 1 from public.case_participants cp
        where cp.case_id = v_case_id
          and cp.participant_id = new.participant_id
          and cp.removed_at is null
      ) then
        raise exception 'o paciente referenciado não está vinculado a este caso'
          using errcode = 'HC0Q5';
      end if;
    end if;

  -- ---- commission lane ----
  elsif new.reference_kind = 'commission' then
    if not exists (
      select 1 from public.commissions c
      where c.id = new.commission_id and c.organization_id = v_org_id
    ) then
      raise exception 'a comissão referenciada não pertence a esta organização'
        using errcode = 'HC0Q5';
    end if;

  -- ---- user lane ----
  elsif new.reference_kind = 'user' then
    if not exists (
      select 1
      from public.memberships m
      join public.commissions c on c.id = m.commission_id
      where m.principal_id = new.profile_id
        and m.commission_id is not null
        and c.organization_id = v_org_id
        and (m.expires_at is null or m.expires_at > now())
    ) then
      raise exception 'a pessoa referenciada não pertence a esta organização'
        using errcode = 'HC0Q5';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_reference_coherent on public.answer_references;
create trigger guard_reference_coherent
  before insert or update on public.answer_references
  for each row execute function app.guard_reference_coherent();

-- -----------------------------------------------------------------------------
-- 3 · The answer writer. REPLACE semantics per addressed item, scoped to the
--     instance (null = top level), mirroring app.save_matrix_answers.
--
--     Payload: { "<item_id>": "<target_uuid>" | null }. The LANE IS NOT IN THE
--     PAYLOAD — it is resolved from the item's own `config->>'referenceKind'`.
--     A caller who could name the kind could pair a commission item with a
--     participant target and rely on the XOR alone to be satisfied; deriving it
--     from the authoring config makes that unrepresentable rather than merely
--     rejected. null clears the item's reference.
-- -----------------------------------------------------------------------------
create or replace function app.save_reference_answers(
  p_response_id uuid,
  p_version_id uuid,
  p_payload jsonb,
  p_instance_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bad_item uuid;
  v_items uuid[];
begin
  if p_payload is null or p_payload = '{}'::jsonb then
    return;
  end if;

  perform app.assert_reference_answer_writable(p_response_id);

  -- Every addressed item must belong to THIS version and be a `reference`.
  select (e.key)::uuid into v_bad_item
  from jsonb_each(p_payload) e
  where not exists (
    select 1 from public.form_items i
    where i.id = (e.key)::uuid
      and i.form_version_id = p_version_id
      and i.item_type = 'reference'
  )
  limit 1;

  if v_bad_item is not null then
    raise exception 'o item % não é um campo de referência desta versão do formulário', v_bad_item
      using errcode = 'HC0Q4';
  end if;

  select array_agg((e.key)::uuid) into v_items from jsonb_each(p_payload) e;
  perform app.ensure_answer_rows(p_response_id, v_items, p_instance_id);

  -- REPLACE: clear these items' references, then write the payload's non-null
  -- targets. A null value therefore reads as "clear", with no separate arm.
  delete from public.answer_references ar
  using public.answers a
  where ar.answer_id = a.id
    and a.response_id = p_response_id
    and a.group_instance_id is not distinct from p_instance_id
    and a.item_id = any (v_items);

  insert into public.answer_references
    (answer_id, reference_kind, participant_id, commission_id, profile_id)
  select
    a.id,
    sel.kind,
    case when sel.kind = 'participant' then sel.target_id end,
    case when sel.kind = 'commission'  then sel.target_id end,
    case when sel.kind = 'user'        then sel.target_id end
  from (
    select
      (e.key)::uuid as item_id,
      (e.value #>> '{}')::uuid as target_id,
      coalesce(i.config ->> 'referenceKind', 'participant') as kind
    from jsonb_each(p_payload) e
    join public.form_items i on i.id = (e.key)::uuid
    where jsonb_typeof(e.value) <> 'null'
  ) sel
  join public.answers a
    on a.response_id = p_response_id
   and a.group_instance_id is not distinct from p_instance_id
   and a.item_id = sel.item_id;
end;
$$;

comment on function app.save_reference_answers(uuid, uuid, jsonb, uuid) is
  'FF-5 (ADR 0091) — the reference answer writer. DEFINER because answer_references is '
  'SELECT-only for `authenticated` (K9). Lane resolved from form_items.config->>''referenceKind'', '
  'never from the payload. REPLACE per item; a null value clears. Tenant containment and the '
  'ruling-2 patient case-scoping are enforced by app.guard_reference_coherent, which holds on '
  'every path into the table rather than only this one.';

-- -----------------------------------------------------------------------------
-- 4 · The candidate search — INVOKER-RIGHTS (ADR 0091 ruling 3).
--
--     NO `security definer` here, and that omission is the design. Running as
--     the caller means participants_select / commissions_select_member_or_admin /
--     profiles_select_self_or_admin apply verbatim; this function cannot return a
--     row the caller could not already select, and cannot drift from those
--     policies as they evolve. The ruling-2 patient narrowing is composed as an
--     ADDITIONAL `exists`, never as a substitute for the policy.
--
--     It reads `participants.display_name`, `commissions.name` and
--     `profiles.full_name` only. It touches NEITHER `patient_identifiers` NOR
--     `professional_profiles` — the `references_never_read_phi` keystone asserts
--     that structurally rather than trusting this sentence.
-- -----------------------------------------------------------------------------
create or replace function public.reference_candidates(
  p_response_id uuid,
  p_item_id uuid,
  p_query text default null
)
returns table (
  target_id uuid,
  label text,
  sublabel text
)
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_kind text;
  v_types text[];
  v_commission_id uuid;
  v_org_id uuid;
  v_case_id uuid;
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not app.feature_enabled('entity_refs') then
    raise exception 'o recurso de referências não está disponível'
      using errcode = 'HC0Q3';
  end if;

  -- The response drives tenancy + case scope. This SELECT is itself RLS-gated
  -- (responses_select), so a caller who cannot see the response gets no row here
  -- and falls straight into the not-found raise — no candidate enumeration for a
  -- response you cannot read.
  select r.commission_id, cp.case_id
    into v_commission_id, v_case_id
  from public.responses r
  left join public.case_phases cp on cp.id = r.case_phase_id
  where r.id = p_response_id;

  if v_commission_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_org_id := app.org_of_commission(v_commission_id);

  select coalesce(i.config ->> 'referenceKind', 'participant'),
         case
           when i.config ? 'participantTypes'
             then array(select jsonb_array_elements_text(i.config -> 'participantTypes'))
           else null
         end
    into v_kind, v_types
  from public.form_items i
  where i.id = p_item_id and i.item_type = 'reference';

  if v_kind is null then
    raise exception 'o item % não é um campo de referência', p_item_id
      using errcode = 'HC0Q4';
  end if;

  if v_kind = 'participant' then
    return query
    select p.id,
           p.display_name,
           -- The disambiguator for the case-scoped patient lane: without the
           -- role every patient renders as the identical surrogate 'Paciente'
           -- (ADR 0091 §Substrate). Org-scoped types carry their type label.
           coalesce(
             (select r.display_name
              from public.case_participants cp
              join public.case_participant_roles r on r.id = cp.role_id
              where cp.participant_id = p.id
                and cp.case_id = v_case_id
                and cp.removed_at is null
              limit 1),
             p.participant_type
           )
    from public.participants p
    where p.organization_id = v_org_id
      and (v_types is null or p.participant_type = any (v_types))
      and (v_q is null or p.display_name ilike '%' || v_q || '%')
      -- Ruling 2: patients are case-scoped; every other type is org-scoped.
      and (
        p.participant_type <> 'patient'
        or (
          v_case_id is not null
          and exists (
            select 1 from public.case_participants cp
            where cp.case_id = v_case_id
              and cp.participant_id = p.id
              and cp.removed_at is null
          )
        )
      )
    order by p.display_name
    limit 50;

  elsif v_kind = 'commission' then
    return query
    select c.id, c.name, h.name
    from public.commissions c
    left join public.hospitals h on h.id = c.hospital_id
    where c.organization_id = v_org_id
      and (v_q is null or c.name ilike '%' || v_q || '%')
    order by c.name
    limit 50;

  elsif v_kind = 'user' then
    return query
    select pr.id, pr.full_name, (pr.email)::text
    from public.profiles pr
    where pr.is_active
      and exists (
        select 1
        from public.memberships m
        join public.commissions c on c.id = m.commission_id
        where m.principal_id = pr.id
          and m.commission_id is not null
          and c.organization_id = v_org_id
          and (m.expires_at is null or m.expires_at > now())
      )
      and (v_q is null or pr.full_name ilike '%' || v_q || '%')
    order by pr.full_name
    limit 50;
  end if;
end;
$$;

comment on function public.reference_candidates(uuid, uuid, text) is
  'FF-5 (ADR 0091 ruling 3) — typeahead candidates for a reference item. INVOKER-RIGHTS BY '
  'DESIGN: it inherits participants_select / commissions_select_member_or_admin / '
  'profiles_select_self_or_admin and cannot widen them. Reads only display_name / name / '
  'full_name — never patient_identifiers or professional_profiles, so no PHI read and no '
  'audit door (ADR 0091 ruling 1). The ruling-2 patient case-scoping is an additional '
  'narrowing here AND a hard boundary in app.guard_reference_coherent.';

grant execute on function public.reference_candidates(uuid, uuid, text) to authenticated;
