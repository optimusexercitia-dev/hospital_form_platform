# ARM3-HAT-TERM-FIX — QA review

**Unit:** ARM3-HAT-TERM-FIX · **Branch:** `claude/distracted-kapitsa-0d82de` ·
**Tip:** `3d85c403` · **Base:** `main` @ `dd3629be` · **Date:** 2026-09-11 · **Reviewer:** qa

**Verdict: CHANGES REQUESTED**

One BLOCKING finding, and it is cheap now and expensive later: the migration's own header, ADR
0209 D2 and the seam's new slice all state that the door's held-role set is *"exactly the set
`public.custom_access_token_hook` can mint `active_role` from"* and that therefore *"the door can
never refuse a hat the token hook is able to issue"*. **Measured live against `pg_proc`, that is
false** — the hook has a third source the three homes do not mention. One of the three homes is the
live `prosrc`, so after merge the correction needs another forward migration (and a comment-only
migration is exactly what `.claude/rules/migrations-forward-only.md` and this unit's own follow-up
forbid). Everything else in the unit verified: the fix takes the PO's ratified shape, §7.4 was
retired by the route its own message named, the vector partition and flip census are arithmetically
sound, and no expectation was re-coded in place of a caller (LEARN-023 holds).

⛔ The BLOCKING finding is about a **sentence**, not about the door's behaviour. The door's
behaviour on the stale-hat window is *correct* (fail-closed, and consistent with `app.has_role` and
`app.is_admin_for`, which deny the same principal). Nothing here is a security hole.

---

## Findings

### BLOCKING

**B1 — The held-role set is NOT "exactly the set the token hook can mint from"; the claim is false
in three homes, one of them the live `prosrc`.**

Where the claim is made:
- `supabase/migrations/20261003007400_professional_profile_read_door_hat_term.sql` `sed -n '73,85p'`
  — *"'holds' is defined as exactly the set `public.custom_access_token_hook` can mint `active_role`
  from"* … *"so the door can never refuse a hat the token hook is able to issue (a live session
  denied for presenting a claim the system minted for it would be a lockout, not a tightening)"*.
- The same file `sed -n '162p'` — `-- HOLDS ANY LIVE ROLE? — the set custom_access_token_hook mints
  from (D2).` **This line is inside the function body and is now in `pg_proc.prosrc`.**
- `docs/decisions/0209-…-read-door.md` `sed -n '66,81p'` (D2) — *"the exact query
  `public.custom_access_token_hook` uses to derive `active_role`"*.
- `docs/backend-state/authorization-and-audit.md` `sed -n '1278p'` — *"exactly the set … So the door
  can never refuse a hat the system is able to issue."*

What I measured (live catalog, read-only):

```
select prosrc from pg_proc … where nspname='public' and proname='custom_access_token_hook';
```

The hook has **two** branches, not one. The quoted `select 'platform_admin' … union all select
distinct role from public.memberships …` query is only the **implicit** branch, reached when there
is no selection row. The **first** branch is:

```
  if v_session_id is not null then
    select role::text into v_selected_role
    from app.active_role_selections
    where session_id = v_session_id;
  end if;
  if v_selected_role is not null then
    claims := jsonb_set(claims, '{active_role}', to_jsonb(v_selected_role));
```

— *"An explicit selection for THIS session wins."* The only writer of `app.active_role_selections`
is `public.assume_role` (measured: `select … from pg_proc where prosrc ilike '%active_role_selections%'`
returns exactly `public.assume_role` plus the hook). `assume_role` validates holding **at selection
time only**, then `insert … on conflict (session_id) do update`. Nothing revalidates or removes the
row afterwards: `pg_trigger` on `memberships` carries only `trg_audit_memberships`, and the sole FK
on `app.active_role_selections` is `user_id → profiles` (`ON DELETE CASCADE`). There is no
`session_id` FK and no expiry column.

⇒ when a membership is revoked or its `expires_at` passes mid-session, the hook **keeps minting**
that `active_role` on every token refresh, while the door's held-set (`memberships` live ∪
`is_admin`) no longer contains it. The door then refuses a hat the token hook is able to issue —
precisely the case the comment says cannot happen.

