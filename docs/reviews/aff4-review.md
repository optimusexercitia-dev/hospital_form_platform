# AFF4 — QA review (§6 step 3)

**Branch:** `feat/aff4-org-affiliation` (88 commits ahead of `main` at review start)
**Reviewed:** 2026-08-26 · `qa`
**Authority:** ADR 0151 (D1–D17), amended by 0154 (roster predicate) and 0152 (P1 re-scope);
plus 0153, 0156, 0157. Plan: `docs/plans/aff4-org-affiliation.md` § Acceptance criteria.
**Method:** every schema / RLS / RPC / SQLSTATE claim below is measured against the **live
local catalog** (`pg_proc.prosecdef`, `pg_get_functiondef`, `pg_policies`, `pg_class.relacl`,
`pg_trigger`), never against migration text or graphify (ADR 0078 methodology finding).

---

# VERDICT: CHANGES REQUESTED

Four blocking items. One is an outright acceptance-criterion failure (**AC5**), one makes a
decision-of-record sentence false at the only layer a user sees (**D3**), one leaves an
accepted ADR reading as current law while the build contradicts it (**0154 D1**), and one
mechanically prevents §6 step 2 from declaring green.

The security half of this program is **strong** and I found nothing to change in it. The
five new doors, the policy audience, the audit coverage and the PHI posture all hold under
direct catalog measurement. The blocking items are in the TS/UI layer and in the record.

---

## Scope excluded

- `docs/decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md` — uncommitted
  and not this program's at review start; a peer session has since committed it (`68e2e432`).
  It concerns *post*-AFF4 sequencing, so it is out of scope either way. Not reviewed.
- `scripts/progress-cleanup-2026-08-26.mjs` — untracked, not reviewed.
- No other uncommitted paths were present. Everything else below is **committed work**.

⚠ **The branch moved under this review.** It was 88 commits ahead at the task briefing, 90 at
sign-off (`68e2e432`, `193739a0` — a peer session's ADR-0155 correction and an unrelated FUP
filing, neither AFF4 feature code). Nothing in § 1–3 was re-measured against the moving tip;
every catalog measurement was taken from the live local DB, which does not move with commits.

---

# 1. Acceptance criteria

## AC1 — org admin offboards end-to-end, audited, person leaves the default roster but stays reachable behind the filter

**Verdict: MET, with one blocking defect in the blocker enumeration (item B2).**

| Property | Witness |
| --- | --- |
| Wizard exists, three steps | `src/components/users/org-offboarding-wizard.tsx` |
| org_admin-only at the **door**, not just the UI | live `app.end_org_affiliation_impl`: `if not app.is_org_admin_of_for(p_organization, p_actor) then raise exception 'sem permissão' using errcode = '42501'` |
| …and the helper has no hidden platform arm | live `app.is_org_admin_of_for` = `app.is_active(p_user_id) and app.has_role('organization', p_org_id, 'org_admin', p_user_id)` — **no `is_admin()` disjunct** |
| DENY arm pinned | `supabase/tests/379_org_affiliation_doors.sql` §3.5 (hospital_admin refused at org tier) |
| Blockers enumerated across **all three** membership tiers + hospital affiliations | live `end_org_affiliation_impl`, the `union all` over `hospital_affiliations` and `memberships` with `coalesce(m.organization_id, h.organization_id)` |
| D6 active-only (an expired seat never blocks) | same body: `and (m.expires_at is null or m.expires_at > now())`; differential pinned at `379` §3.3 |
| Deactivation **offered, never automatic** | `org-offboarding-wizard.tsx:313-355` — `Manter conta ativa` / `Desativar conta`; the only `deactivateUser` call is the explicit button handler at `:131-141` |
| Person leaves the default roster | `src/lib/queries/org-users.ts:493-520` — `.eq('home_organization_id', orgId)` is **gone**; scope is now `listOrgAffiliationTenses(orgId, includeEnded)` |
| …reachable behind the filter | `src/components/users/user-directory-ended-toggle.tsx` → `?includeEnded=1` → `page.tsx:137` → `listOrgUsers` |
| Voided excluded in **both** modes | `src/lib/queries/affiliations.ts:250-255` — `.is('voided_at', null)` is unconditional; only `.is('ended_on', null)` is gated on `includeEnded` |
| The roster read is RLS-bound, not service-role | `listOrgAffiliationTenses` uses `createClient()`, not the admin client — a non-admin caller fails **closed** (reads only their own row) |
| E2E covers the arc | `e2e/aff4-org-offboarding.spec.ts` — blocked→guided→retry→accept-deactivation; clean path + the parity gate (directory drops / CPF search still finds / toggle restores); one keyboard-only pass |

**The parity gate is real.** ADR 0154 D3 requires the two surfaces to default *differently*,
and B6's own ruling says no unit test can assert they agree because they live in different
runtimes. `aff4-org-offboarding.spec.ts` exercises the SQL door and the TS query in one
process and reds if either changes its default alone. That is a witness of the right kind.

## AC2 — the C5 differential holds in pgTAP

**Verdict: MET. The keystone is strong. One record-accuracy finding (item R1).**

`supabase/tests/374_c5_voided_affiliation_read_differential.sql`, `plan(15)`, all 15 real:

- **pre-void read succeeds** — §1.1/§1.2 (profile + credential, count 1)
- **post-END still reads** — §1.3/§1.4 — *this is C5 itself*: `end` cannot revoke a mis-entered
  affiliation under 0148's ever-held legs
- **post-VOID no read** — §2.1/§2.2 (count 0)
- **the row itself still visible to the same audience** — §2.3, run *inside* the same
  `set local role authenticated` block as §2.1, so "same audience" is literal
- **scope control that must stay green** — §3.1/§3.2: the org admin still reads after the void
  (he reaches the subject via `home_organization_id`, a leg B3 does not touch)
- **vacuity guard asserted, not commented** — §0.1 pins the subject holds **zero** memberships.
  This is load-bearing: the sibling memberships-derived hospital-admin leg never touches
  `hospital_affiliations`, so a seated subject would carry the read straight through the void
  and §2 would go green for an unrelated reason.

Confirmed independently in `pg_policies`: `profiles_select_self_or_admin`,
`profiles_admin_select` and `professional_credentials_select` all carry `voided_at`;
`hospital_affiliations_select` deliberately does **not**. The asymmetry D7 rules is real in
the catalog, not just in the test.

The claimed "RED at exactly 2/15, all 15 ran" is structurally consistent with the file: a
neutralization of the affiliation conjunct reds exactly §2.1/§2.2 and leaves §1.3, §2.3 and
§3.1/§3.2 green.

