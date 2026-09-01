#!/usr/bin/env bash
#
# ⛔ BINDING (AUDIT-DOOR-BLINDNESS P0, ADR 0078 §7.14). WRITE-PATH companion to
# p0-authz-door-audit.sh. That harness audits the READ layer (boolean predicates +
# SELECT/ALL read policies). This one audits the WRITE layer: the value-returning authz
# RAISE-GUARDS (assert_*_writable / assert_referral_*) and the INSERT/UPDATE/DELETE
# policies. Same method, same verdict semantics:
#
#   NEUTRALIZE each write-path authz gate (open it so it grants/allows regardless), run
#   the FULL pgTAP suite end-to-end, and read whether ANY keystone noticed.
#
#   Result: FAIL  -> a keystone asserts THROUGH this gate           = COVERED (good)
#   Result: PASS  -> NO keystone exercises it; opening it is silent = BLIND  (a finding)
#   run-shape != baseline (Files/Tests drop, or Dubious)            = ERROR  (harness bug)
#
# This is the INVERSE of m1/m5/u2 (revert ONE fix, require ONE keystone red). Here we open
# ONE gate and ask the WHOLE SUITE whether ANYONE asserts through it. We mutate the LIVE,
# COMMITTED catalog (never migration text — memory: migration file text is STALE) and run
# `supabase test db`.
#
# ── ARM 1: the authz RAISE-GUARDS — 11, NOT the 7 this header used to claim ─────────
# ⚠ Corrected 2026-08-29, surfaced by the new ARM-DOMAIN line printing `guard=N/11`.
# The 7 documented below are the ORIGINAL set; `GUARD_KEYS` has since gained
# set_commission_oversight, ensure_professional_participant, create_external_participant
# and set_primary_subject without this header moving. ⛔ GUARD_KEYS is the truth — a
# count in a comment is an assertion, and this one was false for four additions.
# These are plpgsql, RETURN a value (uuid / case_referral) AND `raise … '42501'`(or an HC*
# code) on unauthorized. The main door-audit EXCLUDES them from its auto-sweep because a
# blanket body-swap on a value-returning raise-guard risks a NULL-propagation ABORT
# downstream (§7.15). So we neutralize them BESPOKE, hand-written from the captured
# pg_get_functiondef snapshot: remove ONLY the authorization `raise` block(s) while
# PRESERVING the real `return <expr>` AND any non-authz guard (no_data_found lookups,
# workflow-STATE checks like status='draft'). This opens the authz gate while returning
# the correct type — no abort, so a PASS is a true BLIND, not a masked ERROR.
#
#   assert_capa_writable(uuid)            -> void ; drop can_write_capa raise
#   assert_meeting_staff_admin(uuid)      -> uuid ; drop is_staff_admin_of raise; keep return
#   assert_interview_writable(uuid)       -> uuid ; drop can_write_interview raise; keep return
#   assert_rca_writable(uuid)             -> uuid ; drop can_write_rca raise; keep return
#   assert_session_writable(uuid)         -> uuid ; SPECIAL (see below)
#   assert_referral_draft_writable(uuid)  -> case_referral ; drop can_manage_referral_source
#                                           raise; KEEP status='draft' state guard
#   assert_referral_target_acts(uuid,text[]) -> case_referral ; drop can_manage_referral_target
#                                           raise; KEEP status=any(expected) state guard
#
#   ⚠ assert_session_writable is SPECIAL: it has NO direct authz raise — its authz is the
#   DELEGATED final call `return app.assert_interview_writable(v_interview_id)`. If we left
#   that call intact, the (un-neutralized) interview guard would still enforce authz and
#   MASK any session-specific blindness (a false COVERED). So we replace the delegated call
#   with a direct, un-gated commission lookup that returns the SAME value the interview
#   guard would — isolating and opening the SESSION gate. (Flagged for lead review.)
#
#   EXCLUDED as non-authz validators (like the door-audit's is_valid_* config validators):
#     assert_meeting_roster_nonempty, assert_condition_value_codes  — DATA validation, not
#     authorization; opening them proves nothing about an authz keystone.
#
# ── ARM 2: the 33 INSERT/UPDATE/DELETE policies ─────────────────────────────────────
# Neutralize by OPENING the check to `true`:  INSERT -> `with check (true)`;
# DELETE -> `using (true)`; UPDATE -> both. Only the clauses that actually exist are
# touched. A row whose relevant clause is ALREADY `true` is vacuous and SKIPPED (listed).
#
# ── Lessons baked in (mirror p0-authz-door-audit.sh; each HID A REAL RESULT) ─────────
#  §7.15  the assertion that NEVER RAN is a THIRD "green". We guard Files/Tests==baseline
#         and absence of "Dubious"; a shape drift is verdict=ERROR, never a BLIND.
#  §7.1   detect on the SUITE Result:, not `grep '^not ok'`.
#  §7.3   baseline Files/Tests are CAPTURED at preflight (not hardcoded) and MUST be
#         Result: PASS or we abort (a dirty baseline invalidates every case).
#  §7.5   restore is verified: after EVERY case re-fetch pg_get_functiondef / pg_get_expr
#         and BYTE-COMPARE against the captured original; a mismatch is a LOUD abort
#         (a botched restore silently contaminates every later case).
#  §7.2   value, not noun: guards keyed by regprocedure->OID (survives rename); policies by
#         name+table. The embedded snapshot is a DRIFT tripwire, not the restore source.
#
# ── EXIT CODES — four-way, NOT boolean. Read them DIRECTLY; a pipe erases them. ──────
#   0  CLEAN     a NON-EMPTY selection was swept and every case came back COVERED.
#   1  DIRTY     ≥1 BLIND and/or ERROR (also: baseline not green). ⛔ ERROR IS NOT A PASS.
#   2  ABORT     the harness could not run / a restore did not round-trip. Nothing may
#                be concluded.
#   3  UNPROVEN  nothing was measured — zero cases selected, or a CASES token that
#                matched no gate in either arm. ⛔ An UNPROVEN run is NOT a pass.
#
#   ⛔ These were added 2026-08-29 (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Parts 2+3). Before
#   that this file ended on an echo, so EVERY run exited 0 — including the AE1.5 run with
#   13 ERROR and 0 COVERED. Identical semantics to p0-authz-door-audit.sh **on purpose**:
#   two harnesses meant to be halves of one gate must not handle the same shortfall in
#   opposite ways, which is precisely how this survived.
#
# ── Modes ────────────────────────────────────────────────────────────────────────────
#   DRYRUN=1  PRINT every neutralization (guards: full CREATE OR REPLACE; policies: the
#             ALTER POLICY) and EXIT — ZERO DB access. Eyeball the 7 bespoke guards here.
#   CASES="…" subset filter; matches a guard proname OR a policy name (space-separated).
#
# Run from repo root:   bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Dry run:              DRYRUN=1 bash supabase/tests/mutation/p0-authz-writepath-audit.sh
# Subset:               CASES="assert_capa_writable rca_delete" bash .../p0-authz-writepath-audit.sh
#   ⭐ A subset run writes its report + BLIND tsv to SCRATCH under $WORK and NEVER opens
#   the committed findings md for write (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE). There
#   is nothing to `git checkout --` afterwards; older instructions saying otherwise
#   describe the pre-2026-08-26 behaviour.
#
# ⚠ COST: full sweep = one ~23s suite run per guard (7) + per policy (33) = ~15-16 min.
# The LEAD runs the full loop in the background (a background process dies at turn-end).
set -u

