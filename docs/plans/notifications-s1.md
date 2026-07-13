# N (Notifications) — S1 build plan (contract-first, one Phase Gate)

**Track:** N · Phase 20 · of the [Pre-Pilot Release Scope Expansion](./pre-pilot-release-scope-expansion.md)
(ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)). **Scope authority:** ADR
[0076](../decisions/0076-notifications-pilot-scope.md) (locked with the PO). **Flag:** `notifications`
(create OFF, flip at gate). **SQLSTATE:** `HC0C·`. **Owner:** `backend` (contract-first) → `frontend` →
`tester` → `qa`.

**One-line scope (ADR 0076):** in-app notification center for **CAPA + Sign-off + Meeting**,
actionable-to-me only, event-driven + time-driven, reminder-only, in-app only. Engine + schema
**kind-agnostic** so email and other surfaces are additive follow-ups.

---

## 1. Backend contract (posted first; `frontend` starts only after the typed stubs land)

### 1.1 Schema — all new; migration window: next free `20260720…` **after SUP's `…000610`**

**`public.notifications`**
| col | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid not null | recipient; **own-row RLS** `user_id = auth.uid()` |
| `commission_id` | uuid **null** | tenant scope (nullable — CAPA is NSP/hospital-scoped); FK `commissions` |
| `kind` | text not null | **surface**: `capa` \| `signoff` \| `meeting` (CHECK). Prefs key on this |
| `milestone` | text not null | `assigned`\|`requested`\|`convoked`\|`due_soon`\|`overdue`\|`still_open`\|`upcoming` (CHECK) |
| `is_reminder` | bool not null | true = time-driven (suppressible + auto-resolvable); false = event-driven assignment |
| `entity_type` | text not null | `capa_action`\|`response_section_signoff`\|`meeting` (deep-link + auto-resolve) |
| `entity_id` | uuid not null | |
| `title` | text not null | **pt-BR snapshot, config-level only — Rule 12** |
| `body` | text null | pt-BR snapshot, config-level only |
| `dedup_key` | text not null | e.g. `capa:{id}:overdue`, `signoff:{id}:2026-W29` |
| `read_at` | timestamptz null | |
| `resolved_at` | timestamptz null | set by auto-resolve |
| `created_at` | timestamptz not null | `now()` |

- **`unique (user_id, dedup_key)`** → idempotency (scan re-run = `ON CONFLICT DO NOTHING`).
- **RLS:** SELECT/UPDATE own-row only. **No authenticated INSERT policy** — every insert flows through
  the DEFINER enqueue helper (the BUG-SUP-002 lesson: a broad authenticated write + a
  security-bearing column = forgeable rows for *other* users; here forging a notification is low-harm
  but the principle holds — DEFINER is the only write door). UPDATE limited to `read_at`. No DELETE policy.

**`public.notification_preferences`**
| col | type | notes |
|---|---|---|
| `user_id` | uuid not null | own-row |
| `surface` | text not null | `capa`\|`signoff`\|`meeting` (CHECK) |
| `reminders_enabled` | bool not null default true | absence of a row = enabled |
| | | `unique (user_id, surface)`; own-row RLS |

### 1.2 RPCs (own-row unless noted; **t19**: `revoke all from public` then `grant execute to authenticated, service_role`)
- `mark_notification_read(p_id uuid)` — own-row set `read_at`; `HC0C1` if not found/owned.
- `mark_all_notifications_read()` — own unread → read.
- `set_notification_preferences(p_surface text, p_enabled boolean)` — upsert own row; `HC0C0` invalid surface.
- `compute_due_notifications()` — **DEFINER batch**. Scans the 3 sources (below), enqueues via the
  internal helper with dedup, **skipping reminder enqueue where the recipient disabled that surface**.
  Idempotent. Returns a count (for tests). *No* `pg_cron` job in this plan — schedule wired at deploy.

**Internal (DEFINER, not public):**
- `app.enqueue_notification(user, commission, kind, milestone, is_reminder, entity_type, entity_id, title, body, dedup_key)` — the single write door; `ON CONFLICT (user_id, dedup_key) DO NOTHING`. Used by the scan **and** the event-driven source mutations.
- `app.resolve_notifications_for(p_entity_type text, p_entity_id uuid)` — set `resolved_at` on unresolved **reminders** for that entity.

### 1.3 Event-driven enqueue — wired into existing mutations (backend edits, confirm exact hook points)
| Surface | Source mutation | Enqueue |
|---|---|---|
| CAPA | action assignment | `capa`/`assigned` → assignee (non-suppressible) |
| Sign-off | section becomes awaiting-sign-off (on submit, per required signoff role) | `signoff`/`requested` → each authorized signer |
| Meeting | convocation | `meeting`/`convoked` → each convoked attendee |

