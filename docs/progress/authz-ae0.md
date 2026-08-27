# AE0 — Baseline and attributable measurement (authz evolution, ADR 0155)

Task detail rotated out of PROGRESS.md at the AE0 Record step, 2026-08-26.
**Authority:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
(decisions) + the [plan](../plans/authz-evolution.md) (execution). Branch
`authz-ae0-baseline`, cut from `d76abba0`.

⛔ **AE0 changed nothing.** No schema, no migration, no policy, no `prosecdef` gate, no
application behaviour. `git diff --stat main...HEAD -- supabase/migrations/` was **empty**,
which is *why* no diff-scoped door sweep was owed — measured, not assumed.

## What AE0 was for

Every later AE phase must be able to say **"this regression is mine / not mine"**. AE0
buys that, and re-establishes the standing residue that **no authz-gate result predating
2026-08-24 is trusted** — the step-1 suite was then not running on this platform at all, in
two independent committed ways, and `ARM=census` printed `INVARIANT HOLDS` at exit 0
**having enumerated ZERO gates**.

## Tasks

| # | task | outcome |
| --- | --- | --- |
| AE0.1 | catalog census, recorded **with predicates**, local + linked remote | ✅ [census](../design/authz-evolution-census-ae0.md) · `scripts/authz-census-ae0.sql` |
| AE0.2 | `EXPLAIN (ANALYZE, BUFFERS)` baselines, 7 named paths × 3 reps | ✅ [baselines](../design/authz-evolution-baselines-ae0.md) · `scripts/authz-explain-baselines-ae0.sql` |
| AE0.3 | local/remote parity + both advisors | ✅ [parity](../design/authz-evolution-parity-ae0.md) |
| AE0.4 | service-role DML sweep, re-derivable | ✅ [registry input](../design/authz-evolution-service-role-dml-ae0.md) · `scripts/service-role-dml-census.mjs` |
| AE0.5 | persona/authorization matrix **axes** | ✅ **PO-approved at SEVEN** → [axes](../design/authz-persona-matrix-axes-ae0.md) |
| — | ARM gate baseline | ✅ [arm baseline](../design/authz-evolution-arm-baseline-ae0.md) |
| — | the decision surface | ✅ [findings](../design/authz-evolution-ae0-findings.md) |

## Gate AE0

| step | result |
| --- | --- |
| lint | **10/10, exit 0** — verified with the exit code captured directly, after a first attempt piped through `tail` reported `LINT_EXIT=0` that was **`tail`'s** exit code |
| typecheck | `tsc --noEmit` exit 0 |
| vitest | **142 files / 1920 tests** |
| pgTAP | **229 files / 7563 tests, `Result: PASS`**, on the fresh reset |
| `ARM=census` | green — **564** live authz gates, **600** verdicts |
| `ARM=hat` | green — detector self-test **6/6**, 3 findings all reasoned-allowlisted |
| `ARM=floor` | green — **72** never-called doors, all allowlisted; every allowlist entry resolves to a live door |
| `FROMFINDINGS=1 ARM=wrapper` | green — BLIND set **41**, all allowlisted |
| diff-scoped door sweep | **not owed** — zero migrations touched (measured) |
| local↔remote drift | **zero** |
| QA review · E2E | **not required by Gate AE0** (measurement-only), and nothing changed for them to test |
| human approval | ✅ 2026-08-26 |

⭐ **Every ARM figure is recorded as what the arm ENUMERATED, not as its exit code.** An
arm that reports green with no count is treated here as a red.

## What AE0 found

Full detail in [findings](../design/authz-evolution-ae0-findings.md). The five that change
later work:

1. **ADR 0155's "167 → 237 `anon`-residue growth" never happened** — two predicates at one
   instant (167 DEFINER + 70 INVOKER = 237); `anon` holds no USAGE on `app`. → ADR
   [0160](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md). AE1.2's
   default-privileges step **kept, justification replaced**.
2. **ADR 0155's role-helper predicate names a dead term**, `is_commission_admin` — 0
   policies, 0 functions, against a control returning 53 for `is_tenancy_admin_of` (the
   ADR-0105 rename). AE4.3/AE5 sweep by catalog vocabulary, unanchored across the
   bare/`_for` pair. → ADR 0160.
