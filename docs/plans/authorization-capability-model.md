# Build plan — Authorization Capability Model

> **ADR:** [0078](../decisions/0078-authorization-capability-model.md) (ACCEPTED 2026-07-15)
> **Branch:** `feat/authorization-capability-model` (off `main` `30c0e7c`)
> **Sequencing:** **BEFORE S4** (ETH·E2 · RV2 R2–R5 · CH). Its own gate unit — **never** folded into
> an in-flight S-stage (Stage A touches every case-content policy).
> **SQLSTATE block:** `HC0G0–HC0G9` (collision-check at freeze)
> **Flag:** none. This program **retires** the `case_access` flag (ADR 0078 D9) and ships a single
> authorization path. Reset-OK; no rollback target exists and none is wanted.
> **Remote:** local only. Remote lands at the pilot reset, with separate user approval.

## Ownership

| Unit | Owner | Model |
|---|---|---|
| Migrations, RLS, RPCs, `app` helpers, seed rework | `backend` | Opus (multi-file authorization refactor) |
| pgTAP suites | `backend` (authored **before** the SQL) | Opus |
| `src/lib/queries` + capability contract types | `backend` | — |
| UI capability consumption (`CaseCapabilities`, sources/expiry surfacing) | `frontend` | Sonnet |
| E2E specs | `tester` | — |
| Gate review | `qa` | — |
| Full `e2e:prod` runs | **lead** (subagents cannot — 18–40 min > foreground cap) | — |