DB=supabase_db_azkbbhskturikxpgmafq
# Repo root = three levels up from supabase/tests/mutation/.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORK="${WORK:-${TMPDIR:-/tmp}/authz-audit}"
# ⚠ distinct writepath_* names so this NEVER clobbers the running door-audit's outputs.
PROGRESS="$WORK/writepath_progress.tsv"     # per-case log, written AS WE GO (mid-run kill)
RUNLOGS="$WORK/writepath_runlogs"           # full suite output per case, for forensics
POLWL="$WORK/writepath_worklist_pol.tsv"    # the 33-policy worklist (embedded below)
# ⛔ FIXED path, deliberately NOT under $WORK — see the Part 4 note on the trap below.
# $WORK is fresh per run by recipe, so a $WORK-relative sentinel is invisible to the next
# run and its check would pass vacuously. This one is found by whoever runs next.
SENTINEL="${AUTHZ_SWEEP_SENTINEL:-${TMPDIR:-/tmp}/authz-writepath-INFLIGHT.sql}"
CASES="${CASES:-}"                          # optional subset filter
DRYRUN="${DRYRUN:-0}"
FINDINGS_COMMITTED="$ROOT/docs/reviews/authz-writepath-audit-findings.md"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ A SUBSET RUN MUST NOT WRITE THE COMMITTED BASELINE
#    (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE — fix (a), 2026-08-26; identical in all
#     four p0-authz-*-audit.sh sweeps, which share the defect by construction.)
#
# `emit_report` ends in a TRUNCATING redirect into the file above, which is COMMITTED.
# With `CASES=` set — the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE — that
# redirect replaced the full audit with the subset (measured on the door sweep 2026-08-25:
# 699 lines -> 90). ⛔ Silent AND self-concealing: `FROMFINDINGS=1` arms of
# p0-authz-invariant.sh compare this committed file to an allowlist and RE-MEASURE
# NOTHING, so against a truncated file they see fewer gates, find them all allowlisted,
# and report HOLDS — the arm gets GREENER as the baseline gets EMPTIER.
# ⚠ $BLINDS_TSV moves too: the invariant's non-FROMFINDINGS arm reads
# `$WORK/blinds_writepath.tsv` as a FULL-sweep result. The property is "never overwrite
# the artefact a later arm reads back as a baseline"; committed vs scratch is not part of it.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -n "$CASES" ]; then
  SUBSET_RUN=1
  FINDINGS="$WORK/authz-writepath-audit-findings.SUBSET.md"
  BLINDS_TSV="$WORK/blinds_writepath.SUBSET.tsv"
else
  SUBSET_RUN=0
  FINDINGS="$FINDINGS_COMMITTED"
  BLINDS_TSV="$WORK/blinds_writepath.tsv"
fi


# ⛔ WORKSPACE PRECONDITION — a hard failure, never a warning.
# Until 2026-08-24 the default above was one Windows session's scratchpad path, committed:
# on every other machine `mkdir -p` failed, `set -e` is deliberately off here, and each
# arm's `comm`/`wc` against the missing files produced EMPTY sets — which every arm reads
# as "nothing unaccounted for". The gate printed `INVARIANT HOLDS` and exited 0 having
# measured nothing at all. ⚠ This is CLAUDE.md §6 step 1, so the vacuous pass was wearing
# the badge of a mandatory gate. The default is now TMPDIR-based (matching
# `e2e-prod-gate.sh`), but a bad `WORK=` from the environment would re-create the hole —
# so the WRITABILITY of the directory is asserted, not assumed. Probe, never infer.
if ! mkdir -p "$WORK" 2>/dev/null || ! : > "$WORK/.writable" 2>/dev/null; then
  echo "FATAL: WORK directory is not usable: $WORK" >&2
  echo "       Every arm writes its census/findings there; without it this gate reports" >&2
  echo "       INVARIANT HOLDS having measured NOTHING. Set WORK=<writable dir> and re-run." >&2
  exit 2
fi
rm -f "$WORK/.writable"
mkdir -p "$RUNLOGS"

# THE SECOND LOCK — a different KIND from the first: repointing $FINDINGS states the
# INTENT, this measures the OUTCOME (bytes checksummed now, re-checked on every exit).
baseline_sum () {
  if [ -f "$FINDINGS_COMMITTED" ]; then cksum < "$FINDINGS_COMMITTED"; else echo "ABSENT"; fi
}
BASELINE_SUM="$(baseline_sum)"
verify_baseline_untouched () {   # subset runs only; a mismatch ESCALATES to ABORT (2)
  [ "$SUBSET_RUN" = "1" ] || return 0
  local now; now="$(baseline_sum)"
  if [ "$now" != "$BASELINE_SUM" ]; then
    echo "*** FATAL: the COMMITTED baseline CHANGED during a subset run:" >&2
    echo "      $FINDINGS_COMMITTED" >&2
    echo "    A CASES= run must never write it (FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE)." >&2
    echo "    Restore it and re-run before reading ANY later FROMFINDINGS arm:" >&2
    echo "      git checkout -- $FINDINGS_COMMITTED" >&2
    return 1
  fi
  echo "    committed baseline VERIFIED unchanged (cksum): $FINDINGS_COMMITTED"
  return 0
}
trap 'verify_baseline_untouched || exit 2' EXIT

if [ "$SUBSET_RUN" = "1" ]; then
  echo "--------------------------------------------------------------------------------"
  echo "⚠ SUBSET RUN — CASES=\"$CASES\". This run writes to SCRATCH, never to the baseline."
  echo "    subset report : $FINDINGS"
  echo "    subset BLINDs : $BLINDS_TSV"
  echo "    COMMITTED baseline is NOT opened for write and stays UNTOUCHED:"
  echo "      $FINDINGS_COMMITTED"
  echo "    ⛔ A FROMFINDINGS arm does NOT cover this run: it re-measures nothing and reads"
  echo "       the COMMITTED file, which this run deliberately did not update."
  echo "    To fold these verdicts in, MERGE them into the baseline (ADR 0079 Amendment 1)"
  echo "    — never copy the subset file over it."
  echo "--------------------------------------------------------------------------------"
else
  BASELINE_ANNOTATIONS=$(grep -cE '^(<!--|## Note)' "$FINDINGS_COMMITTED" 2>/dev/null | tr -d '[:space:]')
  if [ "${BASELINE_ANNOTATIONS:-0}" != "0" ]; then
    echo "⚠ FULL SWEEP — the committed baseline carries ${BASELINE_ANNOTATIONS} HAND-ADDED block(s)"
    echo "  (\`<!-- … -->\` merge notes / \`## Note …\` sections) this generator does NOT emit."
    echo "  The truncating redirect REPLACES the whole file, so this run drops them. Re-merge"
    echo "  from \`git show HEAD:docs/reviews/authz-writepath-audit-findings.md\` before committing."
  fi
