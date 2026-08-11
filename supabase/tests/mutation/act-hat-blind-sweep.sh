#!/usr/bin/env bash
#
# act-hat-blind-sweep.sh — ACT Stage 4 (ADR 0106) standing sweep: RAW MEMBERSHIPS
# READS THAT ARE CALLER-BOUND BUT HAT-BLIND.
#
# THE PROPERTY (endorsed at ACT S3, made executable here): a reference to
# public.memberships whose principal filter is bound to THE CALLER
# (auth.uid(), directly or transitively) with NO adjacent active-role
# condition. After ADR 0106 D3/D5, every such read answers "what may this
# session do?" from the FULL grant list instead of the active hat — the exact
# fail-open D5 rejects, and the shape BUG-ACT-HATBLIND-001 (list_my_nsp_
# hospitals) and the §7.17 class-4 gate (is_admin_for) each shipped once.
#
# WHY A SCRIPT AND NOT PROSE: "standing in prose alone" ran once in three
# weeks on this repo, and the next run found 15 BLIND gates (ADR 0079 Am. 1).
#
# ── Method (ADR 0079 Amendment 6 / authz-handoff §7.17 — binding) ─────────────
#  * Population: every function in schemas app+public (pg_proc, prokind='f',
#    comment-stripped, lowercased — a pg_get_functiondef-regenerated body is
#    uppercase, Amendment 5a) + every RLS policy (pg_policies, all schemas).
#  * Caller-binding is classified by CALL-SITE BINDING, never signature shape:
#    - direct: principal_id = auth.uid() / (select auth.uid()) (either order);
#    - local var: v := auth.uid() (declared or assigned, incl. house-style
#      (select auth.uid())) and CTE-alias columns (me as (select (select
#      auth.uid()) as uid) -> me.uid — the session_context shape);
#    - parameter: bound iff SOME caller binds that parameter position to the
#      caller's identity, TRANSITIVELY through the call graph. Call arguments
#      are extracted with a BALANCED-PAREN walker (a regex cannot see
#      f((select auth.uid())), the house style); call edges key on
#      name[[:space:]]*\( with an identifier-boundary guard (a bare substring
#      lets the COLUMN is_admin match the FUNCTION app.is_admin).
#  * Adjacency granularity: the ';'-split statement chunk containing the
#    memberships read. Hat evidence = active_role( / has_role( / has_role_any(
#    in the same chunk (delegating the role test INTO has_role* IS the hat —
#    is_pqs_member_of_any's shape). has_role( does not match has_role_any(
#    and vice versa: the boundary is the '(' edge.
#  * THE ANCHOR CHECK: delegation evidence is only as good as the delegate.
#    app.has_role (4-arg) and app.has_role_any must THEMSELVES carry the
#    caller-only active_role condition; if either loses it the sweep FAILS
#    outright, allowlist or not (otherwise every delegating door would still
#    show "evidence" while the whole estate went hat-blind).
#
# ── Self-test — RUNS ON EVERY INVOCATION, before the real sweep ───────────────
#  A detector that finds nothing must be proven able to find something (ADR
#  0079 Amendment 4 — its own first harness reported 0 guards in 45 doors and
#  was completely wrong). In one BEGIN..ROLLBACK transaction this script:
#    ST1 plants a blind direct-read specimen            -> MUST be flagged
#    ST2 plants a hat-covered twin (inline active_role) -> MUST NOT be flagged
#    ST3 plants a param-gate + a caller binding it to (select auth.uid())
#        (the §7.17 class-4 / house-style shape)        -> MUST be flagged
#    ST4 strips the active-role condition from the REAL app.has_role_any
#        (rolled back)                                  -> anchor check MUST flip
#    ST5 plants a POLICY on a non-memberships table whose qual does a blind
#        caller-bound memberships read — the `else` half of the policy
#        branch, whose three live specimens are all negatives; without this
#        a dead branch produces an identical run        -> MUST be flagged
#    ST6 plants its hat-covered policy twin (active_role
#        in the same subquery window)                   -> MUST NOT be flagged
#  ST2/ST6 plus the live rejection baseline (36 of 38 raw readers correctly NOT
#  flagged, hand-classified 2026-08-10) are the "prove it does not find what is
#  not there" twins (Amendment 5a). ST6 matters even with zero live covered
#  cross-table policies: the first legitimate one would otherwise meet an
#  undetected discrimination loss as a spurious NEW finding, and the tempting
#  "fix" (allowlist it) would mask a later real hat-blindness on that policy.
#
# ── Known blind spots (stated so silence is not over-read) ────────────────────
#  * Chunk-level adjacency: a chunk with one covered AND one uncovered
#    memberships read reads as covered (none exist today; hand-audited).
#  * principal_id = any(<array>) with caller identity inside the array escapes
#    the comparand grammar (today's only `any` site seeds meeting attendees —
#    third-party).
#  * Positional call arguments assumed (house style); named-arg calls (=>) are
#    not parsed. Same-name overloads fold by (name, position) — conservative.
#  * The TS layer is out of domain: getSessionContext()/getRawGrants() hat
#    discipline is app-code review territory (src/lib/queries/session.ts).
#  * member_can (D13) is out of THIS sweep's domain (it reads
#    commission_administrativo_capabilities, not memberships); its hat
#    condition is keystoned in the ACT suite.
#
# ── Contract ──────────────────────────────────────────────────────────────────
#  FINDINGS must equal act-hat-blind-allowlist.txt exactly.
#    * a finding NOT in the allowlist  -> NEW HAT-BLIND GATE -> exit 1
#    * an allowlist line with no live finding -> GHOST (renamed/fixed gate;
#      the a-rename-orphans-a-name-keyed-verdict lesson) -> exit 1
#  Wiring: ARM=hat of p0-authz-invariant.sh (also in ARM=all). Cost: ~5 s.
#
# Usage:  bash supabase/tests/mutation/act-hat-blind-sweep.sh
set -u

