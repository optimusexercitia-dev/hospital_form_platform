#!/usr/bin/env bash
# ADR 0167 mutation audit — every keystone in pgTAP 397 must go RED when ITS OWN
# guarantee is reverted.
#
# House rules inherited from w1/w3 (each was added after a real miss):
#   1. Match keystones BY SUBJECT-BEARING LABEL, never by test number alone.
#   2. Tri-state RED / GREEN / ABSENT — `red != abort`; ABSENT is an ERROR, not a
#      hold: a mutant that aborts the file reports nothing and looks like coverage.
#   3. ASCII-ONLY grep patterns (397's labels carry emoji and pt-BR).
#   4. Re-emit functions from LIVE pg_get_functiondef, never from migration text.
#   5. A replace() that matches nothing SILENTLY NO-OPS -> stays GREEN -> NOT
#      PROVEN. `_mut_a167_sub` raises on any no-op replace, so #5 cannot happen
#      quietly here.
#   6. RESTORE IS BYTE-IDENTICAL BY CONSTRUCTION: the mutation is injected INSIDE
#      397's own transaction, so the suite's closing `rollback` undoes the DDL.
#      Nothing is restored by hand and nothing can be restored WRONG.
#
# BOTH POLARITIES PER GATE. A mutation that only ever DENIES cannot move a
# `lives_ok`, and one that only ever ADMITS cannot move a `throws_ok`. Every gate
# below is therefore attacked in both directions, and each disjunct of
# `app.is_tenancy_admin_of_for` is split out on its own.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/397_adr0167_commission_staff_admin_one_authority.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant execute on function pg_temp.p() to authenticated, service_role;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_a167_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_a167(p_what text) returns void
  language plpgsql as $m$
declare
  g constant text := 'app.grant_role_impl';
  r constant text := 'app.revoke_role_impl(uuid,text,uuid,text,uuid)';
  t constant text := 'app.is_tenancy_admin_of_for(uuid,uuid)';
  d text;