fi

psql_c () { MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -tA -P pager=off "$@"; }
# Run an SQL file inside the container (avoids all shell-quoting of quals/bodies).
psql_f () {
  local host="$1"
  docker cp "$host" "$DB:/tmp/_wp_p0mut.sql" >/dev/null
  MSYS_NO_PATHCONV=1 docker exec "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f //tmp/_wp_p0mut.sql 2>&1
}
slug () { echo "$1" | tr -c 'A-Za-z0-9_' '_' ; }

want () {  # $1 = match key (guard proname or policy name); 0 if in CASES (or CASES empty)
  [ -z "$CASES" ] && return 0
  local k
  for k in $CASES; do [ "$k" = "$1" ] && return 0; done
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 data: the 7 guards. Keyed by proname. guard_sig -> the regprocedure identity used
# to resolve the OID (value, not noun — survives rename). emit_neut_guard -> the FULL
# hand-written neutralized CREATE OR REPLACE, header copied BYTE-FOR-BYTE from the
# pg_get_functiondef snapshot (⚠ assert_meeting_staff_admin is STABLE and NOT SECURITY
# DEFINER — do not "fix" it), body with the authz raise removed.
# ─────────────────────────────────────────────────────────────────────────────────────
GUARD_KEYS="assert_capa_writable assert_meeting_staff_admin assert_interview_writable assert_rca_writable assert_session_writable assert_referral_draft_writable assert_referral_target_acts set_commission_oversight ensure_professional_participant create_external_participant set_primary_subject"

guard_sig () {
  case "$1" in
    assert_capa_writable)           echo "app.assert_capa_writable(uuid)";;
    assert_meeting_staff_admin)     echo "app.assert_meeting_staff_admin(uuid)";;
    assert_interview_writable)      echo "app.assert_interview_writable(uuid)";;
    assert_rca_writable)            echo "app.assert_rca_writable(uuid)";;
    assert_session_writable)        echo "app.assert_session_writable(uuid)";;
    assert_referral_draft_writable) echo "app.assert_referral_draft_writable(uuid)";;
    assert_referral_target_acts)    echo "app.assert_referral_target_acts(uuid,text[])";;
    # QO·A (ADR 0100 D9; Amendment 5 frozen-list scope-in): the oversight door is a
    # raise-guard-shaped write door — its 42501 authority block is the whole boundary.
    set_commission_oversight)       echo "public.set_commission_oversight(uuid,text)";;
    # ETH·E4 (ADR 0108). Three write doors whose 42501/HC0E4 authority block IS the
    # whole boundary. They are scoped in here because NO other arm can see them:
    # ARM=census's domain is `prosecdef` functions returning bool or rows, and these
    # return uuid/void (FUP-AFF-1 / ADR 0079 Amendment 5); the door audit's predicate
    # arm is boolean-only for the same reason. Without these entries their coverage
    # was one-time and by hand, not standing.
    ensure_professional_participant) echo "public.ensure_professional_participant(uuid)";;
    create_external_participant)     echo "public.create_external_participant(uuid,text,text)";;
    set_primary_subject)             echo "public.set_primary_subject(uuid)";;
    *) echo "";;
  esac
}

emit_neut_guard () {
  case "$1" in
    assert_capa_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_capa_writable(p_capa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_capa gate opened).
end;
$function$;
SQL
    ;;
    assert_meeting_staff_admin) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_meeting_staff_admin(p_meeting_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.is_staff_admin_of gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_interview_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_interview_writable(p_interview_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id
  from public.case_interviews where id = p_interview_id;
  if v_commission_id is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_interview gate opened); return kept.
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_rca_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_rca_writable(p_rca_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.rca where id = p_rca_id;
  if v_event_id is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_write_rca gate opened); return kept.
  return v_event_id;
end;
$function$;
SQL
    ;;
    assert_session_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_session_writable(p_session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_interview_id uuid;
  v_commission_id uuid;
begin
  select interview_id into v_interview_id
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  -- P0-WRITEPATH-NEUT (SPECIAL): the original body's ONLY authz is the delegated call
  -- `return app.assert_interview_writable(v_interview_id)`. Leaving it intact would let the
  -- un-neutralized interview guard enforce authz and MASK session blindness. We replace it
  -- with a direct, un-gated commission lookup returning the SAME value -> the session gate
  -- is isolated and opened.
  select commission_id into v_commission_id
  from public.case_interviews where id = v_interview_id;
  return v_commission_id;
end;
$function$;
SQL
    ;;
    assert_referral_draft_writable) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_draft_writable(p_referral_id uuid)
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_source gate opened);
  -- the non-authz workflow-STATE guard (status = 'draft') is PRESERVED.
  if v_referral.status <> 'draft' then
    raise exception 'o encaminhamento não está em rascunho' using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    assert_referral_target_acts) cat <<'SQL'
CREATE OR REPLACE FUNCTION app.assert_referral_target_acts(p_referral_id uuid, p_expected text[])
 RETURNS case_referral
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  -- P0-WRITEPATH-NEUT: authz raise removed (app.can_manage_referral_target gate opened);
  -- the non-authz workflow-STATE guard (status = any(p_expected)) is PRESERVED.
  if not (v_referral.status = any (p_expected)) then
    raise exception 'o encaminhamento não está no estado necessário para esta ação'
      using errcode = 'HC070';
  end if;
  return v_referral;
end;
$function$;
SQL
    ;;
    set_commission_oversight) cat <<'SQL'
CREATE OR REPLACE FUNCTION public.set_commission_oversight(p_commission_id uuid, p_oversight text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_comm public.commissions;
begin
  select * into v_comm from public.commissions where id = p_commission_id;
  if v_comm.id is null then
    raise exception 'comissão não encontrada' using errcode = 'P0002';
  end if;

  -- P0-WRITEPATH-NEUT: authz raise removed (the is_hospital_admin_of OR
  -- is_org_admin_of 42501 block — ADR 0100 D9 — opened). Validation, the GUC
  -- bracket and the audit verb are PRESERVED (non-authz workflow).
  if p_oversight is null or p_oversight not in ('visible', 'excluded') then
    raise exception 'classificação de supervisão inválida' using errcode = 'HC0L0';
  end if;

  perform set_config('app.in_commission_rpc', 'on', true);
  update public.commissions set quality_oversight = p_oversight where id = p_commission_id;
  perform set_config('app.in_commission_rpc', 'off', true);

  perform app.audit_write('commission.oversight_changed', 'commission', p_commission_id, p_commission_id,
    'Supervisão da qualidade alterada',
    jsonb_build_object(
      'quality_oversight', p_oversight,
      'previous_quality_oversight', v_comm.quality_oversight));
end;
$function$;
SQL
    ;;
    # ─────────────────────────────────────────────────────────────────────────────
    # ETH·E4 doors. These three are neutralized from the LIVE CATALOG rather than
    # from a transcribed heredoc, deliberately: every other case above pins a full
    # body, which silently goes stale the moment the door is edited, and a stale
    # body reads as `ERROR run-shape!=baseline` (or, worse, as a false COVERED
    # because the suite failed for the wrong reason). Fetching `pg_get_functiondef`
    # and excising ONLY the authority raise keeps the neutralization faithful no
    # matter how the body evolves — and the splice ASSERTS it matched, so a renamed
    # gate aborts loudly instead of neutralizing nothing and reporting BLIND.
    # Restore is unaffected: the harness restores the bytes it captured beforehand.
    ensure_professional_participant|create_external_participant|set_primary_subject)
      case "$1" in
        ensure_professional_participant)
          sig='public.ensure_professional_participant(uuid)'
          gate='if not app.can_manage_professional(v_prof.organization_id, auth.uid()) then' ;;
        create_external_participant)
          sig='public.create_external_participant(uuid,text,text)'
          gate='if not app.can_manage_professional(p_org, auth.uid()) then' ;;
        set_primary_subject)
          sig='public.set_primary_subject(uuid)'
          gate='if not (app.is_staff_admin_of(v_commission)) then' ;;
      esac
      cat <<SQL
