# Plan — AFF: hospital affiliation, person identity & the org people directory (ADR 0097)

**Status:** PROPOSED — not started. Awaiting human approval of ADR
[0097](../decisions/0097-hospital-affiliation-person-identity.md).
**Authority notes:** this plan is **NOT authoritative on the substrate**. Every
schema / RLS / RPC claim below was catalog-verified on 2026-08-05 and must be
**re-verified against the live catalog at build time** (ADR 0078 A28 — migration file
text is stale by design; graphify does not index SQL). Before any workstream starts, the
assigned teammates read [authz-handoff §7](../progress/authz-handoff.md) and the
*Standing traps* section at the foot of this plan.

## Why now

The *feature* is not urgent — the first customer is 5 hospitals / ~150 professionals with
a small multi-hospital fraction, and no bulk import. The *schema* is: a new table, two
dropped columns, a new unique column, a widened policy and two new doors are free while
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
  door). SELECT policy mirrors the widened `profiles` legs (T2.3) so the two never drift.
- Audit trigger emitting `affiliation.created` / `affiliation.ended` (Rule 11).

### T1.2 — `profiles.cpf`

- `cpf text NULL`, **unique platform-wide** (partial unique `WHERE cpf IS NOT NULL`,
  mirroring `profiles_email_key`'s shape). Nullable in schema, **required at the action
  layer** (D7) — the documented escape for a foreign professional.
- Stored digits-only; check digits validated in **both** SQL (a `CHECK` or a domain) and
  TS, and the two must agree — this is a SQL↔TS mirrored rule of the same class as the
  condition evaluator (Rule 3) and `deriveUserStatus`. One authority, two call sites.
- `guard_profile_privileged_columns` must be re-examined: decide whether `cpf` joins the
  service-role-locked set. **Recommendation: yes** — it is an identity key, and D14 puts
  person-level fields out of a hospital admin's reach.

### T1.3 — Drop `profiles.home_hospital_id` and `profiles.hospital_employee_id`

Not a column drop — a refactor. Enumerate the call sites **from the live catalog and a
repo grep**, not from this list, which is orientation only:

- `profiles_admin_select` and `profiles_select_self_or_admin` (both carry a
  `home_hospital_id` leg — replaced by T2.3's affiliation leg).
- `registerUser`'s hospital-admin arm (`src/lib/users/actions.ts` ~:314–342) — the
  server hard-set of `homeHospitalId` becomes "create an affiliation".
- `updateUserProfile`'s validated write (~:568, `// home_hospital_id MUST be one the
  caller administers`).
- `listHospitalUsers` (`src/lib/queries/org-users.ts` ~:130) — becomes affiliation-derived.
- The `?hospital=` deep-link plumbing of ADR 0051 D7 (`usuarios/page.tsx` ~:77–80).

⚠ `home_organization_id` is **NOT** touched — it is the tenancy anchor (ADR 0048 D6,
`profiles_tenant_has_org_trg`) and the filter of every org-scoped read.

### T1.4 — `professional_profiles.cpf`

Nullable column + the same digits-only/check-digit treatment. **Column only** — no
matching behaviour, no linking (ADR 0097 D15). Do not touch `link_state`, and do not
enter FUP-ETH-1's unbuilt `participants` / `professional_participants` writers.

### T1.5 — pgTAP for W1

CPF uniqueness; check-digit rejection; affiliation partial-unique (two active rows for one
pair fail, an ended row + a new active row succeed); the composite FK rejecting a hospital
from another org; `authenticated` holds no DML grant on `hospital_affiliations`.

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
- `end_affiliation` **refuses** while the principal holds active commission memberships
  under that hospital, returning the blocking commissions (D5). Dedicated error code.

### T2.2 — `list_org_people(p_org_id, p_search, p_cpf)`

- DEFINER, `authenticated`, gated `app.is_org_admin_of(p_org_id) OR
  app.is_org_level_admin_within(p_org_id)`. Returns **empty**, never raises, on an
  unauthorized caller — matching `list_addable_commission_members`, so a probe cannot
  distinguish "no results" from "not allowed".
- Payload: `user_id, full_name, email, professional_category, affiliations[]` (same-org
  hospital names only). **`cpf` is NEVER in the payload** (D11).
- `p_cpf` is **exact-match only**, full length; `p_search` matches name/email partially.
  Server-side — do not repeat `list_addable_commission_members`' pattern of shipping the
  roster and filtering client-side (its TS caller passes no `p_search` at all today;
  tolerable for names at 150 users, unacceptable for national IDs).

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

### T2.5 — pgTAP for W2

Each with ALLOW **and** DENY arms: the affiliate door (A's admin → A ✓; → B ✗; a person
anchored to another org ✗; self ✓); `end_affiliation` refused with active memberships;
`list_org_people` (hospital admin ✓ / plain `staff` empty / cross-org empty);
`profiles` SELECT via affiliation (A's admin sees an affiliated-only person at A ✓; does
**not** see a B-only person ✗); `professional_credentials` unique violation surfaces as a
handled error, not a raw `23505`.

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
`p_actor` = the provisioning platform admin. ⚠ Verified live: `grant_role_for(X, 'hospital',
h, 'hospital_admin', p_actor := X)` raises *"não é permitido conceder acesso a si mesmo"*
(42501) — the guard is inlined precisely so it fires on the service path. Pass a
**different** actor; do not weaken the guard.

### T3.5 — Seed: **Rede C**

One org, one hospital, one person holding `org_admin` + `hospital_admin`. Plus, in Rede A:
a professional affiliated to **two** hospitals and on a committee at each (Dr. John), and
a person **affiliated with no committee** — the second pins D2's entire premise and
without it the feature can regress green. Also add the **`org_admin` persona missing from
the pgTAP bootstrap** (FUP-PCITV-1 row 6 — its absence leaves the `is_commission_admin_of`
disjunct of six existing isolation keystones unexercised).

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
   exactly the changed policies and new doors — derived from the migration diff, never by
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
