# AE1.3 — the nine person-authority door conversions: DESIGN

- **Status:** DESIGN, for lead plan-review. **Nothing here is built.** No migration, no function, no
  test, no application change exists for this document.
- **Authority chain:** ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
  **G11** → [`docs/plans/authz-evolution.md`](./authz-evolution.md) § AE1.3 → this file (execution
  detail only). Where this file conflicts with the plan or the ADR, **they win and this file is
  corrected**.
- **Semantic authority:** ADR [0133](../decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)
  (D1–D4, D9, D10, Amendments 1 and 3) as *expressed in code* by
  `src/lib/users/person-scope.ts` + `src/lib/users/person-footprint.ts`. Those two modules are
  what the SQL half mirrors, branch by branch (§3).
- **Everything asserted about the schema below was read from the LIVE CATALOG** on
  `supabase_db_azkbbhskturikxpgmafq` at head `20261003004300`, 2026-08-27. No migration file text
  was trusted (ADR 0078 methodology finding).

---

## 0. Findings first — the six things that do not survive contact with the code

These are the review items. The rest of the document is mechanics.

- **F-A** — the invite door cannot mirror `personScopeAllows`; a naive mirror is a total outage of
  hospital_admin registration. **Needs a ruling (Option A / Option B).**
- **F-B** — "authority before existence" is not literally achievable here; the achievable rule is
  different and is already this repo's stated one.
- **F-C** — `person-scope.ts` carries an explicit "no SQL twin" prohibition that AE1.3 retires;
  it must be retired **in writing** (ADR 0161, `Amends: 0133`).
- **F-D** — "nine doors" is nine **conversions** across **six** doors.
- **F-E** — `guard_profile_privileged_columns` does not block the doors, *because* they are
  service-role-only; the obvious "fix" if they were not is a self-elevation vulnerability.
- **F-F** (§10) — ⛔ **the shape the plan's own AE1.3 table prescribes is in NO ARM's domain.**
  Plan rule 4 ("each door enters every ARM domain") cannot be satisfied as written. The design's
  answer restructures the surface so the *authority decision* lands in a swept object.

### F-A — `finalize_invited_person_for` **cannot** mirror `personScopeAllows`. Doing so breaks every hospital_admin registration.

At the moment the invite-flow `profiles` patch runs (`registerUser`, `src/lib/users/actions.ts`
line ~651), the person has **no affiliations and no memberships** — both are written *after* it
(`affiliate_person_to_org_for` ~699, `affiliate_person_for` via `ensureActiveAffiliation` ~322).
So the target's footprint is **empty**, and `personScopeAllows` denies an empty footprint
explicitly and deliberately for **every** capability:

```ts
// person-scope.ts:119-128
// D2 — an empty footprint is org_admin-only: an unaffiliated, uncommitteed person
// belongs to no hospital, so no hospital admin has a claim on them.
const footprintHospitals = new Set(footprint.hospitalIds)
if (footprintHospitals.size === 0) return false
```

