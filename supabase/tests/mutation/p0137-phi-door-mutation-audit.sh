#!/usr/bin/env bash
#
# ⛔ BINDING (A33, ADR 0078 — the no-regression-twin / over-grant rule). A test that
# cannot fail is not evidence. Run from the repo root against a local stack:
#   bash supabase/tests/mutation/p0137-phi-door-mutation-audit.sh
# Every mutation must read RED-PROVEN.
#
# ---------------------------------------------------------------------------
# WHY THIS FILE EXISTS — `FUP-0137-357-TWINS-ON-STALE-BODY` (part 1, the CASE side)
# and `FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD` (part 2, the REFERRAL side)
# ---------------------------------------------------------------------------
# `app._set_participant_patient_unchecked` is ADR 0137 D3's PHI-write enforcement
# point. It is `prosecdef = f`, non-boolean, and lives in `app` — so it is OUTSIDE
# EVERY AUTHZ ARM'S DOMAIN. `ARM=census` HOLDING is therefore not evidence about it
# (it prints the function as an orphaned backlog entry, and the arm's own note calls
# that "renamed/dropped — prune", which is `FUP-AUTHZ-CENSUS-PRUNE-NOTE-IS-WRONG`).
#
# Its real coverage is suite `357`'s targeted mutation twins. Those were run by hand on
# 2026-08-22 — against the body the ADR 0137 batch then RE-EMITTED. The compensating
# evidence for the batch's main case-side gate was therefore stale BY CONSTRUCTION, and
# the follow-up asked for a re-run. Hand-running it again would leave the next reader in
# exactly the same position, so the twins are written down here instead.
#
# ---------------------------------------------------------------------------
# HOW IT WORKS, AND THE TWO DISCIPLINES IT INHERITS
# ---------------------------------------------------------------------------
# The mutation is injected INSIDE `357`'s own transaction, after the marker line, so it
# rolls back with the suite. Nothing is left mutated even if the run aborts — the
# be3b/m1/m5/m6 harness shape.
#
# ⛔ 1. THE PROBE MUST MOVE THE HASH. `_mut_357` compares `pg_get_functiondef` before
# and after its own `replace()` and RAISES when nothing changed. Without that, a
# `replace()` whose needle drifted (a reformatted body, a renamed variable) is a NO-OP,
# the suite runs clean, and the harness reports GREEN — certifying coverage that was
# never exercised. This repo has shipped that exact reading: four mutations that
# silently never applied.
#
# ⛔ 2. RED IS MEASURED, NOT PREDICTED. Each mutation's reds are DIFFED against a clean
# baseline run of the same file rather than matched against a hand-written list of
# expected labels. A hand-list is a second copy of the suite that drifts from it, and
# its size has been wrong every time this repo has written one down. The printed counts
# below are an OUTPUT of the run.
set -u

DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/357_creation_scoped_case_phi.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

