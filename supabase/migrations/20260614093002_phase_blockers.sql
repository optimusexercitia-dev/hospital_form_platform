-- Case data-model adjustments (3 of 4): configurable PHASE BLOCKERS (decisions
-- D1 / D4).
--
-- Replaces strict-sequential phase unlock (the activate_phase HC018 "all earlier
-- phases" count) with an explicit dependency graph: a phase declares the specific
-- EARLIER phases that block it, and is otherwise activatable anytime (multiple
-- phases may be ativa at once — parallel, D1). A blocker is satisfied when the
-- blocking phase is 'concluida' OR 'nao_necessaria' (skip unblocks, D4).
--
-- MODEL: `blocks integer[]` on BOTH process_template_phases (authored, draft-only)
-- and case_phases (snapshot at creation) — NOT a child table. It rides the SAME
-- position-renumber/snapshot machinery recommend_when uses; array membership is
-- cheap. `not null default '{}'`. A BEFORE INSERT/UPDATE trigger asserts the
-- earlier-only shape (every element in [1, position-1]); the deeper "that position
-- exists in this template" check lives in the template RPC (mirror
-- validate_template_recommend_when's split: column-level shape vs RPC-level deep
-- validity).
--
-- FUNCTIONS finalized here (their SINGLE definition):
--   * activate_phase(uuid,uuid,date) — fixed-enum terminal check (the 093001
--     landmine) + the blocker rewrite (HC018 reworded), in ONE final form.
--   * reorder_template_phase / remove_template_phase — extended to REMAP the
--     blocks arrays across the position renumber (the recommend_when renumber
--     analogue) + re-validate.
--   * add_template_phase / update_template_phase — extended with a trailing
--     p_blocks param so the slot dialog saves blocks in one round-trip.
--   * set_template_phase_blocks(uuid,integer[]) — NEW, the dedicated setter.
-- create_case_from_template is ALSO touched here (snapshot blocks) but is finalized
-- in 093003 (it also copies offered outcomes); it is ABSENT from this file.
--
-- ADDITIVE / forward-only. New overloads for add/update_template_phase DROP the
-- prior exact signatures first (091000 idiom) to avoid stale overloads. Every
-- public function created/replaced is re-revoked from anon/public (ACL hazard).
--
-- SQLSTATEs: reuses HC016 (invalid blueprint reference) for the template-side
-- blocker validation and HC018 (reworded: "blocking phases") for the case-side
-- activation gate.

-- ===========================================================================
-- Columns
-- ===========================================================================
alter table public.process_template_phases
  add column blocks integer[] not null default '{}';

alter table public.case_phases
  add column blocks integer[] not null default '{}';

-- ===========================================================================
-- app.guard_phase_blocks_shape — BEFORE INSERT/UPDATE: earlier-only shape
-- ===========================================================================
-- Generic over both tables (NEW.blocks + NEW.position are present on each).
-- Asserts: no NULL element; every element is an integer in [1, position-1] (a
-- blocker references an EARLIER phase only — no self, no forward, no zero/neg).
-- The DEEP "the referenced position actually exists" check is the template RPC's
-- job (the case snapshot is trusted, copied verbatim from a validated template).
-- SECURITY DEFINER + pinned search_path for parity with the other guards.
create function app.guard_phase_blocks_shape()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_bad integer;
begin
  if new.blocks is null then
    -- The column is NOT NULL, but be explicit: treat as empty.
    new.blocks := '{}';
    return new;
  end if;

  -- Any element that is null, < 1, or >= this row's position is illegal.
  select b into v_bad
  from unnest(new.blocks) as b
  where b is null or b < 1 or b >= new.position
  limit 1;

  if found then
    raise exception
      'um bloqueio da fase % referencia uma fase inválida (deve ser uma fase anterior)',
      new.position
      using errcode = 'HC016';
  end if;

  return new;
end;
$$;

create trigger guard_template_phase_blocks_shape_trg
  before insert or update on public.process_template_phases
  for each row execute function app.guard_phase_blocks_shape();

