-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — B1: additive schema.
-- Adds the redesign's new metadata columns. RLS rides the existing table policies
-- (no new policy — writes stay DEFINER-RPC-only, posture (b); reads via the member
-- SELECT policy + the approver-read arm). The audit AFTER-triggers are UNCHANGED:
-- their column allow-lists (`c_cols`) already exclude these new columns, so
-- `category`/`tags`/`obsolete_kind`/dates stay OUT of the audit payload while a
-- mutation still emits an audit row (ADR 0081 consequences; Rule 11).
-- Forward-only + additive (never edits an applied migration).
-- =============================================================================

-- B1 — controlled_documents: free-text category (O1) + tags array.
alter table public.controlled_documents
  add column if not exists category text,
  add column if not exists tags text[] not null default '{}'::text[];

comment on column public.controlled_documents.category is
  'Free-text category (ADR 0081 O1) — the register autocompletes from existing values (a FE concern); no controlled list.';
comment on column public.controlled_documents.tags is
  'Free-text tag set (ADR 0081). Low-sensitivity metadata — kept out of the audit payload.';

-- B1 — controlled_document_versions: retired-vs-superseded distinction + the
-- wizard's proposed effective date (defaulted into publish) + the reviewer-response
-- deadline (O2) that feeds Remind / the overdue-approval reminder.
alter table public.controlled_document_versions
  add column if not exists obsolete_kind text
    check (obsolete_kind is null or obsolete_kind in ('superseded', 'retired')),
  add column if not exists proposed_effective_date date,
  add column if not exists approval_due_date date;

comment on column public.controlled_document_versions.obsolete_kind is
  'Why an obsolete version was retired: ''superseded'' (a newer version published over it, stamped by publish_document) or ''retired'' (mark_document_obsolete, no replacement). NULL while not obsolete. English (ADR 0081 decision 4).';
comment on column public.controlled_document_versions.proposed_effective_date is
  'The wizard''s proposed effective date; publish_document defaults p_effective_date from it when the caller omits one. Not a scheduler (activation still happens at publish).';
comment on column public.controlled_document_versions.approval_due_date is
  'Reviewer-response deadline (ADR 0081 O2) collected at submit; feeds Remind / the overdue-approval reminder. Display + reminder feed only — no auto-transition.';
