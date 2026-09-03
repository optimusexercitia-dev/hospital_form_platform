# FUP-AFF2-ACTIVE-MEANS-TWO-THINGS — three authorities say "active membership" and no policy implements it (owner: backend/PO; filed 2026-08-23 at AFF2 build start, from a conflict `backend` measured before writing SQL)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-23 · status open

ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) D13, the AFF2
plan's B2 task, and the build prompt each say the new `professional_credentials` membership leg admits
people holding an **active** membership. Measured 2026-08-23 against the live catalog: **neither**
`profiles` SELECT policy (`profiles_admin_select`, `profiles_select_self_or_admin`) filters
`expires_at` on its membership leg. There is no expiry predicate to mirror, and none of the three
authorities' "active" has ever been implemented on this path.

**Ruled MIRROR (Amdt 2 ruling 3), and the reasoning is the reason this stays open rather than closing.**
Filtering only the new policy would make `profiles` and `professional_credentials` **silently disagree
about what "active" means**, and the next reader could not tell which one is the bug. Worse, it
reproduces the trap B2 exists to remove: a person whose membership expired still reaches the directory
through the `profiles` leg, so a credentials-only filter renders their **Registro cell blank** —
"empty means no-permission" all over again. So the question is answerable **only for both policies at
once**, and a one-sided fix is itself the defect.

⚠ **The asymmetry now lives inside a single policy, which is the part that will mislead.** AFF2's B2
adds two legs: the **affiliation** leg filters activity (`ended_on IS NULL`), the **membership** leg
does not. A reader who checks the affiliation leg and generalises will conclude both are activity-
bounded. `backend` was asked to state this in the B2 test comments rather than leave it to inference.

⛔⛔ **CORRECTED 2026-08-23 — THIS ITEM'S OWN BOUNDING CLAIM WAS FALSE, and it is what kept the item
non-blocking.** The paragraph here previously read: *"Not a live hole; do not report it as one … The write
boundary is untouched: ADR 0133 D1/D2 bound administration separately."* **That is wrong.** D1/D2 are not
bounded *separately* — they are **implemented through `resolvePersonFootprint`**, and QA measured that its
membership leg has the **identical missing `expires_at` filter** (`person-footprint.ts:81-91`; the
affiliation leg three lines above *does* filter `ended_on`). So an expired seat granted person-level
**WRITE** authority — `updateUserProfile`, `upsertCredential`, `removeCredential` — on the path D4 declares
has no RLS backstop. Not a read-only exposure at all.

⭐ **The error is this file's own named class, committed in the sentence warning against it.** The body
below still says *"anyone closing this item on 'expiry is already handled' has quoted a real filter for a
conclusion it does not bound"* — and the bounding claim above did exactly that, citing D1/D2 as a separate
boundary while they run through the unfiltered resolver. Written by the lead; found by QA when asked
whether any residue was understated.

⚖ **PO-ruled 2026-08-23: FILTER the resolver** (ADR 0133 **Amendment 4** r1). That closes the write half —
one line plus a red-first keystone (an expired-membership-only target must be DENIED `fields` and
`credentials`). ⛔ It does **not** conflict with Amdt 2 r3: that ruling barred the two **RLS policies** from
disagreeing *with each other*; this is the **write** resolver, and a resolver stricter than the read
policies is the read-wider-than-write asymmetry Amdt 2 r2 already established.

⚠ **What REMAINS open, and it is genuinely the READ half only:** the two `profiles` policies and the B2
`professional_credentials` policy still carry no expiry filter, so an expired seat still admits a **read**.
That is the original question — answerable only for all of them at once. ⛔ **And the answerable set is
THREE authorities, not two**: this item said "both policies"; B2's membership leg is a third, and the
resolver was a fourth until Amdt 4 settled it.

⛔ **Reachability, measured (QA):** `memberships` rows with a non-null `expires_at` = **0 of 43**, and no
app path writes one. But `public.grant_role` is DEFINER, `authenticated`-executable and takes
`p_expires_at`, refusing only an already-past value — so a future-dated grant that later lapses **is
constructible through the API**, though not through the UI. ⭐ Pre-AFF2 the same unfiltered read existed and
bought nothing person-level; **AFF2 is what monetised it.**

**Note the caller-side filter does NOT cover this.** `app.has_role` filters `expires_at` on the
**admin's own** membership — their hat. It says nothing about the **target's** membership, which is
what this leg tests. Anyone closing this item on "expiry is already handled" has quoted a real filter
for a conclusion it does not bound.

⭐ **UPDATE 2026-08-25 — AFF3 (ADR [0148](../decisions/0148-ever-held-affiliation-read-visibility.md))
removed the affiliation leg's activity filter, and this item does NOT close on it.** AFF3 dropped
`and ha.ended_on is null` from all three policies to fix a separate defect (a hospital_admin lost the
person entirely at offboarding). Consequence for THIS item: the asymmetry that lived *inside* a single
policy is resolved — neither leg filters activity now, so they agree — but it resolved in the
**permissive** direction, by removing a filter rather than adding one.

⛔ **Do not read "all three predicates now contain zero `expires_at`" as closure.** That was proposed
and rejected on 2026-08-25: the absence of `expires_at` on the membership leg IS the open question, so
quoting it as evidence of agreement is this file's own named class again — a true measurement carrying
a conclusion it does not bound. The **write** half is genuinely closed (Amdt 4 r1 landed;
`resolvePersonFootprint` selects and applies `expires_at`). What is left is exactly the read half
below, now across three policies rather than two.

**To decide:** whether "active" should mean `expires_at IS NULL OR expires_at > now()` on the
membership legs of **both** policies, in one deliberate change with its own diff-scoped `ARM=policy`
sweep — or whether the authorities' wording should be corrected to match the implemented behaviour.
⛔ Never smuggled into a feature migration; `profiles` is a swept surface and the AFF2 plan's own risk
list forbids widening it "while we're here".
