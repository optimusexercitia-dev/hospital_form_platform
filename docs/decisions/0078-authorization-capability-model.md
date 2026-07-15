# 0078 — Authorization capability model: case capabilities, granular grants, meeting boundary & referral write-gate

**Date:** 2026-07-15 · **Status:** 🟢 **ACCEPTED** (design ratified with the PO in interview,
2026-07-15; implementation not started; no migration authored).
**Owner:** platform lead → `backend`.
**Source design:** [`docs/design/temp/user-permissions-model-handoff.md`](../design/temp/user-permissions-model-handoff.md)
(the partner's target design; this ADR is its ratification **against the as-built schema**, and
diverges from it where verification contradicted it — see §Divergences).
**Predecessor:** ADR 0077 (same subject, committed `9a38c0c`, **withdrawn** by the PO 2026-07-15 and
replaced by this ADR after a full re-evaluation. Its text remains recoverable at `9a38c0c` for
provenance. Its five open decisions O1–O5 are **all resolved here**.)

**Supersedes / amends:**
- **Amends ADR [0033](./0033-case-access-control.md)** (`case_access` ACL): the two-valued
  `level ∈ {read,write}` grant plane is replaced by a capability-per-column grant table
  (`case_access_grants`, D5). `case_access` is **dropped**, not migrated (D5·1).
- **Amends ADR [0072](./0072-ethics-access-spine.md)** (ethics access spine): 0072's deny-first
  ordering, `app.is_case_excluded`, and the confidentiality ceiling are **preserved semantics**,
  re-expressed inside the capability resolver (D2). `app.can_read_case_or_admin` and
  `app.can_reach_case_on_member_surface` are retired at Stage G (D4, D8).
  0072's `case_access.max_confidentiality` clearance plane migrates to
  `case_access_grants.read_restricted_phi` + the retained label ceiling (D5·4).
- **Amends ADR [0037](./0037-inter-committee-referrals.md)** (referrals): referral PHI **read** and
  **write** authority are split; `set_referral_patient` leaves the public API (D7).
- **Amends ARCHITECTURE.md Rule 12** — Standard PHI becomes a capability distinct from Case
  Content; ordinary case read and bare assignment no longer imply patient-identifier read.
- **Retires the `case_access` feature flag** (D9).

**Relates:** ADR [0041](./0041-tenancy-roles.md) · [0051](./0051-commission-admin-predicate.md) ·
[0061](./0061-administrativo-delegated-capability.md) · [0063] F2 attachments ·
[0064](./0064-case-subject-generalization-participants.md) (`case_types`) ·
[0065](./0065-polymorphism-dialects.md) App-A · [0071](./0071-pre-pilot-release-scope-expansion.md) ·
[0075](./0075-memberships-collapse-write-path-split.md).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 6/R6 (anti-recursion), Rule 8 (generated
types), Rule 9 (queries layer), Rule 11 (audit), Rule 12 (PHI).

---

## Context — what verification actually found

Verified 2026-07-15 against **109 migrations**. The handoff's framing ("replace the single
`can_read_case` boolean") **misdescribes the as-built system**: `can_read_case` is already a
multi-arm union behind ADR 0072's hard-deny respondent/recusal terms.

### Three defects confirmed REAL — these justify the program

**1 · Case Content and Standard PHI are conflated. (The headline.)**
`app.can_read_case_patient` ([`20260720001000_ethics_access_predicates.sql:150`](../../supabase/migrations/20260720001000_ethics_access_predicates.sql)):

```sql
or exists (select 1 from public.case_access ca
           where ca.case_id = p_case_id and ca.user_id = p_uid
             and (ca.expires_at is null or ca.expires_at > now()))   -- ← NO level filter
or exists (select 1 from public.case_phases     cp where cp.case_id = p_case_id and cp.assigned_to = p_uid)
or exists (select 1 from public.case_narratives cn where cn.case_id = p_case_id and cn.assigned_to = p_uid)
```

`can_write_case_content` **does** filter `ca.level = 'write'`; the PHI door filters nothing. So a
grant deliberately issued **read-only opens patient identifiers**, and a bare phase or narrative
assignment does the same, unqualified. This is the single most consequential finding.

**2 · Referral read authority implies snapshot write authority.**
`public.set_referral_patient` ([`baseline.sql:15391`](../../supabase/migrations/20260620000000_baseline.sql))
gates its **write** on `app.can_read_referral_phi`, with `EXECUTE` granted to `authenticated`.
**Worse than ADR 0077 recorded:** `can_read_referral_phi` OR-s `app.referral_target_analyst`, which
resolves to *any unexpired `case_access` grant on `target_case_id`* — so a plain read grant on the
receiving case can **overwrite the transmitted patient identity**, the one thing a disclosure
snapshot exists to make immutable.

**3 · Deactivation is not an outer gate.**
`app.is_active` is **never called inline** in `can_read_case` / `_patient` / `can_write_case_content`
/ `can_read_case_or_admin`. It is reached only transitively through the role wrappers. The
`case_access`, `case_phases`, and `case_narratives` arms are **raw table checks** → a deactivated or
suspended user holding a live grant or a surviving assignment **still reads, including PHI**.

### Claims that did NOT survive verification (recorded to prevent re-litigation)

- **`memberships` (handoff §5.1) is already done.** ADR 0075 satisfies every stated invariant. **No work.**
- **`meeting_cases` is not an unbounded leak.** [`20260720001070`](../../supabase/migrations/20260720001070_ethics_meeting_cases_reach_gate.sql)
  already dual-gates it on `app.can_reach_case_on_member_surface`. The remaining member-wide reach to
  `commission_default` deliberation is **deliberate** (ADR 0072 D2·8). Stage C is therefore a
  **product tightening**, not a leak fix (D6, O1).
- **`can_read_case_patient` has no commission-admin arm.** Org/hospital admins read Case *Content*,
  not PHI. **D4's scope is narrower than ADR 0077 implied.**

### Gaps neither the handoff nor ADR 0077 caught

