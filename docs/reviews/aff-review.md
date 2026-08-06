# QA review — AFF (hospital affiliation, person identity & the org people directory)

**Reviewer:** `qa` · **Date:** 2026-08-06 · **Branch:** `feat/hospital-affiliation-person-identity`
**Round 1:** 13 commits `d446153`…`cc66483` vs `main` · **Round 2:** the remediation delta
`86ce0d1`…`5b4b1df`
**Contract:** ADR [0097](../decisions/0097-hospital-affiliation-person-identity.md) D1–D19 ·
ADR [0098](../decisions/0098-aff-w1-substrate-shape-decisions.md) ·
ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 5 ·
[the plan](../plans/hospital-affiliation-person-identity.md) W1–W3 ·
[the external audit](./aff-adr-0097-external-audit.md) · PROGRESS.md → AFF block.

## Verdict

# ✅ APPROVED (final, round 2 — `5b4b1df`)

**Round 1 APPROVED `86ce0d1`** with F1–F7 open and the verdict explicitly scoped to that. All
seven were then remediated in four commits, and **round 2 re-reviewed that delta** — including
three regenerated `SECURITY DEFINER` kernels that went in after sign-off. **The delta
introduced no defect.** Full analysis in §8; the round-1 body below is unchanged, and its
findings are marked closed there.

Round 2 raises **one new MINOR (N1)** and carries **one MINOR forward (N2)**. Neither blocks;
both are one assertion each.

---

## Verdict (round 1, superseded — retained for the audit trail)

# ✅ APPROVED — with six required follow-ups (F1–F4, F6, MINOR F5)

Reviewed in two passes: **PASS 1** (requirements, code, migration/test source, ADR-vs-code
consistency) while the `e2e:prod` gate held the database, and **PASS 2** (live catalog) after
it cleared. **All six parked claims were resolved against the live catalog — none was
substituted with migration file text.** Every one came back favourable, including the two that
could have been blockers (P1 and P2, either of which would have made a shipped gate silently
inert). Results in §5.

**Nothing here is a blocking defect.** No RLS hole; no immutability hole; no unmet ADR 0097
deliverable or acceptance bullet; no service-role key reachable client-side; no PHI crossing
into or out of the three Class-1 modules; the `submit_response`/door posture is respected and
the affiliation doors are the sole write path, catalog-confirmed. The findings below are one
live copy violation and a set of gaps between *tested* and *provable* — real, worth fixing,
and not worth manufacturing into a blocker.

