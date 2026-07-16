# QA Review — ADR 0078 M6 · `cases.visibility_policy`: the guarded door

**Commit:** `4a9cea0` · **Branch:** `feat/authorization-capability-model` · **Reviewer:** `qa`
**Date:** 2026-07-16 · **Scope:** local only; nothing pushed, no `e2e:prod`.
**Method:** live catalog (`pg_proc`/`prosecdef`, `pg_policies`, `pg_trigger`, ACLs, `pg_settings`) +
executed probes over **real PostgREST with real JWTs** + **my own mutation tests**. No claim below is
from migration text. Where I re-checked something the lead verified, I used a *different* method (§7.4).

## VERDICT: **APPROVED**

0 blocking · 0 major · 3 minor · 2 informational. The security substance of this unit is **correct and
correctly proven**. D1 is closed, D2 is closed, the narrowing does not over-bind, and the exclusion line
is load-bearing exactly as claimed. The minors are documentation/scope accuracy, not holes.

---

## 1. ⭐ The highest-value question: can `authenticated` set `app.in_case_rpc` itself?

The lead flagged this and never chased it: if a client can flip the GUC, **both `guard_case_visibility`
and `guard_case_status` are theatre**, and it is a P0 predating M6.

**Answer: at the SQL level YES — over the transport, NO. Not a P0. The guards are real.**

`app.in_case_rpc` is an unregistered custom GUC, so it is **USERSET**: no privilege prevents `authenticated`
from setting it. Proven:

```
begin; set local role authenticated;
select set_config('app.in_case_rpc','on',true);  -- returns 'on'
select current_setting('app.in_case_rpc', true); -- reads  'on'
```

So the guard is **not** protected by privilege. It is protected by the client having no way to execute
`set_config`. I closed that on **four independent legs**, all measured:

| # | Vector | Result |
|---|---|---|
| 1 | `POST /rest/v1/rpc/set_config` as a real JWT | **PGRST202 / 404** — `public.set_config` does not exist; exposed schemas are `public, graphql_public` only (`Content-Profile: pg_catalog` → **PGRST106**) |
| 2 | An exposed fn taking a **caller-controlled** GUC name | **0** — every `set_config` first arg in `public`/`graphql_public` is a string literal |
| 3 | **Pool leak** — a non-local set surviving into a pooled connection | **0 of 21.** All 21 functions touching the GUC use `is_local = true`. `set_case_visibility` included. A non-local set would leave the GUC `on` for the next request on that pooled connection and disable **both** guards — it does not exist |
| 4 | Dynamic SQL — `execute` + `||` in an exposed plpgsql fn (injection ⇒ arbitrary SQL ⇒ GUC) | **0** |

Leg 3 was the one I expected to fail and it did not; `is_local=true` on the door is the correct call and
is doing real work. **INFO-1** below records the residual structural fragility.

## 2. §7.7 — does the narrowing bind TOO MUCH? (the lead's stated top risk)

**Refuted as a risk — the guard binds on change, not on mention, and I proved my probe measures that.**

`BEFORE UPDATE OF visibility_policy` fires on **mention**. `backend` guarded with `IS DISTINCT FROM`.
Over real PostgREST as `chefe.ccih` (staff_admin):

| Probe | Result |
|---|---|
| PATCH `{visibility_policy: <unchanged>}` | **HTTP 200** ✅ |
| PATCH `{visibility_policy: <unchanged>, label: <real col>}` (multi-column) | **HTTP 204** ✅ |
| PATCH `{visibility_policy: <different>}` (D1 exploit) | **`23514` "case visibility policy changes must go through the case RPCs"** ✅ |
| …and the value after the D1 attempt | **`explicit_grants_only` — unchanged.** The raise is real, not a reason-code artifact (§7.2) |