**Why this blocks rather than being a MINOR.** The unit's second duty is discharging a follow-up
filed because a **false clause in this exact function body** could not be corrected without a
migration. Landing a new false clause in the same body, in the same migration, recreates that trap:
after merge it costs a forward migration to fix, and a comment-only migration is refused. Before
merge it costs one edit and a `supabase db reset`.

**What I am asking for** (any of these discharges B1; the choice is the backend's/PO's):
1. Narrow the sentence in all three homes to what is true — e.g. *"the set the hook derives
   `active_role` from **implicitly**; a session holding a stale `app.active_role_selections` row can
   present a hat this set no longer contains, and is denied — deliberately, since `app.has_role` and
   `app.is_admin_for` deny that principal too"* — and drop the absolute *"can never refuse"*; **and**
2. file a follow-up for the stale-selection window itself (no mechanism invalidates a selection when
   its membership is revoked), since it is now a coordinate the door reads and nothing tests.

⛔ Do **not** "fix" this by adding an `active_role_selections` read to the door: that would make the
door accept a hat the principal no longer holds, which is the defect this unit exists to close.

---

### MAJOR

**M1 — A re-emitted SECURITY DEFINER function kept its non-empty `search_path`, against ADR 0208
D4's stated forward convention, with no disclosure anywhere in the unit.**

`supabase/migrations/20261003007400_…sql` `sed -n '123p'` →
`set search_path to 'app', 'public', 'pg_catalog'`. Live catalog agrees:
`proconfig = {"search_path=app, public, pg_catalog"}`, `prosecdef = t`.

ADR 0208 — which landed on `main` at **exactly the commit this branch rebased onto**
(`dd3629be`; `docs/decisions/INDEX.md:233`) — states at
`docs/decisions/0208-…-forward-convention.md` `sed -n '174,184p'`: *"SET search_path = '' with
schema-qualified object references is the sole forward convention for **new or touched** SECURITY
DEFINER functions"*, and at line 233 *"it is diff-scoped in effect: only a new or **re-emitted**
function can enter"*. This migration re-emits a SECURITY DEFINER function and does not enter.

Nothing detects it: `grep -n "0208\|convention\|empty" supabase/tests/414_definer_search_path_resolves.sql`
shows 414 asserts *resolvability*, not the empty-path convention; `grep -n "search_path\|0208"` over
the ADR, the record and the migration returns **no hit in the ADR and no hit in the migration
header** — the divergence is silent in all three.

I am **not** asking for the path to be changed in this unit: `413` pins this door's `proconfig`, the
body would need `pg_catalog.now()` added, and 0208 D6 prefers a narrow `ALTER FUNCTION` migration
over a re-emit. I am asking for a **declared disposition** — one sentence in the migration header or
ADR 0209 saying 0208 D4 was considered and why the path is held, plus a follow-up or a PO line if
the convergence is owed. As it stands the record reads as if 0208 was never consulted (the record's
only mention of 0208, `docs/progress/arm3-hat-term-fix.md:389`, is about the seam hand-merge).

---

### MINOR

**m1 — The record does not disclose that `8a9eeb39` landed with gate 13 RED.**
`git show --stat 8a9eeb39` truncated `docs/features/arm3-hat-term-fix.md` mid-acceptance-criterion
(the `## Current state` heading and the tail of the Homes bullet were destroyed by a replace anchored
on a phrase rather than the heading); `3d85c403` restored it. The only place this is written down is
`3d85c403`'s commit subject. `docs/progress/arm3-hat-term-fix.md` ends at the rebase entry
(`sed -n '392,436p'`), whose last line is *"Not yet run at this tip: `npm run e2e:prod` … and the QA
review"* — no entry covers the truncation, the red gate, or the repair. CLAUDE.md §7: a witness goes
to the record. Add a short entry before the Record step.

**m2 — No assertion covers a role-HOLDING caller asking about a THIRD PARTY under a non-held hat.**
The migration declares (`sed -n '146,148p'`) *"every third-party question is byte-unchanged"*, and
the seam repeats it. The natural mutation — dropping the `p_uid is not distinct from (select
auth.uid())` conjunct while the held-set stays keyed on `p_uid` — **is** covered: I counted 18
`grant_keyed` cells at `other_role`/`self_check=false` with a holder persona and
`expected_legacy_granted = true` (10 `arm3:masking` + 8 `arm3:divergent-approved:cross-org`), all of
which would flip, plus 403 §5.2 (*"every WRONG-HAT THIRD-PARTY cell is GRANTED"*, line 685).

