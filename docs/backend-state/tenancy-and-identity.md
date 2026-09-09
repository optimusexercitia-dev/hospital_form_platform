# Backend State — tenancy, affiliation and identity

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

⚠ **The `app.is_commission_admin_of` → `app.is_tenancy_admin_of` rename (2026-08-09, ADR [0105](../decisions/0105-rename-is-tenancy-admin-of.md)) is recorded in [`document-model.md`](document-model.md) § END STATE.** The old name is GONE, no shim; records dated before 2026-08-09 still say the old one deliberately.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below. Replace this block in
place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the
generated registries; the live catalog is the authority (ADR 0078).

### Surface

- **`organizations` → `hospitals` → `commissions`** — a commission belongs to one hospital, a hospital to one org — and
  **`public.memberships`, the single multi-scope GRANT table keyed `principal_id`**, where org, hospital and commission
  standing all live, one role per principal per commission; `authenticated` holds **SELECT only, no DML grant**.
- **Two affiliation tables** — `public.hospital_affiliations` ("works at this hospital", carrying the per-hospital staff
  data) and `public.organization_affiliations` ("belongs to this organization", the roster predicate); both carry an ended
  tense (`ended_on`) and a voided tense (`voided_at`/`voided_by`/`void_reason`).
- **⛔ `profiles.home_organization_id` IS DROPPED**; the replacement predicate everywhere is an `organization_affiliations`
  row, and which *tense* is load-bearing differs per site. `app.person_known_to_org` is **NON-VOIDED, not ACTIVE** — an
  ended row still answers TRUE; `app.person_is_anchorless` is `not exists` any non-voided org affiliation of any tense.
- **Affiliating a person to an org is THREE doors** — *ordinary* (narrowed to `person_known_to_org`); *creation*
  (`app.affiliate_new_person*`; `public` wrappers **`service_role` ONLY** — the anchorless disjunct **is** the widening and
  that missing `authenticated` grant its entire bound); *recovery* (`public.recover_orphan_person_to_org`, platform admin **and** anchorless).
- **Person identity is keyed on `profile_private_details.cpf`** — ⛔ **not** `profiles.cpf` — validated in **both**
  `app.is_valid_cpf` and `src/lib/users/cpf.ts`. The org people directory is `public.list_org_people(uuid, text, text)`:
  DEFINER, inline tenancy gate, returning **`[]` and never raising** for an unauthorized caller, `cpf` never in its payload.
- **"Act as"** — enum `public.platform_role`; the session↔hat binding `app.active_role_selections` (in `app`, so PostgREST
  offers no route to it at all); `public.assume_role`, the only way to acquire a hat; `app.active_role()`, returning
  **`text`**; the picker route `/selecionar-perfil`.
- **The Diretor Técnico plane** — hospital-tier `technical_director` (titular; one per hospital) + `technical_director_deputy`;
  `public.appoint_technical_director`; `app.is_technical_director_of_for`; a referral **target sum type**.
- Signatures, `prosecdef` and EXECUTE grants: [`generated-rpc-surface.md`](generated-rpc-surface.md) · [`generated-helper-surface.md`](generated-helper-surface.md).

### Invariants

- **An affiliation LOCATES; a `memberships` row GRANTS** (Architecture Rule 13). Affiliations are visibility and lifecycle
  inputs and **NEVER** grant capabilities: no policy and no door may treat an affiliation row as a positive authorization
  source. The two steps stay **separately visible** — `app.person_authority_orgs` locates (⛔ its body contains no caller
  term at all, so it *cannot* grant); `app.can_administer_person_via_affiliation` grants, via `app.is_org_admin_of`.
  ⛔ **The forbidden shape type-checks just as well** — any predicate whose truth follows from an affiliation row's
  existence or properties alone violates it, and collapsing the two steps into one join is the failure mode. An ended row
  answers **where**, never **whether**; and self-affiliation is ALLOWED because an affiliation confers no capability.
- **A hospital admin's write bound is an affiliation FOOTPRINT, not a role** — `resolvePersonFootprint` unions active
  affiliations and active memberships; the pure `personScopeAllows` decides `fields`/`credentials` by **intersection** and
  `cpf_change`/`lifecycle` by **subset**. An empty footprint denies all four; ⚠ a commission-tier seat keeps it non-empty.
- **"Act as" is STRICT ROLE ASSUMPTION** — a principal holding more than one role TYPE is a *stranger* until it picks a
  hat, bound to the auth session, carried as an `active_role` JWT claim and respected by **every** authorization gate; a
  single-role principal never sees the picker. ⚠ The caller-only condition uses `IS NOT DISTINCT FROM`, never `=`:
  `active_role()` is NULL for a hatless caller, so `=` is a **fail-OPEN**.
- **`public.session_context()`, its twin `getRawGrants()` and the doors enumerating *third parties* are hat-blind BY
  DESIGN** — **fix their CONSUMERS, not them**; one user's hat must never change what is concluded about **another**.
- **`organization_affiliations` RLS is SELECT-only with exactly TWO legs** — own row, or
  `app.is_org_admin_of(organization_id)`; ⛔ **no hospital tier, BY DESIGN**, and every write goes through a door.
- **End and void are different tenses, and voided wins** — *end says "was true and stopped"; void says "was never true."*
  **No hard DELETE**; a void is refused if any membership was ever attached under that scope, and `end_affiliation` refuses
  on an active membership of **ANY** tier under that hospital. Deactivating the *person* is a platform-wide kill switch.
- **The affiliation read legs are EVER-HELD** — no `ended_on` and no `expires_at` conjunct, so a hospital admin keeps read
  visibility of people who once worked at a hospital they administer. Write authority comes from the footprint, not the read.
- **Every refusal lives in the kernel, never the wrapper**; the owner-only `app.*_impl` ACL is what makes `p_actor`
  unforgeable, and ⛔ `authenticated` must **NEVER** hold EXECUTE on a `*_for` twin. **Asymmetries that must not be
  "fixed"**: `p_allow_anchorless` (SESSION door `false`, SERVICE door `true`, every other twin pair behaviourally
  identical) and the Diretor Técnico grant arm — the ONLY kernel grant arm with **no `is_admin_for` branch**.

### Rollout

- Flag `technical_director`. ⛔ Resolve its VALUE and its readers from [`generated-feature-flags.md`](generated-feature-flags.md),
  never from a sentence here. The rest of this seam is structural — no flag; the migration is the cutover.
- ⚠ **A remote cutover of "act as" needs a step `db push` does not cover:** `custom_access_token_hook` must be ENABLED on
  Supabase Cloud, or no `active_role` claim is minted — blast radius **EVERY user, not just multi-role ones** (the hook
  holds the implicit single-role derive too).
- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached the remote is a claim
  about an external system that rots silently — measure it with the recipes in
  [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).

### Open edges

- Built doors awaiting a caller, by decision — none dead code: `public.recover_orphan_person_to_org` has **no TypeScript
  caller**; `list_org_people`'s `date_of_birth` field has **no reader**; the DT referral target ships **no UI**.
- [`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS`](../followups/follow-ups-open.md) stays open — whether the **membership** leg should
  ADD `expires_at`; [`FUP-ACT-CAPA-ASSIGN`](../followups/follow-ups-open.md) — `profiles` RLS has no PQS-operator arm.

### Where the detail lives

- The frozen slices below, ⚠ **newest first, not oldest first**: **§ AE2** (anchor column gone; the three doors) · **§ AFF4**
  (`organization_affiliations`, staff data, the voided tense) · **§ AFF2** (the footprint) · **§ ACT** ("act as") · **§ AFF**
  (`hospital_affiliations`, CPF identity, the directory) · **§ MEM-W1..W3** · **§ MEM-W4** (DT + the referral plane).
- `public.profile_private_details` itself — including that it grants `authenticated` and `anon` nothing, RLS on, zero
  policies — is in [`authorization-and-audit.md`](authorization-and-audit.md); the `app.is_commission_admin_of` →
  `app.is_tenancy_admin_of` rename is in [`document-model.md`](document-model.md).
- Governing ADRs (all: [`../decisions/INDEX.md`](../decisions/INDEX.md)) — [0041](../decisions/0041-multi-tenancy-organizations-hospitals.md) · [0094](../decisions/0094-membership-hardening-and-technical-director.md) · [0097](../decisions/0097-hospital-affiliation-person-identity.md) ·
  [0106](../decisions/0106-act-as-role-assumption.md) · [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md) · [0148](../decisions/0148-ever-held-affiliation-read-visibility.md) · [0151](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md) ·
  [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) · [0161](../decisions/0161-person-authority-sql-twin-retires-no-twin-prohibition.md) · [0163](../decisions/0163-offboarded-person-lifecycle-authority.md) · [0168](../decisions/0168-orphan-recovery-is-its-own-door.md).

## AE2 — affiliation tenancy: the anchor column is GONE (2026-08-28; ADR **0161** / **0163** / **0164** / **0165** / **0166** / **0167** +Amdt 2 / **0168** +Amdt 1–3; migrations `20261003005400`–`…006500`, **12**; pgTAP `390`–`400`, **11**; **NO flag — the migrations ARE the cutover**; QA APPROVED r3 → [authz-ae2-review-r3.md](../reviews/authz-ae2-review-r3.md))

