# FUP-AE2-VOID-LAST-ORG-AFFILIATION-UNMAPPED — the containment trigger's `23514` reaches the user as "tente novamente", and the guard that looks like it covers this is bounded to DOORS (owner: backend; filed 2026-08-31 from the AE2.4 residue the plan said to assign before the drop)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-31 · status open

**Filed late, and recorded as such deliberately.** `docs/plans/authz-evolution.md` § AE2.4 carries this
as *"⚠ Owed, not scheduled — a raw SQLSTATE now reaches a user … Assign it before the drop."* The drop
landed 2026-08-28 and shipped 2026-08-29; it was never assigned, and until this entry it existed in
**no `FUP-*` index line** — only in that plan tail and in `authz-ae2.md:978`, which is rotated
narrative. A deferral whose only record is rotated narrative is indistinguishable from an oversight —
the same shape as `FUP-AE2-392-FILENAME-CLAIMS-A-DIFFERENTIAL`, one item above.

**Mechanism — measured from the LIVE CATALOG 2026-08-31, not from migration text.**
`public.assert_profile_tenant_has_org` (ADR 0164's containment trigger; `constraint = true` on
`organization_affiliations`, `prosecdef = t`) raises `errcode = 'check_violation'` — **`23514`** — when
the row being voided was the principal's last non-voided org affiliation. Its own body comment already
records the debt: *"Unlike that precedent, THIS raise is reachable by a user action … Recorded as owed
rather than papered over."*

**Reachability, bounded rather than asserted.** `app.void_org_affiliation_impl` refuses **before** its
UPDATE on hospital ties in that org (`HC0RA`) and on membership seats (`HC0R9`), so the trigger is
reached only for a principal whose **only** non-voided org affiliation is the one being voided, holding
neither of those ties. That state is ordinary, not exotic — a person provisioned into an org and never
seated, or one whose hospital/commission ties were already removed.

⛔ **CORRECTION to how this was written down in both places — the symptom is not what they say.** The
plan and `authz-ae2.md` both say a *"raw `23514`"* surfaces. **It does not.** `toState`
(`src/lib/affiliations/actions.ts:144`) carries arms for `42501` and `HC0R0`–`HC0RA` and **no `23514`
arm**, so this falls to `default` → `MESSAGES.generic`. The user is told to **try again** — a retry
instruction for a condition retrying cannot fix, which is harder to diagnose from a bug report than a
raw code would be, and is precisely the hazard that `default` arm's own comment (`:193`) exists to
warn about. ⭐ So the fix is **not** "stop a raw error reaching the UI"; it is to give the condition a
real pt-BR refusal. Getting this backwards would let a `23514`-suppression change read as a closure.

⛔ **And there IS a guard that reads as covering this — bounded to the wrong grain.**
`src/lib/affiliations/door-error-arms.test.ts:343` asserts *"no live door raises check_violation
(23514) any more"*, and `:349` that every raised SQLSTATE has a `toState` arm. **Both are true, of
doors.** The suite's domain is derived from `.rpc()` call sites → `app.<name>_impl` bodies; a
**trigger** is in no part of it. The suite is green, both assertions are honest, and the leak sits
underneath them — [[a-predicate-quoted-at-the-wrong-grain]]. ⚠ It also means the class is invisible:
any trigger raise reachable through a door's call path lands the same way.

**Owed — two halves, and (1) alone closes the instance while leaving the class:**

1. A mapped **`HC0R*`** refusal (next free code; ADR 0135 posture — never P-class) raised **inside
   `app.void_org_affiliation_impl` before the UPDATE**, with its own `toState` arm and pt-BR message.
   The trigger's `23514` stays as the backstop it is: ADR 0156 excludes trigger functions from the
   door-SQLSTATE domain by construction, which is *why* the code is minted in the door, not the
   trigger. ⛔ **Do not instead add a `23514` arm to `toState`** — that maps the *code*, not the
   *condition*, and `app.guard_org_affiliation_no_delete` raises `23514` too (`authz-ae2.md:765`
   separates the two on message only), so one shared arm would answer for both.
2. Extend `door-error-arms.test.ts`'s domain — or add a sibling suite — so a trigger raise reachable
   through a door's own call path is in *some* suite's domain. **This is the durable half.**

⚠ It is a **door-body change**, so it re-arms §6 step 1's diff-scoped door sweep (⛔ **both** arms,
read and write). Its own small increment; never folded into an AE phase's branch.
