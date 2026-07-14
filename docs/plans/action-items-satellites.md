# Increment Plan — Action-Items Satellites + Cross-Link UI

**Status:** 📝 Plan — awaiting human approval (no code until approved) · **Date:** 2026-07-13
· **Flags:** `action_items` (exists, ON — master gate), `cases_extras` (exists, ON — case-source
arms) — **both reused, no new flag**
· **ADR:** [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md)
(the hub + `visibility_scope` + `app.can_read_action_item` — SHIPPED) · **SQLSTATE:** `HC0I0–HC0I9`
· **S0 collision:** [X-ε](./pre-pilot-release-scope-expansion.md#x-ε--action_items-hub--aisat--ethe2--ch--)
(🟢 one-line contract) · **Track:** AI (item 9 — satellites; item 10 — cross-link UI), per the
[S0 ratification record](./pre-pilot-release-s0-ratification.md) §H.

This is an additive, feature-flagged increment over the shared `action_items` hub (migrations
`20260706000000_shared_action_items.sql` + `20260707000000_fold_case_action_items.sql`, ADR 0050).
It clears the CLAUDE.md §6 gate bar — three **new tables**, new DEFINER RPCs, and RLS **reusing an
existing predicate verbatim** (not a new shape) — so each satellite gets a **one-line plan + lead
ack** (X-ε is pre-resolved 🟢; no novel RLS shape is introduced) while the reminder→N scan-arm
wiring gets a plan review when N lands (a new consumer of an engine that does not exist yet).
Mirrors [`case-access-control.md`](../phases/case-access-control.md) for density.

## 0. What already shipped (read before building — do not re-derive)

The hub (`public.action_items` + `action_item_assignments` + `action_item_status_history`) and its
scope-aware read predicate are **live and unchanged by this plan**:

- `public.action_items` — `source_type ∈ {meeting, manual, case}`, `visibility_scope ∈ {committee,
  case_restricted, assignees_only}` (default `committee`; **hard-forced** `case_restricted` for
  `source_type = 'case'`), `commission_id` (tenancy anchor), `assigned_to`, `status_id` →
  `action_item_statuses.key ∈ {open, in_progress, done, cancelled}`.
- `app.can_read_action_item(p_action_item_id uuid, p_uid uuid) returns boolean` — the scope-aware
  DEFINER predicate (`20260707000000` §3): `committee` → membership/org-admin; `case_restricted` →
  `app.can_read_case(coalesce(source_case_id, case_id), uid)`; `assignees_only` → active assignment
  / `assigned_to`, plus staff_admin/org_admin always. Drives the hub SELECT policy (inlined) **and**
  both existing satellite SELECT policies (`action_item_assignments`, `action_item_status_history`,
  which call the helper).
- `app.commission_of_action_item(p_action_item_id uuid) returns uuid` — DEFINER; the tenancy lookup
  used by `app.audit_write`'s `p_commission` argument and by any RLS/RPC needing the parent
  commission.
- The `committee_*` RPC family (`create_committee_action_item`, `update_committee_action_item`,
  `advance_committee_action_item`, `complete_committee_action_item`,
  `delete_committee_action_item`) — authority branches by `source_type`; case rows additionally
  gate `cases_extras` via `app.assert_extras_enabled()`.
- Audit: `app.trg_audit_action_items()` on the hub (INSERT/UPDATE/DELETE →
  `action_item.created`/`updated`/`deleted`, via `app.audit_write`) +
  `app.trg_audit_action_item_status_history()` (→ `action_item.status_changed`). Both non-PHI,
  `audit_write`-only (no `log_audit_access` allow-list entry — confirmed absent from
  `20260711000100_grant_hardening.sql`; that allow-list is for cross-member/PHI *reads*, which the
  hub does not have).
- **`_for(commission, uid)` DEFINER-context helper variants exist and are the convention inside
  satellite RPCs**: `app.is_member_of_for`, `app.is_staff_admin_of_for`,
  `app.is_org_admin_of_commission_for` (used inside `can_read_action_item` itself, §3 of
  `20260707000000`).

**What this plan does NOT touch:** the hub schema, `can_read_action_item`'s logic, the
`committee_*` RPC signatures/authority, or the two existing satellites. AI·sat is *pure addition*
— three new spoke tables hanging off `action_items.id` — and AI·ui is *pure projection* — surfacing
columns/params that already exist end-to-end in the DB but stop short of the UI today.

## 1. Goal

Two slices, one phase, serialized on the same components (X-ε, plan §5):

- **AI·sat** — ship exactly **three** satellite tables that round out the hub into a usable
  activity/checklist/reminder surface: **reminders**, **updates-feed**, **checklists**. Everything
  else in the partner handoff's satellite menu (`docs/design/temp/action_item.md` §10/13–15/17–19)
  stays **explicitly deferred** (§2 below) — this is a Product-Owner decision (S0 ratification §F.1),
  not an oversight.
- **AI·ui** — surface the hub's already-shipped `visibility_scope` +  `case_id` cross-link +
  coordinator `p_visibility_scope` override in the three FE files that create/edit/list hub rows.
  **Zero new RLS** — `can_read_action_item` and the default-restrict guard trigger already exist and
  are exercised end-to-end by the DB layer; the UI has simply never exposed the knob.

**Invariants that MUST hold (regression-guard these):**

- A `case_restricted` row (any source) stays invisible — title, description, status history, and
  every new satellite row — to a caller who cannot `can_read_case` its `coalesce(source_case_id,
  case_id)`. No satellite table may leak existence through a joined title or a partial-visibility
  read.
- `source_type = 'case'` rows stay hard-forced `case_restricted` (the guard trigger's existing
  behavior) — no satellite write path may create a loophole that lets a case-sourced item read as
  `committee`.
- CAPA (`public.capa_*`, PHI, Rule 12) stays fully isolated — no satellite table references CAPA,
  and no CAPA row ever becomes an `action_items` row. The relationship between CAPA and a shared
  action item (if any) is an **escalation** (a workflow event), never a shared satellite table.
- Flag-OFF fallback: `action_items` OFF ⇒ the satellites are unreachable (their RPCs gate the same
  flag; their tables are simply empty/dark) — byte-for-byte the pre-increment hub behavior.
- Every new `public.*` RPC: `revoke all … from public;` then `grant execute … to authenticated,
  service_role;` (t19 guard — DROP+recreate resets grants, re-issue both).

## 2. AI·sat — the three satellites (and the explicit non-set)

**Ship exactly these three** (S0 ratification §F.1 — a closed set, not a floor):

1. **`action_item_reminders`** — one or more reminder *rules* per item (when to nudge, who to
   notify); the actual notification delivery is N's job (X-ζ — this table only stores
   configuration + the due-computation the scan arm reads).
