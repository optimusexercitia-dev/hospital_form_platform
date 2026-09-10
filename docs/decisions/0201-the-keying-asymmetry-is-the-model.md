# ADR 0201 — The keying asymmetry is the model: a question about a third party ignores the hat, a question about the caller requires it — and on the scope axis the hat is role-wide while the audit row named one seating

**Status:** accepted 2026-09-10 — proposed 2026-09-09 (pre-AE5 remediation Batch 9, unit `AE5-OPENING-ADR`; the PO rulings it records were taken 2026-09-09 **and 2026-09-10 (R12, and D5's closure by reaffirmation)**, and each is attributed inline)
**Date:** 2026-09-09
**Area:** authorization / the ACT hat (§6A asymmetry) / the AE5 per-role template's arm keying / `platform_admin`'s noun / audit scope
**Amends:** ADR [0176](./0176-authz-permission-layer-made-real.md) (D8's **F6** slot — D8 lists two options, *exact-assignment active context* vs *the role-wide hat*; the catalog implements a **third**, and this ADR ratifies it, splits F6 into its two axes and settles both) · ADR [0193](./0193-the-enforcement-manifest-declares-what-it-measured.md) (D5 — the per-row declaration obligation the AE5 template inherits gains a **keying** field per arm, and a **hat-required** flag beside it) · ADR [0200](./0200-professional-identity-predicates-answer-about-their-subject.md) (the keying obligation is restated as a template clause with the two axes separated, and its own § *What this ADR does not do* — the `is_active` gap — is now ruled)
**Supersedes:** nothing in the ADR corpus. ⛔ The superseded text is a **pgTAP assertion message**, `supabase/tests/409_ae49_d6_rekey_differential.sql` § 3.7's first clause, and the header vocabulary takes ADR numbers only — so it is named in § Decision D6 and quoted there in full.
**Related:** ADR [0078](./0078-authorization-capability-model.md) (A35, the noun rule — *"rule on the noun, not the column"*) · ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (a green arm bounds its own domain) · ADR [0106](./0106-act-as-role-assumption.md) (D11, the ACT hat, and why a third-party question must ignore it) · ADR [0091](./0091-ff5-entity-reference.md) (D1 — `participants.display_name` is *"a surrogate for patients and an already-org-readable name for professionals"*) · ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (the AE sequence; AE5 is post-pilot) · ADR [0172](./0172-ae4-catalog-substrate-match-full-binding-and-deferred-classification-columns.md) · ADR [0175](./0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md) (D3's forward promise, undischarged) · ADR [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md) (a committed number needs one home and a gated mirror — why every count below names what watches it, or says nothing can)

---

## Context

**Everything here is measured on the live catalog** (ADR 0078: migration text is stale by design)
at migration head pair **`(20261003007360, 525)`**, on container
`supabase_db_azkbbhskturikxpgmafq`, discriminated from its sibling project by
`authz` = **5 tables / 16 columns**. ⛔ No figure below is quoted from a migration file.

AE5 substitutes **eleven** role increments through **one** per-role template. The arithmetic
closes on the catalog: `authz.roles` holds **12** rows, of which exactly one — `staff_admin` — is
`state = 'authoritative'` and the other **11** are `legacy`; AE5's eleven increments are
`12 − staff_admin`. Every defect left in that template is therefore copied eleven times, which is
why ADR 0176 D8 forbids its decisions being *"picked off inside a role increment"*.

**F6 was carried as an open design question. It is not one — the catalog already implements an
answer nobody ratified.** `authz.entailed_grants(uuid, text, uuid, text)` does not *apply* the
hat; it **returns** it, as a fourth result column:

```
RETURNS TABLE(role_code text, granting_permission_code text, role_state text, hat_ok boolean)
```

and computes that column, in its body, under its own comment:

```sql
         -- The §6A ASYMMETRY, carried verbatim from AE4.4b: a THIRD-PARTY question ignores the
         -- hat (the 27 `_for` sites), a SELF question requires it (the 151 self-check sites).
         -- Neither uniform choice is correct.
         (p_principal is distinct from (select auth.uid())
          or af.role_code is not distinct from app.active_role())
```

**Three** functions consume it, not one — each filtering on `eg.hat_ok`:
`authz.has_permission`, `authz.candidate_has_permission`, `authz.explain_permission`. All three are
`prosecdef = t` with `search_path = ''`, as is `entailed_grants` itself.

⛔ **An instrument note, because it would have refuted this whole finding.** A
`prosrc ~ 'hat_ok'` regex over `authz` returns **`f` for `entailed_grants`** and **`t`** for the
three consumers — read naively, *"the term is not in that function."* It is: `hat_ok` is a
`RETURNS TABLE` column name, so it lives in the **result type** (`pg_get_function_result`) where
`prosrc` cannot reach it. The one-`f`/three-`t` split from one query **is** the control.
⇒ **A `prosrc` regex is blind to a `RETURNS TABLE` column name.**

**The same predicate exists a second time with the role hardcoded.** `app.is_admin_for(p_user_id)`
is `exists(… profiles where id = p_user_id and is_admin)` conjoined with
`(p_user_id is distinct from (select auth.uid()) or app.active_role() is not distinct from
'platform_admin')` — structurally `entailed_grants`' asymmetry with `af.role_code` replaced by a
literal. Its own comment states the rule in words: *"A question about a THIRD PARTY is unchanged —
one principal's hat must never alter what the system concludes about another."*

## Problem

**F6 has two axes, and only one of them was ever named.**

| axis | what the catalog does | who settles it |
| --- | --- | --- |
| **subject** — does the hat apply to a question about a third party? | **No**, asymmetrically: `p_principal is distinct from auth.uid()` short-circuits the hat term | **R8** (below) |
| **scope** — does the hat apply *at the seating it was assumed at*, or role-wide? | **Role-wide.** `hat_ok` compares `af.role_code is not distinct from app.active_role()` — a role term with **no scope term at all** | **R10** (below) |

The scope axis is where the mismatch lives, and it is a mismatch **against the audit trail**, not
against the resolver. `public.assume_role`'s non-`platform_admin` branch selects **one** membership
— `order by m.granted_at desc nulls last, m.id limit 1`, deterministic but semantically arbitrary
(most recently granted, tie-broken by surrogate id) — and stamps *that one* scope triple into
`app.audit_write('active_role.assumed', …, v_commission, …, v_org, v_hospital)`. Meanwhile
`app.active_role_selections` stores exactly `(session_id, user_id, role, chosen_at)` — **four
columns, no scope column**. So the selection is role-wide *by storage*, the resolver is role-wide
*by predicate*, and the audit row names **one seating out of however many the principal holds**.

⛔ **Ratifying the subject axis does not fix that. It ratifies it.** ADR 0176 D8's own wording makes
settling it mandatory rather than optional — *"F6 exact-assignment active context vs the role-wide
hat (**audit scope must match whichever wins**)"* (`0176:148-150`) — and the half that "must match"
is discharged by R10, never by R8.

**And three open questions turn out to be the same question wearing the keying costume**, which is
why they share this ADR rather than three: whether the admin arms follow the *subject's* account
state (R3), whether a `platform_admin`'s hat may write another tenant's Class-2 identity content
(R4), and which of two contradictory readings of A35 survives in the tree (R5). Each is *"about
whom does this arm answer, and under what hat"*.

## Decision

**D1 (PO ruling R8) — RATIFY the subject-keyed asymmetry the catalog already implements.** A
question about a **third party ignores the hat**; a question about the **caller requires it**.
Ratification of enforced behaviour, not new design — the alternatives each change a live resolver
with **three** `hat_ok` consumers. The asymmetry becomes the **model** the AE5 template is written
against, rather than a comment carried verbatim from AE4.4b.

**D2 (PO ruling R10) — on the scope axis, the audit stamp logs the ROLE ONLY, no place.** The
`active_role.assumed` row carries **no scope columns** for a tenant role, matching what
`platform_admin` already does by its own carve-out. Three reasons, in the order they bind:

1. **It matches the storage.** `app.active_role_selections` has no scope column; a stamped place
   describes a fact the system does not retain.
2. **Each later action already logs its own place.** `app.audit_write` takes org / hospital /
   commission on every call, so the seating an action *actually used* is on that action's row.
3. **It avoids a staleness trap.** A footprint recorded at assume-time is a **snapshot**; a grant
   made mid-session invalidates it while `hat_ok` — comparing `role_code` only — happily admits the
   new seating. The audit row would then assert a scope the resolver had already outgrown.

⚠ **Tenant roles only.** For `platform_admin` there is no scope to stamp — the branch's own comment
says *"No tenant to stamp — v_org/v_hospital/v_commission stay NULL (the ruling's own carve-out)"* —
so a fix that assumes every branch has a scope is wrong. Implementation ⇒ **Batch 10**; its expected
reds are enumerated in § Consequences, and two of them assert a **non-NULL** scope today.

**D3 — ADR 0200's keying obligation becomes a TEMPLATE CLAUSE with the two axes separated.** ADR
0193 D5 required a DEFINER/policy split be *"declared as data … not described in prose — and the
AE5 template inherits that obligation"*; ADR 0200 extended it to **keying**. This ADR states the
form the template must satisfy, per arm:

> For **every** arm the per-role template pairs, it declares two facts: **(a) the subject** — does
> this arm answer about the **caller** (`auth.uid()`, no parameter) or about the **subject** the
> signature names (`p_uid`)? and **(b) the hat** — is a matching `active_role` **required** for
> this arm to fire? ⛔ A caller-keyed arm is never placed beside a `p_uid`-keyed one in a single
> disjunction, and an arm whose (b) differs from its siblings' is declared, never inferred.

(b) is not optional because `app.is_admin_for` and `authz.entailed_grants` both make the hat
requirement **conditional on (a)** — an arm's hat behaviour is not a property of the arm alone. A
differential whose two sides answer about different principals is not a differential, and neither
is one whose two sides disagree on whether a hat is required.

**D4 (PO rulings R3 + R12) — platform-admin authority FOLLOWS ACCOUNT STATE, and ALL THREE SITES
are gated: both admin predicates AND the door that mints the hat.** Measured, comment-stripped, with a discriminating control in the same query: `app.is_admin`
**f** · `app.is_admin_for` **f** · `public.assume_role` **f** — against `app.is_org_admin_of_for`
**t**, which resolves `app.is_active(p_user_id)`. So arm 2 of the professional predicates follows
the subject's state and the admin arms never have.

⛔ **The follow-up's clause named the wrong predicate, and closing on it as written would have
gated the harmless one.** Blast radius re-derived at this head, counts **and** sets:

| predicate | RLS policies (`qual`/`with_check`) | real callers (call-shaped, comment-stripped) |
| --- | --- | --- |
| `app.is_admin_for` | **0** | **5** — `app.can_manage_professional`, `app.can_read_professional_profile`, `app.grant_role_impl`, `app.recover_orphan_person_to_org_impl`, `app.revoke_role_impl` |
| `app.is_admin()` | **26** | **13** |

⇒ Batch 10 owes the `is_active` term on **all three sites** — `app.is_admin()`, `app.is_admin_for()`
and `public.assume_role` (the third by R12, below) — each with its **own** pgTAP cell that
deactivates a `platform_admin` and asserts that site denies, **every one reported RED before the
change**. ⛔ One cell over one site does not discharge three.

⚠ **The gap is not bounded by token expiry.** `app.active_role()` is a bare claim read
(`request.jwt.claims ->> 'active_role'`) and `assume_role`'s `platform_admin` branch tests only
`profiles.is_admin`, so a deactivated or suspended admin can seat a **fresh** hat. Anyone reasoning
*"the hat expires, so the exposure is one token lifetime"* is reasoning from a refuted premise.

⭐ **`public.assume_role` — the NAMED THIRD SITE — IS RULED IN, by PO ruling R12 (2026-09-10), and
it travelled here as unruled.** ⛔ The superseded wording is quoted rather than overwritten, because
Batch 10 derives its `is_active` scope from this paragraph and the draft said the opposite: *"⚠
`public.assume_role` is a NAMED THIRD SITE and is deliberately left UNRULED here. … Whether the door
that mints the hat should also test account state is a distinct question, put with the rest of Batch
10's shape."* **R12 closed it in the same direction as R3 and in the SAME Batch 10 change**, with
its own RED-first pgTAP cell.

**The recorded rationale is the reason it could not stay open:** gating the two *checks* while
leaving the *seating* door ungated would make the fix **read** as complete while a deactivated admin
could still put the hat on. ⇒ Batch 10's `is_active` scope is **three** sites, not the two R3 named,
and *"both admin predicates"* is no longer a complete statement of it anywhere in this corpus.

Measured, so the third site is not carried on the ruling's word alone: `public.assume_role`'s
`platform_admin` branch tests only `exists(select 1 from public.profiles where id = v_uid and
is_admin = true)`; its comment-stripped body carries **no** `is_active` term (the same query and the
same control as above — `app.is_org_admin_of_for` **t**); and its only other gate is
`authz.roles.session_selectable`. ⇒ the mint consults **no** account state at all, which is the
same measurement the token-expiry premise above is refuted by, read from the third site's side.

> ⚠ **Amended 2026-09-10 at Batch 10's build (PO ruling R1 of unit `ADMIN-ARM-IS-ACTIVE`) — the
> third site's gate is DOOR-WIDE, a DECLARED WIDENING of R12.** R12's words gate `public.assume_role`
> reasoning about the admin hat; the build put one `app.is_active(v_uid)` check before **any** seating,
> every tier, after the `session_selectable` check. Measured before ruling: zero expected reds (no
> pgTAP file seats a deactivated principal), and every tenant predicate already carries `is_active`,
> so the widening removes a pointless seating and its audit row, never an ability. The alternative —
> gating the `platform_admin` branch only — would reproduce inside one body the shape R12 was taken
> to remove: a door that *reads* gated. Its hat-blind allowlist reason survives on re-derivation
> (account state is not a hat/grant read) and carries a dated paragraph, not an inherited one.

**D5 (PO ruling R4) — the Class-2 write arm is REMOVED and RELOCATED, not deleted.** A35's
**"identity"** noun is the **user directory**; a tenant's **professional registry** is Class-2
**tenant** content. `platform_admin` **reads** it (A35 ruling 3, unchanged — *"audited reads, a
product decision"*) and never **writes** it. Batch 10 owes, in this order:

1. `app.can_manage_professional` → `select p_uid is not null and app.is_org_admin_of_for(p_org, p_uid)`.
2. `app.can_manage_case_vocabulary` gains an **explicit** `app.is_admin_for(p_uid)` arm —
   declared, answer-preserving. ⚠ Not tidying: the PO's own rolled-back run proved a **bare removal
   strands vocabulary** (`42501 "sem autorização para gerenciar o catálogo"`), and vocabulary is an
   A35 **MAY**-noun. Its live body today is
   `can_manage_professional(p_org, p_uid) or is_org_commission_staff_admin(p_org, p_uid)` — so the
   platform reach it has is **inherited**, and removing arm 1 upstream removes it silently.
3. **No** platform arm on `app.can_create_professional` or `app.can_manage_external_participant`
   ⇒ `platform_admin` **loses professional create and external-participant mint**. ⛔ A behaviour
   change beyond the follow-up's clause, stated in its own sentence rather than arriving as a
   surprise red.

**The door surface is 14 in the closure and 12 behaviourally affected, and one number is wrong
whichever you pick.** Re-derived from `pg_proc`, comment-stripped, call-shaped — all 14 are
`prosecdef = t` with EXECUTE to `authenticated`:

| reached through | doors | n |
| --- | --- | --- |
| direct | `update_professional_profile`, `redact_professional_profile`, `set_professional_link_state` | 3 |
| `app.can_create_professional` | `create_professional_profile`, `ensure_professional_participant` | 2 |
| `app.can_manage_case_vocabulary` | create/archive × {`case_assignment_role`, `ethics_allegation_category`, `ethics_sanction_type`} | 6 |
| `app.can_manage_external_participant` | `create_external_participant` | 1 |
| `app.can_read_professional_profile` | `get_case_professional`, `log_audit_access` (via `app._audit_access_authorized`'s `'professional_profile.read'` arm) | 2 |

⇒ **14 in the closure, 12 affected.** The last two are unaffected because
`app.can_read_professional_profile` carries its **own** `is_admin_for` short-circuit that returns
**before** it reaches `can_manage_professional` — measured by position in the comment-stripped body,
`is_admin_for` at **115**, `can_manage_professional` at **342**. *One set is not two questions.*

> ⚠ **Measurement note, 2026-09-10 (Batch 10's plan, lead decision L1 — annotated, not edited):**
> re-measured at head pair `(20261003007380, 527)` the positions are **111** and **338**. The
> literals are **grain-dependent** (they move with the comment-stripping expression, which the plan
> quotes beside its figure); the **ordering** — `is_admin_for` returns before `can_manage_professional`
> is reached — is the only load-bearing fact and reproduces. Same discipline as the `entailed_grants`
> numerals: a position quoted without its expression is not reproducible, and is not thereby wrong.

⛔ **The reason Option 2 (the narrowest variant) is rejected is NOT the one first stated, and the
correction matters more than the conclusion.** `public.ensure_professional_participant` does **not**
write `public.case_participants`: measured, `(insert|update|delete)[^;]*case_participants` over its
comment-stripped body is **false**, while the controls in the same query are **true** — the string
`case_participants` *is* present (once, inside `app.assert_case_participants_enabled`, a
feature-flag assertion) and it *does* `insert into public.participants`. The seating door is
`public.add_case_participant`, gated by `app.is_staff_admin_of(commission_id)`, and it does not name
`can_create_professional` at all. **The surviving reason** is a different fact on the same noun-rule
ground: the mint inserts a `public.participants` row carrying
`sensitivity_class = 'professional_identity'` and `display_name = v_prof.full_name` — **the real
name** (ADR 0091 D1; the `participants_sensitivity_derives_type` trigger forces the class) — so
under Option 2 a `platform_admin` could still **create Class-2 professional identity content in any
tenant's org registry**. Org-scoped Class-2 **creation**, not commission content.

⭐ **The refuted reason is WITHDRAWN, and R4 was REAFFIRMED after the refutation was disclosed — the
provenance matters more than the verdict, so the sequence is recorded rather than summarized.** R4
was taken 2026-09-09 on the stated reason; the lead measured that reason **false** and reported it to
the PO in plain terms (⛔ not as a footnote); the PO **did not reverse R4** and went on to rule
R5–R14. Under this corpus's reaffirmation rule that is a decision, not a silence. ⇒ three facts, and
each one is load-bearing for Batch 10:

1. The *"`ensure_professional_participant` … seats a professional INTO A CASE — commission
   content"* reason is **WITHDRAWN**. ⛔ It must never be restated as live: writing a refuted reason
   into an accepted ADR would put a false sentence at the top of the authority chain, which is
   precisely the `409` § 3.7 failure D6 below is retiring.
2. **R4 stands on the SURVIVING reason** — the real-name `participants` row above. The conclusion
   never rested on the seating claim; that is why this is a correction and not a reversal.
3. The question *"is the surviving reason **sufficient**?"* is **CLOSED** — by reaffirmation, ⛔ not
   by a fresh ruling and ⛔ not by the drafter. This ADR is therefore not permitted to record it as
   open anywhere, and the two places its draft did are corrected (§ Considered options, and § *What
   this ADR does not do*).

**D6 (PO ruling R5) — `409` § 3.7's first clause is SUPERSEDED; A30's bucket-C reading wins.** Two
contradictory readings of A35 are live in the tree verbatim, and leaving both is how the next reader
gets an all-clear from whichever they open. Quoted from a `sed -n '679,683p'` read of
`supabase/tests/409_ae49_d6_rekey_differential.sql` — ⛔ **not** from a grep, because the sentence
spans a SQL string-literal concatenation at `:681-682` and a grep for the **prose** sentence
`"mutation. Professional IDENTITY is inside"` returns **0** while `"LEGACY EQUIVALENCE"` returns
**9** in the same file:

> `'3.7 ⭐ LEGACY EQUIVALENCE, second preserved principal: the PLATFORM_ADMIN arm (`app.is_admin()`, '`
> `'which also requires the platform_admin hat) still passes under the same mutation. Professional '`
> `'IDENTITY is inside platform_admin''s noun (ADR 0078 A35); commission CONTENT is not, which is '`
> `'why §2 has no platform_admin twin — `is_tenancy_admin_of` carries no such arm and must not.');`

**Superseded: the first clause only** — *"Professional IDENTITY is inside platform_admin's noun
(ADR 0078 A35)"*. ⛔ **The second clause is TRUE under D5 and must survive** — *"commission CONTENT
is not, which is why §2 has no platform_admin twin — `is_tenancy_admin_of` carries no such arm and
must not."* The winning reading is `docs/progress/authz-a30-platform-admin-inventory.md:172`, which
puts **this same predicate** in **bucket C** — *"writes Class-2 professional records cross-tenant"*
— and had deferred it as *"a product decision, not a safety necessity"*. That deferral is what R4
discharges. ⚠ **Cited for its classification of this predicate, not wholesale:** the same bucket-C
table names `dispose_attachment_phi` among five disposal doors, and that function **does not exist
in the live catalog in any schema** — there are **4** (`dispose_case_phi`, `dispose_event_phi`,
`dispose_meeting_minutes`, `dispose_referral_phi`). The outlier finding beside it survives; the
count does not.

⚠ **A second defect in the same message, found while quoting it:** the clause names the arm
`app.is_admin()`, but since ADR 0200 the chain `create_professional_profile` →
`can_create_professional` → `can_manage_professional` reaches **`app.is_admin_for`**, and
`create_professional_profile`'s comment-stripped body does not contain `app.is_admin()` at all
(measured, with `can_create_professional(` present as the control). So the cell's message is stale
on **two** counts, and the rewrite Batch 10 owes is not a polarity flip alone.

## Considered options

**For F6's subject axis.** ADR 0176 D8 lists two; the catalog implements a third.

| | Option | Verdict |
| --- | --- | --- |
| (i) | **Subject-keyed asymmetry** — third-party ignores the hat, self requires it | ✅ **CHOSEN (R8).** It is what runs, it is what `401` §§ 16.8–16.11 and `415 § 1.2` already assert, and ratifying it costs no migration. |
| (ii) | **Exact-assignment active context** — the hat must match the *seating* the question is asked at | ⛔ Rejected. The implementation audit's recommendation, and the only option that would *fix* the scope mismatch — but it changes a live resolver with three consumers, it has **no storage** (`active_role_selections` holds no scope column, so the seating would have to be invented and persisted), and it is a behaviour change riding inside the batch whose job is to make the **template** safe. |
| (iii) | **Uniform apply, or uniform never-apply** | ⛔ Rejected, and the catalog's own comment says why: *"Neither uniform choice is correct."* Uniform-apply breaks every third-party `_for` question; never-apply drops the gate at every self-check. |

**For F6's scope axis** — given (i) is ratified and the resolver stays role-wide:

| | Option | Verdict |
| --- | --- | --- |
| (a) | **Stamp no place** — role only | ✅ **CHOSEN (R10).** Matches the storage; the place of each later action is on that action's own row; immune to the mid-session-grant staleness trap. |
| (b) | **Stamp the arbitrary seating** (status quo) | ⛔ Rejected. `order by granted_at desc nulls last, id limit 1` is deterministic and semantically arbitrary; the row asserts a scope the resolver never consulted. |
| (c) | **Stamp every seating the role reaches** | ⛔ Rejected here as a *cost without a consumer*: it is the only option that faithfully describes role-wide authority, but it makes one assume-role emit N audit rows, and nothing reads them. Reconsider only if (ii) is ever adopted. |

**For the Class-2 write arm.** **1 — keep the arm, record the exception:** ⛔ rejected on the merits
by R4 (A35's identity noun is the user directory, not a tenant's registry). **2 — remove arm 1 from
`can_manage_professional` only:** ⛔ rejected on D5's *surviving* reason, org-scoped Class-2
**creation** through `ensure_professional_participant`'s real-name `participants` row. ✅ **The
sufficiency question is CLOSED (2026-09-10 — see D5).** Its draft read *"⚠ whether that reason is
sufficient is the PO's call, travelled with this draft, and ⛔ is not the drafter's to decide"* —
correct when written; the call was then made, by **reaffirmation**: the refutation of the originally
stated reason was disclosed to the PO in plain terms, the PO did not reverse R4 and went on to rule
R5–R14. **3 — remove and RELOCATE**, vocabulary's reach re-declared as its own explicit arm:
✅ **CHOSEN (R4)** — and the relocation half was *measured*, not assumed: the PO's rolled-back run
proved the bare removal strands vocabulary and that the explicit arm restores it *while redaction
stays denied*.

## Consequences

**⛔ Batch 10's expected reds are RE-RULED, never silenced.** Each is a cell whose *stated reason*
changes, so each needs a rewritten message and not a flipped polarity:

| cell | today | after |
| --- | --- | --- |
| `228:630-634` | `lives_ok(update_professional_profile)` under a `platform_admin` hat, labelled a **POSITIVE TWIN** for matrix row 30 | `throws_ok 42501` |
| `409 § 3.7` (`:679-683`) | `lives_ok(create_professional_profile)` + the A35 clause D6 supersedes + the stale `app.is_admin()` naming | denial, **and both message defects fixed** |
| `415 § 1.2` (`:159-166`) | asserts **TRUE** — a `staff_admin` asking about the `platform_admin` subject | flips; ⛔ § 1.1 (over-grant, asserts FALSE) and the arm-2 cells **stay** |
| `229:215-220` **M1·1 FREEZE TWIN ⭐⭐** | `throws_ok HC0F2` — the B7 freeze survives even a `platform_admin` | flips to `42501` at the authority check **before** the trigger fires ⇒ reds *in a way that reads as if the freeze had broken*. Per A33's ordering the cell **splits in two**: `org_admin` proves the freeze, `platform_admin` proves the authority deny |

⛔ `401` and `410` are **NOT** on that list, and the mechanism is worth stating precisely because a
reader checking it will find arm 1's predicate in the manifest and think otherwise.
`pendingRekey.layer1Gate = "app.can_manage_professional"` sits on exactly **one** row —
`org.professionals.manage`, which carries `enforcementSites: []` **and** `domainAuthorizer: null`,
so nothing behavioural hangs on it. The **two** `residualLegacyAuthority` entries naming that gate
(`org.professionals.create`, `org.professionals.read`) both describe the population as *"the
org-manager arm"* — **arm 2** — which stays accurate after D5 narrows the predicate to exactly that
arm. ⚠ `org.professionals.read` *also* declares a **separate** residual entry whose gate **is**
`app.is_admin_for` (*"platform_admin, via profiles.is_admin — a role-free superuser arm"*), and that
one **survives D5 untouched**, because D5 changes `can_manage_professional` and
`can_manage_case_vocabulary` only — `app.can_read_professional_profile`'s own `is_admin_for`
short-circuit is not in scope. And since no *authorizer body* changes which gates it calls, the
generator's `composedWith` cross-check does not move either. ⇒ an optional note only.

**⚠ R12 invalidates a REASON, not a finding, in the door sweep's `hat` arm.** That arm reports
`HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted`, and one of the four is
`public.assume_role` — allowlisted with a reason **derived before R12 ruled it in scope**. ⇒ Batch 10
must **re-derive** that reason against the post-change body rather than inherit it: an allowlist
entry whose reason predates a change to its own subject is the *"reasoned"* half of
*"reasoned-allowlisted"* going stale in silence. ⛔ It is **not** a finding today — the arm holds at
this tip, rc 0 — which is exactly why it needs a home that is not a gate log.

**⭐ R10 has its OWN expected reds, and the rulings that produced it did not name them.** Derived
here: `supabase/tests/315_act_stage3_hat_condition.sql` carries **four** live assertions on the
`active_role.assumed` row's scope columns — and it is the **only** file that does (`grep -rln` over
`supabase/tests/`; the sole other hit is the `act-hat-blind` mutation allowlist, prose):

| cell | asserts | under R10 |
| --- | --- | --- |
| `315:203-208` | `organization_id` = the assumed `org_admin`'s own org, *"not the platform bucket"* | ⛔ **FLIPS** — a non-NULL assertion |
| `315:209-212` | `hospital_id`/`commission_id` stay NULL for an org-tier hat | stays green — **and that is the problem, see below** |
| `315:226-230` | `commission_id` = the assumed `staff_admin`'s own commission, written *"to prove the fix isn't org-only"* | ⛔ **FLIPS** — a non-NULL assertion |
| `315:246-249` | all three NULL for `platform_admin` | stays green; this is D2's carve-out, unchanged |

⛔ **R10 CREATES a vacuity, and it must be ruled rather than absorbed.** `:212` survives green — but
its discriminating power was supplied entirely by `:208`, the cell that flips. Alone, `:212` can no
longer tell *"an org-tier hat stamps the org and nothing below it"* from *"nothing is stamped at
all"*: it is satisfied by the new behaviour for a reason unrelated to the one it states. Batch 10
therefore owes `:212` a **rewritten message or a replacement discrimination twin**, not a green
tick — this is the LEARN "keystone that could not fail" shape arriving as a *side effect of a
correct change*, which is the hardest polarity to notice.

**⭐ WHAT WATCHES EACH RATIFIED FACT, stated in the sentence that states the fact** (ADR 0195).

- **The subject axis IS gated.** `401`'s own § header says so at `:940-941` — *"§§16.1-16.7 use
  THIRD-PARTY checks … Gate 4 is §§16.8-16.11"* — § 16.11 being *"THE ASYMMETRY ITSELF"*, and
  `415 § 1.2` pins the `_for` half behaviourally (*"the platform_admin hat is required only when the
  subject IS the caller"*). The `act-hat-blind` mutation allowlist records that those cells *"pin
  all three §6A cases through `authz.has_permission`, which is COVERED by the door sweep"*, and
  anchors `authz.holds_role`'s hat conjunct on every run. ⇒ D1 ratifies something already asserted.
- **The scope axis is gated by NOTHING**, and nothing cheap can gate it: *"`hat_ok` carries no scope
  term"* is a property of an **absent** clause. D2 is what makes it a decision instead of a silence.
- ⛔ **`entailed_grants`' own two numerals reproduce at NO grain measured here** — *"the 27 `_for`
  sites"* and *"the 151 self-check sites"*, repeated verbatim at `401:1111-1112`, so **two homes**.
  Eleven grains tried: `_for`-named functions `app` **18** / all three schemas **37**; bodies
  calling a `_for` helper **104** (`app` **69**); policies **2**; occurrences not functions **141** /
  **178**; distinct `_for` callees **18**. For the self-check figure, bodies naming `auth.uid()`:
  `app` **43**, `public` **244**, `authz` **2**, all three **289**; the `(select auth.uid())` form
  **57**; policies **184**; occurrences in `app` **53**. **None is 27, 150 or 151.** These are
  grain-less historical figures, and ⛔ **no gate in `npm run lint` can hold a live-catalog count**
  (the chain has no Docker) — a pgTAP mirror would buy *"the next Phase Gate noticed"*, never
  *"the next commit noticed"*, and **this ADR delivers neither**. Batch 10 either gives the comment
  a grain plus a pgTAP mirror or deletes both numerals; ⛔ it must not restate them.

**The template clause AE5 inherits is now three obligations deep**, and increment 1 needs all three
before its first arm is written: ADR 0193 D5 (declare the DEFINER/policy split **as data**), ADR
0200 (declare the **subject** of every arm), D3 above (declare the **hat requirement** of every arm,
and never pair arms that disagree on either). ⚠ A worked instance exists to copy from —
`app.can_manage_professional`'s live header comment states its own keying *and* its own template
obligation, which is where increment 1 should look first.

**What this ADR does not do.**

- It does not change one line of SQL. Batch 9 is **not a fix** by PO ruling R1: the assertion
  `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` is **empty**, verified
  on this branch. Every migration named above is **Batch 10's**.
- ⚠ **This bullet is CORRECTED, 2026-09-10 (QA finding BLOCK-2), and its draft is quoted because
  three surfaces in this tree said the same thing.** It read: *"It does not rule
  `public.assume_role`'s `is_active` term (D4's named third site), nor whether D5's surviving
  Option-2 reason is **sufficient**."* **Both are now ruled** — `public.assume_role` by **PO ruling
  R12** (D4: **three** sites, each with its own RED-first cell) and D5's sufficiency by
  **reaffirmation** after the refutation was disclosed (D5). ⇒ whoever opens Batch 10 takes its
  `is_active` scope from **D4 as it now stands**, and ⛔ not from any surface still saying *"both
  admin predicates"* or *"a third site, not in scope here"*.
- It does not discharge **ADR 0175 D3**. ⛔ Read precisely, `0175:130-131` is a **forward promise**,
  not a completion claim — *"the arm-3 cells **arrive** already enumerated and already known to
  diverge"* — and the enumeration is measurably absent:
  `supabase/tests/vectors/authz_differential_cells.psql` holds **216** `org.professionals.read` rows
  and **0** occurrences of `divergent`. Routed to unit **`AE5-MATRIX-ARM3-CELLS`** (PO ruling R9),
  due before AE5 increment 1 runs its **matrix** — ⛔ not before its template is written.
- It does not touch the classification columns, `authz.roles`' `administrativo` row, the
  `platform_role` retirement or F7 — and by PO ruling R7 those four split across **two** homes, ⛔
  which this bullet's draft left un-paired: the **classification columns** are ADR
  [0203](./0203-the-seam-is-already-encoded-the-classification-columns-are-not.md) (ruled there by
  R11); the `administrativo` row, the `platform_role` retirement and **F7** are the **next unit's**,
  and 0203 covers none of the three. ⚠ Do not read *"ADR 0203 and the next unit"* as though either
  home could be the one you happened to open.
