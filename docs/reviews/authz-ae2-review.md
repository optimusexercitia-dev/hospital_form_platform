# Gate AE2 — step-3 QA review (AE2.0 → AE2.4 increment 3)

**Reviewer:** `qa` · **Date:** 2026-08-28 · **Branch:** `authz-ae2-affiliation-tenancy`
**Head reviewed:** `2664081c` (`test(ae2.4): inc 3 sweep CLEAN, and an AE1 ERROR finally earns a verdict`)

## Verdict — ⛔ `CHANGES REQUESTED`

Six blocking findings. One is a **live authorization split in application code** (B1); three are
**keystones that cannot fail or do not measure what they name** (B2, B3, B4); one is a **claim
repeated in four documents that is false against the shipped code** (B5); one is **Phase Gate
step 1 evidence that does not exist for the increment ADR 0164 makes a hard gate on the column
drop** (B6).

This is, with that said, the most rigorously self-audited phase record I have reviewed in this
repo. The census carries its predicates, the differentials separate hand artefacts so they cannot
drift into agreement, the mutation tables are keyed by **subject** rather than by assertion, and
three of the findings below were *anticipated in prose by the phase itself* and then not closed.
The failures here are almost all of one shape: **a property that was correctly named and then
measured on an axis that could not carry it.**

---

## Scope

### In scope
`docs/progress/authz-ae2.md`; ADRs [0163](../decisions/0163-offboarded-person-lifecycle-authority.md)
(+ Amendment 1), [0164](../decisions/0164-tenant-containment-moves-from-creation-time-to-the-destructive-event.md),
[0165](../decisions/0165-affiliation-derived-tenant-gate-and-its-widening.md);
`docs/design/authz-ae2-home-org-consumer-census.md`; `docs/plans/authz-evolution.md` § AE2;
migrations `20261003005400`, `…005500`, `…005600`, `…005700`; pgTAP `390`–`394`;
`src/lib/users/`, `src/lib/queries/`, and the TS the increments actually touched
(`src/lib/members/` is in scope as a *consumer*, see B1); ARCHITECTURE.md Rule 13.

### ⛔ Explicitly OUT of scope — because it does not exist yet
- **AE2.4 increment 4** (`listLinkableOrgUsers` shape C-b′, and `resolveOrInviteUser`). Marked `🔜`
  in `docs/progress/authz-ae2.md:22`. `src/lib/queries/members.ts:243` still carries
  `.eq('home_organization_id', organizationId)` and `src/lib/members/invite.ts:70` still carries
  the column tenant check. **Neither is reviewed as a defect** — both are assigned, and ADR 0165
  § Consequences names them. They appear below only where another document claims they are done
  (M2, M4).
- **The column drop.** `profiles.home_organization_id` is untouched: no `attnotnull` change, no
  values changed, no drop migration on disk. Every "after the drop" property in the ADRs is
  therefore a **prediction**, and this review does not certify any of them.
- **Gate AE2 itself.** Per `[PA-F18]` the increments carry their own subsets; the phase gate closes
  over the last increment, which is not built. This is a step-3 review of what has landed.

### ⛔ Method constraint, stated first because it shapes every verdict below
**No database was touched.** Another session owns the local Supabase stack and is running `db reset`
cycles; a measurement taken mid-reset is worse than none, because it reads like one. No `psql`, no
`supabase`, no pgTAP, no migration, no ARM script was run. `PROGRESS.md` and
`docs/progress/follow-ups.md` were **read only** — a third session is editing both, so my verdict
row is **not** written into `PROGRESS.md`; see § *Deferred write* at the end.

Every claim I could not settle from the tree is in § **Could not verify — needs DB**, with the exact
command. That section is the first-class product of this review, not a disclaimer: several of the
blocking findings below reduce to *"a document asserts a measurement whose predicate nobody can
point at"*, and the same discipline applied to my own review means I name what I did not measure.

---

## Blocking

### B1 ⛔ The fifth sibling-axis split, and it is live application code: `addStaff` still gates on the column the picker was moved off

**Requirement violated:** ADR 0163 bound 3 (retention "never makes the person a member of
anything"); migration `20261003005500`'s own contract ("an ENDED row retains administrative
authority but never **membership eligibility**"); Architecture Rule 13 (affiliation LOCATES,
membership GRANTS).

`supabase/migrations/20261003005500_ae22_roster_predicate_on_affiliations.sql:111-121` re-predicated
the read side:

```sql
   -- AE2.2: was `pr.home_organization_id = v_org_id`, which carried NO
   -- affiliation filter of any kind and so listed a fully offboarded person as
   -- addable. ACTIVE affiliation only ...
   where exists (
           select 1 from public.organization_affiliations oa
            where oa.principal_id = pr.id and oa.organization_id = v_org_id
              and oa.ended_on is null and oa.voided_at is null)
```

The **write** side did not move. `src/lib/members/actions.ts:205-219`:

```ts
  // Defense in depth: the target must be a registered, ACTIVE user anchored to
  // THIS organization. Mirrors the picker's addable-set gate, exactly (no cap).
  const { data: profile } = await admin
    .from('profiles')
    .select('id, home_organization_id, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (!profile || profile.home_organization_id !== orgId || !profile.is_active) {
```