- **`case_access` has no `revoked_at`** — revoke is a hard `DELETE`. No historical evidence, directly
  contradicting handoff §8.3's soft-revocation requirement.
- **`case_access` PK is `(case_id, user_id)`** — one row per user per case. It **structurally cannot**
  represent the multi-source model. (Moot under D5·1's hard-cut.)
- **`app.attachment_confidentiality_ok` reads `public.case_access` directly**
  ([`...001060:20`](../../supabase/migrations/20260720001060_ethics_drop_inert_admin_clearance_arm.sql)) —
  dropping that table silently drops ADR 0072's confidentiality ceiling. **Blocking Stage-B coupling** (D5·4).
- **Meeting and interview attachments carry their own commission-admin arms**
  ([`20260717000000_attachments_core.sql:250,259`](../../supabase/migrations/20260717000000_attachments_core.sql)),
  which Stage A does not touch. Case attachments delegate to `can_read_case` and are fixed for free (D4·2).
- **The `case_access` flag is permanently ON** and its OFF branch is dead code (D9).
- **The handoff's §11.1 matrix would *widen* write access** — it implies a phase-assignee write arm
  that does not exist today (D10).

### METHODOLOGY FINDING — binding, not advisory

**Migration file text is stale.** [`20260709000200`](../../supabase/migrations/20260709000200_commission_admin_predicate.sql)
rewrites function *bodies* off the live catalog:

```sql
where p.prosrc ilike '%is_org_admin_of_commission%'
...
v_def := pg_get_functiondef(r.oid);
v_def := replace(v_def, 'is_org_admin_of_commission', 'is_commission_admin_of');
execute v_def;
```

During this evaluation a file-reading agent produced a **confident, specific, false P0** —
"`revoke_case_access` calls the dropped `is_org_admin_of_commission`". The file says so; the **live
catalog does not**. An external auditor tripped on this same rewrite (see
`docs/reviews/`). Combined with ADR 0072 delta 3 (three policy shapes invisible to grep) and the fact
that this repo's own graphify index does not cover SQL migrations, the conclusion is binding:

> **The Stage-A call-site inventory MUST be catalog-driven (`pg_proc`, `pg_policies`, `pg_depend`),
> never grep-driven or file-driven. No policy is renamed or repointed without that classification.**

---

## Decision

### D1 — Authorization is expressed as capabilities

```
view_case_overview · read_case_content · write_case_content
read_standard_phi  · read_restricted_phi · manage_case_access
```

Implication lattice, and **nothing else is automatic**:
`write_case_content ⇒ read_case_content ⇒ view_case_overview`; `read_restricted_phi ⇒ read_standard_phi`.
Crucially **neither PHI capability implies `write_case_content`**, and **`read_case_content` does not
imply `read_standard_phi`** — that non-implication is the whole point of this ADR (Context·1).

Meeting capabilities: `view_meeting_metadata · read_meeting_content · manage_meeting ·
read_meeting_case_section` (the last resolved from **Case** authority, not Meeting authority).

### D2 — One resolver, with a **private bitmask core**

The handoff mandates a `jsonb` resolver as "the single semantic source" with a boolean wrapper "for
performance". That is unimplementable as written: RLS policies on case-content tables are
**row-correlated** (`case_id` varies per row), so the Supabase `(select …)` InitPlan optimisation
**cannot** apply, and `(case_capabilities(...) ->> cap)::boolean` would allocate a jsonb and evaluate
all six capabilities **per row** on `answers`, `case_narratives`, and the interview family.

Resolved by a three-function family — **one computation, two projections, zero drift**:

```sql
app._case_caps(p_case_id uuid, p_user_id uuid) returns integer   -- PRIVATE bitmask core
app.case_capabilities(p_case_id uuid, p_user_id uuid) returns jsonb        -- app projection
app.has_case_capability(p_case_id uuid, p_user_id uuid, p_capability text) returns boolean  -- RLS projection (bit test)
```

`_case_caps` is the single semantic source and the only place the truth table is tested.
`has_case_capability` is a bit test — an int, no allocation. Per-row cost stays what `can_read_case`
costs **today**, so there is no performance regression to defend.

Fail-closed evaluation order inside `_case_caps`:

```
1. null user                          → 0
2. NOT app.is_active(p_user_id)       → 0            ⟵ D3, the outer gate
3. resolve case tenant anchors; absent/mismatch → 0
4. HARD DENY (ADR 0072, preserved verbatim, BEFORE every positive arm):
     app.is_case_respondent | app.is_recused_from_case  → 0
5. union positive sources (D11)
6. apply lifecycle restrictions to write bits
7. return the bitmask
```

**R6 is binding.** Every participant/recusal/grant term is computed **inside** the `SECURITY DEFINER`
over **base tables** — never an RLS-gated read (which recurses). This ADR does not relax the ADR-0064
R6 pre-commitment that 0072 honoured.

**ADR 0072's hard lesson is carried forward:** *a correct predicate does not make the policies
consuming it correct.* 0072 delta 3 found three shapes that handed rows back around a correct
predicate. The generic catalog-driven leak sweep 0072 added to pgTAP is **extended per-capability**,
never replaced.

### D3 — `app.is_active` becomes the outer gate on every path

Folded into `_case_caps` at step 2 — therefore into the grant arm, the phase/narrative assignment
arms, referral analyst access, meeting participation, attachment access, and action-item assignment,
not only the membership helpers. Deactivation must deny **at the database boundary** with a live JWT
and surviving grants. Session revocation on deactivation is a **companion application requirement**
(§Follow-ups), explicitly **not** the security boundary.

### D4 — Organization/hospital administration ceases to be a Case Content source

1. `app.is_commission_admin_of*` is **removed from `can_read_case`**. Organization Users keep full
   administrative authority and PHI-free aggregates; they lose case content. (They never had PHI —
   Context.) If such a person must participate clinically they hold a Committee role or an explicit
   grant — independently revocable.
2. **Attachments.** `can_read_attachment` is owner-keyed; its `'case'` arm delegates to
   `can_read_case`, so **case attachments are fixed for free** by (1). Its `'interview'` arm carries
   its own admin term — **removed** (interview attachments are case-linked and PHI-capable, exactly
   what D4 exists to kill). Its `'meeting'` arm **keeps** its admin term: meeting attachments are
   governance artifacts (agendas, minutes, accreditation evidence) that admins have a legitimate
   PHI-free reason to read, and `attachment_confidentiality_ok` already fails closed for gated labels
   on meeting-owned rows. **D4 is about clinical access, not about administration.**
3. `app.can_read_case_or_admin` collapses to `can_read_case` and is **retired at Stage G**. This does
   not undo 0072 — 0072 fixed the *ordering* (deny-before-admin); D4 removes the *arm*. Sequencing:
   D4 lands **after** the resolver, never as a standalone policy edit.

### D5 — `case_access_grants` replaces `case_access` by **hard cut**

1. **No data migration.** The platform is pre-launch: no live users, pilot not started, app not
   deployed. `case_access` is **dropped**; `case_access_grants` is created in its correct shape; the
   seed is reworked; local + remote reset at the pilot reset. **ADR 0077's O2 (a PHI re-grant
   campaign) is MOOT.** This also sidesteps a migration that could not have been faithful anyway
   (Context: PK `(case_id, user_id)` cannot hold a multi-source model; no `revoked_at` to preserve).
