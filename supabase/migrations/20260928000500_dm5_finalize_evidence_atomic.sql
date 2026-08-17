-- FUP-DM5-FINALIZE-ATOMIC — the evidence finalize corridor commits its bytes and its
-- domain row in ONE transaction.
--
-- ── The defect ─────────────────────────────────────────────────────────────
--
-- `finalizeRcaEvidenceUpload` / `finalizeCapaEvidenceUpload` are FOUR round-trips:
--   1. finalize_document_upload(session)
--   2. service-role download + sha256 -> complete_document_upload_verification
--   3. admin read document_versions -> documents (for the title)
--   4. add_rca_evidence / add_capa_action_evidence
--
-- Steps 1-3 commit independently of 4. If 4 refuses -- `assert_rca_writable` raising
-- HC048 because the RCA was locked between `begin` and `finalize` -- the outcome is a
-- VERIFIED, SERVABLE file_object + document_version + `active` document with NO evidence
-- row. The user sees the upload fail; a retry re-enters at `begin_document_upload`, which
-- mints a NEW document. The orphan is never recovered, only accumulated.
--
-- ⭐ And it is INVISIBLE to `scripts/document-reconciliation.mjs`, whose classifier judges
-- `file_objects` against storage and calls that row perfectly healthy -- because at the
-- storage layer it IS. The drift is at the DOMAIN layer, which nothing reconciles. That
-- blindness is why narrowing the window would not have been enough.
--
-- ── Why this shape, and not the two obvious ones ────────────────────────────
--
-- ⛔ NOT "grant the verification door to `authenticated` and wrap it". The measured ACL of
-- `complete_document_upload_verification` is postgres + service_role, NEVER authenticated
-- (`proacl`, read at build time). It takes `p_sha256` + `p_verified` -- an ATTESTATION by
-- the server that downloaded the bytes. Exposing it to `authenticated` would let any JWT
-- holder POST /rest/v1/rpc/... and mark its own upload verified under a fabricated hash,
-- defeating D9 byte verification on a PHI-adjacent corridor. This door keeps the SAME
-- posture: service_role only.
--
-- ⛔ NOT impersonation. Reusing `add_rca_evidence` unmodified would need `auth.uid()` to
-- resolve to the uploader inside a service-role call, i.e. `set_config` on the request
-- claims. `auth.uid()` is `coalesce(request.jwt.claim.sub, request.jwt.claims->>'sub')`
-- (catalog-read) -- TWO GUCs behind a coalesce, so setting the one you thought of leaves
-- the other winning. A guard that reads right and fails open. Declined.
--
-- ✅ The actor is resolved from `upload_sessions.reserved_by` -- written by the
-- USER-SCOPED `begin_document_upload`, never supplied by this caller -- and passed
-- EXPLICITLY to `app.can_write_rca(id, uid)` / `app.can_write_capa(id, uid)`, which both
-- already take an actor parameter. No new act-as surface: this door cannot be pointed at
-- a user who did not open the session.
--
-- ── The ordering IS the fix, not merely the wrapping ────────────────────────
--
-- Authority and both flag gates run BEFORE the verification, not after it. So:
--   * the COMMON refusal (locked RCA, flag off) now costs nothing -- the file object is
--     still `verifying`, nothing is servable, and the existing expiry path reclaims it;
--   * anything failing AFTER verification rolls the verification back with it.
-- Either way there is no state in which bytes are servable and the domain row is absent.
--
-- ⚠ The `document` arm's validation is restated here rather than shared, DELIBERATELY.
-- Extracting a helper would rewrite the bodies of `add_rca_evidence` and
-- `add_capa_action_evidence` -- two live DEFINER doors -- and a body edit ORPHANS a
-- name-keyed door verdict (the sweep keys on the name, the verdict was recorded against
-- the old body). That is a bigger blast radius than the duplication. The duplication is
-- instead pinned EXECUTABLY: `341`'s block J asserts both paths refuse the same inputs
-- with the same SQLSTATEs, so drift between them reddens rather than accumulating.

