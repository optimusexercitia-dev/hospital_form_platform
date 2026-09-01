-- AE4.6 — ATOMIC CUTOVER. The `staff_admin` wrapper family delegates to the catalog.
-- Plan: docs/plans/authz-evolution.md § AE4.6 · ADR 0155 D7 · ADR 0162 §2.
--
-- door-sweep-targets: app.is_staff_admin_of(uuid), app.is_staff_admin_of_for(uuid, uuid), app.can_manage_professional(uuid, uuid)
--
-- ============================================================================
-- ⭐ DELEGATION TARGET: `authz.assignment_facts`, NOT a permission code. RULED 2026-09-01.
--
-- The wrappers ask a ROLE question, and the adapter already answers role questions. Routing a
-- role check through a PERMISSION resolver needed some code to stand for "is staff_admin",
-- and every way of choosing one was wrong:
--   * a sentinel code (e.g. `commission.forms.edit`) — revoking that ONE grant would silently
--     break the role check everywhere;
--   * "holds ANY staff_admin-granted permission at this scope" — correct ONLY while
--     `role_permissions` contains one role. The moment AE5 grants `staff` any permission that
--     `staff_admin` also holds, a plain staff member holds a staff_admin-granted permission at
--     that scope and `is_staff_admin_of` returns TRUE FOR THEM. Correct now, wrong by
--     construction later, silent in between — with AE5 as the fuse;
--   * a 43rd marker permission — honest, but spends a PO amendment describing something the
--     adapter already models.
-- The adapter IS the catalog's projection, so this still delegates to the catalog.
--
-- ⛔⛔ GATE 4 IS NOT IN THE ADAPTER, AND THAT IS THE TRAP OF THIS MIGRATION.
-- `authz.assignment_facts` carries three of `app.has_role`'s four gates — seat expiry, the
-- scope discriminator, and `app.is_active`. The FOURTH, the active-role filter, lives in
-- `authz.has_direct_permission`, because it is permission-dependent there. A wrapper
-- delegating to the adapter ALONE would therefore DROP THE HAT GATE for the 151 self-check
-- call sites — precisely the "never-apply" half of matrix § 6A, introduced BY the cutover.
-- So each wrapper carries the filter itself, in `has_role`'s exact shape, keyed on whether the
-- principal is the caller. Both polarities are asserted in pgTAP 405: inheriting a property is
-- not evidence you inherited it.
--
-- ⛔ NEVER `legacy OR new`, and no caller-selectable evaluator. pgTAP 405 greps the
-- COMMENT-STRIPPED `prosrc` of both wrappers for the legacy predicate's absence.
--
-- ⚠ `create or replace` is NOT drop+create: name, signature, `prosecdef`, volatility,
-- `search_path` and ACLs all persist. All are snapshotted before and asserted after (the
-- a-rename-orphans-a-name-keyed-verdict lesson). ⭐ THE TWO WRAPPERS' ACLs DIFFER —
-- `is_staff_admin_of` carries `=X/postgres`, the EMPTY grantee, which IS a PUBLIC grant
-- (measured: `anon` EXECUTE = true); the `_for` sibling does not. Each is asserted against ITS
-- OWN snapshot, because comparing the siblings to each other would pass while a PUBLIC grant
-- silently vanished or persisted. ⛔ Not changed here —
-- FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE: entangling a grant change with a cutover is
-- what makes a cutover unattributable, and this migration's own claim is that ACLs did NOT move.
--
-- ⛔ ONE ROLE ONLY. Every other role stays `legacy`; `memberships_role_check` and
-- `memberships_scope_shape` stay; and "the catalog is the authority" may not appear in a gate
-- record — that is AE5-complete territory (ADR 0162 §2 item 4). The honest claim remains
-- "one catalog, bound by FK, with legacy CHECKs still standing", now with one role delegating.
-- ============================================================================