> **R1 — the provenance claim handed to this review is FALSE.** I was told 374 "was not
> rewritten — it already existed". Measured: `git cat-file -e main:supabase/tests/374_*.sql`
> → *"exists on disk, but not in `main`"*; `git log --follow` returns **one** commit,
> `09a2aef4` (B3), on this branch, which added the test **and** its migration together.
> `main` carries 371/372/373 and stops there. The keystone is good and its red-first
> evidence stands — but "it already existed" is precisely what shields a file from review,
> and it must be corrected in the AFF4 record before Record.

## AC3 — rehire at a same-org hospital is one action by that hospital's admin

**Verdict: the MECHANISM is met; the CRITERION AS WORDED has no witness. Non-blocking, but
it must be recorded as a named absence, not carried as covered.**

The mechanism is correct, measured live in `app.affiliate_person_impl`:

```
if not (app.is_org_admin_of_for(v_org, p_actor)
        or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
  raise exception 'sem permissão' using errcode = '42501';
...
select id into v_org_aff from public.organization_affiliations
 where principal_id = p_user and organization_id = v_org
   and ended_on is null and voided_at is null;
if v_org_aff is null then
  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values (p_user, v_org, coalesce(p_started_on, current_date), p_actor);
end if;
```

D5 satisfied: one door call, the org parent auto-ensured, `created_by = p_actor`, and the
audit row emitted by `trg_audit_organization_affiliations` as its own
`org_affiliation.created` naming the actor.

**But the actor in the assertion is the wrong one.** `378` §1 — the real D5 test — drives
the rehire with `…b1` = **`org_admin_a`**. `302` §2.1 has a `hospital_admin` calling
`affiliate_person`, but on a person who is *not* org-offboarded, and asserts nothing about
the org parent. No `e2e/aff4-*.spec.ts` signs in as a `hospital_admin` at all. So the exact
sentence — *"one action by **that hospital's admin**"* — is asserted nowhere. The authority
arm above makes it very likely to work; that is **inference, not verification**.

Cheapest close: add a `hospital_admin` actor arm to `378` §1. This is a one-persona change,
not new machinery.

## AC4 — `/conta` shows the titular their own record, read-only, masked CPF

**Verdict: MET on its literal terms. D14's field list is NOT fully met (item B4).**

| Property | Witness |
| --- | --- |
| Self-only door, **by shape** | live: `get_own_person_record` is `prosecdef = t` with **`pronargs = 0`** — there is structurally no parameter through which another principal's id could be passed. Exactly one such function exists; no `_for` service twin. |
| ACL | `{postgres=X/postgres,authenticated=X/postgres}` — no `anon`, no PUBLIC, no `service_role` |
| Gate | `v_uid uuid := (select auth.uid()); if v_uid is null then raise … '42501'; … where pr.id = v_uid` |
| Empirically the only path | as `dr.john`: the door returns his row; `select cpf from public.profiles where id = <self>` → **`permission denied for table profiles`** |
| Read-only, structurally | `src/app/conta/meus-dados/page.tsx` — async Server Component, **zero** `<form>`/`<input>`/`<textarea>`/`<select>`/`<button>`; imports `ProfileCard`/`DefinitionRow`/`CardFootnote` and deliberately not the two `<button>`-rendering exports in the same module; the directory holds no `actions.ts` and no `"use server"` |
| Masked CPF, ADR 0147 shape | `maskCpf` (`src/lib/users/cpf.ts:81-94`) → `AAA.•••.•CC-DD`, matching 0147 D1 |
| Masked **server-side** | `maskCpf` is applied inside `src/lib/queries/own-person.ts` (`import 'server-only'`); `OwnPersonRecord` carries **no raw `cpf` field**, and the page is a Server Component — the full CPF never enters the client payload |
| Self-read is not audited | correct — Rule 11 logs reads of *another member's* data and PHI reads; this is neither, and the door emits no `audit_write` |

> **D14-GAP — the affiliation "dates" are never rendered.** D14 enumerates *"own affiliations (hospital, job
> title, work contact, matrícula, **dates**) with org-affiliation status"*. `UserAffiliation`
> carries `startedOn`/`endedOn` and `own-person.ts` maps them into the payload, but
> `page.tsx:138-158` renders name, status badge, `jobTitle`, matrícula, `workEmail`,
> `workPhone` — **no date at all**. The status badge is a *label* derived from
> `endedOn`/`voidedAt`, not the date. `formatDateOnly` exists at `:206` and is used only for
> `dateOfBirth`. This gap is not logged anywhere I could find.

> Minor, non-blocking: `src/lib/users/types.ts:397` documents the mask as `***.456.789-**` —
> the **inverse** shape of both ADR 0147 and the actual `maskCpf`. Comment-only.

### Ruling on `BUG-MEUSDADOS-HOSPITAL-NAME-001`

**It does not block AC4 as worded, but its regression guard blocks the §6 step 2 gate (item B3).**

The bug is confirmed independently. `pg_policies`:

```
hospitals_select | SELECT | {authenticated} |
  (app.is_admin() OR app.is_org_admin_of(organization_id) OR app.is_hospital_admin_of(id)
   OR app.is_nsp_org_admin_of(organization_id) OR app.is_quality_reviewer_of(id))
```

Five legs, all admin/reviewer tiers, **no self-affiliation leg**. The name is resolved
through an ordinary RLS-bound PostgREST embed on the caller's own token —
`src/lib/queries/affiliations.ts:64` `hospital:hospitals!…(name)`, mapped at `:72` with
`?? null` — **not** through the DEFINER door, which never touches `hospitals`. Measured as
`dr.john`: `select count(*) from public.hospitals` → **0**, while both his affiliation rows
(matrícula, dates) are visible. So the `?? null` fires and `page.tsx:140` prints *"Hospital
não identificado"*.

**Ruling.** AC4's three named properties — record shown, read-only, masked CPF — all hold, so
AC4 is met. The bug is an **over-restriction, fail-closed, not a leak**, and its root cause is
a pre-existing policy AFF4 did not author; AFF4 is merely the first surface to expose it.
Together with B4 it means the /conta section ships with two of D14's enumerated fields
absent, which is a D14 completeness gap rather than an AC4 failure.

## AC5 — registration writes the start date the user typed

**Verdict: FAILS. This is a blocking item, and the defect is BROADER than filed.**

**AC5 cannot be called met with the backend half only, and I want that stated plainly
because it is the judgement the gate needs.** The criterion is not "the parameter is wired";
it is *"registration writes the start date **the user typed**"*. There is no control anywhere
in the registration wizard through which a user can type one. A parameter no browser path can
supply is, from the criterion's point of view, indistinguishable from an absent parameter —
and it is *worse* than absent, because `d14-person-level.test.ts:1044-1175` is green over it,
so the surface reads as delivered.

