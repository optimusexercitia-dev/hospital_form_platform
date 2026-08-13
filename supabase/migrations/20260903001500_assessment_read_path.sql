-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — BUG-P16-001,
-- root-cause half: the missing read path. `20260903001400` fixed the
-- SYMPTOM (a status-only save no longer erases an existing note) by
-- coalescing NULL against the existing row — but with the coalesce in
-- place, nothing visibly breaks, so there was still no way for the UI to
-- ever SHOW an existing note before editing it. That silence is exactly why
-- the defect existed in the first place: no read path meant no prefill
-- meant every save "looked" like a fresh note.
--
-- get_standard_assessment(commission, standard) — a single-row member read
-- (status + note_md + who/when), gated app.is_member_of like the other
-- member-facing doors (readiness_report already exposes `status` to any
-- member; note_md was the only genuinely new disclosure). Deliberately NOT
-- folded into readiness_report/readiness_evidence (Migration E, same
-- migration set) — those are commission-wide/per-standard-evidence doors
-- that explicitly carry NO note field (D8); mixing the single-assessment
-- prefill read into either would create exactly the note-leak surface D8
-- exists to prevent. This door is commission-scoped ONLY (is_member_of) —
-- it is never reachable from the hospital tier or an export surface,
-- because hospital_readiness (Migration E) does not call it and has its
-- own gate (is_hospital_admin_of / org-admin), which does not imply
-- is_member_of of any specific commission.

create function public.get_standard_assessment(p_commission uuid, p_standard uuid)
returns table(status text, note_md text, assessed_at timestamptz, assessed_by_name text)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_accreditation_enabled();

  if not app.is_member_of(p_commission) then
    return;
  end if;

  return query
  select sa.status, sa.note_md, sa.assessed_at, p.full_name
  from public.standard_assessments sa
  left join public.profiles p on p.id = sa.assessed_by
  where sa.commission_id = p_commission and sa.standard_id = p_standard;
end;
$$;

revoke execute on function public.get_standard_assessment(uuid, uuid) from public;
grant execute on function public.get_standard_assessment(uuid, uuid) to authenticated;
