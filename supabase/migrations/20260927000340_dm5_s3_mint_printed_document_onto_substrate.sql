-- =============================================================================
-- DM5 S3 · M5 — `mint_printed_document` mints ONTO the core document model
--                (ADR 0120 D6 / D7 / D11 / D13 / D17)
--
-- One print event now produces a 1:1:1:1:1 chain, atomically, in this door:
--   printed_documents  <->  documents  <->  document_versions (v1)
--                      <->  document_version_files ('printed_pdf')
--                      <->  file_objects (documents-standard | documents-phi)
--
-- ⭐ D13 — THE PRINT MINTS ITS OWN `documents` ROW, never a version appended to
-- a content document, and this is forced rather than stylistic.
-- `public.add_referral_shared_item` chooses what to FREEZE into a referral
-- snapshot with `order by dv.version_number desc, vf.created_at desc limit 1`.
-- If prints appended versions to a content document, a referral would silently
-- freeze a printed PDF instead of the source content — invisible to every
-- static gate. Four more consumers share the latest-version-wins assumption
-- (`app._referral_reply_documents`, `public.reclassify_document`,
-- `queries/documents.ts:139`, `:226`) and are safe ONLY under this separation.
-- 342 S3b keystones the separation itself, not merely its consequences.
--   ⚠ Measured while building this: `add_referral_shared_item` is ALREADY
--   double-guarded — it requires `s.resource_type = 'case'` AND
--   `rendition_kind = 'source'`, and a print has neither. So a keystone there
--   goes GREEN on its first run for a reason that has nothing to do with D13.
--   That is the sibling-lock shape this phase keeps paying for, so 342 S3b
--   neutralizes each guard INDEPENDENTLY and reports which one bites.
--
-- ⭐ ONE `documents` ROW PER PRINT EVENT — not one per (source, template) with a
-- version per mint. Decided on a mechanism, not on taste:
-- `request_document_disposition` puts EVERY version of a document into the
-- disposal machine. Under one-row-per-print, D11's "superseded bytes retire via
-- file_objects.disposal_state" retires exactly that print. Under
-- one-row-per-source it would retire the whole print history in one call, and
-- D11 would have no expressible per-print retirement at all.
--
-- ⭐ NO FOURTH KIND-CONDITIONAL SITE. This door's own comment warns that it
-- carries EXACTLY THREE kind-conditional sites (template coherence, commission
-- resolution, PHI capability) and that "a FOURTH kind-conditional site in this
-- door is the abstraction-leak signal — stop and re-plan, never extend."
-- Homing the print therefore had to be TYPE-AGNOSTIC, and it is: after M1 all
-- four `printed_documents.source_kind` values are also `securable_resources`
-- types, and the registry uses a shared PK, so `(p_source_id, p_source_kind)`
-- IS the home — one unconditional upsert, no branch. The door's warning is the
-- reason the design is better, not an obstacle that was worked around.
--   The same rule killed a nicer per-kind pt-BR title. The title is a single
--   constant. It is not user-facing under ADR 0120 D18 (prints are excluded
--   from both content projections).
--
-- ⭐ THE STORAGE COORDINATE IS SERVER-DERIVED AND THE DOOR TAKES NO PATH.
-- `p_storage_path` never existed here and no equivalent is added. The door
-- derives (bucket, path) through the single SQL authority
-- `app.printed_rendition_storage_bucket` / `_storage_path` and refuses HC0D3
-- unless an object exists at exactly that coordinate. Because `p_id` is a fresh
-- uuid uploaded with `upsert: false` BEFORE this RPC, nothing else can occupy
-- that coordinate — so HC0D3 fires IFF the TS-derived coordinate differs from
-- the SQL-derived one. That runtime equality, plus M2's BEFORE INSERT trigger,
-- is what replaces the retired `pd_storage_path_derived` CHECK. It is stronger
-- than a pair of tests, because two independent assertions about two
-- independent constants say nothing about their equality.
--
-- ⭐ SIZE AND MIME ARE SERVER-DERIVED from `storage.objects.metadata` — the
-- `finalize_document_upload` idiom (ADR 0114 D9: the caller's declared values
-- are never trusted). `file_objects.sha256` takes `p_content_hash`, and that is
-- NOT trust-the-client: the bytes are rendered by the Gotenberg sidecar over
-- the private network, hashed, and uploaded ALL INSIDE THE SERVER ACTION
-- (src/lib/pdf-mint/actions.ts + gotenberg.ts). No browser is in the path and
-- no client value reaches this column.
--
-- ⚠ D10 FLAG CHOREOGRAPHY: this corridor now asserts BOTH `document_printing`
-- (the module's own flag, ADR 0104 D15) and `documents_wave_d` (the wave flag,
-- ADR 0120 D10), the latter scoped to this corridor. THEY MUST BE TURNED ON
-- TOGETHER AT DEPLOY. Safe by default because both SHIP OFF —
-- `document_printing` at 20260913000300:18 and `documents_wave_d` by default,
-- forced on for local/E2E by seed.sql only — so no live feature dies while
-- wave_d is off.
--
-- ⚠ HC0D4's EXCEPTION DOMAIN WIDENED STRUCTURALLY BUT NOT REACHABLY, and it is
-- named here because an exception handler swallowing a NEW constraint is the
-- same trap as an untargeted `ON CONFLICT DO NOTHING`. `printed_documents` now
-- carries two more unique constraints (`_document_uniq`, `_document_version_uniq`)
-- which `when unique_violation` would also catch and mis-report as a credential
-- collision. Neither is reachable: both columns are uuids minted in this
-- statement, and the partial-active index cannot collide because supersession
-- runs first. If HC0D4 ever fires without a credential collision, THIS is the
-- paragraph to read.
-- =============================================================================

