# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** `app.can_manage_professional`'s arm 1 grants on `is_admin_for(p_uid)` alone, and that
predicate gates `public.update_professional_profile` and `public.redact_professional_profile` —
CPF, licence number, specialty, i.e. **Class-2 professional identity content**. ADR 0078 A35's noun
rule says a `platform_admin` is a superuser over tenancy, identity, vocabulary and audit and may
**not** touch commission content. This is Option (ii) of ADR 0200, rejected there only because it
moves a *currently reachable* answer and would have made the keying fix unattributable — not on
the merits.

**Closes when:** the PO has ruled on whether arm 1 should exist at this gate, with the door list (3
`public` RPCs, derived from `pg_proc`, not quoted) in front of them; and either the arm is removed
with a pgTAP cell asserting a `platform_admin` is denied `redact_professional_profile` (RED before,
GREEN after) plus an E2E over the reachable UI path, or the exception is recorded in an ADR naming
why professional identity is a tenancy noun.

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK`, out of ADR
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) § Considered
options (ii). Full record:
[`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).

---

## ⚠ CLAUSE CORRECTED, AND RULED, 2026-09-09 — pre-AE5 Batch 9, unit `AE5-OPENING-ADR`

### Two faults in the clause as filed

1. ⛔ **The door count was the DIRECT-READER count, not the closure.** Superseded wording:
   *"the door list (3 `public` RPCs, derived from `pg_proc`, not quoted)"*. The 3 are right as far as
   they go — and `320:129–134` already asserts by comment-stripped regex that exactly 3 `public`
   RPCs name `can_manage_professional` — but the arm's **closure** is **14**, through four `app`
   helpers: `can_create_professional` (+`create_professional_profile`,
   `ensure_professional_participant`), `can_manage_case_vocabulary` (+6 create/archive vocabulary
   doors), `can_manage_external_participant` (+`create_external_participant`), and
   `can_read_professional_profile` (+`get_case_professional`, `log_audit_access`).
   ⭐ **Behaviourally affected: 12, not 14** — `can_read_professional_profile` carries its **own**
   `app.is_admin_for` short-circuit that returns *before* it reaches `can_manage_professional`, so
   removing arm 1 changes nothing for those two. ⛔ **Cite both numbers; one alone is wrong whichever
   is chosen.**
2. ⛔ **The E2E it demanded CANNOT BE WRITTEN.** Superseded wording: *"plus an E2E over the reachable
   UI path"*. Measured: `updateProfessionalProfile` has 2 references in `src/` (its definition plus
   one doc comment) and `redactProfessionalProfile` has **1** (its own definition) — **zero**
   component or client callers for either; and `src/app/o/[org]/c/[commission]/layout.tsx:108–113`
   returns `notFound()` for a `platform_admin` who is neither member nor org admin, its comment
   naming **BUG-MT-005** (status `fixed`). ⇒ **there is no reachable UI path**; the arm's only live
   reach is **PostgREST**, and the assertion is rewritten to that path. ⚠ Zero UI callers is a
   *reachability* fact, not a *harmlessness* one — a `'use server'` export is POST-reachable whether
   or not a component calls it (LEARN-018).

### What the measurement did NOT overturn — the merits, verified in four independent pieces

Of all **7** destruction doors (**4** `dispose_*` — ⛔ `dispose_attachment_phi` does **not exist** in
the live catalog, the 5 comes from the stale A30 doc — plus `redact_referral_message`,
`redact_referral_note`, `redact_professional_profile`), **only `redact_professional_profile` reaches
`app.is_admin`/`is_admin_for`**, and only through this arm. `redact_professional_profile`'s HC0J7 bar
fires only when `retention_pinned_at` is set **or** the profile is a non-removed `respondent_doctor`
on a case whose decision `status = 'issued'` ⇒ **it does not bar redacting the respondent of an
UNDECIDED case** (the open sibling `FUP-ETHICS-RESPONDENT-PIN-FIRES-TOO-LATE`, 🟠, `PO to rule`). And
the sibling `…-ADMIN-ARM-IGNORES-IS-ACTIVE` means the principal need not even be active.
⇒ **A `platform_admin`, including a deactivated one, can erase the accused doctor's name, CPF,
licence and specialty in an undecided ethics case, in any tenant, over PostgREST, with no UI path,
no retention bar and no tenant-side actor in the trail. PROVEN BY EXECUTION** by the PO at head
`20261003007360` (*"Dra. Denunciada"* erased; rolled back), not inferred.

`public.professional_profiles` posture: RLS enabled; **one** policy (`professional_profiles_select`,
SELECT, `authenticated`); ACL `{postgres, service_role}` and `has_table_privilege('authenticated', …)`
**false for all four** of SELECT/INSERT/UPDATE/DELETE ⇒ removing the arm at the predicate is not
theatre. `authz.roles.platform_admin` has `allowed_scope_kind = none`, `state = legacy`, and
`authz.role_permissions` holds **0** grants of `org.professionals.manage` with no implication closure
reaching it ⇒ *held by nobody*, so "keep the arm" obliges AE5 to invent a carrier for it.

### PO ruling R4 (2026-09-09): REMOVE, RELOCATED NOT DELETED

*A35's "identity" noun is the **user directory**; a tenant's professional registry is **Class-2
tenant content**. `platform_admin` **reads** it (A35 ruling 3, unchanged) and never **writes** it.*
Batch 10 owes: arm 1 stripped from `app.can_manage_professional`; an **explicit** `app.is_admin_for`
arm added to `app.can_manage_case_vocabulary` (⚠ **not tidying** — a bare removal was measured to
strand vocabulary with `42501 "sem autorização para gerenciar o catálogo"`, and vocabulary is an A35
**MAY**-noun); **no** platform arm on `can_create_professional` / `can_manage_external_participant`,
so `platform_admin` also loses professional create and external mint — a change **beyond this
clause**, stated rather than absorbed. Expected reds to **re-rule, never silence**: `228:630–634` ·
`409` § 3.7 (polarity **and** message text) · `415` § 1.2 (§ 1.1 and the arm-2 cells stay) ·
`229:215–220` M1·1 FREEZE TWIN, which **flips at the door's FIRST gate** (`can_create_professional`)
and therefore **splits in two** — `org_admin` proves the freeze reaching `HC0F2`, `platform_admin`
proves the authority deny. ⛔ `401` and `410` are **NOT** expected reds: their fields are name-based
and their `residualLegacyAuthority` entries name **arm 2**. Over-grant twins per ADR 0078 A33, each
mutation-tested. This entry stays `Status: open` until Batch 10 lands.

⛔ **One reason offered for rejecting the narrow variant is REFUTED and must not enter the ADR.** The
claim was that `ensure_professional_participant` *"seats a professional INTO A CASE — commission
content"*. Measured: its only occurrence of `case_participants` is the feature-flag assertion
`app.assert_case_participants_enabled`; a `(insert|update|delete) … case_participants` regex over the
comment-stripped body is **false**; its own comment reads *"this door is org-scoped, not case-scoped
— it mints a registry identity, **it does not seat anyone**"*; and the seating door
`public.add_case_participant` is gated by `app.is_staff_admin_of(commission_id)`, in which
`can_create_professional` does not appear. ⚠ **The conclusion survives on a different fact:** the
mint inserts a `public.participants` row with `sensitivity_class = 'professional_identity'` and
`display_name = full_name` — **the real name** — so the narrow variant would still let a
`platform_admin` **create** Class-2 identity content in any tenant's org registry. **That** is the
reason to record; whether it suffices is the PO's call at the ADR draft.
