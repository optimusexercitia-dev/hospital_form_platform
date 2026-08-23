# AFF2 — QA review (gate step 3)

**Workstream:** AFF2 — affiliation-scoped administration + user-management redesign
**Branch:** `feat/aff2-user-management` (33 commits ahead of `main`, HEAD `7a9de485`)
**Reviewer:** `qa` · **Date:** 2026-08-23
**Authority:** ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)
+ **Amendments 1, 2, 3** · ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
Amdt 8 · [plan](../plans/aff2-user-management.md) · [workstream record](../progress/aff2.md) ·
ARCHITECTURE.md · CLAUDE.md §3/§6/§8

---

## Verdict

# ⚠ CHANGES REQUESTED

Two findings block, and both are small to discharge. Everything in my explicit remit that
could be measured against the live catalog or the source **passed** — the six-arm matrix,
the column-grant absence, the B2 DENY arms, and the capability passed at each of the six
rewired call sites. The blockers are elsewhere: one unmet literal ADR clause on the write
authority (**R1**), whose filed follow-up contains the false sentence that would otherwise
keep it visible; and one plan deliverable that was never built and never recorded as
deferred (**R2**), which leaves an entire backend task (B3) with no consumer.

This is a high-quality workstream. The keystones are among the least vacuous I have
audited here, and three of my seven findings are things the build's own recorded lessons
predict — found one field, one caller, or one document over from where the lesson was
applied.

---

## What I measured myself, and what I did not

**Re-measured (not accepted from the brief).** All catalog facts below come from
`pg_proc` / `pg_policies` / `information_schema` on the running local stack, never from
migration text (CLAUDE.md §3 binding exception).

| Check | Result |
| --- | --- |
| `npm run lint` | **exit 0** — 8/8 |
| `npx tsc --noEmit` | **exit 0** |
| `npx vitest run src/lib/users` | **exit 0** — 7 files / **122** tests |
| Local DB state | **444** migrations / `20261003001200`, `auth.users` **36** — identical to the lead's step-1 baseline |
| **DB delta from this review** | **0.** Read-only catalog queries only. No `db reset`, no writes, no dev server started. |

**NOT verified — this is a work item, not coverage.**

1. I did **not** re-run `npm run test:db`, `e2e:prod`, or any `ARM=*` sweep. I accept the
   lead's step-1/step-2 figures for those, including the findings-file byte-identity
   check. If any of those is wrong, this review does not catch it.
2. I did **not** exercise the UI in a browser. F1's 21/21, F2's 21/21, F3's 10/10 and
   F4's 16/16 are accepted as reported; my UX findings come from source.
3. I measured **local** only. Whether any `memberships.expires_at` row exists on the
   remote project is unknown to me (relevant to R1).
4. The e2e flaky-identity question the tester recorded as **unverifiable** remains
   unverifiable to me too. I did not attempt to recover the pin's batch logs.

---

## Blocking findings

### 🔴 R1 — the footprint resolver does not implement D1's *"active"*, and the follow-up that would have caught it says the opposite

**Requirement violated:** ADR 0133 **D1(c)** — *"the target's hospital footprint — active
`hospital_affiliations` ∪ the hospitals of the target's **active** commission-tier
memberships (via `commissions.hospital_id`)"* — and **D1(b)**, which derives tier from
*"the target's memberships"*.

`src/lib/users/person-footprint.ts:81-91` resolves the membership leg with no activity
predicate:

```ts
const { data: memberships } = await admin
  .from('memberships')
  .select('commission_id, hospital_id, commissions:commission_id(hospital_id)')
  .eq('principal_id', userId)
```

The affiliation leg immediately above it **does** filter (`.is('ended_on', null)`,
`:78`). The membership leg does not, and `memberships.expires_at` exists (measured:
`information_schema.columns`) and is the platform's canonical activity predicate —
`app.has_role` implements it verbatim as `(m.expires_at is null or m.expires_at > now())`
(measured from `pg_get_functiondef`), as does the `list_org_people` gate this very
workstream re-emitted (`20261003001200`).

**Consequence, in the over-grant direction.** An expired commission-tier seat at hospital
H still contributes H to `hospitalIds`, so `personScopeAllows('fields' | 'credentials',
…)` — the **INTERSECTION** capabilities — return `true` for a `hospital_admin` of H over
a person who no longer holds any tie to H. That is person-level **write** authority:
`updateUserProfile` (name, category, DOB, phone), `upsertCredential`, `removeCredential`.
Per D4 this TS predicate is *the only authority* on those paths — service-role, no RLS
backstop. The subset capabilities and the D2 tier flag fail **closed** under the same
gap, so the exposure is confined to the two intersection capabilities.

