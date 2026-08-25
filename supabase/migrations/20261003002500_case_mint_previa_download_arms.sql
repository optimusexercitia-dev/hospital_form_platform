-- ============================================================================
-- PDF·P3 (ADR 0144 D5/D7/D8) — the three DOORS the case kind has to enter:
-- the mint, the prévia log, and the download.
--
-- All three are `create or replace` with UNCHANGED signatures, so every ACL is
-- preserved. ⛔ Do not turn any of these into a DROP+CREATE without reading
-- 20261003002400's header: a NULL `proacl` is the DEFAULT and the default is
-- EXECUTE TO PUBLIC.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE IDENTIFIED-VARIANT GATE IS IN **TWO** PLACES, AND BOTH ARE REQUIRED
-- ═══════════════════════════════════════════════════════════════════════════
-- ADR 0144 D8: `… AND app.can_read_case_patient(id)` for the identified
-- variant, applied to **mint AND download alike** (ADR 0104 Amendment A7 — the
-- canonical bytes are always the COMPLETE artifact, so arm-parity is not
-- content-parity).
--
-- ⚠ **WHY THE DOWNLOAD HALF IS NOT OPTIONAL, MEASURED 2026-08-25.**
-- `app.resolve_document_version_bytes` — the shared byte resolver every
-- document download funnels through — gates CASE-HOMED bytes on
-- `app.has_case_capability(case, uid, 'read_case_deliberation')` **and nothing
-- else**. The `case_referral` home eight lines below it in the same function DID
-- get a PHI-tier term (`app.can_read_referral_phi`, ADR 0119 D2). The `case`
-- home never did.
--
--   ⇒ Without the gate below, once a `case_identified` document exists a caller
--     with full-content sight but WITHOUT `read_standard_phi` could download a
--     PDF carrying patient name + MRN + date of birth. A Rule 12 PHI leak.
--
-- ⭐ **State plainly what this is and is not.** This is NOT a pre-existing bug
-- and NOT one this phase opens: **no case-homed document has ever carried PHI
-- bytes — P3 mints the first one.** The gap is latent today and becomes
-- reachable the instant the first `case_identified` mint lands. It is closed in
-- the same migration that makes it reachable.
--
-- ⛔ **THE DISCRIMINATOR IS `template_key`, NEVER `sensitivity_tier`.** The
-- tier-keyed version mirrors the referral arm, needs no template key and looks
-- more elegant — and it is WRONG. ADR 0144 D6 makes `contains_phi` (hence the
-- `phi` tier) true for nearly EVERY case mint **including the de-identified
-- variant**, so a tier-keyed gate would demand PHI capability to download a
-- DE-IDENTIFIED dossier and destroy the entire point of D5's fork. Recorded here
-- because the wrong answer is the more attractive one and will be proposed again.
--
-- ⚠ The two case-print gates deliberately use DIFFERENT discriminators, and that
-- is correct rather than sloppy: **byte DESTRUCTION** (`dispose_case_phi`, next
-- migration) keys on the TIER — what could be inside the bytes; **byte
-- DOWNLOAD** keys on the VARIANT — what this reader is entitled to see.
-- Collapsing them onto one discriminator either leaks PHI or breaks the
-- de-identified variant.
--
-- ⛔ `printed_documents_select` (RLS) is deliberately NOT touched. Metadata
-- reach stays wider than byte reach — the shipped QO·B M8/M9 posture, where an
-- oversight reader keeps titles and never bytes. Knowing that an identified
-- emission EXISTS is not seeing it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. THE MINT DOOR — the case arms of the A8 trio (and nothing else).
--
-- ⚠ The registration-mirror trio stays at EXACTLY THREE kind-conditional sites
-- (template coherence · commission resolution · PHI capability). A FOURTH is
-- ADR 0104 A8's abstraction-leak signal: stop and re-plan, never extend.
--
-- ⭐ ADR 0144 D7's two-simultaneously-current series needed NO fourth site and
-- NO signature change: the variant carrier is `template_key`, which the
-- one-active index (`printed_documents_one_active (source_kind,
-- source_series_id, template_key) WHERE status='active'`) and the supersede
-- statement below ALREADY key on. Lead ruling 2026-08-25 → ADR 0144 Amdt 1.
-- ---------------------------------------------------------------------------

create or replace function public.mint_printed_document(
  p_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_template_key text,
  p_template_version integer,
  p_content_hash text,
  p_verification_token text,
  p_verification_short_code text,
  p_contains_phi boolean default false,
  p_source_revision integer default 0)
