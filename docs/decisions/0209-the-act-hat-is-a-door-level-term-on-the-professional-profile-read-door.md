# 0209 — The ACT hat is a DOOR-level term on the professional-profile read door, evaluated before the arms

**Status:** Accepted (2026-09-11, at unit `ARM3-HAT-TERM-FIX`; D5 marked **PO to ratify at approval**)
**Area:** authorization / ACT / professional-identity doors
**Related:** [0106](./0106-act-as-role-assumption.md) · [0175](./0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) · [0176](./0176-authz-permission-layer-made-real.md) · [0200](./0200-professional-identity-predicates-answer-about-their-subject.md) · [0205](./0205-per-object-grant-plane-convention.md)
**Amends:** [0201](./0201-the-keying-asymmetry-is-the-model.md) — D1–D3 ratified the keying asymmetry (a third-party question ignores the ACT hat; a self-check requires it) as *the model*, and located the hat term where it already lived: inside `app.has_role` / `app.has_role_any` / `authz.holds_role` / `app.is_admin_for`, as each predicate's trailing conjunct. That location is sound wherever a door's every grant term routes through one of those predicates. This decision adds the case the model did not anticipate — a door with a grant term that routes through NONE of them — and rules that on such a door the hat is a term of the DOOR, not of the arms. ⛔ The asymmetry itself is untouched, and no existing predicate's conjunct moves.

## Context

`app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` is the Class-2
professional-identity read door (Architecture Rule 12), embedded directly in two RLS policies. Since
ADR 0176 D2/D6 and ADR 0200 it carries four grant terms in three arms:

1. `app.is_admin_for(p_uid)` — subject-keyed, carries its own hat conjunct;
2. `app.can_manage_professional(v_org, p_uid)` **or**
   `authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')` — both descend into
   `app.has_role` / `authz.holds_role`, which carry the same conjunct;
3. a DEFINER traversal `professional_participants → case_participants(live) →
   app.can_read_case_committee(case_id, p_uid)`, which reduces to C ∧ D over `app._case_caps`.

The ACT hat rule (ADR 0106 D11) is one sentence: **you cannot read your own profile while acting as
another role.** It is written as the trailing conjunct
`p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role()`, which makes
it bind on a SELF-check and vacuously pass for a third party — the asymmetry ADR 0201 ratified.

⛔ **Arm 3 contains no role lookup at any of its grant-bearing sources.** `app._case_caps`'s S3
(`case_access_grants`) and S4 (case assignment) are keyed on `principal_id` alone; six of the eight
sources do route through role lookups, and these two do not, deliberately — PO ruling R2 on
`BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE`: *"the case-grant path
deliberately anchors on the case, not on the caller's org or role. That is the whole point of an
explicit grant."*

## Problem

A rule that every arm but one enforces is a rule the door does not enforce.

Measured live on the untouched seed at head pair `(20261003007390, 528)`, with
`request.jwt.claims` set so both `auth.uid()` and `app.active_role()` bind: a `staff_admin` holding
one `case_access_grants` row read his OWN professional profile at hat `staff` and at **no hat at
all**, with arms 1, 2a and 2b all false and arm 3 alone answering `true`. Caps dropped 111 → 6
between the two hats while arm 3 stayed true, identifying the reach as S3 rather than the role-keyed
S1. ⛔ **That is a rule rendered inoperative for anyone holding a case grant, not a generic
fail-open**, and the distinction is the PO's: the weaker framing (*"an absent hat fails closed
everywhere else"*) is a wider claim that does not govern the fix.

Two obvious repairs were already measured — by mutation, before this unit opened — and **both are
refused by assertions in the tree**:

| candidate fix | what reds | why it is wrong |
| --- | --- | --- |
| an **ORG** check inside arm 3 | `403` §7.5 (both directions of the cross-org edge) | an explicit grant anchors on the CASE; narrowing by org *"would silently break cross-org case collaboration that the referral module exists for"* (PO ruling R2) |
| a **role-keyed hat** check inside arm 3 | `403` §4.1b, on 36 cells | S3 is role-free **by design**: a principal holding NO role reaching through an explicit grant is approved reach, and a hat check keyed on the hat alone kills it |

