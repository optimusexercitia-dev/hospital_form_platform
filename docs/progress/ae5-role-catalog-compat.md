# AE5-ROLE-CATALOG-COMPAT — progress record

> Hub: [ae5-role-catalog-compat.md](../features/ae5-role-catalog-compat.md) ·
> branch `ae5-role-catalog-compat`, cut from `main @ 975fb4dd` · owed by ADR 0207 D5 (steps 1–5;
> step 6 deferred to proposed-order item 6) · runs after `DEFINER-SEARCH-PATH-NARROW-FIX` (PO
> ruling 2026-09-11).

## Session log

### 2026-09-12 — unit opened; the subject measured from the catalog; the surface mapped (lead)

**Tree at open.** `main @ 975fb4dd`, clean; `origin/main..main` = 116 commits (⛔ not pushed — the
standing instruction); no `in_progress` hub; no worktree. Four merged unit branches still exist
locally (`definer-*`) — not deleted here, not this unit's. A peer session
(`hospital-form-platform-08`) was live on this checkout at open and answered **read-only** (greps
over `docs/` only, no branch, no reset, no pgTAP) — the shared-HEAD / shared-DB hazard measured
2026-09-12 (`docs/worktrees.md` §1) did not apply.

**Review queue (per-clone, gitignored): 2 new entries since the 2026-09-12 processing marker, both
triaged, 0 doc edits.** `c90f2ef1` (`claude-md`) quotes the DEFINER-SEARCH-PATH-NARROW-FIX record's
AC-4 text about the `.claude/rules/` hint — a session quoting a record, hook finding (i); `89aa778b`
(`rules`) is the user's own ordering prompt — hook finding (ii). Neither is outstanding work.

**Measured live** (`supabase_db_azkbbhskturikxpgmafq`, queries in ADR 0207 D7 unless stated):

| limb | value |
| --- | --- |
| `authz.roles` rows | **12**; `administrativo` the only `capability_plane` row, only `session_selectable = f`, `system_managed = t` |
| `platform_role` labels | **11** (`org_admin … platform_admin`, no `administrativo`) |
| columns typed by the enum | **1** — `app.active_role_selections.role` (PK `session_id`, FK `user_id → profiles`, one policy `active_role_selections_select_own`) |
| routines naming the enum | **1** — `public.assume_role(p_role platform_role)`, `prosecdef`, `search_path=app, public, pg_catalog`, ACL `postgres·service_role·authenticated = X` |
| `pg_depend` non-internal dependents of the enum | **2** (`pg_proc`, `pg_class`) |
| routines reading `app.active_role_selections` | **3** — `public.custom_access_token_hook(jsonb)` (`from app.active_role_selections`), `app.can_read_professional_profile(uuid,uuid)` (comment only), `assume_role` |
| `scope_kind_check` | `VALUE = ANY ('organization','hospital','commission','none','capability_plane')` — a DOMAIN over text |
| `memberships` rows at `capability_plane` | **0** (`select count(*) from public.memberships where scope_kind='capability_plane'`) |
| `memberships_role_check` | ten role codes, no `administrativo`; `memberships_role_scope_kind_fkey` → `authz.roles(code, allowed_scope_kind)` MATCH FULL |
| FKs into `authz.roles` | **2** — `role_permissions_role_code_fkey`, `memberships_role_scope_kind_fkey` |
| `role_permissions` rows for `administrativo` | **0** |
| triggers on `authz.roles` / `active_role_selections` | **0** (`memberships` has `trg_audit_memberships`) |
| routines naming `capability_plane` or `'administrativo'` | **4** — `app.trg_audit_administrativo()`, `app.trg_audit_administrativo_capabilities()`, `app.assert_administrativo_enabled()`, `app.member_can_for(uuid,text,uuid)` — the capability plane, step 6 territory, untouched |
| `app.member_can(uuid,text)` body md5 | `25c6747df0c01a34a6783f8a25c8dbd4` |
| `app.member_can_for(uuid,text,uuid)` body md5 | `da9b5b9bdac1a45cb4deed23ef4a3d27` |

(`md5(pg_get_functiondef(oid))` — AC-7 re-measures both after the migration.)

