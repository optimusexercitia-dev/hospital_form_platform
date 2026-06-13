-- Phase 6 / M13: sign-off RPCs.
--
-- Three entry points back the sign-off feature. The WRITE path reuses the
-- existing signoffs_insert RLS (Phase 1, migration 100006): that policy already
-- enforces the signer-role rule (respondent -> response creator; staff_admin ->
-- is_staff_admin_of), signed_by = auth.uid(), the response is in_progress, and
-- the section requires_signoff. We do NOT broaden any policy here.
--
--   * sign_section          — SECURITY INVOKER. The insert runs under
--                             signoffs_insert (RLS is the authority for WHO may
--                             sign). The RPC ADDS the precondition RLS cannot
--                             cheaply evaluate (Architecture Rule 4): the section
--                             must be VISIBLE under the response's saved answers.
--                             Backs BOTH the respondent (wizard) and the
--                             staff_admin (queue) sign. unique(response_id,
--                             section_id) race -> discriminated SQLSTATE P0015.
--
--   * list_signoff_queue    — SECURITY DEFINER, internally gated by
--                             is_staff_admin_of. The staff_admin "pendentes de
--                             assinatura" queue: in_progress responses with >=1
--                             VISIBLE, unsigned, staff_admin-role sign-off
--                             section AND otherwise submit-ready (all required
--                             answers in visible sections present).
--
--   * get_response_for_signoff — SECURITY DEFINER. The NARROW staff_admin read
--                             path for the review-to-sign screen: the saved
--                             answers + sign-off rows + respondent identity of an
--                             in_progress response, ONLY when the caller is a
--                             staff_admin of the commission AND the response has a
--                             pending (visible + unsigned) staff_admin sign-off
--                             section. A DELIBERATE, documented exception to "a
--                             staff_admin cannot read another member's
--                             in_progress answers" — scoped to the act of signing.
--                             See docs/decisions/0016-signoff-definer-read-path.md.
--
-- Custom SQLSTATEs (user-defined class), continuing the submit_response family:
--   P0014 section_not_visible   — sign_section: the section is hidden under the
--                                 response's saved answers.
--   P0015 already_signed        — sign_section: the (response, section) is signed.
-- (submit_response keeps P0010/P0011/P0012; save_section_answers uses P0013.)

-- ---------------------------------------------------------------------------
-- app.response_required_complete(response_id) -> boolean
-- ---------------------------------------------------------------------------
-- True when every required input item in every VISIBLE section of the response's
-- version has a non-null answer. This is the same submit-readiness predicate
-- submit_response (M5) walks, single-sourced here so the sign-off queue and
-- submission never drift. SECURITY DEFINER so it can read structure + answers
-- regardless of the caller's RLS (it is only invoked from already-gated definer
-- RPCs and from server checks). Mirrors submit_response's visibility +
-- required-answer logic exactly (minus the mutation / stray-cleanup).
create function app.response_required_complete(p_response_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_answers jsonb;
  r_section record;
  v_missing integer;
begin
  select form_version_id into v_version_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    return false;
  end if;

  v_answers := app.answer_map(p_response_id);

  for r_section in
    select s.id, s.visible_when
    from public.form_sections s
    where s.form_version_id = v_version_id
    order by s.position
  loop
    -- Hidden sections require nothing.
    if not app.eval_condition(r_section.visible_when, v_answers) then
      continue;
    end if;

    select count(*) into v_missing
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      and not exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = i.id
          and a.value is not null
          and a.value <> 'null'::jsonb
      );

    if v_missing > 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function app.response_required_complete(uuid) from public;
