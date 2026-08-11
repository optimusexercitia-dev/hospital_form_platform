-- ETH·E4 §1.2 (ADR 0108 Decision 8) — the external / institutional mint door.
--
-- WHY THIS SHIPS IN THE SAME TRACK. The seeded `case_participant_roles` vocabulary
-- already speaks for the whole proceeding, and a professional-only mint lane leaves
-- FOUR of the seven seeded roles unfillable — `complainant` (Denunciante),
-- `witness` (Testemunha), `legal_representative` (Representante legal) and
-- `external_regulatory_body` (Órgão regulador externo). Nearly every processo ético
-- starts with a denunciante; a roster that cannot record one repeats, one lane over,
-- exactly the "seeded role over an unfillable panel" shape FUP-ETH-1 was filed about.
--
-- CREATE-ALWAYS, NOT GET-OR-CREATE — and deliberately no unique index. An external
-- person has no natural key, and deduplicating on `display_name` would silently
-- MERGE two distinct same-named people, which is the worse failure. Reuse is by
-- human choice instead: the add dialog searches existing external participants
-- (org-scoped through `participants_select`) before offering to create. Duplicate
-- rows are an accepted cost (ADR 0108 D8); a merge affordance, if ever needed, is
-- its own track.
--
-- `public`, not `app`: `config.toml` exposes only `public` + `graphql_public` to
-- PostgREST — see the §1.1 header.

create or replace function public.create_external_participant(
  p_org uuid,
  p_type text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();

  if p_org is null then
    raise exception 'organização não informada' using errcode = 'P0002';
  end if;

  -- The SAME capability as the professional lane. The predicate names the
  -- population (org admins + staff_admins of the org's commissions), not the
  -- professional class, so reusing it here is not a widening.
  if not app.can_manage_professional(p_org, auth.uid()) then
    raise exception
      'apenas a coordenação ou a administração da organização pode registrar participantes'
      using errcode = 'HC0E4';
  end if;

  -- The five NON-SENSITIVE registry types. `participants_sensitivity_derives_type`
  -- backstops this in the schema, but the door raises a pt-BR message rather than
  -- letting a CHECK violation surface. `patient` and `professional` are excluded by
  -- construction: they carry their own sensitivity classes and their own doors.
  if p_type is null or p_type not in
     ('external_person', 'department', 'institution', 'regulatory_body', 'other') then
    raise exception 'tipo de participante externo inválido' using errcode = 'check_violation';
  end if;

  if v_name = '' then
    raise exception 'informe o nome do participante' using errcode = 'check_violation';
  end if;

  insert into public.participants
    (organization_id, participant_type, sensitivity_class, display_name, created_by)
  values (p_org, p_type, 'non_sensitive', v_name, auth.uid())
  returning id into v_id;

  perform app.audit_write(
    p_action => 'external.participant_minted',
    p_entity_type => 'participant',
    p_entity_id => v_id,
    p_commission => null,
    p_summary => 'Participante externo registrado',
    p_metadata => jsonb_build_object('participant_type', p_type),
    p_organization => p_org);

  return v_id;
end;
$$;

comment on function public.create_external_participant(uuid, text, text) is
  'ETH·E4 (ADR 0108 D8): mint a non-sensitive external/institutional participant. '
  'Create-always (no natural key ⇒ no dedup); org-manager gated (HC0E4); audited.';

revoke all on function public.create_external_participant(uuid, text, text) from public;
grant execute on function public.create_external_participant(uuid, text, text)
  to authenticated, service_role;