create trigger guard_case_phase_blocks_shape_trg
  before insert or update on public.case_phases
  for each row execute function app.guard_phase_blocks_shape();

-- ===========================================================================
-- app.validate_template_phase_blocks(template_id, position, blocks)
-- ===========================================================================
-- The DEEP validity check (mirror validate_template_recommend_when): every
-- element references a position that EXISTS in the template (and is earlier — the
-- shape trigger already guarantees earlier-only, but we re-assert defensively).
-- A null/empty array is always valid. Raises HC016. SECURITY DEFINER (reads
-- sibling slots); never writes; called only from the gated template RPCs.
create function app.validate_template_phase_blocks(
  p_template_id uuid,
  p_position integer,
  p_blocks integer[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_missing integer;
begin
  if p_blocks is null or cardinality(p_blocks) = 0 then
    return true;
  end if;

  -- Earlier-only (defensive; the column trigger also enforces it).
  select b into v_missing
  from unnest(p_blocks) as b
  where b < 1 or b >= p_position
  limit 1;
  if found then
    raise exception
      'um bloqueio da fase % deve referenciar uma fase anterior (fase informada: %)',
      p_position, v_missing
      using errcode = 'HC016';
  end if;

  -- Every referenced position must exist as a slot in this template.
  select b into v_missing
  from unnest(p_blocks) as b
  where not exists (
    select 1 from public.process_template_phases
    where template_id = p_template_id and position = b
  )
  limit 1;
  if found then
    raise exception
      'um bloqueio da fase % referencia a fase %, que não existe no processo',
      p_position, v_missing
      using errcode = 'HC016';
  end if;

  return true;
end;
$$;

revoke all on function app.validate_template_phase_blocks(uuid, integer, integer[]) from public;
grant execute on function app.validate_template_phase_blocks(uuid, integer, integer[])
  to authenticated, service_role;

-- ===========================================================================
-- set_template_phase_blocks(phase_id, blocks[]) -> phase   (draft-only)
-- ===========================================================================
-- The dedicated setter for a slot's blockers. SECURITY INVOKER — RLS
-- process_template_phases staff_admin-write is the authority. Draft-only (a
-- published template is frozen, like recommend_when edits). Validates earlier-only
-- + exists (HC016) via the helper. Gates cases_multi_phase.
create function public.set_template_phase_blocks(
  p_phase_id uuid,
  p_blocks integer[]
)
returns public.process_template_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  -- Normalise: drop nulls + dups, sort ascending (stable storage).
  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  perform app.validate_template_phase_blocks(v_template_id, v_position, v_blocks);

  update public.process_template_phases
  set blocks = v_blocks
  where id = p_phase_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.set_template_phase_blocks(uuid, integer[]) to authenticated, service_role;

-- ===========================================================================
-- add_template_phase(template, form, title, recommend_when, default_due_days,
--                    blocks) — append the blocks param
-- ===========================================================================
-- Current signature (post-091000) is (uuid,uuid,text,jsonb,integer); drop it and
-- recreate with a trailing p_blocks integer[]. All prior logic verbatim; blocks
-- stored on insert + deep-validated after the row sits at its position.
drop function if exists public.add_template_phase(uuid, uuid, text, jsonb, integer);

create function public.add_template_phase(
  p_template_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_default_due_days integer default null,
  p_blocks integer[] default '{}'
)
returns public.process_template_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_status, v_commission_id
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  -- The bound form must belong to the same commission.
  if not exists (
    select 1 from public.forms
    where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.process_template_phases
  where template_id = p_template_id;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  -- Insert first so validate_* can resolve this slot's position among siblings.
  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days, blocks)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_id, v_position, v_blocks);

  return v_result;
end;
$$;

grant execute on function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[])
  to authenticated, service_role;

