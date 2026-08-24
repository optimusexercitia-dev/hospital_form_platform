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
`has_case_capability` is a bit test — an int, no allocation. ~~Per-row cost stays what `can_read_case`
costs **today**, so there is no performance regression to defend.~~

> ⛔ **THE STRUCK SENTENCE IS AN ASSUMPTION, NOT A MEASUREMENT — AND A2's STRUCTURE ARGUES AGAINST IT**
> (`qa`, A2 review, 2026-07-16 — MAJOR-1, filed against **A5**, not A2). *"No performance regression to
> defend"* was **never measured**, and it is the justification for the entire bitmask design. Two
> structural reasons it is likely false:
> 1. **`_case_caps` has NO short-circuit.** It computes `v_coord`, `v_orgadmin` **and** `v_member`, plus
>    up to **4 `EXISTS`**, on **every** call. Today's `can_read_case` is a **short-circuiting `OR`** — a
>    coordinator costs **one** arm. The resolver makes the cheapest principal pay for the most expensive.
> 2. **`has_case_capability` re-runs the WHOLE resolver per bit test.** `STABLE` does not memoize across
>    **row-correlated** args (`case_id` varies per row) — which is D2's own opening argument, turned back
>    on it.
>
> **Measured: 0.55 ms/row vs 0.054 ms for a single arm — ~10×.** `qa` **correctly declined to call this
> a regression**: the pre-image was not measurable to it, so ~10×-vs-one-arm is **not** the same claim as
> ~10×-vs-today's-body. ⚠ **This is exactly the comparison A5 must make and must not fudge.**
>
> **⛔ BINDING ON A5 — the pre-image is NOT recoverable from file text** (M5b rewrites `can_read_case` at
> runtime via `pg_get_functiondef()` + `replace()`; **reading the migration gives a body that never
> ran**). **Get it the only way that works: move `20260729000000_authz_a2_capability_resolver.sql` out of
> `supabase/migrations/`, `supabase db reset --local`, and `EXPLAIN (ANALYZE, BUFFERS)` the OLD body —
> then restore and re-reset.** Compare **old body vs resolver**, per D4·3's gated surfaces (case board,
> case detail, meeting detail, attachment listing, referral inbox). **A4 repoints ~12 tables onto this
> resolver; A5 is the gate that must run BEFORE it does, and A5 is a HARD exit criterion.**

> ✅ **A5 RAN AND PASSED — no migration (`backend`, lead-corroborated, 2026-07-16).** Measured
> `EXPLAIN (ANALYZE, BUFFERS)` on a **2005-case** synthetic dataset (4× re-measured), pre-image captured
> by moving **both A2 and A4** out (A4 sits on A2) + `db reset`, median of 5, as `authenticated`.
> **Resolver is parity-or-FASTER on every legitimate surface and strictly LINEAR** (per-row cost flat 1×
> → 4×; every `EXISTS` index-backed). Pre-A2 vs resolver: cases/coordinator **1.02×**, cases/member
> **0.73× (faster)**, narratives/member **0.75×**. **`qa`'s MAJOR-1 ~10× was resolver-vs-a-single-arm; on
> the real surface vs the real pre-A2 body it does not exist** — the member path is *faster* because A4
> collapsed the `can_read_case_or_admin` wrapper (a second deny body) the pre-A2 member read paid for.
> **Lead corroboration (independent, in-txn, 2005 cases):** member **0.496 ms/row** / coordinator
> **0.183 ms/row** — matching `backend`'s 0.59 / 0.205 within noise; the plan shows **Bitmap Index Scan**
> (the linearity mechanism) and the coordinator's resolver InitPlan reads **"never executed"** (the
> `is_staff_admin_of` permissive-sibling short-circuit, proven not asserted). ⚠ **Report correction, verdict
> unaffected:** *"the case board has 0 resolver cost"* is true **only for coordinators** — `list_cases_board`
> filters non-coordinators with `(v_is_coordinator OR app.can_read_case(...))` **per row**, and the plain
> RLS `cases` path does the same, so a **non-coordinator member pays the resolver per row on the board**;
> `backend` measured exactly that path (cases/member, faster + linear), so PASS holds. **Referral inbox is
> correctly out of scope** — `can_read_referral*` never call the resolver (verified). ⭐ **Deferred, PO
> ruling: dropping `manage_case_access`** — measured **~19%** of per-row cost (`is_commission_admin_of_for`
> traverses the tenancy hierarchy; `backend` *measured* this rather than inferring it, having wrongly
> guessed "cheap" first — §7.11), **0 consumers** (proven at A4), so droppable — **but it is a RESERVED
> bit, a semantic change needing its own keystone + `qa`. Not required for the gate** (A5 passes without
> it). A separate follow-up, not folded into A5.

Fail-closed evaluation order inside `_case_caps`:

```
1. null user                          → 0
2. NOT app.is_active(p_user_id)       → 0            ⟵ D3, the outer gate
3. resolve case tenant anchors; absent/mismatch → 0
4. HARD DENY (ADR 0072, preserved verbatim, BEFORE every positive arm):
     app.is_case_respondent | app.is_recused_from_case  → 0
5. union positive sources (D11)
6. apply lifecycle restrictions to write bits          ⛔ DELETED — Amendment 3 (A24·3)
7. return the bitmask
```

> ⛔ **Step 6 is DELETED.** "Lifecycle" is defined **nowhere** in this ADR, and **D10 says write =
> Coordinator OR active write grant, *"Full stop."*** Catalog: terminal-freeze lives in the
> `app.guard_case_status` trigger (`HC025`) with an `app.in_case_rpc` escape hatch a `STABLE` resolver
> cannot replicate, and `can_write_case_content` has **no status check at all**. Inventing one here
> **narrows beyond today** and breaks every close-case RPC that writes content in the same
> transaction. **The order is six steps. The trigger stays.**

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
> ⛔ **D4·2's "fixed for free" IS FALSE AT THE BYTES LAYER — and the hard deny does not reach Storage
> at all.** Found by `backend` at A4's contract, **proven by execution** by both `backend` and the lead
> (2026-07-16). True for the `attachments` **metadata** table. **False for the bytes**: they live in
> `storage.objects` under **`case_documents_select_member`**, whose qual is
> `bucket_id = 'case-documents' AND (is_commission_admin_of(folder[1]) OR is_member_of(folder[1]) OR
> can_read_snapshot_document(...))` — it carries **its own org arm**, **never routes `can_read_attachment`
> or `can_read_case`**, and has **no exclusion term**. ⭐ **The defect is the ANCHOR, not a missing `AND`:
> `folder[1]` is a COMMISSION id, so the policy is commission-scoped and CANNOT test case-level exclusion
> — it never knows which case the bytes belong to.** ⚡ **Measured:** a member **recused** from an
> **`explicit_grants_only`** case, with **`can_read_case = false`**, **reads the case-document bytes**;
> `platform_admin` reads 0 (the control). ⇒ **every commission member reads every case file, and
> `explicit_grants_only` is defeated at the bytes layer, on PHI-capable artifacts.**
> **Same shape: `interview_attachments_obj_select_member`.**
> ⭐ **The general form — the finding this program was missing: ADR 0072's hard deny lives INSIDE the
> case read predicates. EVERY door that authorizes without calling one is outside the perimeter by
> construction** (the grant doors, the two storage policies, `interview_sessions_write`,
> `case_interviews_{update,delete,insert}`). **Its own unit — "the exclusion perimeter" — PO-sequenced
> after A5.** `docs/progress/authz-handoff.md` §5. **A4's population takes the two storage policies'
> ORG arm; the exclusion half is that unit's.**

2. **Attachments.** `can_read_attachment` is owner-keyed; its `'case'` arm delegates to
   `can_read_case`, so ~~**case attachments are fixed for free** by (1)~~ **(⛔ metadata only — see
   above)**. Its `'interview'` arm carries
   its own admin term — **removed** (interview attachments are case-linked and PHI-capable, exactly
   what D4 exists to kill). ~~Its `'meeting'` arm **keeps** its admin term: meeting attachments are
   governance artifacts (agendas, minutes, accreditation evidence) that admins have a legitimate
   PHI-free reason to read, and `attachment_confidentiality_ok` already fails closed for gated labels
   on meeting-owned rows. **D4 is about clinical access, not about administration.**~~

   > ⚠ **D4·2's meeting arm is REVERSED — see Amendment 2 (A8/A9).** The struck rationale does not
   > survive the PO's 2026-07-15 decision that Organization Users lose the **entire** meeting surface:
   > an admin who cannot read the ata must not read it as a PDF. The `'meeting'` arm is **removed**
   > from `can_read_attachment` and `can_write_attachment`. **The `'interview'` half above stands.**
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

~~Meeting content reads repoint from bare commission membership to **Coordinator or Meeting
Participation** (`meeting_attendees`).~~ Case-specific meeting fields (`meeting_cases.summary` /
`.decision`) require **both** authorities.

> ⛔ **CONJUNCT A (the struck sentence) IS WITHDRAWN — see Amendment 1 (A2 / A2·1).** Replaced by
> **`meetings.visibility_policy`**, opt-in per meeting. Implementing the struck text hands a **recused
> member** the ata of the case she is recused from (she is `attendance = 'present'`, which drives
> quorum), creates the unseeded-meeting access cliff, and installs the coordinator OR-arm A2·1
> forbids. **Conjunct B — the surviving sentence — stands, strict.**
>
> ⚠ **And its case capability changed:** the rule is
> `reach(meeting) AND has_case_capability(case, 'read_case_deliberation')` — **not**
> `read_case_content` (Amendment 3, A15).
>
> **D6 is the entire named scope of Stage C in the staging table below. It is the first thing an
> implementer opens. Read Amendments 1 and 3 before building any of it.**

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
   > ⚠ **SCOPE AMENDED 2026-08-24 (PO ruling; ADR 0137 Amendment 1).**
   > `can_amend_referral_phi_snapshot` governs **only re-saving PHI on a DRAFT referral**.
   > `public.set_referral_patient` refuses every non-`draft` status itself (`HC078`, migration
   > `20261003001700`), because post-send PHI amendment is **not a product capability**. ⛔ Do not
   > cite this predicate as evidence that a sent referral's PHI can be corrected — until that
   > migration the door reached its own trailing `case_referral` update and was refused by a status
   > trigger, so the amend branch had never completed for any status it was written for.
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

