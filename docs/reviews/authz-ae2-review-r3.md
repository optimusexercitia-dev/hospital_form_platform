# AE2 — QA review, round 3 (post-drop head)

**Verdict: `APPROVED`**

Head `a49527bb`, branch `authz-ae2-affiliation-tenancy`, range `fa3fe93f..HEAD` (8 commits).
Reviewed 2026-08-28 on a **fresh `supabase db reset --local`** (exit 0). Every schema / RLS / RPC
claim below was re-derived from the **live catalog** (`pg_proc` incl. `prosecdef` + `proacl`,
`pg_policies`, `pg_trigger`, `pg_attribute`), never from migration text and never from graphify.

No blocking finding. The six starred claims were each re-derived independently and all six hold —
two of them by a *stronger* instrument than the one the implementing session used (positive controls
on all three M11 refusals; four mutations against `394 § 1.5` rather than an inspection). The six
findings below are hardening and record-hygiene items, none of which changes the security posture.

⚠ Per the spawn brief I wrote **only** this file. The `PROGRESS.md` **QA Verdicts** row is not
written — it is the lead's to add, or mine on request.

---

## Part 1 — CONFIRMED (re-derived, with the evidence)

### C1. The column is gone, and nothing in the catalog still reaches for it

```
select count(*) from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name='home_organization_id';
→ 0
```

Whole-catalog sweep, comments stripped (`/*…*/` and `--…`), **no `nspname` filter**:

| probe | result |
| --- | --- |
| function bodies naming the column | **(none)** |
| `pg_policies` qual/with_check | (none) |
| views · indexes · constraints | (none) |
| `pg_attribute` (any table) | (none) |
| `auth.users` rows carrying a `home_organization_id` metadata key | **0** |

Live triggers on `public.profiles` are `guard_profile_no_delete_trg` and
`guard_profile_privileged_columns_trg` only.

### C2. ⭐ M11 / ADR 0164's hard pre-condition — DISCHARGED, and I built the orphan myself

I inserted a fresh `auth.users` row (profile created by `handle_new_user`, zero affiliations),
asserted **every precondition in the same transaction**, then probed through the **public wrappers as
`role authenticated`** with real JWT claims. Rolled back.

Preconditions, same transaction, before the role switch:

```
PRE anchorless=true  detector=1  hospadmin=true  orgadmin=true  platform=true
```

(`app.person_is_anchorless(orphan)`, `app.tenant_orphan_profiles()` flags it,
`app.is_hospital_admin_of_for(Central A, e1)`, `app.is_org_admin_of_for(A, b1)`,
`app.is_admin_for(b0)`.)

| # | door | actor | subject | result |
| --- | --- | --- | --- | --- |
| D1 | `public.affiliate_person` | hospital_admin of Central A | **orphan** | **REFUSED `HC0R0`** |
| D1c | `public.affiliate_person` | same actor, same door | dr.john (known to A) | **ACCEPTED** |
| D2 | `public.affiliate_person_to_org` | org_admin of A | **orphan** | **REFUSED `HC0R0`** |
| D2c | `public.affiliate_person_to_org` | same | dr.john | **ACCEPTED** |
| D3 | `public.grant_role(organization, A, org_admin, …)` | org_admin of A | **orphan** | **REFUSED `HC0R0`** |
| D3c | same door | same | dr.john | **ACCEPTED** |
| D4 | `public.recover_orphan_person_to_org` | platform_admin | orphan | **ACCEPTED** — 1 affiliation written |
| D4n | same door | **org_admin** | orphan | **REFUSED `42501`** |

Post-state: `orphan_active_org_affiliations=1`,
`verbs=org_affiliation.created, org_affiliation.recovered` — the trigger's row fact **and** the
door's own act, separately, exactly as ADR 0168 Amdt 2 § 3 requires.

