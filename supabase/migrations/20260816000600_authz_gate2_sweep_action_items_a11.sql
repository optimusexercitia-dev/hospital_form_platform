-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — THE CLASS SWEEP, part 2: action-item WRITE doors
-- (qa review §7 open risk 1).
--
-- A11 removed the Organization User's arm from `app.can_read_action_item` for
-- the `committee` and `assignees_only` scopes (catalog-verified: both arms now
-- carry the comment "C7: org arm removed (A11)"). A11 also repoints
-- `action_items_staff_admin_write` (⚠ FOR ALL).
--
-- ⭐ THE READ PREDICATE WAS FIXED; NINE DEFINER WRITE DOORS KEPT THE ARM.
-- Same class as the P0: prosecdef = t ⇒ RLS never runs ⇒ the policy work is
-- bypassed.
--
-- PROVEN BY EXECUTION as orgadmin.a on the seed's committee-scope action item
-- (preconditions asserted: app.can_read_action_item = FALSE, and the base table
-- returns 0 rows under RLS):
--   select public.update_committee_action_item(<id>, p_title := 'PWNED BY ORG ADMIN');
--   → title AFTER: "PWNED BY ORG ADMIN"
-- An Organization User who provably CANNOT READ a committee action item rewrote
-- it. A11's own rationale — "an item minuted out of a reserved session walks
-- straight out to an Organization User after every meeting table is closed" —
-- applies to the write direction verbatim: an admin who cannot read a committee
-- action item must not author one.
--
-- KEPT DELIBERATELY (no over-reach — A10 / D4·1):
--   • public.case_action_items_kpis — an AGGREGATE (counts). D4·1: Organization
--     Users "keep full administrative authority AND PHI-FREE AGGREGATES; they
--     lose case content." Counts are not item content. NOT cut.
--   • `case_restricted` scope is fixed for free through can_read_case (D4·1).
--
-- METHOD: bodies REGENERATED FROM THE LIVE CATALOG at apply time; only the gate
-- disjunct is removed; volatility / SECURITY DEFINER / search_path / ACL carried
-- verbatim by pg_get_functiondef. Every step asserted. See the sibling migration
-- 20260816000500 for the full rationale of this method.
-- =============================================================================

do $$
declare
  v_target   record;
  v_oid      oid;
  v_def      text;
  v_new      text;
  v_pattern  text := '\s+or\s+app\.is_commission_admin_of(_for)?\s*\([^()]*\)';
  v_secdef   boolean;
  v_volatile "char";
  v_acl      text;
begin
  for v_target in
    select * from (values
      ('public', 'advance_committee_action_item'),
      ('public', 'create_committee_action_item'),
      ('public', 'update_committee_action_item'),
      ('public', 'delete_committee_action_item'),
      ('public', 'create_committee_action_item_reminder'),
      ('public', 'update_committee_action_item_reminder'),
      ('public', 'delete_committee_action_item_reminder'),
      ('app',    'can_write_action_item_stake')
    ) as t(sch, fn)
  loop
    for v_oid in
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = v_target.sch and p.proname = v_target.fn
    loop
      v_def := pg_get_functiondef(v_oid);
      select prosecdef, provolatile, coalesce(array_to_string(proacl, ','), '<null>')
        into v_secdef, v_volatile, v_acl from pg_proc where oid = v_oid;

      -- §7.2 — the arm must be LIVE CODE, not a comment.
      if not exists (
        select 1 from unnest(string_to_array(v_def, E'\n')) ln
         where ln ~ 'app\.is_commission_admin_of' and trim(ln) !~ '^--'
      ) then
        raise exception 'sweep/action_items: %.%: the arm is not live code — premise wrong, stop',
                        v_target.sch, v_target.fn;
      end if;

      v_new := regexp_replace(v_def, v_pattern, '', 'g');
      if v_new = v_def then
        raise exception 'sweep/action_items: %.%: the gate pattern did not match — body shape changed',
                        v_target.sch, v_target.fn;
      end if;

      execute v_new;

      if pg_get_functiondef(v_oid) ~ 'app\.is_commission_admin_of' then
        raise exception 'sweep/action_items: %.%: the arm SURVIVES the replace', v_target.sch, v_target.fn;
      end if;
      if (select prosecdef from pg_proc where oid = v_oid) is distinct from v_secdef then
        raise exception 'sweep/action_items: %.%: prosecdef changed', v_target.sch, v_target.fn;
      end if;
      if (select provolatile from pg_proc where oid = v_oid) is distinct from v_volatile then
        raise exception 'sweep/action_items: %.%: provolatile changed', v_target.sch, v_target.fn;
      end if;
      if (select coalesce(array_to_string(proacl, ','), '<null>') from pg_proc where oid = v_oid)
         is distinct from v_acl then
        raise exception 'sweep/action_items: %.%: the ACL changed (17a8d08 class)', v_target.sch, v_target.fn;
      end if;
    end loop;
  end loop;

  -- NO-OVER-REACH, asserted: the aggregate door keeps its arm (D4·1).
  if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'case_action_items_kpis') !~ 'is_commission_admin_of' then
    raise exception 'sweep/action_items: case_action_items_kpis LOST its org arm — that is over-reach; '
                    'D4·1 keeps PHI-free aggregates for Organization Users';
  end if;
end $$;