**Surface mapped** (Explore agent, file:line verified where it matters — summarized, the agent's
report is not pasted):
- `src/lib/role/role-catalog.ts`: `PlatformRole` at `:39` from `Database["public"]["Enums"]["platform_role"]`;
  the five parallel declarations `ROLE_LABELS :42` · `ROLE_SCOPE_KIND :67` · `ROLE_ORDER :99` ·
  `ROLE_BRANCH :194` · `scopeSummary` switch `:351`; `ROLE_MANIFEST :121` zips three. No
  `administrativo` / `capability_plane` in the file.
- Enum TYPE consumers outside `database.ts`: `src/lib/role-selection/actions.ts:48,94`,
  `src/lib/role/landing-route.test.ts:7`, and two frontend files by `as PlatformRole` cast —
  `src/components/shell/user-menu.tsx:11,113`, `src/components/role/role-switch-hint.tsx:7,55`.
  Everything else is a value import. ⇒ `backend` edits those two component files **by lead
  agreement** (import/type-only changes; `frontend` is not spawned for two casts).
- `rpc('assume_role', { p_role })` wires a JSON string everywhere (`actions.ts:53`, three E2E
  sites) — the argument shape survives `platform_role → text`.
- pgTAP: `408` (17 tests; every call `'x'::public.platform_role`; proves only the
  `session_selectable` half) · `411` (`MANIFEST-SNAPSHOT` `:54-68`, 11 hand-typed rows; §5 parses
  the domain CHECK and pins `'true/administrativo/(none)'`) · `401:169,185-186,794-796` · `315` ·
  `418` name the enum or the sentinel. `419`'s frozen set holds
  `public.assume_role(p_role platform_role)` at `vectors/definer_search_path_freeze.psql:483`.
  Signature-keyed non-pgTAP: `mutation/authz-command-door-targeted-cases.sh:252,269`,
  `act-hat-blind-allowlist.txt:68,99`, `authz-unswept-backlog.txt:955`, `c2-tier1-doors.txt:76`,
  `vectors/authz-enforcement-manifest.json:1222`. Next free pgTAP number **422**; next migration
  after `20261003007420`.
- ⚠ **Correction to the agent's report**: it predicted the `419` regeneration would be *"one removed
  plus one added"*. The new door lands on `search_path = ''`, so it never enters the non-empty
  population — the regeneration is a **pure deletion** (gate 18 accepts), and `421`'s complement
  grows by one (`860 + 30 = 890` if nothing else moves — re-measured at build, never quoted).
- `seed.sql` seeds no `authz.roles` row and calls no `assume_role`; the row deletion is a
  migration change only.
- No generator exists for the role manifest; AC-6 models one on `gen-definer-search-path-freeze.mjs`.

Two follow-ups the handoff said needed a ruling before the next backend unit
(`…AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`, `…READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`) are
both **RESOLVED 2026-09-11** in the archive — no gate on this unit.

### 2026-09-12 — steps 1–5 built, AC-6 generator landed, AC-8 re-keyed; all backend gates green (backend)

**Plan acked by the lead** with three riders (FK stays NO ACTION; `--check`'s declared bound
accepted; every figure re-measured at build and quoted from the run, never from the plan). Two
questions answered YES: the two vector JSONs and `401` §3.4–§3.6 are this unit's.

**Red-first, witnessed.** `422_ae5_role_catalog_compat.sql` was written and RUN against the
PRE-migration catalog before the migration existed: **17 of 28 red** (1.1 · 1.2 · 1.3 · 2.1–2.6 ·
2.8–2.11 · 3.1 · 4.1 · 4.2 · 4.6). Post-migration: **28/28 green**. The eleven greens on the first
run are each a control, an invariance pin, or an already-clean precondition, and each is labelled
as such in the file — 0.1 (the fixture control: the personas and a commission resolve), 1.4 (a valid
code still inserts), 2.7 (the mutation landed), 3.2 (`to_regtype` resolves a type that exists), 4.3
(0 `capability_plane` memberships — already clean), 4.4 (the planted-row discrimination, which must
work in BOTH states or it is not an instrument), 4.5, 4.7, 4.8, and §5's two md5 invariance pins.
⚠ That list named TEN against a count of eleven until QA NOTE-1; `0.1` is the one it dropped, and a
count that does not match its own enumeration is exactly the shape this record warns about
elsewhere. ⛔ None is a keystone that was green because its subject was
missing.