**File ownership is binding.** Stage A/B are `backend`-only. Frontend work starts only after Gate 1
is green (the capability object's shape is a Stage-A output).

---

## Gate 1 — Security spine (Stages A + B)

All the risk lives here. If the spine is wrong, everything after is built on sand.

### A0 · Migration contract — **catalog-driven** (no SQL until this is reviewed)

> **Binding, per ADR 0078's METHODOLOGY FINDING.** Migration **file text is stale**:
> `20260709000200` rewrites function bodies off the live catalog via
> `pg_get_functiondef()` + `replace()` + `execute`. During evaluation a file-reading agent produced a
> confident **false P0**. An external auditor tripped on the same rewrite. graphify does not index
> SQL. **Inventory from `pg_proc` / `pg_policies` / `pg_depend` — never grep, never files.**

1. Enumerate every call site of: `can_read_case`, `can_read_case_patient`, `can_write_case_content`,
   `can_read_case_or_admin`, `is_case_excluded`, `can_reach_case_on_member_surface`,
   `is_commission_admin_of*` on clinical tables, `can_read_attachment`,
   `attachment_confidentiality_ok`, `can_read_referral_phi`, meeting / `meeting_cases` policies,
   patient-identifier doors, Storage object policies.
2. Classify each by **replacement capability** AND **path kind**: base-table RLS · public RPC ·
   `app` helper · Storage RLS · service-role server action.
3. Flag the three shapes ADR 0072 delta 3 found (invisible to grep): `*_select` policies OR-ing an
   admin arm **outside** the DEFINER; `FOR ALL` PERMISSIVE `*_staff_admin_write` policies with **no
   case predicate**; case↔meeting joins keyed on the wrong dimension.
4. **Deliverable:** `docs/progress/authz-capability-inventory.md`. **Lead + `qa` review before any SQL.**

#### A0 · Findings already CONFIRMED from the catalog (2026-07-15) — start here, then extend

Verified via `pg_policies` / `pg_proc` during the ADR 0078 Amendment-2 evaluation. **Do not re-derive;
do verify nothing has moved.** Blast radius of `is_commission_admin_of`: **93 policies, 119 functions**
— most of them *legitimate* Organization-User administration (forms, indicators, documents, process
templates, titles). **Do not sweep the arm globally.** Only the surfaces named in ADR 0078 D4 / A8–A11
lose it.

| Finding | Impact |
|---|---|
| **`is_commission_admin_of` = `org_admin OR hospital_admin` ONLY** — *not* `staff_admin`. The coordinator reaches meetings via `is_member_of` (= `has_role_any('commission',…)`). | Renames Amendment 1 A2·1's "coordinator OR-arm" → it is the **Organization User's** arm. |
| **Four `FOR ALL` PERMISSIVE write policies** — `meetings_` · `meeting_agenda_items_` · `meeting_attendees_` · `meeting_cases_staff_admin_write`. Permissive policies OR; `FOR ALL` `USING` applies to SELECT. | **C2 and C3 are no-ops** unless these are re-cut in the same migration. Only `meeting_cases_` carries a case predicate. |
| **`meetings_staff_admin_write` has a third arm:** `member_can(commission_id,'schedule_meetings')` — named in no document. | An `administrativo` delegate reads every `participants_only` meeting. ADR 0061 scoped that capability to *scheduling*. |
| **`app.can_write_attachment`'s `'case'` arm** keeps `is_commission_admin_of_for` — D4·1 removes the *read*, not this. | ⚠ **ADR 0078 A14 — needs a PO decision at Stage A.** Org admin could upload a case attachment they cannot read back. |
| `app.can_read_action_item`'s `case_restricted` scope → `can_read_case`; `can_read_attachment`'s `'action_item'` arm → `can_read_action_item`. | Both **fixed for free**. Don't double-patch. |
| `app.is_pqs_operator_of_for` = `nsp_coordinator OR pqs_member`. | The handoff's two NSP rows are **one row** until Stage D. Don't design for a distinction the schema can't make. |

### A1 · pgTAP first (authored before the SQL)

New suite `229_authz_capabilities.sql`, **extending** — never replacing — `228_ethics_e1`'s
catalog-driven generic leak sweep, now per-capability. Everything as `authenticated` under real
RLS/RPC privileges; **never only as `postgres`**. Covers ADR 0078's nine test keystones.

### A2 · The resolver

- `app._case_caps(p_case_id uuid, p_user_id uuid) returns integer` — **private bitmask core**, the
  single semantic source. Fail-closed order: null → inactive (**D3**) → tenant anchors →
  **hard-deny (respondent/recusal, before every positive arm)** → union sources → lifecycle → bitmask.
- `app.case_capabilities(...) returns jsonb` — app projection.
- `app.has_case_capability(..., p_capability text) returns boolean` — RLS projection, **bit test only**.
- **R6 binding:** every term computed inside the DEFINER over **base tables**. Never an RLS-gated read.
- DEFINER posture: `app` schema, owner + `search_path` pinned, `REVOKE ALL … FROM PUBLIC`, explicit
  grants only where RLS evaluation needs it.

**Sources** (ADR 0078 D11): `committee_coordinator` · **`committee_member_default`** ·
`case_assignment` · `manual_grant`. (`nsp_investigation` / `referral` / `break_glass` reserved.)

**The member arm:** `active member AND cases.visibility_policy = 'commission_default' AND NOT excluded
⇒ read_case_content` — **never** `read_standard_phi`, **never** `write_case_content`.

**Write arms (D10):** `write_case_content` = Coordinator OR active explicit write grant. **No
assignment arm** — a deliberate divergence from the handoff; do not "fix" it.

### A3 · `case_types.default_visibility_policy`

Creation-time default only. `cases.visibility_policy` stays the **sole runtime authority**. Not a
second switch.

### A4 · Repoint policies (only after A0 is reviewed and A1 is red-then-green)

Remove `is_commission_admin_of*` from `can_read_case` (D4·1) and from `can_read_attachment`'s
**`'interview'`** arm. Case attachments are fixed for free via `can_read_case`.

> ⚠ **The `'meeting'` arm also goes — but in Stage C, not here.** ADR 0078 **Amendment 2 (A9) reverses
> D4·2**; the removal is sequenced with the rest of the meeting family in **C7** so the whole
> "Organization User loses meetings" change is one reviewable unit with one test story. `can_read_attachment`
> is rewritten twice across the program (A4, then C7) — that is intended, not drift.
>
> ⚠ **A14 — needs a PO decision before this step lands.** `app.can_write_attachment`'s **`'case'`**
> arm keeps `is_commission_admin_of_for`, so after A4 an Organization User can upload a case
> attachment they cannot read back. Not a leak; hard to justify under D4's principle. **Ask, don't
> assume** — the ADR deliberately leaves it open.

### A5 · ⛔ Performance gate — **exit criterion, before policies repoint**

`EXPLAIN (ANALYZE, BUFFERS)` with representative multi-hospital volumes on: case board · case detail ·
meeting detail · attachment listing · referral inbox. Index every FK and every RLS-predicate column;
`(select auth.uid())` in policies. **The bitmask core exists to keep per-row cost at today's
`can_read_case` level — prove it, don't assume it.**

### B1 · `case_access_grants` (hard cut)

Drop `case_access`. Create with: capability-per-column · tenant-safe composite FK to the case's
org/hospital anchor · **column-per-scope** source FKs (ADR 0065 App-A dialect-1) · `revoked_at` /
`revoked_by` soft revocation · constrained `reason_code` · surrogate `id` PK + partial unique index on
the active `(case_id, principal_id, source, source_entity_id)` · active partial indexes on
`(case_id, principal_id)` and `(principal_id, expires_at) where revoked_at is null` · RLS from
creation · explicit privileges in the same migration.

CHECKs: `write ⇒ read` · `restricted ⇒ standard` · non-empty · time · revoke-shape ·
`source in ('manual_grant','nsp_investigation','referral','break_glass')` (**only `manual_grant`
reachable**; pgTAP asserts the rest unreachable).

### B2 · Re-cut the doors

`grant_case_access` / `revoke_case_access` / `list_case_access` against the new shape. No direct
authenticated DML. `REVOKE ALL … FROM PUBLIC` then explicit grant. **`list_case_access` must project
the clearance** (today it omits `max_confidentiality`). Coordinator may issue `read_restricted_phi`
**without holding it** (D5·6 — the bootstrap); "can't delegate what you don't hold" applies to Content
and Standard PHI only.

### B3 · ⛔ BLOCKING — repoint `attachment_confidentiality_ok`

It reads `public.case_access` **directly**. Dropping that table silently drops ADR 0072's
confidentiality ceiling. Repoint to `case_access_grants` **in the same migration**. The 7-value
taxonomy and the 0072 O2 ruling (only `legal_privileged` + `credentialing_sensitive` gate above
ordinary case-read) are unchanged.
⚠ `CONFIDENTIALITY_ORDER` (FE) is **display** order, **not** sensitivity order.

### B4 · Retire the `case_access` flag (D9)

Delete the flag row, both OFF branches, and `assert_case_access_enabled()`. Rewrite pgTAP's flag-OFF
cases as `visibility_policy` cases — what they were really testing.

### B5 · Seed rework + type regen

`supabase/seed.sql` grants → `case_access_grants`; **no PHI inferred** from any legacy read/write
grant. Then `supabase gen types typescript --linked > src/lib/types/database.ts` (Rule 8).

### Gate 1 exit

Lint 0/0 · typecheck · Vitest · **`next build`** (a real build — BUG-FBE-005: a client value-import
from `src/lib/queries/*` aborts the build while tsc/lint/vitest all pass) · pgTAP green ·
**full `e2e:prod` once, triaged against the flaky baseline** (~18–27 pre-existing flakes — triage
before calling regression) · `qa` APPROVED · human approval.

---

## Gate 2 — Behaviour changes (C · F-min · NSP)

### C · Meeting confidentiality — see **ADR 0078 Amendment 1**

> ⚠ **Stage C was substantially re-scoped on 2026-07-15** after a PO domain interview. Conjunct A
> (all meeting content → attendees) is **withdrawn**; the ethics `visibility_policy` default was
> **corrected**; two ungated content surfaces were found. Read Amendment 1 before building.
> Sequence as **separate migrations** inside Gate 2 so a red is attributable.

**C0 · Correct the ethics default (A1).** `case_types.default_visibility_policy` for ethics →
**`commission_default`** (plenary is the norm; sub-group is a per-case override). Seed-only; no
schema. Plenary complaints are then member-wide with ADR 0072's respondent/recusal hard-denies doing
all the protective work.

**C1 · Conjunct B — case-specific meeting fields (D6, retained).** `meeting_cases.summary` /
`.decision` require **both** meeting reach and `read_case_content`.

**C2 · 2b — close the agenda-item leak (A3).** `meeting_agenda_items.discussion_notes` / `.resolution`
are member-wide **and PHI-bearing today**; gate them through the item's case link
(`meeting_cases.agenda_item_id`). Conjunct B alone does **not** close this.

**C3 · `meetings.visibility_policy` (A2·1).** New enum `('commission_default','participants_only')`.
`reach(meeting) = is_member_of(commission) AND (visibility_policy='commission_default' OR is attendee)`.
The "Nova reunião" *Participantes* section already builds the roster — it just has no authorization
meaning today. Binding: `is_member_of` stays AND-ed (no cross-committee guests); **no coordinator
OR-arm** (a recused coordinator must not read a sub-group meeting); `participants_only` **requires a
non-empty roster, enforced in the DB**.

**C4 · 2a — `meeting_closed_sessions` (A4).** Case-less pre-formal discussion **only**. Block/subject
split (`meeting_closed_sessions` = time block, no authority; `meeting_closed_session_items` = substance,
reach resolves here; `..._item_readers` consulted only when `case_id IS NULL`). **Case authority is
never out-voted by a reader list.**

**C5 · Four tiers, one row, one RPC door (A7 — supersedes A5).** `meeting_closed_session_items` gets
**no authenticated SELECT**; an audited DEFINER RPC projects the tiers the caller may see (the
`get_case_patient` / `open_attachment` / `list_my_cases` pattern). Tiers: bare stub (`is_member_of`) ·
propriety record — number, withdrawals, times (`is_member_of AND NOT app.is_case_respondent`) ·
substance (`reach(meeting) AND has_case_capability(case_id,'read_case_content')`) · decision
(`is_member_of AND NOT app.is_case_excluded`).

> ⚠ **The asymmetry is load-bearing.** The propriety tier gates on **`is_case_respondent` ALONE**, not
> `is_case_excluded`. The **recused must still see the process number** — her withdrawal *is* the
> propriety record. Reaching for the familiar `is_case_excluded` here silently blinds every recused
> member to the record of their own recusal. Keystone 10 catches it.

**C6 · Reserved-session lifecycle (O7/O8).** Opening a reserved session is **coordinator-only** — it
is an access-granting act (the opener picks the reader list for case-less subjects), so **not** an
`administrativo` capability (contrast `schedule_meetings`; ADR 0061). **No separate signatures
pre-pilot** — the meeting-level signature covers annexes.

**Not built (O9):** no sub-group entity. A sub-group's investigation lives **solely in the Case**
(phases/narratives/interviews) and surfaces to the plenary as the relator's report; their working
meetings are `participants_only`.

**FE (new in Gate 2):** reserved-session authoring + composed ata rendering with a non-identifying
stub. **Plus C7's fallout:** an Organization User navigating into a commission must not be offered a
meetings surface that now returns empty — hide the route/tab rather than render a silent zero-state,
and keep the **configuration** screens (meeting types/settings) reachable, since those they still own
(A10). Needs the `frontend` teammate + the `frontend-design` skill. Serialize file ownership against
`backend`.

> **Regression watch.** D11's member arm keeps CCIH's routine meeting *and* plenary ethics readable.
> Keystones 10–16 test both directions — especially **10** (Ana reads item 5, not item 4's substance
> or decision, but sees item 4's shell incl. her own recorded withdrawal).

**C7 · Organization Users lose the meeting surface (ADR 0078 Amendment 2 — A8/A9/A10/A11).**
Remove the `is_commission_admin_of` arm from the **meeting record**: `meetings` · `meeting_agenda_items`
· `meeting_attendees` · `meeting_cases` · `meeting_signatures` (**`_select` AND the `FOR ALL`
`_staff_admin_write` — C8**), both Storage policies (`meeting_attachments_select_member` /
`_insert_staff_admin`), `app.assert_meeting_staff_admin` (so scheduling/concluding/reopening go too —
PO), and the `'meeting'` arms of `app.can_read_attachment` + `app.can_write_attachment` (**reverses
D4·2**).

**Also the adjacent channel (A11):** `app.can_read_action_item`'s **`committee`** and
**`assignees_only`** scopes lose the arm, plus `action_items_select` / `action_items_staff_admin_write`
(`FOR ALL`) and `can_write_attachment`'s `'action_item'` arm. Otherwise a reserved-session item
(*"Notificar o Dr. X da decisão do processo 047"*) walks out **after every meeting table is closed** —
A3's pattern, one table further out. `case_restricted` → `can_read_case`: **fixed for free**.

> ⛔ **Do NOT sweep `is_commission_admin_of` globally.** 93 policies / 119 functions carry it and
> **most are legitimate Organization-User administration**. **Explicitly KEEP:**
> `commission_meeting_types` · `commission_meeting_settings` (handoff §2.1 grants *configuration*) ·
> `dispose_meeting_minutes` (a retention act — verified `returns void`, no content) ·
> `audit_log_select` (Rule 11 oversight; A12 — **"zero meeting metadata" is not the goal**).
> Keystone 20 fails if the negatives over-reach.

**C8 · ⚠ CONFIRMED — re-cut the four `FOR ALL` write policies (ADR 0078 A13).**
Was an inventory item; **verified against the live catalog 2026-07-15**. `meetings_` ·
`meeting_agenda_items_` · `meeting_attendees_` · `meeting_cases_staff_admin_write` are **all `FOR ALL`
PERMISSIVE**; permissive policies OR and `FOR ALL` `USING` applies to SELECT. **Without C8, C2 and C3
are no-ops that test green against the `*_select` policies while the rows return through the side
door.** Only `meeting_cases_` carries a case predicate.

> **Third arm, named nowhere:** `meetings_staff_admin_write` OR-s
> `app.member_can(commission_id,'schedule_meetings')` → an `administrativo` delegate reads every
> `participants_only` meeting. ADR 0061 scoped that capability to **scheduling**; the `FOR ALL`
> silently promoted it to **reading**. Keystone 18.

**Amendment 1's opens (O6–O9): ALL RESOLVED** (PO, 2026-07-15) — respondent does **not** see the
process number (→ A7's fourth tier); no reserved-session signatures pre-pilot; **coordinator-only**
opening; no sub-group entity. See ADR 0078 Amendment 1 §open.

### F1 · Referral predicate split + write gate (D7)

Split into `can_read_referral_metadata` · `can_read_referral_phi` · `can_write_referral_response` ·
`can_manage_referral_phi_disclosure` · `can_amend_referral_phi_snapshot`. Gate the `referral_patient`
write on `can_manage_referral_phi_disclosure` (**source coordinator only**). Remove
`set_referral_patient` from the public API. Repoint the `referral_attachments_obj_select` Storage
policy off `can_read_referral_phi`.

### N1 · Drop the NSP PHI arm (D8)

Remove the `is_pqs_operator_of_for` arm from **`can_read_case_patient`** only. **Keep** it in
`can_read_case` (content reach) until Stage D, post-pilot.

### G1 · Cleanup

Retire `can_read_case_or_admin` and `can_reach_case_on_member_surface` (both redundant under the new
model). Type regen. `supabase db advisors` / MCP `get_advisors`. Update ARCHITECTURE.md Rule 12 +
`docs/backend-state.md`.

### Gate 2 exit

Same bar as Gate 1.

---

## Risks

| Risk | Mitigation |
|---|---|
| **File text ≠ live catalog** — produced a false P0 during evaluation; burned an external auditor | A0 is catalog-driven and reviewed **before** SQL |
| **A correct predicate ≠ correct policies** (ADR 0072 delta 3) | Extend 0072's catalog-driven leak sweep per-capability; assert **rows read** under `set local role`, not the predicate's return value |
| **Resolver per-row cost** on `answers` / `case_narratives` / interviews | Bitmask core (D2); A5 is a hard exit criterion before repointing |
| **Stage B silently drops the 0072 ceiling** | B3 blocking, same migration |
| **Strict C regresses ordinary committees** | Member arm (A2) + keystone 4 both directions |
| **Shared local stack** — `TaskStop` does not reap the e2e gate's process tree; the branch can swap underneath | One owner for the stack; verify `git branch --show-current` before every commit |
| **Scope creep into D/E/F-full** | Explicitly post-pilot in ADR 0078. Do not build investigations, row-aware attachments, or disclosure governance here |

## Post-pilot backlog (do not build now)

Stage D (NSP Investigations) · Stage E (attachment sensitivity: row-aware `can_read_attachment` +
tier→clearance mapping) · F-full (disclosure governance, `approved_fields`, versioned snapshots,
minimum-necessary field scoping) · break-glass workflow · `pqs_*` → `nsp_*` rename · session
revocation on deactivation.
