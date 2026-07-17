# Gate 2 · Stage C — Migration-Sequencing Contract (meeting confidentiality)

**Author:** `backend` · **Date:** 2026-07-16 · **Branch:** `feat/authorization-capability-model`
**Status:** 🟠 CONTRACT-FIRST PLAN — awaiting lead review. **NO SQL WRITTEN. NO DDL RUN.**
**Catalog verified at:** fresh `supabase db reset --local`, **123 migrations = 123 registered** (HEAD).
**Scope:** Stage C (C0–C8) only. F1 / N1 / G1 are later. Sources: plan lines 327–489, ADR 0078
Amendments 1–3 + A26 (RESOLVED), keystones 10–31, handoff §7.

> **Methodology note (binding, ADR 0078 A28):** every fact below is from the **live catalog**
> (`pg_policies`, `pg_proc.prosecdef`, `information_schema`, `proacl`), never from migration text.
> `prosrc` regexes are comment-stripped (`regexp_replace(prosrc,'--[^\n]*','','g')`) and use `\y`,
> with the §7.2·2 caveat that `\y` false-negatives on prefixes — cross-checked unanchored where it
> mattered.

---

## 1. Verified catalog snapshot of the current Stage-C surface

### 1.1 Table existence
`meetings`, `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, `meeting_signatures` **exist**.
**`meeting_closed_sessions` / `meeting_closed_session_items` / `meeting_closed_session_item_readers` do
NOT exist** → C4/C5 create them (greenfield, no migration-vs-legacy risk).

`meetings` has **no `visibility_policy` column** and **no `visibility` enum type** exists → C3 is additive.
`meeting_cases` carries `summary`, `decision`, `agenda_item_id`, `case_id`. `meeting_agenda_items`
carries `title`, `discussion_notes`, `resolution`. `cases.visibility_policy` is **`text`** (not an enum),
live values `commission_default` / `explicit_grants_only` — the column C5/A26 keys on.

### 1.2 RLS policies on the five meeting tables (SELECT + the FOR ALL write policies)

| Table | Policy | cmd | Predicate (USING) | Notes |
|---|---|---|---|---|
| `meetings` | `meetings_select` | SELECT | `is_member_of(commission_id) OR is_commission_admin_of(commission_id)` | no visibility gate; C3 + C7 |
| `meetings` | `meetings_staff_admin_write` | **ALL** | `is_staff_admin_of OR is_commission_admin_of OR member_can(commission_id,'schedule_meetings')` | **FOR ALL**; org arm + **schedule_meetings arm** (K18); no case pred |
| `meeting_agenda_items` | `..._select` | SELECT | `is_member_of OR is_commission_admin_of` | member-wide, **no case gate**; C2 + C7 |
| `meeting_agenda_items` | `..._staff_admin_write` | **ALL** | `is_staff_admin_of OR is_commission_admin_of` | **FOR ALL**; **no case pred, no excl**; C8 + C7 |
| `meeting_attendees` | `..._select` | SELECT | `is_member_of OR is_commission_admin_of` | C7 |
| `meeting_attendees` | `..._staff_admin_write` | **ALL** | `is_staff_admin_of OR is_commission_admin_of` | **FOR ALL**; C8 + C7 |
| `meeting_cases` | `..._select` | SELECT | `(is_member_of OR is_commission_admin_of) AND can_reach_case_on_member_surface(case_id, uid)` | row-gate carries case reach (DEFINER, routes the deny); C1 masks cols; C7 |
| `meeting_cases` | `..._staff_admin_write` | **ALL** | `(is_staff_admin_of OR is_commission_admin_of) AND can_read_case_or_admin(case_id, uid)` | **FOR ALL**; org arm; case-half `can_read_case_or_admin` now = `can_read_case` (A4 dissolved its org arm — verified `has_orgadmin=f`); C8 + C7 |
| `meeting_signatures` | `..._insert` | INSERT | check `signer_id=uid AND can_sign_meeting(...)` | not FOR ALL |
| `meeting_signatures` | `..._select` | SELECT | `is_member_of OR is_commission_admin_of` | C7 |

### 1.3 The `FOR ALL` PERMISSIVE inventory (case / meeting / action-item surface — the §7.6 blind spot)

The four the plan names, **plus a fifth the plan does not sequence under C8** (see §4·L2):

| Policy | case pred? | excl term? | org arm? | member_can? |
|---|---|---|---|---|
| `meetings_staff_admin_write` | ✗ | ✗ | ✓ | ✓ (`schedule_meetings`) |
| `meeting_agenda_items_staff_admin_write` | ✗ | ✗ | ✓ | ✗ |
| `meeting_attendees_staff_admin_write` | ✗ | ✗ | ✓ | ✗ |
| `meeting_cases_staff_admin_write` | ✓ (`can_read_case_or_admin`) | via case-half | ✓ | ✗ |
| **`action_items_staff_admin_write`** | ✓ (`coalesce(source_case_id,case_id)`) | **✓ already** | ✓ (scoped off `case_restricted`) | ✗ |

For reference, the sibling case-content `FOR ALL` write policies **already carry the exclusion term**
(`case_events_staff_admin_write`, `case_narratives_…`, `case_phases_…`, `case_tag_assignments_…`,
`case_offered_outcomes_…`, `case_phase_allowed_results_…`, `case_phase_offered_results_…`,
interview family) — these are OUT of Stage C. The org-admin-armed **config** siblings
(`case_tags`, `case_outcomes`, `case_narrative_types`, `commission_meeting_types`,
`commission_meeting_settings`, `phase_results`, `process_template_*`) are the ones C7's negatives
**must NOT touch** (keystone 20 / 23).

### 1.4 Functions — `prosecdef` (a DEFINER's gate REPLACES RLS — §7.2·6)

| Function | DEFINER | org arm | excl | is_active | Relevance |
|---|---|---|---|---|---|
| `commission_of_meeting` | t | — | — | — | routed everywhere |
| `is_member_of` / `is_commission_admin_of` / `is_staff_admin_of` / `member_can` | t | — | — | — | authority arms |
| `can_reach_case_on_member_surface` | t | **f** | routes deny | — | `meeting_cases_select` case-gate |
| `can_read_case_or_admin` | t | **f** (A4 dissolved) | ✓ | — | `meeting_cases` write case-half |
| `can_read_case` / `_patient` | t | — | ✓ | (in `_case_caps`) | — |
| `_case_caps` / `has_case_capability` | t | — | ✓ | ✓ | C1/C2/C5 substance gate |
| `is_case_excluded` / `is_case_respondent` / `is_recused_from_case` | t | — | — | — | C1/C2/C5 tier terms |
| `can_read_action_item` | t | **✓** | **✓ already** | **✓ already** | C7 removes org arm (K19); excl+is_active DONE (K27/K28) |
| `can_read_attachment` | t | **✓** | ✗ | ✗ | C7 removes `'meeting'`+`'action_item'` org arms |
| `can_write_attachment` | t | **✓** | ✓ | ✓ | C7 removes `'meeting'`+`'action_item'` org arms |
| `assert_meeting_staff_admin` | **f (INVOKER)** | **✓** | ✗ | ✗ | C7 removes org arm → gates conclude/reopen/schedule |
| `conclude_meeting` / `reopen_meeting` / `sign_meeting` / `dispose_meeting_minutes` | t | — | — | — | DEFINER RPCs calling `assert_meeting_staff_admin` |

### 1.5 Storage policies (meeting bucket) & RPC ACLs
- `meeting_attachments_select_member`: `bucket='meeting-attachments' AND (is_commission_admin_of(fname[1]) OR is_member_of(fname[1]))` — path `[1]` = **commission_id**. C7 removes the org arm.
- `meeting_attachments_insert_staff_admin`: `is_commission_admin_of(fname[1]) OR is_staff_admin_of(fname[1])`. C7 removes the org arm.
- The four meeting RPCs: ACL = `postgres|service_role|authenticated =X` — **no `PUBLIC` grant** (clean). Any **new** C5 RPC still needs `REVOKE ALL … FROM PUBLIC` before `GRANT` (t19 guard).

---

## 2. Ordered migration-sequencing plan (one attributable migration per unit)

**Global ordering law:** **C8 before C2 and C3** (a `FOR ALL` `USING` grants SELECT — without C8 those
units test green against `*_select` while rows return through the write side-door, §7·`FOR ALL`).
**C4 → C5 → C6** (table before projection before lifecycle). C0 and C7 are order-independent of the
rest but C7 is grouped last so its broad negatives are reviewed as one narrowing (keystone 20/23 guard).

Recommended file order:
**C0 · C8 · C1 · C2 · C3 · C4 · C5 · C6 · C7.**

Right-sizing (per role rules): **C0** seed-only, one-line ack. **C8, C7** follow the already-approved
A4 arm-removal / re-cut pattern → one-line plan + ack **each**. **C1, C2** introduce a **new
column-masking mechanism** (§4·Q1) → **FULL plan** (novel shape). **C3** additive column+reach →
short plan. **C4** new tables+RLS → short plan. **C5** new **DEFINER, audited** RPC + no-authenticated-
SELECT table → **FULL plan** (SECURITY DEFINER read path). **C6** lifecycle RPC → short plan.

---

### C0 · Correct the ethics `default_visibility_policy` → `commission_default` (A1)
- **Intent:** `seed.sql` — flip `case_types.default_visibility_policy` for ethics to `commission_default`.
  **Seed-only, no schema.** (Divergence check: live seeded ethics **case** takes its policy from a direct
  insert, not the type default — see §4·D1; this seed flip is cosmetic-for-existing-data but correct for
  new template-created cases.)
- **Keystones:** 11 (no-regression: plenary ethics case member-wide). Over-grant twin: none needed — C0
  widens nothing; it is the precondition that lets K10/K11 use a plenary fixture.
- **Order:** independent; land first so downstream fixtures read the corrected default.

### C8 · Re-cut the four (→ **five**, §4·L2) `FOR ALL` write policies (A13) — HARD PREREQUISITE
- **Intent:** replace each `FOR ALL` PERMISSIVE policy with **write-only** split policies —
  `FOR INSERT WITH CHECK (…)`, `FOR UPDATE USING (…) WITH CHECK (…)`, `FOR DELETE USING (…)` — so the
  `USING` no longer applies to SELECT. SELECT then flows **only** through each `*_select` policy.
  Targets: `meetings_`, `meeting_agenda_items_`, `meeting_attendees_`, `meeting_cases_staff_admin_write`
  — **plus `action_items_staff_admin_write`** (§4·L2 recommends folding it here). Predicates otherwise
  **unchanged in this unit** (arm removals are C7; keep C8 a pure structural re-cut so a red is
  attributable to shape, not predicate).
- **Keystones:** **18** (over-grant, the whole point): a principal denied by `*_select` — the recused
  coordinator on a `participants_only` meeting AND the **`schedule_meetings` delegate** — reads **zero
  rows** with the write policy in place. No-regression twin: **21** (staff_admin + ordinary staff read
  their `commission_default` meeting exactly as today — writes still succeed).
- **Order:** **BEFORE C2 and C3.** Without it, C2's agenda-item gate and C3's `participants_only` gate
  are no-ops (rows return through the FOR ALL `USING`).

### C1 · Conjunct B — gate `meeting_cases.summary` / `.decision` (D6, A2/A15)
- **Intent (SPLIT — plan lines 346–352):** `.summary` requires `reach(meeting) AND
  has_case_capability(case_id,'read_case_deliberation')`; `.decision` requires
  `reach(meeting) AND NOT is_case_excluded(case_id, uid)` (broader, uniform per K16). The row skeleton
  (times, position) stays at `reach(meeting)` = today's `meeting_cases_select`.
- **⚠ Mechanism (novel — §4·Q1):** RLS is **whole-row**; keystone 10 requires a **partially-visible
  row** (shell yes, summary/decision no). This is **column masking**, not a policy re-cut. Recommended:
  a `security_invoker` / owner-rights **masking view** `meeting_cases_readable` projecting
  `CASE WHEN has_case_capability(...,'read_case_deliberation') THEN summary ELSE NULL END` etc., **plus
  REVOKE of the sensitive column SELECT on the base table from `authenticated`** so a raw PostgREST
  select cannot bypass the view; repoint `listMeetingCases` (`src/lib/queries/meetings.ts`) onto the
  view. Base-table row visibility stays with `meeting_cases_select`. **Confirm mechanism before SQL.**
- **Keystones:** **10** (over-grant + no-regression in one: Ana reads item 5 summary/decision in full,
  sees item 4 shell, reads **neither** item 4 substance **nor** decision), **16** (decision tier: a
  member without substance reach on a sub-group case still reads `.decision`; a **recused** member reads
  neither). Over-grant explicitly: a `reach(meeting)`-only member on an `explicit_grants_only` case reads
  the row but `.summary` is NULL.
- **Order:** after C8 (its write policy is re-cut in C8; C1 also re-touches nothing structural).

### C2 · Close the agenda-item leak — `meeting_agenda_items.discussion_notes` / `.resolution` / `.title` (A3, A4·1)
- **Intent:** these are member-wide **and PHI-bearing today**. For a **case-linked** agenda item (join
  `meeting_cases.agenda_item_id`), gate `discussion_notes`/`resolution` on the **same rule as C1
  `.summary`** (`read_case_deliberation`). Gate **`title`** on the **propriety tier**
  (`reach AND NOT is_case_respondent`) when case-linked — **A4·1's "title = process number, ALWAYS
  member-wide" is overruled by A7/O6**: the respondent must not read his own process number (plan lines
  360–364). A **non-case-linked** agenda item stays member-wide.
- **⚠ Mechanism:** same column-masking fork as C1 (§4·Q1) over `meeting_agenda_items`.
- **Keystones:** **14** (over-grant: deliberation in `discussion_notes` on a case-linked item is gated
  identically to `meeting_cases.summary`). **NEW keystone needed** — plan lines 362–364 state **no
  existing keystone catches the `title`/respondent leak** (K10 tests the *recused*, not the
  *respondent*). → propose **keystone 14a**: the **respondent** reads neither the process number in
  `title` nor `discussion_notes` on his case's agenda item; a non-respondent member still reads `title`.
  No-regression twin: a member reads `title` + `discussion_notes` on a `commission_default` case-linked
  item.
- **Order:** **after C8** (`meeting_agenda_items_staff_admin_write` is FOR ALL — its USING side-doors
  SELECT until re-cut).

### C3 · `meetings.visibility_policy` (A2·1)
- **Intent:** add column `visibility_policy` with values `('commission_default','participants_only')`
  (⚠ §4·D3: `cases.visibility_policy` is `text`+values, not an enum — recommend **text + CHECK** for
  convention parity unless the lead wants a hard enum). Reach redefinition:
  `reach(meeting) = is_member_of(commission) AND (visibility_policy='commission_default' OR
  EXISTS attendee row for uid)`. Binding: `is_member_of` **stays AND-ed** (no cross-committee guests);
  **no coordinator OR-arm**; `participants_only` **requires a non-empty roster, enforced in the DB**
  (trigger/constraint at write time).
- **Keystones:** **12** (over-grant: on a `participants_only` meeting a non-participant member reads
  nothing, an invited non-member reads nothing, a **recused coordinator** who is not a participant reads
  nothing incl. via any FOR ALL write policy — depends on C8), **13** (empty roster rejected at write
  time, not silently unreadable). No-regression twin: **21** (`commission_default` meeting unchanged).
- **Order:** **after C8.** C3's reach term is consumed by C1/C2/C5's `reach(meeting)`; land C3 before or
  with C1/C2 so `reach` is defined once. Recommended: C3 immediately after C8, before C1 — but C1/C2 can
  reference a `reach(meeting)` helper stubbed to today's rule and hardened by C3. **Simplest: C3 before
  C1/C2** so `reach` is final. (I've ordered C8·C1·C2·C3 above for FOR-ALL-first; if `reach` is factored
  into a helper, reorder to **C8·C3·C1·C2** — flagging for lead which the build adopts.)

### C4 · `meeting_closed_sessions` + `_items` + `_item_readers` (A4, 2a)
- **Intent:** three new tables, greenfield (none exist). `meeting_closed_sessions` = time block, **no
  authority**. `meeting_closed_session_items` = substance, **reach resolves here**, carries `case_id`
  (nullable — case-less pre-formal discussion is *the* scenario A4 exists for) + a **decision field** +
  a **"who withdrew and why" field** (A7's table omits both — plan lines 392–394 says add them).
  `_item_readers` = reader list, **consulted only when `case_id IS NULL`**. RLS: closed-session items
  get **NO authenticated SELECT** (C5 projects them). Base RLS on the block/readers tables per the
  A4 "case authority is never out-voted by a reader list" rule.
- **Keystones:** **30** (case-less reserved item: reader reads substance; non-reader member reads bare
  stub only; nobody gets a propriety/decision that doesn't exist) — the over-grant half is "non-reader
  reads only the stub." **15** (reader list never out-votes case authority: adding a recused principal
  to a **case-linked** subject's reader list grants nothing).
- **Order:** **before C5** (C5 reads these tables). After C3 (uses `reach(meeting)`).

### C5 · Four tiers, one row, one audited DEFINER RPC (A7, supersedes A5; A15/A24·4/A26)
- **Intent:** `meeting_closed_session_items` has **no authenticated SELECT**; an **audited SECURITY
  DEFINER RPC** (`public.*`, `REVOKE ALL FROM PUBLIC` before `GRANT authenticated`, explicit
  `app.audit_write`) projects the tiers the caller may see (the `get_case_patient`/`open_attachment`
  pattern). **Four tiers, corrected (plan lines 396–400 + A26):**
  1. **bare stub** — `reach(meeting)` (item reserved, quorum, times).
  2. **propriety record** (number, withdrawals, times) — `reach(meeting) AND NOT is_case_respondent`,
     **with the A26 split on the withdrawal *names*** (see §3).
  3. **substance** — `reach(meeting) AND has_case_capability(case_id,'read_case_deliberation')`.
  4. **decision** — `reach(meeting) AND NOT is_case_excluded(case_id, uid)`.
  All tiers gate on **`reach(meeting)`**, NOT bare `is_member_of` (correction #2: bare `is_member_of`
  projects a `participants_only` meeting to every non-participant incl. the K12 recused coordinator).
- **Keystones:** **10** (recused member: item shell incl. her own withdrawal, no substance/decision),
  **12** (recused coordinator non-participant on `participants_only`: nothing), **30** (case-less
  tiers), **31** (coordinator issues but does not hold `read_restricted_phi` — the tier projection must
  not leak restricted PHI to a coordinator lacking the cap), **NEW A26 keystone** (§3). Over-grant per
  tier: a `reach`-only member gets stub but not substance; a respondent gets stub but not propriety; an
  excluded member gets stub+propriety-name-if-plenary but not decision.
- **Order:** **after C4** (reads its tables), **before C6** (C6's lifecycle opens sessions C5 reads).

### C6 · Reserved-session lifecycle (O7/O8)
- **Intent:** opening a reserved session is **coordinator-only** (an access-granting act — the opener
  picks the reader list for case-less subjects), so **NOT** an `administrativo`/`member_can` capability
  (contrast `schedule_meetings`). A `public.*` RPC (audited) to open/close a reserved session. **No
  separate reserved-session signatures pre-pilot** — the meeting-level signature covers annexes.
- **Keystones:** **12** / **30** (only a coordinator opens; a `schedule_meetings` delegate cannot —
  over-grant: the delegate call raises). No-regression: a coordinator opens and picks a reader list.
- **Order:** **after C5** (operates on the tables C5 projects).

### C7 · Organization Users lose the meeting surface (A8/A9/A10/A11) — arm removals
- **Intent:** remove the `is_commission_admin_of` arm from the **meeting record**:
  `meetings_select`, `meeting_agenda_items_select`, `meeting_attendees_select`, `meeting_cases_select`,
  `meeting_signatures_select`, **and each re-cut FOR ALL write policy's USING/CHECK (C8)**; both storage
  policies (`meeting_attachments_select_member` / `_insert_staff_admin`);
  `app.assert_meeting_staff_admin` (INVOKER — so conclude/reopen/schedule lose the arm); and the
  `'meeting'` arms of `can_read_attachment` + `can_write_attachment` (reverses D4·2).
  **Adjacent channel (A11):** `can_read_action_item`'s **`committee`** + **`assignees_only`** scopes lose
  the org arm; `action_items_select`; `action_items_staff_admin_write` (org arm); `can_write_attachment`'s
  `'action_item'` arm. **DIVERGENCE (§4·D2): the exclusion term (A22/K27) and the `is_active` gate
  (A24·5/K28) are ALREADY LIVE** on `can_read_action_item` and `action_items_staff_admin_write` — C7's
  remaining work there is the **org-arm removal only**.
- **Keystones:** **17** (over-grant: org_admin/hospital_admin read **zero rows** from all five meeting
  tables + attachments, and cannot create/conclude/reopen — asserted as rows read under
  `set local role`), **19** (org_admin reads no `committee`/`assignees_only` action item nor its
  attachments; `case_restricted` follows `can_read_case`), **20** (**negatives must NOT over-reach**:
  org_admin still reads/writes `commission_meeting_types`/`_settings`, still calls
  `dispose_meeting_minutes`, still reads `audit_log`), **27/28** (already-satisfied — carry as
  regression pins), **18** (the schedule_meetings + recused-coordinator FOR ALL leg).
- **Order:** last. Its `is_commission_admin_of` removals on the write policies must be applied to the
  **re-cut** (C8) form — so C7 **after C8**. Grouped last so the broad narrowing is reviewed atomically
  against the K20/K23 over-reach guard.

---

## 3. A26 resolution → the C5 propriety-tier predicate + the `case_id IS NULL` branch

**A26 (RESOLVED, PO 2026-07-16) keys on `cases.visibility_policy` (the CASE shape), not
`meetings.visibility_policy`.** The propriety tier's **number and times** stay at `reach(meeting) AND
NOT is_case_respondent`. The withdrawal **names** ("who withdrew and why") split:

```
propriety_names_visible :=
  reach(meeting)
  AND NOT is_case_respondent(case_id, uid)
  AND (
        case_id IS NULL                                      -- case-less: see below
     OR cases.visibility_policy = 'commission_default'       -- plenary: names member-wide
     OR has_case_capability(case_id, uid, 'read_case_deliberation')  -- sub-group: substance reach
      )
