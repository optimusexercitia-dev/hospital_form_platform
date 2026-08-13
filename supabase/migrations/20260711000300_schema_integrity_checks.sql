-- =============================================================================
-- WS-3b · Schema-integrity cluster — D1 (delete-path RESTRICT), D6-flip, D9 (CHECKs)
-- =============================================================================
-- Pre-pilot DB hardening. Detail: docs/plans/pre-pilot-db-hardening-program.md §1 WS-3;
--   docs/reviews/external-db-audit-2026-07-perf-datamodel-analysis.md §2 (D1, D6, D9).
-- Sibling migrations: ...000400 (D2 tenant composite FK), ...000500 (D7 vocab dual-scope).
-- Reset-OK (pre-launch): no back-compat data migration; seed verified to satisfy the
-- new CHECKs on a fresh reset.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D1 · Delete-path booby-trap: ON DELETE SET NULL × NOT-NULL shape CHECK.
-- -----------------------------------------------------------------------------
-- capa_plan's 3 source FKs and rca_evidence's 3 cited FKs are ON DELETE SET NULL, but
-- the *_shape CHECKs require the matching id NOT NULL for that source/citation kind. So
-- deleting a parent (event -> cascade rca -> capa_plan.source_rca_id SET NULL; or a
-- cited meeting/interview/document) trips the shape CHECK -> opaque abort. A retention
-- module must not silently null a CAPA's provenance nor delete a governed artifact:
-- flip these 6 FKs to ON DELETE RESTRICT so the delete blocks CLEANLY with a
-- foreign_key_violation (23503) and the operator disposes PHI via the proper path.
-- (rca_evidence_rca_id_fkey and rca_event_id_fkey stay CASCADE — those are the intended
-- ownership cascades; the trap is only on the *shape-checked* SET NULL columns.)

-- capa_plan source FKs (rca / event / meeting) -> RESTRICT.
alter table public.capa_plan drop constraint capa_plan_source_rca_id_fkey;
alter table public.capa_plan add constraint capa_plan_source_rca_id_fkey
  foreign key (source_rca_id) references public.rca(id) on delete restrict;
alter table public.capa_plan drop constraint capa_plan_source_event_id_fkey;
alter table public.capa_plan add constraint capa_plan_source_event_id_fkey
  foreign key (source_event_id) references public.patient_safety_event(id) on delete restrict;
alter table public.capa_plan drop constraint capa_plan_source_meeting_id_fkey;
alter table public.capa_plan add constraint capa_plan_source_meeting_id_fkey
  foreign key (source_meeting_id) references public.meetings(id) on delete restrict;

-- rca_evidence cited FKs (interview / meeting / document) -> RESTRICT.
alter table public.rca_evidence drop constraint rca_evidence_cited_interview_id_fkey;
alter table public.rca_evidence add constraint rca_evidence_cited_interview_id_fkey
  foreign key (cited_interview_id) references public.case_interviews(id) on delete restrict;
alter table public.rca_evidence drop constraint rca_evidence_cited_meeting_id_fkey;
alter table public.rca_evidence add constraint rca_evidence_cited_meeting_id_fkey
  foreign key (cited_meeting_id) references public.meetings(id) on delete restrict;
alter table public.rca_evidence drop constraint rca_evidence_cited_document_id_fkey;
alter table public.rca_evidence add constraint rca_evidence_cited_document_id_fkey
  foreign key (cited_document_id) references public.case_documents(id) on delete restrict;

-- -----------------------------------------------------------------------------
-- D6-flip · form_items_input_vs_display CHECK: ELSE NULL::boolean -> ELSE false.
-- -----------------------------------------------------------------------------
-- A NULL CHECK result is treated as SATISFIED, so the moment a future migration adds an
-- 11th item_type to one list and not the other, it passes with ZERO shape enforcement.
-- Flip the CASE's ELSE arm to false so an unlisted item_type FAILS the shape CHECK.
alter table public.form_items drop constraint form_items_input_vs_display;
alter table public.form_items add constraint form_items_input_vs_display check (
  case
    when item_type = any (array['multiple_choice','dropdown','checkbox','free_text',
                                'short_text','number','date','time'])
      then (question_key is not null and label is not null and content is null)
    when item_type = any (array['section_text','image'])
      then (content is not null and question_key is null and label is null
            and question_explanation is null and required = false)
    else false
  end
);

-- -----------------------------------------------------------------------------
-- D9 · Lifecycle-state CHECKs (ALCOA+ "Consistent"). All confirmed unconstrained;
--      the seed satisfies every one on a fresh reset (verified).
-- -----------------------------------------------------------------------------
-- responses: a submitted response must carry submitted_at.
alter table public.responses add constraint responses_submitted_at_paired
  check (status <> 'submitted' or submitted_at is not null);

-- cases: a terminal case (concluido/cancelado — both set closed_at via close/cancel_case)
-- must carry closed_at.
alter table public.cases add constraint cases_closed_at_paired
  check (status not in ('concluido','cancelado') or closed_at is not null);

-- case_referral: each lifecycle *_at/*_by pair is set together or not at all.
alter table public.case_referral add constraint case_referral_sent_pair
  check ((sent_at is null) = (sent_by is null));
alter table public.case_referral add constraint case_referral_received_pair
  check ((received_at is null) = (received_by is null));
alter table public.case_referral add constraint case_referral_decided_pair
  check ((decided_at is null) = (decided_by is null));
alter table public.case_referral add constraint case_referral_concluded_pair
  check ((concluded_at is null) = (concluded_by is null));
alter table public.case_referral add constraint case_referral_withdrawn_pair
  check ((withdrawn_at is null) = (withdrawn_by is null));
alter table public.case_referral add constraint case_referral_phi_disposed_pair
  check ((phi_disposed_at is null) = (phi_disposed_by is null));
