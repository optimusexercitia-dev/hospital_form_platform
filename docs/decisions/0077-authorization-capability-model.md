# 0077 — Authorization capability model: case capabilities, granular grants, meeting boundary & referral disclosure

**Date:** 2026-07-14 · **Status:** 🟡 **PROPOSED — awaiting human approval** (design approved by the
developer team; implementation not started; no migration authored).
**Owner:** platform lead → `backend`.
**Source design:** [`docs/design/temp/user-permissions-model-handoff.md`](../design/temp/user-permissions-model-handoff.md)
(the user-approved target design; this ADR is its ratification against the as-built schema).
**Evaluation of record:** the handoff's three headline defects were verified against the live
migrations before this ADR was written; §Context records what survived that check and what did not.

**Supersedes / amends:**
- **Amends ADR [0033](./0033-case-access-control.md)** (`case_access` ACL): the two-valued
  `level ∈ {read,write}` grant plane is replaced by a capability-per-column grant table
  (`case_access_grants`, D5). `case_access` is retired at Stage G.
- **Amends ADR [0072](./0072-ethics-access-spine.md)** (ethics access spine): 0072's deny-first
  ordering, `app.can_read_case_or_admin`, `app.is_case_excluded`, and
  `app.can_reach_case_on_member_surface` are **preserved semantics**, re-expressed inside the
  capability resolver (D2). 0072's `case_access.max_confidentiality` clearance plane migrates to
  `case_access_grants.read_restricted_phi` + the label ceiling (D5·4).
- **Amends ADR [0037](./0037-inter-committee-referrals.md)** (referrals): referral PHI becomes an
  explicit, field-bounded, versioned **disclosure snapshot** rather than a predicate-gated live
  write (D7).
- **Amends ARCHITECTURE.md Rule 12** — Standard PHI becomes a capability distinct from Case
  Content; ordinary case read/write and bare assignment no longer imply patient-identifier read.

**Relates:** ADR [0041](./0041-tenancy-roles.md) (role model), ADR [0051](./0051-commission-admin-predicate.md)
(`is_commission_admin_of`), ADR [0061](./0061-administrativo-delegated-capability.md)
(delegated capability precedent), ADR [0063]/F2 attachments (the one confidentiality taxonomy),
ADR [0065](./0065-polymorphism-dialects.md) App-A (column-per-scope dialect),
ADR [0071](./0071-pre-pilot-release-scope-expansion.md) (the pre-pilot release program this
sequences against), ADR [0075](./0075-memberships-collapse-write-path-split.md) (`memberships` +
`has_role`).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 6/R6 (anti-recursion), Rule 8 (generated
types), Rule 9 (queries layer), Rule 11 (audit), Rule 12 (PHI).

---

## Context

The platform's case authorization is a multi-arm boolean union, not the "single `can_read_case`
boolean" the handoff's framing implies. As-built (verified 2026-07-14, 109 migrations):

- `app.can_read_case` / `can_read_case_patient` / `can_write_case_content` each union
  coordinator · commission-admin (read only) · `case_access` grant · phase/narrative assignment ·
  a PQS-via-referral arm — behind **hard-deny** respondent/recusal terms evaluated first (ADR 0072).
- `case_access` already carries `level ∈ {read,write}`, `expires_at`, `reason`, and
  `max_confidentiality` (the 0072 document-clearance plane).
- `app.is_active` exists and is folded into **every membership helper**.
- `memberships` + `has_role` (ADR 0075) is already the single role-truth this design asks for; §5.1
  of the handoff is therefore **already satisfied** and requires no work.

Three defects in the handoff were verified as **real**:

1. **Case Content and Standard PHI are conflated.** `can_read_case_patient` grants PHI through the
   *same* `case_access` arm (any `level`) **and** through bare `case_phases` / `case_narratives`
   assignment. A plain read grant, or being assigned a phase, silently opens patient identifiers.
   This is the single most consequential finding and the primary justification for this ADR.
2. **Referral read authority implies snapshot write authority.** `public.set_referral_patient` gates
   its write on `app.can_read_referral_phi` — so any PHI *reader* (source coordinator, target
   coordinator, PQS operator, target analyst) can **overwrite** the transmitted patient snapshot.
   Blast radius is that one RPC (the referral draft-write path has its own
   `can_manage_referral_source` gate), but the defect is real.
3. **Deactivation is not an outer gate.** `app.is_active` is folded into the membership helpers but
   **not** into the `case_access` grant arm or the phase/narrative assignment arms. A deactivated
   user holding a live grant or assignment still reads.

