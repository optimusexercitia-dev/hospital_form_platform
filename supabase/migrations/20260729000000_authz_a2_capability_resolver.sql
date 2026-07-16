-- =============================================================================
-- AUTHZ · A2 — THE CAPABILITY RESOLVER. ADR 0078 D1/D2/D11, A15/A16, A24, A36.
--
-- ⛔ THIS UNIT IS A **MECHANISM SWAP**, NOT A SEMANTIC CHANGE.
-- It must be provably `LOST = 0, GAINED = 0` over the full population. Any lost cell
-- means A2 smuggled a narrowing; any gained cell means it smuggled a widening. The
-- proof is a 392-cell A/B reach matrix (7 cases x 28 users x **2 flag states**),
-- measured on the live catalog before and after, NOT inferred from this text.
--
-- ⭐ WHY 392 AND NOT 196. `case_access.enabled = t`, so the flag-OFF branches of
-- can_read_case / can_read_case_patient are DEAD CODE at runtime. A matrix run only at
-- the live flag state CANNOT OBSERVE them, and would report LOST = 0 while `228` test
-- 24 goes red. A probe that cannot observe the thing you are using it to rule out
-- returns a zero indistinguishable from a real absence (handoff §7.10). Both states or
-- the proof is theatre.
--
-- WHY THIS UNIT WAS BLOCKED ONCE (A36) AND WHY IT IS UNBLOCKED NOW.
-- A2 as originally scoped packaged three narrowings as "a thin projection", leaving
-- `read_standard_phi` computed but UNCONSUMED — hence unfalsifiable — with the
-- narrowing landing silently in a later unit. M3 (defect ①) and M5/M5b (defect ③)
-- landed those narrowings as their own subtractive migrations first, and ①'s second
-- half is pinned to B1 by `230` + e2e AC-3b. So the semantics under this swap are
-- ALREADY CORRECT, and A2 changes mechanism only. That is the only shape in which it
-- is reviewable.
--
-- ---------------------------------------------------------------------------
-- ⭐ NO LATTICE CLOSURE STEP — DELIBERATE. DO NOT "FIX" THIS.
-- ---------------------------------------------------------------------------
-- The ADR states a partial order (`write_case_content => read_case_content =>
-- view_case_overview`; `read_restricted_phi => read_standard_phi`). It is tempting to
-- enforce it with a post-hoc bit-OR (`if caps & WCC then caps := caps | RCC`). THAT
-- WOULD BE A WIDENING. Measured on the live catalog: all three rungs hold with **0
-- violations at BOTH flag states** — but they hold CONTINGENTLY, not structurally.
-- `WCC => RCC` holds only because `grant_case_access` requires the grantee be a
-- commission member ('o responsável deve ser membro da comissão'). At flag-OFF on an
-- `explicit_grants_only` case a write-grantee WOULD have WCC (can_write_case_content
-- has NO flag branch) and NOT RCC (the eg branch admits only coordinator/org-admin).
-- The population has no such cell today, so closure would gain nothing measurable —
-- and would still make the resolver structurally differ from the bodies it swaps.
-- => Each source is wired to EXACTLY the bits its live arms confer. The lattice is an
--    EMERGENT property, ASSERTED by keystones in 234, never IMPOSED here.
--
-- ---------------------------------------------------------------------------
-- SIX STEPS, NOT SEVEN (A24·3). Step 6 "apply lifecycle restrictions" is DELETED:
-- terminal-freeze lives in `app.guard_case_status` (HC025) with an `app.in_case_rpc`
-- escape hatch a STABLE resolver cannot replicate, and `can_write_case_content` has no
-- status check at all. Adding one would narrow beyond today and break every case-closing
-- RPC that writes content in the same transaction. The trigger stays. Do not reinvent it.
--
-- SEVEN SOURCES, NOT A24·7's FOUR. Catalog-measured; three have no A24·7 row:
--   S1 committee_coordinator        is_staff_admin_of_for            (A24·7 ✓)
--   S2 org_admin                    is_commission_admin_of_for       (NO ROW — A36·2;
--                                     ships as a source, A4 removes it. Omitting it here
--                                     would execute A4's removal inside A2 — D4·3 forbids
--                                     it, A5 gates it.)
--   S3 manual_grant                 unexpired case_access row        (NO ROW — D11 lists
--                                     the source, A24·7 maps only the 4 resolver-computed
--                                     arms. Today's semantics are wired; the target's
--                                     per-capability grant columns are B1.)
--   S4 case_assignment              case_phases/case_narratives      (A24·7 ✓)
--   S5 committee_member_default     is_member_of_for + commission_default  (A24·7 ✓,
--                                     => read_case_deliberation ONLY, A15 verbatim)
--   S5L case_access_flag_off_legacy NOT feature_enabled('case_access')     (NO ROW)
--   S6 nsp_referral_touched         PQS operator + referral          (A24·7 ✓ for content;
--                                     its LIVE PHI half is a KNOWN, SCHEDULED removal —
--                                     D8/N1, Gate 2. Carried here; removing it would be a
--                                     Gate-2 change executed inside Gate 1.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The bit vocabulary. Seven capabilities: D1's six + read_case_deliberation (A15).
-- An unknown name RAISES — it never silently returns false. A typo'd capability that
-- resolves to "denied" is a test that cannot fail (§7.1).
-- ---------------------------------------------------------------------------
create or replace function app._cap_bit(p_cap text)
  returns int
  language sql
  immutable
as $$
  select case p_cap
    when 'view_case_overview'     then 1    -- RESERVED + UNCONSUMED (A16). Deliberate.
    when 'read_case_deliberation' then 2    -- projected by can_reach_case_on_member_surface
    when 'read_case_content'      then 4    -- projected by can_read_case
    when 'read_standard_phi'      then 8    -- projected by can_read_case_patient (Rule 12)
    when 'read_restricted_phi'    then 16   -- RESERVED + UNCONSUMED (A16, extended per A2·C7)
    when 'write_case_content'     then 32   -- projected by can_write_case_content
    when 'manage_case_access'     then 64   -- UNCONSUMED by the resolver: grant_case_access
                                            -- gates itself directly. Wired to mirror that
                                            -- door, decorative until a consumer exists.
  end;
$$;

comment on function app._cap_bit(text) is
  'ADR 0078 D1/A15. Capability name -> bit. Returns NULL for an unknown name; every '
  'caller must treat NULL as an error, never as "no capability" (a typo that resolves '
  'to denied is a test that cannot fail).';

-- ---------------------------------------------------------------------------
-- ⭐ THE RESOLVER. One semantic source for case authorization (D2).
--
-- Returns a bitmask. STABLE + SECURITY DEFINER, matching every predicate it feeds:
-- R6 (ADR 0064, honoured by 0072, not relaxed here) — every participant / recusal /
-- grant term is computed INSIDE the DEFINER over BASE TABLES. An RLS-gated read here
-- would recurse through the very policies this function exists to answer.
--
-- PERF (A5 is a hard exit criterion, and this design owes it): the bitmask core exists
-- so per-row cost stays at today's `can_read_case` level. Every arm below is a term
-- `can_read_case` already evaluates; nothing is added. `has_case_capability` is a bit
-- test on an int — no jsonb allocation per row. A5 proves it with EXPLAIN (ANALYZE,
-- BUFFERS); this comment does not.
-- ---------------------------------------------------------------------------
create or replace function app._case_caps(p_case_id uuid, p_uid uuid)
  returns int
  language plpgsql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_caps       int  := 0;
  v_commission uuid;
  v_policy     text;
  v_access_on  boolean;
  v_eg         boolean;
  v_coord      boolean;
  v_orgadmin   boolean;
  v_member     boolean;
  v_grant      boolean;
  v_grant_w    boolean;
begin
  -- STEP 1 — null user => 0.
  if p_uid is null then
    return 0;
  end if;

  -- STEP 2 — D3's OUTER GATE. A deactivated or suspended principal reaches nothing,
  -- whatever he still holds. Above every branch and before the case lookup, exactly as
  -- M5 placed it in each body.
  --
  -- ⚠ FAITHFULNESS NOTE (this gate is a NO-OP here, and that is verified, not assumed):
  -- `can_reach_case_on_member_surface` has NO is_active gate today — M5 deliberately
  -- skipped it as "pure delegation", and two of the brief's six were left ungated on
  -- that reasoning. If that reasoning were wrong, projecting read_case_deliberation
  -- through this gate would be a NARROWING and would break LOST = 0. Checked against
  -- the live catalog: `is_member_of_for`, `is_staff_admin_of_for` and
  -- `is_commission_admin_of_for` each carry `app.is_active(p_user_id) and ...`
  -- INTERNALLY, and the surface's only other arm delegates to `can_read_case_or_admin`
  -- -> `can_read_case`, which M5 gated. So every arm is already gated. M5's claim holds.
  if not app.is_active(p_uid) then
    return 0;
  end if;

  -- STEP 3 — tenant anchors. Unknown case => fail closed.
  select commission_id, visibility_policy
    into v_commission, v_policy
  from public.cases where id = p_case_id;
  if v_commission is null then
    return 0;
  end if;

  -- STEP 4 — ⛔ HARD DENY, BEFORE EVERY POSITIVE ARM (ADR 0072 D2, verbatim).
  -- A respondent or a recused user is denied even where a positive arm would grant.
  -- No positive arm, at any layer, can out-vote this. Written as the two primitives
  -- rather than `is_case_excluded` to mirror the bodies being swapped byte-for-byte;
  -- `is_case_excluded` is exactly `respondent OR recused` (verified in the catalog),
  -- so the two forms are equivalent and 234 asserts the equivalence.
  --
  -- ⚠ An exclusion is only as strong as its weakest MUTATOR (§7.6). This resolver
  -- READS the exclusion; it cannot defend the rows the exclusion resolves through.
  -- That is M1's job, and M1 shipped.
  if app.is_case_respondent(p_case_id, p_uid) then
    return 0;
  end if;
  if app.is_recused_from_case(p_case_id, p_uid) then
    return 0;
  end if;

  -- STEP 5 — union the positive sources.
  v_access_on := app.feature_enabled('case_access');
  v_eg        := (v_policy = 'explicit_grants_only');
  v_coord     := app.is_staff_admin_of_for(v_commission, p_uid);
  v_orgadmin  := app.is_commission_admin_of_for(v_commission, p_uid);
  v_member    := app.is_member_of_for(v_commission, p_uid);

  -- ── S6 · nsp_referral_touched ────────────────────────────────────────────────
  -- ⛔ LIVE, NOT INERT. `case_referrals.enabled = t` and baseline force-sets it true in
  -- every environment; the flag row's *description* says "Ships OFF" — a flag's
  -- description is prose, only the `enabled` column is the flag (§7.2 #1). Reporting
  -- this arm inert put a false claim into a permanent ADR, in the urgency-SUPPRESSING
  -- direction, and it fooled the engineer who wrote the "text is not truth" rule and
  -- then the lead enforcing it.
  --
  -- It confers CONTENT **and, today, PHI** — while A24·7's source table says content
  -- only. That divergence is a KNOWN, SCHEDULED removal (D8/N1, Gate 2), not a new
  -- defect. A2 ships TODAY's behaviour by definition of a mechanism swap: omitting the
  -- arm would silently revoke live NSP content reach, and omitting its PHI half would
  -- execute a Gate-2 narrowing inside Gate 1 with no failing test in between.
  --
  -- Mirrors both bodies' short-circuit `return true` placed ABOVE the flag branch:
  -- this arm is flag-state-independent.
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('read_case_deliberation');
  end if;

  -- ── S1 · committee_coordinator ───────────────────────────────────────────────
  -- A24·7: all EXCEPT read_restricted_phi — they DELEGATE it without holding it (D5·6).
  -- "Coordinator = full authority" hands them the restricted bit; no keystone caught
  -- that before => keystone 31 (234 K11).
  -- Unconditional across both flag states: at flag-ON both read bodies carry the
  -- is_staff_admin_of_for arm; at flag-OFF/eg both carry it; at flag-OFF/default a
  -- coordinator is reached by the is_member_of_for arm (a coordinator IS a member).
  if v_coord then
    v_caps := v_caps | app._cap_bit('view_case_overview')
                     | app._cap_bit('read_case_deliberation')
                     | app._cap_bit('read_case_content')
                     | app._cap_bit('read_standard_phi')
                     | app._cap_bit('write_case_content')
                     | app._cap_bit('manage_case_access');
  end if;

  -- ── S2 · org_admin ───────────────────────────────────────────────────────────
  -- ⚠ NO SOURCE ROW IN A24's TABLE, yet `can_read_case` carries it TODAY (A36·2).
  -- Ships as a resolver source; **A4 removes it**. Omitting it here would execute A4's
  -- removal inside A2 — D4·3 forbids it and A5 gates it.
  -- Confers content, NEVER PHI: `can_read_case_patient` has NO org-admin arm at flag-ON,
  -- and at flag-OFF its arms are is_staff_admin_of_for (eg) / is_member_of_for (default)
  -- — an org_admin need not be a member. Never write: can_write_case_content has no
  -- org-admin arm. Verified against all four bodies.
  if v_orgadmin then
    v_caps := v_caps | app._cap_bit('read_case_deliberation')
                     | app._cap_bit('read_case_content')
                     | app._cap_bit('manage_case_access');
  end if;

  -- ── S5 · committee_member_default ────────────────────────────────────────────
  -- ⭐ A15, THE ADR's CENTRAL CORRECTION: `=> read_case_content` was a 12x WIDENING
  -- sold as a no-op. The arm confers **read_case_deliberation ONLY** — the minuted
  -- discussion. The case file stays with the coordinator, the assignees, and explicit
  -- grants. NO FLAG TERM: `can_reach_case_on_member_surface` has none, which is exactly
  -- why this row is A15-clean and the flag-OFF fallback below is a SEPARATE source.
  if v_member and not v_eg then
    v_caps := v_caps | app._cap_bit('read_case_deliberation');
  end if;

  if v_access_on then
    -- ── S3 · manual_grant ──────────────────────────────────────────────────────
    -- A24·6 separates this from the resolver-computed arms: in the target it is a
    -- `case_access_grants.source` value drawing capabilities from explicit COLUMNS.
    -- Today's `case_access` has only `level`, so today's semantics are wired here.
    --
    -- ⚠ `level` is deliberately NOT filtered for the read bits. Filtering PHI on it
    -- would encode `write => read_standard_phi`, which A16 puts on DISJOINT chains.
    -- The real capability is `case_access_grants.read_standard_phi` — **defect ①'s
    -- second half, deliberately deferred to B1** and pinned by `230` + e2e AC-3b so B1
    -- lands as a VISIBLE failing assertion rather than a silent drop.
    v_grant := exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    );
    if v_grant then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_standard_phi')
                       | app._cap_bit('read_case_deliberation');
    end if;

    -- ── S4 · case_assignment ───────────────────────────────────────────────────
    -- A24·7: read_case_content + read_case_deliberation ONLY.
    -- **NEVER PHI** — Context·1's headline, this ADR's defect ①; M3 deleted both bare
    -- assignment arms from the PHI door. **NEVER WRITE** — D10, a deliberate
    -- divergence; `can_write_case_content` has no assignment arm. DO NOT "FIX" EITHER.
    if exists (select 1 from public.case_phases cp
               where cp.case_id = p_case_id and cp.assigned_to = p_uid)
       or exists (select 1 from public.case_narratives cn
                  where cn.case_id = p_case_id and cn.assigned_to = p_uid) then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_case_deliberation');
    end if;

  else
    -- ── S5L · case_access_flag_off_legacy ──────────────────────────────────────
    -- ⛔ DELETED AT STAGE B (D9). **NOT a target-state source.** It exists so that A2
    -- is a FAITHFUL swap and nothing else.
    --
    -- ⛔⛔ NAMED FOR WHAT IT IS: this arm confers **PATIENT IDENTIFIERS** (Rule 12), not
    -- merely content. Both flag-OFF branches fall through to `is_member_of_for` — the
    -- one in `can_read_case` (=> content) AND the one in `can_read_case_patient`
    -- (=> the MRN). Measured: flipping `case_access` OFF takes PHI reach from **27 to
    -- 54 of 196 cells** — it DOUBLES it. Calling this a "content fallback" would repeat
    -- the flag-description failure mode inside a source table.
    --
    -- D9 already characterized this correctly and scheduled BOTH OFF branches for
    -- deletion at Stage B; what nobody had done was TEST it. `228` test 24 pins the
    -- content half; **nothing pinned the PHI half** — 234's K12 now does, so Stage B's
    -- deletion lands as a visible RED rather than a silent drop.
    --
    -- Unreachable in any real environment (verified independently by the lead): `app` is
    -- not served by PostgREST, `app.feature_flags` has no ACL at all, no function writes
    -- it, and baseline force-sets it true. The only principal who can flip it already
    -- owns the database. That is not a threat model — which is why this is CARRIED and
    -- PINNED rather than removed in a bespoke migration ahead of A2.
    if not v_eg and v_member then
      v_caps := v_caps | app._cap_bit('read_case_content')
                       | app._cap_bit('read_standard_phi')
                       | app._cap_bit('read_case_deliberation');
    end if;
  end if;

  -- ── S3w · manual_grant (write) ───────────────────────────────────────────────
  -- ⚠ OUTSIDE the flag branch, DELIBERATELY, and this asymmetry is REAL, not a slip:
  -- `can_write_case_content` has **NO** `feature_enabled('case_access')` branch, so its
  -- write-grant arm is live at BOTH flag states. Measured: WCC = 8 reachable cells at
  -- flag-ON *and* flag-OFF, while can_read_case moves 50 -> 74. Placing this inside the
  -- `if v_access_on` arm above would LOSE 8 cells at flag-OFF.
  v_grant_w := exists (
    select 1 from public.case_access ca
    where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
      and (ca.expires_at is null or ca.expires_at > now())
  );
  if v_grant_w then
    v_caps := v_caps | app._cap_bit('write_case_content');
  end if;

  -- STEP 6 — return. (A24·3: there is no lifecycle step. `guard_case_status` owns
  -- terminal-freeze. Six steps, not seven.)
  return v_caps;
end;
$$;

comment on function app._case_caps(uuid, uuid) is
  'ADR 0078 A2 · D2 — THE capability resolver: one semantic source for case '
  'authorization. Returns a bitmask (app._cap_bit). Six steps (A24·3 deleted step 6): '
  'null uid -> 0; NOT is_active -> 0 (D3); unknown case -> 0; HARD DENY '
  '(respondent/recused) BEFORE every positive arm (ADR 0072); union the seven live '
  'sources; return. NO lattice closure — sources are wired to exactly the bits their '
  'live arms confer; the lattice is asserted in 234, never imposed here.';

-- ---------------------------------------------------------------------------
-- ⭐ THE RLS PROJECTION (D2). A bit test on an int — no jsonb allocation per row.
-- An unknown capability name RAISES rather than returning false: a typo'd capability
-- that silently resolves to "denied" would be a policy that fails open in reverse and
-- a keystone that cannot fail.
-- ---------------------------------------------------------------------------
create or replace function app.has_case_capability(p_case_id uuid, p_uid uuid, p_cap text)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bit int := app._cap_bit(p_cap);
begin
  if v_bit is null then
    raise exception 'capacidade desconhecida: %', p_cap using errcode = 'HC0A2';
  end if;
  return (app._case_caps(p_case_id, p_uid) & v_bit) <> 0;
end;
$$;

comment on function app.has_case_capability(uuid, uuid, text) is
  'ADR 0078 D2 — the RLS projection of app._case_caps. Bit test on an int. Raises '
  'HC0A2 on an unknown capability name (never returns false for a typo).';

-- ---------------------------------------------------------------------------
-- The jsonb projection — **DEBUG / INTROSPECTION ONLY, never per-row**.
-- Deliberately NOT used by any predicate: allocating a jsonb per row is exactly the
-- per-row cost the bitmask core exists to avoid (A5 is a hard exit criterion).
-- ---------------------------------------------------------------------------
create or replace function app.case_capabilities(p_case_id uuid, p_uid uuid)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_agg(cap order by cap), '[]'::jsonb)
  from unnest(array[
    'view_case_overview', 'read_case_deliberation', 'read_case_content',
    'read_standard_phi', 'read_restricted_phi', 'write_case_content',
    'manage_case_access'
  ]) as cap
  where (app._case_caps(p_case_id, p_uid) & app._cap_bit(cap)) <> 0;
