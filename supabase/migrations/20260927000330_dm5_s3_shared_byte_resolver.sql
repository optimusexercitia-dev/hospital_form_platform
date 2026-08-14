-- =============================================================================
-- DM5 S3 · M4 — the SHARED byte resolver, and both byte doors moved onto it
--                (ADR 0120 D12, PO-ruled)
--
-- D12: printed bytes are served by COMPOSITION. `open_printed_document` keeps
-- what is genuinely its own — `can_view_printed_document` authority, the
-- revoked/superseded overlay, the verification-token path, its
-- `document.downloaded` audit — and obtains COORDINATES through the core
-- resolver. Forced by two facts: `open_document_version` resolves bytes with a
-- hardcoded `rendition_kind = 'source'`, so a print-only version is unopenable
-- through it; and `file_objects` may only live in `documents-standard` /
-- `documents-phi` (`file_objects_bucket_check`), which carry NO SELECT policy
-- precisely because ADR 0114 D8 reserves them for the single audited door.
-- D8 therefore stays literally true: ONE door signs.
--
-- ⭐ `app`-SCOPED, AND THE SCHEMA IS NOT THE ONLY LOCK. D12 requires the shared
-- resolver be unreachable by a direct PostgREST caller. `config.toml` exposes
-- only `public`, so `app` is already out of reach — but that is a
-- configuration, and a configuration is not a boundary. So EXECUTE is granted
-- to `postgres` ONLY and revoked from PUBLIC: even if `app` were exposed
-- tomorrow, `authenticated` could not call it. Belt and braces, cheaply.
--
-- ⭐ IT IS AUTHORIZATION-COMPLETE ON ITS OWN, and that is the whole point of
-- making it shared rather than print-only. It re-applies EVERY authority
-- `open_document_version` applied — the account check, the kernel, the
-- case/interview deliberation gate, the referral PHI tier, the document status
-- and the file serving states — so a FUTURE caller cannot use it as an
-- unguarded byte oracle. A print-only resolver would have been safe by
-- construction but shared nothing, leaving two resolvers to drift; a resolver
-- that trusted its caller would be the "correct door nothing guards" shape.
--   For `form_response` and `meeting` homes the case/interview and referral
--   gates resolve to no-ops, so nothing narrows for prints today. They are
--   there for the homes that will exist later.
--
-- ⭐ THE CONJUNCTION, AND WHICH DIRECTION IS ACTUALLY REACHABLE.
-- Effective authority on a printed download is
--     can_view_printed_document  AND  (is_active AND can_read_document AND …)
-- and after M3 `can_read_document` DELEGATES its print arm to
-- `can_view_printed_document`. So the composition is a STRICT NARROWING:
--   • print-check pass / kernel fail  → REACHABLE, via `is_active = false`
--     (BUG-DM5-S3-INACTIVE-PRINT-1). Keystoned behaviourally at 342 S3c.
--   • kernel pass / print-check fail  → STRUCTURALLY IMPOSSIBLE, because the
--     kernel CONTAINS the print check. Pinned STRUCTURALLY at 342 S3d, from the
--     catalog. No fixture is fabricated for an unreachable state, and the
--     asymmetry is NOT "fixed" by changing the authorization: a proposal to
--     make the arm commission-membership-based was rejected because it would
--     remove print access from targeted respondents and non-member creators —
--     a testability requirement driving an authz change.
--
-- ⛔ ERROR-CODE FIDELITY IS A HARD CONSTRAINT, NOT A NICETY. The resolver raises
-- the SAME SQLSTATEs `open_document_version` raised, in the same order, because
-- existing suites assert them and D-7's refactor purity rule says no existing
-- test may be edited to make this pass. Denial is byte-identical to absence
-- (`P0002`) — the oracle-kill — and NOTHING is audited for a refusal (the D11
-- floor: denials raise, never log).
--
-- ⚠ RECORDED BEHAVIOUR CHANGE, deliberate: a printed document whose bytes are
-- unservable used to reach the route as a row and fail at the Storage download,
-- yielding 503. It now raises HC0D8 inside the door, which the route maps to
-- 404 — one fewer distinguishable state for a prober. No test asserts 503
-- (checked: e2e/pdf-printing-meetings.spec.ts asserts 200 and 404 only).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The shared resolver.
-- -----------------------------------------------------------------------------
create or replace function app.resolve_document_version_bytes(
  p_document_version_id uuid,
  p_rendition_kind text,
  p_uid uuid
)
returns table (
  file_object_id uuid,
  storage_bucket text,
  storage_path text,
  sensitivity_tier text,
  mime_type text,
  size_bytes bigint,
  document_id uuid,
  version_number integer,
  title text,
  created_by uuid,
  commission_id uuid
)
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ver public.document_versions;
  v_doc public.documents;
  v_res public.securable_resources;
  v_file public.file_objects;
  v_case uuid;