⛔ **`profiles.home_organization_id` IS DROPPED** (`20261003006500`). This executes AFF4 D10's named
**Phase 2** — the paragraph in the AFF4 section below that read *"DEMOTED, NOT DROPPED … the policies
still depend on it"* was true when written and is now false in both halves; it is corrected in place.
Measured on the post-drop head, and the queries are given so they are re-run rather than quoted:

| fact | measured | query |
| --- | --- | --- |
| the column, anywhere in the DB | **0** | `select count(*) from information_schema.columns where column_name='home_organization_id'` |
| policies naming it | **0** | `pg_policies`, `qual`/`with_check` LIKE `%home_organization%` |
| function bodies naming it, **comments stripped** | **0** | `pg_proc`, `regexp_replace(prosrc,'--[^\n]*','','g')` LIKE `%home_organization%` |
| function bodies naming it **including comments** | **5** — `app.affiliate_person_to_org_impl` · `public.list_org_people` · `app.can_administer_person_for` · `app.update_person_fields_impl` · `public.list_addable_commission_members` | same, without the strip |
| deferred trigger `profiles_tenant_has_org_trg` | **0** — dropped by `…005600` | `select count(*) from pg_trigger where tgname='profiles_tenant_has_org_trg'` |
| migration registry | **496 == 496** (DB == files on disk) | `supabase_migrations.schema_migrations` vs `ls supabase/migrations/*.sql \| wc -l` |
| RLS on `public` tables | **170 / 170** | see ARCHITECTURE.md Rule 1 |