do \$neut\$
declare v text;
begin
  select pg_get_functiondef('${sig}'::regprocedure) into v;
  -- P0-WRITEPATH-NEUT: open the authority gate (\`if false\` ⇒ the raise is dead).
  v := replace(v, '${gate}', 'if false then');
  if position('if false then' in v) = 0 then
    raise exception 'writepath neutralization did not match for ${sig} — the gate text '
                    'changed; fix guard_sig/emit_neut_guard rather than reporting a verdict';
  end if;
  execute v;
end
\$neut\$;
SQL
      ;;
    *) echo "-- unknown guard: $1" ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 data: the 33 write policies (captured snapshot, embedded self-contained).
# Pipe-delimited (no '|' occurs in any qual/with_check of these 33); '-' = clause absent.
# Columns:  tbl | polname | cmd | qual | with_check
# At runtime we DRIFT-CHECK each live pg_get_expr against these snapshot values (ERROR on
# mismatch); the restore source is the live capture, not the snapshot.
# ─────────────────────────────────────────────────────────────────────────────────────
write_worklist_pol () {
  cat > "$POLWL" <<'TSV'
capa_plan|capa_plan_delete|DELETE|app.can_write_capa(id, auth.uid())|-
capa_plan|capa_plan_update|UPDATE|app.can_write_capa(id, auth.uid())|app.can_write_capa(id, auth.uid())
case_interviews|case_interviews_delete|DELETE|app.can_write_interview(id, ( SELECT auth.uid() AS uid))|-
case_interviews|case_interviews_insert|INSERT|-|(app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(case_id, ( SELECT auth.uid() AS uid))))
case_interviews|case_interviews_update|UPDATE|app.can_write_interview(id, ( SELECT auth.uid() AS uid))|app.can_write_interview(id, ( SELECT auth.uid() AS uid))
case_referral|case_referral_delete_draft_source|DELETE|((status = 'draft'::text) AND app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)))|-
case_referral|case_referral_insert_source_coord|INSERT|-|app.is_staff_admin_of_for(source_commission_id, ( SELECT auth.uid() AS uid))
case_referral|case_referral_update_coord|UPDATE|(app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)) OR app.can_manage_referral_target(id, ( SELECT auth.uid() AS uid)))|(app.can_manage_referral_source(id, ( SELECT auth.uid() AS uid)) OR app.can_manage_referral_target(id, ( SELECT auth.uid() AS uid)))
meeting_agenda_items|meeting_agenda_items_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_agenda_items|meeting_agenda_items_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_agenda_items|meeting_agenda_items_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_delete|DELETE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|-
meeting_attendees|meeting_attendees_staff_admin_insert|INSERT|-|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_attendees|meeting_attendees_staff_admin_update|UPDATE|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))|app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
meeting_cases|meeting_cases_staff_admin_delete|DELETE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))|-
meeting_cases|meeting_cases_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))
meeting_cases|meeting_cases_staff_admin_update|UPDATE|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))|(app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( SELECT auth.uid() AS uid)))
meeting_signatures|meeting_signatures_insert|INSERT|-|((signer_id = ( SELECT auth.uid() AS uid)) AND app.can_sign_meeting(attendee_id, ( SELECT auth.uid() AS uid)))
meetings|meetings_staff_admin_delete|DELETE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|-
meetings|meetings_staff_admin_insert|INSERT|-|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
meetings|meetings_staff_admin_update|UPDATE|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))|(app.is_staff_admin_of(commission_id) OR app.member_can(commission_id, 'schedule_meetings'::text))
notification_preferences|notification_preferences_insert_own|INSERT|-|(user_id = ( SELECT auth.uid() AS uid))
notification_preferences|notification_preferences_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
notifications|notifications_update_own|UPDATE|(user_id = ( SELECT auth.uid() AS uid))|(user_id = ( SELECT auth.uid() AS uid))
profiles|profiles_admin_insert|INSERT|-|app.is_admin()
profiles|profiles_admin_update|UPDATE|app.is_admin()|app.is_admin()
profiles|profiles_update_self|UPDATE|(id = ( SELECT auth.uid() AS uid))|(id = ( SELECT auth.uid() AS uid))
rca|rca_delete|DELETE|app.can_write_rca(id, auth.uid())|-
rca|rca_update|UPDATE|app.can_write_rca(id, auth.uid())|app.can_write_rca(id, auth.uid())
response_section_signoffs|signoffs_insert|INSERT|-|((signed_by = ( SELECT auth.uid() AS uid)) AND app.can_sign_section(response_id, section_id, ( SELECT auth.uid() AS uid)))
responses|responses_delete_own_draft|DELETE|((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'in_progress'::text))|-
responses|responses_insert_own|INSERT|-|((created_by = ( SELECT auth.uid() AS uid)) AND app.is_member_of(commission_id))
responses|responses_update_own_draft|UPDATE|((created_by = ( SELECT auth.uid() AS uid)) AND (status = 'in_progress'::text))|(created_by = ( SELECT auth.uid() AS uid))
TSV
}

# ─────────────────────────────────────────────────────────────────────────────────────
# DRYRUN — print every neutralization, ZERO DB access. Print BEFORE any preflight so the
# lead can eyeball the 7 bespoke guard bodies without a running stack.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ "$DRYRUN" = "1" ]; then
  write_worklist_pol
  echo "=== DRYRUN — neutralizations only, NO DB ACCESS ==="
  echo
  echo "############## ARM 1: 7 authz raise-guards (full neutralized CREATE OR REPLACE) ##############"
  for k in $GUARD_KEYS; do
    want "$k" || continue
    echo
    echo "===== $k  ->  $(guard_sig "$k") ====="
    emit_neut_guard "$k"
  done
  echo
  echo "############## ARM 2: write policies (ALTER POLICY opening the check) ##############"
  while IFS='|' read -r tbl polname cmd qual wc; do
    [ -z "$tbl" ] && continue
    case "$tbl" in \#*) continue;; esac
    want "$polname" || continue
    haveq=0; havew=0
    [ "$qual" != "-" ] && haveq=1
    [ "$wc"   != "-" ] && havew=1
    # vacuous?
    vac=1
    { [ "$haveq" = 1 ] && [ "$qual" != "true" ]; } && vac=0
    { [ "$havew" = 1 ] && [ "$wc"   != "true" ]; } && vac=0
    if [ "$vac" = 1 ]; then
      printf -- '-- SKIP (vacuous, clause already true): %s.%s (%s)\n' "$tbl" "$polname" "$cmd"
      continue
    fi
    stmt="alter policy \"$polname\" on public.\"$tbl\""
    [ "$haveq" = 1 ] && stmt="$stmt using (true)"
    [ "$havew" = 1 ] && stmt="$stmt with check (true)"
    printf '%s;   -- %s\n' "$stmt" "$cmd"
  done < "$POLWL"
  echo
  echo "=== DRYRUN done. Guards printed: $(printf '%s
' $GUARD_KEYS | grep -c .) (2 excluded: assert_meeting_roster_nonempty,"
  echo "    assert_condition_value_codes = data validators). Policies: see above. ==="
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# LIVE run.  Restore-on-exit trap (§7.5 shared-stack single-owner): a kill mid-run must
# not leave a gate OPEN. INFLIGHT points at the SQL that restores the current gate; cleared
# the instant its inline restore verifies. Set BEFORE neutralizing/opening.
# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ This initializer must NOT touch $SENTINEL. A crashed previous run's sentinel is the
# ONLY evidence that a gate is open, and clearing it here would erase that evidence before
# the startup check above ever read it — a control deleting its own witness. The sentinel
# is removed at exactly one kind of moment: after a restore has been applied.
INFLIGHT=""
restore_inflight () {
  if [ -n "${INFLIGHT:-}" ] && [ -f "$INFLIGHT" ]; then
    echo "  (EXIT trap: restoring in-flight gate from $INFLIGHT)"
    psql_f "$INFLIGHT" >/dev/null 2>&1
    # Only drop the crash sentinel once the restore has actually been attempted.
    cp -f "$INFLIGHT" "$SENTINEL.attempted" 2>/dev/null || true
    rm -f "$SENTINEL" 2>/dev/null || true
  fi
}
# ⚠ compound: this REPLACES the baseline-guard trap installed above, so it must carry
# that duty too, or a subset run loses its outcome check from here on.
#
# ⛔ PART 4 (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED), measured the hard way 2026-08-27: a run
# KILLED between "open the gate" and "restore it" does not run an EXIT-only trap. AE1.5
# killed a contaminated run and left `meeting_cases.meeting_cases_staff_admin_update` at
# `qual=true wc=true` — a FOR UPDATE policy fully open to `authenticated` on the shared
# local stack, with NOTHING ANYWHERE REPORTING IT. It was recovered by `supabase db reset`
# and was nearly missed by a count: the degenerate-policy check returned 11, of which ten
# are `qual = true` BY DESIGN (vocabulary SELECT policies). Only ENUMERATING them showed
# the eleventh was an UPDATE policy with `wc=true`, which no lookup table has.
#
# TWO layers, because neither alone is enough:
#  1. Trap INT/TERM/HUP as well as EXIT. Covers Ctrl-C and an ordinary `kill`, which is
#     what "killed a contaminated run" actually means in practice.
#  2. A CRASH SENTINEL at a FIXED path (below), written BEFORE each gate is opened and
#     removed only after its restore verifies. SIGKILL and a power cut run no trap at all;
#     the sentinel is what survives them, and the next run REFUSES TO START while one
#     exists. That turns "an RLS policy is open and nothing reports it" into a loud stop.
# ⚠ The sentinel path must NOT live under $WORK: the recipe hands out a fresh
#   `WORK=…/authz-audit-$(date +%s)` per run, so a $WORK-relative sentinel would be
#   invisible to the very next run — the check would pass vacuously.
trap 'restore_inflight; verify_baseline_untouched || exit 2' EXIT
trap 'echo; echo "*** SIGNAL — restoring the in-flight gate before exiting (§7.5 Part 4)."; restore_inflight; exit 2' INT TERM HUP

run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }   # echoes raw suite output; ~23s

# classify OUTPUT -> sets globals VERDICT, FAILING, RUNFILES, RUNTESTS
classify () {
  local out="$1" res ft dubious
  res=$(echo "$out" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
  ft=$(echo "$out" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
  RUNFILES=$(echo "$ft" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
  RUNTESTS=$(echo "$ft" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
  dubious=$(echo "$out" | grep -ciE 'Dubious|Bail out|Bad plan')
  FAILING=$(echo "$out" | grep -E '\.sql .*Failed: [1-9]' \
            | grep -oE '[0-9A-Za-z_]+\.sql' | sort -u | paste -sd, -)
  # §7.15: a run whose SHAPE differs from baseline (fewer files/tests, or Dubious) is an
  # ABORT — a harness bug (bad neutralization), NOT a BLIND/COVERED result.
  if [ -z "$res" ] || [ "$RUNFILES" != "$BASE_FILES" ] || [ "$RUNTESTS" != "$BASE_TESTS" ] || [ "$dubious" -gt 0 ]; then
    VERDICT="ERROR"
  elif [ "$res" = "FAIL" ]; then
    VERDICT="COVERED"
  elif [ "$res" = "PASS" ]; then
    VERDICT="BLIND"
  else
    VERDICT="ERROR"
  fi
}

echo "=== P0 AUTHZ WRITE-PATH AUDIT — open each write gate, ask the WHOLE SUITE if anyone noticed ==="
echo "Repo: $ROOT"

# ─────────────────────────────────────────────────────────────────────────────────────
# ⛔ PART 4 — THE CRASH-SENTINEL CHECK. Runs FIRST, before the domain gate and long
# before any suite run: if the previous run died without restoring, an RLS policy or a
# raise-guard is OPEN RIGHT NOW on the shared local stack and nothing else will say so.
# ⛔ Refusing is the point. Sweeping on top of a contaminated catalog produces verdicts
# that look ordinary — the neutralization "worked", the suite ran, a number came out.
# ─────────────────────────────────────────────────────────────────────────────────────
if [ -s "$SENTINEL" ]; then
  if [ "${RECOVER:-0}" = "1" ]; then
    echo "--- RECOVER=1: applying the abandoned restore from $SENTINEL ---"
    sed -n '1,40p' "$SENTINEL"
    if psql_f "$SENTINEL"; then
      mv -f "$SENTINEL" "$SENTINEL.recovered" 2>/dev/null || rm -f "$SENTINEL"
      echo "*** RESTORE APPLIED. ⚠ VERIFY IT, do not take this message as proof — re-read the"
      echo "    gate from the catalog (pg_policies / pg_get_functiondef). If in any doubt run"
      echo "    'supabase db reset', which is what recovered the AE1.5 incident."
      echo "    ⛔ Then re-run the sweep from scratch: every verdict from the killed run is void."
      exit 2
    fi
    echo "*** RESTORE FAILED. The gate is STILL OPEN. Run 'supabase db reset' now." >&2
    exit 2
  fi
  echo "*** ABORT — A PREVIOUS RUN DIED WITH A GATE STILL OPEN." >&2
  echo "    Sentinel: $SENTINEL" >&2
  echo "    It holds the SQL that restores it. The gate it names has been OPEN to" >&2
  echo "    'authenticated' on this stack since that run died." >&2
  sed -n '1,12p' "$SENTINEL" | sed 's/^/      | /' >&2
  echo "    Do ONE of:" >&2
  echo "      RECOVER=1 bash $0        # apply that restore, then VERIFY it in the catalog" >&2
  echo "      supabase db reset        # the blunt, certain option (recovered the AE1.5 incident)" >&2
  echo "    ⛔ Do not delete the sentinel to get past this. It is the only record that a" >&2
  echo "       gate is open; removing it restores nothing and re-hides the hole." >&2
  echo "    ⚠ Do not look for the open policy with a COUNT: the degenerate-policy check" >&2
  echo "      returns 11 on a clean tree, ten of them 'qual = true' BY DESIGN. Enumerate." >&2
  exit 2
fi

# ─────────────────────────────────────────────────────────────────────────────────────
# §7.17 THE DOMAIN GATE — PORTED VERBATIM IN SEMANTICS FROM p0-authz-door-audit.sh.
# (FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Parts 2 + 3, both measured 2026-08-27 on AE1.5.)
#
# ⛔ WHAT WAS WRONG, stated so nobody "simplifies" this back out:
#  Part 2 — this harness printed `BLIND: 0  ERROR(harness): 13  SKIPPED: 0` and EXITED 0
#    having measured ZERO of the 22 requested write-layer cases. CLAUDE.md §6 step 1 says
#    in terms that "ERROR is not a pass", and the exit code said pass. That is the
#    "a gate that never SETS a non-zero exit" mechanism: the file simply ended on an echo.
#  Part 3 — worse. A CASES token ABSENT from the embedded worklist was silently ignored:
#    no ERROR, no warning, no mention in the summary. The harness could not distinguish
#    "I swept your case" from "your case is not in my worklist", AND REPORTED THE SECOND
#    AS THE FIRST — so handing it 52 cases and getting `13 COVERED, exit 0` read as
#    coverage of 52. Nine policies live in neither arm's domain and were found only
#    because the SIBLING refuses to end CLEAN; grepping this file for `never swept` /
#    `matched no gate` / `requested but` returned ZERO hits.
#
# ⛔ The sibling already did this correctly, so this is a PORT, not a second scheme (the
# FUP says so in terms). Same vocabulary, same exit codes, same closing sentence.
#
# The worklist is materialised HERE, ahead of the preflight, so an UNPROVEN run costs
# seconds rather than a full suite run — `write_worklist_pol` is a heredoc, zero DB access.
# ─────────────────────────────────────────────────────────────────────────────────────
write_worklist_pol

GUARD_TOTAL=0; GUARD_SEL=0
for g in $GUARD_KEYS; do
  GUARD_TOTAL=$((GUARD_TOTAL + 1))
  want "$g" && GUARD_SEL=$((GUARD_SEL + 1))
done
POL_TOTAL=0; POL_SEL=0
while IFS='|' read -r _tbl _pol _cmd _q _w; do
  [ -n "${_pol:-}" ] || continue
  POL_TOTAL=$((POL_TOTAL + 1))
  want "$_pol" && POL_SEL=$((POL_SEL + 1))
done < "$POLWL"
SEL_TOTAL=$((GUARD_SEL + POL_SEL))

echo "--- domain: what this run will actually look at (§7.17) ---"
echo "ARM-DOMAIN guard=$GUARD_SEL/$GUARD_TOTAL policy=$POL_SEL/$POL_TOTAL"
echo "    guard  arm: $GUARD_SEL selected of $GUARD_TOTAL in domain"
echo "    policy arm: $POL_SEL selected of $POL_TOTAL in domain"
echo "    ⚠ The policy arm's domain is an EMBEDDED SNAPSHOT, not the live catalog. A write"
echo "      policy that exists but is not in it is OUTSIDE this arm entirely — that is the"
echo "      nine-policy hole of FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 3, an apparatus"
echo "      gap and not a defect in those policies. 'Outside the domain' != 'unswept by"
echo "      everything', and it is certainly not 'covered'."

# ⚠ -F -x = EXACT string equality, deliberately identical to `want()`'s [ "$k" = "$1" ].
# A regex match here would disagree with the selector and could call a token "matched"
# that `want` never selects — a hole of exactly the kind being closed.
UNMATCHED=""
if [ -n "$CASES" ]; then
  for tok in $CASES; do
    if printf '%s\n' $GUARD_KEYS | grep -qxF "$tok"; then continue; fi
    if cut -d'|' -f2 "$POLWL" | grep -qxF "$tok"; then continue; fi
    UNMATCHED="$UNMATCHED $tok"
  done
fi
if [ -n "$UNMATCHED" ]; then
  echo
  echo "*** REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM:"
  for tok in $UNMATCHED; do
    safe=$(printf '%s' "$tok" | tr -cd 'A-Za-z0-9_')
    diag=$(psql_c -c "select coalesce((select string_agg(
                'POLICY '||schemaname||'.'||tablename||' FOR '||cmd, '; ')
              from pg_policies where policyname = '$safe'),
             (select string_agg(distinct n.nspname||'.'||p.proname||' -> '||t.typname||
                case when p.prosecdef then ' [SECURITY DEFINER]' else ' [INVOKER]' end, '; ')
              from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              join pg_type t on t.oid=p.prorettype
              where n.nspname in ('app','public','authz') and p.proname = '$safe'),
             '(no policy and no app/public function of this name)');" 2>/dev/null | head -1)
    echo "      $tok: ${diag:-(catalog unavailable)}"
  done
  echo "    ⛔ A gate named here was NOT swept, and until this port it was not even"
  echo "    mentioned. If the line above says 'POLICY … FOR INSERT|UPDATE|DELETE', the"
  echo "    policy is real and simply absent from the embedded worklist — record it"
  echo "    against FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED Part 3. Do NOT hand-write a"
  echo "    COVERED row anywhere. ⚠ Bound any worklist fix by the PROPERTY (write-command"
  echo "    policies absent from the snapshot), never by the nine names the FUP lists —"
  echo "    that list is there so a grep lands, not so it can be swept."
  echo "    ⇒ This run can no longer end CLEAN: whatever it measures, part of what was"
  echo "      ASKED FOR was not measured. Final result will be UNPROVEN (3) or DIRTY (1)."
fi

# Nothing selected at all -> stop HERE, before the baseline. Nothing is neutralized, the
# suite is not run, and the findings file is not rewritten.
if [ "$SEL_TOTAL" -eq 0 ]; then
  echo
  echo "=== RESULT: UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass. ==="
  echo "    Selected cases: 0 (guard=$GUARD_SEL, policy=$POL_SEL)${CASES:+ from CASES=\"$CASES\"}."
  echo "    A sweep of zero gates cannot distinguish 'no blind gate' from 'no gate looked"
  echo "    at', so this run deliberately does NOT print a BLIND/ERROR count."
  echo "    Nothing was neutralized; the baseline suite was NOT run; the COMMITTED baseline"
  echo "    $FINDINGS_COMMITTED is UNTOUCHED."
  echo "    Fix the SELECTION (or widen/annotate the arm's domain) and re-run."
  exit 3
fi
echo

echo "--- preflight: capturing GREEN baseline (§7.3 assert the state) ---"
BASE_OUT=$(run_suite)
BASE_RES=$(echo "$BASE_OUT" | grep -oE 'Result: (PASS|FAIL)' | tail -1 | awk '{print $2}')
BASE_FT=$(echo "$BASE_OUT" | grep -oE 'Files=[0-9]+, Tests=[0-9]+' | tail -1)
BASE_FILES=$(echo "$BASE_FT" | grep -oE 'Files=[0-9]+' | grep -oE '[0-9]+')
BASE_TESTS=$(echo "$BASE_FT" | grep -oE 'Tests=[0-9]+' | grep -oE '[0-9]+')
if [ "$BASE_RES" != "PASS" ]; then
  echo "*** PREFLIGHT FAILED: baseline is NOT green (Result: ${BASE_RES:-<none>}). A dirty"
  echo "    baseline invalidates every case (a COVERED can't be told from a pre-existing red)."
  echo "    Fix the tree to green before auditing. Aborting."; exit 1
fi
echo "baseline OK: Result: PASS, Files=$BASE_FILES, Tests=$BASE_TESTS"
echo

# (write_worklist_pol moved ABOVE the preflight with the §7.17 domain gate — an UNPROVEN
#  run must cost seconds, not a full suite run. Do not re-add a call here: the counts the
#  final verdict prints were taken from that materialisation, and a second write would
#  make the domain line and the sweep describe two different files.)
: > "$PROGRESS"

# Regenerate the two deliverables from writepath_progress.tsv after EVERY case so a
# mid-run kill still leaves a coherent partial report.
emit_report () {
  {
    echo "# AUTHZ Write-Path Door-Blindness Audit — Findings"
    echo
    echo "AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14) — WRITE-PATH arm. Generated by"
    echo "\`supabase/tests/mutation/p0-authz-writepath-audit.sh\`. Companion to the read/door"
    echo "audit. Method: open each write-path authz gate (raise-guard authz raise removed, or"
    echo "policy check set to \`true\`), run the FULL pgTAP suite, read \`Result:\`."
    echo "**COVERED** = suite went \`FAIL\` (a keystone asserts the gate denies an unauthorized"
    echo "writer). **BLIND** = suite stayed \`PASS\` (no keystone exercises it — a work-list item)."
    echo "**ERROR** = run shape != baseline (harness bug: fix the neutralization, not a result)."
    echo
    echo "Baseline: Files=$BASE_FILES, Tests=$BASE_TESTS, Result: PASS."
    echo "Arm 1 guards: $GUARD_TOTAL (excluded non-authz validators: \`assert_meeting_roster_nonempty\`,"
    echo "\`assert_condition_value_codes\`). Arm 2 write policies: from the embedded snapshot."
    if [ -n "$CASES" ]; then echo; echo "> ⚠ PARTIAL RUN — CASES=\"$CASES\" (subset, not the full sweep)."; fi
    echo
    echo "## BLIND — the work-list (no keystone exercises these)"
    echo
    echo "| gate / policy | arm | direction | verdict | note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4=="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
    echo
    echo "## COVERED (asserted-through) + ERROR (harness bug) + SKIPPED (vacuous)"
    echo
    echo "| gate / policy | arm | direction | verdict | failing files / note |"
    echo "|---|---|---|---|---|"
    awk -F'\t' '$4!="BLIND"{printf "| %s | %s | %s | %s | %s |\n",$2,$1,$3,$4,$5}' "$PROGRESS"
  } > "$FINDINGS"

  { echo -e "arm\tgate\tdirection\tfailing_or_note";
    awk -F'\t' '$4=="BLIND"{printf "%s\t%s\t%s\t%s\n",$1,$2,$3,$5}' "$PROGRESS"; } > "$BLINDS_TSV"
}

record () {  # arm gate direction verdict failing
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$PROGRESS"
  emit_report
}

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 1 — authz RAISE-GUARDS (bespoke neutralization)
# ─────────────────────────────────────────────────────────────────────────────────────
echo "=== ARM 1: authz raise-guards ==="
for k in $GUARD_KEYS; do
  want "$k" || continue
  sig="$(guard_sig "$k")"
  oid=$(psql_c -c "select '$sig'::regprocedure::oid" 2>&1)
  if ! echo "$oid" | grep -qE '^[0-9]+$'; then
    record "guard" "$sig" "authz-open" "ERROR" "OID lookup failed: $(echo "$oid" | tr '\n' ' ' | head -c 120)"
    echo "  ERROR  $sig (oid lookup)"; continue
  fi

  orig="$WORK/orig_wp_guard_$k.sql"
  psql_c -c "select pg_get_functiondef($oid)" > "$orig"   # exact bytes for restore + verify
  INFLIGHT="$orig"                                          # arm the trap before opening
  cp -f "$orig" "$SENTINEL"   # Part 4: survives SIGKILL, which no trap does

  emit_neut_guard "$k" > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "guard" "$sig" "authz-open" "ERROR" "neutralize failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    psql_f "$orig" >/dev/null 2>&1; INFLIGHT=""; rm -f "$SENTINEL" 2>/dev/null
    echo "  ERROR  $sig (neutralize failed)"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/guard_$k.log"
  classify "$out"

  # RESTORE exact original bytes + VERIFY round-trip (§7.5 contamination guard)
  psql_f "$orig" >/dev/null 2>&1
  now=$(psql_c -c "select pg_get_functiondef($oid)")
  if [ "$now" != "$(cat "$orig")" ]; then
    echo "*** CONTAMINATION: restore of $sig did NOT round-trip. Every later case is suspect."
    echo "    Aborting the sweep (§7.5)."; exit 2
  fi
  INFLIGHT=""; rm -f "$SENTINEL" 2>/dev/null

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "guard" "$sig" "authz-open" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$sig"
done

# ─────────────────────────────────────────────────────────────────────────────────────
# ARM 2 — write POLICIES (open the check to true)
# ─────────────────────────────────────────────────────────────────────────────────────
echo
echo "=== ARM 2: write policies ==="
while IFS='|' read -r tbl polname cmd qual wc; do
  [ -z "$tbl" ] && continue
  case "$tbl" in \#*) continue;; esac
  want "$polname" || continue

  haveq=0; havew=0
  [ "$qual" != "-" ] && haveq=1
  [ "$wc"   != "-" ] && havew=1

  # vacuous skip: every clause that exists is already `true`
  vac=1
  { [ "$haveq" = 1 ] && [ "$qual" != "true" ]; } && vac=0
  { [ "$havew" = 1 ] && [ "$wc"   != "true" ]; } && vac=0
  if [ "$vac" = 1 ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "SKIPPED" "vacuous: relevant clause already true"
    echo "  SKIPPED $tbl.$polname (vacuous)"; continue
  fi

  s=$(slug "${tbl}_${polname}")
  qfile="$WORK/orig_wp_pol_$s.qual"; wfile="$WORK/orig_wp_pol_$s.wc"
  restore="$WORK/restore_wp_pol_$s.sql"
  regc="public.\"$tbl\""

  : > "$qfile"; : > "$wfile"
  [ "$haveq" = 1 ] && psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$qfile"
  [ "$havew" = 1 ] && psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass" > "$wfile"

  # §7.2 DRIFT tripwire: the live catalog must match the embedded snapshot, else the
  # worklist is stale and neutralizing is unsafe. ERROR (not a result), do not open.
  if [ "$haveq" = 1 ] && [ "$(cat "$qfile")" != "$qual" ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "snapshot drift (qual): live='$(cat "$qfile")'"
    echo "  ERROR  $tbl.$polname (qual drift)"; continue
  fi
  if [ "$havew" = 1 ] && [ "$(cat "$wfile")" != "$wc" ]; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "snapshot drift (with_check): live='$(cat "$wfile")'"
    echo "  ERROR  $tbl.$polname (wc drift)"; continue
  fi

  # RESTORE built from the LIVE capture (byte-exact), armed BEFORE opening.
  {
    printf 'alter policy "%s" on public."%s"' "$polname" "$tbl"
    [ "$haveq" = 1 ] && printf ' using (%s)' "$(cat "$qfile")"
    [ "$havew" = 1 ] && printf ' with check (%s)' "$(cat "$wfile")"
    printf ';\n'
  } > "$restore"
  INFLIGHT="$restore"
  cp -f "$restore" "$SENTINEL"   # Part 4: survives SIGKILL, which no trap does

  # OPEN the policy: using(true) [+ with check(true)] — only clauses that exist.
  {
    printf 'alter policy "%s" on public."%s"' "$polname" "$tbl"
    [ "$haveq" = 1 ] && printf ' using (true)'
    [ "$havew" = 1 ] && printf ' with check (true)'
    printf ';\n'
  } > "$WORK/_wp_mut.sql"
  mout=$(psql_f "$WORK/_wp_mut.sql")
  if echo "$mout" | grep -qiE 'ERROR'; then
    record "policy" "$tbl.$polname ($cmd)" "open->true" "ERROR" "open failed: $(echo "$mout" | tr '\n' ' ' | head -c 160)"
    psql_f "$restore" >/dev/null 2>&1; INFLIGHT=""; rm -f "$SENTINEL" 2>/dev/null
    echo "  ERROR  $tbl.$polname (open failed)"; continue
  fi

  out=$(run_suite); echo "$out" > "$RUNLOGS/pol_$s.log"
  classify "$out"

  # RESTORE exact original + VERIFY round-trip
  psql_f "$restore" >/dev/null 2>&1
  if [ "$haveq" = 1 ]; then
    nowq=$(psql_c -c "select pg_get_expr(polqual,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$nowq" != "$(cat "$qfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname qual did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  if [ "$havew" = 1 ]; then
    noww=$(psql_c -c "select pg_get_expr(polwithcheck,polrelid) from pg_policy where polname='$polname' and polrelid='$regc'::regclass")
    if [ "$noww" != "$(cat "$wfile")" ]; then
      echo "*** CONTAMINATION: restore of $tbl.$polname with_check did NOT round-trip. Aborting (§7.5)."; exit 2
    fi
  fi
  INFLIGHT=""; rm -f "$SENTINEL" 2>/dev/null

  note="$FAILING"
  [ "$VERDICT" = "ERROR" ] && note="run-shape!=baseline (Files=$RUNFILES Tests=$RUNTESTS)"
  record "policy" "$tbl.$polname ($cmd)" "open->true" "$VERDICT" "$note"
  printf '  %-8s %s\n' "$VERDICT" "$tbl.$polname"
done < "$POLWL"

echo
echo "=== DONE. Report: $FINDINGS   BLINDs: $BLINDS_TSV ==="
if [ "$SUBSET_RUN" = "1" ]; then
  # ⚠ Print the SIZE, not just the path: an "untouched baseline" is indistinguishable
  # from "this run wrote nothing at all" unless the subset report is shown to exist with
  # real content somewhere.
  echo "    ⚠ SUBSET RUN (CASES=\"$CASES\") — that report is a SCRATCH file, $(wc -l < "$FINDINGS" | tr -d '[:space:]') line(s),"
  echo "      covering ONLY the selected cases. The committed baseline was never opened"
  echo "      for write: $FINDINGS_COMMITTED"
  echo "    ⛔ Do NOT read a FROMFINDINGS arm as covering this run."
fi
blind_ct=$(awk -F'\t' '$4=="BLIND"' "$PROGRESS" | wc -l | tr -d '[:space:]')
err_ct=$(awk -F'\t' '$4=="ERROR"' "$PROGRESS" | wc -l | tr -d '[:space:]')
skip_ct=$(awk -F'\t' '$4=="SKIPPED"' "$PROGRESS" | wc -l | tr -d '[:space:]')
swept_ct=$(grep -c . "$PROGRESS" | tr -d '[:space:]')
cov_ct=$((swept_ct - blind_ct - err_ct - skip_ct))

# §7.17: the count line is USELESS without the domain beside it — "BLIND: 0" over an
# empty domain and "BLIND: 0" over 40 gates were the same string.
echo "ARM-DOMAIN guard=$GUARD_SEL/$GUARD_TOTAL policy=$POL_SEL/$POL_TOTAL"
[ "$GUARD_SEL" -eq 0 ] && echo "    ⚠ GUARD ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ "$POL_SEL"  -eq 0 ] && echo "    ⚠ POLICY ARM: EMPTY DOMAIN — this arm measured NOTHING. It did not hold; it did not run."
[ -n "$UNMATCHED" ] && echo "    ⚠ REQUESTED BUT NEVER SWEPT (matched no gate):$UNMATCHED"
echo "SWEPT: $swept_ct   COVERED: $cov_ct   BLIND: $blind_ct   ERROR(harness): $err_ct   SKIPPED(vacuous): $skip_ct"

# ⛔ THE EXIT CODE. Until 2026-08-29 this file ENDED on the echo above, so every run
# exited 0 — including one with 13 ERRORs that measured nothing. `(COVERED = the rest)`
# computed a positive-sounding residual against a set that, on a fully-ERRORed subset
# run, is EMPTY, so the summary line read like coverage. Both are fixed here: the
# residual is now printed as an explicit COVERED count, and the verdict is an exit code.
if [ "$swept_ct" -eq 0 ]; then
  # Belt-and-braces: the domain gate above should have exited 3 long before here.
  echo "=== RESULT: UNPROVEN — 0 gates swept despite a non-empty domain. Harness bug. ==="
  exit 3
elif [ "$blind_ct" -gt 0 ] || [ "$err_ct" -gt 0 ]; then
  echo "=== RESULT: DIRTY — $blind_ct BLIND, $err_ct ERROR. BLIND blocks the phase (§6 step 1);"
  echo "    ERROR is not a pass — fix the neutralization and re-run that case. ==="
  exit 1
elif [ -n "$UNMATCHED" ]; then
  echo "=== RESULT: UNPROVEN (PARTIAL) — $swept_ct gate(s) measured and all COVERED, but"
  echo "    these were requested and matched NO gate:$UNMATCHED"
  echo "    A clean verdict over a subset of what was asked for is the finding this gate"
  echo "    exists to prevent. NOT a pass. ==="
  exit 3
else
  echo "=== RESULT: CLEAN — $swept_ct gate(s) measured, all COVERED. ==="
  exit 0
fi
