-- =============================================================================
-- DM5 S3 · M6 — the four places "a print is not a content document" must BIND
--
-- M3 gave `app.can_write_document` a print arm mirroring
-- `revoke_printed_document`'s authority, and it HAD to grant something: ADR 0120
-- D11 retires superseded print bytes through `file_objects.disposal_state`, whose
-- only entry point is `request_document_disposition` -> `can_write_document`. A
-- print arm returning false would have made D11's retirement mechanism a door
-- nothing can reach.
--
-- This migration bounds what that grant enables. The enumeration is the
-- `can_write_document` CONSUMER set, taken from the catalog rather than from
-- memory (`prosrc ~ 'can_write_document'`, comments stripped): six consumers —
-- `begin_document_upload`, `document_delete_affordances`, `reclassify_document`,
-- `request_document_disposition`, `set_document_confidentiality`,
-- `soft_delete_document`. Each was triaged, and the triage is recorded because
-- "I checked them all" is not reviewable:
--
--   begin_document_upload        → GUARDED here (guard 4). A print's home type
--                                  accepts no user uploads at all.
--   document_delete_affordances  → GUARDED here (guard 5), or it would promise
--                                  an affordance guard 2 refuses.
--   soft_delete_document         → GUARDED here (guard 2). Prints are REVOKED,
--                                  not deleted; a soft-deleted print is
--                                  undownloadable while `printed_documents.status`
--                                  still reads `active` — two answers to one
--                                  question.
--   request_document_disposition → GUARDED here (guard 3), but NARROWLY: refused
--                                  only while the print is still ACTIVE. That is
--                                  what makes D11's "SUPERSEDED bytes retire"
--                                  literal instead of aspirational.
--   reclassify_document          → needs NO guard of its own. It mints a new
--                                  version, so guard 1 refuses it structurally.
--                                  Recorded so a later reader does not "fix"
--                                  this apparent omission.
--   set_document_confidentiality → needs NO guard. An ENFORCING label is already
--                                  refused on a form_response/meeting home by
--                                  `app.guard_document_confidentiality`; a
--                                  non-enforcing label on a print is inert
--                                  metadata. Guarding it would be over-reach.
--
-- ⭐ GUARD 1 IS STRUCTURAL RATHER THAN A CHECK, AND THAT IS THE BEST PART.
-- It needs no GUC, no flag and no caller cooperation, because of an ORDERING
-- that already exists: `mint_printed_document` inserts the `document_versions`
-- row BEFORE the `printed_documents` row (it has to — the registry row's FK
-- points at the version). So at mint time no `printed_documents` row exists yet
-- and the trigger passes; on every LATER insert one does, and the trigger
-- refuses. One trigger closes `begin_document_upload`, `reclassify_document` and
-- any future writer at the table, which is the only place that cannot be
-- forgotten.
--
-- SQLSTATEs verified free against the live catalog before use (the D-block is
-- crowded): HC0DK, HC0DL, HC0DN. `HC0DM` was deliberately skipped — it carries
-- history in the S2 record as a code kept OUT of the error map.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- GUARD 1 — a print's document accepts exactly ONE version, forever.
-- -----------------------------------------------------------------------------
create or replace function app.guard_printed_document_version()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if exists (select 1 from public.printed_documents pd
              where pd.document_id = new.document_id) then
    raise exception
      'um documento emitido não aceita novas versões (emita um novo documento)'
      using errcode = 'HC0DK';
  end if;
  return new;
end;
$$;

revoke all on function app.guard_printed_document_version() from public;

create trigger trg_guard_printed_document_version
  before insert on public.document_versions
  for each row execute function app.guard_printed_document_version();