-- ===========================================================================
-- update_template_phase(phase, form, title, recommend_when, clear_recommend_when,
--                       default_due_days, clear_default_due_days, blocks,
--                       clear_blocks) — append blocks (clear/replace/keep)
-- ===========================================================================
-- Current signature (post-091000) is
-- (uuid,uuid,text,jsonb,boolean,integer,boolean); drop it and recreate with the
-- trailing p_blocks + p_clear_blocks (mirrors the recommend_when / default_due_days
-- clear/replace/keep pattern). All prior logic verbatim.
drop function if exists public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean);

create function public.update_template_phase(
  p_phase_id uuid,
  p_form_id uuid default null,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_clear_recommend_when boolean default false,
  p_default_due_days integer default null,
  p_clear_default_due_days boolean default false,
  p_blocks integer[] default null,
  p_clear_blocks boolean default false
)
returns public.process_template_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_commission_id uuid;
  v_new_recommend jsonb;
  v_new_due_days integer;
  v_new_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status, t.commission_id
    into v_template_id, v_position, v_status, v_commission_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  -- Determine the final recommend_when: clear, replace, or keep.
  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- Determine the final default_due_days with the SAME clear/replace/keep logic.
  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- Determine the final blocks with clear/replace/keep (normalise on replace).
  if p_clear_blocks then
    v_new_blocks := '{}';
  elsif p_blocks is not null then
    v_new_blocks := coalesce(
      (select array_agg(distinct b order by b)
       from unnest(p_blocks) as b
       where b is not null),
      '{}');
  else
    select blocks into v_new_blocks
    from public.process_template_phases where id = p_phase_id;
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days,
      blocks = v_new_blocks
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_template_id, v_position, v_new_blocks);

  return v_result;
end;
$$;

grant execute on function public.update_template_phase(
  uuid, uuid, text, jsonb, boolean, integer, boolean, integer[], boolean)
  to authenticated, service_role;

-- ===========================================================================
-- reorder_template_phase(phase, direction) — REMAP blocks across the swap
-- ===========================================================================
-- Adjacent swap of v_position <-> v_neighbor_position. After swapping the two
-- rows' positions, every phase's blocks array must follow: an element equal to
-- the old v_position becomes v_neighbor_position and vice-versa (a value-swap
-- over the two affected positions, applied across ALL rows). Then re-validate
-- both recommend_when AND blocks (a move can make a reference point at a now-later
-- position -> HC016). This mirrors the existing recommend_when re-validate and
-- adds the blocks value-remap (the array analogue).
create or replace function public.reorder_template_phase(
  p_phase_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_neighbor_id uuid;
  v_neighbor_position integer;
  r record;
begin
  perform app.assert_cases_enabled();

  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return;  -- boundary
  end if;

  -- Swap the two positions AND value-swap the blocks references in a SINGLE
  -- UPDATE over EVERY row of the template, so the BEFORE-UPDATE shape trigger
  -- always sees a CONSISTENT row. A row's position is swapped only for the two
  -- moving slots (else it keeps its current position); its blocks have any element
  -- equal to one swapped position rewritten to the other (applied to all rows).
  -- Splitting position-swap and blocks-remap into two UPDATEs would expose a
  -- transient state (swapped position, un-swapped blocks) the shape trigger could
  -- reject as a forward reference.
  update public.process_template_phases
  set position = case id
                   when p_phase_id then v_neighbor_position
                   when v_neighbor_id then v_position
                   else position
                 end,
      blocks = (
        select coalesce(array_agg(
                 case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end
                 order by case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end), '{}')
        from unnest(blocks) as b
      )
  where template_id = v_template_id;

  -- Re-validate every recommend_when AND blocks after the renumber.
  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_id = v_template_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_template_id, r.position, r.blocks);
  end loop;
end;
$$;