What is **not** covered is the caller-keyed variant, because no fixture ever puts a role-holder in
the caller seat for a third-party question: `pg_temp.cell_answers` seats `f.nobody` (the role-less
persona) for every `p_self = false` cell (`403` `sed -n '484,488p'`), and 409 §4.15's caller `st`
wears a hat it holds. So a body that asked *"does the CALLER's hat match one of the CALLER's roles"*
for every question would over-deny in production and pass this suite. Not a defect in the delivered
body — it is correctly self-check-scoped — but the declared invariant is asserted at a coordinate no
suite constructs. Worth one line in the record's bound statement, or a cell whose third-party caller
is a holder.

**m3 — Hub frontmatter `adrs:` omits `0209`.** `docs/features/arm3-hat-term-fix.md:12` reads
`adrs: ["0175", "0176", "0200", "0201"]`; the unit authored 0209. `AE5-MATRIX-ARM3-CELLS`'s hub
carries an inline note that 0201 was *"added at Batch 9's Record step"*, so this is a Record-step
item by precedent (and `BACKEND-STATE-SERVICE-ROLE-SEAM`'s hub omits its own 0206, so the convention
is not uniform). Raised so the Record step does not skip it. `npm run features:index --check` is
green either way — the gate does not see it.

---

### NOTE

**n1 — A qualifier was dropped from the seam's Current-state bullet.**
`docs/backend-state/authorization-and-audit.md` line 51: *"role-free at its S3/S4 case-grant sources
**only**, so it survives an absent hat"* → *"role-free at its S3/S4 case-grant sources"*. Dropping
*"so it survives an absent hat"* is the point of the change and is correct; dropping *"only"* is
collateral. The meaning survives (the phrase still names S3/S4), but this is the
compression-selects-against-qualifiers shape. Restore *"only"* if the block has headroom — gate 16
reports this block at **97 lines, 3 left** of the 100-line ratchet, so it may not.

**n2 — The hub's own §7.4 acceptance bullet is self-contradictory; read charitably it is met.**
`docs/features/arm3-hat-term-fix.md` `sed -n '41,45p'` requires the carve-out *"dropped from
§4.1/§4.1b"* and, two lines later, that *"§7.5, §7.3b and **§4.1b** stay green **unchanged**"*.
§4.1b's predicate **was** changed (the `and arm3_divergence <> '…'` clause removed, as instructed)
and its message extended. §7.5 and §7.3b are byte-unchanged — verified: `git diff dd3629be..3d85c403
-- supabase/tests/403_…sql | grep -E "^[-+].*'(7\.5|7\.3b|5\.2)"` returns nothing. Judged met.

**n3 — The third comment correction is declared but not marked "PO to ratify"; I agree it needs no
ratification.** *"the broad `can_read_case`"* → the narrow committee-plane variant
(`sed -n '215,227p'`). It corrects a false clause about what the body calls (confirmed: the body
calls `app.can_read_case_committee`, line 244), is declared as an addition outside the follow-up's
scope in the migration header (`sed -n '65,70p'`), the record and the seam, and changes no
behaviour. Recorded so the PO sees it was checked rather than missed.

**n4 — 18 `arm3:blocked:principal-state` cells are now doubly denied and keep their old label.**
Measured from `authz_differential_cells.psql`: at `grant_keyed`, the `blocked:principal-state`
partition includes 6 cells per holder persona at `other_role`/`self_check=true` (suspended or
deactivated). The door term now denies those too, but the label still attributes the deny to
`_case_caps` STEP 2. No oracle error — both rulings expect DENY — but those cells cannot discriminate
the hat term, so the 18 `pre-empted` cells carry the whole discrimination load. Consistent with the
generator's documented branch ordering; recorded, not asked to change.

**n5 — The guard is skipped entirely when `auth.uid()` is NULL.** A caller passing `p_uid`
explicitly with no JWT claims (service role, or a pgTAP harness that did not call `claims_for`) has
`p_uid is not distinct from (select auth.uid())` = false, so the hat term never fires. This is
byte-consistent with `app.has_role`'s and `app.is_admin_for`'s own convention (both read
`p_user_id is distinct from auth.uid() or …`, which is *true* when `auth.uid()` is NULL — same
bypass). Measured from the live `prosrc` of all three. Not a finding; recorded because it is the
first thing a reader will ask about the NULL analysis.

