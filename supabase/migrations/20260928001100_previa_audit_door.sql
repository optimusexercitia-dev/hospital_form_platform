-- `public.log_document_previa` — the EPHEMERAL prévia's audit door.
-- ADR 0125 D3 (audited, no bytes, no registry row) + D6 (authority is source-read).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A DOOR AT ALL, WHEN THE PRÉVIA STORES NOTHING
-- ═══════════════════════════════════════════════════════════════════════════
-- ADR 0125 D3: today `mint_printed_document` writes
-- `app.audit_write('document.minted', …)`, so a prévia path that simply skipped
-- the RPC would silently delete the platform's ability to answer *"was this
-- draft ever printed, and by whom?"* — a capability regression in a system whose
-- Rule 11 pitch is a tamper-evident trail.
--
-- ⭐ AND IT IS THE ONLY HALF THAT CANNOT BE ADDED RETROACTIVELY. Unstored bytes
-- can be re-rendered from the source; an unlogged event is gone.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE GATE IS A NARROWING OVER D6, AND IT BUYS ARM VISIBILITY
-- ═══════════════════════════════════════════════════════════════════════════
-- D6 reasons that the prévia "fails closed on RLS with or without the DEFINER
-- door", because both payload providers read through `src/lib/queries/` under the
-- caller's session. That protection is real but TRANSITIVE: an app-layer route
-- with no `prosecdef` gate is in no ADR 0079 arm's domain (the Amendment 7
-- shape), so nothing would go red if a future edit swapped one of those queries
-- to the admin client.
--
-- Re-gating here on `app.can_view_printed_document` — the SAME gate the mint uses
-- (D11: "anyone who can VIEW the source") — converts that transitive protection
-- into one an arm can see. It is strictly more refusal than D6 specified, never
-- less, so it is wrong-and-safe compatible. ⛔ It does NOT replace the RLS
-- boundary: the route still builds its payload under the caller's session, and
-- this door is reached only after that succeeded.
--
-- ⚠ FOR MEETINGS THIS GATE IS NARROWER THAN `meetings_select` — deliberately.
-- It also requires `app.can_read_full_meeting_content`, false for a case
-- respondent on a case-linked agenda item, or where deliberation text exists and
-- the caller lacks `read_case_deliberation`. `buildMeetingPayload` has NO masked
-- rendering path, so serving that persona would render a partially-blank ata with
-- no indication anything was removed — worse than a refusal. ADR 0126 Amendment 1
-- §D corrects D6's one-line description to "source-read AND unmasked-content".
--
-- ═══════════════════════════════════════════════════════════════════════════
-- RULE 11 SHAPE: *THAT* + *WHO*, NEVER THE PAYLOAD
-- ═══════════════════════════════════════════════════════════════════════════
-- The row records actor (via audit_write's own `auth.uid()`), timestamp, source
-- kind + id, and the template label. No answers, no minutes, no free text, no
-- patient anything — a prévia of a PHI-bearing ata logs that it was printed, not
-- what it said. ADR 0104 D9.3 already puts the Rule 11 PHI-ACCESS row on the
-- domain's own audited reader, so a PHI prévia still logs the read there.
--
-- `entity_type` is the SOURCE KIND, not `'printed_document'`. There is no
-- printed_document — that is the whole point of the ephemeral path — and naming
-- one would put a dangling entity reference in an append-only trail.

create or replace function public.log_document_previa(
  p_source_kind text,
  p_source_id uuid,
  p_template_key text
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
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

  -- Commission scoping for the audit row, per kind. ⚠ This is NOT a
  -- "registration-mirror trio" site: that constraint is on
  -- `mint_printed_document`'s body, and the whole reason this door exists
  -- separately is that the ephemeral path shares none of the mint's machinery.
  if p_source_kind = 'form_response' then
    select r.commission_id into v_commission
    from public.responses r where r.id = p_source_id;
  elsif p_source_kind = 'meeting' then
    v_commission := app.commission_of_meeting(p_source_id);
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
$function$;

-- ---------------------------------------------------------------------------
-- ACL — explicit, because NULL proacl is the DEFAULT and includes PUBLIC
-- ---------------------------------------------------------------------------
revoke all on function public.log_document_previa(text, uuid, text) from public;
grant execute on function public.log_document_previa(text, uuid, text)
  to authenticated, service_role;

-- ⚠ VERIFY FROM THE CATALOG, NOT FROM THE TEXT ABOVE. A `revoke` the caller is
-- not entitled to make is a silent no-op — no error, privilege unchanged — so the
-- statements having run proves nothing. This raises rather than recording a
-- hardening it did not perform.
do $$
declare v_pub boolean; v_auth boolean; v_secdef boolean;
begin
  select has_function_privilege('public', p.oid, 'execute'),
         has_function_privilege('authenticated', p.oid, 'execute'),
         p.prosecdef
    into v_pub, v_auth, v_secdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'log_document_previa';

  if v_pub then
    raise exception 'ACL REGRESSION: public.log_document_previa is still PUBLIC-executable';
  end if;
  if not v_auth then
    raise exception 'GRANT MISSING: authenticated cannot execute public.log_document_previa';
  end if;
  if not v_secdef then
    raise exception 'public.log_document_previa is not SECURITY DEFINER — its gate would not replace RLS';
  end if;
  raise notice 'log_document_previa: PUBLIC revoked, authenticated granted, prosecdef true (catalog-verified).';
end $$;