# The helper's PHI write, guarded off. TWO edits — the `if false then` and the matching
# `end if;` — which is why `_mut_357` asserts on BOTH needles: a two-part mutation with
# one part applied does not compile, and one that "half applies" is the shape that has
# read as green here before.
read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_357(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare
  d0 text := pg_get_functiondef(p_fn::regprocedure);
  d  text := d0;
begin
  if p_what = 'phi_write' then
    -- Neutralize THE WRITE ITSELF: the row never reaches patient_identifiers.
    d := replace(d, 'insert into public.patient_identifiers',
                    'if false then insert into public.patient_identifiers');
    d := replace(d, 'attending = excluded.attending, updated_at = now();',
                    'attending = excluded.attending, updated_at = now(); end if;');
  elsif p_what = 'wrapper_gate' then
    -- Remove the coordinator-only WRITE gate from the post-creation wrapper. NOTE this
    -- also reaches `set_case_patient`, which delegates here rather than re-gating.
    d := replace(d, 'not app.is_staff_admin_of(v_case.commission_id)', 'false');
  elsif p_what = 'helper_flag' then
    -- Remove the helper's OWN `case_patient` flag assert. The wrapper keeps its copy,
    -- so this measures whether the creation path is covered independently — which is
    -- the whole reason the assert is duplicated into the body.
    d := replace(d, 'perform app.assert_case_patient_enabled();', 'perform 1;');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  if d = d0 then
    raise exception 'MUTATION DID NOT APPLY: % on % (needle drifted)', p_what, p_fn;
  end if;
  execute d;
  -- Second half of the two-part guard: prove the edit is present in the LIVE catalog,
  -- not merely in the string we built.
  if p_what = 'phi_write'
     and pg_get_functiondef(p_fn::regprocedure) not like '%if false then insert into public.patient_identifiers%' then
    raise exception 'MUTATION DID NOT LAND: phi_write';
  end if;
end; $m$;
EOF

HELPER="app._set_participant_patient_unchecked(uuid,uuid,text,text,date,integer,text,text,text,text,uuid)"
WRAPPER="public.set_participant_patient(uuid,uuid,text,text,date,integer,text,text,text,text,uuid)"

run_file () {  # $1 = sql file on host; echoes raw TAP
  docker cp "$1" "$DB:/tmp/mut357.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut357.sql 2>&1
}

# TAP -> "ok|<label>" / "not ok|<label>", matched by LABEL not by number: an inserted
# assertion renumbers everything after it, and a number-keyed verdict then points at the
# wrong test while still looking authoritative.
parse_tap () { sed -nE 's/^(not ok|ok) [0-9]+ - (.*)$/\1|\2/p'; }

build () {  # $1 = mutation SQL (may be empty for the baseline); echoes the file path
  local mut="$1" f="$WORK/mut357.sql" line
  line=$(grep -n "$MARKER" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then echo "MARKER-NOT-FOUND" >&2; return 1; fi
  if [ -z "$mut" ]; then
    cp "$SRC" "$f"
  else
    { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
      tail -n +$((line+1)) "$SRC"; } > "$f"
  fi
  echo "$f"
}

PGTAP_WAS=$(docker exec "$DB" psql -U postgres -d postgres -tAc \
  "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q \
  -c "create extension if not exists pgtap with schema extensions;" >/dev/null 2>&1
cleanup () {
  docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop function if exists app._mut_357(text,text);" >/dev/null 2>&1
  [ "${PGTAP_WAS:-0}" = "0" ] && docker exec "$DB" psql -U postgres -d postgres -q \
    -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  return 0
}
trap cleanup EXIT

echo "=== BASELINE (unmutated $SRC) ==="
BASE_TAP=$(run_file "$(build '')")
echo "$BASE_TAP" | parse_tap > "$WORK/mut357.base"
BASE_OK=$(grep -c '^ok|' "$WORK/mut357.base" || true)
BASE_RED=$(grep -c '^not ok|' "$WORK/mut357.base" || true)
echo "baseline: $BASE_OK ok, $BASE_RED not ok"
if [ "${BASE_RED:-0}" != "0" ]; then
  echo "*** BASELINE IS NOT GREEN — every diff below would be measured against a broken"
  echo "*** reference. Fix the suite (or the reset) before reading anything here."
  echo "$BASE_TAP" | grep '^not ok' | head -20
fi

run_mutation () {  # $1 = label, $2 = mutation SQL
  local label="$1" mut="$2" tap out newred
  echo
  echo "=== MUTATION: $label ==="
  tap=$(run_file "$(build "$mut")")
  echo "$tap" | parse_tap > "$WORK/mut357.cur"
  # An assertion that was `ok` in the baseline and is `not ok` (or ABSENT — the suite
  # aborted before reaching it) now.
  newred=0
  while IFS='|' read -r st lbl; do
    [ "$st" = "ok" ] || continue
    if grep -Fxq "not ok|$lbl" "$WORK/mut357.cur"; then
      echo "  RED   $lbl"; newred=$((newred+1))
    elif ! grep -Fxq "ok|$lbl" "$WORK/mut357.cur"; then
      echo "  GONE  $lbl   (suite aborted before this assertion)"; newred=$((newred+1))
    fi
  done < "$WORK/mut357.base"
  if [ "$newred" = "0" ]; then
    echo "  *** NOT PROVEN — the mutation changed no verdict. Either the needle drifted"
    echo "  *** (then _mut_357 would have raised — check the output above) or this body"
    echo "  *** genuinely has no assertion standing behind it."
    echo "$tap" | grep -iE 'MUTATION DID NOT|ERROR|FATAL' | head -5
  else
    echo "  RED-PROVEN ($newred assertion(s))"
  fi
}

run_mutation "1/4 helper: the PHI write itself is neutralized" \
  "select app._mut_357('$HELPER', 'phi_write');"

run_mutation "2/4 wrapper: the coordinator-only write gate is removed" \
  "select app._mut_357('$WRAPPER', 'wrapper_gate');"

run_mutation "3/4 helper: EXECUTE is granted to authenticated (ACL opened)" \
  "grant execute on function $HELPER to authenticated;"

run_mutation "4/4 helper: its OWN case_patient flag assert is removed" \
  "select app._mut_357('$HELPER', 'helper_flag');"

# ---------------------------------------------------------------------------
# PART 2 — the REFERRAL side (`FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD`, PO ruling
# 2026-08-24 shape (a)). Migration 20261003001700 moved the non-draft refusal INTO
# `public.set_referral_patient`, so the MRN is now protected by the door instead of by
# `app.guard_referral_status` firing on an unrelated trailing statement.
#
# ⛔ THAT ARM IS THE ONE THING STANDING BETWEEN A FULL-REPLACE UPSERT AND A BLANKED
# LGPD ERASURE KEY, so it gets a twin. Removing it must red `365` §1.1 (the refusal)
# AND §1.2 (the survival). §1.2 alone reding would mean the door still refuses but has
# stopped protecting the row; §1.1 alone would mean the opposite. Both is the shape
# that says the arm does what its comment claims.
# ---------------------------------------------------------------------------
SRC="supabase/tests/365_referral_mrn_persistence_floor.sql"
MARKER='grant select on k to authenticated;'
DOOR="public.set_referral_patient(uuid,text,text,date,integer,text,text,text,text)"

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_357(p_fn text, p_what text) returns void
  language plpgsql as $m$
declare
  d0 text := pg_get_functiondef(p_fn::regprocedure);
  d  text := d0;
begin
  if p_what = 'sent_arm' then
    -- Drop the "already sent" refusal, leaving only the terminal-state arm — i.e.
    -- restore the pre-2026-08-24 shape, in which a `sent` referral fell through to
    -- the upsert and was saved only by the status trigger's rollback.
    d := replace(d,
      'if v_status <> ''draft'' then',
      'if false then');
  elsif p_what = 'sent_arm_and_flag' then
    -- ⭐ THE COMPOUND MUTATION, and the reason it exists: the two locks must fail
    -- INDEPENDENTLY. Drop the door's arm AND set `app.in_referral_rpc`, which is
    -- exactly the edit someone would make to "enable post-send amends". If §1.2 does
    -- not red here, the blanking is being prevented by something nobody has named.
    d := replace(d,
      'if v_status <> ''draft'' then',
      'if false then');
    d := replace(d,
      'perform app.assert_referrals_enabled();',
      'perform app.assert_referrals_enabled(); perform set_config(''app.in_referral_rpc'', ''on'', true);');
  else
    raise exception 'unknown mutation %', p_what;
  end if;
  if d = d0 then
    raise exception 'MUTATION DID NOT APPLY: % on % (needle drifted)', p_what, p_fn;
  end if;
  execute d;
end; $m$;
EOF

echo
echo "=== BASELINE (unmutated $SRC) ==="
BASE_TAP=$(run_file "$(build '')")
echo "$BASE_TAP" | parse_tap > "$WORK/mut357.base"
BASE_OK=$(grep -c '^ok|' "$WORK/mut357.base" || true)
BASE_RED=$(grep -c '^not ok|' "$WORK/mut357.base" || true)
echo "baseline: $BASE_OK ok, $BASE_RED not ok"

run_mutation "5/6 door: the 'already sent' refusal is removed" \
  "select app._mut_357('$DOOR', 'sent_arm');"

run_mutation "6/6 door: the refusal is removed AND in_referral_rpc is set (both locks off)" \
  "select app._mut_357('$DOOR', 'sent_arm_and_flag');"

echo
echo "=== done. Nothing persists: every mutation ran inside the suite's own transaction. ==="