returns public.printed_document_public
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
  v_constraint text;
  v_series uuid;
  v_revision integer;
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
  --   case: PDF·P3 — the FIRST kind to accept contains_phi under the D9 per-mint
  --     choice (ADR 0144 D5/D6). ⚠ D6 makes contains_phi presence-derived and
  --     non-suppressible, so it is TRUE for nearly every case mint INCLUDING the
  --     de-identified variant; it is NOT the variant flag. The variant is
  --     `template_key`, gated immediately below.
  --   interview: refused until P4 registers its D9 delegation.
  if coalesce(p_contains_phi, false) and p_source_kind not in ('meeting', 'case') then
    raise exception 'este tipo de documento não permite emissão com dados de paciente'
      using errcode = 'HC0D2';
  end if;

  -- ⭐ …AND THE VARIANT HALF OF SITE 3 (ADR 0144 D8, implemented completely).
  -- D8 says the mint arm is `can_read_case(id) AND <full content> AND
  -- can_read_case_patient(id) for the identified variant`. The first two
  -- conjuncts are in `app.can_view_printed_document` above; the third CANNOT be,
  -- because that function receives no template key and so cannot tell the two
  -- variants apart — gating it there would refuse the DE-IDENTIFIED dossier to
  -- everyone without the PHI door and destroy D5's fork.
  --
  -- ⛔ THIS BELONGS TO SITE 3, NOT SITE 1. Site 3 *is* "PHI capability" — that
  -- is its name and its job. An authorization term inside the template-coherence
  -- site would make that site mean two things, and the trio's entire value is
  -- that each site means exactly one.
  --
  -- ⚠ ZERO NEW AUTHORIZATION SURFACE (ADR 0104 D9's load-bearing sentence,
  -- preserved): this reuses the case domain's OWN existing door. It adds no
  -- predicate, no policy and no capability.
  --
  -- Runs BEFORE template coherence so an unauthorized identified mint answers
  -- 42501 rather than HC0D1 — authority-first, the door's standing M1·4 order.
  if p_source_kind = 'case'
     and p_template_key = 'case_identified'
     and not app.can_read_case_patient(p_source_id, v_uid) then
    raise exception 'sem autorização para emitir a versão identificada deste caso'
      using errcode = '42501';
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
  -- ⭐ TWO keys for one kind (ADR 0144 D7 as amended) — the ONLY kind with more
  -- than one, and the pair IS the variant carrier. Each key is still ONE fixed
  -- template with no section picker (D1) and each has its own
  -- `template-fingerprints.ts` entry — which is STRONGER than one key would be,
  -- since the identified variant renders a patient-identification section the
  -- de-identified one does not.
  if p_source_kind = 'case' and p_template_key not in ('case', 'case_identified') then
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
    from public.responses where id = p_source_id for key share;  -- ADR 0123 D3: orders this mint against the discard path
  elsif p_source_kind = 'meeting' then
    v_commission := app.commission_of_meeting(p_source_id);
  elsif p_source_kind = 'case' then
    -- PDF·P3. No `for key share` twin: the response lock orders the mint against
    -- the DRAFT DISCARD path (ADR 0123 D3), which has no case analogue — a case
    -- is not discardable, and the terminal-state freeze plus the D15 revision
    -- bump are what order a case mint against concurrent content change.
    v_commission := app.commission_of_case(p_source_id);
  end if;
  if v_commission is null then
    raise exception 'registro de origem não encontrado'
      using errcode = 'HC0D1';
  end if;

  -- ADR 0126 D1: the LOGICAL document this print belongs to. One
  -- kind-agnostic call to the series dispatch — NOT a fourth
  -- kind-conditional site.
  v_series := app.print_source_series(p_source_kind, p_source_id);

  -- ADR 0125 D1 / 0126 D5+D10 — REGISTRATION IS DB-ENFORCED. ONE
  -- kind-agnostic call to the dispatch; NOT a fourth kind-conditional site.
  -- Evaluated HERE, inside the mint transaction, which is also what closes
  -- the form_response half of the TOCTOU: if reject_correction fired
  -- mid-render the predicate now returns false and this raises.
  if not app.print_source_registers(p_source_kind, p_source_id) then
    raise exception
      'este registro ainda não está em um estado que permita emissão; use a prévia'
      using errcode = 'HC0DP';
  end if;

  -- COMPARE-AND-MINT (0126 Consequences). The render is out-of-band, so the
  -- caller passes the revision it OBSERVED at render time; a mismatch means
  -- the source moved underneath and the hash would pin bytes of a state that
  -- never coherently registered. Load-bearing for MEETINGS (signed -> held ->
  -- re-signed leaves status identical and revision different); a structural
  -- no-op for form_response, whose TOCTOU the gate above closes instead.
  -- ⭐ Load-bearing for CASES too, and more often: ADR 0144 D15's trigger set
  -- bumps the counter on EVERY dossier-visible content write, so an ordinary
  -- tag rename during the render window raises HC0DU here.
  v_revision := app.print_source_revision(p_source_kind, p_source_id);
  if v_revision is distinct from coalesce(p_source_revision, 0) then
    raise exception
      'o registro foi alterado durante a geração do documento; repita a emissão'
      using errcode = 'HC0DU';
  end if;
  if v_series is null then
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
  -- any future unique constraint it was never meant to. For `meeting` and
  -- `case` the row already exists from that table's own BEFORE INSERT trigger
  -- and this is a no-op; for `form_response` it is created HERE, lazily,
  -- because `responses` deliberately has no trigger: ADR 0120 D17.2 forbids the
  -- backfill a composite FK would have required, and `responses` is the
  -- product's highest-cardinality table — a 1:1 shadow of it in a security
  -- registry, minted for every discarded draft, to serve a rare explicit
  -- action, is the wrong trade. So the ONLY path that creates a home is the
  -- only path that needs one, and a bug here fails loudly at the
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
  -- ⭐ Scoped by `template_key`, which is what lets ADR 0144 D7's two case
  -- variants supersede INDEPENDENTLY over one series. Not a new clause — it was
  -- already here, and finding it already here is why D7 needed no new parameter.
  update public.printed_documents
     set status = 'superseded', superseded_at = now()
   where source_kind = p_source_kind
     and source_series_id = v_series
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
  --
  -- ⛔ `kind = 'printed_rendition'` IS load-bearing for the case kind, in ONE
  -- place: `app.trg_bump_case_revision_documents` excludes it. This insert is
  -- case-homed and runs AFTER compare-and-mint has passed, so a bump here would
  -- advance the counter past the `source_revision` this same transaction is
  -- storing — every case mint would land NOT-CURRENT the instant it succeeded.
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
      id, source_kind, source_id, source_series_id, source_revision, commission_id, template_key, template_version,
      content_hash, contains_phi, status,
      verification_token, verification_short_code, minted_by,
      document_id, document_version_id
    ) values (
      p_id, p_source_kind, p_source_id, v_series, v_revision, v_commission, p_template_key,
      p_template_version, p_content_hash,
      coalesce(p_contains_phi, false), 'active',
      p_verification_token, p_verification_short_code, v_uid,
      v_doc_id, v_version_id
    )
    returning * into v_row;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint not in (
           'printed_documents_verification_token_key',
           'printed_documents_verification_short_code_key') then
        raise;
      end if;
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

