# MEM — Single `memberships` Collapse (external audit §6.1)

**Status:** 📝 Design spec (S0 gate) — **no migration, no app code** until lead + human sign-off of the
S0 ratification record. · **Date:** 2026-07-13 · **Owner:** `backend`.
**Track:** MEM (stage S1) of the [Pre-Pilot Release Scope Expansion](./pre-pilot-release-scope-expansion.md)
(ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); ratified spine
[pre-pilot-release-s0-ratification.md](./pre-pilot-release-s0-ratification.md).
**Source finding:** [external DB audit §6.1](../reviews/external-db-audit-2026-07.md) (+ §3 complexity verdict).
**Finishes:** the WS-1 [membership write-path lockdown](./membership-write-path-lockdown.md) — this is the
**storage-shape** completion of WS-1's §6.1-minimum, **not** a security-model rewrite (WS-1 was built
forward-compatible; its door/audit contracts carry over verbatim — WS-1 §"Forward compatibility").

> **Binding rules.** Rule 1 (RLS is the boundary), Rule 8 (regen types after every migration), Rule 10
> (pt-BR UI / English code), Rule 11 (audit — role + scope + who, never PHI/payloads). ARCHITECTURE.md
> App-A **polymorphism dialect 1** (named-FK + shape CHECK — **never** a bare `scope_id`; ADR 0065).
> **No feature flag** (structural). **Reset-OK** drop-and-recreate; forward-only; migration window
> **`20260720000000+`** (latest shipped `20260719000800`). SQLSTATE block **`HC0G0–HC0G9`**
> (S0 §B; high-water `HC099`).

---

## 0. Goal & posture

Collapse the **three role-carrying tables** — `organization_members`, `commission_members`, `pqs_members` —
into one audited `public.memberships` table written **only** through one `grant_role()` / `revoke_role()`
`SECURITY DEFINER` door, read through **one** `has_role(scope_type, scope_id, role)` predicate family. The
~30 `app.is_*_of` predicates become **thin wrappers** over `has_role()` so the **~145 call-sites and ~87
policies compile verbatim** (X-β). This makes audit findings **C-3 / C-4 / H-6 / H-7 structurally
impossible** rather than individually patched, collapses the drifted predicate sprawl, and gives the RLS
planner **one indexable shape** instead of three.

**`case_access` is KEPT SEPARATE** (PO decision — S0 §F.2, plan §7.4). It is **not** a role table: it carries
`level ∈ {read,write}` / `granted_by` / `granted_at` (and the plan's `expires_at`/`reason` involvement ACL),
a richer **per-case involvement** grant than a role. The audit's §6.1 listed it as a *fold candidate*
("(+ the ad-hoc `case_access`)"), but folding it would force a role vocabulary onto a per-object ACL and lose
`level`. **We reconcile the audit here: collapse the three role tables only; `case_access` stays the per-case
involvement plane, sitting unchanged on top of the new predicate family.** (See §9 Open-decision O-1 for the
`case_id`-on-`memberships` question this raises.)

**Invariants that MUST hold (regression-guard — these are the WS-1 invariants carried VERBATIM):**
- **No direct write path on the membership storage.** No `INSERT/UPDATE/DELETE` policy; the `authenticated`
  role holds **no** DML grant. A direct PostgREST `POST/PATCH/DELETE` on the table → **401/403**.
- **Self-grant raises** (`app._deny_self_grant`) on **every** write path.
- **Every** grant / revoke / role-change is audited (role + scope + who + when only — never PHI).
- **Anti-lockout:** `revoke_role()` refuses to remove the org's **last `org_admin`** (HC081 semantics,
  re-homed to `HC0G1`).
- **Flag-OFF fallback:** N/A — MEM has no flag; behavior parity is proven by the full pgTAP + full E2E suites
  passing byte-for-byte (the risk is a **missed predicate**, caught by negatives — §6).

---

## 1. Current state (verified 2026-07-13 — the three tables being collapsed)

| Table | Columns (generated types) | Role vocabulary | Scope column(s) | Write posture today |
|---|---|---|---|---|
| `organization_members` | `id, organization_id, hospital_id?, user_id, role, created_at` | `org_admin`, `nsp_org_admin`, `hospital_admin`, `nsp_coordinator` | `organization_id` (always) + `hospital_id` **iff** role ∈ {`hospital_admin`,`nsp_coordinator`} | **WS-1 LOCKED** — no write policy, DML revoked, DEFINER doors, blanket audit `organization_member.*`, HC081 anti-lockout |
| `commission_members` | `id, commission_id, user_id, role, title_id?, created_at` | `staff_admin`, `staff` | `commission_id` | **NOT locked** — `FOR ALL` write RLS (`commission_members_admin_all` org-admin; `commission_members_staff_admin_update` role-pinned) + direct grant; audited `commission_member.*` (`audit_commission_members_trg`) |
| `pqs_members` | `hospital_id, user_id, added_by?, added_at` (**no `id`, no `role`**) | *implicit* — enrollment **is** the role | `hospital_id` (composite PK `(hospital_id, user_id)`) | **WS-1 LOCKED** — zero-policy DEFINER-door, DML revoked, blanket audit `pqs_member.*`, self-exclusion in `add_pqs_member` |