---

## What I measured myself (not taken from the record)

1. **Live body == migration body, byte-for-byte.** `prosrc` from `pg_proc` diffed against
   `sed -n '124,247p'` of the migration minus its `$function$` delimiters → identical apart from the
   leading/trailing newline `prosrc` always carries. The review below is therefore about the live
   door, not about migration text (ADR 0078).
2. **Signature / `prosecdef` / ACL / `proconfig`.**
   `app.can_read_professional_profile(uuid,uuid)` · `prosecdef = t` · `provolatile = s` ·
   `proconfig = {"search_path=app, public, pg_catalog"}` · EXECUTE grantees
   `authenticated,postgres,service_role`. Matches the migration's own AFTER-assertion block
   (`sed -n '254,299p'`) and 413's pin.
3. **The PO constraint, against the live body.** No org term anywhere in the new guard
   (`sed -n '160,184p'`); arm 3's `return exists (…)` SQL (`sed -n '237,245p'`) is unchanged — no
   role lookup, no org lookup. The guard is *above* arm 1, not inside arm 3. ✅
4. **NULL handling.** `p_uid is null` → early `false` (line 128). `app.active_role()` returns NULL
   when the claim is absent (live `prosrc`: a bare `->> 'active_role'` claim read).
   `public.memberships.role` is **NOT NULL** (`pg_attribute`), so
   `m.role is not distinct from app.active_role()` is false for every row at a NULL hat, and the
   `is_admin` disjunct's `app.active_role() is not distinct from 'platform_admin'` is false too ⇒
   `not exists` true ⇒ deny. D4 holds, and it holds for the reason stated (`is not distinct from`,
   not `=`). ✅
5. **`is_admin` principal with no matching membership.** The second `not exists` carries the
   `profiles.is_admin and active_role() is not distinct from 'platform_admin'` disjunct, so a
   platform_admin wearing `platform_admin` passes with zero memberships, and wearing anything else
   is denied unless a live membership carries that role. Matches the hook's implicit branch. ✅
6. **`app.has_role` liveness predicate byte-identity.** Live `prosrc`:
   `(m.expires_at is null or m.expires_at > now())` — identical to the guard's. ✅
7. **The follow-up's `Closes when` wording is in the live `prosrc`.** `sed -n '229,236p'`: *"arm 3's
   `grant_keyed` cells are ORACLED by 403 §7.3/§7.3b with a PO value per class; the hat-substitution
   class was a filed bug pinned by §7.4"*, followed by an explicit *"§7.4 IS RETIRED BY THIS
   MIGRATION"*. ⭐ The successor is named by **description**, not by a new section number — so the
   correction does not immediately re-create the stale-citation defect it discharges. ✅
8. **§7.4 retired by deletion, never by editing the count.** `git diff` on `403` removes the whole
   `select is(… '10 cells, legacy granted on 10, …')` assertion and the `and arm3_divergence <> …`
   carve-out from **both** §4.1 and §4.1b; the string *"granted on 0"* appears nowhere
   (`grep`). ✅
9. **The vector partition, recomputed from the committed file** (parsed
   `authz_differential_cells.psql` directly): `org.professionals.read` = 864 cells, `grant_keyed` =
   216, partition `blocked=108/DENY · cross-org=24/GRANT · not-a-holder=36/GRANT · masking=30/GRANT
   · pre-empted=18/DENY` → **sums to 216**, and matches §7.3's expected string character for
   character. Flip census = **84** over the whole 1728-cell vector, matching §4.1/§4.1b's new text.
   ✅
10. **The 18 pre-empted cells are exactly the door's predicate.** All 18 are `other_role` ∧
    `self_check = true` ∧ a holder persona ∧ `expected_legacy_granted = false`, split
    `deny-class:wrong_active_context:self` = 10 + `deny-class:cross_org` = **8** — the 10+8 the ADR
    D5 and the seam describe, at the exact coordinates D5 names (`subject_holder` and
    `other_commission_holder` at `foreign_org_commission`, `cross_org_actor` at `own_commission` and
    `sibling_commission`, each at `active` and `pending`). ✅
