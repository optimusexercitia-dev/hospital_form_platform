-- =============================================================================
-- DM5 S2 · M3 — the UPLOAD seam: caller-supplied paths die.
--
-- Executes ADR 0114 D8/D9 ("buckets and paths derived server-side;
-- caller-supplied bucket/path/size/MIME/hash are never trusted") for the NSP
-- evidence surface, under ADR 0120.
--
-- ⭐ WHAT WAS WRONG. `add_rca_evidence(p_storage_path …)` and
-- `add_capa_action_evidence(p_storage_path …)` accepted a path the CLIENT
-- minted and stored it verbatim: no bucket check, no existence check, no size,
-- no MIME, no hash. The client PUT the bytes itself, straight at
-- `nsp-evidence`. Nothing server-side ever confirmed that the string named
-- bytes that existed, in the right bucket, belonging to this RCA.
--
-- After this migration the caller can no longer NAME bytes at all. It passes a
-- `document_id` that `begin_document_upload`/`finalize_document_upload` already
-- created, verified and homed on THIS rca / capa_action, and the door re-checks
-- that homing before it will bind.
--
-- ⭐ THE INVARIANT IS A CHECK, NOT AN ASSERT — the rule this phase derived:
-- ANYTHING THAT MUST HOLD REGARDLESS OF ROLLOUT GOES IN A CHECK OR A TRIGGER,
-- NEVER IN THE RPC BODY. Both evidence tables carry table-wide `arwdDxtm` to
-- `authenticated` (FUP-DM5-GRANTS), so a client can `POST /rest/v1/rca_evidence`
-- and never traverse the RPC. An assert would be bypassable; the rewritten
-- shape CHECKs are not. This is exactly why the citation seam is safe against
-- direct DML today: `rca_evidence_cited_document_parked` is a CHECK.
--
-- ⚠ DROP + CREATE IS UNAVOIDABLE HERE and it LOSES THE ACL. `CREATE OR REPLACE`
-- cannot remove a parameter. Both functions carry
-- `postgres=X, authenticated=X, service_role=X` (captured from the catalog
-- before the drop); the grants are restored below and RE-ASSERTED from the
-- catalog, because a rebuild that silently drops `authenticated` leaves a door
-- that reads correct and is unreachable — the "guards that read right but fail
-- open" class, inverted.
--
-- ⚠ ONE ERROR CODE FOR TWO CAUSES, DELIBERATELY. "no such document" and
-- "document not homed on this RCA" both raise HC0D8. That is the house
-- absence ≡ denial pattern (no existence oracle), not an oversight — a caller
-- must not be able to probe which documents exist by reading the refusal.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The new binding. ON DELETE RESTRICT: an evidence row is the reason its
--    document is retained, so the document cannot vanish under it.
-- -----------------------------------------------------------------------------
alter table public.rca_evidence
  add column document_id uuid
    references public.documents(id) on delete restrict;
alter table public.capa_action_evidence
  add column document_id uuid
    references public.documents(id) on delete restrict;

-- One evidence row per document, mirroring the uniqueness the dropped
-- `storage_path` unique index carried (a document is not shared between rows).
create unique index rca_evidence_document_uniq
  on public.rca_evidence (document_id) where document_id is not null;
create unique index capa_action_evidence_document_uniq
  on public.capa_action_evidence (document_id) where document_id is not null;

-- -----------------------------------------------------------------------------
-- 2. The caller-supplied column goes. Zero rows locally; the 2026-08-11
--    production census recorded 45 objects as 38 form-assets + 3
--    controlled-documents + 4 printed-documents, i.e. ZERO in `nsp-evidence`,
--    so there is nothing to migrate. (Production is UNVERIFIED — remote; the
--    arithmetic is the evidence, and it is stated so it can be re-checked at
--    deploy rather than trusted.)
--    Dropping the column also drops `*_storage_path_key`.
-- -----------------------------------------------------------------------------
alter table public.rca_evidence drop column storage_path;
alter table public.capa_action_evidence drop column storage_path;

-- -----------------------------------------------------------------------------
-- 3. The shape CHECKs, rewritten onto the binding. These are the backstop that
--    holds against direct PostgREST DML.
--
-- ⚠ `DROP CONSTRAINT IF EXISTS`, and the IF EXISTS is load-bearing rather than
-- defensive noise: step 2's `DROP COLUMN storage_path` ALREADY removed both
-- shape CHECKs, because Postgres auto-drops any constraint whose expression
-- involves a dropped column. An unconditional drop here failed the whole
-- migration on "constraint does not exist" (caught at apply, rolled back
-- whole — the file is wrapped in begin/commit, and the registry stayed at 393
-- with nothing partially applied). Asserted below rather than assumed.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'rca_evidence_shape') then
    raise exception 'expected DROP COLUMN storage_path to have removed rca_evidence_shape';
  end if;
  if exists (select 1 from pg_constraint where conname = 'capa_action_evidence_shape') then
    raise exception 'expected DROP COLUMN storage_path to have removed capa_action_evidence_shape';
  end if;