grant execute on function public.reorder_template_phase(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- remove_template_phase(phase) — reject if referenced; shift blocks on the tail
-- ===========================================================================
-- Reject (HC016) when ANOTHER slot's recommend_when.from_phase OR blocks array
-- references this position (removing it would dangle the reference). After delete
-- + the tail position shift, decrement every blocks element > v_position by 1 (the
-- array analogue of the tail renumber). Then re-validate.
create or replace function public.remove_template_phase(p_phase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  r record;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  -- A later slot recommending FROM this position would dangle.
  if exists (
    select 1 from public.process_template_phases
    where template_id = v_template_id
      and recommend_when is not null
      and (recommend_when ->> 'from_phase')::integer = v_position
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a usa como condição de recomendação',
      v_position
      using errcode = 'HC016';
  end if;

  -- A slot whose blocks reference this position would dangle.
  if exists (
    select 1 from public.process_template_phases
    where template_id = v_template_id
      and blocks @> array[v_position]
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a tem como bloqueio',
      v_position
      using errcode = 'HC016';
  end if;

  delete from public.process_template_phases where id = p_phase_id;

  -- Renumber the tail AND shift the blocks references in a SINGLE UPDATE per row,
  -- so the BEFORE-UPDATE shape trigger (blocks <@ [1, position-1]) always sees a
  -- CONSISTENT row: position is decremented by one and, simultaneously, every
  -- blocks element > v_position drops by one (a block at v_position can't exist —
  -- we rejected a referenced position above). Splitting these into two UPDATEs
  -- would expose a transient state (shifted position, un-shifted blocks) that the
  -- shape trigger would reject as a forward reference.
  update public.process_template_phases
  set position = position - 1,
      blocks = (
        select coalesce(array_agg(
                 (case when b > v_position then b - 1 else b end)
                 order by (case when b > v_position then b - 1 else b end)), '{}')
        from unnest(blocks) as b
      )
  where template_id = v_template_id and position > v_position;

  -- Re-validate remaining recommend_whens AND blocks against the new numbering.
  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_id = v_template_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_template_id, r.position, r.blocks);
  end loop;
end;
$$;

grant execute on function public.remove_template_phase(uuid) to authenticated, service_role;

-- ===========================================================================
-- activate_phase(case_phase, assigned_to, due_date) — FINAL form
-- ===========================================================================
-- Single definition: the 093001 fixed-enum terminal check (HC020) + the D1/D4
-- blocker rewrite replacing the strict-sequential HC018 count. Read the phase's
-- blocks; count the case_phases at those positions whose status is NOT in
-- ('concluida','nao_necessaria'); >0 -> HC018 (reworded "blocking phases").
-- Parallel-safe: with blocks = '{}' a phase activates regardless of other phases'
-- states, and multiple phases can be ativa at once. Preserves the 3-arg signature
-- + HC019 pendente + HC021 member checks + the due_date set under app.in_case_rpc.
create or replace function public.activate_phase(
  p_case_phase_id uuid,
  p_assigned_to uuid,
  p_due_date date default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocks integer[];
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, cp.blocks, c.status, c.commission_id
    into v_case_id, v_status, v_blocks, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  -- Blocker gate (D1/D4): a phase is blocked while ANY phase it lists is not yet
  -- concluida/nao_necessaria. Empty blocks -> never blocked (parallel-friendly).
  if v_blocks is not null and cardinality(v_blocks) > 0 then
    select count(*) into v_blocking
    from public.case_phases
    where case_id = v_case_id
      and position = any(v_blocks)
      and status not in ('concluida', 'nao_necessaria');
    if v_blocking > 0 then
      raise exception 'conclua ou marque as fases que bloqueiam esta antes de ativá-la'
        using errcode = 'HC018';
    end if;
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'ativa',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.activate_phase(uuid, uuid, date) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created/replaced above
-- ===========================================================================
revoke execute on function public.set_template_phase_blocks(uuid, integer[]) from anon, public;
revoke execute on function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[]) from anon, public;
revoke execute on function public.update_template_phase(
  uuid, uuid, text, jsonb, boolean, integer, boolean, integer[], boolean) from anon, public;
revoke execute on function public.reorder_template_phase(uuid, text) from anon, public;
revoke execute on function public.remove_template_phase(uuid) from anon, public;
revoke execute on function public.activate_phase(uuid, uuid, date) from anon, public;
