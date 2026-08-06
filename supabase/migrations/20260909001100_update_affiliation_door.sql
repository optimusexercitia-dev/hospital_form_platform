-- AFF W3 / T3.3 — `update_affiliation`: the EXPLICIT edit path for an existing
-- employment (matrícula + start date), with its own audit emission.
--
-- ADR 0097 D14 + ADR 0098 §W3.4. T3.3 asks for a hospital admin to edit their own
-- hospital's affiliation rows — matrícula, dates, end. `end` is `end_affiliation`
-- (with the D5 seat refusals); this is the other two.
--
-- ⚠ WHY THIS IS A NEW DOOR AND NOT A WIDER `affiliate_person`. Two structural reasons,
-- and the second is the one that decided it:
--
--  1. `affiliate_person` is the idempotent CREATE door. A create door that quietly
--     acquires a date-mutation capability is how doors grow undeclared powers — the
--     census and the dominance grid both reason about a door's stated purpose.
--  2. **The audit trigger emitted `affiliation.created` / `affiliation.ended` ONLY.**
--     A date change routed through the create door would therefore have been an
--     UNAUDITED mutation, which Rule 11 forbids outright. This migration adds the
--     `affiliation.updated` arm that makes the capability recordable at all — and that
--     arm also closes a gap the create door already had: its matrícula refresh on an
--     existing row was itself an unaudited mutation.
--
-- Authority is IDENTICAL to the other affiliation doors and lives entirely in the
-- kernel: `is_org_admin_of_for(org) OR is_hospital_admin_of_for(hospital)`. So "their
-- own hospital's rows and nothing else" needs no new arm — a hospital admin simply
-- cannot name a hospital they do not administer.
--
-- Shape mirrors the existing pair exactly: owner-only kernel, `auth.uid()` wrapper for
-- `authenticated`, explicit-actor twin for `service_role` only.

create or replace function app.update_affiliation_impl(
  p_actor       uuid,
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null,
  p_clear_employee_id boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org      uuid;
  v_id       uuid;
  v_ended    date;
  v_emp      text := nullif(btrim(coalesce(p_employee_id, '')), '');
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;

  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select id, ended_on into v_id, v_ended
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital and ended_on is null;

  if v_id is null then
    -- Not an existence oracle: the caller has already proven authority OVER THIS
    -- HOSPITAL. Same code and same reasoning as `end_affiliation`.
    raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
  end if;

  -- A start date cannot be moved past an end date. Active rows have `ended_on IS NULL`
  -- so this cannot fire today, but the CHECK exists and the door must not be the thing
  -- that discovers it — an explicit refusal beats a raw 23514 reaching the UI.
  if p_started_on is not null and v_ended is not null and p_started_on > v_ended then
    raise exception 'data de início posterior ao encerramento do vínculo'
      using errcode = 'HC0R3';
  end if;

  -- `coalesce` on both: an omitted argument leaves the stored value alone, so a caller
  -- correcting only the matrícula cannot blank the start date by not mentioning it.
  -- Clearing the matrícula is therefore an EXPLICIT flag rather than "pass null",
  -- because "null means leave it" and "null means clear it" cannot both be true.
  update public.hospital_affiliations
     set hospital_employee_id = case when p_clear_employee_id then null
                                     else coalesce(v_emp, hospital_employee_id) end,
         started_on           = coalesce(p_started_on, started_on)
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function app.update_affiliation_impl(uuid, uuid, uuid, text, date, boolean) from public;

create or replace function public.update_affiliation(
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null,
  p_clear_employee_id boolean default false
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.update_affiliation_impl((select auth.uid()), p_user, p_hospital,
                                     p_employee_id, p_started_on, p_clear_employee_id);
$$;

create or replace function public.update_affiliation_for(
  p_actor       uuid,
  p_user        uuid,
  p_hospital    uuid,
  p_employee_id text default null,
  p_started_on  date default null,
  p_clear_employee_id boolean default false
)
returns uuid
language sql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.update_affiliation_impl(p_actor, p_user, p_hospital,
                                     p_employee_id, p_started_on, p_clear_employee_id);
$$;

revoke all on function public.update_affiliation(uuid, uuid, text, date, boolean) from public;
revoke all on function public.update_affiliation_for(uuid, uuid, uuid, text, date, boolean) from public;
grant execute on function public.update_affiliation(uuid, uuid, text, date, boolean) to authenticated;
grant execute on function public.update_affiliation_for(uuid, uuid, uuid, text, date, boolean) to service_role;

comment on function public.update_affiliation(uuid, uuid, text, date, boolean) is
  'ADR 0097 D14 / ADR 0098 W3.4. Edits an EXISTING active employment: matrícula + start date. Deliberately separate from affiliate_person (the idempotent create door) so a create door does not acquire a date-mutation capability, and so the change emits affiliation.updated — routing it through the create door would have been an unaudited mutation.';

-- ---------------------------------------------------------------------------
-- The audit arm that makes the capability recordable (Rule 11). Regenerated whole
-- because a trigger function body cannot be patched in place; the INSERT / DELETE /
-- ended branches are byte-identical to 20260909000500's.
-- ---------------------------------------------------------------------------
create or replace function app.trg_audit_hospital_affiliations()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row     public.hospital_affiliations;
  v_action  text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_row     := new;
    v_action  := 'affiliation.created';
    v_summary := 'Vínculo hospitalar criado';
  elsif tg_op = 'DELETE' then
    -- Reachable ONLY under session_replication_role = replica: the BEFORE guard raises
    -- first in every other mode. This arm exists so that the one window in which D4 can
    -- be violated is not also invisible.
    v_row     := old;
    v_action  := 'affiliation.deleted';
    v_summary := 'Vínculo hospitalar EXCLUÍDO (contrário à ADR 0097 D4)';
  else
    if new.ended_on is not null and old.ended_on is null then
      v_row     := new;
      v_action  := 'affiliation.ended';
      v_summary := 'Vínculo hospitalar encerrado';
    elsif new.hospital_employee_id is distinct from old.hospital_employee_id
       or new.started_on is distinct from old.started_on then
      -- AFF W3/T3.3. Covers `update_affiliation` AND the matrícula refresh
      -- `affiliate_person` performs on an existing row — that refresh was itself an
      -- unaudited mutation until this arm existed.
      v_row     := new;
      v_action  := 'affiliation.updated';
      v_summary := 'Vínculo hospitalar atualizado';
    else
      return null;
    end if;
  end if;

  perform app.audit_write(
    v_action, 'hospital_affiliation', v_row.id, null, v_summary,
    jsonb_build_object(
      'user_id',         v_row.principal_id,
      'organization_id', v_row.organization_id,
      'hospital_id',     v_row.hospital_id
    ),
    v_row.organization_id, v_row.hospital_id);

  return null;
end;
$$;