2. Capability-per-column, per the handoff §5.2 sketch, plus: tenant-safe composite FK to the case's
   org/hospital anchor; **column-per-scope** source FKs (ADR 0065 App-A dialect-1, never a bare
   polymorphic id); soft revocation (`revoked_at` / `revoked_by`); constrained `reason_code`;
   `reason_note` warned against PHI; active partial indexes on `(case_id, principal_id)` and
   `(principal_id, expires_at) where revoked_at is null`; surrogate `id` PK with a partial unique
   index on the active `(case_id, principal_id, source, source_entity_id)` tuple.
3. **No direct authenticated INSERT/UPDATE/DELETE.** Writes only through audited DEFINER doors
   (`grant_case_access` / `revoke_case_access` / `list_case_access`, re-cut against the new shape),
   `REVOKE ALL … FROM PUBLIC` then explicit grant. Re-cut `list_case_access` to project the clearance
   (today it does not project `max_confidentiality` — Context).
4. **⚠ BLOCKING COUPLING — `max_confidentiality` migrates, it does not vanish.**
   `app.attachment_confidentiality_ok` reads `public.case_access` **directly**. Dropping the table
   silently drops ADR 0072's confidentiality ceiling. It **must be repointed to `case_access_grants`
   in the same migration** — a Stage-B exit criterion, never deferred to Stage G. The 7-value taxonomy
   and the 0072 O2 ruling (only `legal_privileged` + `credentialing_sensitive` gate above ordinary
   case-read) are **unchanged**. ⚠ `CONFIDENTIALITY_ORDER` (FE) is **display** order, **not**
   sensitivity order — 0072's standing warning survives.
5. **`source` CHECK reserves the full vocabulary** — `('manual_grant','nsp_investigation','referral',
   'break_glass')` — so later stages add rows without a constraint migration. Only `'manual_grant'` is
   **reachable** pre-pilot; pgTAP asserts the other three are unreachable. Their `source_entity_id` FK
   columns arrive with the stages that create their targets. (ADR 0046/0060 "reserve the shape"
   precedent.)
6. **Restricted-PHI delegation — the bootstrap.** Handoff §7.3 ("never inherited from Coordinator
   status") composed with §11.4 ("cannot grant what you may not delegate") makes `read_restricted_phi`
   **unobtainable** — a deadlock neither source document noticed. Resolved by preserving today's
   semantics: **the Committee Coordinator is the delegating authority for their own committee's cases
   and MAY issue `read_restricted_phi` without holding it** (with `reason_code` + expiry + audit) —
   exactly what `max_confidentiality` does today. "Cannot delegate what you don't hold" applies to
   **Case Content and Standard PHI**, not to the restricted clearance plane. The 0072 label ceiling
   rides on top unchanged.

Assignment-derived access is **never** copied into this table; assignments remain source records
evaluated by the resolver.

### D6 — Meeting boundary (Stage C): **strict**, per handoff §2.5

```
read_meeting_case_section(meeting, case, user)
  = can_read_meeting_content(meeting, user)
    AND has_case_capability(case, user, 'read_case_content')
```

Meeting content reads repoint from bare commission membership to **Coordinator or Meeting
Participation** (`meeting_attendees`). Case-specific meeting fields (`meeting_cases.summary` /
`.decision`) require **both** authorities.

> **PO decision, recorded.** This is a **product tightening that removes reach pilot users would
> otherwise have**, on a live feature. The lead and ADR 0077 both recommended the softer option (b);
> **the PO chose strict** (2026-07-15). It is workable only because of D11's member arm — see there.
> The exploitable arm (ethics deliberation leaking to every member) was already closed by `...001070`.

`meetings.minutes_md` remains general content; case-specific discussion belongs in `meeting_cases`.
The application warns authors against duplicating case/PHI material into general minutes; existing
minutes are reviewed for duplication **before** the tighter policy is enabled.

### D7 — Referral: split the predicates, fix the write gate (Stage F-min). Disclosure model deferred

**Pre-pilot (F-min) — the security seam:**
1. Split the conflated predicate into `can_read_referral_metadata` · `can_read_referral_phi` ·
   `can_write_referral_response` · `can_manage_referral_phi_disclosure` · `can_amend_referral_phi_snapshot`.
2. Gate the `referral_patient` snapshot write on **`can_manage_referral_phi_disclosure`**
   (source Committee Coordinator only). **Read never implies write** (Context·2).
3. **`set_referral_patient` leaves the public API** (made private / removed).
4. Repoint the `referral_attachments_obj_select` Storage policy — it currently rides
   `can_read_referral_phi` ([`baseline.sql:24994`](../../supabase/migrations/20260620000000_baseline.sql)) —
   onto the split predicate.

**Post-pilot (F-full) — the governance product:** `referral_phi_disclosures`, `approved_fields`,
purpose-bound approval, versioned/immutable snapshots, amendment provenance, disclosure profiles
(`identity_minimum` / `encounter_context` / `full_standard_identity`), legacy provenance, and the
minimum-necessary field scoping of handoff §7.2. Referral creation defaults to **no PHI disclosure**
from F-min onward.

### D8 — NSP: drop the **PHI** arm pre-pilot; keep content reach; investigations stay post-pilot

Today `can_read_case` **and** `can_read_case_patient` each grant a PQS operator **blanket access** to
any referral-touched case — no purpose, no expiry, no investigation record. Stage D
(`nsp_case_investigations` + assignments + coordinator-only lifecycle RPCs + notifications + PHI-free
hospital aggregate doors) is net-new **product** surface including UI, and is **deferred post-pilot**.

**But the PHI half is not deferred.** The NSP arm is **removed from `can_read_case_patient`**
pre-pilot. NSP operators **keep Case Content** reach on referral-touched cases (their oversight job)
and **lose the automatic patient-identifier arm** — which is precisely this ADR's own rule (D1: Standard
PHI is separate from Case Content) applied consistently. Until Stage D, NSP obtains PHI through an
explicit grant. Stage D later replaces the content arm with real investigations.

