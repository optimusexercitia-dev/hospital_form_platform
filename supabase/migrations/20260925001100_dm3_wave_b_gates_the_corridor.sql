-- =============================================================================
-- DM3 · M11 — `documents_wave_b` gates the CORRIDOR, not only its last step.
-- QA MAJOR-1 (docs/reviews/dm3-controlled-documents-review.md).
--
-- ⚠ THE DEFECT. Exactly ONE function asserted the flag:
-- `attach_controlled_document_version_file` — the FINAL pointer write. With
-- `documents_wave_b = false` a coordinator could still:
--     create_controlled_document   → ACCEPTED
--     begin_document_upload        → ACCEPTED  (server-side path RESERVED)
--     PUT the bytes                → they LAND in documents-standard
--     finalize_document_upload     → ACCEPTED  (file verified + bound)
--     attach_…                     → REFUSED, HC0D7
-- so the flag controlled what got RECORDED, not what HAPPENED. Residue on every
-- attempt: orphaned bytes, an orphaned core `document_version`, and a draft
-- whose file never appears.
--
-- Not an authz hole — authority is unchanged and was verified so (an outside
-- approver reads but cannot write, 42501 at the door; a plain member and an
-- outside approver both get P0002 at begin). It is a FLAG-CONTRACT defect, and
-- the tree asserted the opposite TWICE, in `seed.sql` and in
-- `src/lib/documents/actions.ts` — both corrected in the same commit as this.
-- A stale comment is bad; a stale comment that states the security contract is
-- the class that ships defects.
--
-- ⚠ WHY `begin_document_upload` AND NOT EARLIER OR LATER. Reserving the path is
-- the FIRST step that produces residue: before it nothing exists, after it a
-- file object, an upload session and a signed PUT credential all do. Gating
-- `finalize` would be too late (bytes already landed); gating only `create`
-- would leave the corridor open to anyone holding a document id.
--
-- ⚠ WHY THE ASSERT IS SCOPED TO THE HOME TYPE, not placed at the top of the
-- door. `begin_document_upload` serves EVERY home — case, meeting, interview,
-- action_item and now controlled_document. A blanket assert would satisfy the
-- new keystone and silently kill Wave A, which is live. DM3·T3b is the control
-- that catches exactly that mistake: with wave_b OFF, a CASE-homed upload must
-- still begin.
--
-- Red-first: DM3·T3 was authored and observed RED against this catalog —
-- "caught: no exception", the door accepting with the flag off.
-- =============================================================================

do $rewrite$
declare src text; mutated text;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'begin_document_upload';

  mutated := replace(src,
'  perform app.assert_documents_enabled();',
'  perform app.assert_documents_enabled();
  -- DM3 QA MAJOR-1: Wave B''s flag gates the corridor at its FIRST
  -- residue-producing step. Scoped to the home type so Wave A is untouched.
  if p_resource_type = ''controlled_document'' then
    perform app.assert_documents_wave_b_enabled();
  end if;');

  -- A no-op replace would ship the door still open while this migration reported
  -- success — the exact way the original gap survived review.
  if mutated = src then
    raise exception 'M11: begin_document_upload anchor drifted — refusing to ship an ungated corridor';
  end if;

  execute mutated;
end $rewrite$;