**A defect the pre-migration run exposed, before the migration was written.** §4's plant block
dropped the generated expression and the composite FK, which is enough PRE-tightening. After step 4
the `authz.scope_kind` DOMAIN itself refuses `capability_plane` with 23514, so the plant would have
RAISED inside the `do $$`, aborted the transaction, and taken every later section's verdict with
it. The block now drops the domain constraint too (restored by the savepoint rollback; §4.6, which
runs after it, is what proves the restore). ⚠ Found only because the cell was run twice, in both
states — a red-first cell run once, after the migration, would have shipped this.

**Measured at build, quoted from the run** (rider 3; container `supabase_db_azkbbhskturikxpgmafq`):

| limb | value | query |
| --- | --- | --- |
| DEFINERs in app/public/authz | **890** (unchanged) | `… where p.prosecdef` |
| empty `search_path` | **29 → 30** | `… unnest(proconfig) c where c = 'search_path=""'` |
| non-empty | **861 → 860** | the complement |
| `authz.roles` | **12 → 11** | `select count(*) from authz.roles` |
| `scope_kind_check` | `CHECK ((VALUE = ANY (ARRAY['organization'::text, 'hospital'::text, 'commission'::text, 'none'::text])))` | `pg_get_constraintdef` on `contypid = 'authz.scope_kind'::regtype` |
| the door | `assume_role(text)` · `prosecdef=t` · `proconfig={"search_path=\"\""}` · ACL `postgres·service_role·authenticated = X` | `pg_proc` |
| `app.member_can(uuid,text)` md5 | `25c6747df0c01a34a6783f8a25c8dbd4` — **unchanged** | `md5(pg_get_functiondef(oid))` |
| `app.member_can_for(uuid,text,uuid)` md5 | `da9b5b9bdac1a45cb4deed23ef4a3d27` — **unchanged** | same |

⚠ The proconfig token is `search_path=""`, **not** `search_path=` — a probe written against the
latter returns 0 for the whole empty-path population. Measured before `422 § 2.3` was pinned.

**The `419` regeneration is a PURE DELETION, as the hub predicted.** `861 -> 860 (removed 1, added
0); converged: public.assume_role(p_role platform_role)`. The new door never enters the non-empty
population, which is the catalog confirming its `search_path` is empty. `421 § 0c` re-pinned to
`890 = 860 non-empty (419) + 30 empty (421) | 0 undeclared`, `§ 0d` to `19 plpgsql | 11 sql`, `§ 1a`
to 19, `§ 5` to 30.

**AC-6, and the gate biting on its first live run.** `scripts/gen-role-manifest.mjs` +
`supabase/tests/vectors/role_manifest.psql` (anchor `rows=11 md5=a6b2308068d4b0f3e59e3f74e4539245`),
wired as `lint:role-manifest` (gate 19) and consumed by `411` through `\ir`. ⭐ The first `--write`
produced an artifact with `session_selectable=false` on all eleven roles: `'x' || <boolean>` yields
the TEXT output `true`/`false`, not psql's `-qAt` column rendering `t`/`f`, so the parser's `=== 't'`
was false for every row. `--check` reported **14 findings** (11 role-level, 3 mirror-level) before
the artifact was ever committed — the cross-language arm catching a defect in its own generator,
which is the job it exists for. The parser now throws on anything that is not `true`/`false` rather
than defaulting.