**Consequence for the collapse:**
- **`pqs_members` has no `role` column** — enrollment is the grant. The collapse **mints a synthetic
  `role='pqs_member'`** scoped to `hospital_id`. (Chosen name; `is_pqs_member_of` becomes
  `has_role('hospital', h, 'pqs_member')`.)
- **`commission_members` is NOT WS-1-locked today** — collapsing it into the locked table **forces its
  writes behind the door**, changing `addStaff`/`removeStaff` from direct `commission_members` writes to
  `grant_role`/`revoke_role` RPC calls. This is a real contract change WS-1 deliberately deferred (WS-1
  §Scope marked `commission_members` "Optional / lower priority … route through the door only if we want full
  uniformity"). MEM **does** take it — collapse into a single table means a single write posture (§9 O-2).
- **`commission_members.title_id`** (display-only committee-title FK, ADR 0051) is commission-membership
  metadata with **zero RLS semantics**. It has no analogue on org/pqs rows. **Decision:** keep it as a
  **nullable `title_id`** column on `memberships`, legal only on the `commission`-scope shape (shape CHECK
  §2.1). (§9 O-3 records the alternative — a side table — and why inline wins here.)

### The predicate family to collapse (35 `app.is_*` functions; source-verified)

Grouped by how they map onto `has_role()`. **Bare + `_for(scope, uid)` pairs**: the bare form already
delegates to `_for(..., auth.uid())`, so the collapse rewrites the `_for` body to call `has_role(...)` and
the bare form is unchanged (still delegates to its `_for`). `is_active(uid)` is an orthogonal `profiles`
lookup and **stays** inside each wrapper exactly where it is today.

**A · Direct single-role wrappers → `has_role(scope_type, scope_id, role)` 1:1** (these become one-line
wrappers; the ~145 call-sites keep calling them):

| Wrapper (survives) | Collapses to |
|---|---|
| `is_member_of(commission)` / `_for` | `is_active(uid) AND has_role('commission', commission, any)` — membership = **any** commission role (staff ∪ staff_admin) |
| `is_staff_admin_of(commission)` / `_for` | `is_active(uid) AND has_role('commission', commission, 'staff_admin')` |
| `is_org_admin_of(org)` / `_for` | `is_active(uid) AND has_role('organization', org, 'org_admin')` |
| `is_hospital_admin_of(hospital)` / `_for` | `is_active(uid) AND has_role('hospital', hospital, 'hospital_admin')` |
| `is_nsp_org_admin_of(org)` / `_for` | `is_active(uid) AND has_role('organization', org, 'nsp_org_admin')` |
| `is_nsp_coordinator_of(hospital)` / `_for` | `is_active(uid) AND has_role('hospital', hospital, 'nsp_coordinator')` |
| `is_pqs_member_of(hospital)` / `_for` | `is_active(uid) AND has_role('hospital', hospital, 'pqs_member')` |

**B · Composed / derived wrappers → OR / join over `has_role()`** (stay as compositions; internally call
`has_role`, never re-query a table):

| Wrapper (survives) | Collapses to |
|---|---|
| `is_pqs_operator_of(hospital)` / `_for` | `is_nsp_coordinator_of_for(h,u) OR is_pqs_member_of_for(h,u)` (verbatim — already DRY over the two A-wrappers) |
| `is_pqs_writer_of(hospital)` | `is_pqs_operator_of(hospital)` (bare alias — unchanged) |
| `is_commission_admin_of(commission)` / `_for` | `is_org_admin_of_commission_for(c,u) OR is_hospital_admin_of_for(hospital_of_commission(c), u)` (unchanged shape; leaves resolve through A-wrappers) |
| `is_org_admin_of_commission(commission)` / `_for` | org_admin resolved via the `commissions → org` join, then `has_role('organization', org, 'org_admin')` |
| `is_org_level_admin_within(org)` | org_admin/hospital_admin/nsp_org_admin of the org **holding no commission membership** — recomposed over `has_role` + the `is_org_member` negative |
| `is_org_member(org)` | any commission membership within the org → EXISTS join `commissions × has_role('commission', …, any)` |
| `is_pqs_operator_in_org(org)` / `_for` | member-of-any-hospital-roster ∪ nsp_coordinator-of-any-hospital, both via `has_role` over the org's hospitals (nav-only, PHI-free) |
| `is_pqs_member_of_any(uid)` | `is_active(uid) AND EXISTS(has_role('hospital', any, 'pqs_member'))` |
| `is_hospital_member_of(hospital)` | (verify at build — hospital-tier membership probe; recompose over `has_role`) |

**C · NOT role-membership — UNTOUCHED** (do not become wrappers; they read the JWT / `profiles` / approval
rows / validate config): `is_admin` (JWT claim + `profiles.is_admin` fallback), `is_active`, `is_org_member`
already listed, `is_document_approver_of` / `is_document_version_approver` / `is_entitled_document_approver`
(approval-row-derived), `is_valid_condition` / `is_valid_flagged_when` / `is_valid_recommend_cond`
(config validators).

> **Wrapper list to hand `frontend`/downstream (the X-β guarantee — these names survive verbatim):**
> `is_member_of`, `is_member_of_for`, `is_staff_admin_of`, `is_staff_admin_of_for`, `is_org_admin_of`,
> `is_org_admin_of_for`, `is_org_admin_of_commission`, `is_org_admin_of_commission_for`,
> `is_hospital_admin_of`, `is_hospital_admin_of_for`, `is_commission_admin_of`, `is_commission_admin_of_for`,
> `is_org_level_admin_within`, `is_org_member`, `is_hospital_member_of`, `is_nsp_org_admin_of`,
> `is_nsp_org_admin_of_for`, `is_nsp_coordinator_of`, `is_nsp_coordinator_of_for`, `is_pqs_member_of`,
> `is_pqs_member_of_for`, `is_pqs_member_of_any`, `is_pqs_operator_of`, `is_pqs_operator_of_for`,
> `is_pqs_writer_of`, `is_pqs_operator_in_org`, `is_pqs_operator_in_org_for`. **(27 names — the full `_of`/
> `_for` set; every one keeps its exact signature and owner=`postgres` + `search_path` pin.)**

---

## 2. Canonical contract (BACKEND posts these typed stubs FIRST — §5 sequencing)

### 2.1 Data model — `public.memberships` (dialect-1: column-per-scope + discriminated shape CHECK)

```sql
create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  principal_id    uuid not null references public.profiles(id) on delete cascade,
  -- column-per-scope (dialect 1 — NEVER a bare polymorphic scope_id; ADR 0065 App-A):
  organization_id uuid references public.organizations(id) on delete cascade,
  hospital_id     uuid references public.hospitals(id)      on delete cascade,
  commission_id   uuid references public.commissions(id)    on delete cascade,
  -- case_id: DEFERRED / not added (O-1) — no role scopes to a case; case_access stays separate.
  role            text not null,
  title_id        uuid references public.commission_member_titles(id) on delete set null, -- commission-scope only (O-3)
  granted_by      uuid references public.profiles(id),
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz,               -- reserved (WS-1 expiring-grant reminder / N; NULL = permanent)

  -- (a) role ∈ the union vocabulary
  constraint memberships_role_check check (role = any (array[
    'org_admin','nsp_org_admin','hospital_admin','nsp_coordinator',  -- organization/hospital tier
    'staff_admin','staff',                                           -- commission tier
    'pqs_member'                                                     -- synthetic (pqs_members enrollment)
  ])),

  -- (b) DISCRIMINATED SHAPE CHECK — exactly the scope columns each role legally carries.
  --     Mirrors the organization_members hospital_id-iff-role CHECK (ADR 0051/0052), generalized.
  constraint memberships_scope_shape check (
    case role
      -- organization-tier: org set, hospital+commission null
      when 'org_admin'       then organization_id is not null and hospital_id is null and commission_id is null
      when 'nsp_org_admin'   then organization_id is not null and hospital_id is null and commission_id is null
      -- hospital-tier: org+hospital set (org denormalized for the audit chain + fast org rollups), commission null
      when 'hospital_admin'  then organization_id is not null and hospital_id is not null and commission_id is null
      when 'nsp_coordinator' then organization_id is not null and hospital_id is not null and commission_id is null
      when 'pqs_member'      then organization_id is not null and hospital_id is not null and commission_id is null
      -- commission-tier: commission set, org+hospital null (resolve up via commissions FK when needed)
      when 'staff_admin'     then commission_id is not null and organization_id is null and hospital_id is null
      when 'staff'           then commission_id is not null and organization_id is null and hospital_id is null
      else false   -- unknown role rejected (belt with (a))
    end
  ),

  -- (c) title_id legal ONLY on commission-scope rows (O-3)
  constraint memberships_title_scope check (title_id is null or commission_id is not null)
);

-- One grant per (principal, exact scope, role). NULLS NOT DISTINCT so the org/commission
-- NULL columns collapse to one logical key (matches organization_members' Phase-A unique).
create unique index memberships_grant_uq on public.memberships
  using btree (principal_id, role, organization_id, hospital_id, commission_id)
  nulls not distinct;

-- Hot RLS-predicate indexes (replace the 3 tables' per-table indexes; audit §4 RLS-perf):
create index memberships_commission_idx   on public.memberships (commission_id, principal_id) where commission_id is not null;
create index memberships_hospital_idx     on public.memberships (hospital_id, principal_id, role) where hospital_id is not null;
create index memberships_organization_idx on public.memberships (organization_id, principal_id, role) where organization_id is not null;
create index memberships_principal_idx    on public.memberships (principal_id);
```

**Notes on the shape.**
- **`organization_id` is denormalized onto hospital- and commission-*tier* rows?** — NO for commission rows
  (commission resolves its org via the `commissions` FK; denormalizing would reintroduce the H-desync the
  audit flags). It **is** carried on hospital-tier rows because `organization_members` already carries it and
  the audit chain + `is_pqs_operator_in_org` rollups read it without a join. (§9 O-4 flags the consistency
  question for the reviewer — keep the org column exactly where `organization_members` had it, no wider.)
- **`created_at` → `granted_at`.** The three tables use `created_at`/`added_at`; the audit recommendation
  names `granted_at`. We adopt `granted_at` + add `granted_by` uniformly (today only `pqs_members.added_by`
  and nothing on the others carry the grantor — this is a **capability gain**, feeding H-6 forensics).

### 2.2 Predicate family (`app` schema, DEFINER, `search_path`-pinned, owner=postgres)

```sql
-- The ONE source of role-membership truth. Every is_*_of wrapper delegates here.
create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app','public','pg_catalog' as $$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and m.role = p_role
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  );
$$;
-- + a 3-arg convenience overload has_role(scope_type, scope_id, role) := has_role(..., auth.uid()).
-- + a "membership = ANY role in scope" arm for is_member_of: has_role_any(scope_type, scope_id, uid)
--   (EXISTS without the role filter) — is_member_of/_for delegate to it.
```

- **`is_active` stays in the WRAPPERS, not in `has_role`.** `has_role` answers "does a live grant exist";
  the wrappers keep `is_active(uid) AND has_role(...)` exactly as today, so the `is_active` fold (audit §4
  perf note) is unchanged and no predicate silently drops the active check.
- **`expires_at` filter** is inert until a grant sets it (WS-1 expiring-grant reminder / N consumer); `NULL`
  = permanent = today's behavior. Guard with a pgTAP that an unset `expires_at` never filters.

### 2.3 Write door (one pair; `SECURITY DEFINER`; the SOLE write path — mirrors WS-1)

```sql
public.grant_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid,
                  p_title_id uuid default null) returns void
public.revoke_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid) returns void
```

Both, on **every** path (WS-1 contracts carried verbatim):
1. **Authority check** — role-specific, reusing the existing predicates (so no new authority model):
   - `org_admin` / `nsp_org_admin` grant/revoke: `is_admin() OR is_org_admin_of(org)` (the `assign_org_admin`
     authority, generalized).
   - `hospital_admin`: `is_admin() OR is_org_admin_of(org_of_hospital)` (the `assign_hospital_admin`
     authority).
   - `nsp_coordinator`: `is_nsp_org_admin_of(org_of_hospital)` (the `assign_nsp_coordinator` authority — NB
     hospital_admin has NO NSP power, ADR 0052 decision 3).
   - `pqs_member`: `is_nsp_org_admin_of(org_of_hospital) OR is_nsp_coordinator_of(hospital)` (the
     `add_pqs_member` authority).
   - `staff_admin` / `staff`: `is_staff_admin_of(commission) OR is_commission_admin_of(commission)` (the
     current `addStaff` authority — `commission_members_admin_all` ∪ staff_admin; **staff cannot self-escalate
     to staff_admin** — the `commission_members_staff_admin_update` role-pin becomes an in-door check).
   - Unknown `(scope_type, role)` combo → **`HC0G0`** (invalid scope/role).
2. `perform app._deny_self_grant(p_user);` — **self-grant denied** on grant (WS-1 helper, verbatim).
3. **Anti-lockout** on `revoke_role` for `org_admin`: refuse to remove the org's last `org_admin` →
   **`HC0G1`** (re-homed HC081).
4. **Shape-coherent insert/delete** — `grant_role` maps `(scope_type, scope_id)` to the right scope column(s)
   (hospital-tier also fills `organization_id` via `org_of_hospital`), `insert … on conflict
   (memberships_grant_uq) do nothing`; `revoke_role` deletes the exact-scope row. **t19 grant rule:**
   `revoke all … from public; grant execute … to authenticated, service_role;`.
5. **Audit is by TRIGGER, not in the RPC** (WS-1 H-6 fix carried verbatim) — see §2.4.

**Compatibility shims (keep the ~10 existing appointment RPCs as thin wrappers over `grant_role`/`revoke_role`
so callers & pgTAP fixtures don't churn):** `assign_org_admin`/`revoke_org_admin`,
`assign_hospital_admin`/`revoke_hospital_admin`, `assign_nsp_org_admin`/`revoke_nsp_org_admin`,
`assign_nsp_coordinator`/`revoke_nsp_coordinator`, `add_pqs_member`/`remove_pqs_member`. Each becomes a
`select grant_role('<scope>', <id>, '<role>', p_user)` (preserving its exact current signature + return type
— e.g. `add_pqs_member returns pqs_members` must still return the row shape; see §9 O-5 for the
`returns pqs_members` wrinkle once the table is gone → return `memberships` or a composed row).

### 2.4 Audit (blanket trigger on `memberships` — WS-1 H-6 carried verbatim)

One `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` trigger, `app.trg_audit_memberships()`, mirroring the
three retired triggers. **Verb decision (O-6):** emit a **unified `membership.granted` / `.role_changed` /
`.revoked`** verb family, OR preserve the three legacy families by dispatching on scope. **Recommend
unified** (`membership.*`) — one table, one verb family, cleaner surveyor export; the three legacy verbs
(`organization_member.*`, `commission_member.*`, `pqs_member.*`) are **retired**. The `audit_write` call
carries `role + scope-ids + principal` in `metadata` and the resolved `(organization_id, hospital_id)` as the
chain tuple — **exactly** the WS-1 shape (never PHI, Rule 11). **`log_audit_access` allow-list +
`_audit_access_authorized` dispatch**: these are *mutation* verbs (audited by trigger, not read-audit), so
they do **not** join the read-audit allow-list — no C-4 dispatch arm needed. **Consequence:** the three
retired verbs must be removed from any `verify_audit_chain` fixture expectations and the E2E audit assertions
repointed to `membership.*` (tester coordination — §6).

### 2.5 TS layer (`backend`-owned — the frozen stubs `frontend` builds against)

The membership collapse is **almost transparent** to the data-access layer: `getCommissionAccessByOrg` /
`getNspAccessByOrg` read `commissions` / derive from `getSessionContext` under **RLS** (which now resolves via
`has_role`) — they do **not** name the membership tables, so **they need no signature change**. The surfaces
that **do** name a membership table (11 files; §3) repoint their `.from('<table>')` to `.from('memberships')`
with a scope filter, **behind unchanged exported signatures**. Contract-first stubs to post & keep stable:

- **`src/lib/queries/session.ts`** — `CommissionRole = 'staff' | 'staff_admin'` **UNCHANGED**; `Membership`
  shape **UNCHANGED**; `getCommissionAccessByOrg` / `getNspAccessByOrg` return types **UNCHANGED**. (Internal
  reads repoint; the exported contract is frozen — this is the whole point of the wrapper strategy.)
- **`src/lib/queries/members.ts`** — `listMembers(commissionId): Promise<MemberListItem[]>` **UNCHANGED
  signature**; internal `.from('commission_members')` → `.from('memberships').eq('commission_id', …)`
  (project `role`, `title_id`, `principal_id`→member). `MemberListItem` / `MemberCapability` types
  **UNCHANGED**.
- **`src/lib/members/actions.ts`** — `addStaff` / `removeStaff` switch their **implementation** from a direct
  `commission_members` write to `supabase.rpc('grant_role'|'revoke_role', {...})` (or the `add_staff` shim,
  O-2) — **exported signatures UNCHANGED** (`addStaff(commissionId, userId, role)` /
  `removeStaff(commissionId, userId)`); the pt-BR error mapping gains the `HC0G*` keys (§4).
- **`src/lib/queries/pqs.ts` / `org.ts` / `org-users.ts` / `meetings.ts` / `admin/actions.ts` /
  `platform/actions.ts` / `auth/actions.ts` / `users/actions.ts`** — repoint each direct membership-table
  `.from(...)` read/write to `memberships` **behind their existing exported signatures**; `platform/actions.ts`
  first-`org_admin` provisioning (service-role door, WS-1 INFO-1) writes via `grant_role` or a service-role
  insert into `memberships` (keep it audited by the blanket trigger).

> **Stub-first protocol:** post these signatures (unchanged) + a `memberships` type alias to the lead, commit
> them, then implement. Because the exported shapes are frozen, `frontend` needs **no changes** — the promise
> to the lead is "the appointment/member UIs keep compiling and behaving; only storage moves." Any deviation
> (e.g. O-2 forcing a visible `addStaff` behavior change) is escalated **before** SQL.

---

## 3. Migration ownership & serialization (S0 §E / plan §5 / §7)

- **New migration(s)** — `backend`-owned, forward-only, window `20260720000000+`. Reset-OK **drop-and-recreate**:
  drop the three tables (after moving their reads), create `memberships`, recreate the predicate family as
  wrappers, recreate the door + shims + audit trigger. `seed.sql` re-expressed to seed `memberships`
  (personas unchanged in identity/role — the E2E roster is the parity oracle).
- **MEM lands + regenerates types BEFORE ETH·E1, RV2·R2–R5, CH** — all consume `has_role`/`is_*_of` (plan
  §1 "MEM early, before any RLS-heavy track"; §5). MEM must **not run concurrently** with E1/RV2-governance
  (RLS churn).
- **Serialize on `src/lib/queries/session.ts` + `members.ts`** against any concurrent teammate (plan §5). The
  11-file repoint touches `pqs.ts`/`org.ts`/`org-users.ts`/`meetings.ts`/`admin`/`platform`/`auth`/`users`
  actions — **coordinate with the lead** before any track that edits those.
- **Regen types after the migration:** `supabase gen types typescript --local > src/lib/types/database.ts`
  (`organization_members`/`commission_members`/`pqs_members` Row types disappear; `memberships` appears; the
  shim RPC signatures update).
- **Remote deploy** user-authorized (background agents auto-denied); local-first (`supabase migration up`),
  pgTAP on a fresh reset.

---

## 4. SQLSTATE `HC0G0–HC0G9` → pt-BR message keys (data layer, Rule 8/10)

| Code | Raised where | pt-BR message key (in the data-layer messages map) |
|---|---|---|
| `HC0G0` | `grant_role`/`revoke_role` — unknown `(scope_type, role)` combination | `membership.invalidScopeRole` → *"combinação de escopo e função inválida"* |
| `HC0G1` | `revoke_role` — removing the org's last `org_admin` (re-homed HC081) | `membership.lastOrgAdmin` → *"não é permitido remover o último administrador da organização"* |
| `HC0G2` | shape-CHECK violation surfaced through the door (defensive; door maps scope→columns) | `membership.invalidShape` → *"escopo da função inválido"* |
| `HC0G3` | reserved — `staff` self-escalation to `staff_admin` attempt (if surfaced distinctly from 42501) | `membership.noSelfEscalate` → *"não é permitido elevar a própria função"* |
| `HC0G4`–`HC0G9` | **reserved** (unallocated; future membership constraints) | — |

> Self-grant stays **`42501`** (the WS-1 `_deny_self_grant` errcode — do NOT re-home it to `HC0G*`; keeping
> `42501` preserves the existing pt-BR mapping and the WS-1 pgTAP `throws_ok(..., '42501')` assertions).

---

## 5. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
|---|---|---|---|
| MEM-1 | **Post the §2.5 contract** (frozen signatures + `memberships` type alias) as typed stubs; commit — unblocks the "no FE change" promise. | — | one-line ack |
| MEM-2 | Migration: `memberships` table + shape CHECK + indexes + `seed.sql` re-expression. Drop the three tables (after MEM-4 repoints reads) OR create-alongside-then-cutover (build-order decision). | MEM-1 | **FULL** (new table + a new discriminated shape — novel storage) |
| MEM-3 | Predicate family: `has_role` (+ `has_role_any`, 3-arg overloads) + **rewrite all 27 `is_*_of`/`_for` wrappers** to delegate; owner=postgres + `search_path` pin + t19 grants. | MEM-2 | **FULL** (the ~145-call-site predicate collapse — X-β; a missed predicate is THE risk) |
| MEM-4 | Door: `grant_role`/`revoke_role` (authority + `_deny_self_grant` + HC0G1 anti-lockout) + the ~10 appointment-RPC shims (signatures preserved) + repoint the 11 data-access files' membership-table reads/writes behind frozen signatures. | MEM-3 | **FULL** (DEFINER write door + service-role provisioning path) |
| MEM-5 | Audit: `trg_audit_memberships` blanket trigger (unified `membership.*` verbs, O-6) + retire the three legacy triggers/verbs; update `verify_audit_chain` fixtures. | MEM-4 | one-line ack (mirrors WS-1 §5 verbatim) |
| MEM-6 | Regen `database.ts`; pgTAP (§6 enumerated); coordinate the E2E audit-verb repoint with tester. | MEM-5 | one-line ack |

---

## 6. Acceptance — pgTAP (the lock) + full E2E

**pgTAP assertions (enumerate; run on a fresh reset — memory `pgtap-needs-fresh-reset-vs-e2e-leftovers`):**

*WS-1 invariants carried VERBATIM (the non-negotiable core):*
1. `memberships` has **no** policy with `cmd IN ('INSERT','UPDATE','DELETE','ALL')` (`pg_policies`), and
   `authenticated` holds **no** INSERT/UPDATE/DELETE grant (`information_schema.role_table_grants`).
2. A direct `INSERT`/`UPDATE`/`DELETE` on `memberships` as a seeded `org_admin` / `staff_admin` /
   `nsp_org_admin` is **rejected** by RLS (`throws_ok`).
3. Each of `grant_role` and every appointment-shim **rejects self-grant** (`p_user = auth.uid()` → `42501`).
4. `revoke_role('organization', org, 'org_admin', last_admin)` **rejects** with `HC0G1`.
5. Happy path per tier still works: `grant_role` for org_admin / hospital_admin / nsp_coordinator / pqs_member
   / staff / staff_admin → the row appears **and** the matching `is_*_of` wrapper now returns true; `revoke_role`
   → gone + wrapper false.
6. Every grant/revoke in (5) **emits exactly one audit row** (`audit_log` count delta; correct
   `membership.*` verb + scope; **no PHI in payload**).

*Predicate-collapse negatives (the MEM-specific risk — a MISSED predicate; cover each wrapper with a negative):*
7. For **each** of the 27 wrappers: a principal **without** the grant → wrapper **false**; **with** the grant
   → **true** (truth-table per wrapper). Include the composed ones: `is_pqs_operator_of` true for a coordinator
   with no member row and for a member with no coordinator row; `is_commission_admin_of` true for an org_admin
   of the commission's org AND for a hospital_admin of the commission's hospital, false otherwise;
   `is_org_level_admin_within` true only for an org-admin holding **no** commission membership.
8. **`is_pqs_member_of_any`** true iff enrolled in ANY hospital roster (synthetic `pqs_member` role resolves).
9. **`expires_at`** — an unset (`NULL`) grant never filters (wrapper true); a past `expires_at` filters
   (wrapper false) — locks the reserved column's inertness.
10. **Shape CHECK** rejects illegal shapes: `staff` with a non-null `organization_id`; `org_admin` with a
    non-null `commission_id`; `pqs_member` with a null `hospital_id`; `hospital_admin` with a null
    `organization_id`; `title_id` set on a non-commission row (all `throws_ok`).
11. **Grant uniqueness** — a duplicate `(principal, role, exact-scope)` grant is a no-op (idempotent
    `on conflict`), not a duplicate row.
12. **`case_access` untouched** — a case read/write grant still resolves via `can_read_case`/
    `can_write_case_content` (no regression from the collapse); `case_access` has no `role`/`memberships`
    coupling.

**Full E2E (`npm run e2e:prod`, lead runs — memory `e2e-gate-run-mechanics`):** all appointment/member UIs
still work end-to-end (org-admin appoints a coordinator, staff_admin adds/removes a staff member, NSP org-admin
enrolls a PQS member — **through the UI**); a crafted direct `POST`/`PATCH`/`DELETE` to
`/rest/v1/memberships` returns **401/403**; self-appointment via any door surfaces a clear pt-BR error;
the multi-org persona (`multi@`) commission picker still resolves both memberships; **full pgTAP + full E2E
green** (the parity oracle — a missed predicate shows up as a broken RLS read somewhere in the suite).

---

## 7. QA scope

Requirements audit vs the audit §6.1 + S0 §F.2 (`case_access` kept separate — verify the reconciliation is
truthful); **RLS/grant-path review** — no direct write policy/grant on `memberships`; the door authority arms
match the retired RPCs' authority exactly (no privilege widening); the shape CHECK is exhaustive
(`else false`); the predicate wrappers are behavior-preserving (truth-table coverage, no anon/PUBLIC leak,
`is_active` never dropped); confirm the unified `membership.*` audit verbs carry role+scope+who and **never**
PHI; verdict to `docs/reviews/`.

---

## 8. Risks & ripples

- **A missed predicate is the headline risk** (§6 assertion 7 exists for exactly this). The 27-wrapper
  truth-table is the safety net; the full E2E/pgTAP suites are the parity oracle.
- **`commission_members` write-posture change (O-2)** — moving `addStaff`/`removeStaff` behind the door is the
  one place a behavior could visibly shift (an error path, an ordering). Guard the happy path E2E + keep the
  exported action signatures frozen.
- **Audit-verb rename (O-6)** — retiring three verb families for one `membership.*` family touches
  `verify_audit_chain` fixtures + E2E audit assertions; coordinate the repoint with tester in the same window.
- **`returns pqs_members` shim (O-5)** — `add_pqs_member`'s return type references a table being dropped;
  the shim must return a compatible row shape (`memberships`-projected or a composed record).
- **Performance** — the collapse is a net **win** (one indexable shape vs three; §2.1 indexes replace the
  per-table ones), but `has_role` is invoked per candidate row in tightened SELECTs — keep it
  `stable security definer` + the scope indexes; carry the WS-5 `(select auth.uid())` InitPlan wraps into the
  wrappers.

---

## 9. Open decisions (flag to lead/PO — do NOT guess in the migration)

- **O-1 · `case_id` on `memberships`?** **Recommend DROP it** (do not add `case_id`). No role in the
  vocabulary scopes to a case; per-case involvement is `case_access` (kept separate, S0 §F.2). Adding a
  `case_id` column + a `case`-scope arm would be dead shape. **Decision needed:** confirm no near-term track
  introduces a *case-scoped role* (ETH·E1 uses `case_participants` roles, which are participant-ACL, not
  `memberships` roles — so still no). → **Default: no `case_id`.**
- **O-2 · Collapse `commission_members` into the locked door?** WS-1 left it writable ("legitimate and
  frequent" staff flow). MEM's single-table premise **forces** it behind `grant_role`/`revoke_role`.
  **Recommend YES** (uniformity is the whole point). **Confirm** the PO/lead accepts `addStaff`/`removeStaff`
  becoming RPC-routed (exported signatures unchanged; only the write mechanism moves).
- **O-3 · `title_id` inline on `memberships` vs a side table.** **Recommend inline** nullable column +
  `memberships_title_scope` CHECK (commission-scope only) — it's 1:1 with a commission membership row and
  display-only. Alternative: a `commission_member_titles`-referencing side table keyed on the membership id
  (cleaner separation, one more join). → **Default: inline.**
- **O-4 · `organization_id` denormalization on hospital-tier rows.** Kept exactly where `organization_members`
  had it (hospital-tier rows carry it; commission rows do NOT). Confirm the reviewer is happy this doesn't
  reintroduce an H-desync surface (it mirrors the incumbent; the `commissions`/`hospitals` composite-FK guards
  from WS-3b still police the hierarchy). → **Default: mirror incumbent.**
- **O-5 · Shim return types referencing dropped tables.** `add_pqs_member returns pqs_members` (and any other
  `returns <membership table>`): the shim must return a compatible shape once the table is gone.
  **Recommend** returning the projected `memberships` row (or `void` if no caller consumes the return —
  verify `members/actions.ts` + `pqs.ts` don't read it). → **Confirm at MEM-4.**
- **O-6 · Audit verb: unified `membership.*` vs preserve three legacy families.** **Recommend unified**
  (`membership.granted`/`.role_changed`/`.revoked`) — one table, one family, cleaner surveyor export; retire
  `organization_member.*` / `commission_member.*` / `pqs_member.*`. **Cost:** repoint `verify_audit_chain`
  fixtures + E2E audit assertions. **Confirm** the PO is fine losing the per-tier verb granularity in the
  audit stream (the scope-ids in metadata preserve the tier distinction).

---

## 10. Rollout

1. `backend` posts the §2.5 stubs (MEM-1) → lead ack. **Plan review required** for MEM-2/3/4 (new table +
   new predicate shape + DEFINER write door — S0 §"full plan" bar).
2. `supabase migration up` (local) → regen types → run pgTAP (§6) → fix → green.
3. Tester: the §6 E2E (appointment UIs + direct-POST 401/403 + audit-verb repoint) + full regression. QA:
   §7 RLS/grant-path review.
4. `supabase db push` / `db reset --linked` — **user-authorized** (background agents can't push).
5. §6 Record: PROGRESS.md → ✅, update `docs/backend-state.md` (membership surface = `memberships` + one door +
   one predicate family), `graphify update .`, commit `phase(MEM): …` / `feat(memberships): …`. This
   **supersedes** the direct-write posture for `commission_members` (ADR 0041) and completes WS-1's §6.1-minimum.
