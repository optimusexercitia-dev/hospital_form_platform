#!/usr/bin/env bash
#
# ⛔ BINDING (qa B1, ADR 0078 M1): a test that cannot fail is not evidence.
# Run from the repo root against a local stack:  bash supabase/tests/mutation/m1-mutation-audit.sh
# Every row must read RED-PROVEN. Add a run_case for every new ⭐ keystone.
#
# Three harness lessons, each of which HID A REAL RESULT and cost a round:
#  1. Match keystones BY LABEL, never by test number — numbers went stale 3x as the
#     suite grew, and a stale map reports a real RED as noise.
#  2. Distinguish RED / GREEN / ABSENT. A mutation that ABORTS the suite prints no
#     "not ok" at all; reading that as "green" is a false NOT-FALSIFIABLE — the exact
#     inverse of the vacuous keystone, and just as misleading.
#  3. ASCII-only patterns: `·` is multi-byte UTF-8 and grep's `.` matches one BYTE.
# M1 MUTATION AUDIT (qa B1, binding).
#
# A test that cannot fail is not evidence. For each ⭐ keystone: revert ITS fix in
# a rolled-back transaction and require the keystone to go RED.
#
# Design note — why this isolates. Neutering app.is_case_excluded globally would
# revert every deny at once and prove nothing about any single keystone. Instead we
# surgically rewrite ONE function's body to call a neutered stub, leaving the REAL
# app.is_case_excluded intact — which matters because the assertions themselves
# call it directly. Trigger-backed fixes are reverted by dropping the trigger.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
SRC="${SRC:-supabase/tests/229_authz_m1_exclusion_durability.sql}"
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

# The neutered stubs + a per-function reverter.
read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_false(uuid, uuid) returns boolean
  language sql immutable as $m$ select false $m$;
create or replace function app._mut_noop(uuid) returns void
  language plpgsql immutable as $m$ begin end; $m$;
create or replace function app._mut_noop2(uuid, uuid) returns void
  language plpgsql immutable as $m$ begin end; $m$;
create or replace function app._mut_revert(p_fn text) returns void
  language plpgsql as $m$