**Cells re-cast rather than deleted** (the lead's rule; old → new predicate):

| site | old predicate | new predicate |
| --- | --- | --- |
| `411 § 2.1/2.2/2.3` | `authz.roles` holds ≥1 NON-session-selectable row (`administrativo`), so §3's subset comparison is not vacuous | `411 § 2.2`: the SAME fingerprint expression, run against a temp copy of the catalog with one `scope_kind` changed, reports a DIFFERENCE (+ `§ 2.3`: the mutation landed on exactly one row) |
| `411 § 5.1` | manifest vocabulary == declared vocabulary **minus `capability_plane`** | `411 § 4.1`: plain equality — the subtraction would now remove a name that is not there, a no-op reading as a live exclusion |
| `411 § 5.2` | `'true/administrativo/(none)'` — the label IS declared, held by `administrativo`, unused by the manifest | `411 § 4.2`: `'false/(none)/rejected'` — not declared, held by nobody, and **rejected at runtime by a real cast** (a CHECK can name a label it fails to enforce, so part (c) is independent of part (a)) |
| `401 § 3.6` | `administrativo` is the only non-session-selectable row; `assume_role`'s parameter is typed `platform_role` and cannot carry it | `'0/(absent)'` — every surviving row IS selectable (the column excludes nobody) **and** `administrativo` is absent from the catalog, which is what makes it unseatable now; the door's half moved to `408 § 4` / `422 § 2.11` |
| `401 § 3.4` | the **two** non-membership rows carry unreachable scope kinds | the **one** row does; the sentinel the audit called evidence of a wrong abstraction is gone, the device itself is unchanged and still load-bearing for `platform_admin` |
| `401 § 14.5` | assertion kept; its RATIONALE (*"`authz.scope_kind` admits it … reusing scope_kind would have allowed it"*) went FALSE | comment corrected in place with a dated note; the assertion is byte-unchanged and still earns its place because the two domains are independent |

**Sites the unit's mapping did not name, found at build.** Two further 12-row catalog mirrors break
on the row deletion, neither keyed on the signature: `vectors/authz-enforcement-manifest.json:153`
(`roles` roster) and `vectors/authz-matrix-axes.json:28` (`catalogRoles`). Both regenerated through
their own generators (`gen-authz-matrix-cells.mjs`, `gen-authz-differential-cells.py`) — cell counts
**unchanged** at 2002 / 1728, confirming `catalogRoles` is a roster and not a grid dimension. Only
the two JSON source lines were hand-edited; every `.psql` came from a generator. ⚠ A third:
`400_data_access_census.sql § 2`'s RPC digest reds on the re-typed signature while
`lint:data-access` stays green, because that gate never opens a database — regenerated via
`gen-data-access-surface.mjs` (`docs/backend-state/generated-rpc-surface.md` + the pgTAP pin;
`rows=555 definer=465 invoker=90 aclnull=0` all unchanged, the diff is the signature row and the
digest).

**Operational consequence of the new FK, for the seam slice.** `active_role_selections.role ->
authz.roles(code)` on NO ACTION means a role code held by a LIVE session selection can no longer be
deleted from the catalog. `408 § 4` deletes the `platform_admin` catalog row to reach the
fail-closed branch and would have failed 23503 on rows its own `§ 2.3`/`§ 3.3` had just seated; it
now clears its own selection rows first, declared in the file as fixture cleanup, not a weakening.

**Gate runs (bare exit codes, tails in the scratchpad).**
- `supabase db reset --local` → **0**; `npm run test:db` → **0**, `Files=271, Tests=9099, Result: PASS`.
  The single `# Looks like you planned 11 tests but ran 9` is `420`'s documented noise (419's header
  names it by file and figure), not this unit's.
- The first `test:db` after the re-keys was **1** — `400 § 2` only, the digest above; the re-run
  after the regeneration is the PASS quoted.
- `npm run lint` → **0** (all 19 gates, eslint 0/0). Gate 18: `860 frozen … removed 1, added 0`.
  Gate 19: `in sync (11 roles)` with its self-test at 22/22.
- `npx tsc --noEmit` → **0**. `npm run test` → **0**, 154 files / **2092** tests (2091 before; +1 is
  the branch-fallback agreement assertion the manifest collapse newly owes).
- ⛔ Not run here, by instruction: the four authz arms + selftest, the diff-scoped door sweep,
  `npm run e2e:prod`.