> ⛔ **"MEMBER-WIDE READ" UNDERSTATES IT — THE SECOND OFF BRANCH CONFERS PATIENT IDENTIFIERS (Rule 12).**
> Amended 2026-07-16 (`backend`, A2 contract C5; lead-verified from `pg_get_functiondef`). This decision
> already said **"both OFF branches"** — correctly — but described them in **content** terms only, so a
> Stage-B author retiring the flag would not know **Rule 12 is in the blast radius**. Stated plainly:
> **`app.can_read_case_patient`'s OFF branch returns `is_member_of_for` for a `commission_default` case
> — a plain committee member reads `name` / `mrn` / `date_of_birth`.** Both OFF branches carry the E1
> belt (`explicit_grants_only` → coordinators only); both fall through to member-wide underneath it.
> Measured at A2's contract: flipping the flag off takes `can_read_case_patient` from **27 → 54**
> reachable cells of 196. **Deleting the flag deletes a live-if-reachable PHI arm — that is a feature of
> D9, not a side effect, and it is the strongest argument for doing it.**
>
> ⚠ **Nothing tested this branch until A2.** `228` t24 pins `can_read_case` at flag-OFF; **no test
> pinned `can_read_case_patient` at flag-OFF** — the arm's own unreachability is why nobody was ever
> owed a test for it (§7.1·4). **A2 carries it faithfully** (removing it inside A2 would be a narrowing
> smuggled into a mechanism swap — D4·3) **as a NAMED source, `case_access_flag_off_legacy` ⇒
> `read_case_content` + `read_standard_phi`, pinned by keystone K12 both legs.** Stage B's deletion then
> lands as a **visible red**, not a silent drop. **Do not preserve this branch when retiring the flag.**

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
⇒ read_case_content        — and NEVER read_standard_phi, NEVER write_case_content     ⛔ WRONG
```

> ⛔ **`⇒ read_case_content` IS A WIDENING — see Amendment 3 (A15).** Verified: today an ordinary
> member reads **one** row type (`meeting_cases`, via the *one* policy consuming
> `can_reach_case_on_member_surface`); `read_case_content` gates **~12 tables**, two of them labelled
> **PHI-BEARING free text** by the schema. **The arm confers `read_case_deliberation`** — the minuted
> discussion only. The case file stays with the coordinator, the assignees, and explicit grants.

Without it, strict D6 makes a routine CCIH meeting unreadable to the twelve members who were *in the
room*: `can_read_case` has **no plain-member arm** on the `case_access`-ON path, which is exactly why
`...001070` needed `can_reach_case_on_member_surface` three days ago. With it, D6's rule is
*literally strict* — reach genuinely comes from `read_case_content` — and ordinary membership
legitimately confers that for ordinary cases. Ethics stays grant-only. PHI is never implied.

**One authority, not two.** `case_types` gains **`default_visibility_policy`**, a **creation-time
default only** (~~"Ethics complaint" → `explicit_grants_only`~~; "Infection event" → `commission_default`).
`cases.visibility_policy` remains the **sole runtime authority** the resolver reads, and a coordinator
may still override one case.

> ⛔ **THE ETHICS DEFAULT ABOVE IS WRONG — see Amendment 1 (A1).** It is
> **`commission_default`**; sub-group handling is a **per-case override**. Most ethics complaints are
> handled by the **plenary** (PO, 2026-07-15). This is a one-token value that goes straight into
> `seed.sql` — seeded from the struck text, every ethics complaint is created invisible to the
> plenary that actually handles it, the member arm never fires, and nothing tests it. This deliberately avoids a second authorization switch — two knobs over
one semantic is where leaks breed. It also reuses predicates already proven by ETH·E1's pgTAP.

**Derived (resolves ADR 0077's O5):** for a **member**, `view_case_overview` reach **==**
`read_case_content` reach. The existence of an `explicit_grants_only` case is **not discoverable** —
in a small committee, a case number plus a date plus a sudden recusal identifies the respondent, and
the respondent is a committee member. `view_case_overview`'s *extra* reach exists for Organization
Users and NSP (PHI-free aggregates), not members. ~~Consequently
**`app.can_reach_case_on_member_surface` becomes redundant** — its semantics *are*
`has_case_capability(case, uid, 'read_case_content')` under this model, minus the admin arm D4 removes
anyway — and it **retires at Stage G**, with the member surfaces becoming capability-resolved.~~

> ⛔ **The redundancy claim is FALSE and the retirement is WITHDRAWN — Amendment 3 (A15·2).**
> `can_reach_case_on_member_surface` is consumed by **exactly one** policy (`meeting_cases_select`);
> `read_case_content` will gate **twelve tables**. Its semantics are **`read_case_deliberation`**,
> exactly — ETH·E1 built the right predicate. **It survives as that bit's projection.**
>
> ⚠ **Scoping, also amended.** *"Existence is not discoverable"* holds **only for the case board**
> (A6): the pauta names process numbers and the decision tier is member-wide, both deliberately.
> And `view_case_overview` reach is **NOT** `read_case_content` reach for a member — the lattice rung
> breaks (A16); a member reads the ata section **without** the board row, which is today's behaviour.
> `view_case_overview` ships as a **reserved, unconsumed bit** (A16).

> ⭐ **`read_restricted_phi` is RESERVED too — same status, stated because it wasn't** (`backend`, A2
> contract C7, 2026-07-16). A2 ships **three** of seven bits unconsumed, and until now only **one** was
> blessed. `read_restricted_phi` has **no live consumer**: `can_read_case_patient` **ignores
> `max_confidentiality`**, whose ceiling governs **documents**, not the patient store — so a wrong RRP
> wiring has **zero blast radius today**, and **keystone 31 is falsifiable against the resolver but
> asserts nothing about reach.** That is acceptable, and it is **not** A36's unconsumed-bit problem:
> that rule forbids a **narrowing** shipped as an uncomsumed bit, landing silently in a later unit with
> no failing test in between. A reserved bit with no consumer is a **placeholder**, not a removal in
> disguise. **The distinction is the direction of the risk** — `read_standard_phi` unconsumed *would*
> have been A36's problem, which is exactly why M3 preceded A2.

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
3. **SQLSTATE block `HC0F0–HC0F9`** — ⚠ **corrected from `HC0G0–HC0G9` at M1 (2026-07-15).** The
   mandated collision-check found **`HC0G0`/`HC0G1`/`HC0G2` already held by `grant_role`/`revoke_role`**
   (catalog-verified). `HC0F` is free repo-wide and is adjacent to the `HC0E` case-participants family.
   *The "collision-checked at freeze" claim above was false — the check had never been run.*
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

> ⛔ **THE SCOPE AND DIFFICULTY COLUMNS BELOW ARE STALE — Amendments 2 and 3.** **Stage A** is
> materially bigger: D4·1 is a **no-op** as scoped there (**A21** — the admin arm's real read path is
> eight `FOR ALL` policies, plus the case RPCs and `can_write_attachment`'s `'case'` arm). **Stage C**
> absorbed `meetings.visibility_policy` + the roster constraint (A2·1), the agenda-item gate (A3),
> **four new tables** (A4·1), a four-tier DEFINER RPC (A7), the Organization User's removal (A8–A11),
> and the re-cut of **four more `FOR ALL` policies** (A13) — it is now the **largest stage in the
> program**, not "Medium". **Amendment 2's and 3's work has no row in this table at all.** The plan's
> Gate-2 section is authoritative for Stage C; the two-gate split's rationale ("risk is concentrated in
> A+B") survives, but **A+B is bigger than it looks here**.

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
- **Users lose access they would have had.** ~~Organization/hospital admins lose case content (D4) and
  interview attachments (D4·2); ordinary members lose meeting case sections for cases they are not
  involved in **and** whose type is `explicit_grants_only` (D6+D11); NSP loses automatic PHI (D8).~~
  None are bugs; all are **clinical-workflow changes** requiring PO socialization before the pilot.
- ~~**Ordinary committees are unaffected.** D11's member arm means CCIH's routine meeting reads exactly
  as it does today. The tightening bites precisely where it should.~~

> ⛔ **BOTH BULLETS ARE STALE — see Amendments 2 and 3.** This list is the **named input to "PO
> socialization before the pilot"**, so its being short is the whole failure. The actual losses:
> Organization Users lose **case content AND case write AND the case RPCs** (A21), the **entire
> meeting surface AND meeting management** (A8), meeting + interview attachments (A9, D4·2), and
> `committee` / `assignees_only` action items (A11) — keeping only configuration, staffing, the grant
> door (A18), and the audit log. Members lose meeting case sections on `explicit_grants_only` cases and
> on `participants_only` meetings. NSP loses automatic PHI (D8).
>
> ⛔ **"Ordinary committees are unaffected" was FALSE** — D11's member arm was a widening from one
> table to twelve (A15). **After A15 it is true**, which is the point of the correction: the claim now
> describes the design instead of excusing it.
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
   not content, not overview, ~~not its existence~~.
   > ⚠ **Scope it to the CASE BOARD (A6).** On the **meeting** surface the pauta names the process
   > number and the decision tier is member-wide — **deliberately**. Applied to the meeting surface
   > this keystone asserts the direct negation of keystones **10** and **16**.
   > ⛔ **This keystone cannot detect the A15 widening** — it asserts *no regression*, and a widening
   > passes that by construction. **Keystone 22 is its missing other half.**
5. Meeting: attendee without case access cannot read the linked case section; ~~case reader without
   participation cannot read the meeting~~.
   > ⛔ **The struck clause asserts conjunct A, which A2 withdrew.** It fails on every
   > `commission_default` meeting, and the "fix" would be to reinstate conjunct A. Its **first** clause
   > stands. See keystone 21.
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
meeting_agenda_items                    -- the pauta skeleton. Member-wide. ALWAYS.   ⛔ see below
  position, is_closed, title            -- title = the process number (A5)            ⛔ see below

meeting_closed_sessions                 -- the reserved BLOCK. May span items.
  meeting_id, position, opened_at, closed_at
  -- governance metadata ("reserved 15h00–15h40"). Carries NO authorization.

meeting_closed_session_items            -- the SUBSTANCE, per subject. REACH RESOLVES HERE.
  closed_session_id, agenda_item_id (unique), case_id (nullable)
  subject_title, minutes_md             -- ⚠ needs a DECISION field too — A7, one row per tier

meeting_closed_session_item_readers     -- consulted ONLY when case_id IS NULL
  item_id, principal_id
```

> ⛔ **"Member-wide. ALWAYS" + "title = the process number" contradicts A7/O6.** A7's **propriety
> tier** denies the **respondent** the process number (`is_member_of AND NOT is_case_respondent`), and
> **O6 ruled exactly that** (*"a respondent does not need to see his own process number"*). Landed as
> written — a permissive member-wide SELECT with the number in `title` — **the respondent reads his own
> process number straight off the skeleton table**, defeating O6 through the adjacent-column route A3
> and A11 both warn about. **Keystone 10 does not catch it** (it tests the *recused* Ana, not the
> respondent).
>
> ⚠ **`minutes_md` alone is not enough.** A7 supersedes A5's forced split — *one storage row carries
> all four tiers* — but never amended this column list, which has **no decision field** and nowhere for
> the propriety tier's *"who withdrew and why"*. Authored from this list, the RPC has no decision to
> project.

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

**Pauta titles need no derivation rule.** Since pautas name process numbers, the item shows the number
when a case exists and *"Matéria reservada"* when it does not (pre-formal, which has no number).

> ⚠ **A5 CORRECTED (see A7).** This section originally asserted that `decision` *must* be its own
> row/table because it carries a different gate from `minutes_md` and RLS is row-level. That is true
> only if the read path is base-table RLS. **A7 supersedes it:** the reserved ata is served by an
> audited DEFINER RPC that projects per tier, so one storage row carries all tiers. The claim of a
> forced split was wrong.

## A7 — FOUR TIERS, one row, served by an RPC (supersedes A5's schema consequence)

O6's resolution (the respondent does **not** see his own process number) adds a fourth tier and makes
a base-table-RLS expression of this unworkable — four predicates over one conceptual row would need
four tables.

| Tier | Respondent | Recused | Other members | Predicate |
|---|---|---|---|---|
| **Bare stub** — *"3. Sessão reservada"* | allow | allow | allow | `is_member_of` |
| **Propriety record** — process number · who withdrew and why · times | **deny** | allow | allow | `is_member_of AND NOT app.is_case_respondent` |
| **Substance** — deliberation · evidence · relator's report | deny | deny | plenary: all · sub-group: granted | `reach(meeting) AND has_case_capability(case_id,'read_case_content')` |
| **Decision** — *arquivado / instaurado / …* | deny | **deny** | allow | `is_member_of AND NOT app.is_case_excluded` |

> ⛔ **THREE CORRECTIONS — this table is NOT implementable as written (Amendment 3).**
>
> 1. **`read_case_content` → `read_case_deliberation`** in the substance tier (**A15**).
> 2. **`is_member_of` → `reach(meeting)`** in the stub, propriety and decision tiers. As written, three
>    of four tiers ignore `meetings.visibility_policy`, so the RPC projects a **`participants_only`
>    sub-group meeting's stub, propriety record and decision to every non-participant member** — and to
>    the **recused coordinator keystone 12 names explicitly**. Contradicts A2·1.
> 3. **Every tier needs A4·1's `case_id IS NULL` branch (A24·4).** At `case_id IS NULL` — *the only
>    scenario A4 exists for* — `is_case_respondent(NULL,·)` and `is_case_excluded(NULL,·)` are both
>    **false**, so propriety and decision **allow every member**; and `_case_caps(NULL,·)` fails closed
>    at step 3, so substance **denies everyone, including the reader list**. A7 superseded A5 and
>    **silently dropped A4·1's reader list**. Case-less: substance and decision follow the **reader
>    list**; the propriety tier is **EMPTY** (no number, no recusal record exists), not "allow".
>
> **This is a table. Tables get implemented literally.** → keystones 12, 30.

**Note the asymmetry — it is deliberate and load-bearing.** The **recused** sees the process number
(she declared the conflict; her withdrawal is the propriety record). The **respondent** does not. So
the propriety tier gates on **`app.is_case_respondent` alone**, *not* on `app.is_case_excluded`
(= respondent OR recused). ETH·E1 already exposes the two as separate predicates, so the primitive
exists — but a reader who reaches for the familiar `is_case_excluded` here will silently blind every
recused member to the record of their own recusal.

**Read path:** `meeting_closed_session_items` gets **no authenticated SELECT**. The ata is served by
an audited `SECURITY DEFINER` RPC that projects the tiers the caller may see — the established pattern
(`get_case_patient`, `open_attachment`, `list_my_cases`) and consistent with §6.3's audited-RPC-read
rule. One row, one door, conditional projection.

**Respondent renders as a stub, never as a gap.** A missing position (items 1,2,4,5) is both
suspicious and uninformative; *"3. Sessão reservada"* is normal and reveals nothing. The respondent
sees the bare stub only — no number, no withdrawal list, no times.

> **Scope note:** this only arises when the respondent **is a committee member**. A respondent who is
> not a member of the committee reaches no meeting surface at all (`is_member_of` fails first).

## A6 — O5 refined: existence is not secret *within* the committee

O5 ruled that a member cannot discover an `explicit_grants_only` case exists. Real practice diverges:
a sub-group case appears **by number in the pauta**, and its **outcome is member-wide** (A5).

