-- ADR 0121 D4 (PO-ratified) — `disposed` records the evidence for its own claim.
--
-- ── The defect, measured from the live body ────────────────────────────────
--
-- `complete_document_disposal`'s absence check reads **`storage.objects`** — the
-- METADATA table. So `disposal_state = 'disposed'` proves *the metadata row is gone*
-- and **not** that the bytes are gone. That is a persisted record asserting a fact to a
-- regulator (LGPD / ANVISA-RDC / CFM 1821-2007, 20-year retention) on the one record
-- class whose entire purpose is to evidence that PHI was destroyed.
--
-- ⛔ Automating the outflow changes this item's severity BY ITSELF. Today the false
-- assertion is latent — produced by hand, occasionally. A scheduled job produces it
-- systematically, monthly, at scale, and on Cloud the byte proof is unavailable by
-- construction. **Building the D2 job without this would industrialise the defect**,
-- which is why D4 lands FIRST, in front of the job.
--
-- ⭐ This does NOT manufacture a proof that does not exist. On Cloud there still is
-- none. It stops the record from CLAIMING one. That is the whole content of the
-- NO-ANSWER-VS-NOTHING class: an observable proxy substituted for the property that
-- matters, always failing in the reassuring direction.
--
-- The state name stays `disposed`; its MEANING is now defined by the evidence beside
-- it, and the runbook and any regulator-facing export must read the evidence, never
-- the state alone.
--
-- ── Signature change, and why it is safe ───────────────────────────────────
--
-- `p_byte_proof` is added with a DEFAULT so the two live callers keep working
-- unchanged — both pass NAMED arguments (`src/lib/documents/actions.ts:398`,
-- `e2e/phase-f2-attachments.spec.ts:852`), which PostgREST resolves against the
-- default. ⚠ `dispose_case_phi` mentions this door only in a COMMENT; it does not
-- call it (checked in the body, not assumed from the grep hit).
--
-- ⚠ The default is `not_attempted`, deliberately the HONEST value rather than a
-- convenient one. A caller that says nothing has, in fact, attempted no byte proof,
-- and the record will now say so instead of staying silent.
--
-- ⚠ A DROP+CREATE LOSES THE ACL (guards-that-read-right-but-fail-open). The measured
-- pre-state is EXECUTE for `postgres` and `service_role` ONLY — never `authenticated`.
-- It is restored explicitly below and then ASSERTED, rather than trusted to the idiom.

alter table public.file_objects
  add column if not exists disposal_evidence jsonb;

comment on column public.file_objects.disposal_evidence is
  'ADR 0121 D4 — what complete_document_disposal actually VERIFIED at disposal time. '
  '`metadata_absent` is checked by the door; `byte_proof` records which byte-level '
  'proof was available and what it returned. `disposed` alone does NOT mean the bytes '
  'are gone — read this column, never the state alone.';

drop function if exists public.complete_document_disposal(uuid);