end $$;

alter table public.rca_evidence drop constraint if exists rca_evidence_shape;
alter table public.rca_evidence
  add constraint rca_evidence_shape check (
       (kind = 'document'
        and document_id is not null
        and external_url is null
        and cited_interview_id is null and cited_meeting_id is null
        and cited_document_id is null)
    or (kind = 'link'
        and external_url is not null
        and document_id is null
        and cited_interview_id is null and cited_meeting_id is null
        and cited_document_id is null)
    or (kind = 'citation'
        and document_id is null
        and external_url is null
        and citation_label is not null
        and ( (cited_interview_id is not null)::int
            + (cited_meeting_id   is not null)::int
            + (cited_document_id  is not null)::int ) = 1)
  );

alter table public.capa_action_evidence drop constraint if exists capa_action_evidence_shape;
alter table public.capa_action_evidence
  add constraint capa_action_evidence_shape check (
       (kind = 'document' and document_id is not null and external_url is null)
    or (kind = 'link'     and external_url is not null and document_id is null)
  );

-- -----------------------------------------------------------------------------
-- 4. The doors. DROP + CREATE (parameter removal), then RESTORE the grants.
-- -----------------------------------------------------------------------------
drop function if exists public.add_rca_evidence(uuid, text, text, text, text, text, uuid, text);
drop function if exists public.add_capa_action_evidence(uuid, text, text, text, text);