O5 **stands for the case board** — a member browsing cases must not stumble on process 52. The
**meeting surface deliberately reveals more**, because the committee is a body and its pauta is its
own procedural record. Different surfaces, different purposes. **Recorded so it is not "fixed" later.**

## Amendment 1 — open decisions · **ALL RESOLVED** (PO, 2026-07-15)

- **O6 — Does the respondent see the pauta? → NO.** *"A respondent does not need to see his own
  process number."* The propriety tier therefore gates on **`app.is_case_respondent` alone** — the
  **recused still sees the number** (A7). The respondent renders a bare *"Sessão reservada"* stub,
  never a gap. This answer added the fourth tier and **superseded A5's schema claim** → **A7**.
- **O7 — Signatures for reserved content? → NOT PRE-PILOT.** *"Pre-pilot does not need signatures for
  a reserved session."* The meeting-level signature (`app.can_sign_meeting`, keyed on
  `attendance = 'present'`) covers the record including annexes. `participants_only` meetings need no
  change — their participants *are* the signers. Revisit post-pilot if practice demands a separately
  signed *ata em separado*.
- **O8 — Who may open a reserved session? → COORDINATOR ONLY.** Not an `administrativo` delegated
  capability, unlike `schedule_meetings`. Rationale: for a case-less subject the opener **chooses the
  reader list**, so opening a reserved session is an **access-granting act**, and `administrativo` is
  explicitly a *delegated-capability* role (ADR 0061), not an authority-granting one.
- **O9 — Where does a sub-group's work live? → SOLELY IN THE CASE.** *"The subgroup's investigation
  should live solely in the `Case`."* Phases, narratives, and interviews carry the investigation; it
  surfaces to the plenary as the relator's report. **No sub-group entity is modelled.** The sub-group's
  own working meetings use `visibility_policy = 'participants_only'` (A2·1); the plenary's reserved
  item for that case exposes the report as **substance** (granted only) and the outcome as **decision**
  (member AND NOT excluded) — A7.

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

---

# Amendment 2 — Organization Users lose the meeting surface (D4 extended · **D4·2 REVERSED**)

**Date:** 2026-07-15 (same day) · **Status:** 🟢 **ACCEPTED** (PO, 2026-07-15)

**Trigger:** the PO asked for our plan's equivalent of the handoff's **§4 default access matrix**
(→ **Appendix A**). Building it exposed that our plan gives Organization Users **more** meeting reach
than the handoff's own target — *full* metadata and *full* content, where §4 says *Aggregate* and
*No* — and that **D4·2 contradicted itself**: it kept admins' reach to meeting *attachments* on a
rationale (agendas, minutes, accreditation evidence) that the rest of the model does not support.
Verification against the **live catalog** then confirmed A2·1's flagged inventory item and found
three arms no document had named.

> **The matrix earned its keep.** Neither the handoff, ADR 0077, nor this ADR's body caught the D4·2
> contradiction. Rendering the model in the *shape the partner chose* made it visible in one row.

## A8 — Principle: administration is not a **meeting** source either

D4 established that org/hospital administration ceases to be a **Case Content** source. It is hereby
extended: administration ceases to be a **meeting** source.

An Organization User (`org_admin` · `hospital_admin`) reads **no meeting record** — no metadata, no
ata, no agenda, no attendance, no signatures, no meeting attachments — and **cannot manage meetings**
(PO: *"Org admins lose meeting management too"*). This is a **deliberate divergence in the strict
direction**: handoff §4 allows them *aggregate* metadata; we give them **nothing** pre-pilot, because
the aggregate door does not exist yet and a base-table arm is not an aggregate.

**Their legitimate signal is real and is deferred, not denied.** "Did CCIH meet 11 of its 12 scheduled
sessions? Was quorum reached? How many action items are overdue?" is a genuine governance KPI and an
accreditation artifact. It is served **post-pilot** by a purpose-built PHI-free aggregate door,
alongside Stage D's hospital aggregates — **never** by reading the ata. Until it ships, Organization
Users have no meeting surface at all. **That gap is accepted, not overlooked.**

## A9 — **D4·2 is REVERSED**

D4·2 kept the `'meeting'` arm on `app.can_read_attachment`, reasoning that meeting attachments are
governance artifacts admins have a legitimate PHI-free reason to read. **That rationale does not
survive A8.** An admin who cannot read the ata must not read the ata **as a PDF** — that is a *seam*,
not a boundary, and precisely the kind that fails a surveyor's question.

Removed from the `'meeting'` arm of **`app.can_read_attachment`** and **`app.can_write_attachment`**,
and from both Storage policies (`meeting_attachments_select_member`,
`meeting_attachments_insert_staff_admin` — verified to carry it, 2026-07-15).

**D4·2's other half stands unchanged:** the `'interview'` arm still loses its admin term at Stage A
(plan A4), and case attachments are still fixed for free through `can_read_case`.

## A10 — Scope: the **record** goes, the **configuration** stays

| Loses the `is_commission_admin_of` arm | Where |
|---|---|
| `meetings` | `meetings_select` · `meetings_staff_admin_write` (⚠ `FOR ALL` — A13) |
| `meeting_agenda_items` | `_select` · `_staff_admin_write` (⚠ `FOR ALL`) |
| `meeting_attendees` | `_select` · `_staff_admin_write` (⚠ `FOR ALL`) |
| `meeting_cases` | `_select` · `_staff_admin_write` (⚠ `FOR ALL`) |
| `meeting_signatures` | `_select` |
| Storage | `meeting_attachments_select_member` · `meeting_attachments_insert_staff_admin` |
| Helpers | `app.assert_meeting_staff_admin` (the guard on `create_meeting` / `conclude_meeting` / `reopen_meeting`) · `app.can_read_attachment` + `app.can_write_attachment` (`'meeting'` arms) |

**Retained deliberately — stated here so it is not "tidied up" later:**

| Kept | Why |
|---|---|
| `commission_meeting_types` · `commission_meeting_settings` | **Configuration**, which handoff §2.1 grants Organization Users explicitly. Defining that *"Reunião Ordinária"* exists is administration; reading what was said in one is not. Also keeps commission setup end-to-end. |
| `public.dispose_meeting_minutes` | **PO decision.** A *retention* act, not a read. Verified from the catalog: `returns void`, nulls `minutes_md`, redacts agenda items, audits, and **returns no content**. |
| `audit_log_select` | Rule 11 oversight, PHI-free. **See A12.** |

**What they lose beyond reading:** `meetings_staff_admin_write` is `FOR ALL` and
`app.assert_meeting_staff_admin` is `is_staff_admin_of OR is_commission_admin_of` — so the arm's
removal also stops Organization Users **scheduling, concluding, and reopening** meetings. Intended
(PO). No lockout exists: `is_staff_admin_of` plus `administrativo`'s `schedule_meetings` capability
cover scheduling from inside the commission, and an org admin who needs a meeting scheduled appoints
the coordinator who schedules it.

## A11 — Action items: the adjacent channel (**the A3 pattern, again**)

`public.action_items` carries `source_meeting_id`, `source_agenda_item_id`, and a free-text
`description`. Under `app.can_read_action_item`, **two of three** visibility scopes keep the admin arm:

| Scope | Today | Under this amendment |
|---|---|---|
| `committee` | `is_member_of_for OR is_commission_admin_of_for` | **admin arm removed** (PO) |
| `assignees_only` | `is_staff_admin_of_for OR is_commission_admin_of_for OR assigned` | **admin arm removed** (PO) |
| `case_restricted` | `can_read_case` | **fixed for free** by D4·1 |

Without this, an item minuted out of a reserved session — *"Notificar o Dr. X da decisão do processo
047"* — walks straight out to an Organization User **after every meeting table is closed**. Close one
box and the scribe types in the other: **exactly A3's finding, one table further out.**

Also repoint: `action_items_select` · `action_items_staff_admin_write` (⚠ `FOR ALL`) ·
`app.can_write_attachment`'s `'action_item'` arm (an admin who cannot read a committee action item
must not attach to it). `app.can_read_attachment`'s `'action_item'` arm delegates to
`can_read_action_item` and is **fixed for free**.

## A12 — The residue: stated, not claimed away

`audit_log_select` carries the admin arm and **keeps** it. So an Organization User can still infer
that meeting X exists and who touched it. **"Zero meeting metadata" is therefore not literally
achieved, and should not be** — audit oversight is a distinct, legitimate, PHI-free purpose that is
itself audited. This is A6's principle applied again: *different surfaces, different purposes.*
Recorded so no one later "closes" it and blinds the audit trail.

## A13 — ⚠ CONFIRMED FROM THE LIVE CATALOG (was an inventory item; now a finding)

A2·1 flagged: *"`meetings_staff_admin_write` must be checked for `FOR ALL`."* **Verified 2026-07-15
against `pg_policies`. It is — and so are three siblings.**

Permissive policies **OR** together, and a `FOR ALL` policy's `USING` clause **applies to SELECT**.
Therefore **repointing the `*_select` policies alone changes nothing**:

| Policy | `FOR ALL`? | Case/attendee predicate? |
|---|---|---|
| `meetings_staff_admin_write` | ✅ | ❌ **none** |
| `meeting_agenda_items_staff_admin_write` | ✅ | ❌ **none** |
| `meeting_attendees_staff_admin_write` | ✅ | ❌ **none** |
| `meeting_cases_staff_admin_write` | ✅ | ✅ `can_read_case_or_admin` (hard-denies correctly) |

**Consequences — each defeats a Stage-C sub-step as written:**

1. **C3 is a no-op without this.** A `participants_only` meeting stays readable by every
   `staff_admin` — **including a recused coordinator**, the exact principal A2·1's binding constraint
   forbids.
2. **C2 is a no-op without this.** `meeting_agenda_items.discussion_notes` stays member-wide via the
   write policy, so A3's leak survives its own fix.
3. **A third arm no document names.** `meetings_staff_admin_write` OR-s
   **`app.member_can(commission_id, 'schedule_meetings')`** — so an **ordinary member holding the
   `administrativo` delegated capability** reads every `participants_only` meeting. ADR 0061 scoped
   that capability to *scheduling*; a `FOR ALL` policy silently promoted it to *reading*.

**Correction to A2·1's wording.** It says *"no **coordinator** OR-arm on `reach(meeting)`."* Verified:
`app.is_commission_admin_of` = `org_admin OR hospital_admin` **only — it does not include
`staff_admin`**. The coordinator reaches meetings through `app.is_member_of`
(= `has_role_any('commission', …)`), which A2·1 keeps AND-ed. **The rule A2·1 states is correct and
works for the reason given; the arm it names is the Organization User's.** Under this amendment that
arm goes anyway — but for A8's reason, not A2·1's.

> This is ADR 0072 delta 3's **second shape**, alive, on the exact tables Stage C targets — and
> invisible to grep. It is the third time this program has been saved by reading the catalog
> (cf. the false P0 in the METHODOLOGY FINDING).

## A14 — Flagged, **NOT decided**: `can_write_attachment`'s `'case'` arm

`app.can_write_attachment`'s **`'case'`** arm is `is_staff_admin_of_for OR is_commission_admin_of_for`.
D4·1 removes admins' case-attachment **read** (via `can_read_case`) but **not this write arm** — so
after Gate 1 an Organization User could **upload a case attachment they cannot read back**.

Not a confidentiality leak, but under D4's own principle (*administration is not a Case Content
source*) **writing** case content is harder to justify than reading it. **Out of scope for this
amendment; an A0 inventory item requiring a PO decision at Stage A.**

## Amendment 2 — added test keystones

17. **Organization User has no meeting surface** — an `org_admin` and a `hospital_admin` of the owning
    org/hospital read **nothing** from `meetings`, `meeting_agenda_items`, `meeting_attendees`,
    `meeting_cases`, `meeting_signatures`, or meeting attachments (Storage included), and **cannot**
    create, conclude, or reopen a meeting. Asserted as **rows read** under `set local role`, per the
    ETH·E1 lesson — never by a predicate's return value.
18. **`FOR ALL` cannot out-vote the boundary** (A13) — for each of the four policies, a principal
    denied by the `*_select` rule reads **zero rows** with the write policy in place. Includes the
    **recused coordinator** on a `participants_only` meeting and the **`schedule_meetings`
    delegate**, who must read nothing.
19. **Action items do not leak the meeting** (A11) — an `org_admin` reads no `committee`-scope or
    `assignees_only`-scope action item, nor its attachments; a `case_restricted` item follows
    `can_read_case`.
20. **Configuration survives** (A10) — an `org_admin` still reads and writes
    `commission_meeting_types` / `commission_meeting_settings`, still calls `dispose_meeting_minutes`,
    and still reads `audit_log`. **The negative tests must not over-reach.**
21. **No coordinator/member regression** — a `staff_admin` and an ordinary `staff` member read their
    `commission_default` meeting exactly as today. A8 removes the Organization User, **nobody else**.

---

## Appendix A — Default access matrix: the handoff's §4 vs. ours

