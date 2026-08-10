# ACT program — build notes (ADR 0106)

Running log of build-time findings, sweep inventories, and reconciliations.
Stages 0–4 append here; nothing is removed. Plan: `docs/plans/act-as-role-assumption.md`.

## Stage 0 — `app.platform_role` enum (backend, 2026-08-09)

**Migration:** `supabase/migrations/20260918000000_act_platform_role_enum.sql`.

### Derivation — catalog vs. enum reconciliation

Source of truth, queried live (not read from any prose):

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
  where conname = 'memberships_role_check';
```

| `memberships_role_check` (10 values) | `pg_enum` for `app.platform_role` (11 values) |
| --- | --- |
| `org_admin` | `org_admin` |
| `nsp_org_admin` | `nsp_org_admin` |
| `hospital_admin` | `hospital_admin` |
| `nsp_coordinator` | `nsp_coordinator` |
| `staff_admin` | `staff_admin` |
| `staff` | `staff` |
| `pqs_member` | `pqs_member` |
| `technical_director` | `technical_director` |
| `technical_director_deputy` | `technical_director_deputy` |
| `quality_reviewer` | `quality_reviewer` |
| — (lives in `profiles.is_admin`, not `memberships`) | `platform_admin` (added deliberately — ADR 0106 D11 / plan QA r1 BLOCKER) |

Reconciliation: 10 CHECK values + 1 deliberate addition = 11 enum labels. Verified via
`pg_enum`/`pg_type`/`pg_namespace` on a **fresh** `supabase db reset --local` (registered
migration count 335 == migration file count 335, checked before trusting the query).

### Scope discipline held

- `memberships.role` (text + CHECK) untouched — no re-key attempted.
- No function, policy, trigger, or table references `app.platform_role` yet. Grepped
  `pg_depend`/`pg_attribute`/`pg_proc` implicitly via the gate: `ARM=census` reports
  the same live-gate count as the pre-Stage-0 baseline (451 gates / 461 verdicts) —
  i.e. Stage 0 added zero new authz gates, consistent with "type only, no consumer."

### Finding — the enum will NOT surface in `database.ts` via `gen:types`

**Consequential for Stage 3 planning.** `supabase/config.toml` exposes only
`schemas = ["public", "graphql_public"]` to the API — the `app` schema is not in that
list. `supabase gen types typescript --local` only emits types for exposed schemas, so
`app.platform_role` is invisible to the generated-types file by construction, not by
omission or bug.

Verified empirically: ran `npm run gen:types` after applying this migration;
`git diff --stat -- src/lib/types/database.ts` and `git diff --cached --stat` (after
staging) both came back **empty** — byte-identical output, confirming no `"app"` key
was ever present in `database.ts` before or after. (No pgtap-drop precaution was
needed this run — `pgtap` extension was not installed at generation time.)

**Re-plan needed for Stage 3.** The plan's §4 Stage 0 line "the picker (via generated
types)" and the ADR's Consequences ("FUP-AFF-4 … becomes more valuable … a list no
generated type can see is a liability") both assume the enum is reachable through
`database.ts`. As things stand it is not. Stage 3 (or an earlier decision point) needs
one of:
- expose `app` in `config.toml` `schemas` (widens the PostgREST-exposed surface —
  a security-relevant call, not a backend-unilateral one), or
- hand-maintain a TS union/const mirroring the enum (reintroduces exactly the drift
  risk FUP-AFF-4 was meant to close — the enum becomes truth but a second, unchecked
  copy still exists in TS), or
- have the picker/claim-consuming TS code read the value list from a small SQL
  function (`select enum_range(null::app.platform_role)`) exposed through an RPC
  already reachable via `public`, so the `public`-only exposure boundary is preserved
  and the enum stays the single source of truth.

Flagging this now, plainly, rather than silently building around it — this is exactly
the "generated types will legitimately not surface an `app`-schema type" case named in
the Stage 0 task brief.

### Gate results (fresh `supabase db reset --local`)

- `npm run lint` — pass (eslint 0 warnings + `lint:css-vars` + `lint:memberships-door`).
- `npm run typecheck` — pass. (First run failed on `RouteContext<'/api/documents/[id]'>`
  in `src/app/api/documents/[id]/route.ts` — a pre-existing environmental gap: this
  fresh worktree had never run `next build`/`next dev`, so `.next/types` (Next.js's
  typed-routes generated types) did not exist yet. That file was last touched
  2026-08-07, well before this Stage 0 session, and Stage 0 touches zero `.ts`/`.tsx`
  files, so the failure could not have been caused by this migration. Ran `npm run
  build` once to populate `.next/types`; `npm run typecheck` then passed cleanly with
  no source changes. Recorded here in case a future fresh-worktree spawn hits the same
  false-negative.)
- `npm run test:db` (pgTAP, fresh reset) — **Files=175, Tests=5636, Result: PASS**.
- `ARM=census supabase/tests/mutation/p0-authz-invariant.sh` — INVARIANT HOLDS (451
  live gates / 461 carrying a verdict — unchanged from baseline; no unswept newcomer).
- `ARM=floor supabase/tests/mutation/p0-authz-invariant.sh` — INVARIANT HOLDS (80
  authenticated-reachable `prosecdef` doors with 0 calls, all on the floor allowlist —
  unchanged from baseline).
- `docs/reviews/authz-door-audit-findings.md` — untouched by either ARM run (checked
  `git status` after both; no restore needed).

### Commit

One commit, `feat(act): stage 0 — app.platform_role enum (ADR 0106)`, containing the
migration and this buildnotes file. `database.ts` was NOT committed (byte-identical,
see finding above).

---

## Stage 0 correction — the enum moves to `public` (lead ruling, 2026-08-09)

The lead independently verified the `database.ts` gap above and ruled: `app.platform_role`
becomes **`public.platform_role`**. Rationale (recorded here so Stage 3 doesn't re-litigate):
exposing `app` via `config.toml` was rejected (puts every `app` DEFINER door on PostgREST —
an attack-surface change, not a typing fix); a hand-maintained TS mirror was rejected
(reintroduces the exact drift FUP-AFF-4 exists to close); a bare enum TYPE in `public` has no
endpoint and no RLS surface — `public.audio_job_status`
(`20260910000100_audio_minutes_schema.sql`) is the existing precedent for exactly this shape.
Schema placement was never one of the PO-locked P1–P6 decisions, so this is a build-time
correction, not a plan reversal.

**Migration `20260918000000_act_platform_role_enum.sql` was amended IN PLACE** (not a
follow-up `ALTER TYPE … SET SCHEMA`): it was never pushed (standing no-push rule; origin
never had the `app` version), nothing consumed the type yet, and the project is pre-launch,
where a clean migration beats back-compat cruft. A **full `supabase db reset --local`** is
mandatory to pick this up — `supabase migration up` will not re-run an already-registered
version.

Catalog verification, post-reset:

```sql
-- app.platform_role no longer exists
select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
  where n.nspname='app' and t.typname='platform_role';