begin
  -- ---- SITE (a): the commission `staff_admin` grant arm --------------------
  if p_what = 'restore_is_admin_site_a' then
    -- The defect ADR 0167 clause 1 removes, put back exactly.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'if not (app.is_admin_for(p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'deny_all_site_a' then
    -- OPPOSITE POLARITY. An over-eager narrowing that refuses EVERYONE looks
    -- exactly like a fix to any assertion that only checks the platform admin.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'if true then');
    execute d;

  -- ---- SITE (b): the T1.0 outgoing-role guard ------------------------------
  elsif p_what = 'restore_is_admin_site_b' then
    -- The half a fix that reads "the commission arm" as ONE place leaves behind.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'and not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'and not (app.is_admin_for(p_actor)
                  or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'deny_all_site_b' then
    -- OPPOSITE POLARITY: a blanket ban on changing a coordinator's role. It
    -- satisfies every deny cell; only the positive twins can see it.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'and not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'then');
    execute d;

  elsif p_what = 'site_b_generic_message' then
    -- THE DISCRIMINATOR'S OWN MUTANT. Site (b) keeps its authority but loses its
    -- distinct message, so the refusal becomes indistinguishable from the
    -- 'staff' sub-arm's. Every SQLSTATE-only assertion stays green.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'sem permissão para alterar a função de um administrador da comissão',
      'sem permissão');
    execute d;

  -- ---- THE REVOKE SIDE (preservation + the agreement property) -------------
  elsif p_what = 'revoke_admits_platform' then
    -- The one-way door RE-OPENED FROM THE OTHER END: instead of grant being wider
    -- than revoke, revoke becomes wider than grant. The agreement property must
    -- not be direction-blind.
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d,
      'if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'if not (app.is_admin_for(p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'revoke_drops_hospital_tier' then
    -- A DIFFERENT disagreement: revoke keeps the org tier and loses the hospital
    -- tier, so grant and revoke disagree for exactly ONE actor.
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d,
      'if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then',
      'if not exists (select 1 from public.commissions c
                      where c.id = p_scope_id
                        and app.is_org_admin_of_for(c.organization_id, p_actor)) then');
    execute d;

  -- ---- THE SURVIVING PREDICATE, CONJUNCT AND DISJUNCT AT A TIME ------------
  elsif p_what = 'drop_org_disjunct' then
    d := pg_get_functiondef(t::regprocedure);
    d := app._mut_a167_sub(d,
      'app.has_role(''organization'', c.organization_id, ''org_admin'', p_user_id)',
      'false');
    execute d;

  elsif p_what = 'drop_hospital_disjunct' then
    d := pg_get_functiondef(t::regprocedure);
    d := app._mut_a167_sub(d,
      'app.has_role(''hospital'', c.hospital_id, ''hospital_admin'', p_user_id)',
      'false');
    execute d;

  elsif p_what = 'widen_hospital_to_whole_org' then
    -- ⭐ THE SUBTLE ONE. The hospital tier still works, so every admission cell
    -- stays green; what breaks is that a hospital_admin of ANOTHER hospital in
    -- the same organisation is now admitted. Only the wrong-hospital cell sees it.
    d := pg_get_functiondef(t::regprocedure);
    d := app._mut_a167_sub(d,
      'app.has_role(''hospital'', c.hospital_id, ''hospital_admin'', p_user_id)',
      'exists (select 1 from public.hospitals h
                where h.organization_id = c.organization_id
                  and app.has_role(''hospital'', h.id, ''hospital_admin'', p_user_id))');
    execute d;

  elsif p_what = 'drop_is_active_conjunct' then
    -- Dropping the platform arm must not have left account state as the only
    -- surviving check, nor removed it.
    d := pg_get_functiondef(t::regprocedure);
    d := app._mut_a167_sub(d,
      'select app.is_active(p_user_id) and exists (',
      'select true and exists (');
    execute d;

  -- ---- SITE (c): the commission `staff` sub-arm (ADR 0167 AMENDMENT 2) ------
  elsif p_what = 'restore_is_admin_staff_subarm' then
    -- ⭐ THE DEFECT AMENDMENT 2 REMOVES, PUT BACK EXACTLY. This replaces the old
    -- `remove_staff_arm_is_admin` mutant, whose needle ceased to exist the moment
    -- the arm was dropped — a mutation NO-OP reports "NOT PROVEN", but a mutant
    -- kept in the list for a site that moved reads as coverage until someone runs it.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not (app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then',
      'if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'deny_all_staff_subarm' then
    -- OPPOSITE POLARITY. Amendment 2 removed ONE disjunct; a narrowing that took
    -- the whole arm satisfies every deny cell, § 2.7 included, and would read as
    -- the same fix. Only the third participant's admission cells can see it.
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not (app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then',
      'if true then');
    execute d;

  -- ---- THE TWO PRESERVED `is_admin_for` SITES ------------------------------
  elsif p_what = 'remove_org_arm_is_admin' then
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(p_scope_id, p_actor)) then',
      'if not app.is_org_admin_of_for(p_scope_id, p_actor) then');
    execute d;

  elsif p_what = 'remove_hospital_arm_is_admin' then
    d := pg_get_functiondef(g::regproc);
    d := app._mut_a167_sub(d,
      'if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(v_org, p_actor)) then',
      'if not app.is_org_admin_of_for(v_org, p_actor) then');
    execute d;

  -- ---- THE RETIRED COMMENT, BOTH DIRECTIONS -------------------------------
  elsif p_what = 'restore_qa_m1_note' then
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d,
      '-- ⭐ ADR 0167. THE QA m1 NOTE',
      '-- INTENTIONAL asymmetry vs the grant arms (QA m1): no is_admin() here.
    -- ⭐ ADR 0167. THE QA m1 NOTE');
    execute d;

  elsif p_what = 'strip_adr0167_citation' then
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d, 'ADR 0167', 'ADR 0000');
    execute d;

  elsif p_what = 'restore_staff_gap_note' then
    -- AMENDMENT 2's OWN COMMENT MUTANT. Clause 1 left a NARROWED replacement note
    -- here, recording that the same one-way door survived on the `staff` sub-arm.
    -- Amendment 2 closed that door and retires the note outright, because a note
    -- about an asymmetry that no longer exists is how the original m1 note misled.
    -- Without this mutant, § 0.5's new term is a claim nothing can contradict.
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d,
      '-- ⭐ ADR 0167. THE QA m1 NOTE',
      '-- ⚠ the same one-way door SURVIVES ONE ROLE OVER, on the staff sub-arm.
    -- ⭐ ADR 0167. THE QA m1 NOTE');
    execute d;

  -- ---- RESIDUAL-CLOSING MUTANTS (added after the first residual bound) -----
  elsif p_what = 'cross_org_leak' then
    -- The org disjunct stops being scoped to the COMMISSION's organisation. Every
    -- same-org cell stays green; only the cross-tenant refusals can see it, and
    -- those were the residual this mutant exists to close.
    d := pg_get_functiondef(t::regprocedure);
    d := app._mut_a167_sub(d,
      'app.has_role(''organization'', c.organization_id, ''org_admin'', p_user_id)',
      'exists (select 1 from public.memberships m
                where m.principal_id = p_user_id and m.role = ''org_admin'')');
    execute d;

  elsif p_what = 'orphan_a_commission' then
    -- ⚠ A DATA MUTATION, DELIBERATELY. § 7.4 is a property of `memberships` and
    -- `commissions`, not of any function, so no function mutant can move it —
    -- which would have left an anti-lockout keystone unproven. Stripping Rede B's
    -- only tenancy admin leaves both of its commissions unseatable.
    delete from public.memberships
     where role in ('org_admin', 'hospital_admin')
       and organization_id = '0c000000-0000-0000-0000-00000000000b'::uuid;

  elsif p_what = 'revoke_staff_admits_platform' then
    -- ⭐ WAS `close_the_staff_gap`, AND THE RENAME IS THE RECORD OF A REVERSAL.
    -- While the gap was open this mutant CLOSED it and § 6.2 had to red, which is
    -- what made § 6 a measurement rather than a defect pinned as expected.
    -- Amendment 2 closed the gap in the OTHER direction — by narrowing grant — so
    -- the same edit now re-opens the door from the revoke end: revoke becomes
    -- WIDER than grant on the `staff` sub-arm. § 4.1 must not be direction-blind.
    d := pg_get_functiondef(r::regprocedure);
    d := app._mut_a167_sub(d,
      'if not (app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then',
      'if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'revoke_door_from_authenticated' then
    -- § 1.4 states the reachability the whole narrowing is ABOUT. If nothing can
    -- move it, the claim "a signed-in platform admin could call this directly"
    -- rests on a cell that would pass however the ACL stood.
    execute 'revoke execute on function public.grant_role(text,uuid,text,uuid,uuid,timestamptz) from authenticated';

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/muta167.sql" line
  line=$(grep -n "$MARKER" "$SRC" | tail -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/muta167.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/muta167.sql 2>&1)
  if echo "$out" | grep -q 'MUTATION NO-OP'; then
    printf '%-52s *** NOT PROVEN -> MUTATION NO-OP (needle missing) ***\n' "$label"; return
  fi
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-52s %s\n' "$label" "$verdict"
}

PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_a167(text); drop function if exists app._mut_a167_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_muta167_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_muta167_setup.sql >/dev/null 2>&1

echo "=== ADR 0167 MUTATION AUDIT — keyed by SUBJECT, both polarities per gate ==="
echo

echo "-- SUBJECT: site (a), the commission staff_admin grant arm"
run_case "  restore_is_admin_site_a   (widen)" \
  "select app._mut_a167('restore_is_admin_site_a');" \
  "2\.1 .*THE NARROWING|4\.1 .*THE PROPERTY|0\.1 SITE \(a\)|0\.3 "

run_case "  deny_all_site_a           (narrow)" \
  "select app._mut_a167('deny_all_site_a');" \
  "2\.2 an .org_admin|2\.3 a .hospital_admin|4\.2 .*POSITIVE TWIN|5\.1 PROMOTION"

echo
echo "-- SUBJECT: site (b), the T1.0 outgoing-role guard"
# ⛔ RE-RECORDED FOR ADR 0167 AMENDMENT 2. Both mutants below DEGRADED when the
#    `staff` sub-arm narrowed: the plain platform admin is refused one statement
#    earlier and never reaches site (b), so `restore_is_admin_site_b` kept only its
#    two STRUCTURAL reds and `site_b_generic_message` became NOT RED-PROVEN — a
#    mutant still listed while measuring nothing reads as coverage. 397 gained
#    actor 8 (`staff_admin` of the commission who is ALSO `is_admin_for`) for
#    exactly this: it is now the only actor whose verdict site (b) decides.
run_case "  restore_is_admin_site_b   (widen)" \
  "select app._mut_a167('restore_is_admin_site_b');" \
  "5\.2 .*DEMOTION|5\.3 .*THE SITE DISCRIMINATOR|0\.2 SITE \(b\)|0\.3 "