create or replace function public.complete_evidence_upload_verification(
  p_upload_session_id uuid,
  p_sha256 text,
  p_verified boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_s        public.upload_sessions;
  v_actor    uuid;
  v_doc      uuid;
  v_title    text;
  v_status   text;
  v_home     uuid;
  v_rtype    text;
  v_capa     uuid;
  v_res      jsonb;
  v_evidence uuid;
begin
  perform app.assert_documents_enabled();

  -- ── Resolve the session and the document it is reserved against ──────────
  select * into v_s from public.upload_sessions
   where id = p_upload_session_id for update;
  if v_s.id is null then
    raise exception 'sessão de upload inválida para verificação' using errcode = 'HC0D9';
  end if;

  v_actor := v_s.reserved_by;
  if v_actor is null then
    -- Belt and braces: a session with no reserver has no authority to inherit, and
    -- `can_write_*` with a NULL uid would be a silent fail-OPEN if either predicate
    -- ever gained a null-tolerant arm.
    raise exception 'sessão de upload sem responsável' using errcode = 'HC0D9';
  end if;

  select d.id, d.title, d.status, d.home_resource_id, s.resource_type
    into v_doc, v_title, v_status, v_home, v_rtype
    from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    join public.securable_resources s on s.id = d.home_resource_id
   where dv.id = v_s.document_version_id;
  if v_doc is null then
    raise exception 'documento não encontrado para a sessão' using errcode = 'HC0D9';
  end if;

  -- ── AUTHORITY FIRST. This is the inversion described in the header. ──────
  -- Same predicates and same SQLSTATEs as `assert_rca_writable` / `assert_capa_writable`,
  -- with the actor passed explicitly instead of read from `auth.uid()`.
  if v_rtype = 'rca' then
    if not app.can_write_rca(v_home, v_actor) then
      raise exception 'você não pode editar esta análise de causa raiz' using errcode = 'HC048';
    end if;
  elsif v_rtype = 'capa_action' then
    -- Writability is scoped to the PLAN, while the document is homed on the ACTION --
    -- mirrors `add_capa_action_evidence`, which resolves `capa_action.capa_id` first.
    select ca.capa_id into v_capa from public.capa_action ca where ca.id = v_home;
    if v_capa is null then
      raise exception 'ação não encontrada' using errcode = 'no_data_found';
    end if;
    if not app.can_write_capa(v_capa, v_actor) then
      raise exception 'apenas o NSP pode gerenciar planos de ação' using errcode = '42501';
    end if;
  else
    -- This door exists ONLY for the two evidence corridors. Any other home means the
    -- caller should be on `complete_document_upload_verification` instead; refusing is
    -- what keeps this from becoming a second, wider verification door.
    raise exception 'esta sessão não pertence a um corredor de evidência'
      using errcode = 'HC0D9';
  end if;

  -- Both flag gates the `document` arm of the evidence doors applies, hoisted ahead of
  -- the verification for the same reason as the authority check.
  perform app.assert_patient_safety_enabled();
  perform app.assert_documents_wave_d_enabled();

  -- ── The byte verification, DELEGATED not copied ──────────────────────────
  -- One verifier, no drift: this is the same call the non-evidence corridor makes. It is
  -- reachable from here because this function is DEFINER-owned by postgres, which holds
  -- EXECUTE -- `authenticated` still cannot reach either.
  v_res := public.complete_document_upload_verification(
             p_upload_session_id, p_sha256, p_verified);

  if coalesce(v_res ->> 'upload_state', '') <> 'unscanned_accepted' then
    -- The verifier ruled `failed`. It has already bound the failure to the version
    -- (BUG-DM2-001) so the projection derives `failed`; NO evidence row is minted for
    -- bytes that did not verify. Relayed unchanged.
    return v_res;
  end if;

  if v_status <> 'active' then
    raise exception 'documento indisponível para esta evidência' using errcode = 'HC0D8';
  end if;
  if btrim(coalesce(v_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;

  -- ── The domain row, in this same transaction ─────────────────────────────
  perform set_config('app.in_safety_rpc', 'on', true);

  if v_rtype = 'rca' then
    -- Idempotency: nothing in the schema forbids a second evidence row on one document
    -- (no unique index on `document_id`), and the caller's retry path may re-enter here.
    select e.id into v_evidence from public.rca_evidence e
     where e.document_id = v_doc and e.deleted_at is null limit 1;
    if v_evidence is null then
      perform app.rca_bump_in_progress(v_home);
      insert into public.rca_evidence (rca_id, kind, title, document_id, created_by)
      values (v_home, 'document', btrim(v_title), v_doc, v_actor)
      returning id into v_evidence;
    end if;
  else
    select e.id into v_evidence from public.capa_action_evidence e
     where e.document_id = v_doc and e.deleted_at is null limit 1;
    if v_evidence is null then
      insert into public.capa_action_evidence (action_id, kind, title, document_id, created_by)
      values (v_home, 'document', btrim(v_title), v_doc, v_actor)
      returning id into v_evidence;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);

  return v_res || jsonb_build_object('evidence_id', v_evidence, 'evidence_scope', v_rtype);
end;
$function$;

-- Same posture as the door it delegates to: service_role + postgres, NEVER authenticated.
-- Stated explicitly rather than inherited, because a `create or replace` on a future
-- rebuild would otherwise take whatever the default privileges hand it.
revoke all on function public.complete_evidence_upload_verification(uuid, text, boolean) from public;
grant execute on function public.complete_evidence_upload_verification(uuid, text, boolean) to postgres;
grant execute on function public.complete_evidence_upload_verification(uuid, text, boolean) to service_role;

do $verify$
declare
  v_acl text;
  v_inner text;
begin
  select coalesce(array_to_string(p.proacl, ' ; '), '(default)') into v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_evidence_upload_verification';

  if v_acl = '(default)' then
    raise exception 'FINALIZE-ATOMIC: the new door has a NULL proacl — it is PUBLIC-executable';
  end if;
  if position('authenticated=' in v_acl) > 0 then
    raise exception 'FINALIZE-ATOMIC: the new door became authenticated-executable (%)', v_acl;
  end if;
  if position('service_role=X' in v_acl) = 0 or position('postgres=X' in v_acl) = 0 then
    raise exception 'FINALIZE-ATOMIC: the new door lost an expected grantee (%)', v_acl;
  end if;

  -- The delegation is the whole "one verifier, no drift" claim. Assert the call is
  -- actually there rather than trusting that it was written.
  select p.prosrc into v_inner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_evidence_upload_verification';
  if position('complete_document_upload_verification' in v_inner) = 0 then
    raise exception 'FINALIZE-ATOMIC: the new door does not delegate to the byte verifier';
  end if;

  -- ⚠ And the door it delegates to must STILL be closed to authenticated — the whole
  -- security argument above rests on that, and nothing else in this migration re-checks it.
  select coalesce(array_to_string(p.proacl, ' ; '), '(default)') into v_acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_document_upload_verification';
  if v_acl = '(default)' or position('authenticated=' in v_acl) > 0 then
    raise exception 'FINALIZE-ATOMIC: complete_document_upload_verification is reachable by authenticated (%)', v_acl;
  end if;
end $verify$;