begin;

create or replace function public.mint_printed_document(
  p_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_template_key text,
  p_template_version integer,
  p_content_hash text,
  p_verification_token text,
  p_verification_short_code text,
  p_contains_phi boolean default false
)
returns printed_document_public
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
  v_org uuid;
  v_hospital uuid;
  v_home_type text;
  v_bucket text;
  v_path text;
  v_tier text;
  v_size bigint;
  v_mime text;
  v_doc_id uuid := gen_random_uuid();
  v_version_id uuid := gen_random_uuid();
  v_file_id uuid := gen_random_uuid();
  v_row public.printed_documents;
begin
  perform app.assert_document_printing_enabled();
  -- DM5 S3 (ADR 0120 D10): the wave flag at this corridor's FIRST
  -- residue-producing step. The corridor is atomic, so the door IS that step.
  -- Corridor-scoped, never blanket — a blanket assert satisfies the new
  -- keystone while silently killing an earlier wave (the DM3 T3b control).
  perform app.assert_documents_wave_d_enabled();

  -- AUTHORITY FIRST (M1·4 order): mint right ≡ source visibility (D11 + A7).
  -- A null uid falls out here too (the dispatch fails closed on null).
  if not app.can_view_printed_document(p_source_kind, p_source_id, v_uid) then
    raise exception 'sem autorização para emitir um documento deste registro'
      using errcode = '42501';
  end if;

  -- PHI capability, per kind (A8) — ⚠ the REGISTRATION-MIRROR TRIO, site 3 of
  -- exactly 3 (template coherence · commission resolution · PHI capability).
  -- A FOURTH kind-conditional site in this door is the abstraction-leak signal
  -- — stop and re-plan, never extend. (DM5 S3 homed the print WITHOUT adding
  -- one; see the header.)
  --   form_response: PHI-free by classification — contains_phi=true refused.
  --   meeting: ACCEPTS contains_phi (A8 conservative labeling, PRESENCE-derived
  --     by the server action — NOT the D9 per-mint patient-identifier choice,
  --     which remains absent for meetings pending its own domain ADR).
  --   case | interview: refused until their phases register the D9 delegation.
  if coalesce(p_contains_phi, false) and p_source_kind <> 'meeting' then
    raise exception 'este tipo de documento não permite emissão com dados de paciente'
      using errcode = 'HC0D2';
  end if;

  -- Template coherence: the registered template set per kind.
  -- ⚠ Registration-mirror trio, site 1 of exactly 3 (A8).
  if p_source_kind = 'form_response' and p_template_key <> 'form_response' then
    raise exception 'modelo de documento inválido para este tipo de registro'
      using errcode = 'HC0D1';
  end if;
  if p_source_kind = 'meeting' and p_template_key <> 'meeting' then
    raise exception 'modelo de documento inválido para este tipo de registro'
      using errcode = 'HC0D1';
  end if;

  -- Amendment A: credential FORMAT is door-enforced; generation is the
  -- action's (the token must be inside the canonical bytes' QR).
  -- Token: URL-safe base64 alphabet, >= 32 chars (>= 192 bits).
  if p_verification_token is null
     or p_verification_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'token de verificação em formato inválido'
      using errcode = 'HC0D1';
  end if;
  -- Short code: exactly 10 chars of the unambiguous alphabet (no I/O/0/1).
  if p_verification_short_code is null
     or p_verification_short_code !~ '^[A-HJ-NP-Z2-9]{10}$' then
    raise exception 'código de verificação em formato inválido'
      using errcode = 'HC0D1';
  end if;

  -- Owning commission, per kind (only reachable for kinds whose visibility
  -- arm exists — everything else already failed the authority check above).
  -- ⚠ Registration-mirror trio, site 2 of exactly 3 (A8).
  if p_source_kind = 'form_response' then
    select commission_id into v_commission
    from public.responses where id = p_source_id;
  elsif p_source_kind = 'meeting' then
    v_commission := app.commission_of_meeting(p_source_id);
  end if;
  if v_commission is null then
    raise exception 'registro de origem não encontrado'
      using errcode = 'HC0D1';
  end if;

  -- -------------------------------------------------------------------------
  -- D6 / D13: THE HOME. Type-agnostic by construction — every print
  -- `source_kind` is also a `securable_resources` type (M1) and the registry
  -- shares the source's PK, so the home IS (p_source_id, p_source_kind). This
  -- is deliberately NOT a fourth kind-conditional site.
  --
  -- The upsert is targeted at (id): an untargeted `do nothing` would swallow
  -- any future unique constraint it was never meant to. For `meeting` (and
  -- later `case` / `interview`) the row already exists from that table's own
  -- BEFORE INSERT trigger and this is a no-op; for `form_response` it is
  -- created HERE, lazily, because `responses` deliberately has no trigger:
  -- ADR 0120 D17.2 forbids the backfill a composite FK would have required,
  -- and `responses` is the product's highest-cardinality table — a 1:1 shadow
  -- of it in a security registry, minted for every discarded draft, to serve a
  -- rare explicit action, is the wrong trade. So the ONLY path that creates a
  -- home is the only path that needs one, and a bug here fails loudly at the
  -- `documents.home_resource_id` FK rather than silently.
  -- -------------------------------------------------------------------------
  select c.organization_id, c.hospital_id into v_org, v_hospital
  from public.commissions c where c.id = v_commission;

  insert into public.securable_resources
    (id, resource_type, organization_id, hospital_id, commission_id)
  values (p_source_id, p_source_kind, v_org, v_hospital, v_commission)
  on conflict (id) do nothing;

  -- The upsert may have done nothing because a row exists with a DIFFERENT
  -- type. Then the FK below would still be satisfied while
  -- `app.can_read_document` dispatched on the wrong arm — so assert the type,
  -- do not assume the upsert won.
  select s.resource_type into v_home_type
  from public.securable_resources s where s.id = p_source_id;
  if v_home_type is distinct from p_source_kind then
    raise exception 'registro de origem não encontrado'
      using errcode = 'HC0D1';
  end if;

  -- -------------------------------------------------------------------------
  -- Server-derived coordinates + AMENDMENT B (the object must already exist:
  -- a registry row never points at a missing object, upload-before-mint).
  -- -------------------------------------------------------------------------
  v_tier := case when coalesce(p_contains_phi, false) then 'phi' else 'standard' end;
  v_bucket := app.printed_rendition_storage_bucket(p_contains_phi);
  v_path := app.printed_rendition_storage_path(p_id);

  select (o.metadata->>'size')::bigint, o.metadata->>'mimetype'
    into v_size, v_mime
    from storage.objects o
   where o.bucket_id = v_bucket and o.name = v_path;
  if v_size is null then
    -- Absence, and "present but without derivable metadata", share this code
    -- on purpose: only ONE of them is caller-reachable (a coordinate mismatch),
    -- so the ambiguity cannot blind a test the way HC0D8's did in S2.
    raise exception 'objeto de armazenamento ausente para esta emissão'
      using errcode = 'HC0D3';
  end if;
  if v_mime is distinct from 'application/pdf' then
    raise exception 'objeto de armazenamento ausente para esta emissão'
      using errcode = 'HC0D3';
  end if;

  -- Supersession (D6) + the whole chain, atomically in this transaction.
  -- SUPERSEDE_ACTIVE: the registry always knows the current print. Runs BEFORE
  -- the insert so `printed_documents_one_active` cannot collide.
  update public.printed_documents
     set status = 'superseded', superseded_at = now()
   where source_kind = p_source_kind
     and source_id = p_source_id
     and template_key = p_template_key
     and status = 'active';

  -- D13: the print's OWN documents row, homed on the source's resource.
  -- confidentiality_level stays NULL — a print carries no clearance label, and
  -- `app.guard_document_confidentiality` would refuse an enforcing one on a
  -- form_response or meeting home anyway. `kind` is decorative: it has no CHECK
  -- and NOTHING branches on it (verified against every `d.kind`/`doc.kind`
  -- consumer). ⚠ It reads English where the only pre-existing value is pt-BR
  -- (`documento_controlado`) — a known cosmetic divergence, deliberately NOT
  -- fixed here: enumerating the vocabulary would drag in the re-key question,
  -- and a name-keyed re-key is a D11-class trap.
  insert into public.documents
    (id, home_resource_id, title, description, kind, status,
     confidentiality_level, created_by)
  values
    (v_doc_id, p_source_id, 'Documento emitido (PDF)', null, 'printed_rendition',
     'active', null, v_uid);

  insert into public.document_versions (id, document_id, version_number, created_by)
  values (v_version_id, v_doc_id, 1, v_uid);

  -- `app.guard_file_object_transition` forces every file object to be BORN
  -- reserved, then walks a named state machine. The mint therefore walks the
  -- REAL machine rather than inserting a terminal state — the same transitions
  -- finalize_document_upload + complete_document_upload_verification perform,
  -- collapsed into this transaction because the mint is atomic.
  insert into public.file_objects
    (id, storage_bucket, storage_path, sensitivity_tier, created_by)
  values (v_file_id, v_bucket, v_path, v_tier, v_uid);

  update public.file_objects
     set upload_state = 'uploaded', uploaded_at = now()
   where id = v_file_id;
  update public.file_objects
     set upload_state = 'verifying', size_bytes = v_size, mime_type = v_mime
   where id = v_file_id;
  update public.file_objects
     set upload_state = 'scan_pending', sha256 = p_content_hash, verified_at = now()
   where id = v_file_id;
  -- D9 interim (O2 accepted): no scanner is integrated. A print is
  -- server-generated rather than user-supplied, but it enters the SAME explicit
  -- auditable accepted state as an upload — inventing a "trusted" state for our
  -- own bytes would be a second liveness authority able to disagree with the
  -- first. Flipping to strict fail-closed remains this one transition.
  update public.file_objects
     set upload_state = 'unscanned_accepted'
   where id = v_file_id;

  -- D11: the bytes are the version's `printed_pdf` rendition. NOT `source` —
  -- that is what keeps `open_document_version` (hardcoded to `source`) unable
  -- to serve a print, and what keeps `add_referral_shared_item` from freezing
  -- one. `document_version_files` itself is untouched by DM5 (the D3/D4/D5
  -- withdrawal).
  insert into public.document_version_files
    (document_version_id, file_object_id, rendition_kind)
  values (v_version_id, v_file_id, 'printed_pdf');

  begin
    insert into public.printed_documents (
      id, source_kind, source_id, commission_id, template_key, template_version,
      content_hash, contains_phi, status,
      verification_token, verification_short_code, minted_by,
      document_id, document_version_id
    ) values (
      p_id, p_source_kind, p_source_id, v_commission, p_template_key,
      p_template_version, p_content_hash,
      coalesce(p_contains_phi, false), 'active',
      p_verification_token, p_verification_short_code, v_uid,
      v_doc_id, v_version_id
    )
    returning * into v_row;
  exception
    when unique_violation then
      -- Amendment A: distinct code — the action re-mints with fresh
      -- credentials (full re-render; the short code is in the bytes).
      -- ⚠ See the header: this handler's structural domain widened with the two
      -- new unique constraints, but neither is reachable.
      raise exception 'colisão de identificador de verificação — repita a emissão'
        using errcode = 'HC0D4';
  end;

  perform app.audit_write(
    'document.minted', 'printed_document', p_id, v_commission,
    'Documento PDF emitido',
    jsonb_build_object(
      'source_kind', p_source_kind,
      'source_id', p_source_id,
      'template_key', p_template_key,
      'template_version', p_template_version,
      'contains_phi', coalesce(p_contains_phi, false),
      'content_hash', p_content_hash,
      -- The substrate linkage, so the trail can be walked from the audit row
      -- to the rendition without a second query (Rule 11: records THAT + WHO,
      -- never payloads — these are identifiers, not content).
      'document_id', v_doc_id,
      'document_version_id', v_version_id));

  -- FUP-PDF-3: project BY NAME onto the granted-column composite — the
  -- withheld columns (verification_token, revoked_by, revoked_reason) never
  -- leave the door, and the two new coordinate columns do not either: the
  -- composite does not declare them, so `jsonb_populate_record` drops them.
  return jsonb_populate_record(null::public.printed_document_public, to_jsonb(v_row));