2. **`action_item_updates`** — the append-only activity/narrative timeline (notes, progress,
   blockers, deadline changes) distinct from the structured `action_item_status_history` the hub
   already has.
3. **`action_item_checklists`** — lightweight ordered subtask rows scoped to one action item (own
   status/assignee/due, no independent lifecycle of the item kind).

**Explicitly deferred** (per S0 ratification §F.1 — do not build, do not stub tables for these; if
a future track needs one, it opens its own plan): `action_item_related_records` (cross-links to
other entities), `action_item_reviews` (formal review/approval workflow),
`action_item_follow_ups` (recurring check-ins), `action_item_dependencies` (item-to-item blocking
graph), `action_item_templates` (+ template checklist/follow-up rows), and custom fields
(`action_item_custom_field_defs` / `_values`). The partner handoff (`docs/design/temp/action_item.md`
§10, §13–15, §17–19) describes all six in full; they are **not** part of this increment. CAPA's
existing satellite tables (evidence, effectiveness checks) stay CAPA's own — **not** folded, per
ADR 0050's "CAPA stays separate because its divergence is essential" rejection.

### 2.1 Shared shape across all three tables

Every satellite:

- `id uuid primary key default gen_random_uuid()`
- `action_item_id uuid not null references public.action_items(id) on delete cascade`
- RLS: `enable row level security`; **one SELECT policy per table**, `for select to authenticated
  using (app.can_read_action_item(action_item_id, auth.uid()))` — **verbatim reuse**, no new
  predicate, no new disjunct, no per-satellite scope logic. This is the X-ε contract in full.