⚠ **The 5-vs-0 gap is the point, not a discrepancy.** Every surviving mention is a *comment* saying
what the body used to read (e.g. `list_addable_commission_members`: "was `pr.home_organization_id =
v_org_id`"). Those are deliberate and must stay — they are the only thing that tells the next reader
why the predicate looks the way it does. ⛔ **A `prosrc` sweep that does not strip `--` comments
reports this surface as live and is wrong**; strip first, then judge.

**The replacement predicate, everywhere:** a `public.organization_affiliations` row. Which *tense* of
that row is the load-bearing choice and it differs per site — see the two named predicates below.

### The two named predicates (`app`, DEFINER, owner-only `proacl`, pinned `search_path`)

Both are `postgres=X/postgres` only — no `authenticated`, no `service_role`; they are callable solely
from the DEFINER bodies below, never from PostgREST.

- **`app.person_known_to_org(p_user, p_organization)`** → `exists` a row for the pair with
  `voided_at is null`. ⚠ **NON-VOIDED, not ACTIVE** — an *ended* row still answers TRUE. That is
  deliberate (ADR 0163 bound 1: "void is not end") and is what lets ADR 0151 D5's one-step rehire
  work through the ordinary door without an `org_admin` ticket first.
- **`app.person_is_anchorless(p_user)`** → `not exists` **any** non-voided org affiliation, of any
  tense. ⛔ **No `is_admin` arm, by design**: a `platform_admin`'s own profile answers TRUE here and
  that is correct — the doors are what treat the vendor specially, not the state predicate.

### ADR 0168 — affiliation is THREE doors, not one

The split exists because one door cannot both *refuse a foreign tenant* and *create the first
affiliation a person ever has*. Each door is a `prosecdef` `app.*_impl` kernel; the ACL on its
`public` wrapper is the entire bound on the widening it carries, so it is recorded as such.

| door | wrapper + `proacl` | tenant gate (beyond the authority gate) | audit verb |
| --- | --- | --- | --- |
| **ordinary** `app.affiliate_person_impl` / `app.affiliate_person_to_org_impl` | existing `public` wrappers | **narrowed to `app.person_known_to_org`** — a person unknown to the org is refused `HC0R0` | (unchanged) |
| **creation** `app.affiliate_new_person_impl` / `app.affiliate_new_person_to_org_impl` | `public.affiliate_new_person_for` / `public.affiliate_new_person_to_org_for` — ⛔ **`service_role` ONLY** (`postgres=X ; service_role=X`; **no `authenticated`**) | `person_is_anchorless` **OR** `person_known_to_org` — the `is_anchorless` disjunct **is** the widening | `affiliation.created_on_registration` / `org_affiliation.created_on_registration` |
| **recovery** `app.recover_orphan_person_to_org_impl` | `public.recover_orphan_person_to_org` — `postgres=X ; **authenticated**=X` | `app.is_admin_for(p_actor)` (platform admin **only**) **AND** `person_is_anchorless` — a non-orphan is refused `HC0R0` (`pessoa não é órfã`), a missing org `HC0R5` | `org_affiliation.recovered` |

⚠ **The `service_role`-only ACL on the two `_new_` wrappers is the whole bound on their widening.**
They admit an anchorless person that the ordinary door refuses; nothing but the missing
`authenticated` grant stops a signed-in caller from reaching that. ⛔ **Granting `authenticated` on
either would open tenant creation to any session** — re-derive the ACL from `proacl` before believing
this line, and never "fix" a caller by widening it.

⚠ **`public.recover_orphan_person_to_org` has NO TypeScript caller today** (measured across `src/`;
the only non-generated mentions are prose in `src/lib/members/invite.ts` + its test). It is a built
door awaiting a UI, deliberately — not dead code, and not evidence the path is unreachable.

### ADR 0168 Amdt 3 — the FIRST deliberate asymmetry between a door and its `_for` twin

`app.ensure_provisioned_org_affiliation` and `app.grant_role_impl` both gained
**`p_allow_anchorless boolean DEFAULT false`**, and the two `public` wrappers pass **different**
values — verified from the bodies, not the migration:

- `public.grant_role(...)` → `app.grant_role_impl(auth.uid(), …, **false**)` — *"the SESSION door
  passes `p_allow_anchorless => FALSE`"*.
- `public.grant_role_for(p_actor, …)` → `app.grant_role_impl(p_actor, …, **true**)` — *"the SERVICE
  door passes `p_allow_anchorless => TRUE`"*.

⛔ **Everywhere else in this backend the actor-kernel twin pair is behaviourally identical** and the
only difference is where the actor comes from. This is the first pair where it is not. Record it as
intentional: a reader who notices the divergence and "restores symmetry" removes the registration
path's ability to seat a role on a person who has no affiliation yet.

### ADR 0167 Amdt 2 — the commission `staff` sub-arm

`app.is_admin_for(p_actor)` was **removed** from `grant_role_impl`'s commission **`staff`** sub-arm,
which now requires `is_staff_admin_of_for` **or** `is_tenancy_admin_of_for`. This closes the second
one-way door Amdt 1 found: `revoke_role_impl`'s `staff` sub-arm never carried an `is_admin_for`, so a
platform admin could **seat** a commission `staff` and could not **remove** one. ⚠ **It moves the
platform admin's refusal one statement earlier** — a *measurement* hazard, not a behaviour change: a
SQLSTATE-only assertion downstream keeps its `42501` while its subject silently changes. pgTAP `293`
§3.1 and `397` §5.2 discriminate **by message** for exactly that reason.

### ADR 0166 — the demotion backstop, `HC0RB`

`public.guard_profile_privileged_columns` gained a final arm: an `is_admin` **true→false** change on a
person who `app.person_is_anchorless` raises **`HC0RB`** (pt-BR: *"não é possível remover a condição de
administrador de plataforma sem antes registrar um vínculo organizacional para esta pessoa"*).
Three properties are deliberate and are in the body's own comments:

- **Placed LAST**, behind the actor check — a non-admin caller still gets the cheaper
  `check_violation` and never reaches this read (pinned by pgTAP `400` §4.2).
- **Gated on true→false ONLY.** An arm keyed on *"`is_admin` changed"* would refuse legitimate
  **promotions** of anchorless people, and would pass every other cell in `400` (§2.9 is the
  opposite-polarity cell that catches it).
- **`coalesce` is fail-closed, not decorative** — if either column ever became nullable, a NULL
  `new.is_admin` reads as "no longer an admin" and is checked, rather than silently skipping the guard.

### New audit verbs

Three, all measured from `prosrc` (`org_affiliation.*` / `affiliation.*` now number **13** together):
**`affiliation.created_on_registration`** · **`org_affiliation.created_on_registration`** ·
**`org_affiliation.recovered`**. ⚠ **The ordinary doors call `app.audit_write` ZERO times** (measured
on `prosrc`), yet their creates ARE audited — the row-level trigger
**`trg_audit_organization_affiliations`** emits `org_affiliation.created` for them. ⛔ **So a
door-body sweep for `audit_write` under-reports this table's audit coverage**: the three new verbs
above are door-emitted *because they carry actor/reason context a trigger cannot see*, not because
the ordinary path is unaudited. Judge coverage from `pg_trigger` **and** `prosrc`, never one alone.

## AFF4 — organization affiliation, per-hospital staff data, the voided tense (2026-08-26; ADR **0151** D1–D17 + **0154** / **0158** / **0159**; migrations `20261003003200`–`…004300`, **12**; pgTAP `301`–`304` · `371`–`375` · `377`–`381`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ⛔ **NOT PUSHED at the Record edit; 12 migrations are LOCAL ONLY**

**New table `public.organization_affiliations`** — "this person belongs to this organization" as a
row with a lifecycle, replacing `profiles.home_organization_id` as the *roster* predicate.
⚠ **RLS is SELECT-only and has exactly TWO legs** — `principal_id = auth.uid()` **OR**
`app.is_org_admin_of(organization_id)`. ⛔ **There is NO hospital tier, BY DESIGN** (ADR 0151 D1,
pinned by pgTAP `375` §4.1, reaffirmed by ADR 0158): a `hospital_admin` cannot read this table at
all. Every write goes through a door. **Re-derive from `pg_policies`, never from this paragraph.**

**Five new doors** (D2) — each a `public` `prosecdef` actor-kernel triple with a `service_role`-only
`_for` twin: `affiliate_person_to_org` · `end_org_affiliation` · `update_org_affiliation` ·
`void_affiliation` (hospital rows; creation-symmetric authority — org_admin of the org OR
hospital_admin of *that* hospital) · `void_org_affiliation` (org rows; org_admin only). New authored
SQLSTATEs **`HC0R6`–`HC0RA`**, pinned by name in pgTAP `304` §6.7.

⚠ **A SIXTH new function exists and is easy to miscount as one of the five: `get_own_person_record`**
(D14) — the self-only door behind `/conta/meus-dados`. It is self-only **by shape** (`pronargs = 0`,
so there is no subject parameter to spoof), has **no `_for` twin**, and carries **no ARM 1 verdict**:
a *named absence* backed by a mutation-proven keystone, not an oversight.

⛔ **The D4 containment trigger is SECURITY DEFINER, and the reason is load-bearing.**
`hospital_affiliation_has_org_trg` → `app.assert_hospital_affiliation_has_org` (installed
`20261003004000`, `DEFERRABLE INITIALLY DEFERRED`) enforces *active hospital affiliation ⇒ active
organization affiliation, same org*. It shipped SECURITY **INVOKER**, so its `EXISTS` against
`organization_affiliations` ran under the **caller's** RLS — and that table has no hospital tier — so
for a `hospital_admin` the trigger could not see the org row `affiliate_person_impl` had written one
statement earlier, raised a false-positive `23514`, and rolled the transaction back: **D5's one-step
rehire was broken for EVERY `hospital_admin`, unconditionally** (`BUG-D5-REHIRE-HOSPADMIN-001`).
Corrected to **DEFINER** by `20261003004300` (ADR **0159**, pgTAP `381`). ⭐ **DEFINER grants nobody
anything here:** the function enforces a **data invariant**, not an authorization decision — it reads
no caller identity (no `auth.uid()`, no `app.has_role`, no `app.active_role()`).
⭐⭐ **The standing shape, not an AFF4 fact:** *two individually-correct decisions composing into a
break* — a deliberately narrow policy, and a backstop reading under caller RLS. **No test that varies
only the STATE can see it**, which is why ADR 0159 D4 requires an invariant assertion to vary the
**ACTOR**.

**Per-hospital staff data lives ON `hospital_affiliations`** (D9) — `job_title` / `work_email` /
`work_phone`. ⛔ **No new `profiles` columns, and no parallel `hospital_staff_profiles` table** — both
were considered and declined. Reads are unaudited by decision, with the audience stated; there is no
`department` column.

**The voided tense** (D7–D8) — `voided_at` / `voided_by` / `void_reason` on **both** affiliation
tables, reason mandatory. *End says "was true and stopped"; void says "was never true."* Voided rows
leave every person-read leg, footprint resolver, active-unique index and roster, **while the row
itself stays visible** to the same audience badged *Anulado*. Ended and voided can both hold; **voided
wins**. There is **no hard DELETE** — Rule 12's minimise-not-destroy posture (ADR 0072 §7·3). A void
is refused if any membership was ever attached under that scope, and every void is audited with its
reason. Differential pinned by pgTAP `374` and `377`.

**"Active", defined once** (D6) — affiliations are `ended_on IS NULL AND voided_at IS NULL`;
memberships are `expires_at IS NULL OR expires_at > now()`. ⛔ **The three existing read policies
deliberately do NOT gain an `expires_at` filter** — ever-held reads make read-side expiry filtering
incoherent. ⚠ So a measurement finding `f` for `expires_at` on the `profiles` SELECT policies is the
**ruled outcome**, not a defect; see `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` in PROGRESS.md, which is held
OPEN over exactly that reading.

**The tense pair on `OrgUserListItem`** (`src/lib/users/types.ts`) — `orgAffiliationStatus: 'ativo' |
'encerrado' | null` and `orgAffiliationEndedOn: string | null`. ⛔ **The scope rule is enforced in the
TYPE, not by memory:** `null` means *"not resolvable at this scope"* — `listOrgUsers` **never**
returns null (its roster predicate **is** an org affiliation); `listHospitalUsers` **always** returns
null (ADR 0158: the hospital directory keeps its predicate, and never fixes a read by granting
access). Both directions pinned in `src/lib/queries/org-roster-predicate.test.ts`. The same pair rides
the `lookupOrgPeople` payload in `src/lib/queries/affiliations.ts`, where the status is
**non-nullable**.

⚠ **`home_organization_id` was DEMOTED HERE, and is now DROPPED** — D10's named **Phase 2** was
executed by **AE2** (`20261003006500`, 2026-08-28; see the AE2 section above). At AFF4 only the
*roster predicate* (the application query filter in `listOrgUsers`, per ADR **0154**, which corrected
D10's naming of `list_org_people`) had moved to org affiliations, while **every RLS leg and the
deferred tenant trigger still read the column** — which is why this paragraph then warned ⛔ *"do not
read 'the roster moved' as 'the column is unused' — the policies still depend on it."* That warning
is **retired**: the column, its policies and `profiles_tenant_has_org_trg` are all gone, and the
lifecycle question over fully offboarded persons D10 deferred was answered by ADR **0163** (an ended
row decides *where*, never *whether*). ⛔ **The inverse warning now applies** — do not read a
surviving `home_organization_id` in a function *comment* as a live dependency; the comments-stripped
count is **0**.

## AFF2 — affiliation-scoped administration (2026-08-23; ADR **0133** + **Amendments 1–4**; migrations `20261003001000`–`…001200`, **3**; pgTAP `359` `plan(18)` · `360` `plan(21)` · `361` `plan(24)`; **NO flag — the migrations ARE the cutover**; QA APPROVED r2, PO-approved) — ✅ **PUSHED 2026-08-25**

✅ **PUSHED 2026-08-23 — schema first, then code.** Remote re-measured (not read off the push output):
**444 / `20261003001200`**, `origin/main..main` = 0. Verified in the **catalog**: both columns exist
(`date_of_birth date NULL`, `phone text NULL`), `list_org_people(uuid,text,text)` is `secdef` with
`date_of_birth` in its return type and still **one** overload, `professional_credentials_select` carries
both legs, and the column-lock holds as a **differential** — both new columns `authenticated:REFERENCES`
only, identical to `cpf`, against `full_name`'s full set; no `anon` grant. ⛔ **Re-measure before quoting**
— superseded by the next remote-affecting change.

> ⛔ **SUPERSEDED AS TO LOCATION BY AE3 (2026-08-31, ADR 0155 D4) — the paragraph below is a DATED
> record of 2026-08-23 and its present tense is no longer true.** `date_of_birth` and `phone` are
> **no longer columns of `profiles`**; they moved, with `cpf`, to **`public.profile_private_details`**
> (migrations `20261003006600`–`006800`). The *mechanism* changed with them: they are no longer
> "column-locked" on a mostly-granted table — the new table grants `authenticated` and `anon`
> **nothing at all**, has RLS on and **zero policies**. ⛔ Their two arms also LEFT
> `guard_profile_privileged_columns`' `v_identity_changed` limb, because the columns they named no
> longer exist (plpgsql is late-bound: leaving them would 42703 on every later `profiles` UPDATE).
> ⚠ **The TRIGGER was not dropped and its other arms were not edited** — that is what "untouched"
> means here, and the body itself obviously WAS rewritten one sentence ago. `359` §3 asserts the
> retire-and-replace in both directions: §3.2 that the body no longer names the three, §3.3 that a
> REMAINING arm still bites (so the guard was edited, not gutted). See § *`profile_private_details`* below.

**Schema.** `profiles.date_of_birth date null` + `profiles.phone text null` (digits-only, **no CHECK** by
decision — Amdt 1 r6; formatting is display-side). ⛔ **Column-locked exactly like `cpf`**: absent from every
`authenticated` column-list grant, so they carry **only** `REFERENCES` (the table-level grant) — verified
byte-for-byte against `cpf`, and against `full_name`'s full set. Both join
`guard_profile_privileged_columns`, on its **`v_identity_changed`** limb (service-role-only), **not**
`v_privilege_changed` — a platform_admin must not write a DOB from a session (§1 noun rule).

**RLS — one policy widened.** `professional_credentials_select` gains an **affiliation** leg
and a **membership** leg, both **mirroring the live `profiles` legs verbatim**, i.e.
`COALESCE(hm.hospital_id, hc.hospital_id)` — **hospital-tier admitted** (Amdt 2 r1: D13 named the artifact
to copy, and narrower-than-`profiles` manufactures the "empty means no-permission" state the widening
exists to remove). ⚠ **No `expires_at` filter, deliberately** (Amdt 2 r3).

> ⛔ **AMENDED 2026-08-25 by ADR 0148 (migration `20261003002900`).** This paragraph said the affiliation
> leg carried `ended_on IS NULL`, and that the `expires_at` question stayed "open across three authorities
> (`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS`)". Both are now false. The `ended_on` conjunct was removed from this
> policy **and** from both `profiles` SELECT policies: the affiliation leg is **EVER-HELD**, so a
> `hospital_admin` keeps read visibility of people who once worked at a hospital they administer (without
> it, `end_affiliation` — the documented offboarding action — 404'd its own actor). Verified from the live
> catalog: **zero** occurrences of `ended_on` and zero of `expires_at` across all three predicates, so both
> legs now agree. ⛔ **That does NOT close `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS`** — an earlier version of this
> paragraph said it did, and that closure was **proposed and rejected on 2026-08-25**. The item's open
> question is whether the **membership** leg should ADD `expires_at`, so "zero `expires_at`" states the
> defect and cannot also be its resolution; the asymmetry resolved **permissively**, which narrows the item
> rather than discharging it. It stays 🟡 (`docs/followups/follow-ups-open.md`; ADR 0148
> Consequences). Write authority is untouched — where the affiliation was the person's **only** active tie
> they have an empty footprint in `resolvePersonFootprint`, so `personScopeAllows` denies all four
> capabilities; ⚠ a surviving **commission-tier** seat at that hospital keeps the footprint non-empty and the
> person writable (the resolver unions two sources — ADR 0148 D6). Keystone:
> `supabase/tests/368_offboarded_person_visibility.sql`.

> ⛔ **AE3 (2026-08-31) CHANGED WHERE THIS PAYLOAD'S `date_of_birth` COMES FROM, and nothing else
> about this door.** It is now LEFT-joined from `public.profile_private_details`, not read off
> `profiles`. The **signature, ACL, `prosecdef`, overload count and the `person.cpf_lookup` audit
> semantics are all unchanged** — so no `DROP`+`CREATE` was needed this time, and the paragraph
> below stays true of everything except the source relation. ⚠ The CPF probe's join is INNER (a
> person with no CPF on file cannot match an exact CPF) while the payload's is LEFT (a person with
> no details on file stays ON the roster with a null DOB) — pgTAP `361`.

**Door.** `list_org_people(uuid, text, text)` payload gains `date_of_birth` (phone stays out). Return-type
change forced **`DROP` + `CREATE`**, so the ACL, `prosecdef`, `SET search_path` and the COMMENT were all
re-issued and re-measured. ⚠ **Its signature is all `pg_catalog.text` — NOT `citext`**, and there is exactly
**one** overload; a `citext` twin would be a second, ungranted door. ⭕ **The `date_of_birth` payload has NO
reader today** — D11's match-card clause was **retired** (Amdt 4 r2: the caller matches CPF exactly at full
length, returning at most one row, where a birth date disambiguates nothing). It is a **built door awaiting
a name-search caller**, by decision — do not revert it as dead code.

**TS surface (no RLS backstop — Rule 9 exception, authorized service reads).**
- `src/lib/users/person-scope.ts` — the **pure** predicate `personScopeAllows(capability, footprint, administered)`. Capabilities: `fields` / `credentials` → **intersection**; `cpf_change` / `lifecycle` → **subset** (Amdt 1 r1).
- `src/lib/users/person-footprint.ts` — ⛔ **deliberately carries NO `'use server'`**, and that is the load-bearing property of the file: `actions.ts` has the directive, so every export there is a callable endpoint, and exporting the resolver from it would publish an authority oracle. Holds `resolvePersonFootprint` (**filters `ended_on` AND `expires_at`** — QA R1) and `getPersonAdminView`, which returns `{ personalData: {...} | null, authority: { canEditPerson, canManageAccountLifecycle } }`. ⚠ **The OUTER null means WITHHELD, not "nothing informed"** — the nesting is what forces the caller to distinguish them. ⚠ `canManageAccountLifecycle` is **unrelated** to the cases domain's `caps.canManageLifecycle`.
- `src/lib/users/actions.ts` — `authorizePersonScopedAdmin` replaces `authorizeOrgAdminForUser` at **six** sites. ⚠ `updateUserProfile` applies the **tighter** bound on a CPF **change**, compared **normalised on both sides** — **change-based, not presence-based** (Amdt 3): the literal reading would deny a hospital_admin editing the *name* of a cross-hospital person, the exact case Amdt 1 r1 exists to allow. `registerUser` returns the created id (`RegisterUserState`).
- `src/lib/queries/org-users.ts` — directory widening: `hospitalNames[]`, `committees[]`, pre-formatted `councilRegistration`, `statusCounts` from the **unfiltered** scoped set, and `hospital?: string | null` on `ListDirectoryOptions` (**NARROW** — the org roster AND at H; it falls out of an intersection, so the rule has one definition). ⚠ **The left half of that intersection was re-predicated at AFF4/AE2 and this line read `home_organization_id = orgId` until then**: it is now *"holds a non-ended, non-voided `organization_affiliations` row to `orgId`"*, applied as `.in('id', orgScope)` with a second `.in('id', hospitalScope)` for H. The **narrowing** property is unchanged — `?hospital=` can never widen the org roster. A sibling option `includeEnded?: boolean` (default `false`) relaxes only the *tense* of the left half, and is **ignored by `listHospitalUsers`** (ADR 0158).

⚠ **`expires_at` semantics, stated because the direction is counter-intuitive:** filtering it **narrows** the intersection capabilities and **WIDENS** the subset ones — a smaller footprint is easier to be a subset of. Both directions are pinned; the widening arm is the only one that reaches the subset path (the others deny via the zero-footprint rule).

## ACT — "act as" STRICT ROLE ASSUMPTION (2026-08-10; ADR 0106 D1–D14; migrations `20260918000000`–`…002800`; **NO flag — the migration IS the cutover**, PO-locked P4)

**The model in one line:** a principal holding **more than one role TYPE** is a *stranger*
until it picks a hat; the hat is bound to the auth session, carried as an `active_role` JWT
claim, and **every** authorization gate respects it. A single-role principal never sees the
picker — the token hook derives its lone hat implicitly.

⚠ **REMOTE CUTOVER NEEDS A STEP `db push` DOES NOT COVER:** `custom_access_token_hook` must be
**ENABLED on Supabase Cloud** (locally it is `config.toml` `[auth.hook.custom_access_token]`).
Without it the remote mints **no `active_role` claim** — and the blast radius is **EVERY user,
not just multi-role ones**, because the implicit single-role derive lives INSIDE the hook. Probed
live on a single-role persona (`chefe.ccih`, staff_admin only) with the claim absent:
`active_role()` = NULL → `has_role(staff_admin, self)` = **false** → `commissions` visible = **0**.
Total lockout, not a degradation. *(This paragraph said "every multi-role principal" until
2026-08-10; that understated it — corrected after measuring rather than reasoning.)*

### New surface

| | |
|---|---|
| `public.platform_role` | enum, **11 labels** = the 10 `memberships_role_check` values **+ `platform_admin`**. In `public` **on purpose**: `config.toml` exposes only `public`/`graphql_public`, so an `app` enum never reaches `gen:types`. A bare enum TYPE is not a relation — no endpoint, no RLS surface. |
| **`app.active_role_selections`** | the session↔hat binding — columns `(session_id, user_id, role, chosen_at)`, PK on `session_id`. ⚠ **`app`, NOT `public`** (this row said `public` until 2026-08-10): `app` is not in `config.toml`’s exposed schemas, so **PostgREST offers no route to it at all** — a client cannot read or write its own hat row directly. RLS carries a **SELECT-only** self policy (`user_id = auth.uid()`) and the table ACL is **owner-only** (`relacl` NULL), so there is no INSERT/UPDATE policy for anyone: the ONLY writer is `public.assume_role` (SECURITY DEFINER), which upserts `on conflict (session_id)`. Read at token-mint time by the hook — never consulted by a gate at query time. |
| `public.assume_role(p_role)` | **the only way to acquire a hat.** Validates the caller genuinely holds the role, writes the selection, stamps `active_role.assumed` into `audit_log` **with the assumed role's own tenancy** (`20260918002600`; only `platform_admin` stamps all-NULL — it has no tenant). ⚠ Its `platform_admin` branch reads **raw `profiles.is_admin`**, NOT `is_admin()` — deliberately: `is_admin()` now requires the hat, so calling it here would be circular and would break the break-glass path the ADR protects. |
| `app.active_role()` | reads the claim. Returns **`text`**, so it is **structurally invisible to `ARM=census`** (which counts BOOLEAN gates) — do not cite census as coverage for the hat; the revert-twin keystone is the real coverage. |

### Gates that changed (verify against `pg_proc`, never this table)

- **`app.has_role`(4-arg) + `app.has_role_any`** — gained the **caller-only** condition, the
  house pattern everything else now mirrors:
  `and (<target> is distinct from auth.uid() or <role> is not distinct from app.active_role())`.
  ⚠ **`IS NOT DISTINCT FROM`, never `=`** — `active_role()` is NULL for a hatless caller and
  `x = NULL` is NULL, which a PL/pgSQL `if not` treats as false-ish: the plan's own literal text
  was a **fail-OPEN** (BUG-ACT-NULLHAT-1).
- **`app.is_admin()`** (D11) — also requires the `platform_admin` hat. Provably a no-op while
  **0 platform_admins hold a membership**; a pgTAP **tripwire** reds if one ever does.
- **`app.is_admin_for(uuid)`** + **`app.can_manage_professional`** (`20260918002800`, from the
  Stage-3 QA BLOCKER) — same caller-only condition. ⚠ **`can_manage_professional` no longer
  carries that condition inline**: `20260918003000` (BUG-ACT-EXPIRY-1) removed the raw
  `memberships` arm the condition was attached to, so the gate now inherits BOTH expiry and
  the hat from `app.has_role`. Keystone `320` reds if a raw `memberships` read is
  reintroduced. ⛔ **`is_admin_for` is NOT a third-party
  helper**, whatever its signature suggests: both callers (`grant_role_impl`/`revoke_role_impl`)
  receive `p_actor` from `public.grant_role`/`revoke_role`, which bind it to
  `(select auth.uid())` — it is **the caller gate on the membership-grant door**.
- **`app.member_can`** (D13) · **`app.audit_write`** (D8 — stamps `metadata.acting_as`, a role
  LABEL, into every row when a hat is active; inside the hash chain).
- **Five caller-gating DEFINER doors** de-blinded (`20260918002500`): `commission_overview` ·
  `list_org_people` (hospital_admin arm) · `quality_board_summary` (42501 entry gate) ·
  `capa_kpis` (nsp_coordinator arm) · `pqs_inbox`; plus `list_my_nsp_hospitals`
  (`20260918002400`). **24 sibling doors were LEFT hat-blind on purpose** — they enumerate
  *third parties* (rosters, candidate lists, recipients), and one user's hat must never change
  what the system concludes about **another**.
- **DROPPED:** the 3-arg `has_role` — a pure delegation with **zero** callers across four
  surfaces, so S3 would have changed what it *meant* without changing its text.

### Two doors that are hat-blind BY DESIGN — never "fix" them

`public.session_context()` (the picker and the D9 hint need the caller's FULL grant list) and
its app-layer twin `getRawGrants()`. **Fix their CONSUMERS, not them.** Ruling `session_context`
exempt without auditing its consumers is exactly what produced the P0 below.

### App layer

`getSessionContext()` (`src/lib/queries/session.ts`) filters every derived grant list by
`activeRole` — fixed **centrally**, because `partitionGrants()` fed **88 call sites across 29
files** that read those fields as access decisions (a 29-file patch sweep would have missed
one). `context.isAdmin` now mirrors `is_admin()`'s own condition. **`resolveLanding` was
DELETED**, not patched — a second hand-rolled precedence chain covering only 4 of 11 roles.
Picker route: **`/selecionar-perfil`**. ⚠ A guard's `notFound()` thrown in a `layout.tsx` is
caught by the **GLOBAL** `src/app/not-found.tsx`, never a same-segment sibling. ⚠ `RoleSwitchHint`
is a **client** component: it receives only `{role, count, landing}` strings — passing grant
objects serialized commission ids/names/slugs into the RSC payload of every signed-in 404.

### ⛔ FOUR classes of hat-blindness — the checklist for any new gate

1. App guards deriving from a hat-blind session context. 2. A raw JWT-claim read. 3. A DEFINER
door reading `memberships` raw. 4. **A boolean gate that RECEIVES the caller's uid as a
parameter instead of reading `auth.uid()` itself** — found by the QA review *after* three
green authz arms passed. Class 4's rule, now binding on the standing door audit (**ADR 0079
Amendment 6** + `docs/progress/authz-handoff.md` **§7.17**): **classify by CALL-SITE BINDING,
never by signature shape**, extract call arguments with a **balanced-paren** parser (a regex
cannot see `f((select auth.uid()))`, this repo's house style), and build call-graph edges on
`name[[:space:]]*\(` — a bare substring lets the *column* `is_admin` match the *function*
`app.is_admin` and manufacture a false "already covered" edge.

### D14 arm classification (S4, 2026-08-10 — re-derive from `pg_proc`, never this table)

`app._case_caps` audited arm-by-arm from the live catalog. Every bit-contributing arm
classified; STEP 1–3 (null-uid / `is_active` / unknown-case) are **preconditions**, not
arms — they contribute no bits and are deliberately hat-independent (`is_active` is D3's
outer status gate).

| Arm | Bits | Class | Enforcement point |
|---|---|---|---|
| S1 coordinator | 1\|2\|4\|8\|32\|64 | **role** | `is_staff_admin_of_for` → `has_role('commission','staff_admin')` |
| S2 tenancy admin | 64 | **role** | `is_tenancy_admin_of_for` → `has_role('organization','org_admin')` OR `has_role('hospital','hospital_admin')` |
| S5 member default | 2 (¬`explicit_grants_only`) | **role** | `is_member_of_for` → `has_role_any('commission')` |
| S6 NSP referral | 4\|2 (flag + referral exists) | **role** | `is_pqs_operator_of_for` → `has_role('hospital','nsp_coordinator'\|'pqs_member')` |
| S7 quality reviewer | 4\|1 (oversight-visible, ¬eg) | **role** | `is_quality_reviewer_of_for` → `has_role('hospital','quality_reviewer')` |
| S3 manual grant | per-column (lattice on read) | **relationship** (D6) | `case_access_grants` row, `principal_id = p_uid`, active + unexpired |
| S4 assignment | 4\|2 | **relationship** (D6) | `case_phases`/`case_narratives.assigned_to = p_uid` |
| STEP-4 denies | ⇒ 0 | **relationship** (D6) | `is_case_respondent` / `is_recused_from_case` |

No hybrid and no unclassified arm. The role arms obey the hat only because `has_role`/
`has_role_any` carry the caller-only condition **and** the evaluated principal is the
caller: a third-party evaluation (`p_uid <> auth.uid()`) consults full grants **by
design** (the one third-party binding into this graph is `file_correction_request`'s
corrector check). Keystone: **`319`** (divergence proof + in-file mutation twins on both
enforcement bodies + hatless D5×D6 pin + third-party disarm + recusal zeros).
⚠ Noted for the record: the plan/task ruling classes per-case **ACL rows** as
relationship-derived (D6-immune, hat-independent incl. hatless) although D13's
grant-vs-relationship language could read otherwise — 319's A13 pins the as-built
semantics so any re-ruling must consciously red it.

### Standing hat-blind sweep (S4) — `ARM=hat`

`supabase/tests/mutation/act-hat-blind-sweep.sh` (wired as **ARM=hat** of
`p0-authz-invariant.sh`, in `ARM=all`; ~10 s): flags **caller-bound raw `memberships`
reads with no adjacent active-role condition** — Amendment 6 method (balanced-paren arg
extraction, `name(` edges, transitive caller-boundness), chunk-level adjacency where
delegation into `has_role*` counts as evidence, anchored by an explicit check that both
delegates still carry the condition. **Self-tests its own detector every run** (planted
blind/covered/class-4 specimens + neutralized-anchor flip) and fails on ghosts as well
as new findings. Findings ≡ `act-hat-blind-allowlist.txt` — a **separate artifact** from
the 0079 BLIND allowlist (designed behaviour, not coverage debt): `session_context()`,
`assume_role`, and the `memberships_select` self arm (sweep-found, same D9 class);
`service_role`/`custom_access_token_hook` is a class exemption in the header, unkeyable
by construction. ADR 0107.

### Verification estate (re-derive; do not trust this text)

pgTAP keystones **`315`** (revert-twin, also closes `assume_role`'s ARM=floor gap) · **`316`**
(the 5 caller-gating doors, red-first) · **`317`** (CAPA audit scope) · **`318`** (the class-4
siblings; red-first on 5 ⭐ assertions incl. `grant_role` succeeding under the wrong hat) ·
**`319`** (S4 — D14 arm divergence, mutation twins in-file).
Suite at S3 close: **179 files / 5690 tests** (+`319`: 180 files / 5707). `ARM=census` 450
live gates / 461 verdicts · `ARM=floor` 80 never-called doors, all allowlisted · `ARM=hat`
3 findings, all reasoned-allowlisted.

### Known-open at hand-off

> ✅ **`BUG-ACT-EXPIRY-1` and `BUG-ACT-ACL-1` are CLOSED 2026-08-10** — migrations
> `20260918003000` + `20260918003100`, keystone **`320`** (10 assertions), suite now
> **181 files / 5718 tests**. Both were RED-first against the pre-fix catalog.
> - **EXPIRY**: `app.can_manage_professional` no longer reads `public.memberships`
>   directly at all — the Stage-2 compensating clause is gone and `app.has_role` is
>   the single membership path, so expiry AND the ACT caller-only hat condition are
>   inherited rather than re-implemented. ⚠ Keystone **`318` PART 2 changed with it**:
>   assertion 10 is INVERTED (an expired staff_admin is now REFUSED even when
>   correctly hatted), and the D5 hat twin was **re-anchored onto the LIVE arm** —
>   leaving it on the expired arm would have left a control anchored on a defect,
>   true by construction once the defect was fixed. `320` adds the behavioural half:
>   the refusal arriving at a real door (`create_case_assignment_role`), plus a
>   live-admitted CONTROL so a broken-closed gate cannot pass.
> - **ACL**: `app.is_entitled_document_approver` now carries
>   `postgres/authenticated/service_role`, matching all 7 Stage-2 siblings.
>   `320` asserts **uniformity across all 8**, so it also reds if any of them is ever
>   rebuilt with DROP+CREATE (which silently loses the ACL). This closes **one
>   instance**, NOT the standing **AUDIT-INVOKER-WRAPPER** population audit.

**`FUP-ACT-DISPOSE-UI` — a PILOT-GATE CHECK**: the LGPD
Art. 18 referral-erasure path has **no UI route**; every principal `dispose_referral_phi`
authorizes is 404'd by the page hosting the affordance, and everyone who reaches that page is
refused by the door — **the two sets are disjoint** · `FUP-ACT-CAPA-ASSIGN` (`profiles` RLS has
no PQS-operator arm, so operators see ~only themselves in the CAPA assignee picker).
**S4 backend items DONE 2026-08-10** (D14 table + `319` + `ARM=hat` sweep + reasoned
allowlist — see the S4 sections below); frontend's `navScope` branch and the lead/qa
record step remain S4-open.

## AFF — Hospital affiliation, CPF person identity, org people directory (2026-08-06; ADR 0097 + 0098; migrations `20260909000100`–`…001300`; NO flag, structural)

**New table `public.hospital_affiliations`** — "this person works at this hospital" as a row.
`(principal_id → profiles ON DELETE CASCADE, organization_id, hospital_id, hospital_employee_id,
started_on, ended_on, created_by/created_at/ended_by)`. Composite FK `(hospital_id,
organization_id) → hospitals(id, organization_id)` — it **REPLACES** a single-column `hospital_id`
FK; a second FK to an already-reachable target is the PGRST201 ambiguous-embed shape (ADR 0094
lesson). Partial unique `(principal_id, hospital_id) WHERE ended_on IS NULL` = one *active*
affiliation; history is unbounded and legitimate. `authenticated` holds **SELECT only — no DML
grant**; writes go through the doors. Ending is a soft `ended_on`, **never a DELETE**, enforced by
`guard_affiliation_no_delete` (origin-enabled, mirroring `guard_profile_no_delete`).

⚠ **`hospital_affiliations_select` has FOUR legs**, and the affiliation leg is **ROW**-scoped, not
principal-scoped (ADR 0098 §1): `principal_id = auth.uid()` OR `is_org_admin_of(organization_id)`
OR `is_hospital_admin_of(hospital_id)` OR a membership leg resolving the hospital via
`COALESCE(m.hospital_id, c.hospital_id)`. The plan's literal principal-scoped wording is a policy
on T reading T = **42P17 infinite recursion**; the reach it would have added is served by
`list_org_people` instead. `app.is_admin()` is deliberately **NOT** a leg.

**The person key is `profile_private_details.cpf`** (⛔ **it was `profiles.cpf` until AE3,
2026-08-31 — ADR 0155 D4**) — nullable, partial unique `WHERE cpf IS NOT NULL`, digits-only, check
digits validated in **both** SQL (`app.is_valid_cpf`) and TS (`src/lib/users/cpf.ts`), parity
pinned by `src/lib/users/__fixtures__/cpf-vectors.json`. The CHECK and the partial unique index
**moved as the same statements** calling the same validator — they were not re-typed, which is why
a formatted CPF is still refused at rest (`301` §2.2, `359` §6.1).

⚠⚠ **`profiles` IS ON COLUMN-LIST GRANTS, AND SINCE AE3 NOTHING IS WITHHELD BY THEM.**
`authenticated` holds SELECT/INSERT/UPDATE on **all 10** of its columns; table-level
`DELETE/TRUNCATE/REFERENCES/TRIGGER` remain, and table-level SELECT/INSERT/UPDATE are still
**revoked**. **EVERY NEW `profiles` COLUMN STILL NEEDS ITS OWN GRANT OR READS 42501** — that half
is unchanged and is why the column-list mechanism was kept rather than collapsed back into a table
grant, which would auto-publish every future column.

⛔ **What AE3 retired is the WITHHOLDING, not the mechanism.** The old rule — *"the set of columns
with no `authenticated` SELECT grant must be exactly `{cpf}`"* — is **false now**: that set is
**EMPTY**. `301` § 0.10 was split to say so executably: **§ 0.10a** asserts the withheld set on
`profiles` is empty (it reds if anyone re-locks a column there without deciding to), and
**§ 0.10b** is the successor hand-list tripwire, asserting that **every** column of
`profile_private_details` is withheld. ⚠ The shape INVERTED: the old list named what was withheld
from a mostly-granted table; the new one names the whole table, because nothing on it is granted.

The residual `REFERENCES` on `profiles` is inert **two** ways: `authenticated` holds no CREATE on
`public`, and the CPF partial unique index is not a legal FK target.

**DROPPED: `profiles.home_hospital_id` and `profiles.hospital_employee_id`.** Matrícula is a
property of the *employment*, not the person. ⚠ **At AFF `home_organization_id` was untouched** —
it was then the tenancy anchor and the filter of every org-scoped read, and this sentence existed to
stop a reader inferring that the third `home_*` column went with the other two. **It has since gone
the same way**: dropped at AE2 (`20261003006500`), its roster role taken by
`organization_affiliations`. The AFF-era claim is kept because the *distinction it drew* still holds
— employment-vs-person is why `home_hospital_id` and `hospital_employee_id` left first.
`guard_profile_privileged_columns` was
rewritten in the **same** migration (plpgsql is late-bound: the DROP succeeds and then every later
`profiles` UPDATE fails 42703 at runtime) and `cpf` joined its service-role-locked identity set.
⛔ **AE3 then reversed that last clause and re-ran the same lesson**: `cpf`, `date_of_birth` and
`phone` **LEFT** `v_identity_changed` in `20261003006700`, one migration **before** the columns were
dropped in `006800` — same late-binding reason, opposite direction. Their protection did not lapse;
it moved from a trigger arm a signed-in caller reached and was refused by, to an **absent grant**
that stops the caller one layer earlier (42501, not 23514).

### Doors (verified against `pg_proc`, not the migrations)

**Actor-kernel shape, mirroring `grant_role_impl`/`grant_role_for`** — because `registerUser` runs
service-role with **no `auth.uid()`**, so a single `auth.uid()` door would be bypassed on the path
that creates *most* affiliations, and the D13 tenant check would never run there:

| function | ACL | note |
|---|---|---|
| `app.affiliate_person_impl` · `app.end_affiliation_impl` · `app.update_affiliation_impl` | **`postgres=X/postgres`** | owner-only — this is what makes `p_actor` unforgeable |
| `public.affiliate_person` · `end_affiliation` · `update_affiliation` | + `authenticated` | `auth.uid()` wrappers |
| `public.affiliate_person_for` · `end_affiliation_for` · `update_affiliation_for` | + `service_role` **only** | service path |
| `public.list_org_people(p_org_id, p_search, p_cpf)` | + `authenticated` | returns **`[]`, never raises**, for an unauthorized caller — a probe cannot distinguish "no results" from "not allowed". Gated by an **inline** predicate (org_admin OR an active `hospital_admin` in the org), deliberately **NOT** `app.is_org_level_admin_within` (which also admits `nsp_org_admin` and is a live leg of `organizations_select`). **`cpf` is NEVER in the payload**; `p_cpf` is exact-match only |
| `public.log_cpf_probe_for` | `service_role` only | it fronts nothing — **the ACL IS its entire boundary** (`304` §9) |

**Every refusal lives in the kernel, never the wrapper.** Error codes `42501` + `HC0R0…HC0R5`, all
seven mapped to distinct pt-BR messages in `src/lib/affiliations/actions.ts`. ⚠ `HC0R5` exists
*because* `check_violation` **is** `23514`, which the table's CHECKs and the delete guard also
raise — a `23514` arm would have collapsed three unrelated conditions into one sentence, correct
only by accident. A drift detector (`door-error-arms.test.ts` + `304` §6) asserts every raise code
in the doors has a `toState` arm; it enumerates **any** `errcode` spelling, normalizes named
conditions, throws on an unrecognised name, excludes triggers **by return type**, and resolves
**last-write-wins per function** (migrations are forward-only, so superseded text must not be read
as live).

**`end_affiliation` refuses while the principal holds active memberships of ANY tier** under that
hospital — commission seats **and** hospital-tier (`hospital_admin`, `technical_director`,
`technical_director_deputy`, `nsp_coordinator`, `pqs_member`) — returning the blocking seats under
`HC0R1`. A commission-only check would orphan a sitting technical director. **Self-affiliation is
ALLOWED** and the door comment says why (it confers no capability; an admin absent from their own
roster is a bug) so nobody "fixes" it by analogy with the self-grant guard.

### Other surfaces this changed

- **`profiles` SELECT widened** with an affiliation leg and a membership leg (any tier under a
  hospital I administer) — the latter closes ADR 0097 finding 3 (6 membership rows whose
  `principal_id` a hospital admin could not resolve). ⚠ The DENY keystone (a **sibling** hospital's
  admin) pins the **default state, not a hard boundary**: `affiliate_person` lets any in-org
  hospital admin self-serve the affiliation. **The tenant boundary is the ORGANIZATION.**
- **`grant_role_impl`'s `hospital_admin` branch gained `app.is_admin_for(p_actor)`**, symmetric
  with the org_admin branch. Without it single-hospital provisioning had **no working path** (the
  platform admin was denied 42501; the fallback hit the self-grant guard). The
  `technical_director` branch keeps its deliberate no-`is_admin_for` posture, and the self-grant
  guard is untouched.
- **Dominance is now an enforced invariant** (`303`) — every gate admitting `is_hospital_admin_of`
  must admit `is_org_admin_of`. The two live gaps (`set_standard_ownership`,
  `standard_ownerships_select`) are fixed. ⚠ The grid resolves helper **transitivity** and the
  inlined role **literal**, not surface text — a name-only census missed `assign_hospital_admin`
  and `revoke_hospital_admin` entirely and false-positived `list_approver_candidates`.
- **D14 — person-level fields are `org_admin`-only, enforced across SIX actions**:
  `updateUserProfile`, `upsertCredential`, `removeCredential`, `deactivateUser`, `reactivateUser`,
  `suspendUser`. The last three because `app.is_active` is folded into every membership predicate,
  making deactivation a **platform-wide kill switch** — one hospital's offboarding must never end a
  professional's access at another. Offboarding from a hospital is `end_affiliation`. ⚠ **Those
  keystones are Vitest, not pgTAP, by necessity**: these run on the service-role client, so there
  is no RLS backstop and there cannot be one. The gate fires on a **change** (`is distinct from`
  against the current row), not on presence, or a hospital admin could not edit their own matrícula.
- **`authorizeStaffOps` mirrors `is_tenancy_admin_of`'s hospital leg** (+ an `isInactive` check).
  It had been **strictly stricter than all six doors it fronts**, so a hospital admin got a fully
  populated candidate picker and a refusal at submit. A **mirror-drift correction, not a capability
  widening** — every door already admitted them. It failed **closed**, which is why nothing caught it.
- **`professional_profiles.cpf`** — column only, no unique index, no matching, no linking (ADR D15).

### ⚠ Read this before touching the audit trail

`app.audit_write` takes **no actor parameter** and derives `auth.uid()`, so anything written on the
**service path records `actor_id = NULL`** — the actor is known, threaded into the kernel, written
to `created_by`, and then dropped by the audit layer. Platform-wide and pre-existing
(`membership.granted` 40/0, `form.created` 8/0). It **falsifies** the external audit's LOW-1
sentence ("the trigger names the actor") on the provisioning path; corrected in ADR 0097 D6.
`log_cpf_probe_for` threads its actor through **metadata** for exactly this reason.

## MEM-W1..W3 — Membership hardening + the one real mutation door (2026-08-04; ADR 0094 + Amendments 1-2; migrations `20260905000000`-`...000300`; NO flag, structural)

**One role per principal per commission, one session authority, one mutation kernel.**

**Invariants (W1).** `memberships_one_commission_role_uq` — partial UNIQUE
`(principal_id, commission_id) WHERE commission_id IS NOT NULL`. The org/hospital tier
is deliberately OUTSIDE it (a principal may hold `org_admin` + `nsp_org_admin` of one
org). `memberships_grant_uq` keys on ROLE and therefore never forbade the dual-role
state; this does.

**Cross-scope integrity is now RELATIONAL, not procedural.** The two BEFORE-row guards
(`app.guard_membership_hospital_org`, `app.guard_membership_title_commission`) are
RETIRED — triggers and functions dropped — and replaced by composite FKs that REUSE
THE OLD CONSTRAINT NAMES:
- `memberships_hospital_id_fkey (hospital_id, organization_id) -> hospitals (id, organization_id) ON DELETE CASCADE`
- `memberships_title_id_fkey (title_id, commission_id) -> commission_member_titles (id, commission_id) ON DELETE SET NULL (title_id)`

⚠ **Three things a future author must not "clean up":**
1. **Names are reused on purpose.** A SECOND FK to an already-reachable target is
   PostgREST **PGRST201**; `session.ts`, `members.ts` and `meetings.ts` embed
   `hospitals`/`commission_member_titles` off `memberships` UN-HINTED, and `org.ts`
   hints `memberships!memberships_hospital_id_fkey`. `186` §4a and `291` 1.9 pin
   "exactly one FK per target".
2. **`on delete set null (title_id)` — the column list is mandatory.** A bare composite
   SET NULL nulls `commission_id` too, the scope-shape CHECK rejects it, and commission
   titles become UNDELETABLE.
3. **`memberships_scope_shape` is load-bearing for the FKs.** Composite FKs are MATCH
   SIMPLE, so `(hospital_id set, organization_id NULL)` would slip past; only the CHECK
   makes that unreachable. MATCH FULL is not an option (org-tier rows are legitimately
   mixed-NULL). Cross-scope violations now raise **23503**, previously 23514.

Also: index `memberships_granted_by_idx`.

**The replacement semantic (T1.0).** Granting a commission role to a principal holding
the OTHER role REPLACES it, as an **in-place UPDATE** — which reaches
`trg_audit_memberships`' UPDATE arm (one `membership.role_changed`) and preserves the
row id and the member's `title_id`. A delete+insert emits revoked+granted and destroys
both. Replacing a `staff_admin` row additionally requires the staff_admin arm's
authority, so the role-pin is symmetric (a plain staff_admin can neither create nor
destroy a staff_admin).

**Session authority (W2).** `public.session_context()` — DEFINER, search_path pinned,
EXECUTE `authenticated` only, PHI-free. Returns `{profile, grants[]}` in ONE round trip
(replaced a profile read + 4 membership reads in `getSessionContext`). **Generic over
roles** — one entry per grant carrying role + scope refs, so a NEW ROLE SURFACES WITH NO
CHANGE HERE. ⚠ It lives in `public`, not `app`: config.toml exposes only
`["public","graphql_public"]`, so an `app.*` function is unreachable from
`supabase.rpc()`.
Grants are **expiry-filtered** (`expires_at is null or expires_at > now()`) — verbatim
from `app.has_role_any`, which every membership predicate delegates to. ⚠ A prosrc grep
for `expires_at` reports FALSE for `is_member_of` because the filter is one call down;
the DB always filtered expiry, the **TypeScript never did**. `is_active` is deliberately
NOT filtered (the profile envelope carries status; `requireUser()` routes inactive
accounts).
`trg_audit_memberships` gains a `membership.expiry_changed` arm (before/after
timestamps, PHI-free). **Invariant: nothing in `app`/`public` WRITES
`memberships.expires_at`** — `292` §2 enforces it comment-stripped, with a planted
writer proving the probe has eyes. *(Superseded twice since: QO·A D9 made
`app.grant_role_impl` the sanctioned single writer, and QO·FUP F1 widened what it
writes — see the QO·A "Role doors" paragraph, which is current.)*

**The mutation door (W3) — ADR 0075's split is RETIRED.** Before this, `grant_role` had
**zero TypeScript callers**: every commission grant was raw service-role DML, so the
door's role-pin/self-grant/anti-lockout arms governed nothing reachable.

| Surface | Schema | EXECUTE | Purpose |
| --- | --- | --- | --- |
| `grant_role_impl(p_actor,…)` / `revoke_role_impl(p_actor,…)` | `app` | **owner only** | the kernel — every authority arm, written once |
| `grant_role` / `revoke_role` | `public` | `authenticated` | `auth.uid()` wrappers, no logic of their own |
| `grant_role_for(p_actor,…)` / `revoke_role_for(p_actor,…)` | `public` | **`service_role` ONLY** | service paths that authorized an actor in TS |

⛔ **`authenticated` must NEVER hold EXECUTE on `*_for`** — that lets any signed-in user
name an arbitrary actor and inherit its authority (total bypass). `293` §1 asserts it;
the mutation audit proves the assertion can fail.
⚠ **The kernel INLINES the self-grant check** (`p_user = p_actor`). Delegating to
`app._deny_self_grant` looks right and is right on the session path, but that helper
compares against `auth.uid()`, which is NULL on the service path — a silent no-op
exactly where the guard is newly needed (mutation-proven).
Two deliberate NARROWINGS now bind service callers: **self-grant denial** and the
**org anti-lockout (HC0G1)**.

**App callers (no raw `memberships` DML remains).** `addStaff` + `assignStaffAdmin` →
`grant_role` over the cookie client; `registerUser`, `assignCommitteeRole`,
`removeCommittee`, platform first-org_admin provisioning → `*_for` over the admin
client. ⚠ `addStaff` keeps a **pre-read**: the door REPLACES, and "add this person"
must never demote a coordinator — that is a product rule, not an authorization one.
**Enforced by `npm run lint:memberships-door`** (`scripts/check-memberships-door.mjs`)
— matches the DML verb applied directly to `.from('memberships')`; `.select` is allowed.

**pgTAP.** `291` (35, invariants + replacement), `292` (25, session context + expiry +
the **role-completeness grid**), `293` (24, ACL + the two-entry-point equivalence grid).
**The completeness grid is the ADR-0094 decision-6 checklist made executable**: it reads
the role vocabulary LIVE from `memberships_role_check` and reds until a new role has a
declared scope, a grant arm and a revoke arm.
**Mutation audits:** `w1-membership-mutation-audit.sh` 9/9 · `w2-session-context-mutation-audit.sh` 9/9 ·
`w3-door-kernel-mutation-audit.sh` 8/8, all RED-PROVEN with green controls.

## MEM-W4 — Diretor Técnico: roles, appointment AND the referral plane (2026-08-04; ADR 0094 Amendments 3–4; migrations `20260905000400` · `20260905000500` · `20260905000600`; flag `technical_director` **ON**)

**Roles.** `technical_director` (titular) + `technical_director_deputy`, HOSPITAL tier
(`organization_id` + `hospital_id` set, `commission_id` NULL). Deliberately NOT
commission-scoped: a commission-scoped DT would inherit committee-content reach, which
decision 9 exists to prevent. `memberships_one_technical_director_uq` — partial UNIQUE
`(hospital_id) WHERE role = 'technical_director'` — is the legal "one titular per
hospital" invariant; deputies are unbounded.

**Appointment authority: `org_admin` of the hospital's org OR `hospital_admin` of that
hospital.** ⛔ **NO `is_admin_for` branch — a platform_admin may NOT appoint a Diretor
Técnico** (PO ruling: appointment is a tenant governance act with legal weight, not
tenancy administration). This is the ONLY grant arm in the kernel without one; the
asymmetry is intentional and `294` 3.3 asserts it, mutation-proven, so a future
"consistency" edit cannot quietly restore it.

**Grant arm order — the guards MASK each other:** flag → hospital exists → authority →
physician → titular-uniqueness → self-grant. A deny-code assertion must name the guard
it means or it measures whichever fires first.
- physician: `professional_categories.key = 'physician'` **AND `pc.is_active`**, joined
  from `profiles.professional_category_id`. Resolved on the KEY, never the pt-BR label.
  ⚠ A principal with NO category fails the join and raises `HC0G3` regardless of
  `is_active` — so an `is_active` keystone must give the fixture a real physician
  category first, then retire it (this exact keystone was vacuous until mutation caught it).
- `HC0G3` = not a physician · `HC0G4` = hospital already has a titular.

**Revoke carries NO flag check and NO physician check** — turning the feature off, or
correcting a professional category, must never strand an existing appointment beyond
the administrators who granted it.

**`public.appoint_technical_director(p_hospital, p_user)`** (DEFINER, `authenticated`)
— atomic audited replacement: revoke incumbent + grant appointee in one transaction,
emitting `membership.revoked` then `membership.granted`. It re-checks NOTHING; every
precondition is the kernel's.

**Extensibility, proven not asserted:** the two roles surface in
`public.session_context()` with **zero change to that function** (`294` §5), and
`292` §3's completeness grid RED-ed on `memberships_role_check` until they had a
declared scope and both arms.

**pgTAP** `294` (29) · **mutation** `w4-technical-director-mutation-audit.sh` 8/8 RED-PROVEN.

### The referral plane (T4.5–T4.13; migration `20260905000500`)

**A referral's TARGET is now a sum type.** Either a commission (everything that existed
before) or the technical direction of a hospital. Nothing else forked — same status
machine, same dialogue, same snapshot, same audit trail; what changes is who the target
audience resolves to.

`case_referral` gains `target_type` (`'commission'|'technical_director'`, NOT NULL
default `'commission'`), `target_hospital_id`, `target_hospital_name` (D5 snapshot),
`waiting_on_hospital_id` (D9); `target_commission_id` becomes **nullable**;
`referral_messages.sender_commission_id` becomes **nullable** (D3 — NULL means "the DT
of the target hospital"). `case_referral_target_shape` pins `target_type` in agreement
with which id is non-null, terminating in `else false`. Keyset index
`case_referral_target_hospital_created_keyset_idx` mirrors the committee inbox's.
⚠ All four new columns carry their own `grant select (…) to authenticated` —
`case_referral`'s SELECT is COLUMN-level, and the omission fails at RUNTIME only.

**`app.is_technical_director_of_for(hospital, uid)`** is the audience predicate:
titular **≡** deputy (D1), resolved LIVE against `memberships` via `app.has_role` (D4,
so an office handover moves access in both directions instantly), and the
`technical_director` flag is **folded in** rather than repeated at its six call sites.

**Three arms carry the whole surface**, each guarded first by
`target_type = 'technical_director'` so the commission hot path never pays for them:
`app.can_manage_referral_target` (the entire target lifecycle — ten functions reach it,
seven via `app.assert_referral_target_acts`), `app.can_read_referral_metadata` (the
inbox; referrals have **no** notification fan-out), `app.can_read_referral_phi` (T4.8;
every read stays on the existing audited path — no change to `patient_identifiers` or
`can_read_case_patient`). **All 14 referral policies delegate to these three**, so no
policy was edited. Plus `app.guard_referral_message` (D3 coherence),
`public.snap_referral_commission_names` (D5), and the three RPCs carrying a RAW inline
`is_staff_admin_of(target_commission_id)` that do NOT inherit arm 1 —
`get_referral_detail`, `post_referral_message`, `request_referral_information`.

**`create_referral_draft` gained `p_target_hospital_id`** (DROP+CREATE — an extra arg
would otherwise create a second OVERLOAD and PostgREST answers ambiguity with
PGRST203). Exactly one target is required, and a DT target must be the source
commission's **own hospital** (`commissions.hospital_id` is NOT NULL, so the rule is
total). ⚠ **No product caller yet** — W4 ships no UI (FUP-MEM-3).

**Dispositions, all explicit:** `can_dispose_referral_phi` unchanged (D6 — the DT reads
the PHI it was sent and may not destroy it; the source arm covers the same hospital);
both internal-note predicates unchanged (D8); `link_referral_case` and
`link_referral_related_case` REFUSE a DT row; `assign_referral_reviewer` already fails
closed (HC0A7) and is asserted rather than assumed.

⚠ **FIVE fail-open sites, none in the plan's task list.** Nullable
`target_commission_id` silently changed every expression comparing to it — in SQL a NULL
comparison inside `if`/`check` is *no opinion*, i.e. PASS. (1)
`case_referral_waiting_on_check` would have admitted an arbitrary committee as the
waiting party; (2) `guard_referral_message`'s `sender not in (v_src, v_tgt)` would have
admitted a NULL sender on **every** referral; (3) `link_referral_case` would have
attached **any case in the database**; (4) `link_referral_related_case` would have
raised a raw 23502 out of a check the caller passed. The (5)th was found BY the new
CHECK: "exactly one waiting party" makes every writer of `waiting_on_committee_id` a
writer of BOTH, so `conclude_referral` and `resolve_referral` — needing no DT audience
arm, hence in no DT-shaped enumeration — now clear the other column.
⚠ **Sweep by the PREDICATE's callers, not the column's name.** Seven more functions
inherit arm 1 without ever naming `target_commission_id`:
`app.can_write_referral_response`, `cancel_referral_assignment`,
`redact_referral_message`, `redact_referral_note`, `set_referral_deadline`,
`unlink_referral_case`, `update_referral_assignment`.

**TS surface.** `ReferralTargetType` + `targetType` / `targetHospitalId` /
`waitingOnHospitalId` on the domain types; `targetCommissionId` is now `string | null`.
The `Direção Técnica — <hospital>` label is composed in **one** place —
`referralTargetName()` in `src/lib/queries/referrals.ts` (Rule 9). Four appointment
server actions live in `src/lib/org/actions.ts`; their `authorizeTechnicalDirection`
deliberately has **no `isAdmin` arm**, unlike the sibling `authorizeOrgAdmin`.

**Seed:** `dt.a@test.local` (physician titular of Hospital Central A) +
`dt.dep.a@test.local` (deputy) — neither holds any commission membership, so the
hospital-tier arm is the only way they reach anything.

**pgTAP** `295` (60) · **mutation** `w4-technical-director-referrals-audit.sh` 13/13
RED-PROVEN, control 60 green.
