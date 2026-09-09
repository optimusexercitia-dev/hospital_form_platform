# 0197 — The data-access REGISTRIES are generated from the catalog; the prose keeps only what a catalog cannot know

**Status:** Accepted (2026-09-09)
**Area:** documentation / backend surface map / gates
**Related:** [0078](./0078-authorization-capability-model.md) · [0079](./0079-authz-door-blindness-standing-invariant.md) · [0185](./0185-documentation-restructure-feature-hubs-and-gated-registers.md) · [0186](./0186-documentation-consolidation-one-home-per-fact.md) · [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md)
**Amends:** [0196](./0196-backend-state-split-on-the-module-seam-axis.md) — 0196 § Considered options rejected "generate the whole map from the live catalog" *for now*, ruling that generation is "the right long-term answer **for the registries**" and that extending the derive-and-compare pair to them is "follow-on work, not a blocker for the split". This decision executes that follow-on for `data-access.md`'s four registries, and settles the question 0196 left open: **which** parts are derivable, and what happens to the parts that are not.

## Context

> ⛔ **This ADR does not move a fact into a different authority rank.** The live catalog is still the
> sole truth (CLAUDE.md § graphify, ADR 0078); the map is still a map. What changes is that the
> map's *registries* stop being hand-copied from the catalog and start being derived from it,
> and that the derivation is gated in both directions.

`docs/backend-state/README.md` routes a reader to `data-access.md` to *"look up an RPC, a helper
function, a feature flag, or the `src/lib/queries/` module that owns a query (Rule 9)"*. Measured
2026-09-09, against the LIVE catalog and the tree — every figure re-derived rather than quoted:

| the registry | what exists | what the file named | query |
|---|---|---|---|
| § RPC inventory | **533** non-trigger `public` functions | **169** | `pg_proc` where `nspname='public' and prokind='f' and prorettype<>'trigger'`, word-boundary grep |
| § Feature flags | **42** typed `FeatureFlags` fields | **24** (18 absent) | the interface's `^  <k>: boolean$` lines vs the file |
| § Data-access & action modules | **109** query + action modules on disk | **73** (36 unnamed) | `src/lib/queries/*.ts` + `src/lib/*/actions.ts` + `*-actions.ts` |

⭐ **A designated authority that answers a third of the questions put to it is this project's
most-repeated defect shape** — the same shape as a designated authority with zero callers, and the
same shape ADR 0196 was written about one level up ("the instruction read like a guard across many
phases while guarding nothing"). ⛔ It is **not** fixed by writing the missing rows: 183 commits of
exactly that discipline produced the 742 KB predecessor.

⚠ **Two figures in the report that prompted this were wrong in a way worth recording**, because
both errors read as care. It said *"533 public function names in `src/lib/types/database.ts`"* — the
figure 533 is right but its SOURCE is the catalog; `database.ts` holds **473**, because generated
types expose only what PostgREST can see, and the 60-function gap is itself undocumented surface.
And it said 15 flags were absent where **18** are; the three extra are hidden by the registry
writing a range as `documents_wave_a … documents_wave_d`, an elision a reader cannot resolve either.
Re-deriving before acting is what separated the sound finding from its stated provenance.

## Problem

The four registries mix two kinds of statement that have opposite maintenance costs:

1. **Derivable facts** — a function's schema, arguments, return type, `prosecdef`, volatility and
   EXECUTE grants; a flag's key; which module exists and what it exports. These rot the instant a
   migration lands, and no human effort keeps 1,081 of them current.
2. **Judgements a catalog cannot hold** — that `confidentiality_rank` must **not** be re-ordered to
   match the picker's display order (it would let an `ethics_investigation` clearance open
   legal-privileged documents); that ORing an admin arm *outside* `can_read_case_or_admin`
   out-votes the m2 deny; that the FF-3 pure/server module split is load-bearing because a client
   value-import aborts `next build` while tsc, lint and Vitest all stay green; that a flag's
   **production** state depends on whether its flip migration was pushed.

Treating them as one body of prose means the second kind is hostage to the first: the sections rot,
readers learn not to trust them, and the irreplaceable half is discredited along with the derivable
half. ⛔ And ADR 0196 D5 freezes a posted section, so "just rewrite the table" is not available.

## Decision

**D1 — The four registries are GENERATED into four new seam files**, from the live catalog and from
`src/`: `generated-rpc-surface.md` (555 `public` functions) · `generated-helper-surface.md` (526
`app` functions) · `generated-feature-flags.md` (43 keys) · `generated-query-modules.md` (109
modules). The generator is `scripts/gen-data-access-surface.mjs`; the catalog grammar is
`scripts/data-access-census.sql`.

