# FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT — two suites generate their cases from the LIVE catalog; pin the role SET so a mid-reset read cannot shrink coverage silently (owner: backend + frontend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> **Raised 2026-08-23**, during ADR 0137's batch, from a vitest total that moved
> **1684 → 1677 → hard-fail → 1684 with no source change on either side.**

**The property.** Two unit suites read `public.memberships_role_check` from the LIVE database
**at module import** and generate one test per role returned:

| File | Helper | Generating blocks |
|---|---|---|
| `src/lib/queries/session-grants.test.ts` | `readRoleVocabularyFromCatalog()` at `:71` | `it.each(...)` at `:233` — **1** |
| `src/components/shell/nav-scope-exclusivity.test.ts` | its own copy at `:74` | `it.each(ROLES)` at `:262` **and** `:289` — **2** |

So the dynamic surface is **3N** for N roles, and `npm run test`'s total is a function of DB state
rather than of the code. ⚠ The other role-shaped lines in `session-grants.test.ts` (`:228`, `:257`,
`:275`) are `for` loops **inside one test** — they change what an assertion iterates, not how many tests
exist. Blocks are the unit, not files.

**What is already safe, and must not be re-litigated.** Coverage cannot shrink **durably**:
`supabase/tests/292_session_context.sql` pins the vocabulary bidirectionally — §3.1 reds when the CHECK
admits a role the hand-declared `role_scope` map does not name, §3.2 reds when the map names a role the
CHECK no longer admits. A role genuinely disappearing reds `npm run test:db`.

⛔ **The residual, and the whole reason for this item: §292 structurally cannot see the TRANSIENT
window.** The two gates read the same database at different times. `memberships_role_check` is created
by one migration and rebuilt by later ones, so a reset passes through a period where the constraint is
**present and valid but partial**. Run `npm run test` inside that window and `test:db` after it, and
vitest generates fewer cases, reports a tidy green, and nothing correlates the two. That is the failure
actually observed above.

## The fix

Assert the role **SET** in both files, against one shared literal:

```ts
expect([...CATALOG_ROLES].sort()).toEqual(EXPECTED_ROLES)
```

- **A set, not `.length`.** A count misses a **substitution** — one role removed and one added leaves
  the length identical while every generated case silently changes subject. A one-sided check passes
  when too much changed, not only when too little did.
- **`EXPECTED_ROLES` in ONE shared module**, imported by both files — never a literal pasted into each.
  The helper is already duplicated; a second duplicated literal would give four written copies of the
  vocabulary and two fresh drift paths.

⛔⛔ **THE SHARED MODULE MUST EXPORT A FUNCTION, NEVER A TOP-LEVEL `const`.** This is the prohibition the
item exists for, because the change that breaks it looks exactly like tidying.

The helper's **logic** and its **invocation count** want opposite treatment:

- the copy-pasted **logic** is a real defect — two independently-maintained regexes over
  `pg_get_constraintdef` can drift with nothing to catch it. Collapse it to one definition.
- the two independent **reads** are a **FEATURE** once each is pinned to the same literal. Two reads
  that must both equal one constant make a catalog change *between them* detectable — which is the
  transient window above. Collapse them and the only instrument that can observe it is gone.

So: **one logic definition, two call sites.** Each test file keeps its own top-level
`const ROLES = readRoleVocabularyFromCatalog()` and asserts it against the shared `EXPECTED_ROLES`.

⚠ **Why a module-scope `const` is the trap — stated carefully, because the obvious reason is
config-dependent.** A `const` evaluated at module scope makes *how many times the catalog is read* an
emergent property of the runner's isolation/pool settings rather than a decision any author made: with
per-file isolation each file re-evaluates it, without isolation the module registry is shared and the
reads collapse to one per worker. ⛔ **Measured: `vitest.config.mts` pins NEITHER `pool` NOR `isolate`**
(no `poolOptions` anywhere), so the behaviour is inherited from the installed Vitest's defaults
(`^4.1.8`) and can change under a version bump or a perf tweak by someone who has never heard of these
tests. **This has NOT been measured empirically** — only the absence of the config has. An exported
function needs none of that reasoning to be safe: each read is explicit and reviewable at its call site,
and the count stops depending on a knob.

**The triangle this closes.** §292 ties CHECK ↔ `role_scope`; the new assertion ties CHECK ↔ literal;
and two reads that disagree cannot both equal the same constant. Any divergence reds somewhere.

## ⭐ The methodology note, which is the transferable part

**Both enumerations of this property were wrong, in mirrored directions, and neither was settled by the
grep:**

- **Under-report from a syntax bound.** The first sweep was `execFileSync|execSync` and named *files*
  ("two suites") when the moving unit is *generated blocks* (three).
- **Over-report from a widened bound.** The corrective sweep added `spawnSync`, `child_process`,
  `psql`, `docker exec` and `pg` client imports across `src/` **and** `e2e/`, and produced a third
  candidate — `src/lib/queries/print-source-vectors.test.ts`. It is a **false positive**: it matched a
  comment about `pg_prove` globbing and a `.psql` **filename**, and it `readFileSync`s a committed JSON
  fixture. Its case count is a function of a **version-controlled file** — diffable and reviewable — not
  of DB state. A different property entirely.

Both were resolved by **opening the candidate and reading it**. A syntax bound over-reports as readily
as it under-reports, and widening one does not convert it into a property.

⚠ **Do not record a vitest test COUNT as gate evidence for this repo.** It is a property of the tree's
database at an instant. The durable claim is pass/fail, on a fresh `supabase db reset`, with the stack
up. (`test:db` counts *are* stable — pgTAP plans are literal.)

⭐ **Credit, because it is the reason this was a conversation rather than a silent green:** the helper
fails CLOSED — with the stack down it throws *"this guard reads the catalog on purpose and must never
silently skip"* instead of defaulting to a hardcoded list. Preserve that behaviour through any refactor.
