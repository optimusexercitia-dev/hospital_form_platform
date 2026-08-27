# AE0 — findings and PO decision list

**Phase:** AE0 · **plan:** `docs/plans/authz-evolution.md` · **authority:** ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) ·
**owner:** lead · **date:** 2026-08-26 · **branch:** `authz-ae0-baseline`

The AE0 artifacts each hold their own full evidence:

| task | artifact |
| --- | --- |
| AE0.1 catalog census | [authz-evolution-census-ae0.md](authz-evolution-census-ae0.md) · `scripts/authz-census-ae0.sql` |
| AE0.2 EXPLAIN baselines | [authz-evolution-baselines-ae0.md](authz-evolution-baselines-ae0.md) · `scripts/authz-explain-baselines-ae0.sql` |
| AE0.3 local/remote parity | [authz-evolution-parity-ae0.md](authz-evolution-parity-ae0.md) |
| AE0.4 service-role DML | [authz-evolution-service-role-dml-ae0.md](authz-evolution-service-role-dml-ae0.md) · `scripts/service-role-dml-census.mjs` |
| AE0.5 matrix axes | [authz-persona-matrix-axes-ae0.md](authz-persona-matrix-axes-ae0.md) |
| ARM gate baseline | [authz-evolution-arm-baseline-ae0.md](authz-evolution-arm-baseline-ae0.md) |

This file is the **decision surface only**. AE0 changed no schema and no behaviour.

---

## A. Two corrections that land on ADR 0155 itself

Per the plan's precedence rule the ADR outranks the plan — but these are cases where the
**ADR carries a measured claim that the catalog contradicts**, so neither document can
settle it and the PO must. Both were re-derived by the lead independently of the agent
that first reported them, against the live catalog, with working controls.

### F-AE0-1 — the "167 → 237 `anon`-residue growth" never happened ⛔ ADR + plan text

`237` and `167` are **two predicates at the same instant on the same head**, not a
before/after:

| predicate | value |
| --- | --- |
| `app` functions `anon` can EXECUTE, **all** | **237** |
| … the **DEFINER-only** subset | **167** |
| … the **INVOKER-only** subset | **70** |

167 + 70 = 237, exactly. `anon` also holds **no USAGE on `app`** (`false`), so the residue
is inert at the schema level regardless.

**Impact:** the plan's AE1.2 step 3 says explicit `ALTER DEFAULT PRIVILEGES` *"stops the
167→237 `anon`-residue growth at its source"*. **There is no growth to stop.** ⚠ The
*remedy* may still be right on hygiene grounds — a default-privileges stop is cheap and
prevents a real future drift — but its stated **justification is false**, and a remedy
kept for a reason that has been refuted needs its reason replaced, not quietly retained.
Fixing the direction of a claim without re-deriving its magnitude is how a partial fix
reads as a complete one.

