# QA review — ACT Stage 4 (ADR 0106 D14 + ADR 0107)

- **Branch:** `feat/act-as-stage-4` (off `main` `5204f1e`, 12 commits)
- **Date:** 2026-08-10 · **Reviewer:** `qa`
- **Scope:** plan §Stage 4 (`docs/plans/act-as-role-assumption.md:222`) + the r1 MINORs
  carried from `docs/reviews/act-as-stage-3-review.md`
- **Verdict: ✅ APPROVED** — 0 BLOCKER, 0 MAJOR, 6 MINOR, 3 INFO. **Nothing blocks the stage.**

Every claim below that says "verified" was re-derived from the live catalog or executed,
not read from a migration file, a comment, or the S4 summary I was handed.

---

## 1. What I verified independently (the load-bearing claims)

### V1 — the D14 classification is complete and correct. Re-derived from `pg_proc`.

I did not audit the table; I audited `app._case_caps(uuid,uuid)` from
`pg_get_functiondef` and then compared.

- **Bit-contributing sites: 11, counted mechanically** (`regexp_matches(prosrc,
  'v_caps *:= *v_caps','g')`), not by eye. They partition exactly as
  S6(1) + S1(1) + S2(1) + S5(1) + S7(1) + S3-loop(5) + S4(1) = 11. **No arm is missing
  from the table** — this was my primary concern and it is closed by construction, since
  the count is derived from the property (a `v_caps` assignment) rather than from the
  list someone wrote down.
- **Every `app.*` callee enumerated from the catalog** and classified:
  `is_staff_admin_of_for` · `is_tenancy_admin_of_for` · `is_member_of_for` ·
  `is_quality_reviewer_of_for` · `is_pqs_operator_of_for` → all reach `app.has_role` /
  `app.has_role_any`, both of which carry the caller-only condition
  `(p_user_id is distinct from auth.uid() or … is not distinct from app.active_role())`.
  **role-derived, confirmed.**
- **The two STEP-4 denies are pure relationship reads** — I checked for hidden role
  dependence, which would have made them hybrids: `is_case_respondent` joins
  `case_participants → case_participant_roles(key='respondent_doctor') →
  professional_profiles.user_id`; `is_recused_from_case` reads `case_recusals`. Neither
  touches `memberships` or any role helper. **relationship-derived, confirmed.**
- `is_active` / `hospital_of_commission` / `feature_enabled` / `_cap_bit` contribute no
  bits — the "preconditions, not arms" exclusion is right.
- **The audit is complete for the whole door, not just the resolver.** I checked the
  layers above `_case_caps`: `has_case_capability` is a pure bitmask test,
  `case_capabilities` a pure projection, and `can_read_case` / `can_read_case_patient` /
  `can_write_case_content` / `can_reach_case_on_member_surface` are one-line delegations.
  **No arm is added above the resolver**, so classifying `_case_caps` classifies the door.

The bit values in `docs/backend-state.md` §ACT (S1 `1|2|4|8|32|64`, S2 `64`, S5 `2`,
S6 `4|2`, S7 `4|1`) match the live body exactly.

### V2 — keystone `319` is not vacuous. I proved both mutation twins can fail.

`319` passes standalone (`supabase test db 00_setup.sql 319_…` → 17/17). Passing was
never the question; sensitivity was. `BUG-VACUOUS-ASSERT-1` is open in this program for
exactly this shape, so I ran the neutralization both ways:

| Neutralization | Result |
| --- | --- |
| A5's replacement body given the caller-only condition **back** (mutation made a no-op) | **A5 RED** — `have: 64, want: 111` |
| A7's replacement body given the caller-only condition **back** | **A7 RED** — `have: 64, want: 66` |

Both twins are therefore load-bearing: they fail when the thing they simulate stops
being simulated. A5 additionally measures the exact value A2 would read if production
`has_role` lost its condition, so A2 is the real detector and A5 is its proof.

The other controls hold up on inspection: **A4** (bit 16 clear under both hats
*pre-grant*) is a genuine negative control for **A11/A12**, because the fixture insert
demonstrably flips the bit — the "identical" claim cannot be satisfied by `0 == 0`.
**A9/A10** (127/94) are real non-zero anchors for the recusal zeros **A15–A17**. And
§1's note that hat-switch and mask-read must not share a statement (AND-operand
evaluation order is not guaranteed) is a correct and non-obvious precaution.

