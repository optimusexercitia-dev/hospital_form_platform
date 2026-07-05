# Membership Write-Path Lockdown (minimum-viable §6.1)

> **Status: DEFERRED / planned — not started.** Pre-pilot hardening. This is the
> "minimum-viable" version of the external audit's §6.1 recommendation (a single
> audited membership write-door), scoped to close the *reachable* holes without the
> full physical `memberships`-table collapse. Tracked in
> [PHASES.md](../../PHASES.md) → *Structural / platform phases*. Rationale + the
> full audit triage: [docs/reviews/external-db-audit-2026-07-evaluation.md](../reviews/external-db-audit-2026-07-evaluation.md).

## Context

The platform's entire PHI posture rests on **roster/role membership** — enrollment in
`pqs_members` grants that hospital's PHI read; `organization_members.role` grants
org/hospital authority incl. `nsp_coordinator`. Today those tables are **directly
writable** by an ordinary authenticated client: they carry Supabase's stock
`GRANT ALL TO authenticated` (never revoked) plus `FOR ALL` RLS write policies. Guarded
appointment RPCs *exist* (`assign_hospital_admin`, `assign_nsp_org_admin`,
`assign_nsp_coordinator`, `add_pqs_member`) but are **bypassable** — a client can
`INSERT`/`UPDATE` the table directly and skip them. Consequences, verified against live
code:

- **C-3a** — an `org_admin` can `INSERT (org, auth.uid(), 'nsp_coordinator', hospital)`
  into `organization_members` (policy `organization_members_write`, baseline:21839) and
  bootstrap itself toward PHI, defeating the documented "org_admin appoints ≠ coordinator
  curates ≠ member reads PHI" duty separation.
- **C-3b** — an `nsp_org_admin` (pgTAP-asserted "ZERO-PHI KEYSTONE") can self-enroll into
  `pqs_members` (policy `pqs_members_curator_all`, nsp_per_hospital:1175 — no
  self-exclusion) and become a PHI operator. `add_pqs_member` (nsp_per_hospital:1929) also
  lacks a `p_user_id <> auth.uid()` guard, so even the sanctioned RPC permits it.
- **H-6** — grants are audited **inconsistently**: only `role='hospital_admin'`
  INSERT/DELETE fire `trg_audit_hospital_admin_grant`; `org_admin` / `nsp_org_admin` /
  `nsp_coordinator` grants and all `pqs_members` roster changes are **unaudited**
  (`pqs_members` has zero triggers). `commission_members` is the exception — already fully
  audited by `audit_commission_members_trg`.