**⛔ The filed follow-up asserts the opposite, and that is the part I most want fixed.**
`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` (`docs/progress/follow-ups.md:6832-6836`) bounds itself
with:

> *"**Not a live hole; do not report it as one.** What an expired membership buys is a
> **read** of a professional credential … The write boundary is untouched: ADR 0133 D1/D2
> bound *administration* separately."*

The write boundary is **not** untouched. D1/D2 bound administration through
`resolvePersonFootprint`, which has the identical gap. The follow-up's own closing
paragraph — *"Anyone closing this item on 'expiry is already handled' has quoted a real
filter for a conclusion it does not bound"* — describes its own bounding claim: it quotes
the target-side/caller-side distinction correctly and then applies it to a write path it
never measured. That sentence is what makes the item non-blocking, so it must be corrected
whatever is decided about the code.

**The module's own doc comment is also an assertion that is false.**
`person-scope.ts:60-62` and `person-footprint.ts:48-49` both say *"active COMMISSION-tier
memberships"*. Nothing implements it.

**Reachability, measured rather than assumed.** `memberships` rows with a non-null
`expires_at`: **0 of 43**. No application path writes `memberships.expires_at` (swept
`src/**`; the only `p_expires_at` caller is `src/lib/case-access/actions.ts:181`, a
different table). But `public.grant_role` is `SECURITY DEFINER`, `authenticated`-executable
(`proacl` measured), and takes `p_expires_at`; `app.grant_role_impl` refuses only an
*already-past* expiry, so a future-dated grant that later lapses is constructible by a
legitimate admin through an exposed door. **Not reachable through the product UI today;
reachable through the API.**

**Why AFF2 owns it even though the read is pre-existing.** The unfiltered membership read
predates this branch (`callerHospitalAdminMayManageUser`). Before AFF2 it bought nothing
person-level, because person-level writes were org_admin-only. **AFF2 is the change that
converts that footprint into person-level write authority.**

**To discharge — either is acceptable, one is mandatory:**
- **(a)** Filter the membership leg on `expires_at is null or expires_at > now()` in
  `resolvePersonFootprint`, with a keystone arm in `person-scope.test.ts` / the resolver's
  tests; **or**
- **(b)** Get it PO-ruled that the write path mirrors the policies' unfiltered "active"
  (the Amdt 2 r3 consistency argument is a real argument here), amend D1(b)/(c)'s wording
  so the ADR stops claiming a filter that is deliberately absent, and correct the two doc
  comments.
- **In both cases:** correct the false *"The write boundary is untouched"* sentence in
  `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` and widen the item to name
  `resolvePersonFootprint` as a third authority beside the two policies.

⚠ **Do not "fix" this by tightening the two RLS policies.** Amdt 2 ruling 3 forbids a
one-sided policy change, and the AFF2 plan's own risk list forbids widening `profiles`
"while we're here". R1 is about the **TS write authority**, which has no mirroring partner.

---

### 🔴 R2 — *"Match cards show DOB when present (B3)"* is not built, not deferred, and not recorded; B3 has no consumer

**Requirement violated:** the plan's **F3** scope, verbatim
(`docs/plans/aff2-user-management.md:190-191`): *"…foreign collision → D8 block copy; not
found → reveal Nome, E-mail, Categoria (required) + **Nascimento, Telefone (optional)** +
Registro profissional … **Match cards show DOB when present (B3)**."* And ADR 0133 **D11**'s
stated rationale: *"The homonym problem bites exactly in the registration-lookup match
cards and the directory-adjacent pickers."*

**Measured.** `OrgPerson.dateOfBirth` (`src/lib/queries/affiliations.ts:160`, populated at
`:206`) has **zero readers** in `src/**`. The only consumer of the door is
`lookupOrgPeople` → `register-person-flow.tsx:178`, and its match card
(`register-person-flow.tsx:321-419`) renders name, email, professional category,
affiliations and status — **no birth date**. Grepping `dateOfBirth` across `src/`
confirms the only person-DOB render in the whole app is `personal-data-card.tsx:148`,
which is read path (i), the profile rail — not this one.

So **B3 in its entirety** — migration `20261003001200`, the DROP+CREATE re-emission with
its ACL differential, pgTAP `361` (23 arms) and the Amdt 1 ruling 4 reasoning that DOB has
*two* read paths — currently feeds nothing. This is the codebase's own recorded
*"a correct door nothing can reach"* shape, at the scale of a whole backend task.

