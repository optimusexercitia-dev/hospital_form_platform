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

**Unchanged and still waiting**: P1 + P2 apply together only on the PO's word (combined flip count
must read exactly **1218** as an OUTPUT); the T6 files stay in `t6-wip/`; `424` is the tester's.
