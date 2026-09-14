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
- **R-4 — gate 15's ceiling and T7's new doors.** Opened 2026-09-14 at T6 as "`authenticated`
  EXECUTE on the two wrappers"; **REFRAMED the same day at the T7 plan review (B2):** policies are
  re-keyed onto layer-3 `app.can_<code>` DEFINER doors that call the wrapper inside their bodies, so
  the wrapper itself likely needs NO `authenticated` grant — what gate 15 must absorb is the N new
  layer-3 doors, the same shape AE4's re-key already passed through it. Backend is measuring N, the
  AE4 precedent (script, count, ceiling) and whether any site must call the wrapper from a policy
  directly. ⛔ PO: rule once that measurement is in the record — (a) raise gate 15's ceiling by N
  under AE4's precedent, or (b) hold it and name what T7 leaves un-re-keyed. If the direct-call
  count is zero, the original two-wrapper question is moot and is closed as such.
- **R-5 — ADR 0211 D2 review.** The D2 proof is in the record's T6 entry (2026-09-14): snapshot/assert
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
