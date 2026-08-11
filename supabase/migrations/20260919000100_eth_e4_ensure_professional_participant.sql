-- ETH·E4 §1.1 (ADR 0108 Decision 1) — the professional registry-mint door.
--
-- THE HOLE THIS CLOSES. Catalog-verified before writing (never migration text):
-- exactly ONE function inserted into `public.participants` (`set_participant_patient`,
-- the patient lane) and ZERO inserted into `public.professional_participants`; all
-- three tables are SELECT-only for `authenticated`, so there is no direct-DML
-- fallback. `add_case_participant` therefore demanded a `participants.id` that no
-- door could mint for a professional — the shipped "Médico denunciado" rail card was
-- unfillable through the product, and `e2e/ethics-e3a-surfacing.spec.ts` had to seat
-- respondents with raw `dbInsert` at three sites to reach it. That bypass is the tell.
--
-- WHY `public` AND NOT `app`. `config.toml` exposes only `public` + `graphql_public`
-- to PostgREST, so an `app.*` RPC is a 404 no client can reach — and pgTAP, which
-- calls in-database, would stay green over it. Only E2E traverses PostgREST. This is
-- the "correct door nothing can reach" failure already on this project's record.
--
-- WHY A SEPARATE DOOR, NOT A CHANGE TO `create_professional_profile`. Folding the
-- mint into that shipped DEFINER door would re-open its ACL / `prosecdef` /
-- `search_path` surface for no capability, and would need a backfill for existing
-- profiles — the data-dependent-migration shape that passes a 0-row local reset and
-- fails 23514 on a data-bearing remote. `add_case_participant` stays untouched too:
-- one seating path, one authorization/audit/`HC0F0` implementation.

-- The 1:1 invariant the get-or-create depends on. Nothing enforced it before: the
-- pkey is `participant_id`, so a profile could have acquired several registry
-- identities and a doctor's prior-case history would have fragmented across them.
--
-- DATA-DEPENDENT ON THE REMOTE. `seed.sql` writes `professional_participants`
-- directly and service-role paths could have; a local reset creates 0 rows and
-- therefore proves nothing about production. Before any `db push`, check the remote
-- read-only for duplicate `professional_profile_id` (ADR 0108 D1, plan §6 step 3).
create unique index if not exists professional_participants_profile_uniq
  on public.professional_participants (professional_profile_id);

create or replace function public.ensure_professional_participant(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_prof public.professional_profiles;
  v_participant uuid;
  v_new uuid;
begin
  perform app.assert_case_participants_enabled();

  select * into v_prof from public.professional_profiles where id = p_profile_id;
  if v_prof.id is null then
    raise exception 'profissional não encontrado' using errcode = 'P0002';
  end if;

  -- The write gate. `can_manage_professional` names the population that may seat
  -- professionals at all (platform admin, org admin, staff_admin of any commission
  -- in the org), so anyone who may call `add_case_participant` may also mint —
  -- the seating flow cannot dead-end on authorization.
  if not app.can_manage_professional(v_prof.organization_id, auth.uid()) then
    raise exception
      'apenas a coordenação ou a administração da organização pode registrar profissionais'
      using errcode = 'HC0E4';
  end if;

  -- GET. The registry identity is 1:1 with the profile and REUSED across cases —
  -- that is what makes a professional's prior-case history one record.
  select pp.participant_id into v_participant
  from public.professional_participants pp
  where pp.professional_profile_id = p_profile_id;

  if v_participant is not null then
    return v_participant;
  end if;

  -- CREATE. `display_name` is the real name, not a surrogate: ADR 0091 Decision 1
  -- holds the column is "a surrogate for patients and an already-org-readable name
  -- for professionals", and `participants_sensitivity_derives_type` forces
  -- `sensitivity_class = 'professional_identity'` for this type. It is a MINT-TIME
  -- SNAPSHOT — `update_professional_profile` can change `full_name` later and no
  -- sync is added here (that would modify a second shipped door for a cosmetic
  -- property). The roster renders the live profile name when the caller can read
  -- the profile and falls back to this column otherwise (ADR 0108 D3), so the
  -- snapshot only ever surfaces to callers who could not read the profile anyway.
  insert into public.participants
    (organization_id, participant_type, sensitivity_class, display_name, created_by)
  values (v_prof.organization_id, 'professional', 'professional_identity',
          v_prof.full_name, auth.uid())
  returning id into v_new;

  -- TARGETED `on conflict`, never the untargeted form — a bare `do nothing` absorbs
  -- ANY future unique constraint on this table and would silently swallow the very
  -- violation a later invariant is meant to raise.
  insert into public.professional_participants (participant_id, professional_profile_id)
  values (v_new, p_profile_id)
  on conflict (professional_profile_id) do nothing;

  if not found then
    -- LOST THE RACE. A concurrent caller committed the link row between our GET and
    -- our insert. The `participants` row we just created is now an ORPHAN — it has
    -- no link row and would otherwise sit in the org-readable registry forever as a
    -- duplicate name. Delete it and return the winner's identity. (READ COMMITTED
    -- takes a fresh snapshot per statement, so the re-read below sees the winner.)
    delete from public.participants where id = v_new;

    select pp.participant_id into v_participant
    from public.professional_participants pp
    where pp.professional_profile_id = p_profile_id;

    return v_participant;
  end if;

  -- Org-chain audit: this door is org-scoped, not case-scoped — it mints a registry
  -- identity, it does not seat anyone. `entity_type` follows the three sibling
  -- professional doors (`professional_profile`), catalog-derived, not the ADR's
  -- prose.
  perform app.audit_write(
    p_action => 'professional_profile.participant_minted',
    p_entity_type => 'professional_profile',
    p_entity_id => p_profile_id,
    p_commission => null,
    p_summary => 'Identidade de participante criada para o profissional',
    p_metadata => jsonb_build_object('participant_id', v_new),
    p_organization => v_prof.organization_id);

  return v_new;
end;
$$;

comment on function public.ensure_professional_participant(uuid) is
  'ETH·E4 (ADR 0108 D1): get-or-create the participants + professional_participants '
  'pair for a professional profile and return the registry id. Org-manager gated '
  '(HC0E4), audited, idempotent by the professional_profile_id unique index.';

-- The t19 door ACL idiom: strip the Postgres default (EXECUTE to PUBLIC, which is
-- what a NULL `proacl` means) and grant explicitly.
revoke all on function public.ensure_professional_participant(uuid) from public;
grant execute on function public.ensure_professional_participant(uuid)
  to authenticated, service_role;