**Gate:** `e2e:prod` **GREEN** — 982 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run ·
16 batches, no gaps · 0 `reset FAILED` · 984/989 accounted (the 5 is the deliberate-skip
baseline, matching the prior gate's 965/970). Both flakes are batch 12 and non-AFF
(`phase16-accreditation-core` AC-4, a cross-clock `occurred_at >= markerT0` assertion
comparing DB time to host JS time, plus a `phase2-auth-shell` logout timing test). AFF touches
no shared audit path, but the prior gate reported 0 flaky, so AFF's larger seed and suite
plausibly **exposed** AC-4 rather than caused it; `tester` is making it hermetic
(`e2e/phase16-accreditation-core.spec.ts`, in flight at the time of writing). I accept that
reading — a load-sensitive assertion that passes 7/7 in isolation and 67/67 in its exact batch
composition is not evidence of an AFF defect.

### ⚠ What I re-verified after the fixes, and what I did not

Stated plainly, because a verdict that silently assumes a fix landed is the failure this
project keeps catching. **As of my HEAD (`d09d274`), NONE of F1–F4, F6 or the F5 MINOR has
been fixed.** I re-checked each at the source immediately before signing:

| | status at sign-off | how I checked |
| --- | --- | --- |
| F1 `" — no hospital"` | ❌ **still present** | `affiliations-panel.tsx:264`, grep |
| F2 named-condition arms | ❌ **still absent** | no `check_violation` and no `'23514'` in `src/lib/affiliations/actions.ts` |
| F3, F4, F6, F5 | ❌ **not yet addressed** | no commit touches them; working tree carries only `e2e/phase16-accreditation-core.spec.ts` (the tester's unrelated hermeticity fix) |

**This APPROVED verdict is therefore given on the code as it stands, with F1–F6 open and
accepted as non-blocking — not on the assumption that the dispatched fixes landed.** The
remediation now in flight in `src/components/**` and `e2e/**` is **outside** what I reviewed;
I did not review teammates' in-flight state and this verdict makes no claim about it. If any
fix changes behaviour beyond the itemised text/arm/assertion changes described in F1–F6, it
wants a look before merge.

**One PASS-1 correction, from the catalog:** F3 gained a sub-finding (F3b) and the external
audit's LOW-1 mitigation claim turns out to be only half true. Details in F3.

**Verified independently by the lead before acting:** F1, F2 (both spellings checked in
`toState`), and the F5 `inviteStaff` MINOR. Recorded here because independent confirmation of
a finding is worth as much as the finding.

---

## 1. Findings — MEDIUM

> ✅ **F1–F7 are ALL CLOSED as of round 2** (`86ce0d1`…`5b4b1df`) — see §8.6 for what closed
> each and how I re-verified it. §§1–7 below are the round-1 text, left **exactly as written**
> so the finding and its evidence stay legible next to the fix. Line numbers in §§1–7 refer to
> the pre-fix tree.

### F1 — Rule 10 violation, user-visible: an English string in the pt-BR blockers alert ✅ CLOSED

`src/components/users/affiliations-panel.tsx:264`

```tsx
{b.commission ? ` — ${b.commission}` : " — no hospital"}
```

Rendered inside the `role="alert"` blockers `<ul>` when `end_affiliation` refuses with `HC0R1`
and the blocking seat is **hospital-tier** (`technical_director`, `hospital_admin`,
`nsp_coordinator`, …) — i.e. exactly the arm audit MEDIUM-3 was raised to add. Every other
string in the file is pt-BR. Violates CLAUDE.md Rule 10 / §8.

**Why it survived:** no E2E exercises the HC0R1 blockers list. The AFF spec covers outcomes
A/B/C, D2, the negative visibility arm, `HC0R4` and the matrícula edit — but there is no test
that attempts to end an affiliation held by a seated person and reads the rendered blockers.
The one branch that renders this literal is unreachable from every existing test. Fixing the
string without adding that arm leaves the next one equally invisible.

### F2 — the SQL↔TS error-arm drift detector's boundary is a SYNTAX, not the property

`src/lib/affiliations/door-error-arms.test.ts:49` and `supabase/tests/304_affiliation_lifecycle.sql:213`
both enumerate with `errcode = '([A-Z0-9]{5})'`.

Both affiliation kernels raise a **named condition**, not a 5-character literal:

`supabase/migrations/20260909000500_affiliation_doors.sql:53` and `:129`
```sql
raise exception 'hospital inexistente' using errcode = 'check_violation';
```

`check_violation` (23514) is invisible to both halves of the contract, has no arm in
`toState` (`src/lib/affiliations/actions.ts:83-107`), and therefore renders as
*"Não foi possível concluir. Tente novamente."* — a retry instruction for a condition retrying
cannot fix. **That is the exact defect `HC0R4` was, in the same file, undetected by the
detector built to catch it.**

To the question asked: the detector **is** proven able to find something — it carries a
filename-existence control (`:55-61`), a non-vacuity control (`:63-67`, `size > 3` + must
contain `HC0R4`), and an anti-decoration control (`:83-97`, no arm may map to `generic`); and
`304` §6.1 is an exact-set **equality**, so a new 5-character code reds both halves. Its
blindness is confined to the named-condition class — but that class is present, today, in its
own inputs. Recorded lesson: *an enumeration's boundary must be the property, not a syntax.*

**Actionable fix:** widen both regexes to also match `errcode = '<lowercase_identifier>'` and
map each named condition to its SQLSTATE (or replace the two raises with `'23514'` literals).

### F3 — Rule 11: `affiliation.created` and `affiliation.ended` have no keystone

Repo-wide, the only audit-action assertions for this table are:

| arm | assertion | |
| --- | --- | --- |
| `affiliation.updated` | `304` §2.6 | ✅ |
| `affiliation.deleted` | `302` §7.4 | ✅ |
| `affiliation.created` | — | ❌ none |
| `affiliation.ended`   | — | ❌ none |

The two rare arms are keystoned; the two that fire on every real HR action are not. `302` §3.6
asserts the `ended_by` **column**, which is a different property (the row, not the audit trail).

This matters more than the usual coverage gap because `app.trg_audit_hospital_affiliations`
was **rebuilt** — `20260909001100_update_affiliation_door.sql:153-175` re-issues the whole
function body to add the `.updated` arm. That is the recorded *"a rebuild silently loses
properties the original carried"* shape, and the omission would have no line in the diff.

**PASS 2 result: all four arms survived the rebuild.** The live `prosrc` carries
`affiliation.created`, `.deleted`, `.ended`, `.updated`; `guard_affiliation_no_delete_trg` is
`tgenabled = 'O'` and `trg_audit_hospital_affiliations` is `'A'`, exactly as ADR 0098 §W2.3
designed. So F3 is purely a coverage finding — the arms are correct **today**, and nothing
would tell you about the next rebuild.

### F3b — service-path affiliation audit rows are UNATTRIBUTED (found in PASS 2)

`app.audit_write` takes **no actor parameter** — catalog signature:

```
p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text,
p_metadata jsonb DEFAULT '{}', p_organization uuid DEFAULT NULL, p_hospital uuid DEFAULT NULL
```

and derives the actor internally as `v_actor uuid := auth.uid()`. The affiliation trigger
calls it with eight positional arguments and no actor (`20260909000500:346-353`).

Consequence on the path that creates **most** affiliations: `registerUser` runs on the
service-role client, passes an explicit `p_actor` to `affiliate_person_for`, the kernel writes
that actor to the row's `created_by` — and then the audit row records `actor_id = NULL`,
because `auth.uid()` is null there. The actor is known, deliberately threaded through the
kernel, and dropped by the audit layer. Rule 11 requires *that* **and** *who*.

Live: all 5 `affiliation.created` rows carry `actor_id` NULL, while all 4 `person.cpf_lookup`
rows name theirs — the latter being exactly why `list_org_people` was put on the cookie client
(`src/lib/queries/affiliations.ts:156-159`). That contrast is the mechanism, visible.

**Calibration — this is NOT AFF-introduced, and I am not charging it to this workstream.** The
pattern is platform-wide and pre-existing: `membership.granted` 40 rows / 0 attributed,
`form.created` 8/0, `commission.created` 6/0, `signoff.recorded` 9/0. Every service-role or
seed writer on this platform produces unattributed audit rows, because `audit_write` has no
actor parameter to give one. AFF inherited the limitation; it did not create it. Belongs in
the follow-up log as an `_for`-aware audit path (`audit_write_for`, mirroring the door
convention), not against AFF.

**But it does correct a claim of record.** The external audit's **LOW-1** rests on *"Mitigation
already present: the audit trigger on `affiliation.created` names the actor"* — offered as the
compensating control for the deliberately-soft DENY keystone. That is **true on the interactive
path** (`affiliate_person` over the cookie client, which is what a hospital admin self-serving
an affiliation actually uses — the exact scenario LOW-1 describes) and **false on the
provisioning path**. LOW-1's mitigation holds where LOW-1 applies; the sentence is broader than
the truth. Worth one line in the ADR so the next auditor is not misled by it.

### F4 — the D11/LOW-2 compensating control does not cover the wider enumeration surface

D7/LOW-3 accepts a national-ID enumeration surface and names D11's audit row as the
compensating control. The control was built on the **narrower** of the two probes:

| probe | scope | distinguishable response | audited |
| --- | --- | --- | --- |
| `list_org_people(p_cpf)` — `20260909000600:71-93` | **org-scoped** (`home_organization_id = p_org_id`) | empty either way | ✅ `person.cpf_lookup`, actor + matched-or-not, no digits (`302` §5.9-5.11) |
| `registerUser`'s collision block — `src/lib/users/actions.ts:516-526` | **platform-wide**, no org filter | `fieldErrors.cpf` vs. proceeding — cleanly distinguishable | ❌ nothing |

The registration probe is side-effect-free (it runs before any account is created), reachable
by any org- or hospital-admin of **any** tenant, and answers "does this CPF exist anywhere on
the platform". That is strictly wider than the surface the audit row was added to compensate.
Same shape applies to the `23505` backstop at `:591-599`.

This is a **declared, PO-accepted risk class** (D7, audit LOW-3) — the finding is that its
stated mitigation is absent on the arm that carries the risk. Cheapest fix: emit the same
`person.cpf_lookup` row (matched-or-not, never the digits) from the `registerUser` probe.

Related consequence, not a defect, worth recording where the PO will see it: platform-wide
CPF uniqueness plus creation being open to any registrar means an admin of tenant X can
**burn** a CPF — register a person with a real professional's CPF and make that professional
unregisterable at tenant Y forever, with only an org_admin able to unwind it. Inherent to D7;
belongs beside FUP-AFF-2.

---

## 2. Findings — MINOR

**F5 — a load-bearing comment names a function that does not exist.**
`src/lib/members/actions.ts:98` states *"`inviteStaff` runs on the SERVICE-ROLE client
(bypasses RLS), so this TS check is the ONLY control there"*, and that sentence is the stated
justification for keeping `platform_admin` out of the mirror. **`inviteStaff` does not exist
anywhere in the repo** — a repo-wide grep returns exactly one hit: that comment. Repeated in
ADR 0098 §W3.7. The comment was *expanded* in `8155be2` (the BUG-AFF-1 fix), reproducing the
stale claim instead of checking it — the recorded *"a comment is an assertion that goes stale
silently"* class. No behavioural impact; the posture it defends is still correct, and (see
§3) it is correct for a **stronger** reason than the one given.

**F6 — the D14 keystone set is narrower than the D14 boundary.**
`src/lib/users/d14-person-level.test.ts` covers `updateUserProfile` (name/category/CPF),
`upsertCredential` and `deactivateUser`. `removeCredential` (`actions.ts:891`),
`reactivateUser` (`:1023`) and `suspendUser` (`:1047`) are correctly gated in source but have
**no** arm. Reverting any of the three to `authorizeForUser` reds nothing — three
`it.each` rows away from closed.

**F7 — the standing `profiles` grant consequence is prose, not an executable claim.**
*"Every new `profiles` column needs its own GRANT or it reads 42501"* is recorded in the
migration header (`20260909000200:25-29`), in ADR 0097 Consequences, and — best of the three —
on the object itself via `comment on table public.profiles` (`:126-127`), which a future
reader hits with `\d+`. That is genuinely the most discoverable non-executable place. But it
is still prose: `301` §6.3 reads four **named** columns, so a column added without a grant
fails at runtime and reds nothing. One assertion closes it: *every column of
`public.profiles` except `cpf` appears in `authenticated`'s SELECT column grants.*

**F8 — an ADR sentence with no code behind it.** D7 states *"the person's own account page
surfaces it via a server action"*. No such surface exists — `src/app/conta/**` has no CPF
page and no `getOwnCpf`-shaped action exists; `user-profile-edit-form.tsx:37-41` deliberately
makes CPF write-only even for an org_admin. Safe by omission (nothing leaks), but D7 asserts
a delivered capability that was not built. Either build it or amend the sentence.

**F9 — PROGRESS.md hygiene (three items).**
- Phase-status row (line 67) still reads **"▶ in progress (W1)"** while the task table (line
  120) has W1–W3 ✅ and T3.6 green. *(Lead-owned row.)*
- Decision Log (line 777) records D10's gate as `is_org_admin_of OR is_org_level_admin_within`
  — precisely what audit MEDIUM-5 **rejected** and what `20260909000600:53-67` does not do.
  A reader taking the Decision Log as the record gets the reversed decision.
- The **W2** gate record reports *"3 policies COVERED + 1 row-door COVERED, 0 BLIND, 0 ERROR"*
  with no disclaimer, while W2's own `20260909000500` added four `uuid`-returning doors the
  sweep cannot see. The FUP-AFF-1 disclaimer appears only in the W3 block — one paragraph
  below the "0 BLIND" it also applies to.

**F10 — unescaped LIKE metacharacters in the directory search.**
`20260909000600:120-122` interpolates `v_q` into `ilike '%' || v_q || '%'` without escaping
`%`/`_`. Org-scoped and capped at 500, so not a boundary issue; a user typing `%` matches
everyone. Cosmetic.

---

## 3. Answers to the specific questions asked

**1 — The `profiles` column-list grant conversion (T1.2 / HIGH-1).** Correct and both-armed
(`301` §6.1-6.4 pins deny *and* allow, with a non-vacuity control proving the reader sees
rows). Discoverability: see F7 — the table comment is the right place, but the claim is not
executable. **ADR 0098 §3's REFERENCES argument is SOUND.** `authenticated` holding no CREATE
on `public` does make the residual `REFERENCES (cpf)` inert, and `301` §0.9 pins that premise
executably rather than in prose — which is the right call, because it is the premise most
likely to change. Two further independent blocks the ADR does **not** claim and does not need:
PostgreSQL refuses a foreign key from a temp table to a permanent one ("constraints on
temporary tables may reference only temporary tables"), and `profiles_cpf_key` is a **partial**
unique index (`where cpf is not null`), which cannot be a foreign-key target at all. The
oracle is unbuildable three ways over.

**2 — The row-scoped affiliation leg (ADR 0098 §1).** Equivalent for the product; no promised
reach is lost. The literal principal-scoped phrasing would have been a policy on T reading T
(42P17) or a new `prosecdef` gate to census forever, and the substitute keeps the **membership**
leg principal-scoped — which is what closes finding 3 and what `302` §4.2/§4.2a keystone with
an explicit arm-isolation twin. The only reach given up (a person's affiliations at hospitals
I do not administer) is served by `list_org_people`, which returns same-org affiliations in its
payload (`20260909000600:101-112`) — the homonym-disambiguation D11 asked for. Judged correct.

**3 — Is the D14 boundary closed, or only tested? CLOSED, and the six-action set is complete.**
Derived from the property rather than the list: a repo-wide sweep of writers of person-level
`profiles` columns and of `professional_credentials` returns **only** `src/lib/users/actions.ts`
(every one `authorizeOrgAdminForUser`-gated) plus `src/lib/auth/actions.ts:307`
(`must_change_password: false`, self-service, not person-level and not lifecycle). `cpf` is
written in exactly one place. Two boundary calls I checked and agree with: `registerUser` is
deliberately outside (the D14 asymmetry, question 4) and `resendInvite` (`:1062`) uses
`authorizeForUser` — correct, it mutates no person-level field and no lifecycle column. The
*keystone* set, however, is narrower than the boundary — F6.

**4 — The create-vs-change CPF asymmetry.** Rationale sound: at creation there is no other
hospital's value to overwrite, the identifier-first flow has the registrar type the CPF to
search first, and the collision block prevents claiming an existing one. Recorded in three
places a future reader will actually hit — ADR 0097 D14 (amended block), ADR 0098 §W3.2, and
the JSDoc on `RegisterUserInput.cpf` (`src/lib/users/actions.ts:78-92`), which is the one that
will be read. Well handled. The residual consequence (CPF burning) is at the end of F4.

**5 — The BUG-AFF-1 ruling: CONFIRMED CORRECT, and on stronger ground than stated.** I checked
it rather than accepting it. All six operations `authorizeStaffOps` fronts issue their write
through a DEFINER door **on the cookie client** — `grant_role` (`actions.ts:226`),
`revoke_role` (`:270`), `appoint_administrativo` (`:310`), `revoke_administrativo` (`:335`),
`grant_member_capability` (`:364`), `revoke_member_capability` (`:394`) — so PostgreSQL
re-derives authority via `is_commission_admin_of[_for]`, whose hospital leg already admits a
hospital admin. `addStaff`'s service-role client is used for **reads only** (`:175-222`:
commission org, target profile, existing membership); the write at `:226` is the cookie
client. There is therefore **no service-role-only write path in this file at all**, which is
why the ruling is stronger than the ADR argues (F5). Adding the leg grants nothing the
database did not already grant, and the DENY arm keeping it honest is
`staff-ops-mirror.test.ts:135-145` — sibling-hospital, mutation-proved per ADR 0098 §W3.7. The
`isInactive` addition is strictly narrowing. **Not a widening.** Also correct on `administrativo`
(ADR 0061): those four doors gate `is_staff_admin_of OR is_commission_admin_of`, so the hospital
leg was already live there.

**6 — Is the drift detector able to find something?** Yes, with a demonstrated blind spot in
its own inputs. Full answer in F2.

**7 — Rule 11 / audit completeness.** The CPF-lookup row is exemplary and fully keystoned:
`302` §5.9 (emitted, and only for CPF calls), §5.10 (**not one row carries the digits**),
§5.11 (each names the actor — which is why the door runs on the cookie client), §5.13 (a name
search emits nothing). The affiliation payload
(`20260909000500:348-352`) carries `user_id` / `organization_id` / `hospital_id` only — no
PHI, no national ID. The gap is coverage, not content: F3. F4 is the surface the control does
not reach.

**8 — Rule 12 / PHI.** Clean. No AFF migration, query, action, component, pgTAP suite or E2E
spec references `event_patient`, `referral_patient`, `patient_identifiers` or
`patient_participants`. `cpf` is a national ID, not PHI, and is column-locked from
`authenticated`. `professional_profiles.cpf` lands as a column only, with linking deferred
(D15) — the right call, since a registration-side match would disclose ethics-case
subjecthood.

**9 — Rule 10.** One violation: F1. Everything else in the ten AFF surfaces is pt-BR; code,
comments and commits are English. No raw Postgres error reaches the UI — every refusal path
maps a SQLSTATE to a fixed pt-BR sentence (`toState`, `MESSAGES`), never interpolating
`error.message`.

**10 — Keystone quality (spot-check of shape).** Strong, and the sample is not selective.
Assertions that pin **observed state** rather than "it did not raise": `302` §2.5 (exactly one
active row, not two), §2.6 (matrícula actually refreshed — the repeat call was not a silent
no-op), §3.5/§3.6 (the ended row survives, `ended_by` names the actor), §3.7 (the `HC0R1`
DETAIL genuinely carries `technical_director`), §6.5 (§6.1 actually wrote the row); `304`
§2.4/§2.5 (matrícula and start date read back), §2.10 (the clear flag is not decorative),
§3.2 (the create door *ignored* `p_started_on` while applying the matrícula). Arm-isolation
and wrong-arm defences are present where two arms could produce the same result: `302` §4.2a,
§6.2 (42501 vs `HC0G3`), §6.4 (matched on the message, because every refusal there is 42501),
`301` §0.5 (one policy ⇒ every row assertion attributable). Non-vacuity controls are real:
`301` §1.2 (both polarities, in quantity), §6.4, `302` §4.4, `303` §2's three **synthetic**
gates anchored on things correct by construction rather than on a defect. And the one vacuous
keystone that did exist (`302` §4.2, subject admitted by the wrong leg) was caught **by the
mutation oracle, not by review**, and fixed with an explicit isolation twin. This is the
standard the project's recorded failure was measured against, and it is met.

---

## 4. External-audit dispositions — verified at the code, not at the document

| ID | Disposition | Landed? |
| --- | --- | --- |
| BLOCKER-1 | `grant_role_impl` gains `is_admin_for` on the `hospital_admin` branch | ✅ `20260909000900`; keystoned `302` §6.1 (allow) / §6.2 (TD branch still refuses, **42501** not `HC0G3`) / §6.3 (arm added, not swapped) / §6.4 (self-grant guard untouched, matched on message) / §6.5 (non-vacuity). Caller wired at `src/lib/platform/actions.ts:220-260`, exactly-one-hospital, failure not swallowed |
| HIGH-1 | `cpf` column-locked via column-list grants | ✅ `20260909000200:132-153`; `301` §6 both arms |
| MEDIUM-1 | `guard_profile_privileged_columns` rewritten in the same migration | ✅ `301` §7.1-7.4, incl. §7.4 proving the guard was not *weakened* by the rewrite |
| MEDIUM-2 | demo seed (in no gate, no scope) assigned by name | ✅ `supabase/demo/seed-revisao-prontuario.sql` changed in-diff; owner named in the PROGRESS file-ownership block |
| MEDIUM-3 | `end_affiliation` blocks on **any** tier | ✅ `20260909000500:150-160` (`coalesce(m.hospital_id, c.hospital_id)`); `302` §3.1 commission-tier, **§3.2 hospital-tier** — the arm a commission-only check would miss — §3.3 distinguishable `HC0R2`, §3.4 twin |
| MEDIUM-4 | affiliation SELECT gets self + org_admin legs | ✅ four legs; `301` §4.1-4.8, one subject per leg |
| MEDIUM-5 | inline predicate, no `nsp_org_admin` | ✅ `20260909000600:53-67`; `302` §5.3 is the explicit NSP deny control |
| MINOR-1 | D10's "used in no policy" corrected | ✅ ADR 0097 D10 now says the helper is a live leg of `organizations_select` |
| LOW-1 | DENY arm pins default state, not tenant isolation | ✅ said in D6, in `302` §4's header, in `301` §4.7's own comment — and `302` §4.5 is the assertion §4.3 is *not* |
| LOW-2 | audit row on CPF lookups | ⚠ ✅ on `list_org_people`; **absent on the wider probe** — F4 |
| LOW-3 | the CPF/email asymmetry stated in the ADR | ✅ D7 |
| INFO-1/2/3 | embed strings, seed-as-contract, suite rewrite scope | ✅ FK-hinted embed (`queries/affiliations.ts:49-55`); T3.5's blast radius measured and traced to the owning spec, no fixture clamped |

**Known-open items, judged:** FUP-AFF-1 dispositioned **correctly** — the W3 gate record does
not cite `ARM=census` for its doors and states plainly *"They are covered ONLY by pgTAP `304`
§1–§2"*, with `302`'s mutation-proven keystones covering W2's. (The W2 record itself should
carry the same disclaimer — F9.) FUP-AFF-2 is correctly classified as a product decision, not
a defect; F4's closing paragraph belongs beside it. The `phase16-accreditation-core` AC-4
failure is non-AFF and was not investigated.

