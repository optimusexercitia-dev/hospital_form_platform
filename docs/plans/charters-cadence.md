# Committee Charters & Meeting Cadence (S4·CH) — build plan

**Status:** PLANNED (design ratified 2026-07-20; not implemented). **Date:** 2026-07-20 ·
**Owner:** platform lead → `backend` (contract-first) → `frontend` → `tester` → `qa`.
**Implements:** ADR [0080](../decisions/0080-committee-charters-cadence-model.md) (charter model) ·
track **CH** of the [Pre-Pilot Release Scope Expansion](./pre-pilot-release-scope-expansion.md) (ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md)); source spec: accreditation-track §21
(**superseded** where it drifts — see §1).
**Posture:** pre-pilot, reset-OK, forward-only, dark behind flag `charters`. One Phase Gate (CLAUDE.md §6).
**No PHI (Rule 12).**

---

## 0. Scope

**In:** a per-commission **charter** = a meeting-frequency setting + an optional link to the commission's
**regimento controlled document** (Phase-17); a computed **cadence-adherence** status; an agenda/action
**carry-forward** suggestion at meeting scheduling; a **cadence-overdue** reminder arm on N; the
`manage/charter` page + a meetings-list cadence indicator + a schedule-flow carry-forward step.

**Out (deferred, additive — ADR 0080 Consequences):** regimento **review-due** reminder (future generic
docs-review N arm); a **stricter never-met** cadence variant; **email** delivery; any change to the
controlled-doc lifecycle, quorum (`commission_meeting_settings`), or the `meetings` schema (CH is
**read-only** on `meetings`).

## 1. Catalog reconciliation (spec §21 is stale — use these, verified 2026-07-20)

| §21 text | Live catalog truth | Used by |
|---|---|---|
| "last **`realizada`** meeting" | status key is **`held`**; use `held_at IS NOT NULL` (robust across held→signed→distributed) | cadence |
| "commission_default **plenary**" (implied meeting-type) | **`meetings.visibility_policy='commission_default'`** (excludes `participants_only` hearings) | cadence, carry-forward |
| "**deferred** agenda items" | no such flag — derive as `meeting_agenda_items.resolution IS NULL` on the last held meeting | carry-forward |
| "open **`meeting_action_items`**" | folded into the **`action_items` hub** (`source_type='meeting'`, `source_meeting_id`); open = non-terminal `action_item_statuses.is_terminal=false` | carry-forward |
| charter carries markdown + own dates | regimento content/dates live on the **controlled document** (file `storage_path` + version dates); `doc_type='regimento'` already allowed | schema |
| review reminders "for free" | `compute_due_notifications()` has **no** docs/review/cadence arm (`has_document=0`) — the cadence arm is net-new | N |

> ⛔ **Binding (CLAUDE.md graphify exception):** every predicate/RPC/policy name below is a
> **design intent** — `backend` re-verifies each against the **live catalog** at build time (the MEM
> §6.1 collapse renamed the `is_*_of` family to `has_role()` shims; use the current names).

## 2. Schema (migration `20260818000000` — after the latest shipped `20260817002200`)

```sql
create table public.commission_charters (
  commission_id          uuid primary key references public.commissions(id) on delete cascade,
  meeting_frequency      text not null
                           check (meeting_frequency in
                             ('semanal','quinzenal','mensal','bimestral','trimestral')),
  controlled_document_id uuid references public.controlled_documents(id) on delete set null,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()   -- D10 touch trigger
);
```

- **1:1 per commission** (PK). `sem_regimento` = no row. `controlled_document_id` nullable (a commission
  may set a cadence before it has a ratified regimento). The **RPC** (not a CHECK — cross-table)
  enforces the linked doc is same-commission + `doc_type='regimento'` (HC0K1).
- **RLS:** enable; **SELECT** policy `app.is_member_of(commission_id)` (member read). **No authenticated
  INSERT/UPDATE/DELETE policy** — sole write door is the DEFINER `upsert_commission_charter` (ADR
  0078/0079 posture: no authenticated write path). Foreign-commission → no read.
- **Audit (Rule 11):** register `charter.upserted` in the mutation audit allow-list; emit via
  `app.audit_write` (config-level metadata only — commission + who; no payload).
- **Flag:** insert `charters` OFF in this migration; `seed.sql` forces ON for local/E2E; **no
  prod-enabling migration** (prod OFF till pilot). Add to `src/lib/queries/feature-flags.ts`.

## 3. Typed contract (`backend` posts stubs first — contract-first)

