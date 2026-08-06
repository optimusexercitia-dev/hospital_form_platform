# B0 preflight findings — audio minutes (`audio_minutes`)

Resolved **from the live catalog** on the local stack, 2026-08-06, against
[audio-minutes.md](./audio-minutes.md) §B0. Migration registry verified first:
**298 registered == 298 files**, highest `20260909001300`. Reserved window
**`20260910000100`+** stands.

Everything below is a catalog read (`pg_proc`/`prosecdef`, `pg_policies`,
`pg_constraint`, `pg_trigger`, `storage.buckets`), never a migration-file read.
Five items **correct the plan**; they are marked ❗.

---

## 1. The canEdit predicate is `app.is_staff_admin_of(commission_id)` — nothing wider ❗

`public.update_meeting_minutes(p_meeting_id, p_minutes_md)` is **`prosecdef = false`
(SECURITY INVOKER)** — the plan assumed a DEFINER gate. Its body runs:

```
app.assert_meetings_enabled()          -- flag 'meetings'
app.assert_meeting_staff_admin(id)     -- app.is_staff_admin_of(commission) ONLY, else 42501
status in ('scheduled','held')         -- else HC033
```

Because it is INVOKER, the RLS UPDATE policy applies **as well**:

| Gate | Predicate |
| --- | --- |
| `meetings_staff_admin_update` (RLS) | `is_staff_admin_of(c) OR member_can(c,'schedule_meetings')` |
| `assert_meeting_staff_admin` (RPC) | `is_staff_admin_of(c)` |

The effective gate is the **intersection: `app.is_staff_admin_of`**. An
`administrativo` holding `schedule_meetings` can create/update a meeting row but
**cannot edit the ata today** — a live asymmetry between the RLS policy and the
RPC, pre-existing and not introduced here.

Consistency check: every `meeting_agenda_items` write policy is
`app.is_staff_admin_of(app.commission_of_meeting(meeting_id))` — the same
predicate. So one predicate covers the whole apply path.

**Consequences for B1/B2:** `meeting_minutes_jobs` SELECT policy and every RPC
role gate use `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))`.
`administrativo` is deliberately **out** of the audio feature — matching the Ata
editor it hangs off. *(Open question O1 below.)*

For reference, `meetings_select` is
`app.is_member_of(commission_id) AND (visibility_policy = 'commission_default' OR EXISTS(attendee))`
— wider than canEdit, and correctly **not** what the jobs table mirrors. The
agenda-item SELECT uses the helper `app.can_reach_meeting(meeting_id, uid)`.

## 2. Audit action names in the plan violate the `audit_log` CHECK ❗

There is **no enum** of audit kinds. `audit_log` carries
`audit_log_action_shape CHECK (position('.' in action) > 1)` — the vocabulary is
`<entity>.<verb>`, and all 45 live actions follow it (`meeting.created`,
`case_narrative.updated`, …).

The plan's `meeting_minutes_job_created` / `_submitted` / `_cancelled` /
`_applied` **have no dot and would be rejected at write time**. Rename to:

`minutes_job.created` · `.submitted` · `.completed` · `.failed` · `.cancelled` ·
`.applied` · and `minutes_transcript.read` for the door.

Writer: `app.audit_write(p_action, p_entity_type, p_entity_id, p_commission,
p_summary, p_metadata, p_organization, p_hospital)` (DEFINER; derives org+hospital
from the commission; no-ops when the `audit_trail` flag is off).

## 3. The audited-read door is an allowlist in **two** places — and admin-permissive ❗

The house pattern for an audited read is
`public.log_audit_access(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata)`,
which enforces **two** independent registries:

1. a hardcoded `p_action not in (…17 literals…)` allowlist **inside
   `log_audit_access`**, and
2. a `case p_action … else return false` dispatch inside
   **`app._audit_access_authorized(p_action, p_entity_id, p_commission)`**.

Adding `minutes_transcript.read` means editing **both** — the classic
"a new door must inherit every sibling arm" trap; missing either fails closed
with a misleading error.

❗ **`app._audit_access_authorized` returns `true` early for
`app.is_admin()`** (= `platform_admin`). A door that treats "the audit log
accepted my access record" as its authorization would therefore admit a
platform_admin to meeting content — a **noun-rule violation** (meetings are
commission content, ADR 0078 A35).

**Consequence:** `app.read_minutes_transcript(p_job_id)` must gate
**independently and first** (`is_staff_admin_of` + status `done`), and only then
record the access. Recommended shape — a boolean
`app.can_read_minutes_transcript(p_job_id, p_uid)` (no admin arm) referenced by
the new `_audit_access_authorized` arm, with the door checking it directly too.

## 4. `action_items` insert door — call it, don't re-implement (confirmed) + two riders

`public.create_committee_action_item(p_commission, p_source_type, p_meeting_id,
p_agenda_item_id, p_case_id, p_title, p_description, p_assigned_to, p_urgency_id,
p_due_date, p_source_case_phase_id, p_visibility_scope)` — **DEFINER**, all but the
first two defaulted. For `p_source_type = 'meeting'` it enforces:

- flag `action_items` enabled, else `HC000`;
- `app.is_staff_admin_of(p_commission)`, else `42501`;
- `p_meeting_id` not null; title non-blank;
- `p_assigned_to` must satisfy **`app.is_member_of_for(p_commission, p_assigned_to)`**, else `HC021`;
- status resolved via `app.action_item_initial_status(p_commission)` — **null ⇒ raises**;
- `visibility_scope` defaults to `'committee'`; mirrors the assignee into
  `action_item_assignments` as the single active `owner`;