run_case "  deny_all_site_b           (narrow)" \
  "select app._mut_a167('deny_all_site_b');" \
  "5\.2 .*DEMOTION|5\.5 POSITIVE TWIN|5\.6 SECOND POSITIVE TWIN"

run_case "  site_b_generic_message    (message only)" \
  "select app._mut_a167('site_b_generic_message');" \
  "5\.2 .*DEMOTION|5\.3 .*THE SITE DISCRIMINATOR"

echo
echo "-- SUBJECT: the revoke side, and the grant/revoke agreement property"
run_case "  revoke_admits_platform    (widen)" \
  "select app._mut_a167('revoke_admits_platform');" \
  "3\.1 a platform_admin|4\.1 .*THE PROPERTY|0\.4 PRESERVATION"

run_case "  revoke_drops_hospital_tier(narrow)" \
  "select app._mut_a167('revoke_drops_hospital_tier');" \
  "3\.3 a .hospital_admin|4\.1 .*THE PROPERTY"

echo
echo "-- SUBJECT: app.is_tenancy_admin_of_for, one disjunct/conjunct at a time"
run_case "  drop_org_disjunct" \
  "select app._mut_a167('drop_org_disjunct');" \
  "2\.2 an .org_admin|3\.2 an .org_admin|5\.5 POSITIVE TWIN"

run_case "  drop_hospital_disjunct" \
  "select app._mut_a167('drop_hospital_disjunct');" \
  "2\.3 a .hospital_admin|3\.3 a .hospital_admin|5\.6 SECOND POSITIVE TWIN|8\.2 SESSION PATH"

run_case "  widen_hospital_to_whole_org" \
  "select app._mut_a167('widen_hospital_to_whole_org');" \
  "2\.4 |3\.4 a .hospital_admin. of another hospital"

run_case "  drop_is_active_conjunct" \
  "select app._mut_a167('drop_is_active_conjunct');" \
  "2\.6 a DEACTIVATED|3\.6 a DEACTIVATED"

echo
echo "-- SUBJECT: site (c), the commission staff sub-arm (ADR 0167 Amendment 2)"
run_case "  restore_is_admin_staff_subarm (widen)" \
  "select app._mut_a167('restore_is_admin_staff_subarm');" \
  "0\.3 |2\.7 |4\.1 |5\.2 .*DEMOTION"

run_case "  deny_all_staff_subarm     (narrow)" \
  "select app._mut_a167('deny_all_staff_subarm');" \
  "2\.8 |4\.2 |5\.5 POSITIVE TWIN"

echo
echo "-- SUBJECT: the TWO preserved is_admin_for sites (the out-of-scope arms)"
run_case "  remove_org_arm_is_admin" \
  "select app._mut_a167('remove_org_arm_is_admin');" \
  "0\.3 |7\.1 BOOTSTRAP STEP 1|7\.2 BOOTSTRAP STEP 2"

run_case "  remove_hospital_arm_is_admin" \
  "select app._mut_a167('remove_hospital_arm_is_admin');" \
  "0\.3 |7\.3 "