**The bug's framing understates it.** `BUG-REGWIZARD-NO-ORG-STARTDATE-001` describes a
*"D13 org-tier start-date parameter"*. There is no tier-split parameter. `RegisterUserInput`
declares exactly **one** field, `src/lib/users/actions.ts:105`:

```ts
affiliationStartedOn?: string | null
```

whose own doc comment at `:96-104` says *"It reaches BOTH affiliation rows, not just the
hospital one."* It fans out to `affiliate_person_to_org_for` (`:698-704`, org tier) **and**
`ensureActiveAffiliation` → `affiliate_person_for` (`:720-726`, hospital tier). So the
missing UI starves **both** rows, not just the org row.

Full resolved path:

1. `src/components/users/register-person-wizard.tsx:200-219` — the `registerUser` input
   literal never sets the key → `undefined`
2. `actions.ts:475` — `undefined?.trim() || null` → `null`
3. `:703` / `:334` — `null ?? undefined` → omitted from the RPC body → SQL default applies
4. door bodies (**both verified in the live catalog**, not from migration text):
   `app.affiliate_person_to_org_impl` and `app.affiliate_person_impl` each insert
   `coalesce(p_started_on, current_date)`

The wizard's only date control is `Nascimento (opcional)` (`:563-572`), bound to
`profiles.date_of_birth`. Step 2 (the *vínculo* step, `:643-676`) renders only a hospital
`NativeSelect` and a `Matrícula` text input.

The one *"Início do vínculo (opcional)"* field in the codebase —
`src/components/users/register-person-flow.tsx:498-517` — belongs to the **existing-person**
`affiliatePerson` path (`:218-223`) and is never threaded into `RegisterPersonWizard`
(rendered at `:304`).

`git log --oneline main..HEAD -- register-person-wizard.tsx register-person-flow.tsx` returns
exactly one commit, `5e7288b5`, an unrelated a11y fix. **F4 did not land partially — it did
not start.** Its dependency (B8) is satisfied.

Also stale and actively misleading: `register-person-wizard.tsx:59-63` still instructs the
next reader that *"`registerUser` takes `homeHospitalId` and `hospitalEmployeeId` and no
start date"*. True before `e6b76885`; false now.

**Consequence for AC6:** `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` cannot be discharged, so
AC6 (all eleven, index line and body) cannot be met either.

## AC6 — all eleven FUPs from ADR 0151's Consequences discharge at Record

**Verdict: NOT MET. Three blockers, plus a framing defect in the criterion itself.**

| # | FUP | index live? | body? | verdict |
| --- | --- | --- | --- | --- |
| 1 | `FUP-AFF3-…-MIS-ENTERED-AFFILIATION` (C5) | **§ Critical FUP row only** (`:289`) — no general index line | `follow-ups.md:6433` | **DONE** — migrations `…003200`–`…003700`, `voidAffiliation`/`voidOrgAffiliation`, `affiliations-panel.tsx:333`, pgTAP 374/377/379/380, `e2e/aff4-void-affiliation.spec.ts` |
| 2 | `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` | `:353` | `:4472` | **DONE** — the deliverable was *"ruling + the build recording it"*, and the build records it in SQL (`…003400:34-36`), not only in the ADR |
| 3 | `FUP-AFF2-CONTA` | `:352` | `:4439` | **DONE for its literal subject** (`date_of_birth`, `phone` both render) — but the D14 surface it discharges *through* is broken for the exact audience it names (B3 + D14-GAP) |
| 4 | `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` | `:357` | `:4719` | ⛔ **PARTIAL — MUST NOT BE DISCHARGED** |
| 5 | `FUP-AFF2-UPDATE-PROFILE-…-DEAD` | `:358` | `:4745` | **DONE** — `actions.ts:867` now `authorizePersonScopedAdmin(…, 'fields')` |
| 6 | `FUP-OPEN-DOCUMENT-VERSION-500-…` | already archived (on `main`) | archive `:6096` | **RULED-ONLY, correctly recorded as such** |
| 7 | `FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY` | `:362`, **no ✅** | `:6394` | **DONE (code)**, register not updated, body's prescription now wrong |
| 8 | `FUP-DATEPICKER-VALUE-ABSENT-…` | `:363` | `:6190` | **DONE (code)** — but one `⚠ OPEN` sub-item and a bad evidence citation |
| 9 | `FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY` | `:356`, ✅ already noted | `:4552` | **DONE** — both `o/[org]/error.tsx` **and** `o/[org]/manage/error.tsx` exist, which is the FUP's own "two files, not one" requirement |
| 10 | `FUP-DOOR-SWEEP-…-ALTER-POLICY` | archived (on `main`) | archive `:6183` | **DONE** — `13f7309b` |
| 11 | `FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE` | archived (on `main`) | archive `:6247` | **DONE for the subset half**; residual live at `:366` |

**Three things block a clean AC6 pass:**

- **#4 — and it is the same failure the FUP itself was filed about.** Its body reads: *"⛔ **the
  defect is the RECORD** — `aff2.md` announced **'ALL THREE CLOSED'** over a **different**
  three."* Discharging it now, with the actions-layer parameter built and no field to drive it,
  is that identical failure one program later. See B4.
- **#8 carries a live `⚠ OPEN` sub-item** — *"`patient-mode-required.spec.ts:632`'s `$` anchor
  pinned the defect — dropped, **needs tester sign-off**"*. The `$` is indeed dropped
  (`:644`, with an in-file justification) but no sign-off is recorded anywhere in the plan or
  the register. Under the contract's check 4, an index line carrying a live `⚠ OPEN` cannot be
  archived. Either `tester` signs off or the sub-item splits into its own FUP.
- **#7's body prescribes a fix that contradicts the landed repair** (item R10).

**And AC6's own wording is defective for #6, #10 and #11.** ADR 0151's Consequences says these
are *"discharged **by the build**"* and AC6 says *"at Record"*. All three are Track P pre-steps
that landed **on `main` before the branch forked** (`515ffa06`, `13f7309b`, `38e891db` —
`git merge-base --is-ancestor 38e891db main` confirms), and their index lines and bodies are
**already rotated**. #6 in particular was not fixed at all: ADR 0152 **refuted D16a's premise**
and retired the scheduled fix, so it discharged *by an ADR amending 0151*, with the live defect
surviving as `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` (`:364`, OPEN, 73 `public` functions).
The Record step will look for three lines that are not there. That is a defect in the
criterion's framing, **not in the work** — note it rather than chase it.

---

# 2. Security / RLS / authorization

**Nothing here requires a change.** Recorded in detail because the absence of findings in a
security review is itself a claim that has to carry its witnesses.

## 2.1 `organization_affiliations` — D1 audience and the deliberate absence of a hospital tier