**Ask:** amend ADR 0155 (and the plan's AE1.2) to state the two predicates with their
definitions, and re-justify or drop the default-privileges step on its own merits.

### F-AE0-2 — ADR 0155's role-helper predicate contains a dead term ⛔ ADR text

The published wide predicate includes `is_commission_admin`. Measured:

| probe | result |
| --- | --- |
| policies matching `is_commission_admin` | **0** |
| function names matching `is_commission_admin` | **0** |
| **control** — policies matching `is_tenancy_admin_of` | **53** |

The helper was **renamed to `app.is_tenancy_admin_of` (ADR 0105)**. The predicate term is
an orphan of that rename — the exact "a rename orphans a name-keyed verdict" shape.

⚠ **Second half, and it is the part that matters:** `is_tenancy_admin_of` is the
**second-largest** helper by policy count (53) and is named by **neither** published
predicate — not the ADR's wide 131 nor the audit's narrow 117. **No coverage is lost**
today (all 53 policies also match another term), so this is a *predicate-quality* finding,
not a number finding. But AE4.3 must sweep helpers by the catalog vocabulary, never by
either published regex.

**Ask:** correct the term in ADR 0155; adopt the catalog-derived helper vocabulary
(AE0.1 §3.4) as the sweep input for AE4.3 and every AE5 role.

### Also recorded: the two published counts are both honest

131 (ADR) − 117 (audit) = **14**, and the 14 are exactly the policies whose only
role-helper call is `app.is_admin()` — the platform-admin helper, which reads
`profiles.is_admin` / the JWT claim plus `app.active_role()` and **never touches
`memberships`**. Both numbers are right for their own predicate. Neither is usable
without the predicate attached, which is why AE0.1 records every figure with its query.

**New, and larger than either:** **233 of 278 policies (84%)** transitively depend on
`memberships` (573 functions in the closure). That, not "4" or "131", is the real blast
radius of any `memberships` change.

---

## B. A scope finding that resizes AE1

### F-AE0-3 — the service-role surface is 45 sites, not 12

The plan's 12 is correct **for raw `.from()` DML** and reproduced exactly, same
composition. The property-based sweep the plan also asked for finds **45 in scope**:

| family | count | covered by AE1.3's nine conversions? |
| --- | ---: | --- |
| raw `.from()` DML | 12 | 9 converted; 3 deliberately excluded (self-scoped `must_change_password`, 2 system-actor `meeting_minutes_jobs`) |
| `.rpc()` | 19 | **0** |
| Storage writes | 6 | **0** |
| Storage `createSignedUploadUrl()` | 4 | **0** — a family **no document had named**: it mints upload *capability* rather than writing bytes |
| Auth-admin | 4 | **0** |

0 UNRESOLVED. The detector was proven able to fail in both directions (neutralize a known
site → its hits drop to zero; restore → census returns to 45), which is what makes the
count admissible.

⚠ **The plan is not wrong** — AE1.4 explicitly commits the registry to *"table DML,
`.rpc()`, Storage, Auth admin"*. The finding is that AE1's **sizing** is drawn from the
12, and the registry has 45 rows to fill.

⛔ **The open part:** for **11 of the 19 `.rpc()` sites** (4 document-workflow, 4
minutes-job lifecycle, `list_stale_meeting_audio`, `get_feature_flags`,
`lookup_printed_document`) the revalidation determination is **undecidable from the call
site**: none passes an actor argument, none has a self-scoped or system-actor
justification, and none is a pre-existing `_for` door. A registry built from a mental
model of "nine conversions plus two system-actor writes" would miss all 33 non-Family-A
sites silently.

**Ask:** rule on the 11 before AE1.4 is scoped, and confirm AE1's sizing against 45.

---

## C. Hardening item found in passing

### F-AE0-4 — six `process_template_*` tables gate on `TO public`, not `TO authenticated`

The performance advisor reports a `multiple_permissive_policies` overlap naming `anon`,
`authenticator`, `dashboard_user`, `cli_login_postgres` and `supabase_privileged_role` on
6 tables. **Traced to source: those policies carry `roles={public}`** (no `TO` clause);
the advisor expands `{public}` into every concrete role. The other 2 tables in the same
feature use `TO authenticated`. It is a hand-inconsistency inside one feature's
migrations.

**Not an exposure today.** `anon` holds **no table-level SELECT grant** on any of the 8
(measured; positive control: the identical `has_table_privilege` call returns `true` for
`authenticated`, so the probe is not stuck-false). RLS policies are necessary, not
sufficient — the grant layer is what closes this.

⚠ **But the containment lives entirely in the grant layer.** A future migration granting
`anon` SELECT on any of these 6 makes them anon-readable with **no policy able to stop
it**; the 2 `TO authenticated` tables would be unaffected. Normalizing the 6 is cheap and
removes a dependency on an absence.

**Ask:** accept as an AE1.6-adjacent hardening item, or rule it out of scope explicitly.

---

## D. A record corrected during AE0 (done, no decision needed)

`docs/backend-state.md` § REMOTE CENSUS carried a **heading** asserting *"the production
DB is EMPTY"*, with data rows reading `0 rows` / `0 live` — false since 2026-08-19, and
unlike the migration rows in the same table they carried **no supersession marker**.
PROGRESS.md § State has carried the correction since 2026-08-21, so two records in the
repo disagreed for five days with nothing able to report it. Struck **figure-free** (a
figure would go stale the same way) and pointed at the one number that still decides
anything: the non-`@test.local` user count, which voids **G2**'s single-shot
authorization for AE3 the moment it is non-zero.

---

## E. Plan deviation taken, stated

### F-AE0-5 — AE0.5 built with SEVEN axes; the plan's row names five

The plan's AE0.5 row names *persona × role × active-context × scope × operation* and
attributes the grid to the audit's Phase 0 — which actually asks for seven, adding
**resource lifecycle** and **sensitivity**. Built as seven because AE4.1's
`authz.permissions` carries `risk_class` **and** `sensitivity_ceiling`, and the audit's §8
test list requires a lifecycle/sensitivity-ceiling case per permission. Projecting seven
down to five later is free; backfilling a missing axis means re-deriving and re-approving
every AE5 per-role matrix.

**Ask:** approve seven, or rule five and accept lifecycle + sensitivity as per-role free
variables. Full axes: [authz-persona-matrix-axes-ae0.md](authz-persona-matrix-axes-ae0.md).

---

## F. Baseline observations — no action, recorded so a later phase cannot inherit them

1. **`ARM=census` carries 36 more verdicts (600) than live gates (564).** Closure asks
   "every gate has a verdict", which a surplus does not violate — this passes correctly
   and is not a defect. It is recorded because AE4.6 renames a wrapper family, and a
   name-keyed verdict outlives the door it names. **The surplus must not grow
   unexplained.**
2. **`ARM=floor` = 72** never-called doors on a fresh reset (all allowlisted). The
   script's own comment says 110 and the plan discusses 35 phantom doors on a stale DB —
   three different quantities. **72 is the comparison floor**, measured, not any written
   number.
3. **407 reachable `prosecdef` scalar non-`bool` command doors are outside every ARM
   domain** (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, § Critical FUP **C2**). The four green arms
   are **not** a statement that those are protected — nor that they are exposed.
4. **The grant layer is not the lifecycle protection.** `authenticated` holds column-level
   **UPDATE on `profiles.is_admin` / `is_active` / `suspended_until`**; what stops those
   writes is `guard_profile_privileged_columns` + RLS. ⛔ Any AE1.3 reasoning that treats
   the column grant as the protection for `set_person_active_for` is reading the wrong
   layer. Separately, `REFERENCES` remains granted on all three columns AE3 moves — that
   is what keeps 145 FK constraints valid, and AE3 retires SELECT/UPDATE withholding, not
   `REFERENCES`.
5. **AE1.1's premise holds:** `commission_administrativos` carries exactly **one** FK
   (`appointed_by`) — `commission_id` and `user_id` are both genuinely missing. Orphan
   preflight measured **0/0**, positive-controlled (the identical `not exists` shape
   returns 1 against a known-absent uuid).

---

## G. Local ↔ remote parity: **zero divergence** (AE0's closing condition)

- **475 migrations** registered on local == on-disk == git-tracked == **remote**, same
  head `20261003004300`. The full **475-version set** was diffed, not just the counts —
  identical across all three sources.
- The two advisor rules that could not be reproduced by hand were settled by fingerprinting
  the raw `pg_policies` content instead: **278 rows, order-independent md5
  `f42d879a6f7142e034b8c7b4cdf9953b`, identical on both stacks.** ⭐ The first hand-rolled
  reproduction returned 81/18 against the advisor's 113/101 and was flagged as **a bad
  reproduction rather than a real divergence** — the right call, and the fingerprint proves
  parity without the aggregation needing to be correct.
- **143 of 1004 findings are structurally out of scope** for a local/remote comparison and
  are explained as such, not left as gaps: `unused_index` ×141 (a live `idx_scan`
  statistic, near-zero on a freshly reset DB by construction) and the 2 GoTrue project
  settings (leaked-password protection, MFA options — **posture consistent with
  `config.toml`, but not instrument-verified**, and stated that way).

### AE1 inputs, already measured

| input | value | consumer |
| --- | ---: | --- |
| `auth_rls_initplan` | 113 | AE1.5 |
| `multiple_permissive_policies` | 101 | AE1.5 |
| `rls_enabled_no_policy` | 7 (3 are Rule 12 PHI tables) | AE1.6 |
| `function_search_path_mutable` | 6 (all INVOKER) | AE1.2 |
| `unindexed_foreign_keys` | 202 | AE1.5 / triage |
| `authenticated_security_definer_function_executable` | 432 | AE1.2 classification |

⚠ **One data difference, and it is data, not catalog:** the remote holds `cases` **15**
vs local **8**, `audit_log` **538** vs **264**, while orgs/hospitals/commissions/users/
affiliations match exactly. Reading: the remote was seeded with the E2E fixture and then
exercised. **G2's premise still holds** — `auth.users` 36/36, **zero** non-`@test.local`
— but it is **re-measured at each branch-cut, never quoted from this file**.