**A sharper version, for the PO's decision rather than the engineer's.** D11's homonym
rationale needs a **name-search** match list. The only live caller passes `cpf` and the
door is exact-match, full-length only — so it returns **at most one row**, where a birth
date disambiguates nothing. Building the render as specified would satisfy the plan but
not obviously the rationale. Either build it, or retire D11's UI clause explicitly and say
what B3's payload is for.

**Not recorded anywhere.** `docs/progress/aff2.md` § Track F's F3 section never mentions
it, in either the built or the deferred list. Unlike every other adaptation in this
workstream, there is no stated reason.

**To discharge:** build the DOB line in the match card, **or** file a follow-up + record
the deferral in `docs/progress/aff2.md` with a reason, **and** state what B3's second read
path serves in the interim.

---

## Non-blocking findings

### 🟡 R3 — *"✅ ALL THREE CLOSED"* closed a different three than the list it answers

`docs/progress/aff2.md` § "F3 — built, and why it must not merge yet" enumerates three
blocked items: **1.** Nascimento / Telefone · **2.** Data de início · **3.** redirect to
the new profile. The very next block reads **"✅ ALL THREE CLOSED 2026-08-23 against B4"**
and its three bullets are **Nascimento · Telefone · Redirect**. Item **2** silently left
the list while the count stayed at three.

**Measured: "Data de início" is not built.** `RegisterUserInput`
(`src/lib/users/actions.ts:81-127`) has no start-date field; the wizard renders no such
control; `register-person-wizard.tsx:59` still carries the comment describing it as an
open insertion point. It is a plan F3 step-2 deliverable
(`docs/plans/aff2-user-management.md:193`: *"Hospital …, Matrícula, Data de início"*).

