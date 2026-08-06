# ADR 0098 — AFF substrate & doors: the shape decisions ADR 0097 left open

**Status:** Accepted (build-time, `backend`, W1 + W2) · **Date:** 2026-08-06
**Scope:** implements ADR [0097](./0097-hospital-affiliation-person-identity.md) D1–D7,
D10–D13, D15, D17, D18. Migrations `20260909000100`–`000900`; keystones
`supabase/tests/301_hospital_affiliation_substrate.sql`,
`302_affiliation_doors.sql`, `303_dominance_grid.sql`.

ADR 0097 fixes *what* the substrate is. Five choices it does not settle were made while
building it; each is recorded here rather than only in a migration comment, because
each is a place a later reader could "fix" the code back into a defect.

1. **The `hospital_affiliations` SELECT policy's affiliation leg is ROW-scoped, not
   principal-scoped.** The plan phrases it as "the principal has an active affiliation
   to a hospital I administer". Transcribed literally onto `hospital_affiliations`
   itself that is a policy on T reading T — infinite policy recursion (42P17) unless
   laundered through a new `SECURITY DEFINER` helper, i.e. a new `prosecdef` gate to
   census, sweep and keystone forever. The leg is therefore
   `app.is_hospital_admin_of(hospital_id)` — *this row's* hospital. Nothing is lost:
   the reach a principal-scoped leg would add (seeing a person's affiliations at
   hospitals I do not administer) is served by the W2 directory door `list_org_people`
   (D10/D11), which is deliberately wider than the table policy. The membership leg
   stays principal-scoped — it must, since it is what closes finding 3.
2. **`app.is_admin()` is NOT a leg of that policy.** D6 specifies four legs.
   platform_admin's noun (tenancy + identity, ADR 0078 A35) arguably covers employment
   rows, but no decision of record says so, and an undeclared fifth leg is the
   drive-by widening ADR 0079 exists to catch. Adding it later is a one-line amendment
   with its own keystone.
3. **The `profiles` grant conversion revokes SELECT/INSERT/UPDATE only.** DELETE,
   TRUNCATE, TRIGGER and REFERENCES stay table-level, so REFERENCES still covers `cpf`.
   That is inert **because `authenticated` holds no CREATE on schema `public`** and so
   cannot build a referencing table to use as an existence oracle. The premise is
   asserted executably (pgTAP `301` §0.9), not left in a comment — a load-bearing claim
   in prose goes stale in silence.
4. **`updateUserProfile` with a null hospital does NOT end an affiliation.** Ending is
   a governed act with its own refusals (D5: refused while the person holds active
   memberships of any tier under that hospital) and belongs to the W2 `end_affiliation`
   door. A profile edit that happens to omit a field must not revoke employment as a
   side effect. The action's `homeHospitalId` therefore means *ensure*, never *replace*.
5. **`professional_profiles.cpf` carries no unique index** (D15 is "column only").
   `profiles.cpf` is unique because it is the PERSON key; `professional_profiles` rows
   are org-scoped case-subject records whose only writer is
   `create_professional_profile`, and uniqueness over them is a linking decision D15
   defers to FUP-ETH-1. Additive later.

## W2 — doors, visibility, dominance

**W2.1 — affiliation mutates through an ACTOR KERNEL plus two wrappers, not one door.**
ADR 0097 D13 says "affiliation mutates through a DEFINER door" and names
`affiliate_person` / `end_affiliation`. Building it that way would have left the hole
the door exists to close: **`registerUser` runs on the service-role client and has no
`auth.uid()`**, so an `auth.uid()`-only door is bypassed on the path that creates *most*
affiliations, and D13's tenant check never runs there. A guard placed where only one
caller passes through it is not a guard. The shape is therefore
`grant_role_impl`/`grant_role`/`grant_role_for`'s, verbatim:

- `app.affiliate_person_impl` / `app.end_affiliation_impl` — the kernels, taking an
  explicit `p_actor`, ACL `{postgres=X}`: executable by **nobody but their owner**, which
  is what makes `p_actor` unforgeable;
- `public.affiliate_person` / `public.end_affiliation` — `auth.uid()` wrappers, granted
  to `authenticated`;
- `public.affiliate_person_for` / `public.end_affiliation_for` — explicit-actor twins,
  granted to **`service_role` only**.

**Every refusal lives in the kernel; the wrappers contain no checks at all.**
`ensureActiveAffiliation` (`src/lib/users/actions.ts`) was migrated off raw DML onto
`affiliate_person_for` in the same change, and `scripts/check-memberships-door.mjs` —
already the repo gate forbidding raw `memberships` DML — was generalised to a
table→door map and now covers `hospital_affiliations` too. That gate is the point: W1
shipped exactly the raw `.insert()` it forbids, and only a re-read caught it.

