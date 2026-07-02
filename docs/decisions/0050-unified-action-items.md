# 0050 — Unified (non-PHI) action_items hub

Status: Accepted — 2026-07-02

## Context

Action items existed as three divergent tables — `case_action_items`,
`meeting_action_items`, and the PHI-bearing `capa_action`(+`capa_action_task`) —
with ~9 near-duplicate RPCs, four query files, and EN/PT status drift. Meetings and
Cases (and future sources) need action items, and the duplication was set to grow.
A partner team shared a mature hub-and-spoke `action_items` model (one core table +
satellites for assignments, status/urgency lookups, history, updates, evidence,
reviews, follow-ups, checklists, dependencies, templates, custom fields, reminders).
We evaluated adopting it. Its one load-bearing assumption — a single `action_items`
table under flat *committee-membership* RLS — is precisely where this platform is
hardest: Cases gate on per-case attribution (`can_read_case`, not membership) and
CAPA is PHI-bearing under NSP custody (Rule 12). No users exist yet, so a clean
drop-and-recreate is allowed.

## Decision

**Option A — adopt the partner model's *shape*, redraw the *boundary*.** Build one
shared, **non-PHI** `action_items` hub for the membership-gated sources, adapted to
this platform:

- **Right-sized core (5 tables):** `action_items` + `action_item_statuses` /
  `action_item_urgency_levels` (configurable, nullable `commission_id`, normalized
  `category`, seeded global defaults) + `action_item_assignments` (multi-role, one
  active `owner` via a partial unique index, mirroring `assigned_to`) +
  `action_item_status_history`. Heavier satellites (updates feed, related_records,
  evidence, reviews, follow-ups, checklists, dependencies, templates, custom fields,
  reminders) are **deferred** until a feature needs them.
- **Sources = `meeting` + `manual`** via `source_type`; a new source is a value, not
  a new table. Migrated `meeting_action_items` in and dropped it (+ its RPCs).
- **Adaptations:** identity is `auth.uid()`/`profiles` (not `committee_member_id`);
  `commission_id` is the tenancy anchor; hard-delete-with-audit (no `deleted_at`);
  RLS enabled on all 5 tables with **flat membership** on the hub (byte-identical to
  the old `meeting_action_items` policies); writes funnel through `SECURITY DEFINER`
  `committee_*` RPCs (`REVOKE ALL FROM PUBLIC` → `GRANT`, t19); audit via
  `action_item.*` rows (Rule 11 — the old table had none); status keys kept as
  `open/in_progress/done/cancelled` so existing UI label maps are unchanged.
- **Cases stay in `case_action_items`** — they fold into the hub later as a
  deliberate step behind a `source_type='case'` RLS dispatch to `can_read_case` and
  an indexed load-bearing `access_case_id`.
- **CAPA stays isolated** (`capa_action`/`capa_action_task`) — PHI, Rule 12; the
  bridge is *escalation* of a lightweight item into a CAPA, not a shared table.

## Alternatives

- *Wholesale adopt the partner model (one table for everything).* Rejected: flat
  committee RLS over-exposes Cases, and folding PHI-bearing CAPA into a shared table
  violates Rule 12 isolation.
- *Unify Cases now too.* Deferred: correct, but requires source-dispatched RLS + an
  indexed `access_case_id` + a branched transition RPC — the real security-proof work
  belongs in its own migration, not day one of a new table.
- *Keep three silos.* Rejected: the duplication was the problem.

## Consequences

- One table / one RLS surface / one RPC set for committee to-dos; new non-PHI sources
  plug in with zero schema change. The two hardest access models (per-case, PHI) are
  untouched.
- QA APPROVED (RLS verified live; see `docs/reviews/shared-action-items-review.md`);
  feature tests green (pgTAP 1331, targeted E2E). RPC names carry a `committee_`
  infix to avoid colliding with the case module's `create_action_item` — reconcile
  when Cases fold in.
- Full-suite E2E green is deferred to a clean CI env; the local red was traced to
  pre-existing/environmental causes unrelated to this change.