3. **The service-role surface is 45 sites, not 12.** The 12 is raw `.from()` DML and
   reproduced exactly; `.rpc()` (19), Storage (6), Auth-admin (4) and
   `createSignedUploadUrl` (4 — **a family no document had named**) add 33. **11 of the 19
   `.rpc()` sites have an undecidable revalidation mechanism** — open, and it resizes
   AE1.4's registry.
4. **`profiles` carries verbatim-duplicated permissive policy arms costing ~4× today** —
   an 11-arm OR from two policies, five arms literal repeats; `hospital_admin` falls
   through to `SubPlan 3` at `loops=14`, 16.5 ms / 533 buffers for 15 rows vs 3.9 ms / 135
   for 20. Same class on `commissions` and `commission_meeting_types`. ⭐ This is the one
   shape that clears AE1.5's "provably equivalent-intent" bar **without argument** —
   removing a literal repeat from a disjunction is identity.
5. **This DB has no planner statistics** (`reltuples = -1`, `last_analyze` null). ⛔ Never
   `ANALYZE` before a comparison run; a **cost-only** diff may be autovacuum rather than
   anything anyone did. Only **shape** diffs are findings.

Plus, recorded so no later phase inherits them silently: `ARM=census` carries **36 more
verdicts (600) than live gates (564)** — correct today, but AE4.6 renames a wrapper family
and a name-keyed verdict outlives its door, so the surplus must not grow unexplained;
`ARM=floor` is **72**, not the 110 in the script's own comment nor the 35 phantom-on-stale
figure in the plan; **407** reachable `prosecdef` scalar non-`bool` command doors remain
outside every arm's domain (§ Critical FUP **C2**), which is neither a clean bill nor
evidence of exposure.

## Records corrected during AE0

- **`docs/backend-state.md` § REMOTE CENSUS** asserted *"the production DB is EMPTY"* in
  its **heading**, with data rows reading `0` and **no supersession marker** — false since
  2026-08-19, while PROGRESS.md § State carried the correction from 2026-08-21. Two
  records in the repo disagreed for five days with nothing able to report it. Struck
  **figure-free**, because a figure goes stale the same way.
- **AFF4 residue (1)**, marked `✅ DISCHARGED`, was concluded content sitting in a
  live-state-only section. Rotated verbatim → [2026-Q3.md](2026-Q3.md), keeping a live
  pointer for the standing rule it broke: **push schema before code**.
- **The plan's AE0.5 row** named five axes while attributing the grid to the audit's Phase
  0, which asks for seven. Corrected in the plan rather than carried as a silent deviation.

## Method notes worth keeping

- **DEFINER functions are never inlined**, so `EXPLAIN` of the session-context RPC, the
  dashboard aggregates and the grant/revoke doors yields a bare `Result` / `Function Scan`.
  The harness carries an opt-in Pass B (`auto_explain`, nested statements). `list_cases_board`
  is **comparable on cost only** (~4 200 log lines) and the artifact says so rather than
  substituting a neighbouring query under the named path's label.
- **`EXPLAIN ANALYZE` executes.** Grant/revoke ran for real inside per-rep transactions,
  rolled back — and the harness proves the writes **landed first**, because a silent no-op
  would `EXPLAIN` just as cheaply and report green.
- **`cases` comparisons must be arm-matched.** `cases_staff_admin_write` is `FOR ALL` and
  therefore **a read policy too**, short-circuiting the coordinator before `_case_caps` is
  reached. Cross-arm comparison reads as a regression no change caused.
- **The parity proof did not depend on the aggregation being right.** A hand-rolled
  reproduction of two advisor rules returned 81/18 against the advisor's 113/101; it was
  flagged as **a bad reproduction, not a divergence**, and parity was settled instead by an
  order-independent md5 over raw `pg_policies` content — 278 rows, identical hash on both
  stacks.
- **No seeded persona is cross-org** — confirmed against data by three independent
  resolutions. The cross-org deny cell is **fixture-only, permanently**.