⭐ **The six control cells (D1c/D2c/D3c/D4n) are what the phase record does not have.** Without them
each "REFUSED" is equally consistent with "the actor lacks authority" and with "the anchorless
narrowing fired". With them, three tenant doors are shown to *discriminate* — same actor, same door,
same transaction, opposite verdict — and the recovery door is shown to be genuinely platform-only
rather than merely reachable.

⚠ One instrument error of my own, recorded because it is this repo's dominant family: my **first**
demotion probe reported `ACCEPTED` on a case that must refuse. The cause was that `app.is_admin()`
was `false` under my claims, so RLS matched **zero rows** and no trigger fired — a refusal reported
as an acceptance. Re-run with `get diagnostics row_count` and a visible-rows precondition.

### C3. ⭐ The creation doors are `service_role`-ONLY — from `proacl`, for `authenticated` AND `anon`

```
public.affiliate_new_person_for(…)        acl={postgres=X/postgres, service_role=X/postgres}
public.affiliate_new_person_to_org_for(…) acl={postgres=X/postgres, service_role=X/postgres}
public.recover_orphan_person_to_org(…)    acl={postgres=X/postgres, authenticated=X/postgres}
public.affiliate_person(…)                acl={postgres, service_role, authenticated}
public.affiliate_person_to_org(…)         acl={postgres, service_role, authenticated}
public.grant_role(…)                      acl={postgres, service_role, authenticated}
public.grant_role_for(…)                  acl={postgres, service_role}
app.* impls + person_is_anchorless + person_known_to_org   acl={postgres=X/postgres}   (owner-only)
```

`proacl` is **non-NULL on every one**, so there is no implicit PUBLIC grant (this repo's recorded
fail-open — "a NULL `proacl` includes PUBLIC" — does not apply here). `anon` appears nowhere. All 20
functions in the family are `prosecdef=t`, owned by `postgres`, with a pinned
`search_path=app, public, pg_catalog`.

Independently corroborated behaviourally: calling `app.person_is_anchorless` as `role authenticated`
raises `permission denied for function person_is_anchorless` — increment D's decisive fact
(ADR 0159's prohibited shape is *impossible* here, not merely wrong), measured rather than read.

**The predicates, from the catalog, comments stripped:**

- ordinary (`affiliate_person_impl`, `affiliate_person_to_org_impl`) → `person_known_to_org` **alone**
- creation (`affiliate_new_person_impl`, `affiliate_new_person_to_org_impl`) →
  `person_is_anchorless OR person_known_to_org`, plus its own audit verb
  (`affiliation.created_on_registration` / `org_affiliation.created_on_registration`)
- recovery → `is_admin_for` + org-existence (`HC0R5`) + **requires** `person_is_anchorless`, verb
  `org_affiliation.recovered`
- `ensure_provisioned_org_affiliation` → `person_known_to_org OR (p_allow_anchorless AND person_is_anchorless)`

Ordinary ⊂ creation, exactly as ADR 0168 Amdt 2 § 1 declares. The widening was **moved**, not deleted.

### C4. ⭐ Increment D's backstop survived increment F's rewrite of its host — behaviourally

`public.guard_profile_privileged_columns` is `prosecdef=t`, `search_path=public, pg_catalog`, owner
`postgres`, and its body still carries the ADR 0166 arm. Textual survival is not the claim I checked;
this is:

Preconditions asserted **before** the role switch: orphan-admin `anchorless=true`, control-admin
`anchorless=false`, both `old.is_admin=true`. Then as `role authenticated` with a genuine
platform-admin JWT: `app.is_admin()=true` and `rows_visible=2` (so RLS is not silently matching zero).

| case | result |
| --- | --- |
| **CONTROL** — demote an **anchored** platform admin | **NO RAISE, rows=1** |
| **ARM** — demote an **anchorless** platform admin | **RAISED `HC0RB`** |
| **SELF-DEMOTION** — the vendor demoting itself (anchorless) | **RAISED `HC0RB`** |

The control is the half that matters: the backstop *discriminates* on the anchorless axis rather than
refusing all demotions. Both paths the increment-D record says it reproduced are closed.

### C5. ⭐ The seed restructure is equivalent, and its self-check is genuinely falsifiable

Measured on the fresh reset: **36 profiles = 36 `auth.users`**, **35 organization affiliations**
(all active), **exactly 1 unanchored profile — `platform@test.local`, `is_admin=true`** (the vendor).
`app.tenant_orphan_profiles()` returns **zero rows**. Per-org: Rede A 29 · **Rede B 5** · Rede C 1 —
Rede B's 5 is the count the seed's own header names as a contract with ~900 tests.

Equivalence to the pre-drop derivation is **structural, not just numeric**: the old predicate was
`home_organization_id is not null and not pr.is_admin` over `profiles`; the new one is
`(u->>'org') is not null and not (u->>'admin')` over the persona JSON. `profiles.is_admin` has exactly
**one** writer in the seed (`seed.sql:335`, for persona `b0`, the only persona carrying `'admin', true`),
so the two filters select the same set — and the new form is *stronger*, because it no longer depends
on the `is_admin` patch happening before the affiliation insert.

The "⭐ DERIVED, NOT HAND-LISTED" property the block's header protects is preserved (temp-table
carrier `seed_persona_org`, materialised from the same `u ->> 'org'`), and the two guard blocks are
well built — in particular the second is sourced from `profiles`, **not** from the carrier, so it is
falsifiable in both directions rather than restating the insert above it.