⇒ the fix must handle S3's role-free case **explicitly**, and cannot do so from inside arm 3.

## Decision

**D1 — The ACT hat is a term of the DOOR, evaluated before any arm.** Immediately after the
`p_uid is null` guard, `app.can_read_professional_profile` returns false when the question is about
the caller themselves (`p_uid is not distinct from (select auth.uid())`), the caller holds at least
one live role, and `app.active_role()` is none of those roles. The arms then run exactly as before,
and **arm 3's SQL is unchanged** — no org term, no role lookup, still anchored on the case. The arms
that already carry their own hat conjunct keep it: belt and braces, and removing one would be a
separate decision about a predicate other doors share.

**D2 — "Holds a live role" is defined as the set the TOKEN HOOK derives `active_role` from
IMPLICITLY**, not as a hand-list:

```
select 'platform_admin' where profiles.is_admin
union all
select distinct role from public.memberships
 where principal_id = <uid> and (expires_at is null or expires_at > now())
```

— the query in `public.custom_access_token_hook`'s **second** branch, the one reached when the
session carries no explicit selection row, with a liveness predicate byte-identical to
`app.has_role`'s. ⛔ Defined this way rather than hand-listed so the door tracks the role model
instead of a copy of it.

⚠ **It is NOT "every hat the hook can issue", and the correction is measured rather than argued**
(QA review 2026-09-11, finding B1; read from `pg_proc`, `pg_trigger`, `pg_constraint`). The hook has
**two** branches, and its FIRST reads `app.active_role_selections` for the session — *"an explicit
selection for THIS session wins"*. The only writer of that table is `public.assume_role`, which
validates holding at **selection time only** and then upserts on `session_id`; nothing revalidates or
removes the row afterwards — `public.memberships` carries no trigger but `trg_audit_memberships`,
and the selection table has a single FK (`user_id → profiles`, `ON DELETE CASCADE`), no `session_id`
FK and no expiry column. ⇒ a session holding a **stale** selection — its membership revoked or
expired mid-session — can present a hat this set no longer contains, and **this door denies it**.
⛔ That deny is **deliberate, not a lockout**: at that moment `app.has_role` and `app.is_admin_for`
deny the same principal too, because the membership behind the hat is gone. ⛔ The repair is
**not** to read `app.active_role_selections` here — that would make the door accept a hat the
principal no longer holds, which is the defect this decision exists to close. The window itself is
filed as `FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP`.

⛔ No `app.is_active` term is added (account state is
`_case_caps` STEP 2's job on this path and `app.is_admin_for`'s on arm 1; a third copy would put one
predicate at three sites with no arm able to say which answered), and no call into layer 1 or 2 (a
legacy door that consults the candidate resolver stops being a differential subject).

**D3 — A principal holding NO live role is EXEMPT, and that exemption is the fix's load-bearing
half.** They have no hat to be wrong. This is what keeps PO ruling R2's approved reach intact — the
36 `arm3:divergent-approved:not-a-holder` cells — and it is the difference between this shape and
the refused role-keyed one. ⛔ It is asserted, not argued: dropping this conjunct reds `403` §4.1b on
exactly those 36 cells and flips line 2 of §7.4b.

**D4 — A HATLESS holder self-checking is DENIED.** Both halves of the term use `is not distinct
from`, so an absent `active_role` claim matches no held role and the guard fires. ⚠ With `=` the
`not exists` would evaluate to NULL and the guard would fall through on exactly this case — the
`BUG-ACT-NULLHAT-1` shape, which is why `app.has_role` already carries the same operator. ⚠ This
coordinate is **unconstructible for `403`'s holder personas**: the hook mints a hat implicitly for a
principal holding exactly one role TYPE, and each of them holds exactly one, which is why the vector
carries no cell there (generator rule `absent_unreachable_for_single_role_principal`). It IS
constructible in production for a principal holding two or more role types. `403` §7.4b pins the
door's value at an absent hat directly, building the claims with `set_config` rather than
`test_helpers.claims_for` — through the helper the line would silently seat the single derived role
and measure the MATCHING hat.

