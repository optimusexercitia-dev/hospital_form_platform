#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/w3-door-kernel-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# ADR 0094 W3 MUTATION AUDIT — the actor kernel and the service door.
#
# The equivalence grid (293 §2) is the assertion most at risk of being vacuous: it
# compares two paths, and it passes just as happily when BOTH are wrong. So the grid
# is mutated by breaking exactly ONE path (`drift_session_wrapper`), which is the real
# failure mode — the two entry points diverging — rather than by breaking a rule.
#
# `widen_role_pin` is the complement: it widens BOTH paths equally, so 2.1 stays green
# and only the NAMED cells (2.5/2.6) can catch it. Between them the two cases show the
# grid and the named cells are covering different things and neither is redundant.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/293_membership_door_kernel.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_w3_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_w3(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'authenticated_gets_service_door' then
    execute 'grant execute on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid,timestamptz) to authenticated';

  elsif p_what = 'authenticated_gets_kernel' then
    execute 'grant execute on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz) to authenticated';

  elsif p_what = 'drift_session_wrapper' then
    -- ONE path breaks: the session wrapper loses the actor. The kernel and the
    -- service door are untouched, so this is exactly "the two entry points drifted".
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w3_sub(d, '(select auth.uid())', 'null::uuid');
    execute d;

  elsif p_what = 'widen_role_pin' then
    -- BOTH paths widen equally: a plain staff_admin may grant staff_admin. The grid's
    -- equality check cannot see this; the named cell must.
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w3_sub(d,
      'if not (app.is_admin_for(p_actor)
              or app.is_commission_admin_of_for(p_scope_id, p_actor)) then',
      'if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_commission_admin_of_for(p_scope_id, p_actor)) then');
    execute d;

  elsif p_what = 'remove_self_grant_check' then
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w3_sub(d, 'if p_user = p_actor then', 'if false then');
    execute d;

  elsif p_what = 'delegate_self_grant_to_session_helper' then
    -- The SUBTLE one, and the reason the kernel inlines the check: delegating to
    -- app._deny_self_grant looks correct and IS correct on the session path, but that
    -- helper compares against auth.uid(), which is null on the service path — so the
    -- guard silently evaporates exactly where it is newly needed.
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w3_sub(d,
      'if p_user = p_actor then
    raise exception ''não é permitido conceder acesso a si mesmo'' using errcode = ''42501'';
  end if;',
      'perform app._deny_self_grant(p_user);');
    execute d;

  elsif p_what = 'remove_antilockout' then
    d := pg_get_functiondef('app.revoke_role_impl(uuid,text,uuid,text,uuid)'::regprocedure);
    d := app._mut_w3_sub(d,
      'if p_scope_type = ''organization'' and p_role = ''org_admin'' then
    select count(*) into v_count',
      'if false then
    select count(*) into v_count');
    execute d;

  elsif p_what = 'inline_authority_in_wrapper' then
    -- The wrapper grows its own authority arm: "written once" is no longer true.
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_w3_sub(d,
      'perform app.grant_role_impl',
      'if not app.is_staff_admin_of(p_scope_id) then null; end if;
  perform app.grant_role_impl');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutw3.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutw3.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutw3.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_w3(text); drop function if exists app._mut_w3_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutw3_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutw3_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== W3 MUTATION AUDIT — every keystone must go RED when ITS OWN guarantee is reverted ==="
echo

run_case "authenticated_gets_service_door -> ACL bypass" \
  "select app._mut_w3('authenticated_gets_service_door');" \
  "grant_role_for: NO EXECUTE for authenticated|an authenticated user calling grant_role_for is refused"

run_case "authenticated_gets_kernel -> kernel is not an entry" \
  "select app._mut_w3('authenticated_gets_kernel');" \
  "grant_role_impl is owner-only"

run_case "drift_session_wrapper -> EQUIVALENCE" \
  "select app._mut_w3('drift_session_wrapper');" \
  "every .scope, role, actor. cell reaches the SAME verdict"

run_case "widen_role_pin -> named cell (grid is blind)" \
  "select app._mut_w3('widen_role_pin');" \
  "ROLE-PIN survives the swap"

run_case "remove_self_grant_check -> service self-grant" \
  "select app._mut_w3('remove_self_grant_check');" \
  "SELF-GRANT is denied on the SERVICE path"

run_case "delegate_self_grant_to_session_helper -> silent no-op" \
  "select app._mut_w3('delegate_self_grant_to_session_helper');" \
  "SELF-GRANT is denied on the SERVICE path"

run_case "remove_antilockout -> service lockout" \
  "select app._mut_w3('remove_antilockout');" \
  "ANTI-LOCKOUT binds the SERVICE path"

run_case "inline_authority_in_wrapper -> written-once" \
  "select app._mut_w3('inline_authority_in_wrapper');" \
  "hold NO authority predicate of their own"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_293.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_293.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 293 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
