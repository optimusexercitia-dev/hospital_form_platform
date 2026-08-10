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
session's edits). Classified every hit by what it actually does, not by which file it's in.

**Correction (lead ruling, 2026-08-09):** the initial cut of this sweep left
`tests/224_memberships_collapse.sql`'s 20 sites deliberately unrouted, reasoning
"disproportionate for a harness-only stage." The lead reversed that call: `224` is not
peripheral — it is the memberships-collapse **lock** suite, its §5/§7 assertions
(`grant_role → wrapper true`, the 27-wrapper truth table) resolve entirely through
`has_role`, the exact function Stage 3 amends with the caller-only hat condition, and
these sites hand-mint the JWT payload, bypassing `custom_access_token_hook` entirely —
so the implicit single-role break-glass derive (which happens at token-mint time,
inside the hook) can never rescue them. At Stage 3, `active_role()` would return null
for all 20, the caller-side conjunct `p_role = app.active_role()` goes NULL, and every
wrapper-true assertion in this file flips red — inside Stage 3's own red window, which
D10 exists to keep small and real. Routing now (still `p_active_role => null` by
default, so no claim is minted and the suite stays green) means Stage 3 flips one
argument per site instead of rewriting raw SQL under time pressure. **All 20 sites are
now routed** — see below. The independently-reproduced census (140 clears + 25
constructions, of which the 26th accounting entry is `130_audit`'s already-routed site)
confirmed the underlying count was right; only the disposition of `224` changed.

| Category | Count | Disposition |
| --- | --- | --- |
| Clears (`'', true` or `null, true`) — construct no claim, nothing to route | 140 | Left as-is; "route through claims_for" doesn't apply to a call that asserts no identity at all. |
| The canonical function itself (`test_helpers.claims_for`'s own `set_config` call) | 1 | N/A — this is the routing destination, not a site to route. |
| Inline claim-**construction** sites (`json_build_object`/`jsonb_build_object` with `sub`/`role`) | 25 | **21 routed** (1 `130_audit.sql` + 20 `224_memberships_collapse.sql`); **4 left, structurally unreachable** (not a scope call — `test_helpers` genuinely does not exist in their execution context). |

**Reconciliation:** 166 sites found = 140 clear (N/A) + 1 canonical (N/A) + 21 routed +
4 unreachable = 166. ✓.

**Routed (21):**
- `supabase/tests/130_audit.sql:121` — was
  `set_config('request.jwt.claims', jsonb_build_object('sub', …, 'role','authenticated','is_admin', false)::text, true)`,
  functionally identical to `test_helpers.claims_for((select st_x from k), false)` (same
  file already calls `claims_for` two lines earlier at line 110, confirming `test_helpers`
  is reachable there).
- `supabase/tests/224_memberships_collapse.sql` — 20 sites (original lines 90, 99, 113,
  125, 137, 153, 187, 199, 217, 226, 237, 248, 262, 327, 331, 340, 344, 353, 357, 445),
  all `set_config('request.jwt.claims', json_build_object('sub', (select <principal> from
  k), 'role','authenticated')::text, true)`, collapsing into exactly 6 byte-identical
  patterns by principal (`sa_x`×10, `st_x`×3, `sa_y`×2, `st_y`×2, `admin`×2, `st_x2`×1 —
  verified by `grep -c` before editing, summing to 20), each rewritten to
  `test_helpers.claims_for((select <principal> from k))`. A single explanatory comment
  was added near the top of the file rather than repeating the rationale at all 20 call
  sites (kept the diff to +33/−40 instead of ballooning it with 20 repeated 4-line
  comment blocks).

**Payload-diff verification (item required by the lead — "prove the routing is faithful,
not just green").** Ran both sides for the same UUID directly against the live catalog:

```
raw:         json_build_object('sub', '1111…'::uuid, 'role','authenticated')::text
             → {"sub" : "1111…", "role" : "authenticated"}
claims_for:  test_helpers.claims_for('1111…'::uuid); current_setting('request.jwt.claims', true)
             → {"sub": "1111…", "role": "authenticated", "is_admin": false}
```

Field-by-field: `sub` — identical. `role` — identical. `is_admin` — **added** by
`claims_for` (raw omitted the key entirely; `claims_for` always sets it, default
`false`). This is the one and only difference (the surrounding whitespace-around-colon
is a `json_build_object` vs `jsonb_build_object`-cast formatting artifact, immaterial to
any `->>'key'` read).

**Verified inert**, not just assumed: `app.is_admin()` (fetched live via
`pg_get_functiondef`) is:
```sql
v_claim := nullif(current_setting('request.jwt.claims', true), '');
if v_claim is not null and (v_claim::jsonb ->> 'is_admin') = 'true' then
  return true;
end if;
return exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
```
For the raw payload, `->>'is_admin'` on a missing key returns SQL `NULL`; `NULL = 'true'`
evaluates to `NULL` (not `TRUE`), so the `if` is skipped. For `claims_for`'s payload,
`->>'is_admin'` returns the text `'false'`; `'false' = 'true'` evaluates to `FALSE`, so
the `if` is *also* skipped. Both payloads fall through to the identical `profiles.is_admin`
check, with identical inputs (`auth.uid()`, which the `sub` field — unchanged — controls).
Also confirmed, live catalog: `app.is_admin()` is the **only** function in `app`/`public`
whose body references both `is_admin` and `jwt.claims` (`select … from pg_proc … where
prosrc like '%is_admin%' and prosrc like '%jwt.claims%'` → 0 rows besides `is_admin()`
itself) — so no other predicate in this file's call graph can read the `is_admin` claim
key any differently. **No behavioural difference; nothing to stop and report.**

**Left, structurally unreachable (4) — confirmed, not just plausible:**
- `supabase/seed.sql:2067,2552,2840` (3 sites) and
  `supabase/demo/seed-revisao-prontuario.sql:1027` (1 site) — `test_helpers` is created
  by `supabase/tests/00_setup.sql`, i.e. minted by the pgTAP harness, not by any
  migration. `seed.sql` runs during `supabase db reset`, entirely before any pgTAP file
  ever executes, so `test_helpers.claims_for` genuinely does not exist in that execution
  context — not a scope judgement call, a fact about what schema is present when. Kept
  as raw `set_config` calls. **Stage 3 carry-forward obligation** (below) replaces the
  earlier one-line "known dependency" note per the lead's instruction to write it as a
  reasoned obligation, not a TODO.

**Plan-vs-substrate finding (unchanged):** the plan (§3) cites `130_audit` and
`180_user_registration` as examples of inline-construction sites. `180_user_registration.sql`
has **three** `set_config('request.jwt.claims', …)` occurrences (lines 222, 248, 257) and
**all three are clears** (`'', true`) — zero construction sites. The plan's own example is
wrong on the substrate, a smaller instance of this project's recurring "verify against the
live artifact, not the prose" lesson. Not acted on further (there's nothing to route in
that file), but flagging it because the plan cites it as a to-do site.

Full `file:line` inventory (all 166 pre-session hits) — reproducible via
`grep -rn "set_config('request\.jwt\.claims'" supabase/`; the 25 constructing sites
(pre-routing) are reproducible via
`grep -rn -A1 "set_config('request\.jwt\.claims'" supabase/ | grep -B1 "json_build_object\|jsonb_build_object" | grep "set_config"`.
Not pasted in full here (140 clear-site lines add no information beyond "clear, not
applicable") — the two grep recipes above regenerate the exact same list on demand, which
is the more durable record.

### 2b. Stage 3 carry-forward obligation — the 4 unreachable `seed.sql`/demo-seed sites

Written as an obligation with its reasoning, per the lead's instruction, not as a
one-line TODO (an unexplained TODO is the shape that goes stale in this repo).

**What these sites do today:** `supabase/seed.sql:2067,2552,2840` each impersonate
`chefe.ccih@test.local` (org-a's CCIH `staff_admin`, the `v_chefe` local variable) by
hand-minting `{"sub": v_chefe, "role": "authenticated"}` via `set_config`, immediately
before calling a superuser-invoked RPC (recording an indicator measurement; a
controlled-document RPC gated by `app.in_controlled_docs_rpc`) so that the RPC's
`created_by`/`granted_by`-style attribution columns and any `audit_write` call resolve
`auth.uid()` to the intended persona rather than `NULL`. `supabase/demo/seed-revisao-prontuario.sql:1027`
does the analogous thing for its own demo tenant's persona (`v_e1`).

**Why `claims_for` can never reach them:** `test_helpers` is a pgTAP-harness schema
(`supabase/tests/00_setup.sql`, not a migration); `seed.sql` and the demo seed run
during `supabase db reset` / a direct `psql -f` apply, respectively — both entirely
outside any pgTAP session. There is no future version of "route through `claims_for`"
that applies here; the fix, if any, has to be a change to what these sites themselves
mint.

**The obligation, precisely:** once Stage 3 adds the caller-only active-role condition
to `has_role` (plan §2: `… AND (p_user_id is distinct from auth.uid() OR p_role =
app.active_role())`), any RPC these 4 sites call whose authorization path resolves
through `has_role` for the impersonated principal will see `app.active_role()` return
NULL (no `active_role` key in a payload that was never touched) — under D5 (fail
closed), that principal now holds no active role, and `has_role` denies. Stage 3 must
therefore, for each of these 4 sites:
1. **Determine whether the RPC/insert path it precedes actually calls `has_role`** (or
   `has_role_any`/`is_member_of`, which route through it) **at all**, versus being a bare
   superuser `insert`/`update` that only reads `auth.uid()` for a `created_by`/`granted_by`
   column with no membership predicate in the path. If the latter, no `active_role` key
   is needed — `auth.uid()` alone resolves via `sub`, unaffected by Stage 3.
2. **Verify no trigger fired by these insert paths calls a membership predicate.**
   `seed.sql`'s indicator-measurement and controlled-document inserts run triggers
   (`audit_write` at minimum); Stage 3 must check each trigger body from the catalog
   (`pg_trigger` → `pg_proc`, never assumed from the migration text) for any call into
   `has_role`/`has_role_any`/`is_member_of` — if one exists, that trigger will start
   failing closed under these sites' claim-less payloads.
3. **If either check finds a `has_role`-family call in the path,** add an explicit
   `'active_role', '<role>'` key to the 4 `jsonb_build_object` calls (the seed already
   knows `chefe.ccih` is CCIH's `staff_admin` and the demo persona's role, so the value
   is not a fresh decision — restating it as a claim key is mechanical), or these 4
   `db reset` seed steps break under D5 the moment Stage 3 lands, independent of any
   product code — a broken `db reset` is a broken local-dev/CI floor for every
   subsequent teammate, not a cosmetic gap.
4. **If neither check finds one,** record that explicitly (with the catalog query used)
   rather than leaving the question open — the absence of a `has_role` call in the path
   is itself the thing that makes "no `active_role` needed" a verified conclusion instead
   of an assumption.

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

---

## Stage 1 — tester half (2026-08-09) + a lead ruling on `accessToken`

Seam landed in `e2e/helpers/auth.ts` (`d2bbc7a`): `loginFresh` gains `_actAs?: string`
(inert, `_`-prefixed per CLAUDE.md §8) and `cachedSignIn` gains `actAs?: string`, threaded
through **and** folded into the session-cache key.

**The cache-key partitioning is accepted deliberately, not overlooked.** It is more than a
pure pass-through, and that is correct: once Stage 3 makes the active hat part of what a
login *produces*, the same persona signed in under two hats is two different sessions, and
a cache keyed on email alone would hand a test the wrong hat's cookies — a failure that
would present as a flaky authorization bug, not as a cache bug. No caller passes `actAs`
today, so the key collapses to plain `email` and behaviour is byte-identical.

### Stage 3 carry-forward obligation — `accessToken` (the raw-JWT helper)

`accessToken` in the same module was deliberately left without a seam. **The reason
recorded by the tester ("out of the plan's stated scope") is not the load-bearing one, and
the real mechanism inverts the risk — so it is restated here rather than inherited.**

`accessToken` performs a **genuine password grant** against GoTrue
(`POST /auth/v1/token?grant_type=password`). It therefore passes **through**
`custom_access_token_hook`, unlike the pgTAP `set_config` sites which fabricate the claims
payload directly and bypass the hook entirely (§2). Consequences Stage 3 must not
re-derive:

1. **Single-role personas are safe by design.** The hook's implicit-derive path (D11
   break-glass: no selection row + exactly one live role type ⇒ derive) mints a valid
   `active_role` claim on every grant. Nothing to seam.
2. **Multi-role personas are strangers.** A fresh password grant opens a **new session**
   with no `active_role_selections` row, and D5 says no row + multi-role ⇒ **no claim**.
   Every RLS probe issued with that token will resolve as a stranger.
3. ~~**Today this is safe by construction** — the only principal holding two role *types* is
   `dualhat.a@test.local`.~~ ⛔ **CORRECTED 2026-08-10 (lead) — that claim was FALSE and was
   never measured.** The live catalog says **SIX** principals hold 2+ role types:
   `admin@` (org_admin+pqs_member) · `orgadmin.b@` (org_admin+staff_admin) ·
   `pqsdual.a@` (pqs_member+staff) · `solo.c@` (hospital_admin+org_admin) ·
   `staff1.qual.b@` (staff+staff_admin) · `dualhat.a@` (the intended fixture). Found by
   `tester` running the real query; the lead had asserted it from the plan's framing without
   measuring. **This is the exact failure this repo keeps recording — a data claim stated as
   fact.** Query, so it is never re-asserted: `select principal_id, count(distinct role) from
   public.memberships where expires_at is null or expires_at > now() group by 1 having
   count(distinct role) > 1;`
   The `accessToken` exposure is therefore **wider** than written — but currently **moot**:
   `accessToken` has **zero call sites** in `e2e/` outside the helper itself (measured). The
   obligation below stands as forward-looking, and its first user must not assume the helper
   is safe merely because nothing broke.

**The obligation:** before Stage 3 declares green, enumerate the `accessToken` call sites
(by the property — callers of the helper, not by filename) and, for each, determine whether
its persona holds more than one role type. Any that does needs either an `assume_role` call
against that token's own session before the probe, or an explicit `active_role` — and the
choice must be recorded. ⚠ Note the asymmetry with `cachedSignIn`: a browser session can be
sent through the picker UI, but a raw grant has **its own `session_id`** and cannot inherit
a hat chosen in a browser context. Do not assume one seam covers both.

Corollary worth keeping: because `accessToken` is the only E2E path that exercises the
**real** hook, it is also the natural instrument for Stage 3's "stale/hatless session sees
stranger-level nothing" keystone — a liability and the best available probe are the same
mechanism here.

---

## Stage 2 — behaviour-preserving normalisation (backend, 2026-08-10)

Plan: `docs/plans/act-as-role-assumption.md` §4 Stage 2. Migration:
`supabase/migrations/20260918001000_act_stage2_rebase_direct_memberships_readers.sql`.
Harness fix (separate commit, own cause): `supabase/tests/00_setup.sql`.

### 1. Derivation — re-derived from the catalog, not accepted from the hypothesis

**What was actually done, stated precisely because the two claims are different in
strength:** the plan's §4 Stage 2 text names a hypothesis of 8 functions (carried over
from the QA-r1 census, itself taken before ADR 0105's rename rewrote 75 function
bodies). This session did not adopt that list. It swept the **live catalog** — every
`boolean`-returning function in `app` and `public` (149 total, comment-stripped
`prosrc`, checked for a direct `memberships` read with no `has_role`/`has_role_any`
call) — and only *afterward* compared the result to the hypothesis. **"The catalog
agreed with the census" is the finding; "I used the census" would have been a
different and weaker thing to report**, and is not what happened.

Query (live catalog, not migration text):

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.prorettype::regtype
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app','public') and p.prorettype = 'boolean'::regtype;
-- 149 rows (app: 127, public: 22)
```

Each of the 149 function bodies was fetched via `pg_get_functiondef`, comments stripped
(block `/* */` and line `--`, string-literal-aware so a `--` inside a literal isn't
mistaken for a comment start), then classified:

- `has_memberships` = a word-boundary match for `memberships` in the stripped body
  (does **not** false-positive on `memberships_role_check` etc. — `_` is a word
  character, so the boundary correctly fails to match inside a longer identifier).
- `has_role_call` = a word-boundary match for a call to `has_role(` or `has_role_any(`
  in the stripped body.
- **Candidate** = `has_memberships AND NOT has_role_call`.

Result: 10 candidates, of which 2 are `app.has_role` and `app.has_role_any`
themselves (the canonical target functions — expected to be their own base case, not
something to rebase onto themselves). The remaining **8, exactly**:

`app.can_manage_professional`, `app.is_entitled_document_approver`,
`app.is_hospital_member_of`, `app.is_org_level_admin_within`, `app.is_org_member`,
`app.is_pqs_member_of_any`, `app.is_pqs_operator_in_org_for`,
`app.is_quality_reviewer_in_org`.

**Reconciliation: 8 = 8.** No delta to report — the catalog-derived set matches the
plan's hypothesis by name, exactly. (A "has both memberships-text and has_role-call"
bucket was also checked, as a comment-trap sanity check per the program's own named
lesson — 0 hits pre-migration, confirming no false positive was hiding a 9th
candidate behind a stale comment.)

Post-migration, the same census was re-run against the live catalog: the candidate
bucket contains only `has_role`/`has_role_any` (unchanged, as expected); 6 of the 8
(`is_org_member`, `is_hospital_member_of`, `is_entitled_document_approver`,
`is_org_level_admin_within`, `is_pqs_operator_in_org_for`,
`is_quality_reviewer_in_org`) now carry **zero** `memberships` references at all; 2
(`is_pqs_member_of_any`, `can_manage_professional`) still reference `memberships`
directly but now **also** call `has_role`, landing correctly in the "has both" bucket
— by design (see §2 below for why those two retain a direct read).

### 2. Per-function rewrite shape

`has_role`'s 4-arg body matches on `case p_scope_type when 'organization' then
m.organization_id = p_scope_id when 'hospital' then m.hospital_id = p_scope_id when
'commission' then m.commission_id = p_scope_id else false end` — an exact same-tier
scope match, no hierarchy. `has_role_any` is the same without the `role` filter. Given
`memberships_scope_shape`'s CHECK (queried live, not assumed): org-tier roles
(`org_admin`, `nsp_org_admin`) carry `organization_id` set, `hospital_id`/
`commission_id` null; hospital-tier roles (`hospital_admin`, `nsp_coordinator`,
`pqs_member`, `technical_director`, `technical_director_deputy`, `quality_reviewer`)
carry **both** `organization_id` and `hospital_id` set; commission-tier roles
(`staff_admin`, `staff`) carry only `commission_id`. This shape is what makes each
rewrite below an exact, provable re-expression rather than an approximation:

1. **`is_org_member`** — "any-role member of a commission belonging to this org." Was
   a direct `memberships` join `commissions`. Hierarchical (org -> its commissions), so
   not a single `has_role_any` call; rewritten as `exists (commissions c where
   c.organization_id = p_org_id and has_role_any('commission', c.id, uid))` — an exact
   re-expression, since the original's `m.commission_id is not null ... c.id =
   m.commission_id ... m.principal_id = uid ... unexpired` **is** `has_role_any`'s own
   definition for `scope_type='commission'`.
2. **`is_hospital_member_of`** — same shape, `c.hospital_id = p_hospital_id`.
3. **`is_entitled_document_approver`** — same shape, explicit `p_user` param (not
   `auth.uid()`).
4. **`is_org_level_admin_within`** — org-tier row, `role IN ('hospital_admin',
   'nsp_org_admin')`. Both carry `organization_id` on a match, so `has_role('organization',
   ..., 'hospital_admin', uid) OR has_role('organization', ..., 'nsp_org_admin', uid)`
   reproduces the original's direct `m.organization_id = p_org_id` filter exactly.
5. **`is_pqs_member_of_any`** — "`pqs_member` at ANY hospital", no `scope_id` known in
   advance, so not expressible as one `has_role` call. Rewritten as `exists
   (memberships m where m.principal_id = p_user_id and m.hospital_id is not null and
   has_role('hospital', m.hospital_id, 'pqs_member', p_user_id))` — the outer scan is
   a candidate-narrowing enumeration only (any role, not just `pqs_member`; the
   `pqs_member` row itself, if any, is always among the user's own hospital-tier
   rows), and the AND-composition means the true/false outcome is **entirely**
   governed by the inner `has_role` call — a narrowing-safe pattern (unlike an
   OR-composition, see `can_manage_professional` below), so this function inherits
   Stage 3's hat condition correctly once `has_role` gains it.
6. **`is_pqs_operator_in_org_for`** — `role IN ('pqs_member', 'nsp_coordinator')`,
   org-tier match. Both roles carry `organization_id` set on a match (per the CHECK),
   so `has_role('organization', ..., 'pqs_member', uid) OR has_role('organization', ...,
   'nsp_coordinator', uid)` reproduces the original exactly; the original's `hospital_id
   is not null` guard is always true for these two roles per the same CHECK, so
   dropping it changes nothing.
7. **`is_quality_reviewer_in_org`** — single role, org-tier match; direct 1:1 rewrite.
8. **`can_manage_professional`** — see §3, the one non-trivial case.

### 3. `can_manage_professional` — a pre-existing quirk deliberately preserved, not fixed

**Named explicitly so a later reader does not conclude Stage 2 introduced this, or
"fix" it as a stray inconsistency without a ruling.** The original memberships branch —

```sql
exists (select 1 from public.memberships m join public.commissions c on c.id =
  m.commission_id where c.organization_id = p_org and m.principal_id = p_uid and
  m.role = 'staff_admin')
```

carries **no expiry filter** — unlike every one of its 7 siblings above, and unlike
`has_role`'s own canonical check. Verified this is real, not a misread: fetched
`prosrc` directly (not `pg_get_functiondef`, to rule out formatting truncation),
confirmed via `pg_description` there is no explanatory comment, and confirmed via a
`prosrc ~ 'can_manage_professional'` sweep that no RLS policy or other function
compensates for it elsewhere. Seed data carries **zero** memberships with `expires_at`
set (checked live: `count(*) filter (where expires_at is not null)` = 0 for every
role), so this asymmetry is invisible to any test built only from seed fixtures — a
synthetic expired-row fixture (inserted and rolled back inside the equivalence-matrix
transaction, §4) was required to even observe it.

Delegating this branch to `has_role('commission', c.id, 'staff_admin', p_uid)` alone
would **silently narrow** behaviour (an expired `staff_admin` would newly lose the
capability) — forbidden by Stage 2's "no semantic change" rule, regardless of whether
the omission is itself a latent bug (a separate, unresolved question, flagged to the
lead — **not** fixed here, because fixing it **is** a semantic change and belongs to
its own reviewed change, not smuggled into a normalisation stage). The migration
instead reproduces the omission **verbatim** via an explicit compensating clause:

```sql
app.has_role('commission', c.id, 'staff_admin', p_uid)
or exists (select 1 from public.memberships m where m.commission_id = c.id
  and m.principal_id = p_uid and m.role = 'staff_admin'
  and m.expires_at is not null and m.expires_at <= now())
```

`has_role(...)` covers the non-expired subset (now hat-aware from Stage 3 onward); the
compensating clause covers exactly the expired subset `has_role` would otherwise
exclude. The two are a clean partition of the original predicate (split on
`expires_at`) — no gap, no overlap — proved empirically in §4 with a synthetic expired
fixture, not merely asserted.

Separately noted in the migration's own comment, unrelated to the memberships rebase
and **unchanged** by it: `is_org_admin_of(p_org)` inside this same function reads the
**caller's** `auth.uid()`, not the `p_uid` target parameter. Checked every one of the
10 call sites (`create_professional_profile`, `update_professional_profile`,
`set_professional_link_state`, `create_ethics_sanction_type`,
`archive_ethics_sanction_type`, `create_case_assignment_role`,
`archive_case_assignment_role`, `redact_professional_profile`,
`create_ethics_allegation_category`, `archive_ethics_allegation_category`) — all bind
`p_uid => auth.uid()`, so caller and target coincide in every live call, and this is
not a third-party-check bug in practice. Flagged for completeness per plan §2's
caller-vs-third-party concern; not altered.

### 4. Empirical equivalence proof — the load-bearing artefact of this stage

**Why a green pgTAP suite is not accepted as proof.** A refactor that accidentally
widens a predicate passes the existing suite *by construction* — nothing in `224`'s
`is_entitled_document_approver` assertions (or any sibling test) would catch, say,
`is_org_member` starting to also return true for a same-org non-member, unless a test
happens to assert exactly that negative. The suite proves "nothing *known* broke," not
"nothing changed."

**The matrix.** One SQL harness (`equivalence_matrix.sql`, transactional,
`ROLLBACK`-terminated so it has zero persistent effect on the DB regardless of what it
does internally — including the synthetic expired-membership fixture for
`can_manage_professional`) exercises all **8** functions over **61 (principal, scope)
cases**, built from real seed data plus one synthetic row:

| Row class | Present for | Example |
| --- | --- | --- |
| TRUE (positive) | all 8 | `chefe.ccih@` (staff_admin, CCIH-A) -> `is_org_member(orgA)` = t |
| FALSE — wrong scope, same tenant | all 8 | `chefe.ccih@` -> `is_hospital_member_of(hospA2)` = f (their commission is at hospA1) |
| FALSE — wrong role, same scope | 6/8 | `nspcoord.a@` -> `is_pqs_member_of_any` = f (nsp_coordinator != pqs_member, same hospital-tier shape) |
| FALSE — admin-adjacent but not the checked relation | all 8 | `orgadmin.a@` (org-tier only, no commission row) -> `is_org_member`/`is_hospital_member_of` = f |
| **Cross-tenant** (org-B principal vs org-A scope, and vice versa) | all 8 | `orgadmin.b@` (org_admin B + staff_admin@Qualidade-B) -> `is_org_member(orgA)` = f, `is_org_member(orgB)` = t |
| **Null/absent-scope edge** (a syntactically valid but non-existent org/hospital uuid) | 7/8 (`can_manage_professional` covered by the random-principal case instead) | `is_quality_reviewer_in_org(absent_org)` = f |
| **`can_manage_professional`-specific**: caller/target split (unrelated caller, real staff_admin target) | 1 | caller=random, target=chefe.ccih -> t (branch keys off `p_uid`, not the caller) |
| **`can_manage_professional`-specific**: synthetic EXPIRED staff_admin fixture | 1 | orgadmin.a + a temporary expired staff_admin row at CCIH-A -> t (the quirk, preserved) |
| Direct probe of what a **naive** `has_role`-only delegate would return on that same expired fixture | 1 (documentation, not one of the 8) | `has_role('commission', ccih-a, 'staff_admin', orgadmin.a)` = f — proves the compensating clause is load-bearing, not decorative |

**Why this row set could have caught a widening or narrowing, not just confirmed a
guess:** every function has at least one TRUE case, one FALSE case that shares scope
or role with a TRUE case (so a predicate that dropped a condition would flip it), and
one cross-tenant FALSE case (so a predicate that lost its scope filter — the single
most likely failure mode of a commission-to-org hierarchy rewrite — would flip it).
The cross-tenant cases specifically exercise the exact rewrite risk in this migration:
`is_org_member`/`is_hospital_member_of`/`is_entitled_document_approver` replace a
direct `c.organization_id = p_org_id` filter with an `exists (commissions c where ...)`
wrapper — if that wrapper's `where` clause were dropped or mis-scoped, every
cross-tenant case would go from `f` to `t`, and the matrix would show it. The
`can_manage_professional` expired-fixture case specifically exercises the one
identified narrowing risk (delegating to `has_role` alone would flip the expired case
from `t` to `f`) — proved by running the **naive** `has_role`-only probe directly
against the same fixture and observing `f`, confirming the matrix's negative control
is real, not assumed.

**Execution: captured before the migration, re-captured after, diffed.**

```
diff matrix_before.txt matrix_after.txt
# exit 0 — byte-identical, 61/61 cases, zero deltas
```

No cell changed. This is the empirical proof of "no semantic change" — not an
inference from reading the SQL, though the reading (§2–§3) independently predicts the
same result for every case, which is itself a cross-check the two methods agree.

One labeling correction made during construction, recorded because it could otherwise
look like a result: two `multi@test.local` cases were initially annotated "expect T"
against org B, on the wrong assumption that commission `b0...b1` belonged to Rede B (it
is actually Rede A's second commission — Comissão de Farmácia e Terapêutica, Hospital
Central A). Both functions correctly returned `f` before this was caught; only the
comment was wrong, not the code or the result. Fixed before capturing the reported
`matrix_before.txt`.

### 5. Catalog property diff — every function, every axis

For each of the 8, `proacl`, `prosecdef`, `provolatile`, `proconfig`, owner, and the
argument-name list were captured **before** the migration (live catalog, not the
migration file) and re-captured **after**, then compared:

| Function | `prosecdef` | `provolatile` | owner | `proconfig` | `proacl` |
| --- | --- | --- | --- | --- | --- |
| `is_org_member` | t -> t | s -> s | postgres -> postgres | `search_path=app, public, pg_catalog` (unchanged) | `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` (unchanged) |
| `is_hospital_member_of` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged (identical string) |
| `is_entitled_document_approver` | t -> t | s -> s | postgres -> postgres | unchanged | **NULL -> NULL** (pre-existing default-privilege state — PUBLIC/authenticated/anon all carry implicit EXECUTE, unlike its 7 siblings' explicit ACL. Not introduced by this migration and not touched by it: `CREATE OR REPLACE` never rewrites the ACL, verified by re-checking `has_function_privilege` for `authenticated`/`anon` before and after — both `t`/`t` throughout. Flagged as a pre-existing hardening gap, out of Stage 2's scope to fix) |
| `is_org_level_admin_within` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged |
| `is_pqs_member_of_any` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged |
| `is_pqs_operator_in_org_for` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged |
| `is_quality_reviewer_in_org` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged |
| `can_manage_professional` | t -> t | s -> s | postgres -> postgres | unchanged | unchanged |

Argument names: unchanged for all 8 (`p_org_id`/`p_hospital_id`/`p_org`/`p_uid`/
`p_hospital`/`p_user`/`p_user_id` — identical lists, identical order, identical
positions — verified via `pg_get_function_identity_arguments`). No parameter was
renamed (a rename would have been a privilege reset per the standing lesson); every
migration statement is `CREATE OR REPLACE FUNCTION`, never `DROP` + `CREATE`.

**Finding, not fixed here:** `is_entitled_document_approver`'s NULL/default ACL
(PUBLIC-executable) is wider than its 7 rebased siblings, which all carry an explicit
`authenticated`+`service_role` grant with PUBLIC revoked. This predates Stage 2,
survives it unchanged (by construction — `CREATE OR REPLACE` cannot touch an ACL it
doesn't set), and is not something a behaviour-preserving stage may correct
unilaterally. Worth a dedicated hardening follow-up.

### 6. Regression found and fixed — `test_helpers.claims_for` non-idempotency (Stage 1 defect)

**This is a separate defect from the Stage 2 migration, with its own cause, found only
because Stage 2's gate requires a tool (the diff-scoped door sweep) that Stage 1's own
gate structure cannot exercise.**

**Mechanism.** Stage 1 (2026-08-09) changed `test_helpers.claims_for` in
`supabase/tests/00_setup.sql` from `create or replace function ... (p_user uuid,
p_is_admin boolean default false)` to `drop function if exists
test_helpers.claims_for(uuid, boolean); create function test_helpers.claims_for(p_user
uuid, p_is_admin boolean default false, p_active_role text default null) ...` — a plain
`create function`, not `create or replace`, with the `drop` scoped only to the OLD
2-arg signature. This is safe **exactly once**: the first `supabase test db` run after
the file changed, when only the stale 2-arg function is resident (the `drop` clears
it, the `create` mints the 3-arg version fresh). On every **subsequent** run against
the same reset, the `drop ... (uuid, boolean)` is a no-op (that overload no longer
exists — it was replaced, not left beside the new one), and the plain `create
function test_helpers.claims_for(uuid, boolean, text)` collides with the **already
resident** 3-arg function: `function "claims_for" already exists with same argument
types`, aborting `00_setup.sql` itself before it emits any TAP plan — `pg_prove`
reports `Wstat: 768 (exited 3), Parse errors: No plan found in TAP output`, and the
whole run scores `Result: FAIL` with a Files/Tests count *below* baseline.

**Why the standing gate structure could not see this.** CLAUDE.md §6 step 1 requires
pgTAP to run on a **fresh** `supabase db reset` — which is precisely the one
circumstance under which this defect is invisible, because a fresh reset always
produces the "first run" condition. The defect only manifests on a **second**
`supabase test db` invocation against the *same* reset, with no reset in between. The
one tool in this repo's own protocol that does exactly that is the ADR 0079 door-audit
harness (`p0-authz-door-audit.sh`) — its own preflight comment states the assumption
outright: *"this harness runs `supabase test db`, which creates/drops pgtap +
test_helpers ITSELF per run — so there is NO pgtap preflight here."* That assumption
was falsified by this defect (the schema is `create schema if not exists`, never
dropped, and — as of Stage 1 — one of its functions is no longer safely re-creatable).
Concretely: the diff-scoped sweep's own **preflight** call to `run_suite` (its second
or later `supabase test db` invocation in the session) hit `Result: FAIL` and aborted
the entire sweep with *"PREFLIGHT FAILED: baseline is NOT green."* Every future phase
whose diff-scoped sweep runs after any other `npm run test:db` invocation in the same
session — including a teammate's own manual sanity check — would hit this identically.

**Reproduced deliberately, twice, to isolate the cause** (not assumed from the
symptom): fresh reset -> `supabase test db` (PASS) -> `supabase test db` again, no reset
(**FAIL**, `00_setup.sql (Wstat: 768, exited 3), Parse errors: No plan found`) —
confirmed twice, ruling out a one-off Docker/connection flake.

**Fix** (`supabase/tests/00_setup.sql`): kept the one-time `drop function if exists
test_helpers.claims_for(uuid, boolean)` (still correctly handles the original
2-arg->3-arg transition — the argument list is part of a function's identity, so
`CREATE OR REPLACE` cannot itself absorb an arity change), but changed the `create
function` to `create or replace function`. Once the 3-arg signature is resident,
`CREATE OR REPLACE` on the **identical** signature is always idempotent — unlike the
arity-changing transition, which needed the explicit drop precisely because OR REPLACE
cannot do it. The fix restores idempotency for every run *after* the one-time
transition without reintroducing the original overload-duplication risk the `drop`
was written to prevent.

**Verified fixed, not just plausible:** fresh reset -> three consecutive `supabase test
db` runs, no reset between any of them -> **all three**: `Files=175, Tests=5636, Result:
PASS`. Re-verified again as the formal Stage 2 gate evidence (§7 below): run 1 fresh,
run 2 immediately after with no reset — both `PASS`, identical counts.

**Scope note:** this fix lands in `supabase/tests/00_setup.sql`, backend-owned test
harness code, not a migration — no catalog change, no ACL, no RLS surface. It is
committed separately (`fix(test):`) from the Stage 2 migration, since it is a distinct
defect with a distinct cause (Stage 1's overload-trap fix), not part of the
behaviour-preserving normalisation itself.

### 7. Gate — full Phase Gate step 1, both `test:db` runs, and the diff-scoped sweep

Fresh `supabase db reset --local` -> registered migrations **336 == 336** files
(confirmed before trusting any catalog query).

- `npm run test:db` **run 1** (fresh reset): `Files=175, Tests=5636, Result: PASS`.
- `npm run test:db` **run 2** (same reset, no reset in between — the regression
  re-verification): `Files=175, Tests=5636, Result: PASS`. Identical to run 1.
- `npm run gen:types` — `database.ts` byte-unchanged (no schema/RPC-signature change;
  every migration statement was `CREATE OR REPLACE` on an existing signature).
- `npm run lint` — pass (eslint 0 warnings + `lint:css-vars` + `lint:memberships-door`).
- `npm run typecheck` — pass, clean, no output.
- `ARM=census` — **INVARIANT HOLDS**: 451 live gates / 461 carrying a verdict
  (unchanged from the Stage 0/1 baseline — Stage 2 rebases 8 existing gates, adds
  zero new ones).
- `ARM=floor` — **INVARIANT HOLDS**: 80 authenticated-reachable `prosecdef` doors with
  0 calls, all on the floor allowlist (unchanged from baseline).
- **Diff-scoped door sweep**, case list derived mechanically from the migration diff
  (never by hand, per ADR 0079 Amendment 1):

  ```bash
  grep -ohiE "create (or replace )?function (app|public)\.[a-z0-9_]+" \
    supabase/migrations/20260918001000_*.sql \
    | sed 's/^.*\.//' | sort -u | grep -E "^(is_|can_|has_)" | grep -v "^is_valid_"
  # -> exactly the 8 candidate names, byte-for-byte
  ```

  `WORK=<scratch> CASES="<the 8>" bash supabase/tests/mutation/p0-authz-door-audit.sh`
  — preflight `baseline OK: Result: PASS, Files=175, Tests=5636` (itself a **4th**
  consecutive no-reset `supabase test db` success, further confirming §6's fix).

  | Function | Verdict |
  | --- | --- |
  | `app.can_manage_professional` | COVERED |
  | `app.is_entitled_document_approver` | **ERROR** (run-shape != baseline) — see below |
  | `app.is_hospital_member_of` | COVERED |
  | `app.is_org_level_admin_within` | COVERED |
  | `app.is_org_member` | COVERED |
  | `app.is_pqs_member_of_any` | COVERED |
  | `app.is_pqs_operator_in_org_for` | COVERED |
  | `app.is_quality_reviewer_in_org` | COVERED |

  Final line: `BLIND: 0   ERROR(harness): 1   (COVERED = the rest)`. **0 BLIND.**
  POLICY ARM: empty (this migration added/touched no `create policy` statement).
  `docs/reviews/authz-door-audit-findings.md` restored via `git checkout --`
  immediately after (the sweep truncates it to the 8-case subset, per the documented
  hazard).

  **`ERROR` is not a pass — covered by a targeted, hand-run, dual-direction mutation
  proof** (ADR 0079 Amendment 2: a probe in one direction only proves the arm it broke
  was reachable, not that the sibling arm is covered too):
  - Neutralized `is_entitled_document_approver` to `select false;` (`CREATE OR
    REPLACE`, live) -> `supabase test db` -> **`Failed test 45: "7.10:
    is_entitled_document_approver true for a hospital commission member
    (repointed)"`** (`224_memberships_collapse.sql`) reds; test 46 (the
    false-expecting sibling) stays green, as expected.
  - Restored, re-neutralized to `select true;` -> `supabase test db` -> **`Failed test
    46: "7.11: is_entitled_document_approver false for a non-member (platform
    admin)"`** reds; test 45 stays green — the complementary probe, proving neither
    direction is vacuous.
  - Restored to the original body; re-fetched via `pg_get_functiondef` and
    byte-diffed against the pre-mutation capture — **`diff` exit 0, identical**.
  - The automated harness's `ERROR` classification is explained, not just observed:
    both neutralized runs produced `Tests=5586`/`Tests=5609` respectively — below the
    5636 baseline — meaning some *other* file's fixture setup depends on this
    function succeeding as a precondition and aborts when it doesn't, shrinking the
    run's total test count (a "run-shape != baseline" harness limitation, not a gap in
    coverage). The two keystones in `224` are real, complementary, and non-vacuous;
    the automated tool simply cannot distinguish "keystone caught it" from "a
    downstream file also broke" when both happen in the same run.

**No push, no merge to `main`** (standing rule) — everything above is local-only.

---

## Stage 3 — THE ATOM (backend half, 2026-08-10)

Plan: `docs/plans/act-as-role-assumption.md` §4 Stage 3. Migrations:
`20260918002000_act_stage3_active_role_infrastructure.sql`,
`20260918002100_act_stage3_raw_policy_sweep.sql`. New pgTAP file:
`supabase/tests/315_act_stage3_hat_condition.sql`.

### 1. DB layer — what landed

`app.active_role_selections` (session_id PK, RLS self-select only, no
INSERT/UPDATE/DELETE policy — every write goes through the RPC) ·
`public.assume_role(p_role)` (DEFINER, in `public` — `app.*` would 404 over
PostgREST; validates against LIVE memberships or `is_admin()` for
`platform_admin`; named `ON CONFLICT (session_id)`; audits
`active_role.assumed`) · `app.active_role()` (reads the JWT claim, `text` not
`platform_role` — matches `has_role`'s existing `p_role text` param with zero
new casting surface) · `has_role`/`has_role_any` gain the §2 caller-only
condition · `member_can` gains the D13 condition via `is_member_of` (reuse,
not a second `active_role()` read) · `session_context` re-diffed, comment
augmented (no-op confirmation) · `custom_access_token_hook` extended (D11
break-glass + D5 fail-closed) · `audit_write` generalises `metadata.acting_as`
(D8).

### 2. Two catalog findings, both fixed before the pgTAP pass

**A. NULL-propagation fail-open (found running a manual sanity check, before
any pgTAP was written).** The plan's literal §2 text —
`... OR p_role = app.active_role())` — uses a plain `=` against
`app.active_role()`, which is NULL for any hatless caller. `TRUE AND NULL` is
NULL, not FALSE, and `IF NOT has_role(...) THEN raise ...` treats a NULL
condition as false-ish — the guard silently did not fire. Confirmed live: a
hatless `chefe.ccih@`-equivalent principal made `has_role(...)` return NULL,
and a `do $$ if not has_role(...) then raise exception ... end if; $$` block
did not raise. Exactly the fail-OPEN shape D5 exists to reject, on the
enforcement point D5 is written for. Fixed with `IS NOT DISTINCT FROM`
(Postgres's NULL-safe equality — always TRUE or FALSE) in both `has_role` and
`has_role_any`; verified all 4 truth-table cells (caller+hat / caller+no-hat /
caller+wrong-hat / third-party) unchanged in outcome, guaranteed non-null.
Matches the house pattern already in `app.is_active`
(`coalesce(..., false)` for the identical reason).

**B. `test_helpers.claims_for`'s RLS-filtered auto-derivation (found via a
genuine SQL ERROR, not a wanted/have mismatch).** Documented in item 4 below.

### 3. Auto-derivation — the lever that made ~1949 call sites tractable

D10's own text predicts "large parts of both suites go red at once" until
every hat-consuming call site is updated. Rather than hand-editing ~1949
`claims_for(...)` call sites, `test_helpers.claims_for` was extended to
**auto-derive** `p_active_role` when not explicitly given, by mirroring
`custom_access_token_hook`'s own D11 break-glass logic live against
`public.memberships` (exactly one live role type -> that role; 0 or 2+ -> no
claim). A pgTAP fixture principal is overwhelmingly single-role (synthetic,
minimally-provisioned per file) — exactly D11's target population — so this
made the harness's default match production's default, rather than diverging
from it, and reduced the red surface from **657 failures across all 175
files** to a small, individually-triaged set.

### 4. `claims_for` needed `SECURITY DEFINER` (a second finding, found live)

Several files call `set local role authenticated` **before** their first
`claims_for` (e.g. `201_documents_redesign.sql:47-48`). At that point
`request.jwt.claims` is still unset/stale, so the auto-derivation query,
run as `authenticated` under `memberships`'s own RLS policy, saw **zero**
rows for a principal who genuinely holds exactly one live role — minted no
claim, and every has_role-gated call in that fixture then failed closed with
a hard SQL error (not a `wanted X got Y` — an aborted file). Fixed: `claims_for`
is now `SECURITY DEFINER` (a deliberate property change from the INVOKER
shape Stage 1/2 verified — `test_helpers` is never exposed to PostgREST, and
the function still only acts on the `p_user` it's given, the sanctioned
"bypass RLS on an internal lookup" use). `search_path` pinned per house
convention.

### 5. pgTAP red triage — the remaining ~60 genuine cases, resolved

After auto-derivation + the DEFINER fix, the remaining reds fell into four
classes, each triaged and closed — **final state: `Files=176, Tests=5644,
Result: PASS`, verified twice (fresh reset, then immediately again with no
reset, per the claims_for-idempotency lesson from Stage 2)**:

- **Multi-role fixture principals needing an explicit `p_active_role`** (the
  large majority) — a file grants a bootstrap persona (`sa_x`/`sa_y`/`st_x`/
  `st_y`/`admin`) an ADDITIONAL role on top of its bootstrap baseline (e.g.
  `170_multitenancy_hierarchy.sql`'s `sa_x` becomes `org_admin` on top of its
  bootstrap `staff_admin`), making the auto-derivation correctly yield no hat
  (genuinely multi-role) — each such `claims_for` call needed the SPECIFIC
  role the section is testing, read from the section's own comment/label
  ("the coordinator" -> `staff_admin`, "the org_admin" -> `org_admin`, "the
  PQS operator"/"the coordinator (NSP)" -> `pqs_member`/`nsp_coordinator`).
  Fixed across `170`, `145`, `190`, `172`, `224`, `195`, `196`, `226`, `238`,
  `241`, `242`, `243`, `245`, `294`, `295`, `238`, `229`, `235`, `292`, `293`,
  `110`, `197` (file:line inventory in the commit diff — not repeated here,
  the pattern is uniform: read the section's own label, set that hat).
  One MIS-SET during this pass and self-corrected on re-triage:
  `235_authz_a4_org_admin_not_case_source.sql` line 386 — a "K1·DENY /
  NO-OVER-REACH twin" pair is explicitly about **"the coordinator"** (not the
  same file's separate `org_admin` scenarios); setting `org_admin` there
  passed the DENY half by accident (org_admin has zero case visibility under
  A4 regardless of exclusion) but broke the NO-OVER-REACH half (which needs
  the coordinator's real board visibility to prove the deny is scoped, not a
  lockout) — corrected to `staff_admin`, re-verified both halves.
- **`audit_write`'s new `metadata.acting_as` breaking an exact-equality
  assertion** (D8's own expected consequence) — 3 tests
  (`150_referrals.sql`, `151_case_patient.sql` x2, `140_patient_safety.sql`)
  asserted `metadata = '{}'` or a fixed partial shape for a
  "carries no identifier/PHI" guarantee; updated to the new expected shape
  (`{"acting_as": "staff_admin"}` etc.) — the PHI-free guarantee itself is
  unchanged and still asserted.
- **D13's own intended fix, not a regression** —
  `239_authz_c8_meeting_for_all_recut.sql` "K18b" asserted a genuinely
  **non-member** `administrativo` delegate could still WRITE (schedule a
  meeting) after her READ side-door was closed by a prior program (C8). D13's
  own text: "under this ADR as first written it fails OPEN — delegated
  capabilities keep working under every hat." `member_can` now requires
  `is_member_of(commission_id)`, which a genuinely non-member delegate can
  never satisfy under any hat. The test's assertion was flipped from
  `lives_ok` to `throws_ok('42501')`, with an explanatory comment — **not
  silently edited to green**: this is D13's own arm behaving exactly as
  specified, closing a fail-open gap the ADR names explicitly.
- **A test-encoded pre-cutover assumption revealing a real, pre-existing RLS
  gap** — `172_phaseb_rls_rewrite.sql` §(B) labeled two response/answer reads
  "org_admin A reads...", but `responses_select`/`answers_select` carry **no**
  org_admin arm at all (verified live: creator OR
  (submitted AND `is_staff_admin_of`) OR `can_read_correction_response` — no
  `is_org_admin_of`/`is_tenancy_admin_of` disjunct). Pre-cutover this passed
  only because the fixture persona (`sa_x`) held BOTH `staff_admin` and
  `org_admin` simultaneously with no hat concept to separate them. Fixed by
  switching to `sa_x`'s `staff_admin` hat for exactly those two reads, with a
  comment naming the finding — the org_admin-visibility question itself is
  out of Stage 3's scope to resolve (a new RLS arm would be a novel,
  security-sensitive change).

### 6. The revert-twin keystone (`315_act_stage3_hat_condition.sql`)

Table: `public.meeting_minutes_jobs` — verified live to carry **exactly one**
policy, `meeting_minutes_jobs_select = app.is_staff_admin_of(...)`, no
is_admin()/other-door OR'd sibling (authz-handoff §7.1 shape 6 — a permissive
sibling would fake both directions). Proof, all live:

1. Baseline, no hat: `SELECT count(*) ... = 0` (denied).
2. Baseline, matching `staff_admin` hat: `= 1` (admitted).
3. **`has_role`'s caller-only condition is temporarily removed** (captured via
   `pg_get_functiondef` first, restored byte-for-byte after) — the SAME
   hatless-caller case from (1) now reads `= 1` (wrongly admitted) — proves
   the detector can detect the exact over-grant it exists to prevent.
4. Restore verified byte-identical against the pre-mutation capture.

Also closes the `ARM=floor` gap `assume_role` opened (a door that exists but
is never CALLED by any keystone is floor-blind by construction): the same
file drives `assume_role` end-to-end — a real grant (`lives_ok`), a real
denial for a role not held (`throws_ok 42501`), the selection row landing
with the chosen role (verified as postgres — the table has no `authenticated`
SELECT grant by design, a test-only verification query), and the
`active_role.assumed` audit row.

### 7. Two catalog-driven corrections to the plan's own literal text

- **The audit action name.** The plan/ADR's own prose names the action
  `role_assumed` (no dot). `audit_log`'s `audit_log_action_shape` CHECK
  requires a dotted `noun.verb` name (every existing action follows this —
  `membership.granted`, `case.created`, ...). Renamed to `active_role.assumed`
  at write time — recorded here as the fix, not silently substituted without
  a trace.
- **`has_role_any`'s reimplementation shape.** The plan's literal text says
  "reimplemented as `has_role(scope, scope_id, app.active_role(), p_user_id)`
  for caller checks." Implemented instead as an integrated AND-clause of
  identical shape to `has_role`'s own (`... AND (p_user_id IS DISTINCT FROM
  auth.uid() OR m.role IS NOT DISTINCT FROM app.active_role())`) rather than a
  literal delegating call — provably equivalent for both cases (caller check:
  the OR's role-match arm collapses "any role" to exactly the active-role row,
  byte-identical to `has_role`'s own predicate; third-party check: the OR's
  left arm is true, unchanged from the original any-role body) and avoids a
  redundant double `is_active`-style check `has_role` would otherwise need to
  reproduce internally.

### 8. Raw-policy sweep (§B10) — swept `pg_policies`, ALL schemas

3 policies matched a direct `memberships` read: `hospital_affiliations_select`,
`profiles_admin_select`, `profiles_select_self_or_admin` — 6 EXISTS-arm
occurrences of the `memberships` table total. **5 of 6 are TARGET-side reads
only** (scan `memberships` to find which org/hospital the ROW BEING READ's
subject belongs to — never the caller's own row — then delegate the actual
authorization decision to an `app.*` door checking the caller:
`is_org_admin_of`/`is_tenancy_admin_of`/`is_hospital_admin_of`). "What roles
another user holds is not a function of MY hat" — these need no change,
recorded as reasoned, named exceptions:
- `hospital_affiliations_select`'s co-membership arm
- `profiles_admin_select`'s two arms (both)
- `profiles_select_self_or_admin`'s tenancy-admin arm

**The 6th arm — `profiles_select_self_or_admin`'s co-member arm — is THE
KNOWN INSTANCE the plan names.** It read the CALLER's own membership row
directly (`me.principal_id = auth.uid()`), any role, no hat-awareness. Fixed
per §2 and QA r2's explicit carry-forward (the caller side routes LITERALLY
through `app.is_member_of`, not a looser predicate): `ALTER POLICY` (not
DROP+CREATE — preserves command/roles/permissiveness by construction), caller
side now `app.is_member_of(them.commission_id)`, target side unchanged
(`them.principal_id = profiles.id`, any role).

### 9. Post-authentication destination sweep (§B11) — swept by the PROPERTY

Four known members (plan's Stage 3 amendment), each verified live and
classified:

| Site | Classification | Disposition |
| --- | --- | --- |
| `resolveLanding`/`signIn` (`src/lib/auth/actions.ts`) | Picker-routed | `resolveLanding` **deleted**, not patched (see below) |
| `src/app/page.tsx` chain | Picker-routed | Backend dependency posted (`SessionContext.needsRoleSelection`); the one-line `page.tsx` early-redirect is frontend's, per file ownership |
| `?redirect=` deep-link (`explicitTarget`) | Picker-routed | Folded into `signIn`'s own fix — preserved as `/selecionar-perfil?redirect=<target>` |
| Middleware (`src/proxy.ts` + `src/lib/supabase/middleware.ts`) | **Reasoned-exempt, verified not assumed** | `updateSession` only refreshes the session and returns `claims \| null`; `proxy.ts` gates on `claims` being non-null only — no role computation anywhere in this chain |

**`resolveLanding` deleted, not patched — the decision the plan's Open
Question 1 asked for.** It was a second, independent, hand-rolled partition
of the SAME role→landing computation `page.tsx` (via `getSessionContext()`)
already owns — checking only 4 of 11 `platform_role` values and falling
through to `/` for the rest (safe pre-cutover; NOT safe once a picker gate
exists, since falling through to `/` is exactly how the picker gets reached —
`resolveLanding` never fell through for `org_admin`/1-commission cases, the
MOST common sign-in shapes). Patching a second copy to also check for a hat
would perpetuate exactly the "one seam updated, the other not" defect ADR
0101 exists to close, one level up. Deleting it and taking `page.tsx`'s one
extra hop is the correctness-over-micro-optimization trade D10's own framing
prefers — flagged plainly: this reintroduces one extra round trip on every
sign-in (previously optimized away for a load-time race condition), a real,
deliberate regression, recorded as a candidate follow-up (a shared
role→route resolver) rather than a Stage 3 blocker.

`getSessionContext()` gains `activeRole: string | null` (read from the
verified claim) and `needsRoleSelection: boolean` (true only when hatless AND
the hat-blind grants span >1 distinct role type — D2). **Correction to the
design note's own premise**: `docs/design/act-role-picker.md` §3.2 assumed
`getSessionContext()` becomes hat-scoped post-Stage-3 and therefore unusable
for the picker's pre-hat data source. Verified false: `session_context()`
reads `memberships` directly (SECURITY DEFINER, `auth.uid()` only, no
`has_role`/`has_role_any` call) — it is, and remains, fully hat-blind by
design (D9's own requirement). `getSessionContext()`'s TS wrapper calls this
SAME RPC and was never touched. The picker's raw-grants need is served by a
new thin query, `getRawGrants()` (`src/lib/queries/session.ts`), plus a pure
transform `getSelectableRoles()` (`src/lib/queries/session-grants.ts`,
sibling to the existing `partitionGrants`) — no new backend round trip beyond
what `session_context()` already provides.

### 10. Typed signatures posted for frontend

```ts
// src/lib/queries/session.ts
export interface SessionContext {
  // ...unchanged fields...
  activeRole: string | null
  needsRoleSelection: boolean
}
export async function getRawGrants(): Promise<SessionGrant[]>

// src/lib/queries/session-grants.ts
export interface SelectableRoleOption { role: string; count: number }
export function getSelectableRoles(grants: SessionGrant[]): SelectableRoleOption[]

// src/lib/role-selection/actions.ts
export interface AssumeRoleState { ok: boolean; error?: string }
export async function assumeRole(
  role: Database['public']['Enums']['platform_role'],
  landingPath: string,
): Promise<AssumeRoleState>  // redirects on success; returns {ok:false,error} on failure
```

`page.tsx`'s needed change (frontend, one line, per the destination sweep):
after the `isInactive`/`mustChangePassword` gates, before the `isAdmin`
branch — `if (context.needsRoleSelection) redirect('/selecionar-perfil')`.

### 11. Scope gap flagged, not silently expanded or dropped

ADR 0106 D11's prose says `is_admin()` "gains the same active-role condition."
That change is **NOT** in this migration — absent from both the plan's own §4
Stage 3 task list and this session's task brief, and its blast radius is a
different order of magnitude: `is_admin()` gates a large fraction of the RLS
surface, AND `getSessionContext()`'s TypeScript layer independently reads
`claims.is_admin` directly with no `active_role` consultation at all — fixing
only the SQL side would leave the client-visible `isAdmin` flag stale.
Recorded as an open gap between the ADR's stated intent and the concrete task
list, for an explicit decision.

### 12b. Gate — full Phase Gate step 1

Fresh `supabase db reset --local` → registered migrations **338 == 338**
files. `npm run test:db` **run 1** (fresh): `Files=176, Tests=5644, Result:
PASS`. `npm run test:db` **run 2** (same reset, no reset in between):
`Files=176, Tests=5644, Result: PASS` — identical, Stage 2's idempotency fix
holds under Stage 3's own load. `npm run gen:types` — `database.ts` diff:
+4 lines (the `platform_role`-typed `assume_role` RPC + the
`active_role_selections`/enum entries; no other schema surface changed).
`npm run lint` — clean (0/0). `npm run typecheck` — clean.

`ARM=census` — **HOLDS**: 451/461, unchanged from the Stage 0/1/2 baseline
(§12 below explains why `active_role()` does not enter this population).
`ARM=floor` — **HOLDS**: 80, unchanged (the keystone in `315` closes the gap
`assume_role` would otherwise have opened).

**Diff-scoped door sweep**, case list derived mechanically from both
migrations' diff (`grep -ohiE "create (or replace )?function ..."` +
`profiles_select_self_or_admin` added by name for the `ALTER POLICY`, which
the grep recipe's own scope is "CREATE POLICY" and does not catch — added
explicitly, not silently omitted). Preflight: `baseline OK: Result: PASS,
Files=176, Tests=5644`.

| Function/policy | Verdict |
| --- | --- |
| `app.has_role` (4-arg, the one this stage amends) | **ERROR** (run-shape ≠ baseline) — see below |
| `app.has_role_any` | **ERROR** (run-shape ≠ baseline) — see below |
| `public.profiles_select_self_or_admin` (the raw-policy sweep fix) | **COVERED** |
| `app.has_role` (3-arg) | **BLIND** — see the named finding below |
| `active_role`, `assume_role`, `audit_write`, `custom_access_token_hook`, `member_can`, `session_context` | not swept by this tool's PRED arm at all — see below |

**`ERROR` is not a pass — already covered by the revert-twin keystone**
(§6 above), which is exactly what ADR 0079 prescribes for a gate this central:
"`app.has_role` alone leaves 259 tests unexecuted... For the membership
primitives ARM 1 can therefore never be the evidence; the per-workstream
targeted mutation audits are." `315`'s own hand-run mutation (remove the
condition, observe the SAME hatless-caller case flip from denied to admitted,
restore byte-identical) is that targeted audit for exactly this function.

**BLIND finding, named plainly, not fixed in this stage: `app.has_role`
(3-arg).** This is the OTHER overload — `has_role(p_scope_type, p_scope_id,
p_role)`, which delegates to the 4-arg via `(select auth.uid())` and was
**not modified** by this migration (the 4-arg body changed; the 3-arg
wrapper's `select app.has_role(p_scope_type, p_scope_id, p_role, (select
auth.uid()));` is byte-identical to before). It appears in this sweep only
because the CASES-derivation recipe strips argument lists (`sed 's/^.*\.//'`)
— a name match, not a signature match — so a migration that changes ONE
overload of a multi-overload function pulls its untouched sibling into the
diff-scoped population too. Checked live: no function in `app`/`public` calls
this 3-arg overload directly (a `prosrc` regex sweep for a 3-argument
`has_role(...)` call found zero rows) — it is not `authenticated`-reachable
via PostgREST either (unexposed `app` schema), so it does not enter
`ARM=floor`'s population, and `ARM=census`'s unchanged 451/461 total means it
already carries SOME committed verdict predating this stage. Not
allowlisted, not keystoned, in this session — reported as a genuine, named
open item for the lead/QA to disposition (keystone it, allowlist it with a
stated reason, or confirm it is dead code), since I neither introduced this
gap nor have the standing to unilaterally allowlist a `has_role`-family
overload.

**`active_role`/`assume_role`/`audit_write`/`custom_access_token_hook`/
`member_can`/`session_context` — not in this tool's PRED population.** The
tool's own documented PRED scope is "`is_/can_/has_` boolean gates... plus
named exceptions" (`p0-authz-door-audit.sh` header). `active_role` returns
`text`; `assume_role`/`audit_write` return `void`;
`custom_access_token_hook`/`session_context` return `jsonb` — none are
boolean gates by the tool's own definition. `member_can` **is** boolean but
does not match the `is_/can_/has_` **prefix** pattern (it is suffixed, not
prefixed) and is not in the tool's hardcoded exception list (unlike
`attachment_confidentiality_ok`/`referral_target_analyst`) — the exact
"an enumeration's boundary must be the property, not a syntax" shape this
repo has hit before, this time in the SWEEP TOOL's own enumeration rather
than a hand-written one. Not something fixable inside this migration.
`member_can`'s D13 condition is, however, independently exercised: the full
`205_administrativo.sql` suite (the file that drives `member_can` through
real delegated-capability flows) passes green under the new condition as
part of the full `Files=176, Tests=5644, PASS` run — real coverage, just not
visible to this particular tool's own PRED matcher.

`docs/reviews/authz-door-audit-findings.md` restored via `git checkout --`
immediately after (confirmed clean via `git status`).

### 12. `ARM=census` did not grow — explained, not assumed

`ARM=census` (451 live gates / 461 verdicts) is **unchanged from the Stage
0/1/2 baseline**. `app.active_role()` — the new gate the plan's own gate
section names as the one `ARM=census` should newly see — returns `text`, not
`boolean`; the census's live-gate population is `prorettype = boolean` (the
same boundary Stage 2's derivation used). A new `text`-returning helper does
not enter that population by construction, so its absence from the delta is
consistent, not a miss — flagged because the plan's own text predicted a
visible change that the catalog does not show.

---

## Stage 3 — frontend half (2026-08-10)

Plan: `docs/plans/act-as-role-assumption.md` §4 Stage 3 Frontend paragraph. Design
note: `docs/design/act-role-picker.md`. Built against the backend-posted signatures in
§10 above (`SessionContext.activeRole`/`needsRoleSelection`, `getRawGrants()`,
`getSelectableRoles()`, `assumeRole()` — all consumed as posted, no shape guessed).

### 1. What landed

New: `src/app/(auth)/selecionar-perfil/page.tsx` + `src/components/role/role-picker-form.tsx`
(the picker) · `src/components/role/role-catalog.ts` (the ONE role→pt-BR-label and
role→landing-route table, pure, no I/O, consumed by the picker, `UserMenu`, and the D9
hint — "one map, many consumers") · `src/components/role/role-switch-hint.tsx` (the D9
hint) · `src/components/role/get-role-switch-options.ts` (small server helper: hat-blind
grants minus the caller's OWN active hat) · `src/app/o/[org]/direcao-tecnica/layout.tsx`
(new shell — this console had none, per the design note §4.4 option (a)) · 4 new
`not-found.tsx` siblings (`manage`, `nsp-org`, `c/[commission]`, `direcao-tecnica`).
Edited: `src/app/page.tsx` (the one-line `needsRoleSelection` gate, exact position per
the backend-posted dependency) · `src/components/shell/user-menu.tsx` (hat indicator +
"Trocar papel") · the 9 layouts/components that render `UserMenu` (thread `activeRole`
+ `grants`) · `src/app/o/[org]/qualidade/not-found.tsx` + `.../nsp/not-found.tsx` (D9
hint added) · `src/app/not-found.tsx` (the GLOBAL boundary — see finding #2, this
became the primary D9 mount point, not a design-note afterthought).

### 2. Finding that invalidated the design note's §5.4 mounting plan — verified live, not assumed

**The design note (§5.4, my own earlier design-phase output) assumed a choke-point
guard's OWN `notFound()` call — thrown from inside `manage/layout.tsx`,
`qualidade/layout.tsx`, etc. — would be caught by a `not-found.tsx` file sitting in the
SAME directory (a "sibling boundary"), and that 4 of the 6 areas needed one added.**
This is false, confirmed three independent ways, the last one dispositive:

1. An isolated synthetic route (`/test-nf`: a `layout.tsx` that unconditionally calls
   `notFound()`, a sibling `not-found.tsx` carrying a literal marker string, a trivial
   `page.tsx`) — the marker never rendered; the GLOBAL `src/app/not-found.tsx` rendered
   instead. Reproduced with an added intermediate `layout.tsx`+`not-found.tsx` at a bare
   parent segment (`[org]/`) — still the global one won.
2. The REAL routes, dev server: `/o/rede-a/manage` and `/o/rede-a/qualidade` (as
   `chefe.ccih@test.local`, who holds neither standing) both rendered the global 404,
   not `manage/not-found.tsx` (new) or `qualidade/not-found.tsx` (PRE-EXISTING, and its
   own docstring claimed — wrongly — to catch exactly this case: "Reached for BOTH
   'this organization does not exist' and 'you review no hospital here'").
3. **The dev-server results alone were not trusted** — Turbopack's file watcher in this
   sandboxed session did not pick up brand-new top-level route files at all (confirmed
   separately: a trivial new `/zzztest` page 404'd globally even with no `notFound()`
   call anywhere in it), which could have contaminated finding #2. Re-verified on a
   **real production standalone build** (`next build` + `.next/standalone/server.js`,
   the same artifact `npm run e2e:prod` runs): `/o/rede-a/manage` and
   `/o/rede-a/qualidade` for `chefe.ccih@` both still rendered the global 404. This is
   the trustworthy result.

**Mechanism (empirically derived, matches Next's own docs once read against the
result):** a `notFound()` thrown from WITHIN a layout component's own function body is
caught by an ancestor `NotFoundBoundary` ABOVE where that layout itself renders —
never by that same segment's own `not-found.tsx`, and not by a bare intermediate
segment's either (confirmed test #1's second variant). None of the six guard areas sit
under an intermediate `layout.tsx` between themselves and the app root (`[org]/` and
`o/` are both bare), so every one of the six guards' own entry-denial resolves at the
GLOBAL boundary, full stop. A `not-found.tsx` sibling to the guard's OWN layout is
reachable only for a narrower case: a PAGE within an ALREADY-ENTERED area calling
`notFound()` itself (verified live too — `manage/hospitais/[hospitalId]/page.tsx` with
a bogus id, as `orgadmin.a@test.local`, correctly rendered `manage/not-found.tsx`
INSIDE the shell, sidebar intact).

**Disposition, not a silent workaround:** kept all 6 area-specific `not-found.tsx`
files (their docstrings corrected to state precisely what they DO catch — the
narrower page-level case, not entry-denial) and additionally mounted `RoleSwitchHint`
on the GLOBAL `src/app/not-found.tsx`, gated so an anonymous 404 pays no extra cost
(`getRoleSwitchOptions()` returns `{options: [], grants: []}` for no session at
`getRawGrants()`'s own documented boundary — no new query beyond what already runs).
This is the actually-reachable mount point for the case D9 exists for. Flagged plainly
per the task brief's "report a wrong assumption rather than ship dead code silently" —
this is exactly that: shipping 6 not-found.tsx files that never fired for their
intended purpose would have been silently non-functional D9 coverage.

### 3. A second bug caught by the SAME live testing — the D9 hint suggesting the active hat

First live test (`orgadmin.a@` hitting the bogus-hospital-id page inside their OWN
manage area) rendered `RoleSwitchHint` suggesting "Seu papel de **Administrador(a) da
organização** tem acesso mais amplo aqui" — their OWN currently-active hat, since
`getSelectableRoles(grants)` is hat-blind by design and the not-found pages were
originally passing its raw output straight through. Fixed by
`get-role-switch-options.ts`: filter out `context.activeRole` before returning
`options`, shared by all 7 mount points (6 area-specific + the global one) so the
filter is written once, not copy-pasted. Re-verified live: `dualhat.a@test.local`
(org_admin + quality_reviewer) active as `org_admin`, hitting `/o/rede-a/nsp` (no
standing under either hat), now correctly shows ONLY "Revisor(a) da qualidade" —
never "Administrador(a) da organização" (which would be nonsensical: they're already
using that standing to be inside `/o/rede-a/**` at all in the sense that matters for a
tenancy-scoped 404, though the REAL reason it's excluded is simpler — it's the active
claim, full stop).

### 4. The backend-posted `assumeRole` vs. `<form action>`'s own type contract

`npm run build`'s TypeScript pass (not `next dev`, not `tsc` alone — a real `next
build`) caught `assumeRole.bind(null, role, landingPath)` failing `<form action>`'s
`(formData) => void | Promise<void>` contract: `assumeRole` resolves to
`AssumeRoleState`, not `void` (by design — `RolePickerForm`/`RoleSwitchHint` need the
returned `{ok, error}` via `useActionState`). Fixed locally first (a plain client
wrapper discarding the return value); mid-build, backend independently posted
`assumeRoleFormAction(role, landingPath): Promise<void>` in
`src/lib/role-selection/actions.ts` — the same fix, canonicalized in the right file.
Switched `user-menu.tsx` to the posted wrapper once it landed (`assumeRoleFormAction`
for the plain-form "Trocar papel" items; `assumeRole` stays the contract for
`RolePickerForm`/`RoleSwitchHint`, which need the error to show via `useActionState`).
Re-verified working end-to-end after the switch (§6).

### 5. `roleLabel` — the design note's own open question (§7 Q6), resolved

`UserMenu`'s `roleLabel` prop is unchanged where a caller passes it explicitly (the
commission shell keeps "Coordenação"/"Membro"/"Administração" — finer nuance within
one hat). Where no caller passes it (qualidade/nsp/nsp-org/documentos-pendentes/admin/
conta — none did, before this build), it now defaults to `platformRoleLabel(activeRole)`
— those shells previously showed no caption at all. Backward compatible by
construction (explicit always wins); resolves Q6 toward "the active hat's label
everywhere a shell doesn't ask for finer nuance," not a full replacement.

### 6. Live verification (production standalone build, real personas, real DB)

`next build` (clean, `Compiled successfully` + `Finished TypeScript`, 0 errors) →
`.next/standalone/server.js` run directly (`PORT=3001`, env sourced from `.env.local`,
static/public staged per `scripts/e2e-prod-gate.sh`'s own recipe) → driven via the
Claude Browser tools (`computer{action:"left_click"}` could not deliver trusted
events in this sandboxed session — screenshots failed with "the Browser pane is not
displayed, so the page is not compositing frames" — worked around with
`element.click()` / a `pointerdown`+`pointerup` `PointerEvent` dispatch for opening
the Radix dropdown, which DOES reach React's handlers; genuine `<form>` submits and
navigations were exercised for real, only the INPUT-DELIVERY mechanism is a
workaround, not the code under test):

- **`dualhat.a@test.local`** (org_admin Rede A + quality_reviewer Hospital Central A,
  no active hat) → signs in → **lands on `/selecionar-perfil`**, both roles shown with
  their pt-BR labels and single-scope names ("Rede Hospitalar A" / "Hospital Central
  A") → selects "Revisor(a) da qualidade" via a real radio `.click()` (state updates,
  Continuar enables) → submits → **lands on `/o/rede-a/qualidade`**, real case data
  renders, `UserMenu` caption reads "Revisor(a) da qualidade" (the default-from-
  activeRole path, §5) → opens the account menu → "Trocar papel" shows exactly
  "Administrador(a) da organização" (the OTHER hat, not itself) → clicks it → **lands
  on `/o/rede-a/manage`**, real org data renders → navigates to `/o/rede-a/nsp` (no
  standing under either hat) → global 404 + D9 hint: "Seu papel de **Revisor(a) da
  qualidade** tem acesso mais amplo aqui" (correctly excludes the active `org_admin`
  hat) → clicks "Trocar agora" → **lands on `/o/rede-a/qualidade`** again.
- **`chefe.ccih@test.local`** (staff_admin, single role type) → signs in → lands
  directly on the commission overview, **never sees the picker** → `UserMenu` shows
  "Coordenação" (explicit `roleLabel`, unchanged) with **no "Trocar papel" section at
  all** in the opened menu (confirmed via the DOM: only identity block + Sair).
- **`multi@test.local`** (2 commissions, ONE role type — the D2 negative case) → signs
  in → **lands on `/c`** (the pre-existing grouped commission picker), never
  `/selecionar-perfil` → hitting `/o/rede-a/nsp` (no standing) → global 404, **no D9
  hint rendered** (empty options, single role type minus itself).
- Console: no React/hydration errors on any of the above; the only `[error]` entries
  were expected `404` resource-load logs from the deliberate not-found navigations.

### 7. Gate

`npm run lint` — clean (eslint 0/0 + `lint:css-vars` + `lint:memberships-door`).
`npm run typecheck` — clean. `next build` — clean (`Compiled successfully` +
`Finished TypeScript`, 0 errors), all routes registered incl. `/selecionar-perfil` and
the new `direcao-tecnica` layout. pgTAP/`ARM=*` — not re-run (this session touched
zero SQL; the backend half's Stage 3 gate already covers the schema). Full `e2e:prod`
— NOT run here (tester's phase-gate step, not built in this session); the live
verification in §6 is a manual equivalent of the acceptance criteria's positive/
negative personas, not a substitute for the tester's own specs.

### 8. Scope note

This session did not touch `supabase/**` or `src/lib/**` (two migrations and several
test-file edits appeared in the working tree mid-session from `backend`'s concurrent
work in the same worktree — left untouched, not staged, not committed by this
commit). `docs/reviews/authz-door-audit-findings.md` also showed as modified
mid-session (backend's door-audit sweep truncates/restores it) — left untouched.

## Stage 3 — D11 + the 3-arg `has_role` BLIND (backend, 2026-08-10)

Coordinator ruling on top of the Stage 3 backend-half report: implement D11 NOW
(`is_admin()` gains the active-role condition), and disposition the 3-arg `has_role`
BLIND finding from the earlier diff-scoped sweep — keystone it or drop it, no
allowlist (it is reachable, just unused).

### 1. `app.is_admin()` — D11 implementation

Migration `20260918002200_act_stage3_is_admin_hat_condition.sql`. Same shape as
`has_role`/`has_role_any`: `v_is_admin and (app.active_role() is not distinct from
'platform_admin')` — `IS NOT DISTINCT FROM`, not `=` (BUG-ACT-NULLHAT-1's fix,
reapplied here for the same reason: a hatless caller's `active_role()` is NULL, and
`TRUE and NULL` is NULL, not FALSE).

**Blast radius, measured not trusted.** Comment-stripped, balanced-paren sweep of all
928 functions in `app`/`public` (same corpus/script as Stage 2's equivalence proof):
17 real callers, 26 RLS policies. Two raw-grep hits were comment-only false
positives — `app.revoke_role_impl` (comment says "no is_admin() here", but the real
call is `is_admin_for(p_actor)`, a different, third-party-safe function) and
`public.list_referral_target_commissions` (same pattern, same `is_admin_for`). Every
real caller and every policy is structurally a CALLER check: `is_admin()` is niladic
(no argument), reads `auth.uid()` internally, so there is no way for a caller to
redirect it to check someone else. `app.is_admin_for(p_user_id)` is the pre-existing,
deliberately separate third-party door — untouched, and correctly independent of any
hat (no `auth.uid()`/`active_role()` dependency at all).

**Break-glass, verified against the real hook, not simulated.** D11's own protection —
a pure (single-role) platform_admin never needs the picker, the hook derives the hat
implicitly — checked two ways in `315_act_stage3_hat_condition.sql`'s new block: (a)
CONTROL — the fixture's `admin` made multi-role (org_admin@org_b added) — the hook now
mints NO `active_role` claim (a real choice is needed); (b) restored to pure
platform_admin (membership removed) — the hook mints `active_role='platform_admin'`
with zero picker/UI involvement. Both against `public.custom_access_token_hook`
directly, not a hand-simulated claim.

### 2. `assume_role`'s chicken-and-egg bug — found proactively, before shipping

The third-party sweep above requires reasoning about every caller of `is_admin()`,
including `public.assume_role` itself — which called `app.is_admin()` to check
ELIGIBILITY to ACQUIRE the `platform_admin` hat. Once `is_admin()` requires the
active-role claim to ALREADY equal `platform_admin`, that check is circular for the
one population it exists to serve: a multi-role platform_admin trying to switch INTO
that hat from any OTHER hat, or from a hatless session, could never pass — `is_admin()`
would require the very hat they are trying to acquire. Proven live before shipping (not
inferred): synthetic org_admin membership added to the seed platform_admin, active
hat set to `org_admin`, `app.is_admin()` called directly → `f`. Fixed in the same
migration by having the `platform_admin` branch check the raw entitlement
(`profiles.is_admin`) directly — the identical shape the function's own `else` branch
already used for ordinary roles (a raw `memberships` existence check, never
`has_role`/`has_role_any`) — because `assume_role` answers "am I entitled to switch to
this", not "is this my current hat". Zero seed personas exercise this path today (no
platform_admin is multi-role), so it shipped as a proactive fix, not a bug-fix-after-
red.

### 3. No-op proof — empirical, with the coordinator-required synthetic fixture

The no-op argument ("D11 changes nothing today") rests entirely on data: zero
platform_admins hold any membership in `seed.sql`, so every platform_admin session is
single-role and the hook derives the hat implicitly. That fixture — a MULTI-role
platform_admin — does not exist in seed, so it was constructed by hand
(`is_admin_matrix.sql`, run manually against the live catalog, not committed as
throwaway scaffolding): a synthetic `org_admin` membership added to the seed
platform_admin, then an 8-case × 2-phase matrix (BEFORE the pre-D11 body, temporarily
restored via `CREATE OR REPLACE` inside a transaction; AFTER the shipped D11 body) run
against the identical claim sequence:

| case | BEFORE (pre-D11) | AFTER (D11) |
|---|---|---|
| multi-role admin, hat=platform_admin | T | T |
| multi-role admin, hat=org_admin (⭐ distinguishing) | **T** | **F** |
| multi-role admin, no hat | T | F |
| plain org_admin, never admin | F | F |
| plain staff_admin, never admin | F | F |
| random non-member | F | F |
| downstream `can_curate_pqs_vocab(null)`, wrong hat | T | F |
| downstream `can_curate_pqs_vocab(null)`, matching hat | T | T |

Only the ⭐ row (and its downstream echo) differs — every other row, including the
downstream caller, is byte-identical across both phases. This is the ONLY row able to
distinguish the two implementations (a single-role platform_admin, which is every
OTHER pgTAP fixture in the suite, produces `T` under both bodies regardless — a
single-role admin with no active hat still resolves the SAME hat via the hook's
implicit derivation before `is_admin()` is ever called with a real session claim). The
permanent keystone version of this (3 of the 8 rows — hat-matching, wrong-hat,
hatless) lives in `315_act_stage3_hat_condition.sql`'s `is_admin()` block, using the
SAME synthetic-multi-role construction so the diff-scoped door sweep has a real path
to exercise.

### 4. TRIPWIRE — the no-op argument's own load-bearing assumption, made falsifiable

`315_act_stage3_hat_condition.sql`, first assertion, BEFORE `test_helpers.bootstrap()`
(which truncates `memberships`/`profiles` and would hide real seed data — the Stage 1
buildnotes finding on `bootstrap()`'s own truncate-cascade): `count(*) from memberships
m join profiles p on p.id = m.principal_id where p.is_admin = true` must be `0`. If a
future `seed.sql` change, migration, or (pre-pilot only) direct prod data ever gives a
platform_admin a real membership row, this goes RED on the next `db reset` +
`test:db` — the guard an argument resting on "today's data has zero of these" needs.

### 5. The 3-arg `has_role` BLIND — dropped, not kept and not keystoned

Coordinator's ruling: this is in scope for Stage 3 even though its text was never
modified, because Stage 3 changed what the 4-arg `has_role` MEANS without changing the
3-arg wrapper's text — the 3-arg form is a pure delegation
(`app.has_role(p_scope_type, p_scope_id, p_role, auth.uid())`), always a caller check,
now inheriting the hat condition transitively. Instructed: keystone it with a real
call path, or prove it unreachable and drop it — an allowlist is explicitly wrong here
(CLAUDE.md §6 permits allowlisting only an unreachable backstop, and a keystone would
need a real caller, so "unreachable" and "allowlist-worthy" are not the same claim).

Reachability checked on four independent surfaces, all zero:
- Comment-stripped, balanced-paren sweep of the same 928-function corpus: 0 calls to
  `has_role(...)` at exactly 3 arguments. All 21 real `has_role` calls in the corpus
  use the 4-arg form (via the `is_*_of`/`is_*_of_for` wrapper family the codebase
  actually adopted).
- `pg_policies` (all schemas): 0 policies reference `has_role` at ANY arity — every
  policy goes through an `is_*` wrapper, never the predicate directly.
- `supabase/seed.sql`, `supabase/demo/**`: 0 references.
- `src/**` (TypeScript): 0 `.rpc()`/query-builder references (3 grep hits are
  documentation prose citing the predicate by name in a comment; `app` is not exposed
  to PostgREST regardless, so no client call could reach it even if one existed).

Its own origin migration (`20260720000100_has_role_predicate_family.sql` — read for
historical narrative only, never as truth, per the binding catalog rule) names it "3-
arg convenience overload... for policy context" — a convenience the codebase never
adopted. Dropped in `20260918002300_act_stage3_drop_unreachable_has_role_3arg.sql`
(`DROP FUNCTION`, not neutralized/guarded) — this removes the BLIND finding at its
root instead of guarding a door nothing opens. The 4-arg `has_role` — the one every
real caller uses, and the one the existing revert-twin keystone directly exercises —
is untouched.

### 6. Two pgTAP fixture regressions found by the D11 migration, both fixed

- `150_referrals.sql` R2 ("an admin (`is_admin` claim) can create a requested-action")
  died `HC0A3`: its `admin` fixture already held a `pqs_member`@hosp_b membership from
  an earlier, unrelated fixture section (lines 46-48) — multi-role, so the bare
  `claims_for(admin, true)` (no explicit hat) could no longer auto-derive one under
  the new D11-gated `is_admin()`. Fixed: added the explicit `'platform_admin'` third
  argument.
- `141_event_triage.sql` crashed ("Bad plan: 44 tests but ran 4") — a REGRESSION from
  this session's OWN earlier blanket fix (all `admin` claims_for calls in the file set
  to `'pqs_member'`). Two calls (lines 70, 190) create/update a sentinel criterion with
  `hospital_id = null` (global vocab curation); `can_curate_pqs_vocab(null)` routes
  through the `is_admin()` branch, not the `pqs_member`/`is_pqs_operator_of` branch —
  under D11-gated `is_admin()`, a `pqs_member`-hatted caller correctly fails a
  platform-scoped check. Fixed by correcting exactly those 2 of 15 `admin` claims_for
  sites back to `'platform_admin'`, after confirming (by inspecting all 15) the other
  13 are genuinely hospital-scoped and correctly stay `pqs_member`.

### 7. A pre-existing door-audit harness gap, found and fixed while diff-sweeping `is_admin()`

The diff-scoped sweep (`CASES="is_admin"`) first returned `ERROR run-shape!=baseline`
(Files matched, Tests=5647 vs baseline 5650) — not BLIND, not COVERED. Per §7.15 this
is a harness bug to fix, not a result to accept. Root cause, found in the runlog (not
assumed from the summary line — "ERROR|run-shape!=baseline ≠ unswept, read the
runlog"): `supabase/tests/176_nsp_per_org_b_support.sql:373` asserted
`(select slug from commissions where organization_id = org_a)` as a bare scalar
subquery. `is_admin()`'s "positive" neutralization forces it `TRUE` for EVERY caller
(not just admins) — widening `commissions_select_member_or_admin`'s `is_admin()` OR-
arm to admit a plain non-admin persona (`chefe.ccih`) into a second commission row.
Postgres raised "more than one row returned by a subquery used as an expression" as a
hard runtime error, aborting the file 3 tests early (`Bad plan: 33 planned, 30 ran`) —
not a pgTAP assertion failure, a crash the harness correctly refuses to auto-classify.
Fixed by making that one assertion crash-proof —
`string_agg(slug, ',' order by slug)` in place of the bare scalar subquery — same
assertion intent (still fails cleanly, `'ccih,farmacia' != 'ccih'`, on a widened
result), just no longer traps. Re-swept clean: `COVERED`, held (asserted-through) by
30 files.

This ERROR predates ACT entirely — `docs/reviews/authz-door-audit-findings.md` already
carried `app.is_admin() | ERROR | run-shape!=baseline (Files=156 Tests=4785)` from a
prior full sweep, long before Stage 3 touched the function. D11's diff-scoped
requirement is what finally forced a resolution; the row is hand-merged from ERROR to
COVERED (findings-file convention: restore-from-HEAD, reapply as the sole hand-edited
region, same as the two prior FUP-AUTHZ-4/MIN precedents).

### 8. `assumeRoleFormAction` — the cross-team contract gap, resolved additively

`npm run typecheck` red on `src/components/shell/user-menu.tsx` (frontend's own,
concurrently in-progress, uncommitted file — outside this turn's touchable scope) was
NOT something to fix by editing that file. `assumeRole(role, landingPath):
Promise<AssumeRoleState>` is load-bearing for `RolePickerForm`/`RoleSwitchHint` (both
already wired through `useActionState`, need the returned `{ok, error}`) — its
signature could not change. Added `assumeRoleFormAction(role, landingPath):
Promise<void>` to `src/lib/role-selection/actions.ts` instead: a thin, additive
wrapper (`await assumeRole(...)`, discarding the resolved state — `redirect()`'s throw
still propagates through the `await` unmodified) matching `<form action>`'s own
`(formData) => void | Promise<void>` contract, for callers that bind it directly
rather than driving it through `useActionState`. `assumeRole` itself is byte-unchanged.
Frontend's own buildnotes entry (Stage 3 — frontend half, §4) confirms they arrived at
the identical fix independently before this landed, then switched `user-menu.tsx` to
the posted wrapper once available — convergent, not coordinated in real time.

### 9. `ARM=census` — confirmed still not the arm that grew (D11 included)

Same finding as the earlier Stage 3 backend-half report (§12 above), now re-confirmed
with `is_admin()` in the diff: `active_role()` returns `text`, not `boolean`, so it is
outside the census's counted boolean-gate population by construction — adding a text-
typed helper, or gating an EXISTING boolean predicate on it (as D11 does to
`is_admin()`), does not change the census's `live authz gates` count. The real
coverage for the hat lives in the revert-twin/D11 keystones and the diff-scoped
predicate-arm sweep, not in `ARM=census`.

### 10. Gate — full Phase Gate step 1, re-run from a genuine fresh reset

`supabase db reset --local` (340 registered == 340 files) → `npm run test:db` twice
(fresh, then no-reset): both `Files=176, Tests=5650, Result: PASS`. `npm run
gen:types`: `src/lib/types/database.ts` byte-unchanged (both `is_admin()` and the
dropped 3-arg `has_role` live in the `app` schema, never exposed to PostgREST;
`assume_role`'s signature unchanged). `npm run lint`: clean (eslint 0/0 +
`lint:css-vars` + `lint:memberships-door`). `npm run typecheck`: clean (0 errors,
after §8's `assumeRoleFormAction` landed and frontend switched to it). `ARM=census`:
461 verdicts ≥ 450 live gates, holds. `ARM=floor`: 80 never-called doors, all
allowlisted, holds. Diff-scoped door sweep, `CASES="is_admin"`: `COVERED`, `BLIND: 0`,
`ERROR: 0`. Findings file restored to HEAD + hand-merged (§7) as the sole edit, not
left as the script's own truncated partial-run output.

## P0 — BUG-ACT-HATBLIND-001: `session_context()`'s consumers were never audited (backend, 2026-08-10)

Coordinator escalation, blocking Stage 3: `tester` live-reproduced (twice, fresh
sessions, JWT decoded) `dualhat.a@` wearing `quality_reviewer` rendering the FULL
`/o/rede-a/manage` org-admin console, and the converse wearing `org_admin` on
`/o/rede-a/qualidade`. Root cause: `partitionGrants` (`src/lib/queries/session-grants.ts`)
derived every `SessionContext` field — `memberships`, `orgAdminOf`, `hospitalAdminOf`,
`technicalDirectionOf`, `nspOrgAdminOf`, `qualityReviewerOf`, `nspOperatorOf` — from the
DESIGNED-hat-blind `session_context()` RPC grants with no active-role filter. The plan
correctly ruled `session_context` hat-blind by design (the picker/D9 hint need the
union); what neither the plan nor the coordinator's Stage 3 brief said was "and audit
its consumers." RLS itself was never the gap (`GET /rest/v1/commissions` correctly
returned 0 rows hatless) — this was an application-guard fail-open.

### 1. The central fix — one seam, not 88 call sites

`src/lib/queries/session.ts`, `getSessionContext()`: `activeRole` is now derived
BEFORE the partition (moved up from its old spot near the `return`), and the grants
passed to `partitionGrants` are filtered to `g.role === activeRole` first
(`hatFilteredGrants`). No active hat → every derived list is empty (D5: a hatless
session is a stranger to every hat-aware door) — the SAME rule `needsRoleSelection`
already encodes for the picker redirect that runs before any of these branches, and a
hatless single-role-type session cannot reach here at all (D11's implicit derivation).

Why this is sufficient for the FULL consumer surface, verified by tracing every
distinct access-decision shape found in `src/app/**` (read-only — the coordinator's
constraint), not assumed:

- Every `layout.tsx` under `src/app/o/[org]/**` (`manage`, `qualidade`, `nsp-org`,
  `direcao-tecnica`, `documentos-pendentes`, `c/[commission]`) gates on
  `context.{memberships,orgAdminOf,hospitalAdminOf,technicalDirectionOf,
  nspOrgAdminOf,qualityReviewerOf}` — all now hat-filtered at the single source.
  `admin/layout.tsx` and `conta/layout.tsx` gate on `context.isAdmin` / `requireUser()`
  only (see §3 below for `isAdmin`).
- `src/app/page.tsx`'s OWN landing-precedence branch chain reads the identical fields,
  in the identical order — meaning the picker flow ITSELF was silently broken before
  this fix: a `quality_reviewer`-hatted `dualhat.a@` landing on `/` after the picker
  would have been redirected to `/o/rede-a/manage` by the (previously hat-blind)
  `orgAdminOf.length === 1` branch, never reaching the quality console the picker just
  sent them to pick. One fix, two bugs (the tester's two direct-navigation repros AND
  this un-reported landing-redirect variant) — never independently confirmed live (the
  browser tool's compositing was unavailable this session, §6), but the code path is
  unambiguous and covered by the unit-test evidence in §2.
- `isCommissionAdmin` (`src/lib/auth/access.ts`) reads `ctx.orgAdminOf` /
  `ctx.hospitalAdminOf` directly — a PURE function over the same fields, not a
  separate door. It becomes correct automatically; no edit needed (§4).
- `getTechnicalDirectionAccessByOrg` reads `context.technicalDirectionOf` directly, no
  DB round trip (deliberately, per its own doc comment) — 100% covered (§5).
- `src/lib/{admin,platform,users,org,cases,forms,meetings,interviews,responses,
  case-*}/actions.ts` (~23 files) — every one reads `context.isAdmin`, a field this
  fix did NOT originally touch (see §3: fixed separately, same session).

`getRawGrants()` stays the single, explicitly hat-blind path. Enumerated below (§2).

### 2. `getRawGrants()` consumer enumeration — by the property, not a remembered list

Swept `grep -rn "getRawGrants"` across `src/` (13 real call sites, 10 more prose/doc
references) and, separately, every `.tsx` component receiving a `grants` prop for
`.some/.find/.filter/.map` USAGE (not just the prop's existence) to catch a
display-only prop silently repurposed as a gate:

- `src/app/(auth)/selecionar-perfil/page.tsx` — the picker itself. Correct by
  construction.
- `src/components/role/get-role-switch-options.ts`, `role-switch-hint.tsx` — the D9
  "other hats held" hint.
- Ten `layout.tsx` files (`admin`, `conta`, `qualidade`, `nsp-org`, `nsp`,
  `direcao-tecnica`, `documentos-pendentes`, `manage`, `c/[commission]`) — READ
  individually, all ten: `grants` is fetched via `Promise.all` alongside the REAL gate
  (`context.*` or a dedicated `getXAccessByOrg` resolver) and threaded ONLY into a
  `<UserMenu grants={grants} />` / `<QualityViewerShell grants={grants} />` /
  `<AppSidebar grants={grants} />` prop — never read, never branched on, in the
  layout's own gate logic. `src/components/shell/nsp-hospital-switcher.tsx`'s
  `grants` prop is a DIFFERENT shape (`getNspAccessByOrg`'s `hospitals`, not
  `SessionGrant[]`) for the ALREADY-entered console's hospital-scope switcher — not
  this door.

The set is exactly {picker, D9 hint} for `SessionGrant[]`-shaped `getRawGrants()`
output; every other consumer is confirmed display-only by reading its actual usage,
not its import list.

### 3. `context.isAdmin` — the SAME class, found auditing its own ~23 consumers

`isAdmin` (`session.ts`) was `claims.is_admin === true` — the raw JWT entitlement
claim, untouched by the central fix above (it is set outside `partitionGrants`
entirely). Auditing its consumers (grep `\.isAdmin\b` across `src/`, 23 files) found
the SAME bug shape repeated ~20 times: `if (context.isAdmin) return true` as the
FIRST arm of an authorization function, before any role-scoped check. Two of the 23
(`src/lib/admin/actions.ts`, `src/lib/users/actions.ts`) say explicitly, in their own
pre-existing SECURITY comments, that their mutation runs on the SERVICE-ROLE client
— RLS bypassed entirely, so `context.isAdmin` is THE authority, not a UI convenience.
For those two, a hat-blind `isAdmin` would have reproduced BUG-ACT-HATBLIND-001 with
**no RLS backstop at all** — worse than the tester's original finding, where
`app.is_admin()`'s own D11 hat gate still denied the read one layer down.

This was NOT in the coordinator's named scope (session_context()'s consumers,
`isCommissionAdmin`, `getTechnicalDirectionAccessByOrg`) — `isAdmin` is a sibling
field on the SAME `SessionContext` object, found while tracing "audit its consumers"
one level further than the brief's own three examples. Fixed in the same
`session.ts` edit: `isAdmin = claims.is_admin === true && activeRole ===
'platform_admin'` — identical shape to `app.is_admin()`'s own D11 condition. Provably
a no-op today by the SAME argument D11 used: zero platform_admins hold any
membership (`315_act_stage3_hat_condition.sql`'s TRIPWIRE already covers this — the
tripwire's predicate is exactly what makes `isAdmin` and `activeRole ===
'platform_admin'` unable to diverge yet). Verified NOT to break the ~20 consumers:
`npm run test` (81 files / 1194 tests) passes unchanged — every one of those test
files mocks `getSessionContext()`'s return value directly (`{isAdmin: true, ...}`),
never exercising the real derivation, so none was coupled to the OLD, hat-blind
shape in the first place.

### 4. `isCommissionAdmin`'s RLS-backstop comment — verified against the catalog, not accepted

Its own comment: "RLS is the security boundary... these are for UI gating and nav
only... A false negative here can never grant access the DB denies, and a false
positive here is caught at every data door by RLS." Traced live:
`isCommissionAdmin` → (once fixed, automatically) `ctx.orgAdminOf`/`ctx.hospitalAdminOf`
mirrors `app.is_tenancy_admin_of(commission)` → `app.is_tenancy_admin_of_for(commission,
auth.uid())` → `app.has_role('organization', org_id, 'org_admin', auth.uid()) OR
app.has_role('hospital', hosp_id, 'hospital_admin', auth.uid())`. Both `has_role`
calls are CALLER checks (`p_user_id = auth.uid()`), so Stage 3's caller-only hat
condition applies unconditionally — `is_tenancy_admin_of` was ALREADY hat-gated at
the DB layer before this session's fix, independent of it. The comment's claim holds:
even a stale TS mirror could never have granted a real write or read RLS denies.

### 5. `getTechnicalDirectionAccessByOrg` — confirmed covered, not assumed

Reads `context.technicalDirectionOf.filter(t => t.organization.slug === orgSlug)`
directly — no database round trip at all (deliberate, per its own doc comment: a
Diretor Técnico's only standing is a hospital-tier membership, so the org ref
already returned by `session_context()` is authoritative). 100% covered by the
central fix; no seed persona currently makes this live-testable (per the coordinator's
own note), but the code path admits no other possibility — there is nothing else it
could read.

### 6. A SEPARATE hat-blind door, found auditing session/access-resolver RPCs, not in the brief

Swept every `.rpc(...)` call in `src/lib/queries/session.ts`, `src/lib/queries/pqs.ts`,
`src/lib/pqs/org-admin.ts` (the full session/access-resolver surface) against the live
catalog for whether each delegates through `has_role`/`has_role_any` (hat-gated since
Stage 3) or queries `public.memberships` directly (bypassing the hat entirely). Every
sibling PQS/NSP predicate checked out clean: `is_pqs_member_of_for`,
`is_nsp_coordinator_of_for`, `is_pqs_operator_of_for`, `is_pqs_operator_in_org_for`,
`is_nsp_org_admin_of_for` all delegate through `has_role` (confirmed live — this is
also what makes `nsp-org/layout.tsx`'s SECOND check, `isNspOrgAdmin`, safe despite its
FIRST check reading the until-now-hat-blind `context.nspOrgAdminOf`, per the
coordinator's item 1).

One outlier: `public.list_my_nsp_hospitals()` — the `/o/[org]/nsp` console's SOLE
entry gate (`getNspAccessByOrg` → `listMyNspHospitals` →
`hospitals.length === 0 -> notFound()`). Its body queried `public.memberships`
directly (a UNION of `pqs_member`/`nsp_coordinator`), no hat check anywhere, and — un-
like `nsp-org` — NO second defense-in-depth check backstops `nsp/layout.tsx`'s sole
gate. This predates the `has_role`-family refactor and was never folded into it.

**Keystone (red-first, per role discipline).** Added to
`315_act_stage3_hat_condition.sql`: `k` gains `hosp_b`; `sa_x` (already multi-role:
`staff_admin`@`comm_x`, `org_admin`@`org_b`) gets a THIRD role,
`pqs_member`@`hosp_b` — the only fixture able to distinguish "sees `hosp_b` because
`pqs_member` is the active hat" from "sees `hosp_b` regardless of hat." Run against
the UNFIXED function: test 15 (matching hat) passed, test 16 (⭐ distinguishing case
— `sa_x` wearing `org_admin`, a hat he also genuinely holds, must NOT see the
`pqs_member` grant) FAILED — confirmed RED, non-vacuous.

**Fix**: `supabase/migrations/20260918002400_act_p0_hat_blind_nsp_hospitals.sql` —
`CREATE OR REPLACE`, adds `and m.role is not distinct from app.active_role()` to
both UNION arms (a pure caller self-query, no `p_user_id` param, so — unlike
`has_role` — there is no third-party call shape to preserve; the filter applies
unconditionally). Re-ran the keystone: 16/16 GREEN.

**Semantics, confirmed with the coordinator rather than assumed**: wearing the
`pqs_member` hat means this function reports ONLY `pqs_member` hospitals, not any
`nsp_coordinator` hospitals held under a DIFFERENT hat — the exact "wearing `staff`
means `memberships` lists only `staff` commissions" rule, generalized. A caller
holding both roles at the SAME hospital still needs the matching hat active to see
it.

**Scope boundary of this sweep, stated explicitly**: checked every RPC the
session/access-RESOLVER layer calls (console ENTRY gates). Did NOT exhaustively audit
every CONTENT-listing RPC reachable from an already-entered console (`list_pqs_members`,
`list_org_eligible_users`, the `nsp_org_*_rollup` family, `pqs_inbox`) — those are a
different, larger surface ("escalation within a legitimately-entered area," the
coordinator's own lower-severity category for item 2) and were out of the "principal
enters an area their hat does not authorize" frame this P0 targets. `listMyNspHospitals`'s
OTHER consumer, `src/components/indicators/capa-operator-gate.ts`
(`isPqsOperatorOfIndicatorHospital`), is explicitly documented DISPLAY-ONLY (backstopped
by `open_capa_plan`'s own RPC gate, not independently re-verified here) — narrowing its
result to the active hat only makes an affordance disappear under the wrong hat, which
is the correct direction, not a regression.

### 7. Why `ARM=census` did not grow (again) — `list_my_nsp_hospitals` returns `jsonb`

Same structural reason as `active_role()` (text) and D11's `is_admin()` diff (already
a boolean, so no NEW gate appeared in the census either): `list_my_nsp_hospitals`
returns `jsonb`, not `boolean`, so it was never in the census's counted population and
isn't a candidate for the door-audit script's PREDICATE ARM (which neutralizes a
boolean-returning function to `select true` — not a shape that applies to a
`jsonb`-returning aggregate). Its coverage is the pgTAP keystone in §6, mirroring how
`assume_role` (also non-boolean) was covered by its own keystone rather than the
door-audit tool. `ARM=census` held at 461 verdicts / 450 live gates, unchanged.

### 8. Live browser verification — attempted, environment-limited, not claimed

Attempted to reproduce the tester's exact live repro (log in as `dualhat.a@test.local`,
switch hats, hit `/manage` and `/qualidade` directly) as an independent check beyond
code/catalog reading. The browser tool's frame compositing was unavailable this
session (`screenshot` consistently returned "the Browser pane is not displayed, so
the page is not compositing frames" regardless of viewport resize or a fresh preview
server); form values filled correctly (confirmed via `document.querySelector(...).value`)
but the login form's submit click produced no network request, and a raw
`form.requestSubmit()` triggered the app's generic error boundary rather than a real
sign-in. Two dev-server restarts + one full `db reset` did not change this. This is a
tooling limitation of this session's environment, not evidence about the fix — and
per the coordinator's own division of labor, end-to-end confirmation is exactly what
`tester`'s `e2e/act-role-assumption.spec.ts` (deliberately left RED, untouched here)
is for. Not claiming a live repro that did not happen; the evidence this report relies
on instead is the pgTAP keystones (§6, red-then-green), the unit-test suite (§3, 81
files / 1194 tests unchanged and passing against the real `partitionGrants` + real
`page.tsx` for every catalog role via `session-grants.test.ts`), and direct reading of
every access-decision call site against the live catalog.

### 9. A shared-local-stack hazard, hit twice this pass, both transient

Mid-gate, a plain second `test:db` run (no reset between) showed 3 failures across
`171_cross_org_isolation.sql` and `176_nsp_per_org_b_support.sql`, both
commission-count assertions reporting MORE rows than expected. `public.commissions`
had 10 rows against a ~6-row seeded baseline — the extras were E2E-fixture-shaped
slugs (`comissao-detail-<ms-timestamp>`, `teclado-<ms-timestamp>`, timestamps
resolving to "now") — `tester`'s concurrently-running `actAs` E2E sweep against this
SAME local stack (CLAUDE.md's own documented hazard: "an E2E-mutated DB yields
spurious commission-count reds that are not defects"). A tight fresh-reset +
back-to-back `test:db` pair came back clean both times. Separately, one `ARM=floor`
run reported `create_event_type(...)` uncalled (unrelated to anything touched this
session); an immediate re-run was clean. Both treated as the shared-stack hazard, not
a defect — recorded here rather than silently re-run past without comment.

### 10. Gate — full Phase Gate step 1

`supabase db reset --local` (341 registered == 341 files) → `npm run test:db` twice,
tight back-to-back after the reset: both `Files=176, Tests=5652, Result: PASS`
(+2 over the prior 5650 — the two new keystone assertions in §6). `npm run gen:types`:
byte-unchanged (`list_my_nsp_hospitals` lives in `public` but its RETURN shape,
`jsonb`, and signature are unchanged — only the body). `npm run lint`: clean.
`npm run typecheck`: clean (0 errors). `ARM=census`: 461 verdicts ≥ 450 live gates,
holds (unchanged — §7). `ARM=floor`: clean on the tight re-run (§9). No diff-scoped
door sweep needed this pass — nothing newly touched is a `prosecdef` BOOLEAN gate or
an RLS policy (§7); `list_my_nsp_hospitals`'s own coverage is the keystone in §6.

### Commits

- `src/lib/queries/session.ts` — the central hat-filter fix + the `isAdmin` hat gate.
- `supabase/migrations/20260918002400_act_p0_hat_blind_nsp_hospitals.sql` —
  `list_my_nsp_hospitals()` hat gate.
- `supabase/tests/315_act_stage3_hat_condition.sql` — the new keystone (§6).

## P0 follow-up — the 31-function catalog sweep (backend, 2026-08-10)

Coordinator's own catalog sweep (any return type, comment-stripped, `memberships`
referenced with NO `has_role`/`active_role` anywhere in the body) over ALL of
`app`+`public` found 31 functions beyond `list_my_nsp_hospitals` and `open_capa_plan`
(the latter already evidenced as a real defect via the tester's `phase15-indicators`
AC-5b finding). Root cause named precisely: Stage 2 normalized only the BOOLEAN
gates (the `has_role`/`is_*_of` family); every non-boolean `SECURITY DEFINER` door
that reads `memberships` directly was scoped out, and post-cutover they are
hat-blind by omission, not by design.

### 1. Method — classify by READING, not by name

Task: for each of the 31, does the raw `memberships` read authorize the CALLER, or
does it enumerate/validate OTHER principals? Coordinator's explicit warning: seven
names (`commission_overview`, `capa_kpis`, `quality_board_summary`, `pqs_inbox`,
`conclude_meeting`, `save_section_answers`, `commission_staff_admin_of_case`) plus
the `compute_due_*` family were named as ones NOT to guess in either direction.
Fetched every one of the 31 function bodies from the live catalog
(`pg_get_functiondef`) and read each one; where a body's own authorization ran
through an `is_*_of`/`is_*_of_for` WRAPPER rather than a raw read, that wrapper's own
definition was independently fetched and traced down to confirm it genuinely
delegates through `has_role` (not assumed from its name/suffix convention) —
`is_org_admin_of`, `is_tenancy_admin_of`, `is_staff_admin_of(_for)`,
`is_quality_reviewer_of_for`, `is_pqs_member_of_any`, `is_pqs_operator_of(_for)`,
`is_nsp_org_admin_of(_for)`, `is_nsp_coordinator_of_for`, `is_pqs_member_of_for` were
all fetched and confirmed. Also confirmed live: the three `_impl` functions
(`grant_role_impl`/`revoke_role_impl`/`end_affiliation_impl`) receive their `p_actor`
parameter as `(select auth.uid())` from their public wrappers (`grant_role`,
`revoke_role`, `end_affiliation`) — so their `_for`-family authorization checks
really do bind to the caller for the normal entry point, and are deliberately NOT
bound to the caller for the separate `_for`-suffixed service variants
(`grant_role_for` etc.), matching `has_role`'s own third-party-stays-blind design.

### 2. The full 31-row classification

| # | function | verdict | why |
|---|---|---|---|
| 1 | `app.commission_staff_admin_of_case` | THIRD-PARTY | returns the case's commission's staff_admin uuid (a lookup for OTHER callers, e.g. routing) — no `auth.uid()` anywhere |
| 2 | `app.compute_due_charter_notifications` | THIRD-PARTY | cron/batch — enumerates staff_admins of every overdue commission as notification RECIPIENTS |
| 3 | `app.compute_due_document_review_notifications` | THIRD-PARTY | cron/batch — same recipient-enumeration shape |
| 4 | `app.eligible_voters` | THIRD-PARTY | enumerates the FULL eligible-voter set for a case (roster), no `auth.uid()` |
| 5 | `app.end_affiliation_impl` | THIRD-PARTY / not a gate | authz is `is_org_admin_of_for`/`is_hospital_admin_of_for` (already hat-gated, `p_actor=auth.uid()` at the real entry point); the raw read checks the TARGET `p_user`'s remaining active roles (a business-rule blocker check) |
| 6 | `app.grant_role_impl` | THIRD-PARTY / not a gate | every authz arm is an already-hat-gated `_for` wrapper; raw reads are the TARGET's existing office (technical_director) + the atomic-replace lookup |
| 7 | `app.guard_reference_coherent` | THIRD-PARTY | trigger — validates a REFERENCED other person belongs to the org; not caller authz at all |
| 8 | `app.revoke_role_impl` | THIRD-PARTY / not a gate | same shape as `grant_role_impl`; raw reads are the anti-lockout population COUNT + the final DELETE |
| 9 | `app.trg_audit_memberships` | N/A | pure audit trigger on NEW/OLD; no additional `SELECT FROM memberships` at all — the grep matched the `v_row public.memberships` variable DECLARATION, not a query |
| 10 | `public.appoint_administrativo` | THIRD-PARTY / not a gate | authz is `is_staff_admin_of`/`is_tenancy_admin_of` (hat-gated); raw read validates the TARGET already holds `staff` |
| 11 | `public.appoint_technical_director` | THIRD-PARTY / not a gate | delegates authz entirely to `grant_role_impl`/`revoke_role_impl` (`v_actor := auth.uid()`); raw read finds the current INCUMBENT (business logic) |
| 12 | `public.assign_member_title` | THIRD-PARTY / not a gate | raw read resolves the TARGET member row's commission; authz is `is_staff_admin_of`/`is_tenancy_admin_of` (hat-gated) |
| 13 | **`public.capa_kpis`** | **CALLER — FIXED** | `v_hospitals`/`v_any` read `memberships WHERE principal_id=auth.uid()` directly for BOTH the pqs_member and nsp_coordinator arms (the pqs_member half of `v_any` already routed through the hat-gated `is_pqs_member_of_any` — only the nsp_coordinator arms were raw) |
| 14 | **`public.commission_overview`** | **CALLER — FIXED** | `WHERE organization_id IN (SELECT... WHERE principal_id=auth.uid() AND role='org_admin')` — raw, no wrapper at all |
| 15 | `public.compute_due_notifications` | THIRD-PARTY | cron/batch — enumerates staff_admin signers across ALL commissions with pending signoffs |
| 16 | `public.conclude_meeting` | THIRD-PARTY / not a gate | authz is `is_staff_admin_of` (hat-gated); raw read is `count(*)` of ALL commission members for the QUORUM denominator — population data, not identity |
| 17 | `public.list_addable_commission_members` | THIRD-PARTY | authz is `is_staff_admin_of`/`is_tenancy_admin_of` (hat-gated); raw read excludes CANDIDATES already holding a membership (roster) |
| 18 | `public.list_approver_candidates` | THIRD-PARTY | authz via 4 already-safe checks incl. `is_admin()` (hat-gated since D11); raw reads label CANDIDATE users' roles (roster) |
| 19 | `public.list_hospital_eligible_users_for_pqs` | THIRD-PARTY | authz is `is_nsp_org_admin_of`/`is_nsp_coordinator_of` (hat-gated); raw read is the eligible-candidate roster |
| 20 | `public.list_org_eligible_users` | THIRD-PARTY | same shape as #19, org-scoped |
| 21 | **`public.list_org_people`** | **CALLER — FIXED** | "THE GATE" 's SECOND OR-arm (`hospital_admin`) is a raw `memberships WHERE principal_id=v_uid` read — the FIRST arm (`is_org_admin_of`) was already hat-gated |
| 22 | `public.list_pqs_members` | THIRD-PARTY | authz is `is_nsp_org_admin_of`/`is_nsp_coordinator_of` (hat-gated); raw read IS the roster being listed |
| 23 | `public.nsp_org_roster` | THIRD-PARTY | authz is `is_nsp_org_admin_of` (hat-gated); raw reads are the per-hospital coordinator/member roster |
| 24 | **`public.open_capa_plan`** | **CALLER — fixed, defense-in-depth (see §3)** | raw pqs_member/nsp_coordinator union for hospital auto-inference, BUT immediately re-filtered by the already-hat-gated `where app.is_pqs_operator_of(h)` before any decision — not independently exploitable in any call shape tested |
| 25 | **`public.pqs_inbox`** | **CALLER — FIXED** | `WHERE rc.hospital_id IN (raw pqs_member/nsp_coordinator union on auth.uid())` — no wrapper, directly gates the patient-safety-event inbox scope |
| 26 | **`public.quality_board_summary`** | **CALLER — FIXED** | top entry gate is a raw `memberships WHERE principal_id=v_uid AND role='quality_reviewer'` read; the ROW-level filter below it (`is_quality_reviewer_of_for`) was already hat-gated |
| 27 | `public.reference_candidates` | THIRD-PARTY | caller authz is implicit via RLS on `responses` (unrelated to `memberships`); the one membership read enumerates CANDIDATE users for the reference picker (roster) |
| 28 | `public.save_section_answers` | THIRD-PARTY | no caller-membership gate in the body at all (RLS-implicit via `responses`/`form_sections`); the one membership read enumerates staff_admins as sign-off-request notification RECIPIENTS |
| 29 | `public.seed_expected_meeting_attendees` | THIRD-PARTY | authz is `assert_meeting_staff_admin` → `is_staff_admin_of` (hat-gated); raw read auto-enrolls ALL commission members (roster) |
| 30 | `public.seed_selected_meeting_attendees` | THIRD-PARTY | same shape as #29, filtered to `p_user_ids` — still enumerating OTHER specified people |
| 31 | `public.session_context` | ALREADY RULED | designed hat-blind door (ADR 0106 D9) — the picker/D9 hint need the full union; not revisited |

**Split: 6 CALLER-gating (5 real defects + 1 defense-in-depth), 24 THIRD-PARTY/not-a-
gate, 1 already-ruled. 6 + 24 + 1 = 31.** No MIXED function (a caller gate AND a
third-party enumeration coexisting in one body) was found among the 31 — every one
of the 31 turned out to be cleanly one shape or the other, on a careful read. This
directly answers the coordinator's specific concern ("a function whose parts do not
sum — a body that both gates and enumerates but gets filed under one label — is the
failure this repo keeps recording").

### 3. `open_capa_plan` — fixed, but with an honest vacuity finding, not a guessed keystone

Read closely, the coordinator-cited raw union (for auto-inferring the hospital when
neither the source nor `p_hospital_id` resolves one) feeds directly into
`WHERE app.is_pqs_operator_of(h)` — already hat-gated via `has_role` — BEFORE
`v_op_hospitals`' `array_length(...) = 1` decision is made. Every call shape tried
(wrong hat, hatless, single-hat, dual-hat) produced the IDENTICAL denial whether or
not the union arms themselves also carried the hat condition — because the adjacent
filter already does the real narrowing. Per this repo's own standing rule (a
keystone green on first run is vacuous), no red-then-green pgTAP proof was
constructible against this specific block. Fixed anyway (`CREATE OR REPLACE`, same
textual pattern as `capa_kpis`/`pqs_inbox`) for consistency and as defense-in-depth
against a future refactor dropping the adjacent filter — recorded as a
non-regression change, not a security fix.

This does NOT match what "already evidenced as a real defect, not a hypothesis" led
this session to expect, and the coordinator's own AC-5b framing ("a hatless token
FAILING an OR-gate that either hat alone would pass") reads, on a literal parse, as
a FALSE-NEGATIVE (wrongly denying a legitimate caller) rather than a false-positive
security leak — the opposite direction from the other 5 fixes in this pass. Flagged
for reconciliation rather than guessed: either AC-5b exercises a different code path
this sweep's method didn't reach, or it is a functional/UX regression (D5's
intentional "hatless is a stranger" now correctly denying a multi-role hatless
caller who used to get in on raw entitlement) rather than a security hole. Both are
plausible; only the tester's own AC-5b assertion can settle which.

### 4. Keystones — red-first, per function, `supabase/tests/316_act_p0_caller_gate_sweep.sql`

One synthetic FIVE-role principal (`sa_x`, extending bootstrap's `staff_admin@comm_x`
with `org_admin@org_b`, `nsp_coordinator@hosp_b`, `hospital_admin@hosp_b`,
`quality_reviewer@hosp_b`) — the same "one multi-hat fixture, test each hat's own
reach in isolation" shape used throughout ACT Stage 3. Each of the 5 real defects
got a matching-hat / distinguishing-hat pair (10 assertions), plus `open_capa_plan`'s
non-regression pair (2 assertions) = 12 total.

Confirmed RED against the unfixed functions (verbatim failures, before the
migration): `commission_overview` (test 2), `list_org_people` (test 4),
`quality_board_summary` (test 6, "caught: no exception, wanted: 42501"),
`capa_kpis` (test 8, "have: 1 want: 0"), `pqs_inbox` (test 10, "have: 1 want: 0").
`open_capa_plan`'s pair (11/12) passed even pre-fix, confirming §3's vacuity finding
empirically, not just by code reading. After `20260918002500_act_p0_caller_gate_sweep.sql`:
12/12 GREEN.

### 5. Catalog property diff

All 6: `prosecdef = t` (SECURITY DEFINER preserved), `provolatile` unchanged
(`s`/stable for `capa_kpis`/`commission_overview`/`pqs_inbox`/`quality_board_summary`,
`v`/volatile for `list_org_people`/`open_capa_plan` — matching each function's
ORIGINAL declaration, not normalized), identical ACL
(`postgres=X, authenticated=X, service_role=X`) and owner (`postgres`) on every one.
Signatures byte-identical to the pre-fix catalog dump. `CREATE OR REPLACE` only, no
parameter renames.

### 6. Two more test-fixture regressions, same class as the earlier two this session

Fresh-reset `test:db` reproducibly (not the shared-stack flake) failed
`100_dashboard.sql` test 12 and `199_perf_sweep_wave2.sql` tests 11–14 — both traced
to the SAME root cause as the `150_referrals.sql`/`141_event_triage.sql` fixes
earlier this session: each file gives `admin` (bootstrap's pure platform_admin) an
EXTRA membership mid-file (`org_admin@org-dash` in 100; `pqs_member@hosp_b` in 199)
to exercise the org-scoped/hospital-scoped path of `commission_overview`/`pqs_inbox`
— making `admin` multi-role, so the bare `claims_for(admin, true)` immediately after
can no longer auto-derive a single hat (2 live roles, not 1) under the now-hat-gated
functions. Fixed by adding the explicit third argument (`'org_admin'`,
`'pqs_member'` respectively) at each call site. Swept all 28 pgTAP files with a bare
`claims_for(..., true)` call for the same shape; the full-suite run itself is the
audit (any other file with the same latent issue would have shown as a red on this
same pass) — none of the other 26 tripped it.

### 7. Gate

`supabase db reset --local` (342 registered == 342 files) → `npm run test:db` twice,
tight back-to-back: both `Files=177, Tests=5664, Result: PASS`. `npm run gen:types`:
byte-unchanged. `npm run lint`: clean. `npm run typecheck`: clean. `ARM=census`: 461
verdicts ≥ 450 live gates, unchanged (none of the 6 fixed functions return boolean,
so none enters the census's counted population — same reasoning as
`list_my_nsp_hospitals`/`active_role()`). `ARM=floor`: clean. No diff-scoped door
sweep needed — nothing newly touched this pass is a boolean `prosecdef` gate or an
RLS policy; each fix's own coverage is its red-then-green keystone in §4.

### 8. Is the split complete, or does the population need re-bounding?

The 31-function population, as the coordinator's own sweep criterion defined it
(comment-stripped `memberships` reference, no `has_role`/`active_role` token
anywhere in the body), is fully classified — every row landed in exactly one of
CALLER / THIRD-PARTY / already-ruled, with the axis applied by reading each body,
not guessed from its name (§1's seven-name warning list all came back correctly
verified, in both directions the coordinator was worried about — `pqs_inbox`
genuinely a caller gate, `conclude_meeting` genuinely third-party/business,
`save_section_answers` genuinely third-party). No MIXED function surfaced.

Two observations on whether the SWEEP CRITERION itself needs widening, not
answered by "yes/no" alone:

- The coordinator's own criterion is direct-`memberships`-reference based. It would
  MISS a caller-gating defect built on a VIEW rather than the base table, or one
  reconstructed from `request.jwt.claims`/`auth.jwt()` directly instead of a table
  read. Neither was found in this sweep's own path, but neither was specifically
  searched for either — worth a follow-up sweep with a broader predicate if this
  program continues past this pass.
- `capa_kpis`'s own body shows both shapes side by side — one arm (`is_pqs_member_of_any`)
  already routed through the safe primitive, the sibling arm (raw `nsp_coordinator`
  check) did not — suggesting the 31-function population was assembled at DIFFERENT
  times by DIFFERENT authors with different awareness of the safe pattern, not as
  one coherent batch. This is a case for making the "grep for raw
  `memberships … principal_id = auth.uid()`-shaped reads with no adjacent hat
  condition" check a STANDING sweep (mirroring the ADR 0079 door-audit's own
  "standing, not once" lesson) rather than a one-time pass — flagged as a suggested
  follow-up, not undertaken here (out of this task's stated scope).

Given the above, my answer: the classification of these 31 is complete; I would not
re-bound THIS population without a new, wider sweep criterion, which is a separate
decision for the coordinator to make, not one to expand into silently.

### Commits (this section)

- `supabase/migrations/20260918002500_act_p0_caller_gate_sweep.sql` — the 6 fixes.
- `supabase/tests/316_act_p0_caller_gate_sweep.sql` — the new keystone file.
- `supabase/tests/100_dashboard.sql`, `supabase/tests/199_perf_sweep_wave2.sql` — the
  two fixture regressions (§6).
- This section of `docs/plans/act-as-buildnotes.md`.

## `assume_role` audit scope + the referral/indicator reachability question (backend, 2026-08-10)

### 1. `assume_role`'s audit row — scoped to the assumed role's own tenancy

Ruling (verbatim reasoning, not re-litigated): an assumption of `org_admin of Rede
A` is an event ABOUT Rede A; leaving it unscoped both breaks tenancy-scoped audit
completeness (Architecture Rule 11) and pollutes the platform-tier bucket with
routine per-user noise. `platform_admin` genuinely has no tenant, so NULL stays
correct ONLY for that case — and since a single-role `platform_admin` never calls
`assume_role` (D11: the hook derives its hat implicitly, no picker in the path),
`phase13-audit.spec.ts` AC-3f-platform (asserting the platform-tier chain is
permanently empty) should then pass legitimately.

**Fix** (`supabase/migrations/20260918002600_act_assume_role_audit_scope.sql`):
`assume_role` now resolves the CALLER'S OWN membership row matching the role being
assumed (`ORDER BY granted_at DESC NULLS LAST, id` — a deterministic pick for the
case D2 makes possible but doesn't disambiguate: a caller holding the SAME role
type across multiple scope instances, e.g. `staff_admin` of two commissions; the
hat itself applies uniformly across every instance regardless of which one is
picked for the audit summary, so this is an audit-narrative simplification, not an
authorization decision) and passes its scope columns straight through to
`audit_write` — the same columns `memberships_scope_shape` already guarantees are
correctly NULL-shaped per role tier. `platform_admin` keeps its existing
`profiles.is_admin` eligibility check and stamps no scope (the ruling's own
carve-out).

**Keystone** (`supabase/tests/315_act_stage3_hat_condition.sql`, extending the
existing `assume_role` block): three scope tiers checked on the SAME fixtures
already built there — org-tier (`sa_x` assumes `org_admin`, audit row scoped to
`org_b`), commission-tier (`sa_x` assumes `staff_admin`, scoped to `comm_x`), and
the platform carve-out (`admin`, still genuinely single-role at this point in the
file, assumes `platform_admin`, all three scope columns correctly stay NULL).
Confirmed RED against the unfixed function (`have: NULL, want: <org_b/comm_x
uuid>` on the org-tier and commission-tier assertions specifically — the
non-distinguishing assertions, and the platform carve-out, passed even pre-fix, as
expected). 22/22 GREEN after the migration.

### 2. Confirming the prediction, not assuming it — what else was in the platform bucket

Before concluding the platform bucket empties, checked what it actually held (on
the CURRENT, not-yet-reset local DB, which still carried `tester`'s E2E-run
artifacts): 14 `active_role.assumed` rows (matching the coordinator's own catalog
read) **plus 22 CAPA-action rows** (`capa.opened` ×5, `capa.closed` ×3,
`capa.status_changed` ×9, `capa.reopened` ×1, `capa.effectiveness_recorded` ×4) —
all landing in the SAME all-NULL platform-tier bucket. Traced the second
population to `app.trg_audit_capa_plan` / `app.trg_audit_capa_effectiveness`: they
resolve a CAPA's audit scope ONLY via `event_of_capa(new.id) → commission_of_event`
— which resolves for an EVENT-sourced CAPA but returns NULL for `manual`-,
`meeting`-, `indicator`-, and `audit_finding`-sourced ones (confirmed against
`open_capa_plan`'s own hospital-derivation `CASE`, which resolves those four
sources through the COMMISSION, never through an event at all) — even though
`capa_plan.hospital_id` is a real, `NOT NULL` column available directly on every
row, unused by the trigger.

**This is a real, pre-existing, latent defect, independent of ACT** — confirmed NOT
an artifact of the dirty local DB: a fresh `supabase db reset --local` shows the
platform-tier bucket at a genuine 0 rows (seed.sql creates no CAPAs, matching
AC-3f-platform's own comment "all seeded audit rows have organization_id set"), so
it does not currently break that specific assertion on a clean run — but
`e2e/phase14d-capa.spec.ts` creates multiple `p_source: 'manual'` CAPAs (confirmed
by reading it), which — in a single `e2e:prod` invocation running the whole suite
against one reset — WOULD populate the platform-tier bucket before
AC-3f-platform runs later in the same session, reproducing the exact class of
failure the assume_role fix was just written to prevent, for an entirely
unrelated reason.

**Not fixed here** — out of scope for the ruling, which was specifically about
`assume_role`, and this is a different function family (`trg_audit_capa_plan`/
`trg_audit_capa_effectiveness`, pre-existing, unrelated to the ACT program).
Reported precisely so it isn't mistaken for an assume_role regression if
AC-3f-platform ever reds in a full-suite run: the fix (were it undertaken) would
be reading `new.hospital_id` directly instead of routing through
`event_of_capa`/`commission_of_event`.

### 3. The referral / indicator single-hat reachability question

**`phase22-referrals.spec.ts` Flow 3d — NOT reachable under a single hat, by
design, on the current product surface.**

`app.can_read_referral_phi`'s gate, read live: `is_pqs_operator_of_for(source
hospital) OR is_pqs_operator_of_for(target hospital) OR is_staff_admin_of_for(source
commission) OR (non-draft AND is_staff_admin_of_for(target commission)) OR
(non-draft AND referral_target_analyst) OR (non-draft AND target_type=
'technical_director' AND is_technical_director_of_for(target hospital))` — matches
the tester's own catalog read exactly. `pqsdual.a@` is plain `staff` (not
`staff_admin`) at CCIH: her `staff` hat admits her to the commission-scoped hub
route (`/o/[org]/c/[commission]/encaminhamentos/[id]`, the ONLY route with a
referral-detail page) but satisfies none of the PHI arms above; her `pqs_member`
hat would satisfy the first arm but does not admit her to that commission-scoped
route at all (confirmed live by the tester, same mechanism as the NSP-per-hospital
dispose tests).

Checked for an alternate, PHI-capable route reachable under `pqs_member` alone:
`/o/[org]/nsp/encaminhamentos` (the QPS cross-commission referrals dashboard)
exists and IS reachable under `pqs_member`/`nsp_coordinator` — but its own doc
comment states the design decision directly: **"PHI-FREE throughout — patient
context never appears on this aggregate; it lives behind the per-referral audited
PHI door."** Its table component (`ReferralDashboardTable`) documents WHY there is
no deep link to the commission-scoped detail page: *"a pure QPS member (PQS
roster) may not be a member of either commission, so the commission-scoped detail
route isn't a safe target for them."* This is not an oversight — it is the exact
population `pqsdual.a@` belongs to, and the product was deliberately built without
a route that would let it reach PHI.

**Answer: no, this flow is not reachable under a single hat, and there is no
alternate route today.** The capability that disappears: a principal who is
simultaneously (a) a plain `staff` (not `staff_admin`) of the referral's source
commission and (b) a PQS operator of that commission's hospital could,
pre-cutover, read a referral's PHI reply text in one session; post-cutover, no
single hat lets them do both — the `staff` hat gets them to the page, the
`pqs_member` hat would authorize the read but never gets them to the page, and the
NSP-surface alternative was purpose-built PHI-free specifically because this
combination exists. This is a genuine PO decision (accept the loss for this exact
role combination, or add a PHI-capable path for PQS operators who are plain staff
— e.g., a deep link from the NSP dashboard gated on the PHI predicate directly
rather than commission membership). No arm was widened to investigate this.

**`phase15-indicators.spec.ts` AC-5b — also not reachable under a single hat, but
via a DIFFERENT mechanism than the test's own comment describes; flagging the
correction because it changes what "widening" would even mean here.**

The test's header comment states `open_capa_plan`'s gate as `is_tenancy_admin_of
(source_commission) OR is_pqs_operator_of(hospital)`. Read live (not accepted from
the comment, per this repo's own binding rule): for `p_source = 'indicator'` (and
`'event'`/`'rca'`/`'meeting'`/`'audit_finding'`), the function's ONLY authorization
check is `not app.is_pqs_operator_of(v_hospital)` — there is no `is_tenancy_admin_of`
disjunct anywhere in `open_capa_plan`'s current body (confirmed against the exact
migration I shipped for this function two tasks ago, `20260918002500_...sql`, and
independently against the live `pg_get_functiondef` — both agree). So `admin@`'s
`org_admin` hat does not fail this RPC because of a hat mismatch on a real OR-gate
with two live arms; it fails because `is_tenancy_admin_of` was never one of this
gate's arms to begin with, for any of these five sources — hatless OR org_admin OR
any other non-PQS hat, all deny identically, pre- or post-ACT, because pre-ACT
`is_pqs_operator_of` also had exactly one relevant condition (holding the
membership), which `admin@` satisfies via `pqs_member`, not `org_admin`.

What DOES require the union, in this flow, is the SEQUENCE, not a single gate: the
indicator DETAIL PAGE's own entry gate is `canConfigureCommission` (`staff_admin`
OR tenancy-admin) — confirmed by the test's own live-tried negative
(`pqsdual.a`, a real CCIH `staff` + central-a PQS operator, 404s there) — and the
"Abrir plano de ação (CAPA)" button that calls `open_capa_plan` is mounted
EXCLUSIVELY on that page (`src/components/indicators/capa-affordance.tsx`; traced
every reference to `open_capa_plan`/`openCapaPlan` in `src/app`+`src/components`+
`src/lib` — the button is its only production call site for `p_source='indicator'`).
Checked for an NSP-surface alternative the same way as the referral case:
`/o/[org]/nsp/capa` exists but is DETAIL-ONLY (`[capaId]/page.tsx`, no list, no
create form) — there is no route under the NSP/PQS surface that opens a NEW
indicator-sourced CAPA at all.

**Answer: no single-hat route exists for this exact flow either**, but the
mechanism is two SEPARATE gates in sequence (a page-entry gate requiring
`staff_admin`/tenancy-admin, then an action gate requiring `pqs_member`/
`nsp_coordinator`) rather than one OR-gate whose two arms need different hats.
Practically this still means the same capability loss the coordinator is asking
about (a dual `org_admin`+`pqs_member` principal who could do both in one
pre-cutover session now cannot, in one sitting, under any single hat) — but
"widen an arm" is not even a coherent fix for it, since there is no single gate to
widen: the two candidate fixes are (a) let the indicator page's own entry gate
also admit a `pqs_member` viewing an off-target indicator at their own hospital
(a route/UI change, not an RLS/RPC widening), or (b) accept the loss. Flagging the
comment/catalog discrepancy explicitly so the PO conversation is grounded in the
real mechanism, not the test's since-drifted description of it.

### 4. Gate

`supabase db reset --local` (343 registered == 343 files) → `npm run test:db`
twice, tight back-to-back: both `Files=177, Tests=5670, Result: PASS` (+6 over the
prior 5664 — the new assume_role scope keystones). `npm run gen:types`:
byte-unchanged. `npm run lint` / `npm run typecheck`: clean. `ARM=census`: 461
verdicts ≥ 450 live gates, unchanged (`assume_role` returns void, outside the
census's boolean population). `ARM=floor`: clean, 80 never-called doors, all
allowlisted. No diff-scoped door sweep needed — nothing newly touched is a
boolean `prosecdef` gate or an RLS policy.

### Commits (this section)

- `supabase/migrations/20260918002600_act_assume_role_audit_scope.sql` — the fix.
- `supabase/tests/315_act_stage3_hat_condition.sql` — the extended keystone.
- This section of `docs/plans/act-as-buildnotes.md`.
- No `e2e/**` changes (tester owns `phase13-audit.spec.ts`'s AC-3f-platform; it
  should go green off this change alone, on a fresh reset, per the ruling).

**Update, same day**: `tester` independently re-verified this fix empirically (52
tests with multiple hat switches on a fresh reset, then queried `audit_log`
directly: zero `active_role.assumed` rows in the platform-null bucket) and marked
`BUG-ACT-AUDIT-PLATFORM-TIER-1` RESOLVED. The prediction held.

## BUG-CAPA-AUDIT-SCOPE-1 — fixed (backend, 2026-08-10)

Filed (not fixed) in the previous section as a finding discovered while confirming
the `assume_role` prediction. Escalated from predicted to observed and now blocks
the Phase Gate: `tester` confirmed `AC-3f-platform` RED standalone against a
contaminated state (empty-state text times out — the exact failure shape, not
inferred from row counts), and found a SECOND, independent reproduction —
`phase15-indicators.spec.ts` AC-5b (`p_source: 'indicator'`) reproduces the
identical mechanism with no involvement from `phase14d-capa.spec.ts` at all
(`audit_log` showed `capa.opened: 2` in the platform-null bucket after running
only two spec files). Two independent paths meant the full suite would almost
certainly red on it.

### 1. The fix

`app.trg_audit_capa_plan` and `app.trg_audit_capa_effectiveness` resolved audit
scope ONLY via `v_comm := case when v_event is not null then
app.commission_of_event(v_event) else null end` (`v_event` from
`app.event_of_capa`, which itself only resolves `'event'`/`'rca'`-sourced CAPAs —
confirmed live: its body is a bare `case ... else null end` over `capa_plan.source`).
For the other four sources (`manual`, `meeting`, `indicator`, `audit_finding`),
`v_comm` was always NULL and no fallback existed — even though `capa_plan.hospital_id`
is a real column on the same row, unused by either trigger.

Both triggers now fall back to `capa_plan.hospital_id` (`app.org_of_hospital`
derives the organization) whenever the event chain doesn't resolve a commission.
`trg_audit_capa_plan` fires ON `capa_plan`, so `new.hospital_id` is available
directly; `trg_audit_capa_effectiveness` fires ON the sibling table
`capa_effectiveness` (keyed by `capa_id`, already doing a `SELECT ... FROM
capa_plan` for the summary's `code`) — extended that same SELECT to also fetch
`hospital_id`. Computing the fallback unconditionally (not only inside an `if
v_comm is null` branch) is harmless and simpler: `app.audit_write` itself derives
`organization_id`/`hospital_id` FROM the passed commission whenever one is
set, ignoring the separately-passed org/hospital values in that case — verified
by the CONTROL keystone case below, not assumed.

**This narrows, it does not widen.** It moves rows out of the platform-tier
audit bucket into their correct tenant chain — a correctness fix to the audit
trail under Architecture Rule 11. It grants no access, checks no authorization,
and touches no RLS policy or predicate; the only change is which
`audit_log.{organization_id,hospital_id,commission_id}` values a row is stamped
with.

### 2. `hospital_id` nullability — determined from the schema, not assumed

`capa_plan.hospital_id` is `NOT NULL` (`information_schema.columns`), so the
fallback is unconditionally available for `trg_audit_capa_plan` — every row has
one, no further NULL-handling path is reachable. `capa_effectiveness.capa_id` is
itself `NOT NULL` with `FOREIGN KEY (capa_id) REFERENCES capa_plan(id) ON DELETE
CASCADE` (confirmed via `pg_constraint`), so `trg_audit_capa_effectiveness`'s
`SELECT ... FROM capa_plan WHERE id = new.capa_id` is guaranteed to find the
parent row, whose `hospital_id` is itself `NOT NULL` — `v_hospital` cannot be
NULL there either. No defensive fallback-of-a-fallback was needed; stated rather
than assumed.

### 3. Sibling-trigger sweep — bounded by the property, not the name

Coordinator's instruction: bound by "a trigger resolving scope solely through an
event lookup", not by matching names. Two independent catalog greps over all 49
`trg_audit_*` functions:

- `prosrc LIKE '%event_of_%'` — 6 matches: the two CAPA triggers plus
  `trg_audit_event_custody`, `trg_audit_event_patient`, `trg_audit_event_triage`,
  `trg_audit_rca`.
- The broader `prosrc LIKE '%else null end%'` (catches the conditional-null SHAPE
  regardless of which helper function is called) — exactly 2 matches: the same
  two CAPA triggers, and ONLY those two.

The four near-miss candidates were checked individually, not waved off by the
narrower grep's absence from the second: each calls
`app.commission_of_event(new.event_id)` UNCONDITIONALLY — no `case`/null-check
branch exists in their bodies at all. `event_id` is `NOT NULL` on all four
underlying tables (`event_custody`, `event_patient`, `event_triage`, `rca` —
verified via `information_schema.columns`), and `commission_of_event` reads
`patient_safety_event.reporting_commission_id`, itself `NOT NULL`. The chain
cannot return NULL for any of these four, by two independent NOT NULL
constraints stacked in series — they do not share the vulnerable shape. Only
`capa_plan.source` makes the event genuinely OPTIONAL (4 of 6 values have none).

**Sweep result: exactly 2 vulnerable functions, both fixed here. 0 additional
functions share the shape** — reported per the instruction ("if others share it,
report them; do not fix beyond these two without telling me the count first");
the count is zero, so there is nothing further to sequence.

### 4. Keystone — red-first, `supabase/tests/317_act_capa_audit_scope.sql`

A manual-source `capa_plan` row (inserted directly, bypassing `open_capa_plan`'s
own RPC gate — already covered by the earlier P0 keystone — to isolate testing
the TRIGGER itself), its status transitioned to exercise `capa.status_changed`,
and a `capa_effectiveness` row for `capa.effectiveness_recorded`. Confirmed RED
against the unfixed triggers: `capa.opened` org/hospital, `capa.status_changed`
hospital, `capa.effectiveness_recorded` org/hospital — all `have: NULL` (5 of 9
assertions; the `commission_id IS NULL` checks and the CONTROL case were
correctly true even pre-fix, as expected — the CONTROL specifically proves
non-vacuity: it is FALSE that everything in this file just happens to pass
regardless). 9/9 GREEN after the migration.

**CONTROL case, not skipped**: a genuine EVENT-sourced CAPA (real
`patient_safety_event` + `capa_plan(source='event', source_event_id=...)`) still
resolves `commission_id` via the existing chain, unaffected by the fallback —
proving the fix doesn't disturb the path that already worked, and confirming
`audit_write`'s own commission-derivation (not my added fallback) is what
populates `organization_id`/`hospital_id` in that case.

### 5. Catalog property diff

Both: `prosecdef = t` (SECURITY DEFINER preserved), `provolatile = v` (volatile —
correct for trigger functions, unchanged), empty ACL (matches the pre-fix
functions — trigger functions are invoked by the trigger mechanism, not granted
to a role directly), owner `postgres`, trigger bindings unchanged
(`audit_capa_plan_trg` on `capa_plan`, `audit_capa_effectiveness_trg` on
`capa_effectiveness`, same `tgtype`). `CREATE OR REPLACE` only — the trigger
objects themselves were never dropped or recreated.

### 6. Gate

`supabase db reset --local` (344 registered == 344 files) → `npm run test:db`
twice, tight back-to-back: both `Files=178, Tests=5679, Result: PASS` (+9 over
the prior 5670 — this keystone file). `npm run gen:types`: byte-unchanged.
`npm run lint` / `npm run typecheck`: clean. `ARM=census`: 461 verdicts ≥ 450
live gates, unchanged (trigger functions are outside the census's boolean-gate
population). `ARM=floor`: clean, 80 never-called doors, all allowlisted. No
diff-scoped door sweep needed — neither function is a boolean `prosecdef` gate
or an RLS policy.

### Commits (this section)

- `supabase/migrations/20260918002700_act_capa_audit_scope_fallback.sql` — the fix.
- `supabase/tests/317_act_capa_audit_scope.sql` — the new red-first keystone.
- This section of `docs/plans/act-as-buildnotes.md`.