-- → 0 rows

-- public.platform_role carries all 11 labels
select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
  join pg_namespace n on n.oid=t.typnamespace
  where n.nspname='public' and t.typname='platform_role' order by enumsortorder;
```

(Actual output pasted in the report to the lead; both checks confirmed — see the gate
section below for the full command transcript context.)

---

## Stage 1 — backend half (2026-08-09)

Plan: `docs/plans/act-as-role-assumption.md` §4 Stage 1. Scope here: `test_helpers.claims_for`
(item 1), the `request.jwt.claims` sweep (item 2), the dual-hat seed persona (item 3). The E2E
`loginFresh` seam (tester's) is untouched — `e2e/` was not opened.

### 1. `test_helpers.claims_for` — the overload trap

Baseline captured from the live catalog **before** editing (the pre-change function, still
resident from a prior local `test:db`/manual run):

```
proname=claims_for  owner=postgres  prosecdef=f (INVOKER)  provolatile=v  lang=plpgsql
args = (p_user uuid, p_is_admin boolean default false)
proargnames = {p_user,p_is_admin}
proacl = {=X/postgres,postgres=X/postgres,authenticated=X/postgres}
```

⚠ **Confirmed the named trap is real**: `CREATE OR REPLACE FUNCTION test_helpers.claims_for(p_user uuid, p_is_admin boolean default false, p_active_role text default null)`
would NOT replace the 2-arg function — Postgres identifies a function by its argument
**type list** (`uuid,boolean` vs `uuid,boolean,text`), not by name, so this would mint a
**second, coexisting overload**, and any existing 2-positional-arg call site
(`claims_for(x, true)`) then fails "function is not unique". `test_helpers` schema is
`create schema if not exists` (idempotent, never dropped between runs — see
`supabase/tests/00_setup.sql` header comment), so the stray overload would persist across
runs, not just within one.

**Fix applied** in `supabase/tests/00_setup.sql`: `drop function if exists
test_helpers.claims_for(uuid, boolean);` immediately before the new 3-arg
`create function` (not `create or replace` — nothing to replace once dropped). New
parameter `p_active_role text default null`: when null, **no `active_role` key is added
to the claims object at all** (not a JSON null — an absent key), so every existing 2-arg
call site (`claims_for(uid)` / `claims_for(uid, is_admin)`) produces byte-identical JSON to
before Stage 1. When non-null, `'active_role', p_active_role` is merged in via `||`.

**Property-loss check** (the "a rebuild silently loses properties" lesson): none of
`owner`, `prosecdef`, `provolatile`, or `language` are set explicitly in either the old or
new `create function` statement, so none can regress by omission. The ACL
(`{=X/postgres,postgres=X/postgres,authenticated=X/postgres}`) is **not** hand-preserved
either — it doesn't need to be: `00_setup.sql` ends with a blanket
`grant execute on all functions in schema test_helpers to authenticated;` that runs on
*every* file execution, after every function (re)definition, so the ACL self-heals
regardless of drop-then-create.

**Verified from `pg_proc`, post `test:db` run** (baseline vs. after, side by side):

| Property | Baseline (2-arg, pre-Stage-1) | After (3-arg, post-fix) |
| --- | --- | --- |
| Signature count for `claims_for` | 1 | **1** (`select count(*) from pg_proc … = 1`) |
| args | `p_user uuid, p_is_admin boolean` | `p_user uuid, p_is_admin boolean, p_active_role text` |
| owner | postgres | postgres (unchanged) |
| `prosecdef` | f (INVOKER) | f (INVOKER, unchanged) |
| `provolatile` | v (VOLATILE) | v (unchanged) |
| `proacl` | `{=X/postgres,postgres=X/postgres,authenticated=X/postgres}` | identical string (unchanged) |

No regression on any axis; the overload trap did not materialize.

### 2. The `request.jwt.claims` sweep — bounded by the property, not the filename

Swept `grep -rn "set_config('request\.jwt\.claims'" supabase/` (166 hits before this
session's edits). Classified every hit by what it actually does, not by which file it's in:

| Category | Count | Disposition |
| --- | --- | --- |
| Clears (`'', true` or `null, true`) — construct no claim, nothing to route | 140 | Left as-is; "route through claims_for" doesn't apply to a call that asserts no identity at all. Full file:line list below. |
| The canonical function itself (`test_helpers.claims_for`'s own `set_config` call) | 1 | N/A — this is the routing destination, not a site to route. |
| Inline claim-**construction** sites (`json_build_object`/`jsonb_build_object` with `sub`/`role`) | 25 → 24 after routing | 1 routed (`130_audit.sql:121`); 24 deliberately left, each reasoned below. |

**Reconciliation:** 166 sites found = 140 clear (N/A) + 1 canonical (N/A) + 1 routed +
24 deliberately left = 166. ✓.

**Routed (1):** `supabase/tests/130_audit.sql:121` — was
`set_config('request.jwt.claims', jsonb_build_object('sub', …, 'role','authenticated','is_admin', false)::text, true)`,
functionally identical to `test_helpers.claims_for((select st_x from k), false)` (same
file already calls `claims_for` two lines earlier at line 110, confirming `test_helpers`
is reachable there). Rewritten to call `claims_for` directly, so this site already carries
the `p_active_role` slot for Stage 3.

**Deliberately left (24), each with its reason:**

- `supabase/seed.sql:2067,2552,2840` (3 sites) — **structurally unreachable via
  `claims_for`.** `seed.sql` runs during `supabase db reset`, before the `test_helpers`
  schema exists (that schema is created only by `supabase/tests/00_setup.sql`, which is
  not a migration and is never applied by `db reset`). "Add the claim slot" is the only
  applicable half of the Stage-1 instruction, and doing so now would require deciding
  *which* role each impersonated seed-time RPC call (`grant_role`, `submit_response`,
  indicator recording) is "wearing" — a decision entangled with Stage 3's own design (what
  `has_role` requires for a raw, hook-bypassing `set_config`, since seed.sql never goes
  through `custom_access_token_hook`). Recorded as a **known Stage-3 dependency**: once
  Stage 3 adds the active-role condition to `has_role`, these 3 seed.sql call sites will
  need an explicit `active_role` key or `db reset`'s own seed step breaks under D5
  fail-closed. Stage 3's task list should pick this up explicitly — flagging it now rather
  than silently deferring it.
- `supabase/demo/seed-revisao-prontuario.sql:1027` (1 site) — same structural reason
  (not a migration, not part of `db reset`'s E2E seed — CLAUDE.md: "own tenant, NOT the
  E2E seed"), plus it's explicitly out of the pgTAP/E2E test-harness contract this Stage
  is hardening.
- `supabase/tests/224_memberships_collapse.sql` (20 sites, lines 90, 99, 113, 125, 137,
  153, 187, 199, 217, 226, 237, 248, 262, 327, 331, 340, 344, 353, 357, 445) — reachable
  via `claims_for` in principle (this is a pgTAP file), but **deliberately left**: this
  file table-tests `grant_role`/`revoke_role` RBAC edges with tight positive/negative
  assertions across ~20 distinct principals; converting 20 call sites in one pass has real
  regression risk for **zero present behavioural benefit** (`active_role` is not consumed
  by anything until Stage 3 exists). This file is exactly the kind of `has_role`/
  `grant_role` surface Stage 3's own mandated sweep already covers ("a sweep of every
  4-arg / `_for` call site" + "diff-scoped door sweep over every touched gate") — it will
  be touched there, under review, when the change is load-bearing. Named here so Stage 3
  doesn't have to rediscover it.

**Plan-vs-substrate finding:** the plan (§3) cites `130_audit` and `180_user_registration`
as examples of inline-construction sites. `180_user_registration.sql` has **three**
`set_config('request.jwt.claims', …)` occurrences (lines 222, 248, 257) and **all three are
clears** (`'', true`) — zero construction sites. The plan's own example is wrong on the
substrate, a smaller instance of this project's recurring "verify against the live
artifact, not the prose" lesson. Not acted on further (there's nothing to route in that
file), but flagging it because the plan cites it as a to-do site.

Full `file:line` inventory (all 166 pre-session hits) — reproducible via
`grep -rn "set_config('request\.jwt\.claims'" supabase/`; the 25 constructing sites
(pre-routing) are reproducible via
`grep -rn -A1 "set_config('request\.jwt\.claims'" supabase/ | grep -B1 "json_build_object\|jsonb_build_object" | grep "set_config"`.
Not pasted in full here (140 clear-site lines add no information beyond "clear, not
applicable") — the two grep recipes above regenerate the exact same list on demand, which
is the more durable record.

### 3. Dual-hat seed persona — `dualhat.a@test.local`

Added to `supabase/seed.sql` (header roster comment + `v_users` entry, id
`00000000-0000-0000-0000-0000000000f6`, next free id after the existing `…f5`) plus a new,
separate `insert into public.memberships` statement — **no existing insert statement was
edited**, no existing persona's row was touched.

Scope derived from the seed's own existing pattern, not assumed:
- `org_admin`, **org-tier** (`organization_id = '0c000000-…-00a'` / Rede A, `hospital_id
  null`) — same shape as `orgadmin.a@test.local`.
- `quality_reviewer`, **hospital-tier** (`organization_id = '0c000000-…-00a'`,
  `hospital_id = '05000000-…-00a'` / Hospital Central A) — same shape and same hospital as
  `quality.a@test.local`, chosen so the new persona's quality-reviewer behaviour is
  directly comparable to an existing, well-tested fixture.

Two role TYPES on one principal via two separate `memberships` rows is an already-proven
pattern in this seed (`solo.c@test.local` holds `org_admin` + `hospital_admin` on Rede C —
AFF T3.5), so no new invariant is being tested by the insert shape itself.

`multi@test.local` was not touched — confirmed by diff (see gate section) — and remains
the D2 negative case (two commissions, one role type ⇒ no picker).

**Risk check performed before committing to this shape:** does adding a `quality_reviewer`
row (or any seed row) risk breaking an existing pgTAP assertion that counts
`public.memberships`/`public.profiles` globally (e.g.
`supabase/tests/306_quality_reviewer_role.sql:230`,
`select count(*)::int from public.memberships where role = 'quality_reviewer'`, asserted
`= 0`)? Investigated and ruled out — and worth recording the actual mechanism, since the
first hypothesis tried here (a separate seed-free "shadow" database) turned out to be
**wrong** and was caught only by direct verification, not assumed:
- `supabase test db` (`npm run test:db`) runs pgTAP directly against the SAME local dev
  database `db reset --local` seeds — confirmed two ways: (a) its log header prints
  "Connecting to local database..."; (b) manually re-running `supabase/tests/00_setup.sql`
  against that same database via `docker exec … psql` hit
  `function "claims_for" already exists with same argument types` — proof the prior
  `test:db` run had already created `test_helpers.claims_for` there, permanently.
- The real isolation mechanism is `test_helpers.bootstrap()` itself: it opens with
  `truncate table public.organizations cascade;` (`supabase/tests/00_setup.sql:81`), and
  the FK graph (`hospitals`→`organizations`, `commissions`→`hospitals`,
  `memberships`→`commissions`/`hospitals`/`organizations`, `profiles.home_organization_id`
  →`organizations`) means that single truncate cascades through essentially the whole
  tenancy-anchored schema — confirmed live in the `test:db` log: "truncate cascades to
  table … hospitals … profiles …" etc. Nearly every content-bearing pgTAP file (306
  included, line 19) calls `bootstrap()` as its first step and wraps itself in
  `begin; … rollback;`, so that file's own truncate-and-rebuild is undone at file end —
  but because EVERY such file re-truncates again at its OWN start, `seed.sql`'s rows are
  invisible for the near-entirety of a `test:db` run and only durably visible **between**
  full runs, which is exactly what a `docker exec … psql` check outside any pgTAP
  transaction sees (confirmed: 3→4 `quality_reviewer` rows present, unchanged, both
  immediately before and immediately after two separate full `test:db` runs in this
  session). This matches `test_helpers.bootstrap()`'s own header comment ("independent of
  seed.sql") — the "independent" is achieved by data isolation via truncate-per-file, not
  a separate database.

Conclusion, now verified against the real mechanism rather than a guess: **`seed.sql`
changes cannot perturb any pgTAP assertion that runs after a `bootstrap()` call**, which is
effectively the whole suite. E2E (Playwright), which DOES read `seed.sql` directly, is the
tester's surface and out of scope for this session (explicitly not run here).