**Concrete failure scenario.** Ana is a nurse at Rede A. Her org affiliation is ended at offboarding
(`end_affiliation`, ADR 0151 D5's ordinary path). Her `home_organization_id` is still Rede A — the
column is write-once at signup (census § *NOT NULL*, Class 3a finding). A `staff_admin` of a Rede A
commission POSTs `addStaff` with Ana's `userId` (the picker will not offer her, but the form is a
POST and the header at `:170-174` says this re-verify exists precisely so *"a tampered form cannot
attach a foreign-org or deactivated account"*). `addStaff` reads `profiles` through
`createAdminClient()` — **service role, RLS bypassed** — sees `home_organization_id === orgId`,
and seats a fully-offboarded person on a commission. Membership GRANTS. Rule 13's second half is
defeated by a predicate that follows from a stale column.

The mirror error runs the other way too: a person org-affiliated to `orgId` whose column is NULL or
names another org **is offered by the picker and refused at submit** with `userNotAddable` — a
`.eq` on a column that RLS no longer keys on.

**Why this is blocking and not deferrable to increment 4.** Increment 4's target list is
`listLinkableOrgUsers` and `resolveOrInviteUser` (ADR 0164 D4, ADR 0165 § Consequences). `addStaff`
is named by **no** increment. It is the same enumerating property the phase already filed —
*"an authorization preamble that resolves the column"*, `FUP-AE2-PERSON-PREAMBLE-THREE-COPIES` — one
module over, and the comment at `:206-207` asserts the sweep is complete (*"Mirrors the picker's
addable-set gate, exactly"*) which is exactly how this class survives review.

**Ask:** re-predicate `addStaff`'s re-verify onto the same active-org-affiliation existence the RPC
now uses (or call the RPC and intersect), and pin it with a test that reds if either side moves
alone. If the PO prefers to defer, it must be an explicit decision with the offboarded-person seat
accepted in writing — not left as a stale comment.

---

### B2 ⛔ ADR 0165's "materially wider" hospital-tier widening is unmeasured: `393` § 5 holds the ACTOR axis constant

**Requirement violated:** plan § AE2.3 (*"every widening must be enumerated and approved
[PA-F13]"*, and the differential must measure it); ADR 0165 § Consequences bullet 2.

ADR 0165 flags this as the widening's sharpest edge
(`docs/decisions/0165-…:56-58`):

> **The hospital tier makes it materially wider**: that door's authority arm is
> `org_admin OR hospital_admin`, so a **hospital admin** can claim an orphan too. Stated rather than
> buried inside "the same predicate".

`supabase/tests/393_ae24_containment_on_destructive_event.sql:509-528` drives **both** tiers with the
same actor, `…0000b1` = `orgadmin.a`:

```sql
  if v_row.tier = 'org' then
    perform app.affiliate_person_to_org_impl(
      '00000000-0000-0000-0000-0000000000b1'::uuid, v_row.person, …);
  else
    perform app.affiliate_person_impl(
      '00000000-0000-0000-0000-0000000000b1'::uuid, v_row.person, …);
  end if;
```

Hospital Central A is in org A, so `app.is_org_admin_of_for(v_org, p_actor)` — the **first** arm of
the hospital door's authority check — short-circuits on all five H-cells and
`is_hospital_admin_of_for` is never evaluated. `ae24_gate` carries no actor column at all, so the
axis is **structurally absent**, not merely unpopulated.

`393:664-669` (§ 5.2) then asserts:

> *"the hospital-tier WIDENING is the declared {H4} — and it is **materially wider** than § 3's,
> because it hands the orphan-claiming capability to `hospital_admin` as well."*

**That sentence is not measured by that assertion.** H4 was measured with an `org_admin` actor;
the cell cannot distinguish "a hospital_admin can claim an orphan through the hospital door" from
"an org_admin can claim an orphan through the hospital door" — and only the first is the widening
being declared. § 5.1's own rationale (`393:656-662`, *"the door's authority arm is wider
(org_admin OR hospital_admin), so the delta had to be measured through this door and not inferred
from § 3"*) names the axis the fixture holds constant.

**Concrete failure scenario this cannot see.** Suppose a later edit narrows
`app.is_hospital_admin_of_for` or reorders the hospital door's authority disjunction so the
hospital arm no longer admits. `393` § 5 stays green on every cell, because it never took that arm.
Equally: if the hospital arm were *widened*, § 5 would not notice either.

**Ask:** add an actor column to `ae24_gate` and run the H-cells with a `hospital_admin` who holds
**no** `org_admin` membership (the seed has `hospitaladmin.a1`). H4 measured with that actor is the
cell ADR 0165 declares. Until then, treat "a hospital_admin can claim an orphan" as an argument,
not a measurement, and say so in the ADR.

---

### B3 ⛔ The four highest-risk widening cells prove only "the door did not raise", never that a row was written

**Requirement violated:** plan § AE2.3 (the differential covers writes; a read-only differential
proves the wrong half) — and the suite's own stated standard.

`393:523` is the entire success signal of the write differential:

```sql
  return 'ok|';
```

with `measured_new` derived at `:541` as `(v like 'ok|%')`. Write-through non-vacuity exists for
exactly three cells — § 3.8 (`:600-605`, W3), § 3.9 (`:607-614`, W2), § 5.6 (`:692-702`, H2) — and
**none of the four declared widenings is among them**. W5, W6, W7 and H4 (`393:288-292`) are the
orphan-claiming cells: the ones where the new gate admits a state the column gate refused. Each is
asserted only as `measured_new = true`, i.e. *no exception was raised*.

§ 3.8's own label states the standard the widening cells do not meet:

> *"W3 … was actually **AFFILIATED**, not merely 'not refused'."*

**Concrete failure scenario.** A future edit adds an early `return null` (or an idempotency branch
that matches too broadly) ahead of the `insert into public.organization_affiliations`. Every one of
§ 3.1, § 3.2, § 5.1, § 5.2 stays green, and § 3.5's `'5|5|7|3'` mixedness floor is satisfied
identically, because the floor counts *verdicts*, not *rows*. The declared widening would then be
"the door accepts and silently does nothing" — which is a live product regression on the only
recovery path ADR 0164 accepts for the orphan window, and the differential would report it as
correct.

**Ask:** extend `pg_temp.try_gate` to return the inserted affiliation id (or `ok|<id>`) and assert
row existence for W5/W6/W7/H4, exactly as § 3.8 does for W3.

---

### B4 ⛔ Architecture Rule 13's keystones are unguarded: `394` § 9.2 and `390` § D10 can both pass because there was nothing to share

**Requirement violated:** ARCHITECTURE.md Rule 13, final bullet — *"**Assert it, do not review for
it.** … A rule with no failing test is a convention."* Rule 13 is this phase's own deliverable
(AE2.5), so a vacuous keystone here is a deliverable that does not exist.

`supabase/tests/394_…:1069-1079`:

```sql
select is(
  (select count(*)::int from x_caps cp
     cross join (values ('Q3'), ('Q7')) as v(label)
     join x_targets tg on tg.label = v.label
    where app.can_administer_person_for(cp.cap, tg.target, (select csh from pg_temp.k()))),
  0,
  '§ 9.2 ARCHITECTURE RULE 13 — a caller who SHARES an active organization '
  'affiliation with the target but holds NO membership anywhere is denied for every capability. …');
```

The shipped predicate (`20261003005700_…:152-232`) returns `false` at **four** points earlier than
any membership consideration: `p_actor is null`, `cardinality(v_orgs) = 0`,
`not app.is_active(p_actor)`, and `cardinality(v_administered) = 0`. Nothing in `394` asserts that
`CSH` **exists**, is **active**, or in fact **shares** an active org-B affiliation with Q3/Q7.
`CSH` is deliberately excluded from `x_callers`, so § 0.3 (`:658-662`, no caller is `is_admin`) and
§ 0.4 (`:664-668`, every caller is `app.is_active`) — the two guards written for exactly this — **do
not cover it**.

The correct shape exists one suite over. `392:624-634`:

> `'4.1 PRECONDITION: staff1.ccih and T1 BOTH hold an ACTIVE org-A affiliation — so § 4.3's denial
> is "sharing an affiliation grants nothing", not "there was nothing to share"'`
> `'4.2 PRECONDITION: staff1.ccih holds NO org_admin membership at any scope — the GRANT half is
> genuinely absent'`

**`394` § 9.2 is `392` § 4.3 with both preconditions deleted.**

The same hole sits on the read side's ⭐⭐ keystone. `390:398-399` (§ D10) asserts the collapse cell
for `plain_staff`, and `390` asserts **nowhere** that `plain_staff` holds an active org-A
affiliation or that they hold no `org_admin` membership. § 0.5 (`390:212-217`) guards memberships
for the **fixture persons**, not for the caller. The premise happens to hold because `seed.sql:404`
affiliates every non-admin profile to its home org — inherited, unasserted, and a shared fixture is
a contract with ~900 tests, not a stable premise.

**Concrete failure scenario.** A seed change stops affiliating `staff1.ccih` (or `CSH`'s
construction at `394:238-239` drifts). Both keystones go green *because the caller shares nothing*,
and the LOCATE/GRANT collapse — the one shape Rule 13 exists to forbid, and the one that
"type-checks identically" — becomes undetectable on both sides simultaneously.

**Ask:** port `392` § 4.1/§ 4.2's two preconditions into `394` § 9 (for `CSH` × Q3/Q7) and into
`390` § 0 (for `plain_staff`). Two assertions each; they are the difference between a rule and a
convention by the rule's own words.

---

### B5 ⛔ "administrable by `platform_admin` alone" is false against the shipped doors — it is **nobody** — and the claim stands in four documents

**Requirement violated:** ADR 0163 bound 1 (a bound "stated so the implementation cannot widen by
reading" — here it is wrong in the *narrowing* direction, which is why it reads as care); ADR 0164
§ Consequences, which uses this claim as the reassurance that makes the accepted orphan window
tolerable.

The claim, verbatim, in four places:

| location | text |
|---|---|
| `docs/decisions/0163-…:59` | a person whose only org affiliation was voided "…is `platform_admin`-only" |
| `docs/decisions/0164-…:65` | "…in **no** roster …, **administrable by `platform_admin` alone**" |
| `supabase/migrations/20261003005600_…:45` | "…in no roster, administrable by `platform_admin` alone." |
| `supabase/tests/393_…:197` | "…NO roster, administrable by `platform_admin` alone." |

Measured against the code: **none of the six AE1.3 person doors has a `platform_admin` arm.** Each
gates solely on `app.can_administer_person_for` — `set_person_active_impl` `…005700:349`,
`suspend_person_impl` `:390`, `update_person_fields_impl` `:432` and `:461`,
`upsert_credential_impl` `:516`, `delete_credential_impl` `:607`, `finalize_invited_person_impl`
`:646` — and that predicate has no `platform_admin` arm **by deliberate design**
(`…005700:207-210`: *"⛔ `platform_admin` is deliberately NOT an arm — `authorizeOrgOps` excludes it
(ADR 0041 noun rule) … pgTAP 384 §6 asserts a platform_admin is refused"*), and returns `false`
outright on `cardinality(v_orgs) = 0` (`:199-201`).

So a person with **zero non-voided organization affiliations** — the voided-only case of bound 1,
and the orphan window of ADR 0164 — is administrable for `fields`, `credentials`, `cpf_change` and
`lifecycle` by **nobody at all**. The migration comment at `…005700:196-198` says so plainly
("*administrable by nobody — an accepted narrowing*"), and the four documents above say the opposite.

**Concrete failure scenario, and why this is not merely a wording fix.** A half-failed `createPerson`
orphans a profile. Operations reads ADR 0164, concludes a `platform_admin` can repair it, and
discovers no door will. The **actual** recovery path is ADR 0165 D1's widening — *any* `org_admin`
of *any* organization (or, per ADR 0165, any `hospital_admin`) who possesses the uuid may claim the
person by affiliating them. That is the opposite security posture from the one the record advertises:
the window is defended as *"only `platform_admin` can reach them"* and repaired by *"anyone with the
id can take them"*, and both sentences appear in the same ADR.

**Ask:** (a) correct the claim in all four locations to "administrable by **nobody** through the six
person doors; recoverable only by re-affiliation under ADR 0165 D1"; (b) settle whether a
table-level `platform_admin` path exists (**CNV-4** below) — if it does, the claim is true at a
grain the ADRs do not state, and stating the grain is the fix; (c) if neither, ADR 0163 bound 1 needs
re-ruling, because "voided-only ⇒ `platform_admin`-only" was ruled, and "voided-only ⇒ nobody" was
not.

---

### B6 ⛔ Phase Gate step 1: the increment that is a hard gate on the drop has no ARM evidence, and `PROGRESS.md` states figures the increment did not produce

**Requirement violated:** CLAUDE.md § 6 step 1 (`ARM=census`, `ARM=hat`, `ARM=floor`, and
`FROMFINDINGS=1 ARM=wrapper` must hold; a diff-scoped door sweep over every touched RLS policy or
`prosecdef` boolean gate); ADR 0079 Amendment 3 (*"`ARM=census` is the one that catches a gate you
just added"*); ADR 0164 § Decision (increment 3 is a **hard gate** on the column drop).

What the phase record actually carries:

| increment | census | hat | floor | wrapper | diff-scoped sweep |
|---|---|---|---|---|---|
| AE2.2 (`authz-ae2.md:347-351`) | 566/602 | 6/6 | 72 | 41 | SWEPT 4 · COVERED 4 · BLIND 0 |
| inc 1 (`:770-773`) | 565/601 | **not run** | **not run** | 41 | **not run** — `:773`: *"Not run here: `ARM=floor`, `ARM=hat`, the diff-scoped policy sweep and `e2e:prod` — the lead's."* |
| inc 3 (`:1346`, `:1348`) | **none** | **none** | **none** | **none** | `door-sweep-cases.sh` **DERIVED (0) — 1 case: `can_administer_person_for`**; `:1348`: *"Not run here, by instruction: the ARM sweep and `e2e:prod` — the lead's."* |

`PROGRESS.md:50` nonetheless states, for increment 3:

> Gate: sweep **SWEPT 1 · COVERED 1 · BLIND 0**, 4 arms **0** (`census` 565/601 · `hat` · `floor` 72
> · `wrapper` 41)

Every one of those figures is, digit for digit, an earlier increment's: `565/601` is **inc 1**'s
census (`:770`), `72` and `41` are **AE2.2**'s floor and wrapper (`:349-350`). The one novel figure
— `SWEPT 1 · COVERED 1 · BLIND 0` — has no corresponding entry in the increment's own gate table,
which records only that the case was **derived**.

**Why this is blocking rather than bookkeeping.** The increment's own arm-domain analysis
(`:1209-1212`) states the hazard precisely:

> ⚠ **`can_administer_person_for` is in two domains and already carried a verdict — which is the
> danger, not the comfort.** It keeps its NAME and changed its BODY, and census backstops only
> *newcomers*; the standing `COVERED` verdict was earned against the **OLD** predicate.

That is the exact ADR 0079 `ALTER POLICY` hazard repeating on a function, and the arm that answers it
— a diff-scoped sweep over the derived case — is the one whose result appears in `PROGRESS.md` and
nowhere else. Additionally `app.person_audit_organization` is **brand new** and, per the same table,
in **no** arm's domain; a new gate is precisely what `ARM=census` exists to catch, and `ARM=census`
was last enumerated before that function existed.

**Ask:** re-run, on a quiet tree and a fresh reset, at head `20261003005700`: `ARM=census`,
`ARM=hat`, `ARM=floor`, `FROMFINDINGS=1 ARM=wrapper`, and the diff-scoped sweep over the derived
case. Record the **enumerated figures** in the increment's own gate table (plan rule 2 — *never as
exit 0*), and make `PROGRESS.md` cite them rather than carry copies. If the lead already ran them,
the fix is to write the figures where the increment can be audited from; a figure that exists only
in the summary is not evidence.

---

## Major

### M1 ADR 0165 changes ADR 0164's Decision and does not declare `**Amends:** 0164`
ADR 0164 § Decision enumerates increment 1 as *"this trigger **and** `affiliate_person_to_org_impl`'s
column gate"* — the org door only. ADR 0165 D3 (`0165-…:40-46`) adds `app.affiliate_person_impl` and
says so explicitly: *"⚠ This **reverses the increment's original scope**, which had the hospital door
in a later slice."* Its header declares `**Amends:** 0151` alone. `docs/decisions/INDEX.md:189`
therefore shows `amends 0151`, and `0164` (`INDEX.md:188`) shows no inbound edge.

Per CLAUDE.md § 8 and ADR 0140 this is the one class **no gate can detect** — an undeclared
amendment leaves no trace, and the human check at the Record step is the only control. **Ask:** add
`**Amends:** 0164` with the scope-reversal as its reason, run `npm run adr:index`.

### M2 Migration `…005500` asserts a sibling moved that did not move
`20261003005500_ae22_roster_predicate_on_affiliations.sql:78-83`:

> `-- ⚠ The application-side twin (`listLinkableOrgUsers`,`
> `--   src/lib/queries/members.ts) moves in the same increment.`

It did not. `src/lib/queries/members.ts:243` still reads `.eq('home_organization_id', organizationId)`,
and ADR 0164 D4 subsequently reassigned it to **increment 4**. The comment sits eight lines below the
header block whose stated purpose is *"one axis swept, its sibling left behind — that is the whole
reason this increment exists"*, so a reader of this migration is told the axis is closed by the same
comment that explains why closing it matters. **Ask:** re-tense to "moves in AE2.4 increment 4 (ADR
0164 D4, ADR 0165 § Consequences)".

### M3 The mitigation ADR 0164 makes **required** has no invocation anywhere in production
ADR 0164 § Decision: *"Either app-side compensation in the person-creation path, or an
orphan-detection assertion. Which one is an implementation choice; **having neither is not.**"*

`app.tenant_orphan_profiles()` (`…005600:188-210`) is well-built and correctly discriminated on
`is_admin`. But a repo-wide sweep for callers returns **only** pgTAP `393` (`:190`, `:353`, `:359`,
`:365`), the phase record, and the door-audit findings file. It is revoked from `public`,
`authenticated` **and** `service_role` (`…005600:215-217`), i.e. `postgres`-only, and there is no
pg_cron job, no route handler, no scheduled script, and no admin surface that calls it.

`393` § 1.5/§ 1.6 prove the detector **can** fire; pgTAP does not run in production. As shipped, the
mitigation is a *detector definition*, and nothing will ever notice an orphan on a live system —
which is the state ADR 0164 says having neither would produce. This is an "absence of a verdict is
absence of coverage" shape one level up: the instrument exists and is never asked.

**Ask:** before the drop, wire it — a scheduled assertion, a `platform_admin` admin-page read, or an
`app.assert_no_tenant_orphans()` invoked somewhere real — or record explicitly that the mitigation is
deferred to the drop increment and that ADR 0164's requirement is **not yet discharged**. Right now
the phase record (`authz-ae2.md:726`) reads as though it is.

### M4 ADR 0163's closing section is stale, and its *sibling* section was carefully re-tensed
`0163-…:192-201` ("An inconsistency this decision does not create…") states that
`list_addable_commission_members` and `src/lib/queries/members.ts:243` *"are both AE2.1 census
members and **must be re-predicated in AE2.2**"*. Measured: the first moved in AE2.2
(`…005500`); the second was reassigned by ADR 0164 D4 to increment 4. Neither half of that sentence
is true today, and the section carries no tense marker.

What makes this a finding rather than a nit: the **same ADR's implementation-status section** was
meticulously re-tensed on 2026-08-28 (`:93-96` keeps the superseded HALF-LIVE text with an explicit
note about why), and Amendment 1 § 2 (`:173`) even preserves a quote with a parenthetical about the
rewrite. One section of the document was audited for staleness; its sibling was not — the phase's own
signature failure mode, in the phase's own governing ADR. **Ask:** re-tense `:200-201`.

### M5 The phase record's own task-state table disagrees with the repo in three cells
`docs/progress/authz-ae2.md:11-24`:

| row | table says | measured |
|---|---|---|
| `:24` **AE2.5** — Rule 13 binding text | `🔜` | **shipped** — commit `7654110c`, `ARCHITECTURE.md:650-676`. `PROGRESS.md:50` says `2.5 ✅`. |
| `:20` inc 1 artefact | "**9**-mutation vacuity proof" | the section it summarises (`:856`) says *"sixteen mutations"* and its table lists M1–M16. The `9` is the round-1 figure, never re-derived after rounds 2–3 (`cf066412`). |
| `:15` AE2.0 artefact | "last-org retention, **SUBSET capabilities**, four bounds" | ADR 0163 **Amendment 1 § 1 RETIRED** the SUBSET wording — retention is capability-blind. The same retired label survives at `20261003005400_…:6` ("Ruling implemented: ADR 0163 — last-org retention, **SUBSET-bounded**"). |

The `9 → 16` case is the one worth naming as a class: the figure **understates** the work, which is
why nobody re-derived it. A quoted figure that flatters is caught; one that self-deprecates is not.
**Ask:** correct all three; correct `…005400:6`.

### M6 ADR 0163's retention bounds have zero TypeScript coverage, and the new fixtures cannot give them any
`src/lib/users/person-footprint.ts:395-427` is the TS twin of `app.person_authority_orgs` and
faithfully reproduces all four bounds — I checked it against `…005400:107-158` and found no drift.
But all three of the vitest mocks that exercise it are **non-filtering** — `eq`/`is` are identity
functions: `person-admin-view.test.ts:88-90`, `person-footprint-reads.test.ts:48-51`,
`d14-person-level.test.ts:212-215`. So `.is('voided_at', null)` (`person-footprint.ts:401`) is a
no-op in every one, and every fixture seeds a single row with `ended_on: null`.

Consequence: bound 1 (void-is-not-end), bound 2 (`= max(ended_on)` with ties yielding **all** orgs)
and bound 3 (retention only when nothing is active) — `person-footprint.ts:409-426` — are exercised
by **no** TypeScript test. `person-footprint-reads.test.ts:181-188` (§ 4.2, labelled a positive
control) resolves `[ORG_A]` through the trivial `active.length > 0` branch and stays green if the
entire retention block at `:414-426` is deleted.

That is the one-half-measured shape ADR 0161's mirroring obligation exists to prevent: the SQL half
is pinned by `390`/`394`, the TS half is asserted. **Ask:** make the mocks honour `eq`/`is` (the
pattern already exists — `departed-person-footprint.test.ts:61-90`'s `makeFilteringAdmin` does it),
then add a void-only, a tie, and an active-plus-ended fixture.

### M7 Rule 9: new inline supabase-js on `organization_affiliations`, outside `src/lib/queries/`
`git diff main...HEAD --stat -- src/lib/queries/` is **empty**; the branch's new data access is
`src/lib/users/person-footprint.ts:396-401` —
`createAdminClient().from('organization_affiliations').select(…)`.

The file argues its own exception two different ways and neither covers this read. Its header
(`:32-45`) claims a Rule 9 exception bounded by *"a column-locked field has no RLS path by
construction"* — `organization_affiliations` is not column-locked, and `src/lib/queries/affiliations.ts`
already reads it (`listOrgAffiliationTenses`). The actual justification given at `:381-384` is a
*different*, and correct, one: `organization_affiliations_select` has no hospital tier, so an
RLS-bound read collapses. That is a **third** exception to Architecture Rule 9, taken without the
rule being amended, in a file whose header says exceptions are bounded by a property this read lacks.
**Ask:** either move it behind `src/lib/queries/affiliations.ts`, or amend Rule 9 / the file header
so the exception states the property it actually relies on.

### M8 `393` § 5.5 is a `lives_ok` on an already-drained constraint queue
`393:687-689` flushes deferred constraints and calls that flush "the assertion". But every § 5 write
happens in the loop at `:535-546`, and the next `set constraints all immediate` after it is
`:629` — inside § 4.1's `lives_ok` string. That flush fires **all** pending deferred triggers,
including § 3's and § 5's. Between `:631` (`set constraints all deferred`) and `:687` there is not a
single write. § 5.5's queue is therefore empty and `SET CONSTRAINTS` succeeds unconditionally.

Its stated coverage — *"without it the deferred hospital-containment trigger never fires in a suite
that ends in rollback"* — is discharged by § 4.1, an assertion labelled a regression control for a
different trigger. If a § 5 write violated ADR 0151 D4, § 4.1 would red and § 5.5 would still pass.
**Ask:** move § 5.5's flush before `:629`, or perform one § 5 write after `:631`.

### M9 `391` § 3 promises the widening it never asserts, and § 3.3 tests a `platform_admin` claim against a non-`platform_admin`
`391:172-175` announces *"the widening itself, measured where it actually lands: an admin of org B's
commission now sees the cross-anchored person"*, and then `:176-179` asserts **zero**. § 3.1, § 3.2
and § 3.3 all assert `0`; **no cell in `391` lists `p_crossanchored`.** The suite's headline widening
(`391:41-45`, *"§ 3 asserts it explicitly rather than letting it arrive as an unexplained green"*) is
measured only in `392` § 6.6.

Separately, § 3.3's caller is `staff_admin_a` — the same principal as § 3.2, against the same
commission — with a `platform_admin` claim hat. `list_addable_commission_members` gates on
`app.is_staff_admin_of(...) or app.is_tenancy_admin_of(...)`, neither of which carries an
`app.is_admin()` arm, so the `0` has the identical cause as § 3.2 and the label's claim ("a
platform_admin gets nothing — the noun rule still holds through this door") is asserted against a
principal who is not a platform admin by any real path. **Ask:** add the positive widening cell; make
§ 3.3 use the actual `platform@test.local` principal, or delete the noun-rule claim from its label.
(§ 3.2 should also be `is_empty(...)` — its label claims the roster is empty, its SQL claims one
person is absent from it.)

### M10 `394` § 3.4 — 8 of its 12 cells deny before reaching the rule under test
`394:834-842` asserts ADR 0163 bound 4 over `Q4 × {HA1, HAD, HB1} × 4 capabilities`, with the
rationale *"HB1 administers a hospital there, yet the empty footprint refuses all four
capabilities — the bound is enforced by the footprint rule, not by the locator."* Q4 locates to org
B (§ 0.6 pins it); `HA1` and `HAD` administer hospitals in org **A**, so for 8 of the 12 cells the
shipped body returns `false` at `cardinality(v_administered) = 0` (`…005700:230-232`) — *before* the
footprint rule is consulted. Only the 4 `HB1` cells exercise the claimed mechanism, and the aggregate
`count(...) = 0` hides the difference. **Ask:** split the assertion, or scope it to `HB1` and add the
A-tier cells as a separately-labelled "denied earlier, for a different reason" control.

### M11 The affiliate-door widening's security bound is **enumeration**-shaped, while the door accepts an **identifier**
ADR 0165 § Consequences (`:59-65`) is careful and correct as far as it goes: no
non-`platform_admin` caller can *enumerate* an anchorless person. It then names, in the same bullet
(`:66-72`), two paths that resolve one **by identifier** and defers both. What is not stated anywhere
is **what an actor who already holds the uuid gains**, and the answer is large:

`app.affiliate_person_to_org_impl`'s only person-side gate is now *"known here, or known nowhere"*
(`…005600:295-301`). Its authority arm checks only that the caller administers the **target org** —
nothing about the person. So an `org_admin` of any organization, or (via the hospital sibling, whose
arm is `org_admin OR hospital_admin`) a `hospital_admin`, who possesses an anchorless person's uuid
may affiliate them, and thereby:

- become an admin of an org that `app.person_authority_orgs` locates ⇒ read of that person's
  `profiles` row and `professional_credentials` (Class-2 professional identity) via the three
  re-predicated SELECT legs;
- satisfy `app.can_administer_person_for` for `fields` and `credentials` (INTERSECTION), and — because
  a freshly-claimed person's footprint is entirely inside the claiming hospital — for `cpf_change`
  and `lifecycle` (SUBSET) as well, i.e. CPF rewrite and the platform-wide deactivation kill switch.

Rule 13 is not violated (the caller's *membership* grants; the affiliation they create only locates,
and the two steps stay separate). The property worth naming is a different one: **the locating fact
is now self-servable by the same actor who exercises the grant**, for a population that did not
previously exist. "Not enumerable" is a reachability claim doing the work of a containment claim, and
this repo's standing lesson is that *not reachable ≠ protected*.

**Ask:** state the gained-capability set in ADR 0165 § Consequences and have the PO accept it
explicitly; or take the alternative ADR 0165 already drafted and rejected-for-now (a
`platform_admin`-only orphan-recovery door with its own audit verb), which removes the hospital-tier
widening entirely. The cells to flip are already written (`393` W5/W6/W7, H4).

### M12 ARCHITECTURE.md Rule 13 points at the suite that lacks the axis its sentence names
`ARCHITECTURE.md:673-676`: *"pgTAP `392` carries the collapse cell: a caller who shares an
affiliation … must be **denied for every capability**."* `392` is the read half; its predicate
`app.can_administer_person_via_affiliation(uuid)` takes **no capability argument**, and § 4.3's own
label says *"denied for EVERY **target**"*. The capability-axis cell is `394` § 9.2, which the rule
does not cite. Given the rule's closing instruction is *"assert it, do not review for it"*, a reader
who follows the pointer lands on the wrong axis. **Ask:** cite `392 § 4.3` (targets) **and**
`394 § 9.2` (capabilities), and fix B4 so the second one is not vacuous.

### M13 The census's function class is schema-bounded while every other class is database-wide
`docs/design/authz-ae2-home-org-consumer-census.md:112` bounds Class 2 with
`where n.nspname in ('public','app')`. Class 0 is unqualified, Class 1 (`pg_policies`), views,
matviews, constraints and indexes are all database-wide. The census is scrupulous about carrying its
predicate — so this is visible rather than hidden — but the **summary** line (`:401`, "Functions …
**13**") and the closing tally (`:418`, "13 function bodies") are quoted downstream as the consumer
count, and a namespace list is a syntax boundary, not a property. **Ask:** re-derive Class 2 without
the schema filter at the drop increment (CNV-3) and record the delta, or state the bound in the
summary row as well as in the query.

### M14 `resolveOrInviteUser` — assigned, but flagged here so it does not fall between increments
`src/lib/members/invite.ts:45-77` resolves an **email** to a person id with no affiliation predicate
and gates on `home_organization_id` at `:70`, then auto-grants `staff_admin`. ADR 0165 § Consequences
names it; `src/lib/users/actions.ts:437-441` names it as the precedent for the class that increment 3
fixed in its own file. It is correctly **out of scope** for this review (increment 4). It is listed
because it is an **AUTHORITY** consumer of the column, it is the second by-identifier path in M11,
and it is not in `docs/progress/authz-ae2.md:22`'s increment-4 artefact cell (which names
`listLinkableOrgUsers` only). **Ask:** add it to the increment-4 row so the slice's scope is
recoverable from the task table.

---

## Minor

| # | finding | location |
|---|---|---|
| m1 | `394` § 7.2's `count(violations)=0` runs over an unfloored 5-target subset; § 7.1 is transitively floored by § 4.3, § 7.2 is not | `394:964-975` |
| m2 | `394` § 10.3's positive control (§ 10.1) mutated the subject first — Q7 was finalized, renamed, credentialed, suspended and reactivated — so a state-derived `42501` is not excluded for 5 of the 6 doors. The `x_kernel_cred` trick shows the authors saw the hazard for one | `394:1116-1153`, `:1201-1210` |
| m3 | `390` § E4/E5 assert two profiles are unreadable with no guard that the `auth.users` + `handle_new_user` chain minted them; § 0.8 does exactly this for E6/E7 | `390:414-417` |
| m4 | No suite among `390`, `391`, `392`, `394` contains an executable positive control (a neutralization or deliberately-wrong expectation). `393` § 1 is the only one, and it is the strongest section in the five. The red-first claims are documentary | `390:28-31`, `391:47-49`, `392:189-195` |
| m5 | `390`'s header cross-reference is stale: `:24-25` says *"§D6 is what…"* for the collapse cell that is `§ D10` at `:399` | `390:24-25` |
| m6 | The containment trigger watches `organization_affiliations` only. The **outgoing** trigger fired on `UPDATE OF home_organization_id, **is_admin** ON public.profiles` — an `is_admin` true→false demotion of an unaffiliated profile now creates an orphan with no check. Likewise a `principal_id` reassignment that does not name `voided_at` does not fire (`…005600:88-91` argues the principal "cannot have changed", which is true inside the firing set and not of the invariant). Both may be unreachable — see CNV-5/CNV-6 — but neither is in the pre-declared widening list at `…005600:52-60` | `…005600:171-174` |
| m7 | Stale comments naming the dropped `profiles_tenant_has_org_trg` or the replaced RLS leg: `src/lib/queries/org-users.ts:33`, `src/lib/members/invite.ts:35-38`, `e2e/phase13-audit.spec.ts:139`, `public.handle_new_user`'s body, `docs/backend-state.md:396,599,5674`. `src/lib/users/actions.ts:766-772` corrects this exact sentence in its own file and not its sibling. Most are already on the record's own owed-list (`authz-ae2.md:984-1010`) | as listed |
| m8 | `d14-person-level.test.ts:374` keeps `home_organization_id: ORG_A` justified at `:397-399` as *"ONLY because `registerUser`'s email/CPF pre-checks still read it"* — they select `'id'` (`actions.ts:614`, `:637`). Dead field, refuted justification | `d14-person-level.test.ts:374,397` |
| m9 | `OrgUserDetail.homeOrganizationId` is a dead type field: one producer (`org-users.ts:761`), no reader | `src/lib/users/types.ts:421` |
| m10 | `392`'s CH arm is 10 cells constant by construction (`hospitaladmin.a1` holds no `org_admin` membership and the predicate has no hospital arm), contributing 20% of § 2.2's `set_eq` and counting toward § 2.6's `>= 40` unchanged floor | `392:376-387` |
| m11 | `394` § 9.1's faithfulness control is a **copy** of the shipped body, so it isolates drift, not correctness — a defect present in both is invisible to it by construction. The label ("makes the old side trustworthy") slightly oversells that | `394:1060-1067` |
| m12 | Voiding a person's last non-voided affiliation raises a raw `23514` reachable by user action. Already recorded as owed in ADR 0165 § Consequences and `authz-ae2.md:958`; repeated here so it is not lost at the gate | `…005600:147-150` |
| m13 | `393` § 2.9 correctly discloses that the DELETE arm of the trigger's event set has no behavioural coverage. Honest, and still a hole in half of `tgtype = 25` | `393:487-493` |

---

## ⛔ Could not verify — needs DB

Every item below is a claim I could not settle without touching the database. Each carries the exact
command. **These are work items, not caveats** — B5, B6 and m6 do not fully resolve until CNV-4,
CNV-7/8 and CNV-5/6 are answered.

Run all of these on a **fresh `supabase db reset --local`**, on a quiet tree, once the stack is free.

**CNV-1 — the Class-1 policy census, at the right grain.** `…005400`'s header claims all three legs
are SELECT and that *no policy carries the column in `with_check`*. That statement says nothing about
a `USING` clause on an UPDATE or DELETE policy, which is a different question (`USING` gates *which
rows may be touched*; `WITH CHECK` gates the new row). Also unverified: whether any of the three is
`RESTRICTIVE` rather than permissive, which would change the meaning of replacing one leg.
```sql
select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where coalesce(qual,'') ~ 'home_organization_id' or coalesce(with_check,'') ~ 'home_organization_id'
order by 1,2,3;
select schemaname, tablename, policyname, cmd, permissive
from pg_policies where tablename in ('profiles','professional_credentials','organization_affiliations')
order by 1,2,3;
```

**CNV-2 — `prosecdef` beside `pg_policies` for every door this phase touched** (the standing
invariant, CLAUDE.md § 3 corollary). I read the migration text, which is stale by design.
```sql
select n.nspname, p.proname, p.prosecdef, p.provolatile,
       array_to_string(coalesce(p.proconfig,'{}'),',') as cfg,
       coalesce(array_to_string(p.proacl,','),'<NULL = PUBLIC>') as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname in ('person_authority_orgs','can_administer_person_via_affiliation',
  'can_administer_person_for','person_audit_organization','tenant_orphan_profiles',
  'assert_profile_tenant_has_org','list_addable_commission_members',
  'affiliate_person_to_org_impl','affiliate_person_impl',
  'set_person_active_impl','suspend_person_impl','update_person_fields_impl',
  'upsert_credential_impl','delete_credential_impl','finalize_invited_person_impl')
order by 1,2;
```

**CNV-3 — the function census without the schema bound (M13).**
```sql
select n.nspname, p.proname, p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'home_organization_id'
order by 1,2;
-- expect: exactly the 13 of census Class 2, minus those already moved, and nothing in any other schema
```

**CNV-4 — does `platform_admin` have ANY path to the four person capabilities? (settles B5.)** The
six doors do not. The question is whether a table-level RLS path exists, which would make
"administrable by `platform_admin` alone" true at a grain the ADRs do not state.
```sql
select policyname, cmd, permissive, qual, with_check from pg_policies
where tablename in ('profiles','professional_credentials') and cmd <> 'SELECT';
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='guard_profile_privileged_columns';
```

**CNV-5 — is an `is_admin` true→false demotion reachable, and does anything then check containment?
(settles m6, half 1.)**
```sql
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='guard_profile_privileged_columns';
select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relname='profiles';
```

**CNV-6 — is `organization_affiliations.principal_id` updatable without naming `voided_at`?
(settles m6, half 2.)**
```sql
select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid
where not t.tgisinternal and c.relname='organization_affiliations';
select grantee, privilege_type, column_name from information_schema.column_privileges
where table_name='organization_affiliations' and grantee in ('authenticated','service_role');
```

**CNV-7 — the four ARM arms at head `20261003005700` (settles B6, half 1).** Record the
**enumerated** figures, never the exit code.
```bash
ARM=census  supabase/tests/mutation/p0-authz-invariant.sh
ARM=hat     supabase/tests/mutation/p0-authz-invariant.sh
ARM=floor   supabase/tests/mutation/p0-authz-invariant.sh
FROMFINDINGS=1 ARM=wrapper supabase/tests/mutation/p0-authz-invariant.sh
```

**CNV-8 — the diff-scoped door sweep over the derived case (settles B6, half 2).** The deriver
already named it; the sweep is what was not recorded.
```bash
scripts/door-sweep-cases.sh            # expect: DERIVED 1 — can_administer_person_for
CASES=can_administer_person_for ARM=policy supabase/tests/mutation/p0-authz-invariant.sh
# BLIND blocks the phase; ERROR is not a pass.  Confirm the findings file with `git diff --stat`.
```

**CNV-9 — did `list_addable_commission_members` change anything besides the affiliation predicate?**
`…005500` adds `and not pr.is_admin`; ADR 0163's quote of the old body (`:194`) shows only
`pr.home_organization_id = v_org_id and pr.is_active`. If `not pr.is_admin` is new it is an
undeclared narrowing.
```sql
-- against a checkout of the PREVIOUS head, or from the door-audit baseline snapshot:
select pg_get_functiondef('public.list_addable_commission_members(uuid,text)'::regprocedure);
```

**CNV-10 — the suites themselves.** I read `390`–`394` as text; I did not run them. Every green in
this review's "sound" list is a **reading**, not an observation.
```bash
supabase db reset --local && npm run test:db     # expect 242 files / 8065 tests
```

**CNV-11 — the differential figures.** `396 cells / 48 widenings / 44 narrowings` was recomputed from
`x_expect` by reading, and matches `§ 4.3`. It has not been observed to run.

**CNV-12 — `gen:types` no-diff.** Claimed at `authz-ae2.md:1341` and plausible (no table changed;
new functions live in `app`). `npm run gen:types && git diff --stat src/lib/types/database.ts`.

---

## Checked and found sound

Recorded so the next reviewer does not re-derive it, and because several of these are unusually
strong controls:

- **Rule 13's two-step shape is genuinely implemented, not asserted.** `app.person_authority_orgs`
  (`…005400:107-158`) contains **no caller term**, so it structurally cannot grant; the grant is a
  separate `app.is_org_admin_of` conjunct (`:179-183`). The same discipline is kept in
  `app.person_audit_organization` (`…005700:117-125`) and in `can_administer_person_for`'s LOCATE →
  org arm → hospital arm sequence. The TS twins in `person-footprint.ts:395-427` / `:442` / `:462`
  compose the same way. No predicate in the phase's new code becomes true from an affiliation row
  alone.
- **ADR 0163's four bounds are correctly implemented, including the two traps.** Bound 1's
  `voided_at is null` filter sits **before** the `max(ended_on)` and is repeated inside the subquery
  (`…005400:138`, `:157`) — the pair that would otherwise silently zero out authority for a person
  whose voided row ends latest; `390 § C7` constructs exactly that. Bound 2 is `= max(...)`, not
  `order by … limit 1`, so ties yield **all** orgs (`:153-158`).
- **The security-context change landed in the same migration that gave the trigger a table read**
  (`…005600:73-77`), as the census's binding consequence required — and the fail-**closed** choice
  at `:95-126` was found by mutation (M2), not by reading. The record's inversion of ADR 0159's
  predicted failure mode (correlated blindness ⇒ fail-open, not false positive) is a real result and
  is recorded in the right places.
- **No pgTAP fixture is built out of its own subject.** Every affiliation fixture across all five
  suites is a raw `insert`; `affiliate_person_*` and `void_org_affiliation` appear only as the
  measured subject or as a door building a world it is not asserted about. `394:317-335` is explicit:
  *"⛔ MEMBERSHIPS, never affiliations — Architecture Rule 13."*
- **The three vitest fixtures the prior round found were fixed the right way** — by mirroring the
  substrate, not by relaxing assertions: `person-footprint-reads.test.ts:77-84`,
  `person-admin-view.test.ts:126-135`, `d14-person-level.test.ts:385-398`.
- **The hand artefacts cannot drift into mutual agreement.** `392 § 2.3/2.4/2.5`, `393 § 3.4` and
  `394 § 4.1/4.2` compare MEASURED-vs-DECLARED and EXPECTED-vs-DECLARED as separate assertions.
- **`plan(n)` matches the assertion count in all five suites** (55 / 15 / 38 / 44 / 42), no `skip`,
  no `todo`, no commented-out assertion. `393`'s `Files=2, Tests=45` header is correct against
  `plan(44)` — `00_setup.sql` carries the extra one.
- **No suite can be silently flag-skipped**: no subject function calls `app.feature_enabled`, and
  `394 § 10`'s transitive `audit_trail` dependency fails loud (`'0/0'` ≠ `'6/0'`) rather than green.
- **ACLs are asserted positively** via `has_function_privilege` throughout, never by reading `proacl`
  for absence — the NULL-`proacl`-includes-PUBLIC trap is handled, and `394 § 1.1`'s `proacl`
  value-pin collapses safely under `array_to_string(coalesce(...,'{}'))`.
- **`throws_ok` matches are specific**: `393 § 2.1` / `§ 2.4` pin code **and** full message with the
  reason stated inline (three other objects raise `check_violation` on that table), and `§ 3.6`/`§ 3.7`
  are deliberately complementary so each can fail alone.
- **The RLS-free old-side snapshots are correct in all three differentials** (`392:319-323`,
  `393:505-507`, `394:415-418`) — the old predicate was applied to a row already in hand, so
  re-reading under the caller would compare the new predicate with itself.
- **Seed snapshots precede fixture construction**, and `394 § 0.7` *asserts* the disjointness rather
  than relying on statement order.
- **`394 § 0.5`/`§ 0.6` are the strongest fixture pins in the five suites** — they measure the
  designed footprints and located organisations as strings, so all four ADR 0163 bounds are visible
  in one assertion (P3 void-only empty, P5 the tie yielding both, P6 the voided-ordering trap, P9 the
  orphan empty).
- **The capability-axis fix is real on the hospital tier** — `TTFF` masks at `394:573-583`, floored by
  § 3.2 at ≥3 mixed masks *on each side*, keystone § 3.3 pinning
  `fields=true credentials=true cpf_change=false lifecycle=false`. The org tier remains inert, and
  `394 § 2.2` **measures** that inertness rather than papering over it, which is the right handling.
- **The census carries its predicate in every class**, distinguishes raw from comment-stripped hits
  (14 → 13, catching `list_org_people` as a comment-only non-consumer), and states its own
  reproducibility bound (*"re-derive, never quote"*). M13 is a boundary question, not a soundness one.
- **`docs/decisions/INDEX.md` is regenerated and consistent** (163 ADRs, next free 0166); the
  `0163 ← 0164` back-pointer banner is present and correctly worded. M1 is the one missing edge.
- **The record's own disagreement sections are the most valuable artefact in the phase** —
  `authz-ae2.md:958-982` and `:1296-1310` name six things reality contradicted, including two the
  authors found in their own keystones. Three of my findings (B2's actor axis, M3's uncalled
  detector, M9's unasserted widening) are properties the record *described correctly in prose* and
  then did not close; that is a much better failure mode than not seeing them.

---

## What must happen before this review can flip to `APPROVED`

1. **B1** fixed or PO-accepted in writing (code change, `src/lib/members/actions.ts`).
2. **B2**, **B3**, **B4** — three test changes: an actor axis in `393 § 5`, write-through assertions
   for W5/W6/W7/H4, and the two preconditions restored to `394 § 9.2` and `390 § D10`.
3. **B5** — the four documents corrected, after CNV-4 settles the grain; ADR 0163 bound 1 re-ruled if
   the answer is "nobody".
4. **B6** — CNV-7 and CNV-8 run at head `20261003005700`, figures recorded in the increment's own
   gate table, `PROGRESS.md:50` citing rather than copying them.
5. The **Could not verify** list worked through, or each item explicitly deferred with an owner.

Majors M1–M5 and M8–M10 are cheap and should ride along; M6, M7, M11, M13 and M14 may be scheduled,
but M11's acceptance must be written **before** the column drop, because ADR 0164 makes increment 3's
differential a hard gate and M11 is the part of the widening the differential does not cover.

---

## Deferred write

Per this review's constraints I did **not** edit `PROGRESS.md` (a third session is editing it). The
row below is for the lead to paste into the **QA Verdicts** table:

```
| 2026-08-28 | Gate AE2 step 3 (AE2.0 → AE2.4 inc 3; inc 4 + column drop not built) | ⛔ CHANGES REQUESTED | 6 blocking: addStaff still on the column while the picker moved (B1) · 393 § 5's actor axis constant, so ADR 0165's hospital-tier widening is unmeasured (B2) · the 4 declared widening cells prove "did not raise", not "wrote a row" (B3) · Rule 13's keystones 394 § 9.2 / 390 D10 have no non-vacuity preconditions (B4) · "administrable by platform_admin alone" is false in 4 documents — no kernel has a platform_admin arm (B5) · inc 3 has no ARM evidence and PROGRESS.md:50 carries inc 1 / AE2.2 figures as its own (B6). 14 major, 13 minor, 12 could-not-verify (no DB access — another session owns the stack). Report: docs/reviews/authz-ae2-review.md |
```