**D2 — The handwritten sections are NOT deleted, NOT edited, and NOT emptied.** Each of the four
frozen headings gains a `⚠ **Superseded** —` forward marker naming its generated file, per 0196 D5,
and each marker states *what is* superseded (the inventory) and *what is not* (the invariants, the
mirrors, and each flag's production state). ⛔ The unsupersedable half is the reason the sections
stay, and gate 17 check **G** is what stops a later tidy-up from renaming or unmarking them.

**D3 — Generation covers only what a machine can DERIVE.** `app.feature_flags.enabled` is emitted
but labelled `local` and asserted on by nothing: `seed.sql` forces flags ON for local and E2E, so
the column is the seeded value and says nothing about any deployment. The production claim stays
handwritten because only a human knows whether the flip migration was pushed.

**D4 — The claim "the doc matches the catalog" is gated in TWO COMPOSABLE HALVES**, because a lint
gate here may not require Docker (the doctrine `check-budget-anchor.mjs` states and gate 15 lives
by):

```
doc == pin      gate 17  scripts/check-data-access-registry.mjs   text only, in `npm run lint`
pin == catalog  pgTAP    supabase/tests/400_data_access_census.sql live,      in `npm run test:db`
```

Each generated file carries a `<!-- DATA-ACCESS-ANCHOR … digest=… -->` line; the pgTAP suite pins
the same row counts and digests as literals and asserts them against `pg_proc`. ⭐ This is ADR
0195's ONE HOME + gated mirror, applied to a digest rather than a ceiling. ⛔ **Neither half alone
is the verdict**, and gate 17 prints that bound on every run rather than letting a green be
over-read.

**D5 — The SOURCE-derived halves are proven by gate 17 itself, not deferred to the pin.** Typed flag
fields, flag readers and Rule-9 module ownership come from `src/`, which the gate can read. What can
be proven without a database is; what cannot is named. ⛔ Three states, never two.

**D6 — The census grammar has ONE home.** The row expressions live in `data-access-census.sql`
between extraction markers, are spliced into the pgTAP suite by the generator, and gate 17 compares
the splice byte for byte — without a database. Two copies of a SQL expression that must agree are
otherwise two copies that will not.

**D7 — The digest is computed in BYTE order on both sides** (`Buffer.compare` / `collate "C"`), and
ACL arrays are sorted before hashing. See § Consequences: both were found by measurement, not by
foresight.

## Considered options

1. **Keep hand-maintaining, try harder.** Rejected — this is 0196 option 1 one level down, and it
   has the same answer: prose does not enforce itself, and the measured result of the discipline is
   169 of 533.
2. **Replace the sections outright with generated tables.** Rejected on two independent grounds. It
   violates 0196 D5 (a posted section is frozen), and it would destroy exactly the content no
   generator can reproduce — the paragraph forbidding a re-order of `confidentiality_rank` is worth
   more than every signature in the file.
3. **Generate into a `docs/backend-state/generated/` subdirectory, or into JSON only.** Rejected,
   and this is the load-bearing rejection: gate 16 enumerates `readdirSync(DIR).filter(f =>
   f.endsWith('.md'))` — **non-recursive, `.md` only**. A generated file in a subdirectory, or as
   JSON, would escape the size cap, the preamble check, the router requirement and the link check.
   ⛔ Putting the new files *beside* the hand-written ones is what subjects them to all seven of
   gate 16's checks, and the router gains four rows a reader actually dispatches on.
4. **One generated file for all 1,081 functions.** Rejected on the cap: the two rendered tables sum
   to **191,305 B**, under 0196 D4's 200 KB hard fail but well over the 160 KB warn, and rising with
   every migration. Split on the schema seam — `public` is the PostgREST-reachable RPC surface a TS caller
   invokes, `app` is the internal predicate surface RLS and DEFINER doors call — which is the seam
   `data-access.md` already used for its two sections. Largest generated file: **114.3 KB**.
5. **Put the whole verdict in pgTAP and skip the lint gate.** Rejected: the pin would then be
   unchecked between `db reset`s, and the doc could drift from the pin with nothing noticing until
   somebody ran the database suite. The two halves are cheap precisely because each is narrow.

## Consequences

- ⭐ **A reader's lookup goes from "a third of the surface, if it was remembered" to complete**, and
  the four registries can no longer silently rot: any migration that adds, renames, re-grants or
  flips `prosecdef` on a function reds `npm run test:db` until the generator is re-run. That is the
  same discipline Architecture Rule 8 already imposes for `npm run gen:types`.
- **Gate 17 (`lint:data-access`) is added to the chain** — eight checks (P1, P2, A, B, C, D, E, F,
  G), a **30-arm** self-test in which every check is proven able to fire AND to stay silent, three
  near-miss discrimination halves, and an **8-mutation run against the real corpus on disk**, each
  caught as a FINDING (rc 1) with the baseline green after every rollback.
- ⭐ **Three live defects were found by building this, all invisible to every other gate.**
  `power_authoring` and `technical_director` were live keys in `app.feature_flags` with **no**
  `FeatureFlags` field: one caller cast a string literal past the type system
  (`"power_authoring" as FeatureFlagKey` — its own comment promising the cast "becomes a no-op once
  BE-2 lands the key", which BE-2 never did), and the other read the key off the untyped
  `Record<string, boolean>` that `getFeatureFlags()` returns, where a missing key is `undefined`
  and typechecks. `case_access` was the opposite polarity — a typed field naming no live key,
  reading `false` for ever via the safe default, so nothing ever failed and nobody noticed. All
  three are fixed; ⛔ **a one-directional check would have reported at most one of the two shapes.**
- ⭐ **A fourth defect was found by the pgTAP half on its FIRST run and could not have been found by
  either half alone.** The generator sorted the digest input with `String.localeCompare`; Postgres
  sorted it by database collation. Row counts matched and digests did not — the generator looked
  entirely correct in isolation and the pgTAP suite looked entirely broken. Both sides are now byte
  order. **This is the strongest evidence for D4 that exists**: the mirror is a second independent
  instrument, not a restatement, and it earned its keep before it was ever committed.
- ⛔ **The gate's own self-test was wrong in a way only the on-disk mutation run could show.** It
  cloned its fixtures from the real corpus, so all eight real mutations poisoned its baseline and it
  reported `SELF-TEST FAILED — the checker is not trustworthy` while the checker was working
  perfectly. That is `check-budget-anchor.mjs` ruling R28 arriving from the opposite direction: not
  "the fixture is poisoned by the plant it should detect" but "the fixture is poisoned by a plant it
  is not even looking at". Worse, an arm's own mutation could COLLIDE with the on-disk one — the
  digest arm rewrote a literal to `ffff…` on a file where the mutation had already written exactly
  that, so the fixture did not change and the arm tested nothing; only the "mutation did not apply"
  guard saw it. ⇒ The self-test now builds a synthetic corpus **using the generator's own
  renderers**, so it can never drift from the format, and it never reads the real files. And a
  second finding fell out of the same run: `inspect()` returned early whenever an anchor failed to
  parse, which made six other checks unreachable — a single malformed anchor silently suppressing
  most of the gate.
- ⚠ **`prosecdef` is 465 of 555 `public` functions (84%) and 415 of 526 `app` ones** (261 of the 350
  non-trigger `app` functions). The generated tables surface this for the first time as a single
  readable fact. **228** `app` functions carry a NULL `proacl`, rendered `<NULL=PUBLIC>` — the
  default, which for a function INCLUDES PUBLIC EXECUTE. ⛔ Reading it as "no grants" inverts the
  fact; it is emitted as an explicit token for that reason, using the same spelling as
  `catalog-fingerprint.sql`. Figures are the files' own anchors, not a separate count.
- ⛔ **Total documentation volume ROSE again**, and saying so is the point 0196 made about itself:
  `docs/backend-state/` goes from **751,528 B / 13 files to 999,737 B / 17 files (+248,209 B,
  +33.0%)**. The four generated files are **245,206 B** of that; the remaining ~3.0 KB is the four
  forward markers and the four router rows. ⚠ The baseline is the directory **at `e4ac95e5`**, not
  0196's 749,842 B — that figure was measured at the split and two commits have landed since.
  **What was bought is completeness and a gate, not smallness**, and unlike the hand-written half
  none of the added bytes has to be maintained by a person. A reader's *entry* cost is unchanged:
  the router still sends them to one file.
- ⚠ **The generated files are not a Rule-9 AUDIT.** `generated-query-modules.md` answers "which
  module owns this query"; it does not claim every caller obeys Rule 9, and a module's presence is
  not evidence that nothing bypasses it. Stated in the file, because an unstated bound is the
  defect.
- ⚠ **Coverage of the eleven ungated registries is now four, not eleven.** The other seven
  (`docs/backend-state/`'s remaining hand-maintained tables) are untouched, and the follow-up ADR
  0196 filed against `check-service-role-registry.mjs`'s `process.cwd()` resolution is likewise
  untouched — deliberately, being a live behaviour change to a gate outside this decision's subject.
