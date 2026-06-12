-- Phase 1 / M8: RLS hardening (QA Phase 1 loop-back).
-- Forward-only follow-up to M2/M5/M6; does not edit applied migrations.
-- Addresses docs/reviews/phase-1-review.md findings MAJOR-1, MINOR-1, MINOR-2,
-- MINOR-3. (MAJOR-2 is a test-only gap, fixed in supabase/tests; INFO-1 is a
-- Phase 8 follow-up.)

-- ---------------------------------------------------------------------------
-- MAJOR-1: a staff_admin may manage STAFF rows only. The UPDATE policy
-- restricted only the NEW row (WITH CHECK role='staff'), so a staff_admin could
-- target an existing staff_admin row and demote them. Restrict the USING clause
-- to staff rows too, mirroring the DELETE policy.
-- ---------------------------------------------------------------------------
alter policy commission_members_staff_admin_update on public.commission_members
  using (app.is_staff_admin_of(commission_id) and role = 'staff');

-- ---------------------------------------------------------------------------
-- MINOR-1: pin eval_condition's search_path for consistency with the rest of
-- the codebase. It is a pure JSONB computation (touches no tables), so this is
-- defense-in-depth, not a fix for an exploitable path. CREATE OR REPLACE keeps
-- the existing signature/grants.
-- ---------------------------------------------------------------------------
create or replace function app.eval_condition(p_visible_when jsonb, p_answers jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_op text;
  v_target jsonb;
  v_answer jsonb;
  v_present boolean;
  v_match boolean;
begin
  if p_visible_when is null then
    return true;
  end if;

  v_key := p_visible_when ->> 'question_key';
  v_op := p_visible_when ->> 'op';
  v_target := p_visible_when -> 'value';

  v_present := (p_answers ? v_key);
  v_answer := p_answers -> v_key;

  if not v_present or v_answer is null or v_answer = 'null'::jsonb then
    v_match := false;
  elsif jsonb_typeof(v_answer) = 'array' then
    v_match := v_answer @> jsonb_build_array(v_target);
  else
    v_match := (v_answer = v_target);
  end if;

  if v_op = 'equals' then
    return v_match;
  elsif v_op = 'not_equals' then
    return not v_match;
  elsif v_op = 'in' then
    if not v_present or v_answer is null or jsonb_typeof(v_target) <> 'array' then
      return false;
    end if;
    if jsonb_typeof(v_answer) = 'array' then
      return exists (
        select 1
        from jsonb_array_elements(v_answer) sel
        where v_target @> jsonb_build_array(sel.value)
      );
    else
      return v_target @> jsonb_build_array(v_answer);
    end if;
  else
    raise exception 'unknown condition op: %', v_op;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- MINOR-2: profiles are NEVER deleted (Architecture Rule 2). FKs already block
-- deleting a profile that has data, but a brand-new profile with no data could
-- still be deleted by an admin under profiles_admin_all (FOR ALL). Replace that
-- policy with explicit SELECT/INSERT/UPDATE admin policies (no DELETE) and add
-- an unconditional BEFORE DELETE trigger so the invariant holds even for the
-- service role / future policies.
-- ---------------------------------------------------------------------------
drop policy profiles_admin_all on public.profiles;

create policy profiles_admin_select on public.profiles
  for select to authenticated
  using (app.is_admin());

create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (app.is_admin());

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (app.is_admin())
  with check (app.is_admin());

create function public.guard_profile_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'profiles are never deleted; deactivate via is_active'
    using errcode = 'check_violation';
end;
$$;

create trigger guard_profile_no_delete_trg
  before delete on public.profiles
  for each row execute function public.guard_profile_no_delete();

-- ---------------------------------------------------------------------------
-- MINOR-3: a response's form_version_id must belong to its commission_id, on
-- both INSERT and UPDATE. A membership check alone let a member pin a foreign
-- form version onto a response scoped to their own commission. Enforce the
-- cross-reference with a trigger (cleaner than subquerying through RLS in a
-- WITH CHECK, and it also covers UPDATE).
-- ---------------------------------------------------------------------------
create function public.guard_response_version_commission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  select f.commission_id into v_commission
  from public.form_versions v
  join public.forms f on f.id = v.form_id
  where v.id = new.form_version_id;

  if v_commission is null then
    raise exception 'form_version % does not exist', new.form_version_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_commission <> new.commission_id then
    raise exception 'response.form_version_id % does not belong to commission %',
      new.form_version_id, new.commission_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger guard_response_version_commission_trg
  before insert or update of form_version_id, commission_id on public.responses
  for each row execute function public.guard_response_version_commission();
