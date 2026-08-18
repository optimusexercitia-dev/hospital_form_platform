-- FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT — refuse to delete a response that
-- still has an ACTIVE printed document. Re-ruled 2026-08-18 after the first
-- ruling ("refuse the mint from a non-submitted response") was WITHDRAWN for
-- reversing ADR 0104 D7, which ratifies RASCUNHO prints of in_progress
-- responses and states outright that completeness does not gate minting.
--
-- THE DEFECT, mechanically:
--   `mint_printed_document` anchors permissions by inserting
--   `securable_resources (id, resource_type) values (p_source_id, p_source_kind)`
--   — the anchor's id IS the response's id. But `securable_resources` is
--   POLYMORPHIC (responses, meetings, cases, controlled documents), so it can
--   carry no FK to `responses`: an FK names exactly one target table. Postgres
--   therefore does not know the two rows are related and cannot cascade.
--   Meanwhile `responses_delete_own_draft` permits DELETE only for
--   (created_by = auth.uid() AND status = 'in_progress') — so the ONLY
--   deletable responses are drafts, which is exactly the set D7 allows printing.
--   `discard_response` names neither `printed_documents` nor
--   `securable_resources`; it is blind. Delete the draft and the print survives
--   with its bytes, its registry row and a securable that has no subject, while
--   every internal projection joins through the vanished response and shows it
--   on zero screens.
--
-- WHY BLOCK RATHER THAN CASCADE:
--   A printed document has LEFT THE SYSTEM. It carries a verification token and
--   short code, and `/verificar` is a public route. Voiding it is a deliberate
--   act with a reason — `revoke_printed_document` — not a side effect of
--   discarding an unrelated draft. Blocking forces that decision to be made
--   explicitly, and it needs no disposal outflow, so unlike cascade-disposal it
--   is NOT gated on Critical FUP C1.
--
-- WHY `status = 'active'` AND NOT "any print":
--   Measured: `lookup_printed_document` (the public verification door) reads
--   `printed_documents` directly and joins only commissions/hospitals — NEVER
--   `responses` or `securable_resources`. So public verification SURVIVES an
--   orphan. A revoked print must keep its row and bytes precisely so a holder of
--   the paper can still be told it is ANULADO; orphaning that one is correct
--   behaviour, not a leak. Only an ACTIVE print represents a live page.
--
-- WHY A TRIGGER AND NOT AN RLS PREDICATE:
--   Narrowing `responses_delete_own_draft` would make the refusal a SILENT
--   zero-row delete — the caller sees success. A trigger raises, so the UI can
--   say what happened and why.
--
-- ⛔ WHY SECURITY DEFINER — this one is load-bearing, not convention:
--   `printed_documents` carries a SELECT policy. An INVOKER guard would read it
--   under RLS, so a print the deleter cannot see would make the guard find
--   nothing and ALLOW the delete — a guard that FAILS OPEN, which is the exact
--   class this repo has shipped before. DEFINER makes the guard see every print.

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
       and status      = 'active'
  ) then
    raise exception
      'esta resposta possui um documento emitido ativo; anule o documento antes de descartar o rascunho'
      using errcode = 'HC069';
  end if;
  return old;
end;
$$;

comment on function app.guard_response_active_print() is
  'FUP-DM5-DANGLING-PRINT: refuses DELETE on a response with an ACTIVE printed '
  'document, so the paper is voided deliberately (revoke_printed_document) '
  'rather than orphaned as a side effect. SECURITY DEFINER because '
  'printed_documents is RLS-protected and an invoker read would fail OPEN.';

-- ⛔ THE ACL IS NOT OPTIONAL, AND THIS WAS CAUGHT BY A GATE, NOT BY FORESIGHT.
-- Created without these two lines, the function takes Postgres' DEFAULT ACL —
-- PUBLIC EXECUTE — and pgTAP `320` U1 (the FUP-ACL-APP-POPULATION census) went
-- RED, moving 237 → 238. A SECURITY DEFINER function that PUBLIC may call
-- directly is a live hazard: the trigger's own body would become a callable
-- door. Executing a trigger does not check EXECUTE on its function, so revoking
-- costs the trigger nothing. The grants mirror the sibling guards
-- (`public.guard_submitted_response`, `app.guard_supersession_coherent`), which
-- both carry {postgres, authenticated, service_role} — a new door inherits every
-- sibling's arm, or it is different for a reason nobody wrote down.
revoke all on function app.guard_response_active_print() from public;
grant execute on function app.guard_response_active_print()
  to authenticated, service_role;

drop trigger if exists guard_response_active_print_trg on public.responses;
create trigger guard_response_active_print_trg
  before delete on public.responses
  for each row
  execute function app.guard_response_active_print();