> This resolves ADR 0077's **O3** rather than accepting it. 0077 would have left a blanket NSP PHI
> backdoor open through the pilot while D6 removed ordinary members' reach to routine deliberation —
> an incoherence that would not survive a surveyor's question.

### D9 — Retire the `case_access` feature flag

The flag is `true` in the baseline with `on conflict do update set enabled = excluded.enabled` —
**every reset forces it on**. Its OFF branch (`return app.is_member_of_for(...)`, member-wide read) is
**unreachable in any real environment**, and D11's member arm **subsumes its behaviour**. It is not a
kill switch: OFF means *every member reads every case*, a worse state than the defect being fixed.

The flag, both OFF branches, and the `assert_case_access_enabled()` guards are **deleted at Stage B**
(a flag guarding a dropped table is nonsense). pgTAP's flag-OFF cases are rewritten as
`visibility_policy` cases — which is what they were really testing. Precedent: `administrativo`'s
permanent flip (`5a6c668`) and QA's inert-arm removal in `...001060`, where a dead arm in an
authorization predicate was killed for exactly this reason.

### D10 — Write arms: preserve today's narrower behaviour (a deliberate divergence)

`write_case_content` = **Committee Coordinator OR active explicit write grant**. Full stop.
**No assignment arm.**

The handoff §11.1 matrix implies phase assignees hold `write_case_content` ("assigned-work only").
**They do not today**, and adding it would be a **widening shipped inside a least-privilege program**,
handing narrative/content write to anyone assigned a single phase. Assigned work flows through the
`responses`/`answers` policies — the correct door, already working. Recorded here so nobody "fixes"
this later.

### D11 — Capability sources, including **the member arm** (the crux)

| Source | Persisted where | Revocation/expiry |
|---|---|---|
| `committee_coordinator` | `memberships` | role revocation / membership expiry |
| **`committee_member_default`** | `memberships` + `cases.visibility_policy` | membership loss, or the case moving to `explicit_grants_only` |
| `case_assignment` | phase/narrative assignment | unassignment / deactivation |
| `manual_grant` | `case_access_grants` | explicit revoke or `expires_at` |
| `nsp_investigation` | *(post-pilot, Stage D)* | — |
| `referral` | referral recipient access | resolution, withdrawal, expiry, revoke |
| `break_glass` | *(post-pilot; source value reserved, unreachable — D5·5)* | — |

**The member arm — the decision that makes D6 workable:**

```
active member of the case's commission
  AND cases.visibility_policy = 'commission_default'
  AND NOT excluded (respondent/recused — evaluated first, step 4)
⇒ read_case_content        — and NEVER read_standard_phi, NEVER write_case_content
```

Without it, strict D6 makes a routine CCIH meeting unreadable to the twelve members who were *in the
room*: `can_read_case` has **no plain-member arm** on the `case_access`-ON path, which is exactly why
`...001070` needed `can_reach_case_on_member_surface` three days ago. With it, D6's rule is
*literally strict* — reach genuinely comes from `read_case_content` — and ordinary membership
legitimately confers that for ordinary cases. Ethics stays grant-only. PHI is never implied.

**One authority, not two.** `case_types` gains **`default_visibility_policy`**, a **creation-time
default only** ("Ethics complaint" → `explicit_grants_only`; "Infection event" → `commission_default`).
`cases.visibility_policy` remains the **sole runtime authority** the resolver reads, and a coordinator
may still override one case. This deliberately avoids a second authorization switch — two knobs over
one semantic is where leaks breed. It also reuses predicates already proven by ETH·E1's pgTAP.

