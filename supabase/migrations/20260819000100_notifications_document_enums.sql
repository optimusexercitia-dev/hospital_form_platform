-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — §4: extend the Phase-20 notification
-- enums so the controlled-document producers (submit / decision / publish / Remind /
-- review-due scan) can enqueue. SHARED CONTRACT (ADR 0081 consequences) — additive
-- CHECK swaps only; existing values untouched. Must land BEFORE the document RPCs
-- (…000200) + producers (…000300), whose enqueue calls reference these new values.
--
-- New kinds:
--   * document_approval    — the approval lifecycle to approvers/author
--     (submit→approver / decision→author / publish→author / Remind→approver).
--   * document_review_due  — the review-due/expiry scan → staff_admin.
-- New entity types:
--   * controlled_document_version — deep-links the sign page / version detail.
--   * controlled_document         — deep-links the document detail.
-- New milestones:
--   * decided   — an approver recorded approve/reject (→ author).
--   * published — a version became vigente (→ author).
-- (submit reuses 'requested'; Remind reuses 'pending'; the scan reuses
--  'due_soon'/'overdue' — all already in the CHECK.)
-- =============================================================================

-- ⚠ SUPERSET of the live set (charter migration 20260818000200 added ethics/charter
-- + ethics_notification/commission). Preserve every existing value — a rebuild that
-- drops one silently breaks that producer (caught here by 262_charter_notifications).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'capa', 'signoff', 'meeting', 'action_item', 'ethics', 'charter',
    'document_approval', 'document_review_due'
  ]::text[]));

alter table public.notifications drop constraint notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check
  check (entity_type = any (array[
    'capa_action', 'response_section_signoff', 'meeting', 'action_item',
    'ethics_notification', 'commission',
    'controlled_document_version', 'controlled_document'
  ]::text[]));

alter table public.notifications drop constraint notifications_milestone_check;
alter table public.notifications add constraint notifications_milestone_check
  check (milestone = any (array[
    'assigned', 'requested', 'convoked', 'due_soon', 'overdue',
    'pending', 'still_open', 'upcoming',
    'decided', 'published'
  ]::text[]));