---

## 5. PASS 2 — the parked claims, resolved against the live catalog

Read from the running local stack (`296` registered migrations, AFF's `20260909000100`–`001100`
all applied) after the gate cleared. **No claim below was substituted with migration file text.**

| # | Claim | Result |
| --- | --- | --- |
| **P1** | `commissions_select_member_or_admin` carries `app.is_hospital_admin_of(hospital_id)` | ✅ **CONFIRMED.** Live qual: `is_member_of(id) OR is_org_admin_of(organization_id) OR is_hospital_admin_of(hospital_id) OR is_pqs_operator_of(hospital_id) OR is_nsp_org_admin_of(organization_id)`. A hospital admin **can** SELECT the commission on the cookie client, so `authorizeStaffOps`'s RLS-scoped read reaches it and the **BUG-AFF-1 fix is genuinely reachable, not inert.** This was the claim most worth the catalog: the green E2E ALLOW arm proved it works, not *why*, and an inert fix would have looked identical from the test |
| **P2** | Hospital-tier `memberships` rows carry a non-null `organization_id` | ✅ **CONFIRMED.** `hospital_admin`: 4 rows, 4 with `organization_id`, 4 with `hospital_id`, 0 with `commission_id`. So `list_org_people`'s gate leg (`20260909000600:59-63`) matches and the directory is **not** silently org_admin-only. Same shape for `technical_director`, `technical_director_deputy`, `nsp_coordinator`, `pqs_member`. Also re-confirms ADR 0097 finding 4 exactly: commission-tier rows (`staff` 14, `staff_admin` 5) carry `organization_id` **NULL** |
| **P3** | Live `profiles` ACL matches `20260909000200`; no later table-level re-grant | ✅ **CONFIRMED, exactly.** The set of `profiles` columns carrying **no** `authenticated` SELECT grant is **`{cpf}`** — one column, the intended one. Table-level grants remaining: `DELETE, TRUNCATE, REFERENCES, TRIGGER` — precisely the four the migration declared it would not touch, with **no** table-level SELECT/INSERT/UPDATE anywhere. HIGH-1 is closed and stayed closed. *(That query is the executable assertion F7 asks for, verbatim.)* |
| **P4** | `prosecdef` + ACLs of the doors and kernels | ✅ **CONFIRMED.** All three kernels `prosecdef=t`, ACL **`postgres=X/postgres` only** — executable by nobody but the owner, which is what makes `p_actor` unforgeable. The three `_for` twins: `service_role=X`, **no `authenticated`**. The three interactive wrappers + `list_org_people`: `authenticated=X`. **No `PUBLIC` execute on any of the ten** — the t19 trap is clean |
| **P5** | Trigger arms survived the `001100` rebuild; `tgenabled` | ✅ **CONFIRMED.** Live `prosrc` carries all four arms (`created`, `deleted`, `ended`, `updated`); `guard_affiliation_no_delete_trg = 'O'`, `trg_audit_hospital_affiliations = 'A'`. F3 is a coverage gap, not a live defect |
| **P6** | Actor recorded for `affiliation.created` on the service path | ⚠ **CONFIRMED AS A GAP → promoted to F3b.** `app.audit_write` has no actor parameter and derives `auth.uid()`; all 5 live `affiliation.created` rows are unattributed. **Platform-wide and pre-existing, not AFF-introduced** — see F3b for the calibration and for the LOW-1 correction it forces |