```
relrowsecurity = t        relforcerowsecurity = f
relacl: authenticated = r          (SELECT ONLY — no insert/update/delete)
organization_affiliations_select | SELECT | {authenticated} |
  ((principal_id = (SELECT auth.uid())) OR app.is_org_admin_of(organization_id))
```

RLS is enabled, the grant is `r` alone, and there is **no** INSERT/UPDATE/DELETE policy — so
every write is structurally forced through the doors. D1 satisfied exactly.

**The absence of a hospital tier is pinned BEHAVIOURALLY, which is the strong form.**
`375` §4.1 assumes a real `hospital_admin` persona under `set local role authenticated` and
asserts he reads **zero** org-affiliation rows belonging to anyone else. There is no
`pg_policies.qual` text inspection anywhere in §4 — the policy text appears only in a header
comment, explicitly labelled as observed rather than asserted. §4.2 supplies the control that
makes the zero mean *"no hospital arm"* rather than *"no access at all"*: he reads his own row
through the SELF arm.

The persona is valid on every axis that could make the denial vacuous: `hospital_admin` of
Hospital Central A **in the target org**, `is_admin = f`, **zero** `org_admin` memberships,
and excluded from the read by `principal_id <>`. Reachability of the failing state is tight:
**8** people he directly administers at the hospital tier hold org affiliations in org A, and
he reads none of them. An added `is_hospital_admin_of` arm would surface those 8 and red §4.1
immediately.

**The consequence — the unfiltered hospital directory — holds, and the toggle is
STRUCTURALLY absent, not hidden.** Verified myself at
`src/app/o/[org]/manage/usuarios/page.tsx`:

- `:137` — `const includeEnded = isOrgAdmin && parseIncludeEnded(sp.includeEnded)` — the
  **parse** is gated, so a hand-typed `?includeEnded=1` is **inert** for a `hospital_admin`,
  not half-honoured
- `:211-217` — `{isOrgAdmin ? <UserDirectoryEndedToggle … /> : null}` — a conditional render
  returning `null`. Not `hidden`, not `disabled`, and the component takes no `scope` prop, so
  the choice cannot be made in two places and drift

And it is not a UI-only control: even if `includeEnded` reached `listOrgUsers` for a
`hospital_admin`, `listOrgAffiliationTenses` runs on the caller's own token against a policy
with no hospital arm, so the scope would collapse to his own row. **Fail-closed at the
boundary, with the UI merely agreeing.** That is Rule 1 satisfied.

The reasoning for option A holds: filtering `listHospitalUsers` on a table a `hospital_admin`
reads 1 row of would blank the page for the only role it serves. My only issue with it is
where the retraction is *recorded* — see item B1.

## 2.2 The five new doors — authority grids, ALLOW and DENY

All six new functions measured live. Every one is `prosecdef = t`, in `public` (so
PostgREST-reachable — no "correct door nothing can reach"), following the ADR 0098 §W2.1
actor-kernel triple: `public.X(…)` passes `auth.uid()` into `app.X_impl(actor, …)`, with a
`public.X_for(actor, …)` twin granted to **`service_role` only** (`authenticated` absent from
every `_for` ACL — checked, not assumed).

| Door | ALLOW | DENY / refusals |
| --- | --- | --- |
| `affiliate_person_to_org` | `is_org_admin_of_for(org, actor)` only | null actor → `42501`; not-org-admin → `42501`; **cross-org conflated with not-found** — `v_person_org is null OR is distinct from p_organization` both raise the same `HC0R0`, so there is no CPF/id existence oracle (D11); deactivated target → `HC0R4` |
| `end_org_affiliation` | `is_org_admin_of_for` only | `42501`; no active row → `HC0R2`; **blockers enumerated** → `HC0R6` with the list in `DETAIL`; end-before-start → `HC0R3` |
| `update_org_affiliation` | `is_org_admin_of_for` only | `42501`; `HC0R2` |
| `void_affiliation` (hospital rows) | **creation-symmetric (D8)**: `is_org_admin_of_for(org)` **or** `is_hospital_admin_of_for(that hospital)` | not-found and not-yours are **byte-identical** `HC0R2` — deliberately, or the door becomes a cross-tenant existence oracle over affiliation ids; blank reason → `HC0R7`; already voided → `HC0R8`; **any seat EVER attached** → `HC0R9` |
| `void_org_affiliation` (org rows) | `is_org_admin_of_for` only (D8) | same oracle-kill; `HC0R7`/`HC0R8`; any non-voided hospital affiliation in the org → `HC0RA`; any seat ever attached at any tier → `HC0R9` |
| `get_own_person_record` | self, **by signature** (`pronargs = 0`) | null `auth.uid()` → `42501` |

Three things I checked specifically because they are where this class of door usually leaks:

1. **No hidden platform arm.** `app.is_org_admin_of_for` and `app.is_hospital_admin_of_for`
   are both `is_active(user) and has_role(...)` — no `is_admin()` disjunct. D2's "no
   platform-admin arm" is true in the catalog, not only in the ADR.
2. **The D8 `expires_at` asymmetry is deliberate and correct.** D3's blockers are active-only
   (`m.expires_at is null or m.expires_at > now()`); D8's never-employed check has **no**
   `expires_at` filter at all. Two different questions — *"is this person still working"* vs
   *"did this row ever grant anything"* — and the bodies carry that reasoning inline. `379`
   §4.4 pins `HC0R9` on an **expired** seat, which is exactly the assertion that proves the
   filter's absence rather than assuming it.
3. **D4 containment has a real backstop.** `pg_trigger`:
   `hospital_affiliation_has_org_trg` → `app.assert_hospital_affiliation_has_org`,
   `tgconstraint <> 0`, `tgdeferrable = t`, `tginitdeferred = t`. A deferred constraint
   trigger, as D4 specifies — not just door-side enforcement.

`379` (`plan(43)`) pins these with an arm-identifying SQLSTATE on every refusal, which is the
correct structural defence against a wrong-arm pass, plus ALLOW halves (§4.5) so the DENY arms
cannot mean *"this role has no authority here at all"*, and §6.5 as the differential that stops
§6.2 being satisfied by a fixed row.

## 2.3 The census / floor / sweep disposition — exemplary, and the one named absence

I reviewed `ac638174` and `e6cad0f3` rather than re-running the arms. The disposition is the
right shape on all three counts:

- **MERGE, not overwrite** — the `organization_affiliations_select` verdict existed only in
  scratch (ADR 0153) and the census reads the baseline. Merged as exactly one row; blast
  radius measured (`700 → 701`). I confirmed independently:
  `git diff --stat main..HEAD -- "*findings*"` → **1 insertion, nothing else**.
