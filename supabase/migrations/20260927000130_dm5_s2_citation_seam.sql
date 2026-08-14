-- =============================================================================
-- DM5 S2 · M4 — the CITATION seam: `cited_document_id` un-parked.
--
-- ADR 0120; discharges pgTAP 328 K8b. ⚠ K8a SURVIVES — it is DM4's referral
-- seam and is already discharged on its own terms; "remove keystone K8" once
-- named an object that is not one (330's header records that mistake).
--
-- ⭐ THE SECOND, INDEPENDENT SEAM. `rca_evidence_shape` makes
-- `cited_document_id` the CITATION slot (`kind = 'citation'`, mutually
-- exclusive with the uploaded byte), while the upload seam that
-- 20260927000120 re-pointed is `document_id`. Re-pointing the upload and
-- un-parking the citation are two different jobs on two different columns; the
-- parent plan's "the attachments FK" framing collapses them.
--
-- ⭐ THREE LOCKS, MEASURED INDEPENDENTLY BEFORE THIS MIGRATION WAS WRITTEN.
-- Each was neutralized ALONE in a rolled-back txn (needle-match asserted first,
-- so a replace that matched nothing could not silently void the measurement):
--
--   state                        | RPC          | direct PostgREST DML
--   -----------------------------+--------------+---------------------
--   all three locks              | HC0DM (arm)  | 23514 (CHECK)
--   arm OFF, CHECK on            | 23514        | --
--   CHECK OFF, arm on            | HC0DM        | ACCEPTED
--   both OFF                     | ACCEPTED     | --
--   both OFF, GHOST document id  | ACCEPTED     | --   (no FK exists)
--
-- What that establishes, and none of it was assumable:
--   1. The arm and the CHECK are GENUINELY INDEPENDENT locks — each catches
--      when the other is removed. Not one predicate applied twice.
--   2. The CHECK is the ONLY lock on the DIRECT-DML path. With it dropped and
--      the arm intact, a client `POST /rest/v1/rca_evidence` planted a citation
--      the RPC would have refused. This is the flag-placement rule made
--      concrete: what must hold regardless of rollout cannot live in the body.
--   3. With both gone, a citation could name a document THAT DOES NOT EXIST.
--      That is the hole the FK below closes, and it was reachable only after
--      both other locks were removed — which is precisely why the FK keystone
--      could not have been proven red without this experiment.
--
-- ⚠ CREATE OR REPLACE, not DROP+CREATE: the signature is unchanged, so the ACL
-- is preserved. 20260927000120 had to DROP (parameter removal) and the rebuild
-- silently re-granted EXECUTE to PUBLIC. Nothing here removes a parameter, so
-- that class does not apply — asserted below anyway, in BOTH directions,
-- because "did I lose a grant?" is structurally blind to "did I gain one?".
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Lock 2 retires: the parked CHECK.
-- -----------------------------------------------------------------------------
alter table public.rca_evidence drop constraint rca_evidence_cited_document_parked;

-- -----------------------------------------------------------------------------
-- 2. Lock 3 arrives: the real FK. ON DELETE RESTRICT — a cited document cannot
--    vanish out from under the citation that references it. Measurement E3
--    showed a ghost id was accepted without this.
-- -----------------------------------------------------------------------------
alter table public.rca_evidence
  add constraint rca_evidence_cited_document_id_fkey
  foreign key (cited_document_id) references public.documents(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 3. Lock 1 retires, and is REPLACED by an authorization gate.
--
-- ⭐ The parked arm is not simply deleted. Dropping it without a replacement
-- would let a writer cite a document they cannot read — and a citation is an
-- EXISTENCE DISCLOSURE: the label and the id are projected to every reader of
-- the RCA. "No linking what you cannot read" is DM3's E4 discipline, and the
-- FUP-DM4-RECUSAL shape is the warning: authority over the CONTAINER is not
-- authority over the CONTENT.
--
-- ⚠ Absence and unreadability raise the SAME code, deliberately, for the same
-- reason 20260927000120 collapses not-found and wrong-home: an error that
-- distinguishes "does not exist" from "not yours" IS AN EXISTENCE ORACLE. Do
-- not "improve" these into distinct messages.
-- -----------------------------------------------------------------------------
create or replace function public.add_rca_evidence(
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
    if p_citation_target not in ('interview', 'meeting', 'document')
       or p_cited_entity_id is null or p_document_id is not null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(p_citation_label, '')) = '' then
      raise exception 'informe um rótulo para a citação' using errcode = 'check_violation';
    end if;
    -- DM5 S2: the document citation arm is LIVE. It replaces the HC0DM refusal
    -- with an authorization gate — you may only cite what you may READ.
    if p_citation_target = 'document'
       and not app.can_read_document(p_cited_entity_id, auth.uid()) then
      raise exception 'documento indisponível para citação' using errcode = 'HC0D8';
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

-- -----------------------------------------------------------------------------
-- 4. Post-conditions, from the catalog. BOTH directions.
-- -----------------------------------------------------------------------------
do $$
declare
  v_acl text;
  v_cfg text;
  v_secdef boolean;
begin
  select array_to_string(p.proacl, ','), array_to_string(p.proconfig, ','), p.prosecdef
    into v_acl, v_cfg, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'add_rca_evidence';

  if not v_secdef then
    raise exception 'add_rca_evidence lost SECURITY DEFINER';
  end if;
  if v_cfg is distinct from 'search_path=app, public, pg_catalog' then
    raise exception 'add_rca_evidence lost its search_path pin (got %)', v_cfg;
  end if;
  -- LOST-grant direction
  if v_acl not like '%authenticated=X/postgres%' then
    raise exception 'add_rca_evidence lost the authenticated EXECUTE grant (got %)', v_acl;
  end if;
  -- GAINED-grant direction (the blindness 20260927000120 shipped)
  if v_acl like '%=X/postgres%' and v_acl not like '%postgres=X/postgres%' then
    raise exception 'add_rca_evidence gained a PUBLIC EXECUTE grant (got %)', v_acl;
  end if;
  if has_function_privilege('anon',
       'public.add_rca_evidence(uuid,text,text,uuid,text,text,uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'anon can execute add_rca_evidence';
  end if;

  -- The parked lock is gone and the FK replaced it.
  if exists (select 1 from pg_constraint where conname = 'rca_evidence_cited_document_parked') then
    raise exception 'the parked CHECK survived';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'rca_evidence_cited_document_id_fkey' and contype = 'f') then
    raise exception 'the cited_document_id FK was not created';
  end if;
  -- ⚠ Matched on the RAISE, not on the bare code. `prosrc` INCLUDES COMMENTS,
  -- and the first version of this assertion (`like '%HC0DM%'`) fired on the
  -- explanatory comment 70 lines above that merely NAMES the refusal it
  -- replaced — a text match standing in for a behaviour check, failing the
  -- migration on its own prose. The needle now contains `using errcode`, which
  -- only live code carries.
  if (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'add_rca_evidence')
     like '%using errcode = ''HC0DM''%' then
    raise exception 'the HC0DM parked arm survived the replace';
  end if;
end $$;

commit;