**TS collapse.** `ROLE_MANIFEST` is the only place a role is declared; `ROLE_LABELS`,
`ROLE_SCOPE_KIND`, `ROLE_ORDER`, `ROLE_BRANCH`, `LANDING_BRANCHES`, `BRANCH_EMPTY_FALLBACK` and
`scopeSummary`'s role groups are derived, with every export name, type and value preserved.
`ROLE_ORDER` keeps its literal-tuple type through ONE documented double cast — `Array.map` returns
`T[]` and TypeScript will not narrow that to an 11-element tuple; the alternative was to publish
`readonly PlatformRole[]`, widening a type ~10 call sites already see as a tuple. ⚠ Only
`src/lib/role-selection/actions.ts` read `Database['public']['Enums']['platform_role']` directly;
`user-menu.tsx`, `role-switch-hint.tsx` and `landing-route.test.ts` already imported `PlatformRole`
from `role-catalog` and needed **no edit** — the unit's opening map listed them as enum-type
consumers, which was true of the TYPE's origin and not of their import.

**Dead end worth recording.** `{ readonly [K in keyof typeof ROLE_MANIFEST]: (typeof
ROLE_MANIFEST)[K]["code"] }` does not typecheck — over a concrete tuple, `K` ranges over `length`,
`map` and the rest, so `["code"]` is not indexable. The homomorphic form needs a generic helper
(`type CodesOf<T extends readonly RoleManifestShape[]> = { readonly [K in keyof T]: T[K]["code"] }`)
with `T` a constrained type parameter.

**Commits** (branch `ae5-role-catalog-compat`, not pushed): `7327d498` red-first cells · `6fe4289e`
the migration · `f767308f` the TS collapse · `29bb5293` the generator + artifact + 411 · `5f72c11b`
the re-keys · `ac55a1ce` the RPC registry.

### 2026-09-12 — Phase Gate step 1 (lead): the four authz arms, the deriver, the targeted case, the set-valued arm

Every row is read from a copy kept under `.dsp-gate-evidence/ae5-role-catalog-compat/` (repo-local,
excluded through `.git/info/exclude`, never committed); bare exit codes, nothing piped. Base for the
diff-scoped derivation: `main @ 975fb4dd`.

```
ARM=census                                          rc 0   INVARIANT HOLDS — live authz gates 581 / gates carrying a verdict 608 / extension-owned 0
ARM=hat                                             rc 0   INVARIANT HOLDS — 4 finding(s), all reasoned-allowlisted (incl. public.assume_role(p_role text), the re-keyed entry)
ARM=floor                                           rc 0   INVARIANT HOLDS — 63 never-called doors, every one on the floor allowlist; every entry resolves
FROMFINDINGS=1 ARM=wrapper                          rc 0   INVARIANT HOLDS — BLIND set 41, every BLIND wrapper on the allowlist
git diff --stat -- docs/reviews/authz-door-audit-findings.md   EMPTY (after all four arms)
SELFTEST=1 bash scripts/door-sweep-cases.sh         rc 0   SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0
  --- GROUP deriver:               scenarios 20 (pass 20 · fail 0 · skipped 0)
  --- GROUP merge helper:          scenarios 18 (pass 18 · fail 0 · skipped 0)
  --- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)
bash --version                                      GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)
bash scripts/door-sweep-cases.sh 975fb4dd           rc 1   FINDING (1) — DOORS IDENTIFIED: 1. SWEEPABLE BY THIS ARM: 0.  → RULED below
  SCOPE: 1 file(s) — 1 committed (975fb4dd..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
  door named: assume_role (prosecdef, returns void — outside PRED_DOMAIN)
CASES="public.assume_role" bash …/authz-command-door-targeted-cases.sh   rc 0   RESULT: 1 of 1 case(s) COVERED — CASE 2 public.assume_role(text): 2a/2b fingerprints restored, VERDICT COVERED
bash …/authz-setvalued-targeted-cases.sh             rc 0   ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions) — RESULT: CLEAN
  preflight baseline (captured by the harness)             Result: PASS, Files=271, Tests=9099; suite after restore: PASS (Files=271, Tests=9099)
```