```
A member of a **plenary** (`commission_default`) case sees the withdrawal name member-wide. A member of a
**sub-group** (`explicit_grants_only`) case sees the name only with substance reach; without it, the
non-identifying stub (item reserved, quorum, times — **no name**). Number/times remain at
`reach(meeting) AND NOT is_case_respondent`.

**The `case_id IS NULL` branch (plan lines 382–394, the ⛔ callout) — per tier:**
- `is_case_respondent(NULL, ·)` and `is_case_excluded(NULL, ·)` are **false** → the raw propriety and
  decision terms **allow everyone**; `_case_caps(NULL, ·)` / `has_case_capability(NULL,…)` **fails
  closed** → substance **denies everyone, reader list included**. So the four tiers for a **case-less**
  reserved item MUST be re-expressed to **follow the reader list**, not the case predicates:
  - **substance** → `reach(meeting) AND EXISTS (_item_readers row for uid)` (NOT `has_case_capability`).
  - **decision** → `reach(meeting) AND EXISTS (_item_readers row for uid)` (follows the reader list).
  - **propriety** → **EMPTY** (there is no respondent/withdrawal on a case-less subject; propriety is
    **not** "allow everyone"). The A26 `case_id IS NULL` arm above therefore resolves the **names** to
    the reader-list-gated substance, but the propriety **record itself does not exist** case-less.
  - **stub** → `reach(meeting)` (unchanged).
- This is exactly keystone **30**: reader reads substance; non-reader member reads bare stub only;
  nobody receives a propriety record or a decision that does not exist. **Case authority is never
  out-voted by a reader list** (A4) — when `case_id IS NOT NULL` the case predicates govern and the
  reader list is **ignored** (K15).

**New A26 keystone (propose #32):** a **plenary** member reads a **sub-group** case's reserved-item
**stub** but **NOT** its withdrawal name (over-grant); a **plenary** case's withdrawal name stays
member-wide (no-regression); the sub-group member **with** `read_case_deliberation` reads the name.

---

## 4. Divergences from the 2026-07-15 plan & new landmines

The plan was written before the exclusion-perimeter units (`f4df6f4`, `49dd014`) and A4 (`bf86711`)
landed. Several of its C7 "TODO"s are **already done** — building them again would be no-ops that either
churn a re-emitted DEFINER body (§Re-emit risk) or, worse, look like fresh fixes over green tests.

**D1 · C0 is cosmetic for existing data.** The seeded ethics **case** takes `visibility_policy` from a
**direct insert** (`seed.sql`), not the type default (handoff §5, §7.11). Flipping
`case_types.default_visibility_policy` moves **0** existing rows; it is correct only for **future
template-created** cases and `create_case_from_template`. C0 is still right (A1), but its keystone must
use a case whose policy is set explicitly, not one that "inherits" — there is no inheritance arrow.

**D2 · K27 (exclusion) and K28 (`is_active`) are ALREADY LIVE.** `can_read_action_item` carries **both**
`is_case_excluded` and `is_active` (verified comment-stripped). `action_items_staff_admin_write` carries
`(coalesce(source_case_id,case_id) IS NULL OR NOT is_case_excluded(...))` **and** already scopes its org
arm off `case_restricted`. The plan's C7 callouts (lines 450–461) to *add* these are **satisfied**. C7's
real remaining action-item work is the **org-arm removal** on the `committee`/`assignees_only` scopes +
`action_items_select`. Carry K27/K28 as **regression pins**, not new fixes.

**D3 · `cases.visibility_policy` is `text`, not an enum; no `visibility` enum type exists.** C3 says
"new enum." Recommend **`text` + CHECK** to match the established `cases.visibility_policy` convention
(and to avoid an enum-vs-text join mismatch when C5 correlates `meetings.visibility_policy` reasoning
with `cases.visibility_policy`). Minor; defer to lead.

**D4 · `can_read_case_or_admin` no longer carries an org arm** (A4 dissolved it — `has_orgadmin=f`). So
`meeting_cases_staff_admin_write`'s **case-half** already excludes org admins and carries the deny; C7's
job on that policy is only the **authority-half** `is_commission_admin_of` removal. The policy NAME still
says "or_admin" — §7.2·5 stale-name trap; do not infer behaviour from the name.

### New landmines / PO-level questions (surfaced, NOT resolved — the A26 discipline)

**⚠ Q1 (design fork, blocks C1/C2 SQL) — column masking has no chosen mechanism.** Keystone 10 demands a
**partially-visible row** (shell visible, `summary`/`decision` masked). RLS is whole-row and cannot do
this; today `listMeetingCases`/`listMeetingAgenda` read the raw columns over PostgREST (no view, no
masking — verified: 0 views over the meeting tables). Two DB-enforced options:
  - **(a) masking view + base-column REVOKE** (recommended): a view nulls sensitive columns via `CASE
    has_case_capability(...)`, base-table sensitive-column SELECT is REVOKE'd from `authenticated`, query
    helpers repoint to the view. Row visibility stays with the existing `*_select` policy.
  - **(b) fold summary/decision into a DEFINER projection RPC** (the C5 pattern) — heavier query-layer
    refactor, but one consistent tier engine for both the open ata (C1/C2) and closed sessions (C5).
  **This decision determines whether C1/C2 are policy migrations or view/RPC migrations, and shapes the
  query-layer contract. Needs a lead/PO ruling before C1/C2 SQL.**

**⚠ Q2 (keystone conflict across amendments) — action_items committee scope: keep or remove?** Keystone
**23** (A4/A21) explicitly forbids deleting the `is_commission_admin_of` **`committee`**-scope arm on
`action_items_staff_admin_write` ("*legitimate commission governance … deleting it is the over-reach this
keystone exists to forbid*"). Keystone **19** (Amendment 2/A11, later) requires org_admin to read
**no** `committee`-scope action item. **These are textually contradictory.** Reading amendment ordering,
Amendment 2 supersedes for the **meeting-adjacent** action-item channel — but a naive K23 reviewer will
flag C7's action_items change as an over-reach regression. **Confirm: Amendment 2 (A11/K19) wins for
`action_items` committee scope; K23 continues to protect the case **config** tables only.** Flag to `qa`.

**⚠ L2 (a fifth FOR ALL leak the plan does not sequence under C8) — `action_items_staff_admin_write`'s
`USING` side-doors `case_restricted` SELECT for a non-excluded, non-participant `staff_admin`.** It is
`FOR ALL`, so its `USING` grants SELECT. A `staff_admin` who is **not excluded** but **not a participant**
on an `explicit_grants_only` case has `can_read_action_item(case_restricted)=false` (routes
`can_read_case`), yet the `FOR ALL` `USING` (`is_staff_admin_of AND NOT is_case_excluded`) grants SELECT
— **bypassing the case gate that keystone 19 says `case_restricted` must follow**. The exclusion term
does NOT cover this (she isn't excluded, just ungranted). **Recommend folding
`action_items_staff_admin_write` into C8's re-cut (write-only)** so `case_restricted` SELECT follows
`can_read_action_item` for everyone, not only org admins. This extends C8's "four" to **five**. Proven-
by-shape from the catalog; a behavioural probe (make the fixture: non-participant staff_admin on an
`explicit_grants_only` case reads the case_restricted action item via the write policy) should confirm at
build. **New finding — surfaced for lead ruling, not resolved.**

**⚠ L3 (Re-emit discipline, §Re-emit·MEMORY).** C7 rewrites `assert_meeting_staff_admin`,
`can_read_attachment`, `can_write_attachment`, `can_read_action_item` — all `create-or-replace` over
**live** bodies that M5/perimeter units already patched (is_active, exclusion). Each C7 migration MUST
regenerate from **live `pg_get_functiondef`**, not plan text, or it silently reverts the intervening
patches (the BE-6·N / 187-sweep failure mode). This is a build-time rule; flagging now so it is not
forgotten.

---

## 5. Keystone → unit map (each with no-regression AND over-grant, §7.1)

| Unit | No-regression | Over-grant (must-NOT-reach) |
|---|---|---|
| C0 | 11 (plenary ethics member-wide) | — (widens nothing) |
| C8 | 21 (staff/staff_admin unchanged; writes succeed) | **18** (denied-by-select principal, schedule delegate, recused coord → 0 rows via write policy) |
| C1 | 10/16 (member reads decision on sub-group case; full read on own item) | **10** (recused: no substance/decision on item 4), **16** (recused: neither) |
| C2 | member reads `title`+`discussion_notes` on `commission_default` case-linked item | **14** (deliberation gated as summary), **14a NEW** (respondent reads neither process number nor notes) |
| C3 | 21 (`commission_default` unchanged) | **12** (participants_only → non-participant/non-member/recused coord: 0), **13** (empty roster rejected) |
| C4 | reader reads substance | **30** (non-reader → bare stub only), **15** (recused on reader list of case-linked subject: nothing) |
| C5 | 10 (own withdrawal in shell), 31 (coordinator issues restricted PHI) | **10/12/30/31**, **32 NEW** (A26 plenary member: sub-group stub, not name) |
| C6 | coordinator opens + picks readers | **12/30** (schedule_meetings delegate cannot open) |
| C7 | 20/23 (config + case config survive), 21 (staff unchanged) | **17** (org user: 0 rows all meeting tables + attachments, no conclude/reopen), **19** (org user: 0 committee/assignees action items), 18, 27/28 (pins) |

---

## Lead rulings 2026-07-16

- **Q1 — column masking = DEFINER projection RPC, NOT a masking view.** Both `meeting_cases`
  (`summary` deliberation-tier / `decision` = `reach AND NOT is_case_excluded`) and
  `meeting_agenda_items` (`title` propriety-tier / `discussion_notes`+`resolution` substance-tier) carry
  an intra-row tier split requiring per-ROW-context masking (K10: same user, item 4 shell-only vs item 5
  full). Route tiered meeting-content reads through a DEFINER projection RPC (consistent with C5 +
  `get_case_patient`/`open_attachment`/`list_my_cases`: one door, one tier-logic site, clean Rule-11
  audit). C1/C2 **REVOKE the substance/decision columns from `authenticated`** to close the direct
  PostgREST side door — column-REVOKE is absolute and also neutralises the `FOR ALL` `USING` for those
  columns (C8 still closes the row-level leaks). The resulting `src/lib/queries` change is accepted as
  inherent to closing the leak.
- **L2 — real iff a probe confirms; its OWN attributable migration alongside C7 (Wave 4), NOT folded into
  C8.** C8 stays = the four meeting `FOR ALL` policies (clean attribution). Verify the **STAFF_ADMIN** arm
  is the gap (my inventory noted the ORG arm is already scoped off `case_restricted`). Probe: non-excluded,
  non-participant `staff_admin`, `explicit_grants_only` case, `case_restricted` item → does
  `action_items_staff_admin_write` USING grant SELECT? If NOT reproduced → report, do not re-cut. If yes →
  gate `case_restricted` to follow `can_read_case`, paired K19 over-grant (0 rows) + no-regression
  (staff_admin still manages `commission_default`/non-case-linked items).
- **Q2 — no genuine conflict.** K19 (Amendment 2, A11) mandates removing the org arm from action_items
  `committee`/`assignees_only`; the K20/K23 over-reach guard protects a DISJOINT set (config, staffing,
  `dispose_meeting_minutes`, `audit_log_select`, `list_case_access`, `grant_member_capability`). C7 is
  correct iff it removes the arm ONLY from the meeting + action-item content channel and leaves that
  config/staff/audit set intact. Frame qa review around that remove/keep partition.

### Wave structure
Wave 1: **C0 + C8** (authorized). Wave 2: C1+C2+C3. Wave 3: C4+C5+C6. Wave 4: C7 + L2.

## Wave 1 results (2026-07-16, `backend` — built, not committed)

**C0 — NO-OP, not shipped.** The ethics `case_types.default_visibility_policy` is **already
`commission_default`** in the live catalog and in `seed.sql:2118` (landed in M6 with the comment "ADR
0078 A1 / M6·Q1"). No migration written — shipping one would be a no-op churn. The seeded ethics **case**
(`seed.sql:2130`) stays `explicit_grants_only` (the deliberate per-case ETH·E1 fixture, correct).

**C8 — BUILT + PROVEN.** `supabase/migrations/20260803000000_authz_c8_meeting_for_all_recut.sql`
re-cuts all four meeting `FOR ALL` policies to write-only INSERT/UPDATE/DELETE splits, predicates
verbatim from the catalog (arm removals deferred to C7). Verified: post-reset the four tables carry
`SELECT + INSERT + UPDATE + DELETE` only, **zero `cmd=ALL`**.
- **Closure proof (rows read under `set local role`, made non-member `schedule_meetings` delegate):**
  **meetings 1 → 0** (pre-C8 she read the meeting via the `FOR ALL` `USING` `member_can` arm; post-C8
  denied by `meetings_select`). agenda_items/attendees/meeting_cases = 0 both sides (she has no arm
  there). Delegate made by direct insert — `appoint_administrativo` requires a `staff` membership, so a
  non-member delegate is **not product-reachable** (§7.12): C8's live blast radius today is empty; the
  over-grant becomes reachable at **C3** (a member delegate reads a `participants_only` meeting she is
  not a participant of). C8 is nonetheless the **hard structural prerequisite** — without it C2/C3 test
  green while rows return through the write side door.
- **Keystone:** `supabase/tests/239_authz_c8_meeting_for_all_recut.sql` (19/19) — 2 structural, 4
  pre-flight (delegate holds no natural arm), K18 over-grant (delegate reads 0), K18b no-regression
  (delegate still INSERTs a meeting — scheduling preserved), K21 no-regression (coordinator + member
  read all children; coordinator still writes). **Falsifiable (§7.1/A33):** restoring the `FOR ALL`
  flips K18 (test 7) + the structural assertion to `not ok`, mutation-proven.
- **Regression:** 120_meetings, 204_meeting_participants, 206_meeting_held_time, 234 (A2), 235 (A4) all
  PASS against the C8 catalog. `database.ts` unchanged (RLS-only change).

**L2 probe — DOES NOT REPRODUCE → do not re-cut (per lead ruling).** `can_read_action_item`'s
`case_restricted` branch is exactly `return app.can_read_case(anchor, uid)`. A non-excluded `staff_admin`
has **`can_read_case = true`** on her commission's cases via the coordinator arm — verified empirically:
`chefe.ccih` on the seeded `explicit_grants_only` ethics case reads `can_read_case=t, excluded=f`. So
`action_items_select` already admits her; the `action_items_staff_admin_write` staff_admin arm is a
**subset** of the select policy for same-commission `case_restricted` items — **no side door**. L2 as the
lead scoped it (same-commission case) is **not a gap**; **Wave 4 should NOT re-cut `action_items`.**
- ⚠ **One residual edge I could NOT rule out (flag for F1, not Wave 4):** a **cross-commission
  referral-sourced** action item (`source_case_id` in another commission) where a `staff_admin` of the
  action-item's commission is not excluded from the foreign source case but lacks `can_read_case` on it —
  there the `FOR ALL` `USING` could exceed `can_read_action_item`. That is the F1 referral surface and a
  different scenario than L2; surfaced for the referral split, not this stage.

## Wave 2 results (2026-07-16, `backend` — built, not committed)

Three attributable migrations (order C3 → C1 → C2, because C1/C2 consume C3's
`can_reach_meeting`):
- **C3** `20260804000000_authz_c3_meeting_visibility_policy.sql` — `meetings.visibility_policy`
  (**text + CHECK**, see deviation below), `app.can_reach_meeting`, five `*_select` policies re-cut,
  roster invariant (deferred… no: **immediate** triggers `trg_meetings_roster` + `trg_attendee_roster`,
  `HC0C3`). ⚠ `meetings_select` is **inlined** (not routed through `can_reach_meeting`) — see landmine L3.
- **C1** `20260805000000_authz_c1_meeting_cases_projection.sql` — REVOKE `summary`/`decision`;
  `meeting_cases_select` drops the case-reach conjunct (A6 meeting-surface widening);
  `app._project_meeting_case` masker; `public.get_meeting_cases(uuid)` + `public.get_case_meeting_links(uuid)`
  (DEFINER, `REVOKE ALL FROM PUBLIC` → `GRANT authenticated`); `link_meeting_case` re-emitted `returns uuid`.
- **C2** `20260806000000_authz_c2_meeting_agenda_projection.sql` — REVOKE `title`/`discussion_notes`/`resolution`;
  `app._project_meeting_agenda_item` masker (title=propriety, notes/resolution=substance);
  `public.get_meeting_agenda_items(uuid)`; `create_/update_meeting_agenda_item` re-emitted `returns uuid`.

**RPC signatures (contract):**
- `public.get_meeting_cases(p_meeting_id uuid) returns setof public.meeting_cases` — masks
  `summary` (read_case_deliberation) / `decision` (NOT is_case_excluded); row-visible to meeting reachers.
- `public.get_case_meeting_links(p_case_id uuid) returns setof public.meeting_cases` — same mask; guard `can_read_case`.
- `public.get_meeting_agenda_items(p_meeting_id uuid) returns setof public.meeting_agenda_items` — masks
  `title` (NOT is_case_respondent) / `discussion_notes`+`resolution` (read_case_deliberation) on case-linked items.
- `link_meeting_case(...) returns uuid`, `create_meeting_agenda_item(...) returns uuid`,
  `update_meeting_agenda_item(...) returns uuid` (were the row type — see landmine L1).

**Keystones — all green, all falsifiable (mutation-proven):**
- **239** C8 19/19 · **240** C3 16/16 (mutation drops the visibility gate → 6 RED) · **241** C1 15/15
  (mutation drops the summary mask → K5+K16-negative RED) · **242** C2 16/16 (mutation drops the title
  mask → the NEW respondent keystone RED). **66 Stage-C assertions.**
- C3 lands the two product-reachable over-grants C8 deferred: **(a)** a member `schedule_meetings`
  delegate (non-attendee) reads 0 from a participants_only meeting; **(b)** the coordinator (non-attendee)
  reads 0 (no coordinator OR-arm). K13 roster invariant proven (empty-roster create/flip + last-attendee
  removal all rejected).
- **Regression:** 120_meetings, 204, 206, 234 (A2), 235 (A4) all pass. `next`/`typecheck`/lint clean on the
  repointed query layer (`meetings.ts`, `case-timeline.ts`, `meetings/actions.ts`). Types regenerated `--local`.

**Query-layer repoint (mine):** `listMeetingCases` + `listCaseMeetings` (case-timeline) → the projection
RPCs + a separate RLS-scoped case/meeting-header fetch; `listMeetingAgenda` → `get_meeting_agenda_items`;
three `actions.ts` consumers `data.id` → `data` (RPCs now return the id scalar).

### Deviations & landmines (Wave 2)
- **DEVIATION (flag for lead): `meetings.visibility_policy` is `text` + CHECK, not a new enum.** The plan
  said "new enum"; I matched the existing `cases.visibility_policy` (text) convention for uniformity.
  Trivial to convert if you want a hard enum.
- **L1 — the Q1 REVOKE broke three INVOKER write RPCs.** `link_meeting_case`,
  `create_/update_meeting_agenda_item` did `returning * into v_result` on the now-REVOKE'd tables →
  42501 (verified empirically: RETURNING requires SELECT on every returned column). Fixed the
  **least-invasive** way: `returns uuid` / `returning id` (their only consumers read `.id`), keeping the
  INVOKER/RLS model — **no DEFINER conversion.** Re-emitted verbatim from live `pg_get_functiondef`.
- **L2 — audit: no new action added.** The projection RPCs do NOT emit their own audit — the meeting-view
  surface already emits `meeting.viewed` and the case surface `case.opened` (adding a new
  `meeting_case.read` action would double-log and require allowlist + `_audit_access_authorized` changes).
- **L3 — `meetings_select` cannot route `can_reach_meeting` (INSERT…RETURNING trap).** `create_meeting`
  does `insert … returning *`; the SELECT policy is evaluated on the NEW row, and `can_reach_meeting`
  re-queries `public.meetings` by id — the just-inserted row is invisible to that subquery, `visibility_policy`
  reads NULL, and a legitimate creator's RETURNING is denied (broke 120/204/206). Fixed by **inlining** the
  visibility check on the row's own columns in `meetings_select` (logically identical). Child-table policies
  keep `can_reach_meeting` — their parent meeting already exists when children insert. **Lesson for C4–C7:
  any `*_select` on a table that is written via `INSERT…RETURNING` must read the candidate row's columns,
  not re-query the same table.**
- **A6 widening (surfaced, deliberate): C1 drops the case-reach conjunct from `meeting_cases_select`,** so
  the meeting surface is member-wide (process number + decision), masking only the columns. This changed a
  pinned A2 keystone — **234's K8 twin updated** (count 0 → 1, the ADR keystone-4 scope note itself flags
  count=0-on-the-meeting-surface as the negation of K10/K16). Flagged for `qa`.

## Analysis deliverable — the per-case override door (A31·6): REPORT

**A31·6 is STALE — a production DB door EXISTS.** `public.set_case_visibility(uuid, text)` (landed in M6,
`prosecdef = t`) writes `cases.visibility_policy`. Catalog-verified gate: coordinator-only
(`HC0F5` = `is_staff_admin_of OR is_commission_admin_of`) → exclusion deny (`HC0F1` via
`assert_not_case_excluded`) → value validation (`HC0F6`, policy ∈ {`commission_default`,
`explicit_grants_only`}) → `audit_write('case.visibility_changed')`; `REVOKE … FROM PUBLIC` before GRANT.
So a coordinator **can** set a specific case to `explicit_grants_only` at the DB/RPC layer, gated + audited.
A31·6's "nothing writes visibility_policy post-creation" was true when written but M6 added this door.

**BUT it is PRODUCT-LATENT — no UI / app action reaches it.** Per handoff §5 / PO-decision-8, the
`setCaseVisibility` app action + coordinator control are deferred to ETH·E2/S4; the four ethics actions are
contract-first stubs that throw, 0 UI bound. Confirmed: no `src/` caller of `set_case_visibility`.
`create_case` takes `commission_default`; `create_case_from_template` honors the type default (now
`commission_default` for ethics). So **A26's sub-group branch is reachable at the RPC layer, not yet from
the product UI.** C5 tier testing uses the seeded `explicit_grants_only` case regardless — this does NOT
block C5. **Your call:** wire the `setCaseVisibility` app action + coordinator control in Stage C (needs
`frontend`), or keep it deferred to ETH·E2/S4. Reporting only.

## Wave 3 results (2026-07-16, `backend` — built, not committed)

Three attributable migrations (130 migrations total):
- **C4** `20260807000000_authz_c4_closed_session_tables.sql` — three greenfield tables:
  `meeting_closed_sessions` (time block; reach-scoped SELECT, GRANT SELECT to authenticated),
  `meeting_closed_session_items` (**NO authenticated SELECT** — RLS-enabled, no policy, no grant),
  `meeting_closed_session_item_readers` (no policy, no grant — RPC-only). Writes are DEFINER-only
  (BUG-SUP-002: no broad authenticated DML behind the gate).
- **C5** `20260808000000_authz_c5_reserved_session_projection.sql` — the four-tier DEFINER projection.
- **C6** `20260809000000_authz_c6_reserved_session_lifecycle.sql` — coordinator-only lifecycle RPCs.

**C5 RPC signature + ACL (catalog-verified):**
```
public.get_reserved_session_items(p_meeting_id uuid)
  returns table (id, closed_session_id, case_id, item_position, quorum_met, started_at, ended_at,
                 process_number int, withdrawals text, substance text, decision text)
  prosecdef = t   ACL = postgres|service_role|authenticated=X   (NO public)
  -- REVOKE ALL ON FUNCTION … FROM PUBLIC;  GRANT EXECUTE … TO authenticated;
