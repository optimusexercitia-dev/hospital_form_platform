-- AE4.4b — the adapter, the materialized implication closure, the resolver, and the
-- explanation. Plan: docs/plans/authz-evolution.md § AE4.4. Matrix § 6A + § 11.3 are INPUTS,
-- designed against from the first line, not discovered here.
--
-- ⛔ NOTHING DELEGATES TO THIS YET. `authz.roles.staff_admin` stays `legacy`; the wrappers are
-- untouched. AE4.6 is the cutover. The catalog remains AUTHORITY-ELECT (ADR 0162 §2).
--
-- ============================================================================
-- ⭐ THE ADAPTER CARRIES ALL FOUR OF `app.has_role`'s GATES. Matrix § 1.2 measured them;
-- an earlier draft of this plan designed ONE and inherited three. An adapter that projects
-- "live" membership rows where "live" is undefined hands the resolver a lapsed or
-- deactivated principal's grants and the resolver answers TRUE with no error — not one door
-- failing open, but every permission at once.
--
--   1. SEAT EXPIRY   -> `expires_at is null or expires_at > now()`, in the projection
--   2. SCOPE MATCH   -> the `memberships.scope_kind` discriminator (Increment 1's generated
--                       column, so no CASE is re-derived here) + `authz.scope_reaches`
--   3. PRINCIPAL STATE -> `app.is_active`, a PRECONDITION on the whole projection
--   4. ACTIVE ROLE   -> in the RESOLVER, not here, and only for self-checks (§ 6A)
--
-- ⚠ GATE 3 REPRODUCES A COLLAPSE, DELIBERATELY. `app.is_active` folds *inactive* and
-- *suspended* into one predicate, so those two deny classes are NOT independently observable
-- at any site. AE4.5's generator names them separately and its fixtures can construct them
-- separately — but a cell expecting a distinguishable ANSWER asserts something this system
-- cannot express. Inherited on purpose, stated so nobody re-derives it as a bug.
-- ============================================================================

