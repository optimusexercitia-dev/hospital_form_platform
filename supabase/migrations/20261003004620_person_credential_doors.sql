-- AE1.3 (3/3) — the two `professional_credentials` person-authority doors.
-- Contract: docs/plans/authz-ae1-person-doors.md §§2, 4.6-4.7, ruled in its §12.
--
-- Same two-layer shape as 20261003004610: `public.<name>_for` (service_role only) over
-- `app.<name>_impl` (DEFINER, VOLATILE, owner-only). See that migration's header for why
-- the split is load-bearing (ADR 0156 door-SQLSTATE gate + pgTAP 304 §6.1's reverse pin).
--
-- Authority for BOTH doors is `credentials` -> INTERSECTION (ADR 0133 D3 + Amdt 1 ruling
-- 1): a council registration is a LOCAL fact about the person, so authority at ANY
-- hospital they serve is sufficient.
--
-- ⚠⚠ THE TWO DOORS TREAT "NOT FOUND" DIFFERENTLY, ON PURPOSE. This is the exact shape a
-- later "consistency" refactor would flatten, so it is stated here rather than left to be
-- rediscovered:
--
--   upsert_credential (update branch) — the caller has ALREADY proven authority over
--     `p_user`, so "this credential id is not this person's" is information they already
--     hold. It therefore gets its OWN code, `HC0T6`. This is the live `HC0R2` precedent
--     from `app.end_affiliation_impl`.
--
--   delete_credential — the credential id is the INPUT and there is no `p_user` to prove
--     authority over first, so a distinguishable not-found would be a CREDENTIAL-ID
--     ORACLE. Unknown id and denial therefore share ONE raise, one code (42501) and one
--     message — byte-identical by construction, not by two raises that happen to agree.
--     ⛔ Do NOT give the unknown-id branch its own code "for symmetry with upsert".
--
-- ⚠ `professional_credentials` has NO triggers at all and NO write RLS policy (only
-- `professional_credentials_select`), despite `authenticated` holding table-wide
-- INSERT/UPDATE/DELETE grants. That asymmetry is currently harmless and would stop being
-- harmless the day a permissive write policy is added.
--
-- ⛔ Rule 11 / Rule 12: `registration_number` is a PROFESSIONAL IDENTIFIER (Class-2) and
-- NEVER enters audit metadata. Metadata carries the credential id, the user id and column
-- NAMES only.

-- ===========================================================================
-- 1. upsert_credential — insert (p_id null) or update (p_id set)   (design §4.6)
-- ===========================================================================
-- ⭐ THE UPDATE BRANCH RAISES INSTEAD OF MATCHING ZERO ROWS. The TS it replaces had to
-- carry an explicit zero-row check because "a zero-row UPDATE is NOT an error, so without
-- this the UI reported 'Registro profissional salvo.' for a write that never happened"
-- (actions.ts ~1006) — the `.eq('user_id', …)` conjunct is the cross-person guard and its
-- whole purpose is to match zero rows for a forged id. Raising removes that failure mode
-- entirely.
-- ⭐ EDITING CLEARS `verified_at` AND STAMPS `updated_at` — tamper-visible, unchanged from
-- today. Asserted in pgTAP 385, because a door that drops it silently launders an edited
-- credential into a verified one.
create or replace function app.upsert_credential_impl(
  p_actor               uuid,
  p_user                uuid,
  p_id                  uuid,
  p_issuing_country     text,
  p_issuing_state       text,
  p_issuing_authority   text,
  p_registration_number text,
  p_expires_on          date
) returns uuid
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org uuid;
  v_id  uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('credentials', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select pr.home_organization_id into v_org from public.profiles pr where pr.id = p_user;

  if p_id is null then
    insert into public.professional_credentials (
      user_id, issuing_country, issuing_state, issuing_authority,
      registration_number, expires_on
    ) values (
      p_user, p_issuing_country, p_issuing_state, p_issuing_authority,
      p_registration_number, p_expires_on
    )
    returning id into v_id;

    perform app.audit_write(
      p_action       => 'credential.created',
      p_entity_type  => 'credential',
      p_entity_id    => v_id,
      p_commission   => null,
      p_summary      => 'Registro profissional criado',
      p_metadata     => jsonb_build_object(
                          'actor_user_id', p_actor,
                          'credential_id', v_id,
                          'user_id', p_user),
      p_organization => v_org,
      p_hospital     => null
    );
    return v_id;
  end if;

  update public.professional_credentials
     set issuing_country     = p_issuing_country,
         issuing_state       = p_issuing_state,
         issuing_authority   = p_issuing_authority,
         registration_number = p_registration_number,
         expires_on          = p_expires_on,
         verified_at         = null,
         updated_at          = now()
   where id = p_id
     and user_id = p_user
  returning id into v_id;

  if v_id is null then
    -- POST-AUTHORITY (design F-B). Not an oracle: authority over `p_user` is already
    -- proven above, so "that registration is not this person's" tells the caller nothing
    -- they did not already have.
    raise exception 'registro profissional não encontrado para esta pessoa'
      using errcode = 'HC0T6';
  end if;

  perform app.audit_write(
    p_action       => 'credential.updated',
    p_entity_type  => 'credential',
    p_entity_id    => v_id,
    p_commission   => null,
    p_summary      => 'Registro profissional atualizado',
    p_metadata     => jsonb_build_object(
                        'actor_user_id', p_actor,
                        'credential_id', v_id,
                        'user_id', p_user,
                        'changed', to_jsonb(array[
                          'issuing_country', 'issuing_state', 'issuing_authority',
                          'registration_number', 'expires_on', 'verified_at'])),
    p_organization => v_org,
    p_hospital     => null
  );
  return v_id;
end;
$fn$;

create or replace function public.upsert_credential_for(
  p_actor               uuid,
  p_user                uuid,
  p_id                  uuid,
  p_issuing_country     text,
  p_issuing_state       text,
  p_issuing_authority   text,
  p_registration_number text,
  p_expires_on          date default null
) returns uuid
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.upsert_credential_impl(
    p_actor, p_user, p_id, p_issuing_country, p_issuing_state,
    p_issuing_authority, p_registration_number, p_expires_on);
$fn$;

-- ===========================================================================
-- 2. delete_credential   (design §4.7)
-- ===========================================================================
-- ⛔ ONE RAISE FOR BOTH "no such credential" AND "not permitted". See the header: the id
-- is the INPUT here, so two distinguishable outcomes would be a credential-id oracle.
create or replace function app.delete_credential_impl(
  p_actor      uuid,
  p_credential uuid
) returns void
language plpgsql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_user uuid;
  v_org  uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  select pc.user_id into v_user
    from public.professional_credentials pc
   where pc.id = p_credential;

  if v_user is null
     or not app.can_administer_person_for('credentials', v_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select pr.home_organization_id into v_org from public.profiles pr where pr.id = v_user;

  delete from public.professional_credentials where id = p_credential;

  perform app.audit_write(
    p_action       => 'credential.deleted',
    p_entity_type  => 'credential',
    p_entity_id    => p_credential,
    p_commission   => null,
    p_summary      => 'Registro profissional removido',
    p_metadata     => jsonb_build_object(
                        'actor_user_id', p_actor,
                        'credential_id', p_credential,
                        'user_id', v_user),
    p_organization => v_org,
    p_hospital     => null
  );
end;
$fn$;

create or replace function public.delete_credential_for(
  p_actor      uuid,
  p_credential uuid
) returns void
language sql
volatile
security definer
set search_path = app, public, pg_catalog
as $fn$
  select app.delete_credential_impl(p_actor, p_credential);
$fn$;

-- ===========================================================================
-- ACLs — POSITIVE, never inferred (design §1).
-- ===========================================================================
revoke all on function app.upsert_credential_impl(uuid, uuid, uuid, text, text, text, text, date) from public;
revoke all on function app.delete_credential_impl(uuid, uuid) from public;

revoke all on function public.upsert_credential_for(uuid, uuid, uuid, text, text, text, text, date) from public;
revoke all on function public.delete_credential_for(uuid, uuid) from public;

grant execute on function public.upsert_credential_for(uuid, uuid, uuid, text, text, text, text, date) to service_role;
grant execute on function public.delete_credential_for(uuid, uuid) to service_role;