create function public.complete_document_disposal(
  p_file_object_id uuid,
  p_byte_proof text default 'not_attempted'
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_f public.file_objects;
  v_bound boolean;
  v_doc uuid;
  v_commission uuid;
  v_provisional boolean;
  v_exempt boolean := false;
  v_lane text;
begin
  perform app.assert_documents_enabled();

  -- D4: a closed vocabulary. An unconstrained free-text proof field would let a
  -- caller write anything into a regulator-facing record, which is the same defect
  -- one layer up.
  if p_byte_proof is null or p_byte_proof not in
       ('local_volume_verified', 'unavailable_on_platform', 'not_attempted') then
    raise exception 'prova de exclusão de bytes inválida' using errcode = 'check_violation';
  end if;

  select * into v_f from public.file_objects where id = p_file_object_id for update;
  if v_f.id is null or v_f.disposal_state <> 'disposal_pending' then
    raise exception 'arquivo não está aguardando descarte' using errcode = 'HC0D9';
  end if;

  select exists (select 1 from public.document_version_files vf
                  where vf.file_object_id = v_f.id) into v_bound;
  select dv.document_id into v_doc
    from public.document_version_files vf
    join public.document_versions dv on dv.id = vf.document_version_id
   where vf.file_object_id = v_f.id
   limit 1;
  if v_doc is not null then
    select s.commission_id into v_commission
      from public.documents d join public.securable_resources s on s.id = d.home_resource_id
     where d.id = v_doc;
  end if;

  select coalesce(bool_or(r.is_provisional), false) into v_provisional
    from public.document_retention r
   where (r.applies_to_tier is null or r.applies_to_tier = v_f.sensitivity_tier);

  -- Exemption lanes through a provisional retention policy (ADR 0118 §10).
  if v_f.disposal_reason_category = 'subject_request' then
    v_exempt := true; v_lane := 'subject_request';
  elsif v_f.disposal_reason_category = 'duplicate' and v_f.sha256 is not null then
    -- EVIDENCE, never a claim: a live, servable, same-sha sibling bound to
    -- the SAME document proves the record survives (last-copy invariant —
    -- the final copy has no sibling and stays behind the gate).
    select exists (
      select 1
        from public.document_version_files vf2
        join public.document_versions dv2 on dv2.id = vf2.document_version_id
        join public.file_objects f2 on f2.id = vf2.file_object_id
       where dv2.document_id = v_doc
         and f2.id <> v_f.id
         and f2.disposal_state = 'none'
         and f2.upload_state in ('clean', 'unscanned_accepted')
         and f2.sha256 is not distinct from v_f.sha256
    ) into v_exempt;
    v_lane := 'duplicate_evidence';
  end if;

  -- ⚠ ADR 0121 D5: `superseded` gets NO exemption lane on purpose. A superseded
  -- print under a provisional retention policy is BLOCKED until ratification. The
  -- inflow MARKS; it does not grant permission to destroy.

  if v_bound and v_provisional and not v_exempt then
    raise exception 'política de retenção provisória — descarte bloqueado até ratificação'
      using errcode = 'HC0DR';
  end if;
  if v_bound and v_provisional and v_exempt then
    perform app.audit_write(
      'document.retention_override', 'document', coalesce(v_doc, v_f.id), v_commission,
      'Descarte prosseguiu sob política de retenção provisória',
      jsonb_build_object('file_object_id', v_f.id, 'lane', v_lane));
  end if;

  -- Verify ABSENCE: the Storage-API delete must already have happened.
  -- ⚠ This reads storage.objects — METADATA. It is the whole reason the evidence
  -- below exists: passing this check proves the row is gone, not the bytes.
  if exists (select 1 from storage.objects o
              where o.bucket_id = v_f.storage_bucket and o.name = v_f.storage_path) then
    raise exception 'objeto ainda presente no armazenamento — descarte não confirmado'
      using errcode = 'HC0D9';
  end if;

  update public.file_objects
     set disposal_state = 'disposed',
         disposed_at = now(),
         -- D4: record what was ACTUALLY verified, beside the state it justifies.
         disposal_evidence = jsonb_build_object(
           'metadata_absent',  true,
           'metadata_source',  'storage.objects',
           'byte_proof',       p_byte_proof,
           'storage_bucket',   v_f.storage_bucket,
           'storage_path',     v_f.storage_path,
           'reason_category',  v_f.disposal_reason_category,
           'verified_at',      now()
         )
   where id = v_f.id;

  if v_doc is not null and not exists (
       select 1
         from public.document_versions dv
         join public.document_version_files vf on vf.document_version_id = dv.id
         join public.file_objects f on f.id = vf.file_object_id
        where dv.document_id = v_doc and f.disposal_state <> 'disposed') then
    update public.documents
       set status = 'disposed', deleted_at = coalesce(deleted_at, now()),
           title = '[removido]', description = null
     where id = v_doc;
    perform app.audit_write(
      'document.disposed', 'document', v_doc, v_commission,
      'Documento descartado (conteúdo removido, registro de governança preservado)',
      jsonb_build_object('byte_proof', p_byte_proof));
  end if;
end;
$function$;

-- Restore the measured pre-drop ACL EXACTLY: postgres + service_role, never
-- authenticated, never PUBLIC.
revoke all on function public.complete_document_disposal(uuid, text) from public;
grant execute on function public.complete_document_disposal(uuid, text) to postgres;
grant execute on function public.complete_document_disposal(uuid, text) to service_role;

do $verify$
declare
  v_acl text;
  v_has_col boolean;
begin
  select coalesce(array_to_string(p.proacl, ' ; '), '(default)') into v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_document_disposal';

  -- A `(default)` ACL here would be PUBLIC-EXECUTABLE — the fail-open a DROP+CREATE
  -- produces silently, and the exact shape 342's S3h3 population assertion exists for.
  if v_acl = '(default)' then
    raise exception 'D4: complete_document_disposal has a NULL proacl — it is PUBLIC-executable';
  end if;
  if position('authenticated=' in v_acl) > 0 then
    raise exception 'D4: complete_document_disposal became authenticated-executable (%)', v_acl;
  end if;
  if position('service_role=X' in v_acl) = 0 or position('postgres=X' in v_acl) = 0 then
    raise exception 'D4: complete_document_disposal lost an expected grantee (%)', v_acl;
  end if;

  -- Exactly ONE function of this name must remain: a leftover single-arg overload
  -- would make every PostgREST call ambiguous, and a leftover with the OLD body
  -- would keep writing state with no evidence.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'complete_document_disposal') <> 1 then
    raise exception 'D4: complete_document_disposal is overloaded — the old signature survived the drop';
  end if;

  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'file_objects'
                    and column_name = 'disposal_evidence') into v_has_col;
  if not v_has_col then
    raise exception 'D4: file_objects.disposal_evidence is missing';
  end if;
end $verify$;