11. **Internal consistency of the vector against the new door.** Zero cells anywhere in the
    `org.professionals.read` population expect a legacy GRANT at `self_check ∧ other_role ∧ holder
    persona` — so §4.1b (which now covers **every** cell) cannot be green by accident on the
    tightened coordinate. The 24 surviving cross-org cells are 8 `matching`/self + 8
    `matching`/third-party + 8 `other_role`/third-party — none of them a wrong-hat self-check. ✅
12. **Mutant D's 8-vs-18 explanation is sound, and I re-derived it.** Reverting branch (5b) returns
    the 10 ex-defect cells to `arm3:divergent-defective:hat-unenforceable`, which is **not** in the
    `expected_legacy` GRANT list — so their expected value stays `false`, the live door denies, and
    §4.1b has nothing to disagree about. Only the 8 re-ruled cross-org cells regain a GRANT
    expectation. §7.3's partition string catches the other 10. The record's correction of its own
    plan's prediction (`docs/progress/arm3-hat-term-fix.md` `sed -n '90,98p'`) is right, and it is
    recorded as a correction rather than the measurement being bent. ✅
13. **§7.4b's three lines, checked against the door's predicate.** Line 1 (holder, `quality_reviewer`,
    self) → guard fires → `door=false`; line 2 (`unprivileged` = role-less, same hat, same reach,
    same scope) → first `exists` false → guard exempt → `door=true`; line 3 (holder, hat built with
    `set_config` minus the `active_role` key) → `not exists` true → `door=false`. The GRANT half is
    **genuinely discriminating**: the record's mutant C′ (`sed -n '86p'`) flips it to `door=false`
    and reds §4.1b's 36 role-less cells, and the account-state reset inside
    `pg_temp.arm3_probe_at_hat` is what stops line 2 being satisfied by a deactivation left behind by
    the sweep's last cell. ✅
14. **The probe is a separate function, not a default argument.** `pg_temp.arm3_probe_at_hat` is new;
    §7.3b's and §7.5's `pg_temp.arm3_probe(…)` call sites are byte-unchanged, so neither guard can be
    said to have moved with the fix it constrains. ✅
15. **LEARN-023 across all four suites.** `409`: plan `75 → 77`, **two assertions added** (§4.13b
    discrimination half, §4.14a head-on layer probe); §4.14 keeps its predicate and only its caption
    is re-described — no expectation re-coded. `252`: the **caller** changed
    (`claims_for(foreign_uid, false)` → `…, 'staff'`), expectation untouched, and the comment records
    the mutation that proves the hatless form was answering by the hat term rather than by the
    isolation predicate. `413`: comment only, plan unmoved, and it argues from the **live policy
    shape** (`CASE WHEN … THEN true ELSE app.can_read_professional_profile(…) END`) plus a mutation,
    not from reading the CASE. `403`: plan 27 unmoved, 1 assertion out and 1 in, and the swap is
    stated in the header so an unmoved total is not read as a dropped test. ✅
16. **Generator self-test and sync, run here.**
    `python scripts/gen-authz-differential-cells.py --self-test` → 22 fixtures all `caught`, correct
    arm attributed in every case, plus `clean on the real spec (discrimination control)`, rc **0**.
    `--check` → `in sync (1728 cells, 10272 skipped, sha ac475f3d65d3)`, rc **0**.
17. **arm10(b)'s synthesised fixture is a detector proven able to fail.** `_synth_defect` re-labels
    the first cell into the `arm3:divergent-defective:` family and sets `expected_legacy = True`;
    since that cell's `expected_granted` is already `True`, arm10(**e**) (the unattributed-flip arm)
    cannot fire, so the `caught` verdict is arm10(b)'s alone — confirmed by the run, which prints
    `[fired: arm10]` and the `arm10: 1 cell(s) carrying a 'arm3:divergent-defective:' label …`
    message. The discrimination half is the real-spec run at the end. The family-prefix re-key is
    the right response to "the detector's subject is now empty" — it keeps the arm live for the next
    filed defect instead of deleting it on the day the last one was fixed. ✅
