# ADR 0041 — Multi-Tenancy: organizations + hospitals above commissions

**Status:** Proposed (pending the phase gate + human approval) · **Date:** 2026-06-24
· **Feature:** Multi-tenancy — a new phase introducing `organizations` → `hospitals`
above the top-level `commissions`, pooled single-database with RLS isolation, splitting
the global admin into a vendor `platform_admin` and a customer `org_admin`. Extends the
`pqs_members` duty-separation posture (ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md),
[0035](./0035-lgpd-anvisa-regulatory-posture.md), [0037](./0037-inter-committee-case-referrals.md))
up one level; relies on the access-token-hook admin claim (ADR
[0002], [0009]). Supersedes nothing; tightens the platform-admin reach of the existing RLS surface.

## Context

The platform will be sold to multiple **organizations** (customers), each owning one or
more **hospitals**. Today `commissions` is the absolute top-level tenant unit: every table
(forms, responses, cases, meetings, interviews, NSP/PHI, referrals, audit) is commission-scoped,
users are members of commissions, and a single global `admin` role (`profiles.is_admin` /
`app.is_admin()`) sees everything. There is no concept above a commission, and `commissions.slug`
is globally unique.

We evaluated three tenancy models — a Supabase project per organization, a project per hospital,
and a single shared database pooling all tenants — and chose **pooled single-database with
silo-by-exception**. Per-project-per-org fights the platform: Supabase Auth (GoTrue) is
per-project, so a user who spans orgs (surveyors, consultants, a clinician at two hospitals)
would need N accounts; the 60+ forward-only migrations would have to be orchestrated across N
projects with version-skew risk; each project carries an infra floor that breaks low-end unit
economics; and cross-org features (benchmarking, vendor ops) become cross-project ETL.
Per-hospital is strictly worse — the **organization** is the natural billing/admin/reporting
boundary and owns multiple hospitals, so splitting below it fragments exactly the aggregation a
hospital network buys. Compliance (LGPD + ANVISA/RDC + the HIPAA BAA) does **not** require
physical per-tenant databases; logical isolation via RLS + audit + minimum-necessary — which the
platform already implements (Architecture Rules 1, 11, 12) — is the accepted standard.

**The load-bearing insight:** commission-scoped RLS **already** enforces org isolation
transitively. Every tenant table is gated by `app.is_member_of(commission_id)` /
`app.is_staff_admin_of(commission_id)`, and a user only holds `commission_members` rows for
commissions in their own org, so a staff member of Commission A (Org 1) already cannot read
Commission B's (Org 2) data. The **only** thing that crosses the org boundary today is the
blanket `app.is_admin()` OR-term stitched into ~60 policies and RPC gates — a vendor admin
currently sees every org's data, including PHI. So this is **not** "add `organization_id` to
every table and rewrite every policy"; it is "add the hierarchy, add an org-scoped admin
predicate, and scope/retire the `is_admin()` term."

## Decision

1. **Pooled single database, silo-by-exception.** All organizations share one Supabase
   database/project; isolation is enforced by RLS, continuing the model proven across 22 phases.
   The schema stays fully tenant-keyed and tenant-portable so a large customer that contractually
   demands physical isolation or dedicated residency can later be provisioned into a **dedicated
   Supabase project running the identical migrations** — one codebase, no fork. Pool by default,
   silo by exception.

2. **Hierarchy: organizations → hospitals → commissions.** New tables `organizations`
   (the customer/buyer; slug **globally** unique — it is the `/o/[org]` segment), `hospitals`
   (a facility within an org; slug unique **per org**, not routed), and `organization_members`
   (org-level roster; `role` CHECK = `org_admin` only today, the CHECK being the widening seam for
   a future `hospital_admin`). `commissions` gains `hospital_id` **and a denormalized
   `organization_id`**, the latter auto-derived from `hospital_id` by a BEFORE INSERT/UPDATE
   trigger so it is non-app-writable and cannot drift. Commission slug uniqueness moves from
   global to `UNIQUE(organization_id, slug)`.