declare d text := pg_get_functiondef(p_fn::regprocedure);
begin
  d := replace(d, 'app.is_case_excluded(', 'app._mut_false(');
  d := replace(d, 'app.assert_not_case_excluded(', 'app._mut_noop(');
  d := replace(d, 'app.assert_respondent_linkage_resolved(', 'app._mut_noop2(');
  execute d;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red test numbers (space sep)
  local label="$1" mut="$2" expect="$3"
  local f="$WORK/mut.sql"
  # ⛔ HARNESS LESSON 4 (found while building the M5 sibling): this injection used
  # `awk -v pre="$PRELUDE"`, and BSD awk (macOS) rejects ANY multi-line -v value with
  # "newline in string". The awk then emitted a garbage script and EVERY case aborted:
  # this file reported 22/22 ABSENT on a Mac while its recorded result was 22/22
  # RED-PROVEN on a GNU-awk machine. The tri-state is the only reason that surfaced as
  # NOT PROVEN instead of silence — but a harness whose result depends on which awk is
  # installed is a harness that will be misread. head/tail is portable to both.
  local mark="${MARKER:-grant select on k to authenticated;}"
  local line
  line=$(grep -n "$mark" "$SRC" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-46s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$SRC"; return
  fi
  { head -n "$line" "$SRC"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$SRC"; } > "$f"
  docker cp "$f" "$DB:/tmp/mut.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mut.sql 2>&1)
  local verdict="RED-PROVEN" bad=""
  local IFS='|'; local pats=($expect); unset IFS
  for pat in "${pats[@]}"; do
    if   echo "$out" | grep -qE "^not ok [0-9]+ - .*$pat"; then :
    elif echo "$out" | grep -qE "^ok [0-9]+ - .*$pat";     then bad="$bad [$pat]=GREEN"
    else bad="$bad [$pat]=ABSENT(aborted)"; fi
  done
  [ -n "$bad" ] && verdict="*** NOT PROVEN ->$bad ***"
  printf '%-46s expect-red[%s]  %s\n' "$label" "$expect" "$verdict"
}

# ---------------------------------------------------------------------------
# PREFLIGHT — bootstrap our own prerequisites. `supabase db reset` drops pgtap and
# test_helpers (both are created transiently by `supabase test db`), so running this
# harness straight after a reset otherwise aborts EVERY case and reports a uniform
# "NOT PROVEN" that looks like 22 broken keystones instead of a missing extension.
# The ABSENT-vs-GREEN split caught it — but a harness that needs a specific run order
# is a harness that will be misread. Make it self-sufficient.
# ---------------------------------------------------------------------------
PGTAP_WAS_PRESENT=$(docker exec "$DB" psql -U postgres -d postgres -tAc "select count(*) from pg_extension where extname='pgtap'" 2>/dev/null | tr -d '[:space:]')
docker exec "$DB" psql -U postgres -d postgres -q -c "create extension if not exists pgtap;" >/dev/null 2>&1

# ---------------------------------------------------------------------------
# CLEANUP — leave the stack as we found it. The preflight above installs pgtap into
# `public` OUTSIDE any transaction, so it PERSISTS after this harness exits, and the
# NEXT `supabase test db` then reads t19 RED ("no public function is anon-executable")
# on 1079 pgtap-owned functions. That is a FALSE red: read-only, zero app leaks, not
# a regression — but the next person chases it, and "2740/2740" becomes reproducible
# only on a fresh reset. A harness that silently changes the stack it audits is a
# harness that manufactures findings. Drop it ONLY if we installed it.
# ---------------------------------------------------------------------------
cleanup_pgtap () {
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup_pgtap EXIT

docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mut_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mut_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

echo "=== M1 MUTATION AUDIT — every ⭐ keystone must go RED when its fix is reverted ==="

run_case "M1·3 freeze (trg key)"        "drop trigger trg_guard_case_participant_role_key on public.case_participant_roles;" "an org_admin CANNOT re-key|PHI door stays SHUT"
run_case "M1·3 audit trigger"           "drop trigger trg_audit_case_participant_role on public.case_participant_roles;" "EMITS an audit row"
read -r -d '' MUT_LINK <<'EOF'
create or replace function app.guard_professional_linkage() returns trigger
language plpgsql security definer set search_path = app, public, pg_catalog as $z$
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null then new.link_state := 'linked'; end if;
    return new;
  end if;
  return new;   -- FREEZE REVERTED (derivation kept, so the fixture still builds)
end; $z$;
EOF
run_case "M1·1 linkage freeze (surgical)" "$MUT_LINK" "CANNOT unlink his own profile|the linkage SURVIVES him"
run_case "M1·1 B7 attach (add_case_p)"  "select app._mut_revert('public.add_case_participant(uuid,uuid,uuid,boolean,text)');" "CANNOT be attached as respondent_doctor"
run_case "M1·2 lift_recusal"            "select app._mut_revert('public.lift_recusal(uuid,text)');" "cannot lift HER OWN recusal"
run_case "M1·2 remove_case_participant" "select app._mut_revert('public.remove_case_participant(uuid)');" "cannot remove HIS OWN respondent row"
run_case "M1·2 set_case_participant_role" "select app._mut_revert('public.set_case_participant_role(uuid,uuid)');" "cannot RE-KEY his own row"
run_case "M1·2 set_primary_subject"     "select app._mut_revert('public.set_primary_subject(uuid)');" "cannot exercise coordinator authority"
run_case "M1·2 record_recusal"          "select app._mut_revert('public.record_recusal(uuid,uuid,text,uuid)');" "may NOT recuse ANOTHER member"
run_case "M1·4b can_write_case_narrative" "select app._mut_revert('app.can_write_case_narrative(uuid,uuid)');" "D6: a respondent-coordinator CANNOT write|D6 SELF-CONSISTENCY"
run_case "M1·4b can_write_attachment"   "select app._mut_revert('app.can_write_attachment(text,uuid,uuid)');" "D7: a respondent-coordinator CANNOT write attachments"
run_case "M1·4b can_read_action_item"   "select app._mut_revert('app.can_read_action_item(uuid,uuid)');" "A22 .*: the deny BEATS the assignees_only|CLOSURE: can_read_attachment"
run_case "M1·4 reclassify_attachment"   "select app._mut_revert('public.reclassify_attachment(uuid,text,text)');" "W-2.5: a recused/respondent coordinator CANNOT declassify"
run_case "M1·4 set_participant_patient" "select app._mut_revert('public.set_participant_patient(uuid,uuid,text,text,date,integer,text,text,text,text,uuid)');" "CANNOT overwrite his own case"
run_case "M1·4 dispose_case_phi (qa B2)" "select app._mut_revert('public.dispose_case_phi(uuid,text)');" "the accused CANNOT dispose"
run_case "M1·4b can_write_interview"    "select app._mut_revert('app.can_write_interview(uuid,uuid)');" "CANNOT write an interview of her own case|CLOSURE: can_write_attachment"

# --- the DEVIATION sweep (qa M-1). Un-keystoned deviations are the most fragile
# --- artifacts here: nobody was owed a test for them. 16 was a floor; these close it.
run_case "M-1 DOOR2 (set_case_participant_role B7)" "select app._mut_revert('public.set_case_participant_role(uuid,uuid)');" "DOOR2: RE-KEYING an .unknown. professional"
run_case "DEV2 can_write_attachment action_item" "select app._mut_revert('app.can_write_attachment(text,uuid,uuid)');" "action_item arm DENIES the excluded party"
run_case "DEV4 set_case_confidentiality (5th door)" "select app._mut_revert('public.set_case_confidentiality(uuid,text)');" "THE FIFTH DOOR: the respondent CANNOT reclassify|classification SURVIVES him"

# DEVIATION 3 is a CONSTRAINT, not a function, so _mut_revert cannot reach it —
# and "revert each fix" means each fix, not each convenient one. Revert the FK to
# the ON DELETE SET NULL it shipped with (the silent deny-dissolver) and require
# the keystone to go red.
read -r -d '' MUT_FK <<'EOF'
alter table public.professional_profiles drop constraint professional_profiles_user_id_fkey;
alter table public.professional_profiles add constraint professional_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
EOF
run_case "DEV3 FK ON DELETE RESTRICT" "$MUT_FK" "is ON DELETE RESTRICT"

# =============================================================================
# M2 — A30 bucket C (ADR 0078 A35): platform_admin loses the referral-PHI arm.
# Lives in 189 (the referral/NSP fixture), so it runs with SRC overridden.
# Reverting = putting the arm BACK; both keystones must go red.
# =============================================================================
run_m2 () {
  SRC="supabase/tests/189_nsp_per_hospital_isolation.sql"   MARKER='grant select on personas to authenticated;' run_case "$@"
}
read -r -d '' MUT_M2 <<'EOF'
do $z$ declare d text := pg_get_functiondef('public.dispose_referral_phi(uuid,text)'::regprocedure);
begin execute replace(d, 'if not (', 'if not (app.is_admin() or '); end $z$;
create or replace function public.can_dispose_referral_phi(p_referral_id uuid)
returns boolean language sql stable security definer set search_path = app, public, pg_catalog as $z$
  select app.is_admin() or exists (
    select 1 from public.case_referral r where r.id = p_referral_id
      and ( app.is_tenancy_admin_of(r.source_commission_id)
         or app.is_pqs_operator_of(app.hospital_of_commission(r.source_commission_id))
         or app.is_pqs_operator_of(app.hospital_of_commission(r.target_commission_id))));
$z$;
EOF
run_m2 "M2 platform_admin referral-PHI arm" "$MUT_M2" "can_dispose_referral_phi is FALSE for a platform_admin|CANNOT dispose referral PHI|PHI row SURVIVES the platform_admin"

# =============================================================================
# M3 — defect ① (ADR 0078): bare assignment must not confer patient identifiers.
# Lives in 230 (its own fixture). Reverting = putting the two assignment arms BACK.
# ⚠ A NARROWING, so BOTH directions are mutation-proven: the negatives must go red
# when the arms return, AND the positive/content twins must STAY GREEN (a mutation
# that reddens everything would mean the keystones are just measuring the function).
# =============================================================================
run_m3 () {
  SRC="supabase/tests/230_authz_m3_assignment_phi.sql"   MARKER='grant select on k to authenticated;' run_case "$@"
}
read -r -d '' MUT_M3 <<'EOF'
create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean language plpgsql stable security definer set search_path = app, public, pg_catalog as $z$
declare v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then return false; end if;
  if app.is_case_respondent(p_case_id, p_uid) then return false; end if;
  if app.is_recused_from_case(p_case_id, p_uid) then return false; end if;
  if not app.feature_enabled('case_access') then
    if (select visibility_policy from public.cases where id = p_case_id) = 'explicit_grants_only' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    end if;
    return app.is_member_of_for(v_commission, p_uid);
  end if;
  return app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (select 1 from public.case_access ca where ca.case_id = p_case_id and ca.user_id = p_uid
               and (ca.expires_at is null or ca.expires_at > now()))
    or exists (select 1 from public.case_phases cp where cp.case_id = p_case_id and cp.assigned_to = p_uid)
    or exists (select 1 from public.case_narratives cn where cn.case_id = p_case_id and cn.assigned_to = p_uid);
end; $z$;
EOF
run_m3 "M3 defect-1 bare-assignment PHI arms" "$MUT_M3" "BARE NARRATIVE ASSIGNEE cannot reach the PHI door|audited door returns NULL|BARE PHASE ASSIGNEE cannot reach the PHI door|no longer references case_phases|nor case_narratives"