### C6. ⭐ The six re-cut suites did not lose coverage that exists nowhere else — checked by SUBJECT

Verified by identifier, not by description text, across all ~250 files in `supabase/tests/`:

| subject | still asserted? | where |
| --- | --- | --- |
| `app.can_administer_person_via_affiliation` | **yes** — existence, `prosecdef`, STABLE, pinned `search_path`, both ACL polarities, 3 policy-calls-it cells, 9 behavioural | `390 §A7–A12, §B2/B4/B6, §D`; `392 §1.2, §2.2, §7.2` |
| `person_audit_organization` | **yes** — DEFINER/STABLE/pinned/owner-only, plus the only estate-wide cells attributing a person-door audit row to the **located** org | `394 §1.4, §7.1, §7.4, §7.5, §10.1, §10.2` |
| ADR 0163 retention bounds on `app.person_authority_orgs` | **yes** — all four bounds (void, ties, void-ordering, honest empty) element-wise **and** as one string | `390 §C1–C8`; `394 §0.6, §3.4, §6.1, §6.2` |
| Rule 13 LOCATE-vs-GRANT | **yes** — exactly 3 cells, and **`394 §9.2` is on the WRITE predicate** `app.can_administer_person_for` | `390 §D10`, `392 §4.3`, `394 §9.2` |

⭐ **Two of the three "declared coverage losses" were in fact RESTORED, not lost** — the phase record
is out of date in the conservative direction:

- `385 § 4.3` — restored over the new substrate as a comment-stripped `prosrc` assertion that
  `app.finalize_invited_person_impl` does **not** name `organization_affiliations` (`385:385-389`).
- `180` vendor existence — restored at `180:110-119` with a `MISSING` sentinel and an
  `|affiliations=0` half, so it fails closed in **both** directions.

### C7. ⭐ `394 § 1.5`'s domain is the whole catalog, and I proved the cell can fail

The cell carries **no `nspname` filter** (confirmed by reading it) and anchors its empty aggregate
with `column_present=false` measured from `pg_attribute` in the same string. I ran four mutations
against the cell's exact expression, each rolled back:

| mutation | cell output | verdict |
| --- | --- | --- |
| baseline | `column_present=false\|(none)` | green |
| function in a **novel schema** naming the column | `…\|qa_zzz.qa_mutant` | **REDS** |
| function naming it **only in a `--` comment** | `…\|(none)` | correctly **does not** fire |
| **`alter table profiles add column home_organization_id uuid`** | `column_present=true\|…` | **REDS** |

