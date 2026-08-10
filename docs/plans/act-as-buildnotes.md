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