DB=supabase_db_azkbbhskturikxpgmafq
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="$HERE/act-hat-blind-allowlist.txt"

psql_c () { MSYS_NO_PATHCONV=1 docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }
allow_body () { grep -vE '^[[:space:]]*#' "$1" 2>/dev/null | grep -vE '^[[:space:]]*$'; }

OUT="$(psql_c <<'SQL'
set client_min_messages = warning;
-- ═══ analyzer (pg_temp; session-local, read-only outside the selftest txn) ═══

create function pg_temp.hb_extract_args(p_body text, p_fname text)
returns table(occ int, argpos int, arg text)
language plpgsql stable as $HB$
declare
  i int := 1; l int := length(p_body); nl int := length(p_fname);
  rel int; abs int; k int; depth int; cur text; ch text; occn int := 0; ap int;
begin
  loop
    rel := position(p_fname in substr(p_body, i));
    exit when rel = 0;
    abs := i + rel - 1;
    -- identifier-boundary guard: char before must not be [a-z0-9_]
    -- ('.' IS allowed: app.has_role); char after name-run: skip spaces, need '('
    if abs > 1 and substr(p_body, abs-1, 1) ~ '[a-z0-9_]' then
      i := abs + nl; continue;
    end if;
    k := abs + nl;
    -- the char right after the name must not extend the identifier (has_role
    -- must not match has_role_any)
    if substr(p_body, k, 1) ~ '[a-z0-9_]' then
      i := abs + nl; continue;
    end if;
    while k <= l and substr(p_body, k, 1) ~ '[[:space:]]' loop k := k + 1; end loop;
    if substr(p_body, k, 1) <> '(' then
      i := abs + nl; continue;
    end if;
    occn := occn + 1; depth := 1; k := k + 1; cur := ''; ap := 1;
    while k <= l and depth > 0 loop
      ch := substr(p_body, k, 1);
      if ch = '''' then                     -- string literal: copy, honor '' doubling
        cur := cur || ch; k := k + 1;
        while k <= l loop
          ch := substr(p_body, k, 1); cur := cur || ch; k := k + 1;
          if ch = '''' then
            if substr(p_body, k, 1) = '''' then cur := cur || ''''; k := k + 1;
            else exit; end if;
          end if;
        end loop;
        continue;
      elsif ch = '(' then depth := depth + 1; cur := cur || ch;
      elsif ch = ')' then
        depth := depth - 1;
        if depth = 0 then
          if btrim(cur) <> '' or ap > 1 then
            occ := occn; argpos := ap; arg := btrim(cur); return next;
          end if;
        else cur := cur || ch; end if;
      elsif ch = ',' and depth = 1 then
        occ := occn; argpos := ap; arg := btrim(cur); return next;
        ap := ap + 1; cur := '';
      else cur := cur || ch;
      end if;
      k := k + 1;
    end loop;
    i := abs + nl;
  end loop;