end;
$$;

-- CREATE OR REPLACE preserves the ACL (same signature, same return type), but
-- assert it rather than assume it.
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) x
       where n.nspname = 'public' and p.proname = 'mint_printed_document'
         and x.privilege_type = 'EXECUTE'
         and x.grantee in ('authenticated'::regrole, 'postgres'::regrole,
                           'service_role'::regrole)) <> 3 then
    raise exception 'DM5 S3 M5: mint_printed_document lost an EXECUTE grant';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'public' and p.proname = 'mint_printed_document'
                and x.privilege_type = 'EXECUTE' and x.grantee = 0) then
    raise exception 'DM5 S3 M5: PUBLIC holds EXECUTE on mint_printed_document';
  end if;

  -- The door must no longer know a storage path of its own, and must reach the
  -- single derivation authority instead. Comments stripped: this door's
  -- comments discuss the coordinate at length.
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'mint_printed_document')
     !~ 'printed_rendition_storage_path' then
    raise exception
      'DM5 S3 M5: the mint door does not use the single storage-path derivation authority';
  end if;
  -- Both flags, both asserted (D10 choreography).
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'mint_printed_document')
     !~ 'assert_documents_wave_d_enabled' then
    raise exception 'DM5 S3 M5: the mint door lost the documents_wave_d assert';
  end if;
end;
$$;

commit;
