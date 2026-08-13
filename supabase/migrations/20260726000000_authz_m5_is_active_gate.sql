-- =============================================================================
-- AUTHZ · M5 — defect ③: the OUTER GATE. A deactivated or suspended user must
-- not read or write case content, patient identifiers, or action items through a
-- surviving raw arm. ADR 0078 Context·3 / D3 / A24·5.
--
-- `app.is_active(uuid)` has always resolved the whole rule —
--     profiles.is_active AND (suspended_until is null or now() >= suspended_until)
-- fail-closed on an absent profile — and was NEVER called inline by any case
-- predicate. It was reached ONLY transitively, through the role wrappers
-- (is_staff_admin_of_for / is_commission_admin_of_for / is_member_of_for carry it
-- inline; is_pqs_operator_of_for reaches it through BOTH its legs —
-- is_nsp_coordinator_of_for and is_pqs_member_of_for).
--
-- So every arm that resolves through a ROLE was gated, and every RAW TABLE ARM was
-- NOT: a case_access grant, a phase assignment, a narrative assignment, an
-- action-item assignment, and the referral target-analyst arm. A deactivated user
-- holding any of them kept his reach in full — INCLUDING PATIENT IDENTIFIERS
-- (Rule 12) through the grant arm and the referral-PHI door.
--
-- PROVEN BEFORE THE FIX (231, authored RED against this catalog — 18 assertions
-- failed, every PRE-flight/TWIN/RESTORE passed, so the fixture was real and the
-- reach was real):
--   deactivated phase assignee    → can_read_case            = true
--   deactivated narrative assignee→ can_read_case            = true
--   deactivated grantee           → can_read_case            = true
--   deactivated grantee           → can_read_case_patient    = true  ← Rule 12
--   deactivated grantee           → get_case_patient() returns the MRN ← Rule 12
--   deactivated write-grantee     → can_write_case_content   = true
--   deactivated action assignee   → can_read_action_item     = true
--   …and every one of the above ALSO held with a live SUSPENSION.
--
-- ⚠⚠ THIS IS A NARROWING, NOT A DENIAL (§7.7). It removes reach people HAVE
-- TODAY. A narrowing that denies everyone passes its negative BY CONSTRUCTION, so
-- every gate below is paired in 231 with an ACTIVE positive twin and a RESTORE,
-- and the whole (case × user) population is shadow-diffed: GAINED must be 0 and
-- every LOST principal must be an inactive/suspended one on a raw arm.
--
-- =============================================================================
-- ⛔ SCOPE FENCE — `is_active` ONLY. This file adds a GATE. It does not remove
-- arms, split predicates, repoint policies, or invent capabilities:
--   · the `_case_caps` resolver is A2 — NOT here.
--   · `case_access_grants.read_standard_phi` is Stage B (B1) — NOT here.
--   · A21's admin-arm removal needs the resolver first (D4·3) — NOT here.
--   · the `case_access` flag is not touched.
--   · ⛔ DEFECT ①'s SECOND HALF (the case_access grant arm has no PHI filter, so a
--     read-only grant still opens patient identifiers) is DELIBERATELY LEFT OPEN.
--     `case_access.level` is write authority and A16 puts write and PHI on DISJOINT
--     chains; the real capability arrives at B1. 230 PINS today's behaviour and 231
--     re-pins it (an ACTIVE read-grantee still reads the MRN). Closing it here would
--     break that pin and hide B1's change. Adding the gate and removing the arm are
--     ORTHOGONAL — M1 proved that twice (C6).
--
-- ⛔ NOT SWEPT, deliberately (§7.5 — check INVOKER before sweeping; over-reach
-- breaks legitimate surface): close_case / cancel_case / set_case_outcome /
-- update_case_narrative_body are `prosecdef = f`, so RLS already protects them.
-- A32. Verified in the live catalog, not assumed.
-- =============================================================================
-- ⛔⛔ RETRACTED — READ THIS BEFORE THE PARAGRAPH BELOW. The claim "THE SET WAS
-- CLOSED" is FALSE and is WITHDRAWN. It closed over the `app.*` schema, i.e. over
-- PREDICATES only. The `public.*` DEFINER RPCs were excluded, and `prosecdef = t`
-- means RLS DOES NOT APPLY TO THEM — so five more instances of defect ③ shipped
-- through this file's own scope: list_my_cases · list_my_action_items ·
-- get_member_overview · conclude_narrative · advance_committee_action_item. They
-- are closed by 20260727000000 (M5b), whose header carries the accurate population
-- and the method that finds it.
--
-- The paragraph below is left standing, uncorrected, ON PURPOSE — as the specimen.
-- It is a textbook §7.5 floor that reads exactly like a closure: it names a rule,
-- counts a population, triages every member, and is WRONG, because the rule was
-- applied to one schema. And it is A28 again (a DEFINER's gate replaces RLS ⇒ a
-- predicate-shaped audit is structurally blind), the fourth time on this program.
-- The lesson is not "count better" — it is that a closure claim over authorization
-- is only worth what its BEHAVIOURAL proof is worth. Two independent TEXT sweeps
-- then misread list_my_cases as gated, in the same direction, because a role helper
-- appears in its display chip. Only `set local role authenticated` caught it.
--
-- ⛔ THE SET WAS CLOSED, NOT ENUMERATED (§7.5). Counting call sites never
-- converged on this program (five rounds, five floors). The closable set here is
-- {functions whose body touches a RAW ARM TABLE} — case_access, *.assigned_to,
-- action_item_assignments — because any other function either carries no arm or
-- reaches one only through a helper, which is fixed for free. The live catalog
-- (comments stripped — an unstripped `prosrc` regex counts `--` comments, §7.2·2)
-- returns 17 such functions. They triage as:
--
--   GATED HERE (7): can_read_case · can_read_case_patient · can_write_case_content
--     · can_read_action_item · can_write_case_narrative · can_write_attachment
--     · referral_target_analyst
--
--   FIXED FOR FREE — every arm delegates to a predicate gated above; a gate here
--   would be a provable no-op, unfalsifiable under A33's one-function-at-a-time
--   mutation rule, and a wasted per-row profiles lookup (A5 is a hard per-row-cost
--   criterion). 231 asserts each behaviourally instead:
--     · can_read_case_or_admin            → can_read_case ∨ is_commission_admin_of_for
--     · can_reach_case_on_member_surface  → is_member_of_for ∨ can_read_case_or_admin
--     · can_read_attachment               → can_read_case / can_read_action_item / role wrappers
--     · can_write_action_item_stake       → returns false unless can_read_action_item first
--     · attachment_confidentiality_ok / confidentiality_clearance_ok → CONJUNCTS, not
--       arms: they return TRUE for every non-gated label, so they cannot grant reach
--       on their own; the read predicate they are AND-ed with carries the gate.
--
--   NOT AUTHORIZATION AT ALL — no gate, correctly:
--     · guard_case_phase_status  — a status-transition guard; it compares assigned_to
--       between OLD/NEW, it does not decide who may read.
--     · trg_audit_case_phases / trg_audit_case_narratives / trg_audit_action_items /
--       trg_audit_case_access — audit emitters.
--     · _grant_case_access_unchecked / assert_case_access_enabled — writer/flag helpers
--       (`prosecdef = f`).
--
-- ⭐ TWO OF THE SEVEN WERE NOT IN THE BRIEF. Reported to the lead with evidence:
--   · can_write_case_narrative — arm 2 is a raw `v_assigned_to = p_uid`. M1's OWN
--     migration flagged it: "the MISSING is_active is NOT a durability defect and is
--     left for the Stage-A/G sweep rather than smuggled in. Flagged, not silently
--     fixed." THIS IS THAT SWEEP. Its body_md is PHI-bearing free text by its own
--     column comment, so a deactivated assignee was WRITING PHI.
--   · referral_target_analyst — all THREE of its arms are raw (phase asg, narrative
--     asg, grant) and it carries no role wrapper at all. Its only caller is
--     can_read_referral_phi, whose other arms ARE gated — so this arm was the sole
--     ungated path to REFERRAL PHI (Rule 12). The brief's own defect statement names
--     "referral analyst"; only its function list omitted it. The B3 referral work M1
--     deferred is the can_read_referral{,_phi} SPLIT — a different axis. Gating and
--     splitting are orthogonal.
-- =============================================================================
-- ⚠ EVERY BODY BELOW WAS REGENERATED FROM THE LIVE `pg_get_functiondef`, NOT from
-- migration text. Migration text is stale by design here (bodies get rewritten at
-- runtime), and a create-or-replace built from stale text silently reverts every
-- intervening patch — that has already broken a guard on this repo once. The ONLY
-- delta in each body is the gate.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1 · can_read_case — three raw arms: the grant, the phase assignment, the
--     narrative assignment. All three keep their arms (D10: assignment IS content
--     reach); all three now require an active principal.
--     Note the flag-OFF branch is member/coordinator-only and was ALREADY gated;
--     the gate is hoisted above both branches so the invariant holds either way.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_case(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  -- ⬅ M5 defect ③ THE OUTER GATE, above every arm and before the case lookup.
  -- A deactivated or suspended principal reaches nothing, whatever he still holds.
  -- Null uid resolves false here exactly as it did below — no behaviour change.
  if not app.is_active(p_uid) then
    return false;
  end if;

  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY (evaluated FIRST, before every grant): a respondent or a recused
  -- user is denied even if some positive arm (staff_admin / grant / QPS) would grant.
  -- This is the m2 keystone — exclusion cannot be out-voted.
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — per-HOSPITAL (unchanged).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    -- ⟵E1 belt: an explicit_grants_only case must not leak to every member even with
    -- case_access OFF; coordinators keep read, plain members are dropped.
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or app.is_commission_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_commission_admin_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_commission_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · can_read_case_patient — ⭐ RULE 12. The grant arm was the ungated path to
--     patient identifiers: a deactivated grantee read the MRN through the audited
--     door (proven, 231). The PQS referral arm above it resolves is_active through
--     both of is_pqs_operator_of_for's legs, so it was already gated — but the gate
--     is hoisted above it anyway so no future arm can be added below an ungated top.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  -- ⬅ M5 defect ③ THE OUTER GATE — Rule 12. A deactivated or suspended principal
  -- reaches NO patient identifier, whatever grant he still holds.
  if not app.is_active(p_uid) then
    return false;
  end if;

  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY (respondent must not reach the PHI door either; recused likewise).
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — per-HOSPITAL.
  --
  -- ⛔⛔ THIS ARM IS **LIVE**, AND IT CONFERS PHI. `case_referrals` is **ENABLED**
  -- (`app.feature_enabled('case_referrals') = t`; baseline force-sets it `true` in
  -- every environment via `on conflict … do update set enabled = excluded.enabled`).
  -- Its `description` says "Ships OFF" — **the description is stale prose; only the
  -- `enabled` column is the flag.** I previously reported this arm as INERT on the
  -- strength of that prose. That was WRONG.
  --
  -- Consequence, stated plainly so this comment does not suppress it: PQS/NSP
  -- operators read **patient identifiers** on every referral-touched case through
  -- this arm ALONE, while ADR 0078's source table says `nsp_referral_touched`
  -- confers **content only**. Its removal is **D8/N1, scheduled for Gate 2** — a
  -- KNOWN, SCHEDULED removal, not a new defect, and **A24·1 is right about its
  -- urgency**. It is untouched by M5, which gates arms rather than removing them.
  --
  -- ⚠ And it is REQUIRED as an A2 resolver source: without it, Stage A silently
  -- revokes LIVE NSP content reach.
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    -- ⟵E1 belt: explicit_grants_only PHI door → coordinators only, no member-wide read.
    -- ⚠ UNTOUCHED BY M3/M5. This branch has NO assignment arm to remove; its member arm
    -- is A15/A2's business (230 asserts M3 left it alone).
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- ⚠ `level` is deliberately NOT filtered — see the header. The shape cannot
    -- express "this grant confers PHI" until case_access_grants.read_standard_phi
    -- (B1). Pinned by 230 and re-pinned by 231: an ACTIVE read-grantee still reads
    -- the MRN. M5 gates WHO may use this arm; it does not change WHAT it confers.
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    );
    -- ⬅ ADR 0078 defect ① / M3: the two BARE-ASSIGNMENT arms are DELETED here.
    -- Assignment is CONTENT reach, never PHI (Context·1 / D10). `can_read_case`
    -- KEEPS both arms — 230's scope fence asserts it.
    --
    -- ⚠ THIS COMMENT DELIBERATELY DOES NOT NAME THE DELETED TABLES — not once, in
    -- any form. 230 asserts their ABSENCE from this body via a catalog regex, so any
    -- mention here (even quoting the regex itself) re-creates the string and the
    -- removal documents itself back into existence. I hit this twice in a row: first
    -- by quoting the deleted arms, then INSIDE THE COMMENT WARNING ABOUT IT. Same
    -- trap as M2's admin-arm comment, and the same one that made the A30 census read
    -- 42 instead of 40. `text is not truth` applies to the text you write while
    -- removing the text. Do not name them here.
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 · can_write_case_content — the write-grant raw arm.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_case_content(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  -- ⬅ M5 defect ③ THE OUTER GATE — a deactivated or suspended grantee writes nothing.
  if not app.is_active(p_uid) then
    return false;
  end if;

  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- ⟵E1 HARD DENY: a recused or respondent user cannot WRITE case content either.
  if app.is_case_respondent(p_case_id, p_uid) then
    return false;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
        and (ca.expires_at is null or ca.expires_at > now())
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4 · can_read_action_item — ⭐ A24·5, AND THE REASON THIS UNIT CANNOT WAIT FOR
--     THE RESOLVER. The `assignees_only` branch has NO case to resolve, so a
--     case-scoped resolver can NEVER reach it: `coalesce(source_case_id, case_id)`
--     is NULL on a `manual` item and the whole exclusion check is skipped. Its two
--     raw arms (assigned_to, action_item_assignments) therefore need their OWN gate,
--     permanently — this is not a stopgap the resolver later subsumes.
--     The `committee` and `case_restricted` branches were already gated (via
--     is_member_of_for and can_read_case); the gate is hoisted above all three.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
  v_anchor_case uuid;
begin
  -- ⬅ M5 defect ③ / A24·5 THE OUTER GATE. Above every branch, because the
  -- assignees_only branch has no case anchor for any future resolver to gate on.
  if not app.is_active(p_uid) then
    return false;
  end if;

  select commission_id, visibility_scope, source_case_id, case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  -- ⬅ the deny, before every arm, but ONLY where a case anchor exists.
  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null and app.is_case_excluded(v_anchor_case, p_uid) then
    return false;
  end if;

  if v_scope = 'committee' then
    return app.is_member_of_for(v_commission_id, p_uid)
        or app.is_commission_admin_of_for(v_commission_id, p_uid);

  elsif v_scope = 'case_restricted' then
    return app.can_read_case(v_anchor_case, p_uid);

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)
        or app.is_commission_admin_of_for(v_commission_id, p_uid)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5 · can_write_case_narrative — ⭐ NOT IN THE BRIEF; M1 DEFERRED IT TO THIS UNIT
