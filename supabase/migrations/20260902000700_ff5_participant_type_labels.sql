-- =============================================================================
-- FF-5 (ADR 0091) — FIX: the participant sublabel leaked ENGLISH DB IDENTIFIERS
-- into a pt-BR clinical UI (Architecture Rule 10).
--
-- Both reference readers fell back to the raw `participants.participant_type`
-- when no case role was available, so an org-scoped participant rendered as
-- "UTI Adulto · department" / "Dra. Denunciada · professional", and
-- `external_person` / `regulatory_body` are worse still. Found by `frontend`
-- during the FF-5 UI build; confirmed against my own smoke-test output, which
-- had printed `department` and `professional` in plain sight and which I read
-- past.
--
-- ⚠ IT WAS THREE SITES, NOT ONE. The report named the typeahead
-- (`public.reference_candidates`). Sweeping `pg_proc` for `participant_type`
-- found the SAME fallback in `app.references_by_item` — the SIGN-OFF
-- PROJECTION — and a third copy in TypeScript (`buildReferenceAnswers` in
-- `src/lib/queries/responses.ts`, the wizard/submission rehydration). The
-- sign-off one is the worst of the three: it is the attestation surface, and it
-- renders through a different component tree than the picker, so a client-side
-- patch over the typeahead would have left it leaking. This is the standing
-- "a new door must inherit EVERY sibling arm" lesson in its documented form —
-- if the enumeration's boundary is a filename (or a bug report), it is wrong.
--
-- FIXED AT EMISSION, not in the render layer. The DB already owns every other
-- user-facing string in this feature (every HC0Q* raise is pt-BR); a display
-- string translated by whichever component happens to render it is a rule that
-- must be re-obeyed at each new call site, which is how the sign-off site would
-- have been missed a second time.
--
-- ⚠ THE VOCABULARY NOW EXISTS TWICE, ON PURPOSE, AND THAT IS A DRIFT RISK.
-- `app.participant_type_label` below is the SQL authority;
-- `PARTICIPANT_TYPE_LABELS` in `src/lib/forms/reference-constants.ts` is the TS
-- one. Two copies are structurally necessary — the builder must render labels
-- for types the user has not chosen yet, entirely client-side, while the
-- sign-off projection is DEFINER SQL — exactly as the condition evaluator is
-- mirrored SQL/TS. The mirroring rule applies with it: the seven pairs are
-- pinned by `participant-type-labels.test.ts` on the TS side, and the FF-5
-- pgTAP suite owes the identical seven `is()` assertions on this function.
-- Changing one without the other must RED, not merely be discouraged.
--
-- SQLSTATE: allocates none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · The vocabulary. IMMUTABLE (a pure value map, so it may be inlined and
--     indexed), and it FALLS BACK TO THE RAW TYPE rather than to NULL.
--
--     The fallback is the deliberate half. `participants_participant_type_check`
--     pins the seven values today, so the else-branch is unreachable; if an
--     eighth type is ever added, an unmapped value degrades to a visible English
--     identifier — ugly, reportable, and self-announcing — instead of to NULL,
--     which would silently blank the disambiguator on a picker where every
--     patient already renders the identical surrogate 'Paciente'. A blank
--     sublabel there is indistinguishable from "these two rows are the same
--     person", which is the failure the sublabel exists to prevent.
-- -----------------------------------------------------------------------------
create or replace function app.participant_type_label(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'patient'          then 'Paciente'
    when 'professional'     then 'Profissional'
    when 'external_person'  then 'Pessoa externa'
    when 'department'       then 'Setor'
    when 'institution'      then 'Instituição'
    when 'regulatory_body'  then 'Órgão regulador'
    when 'other'            then 'Outro'
    else p_type
  end;
$$;

comment on function app.participant_type_label(text) is
  'FF-5 (ADR 0091) — pt-BR display label for a participants.participant_type '
  '(Architecture Rule 10: user-facing text is pt-BR, identifiers are English). '
  'THE SQL AUTHORITY; its mirror is PARTICIPANT_TYPE_LABELS in '
  'src/lib/forms/reference-constants.ts, and the two must not drift — the TS side is '
  'pinned by participant-type-labels.test.ts. Falls back to the raw type rather than '
  'NULL so an unmapped future value is VISIBLE instead of silently blanking the '
  'patient lane''s only disambiguator.';

-- -----------------------------------------------------------------------------
-- 2 · The typeahead. Body carried over BYTE-FOR-BYTE from the live pg_proc text
--     read on 2026-07-28 (not retyped from 20260902000100), with exactly one
--     expression changed: the `coalesce` fallback on the participant lane.
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
           -- (ADR 0091 §Substrate). Org-scoped types carry their type label —
           -- TRANSLATED (Rule 10); this used to emit the raw English identifier.
           coalesce(
             (select r.display_name
              from public.case_participants cp
              join public.case_participant_roles r on r.id = cp.role_id
              where cp.participant_id = p.id
                and cp.case_id = v_case_id
                and cp.removed_at is null
              limit 1),
             app.participant_type_label(p.participant_type)
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

-- `create or replace` preserves the ACL, but restate it: this function is the
-- one INVOKER-rights surface of the phase and its grant is load-bearing.
grant execute on function public.reference_candidates(uuid, uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · The sign-off projection — THE SITE THE BUG REPORT DID NOT NAME. Same
--     single-expression change, same reasoning. A signer reading
--     "UTI Adulto · department" on an attestation screen is the Rule 10 breach
--     at its least excusable.
-- -----------------------------------------------------------------------------
create or replace function app.references_by_item(
  p_response_id uuid,
  p_instance_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(
    jsonb_object_agg(
      x.item_id::text,
      jsonb_build_object(
        'kind', x.reference_kind,
        'target_id', x.target_id,
        'label', x.label,
        'sublabel', x.sublabel
      )
    ),
    '{}'::jsonb
  )
  from (
    select
      a.item_id,
      ar.reference_kind,
      coalesce(ar.participant_id, ar.commission_id, ar.profile_id) as target_id,
      case ar.reference_kind
        when 'participant' then pt.display_name
        when 'commission'  then cm.name
        when 'user'        then pr.full_name
      end as label,
      case ar.reference_kind
        when 'participant' then coalesce(
          -- The patient disambiguator: this participant's role in the case that
          -- owns the response. Null for an org-scoped type, which falls back to
          -- the type itself — TRANSLATED (Rule 10).
          (select cpr.display_name
           from public.case_participants cp
           join public.case_participant_roles cpr on cpr.id = cp.role_id
           join public.responses r2 on r2.id = a.response_id
           join public.case_phases cph on cph.id = r2.case_phase_id
           where cp.participant_id = pt.id
             and cp.case_id = cph.case_id
             and cp.removed_at is null
           limit 1),
          app.participant_type_label(pt.participant_type)
        )
        when 'commission' then (select h.name from public.hospitals h where h.id = cm.hospital_id)
        when 'user'       then (pr.email)::text
      end as sublabel
    from public.answer_references ar
    join public.answers a on a.id = ar.answer_id
    left join public.participants pt on pt.id = ar.participant_id
    left join public.commissions  cm on cm.id = ar.commission_id
    left join public.profiles     pr on pr.id = ar.profile_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_instance_id
  ) x;
$$;