**Two PASS-1 claims I made about ADR 0098 §3, now verified rather than reasoned:**
`authenticated` holds **no CREATE on schema `public`** (`has_schema_privilege` → false), and
`profiles_cpf_key` is `CREATE UNIQUE INDEX … WHERE (cpf IS NOT NULL)` — a **partial** unique
index, which PostgreSQL will not accept as a foreign-key target. The residual table-level
`REFERENCES` on `cpf` is confirmed present *and* confirmed inert, by two independent
mechanisms, only one of which the ADR claims.

**The lead's W2 gate-record fix (`d09d274`) satisfies F9's third item.** It names the four
`uuid`-returning doors, explains *why* the boolean arm cannot see them (neutralizing a body to
`select true` is meaningless for a `uuid` return, so it skips them silently) and why ARM 3's
census population excludes them, and cites `302` §1–§3's mutation-proven keystones as their
actual coverage. It also states the hazard in the right words: *"the arm reports a clean result
in the same words whether it swept everything or nothing."* Accepted; F9's other two items
(the stale phase-status row, the reversed D10 gate in the Decision Log) remain open.

---

## 6. Required follow-ups (none blocking)

Dispatched by the lead in this same workstream at the time of writing; **none had landed at my
HEAD** (see the verdict's re-verification table).

| # | Fix | Sev |
| --- | --- | --- |
| F1 | pt-BR the `" — no hospital"` fallback **and** add the missing E2E arm that renders the HC0R1 blockers list — the string was invisible because no test reaches that branch | MED |
| F2 | Widen both enumeration regexes (`door-error-arms.test.ts:49`, `304` §6.1 at `:213`) to named conditions, or replace the two `'check_violation'` raises with `'23514'`; then give `toState` its arm | MED |
| F3 | Keystone `affiliation.created` and `affiliation.ended` | MED |
| F3b | Follow-up log only: an `_for`-aware audit path so service-path rows name their actor; and one line correcting LOW-1's mitigation sentence | MED (not AFF's) |
| F4 | Emit `person.cpf_lookup` from `registerUser`'s collision probe (matched-or-not, never digits); record the CPF-burning consequence beside FUP-AFF-2 | MED |
| F6 | Three `it.each` rows for `removeCredential` / `reactivateUser` / `suspendUser` | MIN |
| F5 | Correct the `inviteStaff` comment (`members/actions.ts:98`) and ADR 0098 §W3.7 | MIN |
| F7 | One pgTAP assertion: the set of `profiles` columns lacking an `authenticated` SELECT grant is exactly `{cpf}` (query in §5/P3) | MIN |
| F8 | Build D7's own-account CPF surface, or amend the sentence | MIN |
| F9 | PROGRESS.md: phase-status row still "▶ in progress (W1)"; Decision Log line 777 records D10's gate as the `is_org_level_admin_within` form that MEDIUM-5 rejected | MIN |
| F10 | Escape `%`/`_` in `list_org_people`'s search term | MIN |

