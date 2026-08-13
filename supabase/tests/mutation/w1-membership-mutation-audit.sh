#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/w1-membership-mutation-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# ADR 0094 W1 (Package A) MUTATION AUDIT — membership invariants + replacement semantic.
#
# W1 is a mix of NARROWINGS (a unique index, two FKs) and a BEHAVIOUR CHANGE (the T1.0
# replacement semantic). Both shapes fail silently in the direction the suite does not
# look:
#   * a narrowing that rejects EVERYTHING passes every deny keystone (§7.7) — which is
#     why 291 pairs each with a positive twin, and why the twins are mutated here too;
#   * the replacement semantic's whole design argument is "in-place UPDATE, not
#     delete+insert". If 291 cannot tell those two implementations apart, the argument
#     is untested prose. `naive_delete_insert` below is the case that proves it can.
#
# Harness lessons inherited from a2/b/m1/m5/m6/u1/u2 (each HID A REAL RESULT):
#  1. Match keystones BY LABEL, never by test number.
#  2. Tri-state RED / GREEN / ABSENT — `red != abort`.
#  3. ASCII-ONLY grep patterns.
#  4. head/tail split (BSD awk rejects multi-line -v on macOS).
#  5. Re-emit functions from LIVE pg_get_functiondef, never from migration text.
#  6. A replace() that matches nothing SILENTLY NO-OPS -> stays GREEN -> NOT PROVEN.
#     _mut_w1 raises on any no-op replace, so #6 cannot happen quietly here.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/291_membership_invariants.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_w1_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_w1(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'drop_uq_index' then
    execute 'drop index public.memberships_one_commission_role_uq';

  elsif p_what = 'grant_authenticated_write' then
    execute 'grant insert, update, delete on public.memberships to authenticated';

  elsif p_what = 'drop_hospital_fk' then
    execute 'alter table public.memberships drop constraint memberships_hospital_id_fkey';

  elsif p_what = 'drop_title_fk' then
    execute 'alter table public.memberships drop constraint memberships_title_id_fkey';

  elsif p_what = 'bare_set_null' then
    -- The column list is what keeps commission_id alive; drop it and title deletion
    -- breaks (this is the hazard caught by probe before the migration was written).
    execute 'alter table public.memberships drop constraint memberships_title_id_fkey';
    execute 'alter table public.memberships add constraint memberships_title_id_fkey
             foreign key (title_id, commission_id)
             references public.commission_member_titles (id, commission_id)
             on delete set null';

  elsif p_what = 'restore_trigger_guard' then
    -- Resurrect one retired guard: the census must notice BOTH paths are live again.
    execute $g$ create or replace function app.guard_membership_hospital_org()
      returns trigger language plpgsql as $b$ begin return new; end; $b$ $g$;
    execute 'create trigger guard_membership_hospital_org_trg
             before insert or update on public.memberships
             for each row execute function app.guard_membership_hospital_org()';

  elsif p_what = 'revert_replacement_arm' then
    -- Neutralize T1.0 entirely: the door falls through to the INSERT and the index
    -- raises a raw, unhandled 23505 — the exact defect W1 exists to prevent.
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)'::regprocedure);
    d := app._mut_w1_sub(d,
      'if found and v_existing_role is distinct from p_role then',
      'if false then');
    execute d;

  elsif p_what = 'revert_outgoing_authority' then
    -- Remove the outgoing-role authority check: a plain staff_admin regains the
    -- ability to demote a peer staff_admin.
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)'::regprocedure);
    d := app._mut_w1_sub(d,
      'if v_existing_role = ''staff_admin''
         and not (app.is_admin() or app.is_tenancy_admin_of(p_scope_id)) then',
      'if false then');
    execute d;

  elsif p_what = 'naive_delete_insert' then
    -- Implement T1.0 the way the plan's parenthetical described it. The invariant
    -- still holds and the role still changes, so a coarse suite stays green; what
    -- breaks is row identity, the member's title, and the audit semantic.
    d := pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)'::regprocedure);
    d := app._mut_w1_sub(d,
      'update public.memberships
         set role       = p_role,
             title_id   = coalesce(p_title_id, title_id),
             granted_by = (select auth.uid()),
             granted_at = now()
       where id = v_existing_id;',
      'delete from public.memberships where id = v_existing_id;
       insert into public.memberships (principal_id, commission_id, role, granted_by)
         values (p_user, p_scope_id, p_role, (select auth.uid()));');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutw1.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutw1.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutw1.sql 2>&1)
  if echo "$out" | grep -q 'MUTATION NO-OP'; then
    printf '%-52s *** NOT PROVEN -> MUTATION NO-OP (needle missing; see lesson 6) ***\n' "$label"; return
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

# PREFLIGHT — self-sufficient (a reset drops pgtap; without it every case ABORTs).
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_w1(text); drop function if exists app._mut_w1_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutw1_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutw1_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== W1 MUTATION AUDIT — every keystone must go RED when ITS OWN invariant is reverted ==="
echo

run_case "drop_uq_index -> dual-role denial" \
  "select app._mut_w1('drop_uq_index');" \
  "the one-role-per-commission index exists|a principal cannot hold a SECOND role"

run_case "grant_authenticated_write -> direct-DML denial" \
  "select app._mut_w1('grant_authenticated_write');" \
  "authenticated holds NO INSERT/UPDATE/DELETE"

run_case "drop_hospital_fk -> cross-org hospital" \
  "select app._mut_w1('drop_hospital_fk');" \
  "hospital/org integrity is a COMPOSITE FK|a hospital paired with a FOREIGN organization"

run_case "drop_title_fk -> cross-commission title" \
  "select app._mut_w1('drop_title_fk');" \
  "title/commission integrity is a COMPOSITE FK|a title from ANOTHER commission"

run_case "bare_set_null -> title deletion breaks" \
  "select app._mut_w1('bare_set_null');" \
  "the SET NULL column list is present|deleting an assigned title succeeds"

run_case "restore_trigger_guard -> two enforcement paths" \
  "select app._mut_w1('restore_trigger_guard');" \
  "both BEFORE-row trigger guards are RETIRED|the retired guard functions are dropped"

run_case "revert_replacement_arm -> T1.0 door" \
  "select app._mut_w1('revert_replacement_arm');" \
  "granting the OTHER commission role succeeds|the role was REPLACED"

run_case "revert_outgoing_authority -> peer demotion" \
  "select app._mut_w1('revert_outgoing_authority');" \
  "a plain staff_admin CANNOT demote a peer staff_admin"

run_case "naive_delete_insert -> identity/title/audit" \
  "select app._mut_w1('naive_delete_insert');" \
  "the membership row IDENTITY is preserved|the member's per-commission TITLE survives|emits exactly one membership.role_changed|NO membership.revoked"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_291.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_291.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 291 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: all green ($ok ok, 0 not ok)"
fi
