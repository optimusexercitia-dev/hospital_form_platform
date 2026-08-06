# Plan — AFF: hospital affiliation, person identity & the org people directory (ADR 0097)

**Status:** IN PROGRESS — ADR [0097](../decisions/0097-hospital-affiliation-person-identity.md)
approved 2026-08-05; build started the same day on branch
`feat/hospital-affiliation-person-identity`.
**Migration window:** allocate `20260909000100`+ — the highest *registered* version at
kickoff was `20260908000100` (285 files = 285 registered). Re-check the registry, not the
directory, before authoring (the two-sessions-one-DB lesson).
**Audit:** corrected 2026-08-05 per the external audit
([aff-adr-0097-external-audit.md](../reviews/aff-adr-0097-external-audit.md)) — the
material changes are T1.2 (CPF column-list grants), T1.3 (two added sites), T2.1
(any-tier end block), T2.2 (gate + audit row), **T2.5 (new — the `grant_role_impl`
hospital arm, without which T3.4 is impossible)**, and T3.4.
**Authority notes:** this plan is **NOT authoritative on the substrate**. Every
schema / RLS / RPC claim below was catalog-verified on 2026-08-05 and must be
**re-verified against the live catalog at build time** (ADR 0078 A28 — migration file
text is stale by design; graphify does not index SQL). Before any workstream starts, the
assigned teammates read [authz-handoff §7](../progress/authz-handoff.md) and the
*Standing traps* section at the foot of this plan.

## Why now

The *feature* is not urgent — the first customer is 5 hospitals / ~150 professionals with
a small multi-hospital fraction, and no bulk import. The *schema* is: a new table, two
dropped columns, a new unique column-locked column, a widened policy, two new doors, a
widened `grant_role_impl` arm and the `profiles` column-grant conversion are free while
`supabase db reset` is free, and materially more expensive the day after the pilot's
remote `db push`. **AFF gates the pilot deploy** (ADR 0097 D19).

## Program shape

| WS | Name | Depends on | Owner |
| -- | ---- | ---------- | ----- |
| W1 | Substrate — `hospital_affiliations`, CPF, column removals | — | `backend` |
| W2 | Doors, visibility & the dominance grid | W1 | `backend` |
| W3 | Product surfaces — identifier-first registration, roster, provisioning | W2 (contract-first) | `frontend` + `backend` |

Strictly sequenced. W2 consumes W1's table; W3 consumes W2's RPC signatures. Per the
lead playbook, `backend` publishes the W2 RPC + type contract before `frontend` starts W3.
**File ownership:** `backend` owns `supabase/**` and `src/lib/{supabase,queries,types}`
plus `src/lib/users/actions.ts` and `src/lib/members/invite.ts`; `frontend` owns
`src/app/**` and `src/components/**`. `src/lib/types/database.ts` changes only via
`backend` (`npm run gen:types` after every migration — Rule 8).

---

## W1 — Substrate

**Goal:** the person is identified by CPF, and "works at this hospital" is a row.

### T1.1 — `public.hospital_affiliations`

```
id                     uuid  pk default gen_random_uuid()
principal_id           uuid  not null  → profiles(id) on delete cascade
organization_id        uuid  not null
hospital_id            uuid  not null
                       composite FK (hospital_id, organization_id) → hospitals(id, organization_id)
hospital_employee_id   text  null        -- matrícula, per employment (ADR 0097 D3)
started_on             date  not null default current_date
ended_on               date  null        -- soft end, never DELETE (D4)
created_by / created_at / ended_by
```

- Partial unique `(principal_id, hospital_id) WHERE ended_on IS NULL` — one **active**
  affiliation; history is legitimate and unbounded.
- CHECK `ended_on IS NULL OR ended_on >= started_on`.
- **Follow the ADR-0094 composite-FK lesson exactly**: the `(hospital_id,
  organization_id)` composite **replaces** any single-column `hospital_id` FK rather than
  joining it — a second FK to an already-reachable target is the PostgREST **PGRST201**
  ambiguous-embed shape. If any embed on this table is added later it must be FK-hinted.
- RLS enabled; `authenticated` gets **SELECT only** (no DML grant — writes go through W2's
  door). SELECT policy is **four legs** (audit MEDIUM-4 — a bare mirror of T2.3's two
  admin legs would hide a person's own affiliations from their own account page and
  everything from an org_admin): `principal_id = auth.uid()` **OR**
  `app.is_org_admin_of(organization_id)` **OR** the two T2.3 admin legs, kept in lockstep
  with the `profiles` policy so the two never drift.