### 1.4 Time-driven scan sources (`compute_due_notifications`) — CAPA + Sign-off + Meeting only
| Surface | Source (confirm exact fn/cols in contract-first) | Milestones |
|---|---|---|
| CAPA | `capa_action.due_date` + open status (cf. `overdue_actions`) | `due_soon` (≤3d) · `overdue` · `still_open` (weekly ISO bucket while overdue) |
| Sign-off | pending sign-off queue (cf. `list_signoff_queue`, `my_pending_meeting_signatures`) | `pending` (≥3d) · `still_open` (weekly) |
| Meeting | scheduled meeting date = tomorrow | `upcoming` |

### 1.5 Auto-resolve wiring — `app.resolve_notifications_for` called from
CAPA-close · sign-off-sign · meeting-conclude mutations (assignments are **not** resolved).

### 1.6 Flag + types
- Migration inserts `notifications` flag **OFF**; **separate one-line migration flips ON at gate**;
  `seed.sql` forces ON for local/E2E.
- `src/lib/queries/feature-flags.ts`: add `notifications` (21st key) + `notificationsEnabled()` wrapper.
- `src/lib/queries/notifications.ts`: `listNotifications`, `getUnreadCount`, `markRead`, `markAllRead`,
  `getPreferences`, `setPreference` — typed stubs posted **first** (the FE contract).
- `routing.ts`: `notificationHref(entity_type, entity_id, commission?)` resolver.
- Regen `database.ts` after the migration (Rule 8).

## 2. Frontend surface (starts after §1 stubs land)
- **Bell + unread badge** in the app-shell header (near `UserMenu`); count **server-rendered on
  navigation** (no Realtime, no poll). Flag-gated.
- **Notification center** — list (title, body, relative time, read/unread), **mark-all-read**, each item
  **click-throughs** to `notificationHref(...)` and marks itself read.
- **Preferences panel** — 3 reminder toggles (CAPA/sign-off/meeting) in a per-user settings surface.
- pt-BR throughout; accessible (labels, focus, keyboard); reduced-motion-safe per the design system.

## 3. Test pass (`tester`)
**E2E** (`e2e/notifications.spec.ts`; new personas may be needed for a clean assignee):
- Event-driven: assign a CAPA action → assignee's badge +1; click → lands on the action; other users unaffected.
- Time-driven: seed an overdue CAPA action → call `compute_due_notifications` → owner gets `overdue`;
  **call again → no duplicate** (idempotency).
- Preferences: disable CAPA reminders → scan enqueues **no** CAPA reminder for that user, **but** a CAPA
  *assignment* still notifies (non-suppressible).
- Auto-resolve: complete the action → its reminder clears from the badge.
- Read model: mark-read clears the badge; mark-all-read; per-item read persists across reload.
- Isolation: a user sees only their own notifications.
- One **keyboard-only** pass (center + preferences).
- Flag-OFF: no bell renders.

**pgTAP** (`NNN_notifications.sql`): own-row RLS (notifications + preferences); **no authenticated direct
INSERT** into notifications; `compute_due_notifications` selects exactly the due set + idempotent
`ON CONFLICT`; `set_notification_preferences` own-row + `HC0C0`; **t19** grants on all new public RPCs.

## 4. QA focus (`qa`)
- **Rule 12:** title/body sourced *only* from config columns — no answer/event/patient field can reach a
  body (trace every `enqueue_notification` call site).
- **Rule 1:** own-row RLS airtight; the **DEFINER-only write door** holds (no INSERT policy leak — the
  BUG-SUP-002 pattern check).
- **Flag-OFF** byte-for-byte fallback (no bell, no scan effect).
- Idempotency + auto-resolve correctness; `HC0C·` → pt-BR mapping (Rule 10).

## 5. Sequencing & ownership
- **Contract-first:** `backend` posts §1.6 typed stubs + the migration before `frontend` starts.
- **File ownership:** `backend` owns all of §1 + `queries/notifications.ts` + `routing.ts` addition +
  the enqueue edits in CAPA/sign-off/meeting mutations. `frontend` owns §2 (shell bell, center,
  settings). No shared-file overlap (shared types via `backend` only). MEM/SUP are done — no live
  contention on `session.ts`/`responses`.
- **Gate:** CLAUDE.md §6 — build → tester green (incl. `npm run e2e:prod` parity) → QA `APPROVED` →
  human approval → Record (flip flag ON, `backend-state.md`, `graphify update`, PROGRESS).