--     BY NAME. Arm 2 is a raw `v_assigned_to = p_uid`, and case_narratives.body_md
--     is PHI-bearing free text by its own column comment — so a deactivated or
--     suspended assignee was WRITING PHI. M1 added the exclusion deny here and
--     explicitly left the is_active gap for "the Stage-A/G sweep rather than
--     smuggled in". This is that sweep.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_case_narrative(p_narrative_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id     uuid;
  v_commission  uuid;
  v_assigned_to uuid;
begin
  -- ⬅ M5 defect ③ THE OUTER GATE — closes the gap M1 flagged and left here on purpose.
  if not app.is_active(p_uid) then
    return false;
  end if;

  select cn.case_id, c.commission_id, cn.assigned_to
    into v_case_id, v_commission, v_assigned_to
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative_id;

  if v_case_id is null then
    return false;
  end if;

  -- THE HARD DENY, BEFORE EVERY POSITIVE ARM (the resolver's fail-closed order,
  -- A2). This is what makes arm 1 and arm 3 agree.
  if app.is_case_excluded(v_case_id, p_uid) then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- NULL-safe assignee check: an UN-assigned narrative (v_assigned_to IS NULL)
    -- must NOT make this term NULL (which would poison the boolean OR and yield
    -- NULL instead of a clean false). `is not distinct from` would be true for
    -- (null, null) — wrong — so require non-null explicitly.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null
        and app.can_write_case_content(v_case_id, p_uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6 · can_write_attachment — the `action_item` arm carries the same two raw arms
--     as can_read_action_item and, unlike can_write_action_item_stake, does NOT
--     gate on a read check first — so it was independently ungated. The case /
--     meeting / interview arms delegate to gated predicates; the gate is hoisted
--     above the dispatcher so every arm is covered by construction.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  -- ⬅ M5 defect ③ THE OUTER GATE — the action_item arm's raw assignee terms were
  -- the ungated path; hoisting above the dispatcher covers every arm at once.
  if not app.is_active(p_uid) then
    return false;
  end if;
  -- HONOR THE EXPLICIT p_uid (backend fix, reset-OK local-only pass — same rationale as
  -- can_read_attachment's meeting/interview arms): use the _for explicit-uid variants
  -- rather than the implicit-auth.uid() single-arg predicates.
  case p_owner_type
    when 'case' then
      -- ⬅ the deny: p_owner_id IS the case_id on this arm.
      if app.is_case_excluded(p_owner_id, p_uid) then
        return false;
      end if;
      v_commission := app.commission_of_case(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      v_commission := app.commission_of_meeting(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      -- Q5b: staff_admin / org-admin OR the assignee (assigned_to OR active assignment).
      -- Case-scoped ONLY when the item is anchored to a case; the deny is applied
      -- there and nowhere else (D5's scoping rule — a committee item is not a case).
      if app.is_case_excluded(app.case_of_action_item(p_owner_id), p_uid) then
        return false;
      end if;
      v_commission := app.commission_of_action_item(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or app.is_commission_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = p_owner_id and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = p_owner_id and a.user_id = p_uid and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(p_owner_id, p_uid);   -- carries the deny ⇒ free
    else
      return false;                                  -- form_upload / unknown: reserved-inert
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7 · referral_target_analyst — ⭐ NOT IN THE BRIEF'S FUNCTION LIST, but named in
--     its defect statement ("referral analyst"). RULE 12: all THREE arms are raw
--     (phase assignment, narrative assignment, grant) and it carries no role
--     wrapper at all, so it never touched is_active by any path. Its only caller is
--     can_read_referral_phi, whose OTHER arms (is_pqs_operator_of_for ×2,
--     is_staff_admin_of_for ×2) are all gated — making this the single ungated
--     route to REFERRAL PHI for a deactivated or suspended principal.
--     The B3 work M1 deferred is the can_read_referral{,_phi} SPLIT — which arms
--     exist. This is WHO may use them. Orthogonal (C6).
-- ---------------------------------------------------------------------------
create or replace function app.referral_target_analyst(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- ⬅ M5 defect ③ THE OUTER GATE — Rule 12. Conjoined at the top so a deactivated
  -- or suspended target-case assignee/grantee is no longer "the analyst".
  select app.is_active(p_uid) and exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and r.target_case_id is not null
      and (
        exists (select 1 from public.case_phases cp
                where cp.case_id = r.target_case_id and cp.assigned_to = p_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = r.target_case_id and cn.assigned_to = p_uid)
        or exists (select 1 from public.case_access ca
                   where ca.case_id = r.target_case_id and ca.user_id = p_uid
                     and (ca.expires_at is null or ca.expires_at > now()))
      )
  );
$$;
