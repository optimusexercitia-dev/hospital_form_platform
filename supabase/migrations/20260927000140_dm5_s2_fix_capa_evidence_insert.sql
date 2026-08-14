-- =============================================================================
-- DM5 S2 · M5 — BUG-DM5-CAPA-1: CAPA evidence upload has never worked.
--
-- ADR 0120 D15. Kept as its OWN migration, deliberately: its red must be
-- provable against the catalog as it stood BEFORE the fix, and folding it into
-- the substrate migrations would have made that red unreachable.
--
-- ⭐ THE DEFECT. `uploadCapaEvidenceFile` writes `{capa_id}/{action_id}/{uuid}`,
-- but `capa_evidence_obj_insert_writable` gated on
--     app.is_pqs_writer_of(app.hospital_of_event((storage.foldername(name))[1]))
-- resolving segment 1 — a CAPA id — through an EVENT resolver. `hospital_of_event`
-- of a CAPA id finds no event and returns NULL; `is_pqs_writer_of(null)` is
-- false. So the arm was false for EVERY CAPA and EVERY persona: not a
-- misconfiguration for some tenants, a universal failure.
--
-- Its SELECT sibling was correct all along —
-- `can_read_capa((storage.foldername(name))[1], auth.uid())` reads segment 1 as
-- a CAPA id — so a user who could READ the evidence could never UPLOAD it. The
-- pair disagreed about what segment 1 MEANS.
--
-- ⚠ It fails CLOSED. This is an availability defect, not a leak. But an arm
-- that refuses every legitimate writer is not "safe", and nothing noticed
-- because E2E covered only the `link` kind (phase14d-capa.spec.ts) and pgTAP
-- `143` asserted the policies EXIST, never that they ADMIT anything. Existence
-- assertions cannot see a policy that admits nobody.
--
-- ⭐ RE-MEASURED AT THIS HEAD BEFORE THE FIX WAS WRITTEN (3b51c20d, tree clean).
-- 20260927000100 changed CAPA tenancy underneath this policy, so "the red moved"
-- was a live possibility, not a formality. It still reproduces, with a control
-- proving the harness works:
--     CONTROL rca-shaped  {event}/{rca}/x   : ACCEPTED
--     SUBJECT capa-shaped {capa}/{action}/x : REFUSED (42501)
-- The control matters: a subject-only probe would have filed a much wider bug.
-- (The first attempt at this differential wore `active_role='staff'`, so the
-- CONTROL failed too — for the wrong reason. The control is what caught it.)
--
-- THE FIX, and all three arms measured in a rolled-back txn before this file:
--     FIXED    capa-shaped insert          : ACCEPTED  (was 42501)
--     CONTROL  rca-shaped still works      : ACCEPTED  (RCA pair untouched)
--     NEGATIVE staff1.farm, no CAPA authority: REFUSED 42501  (not an over-grant)
-- The negative arm is the one that makes this a fix rather than a widening.
--
-- Segment 1 is now read as a CAPA id by BOTH policies in the pair, and the
-- write predicate is the write-authority function that already exists
-- (`app.can_write_capa`) — reused, never reimplemented. This mirrors the RCA
-- pair's shape (a read predicate on SELECT, a write predicate on INSERT); it
-- does NOT mirror its SEGMENTS, because the two path conventions genuinely
-- differ: RCA is `{event}/{rca}/…` and CAPA is `{capa}/{action}/…`.
-- =============================================================================

begin;

drop policy capa_evidence_obj_insert_writable on storage.objects;

create policy capa_evidence_obj_insert_writable
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and app.can_write_capa(((storage.foldername(name))[1])::uuid, auth.uid())
  );

do $$
declare
  v_pred text;
begin
  select coalesce(with_check, qual) into v_pred
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'capa_evidence_obj_insert_writable';

  if v_pred is null then
    raise exception 'capa_evidence_obj_insert_writable is missing after the rebuild';
  end if;
  if v_pred like '%hospital_of_event%' then
    raise exception 'the EVENT resolver survived on the CAPA insert arm: %', v_pred;
  end if;
  if v_pred not like '%can_write_capa%' then
    raise exception 'the CAPA insert arm does not gate on can_write_capa: %', v_pred;
  end if;

  -- The RCA pair must be untouched — this migration fixes ONE arm of ONE pair,
  -- and the bucket carries FOUR policies in two pairs that are easy to confuse.
  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('nsp_evidence_obj_insert_writable',
                            'nsp_evidence_obj_select_member',
                            'capa_evidence_obj_select_member')) <> 3 then
    raise exception 'the other three nsp-evidence policies are not all present';
  end if;
  -- Rule 6: the bucket stays immutable — no UPDATE/DELETE policy may appear.
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('UPDATE', 'DELETE')
       and coalesce(qual, '') || coalesce(with_check, '') like '%nsp-evidence%'
  ) then
    raise exception 'an UPDATE/DELETE policy appeared on nsp-evidence (Rule 6)';
  end if;
end $$;

commit;
