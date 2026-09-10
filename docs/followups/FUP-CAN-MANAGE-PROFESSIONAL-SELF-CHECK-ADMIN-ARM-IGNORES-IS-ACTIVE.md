# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** Neither `app.is_admin()` nor `app.is_admin_for()` contains an `app.is_active` term
(verified from `pg_proc`, both bodies quoted in ADR 0200). So a `platform_admin` who is deactivated
or suspended passes every admin arm in the tree — including the ones BUG-PROF-INACTIVE-001
hardened on the org side, where `is_org_admin_of_for` *does* gate on `is_active(p_uid)`. ADR 0200
did **not** change this in either direction: the admin arm has never carried an `is_active` term to
bypass, before or after the re-key, so this is pre-existing and was kept out of that unit for
attributability. The asymmetry now sits inside one expression — arm 2
(`app.is_org_admin_of_for`) follows the subject's state, arm 1 (`app.is_admin_for`) ignores it.

**Closes when:** ⚠ **WIDENED TWICE — read this field, not the sentence below it.** The live `prosrc`
of **ALL THREE** sites contains an `app.is_active` term (verified from `pg_proc`, comments
stripped) — `app.is_admin_for` **and** `app.is_admin()` (PO ruling **R3**, 2026-09-09; the first
gates **0** RLS policies and 5 callers, the second **26** and 13) **and** `public.assume_role` (PO
ruling **R12**, 2026-09-10; the door that SEATS the hat) — each with **its own** pgTAP cell that
deactivates a `platform_admin` and asserts denial, **every one reported RED before the change**.
⛔ **A closure gating two of the three does not discharge this, and one cell over one site does not
either.** Superseded original, quoted so nothing is lost: *"`app.is_admin_for`'s live `prosrc`
contains an `app.is_active` term … with a pgTAP cell that deactivates a `platform_admin` and asserts
the admin arm denies, reported RED before the change"* — one site where the Mechanism above already
named two. ⛔ Or the PO rules explicitly that
platform-admin authority is deliberately independent of principal state, and that ruling is
recorded in an ADR. Not closed by "no one has deactivated an admin yet".

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK` — drafted while re-keying `app.can_manage_professional` and
`app.can_read_professional_profile` onto their `_for` twins (ADR
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md)). Full
record: [`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).

---

## ⚠ CLAUSE WIDENED 2026-09-09 — pre-AE5 Batch 9, unit `AE5-OPENING-ADR`, PO ruling R3

⛔ **The clause as filed named the WRONG predicate.** Superseded wording, quoted so nothing is lost:
*"`app.is_admin_for`'s live `prosrc` contains an `app.is_active` term (verified from `pg_proc`,
comments stripped)"*. The **Mechanism** above already named *both* `app.is_admin()` and
`app.is_admin_for()`, so the clause was narrower than the defect it was filed for — Batch 7's *"a
`Closes when` can name a wrong predicate"* fault, arriving one batch later.

**Blast radius, measured from the live catalog at head pair `(20261003007360, 525)`** — counts
**and** sets, because *a count is not a set*. `--`/`/* */` comments stripped and a call-shape suffix
required, since `profiles.is_admin` is also a **column name** and a bare word match counts comments
and column references (`is_admin_for` never matches `\yis_admin\y`, `_` being a word character):

| predicate | RLS policies (`qual`/`with_check`) | raw text mention | **real call** |
| --- | --- | --- | --- |
| `app.is_admin_for` | **0** | 6 | **5** |
| `app.is_admin()` | **26** | 32 | **13** |

The 5 real `is_admin_for` callers: `app.can_manage_professional`,
`app.can_read_professional_profile`, `app.grant_role_impl`, `app.recover_orphan_person_to_org_impl`,
`app.revoke_role_impl` (the 6th mention is comment-only, in `app.affiliate_person_impl`).
⛔ The 26 policies and 13 functions are a **set to re-derive at the fixing batch's own head**, never
a list to quote from here.

**Two facts the Mechanism above does not contain, both measured 2026-09-09:**

1. ⛔ **The gap is NOT bounded by token lifetime.** `app.active_role()` is
   `current_setting('request.jwt.claims')::jsonb ->> 'active_role'` — a bare claim read. And
   `public.assume_role`, the door that seats the hat, tests only
   `exists(select 1 from profiles where id = v_uid and is_admin = true)` on its `platform_admin`
   branch — **no `is_active`**. So a deactivated or suspended admin can seat a **fresh** hat.
   ⛔ Anyone reasoning *"the hat expires, so exposure is one session"* is reasoning from an
   assumption this refutes.
2. **No pgTAP cell anywhere deactivates a `platform_admin` and measures an admin arm.** Eight
   candidate files inspected (`229`, `293`, `318`, `397`, `398`, `401`, `404`, `409`, `415`): every
   existing "deactivated principal" cell targets a **different** role — `404` a `staff_admin`, and
   its own § 1.5 comment says it stopped there deliberately, naming this item's predecessor as why;
   `409` § 3.10/3.11 a `staff_admin`; `397` § 2.6 an `org_admin`; `401` § 16.3/16.4 a `staff_admin`.
   `415` contains **zero** occurrences of `is_active`. ⇒ the RED-first cell the clause demands does
   not exist to be reused.

