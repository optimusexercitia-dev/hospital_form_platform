# QA Review — Meeting actual-occurrence time (`held_at` / `held_end`)

**Feature / branch:** `feat/meeting-held-time` (Phase-10 Meetings) · **ADR:** [0062](../decisions/0062-meeting-actual-occurrence-time.md)
**Reviewer:** `qa` · **Date:** 2026-07-08
**Migration under review:** `supabase/migrations/20260715000100_meeting_held_time.sql`
**Verdict:** ✅ **APPROVED** (2 MINOR observations, non-blocking)

---

## Scope

Audited the `held_at`/`held_end` occurrence-window feature against CLAUDE.md,
ARCHITECTURE.md (Rules 1 / 10 / 11 / 12), and ADR 0062. Read-only on app code.
Verified: the migration (3 RPCs, columns, audit trigger), the query/type layer
(`src/lib/queries/meetings.ts`), server actions (`src/lib/meetings/actions.ts`),
the pt-BR catalog (`messages.ts`), and the four FE components
(`held-window-fields.tsx`, `meeting-held-edit.tsx`, `meeting-header.tsx`,
`meeting-lifecycle-actions.tsx`).

Beyond static review, I verified the applied schema against the **live local DB**
(function security flags, owner, `search_path`, and ACLs) — see Evidence below.

---

## Findings by focus area

### 1. Authz / RLS on `set_meeting_held_window` — PASS

- staff_admin gate is delegated to `app.assert_meeting_staff_admin(p_meeting_id)`
  (baseline `:711`), which resolves the commission and raises `42501` unless the
  caller `is_staff_admin_of` / `is_org_admin_of_commission`. Not a bespoke,
  bypassable check. pgTAP `206:88-92` asserts a plain `staff` gets `42501`.
- **`realizada`-ONLY gate (HC083)** is enforced *inside* the RPC
  (migration `:266-269`) BEFORE the write, so a concluded/frozen meeting
  (`em_assinatura`+) cannot be edited without `reopen_meeting` — the product
  decision. pgTAP `206:139-141` proves the `em_assinatura` rejection.
- **No-overwrite invariant holds.** The UPDATE sets exactly
  `held_at, held_end, updated_at` (`:281-283`) — never `scheduled_start`/
  `scheduled_end` or any status column. pgTAP `206:104-107` asserts
  `scheduled_start` is untouched after an edit. The RPC cannot be abused to
  mutate other columns (it is a fixed UPDATE list, not a dynamic one) nor to
  bypass the state machine (it makes no status change; HC083 blocks off-state
  entry first).
- Defense-in-depth on the guard: `set_meeting_held_window` sets
  `app.in_meeting_rpc='on'`, under which `app.guard_meeting_status()`
  (baseline `:2767`) permits any non-status field edit — but the RPC's own HC083
  check is the authority that keeps a locked meeting immutable. Correct layering.
- Server action `setMeetingHeldWindow` (`actions.ts:377`) additionally re-checks
  `meetingsEnabled()` + `authorizeCommission` for a clean pt-BR forbidden, mirroring
  the rest of the meetings actions. RLS remains the true boundary (the RPC gate),
  not the UI.

### 2. `SECURITY DEFINER` hygiene — PASS (live-verified)

Confirmed against the running local DB (`pg_proc`) for **all three** RPCs:

| function | sec_def | owner | search_path | ACL |
|---|---|---|---|---|
| `mark_meeting_held` | `f` | postgres | `app, public, pg_catalog` | authenticated=X, service_role=X, postgres=X |
| `conclude_meeting` | `t` | postgres | `app, public, pg_catalog` | authenticated=X, service_role=X, postgres=X |
| `set_meeting_held_window` | `f` | postgres | `app, public, pg_catalog` | authenticated=X, service_role=X, postgres=X |

- **No PUBLIC execute** on any of the three — the `REVOKE ALL … FROM PUBLIC`
  after the DROP-then-recreate landed. A dropped function drops its grants; the
  migration re-established `authenticated`+`service_role` on each (`:87-89`,
  `:237-239`, `:291-293`). Verified nothing was left ungranted or PUBLIC-executable.
- `search_path` is pinned on every new/recreated function (migration `set search_path`
  clauses; live `proconfig` confirms).
- **SECURITY property preserved across the recreate:** baseline
  `mark_meeting_held` was NOT `security definer` (baseline `:12010`) and the recreate
  is likewise plain `plpgsql`; baseline `conclude_meeting` WAS `security definer`
  (baseline `:8536`) and the recreate keeps it (`:99`). No accidental privilege
  change. `conclude_meeting`'s DEFINER internal gate (`:120-124`) is intact.
- **No ambiguous overloads.** Only the widened 3-arg signature exists for each
  RPC (live `pg_get_function_identity_arguments`); the DROP removed the old 1-arg
  form, so PostgREST resolution is unambiguous and the FE's legacy 1-arg call still
  resolves via the null-defaulted params.

### 3. Validation — PASS

- HC081 (`held_end < held_at`) and HC082 (`held_at > now()`) are enforced in **all
  three** RPCs: `mark_meeting_held` `:67-74`, `conclude_meeting` `:137-144`,
  `set_meeting_held_window` `:271-278`. pt-BR messages, `HC0xx` errcodes.
- Null `held_at` is allowed at the transition (allow-null, fill-later): the guards
  are `p_held_at is not null and …`, and pgTAP `206:178-183` proves a null-held
  conclude still flips to `em_assinatura`.

