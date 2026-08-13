#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/w2-session-context-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# ADR 0094 W2 MUTATION AUDIT — session_context, expiry defusal, completeness grid.
#
# W2's keystones are unusually easy to write vacuously, because most of them assert
# that something is ABSENT (no anon EXECUTE, no expiry writer, no foreign grant, no
# unhandled role). An assertion over an empty set passes whether or not the probe can
# see anything at all — so every "must be empty" case below is mutated by MAKING THE
# SET NON-EMPTY, which is the only way to show the probe has eyes.
#
# Harness lessons inherited (each HID A REAL RESULT): match by LABEL not test number;
# tri-state RED/GREEN/ABSENT; ASCII-only patterns; head/tail split; re-emit from LIVE
# pg_get_functiondef; a replace() that matches nothing SILENTLY NO-OPS (_mut_w2_sub
# raises instead).
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/292_session_context.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_w2_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_w2(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'drop_expiry_filter' then
    d := pg_get_functiondef('public.session_context()'::regprocedure);
    d := app._mut_w2_sub(d,
      'and (m.expires_at is null or m.expires_at > now())', 'and true');
    execute d;

  elsif p_what = 'filter_every_dated_grant' then
    -- The over-narrow shape: drops EVERY grant that carries a date, not just the
    -- expired ones. Passes the deny keystone, fails the positive twin.
    d := pg_get_functiondef('public.session_context()'::regprocedure);
    d := app._mut_w2_sub(d,
      'and (m.expires_at is null or m.expires_at > now())', 'and (m.expires_at is null)');
    execute d;

  elsif p_what = 'leak_foreign_grants' then
    d := pg_get_functiondef('public.session_context()'::regprocedure);
    d := app._mut_w2_sub(d, 'where m.principal_id = me.uid', 'where true');
    execute d;

  elsif p_what = 'grant_anon_execute' then
    execute 'grant execute on function public.session_context() to anon';

  elsif p_what = 'revert_expiry_audit_arm' then
    d := pg_get_functiondef('app.trg_audit_memberships()'::regprocedure);
    d := app._mut_w2_sub(d,
      'elsif new.expires_at is distinct from old.expires_at then', 'elsif false then');
    execute d;

  elsif p_what = 'plant_expiry_writer' then
    -- A real door acquiring an expiry write is the thing the invariant exists to
    -- catch. Named like a plausible feature so the grep is not tautological.
    execute $w$ create or replace function public.set_membership_expiry(p_id uuid, p_when timestamptz)
      returns void language plpgsql as $b$
      begin update public.memberships set expires_at = p_when where id = p_id; end; $b$ $w$;

  elsif p_what = 'drop_grant_role_arm' then
    -- Remove ONE role's dispatch arm; the grid must name exactly that role.
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)'::regprocedure);
    d := app._mut_w2_sub(d,
      'elsif p_scope_type = ''hospital'' and p_role = ''pqs_member'' then', 'elsif false then');
    execute d;

  elsif p_what = 'drop_revoke_role_arm' then
    d := pg_get_functiondef('public.revoke_role(text,uuid,text,uuid)'::regprocedure);
    d := app._mut_w2_sub(d,
      'elsif p_scope_type = ''hospital'' and p_role = ''nsp_coordinator'' then', 'elsif false then');
    execute d;

  elsif p_what = 'add_role_to_check_only' then
    -- The decision-6 scenario: a role admitted to the vocabulary but wired nowhere.
    execute 'alter table public.memberships drop constraint memberships_role_check';
    execute $c$ alter table public.memberships add constraint memberships_role_check
      check (role = any (array['org_admin'::text,'nsp_org_admin'::text,'hospital_admin'::text,
                               'nsp_coordinator'::text,'staff_admin'::text,'staff'::text,
                               'pqs_member'::text,'unwired_new_role'::text])) $c$;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutw2.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutw2.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutw2.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_w2(text); drop function if exists app._mut_w2_sub(text,text,text); drop function if exists public.set_membership_expiry(uuid,timestamptz);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutw2_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutw2_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== W2 MUTATION AUDIT — every keystone must go RED when ITS OWN guarantee is reverted ==="
echo

run_case "drop_expiry_filter -> expired grant reappears" \
  "select app._mut_w2('drop_expiry_filter');" \
  "an expired grant is absent from the session snapshot"

run_case "filter_every_dated_grant -> over-narrow twin" \
  "select app._mut_w2('filter_every_dated_grant');" \
  "a grant expiring in the FUTURE is still effective"

run_case "leak_foreign_grants -> isolation" \
  "select app._mut_w2('leak_foreign_grants');" \
  "another principal's hospital grant is not visible"

run_case "grant_anon_execute -> ACL" \
  "select app._mut_w2('grant_anon_execute');" \
  "neither anon nor PUBLIC holds EXECUTE"

run_case "revert_expiry_audit_arm -> Rule 11 trail" \
  "select app._mut_w2('revert_expiry_audit_arm');" \
  "each expires_at change emitted a membership.expiry_changed"

run_case "plant_expiry_writer -> T2.3b invariant" \
  "select app._mut_w2('plant_expiry_writer');" \
  "NO function in app/public writes memberships.expires_at"

run_case "drop_grant_role_arm -> grid (grant)" \
  "select app._mut_w2('drop_grant_role_arm');" \
  "grant_role has an arm for EVERY role"

run_case "drop_revoke_role_arm -> grid (revoke)" \
  "select app._mut_w2('drop_revoke_role_arm');" \
  "revoke_role has an arm for EVERY role"

run_case "add_role_to_check_only -> grid (vocabulary)" \
  "select app._mut_w2('add_role_to_check_only');" \
  "every role in memberships_role_check has a declared scope"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_292.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_292.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 292 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
