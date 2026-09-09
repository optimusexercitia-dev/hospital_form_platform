# DATA-ACCESS-GENERATION — progress record

> Hub: [data-access-generation.md](../features/data-access-generation.md) · decision: ADR
> [0197](../decisions/0197-data-access-registries-are-generated-not-maintained.md). Branch:
> `data-access-generation`, cut from `main` at `e4ac95e5` — a fast-forward merge, no divergence.

## Session log

### 2026-09-09 — re-derivation, generation, gate 17, the pgTAP mirror (one session)

**Why this ran.** An external QA report said `data-access.md` advertises itself as an RPC / helper /
flag / module lookup and answers a fraction of it, and asked for generation plus a drift gate. ADR
0196 § Considered options option 4 had already ruled generation right *for the registries* and
called it follow-on work.

**Step 1 — re-derive the finding before trusting it.** Every figure measured against the live
catalog (`supabase_db_azkbbhskturikxpgmafq`) and the tree at `e4ac95e5`:

| claim | as reported | as measured | verdict |
|---|---|---|---|
| public functions | "533 in `src/lib/types/database.ts`" | **533** in `pg_proc`; `database.ts` holds **473** | figure right, **SOURCE WRONG** |
| named in the doc | 170 | **169** present / 364 absent | confirmed |
| typed flag fields | 42 | **42** | confirmed |
| flags absent from the registry | 15 | **18** | **understated by 3** |
| modules on disk | — | **109**, of which **36** unnamed | new |

⭐ The 473-vs-533 gap is itself a finding: generated types expose only what PostgREST can see, so 60
public functions have no typed client binding at all and the doc described neither set. And the
three extra absent flags are hidden by the registry writing `documents_wave_a … documents_wave_d`
as a range — an elision a grep cannot resolve and a reader cannot either.

**Step 2 — identify what must SURVIVE, before replacing anything.** Of `data-access.md`'s 542 lines,
the two function sections and the module section are overwhelmingly PROSE, not tables: § Helper
functions is 165 lines carrying `confidentiality_rank`'s "do **NOT** re-order it to match the
union's declaration order" (a re-order would let an `ethics_investigation` clearance open
legal-privileged documents), `can_read_case_or_admin`'s "ORing the admin arm *outside* the DEFINER
out-votes the m2 deny", and the SQL↔TS mirrors whose drift is phase-blocking. ⛔ **None of that is
derivable and none of it is repeated in the generated files.** That is why the design supersedes the
*inventory* only, and why the sections are kept rather than replaced.

**Step 3 — where generated output can live, decided by reading the gate, not by preference.** Gate
16 enumerates `readdirSync(DIR).filter(f => f.endsWith('.md'))` — **non-recursive, `.md` only**. A
`generated/` subdirectory or a JSON artefact would have escaped the size cap, the preamble check,
the router requirement and the link check. Four `.md` files *beside* the hand-written ones is what
subjects them to all seven checks. Split on the schema seam because the two tables sum to
**191,305 B**, over gate 16's 160 KB warn as one file; largest as built is **114,336 B**.

**Step 4 — the two-half gate.** A lint gate here may not need Docker, so:
`doc == pin` is gate 17 (text only, in `lint`), `pin == catalog` is
`supabase/tests/400_data_access_census.sql` (live, in `test:db`). Composed, they say the doc matches
the catalog; separately, neither does — and gate 17 prints that bound on every run.

#### Four defects found by building it

1. ⭐ **The digest sort order — found by the pgTAP half on its FIRST run, and unfindable by either
   half alone.** Row counts matched for all three pins; digests matched for `flags` and not for
   `rpc`/`helper`. Cause: the generator sorted with `String.localeCompare`, Postgres sorted by
   database collation. The generator looked entirely correct in isolation; the pgTAP suite looked
   entirely broken. Both sides are now byte order (`Buffer.compare` / `collate "C"`). **This is the
   evidence for the two-instrument design, and it arrived before either was committed.**
2. ⛔ **`power_authoring` and `technical_director`: live keys, no `FeatureFlags` field.** One caller
   wrote `"power_authoring" as FeatureFlagKey`, its own comment promising the cast "becomes a no-op
   once BE-2 lands the key" — BE-2 never did. The other read the key off the untyped
   `Record<string, boolean>` that `getFeatureFlags()` returns, where a missing key is `undefined`
   and typechecks. Both fields added; the cast removed.
3. ⛔ **`case_access`: a typed field naming no live key** (the flag was dropped by ADR 0078 Stage B;
   `caseAccessEnabled()` is a hard-coded `true` and no caller reads the flag). It read `false` for
   ever via the safe default, so nothing ever failed. Removed. ⚠ A one-directional check would have
   reported at most one of defects 2 and 3.
4. ⛔ **ACL rendering is grant-order-dependent.** 397 functions rendered
   `postgres,authenticated,service_role` and 284 rendered `postgres,service_role,authenticated` —
   one privilege multiset, two texts. Sorted before emission, the same remedy
   `catalog-fingerprint.sql` records for the same reason.

