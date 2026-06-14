-- Maintenance / relaxation: the default (first/anchor) section may now carry a
-- TITLE.
--
-- Background: the default section was modelled as a plain container so that an
-- "unsectioned form" is exactly one default section rather than a nullable
-- section_id special case (ARCHITECTURE.md §2 "Sections integrity"). The
-- original CHECK (`form_sections_default_shape`, M3
-- 20260612100003_forms_structure.sql) forbade ALL of title / visible_when /
-- requires_signoff on the default section.
--
-- Design decision (lead): the default section may now be given a title, but
-- MUST still be forbidden from carrying a condition or a sign-off. It is the
-- form's anchor section — it is always first (position 0), so it can never
-- reference an earlier answer (no `visible_when`), and section sign-off on the
-- anchor is out of scope (`requires_signoff = false`).
--
-- This is a RELAXING change: every existing default row has `title = null`,
-- which still satisfies the new (weaker) predicate, so no data migration is
-- needed and no row can become invalid. The flat-render fallback (a version
-- whose only section is the default renders with no section chrome) lives in the
-- frontend and is unaffected — a default section with a title is still the
-- default section. Cloning is unaffected too: clone_form_version already copies
-- `title` for every section, so a titled default clones verbatim.

alter table public.form_sections
  drop constraint form_sections_default_shape;

alter table public.form_sections
  add constraint form_sections_default_shape check (
    not is_default
    or (visible_when is null and requires_signoff = false)
  );

comment on constraint form_sections_default_shape on public.form_sections is
  'The default (anchor) section may carry a title but never a visibility '
  'condition or a sign-off requirement: it is always first, so it cannot '
  'reference an earlier answer, and sign-off on the anchor is out of scope.';
