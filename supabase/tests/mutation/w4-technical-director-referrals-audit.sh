#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/w4-technical-director-referrals-audit.sh
# Every row must read RED-PROVEN, and the CONTROL must read all-green.
#
# ADR 0094 W4 (T4.5-T4.9) MUTATION AUDIT — the Diretor Técnico referral plane.
#
# Four of these carry more weight than the rest:
#
#   restore_null_sender_hole / restore_link_case_null_hole / drop_waiting_arm —
#   the three NULL-comparison holes that opened the moment `target_commission_id`
#   became nullable. Each is ONE operand away from correct and each fails OPEN, so the
#   only evidence that 295 actually closes them is that putting them back turns 295 red.
#   These are the cases this whole file exists for.
#
#   revoke_column_grant — `authenticated` holds COLUMN-level SELECT on case_referral,
#   so a new column reads 42501 unless granted explicitly. Nothing in a migration, a
#   type-check or a build says so: the defect appears only at runtime, in front of a
#   user. 1.4 is the assertion that stands in for that, and it has to be able to fail.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/295_technical_director_referrals.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on cs to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_w4r_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_w4r(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  -- ── The audience arms ───────────────────────────────────────────────────────
  if p_what = 'drop_manage_arm' then
    d := pg_get_functiondef('app.can_manage_referral_target(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'app.is_technical_director_of_for(r.target_hospital_id, p_uid)', 'false');
    execute d;

  elsif p_what = 'drop_metadata_arm' then
    d := pg_get_functiondef('app.can_read_referral_metadata(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'app.is_technical_director_of_for(r.target_hospital_id, p_uid)', 'false');
    execute d;

  elsif p_what = 'drop_phi_arm' then
    d := pg_get_functiondef('app.can_read_referral_phi(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'app.is_technical_director_of_for(r.target_hospital_id, p_uid)', 'false');
    execute d;

  -- D1: titular ≡ deputy. Dropping the deputy leg is the edit a reader who assumes a
  -- "substituto" is a lesser tier would make, and it leaves every membership-shaped
  -- assertion green while stalling the referral at accept.
  elsif p_what = 'deputy_is_not_equal' then
    d := pg_get_functiondef('app.is_technical_director_of_for(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d,
      'or app.has_role(''hospital'', p_hospital_id, ''technical_director_deputy'', p_user_id)',
      'or false');
    execute d;

  -- The flag is folded into the predicate precisely so it cannot be forgotten at a
  -- call site. This proves the folding is load-bearing rather than decorative.
  elsif p_what = 'ignore_flag' then
    d := pg_get_functiondef('app.is_technical_director_of_for(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'select app.feature_enabled(''technical_director'')', 'select true');
    execute d;

  -- ── T4.7: the same-hospital rule ────────────────────────────────────────────
  elsif p_what = 'drop_same_hospital' then
    d := pg_get_functiondef('public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'if p_target_hospital_id is distinct from v_source_hospital then', 'if false then');
    execute d;

  -- ── NULL-hole #2 (D3): the message-sender guard ─────────────────────────────
  -- Verbatim the pre-W4 body. `sender not in (v_src, v_tgt)` is NULL when the sender is
  -- NULL, the IF is not taken, and the trigger returns NEW — a NULL sender was
  -- admissible on EVERY referral, not just a DT one.
  elsif p_what = 'restore_null_sender_hole' then
    execute $f$
      create or replace function app.guard_referral_message()
      returns trigger language plpgsql security definer
      set search_path to 'app', 'public', 'pg_catalog'
      as $b$
      declare v_src uuid; v_tgt uuid;
      begin
        select source_commission_id, target_commission_id into v_src, v_tgt
        from public.case_referral where id = new.referral_id;
        if v_src is null then
          raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
        end if;
        if new.sender_commission_id not in (v_src, v_tgt) then
          raise exception 'o remetente da mensagem deve ser a comissão de origem ou de destino'
            using errcode = 'HC0A0';
        end if;
        return new;
      end; $b$;
    $f$;

  -- ── NULL-hole #3: link_referral_case ────────────────────────────────────────
  elsif p_what = 'restore_link_case_hole' then
    d := pg_get_functiondef('public.link_referral_case(uuid,uuid)'::regprocedure);
    d := app._mut_w4r_sub(d, 'if v_referral.target_type = ''technical_director'' then', 'if false then');
    execute d;

  -- ── NULL-hole #1 (D9): the waiting-party CHECK ──────────────────────────────
  -- The pre-W4 shape, minus the DT arm entirely: waiting_on_hospital_id becomes
  -- unconstrained, so "the DT is holding this" can be written onto any referral.
  elsif p_what = 'drop_waiting_arm' then
    execute 'alter table public.case_referral drop constraint case_referral_waiting_on_check';
    execute $c$ alter table public.case_referral add constraint case_referral_waiting_on_check
      check (
        waiting_on_committee_id is null
        or waiting_on_committee_id = source_commission_id
        or (target_commission_id is not null and waiting_on_committee_id = target_commission_id)
      ) $c$;

  -- The fifth site — found BY the CHECK, not by reading. Every writer of one waiting
  -- column is a writer of both; leaving the other alone yields two waiting parties.
  elsif p_what = 'conclude_leaves_stale_waiting' then
    d := pg_get_functiondef('public.conclude_referral(uuid,uuid,text,boolean)'::regprocedure);
    d := app._mut_w4r_sub(d,
      'set status = ''answered'',
        waiting_on_committee_id = v_referral.source_commission_id,
        waiting_on_hospital_id = null,',
      'set status = ''answered'',
        waiting_on_committee_id = v_referral.source_commission_id,');
    execute d;

  -- ── D7: the shape CHECK ─────────────────────────────────────────────────────
  elsif p_what = 'drop_target_shape' then
    execute 'alter table public.case_referral drop constraint case_referral_target_shape';

  -- ── D5: the hospital-name snapshot ──────────────────────────────────────────
  elsif p_what = 'stale_hospital_snapshot' then
    d := pg_get_functiondef('public.snap_referral_commission_names()'::regprocedure);
    d := app._mut_w4r_sub(d,
      'SELECT name INTO NEW.target_hospital_name
    FROM public.hospitals WHERE id = NEW.target_hospital_id;', '');
    execute d;

  -- ── The runtime-only defect ─────────────────────────────────────────────────
  elsif p_what = 'revoke_column_grant' then
    execute 'revoke select (target_hospital_name) on public.case_referral from authenticated';

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red label patterns (| sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mutw4r.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutw4r.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutw4r.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_w4r(text); drop function if exists app._mut_w4r_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutw4r_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutw4r_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== W4 REFERRAL-PLANE MUTATION AUDIT — every keystone must go RED when ITS OWN guarantee is reverted ==="
echo

run_case "drop_manage_arm -> the whole target lifecycle" \
  "select app._mut_w4r('drop_manage_arm');" \
  "the DEPUTY receives the referral"

run_case "drop_metadata_arm -> the DT inbox" \
  "select app._mut_w4r('drop_metadata_arm');" \
  "the TITULAR reads the referral"

run_case "drop_phi_arm -> T4.8" \
  "select app._mut_w4r('drop_phi_arm');" \
  "both DT holders reach referral PHI"

run_case "deputy_is_not_equal -> D1 is real, not nominal" \
  "select app._mut_w4r('deputy_is_not_equal');" \
  "the DEPUTY reads it too"

run_case "ignore_flag -> the folded-in flag is load-bearing" \
  "select app._mut_w4r('ignore_flag');" \
  "FLAG OFF: the DT loses the inbox"

run_case "drop_same_hospital -> T4.7's only real rule" \
  "select app._mut_w4r('drop_same_hospital');" \
  "a committee cannot address ANOTHER hospital"

run_case "restore_null_sender_hole -> NULL-hole #2 (D3)" \
  "select app._mut_w4r('restore_null_sender_hole');" \
  "a NULL sender on a COMMISSION-targeted referral is REFUSED"

run_case "restore_link_case_hole -> NULL-hole #3" \
  "select app._mut_w4r('restore_link_case_hole');" \
  "the DT cannot attach a target case"

run_case "drop_waiting_arm -> NULL-hole #1 (D9)" \
  "select app._mut_w4r('drop_waiting_arm');" \
  "waiting_on_hospital_id is refused on a COMMISSION-targeted referral"

run_case "conclude_leaves_stale_waiting -> the fifth site" \
  "select app._mut_w4r('conclude_leaves_stale_waiting');" \
  "the DEPUTY concludes the referral"

run_case "drop_target_shape -> D7" \
  "select app._mut_w4r('drop_target_shape');" \
  "with a COMMISSION id is rejected by the shape CHECK"

run_case "stale_hospital_snapshot -> D5" \
  "select app._mut_w4r('stale_hospital_snapshot');" \
  "the target HOSPITAL name is snapshotted"

run_case "revoke_column_grant -> the RUNTIME-only defect" \
  "select app._mut_w4r('revoke_column_grant');" \
  "all four new columns carry an authenticated SELECT grant"

echo
echo "=== CONTROL — no mutation: every keystone GREEN (proves the harness is not a red-generator) ==="
docker cp "$SRC" "$DB:/tmp/_noop_295.sql" >/dev/null
control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_295.sql 2>&1)
if echo "$control" | grep -qE "^not ok"; then
  echo "*** CONTROL FAILED — 295 has a failing assertion WITHOUT any mutation ***"
  echo "$control" | grep -E "^not ok"
else
  ok=$(echo "$control" | grep -cE "^ok")
  echo "CONTROL: $ok assertions green, 0 red."
fi