begin
  if p_uid is null or not app.is_active(p_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_ver from public.document_versions where id = p_document_version_id;
  if v_ver.id is null then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;
  select * into v_doc from public.documents where id = v_ver.document_id;

  -- THE kernel — home access (incl. the M3 print arm) AND the D15 ceiling.
  -- Denial is byte-identical to absence (oracle-kill), and nothing below runs
  -- for a denied caller.
  if not app.can_read_document(v_doc.id, p_uid) then
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;

  select * into v_res from public.securable_resources where id = v_doc.home_resource_id;

  -- QO·B byte discrimination (P0-1): case- and interview-homed BYTES
  -- additionally require read_case_deliberation — conferred by every content
  -- source EXCEPT the S7 oversight arm. Metadata reach (the kernel, above) is
  -- deliberately WIDER: the reviewer keeps titles (M8), never bytes (M9). A
  -- distinct error is safe here — metadata visibility already discloses
  -- existence to every kernel-passing caller.
  v_case := case v_res.resource_type
    when 'case' then v_doc.home_resource_id
    when 'interview' then app.case_of_interview(v_doc.home_resource_id)
    else null
  end;
  if v_case is not null
     and not app.has_case_capability(v_case, p_uid, 'read_case_deliberation') then
    raise exception 'sem autorização para baixar este documento' using errcode = '42501';
  end if;

  -- DM4 byte discrimination (ADR 0119 D2, same pattern one home over):
  -- referral-homed BYTES require the PHI tier; the kernel above already
  -- granted metadata. Same 42501 reasoning — existence is already disclosed.
  if v_res.resource_type = 'case_referral'
     and not app.can_read_referral_phi(v_doc.home_resource_id, p_uid) then
    raise exception 'sem autorização para baixar este documento' using errcode = '42501';
  end if;

  if v_doc.status in ('disposal_pending', 'disposed') then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_doc.status <> 'active' then
    raise exception 'documento indisponível' using errcode = 'HC0D8';
  end if;

  -- The ONE parameterized line. Everything above and below is identical for
  -- every rendition kind, which is exactly why this is shared rather than
  -- duplicated per door.
  select f.* into v_file
    from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = v_ver.id
     and vf.rendition_kind = p_rendition_kind
   order by vf.created_at desc
   limit 1;
  if v_file.id is null then
    raise exception 'arquivo ainda não disponível' using errcode = 'HC0D8';
  end if;
  if v_file.disposal_state <> 'none' then
    raise exception 'documento descartado' using errcode = 'HC0DD';
  end if;
  if v_file.upload_state not in ('clean', 'unscanned_accepted') then
    raise exception 'arquivo indisponível para download' using errcode = 'HC0D8';
  end if;

  return query select
    v_file.id, v_file.storage_bucket, v_file.storage_path, v_file.sensitivity_tier,
    v_file.mime_type, v_file.size_bytes,
    v_doc.id, v_ver.version_number, v_doc.title, v_doc.created_by,
    v_res.commission_id;
end;
$$;

-- D12: `app`-scoped AND ACL-scoped. Only the two DEFINER doors call it, and
-- they execute as the owner.
revoke all on function app.resolve_document_version_bytes(uuid, text, uuid) from public;
grant execute on function app.resolve_document_version_bytes(uuid, text, uuid) to postgres;

-- -----------------------------------------------------------------------------
-- 2. open_document_version moves ONTO the resolver.
--    Signature and return shape unchanged; every SQLSTATE unchanged; the audit
--    condition unchanged (every PHI-tier open + every open by a non-creator —
--    the D11 floor, exactly).
-- -----------------------------------------------------------------------------
create or replace function public.open_document_version(p_document_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_b record;
begin
  perform app.assert_documents_enabled();

  -- Authority, ceiling, status and serving-state checks all live in the shared
  -- resolver now, raising exactly the codes this door used to raise itself.
  select * into v_b
    from app.resolve_document_version_bytes(p_document_version_id, 'source', v_uid);
  if v_b.file_object_id is null then
    -- Defensive: the resolver raises on every refusal, so this is unreachable.
    -- Kept because an empty resolve MUST NOT read as an authorized open.
    raise exception 'versão de documento não encontrada' using errcode = 'P0002';
  end if;

  -- D11 floor, exactly: every PHI-tier open + every open by a non-creator.
  if v_b.sensitivity_tier = 'phi' or v_uid <> v_b.created_by then
    perform app.audit_write(
      'document.opened', 'document', v_b.document_id, v_b.commission_id,
      'Documento aberto',
      jsonb_build_object('version_number', v_b.version_number));
  end if;

  return jsonb_build_object(
    'document_id', v_b.document_id,
    'document_version_id', p_document_version_id,
    'version_number', v_b.version_number,
    'title', v_b.title,
    'mime_type', v_b.mime_type,
    'size_bytes', v_b.size_bytes,
    'sensitivity_tier', v_b.sensitivity_tier);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. open_printed_document — return shape changes, so this is a DROP + CREATE.
--    ⚠ A DROP+CREATE LOSES THE ACL ([[guards-that-read-right-but-fail-open]]):
--    the pre-change grants were authenticated / postgres / service_role
--    (captured from `aclexplode` before this migration was written). They are
--    re-granted below and re-asserted from the catalog at the end.
-- -----------------------------------------------------------------------------
drop function if exists public.open_printed_document(uuid);

create function public.open_printed_document(p_id uuid)
returns table (storage_bucket text, storage_path text, status text, contains_phi boolean)
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.printed_documents;
  v_overlay boolean;
  v_b record;
begin
  perform app.assert_document_printing_enabled();

  select * into v_row from public.printed_documents where id = p_id;
  if v_row.id is null then
    return;                          -- not found: no row, no audit
  end if;
  -- OPEN_AUTHORITY: download follows CURRENT source access (D11). This is the
  -- print half of D12's conjunction and it stays HERE, in this door, because it
  -- is the only authority that is genuinely this door's own.
  if not app.can_view_printed_document(v_row.source_kind, v_row.source_id, auth.uid()) then
    return;                          -- out of scope: no row, no audit
  end if;

  v_overlay := (v_row.status <> 'active');

  -- D12: BYTE RESOLUTION DELEGATED. This is the second half of the conjunction
  -- and it raises rather than returning empty, so a refusal here reaches the
  -- serving route as an error and becomes a 404 — indistinguishable from the
  -- two `return`s above. Resolution comes BEFORE the audit deliberately: a
  -- refusal must not mint a `document.downloaded` row (the RAISE would roll it
  -- back anyway, but ordering it this way makes the intent readable instead of
  -- accidental).
  select * into v_b
    from app.resolve_document_version_bytes(v_row.document_version_id, 'printed_pdf', auth.uid());
  if v_b.file_object_id is null then
    return;                          -- unreachable (the resolver raises); fail closed
  end if;

  -- Every re-serve is audited (D12) — a download of another member's document
  -- is precisely Rule 11's read-of-another's-data. Records THAT + WHO, never
  -- content.
  perform app.audit_write(
    'document.downloaded', 'printed_document', p_id, v_row.commission_id,
    'Documento PDF baixado',
    jsonb_build_object('overlay_applied', v_overlay, 'status', v_row.status));

  return query select v_b.storage_bucket, v_b.storage_path, v_row.status, v_row.contains_phi;
end;
$$;

-- ⛔ THE REVOKE IS NOT TIDINESS — IT IS THE FIX FOR A WIDENING THIS MIGRATION
-- CAUSED, and the first version of this file shipped without it.
-- A DROP+CREATE does not merely LOSE the old ACL; it re-applies Postgres's
-- DEFAULT, which is `EXECUTE TO PUBLIC`. The captured pre-change ACL had no
-- PUBLIC entry at all (aclexplode: authenticated / postgres / service_role
-- exactly), so re-granting those three still left PUBLIC — and PUBLIC includes
-- `anon`. `open_printed_document` lives in `public`, so PostgREST exposes it as
-- an RPC: the rebuild made an anonymous caller able to invoke a SECURITY
-- DEFINER door on a PHI byte path. It would have failed CLOSED behaviourally
-- (auth.uid() is null, so can_view_printed_document refuses), which is exactly
-- why no test would have caught it — it breaks the "0 first-party public
-- functions anon-executable" population invariant while behaving correctly.
-- Caught only by this file's own catalog assertion, at apply time, on a reset.
-- [[guards-that-read-right-but-fail-open]] — a REBUILD loses properties, and
-- the property it gains is worse than the one it drops.
revoke all on function public.open_printed_document(uuid) from public;
grant execute on function public.open_printed_document(uuid)
  to authenticated, postgres, service_role;

-- -----------------------------------------------------------------------------
-- 4. Verification, FROM THE CATALOG.
-- -----------------------------------------------------------------------------
do $$
begin
  -- The resolver must be app-scoped, DEFINER, and unreachable by a client.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'app'
                    and p.proname = 'resolve_document_version_bytes'
                    and p.prosecdef
                    and p.proconfig @> array['search_path=app, public, pg_catalog']) then
    raise exception 'DM5 S3 M4: the resolver is missing, INVOKER, or unpinned';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'app' and p.proname = 'resolve_document_version_bytes'
                and x.privilege_type = 'EXECUTE'
                and x.grantee in (0, 'authenticated'::regrole, 'anon'::regrole)) then
    raise exception
      'DM5 S3 M4: the shared resolver is EXECUTE-able by PUBLIC/anon/authenticated — D12 requires app-only';
  end if;

  -- The DROP+CREATE must have restored open_printed_document's three grants.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) x
       where n.nspname = 'public' and p.proname = 'open_printed_document'
         and x.privilege_type = 'EXECUTE'
         and x.grantee in ('authenticated'::regrole, 'postgres'::regrole,
                           'service_role'::regrole)) <> 3 then
    raise exception
      'DM5 S3 M4: open_printed_document lost a grant in the DROP+CREATE (ACL loss on rebuild)';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'public' and p.proname = 'open_printed_document'
                and x.privilege_type = 'EXECUTE' and x.grantee = 0) then
    raise exception 'DM5 S3 M4: PUBLIC holds EXECUTE on open_printed_document';
  end if;

  -- BOTH byte doors must now reach the shared resolver, and open_document_version
  -- must no longer carry its own rendition literal — otherwise the "shared"
  -- claim is false and the two can drift again. Comments stripped first.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('open_document_version', 'open_printed_document')
         and regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
             ~ 'resolve_document_version_bytes') <> 2 then
    raise exception 'DM5 S3 M4: a byte door does not reach the shared resolver';
  end if;
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'open_document_version')
     ~ 'document_version_files' then
    raise exception
      'DM5 S3 M4: open_document_version still resolves bindings itself — the resolver is not actually shared';
  end if;
end;
$$;

commit;