grant execute on function app.response_required_complete(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.signoff_target(response_id, section_id) -> (status, version_id,
--                                                 requires_signoff, visible_when)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER metadata read for sign_section's pre-insert guards. Needed
-- because responses_select hides another member's in_progress response from a
-- staff_admin (the legitimate counter-signer), so an invoker SELECT inside
-- sign_section would wrongly read "not found". This grants no write right — it
-- only drives the friendly pt-BR guards + the visibility precondition; the
-- INSERT's WITH CHECK (signoffs_insert) remains the sole authority for WHO may
-- sign. Returns NULLs (no row) when the response/section pairing does not exist.
create function app.signoff_target(p_response_id uuid, p_section_id uuid)
returns table (
  status text,
  version_id uuid,
  requires_signoff boolean,
  visible_when jsonb
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select r.status, r.form_version_id, s.requires_signoff, s.visible_when
  from public.responses r
  left join public.form_sections s
    on s.id = p_section_id
   and s.form_version_id = r.form_version_id
  where r.id = p_response_id;
$$;

revoke all on function app.signoff_target(uuid, uuid) from public;
grant execute on function app.signoff_target(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- sign_section(response_id, section_id, note)
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: the INSERT runs under signoffs_insert, so RLS remains the
-- authority for WHO may sign (respondent -> creator; staff_admin ->
-- is_staff_admin_of; signed_by = auth.uid(); in_progress). The signer-role rule
-- is NOT branched in this RPC.
--
-- The PRE-INSERT guards read the response + section metadata through the
-- SECURITY DEFINER helper app.signoff_target (responses_select hides another
-- member's in_progress response from a staff_admin, so an invoker SELECT here
-- would wrongly read "not found" for the legitimate staff_admin counter-signer).
-- That read grants no write right; the INSERT's WITH CHECK (signoffs_insert)
-- remains the sole authority for WHO may sign.
create function public.sign_section(
  p_response_id uuid,
  p_section_id uuid,
  p_note text default null
)
returns public.response_section_signoffs
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_version_id uuid;
  v_requires_signoff boolean;
  v_visible_when jsonb;
  v_found boolean := false;
  v_answers jsonb;
  v_result public.response_section_signoffs;
begin
  -- Definer-rights metadata read (see header). No row -> response not found.
  for v_status, v_version_id, v_requires_signoff, v_visible_when in
    select t.status, t.version_id, t.requires_signoff, t.visible_when
    from app.signoff_target(p_response_id, p_section_id) t
  loop
    v_found := true;
  end loop;

  if not v_found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser assinada'
      using errcode = 'check_violation';
  end if;

  -- requires_signoff null means the section does not belong to this response's
  -- version (the LEFT JOIN found no matching section).
  if v_requires_signoff is null then
    raise exception 'seção % não pertence a esta resposta', p_section_id
      using errcode = 'check_violation';
  end if;

  if not v_requires_signoff then
    raise exception 'esta seção não exige assinatura'
      using errcode = 'check_violation';
  end if;

  -- Visibility precondition (Architecture Rule 4): a section hidden under the
  -- response's saved answers collects no sign-off. RLS cannot cheaply evaluate
  -- this (it would have to read answers from within a signoffs policy), so the
  -- RPC owns it.
  v_answers := app.answer_map(p_response_id);
  if not app.eval_condition(v_visible_when, v_answers) then
    raise exception 'esta seção não está disponível para assinatura'
      using errcode = 'P0014';
  end if;

  -- The insert is the authority for WHO may sign (signoffs_insert WITH CHECK:
  -- respondent -> creator, staff_admin -> is_staff_admin_of, signed_by =
  -- auth.uid(), in_progress). The unique(response_id, section_id) index turns a
  -- double-sign race into a discriminated "already signed".
  begin
    insert into public.response_section_signoffs (response_id, section_id, signed_by, note)
    values (p_response_id, p_section_id, auth.uid(), nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'esta seção já foi assinada'
        using errcode = 'P0015';
  end;

  return v_result;
end;
$$;

grant execute on function public.sign_section(uuid, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- list_signoff_queue(commission_id) -> setof rows
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, internally gated. Returns each in_progress response in the
-- commission that is awaiting a staff_admin signature: it has >=1 VISIBLE,
-- unsigned, staff_admin-role requires_signoff section AND is otherwise
-- submit-ready (all required answers in visible sections present, via
-- app.response_required_complete) so half-filled drafts do not surface. One row
-- per response; the first pending section (by position) is reported, with a
-- pending_count for the rest. See ADR 0016 for the predicate rationale.
create function public.list_signoff_queue(p_commission_id uuid)
returns table (
  response_id uuid,
  form_id uuid,
  form_title text,
  version_number integer,
  respondent_id uuid,
  respondent_name text,
  section_id uuid,
  section_title text,
  pending_count integer,
  started_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Internal gate: non-staff_admins get an empty set (no leak, no error).
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  with candidate as (
    select r.id,
           r.form_version_id,
           r.created_by,
           r.started_at,
           r.updated_at,
           app.answer_map(r.id) as answers
    from public.responses r
    where r.commission_id = p_commission_id
      and r.status = 'in_progress'
  ),
  pending_sections as (
    -- Visible, unsigned, staff_admin-role sign-off sections of each candidate.
    select c.id as response_id,
           s.id as section_id,
           s.title as section_title,
           s.position
    from candidate c
    join public.form_sections s
      on s.form_version_id = c.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, c.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = c.id
          and so.section_id = s.id
      )
  ),
  ranked as (
    -- One representative pending section per response (lowest position) + count.
    select ps.response_id,
           ps.section_id,
           ps.section_title,
           count(*) over (partition by ps.response_id) as pending_count,
           row_number() over (partition by ps.response_id order by ps.position) as rn
    from pending_sections ps
  )
  select c.id,
         fv.form_id,
         f.title,
         fv.version_number,
         c.created_by,
         p.full_name,
         rk.section_id,
         rk.section_title,
         rk.pending_count::integer,
         c.started_at,
         c.updated_at
  from candidate c
  join ranked rk on rk.response_id = c.id and rk.rn = 1
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  join public.profiles p on p.id = c.created_by
  -- Submit-readiness: don't surface drafts that can't be submitted even once
  -- the staff_admin signs (missing required answers in visible sections).
  where app.response_required_complete(c.id)
  order by c.updated_at desc;
end;
$$;

grant execute on function public.list_signoff_queue(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_response_for_signoff(response_id) -> jsonb
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER. The narrow staff_admin read path for the review-to-sign
-- screen. Returns the in_progress response's saved answers (by question_key and
-- by item_id), its sign-off rows (with signer names), and the respondent's
-- identity — ONLY when the caller is a staff_admin of the response's commission
-- AND the response has a pending (visible + unsigned) staff_admin sign-off
-- section. Otherwise raises no_data_found (no data, no leak). Deliberately
-- returns NO version tree: the frontend composes this with the member-readable
-- getVersionTree, keeping this definer surface minimal. ADR 0016.
create function public.get_response_for_signoff(p_response_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_response public.responses;
  v_answers jsonb;
  v_has_pending boolean;
  v_result jsonb;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  -- Gate 1: exists + in_progress.
  if v_response.id is null or v_response.status <> 'in_progress' then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Gate 2: caller is a staff_admin of the response's commission.
  if not app.is_staff_admin_of(v_response.commission_id) then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_answers := app.answer_map(p_response_id);

  -- Gate 3: there is a pending (visible + unsigned) staff_admin sign-off
  -- section. The read right is scoped to the act of signing — no pending
  -- staff_admin section means no definer read.
  select exists (
    select 1
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
      and s.requires_signoff = true
      and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = s.id
      )
  ) into v_has_pending;

  if not v_has_pending then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'response_id', v_response.id,
    'form_version_id', v_response.form_version_id,
    'commission_id', v_response.commission_id,
    'status', v_response.status,
    'form_id', (select fv.form_id from public.form_versions fv where fv.id = v_response.form_version_id),
    'form_title', (
      select f.title from public.forms f
      join public.form_versions fv on fv.form_id = f.id
      where fv.id = v_response.form_version_id),
    'respondent_id', v_response.created_by,
    'respondent_name', (select full_name from public.profiles where id = v_response.created_by),
    'started_at', v_response.started_at,
    'updated_at', v_response.updated_at,
    'answers', v_answers,
    'answers_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.value)
       from public.answers a
       where a.response_id = p_response_id and a.value is not null),
      '{}'::jsonb),
    'signoffs', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'section_id', so.section_id,
          'signed_by', so.signed_by,
          'signed_by_name', sp.full_name,
          'signed_at', so.signed_at,
          'note', so.note
        ) order by so.signed_at)
       from public.response_section_signoffs so
       join public.profiles sp on sp.id = so.signed_by
       where so.response_id = p_response_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_response_for_signoff(uuid) to authenticated, service_role;