**No assertion here is proven by a permissive sibling** — every one reads
`app._case_caps`' *return value*, so no policy can OR itself into the result
(authz-handoff §7.1 shape 6). That is the right structural choice.

### V3 — the sweep detects, and its contract fails in both directions. Executed.

- Reproduced: `self-test 4/4 OK`, `anchors OK`, `3 findings ≡ allowlist`, ~4 s.
- **Ghost + new-finding directions proven red**, not assumed: I ran the sweep against a
  mutated allowlist copy in scratchpad (dropped the policy line, added
  `fn: public.no_such_function()`). It reported the dropped line as a NEW GATE and the
  fake line as a GHOST, and **exited 1**. `RC` propagation through
  `p0-authz-invariant.sh:309` is correct.
- **Population boundaries checked against the catalog, not the header:** 0 procedures
  (`prokind <> 'f'`) read `memberships`; 0 views/matviews wrap it; the only functions
  outside `app`/`public` that reference it are `test_helpers.*` fixtures. The
  `app`+`public`, `prokind='f'` population is complete **today**.
- **The declared blind spots are honestly scoped.** I tested each rather than accepting
  them:
  - *chunk adjacency* — the header claims no chunk has one covered **and** one uncovered
    read. I found four chunks carrying two `memberships` tokens
    (`capa_kpis`, `pqs_inbox`, `list_my_nsp_hospitals`, `open_capa_plan`) and read all
    four: **every read in every one is covered inline** with
    `m.role is not distinct from app.active_role()`. The claim holds.
  - *`= any(array)`* — exactly one site, `seed_selected_meeting_attendees`, third-party
    as stated.
  - *named args* — zero `=>` call sites among the 38 memberships-reading functions.
  - the 38-function population reconciles to the header's "36 of 38 correctly not
    flagged" (38 total − 2 function findings).
- **The one place ADR 0107 D4's delegation-as-evidence rule is load-bearing**: exactly
  one chunk has `has_role*` evidence with no inline `active_role` —
  `app.is_pqs_member_of_any`. I read it: the raw `memberships` row is only a candidate
  generator, and the authorization test is
  `app.has_role('hospital', m.hospital_id, 'pqs_member', p_user_id)`. Genuinely covered,
  and the anchor check is what makes that evidence admissible. D4 is correct.

### V4 — the allowlist premises. Verified from the catalog before ruling.

| Entry | Premise as written | Catalog check |
| --- | --- | --- |
| `session_context()` | "reveals only the caller's OWN grants" | ✅ `with me as (select (select auth.uid()) as uid)`; `profiles … where p.id = me.uid`; `memberships … where m.principal_id = me.uid`. Own rows only. |
| `assume_role(p_role platform_role)` | "read scoped to the single role being assumed"; "the switch is audited" | ✅ `where m.principal_id = v_uid and m.role = p_role::text …`; `perform app.audit_write('active_role.assumed', …)`. Both true. |
| `memberships_select (SELECT)` | "five arms, only `principal_id = (select auth.uid())` is raw" | ✅ Exact. The other four are `is_admin()` / `is_member_of` / `is_tenancy_admin_of` / `is_org_admin_of` / `is_hospital_admin_of` — I dumped all five bodies: every one reaches `has_role`/`has_role_any` (or, for `is_admin`, carries `active_role() is not distinct from 'platform_admin'` directly). All hat-bound. |
| `service_role` as a header note | "the sweep can never emit that key" | ✅ `custom_access_token_hook` binds `m.principal_id = v_user_id` where `v_user_id := (event ->> 'user_id')::uuid` — event-bound, never `auth.uid()`, and not captured by the sweep's `_hb_var` grammar. It classifies `unbound` → never a finding. Since I proved the ghost direction exits 1 (V3), a keyed entry **would break every run**. |

### V5 — the "no 0079 diff-scoped sweep owed" claim. Confirmed.

`git diff --name-status main...HEAD -- supabase/migrations/` is **empty**. S4 shipped no
migration, no RLS policy change, no `prosecdef` change. The sweep is not owed. `ARM=census`
re-run: 450 live gates / 461 verdicts, **HOLDS**. `ARM=hat` re-run: HOLDS.