```
`open_reserved_session(uuid) returns uuid` and
`add_reserved_item(uuid, uuid, text, text, text, boolean, uuid[]) returns uuid` — both `prosecdef=t`,
both `REVOKE ALL FROM PUBLIC` → `GRANT authenticated` (no PUBLIC in the ACL — t19 guard satisfied).

**The four tiers (C5), and the A26 + case-less shaping:**
- stub `reach` · propriety `reach AND NOT is_case_respondent` · substance
  `reach AND has_case_capability(case_id,'read_case_deliberation')` · decision `reach AND NOT is_case_excluded`.
- **A26 (proven):** withdrawal NAMES member-wide only for `commission_default`; `explicit_grants_only`
  additionally requires `read_case_deliberation`; the number/times stay at `reach`. Keys on
  `cases.visibility_policy`. **The propriety asymmetry** (`is_case_respondent` ALONE, not excluded) means
  the recused member still reads her OWN withdrawal (keystone 10).
- **case_id IS NULL branch:** substance + decision follow the **reader list**
  (`meeting_closed_session_item_readers`); the propriety tier is **EMPTY** (no number, no withdrawals).
  The reader list is consulted ONLY when `case_id IS NULL` — case authority is never out-voted.

**Keystones — all green, C5's A26 mutation-proven:**
- **243** C5 24/24 — coordinator (all tiers) · **keystone 10** (recused: own withdrawal + number + stub,
  NOT substance/decision) · respondent (propriety NULL) · **A26** (member reads sub-group number but NOT
  the withdrawal names; reads the plenary withdrawal) · **case-less** (reader reads substance, non-reader
  reads stub only, propriety EMPTY) · **keystone 12** (non-attendee reads nothing from a participants_only
  reserved session). Mutation dropping the A26 deliberation gate → the withdrawal-names over-grant RED.
- **244** C6 7/7 — coordinator opens; **a plain member AND a schedule_meetings delegate are denied**
  (opening is not administrativo); the recused coordinator cannot author reserved content on her own case
  (`HC0F1`); the case-less reader list takes members only.
- **Closure proofs (rows read / values projected under `set local role`):** the A26 keystone is 243's
  tests "member reads sub-group number (cn_eg) but NULL withdrawal names" + "reads the plenary withdrawal
  WD_A"; the case-less proof is 243's "reader reads SUB_C / non-reader reads NULL / propriety NULL".
- Regression: 239–242, 234, 120, 204, 206 all pass; typecheck clean; types regenerated `--local`.

### Landmines applied / notes (Wave 3)
- **Wave-2 landmine carried:** `meeting_closed_sessions_select` reads reach via `can_reach_meeting(meeting_id)`,
  which re-queries `public.meetings` — the PARENT already exists when a session inserts, so the
  INSERT…RETURNING trap does not bite (a self-referential re-query would; none is used). C6's item inserts
  are DEFINER (bypass RLS) so they hit no RETURNING trap on the no-SELECT-policy items table.
- **`position` is a reserved keyword** in a `RETURNS TABLE` column list → C5's output column is `item_position`.
- **`cases.case_number` is auto-minted** (a trigger overrides an inserted value) — noted so keystones read
  the real number, not a literal.
- **Query/action wrappers deferred to the Stage-C FE task (serialized):** the RPC contract is in
  `src/lib/types/database.ts`. No untested TS added this wave.

## Wave 4 results (2026-07-16, `backend` — built, not committed) — STAGE C BACKEND COMPLETE

**C7** `20260810000000_authz_c7_org_user_loses_meeting_surface.sql` (131 migrations) — removes ONLY the
`app.is_commission_admin_of` arm from the meeting record + adjacent action-item channel. Catalog-verified:
**0 org arms remain** on `meetings`/`meeting_agenda_items`/`meeting_attendees`/`meeting_cases`/
`meeting_signatures`/`action_items`; `assert_meeting_staff_admin` + `can_read_action_item` +
`can_read_attachment`('meeting') + `can_write_attachment`('meeting'/'action_item') cleaned; both storage
policies cleaned. **KEEP set untouched** (verified `commission_meeting_types`/`_settings` still carry the
org arm). Functions re-emitted from live `pg_get_functiondef` with only the arm removed; K27 exclusion +
K28 `is_active` preserved verbatim as pins. `can_read_case_or_admin` (stale name) not touched — G1 retires it.

**Keystone 245 C7 (15/15), mutation-proven:**
- **K17** — org_admin reads **0** meetings/agenda/attendees/cases and CANNOT write the meeting record
  (RLS 42501). Mutation restoring the org arm on `meetings_select` → K17 RED.
- **K19** — org_admin reads **0** committee + **0** assignees_only action items.
- **K20** (no over-reach) — org_admin STILL reads AND writes `commission_meeting_types` (config survives).
- **K21** — the coordinator + ordinary member read/write their `commission_default` meeting unchanged.

**FOR-ALL over-grant probe (lead ask):** after the org-arm removal, `action_items_staff_admin_write`'s
remaining `FOR ALL` staff_admin `USING` does **NOT** over-grant committee/assignees SELECT past
`can_read_action_item` — `is_staff_admin_of` ⊆ `is_member_of` (the committee select arm) and is the
identical arm on the assignees_only select branch, so the write `USING` is a subset of the select policy.
No re-cut needed.

**Q2 reconciliation applied:** C7/A11 supersedes A4/K23 for the meeting-adjacent action-item channel —
**235's K3 positive twin updated** (org_admin `committee` action item 1 → 0, with the A11-supersedes-A4
note); K23's protection of the case CONFIG tables (`case_tags`/`case_outcomes`/`case_narrative_types`)
is unchanged and still passes in 235.

**Deferred query/action wrappers (Rule 9, backend-owned):**
- `src/lib/queries/meetings.ts` — `listReservedSessionItems(meetingId)` (→ `get_reserved_session_items`)
  + `listClosedSessions(meetingId)` + the `ReservedSessionItem` / `ClosedSession` types.
  (`listMeetingCases` / `listMeetingAgenda` / `listCaseMeetings` over `get_meeting_cases` /
  `get_meeting_agenda_items` / `get_case_meeting_links` were wired in Wave 2.)
- `src/lib/meetings/actions.ts` — `openReservedSession(meetingId)` + `addReservedItem(sessionId, input)`
  (→ `open_reserved_session` / `add_reserved_item`) + `ReservedItemInput`.
- `src/lib/meetings/messages.ts` — two pt-BR success strings.
- typecheck + lint clean; types regenerated `--local`. E2E arrives with the tester's Stage-C pass.

**Full Stage-C keystone suite: 239–245 = 112 assertions, all green + mutation-proven.**
Regression: 234, 235, 120, 204, 206 all pass. **Stage C backend (C0–C8) is complete.**

## 6. Constraints honored
LOCAL ONLY (no remote). Each unit = one attributable migration. C5's RPC is DEFINER + audited +
`REVOKE ALL FROM PUBLIC` before `GRANT`. New tables get RLS enabled with explicit policies. Types
regenerated `--local` after each migration. Files touched at build: `supabase/migrations/**`,
`supabase/seed.sql` (C0), `src/lib/queries/meetings.ts` + `src/lib/types/database.ts` (repoint after
C1/C2/C5). No `src/app` / `src/components` (frontend serialized separately per the plan's FE note).

**STOP — awaiting lead review of this sequence before any SQL.**
