-- AE4.7c STEP 1 of 2 — THE FAMILY SPLIT. Rows 31 and 32 get their own gates.
-- Spec: docs/design/authz-ae43-staff-admin-permission-matrix.md §§ 12.3 / 12.8.5 · ADR 0155 D7.
--
-- door-sweep-targets: app.is_org_commission_staff_admin(uuid, uuid), app.can_manage_external_participant(uuid, uuid), app.can_manage_case_vocabulary(uuid, uuid), public.create_external_participant(uuid, text, text), public.create_ethics_allegation_category(uuid, text, text), public.archive_ethics_allegation_category(uuid), public.create_ethics_sanction_type(uuid, text, text), public.archive_ethics_sanction_type(uuid), public.create_case_assignment_role(uuid, text, text), public.archive_case_assignment_role(uuid)
--
-- ============================================================================
-- ⛔⛔ THE ORDER IS THE SAFETY PROPERTY, AND THIS MIGRATION IS WHY IT IS TWO FILES.
--
-- `app.can_manage_professional` gates THIRTEEN unrelated doors. Step 2 removes its
-- `staff_admin` arm. If that happened while this gate still fronted external-participant
-- minting (matrix row 31) and the case / ethics vocabularies (row 32), `staff_admin` would
-- lose those too — and it **KEEPS** both. The revoke would read as a targeted tightening and
-- land as a three-capability outage.
--
-- So: FAMILY split (here) -> OPERATION split + grant change (007230). Matrix § 12.8.5 states
-- the order; this file is the half that must land first.
--
-- ⭐ EVERY CHANGE HERE IS ANSWER-PRESERVING, AT EVERY INTERMEDIATE STATE. The two new gates
-- are defined as `can_manage_professional OR <the ascent>` while `can_manage_professional`
-- STILL CONTAINS the ascent — so today they are `X or X-part` = X, exactly the current answer;
-- and after 007230 narrows the first disjunct they are still exactly today's answer, because
-- the term it loses is the one they re-state. That is the property that lets AE4.5's
-- `is(legacy, catalog)` half stay green ACROSS both steps (matrix § 12.8.4).
--
-- ============================================================================
-- ⭐ ONE ASCENT SITE, NOT THREE — the AE4.7b lesson applied one layer up.
--
-- Three gates need the same clause: "is `p_uid` a staff_admin of ANY commission in `p_org`?"
-- Hand-copying it three times is exactly the shape AE4.7b spent an increment collapsing
-- (four phrasings of the hat conjunct, and pgTAP 405 § 4.4 could only COUNT the copies).
-- `app.is_org_commission_staff_admin` is that clause, once. ⛔ It is also what makes the
-- "one differential representative answers for rows 31, 32 and 43" claim CHECKABLE rather
-- than a coincidence of three bodies that happen to agree today — pgTAP 401 asserts the three
-- gate bodies are identical after 007230.
--
-- ⚠ THE ASCENT IS THE OVER-GRANT ITSELF, ISOLATED. It ascends from ANY commission in the org,
-- so one commission's `staff_admin` acts org-wide. Naming it does not narrow it — matrix
-- § 12.8.2 — and for rows 31/32 that reach is APPROVED (`none` sensitivity, and § 12.7 keeps
-- the org-scope anomaly on the record). What 007230 removes is its reach over Class-2
-- professional identity's MODIFY doors, and nothing else.
-- ============================================================================