I also confirmed I left the catalog as I found it: `has_role`, `has_role_any`, `is_admin`
all still carry the active-role condition, and zero `_hb_selftest%` functions survive.

### V6 — the lead's blast-radius correction. Verified from the hook body, not the prose.

`public.custom_access_token_hook`'s `else` branch **is** D11's implicit single-role
derive (`select array_agg(distinct role) into v_live_roles … if
coalesce(array_length(v_live_roles,1),0) = 1 then claims := jsonb_set(claims,
'{active_role}', …)`). No hook ⇒ that branch never runs ⇒ **no user of any cardinality
gets a claim** ⇒ `active_role()` NULL ⇒ every caller-arm of `has_role` is false. The
correction from "every multi-role principal" to "EVERY user" is right, and the framing
"this moves deploy sequencing from *some users degraded* to *the application is down*"
is the correct severity. This is the most valuable single line in the S4 record.

### V7 — the frontend deletion and its tripwire.

- **Both surviving `navScope` arms are still reachable** — `"configuration"` at
  `src/app/o/[org]/c/[commission]/layout.tsx:161`, `"member"` at `:323`. The deletion did
  not strand the enum's other member.
- The `!==` → `===` flip on `showsConfiguration`/`showsMemberItems`
  (`src/components/shell/app-sidebar.tsx:515-516`) is a real fail-closed improvement, not
  cosmetics: under `!==` a third scope added later would get **both** families.
- Removal over a runtime `throw` is the right call for a Server Component layout, and the
  reasoning (a widened principal loses menu entries, never access, because
  `canConfigureCommission` still gates each destination) checks out.
- `src/components/shell/nav-scope-exclusivity.test.ts` passes 21/21 (1 control + 10 + 10).
  The **falsifiability control is genuine** — it asserts hat-blind the same grants *do*
  confer both standings, so the guards cannot pass by producing nothing. The catalog-read
  role vocabulary that fails loudly rather than skipping is the right pattern.

---

## 2. Findings

### 🟡 MINOR-1 — PROGRESS claims S4 carries three r1/r2 MINORs; only one has a task row, and one is silently undone

`PROGRESS.md` (S4 block): *"Scope is the plan's Stage 4 … plus the three r1/r2 MINORs
carried here."* The task table has **S4-5 only** (MINOR-1, navScope — closed correctly).

- **S3 MINOR-3** is fine: folded into `FUP-ACT-DISPOSE-UI`, which is present in
  `PROGRESS.md:597` and item 0 of *Remaining pre-pilot work*. Not S4's to close.
- **S3 MINOR-2 was not done and has no owner.** Its ask was a record correction: the S3
  status cell calls the D9 RSC issue a *"grant-serialization leak"*, which the r1 reviewer
  showed overstates it (the grants are the caller's own; the same exposure is untouched at
  far greater scale in four other client components). The phrase still stands verbatim at
  **`docs/progress/act-as-role-assumption.md:175`**.

Either correct the phrase or drop "three" from the scope line. Leaving both is how a
scope claim becomes decoration. **Requirement:** the phase's own scope statement must
match what shipped.

### 🟡 MINOR-2 — the sweep's self-test covers only the FUNCTION path; the cross-table policy branch had zero evidence it can fire

`act-hat-blind-sweep.sh:329-382` plants four specimens: ST1 blind direct read, ST2 covered
twin, ST3 class-4 param gate, ST4 anchor flip. **All four are functions.** The policy
detector (`:275-317`) is a separate ~40-line branch with its own hand-rolled window walker,
and **no planted specimen exercises either half of it**.

- The `tbl = 'memberships'` half is redeemed by a live positive (it emits
  `memberships_select` every run).
- The `else` half — policies on *other* tables that reference `memberships` — has **three
  live specimens and all three are negatives**. A branch that always returned `false` would
  produce an identical run. That is precisely the shape ADR 0107 D3 was written against,
  and Amendment 4's harness that "reported 0 guards in 45 doors" is the cautionary case.