end $HB$;

create function pg_temp.hb_findings()
returns table(kind text, key text)
language plpgsql as $HB$
declare
  r record; c record; a record;
  v_changed boolean;
  v_win text; v_q text; v_idx int; v_depth int; v_k int; v_ch text; v_hit boolean;
begin
  drop table if exists _hb_fn, _hb_var, _hb_bind, _hb_need, _hb_bound;

  create temp table _hb_fn as
    select p.oid as foid, n.nspname as sch, p.proname as fname,
           pg_get_function_identity_arguments(p.oid) as idargs,
           coalesce(p.proargnames, '{}'::text[]) as argnames,
           lower(regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', '', 'gs'),
                                '--[^\n]*', '', 'g')) as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public') and p.prokind = 'f';

  create temp table _hb_var as
    select foid, m[1] as v from _hb_fn, lateral regexp_matches(src,
      '([a-z_][a-z0-9_]*)[[:space:]]+uuid[[:space:]]*:=[[:space:]]*\(?[[:space:]]*(select[[:space:]]+)?auth\.uid\(\)', 'g') as m
    union
    select foid, m[1] from _hb_fn, lateral regexp_matches(src,
      '([a-z_][a-z0-9_]*)[[:space:]]*:=[[:space:]]*\(?[[:space:]]*(select[[:space:]]+)?auth\.uid\(\)', 'g') as m
    union
    select foid, m[1] || '.' || m[3] from _hb_fn, lateral regexp_matches(src,
      '([a-z_][a-z0-9_]*)[[:space:]]+as[[:space:]]*\([[:space:]]*select[[:space:]]+\(?[[:space:]]*(select[[:space:]]+)?auth\.uid\(\)[[:space:]]*\)?[[:space:]]+as[[:space:]]+([a-z_][a-z0-9_]*)', 'g') as m;

  -- memberships chunks + principal comparands + hat evidence, per chunk
  create temp table _hb_bind as
  with chunk as (
    select foid, ch from _hb_fn, lateral unnest(string_to_array(src, ';')) as ch
    where ch ~ '\ymemberships\y'
  ),
  bind as (
    select foid, ch, m[2] as comparand from chunk, lateral regexp_matches(ch,
      '\yprincipal_id[[:space:]]*(=|is[[:space:]]+not[[:space:]]+distinct[[:space:]]+from)[[:space:]]*(\([[:space:]]*select[[:space:]]+auth\.uid\(\)[[:space:]]*\)|auth\.uid\(\)|[a-z_][a-z0-9_.]*)', 'g') as m
    union all
    select foid, ch, 'auth.uid()' from chunk
    where ch ~ 'auth\.uid\(\)[[:space:]]*=[[:space:]]*[a-z_.]*principal_id\y'
  )
  select b.foid, b.ch, b.comparand,
    case
      when replace(lower(b.comparand), ' ', '') in ('auth.uid()', '(selectauth.uid())')
        or b.comparand ~ '^\([[:space:]]*select[[:space:]]+auth\.uid\(\)[[:space:]]*\)$'
        then 'direct'
      when exists (select 1 from _hb_var v where v.foid = b.foid and v.v = b.comparand)
        then 'var'
      when exists (select 1 from _hb_fn f where f.foid = b.foid and b.comparand = any(f.argnames))
        then 'param'
      else 'unbound'
    end as klass,
    (b.ch ~ '(^|[^a-z0-9_])(active_role|has_role|has_role_any)[[:space:]]*\(') as hat
  from bind b;

  -- tier c: parameters needing call-site resolution (only where it decides the
  -- verdict: chunks WITHOUT hat evidence). ⚠ The PK is load-bearing: without
  -- it the named-arbiter ON CONFLICT below never fires, every fixpoint pass
  -- re-inserts, FOUND stays true and the loop never converges (this script's
  -- first run hung exactly there — the untargeted-ON CONFLICT lesson, inverted).
  create temp table _hb_need(
    foid oid, fname text, pname text, ppos int, primary key (foid, pname));
  insert into _hb_need
    select distinct b.foid, f.fname, b.comparand,
           array_position(f.argnames, b.comparand)
    from _hb_bind b join _hb_fn f on f.foid = b.foid
    where b.klass = 'param' and not b.hat
  on conflict (foid, pname) do nothing;

  create temp table _hb_bound(foid oid, pname text, primary key (foid, pname));

  -- fixpoint: propagate caller-boundness through the call graph
  loop
    v_changed := false;
    for r in select distinct fname, pname, ppos from _hb_need where ppos is not null
    loop
      for c in select f2.foid as caller, f2.argnames as cargs
               from _hb_fn f2
               where f2.src ~ ('(^|[^a-z0-9_])' || r.fname || '[[:space:]]*\(')
      loop
        for a in select * from pg_temp.hb_extract_args(
                   (select src from _hb_fn where foid = c.caller), r.fname)
                 where argpos = r.ppos
        loop
          if replace(lower(a.arg), ' ', '') in ('auth.uid()', '(selectauth.uid())')
             or exists (select 1 from _hb_var v where v.foid = c.caller and v.v = a.arg)
             or (a.arg ~ '^[a-z_][a-z0-9_]*$' and a.arg = any(c.cargs)
                 and exists (select 1 from _hb_bound bb join _hb_fn ff on ff.foid = bb.foid
                             where bb.foid = c.caller and bb.pname = a.arg))
          then
            -- overloads fold by (name, position): mark every same-name foid
            insert into _hb_bound
              select f3.foid, r.pname from _hb_fn f3
              where f3.fname = r.fname and r.pname = any(f3.argnames)
            on conflict (foid, pname) do nothing;
            if found then v_changed := true; end if;
          elsif a.arg ~ '^[a-z_][a-z0-9_]*$' and a.arg = any(c.cargs) then
            -- the caller's own param: pull it into the worklist
            insert into _hb_need
              select c.caller, ff.fname, a.arg, array_position(ff.argnames, a.arg)
              from _hb_fn ff where ff.foid = c.caller
            on conflict (foid, pname) do nothing;
            if found then v_changed := true; end if;
          end if;
        end loop;
      end loop;
    end loop;
    exit when not v_changed;
  end loop;

  -- FUNCTION findings: caller-bound read, no hat evidence in the chunk
  return query
  select 'F'::text,
         'fn: ' || f.sch || '.' || f.fname || '(' || f.idargs || ')'
  from (
    select distinct b.foid from _hb_bind b
    where not b.hat
      and (b.klass in ('direct','var')
           or (b.klass = 'param' and exists (
                 select 1 from _hb_bound bb where bb.foid = b.foid and bb.pname = b.comparand)))
  ) hit join _hb_fn f on f.foid = hit.foid;

  -- POLICY findings: memberships window binds principal to auth.uid, no
  -- active_role in the window (policy ON memberships: window = whole predicate)
  for r in select schemaname as sch, tablename as tbl, policyname as pol, cmd,
                  lower(coalesce(qual,'') || ' ' || coalesce(with_check,'')) as q
           from pg_policies
           where lower(coalesce(qual,'') || coalesce(with_check,'')) ~ '\ymemberships\y'
              or tablename = 'memberships'
  loop
    v_hit := false;
    if r.tbl = 'memberships' then
      if r.q ~ '\yprincipal_id[[:space:]]*=[[:space:]]*\(?[[:space:]]*select[[:space:]]+auth\.uid\(\)'
         or r.q ~ '\yprincipal_id[[:space:]]*=[[:space:]]*auth\.uid\(\)'
         or r.q ~ 'auth\.uid\(\)[^)]*=[[:space:]]*[a-z_.]*principal_id\y' then
        if r.q !~ 'active_role[[:space:]]*\(' then v_hit := true; end if;
      end if;
    else
      v_q := r.q; v_idx := 1;
      loop
        v_k := position('memberships' in substr(v_q, v_idx));
        exit when v_k = 0;
        v_k := v_idx + v_k - 1;
        -- window: from the token to the close of the enclosing subquery
        v_depth := 0; v_win := ''; v_idx := v_k + 11;
        v_k := v_idx;
        while v_k <= length(v_q) loop
          v_ch := substr(v_q, v_k, 1);
          if v_ch = '(' then v_depth := v_depth + 1;
          elsif v_ch = ')' then
            v_depth := v_depth - 1;
            exit when v_depth < 0;
          end if;
          v_win := v_win || v_ch; v_k := v_k + 1;
        end loop;
        if (v_win ~ '\yprincipal_id[[:space:]]*=[[:space:]]*\(?[[:space:]]*select[[:space:]]+auth\.uid\(\)'
            or v_win ~ '\yprincipal_id[[:space:]]*=[[:space:]]*auth\.uid\(\)')
           and v_win !~ 'active_role[[:space:]]*\(' then
          v_hit := true;
        end if;
      end loop;
    end if;
    if v_hit then
      kind := 'F'; key := 'policy: ' || r.sch || '.' || r.tbl || '.' || r.pol || ' (' || r.cmd || ')';
      return next;
    end if;
  end loop;

  -- ANCHORS: the delegates every "has_role( in chunk" evidence rests on
  return query
  select 'AN'::text,
         f.sch || '.' || f.fname ||
         case when f.src ~ 'active_role[[:space:]]*\(' then '|OK' else '|HATLESS' end
  from _hb_fn f
  where (f.fname = 'has_role' and f.idargs = 'p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid')
     or f.fname = 'has_role_any';