-- ---------------------------------------------------------------------------
-- 2. THE PRÉVIA LOG DOOR — the `case` commission arm.
--
-- ⭐ FOUND BY A CATALOG SWEEP, NOT BY THE PLAN. Nine functions in `app`/`public`
-- branch on both 'form_response' and 'meeting'; eight were on the P3 work list.
-- This was the ninth. Its commission-resolution block had no `case` branch, so
-- `v_commission` stayed null and it raised HC0D1 — meaning EVERY case prévia,
-- identified or not, would have 404'd.
--
-- ⚠ It would have passed every planned gate: it is not an authorization defect
-- (no authz arm asks), the mint path is unaffected (a mint-focused pgTAP suite
-- goes green), and the route renders it as the SAME pt-BR 404 it already returns
-- for an unreachable source — i.e. it reads exactly like correct fail-closed
-- behaviour.
--
-- ⛔ This block is NOT a "registration-mirror trio" site. That constraint is on
-- `mint_printed_document`'s body; this door exists separately precisely because
-- the ephemeral path shares none of the mint's machinery. The A8 trio is
-- untouched by this file's second function.
-- ---------------------------------------------------------------------------

create or replace function public.log_document_previa(
  p_source_kind text, p_source_id uuid, p_template_key text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  perform app.assert_document_printing_enabled();

  -- AUTHORITY FIRST (the mint's M1-4 ordering): a caller who cannot view the
  -- source learns nothing else from this door.
  if not app.can_view_printed_document(p_source_kind, p_source_id, auth.uid()) then
    raise exception 'sem autorização para gerar uma prévia deste registro'
      using errcode = '42501';
  end if;

  -- ⛔ A LOCKED SOURCE IS NOT PREVIEWABLE (ADR 0125 D5, the other direction).
  -- The registering half of the fourth cell: a source that REGISTERS must be
  -- EMITTED, never served under a footer that disclaims it. Enforced HERE
  -- because the route logs BEFORE it streams, so a raise means no bytes leave.
  -- ⚠ Kind-agnostic: one call to the dispatch, no per-kind site.
  --
  -- ⚠ CONSEQUENCE FOR THE CASE KIND, stated because it shapes the template: a
  -- case prévia is reachable ONLY while the case is non-terminal, or while it is
  -- terminal AND disposed (both make `print_source_registers` false). On a
  -- disposed case the identifiers are already DELETED, so an "identified" prévia
  -- there degrades to de-identified content under an identified label — which is
  -- why `src/lib/pdf/documents/case.ts` must omit an empty patient block rather
  -- than render an empty heading.
  if app.print_source_registers(p_source_kind, p_source_id) then
    raise exception
      'este registro já está travado; emita o documento em vez de gerar uma prévia'
      using errcode = 'HC0DV';
  end if;

  -- Commission scoping for the audit row, per kind. ⚠ This is NOT a
  -- "registration-mirror trio" site: that constraint is on
  -- `mint_printed_document`'s body, and the whole reason this door exists
  -- separately is that the ephemeral path shares none of the mint's machinery.
  if p_source_kind = 'form_response' then
    select r.commission_id into v_commission
    from public.responses r where r.id = p_source_id;
  elsif p_source_kind = 'meeting' then
    v_commission := app.commission_of_meeting(p_source_id);
  elsif p_source_kind = 'case' then
    v_commission := app.commission_of_case(p_source_id);   -- PDF·P3
  end if;
  if v_commission is null then
    -- Unreachable via the gate above (an unknown kind fails closed there), so
    -- this is a backstop rather than a caller-facing path.
    raise exception 'registro de origem não encontrado' using errcode = 'HC0D1';
  end if;

  -- ⛔ `p_template_key` is a LABEL here, not an authorization input, and it is
  -- deliberately NOT re-validated for kind coherence. The mint owns that rule
  -- (its trio site 1); duplicating it would create a second site for one rule —
  -- this codebase's recurring drift class — and a wrong label in an audit row is
  -- not a security event, whereas two authorities that can disagree is.
  --
  -- ⚠ PDF·P3, stated so it is a DECISION rather than an omission: this door does
  -- NOT gate 'case_identified' on `app.can_read_case_patient`, unlike the mint
  -- and download doors. It does not need to. A prévia produces no stored bytes
  -- and no registry row, and the identifiers it would render come from
  -- `public.get_case_patients` — an audited DEFINER reader that returns NULL to
  -- an unentitled caller entirely on its own. So the PHI protection on this path
  -- is the domain's own door (ADR 0144 D5: "zero new PHI authorization surface").
  --
  -- ⛔ **AND THE PRÉVIA ROUTE'S ORDERING IS LOAD-BEARING FOR THAT CLAIM. NAME IT
  -- HERE, BECAUSE THIS DOOR CANNOT SEE IT.** `src/app/api/previa/[kind]/[id]`
  -- runs BUILD → RENDER → **LOG** → STREAM. An unentitled identified prévia dies
  -- in the provider (`get_case_patients` returns null ⇒ `buildCasePayload`
  -- throws), so this door is never reached at all: no bytes, no audit row, no
  -- mislabel. If a future edit ever moves the log BEFORE the build, that
  -- guarantee is gone — an unentitled caller would start leaving a
  -- 'case_identified' audit row claiming a variant that was never rendered, and
  -- nothing in this function could notice. Re-check this comment before
  -- reordering that route.
  if p_template_key is null or btrim(p_template_key) = '' then
    raise exception 'modelo de documento ausente' using errcode = 'HC0D1';
  end if;

  perform app.audit_write(
    'document.previa_printed', p_source_kind, p_source_id, v_commission,
    'Prévia de documento gerada',
    jsonb_build_object(
      'template_key', p_template_key,
      'source_kind', p_source_kind,
      'registered', false));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. THE DOWNLOAD DOOR — the second half of D8's identified-variant gate.
--    See this file's header for why it is required and why the discriminator is
--    `template_key` and never `sensitivity_tier`.
-- ---------------------------------------------------------------------------

create or replace function public.open_printed_document(p_id uuid)
returns table(storage_bucket text, storage_path text, status text, contains_phi boolean)
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

  -- ⭐ PDF·P3 (ADR 0144 D8) — THE IDENTIFIED VARIANT, ON THE DOWNLOAD SIDE.
  -- A7 applies the mint arm to "mint AND download alike", and the shared byte
  -- resolver cannot enforce this one: `app.resolve_document_version_bytes` gates
  -- case-homed bytes on `read_case_deliberation` and carries NO PHI-tier term
  -- for the `case` home (measured 2026-08-25 — the `case_referral` home right
  -- below it does). Without this line, a caller with full-content sight but
  -- without `read_standard_phi` could download name + MRN + date of birth.
  --
  -- ⛔ `template_key`, NEVER `sensitivity_tier`: ADR 0144 D6 makes the
  -- DE-IDENTIFIED variant phi-tier too, so a tier-keyed gate would refuse it to
  -- exactly the readers it exists for.
  --
  -- Refuses by `return` — no row, no audit — matching the two refusals above, so
  -- the serving route turns it into a 404 indistinguishable from nonexistent.
  if v_row.source_kind = 'case'
     and v_row.template_key = 'case_identified'
     and not app.can_read_case_patient(v_row.source_id, auth.uid()) then
    return;
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
