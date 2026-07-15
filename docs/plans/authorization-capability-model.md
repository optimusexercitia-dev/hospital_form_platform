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

> ⛔ **READ ADR 0078 AMENDMENT 3 FIRST.** A pre-implementation review (2026-07-15) found the ADR's
> **central decision was wrong** and two of its stage exits unachievable as scoped. The corrections
> that change **Gate 1**:
>
> | # | Correction | Effect on Gate 1 |
> |---|---|---|
> | **A15** | The member arm confers **`read_case_deliberation`** (the minuted discussion), **NOT** `read_case_content`. As specified it was a widening from **1 table to ~12**, two of them PHI-BEARING free text. | New 7th capability. `can_reach_case_on_member_surface` is **UN-RETIRED** — it *is* this bit's projection. |
> | **A16** | `read_case_deliberation ⇏ view_case_overview`. The lattice is a **partial order**. `view_case_overview` is a **RESERVED, unconsumed** bit — do **not** wire it to `cases_select`. | Members get no case board. |
> | **A21** | **D4·1 is a NO-OP as scoped.** The admin arm's real read path is **eight `FOR ALL` case policies**, not `can_read_case`. Removing read *and* write (PO). **A14 resolved.** | **Stage A grows materially.** |
> | **A18** | Grant doors gain `AND NOT is_case_excluded`; the **Organization User keeps its arm there and ONLY there**. `manage_case_access` gains its missing source + consumer. | New Stage-B work. |
> | **A19** | The confidentiality ceiling is **write-unreachable** — a data-destroying trap, not a ceiling. **Fence the two labels; `max_confidentiality` is a RESERVED ranked column; Stage E builds it.** | **B3 downgrades from ⛔ BLOCKING to carry-the-column.** |
> | **A20** | `is_case_respondent` rests on a **nullable** `professional_profiles.user_id` that nothing enforces → **Row zero is decorative**. Explicit resolved state; `unknown` cannot be a respondent. | New Stage-A work. |
> | **A24** | `nsp_referral_touched` **must** be a D11 source (else Stage A silently revokes NSP content); `can_read_case` is a **projection**, not a survivor; **step 6 "lifecycle" is DELETED**; `can_read_action_item` needs its own `is_active`. | Resolver spec changes. |

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

   > ⛔ **BLIND SPOT — ADR 0078 A23. This list is not sufficient.** It enumerates
   > `is_commission_admin_of*`, but **A13 proved `is_commission_admin_of` ≠ `staff_admin`** (it is
   > `org_admin OR hospital_admin` **only**). So as written the inventory **never looks at
   > `is_staff_admin_of*`** — the one arm that can out-vote the deny for a **recused coordinator**, and
   > exactly the arm A22 found unguarded on `action_items`. **Add, binding:**
   > 1. **`is_staff_admin_of*`** and **`app.member_can(...)`**, alongside `is_commission_admin_of*`.
   > 2. **Every `FOR ALL` PERMISSIVE policy** on any case-, meeting-, or action-item-bearing table —
   >    **whether or not it names an admin arm. A `FOR ALL` policy is a READ policy.**
   > 3. Per policy, record: **case predicate? exclusion term?** Missing either is a finding.
   > 4. The **case RPCs** carrying the admin arm (`create_case`, `update_case_meta`, `close_case`,
   >    `cancel_case`, `set_case_confidentiality`, `add_case_participant`, …) — A21 removes it;
   >    enumerate exhaustively, and **do not sweep**: 119 functions carry the arm and most are
   >    legitimate.
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

**Capabilities — SEVEN, not six** (ADR 0078 D1 + **A15**). The new one is `read_case_deliberation`.
Lattice is a **partial order** (**A16**):
```
write_case_content ⇒ read_case_content ⇒ { view_case_overview , read_case_deliberation }
read_case_deliberation ⇏ view_case_overview        ← deliberate; matches today exactly
read_restricted_phi ⇒ read_standard_phi
```
`view_case_overview` is **RESERVED and unconsumed** pre-pilot — do **not** wire it to `cases_select`.

**Sources and what each CONFERS** (D11 + **A24·6/7** — the ADR's table never said what they grant, and
mixed resolver arms with `case_access_grants.source` values):

