#!/usr/bin/env bash
#
# ⛔ BINDING (ADR 0079 / authz-handoff §7.1). A test that cannot fail is not evidence.
# Run from the repo root against a local stack:
#   bash supabase/tests/mutation/q1-quality-mutation-audit.sh
# Every row must read RED-PROVEN, and every CONTROL must read all-green.
#
# QO·A (ADR 0100) MUTATION AUDIT — quality_reviewer oversight, 20 cases.
#
# ⚠ Keep this count and the run_case list in sync — a header that names a stale
# figure is an assertion that goes stale silently (the class this project has
# paid for repeatedly).
#
# Five of these matter more than the rest:
#
#   open_bytes_cut / open_resolver_door — the bytes layer has TWO halves and each
#   is invisible to the other's sweep: M8's storage policy lives in the `storage`
#   schema (outside the door-audit's `public` population) and M9's door is a
#   2-guard rowdoor whose CASE-expression defeats the rowdoor neutralizer
#   (ERROR, and "ERROR is not a pass"). These two cases ARE that coverage.
#
# Three more:
#
#   grant_arm_admits_platform — the PO ruled (D9, mirroring the DT ruling) that a
#   platform_admin may NOT seat a quality reviewer. The arm looks asymmetric next
#   to the hospital_admin arm above it (which HAS is_admin_for), so it is exactly
#   the "tidy-up" a future reader makes. 306's noun-rule keystone must be provably
#   capable of failing.
#
#   force_dashboard_helper — can_read_quality_dashboards is ONE predicate OR-ed
#   into six DEFINER doors. If it goes permissive, every excluded/cross-org/
#   expired denial in 309 must notice — otherwise the six arms are unguarded.
#
#   arm_seventh_door (lead ruling b) — 270's two-class catalog invariant is the
#   ONLY structural guard on the D11 six/three boundary. Arm a ROW-LEVEL door and
#   270 must red, or an M-future that arms the wrong set ships green.
#
# Mutations run INSIDE each suite's begin..rollback transaction (DDL is
# transactional), so the catalog restores itself; §RESTORE below additionally
# byte-compares every touched function against its pre-run image to PROVE it.
set -u
DB=supabase_db_azkbbhskturikxpgmafq
WORK="${TMPDIR:-/tmp}"
MARKER='grant select on k to authenticated;'

read -r -d '' PRELUDE <<'EOF'
create or replace function app._mut_q1_sub(d text, needle text, repl text) returns text
  language plpgsql as $s$
declare out text;
begin
  out := replace(d, needle, repl);
  if out = d then
    raise exception 'MUTATION NO-OP: needle not found -> %', left(needle, 60);
  end if;
  return out;
end; $s$;

create or replace function app._mut_q1(p_what text) returns void
  language plpgsql as $m$