- **BACKLOG with a mutation-proven keystone** — `public.get_own_person_record()` is in ARM 3's
  domain and ARM 1 cannot reach it (`predicate=0/111 policy=0/226`, re-run returned
  *"UNPROVEN — NOTHING WAS MEASURED. This is NOT a pass."*). It was **not** filed as a helper,
  which would have silenced the census with an untrue sentence. The first mutation attempt was
  correctly discarded as worthless: `where true` returns 36 rows, §6.2's scalar subquery
  raises, the suite aborts at test 35 of 39 and §6.5 never runs — *a mutation that kills the
  suite before reaching the arm under test proves nothing, and its red looks exactly like a
  red that does.* The replacement returns a fixed row and reds §6.5 specifically.
- **`ARM=floor` caught a door the author built and never drove** (`update_org_affiliation`,
  0 calls) and it was closed with a keystone, **never an allowlist entry** — with §2b.4
  asserting the correction actually landed, since a door returning without writing would pass
  `lives_ok` alone.

This is the one place in the build where an absence is named at the right grain. Record it as
a **named absence with a keystone**, not as a coverage gap.

## 2.4 ADR 0157's dominance-grid widening — self-guarded

The concern handed to me was whether the widening carries its own non-vacuity assertion. **It
does — three.** `303` §1.7 is a dedicated floor counting doors that entered the population
*solely* via kernel resolution (`>= 15`, measured 19, **0 before the widening**); §1.1 is a
population floor; §2.6/§2.7 are synthetic wrapper probes created inside the transaction, so
they are correct-by-construction and cannot evaporate when a real defect is fixed. If a
`strpos` typo or a schema rename silently made the widening a no-op, §1.7 drops to 0 and reds
while §1.2 would keep reporting "no gaps".

Every number in the narrative reproduces exactly against the live catalog: 454 public DEFINER
doors, population 32 (13 own-body + 19 kernel-only), 13 policies, **45** total gates. All 19
kernel-only doors are present, `grant_role`/`revoke_role` and their `_for` twins included.

> **Under-tight, non-blocking (item R4):** no assertion *names* `grant_role`/`revoke_role`.
> §1.8 names only `void_affiliation`/`_for`. The family is covered solely by §1.7's floor,
> whose slack (`>= 15` against a measured 19) is **exactly 4** — the size of that family. Four
> kernel-only doors could drop out with nothing noticing. A `1.8`-style named assertion closes
> it.

## 2.5 Rule 11 — audit coverage and the actor-attribution residue

**Coverage is genuine.** `app.trg_audit_organization_affiliations` (live) emits
`org_affiliation.created` / `.ended` / `.voided` / `.updated`, tests **void first** so a row
that is both ended and voided reports the stronger verb, and — the part worth calling out —
**the actor follows the VERB, not a coalesce precedence**, so an ended-then-voided row names
the voider rather than the ender. D8's *"every void is audited with its reason"* is true: the
`.voided` arm adds `void_reason` to the metadata (administrative justification text, no PHI,
no payload — Rule 11 compliant). `.updated` carries `actor_user_id` **present and null**,
because the table has no `updated_by`; absent would read as an oversight and a guess would be
a fabrication. That is the right call.

The `DELETE` arm is reachable only under `session_replication_role = replica` and exists so
the one window in which the no-delete rule can be violated is not also invisible. Good.

`app.trg_audit_hospital_affiliations` was correctly re-emitted: its UPDATE arm now covers
`voided_at`, `job_title`, `work_email`, `work_phone` — verified live. Without that, D7/D8's
"every void is audited" would have been false for hospital rows.

> **The residue IS stated, and stated in the right terms** — the migration header and
> `7816bd8a`'s message both say: *"`trg_audit_hospital_affiliations`, `membership.granted` and
> `form.created` stay unattributed, deliberately — that is a separate workstream and one
> attributed trigger is not evidence the class was handled."* That is exactly the sentence
> that had to exist.
>
> **But it is stated where a later auditor will not sweep** (item R2). I measured the residue:
> of **53** `app` functions calling `audit_write`, and **50** `trg_audit_*` triggers, exactly
> **one** — `trg_audit_organization_affiliations` — carries `actor_user_id`. The disclaimer
> lives only in a commit message and a migration header, and in this repo **migration text is
> stale by design**. It is not in `docs/progress/follow-ups.md`, not in PROGRESS.md, and not
> in the plan's *"Follow-ups DISCOVERED during the build"* list. It needs a FUP index line and
> a body at Record, or the next auditor reads one attributed trigger and infers the class.

> Minor, related (item R5): the hospital trigger's UPDATE arm still enumerates by **column
> name**, else `return null`. The instance was fixed; the **class** was not. The next column
> added to `hospital_affiliations` is silently unaudited again by the same mechanism that
> nearly cost D7/D8 their truth this time.

## 2.6 Rule 12 / PHI — nothing widened

Measured, not inferred:

- **No migration on this branch touches any PHI relation.** All 11 migration files grepped for
  `event_patient` / `referral_patient` / `patient_identifiers` / `patient_participants` /
  `case_patient` — **zero hits**.
- Three PHI-adjacent `src/` files appear in the diff and all three are benign:
  `referral-patient-fields.tsx` and `event-notify-form.tsx` are F0's DatePicker
  `labelId`/`<label htmlFor>` a11y changes; `src/lib/queries/cases.ts` is **comment-only**
  (verified: the diff has no non-`*` changed line).
- AFF4's new person-level data — `job_title` / `work_email` / `work_phone` on
  `hospital_affiliations` — is ordinary personal data, not PHI and not Class-2. Its read
  audience is the existing `hospital_affiliations_select` audience, **stated as decided in D9
  rather than inherited**, and reads are unaudited, also stated. Both halves are what D9 asks
  for; silence here would have been the next 0148 gap.
- `get_own_person_record` returns the caller's own CPF/DOB/phone. Self-access to one's own
  identity data is the LGPD Art. 18 posture ADR 0133 Amdt 1 r5 already sets; it is neither a
  read of another member's data nor a PHI read, so Rule 11 does not require an audit row and
  the door emits none. Correct.

## 2.7 Secrets

`git diff main..HEAD -- src/` — no client file imports the admin client or references
`SERVICE_ROLE`. The single textual hit, `src/lib/affiliations/actions.ts`, is a `'use server'`
module and the hit is a comment explaining that the `_for` twins are granted to `service_role`
only. Clean.

---

# 3. Code quality, UX and a11y

## 3.1 The two items handed to this review

### CLOSED — `deactivateUser`'s pt-BR error text

`frontend` was right to decline verifying another module's strings from inside a frontend
task. Closed here by direct measurement, not by trusting the header.

`src/lib/users/actions.ts:1164-1182` — 19 lines, three exits, no `try`/`catch`, no `throw`:

| # | line | string | verdict |
| --- | --- | --- | --- |
| 1 | `:1171` | `'Apenas o administrador da organização pode alterar os dados pessoais e a situação da conta.'` | pt-BR, TS literal |
| 2 | `:1178` | `'Não foi possível concluir. Tente novamente.'` | pt-BR, TS literal |
| 3 | `:1181` | `'Conta desativada.'` (success, carried in `error` by module convention) | pt-BR, TS literal |

The Supabase `error` binding at `:1174-1178` is used **only as a boolean** — never read,
never spread, never `.message`'d. Repo-wide grep for `error: error` / `...error` /
`String(error)` / `err.message` across `src/lib/{users,affiliations}/` and
`src/components/users/` returns exactly one hit, `:958`, and it is a **map**
(`error.code === '23505' ? MESSAGES.cpfCollision : MESSAGES.generic`), not a passthrough. Both
UI call sites (`user-lifecycle-actions.tsx:250`, `org-offboarding-wizard.tsx:134`) render the
returned string directly with pt-BR fallbacks.

The seven AFF4 sibling actions all funnel failures through one mapper, `toState`
(`src/lib/affiliations/actions.ts:149-197`), whose parameter type is the guarantee:

```ts
interface PgErrorish { code?: string; details?: string | null }
```

**It does not carry `message`** — a raw DB sentence is structurally unable to pass through.
Every `HC0R*` raised anywhere in `supabase/migrations/*.sql` has an arm; the two sets are
identical element for element, enforced by `door-error-arms.test.ts`. No SQLSTATE reaches a
user. **Rule 10 and the raw-error prohibition: compliant.**

> Two message-quality notes, neither a violation. (i) `registerUser`'s org-door call
> (`src/lib/users/actions.ts:705-709`) bypasses `toState` and returns `MESSAGES.generic`
> unconditionally, so `HC0R4` *"conta desativada"* and `HC0R0` *"pessoa não pertence a esta
> organização"* collapse to *"Tente novamente"* — a retry instruction for a condition retrying
> cannot fix. (ii) `parseBlockers` carries DB-origin **data** into the UI; see B2, which is the
> blocking half of the same seam.

### RULED — `BUG-MEUSDADOS-HOSPITAL-NAME-001` and its deliberately-red guard

The bug itself does not block AC4 (§ AC4 above). **Its regression guard does block the gate**
— see item B3.

## 3.2 Other observations (non-blocking)