| Source | Kind | Confers |
|---|---|---|
| `committee_coordinator` | computed | all **except `read_restricted_phi`** — they **issue** it without holding it (D5·6) → keystone 31 |
| **`committee_member_default`** | computed | **`read_case_deliberation` ONLY** (A15) |
| `case_assignment` | computed | `read_case_content` + `read_case_deliberation` — **never PHI** (Context·1), **never write** (D10) |
| **`nsp_referral_touched`** | computed | **`read_case_content` ONLY** (D8). **Required** — without it Stage A silently revokes all NSP content reach (A24·1). Retires at Stage D. |
| `manual_grant` | **`source` column value** | per-column, as granted |
| `nsp_investigation` · `referral` · `break_glass` | **`source` column values — RESERVED, unreachable** (D5·5) | — |

**The member arm (A15 — corrected):** `active member AND cases.visibility_policy =
'commission_default' AND NOT excluded ⇒ read_case_deliberation` — **never `read_case_content`**, never
`read_standard_phi`, never `write_case_content`. It gates exactly three surfaces: `meeting_cases`,
case-linked `meeting_agenda_items`, and the reserved-item substance tier.

**Write arms (D10):** `write_case_content` = Coordinator OR active explicit write grant. **No
assignment arm** — a deliberate divergence from the handoff; do not "fix" it.

**`can_read_case` is a thin PROJECTION** of `_case_caps`'s `read_case_content` bit (**A24·2**) — not a
surviving second body. "Remove from / keep in `can_read_case`" throughout this plan describes the
**effect**, never an in-place edit.

**Order is SIX steps** — the ADR's step 6 ("lifecycle") is **DELETED** (A24·3). The
`app.guard_case_status` trigger keeps terminal-freeze; do **not** add a status term to the resolver.

### A3 · `case_types.default_visibility_policy`

Creation-time default only. `cases.visibility_policy` stays the **sole runtime authority**. Not a
second switch.

### A4 · Repoint policies — **⛔ D4·1 IS A NO-OP AS THE ADR SCOPES IT** (ADR 0078 **A21**)

> **Catalog-verified.** `cases_select` rides `can_read_case_or_admin`, but `cases_staff_admin_write` is
> **`FOR ALL` PERMISSIVE**. Permissive policies **OR**, and a `FOR ALL` policy's `USING` **applies to
> SELECT** — so removing the admin arm from `can_read_case` **changes nothing**. **Eight case tables**
> carry this shape: `cases` · `case_narratives` · `case_phases` · `case_events` ·
> `case_offered_outcomes` · `case_tag_assignments` · `case_phase_allowed_results` ·
> `case_phase_offered_results`. Stage A's exit — *"Organization Users cannot read Case Content"* —
> would be **false** and would **test green** against `can_read_case`.
>
> **Good news:** ETH·E1 put `AND NOT is_case_excluded` on all eight — the recusal invariant **holds**
> there. `action_items_staff_admin_write` is the **only** place it was missed (→ C7/A22).

**PO decision (A21·1): remove read AND write.** They cannot be separated without splitting eight
`FOR ALL` policies per-command, which yields "write what you cannot read" **eight times over**.

The `is_commission_admin_of` arm leaves:
- `can_read_case` (as originally scoped)
- **the eight case-family `FOR ALL` policies**
- `can_read_attachment`'s **`'interview'`** arm
- **`can_write_attachment`'s `'case'` arm → A14 RESOLVED**
- **the case RPCs** — enumerate exhaustively at A0

Case attachments are fixed for free via `can_read_case`.

**KEEP** (the A10/A21 line): `case_tags` · `case_outcomes` · `case_narrative_types` ·
`process_template*` (commission-level **configuration**, correctly no exclusion term) · membership and
role management · **the grant door (B6)** · `audit_log` · forms · indicators · controlled documents.
**Keystone 23 fails if the negatives over-reach.**

> **The line, in one sentence:** *an Organization User **configures** a commission and **staffs** it;
> they never touch its cases.*

