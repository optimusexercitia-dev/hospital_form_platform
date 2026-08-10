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
3. **Today this is safe by construction, not by design** — the only principal holding two
   role *types* is `dualhat.a@test.local`, which is brand new and consumed by no spec yet.
   That property expires the moment Stage 3's picker specs start using it.

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