create function authz.assignment_facts(p_principal uuid)
returns table (role_code text, scope_kind text, scope_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.role,
         m.scope_kind::text,
         case m.scope_kind
           when 'commission'   then m.commission_id
           when 'hospital'     then m.hospital_id
           when 'organization' then m.organization_id
         end
    from public.memberships m
   where app.is_active(p_principal)
     and m.principal_id = p_principal
     and (m.expires_at is null or m.expires_at > now())
     and m.scope_kind is not null

  union all

  select 'platform_admin', 'none', null::uuid
    from public.profiles p
   where p.id = p_principal
     and p.is_admin
     and app.is_active(p_principal);
$$;

comment on function authz.assignment_facts(uuid) is
  'Projects LIVE assignment facts for one principal. Carries three of app.has_role''s four '
  'gates: seat expiry, scope discriminator, and principal state (app.is_active, which folds '
  'inactive+suspended — reproduced deliberately). The fourth, the active-role filter, is '
  'permission-dependent and lives in the resolver. ⚠ platform_admin is projected from '
  'profiles.is_admin, not memberships — it has no membership row by design (ADR 0172 §3).';

-- ============================================================================
-- SCOPE REACH — the ASCENT, and it is a BOUNDED TWO-HOP JOIN, not recursion.
--
-- ⛔ PA-F6 rules out per-row RECURSIVE scope ancestry. This is not that:
-- commission -> hospital -> organization is fixed-depth, and the function is a flat CASE
-- over at most two joins. Stated here so a reviewer does not read it as the banned shape.
--
-- ⚠ ASCENT ONLY. A permission resolving at COMMISSION scope is NOT reached by an
-- ORGANIZATION-scoped assignment — that is DESCENT, which is `applies_to_descendants`, a
-- deferred residue column (ADR 0172 §4). ⛔ CONSEQUENCE FOR AE5, stated now rather than
-- discovered there: org_admin/hospital_admin substitution needs that column ruled FIRST, or
-- their commission-scoped permissions will resolve false.
-- ============================================================================

create function authz.scope_reaches(
  p_assignment_kind text, p_assignment_id uuid,
  p_resolution_kind text, p_requested_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_assignment_kind = p_resolution_kind then
      p_assignment_id = p_requested_id

    when p_resolution_kind = 'organization' and p_assignment_kind = 'commission' then
      p_requested_id = (select h.organization_id
                          from public.commissions c
                          join public.hospitals h on h.id = c.hospital_id
                         where c.id = p_assignment_id)

    when p_resolution_kind = 'organization' and p_assignment_kind = 'hospital' then
      p_requested_id = (select h.organization_id from public.hospitals h where h.id = p_assignment_id)

    when p_resolution_kind = 'hospital' and p_assignment_kind = 'commission' then
      p_requested_id = (select c.hospital_id from public.commissions c where c.id = p_assignment_id)

    else false
  end;
$$;

comment on function authz.scope_reaches(text, uuid, text, uuid) is
  'Does an assignment at (kind,id) reach a permission resolving at (kind,id)? ASCENT ONLY, '
  'fixed-depth. ⛔ Descent returns FALSE by design — that is applies_to_descendants, deferred. '
  'Matrix § 11.3: four permissions resolve at the organization while held via a '
  'commission-scoped role, and an adapter deriving resolution scope from '
  'authz.roles.allowed_scope_kind would silently deny all four — an under-grant that looks '
  'like correct tenant isolation and therefore reads as a pass.';

-- ============================================================================
-- MATERIALIZED IMPLICATION CLOSURE [PA-F6].
--
-- `STABLE` is a volatility promise, NOT a per-statement cache: a function whose arguments
-- vary by protected row runs PER ROW. So the closure is computed at MIGRATION time and the
-- runtime resolver is a non-recursive indexed lookup.
--
-- ⭐ THE CLOSURE IS REFLEXIVE — it contains (X,X) for every permission. That is what lets the
-- resolver be ONE join instead of a UNION of "granted directly" and "granted by implication".
-- Consequence worth knowing: with zero implication EDGES the closure still holds 42 rows, so
-- it has a real subject from the moment it exists.
--
-- ⛔ "THE SAME MIGRATION REBUILDS IT" IS A CONVENTION, AND A CONVENTION IS NOT A GATE. The
-- closure is derived data whose only protection would be that someone remembers. pgTAP 401
-- § 15 recomputes it recursively IN THE TEST and asserts set equality, with a vacuity control
-- that makes the table stale and proves the comparison fires.
-- ============================================================================

create table authz.permission_implication_closure (
  implying text not null,
  implied  text not null,
  constraint permission_implication_closure_pkey primary key (implying, implied),
  constraint permission_implication_closure_implying_fkey
    foreign key (implying) references authz.permissions (code)
    on update restrict on delete restrict,
  constraint permission_implication_closure_implied_fkey
    foreign key (implied) references authz.permissions (code)
    on update restrict on delete restrict
);

create index permission_implication_closure_implied_idx
  on authz.permission_implication_closure (implied);

alter table authz.permission_implication_closure enable row level security;

comment on table authz.permission_implication_closure is
  'REFLEXIVE-TRANSITIVE closure of authz.permission_implications, materialized at migration '
  'time so the runtime resolver never recurses (PA-F6). ⛔ DERIVED DATA: rebuilt by '
  'authz.rebuild_implication_closure(), which every migration touching permission_implications '
  'must call. That obligation is a convention; pgTAP 401 § 15 is the gate.';

create function authz.rebuild_implication_closure() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from authz.permission_implication_closure;

  with recursive walk(implying, implied) as (
    select code, code from authz.permissions
    union
    select w.implying, e.implied
      from walk w
      join authz.permission_implications e on e.implying = w.implied
  )
  insert into authz.permission_implication_closure (implying, implied)
  select distinct implying, implied from walk;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

comment on function authz.rebuild_implication_closure() is
  'Recomputes the reflexive-transitive closure from scratch. ⚠ Call this from EVERY migration '
  'that inserts into or deletes from authz.permission_implications — the resolver reads the '
  'closure, never the edges, so a stale closure is a silently wrong authorization answer.';

select authz.rebuild_implication_closure();

-- ============================================================================
-- THE RESOLVER.
--
-- ⭐⭐ GATE 4, THE ACTIVE-ROLE FILTER, AND ITS MANY-TO-MANY TRANSLATION — the sharpest thing
-- in this migration and the one with no legacy counterpart to differential against.
--
-- `app.has_role` compares ONE role to ONE active role. Permissions are MANY-TO-MANY with
-- roles, so the faithful predicate is not "is this role active" but:
--
--     on a SELF-check, the principal must hold the permission THROUGH AT LEAST ONE ROLE
--     THAT IS THE ACTIVE ROLE.
--
-- Both wrong translations are invisible:
--   * requiring EVERY granting role to be active  -> over-denies;
--   * ignoring WHICH role granted it              -> drops the hat gate for the 151
--     self-check sites while still looking like it implements one.
-- Because the filter sits inside the same EXISTS as the grant join, "at least one" is what
-- the SQL naturally expresses — but it is only correct BECAUSE that is the intended
-- semantics, not because it was convenient. pgTAP 401 § 16 pins all three cases.
--
-- ⚠ THE ASYMMETRY IS DERIVED INTERNALLY, NEVER A CALLER-SUPPLIED FLAG. A parameter is a
-- thing callers get wrong, and getting it wrong is undetectable from the answer.
-- ============================================================================

create function authz.has_direct_permission(
  p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from authz.assignment_facts(p_principal) af
      join authz.role_permissions rp
        on rp.role_code = af.role_code
      join authz.permission_implication_closure cl
        on cl.implying = rp.permission_code
       and cl.implied  = p_permission_code
      join authz.permissions pm
        on pm.code = p_permission_code
     where authz.scope_reaches(af.scope_kind, af.scope_id,
                               pm.resolution_scope_kind::text, p_scope_id)
       and (
         p_principal is distinct from (select auth.uid())
         or af.role_code is not distinct from app.active_role()
       )
  );
$$;

comment on function authz.has_direct_permission(uuid, text, uuid, text) is
  'The resolver. Non-recursive: the closure is materialized. ⛔ The active-role filter applies '
  'ONLY to self-checks (matrix § 6A) — uniform-apply breaks the 27 third-party call sites, '
  'never-apply silently drops the hat gate for the 151 self-check sites, and NEITHER uniform '
  'choice is correct. ⚠ p_scope_kind is accepted for call-shape symmetry with the wrappers '
  'and is deliberately NOT used to select the resolution scope — that comes from the '
  'PERMISSION (authz.permissions.resolution_scope_kind), which is the whole point of § 11.3.';

-- ============================================================================
-- THE EXPLANATION — a FIXED COMPOSITE with allowlisted typed fields [PA-F17].
--
-- ⛔ CODES AND IDS ONLY, NEVER OPEN-ENDED JSON. `denied_reason` is a CHECK-pinned domain, not
-- prose — free text is open-ended payload wearing a different name, and a denylist of fixture
-- strings cannot see a newly added field or a transformed value. pgTAP 401 § 17 asserts the
-- EXACT attribute set and types from pg_attribute (schema-positive); the string-negative
-- check is a SECONDARY control and is proven able to fail against a chatty debug variant
-- first.
--
-- Follows the house `*_public` projection-type convention (case_referral_public,
-- printed_document_public, referral_internal_note_public, referral_message_public).
-- ============================================================================

create domain authz.denial_reason as text
  constraint denial_reason_check check (
    value in ('granted', 'unknown_permission', 'principal_inactive_or_unassigned',
              'scope_unreachable', 'wrong_active_role')
  );

comment on domain authz.denial_reason is
  'Closed code set for explanation outcomes. ⛔ NOT prose. ⚠ '
  '`principal_inactive_or_unassigned` is deliberately ONE code: app.is_active gates the whole '
  'projection, so "inactive", "suspended" and "holds no assignment" are indistinguishable '
  'downstream — inventing three codes would claim a precision the system does not have.';

create type authz.permission_explanation as (
  granted                boolean,
  permission_code        text,
  principal_id           uuid,
  requested_scope_kind   text,
  requested_scope_id     uuid,
  resolution_scope_kind  text,
  granting_role_code     text,
  granting_permission_code text,
  denied_reason          text
);

create function authz.explain_direct_permission(
  p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text
) returns authz.permission_explanation
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out    authz.permission_explanation;
  v_res    text;
  v_role   text;
  v_via    text;
  v_selfck boolean := (p_principal is not distinct from (select auth.uid()));
begin
  v_out.granted              := false;
  v_out.permission_code      := p_permission_code;
  v_out.principal_id         := p_principal;
  v_out.requested_scope_kind := p_scope_kind;
  v_out.requested_scope_id   := p_scope_id;

  select pm.resolution_scope_kind::text into v_res
    from authz.permissions pm where pm.code = p_permission_code;
  v_out.resolution_scope_kind := v_res;

  if v_res is null then
    v_out.denied_reason := 'unknown_permission';
    return v_out;
  end if;

  if not exists (select 1 from authz.assignment_facts(p_principal)) then
    v_out.denied_reason := 'principal_inactive_or_unassigned';
    return v_out;
  end if;

  select af.role_code, rp.permission_code into v_role, v_via
    from authz.assignment_facts(p_principal) af
    join authz.role_permissions rp on rp.role_code = af.role_code
    join authz.permission_implication_closure cl
      on cl.implying = rp.permission_code and cl.implied = p_permission_code
   where authz.scope_reaches(af.scope_kind, af.scope_id, v_res, p_scope_id)
     and (not v_selfck or af.role_code is not distinct from app.active_role())
   limit 1;

  if v_role is not null then
    v_out.granted                  := true;
    v_out.granting_role_code       := v_role;
    v_out.granting_permission_code := v_via;
    v_out.denied_reason            := 'granted';
    return v_out;
  end if;

  -- Distinguish the two remaining denials, so the explanation is worth calling.
  if exists (
       select 1 from authz.assignment_facts(p_principal) af
       join authz.role_permissions rp on rp.role_code = af.role_code
       join authz.permission_implication_closure cl
         on cl.implying = rp.permission_code and cl.implied = p_permission_code
      where authz.scope_reaches(af.scope_kind, af.scope_id, v_res, p_scope_id)
     ) then
    v_out.denied_reason := 'wrong_active_role';
  else
    v_out.denied_reason := 'scope_unreachable';
  end if;

  return v_out;
end;
$$;

comment on function authz.explain_direct_permission(uuid, text, uuid, text) is
  'Diagnostic twin of has_direct_permission. Returns a FIXED COMPOSITE — codes and ids only, '
  'never open-ended JSON (PA-F17). ⚠ AUDIT RULING (AE4.3 left this open): third-party calls '
  'are access-audited by the CALLER via public.log_audit_access; self-calls are not. '
  'has_direct_permission is NOT audited at all — it runs per protected row, so auditing it '
  'would make every protected read a write, and Rule 11 already audits those reads at their '
  'own doors. Explaining someone else''s authorization state is the Rule 11 '
  '"reads of another member''s data" case; explaining your own is self-access. The split '
  'mirrors § 6A''s self/third-party asymmetry.';

-- ============================================================================
-- GRANTS: none. Application roles hold no USAGE on `authz` (20261003007100), so they cannot
-- reach these at all; AE1.2's global default already denies PUBLIC EXECUTE. Asserted by
-- EFFECTIVE PRIVILEGE in pgTAP 401 § 18, never by proacl text — a NULL proacl includes PUBLIC.
-- ============================================================================
--
-- ============================================================================
-- ⛔ DOOR-SWEEP RULING: these five DEFINER functions are OUTSIDE EVERY ARM'S DOMAIN, and
-- that is NOT coverage. Absence of a verdict IS absence of coverage (plan rule 4).
--
-- MEASURED, not assumed: the door-audit harness bounds its domain with
-- `n.nspname in ('app','public')`. The `authz` schema is outside it BY NAMESPACE —
-- regardless of privilege — because 20261003007100 deliberately created it outside both,
-- unexposed via PostgREST, with no USAGE for any application role. So the diff-scoped sweep
-- derives ZERO cases here by construction, and that zero must be RULED rather than read as a
-- pass.
--
-- COMPENSATING CONTROLS, NAMED PER DOOR as the rule requires:
--   * pgTAP 401 § 18.1 — 15 effective-privilege probes: no application role holds EXECUTE on
--     any of the five. § 18.2/18.3 are its vacuity control, so those falses are observations.
--   * No schema USAGE for anon/authenticated/service_role (§ 4.1-4.2). Verified INCIDENTALLY
--     and convincingly: an early draft of § 16 switched to `authenticated` and got
--     "permission denied for schema authz" — the design refusing a real call.
--   * Nothing calls these yet. AE4.6 is the cutover; the wrappers are untouched.
--
-- ⚠ STANDING OBLIGATION FOR AE4.6/AE4.7, not a closed item: when the wrappers delegate, THEY
-- are the client-reachable doors and they already sit in every arm's domain, so the resolver
-- becomes an internal callee of an already-swept object. `ARM=census` must see those wrappers
-- as changed gates at that point — a brand-new gate passes ARM=policy vacuously.
-- ============================================================================