**The `'meeting'` arm also goes — but in Stage C (C7)**, not here, so the whole "Organization User
loses meetings" change is one reviewable unit. `can_read_attachment` is rewritten twice across the
program (A4, then C7). That is intended, not drift.

**Sequencing:** A4 lands **only after A0 is reviewed and A1 is red-then-green**, and **after** the
resolver (A2) — never as a standalone policy edit (D4·3).

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

### B3 · Repoint `attachment_confidentiality_ok` + **fence the trap** (ADR 0078 **A19**)

> ⛔ **This step was mis-framed and is DOWNGRADED from BLOCKING.** Catalog-verified 2026-07-15: **no
> function writes `max_confidentiality`** — the only two referencing it are readers; `grant_case_access`
> has no clearance parameter; there is no admin bypass (QA removed it) and no coordinator bypass; the
> one live value came from `seed.sql`. **There is no working ceiling to "silently drop."** What exists
> is a **data-destroying trap**: label an attachment `legal_privileged` or `credentialing_sensitive`
> via `reclassify_attachment` and it becomes **permanently unreadable by everyone, including its
> uploader**.

1. **Fence it now:** `reclassify_attachment` **rejects** `legal_privileged` / `credentialing_sensitive`
   pre-pilot. One CHECK. → keystone 26.
2. Repoint `attachment_confidentiality_ok` to `case_access_grants` (still same-migration — the table is
   dropped).
3. `case_access_grants` carries **`max_confidentiality` as a ranked, RESERVED column** — D5·5's
   "reserve the shape" precedent. **Do NOT collapse it into `read_restricted_phi`:** they are
   orthogonal planes (`phi_restricted` = rank **2**, which the ceiling passes untouched; the ceiling
   gates ranks **5/6** only), and a boolean cannot carry `rank >= label`.
4. **Stage E** (post-pilot) builds the write path + the grant-dialog selector + the **unfencing**,
   together. The DB half alone ships a parameter nobody can call.

The 7-value taxonomy and the 0072 O2 ruling are unchanged.
⚠ `CONFIDENTIALITY_ORDER` (FE) is **display** order, **not** sensitivity order.

### B6 · Grant doors: exclusion gate + the Organization User's one arm (**A18**)

`grant_case_access` / `revoke_case_access` gate on a **bare role check** today — no exclusion. Add
**`AND NOT app.is_case_excluded(p_case, auth.uid())`**: a recused coordinator must not choose who
investigates the case she is recused from.

**Keep the `is_commission_admin_of` arm on these doors — and ONLY these** (PO). It is the deadlock exit
for a single-coordinator commission. **Safe by construction:** the door already requires
`app.is_member_of_for(v_commission, p_user)`, so the grantee must be a commission member and an
Organization User is not one — **no self-escalation**. → keystone 24.

`manage_case_access` source = `committee_coordinator` OR `organization_user`, **both minus exclusion**;
consumer = these three doors.

### B7 · Respondent linkage — make Row zero real (**A20**)

`app.is_case_respondent` rests on `professional_profiles.user_id`, which is **NULLABLE** and which
**nothing enforces** (only two functions in the DB touch it). Unlinked ⇒ **every exclusion gate
silently passes the respondent** — live today.

Add an explicit **resolved state** to `professional_profiles`: `linked` · `no_account` · **`unknown`**
(default). **`add_case_participant` rejects an `unknown`-state profile as `respondent_doctor`.**
→ keystone 25.

> This is the whole model's foundation: C2's agenda gate, A7's tiers, B6's grant door, and Appendix B's
> Row zero **all** resolve through this one predicate. **Sequence it early in Gate 1** — every
> exclusion keystone is meaningless until it lands.

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
`.decision` require **both** meeting reach and **`read_case_deliberation`** (**A15** — *not*
`read_case_content`; that was the widening). Re-cut `meeting_cases_staff_admin_write` too (**C8**) —
it is `FOR ALL`.