end $HB$;

-- ═══ SELF-TEST (every run; rolled back) ═══════════════════════════════════════
begin;

create function app._hb_selftest_blind() returns boolean
language sql stable as $$
  select exists (select 1 from public.memberships m where m.principal_id = auth.uid())
$$;
create function app._hb_selftest_covered() returns boolean
language sql stable as $$
  select exists (select 1 from public.memberships m
                 where m.principal_id = auth.uid()
                   and m.role is not distinct from app.active_role())
$$;
create function app._hb_selftest_param_gate(p_uid uuid) returns boolean
language sql stable as $$
  select exists (select 1 from public.memberships m where m.principal_id = p_uid)
$$;
create function app._hb_selftest_param_caller() returns boolean
language sql stable as $$
  select app._hb_selftest_param_gate((select auth.uid()))
$$;
-- ST5/ST6: a policy pair on a NON-memberships table — the `else` half of the
-- policy branch (cross-table reads), which has no live positive specimen
create table app._hb_selftest_t5(id uuid);
create policy _hb_selftest_policy_blind on app._hb_selftest_t5
  for select using (
    exists (select 1 from public.memberships m
            where m.principal_id = (select auth.uid()))
  );
create policy _hb_selftest_policy_covered on app._hb_selftest_t5
  for select using (
    exists (select 1 from public.memberships m
            where m.principal_id = (select auth.uid())
              and m.role is not distinct from app.active_role())
  );
