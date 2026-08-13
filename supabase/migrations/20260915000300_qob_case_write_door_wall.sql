-- QO·B M4 — org_admin / hospital_admin content wall: the case-plane WRITE doors.
--                                                     Fixes BUG-QOB-002.
--
-- ADR 0100 D12; PO rulings Q8/Q9 (2026-08-08).
--
-- THE DEFECT. A4 narrowed the case READ plane (policies + 4 functions) and left the
-- WRITE doors gated on the tenancy predicate, so the two planes disagree. Proven by
-- execution, one transaction, one principal, before this migration:
--     get_case_detail(case_a)                    -> DENIED, 'caso … não encontrado'
--     select count(*) from cases                 -> 0
--     update_case_meta(case_a, 'PHASE-B-PROBE')  -> SUCCEEDED, the case was renamed
-- i.e. the tenancy admin could WRITE case content it could not READ. The doors read
-- public.cases directly inside SECURITY DEFINER, so RLS never applies to them.
--
-- POPULATION — DERIVED, NOT HAND-LISTED. The case-content mutators are exactly the
-- functions carrying A4-Unit-2's exclusion guard, app.assert_not_case_excluded (31 of
-- them); 23 of those also admit the tenancy admin. That is a structural property of the
-- catalog, so a door added later inherits the enumeration instead of being forgotten —
-- the failure mode ADR 0100's standing rule and the 'enumeration boundary' lesson name.
-- Both counts are ASSERTED below; drift reds the migration rather than silently
-- shrinking the population.
--
-- ⚠ WHY NOT A UNIFORM 'must be able to read the case' GUARD. That was the first design
--    and it is WRONG — an over-cut. app.can_read_case is has_case_capability(
--    'read_case_content'), and _case_caps' S5 committee-member arm confers NO content
--    (deliberation only — 311 §6.4). A plain member, and the `administrativo`
--    create_cases path that update_case_meta explicitly admits, would both have been
--    denied. 11 of 14 DML doors in QO·A's closure were likewise safe for per-door
--    reasons a blanket predicate would have broken. So M4 subtracts precisely the
--    tenancy disjunct, exactly as M1–M3 did for policies, and touches nobody else.
--
-- KEPT, per PO rulings Q8/Q9 — these are in the 23 and are deliberately NOT cut:
--   grant_case_access · revoke_case_access · list_case_access
--       Administrative (A4's scope ruling: 'granting is neither content nor PHI'), and
--       the self-escalation path is independently closed — MEASURED: org_admin's
--       self-grant raises 'o responsável deve ser membro da comissão' because it is
--       org-scoped and not a commission member, while granting a real member succeeds.
--   set_case_visibility · set_case_confidentiality
--       Classification shapes the container, mirroring set_commission_oversight which
--       the tenancy admin retains.
--   dispose_case_phi is NOT kept — Q9 cuts it: destroying Rule 12 data is not a duty
--       for a principal that holds zero PHI bits (D5).

begin;

do $$
declare
  r          record;
  v_src      text;
  v_new      text;
  v_family   int;
  v_admits   int;
  v_cut      int := 0;
  -- Ratified KEEP set (Q8/Q9). Named explicitly so the exclusion is auditable, while
  -- the POPULATION itself stays derived.
  v_keep     text[] := array['grant_case_access','revoke_case_access','list_case_access',
                             'set_case_visibility','set_case_confidentiality'];
begin
  -- Population sanity, asserted before mutating anything.
  select count(*) filter (where src ~ 'assert_not_case_excluded'),
         count(*) filter (where src ~ 'assert_not_case_excluded' and src ~ '\yis_commission_admin_of\y')
    into v_family, v_admits
  from (
    select regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g') as src
    from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
  ) s;

  if v_family <> 31 or v_admits <> 23 then
    raise exception
      'QO·B M4: the derived population moved (exclusion-guard family=% expected 31, '
      'of which admit the tenancy admin=% expected 23). Re-derive and re-ratify before '
      'cutting — do NOT adjust these numbers to make the migration pass.', v_family, v_admits;
  end if;

  for r in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'assert_not_case_excluded'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\yis_commission_admin_of\y'
      and not (p.proname = any(v_keep))
    order by p.proname
  loop
    v_src := pg_get_functiondef(r.oid);

    -- Remove the tenancy disjunct in BOTH orders. The argument may itself contain one
    -- level of nesting, e.g. app.is_commission_admin_of(app.commission_of_case(p_id)).
    v_new := regexp_replace(v_src,
      '\s+or\s+app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)', '', 'g');
    v_new := regexp_replace(v_new,
      'app\.is_commission_admin_of\((?:[^()]|\([^()]*\))*\)\s+or\s+', '', 'g');

    if v_new = v_src then
      raise exception
        'QO·B M4: the tenancy-disjunct removal matched NOTHING in %(), yet it is in the '
        'derived population. Its gate is not the expected shape — read it from '
        'pg_get_functiondef and handle it explicitly. Refusing to no-op silently.',
        r.proname;
    end if;

    -- The arm must be GONE, not merely reduced: a door whose gate mentioned the
    -- predicate twice (or in a shape the first pattern only partly matched) would
    -- otherwise ship half-cut and green.
    if regexp_replace(v_new, '/\*.*?\*/', ' ', 'gs') ~ '\yis_commission_admin_of\y' then
      raise exception
        'QO·B M4: %() still routes app.is_commission_admin_of after the rewrite — the '
        'cut is partial.', r.proname;
    end if;

    execute v_new;
    v_cut := v_cut + 1;
  end loop;

  if v_cut <> 18 then
    raise exception 'QO·B M4: expected to cut 18 doors (23 admitting - 5 ratified KEEP), cut %', v_cut;
  end if;

  raise notice 'QO·B M4: tenancy disjunct removed from % case-content doors', v_cut;
end $$;

-- ---------------------------------------------------------------------------
-- Postconditions.
-- ---------------------------------------------------------------------------
do $$
declare v_bad text; v_keep_ok int;
begin
  -- (a) No case-content mutator outside the ratified KEEP set may admit the tenancy admin.
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  where p.pronamespace='public'::regnamespace and p.prokind='f'
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ 'assert_not_case_excluded'
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ '\yis_commission_admin_of\y'
    and p.proname <> all (array['grant_case_access','revoke_case_access','list_case_access',
                                'set_case_visibility','set_case_confidentiality']);
  if v_bad is not null then
    raise exception 'QO·B M4 postcondition (a): case-content door still admits the tenancy admin: %', v_bad;
  end if;

  -- (b) NON-VACUITY / under-cut guard: the five ratified KEEPs must STILL admit it.
  --     If a later edit cuts them too, that is an over-cut of a PO ruling and reds here.
  select count(*) into v_keep_ok
  from pg_proc p
  where p.pronamespace='public'::regnamespace and p.prokind='f'
    and p.proname = any(array['grant_case_access','revoke_case_access','list_case_access',
                              'set_case_visibility','set_case_confidentiality'])
    and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
        ~ '\yis_commission_admin_of\y';
  if v_keep_ok <> 5 then
    raise exception
      'QO·B M4 postcondition (b): expected all 5 ratified KEEP doors to retain the '
      'tenancy arm, found %. Either an over-cut, or the KEEP set drifted — re-ratify.', v_keep_ok;
  end if;

  -- (c) The exclusion guard itself must survive on every door touched (a rewrite that
  --     dropped it would re-open the A4 Unit-2 perimeter while looking like a QO·B win).
  if exists (
    select 1 from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname in
      ('update_case_meta','activate_phase','assign_narrative','conclude_narrative','reopen_case')
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          !~ 'assert_not_case_excluded') then
    raise exception 'QO·B M4 postcondition (c): a rewritten door LOST its exclusion guard';
  end if;
end $$;

commit;