-- ⚠ The self-check wrapper's principal is ALWAYS the caller, so `has_role`'s
-- `p_user_id is distinct from auth.uid()` disjunct is constant-false here and the active-role
-- filter ALWAYS applies. Written directly rather than transcribing a tautology.
create or replace function app.is_staff_admin_of(p_commission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select exists (
    select 1
      from authz.assignment_facts((select auth.uid())) af
     where af.role_code  = 'staff_admin'
       and af.scope_kind = 'commission'
       and af.scope_id   = p_commission_id
       and af.role_code is not distinct from app.active_role()
  );
$f$;

create or replace function app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select exists (
    select 1
      from authz.assignment_facts(p_user_id) af
     where af.role_code  = 'staff_admin'
       and af.scope_kind = 'commission'
       and af.scope_id   = p_commission_id
       and (p_user_id is distinct from (select auth.uid())
            or af.role_code is not distinct from app.active_role())
  );
$f$;

-- ============================================================================
-- DIRECT-CALL CENSUS — the ONE site replaced, and the twelve allowlisted.
--
-- Derived PER SITE from the comment-stripped catalog, never from a name-keyed family
-- classifier (mine misfiled functions twice this phase). 13 sites carry the literal outside
-- the wrappers; ZERO policies do — every policy already routes through the predicate.
--
-- ⭐ REPLACED (1): `app.can_manage_professional` is the only site calling
-- `has_role(..., 'staff_admin')` DIRECTLY, so after the cutover it would be the only true
-- BYPASS — the org-scoped matrix rows 30–33 would not go through the catalog at all. The
-- replacement is exactly equivalent: `is_staff_admin_of_for` IS `is_active AND has_role`, and
-- this call site already carries `is_active` as of 20261003007190.
--
-- ALLOWLISTED (12), each with the reason it is not a role check on the caller:
--   `signoff_role = 'staff_admin'` — a FORM-SECTION CONFIGURATION value (which role must sign
--     a section); a different vocabulary entirely:
--       app.can_sign_section · app.pending_staff_signoffs · public.submit_response
--   `m.role = 'staff_admin'` used to RESOLVE HOLDERS, not to gate the caller — the
--     iterate-vs-branch test (pgTAP 402/403): the set is ITERATED, never BRANCHED ON:
--       app.commission_staff_admin_of_case · public.get_referral_case_access_summary
--       app.compute_due_charter_notifications · app.compute_due_document_review_notifications
--       public.compute_due_notifications · public.save_section_answers
--   the role as an ADMINISTERED VALUE / scope dispatch, never the acting role:
--       app.grant_role_impl · app.revoke_role_impl
--   a DISPLAY LABEL only (the door's own gate is already `is_staff_admin_of`):
--       public.list_approver_candidates
-- ============================================================================

do $mig$
declare
  v_src text;
  v_new text;
  v_old constant text := 'app.has_role(''commission'', c.id, ''staff_admin'', p_uid)';
  v_rep constant text := 'app.is_staff_admin_of_for(c.id, p_uid)';
begin
  v_src := pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure);
  if position(v_old in v_src) = 0 then
    raise exception 'AE4.6 census: app.can_manage_professional does not contain the expected direct has_role call.'
      using errcode = 'check_violation';
  end if;
  v_new := replace(v_src, v_old, v_rep);
  if v_new = v_src then
    raise exception 'AE4.6 census: substitution was a NO-OP on app.can_manage_professional.'
      using errcode = 'check_violation';
  end if;
  execute v_new;
  if position(v_rep in pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure)) = 0 then
    raise exception 'AE4.6 census: the wrapper call is ABSENT from can_manage_professional after execute.'
      using errcode = 'check_violation';
  end if;
end $mig$;

-- ============================================================================
-- THE FLIP. `staff_admin` becomes the first role the catalog owns.
-- ⭐ pgTAP 401 § 3.2 — the tripwire built in Increment 1 — FIRES HERE BY DESIGN. It is changed
-- deliberately in this increment to name which role is non-legacy and why. A GREEN 3.2 after
-- this migration would mean the cutover did not happen.
-- ============================================================================

update authz.roles set state = 'authoritative' where code = 'staff_admin';

do $v$
declare v_auth int; v_legacy int;
begin
  select count(*) into v_auth   from authz.roles where state = 'authoritative';
  select count(*) into v_legacy from authz.roles where state = 'legacy';
  if v_auth <> 1 or v_legacy <> 11 then
    raise exception 'AE4.6: expected exactly 1 authoritative role and 11 legacy, found % and %.', v_auth, v_legacy
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from authz.roles where code = 'staff_admin' and state = 'authoritative') then
    raise exception 'AE4.6: staff_admin did not flip to authoritative.' using errcode = 'check_violation';
  end if;
end $v$;