- **No authenticated INSERT/UPDATE/DELETE policy** — every write funnels through a `committee_*`
  DEFINER RPC (mirrors the two existing satellites; `grant all … to authenticated` on the table is
  for the SELECT the policy already restricts, matching the hub's existing grant pattern).
- Indexed on `action_item_id` (satellite lookups are always "rows of this item").
- An `app.trg_audit_*` AFTER trigger emitting `action_item.<satellite>.<verb>` via `app.audit_write`
  with `p_commission := app.commission_of_action_item(action_item_id)` (mirrors
  `app.trg_audit_action_item_status_history`) — metadata is PHI-free (Rule 11: records *that* +
  *who*, never payloads; note the row bodies here — reminder config, update text, checklist titles
  — are already non-PHI by construction, since the hub itself is a non-PHI surface, but the audit
  diff still only tracks structural columns, not free-text `body`/`title`, mirroring the hub's own
  `v_cols` allowlist pattern).
- No soft-delete (hard-delete-plus-audit, platform-wide convention; ADR 0050 §Alternatives
  rejected "soft-delete folded rows").

### 2.2 `action_item_reminders`

```sql
create table public.action_item_reminders (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  reminder_type text not null check (
    reminder_type in ('before_due', 'on_due', 'after_due')
  ),
  offset_days integer,              -- interpretation depends on reminder_type; NULL for on_due
  is_active boolean not null default true,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_item_reminders_offset_check check (
    (reminder_type = 'on_due' and offset_days is null)
    or (reminder_type <> 'on_due' and offset_days is not null and offset_days > 0)
  )
);
```

Deliberately **narrower** than the partner handoff's `action_item_reminder_rules` (§20): no
`recurrence_interval` / `recurring_until_completed` (N's engine does not support recurring scan
sources yet — X-ζ ships "already-shipped sources", each a one-shot due check per batch run), no
per-rule `notify_owner`/`notify_reviewers`/`notify_committee_coordinators` fan-out (N's
`notifications` table is **own-row** — `user_id = auth.uid()` RLS; a reminder resolves to a
**single** notification recipient — the item's `assigned_to`, or its owner assignment — not a
configurable broadcast list). `last_sent_at` is **not stored here** — idempotency is N's engine's
job (X-ζ: "the batch is idempotent" is N's own invariant, computed by checking existing
`notifications` rows for the same `(user_id, kind, entity_id)`, not by this table tracking
send-state). Keeping the satellite this thin avoids AI·sat quietly reimplementing part of N's
engine before N exists.

**Read policy:** `can_read_action_item(action_item_id, auth.uid())` — verbatim, per §2.1. A
reminder rule for a `case_restricted` item is invisible to a non-case-reader exactly like the item
itself, closing the same "leak through a satellite" class of gap ADR 0050 closed for the first two
satellites.

**Write RPCs (staff_admin/org_admin of the item's commission — mirrors the hub's own write
authority, not the assignee):**

- `public.create_committee_action_item_reminder(p_action_item_id uuid, p_reminder_type text,
  p_offset_days integer default null) returns public.action_item_reminders`
- `public.update_committee_action_item_reminder(p_id uuid, p_is_active boolean) returns
  public.action_item_reminders` — toggle only; type/offset are immutable after create (delete +
  recreate to change the shape, mirrors the platform's general preference for narrow mutators over
  omnibus updates on config rows).
- `public.delete_committee_action_item_reminder(p_id uuid) returns void`

Each: `if not app.feature_enabled('action_items') then raise exception … using errcode = 'HC000';`
(mirrors every existing `committee_*` RPC); authority = `app.is_staff_admin_of_for(v_commission_id,
v_uid) or app.is_org_admin_of_commission_for(v_commission_id, v_uid)` where `v_commission_id :=
app.commission_of_action_item(p_action_item_id)`; `HC0I0` on `not entitled`.

### 2.3 `action_item_updates`

```sql
create table public.action_item_updates (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  author_id uuid references public.profiles(id),
  update_type text not null check (
    update_type in ('note', 'progress', 'blocker', 'deadline_change')
  ),
  body text not null,

  created_at timestamptz not null default now(),

  constraint action_item_updates_body_not_blank check (btrim(body) <> '')
);
```

Deliberately narrower than the partner handoff's `action_item_updates` (§11): no
`progress_percent`, no `old_value`/`new_value` jsonb pair, no `is_internal`, no
`'assignment_change'|'status_change'|'evidence_uploaded'|'review_requested'|'review_completed'|
'follow_up_completed'|'system'` update types. The hub **already has** a structured, system-authored
transition log (`action_item_status_history`, written by `advance_committee_action_item` itself) —
duplicating status/assignment-change tracking here would be exactly the "two schemas for one
concept" ADR 0050 rejected for `case_action_items`. This table is the **narrative** layer only:
what a human typed, not what the system already logs elsewhere. `evidence_uploaded` /
`review_requested` types are dropped because evidence and reviews are deferred satellites (§2) —
adding their event types here would be scaffolding for tables this plan does not build.

**Read policy:** `can_read_action_item(action_item_id, auth.uid())` — verbatim.

**Write RPC (any commission member who can currently write the item — mirrors the read-scope's
natural write-scope, i.e. anyone who can see it and has a stake, not just staff_admin — this is the
one satellite where a plain assignee posting a progress note is the primary use case):**

- `public.create_committee_action_item_update(p_action_item_id uuid, p_update_type text, p_body
  text) returns public.action_item_updates` — authority: `can_read_action_item(p_action_item_id,
  auth.uid())` **and** (`assigned_to = auth.uid()` OR an active `action_item_assignments` row for
  `auth.uid()` OR `is_staff_admin_of_for`/`is_org_admin_of_commission_for`) — i.e., a reader who
  also has *some* stake, not an anonymous committee member with only `committee`-scope visibility.
  `HC0I1` on `not entitled`.
- No update/delete RPC in this increment — updates are an append-only narrative (mirrors
  `action_item_status_history`, which has no update/delete path either); a mistaken post is
  superseded by a correcting note, not edited away (keeps the audit trail honest — same rationale
  as the platform's general hard-delete-plus-audit stance, applied here as *no-mutate* instead).

### 2.4 `action_item_checklists`

```sql
create table public.action_item_checklists (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,

  title text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,

  completed_at timestamptz,
  completed_by uuid references public.profiles(id),

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint action_item_checklists_title_not_blank check (btrim(title) <> '')
);
```

Deliberately narrower than the partner handoff's `action_item_checklist_items` (§16): no
`description`, no `assigned_to_member_id` (a checklist row inherits the parent item's assignee —
per-subtask assignment is exactly the "if a subtask needs its own owner… it should become its own
`action_item` instead" guidance the handoff itself states, §16 Responsibility), no `status`
enum-with-`blocked`/`cancelled` (a checklist row is a binary subtask: `is_done` boolean — the
handoff's richer status model is scaffolding for a feature this increment does not need; a
genuinely blocked/cancelled subtask becomes its own `action_item` per the same guidance), no
`due_at` (reminders are the dedicated satellite for deadline-driven nudges, §2.2 — a checklist
subtask deadline would be a second, competing due-date surface on the same parent item).

**Read policy:** `can_read_action_item(action_item_id, auth.uid())` — verbatim.

**Write RPCs (same reader-with-a-stake authority as updates §2.3 — a checklist is working material
for whoever is doing the work, not a coordinator-only config surface):**

- `public.create_committee_action_item_checklist(p_action_item_id uuid, p_title text, p_sort_order
  integer default null) returns public.action_item_checklists`
- `public.toggle_committee_action_item_checklist(p_id uuid, p_is_done boolean) returns
  public.action_item_checklists` — stamps `completed_at`/`completed_by` on `true`, clears both on
  `false` (mirrors the hub's own `completed_at`/`completed_by` pattern on `action_items` itself).
- `public.update_committee_action_item_checklist(p_id uuid, p_title text, p_sort_order integer
  default null) returns public.action_item_checklists` — title/order edits, not done-state (use
  toggle for that — narrow mutators, same rationale as reminders §2.2).
- `public.delete_committee_action_item_checklist(p_id uuid) returns void`

Same reader-with-a-stake authority as `create_committee_action_item_update` (§2.3): `HC0I2` on not
entitled.

### 2.5 SQLSTATE allocation (block `HC0I0–HC0I9`)

| Code | Condition | pt-BR message (data layer) |
|---|---|---|
| `HC0I0` | Not entitled to manage a reminder rule (not staff_admin/org_admin of the item's commission) | "Você não pode gerenciar lembretes deste item." |
| `HC0I1` | Not entitled to post an update (no read-with-stake) | "Você não pode adicionar atualizações a este item." |
| `HC0I2` | Not entitled to manage a checklist row (no read-with-stake) | "Você não pode gerenciar a checklist deste item." |
| `HC0I3–HC0I9` | Reserved (not allocated by this plan) | — |

`HC000` (feature unavailable, flag OFF) is **reused** from the existing hub RPCs, not re-minted.

## 3. AI·sat — the reminder → N scan-arm contract (X-ζ)

**N owns the engine; AI·sat owns the arm.** This section specs the **arm's contract only** — what
it emits and how it stays idempotent — so N can build `compute_due_notifications()` without waiting
on AI·sat, and AI·sat can land its arm additively once N's engine exists (S0 ratification §E
X-ζ: "N does not wait on them; they do not fork the engine").

**When N is live, `compute_due_notifications()` gains one more `union all` branch:**

```sql
-- AI·sat arm: due action-item reminders.
select
  r.action_item_id as entity_id,
  'action_item' as entity_type,
  coalesce(
    a.assigned_to,
    (select user_id from public.action_item_assignments
     where action_item_id = r.action_item_id and role = 'owner' and completed_at is null
     limit 1)
  ) as user_id,
  'action_item_reminder' as kind,
  a.commission_id,
  a.title as entity_title            -- feeds the notification title/body (PHI-free, Rule 12)
from public.action_item_reminders r
join public.action_items a on a.id = r.action_item_id
join public.action_item_statuses st on st.id = a.status_id
where r.is_active
  and st.is_terminal = false          -- a done/cancelled item never re-fires a reminder
  and a.due_date is not null
  and (
    (r.reminder_type = 'before_due' and a.due_date = current_date + r.offset_days)
    or (r.reminder_type = 'on_due' and a.due_date = current_date)
    or (r.reminder_type = 'after_due' and a.due_date = current_date - r.offset_days)
  )
  and coalesce(
    a.assigned_to,
    (select user_id from public.action_item_assignments
     where action_item_id = r.action_item_id and role = 'owner' and completed_at is null
     limit 1)
  ) is not null                       -- an unassigned item has no one to notify — no row emitted
```

**Contract terms (binding on both sides):**

- **Due event:** the arm fires **exactly once per calendar day** a reminder's condition is true
  (date equality, not a range) — this is what makes the arm naturally idempotent *within* a single
  day's batch run without this table tracking send-state itself (§2.2 — no `last_sent_at` here).
  Cross-run idempotency (the batch running twice the same day) is N's engine's responsibility, per
  X-ζ's "idempotent (no dup per due event)" contract — N de-dupes by checking for an existing
  `notifications` row with the same `(user_id, kind, entity_id, created_at::date)` before inserting,
  exactly as it must for every other scan-arm source.
- **`kind`:** `'action_item_reminder'` — a new value in N's `notifications.kind` domain (N's schema
  owns that CHECK/enum; this plan does not modify it, only names the value it will need).
- **`entity_type` / `entity_id`:** `'action_item'` / `action_items.id` — lets the notification's
  click-through resolve to the item (My Action Items list or the source case/meeting detail,
  whichever the FE's existing per-source link logic already handles — no new route).
  **Note:** this is a discriminator N's own `entity_type` domain needs to add — the AI·sat arm is
  N's first non-founding-source consumer to introduce a **new** `entity_type` value (the
  already-shipped sources in §316–328 of the scope-expansion plan are `signoff`, `meeting_signature`,
  `capa_action`, `document`, `indicator` — none of which is `action_item`).
- **`user_id`:** resolved to a single recipient (assignee, falling back to the active owner
  assignment) — **never** a fan-out list. N's `notifications` RLS is own-row
  (`user_id = auth.uid()`); a reminder with no resolvable recipient (an unassigned item) emits
  **no row**, not a null-user row.
- **PHI-free (Rule 12):** `entity_title` is the hub item's own `title` — already non-PHI by
  construction (the hub is a non-PHI surface end-to-end; a `case_restricted` item's title still
  flows into a notification **only** for its own assignee, who — by definition of
  `assigned_to`/active-assignment — is already someone with a stake, though **not necessarily** a
  `can_read_case` reader). **Open decision (flagged below, §6):** whether an `assigned_to` who
  cannot `can_read_case` the item's cross-linked case should still receive a reminder notification
  carrying the item's title — this is a narrow edge (an item can be `case_restricted` while its
  `assigned_to` is a plain committee member without case access) that N's engine + this arm's
  authors must resolve together when N lands, not something this design-only spec can unilaterally
  decide.
- **Terminal exclusion:** `st.is_terminal = false` mirrors the existing `get_member_overview`
  "pending" definition — a completed/cancelled item never re-enters the due set, even if a reminder
  rule is still `is_active` (no RPC forces `is_active := false` on item completion in this plan;
  the arm's own WHERE clause is the sole guard, which is intentionally simpler than adding a
  completion-cascade trigger for a filter the scan arm already applies for free).
- **Sequencing:** this arm is **inert code** until N ships (its `union all` branch simply does not
  exist in `compute_due_notifications()` until N's migration adds it) — AI·sat's three tables ship
  and are fully usable (reminder rules can be created/toggled/deleted) with **zero notification
  delivery** until N lands, exactly like N's own scan-arm contract promises for every later
  consumer.

## 4. AI·ui — surfacing the shipped backend (mostly frontend; backend posts thin read-plumbing)

**Everything this slice needs already exists in the DB.** No new RLS, no new RPC parameter, no new
column. The gap is entirely presentational: three FE files create/edit/list hub rows without
projecting or setting `visibility_scope` and its coordinator override, even though
`create_committee_action_item` / `update_committee_action_item` have accepted `p_visibility_scope`
since `20260707000000` (§6 of that migration).

### 4.1 Confirmed gaps (read during S0 research, not assumed)

- `src/lib/queries/case-action-items.ts` — `HubActionItemRow` / `CaseActionItem` do **not** project
  `visibility_scope`. (Case-sourced rows are always `case_restricted` per the guard trigger, so this
  is informational-only for that panel — see §4.2.)
- `src/lib/queries/action-items.ts` — `MyActionItemJson` / `MyActionItem` (backing
  `list_my_action_items`) do **not** project `visibility_scope`. This is the RPC's own return shape
  (`jsonb_build_object(...)` in the SQL), so adding the field is a **DB-side** change (§4.3) before
  it can flow through this TS type.
- `src/lib/cases/action-items-actions.ts` — `createActionItem` / `updateActionItem` call
  `create_committee_action_item` / `update_committee_action_item` **without** `p_visibility_scope`
  (relying entirely on the RPC's own default-computation). For the case-source arm this is
  harmless (guard-forced anyway), but it means there is currently **no path** for a coordinator to
  set `assignees_only` on any row, or to override a meeting/manual item's computed default, from
  any existing form.
- `src/components/cases/case-action-item-form.tsx` (case-sourced create/edit) — no visibility
  control. **Correctly so** — a case-sourced row is always `case_restricted`; a visibility picker
  here would be a dead control. No change needed to this file's *fields*; see §4.4 for its one
  required change (`case_id` display, not editing).
- `src/components/meetings/action-item-form.tsx` (meeting-sourced create/edit) — no visibility
  control, no `case_id` cross-link field (its own comment says "Case cross-link is set elsewhere;
  not exposed in this form for v1" — that "elsewhere" does not yet exist).
- `src/components/action-items/action-items-table.tsx` ("Meus itens de ação", read-only,
  self-scoped) — does not render a visibility indicator. Lower priority (self-scoped: the viewer is
  always either the assignee or a committee member who could already see a `committee` row; a
  `case_restricted` row they see is one they can already `can_read_case`) but included for
  completeness/UX parity (§4.5).

### 4.2 `queries/case-action-items.ts` — thin read-plumbing

Add `visibilityScope: 'committee' | 'case_restricted' | 'assignees_only'` to `CaseActionItem` and
project `visibility_scope` in `HubActionItemRow` / the `.select()` string / the mapper. Read-only
addition — no behavior change (case rows are always `case_restricted`; this makes that fact visible
in the type/UI rather than asserted only in a comment, and future-proofs the panel if a case-sourced
row's scope logic ever changes).

### 4.3 `queries/action-items.ts` + the `list_my_action_items` RPC — DB-side addition needed

Unlike §4.2, this one requires a **backend** change beyond query-layer projection: the RPC's
`jsonb_build_object(...)` in both UNION arms (case arm + meeting/manual arm, `20260707000000` §7)
does not currently include `visibility_scope`. Add it to both arms' `jsonb_build_object` calls (a
same-migration-family additive change to the RPC body — `create or replace function`, forward-only,
does not touch `20260706`/`20260707`) and extend `MyActionItemJson` / `MyActionItem` with
`visibilityScope`. This is the one place in AI·ui where "no new RLS" does not mean "no backend
change" — the RPC return shape itself needs to widen. Backend posts this as part of the AI·sat
migration window (§5) since it is the same kind of forward-only additive change, even though it is
conceptually part of the AI·ui slice.

### 4.4 `case-action-item-form.tsx` — no visibility control (by design); render `case_id` context

No new field. The one addition: since `visibilityScope` is now on the type (§4.2), the edit-mode
header/description may state "Visível apenas a quem pode ver este caso" (a static, non-interactive
disclosure) so the coordinator understands *why* there is no toggle here — consistent with the
guard trigger's hard-force. This is presentational polish, not a functional gap; if the lead prefers
to skip it for scope discipline, dropping it does not weaken any invariant (an Open decision, §6).

### 4.5 `meetings/action-item-form.tsx` — visibility toggle + `case_id` cross-link field

The one form that actually needs new fields, since meeting/manual items are the only source where
`visibility_scope` is coordinator-settable (`committee` ↔ `case_restricted` ↔ `assignees_only`, per
ADR 0050 §2):

- A `case_id` picker (optional, same-commission cases only — mirrors the existing case-linker
  pattern in `src/components/meetings/case-linker.tsx`, ADR-0033-precedented) — setting it computes
  the RPC's own default (`case_restricted` when cross-linked) unless overridden below.
- A visibility select (`Comitê` / `Restrito ao caso` / `Somente responsáveis` — pt-BR labels for
  `committee`/`case_restricted`/`assignees_only`) defaulting to the RPC-computed value, **disabled**
  (or hidden) when no `case_id` is set **and** `assignees_only` is not explicitly chosen — i.e., the
  control's default state should not invite a coordinator to hand-pick `case_restricted` on an item
  with no case to restrict to (the RPC would reject an inconsistent combination only if it validates
  `case_restricted` requires `case_id` — **confirm during build**: the current RPC does **not**
  cross-validate `p_visibility_scope = 'case_restricted'` against `p_case_id` being non-null, so the
  FE must not offer an invalid combination the DB will silently accept as "restricted to nothing
  readable" — see Open decision, §6).
- Wire `p_case_id` and `p_visibility_scope` through `createMeetingActionItem` /
  `updateMeetingActionItem` in `src/lib/meetings/actions.ts` (already has a `caseId` field in
  `MeetingActionItemInput` per the form's own `input.caseId = item?.caseId ?? null` line — confirm
  the underlying RPC call actually forwards it; the form's comment "Case cross-link is set
  elsewhere" suggests the wiring may be incomplete end-to-end — **backend verifies during build**,
  this is a research note, not a confirmed bug).

### 4.6 `action-items-table.tsx` — visibility badge (low priority, included for parity)

Render a small badge/icon next to `case_restricted` and `assignees_only` rows (self-scoped list —
every row shown is already one the viewer can read, so this is informational, not access-control).
Uses the `visibilityScope` field from §4.3.

### 4.7 Serialization (plan §5, CLAUDE.md §4)

**AI·sat + AI·ui share `action-items-table.tsx` / `case-action-item-form.tsx`** — one phase, one
owner window, per the S0 ratification. Backend's contract-first stub for §4.3's RPC change lands
*before* frontend starts on §4.5/§4.6 so frontend builds against the widened `MyActionItem` type
from the start, not a provisional shape.

## 5. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
|---|---|---|---|
| BE-1 | **Post the §2/§4 contract** as typed stubs (three satellite query modules + the widened `MyActionItem`/`CaseActionItem` types + the RPC signatures below) and commit, unblocking frontend. | — | one-line ack |
| BE-2 | Migration: three satellite tables (§2.2–2.4) + RLS (verbatim `can_read_action_item` reuse) + audit triggers + `HC0I0–HC0I9` mapped in the action layer. | BE-1 | **one-line plan + ack** (X-ε pre-resolved; no new RLS shape) |
| BE-3 | RPCs: the **8** `committee_*` satellite mutators (§2.2–2.4 — reminders 3 · updates 1 (append-only, no update/delete) · checklists 4; the earlier "11" was a miscount, corrected 2026-07-14 at lead ack) — `revoke all … from public` + `grant … to authenticated, service_role` per t19. | BE-2 | one-line ack |
| BE-4 | `list_my_action_items` RPC widening (`visibility_scope` in both UNION arms' `jsonb_build_object`, §4.3) — additive `create or replace`, does not touch the `20260706`/`20260707` migration files. | BE-1 | one-line ack |
| BE-5 | Regen `database.ts` (Rule 8); pgTAP (§7 below); confirm the `meetings/action-item-form.tsx` → `createMeetingActionItem`/`updateMeetingActionItem` → RPC `p_case_id`/`p_visibility_scope` wiring is complete end-to-end (§4.5's flagged research note) before frontend builds the toggle against it. | BE-2..4 | one-line ack |
| BE-6 (deferred, sequenced with N) | Add the reminder `union all` scan arm (§3) to `compute_due_notifications()` — lands **only once N's engine migration exists**; not part of this phase's build. | N ships | one-line ack (additive arm onto an existing engine, per X-ζ) |

## 6. Frontend tasks (`frontend`) — build against the frozen §4 contract

| # | Task | Depends |
|---|---|---|
| FE-1 | Reminder/checklist/updates panels on the action-item detail surface (wherever an item's detail currently renders — case panel, meeting panel, or a new shared detail view if none exists today; **confirm the current mount point during build**, this plan does not re-derive the detail-page inventory). CRUD against the BE-3 RPCs; gated by `action_items` flag (already wired app-wide). | BE-1, BE-3 |
| FE-2 | `meetings/action-item-form.tsx`: `case_id` picker + visibility select (§4.5), wired to the widened `createMeetingActionItem`/`updateMeetingActionItem`. | BE-1, BE-5 |
| FE-3 | `action-items-table.tsx`: visibility badge (§4.6). | BE-4 |
| FE-4 | `case-action-item-form.tsx`: optional static visibility disclosure (§4.4) — skip if the lead prefers scope discipline (Open decision). | BE-1 |
| FE-5 | `npm run lint` + `npm run typecheck` clean; empty/edge states (an item with no reminders/updates/checklist rows yet). | FE-1..4 |

## 7. Tester — acceptance criteria (E2E `chromium` + pgTAP)

1. **`case_restricted` invisibility (existing invariant, regression-guard):** a non-case-reader
   cannot see a `case_restricted` item's title in any list, cannot open its detail, and — **new for
   this plan** — cannot see any of its reminders/updates/checklist rows even via a direct
   RPC/REST probe (the satellite RLS closes the same class of gap ADR 0050 closed for the hub
   itself, now for three more tables).
2. **Coordinator toggles committee ↔ restricted:** on a meeting-sourced item, the coordinator sets
   `case_id` + `visibility_scope = case_restricted` via the new form control; a plain committee
   member (no case access) loses visibility of the item; toggling back to `committee` restores it.
3. **`assignees_only` reachability:** an item set to `assignees_only` is visible to its assignee and
   to staff_admin/org_admin, invisible to a plain committee member who is neither.
4. **Reminder satellite CRUD:** staff_admin creates/toggles/deletes a reminder rule on an item; a
   plain committee member with only `committee`-scope read cannot create one (HC0I0); the rule
   persists correctly (`before_due`/`on_due`/`after_due` × `offset_days` combinations, including the
   CHECK constraint rejecting `on_due` with a non-null offset and vice versa).
5. **Updates-feed CRUD gated to members-with-a-stake:** the assignee posts a progress note
   (succeeds); a committee member with no assignment and `committee`-scope-only tries and is
   rejected (HC0I1) **if** the acceptance intent is "stake required" — **confirm against the Open
   decision in §8** before writing this as a hard assertion, since the authority model here is
   narrower than the read model by design and the tester should verify the *intended* boundary, not
   assume it.
6. **Checklist CRUD gated to members-with-a-stake:** create/toggle/edit/delete a checklist row as
   the assignee (succeeds); as a stakeless committee member (HC0I2 on create/edit/delete — toggle
   inherits the same gate).
7. **`visibility_scope` projected end-to-end:** "Meus itens de ação" reflects the correct scope
   badge for a `case_restricted` vs `committee` vs `assignees_only` row assigned to the test user.
8. **Flag-OFF fallback:** with `action_items` OFF, the satellite RPCs raise `HC000` (feature
   unavailable) exactly like the existing `committee_*` family; no satellite table is reachable via
   REST (RLS still technically permits a read if the row existed, but no row can exist — the hub
   itself is empty/dark, so this is a corollary of the existing hub flag-OFF test, not a new
   assertion).
9. **pgTAP RLS truth-table (per satellite × all three `visibility_scope` values = 9 cells minimum,
   ×3 satellites = 27 assertions):** for each of `action_item_reminders` /
   `action_item_updates` / `action_item_checklists`, and each of `committee`/`case_restricted`/
   `assignees_only` on the parent item, assert: a qualifying reader sees the satellite row; a
   disqualified reader does not. Run on a **fresh reset** (memory
   `pgtap-needs-fresh-reset-vs-e2e-leftovers`).
10. **pgTAP `HC0I0–HC0I2` negative assertions:** each write RPC raises the correct code for an
    unentitled caller (not just "some error").
11. One keyboard-only pass through the new reminder/checklist/update panel (CLAUDE.md §8 a11y).
12. **Full regression** suite green to declare done (§6 gate, `npm run e2e:prod`).

**Reminder→N scan-arm testing is out of scope for this phase's tester pass** — the arm (§3) is
inert until N ships; N's own keystone tests (plan §6: "own-row RLS + idempotent compute +
escalation") cover it once BE-6 (§5) lands the `union all` branch.

## 8. QA scope

Requirements audit vs ADR 0050 + this plan; **RLS review confined to confirming verbatim reuse** —
QA should verify each satellite's SELECT policy is byte-identical in *effect* to
`can_read_action_item(action_item_id, auth.uid())` (no drift, no per-satellite special-casing that
would constitute an undisclosed new RLS shape); confirm CAPA isolation is untouched; confirm the
`list_my_action_items` RPC widening (§4.3) is additive and does not change any existing field's
shape/order for callers that ignore the new key. Verdict to `docs/reviews/`.

## 9. Open decisions (flag for lead/PO call)

1. **`case_restricted` + no `case_id` combination (§4.5).** The `create_committee_action_item` /
   `update_committee_action_item` RPCs do not currently cross-validate
   `p_visibility_scope = 'case_restricted'` against a non-null `p_case_id` for meeting/manual
   sources — `can_read_action_item`'s `case_restricted` branch reads `coalesce(source_case_id,
   case_id)`, so a `case_restricted` meeting item with **both** null would call `can_read_case(null,
   uid)`, which needs to be confirmed fail-closed (returns `false` for everyone but staff_admin/
   org_admin, if those are folded into `can_read_case` — **verify during BE-2/BE-5**, not assumed
   safe by this design doc). If it is fail-closed, this is merely a confusing-but-safe UI state
   (an unreadable-by-design item) and the FE guard in §4.5 is a UX nicety, not a security
   requirement. If it is **not** fail-closed, this is a **security-relevant finding** that would
   need its own one-line plan + lead ack to add the cross-validation to the RPC — **recommend
   backend confirms this in BE-2 before frontend builds §4.5's toggle**, and escalates to the lead
   immediately if the null-case behavior is not fail-closed.
2. **Updates/checklist write authority ("reader-with-a-stake" vs. "any committee reader"), §2.3/§2.4
   §7.5.** This plan chose the narrower "assignee, active assignment, or staff_admin/org_admin" gate
   over "anyone who can `can_read_action_item`" on the theory that a `committee`-scope plain member
   posting notes on someone else's item is noise, not a use case anyone asked for. If product intent
   is actually "any committee member can comment," §2.3/§2.4's RPC authority narrows to just
   `can_read_action_item(...)` and `HC0I1`/`HC0I2` are dropped. **Needs a PO call before BE-3
   implements** — flagged here rather than guessed, since it changes both the RPC body and the
   tester's acceptance assertion (§7.5).
3. **Reminder recipient when the assignee cannot `can_read_case` the item (§3).** A narrow but
   real edge: an `assigned_to` on a `case_restricted` meeting-sourced item who is not themselves a
   case reader would still receive a reminder notification carrying the item's title, once N ships.
   Whether that is acceptable (the assignee already has *some* legitimate stake, per the
   `assignees_only`-style authority this plan already uses elsewhere) or needs an additional
   `can_read_case` filter on the scan arm is **N + AI·sat's joint call when N lands**, not
   resolvable at this design-only gate (the arm does not exist until then).
4. **§4.4's static visibility disclosure on the case-sourced form.** Purely a UX-polish call — does
   not affect any invariant either way. Lead may cut it without reopening this plan. **[RESOLVED
   2026-07-14: INCLUDE it — lead call.]**

5. **[Follow-up, post-pilot — logged 2026-07-14, NOT this phase]** Project `visibility_scope` onto the
   read-side `MeetingActionItem` type (mirrors `CaseActionItem`, §4.2) so the meeting edit form can
   display the item's **true stored** scope instead of the RPC-computed default. §4.5 deliberately
   specs "defaulting to the RPC-computed value", and FE-2 is conformant + safe (edit submits
   `p_visibility_scope` only on explicit change ⇒ `coalesce` keep-current ⇒ no silent clobber of a
   prior override; the true scope is already visible via the FE-3 badge + case-panel surfaces). Adding
   the projection is a display-accuracy nicety only — a small backend query-projection widening + an
   FE default-source swap. Out of scope for a clean AI gate.