I closed the gap myself rather than reporting a suspicion: I transcribed the walker
verbatim into a temp function and fed it synthetic predicates in `pg_policies` render
form. It is **correct** — a blind cross-table read (both the `(select auth.uid())` and
bare `auth.uid()` spellings) is flagged; an inline-`active_role` twin and the real
third-party shape (`m.principal_id = profiles.id`) are not. I also confirmed the three
live cross-table policies (`profiles_admin_select`, `profiles_select_self_or_admin`,
`hospital_affiliations_select`) are correct negatives by hand: every `memberships`
subquery in them binds `principal_id` to the **row's** identity and gates on a hat-bound
`is_*` predicate.

So the branch works — but the sweep does not prove it, and my probe is not a standing
artifact. **Add an ST5** that plants a policy on a non-`memberships` table inside the
existing self-test transaction. Cost is a few lines; without it the sweep's strongest
selling point ("self-tests its own detector every run") is true of three quarters of it.

### 🟡 MINOR-3 — D6's enumeration excludes the two arms D14 assigns to D6's class

ADR 0106 D6 (`docs/decisions/0106-act-as-role-assumption.md:132-134`) enumerates the
hat-immune relationships as **four** predicates: `is_case_respondent`,
`is_recused_from_case`, `is_document_approver_of`, `is_document_version_approver`.

D14's classification puts **two more** in that class: the S3 `case_access_grants` arm and
the S4 `case_phases`/`case_narratives.assigned_to` arm. Neither appears in D6's list.

This is the *"an enumeration's boundary must be the property, not a list"* failure in its
documentation form: the next reader who re-derives the class from D6 will get four
members, not six, and will reach a different answer than `319` pins. Whatever the PO rules
on MINOR-4/§3 below, D6's enumeration must be extended (or D14's classification re-homed
under a stated property) so the two documents cannot disagree.

### 🟡 MINOR-4 — D5's headline sentence is literally false as built

ADR 0106 D5 (`:125`): *"No active role means no role at all — the request sees what a
stranger sees."*

A stranger measures `app._case_caps` = **0**. A hatless grantee measures **30** (`319` A13,
which I re-ran). The sentence is not a rounding error — it is the sentence the PO will read
when ruling on §3, and it manufactures half the tension it is being asked to resolve.

The invariant D5 actually enforces, and which the build gets right, is narrower and worth
stating exactly: **no active role means no ROLE-derived reach; per-object relationships
(D6) are unaffected, including in the hatless state.** This repo has a standing lesson that
a comment is an assertion that goes stale silently and has already shipped a live bug behind
one; a load-bearing ADR sentence is the same substrate.

### 🟡 MINOR-5 — the whole-object-vs-one-arm gap the lead patched for `memberships_select` applies identically to `session_context`

The lead added condition (b) to the `memberships_select` entry because it *keys on a whole
policy while reasoning about one arm*. Correct, and I verified the arm census behind it.

The same gap exists for `fn: public.session_context()`
(`supabase/tests/mutation/act-hat-blind-allowlist.txt:48-59`) and is not covered: its
"WRONG THE DAY" is entirely **consumer**-facing ("output used as an ACCESS DECISION"). The
entry keys the whole function. If `session_context` ever gained a *second* `memberships`
read — a third-party one — that read would inherit the exemption silently, because the
existing caller-bound read keeps the finding alive and the entry keeps absorbing it. No
ghost, no new finding, no signal.

`assume_role`'s clause already closes this ("starts returning or acting on grant data
beyond validating the requested role"), which is why the asymmetry stands out. Add a
symmetric clause to `session_context`: *wrong the day this function reads any
`memberships` rows beyond the caller's own.*

### 🟡 MINOR-6 — a hatless PHI read produces an audit row with **no** `acting_as` key, and absence has three possible meanings

Catalog-verified in `app.audit_write`:

```
v_acting_as := app.active_role();
if v_acting_as is not null then
  v_metadata := v_metadata || jsonb_build_object('acting_as', v_acting_as);
end if;
```

The key is **absent**, not null. For the hatless-grantee path in §3 — the one class of read
this platform most needs to reconstruct later — the trail cannot distinguish *"no hat was
worn"* from *"pre-ACT row"* from *"written by a service-role/system path"*.

