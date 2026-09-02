-- AE4.9 "do now" (1/2) — ADR 0176 D4 [IA-F3]: the permission resolver's CONTRACT is corrected
-- while it still has ZERO callers. Plan § AE4.9 "Do now" item 1; § AE4.4 "Resolver corrections".
--
-- door-sweep-targets: authz.has_permission(uuid, text, uuid, text)
--                     authz.candidate_has_permission(uuid, text, uuid, text)
--                     authz.explain_permission(uuid, text, uuid, text)
--                     authz.entailed_grants(uuid, text, uuid, text)
--
-- ============================================================================
-- WHY NOW. ADR 0176 Consequences: "every D4 change is a zero-compatibility edit only while
-- the resolver has no callers; D4 lands before the first re-keyed site". Measured on the live
-- catalog at head 20261003007240, immediately before writing this file:
--
--   select p.oid::regprocedure from pg_proc p
--    where p.prosrc ~ 'has_direct_permission|explain_direct_permission';   -> ZERO ROWS
--
-- So the five behaviour changes below move no product answer. After the first enforcement
-- site is re-keyed (0176 D6), each becomes a breaking change.
--
-- ============================================================================
-- THE FIVE DEFECTS, EACH REPRODUCED ON THE LIVE CATALOG BEFORE THE FIX (rolled-back
-- transaction, principal = chefe.ccih@test.local, staff_admin @ CCIH, head 20261003007240):
--
--  (1) p_scope_kind IS ACCEPTED AND IGNORED. It appears NOWHERE in has_direct_permission's
--      body; explain_direct_permission only echoes it back. Measured, all four TRUE:
--          kind 'commission' (correct) .. t     kind 'hospital'  (wrong)   .. t
--          kind 'banana'     (nonsense) .. t    kind NULL                  .. t
--      and on the org-scoped side: kind 'organization' .. t, kind 'commission' .. t.
--      ⛔ A security parameter kept "for call-shape symmetry" is removed or enforced, never
--      ignored (0176 D4). It is ENFORCED here: a kind that disagrees with the permission's
--      resolution_scope_kind denies, and NULL denies with it (fail closed).
--
--  (2) authz.roles.state IS NOT READ. Correct for a pre-cutover ORACLE, unsafe under a
--      general name. Measured with staff_admin flipped to 'legacy':
--          authz.holds_role(...)             -> f     (0174 D2's state gate)
--          authz.has_direct_permission(...)  -> t     <- the runtime path disagreed with layer 1
--      Split here: authz.candidate_has_permission (the oracle; sees test_validation AND
--      authoritative) vs authz.has_permission (runtime; authoritative ONLY, fails closed).
--      ⛔ NO CALLER SELECTS BETWEEN THEM — the choice is the function's IDENTITY (0176 D4).
--
--  (3) THE NAMES ASSERT SOMETHING FALSE. Both join permission_implication_closure, so they
--      answer ENTAILED, not DIRECT. Renamed: has_direct_permission -> has_permission,
--      explain_direct_permission -> explain_permission.
--
--  (4) denied_reason IS DECLARED `text` WITH THE DOMAIN SITTING UNUSED BESIDE IT.
--      authz.denial_reason existed from 20261003007100 and nothing referenced it. The
--      composite attribute now carries the domain, so a reason outside the vocabulary RAISES
--      instead of being returned as free text. The domain is EXTENDED here for the three new
--      outcomes rather than smuggling them through as strings (0176 D4).
--
--  (5) A DELETED GRANT EXPLAINED AS `scope_unreachable`, because reachability was computed
--      ONLY through rows that already grant. Measured — the two cases were INDISTINGUISHABLE:
--          delete the staff_admin -> commission.forms.edit grant, ask at her OWN commission
--                                                            -> 'scope_unreachable'
--          ask at a FOREIGN org's commission (grant intact)  -> 'scope_unreachable'
--      The explanation was wrong in the one case an operator most needs it. Scope reachability
--      is now computed with NO permission join at all, and `permission_not_granted` is its own
--      outcome.
--
--  (5b) `limit 1` WITH NO `order by` on the granting path. Reported under a STATED precedence
--      below.
--
-- ============================================================================
-- THE DENIAL PRECEDENCE, STATED (0176 D4: "reported under a stated precedence … an unstated
-- one is not [acceptable]"). explain_permission walks these IN ORDER; exactly one fires:
--
--   1. unknown_permission              the code is not in authz.permissions
--   2. scope_kind_mismatch             p_scope_kind <> the permission's resolution_scope_kind
--                                      (NULL included — fail closed)
--   3. principal_inactive_or_unassigned   assignment_facts is EMPTY for this principal
--   4. scope_unreachable               NO assignment reaches the requested scope.
--                                      ⭐ COMPUTED WITHOUT THE PERMISSION JOIN — this is
--                                      defect (5)'s fix and the reason 4 sits ABOVE the grant
--                                      test rather than falling out of it.
--   G. granted                         ∃ entailed grant with state='authoritative' AND hat ok
--   5. wrong_active_role               ∃ entailed grant with state='authoritative'; the HAT is
--                                      what blocks
--   6. role_not_authoritative          ∃ entailed grant at all; the STATE is what blocks
--                                      (the hat may block too — the state is reported, because
--                                      it is the deployment-level fact and 5 already claimed
--                                      the caller-level one)
--   7. permission_not_granted          NO entailed grant: the scope IS reachable, the code IS
--                                      known, and no assignment of this principal entails it
--
-- GRANTING-PATH PRECEDENCE (case G): lowest role_code, then lowest granting_permission_code,
-- both under the `C` collation — byte order, so it does not move with the database's collation.
--
-- ============================================================================
-- WHAT THIS MIGRATION DELIBERATELY DOES **NOT** DO:
--   • It grants EXECUTE to nobody. All four functions stay unreachable by anon /
--     authenticated / service_role, exactly as the three they replace were (pgTAP 401 §18).
--     ⛔ candidate_has_permission must NEVER be EXECUTE-granted to an application role
--     (0176 D4) — it deliberately answers for roles that are not yet authoritative.
--   • It re-keys no enforcement site. That is 0176 D6 / AE4.9's three representatives.
--   • It does not touch authz.holds_role (layer 1), authz.assignment_facts or
--     authz.scope_reaches. No wrapper, policy or door changes, so no product answer moves.
--   • It does not touch platform_role (0176 D8 — bundled into AE5).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. PRECONDITIONS. Refuse to no-op: this migration is only meaningful against the exact
--    pre-state described above. ⛔ A migration that silently does nothing is how a
--    "correction" ships as a comment.
-- ---------------------------------------------------------------------------
do $mig$
begin
  if to_regprocedure('authz.has_direct_permission(uuid,text,uuid,text)') is null
     or to_regprocedure('authz.explain_direct_permission(uuid,text,uuid,text)') is null then
    raise exception
      'AE4.9 D4: the AE4.4b resolver pair is absent — 20261003007170 is expected to have '
      'created it. Refusing to rename functions that do not exist.'
      using errcode = 'check_violation';
  end if;

  -- The zero-caller premise is the whole justification for a zero-compatibility edit, so it
  -- is ASSERTED at apply time and not merely recorded above. If a caller has appeared since,
  -- this is a finding to rule on, not something to patch through.
  if exists (
    select 1 from pg_proc p
     where p.oid <> to_regprocedure('authz.has_direct_permission(uuid,text,uuid,text)')
       and p.oid <> to_regprocedure('authz.explain_direct_permission(uuid,text,uuid,text)')
       and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
           ~ 'has_direct_permission|explain_direct_permission'
  ) then
    raise exception
      'AE4.9 D4: the resolver HAS a caller in pg_proc. ADR 0176 Consequences make this a '
      'zero-compatibility edit ONLY while callers = 0. Stop and rule on the caller.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'authz' and t.typname = 'denial_reason'
                and exists (select 1 from pg_constraint c
                             where c.contypid = t.oid
                               and pg_get_constraintdef(c.oid) like '%permission_not_granted%'))
  then
    raise exception 'AE4.9 D4: authz.denial_reason already carries the new vocabulary — '
                    'investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
end $mig$;

-- ---------------------------------------------------------------------------
-- 1. THE DOMAIN gains the three new outcomes. Defect (4): they go into the DOMAIN, never
--    through as free text. The constraint is dropped and re-added by name (a domain CHECK
--    cannot be altered in place).
-- ---------------------------------------------------------------------------
alter domain authz.denial_reason drop constraint denial_reason_check;
alter domain authz.denial_reason add constraint denial_reason_check check (
  value = any (array[
    'granted',
    'unknown_permission',
    'principal_inactive_or_unassigned',
    'scope_unreachable',
    'wrong_active_role',
    -- ⭐ AE4.9 D4 additions. Each names a state the old vocabulary COLLAPSED into one of the
    -- five above, which is what made the explanation wrong where it mattered most.
    'scope_kind_mismatch',        -- (1) the requested kind disagrees with resolution_scope_kind
    'role_not_authoritative',     -- (2) the grant exists; its role is not yet authoritative
    'permission_not_granted'      -- (5) the scope IS reachable; no assignment entails the code
  ])
);

comment on domain authz.denial_reason is
  'The CLOSED vocabulary of authz.explain_permission outcomes. ⛔ A new outcome is added HERE, '
  'as a domain value — never returned as free text through a `text` column (that is exactly what '
  'AE4.4b did, with this domain sitting unused beside it: ADR 0176 D4). The eight values are '
  'walked in the precedence stated in explain_permission''s comment; exactly one fires per call.';

-- ---------------------------------------------------------------------------
-- 2. DROP the two mis-named functions. DROP rather than a rename because (a) the composite's
--    attribute type cannot change while a function returns it, and (b) the pair is being
--    replaced by FOUR functions with a different internal shape — a rename would leave the
--    old body in place under a truer name, which is the least honest of the options.
--    ⚠ There are no callers to break (asserted in §0).
-- ---------------------------------------------------------------------------
drop function authz.has_direct_permission(uuid, text, uuid, text);
drop function authz.explain_direct_permission(uuid, text, uuid, text);

-- ---------------------------------------------------------------------------
-- 3. THE COMPOSITE carries the domain. Defect (4).
--    ⚠ pgTAP 401 §17.1 asserts this composite's EXACT attribute list and types, so this line
--    is measured, not merely intended: the assertion's expected string changes with it.
-- ---------------------------------------------------------------------------
alter type authz.permission_explanation
  alter attribute denied_reason type authz.denial_reason;

comment on column authz.permission_explanation.denied_reason is
  'authz.denial_reason (AE4.9 D4) — was `text` while the domain sat unused beside it. Typed, so '
  'an outcome outside the closed vocabulary RAISES rather than escaping as a string.';

-- ---------------------------------------------------------------------------
-- 4. THE SHARED JOIN, ONCE. Every entailed grant of (principal, permission) at the requested
--    coordinate, with the two GATES returned as COLUMNS rather than applied here.
--
--    ⭐ WHY THE GATES ARE COLUMNS AND NOT PREDICATES. The runtime evaluator, the candidate
--    evaluator and the explanation need the SAME join under THREE different gate
--    combinations. Three copies of a five-way join drift; this is one copy, and the callers
--    are the only place a gate is chosen. It is also what lets the explanation say WHICH gate
--    blocked instead of collapsing every denial into "no".
--
--    SHAPE: identical to its authz siblings (assignment_facts / scope_reaches / holds_role) —
--    STABLE, SECURITY DEFINER, `search_path = ''`, no EXECUTE for any application role — so it
--    inherits exactly their arm memberships and introduces no new door shape.
--    ⚠ INNER JOIN to authz.roles is lossless, not a filter: authz.role_permissions.role_code
--    is FK'd to authz.roles(code), so a role absent from the catalog can hold no grant.
-- ---------------------------------------------------------------------------
create or replace function authz.entailed_grants(
  p_principal        uuid,
  p_resolution_kind  text,
  p_scope_id         uuid,
  p_permission_code  text
) returns table (
  role_code                text,
  granting_permission_code text,
  role_state               text,
  hat_ok                   boolean
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select af.role_code,
         rp.permission_code,
         r.state::text,
         -- The §6A ASYMMETRY, carried verbatim from AE4.4b: a THIRD-PARTY question ignores the
         -- hat (the 27 `_for` sites), a SELF question requires it (the 151 self-check sites).
         -- Neither uniform choice is correct.
         (p_principal is distinct from (select auth.uid())
          or af.role_code is not distinct from app.active_role())
    from authz.assignment_facts(p_principal) af
    join authz.roles r
      on r.code = af.role_code
    join authz.role_permissions rp
      on rp.role_code = af.role_code
    join authz.permission_implication_closure cl
      on cl.implying = rp.permission_code
     and cl.implied  = p_permission_code
   where authz.scope_reaches(af.scope_kind, af.scope_id, p_resolution_kind, p_scope_id);
$fn$;

revoke all on function authz.entailed_grants(uuid, text, uuid, text) from public;

comment on function authz.entailed_grants(uuid, text, uuid, text) is
  'AE4.9 D4 — the ONE copy of the entailment join, shared by authz.has_permission, '
  'authz.candidate_has_permission and authz.explain_permission. Returns every granting path '
  'at the requested coordinate with the STATE and HAT gates as COLUMNS, so each caller applies '
  'the gates its own contract requires and the explanation can name which one blocked. '
  '⛔ Internal to the resolver family: it applies NO state gate, so it is not an authorization '
  'answer and must never be called by a policy, a door or a product path. p_resolution_kind is '
  'the PERMISSION''s resolution_scope_kind — the callers validate p_scope_kind against it '
  'before getting here.';

-- ---------------------------------------------------------------------------
-- 5. THE RUNTIME EVALUATOR. Layer 2 of the three interfaces (0176 D2). It is NOT final
--    authorization and its name must not suggest it is — layer 3's app.can_* authorizers
--    compose hard denies, lifecycle and sensitivity BEFORE this positive source.
-- ---------------------------------------------------------------------------
create or replace function authz.has_permission(
  p_principal       uuid,
  p_scope_kind      text,
  p_scope_id        uuid,
  p_permission_code text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    -- (1) SCOPE-KIND VALIDATION, fail closed. `is distinct from` makes BOTH an unknown code
    -- (the subselect is NULL) and a NULL p_scope_kind deny, without a separate branch.
    when p_scope_kind is distinct from (
           select pm.resolution_scope_kind::text
             from authz.permissions pm
            where pm.code = p_permission_code)
      then false
    else exists (
      select 1
        from authz.entailed_grants(p_principal, p_scope_kind, p_scope_id, p_permission_code) eg
       where eg.role_state = 'authoritative'   -- (2) THE STATE GATE. Runtime sees ONLY this.
         and eg.hat_ok
    )
  end;
$fn$;

revoke all on function authz.has_permission(uuid, text, uuid, text) from public;

comment on function authz.has_permission(uuid, text, uuid, text) is
  'LAYER 2 of ADR 0176 D2 — POSITIVE ENTITLEMENT, the RUNTIME evaluator. Renamed from '
  'authz.has_direct_permission: it joins the implication closure, so it answers ENTAILED, not '
  'direct. ⛔ NOT final authorization — layer 3 (app.can_* authorizers carrying the permission '
  'code as a literal) composes hard denies, record lifecycle, sensitivity ceilings and '
  'tenant/resource rules BEFORE this positive source. '
  'GATES, all four: (1) p_scope_kind must EQUAL the permission''s resolution_scope_kind — a '
  'mismatch, an unknown code and a NULL kind all deny; (2) the granting role must be '
  'authoritative — anything else fails CLOSED, which is what separates this from '
  'authz.candidate_has_permission; (3) the seat/principal gates inside assignment_facts; '
  '(4) the §6A hat asymmetry. ⛔ No caller chooses between runtime and candidate — the choice '
  'is the function IDENTITY (0176 D4).';

-- ---------------------------------------------------------------------------
-- 6. THE CANDIDATE EVALUATOR — the PRE-CUTOVER ORACLE. Identical to the runtime evaluator
--    except that it also sees roles in `test_validation`.
--
--    ⛔ NEVER EXECUTE-GRANT THIS TO AN APPLICATION ROLE (0176 D4). It deliberately answers for
--    roles whose catalog modelling has not been ratified.
--    ⚠ IT DOES NOT SEE `legacy`. A legacy role's grants are not modelled, so an oracle that
--    read them would be differentialling an unapproved mapping. The pre-cutover sequence is
--    legacy -> test_validation -> authoritative, and the differential runs on the middle state:
--    that state is where candidate and runtime DISAGREE, and therefore where the split is
--    observable at all. Under `legacy` BOTH deny, which is the correct answer and not a split.
-- ---------------------------------------------------------------------------
create or replace function authz.candidate_has_permission(
  p_principal       uuid,
  p_scope_kind      text,
  p_scope_id        uuid,
  p_permission_code text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when p_scope_kind is distinct from (
           select pm.resolution_scope_kind::text
             from authz.permissions pm
            where pm.code = p_permission_code)
      then false
    else exists (
      select 1
        from authz.entailed_grants(p_principal, p_scope_kind, p_scope_id, p_permission_code) eg
       where eg.role_state in ('test_validation', 'authoritative')
         and eg.hat_ok
    )
  end;
$fn$;

revoke all on function authz.candidate_has_permission(uuid, text, uuid, text) from public;

comment on function authz.candidate_has_permission(uuid, text, uuid, text) is
  'THE PRE-CUTOVER ORACLE (ADR 0176 D4) — the half of the AE4.5 differential that is compared '
  'against the APPROVED MATRIX. Same contract as authz.has_permission in every respect except '
  'the state gate: it also sees roles in `test_validation`, which is the state a role occupies '
  'while its catalog mapping is being differentialled. It does NOT see `legacy` — an unmodelled '
  'role''s grants are not an oracle. '
  '⛔ NEVER GRANT EXECUTE ON THIS TO anon / authenticated / service_role, and never call it from '
  'a policy, a door or a server action: it answers for roles that are not yet authoritative. '
  'The runtime path is authz.has_permission and the choice between them is the function '
  'IDENTITY, never a parameter.';

-- ---------------------------------------------------------------------------
-- 7. THE EXPLANATION. Diagnostic, not a decision (0176 D4). It describes LAYER 2 only; a
--    final-authorization explanation belongs to the layer-3 authorizer and names the
--    restriction that won.
-- ---------------------------------------------------------------------------
create or replace function authz.explain_permission(
  p_principal       uuid,
  p_scope_kind      text,
  p_scope_id        uuid,
  p_permission_code text
) returns authz.permission_explanation
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_out  authz.permission_explanation;
  v_res  text;
  v_role text;
  v_via  text;
begin
  v_out.granted              := false;
  v_out.permission_code      := p_permission_code;
  v_out.principal_id         := p_principal;
  v_out.requested_scope_kind := p_scope_kind;
  v_out.requested_scope_id   := p_scope_id;

  -- 1. unknown_permission
  select pm.resolution_scope_kind::text into v_res
    from authz.permissions pm where pm.code = p_permission_code;
  v_out.resolution_scope_kind := v_res;

  if v_res is null then
    v_out.denied_reason := 'unknown_permission';
    return v_out;
  end if;

  -- 2. scope_kind_mismatch. ⛔ NEW OUTCOME. Before AE4.9 the parameter was ignored entirely,
  -- so `hospital` — and `banana` — granted against a commission id.
  if p_scope_kind is distinct from v_res then
    v_out.denied_reason := 'scope_kind_mismatch';
    return v_out;
  end if;

  -- 3. principal_inactive_or_unassigned
  if not exists (select 1 from authz.assignment_facts(p_principal)) then
    v_out.denied_reason := 'principal_inactive_or_unassigned';
    return v_out;
  end if;

  -- 4. scope_unreachable — ⭐ COMPUTED WITH NO PERMISSION JOIN AT ALL. This is defect (5)'s
  -- fix: before AE4.9 reachability was read off the granting query, so deleting a grant
  -- reported the SCOPE as unreachable. The two questions are now answered by two queries.
  if not exists (
       select 1 from authz.assignment_facts(p_principal) af
        where authz.scope_reaches(af.scope_kind, af.scope_id, v_res, p_scope_id)
     ) then
    v_out.denied_reason := 'scope_unreachable';
    return v_out;
  end if;

  -- G. granted — under the STATED granting-path precedence: lowest role_code, then lowest
  -- granting_permission_code, `C` collation. ⛔ `limit 1` with no `order by` (AE4.4b) reported
  -- an arbitrary path, so two identical calls could name different roles.
  select eg.role_code, eg.granting_permission_code into v_role, v_via
    from authz.entailed_grants(p_principal, v_res, p_scope_id, p_permission_code) eg
   where eg.role_state = 'authoritative'
     and eg.hat_ok
   order by eg.role_code collate "C", eg.granting_permission_code collate "C"
   limit 1;

  if v_role is not null then
    v_out.granted                  := true;
    v_out.granting_role_code       := v_role;
    v_out.granting_permission_code := v_via;
    v_out.denied_reason            := 'granted';
    return v_out;
  end if;

  -- 5. wrong_active_role — an authoritative granting path exists; the HAT is what blocks.
  if exists (
       select 1 from authz.entailed_grants(p_principal, v_res, p_scope_id, p_permission_code) eg
        where eg.role_state = 'authoritative'
     ) then
    v_out.denied_reason := 'wrong_active_role';
    return v_out;
  end if;

  -- 6. role_not_authoritative — ⛔ NEW OUTCOME. A granting path exists but its role has not
  -- reached `authoritative`, so the RUNTIME evaluator fails closed while the candidate oracle
  -- may still answer TRUE. Without this the caller sees `permission_not_granted` and goes
  -- looking for a missing grant that is in fact present.
  if exists (
       select 1 from authz.entailed_grants(p_principal, v_res, p_scope_id, p_permission_code)
     ) then
    v_out.denied_reason := 'role_not_authoritative';
    return v_out;
  end if;

  -- 7. permission_not_granted — ⛔ NEW OUTCOME. The code is known, the kind is right, the
  -- principal is assigned, the scope IS reachable, and nothing they hold entails the code.
  v_out.denied_reason := 'permission_not_granted';
  return v_out;
end;
$fn$;

revoke all on function authz.explain_permission(uuid, text, uuid, text) from public;

comment on function authz.explain_permission(uuid, text, uuid, text) is
  'DIAGNOSTIC for layer 2 only (ADR 0176 D2/D4) — never a decision, and it describes '
  'authz.has_permission''s RUNTIME contract. A final-authorization explanation belongs to the '
  'layer-3 app.can_* authorizer and names the restriction that won. '
  'PRECEDENCE, walked in order, exactly one fires: 1 unknown_permission · 2 scope_kind_mismatch '
  '(NULL kind included) · 3 principal_inactive_or_unassigned · 4 scope_unreachable, computed '
  'with NO permission join · G granted · 5 wrong_active_role (an authoritative path exists; the '
  'hat blocks) · 6 role_not_authoritative (a path exists; the state blocks) · '
  '7 permission_not_granted (the scope is reachable and nothing entails the code). '
  'GRANTING PATH: lowest role_code, then lowest granting_permission_code, `C` collation — '
  'AE4.4b used `limit 1` with no `order by`. '
  '⛔ If this ever becomes remotely callable its audit lives inside the door (0176 D4). It holds '
  'EXECUTE for no application role today.';

-- ---------------------------------------------------------------------------
-- 8. LANDING ASSERTIONS. ⛔ A mutation that did not fully apply reports GREEN — assert the
--    edit LANDED, from the catalog, after the DDL.
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_missing text;
begin
  select string_agg(f, ', ')
    into v_missing
    from unnest(array[
      'authz.has_permission(uuid,text,uuid,text)',
      'authz.candidate_has_permission(uuid,text,uuid,text)',
      'authz.explain_permission(uuid,text,uuid,text)',
      'authz.entailed_grants(uuid,text,uuid,text)']) f
   where to_regprocedure(f) is null;
  if v_missing is not null then
    raise exception 'AE4.9 D4: these functions are ABSENT after the DDL: %', v_missing
      using errcode = 'check_violation';
  end if;

  if to_regprocedure('authz.has_direct_permission(uuid,text,uuid,text)') is not null
     or to_regprocedure('authz.explain_direct_permission(uuid,text,uuid,text)') is not null then
    raise exception 'AE4.9 D4: the old resolver names still exist — the rename did not land.'
      using errcode = 'check_violation';
  end if;

  -- The composite carries the DOMAIN, read from the catalog rather than believed.
  if (select format_type(a.atttypid, a.atttypmod)
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'authz' and c.relname = 'permission_explanation'
         and a.attname = 'denied_reason') <> 'authz.denial_reason' then
    raise exception 'AE4.9 D4: permission_explanation.denied_reason is NOT the domain.'
      using errcode = 'check_violation';
  end if;

  -- Every new function is DEFINER with a pinned search_path, like its siblings.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'authz'
       and p.proname in ('has_permission','candidate_has_permission','explain_permission','entailed_grants')
       and (not p.prosecdef or p.proconfig is null or not ('search_path=""' = any (p.proconfig)))
  ) then
    raise exception 'AE4.9 D4: a new resolver function is not DEFINER with search_path = ''''.'
      using errcode = 'check_violation';
  end if;

  -- ⛔ NO APPLICATION ROLE MAY EXECUTE ANY OF THE FOUR. Effective privilege, never proacl text
  -- (a NULL proacl includes PUBLIC).
  if exists (
    select 1
      from unnest(array['anon','authenticated','service_role']) r
      cross join unnest(array[
        'authz.has_permission(uuid,text,uuid,text)',
        'authz.candidate_has_permission(uuid,text,uuid,text)',
        'authz.explain_permission(uuid,text,uuid,text)',
        'authz.entailed_grants(uuid,text,uuid,text)']) f
     where has_function_privilege(r, f, 'EXECUTE')
  ) then
    raise exception 'AE4.9 D4: an application role holds EXECUTE on a resolver function.'
      using errcode = 'check_violation';
  end if;
end $mig$;
