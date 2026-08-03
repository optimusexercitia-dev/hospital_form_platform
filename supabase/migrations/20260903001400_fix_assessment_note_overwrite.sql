-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — BUG-P16-001:
-- set_standard_assessment's upsert unconditionally overwrote note_md, so a
-- status-only re-assessment (the current frontend always passes
-- p_note_md = NULL, since there is no read path yet to prefill an existing
-- note — that half of the fix is Migration-E territory and stays deferred)
-- silently destroyed a previously-written justification note.
--
-- Fix: `null` now means "leave the note untouched" (coalesce against the
-- EXISTING row's note_md); an explicit non-null value — including an empty
-- string, once a future edit surface lets a user clear it on purpose —
-- still overwrites. This closes the bug for the CURRENT frontend (which
-- always sends null) with zero call-site changes, and holds up once the
-- prefill/edit surface lands: a real edit always resubmits the actual
-- current text, never a bare null.
--
-- Every other line of the function is unchanged.

create or replace function public.set_standard_assessment(
  p_commission uuid,
  p_standard uuid,
  p_status text,
  p_note_md text default null
)
returns public.standard_assessments
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_result public.standard_assessments;
begin
  perform app.assert_accreditation_enabled();

  if not app.is_staff_admin_of(p_commission) then
    raise exception 'você não pode avaliar padrões nesta comissão'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.accreditation_standards s
    join public.accreditation_frameworks f on f.id = s.framework_id
    where s.id = p_standard
      and (f.owner_commission_id is null or f.owner_commission_id = p_commission)
  ) then
    raise exception 'padrão não encontrado ou não disponível para esta comissão'
      using errcode = 'HC0QC';
  end if;

  insert into public.standard_assessments (commission_id, standard_id, status, assessed_by, note_md)
  values (p_commission, p_standard, p_status, v_uid, p_note_md)
  on conflict (commission_id, standard_id)
  do update set
    status = excluded.status,
    assessed_by = excluded.assessed_by,
    assessed_at = now(),
    -- BUG-P16-001 fix: NULL means "caller did not intend to change the
    -- note" (the current, prefill-less frontend) -> keep the EXISTING row's
    -- note_md. A real value (including '') always overwrites.
    note_md = coalesce(excluded.note_md, public.standard_assessments.note_md)
  returning * into v_result;

  return v_result;
end;
$$;