## 7. What is right, briefly

The substrate is the strongest work I have reviewed on this repo. Every external-audit finding
was folded in **before** build and each disposition is visible in code with a keystone naming
it. The kernel + two-wrapper shape closes the service-path bypass that a single `auth.uid()`
door would have left open on the path creating most affiliations. Refusals are distinguishable
by SQLSTATE where two arms could produce the same deny. The dominance grid derives its
population from the catalog and carries synthetic controls anchored on things correct by
construction — not on a defect that would evaporate. `281` D1 was **inverted rather than
deleted**, with a deny twin added so widening the gate did not remove §D's only authority-deny
arm. The one vacuous keystone in the set was found by the mutation oracle and fixed with an
explicit arm-isolation assertion. Rule 9, Server-Components-by-default, labels/`aria-describedby`/
keyboard operability, and the "no CPF in a URL" rule are all clean; the CPF never enters the
directory payload and that is asserted on the **signature** (`302` §5.6), not on a sample row.

The four MEDIUM findings are all of one kind — a gap between *tested* and *provable* — plus one
string. None of them is a hole.

---

*Written by `qa`. Read-only on application code, migrations, specs and queries; this file and
one PROGRESS.md row are the only artifacts written.*

---

# 8. Round 2 — re-review of the remediation delta (`86ce0d1..5b4b1df`)