3. **Role split — vendor `platform_admin` vs customer `org_admin`.** `platform_admin` is today's
   `is_admin()`, now **provisioning-only and walled off** from all tenant data and PHI: it manages
   `organizations`/`hospitals`/the first `org_admin` (and `pqs_members`) but is **removed** from
   the ~60 tenant/PHI policies — exactly the `pqs_members` duty-separation (a platform admin is not
   automatically a data reader). `org_admin` is the org-scoped super-user: sees and writes
   everything in its own org, nothing in any other. New `STABLE SECURITY DEFINER` predicates
   `app.is_org_admin_of(org)`, `app.is_org_admin_of_commission(commission)` (+ `_for` variants)
   mirror `is_member_of`; the commission variant is single-hop thanks to the denormalized
   `organization_id`.

4. **Org membership is a live DB read, not a JWT claim.** The `custom_access_token_hook` is
   **not** extended with org claims. A claim would lag grant/revoke by up to the token TTL (1h),
   and a lagging **revocation** is a cross-tenant exposure window; the cost of a DB lookup is one
   more indexed read of the shape RLS already does for `commission_members`. `is_admin` **stays** a
   claim (small, stable, and now harmless since `platform_admin` touches no tenant data). No
   `config.toml` change.

5. **RLS rewrite = scope the admin term, don't rewrite every policy.** Across the ~60 additive
   sites, `OR app.is_admin()` becomes `OR app.is_org_admin_of_commission(<commission_expr>)` (the
   `_for` variant inside PHI predicates that take `p_user_id`). The standalone management policies
   convert: `responses_admin_all` (a blanket `is_admin()` RWD over answer-PHI — the worst leak),
   `commissions_*`, and `commission_members_admin_all` become org-scoped; `profiles_admin_select`
   gains an org-scoped term so an org_admin reads profiles of its org's members. The
   highest-risk **SECURITY DEFINER** reads — `commission_overview()` and the six `dashboard_*`
   RPCs — are re-scoped from "platform admin sees all" to "org_admin sees its org," since their
   in-body gate is the only control (RLS is bypassed). `is_admin()` survives **only** on the
   platform-management surface (`organizations`/`hospitals`/`organization_members` writes,
   `pqs_members`, the function/hook/guard definitions). A grep inventory of every `is_admin()`
   occurrence is the spec and the post-change assertion.

6. **Audit becomes a 3-tier hash chain.** `audit_log` gains `organization_id`; chains are
   **platform** (org NULL, commission NULL) / **org** (org set, commission NULL) / **commission**
   (org set, commission set), with three partial unique indexes. `audit_write` derives the org
   from the commission (existing `trg_audit_*` callers need no signature change), extends the
   advisory-lock key and tail query to the `(org, commission)` tuple; `audit_canonical` includes
   `organization_id` in the hashed tuple and `verify_audit_chain` reconstructs it identically with
   per-tier authorization. `audit_log_select`: staff_admin reads its commission chain, org_admin
   its org chain, and `platform_admin` **only** the platform chain.

7. **Storage paths are unchanged.** Object paths stay `{commission_id}/...`; the path's first
   segment already routes through `is_member_of`/`is_staff_admin_of` and is therefore transitively
   org-isolated. Re-pathing to `{org_id}/...` would buy zero isolation and force an object
   migration. The eight commission-scoped storage policies swap the `is_admin()` term for the
   org-admin term; the three `nsp-evidence` policies simply **drop** the admin term (their segment
   is an event id; PHI stays PQS-only, no org term).

8. **URL `/o/[org]/c/[commission]`; hospital not routed.** The commission area moves from
   `/c/[slug]` to `/o/[org]/c/[commission]`; the org-scoped admin area is `/o/[org]/manage`
   (`is_org_admin_of(org)`-gated); `/admin` becomes the platform-admin orgs/hospitals registry plus
   the platform-chain audit (the NSP area stays — it is org-orthogonal). Hospital is a
   data/admin/reporting attribute, never a URL segment. The single frontend authorization seam
   `getCommissionAccess` becomes org-aware (`(orgSlug, commissionSlug)`), with an
   `org_admin → coordinator` branch; foreign-org access still `notFound()`. Middleware stays coarse.

