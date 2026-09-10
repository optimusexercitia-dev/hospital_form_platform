-- ADMIN-ARM-IS-ACTIVE (pre-AE5 remediation Batch 10). The admin arm follows the SUBJECT'S
-- ACCOUNT STATE at all three sites; the `platform_admin` Class-2 write arm is removed from the
-- professional registry and relocated to the case-vocabulary gate; and `public.assume_role`'s
-- audit row logs the ROLE ONLY, for every tier.
--
-- Builds ADR 0201 D4 (Batch 9 rulings R3 + R12) and D5 (R4), plus the R10 audit-stamp ruling.
-- ⛔ This migration takes none of those decisions again and re-opens none.
--
-- door-sweep-targets: app.is_admin(), app.is_admin_for(uuid),
--   public.assume_role(platform_role), app.can_manage_professional(uuid, uuid),
--   app.can_manage_case_vocabulary(uuid, uuid)
--
-- ============================================================================
-- THE DEFECT, measured on the LIVE CATALOG at head pair (20261003007380, 527), 2026-09-10,
-- comment-stripped with
--   regexp_replace(regexp_replace(prosrc, '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g')
-- and with a DISCRIMINATING CONTROL in the same query, so the three negatives are findings
-- rather than a dead needle:
--
--   app.is_admin()                          app.is_active( ABSENT
--   app.is_admin_for(uuid)                  app.is_active( ABSENT
--   public.assume_role(platform_role)       app.is_active( ABSENT (the bare word too)
--   app.is_org_admin_of_for(uuid,uuid)      app.is_active( PRESENT   <- the control
--
-- Blast radius, as SETS rather than counts: 26 policies + 13 functions name `app.is_admin(`;
-- 0 policies + 5 functions name `app.is_admin_for(`; 0 triggers name either; 0 readers outside
-- app/public/authz/test_helpers. Enumerated in the unit's plan and record.
--
-- ============================================================================
-- ⭐⭐ THE DECLARED TIGHTENING (PO ruling L3; ADR 0200's own R3 discipline, applied here).
-- Quoted verbatim in the unit's session-log entry and in the QA brief.
--
--   This migration TIGHTENS three gates. It is declared as a tightening and is not folded
--   into a no-regression claim. A `platform_admin` who is deactivated
--   (`profiles.is_active = false`) or suspended (`suspended_until > now()`) stops passing
--   `app.is_admin()`, `app.is_admin_for()` and the seating door `public.assume_role`.
--   ⚠ The `is_admin()` JWT-claim fast path is still there — measured at this head:
--   `app.is_admin()`'s body still reads `request.jwt.claims ->> 'is_admin'` and
--   short-circuits on it. Batch 8 (ADR 0200) removed that fast path from the
--   `can_manage_professional` CHAIN only, by substituting `app.is_admin_for` (which has no
--   claim path); it did not remove it from `is_admin()` itself. => after this migration the
--   surviving stale-token window is the admin FLAG alone: a demoted admin can still present
--   a stale `is_admin` claim, but `app.is_active(auth.uid())` always reads `public.profiles`,
--   so deactivation and suspension take effect immediately, without waiting for token expiry
--   — and `app.active_role()` being a bare claim read is why that mattered (a deactivated
--   admin could otherwise mint a fresh hat). A second declared consequence:
--   `audit_log.actor_is_admin`, stamped by `app.audit_write` from `is_admin()`, becomes
--   `false` for a deactivated admin-flagged actor.
--
-- ⭐ THE DECLARED WIDENING (PO ruling R1). Batch 9's R12 gates the seating door reasoning
-- entirely about the admin hat. This migration puts ONE `app.is_active(v_uid)` check before
-- ANY seating, for EVERY tier — placed AFTER the `session_selectable` check so a role nobody
-- may pick keeps its more specific "não selecionável" answer. That is WIDER than R12's stated
-- words and is declared, not taken silently. Measured cost: zero expected reds (no pgTAP file
-- seats a deactivated principal at this door), and it is authority-neutral for tenant tiers
-- because every tenant predicate ALREADY carries `app.is_active` (e.g. `app.is_org_admin_of_for`
-- is `app.is_active(p_uid) and app.has_role(...)`). So it removes a pointless seating and its
-- audit row, never an ability. Variant (B) — the platform branch alone — was available and was
-- REJECTED: it reproduces inside one body the exact shape R12 was taken to remove, a door that
-- READS gated. pgTAP `418 § 3.8/3.9` is the widening's own cell pair.
--
-- ⭐ ALSO DECLARED, beyond the follow-up clauses (ADR 0201 D5 item 3): `platform_admin` LOSES
-- professional CREATE (`create_professional_profile`, `ensure_professional_participant`) and
-- external-participant MINTING (`create_external_participant`). The reason is D5's SURVIVING
-- one, not the withdrawn one: `ensure_professional_participant` inserts a `public.participants`
-- row with `sensitivity_class = 'professional_identity'` and a real `display_name`, so a
-- platform arm there would let a `platform_admin` CREATE Class-2 professional-identity content
-- in any tenant's registry. ⛔ The withdrawn reason ("it seats a professional INTO A CASE") is
-- never restated.
--
-- ============================================================================
-- THE KEYING OF EVERY ARM THIS FILE PAIRS (ADR 0193 D5 / 0200 / 0201 D3). ⛔ No caller-keyed
-- arm is placed beside a `p_uid`-keyed one anywhere below.
--
--   1  app.is_admin()                  + app.is_active(auth.uid())   CALLER   siblings CALLER
--   2  app.is_admin_for(uuid)          + app.is_active(p_user_id)    SUBJECT  siblings SUBJECT
--   3  public.assume_role              + app.is_active(v_uid)        CALLER   siblings CALLER
--                                                                    (v_uid := auth.uid())
--   4  app.can_manage_professional     arm REMOVED                   -- survivor SUBJECT
--                                                                    (is_org_admin_of_for)
--   5  app.can_manage_case_vocabulary  + app.is_admin_for(p_uid)     SUBJECT  siblings SUBJECT
--
-- ⚠ `app.is_active` declares `p_user_id uuid DEFAULT auth.uid()`, so `app.is_active()` would
-- compile at site 1. The argument is written EXPLICITLY so the keying is legible in the body
-- instead of inferred from a default.
--
-- ⭐ AND THE RELOCATED ARM FOLLOWS ACCOUNT STATE FROM THE MOMENT IT LANDS, because the SAME
-- migration adds `app.is_active(p_user_id)` to `app.is_admin_for`. The relocation therefore
-- does not re-open at a new gate the hole it closes at the old one.
--
-- ============================================================================
-- R10 (ADR 0201 D2) — `public.assume_role`'s `active_role.assumed` audit row logs the ROLE
-- ONLY, no place, for EVERY tier. `app.active_role_selections` has NO scope column at all
-- (measured: `session_id, user_id, role, chosen_at`), which is D2's reason 1. A footprint
-- captured at assume-time is a SNAPSHOT that a mid-session grant invalidates, while `hat_ok`
-- compares role_code only and admits the new seating.
-- ⛔ `v_org` / `v_hospital` / `v_commission` are still SELECTED — `v_holds` is derived from
-- them — and are deliberately NOT stamped. They are NOT renamed: renaming would make the
-- landing assertion "the old scope arguments are gone" pass for the wrong reason.
--
-- ============================================================================
-- METHOD: a full `create or replace` of every body. ⛔ NEVER `pg_get_functiondef()` +
-- `replace()`. Batch 8's two reasons both apply again: (a) these are conjunct/disjunct edits
-- plus an argument-list rewrite, so `replace()` would need several independent substitutions
-- per function, doubling the surface on which a mutation that did not fully apply reports
-- green; and (b) HEADER COMMENTS MUST BE REWRITTEN — three of these bodies currently document
-- their own state-blindness, and a comment is an assertion that goes stale silently.
--
-- ⚠ ONE COMMENT ELSEWHERE GOES STALE AND IS NOT EDITED HERE, deliberately, so this migration's
-- site list stays the five it declares. `app.can_create_professional`'s body carries
--     -- PRESERVED ARM — org authority (platform_admin via is_admin(), org_admin). Both `legacy`.
-- Site 4 removes that platform reach, so the parenthetical becomes false. It is a COMMENT, not
-- an arm (the regex that finds `is_admin(` there matches inside the comment — text is not
-- truth), the body's behaviour is unaffected, and a follow-up is drafted for it rather than a
-- sixth body being rewritten inside a migration whose scope was ruled at five.
--
-- ⚠ EVERY NEEDLE BELOW IS `(`-TERMINATED, AND THAT IS LOAD-BEARING IN BOTH DIRECTIONS:
-- `app.is_admin` is a PREFIX of `app.is_admin_for`. The "arm 1 is gone" check on
-- `can_manage_professional` therefore reads `app.is_admin_for(`, never a bare substring —
-- 410 § 3.5 records having been bitten by exactly this with `is_tenancy_admin_of`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LANDING ASSERTIONS, BEFORE. Read from `pg_get_functiondef`, never assumed.
-- ---------------------------------------------------------------------------
-- ⛔⛔ EVERY NEEDLE IN BOTH LANDING BLOCKS IS MATCHED AGAINST A COMMENT-STRIPPED BODY, AND
-- THAT IS NOT HYGIENE — IT IS THE FIX FOR A MEASURED VACUITY. `pg_get_functiondef` returns
-- comments, and these bodies carry long ones that quote their own predicates. Measured
-- 2026-09-10 while proving each assertion fires on a planted body:
--   · the "`app.is_admin_for(` is ABSENT from can_manage_professional" check ABORTED the
--     migration because an explanatory comment quoted the needle (a false positive), and
--   · the "`p_uid is not null` is PRESENT in can_manage_professional" check did NOT fire when
--     the guard was planted away, because the comment `⛔ THE `p_uid is not null` GUARD IS KEPT
--     DELIBERATELY` answered for the deleted code (a false NEGATIVE — the assertion was
--     vacuous, and it is the only one of twenty plants that failed to fire).
-- A comment is prose. Only the body is the body. The strip expression below is the same one
-- the unit's measurements use, quoted once per site rather than restated in prose.
do $mig$
declare
  v_src text;
  v_code text;
begin
  -- (1) all three `is_active` targets still LACK the term.
  foreach v_src in array array[
    'app.is_admin()', 'app.is_admin_for(uuid)', 'public.assume_role(platform_role)'
  ] loop
    v_code := regexp_replace(regexp_replace(pg_get_functiondef(v_src::regprocedure),
                                            '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
    if position('app.is_active(' in v_code) > 0 then
      raise exception 'BATCH10: % is ALREADY gated on app.is_active — investigate rather than re-run.', v_src
        using errcode = 'check_violation';
    end if;
  end loop;

  -- (2) ⭐ THE DISCRIMINATING CONTROL, in the same block. Without it, (1)'s three negatives
  -- are equally well explained by a needle that can find nothing anywhere — a detector that
  -- finds nothing must be proven able to find something. Batch 8's precedent has no such
  -- control; this is the cheap fix for it.
  v_code := regexp_replace(regexp_replace(
              pg_get_functiondef('app.is_org_admin_of_for(uuid, uuid)'::regprocedure),
              '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
  if position('app.is_active(' in v_code) = 0 then
    raise exception 'BATCH10: the app.is_active( needle finds NOTHING even in app.is_org_admin_of_for, which carries it — assertion (1) above is vacuous.'
      using errcode = 'check_violation';
  end if;

  -- (3) the Class-2 arm this migration REMOVES is still there (else the removal is a no-op).
  v_code := regexp_replace(regexp_replace(
              pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure),
              '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
  if position('app.is_admin_for(p_uid)' in v_code) = 0
     or position('app.is_org_admin_of_for(p_org, p_uid)' in v_code) = 0 then
    raise exception 'BATCH10: app.can_manage_professional does not carry the expected arms — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;

  -- (4) the gate it RELOCATES TO does not carry it yet.
  v_code := regexp_replace(regexp_replace(
              pg_get_functiondef('app.can_manage_case_vocabulary(uuid, uuid)'::regprocedure),
              '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
  if position('app.is_admin_for(' in v_code) > 0 then
    raise exception 'BATCH10: app.can_manage_case_vocabulary ALREADY carries an explicit is_admin_for arm — investigate rather than re-run.'
      using errcode = 'check_violation';
  end if;
  if position('app.can_manage_professional(p_org, p_uid)' in v_code) = 0
     or position('app.is_org_commission_staff_admin(p_org, p_uid)' in v_code) = 0 then
    raise exception 'BATCH10: app.can_manage_case_vocabulary does not carry its two expected arms — the body changed since this migration was written.'
      using errcode = 'check_violation';
  end if;

  -- (5) assume_role still carries the PRE-R10 stamp, scoped to the audit_write CALL so the
  -- `select ... into v_org, v_hospital, v_commission` above it cannot answer for it.
  v_code := regexp_replace(regexp_replace(
              pg_get_functiondef('public.assume_role(platform_role)'::regprocedure),
              '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
  v_src := substring(v_code from 'app\.audit_write\(.*?\);');
  if v_src is null then
    raise exception 'BATCH10: could not isolate assume_role''s app.audit_write call — the R10 assertions below would be vacuous.'
      using errcode = 'check_violation';
  end if;
  if position('v_commission' in v_src) = 0
     or position('v_org' in v_src) = 0
     or position('v_hospital' in v_src) = 0 then
    raise exception 'BATCH10: assume_role''s audit_write call does not stamp the expected scope variables — R10 has nothing to remove.'
      using errcode = 'check_violation';
  end if;
end $mig$;

-- ---------------------------------------------------------------------------
-- SITE 1 — app.is_admin(). CALLER-KEYED throughout.
-- ---------------------------------------------------------------------------
create or replace function app.is_admin()
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_claim text;
  v_is_admin boolean;
begin
  v_claim := nullif(current_setting('request.jwt.claims', true), '');
  if v_claim is not null and (v_claim::jsonb ->> 'is_admin') = 'true' then
    v_is_admin := true;
  else
    v_is_admin := exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    );
  end if;

  -- ACT (ADR 0106 D11): the caller must ALSO be currently ACTING AS
  -- platform_admin, not merely hold the underlying entitlement.
  --
  -- ⭐ ACCOUNT STATE since pre-AE5 Batch 10 (ADR 0201 D4; Batch 9 rulings R3 + R12).
  -- Until then this predicate was BLIND to `profiles.is_active` / `suspended_until`: a
  -- deactivated or suspended platform_admin passed all 26 policies and 13 functions that
  -- read it. `app.is_active` FOLDS the two states into one boolean deliberately (401 §16.4),
  -- and it fails closed on an absent profile or a null uid.
  --
  -- ⚠ THE CLAIM FAST PATH ABOVE SURVIVES — this file's header declares the tightening and
  -- names exactly what it does and does not close: the stale-token window that remains is
  -- the admin FLAG alone, because `app.is_active` always reads `public.profiles`.
  --
  -- CALLER-KEYED, and the argument is written explicitly rather than left to
  -- `app.is_active`'s `DEFAULT auth.uid()`, so the keying is legible in the body.
  return v_is_admin
     and (app.active_role() is not distinct from 'platform_admin')
     and app.is_active(auth.uid());
end;
$function$;

-- ---------------------------------------------------------------------------
-- SITE 2 — app.is_admin_for(uuid). SUBJECT-KEYED throughout.
-- ---------------------------------------------------------------------------
create or replace function app.is_admin_for(p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1 from public.profiles where id = p_user_id and is_admin = true
  )
  -- ⭐ ACCOUNT STATE since pre-AE5 Batch 10 (ADR 0201 D4). SUBJECT-KEYED, matching the
  -- entitlement clause above it and the caller-only clause below it: this predicate answers
  -- about `p_user_id`, so its account-state term reads `p_user_id` too. A caller-keyed arm
  -- here would answer about a DIFFERENT principal than the rest of the body (ADR 0193 D5).
  -- ⚠ It is a CONJUNCT, not a disjunct: a deactivated admin is not an admin to anybody,
  -- third parties included — which is the whole point of the subject-keyed twin.
  and app.is_active(p_user_id)
  -- ACT (ADR 0106 D11), CALLER-ONLY: when the question is about the CALLER, the
  -- platform_admin hat must be active. A question about a THIRD PARTY is
  -- unchanged — one principal's hat must never alter what the system concludes
  -- about another. Mirrors app.has_role's own condition, and the entitlement
  -- clause it now guards is identical to app.is_admin()'s profiles fallback.
  and (p_user_id is distinct from (select auth.uid())
       or app.active_role() is not distinct from 'platform_admin');
$function$;

-- ---------------------------------------------------------------------------
-- SITE 3 — public.assume_role(platform_role). THE SEATING DOOR.
-- Two changes in one body, and they are independent: (a) PO ruling R1's door-wide
-- `app.is_active` gate, (b) R10's role-only audit stamp.
-- ---------------------------------------------------------------------------
create or replace function public.assume_role(p_role platform_role)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_holds boolean;
  v_org uuid;
  v_hospital uuid;
  v_commission uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  v_session_id := nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'),
    ''
  )::uuid;
  if v_session_id is null then
    raise exception 'sessão inválida' using errcode = '28000';
  end if;

  -- ⭐ G4 (ADR 0155), ENFORCED SERVER-SIDE (ADR 0176 D7). authz.roles is sealed from every
  -- application role; this function is SECURITY DEFINER, so the read needs no grant.
  -- FAIL CLOSED: a role with no catalog row is NOT selectable.
  if not coalesce(
       (select r.session_selectable from authz.roles r where r.code = p_role::text),
       false) then
    raise exception 'papel não selecionável nesta sessão' using errcode = '42501';
  end if;

  -- ⭐⭐ ACCOUNT STATE, DOOR-WIDE (ADR 0201 D4 / Batch 9 ruling R12, widened by PO ruling R1
  -- and declared as a widening in this file's header). The SEATING door follows the caller's
  -- account state for EVERY tier, before ANY seating. Placed AFTER the selectability check on
  -- purpose: a role nobody may pick keeps its more specific answer.
  -- ⛔ Gating `app.is_admin()` and `app.is_admin_for()` while leaving this door open would
  -- have READ complete — a deactivated admin could simply mint a fresh hat here, and
  -- `app.active_role()` is a bare claim read, so nothing downstream would have noticed.
  -- CALLER-KEYED (`v_uid := auth.uid()`), like every other predicate in this body.
  if not app.is_active(v_uid) then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  if p_role = 'platform_admin' then
    v_holds := exists (
      select 1 from public.profiles where id = v_uid and is_admin = true
    );
    -- No tenant to stamp — v_org/v_hospital/v_commission stay NULL (the ruling's
    -- own carve-out). Since R10 that is no longer a carve-out but the general rule.
  else
    select m.organization_id, m.hospital_id, m.commission_id
      into v_org, v_hospital, v_commission
    from public.memberships m
    where m.principal_id = v_uid
      and m.role = p_role::text
      and (m.expires_at is null or m.expires_at > now())
    order by m.granted_at desc nulls last, m.id
    limit 1;

    v_holds := v_org is not null or v_hospital is not null or v_commission is not null;
  end if;

  if not v_holds then
    raise exception 'papel não disponível para este usuário' using errcode = '42501';
  end if;

  insert into app.active_role_selections (session_id, user_id, role, chosen_at)
  values (v_session_id, v_uid, p_role, now())
  on conflict (session_id) do update
    set role = excluded.role,
        chosen_at = excluded.chosen_at;

  -- ⭐⭐ R10 (ADR 0201 D2): the audit row logs the ROLE ONLY, no place — for EVERY tier.
  -- ⛔ v_org / v_hospital / v_commission are STILL SELECTED above (v_holds is derived from
  -- them) and are deliberately NOT stamped, and they are deliberately NOT renamed: a rename
  -- would make this file's "the old scope arguments are gone" assertion pass for the wrong
  -- reason. The reason is not tidiness — a footprint captured at assume-time is a SNAPSHOT
  -- that a mid-session grant invalidates, while `hat_ok` compares role_code only and admits
  -- the new seating.
  -- ⚠ THE ROW IS STILL WRITTEN. R10 NULLs three columns; it does not stop the audit
  -- (315 §"exactly one active_role.assumed row per session" still holds, and 418 §3.7 pins it).
  perform app.audit_write(
    'active_role.assumed', 'active_role_selection', v_session_id, null::uuid,
    'Papel assumido: ' || p_role::text,
    jsonb_build_object('role', p_role),
    null::uuid, null::uuid
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- SITE 4 — app.can_manage_professional. THE CLASS-2 WRITE ARM IS REMOVED.
-- ---------------------------------------------------------------------------
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- ORG AUTHORITY ONLY since AE4.7c. The commission staff_admin ascent moved to
  -- app.can_create_professional (row 43) — a staff_admin ADDS a professional, never modifies
  -- or redacts one (matrix § 12.8.5).
  --
  -- ⭐⭐ AND ORG AUTHORITY ALONE SINCE pre-AE5 Batch 10 (ADR 0201 D5, Batch 9 ruling R4): the
  -- subject-keyed platform arm `app.is_admin_for` is REMOVED, not narrowed.
  -- ⚠ THE NAME IS WRITTEN WITHOUT ITS OPEN PARENTHESIS HERE FOR A REASON THAT IS NOW HISTORY,
  -- AND THE HISTORY IS THE POINT. `pg_get_functiondef` returns comments too, and this
  -- migration's landing assertion for THIS body is that the `(`-terminated form is ABSENT: the
  -- first draft of this very paragraph quoted the needle and the migration ABORTED on it
  -- (2026-09-10). The mirror-image defect was measured the same day — the "`p_uid is not null`
  -- is PRESENT" check did not fire when the guard was planted away, because the comment eight
  -- lines below QUOTED it. Both landing blocks now strip comments before matching, so neither
  -- direction can recur; the omission here is kept as the record of how that was found.
  -- A35's platform_admin noun list is
  -- *tenancy, identity, vocabulary and audit*; a tenant's PROFESSIONAL REGISTRY is Class-2
  -- TENANT content — the "identity" noun is the USER DIRECTORY, which is a different table and
  -- a different door. ADR 0201 D6 supersedes A30's bucket-C reading that put professional
  -- identity inside the noun.
  -- ⛔ THE ARM WAS RELOCATED, NOT DELETED FROM THE SYSTEM. `app.can_manage_case_vocabulary`
  -- gains it EXPLICITLY, because vocabulary IS a MAY-noun. Removing it here and stopping there
  -- strands every vocabulary door with 42501 "sem autorização para gerenciar o catálogo" — the
  -- PO measured exactly that in a rolled-back run, and pgTAP 418 §4.8 is the cell that catches
  -- it. Declared losses at THIS gate, and their reason: 418 §4.1/§4.6/§4.7 plus this file's
  -- header.
  --
  -- SUBJECT-KEYED SINCE ADR 0200 (pre-AE5 Batch 8, PO ruling R1), and that is still the whole
  -- point of this body: the surviving arm answers about `p_uid`, the principal the signature
  -- names, never about auth.uid().
  --
  -- ⛔ THE `p_uid is not null` GUARD IS KEPT DELIBERATELY, though it is now redundant:
  -- app.is_org_admin_of_for resolves through app.is_active, whose coalesce already denies on
  -- null. It stays so the deny-on-null contract is STATED at this gate rather than inferred
  -- from a helper a future edit could change.
  --
  -- ⚠ AE5 TEMPLATE OBLIGATION (ADR 0193 D5, restated as data in ADR 0200): this gate is
  -- SUBJECT-KEYED. The per-role template that substitutes eleven increments through this chain
  -- must never pair a caller-keyed arm with a `p_uid`-keyed one — a differential whose two
  -- sides answer about different principals is not a differential.
  select p_uid is not null and app.is_org_admin_of_for(p_org, p_uid);
$function$;

-- ---------------------------------------------------------------------------
-- SITE 5 — app.can_manage_case_vocabulary. THE RELOCATION.
-- ---------------------------------------------------------------------------
create or replace function app.can_manage_case_vocabulary(p_org uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- ⭐⭐ THE PLATFORM ARM IS EXPLICIT HERE SINCE pre-AE5 Batch 10 (ADR 0201 D5, ruling R4).
  -- It was INHERITED through `app.can_manage_professional` until that predicate lost it; the
  -- SURVIVING reason is D5's own: A35's noun list is *tenancy, identity, VOCABULARY and
  -- audit*, so case vocabulary is a MAY-noun and the platform reach is kept — while a
  -- tenant's professional registry is not, and the reach is removed there.
  -- ⛔ Making it explicit is the point: an arm that reaches a gate only through a sibling
  -- predicate is an arm nobody can see when that sibling is re-scoped, which is precisely how
  -- a bare removal would have stranded this gate with 42501.
  --
  -- KEYING (ADR 0193 D5 / 0201 D3): all three arms are SUBJECT-KEYED on `p_uid`. And because
  -- the SAME migration adds `app.is_active(p_user_id)` to `app.is_admin_for`, this relocated
  -- arm follows the subject's account state from the moment it lands — the relocation does
  -- not re-open at a new gate the hole it closes at the old one. Measured control:
  -- `app.is_org_commission_staff_admin` already carries `app.is_active(p_uid)`.
  select app.is_admin_for(p_uid)
      or app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
$function$;

-- ---------------------------------------------------------------------------
-- LANDING ASSERTIONS, AFTER — re-read from the CATALOG, never assumed from the statements
-- above: a mutation that did not fully apply otherwise reports green. BOTH DIRECTIONS, and
-- the PRESERVATION half is not optional — a `create or replace` that dropped an untouched
-- conjunct would satisfy every "the new term landed" check and silently widen the gate.
-- ⭐ Each needle below was PROVEN TO FIRE on a planted body in a rolled-back transaction
-- before this migration was proposed as done; the plants are recorded in the unit's
-- session log (docs/progress/admin-arm-is-active.md).
-- ---------------------------------------------------------------------------
do $mig$
declare
  v_new text;
  v_call text;
begin
  -- ⛔ `v_new` IS COMMENT-STRIPPED AT EVERY SITE. See the note above the BEFORE block: one
  -- assertion here aborted the migration on a comment that QUOTED its needle, and another was
  -- measured VACUOUS because a comment ANSWERED for code a plant had deleted. Both directions
  -- of the same defect, both closed structurally rather than by remembering not to write the
  -- string in prose.
  -- SITE 1 --------------------------------------------------------------
  v_new := regexp_replace(regexp_replace(pg_get_functiondef('app.is_admin()'::regprocedure),
                                         '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g');
  if position('app.is_active(auth.uid())' in v_new) = 0 then
    raise exception 'BATCH10: app.is_admin() did NOT gain the caller-keyed app.is_active(auth.uid()) term — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('app.active_role() is not distinct from ''platform_admin''' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: app.is_admin() LOST its ADR 0106 D11 hat conjunct — this migration adds a term, it does not remove one.'
      using errcode = 'check_violation';
  end if;

  -- SITE 2 --------------------------------------------------------------
  v_new := regexp_replace(regexp_replace(pg_get_functiondef('app.is_admin_for(uuid)'::regprocedure),
                                         '/\*.*?\*/', '', 'gs'), '--[^
]*', '', 'g');
  if position('app.is_active(p_user_id)' in v_new) = 0 then
    raise exception 'BATCH10: app.is_admin_for did NOT gain the SUBJECT-keyed app.is_active(p_user_id) term — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('app.active_role() is not distinct from ''platform_admin''' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: app.is_admin_for LOST its ADR 0106 D11 caller-only hat clause.'
      using errcode = 'check_violation';
  end if;

  -- SITE 3 --------------------------------------------------------------
  v_new := regexp_replace(regexp_replace(pg_get_functiondef('public.assume_role(platform_role)'::regprocedure),
                                         '/\*.*?\*/', '', 'gs'), '--[^
]*', '', 'g');
  if position('app.is_active(v_uid)' in v_new) = 0 then
    raise exception 'BATCH10: public.assume_role did NOT gain the door-wide app.is_active(v_uid) gate — the change did not land.'
      using errcode = 'check_violation';
  end if;
  if position('session_selectable' in v_new) = 0
     or position('on conflict (session_id) do update' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: public.assume_role LOST its selectability check or its upsert.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ R10 IS ASSERTED ON THE audit_write CALL, NOT ON THE WHOLE BODY, and that correction is
  -- load-bearing. The plan's literal needle was "`v_org, v_hospital` absent from the body" —
  -- which is UNSATISFIABLE, because `select ... into v_org, v_hospital, v_commission` contains
  -- that exact substring and must be KEPT (v_holds is derived from those variables). A
  -- body-wide check would have failed the migration for the wrong reason; a body-wide check
  -- written the other way round would have been answered by the select-into and proved
  -- nothing about the stamp.
  -- ⛔ THE ROW IS STILL WRITTEN, AND THIS CHECK RUNS FIRST ON PURPOSE. R10 NULLs columns; it
  -- does not stop the audit. Written after the isolation guard below it would be UNREACHABLE:
  -- a body with no `app.audit_write(` at all makes the substring NULL, so the isolation guard
  -- would fire and this raise could never be planted — an earlier guard firing leaves the
  -- later one untested, and an assertion that cannot fire is not an assertion.
  if position('app.audit_write(' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: public.assume_role no longer writes an audit row at all — R10 NULLs three columns, it does not remove the write.'
      using errcode = 'check_violation';
  end if;
  v_call := substring(v_new from 'app\.audit_write\(.*?\);');
  if v_call is null then
    raise exception 'BATCH10: could not isolate assume_role''s app.audit_write call — the R10 assertions below would be vacuous.'
      using errcode = 'check_violation';
  end if;
  if position('v_commission' in v_call) > 0
     or position('v_org' in v_call) > 0
     or position('v_hospital' in v_call) > 0 then
    raise exception 'BATCH10 R10: assume_role''s audit_write call STILL stamps a scope variable — the role-only stamp did not land.'
      using errcode = 'check_violation';
  end if;
  if position('null::uuid' in v_call) = 0 then
    raise exception 'BATCH10 R10: assume_role''s audit_write call carries no null::uuid scope argument — the stamp was not rewritten.'
      using errcode = 'check_violation';
  end if;
  -- ⛔ AND THE VARIABLES ARE KEPT, NOT RENAMED — otherwise the two checks above would pass
  -- for the wrong reason (nothing named v_org left to find).
  if position('into v_org, v_hospital, v_commission' in v_new) = 0 then
    raise exception 'BATCH10 R10: assume_role''s scope variables were RENAMED or removed — the R10 assertions above would then pass for the wrong reason.'
      using errcode = 'check_violation';
  end if;

  -- SITE 4 --------------------------------------------------------------
  v_new := regexp_replace(regexp_replace(pg_get_functiondef('app.can_manage_professional(uuid, uuid)'::regprocedure),
                                         '/\*.*?\*/', '', 'gs'), '--[^
]*', '', 'g');
  if position('app.is_admin_for(' in v_new) > 0 then
    raise exception 'BATCH10: the Class-2 platform arm SURVIVED in app.can_manage_professional — ADR 0201 D5 removes it.'
      using errcode = 'check_violation';
  end if;
  if position('app.is_org_admin_of_for(p_org, p_uid)' in v_new) = 0
     or position('p_uid is not null' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: app.can_manage_professional LOST its org-authority arm or its deny-on-null guard — this migration removes ONE arm.'
      using errcode = 'check_violation';
  end if;

  -- SITE 5 --------------------------------------------------------------
  v_new := regexp_replace(regexp_replace(pg_get_functiondef('app.can_manage_case_vocabulary(uuid, uuid)'::regprocedure),
                                         '/\*.*?\*/', '', 'gs'), '--[^
]*', '', 'g');
  if position('app.is_admin_for(p_uid)' in v_new) = 0 then
    raise exception 'BATCH10: app.can_manage_case_vocabulary did NOT gain the explicit is_admin_for arm — the RELOCATION did not land, and every vocabulary door is now stranded at 42501.'
      using errcode = 'check_violation';
  end if;
  if position('app.can_manage_professional(p_org, p_uid)' in v_new) = 0
     or position('app.is_org_commission_staff_admin(p_org, p_uid)' in v_new) = 0 then
    raise exception 'BATCH10 PRESERVATION: app.can_manage_case_vocabulary LOST one of its two existing arms.'
      using errcode = 'check_violation';
  end if;
end $mig$;