**Date:** 2026-08-06 · **Scope:** the four substantive commits landed after round 1 —
`202c3db` (F1 + an a11y defect found underneath it), `8dde312` (hermetic AC-4 + HC0R1
coverage), `8111fc9` (F2–F7 + the stale-claim corrections), `69ac173` (ADR 0079 Amd 5a).
Database quiet, catalog reads fully reliable and used throughout.

**Final gate:** `e2e:prod` **GREEN** — 985 passed · 0 failed · 0 infra · **1 flaky** · 0
did-not-run · 16 batches no gaps · 0 `reset FAILED` · 986/991 accounted. **AC-4 passed first
attempt** after `8dde312` moved its marker off the host clock onto
`sqlOne('select clock_timestamp()')` — which also retires my round-1 note that AFF may have
*exposed* it: a cross-clock assertion made single-clock is a real fix, not a suppression.
pgTAP 165f/5060 · Vitest 1023 · lint 0/0 · 298==298 · both authz arms HOLD.

## 8.1 The three regenerated kernels — property-by-property, from the catalog

This was the reason for the re-review, and it is the check that cannot be done by reading the
new statement: **an omission has no line in the diff.** I had a genuine pre-`001200` baseline —
my own round-1 PASS-2 catalog reading — so this is a true old-vs-new diff, not an inspection.

| property | round-1 catalog (pre-`001200`) | round-2 catalog | |
| --- | --- | --- | --- |
| `prosecdef` (all 3 kernels) | `t` | `t` | ✅ |
| ACL (all 3 kernels) | `postgres=X/postgres` | `postgres=X/postgres` | ✅ owner-only preserved — `p_actor` still unforgeable |
| owner | `postgres` | `postgres` | ✅ |
| `proconfig` | — | `search_path=app, public, pg_catalog` | ✅ identical to `app.grant_role_impl`, the declared precedent |
| volatility | — | `v` | ✅ matches `grant_role_impl` |
| return type | `uuid` | `uuid` | ✅ |
| arity | 5 / 4 / 6 | 5 / 4 / 6 | ✅ |
| param names + defaults | — | identical to every wrapper call site | ✅ |
| **overload count** | 1 each | **1 each** | ✅ **decisive** |