**D5 — ⛔ PO to ratify at approval: the eight cross-org `other_role` SELF cells are RE-RULED to
DENY.** The door-level term denies **18** grant-keyed differential cells, not the 10 the bug named.
The extra 8 (`subject_holder` and `other_commission_holder` at `foreign_org_commission`,
`cross_org_actor` at `own_commission` and `sibling_commission`, each at `active` and `pending`) were
labelled `arm3:divergent-approved:cross-org` and expected a legacy GRANT. They are **not** a second
defect and **not** a count correction — they landed in the cross-org class by **generator
precedence**: `expected()` resolves scope (`deny-class:cross_org`) before it resolves the hat
(`wrong_active_context:self`), and `arm3_divergence` dispatches on the resulting source. PO ruling R2
approved **cross-org reach** and never spoke to the **wrong hat**; a term that spared these eight
would have to ask whether the caller's org matches the case's — which IS the org check R2 forbids.
All 18 now carry `arm3:pre-empted:door-hat-term` and expect DENY; the flip census moves 92 → 84.

## Considered options

**(a) A hat check inside arm 3, keyed on the role the caller holds at the case's commission.**
REJECTED, and mutation-measured: it reds `403` §4.1b on the 36 role-less cells. S3 has no role to key
on, so the check either invents one or excludes the principals the grant plane exists for.

**(b) An org check inside arm 3.** REJECTED by PO ruling R2 and by `403` §7.5, which asserts both
directions of the cross-org edge under the MATCHING hat precisely so a red-to-green fix cannot quietly
revoke them.