echo
echo "-- SUBJECT: the retired QA m1 comment, pinned in BOTH directions"
run_case "  restore_qa_m1_note        (sentence back)" \
  "select app._mut_a167('restore_qa_m1_note');" \
  "0\.5 "

run_case "  strip_adr0167_citation    (ruling unnamed)" \
  "select app._mut_a167('strip_adr0167_citation');" \
  "0\.5 "

run_case "  restore_staff_gap_note    (Amdt 2 sentence back)" \
  "select app._mut_a167('restore_staff_gap_note');" \
  "0\.5 "

echo
echo "-- SUBJECT: the assertions the first residual bound left unmoved"
run_case "  cross_org_leak            (tenant isolation)" \
  "select app._mut_a167('cross_org_leak');" \
  "2\.5 an .org_admin. of another organisation|3\.5 an .org_admin. of another organisation"

run_case "  orphan_a_commission       (data, not code)" \
  "select app._mut_a167('orphan_a_commission');" \
  "7\.4 "

run_case "  revoke_staff_admits_platform (door re-opened)" \
  "select app._mut_a167('revoke_staff_admits_platform');" \
  "0\.4 PRESERVATION|3\.7 |4\.1 "

run_case "  revoke_door_from_authenticated" \
  "select app._mut_a167('revoke_door_from_authenticated');" \
  "1\.4 "

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_397.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_397.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 397 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi

# ============================================================================
# ⛔ THE FULL BLAST RADII — measured 2026-08-28, ADR 0167 Amendment 2.
#
# The `expect` argument of each run_case above is a SUBSET, not the radius:
# run_case checks only that its named patterns are `not ok`, and never that they
# are the ONLY reds. A mutant can therefore stop reaching most of what it used to
# move and still print RED-PROVEN — which is exactly what Amendment 2 did to
# `restore_is_admin_site_b` (fell to its two STRUCTURAL reds) and to
# `site_b_generic_message` (moved nothing at all) before the compensation landed.
# Recompute these rather than reading the column; a shrinking radius is the signal.
#
#   restore_is_admin_site_a        0.1 0.3 2.1 4.1 4.3 5.1 8.1
#   deny_all_site_a                0.1 2.2 2.3 4.1 4.2 4.3 5.1 7.2 8.2 8.3
#   restore_is_admin_site_b        0.2 0.3 5.2 5.3
#   deny_all_site_b                0.2 5.2 5.5 5.6
#   site_b_generic_message         5.2 5.3
#   revoke_admits_platform         0.4 3.1 4.1
#   revoke_drops_hospital_tier     3.3 4.1
#   drop_org_disjunct              1.2 2.2 3.2 4.3 5.1 5.2 5.5 7.2
#   drop_hospital_disjunct         1.2 2.3 3.3 4.3 5.1 5.2 5.6 8.2 8.3
#   widen_hospital_to_whole_org    1.2 2.4 3.4 4.3 5.1 5.2
#   drop_is_active_conjunct        1.2 2.6 3.6 4.3 5.1 5.2
#   restore_is_admin_staff_subarm  0.3 2.7 4.1 4.3 5.2
#   deny_all_staff_subarm          0.3 2.8 4.1 4.2 4.3 5.2 5.3 5.5 5.6
#   remove_org_arm_is_admin        0.3 7.1 7.2
#   remove_hospital_arm_is_admin   0.3 7.3
#   restore_qa_m1_note             0.5
#   strip_adr0167_citation         0.5
#   restore_staff_gap_note         0.5
#   cross_org_leak                 1.2 2.5 3.5 4.3 5.1 5.2
#   orphan_a_commission            7.4
#   revoke_staff_admits_platform   0.4 3.7 4.1
#   revoke_door_from_authenticated 1.4 8.1 8.2 8.3
#
# UNION = 37 of 41. UNMOVED = 1.1, 1.3, 4.4, 5.4 — the published residual bound
# at the head of pgTAP 397, where each is named with why no mutant CAN move it.
# ============================================================================