declare d text;
begin
  if p_what = 'strip_s7' then
    -- Neutralize the S7 arm at its oversight test (unique to S7).
    d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
    d := app._mut_q1_sub(d,
      'and (select quality_oversight from public.commissions where id = v_commission) = ''visible'' then',
      'and false then');
    execute d;

  elsif p_what = 'force_reviewer_predicate' then
    -- The role predicate goes permissive: every scope boundary must notice.
    execute $q$create or replace function app.is_quality_reviewer_of_for(p_hospital_id uuid, p_user_id uuid)
      returns boolean language sql stable security definer
      set search_path to 'app', 'public', 'pg_catalog'
      as $f$ select true; $f$$q$;

  elsif p_what = 'door_authority' then
    d := pg_get_functiondef('public.set_commission_oversight(uuid,text)'::regprocedure);
    d := app._mut_q1_sub(d,
      'if not (app.is_hospital_admin_of(v_comm.hospital_id) or app.is_org_admin_of(v_comm.organization_id)) then',
      'if false then');
    execute d;

  elsif p_what = 'guard_noop' then
    d := pg_get_functiondef('app.guard_commission_oversight()'::regprocedure);
    d := app._mut_q1_sub(d,
      'if new.quality_oversight is distinct from old.quality_oversight and not v_in_rpc then',
      'if false then');
    execute d;

  elsif p_what = 'force_dashboard_helper' then
    execute $q$create or replace function app.can_read_quality_dashboards(p_commission_id uuid)
      returns boolean language sql stable security definer
      set search_path to 'app', 'public', 'pg_catalog'
      as $f$ select true; $f$$q$;

  elsif p_what = 'grant_arm_admits_platform' then
    -- The tidy-up a future reader is most likely to make (w4's admit_platform_admin,
    -- on the quality arm — disambiguated from the DT arm by the raise message).
    d := pg_get_functiondef('app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)'::regprocedure);
    d := app._mut_q1_sub(d,
      'if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception ''apenas o administrador da organização ou do hospital pode designar o revisor da qualidade''',
      'if not (app.is_admin_for(p_actor)
            or app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception ''apenas o administrador da organização ou do hospital pode designar o revisor da qualidade''');
    execute d;

  elsif p_what = 'insert_arm_noop' then
    -- No-op the guard's INSERT arm (lead ruling 2026-08-06): a commission could
    -- again be BORN 'visible' through raw PostgREST — no door, no audit,
    -- platform_admin admitted. 307 §1.3 must notice.
    d := pg_get_functiondef('app.guard_commission_oversight()'::regprocedure);
    d := app._mut_q1_sub(d,
      'if new.quality_oversight is distinct from ''excluded'' and not v_in_rpc then',
      'if false then');
    execute d;

  elsif p_what = 'open_commissions_reviewer_arm' then
    -- The ARM-scoped policy mutation (covers the door-sweep ERROR on this policy:
    -- opening the WHOLE policy breaks the suite's run shape, so the whole-policy
    -- neutralization can't be scored there — ADR 0079 "ERROR is not a pass").
    -- Drop the visibility conjunct: a reviewer would see EXCLUDED commissions' rows.
    declare v_qual text;
    begin
      select pg_get_expr(polqual, polrelid) into v_qual
      from pg_policy where polname = 'commissions_select_member_or_admin';
      v_qual := app._mut_q1_sub(v_qual,
        ' AND (quality_oversight = ''visible''::text)', '');
      execute format(
        'alter policy commissions_select_member_or_admin on public.commissions using (%s)',
        v_qual);
    end;

  elsif p_what = 'open_bytes_cut' then
    -- Delete M8's bytes conjunct: the reviewer would again read un-audited,
    -- PHI-capable case bytes. 308 §5.2 must notice.
    declare v_qual text;
    begin
      select pg_get_expr(polqual, polrelid) into v_qual
      from pg_policy pol join pg_class c on c.oid = pol.polrelid
      join pg_namespace pn on pn.oid = c.relnamespace
      where pn.nspname = 'storage' and c.relname = 'objects'
        and pol.polname = 'attachments_obj_select_readable';
      if v_qual !~ 'read_case_deliberation' then
        raise exception 'MUTATION NO-OP: needle not found -> bytes cut absent from the live policy';
      end if;
      execute format(
        'alter policy attachments_obj_select_readable on storage.objects using (%s)',
        '(bucket_id = ''attachments''::text) AND app.can_read_attachment((storage.foldername(name))[1], ((storage.foldername(name))[2])::uuid, auth.uid())');
    end;

  elsif p_what = 'drop_board_correlation' then
    -- The board's per-commission attribution: drop the lateral's correlation so
    -- every row counts the WHOLE org. 310 §4 exists to catch exactly this, and
    -- its two commissions carry DIFFERENT locked counts so the conflation is
    -- observable (a same-count fixture would stay green).
    d := pg_get_functiondef('public.quality_board_summary(uuid)'::regprocedure);
    d := app._mut_q1_sub(d, 'where ca.commission_id = c.id', 'where true');
    execute d;

  elsif p_what = 'open_write_doors' then
    -- M10.A: revert the D7 exclusion on all three write doors at once.
    declare v_d text; v_f text;
    begin
      foreach v_f in array array['declare_conflict','file_correction_request','record_recusal'] loop
        v_d := pg_get_functiondef((select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                   where n.nspname='public' and p.proname=v_f));
        if v_d !~ 'is_oversight_only_reader' then
          raise exception 'MUTATION NO-OP: % lacks the D7 exclusion', v_f;
        end if;
        v_d := replace(v_d, 'app.is_oversight_only_reader(p_case_id, auth.uid())', 'false');
        v_d := replace(v_d, 'app.is_oversight_only_reader(v_case_id, auth.uid())', 'false');
        execute v_d;
      end loop;
    end;

  elsif p_what = 'open_class2' then
    declare v_d text;
    begin
      v_d := pg_get_functiondef('app.can_read_professional_profile(uuid,uuid)'::regprocedure);
      v_d := app._mut_q1_sub(v_d, 'app.can_read_case_committee(', 'app.can_read_case(');
      execute v_d;
    end;

  elsif p_what = 'open_interviews' then
    declare v_d text;
    begin
      v_d := pg_get_functiondef('app.can_read_interview(uuid,uuid)'::regprocedure);
      v_d := app._mut_q1_sub(v_d, 'app.can_read_case_committee(', 'app.can_read_case(');
      execute v_d;
    end;

  elsif p_what = 'open_action_items' then
    declare v_d text; v_q text;
    begin
      v_d := pg_get_functiondef('app.can_read_action_item(uuid,uuid)'::regprocedure);
      v_d := app._mut_q1_sub(v_d, 'app.can_read_case_committee(', 'app.can_read_case(');
      execute v_d;
      select pg_get_expr(polqual, polrelid) into v_q from pg_policy where polname='action_items_select';
      v_q := app._mut_q1_sub(v_q, 'app.can_read_case_committee(', 'app.can_read_case(');
      execute format('alter policy action_items_select on public.action_items using (%s)', v_q);
    end;

  elsif p_what = 'open_deliberation_policies' then
    declare r record; v_q text;
    begin
      for r in select tablename, policyname, qual from pg_policies
               where schemaname='public' and qual ~ 'can_read_case_committee'
                 and tablename in ('case_votes','case_decisions','ethics_allegations')
      loop
        v_q := replace(r.qual, 'app.can_read_case_committee(', 'app.can_read_case(');
        execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, v_q);
      end loop;
    end;

  elsif p_what = 'open_interview_links' then
    -- M11.A: the 8th family member back onto the widened predicate.
    declare v_q text;
    begin
      select pg_get_expr(polqual, polrelid) into v_q from pg_policy where polname='case_interview_links_select';
      v_q := app._mut_q1_sub(v_q, 'app.can_read_case_committee(', 'app.can_read_case(');
      execute format('alter policy case_interview_links_select on public.case_interview_links using (%s)', v_q);
    end;

  elsif p_what = 'open_interview_attachments' then
    -- M11.B: the 9th - can_read_attachment's interview arm only.
    declare v_d text;
    begin
      v_d := pg_get_functiondef('app.can_read_attachment(text,uuid,uuid)'::regprocedure);
      v_d := app._mut_q1_sub(v_d, 'can_read_case_committee(app.case_of_interview', 'can_read_case(app.case_of_interview');
      execute v_d;
    end;

  elsif p_what = 'drop_grant_read_closure' then
    -- QA r3 MINOR, and the R2 scenario made executable. Remove the S3 read
    -- closure so a manual_grant confers content WITHOUT deliberation. A real
    -- NON-MEMBER grantee is then classified oversight-only by
    -- app.is_oversight_only_reader and silently cut from ~20 surfaces.
    -- 311 section 6.3 must red. NOTE: with the OLD fixture (grantee seeded as
    -- staff of comm_x) the S5 arm supplied deliberation and this case could NOT
    -- have redded - so this mutation also proves the fixture fix landed.
    declare v_d text;
    begin
      v_d := pg_get_functiondef('app._case_caps(uuid,uuid)'::regprocedure);
      v_d := app._mut_q1_sub(v_d,
        'if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit(''read_case_content'')
                       | app._cap_bit(''read_case_deliberation'');',
        'if v_g.read_case_content then
      v_caps := v_caps | app._cap_bit(''read_case_content'');');
      execute v_d;
    end;

  elsif p_what = 'open_resolver_door' then
    -- No-op M9's door conjunct: the reviewer would again resolve a bucket+path
    -- the app signs with service_role — the door-shaped hole beside M8's policy.
    d := pg_get_functiondef('public.open_attachment(uuid)'::regprocedure);
    d := app._mut_q1_sub(d,
      'if v_row.owner_type in (''case'', ''interview'')',
      'if false and v_row.owner_type in (''case'', ''interview'')');
    execute d;

  elsif p_what = 'arm_seventh_door' then
    -- D11 boundary breach: a ROW-LEVEL door acquires the reviewer arm.
    d := pg_get_functiondef('public.dashboard_export_rows(uuid,date,date)'::regprocedure);
    d := app._mut_q1_sub(d,
      'or app.is_tenancy_admin_of(v_commission_id)) then',
      'or app.is_tenancy_admin_of(v_commission_id) or app.can_read_quality_dashboards(v_commission_id)) then');
    execute d;

  else
    raise exception 'unknown mutation %', p_what;
  end if;
end; $m$;
EOF

run_case () {  # $1 = label, $2 = mutation SQL, $3 = expected-red patterns (| sep), $4 = SRC suite
  local label="$1" mut="$2" expect="$3" src="$4"
  local f="$WORK/mutq1.sql" line
  line=$(grep -n "$MARKER" "$src" | head -1 | cut -d: -f1)
  if [ -z "$line" ]; then
    printf '%-52s *** HARNESS ERROR: marker not found in %s ***\n' "$label" "$src"; return
  fi
  { head -n "$line" "$src"; printf '%s\n' "$PRELUDE"; printf '%s\n' "$mut";
    tail -n +$((line+1)) "$src"; } > "$f"
  docker cp "$f" "$DB:/tmp/mutq1.sql" >/dev/null
  local out
  out=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/mutq1.sql 2>&1)
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
  docker exec "$DB" psql -U postgres -d postgres -q -c "drop function if exists app._mut_q1(text); drop function if exists app._mut_q1_sub(text,text,text);" >/dev/null 2>&1
  if [ "${PGTAP_WAS_PRESENT:-0}" = "0" ]; then
    docker exec "$DB" psql -U postgres -d postgres -q -c "drop extension if exists pgtap cascade;" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
docker cp supabase/tests/00_setup.sql "$DB:/tmp/_mutq1_setup.sql" >/dev/null 2>&1
MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -f //tmp/_mutq1_setup.sql >/dev/null 2>&1
if ! docker exec "$DB" psql -U postgres -d postgres -tAc "select 1 from pg_extension where extname='pgtap'" 2>/dev/null | grep -q 1; then
  echo "PREFLIGHT FAILED: pgtap unavailable — every result below would be a false NOT PROVEN. Aborting."; exit 1
fi

# §RESTORE precondition: snapshot every function this audit mutates.
SNAP_SQL="select md5(
  (select string_agg(pg_get_functiondef(p.oid), '' order by p.oid)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where (n.nspname='app' and p.proname in ('_case_caps','is_quality_reviewer_of_for','guard_commission_oversight','can_read_quality_dashboards','grant_role_impl'))
      or (n.nspname='public' and p.proname in ('set_commission_oversight','dashboard_export_rows','open_attachment','quality_board_summary','declare_conflict','file_correction_request','record_recusal')))
  || (select pg_get_expr(polqual, polrelid) from pg_policy where polname='commissions_select_member_or_admin')
  || (select pg_get_expr(polqual, polrelid) from pg_policy where polname='attachments_obj_select_readable'))"
SNAP_BEFORE=$(docker exec "$DB" psql -U postgres -d postgres -tAc "$SNAP_SQL")

echo "=== Q1 MUTATION AUDIT — every keystone must go RED when ITS OWN guarantee is reverted ==="
echo

run_case "strip_s7 -> the reviewer arm evaporates" \
  "select app._mut_q1('strip_s7');" \
  "EXACT MASK|can_read_case projects|FIXTURE HYGIENE|RLS: the reviewer|list_cases_board serves" \
  "supabase/tests/308_case_caps_s7.sql"

run_case "force_reviewer_predicate -> scope boundaries" \
  "select app._mut_q1('force_reviewer_predicate');" \
  "HOSPITAL SCOPE|TENANCY: a foreign-org reviewer gets nothing|EXPIRED: the has_role" \
  "supabase/tests/308_case_caps_s7.sql"

run_case "door_authority -> anyone classifies oversight" \
  "select app._mut_q1('door_authority');" \
  "committee CANNOT classify itself|NOUN RULE|plain staff denied|foreign org admin is denied|nsp_org_admin is not an oversight authority|AUTHORITY FIRST" \
  "supabase/tests/307_commission_oversight.sql"

run_case "guard_noop -> raw column writes sail through" \
  "select app._mut_q1('guard_noop');" \
  "GUARD .*: an org_admin raw PATCH|GUARD: even a superuser write" \
  "supabase/tests/307_commission_oversight.sql"

run_case "insert_arm_noop -> born-visible commissions" \
  "select app._mut_q1('insert_arm_noop');" \
  "INSERT ARM .*: an INSERT carrying .visible. outside the bracket is refused" \
  "supabase/tests/307_commission_oversight.sql"

run_case "force_dashboard_helper -> six doors go permissive" \
  "select app._mut_q1('force_dashboard_helper');" \
  "EXCLUDED COMMISSION .*: opting out closes|TENANCY: a foreign-org reviewer takes zero|EXPIRED: an expired reviewer is no reviewer" \
  "supabase/tests/309_dashboard_quality_arm.sql"

run_case "grant_arm_admits_platform -> the PO ruling" \
  "select app._mut_q1('grant_arm_admits_platform');" \
  "NOUN RULE .*: platform_admin cannot seat a reviewer" \
  "supabase/tests/306_quality_reviewer_role.sql"

run_case "open_commissions_reviewer_arm -> excluded rows leak" \
  "select app._mut_q1('open_commissions_reviewer_arm');" \
  "SHELL .*: the reviewer.s commissions universe|CONSISTENCY .*: opting the last commission out" \
  "supabase/tests/310_quality_board_door.sql"

run_case "open_bytes_cut -> un-audited PHI-capable bytes" \
  "select app._mut_q1('open_bytes_cut');" \
  "BYTES CUT .*: the reviewer reaches ZERO object rows" \
  "supabase/tests/308_case_caps_s7.sql"

run_case "drop_board_correlation -> org-wide counts per row" \
  "select app._mut_q1('drop_board_correlation');" \
  "PER-COMMISSION ATTRIBUTION|LOCKED STAYS PER-ROW" \
  "supabase/tests/310_quality_board_door.sql"

run_case "open_write_doors -> D7 breached at three doors" \
  "select app._mut_q1('open_write_doors');" \
  "D7 DOOR .*: the reviewer CANNOT file_correction_request|D7 DOOR .*: ...cannot declare_conflict|D7 DOOR .*: ...cannot record_recusal" \
  "supabase/tests/308_case_caps_s7.sql"

run_case "open_class2 -> Rule 12 professional identity" \
  "select app._mut_q1('open_class2');" \
  "CLASS-2 .*: the reviewer reads ZERO professional_profiles|CLASS-2: ...and zero professional_participants" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_interviews -> the 7-table interview family" \
  "select app._mut_q1('open_interviews');" \
  "INTERVIEWS .*: can_read_interview is FALSE" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_action_items -> predicate AND policy halves" \
  "select app._mut_q1('open_action_items');" \
  "ACTION ITEMS: the case_restricted arm" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_deliberation_policies -> votes/decisions/ethics" \
  "select app._mut_q1('open_deliberation_policies');" \
  "D4 .*: the reviewer reads ZERO case_decisions|D4 .*: ...zero case_votes|D4 .*: ...zero ethics_allegations" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_interview_links -> the 8th family member" \
  "select app._mut_q1('open_interview_links');" \
  "INTERVIEW FAMILY, 8th MEMBER" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_interview_attachments -> the 9th" \
  "select app._mut_q1('open_interview_attachments');" \
  "INTERVIEW FAMILY, 9th MEMBER" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "drop_grant_read_closure -> S3 content w/o deliberation" \
  "select app._mut_q1('drop_grant_read_closure');" \
  "LATTICE S3 grant: content implies deliberation" \
  "supabase/tests/311_oversight_readonly_perimeter.sql"

run_case "open_resolver_door -> the door beside the policy" \
  "select app._mut_q1('open_resolver_door');" \
  "RESOLVE DOOR .*: the reviewer calling open_attachment" \
  "supabase/tests/308_case_caps_s7.sql"

run_case "arm_seventh_door -> the D11 boundary breach" \
  "select app._mut_q1('arm_seventh_door');" \
  "the three ROW-LEVEL doors carry ZERO trace|takes ZERO rows from dashboard_export_rows" \
  "supabase/tests/270_authz_dashboard_gate_uniformity.sql"

echo
echo "=== RESTORE — the mutated catalog must be byte-identical to the pre-run image ==="
SNAP_AFTER=$(docker exec "$DB" psql -U postgres -d postgres -tAc "$SNAP_SQL")
if [ "$SNAP_BEFORE" = "$SNAP_AFTER" ] && [ -n "$SNAP_BEFORE" ]; then
  echo "RESTORE: OK (md5 $SNAP_AFTER)"
else
  echo "*** RESTORE FAILED — a mutation leaked out of its transaction (before=$SNAP_BEFORE after=$SNAP_AFTER) ***"
fi

echo
echo "=== CONTROL — no mutation: every touched suite GREEN (proves the harness is not a red-generator) ==="
for src in supabase/tests/306_quality_reviewer_role.sql \
           supabase/tests/307_commission_oversight.sql \
           supabase/tests/308_case_caps_s7.sql \
           supabase/tests/309_dashboard_quality_arm.sql \
           supabase/tests/310_quality_board_door.sql \
           supabase/tests/311_oversight_readonly_perimeter.sql \
           supabase/tests/270_authz_dashboard_gate_uniformity.sql; do
  docker cp "$src" "$DB:/tmp/_noop_q1.sql" >/dev/null
  control=$(MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -t -A -f //tmp/_noop_q1.sql 2>&1)
  if echo "$control" | grep -qE "^not ok"; then
    echo "*** CONTROL FAILED — $(basename "$src") has a failing assertion WITHOUT any mutation ***"
    echo "$control" | grep -E "^not ok" | head -5
  else
    ok=$(echo "$control" | grep -cE "^ok")
    echo "CONTROL $(basename "$src"): all green ($ok ok, 0 not ok)"
  fi
done