- Audit trigger emitting `affiliation.created` / `affiliation.ended` (Rule 11).

### T1.2 — `profiles.cpf`

- `cpf text NULL`, **unique platform-wide** (partial unique `WHERE cpf IS NOT NULL`,
  mirroring `profiles_email_key`'s shape). Nullable in schema, **required at the action
  layer** (D7) — the documented escape for a foreign professional.
- Stored digits-only; check digits validated in **both** SQL (a `CHECK` or a domain) and
  TS, and the two must agree — this is a SQL↔TS mirrored rule of the same class as the
  condition evaluator (Rule 3) and `deriveUserStatus`. One authority, two call sites.
- **`cpf` is column-locked from `authenticated`** (ADR D7, audit HIGH-1): the row
  policies admit co-commission members, so a plain column would hand every colleague a
  national-ID read via PostgREST `select=cpf`. Mechanism — a table-level grant covers
  new columns automatically, so this **converts `profiles` to column-list grants** (the
  `case_referral` pattern): revoke table-level SELECT/INSERT/UPDATE from `authenticated`,
  re-grant explicit column lists **excluding `cpf`**. ⚠ From then on **every new
  `profiles` column needs its own GRANT or reads 42501** — the standing `case_referral`
  lesson now applies to `profiles`. All CPF reads/writes go through the action layer
  (service client) + DEFINER doors; the account page surfaces the person's own CPF via a
  server action.
- `cpf` **joins the service-role-locked set** in `guard_profile_privileged_columns`
  (binding, per ADR D7/D14) — it is an identity key, and person-level fields are out of
  a hospital admin's reach.

### T1.3 — Drop `profiles.home_hospital_id` and `profiles.hospital_employee_id`

Not a column drop — a refactor. Enumerate the call sites **from the live catalog and a
repo grep**, not from this list, which is orientation only:

- `profiles_admin_select` and `profiles_select_self_or_admin` (both carry a
  `home_hospital_id` leg — replaced by T2.3's affiliation leg).
- ⚠ **`guard_profile_privileged_columns`** (audit MEDIUM-1) — the trigger compares
  `new.home_hospital_id` / `new.hospital_employee_id`. plpgsql is late-bound: the DROP
  **succeeds**, then **every later `profiles` UPDATE fails 42703 at runtime**. Rewrite
  the trigger **in the same migration**, regenerated from live `pg_get_functiondef`
  (standing trap), adding `cpf` to its identity set (T1.2).
- ⚠ **The customer demo seed** — `supabase/demo/seed-revisao-prontuario.sql:215` sets
  `home_hospital_id`. It is applied manually, excluded from `config.toml` `sql_paths`,
  and **in no gate and no other task's scope** (the TV union-of-scoped-sweeps lesson).
  Owner: `backend`, this task.
- `registerUser`'s hospital-admin arm (`src/lib/users/actions.ts` ~:314–342) — the
  server hard-set of `homeHospitalId` becomes "create an affiliation" — and its
  manage-permission check (~:177–200), which reads `home_hospital_id` today.
- `updateUserProfile`'s validated write (~:568, `// home_hospital_id MUST be one the
  caller administers`).
- `listHospitalUsers` (`src/lib/queries/org-users.ts` ~:130) — becomes affiliation-derived.
- ⚠ `src/lib/queries/org.ts` ~:199 — the hospital user-count **embed string**
  `profiles!profiles_home_hospital_id_fkey(count)`: a `.select()` string **typechecks
  after the drop and fails only at runtime** (the TV dropped-column mechanism). Becomes
  an affiliation count.
- The `?hospital=` deep-link plumbing of ADR 0051 D7 (`usuarios/page.tsx` ~:77–80), and
  the form components `register-user-form.tsx` / `user-profile-edit-form.tsx`
  (frontend-owned — hand off as part of the W2→W3 contract).
- Test surfaces (owners: `backend` for pgTAP, `tester` for E2E): pgTAP `180`/`188` and
  `e2e/hospital-admin-tier.spec.ts` all reference the doomed columns/flows.

⚠ `home_organization_id` is **NOT** touched — it is the tenancy anchor (ADR 0048 D6,
`profiles_tenant_has_org_trg`) and the filter of every org-scoped read.

### T1.4 — `professional_profiles.cpf`

Nullable column + the same digits-only/check-digit treatment. **Column only** — no
matching behaviour, no linking (ADR 0097 D15). Do not touch `link_state`, and do not
enter FUP-ETH-1's unbuilt `participants` / `professional_participants` writers.

### T1.5 — pgTAP for W1

CPF uniqueness; check-digit rejection; affiliation partial-unique (two active rows for one
pair fail, an ended row + a new active row succeed); the composite FK rejecting a hospital
from another org; `authenticated` holds no DML grant on `hospital_affiliations`;
**`authenticated` selecting `cpf` on `profiles` is DENIED (42501)** while selecting the
granted columns still succeeds — both arms, so the column-list conversion can't silently
over- or under-shoot; a `profiles` UPDATE still succeeds post-drop (pins the
`guard_profile_privileged_columns` rewrite).

---

## W2 — Doors, visibility & the dominance grid

**Goal:** the right people can see each other, through gates something actually tests.

### T2.1 — `affiliate_person` / `end_affiliation` (DEFINER doors)

- `authenticated`-executable; `REVOKE ALL FROM PUBLIC` before `GRANT` (the dashboard t19
  pgTAP guard fails otherwise — a standing trap on every new `public.*` RPC).
- Authority: `app.is_hospital_admin_of(p_hospital) OR app.is_org_admin_of(<hospital's org>)`.
- **Tenant check:** hard-fail when `profiles.home_organization_id ≠ the hospital's org`
  (`42501`). Fix the same missing check in `resolveOrInviteUser`
  (`src/lib/members/invite.ts:50` — its existing-user branch does **no** org check today,
  so `assignStaffAdmin` / `assignOrgAdmin` can bind a foreign-org identity) in this task.
- **Self-affiliation is ALLOWED** — say so in the function comment with the reason
  (confers no capability; an admin absent from their own roster is a bug), so a later
  "consistency" edit does not add a self-grant guard by analogy with `grant_role_impl`.
- `end_affiliation` **refuses** while the principal holds active memberships of **ANY
  tier** under that hospital — commission seats **and** hospital-tier seats
  (`hospital_admin`, `technical_director`, `technical_director_deputy`,
  `nsp_coordinator`, `pqs_member`) — returning the blocking memberships (D5, audit
  MEDIUM-3: a commission-only check orphans a sitting technical director's seat).
  Dedicated error code. Commission rows resolve to the hospital via
  `commissions.hospital_id`; hospital-tier rows carry `hospital_id` directly
  (`memberships_scope_shape`).

### T2.2 — `list_org_people(p_org_id, p_search, p_cpf)`

- DEFINER, `authenticated`, gated `app.is_org_admin_of(p_org_id)` **OR an inline
  predicate: the caller holds an active `hospital_admin` membership in `p_org_id`**.
  ⚠ **NOT `app.is_org_level_admin_within`** (audit MEDIUM-5/MINOR-1): that helper also
  admits `nsp_org_admin` (an undebated disclosure) and is load-bearing today as a leg of
  `organizations_select` — do not borrow or edit it. Returns **empty**, never raises, on
  an unauthorized caller — matching `list_addable_commission_members`, so a probe cannot
  distinguish "no results" from "not allowed".
- Payload: `user_id, full_name, email, professional_category, affiliations[]` (same-org
  hospital names only). **`cpf` is NEVER in the payload** (D11).
- `p_cpf` is **exact-match only**, full length; `p_search` matches name/email partially.
  Server-side — do not repeat `list_addable_commission_members`' pattern of shipping the
  roster and filtering client-side (its TS caller passes no `p_search` at all today;
  tolerable for names at 150 users, unacceptable for national IDs).
- **Every CPF-parameterized call emits an audit row** (Rule 11, ADR D11, audit LOW-2):
  actor, org, matched-or-not (matched `user_id` when it did) — **never the CPF digits**.
  Name/email searches do not emit (parity with the existing directory door).

### T2.3 — Widen `profiles` SELECT

Two new legs, replacing the inert `home_hospital_id` leg:

- **affiliation** — an active `hospital_affiliations` row for a hospital I administer;
- **membership** — the principal holds any membership (any tier) under a hospital I
  administer. This closes the 6-dangling-`principal_id` defect (ADR 0097 finding 3)
  independently of Dr. John.

⚠ This is a **security widening**. It requires a diff-scoped `ARM=policy` door run and
keystones carrying **both** ALLOW and DENY arms — the DENY arm being a **sibling
hospital's admin in the same org**, which is the tenant-isolation case that matters.

### T2.4 — The dominance grid + the two live gaps

- **Grid:** read gates from `pg_policies` + `pg_proc.prosrc`; assert every gate admitting
  `is_hospital_admin_of` also admits `is_org_admin_of`, with an explicit, commented
  allowlist. Mechanically the ADR-0094 role-completeness grid (`291`/`292`/`293`).
  ⚠ A regex census produced **1 false positive in 3** (`list_approver_candidates` reaches
  org_admin via `is_commission_admin_of`) — the grid must resolve helper transitivity or
  allowlist explicitly, never match on surface text alone.
- **Fix `set_standard_ownership`** — `if not app.is_hospital_admin_of(p_hospital)` gains
  an `OR app.is_org_admin_of(<org>)` arm.
- **Fix `standard_ownerships_select`** — same, so an org_admin without a commission
  membership is not denied.
- Ship the grid **green**, not red.

### T2.5 — `grant_role_impl`: the `hospital_admin` arm (ADR D17, audit BLOCKER-1)

The `hospital_admin` branch gains `app.is_admin_for(p_actor)`, symmetric with the
`org_admin` branch. **Without this, T3.4 is impossible** — verified live: the branch
requires `is_org_admin_of_for(org, p_actor)` only, so the provisioning platform admin is
denied 42501, and the new org_admin self-granting hits the self-grant guard. Rules:

- **Regenerate the body from live `pg_get_functiondef`** (standing trap — the function
  has been patched at runtime before; migration text is stale by design).
- `CREATE OR REPLACE`, never `DROP`+`CREATE` — a rebuild is a privilege reset
  (recorded lesson), and the parameter list must not change.
- Touch **only** the `hospital_admin` branch. The `technical_director` branch keeps its
  deliberate no-`is_admin_for` posture (its header comment says why); the self-grant
  guard is untouched.
- This changes a `prosecdef` boolean gate ⇒ it is **in scope for the diff-scoped
  `ARM=policy` run** (Phase Gate step 1).

### T2.6 — pgTAP for W2

Each with ALLOW **and** DENY arms: the affiliate door (A's admin → A ✓; → B ✗; a person
anchored to another org ✗; self ✓); `end_affiliation` refused with active memberships —
**one commission-tier blocker AND one hospital-tier blocker (a technical_director)**,
plus succeeds once the seats are vacated; `list_org_people` (org_admin ✓ / hospital
admin ✓ / **`nsp_org_admin` empty** — pins the MEDIUM-5 narrowing / plain `staff` empty /
cross-org empty); the CPF-lookup **audit row exists after a `p_cpf` call and carries no
CPF digits**; `profiles` SELECT via affiliation (A's admin sees an affiliated-only person
at A ✓; does **not** see a B-only person ✗); **T2.5**: platform admin seats
`hospital_admin` via `grant_role_for` ✓, platform admin still **cannot** seat
`technical_director` ✗, a plain org member still cannot seat `hospital_admin` ✗;
`professional_credentials` unique violation surfaces as a handled error, not a raw
`23505`. Keystones must be mutation-proven (revert → red), per the standing traps.

---

## W3 — Product surfaces

### T3.1 — Identifier-first registration (`/o/[org]/manage/usuarios/novo`)

One flow, four outcomes (D12): not found → the existing create form; found in my org,
unaffiliated → *"Dr. John Silva já está cadastrado em Rede A (Hospital Regional). Vincular
ao Hospital Municipal?"*; found and already affiliated → link to their user page;
identifier collides outside my org → the existing pt-BR block. `registerUser` keeps its
hard collision block **unchanged** as the backstop and the race guard.

### T3.2 — Hospital roster derived from affiliations

`listHospitalUsers` returns affiliations ∪ commission-memberships-under-hospital. A person
affiliated with **zero** committees must appear — that is the whole point of D2.

### T3.3 — Affiliation management + field ownership

Affiliation rows editable by that hospital's admin (matrícula, dates, end). **Person-level
fields — name, CPF, professional category, credentials — are `org_admin`-only** (D14),
enforced server-side, not by hiding controls (Rule 1). Removal by a hospital admin scoped
to their own hospital's subtree; **account deactivation unreachable by hospital admins**.

### T3.4 — Single-hospital provisioning

When an organization is created with exactly one hospital, provisioning seats the first
administrator as **both** `org_admin` and `hospital_admin`, via `grant_role_for` with
`p_actor` = the provisioning platform admin. **DEPENDS ON T2.5** (audit BLOCKER-1):
until the `hospital_admin` branch carries the `is_admin_for` arm, the platform admin is
denied 42501 on the hospital grant and **no working path exists** — an earlier draft of
this task shipped that dead path, having probed only the self-grant hazard.
⚠ The self-grant probe stands: `grant_role_for(X, 'hospital', h, 'hospital_admin',
p_actor := X)` raises *"não é permitido conceder acesso a si mesmo"* (42501) — the guard
is inlined precisely so it fires on the service path. Pass a **different** actor (the
platform admin); do not weaken the guard.

### T3.5 — Seed: **Rede C**

One org, one hospital, one person holding `org_admin` + `hospital_admin`. Plus, in Rede A:
a professional affiliated to **two** hospitals and on a committee at each (Dr. John), and
a person **affiliated with no committee** — the second pins D2's entire premise and
without it the feature can regress green. Also add the **`org_admin` persona missing from
the pgTAP bootstrap** (FUP-PCITV-1 row 6 — its absence leaves the `is_commission_admin_of`
disjunct of six existing isolation keystones unexercised).

⚠ **`seed.sql` is a contract with ~900 pgTAP tests + E2E** (audit INFO-2). Adding an org,
personas, and affiliation rows **will move existing counting keystones** — the very
constants ADR 0097 cites (21/34 memberships, 13/30 profiles, 6 dangling) are the kind of
number baked into them. Budget for updating those tests; **do not clamp the new fixtures
to preserve old counts** (the shared-fixture pigeonhole lesson — fix the spec that owns
the assumption).

### T3.6 — E2E

The Dr. John path end to end (search by CPF → vincular → add to a Municipal committee);
brand-new registration at Municipal appearing in the roster with zero committees; the
negative (Regional's admin cannot see a Municipal-only person); one **keyboard-only** pass
over the identifier-first flow (§8).

---

## Phase Gate (CLAUDE.md §6)

1. Build complete · lint (0 warnings) · typecheck · Vitest · **`npm run test:db` on a
   fresh `supabase db reset`** · `npm run lint:memberships-door`.
   **Authz:** `ARM=census` **and** `ARM=floor`, plus a **diff-scoped `ARM=policy`** over
   exactly the changed policies, the changed `prosecdef` gates (T2.5's `grant_role_impl`
   arm included) and the new doors — derived from the migration diff, never by
   hand (ADR 0079 Amendment 1). BLIND blocks; `ERROR` is not a pass. Afterwards
   `git checkout -- docs/reviews/authz-door-audit-findings.md`.
2. `tester` writes the T3.6 specs; declare green via **`npm run e2e:prod`**.
3. `qa` writes `docs/reviews/aff-review.md`.
4. Human approval.
5. Record — PROGRESS.md, `docs/backend-state.md` (new table, two doors, widened policy,
   dropped columns, the dominance grid), commit. Name the **ARM**, never the script.

## Standing traps for this workstream

- **The catalog is truth.** Not this plan, not the migrations, not graphify (which does
  not index SQL at all). `prosecdef` belongs beside `pg_policies` — this workstream ships
  two DEFINER doors that are deliberately **wider** than the table policies.
- **Every new `public.*` RPC needs `REVOKE ALL FROM PUBLIC` before `GRANT`**, or the
  dashboard t19 guard fails.
- **A migration that create-or-replaces an existing function must regenerate its body from
  live `pg_get_functiondef`**, not from migration text, or it silently reverts intervening
  patches. T1.3 and T2.4 both rewrite existing objects.
- **`ARM=census` is the arm that catches a gate you just added** — a brand-new door is in
  no BLIND set and passes `ARM=policy` vacuously.
- **Keystones must be mutation-proven.** Revert the fix and watch them go red; a keystone
  that cannot fail proved nothing (ADR 0078: review found 0 of 7, reverting found all 7).
- **Do not hardcode seed `gen_random_uuid()` ids** in the new keystones — they go green on
  the authoring reset and red on every fresh one, and the mutation audit is blind to it.
- **Teammates do not run `graphify update`.** The lead refreshes once, after merge.