> ⚠ **`meeting_cases.decision` carries TWO gates in the ADR and they are not reconciled.** A2 says
> conjunct B *"stands, unchanged"* ⇒ `.decision` needs case authority; A5/A7 and **keystone 16** say
> the **decision tier is BROADER** — `is_member_of AND NOT is_case_excluded`, *"uniform, regardless of
> `visibility_policy`"*, so a member with no substance reach on a sub-group case still reads
> *"Processo 052 — arquivado"*. **Gate `.summary` on `read_case_deliberation`; gate `.decision` on
> `reach(meeting) AND NOT is_case_excluded`.** Keystones 5 and 16 both pass only under that split.
> Flagged for `qa` at Gate 2.

**C2 · 2b — close the agenda-item leak (A3).** `meeting_agenda_items.discussion_notes` / `.resolution`
are member-wide **and PHI-bearing today**; gate them through the item's case link
(`meeting_cases.agenda_item_id`) on the same rule as `meeting_cases.summary`. Conjunct B alone does
**not** close this — and **neither does C2 alone: `meeting_agenda_items_staff_admin_write` is `FOR ALL`
(C8).**

> ⚠ **A4·1 says `meeting_agenda_items.title` = the process number, "Member-wide. ALWAYS."** That
> **contradicts A7/O6** — the respondent must not see his own process number. Gate `title` on the
> **propriety tier** (`NOT app.is_case_respondent`) when the item is case-linked, or the respondent
> reads it off the skeleton table. **No existing keystone catches this** (keystone 10 tests the
> *recused*, not the respondent).

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
`get_case_patient` / `open_attachment` / `list_my_cases` pattern).

> ⛔ **A7's tier table is NOT implementable as written — three corrections (ADR 0078 A15, A24·4):**
> 1. substance gates on **`read_case_deliberation`**, not `read_case_content`;
> 2. the stub/propriety/decision tiers gate on **`reach(meeting)`**, not bare `is_member_of` — as
>    written they project a **`participants_only` meeting to every non-participant**, including the
>    recused coordinator keystone 12 names;
> 3. **every tier needs A4·1's `case_id IS NULL` branch.** At `case_id IS NULL` — *the only scenario
>    A4 exists for* — `is_case_respondent(NULL,·)`/`is_case_excluded(NULL,·)` are **false** (propriety
>    + decision **allow everyone**) and `_case_caps(NULL,·)` fails closed (substance **denies everyone,
>    reader list included**). Case-less: substance + decision follow the **reader list**; the propriety
>    tier is **EMPTY**, not "allow".
>
> Also: **A4·1's column list has no decision field** and nowhere for *"who withdrew and why"* — A7 says
> one row carries all four tiers but never amended it. Add both.

Tiers, corrected: bare stub (`reach(meeting)`) · propriety record — number, withdrawals, times
(`reach(meeting) AND NOT app.is_case_respondent`) · substance (`reach(meeting) AND
has_case_capability(case_id,'read_case_deliberation')`) · decision (`reach(meeting) AND NOT
app.is_case_excluded`).

> ⏸ **BLOCKED ON A PARKED PO DECISION — ADR 0078 A26. Do not author this RPC until it is answered.**
> The propriety tier as written projects **who withdrew and why** to every member. Combined with the
> pauta's process number and the meeting date, that is **verbatim the inference D11 declares must not be
> available** (*"a case number plus a date plus a sudden recusal identifies the respondent"*). Benign for
> a **plenary** case (the members watched him leave); **sharp** for a **sub-group** case (the plenary was
> not in the room, yet the tier is member-wide).
>
> **The obvious default answers it permissively and silently.** Raise A26 with the PO **before** C5, not
> after. The answer may make the propriety tier `visibility_policy`-dependent, which changes this
> predicate.

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
A3's pattern, one table further out.