- **`update_org_affiliation_impl` has an unreachable arm.** The row is selected with
  `ended_on is null`, so `v_ended` is always NULL and the `if p_started_on > v_ended … HC0R3`
  branch can never fire. Dead defensive code, not a vacuous test — nothing asserts that arm
  for this door (`HC0R3` appears only in `304`'s SQLSTATE domain census). Harmless; worth
  deleting or commenting so a future reader does not take it for a live guard.
- **`378` §5.1's pre-state is already NULL** (`4.2` cleared it two statements earlier), so an
  implementation that silently *ignored* whitespace-only input is indistinguishable from one
  that normalises it. Not fully vacuous — storing `'   '` verbatim would still red it — but
  the no-op branch is unreachable as evidence. Set `job_title` to a real value immediately
  before §5.
- **`379` §1.1 lacks the existence guard §1.3 supplies for §1.2.** §1.1 counts over a
  hardcoded list of five `app.*_impl` kernels `AND has_function_privilege(...)`; a renamed or
  absent kernel contributes no row, the count is 0, and it passes while measuring nothing. The
  author clearly understood the trap one assertion later. Benign today — all five exist live —
  but add the mirror.
- **`lookupOrgPeople`'s comment over-promises.** `src/lib/affiliations/actions.ts:305` says
  the result carries `orgAffiliationStatus` *"so the UI can say 'encerrado'"*. No
  rehire/registration component consumes it; the only renderer is `user-directory-list.tsx:170`,
  fed by `listOrgUsers`. An org-offboarded person is found by CPF search and presented
  **without** the "encerrado" signal. A comment is an assertion and this one is false.
- **`supabase/tests/376` is a genuine numbering gap**, not lost work — it has never existed on
  any ref and nothing in `docs/` references it. The AFF4 suite is 371-375 + 377-380, complete.
- **AC3's rehire depends on a column the roster no longer trusts.** `affiliate_person_impl`'s
  tenant check is still `profiles.home_organization_id`, consistent with D10's Phase 2
  deferral — but worth carrying into Phase 2's scope, since offboarding deliberately does not
  clear that column and that is *why* rehire works.

---

# 4. Blocking items (CHANGES REQUESTED)

Each keyed to the requirement it violates.

### B1 — ADR 0154 D1 is contradicted by the shipped build, with no ADR recording the retraction
**Violates:** CLAUDE.md §8 (*"Non-trivial decisions get a 5–10 line ADR … header carries a
`**Supersedes:**` / `**Amends:**` label"*) and the standing lesson that only the amending
document knows about the amendment.

ADR 0154 D1 reads, as accepted law: *"The org-affiliation predicate … replaces
`home_organization_id` in **`listOrgUsers` and `listHospitalUsers`** as well as in
`list_org_people`."* The build moves `listOrgUsers` and `list_org_people` only;
`listHospitalUsers` destructures `includeEnded` away (`src/lib/queries/org-users.ts:596`) and
keeps `hospitalPeopleIds` scoping. That is the correct engineering call — the reasoning is
sound and I verified the measurement behind it — but the retraction lives **only** in a plan
bullet (`docs/plans/aff4-org-affiliation.md:461`) and a code comment (`org-users.ts:569-583`).

Neither is a decision of record. `grep -l 0154 docs/decisions/*.md` returns 0151, 0154 itself,
the out-of-scope 0155, and INDEX.md — **nothing amends it.** `npm run lint:adr-index` cannot
catch this: a missing `Amends:` label leaves no trace, by construction. Anyone opening 0154
after AFF4 reads a governing sentence the code contradicts, and — per the recorded pattern —
the stale half is the *tighter* one, so it reads as care.

**Fix:** a short ADR **0158** (`docs/decisions/INDEX.md` states 0158 is next free — take it
from there, not by eyeballing) with `**Amends:** 0154`, recording the option-A ruling, the
measurement behind it (a `hospital_admin` reads 1 org-affiliation row vs an `org_admin`'s 29),
and the residual it accepts. Then `npm run adr:index`.

### B2 — D3's blocker enumeration is destroyed in the TS layer
**Violates:** ADR 0151 D3 (*"Blockers are enumerated to the caller"*) and AC1's guided
completion.

The door does its half correctly, emitting
`{kind, role, hospital, commission}` per blocker. `parseBlockers`
(`src/lib/affiliations/actions.ts:131-147`) keeps only `role` and `commission` and **drops
`kind` and `hospital`**:

```ts
const row = b as { role?: unknown; commission?: unknown }
return {
  role: typeof row.role === 'string' ? row.role : '',
  commission: typeof row.commission === 'string' ? row.commission : null,
}
```

For a `hospital_affiliation` blocker the door sends `role: null, hospital: '<name>',
commission: null`. So `role` becomes `''`, `ROLE_LABELS['']` is `undefined`, and
`org-offboarding-wizard.tsx:184-187` renders the `<li>` as the bare string:

```
 — cargo do hospital
```

No hospital name, and it is labelled a *cargo* (a role) when it is a *vínculo*. This is the
**most common blocker** — D3's own no-cascade design guarantees the operator hits it first —
and it is exactly the difference the ADR names between *"an actionable refusal"* and *"it did
not work"*.

**The test that should have caught it asserts presence only.**
`e2e/aff4-org-offboarding.spec.ts:118` — `await expect(refusal.locator('li')).not.toHaveCount(0)`
— while the test's own title says *"the active hospital affiliation named"*. The defect is
invisible to the suite by construction.

Note this is **not** the already-filed `ROLE_LABELS[b.role] ?? b.role` follow-up. That entry
describes an *untranslated* role key and rules it an acceptable trade-off. This is *unnamed*,
and the hospital name is discarded before the fallback is ever reached — a different mechanism
with a different verdict.

**Fix:** carry `kind` and `hospital` through `parseBlockers`; render the hospital name for
`kind === 'hospital_affiliation'`; strengthen the E2E assertion from presence to the hospital
name.

### B3 — the deliberately-red guard prevents §6 step 2 from declaring green
**Violates:** §6 step 2 (*"the full E2E suite runs once to declare green"*).

`e2e/aff4-meus-dados.spec.ts:49-60` holds four correct, unweakened assertions
(`toContainText('Hospital Central A')` etc.) deliberately left failing until the RLS is fixed.
Leaving the assertion correct rather than bending it to the defect is **exactly right** and I
do not want it changed.

But there is **no `test.fail`, no `test.skip`, no `test.fixme`** — it is a bare failing
assertion, and it has already been observed failing
(`test-results/aff4-meus-dados-…-chromium/error-context.md:57`). Mechanically, `npm run e2e:prod`
cannot come back green, and a bare red is indistinguishable from a regression to whoever reads
the run.

**Two acceptable resolutions, PO's choice:**
1. Fix the root cause — add a self-affiliation leg to `hospitals_select`
   (`EXISTS (select 1 from hospital_affiliations where principal_id = auth.uid() and
   hospital_id = hospitals.id and ended_on is null and voided_at is null)`). ⛔ **If this is
   taken, it is an RLS policy change and it re-arms §6 step 1's diff-scoped door sweep over
   `hospitals_select`** — derived with `scripts/door-sweep-cases.sh`, never by hand.
2. Annotate the guard `test.fail()` so a fix flips it to *"unexpectedly passing"*, and record
   the known red in the Bug Log before the gate runs.

Doing neither means the gate's green figure has a pre-known exception carried in prose, which
is the shape §6 exists to prevent.

### B4 — AC5 fails: no registration UI can supply a start date, for either tier
**Violates:** AC5, ADR 0151 D13, and blocks `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` (hence
AC6).

Full evidence at § AC5. Summary: one shared `affiliationStartedOn` parameter feeds **both**
affiliation rows; no control anywhere in `register-person-wizard.tsx` sets it; F4 never
started. Both rows silently take `coalesce(p_started_on, current_date)` — verified in the live
catalog for `app.affiliate_person_to_org_impl` **and** `app.affiliate_person_impl`.

**Fix:** build F4 — an *"Início do vínculo (opcional)"* `DatePicker` in the wizard's step 2,
mirroring `register-person-flow.tsx:498-517`, wired to `affiliationStartedOn`. Correct the
stale header at `register-person-wizard.tsx:59-63` in the same change, and re-scope the bug
from *"org-tier"* to *"both tiers, one shared parameter"* — the correction makes the impact
worse, not smaller, and the current framing would let a fixer wire half of it.

Also close D14's own gap in the same pass or file it explicitly: **affiliation dates are never
rendered on `/conta/meus-dados`** although D14 enumerates them and the payload carries them
(`page.tsx:138-158`).

---

# 5. Record-step obligations (not blocking, but each must land)

| # | Obligation |
| --- | --- |
| R1 | **Correct 374's provenance in the AFF4 record.** It was *not* pre-existing: `git log --follow` → one commit, `09a2aef4`, on this branch; absent from `main`, which stops at 373. The keystone is strong and its red-first evidence stands — only the narrative is wrong. |
| R2 | **File the actor-attribution residue as a FUP** (index line **and** body). It is currently stated only in `7816bd8a`'s message and a migration header — and migration text is stale by design here. Measured: 1 of 50 `trg_audit_*` triggers carries `actor_user_id`. |
| R3 | **Record AC3 as a named absence**, not as covered: no E2E signs in as a `hospital_admin`; `378` §1 pins the rehire with an **org_admin** actor and `302` §2.1 pins a `hospital_admin` on a **non-rehire**. Cheapest close is a second actor arm on `378` §1. |
| R4 | Tighten `303` — name `grant_role`/`revoke_role` in a `1.8`-style assertion. §1.7's slack is exactly the size of that family. |
| R5 | File the audit-trigger **class** gap: `trg_audit_hospital_affiliations` still enumerates UPDATE arms by column name. The instance was fixed; the mechanism that nearly cost D7/D8 their truth is unchanged. |
| R6 | Fix `379` §1.1's missing existence guard and `378` §5.1's already-NULL pre-state (§ 3.2). |
| R7 | **The plan's Risks section is now materially stale and would misdirect gate attribution.** It states the DatePicker branch is HELD and that *"AFF4's gate runs on a tree **excluding** those 8 sites."* Both are false: `3d588673` merged it into AFF4, legitimately, under the plan's own dissolution clause (`f9316295` gave that branch its own `e2e:prod` pass first). The RESUME block likewise still lists merge order as an open PO decision and F6 as held, while `1cbaa1b7` shipped F6. |
| R8 | The eleven-FUP disposition (AC6) — see § 6. At minimum `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` is undischargeable until B4 lands. |
| R9 | Add the QA Verdicts row (text supplied to the lead separately — **PROGRESS.md has 322 bytes of headroom under the 81920 cap; `qa` did not write to it**). |
| **R10** | **A live PROGRESS.md line cites an evidence string that exists nowhere.** `:363` reads *"the trigger's name is verified clean **in Chromium** (`"Suspenso até (opcional) 15/07/2026"`)"*. `git grep "15/07/2026"` over `docs src e2e scripts supabase` returns **zero hits**. The real assertion is two regexes (`/suspenso até/i` present, `/remover data/i` absent). The claim is **substantively true** — the browser assertion exists and runs in the state the bug requires — but the quoted artifact was produced by no measurement. Worse, its direction: `c2d8f149` existed *specifically to sharpen* that evidence limit, and the later rotation `dab8be34` rewrote the line into a stronger claim with a fabricated-looking citation. **A compression pass UPGRADED an evidence claim.** This branch already carries one commit re-recording a caveat a compression deleted; this is the same mechanism running the other way, and it is the more dangerous direction because the result reads as more rigorous. Replace the quoted string with the two regexes and the spec's `file:line`. |
| R11 | `FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY`'s **body prescribes a fix the landed repair deliberately did not take** — it ends *"address the control … by its accessible name … `getByRole('button', { name: 'Suspenso até (opcional)' })`"*, while `192a95c3` drives `button[aria-haspopup="dialog"]` *"never by name, so it is unaffected by F0's accessible-name change."* Rotated verbatim as-is, the archive would preserve a prescription contradicting the code that discharged it. Also: `:362` still carries no ✅ although the repair landed. |
| R12 | **PROGRESS.md has no AFF4 row in § Phase Status, § Test Run Summary, or § QA Verdicts** — AFF4 is tracked entirely from the § Now bullet (`:37-52`). Record must add all three **plus** the bug-log rotation into **322 bytes**. ⛔ Per the standing rule, make room by rotating, never by compressing — see R10 for what the last compression pass cost. |

---

# 6. What I could NOT verify

A reviewer's *"could not verify"* list is a work item, not a disclaimer. This is complete.

1. **`npm run e2e:prod` has not run.** It is §6 step 2 and the lead's. Everything I say about
   E2E is about **spec text and one recorded failure artifact**, never about a suite outcome.
   ⚠ **AFF4's `e2e:prod` will be the FIRST run covering `61e23659`** (case-access grant-expiry
   date picker) — committed 10:20, *after* `f9316295`'s 09:56 pass on the held branch — **and
   also the first covering `b953854c`** (12:50), the DatePicker clear-affordance repair itself.
   Neither has ever been through a full prod-standalone run.
2. **The DatePicker repair — I initially recorded this wrongly and am correcting it here.**
   The plan (lines 705-724) says the repair is *"verified **STRUCTURALLY, NOT BEHAVIOURALLY**"*
   and that *"browser-level confirmation is owed by T2–T5"*. **That debt was paid** — but not
   in an `aff4-*` file, which is why it reads as outstanding. It is at
   `e2e/user-registration.spec.ts:622-623`:

   ```ts
   await expect(trigger).toHaveAccessibleName(/suspenso até/i)
   await expect(trigger).not.toHaveAccessibleName(/remover data/i)
   ```

   measured **with a value set** (`pickDate` runs at `:617`) — the state the bug requires, and
   the state the FUP's original worked example was blind to. The pair is non-vacuous: the
   negative assertion alone would pass on an empty name, and the positive one rules that out.
   **The plan's text is stale, not the evidence.**

   What genuinely remains unverified is narrower: **`case-access-panel.tsx:472`**, whose picker
   renders only under `preset === "date"` and which **no spec reaches**. It is also the single
   site touched by `61e23659`. That one is absence of a verdict, not absence of coverage.
3. **I did not re-run any authz arm, the pgTAP suite, Vitest, or the lint gates.** I reviewed
   the census/floor/sweep *disposition* (`ac638174`, `e6cad0f3`) and independently confirmed
   only the findings-baseline blast radius (1 insertion). Per the plan's own Risks section,
   **no gate figure from this branch is quoted anywhere in this review.**
4. **The diff-scoped door sweep over B3's three altered policies** — I confirmed the recipe
   learned `alter policy` (D16b) and that the baseline was not truncated (ADR 0153), but I did
   not re-derive the sweep's case list or re-run it. If B3's `ERROR`/`BLIND` dispositions were
   mis-ruled, this review would not catch it.
5. **`get_own_person_record` carries no ARM 1 verdict, and cannot.** Correctly backlogged with
   a mutation-proven keystone. Named here so it is read as a *named absence with a keystone*,
   never as coverage.
6. **The "option A" PO ruling itself.** It exists only as a plan bullet and a code comment (see
   B1). I verified the *measurement* behind it against the live catalog and it holds; I cannot
   verify the ruling was made as described.
7. **`deactivateUser`'s audit row.** AC1 says *"every step audited"*. I verified the org-end
   step (`trg_audit_organization_affiliations`) and the rehire step. I did **not** verify that
   the wizard's optional deactivation step emits an audit row.
8. **Remote/production catalog.** Everything is measured against the **local** stack. The AFF4
   migrations are not applied remotely. The `db push` verification (migration count + new
   relations, read from the remote catalog, never from `db push`'s report) is the Record step's.
9. **Anything a peer session changed mid-review.** Two commits landed while I worked (§ Scope
   excluded). I did not re-audit against the new tip.
10. **`deriveUserStatus` / the directory's status pills** under the new roster predicate. The
    scope set changed from a `profiles` column to an id list; I checked the predicate and the
    `count: 'exact'` reasoning in-file but did not verify the three pill counts still sum
    correctly against a live query.

---

# 7. Summary

| Criterion | Verdict |
| --- | --- |
| AC1 — offboard end-to-end, audited, roster + filter | **MET**, blocked by B2 (blocker enumeration) |
| AC2 — C5 differential in pgTAP | **MET** (record correction R1) |
| AC3 — rehire is one action by that hospital's admin | **MECHANISM MET; criterion unasserted** (R3) |
| AC4 — `/conta` self record, read-only, masked CPF | **MET**; D14 field list incomplete (D14-GAP) |
| AC5 — registration writes the typed start date | **FAILS** (B4) |
| AC6 — eleven FUPs discharge at Record | **NOT MET** — #4 must not discharge; #8 has a live `⚠ OPEN`; #7's body contradicts its repair. #6/#10/#11 discharged on `main` before the branch, so the criterion's wording is itself defective |
| Security / RLS / doors / audit / PHI | **NO FINDINGS.** Strongest part of the program. |

**CHANGES REQUESTED** — blocking set: **B1, B2, B3, B4**.

B4 is the substantive one. B2 is a small fix with a disproportionate effect on the feature's
usability. B1 and B3 are cheap and both are the kind of omission this repo has a recorded
scar for — a decision of record left reading as law after the build contradicted it, and a
gate figure carrying an exception in prose.

I want to close by saying what the record should say about the security work: the doors, the
policy audience, the oracle-kills, the D8 asymmetry, the constraint-trigger backstop, the
audit verb/actor pairing, and the census disposition are all correct under direct catalog
measurement, and several of them are correct in ways that only show up when you try to break
them. Nothing in § 2 needs to change.