The deferral itself is defensible and its rationale is already written down ("the
affiliation begins today, which is also the correct default for someone registered
today"). What is wrong is the **record**: a plan deliverable was dropped with no follow-up
and the tracker states it was closed. This is the workstream's own recorded class —
*a total that matches is not a list that matches* — applied to itself.

**To discharge:** correct the closure text to name the two items actually closed, and
either build the field or file it.

### 🟡 R4 — the Amdt-3 normalisation was applied to CPF and not to its two new siblings

`src/lib/users/actions.ts:817-828`:

```ts
const cpfChanged =
  cpf !== undefined && normalizeCpf(current.cpf ?? '') !== normalizeCpf(cpf ?? '')
…
  (input.dateOfBirth !== undefined &&
    (current.date_of_birth ?? null) !== (input.dateOfBirth ?? null)) ||
  (input.phone !== undefined && (current.phone ?? null) !== (input.phone ?? null))
```

ADR 0133 **Amendment 3** rules the CPF comparison must be normalised on both sides,
because *"a reformatted-but-identical CPF must not read as a change"*. The two columns
added by the same commit compare **raw** — while the write path immediately below
(`:874-876`) **does** normalise phone (`.replace(/\D/g, '')`). So a phone posted as
`(11) 98765-4321` against a stored `11987654321` registers as a person-level change and
fires the `fields` gate, for a write that is a no-op. Same for `dateOfBirth: ''` against a
stored `null`.

**Direction: fails closed.** I could not construct an under-detection (the write path and
the register path both normalise before storing, so a non-digits stored phone is not
producible), so this is over-strict, not an over-grant. **Latent today**: `PhoneField`
keeps state digits-only and `UserProfileEditForm:117` coerces `''` → `null`, so the live
form's round-trip is clean.

That is precisely the situation Amdt 3 was ruled on — *"a trap for the NEXT author, not a
live bug"* — and it was fixed for CPF for that reason. **`d14-person-level.test.ts` §3 has
no phone twin** of its `'the stored value echoed with INPUT-SIDE formatting'` arm, so
nothing would notice.

### 🟡 R5 — `updateUserProfile`'s affiliation half has no live caller, and it is what justifies the looser entry gate

`actions.ts:775-777` chooses `authorizeForUser` (the **no-tier, no-subset** gate) as
`updateUserProfile`'s entry authority, reasoned as: *"a hospital_admin may still reach
this action, because the AFFILIATION half of it is legitimately theirs (matrícula at their
own hospital)."*

**Measured: no caller exercises that half.** `updateUserProfile` has exactly one caller in
`src/**` — `UserProfileEditForm` (`user-profile-edit-form.tsx:124`) — and its payload
(`:109-121`) never sets `homeHospitalId` or `hospitalEmployeeId`. F2 moved employment facts
to `AffiliationsPanel`, which uses its own door. So `actions.ts:844-897` (the home-hospital
validation and `ensureActiveAffiliation`) is reachable only by a hand-crafted server-action
call, and `d14-person-level.test.ts:520` (*"a hospital_admin editing ONLY the matrícula is
ALLOWED"*) pins a path the product cannot produce.

Not a hole — `affiliate_person_for` re-derives authority in PostgreSQL — but it is the
remit's own *"a keystone proves the door, a second caller proves nothing about the real
one"*, and it matters practically: with the affiliation half dead, the entry gate could be
tightened to `authorizePersonScopedAdmin('fields')`, which would shrink R1's blast radius
for free. Worth a decision, not a demand.

### 🟢 R6 — `user-lifecycle-actions.tsx` still documents the rule ADR 0133 retired

Two developer-facing assertions in the component that renders the lifecycle buttons are
now false:

- `:37-41` — *"⚠ AFF W3/T3.3 (ADR 0097 D14): deactivate / reactivate / suspend are
  `org_admin`-ONLY."*
- `:59` — the `canManageAccountStatus` prop doc: *"Whether the caller is an `org_admin` of
  this person's organisation."*

After D3 + Amdt 1 ruling 1 the prop carries `canManageAccountLifecycle`, the **SUBSET**
bound, which a `hospital_admin` holds over a sole-footprint person — and
`d14-person-level.test.ts` §1 asserts exactly that. F4 was the copy pass and F2 rebuilt the
page around this split; this file's contract doc was not swept. The **user-facing** copy is
correct and scope-aware (the note only renders when the capability is genuinely absent), so
D14's *"copy becomes scope-aware"* clause is met. This is the *comment-is-an-assertion*
class only.

### 🟢 R7 — the UI collapses two ADR capabilities into one boolean (informational)

`personal-data-card.tsx:126` passes `canEditCpf={canManageAccountLifecycle}`. ADR 0133 D3
treats `cpf_change` and `lifecycle` as **distinct** capability classes; they merely share
the SUBSET bound today, so `personScopeAllows` returns identically for both and the
behaviour is correct. The server uses the right one (`actions.ts:834`). It is declared in
`PersonAdminAuthority`'s doc. Recording it only because a future amendment that widened one
and not the other would produce a UI offering a field the server refuses — silently.

---

## What passed, itemised

Stated positively because a review that lists only findings under-reports the audit.

### Remit item 1 — the six-arm matrix vs D1–D3 ✅

`src/lib/users/person-scope.test.ts` carries every arm the ADR names: sole-hospital (§1),
cross-hospital footprint (§2), org-tier and hospital-tier target (§3, via the structurally
derived flag), zero footprint (§4.1), caller administering nothing (§4.2), sibling
hospital (§5.1), partial overlap (§5.2), duplicate ids (§6). All four capabilities are
asserted on every fixture, so no arm can be left unstated.

**Non-vacuous by construction, and I checked the construction.** §2's
`expect(new Set(verdicts).size).toBe(2)` cannot be satisfied by any single-bound
implementation in either direction; §3 pairs its tier deny with the identical
tier-flag-cleared fixture; §4.1 pins the ∅ ⊆ X inversion explicitly rather than trusting
the arithmetic; §2's *"administering the WHOLE footprint restores the subset
capabilities"* defeats a `hospitalIds.length > 1 → deny` mutant. §5.1 correctly labels
itself as an entry-gate arm rather than a person-scope keystone.

The predicate itself (`person-scope.ts:99-135`) matches D1/D2 clause for clause: D2 checked
first, empty-administered and empty-footprint pinned separately, intersection for
`fields`/`credentials`, subset for `cpf_change`/`lifecycle`.

### Remit item 2 — column-grant absence ✅

Measured from `information_schema.column_privileges` on `public.profiles`:

| grantee | `cpf` | `date_of_birth` | `phone` | `full_name` (control) |
| --- | --- | --- | --- | --- |
| `authenticated` | REFERENCES | REFERENCES | REFERENCES | SELECT, INSERT, UPDATE, REFERENCES |
| `anon` | — | — | — | — |

The two new columns are **exactly** as locked as `cpf`, and differ from an unlocked column
in precisely the SELECT/INSERT/UPDATE grants D10 requires absent. The lone `REFERENCES`
row is the pre-existing table-level grant, value-blind — the brief's own recorded
correction, and it holds. `guard_profile_privileged_columns` (`prosecdef = t`, returns
`trigger`) lists both new columns in `v_identity_changed`, satisfying Amdt 1 ruling 6.

### Remit item 3 — the B2 DENY arms ✅

`professional_credentials_select` measured from `pg_policies`: both new legs mirror the
live `profiles` legs **verbatim** — affiliation (`ha.ended_on IS NULL` +
`app.is_hospital_admin_of`) and membership (`LEFT JOIN commissions` +
`COALESCE(hm.hospital_id, hc.hospital_id)`), with no `expires_at` filter. That is Amdt 2
rulings 1 and 3 implemented as ruled, not as summarised.

`supabase/tests/360_credentials_hospital_admin_read.sql` §4 carries five DENY arms
(sibling hospital, other org, zero footprint, plain staff colleague on the same
commission) and **two positive controls** — 4.2 (the same sibling-hospital session *does*
read a subject at its own hospital) and 4.6 (the staff member *does* read their own
credential). Those controls are what make the zeros mean something rather than proving a
broken hat, and the header says so explicitly. Amdt 2 ruling 2's required **ALLOW** arm —
a hospital-tier person's credential *is* readable — is §3. RLS is enabled with exactly one
permissive policy and no write policy.

### Remit item 4 — the six rewired call sites, read at the caller level ✅

Each verified from source, against the capability the ADR requires:

| Site | Capability passed | ADR requirement | Live UI caller |
| --- | --- | --- | --- |
| `actions.ts:835` `updateUserProfile` | `cpfChanged ? 'cpf_change' : 'fields'` | Amdt 1 r1 — one action, two bounds | `user-profile-edit-form.tsx:124` ✅ |
| `actions.ts:909` `upsertCredential` | `'credentials'` | D3 + Amdt 1 r1 (intersection) | `credentials-editor.tsx:177` ✅ |
| `actions.ts:975` `removeCredential` | `'credentials'` | D3 | `credentials-editor.tsx:190` ✅ |
| `actions.ts:1091` `deactivateUser` | `'lifecycle'` | Amdt 1 r1 (subset) | `user-lifecycle-actions.tsx:177` ✅ |
| `actions.ts:1109` `reactivateUser` | `'lifecycle'` | Amdt 1 r1 (subset) | `user-lifecycle-actions.tsx:207` ✅ |
| `actions.ts:1134` `suspendUser` | `'lifecycle'` | Amdt 1 r1 (subset) | `user-lifecycle-actions.tsx:253` ✅ |

No site passes a wider capability than its ADR class. `resendInvite` correctly kept
`authorizeForUser` (D3: *"`resendInvite` was already reachable"*), and the UI renders its
button **outside** the `canManageAccountStatus` gate (`user-lifecycle-actions.tsx:281-291`),
so the §7 keystones describe the real surface. `assignCommitteeRole` / `removeCommittee`
correctly kept `authorizeForUser` + `authorizeForCommission` — committee seating is not one
of D3's four classes.

**Server-side affordance wiring is per-capability, as Amdt 1 requires.** The F2 page gates
lifecycle controls on `canManageAccountLifecycle` (SUBSET) and the credentials editor on
`canEditPerson` (INTERSECTION) — `usuarios/[userId]/page.tsx:174, 234-247` — computed
server-side from one footprint resolution and never re-derived client-side.
`PersonalDataCard` branches on the **outer** `personalData === null` before any value
renders, so "withheld" can never surface as "Não informado". `getPersonAdminView` resolves
the footprint **once** for both capabilities, honouring D4's one-write TOCTOU bound.

### Amendment 3 — the CPF grain ✅ (the one I was asked to look at hardest)

`actions.ts:817-818` is change-based and normalises **both** sides, exactly as ruled.
`d14-person-level.test.ts` §3 pins it four ways: a cross-hospital edit echoing a
**reformatted** CPF is ALLOWED; **absence** and an **identically-valued differently-formatted**
key reach the *same* verdict; **clearing** with `null` or `''` IS a change and hits the
subset bound. §3's second arm also states precisely what it cannot prove (the stored side
is unstorable non-normalised, so the discriminating fixture cannot be built in Vitest) and
names where that guarantee is tested instead — pgTAP `359` §6. That is the standard I would
want everywhere.

### `list_org_people` (B3, door side) ✅

Measured: `prosecdef = t`; `proacl = {postgres=X, service_role=X, authenticated=X}` — **no
PUBLIC, no `anon`**, so the DROP+CREATE ACL hazard was genuinely closed. The gate is intact
and correct per Amdt 1 ruling 4 (org_admin ∨ any `hospital_admin` of the org), with the
caller's `expires_at` and ACT active-hat checks both present, and returns empty rather than
raising. `date_of_birth` is in the payload; `phone` is not (D11). `not pr.is_admin` upholds
the noun rule.

### Architecture rules and §8 conventions ✅

- **Rule 1** — the two UI capability flags are documented as UX, and every one of the six
  actions re-derives authority server-side. The `person-footprint.ts` header's argument for
  why the module must never gain `'use server'` is correct and load-bearing: exporting
  `getPersonAdminView` from `actions.ts` would publish an authority oracle, and no gate in
  the repo would catch it.
- **Rule 9** — the service-role read in `person-footprint.ts` is a *new* exception and the
  header says so explicitly, refusing to file itself under the existing two-module
  document-signing exception. The reason given (a column-locked field has no RLS path by
  construction — a cookie client gets 42501) is correct: I confirmed `authenticated` holds
  no SELECT on those columns.
- **§8 pt-BR / no raw Postgres** — every user-facing string I read is pt-BR; `usuarios/error.tsx`
  renders nothing from `error` at all; `updateUserProfile` maps `23505` to a pt-BR collision
  message and everything else to a generic one.
- **§8 a11y** — the "Editar" disclosure carries `aria-expanded`/`aria-controls`; the save
  confirmation is a permanently-mounted `role="status"` region (the correct fix for the
  banner-unmount bug, not a timing hack); `ScopeNote` pairs icon with wording rather than
  relying on colour; the `globals.css` `animation-delay` reduced-motion fix is a real
  app-wide §8 defect caught and closed.
- **`prosecdef` beside `pg_policies`** — checked for every gate this phase touched:
  `list_org_people` (`t`, ACL clean), `guard_profile_privileged_columns` (`t`, returns
  `trigger`, structurally outside every sweep's domain — correctly classified, not missed),
  `professional_credentials_select` (a policy, no DEFINER involved). No `prosecdef` flip,
  no new door.

---

## On the known residues

Asked whether any is understated. **One is, materially.**

| Residue | Assessment |
| --- | --- |
| `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` | ⛔ **UNDERSTATED — see R1.** Its *"the write boundary is untouched"* is false, and it is the sentence that makes the item non-blocking. It also names two policies as the answerable set; there is a third authority, `resolvePersonFootprint`, with no mirroring partner and no RLS backstop. |
| `FUP-AFF2-CONTA` | Fairly stated. Amdt 1 ruling 5 makes it the LGPD titular-access control, and D9's minimum-necessary justification is recorded. Nothing in this branch makes it more urgent. |
| `FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY` | Fairly stated, and `usuarios/error.tsx` narrows it correctly. F4's evidence is unusually strong: run in **dev** on purpose (prod redaction would have measured the framework, not the component) and paired with a positive control asserting the leaked-looking string **present in the payload** and **absent from the UI**. |
| `FUP-WAITFORURL-SATISFIED-BY-ITS-OWN-STARTING-URL` | Fairly stated, including the one pre-existing instance left unfixed on purpose. |
| `FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES` | Fairly stated. The tester's refusal to claim flaky-identity equality on a matching count is the right call and I did not improve on it. |
| `guard_profile_privileged_columns` domain gap | Fairly stated as a `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` extension. Confirmed: it returns `trigger`, which excludes it structurally from every arm's domain, and pgTAP `359` §3 pins its property. Classified, not missed. |

---

## Premises in my own brief that I checked

Per the workstream's convention. **No false premise found in the brief.** Specifically
confirmed rather than assumed: `case_patient` is a flag key (not touched by this branch at
all); `memberships` is keyed `principal_id` and carries `expires_at`; `ListDirectoryOptions`
is in `src/lib/queries/org-users.ts:345`; `person-footprint.ts` carries no `'use server'`
directive; the six formerly-`authorizeOrgAdminForUser` sites are the six now calling
`authorizePersonScopedAdmin` (verified from the `main...HEAD` diff, not from the line
numbers, which have all moved).

---

## Re-review scope

R1 and R2 only. R3–R7 are recorded for the Record step and do not require another round.
If R1 is discharged by route **(b)** (a PO ruling plus text corrections), no code changes
and therefore no re-run of gate steps 1 or 2 are needed for it — but the ADR wording, the
two doc comments and the follow-up must all move in the same edit, or the next reader
inherits a claim with nothing able to contradict it.