#### The gate's own self-test was wrong, and only the on-disk mutation run showed it

First on-disk run: **0 caught / 8 failed.** The self-test cloned its fixtures from the real corpus,
so every real mutation poisoned its baseline and the gate reported `SELF-TEST FAILED — the checker
is not trustworthy` while the checker worked perfectly. ⭐ That is `check-budget-anchor.mjs` ruling
R28 from the opposite direction: not "the fixture is poisoned by the plant it should detect" but
"poisoned by a plant it is not even looking at". Two more findings fell out of the same run:

- An arm's own mutation could **collide** with the on-disk one — the digest arm rewrote a literal to
  `ffff…` on a file where the disk mutation had already written exactly that, so the fixture did not
  change and the arm tested nothing. ⛔ Only the "mutation did not apply" guard saw it.
- `inspect()` **returned early** whenever an anchor failed to parse, making six other checks
  unreachable: one malformed anchor silently suppressed most of the gate.

⇒ The self-test now builds a SYNTHETIC corpus **using the generator's own renderers** (so it cannot
drift from the format, and never reads the real files), and `inspect()` short-circuits only on an
unreadable file, guarding anchor-dependent checks per kind.

Two further vacuity findings caught by the same guard, worth recording because both read green:

- An arm keyed on `⛔ **none**` passed having mutated NOTHING the moment the last untyped flag key
  was fixed — the token a CLEAN corpus is not guaranteed to contain. Inverted to mutate `✅ → ⛔`.
- The `G: a frozen heading is renamed` arm passed **without the check firing**: the matcher used
  `startsWith`, so `## RPC inventory (old)` still matched. A frozen heading is frozen as a WHOLE
  STRING, because the string is what an inbound `§` citation navigates by. Now exact.
- ⚠ Two of my own mutation-run *mutators* were wrong (`grep -v -m1` inverts **then** stops after one
  output line, truncating the file to 1 line). The gate reported `[P2]` honestly; the arm was the
  broken half. Rewritten with `awk`; the restore helper now `cmp`s and aborts rather than leaving a
  mutated tree.

#### The mutation run, final (all 8 on the REAL corpus, on disk)

| # | mutation | expected | result |
|---|---|---|---|
| M1 | delete a table row from the RPC surface | A | ✅ rc=1 — anchor says 555, table holds 554 |
| M2 | corrupt the `rpc` digest pin in the mirror | C | ✅ rc=1 |
| M3 | edit the SQL spliced into the mirror | D | ✅ rc=1 |
| M4 | delete a `⚠ **Superseded**` forward marker | G | ✅ rc=1 |
| M5 | rename a FROZEN heading | G | ✅ rc=1 |
| M6 | add a typed field naming no live key | F | ✅ rc=1 |
| M7 | delete a module row from the module registry | E | ✅ rc=1 |
| M8 | bolt a SECOND anchor beside the gated one | P2 | ✅ rc=1 |

Baseline green before, and re-proven green after every rollback. ⛔ Every mutation asserted to have
changed the file's bytes before its arm was scored.

#### The pgTAP mirror, proven able to fail (red-first)

`npx supabase test db --local supabase/tests/400_data_access_census.sql`: **6 tests, PASS**. Then
`('rpc', N, 'ffff…')` → `Failed test 2` (digest); `('helper', 9999, …)` → `Failed test 3` (rows);
restored → PASS. ⚠ A keystone that could not fail is the failure mode this project has logged
repeatedly, so it was measured rather than assumed.

#### Gate runs, all taken BARE (no pipe — a pipe destroys the exit code)

| command | rc |
|---|---|
| `npm run typecheck` | **0** |
| `npm run lint` (17 gates) | **0** |
| `npx supabase db reset --local` | **0** |
| `npm run test:db` | **0** — 263 files, 8,906 tests, `Result: PASS` |
| `node scripts/gen-data-access-surface.mjs --self-test` | **0** — 51 arms |
| `node scripts/check-data-access-registry.mjs --self-test` | **0** — 30 arms |
| the 8-mutation on-disk run | **0** — 8 caught / 0 failed |

#### Volume, stated because ADR 0196 made a point of stating its own

`docs/backend-state/` went from **751,528 B / 13 files** at `e4ac95e5` to **999,737 B / 17 files**
(**+248,209 B, +33.0%**); the four generated files are 245,206 B of it. ⛔ Volume ROSE. What was
bought is completeness and a gate — and unlike the hand-written half, none of the added bytes has to
be maintained by a person. A reader's *entry* cost is unchanged: the router still sends them to one
file.

⚠ **Committed on `data-access-generation`, not merged and not pushed.** No QA review has been run,
which is why the hub is `gated` rather than `complete`. ⚠ The unit was BUILT on `main`'s working
tree and the branch was cut before the commit, so the branch tip is the first commit that carries
any of it — there is no partial history on `main`.