Rendered in the handoff's own shape for comparability. `✓` = matches §4 · `⚠` = diverges.
**Post-Amendment 2.**

| User category | Hospital-wide Case Overview | Committee Case Content | Case write | Meeting metadata | Meeting content | Standard PHI | Restricted PHI |
|---|---|---|---|---|---|---|---|
| **Organization User** | ⚠ none — no aggregate door pre-pilot (§4: *Aggregate*) | **No** ✓ | No ✓ | ⚠ **None** — stricter than §4's *Aggregate* (A8) | **No** ✓ (A8) | No ✓ | No ✓ |
| **NSP Coordinator** | ⚠ none — not hospital-wide | ⚠ blanket on referral-touched cases (no purpose/expiry) | **No** | No | No | **No** ✓ *(stricter)* | No ✓ |
| **NSP Member** | ⚠ *identical to Coordinator — `is_pqs_operator_of_for` cannot distinguish them* | ⚠ *identical* | **No** | No | No | **No** ✓ | No ✓ |
| **Committee Coordinator** | Own committee ✓ | Yes, own committee — **unless excluded** | Yes — **unless excluded** | Yes ✓ | `commission_default`: yes · `participants_only`: **participant only** | Yes ✓ | ⚠ **delegates without holding** (D5·6) |
| **Committee Member** | == content reach (O5/A6) | ⚠ **`commission_default`: YES** (member arm) · `explicit_grants_only`: grant/assignment | ⚠ **grant only — no assignment arm** (D10) | Member-wide | `commission_default`: all · `participants_only`: participants | Grant only ✓ | Grant only ✓ |

**Row zero — the override §4's shape cannot express.** A **respondent** or a **recused** member
resolves to **zero capabilities**, evaluated *before* every positive arm (`_case_caps` step 4, ADR
0072). §4's flat *"Committee Coordinator: Yes, own Committee"* is **not implementable** — a recused
coordinator gets nothing. **Anyone reading §4 as the literal spec will reintroduce the hole ETH·E1
closed.**

**Two axes §4's shape also hides.** §4 is a function of *category* alone. Ours is a function of
**category × `cases.visibility_policy` × `meetings.visibility_policy` × exclusion × content tier**
(A7). Six of §4's cells collapse a genuine condition into the word *"Conditional"*; in this model the
condition **is** the design.

**Every PHI column matches §4 or is stricter.** That is the program's justification, and it holds.

> ⚠ **Appendix A is SUPERSEDED by Amendment 3** — the Committee Member row's "Committee Case Content"
> cell described the widened member arm (A15) and the Organization User's cells described a boundary
> that `FOR ALL` policies did not actually deliver (A21). **See Appendix B.**

---

# Amendment 3 — The member arm was a widening; five holes closed; D4·1's true scope

**Date:** 2026-07-15 (same day) · **Status:** 🟢 **ACCEPTED** (PO, 2026-07-15)

**Trigger:** a **pre-implementation contradiction review** requested by the PO before Gate 1 began —
the lead plus three independent reviewers (internal-consistency, implementability, adversarial). Every
load-bearing claim was then **re-verified against the live catalog** by the lead before acceptance.

> **This amendment corrects the ADR's single most important decision, and the error was the lead's.**
> D11's member arm — sold in the body as "the decision that makes D6 workable" and in Consequences as
> a no-op for ordinary committees — was a **widening**. Two of the three reviewers found it
> independently. It is recorded here in full rather than quietly patched, because the *way* it got in
> is the reusable lesson: **a no-regression claim that no test can falsify.**

---

## A15 — D11's member arm was a WIDENING. Corrected to `read_case_deliberation`

**The error, catalog-verified 2026-07-15:**

| Fact | Verified from |
|---|---|
| `can_reach_case_on_member_surface` is consumed by **exactly one policy**: `meeting_cases_select` | `pg_policies` |
| `app.can_read_case`'s live (`case_access`-ON) path has **no plain-member arm** — `staff_admin OR org_admin OR grant OR phase-assignment OR narrative-assignment` | `pg_proc` |
| `case_narratives.body_md` and `case_interviews.summary_md` are **"PHI-BEARING free text"** | `pg_description` — the schema's own column comments |

So **today** an ordinary member with no grant and no assignment reads exactly **one row type** of a
case: `meeting_cases.summary` / `.decision`. That is ADR 0072 D2·8's deliberate member-wide reach to
minuted deliberation. D11 promoted it to `read_case_content` — which will gate **every case-content
table** (~12), including the two columns above.

**Two body claims are therefore FALSE and are struck:**
- D11: *"`app.can_reach_case_on_member_surface` becomes redundant — its semantics **are**
  `has_case_capability(case, uid, 'read_case_content')`."* One gates a single meeting policy; the
  other gates twelve tables.
- Consequences: *"**Ordinary committees are unaffected.** … CCIH's routine meeting reads exactly as it
  does today."*