**(c) The door-level term — chosen.** It is the second of the two shapes R2 itself named (*"have the
door evaluate the hat term before the arms, rather than inside some of them"*), and it is the only
one that separates the two questions the other options conflate: *does this caller have a valid hat
for themselves* (a property of the CALLER) from *does this reach need a role* (a property of the
REACH).

**(d) Remove the trailing conjunct from `has_role`/`is_admin_for` and centralise the hat at every
door.** REJECTED as out of scope and far wider than the defect: those predicates are shared by every
authority path in the tree, and ADR 0201 ratified their conjunct as the model. This decision adds a
term at ONE door and removes none.

**(e) Spare the 8 cross-org cells by conditioning the hat term on org.** REJECTED — see D5. It is
option (b) wearing a narrower scope.

## Consequences

- **Declared as a TIGHTENING, not folded into a no-regression claim.** A principal who holds a live
  role and asks about themselves under a hat they do not hold is denied at this door whatever arm
  would have answered. Measured cost: 18 vector cells GRANT → DENY, and **zero** other pgTAP reds —
  the full suite runs `Files=267, Tests=9023` before and after, so no existing fixture had to seat a
  hat. ⚠ That is a real bound in both directions: it also means no suite but `403` exercised this
  coordinate.
- **`403` moves by deletion, not by edit.** §7.4 — which pinned the defect head-on ("10 cells, legacy
  granted on 10 … approved answer denies on 10") and whose own message named deletion as the route —
  is DELETED, the by-label carve-out is dropped from §4.1 and §4.1b, and §7.3's partition string is
  RE-DERIVED by running its query. §7.4b replaces it with a live **four-line** pin: the DENY the fix
  creates, the GRANT it must not break, the hatless-holder value, and — added at the QA fix pass
  2026-09-11 (finding m2) — a THIRD-PARTY question asked by a role-HOLDING caller under a hat it
  does not hold, which must GRANT. That fourth line is a one-variable differential against the first:
  only the CALLER changes. ⚠ Its grant is **over-determined** and the assertion says so — `arm2b`
  reads true there, because `authz.has_permission` carries the same §6A asymmetry — so it pins the
  door-level caller-keyed term, ⛔ not arm 3. `plan(27)` is unmoved throughout, which is
  stated in the header so the swap is not read as a dropped test.
- **A detector outlived the defect it was written for.** Generator coverage `arm10(b)` refused a
  filed defect laundered into an approved legacy GRANT; its subject label now marks zero cells. It is
  re-keyed onto the `arm3:divergent-defective:` FAMILY and `--self-test` SYNTHESISES a member, so the
  arm stays exercised against a defect nobody has filed yet. ⛔ A future arm-3 defect label MUST use
  that prefix, or `arm10(b)` cannot see it. (The alternative — deleting the fixture whose subject had
  vanished — would have disarmed the arm on the day the last defect was fixed.)
- **A follow-up is discharged in the same body**, as its own ruling requires:
  `FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`. ⚠ A THIRD comment
  correction is taken in the same block and is declared an ADDITION outside that follow-up's scope:
  the arm-3 comment said the traversal was *"gated by the broad `can_read_case`"* when the body calls
  the narrow committee-plane `app.can_read_case_committee` — which matters, because an oversight-only
  reader reaches the case and must not reach the professional identities seated in it.
- **What this does NOT do.** It does not fix the hat term at any other door, and it does not make the
  hat rule enforceable wherever else a role-free reach may exist — `_case_caps` S3/S4 feed other
  doors, and nothing here surveys them. ⛔ Do not read this as "the ACT hat is now enforced
  everywhere"; it is enforced at ONE door, by ONE term, asserted by `403` §7.4b.
- **Arm 1 is still exercised, not oracled** (ADR 0175's surviving obligation, narrowed by
  `AE5-MATRIX-ARM3-CELLS` to arm 1 alone). This decision does not touch it.

### Considered and held: ADR 0208 D4's empty `search_path` (2026-09-11, QA finding M1)

The migration re-emits a `SECURITY DEFINER` body and **keeps** `search_path = app, public,
pg_catalog`, against ADR [0208](./0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D4's *"sole forward convention for **new or touched** SECURITY DEFINER functions"*. 0208 landed on
`main` at the commit this branch rebased onto, so it governs; the path is held anyway, and the
disposition is written here rather than left silent. **Two** reasons, both checkable — and a third
that is named and **refused**:

1. `supabase/tests/413_ae4_authorized_scope_ids.sql` pins **this door's** `proconfig`
   independently, and says why: *"app.can_read_professional_profile pins the SAME constant
   INDEPENDENTLY — it is §5's subset oracle and the policy's fallback arm, so its resolution order
   is load-bearing for this suite; pinning the two separately is the thing a sibling-equality
   differential could not do"*. Converging the path here moves a pin that carries another suite's
   argument, inside a unit whose subject is the hat term.
2. 0208 **D6** prefers a narrow `alter function … set search_path = ''` convergence migration over a
   body re-emit for exactly this class, and the same **D6** (⚠ not 0208 D5, the `414`/`419` ratchet — and
   not this ADR's own D5) orders targeted tests for the four temp-table DEFINERs before any sweep. That sequencing belongs to the unit that owns the convention.
3. ⚠ **Refused, and measured rather than assumed.** The obvious third reason — *"the empty form
   would force `pg_catalog.now()` into the body"* — does **not** hold here. Every relation and
   function the body names is already schema-qualified; its only unqualified references are the
   pg_catalog builtins `coalesce` and `now`, and pg_catalog is searched implicitly even when the
   declared path is empty (verified 2026-09-11 in a rolled-back read-only transaction:
   `set local search_path = ''` then `select now()` resolves). ⇒ converging this door may need
   **no body change at all** — a reason it fits the narrow `alter function` migration, ⛔ never a
   reason to call the divergence harmless.

⇒ the convergence is **owed**, and owed to 0208's own named unit `DEFINER-SEARCH-PATH-NARROW-FIX`,
⛔ not to this one. This door was added to the scope of
`FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` on the same date, so the debt is registered rather than
remembered. ⛔ Nothing detects the divergence today: `414` asserts *resolvability*, not the empty
form, and 0208's prospective ratchet (pgTAP `419`) is ruled but not built.