$$;

comment on function app.case_capabilities(uuid, uuid) is
  'ADR 0078 A2 — human-readable projection of app._case_caps. DEBUG ONLY: never call '
  'per row (jsonb allocation); policies use app.has_case_capability.';

-- =============================================================================
-- THE FOUR BODY SWAPS. Each predicate becomes a thin projection of the resolver
-- (A24·2: `can_read_case` = projection, NOT survivor — two bodies would mean two
-- independently-maintained hard-deny orders, i.e. exactly the drift D2 exists to
-- prevent). Callers keep calling the same names; policies are untouched.
--
-- ⛔ THE OTHER EIGHT PREDICATES ARE NOT TOUCHED. `can_read_case_or_admin`,
-- `can_read_attachment` and `can_write_case_narrative` are pure delegation and become
-- projections for free. `can_read_action_item`'s `assignees_only` arms are RAW table
-- checks with NO CASE ANCHOR (A24·5) — the resolver cannot reach them, which is why
-- M5 gave that function its own is_active gate rather than relying on a case resolver.
-- =============================================================================

-- ── can_read_case := read_case_content ───────────────────────────────────────
create or replace function app.can_read_case(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- A2: thin projection of app._case_caps. Every arm this body used to carry
  -- (coordinator, org-admin, grant, phase/narrative assignment, the NSP referral arm,
  -- and the case_access flag-OFF member branch) now lives in the resolver, evaluated in
  -- the same order behind the same hard deny. `228` test 24 pins the flag-OFF member
  -- arm byte-for-byte; 234 K3 re-pins it.
  select app.has_case_capability(p_case_id, p_uid, 'read_case_content');
$$;

-- ── can_read_case_patient := read_standard_phi ───────────────────────────────
create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- A2: thin projection of app._case_caps (Rule 12).
  --
  -- ⭐ THIS PREDICATE HAS **ZERO POLICY CONSUMERS**, AND THAT IS ARCHITECTURAL, NOT
  -- INCIDENTAL. Its consumers are three SECURITY DEFINER bodies
  -- (app._audit_access_authorized, public.get_case_patients, public.get_participant_patient).
  -- The case-PHI store (`patient_identifiers`, `patient_participants`) has **no
  -- `authenticated` ACL at all**, RLS on, and **0 policies** — a policy there would be
  -- unreachable code. This is Rule 12's audited single door as built. A28: a
  -- policy-shaped audit reports this predicate as dead; it is not.
  -- => A4 repoints NOTHING here (it removes the org-admin source, which this body has
  --    never carried).
  select app.has_case_capability(p_case_id, p_uid, 'read_standard_phi');
$$;

-- ── can_write_case_content := write_case_content ─────────────────────────────
create or replace function app.can_write_case_content(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- A2: thin projection. NO ASSIGNMENT ARM (D10) — a deliberate divergence from the
  -- read side; do not "fix" it. No status/lifecycle term (A24·3) — guard_case_status
  -- owns terminal-freeze and this body never had one.
  select app.has_case_capability(p_case_id, p_uid, 'write_case_content');
$$;

-- ── can_reach_case_on_member_surface := read_case_deliberation ───────────────
create or replace function app.can_reach_case_on_member_surface(p_case_id uuid, p_uid uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  -- A2: thin projection. A15·2 — this predicate's semantics **ARE**
  -- `read_case_deliberation`, exactly; ETH·E1 built the right predicate three days
  -- before the model existed. The claim that it was redundant with `read_case_content`
  -- was FALSE and its retirement is WITHDRAWN: it is consumed by exactly one policy
  -- (`meeting_cases_select`) while read_case_content gates ~12 tables. It survives as
  -- this bit's projection.
  --
  -- ⚠ It gains D3's is_active gate through the resolver, which it did not carry
  -- directly. Verified NO-OP, not assumed: every arm it had
  -- (is_member_of_for / can_read_case_or_admin -> can_read_case + is_commission_admin_of_for)
  -- is is_active-gated internally. This is M5's "pure delegation" claim, and it holds.
  select app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation');
$$;

-- ---------------------------------------------------------------------------
-- ACLs — match the convention on every predicate these functions replace
-- (postgres=X | authenticated=X | service_role=X; PUBLIC revoked).
-- ---------------------------------------------------------------------------
revoke all on function app._cap_bit(text) from public;
revoke all on function app._case_caps(uuid, uuid) from public;
revoke all on function app.has_case_capability(uuid, uuid, text) from public;
revoke all on function app.case_capabilities(uuid, uuid) from public;

grant execute on function app._cap_bit(text) to authenticated, service_role;
grant execute on function app._case_caps(uuid, uuid) to authenticated, service_role;
grant execute on function app.has_case_capability(uuid, uuid, text) to authenticated, service_role;
grant execute on function app.case_capabilities(uuid, uuid) to authenticated, service_role;