18. **Doc-side gates, run here at the tip** (no DB writes): `lint:backend-state` rc 0
    (*"authorization-and-audit.md (97, 3 left)"*), `lint:registers` rc 0 (26 hubs, index in sync),
    `lint:progress` rc 0, `lint:adr-index` rc 0 (*"205 ADRs indexed, next free 0210"*), `lint:rules`
    rc 0, `lint:mojibake` rc 0, `lint:vacuous` rc 0 (277 spec files, 0 findings), `lint:set-local`
    rc 0. ✅
19. **ADR hygiene.** `0209` header carries `**Status:** Accepted (2026-09-11 …)`, `**Area:**`,
    `**Related:**` and `**Amends:** [0201]` with the ADR number in the label; `0201` now carries the
    generated back-pointer block (`docs/decisions/0201-…md` lines 3–12); `docs/decisions/INDEX.md`
    rows **0207, 0208 and 0209 are all present** (lines 232–234) with 0201's row showing
    `⚠ amended by 0209`. The renumber 0207 → 0209 after `main` landed its own 0207 is recorded in
    the record (`sed -n '363,391p'`). ✅
20. **Seam shape.** The new slice (`## The ACT hat becomes a door-level term …`, line 1270 ff.) is
    dated in its heading as slices are; the two **Current-state** edits (lines 51 and 87) are
    axis-free and carry no dates, and the old open-edge bullet was **replaced**, not appended to.
    The superseded marker on the `AE5-MATRIX-ARM3-CELLS` slice (line 1216) names the successor
    section. Each new Current-state clause traces to a sentence in the slice; the one drift is n1. ✅
21. **Scope discipline.** `git diff --stat dd3629be..3d85c403` = 19 files. Every one is a duty, a
    lead-ruled follow-on (three blinded pins, two narratives, the ADR, the renumber), or the
    mandatory homes/indexes. **No `src/` file, no schema, no policy, no grant.** The only item the PO
    must rule on is D5's 8 cells, and it is marked **PO to ratify** in the ADR header, the ADR body,
    the migration header, `403` §7.3's message, the vector header, the seam's Current state and the
    hub. ✅

---

## Could not verify (⛔ a work item, never an implied pass)

1. **`npm run test:db`, `npm run lint`, `npm run typecheck`, the four authz arms, the deriver
   self-test and the diff-scoped door sweep.** Not re-run by me — the spawn prompt forbids touching
   the local stack (`npm run e2e:prod` owns it). I relied on the record's bare readings at
   `9057829a` (`Files=267, Tests=9025, PASS`; `SCOPE: 1 file(s) — 1 committed (dd3629be..HEAD) …
   case list: can_read_professional_profile`; both sweep arms `CLEAN`). I **did** confirm that the
   two commits after the gate run (`8a9eeb39`, `3d85c403`) touch only
   `docs/features/arm3-hat-term-fix.md` and `docs/progress/arm3-hat-term-fix.md`, so no code, test,
   vector or migration file changed after the gate.
2. **`npm run e2e:prod`.** In flight at review time; no result exists. The hub's Gate criterion is
   therefore **not yet satisfiable**, and this review does not certify it.
3. **Mutants A, C′ and D.** Not re-run. I verified mutant D's arithmetic against the committed
   vector (item 12) and mutant C′'s claim structurally (items 11, 13), but the red/green readings
   themselves are the record's, not mine.
4. **410 §8.5 (no new permission-code literal).** Not measured directly; the only permission-code
   literal in the body, `'org.professionals.read'`, sits in the preserved arm-2 block and the
   migration's BEFORE-assertion requires `authz.has_permission(` to be present already. Inferred
   from `test:db` rc 0 in the record.
5. **The pre-migration `proconfig` and ACL.** I read only the post-migration catalog. "Unchanged" is
   carried by the migration's own AFTER-assertion block (which raises on an ACL grantee-set move and
   on `prosecdef` going false) and by 413's `proconfig` pin passing inside `test:db`.
6. **Whether `assume_role`'s selection row is reachable in the E2E fixture.** B1 is argued from the
   catalog (no trigger, no FK, no expiry) and from `assume_role`'s body, not from an end-to-end
   reproduction. The *mechanism* is measured; the *frequency* is not.