### 4. Audit (Rule 11) — PASS

- `app.trg_audit_meetings()` recreated with **independent** branches (converted
  the baseline `elsif` to standalone `if`s), so a single UPDATE that both flips
  status and sets the window emits BOTH `meeting.status_changed` and
  `meeting.held_changed` (migration `:318-329`) — ADR 0062 decision 5. `is distinct
  from` guards prevent spurious rows. pgTAP `206:113-120` asserts both, including
  a second `held_changed` on the later edit.
- **No payload/PHI leak.** The diff is built by `app.audit_diff(old, new,
  array['held_at','held_end'])` (baseline `:997`), which projects ONLY the two
  named columns. `minutes_md` (the PHI-adjacent field) is never in any projected
  column list, so it cannot enter the log. `held_*` are plain timestamps, not PHI
  (Rule 12) — acceptable in the diff.
- Baseline INSERT + status branches preserved; the INSERT branch still returns
  early, so INSERT never double-audits.

### 5. Error surfacing (Rule 10 / §8) — PASS

- `mapMeetingError` (`messages.ts:155-160`) maps HC081/HC082/HC083 to pt-BR,
  preferring the RPC's own pt-BR `message` and falling back to the catalog;
  the `default` branch degrades to a generic pt-BR string, so no raw Postgres
  text can reach the UI.
- The future-schedule blank default is sound: `useHeldWindowState`
  (`held-window-fields.tsx:57-61`) defaults `held_at` to BLANK when
  `scheduled_start` is in the future, avoiding a pre-filled value that HC082 would
  reject; blank → `null` (allow-null). Divergence hint (F4) is UX-only and correctly
  wired into `aria-describedby`.

### 6. Immutability — PASS

- The DROP-recreate of `conclude_meeting` preserved the full body: the DEFINER
  staff_admin gate, quorum math, the `agendada→realizada→em_assinatura` two-step
  under the `app.in_meeting_rpc` flag, the per-linked-case `case_events` write, and
  crucially **`concluded_at = now()` is unchanged** (`:199`) — `held_at` is a
  distinct concept sourced from the parameter. pgTAP `206:161-167` asserts
  `held_at <> concluded_at`.
- `mark_meeting_held` body preserved (HC033 status gate, flag wrapping) with only
  the window params + validation + UPDATE columns added.

---

## MINOR observations (non-blocking; no change required to approve)

- **MINOR-1 — dangling `held_end` with null `held_at`.** In all three RPCs the
  range check is `p_held_end is not null AND p_held_at is not null AND
  p_held_end < p_held_at`. If a caller sends `held_at = null` but a non-null
  `held_end`, no validation fires and a `held_end`-only row is stored (a "duration"
  with no start). The current FE cannot produce this — `useHeldWindowState`
  blanks the end whenever the start is blank (`:61`) — so it is not reachable
  today, but the RPC contract permits a semantically meaningless row. If cheap,
  consider rejecting `p_held_end is not null and p_held_at is null` (or coercing
  `held_end := null`). Purely defensive; leave to product's discretion.

- **MINOR-2 — `any`-adjacent cast in the args builder.** `heldArgs`
  (`actions.ts:301-312`) and `setMeetingHeldWindow` (`:399-400`) cast
  `null` through `as string | undefined` to force an explicit JSON `null` past the
  generated Args type (which models the params as required `string`). The cast is
  well-contained and documented with a clear justification comment (supabase-js
  does not emit nullable RPC params), and it keeps `p_meeting_id` correctly typed.
  Acceptable under §8; noted only so a future types regen that fixes the underlying
  nullability can remove it. No `any` is introduced.

---

## Cross-checks / hygiene

- Query layer: `heldAt`/`heldEnd` added to `MeetingDetail` (`meetings.ts:130-132`),
  the detail `select` (`:630`), and the row mapper (`:655-656`) — types flow through
  `src/lib/queries/`. Data access stays centralized (Rule 9).
- a11y (§8): labelled `DateTimePicker`s with `htmlFor`/`id`, `aria-describedby`
  wiring the help + divergence hint, `role="alert"` on inline errors, keyboard-
  operable dialogs. All copy pt-BR (Rule 10). ADR 0062 present and accurate.
- Not touched: `scheduled_*`, `minutes_md`, `concluded_at` semantics — invariants intact.

## Note on out-of-scope failures (per handoff — not attributable to this feature)

- pgTAP `206_meeting_held_time.sql` could not be re-run in-place here because the
  local DB is in E2E-mutated state and lacks the pgTAP `plan()` provisioning of a
  fresh reset (known: "pgTAP needs fresh reset vs E2E leftovers"). The tester
  reported **19/19 on a fresh reset**, and the static SQL audit + live schema/grant
  verification independently confirm the behavior the test asserts.
- The 4 unrelated E2E specs (administrativo, case-access, case-phase-result,
  hospital-departments) and 2 pgTAP tests (90_cases t33, 184 t15) are PRE-EXISTING
  branch failures outside this feature's surface; not caused by `held_at` work.

---

## Verdict

**APPROVED.** All six focus areas pass. The authz gate, the `realizada`-only edit
window, the no-schedule-overwrite invariant, DEFINER hygiene (live-verified: owner,
pinned `search_path`, no PUBLIC execute, no dangling overloads), server-side
validation in all three RPCs, the non-leaking audit diff, and pt-BR error surfacing
are all correct, and the DROP-recreate preserved every prior body invariant. The two
MINOR observations are defensive and unreachable from the current UI; they do not
block the gate.