**Exit 1 RULED.** The deriver resolved exactly one door in the diff — the new
`public.assume_role(p_role text)` — and it is outside the predicate arm's domain (returns `void`), so
**no door sweep ran and none is claimed**: ⛔ the *"no gate changed"* obligation is provably false
for this diff and is not written. The discharge is the TARGETED case above (`CASE 2` in
`authz-command-door-targeted-cases.sh`, re-keyed by the build onto the text signature), which
mutates the `app.is_active` lines and shows `418` noticing with `408` as discrimination. ⚠ **What
that case covers and does not**: it neutralises ONE of the door's three gates (account state). The
other two — `session_selectable` and the caller's real assignment — are covered by DATA-level
mutations (`408 § 3` flips the catalog row; `408 § 5` deletes the caller's membership; `422 § 2`
red-first), not by a body mutation; that parity with the pre-existing `408 § 3` shape is stated
here for QA to rule on, not assumed equivalent to a body mutation. The policy arm did not run
because no case list exists — ⛔ not a *"0 of 226"* verdict; the migration creates and alters no
RLS policy (`select count(*) from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ilike
'%platform_role%'` → 0 before; the migration's only DDL on a policy-bearing table is the column
retype on `app.active_role_selections`, whose one policy `active_role_selections_select_own` is
unchanged — `pg_policies` re-read after the reset).

Tester spawned for `npm run e2e:prod` after these runs (the harnesses restore the stack; the tester
resets fresh regardless).

### 2026-09-12 — QA r1 MINOR-2/3/4 + NOTE-1 fixed (backend)

Four findings from `docs/reviews/ae5-role-catalog-compat-review.md`, all of one shape — a
DESCRIPTION left behind by the fact it describes, which no gate can contradict:

- **MINOR-2** `421 § 0d` — the description read *"18 members go to the plpgsql arm"* beside a pinned
  value already reading 19. Fixed to 19. ⚠ The assertion was never wrong; the label was, which is
  the half a green cannot see.
- **MINOR-3** `vectors/authz-enforcement-manifest.json` — `measuredOn` 2026-09-02 / `migrationHead`
  20261003007260 described a measurement the content no longer is. Moved to 2026-09-12 /
  20261003007430, and the `_comment` prose above them AMENDED rather than overwritten: the first
  derivation keeps its date and author, and the amendment states its own bound — only the
  `administrativo` roster row and one `retiredBy` string moved, so the head advancing is ⛔ not a
  claim that the file was re-derived. Both generators re-run: `authz-matrix-coverage.json` echoes
  the new head and `manifestSha256`; cells unchanged at 2002 / 1728.
- **MINOR-4** `src/lib/queries/session.ts:200` — `activeRole` described as *"a `public.platform_role`
  value"*; now *"a role code from `authz.roles` (catalog-validated text)"*. `src/lib/auth/actions.ts:84`
  left alone as history, per the lead.
- **NOTE-1** — this record's own entry above said *"eleven greens"* and enumerated **ten**. The
  missing one is `422 § 0.1`, the fixture control; added, with the discrepancy named rather than
  silently corrected.

**Gates:** `npm run lint` → **0** (19 gates, eslint 0/0, `lint:authz-vectors` rc 0), `npm run
typecheck` → **0**. ⛔ No `supabase db reset`, no `npm run test:db`, no mutation harness — the
tester's second `npm run e2e:prod` owns the local stack; catalog reads only. ⚠ `421 § 0d` and the
regenerated `.psql` therefore have **not** been re-run under pgTAP in this pass: `§ 0d`'s change is
inside an assertion's message string and cannot move its verdict, and `410`'s manifest pin is
covered by `lint:authz-vectors`, but neither is a pgTAP verdict and the next `test:db` is the arm
that gives one.

Commit `ea00da10` (`fix(authz): QA MINOR-2/3/4`).

### 2026-09-12 — E2E pass (tester)