**Why no test would have caught it.** Keystones 4 and 11 assert **no regression**. A widening passes
every no-regression test *by construction*. There was no keystone asserting the member arm does not
**over**-grant — the exact sin D10 refuses ("a **widening** shipped inside a least-privilege
program"), committed one decision later. → **keystone 22.**

**Root cause, stated so it is not repeated.** D6 needed a member arm for **meeting** reach; the lead
gave it a capability that reaches **everything**. Compounding it: the PO's *"most complaints are
handled as a plenary; some need a sub-group"* answers **who is excluded** — plenary vs sub-group,
i.e. `commission_default` vs `explicit_grants_only`. The lead extrapolated it into *"and therefore
every plenary member reads the whole case file,"* which the PO never said, and **A1 was then built on
that extrapolation**. The `visibility_policy` axis and the how-much-does-a-member-read axis are
**independent**; the lead collapsed them.

### A15·1 — The decision (PO, 2026-07-15)

> *"The meeting section only."*

A new case capability — **`read_case_deliberation`** — carries the member arm:

```
active member of the case's commission
  AND cases.visibility_policy = 'commission_default'
  AND NOT excluded (respondent/recused — evaluated first, step 4)
⇒ read_case_deliberation
     — NEVER read_case_content, NEVER read_standard_phi, NEVER write_case_content
```

It gates **exactly three surfaces**, all of them *case discussion minuted in a meeting*:

1. `meeting_cases.summary` / `.decision`
2. case-linked `meeting_agenda_items.discussion_notes` / `.resolution` (A3 / C2)
3. `meeting_closed_session_items` **substance** tier (A7)

**The case file — narratives, interviews, phases, participants, events — stays with the coordinator,
the assignees (`case_assignment`), and explicit grants.** A member who needs the file gets a
`manual_grant`: reasoned, expiring, audited.

**D6 keeps its shape exactly** — both authorities required, only the case capability changes:

```
read_meeting_case_section = reach(meeting) AND has_case_capability(case, 'read_case_deliberation')
```

### A15·2 — `can_reach_case_on_member_surface` is **UN-RETIRED**

D11 retired it at Stage G as "redundant". That was true only under the widened arm. Its semantics —
deny excluded first · `explicit_grants_only` → grants only · `commission_default` → member-wide —
**are** `read_case_deliberation`, exactly. ETH·E1 built the right predicate three days ago.

**It survives as the resolver's projection of the `read_case_deliberation` bit.** D11's Stage-G
retirement is **withdrawn**; Stage G shrinks. (`can_read_case_or_admin` still retires — A21 removes
its admin arm outright.)

## A16 — The capability lattice is a **partial order**, not a chain

**PO decision:** a member does **not** see a `commission_default` case on the **board**. Today's
behaviour, preserved.

```
write_case_content ⇒ read_case_content ⇒ { view_case_overview , read_case_deliberation }
read_case_deliberation ⇏ view_case_overview      ← the rung that breaks, deliberately
read_restricted_phi ⇒ read_standard_phi
```

**Verified to match today exactly:** a grant-holder reads the board row **and** the ata section
(`can_read_case` true ⇒ both); an ordinary member reads the ata section **without** the board row
(`can_read_case` false, `can_reach_case_on_member_surface` true).

**`view_case_overview` has no consumer pre-pilot.** Its only stated purpose — Organization User / NSP
PHI-free aggregates — is post-pilot (A8), and A21 removes the Organization User from cases entirely.
It ships as a **RESERVED bit**, documented as such (D5·5's "reserve the shape" precedent). It is
**not** wired to `cases_select`. The implementability review flagged it as dead on arrival; with A16
it is dead **on purpose**.

## A17 — What A15 fixes elsewhere (no further decisions needed)

| Was | Now |
|---|---|
| **A1's mechanism** — "commission_default + member arm ⇒ every member reads it" | Members read the **minuted deliberation**, not the file. A1's *conclusion* stands (plenary is the norm; recusal does the protective work); only its mechanism narrows. |
| **A4·1's graduation path** — adversary finding: setting `case_id` published the pre-formal deliberation to the whole committee, by default | **CLOSED.** After graduation the substance rides case authority, and ordinary members have no content reach. The reserved discussion stays reserved. |
| **A4's decomposition row 1** — *plenary meeting · reserved item · plenary case* | **Works for the first time.** Substance = `read_case_deliberation`; recused denied by case authority. |
| **A7's substance tier** | `reach(meeting) AND has_case_capability(case_id, 'read_case_deliberation')` |
| **Respondent fail-open (A20)** | **Not fixed by A15** — see A20. Narrowing the arm did not shrink it. |

## A18 — Grant door: the exclusion gate, and the Organization User's one surviving arm

**Catalog-verified.** `public.grant_case_access` gates on:

```sql
if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
  raise exception 'sem permissão' using errcode = '42501';
```

A bare role check — **no exclusion**. ETH·E1 guarded the ACL's **read** (`case_access_select` carries
`AND NOT is_case_excluded`) and left the **write door** role-gated. So Dr. Ana, coordinator, recused
from case 47, resolves to zero capabilities and reads nothing — **and then revokes the relator's
access and grants her own resident write.** She cannot read the investigation into her co-author, but
she picks who does. D5·3's *"re-cut against the new shape"* means the **table's** shape and silently
preserves this.

**Decision:** `grant_case_access` / `revoke_case_access` gain **`AND NOT app.is_case_excluded(p_case,
auth.uid())`**.

**The deadlock, and the PO's resolution.** If `manage_case_access` resolves through `_case_caps`, step
4 strips it from Ana — and on a **single-coordinator commission nobody can staff case 47 at all**.

> **PO decision: the Organization User keeps its arm on the grant/revoke doors — and ONLY there.**
> Never on reading case content, PHI, meetings, or action items.

**Safe by construction, not by policy:** the door already requires
`app.is_member_of_for(v_commission, p_user)` — the **grantee must be a member of the commission**, and
an Organization User is not one. **They cannot grant themselves.** Every grant carries
`reason_code` + expiry + audit. This is D5·6's own distinction: *a delegating authority need not hold
what it delegates.* D4 is scoped to **Content and PHI**; granting is neither.

Rejected: *"appoint a second coordinator"* — it solves a narrow problem by handing someone **blanket
read on every case in the committee**, which is a far larger grant than one audited, expiring one, and
lands as manual work at the exact moment a conflict has just been declared.

**`manage_case_access` therefore gains the source and consumer it was missing** (the implementability
review found it had neither):

| | |
|---|---|
| **Source** | `committee_coordinator` **OR** `organization_user` — both **minus exclusion** |
| **Consumer** | `grant_case_access` · `revoke_case_access` · `list_case_access` |

## A19 — The confidentiality "ceiling" is a data-destroying trap, not a ceiling

**Catalog-verified, 2026-07-15:**

- `public.reclassify_attachment(p_id, p_new_tier, p_new_label)` accepts **any** label (it validates
  only tier/label compatibility for `phi_standard` / `phi_restricted`).
- **No function anywhere writes `max_confidentiality`.** The only two that reference it —
  `app.attachment_confidentiality_ok`, `app.confidentiality_clearance_ok` — are **readers**.
  `app._grant_case_access_unchecked` inserts `(case_id, user_id, level, granted_by, granted_at,
  expires_at, reason)`; `public.grant_case_access` has **no clearance parameter**.
- There is **no admin bypass** (QA removed it deliberately — *"INFO-1: the is_admin() bypass is GONE.
  Clearance rides case_access ONLY"*) and **no coordinator bypass**.
- The single non-null value in the live table came from **`seed.sql`**.

**Therefore:** the moment anyone labels an attachment `legal_privileged` or `credentialing_sensitive`,
it becomes **permanently unreadable by every human being** — including the coordinator who uploaded
it. On a meeting-owned attachment it fails closed harder still (*"gated label, no clearance plane: fail
closed"*).

**D5·4's "⛔ BLOCKING — the ceiling migrates, it does not vanish" aims at nothing.** There is no
working ceiling to preserve. **D5·6's "exactly what `max_confidentiality` does today" describes a
mechanism that has never granted anybody anything.**

**Two orthogonal planes, which D5·4 collapses:**

| Plane | Covers | Ceiling's view |
|---|---|---|
| `read_restricted_phi` (**boolean**) | `phi_restricted` — **rank 2** | passes through **untouched** (only ranks 5/6 gate) |
| `max_confidentiality` (**ranked**) | `legal_privileged` **5** · `credentialing_sensitive` **6** | `rank(clearance) >= rank(label)` |

A boolean cannot carry `rank >= label`; collapsing them would grant `credentialing_sensitive` to
anyone cleared for `legal_privileged`.

### A19·1 — Decision (PO)

1. **Fence the trap now.** `reclassify_attachment` **rejects** `legal_privileged` /
   `credentialing_sensitive` pre-pilot — one CHECK.
2. `case_access_grants` carries **`max_confidentiality` as a ranked, RESERVED column** (D5·5's
   "reserve the shape" precedent), **not** collapsed into `read_restricted_phi`.
3. **Stage E** — already post-pilot, already scoped as *"row-aware `can_read_attachment` +
   tier→clearance mapping"* — builds the write path, the grant-dialog selector, and the **unfencing**
   together. Splitting them ships a parameter nobody can call.
4. **D5·4 downgrades from ⛔ BLOCKING-repoint to carry-the-column.** The plan's B3 is rewritten.

## A20 — ⛔ Row zero rests on a nullable column that nothing enforces

**Catalog-verified.** `app.is_case_respondent` requires the full chain:

```sql
join public.professional_participants pp on pp.participant_id = cp.participant_id
join public.professional_profiles     prof on prof.id = pp.professional_profile_id
where cp.removed_at is null and r.key = 'respondent_doctor' and prof.user_id = p_uid
```

`public.professional_profiles.user_id` is **NULLABLE**, and **only two functions in the entire
database touch it** — `is_case_respondent` (reads) and `create_professional_profile`. **Nothing
requires the linkage.**

Unlinked ⇒ `is_case_respondent` **permanently false** ⇒ `is_case_excluded` **permanently false** ⇒
**every exclusion gate silently passes the respondent.**

**Live today, not introduced by this ADR:** `can_reach_case_on_member_surface` denies excluded first,
that check no-ops, the member arm fires — and an unlinked respondent who is a committee member reads
the plenary's minuted deliberation **about himself**. `create_case` takes no respondent argument
(`add_case_participant` runs later), so there is a window even when the linkage eventually arrives.

**A15 does NOT fix this.** The narrowed member arm confers exactly `read_case_deliberation`, which is
exactly what the unlinked respondent wrongly gets.

> **Why it outranks its blast radius:** C2's agenda gate, A7's four tiers, A18's grant door, and
> Appendix A/B's **Row zero** all resolve through this one predicate. The model's most load-bearing
> invariant — *"no positive arm at any layer can out-vote the deny"* — is **out-voted from underneath
> by an unfilled column.**

**Decision (PO): resolve it at the moment he is named.**

`professional_profiles` gains an explicit **resolved state**: `linked` (to a platform account) ·
`no_account` (affirmatively marked) · **`unknown`** (the default). A profile in **`unknown`** state
**cannot be attached to a case as `respondent_doctor`** — `add_case_participant` rejects it. The
committee must answer *"is this person a user of this platform?"* exactly when they name him, which is
precisely when they know.

**Row zero now rests on a constraint, not on someone remembering.** → **keystone 25.**

## A21 — ⛔ **D4·1 IS A NO-OP AS SPECIFIED.** Its true scope

**Catalog-verified:**

```
cases_select            :: SELECT :: app.can_read_case_or_admin(id, (select auth.uid()))
cases_staff_admin_write :: ALL    :: (app.is_staff_admin_of(commission_id)
                                       OR app.is_commission_admin_of(commission_id))
                                      AND (NOT app.is_case_excluded(id, auth.uid()))
```

Both **PERMISSIVE**, so they **OR**; a **`FOR ALL`** policy's `USING` clause **applies to SELECT**.
**Removing the admin arm from `can_read_case` changes nothing** — `cases_staff_admin_write` hands the
Organization User every case row straight back.

**Eight case tables carry this shape:** `cases` · `case_narratives` · `case_phases` · `case_events` ·
`case_offered_outcomes` · `case_tag_assignments` · `case_phase_allowed_results` ·
`case_phase_offered_results`.

**Stage A's exit criterion — *"Organization Users cannot read Case Content"* — would be FALSE**, and
would **test green** if the tests exercise only `can_read_case`.

> **A13's shape generalizes.** It is not a meeting quirk — it is this repo's `*_staff_admin_write`
> convention, and it is the **real read boundary** for Organization Users on every case table. A13
> found four meeting policies and stopped. There are eight more.

**One genuinely good finding:** ETH·E1 put `AND NOT is_case_excluded` on **all eight**, so the recusal
invariant **holds** here. That makes `action_items_staff_admin_write` the **single** place it was
missed (→ A22).

### A21·1 — Decision (PO): **remove read AND write**

Read and write cannot be separated here without splitting eight `FOR ALL` policies per-command, which
yields **A14's smell eight times over** ("write what you cannot read") and invites write-path-as-read-path
probing (constraint violations, `RETURNING`, upsert conflicts).

**The admin arm leaves:**
- `app.can_read_case` (D4·1 as originally written)
- **the eight case-family `FOR ALL` policies** (new)
- **`app.can_write_attachment`'s `'case'` arm → A14 RESOLVED** (new)
- **the case RPCs** — `create_case` · `create_case_from_template` · `update_case_meta` · `close_case` ·
  `cancel_case` · `set_case_confidentiality` · `add_case_participant` · `assign_narrative` ·
  `activate_phase` · … — **enumerate exhaustively at A0**; the catalog lists 119 functions referencing
  the arm and **most are legitimate**.

**Retained** (the A10 line, extended) — commission-level **configuration**, all `FOR ALL`, all
correctly without an exclusion term because they are not case-scoped: `case_tags` · `case_outcomes` ·
`case_narrative_types` · `process_template*` — plus membership/role management, **the grant door
(A18)**, `audit_log`, forms, indicators, controlled documents, `commission_meeting_types` /
`commission_meeting_settings` (A10).

> **The line, sayable in one sentence:**
> *An Organization User **configures** a commission and **staffs** it. They never touch its cases.*

**⚠ Stage A is materially bigger than the body claimed.** The staging table's Stage-A scope and
difficulty are restated in the plan.

## A22 — `action_items_staff_admin_write`: the one place ETH·E1's exclusion was missed

**Catalog-verified:**

```
action_items_staff_admin_write :: ALL :: (app.is_staff_admin_of(commission_id)
                                           OR app.is_commission_admin_of(commission_id))
```

`FOR ALL`, **no case term, no exclusion term**. A **recused coordinator** reads `case_restricted`
action items — including **A11's own example string**, *"Notificar o Dr. X da decisão do processo
047."* `action_items_select` gates that scope correctly on `can_read_case` (which hard-denies); the
write policy ORs it straight back.

**A11's claim that `case_restricted` is "fixed for free by D4·1" is WRONG.** D4·1 removes
`is_commission_admin_of`; **`is_staff_admin_of` survives unqualified** — and `is_staff_admin_of` is
the arm that matters for a recused coordinator.

**Fix (lands with C7):** mirror ETH·E1's six siblings —
`AND NOT app.is_case_excluded(coalesce(source_case_id, case_id), auth.uid())` — **plus** A11's
admin-arm removal. → **keystone 27.**

Same shape, also flagged for A0: `case_recusals_select` OR-s a bare
`app.is_staff_admin_of_for(app.commission_of_case(case_id), auth.uid())` **after** a correct deny.

## A23 — ⚠ The Stage-A inventory has a blind spot: `is_staff_admin_of*`

D13·1 enumerates **`is_commission_admin_of*`** on clinical tables. But **A13 itself proves
`is_commission_admin_of` ≠ `staff_admin`** (it is `org_admin OR hospital_admin` **only**). So the
inventory as written **never looks at `is_staff_admin_of*`** — the **only arm that can out-vote the
deny for a recused coordinator**, and precisely the arm A22 found unguarded.

**Binding additions to A0 (D13·1):**
1. Inventory **`is_staff_admin_of*`** and **`app.member_can(...)`** alongside `is_commission_admin_of*`.
2. Enumerate **every `FOR ALL` PERMISSIVE policy** on any case-, meeting-, or action-item-bearing
   table — **whether or not it names an admin arm**. A `FOR ALL` policy is a **read** policy.
3. For each, record: does it carry a **case predicate**? an **exclusion term**? If either is missing,
   it is a finding, not a footnote.

## A24 — Resolver corrections (from the implementability review; lead rulings, no PO call needed)

1. **NSP content arm has NO source in D11.** D8 orders NSP content reach **kept**; D11 lists only
   `nsp_investigation` *(post-pilot, Stage D)*. Built literally, `_case_caps` **silently revokes all
   NSP content reach at Stage A** — a Gate-2 behaviour change executed inside Gate 1, which D8 and
   Appendix A both forbid, and which only a Gate-2 keystone would catch.
   **Fix:** D11 gains **`nsp_referral_touched`** — live pre-pilot; `app.is_pqs_operator_of_for(hospital
   of the case's commission)` + a `case_referral` touching the case + `feature_enabled('case_referrals')`;
   confers **`read_case_content` only**, *never* `read_standard_phi` (D8). Retired by Stage D.
2. **`can_read_case` = projection, NOT survivor.** D2 says one semantic source; D4·1 and plan N1 say
   *"remove from / keep in `can_read_case`"*, implying it keeps its own body. Both cannot hold — two
   bodies means two independently-maintained hard-deny orders, i.e. exactly the drift D2 exists to
   prevent. **Ruling:** `can_read_case` becomes a **thin projection** of `_case_caps` (the
   `read_case_content` bit). D4·1/N1's wording describes the **effect**, not an in-place edit.
3. **Step 6's "lifecycle" is UNDEFINED — and is DELETED.** The word appears nowhere else in this ADR,
   and **D10 says write = Coordinator OR active write grant, *"Full stop."*** Catalog: terminal-freeze
   lives in the **`app.guard_case_status` trigger** (`HC025`) with an `app.in_case_rpc` escape hatch a
   `STABLE` resolver cannot replicate, and **`can_write_case_content` has no status check at all**.
   **Ruling: step 6 is deleted; the trigger stays.** Adding a status term to `_case_caps` would
   **narrow beyond today** and break every case-closing RPC that writes content in the same
   transaction. `_case_caps`'s order becomes **six steps**.
4. **A7's four tiers break at `case_id IS NULL`** — the *only* scenario A4 exists for.
   `is_case_respondent(NULL, ·)` and `is_case_excluded(NULL, ·)` are both **false** ⇒ the propriety and
   decision tiers **allow every member**; `_case_caps(NULL, ·)` fails closed at step 3 ⇒ substance
   **denies everyone, including the reader list**. A7 superseded A5 and **silently dropped A4·1's
   reader list**.
   **Fix:** every tier carries A4·1's branch. For a case-less subject: **substance → the reader list**;
   **propriety tier is EMPTY** (no process number, no recusal record exists — *"Matéria reservada"*),
   not "allow"; **decision → the reader list**. → **keystone 30.**
5. **D3's coverage claim is FALSE for action-item assignment.** `can_read_action_item`'s
   `assignees_only` arms (`assigned_to = p_uid`; `action_item_assignments`) are **raw table checks with
   no `is_active`** and have **no case to resolve**, so `_case_caps` step 2 cannot reach them — this is
   **Context·3's exact defect, unaddressed**. D3's *"therefore"* asserts a closure it does not deliver.
   **Fix:** `can_read_action_item` gets its own `is_active` gate. → **keystone 28.**
6. **D11's table mixes two kinds of thing** and its "Persisted where" header hides it.
   **Resolver-computed arms:** `committee_coordinator` · `committee_member_default` ·
   `case_assignment` · `nsp_referral_touched`. **`case_access_grants.source` column values:**
   `manual_grant` (reachable) · `nsp_investigation` · `referral` · `break_glass` (**reserved,
   unreachable — D5·5**).
   **`referral` is a reserved column value, NOT a live source.** D11's unparenthesised row was wrong;
   D5·5 governs. Referral analyst reach is **computed** by F-min's split predicates, not by a grant row.
7. **D11 never says what each source CONFERS** — only the member arm has an explicit mapping.
   **Fix:** D11 gains a capability column. Binding:
   - `case_assignment` ⇒ **`read_case_content` + `read_case_deliberation` ONLY** — never PHI
     (Context·1's headline), never write (D10).
   - `committee_coordinator` ⇒ all **except `read_restricted_phi`** — they **delegate it without
     holding it** (D5·6). An implementer wiring "coordinator = full authority" hands them the
     restricted bit; **no keystone catches that today** → keystone 31.
   - `committee_member_default` ⇒ **`read_case_deliberation` ONLY** (A15).
   - `nsp_referral_touched` ⇒ **`read_case_content` ONLY** (D8).

   > ⛔ **THIS TABLE MAPS 4 OF THE 7 LIVE SOURCES.** Amended 2026-07-16 (`backend`, A2 contract C4/C6;
   > lead-verified). A24·7 fixed *"D11 never says what each source confers"* — but only for the four
   > **resolver-computed** arms, leaving the three the catalog actually carries unmapped. **A2 cannot
   > wire a source that has no row, and inventing one silently is exactly A36's failure mode.** The
   > missing three, wired to **today's** semantics (A2 is a mechanism swap — it ships what is live, not
   > what is wanted):
   > - **`org_admin`** (`is_commission_admin_of_for`) ⇒ **`read_case_content` + `read_case_deliberation`**.
   >   **Never PHI** — verified: `can_read_case_patient` carries **no org arm** on either branch. Never
   >   write. **Ships as an A2 source; A4 removes it** (D4·3 — omitting it executes A4's removal inside
   >   A2). ⚠ Consequence of the no-PHI finding: **A4 touches `can_read_case_patient` zero.**
   > - **`manual_grant`** (unexpired `case_access` row, `level` **unfiltered**) ⇒ **`read_case_content` +
   >   `read_case_deliberation` + `read_standard_phi`**; with **`level = 'write'`** ⇒ **+
   >   `write_case_content`**. The `read_standard_phi` cell **is defect ①'s second half** — deliberately
   >   **pinned, not fixed** (`230` + e2e `AC-3b`), so **B1** lands as a visible failing assertion. The
   >   target draws these from `case_access_grants` **columns**; today's `case_access` has only `level`.
   > - **`case_access_flag_off_legacy`** (`NOT feature_enabled('case_access')` **AND** `visibility_policy
   >   <> 'explicit_grants_only'` **AND** `is_member_of_for`) ⇒ **`read_case_content` +
   >   `read_standard_phi`**. ⛔ **NOT a target-state source — D9 DELETES IT AT STAGE B.** It exists so
   >   A2 is a faithful swap. Pinned by **K12**. See the D9 amendment for why it confers PHI.
   >
   > ⭐ **Why `committee_member_default`'s "ONLY" is nonetheless CORRECT — and why A36·1 needed care.**
   > There are **two** member arms and this ADR conflated them: `can_reach_case_on_member_surface`
   > (`is_member_of_for`, **no flag term**, live, 74/196) ⇒ `read_case_deliberation` — **A15 is exactly
   > right about this arm**; and `can_read_case`'s **flag-OFF** arm ⇒ `read_case_content`. Same
   > principal, same shape, **different capability**, reachable only at `case_access = f`. A24·7's
   > **"ONLY"** cannot express the second, so "carry the branch" (A36·1) and "honour A24·7 verbatim"
   > read as contradictory. **Resolution: the flag term belongs to the SOURCE, not the capability.**
   > The flag-OFF behaviour becomes its own doomed source row (above) and A15 survives **verbatim**.

## A25 — Amendment 3 keystones

22. **⭐ The member arm does not OVER-grant** — the negative keystones 4/11 structurally could not
    catch (A15). An ordinary member of a `commission_default` case reads the ata section and
    **nothing else**: not `cases`, not `case_narratives`, not `case_phases`, not `case_participants`,
    not `case_events`, not interviews, not attachments. Asserted as **rows read** under
    `set local role`, over **every** case-bearing table — not as a predicate's return value.
23. **Organization User cannot read a case through the write policy** (A21) — for each of the **eight**
    `FOR ALL` case policies an `org_admin`/`hospital_admin` reads **zero rows**, and cannot create,
    edit, cancel, or attach to a case. **Configuration still works** (`case_tags`, `case_outcomes`,
    `case_narrative_types`) and **the grant door still works** (A18) — the negatives must not over-reach.
    > ⛔ **THE EIGHT ARE ALL REAL; THE CLOSURE IS WRONG. The population is ~19** (`backend`, A4 contract,
    > 2026-07-16 — each addition **proven by execution with a control**, not read). **§7.9: closed over
    > what?** A21 closed over *"case tables named `case_*` carrying a `case_id`"* and therefore missed:
    > the **interview family** — `case_interview_subjects_write` (⚡ `orgadmin.a` reads the interview
    > subject **"Dr. Fulano de Tal (denunciado)"** on the `explicit_grants_only` ethics case; control:
    > `staff2` reads 2, not 3), `case_interview_links_write`, `case_interview_interviewers_write`,
    > `interview_sessions_write`, `case_interviews_{update,delete,insert}`; **`action_items_staff_admin_write`**
    > (⚡ `orgadmin.a` reads the `case_restricted` item carrying **A11's own example string** — *"Notificar
    > o Dr. X da decisão do processo 047."*; control: `staff2` reads 0) — ⚠ **SCOPE it to
    > `case_restricted`, do NOT delete the arm**: `visibility_scope='committee'` is legitimate commission
    > governance, and deleting it is the over-reach this keystone exists to forbid; and the **two storage
    > policies** (see the D4·2 amendment). ⛔ **The mechanical filter fails LIVE and in BOTH directions:
    > a `policy_names_a_case` column test buckets `cases` ITSELF as *not* case material** (its policy uses
    > `commission_id`/`id`, never `case_id`) **while bucketing `process_templates` beside it** — the same
    > `commission_id` line A30 tested and rejected, reproduced in the opposite direction. **Rule on the
    > noun.** ⚠ **Name-trap pair, opposite rulings:** `phase_results` is a **commission picklist**
    > (`commission_id, label, color_token, …`) → **KEEP**; `case_phase_offered_results` is keyed by
    > `case_id` → **NARROW**. Both tables are **empty**, so a row probe reads zero **vacuously** (§7.10) —
    > **this ruling rests on the schema, and it says so rather than dressing itself as measured.**
24. **Recused coordinator cannot grant** (A18) — `grant_case_access` / `revoke_case_access` raise for
    her; the Organization User fallback **succeeds** and **cannot grant itself** (not a member of the
    commission).
    > ⛔ **THIS KEYSTONE DESCRIBES A DOOR THAT DOES NOT EXIST. THEY DO NOT RAISE FOR HER.** Found by
    > `backend` at A2's contract; **proven by execution** (lead, 2026-07-16, fresh reset, rolled back).
    > All three doors — `grant_case_access` · `revoke_case_access` · `list_case_access` — gate on
    > `is_staff_admin_of or is_commission_admin_of` → `42501` with **no exclusion/recusal/respondent
    > term** (comment-stripped, control column proving the probe sees the authority term), and `144` +
    > `183` carry **zero** recusal assertions. **The exploit:** recuse the coordinator from her own case
    > — **her own reach goes `false` on both `can_read_case` and `can_read_case_patient`, so the hard
    > deny genuinely works** — then she calls `grant_case_access(case, third_party, 'read')`: **it
    > succeeds, and the third party's `can_read_case_patient` goes `false` → `true`.** She can revoke a
    > legitimate grant too. ⭐ **Recusal gates READING, not ADMINISTERING** — a keystone written as a
    > prediction and never run reads exactly like one that passed. **Bounded** by `is_member_of_for`
    > (grantee must be a member) and by the hard deny (she cannot grant reach to herself or the
    > respondent), **not bounded** for any third party — and a `case_access` row confers
    > `read_standard_phi` today. **Its own unit, before pilot. NOT foldable into A2** (a read resolver
    > cannot fix a write door), and **not the flag-OFF arm's situation** — that one is dead code D9
    > deletes; this is live and nothing deletes it. Tracked: `docs/progress/authz-handoff.md` §5.
25. **Unlinked respondent is rejected** (A20) — a `professional_profiles` row in `unknown` state
    cannot be attached as `respondent_doctor`; and a **linked** respondent reads **no** deliberation
    about his own case, on any surface.
26. **Gated labels are fenced** (A19) — `reclassify_attachment` rejects `legal_privileged` /
    `credentialing_sensitive`; **no attachment can be made permanently unreadable.**
27. **Recused coordinator reads no action item** (A22) — `case_restricted`, `committee`, and
    `assignees_only` all denied, **including via the `FOR ALL` write policy**.
28. **Deactivated assignee reads no action item** (A24·5) — the `assignees_only` raw arms honour
    `is_active`.
29. **NSP keeps content, loses PHI — from Stage A** (A24·1) — an NSP operator on a referral-touched
    case reads content **after Gate 1**, not only after Gate 2, and never patient identifiers.
30. **Case-less reserved item** (A24·4) — the reader list reads the substance; a non-reader member
    reads the **bare stub only**; **nobody** receives a propriety record or a decision that does not
    exist.
31. **Coordinator does not hold `read_restricted_phi`** (A24·7) — they may **issue** it; they do not
    **have** it.

## A26 — ✅ RESOLVED (PO, 2026-07-16): the propriety record is visibility_policy-dependent

**Ruling (PO, 2026-07-16).** The propriety tier names *who withdrew and why* **member-wide only for
`commission_default` (plenary) cases**. For `explicit_grants_only` (sub-group) cases the withdrawal
identity requires **substance reach (`read_case_deliberation`)**; a member without it sees only the
non-identifying stub (item reserved, quorum held, times — no name). It keys on **`cases.visibility_policy`**
(the case shape), *not* `meetings.visibility_policy`. This satisfies A5 for the body that actually
deliberated (plenary case → the whole plenary watched it; sub-group case → the substance-reach holders who
ran it) while closing D11's number+date+recusal re-identification for the plenary-at-large. C5's
propriety-tier predicate is therefore split by case visibility; the parked question below is answered by
this ruling.

*Original finding (retained for rationale):* The adversarial review's strongest **surviving** finding.
Amendment 3 does not resolve it.

**D11 states the threat model itself:**

> *"in a small committee, a case number plus a date plus a sudden recusal identifies the respondent,
> and the respondent is a committee member."*

**A7's propriety tier then publishes all three, member-wide:**

| D11's named ingredient | Where the model publishes it |
|---|---|
| the **process number** | the pauta names it — A5, A7 propriety tier |
| the **date** | the meeting itself |
| **a sudden recusal** | *"who withdrew and why"* — the propriety tier, `reach(meeting) AND NOT is_case_respondent` |
| *(bonus)* the **outcome** | the decision tier, `reach(meeting) AND NOT is_case_excluded` |

**A6 prices only two of these** — the number and the outcome. It never prices the **withdrawal list**,
which is the ingredient that turns a number into a **name**. A6's closing line — *"Recorded so it is
not 'fixed' later"* — therefore defends a disclosure it never assessed.

**It is not symmetric across the two case shapes:**

| Case shape | Assessment |
|---|---|
| **Plenary** (`commission_default`) | **Benign.** The members were in the room and watched him withdraw. The ata exists to tell the *absent* what the *present* witnessed. It leaks nothing the committee does not already know. |
| **Sub-group** (`explicit_grants_only`) | **Sharp.** The plenary was **not** in the room. Yet the propriety tier is member-wide — so every member reads *"Processo 052 — Dr. Carlos declarou-se impedido e retirou-se às 15h00"* and learns who 052 is about. That is **exactly** the inference D11 says must not be available. |

> ⛔ **Do not resolve this by accident while building C5.** Whoever authors the reserved-session RPC
> must decide what the propriety tier projects, and the obvious default — project the withdrawal list
> to every member — **silently answers this question in the permissive direction**. If C5 lands before
> the decision, the decision has been made.

**The question, when it is taken up:** does the propriety record name **who** withdrew, or only **that**
the item was reserved and that quorum held — and **does the answer differ by `cases.visibility_policy`**?
A5's constraint is binding and cuts the other way: the ata *must* prove the deliberation was untainted
(*"Dra. Ana declarou-se impedida e retirou-se às 15h00"*), and A2's finding 2 forbids falsifying the
attendance record to protect a case. Whether that proof requires **names in front of every member**, or
only in front of those with substance reach, is the open part.

**Gate 1 does not depend on it.** Stage C does.

---

## Appendix B — Default access matrix (supersedes Appendix A)

Handoff §4's shape, **post-Amendment 3**. `✓` = matches §4 · `⚠` = diverges.

| User category | Hospital-wide Case Overview | Committee Case Content | Case write | Meeting metadata | Meeting content | Standard PHI | Restricted PHI |
|---|---|---|---|---|---|---|---|
| **Organization User** | ⚠ none — no aggregate door pre-pilot (§4: *Aggregate*) | **No** ✓ (A21 — *really*, this time) | **No** ✓ (A21) | ⚠ **None** — stricter than §4 (A8) | **No** ✓ (A8) | No ✓ | No ✓ |
| **NSP Coordinator** | ⚠ none — not hospital-wide | ⚠ blanket on referral-touched cases (no purpose/expiry) — `nsp_referral_touched`, retires at Stage D | **No** | No | No | **No** ✓ *(stricter)* | No ✓ |
| **NSP Member** | ⚠ *identical — `is_pqs_operator_of_for` cannot distinguish them* | ⚠ *identical* | **No** | No | No | **No** ✓ | No ✓ |
| **Committee Coordinator** | Own committee ✓ | Yes, own committee — **unless excluded** | Yes — **unless excluded** | Yes ✓ | `commission_default`: yes · `participants_only`: **participant only** | Yes ✓ | ⚠ **issues it without holding it** (D5·6) |
| **Committee Member** | ⚠ **only where involved/granted** — *not* the whole docket (A16) | ⚠ **only where assigned or granted** (A15 — **the member arm confers NO case content**) | ⚠ grant only — no assignment arm (D10) | `commission_default`: yes · `participants_only`: participant only | *idem* | Grant only ✓ | Grant only ✓ |

**The member arm now appears in NO cell of this table** — because `read_case_deliberation` is a
*meeting-surface* capability, and §4's shape has no column for it. That is the clearest possible
statement of A15: **the arm never belonged in the Case Content column.**

**Row zero — the override §4's shape cannot express.** A **respondent** or a **recused** member
resolves to **zero capabilities**, before every positive arm. §4's flat *"Committee Coordinator: Yes,
own Committee"* is **not implementable**. **A20 is what makes Row zero real rather than decorative.**

**Three axes §4's shape hides.** §4 is a function of *category* alone. Ours is a function of
**category × `cases.visibility_policy` × `meetings.visibility_policy` × exclusion × content tier**.

**Every PHI column still matches §4 or is stricter.** After A15 and A21, so does every content column.

---

## Amendment 4 (PO, 2026-07-15) — the A0 gate: Row zero is not **durable**

Stage A0's catalog inventory + `qa`'s adversarial review of it. Both P0s below were **independently
re-verified by the lead from the catalog** before this amendment was written. A0 stands at **CHANGES
REQUESTED**; these decisions are ratified regardless of the revision's outcome.

### A27 — ⛔ The exclusion model has **three self-serving mutators**. The deny needs no out-voting.

The whole program rests on *"no positive arm can out-vote the hard-deny."* That invariant **holds**, and
is **beside the point**: nothing stops the denied party from **deleting the row the deny reads**.

| Door | Shape | Effect |
|---|---|---|
| `lift_recusal` | DEFINER · gate = `is_staff_admin_of OR is_commission_admin_of` · **no self-check** | A recused coordinator **lifts her own recusal** → `is_case_excluded` f → full reach. `record_recusal` gets the self-vs-other split right; this has none. |
| `remove_case_participant` | *idem* | The respondent **removes his own `respondent_doctor` row** → `is_case_respondent` f → **`can_read_case_patient` t**. |
| `set_case_participant_role` | *idem* | Same, by re-keying the role off `respondent_doctor`. |

`is_case_respondent` resolves through `cp.removed_at is null` AND `r.key='respondent_doctor'` — **both
mutable, neither self-checked**. The respondent doctor reads the **PHI of the case in which he is the
accused** (proven live, rolled back). **Strictly worse than `lift_recusal`.**

**A20 made Row zero *resolvable*. It does not make it *durable*.** B7 alone buys a keystone that
**passes while the respondent deletes his own row**. This is [[no-regression-claim-needs-overgrant-twin]]'s
lesson in a new shape: *every* exclusion keystone in Gate 1 asserts "she cannot read X" against a row
**the test never lets her touch**.

**Binding, generalized:** for **every** arm `is_case_excluded` resolves through, enumerate **every
mutator of the rows it reads** and require a self-check. **An exclusion model is only as strong as its
weakest mutator.**

### A28 — Methodology: `prosecdef` belongs next to `pg_policies`

A23 added `is_staff_admin_of*` + `member_can` to the inventory. **It never added `pg_proc.prosecdef`.**
That one omission hid **all three** of A0's largest findings: a `SECURITY DEFINER` function's internal
gate **replaces** RLS, so a **policy-shaped audit is structurally blind to it**. The ADR's own
methodology finding said *file text lies*; this says **policies are not the population**.

**Ratified into the binding methodology** (extends D13/A23): inventory `pg_proc` **including
`prosecdef`**, and sweep **`pg_trigger`**. `qa` cleared the rest: no views, **zero** DEFINER functions
with an unpinned `search_path`, no RLS-off tables, no partial column grants.

### A29 — **Resequencing (PO-approved): exclusion durability lands FIRST, as one migration**

Supersedes the plan's stage order. **Migration 1 = exclusion durability ONLY:**

1. **B7 first** (respondent linkage / resolved state) — the mutator fixes are `AND NOT
   app.is_case_excluded(...)`, which is **meaningless until `is_case_respondent` resolves**;
2. then `lift_recusal` + the **three** self-serving mutators (A27);
3. then the **30-RPC** DEFINER exclusion sweep (A31·1).

**The A21 admin-arm removal is NOT folded in** — D4·3 requires the resolver first. Migration 1 buys
exactly one thing: **the exclusion keystones stop being vacuous.** Everything in Gate 1 is validated
against them, so they come first. This is the argument the plan's Risks table already accepts for B7
alone, applied to the arm A0 found.

### A30 — **`platform_admin` on case content (PO: fold in)**

`set_case_offered_outcomes` carries an **`is_admin()`/platform_admin arm on case content** —
contradicting CLAUDE.md's *"global superuser, **walled off from all tenant data**"* (§1) and never
named in this ADR. **PO: fix inside this program** — same surface, same migration, same review.
`backend` must first enumerate **every** platform_admin arm on tenant data; this is unlikely to be the
only one.

### A31 — Scope corrections to A0 (`qa`-verified; A0 revising)

1. **DEFINER-without-exclusion = 30, not 13.** Ten RPCs (`conclude_narrative`, `reopen_narrative`,
   `unassign_narrative`, `set_case_phase_result_override`, `update_case_meta`, `create_referral_draft`,
   `conclude_meeting`, …) are DEFINER + bare role + **no gate at all**, filed as "REMOVE-ARM only".
   Strip `is_commission_admin_of` and **`is_staff_admin_of` survives unqualified** — **verbatim the A22
   defect**, applied to the policy layer but not to the RPC list.
2. **37 is a FLOOR, not the population** — A0's headline query filtered on `is_commission_admin_of`,
   **reproducing A23's blind spot exactly**. Re-enumerate over `is_staff_admin_of*` · `member_can` ·
   `is_admin`.
3. **Eight case-family `FOR ALL` policies → ELEVEN.** An **interview family**
   (`case_interview_{interviewers,links,subjects}_write`) carries the admin arm over **PHI-bearing**
   content and is named **nowhere**. The **`interview-attachments` bucket is gated `is_member_of`** —
   member-wide, bypassing `can_read_attachment` **and** the confidentiality ceiling. **Keystone 22 fails
   on it.**
4. **Two `case_access` couplings, not one** (D5·4): `confidentiality_clearance_ok` also reads it
   directly, feeding `can_read_interview`. **B1's hard cut breaks interview reads** unless repointed in
   the same migration. 24 dependent functions, not 3 doors.
5. **A20 is unimplementable as specified** — `update_professional_profile` has **no `user_id` write
   path** (so `unknown → linked` has no door), and `ON DELETE SET NULL` defeats the attach-time check
   afterward. "Only two functions touch it" is **FALSE** — four.
6. **Plan A3 is already built.** A1's real work is a **seed** change (`ethics` is seeded
   `explicit_grants_only` **today**). `create_case` **ignores** the type default that
   `create_case_from_template` honours, and **nothing** writes `visibility_policy` post-creation — so
   D11/A1's *"per-case coordinator override"* **has no door**. ⚠ Bears on Stage C.
7. **Over-reach found and rejected:** `list_case_access` + `grant_member_capability` were marked
   REMOVE-ARM against **A18** and the staffing line. *An Organization User configures a commission and
   staffs it.* **Keystone 23 fails if the negatives over-reach.**
8. **Category error:** `case_tag_report(p_commission_id, …)` has **no `case_id`** — the prescribed
   exclusion gate is **unwritable**. Case-scoped gates ≠ commission-scoped per-row filters.

### A32 — What A0 got right (recorded, so the gate is not read as a failure)

21 claims verified, **0 refuted**; all reproducibility counts re-ran exactly (110 migrations · 93
policies · **121** functions — the plan said 119). The **load-bearing negative holds**:
`close_case` / `cancel_case` / `set_case_outcome` / `update_case_narrative_body` are genuinely
`prosecdef = f`, so **RLS does protect them** — *do not sweep them*. Context·2 **survives** `4f23558`'s
rewrite of `can_read_referral_phi`: its **text** is stale, its **fact** is not. **A22 confirmed —
`4f23558` did *not* fix `action_items`.**

### A36 — ⛔ A2 was BLOCKED at authoring. **An unconsumed bit cannot have an over-grant twin.**

`backend` refused to author A2 and returned four catalog-proven contradictions instead. **The refusal
was correct and it reshaped the stage.** The founding failure mode, **inverted**: D11's member arm was a
**widening sold as a no-op**; A2 as scoped was **three narrowings packaged as *"a thin projection."***

**The question it forced: is D11's source table DESCRIPTIVE (today) or PRESCRIPTIVE (the target)?**
**Answer: PRESCRIPTIVE** — `case_assignment` conferring PHI is **this ADR's own confirmed defect ①**
(Context, above: *"a grant deliberately issued **read-only opens patient identifiers**, and a bare phase
or narrative…"*), one of the **three justifications for the whole program**. Encoding today's behaviour
as the target would have enshrined the defect the ADR exists to kill. ~~**Lead-verified:**~~
```
app.can_read_case_patient:                                          ⛔ PRE-M3 + WRONG — see below
  if not feature_enabled('case_access') then return is_staff_admin_of_for(...)
  else  is_staff_admin_of_for(...) OR case_access grant
     OR case_phases.assigned_to = p_uid        ← bare assignment
     OR case_narratives.assigned_to = p_uid    ← confers PHI
```

> ⛔ **THE "LEAD-VERIFIED" QUOTE ABOVE IS WRONG ON THE FLAG-OFF BRANCH, AND IT UNDERSTATES PHI REACH**
> (found by `backend` at A2's contract, 2026-07-16; lead re-verified from `pg_get_functiondef`). The two
> assignment arms are now **deleted by M3** — that half is merely historical. **The flag-OFF line is a
> real error.** The live branch is **two** branches, and the lead quoted the first while omitting the
> fallthrough underneath it:
> ```
> if not app.feature_enabled('case_access') then
>   if visibility_policy = 'explicit_grants_only' then
>     return app.is_staff_admin_of_for(...);        ← the E1 belt — what the quote showed
>   end if;
>   return app.is_member_of_for(...);               ← ⛔ MEMBER-WIDE **PATIENT IDENTIFIERS** — omitted
> end if;
> ```
> **Reading a branch and reporting it as the branch.** The error ran in the **urgency-suppressing**
> direction — the same direction as A36·3's "inert" claim, on the same predicate, in the same amendment.
> ⚠ **A quote is a reading, not a fact** (§7.3): this one was pasted into the ADR as `Lead-verified` and
> then cited as ground truth for three months. **Un-reachable is not the same as un-true.** The arm is
> dead code (**D9**: no PostgREST door — `app` is unserved; **no ACL on `app.feature_flags` at all**; no
> function writes it; baseline force-sets `case_access = true`), which is *why* it survived unread — but
> A2 must carry it faithfully, and **A2 keystone K12 pins it, which nothing did before**.

**The structural finding (the reason A2's scope was withdrawn):** A2 as written projects only
`can_read_case`, leaving `can_read_case_patient` untouched — so the **`read_standard_phi` bit ships
computed but UNCONSUMED, therefore UNFALSIFIABLE**. The narrowing would then land in a later unit
**silently, with no failing test in between** — A24·1's shape, one rung up. **Two of the four would fail
loudly (228 test 24 catches them); the PHI one would not. That is the one that matters.**

**PO ruling: M3 first — narrow defect ① BEFORE the resolver exists**, as its own small subtractive
migration (the M1/M2 shape). A2 then becomes a byte-for-byte swap over **already-correct** semantics —
the only way it stays a reviewable **mechanism** swap. ⚠ **M3 is a NARROWING, not a denial: the positive
twin is the whole risk.** A narrowing that denies everyone passes its negative **by construction**; and
the assignee must **keep `can_read_case`** (content) while losing **only** PHI — keystone both
directions.

**The other three, recorded (they bind A2, not M3):**
1. **The member arm is flag-conditional** — with `case_access` **ON** (today's live state) `can_read_case`
   has **no** member arm; the **OFF** branch has one, and **228 test 24 asserts it byte-for-byte**.
   **A15 is consistent.** The resolver **must carry the branch**.
2. **The org arm has NO source in A24's table**, yet `can_read_case` carries `is_commission_admin_of_for`
   **today**. If the resolver omits it while `can_read_case` becomes a projection, **A4's removal executes
   inside A2** — which D4·3 forbids and A5 gates. **Ships as a resolver source; A4 removes it.**
3. ~~**`nsp_referral_touched` is INERT today** — `case_referrals` flag = `f`.~~ ⛔ **RETRACTED — FALSE.
   `case_referrals` is `enabled = t`; `app.feature_enabled('case_referrals')` returns TRUE**
   (lead-verified). **A24·1 was RIGHT; this amendment was wrong**, and the error ran in the
   **urgency-suppressing** direction.

   **How it happened — the SIXTH instance of *text is not truth*, and it fooled everyone.** The flag
   **row's own `description` says *"Ships OFF; enabled at Phase 22 completion"*** while the row's
   `enabled` column says `t`. `backend` — *the author of the "text is not truth" rule* — reported `f`;
   the **lead wrote it into this ADR without verifying it** (having verified its other three claims);
   `qa` caught it from the catalog. **`baseline.sql` force-sets it `true` in EVERY environment**
   (`on conflict do update set enabled = excluded.enabled`), so it has never actually shipped off.
   ⚠ **A flag's `description` is prose. Only the `enabled` column is the flag.**

   **So the arm is LIVE, not latent:** `pqs.a/b`, `pqsdual.a`, `nspcoord.a/b` (and `admin@test.local` —
   **`is_admin = f`**, another name trap) each read **PHI on 4 cases *solely* through it**, while D11's
   source table says `nsp_referral_touched` confers **content only**. Its removal is **D8/N1, scheduled
   for Gate 2** — so this is a *known* removal, not a new defect; what was wrong was calling it inert.
   **`nsp_referral_touched` is REQUIRED as an A2 source** (A24·1): without it **Stage A silently revokes
   live NSP content reach**.

### A35 — A30 ruled (PO, 2026-07-15): the **noun rule**, and CLAUDE.md §1 was the thing that was wrong

> **⚠ AMENDMENT 2026-08-03 (BUG-AUTHZ-001) — the ruling stands; the census it rests on went stale.**
> A30 enumerated the **two** `dashboard_*` DEFINER doors that existed on 2026-07-15 and correctly
> flagged `dashboard_export_rows` as the widest bucket-B read. **Three more were added afterwards**,
> each copying the wrong sibling's arm: `dashboard_matrix_cells` + `dashboard_risk_scores` (FF-2,
> `20260830000900`) and `dashboard_entity_references` (FF-5, `20260902000500`) — so by 2026-08-03 the
> `app.is_admin()` arm sat on **five** functions.
>
> **Root cause, and it predates A30.** `docs/reviews/phase-8-review.md` records all **six** original
> dashboard functions sharing ONE gate, `is_staff_admin_of(cid) OR app.is_admin()`. A later change put
> the commission-admin mirror on four of them and **missed `dashboard_distributions` and
> `dashboard_export_rows`**. That partial conversion is the whole defect: it produced a second gate
> shape, broke no test, and every subsequent door copied a sibling in good faith. **A rewrite applied
> to *part* of a function family is invisible to every check the platform runs** — which is why the fix
> is an invariant over `pg_proc`, not a corrected enumeration. Migration `20260903000700` replaces it with
> `app.is_commission_admin_of(v_commission_id)` on all five; pgTAP
> `270_authz_dashboard_gate_uniformity.sql` (8/8, mutation-falsifiable) now holds the invariant, and
> enumerates from `pg_proc` rather than a name list so the next door cannot repeat it.
>
> **Two lessons this section should carry, both already stated elsewhere in this ADR and both re-earned:**
> 1. **`prosecdef` belongs beside `pg_policies`.** A30's behavioural headline ("reads 0 of 13
>    `responses`") was a TABLE-level measurement through RLS and was correct as such — but
>    `dashboard_export_rows` returned per-response answers plus the member's name through a DEFINER
>    gate RLS never evaluates. *"Reads 0 rows of T"* ≠ *"cannot reach T's content."*
> 2. **A census is a snapshot, not an invariant.** This one was accurate on the day and wrong six weeks
>    later, because nothing executable held the property. That is why the fix ships with a pgTAP
>    keystone rather than a corrected list.
>
> The noun rule itself needed no revision — as of `20260903000700` the database enforces it on this
> surface instead of only describing it.

A **40-site catalog census** (`docs/progress/authz-a30-platform-admin-inventory.md`) — **not 42**: the
count was inflated by **three comment-only matches**, and those comments **document the arm's removal**
(`-- ⟵ INFO-1: the is_admin() bypass is GONE`). *A `prosrc` text match counts `--` comments.* **The
claim that "both confidentiality-ceiling helpers carry admin arms" is FALSE against this catalog.**
Third time the program's own founding finding — **text is not truth** — bit the people who wrote it.

**Population, not a floor:** `app.is_admin` is the **only** reader of the raw JWT claim; Storage clean
(19 policies, 0 arms); ACLs clean; no trigger carries its own arm. ⚠ An `is_admin()` filter alone
**misses `guard_profile_privileged_columns`** (reads the column directly); the naive transitive closure
reports **177** because ~100 flow through `audit_write`, which only **stamps `actor_is_admin`** —
**attribution, not authorization**. Name trap: `can_read_case_or_admin`'s "admin" is *commission*_admin.

**Buckets: A=26 legitimate · B=7 tenant-non-PHI · C=5 PHI · D=1 · 1 not-an-arm.**

**PO ruling 1 — the noun rule (adopted; 39/40 mechanical).** `platform_admin` **MAY** touch
**tenancy · identity · vocabulary · audit**; **MAY NOT** touch **commission content or PHI**.
⚠ The obvious line — *"never touches a table with `commission_id`"* — was **tested and REJECTED**: it
strikes `commissions_admin_write` + `memberships_select` (**breaking tenant onboarding**) while
**missing `professional_credentials`** (no such column). **Rule on the noun, not the column.**

**PO ruling 2 — CLAUDE.md §1 amended.** Measured: platform_admin reads **0 of 7 cases · 0 of 13
responses · 0 of 6 narratives · 0 meetings**. *"Walled off from all tenant data"* was **not a rule
contradicted 42×** — it was a rule **stated too absolutely**, false 12×, which **trains readers to
ignore it**. An aspirational rule in a binding rulebook is worse than an accurate narrow one.

**PO ruling 3 — bucket C lands in M2, before the resolver.** **No arm reads Class-1 patient PHI**
(`patient_identifiers` is denied at grant level). **The breach is DESTRUCTION, not disclosure** —
platform_admin **destroyed referral PHI it cannot read** (1 row → 0, proven by execution, not by
predicate). `dispose_referral_phi` / `can_dispose_referral_phi` are the **lone outliers**: the **four
sibling disposal RPCs carry no arm**, so the correct shape is already proven. **~6 lines, subtractive**
— it cannot conflict with a resolver that only **adds** paths. **Class-2 (professional identity) is
deliberately excluded** — audited reads, a product decision; over-reach fails keystone 23. **B and D
deferred.**

⛔ **The fix needs its over-grant twin**: assert the **non-admin disposal population STILL disposes**,
or the test **passes by construction** (A33).

### A33 — ⛔ BINDING: **mutation-test every keystone.** An over-grant twin is not enough.

A0 + M1 produced **six** keystones that **could not fail** — including two ⭐ keystones, one of them
**Rule 12**. Review did not find them; **reverting the fix and requiring the test to go red** found every
one. **A test that cannot fail is not evidence.** [[no-regression-claim-needs-overgrant-twin]] said pair
every no-regression claim with an over-grant twin; **M1 proves the twin itself can be vacuous.**

**Four shapes, each green while asserting nothing:**
1. **Wrong-arm fixture** (M1 tests 33/34): an earlier *positive* twin left the principal **self-recused**,
   so every later assertion measured the **recusal** arm while the fix under test guarded the
   **respondent** arm. *A fixture that leaves the principal denied by a **different arm** than the one
   under test.*
2. **Pre-existing deny** (A22 + closure): `app.guard_action_item` **hard-forces**
   `visibility_scope := 'case_restricted'` for `source_type='case'`, whose arm delegates to
   `can_read_case` — **which already carried the deny before M1**. The keystone proved a deny M1 didn't
   make. Reachable shape is `source_type='manual'` + `case_id`.
3. **Missing precondition** (`qa`'s own P0 fixture, offered as *"seeded and ready"*): the seeded
   respondent is plain `staff`, so the door **correctly** raised on **authority** and `throws_ok` passed
   it. Preconditions must be **narrow**: **respondent AND `staff_admin`**.
4. **Un-keystoned deviation** — **the most fragile artifact on this program** (`can_write_interview`,
   then door-2's linkage check): a fix the engineer was **right to invent** beyond spec gets **no test by
   construction**, because nobody was owed one. *An unasserted fix is indistinguishable from no fix, and
   "0 failures" says nothing.*

**The structural defence (ratified):** give **authority** and **exclusion** distinct SQLSTATEs and check
**authority FIRST** (`HC0E4` before `HC0F1`). A twin whose principal lacks the precondition then fails
**loudly** instead of being caught. **This makes the vacuous keystone unwritable, not merely
discouraged** — it caught one the author had just written.

**And the inverse — `red` ≠ `abort`.** The harness twice reported *not-falsifiable* when the suite had
**aborted** (a dropped trigger killed an INSERT derivation → coherence CHECK → the test never ran), and
`qa`'s own regex printed `tests_run=0` from an unbalanced paren — it nearly filed *"nothing went red"* as
evidence, **reproducing the exact false-negative it was auditing**. **Never accept "0 failures" until you
have proven the tests RAN.** Neuter **one function at a time** — a global neuter reverts everything and
proves nothing about any single keystone.

### A34 — M1 as built (2026-07-15) — **the P0s are dead, behaviourally**

`20260722000000_authz_m1_exclusion_durability.sql` (M1·1–3) + `20260722000100_authz_m1_gate_helper_deny.sql`
(M1·4b + direct-check doors) + `229_authz_m1_exclusion_durability.sql` + a runnable mutation harness
(`supabase/tests/mutation/m1-mutation-audit.sh`). **pgTAP 2610/2610** on a fresh reset; lint 0/0; scope
exact (**121/93/42**). **8/8 confirmed dead behaviourally, rows surviving the denied party; 0 over-reach.**

- **SQLSTATE `HC0G` → `HC0F`** — the block this ADR declared *"collision-checked at freeze"* **collided**:
  `grant_role`/`revoke_role` hold `HC0G0–2`. **The check had never been run.**
- **B7's own trap:** adding the `user_id` write path A31·5 demands **creates a sixth self-serving
  mutator** (`can_manage_professional` admits any org `staff_admin` — *exactly the respondent twin's
  precondition*). **M1·1 would have handed back the hole M1·2 closes.** Closed with a linkage freeze
  (`HC0F2`) that binds **direct DML** too.
- **B7's attach-time check binds BOTH doors** — §W-6 named only `add_case_participant`;
  `set_case_participant_role` can **re-key *to*** `respondent_doctor` and bypass it.
- **`record_recusal` deliberately did NOT get a blanket term** — recusal is **monotonically restrictive**;
  a blanket term would deny an excluded party the ability to recuse **herself**. The exclusion binds the
  **coordinator arm only**. *The one place the engineer argued for **less** gating — and was right,
  proven both directions.*
- **`case_participant_roles`:** UPDATE-freeze on `key` (`HC0F3`) + audit trigger — **not** a write-freeze
  (`set_participant_patient` **INSERTs** an `affected_patient` row; a blanket freeze breaks patient
  registration). No bypass: `DISABLE TRIGGER` and `session_replication_role` both `42501`.
- **`dispose_case_phi` (Rule 12, found by `qa`):** the accused **could not read** the patient identifiers
  and **could irreversibly destroy them**. Its twin (`can_write_attachment`) was fixed; it was missed.
  ⚠ The first probe nearly cleared it — the `23514` it caught was **the reason-code check, not the gate**.
  **Never accept an error code as proof of a gate.**
- **`ON DELETE SET NULL` (A31·5) → `RESTRICT`.** Proven **unreachable today** (`profiles.id → auth.users`
  is `ON DELETE RESTRICT` + `handle_new_user()` guarantees a profiles row, so the delete always fails on
  `profiles_id_fkey` first). **Latent, not app-reachable** — so fail-closed cost nothing and it arms the
  moment anyone relaxes that FK to CASCADE (**the conventional Supabase pattern**). Reversible in one line.

**Carried (NOT done):** §3.6·A's remaining triage doors + §3.6·B per-row filters. **Durability is
unaffected** — `qa` called **every** carried door the excluded party can reach and the deny held on all of
them, except `dispose_case_phi` (fixed). `get_case_patient` is a **verified false alarm** (delegates to
`get_participant_patient`, gated on `can_read_case_patient`) — **D4's false-positive class is real**, so
the carry must stay **triage, not a fix list**: a text-filter sweep would over-reach and **keystone 23
fails if the negatives over-reach**. ⚠ **`set_case_confidentiality` is genuinely UNVERIFIED** (`HC0E5` —
gate or precondition?) — **do not record it as safe.**