- `created_by := auth.uid()` — resolves correctly when called from inside
  another DEFINER, so `apply_minutes_review` may call it directly.

**Riders for B2/F3:**
- **R1** — if the `action_items` flag is OFF, apply must degrade (skip action
  items with a pt-BR notice + a count in the audit metadata), not abort the
  whole transaction. *(Open question O2 below.)*
- **R2** — the review page's owner select must offer only **commission members**
  (attendees whose `user_id` is a member), or apply dies on `HC021`.

## 5. `app.enqueue_notification` — 10 positional args (B7)

```
(p_user_id uuid, p_commission_id uuid, p_kind text, p_milestone text,
 p_is_reminder boolean, p_entity_type text, p_entity_id uuid,
 p_title text, p_body text, p_dedup_key text)   -- DEFINER
```

## 6. FK posture: `ON DELETE CASCADE` (B0.3 answered)

`meeting_agenda_items.meeting_id` and `meeting_attendees.meeting_id` are both
`REFERENCES meetings(id) ON DELETE CASCADE`; `action_items.source_meeting_id` is
too. **`meeting_minutes_jobs.meeting_id` mirrors it: `ON DELETE CASCADE`.**

⚠ Rider: a cascaded job row takes its `audio_path` with it, orphaning the storage
object. B5's reconciliation cannot find it (no row). Mitigation options — a
`meetings` BEFORE DELETE hook that marks audio for deletion, or a periodic
prefix sweep. Cheapest for v1: the 24 h audio TTL already deletes by path, so
scope the sweep to "objects older than 24 h with no live job".

## 7. Meeting write guards — the `app.in_meeting_rpc` GUC ❗

`guard_meeting_status_trg` (BEFORE, DEFINER) requires
`current_setting('app.in_meeting_rpc') = 'on'` for **every status transition**,
and blocks *content* edits only once the meeting is at `in_signature` or beyond
(rank ≥ 3). `update_meeting_minutes` sets the GUC on and off around its UPDATE.

`apply_minutes_review` writes `minutes_md` on a `held` meeting (rank 2), so it
would pass **without** the GUC — but it must set it anyway to match the house
pattern and stay correct if the rank rule tightens. Triggers fire regardless of
DEFINER, so this is not optional-by-accident.

`guard_meeting_child_lock_agenda_trg` blocks agenda writes at
`in_signature`/`signed`/`distributed`/`cancelled` — harmless given the `held`
guard, but it is why apply must re-check `held` **inside** the transaction.

## 8. Agenda ordering + column names (B2 step 2)

`meeting_agenda_items`: `(meeting_id, position)` is a **DEFERRABLE** unique
constraint, so append-at-`max+1` and any reshuffle inside one statement are fine.
Writable targets are `discussion_notes` and `resolution` — both `text`, nullable.

`meetings` carries `minutes_md`, `held_at`, `held_end`, `scheduled_start`,
`visibility_policy` — D14's `held_at ?? scheduled_start` composer is valid.

## 9. Storage ceilings — the plan's bucket survey is correct

Nine buckets, all `public = false`, all `26214400` (25 MiB) except `form-assets`
at `5242880`; **no bucket allows any audio MIME type**. Nothing is inherited —
`meeting-audio` sets its own values.

`supabase/config.toml` `[storage] file_size_limit = "50MiB"` confirmed at line
118. It is a **global local cap above every bucket** and needs
`supabase stop && supabase start`. The stack is single-owner right now
(`supabase status` up; only this worktree and `main` exist, `main` idle), so the
bump can land with B1 — but it is a committed file, so it applies to every
worktree at once.

## 10. Flag store

`app.feature_flags(key, enabled)`, read via `app.feature_enabled(p_key)` (DEFINER,
`coalesce(…, false)`). The `audio_minutes` row ships with `enabled = false`.

---

## PO decisions — resolved 2026-08-06

- **O1 — `administrativo` is EXCLUDED.** The audio feature mirrors today's Ata
  editor exactly: `app.is_staff_admin_of` and nothing wider. The RLS/RPC
  asymmetry noted in §1 stays as it is — pre-existing, not this feature's to fix.
- **O2 — the `action_items` flag stays ON.** Verified enabled in
  `app.feature_flags` (it is a single global table, not per-tenant), so apply may
  rely on the door succeeding. Rider **R1 is withdrawn**: no degrade path. Its
  `HC000`/`HC021` are still mapped to pt-BR rather than surfaced raw (Rule 10),
  and an assignee failing the member check is downgraded to unassigned rather
  than aborting the apply. **R2 stands** — F3's owner select offers commission
  members only.
- **O3 — 24 h TTL sweep, no delete hook.** B5's reconciliation is extended to
  delete audio objects older than 24 h that have no live job, which covers the
  cascade-orphan case without adding a door to the meetings module.

## Plan edits required before B1 — ✅ all applied 2026-08-06

Landed in [audio-minutes.md](./audio-minutes.md) as a binding "B0 is done" preamble
plus in-place fixes to B1, B2, B7, F3 and the risk list:

1. ✅ canEdit → `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))` (§1).
2. ✅ All audit kinds renamed to dotted form (§2).
3. ✅ B2 transcript-door bullet rewritten for the two-registry + independent-gate
   shape (§3).
4. ✅ `apply_minutes_review` now names `create_committee_action_item` explicitly,
   with the R2 rider carried into F3 (§4).
5. ✅ `app.in_meeting_rpc` wrap added to the `minutes_md` write (§7).
6. ✅ FK pinned to `ON DELETE CASCADE`; orphan-audio handled by O3 (§6).