**Sweep.** Grepped `e2e/` for `platform_role` (1 hit — `helpers/auth.ts:62`, a doc comment
explaining `loginFresh`'s `actAs` param is deliberately left untyped against the enum; not an
assertion, holds as-is), `administrativo` (every hit is the capability-plane sense —
`commission_administrativos` / `commission_administrativo_capabilities` /
`appoint_administrativo` — never the retired `authz.roles` row; out of this unit's scope by the
task's own carve-out), `capability_plane` (0 hits), and any role-count / role-picker-list
assertion (0 found — `ae48-landing-by-scope-kind.spec.ts` imports `ROLE_SCOPE_KIND` as a value,
unaffected since the manifest collapse preserved every export name/value). The two named sites
(`e2e/act-role-assumption.spec.ts:274`, `e2e/admin-arm-is-active.spec.ts:85`) both already pass
`{ p_role: '<code>' }` as a plain string over REST — the wire shape is unchanged, so neither
needed editing. **No spec required a predicate change; nothing re-cast old → new.**

**New cell.** `e2e/act-role-assumption.spec.ts` — `'AE5 step 2: assume_role(text) — unknown code
and unheld code both refused (pt-BR messages), held code seats'`, appended inside the file's one
`test.describe`. Three-way over REST, past the UI: (1) `multi@test.local` (holds `staff` only)
attempts `papel_inexistente_ae5` — refused, `42501`, body contains `papel não selecionável nesta
sessão` (the `session_selectable` gate, `20261003007430_role_catalog_compat.sql:114`); (2) the
same caller attempts `staff_admin`, which she does not hold — refused, `42501`, `papel não
disponível para este usuário` (the real-assignment gate, D3, same file:126); (3) non-vacuity
control — `chefe.ccih@test.local` (genuinely `staff_admin` of CCIH) attempts `staff_admin` and
seats. No UI touched; the file's own keyboard-only cell (picker UI, unchanged shape) already
covers this unit's keyboard-flow obligation, so none is owed here.

**Scoped run** (chromium, fresh reset, dev server): `e2e/act-role-assumption.spec.ts` — new cell
passed on both of two runs. Four pre-existing tests in the same file intermittently timed out
navigating to `/login` / `/selecionar-perfil` under `next dev` (`⨯ Error: The destination stream
closed early` in the dev server log, ~10-30s waits on ordinarily sub-second routes) — a dev-mode
serving hiccup, not this unit's change (none of the four exercise `assume_role`, `authz.roles`,
or the new text signature differently from before) and not reproduced against the prod build
below.

**Full gate, run 1** (`REBUILD=1 npm run e2e:prod`, fresh build + fresh DB/server per batch):
`GATE SUMMARY: 1253 passed · 1 failed · 0 infra · 4 flaky · 8 did-not-run · 21 batches` /
`COVERAGE: accounted for 1266 of 1278` — **GATE_EXIT=1**, duration 20:48:45→21:54:07 (~65m).
Sole failure: batch 6, `e2e/ethics-e2-procedure.spec.ts:847` "FLOW-4 issue a notification with a
due date…" — `expect(locator).toBeVisible()` on `Notificações e prazos` → li "prazo de defesa do
denunciado" not found, failed on retry too; the 8 did-not-run are that spec's own serial tail
(`test.describe.configure({ mode: 'serial' })`, line 78) aborted behind it. The spec touches none
of this unit's surface (no `assume_role` / `authz.roles` / `active_role_selections` /
`scope_kind` reference — confirmed by grep) and its batch's server log shows repeated
`⨯ Error: The destination stream closed early` (no 401/429 — not a GoTrue rate-limit shape).

**Triage re-run** (`npm run e2e:prod`, `SPECS="e2e/ethics-e2-procedure.spec.ts"`, same standalone
build, fresh DB/server, isolated): `GATE SUMMARY: 21 passed · 0 failed · 0 infra · 0 flaky · 0
did-not-run · 1 batches` — **GATE_EXIT=0**, 21:57:08. FLOW-4 and its whole serial tail green in
isolation, confirming order/contamination-dependence inside batch 6 (multiple specs sharing one
per-batch reset/server) rather than a reproducible defect — matches this spec's documented
history of isolated flakes (`FLOW-7` keyboard-vote, a worker-crash entry) with no prior FLOW-4
record. **No bug filed** — non-reproducing, pre-existing-class flake, unrelated to this unit's
`src`/migration changes; engineers were not asked to fix anything.