**Derived (resolves ADR 0077's O5):** for a **member**, `view_case_overview` reach **==**
`read_case_content` reach. The existence of an `explicit_grants_only` case is **not discoverable** —
in a small committee, a case number plus a date plus a sudden recusal identifies the respondent, and
the respondent is a committee member. `view_case_overview`'s *extra* reach exists for Organization
Users and NSP (PHI-free aggregates), not members. Consequently
**`app.can_reach_case_on_member_surface` becomes redundant** — its semantics *are*
`has_case_capability(case, uid, 'read_case_content')` under this model, minus the admin arm D4 removes
anyway — and it **retires at Stage G**, with the member surfaces becoming capability-resolved.

### D12 — Terminology: docs only

The ADR, plan, and glossary use the product vocabulary (**Organization User · NSP Coordinator · NSP
Member · Committee Coordinator · Committee Member**) and state the mapping to the physical names
once. **No code, role-enum, or helper rename.** The handoff §5.1 permits this explicitly: *"physical
database role names may remain more granular, but every role must map unambiguously to one
category."* Renaming during an authorization rewrite is how the F2/F3 dead-name trap fired twice.

| Product term | Physical |
|---|---|
| Organization User | `org_admin` · `hospital_admin` · `nsp_org_admin` |
| NSP Coordinator | `nsp_coordinator` |
| NSP Member | `pqs_member` |
| Committee Coordinator | `staff_admin` |
| Committee Member | `staff` |

The genuine `pqs_*` ↔ NSP mismatch is a **separate mechanical rename unit, after this program**,
using the ADR 0069 precedent and the catalog-driven swap pattern.

### D13 — Process, SQLSTATEs, audit

1. **Stage A produces a catalog-driven migration contract before any SQL** (see the METHODOLOGY
   FINDING). Inventory every call site of `can_read_case`, `can_read_case_patient`,
   `can_write_case_content`, `can_read_case_or_admin`, `is_case_excluded`,
   `can_reach_case_on_member_surface`, `is_commission_admin_of*` on clinical tables,
   `can_read_attachment`, `attachment_confidentiality_ok`, `can_read_referral_phi`, meeting /
   `meeting_cases` policies, patient-identifier doors, and Storage object policies — **from `pg_proc`
   / `pg_policies` / `pg_depend`, not from files**. Classify each by replacement capability **and**
   path kind (base-table RLS · public RPC · `app` helper · Storage RLS · service-role server action).
2. **pgTAP first.** The handoff §11 matrix maps ~1:1 to test cases, authored **before** the SQL,
   exercised as `authenticated` under real RLS/RPC privileges — **never only as `postgres`**.
3. **SQLSTATE block `HC0G0–HC0G9`** (collision-checked at build-plan freeze).
4. **Audit verbs:** `case_access.granted|changed|revoked|expired`, `referral_phi.approved|transmitted|read|amended|revoked`,
   membership lifecycle. **PHI-free metadata only** (Rule 11) — no names, MRNs, narrative bodies,
   attachment titles, or free-text notes.
5. **SECURITY DEFINER posture:** `app` schema (non-exposed); owner and `search_path` pinned; explicit
   user argument honoured; `REVOKE ALL … FROM PUBLIC` after every create/replace; execute granted only
   where RLS evaluation requires it; no arbitrary SQL/table/column input; never returns authority rows
   or PHI. Tests call **both** the explicit-user form and the authenticated RLS path.

---

## Staging & gates

**Pre-pilot, sequenced BEFORE S4** (ETH·E2 · RV2 R2–R5 · CH) — PO decision 2026-07-15. Stage A rewires
the exact predicates ETH·E2's procedure model builds on and RV2 touches for referral reads; building
E2 on a model we have just proven defective, then re-cutting it underneath, is double work plus a
second regression surface. **This program must not be folded into an in-flight S-stage** — Stage A
touches every case-content policy and would collide with any concurrent policy work.

**Two gates** (PO decision): the risk is concentrated in A+B, and an independent green bar there
actually buys something. Stages land as **separate reviewable migrations** — never one combined.

| Gate | Stages | Scope | Difficulty | Exit |
|---|---|---|---|---|
| **1** | **A** | `_case_caps` bitmask core + projections (D2); `is_active` outer gate (D3); remove admin arm from Case Content + interview attachments (D4); member arm + `case_types.default_visibility_policy` (D11) | **Medium-High** | authorized clinical users retain access; inactive users and Organization Users cannot read Case Content; **`EXPLAIN (ANALYZE, BUFFERS)` on case board / case detail / meeting detail / attachment listing / referral inbox — gated BEFORE policies repoint** |
| **1** | **B** | `case_access_grants` hard-cut (D5); re-cut grant/revoke/list doors; **repoint `attachment_confidentiality_ok` (D5·4 — blocking)**; retire the `case_access` flag (D9) | **Medium** | read / write / Standard PHI / Restricted PHI / access-admin independently grantable; ceiling intact; one resolver path, no dead arm |
| **2** | **C** | Meeting boundary, strict (D6) | **Medium** | linked case material requires **both** meeting and case authority; **no `commission_default` regression** — CCIH's routine meeting still reads |
| **2** | **F-min** | Referral predicate split + write gate (D7); Storage repoint | **Medium** | target cannot overwrite transmitted identity; `set_referral_patient` gone from the public API |
| **2** | **NSP** | Drop the PHI arm from `can_read_case_patient` (D8) | **Low** | NSP keeps content reach on referral-touched cases; PHI requires an explicit grant |
| both | **G** | Cleanup (retire `can_read_case_or_admin`, `can_reach_case_on_member_surface`), type regen, advisors, full gates | **Low-Medium** | pgTAP + prod-build E2E + QA green |

**Post-pilot:** Stage D (NSP Investigations) · Stage E (attachment sensitivity: row-aware
`can_read_attachment` + tier→clearance mapping) · F-full (disclosure governance) · break-glass
workflow · `pqs_*` → `nsp_*` rename.

**No shared or remote database migration is authorized by this ADR.** Remote rollout happens at the
pilot reset, with separate user approval.

---

## Divergences from the handoff (each deliberate, each verified)

| # | Handoff says | This ADR | Why |
|---|---|---|---|
| 1 | Replace the "single `can_read_case` boolean" | It is already a multi-arm union behind 0072 hard-denies | Verified against 109 migrations |
| 2 | §5.1 — preserve/harden `memberships` | **No work** | ADR 0075 already satisfies every invariant |
| 3 | `meeting_cases` is an unbounded leak | Already gated by `...001070`; Stage C is a **product tightening** | Verified; ADR 0072 D2·8 |
| 4 | `case_capabilities` (jsonb) is the source, wrapper for perf | **Private bitmask core**; both are projections | jsonb-per-row is unimplementable under row-correlated RLS (D2) |
| 5 | Migrate `case_access` level → capabilities | **Hard-cut, no migration** | Pre-launch; old PK cannot hold the new model (D5·1) |
| 6 | §11.1 — phase assignees hold `write_case_content` | **No assignment write arm** | They don't today; adding it widens (D10) |
| 7 | §7.3 + §11.4 — Restricted PHI never from Coordinator; can't delegate what you don't hold | Coordinator **delegates without holding** | The literal composition deadlocks; preserves today (D5·6) |
| 8 | §2.5 — Committee Member has no committee-wide case reach | **Member arm** for `commission_default` | Otherwise strict D6 breaks every ordinary committee (D11) |
| 9 | Rename to Committee Coordinator / NSP Member | **Docs only** | Permitted by §5.1; rename during rewrite is the F2/F3 trap (D12) |
| 10 | NSP visibility follows an investigation | **PHI arm dropped now; content arm until Stage D** | Investigations are post-pilot; the PHI hole is not (D8) |

---

## Consequences

- **Least privilege becomes real where it matters.** A read grant or a phase assignment stops opening
  patient identifiers. This is the change that justifies the program.
- **Access becomes explainable.** `sources[]` + `expiresAt` on the capability object let the UI say
  *why* access exists and when it lapses — today that is unanswerable.
- **Users lose access they would have had.** Organization/hospital admins lose case content (D4) and
  interview attachments (D4·2); ordinary members lose meeting case sections for cases they are not
  involved in **and** whose type is `explicit_grants_only` (D6+D11); NSP loses automatic PHI (D8).
  None are bugs; all are **clinical-workflow changes** requiring PO socialization before the pilot.
- **Ordinary committees are unaffected.** D11's member arm means CCIH's routine meeting reads exactly
  as it does today. The tightening bites precisely where it should.
- **Performance is a gated risk, not a footnote.** D2's bitmask core keeps per-row cost at today's
  level; `EXPLAIN (ANALYZE, BUFFERS)` is a **Stage-A exit criterion**, gated *before* policies repoint.
  Index every FK and every RLS-predicate column; use `(select auth.uid())`.
- **0072's semantics survive intact.** Deny-first, R6, the one confidentiality taxonomy, the
  `confidentiality_rank`-vs-FE-display-order warning, and the catalog-driven leak sweep are carried
  forward, re-expressed — not rebuilt.
- **The pilot moves.** This program lands before S4, which itself precedes the pilot. That is the
  price of not shipping a known PHI conflation.

## Follow-ups (application layer, not the security boundary)

- **Session revocation on deactivation.** Handoff §8.2 requires it. With D3's outer gate a stale JWT
  gets nothing from the database, so this is defence-in-depth, not the boundary — but it should be
  scheduled. (Supabase: deleting/deactivating a user does **not** invalidate existing access tokens.)
- **Minimum-necessary PHI field scoping** (handoff §7.2) — deferred with F-full.
- **UI capability contract** (handoff §9): loaders receive `CaseCapabilities` including `sources[]`
  and `expiresAt`; every mutation **rechecks** the database. Organization dashboards never fetch full
  case rows and filter in JavaScript.

## Test keystones (gate; **extend, never replace**, 0072's suite)

1. The full §11.1 case matrix, per persona, as `authenticated` — including **multiple simultaneous
   sources** (revoking one must not remove another valid source) and **deactivation denies all**.
2. **`read_case_content` WITHOUT `read_standard_phi`** — the Context·1 regression. The single most
   important new negative.
3. Deny-terms cannot be out-voted **at the policy layer** — 0072's catalog-driven leak sweep over
   every `case_id`-bearing table, both persona classes, fail-closed, **extended per-capability**.
4. **The member arm, both directions:** a CCIH member reads a `commission_default` case's meeting
   section (**no regression**); the same member reads **nothing** of an `explicit_grants_only` case —
   not content, not overview, not its existence.
5. Meeting: attendee without case access cannot read the linked case section; case reader without
   participation cannot read the meeting.
6. Referral: target cannot overwrite the transmitted identity; `set_referral_patient` is gone;
   metadata reader sees no PHI body, path, or sensitive title.
7. NSP: an operator on a referral-touched case reads content but **not** patient identifiers (D8).
8. Grant doors: no direct authenticated DML; no self-grant; no self-escalation; `write ⇒ read` and
   `restricted ⇒ standard` enforced by CHECK; PUBLIC execute revoked; the three unreachable `source`
   values are **unreachable** (D5·5).
9. `_case_caps` ↔ `case_capabilities` ↔ `has_case_capability` agree across the full matrix (D2).

---

# Amendment 1 — Meeting confidentiality, corrected against real committee practice

**Date:** 2026-07-15 (same day) · **Status:** 🟢 **ACCEPTED**
**Trigger:** a PO domain interview walked a concrete scenario — *an ethics complaint about an
altercation between two doctors* — through the model end-to-end. It found **one factual error in
D11**, showed that **D6's meeting rule was aimed at the wrong threat**, and surfaced two content
surfaces the original ADR never gated. The body above is left intact; this amendment is the record
of what changed and why.

> **Why an amendment and not a rewrite.** D6 was ratified strictly at the PO's explicit direction,
> over the lead's recommendation. That ruling was made on an incomplete picture that the lead
> presented. Rewriting the body would erase both the original decision and the evidence that
> overturned it.

## A1 — D11 CORRECTION: the ethics default was backwards

D11's table reads *"Ethics complaint" → `explicit_grants_only`*. **This is wrong.**

Per the PO (2026-07-15): **most ethics complaints are handled by the plenary**; a sub-group handles
only specific scenarios. Both must be supported.

| | Was (wrong) | Is |
|---|---|---|
| `case_types.default_visibility_policy` for ethics | `explicit_grants_only` | **`commission_default`** |
| Sub-group handling | (the assumed norm) | **per-case override** to `explicit_grants_only`, set by the coordinator |

**No schema change** — `case_types.default_visibility_policy` was already a creation-time default and
`cases.visibility_policy` was already per-case overridable (D11/E). Only the seeded default was
backwards.

**The architecture was already right; the domain assumption was wrong.** For a plenary complaint,
`commission_default` + D11's member arm means every member reads it, and ADR 0072's
respondent/recusal hard-denies — evaluated first, unable to be out-voted — do **all** the protective
work. That is a Comissão de Ética Médica, modelled exactly. **The member arm is not an edge case for
ethics; it is the main path.** The threat is the **respondent** and the **recused**, never "members
in general".

## A2 — D6 REPLACED: conjunct A is dropped as a universal rule

D6 repointed **all** meeting content from commission membership to Meeting Participation
("conjunct A"), and gated case-specific fields on case authority ("conjunct B").

**Conjunct B stands, strict, unchanged.** **Conjunct A is withdrawn** and replaced by an opt-in
per-meeting policy. Five findings forced this:

1. **It does not solve the problem it was introduced for.** A confidential case discussed in a
   meeting with eight attendees is read by all eight — including the six with no business in it.
   Attendance and case-authority are unrelated dimensions.
2. **It actively breaks ETH·E1's recusal guarantee.** Dr. Ana is recused from process 47 and leads
   process 52. She attends the meeting (present for item 5, withdrew for item 4), so
   `attendance = 'present'` — and conjunct A therefore hands her the full ata **including the case she
   is formally recused from**. It routes around ADR 0072's central invariant via the meeting surface.
   She cannot be marked absent to fix this: `attendance = 'present'` drives quorum in
   `conclude_meeting` and signature eligibility in `app.can_sign_meeting`, so protecting the case
   would falsify the quorum of a meeting she legitimately attended.
3. **Attendance is a fact; authorization is a policy.** Fusing them means a secretary *correcting the
   attendance record* silently mutates who may read the ata.
4. **It amputates the ata's purpose.** Minutes exist so that those *absent* learn what was decided.
5. **It has a silent access cliff.** `create_meeting` does not auto-seed the roster, and
   `seed_selected_meeting_attendees` seeds only a subset — so an unseeded meeting would be readable
   by nobody, and a non-invited member would be locked out of the institutional record forever.

### A2·1 — `meetings.visibility_policy` (the replacement)

Mirrors `cases.visibility_policy`. The UI hook **already exists** — the "Nova reunião" dialog's
*Participantes* section (`seed_selected_meeting_attendees`) already builds a sub-group roster; today
that roster carries **no authorization meaning at all**, because `meetings_select` is
`is_member_of(commission_id) OR is_commission_admin_of(commission_id)`.

```sql
meetings.visibility_policy ∈ ('commission_default', 'participants_only')
```

```
reach(meeting) = app.is_member_of(commission)
                 AND ( meetings.visibility_policy = 'commission_default'
                         OR principal is an attendee of the meeting )
```

- **Plenary meeting** → `commission_default` → every member reads the ata (today's behaviour, **no
  regression**); reserved items gated per-case underneath.
- **Sub-group meeting** → `participants_only` → only the selected participants read it.

This *is* conjunct A — **opt-in per meeting rather than universal** — which answers every objection
above: absent members keep the ata on ordinary meetings; unseeded meetings need no roster; and for a
`participants_only` meeting the roster **is** the deliberate access decision, chosen at creation, so
correcting it *should* change access.

**Binding constraints:**
- `app.is_member_of` stays AND-ed. **A coordinator cannot invite someone from another committee**
  (PO, 2026-07-15). An invited outsider would have a roster row and no access.
- **No coordinator OR-arm on `reach(meeting)`.** A coordinator recused from the sub-group's case must
  not read that meeting. To manage it, they must be a participant — and if recused, another member
  runs it.
- `visibility_policy = 'participants_only'` **requires a non-empty roster** (enforced in the DB, not
  only the dialog) — otherwise the access cliff of finding 5 returns.
- ⚠ **Stage-A inventory item:** `meetings_staff_admin_write` must be checked for `FOR ALL`. If it is
  `FOR ALL` PERMISSIVE it grants SELECT and a recused coordinator reads around the above — precisely
  ADR 0072 delta 3's second shape, invisible to grep.

## A3 — 2b: the agenda-item leak (exists TODAY; conjunct B alone does not close it)

`meeting_agenda_items.discussion_notes` and `.resolution` are gated **member-wide** and are
**PHI-BEARING** by their own column comments. So a scribe minuting a reserved item has two boxes —
`meeting_cases.summary` (which conjunct B gates) and `agenda_items.discussion_notes` (gated by
nothing) — and the ungated one is the more natural place to type.

Gate them through the item's case link (`meeting_cases.agenda_item_id`, which already exists), on the
same rule as `meeting_cases`. Small; closes a live hole; lands in Stage C.

## A4 — 2a: `meeting_closed_sessions`, for case-less pre-formal discussion ONLY

**Justification (PO):** the most sensitive conversation happens *before* anything is formalized —
*"should we even open a case about this?"*. If the platform has no home for it, it moves off-platform
and the governance record is lost entirely. For an accreditation product an **unminuted** conversation
is worse than an over-broadly-readable one.

Once A1/A2 land, **2a's scope narrows to exactly one scenario**. The four real cases decompose:

| Scenario | Mechanism | New schema |
|---|---|---|
| Plenary meeting · reserved item · **plenary case** | conjunct B + member arm (recused denied by case authority) | none |
| Plenary meeting · reserved item · **sub-group case** | conjunct B (granted only) | none |
| **Sub-group meeting** | `meetings.visibility_policy = 'participants_only'` (A2·1) | one enum column |
| Plenary meeting · **pre-formal discussion, no case** | **`meeting_closed_sessions`** | **2a — this only** |

### A4·1 — Shape: separate the *block* from the *subject*

The PO chose "a reserved session may span several agenda items". Physically, if Ana must leave for
item 3 but stay for item 4, those are two different room compositions — so a multi-item session can
only be a **time block**, never an **access unit**. Therefore:

```
meeting_agenda_items                    -- the pauta skeleton. Member-wide. ALWAYS.
  position, is_closed, title            -- title = the process number (A5)

meeting_closed_sessions                 -- the reserved BLOCK. May span items.
  meeting_id, position, opened_at, closed_at
  -- governance metadata ("reserved 15h00–15h40"). Carries NO authorization.

meeting_closed_session_items            -- the SUBSTANCE, per subject. REACH RESOLVES HERE.
  closed_session_id, agenda_item_id (unique), case_id (nullable)
  subject_title, minutes_md

meeting_closed_session_item_readers     -- consulted ONLY when case_id IS NULL
  item_id, principal_id
```

```
reach(item substance) =
    reach(meeting)                                            -- A2·1
    AND ( item.case_id IS NULL
            ? principal is on that item's reader list
            : app.has_case_capability(item.case_id, uid, 'read_case_content') )
```

**Direction is non-negotiable:** for a subject with a `case_id`, **case authority governs and the
reader list is never consulted**. Otherwise a coordinator adding someone to a reserved roster would
hand them a case they are recused from — rebuilding the hole ETH·E1 closed, one table over. The reader
list governs **only** case-less subjects.

**Graduation path:** a reserved subject starts `case_id = NULL` with a reader list; when the committee
resolves to open a case, setting `case_id` migrates it onto case authority permanently — and the
deliberation that *created* the case stays attached to it.

## A5 — Three tiers of meeting content (not two)

Per the PO: **pautas are named by process number**, and **only non-recused members see the outcome of
a decision**.

| Tier | Content | Reach |
|---|---|---|
| **Procedural shell** | item exists · *"Processo nº 047"* · reserved · who withdrew and why · times | **all members, including the recused** — `is_member_of` |
| **Substance** | deliberation · evidence · relator's report | case authority (plenary ⇒ all non-excluded members; sub-group ⇒ granted only) |
| **Decision** | *arquivado / instaurado / encaminhado ao CRM* | **member AND NOT excluded** — uniform, regardless of `visibility_policy` |

**The shell must be visible — it is the proof of propriety.** The ata *must* record *"Dra. Ana
declarou-se impedida e retirou-se às 15h00."* Remove it and the committee cannot demonstrate the
deliberation was untainted. Ana knows item 3 exists — **she declared the conflict herself**. What she
must not see is the substance.

**The decision tier is BROADER than the substance tier.** A member who cannot read process 52's
investigation still sees *"Processo 052 — arquivado"*: the committee is a body and must know the
outcomes of its own processes even when a sub-group did the work. The gate is **recusal, not grants**.

⚠ **Schema consequence, not preference:** `minutes_md` (substance) and `decision` (outcome) carry
**different gates on the same conceptual row**, and **RLS is row-level**. `decision` must therefore be
its own row/table — it cannot be a column beside `minutes_md`.

**Pauta titles need no derivation rule.** Since pautas name process numbers, the item shows the number
when a case exists and *"Matéria reservada"* when it does not (pre-formal, which has no number).

## A6 — O5 refined: existence is not secret *within* the committee

O5 ruled that a member cannot discover an `explicit_grants_only` case exists. Real practice diverges:
a sub-group case appears **by number in the pauta**, and its **outcome is member-wide** (A5).

O5 **stands for the case board** — a member browsing cases must not stumble on process 52. The
**meeting surface deliberately reveals more**, because the committee is a body and its pauta is its
own procedural record. Different surfaces, different purposes. **Recorded so it is not "fixed" later.**

## Amendment 1 — open decisions

- **O6 — Does the respondent see the pauta?** If Dr. X is a committee member *and* the respondent in
  process 047, the member-wide shell (A5) shows him *"3. Processo nº 047 — sessão reservada"* in his
  own committee's pauta, while `app.is_case_respondent` hard-denies him the case. Due process arguably
  **requires** he know he is being processed — but the two surfaces disagree and it must be deliberate.
- **O7 — Signatures for reserved content.** `meeting_signatures` attests the meeting via
  `app.can_sign_meeting` (keyed on `attendance = 'present'`). A `participants_only` meeting needs no
  change (its participants *are* the signers). But does a **reserved session inside a plenary meeting**
  get its own signature set, signed by its participants? **Lead recommendation: no pre-pilot** — the
  meeting-level signature covers the record including annexes; revisit if practice demands.
- **O8 — Who may open a reserved session?** It is an access-granting act for case-less subjects (the
  opener chooses the reader list). **Lead recommendation: coordinator-only** — not an `administrativo`
  delegated capability like `schedule_meetings`.
- **O9 — Where does a sub-group meet?** Resolved by A2·1 (`participants_only`) for the *meeting*. Not
  resolved: whether a sub-group's *investigation* should live wholly in the Case (phases, narratives,
  interviews) and surface to the plenary as the relator's report. **Lead recommendation: yes** — the
  sub-group's work *is* the Case; no sub-group entity is needed.

## Amendment 1 — added test keystones

10. **Recusal survives the meeting surface** — Ana, recused from case 47 and lead on case 52, attends
    a plenary meeting covering both: she reads item 5 in full, sees item 4's shell (including her own
    recorded withdrawal), and reads **neither** item 4's substance **nor** its decision.
11. **Plenary ethics case is member-wide** — a non-excluded member reads a `commission_default` ethics
    complaint and its meeting section, with **no regression** vs today (A1).
12. **`participants_only` meeting** — a non-participant member reads **nothing**; an invited
    non-member of the commission reads nothing; a **recused coordinator** who is not a participant
    reads nothing (incl. via any `FOR ALL` write policy).
13. **Empty roster** — `visibility_policy = 'participants_only'` with no attendees is **rejected at
    write time**, not silently unreadable.
14. **Agenda-item leak closed** — deliberation written to `meeting_agenda_items.discussion_notes` on a
    case-linked item is gated identically to `meeting_cases.summary` (A3).
15. **Reader list never out-votes case authority** — adding a recused principal to a reserved item's
    reader list on a **case-linked** subject grants nothing (A4·1).
16. **Decision tier** — a member without substance reach on a sub-group case still reads the decision;
    a **recused** member reads neither (A5).
