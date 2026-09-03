# QA review — AE4 / IA-F9: statement-scoped permission resolution (`20261003007320`, ADR 0182)

**Reviewer:** `qa` · **Date:** 2026-09-03 · **Subject:** branch `authz-ae4-scope-reaches-fix` @ `9f7fa68d`
(worktree `.claude/worktrees/friendly-spence-607f77`; tree clean, verified)
**Contract:** CLAUDE.md §6 step 3. Read-only on application code, migrations, specs, scripts and queries.
**Verdict:** ⛔ **CHANGES REQUESTED** — see §7. No security hole was found; the blocking items are a
defect in a `SECURITY DEFINER` function's `search_path` (with a pgTAP assertion that pins it), a control
whose written specification contradicts the control that actually ran, and an acceptance record that
contradicts its own verdict.

## 0. Why a new file

The two existing AE4 review files carry verdicts about a *different subject*: `authz-ae4-gate-review.md`
judged AE4.1–4.9 on branch `authz-ae4-catalog` @ `e897b452`, against the **pre-change** policy predicate
and run 5. This increment alters `professional_profiles_select` and re-aims the acceptance controls.
Appending here would attach a new verdict to a file whose name and prior rows assert the old one — the
same failure mode the door sweep's ruling 3 exists to prevent (*"a verdict is keyed to a gate's NAME;
`ALTER POLICY` changes the predicate and keeps the name"*). A separate file keeps the two subjects
separable.

## 1. Method

Everything below was re-measured. Where the brief states a number I re-derived it; where it states a
security property I attacked it. **The live catalog was the sole truth** for schema/RLS/RPC/authorization
(`pg_proc` incl. `prosecdef` and `proconfig`, `pg_policy`, `pg_rewrite`, `pg_attrdef`, `pg_constraint`,
`pg_class.relacl`, `pg_attribute.attacl`, `pg_auth_members`); migration text was read only as a statement
of *intent*.

⚠ **All DB measurements below were taken with the AE4 perf fixture LOADED** (12 036 `auth.users`,
10 001 `professional_profiles`, 48 799 `memberships`, 13 organizations — re-counted, not quoted).
**I did not `supabase db reset`**, so the fixture and the run-6 perf artifacts survive this review intact.
Consequence to weigh: figures marked *(fixture)* would differ on a seed-only DB, and in two places the
fixture makes the tested population **narrower**, not wider — §5.1 and §5.2 say where.

## 2. Security / RLS — the axis this review weights heaviest

### 2.1 The over-grant-impossible claim: **holds**, and it survived every attack I made

I traced the confirmation path in the catalog, not the migration file.

`authz.authorized_scope_ids` (live body, `pg_get_functiondef`) proposes one candidate per assignment
fact via a `CASE`, deduplicates with `distinct` inside a `materialized` CTE, then filters:

```
   where c.scope_id is not null
     and authz.has_permission(p_principal, p_resolution_kind, c.scope_id, p_permission_code);
```

`authz.has_permission` is the same function the ELSE arm reaches — `app.can_read_professional_profile`'s
re-keyed arm calls `authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')` with
`v_org` = the row's own `organization_id`. Same function, same permission code, same resolution kind,
same scope id. So a row the set arm grants was approved by the unmodified resolver for exactly the
question the ELSE arm would have asked.

**Reachability is closed.** Measured, not assumed:

| check | measurement |
| --- | --- |
| callers of `authz.authorized_scope_ids` anywhere in `pg_proc.prosrc` | **1** — `app.current_professional_read_organizations()` and nothing else |
| `proacl` on all 10 `authz.*` functions | `{postgres=X/postgres}` — non-NULL (so PUBLIC is not implied), no app role |
| policies referencing the new door | **1** — `professional_profiles_select` |
| views / defaults / constraints referencing it | **0 / 0 / 0** (`pg_rewrite`, `pg_attrdef`, `pg_constraint`) |
| PostgREST exposed schemas (`supabase/config.toml:13`) | `["public", "graphql_public"]` — `app` and `authz` are **not** reachable as RPCs |