One claimed defect **did not survive** verification and is recorded here to prevent it being
re-litigated:

> **`meeting_cases` is no longer an unbounded leak.** Commit `02bd2db` / migration
> `20260720001070` dual-gated `meeting_cases_select` on
> `app.can_reach_case_on_member_surface(case_id, …)`, which denies the excluded first and reduces
> `explicit_grants_only` cases to grant/attribution/coordinator. What **remains** is deliberate: for
> `commission_default` cases, `is_member_of(commission)` still grants reach to the meeting
> `summary`/`decision`. ADR 0072 D2·8 preserved that arm **on purpose** — `can_read_case` has no
> plain-member arm on the `case_access`-ON path, so a naive `and can_read_case_or_admin(...)`
> conjunct would have silently destroyed ordinary members' reach to ordinary deliberation.
> Stage C is therefore a **deliberate product tightening**, not a leak fix — and because meetings are
> **on for pilot hospitals**, it *removes* reach those users have today (D6, O1).

**Non-goal.** This ADR does not implement the NSP Investigation model or attachment-sensitivity
enforcement; both are deferred post-pilot (D8). It does not authorize any remote/shared database
migration (Rule: remote rollout requires separate user approval).

---

## Decision

### D1 — Authorization is expressed as capabilities, not booleans

Case capabilities (the handoff §3.1, adopted verbatim):

```
view_case_overview · read_case_content · write_case_content
read_standard_phi  · read_restricted_phi · manage_case_access
```

Implication lattice, and **nothing else is automatic**:
`write_case_content ⇒ read_case_content ⇒ view_case_overview`;
`read_restricted_phi ⇒ read_standard_phi`.
Crucially: **neither PHI capability implies `write_case_content`**, and `read_case_content` does
**not** imply `read_standard_phi`. That non-implication is the whole point of this ADR (Context·1).

Meeting capabilities: `view_meeting_metadata · read_meeting_content · manage_meeting ·
read_meeting_case_section` (the last resolved from **Case** authority, not Meeting authority).

### D2 — One resolver: `app.case_capabilities`, preserving 0072's deny-first ordering

```sql
app.case_capabilities(p_case_id uuid, p_user_id uuid) returns jsonb
app.has_case_capability(p_case_id uuid, p_user_id uuid, p_capability text) returns boolean
```

`case_capabilities` is the single semantic source; the boolean wrapper exists for RLS readability
and planner behaviour. Fail-closed evaluation order:

```
1. null user                          → {}
2. NOT app.is_active(p_user_id)       → {}            ⟵ D3, the outer gate
3. resolve case tenant anchors; absent/mismatch → {}
4. HARD DENY (0072, preserved verbatim, before every positive arm):
     app.is_case_respondent | app.is_recused_from_case  → {}
5. union positive sources: committee_coordinator · case_assignment ·
     active case_access_grants · (post-pilot) nsp_investigation · referral
6. apply lifecycle restrictions to write capabilities
7. return the capability set (+ source attribution, internal)
```

**R6 discipline is binding.** Every participant/recusal/grant-derived term is computed **inside**
the `SECURITY DEFINER` over **base tables** — never an RLS-gated read (which recurses). This is the
ADR-0064 R6 pre-commitment that 0072 honoured; this ADR does not relax it.

**0072's as-built lesson is carried forward as a hard requirement:** *the resolver being correct does
not make the policies consuming it correct.* 0072 delta 3 found three policy shapes that handed rows
back around a correct predicate — `*_select` policies OR-ing the admin arm **outside** the DEFINER;
`FOR ALL` PERMISSIVE `*_staff_admin_write` policies with **no case predicate at all** (invisible to
grep); and a case↔meeting join keyed on the wrong dimension. The Stage-A call-site inventory (D9·1)
is therefore **catalog-driven, not grep-driven**, and the generic leak sweep 0072 added to pgTAP is
extended to every capability, not just exclusion.

### D3 — `app.is_active` becomes the outer gate on every path

`is_active` is added to the `case_access_grants` arm, the phase/narrative assignment arms, referral
analyst access, meeting participation, attachment access, and action-item assignment — not only the
membership helpers. Deactivation must deny at the database boundary with a live JWT and surviving
grants. Session revocation on deactivation is a companion application requirement, **not** the
security boundary.

### D4 — Organization/hospital administration ceases to be a Case Content or PHI source

