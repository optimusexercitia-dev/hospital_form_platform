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