Both halves can fail; the comment-stripping does not false-positive. ⚠ Note the domain also covers
`pg_temp` — my own probe helper appeared in the enumeration. Harmless today, but a future suite whose
temp helper mentions the string would red this cell spuriously.

### C8. Security posture — nothing became more permissive

Across all five migrations in the range: **zero** `create/alter/drop policy` statements (verified per
file). Every `grant`/`revoke` is enumerated:

- `grant execute` → `public.affiliate_new_person_for`, `public.affiliate_new_person_to_org_for`
  (**`service_role`**, confirmed in `proacl`)
- `grant execute` → `public.recover_orphan_person_to_org` (**`authenticated`**, gated by
  `app.is_admin_for`, and proven platform-only by probe D4n)
- everything else is a `revoke`

So the **only** new `authenticated`-reachable surface is one platform-admin-gated door, while three
existing `authenticated` doors were **narrowed**. Net direction: strictly tighter.

**ADR 0167 Amdt 2 landed, catalog-verified:**

```
app.grant_role_impl   is_admin_for sites = 2   (organization/org_admin bootstrap; hospital tier)
app.revoke_role_impl  is_admin_for sites = 1
both impls' commission `staff` sub-arm = is_staff_admin_of_for OR is_tenancy_admin_of_for  (identical)
```

Grant was aligned **down** to revoke; revoke did not move up. The `staff` and `staff_admin` sub-arms
carry no `is_admin_for`.

**Rule 12 / PHI:** no function in this door family (all `affiliate_*`, `recover_orphan*`,
`person_is_anchorless`, `person_known_to_org`, `ensure_provisioned_org_affiliation`, `grant_role*`,
`guard_profile_privileged_columns`, `handle_new_user`) names `event_patient`, `referral_patient`,
`patient_identifiers`, `patient_participants` or `case_patient`. Unchanged, as claimed.

**Service-role key:** the only real reference is `src/lib/supabase/admin.ts:25`, in a module whose
line 1 is `import 'server-only'`. All 30 importers are server actions / route handlers / tests; none
carries `"use client"`. `lint:client-server-imports` gates it.

### C9. Gates — re-run by me, exit codes captured directly (redirects, never pipes)

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | Reset local database | **0** |
| `npm run test:db` | **`Files=248, Tests=8262, Result: PASS`** · `not ok` count = **0** | **0** |
| `npm run lint` | 11/11 (registry `45 == 45`; mojibake self-test passes, 3020 files clean) | **0** |
| `npm run typecheck` | 0 errors | **0** |
| `npx vitest run` | **147 files / 2007 tests** passed | **0** |
| `ARM=census` | **569 gates / 605 verdicts** · INVARIANT HOLDS | **0** |
| `ARM=hat` | 3 findings, all reasoned-allowlisted · INVARIANT HOLDS | **0** |
| `ARM=floor` | 72 never-called doors, all on the floor allowlist · INVARIANT HOLDS | **0** |
| `FROMFINDINGS=1 ARM=wrapper` | BLIND set 41, all allowlisted · INVARIANT HOLDS | **0** |
| `scripts/door-sweep-cases.sh fa3fe93f` | `CASES=[person_is_anchorless person_known_to_org]` | **0** |
| diff-scoped sweep over those two | `ARM-DOMAIN predicate=2/116 policy=0/226` · **SWEPT 2 · COVERED 2 · BLIND 0 · ERROR 0 — CLEAN** | **0** |

Committed findings baseline **verified unchanged** by md5 before *and* after the sweep
(`e43e48e00b7b568f6d7e8378dd678be8` both times) and by an empty `git diff --stat`. The subset report
went to `$WORK` as ADR 0153 requires.

`test:db` (248/8262) and `vitest` (147/2007) reproduce the recorded numbers **exactly**, as does
`ARM=census`'s 569/605.