`end_affiliation_for` ships **now, not on demand**: W3/T3.3's affiliation-management
action runs on the service client like every other action in `src/lib/users/actions.ts`,
so it will need the twin. Shipping the pair together also keeps the ACL split symmetric,
which is what a later reader will check.

**W2.2 — `list_org_people` is VOLATILE, and returns `is_active`.** Volatile because it
WRITES (the D11 audit row on CPF-parameterised calls) and a `STABLE` function cannot
INSERT — its sibling `list_addable_commission_members` is `STABLE` only because it emits
nothing. `is_active` is in the payload beyond D11's list of four fields: without it the
identifier-first flow (D12) will cheerfully offer to affiliate a deactivated account, or
push the admin into creating a duplicate. One PHI-free boolean, already readable by
these callers through `profiles`.

**W2.3 — the delete guard is ORIGIN-enabled; the audit trigger is ENABLE ALWAYS.** D4
says "never DELETE" and that was a convention with no constraint. Two things were probed
rather than reasoned about, and both shaped the result:

- `profiles` carries `guard_profile_no_delete`, so the `principal_id → profiles(id) ON
  DELETE CASCADE` path is **unreachable in origin mode** — the parent delete raises first.
- Under `session_replication_role = replica` the FK cascade does **not** fire either:
  probed, the parent deletes and the affiliation row is left **orphaned**. That is the
  recorded lesson — replica mode is the *same switch* for the immutability guards and for
  Postgres's RI triggers.

So an `ENABLE ALWAYS` guard would break `supabase/demo/reset-revisao-prontuario.sql`, a
legitimate superuser teardown that deletes profiles in exactly that mode (read, not
assumed — and it needed an explicit affiliation delete added, or the re-seed would 23505
against orphaned rows). The guard therefore mirrors `guard_profile_no_delete` exactly.
⚠ Which makes a DELETE arm on an origin-only audit trigger **dead code**: in origin mode
the BEFORE guard raises before any AFTER trigger runs, and in replica mode neither fires.
The audit trigger is therefore `ENABLE ALWAYS`, so the one mode in which a hard delete
*can* happen is the mode in which it is recorded. An unreachable branch would have
satisfied the letter of "add a DELETE arm" and none of its intent.

**W2.4 — the dominance grid classifies by RESOLVED authority, not surface text, and
carries synthetic controls.** Three things a naive grid gets wrong, each of which cost a
real finding here:

1. A surface regex over `is_hospital_admin_of` reports **1 false positive in 3**
   (`list_approver_candidates` reaches org_admin via `is_commission_admin_of`, whose
   `_for` variant spells it `has_role('organization', …, 'org_admin', …)`). The grid
   resolves delegation to a **fixpoint across both schemas** and counts both spellings.
2. The population's boundary must be the **property**, not a syntax. Adding an inlined
   `'hospital_admin'` literal arm found two gates the ADR's census never saw —
   `assign_hospital_admin` and `revoke_hospital_admin` — which then resolve as compliant
   because they delegate. A name-only sweep would not have adjudicated them at all.
3. After the two fixes there are **zero** real gaps, so "0 gaps" is also what a broken
   classifier reports. `303` §2 therefore builds three **synthetic** gates inside its own
   transaction — compliant, non-compliant, and compliant-only-via-transitivity — and
   requires the classifier to separate them. Anchoring the control on a real defect would
   have evaporated the moment that defect was fixed.

**W2.5 — pgTAP `281` D1 was INVERTED, not deleted.** It asserted `set_standard_ownership`
rejects an org_admin, describing that as a "D7 asymmetry, verified" — but *verified*
there described the behaviour, not a decision that the behaviour was right. ADR 0097
finding 9 and an independent external census both classify that gate as one of the two
real dominance gaps, and D18 (PO-ruled) fixes it. A deny twin (`D1b`, a commission
staff_admin still refused) was added in the same edit so widening the gate did not
silently remove §D's only authority-deny arm.

## Consequence recorded, not discovered later

`20260909000300` removes the `home_hospital_id` leg from both `profiles` SELECT
policies and adds nothing — the replacement legs are W2/T2.3. On the seeded population
this loses nothing (measured: `hospitaladmin.a1` reads 13/30 profiles and 21/34
memberships both before and after, the exact constants ADR 0097 finding 3 cites). On
the **product path** it does: a person registered at a hospital and seated on no
committee was read through that leg, and between W1 and T2.3 their hospital's admin
cannot read their profile. ADR 0097 finding 2 calls the leg "inert" on the strength of
the seed being 1/30 populated — that measures the seed, not the flow. pgTAP `301` §5.1
pins the gap, and **W2/T2.3 must invert that assertion**; it is the executable form of
this paragraph, not a property worth keeping.