-- ST4: strip the caller-only condition from the REAL has_role_any (rolled back)
create or replace function app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  );
$$;

with f as (select * from pg_temp.hb_findings())
select 'ST|' ||
  case when exists (select 1 from f where key like 'fn: app._hb_selftest_blind%' and kind='F')
       then '1|OK' else '1|FAIL planted blind direct-read NOT flagged' end
union all
select 'ST|' ||
  case when not exists (select 1 from f where key like 'fn: app._hb_selftest_covered%' and kind='F')
       then '2|OK' else '2|FAIL hat-covered twin WAS flagged (false positive)' end
union all
select 'ST|' ||
  case when exists (select 1 from f where key like 'fn: app._hb_selftest_param_gate%' and kind='F')
       then '3|OK' else '3|FAIL class-4 param gate (house-style caller) NOT flagged' end
union all
select 'ST|' ||
  case when exists (select 1 from f where kind='AN' and key = 'app.has_role_any|HATLESS')
       then '4|OK' else '4|FAIL anchor check did not notice a neutralized has_role_any' end
union all
select 'ST|' ||
  case when exists (select 1 from f where kind='F'
                      and key like 'policy: app._hb_selftest_t5._hb_selftest_policy_blind%')
       then '5|OK' else '5|FAIL planted blind cross-table POLICY not flagged (else-branch dead?)' end