9. **Greenfield reseed; not feature-flagged.** No production data is preserved — the local + remote
   DBs are reset and reseeded with the new hierarchy (two demo orgs, each a hospital + the existing
   CCIH/Farmácia commissions; new personas `platform@`, `orgadmin.a@`, `orgadmin.b@`; existing
   personas re-homed; deterministic org/hospital UUIDs). Multi-tenancy is **structural**, not an
   optional module — there is no coherent "OFF" state once the predicates are rewritten, so it is
   **not** behind a feature flag; the existing per-module flags (meetings, audit_trail,
   patient_safety, case_referrals) keep working under the new hierarchy. The change is gated by the
   §6 phase gate and a **cross-org leak pgTAP suite** whose keystone assertion is the inverse of
   today's behavior: `platform@` sees **zero** rows of every tenant table.

## Alternatives rejected

- **A Supabase project per organization (or per hospital).** Rejected — per-project Auth breaks
  cross-org identity, N-way migration orchestration is an ongoing operational tax, the per-project
  infra floor breaks low-end economics, and cross-org features become ETL. Per-hospital is
  strictly worse (it fragments the org's natural reporting boundary). The dedicated-project path is
  retained only as the silo-by-exception escape hatch (Decision 1).
- **Postgres schema-per-tenant in one database.** Rejected — PostgREST, generated types, and
  GoTrue all assume the `public`-schema model; schema-per-tenant fights the tooling while still
  requiring RLS, paying most of pooled's cost for little isolation gain.
- **Adding `organization_id` to every tenant table and rewriting every policy.** Rejected as
  unnecessary — commission membership already enforces org isolation transitively; the only leak is
  the `is_admin()` OR-term. Denormalizing `organization_id` is done **only** on `commissions`
  (for the per-org slug constraint, single-hop routing, and the org-admin predicate) and on
  `audit_log` (for the org chain tier).
- **Injecting org membership into the JWT via the access-token hook.** Rejected — claim staleness
  on **revocation** is a cross-tenant exposure window; a live DB lookup is correct and cheap
  (Decision 4).
- **Letting `platform_admin` keep reading all tenant data (status quo), or via audited
  break-glass now.** Status-quo rejected — it undercuts the entire multi-tenant PHI/LGPD posture.
  Break-glass is deferred: walling the vendor off is the safe default; an explicit, audited,
  time-boxed elevation path is future work, not part of this phase.
- **`UNIQUE(hospital_id, slug)` instead of `UNIQUE(organization_id, slug)`.** Rejected — the
  `/o/[org]/c/[commission]` URL requires slug uniqueness **per org**; a hospital-scoped constraint
  would allow two `ccih` commissions in one org under different hospitals and break the URL.
- **Feature-flagging the rollout.** Rejected — multi-tenancy is structural with no coherent OFF
  state, and a soft toggle around the exact predicates that enforce isolation is the worst place
  for one.

## Consequences

- **RLS-shape change with a security-critical mechanical edit.** A single un-swapped `is_admin()`
  OR-term is a silent cross-org PHI leak, so the grep inventory is treated as the spec and the
  cross-org leak suite asserts a zero-row result for **every** tenant table (not a sample), with
  dedicated pgTAP for each re-scoped DEFINER RPC against a foreign-org form. This is a **full
  plan-review** task per CLAUDE.md §4 (new RLS shape, DEFINER re-scoping, audit hash-chain core).
- **Frontend route move with broad but mechanical blast radius.** ~90 files under `src/app/c/[slug]/**`
  move to `src/app/o/[org]/c/[commission]/**`; the work concentrates in the `session.ts` seam plus a
  `commissionHref()` routing-helper codemod, since pages already resolve the commission id from the
  access object rather than the slug. The admin area splits into platform-admin (`/admin`) and
  org-admin (`/o/[org]/manage`).
- **Audit `audit_canonical`/`verify_audit_chain` must change in lockstep** with the insert — adding
  `organization_id` to one but not all breaks chain verification; all land in one migration with
  per-tier verification pgTAP.
- **Greenfield reseed** (pre-production) re-homes the existing personas under two orgs and adds the
  new platform/org-admin personas so the E2E + pgTAP suites exercise every access path; existing
  CCIH/Farmácia UUIDs are preserved so downstream fixtures don't break.
- **Forward-compatible role model.** `organization_members.role` CHECK and a future nullable
  `hospital_id` on it are the seam for a `hospital_admin` tier; the dedicated-project escape hatch
  is the seam for enterprise physical isolation — neither requires touching the predicate shapes.