**RPCs** (all `public`, `SECURITY DEFINER`, t19 `revoke all from public` + `grant execute to
authenticated, service_role`; SQLSTATE `HC0K·`):

| RPC | Authority | Returns / effect |
|---|---|---|
| `upsert_commission_charter(p_commission, p_meeting_frequency, p_controlled_document_id default null)` | staff_admin of commission (else **HC0K0**); valid regimento link or **HC0K1** | upsert the row; audit `charter.upserted` |
| `meeting_cadence_status(p_commission)` | member of commission (else **HC0K2** — denies org users, ADR 0078 A8) | `{status, last_held_at, meeting_frequency}` — status ∈ `em_dia`/`em_atraso`/`sem_reunioes`/`sem_regimento` |
| `suggest_carry_forward(p_commission)` | member of commission (else **HC0K2**) | `{agenda_items:[{title,description,source_meeting_id}], action_items:[{id,title,status,due_date}]}` — read-only, confidentiality-filtered |

**Data access** (`src/lib/queries/charters.ts`): `getCharter(commission)`,
`upsertCharter(commission, frequency, docId?)`, `getMeetingCadenceStatus(commission)`,
`getCarryForwardSuggestions(commission)`; pt-BR mapping for `HC0K·`; `chartersEnabled()` in
`feature-flags.ts`. (No inline supabase-js — Rule 9.)

## 4. Cadence semantics (`meeting_cadence_status`, migration `20260818000100`)

```
window := case p_meeting_frequency
  when 'semanal'    then interval '1 week'
  when 'quinzenal'  then interval '2 weeks'
  when 'mensal'     then interval '1 month'
  when 'bimestral'  then interval '2 months'
  when 'trimestral' then interval '3 months' end
last_held := max(m.held_at)  where m.commission_id = p_commission
                               and m.held_at is not null
                               and m.visibility_policy = 'commission_default'
status := no charter row              → 'sem_regimento'
          else last_held is null      → 'sem_reunioes'      (neutral — never-met)
          else now() - last_held <= window → 'em_dia'
          else                        → 'em_atraso'
```
DEFINER over base tables (not RLS-filtered) so the indicator is consistent regardless of the caller's
meeting visibility; **member-scoped** entry check (HC0K2). Compliant boundary **inclusive**.

## 5. Carry-forward semantics (`suggest_carry_forward`, migration `20260818000100`)

- **Agenda list:** `meeting_agenda_items` where `resolution IS NULL` from the commission's **most-recent
  `held` `commission_default`** meeting (title/description + `source_meeting_id`).
- **Action list:** `action_items` where `source_type='meeting'`, meeting ∈ the commission's
  `commission_default` meetings, status **non-terminal** — each passed through
  `app.can_read_action_item(item, auth.uid())` so `case_restricted`/hearing items never surface.
- **Pure read.** The FE copies ticked agenda items forward via the **existing**
  `create_meeting_agenda_item` (new rows on the new meeting; originals untouched); action items are shown
  read-only ("ainda em aberto") — never duplicated or re-linked.

## 6. Notifications — cadence-overdue arm (migration `20260818000200`)

- `app.compute_due_charter_notifications()` helper, called from `public.compute_due_notifications`
  (mirrors `app.compute_due_ethics_notifications`); **gated on `feature_enabled('charters')`**.
- For each commission whose cadence = `em_atraso`: recipient = each **`staff_admin`** of the commission;
  `kind='charter'`, `entity_type='commission'`, `entity_id=commission_id`, `milestone='overdue'`,
  `is_reminder=true`; **weekly-bucketed** dedup `charter_cadence:{commission_id}:{IYYY-IW}` (idempotent);
  `title`/`body` pt-BR **PHI-free** (commission name + fixed string). Widen `notifications` `kind` CHECK
  `+= 'charter'` and `entity_type` CHECK `+= 'commission'`. Href → the commission's meetings list.

## 7. UI (`frontend`; `frontend-design` skill first)

- **`manage/charter`** ("Regimento & Cadência"): the meeting-frequency setting (`upsertCharter`); the
  linked regimento — **link-existing** (`doc_type='regimento'` picker) or **create-new** (hand off to
  the shipped controlled-doc create/upload flow, `doc_type` pre-filled); the live cadence status badge.
- **Meetings list:** a cadence indicator ("em dia" / "reunião em atraso" / neutral) sourced from
  `getMeetingCadenceStatus` (the RPC, not the visible-meeting list).