**Full gate, run 2** (`npm run e2e:prod`, build reused — "reusing existing standalone build",
unchanged since run 1): `GATE SUMMARY: 1264 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run
· 21 batches` / `COVERAGE: accounted for 1266 of 1278` — **GATE_EXIT=0**, `GATE GREEN`, duration
21:57:39→23:02:32 (~65m). Same 12-test gap between collected (1278) and accounted (1266) both
runs — pre-existing intentional skips (e.g. `user-registration.spec.ts` invite-mode,
server-env-gated), not a coverage regression.

**Verdict: GREEN.** `npm run e2e:prod` run 2 is the declaring run. Specs touched: 1 file, 1 new
cell added, 0 re-cast, 0 deleted. Bugs filed: 0.

### 2026-09-12 — the owed post-QA-fix `test:db` witness (backend)

The verdict the previous entry named as missing. Stack handed back after the tester's `e2e:prod`
went GREEN; fresh `supabase db reset --local` → **0**, `npm run test:db` → **0**,
`Files=271, Tests=9099, Result: PASS`. `410` · `411` · `421` · `422` all ran `ok`, so `421 § 0d`'s
re-worded message and the regenerated `authz_enforcement_manifest.psql` now carry a pgTAP verdict
and not only `lint:authz-vectors`'. The single `# Looks like you planned 11 tests but ran 9` is
`420`'s documented noise, unchanged. `gen-definer-search-path-freeze.mjs --check` → **0**
(`860 … removed 1, added 0`), `gen-role-manifest.mjs --check` → **0** (`11 roles`).

### 2026-09-13 — Record step (lead): PO approval, the hub's current state cut in at close

PO approval 2026-09-12: *"approved. proceed"* (the presentation named the four open risks: the batch-6 ethics flake, the ungated gate ORDER, data-level parity on two gates, the NO ACTION FK). Hub → `complete`; the `## Current state` block below is the hub's at close, cut verbatim (ADR 0186 D3).


**Updated:** 2026-09-12

#### Objective

Land ADR 0207 D5 steps 1–5 as one backend unit before AE5 increment 1: retire `platform_role`,
move `administrativo` out of `authz.roles`, tighten the `scope_kind` domain, collapse the TS
role mirrors into one manifest with a generated pin — without touching the capability plane.

#### Done since start

Everything AC-1…AC-9 asks for (ticked above; witnesses in the record's § Session log): the
migration with every step preceded by the assertion it depends on; `422` red-first (17 of 28 red
before it existed); `assume_role(text)` on an empty `search_path`, the `419` set shrunk by exactly
one, `421` re-pinned; the manifest collapse with every export preserved; gate 19 + `411` as the
two halves of the generated pin; six subject-losing cells re-cast, not deleted; three value-keyed
mirrors the opening map missed found and regenerated; step 6 proven untaken by md5. Gate step 1:
four arms hold, deriver exit 1 ruled (the new door owes and has a targeted case, COVERED),
set-valued arm CLEAN. E2E: second full run GREEN with 0 did-not-run (the first run's one
failure was an unrelated ethics flow, green in isolation). QA APPROVED — 0 BLOCK / 0 MAJOR /
4 MINOR (all fixed and re-verified) / 4 NOTE. Post-fix fresh `db reset` + `test:db` PASS.
The authz seam slice appended and its `## Current state` replaced.

#### In progress

Nothing. Awaiting §6 step 4 (human approval).

#### Next

On approval: the Record step — ledger row, hub → `complete` with this block cut into the record,
`features:index`, `phase(N): complete` commit, fast-forward to `main`, ⛔ no push; then the
graphify refresh in its own commit. Still owed elsewhere, not here: proposed-order item 6
(`member_can` mapping, `authz.capability_permissions`, the three narrower codes) and
`AE4-D-SHAPE-ASSERTION`.

#### Blockers

None. Two things recorded, not fixed, for the reader: the gate ORDER inside `assume_role` is
ungated (QA NOTE-3 — a reorder changes only which correct refusal is shown); the pt-BR labels
and manifest order have no catalog twin by design (QA NOTE-2).