The eight `public` wrappers are **byte-identical** to my round-1 reading —
`affiliate_person` / `end_affiliation` / `update_affiliation` / `list_org_people` at
`postgres=X | service_role=X | authenticated=X`; the three `_for` twins at
`postgres=X | service_role=X` with **no `authenticated`**. `has_function_privilege` for both
`public` and `anon` is **false on all eight**.

⭐ **The overload count is the assertion that earns this section.** `create or replace function`
with any change to the argument *types* or arity does not replace — it creates a **second**
function, and the wrappers may then resolve to the stale one. That failure is invisible in a
diff, invisible to `tsc`, and green in any test that happens to hit the new overload. All 12
affiliation- and probe-related functions return `overloads = 1`. **The regeneration is clean:
no property the originals carried was dropped, and nothing was silently duplicated.**

## 8.2 `public.log_cpf_probe_for` — the door is right; its keystone is missing (**N2, MINOR**)

**The door itself is correct**, verified from the catalog: `prosecdef = t`, owner `postgres`,
ACL `postgres=X | service_role=X` — **no `authenticated`, no PUBLIC, no `anon`**. The t19
`REVOKE ALL FROM PUBLIC`-before-`GRANT` discipline held.

**Its gate is neither weaker nor stronger than what it fronts**, and the right way to see that
is that it fronts *nothing*: it grants no capability and mutates no domain row — it writes one
audit row. Its only raise is `42501` on a null actor or org. The boundary is therefore the ACL
(`service_role` only), not an in-body predicate, and that is the correct shape for this door.
Its body also documents the `actor_id` NULL gap in place rather than leaving it to an auditor,
and threads the actor through `metadata.actor_user_id` instead of pretending the column is
populated. Good.

**`304` §8 does NOT genuinely cover it — for the ACL, which is its only boundary.** §8 covers
the *behaviour* well: §8.1 it emits, §8.2 tagged `source: registration` (told apart by a
**present** value, not by an absence — the right choice), §8.3 no CPF digits, §8.4 the actor is
named. But §8 calls the door with **no `set local role`**, i.e. as superuser, and the single
`log_cpf_probe` reference in the entire pgTAP suite is that one `lives_ok`. Every sibling door
got the ACL-split arm in `302` §1.1–1.5 (kernel unreachable / `_for` service-role-only / PUBLIC
cannot execute). **This one did not inherit it** — the project's own "a new door must inherit
EVERY sibling arm" lesson, applied to keystones rather than to the door. Since the ACL *is* this
door's entire boundary, that is precisely the property most worth pinning: a later
`grant execute … to authenticated`, or a parameter rename doing a privilege reset, would go
unnoticed. **One assertion closes it.** Correct today — I verified it; unpinned for tomorrow.

## 8.3 `HC0R5` — the right call, and the set is complete

**Judged, not just checked.** `backend`'s argument holds and the catalog backs it:
`check_violation` *is* `23514`, and `app.guard_affiliation_no_delete` **still raises it**. A
`23514` arm in `toState` would therefore have collapsed "hospital inexistente", "you tried to
delete an affiliation", and every table CHECK into one sentence — correct only by accident, and
wrong the moment a second 23514 source appeared. A dedicated code is right.

Live union across all three kernels, any spelling: **`{42501, HC0R0, HC0R1, HC0R2, HC0R3,
HC0R4, HC0R5}`** — **no `check_violation` remains in any kernel**, and `toState` now carries all
seven arms with seven distinct messages. `304` §6.1 pins exactly that string as an equality.

**Is a reachable `23514` left rendering as `generic`? No.** All three table CHECKs are
pre-empted before a door can trip them: `employee_id_not_blank` (the kernels normalize with
`nullif(btrim(…),'')`), `ended_by_shape` (set together), and `period_ck` (`end_affiliation`
pre-checks and raises `HC0R3`; `update_affiliation` only touches ACTIVE rows, where `ended_on`
is NULL and the CHECK passes trivially). The one residual, `23505` from the partial unique on a
concurrent race, falls to `generic` — **which is the correct message there**, since retrying
genuinely does fix a race. Set complete.

## 8.4 The widened detector — it does not over-shoot

Verified, and I agree with all three of its design calls:

- **Last-write-wins matches the chain.** `raisedCodes()` walks `DOOR_MIGRATIONS` in version
  order and `resolved.set(name, block)` overwrites per qualified function name — which is what
  Postgres does when it applies `create or replace` forward-only. Its own regression test
  ("resolves SUPERSEDED definitions away") asserts `23514` is **absent**, so the false
  positive `backend` reports hitting is now pinned as a test. Correct.
- **Throwing on an unrecognised condition is the right trade,** not an over-shoot. The failure
  message names the fix (`add it to CONDITION_TO_SQLSTATE`), so a legitimate future condition
  hard-fails *loudly and actionably* rather than silently shrinking the domain a third time.
  That asymmetry is the whole point of the file.
- **Excluding triggers by RETURN TYPE, not by a name list,** is the same correction the domain
  itself needed — and it is why `guard_affiliation_no_delete`'s live `check_violation` is
  correctly out of scope rather than a false positive.

The dry-run against a hand-classified sample with a known positive (`check_violation` → 23514,
which the old regex could not match) satisfies *a detector that finds nothing must be proven
able to find something* — properly this time, since the positive is the exact defect it missed.

**Three narrow residuals, none worth acting on now, recorded so they are not rediscovered:**
`functionBlocks` splits on `create or replace function`, so a door declared with a plain
`create function` would drop out of the domain silently; `DOOR_MIGRATIONS` remains a filename
list in manually-maintained version order; and — shared with the SQL half — **a named condition
introduced at RUNTIME is invisible to both ends**, because the TS half reads files (where it
would see the name) and `304` §6.1 reads the catalog with `[A-Z0-9]{5}` (where it would not).
Narrow, but this is a project where bodies *are* rewritten at runtime.

## 8.5 The a11y fix — nothing is lost (**verified, not assumed**)

Closing the dialog on failure discards nothing the user needs:

