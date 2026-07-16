-- =============================================================================
-- AUTHZ · M5b — defect ③ AT THE DOORS. The public DEFINER RPCs that inline a raw
-- arm under a bare auth.uid(). ADR 0078 Context·3 / D3.
--
-- ⛔⛔ THIS FILE EXISTS BECAUSE M5's "THE SET WAS CLOSED" CLAIM WAS FALSE.
-- M5 (20260726000000) gated the `app.*` predicates and asserted the set was closed
-- over {functions touching a raw-arm table} = 17. That population was the `app.*`
-- PREDICATE SUBSET. It excluded the `public.*` DEFINER RPCs, which are
-- `prosecdef = t` — meaning RLS DOES NOT APPLY TO THEM AT ALL. A28's exact lesson:
-- a DEFINER's gate REPLACES RLS, so a predicate-shaped closure is STRUCTURALLY
-- BLIND to them. That is the FOURTH time this program has been bitten by it, and
-- §7.5's signature failure: five rounds produced five caller floors, each of which
-- looked like a population. Mine was the sixth.
--
-- ⚠ THE CORRECTION IS RECORDED, NOT QUIETLY DROPPED. M5's header claim is amended
-- at the bottom of this file. An inaccurate closure claim is worse than an admitted
-- floor: it trains the next reader to skip the check.
--
-- PROVEN LIVE against the M5-gated catalog (staff1.ccih deactivated, `set local
-- role authenticated`, rolled back) — the predicates deny, the doors serve anyway:
--     app.can_read_case                    = f     <- M5's gate works
--     app.can_read_action_item             = f     <- M5's gate works
--     public.list_my_cases                 -> 2 rows
--     public.list_my_action_items          -> 1 row
--     public.get_member_overview           -> cases_not_concluded 2, pending 1
--     public.conclude_narrative            -> SUCCEEDS
--     public.advance_committee_action_item -> SUCCEEDS
-- No Rule 12 breach (content only — no identifiers), but the literal text of
-- defect ③: "a deactivated or suspended user holding a live grant or a surviving
-- assignment still reads."
--
-- =============================================================================
-- ⛔ THE POPULATION WAS CLOSED BEHAVIOURALLY, NOT TEXTUALLY — and that is the whole
-- methodological point of this file.
--
-- A text-based transitive-`is_active` graph reports `list_my_cases` as GATED. IT IS
-- NOT. `is_staff_admin_of_for` appears in its `my_role` CHIP; its WHERE clause is
-- `grant OR phase_asg OR narr_asg` under a bare auth.uid(). Two independent text
-- sweeps (qa's and mine) were both fooled by that one string. ONLY `set local role
-- authenticated` caught it. So: text generates CANDIDATES; behaviour returns the
-- VERDICT (§7.2 — resolve the value, not the noun).
--
-- Every `authenticated`-executable public DEFINER RPC touching a raw-arm table was
-- called as a DEACTIVATED raw-arm holder, with an ACTIVE control on the same door:
--
--   ⛔ UNGATED — gated by this file (5):
--     list_my_cases (2 rows) · list_my_action_items (1) · get_member_overview (2/1/1)
--     · conclude_narrative (SUCCEEDS) · advance_committee_action_item (SUCCEEDS)
--     ⭐ The last two are NOT in qa's finding. qa probed the READ doors; the same
--     probe over the WRITE doors found two more of the identical class — a raw
--     `assigned_to = auth.uid()` arm ORed beside gated coordinator arms.
--
--   ✅ FIXED FOR FREE — denied behaviourally, no change needed (17):
--     get_case_detail · list_cases_board (per-row can_read_case: 0 rows deactivated,
--     2 active) · save_narrative_body · activate_phase · reassign_phase · create_case
--     · create_case_from_template · grant_case_access · revoke_case_access
--     · assign_narrative · unassign_narrative · reopen_narrative · add_ad_hoc_narrative
--     · create_committee_action_item · update_committee_action_item
--     · set_case_phase_result_override · list_case_access
--     ⚠ `list_case_access` denies the ACTIVE holder too — it is coordinator-only, so
--     it is excluded on AUTHORITY, not on is_active. A keystone there would be the
--     wrong-arm trap (§7.1·1). Excluded deliberately, not by omission.
--
-- ⛔ NOT SWEPT: the doors above that already delegate get NO gate. Over-reach breaks
-- legitimate surface (§7.5), and a gate that cannot change an outcome cannot be
-- mutation-falsified (A33). `232` asserts list_cases_board's free denial instead.
-- =============================================================================
-- ⭐ SQLSTATE ORDER IS THE STRUCTURAL DEFENCE (A33), NOT A DETAIL.
-- The write doors already raise on AUTHORITY (42501 / HC027 / HC037). The is_active
-- gate raises `HC0F4` AFTER that check, never before. Consequence: a DEACTIVATED
-- ASSIGNEE gets HC0F4, while a deactivated NON-assignee still fails on authority.
-- So a keystone whose fixture principal is not really the assignee fails LOUDLY on
-- 42501/HC037 instead of passing on the HC0F4 it asserts — the vacuous keystone
-- becomes UNWRITABLE rather than merely discouraged. `232` asserts that ordering
-- directly, with an ACTIVE non-assignee.
-- HC0F0–HC0F3 are taken (catalog-verified); HC0F4 is this program's next free code.
--
-- READ doors do NOT raise: they return their OWN established empty shape ('[]' /
-- the zeroed overview object), exactly as each already does for a null uid. A read
-- door that throws would surface a raw error in the UI and break the pt-BR contract.
-- =============================================================================
-- ⛔ SCOPE FENCE — `is_active` ONLY, unchanged from M5:
--   · no `_case_caps` resolver (A2) · no `case_access_grants` (B1) · no A21 admin-arm
--     removal (D4·3) · the `case_access` flag is untouched.
--   · DEFECT ①'s SECOND HALF stays OPEN and pinned (230/231). M5b gates WHO may use
--     an arm; it never changes WHAT an arm confers.
-- =============================================================================
-- ⚠ HOW THE BODIES ARE PATCHED, AND WHY NOT BY HAND.
-- Each body is taken from the LIVE `pg_get_functiondef` at APPLY time and rewritten
-- — never copied from migration text, which is stale by design here. A migration
-- that re-emits a hand-copied body silently reverts every intervening patch, and
-- that has already broken a guard on this repo once, on `advance_` in BE-6·N — one
-- of the very functions this file patches.
--
-- `app._m5b_inject` REFUSES to patch unless the anchor occurs EXACTLY ONCE and the
-- door is not already gated. So if a body ever drifts, this migration FAILS LOUDLY
-- instead of silently mis-patching or no-op'ing. A silent no-op here would ship the
-- defect while every test still passed.
-- =============================================================================

create or replace function app._m5b_inject(p_fn text, p_anchor text, p_injection text)
returns void
language plpgsql
as $$
declare
  v_def text;
  v_hits int;
begin
  v_def := pg_get_functiondef(p_fn::regprocedure);

  if position('app.is_active(' in v_def) > 0 then
    raise exception 'M5b: % already carries an is_active gate — refusing to double-patch', p_fn;
  end if;

  v_hits := (length(v_def) - length(replace(v_def, p_anchor, ''))) / length(p_anchor);
  if v_hits <> 1 then
    raise exception 'M5b: anchor matched % times in % (expected exactly 1) — the body drifted; patch it by hand rather than guessing',
      v_hits, p_fn;
  end if;

  execute replace(v_def, p_anchor, p_anchor || p_injection);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 · list_my_cases — "Meus Casos". Its WHERE is the three raw arms, bare auth.uid().
--     Returns the door's own empty shape, matching its null-uid contract exactly.
-- ---------------------------------------------------------------------------
select app._m5b_inject(
  'public.list_my_cases(uuid)',
$anchor$if v_uid is null then
    return '[]'::jsonb;
  end if;$anchor$,
$inject$

  -- <- M5b defect 3: a deactivated or suspended member has no personal list.
  -- Same empty shape as the null-uid branch above — a read door must not throw.
  if not app.is_active(v_uid) then
    return '[]'::jsonb;
  end if;$inject$
);

-- ---------------------------------------------------------------------------
-- 2 · list_my_action_items — no predicate at all; `ai.assigned_to = v_uid`.
-- ---------------------------------------------------------------------------
select app._m5b_inject(
  'public.list_my_action_items(uuid)',
$anchor$if v_uid is null then
    return '[]'::jsonb;
  end if;$anchor$,
$inject$

  -- <- M5b defect 3: a deactivated or suspended member has no personal list.
  if not app.is_active(v_uid) then
    return '[]'::jsonb;
  end if;$inject$
);

-- ---------------------------------------------------------------------------
-- 3 · get_member_overview — the badge counts. Same raw arms; reuses the door's own
--     zeroed object so the shape is identical for every caller.
-- ---------------------------------------------------------------------------
select app._m5b_inject(
  'public.get_member_overview(uuid)',
$anchor$'in_progress_responses', 0
    );
  end if;$anchor$,
$inject$

  -- <- M5b defect 3: a deactivated or suspended member counts nothing.
  -- Identical zeroed shape to the null-uid branch above.
  if not app.is_active(v_uid) then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;$inject$
);

-- ---------------------------------------------------------------------------
-- 4 · conclude_narrative — `v_assigned = auth.uid()` ORed beside gated coordinator
--     arms. Gate lands AFTER the 42501 authority raise (A33 ordering).
-- ---------------------------------------------------------------------------
select app._m5b_inject(
  'public.conclude_narrative(uuid)',
$anchor$raise exception 'sem permissão' using errcode = '42501';
  end if;$anchor$,
$inject$

  -- <- M5b defect 3. AFTER the authority check, never before: a deactivated
  -- NON-assignee must still fail on 42501, so a wrong-arm fixture cannot pass
  -- this gate's keystone by accident (A33).
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;$inject$
);

-- ---------------------------------------------------------------------------
-- 5 · advance_committee_action_item — `v_assigned_to = v_uid` on BOTH branches
--     (case → HC027, meeting/manual → HC037). The gate goes after the whole
--     if/else, so it covers both without touching either branch's authority.
-- ---------------------------------------------------------------------------
select app._m5b_inject(
  'public.advance_committee_action_item(uuid,uuid,text)',
$anchor$raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
    end if;
  end if;$anchor$,
$inject$

  -- <- M5b defect 3. After BOTH authority branches (HC027 / HC037), so a
  -- deactivated non-assignee still fails on authority first (A33 ordering).
  if not app.is_active(v_uid) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;$inject$
);

drop function app._m5b_inject(text, text, text);

-- =============================================================================
-- ⛔ THE CORRECTION TO M5's RECORD (ADR 0078; migration 20260726000000).
--
-- M5's header says "THE SET WAS CLOSED, NOT ENUMERATED (§7.5)" and lists 17
-- functions. That claim is WITHDRAWN. It closed over `app.*` only, and therefore
-- over PREDICATES only, while the `public.*` DEFINER RPCs — which bypass RLS by
-- construction — carried five more instances of the same defect.
--
-- The accurate statement, and the one a future reader should hold: the closed set
-- is {functions that reach a raw arm WITHOUT passing a gated predicate}, over
-- `app` AND `public`, and it is closable ONLY behaviourally — deactivate a raw-arm
-- holder, call the door under `set local role authenticated`, require zero rows or
-- a raise, and pair it with an ACTIVE control on the same door. Two independent
-- TEXT sweeps got `list_my_cases` wrong in the SAME direction. Text finds
-- candidates. It does not return verdicts.
-- =============================================================================
comment on function app.is_active(uuid) is
  'Account-state gate: profiles.is_active AND no live suspension; fail-closed on an '
  'absent profile. Called INLINE by the case predicates (M5) and by the personal-list '
  'and assignee-write doors (M5b). ⚠ Adding a new arm that reads case_access, '
  '*.assigned_to or action_item_assignments REQUIRES calling this alongside it: those '
  'raw arms reach no role wrapper, so they inherit no gate. Verify any such claim '
  'BEHAVIOURALLY (set local role + row count), never by a prosrc text sweep — two '
  'independent text sweeps misread list_my_cases as gated because a role helper '
  'appears in its display chip rather than its filter.';
