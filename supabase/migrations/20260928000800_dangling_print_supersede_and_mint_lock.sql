-- =============================================================================
-- FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT — the closing migration.
-- ADR 0123 D1 + D3. Ruled 2026-08-18.
-- =============================================================================
-- `20260928000700` shipped the delete guard and closed the reported instance.
-- This migration corrects the half of its rationale that was wrong, and closes
-- the concurrency hole beside it that no arm was asking about.
--
-- ── D1 — the guard blocks `superseded` too ───────────────────────────────────
-- 000700 argued: "Only an ACTIVE print represents a live page." That sentence is
-- FALSE by this platform's own ruling. ADR 0120 D6/D8 — established the hard way
-- by the D11 serving collision, where marking a superseded print
-- `disposal_pending` stopped its PDF opening the instant a document was
-- re-issued — says states change the overlay STAMP, NEVER reachability. A
-- superseded print still serves its bytes and still answers /verificar.
--
-- Reachable without exotic input, entirely through supported actions:
--   mint P1  ->  re-mint (the mint's own SUPERSEDE_ACTIVE update flips P1 to
--   `superseded`, as `printed_documents_one_active` requires)  ->  coordination
--   revokes the now-active P2. Zero actives, one superseded, guard opens.
--
-- The exit stays open: `revoke_printed_document` refuses only
-- `status = 'revoked'`, so a superseded row can still be voided. D1 adds no dead
-- end it does not also provide a way out of.
--
-- `revoked` STAYS PERMISSIVE (ADR 0123 D2, restating 000700 so it is not
-- re-litigated): `lookup_printed_document` joins only commissions/hospitals,
-- never `responses`, so public verification SURVIVES an orphan — and a revoked
-- print must keep its row and bytes precisely so a holder of the paper is still
-- told ANULADO. That is the one case where the deliberate act already happened.
--
-- ⚠ THE NAME IS NOW NARROWER THAN THE BEHAVIOUR, AND THAT IS DELIBERATE.
-- `guard_response_active_print` blocks active OR superseded. It is NOT renamed:
-- the name is keyed into pgTAP `312`, the `320` U1 ACL census baseline, the
-- follow-up record and this repo's authz findings files, and a rename orphans
-- every name-keyed verdict at once for a cosmetic gain.
--
-- ── D3 — the mint locks its source ───────────────────────────────────────────
-- The guard is BEFORE DELETE; `mint_printed_document` read `responses`
-- UNLOCKED. Nothing ordered the two, so the guard could pass on an empty
-- registry while a concurrent mint committed a print immediately afterward.
--
-- MEASURED 2026-08-18 in a scratch schema (created, tested, dropped):
--   1. mint reads unlocked (the shipped code) -> delete succeeds, mint commits
--      after -> ORPHAN CREATED.
--   2. mint takes `for key share` first -> delete BLOCKS, then the trigger
--      raises -> no orphan.
--   3. delete first, mint second -> the locked select returns ZERO ROWS.
--
-- Case 2 works because Postgres acquires LockTupleExclusive BEFORE running a
-- BEFORE DELETE row trigger's body, so the body re-reads on a fresh snapshot
-- after the wait. Case 3 needed NO new code: the mint already raises HC0D1 when
-- the source lookup yields null. The whole fix is `for key share` on one select.
--
-- ⚠ NOT PINNABLE BEHAVIOURALLY — pgTAP is single-session, so no keystone can
-- construct the interleaving. `312` pins it STRUCTURALLY instead, from `pg_proc`.
-- That is weaker than a behavioural keystone and is chosen knowingly: the
-- alternative was a comment, and a comment is an assertion that goes stale.
--
-- WHY REWRITE IN PLACE rather than re-paste the body: `mint_printed_document` is
-- ~250 lines redefined by SEVEN prior migrations. Re-pasting it here would make
-- THIS file the authority on 250 lines it does not own, and any drift between
-- the catalog and my paste would ship silently. The house idiom
-- (pg_get_functiondef + replace + execute, cf. 20260709000200) takes the LIVE
-- definition as its input. It has one failure mode — the target string not
-- matching, which `replace` reports as SUCCESS by returning the input unchanged
-- — so the match is asserted on BOTH sides below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D1 — the guard
-- -----------------------------------------------------------------------------
create or replace function app.guard_response_active_print()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if exists (
    select 1
      from public.printed_documents
     where source_kind = 'form_response'
       and source_id   = old.id
       -- ADR 0123 D1: `superseded` is a LIVE page (ADR 0120 D6/D8) — it serves
       -- bytes and answers /verificar. `revoked` is deliberately absent (D2).
       and status      in ('active', 'superseded')
  ) then
    raise exception
      'esta resposta possui um documento emitido em circulação; anule o documento antes de descartar o rascunho'
      using errcode = 'HC069';
  end if;
  return old;
end;
$$;

comment on function app.guard_response_active_print() is
  'FUP-DM5-DANGLING-PRINT (ADR 0123 D1/D2): refuses DELETE on a response holding '
  'a printed document in circulation — `active` OR `superseded`, both of which '
  'still serve bytes and answer /verificar (ADR 0120 D6/D8). `revoked` is '
  'permitted through on purpose: that paper must keep its row so /verificar can '
  'still report ANULADO. SECURITY DEFINER because printed_documents is '
  'RLS-protected and an invoker read would fail OPEN. Name kept narrower than '
  'the behaviour deliberately — see 20260928000800.';

-- ⛔ THE ACL, RESTATED. `create or replace` preserves an existing ACL, so this is
-- belt-and-braces — but `20260928000700` shipped THIS function with Postgres'
-- default PUBLIC EXECUTE and was caught only by the `320` U1 ACL census, with
-- `312` fully green and the door wide open. A SECURITY DEFINER function PUBLIC
-- may call is a live door, not a detail. Stating it costs one line; assuming it
-- cost a red gate last time.
revoke all on function app.guard_response_active_print() from public;
grant execute on function app.guard_response_active_print()
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- D3 — the mint locks its source before creating the print chain
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_sig    text := 'public.mint_printed_document(uuid,text,uuid,text,integer,'
                   || 'text,text,text,boolean)';
  v_target text := 'from public.responses where id = p_source_id;';
  v_repl   text := 'from public.responses where id = p_source_id for key share;'
                   || '  -- ADR 0123 D3: orders this mint against the discard path';
  v_old    text;
  v_new    text;
  v_hits   int;
begin
  v_old := pg_get_functiondef(v_sig::regprocedure);

  -- Assert the target is present EXACTLY once before touching anything. Zero
  -- means a prior migration reshaped this read and the injection point moved;
  -- more than one means the body grew a second source read that would silently
  -- get the same treatment. Both are "stop and look", not "carry on".
  v_hits := (length(v_old) - length(replace(v_old, v_target, '')))
            / length(v_target);
  if v_hits <> 1 then
    raise exception
      'mint_printed_document: expected exactly 1 source read to lock, found %', v_hits;
  end if;

  v_new := replace(v_old, v_target, v_repl);
  if v_new = v_old then
    raise exception 'mint_printed_document: the lock injection was a no-op';
  end if;

  execute v_new;
end
$mig$;

-- POSITIVE CONTROL, read back from the catalog rather than assumed from the
-- `execute` above having not raised.
do $verify$
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'mint_printed_document'
       and p.prosrc ilike '%for key share%'
  ) then
    raise exception
      'mint_printed_document: post-condition failed — the live body carries no row lock';
  end if;
end
$verify$;