Rule 11 is **met** (the row records *that* and *who*; `acting_as` is an ADR 0106 addition,
not a Rule 11 requirement), so this is not a violation and does not block. But recording
hatlessness explicitly (`'acting_as', 'none'`, or a `hatless: true` marker) turns an
inference into a fact for a few characters. Recommend as a follow-up alongside the §3
ruling, since the two travel together.

### ⚪ INFO-1 — seam B's 10 cases carry 4 units of evidence, not 10

Measured, not inferred: I ran the real `partitionGrants` + `isCommissionAdmin` derivation
over each of the 10 catalog roles individually. **Six** — `nsp_org_admin`,
`nsp_coordinator`, `pqs_member`, `technical_director`, `technical_director_deputy`,
`quality_reviewer` — land in **neither** nav family, so `holdsBothStandings([role])` is
trivially false and their seam-B case passes for a reason unrelated to bucket disjointness.

The assertion is still **correct** ("at most one" is satisfied by zero) and the guard is
sound — and importantly the CONTROL does protect against a *global* collapse, since it
would red if the aggregate fixture stopped conferring both standings. The header's framing
just invites a future reader to bank 10 units of evidence where there are 4. One line in
the header ("only staff/staff_admin/org_admin/hospital_admin are informative here; the
other six route nowhere") would keep the count honest. Not actionable on its own.

### ⚪ INFO-2 — the sweep's property is scoped to `public.memberships` by choice

Grant-bearing substrate outside that table is out of scope by construction:
`commission_administrativo_capabilities` (named and keystoned separately — correct), and
`hospital_affiliations`, which ADR 0097 made a **read-visibility input**. Affiliation is a
relationship rather than a role grant, so excluding it is defensible; it is just not
stated. Worth one line in the header's scope paragraph so a future reader does not read
`ARM=hat` as "all authorization substrate".

### ⚪ INFO-3 — small notes

- `docs/decisions/0107-…md` — no ADR number collision (`0105`/`0106`/`0107` only). Status,
  relates-to, and consequences are well-formed.
- The `CLAUDE.md` §6 edit is accurate on both touch points (step 1 arm list, step 5
  "name the ARM, never the script" gloss) and correctly describes `ARM=hat` as *"whether
  any door reads `memberships` without the caller's hat"*. Human-approved per `6b247b2`.
- `f8551ea` (E2E prose) changes comments only, no assertions — and it is the right instinct:
  it closes the stale-comment tail of the deletion rather than leaving `e2e/` describing a
  scope that no longer exists.
- The nav-scope tripwire adds a hard Docker dependency to `npm run test`. Deliberate,
  precedented (`session-grants.test.ts`), and it fails loudly rather than skipping — the
  right trade, recorded here only so it is not rediscovered as a surprise in CI.

---

## 3. The A13 / D5×D6 question — my ruling, for the PO

**Question:** a hatless multi-role principal keeps mask **30** =
`read_case_deliberation | read_case_content | read_standard_phi | read_restricted_phi` —
read-only, but including Rule-12 PHI (`read_standard_phi`, projected by
`can_read_case_patient`; bit 16 is reserved and unconsumed). Both write bits are absent.
Is that right, and is the PHI read defensible?

**My ruling: the as-built behaviour is correct. Ship it. Do not gate relationship-derived
reach on the hat.**

Reasoning, in the order I'd defend it:

1. **D5's security content is fully delivered.** D5 exists to stop a hatless session
   silently reverting to the union of every role. A13 measures all five role arms at
   **0**. That is the whole of what D5 protects, and it holds exactly.

2. **The assignment arm is beyond argument.** `case_phases.assigned_to = you` is a duty
   placed on you by name. It is D6's own "a case does not stop being about you" in the
   positive direction.

3. **The ACL arm is the harder half, and it still lands relationship-side.** A
   `case_access_grants` row names *one person* on *one case* with *explicit columns*,
   revocable and expirable. It is not derived from any role and **cannot be reproduced by
   wearing any hat**. That is the decisive point: to make it hat-bound you must say which
   hat it belongs to, and there is no principled answer, because the grant names a person,
   not a role. The only implementable alternative is "requires *some* hat", which is
   friction, not a security property — and for a principal whose grant is their only reach,
   there may be no hat that restores it.

4. **The fail-closed guarantees that matter are untouched in the hatless state.** STEP-2
   `is_active` and the STEP-4 denies still zero everything — `319` A15–A17 measure 0 for a
   recused principal under the widest hat, the other hat, and the third-party path.
   Deactivation and recusal outrank hatlessness.

5. **On Rule 12 specifically — defensible, and arguably *better* than the alternative.**
   The hatless PHI read requires an explicit `read_standard_phi` **column** on a live,
   unrevoked, unexpired grant naming this principal on this case. That is strictly
   narrower than the S1 coordinator arm, which confers the identical bit from a *role*.
   Minimum-necessary is served by the grant's shape, not by the hat; adding a hat
   requirement would not narrow the data reached by one field.

6. **On Rule 11 — met, but legible only by inference.** See MINOR-6. The read is audited
   (`get_case_patients` → `log_audit_access` → `audit_write`), the actor and the event are
   recorded, and Rule 11 asks for no more. The `acting_as` key is simply absent, which is
   *truthful* but ambiguous. Fix that with an explicit marker; do not fix it by denying the
   read.

**What I would change is the prose, not the behaviour** — MINOR-3 and MINOR-4. D5 promises
stranger-equivalence it does not deliver and D6 enumerates four members of a six-member
class. Correct both **before** the PO rules, so the ruling is made against what the system
does rather than against a sentence that overstates it.

**If the PO rules the other way** (relationship reach also requires a hat), `319` A13 is
the assertion that must consciously go red, and its message says so. That is the right
design: the tension is pinned executably, not left to a paragraph.

---

## 4. Review of the lead's own work

Audited as requested, on the same terms as the rest:

| Item | Verdict |
| --- | --- |
| ADR 0106 ratification section (P1–P6, status, cutover debts) | ✅ Accurate. P4's "a flag's off position is the exact fail-open mode D5 rejects" is the correct justification for the deviation and is worth the space it takes. |
| Blast-radius correction (`c4049c7`, `05d8fc2`, `9866cd8`) | ✅ **Verified from the hook body** (V6). The claim is right and the severity re-framing is right. Correcting it in the ADR *and* PROGRESS *and* the pre-pilot item, rather than one of the three, is the behaviour the "text is not truth" lessons ask for. |
| `CLAUDE.md` §6 edit (`6b247b2`) | ✅ Accurate on both touch points; human-approved. |
| PROGRESS S4 rows | 🟡 One defect — MINOR-1 (scope claims three carried MINORs, delivers one, and the third is silently undone). Everything else reconciles: S4-6 correctly still ⬜, and the "unchanged by S4 — the two deploy debts remain open" box is the right thing to state loudly. |
| Adding the second "wrong the day" condition to `memberships_select` | ✅ Correct, and the catalog check behind it is correct. See MINOR-5 for the same gap left open on `session_context`. |
| Flagging `assume_role` + `memberships_select` for veto instead of quietly allowlisting them | ✅ The right instinct, and it is why this review could rule on them rather than discover them. |

---

## 5. Gate evidence

Re-run by me: `319` standalone (17/17, plus both neutralizations red) · `ARM=hat`
(self-test 4/4, anchors OK, 3 findings ≡ allowlist) · `ARM=census` (450/461, HOLDS) ·
allowlist contract red in both directions (exit 1) · `nav-scope-exclusivity.test.ts`
(21/21) · migration diff empty · catalog left clean.

Accepted from the record (no reason to doubt, nothing in my probes contradicted them):
`npm run test:db` 180 files / 5707 tests · `ARM=floor` 80 · `npm run e2e:prod` 1057
passed / 0 failed / 2 flaky / 0 did-not-run, 1059 of 1064 reconciling to 5 deliberate
skips · lint 0/0 · typecheck · Vitest 1218.

## 6. Verdict

**✅ APPROVED.** No finding blocks the stage. The three claims most worth doubting — that
no `_case_caps` arm is unclassified, that `319`'s twins can fail, and that the sweep can
find something — each survived being re-derived by property rather than accepted by
instance. MINOR-1 through MINOR-6 are all record or coverage precision; MINOR-2 (the
missing policy self-test specimen) is the one I would fix first, because it is the only
finding where a real detector's proof is thinner than its advertisement.

The A13 question in §3 goes to the PO with my recommendation to keep the behaviour and fix
the two prose defects that make it look worse than it is.