-- -----------------------------------------------------------------------------
-- GUARD 2 — a print is revoked, never soft-deleted.
-- Rebuilt VERBATIM except for the guard; the DO block below re-asserts the
-- catalog properties a CREATE OR REPLACE can silently drop.
-- -----------------------------------------------------------------------------
create or replace function public.soft_delete_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    raise exception 'apenas a coordenação pode remover este documento'
      using errcode = '42501';
  end if;
  -- DM5 S3 GUARD 2. AFTER the authority check, deliberately: authority first is
  -- this corridor's M1·4 ordering, and it also means a caller who may not write
  -- the document learns nothing about whether it is a print.
  if exists (select 1 from public.printed_documents pd
              where pd.document_id = p_document_id) then
    raise exception
      'um documento emitido não pode ser removido — use a anulação'
      using errcode = 'HC0DL';
  end if;
  if exists (select 1 from public.document_legal_holds h
              where h.document_id = p_document_id and h.released_at is null) then
    raise exception 'documento sob retenção legal — remoção bloqueada' using errcode = 'HC0D3';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;
  update public.documents
     set status = 'soft_deleted', deleted_at = now()
   where id = p_document_id and status = 'active';
  perform app.audit_write(
    'document.soft_deleted', 'document', p_document_id, v_commission,
    'Documento removido (remoção reversível)', '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- GUARD 3 — disposition only once a print is no longer the ACTIVE one.
-- This is the guard that makes D11 literal: "SUPERSEDED bytes retire via
-- file_objects.disposal_state".
-- -----------------------------------------------------------------------------
create or replace function public.request_document_disposition(p_document_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  perform app.assert_documents_enabled();
  if not app.can_write_document(p_document_id, v_uid) then
    raise exception 'apenas a coordenação pode solicitar o descarte deste documento'
      using errcode = '42501';
  end if;
  -- DM5 S3 GUARD 3 — NARROW ON PURPOSE. D11 retires SUPERSEDED print bytes;
  -- disposing the bytes of the CURRENTLY ACTIVE print would leave the registry
  -- announcing an active document whose bytes are gone, and
  -- `lookup_printed_document` would keep answering "active" for it. Supersede or
  -- revoke it first. Note this refuses on the PRINT's status, not the document's.
  if exists (select 1 from public.printed_documents pd
              where pd.document_id = p_document_id and pd.status = 'active') then
    raise exception
      'não é possível descartar os arquivos de um documento emitido ativo — substitua ou anule primeiro'
      using errcode = 'HC0DN';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.document_legal_holds h
              where h.document_id = p_document_id and h.released_at is null) then
    raise exception 'documento sob retenção legal — descarte bloqueado' using errcode = 'HC0D3';
  end if;
  select s.commission_id into v_commission
    from public.documents d join public.securable_resources s on s.id = d.home_resource_id
   where d.id = p_document_id;

  -- Document level: reads of the aggregate fail closed at once.
  update public.documents set status = 'disposal_pending' where id = p_document_id;
  -- File level: every bound file of every version enters the disposal machine.
  update public.file_objects f
     set disposal_state = 'disposal_pending', disposal_reason_category = p_reason
   where f.disposal_state = 'none'
     and f.id in (select vf.file_object_id
                    from public.document_versions dv
                    join public.document_version_files vf on vf.document_version_id = dv.id
                   where dv.document_id = p_document_id);

  perform app.audit_write(
    'document.disposition_requested', 'document', p_document_id, v_commission,
    'Descarte de documento solicitado',
    jsonb_build_object('reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- GUARD 4 — `form_response` is a PRINT-ONLY home; it accepts no user uploads.
-- Refused with P0002, this door's own absence-equals-denial idiom, so it stays
-- consistent with every other refusal it makes and discloses nothing.
-- ⚠ Not a narrowing of any live reach: `form_response` became a securable type
-- in migration …000300, in this same slice, so nothing could ever have used it.
-- -----------------------------------------------------------------------------
create or replace function public.begin_document_upload(
  p_resource_type text,
  p_resource_id uuid,
  p_title text,
  p_description text default null,
  p_confidentiality_level text default null,
  p_document_id uuid default null,
  p_declared_file_name text default null,
  p_declared_mime text default null,
  p_declared_size bigint default null,
  p_kind text default null,
  p_occurred_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.securable_resources;
  v_tier text;
  v_bucket text;
  v_doc_id uuid;
  v_version_no int;
  v_version_id uuid := gen_random_uuid();
  v_file_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_cap bigint;
  v_mimes text[];
begin
  perform app.assert_documents_enabled();
  -- DM3 QA MAJOR-1: Wave B's flag gates the corridor at its FIRST
  -- residue-producing step. Scoped to the home type so Wave A is untouched.
  if p_resource_type = 'controlled_document' then
    perform app.assert_documents_wave_b_enabled();
  end if;
  -- DM4: same rule, Wave C's flag, same scoping (ADR 0119 D6).
  if p_resource_type = 'case_referral' then
    perform app.assert_documents_wave_c_enabled();
  end if;

  -- DM5 S2 M8: the FIRST residue-producing step for the NSP evidence corridor.
  -- Home-type-scoped, mirroring the wave_b / wave_c arms directly above.
  if p_resource_type in ('rca', 'capa_action') then
    perform app.assert_documents_wave_d_enabled();
  end if;

  -- DM5 S3 GUARD 4: `form_response` exists as a securable type ONLY so a print
  -- of a form response has a home (ADR 0120 D1/D6). No user-uploaded document
  -- homes there, and `app.can_read_document` / `can_write_document` give that
  -- type no arm of its own — so admitting an upload here would create a document
  -- readable and writable by NOBODY. Refused before anything is reserved.
  if p_resource_type = 'form_response' then
    raise exception 'recurso não encontrado' using errcode = 'P0002';
  end if;

  if v_uid is null or not app.is_active(v_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select * into v_res from public.securable_resources s
   where s.id = p_resource_id and s.resource_type = p_resource_type;
  if v_res.id is null then
    -- absence ≡ denial (oracle-kill): same error as the authority failure below
    raise exception 'recurso não encontrado' using errcode = 'P0002';
  end if;

  -- Tier is SERVER-derived (ADR 0118): the two Class-1 PHI module homes take
  -- the phi bucket conservatively; meeting/action_item take standard. Never a
  -- caller input. DM4: case_referral joins the phi set — reply attachments
  -- are Rule-12 referral PHI, like the retired referral-attachments bucket.
  v_tier := case when p_resource_type in ('case', 'interview', 'case_referral')
                 then 'phi' else 'standard' end;
  v_bucket := case v_tier when 'phi' then 'documents-phi' else 'documents-standard' end;

  -- Declared hints validated against the bucket caps (the REAL enforcement is
  -- the storage policy + finalize's server-derived values — D9).
  select b.file_size_limit, b.allowed_mime_types into v_cap, v_mimes
    from storage.buckets b where b.id = v_bucket;
  if p_declared_size is not null and p_declared_size > v_cap then
    raise exception 'arquivo excede o tamanho máximo permitido' using errcode = 'HC0DF';
  end if;
  if p_declared_mime is not null and not (p_declared_mime = any (v_mimes)) then
    raise exception 'tipo de arquivo não permitido' using errcode = 'HC0DG';
  end if;

  if p_document_id is null then
    v_doc_id := gen_random_uuid();
    -- The S1 seam guard validates the label here (HC0D6 for an enforcing label
    -- on a meeting/action_item home).
    -- kind is UNCHECKED text in the DB (no CHECK constraint, deliberately —
    -- the closed per-home vocabulary is product/UI surface, exported from the
    -- TS contract; a SQL CHECK would take a migration per vocabulary change).
    insert into public.documents (id, home_resource_id, title, description, kind,
                                  occurred_on, status, confidentiality_level, created_by)
    values (v_doc_id, p_resource_id, p_title, p_description, p_kind,
            p_occurred_on, 'active', p_confidentiality_level, v_uid);
    v_version_no := 1;
  else
    v_doc_id := p_document_id;
    perform 1 from public.documents d
      where d.id = v_doc_id and d.home_resource_id = p_resource_id
      for update;                         -- serializes version numbering
    if not found then
      raise exception 'recurso não encontrado' using errcode = 'P0002';
    end if;
    select coalesce(max(dv.version_number), 0) + 1 into v_version_no
      from public.document_versions dv where dv.document_id = v_doc_id;
  end if;

  -- THE authority check (canonical door; insert-then-check is atomic).
  if not app.can_write_document(v_doc_id, v_uid) then
    raise exception 'recurso não encontrado' using errcode = 'P0002';
  end if;

  -- ⚠ A print's document is ALSO refused here, structurally, by GUARD 1 on this
  -- insert — not by a check in this body. That is deliberate: a table-level
  -- trigger cannot be forgotten by a future writer, and this door is not the
  -- only writer of document_versions.
  insert into public.document_versions (id, document_id, version_number, created_by)
  values (v_version_id, v_doc_id, v_version_no, v_uid);

  insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
  values (v_file_id, v_bucket,
          v_res.organization_id::text || '/' || v_file_id::text || '/' || gen_random_uuid()::text,
          v_tier, v_uid);

  insert into public.upload_sessions (id, file_object_id, document_version_id, reserved_by, expires_at)
  values (v_session_id, v_file_id, v_version_id, v_uid, now() + interval '15 minutes');

  perform app.audit_write(
    'document.upload_started', 'document', v_doc_id, v_res.commission_id,
    'Envio de documento iniciado',
    jsonb_build_object('version_number', v_version_no));

  return jsonb_build_object(
    'upload_session_id', v_session_id,
    'document_id', v_doc_id,
    'document_version_id', v_version_id,
    'file_object_id', v_file_id,
    'expires_at', (now() + interval '15 minutes'));
end;
$$;

-- -----------------------------------------------------------------------------
-- GUARD 5 — the affordance must not promise what guard 2 refuses.
-- -----------------------------------------------------------------------------
create or replace function public.document_delete_affordances(p_document_ids uuid[])
returns table(document_id uuid, can_delete boolean)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select d.id,
         app.can_write_document(d.id, auth.uid())
         and not exists (select 1 from public.document_legal_holds h
                          where h.document_id = d.id and h.released_at is null)
         -- DM5 S3 GUARD 5: a printed rendition is never deletable (guard 2), so
         -- the affordance must not offer it. Server-computed, never derived
         -- UI-side — the canOpen principle.
         and not exists (select 1 from public.printed_documents pd
                          where pd.document_id = d.id)
    from public.documents d
   where d.id = any (p_document_ids);
$$;

-- -----------------------------------------------------------------------------
-- Verification, FROM THE CATALOG.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn text;
begin
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.document_versions'::regclass
                    and tgname = 'trg_guard_printed_document_version'
                    and not tgisinternal) then
    raise exception 'DM5 S3 M6: guard 1 (the version trigger) is missing';
  end if;

  -- Every rebuilt door must keep prosecdef + its search_path pin + the
  -- authenticated EXECUTE grant, and must NOT have gained a PUBLIC grant. A
  -- CREATE OR REPLACE keeps the ACL, but a DROP+CREATE re-applies Postgres's
  -- DEFAULT (EXECUTE TO PUBLIC) — this migration's sibling …000330 was caught
  -- doing exactly that on a SECURITY DEFINER PHI byte path, and it FAILED CLOSED
  -- while doing it, so no behavioural test could have seen it. A rebuild does
  -- not only LOSE properties: it GAINS the default, and the gained one is worse.
  foreach v_fn in array array[
    'soft_delete_document', 'request_document_disposition',
    'begin_document_upload', 'document_delete_affordances'
  ] loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_fn
                      and p.prosecdef
                      and p.proconfig @> array['search_path=app, public, pg_catalog']) then
      raise exception 'DM5 S3 M6: %() lost prosecdef or its search_path pin', v_fn;
    end if;
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                        aclexplode(p.proacl) x
                    where n.nspname = 'public' and p.proname = v_fn
                      and x.privilege_type = 'EXECUTE'
                      and x.grantee = 'authenticated'::regrole) then
      raise exception 'DM5 S3 M6: %() lost its authenticated EXECUTE grant', v_fn;
    end if;
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                    aclexplode(p.proacl) x
                where n.nspname = 'public' and p.proname = v_fn
                  and x.privilege_type = 'EXECUTE' and x.grantee = 0) then
      raise exception 'DM5 S3 M6: %() gained a PUBLIC EXECUTE grant', v_fn;
    end if;
  end loop;

  -- The two consumers deliberately left UNGUARDED must still be unguarded, so
  -- that a future reader can see the omission is a decision. Asserted as an
  -- ABSENCE, which is only meaningful because the guard's own table name is what
  -- we look for: if someone adds a guard, this fails and they must read the
  -- header's triage rather than silently disagree with it.
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'set_document_confidentiality')
     ~ 'printed_documents' then
    raise exception
      'DM5 S3 M6: set_document_confidentiality gained a print guard — read the triage in this migration''s header first';
  end if;
end;
$$;

commit;
