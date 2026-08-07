-- =============================================================================
-- QO·A M8 — the oversight reviewer stops at the attachment BYTES layer
-- (lead ruling 2026-08-06, post-probe; ADR 0100 D5/D7, Architecture Rules 1/11).
--
-- LIVE-PROBED FINDING (real reviewer claims, `set local role authenticated`):
-- S7 propagated into a surface the threading list never named —
-- `attachments_obj_select_readable` routes can_read_attachment('case'|
-- 'interview') -> can_read_case -> the S7 arm, so a quality_reviewer read
-- standard-tier case attachment BYTES (probed: 1 object row). Case attachments
-- are free-form and can carry PHI; that byte fetch has NO audit emit — an
-- un-audited PHI-capable read path is a Rule 11 gap and a D5 leak, and "the UI
-- renders no link" is exactly the boundary Rule 1 forbids. (`attachments-phi`
-- was probed CLOSED — it has no SELECT policy at all; the metadata layer keeps
-- its own gate: attachments_select AND attachment_confidentiality_ok.)
--
-- THE CUT: one policy arm. For case/interview-owned paths the bytes ADDITIONALLY
-- require `read_case_deliberation`. Why that bit is exactly the reviewer cut —
-- the load-bearing lattice invariant, RE-VERIFIED here and pinned by mutation:
--
--   EVERY content-conferring source except S7 also confers read_case_deliberation
--   (S1 coordinator: all; S3 grant closure: content=>deliberation; S4 assignment:
--   content+deliberation; S6 NSP: content+deliberation). S7 alone confers content
--   WITHOUT deliberation (ADR 0100 D4, deliberately).
--
-- Consequences, each keystoned in 308 §5:
--   * reviewer: metadata visible (panel renders names — can_read_attachment is
--     untouched), bytes ZERO;
--   * every pre-existing reader: unchanged (holds deliberation wherever it holds
--     content — LOST=0 by the invariant above);
--   * a deliberation-only grantee stays blocked (the can_read_attachment content
--     conjunct still applies — this arm is AND-ed, never a widening);
--   * a GRANTED reviewer (S3, the D6 exception path) reads bytes — the cut is
--     capability-shaped, not identity-shaped: graduation rides grants.
--
-- Failure directions both fail CLOSED: a future arm conferring content-without-
-- deliberation loses bytes (its author meets 308 §5 and this comment), never
-- gains them. If Phase B+ reopens documents for the reviewer, it arrives with an
-- audit emit attached (lead ruling) — never by quietly deleting this conjunct.
-- =============================================================================

alter policy attachments_obj_select_readable on storage.objects
  using (
    (bucket_id = 'attachments'::text)
    and app.can_read_attachment((storage.foldername(name))[1], ((storage.foldername(name))[2])::uuid, auth.uid())
    -- QO·A bytes cut (see header): case/interview bytes additionally require the
    -- deliberation bit — today precisely "any content source except the S7
    -- oversight arm".
    and (
      (storage.foldername(name))[1] not in ('case', 'interview')
      or app.has_case_capability(
           case (storage.foldername(name))[1]
             when 'case' then ((storage.foldername(name))[2])::uuid
             else app.case_of_interview(((storage.foldername(name))[2])::uuid)
           end,
           auth.uid(),
           'read_case_deliberation')
    )
  );

-- Postcondition: the arm landed; the metadata policy was NOT touched (the panel
-- keeps rendering names); attachments-phi still has zero SELECT policies.
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'attachments_obj_select_readable'
        and qual ~ 'read_case_deliberation') <> 1 then
    raise exception 'M8 postcondition: the bytes cut did not land';
  end if;
  if (select qual from pg_policies
      where schemaname = 'public' and tablename = 'attachments'
        and policyname = 'attachments_select') ~ 'read_case_deliberation' then
    raise exception 'M8 postcondition: the METADATA policy must stay untouched';
  end if;
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and cmd = 'SELECT' and qual ~ 'attachments-phi') <> 0 then
    raise exception 'M8 postcondition: attachments-phi must keep ZERO select policies';
  end if;
end $$;