create function public.add_rca_evidence(
  p_rca_id uuid,
  p_kind text,
  p_title text,
  p_document_id uuid default null,
  p_external_url text default null,
  p_citation_target text default null,
  p_cited_entity_id uuid default null,
  p_citation_label text default null
) returns public.rca_evidence
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.rca_evidence;
  v_interview uuid;
  v_meeting uuid;
  v_document uuid;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link', 'citation') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  if p_kind = 'document' then
    if p_document_id is null or p_external_url is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    -- D8/D9: the caller no longer NAMES bytes. It names a document the upload
    -- commands already created, verified and homed HERE — and this re-checks
    -- the homing rather than trusting it. Absence and wrong-home are ONE
    -- indistinguishable denial (no existence oracle).
    if not exists (
      select 1
        from public.documents d
        join public.securable_resources s on s.id = d.home_resource_id
       where d.id = p_document_id
         and s.resource_type = 'rca'
         and d.home_resource_id = p_rca_id
         and d.status = 'active'
    ) then
      raise exception 'documento indisponível para esta análise' using errcode = 'HC0D8';
    end if;
  elsif p_kind = 'link' then
    if p_external_url is null or p_document_id is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  else -- citation
    -- STILL PARKED — the citation seam is INDEPENDENT of the upload seam and is
    -- un-parked by 20260927000130, not here. `cited_document_id` is the
    -- CITATION slot (mutually exclusive with the uploaded byte); re-pointing the
    -- upload and un-parking the citation are two different jobs.
    if p_citation_target = 'document' then
      raise exception
        'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)'
        using errcode = 'HC0DM';
    end if;
    if p_citation_target not in ('interview', 'meeting', 'document')
       or p_cited_entity_id is null or p_document_id is not null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(p_citation_label, '')) = '' then
      raise exception 'informe um rótulo para a citação' using errcode = 'check_violation';
    end if;
    if p_citation_target = 'interview' then v_interview := p_cited_entity_id;
    elsif p_citation_target = 'meeting' then v_meeting := p_cited_entity_id;
    else v_document := p_cited_entity_id;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_evidence (
    rca_id, kind, title, document_id, external_url,
    cited_interview_id, cited_meeting_id, cited_document_id, citation_label, created_by
  ) values (
    p_rca_id, p_kind, btrim(p_title),
    case when p_kind = 'document' then p_document_id else null end,
    p_external_url,
    v_interview, v_meeting, v_document,
    case when p_kind = 'citation' then btrim(p_citation_label) else null end,
    auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$function$;

create function public.add_capa_action_evidence(
  p_action_id uuid,
  p_kind text,
  p_title text,
  p_document_id uuid default null,
  p_external_url text default null
) returns public.capa_action_evidence
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.capa_action_evidence;
  v_capa uuid;
begin
  perform app.assert_patient_safety_enabled();
  select ca.capa_id into v_capa from public.capa_action ca where ca.id = p_action_id;
  if v_capa is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  if p_kind = 'document' then
    if p_document_id is null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo ou link'
        using errcode = 'check_violation';
    end if;
    -- Homed on THIS capa_action (the D14 securable type), same denial shape.
    if not exists (
      select 1
        from public.documents d
        join public.securable_resources s on s.id = d.home_resource_id
       where d.id = p_document_id
         and s.resource_type = 'capa_action'
         and d.home_resource_id = p_action_id
         and d.status = 'active'
    ) then
      raise exception 'documento indisponível para esta ação' using errcode = 'HC0D8';
    end if;
  else
    if p_external_url is null or p_document_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo ou link'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_action_evidence (
    action_id, kind, title, document_id, external_url, created_by
  ) values (
    p_action_id, p_kind, btrim(p_title),
    case when p_kind = 'document' then p_document_id else null end,
    p_external_url, auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$function$;

-- RESTORE the ACL the DROP destroyed (captured pre-drop from pg_proc.proacl:
-- postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres).
--
-- ⭐ THE REVOKE IS NOT BOILERPLATE — it is the half a rebuild silently ADDS.
-- `CREATE FUNCTION` grants EXECUTE to **PUBLIC** by default, so DROP+CREATE does
-- not merely lose the old ACL, it installs a WIDER one: the rebuilt doors came
-- back with `=X/postgres` and `has_function_privilege('anon', …, 'EXECUTE')`
-- true. The pre-drop ACL had no PUBLIC entry, so this restores the real prior
-- state rather than adding a new restriction.
--
-- Caught by pgTAP `314` t19 ("no FIRST-PARTY public function is anon-executable")
-- — NOT by this migration's own post-condition block, whose first version
-- asserted only that `authenticated` and `service_role` were PRESENT and never
-- that PUBLIC was ABSENT. A one-directional property check: it could see a lost
-- grant and was blind to a gained one. Both directions are asserted below now.
revoke execute on function public.add_rca_evidence(uuid, text, text, uuid, text, text, uuid, text)
  from public;
revoke execute on function public.add_capa_action_evidence(uuid, text, text, uuid, text)
  from public;
grant execute on function public.add_rca_evidence(uuid, text, text, uuid, text, text, uuid, text)
  to authenticated, service_role;
grant execute on function public.add_capa_action_evidence(uuid, text, text, uuid, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Post-conditions, asserted FROM THE CATALOG. A rebuild that silently drops
--    `authenticated` leaves a door that reads correct and is unreachable.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') cfg,
           array_to_string(p.proacl, ',') acl, p.proacl raw_acl,
           pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('add_rca_evidence', 'add_capa_action_evidence')
  loop
    if not r.prosecdef then
      raise exception '%: lost SECURITY DEFINER', r.proname;
    end if;
    if r.cfg is distinct from 'search_path=app, public, pg_catalog' then
      raise exception '%: lost the search_path pin (got %)', r.proname, r.cfg;
    end if;
    if r.acl not like '%authenticated=X/postgres%' then
      raise exception '%: DROP+CREATE lost the authenticated EXECUTE grant (got %)', r.proname, r.acl;
    end if;
    if r.acl not like '%service_role=X/postgres%' then
      raise exception '%: DROP+CREATE lost the service_role EXECUTE grant (got %)', r.proname, r.acl;
    end if;
    if r.args like '%p_storage_path%' then
      raise exception '%: p_storage_path survived the rebuild', r.proname;
    end if;
    if r.args not like '%p_document_id%' then
      raise exception '%: p_document_id is missing from the rebuilt signature', r.proname;
    end if;
    -- The OTHER direction: a rebuild does not only LOSE grants, it GAINS the
    -- PUBLIC default. Asserted explicitly so this can never regress silently.
    -- ⚠ PUBLIC is an aclitem with an EMPTY GRANTEE, so a SUBSTRING test cannot
    -- see it: `acl like '%=X/postgres%'` also matches `postgres=X/postgres`.
    -- The first version of this fired on EVERY function (false positive, broke
    -- the reset); the variant guarded with `and not like '%postgres=X/postgres%'`
    -- could NEVER fire while postgres held a grant (vacuous, false negative).
    -- Both wrong, in opposite directions. aclexplode gives the structural answer:
    -- grantee = 0 IS PUBLIC.
    if exists (select 1 from aclexplode(r.raw_acl) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception '%: PUBLIC holds EXECUTE after the rebuild (got %)', r.proname, r.acl;
    end if;
  end loop;

  if has_function_privilege('anon',
       'public.add_rca_evidence(uuid,text,text,uuid,text,text,uuid,text)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon',
       'public.add_capa_action_evidence(uuid,text,text,uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'anon can execute a rebuilt evidence door (the CREATE FUNCTION PUBLIC default)';
  end if;

  -- Column grants: unlike `printed_documents` (column-list SELECT grants, the
  -- case_referral 42501 trap), both evidence tables carry TABLE-WIDE privileges
  -- to `authenticated`, so `document_id` is readable without a per-column
  -- GRANT. Asserted rather than assumed, because the trap is real elsewhere.
  if not exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'rca_evidence'
       and column_name = 'document_id' and grantee = 'authenticated'
       and privilege_type = 'SELECT'
  ) then
    raise exception 'rca_evidence.document_id is not SELECT-able by authenticated';
  end if;
end $$;

commit;
