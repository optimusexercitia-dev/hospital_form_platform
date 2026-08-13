-- ADR 0096 — Process-template versioning · M2: additive re-key columns.
--
-- Adds a NULLABLE `template_version_id` beside each existing `template_id`. Both
-- columns coexist until M7 drops the old one. Nothing is enforced here.
--
-- Why add-and-drop rather than ALTER TABLE ... RENAME COLUMN — this is the whole
-- safety argument of the phase, so it is recorded at the point of decision:
--
--   A rename does NOT leave the RLS policies alone. Postgres stores policy
--   expressions as parsed node trees referencing column ATTNUMs, so a rename
--   silently REWRITES every policy for you. All eight child policies would
--   become app.commission_of_template(template_version_id) — a function that
--   looks a *version* id up in process_templates.id, finds nothing, returns
--   NULL, and makes app.is_member_of(NULL) false. RLS then fails CLOSED: no
--   error, no failing deny-test, the feature simply goes blank for legitimate
--   users. The danger is not that Postgres forgets to update the policy; it is
--   that it updates it FOR you, wrongly. (The D11 anglicization incident is the
--   same failure with the opposite mechanism: pg_proc rewritten, pg_policy not.)
--
--   Adding a new column and dropping the old one instead means the DROP in M7
--   collides with the policy dependency and raises, converting a silent
--   fail-closed into a loud failure. That is defence 1 of 3; defences 2 and 3
--   (a distinctly-named helper, and an ALLOW-arm keystone that asserts rows
--   rather than predicates) live in M6 and the pgTAP suite, and hold even if
--   this dependency check turns out weaker than expected.

alter table public.process_template_phases
  add column template_version_id uuid
    references public.process_template_versions (id) on delete cascade;

alter table public.process_template_narratives
  add column template_version_id uuid
    references public.process_template_versions (id) on delete cascade;

alter table public.process_template_outcomes
  add column template_version_id uuid
    references public.process_template_versions (id) on delete cascade;

alter table public.process_template_custom_fields
  add column template_version_id uuid
    references public.process_template_versions (id) on delete cascade;

-- cases: ON DELETE RESTRICT, not CASCADE and not SET NULL.
--
-- This single clause is the audit finding M1 actually closed. The old
-- cases.template_id was ON DELETE SET NULL, so deleting a template erased the
-- provenance of every historical case (two seeded cases already resolve to
-- nothing because of it). RESTRICT makes a version a case ran under
-- undeletable. Nullable is retained on purpose: processless cases created via
-- public.create_case have no template at all (suite 177), and the two already
-- orphaned seeded cases cannot be re-pointed to a version that no longer exists.
alter table public.cases
  add column template_version_id uuid
    references public.process_template_versions (id) on delete restrict;

-- FK indexes (ADR 0095 M7 added these for the template_id FKs; the replacement
-- columns need their own or every cascade delete degrades to a seq scan).
create index process_template_phases_version_idx
  on public.process_template_phases (template_version_id);

create index process_template_narratives_version_idx
  on public.process_template_narratives (template_version_id);

create index process_template_outcomes_version_idx
  on public.process_template_outcomes (template_version_id);

create index process_template_custom_fields_version_idx
  on public.process_template_custom_fields (template_version_id);

create index cases_template_version_idx
  on public.cases (template_version_id);