**The empirical differential.** 413 §5 measures the subset property for **one** principal. I ran a much
wider one, in the **self/hat context the policy actually uses** (`request.jwt.claims` set per principal
with that principal's own role as the hat), over **37 principals × 11 distinct hats × all 13
organizations = 520 cells**, with a probe profile synthesised into every organization so no org was
skipped:

```
 cells | principals | hats | set_arm_grants | old_grants | OVERGRANT_VIOLATIONS | fallback_only_grants
   520 |         37 |   11 |              4 |         21 |                    0 |                   17
```

**Zero over-grants.** The 17 fallback-only grants (13 `platform_admin`, 4 `org_admin`) confirm the ELSE
arm is genuinely load-bearing and that the rewrite is a short-circuit, not a change of meaning. Only
`staff_admin` produces set-arm grants, matching 413's stated premise that it is the only role entailing
`org.professionals.read`.

### 2.2 The unstated assumption the claim rests on

The brief asks whether the argument is airtight or rests on something unstated. It is airtight, and the
load-bearing unstated step is **principal symmetry**: both arms must pass `p_principal = auth.uid()`.
`entailed_grants`' hat conjunct is

```
(p_principal is distinct from (select auth.uid()) or af.role_code is not distinct from app.active_role())
```

so a set arm resolved for a *different* principal would take the third-party branch (hat not required)
while the ELSE arm takes the self branch (hat required) — and the set arm would then be **wider** than
the predicate it short-circuits. That is over-grant. The migration header states this correctly
(`20261003007320.sql:215-219`) and 413 test 5 pins `pronargs = 0`.

Two notes on that pin:

- It is **sufficient at the door**, because `authz.authorized_scope_ids` itself is EXECUTE-restricted to
  `postgres` and `authz` is not an exposed schema, so the 0-arg wrapper is the only reachable entry.
- But `pronargs = 0` **does not measure what its own message claims**. Test 5's caption reads *"the
  principal is bound to `auth.uid()` internally"*; the assertion measures argument count only. A body
  keeping zero arguments and binding some other principal would pass it. This is covered *behaviourally*
  by §3b/§3c (wrong hat and absent hat both deny), so it is not a hole — but the caption is a predicate
  quoted at the wrong grain, and captions are what the next reader trusts. **LOW-1.**

I also checked the assumption the brief does *not* raise at all: **whether the fast path skips an audit
side effect.** It does not. `app.can_read_professional_profile` is `STABLE` and writes nothing; the two
other DEFINER callers (`app._audit_access_authorized`, `public.get_case_professional`) are not on this
policy's evaluation path, and the policy qual references only the new door and that predicate. Rule 11's
audited-read obligation for the Class-2 professional-identity surface is unaffected by this change.

Finally, the brief's claim that `organization_id` being `NOT NULL` is *load-bearing* is true in the safe
direction but slightly overstated: `NULL IN (<set>)` evaluates to `NULL`, not `true`, so a nullable
column could never make the set arm fire — the `CASE` would fall to the ELSE arm regardless. The pin
(413 test 6 + the migration postflight) is belt-and-braces, and harmless.

### 2.3 ⛔ **MED-1 — the new `SECURITY DEFINER` function's `search_path` is a single nonexistent schema**

`supabase/migrations/20261003007320_ae4_statement_scoped_authorized_scope_ids.sql:226`

```sql
set search_path to 'app, public, pg_catalog'
```

The single-quoted form makes that **one** identifier, not a three-element list. The catalog confirms the
two siblings differ:

```
 app.can_read_professional_profile           | search_path=app, public, pg_catalog     | no dquote
 app.current_professional_read_organizations | search_path="app, public, pg_catalog"   | DQUOTED
```

and the runtime effect is measured, not inferred:

```
 MALFORMED-FORM | "app, public, pg_catalog" | current_schemas(true) = {pg_catalog}
 CORRECT-FORM   |  app, public, pg_catalog  | current_schemas(true) = {app,public,pg_catalog}
```

`app` and `public` are **not** on this function's effective search path. It works today only because the
body fully qualifies (`authz.authorized_scope_ids`, `auth.uid()`).

Why this is a required change and not a nit:

1. It is a `SECURITY DEFINER` function **on the authorization path** whose declared schema resolution is
   a lie. Any later edit that adds an unqualified reference — which the declaration positively invites,
   since it *says* `app, public` are available — fails at runtime, and a failure here does not degrade
   gracefully: `professional_profiles_select`'s THEN arm raising means **every** read of that table errors.
2. With no explicit schema on the path, `pg_temp` sorts first for unqualified names. That is the classic
   DEFINER-hijack shape. Not exploitable as written; one unqualified identifier away from being so.
3. **pgTAP 413 test 4 (`supabase/tests/413_ae4_authorized_scope_ids.sql:142`) pins the malformed value as
   the expected one**:

   ```
   'postgres|t|s|SETOF uuid|{"search_path=\"app, public, pg_catalog\""}|authenticated=X/postgres,...'
   ```

   So the suite goes **RED when someone fixes the defect**. This is the recorded "the harness holds a
   hand-written copy of production text, and the suite pins the defect as expected" shape.
4. The brief lists *"correct owner / prosecdef / volatility / **search_path** / return type / exact ACL"*
   among its **VERIFIED** items. That claim is false as stated — the search_path is not correct, and the
   assertion that "verified" it is the one pinning the wrong value.

**Required:** a follow-up migration emitting `set search_path to app, public, pg_catalog` (matching the
sibling), and 413 test 4's expectation updated in the same change. Alternatively `set search_path to ''`
with the body already fully qualified, which is the stronger hardening.

### 2.4 The `hat_ok` third-party branch — is `pronargs = 0` the only route?

Within this increment's surface, yes, and it is doubly closed: the wrapper takes no principal, and the
underlying resolver is unreachable by any application role or through PostgREST. The third-party branch
remains reachable by *other, pre-existing* callers that pass a non-`auth.uid()` principal — that is
`entailed_grants`' documented asymmetry, unchanged here and out of scope for this increment.

### 2.5 `professional_participants_select` — the sibling policy

Unconverted by design, still on `app.can_read_professional_profile`, filed as
`FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW`. I confirmed from `pg_policy` that exactly two
policies reference that predicate and only one was altered. No security consequence; the increment
neither widens nor narrows it. See **LOW-4** for a stale claim in that FUP's title.

## 3. Requirements — does this discharge acceptance §12.4?

**Yes, on substance.** §12.4 localized the residue as `authz.entailed_grants`' invocation structure and
ruled that removing it is "a different increment with its own approval". This increment removes exactly
that, without redefining `scope_reaches`, `entailed_grants`, `assignment_facts`, `has_permission`,
`candidate_has_permission` or `can_read_professional_profile` — I read all six live bodies and they are
coherent with their documented semantics. Run 6 records P1–P5, P7, DC1b, DC2, DC3 all PASS, K = 4
verifiably not moved.

Two requirement-level gaps:

### 3.1 ⛔ **MAJOR-1 — the DC3 that is specified is not the DC3 that ran**

`docs/design/authz-ae4-performance-acceptance.md:996` — the **normative ruling table** — defines the new
control as:

> return the **empty set** ⇒ the org-filtered read must yield **0 rows**

The harness implements the opposite criterion, `scripts/authz-ae4-perf-harness.sql:1199,1203`:

```
when nullif(:'dc3a_own','')::bigint <> nullif(:'dc3_own_base','')::bigint then 'FAIL'
... 'DC3a empty-set: own-org rows %s -> %s (MUST NOT move: the ELSE arm still grants) ...'
```

and §14:1108 scores it that way: `10 000 → 10 000 · must NOT move · PASS`.

These are not two wordings of one criterion. Under §13.2's text, the measured reading of 10 000 rows is a
**FAIL**, and under P6 a failing control makes the run **VOID**. Worse, §13.2's criterion is
**unsatisfiable by construction**: with an empty set the `CASE` falls to the ELSE arm, which still grants
for a principal holding the permission, so the read can never yield 0 rows.

The *implemented* control is the correct one — DC3a is a no-regression check on the fallback, DC3b
(`foreign rows 0 → 1`) is the discrimination half that proves the set arm is consulted and load-bearing.
The *specification* is wrong. This matters because the document names DC3 as one of only two things that
now bound the converted path (§13.3, §14.1 item 2, §13.6's split table at :1088). A reader auditing that
claim reads a definition the run did not use, in the one section written to make the amendment auditable.

Note also that §13.6:1088 credits **DC3a/DC3b jointly** with showing "the set arm is consulted and
load-bearing". As measured, DC3a shows no such thing — it shows the *fallback* still grants. The whole
discrimination weight sits on DC3b.

### 3.2 ⚠ **MAJOR-2 — Phase Gate step 2 (E2E) was not run, and no approval is recorded**

Both are named in the brief rather than hidden, which is to its credit; both still need a ruling.

- **E2E.** `npm run e2e:prod` was not run. CLAUDE.md §6 puts the full-suite green *before* this review. My
  judgement: **not a full-suite blocker**, because I measured the grant set to be unchanged across 520
  cells and the increment contains no TypeScript, no UI and no generated-type change (`git show --stat`
  touches no `src/`). But every measurement in this increment is DB-side, and the standing lesson is
  explicit that a correct SQL door is *evidence about the door and about nothing downstream*. A **targeted
  subset run** (`SPECS=` the professional-profile / participants read paths) should precede merge.
- **Approval.** Acceptance §12.4 said this increment has "its own approval". No authorising party appears
  in §13, §14, or ADR 0182's header — which carries `**Status:** accepted` with no attribution, while the
  immediately preceding precedent (P1 → ADR 0181) recorded *"PO ruling 2026-09-02"* explicitly.
  `Status: accepted` currently asserts something no artifact evidences.

## 4. Ruling on the §13 acceptance-protocol amendment

The lead asked me to rule on whether §13 is a legitimate correction or an instrument edited to
accommodate a result. **My ruling: legitimate in substance, defective in record — and one half of it was
in fact written after a failing reading, which §14 denies.**

**Why the substance is right.** DC1's statement (`select count(*) from (select 1 from
public.professional_profiles limit 200) t`) reads through *the very policy this increment rewrites*, and
DC2 reads that policy's cost curve. Both are calibrated on per-row amplification. Removing the
amplification makes them structurally unable to observe their subject — they would have failed *because
the change worked*, and under P6 a failing control VOIDs the run. That is not a result to be accommodated;
it is an instrument that has stopped pointing at anything. Moving both onto the pre-change predicate
preserves them as instrument-health checks, and DC3 (semantic) and P7 (plan shape) restore discrimination
on the live path without being timing ratios. The implementer's argument — *the subject is unchanged and
the old instruments became structurally unable to observe it* — is correct, and I accept it.

The discipline markers §12.6 asks for are mostly present and I verified them independently: **no threshold
moved** (P5's row at :332 is byte-identical pre- and post-commit; `≥10×`, `≥5×`, `≤30`, `M=20` all stand),
old verdicts preserved and the two near-misses (4.99, 25 % over) left recorded as FAIL, and the killed
DC1 re-aim onto `professional_participants_select` recorded rather than quietly dropped (§13.5).

**Why the record is nonetheless defective.** Four things, in descending order:

1. **§14:1097 asserts the amendment was "ruled and written *before* the run". That is false for DC2**, and
   §13.6's own heading says so: *"DC2 fell to the same trap, and §13 missed it — found by RUNNING, not by
   reading"* (:1055), with DC2 measured at **1.15× against `≥ 5×`** on the live path (:1063) — a control
   failure — before being re-aimed. Corroborating: §13.6:1078 records `P4 = 1.11`, a reading from a pass A
   that appears nowhere in §14 (which records 1.16 / 1.16). So a control **was** changed after a failing
   reading. I think the change was *correct* — same mechanism as DC1's, ruled in advance, missed only in
   enumeration — and the disclosure in §13.6 is exactly what makes it auditable. But §14 is the record
   that outlives the commit message, and its verdict paragraph erases the qualifier that both the commit
   message and PROGRESS.md carry. **This is the single sentence I most want corrected.**
2. **§13.2's ruling table (:1000) lists DC2 as `UNCHANGED`** while §13.6 (:1074), four subsections later,
   re-aims it. A reader who stops at the ruling table — which is what a ruling table is for — gets the
   wrong answer.
3. **The document header (:9) still reads "STATUS after run 5 (2026-09-02): NOT MET"** while §14:1094
   declares "**ACCEPTANCE MET**". The always-read top of the file contradicts the verdict, and the file's
   own convention for every prior status change (new banner + strike-through of the old) was not followed.
4. **§6.1/§6.2 carry `⭐ AMENDED — §13` / `⭐ RE-AIMED — §13` markers over condition text that was not
   changed** (:329 still reads "once per protected row"; :330 "per protected row"), while **DC2 — the one
   control that genuinely was re-aimed — carries no marker at all** (:345). The pointers are attached to
   the wrong rows.

Plus **MAJOR-1** above: the new control's definition does not match the control that ran.

One thing §12.6's checklist asks for that is **not** demonstrated: property 3, *"the new check is proven
able to return both verdicts"*. DC3b demonstrably moved `0 → 1`. **P7 has no negative control reported** —
no run in which its three booleans came back false. P7 is one of the two controls now bounding the
converted path, and it has never been shown able to fail. **MED-2.**

## 5. Test strength — where a green is narrower than it reads

### 5.1 ⚠ **MED-3 — 413 §5, "the SUBSET property the policy rewrite actually rests on", is 2 rows × 1 principal**

§5 cross-joins `public.professional_profiles` with `f413` — **one** principal. I replicated its fixture
exactly and measured how many rows fall on the *granting* side, where the assertion has any content:

```
 pid  00000000-...-000000000002 | own_org 0c000000-...-00000000000a
 rows_in_set = 2   total_profiles = 10 002   profiles_in_own_org = 2
```

Two rows — one of them the row §0 inserted itself. The other 10 000 fall on the not-in-set side, where the
predicate `inset and not oldpred` is trivially false. *(fixture)* — and here the fixture makes it
**worse**, not better: all 10 001 fixture profiles sit in **2 of 13 organizations**, neither of which is
the test principal's, so scaling the fixture added zero granting cells. §2 carries explicit non-vacuity
guards (§2b/§2c); §5, the assertion the migration header calls load-bearing, carries none.

This is not a hole — §2's differential plus the structural confirm step plus my 520-cell sweep all
corroborate the property. It is a test whose green is much narrower than its message.

### 5.2 ⚠ **MED-4 — 413 §2's differential exercises 2 of the `CASE`'s 4 branches**

I replicated §2's population exactly (40 sampled principals + `f413.pid` + the unprivileged principal ×
13 organizations) and classified every granting cell by which `CASE` branch proposed it:

```
 total_cells 533 | granting 4 | denying 529 | disagreements 0 | principals 41

 commission   | ASCENT commission->org | 4 granting cells reached
 organization | IDENTITY               | 1 granting cell reached
```

- `hospital → organization`: **zero** granting cells. The branch is never confirmed by any cell.
- `commission → hospital`: **structurally unreachable by this suite** — every call in 413 passes
  `p_resolution_kind = 'organization'`, so that branch cannot be entered at all.

The **security** consequence is nil, and this is the design's real strength: an unexercised or wrong
branch can only *under*-propose, and the ELSE arm catches it. But §2's message — *"agrees with
`authz.has_permission` on every cell"* — reads as coverage of the candidate map, and half the map is
unexercised. Four granting cells out of 533 is also thin: §2b's guard is "≥ 1", and it is satisfied
essentially by the one principal explicitly unioned into the population, not by the 40-principal sweep.

Worth noting for balance: §7a's vacuity plant is **one-directional** (over-broad only). Because the
differential is written with `is distinct from`, a missing-proposal defect would also make it red — but
only on a cell whose branch is exercised, which returns to the point above.

### 5.3 ⚠ **LOW-2 — the migration postflight has no non-vacuity guard**

`20261003007320.sql:272-310` asserts 0 disagreements over 200 principals × organizations and never
requires a granting cell to exist; its comment claims *"a bounded differential on **BOTH** polarities"*
while nothing measures that both polarities are present. The migration discloses it as *"a smoke test…
not the coverage"*, which is honest, so this is LOW — but the comment overstates what runs.

### 5.4 What I reproduced

| claim | result |
| --- | --- |
| pgTAP 413 | **24/24 PASS**, reproduced individually under the fixture (`ok 1 … ok 24`, `plan 1..24`) |
| `npm run lint` (12 gates) | **exit 0**, read from a file, not a pipe (`lint:authz-vectors` in sync, `adr:index` OK at 180 ADRs) |
| `npm run typecheck` | **exit 0**, read from a file |
| `scripts/door-sweep-cases.sh 9f7fa68d^` | **exit 0 (DERIVED)** — 1 case `professional_profiles_select`; read arm 1, write arm 0; ruling-3 STALE-verdict warning reproduced verbatim, the three new functions on the EXCLUDED-BY-NAME review list |
| findings-file baseline untouched | `git diff --stat -- docs/reviews/authz-door-audit-findings.md` empty; my sweep run wrote to an overridden `WORK` |
| 387 C1 inversion | **reproduced bit-exact** — substituting the pre-change qual text returns `3901715193753db33f980f939c6467de`, the old pin |
| over-grant sweep (mine, wider than 413 §5) | **0 violations** / 520 cells / 37 principals / 11 hats / 13 orgs |

**Not reproduced within this review — and why it could not be.** The full `npm run test:db` shape
(`Files=261, Tests=8733`) and the door sweep's own CLEAN/COVERED verdict. I started the read-arm sweep
with `WORK` overridden; **it could not get past its own green-baseline capture**. `pg_stat_activity`
showed why: `test_helpers.bootstrap()`'s `truncate … cascade` runs for **minutes per suite** against a
12 036-user / 48 799-membership tenancy, so the full suite is not practically runnable while the AE4 perf
fixture is loaded. I stopped the run in the safe window — **before any gate was neutralized** — and
verified from the catalog that nothing was left degenerate:

```
 degenerate_bodies = 0        (no 'planted'/'NEUTRALIZED'/'ae4dc3' body in app/authz/public)
 professional_profiles_select : has_then_arm = t · has_else_arm = t
 app.current_professional_read_organizations : md5 a62e7809a7d8cf7e57ac7adf1458aabb
```

That last md5 is an independent corroboration worth recording: it is byte-for-byte the value
`authz-unswept-backlog.txt` records as the **restored shipped body** after the targeted mutation case, so
the implementer's "restore proven byte-identical" claim reproduces from the live catalog.

So: I reproduced the sweep's *derivation* (exit 0, 1 read case, 0 write cases, ruling-3 warning) but not
its *verdict*. ⛔ Per this repo's own standing rule that is a **checkable claim left unchecked, not a
pass**. Two consequences for the lead:

1. **The brief's `Files=261, Tests=8733 PASS` figure was necessarily earned on a seed-only DB**, not the
   current one. That is correct practice (§6 step 1 demands a fresh reset) — but it means the pgTAP gate
   and the perf run are figures from two different DB states, and neither can be re-derived without
   destroying the other.
2. **The door sweep's read-arm verdict for the altered gate is the one gate figure this review could not
   independently confirm.** Ruling 3 makes it load-bearing: `professional_profiles_select`'s existing
   `COVERED` was earned against the pre-ALTER predicate and must not be inherited. Re-run it on a fresh
   reset before the gate record is written.

I did **not** reset the DB. The fixture is intact (12 036 / 10 001 / 48 799 re-counted after the stop), so
the run-6 perf artifacts remain re-derivable. ⚠ Two orphaned `psql` backends from the stopped sweep were
still finishing their statements when this was written; they are inside pgTAP transactions that end in
`rollback` and their client is gone, so they roll back — but confirm `pg_stat_activity` is quiet before
the next gate run.

## 6. The four changed assertions — all **JUSTIFIED**, none bumped

| assertion | verdict | how it was checked |
| --- | --- | --- |
| `387` C1 (`3901715…` → `f2a0693…`) | **JUSTIFIED** — the strongest of the four | Re-derived live = `f2a0693be216cfe08eb6cf0283565e7c` over 99 policies; then **inverted**: substituting the pre-change qual text for `professional_profiles_select` alone reproduces `3901715193753db33f980f939c6467de` exactly, which licenses the claim that the other 98 policies are bit-identical. This is the only one of the four that is non-tautologically re-derivable. |
| `401` §18.4 (8 → 10) | **JUSTIFIED** | `authz` holds exactly 10 functions; §18.1's named list was widened in the same commit to 9 (+ `holds_role`, covered by `405` §5.4) = 10, signature-for-signature. Probe re-derived via `has_function_privilege`: **27 probes, 0 holders**. |
| `401` §20.3 (13 → 15) | **JUSTIFIED** | 10 `authz` + 5 named `app` predicates (the `app` half genuinely unchanged). Both new bodies match `affiliat` neither raw nor comment-stripped; 20.2's discrimination control measures 52 against a floor of 20, so the regex is live. |
| `409` §1.1 (3 → 4 pairs; `order by code, site`) | **JUSTIFIED** — a ruling, correctly | The 4th pair is a genuine enforcement literal: the new door's entire body passes `'org.professionals.read'` to the resolver. Adding `, site` is a real determinism fix — with two rows sharing a code, `order by code` alone left the pin flippable on executor order with the subject unchanged. |

⚠ **LOW-3 — two prose defects introduced by this commit, plus one pre-existing.** The numbers moved and
the sentences describing them did not: `401:1406` still says *"the eight `authz.*` functions"* (now ten);
`409:165` still says *"1.1's **three** hits"* (now four). Pre-existing and still unfixed: `401:1207`,
*"18.1's fifteen falses"* (now 27). No gate can see assertion prose.

## 7. Findings — the actionable list

Keyed to the requirement each item violates.

### Blocking (must be resolved before merge)

**MED-1 — `app.current_professional_read_organizations()` declares a `search_path` of one nonexistent
schema, and pgTAP 413 pins it.**
Violates: CLAUDE.md §3 Rule 1 (RLS is the boundary; DEFINER hardening on the authz path) and §8 (quality
bar). Sites: `supabase/migrations/20261003007320_ae4_statement_scoped_authorized_scope_ids.sql:226`;
`supabase/tests/413_ae4_authorized_scope_ids.sql:142`.
Do: emit `set search_path to app, public, pg_catalog` (matching `app.can_read_professional_profile`) or
`set search_path to ''`, in a follow-up migration; update 413 test 4's expected string in the same change
so the fix is not the thing that reds the suite. Re-run `ARM=census` after — a re-emitted DEFINER is a
new gate to the census.

**MAJOR-1 — DC3's specification (`acceptance §13.2:996`) contradicts the DC3 the harness runs
(`scripts/authz-ae4-perf-harness.sql:1199,1203`) and the criterion §14:1108 scores it against; as written
it is unsatisfiable.**
Violates: the acceptance document's own purpose — a control's ruled definition is what makes its PASS
auditable. Do: correct :996 to the implemented criterion (*empty set ⇒ own-org rows MUST NOT move, because
the ELSE arm still grants; over-broad ⇒ foreign rows MUST become > 0*), and correct :1088's attribution so
the "consulted and load-bearing" claim is credited to **DC3b** alone.

**MAJOR-2a — `§14:1097` states the amendment was "ruled and written before the run"; §13.6 records DC2's
half as found by running a pass that produced a control FAIL (1.15× vs ≥5×).**
Violates: §12.6's own standard for distinguishing a correction from a fudge. Do: qualify :1097 to match
§13.6 — the commit message and `PROGRESS.md:20` already carry the correct wording; the acceptance record
is the one that does not. Also reconcile §13.2:1000 (`DC2 | UNCHANGED`) with §13.6:1074.

**MAJOR-2b — the acceptance document's header (:9) still declares "NOT MET" while §14 declares
"ACCEPTANCE MET".** Do: add the status banner and strike the run-5 one, per the file's own convention at
:9/:24/:35. This is the always-read part of the file and it currently contradicts the verdict being
presented for approval.

### Required before the phase-gate record, but the lead/PO may rule on scope

**MAJOR-3 — Phase Gate step 2 (E2E) not run.** Violates CLAUDE.md §6 step 2 ordering. My recommendation:
a **targeted** `SPECS=`-scoped `e2e:prod` run over the professional-profile / participants read paths, not
the full suite — the grant set is measurably unchanged and no TypeScript was touched, but nothing in this
increment has been measured above the SQL layer.

**MAJOR-4 — no authorising party is recorded** for an increment the acceptance document itself said has
"its own approval" (§12.4), and ADR 0182's `**Status:** accepted` carries no attribution while the
immediate precedent (ADR 0181) recorded a dated PO ruling. Do: record the ruling in ADR 0182's header and
in §13.

**MAJOR-5 — the door sweep's read-arm verdict is the one gate figure this review could not confirm.**
Not a claim that it is wrong — a claim that it is unverified by anyone but the implementing session, on
the one gate ruling 3 says must be **re-measured and not inherited**. Do: re-run
`WORK=… CASES="professional_profiles_select" bash supabase/tests/mutation/p0-authz-door-audit.sh` on a
**fresh `supabase db reset --local`** (see §5.4 — it cannot complete with the perf fixture loaded), read
the exit code directly, and confirm `git diff --stat -- docs/reviews/authz-door-audit-findings.md` is
empty afterwards.

**MED-2 — P7 has never been shown able to fail.** §12.6 property 3 requires a new check to be proven able
to return both verdicts; DC3b was (0 → 1), P7 was not. P7 is one of the two controls now bounding the
converted path. Do: report a negative control for P7, or record explicitly that it has none and why.

### Non-blocking (file as follow-ups)

- **MED-3** — 413 §5's subset assertion is exercised by **2 rows × 1 principal** (§5.1). Widen the
  principal set, or add a non-vacuity guard mirroring §2b so a fixture that stops producing granting rows
  reds instead of passing.
- **MED-4** — 413 §2 exercises **2 of the 4 `CASE` branches**; `hospital → organization` has zero granting
  cells and `commission → hospital` is unreachable because every call passes
  `p_resolution_kind = 'organization'` (§5.2). No security consequence — record it as the reason, rather
  than leaving §2's "every cell" to read as coverage of the map.
- **LOW-1** — 413 test 5's caption claims a binding (`auth.uid()` internally) that `pronargs = 0` does not
  measure (§2.2). Covered behaviourally by §3b/§3c; fix the caption or add the assertion.
- **LOW-2** — the migration postflight asserts "BOTH polarities" without measuring that both are present
  (§5.3).
- **LOW-3** — three stale assertion messages: `401:1406`, `409:165` (both introduced here), `401:1207`
  (pre-existing) (§6).
- **LOW-4** — `FUP-PROFESSIONAL-PARTICIPANTS-SELECT-STILL-PER-ROW`'s **title** asserts the policy "is now
  load-bearing as a control", and acceptance §13.4:1018 calls it "DC1's new subject". §13.5 records that
  re-aim as **written, measured and killed**. Both sites carry the stale claim, and both err in the
  tighter-sounding direction, which is how it reads as care. The FUP's body is correct; the title is not.
- **LOW-5** — ADR 0182 carries no `**Supersedes:**` / `**Amends:**` label. No ADR pins
  `professional_profiles_select`'s predicate by name, so no edge is *mechanically* owed and the omission
  matches the ADR 0181 precedent — but **ADR 0178's as-built record of the `professional_profiles` policy
  surface is now stale with no back-pointer**, and the index's `⚠ Changed by` column is the one thing an
  ADR cannot record about itself.
- **LOW-6** — ADR 0182:121 records `402 buffers / 8.3 ms`; §14.1 and the commit message record
  `402 buffers / ~2.8 ms`. Two labels for the same result, quoted side by side elsewhere, unreconciled.
- **LOW-7** — §6.1/§6.2's `⭐ AMENDED` markers sit on unamended condition text (P2 :329, P3 :330) while the
  genuinely re-aimed control (DC2, :345) carries no marker.
- **LOW-8** — the FUP records **three** functions outside `PRED_DOMAIN`; `authz-unswept-backlog.txt`
  records **one**. Both are correct for their own contract (the backlog covers `app`/`public` only), but
  nothing written bridges the two counts.

## 8. What I confirmed is *right*, and should not be lost in the list above

- The design is genuinely sound. Proposing candidates and having the **unmodified runtime resolver confirm
  each one** is the right shape: it makes the candidate map a performance artifact rather than a security
  artifact, and it means a wrong map degrades to slow, never to permissive. I attacked it from the catalog,
  from reachability, and from a 520-cell empirical sweep in the self/hat context, and it held every time.
- `CASE … THEN true ELSE …` rather than `OR` is the right call and the reasoning given for it (a
  disjunction lets the planner order the arms) is correct.
- Narrowing the door to zero arguments with the permission and resolution kind fixed is the security
  property, correctly identified and correctly implemented.
- The three targeted mutation cases were the right response to the deriver's EXCLUDED-BY-NAME list — the
  sweep cannot neutralize a set-valued resolver, and ruling on each excluded name rather than inheriting
  silence is exactly what that list asks for.
- The `authz-unswept-backlog.txt` entry meets its own category-(b) contract: labelled, keystone named,
  keystone mutation-proven, with a landed-edit assertion and a byte-identical restore.
- Both follow-ups are template-complete, and the door-sweep one **self-reports a failed prediction**
  (*"the handoff predicted exit 1, and that prediction was wrong… a non-empty derivation is not evidence
  that the derivation was complete"*). That is unusual and it is the right instinct.

---

**Verdict: ⛔ CHANGES REQUESTED.**

To be explicit about what this verdict is and is not: **I found no privilege escalation, no RLS hole and
no regression.** The over-grant-impossible-by-construction claim is correct and I could not break it. The
blocking items are (a) a `SECURITY DEFINER` function on the authorization path whose `search_path` is a
single nonexistent schema, with a pgTAP assertion that pins the defect and would red on the fix, and
(b) an acceptance record that — in the document being presented for approval — specifies one of its two
live-path controls as something other than what ran, claims an authoring order its own subsection
contradicts, and still says "NOT MET" at the top. Both are cheap to fix. Neither should be carried past
the PO hold.