**These probes are not vacuous — mutation-proven.** I rebuilt the guard from its **live** `pg_get_functiondef`
with the `is distinct from` test removed (code line only — `grep -c` matches **2**, one of which is the
**comment** saying it is mandatory; §7.2 trap #2). Under the mutant the unchanged-value PATCH goes
**RED (`23514`)**. Restored from the captured live def; **byte-identical**; probe green again.

**No spurious-raise path exists.** Closed on the catalog, not on the comment: the only function that
`UPDATE`s `cases SET visibility_policy` is **`public.set_case_visibility` itself**. And the guard comment's
own closed-set claim (*"every `from('cases')` in src/ is a read, zero `.update(`"*) **holds** — 9 `from('cases')`
sites in `src/`, none chain `.update(`/`.upsert(`.

## 3. Parity — is the door exactly as wide as the PATCH it replaced?

**Yes. `backend`'s §6b·1 correction is right and the lead's original "authority set is unchanged" was wrong.**

`prosecdef = t` on the door ⇒ RLS never applies (A28). `cases` has exactly **one** write policy — I checked
the whole policy set, not the one line the lead quoted, because a second permissive UPDATE policy would
have made the door *narrower* than the PATCH:

```
cases_staff_admin_write  ALL  {authenticated}
qual = with_check = ((is_staff_admin_of(commission_id) OR is_commission_admin_of(commission_id))
                     AND (NOT is_case_excluded(id, auth.uid())))
```

The door's gate is that predicate exactly: `HC0F5` authority → `assert_not_case_excluded` (`HC0F1`).
**No wider, no narrower.**

**Mutation-proven independently** (not `backend`'s script). With my fixture live (below), I re-emitted the
door from its live def with **only** `perform app.assert_not_case_excluded(p_case_id);` removed:

> the excluded respondent — a `staff_admin` — called the door and the case went
> `explicit_grants_only → commission_default`. **The accused doctor re-opened the case in which he is accused.**

Restored byte-identical; case value restored. The exclusion line is **load-bearing for parity**, confirmed.

## 4. ⭐ Are the 29 keystones vacuous?

**No — and the fixture trap `backend` caught is real. I reproduced it, and then it caught *me*.**

Live census of the CCIH roster confirms `backend`'s claim independently:

| persona | excluded | roles |
|---|---|---|
| `staff1.ccih` / `staff4.ccih` | **t** | `staff` (only) |
| `chefe.ccih` | f | `staff_admin` |

**No seeded persona is both excluded AND authorized.** Proven behaviourally: the excluded-but-unauthorized
`staff1.ccih` calling the door raises **`HC0F5`** (authority) — a `throws_ok` aimed at `HC0F1` there is green
while asserting nothing. Authority-first ordering (M1·4) is what makes it loud.

**233's fixture produces the state it claims.** It inserts the `staff_admin` membership for `st_x` and asserts
**both legs** (`PRE ⭐ leg 1/2` excluded=true, `PRE ⭐ leg 2/2` staff_admin=true) *before* the door is ever called.
I built the same fixture independently (elevating the excluded `staff1.ccih` to `staff_admin`) and the door then
raised **`HC0F1`**, not `HC0F5` — the exclusion gate is genuinely reached.

**Worth recording:** my *first* fixture insert silently failed a check constraint (`memberships_scope_shape` —
`staff_admin` requires `organization_id IS NULL`), and the door still answered `HC0F5`. Had I not asserted the
fixture state, I would have recorded a vacuous pass. This is exactly why 233's `PRE ⭐` assertions are the right
shape, and it is the strongest evidence in this review that they are not decoration.

`233` runs **29/29, 0 failed** — verified ran, not merely "0 failures".

## 5. The `230` edit — did M3's coverage survive?

**Yes, and it is not passing for the wrong reason. Mutation-proven.**

An engineer editing another unit's suite so his change passes is the right thing to be suspicious of. Rather than
re-diff the assertion lines (the lead already did that), I attacked the question directly: I made the M6-wrapped
**fixture write silently not land** (retargeted its `WHERE` to a nonexistent id — no raise, no abort, just a no-op):

| run | result |
|---|---|
| **control** (as shipped) | **25 ran, 0 failed** |
| **mutant** (fixture write does not land) | **25 ran, `not ok 21` — "M3 flag OFF + explicit_grants_only: the assignee gets NO PHI (E1 belt intact)"** |

The keystone the brief asked about is **exactly** the one that goes red. The fixture write is load-bearing;
M3's coverage survived intact. The structure is inherently self-verifying: `230` asserts `st_x2` PHI = **true**
under `commission_default`, then **false** after the fixture flip — the same predicate, same principal, so the
reading **must move** (§7.10). A silently-lost fixture write cannot hide.

*(Method note: my first run printed `ERROR: function plan(integer) does not exist` — that is an **abort, not a red**
(§7.1). pgTAP is not resident; `supabase test db` installs it transiently. I installed it, ran, and **dropped** it.)*

## 6. Rule 11 / Rule 12 — the audit witness

| Check | Result |
|---|---|
| Audit delta across a door call | **0 → 1** ✅ (D2 closed) |
| Metadata PHI-free | ✅ `{visibility_policy, previous_visibility_policy}` — policy values only, no case content, no identifiers |
| Hash-chained like its neighbours | ✅ `seq`, `prev_hash`, `row_hash` all populated and **linked** |
| `verify_audit_chain` (the real verifier, scoped to CCIH) | ✅ `{"ok": true, "broken_seq": null}` |
| Independent re-check | ✅ **0 broken links of 151** (partitioned by `commission_id`, ordered by `seq`) |

⚠ **I nearly filed a false P0 here.** My first chain check used a **global** `lag(row_hash) over (order by seq)`
and reported **74 broken links of 169**. The chain is **partitioned** (commission → hospital → org → platform,
per `verify_audit_chain`'s own precedence). My metric was wrong, not the chain. Recording it because it is the
same shape as §7.10: a scary number from a probe whose scope I had not attacked.

## 7. D3 — genuinely deferred, not silently live in a worse form

**Confirmed deferred, correctly, and not re-litigating the PO's call.**

- `default_visibility_policy` is read by **exactly one** function in the whole catalog: `public.create_case_from_template`
  (comments stripped). Closed at the catalog, not by counting callers.
- D3 remains genuinely **reachable**: I minted a `case_type` carrying `explicit_grants_only` as `orgadmin.a`
  over PostgREST — **HTTP 201**. `case_types` is a runtime-writable catalog; `backend`'s falsification of the
  "divergence becomes unreachable" hypothesis is correct. *(Probe row deleted; `case_types` back to 1.)*
- The seed change is **inert** as claimed, verified both halves: live `case_types.ethics = commission_default`,
  live case split **6/1 unchanged**, and E1 (`ca…e1`) still `explicit_grants_only` because `seed.sql:2115` inserts
  it **directly**. `e2e/ethics-e1-access-spine.spec.ts` pins `CASE_ID = ca…e1` — the seeded direct-insert case.
- D3/D4 are recorded in `PROGRESS.md`'s M6 section and the brief. Adequately durable.

## 8. ACL / hygiene

| Check | Result |
|---|---|
| `set_case_visibility` ACL | `{postgres=X, service_role=X, authenticated=X}` — **no PUBLIC entry** ✅ (mirrors `set_case_confidentiality` exactly) |
| `anon` EXECUTE | **false** ✅ |
| `guard_case_status` untouched | ✅ verified against the live body |
| No flag on the door | ✅ **correct, and `backend` was right to overrule the model.** `can_reach_case_on_member_surface` carries no `feature_enabled` call, so the column governs reach unconditionally; a flag-gated door + unconditional guard = the lockout the brief wrongly reported as already existing. Invariant "the door's availability must equal the column's liveness" is sound |
| pt-BR user-facing strings | ✅ `HC0F5`/`HC0F1`/`HC0F6` all pt-BR |

---

## Findings

### MINOR-1 — "no caller **anywhere** passes `p_case_type_id`" is literally false (§7.5 / §7.9: attack the scope)

`PROGRESS.md` (M6 section) and the task brief both state the closure as an **unscoped universal**. It is false:
**`supabase/tests/228_ethics_e1.sql`** passes a `case_type` three times (`:131`, `:151`, `:169`).

**The conclusion survives** — I verified the exposure independently and it is genuinely zero:
- `src/` — `p_case_type_id` appears **only** in generated types (`database.ts:8632`). No product caller passes it.
- `e2e/` — **zero** occurrences of `p_case_type_id`; PostgREST RPC args are named, so a caller cannot pass it positionally.
- `228` **bootstraps its own `case_types` row** (`00000000-…-0000000e0002`), not the seeded row — so the seed change
  provably cannot reach it.

So the *decision* is unaffected and the seed fix is inert as claimed. But the claim as **written** is the exact
pattern this program keeps paying for: a true conclusion resting on a universal nobody scoped.
**Recommend:** restate as *"no **product or E2E** caller passes `p_case_type_id`; the one pgTAP caller (`228`)
bootstraps its own type row."*

### MINOR-2 — the door has **no product surface**, and that gap is undisclosed

Option B as put to the PO was *"Seed + `set_case_visibility` RPC + guard trigger + audit"* at a cost of
**"one small migration + one app action"**. The migration shipped; **the app action did not.**
`set_case_visibility` appears in `src/` **only** in generated types (`database.ts:11053`). The model it mirrors
**does** have one (`set_case_confidentiality` → `src/lib/case-recusals/actions.ts:101`).

No hole — the RPC is real and callable, and D1/D2 are closed regardless. But the brief's own justification for B
over A was *"A1's own sub-group scenario stays unimplementable — there is no override door for a coordinator to
use"*, and from the product's side that is **still true**: a coordinator cannot reach this door through the UI.
Neither the commit nor `PROGRESS.md` says the app action was dropped or deferred.
**Recommend:** state explicitly that the product surface is deferred (and to where), or ship it.

### MINOR-3 — a stale/false claim in TypeScript survives the unit (§7.2 #3)

`src/lib/queries/cases.ts:484-486`:

```
 * The case's ACCESS MODEL (ADR 0072 D1), snapshotted onto `cases.visibility_policy`
 * at create from `case_types.default_visibility_policy`:
```

The brief (§3 D3) already identified this as false, and M6 did not touch it. It describes a path that
**never executes in product**: `create_case` never writes the column, and the template door only does so when
`p_case_type_id` is passed — which, per MINOR-1, no product caller does. §7.2 #3 is precisely *"stale claims live
in TypeScript too"*. Arguably inside "D3 reported, not fixed", but D3 is about the *doors disagreeing*; this is a
comment asserting a mechanism that does not run.
**Recommend:** one-line correction, or an explicit "D3, deferred" marker on the comment.

### INFO-1 — the guards are **transport-dependent**, not privilege-dependent

Per §1: no privilege stops `authenticated` from setting `app.in_case_rpc`. `guard_case_visibility` **and**
`guard_case_status` (which has protected `status` for months) hold only because a PostgREST client has no way to
execute `set_config`. That is true today on all four legs I measured — but it is an invariant nothing enforces.
The day someone adds a `public` wrapper around `set_config`, a caller-controlled GUC name, a non-local
`set_config`, or an `execute`-with-concatenation DEFINER, **both guards silently become theatre** and no test fails.
This is `BUG-SUP-002`'s shape (a DEFINER gate bypassable because the table had broad `authenticated` DML).

**Recommend (not blocking, cheap):** a pgTAP catalog guard asserting, over `public`/`graphql_public`, that
(a) no exposed function sets `app.in_case_rpc` with `is_local = false`, (b) no exposed function passes a
non-literal first arg to `set_config`, and (c) `public.set_config` does not exist. All three are one-query
assertions and pin the thing the guards actually rest on. Belongs to the program, not to M6.

### INFO-2 — stack state I mutated, and what I restored

**Everything restored; verified, not assumed:**

| Item | State |
|---|---|
| `app.guard_case_visibility` | restored from captured live def — **byte-identical** (`diff` clean) |
| `public.set_case_visibility` | restored from captured live def — **byte-identical** (`diff` clean) |
| Case `ca…e1` | `explicit_grants_only` ✅ ; live split **6 / 1** = seeded baseline |
| `staff1.ccih` membership | back to `staff` (my `staff_admin` fixture row deleted) |
| `case_types` | **1** row (`ethics`, `commission_default`) — my `qa_m6_probe` type deleted |
| `pgtap` extension | **dropped** (I installed it to run `230`/`233`) |
| Working tree | clean apart from pre-existing `graphify-out/` churn |

⚠ **One thing I could not undo:** `public.audit_log` is append-only and hash-chained, so my probe rows
**remain** — counted, not estimated: **`case.visibility_changed` ×5**, plus one `membership.granted` /
one `membership.revoked` from my exclusion fixture. The chain **verifies clean after everything**
(`verify_audit_chain` `ok=true`; my independent partitioned re-check: **0 broken of 151**), so nothing is
corrupt — but **run `supabase db reset --local` before the next pgTAP or E2E gate**, which the
pgTAP-needs-a-fresh-reset discipline requires anyway.

---

## What I refuted

- **The lead's stated top risk (§7.7 over-binding) is not live** — the `is distinct from` holds under a real
  multi-column PostgREST PATCH, and I mutation-proved my own probe measures it rather than trusting the green.
- **"No caller anywhere passes `p_case_type_id`" is false as written** (MINOR-1). The conclusion survives; the
  closure does not.
- **My own first hash-chain metric was wrong** and would have been a false P0 (§6). The chain is partitioned.
- **My own first exclusion fixture silently failed** and the door still returned a plausible error (§4) — the
  vacuity trap is not hypothetical, it caught the reviewer auditing it.

`backend`'s three corrections to the brief (§6b·1 exclusion-is-parity, §6b·2 no-flag, §6b·3 D3-falsified) are
**all verified correct** by independent method. This unit's engineering judgement was better than its brief's,
and the commit message says so plainly.

**APPROVED.**