- **Schedule-meeting flow:** a carry-forward step showing the two lists with checkboxes; ticked agenda
  items are created on the new meeting.
- pt-BR, accessible (labels, keyboard, visible focus); one keyboard-only path.

## 8. Serialization & deploy

- **No concurrent-file collisions:** S4's other tracks are complete; CH owns `commission_charters*`,
  `charters.ts`, the `manage/charter` route; edits `compute_due_notifications` (single active editor) +
  the meetings-list/schedule-flow FE (single owner = `frontend`). CH is **read-only on `meetings`** and
  only FK-references controlled docs.
- Local-first (`supabase migration up`), regen types after every migration; remote `db push` is
  **user-authorized** at the track's deploy. ⚠ **Verify true remote deploy state first** — the live
  catalog already carries S1–S4 notification kinds, which contradicts the "remote deferred to pilot"
  note (memory).

## 9. Acceptance (reconciled — supersedes §21 AC)

**pgTAP** (`supabase/tests/…_charters.sql`, fresh reset): `commission_charters` RLS (member reads;
non-member + foreign-commission denied); `upsert_commission_charter` authority (staff_admin ok /
member HC0K0) + link validation (HC0K1) + one `charter.upserted` audit row; `meeting_cadence_status`
across **all 5 frequencies × 4 states** (seeded dates), **excludes `participants_only`**, member-scope
deny (HC0K2), computed over full data; `suggest_carry_forward` returns unresolved agenda + open action
items, **confidentiality filter** (a `case_restricted` item absent both directions), member-scope; N
arm: `em_atraso` → staff_admins get exactly one reminder, **idempotent** on re-run, PHI-free body,
`em_dia` → none; **flag-OFF** → RPCs HC000 + no bell arm.

**E2E** (`e2e/charters-cadence.spec.ts`, prod-standalone): define a monthly charter → indicator
**compliant** vs a recent held meeting, **em atraso** when stale (seeded dates); schedule a meeting →
carry-forward suggests + copies ticked agenda items, confidential ones absent; charter renders the
linked regimento as a controlled doc with a review-due date; charter edit audited; foreign-commission
user gets no read; one keyboard-only pass.

## 10. Task breakdown (contract-first; one Phase Gate)

| # | Task | Owner |
|---|------|-------|
| CH-BE-1 | Post the §3 typed contract (`charters.ts` stubs + types + `feature-flags.charters`); commit early | backend |
| CH-BE-2 | Mig `…000000`: `commission_charters` + RLS (member-read, no write policy) + `charters` flag OFF + touch trigger + `charter.upserted` audit verb; pgTAP RLS | backend |
| CH-BE-3 | Mig `…000100`: `upsert_commission_charter` / `meeting_cadence_status` / `suggest_carry_forward` (t19); pgTAP cadence×freq×state + carry-forward + authority | backend |
| CH-BE-4 | Mig `…000200`: `compute_due_charter_notifications` arm + CHECK widening + aggregator call; pgTAP idempotent + recipient + PHI-free | backend |
| CH-BE-5 | `charters.ts` impl + regen types + seed (charter rows, a published regimento doc, seeded meeting dates spanning the 4 states) | backend |
| CH-FE-1 | `manage/charter` page (frequency + regimento link/create + cadence badge) | frontend |
| CH-FE-2 | Meetings-list cadence indicator + schedule-flow carry-forward step | frontend |
| CH-TEST | `e2e/charters-cadence.spec.ts` (§9) + one keyboard flow | tester |
| CH-QA | Requirements + RLS conformance (`set local role`, not "revert the predicate") | qa |
| Record | PROGRESS + `backend-state.md` + reconcile accreditation-track §21 + graphify `update .` + `phase(CH): complete` | lead |

## 11. Risks / open decisions

1. **Predicate names post-MEM** — verify `is_member_of` / `is_staff_admin_of` / `can_read_action_item`
   shim names against the catalog before writing policies/RPCs.
2. **Remote deploy state** — reconcile the "S1–S4 deferred to pilot" note against the observed catalog
   (S1–S4 kinds present) before the Record/deploy step.
3. **Never-met strictness** — first cut is neutral (`sem_reunioes`); if the pilot wants declared-but-never-
   convened committees flagged, add the effective-date-anchored `em_atraso` variant (deferred, additive).
4. **Regimento authoring weight** — a commission needs a controlled-doc file + approval to have a
   regimento; confirm the pilot is comfortable seeding/authoring one (else revisit ADR 0080 D1/D2).