**PO ruling R3 (2026-09-09): gate BOTH predicates.** Platform-admin authority does follow account
state. The migration and the RED-first cell are **Batch 10**; this entry stays `Status: open`.
⚠ **A THIRD site the clause does not name:** `public.assume_role` itself.
✅ **RULED 2026-09-10 (PO ruling R12) — IT IS IN SCOPE**, and this paragraph is corrected rather than
left standing: it previously read *"Whether it also gains the term goes to the PO with Batch 10's
shape — ⛔ it is **not** silently in scope here"*, which was true when written and false the moment
R12 was taken. ⇒ **Batch 10 gates THREE sites**, `app.is_admin()`, `app.is_admin_for()` **and**
`public.assume_role`, each with a RED-first cell. Rationale recorded in ADR 0201: gating the two
checks while leaving the **seating** door ungated makes the fix *read* as complete while a
deactivated admin can still put the hat on. ⛔ A closure that gates two of the three does not
discharge this entry.

---

## ⛔ EVIDENCE CORRECTED 2026-09-10 (QA MINOR-4) — the "no pgTAP cell" negative was a HAND-LIST

The paragraph above states *"Eight candidate files inspected (`229`, `293`, `318`, `397`, `398`,
`401`, `404`, `409`, `415`)"*. ⛔ **That is NINE names described as eight, it was assembled by hand,
and it omitted `231_authz_m5_is_active_gate.sql` — the suite named for the very predicate.** The
claim is load-bearing (it licenses *"the RED-first cell the clause demands does not exist to be
reused"*, which shapes Batch 10's scope), so a hand-list is not good enough: Batch 7's standing
lesson is that **a derived sweep piped through a hand-list is a hand-list wearing a label.**

⭐ **The conclusion SURVIVES. Re-derived, with the queries, not inspected:**

**D1 — who is deactivated anywhere in the suite** (⛔ not "who mentions `is_active`"):

```sh
grep -lE "update +public\.profiles +set +(is_active *= *false|suspended_until *= *now\(\) *\+)" supabase/tests/*.sql
```
⇒ **21 files.** ⚠ Neither the superseded 9 nor a looser pattern's 28 is this set; the predicate has
to be *a deactivating WRITE*, not a mention.

**D2 — the only files where the claim could be false** are those that also name `platform_admin`
**and** an admin predicate (`\bis_admin` or `can_manage_professional`) ⇒ **7**: `180` · `328` · `395`
· `396` · `397` · `401` · `409`.

**D3 — for each, the principal actually deactivated, read at the write site:** `180` `staff2_ccih` ·
`328` uuid `…0002`, seated `staff_admin` by its own `claims_for` · `395` uuid `…0ae24d000006`, a
picker *target* · `396` `p12`, one of a provisioned series · `397` `inact_oa`, an **org_admin** ·
`401` `t401_p`'s uid = `chefe.ccih`, a **staff_admin** (§ 16.3/16.4) · `409` `sa`, bound in-file to
`m.role = 'staff_admin'`.

⇒ **Not one of the 21 deactivates a `platform_admin`**, so no existing cell measures an admin arm
under a deactivated admin, and ⛔ **the RED-first cell R3/R12 demand still has to be written.**
⚠ `231` — the omission — deactivates `st_x` / `st_x2` / `st_y` / `sa_y` and contains **zero**
occurrences of `is_admin` or `platform`, so it never entered D2 and could not have changed the
answer. **The evidence was wrong; the finding was not.**

### ⛔ CORRECTION 2026-09-10 (QA N-MAJOR-2) — the derivation above asserts a FALSE UNIVERSAL, and its filter is the wrong predicate

⛔ **Superseded, quoted: *"Not one of the 21 deactivates a `platform_admin`"*. That is FALSE.**
`145_pqs_membership.sql:416` does `update public.profiles set is_active = false where id = (select
admin from k)`, and `admin` is the **only** principal `supabase/tests/00_setup.sql:152` flags
`is_admin = true`.

⭐ **The cause is a WRONG PREDICATE in D2, not a missed file** — the same fault class this batch has
now hit at every level. D2 filtered on the **string** `platform_admin`; but in this codebase a
platform admin is a **flag on `profiles`** (`is_admin = true`), and that string only appears when a
**hat** is named. A grep for the word cannot find a principal identified by a column.

**D2′ — the corrected predicate: deactivates an *admin-flagged* principal, OR one wearing the hat.**
Of the 21, exactly **two** qualify, and neither reaches an admin arm:

| file | why it qualifies | why it still does not measure an admin arm |
| --- | --- | --- |
| `145_pqs_membership.sql` | deactivates `admin` — `is_admin = true` (`00_setup.sql:152`) | ⭐ it seats `test_helpers.claims_for((select admin from k), false)` at `:418` — **no third argument, so NO hat** — and `app.is_admin()`'s live body requires `app.active_role() = 'platform_admin'`. ⇒ the admin arm is **unreachable** in that cell by construction; the assertion is `list_my_nsp_hospitals()` |
| `409_ae49_d6_rekey_differential.sql` | seats a `platform_admin` hat (§ 3.7) | its deactivation at `:711` targets `sa`, bound in-file to `m.role = 'staff_admin'` — a **different principal** from the hatted one |

⇒ **The conclusion SURVIVES: no existing cell measures an admin arm under a deactivated admin, so
the RED-first cell R3/R12 demand still has to be written.** ⛔ But it survives *per file, for stated
reasons*, and ⛔ **not** as the universal above — a universal is what made a single counter-example
fatal.

⭐ **AND ONE PIECE OF GUIDANCE HERE WAS WRONG IN A WAY THAT COSTS BATCH 10 WORK.** The claim *"the
RED-first cell … does not exist to be reused"* over-reached: **`145:414-425` is a reusable FIXTURE
SHAPE** — unexpire the grant, `is_active = false`, seat claims, assert, then `is_active = true` to
restore. What does **not** exist is a cell that seats the **`platform_admin` hat** on a deactivated
admin and measures `app.is_admin()` / `app.is_admin_for()` / `app.can_manage_professional`. ⇒ Batch
10 **adapts `145`'s shape and adds the hat**, rather than building from nothing.
