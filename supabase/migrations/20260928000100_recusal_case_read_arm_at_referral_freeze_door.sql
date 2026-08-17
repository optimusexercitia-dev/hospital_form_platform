-- FUP-DM4-RECUSAL — a recused coordinator could freeze a case's PHI documents
-- into a referral and read them through the referral corridor.
--
-- Found by `qa` at DM4 r1 (MAJOR-3) and DEMONSTRATED LIVE in a rolled-back
-- transaction, not inferred from reading code. For one user and one case,
-- simultaneously:
--
--     app.can_read_case(caseA, u)                     = false   <- recused
--     app.can_manage_referral_source(ref on caseA, u) = true
--     app.can_read_referral_phi(ref on caseA, u)      = true    <- reaches PHI
--
-- Two authorization planes that were each individually correct: ADR 0119 D4
-- reasoned about exactly this seam for the D15 CLEARANCE plane and never
-- considered the CASE-CAPABILITY plane. Same shape as the standing lesson
-- "an exclusion is only as strong as its weakest mutator" — the excluded party
-- reaches the content by a route the exclusion never modelled.
--
-- PO ruling 2026-08-17 (ADR 0122, overturning the 2026-08-14 deferral to Phase 19): fix
-- now, BOTH arms. The deferral was legitimate only while `documents_wave_c`
-- ships OFF, and this item's deadline is the flag-on date itself — a Phase 19
-- access plane that only WIDENS could never have closed it.
--
-- ⚠ TWO ARMS, ONE GUARD, PLACED ABOVE THE DISPATCH — deliberately.
-- The filed item names the `document` arm. Reading the live body for this fix
-- showed the `narrative` arm has the SAME omission: it freezes
-- `case_narratives.body_md` from the source case with no case-read check
-- either. A guard added inside the document arm would have closed the reported
-- instance and left its sibling open — precisely the shape that cost
-- BUG-DM5-S3-INACTIVE-PRINT-1 and is filed as FUP-DM5-SIBLING-GUARD-DIFF.
-- So the term goes ABOVE the `p_kind` dispatch, where no present or future arm
-- can omit it, mirroring how `app.can_read_document` guards `app.is_active`
-- above its own type dispatch.
--
-- ⚠ SCOPE, stated so it is not mistaken for an oversight: the guard is
-- `can_read_case`, NOT `can_read_document`. `can_read_case` is the term the
-- ADR-0072 / ETH·E1 exclusion perimeter is actually expressed in, so it is what
-- closes the demonstrated hole. Adding `can_read_document` on top would be a
-- second, tighter narrowing whose blast radius is unmeasured — and this program
-- has already rejected once an authorization change driven by testability
-- rather than by a demonstrated gap (ADR 0120 D12's rejected commission
-- -membership arm). If it is wanted, it needs its own evidence.
--
-- Idiom: a targeted, SELF-VERIFYING replace rather than a pasted full body.
-- Migration file text is stale by design in this repo (bodies are rewritten at
-- runtime), so this asserts its anchor is present exactly once BEFORE editing
-- and asserts the guard is present AFTER — it cannot silently no-op, and it
-- cannot silently clobber a body that moved underneath it.

do $$
declare
  v_def       text;
  v_new       text;
  v_anchor    constant text :=
    'v_referral := app.assert_referral_draft_writable(p_referral_id);';
  v_guard     constant text := E'\n'
    || '  -- FUP-DM4-RECUSAL: referral-SOURCE authority is NOT' || E'\n'
    || '  -- case-read authority. Above the p_kind dispatch on purpose, so' || E'\n'
    || '  -- neither the narrative arm nor the document arm nor any future' || E'\n'
    || '  -- arm can omit it.' || E'\n'
    || '  if not app.can_read_case(v_referral.source_case_id, auth.uid()) then' || E'\n'
    || '    raise exception ''sem permissão para compartilhar conteúdo deste caso''' || E'\n'
    || '      using errcode = ''HC0DM'';' || E'\n'
    || '  end if;';
  v_occurrences int;
  v_acl_before  text;
  v_acl_after   text;
begin
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl, ' | '), '(default)')
    into v_def, v_acl_before
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'add_referral_shared_item'
     and pg_get_function_identity_arguments(p.oid) = 'p_referral_id uuid, p_kind text, p_source_narrative_id uuid, p_source_document_id uuid';

  if v_def is null then
    raise exception 'FUP-DM4-RECUSAL: public.add_referral_shared_item(uuid,text,uuid,uuid) not found — the door this migration narrows does not exist under that identity';
  end if;

  -- Idempotence: if the guard is already in the body, this migration has run.
  if position('can_read_case(v_referral.source_case_id' in v_def) > 0 then
    raise notice 'FUP-DM4-RECUSAL: guard already present — no-op';
    return;
  end if;

  -- The anchor must be unique, or a replace() would edit an unintended site.
  v_occurrences := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_occurrences <> 1 then
    raise exception 'FUP-DM4-RECUSAL: anchor found % time(s), expected exactly 1 — the body moved; re-derive the insertion point from the live catalog', v_occurrences;
  end if;

  v_new := replace(v_def, v_anchor, v_anchor || v_guard);
  execute v_new;

  -- Prove the edit landed. A replace that silently matched nothing would leave
  -- the door exactly as wide as before while this migration reported success.
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl, ' | '), '(default)')
    into v_def, v_acl_after
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_referral_shared_item';

  if position('app.can_read_case(v_referral.source_case_id, auth.uid())' in v_def) = 0 then
    raise exception 'FUP-DM4-RECUSAL: post-replace body does not contain the guard — the narrowing did NOT land';
  end if;

  -- CREATE OR REPLACE preserves the ACL when the signature is unchanged, but
  -- this repo has been bitten by rebuilds that silently lost grants, so the
  -- property is asserted rather than assumed.
  if v_acl_after is distinct from v_acl_before then
    raise exception 'FUP-DM4-RECUSAL: ACL changed across the replace (% -> %)', v_acl_before, v_acl_after;
  end if;
end;
$$;

comment on function public.add_referral_shared_item(uuid, text, uuid, uuid) is
  'Freezes a narrative or document from the referral''s source case into the referral. '
  'Authority is the CONJUNCTION of referral-draft-writable (source authority) and '
  'app.can_read_case on the source case (FUP-DM4-RECUSAL, ADR 0122): source authority '
  'alone let a recused coordinator reach the case''s PHI through the referral corridor. '
  'The case-read term sits ABOVE the p_kind dispatch so no arm can omit it.';