- The refusal renders **in the page**, not the dialog — `{error ? <FormBanner tone="error">…}`
  at `user-lifecycle-actions.tsx:89`, outside every `Dialog`. That is exactly why the old
  behaviour was inert: Radix marks everything outside an open modal `aria-hidden`, so the
  message was rendered, dimmed, and unreadable to assistive tech.
- **The suspend date survives.** `suspendUntil` (`:66`) is only ever written by the DatePicker's
  `onChange` (`:235`); no close path resets it, and the `onOpenChange` handlers
  (`:157/188/218/269`) touch only `openDialog`. Reopening the dialog restores the chosen date.
- The refusal is **reachable by role**, not merely visible: the D14 `orgAdminOnly` path is what
  a `hospital_admin` actually hits on deactivate/reactivate/suspend, which is the case that was
  hidden.

And `frontend` was right that the affiliation case is worse than a readability bug: the blocking
seats cannot be removed from inside the dialog, so staying there was wrong even for a sighted
user who could read the greyed-out text.

## 8.6 F1–F7 — all closed. What I re-checked, and how

Same discipline as round 1. **Every row below was re-checked at source or in the catalog; none
was taken on report.**

| | closed by | how I verified |
| --- | --- | --- |
| **F1** | `202c3db` | `affiliations-panel.tsx:280` now `" — cargo do hospital"`; **and the branch is reachable** — `e2e/…:687` asserts `'Administração do hospital — cargo do hospital'`, so the case that had no test now has one. Both halves, which is what I asked for |
| **F2** | `8111fc9` | catalog: no kernel raises `check_violation`; live union = the 7 codes; `toState` has all 7 arms; detector widened and its own false-positive pinned as a test |
| **F3** | `8111fc9` | `304` §7.1–7.5 — `.created` and `.ended` now pinned **by behaviour** (emit, read back), plus §7.3 (≥3 distinct arms in one run) and §7.5 (**the matrícula is not in the payload** — a Rule 11 assertion I had not asked for and which is correct) |
| **F3b** | `8111fc9` | ADR 0097 D6/LOW-1 carries a correction blockquote with the mechanism, the live measurement (5/5 unattributed), the platform-wide scope, and the honest note that `created_by` is the attribution that survives |
| **F4** | `8111fc9` | `log_cpf_probe_for` wired at `users/actions.ts:524-528` — and **placed before the `if (cpfHolder) return`**, so a MATCH is audited too. I checked the placement specifically: after the early return it would have audited only the misses, which is backwards |
| **F5** | `8111fc9` | `members/actions.ts` — claim removed, named as fiction, `8155be2` named as the commit that propagated it, true reason stated |
| **F6** | `8111fc9` | three new DENY arms (`removeCredential`, `reactivateUser`, `suspendUser`) **with org_admin ALLOW twins** at `:244-247` — the twins matter, since a narrowing that denies everyone passes its negative keystones by construction |
| **F7** | `8111fc9` | `301` §0.10 — the set of `profiles` columns with no `authenticated` SELECT grant is exactly `{cpf}`, and it reds **both** ways (new column without a grant; `cpf` wrongly granted) |
| F8–F10 | — | deliberately not addressed; they were and remain MINOR |

## 8.7 N1 (**new, MINOR**) — the role-label test's authority is transcribed, so its own claim is false

`src/components/users/affiliations-panel.test.ts` pins `ROLE_LABELS` against
`ROLES_FROM_MEMBERSHIPS_ROLE_CHECK` — a hardcoded `as const` array **transcribed** from the
catalog. Its header states:

> *"If `backend` widens that CHECK, this test goes red and the new role gets a pt-BR label
> before it can ever reach a user."*

**That is not true.** Nothing in the file reads `memberships_role_check` at runtime — Vitest
cannot reach the database. Widen the CHECK and touch nothing else and this test stays **green**,
shipping an English snake_case identifier into the pt-BR `role="alert"` — the exact defect F1
was. This is the enumeration-boundary lesson landing inside the fix written for it, for the
**third** time in this workstream (F2 was the second). The test is otherwise well built: three
assertions covering both drift directions plus an untranslated-identifier check, and it is
correct and complete for the nine roles that exist today.

**Partial tripwire, which is why this is MINOR and not MEDIUM:** `292` §3.1 *does* read
`memberships_role_check` from the catalog and reds when a role is added (mutation-proven by
`supabase/tests/mutation/w2-session-context-mutation-audit.sh`), so a new role reds *something*
and forces the author into role wiring. But nothing points them at `ROLE_LABELS`.

**Fix:** assert the role *count* in `memberships_role_check` from pgTAP against the Vitest
list's length (currently 9), in a test whose failure message names `ROLE_LABELS` — or delete the
sentence. Either closes it; leaving a false completeness claim in place is the thing this
project keeps paying for.

## 8.8 Round-2 follow-ups

| # | Fix | Sev |
| --- | --- | --- |
| N1 | The role-label authority is transcribed, not read; correct the claim or add the pgTAP count assertion | MIN |
| N2 | `log_cpf_probe_for` has no ACL/t19 keystone — add the `302` §1-shaped arm (the ACL is its only boundary) | MIN |
| — | Carried from round 1, still open by choice: F8 (D7's unbuilt own-account CPF surface), F9 (PROGRESS phase-status row; Decision Log line 777 still records D10's rejected gate form), F10 (LIKE metacharacters) | MIN |

## 8.9 Round-2 verdict

**APPROVED.** Three `SECURITY DEFINER` kernels were regenerated after my sign-off and the
catalog says every property survived — ACL, `prosecdef`, owner, `search_path`, volatility,
return type, arity, parameter names and defaults — with no overload duplication and no drift in
any of the eight wrapper ACLs. `HC0R5` is the right call rather than merely a landed one, and it
leaves no reachable `23514` rendering as a retry instruction. The detector's widening is sound
and does not over-shoot. The a11y fix discards nothing. F1–F7 are closed, each re-verified at
source or in the catalog, and two of them (F1's E2E arm, F3's `.created`/`.ended`) are closed in
the shape that would have caught the original defect rather than merely satisfying its letter.

The two open MINORs are one assertion each and neither is a boundary. **Nothing here should hold
the pilot's `db push`.**
