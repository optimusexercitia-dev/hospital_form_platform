-- AE4.4a step 1 -- `authz.permissions.resolution_scope_kind`.
-- Matrix section 11 (the PROPOSAL, now approved as option A) + section 11.3 (binding on AE4.4).
--
-- WHY THIS COLUMN EXISTS. Four approved permissions (matrix rows 30-33) resolve at the
-- ORGANIZATION while being held via a COMMISSION-scoped role: `app.can_manage_professional`
-- takes `p_org` and admits a `staff_admin` of ANY commission in that org (ADR 0078 B7).
-- Nothing in AE4.1 could express that -- `authz.roles.allowed_scope_kind` says where a role
-- may be ASSIGNED, never where a permission RESOLVES.
--
-- AN ADAPTER THAT DERIVES RESOLUTION SCOPE FROM `allowed_scope_kind` SILENTLY DENIES ALL
-- FOUR. That is an under-grant which looks exactly like correct tenant isolation, so it
-- reads as a pass. This column is what stops AE4.4b from having to infer it.
--
-- NOT `applies_to_descendants`, and the name will tempt the next reader. That column means a
-- permission held at ORG scope reaches DOWN into hospitals and commissions. This is the
-- INVERSE -- a permission held via a commission-scoped role reaching UP to the org. Ascent is
-- not descent. (It is also a deferred residue column, so it is unavailable regardless.)
--
-- THE ASCENT IS A BOUNDED TWO-HOP JOIN, NOT RECURSION, stated here so a reviewer does not
-- read it as the thing PA-F6 bans: `commissions.hospital_id -> hospitals.organization_id` is
-- fixed-depth. PA-F6 rules out per-row RECURSIVE scope ancestry; a fixed join is not that.
--
-- A DISTINCT DOMAIN, deliberately NOT a reuse of `authz.scope_kind`. That domain carries
-- `none` and `capability_plane` -- the structurally-unreachable values that let
-- `platform_admin` and `administrativo` sit in the catalog without being FK referents
-- (ADR 0172 section 3). A permission declaring either as its RESOLUTION scope would name a
-- scope no assignment can ever produce, and nothing would catch it.

create domain authz.resolution_scope_kind as text
  constraint resolution_scope_kind_check check (
    value in ('organization', 'hospital', 'commission')
  );

comment on domain authz.resolution_scope_kind is
  'The scope kind a permission RESOLVES at -- independent of where its holder''s role is '
  'ASSIGNED. Deliberately narrower than `authz.scope_kind`: it cannot express `none` or '
  '`capability_plane`, because those are the unreachable values that exist so non-membership '
  'roles can be catalogued (ADR 0172), and a permission resolving at an unreachable scope is '
  'not a state anything should be able to write.';

-- NOT NULL, NO DEFAULT -- the same ruling as `sensitivity_ceiling` (20261003007130), for the
-- same reason. `commission` is the overwhelmingly common value, so a default would be the
-- PERMISSIVE-looking one, and an INSERT that forgot the column would silently declare an
-- org-scoped permission to be commission-scoped while the row looked complete. Every
-- permission declares its own resolution scope. The table is empty, so there is no backfill.
alter table authz.permissions
  add column resolution_scope_kind authz.resolution_scope_kind not null;

comment on column authz.permissions.resolution_scope_kind is
  'Where this permission resolves. For the four `org.*` rows the value is derived from the '
  'ENFORCEMENT GATE signature -- `app.can_manage_professional(p_org uuid, p_uid uuid)` takes '
  'an organization -- NOT from the code name prefix. The prefix agreeing is a WEAK '
  'cross-check (pgTAP 401 section 14), not the source: a name is a label, and checking a '
  'control against its own label catches divergence but never joint incorrectness.';
