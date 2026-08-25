-- ============================================================================
-- PDF·P3 (ADR 0144 D10 — which AMENDS ADR 0104's retention clause)
-- `dispose_case_phi` gains the printed-document REGISTRY half of the erasure.
--
-- ADR 0104's rollout section says minted PDFs are never deleted and inherit the
-- 20-year CFM retention of their sources. D10 amends that for one narrow case:
-- an LGPD Art. 18 erasure that leaves a name-and-MRN PDF sitting in Storage is
-- not an erasure, and that is a regulator-facing claim, not an internal nicety.
--
-- ⭐ **MOST OF D10 WAS ALREADY BUILT — the delta here is small, and saying so is
--    the point.** Block (f) below ALREADY reaches case-homed `documents`, and a
--    case's printed renditions are case-homed (`mint_printed_document` inserts
--    the print's own `documents` row with `home_resource_id = p_source_id`). So
--    the door already:
--      · redacts `documents.title` / `.description`;
--      · moves every bound `file_objects` row with `sensitivity_tier = 'phi'`
--        and `disposal_state = 'none'` to `disposal_pending` with the caller's
--        reason — phase 1 of the ESTABLISHED two-phase idiom, completed
--        asynchronously by `complete_document_disposal`;
--      · sets `documents.status = 'disposal_pending'`.
--    And `app.resolve_document_version_bytes` already raises on
--    `disposal_pending`/`disposed`, so the download is shut in this same
--    transaction. ⛔ D10 explicitly REUSES that idiom rather than inventing a
--    direct delete, which would have been the THIRD disposal mechanism in one
--    door.
--
--    ⇒ The only thing missing was the REGISTRY: the `printed_documents` rows
--    still read `active` while their bytes were being destroyed. That is what
--    this migration adds, and nothing else.
--
-- ⚠ **WHAT SURVIVES, BY DESIGN.** The registry row, its `content_hash`, its
--    audit trail and its `verification_token` all survive — only the bytes go.
--    That is what keeps `/verificar` honest: it reports a REVOKED document, not
--    a missing one. A vanished token would make an unauthenticated surface say
--    "this never existed" about a document a hospital printed and filed.
--
-- ⛔ **`phi_disposed` IS NOT ADDED TO `revoke_printed_document`'s VOCABULARY.**
--    `revoked_reason_class` has NO table CHECK (constraint list swept from the
--    live catalog 2026-08-25) — the vocabulary
--    (`wrong_data` / `minted_in_error` / `other`) lives INSIDE that door only. So
--    this new class can be written from here without widening the human-facing
--    door, and it MUST NOT be widened there: a human must never be able to claim
--    an Art. 18 erasure happened. The class is a statement about what the
--    PLATFORM did, not a reason a person may select.
--    `src/components/printing/labels.ts` carries its pt-BR label (frontend-owned).
-- ============================================================================

create or replace function public.dispose_case_phi(p_case_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação da comissão pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (qa B2)
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Scoped bypasses for every frozen/submitted PARENT guard this dispose edits.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_narrative_rpc', 'on', true);
  perform set_config('app.in_interview_rpc', 'on', true);
  perform set_config('app.in_submit_rpc', 'on', true);   -- for the answers DELETE (submitted-freeze)
  -- ⛔ CORRECTED COMMENT (ADR 0129 Amdt 2). This used to read
  -- `-- for meeting_cases child-lock`, and that was FALSE against the live guard:
  -- `app.guard_meeting_child_lock` — the trigger on `meeting_cases` — reads
  -- `app.in_disposal_rpc` and has never read `app.in_meeting_rpc`. What this flag really
  -- stands aside is the PARENT-table guard `app.guard_meeting_status`. The child lock is
  -- handled by window 2 below. Same defect family as the one ADR 0129 was written about:
  -- a comment asserting a bypass the guard it names does not implement.
  perform set_config('app.in_meeting_rpc', 'on', true);  -- parent-table meeting guards only
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- (a) structured patient rows — N PER CASE (ADR 0064 Decision 3 / R3).
  delete from public.patient_identifiers pi
   where pi.participant_id in (
     select cp.participant_id
     from public.case_participants cp
     join public.participants p on p.id = cp.participant_id
     where cp.case_id = p_case_id and p.participant_type = 'patient'
   );

  --     Q4: redact the patient participants' registry display_name (belt-and-suspenders)
  --     and soft-remove their case links.
  update public.participants p
     set display_name = v_redacted
   where p.participant_type = 'patient'
     and p.id in (select cp.participant_id from public.case_participants cp
                  where cp.case_id = p_case_id);
  update public.case_participants cp
     set removed_at = coalesce(cp.removed_at, now())
   where cp.case_id = p_case_id
     and cp.participant_id in (
       select p.id from public.participants p where p.participant_type = 'patient');

  -- (b) case-phase ANSWERS — DELETE (patient-authored content; selections cascade via
  -- answer_selected_options FK). case_phases.result_id SURVIVES.
  delete from public.answers a
   using public.responses r, public.case_phases cp
   where a.response_id = r.id and r.case_phase_id = cp.id and cp.case_id = p_case_id;

  -- (c) narratives + case-event bodies AND titles.
  update public.case_narratives set body_md = null where case_id = p_case_id;
  update public.case_events set body = v_redacted, title = v_redacted where case_id = p_case_id;

  -- (d) interviews (summary) + interview subjects (note), for this case's interviews.
  --     The PARENT write below rides `app.in_interview_rpc` (app.guard_interview_status);
  --     the CHILD write rides `app.in_disposal_rpc` (app.guard_interview_child_lock),
  --     which is a different flag on a different guard (ADR 0129 Amdt 2).
  update public.case_interviews set summary_md = null where case_id = p_case_id;

  -- ── stand-aside window 1: interview subject notes, on a completed/cancelled
  --    interview (23514) ──
  perform set_config('app.in_disposal_rpc', 'on', true);
  update public.case_interview_subjects s set note = v_redacted
   where s.interview_id in (select id from public.case_interviews where case_id = p_case_id);
  perform set_config('app.in_disposal_rpc', 'off', true);
  -- ── end window 1 ──

  -- (e) the case label (self-labeled PHI).
  update public.cases set label = v_redacted where id = p_case_id;

  -- (f) DM2·S2 (FUP-DM1-DISPOSE discharged): case-homed documents. Titles and
  --     descriptions redact (D12); every PHI-tier bound file enters the D10
  --     disposal machine with the caller's reason (the Art. 18 lane when the
  --     reason is a subject request — see complete_document_disposal's
  --     provisional-retention gate). Standard-tier files stay untouched.
  --     ⚠ BY DESIGN, and now stated: `app.guard_document_transition` and
  --     `app.guard_file_object_transition` raise HC0D3 when an ACTIVE LEGAL HOLD binds
  --     the document, and that aborts this whole erasure. That is the same posture
  --     `dispose_referral_phi` already documents ("Blocked by an active legal hold
  --     (HC0D3) BY DESIGN — D10's rule"): a legal hold outranks an Art. 18 request, and
  --     the refusal is the correct answer, not a defect. It is NOT the child-lock class
  --     this migration fixes — a child lock protects a FINISHED committee record, a legal
  --     hold protects evidence under a live obligation.
  --
  --     ⭐ PDF·P3: this block ALREADY covers a case's PRINTED RENDITIONS —
  --     `mint_printed_document` homes the print's own `documents` row on the
  --     source (`home_resource_id = p_source_id`), which for the case kind IS
  --     this case. So the bytes half of ADR 0144 D10 needs no new statement here;
  --     only the registry half, in block (f2) below, was missing.
  update public.documents d
     set title = v_redacted, description = null
   where d.home_resource_id = p_case_id;
  update public.file_objects f
     set disposal_state = 'disposal_pending', disposal_reason_category = p_reason
   where f.disposal_state = 'none' and f.sensitivity_tier = 'phi'
     and f.id in (
       select vf.file_object_id
         from public.documents d
         join public.document_versions dv on dv.document_id = d.id
         join public.document_version_files vf on vf.document_version_id = dv.id
        where d.home_resource_id = p_case_id);
  update public.documents d
     set status = 'disposal_pending'
   where d.home_resource_id = p_case_id and d.status = 'active'
     and exists (
       select 1 from public.document_versions dv
       join public.document_version_files vf on vf.document_version_id = dv.id
       join public.file_objects f on f.id = vf.file_object_id
      where dv.document_id = d.id and f.sensitivity_tier = 'phi');

  -- ── (f2) PDF·P3 (ADR 0144 D10) — THE PRINTED-DOCUMENT REGISTRY ─────────────
  --
  -- The bytes are already marked for destruction by (f). This closes the
  -- registry so it stops claiming an active emission for paper whose content the
  -- platform is destroying, and so `/verificar` reports a REVOKED document
  -- rather than an active-but-unservable one.
  --
  -- ⭐ KEYED ON `contains_phi`, AND THAT IS EXACTLY THE SET (f) DESTROYS.
  -- `mint_printed_document` derives the file tier as
  -- `case when contains_phi then 'phi' else 'standard' end`, and (f) filters
  -- `sensitivity_tier = 'phi'`. So "revoked here" ⇔ "bytes destroyed there" — ONE
  -- invariant, not two that can drift apart into a row marked revoked whose bytes
  -- survive, or bytes destroyed under a row still reading `active`.
  --
  -- ⚠ THIS DISCRIMINATOR IS DELIBERATELY DIFFERENT FROM THE DOWNLOAD GATE'S, and
  -- the difference is correct rather than sloppy. **Destruction keys on the TIER**
  -- — what could be inside the bytes. **Download keys on the VARIANT**
  -- (`template_key = 'case_identified'`, in `open_printed_document`) — what this
  -- reader is entitled to see. Collapsing them onto one discriminator either
  -- leaks PHI or breaks the de-identified variant, because ADR 0144 D6 makes
  -- `contains_phi` true for BOTH variants.
  --
  -- ⚠ THE PROVIDER GUARANTEES THE SETS LINE UP, AND IT DOES SO WITHOUT DERIVING
  -- ANYTHING. `buildCasePayload` sets `containsPhi := NOT caseDisposed` for the
  -- case kind (ADR 0144 D6 as amended): a live case dossier CARRIES masked-class
  -- content, constitutively, so EVERY live case mint is phi-tier and (f) reaches
  -- every one of them. A disposed case answers false — post-redaction a band
  -- would be a false statement about the bytes — and it never registers (D3), so
  -- the false only ever labels an ephemeral prévia.
  --
  -- ⛔ **THIS PARAGRAPH IS WHERE C-1 WAS REASONED PAST, SO READ THE CORRECTION
  -- BEFORE TRUSTING ANY DERIVATION ARGUMENT HERE.** It used to describe a
  -- presence derivation and it was wrong twice over: the second term was
  -- `renderedPatientField`, not `includePhi`, and — the part that mattered — the
  -- worry it raised was scoped to the IDENTIFIED thin case, so the DE-IDENTIFIED
  -- thin case walked straight through it. That case (no `patient_identifiers`
  -- row, no free text, and a patient's name typed into `cases.label` — which
  -- block (e) below REDACTS, this door's own statement that the field is
  -- masked-class) derived false, landed standard-tier, and (f) skipped the object
  -- while (f2) skipped the row. A dossier headed with the patient's name survived
  -- an Art. 18 erasure. A correct conclusion reached through a hand-list is one
  -- edit from being wrong; the constitutive rule has no list to fall behind.
  --
  -- Pinned by a keystone, not by this comment, and the keystone is
  -- `src/lib/cases/pdf-payload.test.ts` — the thin de-identified case asserted
  -- phi-banded, mutation-proven RED against the deleted derivation.
  --
  -- `status <> 'revoked'` so an existing HUMAN revocation is not overwritten —
  -- its reason class and free text are a governance record of their own.
  -- SUPERSEDED rows ARE included: their bytes go too, so `revoked` is the truer
  -- statement about them than `superseded`.
  --
  -- `revoked_by = auth.uid()` is provably non-null here — the authority check at
  -- the top of this door routes `app.is_staff_admin_of(commission)`, which
  -- resolves `auth.uid()` and refuses a null one. That satisfies the
  -- `pd_revocation_complete` CHECK (revoked_at non-null ⇒ class + reason + by all
  -- non-null); setting `status` and `revoked_at` together satisfies
  -- `pd_revoked_iff_ts`.
  --
  -- Placed BEFORE block (h) sets `phi_disposed_at` on purpose: this statement is
  -- then independent of any present or future guard keyed on that column.
  update public.printed_documents
     set status = 'revoked',
         revoked_at = now(),
         revoked_by = auth.uid(),
         revoked_reason_class = 'phi_disposed',
         revoked_reason =
           'Descarte de dados de paciente do caso (LGPD Art. 18) — motivo: ' || p_reason
   where source_kind = 'case'
     and source_id = p_case_id
     and contains_phi
     and status <> 'revoked';
  -- ── end (f2) ──

  -- (g) per-(meeting,case) notes.
  -- ── stand-aside window 2: `meeting_cases` is guarded by
  --    `app.guard_meeting_child_lock`, which raises 23514 while the parent meeting is
  --    in_signature / signed / distributed / cancelled. The guard ALREADY read
  --    `app.in_disposal_rpc` (ADR 0129); this door simply never set it — statement #10,
  --    which appeared in no filed record. ──
  perform set_config('app.in_disposal_rpc', 'on', true);
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;
  perform set_config('app.in_disposal_rpc', 'off', true);
  -- ── end window 2 ──

  -- (h) flags.
  update public.cases
     set has_patient = false, phi_disposed_at = now(),
         phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason
   where id = p_case_id;

  perform app.audit_write(
    'case_patient.disposed', 'case_patient', p_case_id, v_case.commission_id,
    'Dados do paciente do caso ' || v_case.case_number || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_meeting_rpc', 'off', true);
  perform set_config('app.in_submit_rpc', 'off', true);
  perform set_config('app.in_interview_rpc', 'off', true);
  perform set_config('app.in_narrative_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

comment on function public.dispose_case_phi(uuid, text) is
  'LGPD Art. 18 erasure for one case (ADR 0038 / 0129 / 0144 D10). Deletes the '
  'structured patient rows and the phases'' answers, nulls or redacts every '
  'free-text column the case surface renders, marks every case-homed PHI-tier '
  'file for the two-phase disposal machine, and — ADR 0144 D10 — REVOKES the '
  'case''s contains_phi printed documents with the reason class `phi_disposed`. '
  '⛔ That class is writable ONLY from here: revoke_printed_document must never '
  'accept it, because a human must not be able to claim an Art. 18 erasure. '
  '⚠ The registry row, its hash, its audit trail and its verification token '
  'SURVIVE — only the bytes go, so /verificar reports a revoked document rather '
  'than a missing one. ⚠ An active LEGAL HOLD aborts the whole erasure with '
  'HC0D3, by design.';