`app.is_commission_admin_of*` (= `org_admin` of the case's org OR `hospital_admin` of its hospital)
is **removed from Case Content and attachment authorization**. Organization Users retain full
administrative authority and PHI-free aggregates; they lose case content and patient identifiers.
If such a person must participate clinically, they hold a Committee role or an explicit grant —
independently revocable.

> **Interaction with 0072 (explicit).** `app.can_read_case_or_admin` exists *because* nine `*_select`
> policies OR'd the admin arm. D4 removes that arm, so the helper collapses to `can_read_case` and is
> retired at Stage G. This does not undo 0072 — 0072 fixed the *ordering* (deny-before-admin); D4
> removes the *arm*. Sequencing matters: D4 lands **after** the resolver (Stage A), never as a
> standalone policy edit.

### D5 — `case_access_grants` replaces `case_access`

Per the handoff §5.2 sketch, with these binding refinements:

1. **Tenant-safe composite FK** from the grant to the case's organization/hospital anchor.
2. **Column-per-scope for `source_entity_id`** — ADR 0065 App-A dialect-1: explicit nullable FK
   columns per source, never a bare polymorphic id.
3. **No direct authenticated INSERT/UPDATE/DELETE.** Writes only through audited DEFINER doors
   (`grant_case_access` / `revoke_case_access` / `list_case_access` re-cut against the new shape),
   `REVOKE ALL … FROM PUBLIC` then explicit grant (the t19 guard).
4. **`max_confidentiality` migrates, it does not vanish.** 0072's clearance column maps to
   `read_restricted_phi` **plus** the retained label ceiling
   (`app.attachment_confidentiality_ok` / `app.confidentiality_rank`). The 7-value taxonomy and the
   O2 ruling (only `legal_privileged` + `credentialing_sensitive` gate above ordinary case-read) are
   **unchanged**. ⚠ `CONFIDENTIALITY_ORDER` (FE) is display order, **not** sensitivity order — 0072's
   standing warning survives.
5. **Migration mapping** (Stage B):
   - `level='read'`  → `read_case_content = true` **only**
   - `level='write'` → `read_case_content = true, write_case_content = true` **only**
   - **PHI is never inferred** from an existing read/write grant or assignment (O2).

Assignment-derived access is **not** copied into this table; assignments remain source records
evaluated by the resolver.

### D6 — Meeting boundary (Stage C): participation + case authority

`read_meeting_case_section(meeting, case, user) = can_read_meeting_content(meeting, user)
AND has_case_capability(case, user, 'read_case_content')`.

Meeting content reads repoint from bare commission membership to **Coordinator or Meeting
Participation** (`meeting_attendees`, today used only for signing). Case-specific meeting fields
(`meeting_cases.summary` / `.decision`) require **both** authorities.

> **This changes behaviour for pilot hospitals.** Today a `commission_default` case's meeting
> deliberation is member-wide by design (0072 D2·8). D6 reduces it to participants with case
> authority. Because `can_read_case` has no plain-member arm, this is exactly the trap 0072 delta 4
> documented — the tightening is intended here, but it must be a **PO decision**, not an emergent
> side-effect of a conjunct. See **O1**; it is the single most user-visible change in this ADR.

`meetings.minutes_md` remains general content; case-specific discussion belongs in `meeting_cases`.
The application warns authors against duplicating case/PHI material into general minutes; existing
minutes are reviewed for duplication **before** the tighter policy is enabled.

### D7 — Referral PHI disclosure (Stage F, **pre-pilot**)

1. Add `referral_phi_disclosures` (handoff §5.6): purpose, `approved_fields`, approver, recipient,
   expiry/revocation, `snapshot_version`.
2. `referral_patient` is retained as the **immutable transmitted snapshot**; its writer enforces the
   disclosure's `approved_fields`. Corrections create a new version / append-only amendment,
   preserving provenance. The live source patient row is never exposed.
3. **Split the conflated predicate:** `can_read_referral_metadata` · `can_read_referral_phi` ·
   `can_write_referral_response` · `can_manage_referral_phi_disclosure` ·
   `can_amend_referral_phi_snapshot`.
4. **`set_referral_patient` is removed from the public API** (Context·2). Only the disclosure
   workflow writes the snapshot. Read never implies write.
5. Referral creation defaults to **no PHI disclosure**.
6. **Storage ripple:** `referral_attachments_obj_select` (Storage RLS) currently rides
   `can_read_referral_phi`; it repoints to the split predicate in Stage F even though full
   attachment-sensitivity work (Stage E) is post-pilot.
7. **Legacy rows** are migrated only after an explicit legacy disclosure provenance is assigned.

### D8 — Deferred post-pilot: Stage D (NSP Investigations) and Stage E (attachment sensitivity)

**Stage D** (`nsp_case_investigations` + assignments + coordinator-only lifecycle RPCs +
notifications + PHI-free hospital aggregate doors) is net-new **product** surface, including UI, not
a re-gating. It is deferred.

> **Consequence to state plainly:** today NSP has **no** general hospital-wide case reach — the
> `can_read_case` NSP arm fires only when the case is *touched by a `case_referral` row*. Stage D
> therefore **grants NSP more macro visibility than it has now**, in exchange for removing that
> referral-shaped backdoor. Deferring D means the backdoor **survives the pilot**. That is an
> accepted, recorded risk (O3), not an oversight.

**Stage E** (attachment sensitivity): `app.can_read_attachment` is owner-keyed `(owner_type,
owner_id, uid)` and structurally cannot see a row's label — which is why 0072 bolted the ceiling onto
`open_attachment` + the `attachments` SELECT policy instead. Stage E reworks the signature to be
row-aware and enforces the tier→clearance mapping. Deferred; the 0072 ceiling remains in force
meanwhile.

### D9 — Process, SQLSTATEs, audit

1. **Stage A produces a migration contract before any SQL** (handoff §15): a **catalog-driven**
   inventory (per 0072 delta 3 — grep is insufficient) of every call site of `can_read_case`,
   `can_read_case_patient`, `can_write_case_content`, `can_read_case_or_admin`, `is_case_excluded`,
   `can_reach_case_on_member_surface`, `is_commission_admin_of*` on clinical tables,
   `can_read_attachment`, `can_read_referral_phi`, meeting/`meeting_cases` policies, patient-identifier
   doors, and Storage object policies. Each is classified by replacement capability **and** by path
   kind (base-table RLS · public RPC · `app` helper · Storage RLS · service-role server action).
   **No policy is mechanically renamed without this classification.**
2. **pgTAP first.** The handoff §11 matrix maps ~1:1 to test cases and is authored **before** the SQL,
   exercised as `authenticated` under real RLS/RPC privileges — never only as `postgres`.
3. **SQLSTATE block `HC0G0–HC0G9`** (proposed; collision-checked at build-plan freeze).
4. **Audit verbs:** `case_access.granted|changed|revoked|expired`, `case.break_glass_opened|closed`,
   `referral_phi.approved|transmitted|read|amended|revoked|disposed`, membership lifecycle. PHI-free
   metadata only (Rule 11) — no names, MRNs, narrative bodies, attachment titles, or free-text notes.

---

## Staging

Pre-pilot **A · B · C · F**; post-pilot **D · E** (PO-directed 2026-07-14). Stages land as separate
reviewable migrations — never one combined migration.

| Stage | Scope | Window | Difficulty | Gate / exit |
|---|---|---|---|---|
| **A** | Capability spine; `is_active` closure (D3); retire the admin arm (D4) | pre-pilot | **Medium-High** | authorized clinical users retain access; inactive + Organization Users cannot read Case Content |
| **B** | `case_access_grants` (D5); migrate `case_access`; re-cut doors | pre-pilot | **Medium** | read / write / Standard PHI / Restricted PHI / access-admin independently grantable |
| **C** | Meeting boundary (D6) | pre-pilot | **Medium** | linked case material requires **both** meeting and case authority; **O1 signed** |
| **F** | Referral disclosure (D7) | pre-pilot | **Medium-High** | every disclosure purpose/field/recipient-bound, versioned, audited; `set_referral_patient` gone |
| **D** | NSP Investigations | **post-pilot** | **High** | NSP macro visibility without Case Content; detail only via active investigation |
| **E** | Attachment sensitivity | **post-pilot** | **Medium** | ordinary case access cannot open Restricted PHI |
| **G** | Cleanup, type regen, advisors, full gates | closes each window | **Low-Medium** | pgTAP + prod-build E2E + QA green |

**Ordering constraint (F before D).** Stage F pre-pilot with Stage D post-pilot means the handoff's
rule *"NSP visibility of Referral PHI follows an active investigation, not hospital NSP role alone"*
**cannot be honoured pre-pilot** — no investigations exist yet. Pre-pilot F therefore **retains the
existing PQS-operator arm** on referral PHI reads, and Stage D removes it. Recorded as **O3**.

**Program interaction.** This ADR is sequenced **against**, not inside, the ADR-0071 pre-pilot
release track (S-stages). It must not be folded into an in-flight S-stage: Stage A touches every case
content policy and would collide with any concurrent policy work. The lead serializes it as its own
gate unit.

---

## Consequences

- **Least privilege becomes real where it matters.** A read grant or a phase assignment stops opening
  patient identifiers (Context·1). This is the change that justifies the program.
- **Access becomes explainable.** `sources` + `expiresAt` on the capability object let the UI say
  *why* access exists and when it lapses — today that is unanswerable.
- **Users will lose access they have today.** Organization/hospital admins lose case content (D4);
  read-grant and assignment holders lose PHI until re-granted (D5·5); ordinary members lose
  meeting case sections for cases they are not involved in (D6). None of these are bugs; all are
  **clinical-workflow changes** requiring PO socialization before the pilot, not silent migrations.
- **Performance is a real risk, not a footnote.** A `jsonb` resolver evaluated inside SELECT policies
  on high-row-count content tables (`answers`, `case_narratives`, interview family) must not be
  invoked per row. `EXPLAIN (ANALYZE, BUFFERS)` on the case board, case detail, meeting detail,
  attachment listing, and referral inbox is a **Stage-A exit criterion**, gated *before* policies are
  repointed. Index every FK and every RLS-predicate column; use `(select auth.uid())`.
- **0072's semantics survive intact.** Deny-first, R6, the one confidentiality taxonomy, the
  `confidentiality_rank` vs FE-display-order warning, and the catalog-driven leak sweep are carried
  forward, re-expressed — not rebuilt.
- **The NSP referral backdoor survives the pilot** (D8/O3) — accepted and recorded.
- **`memberships` needs no work** — ADR 0075 already satisfies the handoff §5.1 invariants.

---

## Open decisions (flagged for PO / lead)

- **O1 — Stage C member reach (the headline).** D6 removes ordinary members' reach to
  `commission_default` meeting case sections — reach they have **today**, on a feature that is **on
  for pilot hospitals**. Options: (a) ship D6 as designed (handoff §2.5, strict); (b) keep
  `can_reach_case_on_member_surface` for `commission_default` and dual-gate only
  `explicit_grants_only` + restricted cases (preserves pilot behaviour, weaker than the handoff);
  (c) defer C post-pilot. **Recommend (b) for the pilot, (a) after**, because the exploitable arm is
  already closed and (a) is a workflow change pilot users have not been prepared for. **Requires PO
  sign-off — this ADR does not presume it.**
- **O2 — PHI re-grant migration (D5·5).** Existing read/write grant and assignment holders lose
  Standard PHI at Stage B. Confirm the PO accepts a re-grant campaign rather than a one-time
  inference of `read_standard_phi` from `level='write'`. **Recommend no inference** (the handoff is
  right); the cost is operational, not technical.
- **O3 — NSP referral arm pre-pilot (F-before-D).** Confirm the existing `is_pqs_operator_of_for`
  arm on referral PHI may survive the pilot, to be removed at Stage D.
- **O4 — Break-glass at pre-pilot?** The handoff mandates reason + short expiry + notification +
  post-event review. **Recommend deferring the source to post-pilot** (with `manage_case_access`
  covering exceptional grants) — it is workflow, not a security seam.
- **O5 — `view_case_overview` surface.** Confirm whether `list_my_cases` / the case board become
  capability-resolved or keep `can_reach_case_on_member_surface`. Interacts with O1.

---

## Test keystones (gate; extend, never replace, 0072's suite)

1. The full §11.1 case matrix, per persona, as `authenticated` — including **multiple simultaneous
   sources** (revoking one must not remove another valid source) and **deactivation denies all**.
2. `read_case_content` **without** `read_standard_phi` — the Context·1 regression, the single most
   important new negative.
3. Deny-terms still cannot be out-voted **at the policy layer** — the catalog-driven leak sweep over
   every `case_id`-bearing table, both persona classes, fail-closed (0072's, extended per-capability).
4. Meeting: attendee without case access cannot read the linked case section; case reader without
   participation cannot read the meeting; **no `commission_default` reach regression** beyond what O1
   authorizes.
5. Referral: target cannot overwrite the transmitted identity; `set_referral_patient` is gone;
   metadata reader sees no PHI body, path, or sensitive title; expiry/revoke blocks future reads.
6. Grant doors: no direct authenticated DML; no self-grant; no self-escalation of capabilities;
   `write ⇒ read`, `restricted ⇒ standard` enforced by CHECK; PUBLIC execute revoked.
7. Flag-OFF / pre-migration invariant: `commission_default` cases behave byte-for-byte as today
   wherever this ADR does not deliberately change them.