**Deriver EXCLUDED-BY-NAME list, ruled:** the range-wide list is **15** names, wider than any single
increment's. All 15 are accounted for across the increments' own rulings — 8 (increment A) + 4
(increment C: `grant_role`, `grant_role_for`, `grant_role_impl`, `revoke_role_impl`) +
`ensure_provisioned_org_affiliation` (increment B, covered by `399`) + `guard_profile_privileged_columns`
and `handle_new_user` (increment F's zero-cases ruling: both return `trigger`, structurally outside
the boolean-neutralization domain). Nothing in the list is unruled.

### C10. `recover_orphan_person_to_org` is genuinely exercised, not allowlisted into blindness

It is **not** on `authz-neverclled-door-allowlist.txt` and is referenced **14 times** by `398`. This
matters because this repo has a recorded failure where allowlisting a door as "E2E-only" is *what
made it blind*; that did not happen here.

---

## Part 2 — FINDINGS (none blocking)

### F1 · MEDIUM · `397 §§ 2/3`'s ten DENY cells assert SQLSTATE only, in the one suite that documents having been bitten by exactly that

`397:448-476` and `397:483-530` compare `split_part(verdict, '|', 1)` to `'42501'`, discarding the
message the probe deliberately captured. Catalog-measured:

```
app.grant_role_impl  →  12 raise sites with errcode '42501',  7 distinct messages
                        (6 of the 12 share the generic 'sem permissão')
```

The file's own `§ 5.2` (`397:591-598`) records that this exact cell shape *already failed once*:
*"this cell kept its 42501 while its subject silently changed from 'site (b) stopped it' to 'the arm
stopped it'."* The repair (full `sqlstate|message` comparison) was applied to `§ 5` and `§ 8.1` and
**not** to `§§ 2/3`.

⚠ **The obvious fix is only partial, and that should be said before it is applied.** Adding the
message narrows the ambiguity from 12 sites to **6** (all sharing `sem permissão`), not to one.
`§ 5.2`'s repair works only because actors 7/8 reach **site (b)**, whose message is distinctive.

**Why this is not blocking.** `§ 0.1–§ 0.4` are strong structural pins — an exact `is_admin_for`
occurrence count on *both* impls plus named-site regexes anchored on structural context (`else`,
`v_existing_role = 'staff_admin'`) — and I re-derived their subject from the catalog (2 sites in
grant, 1 in revoke, sub-arms identical). A mutation that deletes an arm, restores one, or moves
revoke up **reds `§ 0.3`/`§ 0.4`**. `§ 1.2`'s eight-actor authority grid bounds the interpretation
further. So the risk is latent drift, not a live hole.

**Recommended:** switch `§§ 2/3` to the full verdict *and* record that the residual ambiguity is 6
generic sites, so the next reader does not read the fix as complete.

### F2 · LOW–MEDIUM · `393 § 3.12` and `§ 5.9` are all-zero absence claims with no positive control anywhere

```sql
-- 393:878-883                     expected: 'W3=0 W5=0 W6=0 W7=0'
-- 393:1073-1078                   expected: 'H1=0/0 H4=0/0 H6=0/0'
   from ae24_after_ordinary a join ae24_split s on s.label = a.label where s.tier = …
```

`ae24_after_ordinary` (created at `393:714`) is consumed by **exactly these two cells and nowhere
else** (verified: 3 occurrences in the file — the `create`, and these two). Every value in both
expected strings is `0`. If the snapshot's counting subqueries had the wrong org / hospital literal,
or a `voided_at` polarity slip, **every** label reads 0 — including W1/W2/W8/H2, where the ordinary
door demonstrably *did* write — and both cells stay green while measuring nothing.

These are the cells whose whole job is the **absence** half of ADR 0168's split, and the file's own
`§ 3.12` header cites QA finding B3: *"the presence side got asserted and the absence side got
assumed."*

**Recommended (two tokens, and the data already exists in the table):** add one admitted label to
each expected string — `W1=1` to `§ 3.12`, `H2=1/1` to `§ 5.9` — turning an unanchored absence into a
differential.

### F3 · LOW · `400 § 4.2` asserts `23514` with `errmsg = null`, and that code has two arms