7. **Whether the follow-up's two-home archive and the bug's status cell are correct.** Both are
   still `open` (`docs/bugs/BUGS.md:206`, `docs/followups/follow-ups-open.md:1944`) — correct, since
   they are Record-step items. I confirmed `lint:registers` is green with them open and that the
   archive register's `Closes when` ratchet (`archiveMissingClosesWhen=121/121`) is unmoved, so the
   archive shape is ready; I did not simulate the move.

---

## Acceptance criteria

| # | Criterion (hub) | Verdict | Witness |
|---|---|---|---|
| 1 | The fix takes the PO's ratified shape — neither an org check nor a role-keyed hat check inside arm 3; the hat term stated as a sentence and evaluated before the arms; names what it does for a holder whose hat is **absent** | ✅ **met** | Live `prosrc` (item 3): arm 3's SQL byte-unchanged, no org term anywhere, guard above arm 1. D4 states the absent-hat value and it is pinned by §7.4b line 3 (items 4, 13). Mutant C′ measured that D3's exemption is load-bearing |
| 2 | §7.4 moves red→green **by deletion**, carve-out dropped from §4.1/§4.1b, generator label + `expected_legacy_granted` follow, §7.3's partition **re-derived**; §7.5, §7.3b, §4.1b stay green unchanged | ✅ **met** (see n2 on the bullet's own wording) | Item 8 (deletion, no "granted on 0"), items 9–10 (partition recomputed from the committed vector, matches character for character), §7.5/§7.3b/§5.2 byte-unchanged in the diff |
| 3 | Proven by mutation, both polarities; readings quoted bare; green-on-first-run treated as a finding | ✅ **met** (readings are the record's, not mine — see Could-not-verify 3) | Record's six-row mutation table: row 2 (fix held aside) reds §4.1/§4.1b on 18 and §7.4b on three `door=true`; rows 4/5/6 cover org-check, D3-dropped and label-reverted. Row 2 explicitly refuses a green first run |
| 4 | The comment corrected in the same body, read back from `pg_proc`, matching the follow-up's `Closes when` wording | ✅ **met** | Item 7. ⭐ Also names §7.4's retirement and its successor by description rather than by a new number |
| 5 | Signature unchanged (`(p_profile_id uuid, p_uid uuid)`, `prosecdef` true, same ACLs); `gen:types` no diff | ✅ **met** for signature/`prosecdef`/ACL (item 2); `gen:types` taken from the record | Catalog read; the migration's own AFTER block asserts the grantee **set**, not the ACL string — the right property |
| 6 | Gate: lint 0/0 · typecheck · `test:db` on a fresh reset · four authz arms · deriver SELFTEST · set-valued home · diff-scoped door sweep both arms with the `SCOPE:` line quoted · `e2e:prod` once | ⚠ **not verifiable at this tip** | Every reading except `e2e:prod` is in the record at `9057829a` with the `SCOPE:` line quoted verbatim and exits read bare; I confirmed no code file moved after that commit. **`e2e:prod` has no result yet** (Could-not-verify 2) |
| 7 | Homes: seam slice appended **and** `## Current state` replaced with the open edge rewritten as fixed; an ADR if owed; bug + follow-up closed at Record | ✅ **met** for the seam and the ADR; bug/follow-up correctly still open | Item 20 (both seam layers, gate 16 rc 0 at 97/100 lines), item 19 (ADR + back-pointer + INDEX rows), Could-not-verify 7. Two drifts: n1 (dropped qualifier) and m3 (hub `adrs:` omits 0209) |

---

## Summary for the lead

Ship-blocking work is **one text correction in the migration body plus its two doc echoes** (B1),
and **one declared disposition** for ADR 0208 D4 (M1). Both are edits to files this unit already
owns; neither touches the door's behaviour, the vector, or any assertion. After B1 and M1 the unit
is, on everything I could measure, correct — and unusually well instrumented: the §7.4 → §7.4b swap
is a strictly stronger pin, the arm10(b) family re-key with a synthesised member is the right answer
to a detector whose subject was just fixed, and the three blinded pins were re-aimed by changing
**callers**, never expectations.

The PO still owes a ruling on **ADR 0209 D5** (the 8 re-ruled cross-org `other_role` self cells),
which is correctly marked *PO to ratify* in seven places.