An `org_admin` registrar survives (the org arm runs *before* the footprint rule and is not
footprint-bounded), but a **`hospital_admin` registrar is denied** — and hospital_admin
registration is a supported, deliberate product path (actions.ts ~692: *"which is precisely what
makes a hospital admin's onboarding one step rather than a wait on an org_admin ticket"*).
**A naive mirror here is a total outage of that path**, and it would present as a 42501 the TS
guard already let through, i.e. as TS↔SQL drift.

Two ways out — **the lead must rule; Option A is recommended.**

- **Option A (recommended) — reorder `registerUser` so affiliation precedes the profile patch,
  then the finalize door uses the ORDINARY predicate.** Move the `affiliate_person_to_org_for` /
  `affiliate_person_for` calls above the profile patch. The footprint then contains exactly the
  hospital the registrar administers, so `app.can_administer_person_for('cpf_change', …)` (SUBSET,
  the tightest arm the patch needs, because the patch writes `cpf`) passes for the
  hospital_admin registrar and for the org_admin registrar alike. **No special inviter predicate
  is needed at all**, and `finalize_invited_person_for` becomes a strict, auditable special case
  of `update_person_fields_for` rather than a second authority rule. Failure-ordering
  consequences: §7.
- **Option B — keep the current order and author a distinct inviter-authority predicate**
  (`org_admin` of the target's home org, OR `hospital_admin` of a supplied `p_hospital` whose
  `app.org_of_hospital` equals that org), plus an "un-finalized target" precondition so the door
  cannot be repurposed against an established person. ⛔ **Option B WIDENS `hospital_admin`
  authority** over the legitimate hospital-less `novato.pendente` class: today a hospital_admin
  cannot rewrite the CPF of a footprint-less person in their org (empty footprint → deny); under
  Option B they could, because that person also satisfies "un-finalized". Widening cannot be
  accepted silently (ADR 0154). If the lead picks B, the widening needs a PO ruling and its own
  ADR line.

### F-B — the plan's "authority checked **before** existence" is not literally achievable for these doors, and the correct rule is different.

The authority predicate is *defined relative to the target*: `authorizePersonScopedAdmin` must
read `profiles.home_organization_id` of the target before it can pick an arm, and the footprint
read is an existence read by construction. So "authority before existence" cannot mean "never
touch the target row first".

**The rule that IS achievable, and is already this repo's stated rule, is: non-existence of the
target PERSON is folded into the authority denial.** A missing person and an unauthorized caller
return the *identical* `42501`. That is exactly what the TS does today
(`authorizePersonScopedAdmin`: `if (!orgId) return { ok: false }` → the same
`MESSAGES.orgAdminOnly`), and `sendPasswordResetForUser`'s docstring states the principle:
*"⛔ NOT AN ENUMERATION ORACLE. Both 'no such person' and 'not permitted' return the SAME pt-BR
refusal."*

Only **post-authority** existence gets its own code — e.g. "this credential id is not this
person's" — following `app.end_affiliation_impl`'s live precedent:

```
-- app.end_affiliation_impl (live prosrc)
-- Not an existence oracle: the caller has already proven authority OVER THIS
-- HOSPITAL, so "nobody by that id works here" is information they already hold.
raise exception 'vínculo ativo não encontrado' using errcode = 'HC0R2';
```

Design rule adopted here, per door, in §4.

### F-C — `src/lib/users/person-scope.ts` carries an explicit prohibition that AE1.3 retires. It must be retired **in writing**, in the same increment.

```ts
// person-scope.ts:12-16
// ⛔ A SQL TWIN IS DELIBERATELY NOT BUILT (ADR 0133 D4, and its Alternatives table). No RLS
// policy consumes this rule — every affected path is service-role — and a dead DB
// predicate is a standing census/sweep liability forever. Do not "mirror it for
// consistency" …
```

ADR 0155 G11 reverses this. Its stated premise ("no consumer exists") becomes **false** the
moment the doors land — the doors are the consumer. Leaving that comment in place is the
"only the amending document knows about the amendment" failure, in the file most likely to be
read by the next author of this rule.

**Required companion work in the AE1.3 increment** (lead to approve as part of the plan):
1. a short ADR — **next free number is 0161** per `docs/decisions/INDEX.md` — headed
   `**Amends:** 0133`, recording that D4's "no SQL twin" is retired by 0155 G11 and that the SQL
   half is now the authority on the service path while TS stays as defense-in-depth; then
   `npm run adr:index`;
2. the `person-scope.ts` header comment rewritten to point at
   `app.can_administer_person_for` and to state the *new* obligation (Architecture Rule 3 now
   genuinely attaches: the two halves exist and must not drift).

### F-D — "nine doors" is "nine **conversions**", across **six** new `public` doors.

The plan's own heading is right ("The nine person-authority door **conversions**"); the task
brief's "nine doors" is loose. AE0.4's census — five `profiles` writes + four
`professional_credentials` writes in `src/lib/users/actions.ts` — is the nine. They map to six
public doors plus two `app`-schema internals (§2). The fields/CPF pair is **one write site with
two capability arms**, which is why 9 sites ≠ 9 functions.

### F-E — `guard_profile_privileged_columns` does **not** block the doors, *because* the doors are service-role-only. That is load-bearing and must be pinned, not assumed.

Full analysis in §6. Short form: the guard's trusted-caller arm is `if auth.uid() is null then
return new`, `auth.uid()` reads only the `request.jwt.*` GUCs (verified against the live
`auth.uid` body), a service-role JWT carries no `sub`, and `SECURITY DEFINER` does not change
GUCs. So a service-role-invoked door passes. **If any of these doors were ever granted to
`authenticated`, all four `profiles` doors would break** — and "fixing" that by weakening the
guard is a privilege-escalation vulnerability (§6.3). This is the strongest argument for the
`_for`-only shape in §1, and it gets an explicit anti-fix keystone.

---

## 1. The invocation model — `_for` doors, service-role only

**Decision: all six doors are `public.<name>_for(p_actor uuid, …)`, `SECURITY DEFINER`,
`SET search_path = public, app, pg_temp`, `EXECUTE` granted to `service_role` and `postgres`
ONLY. No bare `X()` `authenticated` twin is created for any of them.**

This is the live repo convention, read from the catalog, not from a doc:

```
public.affiliate_person_for   :: postgres=X/postgres , service_role=X/postgres
public.end_affiliation_for    :: postgres=X/postgres , service_role=X/postgres
public.grant_role_for         :: postgres=X/postgres , service_role=X/postgres
public.revoke_role_for        :: postgres=X/postgres , service_role=X/postgres
public.log_cpf_probe_for      :: postgres=X/postgres , service_role=X/postgres
public.end_affiliation        :: postgres=X/postgres , service_role=X/postgres , authenticated=X/postgres
```

i.e. `_for` = explicit actor, service-role path; the bare name = `auth.uid()`, authenticated path.

Why **no** authenticated twin here, stated so a future author does not "complete the pair":

1. It would be blocked by `guard_profile_privileged_columns` for every `profiles` door (§6).
2. The columns the doors write (`cpf`, `date_of_birth`, `phone`) are **excluded from every
   `authenticated` column grant** — measured live: `authenticated` has UPDATE on
   `created_at, email, email_confirmed_at, full_name, home_organization_id, id, is_active,
   is_admin, must_change_password, professional_category_id, suspended_until` and **not** on
   `cpf / date_of_birth / phone`. A DEFINER function owned by `postgres` would bypass that, which
   is precisely the thing the grant exists to prevent from being casual.
3. The callers are Next.js **server actions** that already hold a verified session
   (`getSessionContext()`), and the service-role key never reaches the client (CLAUDE.md §8).
   `p_actor` is therefore supplied by the server from a verified session, not by the browser.

**Threat model this closes** (state it, so the door is not oversold): it closes *TS authority
being the only authority on a service-role path with no RLS backstop* — a forgotten gate on a
new call path, a wrong `capability` argument, a future direct `.from()` write, or a drift between
`personScopeAllows` and its call sites. It does **not** claim to defend against possession of the
service-role key; nothing in this schema does.

**ACL assertion is POSITIVE, never inferred.** `proacl` NULL means PUBLIC EXECUTE
(the recorded "guards that read right but fail open" class). pgTAP 386 asserts:

- per `public.<name>_for`: `proacl IS NOT NULL`,
  `has_function_privilege('authenticated', …, 'EXECUTE') = false`,
  `has_function_privilege('anon', …, 'EXECUTE') = false`,
  `has_function_privilege('service_role', …, 'EXECUTE') = true`;
- per `app.<name>_impl` and per `app.can_administer_person_for`: `proacl IS NOT NULL` and EXECUTE
  **false for all three** of `anon`, `authenticated`, `service_role`. ⚠ The `service_role = false`
  clause is not tidiness — it is the ADR 0156 gate's own kernel-domain condition, so a stray grant
  would evict the kernel from the door-SQLSTATE gate. 304 §6.1's reverse pin catches that too, and
  having both is deliberate: one is a positive ACL fact, the other a domain-membership fact.

---

## 2. The surface — nine converted sites → six doors (12 functions) + one predicate

| # | Converted site (`src/lib/users/actions.ts`) | Table + verb | Door | Capability arm |
| --- | --- | --- | --- | --- |
| 1 | `registerUser` ~651 — invite-flow profile patch | `profiles` UPDATE | `finalize_invited_person_for` | see F-A |
| 2 | `updateUserProfile` ~940 — person fields | `profiles` UPDATE | `update_person_fields_for` | `fields` (**INTERSECTION**) |
| 3 | `updateUserProfile` ~940 — the CPF component of the same write | `profiles` UPDATE | `update_person_fields_for`, cpf arm | `cpf_change` (**SUBSET**) |
| 4 | `deactivateUser` ~1175 | `profiles` UPDATE `is_active=false` | `set_person_active_for` | `lifecycle` (**SUBSET**) |
| 5 | `reactivateUser` ~1193 | `profiles` UPDATE `is_active=true, suspended_until=null` | `set_person_active_for` | `lifecycle` (**SUBSET**) |
| 6 | `suspendUser` ~1218 | `profiles` UPDATE `suspended_until` | `suspend_person_for` | `lifecycle` (**SUBSET**) |
| 7 | `registerUser` ~740 — bulk credential insert | `professional_credentials` INSERT | `upsert_credential_for` | `credentials` (**INTERSECTION**) |
| 8 | `upsertCredential` ~1022 — insert branch | `professional_credentials` INSERT | `upsert_credential_for` | `credentials` (**INTERSECTION**) |
| 9 | `upsertCredential` ~997 — update branch | `professional_credentials` UPDATE | `upsert_credential_for` | `credentials` (**INTERSECTION**) |
| 9b | `removeCredential` ~1058 | `professional_credentials` DELETE | `delete_credential_for` | `credentials` (**INTERSECTION**) |

(The census counts 9 *writes*; rows 9 and 9b are the fourth and… see F-D — the four credential
writes are rows 7, 8, 9, 9b, and rows 2+3 are one write. Nine writes, six doors.)

**Each of the six doors is TWO objects, per §10.1(b)** — the repo's live two-layer shape:

- `public.<name>_for(p_actor uuid, …)` — thin wrapper, `SECURITY DEFINER`, EXECUTE for
  `service_role` + `postgres` only. Does argument marshalling and nothing else.
- `app.<name>_impl(p_actor uuid, …)` — the kernel: `SECURITY DEFINER`, **`VOLATILE`**, EXECUTE
  granted to **nobody** (owner-only, matching `app.end_affiliation_impl :: postgres=X/postgres`).
  All authority, precondition, write and audit logic lives here.

⚠ The split is not decoration: it is what puts both halves inside the ADR 0156 door-SQLSTATE
gate's domain, and the `_impl` suffix is what makes 304 §6.1's reverse pin red if a kernel ever
leaves that domain (§10.1b).

Plus **one** `app`-schema predicate, `SECURITY DEFINER`, `STABLE`, EXECUTE granted to nobody:

- `app.can_administer_person_for(p_capability text, p_user uuid, p_actor uuid)` → `boolean` — the
  SQL twin of `personScopeAllows` **plus** the `authorizePersonScopedAdmin` preamble (home-org
  resolution, org arm, caller-active check, caller's administered hospitals).
  ⚠ **Named `can_*` deliberately** — the `^can_` prefix is what puts it permanently inside the
  `policy` arm's `PRED_DOMAIN`, a structural property a refactor cannot erase (§10.1a). It is also
  *wider* than `personScopeAllows`, which is the second reason not to name it `person_scope_allows`
  (§3.0).
  ⛔ **No separate `app.person_footprint_for` is minted** — it would be in no arm's domain; the
  footprint is a CTE inside this function (§10.1c).

---

## 3. The SQL predicate, mirrored branch by branch

### 3.0 What each SQL function mirrors — the mapping is deliberate, not 1:1

| SQL — all inside `app.can_administer_person_for` | Mirrors | Note |
| --- | --- | --- |
| the `footprint` CTE | `resolvePersonFootprint`'s `hospitalIds` accumulation (`person-footprint.ts` 77–172) | ACTIVE-only, both legs |
| § *preamble* | `authorizePersonScopedAdmin` (`actions.ts` 360–392) | home-org resolution, org arm, caller-active, caller's hospitals **in the target's home org** |
| § *decision* | `personScopeAllows` (`person-scope.ts` 107–143) | the four branches below, in the same order |

⛔ The preamble is **not** part of `personScopeAllows` and must not be pushed into it on either
side. `personScopeAllows`'s own docstring: *"THIS ANSWERS THE FOOTPRINT QUESTION ONLY. … The
org_admin arm is handled before this is ever called — an org_admin is not footprint-bounded at
all. Calling this without those preconditions produces a confidently wrong answer."*

### 3.1 The preamble (mirrors `authorizePersonScopedAdmin`)

```
v_org := (select home_organization_id from public.profiles where id = p_user);
if p_actor is null or v_org is null then return false; end if;        -- F-B: folds into 42501
if not app.is_active(p_actor) then return false; end if;              -- TS: context.isInactive
if app.is_org_admin_of_for(v_org, p_actor) then return true; end if;  -- org arm, NOT bounded
-- (a) hospital_admin authority must be held IN THE TARGET'S HOME ORG
v_administered := array(select h.id from public.hospitals h
                         where h.organization_id = v_org
                           and app.is_hospital_admin_of_for(h.id, p_actor));
if cardinality(v_administered) = 0 then return false; end if;
```

⛔ **`platform_admin` is deliberately NOT an arm.** `authorizeOrgOps` excludes it (ADR 0041 noun
rule: person records are not platform_admin's). A pgTAP arm asserts a `platform_admin` is refused
by every door, so an "obviously missing superuser arm" cannot be added back without reding.

### 3.2 D2 tier flag — checked FIRST

```ts
// person-scope.ts:113-114
// D2 — any org-tier or hospital-tier seat pushes the person to org_admin-only, for
// every capability. Checked FIRST so no bound below can accidentally admit them.
if (footprint.hasNonCommissionTierMembership) return false
```

SQL:
```
if exists (select 1 from public.memberships m
            where m.principal_id = p_user and m.commission_id is null)
then return false; end if;
```

⚠ **Structural (`commission_id is null`), never a role-name list** — the vocabulary has widened
four times (`person-footprint.ts` 58–63). ⚠ **Expiry is deliberately NOT applied on this leg**
(QA R1 asymmetry, `person-footprint.ts` 141–150): expiry is applied to what a membership
*grants*, never to what it *withholds*, because reading an expired org-tier seat as untiered
would widen.

### 3.3 Footprint — ACTIVE only, both legs required

```
-- v_footprint uuid[] := array( ... ) -- materialised ONCE, inside app.can_administer_person_for
select ha.hospital_id from public.hospital_affiliations ha
 where ha.principal_id = p_user and ha.ended_on is null and ha.voided_at is null
   and ha.hospital_id is not null
union
select c.hospital_id from public.memberships m
  join public.commissions c on c.id = m.commission_id
 where m.principal_id = p_user
   and m.commission_id is not null
   and (m.expires_at is null or m.expires_at > now())
   and c.hospital_id is not null;
```

⛔ **ACTIVE-ONLY IS THE POINT AND MUST NOT BE "ALIGNED" WITH THE READ RULE.**
```ts
// person-scope.ts:64-70
// ⛔ THIS IS THE **WRITE** RULE, AND SINCE ADR 0148 IT NO LONGER MATCHES THE READ RULE.
// The `profiles` / `professional_credentials` SELECT policies test affiliation as
// EVER-HELD (the `ended_on` conjunct was removed in migration 20261003002900) …
// A departed person resolves to an empty footprint here … Do not "align" the two.
```
Live confirmation: the `profiles_admin_select` / `professional_credentials_select` policies test
`ha.voided_at is null` with **no** `ended_on` conjunct. The write predicate keeps both. pgTAP 384
carries a departed-person arm whose whole job is to red if someone drops `ended_on is null`.

⚠ Both legs required (`person-scope.ts` 72–77): the org-wide member picker seats people on
commissions of hospitals they hold no affiliation with, so an affiliations-only footprint would
make a multi-hospital person look sole-footprint.

⚠ `voided_at is null` on the affiliations leg (`person-footprint.ts` 82–86, AFF4 D7).

### 3.4 Empty footprint — pinned explicitly, never derived

```ts
// person-scope.ts:119-128 — quoted in full in F-A
// ⚠ PINNED EXPLICITLY, NOT DERIVED. For the subset capabilities ∅ ⊆ anything is TRUE,
// so without this line a zero-footprint person would be MORE manageable than a
// sole-hospital one — the classic vacuous-subset inversion.
```

SQL: `if cardinality(v_footprint) = 0 then return false; end if;`
— **written as its own statement, not left to the set maths**, exactly as the TS does, and pgTAP
384's zero-footprint × `lifecycle` arm is the one that reds if it is removed.

### 3.5 The two bounds

```ts
// person-scope.ts:45-49
/** Capabilities bounded by INTERSECTION (Amdt 1 ruling 1). The rest are SUBSET. */
const INTERSECTION_CAPABILITIES = new Set(['fields', 'credentials'])
```

```
if p_capability in ('fields','credentials') then
  -- INTERSECTION (person-scope.ts:130-136): authority at ANY hospital the person serves.
  return v_footprint && v_administered;   -- array overlap
elsif p_capability in ('cpf_change','lifecycle') then
  -- SUBSET (person-scope.ts:138-142): the caller must administer the ENTIRE footprint.
  return not exists (select 1 from unnest(v_footprint) f
                      where not (f = any(v_administered)));
else
  raise exception 'capacidade de escopo de pessoa desconhecida: %', p_capability
    using errcode = 'HC0T7';
end if;
```

⚠ **NULL hazard, stated:** `f <> all(v_administered)` would evaluate to NULL if either side
carried a NULL, and `not exists` over a NULL-filtered row is a silent widen. Both sides are
NULL-free by construction (§3.3 filters `hospital_id is not null`; `v_administered` comes from
`hospitals.id`), and the form written above (`not (f = any(...))`) is the one that survives if
that ever stops being true. pgTAP 384 carries a NULL-hospital fixture arm.

⛔ **The `else` arm RAISES; it must never fall through.** Falling through to SUBSET would be
silently *tighter* (a passing test proves nothing); falling through to INTERSECTION would be a
widen. A typo'd capability is a mirror-drift event and must be loud. `HC0T7` is therefore
**deliberately UNMAPPED in the app layer** — the six doors pass literal capability strings, so it
is unreachable from the app, and a `case` for an unreachable code invites a test that cannot fail
(the recorded `HC0P0` lesson in `docs/backend-state.md`). It is keystoned by a direct SQL call
only.

### 3.6 Which branch each capability mirrors — the summary the review asked for

| Capability | Sites | `personScopeAllows` branch mirrored | Bound |
| --- | --- | --- | --- |
| `fields` | 2 | `INTERSECTION_CAPABILITIES.has(capability)` → the `for … if (administered.has(hospitalId)) return true` loop (lines 130–136) | **INTERSECTION** |
| `credentials` | 7, 8, 9, 9b | same branch, lines 130–136 | **INTERSECTION** |
| `cpf_change` | 3 | the fall-through `for … if (!administered.has(hospitalId)) return false` loop (lines 138–142) | **SUBSET** |
| `lifecycle` | 4, 5, 6 | same branch, lines 138–142 | **SUBSET** |
| — (all four) | all | line 114 `hasNonCommissionTierMembership` → false, and line 128 empty-footprint → false | **denies regardless of bound** |

### 3.7 Shared vectors (RECOMMENDED, lead's call whether it lands in AE1.3)

The plan requires pgTAP to assert the SQL half "per capability × footprint case". It does not
require a shared vector file. **Recommendation: add one**, because the failure mode this design is
most exposed to is TS↔SQL drift after AE1.3 closes, and two independently-authored case lists
drift silently. Proposal: `supabase/tests/vectors/person-scope-vectors.json` (capability ×
footprint × administered → expected), consumed by `person-scope.test.ts` directly and by pgTAP 384
through a generated `person_scope_vectors.psql` byte-compared by a `npm run` script — the
`adr:index` pattern, and matching the existing `supabase/tests/vectors/print_source_registers_vectors.psql`
convention. Cost: one generator + one gate. **If deferred, say so in the AE1 gate record**, so it
is not later mistaken for having been done.

---

## 4. The six doors

**Read every signature below as the pair** (§2 / §10.1b): the signature shown is
`public.<name>_for`, granted to `service_role`; it does nothing but forward to
`app.<name>_impl` with the identical argument list. **All logic quoted below lives in the
`_impl` kernel**, which is owner-only and `VOLATILE`.

Common shape, in this order, in every kernel:

```
1. if p_actor is null then raise 42501 'ator não identificado'         -- family convention
2. if not app.can_administer_person_for(<capability>, p_user, p_actor)
     then raise 42501 'sem permissão'                                   -- F-B: also the not-found answer
3. <post-authority existence / precondition checks, each with its own HC0* code>
4. <the write>
5. perform app.audit_write(...)                                         -- exactly once, §5
```

Denial is **`42501`** in every door — the live family convention (`app.end_affiliation_impl`,
`app.update_affiliation_impl`, `public.log_cpf_probe_for` all raise `42501` for `sem permissão`),
and PostgREST maps class `42` to **HTTP 403**. ⛔ No P-class code is raised anywhere in this
design: `FUP-P-CLASS-SQLSTATE-ANSWERS-500-ON-DENIAL` records that PostgREST maps class `P0*` to
HTTP 500 (`P0001` excepted), so a P-class denial answers 500.

### 4.1 SQLSTATE allocation — derived from the catalog

Live high-water is **`HC0T5`**. Derivation (both halves are needed — the second is why a
catalog-only scan under-reports):

```
-- catalog: highest authored code persisted in a function body  → HC0T4
select distinct m[1] from (select regexp_matches(p.prosrc,'(HC[0-9A-Z]{3})','g') m
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace) s
 where m[1] ~ '^HC0[S-Z]' order by 1;
-- repo: codes raised inside migration-time `do $$` assertion blocks (never persisted) → HC0T5
grep -roh "HC0[0-9A-Z][0-9A-Z]" --include=*.sql --include=*.ts . | sort -u | tail
```

⚠ `HC0O*` remains deliberately skipped (`O` vs `0`). ⚠ `docs/backend-state.md` line 5231 still
says *"`HC0QF`+ are unallocated"* and is **stale for the fourth time**; this design does not fix
that line (out of scope — `backend-state.md` is not mine to edit in this task) but the lead should
have the Record step correct it to `HC0T9+`.

**Allocated by this design: `HC0T6`, `HC0T7`, `HC0T8`.** Next free after AE1.3: **`HC0T9`**.

| Code | Meaning | Raised by | Reachable from the app? |
| --- | --- | --- | --- |
| `HC0T6` | `registro profissional não encontrado para esta pessoa` — a credential id that does not exist, or does not belong to `p_user`. **Post-authority**, so not an oracle (the `HC0R2` precedent). | `upsert_credential_for` (update branch), `delete_credential_for` | yes → `MESSAGES.generic` |
| `HC0T7` | `capacidade de escopo de pessoa desconhecida` — mirror-drift tripwire. | `app.can_administer_person_for` | **no** — deliberately unmapped (§3.5) |
| `HC0T8` | `perfil já finalizado` — the invite door's un-finalized precondition. **Only allocated under Option B** (F-A); under the recommended Option A the door needs no such precondition and `HC0T8` is not minted. | `finalize_invited_person_for` | Option B only |

Pre-existing codes reused, not re-minted: `42501` (every denial), `23505` (CPF collision →
`MESSAGES.cpfCollision`; credential 4-tuple collision → `MESSAGES.credentialCollision`) — both
already mapped in `actions.ts` and both must keep surfacing unchanged, which is an E2E assertion.

### 4.2 `public.finalize_invited_person_for`

```sql
public.finalize_invited_person_for(
  p_actor uuid,
  p_user uuid,
  p_full_name text,
  p_professional_category_id uuid,
  p_cpf text,
  p_date_of_birth date default null,
  p_phone text default null,
  p_must_change_password boolean default false
) returns void
```

- **Authority (Option A, recommended):** `app.can_administer_person_for('cpf_change', p_user,
  p_actor)` — the **SUBSET** arm, because the write includes `cpf`. Under Option A the affiliation
  already exists when this runs, so the footprint is `{the registrar's hospital}` and SUBSET is
  satisfied. **Under Option B:** a distinct inviter predicate + the `HC0T8` precondition (F-A).
- **SQLSTATE:** `42501` deny; `23505` propagates for a CPF collision; `HC0T8` only under B.
- **Audit:** `person.registered` (§5).
- **Writes:** `full_name, professional_category_id, cpf, date_of_birth, phone,
  must_change_password`. ⛔ **Does NOT write `home_organization_id`** — that is seeded by
  `handle_new_user` from user metadata, and writing it here would fire the deferred constraint
  trigger `profiles_tenant_has_org_trg`. Keep the door's column list exactly the current
  `.update({...})` key set.
- **Keystone (pgTAP 385):** a hospital_admin registrar finalizes a person affiliated to their
  hospital → succeeds; a hospital_admin of a *sibling* hospital in the same org → `42501`; an
  org_admin of a *different* org → `42501`.
- **Mutation that must red it:** neutralize step 2 (replace the
  `app.can_administer_person_for(...)` call with `true`). The sibling-hospital and foreign-org arms
  must both flip green→red-on-restore. ⚠ Assert the edit **landed** (`pg_get_functiondef` hash
  moved) before trusting the rerun, and assert the restore moves it **back**.
- **Call site:** `src/lib/users/actions.ts` ~651 — `.from('profiles').update({...}).eq('id',
  userId)` → `admin.rpc('finalize_invited_person_for', { p_actor: context.userId, p_user: userId,
  … })`. The surrounding `if (profileError)` branch keeps its `23505` → `MESSAGES.cpfCollision`
  mapping (PostgREST returns the RPC's SQLSTATE in `error.code` unchanged).

### 4.3 `public.update_person_fields_for`

```sql
public.update_person_fields_for(
  p_actor uuid,
  p_user uuid,
  p_full_name text,
  p_professional_category_id uuid,
  p_set_cpf boolean default false,          p_cpf text default null,
  p_set_date_of_birth boolean default false, p_date_of_birth date default null,
  p_set_phone boolean default false,         p_phone text default null
) returns void
```

⚠ **The `p_set_*` booleans are load-bearing, not ceremony.** The TS distinguishes *absent key*
from *explicit null* — `...(cpf === undefined ? {} : { cpf })` — and collapsing that in SQL would
let an edit form that does not carry the field **null it out**. A nullable parameter alone cannot
carry the distinction. Keystone: a call with `p_set_cpf => false, p_cpf => null` must leave the
stored CPF unchanged.

- **Authority — TWO arms in one door, and this is the single most important line in the design:**
  - always: `app.can_administer_person_for('fields', p_user, p_actor)` → **INTERSECTION**
    (`person-scope.ts` 130–136).
  - additionally, **only when the CPF actually changes**:
    `app.can_administer_person_for('cpf_change', p_user, p_actor)` → **SUBSET**
    (`person-scope.ts` 138–142).
  - ⚠ **"actually changes", not "the key is present"** — ADR 0133 Amendment 3, quoted at
    `actions.ts` 890–905: *"THE CPF GRAIN IS 'A REAL CHANGE', NOT 'THE KEY IS PRESENT' … taken
    literally that DEFEATS the amendment it appears in."* The SQL compares
    `app.normalize_cpf`-equivalent digits-only forms **on both sides**
    (`regexp_replace(x,'\D','','g')`), because the TS normalises both sides and a comparison that
    disagrees with its own writer is the defect. Clearing a stored CPF to null **is** a change and
    correctly hits the tighter bound.
- **SQLSTATE:** `42501` deny (either arm); `23505` propagates for a CPF collision.
- **Audit:** `person.fields_updated`, with `metadata.fields` = the *names* of changed columns.
  ⛔ **Never the values** — `cpf`, `date_of_birth`, `phone` are person-identifying; Rule 11 records
  *that* and *who*, never payloads.
- **Keystone (pgTAP 385) — the spanning-person differential, the arm that catches an
  INTERSECTION/SUBSET swap:** a person whose footprint is `{H1, H2}`, actor administers `{H1}`:
  - `fields`-only edit → **allowed** (INTERSECTION);
  - the same call with a real CPF change → **`42501`** (SUBSET).
  If the two bounds are swapped in SQL, exactly this pair inverts and nothing else does; a
  sole-footprint fixture would pass under either bound, which is why the spanning person is
  mandatory and a single-hospital fixture is a vacuous test.
- **Mutations that must red it:** (a) neutralize the `cpf_change` arm → the second assertion
  reds; (b) swap `'fields'` for `'cpf_change'` in the always-arm → the first assertion reds; (c)
  change the CPF comparison from "real change" to "key present" → an unchanged-CPF spanning-person
  edit starts failing.
- **Call site:** `actions.ts` ~940. **The TS `cpfChanged` computation and the
  `authorizePersonScopedAdmin(… 'cpf_change')` call at ~932 both STAY** (defense in depth +
  friendlier pt-BR); the door recomputes both independently from stored state.

### 4.4 `public.set_person_active_for`

```sql
public.set_person_active_for(p_actor uuid, p_user uuid, p_active boolean) returns void
```

- **Authority:** `app.can_administer_person_for('lifecycle', p_user, p_actor)` → **SUBSET**
  (`person-scope.ts` 138–142). This is the platform-wide kill switch (`app.is_active` is folded
  into every membership predicate), which is exactly why it keeps the tighter bound.
- **Writes:** `is_active = p_active`, and **`suspended_until = null` when `p_active` is true** —
  mirroring `reactivateUser`'s `{ is_active: true, suspended_until: null }`. One door, both
  directions: deactivate and reactivate are the same authority and the same audit family, and two
  doors would be two places to forget an arm.
- **SQLSTATE:** `42501` deny.
- **Audit:** `person.deactivated` / `person.reactivated` (branch on `p_active`), so the trail
  reads without decoding metadata.
- **Keystone (pgTAP 385):** spanning person `{H1,H2}`, actor administers `{H1}` → `42501`; the
  same actor over a sole-footprint `{H1}` person → allowed; a **hospital-tier** target (D2) →
  `42501` even for their own hospital's admin.
- **Mutations:** neutralize the authority call → the spanning arm reds; change `'lifecycle'` to
  `'fields'` → the spanning arm reds (this is the INTERSECTION/SUBSET swap in its most dangerous
  place); delete the D2 tier check in `can_administer_person_for` → the hospital-tier arm reds.
- **Call sites:** `deactivateUser` ~1175 and `reactivateUser` ~1193.

### 4.5 `public.suspend_person_for`

```sql
public.suspend_person_for(p_actor uuid, p_user uuid, p_suspended_until timestamptz) returns void
```

- **Authority:** `'lifecycle'` → **SUBSET**. Suspension routes through the same kill switch
  (`actions.ts` ~1212: *"it is `lifecycle` (subset) too, not a lesser act"*).
- **Writes:** `suspended_until = p_suspended_until` **only**. `null` means indefinite; a past
  instant reads as active again — the DB stores exactly what is given, unchanged from today.
- **SQLSTATE:** `42501` deny.
- **Audit:** `person.suspended`, `metadata.until` = the timestamp (a schedule, not PHI).
- **Keystone / mutations:** same shape as 4.4; plus an arm asserting `is_active` is **not**
  touched (a door that "helpfully" also flips `is_active` would be a silent widening of what
  suspension means).
- **Call site:** `suspendUser` ~1218.
- ⚠ Kept as a **separate door from 4.4** deliberately: `set_person_active_for` and
  `suspend_person_for` write disjoint columns, and merging them into one `p_active`+`p_until`
  door creates a call shape where passing the wrong combination silently reactivates a suspended
  person.

### 4.6 `public.upsert_credential_for`

```sql
public.upsert_credential_for(
  p_actor uuid, p_user uuid,
  p_id uuid,                       -- null → insert, non-null → update
  p_issuing_country text, p_issuing_state text, p_issuing_authority text,
  p_registration_number text, p_expires_on date default null
) returns uuid                     -- the credential id
```

- **Authority:** `app.can_administer_person_for('credentials', p_user, p_actor)` →
  **INTERSECTION** (`person-scope.ts` 130–136). ADR 0133 D3 + Amdt 1 ruling 1: a council
  registration is a local fact about the person, so authority at **any** hospital they serve.
- **Post-authority precondition (F-B):** on the update branch, the row must exist **and** belong
  to `p_user` → else `HC0T6`. This replaces the TS's `.eq('id',…).eq('user_id',…)` +
  zero-row-is-not-success check, which exists precisely because *"a zero-row UPDATE is NOT an
  error, so without this the UI reported 'Registro profissional salvo.' for a write that never
  happened"* (`actions.ts` ~1006). In SQL the door raises instead of returning 0 rows, which
  removes that whole failure mode.
- **Update branch also clears `verified_at` and stamps `updated_at`** — tamper-visible, unchanged
  from today. Asserted, because a door that drops it silently launders an edited credential into a
  verified one.
- **SQLSTATE:** `42501` deny; `HC0T6` not-found/not-yours; `23505` propagates for the 4-tuple
  collision.
- **Audit:** `credential.created` / `credential.updated`. ⛔ metadata carries
  `{credential_id, changed: [column names]}` — **never** `registration_number` (a professional
  identifier, Class-2 under Rule 12).
- **Keystone (pgTAP 385):** spanning person `{H1,H2}`, actor administers `{H1}` → **allowed**
  (this is the arm that reds if `credentials` is mis-bound to SUBSET); a hospital-tier target →
  `42501`; an update with another person's `p_id` → `HC0T6`, **not** a successful write and not a
  silent zero-row.
- **Mutations:** replace `'credentials'` with `'lifecycle'` → the spanning-allow arm reds; drop
  the `user_id` conjunct on the update branch → the cross-person arm reds.
- **Call sites:** `registerUser` ~740 (loop the door per credential, or add a set-returning
  companion — see §8 note), `upsertCredential` ~997 (update branch) and ~1022 (insert branch).

### 4.7 `public.delete_credential_for`

```sql
public.delete_credential_for(p_actor uuid, p_credential uuid) returns void
```

- **Authority:** resolve `v_user := (select user_id from professional_credentials where id =
  p_credential)`, then `app.can_administer_person_for('credentials', v_user, p_actor)` →
  **INTERSECTION**. ⚠ A null `v_user` (no such credential) **must take the same `42501` path as a
  denial**, not a distinct `HC0T6` — here the id is the *input*, so a distinguishable not-found is
  a credential-id oracle. This is the one place where `HC0T6` would be wrong, and it is the
  opposite of 4.6's update branch (where authority over `p_user` is proven first). **State this
  asymmetry in the migration header comment**; it is the exact shape a later "consistency" refactor
  would flatten.
- **SQLSTATE:** `42501` for both deny and unknown id.
- **Audit:** `credential.deleted`, `metadata = {credential_id, user_id}`.
- **Keystone:** an unauthorized actor with a **valid** id and an authorized actor with an
  **invalid** id must produce byte-identical errors.
- **Mutation:** give the unknown-id branch its own code → the indistinguishability arm reds.
- **Call site:** `removeCredential` ~1058. The TS pre-read at ~1045
  (`.select('user_id').eq('id', credentialId)`) may stay (it feeds the existing pt-BR message)
  but is no longer the authority; it is a `.select`, so `check-memberships-door` does not flag it.

---

## 5. Audit — exactly once, PHI-free

**Mechanism:** `app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary,
p_metadata, p_organization, p_hospital)`, called **once**, at the end of each door, after the
write. `entity_type = 'profile'` / `'credential'`; `entity_id = p_user` / the credential id;
`p_organization = v_org`; `p_commission = null`.

Three live facts that shape this, all read from the catalog:

1. ⚠ **`app.audit_write` is feature-flagged:** its first statement is
   `if not app.feature_enabled('audit_trail') then return; end if;`. A pgTAP fixture that does not
   enable `audit_trail` makes **every audit assertion in 385 pass vacuously** (the recorded
   pgTAP fixture-flag-gap class). 385 must enable the flag **and** carry a positive control that
   the flag being off is observable.
2. ⚠ **`profiles` and `professional_credentials` have NO audit trigger today** — verified: the only
   non-internal triggers on `profiles` are `guard_profile_no_delete_trg`,
   `guard_profile_privileged_columns_trg`, `profiles_tenant_has_org_trg`; `professional_credentials`
   has **none**. So (a) these doors introduce the **first** audit coverage of person-record
   mutation, a real Rule 11 gain worth recording, and (b) "exactly once" is easy to satisfy — there
   is no trigger to double with. The keystone still asserts *exactly one* row per call (count
   before/after = +1), because the cheap way to break it later is to add the trigger *as well*.
3. ⚠ **`actor_id` will be NULL, and that is the pre-existing platform gap, not a new one.**
   `app.audit_write` derives its actor from `auth.uid()`, which is NULL on every service-role path.
   `public.log_cpf_probe_for` states this in its own body:
   *"THE ACTOR RIDES IN THE METADATA, NOT IN `actor_id`, AND THAT IS A KNOWN GAP … That is
   PLATFORM-WIDE and pre-existing (`membership.granted`, `form.created` and `affiliation.created`
   are all unattributed the same way), so it is NOT fixed here."*
   **This design follows that precedent**: every door passes `'actor_user_id', p_actor` in
   metadata. **It does not fix the platform gap** — that is a separate workstream and dragging it
   into AE1.3 would add an `app.audit_write_as(p_actor, …)` sibling to the census, the wrapper
   arm, and the AE1.2 classification, in the increment least able to absorb it.
   ⚠ **But say it out loud in the gate record**: nine new person-authority doors whose audit rows
   carry `actor_id = null` is a defensible-but-noteworthy state, and the lead may prefer to rule
   otherwise. If the lead does want it fixed here, the minimal shape is `app.audit_write_as`
   (internal helper, no EXECUTE grant, classified in AE1.2 alongside the other internals).

**PHI-free, per Rule 11 and Rule 12:** metadata carries ids, column *names*, booleans and
timestamps. ⛔ Never `cpf`, `date_of_birth`, `phone`, `registration_number`, `full_name`, or any
before/after value of them. pgTAP 385 asserts this **structurally**, not by eyeball: after
exercising all six doors, assert that no `audit_log.metadata` row emitted by them contains any of
the fixture's literal CPF / DOB / phone / registration-number values.

---

## 6. `guard_profile_privileged_columns` — the interaction, in full

### 6.1 The live guard (catalog, verbatim in substance)

`guard_profile_privileged_columns_trg BEFORE UPDATE ON public.profiles FOR EACH ROW`, function
`public.guard_profile_privileged_columns()`, `prosecdef = true`. Its logic:

- `v_privilege_changed` := `is_admin` or `is_active` changed.
- `v_identity_changed` := `suspended_until`, `email_confirmed_at`, `home_organization_id`, `cpf`,
  `professional_category_id`, `must_change_password`, `date_of_birth`, `phone` changed.
- neither → `return new`.
- **`if auth.uid() is null then return new; end if;`** ← the trusted-caller arm.
- `v_identity_changed` → `raise 'identity/lifecycle columns are service-role-only' using errcode =
  'check_violation'` for **any** signed-in caller.
- `v_privilege_changed` → requires the *caller's* `profiles.is_admin`, else `check_violation`.

### 6.2 Does it block the doors? **No — and only because they are service-role-only.**

`auth.uid()`'s live body reads `request.jwt.claim.sub` / `request.jwt.claims->>'sub'` and nothing
else. `SECURITY DEFINER` changes `current_user`, never a GUC. A service-role PostgREST connection
carries a JWT with `role: service_role` and **no `sub`**, so `auth.uid()` is NULL inside the door
and inside the trigger it fires. The guard takes its trusted-caller early return. **No change to
the guard is required, and none should be made.**

### 6.3 What would happen if the doors were granted to `authenticated` — and why the "fix" is a vulnerability

Every one of the four `profiles` doors would break, loudly:

| Door | Columns written | Guard verdict for a signed-in caller |
| --- | --- | --- |
| `finalize_invited_person_for` | `cpf`, `professional_category_id`, `date_of_birth`, `phone`, `must_change_password` | `v_identity_changed` → **hard `check_violation`** |
| `update_person_fields_for` | `cpf`, `professional_category_id`, `date_of_birth`, `phone` | `v_identity_changed` → **hard `check_violation`** |
| `set_person_active_for` | `is_active` (+ `suspended_until`) | `v_privilege_changed` → requires caller `profiles.is_admin`, which an `org_admin` / `hospital_admin` does not hold → **`check_violation`** |
| `suspend_person_for` | `suspended_until` | `v_identity_changed` → **hard `check_violation`** |

⛔ **The obvious "fix" — exempting the doors from the guard via a transaction-local GUC — is a
privilege-escalation vulnerability**, and the reason is measured, not theoretical:

- `authenticated` holds **column-level UPDATE on `profiles.is_admin`, `is_active`,
  `suspended_until`** (measured; §1 item 2 lists the full grant). **The column grant is not the
  protection.**
- `profiles` carries an UPDATE policy `profiles_update_self` with `USING (id = auth.uid())` and
  `WITH CHECK (id = auth.uid())`.
- So RLS + the grant together already permit a signed-in user to `UPDATE profiles SET is_admin =
  true WHERE id = auth.uid()`. **`guard_profile_privileged_columns` is the only thing that stops
  it.**
- Any custom GUC is settable by any role via `set_config`, so a GUC-token exemption is forgeable
  by the very caller it is meant to exclude → **self-elevation to `is_admin`**.

**Therefore, as a standing rule this design asks the lead to record:** the guard's trusted-caller
arm is never widened; a `profiles` privileged write is either service-role or it does not happen.
This belongs in `.claude/rules/` (path-scoped to `supabase/migrations/**` +
`src/lib/users/**`), with `anchors:` on `guard_profile_privileged_columns` and
`profiles_update_self`. It is not a PROGRESS.md line — it has no resolution event.

### 6.4 The anti-fix keystone (pgTAP 386)

Three assertions, whose *joint* survival is the property:

1. every door succeeds when invoked as `service_role` with a permitted actor;
2. a signed-in `authenticated` session cannot `UPDATE profiles SET is_admin = true WHERE id =
   auth.uid()` — it raises `check_violation`;
3. `has_function_privilege('authenticated', <each door>, 'EXECUTE')` is **false**, and each
   door's `proacl` is **NOT NULL** (a NULL `proacl` includes PUBLIC — the recorded fail-open
   class).

**Mutation:** grant `authenticated` EXECUTE on one door → assertion 3 reds. Then, separately,
add an `or current_setting('app.door', true) = 'on'` arm to the guard → assertion 2 reds. Both
must be shown to red; assertion 1's continued green while 2 or 3 is red is what proves the three
are independent and not one predicate three times.

### 6.5 Other triggers, checked and cleared

- `profiles_tenant_has_org_trg` — a **deferred constraint trigger** `AFTER INSERT OR UPDATE OF
  home_organization_id, is_admin`. **No door writes either column**, so it does not fire. Keeping
  `home_organization_id` out of `finalize_invited_person_for` is what keeps that true (§4.2).
- `guard_profile_no_delete_trg` — BEFORE DELETE; no door deletes a profile.
- `professional_credentials` — **no triggers at all**; its only RLS policy is
  `professional_credentials_select`. It has **no write policy**, so `authenticated` cannot write
  it under RLS at all despite holding table-wide INSERT/UPDATE/DELETE grants. Worth a line in
  AE1.6's zero-policy record: the grant/policy asymmetry is currently harmless and would stop
  being harmless the day someone adds a permissive write policy.

---

## 7. Invite-flow partial failure — the new ordering, stated

**Today** (`registerUser`): `auth.admin.createUser`/`inviteUserByEmail` → (`handle_new_user`
trigger seeds the `profiles` row from metadata) → **profile patch** → `affiliate_person_to_org_for`
(org_admin path only) → `affiliate_person_for` (if a hospital) → credentials insert. Each failure
is surfaced, never swallowed; the code comments name the bad state explicitly: *"⛔ WITHOUT THIS
CALL A HOSPITAL-LESS REGISTRATION CREATES NO ORG AFFILIATION AT ALL … that person would exist and
appear on nobody's roster."*

**Under Option A (recommended), the order becomes:** createUser → **org affiliation** → **hospital
affiliation** → **`finalize_invited_person_for`** → credentials.

| Failure point | State left behind — TODAY | State left behind — AFTER |
| --- | --- | --- |
| `createUser` | nothing (clean) | nothing (clean) |
| affiliation door | account exists; **no roster visibility**; no category/CPF/DOB/phone | identical to today |
| profile patch / finalize door | account exists; **no roster visibility**; no category/CPF/DOB/phone | account exists; **ON the roster**; no category/CPF/DOB/phone; `must_change_password` false |
| credential insert | account exists, affiliated, profile complete, credentials missing | identical to today |

**The new state is strictly better than the old one**: the person is visible on the roster and
correctable through the ordinary person-edit UI (which is `update_person_fields_for`), instead of
being the roster-invisible person the existing comment calls out as the failure to avoid.

**New failure mode introduced by the conversion:** the door can now raise `42501`. On this path a
`42501` means the TS entry gate and the SQL predicate **disagree** — not a legitimate deny — so it
must not be reported as "sem permissão" to an operator who was just allowed to reach the form. The
call site maps a door `42501` on the finalize path to `MESSAGES.generic` and the failure is
surfaced (never swallowed), matching the existing `if (profileError)` treatment.

⚠ **`must_change_password` moves inside the door.** Today it is written by the same
`.update({...})`; it stays in `finalize_invited_person_for`'s column list. It is *not* the
self-scoped `must_change_password` write in `src/lib/auth/actions.ts` — that one is a different
site and stays unconverted (§9).

**Tester obligation (plan's own Trap):** the invite E2E spec must assert the **partial-failure**
path, not only success — specifically that a finalize failure leaves a roster-visible,
field-incomplete person and surfaces an error, rather than reporting success.

---

## 8. Migrations, tests, numbering

**Migration timestamps — assigned from the AE1.3 range `20261003004600`–`20261003004699`** (head
is `20261003004300`; siblings hold 004400 / 004500). ⚠ Only `…4600`–`…4659` are valid clock
values; the four below are deliberately spaced by ten.

| File | Contents |
| --- | --- |
| `20261003004600_person_authority_predicate.sql` | `app.can_administer_person_for` (DEFINER, STABLE, footprint CTE inline); `revoke all … from public, anon, authenticated`; `alter default privileges` per AE1.2 step 3 if not already in place |
| `20261003004610_person_profile_doors.sql` | `app.{finalize_invited_person,update_person_fields,set_person_active,suspend_person}_impl` (DEFINER, VOLATILE, owner-only) + the four `public.*_for` wrappers + their `service_role` grants |
| `20261003004620_person_credential_doors.sql` | `app.{upsert_credential,delete_credential}_impl` + the two `public.*_for` wrappers + grants |

⚠ **No fourth "gate registration" migration exists** — §10 established that nothing needs to be
*declared* in SQL: `census` and `policy` entry is automatic from the predicate's shape, the ADR
0156 gate's entry is automatic from the `_impl` shape, and `floor` / `wrapper` are out of domain by
construction. The gate-side edits are to **test and review artefacts**, not migrations:

| Artefact | Edit |
| --- | --- |
| `supabase/tests/304_affiliation_lifecycle.sql` §6.6 | add **`HC0T6`** to the declared SQLSTATE literal (both-directions equality). ⛔ Do **not** add `HC0T7` (§10.3). |
| `docs/reviews/authz-door-audit-findings.md` | the verdict row for `app.can_administer_person_for`, produced by the diff-scoped door sweep — **not hand-written** |
| `supabase/tests/mutation/authz-neverclled-door-allowlist.txt` | ⛔ **no entry** (§10.2 item 3) |

⛔ No top-level `set local` anywhere (`lint:set-local`; the watermark is never bumped).
⛔ Forward-only: nothing in `20261003004300` and below is edited.

**pgTAP — current high-water is `381`; `376` is a known genuine gap, not a missing file.
Claiming `384`, `385`, `386`** (382–383 left free for the AE1.1 FK suite and AE1.2's ACL suite,
which are siblings in the same phase — the lead should confirm that split with the AE1.1/AE1.2
owner before any file is created, since two branches taking the same "next free" number is the
recorded parallel-numbering collision):

| File | Subject |
| --- | --- |
| `supabase/tests/384_person_scope_sql_predicate.sql` | the predicate alone: capability × footprint matrix — spanning person, sole-footprint, empty footprint, hospital-tier target, org-tier target, expired commission seat, ended affiliation, voided affiliation, cross-org actor (**constructed**, rule 10 — no seeded persona is cross-org), unknown capability → `HC0T7` |
| `supabase/tests/385_person_doors_authority_and_audit.sql` | the six doors: allow arm, deny arm + `42501`, `HC0T6`, the CPF real-change grain, `verified_at` clearing, exactly-once audit, PHI-free audit (structural), authority-before-existence indistinguishability |
| `supabase/tests/386_person_doors_acl_and_guard.sql` | positive ACL assertions (`proacl` NOT NULL; no `authenticated`/`anon` EXECUTE), the §6.4 anti-fix keystone, `professional_credentials` zero-write-policy assertion |

**Red-first, per the role contract:** 384's spanning-person INTERSECTION/SUBSET pair and 386's
ACL assertions are written and observed **red** before any SQL is authored. ⚠ A keystone that is
**green on its first run is a finding**, not a pass — at contract time
`app.can_administer_person_for` does not exist, so a green means the assertion is satisfied by
something other than the predicate (a wrong-arm fixture, a pre-existing deny).

**Mutation discipline** (plan's requirement + the recorded traps): for every mutation named in §4,
(a) assert the edit **landed** — compare `md5(pg_get_functiondef(oid))` before/after and require it
to have **moved**; (b) run; (c) restore and require the hash to move **back**. A mutation that did
not fully apply reports green.

**Not a gate, but required before verdicts:** a fresh `supabase db reset`. ⛔ This session must not
run one — two sibling agents share the stack (plan rule 7). The build session coordinates the reset
through the lead.

---

## 9. `check-memberships-door.mjs` (AE1.4) — what these conversions must look like

Read from `scripts/check-memberships-door.mjs`:

- it flags `.from('<gated table>')` followed within the file by one of
  `insert | upsert | update | delete`;
- `.select(` is explicitly fine (`"`.select(...)` on these tables is fine — only
  insert/upsert/update/delete are gated"`);
- the `ALLOWLIST` is keyed by **file path**, not by site (`if (ALLOWLIST.has(rel)) continue`).

Consequences this design must satisfy for AE1.4's `GATED_TABLES` extension to pass:

1. **Zero** `.from('profiles').{insert,update,delete}` and zero
   `.from('professional_credentials').{insert,update,delete}` remain in `src/` after AE1.3 —
   all nine sites become `.rpc(...)`.
2. The **reads** stay and are fine: `authorizePersonScopedAdmin`'s
   `.from('profiles').select('home_organization_id')`, `updateUserProfile`'s current-row read,
   `removeCredential`'s `.select('user_id')`, `resendInvite` / `sendPasswordResetForUser`'s
   `.select('email')`, and `resolvePersonFootprint`'s reads.
3. The one allowlist entry is `src/lib/auth/actions.ts` (the self-scoped `must_change_password`
   write). ⚠ **Because the allowlist is file-scoped, allowlisting that file makes *any* future raw
   `profiles` DML added to it invisible to the gate.** That is acceptable only if the entry's
   recorded reason states the bound ("self-scoped `must_change_password` only") and AE1.4's
   registry — not the gate — carries the closing instrument, which is what the plan already says.

---

## 10. Arm domains — and **F-F, the finding that reshaped this design**

Each arm's domain predicate was read out of `supabase/tests/mutation/p0-authz-invariant.sh`,
its three child sweeps, `act-hat-blind-sweep.sh`, and `supabase/tests/304_affiliation_lifecycle.sql`
§6 (the ADR 0156 gate). The result is not what plan rule 4 assumes.

### F-F — a `public` `SECURITY DEFINER` door that returns `void`/`uuid` and is granted to `service_role` only is in **NO** ARM's domain.

The arms bound their domains as follows (verbatim conditions):

| Arm | Domain condition |
| --- | --- |
| `census` | `nspname in ('app','public') and prosecdef and (rettype = 'bool' or (proretset and authenticated has EXECUTE))`; **or** `public`, `not prosecdef`, `prokind='f'`, `plpgsql`, authenticated EXECUTE; **or** every `public` RLS policy |
| `policy` | `prosecdef` + `PRED_DOMAIN` — `rettype='bool'` **and** (`proname ~ '^(is_\|can_\|has_\|…)'` **or** comment-stripped `prosrc ~ 'auth\.uid\(\)\|memberships\|member_can\|app\.is_\|app\.can_\|app\.has_\|principal_id'`); plus a rowdoor arm needing `proretset` + authenticated EXECUTE; plus read-side policies; plus **two hand lists** for the write path |
| `floor` | `nspname = 'public'` **and** `prosecdef` **and** `has_function_privilege('authenticated', …, 'EXECUTE')` — no return-type filter |
| `wrapper` | `public`, **`not prosecdef`**, `prokind='f'`, `plpgsql`, authenticated EXECUTE — the `prosecdef = f` half by construction |
| `hat` | `nspname in ('app','public') and prokind='f'`; **fires** only where a `;`-chunk reads `\ymemberships\y` with `principal_id` bound to the *caller* and no `active_role(`/`has_role(`/`has_role_any(` in that chunk |
| ADR 0156 door-SQLSTATE gate (pgTAP `304` §6) | `app` + `prosecdef` + **`provolatile='v'`** + EXECUTE for **neither** `authenticated` **nor** `service_role`, **called by** a `public` `plpgsql`/`sql` function one of those roles may execute — **and that calling wrapper too** |

Apply the §1 shape (`public.X_for`, DEFINER, returns `void`/`uuid`, `service_role`-only) to that
table: **out of `census`** (not bool, not setof), **out of `policy`** (not bool), **out of `floor`**
(no `authenticated` EXECUTE), **out of `wrapper`** (`prosecdef = t`), **no finding from `hat`**
(it delegates to `app.is_*` instead of reading `memberships` raw). This is the already-recorded
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` class — the invariant script names it at its own line 365 —
and it means **plan rule 4 as written ("each door enters every ARM domain") cannot be satisfied by
the shape the plan's own AE1.3 table prescribes.**

⛔ **Absence of a verdict here IS absence of coverage.** Saying "no arm reds, so the doors are
covered" would be the exact vacuity the rule exists to prevent.

### 10.1 The design's answer — put the DECISION in a swept object, and keep the shells thin

**Two structural changes, both adopted:**

**(a) The authority predicate is named `app.can_administer_person_for` and returns `boolean`.**
`prosecdef = t`, `nspname = 'app'`, `rettype = bool` → **automatically inside `census`'s live set**
(reachability is irrelevant to that clause) and **inside `policy`'s `PRED_DOMAIN`** via
`PRED_NAME_RE`'s `^can_`.

⚠ **The `can_` prefix is chosen for domain entry, not for style.** The identity-body escape hatch
(`prosrc ~ 'app\.is_|memberships|principal_id'`) would also admit it *today*, but that is a **body
property**: a future refactor that pushes the `memberships` read into a helper would silently
evict it from the sweep. A name prefix cannot be refactored away. The TS twin keeps its own name
(`personScopeAllows`); `person-scope.ts`'s rewritten header (F-C) names the SQL twin explicitly so
the mirror is discoverable from either side.

**(b) Each door is split into the repo's existing two-layer shape:
`public.<name>_for` (thin, `service_role` EXECUTE) → `app.<name>_impl` (`SECURITY DEFINER`,
**`VOLATILE`**, EXECUTE granted to nobody).** This is exactly `end_affiliation_for` →
`app.end_affiliation_impl :: postgres=X/postgres`, verified live. It buys the **ADR 0156
door-SQLSTATE gate for free**: the kernels enter its `kernel` clause and the `public` wrappers
enter as *calling wrappers*, with no edit to the gate's domain.

⚠ Naming the kernels `*_impl` is also **load-bearing**: 304 §6.1 is a reverse pin — any `app`
function matching `proname like '%\_impl'` that is **not** in `door_body` reds and names the
escapee. So a kernel that is accidentally `STABLE`, or accidentally granted to `service_role`,
fails loudly instead of silently leaving the gate.

**(c) `app.person_footprint_for` is NOT minted as a separate `setof uuid` helper.** It would be in
no arm's domain (census's setof clause needs `authenticated` EXECUTE, which an owner-only helper
does not have), so it would be a new unswept object for no benefit. The footprint becomes a CTE
**inside** `app.can_administer_person_for`. §3.3's SQL is unchanged; only its home moves.

### 10.2 The resulting matrix — per object, per arm, with the verdict each must produce

| Object | `census` | `policy` | `floor` | `wrapper` | `hat` | ADR 0156 |
| --- | --- | --- | --- | --- | --- | --- |
| `app.can_administer_person_for(text,uuid,uuid) → bool`, DEFINER, **STABLE**, owner-only | **IN — auto. Will RED as a `newcomer` until a verdict exists.** | **IN** (predicate arm, `^can_`) | out (`app`) | out (DEFINER) | in domain; **no finding expected** | **out** (`STABLE`, see 10.3) |
| 6 × `app.<door>_impl(...)`, DEFINER, **VOLATILE**, owner-only | out (not bool) | out (not bool) | out (`app`) | out | in domain; no finding expected | **IN** (kernel clause) |
| 6 × `public.<door>_for(...)`, DEFINER, `service_role` only | **out** | **out** | **out** | out | in domain; no finding expected | **IN** (calling-wrapper clause) |

**What each arm must be made to say, and how:**

1. **`census` — the one arm that fails on absence, and the one that catches this increment.**
   `app.can_administer_person_for` is a live-set newcomer; `newcomers = comm -23 live accounted`
   nonempty ⇒ RC=1. It becomes *accounted* only by acquiring a **verdict row** in
   `docs/reviews/authz-door-audit-findings.md` (or an allowlist entry — **not** acceptable here).
   ⇒ **The increment must run the diff-scoped door sweep over it** (cases derived by
   `scripts/door-sweep-cases.sh`, never by hand; its exit 1 is a finding to rule on) and commit the
   resulting `COVERED` / `BLIND` verdict. A `BLIND` verdict **blocks the phase** — keystone it.
   ⚠ Run `ARM=census` **after** the migration and **before** editing the findings md, and confirm it
   REDS naming exactly this function. A census that is green at that moment means the function did
   not land in the domain — i.e. it is not `bool`, or not `prosecdef` — and the whole of (a) failed
   silently.
2. **`policy`** — under `FROMFINDINGS=1` it compares against the same committed findings mds, so
   the verdict written in step 1 is what makes it non-vacuous. A `COVERED` verdict keeps the
   predicate out of `## BLIND`; the arm then passes **because it was swept**, not because it was
   absent. ⚠ Record it that way in the gate record.
3. **`floor`** — the six `public` doors are **outside its domain** (no `authenticated` EXECUTE).
   ⛔ **Ruling requested: do NOT add them to `authz-neverclled-door-allowlist.txt`.** An entry there
   would resolve against `pg_proc` (so it would not trip the ALLOWLIST-ROT check) and would read as
   *"swept and excused"* — fabricating coverage for a door the arm never examined. This is the
   recorded "allowlisting a door as E2E-only is WHAT MAKES it blind" shape. The correct record is
   the sentence, not the entry.
4. **`wrapper`** — structurally silent (ADR 0079 Amendment 7: it is the `prosecdef = f` half).
   Nothing to add; `FROMFINDINGS=1 ARM=wrapper` must be reported as *"structurally out of domain"*,
   never as *"passed"*.
5. **`hat`** — all eight new functions are in its domain (`app`/`public`, `prokind='f'`), and none
   should produce a finding, because the predicate delegates the caller's authority to
   `app.is_org_admin_of_for` / `app.is_hospital_admin_of_for` rather than reading `memberships`
   raw for the caller. The two raw `memberships` reads it *does* perform bind `principal_id` to
   **`p_user` — the target, never the caller** — so they are not caller-bound and are correctly
   outside the finding condition. ⚠ **This must be observed, not assumed**: run `ARM=hat` and
   confirm zero `NEW` and zero `GHOST`. A `NEW` finding here would mean the param-binding fixpoint
   proved `p_user` caller-bound, i.e. some caller passes `auth.uid()` into it — which would be a
   real bug in the call sites, not a false positive.
6. **ADR 0156 gate (`supabase/tests/304_affiliation_lifecycle.sql` §6)** — the six kernels and six
   wrappers enter automatically, and then:
   - §6.2 requires **every** `raise exception` in an in-domain body to name a **literal** `errcode`.
     ⇒ no bare raises, no computed `errcode = v_code`, anywhere in the twelve bodies.
   - §6.6 compares the resolved code set against a **declared string literal**, in both directions.
     ⇒ **the literal must gain `HC0T6`**. `42501` and `23514` are already declared. `23505` is not
     raised by our bodies (it propagates from a constraint), so it does not enter.
   - ⚠ **Cross-suite coupling worth flagging:** the gate lives inside the *affiliation* suite, so an
     AE1.3 migration forces an edit to `304_affiliation_lifecycle.sql`. That is correct (the gate's
     domain is global) but it is a file-ownership collision risk if the AE1.1/AE1.2 sibling also
     touches 304 — serialize with the lead.

### 10.3 `HC0T7` is outside the 0156 gate — stated, not hidden

`app.can_administer_person_for` is `STABLE` (correct for a predicate) and the 0156 kernel clause
requires `provolatile = 'v'`, so its `HC0T7` raise is **not** covered by the door-SQLSTATE gate.
Making the predicate `VOLATILE` purely to enter the gate would be shaping a volatility marker to
game a domain, and it would also block the planner from hoisting it. **Resolution: `HC0T7` is
keystoned directly in pgTAP 384** (`throws_ok` on a literal bogus capability), and the AE1 gate
record says so. Do not add `HC0T7` to §6.6's literal — it would then be a declared code no
in-domain body raises, and §6.6 fails in the *other* direction.

### 10.4 REJECTED alternative — making the doors return `boolean` to enter `census` + `policy`

A `public` DEFINER door returning `bool` would enter both domains automatically. **Rejected.** A
command door that returns `true` or raises is a semantic lie, and worse, it would pollute the
predicate sweep's population with objects that are not predicates — making the sweep's own
coverage figure less meaningful for every future reader. Shaping a return type to enter a sweep is
the sweep's failure mode, not its use. The honest structure is the one adopted: **the mutation-
sensitive part — the authority decision — lives in a `bool` function that IS swept; the shells are
thin and are covered by pgTAP 385/386 plus the 0156 gate.** The residual is
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s, and the AE1 Record step should **re-derive** that FUP's counts
rather than incrementing them by hand.

---

## 11. Open questions for the lead

0. **F-F / §10 — approve the restructure**: the authority decision moves into a `bool`,
   `can_`-named `app` predicate (so `census` + `policy` sweep it), and each door becomes a
   `public.*_for` wrapper over an `app.*_impl` VOLATILE kernel (so the ADR 0156 gate sweeps both).
   ⚠ **And approve the two "no entry" rulings**: no floor-allowlist entry, no `HC0T7` in 304 §6.6.
   Without this ruling the plan's rule 4 is unsatisfiable and the AE1 gate record would have to
   claim coverage that does not exist.
1. **F-A — Option A (reorder `registerUser`) or Option B (special inviter predicate + widening)?**
   Everything in §4.2 and §7 depends on this ruling.
2. **F-C — approve the companion ADR 0161 (`Amends: 0133`)** retiring D4's "no SQL twin", and the
   `person-scope.ts` header rewrite in the same increment?
3. **§5 item 3 — accept `actor_id = null` on the nine doors' audit rows** (platform precedent), or
   mint `app.audit_write_as` here?
4. **§3.7 — shared TS/SQL vector file in AE1.3, or deferred with the deferral recorded?**
5. **§8 — confirm the pgTAP number split 382/383 vs 384–386** with the AE1.1/AE1.2 owner before any
   file is created.
6. **§6.3 — admit the standing rule to `.claude/rules/`** (the guard's trusted-caller arm is never
   widened)? It is within the 12-rule bound only if something else retires; the lead owns that
   budget.

---

## 12. LEAD RULINGS — 2026-08-27 (these answer §11; the design is APPROVED to build)

All seven §11 questions are ruled below. **§0's findings are accepted** — the design correctly
reports that the plan's own AE1.3 table does not survive contact with the code, so the plan is
**corrected** by these rulings rather than silently obeyed.

### R0 — F-F restructure: **APPROVED**, including both "no entry" rulings

Adopted exactly as §10.1 states: the authority decision moves into
`app.can_administer_person_for` (`boolean`, `can_`-prefixed, DEFINER, STABLE, owner-only); each
door becomes `public.<name>_for` over `app.<name>_impl` (DEFINER, **VOLATILE**, granted to
nobody); `app.person_footprint_for` is **not** minted as a separate helper.

- ⭐ **The `can_` prefix is approved as a domain-entry decision, not a style one.** §10.1's
  argument is the load-bearing one: the identity-body escape hatch would admit the predicate
  today, but that is a **body property** a future refactor can evict silently. A name prefix
  cannot be refactored away.
- ✅ **No floor-allowlist entry for the six `public` doors.** An entry resolves against `pg_proc`,
  so it would not trip ALLOWLIST-ROT, and it would read as *"swept and excused"* — fabricating
  coverage for a door the arm never examined. That is the recorded
  *allowlisting-a-door-is-what-makes-it-blind* shape. **The correct record is the sentence in the
  gate record, not the entry.**
- ✅ **`HC0T7` does NOT enter 304 §6.6's literal.** §10.3 is right in both directions: making the
  predicate `VOLATILE` to enter the gate would shape a volatility marker to game a domain (and
  block planner hoisting), while declaring a code that no in-domain body raises fails §6.6 the
  *other* way. Keystone it directly in pgTAP 384.
- ⛔ **§10.4's rejection stands.** Shaping a return type to enter a sweep is the sweep's failure
  mode, not its use. Do not revisit it.
- ⛔ **Binding — this is a positive control on the restructure itself (§10.2 item 1):** run
  `ARM=census` **after** the migration and **before** editing the findings md, and confirm it
  **REDS naming exactly `app.can_administer_person_for`**. A green census at that moment is not
  success — it means the predicate never entered the domain (not `bool`, or not `prosecdef`) and
  change (a) failed **silently**. Record the red, then the verdict, then the green.
- The AE1 Record step **re-derives** `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s counts. ⛔ Never increment
  them by hand.

### R1 — F-A: **Option A** (reorder `registerUser`; no special inviter predicate)

Three grounds, in order of weight:

1. **Option B widens `hospital_admin` authority** over the hospital-less `novato.pendente` class.
   Widening cannot be accepted silently (ADR 0154), and a widening adopted to avoid a reorder is
   the worst available reason to take one.
2. **Option A yields ONE authority rule instead of two.** This program exists to collapse
   duplicated authority knowledge; minting a second, invite-only authority predicate in its first
   building phase would be the program contradicting its own thesis.
3. **Option A's failure state is strictly better than today's.** Per §7 a finalize failure leaves
   a roster-visible, field-incomplete person correctable through the ordinary edit UI — instead of
   the roster-invisible person the existing code comment names as the state to avoid.

§7's `42501` handling is approved as written: on the finalize path it means TS and SQL
**disagree**, not a legitimate deny, so it maps to `MESSAGES.generic` and is surfaced, never
swallowed. ⚠ **Tester obligation, binding:** the invite E2E spec asserts the **partial-failure**
path, not only success.

### R2 — F-C: **APPROVED — ADR 0161 `Amends: 0133`, plus the header rewrite, same increment**

`0161` confirmed free against `docs/decisions/INDEX.md`, not by eyeballing the directory. Both
halves ship together: leaving *"a SQL twin is deliberately not built"* in `person-scope.ts` while
building the SQL twin is the *only-the-amending-document-knows-about-the-amendment* failure, sited
in the file most likely to be read by the next author of this rule. Run `npm run adr:index` after.

### R3 — Audit: **follow the platform precedent (`actor_id` null, actor in metadata) — AND file a FUP**

Verified in the catalog before ruling: `app.audit_write` **is** feature-gated on `audit_trail`
(so §5's vacuity warning is real — 385 must enable the flag **and** positive-control that the flag
being off is observable), and `profiles` carries **0** audit triggers against a control showing
`memberships` carries **1**. So these doors genuinely introduce the **first** audit coverage of
person-record mutation.

Do **not** mint `app.audit_write_as` here. The actor is not lost — it rides in metadata — so this
is a queryability gap, not a Rule 11 loss. Fixing it only here would leave `actor_id` **partially**
populated, which is worse for a reader than uniformly null: a query filtering on it would silently
miss everything else.

⛔ **But "say it out loud in the gate record" is not sufficient** — that is exactly the class of
obligation AFF4 left unfiled (tracked as `FUP-AFF4-RESIDUE-UNFILED` in
`docs/followups/follow-ups-open.md`, ~16 of them). **File a `FUP-*` index line with a
body** for the platform-wide `actor_id` gap, naming these conversions as new instances. An
obligation with no register line is invisible work.

### R4 — §3.7 shared TS/SQL vectors: **land them in AE1.3**

F-C's whole point is that this repo previously refused the mirror *because a mirror is a drift
liability*. Creating the mirror without the drift control accepts precisely the liability the
original prohibition warned about, and Architecture Rule 3 now genuinely attaches to
`personScopeAllows` ↔ `app.can_administer_person_for`.

⚠ **Bounded:** if shared vectors would require restructuring `person-scope.ts`'s exported API,
**stop and defer** — with the deferral recorded as a `FUP-*` line, not as a sentence.

### R5 — pgTAP numbering: **384–386 confirmed, no collision**

Settled by measurement, not by agreement: **382 is TAKEN** — AE1.6 has landed and is committed
(`382_zero_policy_tables_are_door_only.sql`, 68 assertions, suite now 230 files / 7631 tests).
**383** is reserved for AE1.1 per [`authz-ae1-fk-preflight.md`](../design/authz-ae1-fk-preflight.md).
AE1.3 takes **384–386**. `376` remains a genuine numbering gap, not a missing file.

⚠ **§10.2 item 6's cross-suite coupling is real, and serializing it is the lead's job:** AE1.3
must edit `supabase/tests/304_affiliation_lifecycle.sql` §6.6 to add `HC0T6`. **No sibling AE1 task
may touch 304** — AE1.1 owns 383 only, and AE1.2 writes no test file.

### R6 — §6.3 standing rule: **admit it, in the same increment as the doors — not before**

⛔ **Correction to §11 item 6's premise:** `.claude/rules/` currently holds **8** rules against a
cap of **12** (measured — gate 8 prints the count on every run). Nothing needs to retire; 8 → 9 is
inside the bound.

Admit it **with** the doors, not ahead of them: a rule must declare **checkable anchors**, and
anchors naming `app.can_administer_person_for` or the doors cannot resolve until those objects
exist — gate 8 would red. Path-scope to `supabase/migrations/**` (the moment the tempting "fix"
gets written), keep it under 2 KB, and state the prohibition as §6.3 derives it: **the guard's
trusted-caller arm is never widened, and granting any of these doors to `authenticated` is not a
fix — it is a self-elevation vulnerability.**

---

**Status: APPROVED TO BUILD** under R0–R6. The build is a separate, lead-dispatched task; this
document is the contract it is built from.