> ⛔ **A11's "`case_restricted` → fixed for free" is WRONG (ADR 0078 A22).** Catalog-verified:
> `action_items_staff_admin_write :: ALL :: (is_staff_admin_of(commission_id) OR
> is_commission_admin_of(commission_id))` — **no case term, no exclusion term**. D4·1 removes
> `is_commission_admin_of`; **`is_staff_admin_of` survives unqualified**, so a **recused coordinator**
> still reads `case_restricted` action items — A11's own example string. This is **the single place
> ETH·E1's exclusion was missed** (it guarded six sibling `*_staff_admin_write` policies).
> **Add `AND NOT app.is_case_excluded(coalesce(source_case_id, case_id), auth.uid())`.** → keystone 27.
>
> ⚠ Also: `can_read_action_item`'s `assignees_only` arms (`assigned_to = p_uid`,
> `action_item_assignments`) are **raw checks with no `is_active`** and no case to resolve, so
> `_case_caps` step 2 **cannot** reach them — **Context·3's defect, unaddressed** (A24·5). Give
> `can_read_action_item` its own `is_active` gate. → keystone 28.
>
> ⚠ Same shape, for A0: `case_recusals_select` OR-s a bare
> `app.is_staff_admin_of_for(app.commission_of_case(case_id), auth.uid())` **after** a correct deny.

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

Remove the `is_pqs_operator_of_for` arm from **`can_read_case_patient`** only. **Keep** the content
reach until Stage D, post-pilot.

> ⛔ **"Keep it in `can_read_case`" is not implementable — `can_read_case` becomes a projection
> (A24·2).** The content reach must be a **`_case_caps` source**, and D11 has **no row for it** (its
> only NSP row is `nsp_investigation`, marked post-pilot). Built literally, **Stage A silently revokes
> all NSP content reach** — a Gate-2 change executed inside Gate 1, which D8 and Appendix B both
> forbid, and which only *this* Gate-2 keystone would catch.
>
> **Fix (lands in Stage A, not here): D11 gains `nsp_referral_touched`** — live pre-pilot;
> `feature_enabled('case_referrals')` + `is_pqs_operator_of_for(hospital_of_commission(...))` + a
> `case_referral` touching the case; confers **`read_case_content` ONLY**, never `read_standard_phi`.
> Retires at Stage D. **Keystone 29 asserts it holds after Gate 1**, not only after Gate 2.

### G1 · Cleanup

Retire `can_read_case_or_admin` (A21 removes its admin arm, collapsing it into `can_read_case`).

> ⛔ **`can_reach_case_on_member_surface` is UN-RETIRED (A15·2).** D11 called it redundant on the
> strength of the claim that its semantics *are* `read_case_content`. Verified false: it is consumed by
> **exactly one** policy, while `read_case_content` gates **twelve tables**. Its semantics **are**
> `read_case_deliberation`, exactly — ETH·E1 built the right predicate. **It survives as that bit's
> projection.** Stage G shrinks accordingly.

Type regen. `supabase db advisors` / MCP `get_advisors`. Update ARCHITECTURE.md Rule 12 +
`docs/backend-state.md`.

### Gate 2 exit

Same bar as Gate 1.

---

## Risks

| Risk | Mitigation |
|---|---|
| ⛔ **A no-regression claim no test can falsify** — how D11's member-arm widening got in: keystones 4 and 11 assert *no regression*, and a widening passes those **by construction**. Two of three reviewers found it; **neither the author nor the test plan could**. | For **every** arm, pair the no-regression keystone with an **over-grant** keystone asserting what it must **NOT** reach (keystone 22 is the template). If a claim cannot be falsified by a test, it is **not a claim** — it is a hope. |
| **File text ≠ live catalog** — produced a false P0 during evaluation; burned an external auditor | A0 is catalog-driven and reviewed **before** SQL |
| ⛔ **`FOR ALL` PERMISSIVE policies are READ policies** — defeated **C2, C3 AND D4·1** (A13, A21). 12+ such policies across case/meeting/action-item tables; only 2 carry a case predicate. | A0 enumerates **every** `FOR ALL` policy on a case/meeting/action-item-bearing table, admin arm or not, and records whether it has a case predicate and an exclusion term |
| ⛔ **The inventory's blind spot** — D13·1 lists `is_commission_admin_of*`, which is **`org_admin OR hospital_admin` only**; the arm that out-votes the deny for a **recused coordinator** is `is_staff_admin_of*`, which it never looks at (A23) | A0 inventories `is_staff_admin_of*` and `member_can(...)` too |
| ⛔ **Row zero rests on a nullable column** (A20) — `is_case_respondent` needs `professional_profiles.user_id`, which nothing enforces. Every exclusion keystone is **vacuous** until B7 lands. | **Sequence B7 early in Gate 1** |
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