union all
select 'ST|' ||
  case when not exists (select 1 from f
                        where key like 'policy: app._hb_selftest_t5._hb_selftest_policy_covered%')
       then '6|OK' else '6|FAIL hat-covered cross-table policy WAS flagged (false positive)' end;

rollback;

-- ═══ REAL SWEEP ═══════════════════════════════════════════════════════════════
select kind || '|' || key from pg_temp.hb_findings() order by 1;
SQL
)" || { echo "act-hat-blind-sweep: psql FAILED"; echo "$OUT"; exit 1; }

echo "=== ACT hat-blind sweep (ADR 0106 S4 / ADR 0079 Am. 6 method) ==="

# 1) self-test: exactly 6 STs, all OK
ST_FAIL=$(printf '%s\n' "$OUT" | grep '^ST|' | grep -v '|OK$' || true)
ST_N=$(printf '%s\n' "$OUT" | grep -c '^ST|' || true)
if [ -n "$ST_FAIL" ] || [ "$ST_N" -ne 6 ]; then
  echo "SELF-TEST FAILED (detector cannot be trusted; findings below are void):"
  printf '%s\n' "$OUT" | grep '^ST|'
  exit 1
fi
echo "self-test: $ST_N/6 OK (blind flagged · covered not flagged · class-4 param flagged · anchor flip seen · x-table policy flagged · covered x-table policy not flagged)"

# 2) anchors: has_role + has_role_any still carry the active-role condition
AN_BAD=$(printf '%s\n' "$OUT" | grep '^AN|' | grep -v '|OK$' || true)
if [ -n "$AN_BAD" ]; then
  echo "ANCHOR FAILED — a has_role* body has LOST the caller-only active_role condition:"
  printf '%s\n' "$AN_BAD"
  exit 1
fi
echo "anchors: app.has_role(4-arg) + app.has_role_any carry the active-role condition"

# 3) findings vs allowlist, both directions
FINDINGS=$(printf '%s\n' "$OUT" | grep '^F|' | sed 's/^F|//' | sort -u)
ALLOWED=$(allow_body "$ALLOWLIST" | sort -u)

NEW=$(comm -23 <(printf '%s\n' "$FINDINGS" | sed '/^$/d') <(printf '%s\n' "$ALLOWED" | sed '/^$/d') || true)
GHOST=$(comm -13 <(printf '%s\n' "$FINDINGS" | sed '/^$/d') <(printf '%s\n' "$ALLOWED" | sed '/^$/d') || true)

FAIL=0
if [ -n "$NEW" ]; then
  echo "⛔ NEW HAT-BLIND GATE(S) — caller-bound raw memberships read, no active-role condition:"
  printf '%s\n' "$NEW" | sed 's/^/  /'
  echo "  Fix the gate (the has_role delegation or the inline condition), or — ONLY for a"
  echo "  door that must see the full grant list by design — allowlist it WITH reasoning."
  FAIL=1
fi
if [ -n "$GHOST" ]; then
  echo "⛔ GHOST allowlist entr(y/ies) — no live gate matches (renamed or fixed?):"
  printf '%s\n' "$GHOST" | sed 's/^/  /'
  echo "  A rename orphans a name-keyed verdict: re-key the entry or delete it."
  FAIL=1
fi
if [ "$FAIL" -eq 0 ]; then
  N=$(printf '%s\n' "$FINDINGS" | sed '/^$/d' | wc -l | tr -d ' ')
  echo "HAT-BLIND SWEEP HOLDS: $N finding(s), all reasoned-allowlisted:"
  printf '%s\n' "$FINDINGS" | sed '/^$/d;s/^/  /'
fi
exit $FAIL