- **H-7** — `organization_members_write` is `FOR ALL` with no column pinning and no
  self-delegation guard (Postgres RLS can't pin columns; this needs an RPC/trigger fix).

Reachability: all of the above are reachable through **normal PostgREST INSERT/UPDATE** as
the `authenticated` role — no elevated credential needed. Pre-launch (reset OK) this is
cheap to close; post-pilot the write contracts and any accumulated grants make it costly.

**The pattern to copy already exists twice in-repo:** `case_access` has **no write policy
at all** — writes flow only through `grant_case_access`/`revoke_case_access`
(`SECURITY DEFINER`); and `assign_hospital_admin`/`assign_nsp_coordinator` already
implement authority-check → self-exclusion → guarded insert. We generalize that pattern to
the two PHI-adjacent membership tables.

## Scope

| | Table | Action |
|---|---|---|
| **Core** | `organization_members` | Lock down: no direct writes; all grants via RPC; blanket audit. Closes C-3a, H-6, H-7. |
| **Core** | `pqs_members` | Lock down: no direct writes; all grants via RPC **with self-exclusion**; blanket audit. Closes C-3b, H-6. |
| **Optional** | `commission_members` | *Lower priority.* Already fully audited and role-pinned (`commission_members_staff_admin_update` blocks staff→staff_admin; escalation via `commission_members_admin_all` is org_admin-only). Its staff add/remove flow is legitimate and frequent. Route through the door only if we want full uniformity — not required to close any Critical. |
| **Untouched** | `case_access` | Already write-only via DEFINER RPCs — the reference pattern. |

**Explicitly out of scope:** the full physical collapse into one `memberships` table
(the audit's larger §6.1). This plan is deliberately *forward-compatible* with it (see
"Forward compatibility"), but does not do it — that stays a separate, deliberately-scoped
post-pilot phase, and if taken must use column-per-scope + a shape CHECK (never a bare
`scope_id`) to keep FKs.

### Locked design decisions

| # | Decision |
|---|----------|
| 1 | Close the write path by **construction**: `REVOKE INSERT, UPDATE, DELETE` from `authenticated` on `organization_members` + `pqs_members`, and **DROP their write RLS policies** (`organization_members_write`; `pqs_members_curator_all` + any residual `pqs_members_*_all` write policy). SELECT policies stay untouched. `service_role`/seed (RLS-exempt) is unaffected, so provisioning + `supabase db reset` still work. |
| 2 | Every membership grant/revoke flows through a `public.*` `SECURITY DEFINER` RPC. Each RPC keeps its **role-specific authority check** (already correct) and calls one shared internal helper `app._deny_self_grant(p_principal)` for uniform self-exclusion. |
| 3 | **Add the missing `assign_org_admin` / `revoke_org_admin` RPCs.** `org_admin` is currently grantable *only* by direct table write (there is no RPC), so once the write policy is dropped we need a door. Authority: platform `is_admin()` **OR** an existing `org_admin` of that org (so org provisioning by `platform_admin` and org-admin succession both work). Guard: self-exclusion on grant; "cannot remove the last `org_admin`" on revoke (anti-lockout). |
| 4 | **Patch `add_pqs_member`** to add the `p_user_id <> auth.uid()` self-exclusion guard (via `app._deny_self_grant`). Verify the same on every other `assign_*`/`add_*` RPC (`assign_nsp_org_admin`/`assign_nsp_coordinator`/`assign_hospital_admin` already have it; `add_pqs_member` does not). |
| 5 | **Fix H-6 with blanket audit triggers**, not per-RPC audit calls — an `AFTER INSERT OR UPDATE OR DELETE` trigger on `organization_members` and on `pqs_members`, mirroring `audit_commission_members_trg`. This guarantees *every* grant is audited regardless of which RPC (or future path) writes it. Retire the narrow `trg_audit_hospital_admin_grant` (now subsumed) or leave it — the blanket trigger supersedes it. Audit rows record **role name + scope + who + when only** — never PHI, per Rule 11. |
| 6 | Lock the invariant with **pgTAP**, so a future migration that re-adds a write policy or a self-grantable RPC fails a test rather than silently reopening the hole. |
| 7 | No schema/column changes and no data migration beyond policy/grant/RPC/trigger churn. Generated types change only by the new RPC signatures. Reseed to run pgTAP (pre-launch reset is acceptable). |

---

## Change set (one migration + tests)

### 1 · Close direct writes
```sql
-- organization_members
drop policy if exists organization_members_write on public.organization_members;
revoke insert, update, delete on public.organization_members from authenticated;
-- pqs_members  (confirm the live write-policy name at execution time)
drop policy if exists pqs_members_curator_all on public.pqs_members;
revoke insert, update, delete on public.pqs_members from authenticated;
-- SELECT policies (organization_members_select, org_member_self_read,
-- pqs_members SELECT, nav policies) are LEFT IN PLACE.
```

### 2 · Shared self-exclusion helper
```sql
create or replace function app._deny_self_grant(p_principal uuid)
returns void language plpgsql
set search_path to 'app','pg_catalog' as $$
begin
  if p_principal = auth.uid() then
    raise exception 'não é permitido conceder acesso a si mesmo' using errcode = '42501';
  end if;
end; $$;
-- REVOKE ALL ... FROM public; grant execute to authenticated (belt: app.* isn't
-- PostgREST-exposed, but keep the grant posture explicit — see audit C-2).
```
Every appointment RPC replaces its inline self-check with `perform app._deny_self_grant(p_user);`.

### 3 · New `assign_org_admin` / `revoke_org_admin`
`SECURITY DEFINER`, `search_path` pinned. `assign_org_admin(p_org, p_user)`:
authority = `app.is_admin() or app.is_org_admin_of(p_org)`; `perform app._deny_self_grant(p_user)`;
`insert into organization_members(organization_id, user_id, role, hospital_id) values (p_org, p_user, 'org_admin', null) on conflict do nothing`.
`revoke_org_admin(p_org, p_user)`: same authority; **anti-lockout** — reject if the target is
the org's last `org_admin` (`count(*) filter (where role='org_admin') <= 1`).

### 4 · Patch existing RPCs
- `add_pqs_member` — insert `perform app._deny_self_grant(p_user_id);` after the authority check (nsp_per_hospital:1938-1942).
- Confirm `assign_hospital_admin` / `assign_nsp_org_admin` / `assign_nsp_coordinator` already deny self-grant (they do) and re-point them to `app._deny_self_grant` for consistency.
- No behavioural change to the `revoke_*` RPCs beyond routing through the (now sole) write path.

### 5 · Blanket audit (H-6)
```sql
-- mirror app.audit_commission_members() shape
create or replace function app.audit_organization_members() returns trigger ... -- emits
  --  organization_member.granted / .role_changed / .revoked  (role + org + hospital_id in metadata)
create trigger trg_audit_organization_members
  after insert or update or delete on public.organization_members
  for each row execute function app.audit_organization_members();

create or replace function app.audit_pqs_members() returns trigger ... -- emits
  --  pqs_member.enrolled / .removed  (hospital_id in metadata; NEVER the PHI it unlocks)
create trigger trg_audit_pqs_members
  after insert or update or delete on public.pqs_members
  for each row execute function app.audit_pqs_members();
```

### RPC inventory after this change

| RPC | Table | State |
|---|---|---|
| `assign_org_admin` / `revoke_org_admin` | organization_members | **NEW** (closes the org_admin direct-write gap) |
| `assign_nsp_org_admin` / `revoke_nsp_org_admin` | organization_members | exists — re-point to shared guard |
| `assign_hospital_admin` / `revoke_hospital_admin` | organization_members | exists — re-point to shared guard |
| `assign_nsp_coordinator` / `revoke_nsp_coordinator` | organization_members | exists — re-point to shared guard |
| `add_pqs_member` / `remove_pqs_member` | pqs_members | exists — **add missing self-exclusion** |
| `grant_case_access` / `revoke_case_access` | case_access | untouched (reference pattern) |

---

## Verification

### pgTAP (`supabase/tests/`) — the lock
1. `organization_members` and `pqs_members` have **no** `cmd IN ('INSERT','UPDATE','DELETE','ALL')` policy (`pg_policies`), and `authenticated` holds **no** INSERT/UPDATE/DELETE grant on them (`information_schema.role_table_grants`).
2. A direct `INSERT`/`UPDATE` on each table, executed as a seeded `org_admin` / `nsp_org_admin`, is **rejected** by RLS (`throws_ok`).
3. Each `assign_*`/`add_*` RPC **rejects self-grant** (`p_user = auth.uid()` → 42501).
4. `revoke_org_admin` **rejects removing the last org_admin**.
5. Happy path still works: `assign_nsp_coordinator` → row appears; `add_pqs_member` → enrollment appears and PHI read now resolves; `revoke_*` → gone.
6. Every grant/revoke in (5) **emits an audit row** (`audit_log` count delta; correct action verb + scope; **no PHI in payload**).

### E2E (`e2e/`)
- An org_admin appoints a coordinator / enrolls a member **through the UI** — still works end-to-end.
- A crafted direct `POST`/`PATCH` to `/rest/v1/organization_members` and `/rest/v1/pqs_members` (bypassing the RPC) returns 401/403 — the self-escalation is closed.
- Self-appointment via the RPC surfaces a clear pt-BR error.

### Regression
Full E2E + full pgTAP suite green (lead runs the full suite per CLAUDE.md §6 / the "subagents can't run full E2E" constraint).

---

## Rollout

1. Backend writes the migration (§1–§5) + pgTAP. **Plan review required** (touches RLS + a
   new grant path — CLAUDE.md §6 full review, not fast-track).
2. `supabase migration up` (local) → run pgTAP → fix → green.
3. Regenerate types (`supabase gen types … > src/lib/types/database.ts`) for the new RPCs;
   update `src/lib/queries/**` appointment callers if any assumed direct writes (they should
   already call the RPCs).
4. Tester: E2E above + full regression. QA: RLS/grant-path review.
5. `supabase db push` (remote) — **user-authorized deploy** (background agents can't push).
6. Short **ADR** recording the model change (membership writes are RPC-only; supersedes the
   direct-write posture in the org/hospital/NSP ADRs 0042 / 0051 / 0052 for *writes*).

## Forward compatibility with the full §6.1 collapse

This is not throwaway work. If the platform later does the full physical collapse into one
`memberships` table, the **door and the audit stay**: `assign_*`/`add_*` RPCs + the blanket
audit trigger keep their contracts; only the storage they write changes (from three tables
to one). The pgTAP lock (no direct write policy; self-grant raises; every grant audited)
carries over verbatim. So doing this now *reduces* the later collapse to a storage-shape
migration rather than a security-model migration.

## Effort & sequencing

~1–2 focused backend days (migration + RPCs + triggers + pgTAP), plus the standard test/QA
gate. No feature flag (structural). Best sequenced **before the pilot** and **before** any
further NSP/roster feature work, since it changes the write contract those features build on.
Independent of the latent hardening items (audit_log TRUNCATE / default-privileges — audit
C-1/C-2), which can ship in the same pre-pilot hardening migration if convenient.

## Acceptance criteria

- Direct client `INSERT`/`UPDATE`/`DELETE` on `organization_members` and `pqs_members` is
  impossible (no grant, no policy) — verified by pgTAP + an E2E direct-POST attempt.
- Every role grant/enrollment flows through a `SECURITY DEFINER` RPC that denies self-grant.
- `assign_org_admin`/`revoke_org_admin` exist with anti-lockout; `add_pqs_member` denies
  self-enrollment.
- Every grant/revoke on both tables emits an audit row (H-6 closed); no PHI in any audit row.
- Full E2E + pgTAP green; the appointment UIs still work.
