# QA Review — Pre-Pilot DB Hardening, Wave 2 (WS-6 Performance Sweep)

**Date:** 2026-07-05
**Scope:** P2 (`list_audit_filter_actors`), P3 (keyset pagination — submissions,
referrals, meetings, NSP inbox; capped cases board), P4 (`get_feature_flags()` +
`count_open_cases_for_board`), P5 (submissions form-filter pushdown).
**Artifacts audited:** `supabase/migrations/20260711000900_perf_sweep_wave2.sql`,
`supabase/tests/199_perf_sweep_wave2.sql`, `e2e/perf-sweep-wave2.spec.ts`,
`src/lib/types/pagination.ts`, `src/lib/queries/{audit,feature-flags,cases,
submissions,meetings,referrals,pqs}.ts`, `src/components/shared/cursor-pagination.tsx`.
**Method:** static review against ARCHITECTURE.md + the program plan
(`docs/plans/pre-pilot-db-hardening-program.md` §WS-6) + PROGRESS.md's Wave-2 task
rows, plus live SQL verification against the local Docker Postgres and live
PostgREST probes (not just re-reading the tester's report).

## Verdict: **APPROVED**

No BLOCKER. No unmet Acceptance-bullet or RLS/immutability hole. One MAJOR
(a real, live-demonstrated code-quality/defense-in-depth gap, but with a
demonstrated-bounded blast radius — see below) plus MINOR/INFO items. None of
these rise to "changes requested" because the actual security boundary (RLS +
the two DEFINER RPC gates) is intact and independently reproducible; the MAJOR
is a correctness/consistency issue in a non-RLS filter layer, recommended to
fix before the pilot but not blocking this gate.

---

## 1. The two DEFINER RPCs' gate parity (the point of this review) — VERIFIED LIVE

**`count_open_cases_for_board`** (`supabase/migrations/20260711000900_perf_sweep_wave2.sql:238-257`):
reproduces `is_staff_admin_of(p_commission_id)` — the same gate `list_cases_board`
uses — and returns 0 before counting if it fails. Live-verified against the local
DB (not just re-trusting the tester):

```sql
-- chefe.ccih (staff_admin of CCIH) — commission a0000000-...-a1
select public.count_open_cases_for_board('a0000000-0000-0000-0000-0000000000a1');
--> 29
select count(*) from public.list_cases_board('a0000000-0000-0000-0000-0000000000a1', 200)
  where status not in ('concluido','cancelado');
--> 29   -- EXACT match, confirms visibility parity

-- chefe.farm (staff_admin of Farmácia, NOT CCIH) probing CCIH's commission
select public.count_open_cases_for_board('a0000000-0000-0000-0000-0000000000a1');
--> 0    -- gate correctly returns 0, not a cross-tenant count
```

This is exactly the parity the plan calls out as the reason this needs to be an
RPC (`cases_select` = `can_read_case` OR `is_commission_admin_of`, neither equal
to `is_staff_admin_of`) — confirmed correct, not just asserted in a comment.

**`pqs_inbox`'s new cursor params did not loosen the per-hospital operator gate.**
Diffed the WHERE clause against the pre-Wave-2 body
(`supabase/migrations/20260710000000_nsp_per_hospital.sql:1236-1241`, ADR 0052) —
byte-for-byte identical:

```sql
where rc.hospital_id in (
        select hospital_id from public.pqs_members where user_id = auth.uid()
        union
        select hospital_id from public.organization_members
        where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
      )
```

Only the `ORDER BY`/new params/cursor-AND clause were added; the gate subquery is
untouched. Live-verified with real seeded personas (5 total events in the DB):

```sql
-- user c4: pqs_member of Hospital B only
select count(*) from public.pqs_inbox(null,null,null,null,null,1000);  --> 1 (its own hospital's event only)

-- staff1.ccih: not enrolled in any hospital's PQS roster
select count(*) from public.pqs_inbox(null,null,null,null,null,1000);  --> 0
```

Both match expectations — no widening from the added params, no cross-hospital
leak. This is a PHI-adjacent path (Rule 12) and its gate integrity is confirmed
intact by direct DB probe, not by re-reading the migration's own comment.

## 2. P2 INVOKER + RLS — VERIFIED LIVE

`list_audit_filter_actors` is `SECURITY INVOKER` (confirmed `prosecdef = f` via
`pg_proc`), so `audit_log`'s own SELECT policy (admin: all; staff_admin: own
commission; else none) is the sole authority — there is no internal gate to
audit for correctness, only to confirm INVOKER is actually set (it is). Live
cross-commission check:

```sql
-- chefe.farm (staff_admin of Farmácia, foreign to CCIH) probing CCIH's actor list
select public.list_audit_filter_actors('a0000000-0000-0000-0000-0000000000a1');
--> 0 rows
```

No leak. The pgTAP suite (`199_perf_sweep_wave2.sql` §1, 6 assertions) independently
covers the DISTINCT-collapse behavior and the system/null-actor surfacing; I did
not need to re-derive those, only confirm the RLS boundary with a live probe,
which held.

## 3. `get_feature_flags()` DEFINER — reviewed, no PHI/per-tenant exposure

`app.feature_flags` has no tenant/commission/hospital column (confirmed by the
migration's own `select coalesce(jsonb_object_agg(key, enabled), '{}'::jsonb)
from app.feature_flags` — a flat key→bool table). DEFINER is required only
because `authenticated` has no direct grant on the `app` schema table, matching
every sibling `*_enabled()` RPC's existing pattern. The `cache()` wrapper in
`src/lib/queries/feature-flags.ts:47-52` is React per-request memoization of a
read with no caller-specific arguments — it cannot leak between requests/users
(each request gets its own `cache()` scope) and is behavior-preserving: absent
key → `undefined` → `featureEnabled` returns `false`, matching the former
per-flag semantics exactly.

## 4. Cursor safety — MAJOR finding (bounded blast radius, not a BLOCKER)

**What's correct:** `decodeCursor` (`src/lib/types/pagination.ts:48-60`) never
throws — a malformed/tampered base64url or non-JSON payload safely returns
`null`, degrading callers to page 1 as documented. `pqsInbox` (`src/lib/queries/pqs.ts:92-100`)
binds the decoded cursor fields as **typed RPC parameters**
(`p_cursor_reported_at`, `p_cursor_id`) — Postgres enforces `timestamptz`/`uuid`
casts at the boundary, which is the injection-safe pattern the task description
anticipated.

**What's not:** `submissions.ts:261-267`, `meetings.ts:497-501`, and
`referrals.ts:219-223` all build a raw `.or(...)` PostgREST filter string via
**template-literal interpolation of the decoded cursor's own field values**
(`cursor.s`, `cursor.u`, `cursor.id`, `cursor.c`) with **no shape/type validation**
after `decodeCursor` returns the parsed object — any string survives (`typeof
parsed === 'object'` is the only check). Per supabase-js's own documentation,
`.or()` is explicitly "an escape hatch... you need to make sure [values] are
properly sanitized" (`node_modules/@supabase/postgrest-js/dist/index.cjs:3073-3080`) —
and this codebase already knows that: `src/lib/queries/org-users.ts:174`
actively strips `[%,()]` from free-text search input before interpolating it
into an `.or()` clause for exactly this reason. The three Wave-2 cursor sites
do not apply the same sanitization to cursor-derived values, which is the first
time this `.or()` pattern is fed by a value that round-trips through the
client (`?cursor=`) rather than a server-derived id or admin-typed search term.

**Demonstrated impact (live, against the local PostgREST):**

```
GET /rest/v1/responses?commission_id=eq.<ccih>&status=eq.submitted
    &or=(submitted_at.lt.2099-01-01,id.not.is.null)
--> 200, returns rows regardless of the intended keyset predicate
```

I confirmed `URLSearchParams.append` (what `.or()` uses internally) percent-encodes
`&`/`=`/`,`/`(`/`)`, so **a crafted cursor cannot break out of the single `or=`
parameter** to inject a sibling query param or override the separate, safely
parameterized `commission_id=eq.`/`status=eq.` terms — and RLS is enforced by
Postgres underneath all of this regardless of filter shape. So the actual
exploitable outcome is: **a user can force their own list's `.or()` cursor
predicate to be vacuously true**, defeating pagination's "no overlap / no gap"
keyset guarantee for lists they already have legitimate RLS access to (e.g.
re-fetching/reordering rows within their own commission) — not a cross-tenant
or cross-RLS data leak. This is a correctness/robustness gap in a
security-adjacent code path, not a boundary breach.

**Recommendation (before pilot, not blocking this gate):** validate the decoded
cursor tuple's field types (e.g. `typeof cursor.s === 'string' && ISO_DATE_RE.test(cursor.s)`,
`UUID_RE.test(cursor.id)`) before interpolating into `.or()`, or — better —
switch these three list functions to the same typed-RPC-parameter pattern
`pqsInbox` already uses, which sidesteps the class of bug entirely. File as a
Wave-2 follow-up.

**Keyset determinism:** confirmed the tie-breaker `id` is present in every
keyset ordering (`submissions`: `submitted_at desc nulls last, updated_at desc,
id desc`; `meetings`: `scheduled_start desc, id desc`; `referrals`: `created_at
desc, id desc`; `pqs_inbox`: `reported_at desc, id desc`) — pages cannot
overlap/skip under normal (non-adversarial) operation, and the pgTAP suite
(§3.1–3.5) proves the `pqs_inbox` keyset's strictly-after semantics directly
(cursor row excluded, correct successor returned).

## 5. Rule compliance

- **Rule 9** (data access through `src/lib/queries/`) — all 5 new/changed DB
  objects are consumed exclusively through typed query-layer wrappers
  (`listAuditFilterActors`, `getFeatureFlags`/`featureEnabled`,
  `countOpenCasesForBoard`, `listCasesBoard`, `pqsInbox`); no inline
  supabase-js in components (spot-checked the touched pages).
- **Rule 8** (generated types) — `src/lib/types/database.ts` contains updated
  entries for all 5 objects (`count_open_cases_for_board`, `get_feature_flags`,
  `list_audit_filter_actors`, `list_cases_board`, `pqs_inbox`), confirmed
  present with the new signatures.
- **Rule 10** (pt-BR) — `CursorPagination` defaults to `"Próxima página"`,
  `aria-label="Paginação"` nav landmark, decorative icon `aria-hidden`; a real
  `<button>` (keyboard-operable, focus-visible via the shared `Button`
  component). No new user-facing strings found in English.
- **Rule 11** (audit) — all 5 objects are pure reads/counts; nothing here
  writes, so no new audit-row obligation. Confirmed no mutation snuck into any
  of the SQL bodies.
- **Rule 12** (PHI) — `pqs_inbox`'s list projection is unchanged (still the
  PHI-free metadata columns from `nsp_per_hospital.sql`); no PHI column was
  added to any touched list. `meetings`/`referrals` list projections are the
  pre-existing PHI-free metadata selects (Phase 22/Phase 10 established), not
  modified by Wave 2 beyond adding the cursor predicate.
- **C-2 posture** (Wave-1 postgres-owned + explicit grants) — live-confirmed
  for all 5 objects: `owner = postgres`, `anon_exec = false`,
  `authenticated_exec = true`, `service_role_exec = true` — matches the
  required per-object REVOKE/GRANT pattern exactly (migration §4). The
  `list_cases_board` signature change (`(uuid)` → `(uuid,integer)`) correctly
  updated the anon-denial assertion in `supabase/tests/100_dashboard.sql`
  (mechanical, pre-existing pgTAP file touched appropriately, not silently
  left stale).

## 6. Grants / new-column trap

Confirmed no new table columns were added by this migration (only 2 new
functions, 2 modified function signatures, 5 new indexes) — the memory-known
`case_referral` column-grant 42501 trap does not apply here; nothing to grant
beyond the function EXECUTE grants already covered in §5.

## 7. Other observations (INFO, non-blocking)

- **INFO-1:** `pqsInbox`'s error handling silently degrades a *semantically*
  invalid (but syntactically well-formed) cursor to an **empty page** rather
  than page 1 — because the RPC's `timestamptz`/`uuid` cast failure surfaces
  as a PostgREST 400 *after* `decodeCursor` has already succeeded, and
  `pqsInbox` (`src/lib/queries/pqs.ts`) catches that error by returning
  `{ rows: [], nextCursor: null }`. Confirmed live: `p_cursor_reported_at:
  "not-a-timestamp"` → Postgres `22007` at 400, swallowed cleanly (no raw
  error reaches the UI — Rule compliance holds), but the user sees an empty
  list instead of the documented "degrade to page 1" contract. Low severity
  (requires deliberately crafting an invalid cursor; not reachable through
  normal UI navigation), worth a follow-up but not blocking.
- **INFO-2:** `listAuditFilterActors` only accepts a commission id, not the
  org/hospital audit tiers (`listAuditForOrg`/`listAuditForHospital` exist as
  siblings without a matching actor-filter RPC variant). Not a regression —
  P2's stated scope was the commission-tier actor scan
  (`audit.ts:596`-equivalent) — but worth noting if the org/hospital audit UIs
  ever grow the same actor dropdown.
- **INFO-3:** `list_cases_board`'s default `p_limit=200` and
  `count_open_cases_for_board`'s uncapped count could, in principle, diverge
  post-pilot if a single commission's case count exceeds 200 (the board caps,
  the counter doesn't) — the counter would then report a higher number than
  the visibly-loaded board. Acceptable for pilot scale per the plan's own
  reasoning ("well above any real pre-pilot per-commission case count");
  flag for whenever the board's cap is revisited.

## 8. Test-pass corroboration

Independently re-ran the pieces that matter for a security review rather than
trusting the tester's summary at face value: the two DEFINER RPC gate-parity
checks (§1) and the P2 cross-commission isolation check (§2) were run fresh
against the local DB with real seeded personas, not copied from the pgTAP
file. The pgTAP suite's own 28 assertions (`199_perf_sweep_wave2.sql`) were
read in full and are well-targeted (each has a distinct negative case: sa_y
excluded from sa_x's actor list, non-PQS excluded from the inbox, non-staff_admin
gets an empty board and a 0 count) — `select plan(28)` matches 28 counted
assertions, no silent gap.

---

## Summary for the lead

**APPROVED.** Both DEFINER RPCs reproduce their source gates exactly
(live-verified with real personas, not just re-read from comments); P2's
INVOKER + RLS holds cross-commission; `get_feature_flags()` is safe and
behavior-preserving; Rule 8/9/10/11/12 and the C-2 grant posture all hold.

One **MAJOR**, non-blocking: three cursor-consuming list functions
(`submissions.ts`, `meetings.ts`, `referrals.ts`) interpolate un-validated,
client-round-tripped cursor field values into a raw PostgREST `.or()` filter
string — the same class of risk `org-users.ts` already sanitizes against for
free-text search, but not applied here. Demonstrated live that this cannot
escape its own `or=` parameter, cannot bypass RLS or the sibling `.eq()`
scoping filters, and at worst lets a user defeat their own pagination's
ordering guarantee within data they can already read. Recommend fixing before
pilot (either type-validate the decoded tuple before use, or switch to typed
RPC parameters like `pqsInbox` already does) as a fast follow, not a
re-review gate.

One MINOR (INFO-1: semantically-invalid cursor degrades to an empty page
instead of the documented "page 1" contract on the RPC-backed `pqsInbox`
path) and two INFO items, none blocking.
