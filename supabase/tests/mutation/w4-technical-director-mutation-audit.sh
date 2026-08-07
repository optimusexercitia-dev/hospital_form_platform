#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/w4-technical-director-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# ADR 0094 W4 (T4.1-T4.3) MUTATION AUDIT — Diretor Técnico roles + appointment.
#
# Two of these matter more than the rest:
#
#   admit_platform_admin — the PO ruled that a platform_admin may NOT appoint a
#   Diretor Técnico, which makes the DT arm the ONLY grant arm in the kernel with no
#   `is_admin_for` branch. That asymmetry looks like an oversight to anyone tidying the
#   kernel, so the assertion that forbids it has to be provably capable of failing.
#
#   drop_titular_index — "one titular per hospital" is a LEGAL invariant. The door
#   refuses a second titular with a readable code, so a door-only test stays green with
#   the index gone, and a future service-role writer walks straight through. This case
#   proves 294 tests the guarantee and not just the error message.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/294_technical_director_roles.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_w4_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_w4(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'remove_flag_check' then
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w4_sub(d, 'perform app.assert_technical_director_enabled();', 'null;');
    execute d;

  elsif p_what = 'admit_platform_admin' then
    -- The tidy-up a future reader is most likely to make.
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w4_sub(d,
      'if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception ''apenas o administrador da organização ou do hospital pode designar a direção técnica''',
      'if not (app.is_admin_for(p_actor)
            or app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception ''apenas o administrador da organização ou do hospital pode designar a direção técnica''');
    execute d;

  elsif p_what = 'remove_physician_check' then
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w4_sub(d, 'and pc.key = ''physician''', 'and true');
    execute d;

  elsif p_what = 'ignore_category_is_active' then
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w4_sub(d, 'and pc.is_active', 'and true');
    execute d;

  elsif p_what = 'remove_titular_door_check' then
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w4_sub(d, 'if p_role = ''technical_director''
       and exists (', 'if false
       and exists (');
    execute d;

  elsif p_what = 'drop_titular_index' then
    execute 'drop index public.memberships_one_technical_director_uq';

  elsif p_what = 'widen_dt_scope_shape' then
    -- Let a DT row be commission-scoped: the role would inherit committee-content
    -- reach, which decision 9 exists to prevent.
    execute 'alter table public.memberships drop constraint memberships_scope_shape';
    execute $c$ alter table public.memberships add constraint memberships_scope_shape
      check (
        case role
          when 'org_admin'      then ((organization_id is not null) and (hospital_id is null) and (commission_id is null))
          when 'nsp_org_admin'  then ((organization_id is not null) and (hospital_id is null) and (commission_id is null))
          when 'hospital_admin' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
          when 'nsp_coordinator' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
          when 'pqs_member'     then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
          when 'technical_director'        then true
          when 'technical_director_deputy' then true
          -- QO·A M1: the arm must ride along or the re-add refuses seeded reviewer
          -- rows and the mutation ABORTS instead of proving anything.
          when 'quality_reviewer' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
          when 'staff_admin'    then ((commission_id is not null) and (organization_id is null) and (hospital_id is null))
          when 'staff'          then ((commission_id is not null) and (organization_id is null) and (hospital_id is null))
          else false
        end) $c$;

  elsif p_what = 'non_atomic_appointment' then
    -- Grant the appointee without revoking the incumbent: the door's HC0G4 then
    -- refuses, so the hospital keeps its OLD titular and the appointment silently
    -- does nothing. Two titulars is the other failure shape; this is the quieter one.
    d := pg_get_functiondef('public.appoint_technical_director(uuid,uuid)'::regprocedure);
    d := app._mut_w4_sub(d,
      'perform app.revoke_role_impl(v_actor, ''hospital'', p_hospital, ''technical_director'', v_incumbent);',
      'null;');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutw4.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutw4.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutw4.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_w4(text); drop function if exists app._mut_w4_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutw4_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutw4_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== W4 MUTATION AUDIT — every keystone must go RED when ITS OWN guarantee is reverted ==="
echo

run_case "remove_flag_check -> dark flag confers something" \
  "select app._mut_w4('remove_flag_check');" \
  "FLAG DARK: an otherwise-valid appointment is refused"

run_case "admit_platform_admin -> the PO ruling" \
  "select app._mut_w4('admit_platform_admin');" \
  "a platform_admin CANNOT appoint the technical direction"

run_case "remove_physician_check -> a nurse becomes DT" \
  "select app._mut_w4('remove_physician_check');" \
  "PHYSICIAN: a nurse is refused the technical direction"

run_case "ignore_category_is_active -> retired category" \
  "select app._mut_w4('ignore_category_is_active');" \
  "an INACTIVE physician category does not confer eligibility"

run_case "remove_titular_door_check -> readable refusal" \
  "select app._mut_w4('remove_titular_door_check');" \
  "a second titular is refused at the door"

run_case "drop_titular_index -> the LEGAL guarantee" \
  "select app._mut_w4('drop_titular_index');" \
  "raw DML is refused by memberships_one_technical_director_uq"

run_case "widen_dt_scope_shape -> commission-scoped DT" \
  "select app._mut_w4('widen_dt_scope_shape');" \
  "a commission-scoped technical_director is rejected"

run_case "non_atomic_appointment -> handover" \
  "select app._mut_w4('non_atomic_appointment');" \
  "the appointee IS the titular"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_294.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_294.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 294 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