create function app.is_org_commission_staff_admin(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select p_uid is not null and exists (
    select 1
      from public.commissions c
     where c.organization_id = p_org
       and app.is_active(p_uid)
       and app.is_staff_admin_of_for(c.id, p_uid)
  );
$f$;

comment on function app.is_org_commission_staff_admin(uuid, uuid) is
  'THE ASCENT, isolated: is p_uid a staff_admin of ANY commission in p_org? Lifted verbatim '
  'out of app.can_manage_professional (AE4.7c step 1) so the three gates that need it share '
  'ONE site. ⚠ is_active(p_uid) is carried here, not inherited — BUG-PROF-INACTIVE-001 '
  '(20261003007190) added it to this exact clause and pgTAP 404 pins both polarities. '
  '⛔ This function does not NARROW the org-wide reach it names; matrix § 12.8.2.';

-- ============================================================================
-- ROW 31 — `org.participants.external.manage`. `staff_admin` KEEPS this.
--
-- ⚠ Row 31 is `non_sensitive` by CONSTRUCTION, not by convention: `create_external_participant`
-- hardcodes `sensitivity_class = 'non_sensitive'`, and `participants_sensitivity_derives_type`
-- rejects a `professional`-typed row carrying it (matrix § 12.2, probed in a rolled-back txn).
-- So this gate cannot become a back door into row 30's sensitivity class.
-- ============================================================================

create function app.can_manage_external_participant(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
$f$;

comment on function app.can_manage_external_participant(uuid, uuid) is
  'Gate for matrix row 31 (org.participants.external.manage) — the NON-SENSITIVE participant '
  'registry. Split off app.can_manage_professional by AE4.7c step 1 so that step 2''s revoke '
  'cannot strip staff_admin from a capability it keeps. ⭐ Answer-preserving by construction: '
  'the second disjunct re-states the exact term the first one loses in 007230.';

-- ============================================================================
-- ROW 32 — `org.case_vocabulary.manage`. `staff_admin` KEEPS this.
--
-- ⚠ ONE code for all three vocabularies, and the name is NOT `org.ethics.vocabulary.manage`:
-- `case_assignment_roles` is general case machinery (consumed by
-- `set_case_narrative_assignment_role` / `set_case_phase_assignment_role`), not ethics.
-- All three tables are structurally identical — same columns, same gate, same org scope,
-- same `none` sensitivity — so nothing forces a split between them, and splitting anyway
-- would be generality bought before its first use (matrix § 12.4).
-- ============================================================================

create function app.can_manage_case_vocabulary(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
$f$;

comment on function app.can_manage_case_vocabulary(uuid, uuid) is
  'Gate for matrix row 32 (org.case_vocabulary.manage) — ethics allegation categories, ethics '
  'sanction types, and case assignment roles. ⚠ Deliberately NOT ethics-named: '
  'case_assignment_roles is general case machinery (matrix § 12.4). Split off '
  'app.can_manage_professional by AE4.7c step 1; answer-preserving by construction.';

-- ============================================================================
-- RE-POINT THE SEVEN DOORS. House pattern: `pg_get_functiondef` + `replace` + `execute`, so
-- the bodies are rewritten from the LIVE CATALOG rather than re-typed (migration text is
-- stale by design — CLAUDE.md's binding SQL exception).
--
-- ⛔ THE EXACTLY-ONCE GUARD IS RESTORED HERE (QA F9: 007180/007190/007200 dropped it and
-- asserted only `position() > 0`, while `replace()` is GLOBAL). Each rewrite counts its hits
-- and demands exactly 1 — a body that gained a second call site would otherwise be rewritten
-- twice silently, and a body that gained NONE would be reported as rewritten.
--
-- ⚠ THE MARKER ABOVE IS LOAD-BEARING (ADR 0173): this migration contains no
-- `create function public.…` line for the seven doors, so the door-sweep deriver can only see
-- them through `-- door-sweep-targets:`.
-- ============================================================================

do $repoint$
declare
  v_target text;
  v_src    text;
  v_new    text;
  v_hits   int;
  v_from   constant text := 'app.can_manage_professional(';
  -- (door signature, replacement gate)
  v_doors  constant text[][] := array[
    ['public.create_external_participant(uuid, text, text)',        'app.can_manage_external_participant('],
    ['public.create_ethics_allegation_category(uuid, text, text)',  'app.can_manage_case_vocabulary('],
    ['public.archive_ethics_allegation_category(uuid)',             'app.can_manage_case_vocabulary('],
    ['public.create_ethics_sanction_type(uuid, text, text)',        'app.can_manage_case_vocabulary('],
    ['public.archive_ethics_sanction_type(uuid)',                   'app.can_manage_case_vocabulary('],
    ['public.create_case_assignment_role(uuid, text, text)',        'app.can_manage_case_vocabulary('],
    ['public.archive_case_assignment_role(uuid)',                   'app.can_manage_case_vocabulary(']
  ];
  i int;
begin
  for i in 1 .. array_length(v_doors, 1) loop
    v_target := v_doors[i][1];
    v_src := pg_get_functiondef(v_target::regprocedure);

    -- EXACTLY ONCE, counted before the rewrite. `replace()` is global; `position() > 0` is
    -- the guard that cannot tell one call site from three.
    v_hits := (length(v_src) - length(replace(v_src, v_from, ''))) / length(v_from);
    if v_hits <> 1 then
      raise exception 'AE4.7c step 1: % contains % call(s) to app.can_manage_professional, expected exactly 1.',
        v_target, v_hits using errcode = 'check_violation';
    end if;

    v_new := replace(v_src, v_from, v_doors[i][2]);
    if v_new = v_src then
      raise exception 'AE4.7c step 1: the rewrite of % was a NO-OP.', v_target
        using errcode = 'check_violation';
    end if;
    execute v_new;

    -- ⛔ ASSERT THE EDIT LANDED, from the catalog, not from the fact that `execute` returned.
    v_src := pg_get_functiondef(v_target::regprocedure);
    if position(v_from in v_src) <> 0 then
      raise exception 'AE4.7c step 1: % STILL calls app.can_manage_professional after the rewrite.',
        v_target using errcode = 'check_violation';
    end if;
    if position(v_doors[i][2] in v_src) = 0 then
      raise exception 'AE4.7c step 1: the new gate is ABSENT from % after the rewrite.', v_target
        using errcode = 'check_violation';
    end if;
  end loop;
end $repoint$;

-- ============================================================================
-- POST-CONDITION: the door population, RE-DERIVED. pgTAP 320 pins this same census with an
-- explicit "do not just bump the number" instruction, so the migration derives it too — and
-- a migration that asserts a figure a test also asserts is not duplication here: this one
-- fails at APPLY time, before any suite runs, which is where a mis-scoped `replace()` is
-- cheapest to catch.
--
-- 12 public RPCs before; 7 move; 5 remain (create/ensure/set_link_state/update/redact).
-- ⚠ `app.can_read_professional_profile` is in `app`, not `public`, and is NOT in this count —
-- the same bound pgTAP 320's assertion carries.
-- ============================================================================

do $census$
declare
  v_public int;
  v_ext    int;
  v_vocab  int;
begin
  select count(*) into v_public
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%can_manage_professional%';

  select count(*) into v_ext
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%can_manage_external_participant%';

  select count(*) into v_vocab
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%can_manage_case_vocabulary%';

  if v_public <> 5 or v_ext <> 1 or v_vocab <> 6 then
    raise exception 'AE4.7c step 1: expected 5 professional + 1 external + 6 vocabulary public doors, got %/%/%.',
      v_public, v_ext, v_vocab using errcode = 'check_violation';
  end if;
end $census$;

-- ============================================================================
-- ⛔ THE COMMENT IS AN ASSERTION, AND THE REWRITE ABOVE JUST FALSIFIED ONE.
--
-- `create_external_participant` carried, in its body: *"The SAME capability as the
-- professional lane. The predicate names the population … not the professional class, so
-- reusing it here is not a widening."* After the split that is exactly backwards — the door
-- no longer reuses the professional gate, and the sentence explaining WHY reuse was safe now
-- reads as a description of a call that is not there.
--
-- A stale comment in a body a later migration rewrites is worse than a stale comment in a
-- file: `pg_get_functiondef` is what the next reader is told to trust (CLAUDE.md's SQL
-- exception), so this text IS the catalog. Replaced with the same exactly-once discipline as
-- the call itself.
-- ============================================================================

do $comment$
declare
  v_src  text;
  v_hits int;
  v_old  constant text :=
    '  -- The SAME capability as the professional lane. The predicate names the' || chr(10) ||
    '  -- population (org admins + staff_admins of the org''s commissions), not the' || chr(10) ||
    '  -- professional class, so reusing it here is not a widening.';
  v_new  constant text :=
    '  -- ROW 31''s OWN GATE since AE4.7c step 1. This door used to share' || chr(10) ||
    '  -- app.can_manage_professional with the professional lane, on the argument that the' || chr(10) ||
    '  -- predicate named a POPULATION rather than the professional class. That argument was' || chr(10) ||
    '  -- sound and is now moot: step 2 removes staff_admin from the professional gate, and' || chr(10) ||
    '  -- staff_admin KEEPS external-participant minting, so the two capabilities can no' || chr(10) ||
    '  -- longer share one predicate. ⚠ Rows written here are non_sensitive BY CONSTRUCTION' || chr(10) ||
    '  -- (participants_sensitivity_derives_type), so this gate cannot reach row 30''s class.';
begin
  v_src := pg_get_functiondef('public.create_external_participant(uuid, text, text)'::regprocedure);
  v_hits := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_hits <> 1 then
    raise exception 'AE4.7c step 1: the stale comment block appears % time(s) in create_external_participant, expected exactly 1.',
      v_hits using errcode = 'check_violation';
  end if;
  execute replace(v_src, v_old, v_new);
  v_src := pg_get_functiondef('public.create_external_participant(uuid, text, text)'::regprocedure);
  if position(v_old in v_src) <> 0 or position('ROW 31''s OWN GATE' in v_src) = 0 then
    raise exception 'AE4.7c step 1: the comment rewrite did not land.' using errcode = 'check_violation';
  end if;
end $comment$;
