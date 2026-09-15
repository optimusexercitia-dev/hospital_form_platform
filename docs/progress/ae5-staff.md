# AE5-STAFF — progress record

> Hub: [ae5-staff.md](../features/ae5-staff.md) · branch `ae5-staff`, cut from `main @ a02487bc` ·
> AE5 increment 1 of [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § Phase AE5 —
> the `staff` role substituted into the authz catalog through the AE4 per-role template. ADR 0207 D6
> rules `staff_admin` the already-authoritative BASELINE and item 1 `staff`; ⛔ ADR 0207 D5 step 6
> (`member_can`, the capability plane) is item 6, NOT this unit.

## Session log

### 2026-09-13 — unit opened; peers cleared; register hygiene; stack up (lead)

**Ordering.** AE5 is post-pilot by ruling (ADR 0155 G1 / ADR 0162: *"AE0–AE4 gate the pilot. AE5 is
post-pilot."*). The PO instructed this session on 2026-09-13 to *"initiate implementation of AE5"*;
that instruction is the ordering event, recorded here so the ruling and the start are both on file.
Every pre-AE5 unit is `complete` in `docs/features/INDEX.md` at open (Batches 0–10, the two successor
ADRs 0207/0208, `AE5-ROLE-CATALOG-COMPAT`, `AE4-D-SHAPE-ASSERTION`, the three `DEFINER-*` units,
`VITEST-ROLE-SET-PIN`); `docs/plans/pre-ae5-remediation.md` § 6's last dated note (2026-09-13) names
nothing still owed before increment 1 beyond `AE4-D-SHAPE-ASSERTION`, itself `complete` in the index.

**Tree at open.** `main @ a02487bc` (*chore(graphify): refresh after the VITEST-ROLE-SET-PIN merge*),
`git status --short` empty, one worktree (the primary), no `*ae5*` branch local or remote,
`origin/main..main` = 162 commits (⛔ not pushed — the standing instruction; re-measure, never quote).
No `in_progress` hub before this one (34 hubs: 0 in progress · 3 gated · 2 planned · 29 complete).
`ListAgents`: 52 peer sessions listed, **all offline** — no shared-HEAD hazard at open
(`docs/worktrees.md` §1). Docker Desktop was **not running** at open; started by this session,
`supabase start` exit 0, then a fresh `supabase db reset --local` (its exit code is in the next entry).

**Review queue (per-clone, gitignored).** 8,488 B at open; two entries after the 2026-09-13
`AE4-D-SHAPE-ASSERTION` marker, both triaged, neither a doc problem, no CLAUDE.md edit:
- `d3fb6ddd` (`claude-md` + `staleness`, 15:07Z) — a subagent spawn prompt quoting CLAUDE.md §6–§7 /
  ADR 0186's hub-before-branch convention (hook finding (i)), and a review closing a MAJOR by a dated
  `⚠ Superseded` marker under a stale sentence (hook finding (iii): the register doing its job).
- `ea9ff6ff` (`claude-md`, 15:45Z) — the `VITEST-ROLE-SET-PIN` unit's own opening prompt citing the
  same convention (hook finding (i)).
Marker appended, entries removed; the file is 7,961 B after.

**Register hygiene found at open — one resolved entry never moved.**
`FUP-AE5-OPENING-ADR-0175-D3-FORWARD-PROMISE-UNDISCHARGED` sat `Status: open` in
`docs/followups/follow-ups-open.md:1884-1891` although its `Closes when` first arm — *"discharged (the
enumeration exists, per unit `AE5-MATRIX-ARM3-CELLS`)"* — was met on 2026-09-11: ADR 0175 carries
`✅ **DELIVERED 2026-09-11 …**` under D3 (`:92`) and `✅ **Delivered 2026-09-11**` under § Consequences
(`:161`), header `**Amended:** 2026-09-11 — dated markers only` (`:18`), commit `29422327`. Moved to
the archive tail in the standard closure shape (heading `— ✅ RESOLVED 2026-09-13`, closure note naming
the lag, the entry block verbatim with `Closes when` at column 0); body `cmp`-identical at the
destination before the source lines were cut; gate 7 exit **0**, gate 13 exit **0** (227 open ·
175 archived after the move). ⚠ The scout that found it also flagged that none of the five `ae5-*` /
`admin-arm-is-active` hubs carries a `## Current state` block — correct: all five are `complete`, and
`complete` FORBIDS the block (gate 13 HUBS arm); the live projection is
`docs/backend-state/authorization-and-audit.md` § Current state.

**Two more open follow-ups name AE5 and are NOT this unit's.**
`FUP-AE5-OPENING-ADR-CLASSIFICATION-COLUMNS-OWE-A-NAMED-CONSUMER` is sequenced **after** increment 1
by ADR 0203 D3 condition 2 (⛔ increment 1 may not cite D3 as licensing a read of the columns, 0203
`:332-337`); `FUP-AE5-OPENING-ADR-0176-NO-READER-LIST-STALE-AND-UNGATED` is a docs correction on ADR
0176, unrelated to the `staff` cutover. `FUP-GRANT-PLANE-CONVENTION-BUILD-AFTER-AE5` is parked until
AE5-complete (ADR 0205 D12).

**Sources read verbatim for the scope (not paraphrased):** plan § Phase AE5 `:1150-1290` — the
Proposed order (`:1198-1214`, item 1 `staff`), the ⚠⚠ `AE5-MATRIX-ARM3-CELLS` block (`:1216-1234`:
`case_reach` axis with mandatory `unreachable`, `arm3_divergence` label + 14th
`expected_legacy_granted` column, arms `arm9`/`arm10`, 1728 cells), the per-role checklist
(`:1248-1256`) and the five corrections (`:1258-1279`); ADR 0207 D5 (`:165-203`) + D6 (`:205-224`);
ADR 0201 `:421-426` (the three-deep template clause: ADR 0193 D5 · ADR 0200 · 0201 D3); ADR 0203
`:332-337`; ADR 0208 D3/D4. ADR numbering, if one is needed: highest on any live ref is **0210**
(measured across all local + remote refs) → next is 0211, re-measured at the moment of reserving.

### 2026-09-13 — T1 · T2 · R-1/R-2 re-measured · T3 plan (backend)

**Stack and transport.** Local, the fresh reset the lead recorded; no `db reset` run by this
session. Every SQL claim below and in both design docs is from the LIVE catalog via
`docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`
(no local `psql` binary). ⚠ `ON_ERROR_STOP=1` is load-bearing and was added after the first sweep:
without it `psql` returns **0** on a failed statement, so an errored sweep reads as an empty result
set rather than as a red — hit once, on a `text || "char"` cast error that reported `EXIT=0`.
⛔ No migration file was read for any schema/RLS/RPC claim (ADR 0078; LEARN-057). Behavioural probes
ran inside transactions that were **rolled back**, and the rollback was verified afterwards by
re-reading `authz.roles.state` (`legacy`) and the touched `memberships` rows.

**T1 delivered** — `docs/design/authz-ae5-staff-permission-matrix.md`, ⛔ PROVISIONAL: **22 lines,
20 held rows, 18 new codes, 2 shared with `staff_admin`.** Structure mirrors the AE4.3 matrix
(§ 0 method · planes 1–5 · § 5.0 the R/D/T taxonomy · § 5.1 scope exclusions · § 5.2 the matrix ·
§ 6 deny-class shape · § 6A the asymmetry statement · § 8 findings · § 9 reconciliation ·
§ 10 the reversibility check · § 11 For PO approval). Per arm the SUBJECT and the HAT requirement
are declared (ADR 0200 · ADR 0201 D3); per row the site kind and `prosecdef` (ADR 0193 D5 ·
LEARN-074).

**T2 delivered** — `docs/design/authz-ae5-staff-deny-class-effects.md`, ⛔ PROVISIONAL: the 9-row
`403` shape in `authz-matrix-axes.json` `denyClasses` coordinates, every effect MEASURED rather
than inherited from AE4.5.

**The finding that shapes the whole increment.** The plan's method — match the name UNANCHORED
ONCE, then classify — was applied literally and **found nothing**: `select proname … where
prosrc ~ '''staff'''` over `app`/`public`/`authz` returns **3** functions (`app.grant_role_impl`,
`app.revoke_role_impl`, `public.appoint_administrativo`), all *administering* the role; the same
classifier over `pg_policies` returns **0**. `staff`'s entire surface is reached through the
role-SET predicate `app.is_member_of(_for)` → `app.has_role_any('commission', …)`. AE4.3 § 0 warned
that a name-keyed derivation misses reads systematically; for `staff` it misses **everything** and
would have reported the role unenforced. The derivation is therefore predicate-keyed, with a
top-down write-surface pass (§ 9.2) as the inverse control.

**Live populations, with the query that produced each** (all partitions sum, no residue bucket):
policies calling `is_member_of` **40** = 39 SELECT + 1 INSERT, `is_member_of_for` in **0** policies;
functions **42** = 9 bare + 32 `_for` + 1 both, **40 of 42 `prosecdef = t`**; `is_member_of_for`
**call sites 39** in **33** functions, of which **4 sites pass `auth.uid()`** and are caller-keyed
*at the site* despite the `_for` form (4 + 30 − 1 = 33). `app._audit_access_authorized` uses both
forms and is **not** an ADR 0201 D3 violation — different `case` branches, both about the caller.

⭐ **`staff`'s entire role-derived policy surface is 39 reads and ONE write** —
`responses.responses_insert_own`, `with_check = created_by = auth.uid() AND
app.is_member_of(commission_id)`. Confirmed independently by the top-down pass: of **107** write
policies granted to `authenticated`, **50** carry no admin predicate, and exactly **two** are
reachable by the role (`responses_insert_own`; `meeting_signatures_insert` via
`app.can_sign_meeting`). The top-down pass added one row the bottom-up pass had already found and
none it had missed.

**R-1 — ✅ CONFIRMED on the catalog, with three additions.** `app.is_member_of(p_commission_id)` =
`app.is_active(auth.uid()) and app.has_role_any('commission', p_commission_id, auth.uid())`;
`is_member_of_for` the same on `p_user_id`; neither names a role, and no `is_staff_of*` exists.
Added: (i) the complete commission-scope predicate population is **4**, derived from
`has_role_any`'s 7 callers — `is_member_of` (caller-keyed) · `is_member_of_for` (`p_user_id`) ·
`app.is_entitled_document_approver` (`p_user`, **hospital** scope) · `public.appoint_hospital_dpo`
(`p_user_id`); (ii) `authz.holds_role` has exactly **two** live dependents, `app.is_staff_admin_of`
and `app.is_staff_admin_of_for`, each a one-line delegation — the shape the cutover mirrors;
(iii) ⛔ **there is no `candidate_holds_role`** (the `authz` schema holds 10 functions and none is a
candidate twin), and `holds_role` requires `r.state = 'authoritative'`, so the wrapper cutover
**cannot be pre-flighted under `test_validation`** the way the permission differential can — its
before/after is provable only inside the cutover migration's own snapshot/assert block.

**R-2 — ⛔ REFUTED AS STATED; the surviving divergence is structurally UNREACHABLE.** The record's
premise *"`is_member_of` carries no `active_role` term"* is false on the catalog: the term is one
delegation down, in `app.has_role_any` — `and (p_user_id is distinct from auth.uid() or m.role is
not distinct from app.active_role())`. Measured behaviourally as `staff4.ccih@test.local`:
SELF with `active_role='staff'` → **true**; SELF with `'staff_admin'` → **false**; SELF with **no**
claim → **false**; THIRD-PARTY → **true** under both wrong hats. ⇒ the hat gate already fires for
`staff` and the § 6A asymmetry already holds. What actually differs is the *grain* of the conjunct
(`has_role_any` binds the hat to any row in the scope; `holds_role` binds it to the code asked
about), which diverges on exactly one state — a caller holding **both** commission roles in the
**same** commission — and that state is UNCONSTRUCTIBLE: `memberships_one_commission_role_uq`
is `UNIQUE (principal_id, commission_id) WHERE commission_id IS NOT NULL`, and the attempted insert
raises **23505**. ⇒ the matrix proposes **(a)** for R-2 rather than the planner's (b), ⛔ conditional
on that index and on `memberships_scope_shape`'s two-value commission tier being **asserted in the
cutover's pgTAP**, not assumed. ⚠ Live re-key population: **82 distinct catalog objects**
(40 policies + 42 functions), against the record's provisional *"83 + 123"* — those are
`supabase/migrations` **file-text** counts, i.e. history. Both readings recorded; they answer
different questions.

**Two PA-F8 divergences found, both proposals.** **PA-F8-STAFF-1** — measured end to end in a
rolled-back transaction: a `staff` creates a draft, their membership row is deleted
(`is_member_of` → false), and they still **see**, **edit** and **`submit_response`** it, producing
a submitted, immutable, counted response authored by a non-member. The whole response lifecycle
after creation is ownership-keyed (`created_by = auth.uid()`); `responses_insert_own` is the only
membership gate in the family, and `public.submit_response` is **INVOKER with no gate of its own**.
Proposed **(b)**, encoded in `424`'s `expected_legacy_granted`, ⛔ never in `expected_granted`.
**PA-F8-STAFF-2** — the R-2 hat grain, proposed **(a)** as above.

**Other findings, all in the matrix § 8 with their measurements.** `app.can_reach_case_on_member_surface`
is a designated authority with **zero production callers** (0 functions, 0 policies; its last
conjunct was dropped by `20260805000000…:16`; live callers are pgTAP 231/233/249 only) while its own
header comment instructs readers to use it and warns against a predicate retired in `20260814000000`
— a stale instruction beside a dead authority, and it is row 9's natural re-key target, so T7 must
**wire** it, not merely re-key it · a plain `staff` **cannot SELECT `public.cases`** (`cases_select`
= `app.can_read_case` = `read_case_content`; S5 confers `read_case_deliberation` only), verified on
three uncontaminated personas · **6 of 9** seeded CCIH `staff` personas carry a non-role case reach
(phase assignment, narrative assignment, a case grant, the full `administrativo` bundle, the PQS
arm), and `staff1.ccih@test.local` — the name a reader reaches for first — is one of them ·
`app.is_member_of` carries an unreachable **PUBLIC EXECUTE** ACL its own `_for` twin does not, a
second member of the class the seam records for `app.is_admin()` (filed, ⛔ no revoke here) ·
`is_member_of`, `is_member_of_for` and `has_role_any` carry **no header comment at all**, and
⚠ ADR 0201 `:425-426` says `app.can_manage_professional`'s live comment states its keying *and* its
template obligation — measured, it states the keying and carries **no** template-obligation clause,
nor does `can_read_professional_profile`'s; both readings recorded, and the consequence is that the
three-deep clause has no carrier on the predicates this increment cuts over.

⚠ **A near-miss recorded rather than quietly fixed.** The first draft of the matrix had 21 lines and
the § 9.1 reconciliation left three SELECT policies unmapped — while § 2's aggregation table still
**summed to 39**, because they had been bucketed under a family whose row existed. Row 22
(`commission.cases.vocabulary.read`) exists because the parts were forced to sum *per policy*, not
per bucket. A count that sums is not a mapping.

**Gates.** `npm run lint:registers` and `npm run lint:progress` run before the commit, exit codes
read bare.

### 2026-09-13 — matrix r2 (backend)

Eight findings from [`docs/reviews/ae5-staff-matrix-review-r1.md`](../reviews/ae5-staff-matrix-review-r1.md)
(§ 1 the review verbatim, § 2 the lead's per-finding verdict) applied to
`docs/design/authz-ae5-staff-permission-matrix.md`, with one cross-reference fix in the deny-class
sibling. ⛔ T3 stays parked; nothing under `scripts/`, `supabase/`, `src/` or `e2e/` was touched.
Same stack and transport as the r1 entry (live catalog, `ON_ERROR_STOP=1`, rolled-back probes).

**H5 — the function reconciliation now sums BY LISTING.** New § 3.0 prints the population query and
the classifier, then names all **42** in four classes: **A** caller-keyed permission **12** · **B**
subject-keyed permission **11** · **C** registry **1** · **D** allowlisted **1** · **E** managed-row
value **17**. `12+11+1+1+17 = 42`, permission-shaped **23** — the reviewer's figure reproduced
independently. § 3.2's heading no longer carries a size; § 3.3 is now 17, not 18; r1's
`15 + 18 + 1` and its unreproducible "8 residue" are **deleted** from § 9.1, not patched.
⭐ Two mechanical honesty notes are kept in the document because they changed the answer: the
classifier run as written leaves an **R_residue of 13**, resolved by reading bodies
(`add_reserved_item` and `apply_minutes_review` use `is_member_of_for` as a *positive filter*, not a
negated guard ⇒ class E); and an earlier RETURN-TYPE discriminant (`boolean|integer` ⇒ predicate)
**misfiled `public.bulk_create_cases`**, which returns `integer` and whose call is an `HC021`-raising
precondition — a shape-shaped discriminant classifying by shape and not by role.
**The overlap is resolved by a precedence rule, not by subtraction** (new § 3.0a): a function gating
the caller's own authority anywhere is class A, its third-party sites recorded as a secondary
property. `public.create_referral_internal_note` is therefore class **A once** and is **removed from
§ 3.3**, where r1 also listed it. Measured: `select … where for_caller and for_third` returns
exactly that one function.

**H3 — one written criterion, and the census is its output.** New § 5.3. ⭐ **The criterion:** a site
is arm-3-shaped iff, for a principal whose only relevant grant is the `staff` membership, the door's
answer still depends on a term **no declared axis of `authz-matrix-axes.json` varies**, in either
limb — **(a) conjunctive** (a further CONJUNCT that can turn a GRANT into a deny) or **(b) role-free
disjunctive** (a DISJUNCT true for a principal holding *no role at all*, so a DENY cell is satisfied
without the predicate). Three exclusions: a sibling-ROLE arm (the `persona`/`role` axes cover it —
it becomes a preserved-arm disposition instead), a term the `scope` axis already varies, and a
resource-class selector. A **feature-flag precondition is declared but is NOT a coordinate** (it is
constant across every cell; measured: **29 of the 42** functions carry one).
**Output: 11 rows** — 1, 4, 6, 7, 8, 9, 11, 12, 15, 16, 19 (rows 4 and 11 carry both limbs).
Against r1's five: **added** 1, 4, 7, 12, 15, 16, 19; **removed** 20. The decisions the review left
to the criterion: **row 19 is IN** (`cp.source = 'indicator'` — the CAPA's *provenance* column, and
no axis carries provenance); **row 21 is OUT** (exclusion (ii): "is the resource anchored at the
scope under test" **is** the `scope` axis) — and the same reasoning puts **row 17 OUT** too, which
the review had not asked about. **Row 20 is RECLASSIFIED, not dropped**: its conjunct is
`r.status <> 'draft'` and **`draft` IS a declared `resourceLifecycle` value**, so it is a lifecycle
coordinate whose per-operation map is empty today (`constraintRules.lifecycle_requires_lifecycled_resource`
says so) — **T3 must populate it**, a stronger obligation than an arm-3 label. Row 8's
`m.status = 'in_signature'` is *not* among that axis's six values, so it stays arm-3 with the
alternative (extend the axis) offered to the PO. ⛔ The two limb-(b) coordinates are the ones that
matter: row 15's `owner_commission_id IS NULL` is a **PUBLIC arm** (every authenticated caller
passes) and row 4's self-read — both are the vacuous shape.

**H4 — `securable_resources_select` mapped, and the trap closed at its source.** Live qual re-read:
`(app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))`. Mapped to **row 16**,
because `securable_resources` is the document-bearing resource registry — its own live
`obj_description` says *"one row per document-bearing domain row"* (ADR 0114 D4). § 2's aggregate
corrected (`documents ×3`, naming all three) and its sum re-derived. ⭐ **The durable fix is new
§ 9.1a: the per-policy → row mapping, all 40 named against their row** (`9+1+4+1+3+1+9+2+4+3+3 = 40`),
with the § 2 aggregate demoted to a reading aid — because the same failure has now occurred twice
(row 22 in r1, `securable_resources` in r2) and a bucket that sums is not a mapping.
**Tenancy-arm disposition, AE4.3's way:** measured **28 of 40** policies carry
`app.is_tenancy_admin_of`; all 28 are **PRESERVED ARMS at T7**, so each layer-3 authorizer is
`authz.has_permission(…) OR app.is_tenancy_admin_of_for(…)`, ⛔ never permission-only — `org_admin`
and `hospital_admin` are still `legacy`, so their catalog grants are inert. Each must appear in T5's
`residualLegacyAuthority` **and** in `domainAuthorizer.composedWith` (the generator cross-checks both
directions).

**B1 — a disposition for ALL 18 new codes.** § 9.3 rewritten as a five-column table: code · how
`staff_admin` reaches the site today · proposed disposition · what breaks if neither. Because every
`staff` site is gated by the role-SET `app.has_role_any`, `staff_admin` reaches **all 18** today
through membership — r1 discussed seven, which was the wrong set. **All 18 → grant at T4**
(`staff_admin` 42 → 60). ⭐ The uniformity is a result, not a shortcut: the alternative (preserve via
a residual arm) was checked per row and rejected for all 18 on one ground — the arm that would be
preserved **is the membership term**, so preserving it means the site is not re-keyed at all.
⚠ One row reaches its site from elsewhere: **row 9**, where `staff_admin` gets deliberation from
`_case_caps` **S1** (the coordinator arm), not S5 — granting is still not an over-grant.

**B2 — the per-arm interface table.** New § 5.4, **one line per R / D / registry / T site** (~70
lines), with `subject` · `hat` · `definerSurface`, **T5 copies it verbatim**. ⛔ The hat is read from
the body and the site, never from § 6A: measured per predicate with
`select … from pg_policies / pg_proc where src ~ '<predicate>\(' `, which is what shows that **every
policy consumer of `can_reach_meeting`, `can_read_action_item`, `can_read_capa`, `can_read_event`,
`can_read_document`, `can_read_referral_metadata` and `can_sign_meeting` passes `auth.uid()`** ⇒
`hat: required` at those sites, while the function consumers that propagate `p_uid` are
`hat: ignored`. ⭐ Read off § 6A alone every `_for` predicate would have been declared
`hat: ignored`, and that is wrong at the majority of the policy sites — ADR 0201 D3's *"an arm's hat
behaviour is not a property of the arm alone"*, measured. Empty declarations are written out
(`carriesCode:false` everywhere today — no code exists yet). Two `definerSurface` entries are **not**
empty and were measured rather than assumed: `public.responses` has **5** DEFINER writers, none of
them in the `is_member_of` population (⇒ out of row 2's re-key surface); and **`public.sign_meeting`
is `prosecdef = t`, writes `meeting_signatures`, and IS on `staff`'s gate** — a live ADR 0193 D5
split on row 8, closed in one move because both it and the policy call `app.can_sign_meeting`, so
re-keying the **predicate** moves both.

**H6 — the `commission.responses.fill` interface is now § 11 item 7, a PO ruling.** Both shapes are
written out with their sites and their costs: **(A)** rename to `commission.responses.create`
(creation only; § 5.1's exclusions stand) or **(B)** keep `.fill` over the lifecycle and declare
`responses_update_own_draft`, `responses_delete_own_draft`, `answers_write_own_draft`,
`response_group_instances_write_own_draft`, `answer_selected_options_write_own_draft` and
`public.submit_response` (`prosecdef = f`, **no membership gate in its body**) as
residual-compatibility sites, with the DB path named as `authenticated` → RLS on `public.responses`,
⛔ not the TS guard. **Recommendation: (A)**, on three measured grounds — the resolver has no
ownership input so a `.fill` code can never be what those five policies consult; `.fill` spans
`write` and the **irreversible** submit in one `risk_class` cell, the exact defect that split
`commission.forms.manage`; and under (B) the row's declared surface is five sites the re-key must
*not* touch, an invitation for a later increment to "finish" it and break every lapsed member's
draft. ⇒ **§ 8.1's disposition is now conditional**: under (A) **PA-F8-STAFF-1 is WITHDRAWN as a
PA-F8 item** and re-filed as a bug/follow-up on the ownership path; under (B) it is **(b)**.
⚠ Withdrawing the label would ⛔ **not** downgrade the finding — the transcript stands either way,
only its register changes.

**M7** — § 5.2's heading `21 proposed rows` → `22 lines, 20 held rows` (`:412` at r1).
**M8** — the ADR 0193 link `0193-definer-writers-and-the-policy-rekey.md` →
`0193-the-enforcement-manifest-declares-what-it-measured.md` (1 occurrence, `:7`). ⛔ Gate 13 does
not resolve links under `docs/design/`, so **every** relative link in both files was resolved by
hand against the filesystem: 6 `../decisions/`, 3 `../plans|features|progress/`, 4 same-directory
`authz-*.md` in the matrix and 3 `../` in the deny-class file — **the 0193 one was the only break**;
all others resolve.

**Also changed, not requested but required for consistency.** The deny-class sibling's row 7 said
*"all 33 `is_member_of_for` call sites"* — 33 is the FUNCTION count; corrected to **35 third-party
call sites in 30 functions**, pointing at that file's § 6 where the two grains are set out. Its
`matrix § 3.2` cross-reference re-pointed to § 3.1 (+ § 3.0 for the new class partition).
⚠ **One self-inflicted error caught before commit**: a first draft of § 2's r2 note claimed *"two of
these three are arm-3-shaped and one is not"* — false; the criterion confirms **all three** (rows 6,
11, 15) and finds eight more. Corrected in place; recorded here because it is the same class of
error the review found — a summary sentence disagreeing with the table under it.

**§ 11 now carries SEVEN items**, and the header states r2 + *"Nothing here is approved"*.
**Gates:** `npm run lint:registers` and `npm run lint:progress`, exit codes read bare, before the
commit.

### 2026-09-13 — round 3: T3+T5 · T4 · ADR 0211 (backend)

Commits `97e90f82` (T3+T5) · `562c184a` (T4) · this entry with ADR 0211 + the bug filing.
Stack: I own it; **one `supabase db reset --local`, exit 0**, after checking `pg_stat_activity`
for peer sessions (none non-idle). Transport and evidence rules as in the r1 entry.

**L1 recorded, and its implementation forked — surfaced, not decided silently.** Lead decision L1
(option (a′)) is a `staff`-specific gate-arm axis sized by matrix § 5.3's eleven coordinates, with
limb (b)'s role-free disjuncts given an `unreachable`-style mandatory value. ⭐ **The axis is BUILT
exactly so** — `memberGateArm` in `authz-matrix-axes.json`, five values, `disjunct_absent` mandatory
and carrying row 15's PUBLIC-arm reason. ⛔ **What moved is its SWEEPER, and the reason is measured:**
`app.is_member_of_for` — the legacy subject of every `staff` representative — **consumes none of the
eleven terms**. They live in the CALLER (a policy qual or a door body), never in the membership
predicate the differential calls. Sweeping the axis in the RESOLVER differential would emit cells
differing only in a column their own predicate never reads: the exact inflation the gate-scoped
`caseReach` rule deletes, measured at 2592 duplicate cells when it was tried there.
⚠ **`caseReach` is not a precedent for sweeping it**: its carrying rep's legacy CLASS *is* the door
(`can_read_professional_profile`), so the reach is a real input. No `staff` rep has a door as its
class, because `staff` has exactly ONE legacy-equivalence gate. ⇒ the sweep's owner is the DOOR
differential `425` (T12), named in the disposition string so it cannot be lost. **⛔ This is a fork
on L1's implementation for the lead to accept or reject; the axis and its PO-approved coordinate
sizing are unaffected either way.**

⭐ **The reconciliation with `424`'s header CHANGED MY DESIGN, and the tester was right.** My
in-flight version made the gate arm move `expected_legacy_granted` (`conjunct_unmet` → legacy denies;
`disjunct_present` → legacy grants). `424`'s header says the opposite: *"`expected_legacy_granted`
for these rows is `expected_granted` UNLESS the PO names a divergence — none is proposed here."*
Checked rather than argued: **424's legacy side is `is_member_of_for`**, which knows nothing about
`visibility_policy` or `owner_commission_id IS NULL`, so neither column moves. My reading was wrong
and it is the reading that produced the whole sweep design. ⇒ **no disagreement remains** with
424's per-class table; my § 5.3 values map onto it (`conjunct_met`/`conjunct_unmet` ↔ its GRANTED/
DENIED conjunct rows; `disjunct_present`/`disjunct_absent` ↔ its role-free rows).

**⛔ ONE MEASURED CORRECTION TO BOTH DOCUMENTS — row 12 is not a status guard.** `424`'s table says
*"ethics-case status guard (HC0J0) precedes membership · votable status / non-votable status"* and my
matrix § 5.3 said *"the ethics-case status guard"*. Measured in `public.cast_case_vote`'s live body:

```
if not exists (select 1 from public.ethics_case_details d where d.case_id = v_case_id)
  then raise exception '…' using errcode = 'HC0J0'
```

It is an **ethics-details EXISTENCE** guard, not a status guard. The fixture pair is a case WITH and
a case WITHOUT an `ethics_case_details` row — ⛔ not two case statuses, which is what both documents
would have had the tester build. Both are wrong in the same direction and neither is corrected in
this commit (424 is the tester's; my § 5.3 correction is owed with the next matrix touch).

**The tester's three unverified rows, answered by targeted query** (its § 8 asked for exactly this):
`ROW 12` — `public.cases` holds `completed x1, pending x3, not_started x4`, and per the above the
axis is the wrong one entirely. `ROW 16` — `document_approvals` has **4 rows**, so limb (b)'s
`disjunct_present` is constructible today (whether the approver is a *clean* staff still needs
checking). `ROW 19` — ⛔ **`capa_plan` holds ONE row and its `source` is `rca`, not `indicator`**, so
row 19's `conjunct_met` coordinate has **no fixture at all**; a gap the report did not list and which
I add to § 8's list. Confirmed from the same sweep: `accreditation_frameworks` **0 rows** (row 15),
all meetings `held` (row 8 needs `in_signature`), all `commission_default` (rows 6/7), one
`committee` action item (row 11).
**`offboarded`, located:** `public.hospital_affiliations` (`ended_on` / `voided_at`), ended by
`app.end_affiliation_impl` / `app.void_affiliation_impl`, read by
`app.person_has_active_org_affiliation` / `app.person_is_anchorless`. Live: **5 rows, 0 voided, and
32 profiles already hold zero live affiliations** — which is why AE4 excluded the coordinate: most
personas are ALREADY offboarded, so an `offboarded` cell is byte-identical to their active cell
unless a purpose-built pair is seeded.

**T3+T5 (`97e90f82`).** Axes: `subjectRoles = [staff, staff_admin]`; the `role` axis gains `staff`;
the scope rule restated at the commission TIER; `memberGateArm` added; `resourceLifecycle`'s
per-operation map declared non-empty for row 20 in the manifest. Generator: `REPS_BY_ROLE` with
**five** `staff` reps, each a code `staff` HOLDS and chosen to cover every `memberGateArm` value; the
`len(subject_roles) == 1` assert **replaced, not deleted**, by a bound fusing `subjectRoles` to the
rep lists (this side's mirror of the `.mjs` ARM C3); `role` enters the cell tuple at column **14**
and `CELL_AXIS_COL` — which makes the old arm7 exemption comment false, so it is rewritten rather
than left; arms **2, 4 and 5 now run PER ROLE**, because over the union each is satisfiable by
`staff_admin` alone (the AE4.7c masked-arm shape). **arm5 re-predicated** on the role's own
resolution scopes.
⭐ **The output is ONE TABLE PER ROLE, and that is what keeps AE4 non-regressive.**
`authz_differential_cells` keeps its columns and its **1728 rows — verified byte-identical to HEAD
by a sorted diff** — so `403` needed no edit and its greenness after the landing is evidence, not
hope. `staff` gets `authz_differential_cells_staff` (**1080 rows**), identical column list.
⛔ The alternative (one shared table + a `role` filter in 403) would have forced ~20 count-pinned
sections in a suite this increment has no finding against.
**Cell totals, as OUTPUTS:** matrix cells **4004** (was 2002 — the role axis doubles it), differential
cells **2808** = 1728 + 1080, manifest rows **61**.
**Self-test: 23 fixtures, each firing its OWN arm** (LEARN-103), plus the two the lead named —
`arm7 role value dropped` (**a fixture that could not exist before this landing**: `role` had no
column, so arm7 fell back to `emitted = declared` and could not fire for it) and **arm5's QUIET
half**, a new negative-control block asserting the re-predicated arm does NOT false-red a
commission-only role. Both halves of arm5 are therefore proven: loud on `staff_admin`, silent on
`staff`.
**T5:** `approvedSuites.staff` naming the two design docs and `424` (named, not created); snapshot
43 → 61; 18 `pending-rekey` rows with the `staff`-shaped `layer1Gate` `app.has_role_any_via_is_member_of`;
a new **`armInterface`** field carrying matrix § 5.4's subject / hat / `definerSurface` **per site**,
with each `conditional` hat carrying a `hatNote` naming where it is required and where ignored.
⚠ `armInterface` is deliberately **not** in `requiredPermissionKeys`: the 40 pre-AE5 rows have no
such measurement behind them and making it required would put an empty list on all of them, turning
a declaration into the default it exists to prevent.

**T4 (`562c184a`).** Migration `20261003007440_ae5_staff_seed.sql`, one paragraph as acked: it
mirrors `20261003007160` and differs in three ruled ways — it INSERTS 18 permissions (43 → 61), it
grants them to `staff_admin` too (42 → 60, PO item 4), and it flips `authz.roles.staff` to
`test_validation`; `staff` gets its 20 approved codes; a count-verified `do` block asserts
61 / 20 / 60, that exactly one role flipped, and that exactly one `authoritative` and one
`test_validation` role remain; it re-keys nothing and seeds no implication edges.
**Rename by grep, not recall:** 3 files carried `commission.responses.fill`. The matrix is the live
one — renamed at row 2 and § 9.3 with a dated marker, § 8.1 given the ruling, item 7's options kept
as history (ADR 0105). The record and the review keep the old name: they are historical documents.

**`test:db` on the fresh reset — 16 reds of 9133 observed, 11 after the in-scope repairs.**
`410` went **4 reds → GREEN**: § 1.2 (43 → 61), § 4.5 (40/3 → **58/3** — the second number did NOT
move, because T4 seeds a catalog and re-keys nothing; a landing that moved both would be a re-key
hiding inside a seed) and § 7.4 (1 → 2 suites), each re-pinned **after** being observed red and each
carrying a dated marker saying so; § 2.5 fixed by correcting the manifest's `catalogSnapshot`
(`staff` → `test_validation`, head → `20261003007440`), **not** by editing the test.
`role_manifest.psql` regenerated so the artifact follows the catalog again (`411` 2 reds → 1).
⛔ **`403 § 3.2b` is RED and LEFT RED**, as instructed — its own message says *"Do not 'fix' a red
here by repointing the suite back — record it."*

**PROPOSED (not applied) — how `403 § 3.2b` is re-claused.** Today it asserts
`count(*) from authz.roles where state = 'test_validation' = 0`, standing in for the property it
actually guards: that `candidate_has_permission` and `has_permission` are indistinguishable **over
this suite's own fixture**, which is what makes 403 evidence about the runtime path too.
⇒ **Re-clause it from a GLOBAL count to a SUBJECT-SCOPED one**: assert that no role appearing in
`authz_differential_cells` — staff_admin-only since the per-role split — is in `test_validation`,
which is exactly the property, and is what the global count meant while only one role existed.
**Pair it with a new § 3.2c** pinning the SET of `test_validation` roles BY NAME against the
manifest's `approvedSuites` minus this suite's own subject, so a second role entering that state is
still **asserted** rather than merely tolerated, and the suite names which other suite owns that
role's evidence. ⛔ Without the second half the re-clause is a weakening: the first half alone goes
quiet on exactly the event the original was watching for.

**⚠ REDS OUT OF THIS ROUND'S OWNERSHIP — reported, not touched.** All are count pins the seed moved;
none is a behaviour finding.
- `401` (6): § 3.2 the non-legacy-role tripwire (now two), § 14.6 (43), § 14.7 (42 of 43),
  § 14.8 (*"no other role has a grant"*), § 19.2 (six classes over 43), § 19.5 (cardinality 43).
- `409` (2): § 1.3 (40 of 43 carry no literal → 58 of 61), § 5.5 (the named entitlement list).
- `411` (1): § 0b, the `role_manifest.psql` **md5 content pin** — `a6b2308068d4b0f3e59e3f74e4539245`
  → `abfc8621f6c3e82935c98c2e9bfc8424`.
- `422` (1): § 4.8 (*"`authz.role_permissions` … still exactly one granting role"*).
- ⛔ **Gate 19 (`lint:role-manifest`) is RED for ONE COUPLED REASON**: the generator's own message is
  *"Regenerate, then move the pin"*, and the pin lives in `411`. Regenerating was correct and in
  scope; moving the pin is not. ⚠ I kept the correct artifact rather than reverting to keep a gate
  green — a stale artifact that matches its pin is a false record, and the coupling is better
  visible than hidden.
- ⛔ **Gate 9 (`lint:adr-index`) is RED**: adding a `proposed` ADR drifts
  `docs/decisions/proposed-review.json`'s stamped set. ⚠ **I did NOT add `0211` to that array.** The
  stamp records the set as of the last REVIEW, and its own comment says discharging means re-reading
  each of the eight listed ADRs against what is built. Adding my id without doing that would claim a
  review that did not happen — the stamp-with-unenumerated-readers shape. The file is also outside
  this round's ownership.

**ADR 0211 — `docs/decisions/0211-staff-gets-its-own-single-role-wrapper.md`, Status `proposed`.**
Number **re-measured at the moment of creation** across all 10 local + remote refs: highest is
**0210** ⇒ **0211** (`adr:index` independently reports *"next free 0212"* after the write).
D1 `app.is_commission_staff_of(_for)` delegating to `authz.holds_role(…,'staff','commission',…)`,
`search_path = ''` + schema-qualified body, the pair created together (ADR 0200).
D2 the cutover is proven by a **three-part** obligation because no `candidate_holds_role` exists —
the migration's own snapshot/assert over the four properties, a pgTAP differential under
`test_validation` against the **constructed** equivalent (`has_role_any` restricted to `staff` rows,
because an unrestricted comparison would report every `staff_admin`-only membership as a divergence),
and PA-F8-STAFF-2's condition asserted as cells (`memberships_one_commission_role_uq` + the two-value
tier). ⭐ The three are not redundant: the first sees a changed property and no answer, the second a
changed answer and no property, the third guards the premise that makes the second total.
D3 `is_member_of` stays a role-set predicate until BOTH commission roles are `authoritative` —
`holds_role` returns false for a non-authoritative role, so re-expressing early is a silent
revocation across **82** catalog objects.
⚠ Two link slugs in the first draft were written from memory and resolved to nothing (`0078`,
`0174`); caught by resolving every link against the filesystem before `adr:index`. Same class as the
r2 finding — a location is a measurement.

**Bug filed.** `BUG-AE5-STAFF-RESPONSE-OWNERSHIP-SURVIVES-REVOCATION` (open · high · responses) with
a per-bug doc, carrying § 8.1's transcript verbatim. **PA-F8-STAFF-1 is withdrawn as a PA-F8 item**
under the item-7(A) ruling — ⛔ the finding is not downgraded, only its register moved, and the doc
says so at the top. ⚠ **Regression protection: NONE today**, and that is part of the filing: no cell
constructs "membership revoked while a draft is open", and T7 is exactly when re-keying the five
ownership policies would silently break every lapsed member's draft while looking like tidying up.
⚠ `BUGS.md`'s header sum was re-derived in the same edit (48 + 5 + 111 = 164 → **48 + 6 + 111 = 165**):
the sum IS the check, and a sum one short reads exactly like a sum that is right.

**⛔ FIXTURE GAP ROWS ARE NOT SEEDED — left to a follow-on commit, as the lead's option allows.**
The tester's § 8 list plus my additions (row 19's missing `indicator`-sourced `capa_plan`; row 12's
corrected mechanism) touch personas many other suites read — adding a `staff` membership to
`novato.pendente` / `desativado.conta` in particular could move suites that assume they are
committee-less — and validating that needs its own full `test:db`. Scoping it against a 9133-test
suite in the same commit as the seed would have made a red ambiguous between the two changes.

**Gates, exit codes read bare.** `lint:authz-vectors` **0** · `lint:registers` **0** ·
`lint:progress` **0** · `lint:adr-index` **1** (the `proposed` stamp, above) ·
`lint:role-manifest` **1** (the `411` md5 coupling, above) · `test:db` **1** (11 reds of 9133; `410`
green, `403 § 3.2b` red by instruction, the rest out of ownership).

### 2026-09-13 — round 4 (backend)

Commits `39d6e43d` (L2) · `ac8a3bf2` (L2 follow-up: names) · `6ab207e0` (the closure repair) ·
`47fbce12` (L3) · `8240b6eb` (L4) · `aef7d7f6` (L5) · `5f9d71f5` (step 5) · this entry.
Three `supabase db reset --local`, all exit 0. Stack is mine; the tester's session dropped on the
first reset, as it reported.

**L2 — the axis is swept, and the lead's correction was right.** I had moved the eleven-term sweep
out of the resolver differential because `app.is_member_of_for` reads none of the terms. The
measurement held; the conclusion did not. ADR 0175 D3's shape is that an arm-3 row's LEGACY COLUMN
CALLS THE REAL DOOR, so **the wrong half had moved**. `REPS_STAFF` is now the eleven carrying rows
(1, 4, 6, 7, 8, 9, 11, 12, 15, 16, 19) plus `commission.responses.create` — the only
membership-gated write policy — carrying the inert value, and each carrying rep is keyed on its
DOOR. The door is declared as DATA in the manifest at `permissions[<code>].arm3Door` (kind ·
expression · positional args · limb · note) and **emitted into the vector as a `legacy_door`
column**, so `424` reads it from the cell instead of re-deriving it. ⭐ Row 12's entry is a
`guard-expression`, not a callable: `public.cast_case_vote` WRITES and returns uuid, and a read
differential must not call it.
**arm12** binds the two in both directions — a carrying rep with no door, a door with no swept
values, a door with no expression, a declared value emitted nowhere, and (after the naming round) a
`legacyClass` disagreeing with the class the row is swept as. Modelled on arm9, one axis over.
`memberGateArm` also entered `CELL_AXIS_COL` (column 15); without it arm7 falls back to
`emitted = declared` and cannot fire on it — the blind spot `role` had.

**Output, as an output:** 9936 cells = 1728 `staff_admin` + 8208 `staff`; **5616 arm-3 axis cells
over 11 representatives**. The `staff` table carries **16** columns, `staff_admin`'s **14** — ⛔ not
the identical lists an earlier revision promised, because the two extra columns ARE the axis and
putting them on the shared shape would change the table `403` reads.
⭐ **`staff_admin`'s 1728 rows are byte-identical to HEAD**, and keeping them so took a correction:
appending the gate value to every cell id rewrote all 1728, and `403` joins by `cell_id`. The
suffix is appended only for non-inert values.
**Self-test: 26 fixtures, each firing its own arm**, plus arm5's quiet half and a new PROPERTY block
for L2's two halves. ⚠ That block began as an arm7 QUIET fixture and **the quiet control caught
it**: arm7 is a GLOBAL axis-completeness arm, so asked about one role's subset it correctly reports
the values that subset omits. The fixture was asking an arm a question it is not designed to answer,
and a green would have meant nothing. The claim is about cells, so it is asserted on cells.

**ONE NAME PER ROW (tester request).** The tester's six PROPOSED strings are adopted **verbatim** —
`can_reach_meeting` · `can_reach_meeting_not_respondent` · `case_caps_deliberation` ·
`can_read_action_item` · `cast_case_vote_guard` · `rls_profiles_comember_or_self`. The five it did
not name follow the same convention (`rls_` for a policy qual, the function name otherwise):
`rls_form_matrix_targeted_version` · `can_sign_meeting` · `rls_accreditation_frameworks_owner_null` ·
`rls_controlled_documents_approver` · `can_read_capa`. Each row carries `legacyClassSource` saying
whose string won. **`stateColumn`** names the concrete column or row-presence a fixture must build:
`cases.visibility_policy` (9) · an `ethics_case_details` row (12) · `meetings.visibility_policy` +
`meeting_attendees` (6/7) · `meetings.status` + `attendance` (8) · `action_items.visibility_scope` +
assignments (11) · `accreditation_frameworks.owner_commission_id` (15) · a `document_approvals` row
(16) · `capa_plan.source` (19) · the targeted-version participation walk (1) · the target's
memberships / self (4).

**⛔⛔ A DEFECT IN T4, FOUND BY 409's NAMED LIST — the seed was FUNCTIONALLY INERT.**
`authz.entailed_grants` joins the materialised closure on
`cl.implying = rp.permission_code and cl.implied = p_permission_code`. T4 inserted 18 permissions
and did **not** rebuild it, so each lacked its REFLEXIVE edge and resolved FALSE however correctly
it was seeded. Measured: closure **43 rows against 61 permissions**, **18** with no reflexive edge,
and `authz.has_permission(<chefe.ccih>, 'commission', <CCIH>, 'commission.forms.read')` = **false**
for a `staff_admin` holding the grant under an `authoritative` role. Repaired forward-only
(`20261003007450`, total rebuild, guarded on both sides); after: closure **61**, `has_permission`
**true**, `candidate_has_permission(<staff4>, …)` **true**.
⭐ **How it was caught is the lesson.** `409 § 5.5` asserts a **NAMED LIST** of the codes a fixture
`staff_admin` fails, not a count. A count arm would have read *"18 more failures"* — a number to
bump while moving the other AE5 pins, and the seed would have stayed inert behind a green suite. The
list named exactly the 18 codes just added, and a list of precisely the things you just added is not
a pin drifting; it is the addition not working. ⇒ `409 § 5.5` **went green on its own** after the
repair and is NOT in the pin table below.

**L3 — the nine pins, each observed RED first.**

| suite | § | old → new | the seed change that moved it |
| --- | --- | --- | --- |
| 401 | 3.2 | `staff_admin=authoritative` → `staff=test_validation, staff_admin=authoritative` | T4 flipped `staff` |
| 401 | 14.6 | 43 → 61 | T4 inserted the 18 codes |
| 401 | 14.7 | 42 → 60 | the 18 also granted to `staff_admin` (PO item 4) |
| 401 | 14.8 | 0 → 20 | `staff` got its 20 approved codes |
| 401 | 19.2 | 6 → 7 classes | the 18 carry `legacyEquivalence.gate = app.is_member_of_for`, a class the catalog did not have |
| 401 | 19.5 | 43 → 61 | cardinality control for § 19.4 |
| 409 | 1.3 | 40 of 43 → 58 of 61 | the 18 arrive `pending-rekey`; ⛔ the SECOND number (3 re-keyed) did NOT move — a landing that moved both would be a re-key hiding inside a seed |
| 411 | 0b | md5 `a6b23080…` → `abfc8621…` | `role_manifest.psql` follows the catalog after the state flip; gate 19 green with it |
| 422 | 4.8 | `array['staff_admin']` → `array['staff','staff_admin']` | T4 seeded the `staff` bundle |

⚠ **401 § 14.8's WORDING is deleted, not marked.** It read *"NO other role has a grant"*, quoting
AE4.2. That sentence was true for AE4 and is now false; leaving it beside a count of 20 would be a
message contradicting its own expected value.
⚠ **One self-inflicted break, caught and fixed**: 401's new message was appended as a second SQL
literal on the SAME line, which Postgres does not concatenate — the suite **aborted at test 72 of
121** with a syntax error while the summary still read `Failed: 0`. An aborting suite is worse than a
failing one: 49 tests did not run. A newline between the literals fixes it.
**`test:db` on a fresh reset — BEFORE:** 401 (6) · 403 (1) · 409 (2) · 411 (1) · 422 (1).
**AFTER:** only `403 § 3.2b`, exactly as the step required.

**L4 — `403 § 3.2b` re-claused, red witness recorded.**

```
# Failed test 11: "3.2b ⭐ THE BOUND ON POINTING THIS SUITE AT THE CANDIDATE EVALUATOR …"
#         have: 1
#         want: 0
```

§ 3.2b is now subject-scoped: no role appearing in `authz_differential_cells` (staff_admin-only
since the per-role split) is in `test_validation`. The global count was never the property; it stood
in for it while one role existed. **§ 3.2c** pins the `test_validation` set BY NAME, computing the
expected value from two independent sources — the manifest's `approvedSuites` MINUS the roles this
suite's own cells sweep — so neither side can be edited to agree with the other. ⛔ Not keyed on the
literal `staff`: at increment 2 the value moves by itself, and an assertion that must be hand-edited
to stay true is one that gets hand-edited to stay green. 403 loads
`vectors/authz_enforcement_manifest.psql` for that side; it creates only its own temp tables.
**Able-to-fail proof for § 3.2c**, mutation applied then rolled back:
`update authz.roles set state='test_validation' where code='org_admin';` →
`# Failed test 12: "3.2c …" have: org_admin, staff  want: staff`; rolled back → `Result: PASS`.
403: plan 27 → 28, PASS.

**L5 — row 12 corrected in matrix § 5.3.** The `HC0J0` guard is
`if not exists (select 1 from public.ethics_case_details d where d.case_id = v_case_id)` — an
ethics-DETAILS EXISTENCE test. The arm-3 verdict is unchanged; the FIXTURE PAIR changes to a case
WITH vs WITHOUT such a row, ⛔ not two statuses. **Where row 19's missing fixture was recorded:** in
the round-3 record entry and in the manifest at
`permissions["commission.capa.read"].arm3Door.note`, and now in the seed block's header. ⛔ **I did
NOT append to `docs/testing/ae5-staff-fixture-gaps.md`** — it is tester-owned; the lead reconciles.

**Step 5 — the fixture rows**, every id new and carrying this unit's `a5f…` prefix: 4 personas
(`gap.xorg.b` clean org-B staff-only · `gap.unpriv` zero-role/zero-admin/active · `gap.pending`
unconfirmed in `auth.users` AND `profiles` · `gap.deactivated`) · 3 `staff` memberships · 4
`organization_affiliations` · a `participants_only` meeting + a non-attendee pair · an
`in_signature` meeting + present/absent attendees · 2 `assignees_only` action items · 3
`accreditation_frameworks` (NULL-owner, own, foreign) · a `document_approvals` row naming the CLEAN
staff · an indicator-sourced `capa_plan`.
⛔ **No existing persona repurposed**, diverging from § 8 on purpose: it asks for memberships on
`novato.pendente` and `desativado.conta`, which suites read as committee-less. Two NEW personas
carry the coordinates. **Row 12 needed no new case** — measured, CCIH already holds 1 case WITH an
`ethics_case_details` row and 5 WITHOUT.
**`offboarded` is not seeded, and not for want of a mechanism**: it is
`public.hospital_affiliations` (`ended_on` / `voided_at`), written by `app.end_affiliation_impl` /
`app.void_affiliation_impl`, read by `app.person_has_active_org_affiliation` /
`app.person_is_anchorless` (ADR 0163). The coordinate is not constructible as a DISTINCT cell —
**32** seeded profiles already hold zero live affiliations, so an offboarded persona's cells are
byte-identical to its active ones. That is the finding AE4 recorded when it EXCLUDED the value.
⚠ Three product guards shaped the fixture rather than being worked around: `HC0C3` (a
`participants_only` meeting needs an attendee first), `23514` (an `in_signature` meeting refuses
attendee writes), `23514` (a status transition needs `app.in_meeting_rpc` — the same flag the RPC
sets, scoped transaction-local).

**⚠ THE FIXTURE'S FIRST RUN BROKE FOUR SUITES, and it was not a count.** 387 (7) · 393 (1) · 396 (1)
· 400 (3), because the four personas had **no organization affiliation** and were therefore tenant
orphans: `396 § 9.3` asserts the seed contributes ZERO orphans and `400 § 1.6` pins the orphan set
**as a LIST**. Those are properties the suites exist to hold, falsified by the fixture — not pins to
move. Affiliations added; **393, 396 and 400 green**.

**⛔ STOP — `387` (7 tests), and it is not this round's to touch.** Its pins are md5s over
profile-visibility SETS, which any new persona moves. Old → new, measured:

| test | § | old md5 | new md5 |
| --- | --- | --- | --- |
| 5 | B1 hospital_admin | `cded5a2d2aa30200459df9b1cf79fad8` | `67bfdf1fc6f19799353a5b7555298e0c` |
| 6 | B2 org_admin | `7954b32056d1c7103f45a8fa4dab6e81` | `aad18a567b61494e42a34bdb91e3a957` |
| 7 | B3 platform_admin | `8890048e7c71c8bc3f5f6fd36e94ba24` | `783c2a1e28d44e12af028ca7d53aa36e` |
| 8 | B4 staff_admin | `17d08eadd7e1d99df2dbd88f3ad5ffd5` | `03904c72e766d0719e6e0d9e4ffcd7d9` |
| 9 | B5 staff | `17d08eadd7e1d99df2dbd88f3ad5ffd5` | `03904c72e766d0719e6e0d9e4ffcd7d9` |
| 10 | B6 cross-org org_admin | `4acaab502f5a639f29a4e30a7c1b33f2` | `00e55169b95a4a99cb9f14c8b40cbccf` |
| 19 | D1b (the restore control) | `cded5a2d2aa30200459df9b1cf79fad8` | `67bfdf1fc6f19799353a5b7555298e0c` |

⚠ Tests 8 and 9 share a value (both see the CCIH set) and test 19 is test 5's restore control, so it
moves with it. ⛔ **The ROW COUNTS baked into the test NAMES (23 / 29 / 36 / 10 / 10 / 5) are stale
too and must be RE-DERIVED, not copied** — I did not measure them, because a simplified JWT lacks
the hat and reads 1 for every persona, which would be a wrong figure that looks like a measurement.

**⚠ `424` aborts** — `Bad plan. You planned 21 tests but ran 0`, cause
`relation "authz_differential_cells_staff" does not exist`: the tester's file is missing
`\ir vectors/authz_differential_cells.psql`. Both role tables live in that one file, so the single
include gives it the table. Tester-owned; reported, not touched.

**Gates, exit codes read bare.** `npm run lint` **0** in full — ⚠ including gate 9, which the round
expected to stay red: `proposed-review.json` now reads `"reviewed": "2026-09-13"` and carries 0211,
so the lead's review landed before this run. `npm run typecheck` **0**. `test:db` on a fresh reset
**1** — `387` (7, the STOP above) and `424` (the tester's missing include); every other suite green,
including `401`, `403`, `409`, `410`, `411` and `422`.

### 2026-09-13 — T6 atomic cutover PLAN (backend) — ⛔ FOR FULL REVIEW, NO SQL WRITTEN

Read-only round on the DB (the tester owns the stack). Every catalog fact below was measured by a
read-only select today; the two migration citations are read for INTENT only, per ADR 0078.

#### 1. What this cutover DOES and, more importantly, DOES NOT do

Under ADR 0211 as written, T6 flips **exactly two things** and leaves the largest population alone:

- ✅ **`authz.roles.staff` → `authoritative`**, with a count-verified `do` block.
- ✅ **`app.is_commission_staff_of(_for)` created and PROVEN** — the single-role wrapper D1 names.
- ⛔ **Every one of the 82 `is_member_of(_for)` dependents keeps its behaviour, untouched.** ADR
  0211 D3: `is_member_of` stays a role-SET predicate until BOTH commission roles are
  `authoritative`. After this cutover they are — so the re-expression becomes *available*, and it is
  still **not** part of T6: it lands with T7's re-key, where the sites that move are chosen per site
  from matrix § 5.4, not in a migration whose subject is the wrapper.
- ⛔ **No enforcement site is re-keyed.** All 18 manifest rows stay `pending-rekey`; `410 § 4.5`'s
  pair stays `58 / 3`. A landing that moved that pair would be a re-key hiding inside a cutover.

⭐ **So the wrapper is created with ZERO callers, deliberately**, and that is the one thing a reviewer
should push on. It is not dead code by accident: T7 is its consumer, and creating it here is what
lets D2's proof run against the real object before anything depends on it. ⚠ It also means
`docs/learning` "a designated authority with ZERO CALLERS is a conformance finding" applies to it
from the moment it exists — the census in § 5 states the expected caller count as **0 at T6, N at
T7**, so a reviewer can tell the planned zero from an accidental one.

#### 2. The wrapper — exact shape, and the one place "mirror `is_staff_admin_of`" must NOT be obeyed

```sql
create or replace function app.is_commission_staff_of(p_commission_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select authz.holds_role((select auth.uid()), 'staff', 'commission', p_commission_id);
$$;

create or replace function app.is_commission_staff_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select authz.holds_role(p_user_id, 'staff', 'commission', p_commission_id);
$$;
```

Measured properties of the pair being mirrored (`pg_proc`, today):

| | `prosecdef` | `provolatile` | `proconfig` | `proacl` |
| --- | --- | --- | --- | --- |
| `app.is_staff_admin_of` | `t` | `s` | `search_path=app, public, pg_catalog` | `postgres=X, authenticated=X, service_role=X` |
| `app.is_staff_admin_of_for` | `t` | `s` | `search_path=app, public, pg_catalog` | `postgres=X, authenticated=X, service_role=X` |

⛔⛔ **"ACLs mirroring `is_staff_admin_of(_for)` exactly" is right; MIRRORING ITS `search_path` WOULD
BE WRONG.** That pair runs on `app, public, pg_catalog` — frozen compatibility debt under ADR 0208
D4, which rules `search_path = ''` + schema-qualified references **the sole forward convention for
new or touched DEFINERs** and says the frozen set *"may not grow"*. Two new DEFINERs on a non-empty
path would grow it by two and red `419` + gate 18. ⇒ **ACLs: mirror exactly. `search_path`: `''`,
and the body schema-qualified (`authz.holds_role`, `auth.uid`) so `421`'s body arm resolves it.**

⚠ **And mirror the `_for` twin's ACL, not `is_member_of`'s.** Measured: `app.is_member_of` carries a
stray **`=X/postgres` (PUBLIC EXECUTE)** entry that `is_member_of_for` does not. Copying the bare
member of that pair would propagate a stray grant into a brand-new object. The grant list is
therefore stated explicitly in the migration — `revoke all from public; grant execute to
authenticated, service_role;` — rather than inherited by resemblance.

#### 3. The four-property snapshot/assert block

Mirrors `20261003007210`'s shape, and its comment states the reason the block exists: *"`create or
replace` is NOT drop+create: name, signature, `prosecdef`, volatility, `search_path` and ACLs all
persist — which is exactly why the revoke is a SEPARATE, SNAPSHOTTED step."*

⚠ **Here the block is doing a DIFFERENT job and that difference must be stated, or it is theatre.**
At AE4.6 the wrappers already existed and the risk was a `create or replace` silently changing a
property. Here the wrapper is **new**, so there is nothing to preserve; the block instead asserts the
properties the new object was CREATED with, against the values ADR 0208 D4 and § 2 above require:

- `prosecdef = true` · `provolatile = 's'` · `proconfig = {search_path=""}` · `proname`/signature
  exactly as declared · `proowner = postgres` · `proacl = {postgres=X, authenticated=X,
  service_role=X}` and ⛔ **no PUBLIC entry** (`proacl` is asserted as a SORTED ARRAY, not a count —
  a count cannot tell a lost grant from a swapped one).
- Captured **before** into a temp table and asserted **after**, in the same migration, so a failure
  names which property moved rather than "something changed".

#### 4. `staff` → `authoritative`, count-verified

The `do` block mirrors `20261003007440`'s: assert the state BEFORE (`staff = test_validation`,
exactly one `authoritative`), perform the update, `get diagnostics row_count = 1`, then assert
**exactly two `authoritative` and zero `test_validation`** afterwards. ⛔ A bare update that matched
zero rows would apply silently and every downstream resolver would read "the catalog denies
everything" as a divergence rather than as a missing flip.

#### 5. Direct-call census, per site, from the comment-stripped catalog

Derived the way `20261003007200` derived its, ⛔ never from a name-keyed family classifier. Measured
**today**, over `regexp_replace(prosrc,'--[^\n]*','','g')` in `app`/`public`/`authz`:

| population | count | disposition at T6 |
| --- | ---: | --- |
| functions carrying the literal `'staff'` | **3** | ⛔ **none replaced.** `app.grant_role_impl` and `app.revoke_role_impl` dispatch on `p_role in ('staff','staff_admin')` — they ADMINISTER the role (matrix § 5.1's exclusion) and are org/hospital-admin territory; `public.appoint_administrativo` requires the appointee to BE a `staff` — a managed-row value. None is a caller of the role predicate on its own behalf, so none is a bypass. |
| policies carrying the literal `'staff'` | **0** | — |
| direct `app.has_role(..., 'staff')` calls | **0** | — the AE4 analogue had one (`can_manage_professional`); `staff` has none. |
| callers of the NEW wrapper | **0 at T6, by design** | T7 is its consumer (§ 1). |

⇒ **`staff` has no bypass to close**, and that is a measured result rather than an absence of
looking: the same sweep that found AE4's one bypass finds none here, because `staff` is reached
through a SET predicate and never by name.

#### 6. ⛔ NEVER `legacy OR new` — the pgTAP grep

`405 § 4.2` greps the comment-stripped `prosrc` of the wrapper family for `has_role`'s absence and
`§ 4.3` is its positive control (the instrument must find something). T6 **extends the family** to
the two new functions:

- new `§ 4.2b` — neither `app.is_commission_staff_of` nor `_for` contains `has_role`, `is_member_of`,
  `has_role_any`, or a second disjunct of any kind; the body is one `holds_role` call.
- new `§ 4.3b` — the positive control on the same instrument: both DO contain `holds_role`.
  ⛔ Without it, § 4.2b is an absence measured by an instrument never shown able to find anything.

#### 7. ADR 0211 D2's proof — three parts, none sufficient alone

1. **The snapshot/assert block** (§ 3) — sees a changed property, says nothing about answers.
2. **The constructed differential** — `has_role_any('commission', C, u)` **restricted to `staff`
   rows** ≡ `app.is_commission_staff_of_for(C, u)`, for every seeded principal × every commission.
   The restriction is the whole content: `has_role_any` is a SET predicate, so an unrestricted
   comparison reports every `staff_admin`-only membership as a divergence. ⚠ Stated bound: it proves
   the wrapper agrees with the legacy predicate's `staff` slice — ⛔ **not** that `holds_role` behaves
   under `test_validation`, which it cannot, because it refuses that state by design. ⭐ **This is
   why the differential runs AFTER the flip, in the same migration's test, not before it.**
3. **PA-F8-STAFF-2's condition, as cells** — `memberships_one_commission_role_uq` exists with its
   measured definition (`UNIQUE (principal_id, commission_id) WHERE commission_id IS NOT NULL`;
   a second commission row for one principal raises `23505`), and `memberships_scope_shape`'s
   commission tier is exactly `{staff, staff_admin}`. ⛔ Dropping either re-opens the hat-grain
   divergence **silently**, which is why it is a cell and not a sentence.

#### 8. What ELSE reds — named now, each to be observed RED before it moves

| suite | § | why it moves |
| --- | --- | --- |
| `401` | 3.2 | the tripwire names the non-legacy set BY VALUE: `staff=test_validation, staff_admin=authoritative` → **`staff=authoritative, staff_admin=authoritative`**. ⭐ It fires a THIRD time and that is it working — it is not widened, and a third role still reds. |
| `403` | **3.2c** | ⛔⛔ **MY OWN L4 ASSERTION REDS AT T6, BY CONSTRUCTION, AND I AM NAMING IT BEFORE IT SURPRISES ANYONE.** § 3.2c pins the `test_validation` set against `approvedSuites` MINUS this suite's subject = `{staff}`. After the flip the live set is EMPTY while the computed side still says `staff` → `have: (none)  want: staff`. That is § 3.2c firing on exactly the case it was written for — *"a role that owes a suite but is NOT in that state … flipped to `authoritative` without its gate"* — and here the gate DID run, so the expected side must gain a third term: **minus roles already `authoritative`**. ⚠ A re-clause, not a relaxation, and it must be observed red first. |
| `410` | ARM C1 / § 7.x | `authoritative − approvedSuites`: `staff` becomes authoritative and HAS a suite, so C1 stays quiet — but any pin counting authoritative roles moves 1 → 2. |
| `405` | § 4.2b / § 4.3b | new sections (§ 6). |
| `411` | § 2.1 / § 0b | `role_manifest.psql` follows the catalog: `staff` state changes again ⇒ regenerate, then move the md5 pin. The two-step is the generator's own instruction. |
| `422` | — | unaffected: it asserts the granting-role SET, which does not change. |

#### 9. ADR 0208 D3's five triggers — does the flip fire any? **No, and here is each one**

1. *administrativo added as a permission provider* — **no**; that is proposed-order item 6, and
   `app.member_can(_for)` is byte-unchanged (md5-pinned in `422 § 5`).
2. *another provider adapter introduced* — **no**; the provider family stays `{assignment_facts}`,
   which `423 § 6` reds on if a second member appears.
3. *`scope_reaches` gains one-to-many or descendant expansion* — **no**; untouched.
4. *membership uniqueness relaxed* — **no**, and T6 asserts the opposite (§ 7.3).
5. *production beyond the `M=20, D=5` envelope* — **no**; not a production change.

⭐ **The reason worth writing down**: `D ≤ F` is a bound on the CANDIDATE FAN-OUT, and candidates
originate from `authz.assignment_facts` rows. Flipping a role's **state** adds no fact — it changes
which proposed candidates **CONFIRM**, not how many are proposed. So `F` is unchanged, `D ≤ F` is
undisturbed, and no coefficient is invalidated. ⚠ Trigger 1 remains the one that fires by
construction, at item 6, exactly as D1 pre-empts.

#### 10. Files, order, and what each test reds FIRST

1. `2026100300746x_ae5_staff_wrapper_cutover.sql` — the ONE migration: snapshot → create both
   wrappers → ACL statements → flip `staff` → assert-after. ⛔ One migration, because a wrapper
   created before the flip denies everyone (`holds_role` refuses a non-authoritative role) and a flip
   before the wrapper leaves a window where the catalog is authoritative with no single-role
   predicate. They are not separable.
2. `405` extended (§ 4.2b / § 4.3b) — **red first** by writing § 4.2b against the not-yet-created
   functions (it fails on absence), then green.
3. A new `426_ae5_staff_wrapper_differential.sql` — D2 part 2 + part 3. **Red first** by running it
   before the migration: the wrapper does not exist, so every cell errors; then red *again* in the
   useful sense by flipping one seeded `staff` membership's role and watching the restricted
   comparison disagree; then green.
4. `401 § 3.2`, `403 § 3.2c`, `411`, and any authoritative-count pin — **each observed red, then
   moved**, with `old → new` in the commit body.

**Rollback (T9, [PA-F9])**: ⛔ **never a committed migration** — a reviewed runbook entry plus an
out-of-chain SQL template in `docs/deployment/`. Shape: revalidate the four properties FIRST, then
`update authz.roles set state='test_validation' where code='staff'` (⛔ **not** `legacy` — the grants
stay and the differential must still see them), leave both wrappers in place (they simply return
false for a non-authoritative role, which is the correct behaviour for a rolled-back cutover), and
⛔ **delete no catalog data**. Code/database compatibility stated in both directions: no application
code calls the wrapper at T6, so rollback is DB-only.

#### 11. Testing note

The property that makes this cutover provable is **not** "the wrapper returns the right answer" —
it is that the **restricted** legacy predicate and the wrapper agree on every seeded principal ×
commission, with the restriction stated and the unrestricted comparison shown to disagree. ⛔ A
differential that compared `is_member_of_for` (unrestricted) to the wrapper would report every
`staff_admin`-only membership as a divergence and would be "fixed" by loosening the expected value —
which is how a set predicate gets silently substituted for a single-role one. The three-part
obligation exists because each part is blind to what the others see (§ 7), and the cheapest way to
lose it is to run part 2 alone and call the suite green.

⛔ **I have written no SQL. Awaiting ack.**

#### 12. `387` — the query set, prepared read-only (the pin move itself is QUEUED behind the tester)

The md5 is `md5(string_agg(id::text, ',' order by id))` over `public.profiles` under
`test_helpers.claims_for(<uid>, false, '<role>')` + `set local role authenticated`. Re-derived today
read-only, in that exact shape, so the figures below are the suite's own and not an approximation.
⛔ The row counts in the test NAMES are RE-DERIVED, never carried over.

| test | § | persona | rows old → new | md5 old → new |
| --- | --- | --- | --- | --- |
| 5 | B1 | `hospitaladmin.a1` (hospital_admin) | 23 → **25** | `cded5a2d…fad8` → `67bfdf1f…8e0c` |
| 6 | B2 | `orgadmin.a` (org_admin) | 29 → **32** | `7954b320…6e81` → `aad18a56…a957` |
| 7 | B3 | platform_admin | 36 → **40** | `8890048e…ba24` → `783c2a1e…a36e` |
| 8 | B4 | `chefe.ccih` (staff_admin) | 10 → **12** | `17d08ead…ffd5` → `03904c72…d7d9` |
| 9 | B5 | `staff1.ccih` (staff) | 10 → **12** | `17d08ead…ffd5` → `03904c72…d7d9` |
| 10 | B6 | `orgadmin.b` (org_admin, other org) | 5 → **6** | `4acaab50…b33f` → `00e55169…bccf` |
| 19 | D1b | restore control for B1 | — | same pair as test 5 |

⭐ **EVERY DELTA RECONCILES TO A NAMED PERSONA, which is the check a bare md5 cannot give.**
B2 +3 and B3 +4 are the three Rede A gap personas and the Rede B one; B1 +2 is `gap.pending` and
`gap.deactivated`, visible to the hospital admin through their CCIH membership, while `gap.unpriv`
is not (org affiliation only, no hospital tier, no membership); B4/B5 +2 are the same two CCIH
members; B6 +1 is `gap.xorg.b`. ⛔ A pin whose new value I could not attribute to a persona would be
a pin I should not move. Full-length md5s are in the round-4 entry.
⚠ Tests 8 and 9 share a value (both read the CCIH set) and test 19 is test 5's restore control, so
three of the seven move as two pairs — a reviewer should expect four distinct values, not seven.

## T3 plan — generators MULTI-ROLE ⛔ NOT EXECUTED; awaiting the lead's ack

Read-only inspection of `scripts/gen-authz-differential-cells.py` (1218 lines) and
`scripts/gen-authz-matrix-cells.mjs` (1453 lines). ⛔ Nothing under `scripts/`, `supabase/` or
`src/` was edited this round.

**⚠ P0 SEQUENCING CORRECTION TO THE TASK LIST — T3 and T5 are ONE landing, not two.**
`gen-authz-matrix-cells.mjs` ARM C3 fuses `manifest.approvedSuites` ↔ `spec.subjectRoles` **in both
directions** (`:409-415`; the both-ways loops are `:414` and `:415`). So the moment T3 adds `staff` to `subjectRoles`, generation **fails**
unless `approvedSuites.staff` already exists. ARM C2 (`:428-435`, `nonLegacy − subjectRoles`, its diff at `:433-434`) reds
at **T4** the instant `staff` becomes `test_validation` without a subject-role entry, and ARM C1
(`:422-426`, `authoritative − approvedSuites`) reds at **T6**. ⇒ T3 must carry the
`approvedSuites.staff` skeleton (or T5 must land in the same commit), and the two design docs must
be PO-approved before that skeleton can name them.

**1. `supabase/tests/vectors/authz-matrix-axes.json`**
- `subjectRoles`: `["staff_admin"]` → `["staff","staff_admin"]`. `catalogRoles` is unchanged (it
  already lists 11 and ARM D binds it to the snapshot).
- `axes.role.values`: today `{"staff_admin": "the AE4 subject"}` → add `"staff"`, each value's text
  naming its increment.
- `axes.scope._source` currently says *"staff_admin is commission-scoped"* — re-word to the tier,
  not the role, since both subjects are commission-scoped.
- `constraintRules.scope_must_match_role_scope_kind` is worded for `staff_admin` alone; it must
  become tier-wide (`zero_scope` impossible for either).
- ⛔ **A `staff`-specific axis is OWED and its shape is a PO question** — see item 4.

**2. `scripts/gen-authz-differential-cells.py`**
- `:255` `assert len(subject_roles) == 1, 'AE4 substitutes exactly ONE role (ADR 0155 D7)'` — ⛔ do
  **not** simply delete it. Replace with a bound that still refuses something: assert
  `set(subject_roles) == set(approvedSuites keys)` (mirroring ARM C3 on this side) and that every
  subject role is **non-legacy** in the manifest snapshot. A deleted assertion is a detector
  retired without a replacement.
- `REPS` becomes `REPS_BY_ROLE: dict[str, list[(code, legacy_class, resolution_scope)]]`.
  `SUBJECT_ROLE` disappears; `build()` gains an outer loop over roles.
- **Derivation of `staff`'s REPS from the matrix — the rule, not a fixed list.** One rep per
  distinct legacy-equivalence class, where the class is the gate function and equivalence is
  `count(distinct comment-stripped prosrc)` measured at implementation time; the rep is a code
  `staff` **HOLDS** (the AE4.7c lesson at `:55-61` — a rep the subject does not hold makes every
  cell of its class a denial and arm2 is satisfied globally by the other reps). Candidate classes
  from the matrix: `is_member_of_for` (the 39-policy class) · `can_reach_meeting` ·
  `can_sign_meeting` · `_case_caps` · `can_read_action_item` · `can_read_event` · `can_read_capa` ·
  `can_read_referral_metadata`. ⛔ The count is **not** fixed here — it is re-derived from the
  catalog when the code is written.
- **Cell tuple** — append `role` as column **14**, ⛔ never insert it mid-tuple: `:627-631`'s own
  comment records that every arm and every self-test fixture addresses cells **by index**, so a
  mid-tuple insert is a whole-file mutation wearing a one-line diff. `cid` already carries the role
  (`:623-624`), so ids stay unique across roles with no change — including for the two codes both
  roles hold.
- **`CELL_AXIS_COL`** (`:711-712`) gains `'role': 14`, and `AXIS_DISPOSITION['role']` becomes
  `swept`. ⭐ **The `:702-703` comment becomes FALSE the day this lands** — it excuses `role` having
  no column *"because subjectRoles is asserted to hold exactly one value, so there is nothing for
  the arm to find"*. With two values the fallback `emitted = declared` makes arm7 a detector that
  cannot fire on the axis someone just added. The comment is rewritten in the same diff.
- **`_GRID`** (`:643`) becomes `sum(len(REPS_BY_ROLE[r]) for r in roles) * personas * contexts *
  scopes * states * 2 * reaches`; the census assert stays.
- **`expected()`** (`:259`, signature verified) gains the role parameter and its docstring stops hard-coding
  `staff_admin`. ⛔ The held-set stays **hand-encoded from the approved matrix** — never read from
  `authz.role_permissions`, or the suite proves the resolver equals a copy of itself.
- **`ARM3_GATE`** (`:185`) becomes per-role. `staff` has **no** `can_read_professional_profile`
  rep, so today's `arm8` (`:765`) and `arm9` (`:796`) both fire on it as written.

**3. Arms — three need re-predicating, and each re-predication owes a fixture**
- **arm5** (`:689`, the `if not any(...)` line) requires a GRANTED `resolution_scope='organization'` × `scope='sibling_commission'`
  cell. **Every `staff` code resolves at `commission`**, so arm5 has nothing to find for this role.
  ⇒ re-predicate on *the role's own resolution-scope set*: a role with an org-scoped code owes the
  ascent cell, a commission-only role does not. ⛔ **Run the arms PER ROLE, not over the union** —
  over the union arm2 (polarity), arm4 (self/third) and arm5 are all satisfiable by `staff_admin`
  alone, which is the masked-arm shape the REPS comment already records for arm2 at AE4.7c.
  ⚠ Re-predicating arm5 can invert `staff_admin`'s failure mode, so the same diff must show arm5
  still **fires for `staff_admin`**.
- **arm8** (`:765`) and **arm9** (`:796`) key on the single `ARM3_GATE`; both become per-role, with
  `staff`'s value derived from item 4 and `arm9` still resolving it against
  `permissions[<code>].legacyEquivalence.openArms` on every run. ⛔ arm9's binding to the manifest
  is preserved exactly — it is what makes the gate-scoped `caseReach` rule a measurement.
- **arm10** (`:806`, its header) is role-agnostic (it reads columns 12/13) and stays bound unchanged; the
  `expected_legacy_granted` column is where PA-F8-STAFF-1 lands if the PO rules (b).

**4. ⛔ `staff`'s arm-3 shape is a PO question, and it is bigger than `caseReach`**
The ⚠⚠ block (plan `:1229-1234`) requires a role whose door carries a non-permission arm no axis
varies to *derive the arm, give it a coordinate, label the cells, take a PO value per class*.
`staff` has **five** such arms, of five different mechanisms (matrix § 11 item 5): meeting
`visibility_policy`/attendee · signature attendance + `status='in_signature'` · case
`explicit_grants_only` · action-item `visibility_scope` · referral target-side `status <> 'draft'`.
`caseReach` is `can_read_professional_profile`-specific and does not fit any of them. Three options,
⛔ proposals only: **(a)** generalise `caseReach` into a per-role gate-arm axis whose value set is
per-role; **(a′)** add a `staff`-specific axis and keep `caseReach` as it is; **(b)** pick the
single closest analogue (row 9's `explicit_grants_only`) as `staff`'s ARM3_GATE and exclude the
other four with named reasons in `EXCLUSIONS`. **Recommendation: (a′)** — it leaves `caseReach`'s
arm9 binding untouched, and an exclusion under (b) would silently drop four live coordinates, which
is what arm7 exists to refuse.

**5. Self-test — LEARN-103 applied to the new arms**
The runner already asserts **which** arm fired. Every re-predicated or new arm gets its **own**
fixture, and each is confirmed to fire on its **own message**:
- **arm7/`role`**: drop every `staff` cell → arm7 must name `role`, ⛔ not `caseReach` and not
  `persona`. Until `CELL_AXIS_COL['role']` exists this fixture **cannot** fire, which is the proof
  the column is needed rather than an argument for it.
- **arm5 per-role**: (i) a `staff_admin` cell set with the ascent cell removed → arm5 fires naming
  `staff_admin`; (ii) an unmodified `staff` cell set → arm5 **silent**. Both halves, or the
  re-predication is a hole.
- **arm3 / arm8 / arm9 per-role**: the existing fixtures re-pointed at a named role, so a failure
  message says which role's REPS or gate is wrong.
- **arm1b / arm2 / arm4**: re-run per role; a fixture that removes a polarity from `staff` alone
  must fire, which under the union it would not.

**6. Regenerated artifacts** — `authz_differential_cells.psql`, `authz_matrix_cells.psql`,
`authz-matrix-coverage.json`, all by the generators, ⛔ never hand-edited (ADR 0200 `:243-244`).
`npm run lint:authz-vectors` green; the new cell total is an **output**, ⛔ not a target — it is
recorded after the run, never predicted here.

## Task list (increment 1) — relayed verbatim to each owner in its spawn prompt

Drafted 2026-09-13 by a planning subagent from the plan § AE5, ADRs 0193/0200/0201/0203/0207/0208
and the AE4 artefacts as they exist on `main @ a02487bc`; every file:line below was cited by that
brief and is re-verified by the owner before it is acted on (LEARN-099: a location is a
measurement). Plan-approval level per lead-playbook §3 in brackets.

**backend**
- **T1 — `staff` permission matrix** → `docs/design/authz-ae5-staff-permission-matrix.md` (new).
  All planes (plan `:836-852`): the `memberships` CHECK + scope-shape row (`20260720000000:43-68`,
  commission tier = `staff_admin` + `staff`); every policy and function body reaching `staff`;
  mutation doors branching on the role; session partition / landing route; E2E. Method: the name
  matched **UNANCHORED ONCE**, each hit classified (`:845-852`); `.manage` split at reversibility
  boundaries (`:864-870`); look first at `app.can_manage_professional`'s header comment (ADR 0201
  `:425-426`). Per arm: subject + hat requirement; per row: `definerSurface`. AC: every row cites its
  plane and a live-catalog query; zero name-keyed family classifications; a § 6A-style asymmetry
  statement for `staff`. Witness: sweep transcript with bare exit codes, measured on the LIVE catalog
  (LEARN-057). [full plan review] → **PO approval AFTER** (the oracle event, plan `:857-859`).
- **T2 — deny-class effect table** → `docs/design/authz-ae5-staff-deny-class-effects.md` (new); the
  `403` 9-row shape re-derived for `staff` over `authz-matrix-axes.json` `denyClasses`; `403:29-34`'s
  two approved limitations restated or refuted by measurement. [one-line + ack] → PO approves values.
- **T3 — generators MULTI-ROLE** → `scripts/gen-authz-differential-cells.py`,
  `scripts/gen-authz-matrix-cells.mjs`, `supabase/tests/vectors/authz-matrix-axes.json`,
  `authz_differential_cells.psql`, `authz_matrix_cells.psql`, `authz-matrix-coverage.json`.
  `gen-authz-differential-cells.py:255` asserts one subject role and `gen-authz-matrix-cells.mjs:414-426`
  fuses `approvedSuites` ↔ `subjectRoles` both ways with ARM C1 on `authoritative − approved`, so the
  value cannot be swapped: the generator ranges over `["staff","staff_admin"]`, per-role `REPS`
  (each a code `staff` HOLDS, `:52-80`'s AE4.7c lesson), and the `role` axis enters `CELL_AXIS_COL`
  (the `:702` comment becomes false the day this lands — arm7 gains the column). AC:
  `npm run lint:authz-vectors` green; self-test asserts WHICH arm fired (LEARN-103); `arm9` binds
  the swept gate set to `openArms`; `arm10` holds the 14th column. [full plan review]
- **T4 — seed migration** `staff` grants + `update authz.roles set state='test_validation'`
  (mirrors `20261003007160`); `test_validation` is REQUIRED — `candidate_has_permission` sees it
  (`20261003007250:334-335`), `has_permission` sees only `authoritative` (`:283`). Plus the fixture
  gaps T13 lists (`seed.sql:632-637`: pending + deactivated are committee-less). AC: reset clean; 11
  rows, one `authoritative` + one `test_validation`; `403 § 3.2b` (`:575-585`) RED and RECORDED, never
  re-pointed; `410 § 7.2` (`:730-739`) RED until T5. [one-line + ack]
- **T5 — manifest** `approvedSuites.staff` (matrix · denyClassEffects · differentialSuite) +
  `hardDenyClasses` re-measured on every row `staff`'s bundle touches (ADR 0203 D1 bound 2) +
  a `staff`-shaped `layer1Gate` per row (⛔ not `app.holds_role_via_is_staff_admin_of`); `.psql`
  regenerated, never hand-edited (ADR 0200 `:243-244`). AC: `410 §§ 7.1/7.2` green; `§§ 7.3/7.4`
  (`:741-751`) 1 → 2 after observed RED at 1; the 40 zeros stay a search horizon. [one-line + ack]
- **T6 — atomic cutover migration** (mirrors `20261003007200` + `20261003007210:79-101`): ⛔ after
  R-1/R-2. `create or replace` only; four properties snapshotted/asserted (`20261003007210:117-119`);
  `staff` → `authoritative` with the count-verified `do` block; direct-call census per site from the
  comment-stripped catalog (`20261003007200:92-94`); ⛔ *"NEVER `legacy OR new`"* (`:33`) proven by a
  pgTAP grep; `405` extended; `401 § 3.2`'s tripwire (`:147`) fires by design. [full plan review]
- **T7 — re-key** (mirrors `20261003007300` / `20261003007340`, with the `-- door-sweep-targets:`
  header): layer-3 `app.can_*` per code with the literal greppable; manifest rows `pending-rekey` →
  `re-keyed`, four fields populated; DEFINER writers DECLARED on `definerSurface` with
  `carriesCode:false`, re-keyed instead where the policy is unreachable (ADR 0193 D5 `:88`; plan
  `:1252-1254` N4); new/touched DEFINER = `search_path = ''` (ADR 0208 D4). AC: `410 § 8` both
  directions; T12 flips every policy door both polarities; `414`/`419`/`421` + gate 18. [full plan review]
- **T8 — census + G8 arms** (`p0-authz-invariant.sh`, `authz-setvalued-targeted-cases.sh`, `401`,
  `409`, the findings baseline via merge only): arms re-derived per plan `:1073-1079`, each shown able
  to red; ⚠ `409:19-22`'s control (a) is a `staff` READ-site control — re-stated, never inherited, if
  T7 moves those sites. [one-line + ack]
- **T9 — runbook** `docs/deployment/authz-rollback-runbook.md` + `authz-rollback-template.sql`: a
  `staff` worked example beside § 6.2–6.5, both revert shapes (§ 2a / § 2b); ⛔ never a committed
  migration ([PA-F9], plan `:1002-1010`). [one-line + ack]
- **T10 — seam slice** `docs/backend-state/authorization-and-audit.md`: TWO edits (append the slice;
  REPLACE `## Current state` + re-stamp); Open-edges `:66-67` updated for step 6 still owed; gate 16
  check I. [one-line + ack]

**tester**
- **T11 — `424_ae5_staff_differential_oracle.sql`** (new): `403:17-20`'s two assertions per cell over
  `authz.candidate_has_permission` (`403:3-9`); `case_reach` incl. `unreachable`; `arm3_divergence`;
  `expected_legacy_granted` for approved divergence ONLY; shown able to fail by flipping one seeded
  `role_permissions` row; no shared ids across cases (plan `:1146-1147`). [full plan review] →
  **PO value per divergence CLASS before** (plan `:1233`).
- **T12 — `425_ae5_staff_rekey_differential.sql`** (new): the `409` shape — grant present vs DELETED,
  both polarities, on WRITES, DEFINER non-flippers named as a countdown (`409 § 2.10c`); observed RED
  on the PRE-migration catalog (plan `:1051`). [full plan review]
- **T13 — E2E + fixture-gap report** (`e2e/**`): one spec per scope-kind that a freshly-granted
  `staff` lands (BUG-HAT-001 class, plan `:1092-1094`); the `staff` personas end to end; the written
  gap list handed to backend for T4 (tester never edits `seed.sql`). AC: `e2e:prod` green once.

**qa** — **T14** `docs/reviews/ae5-staff-review.md`: checks the three-deep clause is satisfied AS
DATA, no count quoted rather than re-derived, every PA-F8 divergence dispositioned (a)/(b)/(c).

**frontend** — no task unless T7 changes a query/action signature or a landing-branch outcome.

**Gate list (AC-10)** — the arms, never the scripts: `census` · `hat` · `floor` ·
`FROMFINDINGS=1 wrapper`; door sweep predicate arm + policy arm (one invocation, `ARM-DOMAIN
predicate=N/127 policy=M/226` quoted); deriver `SCOPE:` verbatim, exit bare; set-valued
`ARM-DOMAIN setvalued=`; `SELFTEST=1` on deriver + door harness with `PASS · FAIL · SKIPPED`, the three
`--- GROUP` lines and `bash --version`; `RESET_EVERY` — ⚠ measured 2026-09-13 on harness TEXT:
present in `c2-command-door-neutralizer.sh`, `p0-authz-door-audit.sh`, `p0-authz-writepath-audit.sh`;
**0** occurrences in `p0-authz-rowdoor-audit.sh` and `p0-authz-invoker-audit.sh` (port, then prove);
NOTICED = evidence; CARRIED = a step.

## Open rulings — PO, before AC-6

- **R-1 — `staff` has no single-role wrapper to cut over.** Measured (planning brief, migration
  text — the backend re-measures on the catalog at T1): `app.is_member_of` / `is_member_of_for` are
  `app.is_active(uid) and app.has_role_any('commission', …)` — *"membership = ANY role in the scope …
  (staff ∪ staff_admin ∪ any future commission role)"* (`20260720000100:66-68`, bodies `:91-102`);
  `authz.holds_role` takes ONE `p_role_code` (`20261003007210:79-101`); no `is_staff_of*` exists in
  `supabase/migrations`. **Recommendation (the planner's, marked MINE there; not measured):**
  introduce `app.is_commission_staff_of(_for)` as `staff`'s wrapper and cut IT over to `holds_role`;
  re-express `is_member_of` as a disjunction of two `holds_role` calls only once both commission
  roles are `authoritative`; carry the decision in an ADR (next free number measured **0211** on
  2026-09-13, re-measured at reserving). ⛔ A PO ruling, not a lead decision.
- **R-2 — cutting `is_member_of` over adds a HAT gate it lacks today.** `holds_role` applies the
  active-role filter on self-checks (`20261003007210:110-114`); `is_member_of` carries no
  `active_role` term. A behaviour change across the largest call population (provisional text
  counts: 83 `app.is_member_of(` in 53 files, 123 `_for(` in 59 — migration text, LEARN-057) = a
  PA-F8 divergence to be dispositioned (a)/(b)/(c) **before the matrix is approved** (plan
  `:942-950`). Planner's recommendation: (b), a named compatibility exception with owner + expiry.
- **R-3 — the matrix itself** (AC-1) and the deny-class values (AC-2), on T1/T2's delivery.
- **R-4 — gate 15's ceiling: 759 → 772 (+13) for T7's policy-called doors.** ⭐ **RULED 2026-09-14 (PO session): option (a) APPROVED — 759 → 772, `app` 326 → 339, `public` 433, exactly the 13 named doors, moved in the atomic re-key commit; verbatim text in the session-log entry "PO rulings on R-4 · R-5 (PO session)".** Opened 2026-09-14 at
  T6 as "`authenticated` EXECUTE on the two wrappers" — **that question is MOOT** (measured at the T7
  review: zero sites call the wrapper from a policy; the wrappers stay `service_role`-only).
  **FINAL FORM:** T7 creates 20 layer-3 doors, 13 policy-called (need `authenticated` EXECUTE), 7
  DEFINER-only; gate 15 (`check-budget-anchor.mjs`, anchor at
  `docs/backend-state/authorization-and-audit.md:178`) is at its ceiling 759 = 326 + 433, headroom 0;
  its merge rule says the ceiling moves only by PO ruling (AE4: 752 → 759 for 3 doors). ⛔ PO: (a)
  move the ceiling 759 → 772 with T7's gate record as the named justification, or (b) hold it and
  name which of the 13 doors T7 leaves un-re-keyed — note the budget counts DOORS: deferring the two
  largest codes drops 18 of 42 sites but only 2 of 13 doors.
- **R-5 — ADR 0211 D2 review.** ⭐ **RULED 2026-09-14 (PO session): ACCEPTED — ADR 0211 proposed → accepted; D3 `:185` amendment ordered (owed to the ADR owner, not applied by the PO session); verbatim text in the session-log entry "PO rulings on R-4 · R-5 (PO session)".** The D2 proof is in the record's T6 entry (2026-09-14): snapshot/assert
  of the four properties, the restricted differential `426` observed RED then GREEN, the
  PA-F8-STAFF-2 condition. ⛔ PO: accept ADR 0211 (proposed → accepted) or change it; AC-6 ticks on
  acceptance.

### 2026-09-13 — matrix review r1 received from the PO; lead evaluation; fix round routed (lead)

The PO supplied an external QA review of the T1 matrix at `a31ba31e` (eight findings: 2 blockers,
4 high, 2 minor). Filed verbatim with the lead's per-finding evaluation in
[ae5-staff-matrix-review-r1.md](../reviews/ae5-staff-matrix-review-r1.md). Every cited line was
`sed -n`-read and both named policies read from the live catalog before a finding was accepted.
Verdict: six confirm exactly (B1 `staff_admin` consequence over 7 of 18; H4 `securable_resources_select`
absent from row 16 — live qual `is_member_of OR is_tenancy_admin_of`; H5 the § 3.2 "15 functions"
heading and § 9.1's non-reproducing residue; H6 `responses.fill`'s incoherent interface; M7; M8);
H3 confirms in core (row 15's NULL-owner public arm is the vacuous shape) with rows 19/21 left to a
re-run census under one written criterion; B2 confirms against AC-1 with the *as data* home noted as
T5's manifest. ⚠ Found while evaluating M8: gate 13 resolves no links under `docs/design/`, so a
broken ADR link in a design doc reds nothing (`RETIRED_EXCLUDE_PATH_PREFIXES` names only
`docs/design/temp/`; the design directory is outside the link arms altogether) — noted for the
Record step, not fixed here. Disposition `CHANGES REQUESTED`; PO rules on nothing in § 11 until r2.
The § 11 package grows to seven items: item 4 over all 18 codes, a new item on the
`responses.fill` interface. Routed to `backend` as a fix round on the same agent context.

### 2026-09-13 — matrix r2 received; lead spot-checks; § 11 package (seven items) to the PO (lead)

Backend closed all eight r1 findings at `b5ff2552` (its entry above carries the queries). Lead
spot-checks on the committed file, each run bare: the `:7` link resolves (`ls`); § 3.0 sums BY
LISTING (`12 + 11 + 1 + 1 + 17 = 42`, the count an output of the four lists); the arm-3 column marks
exactly rows 1, 4, 6, 7, 8, 9, 11, 12, 15, 16, 19 (awk over the § 5.2 table); row 16 names
`securable_resources_select`; § 5.4 holds 69 site lines (71 table lines incl. header); § 11 has seven
items and no sentence reads as approved. Not re-derived by the lead: the H3 criterion's per-row
verdicts, the 28-of-40 preserved tenancy arms, the 69 hat readings — those are backend's
measurements and the PO's reading, and QA at T14 re-derives them. Disposition of r1: all eight
closed. The unit now waits on the PO's seven rulings in matrix § 11 plus R-1's wrapper; nothing from
T3 on may start before them (the matrix is the oracle).

### 2026-09-13 — PO APPROVAL of the matrix package (lead; scope written, not inferred)

The PO replied *"approved"* to the package presented at `b40c5236`: matrix § 11's seven items as
proposed, plus R-1 and R-2. ⭐ The scope is exactly what the package proposed — nothing the package
left as an open choice or an unproposed value is approved by this word:

| item | ruled | scope |
| --- | --- | --- |
| 1 | ✅ | the 20 held rows and codes of § 5.2 (rows 1–2, 4–9, 11–22), each with its `resource_kind` / `risk_class` / `sensitivity_ceiling` |
| 2 | ✅ | the split: `staff` holds a NEW `commission.cases.deliberation.read`; row 10 is not a narrower reach of `commission.cases.read` |
| 3 | ✅ | rows 3 and 10 are NOT held |
| 4 | ✅ | all 18 new codes GRANTED to `staff_admin` at T4 (42 → 60); the residual-arm alternative rejected |
| 5 | ✅ partial | the ELEVEN-coordinate set of § 5.3 (rows 1, 4, 6, 7, 8, 9, 11, 12, 15, 16, 19) and row 8's `in_signature` term as an arm-3 (a) coordinate as the census wrote it. ⛔ **NOT approved: the expected value per class** — § 5.3 proposed none, so backend PROPOSES them with T3's vector (legacy reading as the default, divergence in `expected_legacy_granted`) and the PO confirms them at T11's plan review |
| 6 | ✅ | PA-F8-STAFF-2 = (a), conditional on `memberships_one_commission_role_uq` and the two-value commission tier being ASSERTED in the cutover's pgTAP; PA-F8-STAFF-1 WITHDRAWN as a PA-F8 item under 7(A) and re-filed as a bug on the ownership path (its § 8.1 transcript unchanged) |
| 7 | ✅ (A) | rename to **`commission.responses.create`**; sites = `responses_insert_own` + the TS guard; the catalog says nothing about edit/submit, stated as a visible gap |
| R-1 | ✅ | introduce `app.is_commission_staff_of(_for)` as `staff`'s wrapper, cut IT over to `holds_role`; `is_member_of` re-expressed only when both commission roles are `authoritative`; carried in an ADR — number re-measured at approval: highest on any live ref is **0210** ⇒ **0211**; the ADR states how the cutover is proven given no `candidate_holds_role` exists |
| R-2 | ✅ | closed as (a) — refuted premise, unreachable residual |

⚠ **Not in the package, therefore not approved:** AC-2's deny-class expected VALUES
(`docs/design/authz-ae5-staff-deny-class-effects.md`, delivered PROVISIONAL at `a31ba31e`) — the
package named AC-2 only as "prior six" context. They are presented with T11's plan review, beside the
per-class arm-3 values. AC-1 ticks now; AC-2 does not.

Consequences released: T3 + T5 (one landing), T4 (seed with the rename and the 18 `staff_admin`
grants), ADR 0211, the bug filing for § 8.1; T11/T13 may start their read-only halves. Backend's T3
plan (posted 2026-09-13) is acked by the lead in the round-3 message.

### 2026-09-13 — tester's T13/T11 skeleton received; round 3 received; lead rulings L2–L5; gate 9 routed (lead)

**Tester delivered** (`ea732d91`, staged by the lead by path): `docs/testing/ae5-staff-fixture-gaps.md`
(§ 8 = T4's gap list) and `supabase/tests/424_ae5_staff_differential_oracle.sql` as a valid pgTAP
skeleton (`plan(1)`, one placeholder, `finish`, `rollback` — checked before staging so backend's
next `test:db` could not trip on it), its header carrying PROPOSED per-class arm-3 values. It
corrected a misreading (`multi@test.local` holds two Rede A memberships, not cross-org), found
`staff1.farm`/`staff2.farm` clean `other_commission_holder` candidates, and could not locate
`offboarded`'s mechanism (ADR 0163) nor verify rows 12/16/19's fixture population — routed to backend.

**Backend round 3 received**: `97e90f82` (T3+T5) · `562c184a` (T4) · `65605f76` (ADR 0211, the bug,
its entry). Cell totals as outputs: differential 2808 (1728 `staff_admin`, byte-identical to HEAD by
sorted diff; 1080 `staff`), matrix 4004, manifest rows 61. Self-test 23 fixtures each firing its
own arm, including `arm7 role value dropped` (unfireable before the column existed) and arm5's
quiet half. ADR number re-measured 0210 → **0211**.

**Lead rulings on what it handed back:**
- **L2 — the L1 axis's sweeper does NOT move to `425`; REJECTED.** Backend moved the eleven-term
  axis out of the resolver differential because `app.is_member_of_for` reads none of the terms, so
  cells would differ only in a column the predicate never reads. That is the wrong legacy side: ADR
  0175 D3's shape is that the differential's legacy column calls the REAL DOOR for an arm-3 row
  (*"403 calls the real door now"*), not the bare membership predicate. ⇒ the `staff` vector emits
  the axis cells for the eleven rows, and `424`'s legacy side calls each row's door
  (`can_reach_meeting`, `can_sign_meeting`, `_case_caps` S5, `can_read_action_item`, the policy
  quals for rows 1/4/15/16, `cast_case_vote`'s guard, `can_read_capa`) so the axis is CONSUMED. `425`
  keeps its own job (the grant-deletion flip). ⛔ A vector column no assertion reads is a keystone
  that cannot fail.
- **L3 — the observed-red count pins MAY move, each with old → new and the seed change that moved
  it, in one commit**: `401` § 3.2 / § 14.6 / § 14.7, `409` § 1.3 / § 5.5, `411` § 0b (the
  `role_manifest.psql` md5 — gate 19 goes green with it), `422` § 4.8. None is a behaviour finding;
  all were RED before the pin moves (backend's entry). Keeping a correct artifact and a red pin
  rather than reverting the artifact was the right call.
- **L4 — `403` § 3.2b re-clause ACCEPTED as proposed**: subject-scoped (no role appearing in
  `authz_differential_cells` is in `test_validation`) plus a new § 3.2c pinning the
  `test_validation` set BY NAME against `approvedSuites` minus this suite's subject. Backend applies
  it, observed RED first on the current tree, then green.
- **L5 — row 12's `HC0J0` is an ethics-DETAILS existence guard, not a status guard** (backend's
  measurement): matrix § 5.3 (backend) and `424`'s header (tester) both corrected; the fixture pair
  is a case with / without `ethics_case_details`. Row 19 has no fixture at all (`capa_plan` holds
  one `source = 'rca'` row) — added to the gap set; backend states where it wrote that.
- **Gate 9** reds because ADR 0211 (`proposed`) joined the proposed/draft/deferred set stamped in
  `docs/decisions/proposed-review.json` (`reviewed: null`, installed 2026-08-24). ⛔ Not discharged by
  appending 0211 to the list: the stamp's meaning is *"each listed ADR was re-read against what is
  built"* (ADR 0140). The first such review is run now by a read-only subagent over the nine, the
  lead stamps `reviewed` + the set on its report. ⚠ Backend's refusal to stamp was correct.
- Fixture-gap rows: seeded in their own commit with their own `test:db` (round 4).

### 2026-09-13 — gate 9 review discharged; tester's 424 built; round 4 received; routing (lead)

**Gate 9 (ADR 0140) — the first proposed-ADR review, run and stamped** (`1c1229ba`). A read-only
subagent re-read the nine against the code and the LIVE catalog; the lead re-read all nine status
lines (`sed -n`) and three catalog facts (`event_custody` + `case_referral` tables exist;
`compute_derived_measurement`, `appoint_technical_director`, `ensure_professional_participant`
exist; `is_commission_staff_of` does NOT) before editing. Six headers were stale and are corrected
with a dated marker that keeps the prior wording: 0022 → superseded by 0037 (0037 `:14`
`**Supersedes:**`); 0033 → superseded by 0072/0078 (its own generated back-pointer); 0031 (Phase 14a),
0058 (Phase 15), 0094 (W4 build state per its own Amendment 3), 0108 (ETH·E4 mint door live and
called from `src/lib/participants/actions.ts`) → accepted/implemented; 0160 → accepted, absorbed into
ADR 0155 as amended 2026-08-26. 0115 and 0211 stay `proposed`. Stamp: `reviewed: 2026-09-13`,
`proposed: [0115, 0211]`; `adr:index` rc 0; gate 9 exit **0**. ⚠ The classifier cannot tell a stale
design proposal from a `PROPOSED` correction memo (0160) — noted, no gate change proposed.

**Tester's `424` built, not run** (`ab13ca7f`): 21 assertions in `403`'s §§ 2–6 shape; door-calling
legacy side for rows 4, 6, 7, 9, 11-grant, 12; rows 8, 11-deny, 15, 16, 19 left UNDISPATCHED so an
emitted cell of those classes raises rather than passes (correct until fixtures exist); population
floors, never targets; its arm-3 `legacy_class` names flagged as proposals.

**Backend round 4 received** (`39d6e43d` · `ac8a3bf2` · `6ab207e0` · `47fbce12` · `8240b6eb` ·
`aef7d7f6` · `5f9d71f5` · `df37700e`; its entry holds the witnesses). L2 landed the right way round:
`REPS_STAFF` = the eleven carrying rows + `commission.responses.create`, each keyed on its DOOR,
the door declared in the manifest (`arm3Door`) and emitted as a `legacy_door` column; vector 9936 =
1728 `staff_admin` (byte-identical) + 8208 `staff`, arm-3 cells 5616 over 11 representatives (outputs);
arm12 binds reps ↔ manifest both ways; `memberGateArm` in `CELL_AXIS_COL`. The tester's six names
adopted verbatim, five more in the convention. L3 pins moved after observed RED (table in backend's
entry; `409` § 5.5 went green on its own — it was a named list, never a pin). L4 witnessed
red-then-green with § 3.2c proven able to fail. L5 applied. Fixtures seeded as four NEW personas
(`gap.*`) plus the resource rows — no existing persona repurposed. `offboarded` located
(`hospital_affiliations.ended_on` / `voided_at`, ADR 0163) but not constructible as a distinct cell.
⭐ **Defect caught: the T4 seed was functionally INERT** — 18 codes had no reflexive closure edge, so
`has_permission(chefe.ccih, …, 'commission.forms.read')` was false; found by `409` § 5.5's NAMED
list (a count arm would have read "18 more failures" and been bumped); repaired forward-only in
`20261003007450`. → a LESSONS candidate at the Record step: *a seed that inserts what the resolver
does not read is inert, and only a named-list assertion sees it.*
`npm run lint` **0** (gate 9 included), `typecheck` **0**, `test:db` **1** with exactly `387` (7, md5 +
stale row counts in test NAMES — hand-off) and `424` (aborts: missing `\ir` of the vectors file) red.

**Routing.** Tester: add the `\ir`, bind to `legacy_door` + the manifest names, dispatch rows 8 /
11-deny / 15 / 16 / 19 on the seeded fixtures, run `424` — it owns the stack for this round.
Backend (no resets; read-only DB): the T6 cutover PLAN under ADR 0211 for full review, and the
`387` re-derivation (names re-measured, pins observed RED first) queued behind the tester's run.

### 2026-09-13 — T6 plan reviewed: ACKED with four conditions (lead; full plan review)

Read in full at `cff43d89`. Sound on: ONE migration (a wrapper before the flip denies everyone, a
flip before the wrapper leaves a window); `search_path = ''` + schema-qualified body instead of
mirroring `is_staff_admin_of`'s frozen `app, public, pg_catalog` (ADR 0208 D4 — mirroring it would
grow the frozen set by two); ACLs stated explicitly, no PUBLIC entry (`is_member_of` carries a stray
`=X/postgres` its twin lacks); the snapshot/assert block re-purposed honestly as create-time
assertions with `proacl` as a sorted array; § 4.2b + § 4.3b positive control; D2's three-part proof
with the RESTRICTION to `staff` rows stated and the unrestricted comparison shown to disagree; D3's
five triggers argued (state flips add no `assignment_facts` row); rollback to `test_validation`,
never `legacy`, never a committed migration; every red named before it moves.

**Conditions (each a cell, not a sentence):**
- **A1 — the hat, both polarities.** `holds_role` and `has_role_any` both carry the active-role
  term on self-checks. The constructed differential (`426`) runs the SELF form under
  `active_role ∈ {staff, staff_admin, none}` and asserts agreement in each, and asserts the `_for`
  form is hat-blind under the same three; a check under one hat leaves the other polarity unproven.
- **A2 — principal state, by named cells.** State whether `authz.holds_role` evaluates
  `app.is_active` (or how the wrapper inherits the `is_active` conjunct `is_member_of` has). The
  differential population must include a `staff` member at each `principalState`
  (`suspenso.temp`, `gap.pending`, `gap.deactivated`, an active one) and assert agreement on those
  cells BY NAME — "every seeded principal" is not evidence the fixture reached the state.
- **A3 — the zero-caller authority.** If any conformance gate (`410`, a keystone) reds on a DEFINER
  authorizer with zero callers, the wrapper is allow-listed with owner `backend` + expiry `T7`,
  never silenced; if none does, say so with the query.
- **A4 — `403 § 3.2c`** re-clause = `approvedSuites − subject − authoritative`, observed RED first;
  `426` is backend-owned (tester owns `424`/`425`); migration number after `20261003007450`.

Backend writes the SQL now (migration, `405` § 4.2b/4.3b, `426`, ADR 0211 D2 aligned to A1/A2) but
⛔ runs nothing until the lead hands the stack back after the tester's `424` run.

### 2026-09-13 — INCIDENT: a written-but-unrun migration was applied by the tester's reset (lead)

**What happened.** The lead told backend to *write* T6's SQL and *run nothing* while the tester held
the stack. The tester's `supabase db reset --local` (exit 0) applied the UNTRACKED
`supabase/migrations/20261003007460_ae5_staff_wrapper_cutover.sql` — a reset applies every `.sql`
physically present in the directory, tracked or not — flipping `staff` to `authoritative` and
creating both wrappers, which breaks `424`'s precondition (`staff = test_validation`, the fact that
makes `candidate_has_permission` the oracle). ⭐ The tester noticed BEFORE running `test:db`, measured
the catalog, and stopped rather than adapting § 3.2b to tolerate `authoritative` — the correct call:
the differential runs before the cutover by template, never after.
**Cause: the lead's instruction.** "Write but do not run" is not a safe state for a migration file
in a shared checkout: the file IS the run the moment anyone resets. ⛔ Not backend's fault.
**Remedy.** Backend moved the migration and `426` to the session scratchpad (`t6-wip/`) and saved
its `405` edit as a patch; the lead restored `405` from HEAD (`git checkout --`, lead-only). The
tester resets again (the catalog still carries the applied migration until then) and runs `424`.
**Lesson candidate (LESSONS at the Record step):** *a migration file in the tree is live for every
session that resets, tracked or not; unrun SQL waits OUTSIDE `supabase/migrations/`.* Extends
`shared-local-stack-single-owner` ("db reset applies the directory you stand in") with: the
directory includes what git does not track.

### 2026-09-13 — `424` fix loop STOPPED at 4; the stuck cells are a FINDING, not a suite defect (lead)

**Loop.** Iterations 1→4 of `424`: 8 red → 2 → 2 (different cell) → 6. Stopped by the lead (CLAUDE.md
Loop Safety: iteration 3 fixed nothing new). Full `test:db` before the loop: `387` (7, the queued
re-pin) and `424` red only; `403` § 3.2b/3.2c GREEN. ⚠ The tester's iterations introduced CRLF into
`424` (`git diff` warns) — normalised to LF before any commit. Four `*.log` files in the repo root
are the tester's run logs, never committed, deleted at the Record step.

**Backend's ruling on the vector (owner of its PROPOSED values), measured:**
1. `foreign_org_commission` for `cross_org_actor` is the commission the persona HOLDS `staff` in
   (`HOLDS_AT['cross_org_actor']`, `gen-authz-differential-cells.py:374`; axes `:39`) = Farmácia B
   `c0000000-…-c2` for `gap.xorg.b`. The tester's fixture pointed at a Rede A commission — a fixture
   defect, the vector is right. `candidate_has_permission(gap.xorg.b, …, 'commission.accreditation.read')`
   = true at Farmácia B, false at CCIH — which also explains the § 5.1 `other_role`/`third_party` red.
2. ⛔⛔ **FINDING (PO): `app.is_active` gates the MEMBERSHIP arm and nothing else.** Every limb-(b)
   role-free disjunct lacks it: `accreditation_frameworks_select`'s `owner_commission_id IS NULL`,
   `can_access_targeted_version`, `is_document_approver_of`, `action_items_select`'s assignee leg,
   `profiles_select_self_or_admin`'s self leg. Behavioural proof as `gap.deactivated`
   (`app.is_active` = false): reads the NULL-owner framework and its own profile row. ⇒ a deactivated
   or suspended principal still reads global frameworks, own profile/membership rows, targeted form
   versions, documents they are approver-of-record on, action items assigned to them. Filed as a bug
   (backend); the fix is NOT this unit's (a behaviour change across five policies).
3. Encoding: the catalog is RIGHT to deny those cells; the legacy door grants for a reason the
   catalog has no mechanism for ⇒ `expected_legacy_granted` false → **true** with an
   `arm3:divergent-approved:<class>` label (arm10(c) refuses an unattributed flip), ⛔ never
   `expected_granted`. **990 cells** = 198 of each row's 216 `disjunct_present` cells × the five
   limb-(b) rows (`accreditation.read`, `roster.read`, `forms.read`, `documents.read`,
   `action_items.read`); the 18 untouched per row are where the catalog already grants. ⛔ Regenerated
   only after the PO rules — this is item P1 of the checkpoint.

**Routing.** Tester: re-aim the fixture per (1) — ONE more iteration, allowed because the cause is
measured; after it the ONLY disagreements may be the 990 limb-(b) cells (the witness that the suite
is right and the vector awaits the PO); anything else is the tester's. Backend: file the bug. Then
the PO checkpoint: P1 the divergence encoding (PA-F8 disposition (b), named exception, owner backend,
expiry = the bug's fix unit) · P2 the per-class arm-3 values (`424` header, backend-reconciled) ·
P3 AC-2's nine deny-class values — incl. row 5 `pending` → GRANTED (`is_active` never reads
`email_confirmed_at`), a second finding to name.

### 2026-09-13 — joint diagnosis of `424`'s iteration-4 cells; bugs filed; the checkpoint's shape (lead)

Tester's iteration 4 (`ca59d464`, LF-normalised, fixture at Farmácia B since iteration 1): § 4.1/4.1b
red on ~560 cells, tabled by class in `424` § 4. Backend ruled per class from the vector parse + live
selects (its entry has the queries):
- **(a) VECTOR, new — `conjunct_unmet`, 144 cells on 8 rows** (`action_items.read`, `capa.read`,
  `cases.deliberation.read`, `cases.vote`, `meetings.cases.shell.read`, `meetings.minutes.sign`,
  `meetings.read`, `roster.read`; 18 each): the vector sets `expected_legacy_granted = expected_granted`
  there, but `conjunct_unmet` MEANS the door's further conjunct is false, so legacy DENIES where the
  catalog GRANTS — the opposite direction from limb (b), missed by backend's own ruling; needs its
  own label family (`arm3:divergent-approved:` is wrong: legacy is narrower) and an
  `expected_legacy()` branch. ⛔ Not the tester's dispatch. → checkpoint item P2.
- **(a) VECTOR, confirmed — row 15 `disjunct_present`, 198 cells**; the 990 accounting RESTATED:
  990 is the vector rows owed the label, not cells that flip — only row 15's disjunct is
  persona-independent; rows 4/11/16 fire only for named principals (4 · 3 · document approvers),
  row 1 for none. → P1.
- **(c) FIXTURE, backend's — `forms.read` limb (b) is UNCONSTRUCTIBLE today**: zero targeted-version
  participants exist; backend declared the coordinate and seeded no row. Needs a
  `responses.target_case_participant_id` chain reaching a CCIH form version.
- **(b) SUITE, tester's — `roster.read` (214), `documents.read` (66), `action_items.read` (26),
  `accreditation.read` × `none`/`disjunct_absent` (12)**: the dispatch must pass the published
  `arm3Door` argument shape — row 4 `$1` = the caller's own profile id at `disjunct_present`, a
  different profile elsewhere; row 16 `$3` = the caller and a document whose approver IS the persona;
  row 11 `none`/`conjunct_met` selects the pre-existing committee-scope item; row 15
  `disjunct_absent` selects the CCIH-owned framework, not the foreign-owned one.

**Bugs filed** (`5d7f32c0`): `BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS` (critical, not
catastrophic — wrong authz answer, no PHI, no cross-tenant read; fix = its own unit
`AE5-INACTIVE-DISJUNCT-GUARD` after this gate; `424` OBSERVES it, nothing GATES it) and
`BUG-AE5-STAFF-PENDING-ACCOUNT-HAS-FULL-MEMBER-REACH` (medium; the vector is right, the product
question stands). BUGS.md header sum re-derived 167, gate 13 agrees.

**Routing.** Tester: the four (b) classes, no run. Backend: the row-1 fixture chain (owns the stack;
one reset; commit), then holds. PO checkpoint P1 · P2 · P3 (next lead message). On the ruling:
backend applies P1+P2 to the generator, regenerates (`t6-wip/P1-vector-change.md` is the prepared
command; `staff_admin` 1728 stays byte-identical), tester runs `424` to green + the able-to-fail
witness; then the stack goes to backend for the T6 red-first sequence and the `387` re-pin.

### 2026-09-13 — row-1 fixture landed; L6 (`410` §§ 6.2/6.3) and L7 (`conjunct_unmet` label) ruled (lead)

Backend's row-1 fixture (`f2dd7d00`): `gap.unpriv` reaches form version `50000000-…-a001` through
`can_access_targeted_version` (true) while `is_member_of_for` is false and memberships = 0; the
control (`staff4.ccih` → false) shows the walk is principal-keyed. Class-2, not PHI. Tester's four
dispatch fixes committed at `a9bbeadf` (row 11's fix went beyond backend's diagnosis: the committee
leg is a bare `is_member_of` and was missing from the self-mode claims list — flagged as the
tester's own, correctly).

**L6 — `410` §§ 6.2/6.3 red since `a8443ab9` (T5's `hardDenyClasses`): option (b), NOT (c).**
§ 6.2 derives each row's reachable deny classes from `enforcementSites` + `domainAuthorizer` (empty
on the 20 `pending-rekey` rows) while T5 measured from `armInterface` — two instruments, two
fields, one claim. Backend recommended (c): keep the values under a non-`measured-` provenance so
the gate stays green. ⛔ Rejected: a value the gate cannot reproduce is a hand-list wearing a label
(the `verified-facts baseline` lesson); the manifest's `armInterface` IS the seat of enforcement
declaration for a pending-rekey row (ADR 0200/0201 data), so the gate reads it. Ruling: extend
§ 6.2's roots to `armInterface` (union with the two existing roots, so re-keyed rows are unchanged),
observed RED first on the current tree, with a DISCRIMINATION half — a planted wrong class on one
`staff` row must red § 6.2, and a planted extra `armInterface` site reaching `is_case_excluded` must
add `recusal_exclusion` — and § 6.3's "exactly 3" re-derived from what the extended instrument
finds, old → new. The `measured-` provenance then means what it says.
**L7 — `conjunct_unmet` label: `arm3:divergent-narrower:door-conjunct-unmet` accepted as the
proposed string** (a new family because both existing families mean "the door grants"; arm10 gains
sub-check (d)); applied only on the PO's P2 ruling, together with P1; combined flip count must read
exactly 1218 = 84 + 990 + 144 as an OUTPUT.
**`387`**: now 9 reds (tests 12/15 join: `responses` 13 → 14) — all in the queued re-pin.

Routing: backend (owns the stack) — L6 now, then the `387` re-pin (9 tests, old → new, observed
red); the PO's P1/P2 ruling gates the vector regeneration. Tester — wire row 1's dispatch to the
new fixture ids (edit only). Then, on the ruling: regenerate → tester runs `424` → T6.

### 2026-09-13 — backend: L6 applied (`410` § 6.2 roots from `armInterface`) + the `387` re-pin

**Shape of the change, as acked.** § 6.2's roots become `enforcementSites` ∪ `domainAuthorizer` ∪
`armInterface`; re-keyed rows are unchanged because they carry no `armInterface`, so the union
contributes nothing to them and the three original rows keep their exact derivation — which is what
makes § 6.3's move a POPULATION change and not a semantic one.

**⛔ THE CHANGE HAD A SECOND HALF THAT WAS NOT IN THE RULING, AND IT WAS THE BLOCKING ONE.**
`armInterface` was **not emitted into the generated `.psql` at all** (`grep -c` on
`authz_enforcement_manifest.psql` = 0), and `410` reads that fixture, never the JSON. So the ruling
as written could not be implemented in `410` alone: `scripts/gen-authz-matrix-cells.mjs` had to emit
it first. It now emits `authz_manifest_arm_sites` — 69 sites over 20 rows, 42 `policy` / 24
`function` / 2 `registry` / 1 `ts` — as a **separate table**, deliberately: `authz_manifest_sites`
holds RE-KEYED sites carrying `composed_with`, and §§ 3.6 / 8 pin cardinalities on it, so merging
would have moved counts in other sections to make one arm work. Site strings are DISPLAY names
(`app.can_read_capa — the indicator-sourced arm`), so the note is cut in the generator, where the
string is still structured, rather than in SQL. `ts` sites resolve to the empty root: defence in
depth, never a DB gate, so they contribute no root rather than an unresolvable one.

**Observed RED first, on the current tree** (`410`, before any edit):
- test 28 (§ 6.2) — `have: commission.accreditation.read: (none) | commission.action_items.read:
  (none) | …` against `want: commission.accreditation.read:
  principal_inactive,respondent_exclusion | commission.action_items.read:
  principal_inactive,recusal_exclusion,respondent_exclusion | …`
- test 31 (§ 6.3) — the cardinality control's `= 3`, against an actual 23.

**§ 6.3 re-derived from the extended instrument: 3 → 23**, and it decomposes exactly — 3 re-keyed
(via `authz_manifest_sites`) + 20 pending-rekey (via `authz_manifest_arm_sites`), **disjoint**
(`measured AND armInterface` = 20, `measured AND enforcementSites` = 3, total measured = 23).
⭐ Its non-emptiness conjunct now names the NEW domain as well. That domain supplies 20 of the 23
rows, and the control existed to catch a domain going empty — left naming only the re-keyed table it
would have stayed green on the old one while the new one emptied out.

**Discrimination half, both plants applied and rolled back** (the manifest JSON is byte-identical
after; only the `.psql` carries the legitimate addition):
- **WANT side** — `commission.forms.read` `hardDenyClasses` += `recusal_exclusion`. § 6.2 red,
  naming the row: `have: commission.forms.read: principal_inactive` vs
  `want: commission.forms.read: principal_inactive,recusal_exclusion`.
- **HAVE side, the load-bearing plant** — an extra `armInterface` site `app.can_read_action_item`
  on `commission.indicators.read`, a row without `recusal_exclusion`. § 6.2 red **by ADDING**:
  `have: commission.indicators.read: principal_inactive,recusal_exclusion,respondent_exclusion` vs
  `want: … principal_inactive`. ⛔ This is the only one of the two that proves the new union is
  LIVE: the WANT-side plant would red identically on the pre-L6 tree, so on its own it says nothing
  about L6. (It added `respondent_exclusion` too — `can_read_action_item` reaches both gates — which
  strengthens rather than muddies the witness; the specified class is present.)

`410` **44/44 green**. Gate 12 (`lint:authz-vectors`) green. `test:db` bare: **only `387` (9) and
`424` (2)** — the permitted set; `424` has come down from 8 as the tester works it.
Commit **`33fbfbca`**.

**The `387` re-pin — 9 tests, one commit, `aa95c723`.** Observed red first; all six md5s matched the
values I had tabled read-only in round 12, and the row counts in the test NAMES were **re-derived
live**, not carried over (25 / 32 / 40 / 12 / 12 / 6, total `profiles` = 40, so B3's "36 rows = all"
became "40 rows = all" on a measured total).

| test | § | persona / row | old → new | attributed to |
| --- | --- | --- | --- | --- |
| 5 | B1 | `hospitaladmin.a1` (hospital_admin) | 23 → 25 | `gap.pending`, `gap.deactivated` |
| 6 | B2 | `orgadmin.a` (org_admin) | 29 → 32 | the three Rede A gap personas |
| 7 | B3 | platform_admin (all rows) | 36 → 40 | all four gap personas |
| 8 | B4 | `chefe.ccih` (staff_admin) | 10 → 12 | the two CCIH members |
| 9 | B5 | `staff1.ccih` (staff) | 10 → 12 | the same two (shares B4's value) |
| 10 | B6 | `orgadmin.b` (org_admin, Rede B) | 5 → 6 | `gap.xorg.b` |
| 12 | B8 | `responses`, staff_admin's read | 7 → 8 | the row-1 targeted-version response |
| 15 | B11 | the RLS-bypassed totals | 13 → 14 | the same one response |
| 19 | D1b | restore control for B1 | — | moves WITH test 5, by construction |

⭐ **B8's assertion is the DIFFERENTIAL, not the count**: 7<13 became 8<14, so the gap SURVIVED the
fixture. Had the new response been visible to everyone, the count would have moved without the gap
moving — that is the case the re-pin had to rule out, and it is why B11 re-measured all four totals
(`case_events` 1, `answers` 50, `case_referral` 4 all unchanged; only `responses` moved), making the
fixture attributable to one table instead of assumed.
⚠ `gap.unpriv` is in B2/B3 but **NOT** in B1 — org affiliation only, no hospital tier and no
membership, so the hospital admin's footprint never reaches it. That asymmetry is why the deltas are
listed per persona and not summed. Four distinct values, not nine.
⛔ **D1a (test 18) was re-pinned although it never went red.** It asserts `isnt(md5, <B1's pin>)`
under a deny-all probe, which a STALE literal still satisfies — for the wrong reason: it would be
proving the md5 differs from a value nothing produces any more, true whatever the probe does.
Leaving a green assertion behind a moved pin is how a vacuity control quietly stops controlling.
`387` **25/25 green**.

**Final full-suite confirmation, after both commits** (`npm run test:db` bare, no reset — the stack
was reset by the tester earlier and no peer session was active, checked on `pg_stat_activity` before
each run): **Files=273, Tests=9154**, and the ONLY red file is `424` (2 of 21, the tester's, down
from 8). `387` and `410` both report `ok`. `npm run lint` **exit 0** end to end — eslint at
`--max-warnings=0` plus gates 7, 9, 12, 13, 19 — so the hub's Blockers claim that gates 9 and 19
were red is stale and has been corrected there (`3a8fc883`), re-measured rather than recalled.

**Unchanged and still waiting**: P1 + P2 apply together only on the PO's word (combined flip count
must read exactly **1218** as an OUTPUT); the T6 files stay in `t6-wip/`; `424` is the tester's.

### 2026-09-14 — L6 + `387` re-pin received; hub ownership restated (lead)

Backend's L6 (`33fbfbca`) needed a half the ruling did not name: `armInterface` was never emitted
into the generated `.psql`, and `410` reads the fixture, not the JSON — so the generator now emits
`authz_manifest_arm_sites` (69 sites over 20 rows) as a SEPARATE table, because `authz_manifest_sites`
carries re-keyed sites with `composed_with` and §§ 3.6/8 pin cardinalities on it. § 6.2 observed
red (test 28 `(none)` vs the measured classes; test 31 `= 3` vs 23), then `410` 44/44. Both
discrimination halves witnessed and rolled back (manifest byte-identical after): a WANT-side plant
reds by naming; a HAVE-side plant (`can_read_action_item` on `indicators.read`) reds by ADDING —
⭐ only the second proves the union is live. § 6.3 3 → 23 = 3 re-keyed + 20 pending, disjoint, and
its non-emptiness conjunct now names the new domain. `387` re-pin (`aa95c723`): 9 tests, each
delta attributed to a persona/row; D1a re-pinned though it never went red (an `isnt` a stale literal
satisfies for the wrong reason). `npm run lint` exit 0; `test:db` red on `424` only.
**Ownership:** backend also edited the hub (`3a8fc883`, Blockers) — the correction was right and
stands, replaced cleanly by the lead now; the hub is the lead's file and backend is told so.
**Waiting on the PO:** P1 · P2 · P3.

### 2026-09-14 — PO rulings on P1 · P2 · P3 (PO session)

The PO was presented each decision with its evidence (record § "`424` fix loop STOPPED at 4",
§ "joint diagnosis", § "row-1 fixture landed; L6 … L7 ruled"; matrix § 5.3 / § 8.1 / § 11; the
deny-class table § 1; `BUGS.md` rows `BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS` and
`BUG-AE5-STAFF-PENDING-ACCOUNT-HAS-FULL-MEMBER-REACH`; `424` § 4's per-class ruling table; the
prepared `t6-wip/P1-vector-change.md` + `P2-conjunct-unmet.md`), with the schema facts re-verified
on the live catalog in this session: `app.is_active` reads only `is_active` and `suspended_until`;
`app.is_member_of` = `app.is_active(auth.uid()) and app.has_role_any('commission', …)`;
`accreditation_frameworks_select` = `(owner_commission_id IS NULL) OR app.is_member_of(owner_commission_id)`;
`meetings_select` = `app.is_member_of(commission_id) AND (visibility_policy = 'commission_default' OR EXISTS (… meeting_attendees …))`;
`app.has_role_any` carries `(p_user_id is distinct from auth.uid() or m.role is not distinct from app.active_role())`;
`authz.roles.staff` = `test_validation`, `staff_admin` = `authoritative`; `app` `nspacl` =
`{postgres=UC/postgres,authenticated=U/postgres,service_role=U/postgres}`.

**The PO's ruling, verbatim:** "P1 accept the exception, P2 intended composition, P3 pending GRANTED"

Read against the three recommendations as presented:
- **P1 — RULED: the exception is accepted.** The inactive-principal divergence is encoded as an
  approved legacy divergence: `expected_legacy_granted = true` under the label
  `arm3:divergent-approved:role-free-disjunct-ignores-principal-state`, ⛔ never in `expected_granted`
  (the catalog's DENY stands). PA-F8 disposition (b): a named compatibility exception, owner backend,
  expiry = the fix unit `AE5-INACTIVE-DISJUNCT-GUARD` after this increment's gate, citing
  `BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS`. The fix is NOT pulled forward.
- **P2 — RULED: the intended composition.** The door-conjunct-unmet class (legacy narrower, 144 cells
  on 8 rows) is permission AND resource conjunct, labelled `arm3:divergent-narrower:door-conjunct-unmet`
  (L7's string) with `expected_legacy_granted = false` / `expected_granted = true`; not a defect, no
  bug. No conjunct is promoted to a catalog axis value in this ruling (matrix § 11 item 5's
  `in_signature` alternative stays unexercised).
- **P3 — RULED: `pending` → GRANTED** as the oracle's expected value for deny-class row 5; the
  product question stays open in `BUG-AE5-STAFF-PENDING-ACCOUNT-HAS-FULL-MEMBER-REACH`. The other
  eight values of the deny-class table § 1 were presented with it and not contested: base GRANTED;
  `wrong_scope`, `cross_org`, `inactive`, `suspended`, wrong-hat SELF, `unauthenticated` DENIED;
  wrong-hat THIRD-PARTY GRANTED (ADR 0201 D1).

ADR 0211 D2 was put in front of the PO as readable now; its review stays at the T6 gate.

**Next (lead applies):** backend applies P1 + P2 to the generator per the prepared hunks and
regenerates (expected: 9936 cells, `staff_admin` 1728 byte-identical, flips = 1218 = 84 + 990 + 144,
`--self-test` arm10 fixtures 4 caught); tester runs `424` to green + the able-to-fail witness; then
T6. Recorded by the PO session; nothing else in the repo touched.

### 2026-09-14 — backend: P1 + P2 applied to the vector (PO ruling), `847f439c`

Applied from the prepared `t6-wip/P1-vector-change.md` + `P2-conjunct-unmet.md` against the PO's
ruling entry above. Generator hunks only — the `.psql` was **regenerated, never hand-edited**.
⛔ No DB, no reset, no `test:db`; `424` and the stack untouched.

**P1** — label `arm3:divergent-approved:role-free-disjunct-ignores-principal-state`, added to the
`ARM3_DIVERGENT_APPROVED` tuple so `expected_legacy()` needs no second code path; vocabulary entry
cites `BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS` and names the expiry unit
`AE5-INACTIVE-DISJUNCT-GUARD`. **990 cells.** `expected_granted` moves by zero.

**P2** — label `arm3:divergent-narrower:door-conjunct-unmet` (L7's string), a **new family
prefix**, `ARM3_NARROWER_CONJUNCT_UNMET`; `expected_legacy()` gains its **first false-returning
branch**; arm10 gains sub-check **(d)** and (c) exempts the new family. **144 cells.**

Both branches sit **before** the `klass != ARM3_GATE` short-circuit — every `staff`
representative returns `arm3:not-in-gate` there, so a branch after it is unreachable and the labels
would have been declared and carried by zero cells, with only arm8's single-valued check noticing.

**⛔ TWO CORRECTIONS TO MY OWN PREPARED HUNKS, both found while applying:**
1. **P2's arm10(d) message would have broken the self-test runner.** I had written
   `'arm10(d): …'`; the runner computes `fired = {g.split(':', 1)[0] for g in got}`, so that
   string yields the arm name `arm10(d)`, `want` is `arm10`, and the fixture reports **WRONG ARM**
   — and the `next(g for g in got if g.startswith(want + ':'))` line then raises. Corrected to
   `'arm10: (d) …'`. ⚠ A new arm's message is not free-form: its prefix up to the first
   colon IS its identity to the runner.
2. **P2's arm10(d) fixture had to be SYNTHESISED, and the prepared note only half-said why.** Every
   real narrower-labelled cell expects a legacy DENY — `expected_legacy()` returns False for the
   label *unconditionally* — so there is no cell to select and a selection fixture would raise
   "no candidate", whereupon the obvious repair is to delete the fixture and disarm the only arm
   refusing a narrower label laundered into a GRANT. Written as `_synth_narrower()` beside
   `_synth_defect()`.

**Readings, as OUTPUTS rather than targets** — every one measured from the regenerated artifact:

| reading | value | note |
| --- | ---: | --- |
| total cells | **9936** | unchanged; both are LABEL changes, so a different total would mean a branch changed the loop |
| `staff_admin` rows | **1728, byte-identical** | sorted diff **and** plain diff both exit 0 — both predicates key on `gate`, inert for every staff_admin cell |
| flips vs `expected_granted` | **1218** | = 84 + 990 + 144, exactly as predicted; no explanation owed |
| arm3 census | 990 / 144 | printed in the `.psql` header, per label |
| `--self-test` | **27 caught** (was 26) | all FOUR arm10 fixtures caught **by name**, incl. the new (d); plus the `arm5` quiet control, the axis property, and `clean on the real spec` |
| gate 12 · `npm run lint` | **exit 0 · exit 0** | read bare, not through a pipe |

⭐ **P3 needed no vector change, and I checked rather than assumed.** `expectedSource` already
emits `deny-class:pending-is-granted`, so the oracle's expected value for deny-class row 5 was
GRANTED before the ruling; the PO's P3 confirms the value the vector already carried rather than
moving it. The open product question stays in
`BUG-AE5-STAFF-PENDING-ACCOUNT-HAS-FULL-MEMBER-REACH`.

Next: tester runs `424` (green + the able-to-fail witness), then T6.

### 2026-09-14 — L8: the P1 flip becomes persona-aware; `action_items` limb (b) gets a fixture (lead)

Backend's diagnosis of the post-ruling residual (its entry has the join query): the P1 flip
predicate `gate == 'disjunct_present' and not exp` consulted neither `persona` nor `selfcheck`, so
it flipped all 198 `disjunct_present` cells on all five rows (990) — but a role-free disjunct fires
only where the fixture reaches the NAMED principal. Measured live: `accreditation.read` fires for
everyone (resource-keyed NULL owner) → 0 wrong; `forms.read` fires for `gap.unpriv` only → 118
wrong; `documents.read` for the two approvers → 114 wrong; `action_items.read` for NOBODY (no
`assignees_only` assignment exists for any persona) → 198 wrong AND the coordinate is unreachable
by the fixture; `roster.read`'s self leg fires on self-checks only → 0 wrong today but LATENT: the
0 passes only under the pre-fix dispatch, and 96 third-party cells go red once the tester's row-4
fix runs. ⭐ Two masks named: `forms`/`documents` cells that pass do so because limb 1 (`is_member_of`)
grants anyway — masked by a legitimately-open arm.
**L8 — RULED (lead):** the PO's P1 ruling is about the ENCODING (an approved exception where the
legacy door grants through a role-free disjunct); cells where legacy does not grant are not
divergent, so gating the flip on the door's own reach is faithful to the ruling, not a change of
it. Backend applies: `accreditation` unconditional; `forms` only `unprivileged`; `documents` only
the two approvers; `roster` only `selfcheck`; `action_items` after the seed gains an
`assignees_only` item assigned to a named persona (⛔ the coordinate is NOT undeclared — an
unreachable declared coordinate is the "fixture cannot reach the failing state" shape). The flip
count is re-read as an OUTPUT (the 1218 no longer holds; the arm3 census restates it). Backend takes
the stack for the seed; the tester's two dispatch fixes at `121648d0` stay; one authorized run after.

### 2026-09-14 — backend: L8 — P1's flip keyed on limb (b)'s declared reach (`08384d18`, `805cf65c`)

**The defect was mine and it was the one I had already been caught by once.** P1's first cut
flipped all 198 `disjunct_present` cells on all five rows — 990 — on the reading that limb
(b) is "role-free". It *is* role-free; only one of the five disjuncts is also **principal-free**.
Measured in `424` § 4.1b (`legacy IS DISTINCT FROM expected_legacy_granted`): **430 of the 990
denied**, every one reporting `legacy=false` against my `true`. ⛔ A cell where the legacy door
does not grant is not divergent, so the PO's P1 ruling — about how an approved divergence is
ENCODED — never reached it.

**Step 1 — the fixture (`08384d18`).** Row 11's two `assignees_only` items existed but set only
`action_items.assigned_to`, which is ONE of three disjuncts `app.can_read_action_item` evaluates
under that scope (`is_staff_admin_of_for` · `assigned_to = p_uid` · EXISTS over
`action_item_assignments`). ⚠ **The manifest's published `arm3Door.expression` declares only the
third**, so the differential evaluates only that one — and no assignment row existed for any
persona. A coordinate the matrix DECLARES that no fixture can build is the "green gate means the
fixture cannot reach the failing state" shape, one layer below where any arm could see it.
⚠ My own earlier "zero for all four personas" was measured on that third disjunct alone and read
as "the door cannot fire"; the door's OTHER disjuncts were live. Correcting the instrument did not
change the conclusion — the suite evaluates the declared expression — but the reason was
wrong as first written. Seeded `a5f40000-…-b1` (item …-a1 → `staff4.ccih`) and
…-b2 (item …-a2 → `ativo.registro`), bare `supabase db reset --local` exit 0, proven
read-only **in both directions**: subject_holder IS assigned on a1, is NOT on a2, and no other
persona is assigned on either. ⭐ The control is a second persona on a second item, not an absent
row — an absence proves only that nothing is there.

**Step 2 — the generator (`805cf65c`).** Limb (b)'s reach is now **manifest DATA**,
`arm3Door.reach` with `kind` ∈ {`unconditional`, `personas`, `selfcheck`}, never a persona list
in the python: "this disjunct fires only for these principals" is a claim about the fixture and the
approved matrix, and a claim a generator makes about itself is not a detector — the same lesson
L6 hit when `armInterface` lived only in the JSON. `limb_b_fires()` returns **None, not False**, for
an undeclared row, so *undeclared* stays distinguishable from *declared unreachable*.
**arm13** holds the cells to that declaration in two independently-firable halves: (a) a row
sweeping `disjunct_present` must declare a reach; (b) every P1-labelled cell must sit where the
reach says the disjunct can fire — the half that would have caught the first cut. Its fixture is
SYNTHESISED: the derivation now reads the same declaration the arm checks, so no real cell can be in
that state, which is exactly why the arm has to exist.

| reading (OUTPUT) | before | after |
| --- | ---: | ---: |
| P1-labelled cells | 990 | **498** |
|  accreditation.read — `($1 is null)`, unconditional | 198 | **198** |
|  forms.read — targeted-version chain, `unprivileged` only | 198 | **72** |
|  documents.read — the two approvers | 198 | **84** |
|  action_items.read — `subject_holder`, now seeded | 198 | **42** |
|  roster.read — self leg, `selfcheck` only (third_party 0) | 198 | **102** |
| flips vs `expected_granted` | 1218 | **726** = 84 + 498 + 144 |
| total cells | 9936 | **9936** |
| `staff_admin` rows | 1728 | **1728, byte-identical** (sorted AND plain diff exit 0) |
| `--self-test` | 27 caught | **28 caught**, arm13 caught BY NAME |

`lint:authz-vectors` **exit 0**, `npm run lint` **exit 0**, both read bare. ⚠ The manifest JSON
changed, so `authz_enforcement_manifest.psql` and `authz-matrix-coverage.json` were regenerated by
`gen-authz-matrix-cells.mjs` in the same commit — gate 12 red first on exactly that drift.

**⚠ Two things the next reader should not take as settled.** (1) `roster.read`'s cells pass
`424` today only under a dispatch § 4's table already marks *(b) suite — FIXED, not yet
re-run*; its green is not evidence either way. (2) The published `arm3Door.expression` for row 11 is
an INCOMPLETE transcription of the live door (two disjuncts missing). The reach I declared describes
the DECLARED limb, which is what the differential evaluates — but the declaration and the door
have drifted, and that is a separate finding, not fixed here.

Stack handed back. Next: the tester runs `424` once.

### 2026-09-14 — the authorized `424` run is RED again; the mechanism changes, not the iteration count (lead)

Tester's single authorized run on the persona-aware vector (`f5b12832`; log `424-authorized-run.log`):
§ 4.1 198 cells, § 4.1b 410 cells red. The shape: THIRD-PARTY probes fail across five rows
(`roster.read` — its row-4 fix exercised for the first time — and `accreditation.read`,
`action_items.read`, `documents.read`, `forms.read`) while self-check cells mostly pass; plus
`capa.read` `conjunct_unmet` for `subject_holder` on both keyings. The tester stopped after one run,
as instructed. **Loop accounting for the PO:** across the day `424` has had 4 + 2 + 1 iterations
under three vector states, every stop at its cap, every fix attributed; the vector was wrong twice
(L8; P2) and the suite's dispatch several times, and the drift follow-up
(`FUP-AE5-STAFF-ARM3DOOR-DECLARATION-DRIFTS-FROM-THE-LIVE-DOOR`) shows the declaration both sides
read from is itself partial.
**L9 — RULED (lead): stop transcribing doors twice.** The vector carries, per cell, the LEGACY
probe as executable SQL fully bound by the generator to backend's own fixture ids (the `a5f…` rows,
the `gap.*` personas, the hat claim for the cell's `activeContext`, the uid for its keying) and the
CATALOG probe likewise; `424`'s § 3/§ 4 collapse to `EXECUTE` + compare, authoring no door. The
legacy SQL is derived from the LIVE door text (`pg_policies.qual` / comment-stripped `prosrc`) with
parameters substituted, never from `arm3Door.expression` — which discharges the drift follow-up's
first arm by construction (the declaration becomes documentation of what was emitted, gated by
comparison). A self-test proves a planted wrong binding is caught by name. This is a template change
AE5 copies ten more times, which is why it is worth the rework now. Backend owns it (plan paragraph
first, then proceed — it mirrors no existing suite exactly); the tester re-cuts `424` to the loop
once the vector carries the probes; one authorized run after.

### 2026-09-14 — backend: L9 — the plan for executable `legacy_sql` / `catalog_sql` per cell

**The plan, in one paragraph.** Each cell gains two executable boolean SQL texts the suite runs
verbatim, so no one transcribes a door twice. A **policy** door becomes a per-cell boolean without
substituting a single column reference, by running the LIVE `pg_policies.qual` as a WHERE clause
over the pinned fixture row — `select exists(select 1 from <schema>.<relation> where id =
'<fixture id>'::uuid and (<live qual>))` — because the qual already names that table's columns,
so binding the ROW binds every column, and the only thing left free is `auth.uid()`; a **function**
door becomes `select <schema>.<fn>(<bound args>)` with its uuid args bound to fixture ids and its
`uid` arg bound to the cell's principal (the one door whose kind is `guard-expression` is snapshotted
from `prosrc` and wrapped the same way as a policy qual). ⛔ `auth.uid()` and the claims are
DELIBERATELY left unbound in the text: they are bound by the SESSION the probe establishes
(`test_helpers.claims_for(<uid>, false, <hat>)` for the cell's `activeContext`, the caller being the
principal on a self-check and `f.nobody` otherwise) — which is the only binding that can be
correct, because five of these doors contain a BARE `app.is_member_of(scope)` with no uid parameter
at all, and a bare `is_member_of` reads `auth.uid()` and can therefore only ever answer about the
querying session. That fact is already written into `424` § 3 and it is, I believe, the mechanism
behind this run's shape (third-party probes failing while self-checks pass); ⚠ it also means the
`self_check=false` coordinate has no meaning for the bare portion of those rows, and no binding
scheme can give it one — that is a vector-shape question, flagged here, not something
`legacy_sql` fixes. `principalState` stays where it is, applied by the probe as the `profiles`
mutation it already performs, because it is a property of the PRINCIPAL and not of the text.
`catalog_sql` is `select authz.candidate_has_permission('<principal>'::uuid, '<res>',
'<scope>'::uuid, '<code>')`, bound from the same three columns `424` derives today.
⛔⛔ **THE GENERATOR MUST NOT READ THE CATALOG ON EVERY RUN**: gate 12 runs it inside
`npm run lint`, which `410`'s own header makes binding — *it must never require Docker*. So the
live read happens in a new `--refresh-doors` mode (Docker required, never in lint) that pins what it
read into `supabase/tests/vectors/authz-door-snapshot.json` with a catalog fingerprint; normal
generation binds from that pin; and `424` gains a **comparison arm** that re-reads the live door and
reds on any difference from the pinned text — which is what makes the pin honest and what
discharges the first arm of `FUP-AE5-STAFF-ARM3DOOR-DECLARATION-DRIFTS-FROM-THE-LIVE-DOOR` (to be
said in its entry when it lands). `arm3Door.expression` then stops being the source of truth and
becomes documentation, gated by an arm comparing it to what was emitted. The per-coordinate FIXTURE
BINDING (which `a5f…` row each gate arm uses, and how each function's args bind) moves out of
`424`'s declare block and into the manifest beside `arm3Door.reach`, as `arm3Door.fixtures` — it
is the SEED author's fact, so it is mine to declare, and declaring it is what stops the tester
re-deriving it. `--self-test` gains two fixtures: a **planted wrong binding** (a cell's `legacy_sql`
rewritten to a different fixture id) caught BY NAME by an arm that re-derives the binding from the
declaration, and a **planted pin drift** (the snapshot's door text altered) caught by the comparison
arm rather than by the emitter.

⚠ **Scope, stated before I start rather than discovered halfway.** Eleven rows carry an
`arm3Door` (6 `policy-qual`, 4 `function`, 1 `guard-expression`); the other nine staff rows are bare
`is_member_of_for` and need no door text. The bulk of this landing is not the SQL assembly — it is
the per-gate-arm fixture binding table, and it is the same body of fact `424`'s declare block holds
today. I am transcribing it ONCE, from my own seed, into the manifest.

#### L9, measured before building: the mechanism should change, and the plan above is superseded

⛔ **STOPPED BEFORE THE GENERATOR WORK, for the lead's call.** L9 specifies the legacy text as
"`pg_policies.qual` / comment-stripped `prosrc`, **parameters substituted**", pinned at generation
time. I measured first, and the measurement says parameter substitution is the mechanism that
CAUSED the partial door — so building it faithfully would rebuild the defect in a new place.

**Witness (live, read-only).** Probing `form_versions` as `staff4.ccih` under its own claims:

| probe | the REAL door (RLS select) | the DECLARED limb (b) |
| --- | --- | --- |
| `gap.unpriv`, targeted version | **true** | true |
| `gap.unpriv`, no-chain version | false | false |
| **`staff4.ccih`, targeted version** | **true** | **false** |

The third row is the bug: RLS grants because `form_versions_select`'s `app.is_member_of(...)` limb
fires, while the declared expression — limb (b) alone — denies.

**The drift is WIDER than `FUP-AE5-STAFF-ARM3DOOR-DECLARATION-DRIFTS-FROM-THE-LIVE-DOOR` records**
(it names row 11's two missing arms). Measured on `pg_policies` today:
- **row 1 `forms.read`** — the declaration FUSES TWO LIVE POLICIES into one expression
  (`form_versions_select` **and** `form_versions_select_targeted`) and drops
  `app.is_tenancy_admin_of`. Two permissive SELECT policies are OR'd by Postgres; one hand-written
  expression cannot be either of them.
- **row 4 `roster.read`** — `profiles_select_self_or_admin` has **six** disjuncts live; the
  declaration keeps **two**. The four it drops include `can_administer_person_via_affiliation`,
  a tenancy-admin arm and two hospital-admin arms.
- row 11 `action_items.read` — as filed. Rows 15/16 and `meeting_cases_select` match live.

**The revised mechanism, and why it is strictly better.** Do not transcribe the qual at all. For a
policy door the cell's `legacy_sql` is `select exists(select 1 from <relation> where <id col> =
'<fixture id>'::uuid)`, executed under `set local role authenticated` with the cell's claims: **RLS
then evaluates the real policy set itself** — every permissive SELECT policy OR'd, every
restrictive one AND'd, every disjunct present, `auth.uid()` bound by the session. For a function
door it is `select <schema>.<fn>(<bound args>)`, which is likewise the live object. ⭐ Three
consequences: (1) transcription drift becomes structurally impossible rather than gated — there
is no second copy to drift; (2) the `--refresh-doors` mode, the pinned door snapshot and its
comparison arm all become UNNECESSARY, which also removes the problem that `npm run lint` must never
require Docker; (3) `arm3Door.expression` is left as documentation, and the arm that compares it to
`pg_policies.qual` still discharges the follow-up's first arm — it just no longer has anything
load-bearing hanging off it. ⚠ One precondition it introduces: `exists()` is false both for an
invisible row and for an absent one, so each cell must carry its fixture id and `424` must assert
RLS-bypassed presence — cheap, and it is a control the current design lacks entirely.

**⚠ What I did NOT do, and why it is the lead's call.** This contradicts an explicit mechanism
instruction, on the oracle's core, so I did not build it. The remaining bulk either way is the
per-gate-arm FIXTURE BINDING table (11 rows × up to 5 arms), which today lives in `424`'s
dispatch together with two rules that are themselves unrun and contested — the CCIH-anchored
SCOPE FALLBACK, and the re-binding of claims to `v_principal` for the five bare-`is_member_of`
classes (that second one is the structural reason third-party probes fail, and no `legacy_sql`
scheme removes it: a bare `is_member_of` reads `auth.uid()` and cannot be asked about a subject who
is not the caller). Moving that table into the manifest is right and it is mine to author — but
it should be authored ONCE, against whichever mechanism is ruled, not twice.

### 2026-09-14 — L9 revised on backend's measurement (L9′); L10 the keying axis for caller-only rows (lead)

Backend stopped before building L9 (`8b94bd29` plan, `c5b79a8b` finding) on a live probe: for
`staff4.ccih` × the targeted `form_versions` row the REAL door (RLS select) answers true while the
declared limb answers false — RLS grants through `form_versions_select`'s `is_member_of` limb, which
the declaration lacks. Substituting parameters into a transcribed expression is HOW the door became
partial, so L9 as written would rebuild the defect. Drift is wider than the follow-up records: row 1
fuses two live policies (`form_versions_select` + `form_versions_select_targeted`, OR'd by Postgres)
and drops `is_tenancy_admin_of`; row 4 keeps two of six disjuncts of `profiles_select_self_or_admin`.
**L9′ — RULED (lead): no transcription at all.** For a policy door the legacy probe is
`select exists(select 1 from <rel> where id = '<fixture>')` under `set local role authenticated` +
the cell's claims, so RLS evaluates the whole live policy set with `auth.uid()` session-bound;
function doors are called directly with the cell's bound args. Drift becomes structurally
impossible; `arm3Door.expression` stays documentation, and the comparison arm to `pg_policies.qual`
still discharges the drift follow-up's first arm. The per-gate-arm fixture binding table (11 rows ×
≤ 5 arms) is authored ONCE, by backend, as generator data (manifest / vector), not in `424`.
**L10 — RULED (lead): a caller-keyed door has no third-party question.** A policy (or a bare
`is_member_of` site) reads `auth.uid()` and cannot be asked about a subject who is not the caller,
so `self_check = false` has no meaning there — that is ADR 0201 D3's subject declaration applied
(matrix § 5.4 already carries subject per site). Encoding: the vector emits `keying` per row from
§ 5.4 — `third-party-capable` (a `p_uid` door: third-party cells evaluate via that form, hat ignored,
ADR 0201 D1) or `caller-only` (third-party cells are emitted with a NAMED skip rule so arm7 and the
coverage JSON record the disposition; never evaluated as a synthetic third party, never dropped
silently). The PO may override at the gate; § 6A's asymmetry statement is re-read against the
emitted keying, not assumed. The CCIH-anchored scope fallback in `424` is retired by construction
(the probe runs against the cell's own scope fixture).

### 2026-09-14 — backend: L9′ + L10 — the plan, then the build

**The plan, in one paragraph.** Every cell gains four columns the suite executes or obeys verbatim.
A **policy** door is probed as `select exists(select 1 from <relation> where <idcol> =
'<fixture>'::uuid)`: no transcription, because RLS evaluates the whole live policy set — every
permissive SELECT policy OR'd, every restrictive one AND'd — with `auth.uid()` bound by the
session. A **function** door is probed as `select <schema>.<fn>(<bound args>)`, the live object
itself; the one `guard-expression` door is probed through its owning function the same way. The
session is established by the probe, per cell and in this order: the `profiles` mutation for
`principalState` (`is_active` / `suspended_until` / `email_confirmed_at` — a property of the
PRINCIPAL, not of the text), then `test_helpers.claims_for(<uid>, false, <hat>)` where `<hat>` is
`staff` for `activeContext=matching`, `staff_admin` for `other_role` and `null` for `absent`, then
`set local role authenticated`; `<uid>` is the principal on a self-check and `f.nobody` on a
third-party one. `catalog_sql` is `select authz.candidate_has_permission('<principal>'::uuid,
'<res>', '<scope>'::uuid, '<code>')`, computed under the TRUE claims before any override. The
**binding table** — which fixture row each (legacy class × gate arm), and for row 4 each
(persona × gate arm), resolves to — moves out of `424`'s declare block and into the manifest
as `arm3Door.probe` (`kind`, `relation`/`call`, `idColumn`, `fixtures`), authored ONCE from my own
seed; the generator binds it per cell and emits the finished SQL plus `legacy_fixture_id`, so `424`
never names a resource. **L10 keying** is DERIVED, not listed: a row is `third-party-capable` iff its
probe passes the cell's principal as an explicit uid argument (`p_uid` / `p_user_id` / `p_signer` in
§ 5.4's `armInterface.subject`), and `caller-only` otherwise — which every `rls-select` probe
is by construction, since RLS can only ever ask about the querying session. An arm cross-checks the
derived keying against § 5.4's subject data and refuses to emit if they disagree, so the two
cannot drift. On a `caller-only` row the third-party coordinate is **skipped by the named rule
`self_check_undefined_for_caller_keyed_door`**, recorded in the `skipped` census and the coverage
JSON and re-stated by arm7 — never answered with a synthetic third party, never dropped silently.
`--self-test` gains two fixtures: a **planted wrong fixture id** (a cell's `legacy_fixture_id`
repointed at another arm's row) caught BY NAME by the arm that re-derives the binding from the
declaration, and a **planted wrong keying** (a `caller-only` row flipped to `third-party-capable`)
caught by name by the keying arm. `arm3Door.expression` stays documentation, with the comparison arm
to `pg_policies.qual` discharging the drift follow-up's first arm.

#### L9' + L10 landed (`a0723554`)

| reading (OUTPUT) | before | after |
| --- | ---: | ---: |
| cells | 9936 | **8100** |
| skipped by `self_check_undefined_for_caller_keyed_door` | — | **1836** |
| flips vs `expected_granted` | 726 | **558** |
| keying | — | **4536** third-party-capable / **1836** caller-only |
| `staff_admin` rows | 1728 | **1728, byte-identical** (sorted AND plain diff; the four new columns are on the WIDE shape only, so `403` is untouched) |
| `--self-test` | 28 caught | **30 caught**, both arm14 fixtures BY NAME, clean on the real spec |

Smoke test against the live stack: **60 sampled cells' `legacy_sql` and `catalog_sql` executed
cleanly, 0 failures, 0 empty legacy columns.** `lint:authz-vectors` exit 0, `npm run lint` exit 0.

**⚠ arm14(b) fired on the REAL SPEC on its first run — on me, which is the discrimination
control working.** Its first cut compared every row's derived keying to § 5.4. But § 5.4's
`subject` describes the PRODUCTION SITE, while a probe's keying describes what the DIFFERENTIAL can
ask; for the nine bare rows those genuinely differ (the production site is a bare
`app.is_member_of(scope)` on `auth.uid()`, while the probe uses the `_for` variant — ADR 0201
D1's asymmetry, not drift), so they are OUT of the arm's stated domain and **counted in a census**
rather than exempted. It also caught two REAL errors before they shipped: `action_items.read` and
`documents.read` were probed through their POLICY, which silently made them caller-only and dropped
every third-party cell, and `cases.vote`'s probe bound the principal, fabricating a third-party
capability its guard does not have.

**⛔ Open for the lead / PO.** The nine bare rows are `third-party-capable` in this landing
because their probe is `app.is_member_of_for(scope, uid)` — the form `424` has always used. L10's
wording ("`caller-only` for a policy / **bare `is_member_of` site**") would instead make them
caller-only and skip ~half their cells. I did not make that call: it is a large coverage change and
the census names the nine rows so it can be ruled at the gate.

### 2026-09-14 — L9′ landed; L10 amended for the nine bare rows (lead)

Backend (`6a6bc7a5` plan · `a0723554` vector · `6a60c1a5` record): cells 9936 → 8100 (1836 skipped
under the named rule), flips 726 → 558, keying 4536 third-party-capable / 1836 caller-only,
`staff_admin` 1728 byte-identical (new columns on the WIDE shape only; `403` untouched), self-test
30 caught with both arm14 fixtures by name; 60 sampled cells' `legacy_sql`/`catalog_sql` executed
clean on the live stack. arm14(b) fired on the real spec first — and caught two real errors before
they shipped: `action_items.read` and `documents.read` probed through their POLICY (silently
caller-only, every third-party cell dropped) and `cases.vote`'s probe binding the principal
(fabricating a third-party capability its guard lacks). § 5.4's `subject` describes the PRODUCTION
site; a probe's keying describes what the differential can ASK; the nine bare rows differ by ADR
0201 D1's asymmetry and are counted in a census, not exempted.
**L10 amended (lead):** for a BARE-membership site the door IS the predicate, and its `_for` twin
(`app.is_member_of_for(scope, uid)`) is the legacy evaluator the differential has always used
(403's shape) — so the nine bare rows are `third-party-capable`, as backend built them. `caller-only`
applies to a COMPOSITE policy door with no `_for` twin (a policy whose further terms read `auth.uid()`
themselves). The census stays as the record of the nine. ⛔ Not a coverage reduction: L10 as first
worded would have skipped ~half their cells; the amendment restores 403's coverage on those rows.
Tester now re-cuts `424` to the loop backend published (columns `legacy_sql` · `catalog_sql` ·
`legacy_fixture_id` · `keying` after `member_gate_arm, legacy_door`) — one authorized run.

### 2026-09-14 — the loop-shaped `424` ran once and caught two VECTOR defects (lead)

Tester re-cut `424` per L9′/L10 (committed by the lead): §§ 3–4 are the execute-and-compare loop,
every door/dispatch/fallback helper deleted, § 2.3 measured at 12 classes, new **§ 2.6
fixture-existence control** (RLS-bypassed presence of `legacy_fixture_id` before a `false` is
trusted), plan(22). Run 1 of 2: RED on tests 6, 13, 14 — and the tester stopped at once because
no line it owns can fix either finding:
1. **A `gen_random_uuid()` id pinned into the vector.** `action_items.read`'s `legacy_fixture_id`
   is `ac3f1301-…`, the id the committee-scope item had at GENERATION time; on a fresh reset it is
   `df7de80e-…`. § 2.6 caught it directly ("NOT FOUND in public.action_items"). ⇒ the generator read
   the catalog and pinned a non-deterministic id — every bound id must be a fixed literal from
   `seed.sql`/a migration, and the generator refuses any other (self-test: refused BY NAME).
2. **Probes anchored to the CCIH resource regardless of the cell's `scope`.** For every arm-3 class
   whose fixture lives only at CCIH, `legacy_sql` probes the CCIH row while `catalog_sql` checks the
   cell's scope (Farmácia B for `foreign_org_commission`): legacy and catalog measure two different
   resources by construction — 458/572 cells red, all `cross_org_actor`/`other_commission_holder`
   off-CCIH cells. ⇒ each class needs a resource fixture at EACH scope the cell axis varies
   (`own_commission` CCIH · `sibling_commission` Farmácia A · `foreign_org_commission` Farmácia B),
   or a NAMED skip rule where a class has no resource at a scope — never a probe at the wrong scope.
⭐ Both are exactly what L9′ was for: the suite no longer hides a vector defect behind its own
dispatch, and the first run found two. Routed to backend (owns the stack).

#### 2026-09-14 — backend: the two vector defects `424`'s new mechanism exposed (`b873b955`, `5ace5d91`)

Both mine, and both are exactly what L9′ was built to surface — the loop found them on its
first run because the suite now EXECUTES the vector instead of re-deriving the door.

**(1) A non-deterministic id was pinned in the vector.** `action_items.read`'s committee fixture
was created with `gen_random_uuid()`, so the generator read its id out of the CATALOG at generation
time; the next reset minted a different one and the probe then hit a row that does not exist.
⛔ A probe against a missing row returns FALSE — indistinguishable from a door that denies.
Fixed id in my own fixture home (the base-seed row is untouched), and **arm14(d)** now refuses any
bound id that is not a FIXED LITERAL in `seed.sql` or a migration. It scans the DECLARATION as well
as the emitted cells: the declaration is where a bad id enters, and checking only cells would pass a
binding unusable for a coordinate this run happened not to emit. It reads FILES, never a database —
gate 12 runs inside `npm run lint`, which must never require Docker. Sweep: **37 of 37 literal**.

**(2) Probes were anchored to CCIH regardless of the cell's `scope`.** `legacy_sql` measured one
commission while `catalog_sql` asked about another, so the two sides answered about DIFFERENT
RESOURCES by construction (the tester measured 458 of 572 red cells, every one off-CCIH). The
binding table is now keyed by (class × gate arm × **scope**), and a missing scope returns
None → a named skip, never a fallback.

| class | own (CCIH) | sibling (Farmácia A) | foreign (Farmácia B) |
| --- | --- | --- | --- |
| action_items — committee | `a5f4…c1` **new** | `a5f4…c2` **new** | `a5f4…c3` **new** |
| action_items — assignees_only | `a5f4…a1` / `a5f4…a2` | `a5f4…d1` **new** (+ assignment `a5f4…e1`) | `a5f4…d2` **new** (+ `a5f4…e2`) |
| accreditation — owned | `a5f5…a2` | `a5f5…a4` **new** | `a5f5…a3` |
| accreditation — PUBLIC (null owner) | `a5f5…a1` | same row | same row |
| forms — version | `5000…a001` / `…a002` | `a5fc…b1` **new** (form `a5fc…f1`) | `a5fc…b2` **new** (form `a5fc…f2`) |
| documents | `d0c0…d1` / `d0c0…d2` | `a5fd…a1` **new** | `a5fd…a2` **new** |
| meetings · cases · capa · forms `disjunct_present` · documents approver | declared | — skipped | — skipped |

⭐ The PUBLIC framework is the one genuinely scope-INDEPENDENT fixture: `owner_commission_id IS
NULL` belongs to no commission, so the same row is the right probe everywhere.
⛔ The last row is declared at `own_commission` ONLY — each needs a CCIH FK chain (a meeting
with its attendance, a case with its participants and ethics detail, a capa plan with its source)
with no equivalent elsewhere, and the approver/targeted-version legs have exactly one constructible
principal. Skip rule **`no_resource_fixture_at_this_scope` = 2664 cells**, recorded in the coverage
census. ⚠ It is a real coverage loss and it is counted rather than hidden; seeding those chains
at two more commissions is a separate, larger piece of work.

**Readings (OUTPUTS):** cells 8100 → **5436** · new skip **2664** · flips 558 → **408** ·
`staff_admin` **1728 byte-identical** (sorted AND plain) · `--self-test` **32 caught** (was 30),
both new fixtures BY NAME, clean on the real spec · `lint:authz-vectors` **0**, `npm run lint` **0**.
**Full smoke, every cell and not a sample: 3708 probes executed, 0 errors; 34 distinct fixture ids,
0 missing.**

⚠ Left flagged, not fixed: `roster.read`'s subject profile is persona-keyed rather than
scope-keyed — a profile belongs to no commission, so whether the subject should track the cell's
`scope` axis is a vector-shape question. Recorded in its `scopeNote`.

### 2026-09-14 — both vector defects fixed by backend; the coverage loss is counted, not hidden (lead)

Backend (`b873b955` seed · `5ace5d91` generator + vector · `f40babdc` record): the committee action
item has a fixed literal id (the base-seed `gen_random_uuid()` row untouched); **arm14(d)** refuses
any bound id that is not a fixed literal in `seed.sql`/a migration, scanning the DECLARATION as well
as emitted cells (a bad id enters at the declaration; cells-only would pass a binding for a
coordinate this run did not emit), reading files, never a DB — 37/37 literal. A resource fixture
per class at each scope (own CCIH · sibling Farmácia A · foreign Farmácia B) for action items
(committee + assignees), owned frameworks, form versions, documents; the PUBLIC framework is the one
genuinely scope-independent fixture; meetings · cases · capa · forms `disjunct_present` · documents
approver stay own-only (each needs a CCIH FK chain with no equivalent elsewhere) under the named
skip **`no_resource_fixture_at_this_scope` = 2664 cells** in the coverage census — ⭐ a real
coverage loss, COUNTED rather than hidden. Smoke over EVERY cell: 3708 probes, 0 errors, 34 distinct
fixture ids, 0 missing. Cells 8100 → 5436, flips 558 → 408, `staff_admin` 1728 byte-identical,
self-test 32 caught. ⚠ Flagged by backend, not ruled: `roster.read`'s subject profile is
persona-keyed, not scope-keyed (a profile belongs to no commission) — recorded in its `scopeNote`;
the lead reads it as correct for the profile door (the scope axis varies the CALLER's membership,
which the co-member leg reads) and leaves it for the T14 review to contest. Tester runs `424`.

### 2026-09-14 — `424` run 2: 458 → 268 cells red; two more VECTOR defects, both measured live by the tester (lead)

Tester (log `424-run2of2.log`; § 2.1 floor re-measured at 3708 cells, 12 classes unchanged): § 4.1
98 + § 4.1b 170 cells, stopped at its cap because neither is fixable from the loop:
1. **`documents.read` binds ids from the wrong table for the door it calls.** `legacy_sql` now calls
   `app.can_read_document(document_id, uid)` — which reads `public.documents` — while
   `legacy_fixture_id` binds `controlled_documents.id` values (`d0c00000-…-d1/d2`); measured:
   `select id from public.documents where id in (…)` → 0 rows, so the door denies everyone. ⚠ The
   smoke "0 errors" and § 2.6's presence control could not see it: presence was checked in the
   DECLARED table, not in the table the DOOR reads. ⇒ the binding declares the table the door reads
   (as data, per class) and § 2.6 / the generator's smoke check presence THERE.
2. **`roster.read` never got the per-scope fixture** the other nine classes got: its co-member ids
   stay anchored regardless of the cell's `scope`; measured: `subject_holder` (staff4.ccih) at
   `sibling_commission` probes CCIH's co-member (`…002`) — a real co-member fact at the WRONG scope
   — `legacy=true`, `catalog=false`. ⇒ the deferred `scopeNote` question is settled by measurement,
   against the lead's reading: the resource must be a profile whose ONLY shared commission with the
   principal is the cell's scope (a co-member via Farmácia A only; via Farmácia B only), or the
   named skip. Routed to backend (owns the stack).

#### 2026-09-14 — backend: run 2's two causes, plus a third the sweep found (`a16debbe`, `d2a8acb3`)

**(1) Row 16 bound ids from the wrong table for the door it calls.**
`app.can_read_document(p_document_id, p_uid)` resolves its resource in **`public.documents`**
(joined to `securable_resources`) — measured from its body — while the fixtures were
`controlled_documents` ids. The lookup found no row, so the door denied EVERY persona,
`subject_holder`@own included. ⛔ **My smoke checked presence in the table the binding was NAMED
after, not the table the DOOR reads** — which is precisely why it stayed green while the probe
measured nothing. A presence check is only a control if it looks where the door looks.

**(2) Row 4 was not scope-bound, and my `scopeNote` was REFUTED.** I had written that a profile
belongs to no commission so the subject could not be scope-keyed. Wrong: the door asks whether the
SUBJECT holds a membership in some commission the CALLER is also in, so the subject is scope-bound
THROUGH its memberships. Three new co-member personas hold **exactly one** membership each, and the
leg is now diagonal — measured true only where the caller shares that commission. The note is
kept and marked refuted rather than quietly rewritten.

**(3) ⭐ A third, found by SWEEPING every class's ids against its door's table rather than by a
red cell:** row 6's `conjunct_unmet` bound a `meeting_id` with no `meeting_cases` row (1 of 2
present), which would have surfaced later as a mystery deny. Seeded.

| class | own (CCIH) | sibling (Farmácia A) | foreign (Farmácia B) |
| --- | --- | --- | --- |
| documents — `public.documents` ids | `a5fe…0a1` (approved) / `a5fe…0a2` | `a5fe…0a3` | `a5fe…0a4` |
| roster — co-member, ONE membership | `a5f0…f1` | `a5f0…f2` | `a5f0…f3` |
| roster — `disjunct_present` | the principal (self leg) | same | same |
| roster — `disjunct_absent` | `gap.unpriv` (no membership at all) | same | same |
| meeting_cases for the restricted meeting | `a5f2…0b1` | — | — |

**The presence-table column is `probe_table`** (with `probe_column` beside it, since row 6 is keyed
on `meeting_id` rather than `id`). Both are emitted from the manifest's `probeReadsTable` /
`probeReadsColumn`, declared for all 11 resource-binding classes and derived by MEASURING each
door's body. **arm14(e)** refuses a row that binds a resource without declaring where its door reads
it. ⚠ The presence check itself cannot live in the lint gate — it needs a database and
`npm run lint` must never require Docker — so it lives in the smoke, **with a discrimination half
that plants an absent id and requires the check to report it**.

**Smoke, every cell and not a sample: 3708 probes executed, 0 errors; 36 distinct (id, door table)
pairs, 0 absent; the planted-absent control fired.** cells 5436 · flips 408 · `staff_admin`
**1728 byte-identical** (sorted AND plain) · `--self-test` 32 caught, clean on the real spec ·
`lint:authz-vectors` **0**, `npm run lint` **0**.

### 2026-09-14 — stack back from backend at `8aed9422`; `424` run 3 dispatched (lead)

Backend's fix round: `a16debbe` (seed: `public.documents` ids per scope, co-members with ONE
membership each, the missing `meeting_cases` row), `d2a8acb3` (generator + vector: `probeReadsTable` /
`probeReadsColumn` declared for all 11 resource-binding classes, emitted as `probe_table` /
`probe_column`; arm14(e) refuses an undeclared binding; smoke over every cell with a planted-absent
discrimination half), `8aed9422` (its record entry). Measured by the lead on the emitted `.psql`, not
the report: the two columns are present in the `staff` temp table; `424` references neither yet
(`grep` over the suite: 0 lines) — so § 2.6 still checks the table the binding is NAMED after, the
blindness that kept run 2's smoke green. Tester dispatched: § 2.6 re-pointed at `probe_table`.
`probe_column` with its discrimination half kept, run 3 to a NEW log name, cap 2; on green the § 6
witness and one full `test:db` on a fresh reset. ⚠ Own trap re-hit in this round's measurement: a
`grep … | head` chain printed `head`'s exit, not `grep`'s — the count was read from the lines, not
the code.

### 2026-09-14 — `424` run 3: 268 → 68 (§ 4.1) + 136 (§ 4.1b) cells red; four binding-shaped causes (lead)

Log `424-run3-probe-table-fix.log` (2 of 23 red, § 4.1 + § 4.1b; every other assertion green, § 2.6
now on `probe_table`.`probe_column` per the tester's uncommitted edit). Lead's tally by (code, class,
polarity): `roster.read disjunct_absent` 36 legacy=true/expected false + 6 the other way;
`action_items.read disjunct_present` 40 legacy=false where `expected_legacy_granted` = true (P1 label);
`documents.read disjunct_present` 16 the same shape after the `public.documents` rebinding;
`forms.read` 12 legacy=true expected false with an EMPTY class column; `cases.vote` 4;
`roster.read` / `capa.read conjunct_unmet` 6 + 6 legacy=true. Reading: the resources bound as
"present" do not satisfy the door's role-free disjunct and the ones bound as "absent" / "unmet" do —
the run-2 shape, one class over. Tester attributing (iteration 1 of cap 2); backend measuring the
same residual read-only, no edits until routed; lead reconciles. Loop count on this mechanism: 3
runs, each cutting the residual (458 → 268 → ≤ 204) with new causes named — under the 5-iteration
bar, reported here each round.

### 2026-09-14 — run 3 attributed: four VECTOR causes (tester) + 68 § 4.1b cells still unattributed (lead)

Tester, live-confirmed, no edits, no iteration 2: **A** `roster.read disjunct_absent` binds
`gap.unpriv`'s profile for every persona/scope — the same id as the `unprivileged` persona axis value,
so persona=unprivileged self-reads (legacy=true) and everyone else's co-member leg is stuck false
(fixture-shared-ids, again); **B** `cases.vote` binds `app.can_read_case_committee` — a READ
predicate, not `cast_case_vote`'s guard (different signature): wrong door bound; **C** `forms.read`
/ `none` binds the version carrying `gap.unpriv`'s targeted-participation chain, so the role-free
disjunct grants at the `none` baseline while the cell is `not-in-gate`; **D** `action_items.read
disjunct_present` under `active_context=other_role` grants via the assignee leg, unlabelled for that
value (the reach declaration does not cover it). All routed to backend. ⚠ The attribution reads as
complete and is not: it covers § 4.1's 68 cells; 68 of § 4.1b's 136 (action_items.read
disjunct_present 40 legacy=false vs expected true; documents.read disjunct_present 16; roster.read +
capa.read conjunct_unmet 6 + 6) fall outside A–D — tester asked to attribute them, backend to
measure them in the same round. Added to backend's brief: the smoke must assert each class's bound
function IS the manifest's declared door, not merely that some function exists (B's shape).

### 2026-09-14 — L11: row 16 probes the POLICY leg P1 was ruled on; run 3's whole residual routed (lead)

Backend's read-only diagnosis reconciled with the tester's: **A** agree (`thirdPartyCaller` and the
`disjunct_absent` subject are literally one row — a dedicated zero-membership profile, never a
persona, WITH an org affiliation or 396/400 red on a tenant orphan); **B** agree, but the honest fix
is a NAMED SKIP (`door_is_a_write_guard_not_executable`) — `cast_case_vote` takes a decision id,
raises, and is a write, so no substitute door; the write polarity is T12's; **C** agree (`_default`
binds `a002`, the chain version reserved to `disjunct_present`); **D + the 40** are ONE cause:
`arm3Door.reach` is persona-keyed while L9″ made fixtures scope-keyed, so the reach lies off the own
scope (door measured diagonal: own→subject_holder, sibling→other_comm, foreign→cross_org) — reach
becomes scope × persona, arm13 enforces it, self-test refuses a persona-only reach; roster
`conjunct_unmet` fell through to `_default` (binding); capa `conjunct_unmet` grants via
`can_read_event(event_of_capa)` (fixture: the other two disjuncts must be false too).

**Documents `disjunct_present` (16) — L11, a lead ruling on MECHANISM that keeps the PO's ruling
intact.** Measured by backend: `app.can_read_document` carries `is_active(p_uid)`; the policy leg
(`app.is_document_approver_of`) does not. P1 — *"accept the exception"* — was ruled on the eleven
coordinates AS MEASURED on the policy leg, whose whole content is that the role-free disjunct ignores
principal state. L10 (lead) then preferred the `p_uid` function door for row 16, which gates on
state, so the probe no longer measures the leg the PO ruled on. Ruling: row 16 probes the **policy**
leg (RLS-select under the caller's claims, caller-only under L10, third-party cells under L10's named
skip); the P1 label applies as ruled. Un-labelling row 16 (option 2) would silently shrink the PO's
approval scope and is NOT the lead's to choose. The function door's stricter behaviour is not lost:
it is a second production door for one row disagreeing with the first on inactive principals —
noted on BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS (row 16's policy leg is one of the
disjuncts that bypass; the function beside it does not) for the fix unit, and stated to the PO at the
T6 gate as a fact about what P1 covers. Backend authorised for the full round; tester stood down on
the remainder (backend attributed it). Iteration count on this mechanism after the round lands: 4.

### 2026-09-14 — the § 4.1b remainder attributed by the tester as E–H; agrees with backend cause for cause (lead)

Independent measurement, no shared notes: **E** `action_items.read disjunct_present` at foreign scope
binds the item assigned to `gap.xorg.b`, not the subject persona (= backend's reach × scope cause);
**F** `can_read_document` opens with an unconditional `is_active(p_uid)` gate the policy leg lacks
(= L11's subject; the tester reads it as "the label is stale for this door" — L11 keeps the label and
moves the probe to the leg it was ruled on); **G** the `conjunct_unmet` profile `…f3` holds `staff` at
the caller's own commission — a co-member by construction (= the `_default` fall-through); **H**
`can_read_capa`'s event-sourced arm grants regardless of `source='rca'` (= the fixture cause). § 4.1b
itself compares the right columns — not a suite defect. Tester's § 2.6 edit: LF, uncommitted, to be
committed by path with run 4. Two measurers, eight labels, four causes, zero disagreement on the
mechanism; the one difference (F's remedy) is the ruling already recorded as L11.

#### 2026-09-14 — backend: round 4 — A/B/C/D + L11 (`cea002eb`, `c5ef5fef`)

I reconciled all four of the tester's attributions against my own read-only measurements and agreed
with A, B and C. **⚠ I partly disagreed with D and the disagreement was load-bearing**: that
coordinate IS labelled (`other_role|own_commission|…|disjunct_present` carries P1 with
`expected_legacy=true`, and the door measures true). D's 4 cells and the 40 "unattributed" are
**ONE cause**: `arm3Door.reach` stayed persona-keyed after my own L9″ change made the fixtures
scope-keyed, so the reach lied at every off-own scope. Measured diagonal: own→staff4.ccih,
sibling→staff1.farm, foreign→gap.xorg.b.

| cause | fix | arm that now refuses it |
| --- | --- | --- |
| A — `disjunct_absent` bound `gap.unpriv`, which IS `thirdPartyCaller` | dedicated `gap.absent`: 0 memberships, never a persona, affiliated (0 orphans) | **arm14(f)** — a fixture id that is also a persona id |
| roster `conjunct_unmet` fell through to `_default` | its own binding: ABSENT = no membership anywhere, UNMET = one the caller does not share | arm14(c) |
| B — row 12 approximated with `can_read_case_committee` | `not-executable`, skip `door_is_a_write_guard_not_executable` (**648**) | **arm14(h)** — a bound function not named in the row's own declaration |
| C — forms' `none` shared the chain version | baseline → the no-chain version; **swept all five two-armed classes, 0 collisions left** | arm14(c) |
| D + 40 — reach persona-keyed while fixtures are scope-keyed | reach = **scope × persona** (`byScope`) | **arm14(g)** — a `personas` reach with no `byScope`; arm13 now passes the cell's scope |
| capa `conjunct_unmet` met the conjunct | manual-sourced plan: `event_of_capa` null, measured **false for all four** while the default stays true for subject_holder only | — |

**L11 on row 16, applied as ruled.** It probes the POLICY leg again.
⛔ The finding underneath is about PRODUCTION, not the fixture: `app.can_read_document` opens
with `if not app.is_active(p_uid) then return false`, while the policy's
`app.is_document_approver_of` leg carries **no** such term — both measured live. So two
production doors disagree on exactly the inactive principal P1's approved divergence is about, and
probing the function contradicted a PO ruling for 16 cells. The row carries a declared
`keyingOverride` naming the ruling and the reason, and the overrides are **printed** — an
exemption nobody can see is what a weakened arm looks like from outside. The lead carries the
second door's guard to the bug register.

⚠ `arm1b` and `arm3` gained ONE exemption each for a `not-executable` rep. Both are keyed on the
DECLARATION, never on a code name: a hand-list there would silence the next genuinely-dropped rep,
which is the only thing those arms exist for.

**Readings:** cells **5076** · flips **382** · skips `no_resource_fixture_at_this_scope` **2376**,
`self_check_undefined_for_caller_keyed_door` **1836**, `door_is_a_write_guard_not_executable`
**648** · `staff_admin` **1728 byte-identical** (sorted AND plain) · `--self-test` **34 caught**
(was 32), both new arms BY NAME, clean on the real spec · bound-id sweep **38/38 literal** ·
`lint:authz-vectors` **0**, `npm run lint` **0**.
**Smoke, every cell: 3348 probes executed, 0 errors; 37 distinct (id, door table) pairs, 0 absent;
72 distinct bound doors, 0 missing from the catalog; the planted-absent control fired.**

⚠ `424` was NOT touched — the tester's § 2.6 edit is uncommitted in the tree and was left there.

### 2026-09-14 — `424` run 4: 18 (§ 4.1) + 42 (§ 4.1b) cells red; L11 GENERALISED; iteration 4 of 5 (lead)

Tester re-derived § 2.1/2.3/7.1 from the emitted vector first (3348 cells, 11 classes, row 12's
class at 0 rows under its named skip), reset exit 0, no peer on the stack. Log
`424-run4-write-guard-skip.log`. Three causes, all vector/fixture, no iteration 2:
**G1** row 4 `disjunct_absent` binds `gap.absent` (0 memberships anywhere) — the co-member leg can
never fire for any caller, so legacy is stuck false where the catalog grants: round 4 fixed the
id-collision HALF of cause A and re-created its other half with a new id (a partial fix that read as
complete). Read against the door (self OR co-member): `disjunct_absent` = not-self, membership
decides = the scope co-member; `conjunct_unmet` = a target no caller shares at that scope = the
zero-membership profile. Round 4's two definitions are the door's two classes SWAPPED; `f3` under
`conjunct_unmet` still shares Farmácia B with the cross-org caller (G, not closed). **G2** row 11
`disjunct_absent` binds an assignees-only item assigned to someone else — unreachable by membership,
G1's shape. **G3** row 11 `disjunct_present` at deactivated/suspended (24 cells, P1 label):
`app.can_read_action_item` opens with `if not app.is_active(p_uid) then return false` — L11's
finding on a second row.

**L11 generalised (lead ruling on mechanism, the PO's P1 untouched):** every P1 coordinate probes
the leg P1 was measured on — the POLICY leg named in the bug row (`action_items_select`'s
assignees-only leg for row 11) — under L10's caller-only keying with the third-party skip; the
function door's `is_active` gate is declared as a printed `keyingOverride` and noted on the bug per
row. Backend sweeps ALL eleven P1 coordinates for a state-gated function door in one pass rather
than fixing row 11 alone (correct-at-most-sites), and the generator refuses, by name, a P1-labelled
class whose bound door is a function carrying `is_active`. ⚠ Loop safety: this is iteration 4 on
the execute-and-compare mechanism (458 → 268 → 204 → 60, each with new causes named); round 5 is
the last before the lead stops and reports to the PO instead of iterating.

#### 2026-09-14 — backend: round 5 — G1/G2/G3, bound from a measured truth table (`d5015060`)

⛔ **I stopped binding from the class NAME and measured the door first**, which is what the
previous three rounds had not done. The truth tables, per (persona, scope), taken BEFORE any edit:

| row 4 candidate | subject_holder | other_comm | cross_org | unpriv |
| --- | --- | --- | --- | --- |
| self | t | t | t | t |
| co-member @own / @sibling / @foreign | t/f/f | f/t/f | f/f/t | f/f/f |
| `gap.absent` | f | f | f | f |

| row 11 candidate | subject_holder | other_comm | cross_org | unpriv |
| --- | --- | --- | --- | --- |
| committee @own / @sibling / @foreign | t/f/f | f/t/f | f/f/t | f/f/f |
| assignees_only @own / @sibling / @foreign | t/f/f | f/t/f | f/f/t | f/f/f |
| locked to `ativo.registro` | f | f | f | f |

**G1 — my two classes were the door's, swapped, and round 4's fix re-created the defect it had
just removed under a new id.** `disjunct_absent` = the SELF disjunct is absent and MEMBERSHIP
DECIDES ⇒ the scope co-member. `conjunct_unmet` = no caller shares a commission with the target
⇒ the zero-membership profile. That also closes the tester's open **G**: `f3` under
`conjunct_unmet` still shared Farmácia B with `cross_org_actor`, so the "unmet" conjunct was
MET for that one persona; `gap.absent` shares with nobody at any scope.

**G2 — row 11 carried the same swap.** `disjunct_absent` bound the assignees_only item locked to
someone else — unreachable by membership, G1's shape exactly. It is now the committee item; the
locked item is the unmet shape, **own-only** because the lock must name a principal who is never a
persona and only CCIH has one.

**G3 — L11 generalised, swept in ONE pass over all eleven arm-3 doors.** `can_read_action_item`
and `can_read_document` carry an `app.is_active` gate; the other nine do not. Both now probe their
POLICY leg, row 11 with a printed `keyingOverride`. **New refusal arm14(i)**: a P1-labelled class
binding a state-gated function door — P1 approves a disjunct that IGNORES principal state, and
such a door denies exactly the cells the label approves. ⚠ Its fixture took two corrections
before it fired on its own predicate (first the keying arm claimed it, then the bound-door arm) —
the shared `arm14:` prefix means the runner's wrong-arm check cannot see contamination BETWEEN
sub-checks, which is worth remembering.

⭐⭐ **NEW SMOKE HALF — THE EXPECTATION, NOT ONLY THE BINDING.** Every cell is now run the
way `424` will run it (state mutation → claims → `set local role authenticated`) and the
MEASURED legacy is compared to `expected_legacy_granted`. **All 3024 staff cells, including the
divergence-labelled ones: 0 mismatches.** The previous four rounds each handed the tester a vector
whose expectations had never been measured; this one has, so their run is a confirmation.

**Readings:** cells **4752** · flips **366** · skips `self_check_undefined_for_caller_keyed_door`
**2376**, `no_resource_fixture_at_this_scope` **2160**, `door_is_a_write_guard_not_executable`
**648** · `staff_admin` **1728 byte-identical** (sorted AND plain) · `--self-test` **35 caught**
· bound-id sweep **38/38 literal** · smoke: 3024 probes 0 errors, 37 (id, door table) pairs 0
absent, 44 bound doors 0 missing, planted-absent control fired · `lint:authz-vectors` **0**,
`npm run lint` **0**. `424` untouched.

### 2026-09-14 — round 5 received at `774edd50`: the vector's EXPECTATIONS smoked before handover; run 5 dispatched (lead)

Backend measured the doors' truth tables per (persona, scope) BEFORE binding — the step the previous
rounds skipped: row 4 and row 11 each had the door's two classes swapped (G1, G2, and the tester's
open G closed by the zero-membership profile under `conjunct_unmet`); L11 generalised in one pass —
of the eleven P1 doors only `can_read_action_item` and `can_read_document` carry `app.is_active`,
both now probe the policy leg, arm14(i) refuses the shape. ⭐ New smoke half: every cell executed as
`424` executes it and compared to `expected_legacy_granted` — 3024/3024 agree; the four earlier
vectors had expectations nobody had measured. Cells 4752 · flips 366 · `staff_admin` 1728
byte-identical · self-test 35 · lint chains 0. ⚠ Backend's observation, filed as a follow-up: the
self-test's wrong-arm check compares on the `arm14:` prefix, so a fixture claimed by a SIBLING
sub-check (i's fixture was, twice) reads as caught by the right arm — LEARN-103's shape one level
down. Tester dispatched for run 5, the fifth and last iteration on this mechanism; witness and one
full `test:db` on green.

### 2026-09-14 — `424` run 5 GREEN (24/24); witness PARTIAL; full `test:db` red on 330 + 387, both moved by this unit's seed (lead)

Tester: floors re-derived from the vector first (3024 cells, 11 classes, 10 names); reset exit 0;
`424-run5-truthtable-fix.log` `Files=2, Tests=24, Result: PASS`. `424` committed by path
(`§ 2.6` on `probe_table`.`probe_column`) — ⚠ the lead's LF guard read **398** and aborted the commit; the next command's byte count
read **0** (399 lines, no CR). ⛔ CORRECTED LATER THE SAME DAY (T13 entry below): the guard
`grep -c $'\r'` is BROKEN in the form the lead used it — INSIDE a `$( )` command substitution the
`$'\r'` is mangled and the count equals the line count; the same grep run bare on a committed LF
file reports 0, agreeing with the byte count — so the file was LF all along, the tester's
"LF-confirmed" was right, and
the lead's first explanation ("the tester normalised concurrently") was an inference about an
event never measured. The instrument is now a byte count in Python, checked on a known-LF file
before trusting any reading; the guard and the `git add` sit in one chain. **Witness partial:** `pg_prove`'s summary prints no per-test `ok`
lines, so § 6.1 (red-on-delete) / § 6.2 (green-on-restore) are among the 24 passes but not yet
QUOTED; the tester's attempt at a raw `DELETE` on the shared stack outside the suite's rollback was
blocked by the sandbox — correctly — and re-done inside `begin … rollback` (count 1 → 0 → 1 live).
Owed: the two TAP lines verbatim via `psql` inside a transaction, before AC-5 is ticked. **Full
suite** (`test-db-run5-full.log`): `Files=273, Tests=9156, Result: FAIL`, `424` clean; reds: `330`
test 23 (every controlled document owns a core `documents` row — have 4, want 6; NEW, the row-16
`public.documents` fixtures) and `387` 7/25 (md5 pins over profile-visibility sets, moved by the
`gap.*` personas — backend's round-4 note called it "not this round's"; it is this UNIT's, and the
rule from the first re-pin holds: every delta attributed to a named new profile, never a bare
re-pin). Both routed to backend; the tester re-runs the full suite on a fresh reset after. Loop
count: the 424 mechanism closed at iteration 5 of 5; the full-suite loop starts at 1. ⚠ Lead's own
trap, again: a `grep -c` returning 0 exits 1 and silently ended an `&&` chain — this entry landed a
turn late and gate 7 had passed on the unchanged tree.

### 2026-09-14 — `424` § 6 witness QUOTED; a second Supabase stack on the host; one autocommit slip reverted (lead)

Tester, `424-run5-witness.txt` (psql inside `begin … rollback`, `00_setup.sql` + `424`, plan `1..23`,
23 `ok`):

```
ok 19 - 6.1 FAIL-PROOF 1 — flipping ONE seeded `staff` role_permissions row makes the oracle RED.
ok 20 - 6.2 ...and RESTORING the grant makes the mutated permission resolve TRUE again at its base coordinate.
ok 21 - 6.2b ⭐ THE RESTORE IS COMPLETE ACROSS THE WHOLE SWEEP.
```

Read for what it is: § 6.1 is the suite's OWN discrimination half — inside one transaction it flips
a grant and asserts the oracle diverges — so "shown able to fail" is a green line whose predicate is
the red, not a red run; the polarity pair (6.2, 6.2b) proves the restore. Accepted as AC-5's witness
on that reading, stated here so nobody later quotes it as "the suite was observed red".

⚠ **Host:** two `supabase db reset --local` attempts failed at the CLI's post-reset step with a
connection error — a SECOND Supabase project's full stack (`*_escalume`) is running on this host
(Docker contention). The tester verified the reset had in fact completed (schema, 44 profiles, 8
`a5f*` fixture rows, `staff = test_validation`) before proceeding, and installed `test_helpers` by
hand (`00_setup.sql` — normal outside `pg_prove`). Carried to the AC-10 gate: the full-suite run and
the door-sweep arms must be run with the other stack STOPPED or the reset re-verified the same way —
a "connection error" reset is neither a pass nor a proof of corruption.

⚠ **Slip, self-caught:** the tester's `create extension if not exists pgtap;` preceded `begin;`, so
it ran in autocommit and survived the `rollback` — a stack change outside the read-only contract;
verified and dropped, `pg_extension` count back to 0, the flipped grant's count 1 throughout. Owed
for AC-5 now: the full suite green (330 + 387 with backend).

#### 2026-09-14 — backend: the two suites this unit's seed moved (`8c7c2b77`, `05705e7e`)

**330 DM3·X1 — 4 of 6.** The invariant is `core_document_id IS NOT NULL` on EVERY controlled
document; the two Farmácia rows I added were inserted DIRECTLY, and a direct insert bypasses
the door that carries the obligation. The seed now reproduces the post-backfill state by hand for
them, as the base seed does for its own three. **Measured after a bare reset: 5 of 5.**
⭐ It also deleted a block of `public.documents` rows added when row 16 was probed through
`app.can_read_document`; L11 moved that row back to the policy leg, so those rows were bound by
NOTHING — verified zero references in the manifest and the vector before removing them.
⛔ **A fixture nothing binds is not harmless**: it still owes every invariant its table carries,
and it was exactly the half of that block nothing referenced which broke 330.

**387 — seven red, re-pinned with every delta named first.** Round 4/5 added four profiles
(`gap.comember.ccih` f1 · `gap.comember.farma` f2 · `gap.comember.farmb` f3 · `gap.absent`
f4, the last holding NO membership at all).

| test | arm | rows | profiles that ENTERED | why that arm sees them |
| --- | --- | --- | --- | --- |
| 5 | B1 hospitaladmin.a1 | 25 → **27** | f1, f2 | memberships in commissions under Hospital Central A |
| 6 | B2 orgadmin.a | 32 → **35** | f1, f2, f4 | the three affiliated to org A |
| 7 | B3 platform_admin | 40 → **44** | f1, f2, f3, f4 | `is_admin()` sees all |
| 8 | B4 chefe.ccih | 12 → **13** | f1 | the CCIH co-member |
| 9 | B5 staff1.ccih | 12 → **13** | f1 | same set as B4 — they still SHARE one value |
| 10 | B6 orgadmin.b | 6 → **7** | f3 | the Farmácia B co-member, affiliated to org B |
| 19 | D1b | — | — | moves WITH test 5, by construction |

⛔ **EVERY DELTA IS EXACTLY THE COUNT OF NEW PROFILES THAT ARM CAN SEE** — 27−25=2,
35−32=3, 44−40=4, 13−12=1, 7−6=1 — and nothing entered or left that is not one of the
four, so this is a fixture delta and not a visibility change. ⭐ f4 is visible to B2/B3 and
INVISIBLE to B1 (org affiliation, no hospital tier, no membership — the hospital-admin arms join
`memberships`/`hospital_affiliations` and it is in neither): the SAME asymmetry `gap.unpriv` had at
the first re-pin, recurring identically. D1a was re-pinned too though it never went red — a stale
literal satisfies `isnt()` for the wrong reason.

Scoped after a bare reset (`pg_stat_activity` checked first): `00_setup + 330` **exit 0**,
`00_setup + 387` **exit 0**; `npm run lint` **0**, `lint:authz-vectors` **0**. `424` untouched.

### 2026-09-14 — 330 + 387 fixed with every delta named (`d94efa9a`); full suite dispatched (lead)

Backend: **330** — the two Farmácia controlled documents were inserted directly, bypassing the door
that carries the `core_document_id` obligation; the seed now reproduces the post-backfill state (5 of
5). The fix also DELETED the `public.documents` rows seeded when row 16 probed
`app.can_read_document`: L11 moved the row to the policy leg, so nothing bound them (zero references
in manifest and vector, verified before removal) — ⭐ lesson-shaped for Record: a fixture nothing
binds is not harmless, it still owes every invariant its table carries, and the unreferenced half is
exactly what broke 330. **387** — four profiles entered (`gap.comember.ccih/farma/farmb`,
`gap.absent`); per arm the pin moved by EXACTLY the number of those profiles the arm can see (B1
+2, B2 +3, B3 +4, B4/B5 +1, B6 +1), nothing else entered or left ⇒ fixture delta, not a visibility
change; `gap.absent` visible to B2/B3 and invisible to B1 (org affiliation, no hospital tier, no
membership) — the same asymmetry `gap.unpriv` showed at the first re-pin, which is what makes it
attributable; D1a re-pinned though never red (a stale literal satisfies `isnt()` for the wrong
reason). Exits bare after a fresh reset: `00_setup + 330` 0 · `+ 387` 0 · `npm run lint` 0 ·
`lint:authz-vectors` 0. Tester dispatched: full `test:db` once on a fresh reset (iteration 2 of the
full-suite loop), the other host stack counted not stopped, a CLI-failed reset re-verified and
written into the log header.

### 2026-09-14 — full `test:db` GREEN on a fresh reset; AC-5 ticked (lead)

Tester, `test-db-run6-full.log`: no peer session; the `*_escalume` stack up (11 containers,
untouched); reset exit 0 with no CLI error this time, baseline measured anyway (`staff =
test_validation`, 44 profiles, 8 `a5f*` fixture profiles); `Files=273, Tests=9156 … Result: PASS`;
`424_ae5_staff_differential_oracle.sql … ok`; `grep -n "Failed test"` empty; 330 and 387 clean.
**AC-5 ticked** on: two assertions per cell over `authz.candidate_has_permission` (§ 4.1 legacy ==
catalog, § 4.1b legacy == `expected_legacy_granted`, every cell labelled or not); `case_reach` incl.
`unreachable` swept; approved divergence carried in `expected_legacy_granted` only, under the P1/P2/P3
rulings and L11; shown able to fail by § 6.1/6.2/6.2b quoted above; PA-F8 dispositions — STAFF-1
(responses lifecycle) reclassified by the H6 rename to a product finding on the ownership path,
STAFF-2 (the hat gate) = (b) named exception carried by ADR 0211 D2 for the PO at the T6 gate, the
inactive role-free disjuncts = (b) with owner + fix unit `AE5-INACTIVE-DISJUNCT-GUARD` (bug row).
Full-suite loop closed at iteration 2. Stack to backend for T6.

### 2026-09-14 — T13 specs WRITTEN (tester) and committed by path; the lead's LF guard was a BROKEN INSTRUMENT (lead)

Plan line re-verified first: `docs/plans/authz-evolution.md:999-1001` (moved from `:1092-1094`).
`e2e/ae5-staff-landing.spec.ts` (3): the BUG-HAT-001 class for `staff`'s one scope-kind
(commission-only per `ROLE_MANIFEST`, complementing `ae48-landing-by-scope-kind.spec.ts`'s
`staff_admin` case); pending-only membership lands in its commission (`gap.pending`); deactivated →
`/conta-inativa` (`requireUser`'s redirect, the real route). `e2e/ae5-staff-multi-commission.spec.ts`
(2): `multi@test.local` via the real `/c` picker — CCIH unsectioned form to confirmation
KEYBOARD-ONLY (CLAUDE.md § 8); Farmácia sectioned form, branch Não, to review (Form B's sign-off gate
blocks a plain `staff`'s submit, per `phase5-wizard.spec.ts`'s note). Typecheck 0, eslint 0/0, no
persona crosses orgs, assertions on text/heading/URL only, no fixture gap.

⛔ **Instrument finding, the lead's own:** the LF guard `grep -c $'\r'` reported **273 of 273
lines** for these two files while a byte count reported **0**. Proven on a committed, known-LF file
(`00_setup.sql`, 634 lines): bare `grep -c $'\r'` → 0, byte count → 0 — the grep is sound; what is
broken is the FORM the lead used every time, `CR=$(… grep -c $'\r' …)`: inside a `$( )` substitution
the `$'\r'` is mangled and the count equals the line count. Every "CRLF" reading this unit's lead
made that way (424's 398 of 399, today's 273 of 273) was the line count; every tester "LF-confirmed"
was true. The earlier record entry blaming a concurrent normalisation is
corrected in place above; the lead's memory note is rewritten. The rule that survives: a guard is
proven on a known input BEFORE its contradictory reading is believed (a negative control for the
instrument), and the byte count is the guard. Not yet RUN — the stack is backend's for T6 (its step 2
visible in the tree: the cutover migration placed, 426 modified); the run (`e2e:prod` once) is
AC-10's.

### 2026-09-14 — backend: T6, the atomic cutover APPLIED (`31b73837`)

Red-first, in order. Every file:line the routing cited was re-verified before acting.

**Step 1 — RED before the migration** (`65a22ff5`), the migration deliberately OUT of the tree:
- `426` test 3 — *"0.3 FIXTURE CONTROL: `staff` is `authoritative`. ⛔ `authz.holds_role` refuses
  a non-authoritative role, so before the cutover EVERY wrapper cell below would be false and the
  whole suite would agree with a restricted predicate that is also false — two wrongs reading as a
  green."* `have: test_validation` / `want: authoritative`; the suite then aborts (planned 26, ran 4).
- `405` tests 28–29 — § 4.3b (the positive control on § 4.2b's `prosrc` regex) and § 4.3c
  (both wrappers on the empty `search_path`). ⭐ § 4.2b itself PASSED, which is exactly why
  § 4.3b exists: an absence measured over a function that does not exist is trivially true.
- Exits bare: `00_setup + 426` = **1**, `00_setup + 405` = **1**.

**Step 2 — the migration placed, then applied.** The four snapshot properties, before → after:

| function | prosecdef | volatility | search_path | ACL (sorted) |
| --- | --- | --- | --- | --- |
| `is_commission_staff_of` | — → **t** | — → **s** | — → **empty** | — → postgres=X, service_role=X |
| `is_commission_staff_of_for` | — → **t** | — → **s** | — → **empty** | — → postgres=X, service_role=X |
| `is_member_of` | t → t | s → s | app, public, pg_catalog (unchanged) | unchanged, incl. its stray PUBLIC entry |
| `is_member_of_for` · `is_staff_admin_of(_for)` | t → t | s → s | unchanged | unchanged |

⛔ No PUBLIC on either new function, and **no `authenticated`** — deferred to T7, because two new
`prosecdef` functions inside the BUDGET-ANCHOR ceiling (gate 15) need a PO ruling.
Role states: `staff` → authoritative; **1 flipped, 2 authoritative, 0 left in `test_validation`**,
count-verified inside the migration's own block.

**⭐ THE CUTOVER'S EFFECT, MEASURED:** `authz.has_permission` (the RUNTIME resolver, authoritative
only) now answers **TRUE** for a `staff` holder where it answered FALSE before — the grants seeded
at T4 were INERT until this flip. Runtime vs candidate over the whole `staff` bundle:
**80 pairs, 80 agree, 0 disagree.**

**Step 3 — GREEN, and running `426` exposed two defects in MY OWN suite** (`b0740962`):
1. The wrapper is not executable by `authenticated` — `permission denied for function
   is_commission_staff_of`. ⛔ The repair is NOT to widen the grant so the suite goes green: that
   moves a privilege ceiling to satisfy a test. New § 3.5 pins the ABSENCE of both grants and the
   cells call as `service_role` — a DEFINER's answer does not depend on the caller's role, since
   `auth.uid()`/`active_role()` come from the claims (measured identical under either).
   ⚠ Those two cells go RED the day T7 grants it, on purpose.
2. § 4.3a's "hat=ABSENT" was **unreachable**: `claims_for(u, false, null)` MINTS a hat when the
   principal holds exactly one role type, so the cell re-measured the MATCHING hat under another
   name and asserted DENY while the door GRANTED. Re-pointed onto `staff1.qual.b` (staff +
   staff_admin, so nothing is minted — measured uid set, hat NULL), with a positive control on the
   same principal and a cell pinning the mint itself. ⭐ The cell generator already carries this as
   `absent_unreachable_for_single_role_principal`; this suite had to learn it independently, which
   argues for naming such a rule where BOTH readers can see it.
   ⚠ The plan said 26 against 35 real assertions — undetected because the pre-cutover run aborted at 4.

**The pins the cutover moved** (`66603273`, `ed8387f3`), each observed RED and attributed:
`401 § 3.2`'s tripwire fired a second time (`staff=test_validation` → `staff=authoritative`) ·
`401 § 16.9b` now CONSTRUCTS the pre-cutover state for one cell, because its content is "the state
gate bites", not "staff happens to be legacy" · `410 § 7.3` 1 → 2 authoritative, plus the manifest
`catalogSnapshot` · `400` 526 → 528 · `411` artifact + md5 · `421` 890 → **892** (= 860 + 32),
sql arm 11 → 13, and § 2a reports **13 visited / 0 findings** — both wrappers re-emit cleanly
under their declared empty path, which is the property ADR 0208 D4 asks for, measured.
⛔ **`403 § 3.2c` was NOT a pin move but a DERIVATION defect**: its right side read only
`authz_differential_cells`, so after AE5 split the vector per role it counted `staff` as unswept and
demanded it be in `test_validation`. It now unions both cell tables. Pinning the left side to
`(none)` was the tempting repair and would have deleted the cross-check the assertion exists for.

**⚠ ONE RED LEFT, AND IT IS NOT MINE TO EDIT.** `424` test 11 — § 3.2b's PRECONDITION
*"`staff` sits in `test_validation`, which is what makes `candidate_has_permission` the oracle"*:
`have: authoritative` / `want: test_validation`. With the cutover in the migration chain this can
never hold on a fresh reset again. ⭐ The ORACLE is intact — measured above, the two resolvers
agree 80/80 — so what needs re-ruling is the precondition's wording, not the suite's basis.
Tester's file; untouched.

**ADR 0211 D2's proof, as the PO reads it at the gate.** (1) The wrapper equals the legacy predicate
RESTRICTED to `staff` rows — `426` §§ 2–5 — with § 1 showing the UNRESTRICTED comparison
DISAGREES (`is_member_of_for` true, wrapper false, for a `staff_admin`-only principal), so the
restriction is shown load-bearing rather than asserted. (2) **A1**, the hat in both polarities: the
SELF form under matching / wrong / genuinely-absent hats, the `_for` form hat-blind under the same
three. (3) **A2**, principal state by NAMED cells: active, `suspenso.temp`, `gap.pending`,
`gap.deactivated`, each asserted individually, with § 0.1 proving all four hold a `staff`
membership so no cell can agree by both sides denying an absent grant.
**A3 — the zero-caller authority: no conformance gate reds on it.** `410`, `419` and `421` all
pass with the wrappers present and uncalled, so no allow-list entry was needed and none was added.
**PA-F8-STAFF-2**: the wrapper is now AVAILABLE and `is_member_of` is UNCHANGED — ADR 0211 D3 keeps
it a role-SET predicate until the re-expression is ruled, so all 82 dependents keep their behaviour.

`npm run test:db` on a fresh reset: **Files=274, Tests=9196**, one red file (`424`, 1 test).
`npm run lint` **0** · `lint:authz-vectors` **0** · `gen:types` **no diff** — the wrappers live in
`app`, outside the generated public types, so Rule 8 is satisfied with an empty delta, stated rather
than skipped. ⚠ Gate 19's self-test reds if the `411` md5 literal does not sit ALONE on its line;
an inline comment beside it broke it once here.
⚠ The host carried TWO Supabase stacks throughout (ours 9 containers, `escalume` 11). `escalume`
was counted and never touched; `pg_stat_activity` read **0** active peers before every reset, and
each reset was verified afterwards on schema / profiles / role state.

### 2026-09-14 — T6 APPLIED red-first (`665d9519`); L12 on `424`'s state control; two PO items opened (lead)

Backend, shas `65a22ff5` (RED first) · `31b73837` (cutover) · `b0740962` (426) · `66603273` +
`ed8387f3` (pins) · `665d9519` (record). **RED before, migration out of the tree:** `426` test 3
*"0.3 FIXTURE CONTROL: `staff` is `authoritative` …"* `have: test_validation / want: authoritative`,
then the planned abort (26 planned, 4 ran) — the control that stops two false predicates reading as a
green; `405` §§ 4.3b/4.3c (positive control on 4.2b's regex; empty `search_path`), exits 1 and 1 —
§ 4.2b itself PASSED on the pre-cutover catalog because an absence over a non-existent function is
trivially true, which is why 4.3b exists. **GREEN after:** 401, 403, 405, 410, 426 exit 0. Snapshot,
before → after: `is_commission_staff_of(_for)` — → prosecdef t, stable, `search_path` empty, ACL
postgres + service_role only (no PUBLIC, no `authenticated`); `is_member_of(_for)`,
`is_staff_admin_of(_for)` unchanged (incl. `is_member_of`'s stray PUBLIC entry). Flip: 1 flipped, 2
authoritative, 0 in `test_validation`. **Effect:** `authz.has_permission` answers TRUE for a `staff`
holder where it was FALSE — 80 pairs runtime vs candidate, 80 agree. Backend's own 426 had two
defects found by running it: it assumed an `authenticated` grant the migration withholds (now pins
the ABSENCE) and § 4.3a's "hat absent" was unreachable for a single-role principal (the generator's
`absent_unreachable_for_single_role_principal`, named). `403 § 3.2c` was a derivation defect (read
only `authz_differential_cells`, not the `_staff` table) — fixed, not pinned. `test:db` Files=274,
Tests=9196, ONE red: `424` test 11's precondition (`staff` in `test_validation`) can never hold again;
oracle intact. `lint` 0 · `lint:authz-vectors` 0 · `gen:types` no diff · `pg_stat_activity` 0 before
every reset, the second host stack counted, untouched.

**L12 (lead, mechanism):** `424`'s state precondition is a CONTROL, re-pointed deliberately to
`authoritative` with its history in the assertion text (RED observed at the cutover, cited); never
widened to accept both states. Tester executing; scoped run to `424-run7-post-cutover.log`.

**PO items opened (§ Open rulings R-4, R-5):** **R-4** — the two wrappers carry no `authenticated`
EXECUTE; T7's re-keyed policies need it to reach them, and gate 15's ceiling on
`authenticated`-executable functions is the PO's to raise or hold — backend's T7 plan counts the
sites that turn on it. **R-5** — ADR 0211 D2 (the D2 proof: snapshot/assert + restricted differential
426 + the PA-F8-STAFF-2 condition) is reviewed by the PO at this gate, as the hub has said since
2026-09-14; AC-6 does not tick before that review. T7 plan requested from backend (full review, no
SQL).

### 2026-09-14 — T7 RE-KEY PLAN (backend) — ⛔ FOR FULL REVIEW, NO SQL WRITTEN

Nothing under `supabase/` changes until the lead acks. Every number below was measured read-only on
the LIVE catalog today, comment-stripped; the matrix's § 5 table is intent and was not used as the
source. Re-verified locations: the T6 plan at `docs/progress/ae5-staff.md:677`, the lead's A1–A4
ack at `:1266`, and the task list's T7 line — all three read before writing this.

⚠ **A MEASUREMENT TAKEN DURING A PEER'S RESET IS NOT A MEASUREMENT.** My first pass at (b) returned
`can_reach_case_on_member_surface in pg_proc = 0` and then failed on `public.memberships`; the DB
container had restarted 46 s earlier and `information_schema.tables` was climbing 155 → 171 as I
read. I waited for two consecutive equal table counts before re-measuring, and the real answer is
the opposite (it EXISTS). ⭐ Every figure below is post-settle.

#### (a) The site list, from the comment-stripped catalog

Sweep: bodies of `pg_policies.qual||with_check` and `pg_proc.prosrc`, `--` comments stripped,
matching `app\.(is_member_of|is_member_of_for|has_role_any)\s*\(` — the staff layer-1 gate.

| population | policy | DEFINER fn | INVOKER fn | total |
| --- | ---: | ---: | ---: | ---: |
| whole catalog carrying the layer-1 gate | **40** | **47** | **2** | **89** |
| the 20 staff rows' DECLARED sites (`armInterface`) | 42 | 25 distinct, all `prosecdef=t` | 0 | 69 incl. 1 `ts` |

⭐⭐ **THE GATE-15 COUNT THE PO'S RULING TURNS ON.** An RLS policy expression is evaluated with
the QUERYING role's privileges, so a policy that calls `app.is_commission_staff_of(...)` needs
`authenticated` EXECUTE — `prosecdef` changes what the body may READ, never who may CALL it. A
SECURITY DEFINER function that calls the wrapper INSIDE its body does not: the privilege check there
is against the function's owner (`postgres`).
⇒ **42 of the 69 declared sites require the grant** (every policy site). **26 do not** — 25
DEFINER functions plus the one `ts` site, which is not a DB call at all. The 2 catalog-wide INVOKER
functions would also require it if T7 re-keys them; neither is currently a declared staff site.
⛔ So the ruling is not "grant it or the re-key fails" — it is "grant it, or 42 of 69 sites cannot
be re-keyed onto the wrapper and must keep a layer-1 gate". That is the shape I would put to the PO.

**Per site, the polarity pair `425` (T12, tester) flips.** For each POLICY site the pair is
(grant PRESENT → the door GRANTS for a `staff` holder) / (grant DELETED from
`authz.role_permissions` → the door DENIES the same principal, same resource, same hat). For each
DEFINER site the pair is the same two on the function's return value rather than on row visibility.
⛔ Both halves must be observed on the PRE-migration catalog first, where deleting the grant must
move NOTHING — today the codes are not consulted at all, so a 425 that is red before T7 is
measuring its own fixture, and one that is GREEN before T7 has proven the re-key did nothing.

#### (b) What the re-key does with the two sites the hub flags

- **`app.can_reach_case_on_member_surface`** — EXISTS in `pg_proc` (1 row) and is referenced by
  **0** policies and **0** function bodies in the stripped catalog. The hub's "ZERO production
  callers" is CONFIRMED. ⛔ The re-key does NOTHING with it: giving a zero-caller function a
  layer-3 door would mint exactly the DEFINER-authority-with-no-callers shape condition A3 was
  written for, one increment after we agreed not to. It goes into T7's census as a declared
  non-enforcement consumer, and whether it should be DELETED is a separate lead/PO item.
- **The CCIH `staff` non-role case reach** — the hub says *6 of 9*. ⚠ **Measured today: 4 of 12.**
  Both halves moved because THIS unit's seeding changed the population (gap.pending,
  gap.deactivated and gap.comember.ccih are new `staff` of CCIH). Of the 12: **3** hold a live
  `case_access_grants` row, **1** is linked through `case_participants`, 4 distinct principals in
  total. The re-key must not narrow those reaches — they are arm-3's whole subject — so T7's
  `hardDenyClasses` re-measurement (ADR 0203 D1 bound 2) is taken against **4 of 12**, and the hub
  line needs correcting whoever owns it.

#### (c) What the generator EMITS today for every field T7 edits — L6's second half

⛔ A field the gate cannot see is not a declaration. Verified in
`supabase/tests/vectors/authz_enforcement_manifest.psql`:

| field T7 edits | emitted as | table |
| --- | --- | --- |
| `status` (pending-rekey → re-keyed) | `status` | `authz_manifest_permissions` |
| `enforcementSites` | site rows + `composed_with` | `authz_manifest_sites` |
| `domainAuthorizer` · `.composedWith` | `domain_authorizer`, `authorizer_composed_with` | `authz_manifest_permissions` |
| `residualLegacyAuthority` | `residual_legacy_authority` | ” |
| `layer1Gate` | `pending_layer1_gate` | ” |
| `hardDenyClasses` | `hard_deny_classes` (+ provenance) | ” |
| `definerSurface` | `carries_code`, `exec_authenticated`, `writes`, `gate` | `authz_manifest_definer_surface` |

All nine manifest tables are emitted, including `authz_manifest_arm_sites`. ⭐ **And the flip is
already survivable because of L6**: `410` § 6.2 roots from `enforcementSites` ∪ `domainAuthorizer`
∪ `armInterface`, so a row's hard-deny classes derive from `armInterface` BEFORE the re-key and
from `enforcementSites` AFTER, with no gap at the moment of transition. Had L6 not landed, every
re-keyed row would have gone dark for exactly one commit.

#### (d) Red-first order, each step's witness named BEFORE it is taken

1. **`425` both polarities, pre-migration** — witness: the grant-deletion pair must show **no
   movement** on today's catalog (the codes are not consulted yet). A 425 that already discriminates
   is measuring its fixture. Tester's file; this step is the precondition for reading step 4.
2. **`410` § 8 both directions, RED** — witness: `8.1 DECLARED => ENFORCING` must name each row
   whose declared `enforcementSites` do not yet reach its code, and `8.2`'s positive half must stay
   green so the arm is shown able to answer YES. Expected message shape: the same
   `commission.X -> public.Y / policy_name` list `8.1` produced at head 20261003007330.
3. **The layer-3 doors, per code**, each carrying the code as a greppable literal; then `410` § 8
   turns green and `gate 18` + `414`/`419`/`421` move by the count of new DEFINERs — witness: `421`
   § 0c's `892 = 860 + 32` becomes `892 + N`, stated before the migration and compared after.
4. **`425` re-run** — witness: the same pairs now DISCRIMINATE. Step 1's no-movement reading is what
   makes this one evidence rather than a coincidence.
5. **`hardDenyClasses` re-measured per row** on the extended instrument, old → new per row.
6. **Manifest rows flipped** pending-rekey → re-keyed, sites moved `armInterface` →
   `enforcementSites` — witness: `authz_manifest_sites` grows from **13** to 13 + N and
   `arm_sites` shrinks by the same N; § 6.3's measured-row population is re-derived, not adjusted.
7. Every new/touched DEFINER on `search_path = ''` (ADR 0208 D4) — witness: `421` § 2a's
   "N visited | 0 findings" grows by the new count, which is how T6's two wrappers were proven.

⚠ **Open, and not mine to decide:** the `authenticated` EXECUTE ruling gates how much of step 3 is
possible at all (42 of 69 sites), so I would want it before writing SQL rather than after.

### 2026-09-14 — T7 plan reviewed (lead; full plan review): CHANGES REQUESTED on two points, R-4 REFRAMED

Plan `5d7d3540`. Accepted as written: (a) the site list from the comment-stripped catalog (89
catalog-wide carrying the layer-1 gate; 69 declared for the 20 rows = 42 policy + 25 DEFINER + 1
ts), (c) every field T7 edits shown EMITTED (nine manifest tables; L6 makes the flip survivable —
§ 6.2 roots from `armInterface` before and `enforcementSites` after), (d) the seven-step red-first
order with each witness named before its step, and the settle-then-measure catch (a catalog read
46 s after a container restart returned the OPPOSITE answer; two equal `information_schema` counts
now precede every measurement — lead's memory + LESSONS candidate).

**B1 — (b) narrows an approval.** The plan says the re-key does NOTHING with
`app.can_reach_case_on_member_surface`; the PO-approved matrix § 8.3 (`:961`) makes it row 9's
re-key target AND a T7 work item to WIRE it at the four sites testing its bit inline
(`_project_meeting_case`, `_project_meeting_agenda_item`, `get_reserved_session_items`,
`resolve_document_version_bytes`), its stale comment corrected. A3's intent is that a designated
authority HAS callers, not that doors without callers stay untouched. Required: the wiring planned,
census 0 → 4 callers, or a measured reason to take § 8.3 back to the PO.

**B2 — the gate-15 count is derived for the wrong caller.** (a) counts policies calling the
wrapper DIRECTLY; T7's design re-keys policies onto layer-3 `app.can_<code>` DEFINER doors that
call the wrapper INSIDE their bodies, where the privilege check is against the owner — so the
wrapper needs no `authenticated` EXECUTE; the N new layer-3 doors do, exactly the shape AE4's
re-key put through gate 15. Required: N and the policy sites per door; how gate 15 absorbed AE4's
N (script + current count/ceiling, quoted); whether ANY site must call the wrapper from a policy
directly (zero ⇒ R-4 as posed is moot). **R-4 reframed under § Open rulings accordingly** — the
PO is not asked the wrong question. SQL waits for backend's answer and for R-4/R-5. T12 (`425`)
dispatched to the tester for step 1's no-movement witness — independent of both.

### 2026-09-14 — T7 plan, findings B1 and B2 answered (backend) — still NO SQL

Read `docs/design/authz-ae5-staff-permission-matrix.md:961–982` whole before answering, and
re-measured both on the settled catalog.

#### B1 — CONCEDED. § 8.3 is right and my plan narrowed an approved matrix.

§ 8.3's last paragraph is not a description, it is an instruction: *"**T7 work item:** row 9's
re-key target is this predicate, and re-keying it is not enough — it must be **WIRED**. A layer-3
authorizer carrying `commission.cases.deliberation.read` as a greppable literal that nothing calls
satisfies the grep and enforces nothing."* My "the re-key does nothing with it" contradicted that,
and the reasoning I used to justify it **inverted A3**: A3 exists so that a designated authority HAS
callers, not so that we leave one without. ⛔ Leaving a zero-caller designated authority in place
one increment after A3 would be the exact defect A3 was written to prevent, committed deliberately.

**Measured, and it confirms § 8.3 in every particular:**

| site | prosecdef | search_path | tests the bit INLINE | calls the authority |
| --- | --- | --- | --- | --- |
| `app._project_meeting_case` | t | `''` | **yes** | no |
| `app._project_meeting_agenda_item` | t | `''` | **yes** | no |
| `public.get_reserved_session_items` | t | `''` | **yes** | no |
| `app.resolve_document_version_bytes` | t | `app, public, pg_catalog` | **yes** | no |
| `app.can_reach_case_on_member_surface` (the authority) | t | `app, public, pg_catalog` | — | ACL carries `authenticated=X` |

**The wiring, planned.** Row 9's layer-3 door carries `commission.cases.deliberation.read` as a
greppable literal; the authority becomes its body (its semantics already ARE the bit — § 8.3);
the four inline sites call it, each gaining a `-- door-sweep-targets:` entry; the stale comment is
corrected (it still warns against `can_read_case_or_admin`, **retired** by `20260814000000`).
**Census witness: its caller count goes 0 → 4**, asserted as a number, and the four sites' inline
copies of the bit are deleted in the same migration — a wired door beside four surviving inline
copies is five authorities, not one.
⚠ **Two of the five objects sit on the legacy frozen path** (`app, public, pg_catalog`), not `''`.
ADR 0208 D4 puts any new/touched DEFINER on the empty path, so touching them moves them OFF
`419`'s frozen baseline: **860 → 858**, with `421`'s empty-path population rising correspondingly.
That is a gate-18/419 movement T7 must state in advance, not discover.

#### B2 — CONCEDED, and the re-derivation changes the question being asked.

My (a) counted policy sites calling the WRAPPER directly. Under T7's own design no policy does that:
each policy calls its code's layer-3 `app.can_<code>` DEFINER door, and the wrapper is called INSIDE
that door's body, where the privilege check is against the owner. I stated that rule in (a) and then
failed to apply it to my own step 3.

**(i) N, and the fan-out.** T7 creates **20** layer-3 doors, one per staff row. Of these:
- **13 are called from at least one POLICY** → those 13 need `authenticated` EXECUTE. The 42 policy
  sites fan onto them: `forms.read` 9 · `process_templates.read` 9 · `accreditation.read` 4 ·
  `roster.read` 4 · `cases.vocabulary.read` 3 · `documents.read` 3 · `meetings.read` 3 ·
  `indicators.read` 2 · `action_items.read` 1 · `charter.read` 1 ·
  `meetings.cases.shell.read` 1 · `meetings.minutes.sign` 1 · `responses.create` 1.
- **7 are called only from DEFINER bodies** and need NO grant: `capa.read`,
  `cases.deliberation.read`, `cases.vote`, `referrals.metadata.read`, `referrals.notes.author`,
  `safety_events.read`, `safety_events.report`.

**(ii) How gate 15 absorbed AE4's N.** The gate is `scripts/check-budget-anchor.mjs`, reading ONE
machine-readable line in `docs/backend-state/authorization-and-audit.md:178`:
`<!-- BUDGET-ANCHOR ceiling=759 app=326 public=433 total=759 -->`, mirrored against the literals in
`320 § U4`. The budget is **`authenticated`-executable SECURITY DEFINER functions in `app` +
`public`**. Its merge rule, quoted: *"no increment may raise the count without a **named
justification in its own gate record**, and **the ceiling moves only by PO ruling**."*
AE4's re-key produced **4** code-carrying doors, of which **3** are `authenticated`-executable
(`app.can_edit_commission_forms`, `app.can_read_professional_profile`,
`app.current_professional_read_organizations`; `app.can_create_professional` is NOT). The ceiling
moved **752 → 759 (+7)** by PO ruling 2026-09-08, and AE4's doors were absorbed inside that move.
⛔ **MEASURED TODAY THE BUDGET IS EXACTLY AT THE CEILING: 759 = app 326 + public 433**, matching
the anchor to the unit. **Headroom is ZERO.**

**(iii) Does any site need to call the wrapper DIRECTLY from a policy? — measured NO, zero.**
Every one of the 42 policy sites is a policy on a table whose code has a layer-3 door; none requires
the wrapper in its own expression. ⇒ **R-4 as posed is MOOT**: `app.is_commission_staff_of(_for)`
can stay `service_role`-only forever, and T6's deferral was the right call for a reason other than
the one stated.

⭐ **THE QUESTION THE PO SHOULD ACTUALLY BE ASKED** is therefore not "grant `authenticated` on two
wrappers" but: **move gate 15's ceiling 759 → 772 (+13) for T7's policy-called layer-3 doors, under
the same merge rule AE4 used.** ⚠ And the comparison is not flattering by itself — AE4 added 3
against a ceiling that then moved +7; T7 adds **13 against zero headroom**. Options I can measure if
the lead wants them before the PO sees it: (1) one door per code as designed (+13); (2) fewer,
coarser doors shared across codes (breaks the greppable-literal-per-code property the re-key exists
for); (3) keep the highest-fan-out codes on a layer-1 gate this increment (`forms.read` and
`process_templates.read` alone are 18 of the 42 sites but only 2 of the 13 doors — so deferring
them saves 2 doors, not 18: the count is DOORS, not sites, which is the arithmetic that makes
option 3 much weaker than it looks).

⚠ Nothing under `supabase/` changed. SQL waits for the lead's ack and for R-4 (as reframed) and R-5.

### 2026-09-14 — T7 plan ACKED with conditions C1–C4 (lead); R-4 FINALISED as a gate-15 ceiling ruling

Backend's answer `75f8b617`. **B1 conceded, measured:** the four inline sites (`_project_meeting_case`,
`_project_meeting_agenda_item`, `get_reserved_session_items` — DEFINER, `search_path ''`;
`resolve_document_version_bytes` — DEFINER, `app, public, pg_catalog`) each test row 9's bit inline
and call no authority; the authority itself carries `authenticated=X` and the stale comment. **B2
conceded:** T7 creates **20** layer-3 doors — **13 policy-called** (the 42 policy sites fan onto
them: `forms.read` 9, `process_templates.read` 9, `accreditation.read` 4, `roster.read` 4, then
3/3/3/2/1×5) and **7 DEFINER-only**; gate 15 is `scripts/check-budget-anchor.mjs` reading
`docs/backend-state/authorization-and-audit.md:178` `ceiling=759 app=326 public=433 total=759`,
merge rule *"the ceiling moves only by PO ruling"*, AE4 moved it 752 → 759 (+7) for 3 doors; **live
today 759 = 326 + 433, headroom ZERO**; **zero** sites need the wrapper from a policy directly ⇒ the
two-wrapper question is MOOT, the wrappers stay `service_role`-only.

**ACK, conditions:** **C1** row 9's door WIRED — the four inline copies deleted in the same
migration as the wiring (a wired door beside four copies is five authorities), the comment
corrected, census witness 0 → 4 callers, each a `-- door-sweep-targets:` entry. **C2** the two
frozen-path touches move `419`'s baseline 860 → 858 — attributed by name in the gate record, never
re-pinned bare. **C3** ⛔ no SQL that adds an `authenticated`-executable door before R-4 is ruled;
the migration is ONE atomic re-key, not split around the ruling. **C4** the mitigation arithmetic
stays in front of the PO: deferring `forms.read` + `process_templates.read` drops 18 of 42 sites but
only 2 of 13 doors — the budget counts DOORS. Execution order stays (d)'s seven steps; step 1
(`425` no-movement) is the tester's and is in flight.

**R-4 finalised (§ Open rulings):** move gate 15's ceiling **759 → 772 (+13)** under AE4's merge
rule, with T7's gate record as the named justification — or hold it and name which of the 13
policy-called doors T7 leaves un-re-keyed. The PO's chip re-issued with this question.

### 2026-09-14 — `424` run 7 GREEN post-cutover under L12 (tester); committed by path (lead)

Reset exit 0 with the cutover migration applied; `424-run7-post-cutover.log` `Files=2, Tests=24,
Result: PASS`. Test 11 verbatim (raw TAP side-capture via psql, plan `1..23`):
`ok 11 - 3.2b ⭐ PRECONDITION mirroring 403's §3.2b from `staff`'s side: `staff` was in
`test_validation` until the T6 cutover (`31b73837`, observed RED at `66603273`'s run on 2026-09-14),
`authoritative` since. `candidate_has_permission` reads roles in EITHER state, so it remains the
correct oracle for this suite's cells before and after the flip.` — the control asserts ONE state
and carries the other as history, as L12 required. § 6's mutation/restore pair (19–21) `ok`;
`authz.roles.state` for `staff` re-checked `authoritative` after the side-capture. ⚠ The side-capture
again ran `create extension pgtap` in autocommit and dropped it after (`pg_extension` 0) — a
deliberate, reverted stack change this time, noted so the pattern is visible: the raw-TAP capture
needs a harness path that does not touch extensions (LESSONS candidate at Record). Byte-count guard
0; committed. Tester proceeds to T12 (`425`).

### 2026-09-14 — T7 pre-work under C1–C4 (backend): gate-record skeleton, OFFLINE dry run, run book

⛔ Nothing under `supabase/` moved — `git status` on `supabase/` and `scripts/` is clean apart
from the tester's own `424`. The dry run wrote only inside the session scratchpad. No DB read was
needed for any of it: every figure comes from the manifest JSON and the generator, so the tester
kept the stack for `424` run 7 and `425` throughout.

#### (1) The T7 gate-record skeleton — the named justification gate 15's merge rule requires

Merge rule, quoted from `docs/backend-state/authorization-and-audit.md`: *"no increment may raise
the count without a **named justification in its own gate record**, and **the ceiling moves only by
PO ruling**."* This is that justification, pre-written so the PO rules on a filled form.

**The 13 doors that need `authenticated` EXECUTE, by name, with the policy sites that call each:**

| # | permission code | policy sites |
| ---: | --- | ---: |
| 1 | `commission.forms.read` | 9 |
| 2 | `commission.process_templates.read` | 9 |
| 3 | `commission.accreditation.read` | 4 |
| 4 | `commission.roster.read` | 4 |
| 5 | `commission.cases.vocabulary.read` | 3 |
| 6 | `commission.documents.read` | 3 |
| 7 | `commission.meetings.read` | 3 |
| 8 | `commission.indicators.read` | 2 |
| 9 | `commission.action_items.read` | 1 |
| 10 | `commission.charter.read` | 1 |
| 11 | `commission.meetings.cases.shell.read` | 1 |
| 12 | `commission.meetings.minutes.sign` | 1 |
| 13 | `commission.responses.create` | 1 |
| | **total** | **42** |

**The 7 doors that need NO grant** (called only from DEFINER bodies, where the privilege check is
against the owner): `commission.capa.read` · `commission.cases.deliberation.read` ·
`commission.cases.vote` · `commission.referrals.metadata.read` ·
`commission.referrals.notes.author` · `commission.safety_events.read` ·
`commission.safety_events.report`.

**C4 — the door-vs-site arithmetic, kept in front of the PO exactly as stated:** the budget counts
**DOORS, not SITES**. Deferring the two highest-fan-out codes removes **18 of 42 sites but only 2 of
13 doors**. Any mitigation that reasons in sites will overstate its own saving by ~9×.
**Ask: ceiling 759 → 772 (+13)**, against a budget measured today at exactly 759 = app 326 +
public 433 — **zero headroom**. Precedent: AE4's re-key added **3** such doors and the ceiling
moved 752 → 759 (+7) by PO ruling 2026-09-08.

**C1 — the wiring census for row 9**, as a line the gate record will carry:
`app.can_reach_case_on_member_surface` callers **0 → 4** (`app._project_meeting_case`,
`app._project_meeting_agenda_item`, `public.get_reserved_session_items`,
`app.resolve_document_version_bytes`), the four inline copies of the bit DELETED in the same
migration, the stale comment corrected, each site a `-- door-sweep-targets:` entry.
**C2 —** two of those objects sit on the legacy frozen path, so `419`'s baseline moves
**860 → 858**, attributed by name (`app.resolve_document_version_bytes` and
`app.can_reach_case_on_member_surface`), never re-pinned bare.

#### (2) The OFFLINE dry run — measured, not predicted

A complete scratch root (`scripts/` + `supabase/tests/vectors/*.json` copied into the scratchpad;
the generator derives `ROOT` from its own location, so it read and wrote only there). The draft
flips all 20 rows and moves their sites.

| emitted | HEAD | DRAFT |
| --- | ---: | ---: |
| manifest rows | 61 | 61 |
|   `re-keyed` / `pending-rekey` | 3 / 58 | **23 / 38** |
| `authz_manifest_sites` rows | 13 | **79** (+66 = 42 policy + 24 function) |
| `authz_manifest_arm_sites` rows | 69 | **0** — the EMPTY typed form |

⭐⭐ **THE DRY RUN EARNED ITS KEEP: five structural rules found before any SQL**, each a refusal
from the generator's own validator, each one I would otherwise have hit in a migration:
1. *"the authorizer composes `app.is_commission_staff_of_for`, which is neither the permission arm
   (`authz.has_permission`) nor a declared `residualLegacyAuthority` — a re-keyed row may not hide
   a non-permission grant path."* ⇒ the layer-3 door composes **only** `authz.has_permission`; the
   wrapper is an implementation detail INSIDE it, not a composed authority. That is a design
   clarification, not a data fix.
2. `definerSurface[*].writes` must be a non-empty list — *"a DEFINER writer that writes nothing is
   not a member of this surface."* ⇒ the 24 read-authorizer functions are **enforcement sites**,
   not definerSurface members.
3. A function-kind enforcement site must carry `relation: null` **explicitly**.
4. A `re-keyed` row may not still carry a `pendingRekey` block.
5. `nonEnforcementConsumers[*].kind` admits only `policy | function` — so § 8.4's two audited-read
   registry legs are recorded as `function` consumers with the mirror reason.

⛔⛔ **AND ONE PREDICTED RED THAT IS MINE.** When every staff row is re-keyed, `arm_sites`
becomes EMPTY — measured above. `410` § 6.3 carries a conjunct **I added at L6**:
`(select count(*) ... join authz_manifest_arm_sites ...) > 0`, written because that domain then
supplied 20 of 23 measured rows. T7 empties it, so **§ 6.3 goes RED at the moment T7 completes**,
for a correct reason. It must be re-ruled in the same migration — the honest form is "non-empty
**or** no row remains `pending-rekey`", never deleted — and it belongs in step 6's witness list
below. ⚠ A conjunct that becomes false when the work SUCCEEDS is the shape that gets deleted in a
hurry; naming it now is what stops that.

#### (3) The run book — exact commands and the witness line to read, per step of (d)

⚠ `pg_stat_activity` first, and settle-check (two equal `information_schema.tables` counts) after
any reset before believing a number.

| # | command | expected witness |
| ---: | --- | --- |
| 1 | `supabase test db supabase/tests/00_setup.sql supabase/tests/425_*.sql --local` | **exit 1**, and the grant-deletion pairs show **no movement** pre-migration |
| 2 | `supabase test db supabase/tests/00_setup.sql supabase/tests/410_*.sql --local` | **exit 1** on § 8.1 naming each row whose declared sites do not reach its code; § 8.2's positive half stays green |
| 3 | `supabase db reset --local` then `supabase test db ... 421_*.sql` | § 0c `892 = 860 + 32` → `892 + N`; § 2a `13 visited → 13 + N visited | 0 findings`; `419` baseline `860 → 858` |
| 4 | `supabase test db ... 425_*.sql` | **exit 0**, and the same pairs now DISCRIMINATE — step 1's no-movement reading is what makes this evidence |
| 5 | `node scripts/gen-authz-matrix-cells.mjs` | per-row `hardDenyClasses` old → new, re-derived on the extended instrument |
| 6 | `supabase test db ... 410_*.sql` | `authz_manifest_sites` **13 → 79**, `arm_sites` **69 → 0**, § 6.3's re-ruled conjunct green, § 6.2 unchanged in shape |
| 7 | `npm run lint` · `npm run lint:authz-vectors` · `npm run test:db` | all **exit 0** bare; gate 15 green only after R-4 |

⚠ Step 3 is the one that cannot start until **R-4** is ruled (C3: ONE atomic migration, not split
around the ruling), and step 6's § 6.3 re-rule is the one red I have pre-declared as mine.

### 2026-09-14 — T7 pre-work received (`f015a03f`); L13 on `410` § 6.3's non-emptiness conjunct; C5 raised (lead)

Backend, no DB read: gate-record skeleton (13 policy-called doors by name and fan-out = 42 sites; 7
DEFINER-only; C1 census 0 → 4; C2 `860 → 858` attributed to `app.resolve_document_version_bytes`
and `app.can_reach_case_on_member_surface`; C4 verbatim). **Offline dry run, measured on a scratch
root:** re-keyed / pending 3/58 → 23/38; `authz_manifest_sites` 13 → 79; `arm_sites` 69 → 0; five
structural refusals from the generator's own validator before any SQL — the load-bearing one: *a
re-keyed row may not hide a non-permission grant path* ⇒ the layer-3 door composes ONLY
`authz.has_permission`; the 24 read-authorizers are enforcement sites, not `definerSurface`
members. Run book: seven steps, each with its command and the witness line read bare; step 3 waits
on R-4 (C3).

**Pre-declared red, backend's own:** the § 6.3 non-emptiness conjunct added at L6 asserts the
arm-sites domain is non-empty — T7 empties it, so § 6.3 goes RED at the moment T7 SUCCEEDS.
**L13 (lead, mechanism):** re-rule it in the same migration as *"arm-sites non-empty OR no row left
`pending-rekey`"* — never deleted — AND keep its discrimination half: the re-ruled conjunct must be
shown RED on a mutated manifest holding one `pending-rekey` row with zero arm sites (the case the
escape must not silence), and the § 6.2 / § 8 arms must be shown RED on a `re-keyed` row with zero
`enforcementSites` (the case the OTHER side of the OR now owns). A conjunct that becomes false
when the work succeeds is the shape that gets deleted in a hurry; this one is re-ruled with both
halves witnessed, recorded before step 6.

**C5 — the wrapper's callers after T7.** If the layer-3 doors compose only `authz.has_permission`
and the wrapper `app.is_commission_staff_of(_for)` is "an implementation detail inside", then
after T7 the wrapper may have ZERO production callers — the designated-authority-with-no-callers
shape A3 and matrix § 8.3 were written against, one commit after we wired row 9's door for exactly
that reason. ADR 0211's own consequence: re-express `app.is_member_of(_for)` as the disjunction of
the two single-role wrappers *once both commission roles are authoritative* — which is NOW (T6
flipped `staff`; `staff_admin` was). Required of backend: the wrapper's caller census as T7 leaves
it, and either (a) the re-expression of `is_member_of(_for)` in T7 (its own snapshot/assert, its
own 425 pair, its own PA-F8 disposition — the hat gate R-2/P1 already covers it), or (b) a measured
reason to defer it to a NAMED unit, stated in ADR 0211 so the PO's R-5 review sees it. Not a PO
ruling by itself; it changes what R-5 approves.

### 2026-09-14 — PO rulings on R-4 · R-5 (PO session)

Presented to the PO in this session: R-4 first in the chip's T6 form (the two-wrapper grant), then
re-presented in its FINAL form from § Open rulings at `fd685cd2` after the lead's cross-session
message (the two-wrapper question moot; 13 policy-called layer-3 doors against zero headroom). The
live budget was measured by this session with `320 § U4`'s own query, read-only via the DB
container, before the presentation: **app 326 · public 433 · total 759**, ceiling 759, headroom 0;
`npm run lint:budget-anchor` OK on the committed texts. The wrappers' ACLs re-read live:
`postgres` + `service_role` only, `authenticated` refused with "permission denied". A postgres-owned
DEFINER calling the wrapper under `set local role authenticated` was shown to succeed in a
rolled-back transaction, nothing persisted — the mechanism the final form rests on, measured.

**R-4 — the PO's ruling, VERBATIM:**

> R‑4 — option (a), APPROVED. Gate 15's ceiling moves from 759 to 772, with the
> authenticated-executable app population moving 326 to 339 and public remaining 433. The increase
> is attributed exclusively to T7's 13 policy-called, per-permission layer‑3 authorizers, whose 42
> policy callers are enumerated in the T7 gate record.
> The seven DEFINER-only authorizers receive no authenticated grant. app.is_commission_staff_of(_for)
> remains service_role-only; no policy calls either wrapper directly. The ceiling, budget anchor,
> and 320 §U4 literals move in the same atomic re-key commit.
> This ruling authorizes exactly these 13 doors, not general headroom. A fourteenth
> authenticated-executable door, a change in the enumerated caller mapping, or an unexpected live
> count requires a new ruling. Completion requires the post-migration live catalog to measure
> app=339, public=433, total=772, in addition to gate 15's committed-text check.

**R-5 — the PO's ruling, VERBATIM** (given after the PO-session evaluation of the same text as a
draft; the PO reaffirmed it unchanged):

> R‑5: accept ADR 0211 and mark it accepted.
> D2's three-part obligation is satisfied:
> - security properties were captured and asserted;
> - the restricted differential went RED then GREEN, with the unrestricted disagreement proving the
>   restriction is load-bearing;
> - hat polarity, principal-state cells, and the two structural premises were individually asserted.
> The former 424 red was a stale state control, not a failed oracle. The targeted suite now passes
> after that control was re-pointed without widening it.
> I would make one editorial correction alongside acceptance: D3's sequencing sentence (line 185)
> still says the is_member_of re-expression lands in the same migration as the state flip, although
> T6 deliberately did not do that. Change it to reflect the actual T7/per-site sequencing. This does
> not weaken D2 or justify delaying acceptance.
> Suggested ruling:
> R‑5 — ACCEPTED. ADR 0211 moves from proposed to accepted; its D2 proof obligation is satisfied by
> the migration snapshot/assert, the restricted RED→GREEN differential including A1/A2, and the
> asserted PA‑F8‑STAFF‑2 structural premises. ADR 0211 governs T7: enforcement policies target
> layer‑3 authorizers, not the layer‑1 staff wrapper. Amend D3's stale same-migration sequencing
> sentence to match the approved T7/per-site sequence.

**Applied by this session:** ADR 0211 `**Status:**` proposed → accepted (header line only) and
`npm run adr:index` re-run; gate 9's `proposed-review.json` stamp refreshed (0211 left the proposed set,
`reviewed` 2026-09-14) because the gate reds on set drift. ⛔ **The D3 `:185` amendment is NOT applied here** — the PO-session's
scope is the Status line; the body edit (with its `**Amended:**` header line) is owed to the ADR's
owner. **Evaluation note recorded beside the ruling, not against it:** the PO-session evaluation
(chat, before the ruling) said the `:185` sentence is about re-expressing the PREDICATE BODY of
`is_member_of(_for)` — an evaluator change across 82 dependents gated on R-2's disposition — not
about T7's per-SITE re-key, and that both commission roles being authoritative now makes the
sentence read as due; the lead's C5 (`60f79569`) requires backend to either re-express it in T7 or
state a measured deferral to a NAMED unit in ADR 0211 itself. The PO reaffirmed the ruling's wording
as given; whichever of C5's branches lands is what the amended sentence should say. `424`'s
re-point: observed green in the tester's scoped run (24/24) and committed at `bf585a83`.

### 2026-09-14 — L13 witnesses and C5 answered (backend) — still NO SQL

Stack settle-checked before every read: 0 active peers, container up 16 min, `public` table count
**171 then 171**. Nothing under `supabase/` moved.

#### L13 — the re-ruled § 6.3 conjunct, both halves witnessed

The conjunct becomes **"arm-sites non-empty OR no row left `pending-rekey`"** — never deleted. Two
step-6 witnesses, added to the run book:

| # | mutation | expected line |
| --- | --- | --- |
| 6a | a manifest holding ONE `pending-rekey` row with ZERO arm sites | § 6.3 **RED**: the OR's left half is false (no arm sites) and its right half is false (a row IS still pending-rekey) — the only state in which the control must fire, and the state a half-finished T7 leaves behind |
| 6b | a `re-keyed` row with ZERO `enforcementSites` | § 6.2 **RED** naming that row with `have: (none)` against its committed `hardDenyClasses`, and § 8.1 **RED** because a declared-but-empty site list cannot reach the code — the case the OR's right half now owns |

⭐ 6b is the half that matters: once "no row is pending-rekey" can satisfy the conjunct, a row that
re-keyed to NOTHING would otherwise sail through § 6.3. The OR is only safe because § 6.2/§ 8
own that case, so both are witnessed together or the re-rule is a widening.

#### C5 (a) — the wrapper's caller census as T7 would leave it: **ZERO**

Comment-stripped sweep of `pg_policies` + `pg_proc` in `public`/`app`/`authz`:
**`app.is_commission_staff_of(_for)` — 0 policies, 0 function bodies.** T7 as planned does not
change that: the layer-3 doors compose only `authz.has_permission`, so the wrapper stays uncalled.
⛔ **The lead's reading is correct** — that mints the designated-authority-with-no-callers shape
one commit after wiring row 9's door precisely against it.
For contrast, `app.is_member_of(_for)` today has **82** callers: **40 policies + 42 function bodies**
— the figure ADR 0211 D3 names.

#### C5 (b) — the re-expression is AVAILABLE and answer-preserving; measured

- **Precondition MET.** Exactly **two** commission-scoped roles exist — `staff` and `staff_admin`
  — and since T6 **both are `authoritative`**. Commission-scope memberships carry only those two
  (20 `staff`, 4 `staff_admin`).
- **The twin already has the identical shape.** `app.is_staff_admin_of` is
  `select authz.holds_role((select auth.uid()), 'staff_admin', 'commission', p_commission_id)` —
  the same single-role wrapper I built for `staff`. The disjunction is genuinely two of a kind.
- **The planes differ on 2 of 24 rows, and the difference is NOT an answer.**
  `has_role_any` reads `public.memberships`; `holds_role` reads `authz.assignment_facts`.
  Measured: **22 tuples in both, 0 facts-only, 2 memberships-only** — and the 2 are exactly
  `gap.deactivated` (`is_active=f`) and `suspenso.temp` (suspended). `is_member_of` filters them
  with its OWN wrapper-level `app.is_active(auth.uid())`; `assignment_facts` filters them at the
  FACTS level. ⭐ Same two principals denied on both sides — this is the level-vs-answer
  distinction `426` § A2 already measured across all four principal states. The hat is likewise
  preserved: `has_role_any` and `holds_role` carry the SAME trailing term, and the third-party
  `_for` forms ignore it on both sides. **PA-F8: R-2/P1's hat gate already covers the behaviour
  change; I am not re-opening it.**

#### C5 (b) — my recommendation: DEFER to a named unit, for a reason `425` cannot cover

⛔ **The decisive measurement is not the equivalence — it is that `425` CANNOT WITNESS THIS.**
`425` is a **grant-deletion** differential: it deletes an `authz.role_permissions` row and requires
the door to flip. The re-expression lives on the **ROLE** plane, not the permission plane —
deleting a grant moves `is_member_of` by exactly nothing, before or after. So the polarity pair T7
uses for every other site is structurally blind to the one change that would give the wrapper its
callers. It needs a **membership-deletion** pair instead (delete the `memberships` row → both
sides deny; restore → both grant), which is a different fixture, a different suite, and a different
red-first order.
Second, the size: T7 is already ONE atomic migration carrying 20 doors, 66 site re-keys and row 9's
wiring; adding a re-expression of a predicate with **82 dependents** puts two unrelated risks —
code-keying and a plane migration — in one commit whose rollback is all-or-nothing.

**Proposed named unit: `AE5-MEMBER-PREDICATE-REEXPRESSION`**, carrying its own before/after snapshot
of the four properties for `is_member_of(_for)`, its own membership-deletion polarity pair, and the
82-dependent census as its acceptance criterion.

⚠ **AND THE DEFERRAL HAS A COST THAT MUST BE RECORDED, NOT ABSORBED.** Condition **A3** allow-listed
the wrapper as a zero-caller authority with **owner `backend`, expiry `T7`**. Deferring past T7 moves
that expiry, so the ADR text must say so — otherwise the allow-list silently outlives its own
expiry, which is the failure A3 exists to prevent. **Proposed ADR 0211 amendment, for the PO's R-5:**

> **D1 amendment (2026-09-14).** `app.is_commission_staff_of(_for)` is created by T6 and remains
> **intentionally caller-less through T7**: T7's layer-3 doors compose `authz.has_permission` alone,
> because a re-keyed row may not compose a non-permission grant path (the generator refuses it).
> Its first callers arrive with the re-expression of `app.is_member_of(_for)` as
> `is_commission_staff_of(c) OR is_staff_admin_of(c)`, which D3 makes available now that both
> commission roles are `authoritative`. That re-expression is **deferred to
> `AE5-MEMBER-PREDICATE-REEXPRESSION`** for a measured reason: the grant-deletion differential
> (`425`) is structurally blind to a role-plane change, so it requires a membership-deletion pair of
> its own. **A3's zero-caller allow-list therefore moves its expiry from `T7` to that unit**, owner
> `backend`. ⛔ The allow-list is not renewed silently: this clause IS the renewal, and the unit
> name is its bound.

⚠ If the lead or PO prefers it INSIDE T7 instead, the measurement above says it is safe to do so
— the blocker is witnessing, not correctness — and the cost is that `425` must gain a
membership-deletion arm before step 1, which moves T7's red-first order rather than extending it.

### 2026-09-14 — PO rulings R-4 · R-5 VERIFIED in the record (`f8a66457`); AC-6 ticked; L14 on C5 — deferral accepted with its bound; C3 LIFTED (lead)

Verified by the lead, not relayed: `f8a66457` touches exactly four files by path (record +65, ADR
0211 Status line, `INDEX.md`, `proposed-review.json`), the two rulings are quoted VERBATIM under the
PO-session entry, ADR 0211 `**Status:** accepted`, the stamp `reviewed 2026-09-14`, `npm run lint`
exit 0 at that HEAD. The PO session measured the budget itself with `320 § U4`'s query (326 · 433 ·
759) before presenting, re-read the wrappers' ACLs live, and showed the DEFINER-calls-wrapper
mechanism in a rolled-back transaction — the presentation rested on measurements, not on the
chip's stale wording. **R-4:** (a) approved, ceiling 759 → 772, `app` 326 → 339, `public` 433,
attributed to exactly the 13 policy-called doors; anchor + `320 § U4` literals move in the same
atomic commit; completion = the post-migration LIVE catalog at 339/433/772; a 14th door or a
changed caller mapping needs a new ruling. **R-5:** accepted; D3 `:185` amendment ORDERED, owed to
the ADR owner with an `**Amended:**` header; C5's branch decides the sentence. **AC-6 ticked** on
T6's entry + R-5.

**C5 answered (`b28b69c8`), measured:** wrapper census after T7 = 0 policies, 0 bodies (the lead's
reading confirmed); `is_member_of(_for)` = 82 (40 + 42); exactly two commission roles, both
authoritative; the re-expression is answer-preserving today (22 tuples in both planes, 0
facts-only, 2 memberships-only = `gap.deactivated` + `suspenso.temp`, filtered at the wrapper level
vs the facts level — 426 § A2's distinction). **L14 (lead, mechanism): the deferral is ACCEPTED**
for the reason given, which is about witnessing, not size — `425` deletes an `authz.role_permissions`
row and the re-expression lives on the MEMBERSHIP plane, where a grant deletion moves
`is_member_of` by nothing; it needs a membership-deletion pair, its own suite and its own red-first
order. The named unit is **`AE5-MEMBER-PREDICATE-REEXPRESSION`**; A3's allow-list of the wrapper
(expiry: T7) is RENEWED by the deferral clause itself, bound to that unit — so ADR 0211 is amended
in two places by its owner under one `**Amended:**` header: D1 (the deferral + renewed bound) and
D3 `:185` (the PO's ordered sentence: per-site re-key in T7, predicate re-expression in the named
unit). ⚠ The lead states to the PO at the T7 gate that a designated authority with ZERO production
callers stands for one unit under a named bound; that is the cost recorded, not absorbed. Follow-up
filed by backend with the bound as its closes-when. L13's 6a/6b witnesses are in the run book.

**C3 lifted:** T7's SQL may be written. ⛔ The incident rule holds — the migration is authored in
the session scratchpad and enters `supabase/migrations/` only after the tester's `425` no-movement
witness is captured on the PRE-migration catalog (run-book step 1).

### 2026-09-14 — T12 `425` written and run: the NO-MOVEMENT witness captured on the pre-migration catalog (tester); committed by path (lead)

Design: § 1 transcribes the manifest's 20 `armInterface` rows into `f425_sites` (69 rows,
cardinality-pinned 1.1–1.6); a generic driver captures a text SIGNATURE per site (`count(*)` for
policy sites under `staff4.ccih`'s claims; the cast return value for DEFINER/registry sites); one
delete/restore cycle per code (20; mutation landed × 20, restore proven × 20 — 409 § 2.7/2.16's
idiom); aggregate assertions over all 20. Log `425-run-final.log`, plan `1..18`, 17 green + 1
red-by-design. **Step 1's witness, verbatim:** `ok 12 - 3.1 ⭐⭐ THE WITNESS THIS FILE EXISTS TO
PRODUCE — NO MOVEMENT. Across all 20 codes' live-probed sites, deleting `staff`'s permission-code
grant changed NOT ONE signature. …` — pre-T7 the 69 sites gate on role membership, never on the
code, exactly the manifest's `callGraphBoundary.reason`. **The mirror, red by design:** `not ok 13
- 3.2 … have: 10, want: 57` (the 10 are sites on tables empty at baseline — denied both before and
after, named and excluded from § 2.0's positive control too). **Scope cuts, in the file header:** 9
of 25 distinct DEFINER functions not called live — 5 volatile/write or PHI-audit-logged
(`cast_case_vote`, `create_referral_internal_note`, `notify_safety_event`, `sign_meeting`,
`get_referral_case_access_summary`), 4 blocked by EMPTY tables (`accreditation_standards` for
`get_standard_assessment` / `readiness_evidence` / `readiness_report`; `referral_internal_notes`
for `can_read_referral_internal_note`) — all 9 under a static `prosrc`-literal check (§ 3, green);
2 of 42 policy sites (`responses_insert_own`, `meeting_signatures_insert`) are INSERT/WITH CHECK,
named-skipped. Fixture gaps → the tester's register; backend fills the two tables before step 4
so four more doors are probed live. Byte-count guard 0; committed. **Step 1 of T7's run book is
DONE; backend cleared for step 3 the moment its scratchpad files are ready.**

### 2026-09-14 — T7 step 2, first pass (backend, scratchpad only): the 20 doors land R-4's criterion exactly (lead)

`t7-wip/part1_doors.sql`: 20 layer-3 doors, each carrying its code as a greppable literal, DEFINER,
`search_path=''`, schema-qualified, `revoke all from public`, `service_role` always, `authenticated`
on exactly the 13 policy-called doors — measured in a rolled-back transaction against the live
catalog: **`app=339 public=433 total=772`**, 326 → 339 = the 13. Each composes `authz.has_permission`
alone (ADR 0211 D1 as amended, enforced by the manifest validator). De-risk measurements: the 42
policy sites sit on 42 distinct relations; 39 carry exactly one bare `app.is_member_of(` call
(mechanical rewrite); 3 hand-treated and NAMED (`meeting_cases_select` via `can_reach_meeting`;
`meeting_signatures_insert` and `responses_insert_own` — INSERT, logic in `with_check`). Not yet
written, stated plainly by backend: the 42 rewrites, the 24 function-site re-keys, C1's wiring, the
two seed tables, the manifest flip with L13, the anchor + `320 § U4` literals. Nothing in
`supabase/`. Lead's guards for the next pass: generate rewrites FROM the live qual and DIFF the live
result against the expectation post-apply (`42/42 identical` quoted); touched DEFINERs re-emitted
whole via `pg_get_functiondef` (ALTER never re-validates a body).

### 2026-09-14 — T7 step 2, second pass (backend, scratchpad): 40/42 policies re-keyed and DIFFED, two matcher traps caught (lead)

`part2_policies.sql`: 40 of 42 policy re-keys generated FROM the live `pg_policies` snapshot
(`INPUT_live_quals.txt` kept), one substitution each, every other conjunct carried through;
applied in a rolled-back transaction and diffed back out of the catalog — **40/40 identical**, and
the discrimination half: **40/40 live quals now contain a layer-3 door, 0 still contain a bare
`app.is_member_of(`**. `HAND_policies.md`: the 2 non-uniform sites with old text quoted
(`meeting_cases_select` via `can_reach_meeting`; `meeting_signatures_insert`, INSERT with empty qual
and empty with_check). **Two traps, backend's own, caught before they cost anything:** (1) a regex
matcher reported ZERO bare calls in `storage.objects.form_assets_select_member`, whose argument
nests three deep (`app.is_member_of(((storage.foldername(name))[1])::uuid)`) — it would have been
hand-treated as an exception it is not; replaced by a paren balancer that also rejects
`is_member_of_for(` explicitly, hand list 3 → 2, generated 39 → 40 (the `_for` word-boundary
lesson's sibling: a matcher must parse what it matches); (2) `EXPECT` records were newline-joined
while quals CONTAIN newlines, so the verifier shredded every multi-line record and read 1 record
instead of 40 — now ``-separated (serialization destroys the boundary the pattern needs). Both
LESSONS candidates at Record. Still in the scratchpad: 2 hand policies, 24 function re-keys, C1
wiring, two seed tables, manifest flip + L13, anchor + `320 § U4`. Nothing in `supabase/`.

### 2026-09-14 — T7 step 2, third pass: 23 of 24 function sites on the frozen path; L15 — D4 applied as written (lead)

Backend measured and parked: the 24 function sites = 9 bare `is_member_of(` (caller-keyed) + 14
`is_member_of_for(` (subject-keyed) + 1 neither (`public.sign_meeting`, declared for
`commission.meetings.minutes.sign`, body carries no layer-1 gate call — being measured: what gates
it today; a bug row if nothing, a declaration defect if a policy does). **23 of the 24 sit on the
legacy frozen search-path set** (C2 anticipated 2); converging them = ~1,160 lines across 23 bodies
(largest 183 lines, ~121 unqualified references); `419`'s baseline would move 860 → 837, not → 858.
Backend's options: (a) converge all 23; (b) re-key under their existing paths with a recorded D4
exception per function; (c) defer the 24 function sites to a named unit, parking 7 codes and their
7 doors at zero callers.

**L15 (lead — a sentence applied, not a new ruling).** ADR 0208 D4, verbatim: *"SET search_path =
'' with schema-qualified object references is the sole forward convention for new or TOUCHED
SECURITY DEFINER functions. Existing nonempty paths are frozen compatibility debt … they may not
grow and converge to the empty form on touch. No mass body re-emission is required."* A re-key that
rewrites a body IS a touch; the touched 23 converge. The last clause removes an OBLIGATION to touch
frozen bodies for convergence's sake; it grants no exception to a body touched anyway. (b) and (c)
would each be an exception to a PO clause and are not the lead's to grant; (a) is the clause
applied. The D4 paragraph's warning about "the middle 42" concerns converting to the dominant
NON-EMPTY path, not to `''`. ⚠ Stated to the PO at the T7 gate for visibility (the scale: 23
bodies, `419` 860 → 837 attributed by name), not as a ruling request. **Execution conditions
(pending backend's three measurements):** every converged body validated mechanically under
`search_path=''` before the migration is placed (`plpgsql_check` if present on the stack; otherwise
`414`'s resolvability gate is the miss-catcher and is named as such), the qualifier's resolved /
hand-decided counts per body in the gate record, `421 § 2a` visited-count and `419` 860 → 837 with
the 23 named; AE4's precedent measured for the record (AE4's re-key predates ADR 0208 and does not
bind it either way).

### 2026-09-14 — L15's three measurements: option (a) costs a `proconfig` change, not 1,160 lines (lead)

Backend: **(1) AE4's precedent** — its re-key touched POLICIES only (`alter policy` × 6+, zero
pre-existing bodies re-emitted); its three new doors were created on the legacy path
(`20261003007300:141/232/292`), two still there, one converged later on touch by ADR 0209's fix — so
"converge on touch" has run once, per function; AE4 never had a row with function sites and no
policy site (T7 has 7). Record only; predates ADR 0208. **(2) Option (a)'s real risk:** 7 `sql` +
16 `plpgsql` bodies; SQL bodies validate at CREATE under their own `proconfig`; `plpgsql_check` is
AVAILABLE on the stack (not yet installed) for the 16; unqualified references to real relations
across the 23 = **0**, unqualified calls to real `app`/`public`/`authz` functions = **0** — ⭐ proven
by a planted control (`from memberships join profiles`) caught by name, both refs. Convergence = the
`proconfig` change + the gate substitution. **(3) `sign_meeting`'s real gate:** not yet measured
(negative only); the stop-if-ungated rule stands. Next pass: measurement 3, then the 23 re-emissions
whole under `''`, validated mechanically BEFORE placement, apply-and-diff in a rollback for the
`23/23` line. `supabase/` clean.

### 2026-09-14 — `sign_meeting` is gated (no bug row); two declarations move; the "empty with_check" reading corrected (lead)

Backend: `public.sign_meeting` is a DEFINER plpgsql COMMAND door delegating to
`app.can_sign_meeting(p_attendee_id, v_uid)` (raises `HC036` on false) — the "0 bare / 0 `_for`"
reading was the absence of a DIRECT gate. It WRITES `meeting_signatures` and `meetings`, so it is a
`definerSurface` member (`writes: [meeting_signatures, meetings]`, `carriesCode: false`), not an
`enforcementSites` entry — which also resolves the dry run's refusal "a DEFINER writer that writes
nothing…". ⚠ Backend's earlier "`meeting_signatures_insert`: empty qual and empty with_check" was a
`qual`-only read; its `with_check` is `signer_id = auth.uid() AND app.can_sign_meeting(attendee_id,
auth.uid())` — composes the same authorizer, no bare call. Row 12's re-key target is
`app.can_sign_meeting`; policy and command door inherit it. Net: 23 re-emissions + 1 re-declaration;
hand policies 2 → 1 (`meeting_cases_select` via `can_reach_meeting`). Next: the 23 under `''`
validated before placement, `23/23` in a rollback; then the rest. `supabase/` clean.

### 2026-09-14 — the 42-policy input covered BOTH clauses; the two misreads traced to one habit (lead)

Backend: the snapshot selected `coalesce(qual,'')` AND `coalesce(with_check,'')`, the generator
counted and substituted across both; of the 42 sites, 40 carry a non-null `qual` and 2 a non-null
`with_check` (the INSERT policies, no overlap) — so the 40/40 diff was over whole policies.
`responses_insert_own` (logic in `with_check`) was generated correctly and read back after apply.
The two earlier misreads (calling it a hand case; calling `meeting_signatures_insert` empty) came
from the same `qual`-only reading habit, both corrected from the catalog. Standing counts: 42
policies = 40 generated + 1 hand (`meeting_cases_select`) + 1 following its authorizer; 24
functions = 23 to re-emit + 1 re-declared; 20 doors 13/7 at 339/433/772. Next pass: the 23.

### 2026-09-14 — T7 step 2, function half: 23/23 converged in a rollback; counts corrected by one (lead)

Backend, `part3_functions.sql` applied with parts 1 in a rolled-back transaction and read back over
all 24 declared function sites: **23/23 `proconfig = search_path=""`**, **0** bare
`is_member_of(_for)(` left; `sign_meeting` alone stays frozen (untouched by design — it composes
`can_sign_meeting`, so D4's "on touch" never fires; re-declared to `definerSurface` as a writer).
The apply validated the 7 `sql` bodies at CREATE under their new `proconfig` (`ON_ERROR_STOP=1`,
exit 0); the 15 `plpgsql` bodies still need `plpgsql_check` before placement. **Corrected for the
gate record:** 23 re-keyed, of which 1 was already on `''` (`can_reach_meeting`) ⇒ **22 leave the
frozen set, `419` 860 → 838** (not 837); language split 7 / 15; substitutions 9 bare + 21 `_for`
(not 14 — the earlier classification under-counted `_for` sites). Built: parts 1–3 with input
snapshots and expectations. Remaining: the checker on the 15, `meeting_cases_select`, C1's wiring,
two seed tables, manifest flip + L13 + `sign_meeting`'s re-declaration, anchor + `320 § U4`; then
move-in and steps 2–7. `supabase/` clean.

### 2026-09-14 — T7 function half validated before placement: 15 plpgsql bodies, 0 findings; no extension left resident (lead)

Backend: `plpgsql_check` installs cleanly and was run INSIDE the same rolled-back transaction as the
re-emissions — the stack is unchanged, nothing resident. Recommendation adopted for the gate
record: do NOT persist it (build-time validator, referenced by neither 414 nor 421; a resident
extension adds its own functions to `public`, the population `100 § 19` and the budget anchor count
— the pgtap trap this tree already hit once). Division of labour: `CREATE OR REPLACE` validated the
7 `sql` bodies at create time (apply under `ON_ERROR_STOP=1`, exit 0); the checker covered the 15
`plpgsql` bodies CREATE never validates — all 22 converged bodies, so a missed qualification is a
migration-time red, not a runtime `42P01`. Classification carried explicitly: "14 `_for`" counted
FUNCTIONS carrying at least one `_for` call; the migration edits CALL SITES — 21 `_for` + 9 bare =
**30 substitutions across 23 functions**. Remaining before move-in: `meeting_cases_select`, C1's
wiring (0 → 4), two seed tables, manifest flip + L13 + `sign_meeting` on `definerSurface`, anchor +
`320 § U4`. `supabase/` clean.

### 2026-09-14 — L16: `meeting_cases_select` gains row 7's own door as an explicit conjunct; rows 6 and 7 both stand (lead)

Backend parked on the second declaration/catalog disagreement found by reading the catalog:
`meeting_cases_select` is declared row 7's site (`commission.meetings.cases.shell.read`) but its
live qual is `app.can_reach_meeting(…) AND NOT app.is_case_respondent(…)`, and `can_reach_meeting`
was re-keyed in part 3 to row 6's door (`can_meetings_read`) because row 6 declares that function —
so "inherit" would make row 7's policy enforce row 6's code and leave row 7's door with zero
callers. `meeting_cases` has no `commission_id` (`id, meeting_id, case_id, agenda_item_id, summary,
decision, created_at`). Corroboration from inside the catalog: the row-9 authority's body comment
names `meeting_cases_select` as its one consumer, and the live qual does not call it — the stale
comment C1 corrects, and § 8.3's drop at `20260805000000` confirmed.

**L16 (lead, mechanism — the approved matrix unchanged):** reading (ii) merges two PO-approved
rows and is not the lead's; reading (i) IS the template — substitute the layer-1 gate with the
row's own door, carry every other conjunct through. Here the policy's gate is composed inside
`can_reach_meeting`, so row 7's door is ADDED as an explicit conjunct rather than substituted:
`meeting_cases_select` = `app.can_reach_meeting(…)` (row 6's code enforced inside, as re-keyed)
`AND app.can_meetings_cases_shell_read(meeting_id, (select auth.uid()))` `AND NOT
app.is_case_respondent(…)` — the door meeting-keyed (scope resolved from the meeting's commission
inside the door; the one door of 20 with that signature, declared as such), composing
`authz.has_permission` alone like the other 19. Both `staff` and `staff_admin` hold rows 6 and 7,
so the differential is unmoved; a principal lacking row 7's code is now denied the shell — the
enforcement the code exists for. Manifest, as data: row 7's site composes `can_reach_meeting`
(→ row 6) and `is_case_respondent`; the row-9 authority's comment corrected to name C1's four
sites, not this policy. Recorded beside `sign_meeting` as the second declaration correction of T7;
both go to T14 as evidence that the manifest was measured, not copied.

### 2026-09-14 — L16 applied: `part4_hand_policy.sql`, the discriminating witness pair (lead)

Backend, in a rollback:

```
(a) grant PRESENT : shell_door=t reach=t rows_visible=1
(b) grant DELETED : shell_door=f reach=t rows_visible=0
```

`reach=t` in BOTH rows is the evidence: row 6's conjunct is intact throughout, so (b)'s loss of
visibility is attributable to row 7's door alone. Row 7's door is meeting-keyed
`app.can_meetings_cases_shell_read(p_meeting_id, p_user_id)`, resolving the commission from the
meeting inside, composing `authz.has_permission` alone — the one signature of twenty that differs,
declared in the manifest. The door is ADDED as a conjunct (no bare call to substitute; substituting
would have deleted row 6's reachability rule). The pair goes into the gate record and `425`'s
expectation for that site. Remaining: C1's wiring + census 0 → 4 with the authority's comment
corrected to name C1's four sites; the two seed tables; the manifest flip (L13, `sign_meeting` on
`definerSurface`, row 7's composition + signature); anchor + `320 § U4`; generator dry-run; move
in; steps 2–7. `supabase/` clean, no extension resident.

### 2026-09-14 — L17: row 9's door keeps the case-capability arm, DECLARED as `residualLegacyAuthority`; 419 → 836 (lead)

Backend measured C1's five objects: the row-9 authority (`sql`, frozen → converges), 
`resolve_document_version_bytes` (`plpgsql`, frozen → converges), the three projection/session
functions already on `''`; none overlaps part 3's 23 ⇒ **419 goes 860 → 836** (part 3 −22, C1 −2 —
the third correction of that figure, each attributed). All five test the bit inline. ⛔ The
question: the authority's body IS `app.has_case_capability(p_case_id, p_uid,
'read_case_deliberation')`, which never consults `authz.has_permission` — a case-grant path. A
door composing `has_permission` alone would DROP the case-grant arm: arm 3's entire subject for
row 9, the reach 4 of 12 CCIH staff personas depend on, and a behaviour change no one ruled.

**L17 (lead, mechanism — the matrix's own shape):** row 9's door is `authz.has_permission(…) OR
app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation')`, case-keyed, with
`has_case_capability` declared as **`residualLegacyAuthority`** on row 9 — the field exists for
exactly a non-permission arm that stays, so the validator is kept honest, not silenced (the same
refusal the dry run raised for the wrapper, resolved the opposite way because here the arm is
APPROVED: matrix row 9's arm 3 is the case reach, P1–P3 ruled on its coordinates). Row 9 is the one
door of twenty with a declared residual arm and a case-keyed signature, both declared as data. C1
proceeds: the four inline sites call the door, their inline bit-tests deleted, the authority's
comment corrected to name them, census 0 → 4; the differential's expectations for row 9 unchanged
(the reach is preserved by construction — witness: a persona with a case grant and NO role reads
the deliberation before and after; a persona with neither is denied before and after).

### 2026-09-14 — L17's witness cannot be constructed on the seed: no grant-holder without a role; an isolating persona is seeded (lead)

Backend probed for a principal holding a live `case_access_grants` row with `read_case_deliberation`
who is NOT a member of the case's commission: **none**. Every grant-holder is also a role holder, so
arm (a) "grant and no role" is unconstructible, arm (c) would pass for the wrong reason, and `425`'s
"no movement" on row 9's sites would be evidence of nothing — a declared residual authority nothing
exercises, one layer down from the shape C1 fixes (the fixture-cannot-reach-the-failing-state
lesson, again). Ruled: seed the isolating persona — a `case_access_grants` row with
`read_case_deliberation` on a CCIH case, NO membership in CCIH, fixed-literal ids never a
persona-axis value — folded into the seed tables T7 already owes; the tester's fixture-gap register
gets the row. Consequences named: the new profile moves `387`'s visibility pins (attributed by name,
as every `gap.*` profile was) and, if affiliated, `396`/`400`'s tenant checks; `424`'s persona axis
is unchanged. Done this pass: `part5_c1_wiring.sql` — the authority re-keyed to the case-keyed
door with the residual arm, the stale comment replaced (it claimed `meeting_cases_select` as its
consumer and warned against a predicate retired by `20260814000000`; the new one names C1's four).
Remaining: the four inline-copy deletions with census 0 → 4; seed tables + this persona; manifest
flip (L13, `sign_meeting`, row 7's and row 9's signatures + residual) with dry-run; anchor + `320
§ U4`. `419` 860 → 836 with the 24 named.

### 2026-09-14 — `part6_seed.sql`: the three fixtures (lead)

Backend: (1) row 9's isolating persona — a `case_access_grants` row with `read_case_deliberation` on
CCIH case `d0000000-…-c1`, held by a principal with NO CCIH membership, org-A affiliated (an
unaffiliated profile is a tenant orphan; `396 § 9.3` / `400 § 1.6` assert the seed contributes
none); (2) `accreditation_standards` — two rows, CCIH + Farmácia A, per-scope pattern, so three
readiness doors are probed live; (3) `referral_internal_notes` — one note, PHI module: process
text only, no patient identifier, no clinical detail, no free text describing a person (Rule 12
minimum-necessary, the base seed's referral pattern). All fixed-literal ids, none a persona-axis
value (arm14(f) green). Three declare vars threaded into `seed.sql` on landing (`v_grantee`,
`v_chefe_ccih`, `v_ccih`) — noted so it is not found at reset time. Parts 1–6 in `t7-wip/` with
inputs and expectations. Remaining before move-in: the four inline-copy deletions (census 0 → 4),
the persona's profile/affiliation rows, `387` re-derived and attributed + scoped `396`/`400`, the
manifest flip dry-run, anchor + `320 § U4`. `419` 860 → 836 with the 24 named.

### 2026-09-14 — L18: the `commission_default` disjunct is a carried condition; wire the inner call (lead)

Backend parked on the fourth C1 site: `public.get_reserved_session_items` tests the bit three
times; two are clean swaps (`i.substance`), one reads `(c.visibility_policy = 'commission_default'
OR app.has_case_capability(i.case_id, v_uid, 'read_case_deliberation'))` guarding `i.withdrawals`
in a closed session. The authority is the thin projection of the bit (§ 8.3), so swapping the whole
disjunction would drop the `commission_default` arm and narrow a closed-session read path; the
authority's COMMENT claims it encodes that split while its body does not — a third staleness for
C1's correction. Options: (a) keep the disjunct, wire the inner call; (b) move the split into the
authority (changes its body and its other three callers); (c) leave the clause inline under a named
exception.

**L18 (lead, mechanism):** (a). `c.visibility_policy = 'commission_default'` is a RESOURCE-SHAPE
condition on the session, the same class as `NOT is_case_respondent` in row 7's policy — the
template carries every non-authority condition through untouched and substitutes the authority
where the bit is tested. After (a) no body anywhere tests the bit inline: the census is 4 sites /
5 call sites, stated at both grains. (b) is a behaviour change to a designated authority with three
other callers; (c) preserves the inline copy the wiring exists to remove. The corrected comment
says: thin projection of `read_case_deliberation`; the `commission_default` split lives at the one
site that has it, by design; consumers named. Witness for the fourth site: a member without the
bit reads `withdrawals` in a `commission_default` session before and after, and is denied in a
restricted one before and after — the disjunct's own discrimination half.

### 2026-09-14 — C1 census 0 → 4 at both grains; the "9 bodies" classified; L19 — C1 stays at § 8.3's four, 4 of 7 stated (lead)

Backend: authority callers **0 → 4 sites / 5 call sites** (`get_reserved_session_items` 2, the
`commission_default` disjunct carried per L18). The detector's "9 bodies" matched any mention of the
string; classified: 4 legitimate carriers (row 9's door, `_cap_bit`, `_case_caps`,
`case_capabilities`) + 2 naming the bit as data (`_grant_case_access_unchecked`,
`trg_audit_case_access`) + **3 bodies that still TEST the bit and are not among § 8.3's four:**
`app.can_read_full_case_content`, `app.can_read_full_meeting_content`,
`app.is_oversight_only_reader`. Catalog: seven test the bit; the PO-approved matrix names four.

**L19 (lead):** C1 stays at § 8.3's four — extending an approved scope on a reading is not the
lead's, and the three may be COMPOSERS of the capability for different surfaces (full content;
oversight) rather than member-facing case-reach surfaces, the distinction the authority's comment
draws. The gate record states **"4 of 7 bodies wired; 3 named, out of scope"** — never "no body
tests the bit inline" (correct-at-most-sites). Follow-up filed by backend beside the gate record:
closes when each of the three is classified (composer vs member-facing surface) by measurement and
either wired to the authority or documented as a composer with the reason. The corrected comment
names the four consumers and says three other bodies compose the bit for other surfaces,
classification pending. Parts 1–7 complete in `t7-wip/`; not done, named: the withdrawals witness,
the persona threading, `387`/`396`/`400`, the manifest dry-run, anchor + `320 § U4`, move-in, steps
2–7. `419` 860 → 836.

### 2026-09-14 — L18's witness needs a fourth fixture: `meeting_closed_session_items` is empty; approved (lead)

Backend: `public.meeting_closed_session_items` has 0 rows, so `get_reserved_session_items` returns
nothing for any principal and L18's witness would read identically on both sides for the wrong
reason — an empty result set, not an authorization decision (row 9's gap, one table over). Cases
exist to support it (7 `commission_default`, 1 `explicit_grants_only`). **Approved:** a fourth
fixture in `part6` — one closed session with two items, one on a `commission_default` case and one
on the `explicit_grants_only` case, both carrying `withdrawals` and `substance`, fixed-literal ids
never a persona-axis value, seeded through the table's own door where one exists (a direct insert
bypassing an obligation is the 330 lesson). A wired-but-unwitnessed site is refused. Also this
pass: `FUP-AE5-STAFF-THREE-BIT-TESTING-BODIES-UNCLASSIFIED` filed (closes per function by
measurement; refuses closure by re-scoping § 8.3 or dropping the three), gates 13 and 7 exit 0;
C1's comment names all three stalenesses and points at the follow-up. Fixture-gap register: the
tester adds the row. Parts 1–7 complete; remaining unchanged plus this fixture.

### 2026-09-14 — L18's witness, discriminating form; the closed-session fixture hand-seeded with the reason stated (lead)

Backend, in a rollback:

```
L18 commission_default  : has_bit=f  withdrawals=Retiradas registradas (fixture L18…
L18 explicit_grants_only: has_bit=f  withdrawals=(null)
```

`has_bit=f` on BOTH rows: the only difference is `visibility_policy`, so the default row's
`withdrawals` is the carried disjunct doing its work and the restricted row's null is the
authority's — had the disjunct been collapsed, both rows would read null and the narrowing would
have been invisible. Fixture: one session, two items, hand-seeded and SAID SO — `add_reserved_item`
carries authorization and a computed `position`, not a referential obligation (the 330 lesson's
subject), and going through it would mint `gen_random_uuid()` ids the fixed-literal rule forbids;
the post-door state (position, blank text nulled) reproduced explicitly. Follow-up
`FUP-AE5-STAFF-THREE-BIT-TESTING-BODIES-UNCLASSIFIED` filed, gates 13/7 exit 0 — ⚠ its two files
are UNCOMMITTED in the shared tree; backend commits them by path at its next pass. Parts 1–7 + four
fixtures complete, every piece witnessed. Not done: persona threading, `387`, scoped `396`/`400`,
manifest dry-run, anchor + `320 § U4`, move-in, steps 2–7; row 9's triple waits on the persona.

### 2026-09-14 — row 9's witness triple, the ruled form; the persona threaded; a column guess refuted by the apply (lead)

Backend, in a rollback:

```
ROW9 (a) grant, NO role      : before=t after=t
ROW9 (b) neither             : before=f after=f
ROW9 (c) role, grant DELETED : before=t after=f
```

(a) the residual arm carries a grant-holder with no role through the permission deletion —
exercised in isolation for the first time; (b) neither is denied throughout, so (a) is not a door
that grants everyone; (c) a role holder loses access when the grant is deleted — the permission
arm is LIVE, so (a)'s survival is the residual arm and not a stuck `true`. (c) is the half without
which (a) is decoration; it goes into `425`'s expectation for row 9's sites. Persona threaded:
`auth.users` row, org-A affiliation, NO CCIH membership, fixed id `a5f00000-…-f5`, never a
persona-axis value — the only new profile in T7's fixture set, so `387` moves by exactly one
profile. Fixture defect caught by APPLYING, not reading: `referral_internal_notes` has
`author_user_id`, not `created_by`. Follow-up committed `2c43617a`. `t7-wip/` complete and
witnessed end to end. Not done: `387` re-derived, scoped `396`/`400`, manifest dry-run, anchor +
`320 § U4`, move-in, steps 2–7. `419` 860 → 836.

### 2026-09-14 — the manifest flip emits cleanly (dry-run `t7dry2/`); the validator's third refusal (lead)

Backend, nothing under `supabase/`: rows 61 → 61; re-keyed / pending 3/58 → **23/38**;
`authz_manifest_sites` 13 → **78** (+65 = 42 policy + 23 function; not the 79 predicted —
`sign_meeting` moved to `definerSurface`); `arm_sites` 69 → **0** (empty typed form);
`definerSurface` +1 (`sign_meeting`, writes `meeting_signatures, meetings`);
`nonEnforcementConsumers` +2 (§ 8.4's audited-read registry legs); the `ts` site dropped (not a DB
site). Row 7's signature `p_meeting_id uuid, p_user_id uuid` and row 9's `p_case_id uuid,
p_user_id uuid` declared with `signatureNote`s. ⭐ The validator refused the first draft: *a
`residualLegacyAuthority` the authorizer does not compose overstates what still has to be
retired* — row 9's `composedWith` must NAME `has_case_capability` as well as declare it, exactly
what the door's SQL does; the same rule that removed the never-composed wrapper in the first dry
run, satisfied properly here because this arm IS composed. Complete and witnessed in `t7-wip/`:
doors, policies, functions, row 7 pair, C1 census, L18 pair, row 9 triple, five fixtures. Not done,
stated by backend: L13's § 6.3 text, anchor + `320 § U4`, `387`, scoped `396`/`400`, move-in, steps
2–7, full `test:db`, lint, `gen:types`, the live budget line — the long single stretch, not started.

### 2026-09-14 — T7 step 2 witness: `410 § 8` RED both directions on the unmigrated catalog; move-in authorised explicitly (lead)

Backend, flipped manifest (scratch-emitted) against the LIVE pre-migration catalog,
`pg_stat_activity` 0, settle-checked 171 → 171:

```
not ok 37 - 8.1 ⭐⭐ DECLARED => ENFORCING
#  have: commission.accreditation.read -> public.accreditation_frameworks / accreditation_frameworks_select; … 
#  want: (none)
ok 38 - 8.2 DISCRIMINATION PAIR, positive half … returns TRUE for a site that genuinely is re-keyed
ok 39 - 8.3 DISCRIMINATION PAIR, negative half — anchored on something correct BY DESIGN
```

13 reds total (§ 8.1 plus § 8.6 cardinality, § 8.7 definer-writer closure, § 8.8
authorizer-consumer partition — all moving with the flip) while § 8.2/8.3 stay GREEN: a § 8.1 red
with a broken `reaches_code` would look identical, the green positive half rules it out. The witness
that only exists between "declared" and "landed". Backend parked BEFORE the move-in — the first
irreversible step on the shared stack (a migration in `supabase/migrations/` is applied by any
session's reset: this unit's incident) — everything before it rolled back or scratch-only. pgtap
installed for the run, to be dropped before the reset. **Move-in authorised explicitly:** the tester
and the PO session are off the stack.

### 2026-09-14 — T7 LANDED in the tree (uncommitted): live budget 339/433/772, `419` 836, census 4; one seed abort, attributed and fixed (lead)

Backend, read from the live catalog after the reset:

```
LIVE BUDGET                          app=339 public=433 total=772
frozen non-empty DEFINER paths (419) 836
C1 authority callers                 4
```

R-4(a)'s completion criterion met on the CATALOG, not only in the anchor; `419` 860 → 836 exactly as
predicted (22 + 2); census 0 → 4; profiles 45 (44 + `f5`, so `387` moves by that profile alone).
**Reset incident, recorded as the tester would:** first attempt applied every migration fully (171
tables, 21 T7 doors, `staff` authoritative) but the SEED aborted at
`accreditation_standards_framework_id_fkey` — profiles 0. Two faults, backend's own: (1) the
manifest flip stripped `arm3Door.probe` (arm14(a) red on it, correctly — the probe is the
DIFFERENTIAL's executable binding, unrelated to re-key status; restored for all 20 rows from HEAD);
(2) the seed block referenced framework `a2` (`gap-ccih`) created LATER in the file; moved after
that insert. Second reset exit 0. In the tree: `20261003007470_ae5_staff_t7_rekey.sql` (2137 lines:
48 functions = 20 doors + 23 re-emissions + 1 authority + 4 C1 deletions; 41 policies = 40
generated + 1 hand; 13 `authenticated` grants; 0 legacy paths), the seed block, the flipped manifest
(23/38, sites 78, arm_sites 0, definerSurface +1), `410` with L13's § 6.3, `320 § U4` + the anchor
772/339/433 (gate 15 green). Not done: `387` attributed, scoped `396`/`400`, `421 § 0c`/`§ 2a`, the
24 named for `419`, `425`'s pair, L13's 6a/6b mutants, `410 § 8` now-green, full `test:db`, lint,
`gen:types`; NOTHING COMMITTED. ⚠ An uncommitted live migration sits in the tree by intent now; the
tester and the PO session stay off the stack until backend parks with the suite green.

### 2026-09-14 — T7 STOP-AND-REPORT: a P0 in the migration (fails closed) + four mechanism rulings L20–L23; nothing committed (lead)

Backend's full verification pass found, before any commit:

**P0 — `app._case_caps` S5 arm rewritten across a signature change.** Pre-T7 `v_member :=
app.is_member_of_for(v_commission, p_uid)`; post-T7 `app.can_cases_deliberation_read(v_commission,
p_uid)` — L17's door is CASE-keyed, both args `uuid`, so it compiles, looks up `cases.id =
v_commission`, finds nothing, `has_permission(…, NULL, …)` is false: **S5 `committee_member_default`
permanently FALSE — every ordinary member loses `read_case_deliberation` on every case**. Fails
CLOSED (a narrowing, not a leak); local only; found by `425 § 2.0`'s baseline (`have 46 / want 47`,
the one denied site named) and confirmed by sweeping every call of the two non-commission-keyed
doors with its first argument: exactly ONE wrong-keyed call site in the catalog. The obvious fix
recurses (`can_cases_deliberation_read` → `has_case_capability` → `_case_caps`). **L20 (lead):
option (B) — a commission-keyed, permission-only sibling door for row 9
(`app.can_cases_deliberation_read_in_commission(p_commission_id, p_user_id)` or the generator's
naming), composing `authz.has_permission` alone (no residual arm, hence no recursion), DEFINER-only
(called from `_case_caps`'s body; NO `authenticated` grant), declared on row 9 as its second
door with a `signatureNote`. R-4 untouched: the 13 policy-called doors and their caller mapping are
unchanged, the live count stays 339/433/772 — stated to the PO at the gate as a 21st door OUTSIDE
the ruled set, not as headroom used. (A) would make the machinery a second literal carrier; (C)
leaves a legacy gate at a site AC-7 says is re-pointed.** Witness: 425 § 2.0 back to 47/47; a member
without a case grant reads deliberation via S5 before and after; the same member with row 9's
grant deleted is denied via S5 (the sibling's discrimination half).

**L21 — the flip deleted `armInterface` tree-wide and with it every per-site `subject`/`hat`.**
0 of 63 rows carry an `armInterface`; `subject_keying()` returns `None` for every row; arm14(b)
compares nothing; gate 12 crashes in `_flip_keying` walking off the end into the `_*_note` keys.
Ruling: `enforcementSites` entries GAIN `subject` and `hat` (ADR 0201 D3's per-arm data, which
lived only on `armInterface`), populated for the 20 rows from the pre-flip capture and checked
against each door's signature; the generator reads them from either surface; arm14(b) restored
and shown able to red; `_flip_keying` refuses BY NAME when no `caller-only` row exists instead of
walking into note keys (a self-test that crashes is NOTICED, not a red).

**L13′ — the § 6.3 re-rule was wrong in its assumption**, not its intent: 38 rows remain
`pending-rekey` because they belong to roles NOT YET APPROVED (they never had arm sites). Re-rule:
*for every role in `approvedSuites`, each of its `pending-rekey` rows has ≥ 1 arm site* — keyed on
the fact the gate can see; with both commission roles re-keyed the predicate is vacuously true and
its 6a half (an approved-suite pending row with zero arm sites → RED) is what keeps it honest.

**L22 — `start_correction_draft`'s authority is an identity check** (`auth.uid() is distinct from
v_corrector → raise`), and `gate: null` means "no authority check", a false claim. Ruling: `gate`
admits a third form `{ "kind": "identity", "expression": "…" }`, emitted, and § 8.7 pins the
expression's presence in the comment-stripped body (text is not truth: the declaration is checked
against `prosrc`).

**L23 — `meeting_signatures_insert` retracted as a 2-hop site.** The policy composes
`can_sign_meeting`, which composes row 12's door; `reaches_code` follows one hop. Ruling: the policy
stays a site with `composed_with: [app.can_sign_meeting]`, and `reaches_code` follows a DECLARED
composition chain, each hop verified in the catalog; an undeclared second hop stays red.

**Tester item — `425` aborts:** after the grant deletion `meeting_cadence_status` RAISES `HC0K2`
where pre-T7 it returned falsy (the raise path existed for non-members; the harness ran as a member
whose gate now denies) — `site_signature` must trap and record the SQLSTATE as the signature (a
raise is a deny with a code), so § 3.1/3.2's lines can run.

**Green, all observed red first, every delta attributed (uncommitted):** `387` exit 0 — B2 35 → 36,
B3 44 → 45, and `md5(id-set MINUS f5)` reproduces the OLD pins byte-for-byte (the attribution
proven, not narrated); C1 9 of 99 hot policies changed, each a named door swap; `419` exit 0, 860 →
836 pure deletion (24 removed / 0 added), gate 18 in sync; `421`/`396`/`400` exit 0; `410` 9 red → 2
red (§ 6.3, § 8.7 above) with each fix measured — `_audit_access_authorized` calls neither of two
declared doors (a T7 copy-paste, removed); `meetings.read`'s `respondent_exclusion` came only from
the registry root (re-measured per root against the pre-T7 capture: a root-set change, not an
authority regression), `hardDenyClasses` now `["principal_inactive"]`. Gates 7/9/13/15/18/19 = 0,
gate 12 = 1 (L21). Files touched, all uncommitted: the migration, the manifest, `410`, `387`,
`419`, `421`, `320`, `seed.sql`, the seam file, three regenerated `.psql`. Loop count on T7's
verification: iteration 1; the P0 is a NEW cause.

### 2026-09-14 — T7 verification iteration 2: a P0 WIDENING caused by L17 — L24 supersedes it; the closure gate's blindness filed (lead)

Backend's fresh-reset `test:db` after executing L20–L23 + L13′ (all witnessed, gates
7/9/12/13/15/18/19 = 0, `410` 45/45, R-4 intact at 339/433/772): **18 red files against a pre-T7
full PASS**, five of them one cause. **P0 — row 9's door as ruled in L17,**
`authz.has_permission(…) OR app.has_case_capability(…, 'read_case_deliberation')`, **ORs the
permission arm PAST the case-level hard denies** (`is_case_respondent` / `is_recused_from_case`,
STEP-4 of `_case_caps`) **and past the `explicit_grants_only` fence** (`not v_eg` guarding S5).
Measured by the suites that build those states: `233 M6·7` a plain member reaches an
`explicit_grants_only` case (`true`, want `false`); the EXCLUDED respondent reaches the case even
under `commission_default`; `241`/`242`/`243` deliberation substance reads `RESUMO_EG` /
`NOTAS_DELIB` / `WD_B` where NULL is wanted; `228 QA MAJOR-3` `summary` unmasked. Class-1
case-deliberation content (Rule 12). C1's wiring carried it onto the four projection surfaces. Local
only, uncommitted, found before commit. **The error is the lead's:** L17 asked "which arm do we
keep?" and never asked "does the OR walk around a conjunct the other arm carries?" — the
two-locks / masked-by-a-legitimately-open-arm shape, in a ruling I wrote.

**L24 (supersedes L17):** row 9's member-surface door is `select app.has_case_capability(p_case_id,
p_user_id, 'read_case_deliberation')` ALONE. After L20 the permission IS enforced — inside
`_case_caps`'s S5 arm via the commission-keyed sibling `can_cases_deliberation_read_in_commission`
→ `authz.has_permission` — behind `v_eg` and the hard denies, and the code literal lives in the
sibling so the row still reads as re-keyed. The door's first arm was therefore both redundant and
unsafe. Manifest: row 9's member-surface door composes `has_case_capability` (declared), which
reaches the code by the declared chain S5 → sibling (L23's `reaches_code` follows it);
`residualLegacyAuthority` on row 9 is withdrawn (nothing residual remains: the capability path
now carries the permission). Witnesses: 233 M6·7 both lines GREEN; 241/242/243 NULL; 228 masked;
row 9's triple re-taken — (a) grant-no-role `t/t`, (b) neither `f/f`, (c) role-with-grant-deleted
`t → f` — and a fourth row: (d) EXCLUDED respondent with role and grant `f/f`.

**Why `410 § 6.2` stayed green through it — filed as
`FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND` (high, backend):** the closure from row
9's declared sites REACHES `is_case_respondent` (inside `_case_caps`), so the committed
`hardDenyClasses` measured as satisfied while the arm that actually grants walked around it. A
deny present in the closure is not a deny on every grant path. Closes when § 6.2 (or a new arm)
proves the deny is on EVERY disjunct of the door's grant expression — structural, not
reachability — shown able to red on exactly this door as L17 wrote it. LESSONS candidate.

**The other 13 reds are pins T7 moved, re-pinned WITH attribution, never bare:** converged
`search_path` pins asserting the OLD legacy path (319 t13 "23 doors keep
`app,public,pg_catalog`" have 22; 341 D4c; 328 K14s5; 326 § 6.4; 274 C1; 176 D4; 329 P0d — each
names its function among the 24 that converged under D4/L15); censuses (400 528 → 549 rows; 421
76 → 77 empty / 41 → 42 sql — the 21st door; 409 § 1.1 the four (site, code) pairs now 25, § 1.3
58 → 38); 356 § 14.3 `_case_caps` hash moved by L20's S5 line. `425` (tester's, `3c91d86a`):
§ 2.0 back to 47/47; `3.1 NO MOVEMENT have: 45 / want: 0` and `3.2 MIRROR have: 48 / want: 57`
— the mirror is 9 short, the tester's to attribute once backend parks green. Also this pass:
`FUP-AE5-STAFF-S8-S5-PAIRING-NOW-CONTINGENT` filed (the S8 comment's "member_can_for's third
conjunct" claim was false — it is `is_member_of_for`, measured). Loop: T7 verification iteration
2 of 5; the P0 is a NEW cause, attributed to a lead ruling.

### 2026-09-14 — T7 GREEN AND COMMITTED: the gate record, with every witness line

**Commits (by path, in order):** `2dddd278` the atomic set per R-4 (migration + seed + manifest
JSON + emitted fixture + both generators + `410` + `320 § U4` + the anchor doc) · `97d5f916` the
attributed re-pins across 14 suites · `7444f37a` + `b9301439` the two follow-ups. `gen:types`
produced NO diff — the 21st door lives in `app` and is not a PostgREST surface — so there is no
types commit, and its absence is a measurement, not an omission.

**Full `test:db` on a FRESH reset: 275 files, 9215 tests, ONE file red.** The pre-T7 baseline
(`test-db-run6-full.log`) was 273 / 9156 / PASS, so the comparison is against a green tree, not
against a remembered state. `supabase db reset --local` exit 0; settle-check 171 then 171;
profiles 45; `authz.roles` authoritative = 2. `npm run lint` exit 0 (every gate, no Docker);
`npm run typecheck` exit 0. Gate 18 `in sync`. All exits read BARE.

**The one red is `425` (tester's, `3c91d86a`), on tests 12 and 13, and they are one measurement
from two sides:**
```
3.1 ⭐⭐ THE WITNESS THIS FILE EXISTS TO PRODUCE — NO MOVEMENT   have: 45   want: 0
3.2 ⭐⭐ THE MIRROR ASSERTION, DELIBERATELY RED-BY-DESIGN         have: 48   want: 57
```
`§ 2.0` is back to **47/47**. 3.1 was the PRE-T7 witness (deleting `staff`'s grant changed nothing,
because the sites were membership-keyed); T7 is precisely the change that makes it move, so 45 is
the increment landing and 3.2's 48-of-57 is the quantity to attribute. Both lines are left exactly
as they read — tester's file, tester's call.

**L24 — the WIDENING, closed.** Row 9's door was `authz.has_permission(...) or
app.has_case_capability(...)`. The second disjunct applies `_case_caps`'s STEP-4 hard denies and
the `explicit_grants_only` guard; the first applies neither; one true disjunct grants. Now the
capability arm ALONE, with the permission enforced inside it at S5 through the 21st door.
`residualLegacyAuthority` on row 9 WITHDRAWN — nothing residual remains — and the grant chain is
declared hop by hop (`can_reach_case_on_member_surface → can_cases_deliberation_read →
has_case_capability → _case_caps → S5 → can_cases_deliberation_read_in_commission → authz`), which
`reaches_code` walks under L23 at depth 6.

Row 9's witnesses, re-taken on the fresh reset, subject `00000000-…-000a`:

| # | case | conditions | `_case_caps` | door | member surface |
| --- | --- | --- | --- | --- | --- |
| (a) | `d0000000-…-00c1` `commission_default` | plain member, NO case grant | 2 | `t` | `t` |
| (b) | same | `staff`'s role-permission grant DELETED | 0 | `f` | `f` |
| (c) | same | restored | 2 | `t` | — |
| (d) | `ca000000-…-00e1` `explicit_grants_only` | **EXCLUDED RESPONDENT** holding the `staff` role **and** an explicit `read_case_deliberation` grant | **0** | **`f`** | **`f`** |

(d) is the fourth row the ruling asked for: both positive sources present, the hard deny still
wins. Behavioural suites GREEN: **228, 233, 241, 242, 243** (233 M6·7 read `have: true / want:
false` on two lines before this).

**L20 — the NARROWING, closed, and folded into `7470` per C3.** `7480` is deleted; there is ONE
migration. 21 doors, **13 granted to `authenticated` / 8 DEFINER-only**; the 21st takes no grant at
all (`prosecdef t`, `search_path=""`, EXECUTE false for `authenticated`, `anon` AND `service_role`),
which is why **R-4 is untouched: `320 § U4` exit 0, app=339 / public=433 / total=772**.

**L21 — `subject`/`hat` on `enforcementSites`.** 64 carried from the pre-flip capture, 14 derived
and MEASURED — `create_professional_profile` and `set_professional_link_state` both declare a
`p_user_id uuid` that is the profile's linked user while the authority call passes `auth.uid()`,
so the value was resolved, not the noun. `subject_keying` reads either surface; `_manifest_rows()`
skips the `_*_note` keys; `_flip_keying` and `_synth_badkeying` REFUSE BY NAME with a
void-control message instead of walking off the end. arm14(b) live and able to red — self-test:
`caught — arm14 a caller-keyed door claims a principal [fired: arm14]`. **Gate 12 = 0.**

**L22 — the identity gate, and it is a CORRECTION OF A FALSE CLAIM, not a missing one.**
`public.start_correction_draft` is a DEFINER writer of `responses` whose authority is
`if auth.uid() is distinct from v_corrector then raise` — a predicate, not a call. The field admitted only a
function name (there is none; naming its liveness check would have read as "gated only on liveness", the
alarming misreading and the opposite of the truth) or `null`, which `410 § 8.7` DEFINES as "no authority check
at all". Both were false, so the vocabulary grew: `{"kind":"identity","expression"}`, emitted as its own
column and pinned against the **comment-stripped** body — plus a new REVERSE 3b arm that reds if the
expression appears ONLY in a comment, because "present in the stripped body" and "present in both" are not
the same claim and the stronger one is stated rather than inferred. `410 § 8.7` green with it declared.
⚠ L22 has NO planted witness below, and this line says so rather than letting the heading imply one: its
discrimination is the REVERSE 3b arm's existence, which is itself untested until a door declares a gate it
only comments. Filed mentally as the weakest of the five rulings' evidence.

**L13′ / § 3.8 / L23 discrimination witnesses, all planted and rolled back:**
```
6a  § 6.3  baseline predicate t → plant one staff_admin pending row as measured-% with zero
           arm sites → f → rollback → t
6b  § 3.8  plant subject `p_not_a_parameter` → "commission.cases.deliberation.read ->
           app.can_reach_case_on_member_surface declares subject `p_not_a_parameter`"
L23        declared chain reaches t · composition declared but not called f ·
           intermediate hop undeclared as a site f   (undeclared 2-hop STAYS red)
```
`410` is **45/45** (plan 44 → 45: the new § 3.8). Pins moved, each observed red first: § 1.4
13 → 78 → 80 → 82 sites · § 3.6 107 → 110 (82 site pairs + 28 authorizer pairs — the authorizer
side FELL because L24 deleted a disjunct, and the pair is asserted as one number so a rise and a
fall cannot cancel out of sight) · § 4.5 58/3 → 38/23 · § 4.6 back to five entries, row 9's
residual WITHDRAWN and the withdrawal recorded · § 5.2 3 → 23 · § 8.5 4 → 25 → **24** names ·
§ 8.6 13/8/4 → **82 / 50 / 24** (the second figure moved on the INSTRUMENT, not the catalog:
L23 taught `reaches_code` the declared chain, so `meeting_signatures_insert` is now counted).

**`419`: 860 → 836, a PURE DELETION — 24 removed, 0 added.** The 24, from the generator's own
`--write` line: `app._case_caps`, `app.can_reach_case_on_member_surface`,
`app.can_read_action_item`, `app.can_read_capa`, `app.can_read_document`,
`app.can_read_document_of_version`, `app.can_read_event`, `app.can_read_referral_internal_note`,
`app.can_read_referral_internal_notes`, `app.can_read_referral_metadata`, `app.can_sign_meeting`,
`app.resolve_document_version_bytes`, `public.cast_case_vote`,
`public.create_referral_internal_note`, `public.documents_due_for_review`,
`public.get_referral_case_access_summary`, `public.get_standard_assessment`,
`public.indicator_series`, `public.list_commission_documents`, `public.meeting_cadence_status`,
`public.notify_safety_event`, `public.readiness_evidence`, `public.readiness_report`,
`public.suggest_carry_forward`.

**`387`, every delta attributed to `a5f00000-…-f5` ALONE:** B2 35 → 36 `cd9eb75a…`, B3 44 → 45
`458dfa00…`, and `md5(id-set MINUS f5)` reproduces the OLD pins byte-for-byte — 35 rows →
`67d2c9c2…`, 44 rows → `4ba7d359…`. B1/B4/B5/B6 did not move, which IS the attribution. C1
re-captured `168aa4c6…` with its nine changed hot-table policies named individually, measured
against the pre-T7 LIVE capture; C2's 99 unchanged, which stops the re-capture absorbing a
deletion.

**⚠ Two corrections to the plan's own numbers, measured:** `409 § 1.1` is **24** pairs, not 25 —
L24 removed the permission literal from `app.can_cases_deliberation_read`, so the door is no
longer a carrier and the 21st door carries the code one hop down. And the "319 t13" of the plan is
**`326` t13**; `319`'s red was `A7`, which was not a pin at all but a dead mutation twin
(`have: 64 / want: 66` — the plant mutating a function S5 no longer consults). Re-pointed to
`authz.holds_role` and re-pinned 66 → **111**, decomposed against `_cap_bit`: S5's
`read_case_deliberation` plus the whole S1 coordinator set, with `read_restricted_phi` (16) still
ABSENT — D5·6 holding under the mutation. A8 restores the object that was actually mutated.

**Follow-ups filed:** `FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND` (⭐ high — keeps
L17's two-arm door verbatim as the closing gate's fixture, because the migration now carries the
corrected form and migration text is stale by design) and
`FUP-AE5-STAFF-S8-S5-PAIRING-NOW-CONTINGENT` (medium). Loop: T7 verification iteration 3 of 5;
each iteration closed a NEW cause.

### 2026-09-14 — T7 COMMITTED green (`2dddd278` … `9fe05301`), verified by the lead; the stack to the tester for `425` run 4 (lead)

Verified, not relayed: five commits by path on `ae5-staff` — `2dddd278` the atomic set (migration +
seed + manifest + `320 § U4` + anchor + `410`, R-4's wording), `97d5f916` 14 suites re-pinned with
every delta attributed (incl. three `is_member_of` → door TEXT corrections at 176 D4 / 274 C1 / 371
§ 6.4), `7444f37a` + `b9301439` the two follow-ups, `9fe05301` the gate record; tree clean apart from
run logs; exactly two migrations of this unit in the tree (`…7460` cutover, `…7470` re-key — the
L20 door folded in, `…7480` deleted); `npm run lint` exit 0 at HEAD. **The committed state is the
verified one:** 275 files / 9215 tests, ONE red (`425`, the tester's, left as it reads: § 2.0 47/47;
3.1 `have: 45 / want: 0`; 3.2 `have: 48 / want: 57`), against the pre-T7 baseline 273 / 9156 / PASS
— a comparison, not a recollection. `typecheck` 0, gate 18 in sync, reset exit 0, settle 171/171,
profiles 45, `gen:types` no diff (the 21st door is in `app`) — the absence measured. **Both P0s
closed with witnesses:** L24's four rows on a fresh reset — (a) plain member on a
`commission_default` case `_case_caps` 2 / door t / surface t; (b) grant DELETED 0 / f / f; (c)
restored 2 / t; (d) EXCLUDED RESPONDENT on `explicit_grants_only` with the role AND an explicit
grant **0 / f / f** — 228, 233, 241, 242, 243 GREEN (233 M6·7 had read `true / want false` on two
lines). L20 in the one migration: 21 doors, 13 `authenticated` / 8 DEFINER-only, the 21st with no
grant at all; `320 § U4` exit 0, **339/433/772**. L21 (78 subjects: 64 carried, 14 derived and
measured — two `public.*` professional functions declare a `p_user_id` that is the LINKED user
while the authority call passes `auth.uid()`: the value, not the noun), arm14(b) live, gate 12 = 0,
new permanent `410 § 3.8`; L13′, L22, L23 with all plants witnessed and rolled back. **Two
corrections to the plan's own figures, backend's:** `409 § 1.1` = 24 pairs, not 25 (L24 removed the
literal from the member-surface door; the 21st carries it one hop down; `410 §§ 8.5/8.6` agree);
"319 t13" was `326` t13 — `319`'s red was **A7**, NOT a pin: S5's hat gate moved from
`app.has_role_any` to `authz.holds_role`, so the plant mutated a function S5 no longer consults and
read `64 / 66` with the mutation landing perfectly while changing nothing (the
mutation-that-did-not-apply lesson, caught); re-pointed and re-pinned 66 → 111 decomposed against
`_cap_bit`, `read_restricted_phi` (16) still absent — D5·6 holding under the mutation. Stack to
the tester for `425` run 4 (attribute the nine short; re-point 3.1/3.2 to the post-T7 catalog with
the scope cut re-derived); backend on T10 (docs only) meanwhile; T8 after the tester parks. AC-7
ticks when `425` is green with its cut stated. Loop: T7 verification closed at iteration 2.

### 2026-09-14 — T10 seam slice (`2e14fe75`, docs only); backend corrected an over-claim in its own gate record (lead)

`docs/backend-state/authorization-and-audit.md`: the frozen `## AE5 increment 1 — staff runs on
layer 3` slice appended (cutover shape 21 doors 13/8, 41 policies, 23 re-emissions, countdown 58/3
→ 38/23; both defects the re-key created; the four-row witness table incl. (d)); its last section
is what the INSTRUMENTS learned — § 6.2 blind to an `or`; a re-keyed row shed its per-arm data and
arm14(b) went VOID rather than red; `reaches_code` saw one hop; a mutation twin can go DEAD without
going red; "converge on touch" cost 24 signatures and seven pins had asserted the legacy path as a
property to keep. `## Current state` replaced and re-stamped; new invariant, with the note that no
gate enforces it today: *a hard deny must sit on EVERY disjunct of a door's grant expression*;
open edges name the four owed items; 99 lines against the 100 ratchet (lowered); gate 16 = 0, lint
0. **Over-claim caught by backend in its own gate record:** a heading read "L13′ / L22 / L23
witnesses, all planted and rolled back" while the body held two — L22 (the `{kind, expression}`
identity gate + the REVERSE 3b arm) has NO planted witness; the entry now says so, and that it is
the weakest evidence among the five rulings. Lead: 3b gets its plant in T8 (a manifest declaring
an expression that appears only in a comment → red), the detector proven able to find something.
Stack still the tester's.

### 2026-09-14 — `425` run 4 post-T7 GREEN (18/18); the nine attributed by live query; a round 2 ordered on the exclusions (lead)

`425-run4-post-t7.log` `Files=2, Tests=19, Result: PASS`; reset bare, no peer, settle-checked.
§ 2.0 47/47. **The nine, none of the predicted categories:** seven are ROLE-FREE DISJUNCTS the
probing persona (`staff4.ccih`) satisfies — `accreditation_frameworks_select`'s null-owner public
arm (2 → 1), `action_items_select`'s `assigned_to = auth.uid()` (3 → 1), `can_read_document` /
`controlled_documents_select` / `controlled_document_versions_select`'s approver leg (`staff4.ccih`
is a seeded approver of the probed document), `memberships_select` / `profiles_select_self_or_admin`'s
self row (13 → 1) — the arm-3 class exactly; one is `_audit_access_authorized`'s `meeting.viewed`
leg reading `is_member_of OR is_tenancy_admin_of` directly (`carriesCode:false`, never in T7's
surface); one was a FIXTURE bug in the file (`can_read_capa` pointed at an `rca`-sourced plan
reachable via the event arm; re-pointed to an isolated `indicator`-sourced plan, now `t → f`).
RAISE-both-ways: none (`meeting_cadence_status` / `suggest_carry_forward` raise `HC0K2` AFTER with
a real value BEFORE — moved and discriminated). Disposition (iteration 2 of cap 2, pre-T7 text kept
as history): 3.1 = every non-static site MOVED, 11 excluded and named inline (9 sparse tables + the
two zero-movement sites), 46/46 GREEN; 3.2 = every non-excluded site DISCRIMINATES, 8 excluded and
named, 49/49 GREEN; both bodies forbid widening an exclusion without a fresh live query.
Committed by path. **Lead's reading — honest, and a hatch that silences the measurable:** the seven
role-free-disjunct sites CAN discriminate under a persona/resource the disjunct does not reach, and
`424` already binds exactly that per row (`disjunct_absent`: a non-self row, a non-assigned item, a
document the persona does not approve, a framework with an owner). **Round 2 ordered (tester,
file-only until T8 parks, cap 2):** replace the seven arm-3 exclusions with `424`'s `disjunct_absent`
bindings so 3.2 measures them; the registry leg stays excluded with its `carriesCode:false` cited.
AC-7 ticks on that run. T8 to backend now — the stack is free; the tester's re-run follows T8.

### 2026-09-14 — `425` round 2 written (tester, uncommitted): the seven arm-3 sites probed on `424`'s `disjunct_absent` ids; a scope note (lead)

Per site, `f425w` now holds the vector's own `disjunct_absent` fixed-literal id (a CCIH-owned
framework, a committee-scoped item, a document/version the persona does not approve, a co-member's
row) and `site_signature`'s primary probe targets it — all seven `t → f` / `1 → 0` under the
deletion; the original disjunct-reachable probe kept as a SECOND measurement
(`p1_survivor_signature`, § 3.3/3.3b: stays GRANTED across before/after/restored — PO ruling P1
witnessed explicitly, 21 observations). Exclusions: 3.1 = 10 (9 sparse tables + the audit leg,
`carriesCode:false` cited), want 47; 3.2 = the audit leg only, want 56; pre-T7 text kept, PASS 1 →
PASS 2 history inline, no widening without a fresh live query. Plan 18 → 21 (§ 0.4 fixture control,
§ 3.3, § 3.3b). ⚠ **Scope note, self-reported:** the tester derived the ids with rollback-safe reads
against the stack while backend owned it for T8; no state changed (`role_permissions` 20 rows
for `staff` re-checked), no peer seen — but one owner at a time is the rule and an empty
`pg_stat_activity` is not consent (a mid-reset catalog read returns a half-built catalog, measured
today); told: derive from the committed vector or route through the lead. Held uncommitted; the
run and the commit follow T8.

### 2026-09-14 — T8 in progress: census, three arms green, `census` = 1 CORRECTLY (23 gates UNKNOWN); the door sweep RUNS and is the gate run; door surface FROZEN (lead)

Backend, exits bare: two stacks on the host (ours + `escalume`, counted, untouched); `pg_stat_activity`
0; settle 171/171. **Direct-call census** from comment-stripped bodies + quals: all 21 doors have
callers (`can_forms_read` 0|9, `can_process_templates_read` 0|9, `can_accreditation_read` 3|4,
`can_documents_read` 4|3, … `can_cases_deliberation_read_in_commission` 1|0 = `_case_caps` only, as
designed); **the wrapper `is_commission_staff_of(_for)`: 0 and 0** — the deferral, still owed under
its named unit. Arms: `hat` 0 · `floor` 0 · `FROMFINDINGS=1 wrapper` 0 (BLIND set 41, all
allow-listed) · **`census` = 1, and that is CORRECT**: 23 gates NO sweep has ever seen — the 21
doors + both wrapper forms — UNKNOWN, not BLIND (the sixteenth-stopper on a 21-door increment; the
arm cannot be green before the sweep). `401` 0, `409` 0. Deriver exit 0, base `a02487bc`, 75
cases: `SCOPE: 4 file(s) — 4 committed (a02487bc..HEAD), 0 worktree, 0 untracked | filter: none |
derivation: catalog`. `410 §§ 7.3/7.4` were re-pinned 1 → 2 earlier in the unit, each observed RED
first (7.3: two independent readings of the same flip; 7.4: observed red on the T4 seed). `409`
control (a) re-stated against the post-T7 sites, NOT inherited: the nine `*_select` policies now
compose `can_forms_read` beside `is_tenancy_admin_of`; the conclusion holds for a DIFFERENT reason
(a PERMISSION fact where it was a MEMBERSHIP fact). **Door sweep, one invocation, both arms:**
`ARM-DOMAIN predicate=34/150 policy=39/226`, own green baseline captured (`PASS, Files=275,
Tests=9218`), on predicate case 1 of 34, each case a full-suite run — HOURS, detached. It warns up
front that `form_assets_select_member` and `responses_insert_own` are names the PREDICATE arm cannot
match, so it cannot end CLEAN by construction (3 UNPROVEN or 1 DIRTY); the policy arm and the write
arm (`CASES="responses_insert_own"`) own those. **Ruling:** run to completion — it is AC-10's
requirement and the `census` arm depends on it — and it is THE GATE RUN, not a rehearsal: the door
surface (migrations, doors, policies) is FROZEN from now until the sweep ends; tests and docs may
move. The tester waits (a reset destroys the sweep). Folding verdicts in is a MERGE, never a copy
(`git diff --stat` on the findings file read together with the harness exit). Still owed after:
the four plant + rollback proofs, L22's plant, the write arm, the set-valued cases, `SELFTEST=1`
with the three `--- GROUP` lines and `bash --version`, `RESET_EVERY` port-then-prove, commits, the
record entry. ⚠ A detached launch is verified by PID + START line, never by a file's presence.

### 2026-09-14 — the sweep verified by PID + START banner; `RESET_EVERY` measured by READS; restart ordered with `RESET_EVERY=5` (lead)

Backend: PIDs 1673 / 3287 live in `ps -ef`; the harness's own banner (`SELECTION-SOURCE: CASES set
…`, `SUBSET RUN — COMMITTED baseline NOT opened for write`, `preflight: 0 degenerate bodies`,
`ARM-DOMAIN predicate=34/150 policy=39/226`, `baseline OK: PASS, Files=275, Tests=9218`); at check,
2 of 34 predicate cases, last `COVERED app.can_action_items_read(…)`. **`RESET_EVERY` counted as
READS (`\$\{?RESET_EVERY`), never mentions** across all 38 harnesses: door audit 13, write-path
audit 11, command-door neutralizer 13, every other harness 0 — `act-hat-blind-sweep.sh` has no
`supabase test db` at all (nothing to bound; not ported, correctly), `authz-setvalued-targeted-cases.sh`
ran the full suite per case and read the knob 0 times — an operator typing `RESET_EVERY=1 bash …`
got a run that LOOKED configured. **Ported** there (reads 4, `bash -n` 0): interlock-first
`periodic_reset`, `maybe_periodic_reset` at the top of `run_case`, a `RESET-POLICY:` summary line;
two deviations with measured reasons (default 0 not 20 — three cases, 20 would never fire and be
indistinguishable from "not implemented"; no `SUBSET_RUN` predicate — the file has no `CASES`).
Proof-by-run after the sweep. **Finding 1, ruled:** the gate run in flight is a `CASES=` subset with
`RESET_EVERY` unset, so by the harness's own rule it does NO periodic resets and each of 34
verdicts carries the drift of every case before it — **RESTART ordered with `RESET_EVERY=5`** (two
cases lost; a bound the gate record can rule on; a harness's own restores are the thing under
suspicion). **Finding 2:** `p0-authz-rowdoor-audit.sh` and `p0-authz-invoker-audit.sh` (arm 1, not
run by T8) read it 0 times with the same loop shape — follow-up
`FUP-AE5-STAFF-ARM1-HARNESSES-DO-NOT-READ-RESET-EVERY`, ported with proof in their own run, never
blind. `409` control (a) re-stated (uncommitted, door surface untouched).

### 2026-09-14 — the sweep's kill left `app.can_capa_read` at `select true` — recovered via `RECOVER=1`, verified; relaunched with `RESET_EVERY=5` (lead)

Backend: `kill -TERM` left the parent alive, `kill -KILL 1673` finished it, and the sentinel
`/tmp/authz-door-INFLIGHT.sql` was PRESENT holding `can_capa_read`'s original body — the live
function read straight from the catalog was `select true`: a `commission.capa.read` door at
always-grant on the local stack, the state the sentinel interlock exists for. Recovery through the
harness's own path, `RECOVER=1 bash supabase/tests/mutation/p0-authz-door-audit.sh`, exit 2 (its
recovery exit): *"RESTORE APPLIED and VERIFIED against the catalog (psql rc=0, probe=ab8ee139…).
⚠ VERIFY IT ANYWAY — this message is not proof. ⛔ Every verdict from the killed run is void."*
Verified independently: the body is back to `select authz.has_permission(p_user_id, 'commission',
p_commission_id, 'commission.capa.read')`, sentinel cleared, `pg_stat_activity` 0, settle 171/171.
**Relaunch verified:** PIDs 3951 / 5416 live; the § 7.16 preflight on relaunch reads `clean — 0
degenerate bodies (all three neutralization forms)` — the witness that nothing was left behind;
same single invocation, both arms, 75 cases, `RESET_EVERY=5`. Correction on the reset evidence:
this harness prints no upfront `RESET-POLICY` banner (that line is the set-valued port's); its
evidence is `--- PERIODIC RESET (…) ---` per firing, cadence `DONE > 1 && (DONE-1) % RESET_EVERY
== 0`, so the first fires before case 6 and the expected count over 34 predicate cases is **6**,
counted against that. Recorded as a restart, not a failure — the first launch abandoned at case 2
for the unbounded-drift property; the kill's consequence is itself the lesson's direct evidence.
`FUP-AE5-STAFF-ARM1-HARNESSES-DO-NOT-READ-RESET-EVERY` filed (medium; closes on one run each
showing the reset FIRE, never on the code's presence), gate 13 = 0. Uncommitted: `409` (a), the
set-valued port, the follow-up. LESSONS candidate: a killed mutation harness leaves its gate
neutralized; `RECOVER=1`, then verify the body yourself.

### 2026-09-14 11:20 — sweep progress measured by the lead on the relaunch's own directory (`authz-audit-t8b`): alive, on pace, ~12 h total

PO asked whether it stalled. Read from the running process and its files, no DB touched: parent
3951 alive since 10:19:26, `RESET_EVERY=5` and `WORK=…/authz-audit-t8b` in its environment; a case
child (6165) started 11:18:37; `progress.tsv` 5 predicate verdicts (all COVERED so far:
`can_accreditation_read`, `can_action_items_read`, `can_capa_read`, `can_cases_deliberation_read`,
`can_cases_deliberation_read_in_commission`), last write 11:12:15; `outofdomain_pred_bool.tsv.reset`
at 11:13:23 — the first periodic reset, fired after case 5 exactly as the cadence predicts; case 6
(`can_cases_vocabulary_read`) mutated at 11:18:35 after the reset + re-baseline. Pace: ~10 min per
case (11:02 → 11:12) + ~5 min per reset ⇒ 34 predicate cases ≈ 6 h, 39 policy cases ≈ 6.5 h, **≈ 12
h end to end from 10:19**, i.e. into the night of 2026-09-14/15. Not shortened: the 75 cases are the
deriver's diff-scoped set for this phase base and the run IS the gate; the stack stays the sweep's
for the duration (a reset by anyone destroys it and leaves a neutralized gate live).

### 2026-09-14 11:2x — PO asked for a status every 10 swept cases; a lead-side watcher armed (lead)

Watcher on the relaunch's `progress.tsv` (`authz-audit-t8b`): one line at every multiple of 10
verdicts with the verdict breakdown, any `NOTICED` / `DIRTY` / `ERROR` / `UNPROVEN` verdict the
moment it lands, and a line if the sweep's parent process (3951) dies — exit at 75/75. Read-only on
a file; the DB stays the sweep's. Each event is relayed to the PO as a status line; a verdict to
act on is relayed immediately, not at the next ten.

### 2026-09-14 13:24 — sweep status 22/75: all COVERED so far (lead watcher)

22 predicate verdicts, 22 COVERED, 0 NOTICED / DIRTY / ERROR / UNPROVEN; last
`app.can_read_event(p_event_id uuid, p_user_id uuid)`. Pace since 10:19 incl. baseline and four
periodic resets: ~8.4 min per case ⇒ ~10.5 h end to end, finish ≈ 21:00.

### 2026-09-14 — sweep: first NOTICED — `app.can_read_referral_internal_note(p_note_id, p_uid)` (lead watcher)

NOTICED = the suite reacted to the neutralized gate by RAISING rather than by a clean red assertion
(the shape-reading-harness lesson: a test that raises turns COVERED into NOTICED) — evidence of
coverage, quoted and dispositioned in the gate record, never read as a pass and never as BLIND.
This door became probeable only with T7's `referral_internal_notes` seed row (PHI module, process
text only); the raise is likely a PHI-audit or class-1 guard firing under a `select true` body.
Backend asked to read the case's run log (`runlogs/pred_app_can_read_referral_internal_note_….log`,
a file, not the DB) and name the raising test and its SQLSTATE now, so the disposition is ready at
the merge. The sweep continues untouched.

### 2026-09-14 — the NOTICED dispositioned from the run log: a Rule 11 audited-read guard firing, genuine, reproduced after a fresh reset (lead)

Backend, read-only on `runlogs/pred_app_can_read_referral_internal_note_….log`: neutralization
form = the predicate arm's `select true` (always-grant). What raised, verbatim:

```
psql:…/supabase/tests/150_referrals.sql:1626: ERROR:  log_audit_access: sem permissão para registrar este acesso
CONTEXT:  PL/pgSQL function log_audit_access(text,text,uuid,uuid,text,jsonb) line 22 at RAISE
SQL statement "SELECT public.log_audit_access('referral.note_viewed', 'referral', p_referral_id, …)"
PL/pgSQL function list_referral_internal_notes(uuid) line 44 at PERFORM
```

**Disposition — a Rule 11 guard, not a seed artefact, three reasons:** (1) the raise is in the AUDIT
WRITER, not the reader — `list_referral_internal_notes` served the notes (the forced door said
yes), then `log_audit_access('referral.note_viewed', …)` REFUSED to record an access for a caller
it does not recognise as permitted: the door opened, a different class-1 guard noticed; (2) 15 of
226 subtests failed with over-grant shapes — `R5·K-R5-1 a SOURCE member is DENIED the TARGET-owned
note (cross-side)` and its mirror, both `QPS operator is DENIED` arms, `the source coordinator's
note list carries ONLY the source note (1)` → have 2 / want 1, `the audited door serves the
non-redacted body to the owning side` → have `CORPO-NOTA-DESTINO` / want `CORPO-NOTA-ORIGEM`, `a
redacted note renders [redigido]` → have the OTHER side's body — the leak the door exists to stop;
(3) `150_referrals.sql` truncates its tables first (`referral_read_receipts`, …), so T7's seed row
is gone before its assertions run. Why NOTICED not COVERED: the raise aborted the plan (`Bad plan.
You planned 226 tests but ran 218`, `Dubious, test returned 3`) — the suite failed, the harness
cannot name WHICH assertion; evidence, never a pass, never BLIND. ⭐ **Reproduced after a fresh
reset through the retry net** (`drift suspected — resetting and retrying … ONCE` → `post-reset
§ 7.16 preflight: clean` → `post-reset baseline: PASS` → `NOTICED` again); the net is gated on
`resets_enabled`, so on the abandoned unbounded run this verdict would have printed
`drift-shaped; NOT retried` and been unattributable — the restart ruling is what made it evidence.
`RESET_EVERY=5` confirmed in both PIDs' `/proc/…/environ`; resets at 5/10/15/20 + the retry, each
with a clean preflight and an unmoved worklist; 23 of 34 predicate cases done. **Owed at the
sweep's end (two-second catalog read):** `log_audit_access`'s `errcode` — psql prints the message,
not the SQLSTATE, at default verbosity (0 hits over 26,896 lines). ⚠ Harness text inaccuracy: the
scheduled-reset line prints "N case(s) swept since the last baseline" with N = the RUNNING TOTAL
(`DONE-1`), not the count since the last reset — "20" at the fourth reset when 5 had been swept;
cosmetic, but a reader counting drift from it over-states 4× — low follow-up, backend, off the
stack.

### 2026-09-14 14:11 — sweep status 30/75: 29 COVERED, 1 NOTICED (lead watcher)

Last `app.can_safety_events_read(p_commission_id uuid, p_user_id uuid)`. 8 cases in 47 min since
13:24 (~5.9 min/case, no reset in the window); 4 predicate cases left, then the 39 policy cases.

### 2026-09-14 — sweep: second NOTICED — `app.can_sign_meeting(p_attendee_id, p_signer)` (lead watcher)

Row 12's authorizer, composed by `meeting_signatures_insert`'s `with_check` and by the DEFINER
command door `sign_meeting` (which raises `HC036` when it denies). Under `select true` a raise is
expected from one of those two paths or from the audit writer; backend reads the case's run log
(a file) and names the raising test, message and neutralization form; the SQLSTATE is owed at the
sweep's end with the first one. Evidence, never a pass, never BLIND; dispositioned at the merge.

### 2026-09-14 — the second NOTICED dispositioned: HC036 is the leak, the state guard's raise is the wreckage; three files noticed (lead)

Backend, from `120_meetings.sql`'s run log: form = the predicate arm's `select true` (measured from
effect — `select false` would have produced denials). Raising site verbatim:
`psql:…/supabase/tests/120_meetings.sql:240: ERROR: esta reunião não está aguardando assinatura /
CONTEXT: PL/pgSQL function sign_meeting(uuid,text,text) line 24 at RAISE` → `Failed 11/32
subtests`, `Bad plan. You planned 32 tests but ran 22`. **Mechanism, in order:** `# Failed test 22:
"cannot sign another attendee's row (HC036)" caught: no exception / wanted: HC036` — with the
authorizer forced open a caller SIGNED ANOTHER ATTENDEE'S ROW; that advanced the meeting past
"awaiting signature", so the next legitimate `sign_meeting` hit the later state guard at line 24 —
the mirror of the earlier-guard lesson: an earlier guard NOT firing corrupted the state a later
guard then rejected. **Three independent files noticed:** (1) `120` test 22, the identity guard;
(2) `251_authz_p0_isolation.sql` — `test 23 "meeting_signatures_insert DENY 42501: a non-attendee
cannot sign for an attendee" caught: no exception` and `test 24 … died: 23505 duplicate key …
meeting_signatures_active_key` (the illegitimate row from test 23 already holds the slot) — the
POLICY site noticed; (3) `410` itself, 3 of 45 — § 3.5 (every `composedWith` authority present),
§ 8.1 (declared ⇒ enforcing), § 8.6 (the cardinality triple): the neutralized body no longer
composes `can_meetings_minutes_sign`, so the manifest caught the mutation STRUCTURALLY. Reproduced
through the retry net after a fresh reset (preflight clean, baseline PASS, worklist unchanged).
Contrast kept for the gate record: on the first NOTICED a DIFFERENT subsystem (the audit writer)
refused and the leak was visible only indirectly; here the door's own sibling guards and the
manifest named it — same verdict class, opposite evidentiary quality, both attributable only
because the retry net reproduced them. Errcodes owed at the sweep's end: the two raising RAISEs
(`log_audit_access`; `sign_meeting` line 24) — HC036 and 42501 came back as WANTED values from the
assertions and need no read.

### 2026-09-14 15:26 — sweep status 40/73: 38 COVERED, 2 NOTICED; the predicate arm is DONE (34/34), the policy arm has begun (lead watcher)

Last `policy case_tags.case_tags_select (SELECT)` — the policy arm's 6th of 39. Predicate arm
closed at 34 cases: 32 COVERED + 2 NOTICED (both dispositioned), 0 BLIND, 0 DIRTY, 0 ERROR. The
watcher now counts distinct (arm, case) and completes on the parent's exit (domain 73, not the 75
names). Pace 15:26 − 14:11 = 10 cases / 75 min ≈ 7.5 min/case incl. resets ⇒ ~33 policy cases
left ≈ 4 h, finish ≈ 19:30.

### 2026-09-14 16:33 — sweep status 50/73: 48 COVERED, 2 NOTICED (lead watcher)

Policy arm at 16 of 39; last `form_item_validations.form_item_validations_select (SELECT)`. 10
cases in 67 min ≈ 6.7 min/case; 23 left ≈ 2.6 h, finish ≈ 19:10.

### 2026-09-14 17:44 — sweep status 60/73: 58 COVERED, 2 NOTICED (lead watcher)

Policy arm at 26 of 39; last `meetings.meetings_select (SELECT)`. 10 cases in 71 min ≈ 7.1
min/case; 13 left ≈ 1.5 h, finish ≈ 19:15.

### 2026-09-14 18:57 — sweep status 70/73: 68 COVERED, 2 NOTICED (lead watcher)

Policy arm at 36 of 39; last `process_templates.process_templates_select (SELECT)`. 3 cases left
≈ 20 min; the parent's exit is the completion signal.

### 2026-09-14 19:16 — DOOR SWEEP COMPLETE on its own exit: 73/73, 71 COVERED, 2 NOTICED, 0 BLIND / DIRTY / ERROR / UNPROVEN (lead watcher)

Parent 3951 exited 19:16 (launched 10:19:26 with `RESET_EVERY=5`; ~9 h). Last case `policy
standard_assessments.standard_assessments_select (SELECT) COVERED`. Predicate arm 34: 32 COVERED +
2 NOTICED (both dispositioned above, both reproduced through the retry net); policy arm 39: all
COVERED. The verdict file is the watcher's reading; the HARNESS's own exit code and its SCOPE line
are the claim and are read by backend bare, together, before anything is folded in (a pipe erases
the exit; a summary line is not the code). Owed now, in order: the two errcode reads;
`docs/reviews/authz-door-audit-findings.md` merged (`git diff --stat` read with the exit), NOTICED
quoted as evidence; the write arm `CASES="responses_insert_own"` and the policy-arm disposition of
the two names the predicate arm cannot match; the four plant + rollback proofs; L22's plant; the
set-valued run proving the `RESET_EVERY` port; `SELFTEST=1` on the deriver + door harness with
`PASS · FAIL · SKIPPED`, the three `--- GROUP` lines and `bash --version`; commits by path; the T8
record entry. The stack stays backend's through the plants (they mutate); the tester's runs after.

### 2026-09-14 — sweep exit READ BARE: 3 = UNPROVEN (PARTIAL) by construction, RULED; errcodes bound; merge 353 → 376 with 0 lost; both NOTICED were STANDING (lead)

**The claim, read together:** `READ_ARM_EXIT=3` from the harness's own stdout — `=== RESULT:
UNPROVEN (PARTIAL) — 73 gate(s) measured, 0 BLIND · 0 ERROR, but these were requested and matched
NO gate: form_assets_select_member responses_insert_own … NOT a pass. ===`; `SWEPT: 73 COVERED: 71
BLIND: 0 NOTICED: 2 ERROR(harness): 0`; `ARM-DOMAIN predicate=34/150 policy=39/226
out-of-domain-bool=35`; `POLICY ARM HALF: using ONLY — a COVERED on a FOR ALL policy is a READ-half
claim`; `resets=16 (RESET_EVERY=5 — set EXPLICITLY)`; `committed baseline VERIFIED unchanged
(cksum)`. Deriver `SCOPE: 4 file(s) — 4 committed (a02487bc..HEAD), 0 worktree, 0 untracked |
filter: none | derivation: catalog`, exit 0. **Ruled (CLAUDE.md § 6 step 1: the exit IS the claim
and is RULED here):** exit 3 is the harness refusing to call a partial run clean — the two
unmatched names are dispositioned by construction: `responses_insert_own` (INSERT, `with_check`) by
the WRITE ARM, launched with `RESET_EVERY=5`; `form_assets_select_member` is a `storage.objects`
policy, outside the predicate arm's function domain AND the policy arm's `public` domain — an
explicit disposition, and, because T7 RE-KEYED it (the three-deep nested call the paren balancer
caught), a follow-up: the sweep's policy domain excludes `storage`, so a re-keyed policy has no
mutation arm — `FUP-AE5-STAFF-DOOR-SWEEP-POLICY-ARM-EXCLUDES-STORAGE-SCHEMA` (medium, backend),
with 425's coverage of that site stated either way. **Errcodes bound:** `can_read_referral_internal_note`
→ `log_audit_access` raised **`42501`** (insufficient_privilege — the Rule 11 writer refused on
PRIVILEGE grounds); `can_sign_meeting` → `sign_meeting` line 24 raised **`HC033`** (the STATE guard;
HC036 is the guard that failed to fire; `sign_meeting` carries HC033/HC035/HC036); direction
`positive` = always-grant, from the harness's own record. **Merge** via
`scripts/lib/merge-findings-baseline.sh` exit 0 — ⛔ **THIS PARAGRAPH WAS FALSE AS FIRST WRITTEN
(corrected in place the same evening, see the entry "the merge GUTTED the baseline" below):** the
helper's output was EXACTLY the 73-row subset — 353 → 73 top-level rows, all 36 BLIND gone — and
its "0 lost" accounting did not notice. The reassuring "376 rows, 0 lost, 0 changed" recorded
here came from backend's second parser, which counted the merge's INDENTED QUOTED COPIES inside
provenance annotations as table rows; the crude `grep -c '^\|'` (87 vs 367) had been right and
was explained away. The census arm caught it (205 unknown after the install, zero overlap with the
23). Nothing committed; the baseline restored byte-identical to HEAD (cksum 1983823619 both). The
23 new verdicts are exactly the census arm's 23 UNKNOWN gates, every one COVERED — that fact
survives; the merge does not. **⭐⭐ Both
NOTICED gates were ALREADY NOTICED in the committed baseline** — this run reproduces standing
verdicts under a reset-bounded run with the retry net; neither is attributable to T7. **Ruled on
the wrapper:** `is_commission_staff_of(_for)` COVERED with 0 production callers means a TEST (426)
reddens when it opens; it says nothing about production wiring and does not touch the deferral
follow-up — written that way, never as coverage. Uncommitted: the merged baseline, `409` (a), the
port. In flight: the write arm; owed: plants, L22's plant, the set-valued run, `SELFTEST=1`,
commits, the T8 entry with the census arm re-run GREEN.

### 2026-09-14 — write arm run 1: ERROR by the drift tripwire (correct) — a re-key orphans a shape-keyed control; the lead's 425 assumption measured WRONG (lead)

`WRITE_ARM_EXIT=1`, `ARM-DOMAIN guard=0/13 policy=1/107`, `ERROR responses.responses_insert_own`,
`=== RESULT: DIRTY — 0 BLIND, 1 ERROR … ERROR is not a pass ===`, baseline cksum unchanged. The
subset report: `snapshot drift (with_check): live='((created_by = (SELECT auth.uid())) AND
app.can_responses_create(commission_id, (SELECT auth.uid())))'` — the harness's embedded 33-row
snapshot (§ 7.2, a TRIPWIRE: the live predicate must byte-match or the case is ERROR, "its
committed verdict was earned against different text") still read `AND
app.is_member_of(commission_id)`; T7 re-keyed the policy, the byte-match failed, and the harness
refused to neutralize from a stale shape — right, because restoring from that snapshot would write
back the WRONG body. Same family as `409` control (a) and the seven pins: a re-key orphans a
shape-keyed control (LESSONS candidate beside the rename lesson). Backend refreshed the one row to
the measured live text (a test asset; the frozen door surface untouched; `bash -n` 0) and
relaunched that single case — the verdict is RE-EARNED, not inherited. **`form_assets_select_member`
dispositioned and filed:** `FUP-AE5-STAFF-DOOR-SWEEP-POLICY-ARM-EXCLUDES-STORAGE-SCHEMA` (medium),
gate 13 = 0 — no arm can neutralize a `storage.objects` policy. ⚠ **The lead's stated expectation
("425's probe is public-only") was WRONG, measured by backend:** 425 derives the relation from the
site string (`regexp_replace(p_site, '\.[^.]+$', '')` → `storage.objects`) and DOES issue `select
count(*) from storage.objects`; the gap is two-fold — (1) no mutation arm reaches the site, (2) 425
reaches it but cannot discriminate because the table is EMPTY on the seeded stack (§ 2.0 excludes
it; § 3.1/3.2 keep it in the denominator). The follow-up's closure requires both halves and says a
COVERED earned while `storage.objects` holds zero rows is not a closure. Owed unchanged: (5)–(9).

### 2026-09-14 — the merge GUTTED the baseline (353 → 73 rows, all 36 BLIND lost); caught by the census arm, restored, NOT committed; L25 rules the fold-in (lead)

Backend, plainly: `merge-findings-baseline.sh` exited 0 and reported two statistics lines as its
only drop; counting TOP-LEVEL table rows, the installed output was exactly the subset — **303 rows
lost, including all 36 BLIND** — the documented hazard verbatim (*"a subset run has OVERWRITTEN the
committed findings baseline with only its own cases … FROMFINDINGS arms get GREENER as that
baseline gets EMPTIER"*). The helper is built for a FULL run's generated file, which legitimately
regenerates every row; fed a subset it treats the 303 absent rows as regenerated away. **The census
arm caught it independently:** 205 unknown gates after the install, zero overlap with the 23 it
named before. **Backend's reporting was wrong twice, in opposite directions, and it said so:** (1)
a grep artefact cried wolf (133 → 40); (2) the "correction" — a parser using
`lstrip().startswith('|')` — counted the merge's indented quoted copies inside provenance
annotations as rows and produced "376, 0 lost", which the lead recorded as fact and has now
corrected in place above. The over-correction was the dangerous one; the crude `grep -cE '^\|'`
(87 merged vs 367 baseline) was right and was dismissed the moment a friendlier number appeared —
a parser that counts a quotation as the thing quoted. **State: safe** — `git diff --stat` on the
findings file empty, cksum HEAD = on-disk 1983823619, census arm exit 1 with exactly the pre-merge
23 unknown; nothing committed.

**L25 (lead):** option (b) then (a). (b) `merge-findings-baseline.sh` gains a guard that ABORTS
loudly when the generated file's row set is a strict subset of the baseline's (the accounting it
already claims to do), proven by feeding it THIS subset file and requiring the abort, and by
feeding it a full-shaped file and requiring the merge — the guard's discrimination half. (a) then
the 23 rows folded in by a TARGETED insertion into the existing table (top-level rows counted
before and after: 353 → 376, 36 BLIND before and after, verified by the crude `^\|` count AND by a
parser that excludes indented lines, both quoted), the census arm re-run and quoted GREEN. (c) a
full re-sweep is refused: many hours re-measuring 300+ gates T7 did not touch, for a defect that
is the helper's, not the sweep's. The helper's subset-unsafety is filed as a follow-up only if (b)
does not land in this unit; if it lands, its witness is the abort line.

**Also this round:** write arm re-run after the snapshot refresh — `WRITE_ARM_EXIT=0`, `ARM-DOMAIN
guard=0/13 policy=1/107`, `COVERED responses.responses_insert_own`, `=== RESULT: CLEAN — 1
gate(s) measured, all COVERED ===`, verdict RE-EARNED (run 1 was `DIRTY / 1 ERROR` on `snapshot
drift (with_check)`). `FUP-AE5-STAFF-DOOR-SWEEP-POLICY-ARM-EXCLUDES-STORAGE-SCHEMA` filed, gate 13
= 0. Blocked behind L25: the census GREEN quote, the four plants (the census plant needs a green
census), L22's plant, the set-valued run, `SELFTEST=1` ×2, commits, the T8 record. Uncommitted:
`409` (a), the port, the write-path snapshot row, the storage follow-up. Stack idle and clean.

### 2026-09-14 — L25 executed: the guard proven both ways, the 23 folded in, census arm GREEN; L25's predicate as WORDED would not have caught it (lead)

**(b)** `merge-findings-baseline.sh` guard — proof 1, this subset file: `MERGE-ABORT: the GENERATED
report is missing 303 row(s) the baseline carries. baseline top-level rows: 353 / generated: 73 /
crude cross-check (grep -cE "^\|"): baseline=367 generated=77 / first missing rows: …` exit 2;
proof 2, full-shaped inputs: `SUBSET GUARD: generated covers all 353 baseline row(s); 353
generated` and `… 376 generated. No drop.` exit 0 — both counters printed, top-level `^\|` only,
no leading whitespace, the parser lesson written at the guard. ⛔ **Correction to L25's wording,
backend's and load-bearing:** "strict subset of the baseline" is FALSE for the file that gutted it
— the subset report carried 23 keys the baseline did not have, so a literal subset test would have
PASSED it. The guard keys on *the generated file is MISSING baseline rows* (one direction: a full
run regenerates every row and drops none; new rows always welcome). The lead's predicate would not
have caught the incident it was written for; the file carries the reasoning with 353/73/303 as
evidence. **(a)** fold-in by targeted insertion: parser 353 → 376, crude 367 → 390, BLIND 36 → 36,
COVERED 294 → 317, NOTICED 23 → 23, lost 0; `git diff --stat` = `23 insertions(+)`, zero deletions;
both counters move by exactly +23 and AGREE — the disagreement they showed on the merge output was
the signal talked away. **Census arm:** `ARM=census … exit 0 === INVARIANT HOLDS ===` (the named
backlog above it — `_grant_case_access_unchecked`, `_set_participant_patient_unchecked`,
`authz.entailed_grants`, `authz.explain_permission`, `public.assume_role` — live, outside the domain,
kept, not verdicts). 1 → 0 on the fold-in alone: **23 unknown before the sweep → 205 under the
gutted merge → 23 after the restore → 0 after the honest fold-in** is the attribution. In flight:
the four plants; then L22's plant, the set-valued run, `SELFTEST=1` ×2, commits by path, the T8
record. Uncommitted: the guard, the fold-in, `409` (a), the port, the snapshot row, the follow-up.

### 2026-09-14 — T8 plants: four arms RED→GREEN by plant and rollback; L22's plant found REVERSE 3b COULD NEVER FIRE (a control that compared a string with itself) — repaired, `410` 45/45 (lead)

Backend's report, verified where git can see it. **The four arms, exits bare, baseline 0 / planted
1 / rolled back 0 each:** FLOOR — `app.a_door_that_does_not_exist(uuid)` planted in its allowlist
→ `=== INVARIANT VIOLATED ===`; WRAPPER (`FROMFINDINGS=1`) → `*** INVARIANT VIOLATED — BLIND
wrappers NOT in the allowlist:`; HAT → `=== INVARIANT VIOLATED ===`; CENSUS — the one
`can_roster_read` row pulled from the findings file → `*** CENSUS VIOLATED — authz gates that NO
sweep has ever seen: app.can_roster_read(p_commission_id uuid, p_user_id uuid)` — which is also the
direct proof that the fold-in is what made the census arm green (pull one of the 23, it names that
gate). **Verified by the lead in git, not relayed:** `git diff --stat` on all five allowlist files
(`act-hat-blind`, `authz-blind`, `authz-invoker-blind`, `authz-neverclled-door`,
`authz-role-literal`) EMPTY — byte-identical to HEAD; the findings file still `23 insertions(+)`,
zero deletions.

⭐⭐ **L22's plant found the discrimination half it exercised was a control that could not fail.**
First run of the plant (the identity-gate expression moved into a `--` comment of
`start_correction_draft`) fired REVERSE 3 and left **3b silent** — 3b being the arm the plant
existed for. Cause, measured by backend: `pg_temp.fn_body` ALREADY strips `--` comments (its own
comment says so); § 8.7's 3b compared `fn_body(...)` against `strip_sql_comments(fn_body(...))` —
**the same string, stripped twice**; "present in the raw body AND absent from the stripped one" was
unsatisfiable for every input. Backend shipped it as L22's discrimination half and reported it as
such; the plant caught it on its first run. **Repaired (uncommitted, in `410`):**
`strip_sql_comments` deleted (two mentions remain, both in the comment that tells the story);
`pg_temp.fn_body_raw` added (comments intact, `:1193`); 3b now `position(expr in fn_body_raw) > 0
AND position(expr in fn_body) = 0` (`:1277–1278`) — RAW vs STRIPPED, two genuinely different
strings; REVERSE 3's identity arm reads `fn_body` and says in-line it is comment-stripped by
construction. Lead read the conjunction at `:1266–1278` in the worktree and the diff's accessor swap.
**Re-run, correct:** `PRECONDITION in_raw_body = t in_stripped_body = f`; BASELINE `reverse_3b:
(none)`; PLANTED `reverse_3b: commission.responses.create -> public.start_correction_draft declares
an identity gate that appears ONLY in a comment` (and `reverse_3` on the same plant); ROLLED BACK
`reverse_3b: (none)`, `gate_kind=identity gate_expression='auth.uid() is distinct from
v_corrector'`. **`410` after the repair: exit 0, 45/45.** LESSONS candidate: *a discrimination half
built on an accessor that already normalises compares a string with itself* — the
close-condition-that-cannot-fail family, new shape (an idempotent transform applied twice).

**In flight (stack backend's):** the set-valued harness under `RESET_EVERY=1` (its `RESET-POLICY:`
line is the port's witness); then `SELFTEST=1` ×2 with the three `--- GROUP` lines and `bash
--version`, commits by explicit path, the T8 record entry. ⚠ `425` is modified in the shared
checkout and is NOT backend's — the tester's round-2 addendum (`plan(18) → plan(21)`, fixture
`f425w`), uncommitted and unrun by design until backend parks; backend's commits by path exclude it.

### 2026-09-14 — T8: THE gate run, the four arms, and three controls that could not fail

**Commits (by explicit path):** `34117443` the merge-helper guard · `4c6100a3` the findings
fold-in · `1f139a08` 410's REVERSE 3b repair + 409 control (a) · `49c5adfe` the `RESET_EVERY`
port + the write-path drift snapshot · `36359cf3` two follow-ups. Earlier this stretch:
`1bbb347a` two harness follow-ups. ⛔ `supabase/tests/425_…sql` is modified in the shared
checkout and is the TESTER's run-4 addendum (`plan(18) → plan(21)`, a new `f425w` fixture);
committed by path, so it is not in any of the above.

**Preconditions, every time:** `pg_stat_activity` 0 · settle-check 171 / 171 · **2** Supabase
stacks on the host (ours + `supabase_db_escalume`), counted, never touched. `bash --version` =
**GNU bash 5.2.37(1)-release (x86_64-pc-msys)** — the SELFTEST verdict is shell-dependent and
nothing else says so.

#### The direct-call census — per site, comment-stripped bodies + policy quals

All 21 doors have callers. `fn | pol`: `can_forms_read` 0|9 · `can_process_templates_read` 0|9 ·
`can_accreditation_read` 3|4 · `can_documents_read` 4|3 · `can_referrals_metadata_read` 4|0 ·
`can_meetings_read` 1|3 · `can_roster_read` 0|4 · `can_cases_vocabulary_read` 0|3 ·
`can_charter_read` 2|1 · `can_indicators_read` 1|2 · `can_action_items_read` 1|1 · and 1|0 or 0|1
each for `can_capa_read`, `can_cases_deliberation_read` (its one caller is
`app.can_reach_case_on_member_surface`), **`can_cases_deliberation_read_in_commission` (its one
caller is `app._case_caps`, as designed)**, `can_cases_vote`, `can_meetings_cases_shell_read`,
`can_meetings_minutes_sign`, `can_responses_create`, `can_safety_events_read`,
`can_safety_events_report`, `can_referrals_notes_author`.
⭐ **`app.is_commission_staff_of` 0 callers · `app.is_commission_staff_of_for` 0 callers** — the
deferred re-expression, unchanged.

#### The gate run — ONE invocation, both arms, `RESET_EVERY=5`

```
SCOPE: 4 file(s) — 4 committed (a02487bc..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
READ_ARM_EXIT=3
=== RESULT: UNPROVEN (PARTIAL) — 73 gate(s) measured, 0 BLIND · 0 ERROR, but
    these were requested and matched NO gate: form_assets_select_member responses_insert_own
    A clean verdict over a subset of what was asked for is the finding this gate
    exists to prevent. NOT a pass. ===
SWEPT: 73 gate(s)   COVERED: 71   BLIND: 0   NOTICED: 2   ERROR(harness): 0
ARM-DOMAIN predicate=34/150 policy=39/226 out-of-domain-bool=35
    POLICY ARM HALF: `using` ONLY — a COVERED on a FOR ALL policy is a READ-half claim.
    preconditions: baseline GREEN at the LAST capture (shape=Files=275, Tests=9218) ·
                   resets=16 (RESET_EVERY=5 — set EXPLICITLY, so this SUBSET run resets)
    committed baseline VERIFIED unchanged (cksum)
```

⚠ **RESTARTED, and the restart is part of the record.** The first launch was abandoned at case 2
of 34 for the UNBOUNDED-DRIFT property (a subset run resets only when `RESET_EVERY` is explicit),
not for a failure. **The kill left a live authorization gate NEUTRALIZED**: the sentinel held
`app.can_capa_read`'s original body and the catalog held `select true`. `RECOVER=1` (exit 2)
restored it — *"⛔ Every verdict from the killed run is void"* — and I verified the body myself
rather than trusting the message. The relaunch's `§ 7.16` preflight is the witness:
`clean — 0 degenerate bodies (all three neutralization forms)`. `RESET_EVERY=5` confirmed in
`/proc/<pid>/environ` for both PIDs.

**The write arm**, `CASES="responses_insert_own"`: first run `WRITE_ARM_EXIT=1`,
`ERROR responses.responses_insert_own`, `snapshot drift (with_check)` — the drift tripwire
refusing to neutralize from a shape T7 had re-keyed. Snapshot refreshed, verdict **re-earned**:
`WRITE_ARM_EXIT=0`, `SWEPT: 1 COVERED: 1 BLIND: 0 ERROR: 0`, `RESULT: CLEAN`.
`form_assets_select_member` has no arm at all — filed.

#### The two NOTICED — standing baseline verdicts, reproduced, neither attributable to T7

Both were **already NOTICED in the committed baseline**. Both reproduced through the retry net
after a fresh reset, which is what makes them evidence rather than drift; on the abandoned
unbounded run they would have read *"(drift-shaped; NOT retried)"*.

* `app.can_read_referral_internal_note` — neutralization direction **`positive`**. Raised at
  `150_referrals.sql:1626`: `log_audit_access: sem permissão para registrar este acesso`,
  `CONTEXT: PL/pgSQL function log_audit_access(…) line 22 at RAISE`, **errcode `42501`** (read
  from the catalog; psql prints no SQLSTATE at default verbosity). The door opened, the reader
  served the notes, and the **Rule 11 audit writer refused on privilege grounds**. Keystones
  noticed too: `R5·K-R5-1` cross-side denials, `have: 2 / want: 1`, and a redaction rendering the
  OTHER side's body. ⛔ Not a fixture artefact of T7's seed row — `150_referrals.sql` truncates
  and builds its own.
* `app.can_sign_meeting` — direction **`positive`**. `120_meetings.sql` test 22
  `cannot sign another attendee's row (HC036)` → `caught: no exception / wanted: HC036`: the
  identity guard **failed to fire**, the illegitimate signature advanced the meeting's state, and
  the LATER state guard raised — `esta reunião não está aguardando assinatura`, `sign_meeting`
  line 24, **errcode `HC033`** — aborting the plan (`planned 32 ran 22`). Three files noticed:
  `120_meetings.sql`, `251_authz_p0_isolation.sql` (`meeting_signatures_insert DENY 42501` →
  `caught: no exception`), and **`410` itself** (§ 3.5, § 8.1, § 8.6) — the manifest catching the
  mutation STRUCTURALLY, independent of behaviour.

#### ⭐⭐ The merge that emptied the table, and the parser that hid it

The prescribed fold-in-by-MERGE **gutted the baseline**: top-level table rows **353 → 73**,
**BLIND 36 → 0**, helper **exit 0** reporting *"the only legitimate drop"*. `ARM=census` caught it
independently — **23 unknown → 205**, zero overlap with the 23.

I reported it wrong **twice, in opposite directions**: first a false alarm from a bad grep, then a
"corrected" parser using `lstrip().startswith('|')` that counted the merge's **indented quoted
copies** as rows and produced the reassuring *"376 rows, 0 lost, 0 verdicts changed"* — which the
lead recorded. The crude `grep -cE '^\|'` (87 vs 367) was right the whole time and I explained it
away the moment a friendlier number appeared. Baseline restored byte-identical to HEAD (cksum
`1983823619` both sides) before anything was committed.

**L25 (b)** — the guard, proven three ways, exits bare: subset → **exit 2**,
`missing 303 row(s)`, `353 / 73`, crude `367 / 77`; baseline-as-generated → **0**,
`covers all 353 … 353 generated. No drop.`; synthetic superset → **0**, `… 376 generated. No drop.`
⚠ The predicate had to be **"missing baseline rows"**, not literal strict subset: the subset
carried 23 keys the baseline lacked, so a literal test would have PASSED it and gutted the file.
⚠ Scoped to `SELFTEST != 1` — it aborted 5 of the helper's own 18 merge scenarios, which exercise
the CARRY path legitimately.

**L25 (a)** — targeted insertion: top-level **353 → 376**, crude **367 → 390**, BLIND **36 → 36**,
lost **0**, `git diff --stat` = `23 insertions(+)`. Both counters move by exactly +23 and agree.

The deeper defect — a carried row is emitted as an indented quote, not a table row, so it stops
being machine-readable — is `FUP-AE5-STAFF-MERGE-CARRIES-ROWS-OUT-OF-THE-TABLE` (high). ⛔ "303
rows lost" is the wrong description and the follow-up corrects it: nothing was lost, 303 rows left
the TABLE, and the consequence is identical for every automated reader.

#### The four arms, each shown ABLE TO RED — exits bare, baseline / planted / rolled back

| arm | base | plant | back | what the plant printed |
| --- | --- | --- | --- | --- |
| FLOOR | 0 | **1** | 0 | `app.a_door_that_does_not_exist(uuid)` |
| WRAPPER (`FROMFINDINGS=1`) | 0 | **1** | 0 | `BLIND wrappers NOT in the allowlist` |
| HAT | 0 | **1** | 0 | `=== INVARIANT VIOLATED ===` |
| CENSUS | 0 | **1** | 0 | `CENSUS VIOLATED … app.can_roster_read(p_commission_id uuid, p_user_id uuid)` |

All three allowlists restored byte-identically (`git diff --stat` empty). **`ARM=census` GREEN
after the fold-in: exit 0, `=== INVARIANT HOLDS ===`.** Its sequence is the attribution: 23 unknown
→ 205 under the gutted merge → 23 after the restore → **0** after the honest fold-in.

#### ⭐⭐ L22's plant found a control that could not fail

REVERSE 3b compared `fn_body(...)` with `strip_sql_comments(fn_body(...))`. **`pg_temp.fn_body`
already strips `--` comments**, so those are the same string and the arm could not fire for any
input — shipped as the discrimination half of a ruling, and asserted as such in the caption and in
my report. The plant found it on its first run: `the designated corrector only` fired REVERSE 3 and
left 3b silent. Repaired with `pg_temp.fn_body_raw`; witness after:

```
PRECONDITION  in_raw_body=t  in_stripped_body=f
BASELINE      reverse_3b: (none)
PLANTED       reverse_3b: commission.responses.create -> public.start_correction_draft
                          declares an identity gate that appears ONLY in a comment
ROLLED BACK   reverse_3b: (none)   gate_kind=identity
                          gate_expression='auth.uid() is distinct from v_corrector'
```
`410` after the repair: **exit 0, 45/45**.

#### The set-valued arm — the port proven by run

```
--- PERIODIC RESET (before case 1) ---  reset #1 done; the baseline below is at most 1 case(s) old
--- PERIODIC RESET (before case 2) ---  reset #2 …
--- PERIODIC RESET (before case 3) ---  reset #3 …
RESET-POLICY: RESET_EVERY=1 — 3 reset(s) performed; each verdict carries at most 1 case(s) of drift.
=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ===        exit 0
```

#### SELFTEST ×2

```
SELFTEST=1 door-sweep-cases.sh         exit 0
  --- GROUP deriver:               scenarios 20 (pass 20 · fail 0 · skipped 0)
  --- GROUP merge helper:          scenarios 18 (pass 18 · fail 0 · skipped 0)
  --- GROUP audit startup capture: scenarios  8 (pass  8 · fail 0 · skipped 0)
  SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0
SELFTEST=1 p0-authz-door-audit.sh      exit 0   SELFTEST TOTAL: 33/33 ok, 0 failed
```
⚠ 5 of the merge-helper scenarios failed until the guard was scoped — recorded because a guard
that breaks its own harness's self-test is a regression, not a hardening.

`npm run lint` exit 0 (all gates). Loop: T8 iteration 4 of 5; each iteration closed a NEW cause.

### 2026-09-14 — T8 PARKED and VERIFIED by the lead (`34117443` … `eeb59466`); AC-8 ticked; stack to the tester for `425` round 2 (lead)

Verified, not relayed: six commits by path on `ae5-staff` — `34117443` the merge guard (aborts on
missing baseline rows), `4c6100a3` the fold-in (353 → 376, `23 insertions(+)`), `1f139a08` REVERSE
3b repaired + `409` control (a), `49c5adfe` the `RESET_EVERY` port + write-path snapshot row,
`36359cf3` two follow-ups, `eeb59466` the T8 record entry (167 lines); tree = the tester's `425`
addendum + run logs, nothing else; `npm run lint` **exit 0** at HEAD, consumed (`LINT_EXIT=0`). The
T8 entry quotes every witness the gate needs, read by the lead at its line: the `SCOPE:` line
(`4 file(s) — 4 committed (a02487bc..HEAD), 0 worktree, 0 untracked | filter: none | derivation:
catalog`), `RESET-POLICY: RESET_EVERY=1 — 3 reset(s) performed`, the three `--- GROUP` lines (20 ·
18 · 8, all pass) and `SELFTEST TOTAL: 33/33`, `GNU bash 5.2.37(1)-release`, the four plant rows, the
census `=== INVARIANT HOLDS ===`, `410` 45/45. Backend's own account names its three misses (the
gutted merge reported twice in opposite directions; 3b unsatisfiable; `can_capa_read` left neutralized
by the kill) — all three caught by the checks, all three already in this record above.

**Two lead observations on the T8 state, for the AC-10 gate record and QA:** (1) the merge guard is
scoped to `SELFTEST != 1` because it aborted 5 of the helper's 18 self-test scenarios, which
legitimately exercise the CARRY path — so the guard's discrimination rests on backend's one-off
proof (subset → exit 2 `missing 303 row(s)`; full-shaped and superset → exit 0), not on a standing
scenario; and the helper's self-test now proves a merge the real run refuses. Filed low as
`FUP-AE5-STAFF-MERGE-GUARD-IS-OUTSIDE-ITS-OWN-SELFTEST`. (2) No full `test:db` after T8's test-file
edits (`409`, `410` scoped-green only) — owed at AC-10's fresh-reset run, as backend states.

**AC-8 ticked** on this entry. **Stack handed to the tester** (backend idle by ListAgents, nothing
running): fresh reset + settle-check, `00_setup` + `425` round 2 to a new log (want 3.1 47 / 3.2 56;
§ 3.3/3.3b the P1 survivor), counts reported, the lead commits by path → AC-7; then T13's five specs
on a dev server, `e2e:prod` reserved for AC-10.

### 2026-09-14 — `425` round 2 GREEN on the post-T7 catalog, committed by the lead (`e2d1d3b8`); AC-7 ticked (lead)

Tester's run, verified by the lead from the log file, not the message: `425-run4-round2-post-t7.log`
holds `All tests successful. / Files=2, Tests=22 / Result: PASS` — `00_setup` (1) + `425` (21), the
file's `select plan(21)` (`:107`); no `not ok` line. ⚠ The log is the pg_prove SUMMARY (364 bytes):
the per-test lines the tester quoted (§ 3.1 "47 of 57 move" 47/47; § 3.2 "want is now 56 (57 minus
ONLY `app._audit_access_authorized`'s `meeting.viewed` leg)" 56/56; § 3.3 "21 observations (7 sites ×
3 phases), all GRANTED"; § 3.3b "exactly seven P1-survivor probes ran") come from its verbose run and
are NOT in the file — the summary is the gating witness, the tails are the tester's word; AC-10's
fresh-reset `test:db` re-takes the file with the rest. Reset `reset-run4-round2.log` exit 0, the T7
migration applied, settle-check 445/445 twice, profiles 45; `pg_stat_activity` 0 own sessions before
and after; `*_escalume` untouched; `pgtap` extension count 0 after the raw-capture read; `staff`
still 20 `role_permissions` rows.

**What the addendum is (the lead read the diff before committing, 220+/64−):** `plan(18) → plan(21)`;
`f425w` — arm-3 sites keyed on `424`'s `disjunct_absent` ids via `probe_table`/`probe_column`, the
vector-bound ids, never a second literal; the seven role-free-disjunct sites' ORIGINAL blind probe
kept as a SEPARATE measurement, `pg_temp.p1_survivor_signature` in `p1_before` / `p1_after` /
`p1_restored` phases — PO ruling P1's own witness (the accepted exception still GRANTS with the role's
grant deleted, § 3.3), never folded into § 3.1/3.2's counts; § 3.1 want re-derived **47** (57 − 9
sparse − the audit leg), § 3.2 want **56** (57 − the audit leg only), both live-queried, the earlier
46/49 derivation replaced with its reason stated in the file. **AC-7 ticked** on this entry: every
re-keyed site moves under the grant deletion except the ten attributed, and the P1 survivors are
measured, not inferred. Tester on T13 (five specs, dev server).

### 2026-09-14 — T13 run: 3/5 green (serial), 2 red on the SPEC's own false premise, not the app; L26 redesigns the two coordinates red-first (lead)

Tester's run (`playwright-t13-run1.log` 5 workers — all 5 red on login timeouts; `run2` `--workers=1`
— 3/5 green: `staff4.ccih` landing, both `multi@` form-fill tests incl. the keyboard-only one, AC-5's
keyboard requirement met). The two reds, traced by the tester with a direct GoTrue password grant
and a read of `src/lib/auth/actions.ts`, and CONFIRMED by the lead in the code: (1) `gap.pending`
(`email_confirmed_at IS NULL`, seeded that way, never a real signup) — GoTrue answers
`400 email_not_confirmed` regardless of `enable_confirmations = false` (that knob governs signup,
not an existing unconfirmed row); `signIn` maps any 400 to the generic `invalidCredentials` on
purpose (`:156–160`, non-disclosure), so the page never leaves `/login`. The spec's header (`:36`)
claimed the opposite as "confirmed live" — **a comment that was an assertion, and false**. (2)
`gap.deactivated` — GoTrue grants; `signIn`'s **BE-6 gate** (`:165`) signs out before any session
and shows the pt-BR notice (`:45`), by design, to avoid the redirect loop against the login-bounce
middleware; `/conta-inativa` is reachable only by a principal ACTIVE at login and deactivated
mid-session. Neither is a regression; no bug row — the premise was the spec's. The tester reported
before rewriting assertions, as the ownership rule requires.

**L26 (lead): option (a), red-first, this round.** (i) The `gap.deactivated` fresh-login test asserts
the DESIGNED behaviour — stays on `/login`, the BE-6 notice text, and NO session cookie afterwards —
and is renamed to say so. (ii) A NEW transition test proves the landing seam the coordinate was for:
log in as an ACTIVE staff persona this spec alone uses, deactivate it through the admin client the
existing specs already use for fixture state (never a UI shortcut, never `seed.sql`), navigate, expect
`/conta-inativa`; restore the row in `finally` so `e2e:prod`'s batches see the seed state. Red first:
show the assertion fails against the fresh-login construction before the transition passes. (iii)
`gap.pending` asserts refusal at login with the generic message and no session; the header comment
at `:36` is rewritten to say what GoTrue actually does, with the curl's `error_code` quoted — the
false "confirmed live" line is deleted, not softened. (iv) No bug rows; the false comment is this
entry. (v) The 5-worker login-timeout pass is an OBSERVATION for AC-10: `e2e:prod` is batched with
restarts; if it reproduces there it becomes a bug row then, not now. Tester owns `e2e/**` only.

### 2026-09-14 — T13 GREEN 6/6 under L26, committed by the lead (`c94fc639`); AC-10 step 1 handed to backend (lead)

L26 executed by the tester, verified by the lead from the tree and the log: only
`e2e/ae5-staff-landing.spec.ts` changed (122+/35−, 0 CR bytes); the red-first scratch spec
`e2e/_tmp-red-check.spec.ts` created and deleted within the round, absent from the tree;
`playwright-t13-final.log` line 20 `6 passed (17.5s)`; `npm run lint` exit 0 before the commit.
**Red-first quoted (the wrong construction):** `expect(page).toHaveURL … Expected pattern:
/\/conta-inativa(\/|$)/ Received string: "http://localhost:3000/login?redirect=%2F"` — BE-6 blocks the
fresh login exactly as ruled; the transition version then green. The four tests as they now read
(`:117/:132/:144/:156`): commission landing; unconfirmed refused (`email_not_confirmed` → generic
message, `pathname === '/login'`, no `sb-*-auth-token` cookie); deactivated refused at login (BE-6
notice, no session); **mid-session deactivation → `/conta-inativa`** on `gap.comember.ccih@test.local`
(active `staff` @ CCIH, grep-confirmed unused by every other spec), deactivated through the
service-role REST PATCH pattern `case-access.spec.ts` already uses, restored in `finally`. The header
comment's false "confirmed live" line DELETED; the curl and its `error_code` quoted in its place.
**Persona restore verified by a post-run read:** `gap.comember.ccih` `is_active = t`,
`gap.deactivated` `f` (seed-correct), `gap.pending` unchanged.

**Two observations HELD, not filed (a row only if `e2e:prod` reproduces them):** (1) the 5-worker
first pass — all 5 red on login timeouts, serial clean; (2) a 5/6 on the Farmácia form-fill after the
tester's own repeated runs against an un-reset DB left `multi@test.local` an `in_progress` response,
so the wizard RESUMED past the intro heading — self-inflicted, cleared by a fresh reset
(`reset-t13-final.log`), the E2E-leftovers trap CLAUDE.md § 9 names. **Stack to backend for AC-10
step 1** (fresh reset + settle-check; `npm run lint` / `typecheck`; FULL `test:db` — owed since T8's
test edits; the four arms re-quoted at HEAD; gate 15 budget 339/433/772 live; proof that no
migration landed after the sweep's HEAD so its `SCOPE:` line still covers HEAD); then the tester's
`e2e:prod` once.

### 2026-09-14 — AC-10 step 1: BUILD COMPLETE on a fresh reset, at HEAD `4ee17f7c`

Every exit read BARE, never through a pipe. Logs under the session scratchpad `ac10/`:
`reset.log` · `lint.log` · `typecheck.log` · `testdb.log` · `arm_census.log` · `arm_hat.log` ·
`arm_floor.log` · `arm_wrapper.log` · `cases.log`.

**Stack claim.** Working tree clean of modifications at start. **2** Supabase stacks on the host —
ours `supabase_db_azkbbhskturikxpgmafq` and `supabase_db_escalume`, **counted, never touched**.
Own non-idle sessions on our container: **0**, re-checked before every catalog read.

**1 · Fresh reset.** `supabase db reset --local` → **exit 0**, `Finished supabase db reset on
branch ae5-staff.` Settle-check, `information_schema.tables` twice: **171 then 171**. Post-reset
state verified rather than assumed:

| profiles | authoritative roles | 21st door present | `_case_caps` S5 | `staff` codes |
| --- | --- | --- | --- | --- |
| **45** | **2** | **1** | **2** (the `read_case_deliberation` bit) | **20** |

**2 · `npm run lint` exit 0 · `npm run typecheck` exit 0.**

**3 · FULL `npm run test:db` on that reset — owed since T8's edits to `409` / `410`:**
```
Files=275, Tests=9218, 314 wallclock secs
Result: PASS            TESTDB_EXIT=0        `grep -c '^not ok'` = 0
```
⭐ **275 files counted independently** (`ls supabase/tests/*.sql | wc -l` = 275), so the suite's own
figure is not the only witness. **9218** is the actual number: 9215 at T7's landing plus the 3 the
tester's `425` gained (`plan(18) → plan(21)`). Zero `not ok`, so the `Result: PASS` is not a
summary hiding unrun tests.

**4 · The four authz arms at HEAD — no plants (the plants are T8's, already recorded):**

| arm | exit | verdict line |
| --- | --- | --- |
| `census` | **0** | `=== INVARIANT HOLDS ===` |
| `hat` | **0** | `=== INVARIANT HOLDS ===` |
| `floor` | **0** | `=== INVARIANT HOLDS ===` |
| `FROMFINDINGS=1 wrapper` | **0** | `BLIND set size: 41` · `OK: every BLIND wrapper is on the allowlist.` · `=== INVARIANT HOLDS ===` |

**5 · Gate 15, the privilege budget, LIVE** — `320 § U4`'s own predicate (`prosecdef` ∧
`has_function_privilege('authenticated', …, 'EXECUTE')` over `app` + `public`), run against the
catalog rather than read off the test:
```
 app 339 | public 433 | total 772
```
matching the committed anchor `<!-- BUDGET-ANCHOR ceiling=772 app=339 public=433 total=772 -->`
(`docs/backend-state/authorization-and-audit.md:176`). **R-4 unmoved.**

**6 · The sweep's SCOPE still covers HEAD.**
`git diff --stat 0323935d..HEAD -- supabase/migrations supabase/seed.sql` → **EMPTY**, and
`--name-only | wc -l` → **0**, measured two ways because an empty `--stat` and an empty diff are
not the same evidence. The door surface has not moved since the sweep's base.

The deriver re-run at HEAD reproduces the T8 run exactly:
```
SCOPE: 4 file(s) — 4 committed (a02487bc..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
AC-10 : 75 names   sha256(sorted)=c2934944fc881ded
T8    : 75 names   sha256(sorted)=c2934944fc881ded
```
⭐ Compared as a **sorted checksum**, not as a count — a count is satisfied by a swap, which is the
same reasoning `410 § 8.5` and `409 § 1.1` are pinned by name for. Identical, so **no re-sweep
decision arises**; T8's door-sweep verdicts stand for this gate.

**Nothing was fixed in this step.** No app code, no migration, no `seed.sql` — the only write is
this record entry.

### 2026-09-14 — AC-10 step 1 VERIFIED (`af2c4566`); `e2e:prod` launched by the tester; AC-9 found NOT MET as drafted — the runbook's § 7 is pre-T7 by its own words (lead)

Backend's build-complete verified in the tree: one commit, the record only (66+), tree clean; the
entry quotes `Files=275, Tests=9218 / Result: PASS / not ok = 0` on a fresh reset (settle 171/171,
profiles 45, 2 authoritative roles, 21st door 1, `_case_caps` S5 2, `staff` codes 20), lint 0,
typecheck 0, the four arms `INVARIANT HOLDS` (wrapper `BLIND set size: 41`, all allow-listed), the
budget `app 339 | public 433 | total 772` live against the anchor, and the sweep's scope re-derived
at HEAD: 75 names, `sha256(sorted)=c2934944fc881ded` both runs, migrations/seed diff since
`0323935d` empty by `--stat` AND `--name-only` — so T8's door-sweep verdicts stand for this gate and
no re-sweep arises. Tester launched on `npm run e2e:prod` (step 2), the stack theirs.

**AC-9 measured, not assumed:** `authz-rollback-runbook.md` + `authz-rollback-template.sql` have
ZERO commits since their draft `4d961b5a`; § 7 names only `20261003007460` (T6); § 7.3 is headed
"TEMPLATE, NOT A WORKED SITE — the sites are not chosen yet"; § 7.3.1 holds only while T7 has not
landed. T7 landed. The criterion says "both revert shapes"; § 2b is owed. Backend tasked (docs
only, no stack until the tester parks): § 7.0's T7 bound (21/41/23/5/5), § 7.3 as a WORKED § 2b on
T7's own bodies, § 7.3.1 restated (T7 before T6; what `F1b` does now, measured — the wrapper's
caller count under L14), the template's next section, every catalog-dependent line `⏳ verify` until
the stack frees. AC-9 ticks on that commit, not on the draft. Lesson shape: a criterion ticked "if
unchanged" was going to be ticked BECAUSE unchanged — the runbook's stability was the defect.

### 2026-09-14 — AC-9 § 2b DRAFTED (uncommitted, 10 `⏳ verify` markers pending the stack); three of the lead's counts corrected; `F1b` found keyed to the wrong subject (lead)

Backend's draft (docs only, stack untouched, lint 0, gate 13 = 0): runbook 1126 → 1281, template
422 → 541. § 7's preamble corrected in place and says so; **§ 7.0b** T7's bound as a second table
with revert cells; **§ 7.3** two worked § 2b sites chosen for being least mechanical —
`meeting_cases_select` (the one hand policy, L16: T7 ADDED a conjunct to a predicate already
carrying a hard deny, so § 6's hazard appears in conjunct form: flattening DROPS A DENY; `NOT
app.is_case_respondent(...)` sits last, where a hand-edited `using (…)` gets truncated) and
`app._case_caps` S5 (both obvious reverts are wrong: the recorded whole body re-introduces the false
S8 comment; the one-line "revert" is L20's defect exactly; and `can_cases_deliberation_read` must
not return to its first T7 shape, that `or` being L24's widening — *the revert target is the text
that was correct, not the text that was there*); **§ 7.3.1** in the present tense; **template
SECTION G** (letter read off the file), guard keyed on the re-keyed surface, `G1b` refusing the
opposite ordering, `G3` a before/after deny-term count because a structural "policy exists" check
cannot see a flattened predicate.

**Three counts in the lead's brief corrected by counting the committed migration:** `create or
replace function` = **22**, not 21 — 20 row authorizers + L20's sibling + `app.can_reach_case_on_member_surface`,
a SITE not a row authorizer (the 21 doors stand; the table keeps them apart); re-emitted bodies =
**27** carrying `SET search_path TO ''` (`pg_get_functiondef` output is upper-case, a lower-case grep
undercounts — the lead's "23"); **24** left `419`'s frozen set (860 → 836), not "22" as the hub's
In-progress block says. ⚠ The hub carries "23 function sites, 22 frozen bodies converged" and a
Blockers line "860 → 837": to be re-derived on the catalog at the gate record and corrected there,
not carried.

⭐ **`F1b` is keyed to the wrong subject.** The T6 template's guard counts callers of the WRAPPER,
on the premise a re-key wires it; under L14 T7 wired `authz.has_permission` and the wrapper measured
0 / 0 callers at T8 — so `F1b` PASSES and lets the operator flip the role while 21 doors depend on
it. Not broken; keyed to a subject the increment never used, on the rollback path. Backend put the
interim query in prose; **the lead orders it as a gate:** `F1b` gains a second predicate — refuse
when the role's permission codes appear as literals at any app/public site (the re-keyed surface,
the same count `G`'s guard uses) — because a rule is a hint and a guard is the thing (CLAUDE.md § 8).
Verification of the 10 markers waits for the tester to park `e2e:prod` (batch 1 of the gate:
65 passed · 0 failed · 1 flaky · 1 skipped, 67/67 accounted — the flaky title to be read at the end).

### 2026-09-14 — `F1b` gated on the re-keyed surface; cross-checking the two copies found SECTION G's guards DID NOT PARSE (quotes eaten by a quoting layer) — repaired; a parse check ordered for every template section (lead)

Backend: `F1b` now carries two refusal predicates — the wrapper caller count (kept; right for an
increment that wires the wrapper) and `F1b(ii)`, the count of the role's permission codes as string
literals at any `app`/`public` site, byte-identical to `G`'s guard so the two sections cannot
disagree about whether a re-key has landed; the refusal text ends "do not substitute the wrapper
caller count for it: that is the check that passed on AE5 T7". **Found while making them
identical:** `G1a` and `G3a` read `position( || rp.permission_code ||  in p.prosrc) > 0` — the
`''''` literals STRIPPED by the Python triple-quoted string SECTION G was written through; both
guards were invalid SQL, and an operator would have got a parse error where a refusal belongs.
Repaired; all three sites byte-identical under `cat -A`; the template re-scanned for the signature,
nothing else. Template 422 → 579, runbook 1126 → 1281, lint 0, uncommitted, stack untouched.
Backend's own words: a quoting layer between it and the file silently ate content that looked fine
in the diff; a single copy would have shipped broken. The lead's addition: **no gate parses the
template's SQL** — it is a file a human copies under time pressure, and a guard that does not parse
was invisible to lint, to `test:db` and to every arm. Ordered for the verification pass: every
section of `authz-rollback-template.sql` (A–G) is fed to the catalog inside `begin; … rollback;`
so Postgres parses it, the exit and any error quoted; and a follow-up filed (backend, medium): the
template's SQL is parse-checked by no gate — closes when a gate parses each section on a fresh
reset and is shown to red on a stripped-quote plant. LESSONS candidate: *a template nobody executes
is a comment with SQL syntax.*