```sql
-- 400:367-372
select throws_ok($$update public.profiles set is_admin = true where id = auth.uid()$$,
                 '23514', null, '4.2 …');
```

Catalog: `public.guard_profile_privileged_columns` raises `check_violation` from **2** distinct
sites. `§ 4.2` cannot tell them apart, so deleting the non-admin-actor arm leaves it green (the
identity-columns arm refuses instead). `§ 2.3`, in the same file, states the problem and uses the
message; `§ 4.2` does not.

⭐ Note the contrast, in the file's favour: `HC0RB` has exactly **1** raise site, so `§ 2.6`'s
code-only assertion is currently unambiguous — a distinction worth keeping when this is fixed.

### F4 · LOW · `lives_ok` accept cells without the write-through twin their own files mandate

`393 § 2.2 / 2.3 / 2.5 / 2.8`, `397 § 7.2 / 7.3`, `399 § 4.1`. Each file states the doctrine
explicitly — `399:49` *"every ACCEPT is followed by a WRITE-THROUGH cell"*; `400 § 2.2` *"a lives_ok
on an update that matched zero rows would report the same green"* — and then departs from it. `393
§ 2.5` is that file's **declared keystone**.

**Bounded, and this is why it is LOW rather than higher.** I checked the concrete risk for `393`:
every affiliation-id literal used in `§ 2` (lines 546, 557, 566, 575, 596, 619, 626) matches an id
inserted by the fixture block at lines 459–469. So the "literals drifted from the fixture" failure is
**not currently realised** — it is a future-drift exposure that would go silent, not a live gap.
`397 § 7.1` is chain-anchored (7.2 uses its output as actor); `7.2`/`7.3` and `399 § 4.1` are not.

### F5 · LOW · `docs/backend-state.md`'s service-role registry carries two rows whose prose describes the dropped column as live logic

- `:693` (`resolveOrInviteUser`) describes the guard as
  `if (existing.home_organization_id !== homeOrganizationId) throw` and claims a **"null-anchor
  refuse"** test arm. That code no longer exists; the real gate is `existing.is_admin` plus
  `listNonVoidedOrgAffiliationsFor` (`src/lib/members/invite.ts:114-138`), and an arm keyed on a
  null anchor cannot exist without the column.
- `:599` (`registerUser` → `finalize_invited_person_for`) still says
  *"`home_organization_id` is deliberately NOT in the column list: `handle_new_user` seeds it, and
  writing it would fire the deferred `profiles_tenant_has_org_trg`"*. **Both halves are dead** — and
  `src/lib/users/actions.ts:886-893` corrects exactly this claim in the source. The registry kept the
  version the code repudiated.

`lint:service-role-registry` compares identity **keys** as a multiset only, so neither drift can red
it. `docs/backend-state.md` is the durable backend-surface map CLAUDE.md § 7 tells every session to
reference instead of re-deriving — a false sentence there is read and believed by design.

### F6 · LOW · `392`'s filename — deferral justified, but the record for it will be rotated away

**Ruling: the deferral is correct.** I verified the stated blocker rather than accepting it:
`docs/reviews/authz-door-audit-findings.md` references `392_ae23a_widening_differential.sql` **4
times**, keyed on the full filename, so a rename genuinely orphans name-keyed verdicts. Doing it
inside a 50-file integration window would have been wrong.

**But the record is in the wrong place.** The note lives only in `docs/progress/authz-ae2.md`, which
rotates to the archive at the Record step, and there is **no follow-up line** for it (grepped
`docs/progress/follow-ups.md`: none). A filename that is a false assertion, with the only note about
it about to be archived, is precisely this repo's "records that go stale silently" family.

**Recommended:** a one-line FUP naming both the rename *and* the four findings-file references that
must move with it.

### F7 · INFORMATIONAL · two items I checked and am NOT raising

- **`/tmp/e2e-prod-gate/` stale-logdir hazard — already tracked; nothing owed by this increment.**
  Confirmed live (`scripts/e2e-prod-gate.sh:70-71` sets `GATE_LOGDIR` and `mkdir -p`s it with no
  clean; the directory currently holds **79** files — 2 from 2026-08-26, 4 from 08-27, 73 from
  08-28, so a `batch-*.log` glob does mix runs). But `docs/progress/follow-ups.md` already registers
  it (~:4871–4926) **with the fix named** (run-scope `GATE_LOGDIR`) and already records that
  run-scoping closes **both** directions — destruction *and* survival. The session's observation is a
  re-confirmation, not a new item.
- **`public.recover_orphan_person_to_org` has ZERO TypeScript call sites** (declared at
  `src/lib/types/database.ts:14417`, called nowhere). It is exercised by `398` and is not
  floor-allowlisted, so it is not blind — but the capability ADR 0168 created *specifically to avoid
  stranding an orphan* is today reachable only by a platform admin issuing a direct PostgREST call.
  That does not violate the ADR (which requires no UI) and it does not weaken the M11 discharge,
  which is a claim about the door. Recorded so it is a known shape rather than an assumption.

---

## Part 3 — UNPROVEN (stated rather than accepted or rejected)

1. **`npm run e2e:prod` (1248 passed / 0 failed / 4 flaky / 11 skipped, `GATE_EXIT=0`).** Not re-run,
   per the brief. I audited the **accounting** instead and it reconciles: `TOTAL_SEEN` excludes
   skipped by construction, and `1263 − 11 skipped = 1252 = 1248 + 4`. ✓ The four `did not run` lines
   being in superseded first attempts is **not independently verified** — the stale-logdir hazard in
   F7 is exactly what makes that half hard to re-derive after the fact, and the session says as much.
2. **That the creation doors' predicate is byte-identical to gen-1's.** Semantically it is the
   classic "known here, or known nowhere", and ordinary ⊂ creation is catalog-proven — but the
   pre-change function bodies are not recoverable from the live catalog, and migration text is stale
   by design. I did not rebuild a pre-drop database to compare.
3. **The four arms' allowlists.** I verified all four exit 0 and that the new doors are not hiding
   inside a floor allowlist. I did **not** re-audit the 41 wrapper-BLIND entries, the 72
   never-called entries, or the 3 hat findings on their merits — those are periodic-audit scope,
   not phase scope.
4. **The `ARM=census` domain exclusions.** `census` reports 605 verdicts over 569 gates and names its
   own out-of-domain classes (`prosecdef` scalar non-bool command doors — 407 reachable,
   `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`). `app.ensure_provisioned_org_affiliation` is in that excluded
   class, exactly as increment B's honesty note says. Absence of a verdict there is absence of
   coverage, and `399` is the compensating control — I confirmed `399` exists and passes, not that
   it is sufficient.

---

## Verdict

**`APPROVED`.**

Every blocking pre-condition is discharged and re-derived: the column is gone with no catalog
residue (C1); all three tenant-reachable doors refuse an anchorless person while the platform
recovery door works, each shown to *discriminate* rather than merely refuse (C2); the creation
doors' widening is bounded by a `service_role`-only ACL and its own audit verb (C3); the demotion
backstop survived its host's rewrite and is behaviourally live with a working positive control (C4);
the seed is equivalent and self-checking (C5); no named coverage was lost and two declared losses
were in fact restored (C6); the inverted cell has a whole-catalog domain and is proven able to fail
(C7); nothing became more permissive (C8); and all eleven gates reproduce at exit 0 with the recorded
numbers exact (C9).

F1–F4 are test-robustness hardening on suites that are currently measuring the right things; F5–F6
are record hygiene. None is a security or requirements defect, and none should hold the phase.

⚠ **F1 and F2 should be fixed before the next change to `grant_role_impl` or to `393`'s split
cells** — not because they are wrong today, but because both are the drift-goes-silent shape, and in
`397`'s case the file has already been bitten by it once.
