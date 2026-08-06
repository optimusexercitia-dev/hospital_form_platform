# UI design brief — audio minutes (F1–F5)

**Author:** frontend · **Date:** 2026-08-06 · **Status:** design-only, no `src/**` changes this turn.
**Reads bound:** [audio-minutes.md](../plans/audio-minutes.md) §F1–F5 (binding task list, "B0 is
done" preamble) · [audio-minutes-b0-findings.md](../plans/audio-minutes-b0-findings.md) §4 R2 ·
ADR [0099](../decisions/0099-meeting-audio-minutes.md) D1/D3/D11/D12/D13 · the `frontend-design`
skill ("Clinical Calm").

This document has two jobs: (1) it is the plan for F1–F5 once B5 lands, precise enough to build
against without re-deriving anything; (2) §3 is the **contract** — the exact `src/lib/minutes-jobs/`
surface the frontend needs, handed to `backend` to implement B5 against. Where this brief and the
eventual B5 signatures disagree, B5's real signatures win (mirrors the plan's own "not
authoritative on substrate" posture) — but a disagreement should come back to this doc as a
correction, not a silent drift, because T2's draft-normalizer test and F3's whole review tree are
written against §3.2's `MinutesDraft` shape.

---

## 1. Survey of what exists

### 1.1 The Ata editor — `src/components/meetings/meeting-minutes-editor.tsx`

Already read in full. Structure relevant to F1:

```tsx
<section aria-labelledby="meeting-minutes-heading" className="... rounded-2xl border ... p-5 shadow-xs">
  <div className="flex flex-wrap items-center justify-between gap-3">   {/* the header row */}
    <div className="flex items-center gap-2">                          {/* left: icon + h2 + Bloqueada chip */}
      <FileText .../> <h2 id="meeting-minutes-heading">Ata</h2>
      {!canEdit && <span>…Bloqueada</span>}
    </div>
    {canEdit && <Button onClick={handleSave} disabled={isPending || !dirty}>Salvar ata</Button>}  {/* right */}
  </div>
  {/* error/saved banners, then the editor or read-only render */}
</section>
```

**F1's slot attaches inside that first header `div`, as a sibling of the existing right-aligned
`<Button>`** — i.e. the header's `justify-between` row gets a second right-side element:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <div className="flex items-center gap-2">…</div>
  <div className="flex flex-wrap items-center gap-2">
    {canEdit && <Button onClick={handleSave} …>Salvar ata</Button>}
    <MinutesAudioSlot meetingId={meetingId} meetingStatus={meetingStatus} canEdit={canEdit}
      audioMinutesEnabled={audioMinutesEnabled} activeJob={activeJob} />
  </div>
</div>
```

`MeetingMinutesEditor` receives `canEdit: boolean` as a plain prop from the page — it does **not**
compute it. That `canEdit` is already exactly the audio feature's canEdit (see §1.4). The editor
does **not** currently receive `meetingStatus` — F1 needs it added as a new prop (to distinguish
`scheduled` from `held` inside the `canEdit === true` branch, D1). `MeetingMinutesEditor` is
`"use client"` already, so the new slot can be a plain child import — no new client/server
boundary is crossed at this seam.

### 1.2 The meeting detail page — `src/app/o/[org]/c/[commission]/meetings/[meetingId]/page.tsx`

Server Component. Computes `canEdit = isCoordinator && isEditableStatus(meeting.status)` where
`isCoordinator = access.role === "staff_admin"` (note: **not** `access.role === "staff_admin" ||
administrativo` — see §1.4) and passes it straight into `<MeetingMinutesEditor meetingId={...}
minutesMd={...} canEdit={canEdit} />`. This is the page F1's slot's data flows through: the page
will additionally read `audioMinutesEnabled` (flag) and `activeJob` (§3.1) alongside its existing
`Promise.all` reads, and pass three new plain props to `MeetingMinutesEditor`, which forwards them
to `MinutesAudioSlot`.

`loading.tsx` exists (skeletons the header + 4 panel-shaped blocks); **no `error.tsx`** in this
route today — F3's own route needs its own (§2.5), it can't inherit one.

### 1.3 Meetings list — `src/components/meetings/meetings-list.tsx` (F4)

Client component (sort/filter state), fed plain `MeetingListItem[]` + `meetingTypes` from a Server
Component list page. Columns end at "Assinaturas pendentes" (right-aligned, `tabular-nums`, colored
by `text-warning`/`text-success`). **F4's badge is a per-row pill**, cheapest slotted right after
the existing `MeetingStatusBadge` in the Status `<td>` (same cell, `flex items-center gap-1.5`) —
not a new column, since it's a secondary signal on top of status, not an independent dimension, and
the table is already `min-w-[1040px]` (adding a column pushes it wider for a rare-condition badge).
Driven by a new optional field the list item carries in from the server (§1.6, §3.1) — the list
component itself needs **zero new data fetching**, just a render branch.

### 1.4 canEdit — confirmed identical to the audio predicate, no new prop needed

`page.tsx`'s `isCoordinator = access.role === "staff_admin"` does **not** consult the
`administrativo` delegated-capability grant at all (that grant is checked via RLS `member_can(...)`
in places that read it, never via `access.role`). Per B0 finding §1, the audio RPCs' canEdit is
`app.is_staff_admin_of` alone — the **same** predicate `isCoordinator`/`canEdit` already encodes.
**Consequence: F1/F3 reuse the page's existing `canEdit` boolean verbatim.** No separate
"audio-canEdit" prop, no administrativo-awareness to add or strip. This also means the spawn brief's
"administrativo renders nothing" behavior is automatic, not a branch the slot has to implement —
`canEdit` is already `false` for an administrativo-only user, same as it is today for the Ata editor
they already can't touch.

### 1.5 Meeting dialogs — shape F2 must match

Two reference dialogs, both `"use client"`, both wrapped in `<Dialog>`/`<DialogContent>` (Radix, via
`@/components/ui/dialog`):

- **`meeting-form-dialog.tsx`** (`MeetingFormDialog`) — the richest example: local form state reset
  on open via the `wasOpen`/render-phase-sync pattern (`if (open !== wasOpen) { setWasOpen(open);
  if (open) { …reset… } }`), a plain-arg `startTransition` submit (not `useActionState`), a
  `useEffect` on `state?.ok` that closes + `router.refresh()` (or navigates, for create), and a
  conditional **fieldset step** (`showParticipants`) that only renders under a condition — the
  closest existing precedent for F2's two-step shape, though it's "one form, a conditional
  fieldset" rather than true two-screen navigation.
- **`attachment-upload.tsx`** (`AttachmentUpload` + inner `UploadDialog`) — closer to F2's file-input
  shell: a trigger button owns `open` state, the dialog wraps a form, `useActionState` submits
  `FormData` (multipart through the Next.js server action itself — **not** F2's model, since F2
  uploads directly to Supabase Storage via a signed URL, never touching the Next.js server with the
  file bytes; D3). What F2 reuses from here: the file-input `onChange` → filename display, the
  accept-list hint text, the `DialogFooter` Cancelar/submit button pair, and the `FormBanner`
  error-on-top-of-fields placement.
- **`case-linker.tsx`**'s `LinkCaseDialog` — same `wasOpen` reset + plain-`startTransition` pattern
  as `MeetingFormDialog`, simpler (fewer fields). Confirms the pattern is the house convention, not
  a one-off.

**No existing component does a direct-to-signed-URL browser upload with progress** (`grep` for
`createSignedUploadUrl`/`uploadToSignedUrl` across `src/` returns nothing). F2's upload step is a
genuinely new client-side pattern in this codebase — see §7 open question 4.

### 1.6 Flag-gated UI rendering pattern

The house pattern, consistent across the codebase (`chartersEnabled`/`carryForward`,
`actionItemsEnabled`, `meetingsEnabled`): a Server Component page/layout reads the flag via a typed
`*Enabled()` wrapper over `featureEnabled('key')` (`src/lib/queries/feature-flags.ts`, request-memoized
`cache()`), then either (a) **404s the whole route** when the flag gates route existence
(`meetingsEnabled()` → `notFound()` in `page.tsx`), or (b) **passes the boolean down as a plain prop**
and the receiving component renders `null`/an alternate branch (`{flagOn && canEdit && <Panel/>}`).
Audio minutes uses **(b)** for F1/F4 (the flag gates a slot inside an always-rendered parent, not a
whole route) and **(a)**-flavored for F3 (the review route itself 404s/redirects when the flag is off
— D12's own guard list already includes it). `FeatureFlags` in `feature-flags.ts` needs one new key,
`audio_minutes: boolean` — **backend's** edit (B2), not frontend's; F1/F3 only need the read side once
it exists.

---

## 2. Component tree for F1–F5

```
src/components/meetings/
├── meeting-minutes-editor.tsx        [EDIT, frontend] — header gains the slot (§1.1); new props
│                                        `meetingStatus`, `audioMinutesEnabled`, `activeJob`.
├── minutes-audio-slot.tsx            [NEW] "use client" — F1. The state machine (§4). Owns the
│                                        upload-dialog's open state and the cancel/retry confirm
│                                        dialogs. Imports `startMinutesJob`/`cancelMinutesJob`
│                                        DIRECTLY from `@/lib/minutes-jobs/actions` (never receives
│                                        them as a prop — see the RSC trap note below).
├── minutes-upload-dialog.tsx         [NEW] "use client" — F2. Two-step dialog, opened by the slot.
├── minutes-list-badge.tsx            [NEW] plain module (no "use client" — pure presentational pill,
│                                        same tier as `meeting-badges.tsx`'s exports). F4.
├── minutes-labels.ts                 [NEW] plain module — status→pt-BR label/style maps + shared
│                                        copy constants, mirroring `meeting-labels.ts`'s convention.
│                                        Consumed by the slot, the dialog, the badge, and the review
│                                        tree, so pt-BR strings live in ONE place (§5).
├── meetings-list.tsx                 [EDIT, frontend] — renders `<MinutesListBadge/>` in the Status
│                                        cell when `meeting.minutesJobStatus` is set (§1.3, §3.1).
└── review/                            F3, per the plan's own directory instruction.
    ├── review-shell.tsx              [NEW] "use client" — orchestrator: draft state (useState,
    │                                    seeded from the server-loaded draft), debounced autosave via
    │                                    `saveMinutesDraft`, saved/dirty indicator, section nav
    │                                    (in-page anchor scroll, not client routing — one page, one
    │                                    draft). Owns the `MinutesDraft` object and passes typed
    │                                    slices + setters down (no context; the tree is 6 children
    │                                    deep at most, prop-drilling one object is fine and keeps
    │                                    each child trivially testable — see the
    │                                    `vercel-composition-patterns` note in §2.1 below).
    ├── ata-editor.tsx                [NEW] "use client" — `minutes_md` slice; wraps the existing
    │                                    `SectionTextEditor` (edit/preview toggle, sanitized-Markdown
    │                                    preview via `MarkdownRenderer` — reused verbatim, not
    │                                    reimplemented) plus the overwrite-warning banner (collapsible
    │                                    diff against the meeting's CURRENT `minutes_md`, from
    │                                    `MinutesReviewData.meeting.minutesMd`).
    ├── agenda-review-card.tsx        [NEW] "use client" — one per `MinutesDraftAgendaItem` (§3.2):
    │                                    matched (ref set) → existing vs. extracted side-by-side,
    │                                    editable, include toggle; new (ref null) → editable title +
    │                                    removable. Controlled: `item`, `onChange(next)`,
    │                                    `onRemove` (new items only) — no internal fetch.
    ├── actions-review.tsx            [NEW] "use client" — one row per `MinutesDraftActionItem`: owner
    │                                    `<NativeSelect>` restricted to **commission members**
    │                                    (`AssigneeOption[]`, the SAME type `action-item-form.tsx`
    │                                    already uses — reuse it, don't invent a parallel one), a date
    │                                    input for `due_date`, `owner_text`/`deadline_text` shown as
    │                                    muted hint text beside the fields they'd fill, include toggle.
    ├── next-meeting-card.tsx         [NEW] "use client" — reads `MinutesDraftNextMeeting`; renders
    │                                    only post-apply (success state). "Agendar próxima reunião"
    │                                    opens the EXISTING `MeetingFormDialog` (mode="create") — see
    │                                    §2.2 for the one small prop this reuse needs.
    ├── speakers-panel.tsx            [NEW] "use client" only if a collapse toggle needs local state
    │                                    (likely yes — collapsed-by-default like transcript-panel);
    │                                    otherwise could be a plain server-safe list. Read-only,
    │                                    display-only (D12) — never feeds back into `draft` or apply.
    ├── transcript-panel.tsx          [NEW] "use client" — collapsed `<details>`-equivalent (a
    │                                    controlled disclosure, for the `aria-expanded` contract);
    │                                    first `onToggle`→open calls `readMinutesTranscript(jobId)`
    │                                    ONCE (a `useRef` latch, not `useState`, so a re-render
    │                                    never re-fires it), caches the text in local state, never
    │                                    re-calls on subsequent collapses/expands (§ audit note below).
    └── conclude-bar.tsx              [NEW] "use client" — sticky (`sticky bottom-0`) bar: "Concluir
                                         revisão" opens an `AlertDialog` (mirrors
                                         `ConfirmDeleteButton`'s shape) restating the overwrite
                                         warning + a live preview of the counts about to be written
                                         (X itens de pauta atualizados, Y criados, Z ações), then
                                         calls `applyMinutesReview` and redirects with a success
                                         banner (via a `?aplicado=1` search param the meeting page
                                         reads, matching no existing precedent found — flagged §7.5).

src/app/o/[org]/c/[commission]/meetings/[meetingId]/revisao-ata/
├── page.tsx      [NEW] Server Component — flag + canEdit + job-done + meeting-held guards, ALL
│                   redirecting to the meeting detail page on failure (mirrors
│                   `documentos/[documentId]/revisar/page.tsx`'s `redirect(detailHref)` precedent —
│                   not `notFound()`, per the plan's explicit "guards redirect to the meeting page").
│                   Loads `getMinutesJobForReview(jobId)` (§3.1), renders `<ReviewShell/>` with plain
│                   props (job id, meeting context, initial draft, `assignees: AssigneeOption[]`
│                   from the EXISTING `listMembers`/`sortMembers` — same call the meeting page already
│                   makes for `memberOptions`, so no new query is needed for R2's member-only owner
│                   select).
├── loading.tsx   [NEW] skeleton — header + Ata block + N section-card placeholders, same
│                   `Skeleton`-token pattern as the meeting detail `loading.tsx` (§1.2).
└── error.tsx     [NEW] boundary — the meeting detail route has none to copy; this one follows the
                    platform's other `error.tsx` boundaries (a calm pt-BR "algo deu errado" card +
                    "Tentar novamente"/"Voltar à reunião" — surveyed pattern, not shown above for
                    space; same shape as `documentos` area's error boundaries).
```

### 2.1 Why props, not a compound-component API, for the review tree

Consulted `vercel-composition-patterns` before settling this: `ReviewShell`'s children each own one
disjoint slice of `MinutesDraft` (agenda items don't touch actions, actions don't touch
`minutes_md`) and there is exactly one instance of the whole tree per page — there's no case of a
consumer wanting to omit/reorder/wrap a section, which is the signal compound components solve for.
Plain typed props (`value`/`onChange` per slice) stay the simplest correct API here; a context
provider would hide the data flow for no reuse benefit. Revisit only if a second surface (e.g. a
future interview-review page, D18) needs to reuse `agenda-review-card.tsx` etc. standalone — then
lift the shared piece, not before.

### 2.2 `MeetingFormDialog` needs one small addition (frontend-owned, noted for completeness)

Today `MeetingFormDialog` only pre-fills from a full `MeetingDetail` (`edit` mode). F3's "Agendar
próxima reunião" needs `create` mode pre-filled with a **partial** suggestion (`suggested_date`,
maybe a title stub) — not a full detail record (the suggested meeting doesn't exist yet). Proposed:
add an optional `initialValues?: { title?: string; scheduledStart?: string }` prop, consulted only
when `mode === "create"` and `meeting` is absent, defaulting exactly as today when omitted. This is
inside frontend's own file, no cross-team dependency — flagged here only so the lead sees the touch
coming during F3.

### 2.3 The RSC server-fn-prop trap — binding pattern for this whole tree

Per the memory lesson (`rsc-server-fn-prop-client-crash.md`, recurred once as BUG-QI-001): **every
client component in this tree imports its server actions directly** from
`@/lib/minutes-jobs/actions` (top-level named exports, e.g. `import { startMinutesJob } from
"@/lib/minutes-jobs/actions"` inside `minutes-upload-dialog.tsx` itself) — exactly how
`meeting-minutes-editor.tsx` already imports `updateMeetingMinutes` and `use-meeting-action.ts`
types against `ActionState` from `@/lib/meetings/actions`. **No Server Component in this tree ever
passes a server action, a bound closure over one, or a query-builder value as a prop** — only plain
serializable data (strings, numbers, the `MinutesDraft`/`MinutesJobSummary` objects) and **type-only**
imports of `src/lib/**` types cross the boundary. This is why `meetingId`/`jobId` are passed as
plain strings and every mutation is triggered by the client component's own direct import, not a
prop.

---

## 3. Server-action surface needed from B5

This is the contract. Types live wherever backend's B4/B5 file split puts them (`types.ts` per the
plan); signatures below are what frontend code will import and call. `ActionState` is copied from
`src/lib/meetings/actions.ts` verbatim, not reinvented — reuse the same shape family so
`useMinutesAction` (a new hook, mirroring `use-meeting-action.ts` 1:1) can share its generic type
with `useMeetingAction`.

### 3.1 Queries (`src/lib/minutes-jobs/queries.ts`)

```ts
export type MinutesJobStatus =
  | 'uploading' | 'processing' | 'done' | 'failed' | 'cancelled' | 'applied'
  // mirrors public.audio_job_status (D18) — keep in sync by hand, no generated
  // union exists for a Postgres enum in this codebase's type pipeline.

export interface MinutesJobSummary {
  id: string
  meetingId: string
  status: MinutesJobStatus
  /** ISO timestamp — F1's elapsed-time basis for the uploading/processing chip. */
  createdAt: string
  /**
   * Already pt-BR-mapped (never a raw SQLSTATE/service message) — F1's failed
   * chip renders this directly. `null` unless status === 'failed'.
   */
  errorMessage: string | null
}

/**
 * F1's single read. Returns the MOST RECENT job row for the meeting, but ONLY
 * if its status is one of ('uploading','processing','done','failed') — a
 * 'cancelled' or 'applied' most-recent row means "no active job to show",
 * so this returns `null` in that case (D13: after any terminal state a fresh
 * attempt is available, rendered as the plain "Usar áudio" button, not a
 * lingering chip). One row max per meeting in the live-active set already
 * (the partial unique index), so "most recent" only matters to pick between a
 * live row and possibly-newer terminal rows.
 */
export async function getActiveMinutesJob(meetingId: string): Promise<MinutesJobSummary | null>

export interface MinutesReviewData {
  job: {
    id: string
    meetingId: string
    status: MinutesJobStatus
    createdAt: string
  }
  meeting: {
    id: string
    commissionId: string
    status: 'scheduled' | 'held' | 'in_signature' | 'signed' | 'distributed' | 'cancelled'
    /** CURRENT minutes_md — for `ata-editor.tsx`'s overwrite-warning diff (D5). */
    minutesMd: string | null
    title: string
    meetingNumber: number
  }
  draft: MinutesDraft
}

/**
 * F3's page load. `null` = not found OR unreadable — deliberately
 * indistinguishable (mirrors `getActionItem`/`getDocument`); `page.tsx`
 * redirects to the meeting page either way, never confirming existence to a
 * non-canEdit prober.
 */
export async function getMinutesJobForReview(jobId: string): Promise<MinutesReviewData | null>
```

**F4 (list badge) — proposed as an ADDITION to the existing `MeetingListItem` / `listMeetings`
query, not a separate call**, per the plan's own "avoid N+1 — one join/lateral in the list read"
instruction:

```ts
// addition to src/lib/queries/meetings.ts's MeetingListItem (backend-owned file)
export interface MeetingListItem {
  // …existing fields…
  /**
   * 'processing' | 'done' when this meeting has a job in that state, else
   * `null` — including when `audio_minutes` is OFF (the lateral join itself
   * should be flag-gated, so an OFF tenant never even queries the jobs table
   * from the list read). F4's ONLY new data need.
   */
  minutesJobStatus: 'processing' | 'done' | null
}
```

If backend prefers a separate batched call instead (e.g. `getActiveMinutesJobsByMeeting(meetingIds:
string[]): Promise<Map<string, 'processing' | 'done'>>`) that's an acceptable equivalent — flagged
as an open question (§7.1) rather than dictated, since it's backend's query to shape.

### 3.2 `MinutesDraft` — the review-page working copy

**This is the piece most worth getting right before either side builds against it** — it's what F3
edits in full and what `apply_minutes_review` (B2) reads. Proposed shape (backend's webhook
draft-normalizer, B6/T2, must produce exactly this from the service's raw `result` payload; the
service's own field names may differ, that's the normalizer's job to bridge):

```ts
export interface MinutesDraft {
  minutes_md: string

  agenda_items: MinutesDraftAgendaItem[]
  action_items: MinutesDraftActionItem[]
  next_meeting: MinutesDraftNextMeeting | null
  /** Display-only (D12) — never read by apply; carried in draft only so a
   *  refresh/autosave round-trip doesn't lose it before the user has looked. */
  speakers: MinutesDraftSpeaker[]
}

export interface MinutesDraftAgendaItem {
  /** Client-stable React key; NOT a DB id (a new item has none yet). */
  key: string
  /**
   * The `meeting_agenda_items.id` this entry ref-matches, or `null` when
   * raised on the day (D6). May go DANGLING (row deleted before apply) —
   * apply degrades a dangling ref to a create, same as `null` (plan B2 step
   * 2), so the UI never needs to special-case "dangling" distinctly from
   * "new"; both show the "new item" affordance already.
   */
  ref: string | null
  /** Extracted/edited title. Authoritative when `ref` is null; when `ref` is
   *  set the EXISTING item's title is shown instead (read-only) — apply never
   *  touches the title of a matched item, only discussion_notes/resolution. */
  title: string
  /** Existing text for a ref-matched item (side-by-side display, D6); `null` when `ref` is null. */
  existing_discussion_notes: string | null
  existing_resolution: string | null
  /** Extracted, editable. */
  discussion_notes: string
  resolution: string | null
  /** Apply skips this entry entirely when `false` (D6 "any item can be struck"). */
  include: boolean
}

export interface MinutesDraftActionItem {
  key: string
  title: string
  description: string
  /**
   * A COMMISSION-MEMBER user id, or `null` (unassigned). F3's owner select
   * offers ONLY commission members (B0 §4 R2 — `create_committee_action_item`
   * rejects anyone else with HC021); this field must never carry a guest
   * attendee's id even transiently.
   */
  assigned_to: string | null
  /** The attendee ref the service resolved as owner, kept for display context only — never sent to apply. */
  owner_ref: string | null
  /** Verbatim as-spoken owner text — shown as a muted hint when `assigned_to` is null. */
  owner_text: string | null
  /** Parsed YYYY-MM-DD, or `null` if unparsed. */
  due_date: string | null
  /** Verbatim as-spoken deadline — shown as a muted hint when `due_date` is null. */
  deadline_text: string | null
  include: boolean
}

export interface MinutesDraftNextMeeting {
  suggested_date: string | null
  note: string | null
}

export interface MinutesDraftSpeaker {
  label: string
  /** Resolved attendee id, or `null` = unidentified voice. */
  attendee_ref: string | null
  utterance_count: number
}
```

Size sanity: even a long meeting (40 agenda items, 20 actions) serializes to well under the ~2 MB
draft cap the plan already sets for `save_minutes_draft`.

### 3.3 Actions (`src/lib/minutes-jobs/actions.ts`, `'use server'`)

```ts
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface StartMinutesJobState extends ActionState {
  jobId?: string
  /** Storage object path the client uploads to (bucket `meeting-audio`). */
  path?: string
  /** Signed-upload token for `supabase.storage.from(...).uploadToSignedUrl(path, token, file)`. */
  token?: string
}
/** F2 step 2, on file selection (before the actual byte upload). */
export async function startMinutesJob(
  meetingId: string,
  filename: string,
  contentType: string,
  size: number,
): Promise<StartMinutesJobState>

/** F2, after the browser reports the direct upload finished. */
export async function submitMinutesJob(jobId: string): Promise<ActionState>

/** F1's cancel chip action + F2's "desistir" escape hatch mid-upload. */
export async function cancelMinutesJob(jobId: string): Promise<ActionState>

/** F3's debounced autosave. Sanitizes `draft.minutes_md` (Rule 7) before the RPC. */
export async function saveMinutesDraft(jobId: string, draft: MinutesDraft): Promise<ActionState>

export interface ApplyMinutesReviewState extends ActionState {
  /** Present only when `ok`. Feeds `conclude-bar.tsx`'s confirm dialog AND the post-redirect success banner. */
  counts?: {
    agendaUpdated: number
    agendaCreated: number
    actionsCreated: number
  }
}
/** F3's "Concluir revisão". Revalidates the meeting + review paths server-side. */
export async function applyMinutesReview(jobId: string): Promise<ApplyMinutesReviewState>

export type ReadTranscriptResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string }
/** The audited door (D8/D15). Called ONCE per page visit, on transcript-panel's first expand only. */
export async function readMinutesTranscript(jobId: string): Promise<ReadTranscriptResult>
```

**Not requested as a frontend-callable action:** `reconcileMinutesJob` — the plan describes it as
"called from page loads on stale jobs," which reads as internal plumbing B5's queries invoke on the
server before returning data, not something a client component triggers. Confirmed as an open
question (§7.2) rather than assumed either way.

---

## 4. State machine — the F1 slot

`MinutesAudioSlot` inputs: `meetingStatus` (`MeetingStatus`), `canEdit: boolean`,
`audioMinutesEnabled: boolean`, `activeJob: MinutesJobSummary | null`.

| # | Condition | Renders |
| - | --- | --- |
| 1 | `!audioMinutesEnabled` | **Nothing** (`return null`) — no dead links, matches every other flag-gated slot in the codebase (§1.6). |
| 2 | `!canEdit` | **Nothing** — covers members, locked-lifecycle statuses, and `administrativo` (§1.4) uniformly; no distinct copy needed for any of those sub-cases. |
| 3 | `canEdit && meetingStatus === 'scheduled'` (no active job possible — D1 forbids starting one) | A quiet, non-actionable **nudge chip**: "Marque a reunião como realizada para usar áudio" (muted-foreground text, no button — clicking through requires the existing lifecycle action, not this slot; §5 copy). |
| 4 | `canEdit && meetingStatus === 'held' && activeJob === null` | **"Usar áudio" button** (primary-adjacent — `variant="outline"`, since "Salvar ata" stays the header's one true primary action per the design system's "primary is precious" rule), opens `MinutesUploadDialog`. |
| 5 | `activeJob.status === 'uploading'` | **Chip**: spinner + "Enviando áudio…" + a cancel affordance (icon button → `AlertDialog`, mirrors `ConfirmDeleteButton`). No elapsed timer yet (upload progress belongs to the dialog, which is still open or was just closed — the chip itself doesn't duplicate a progress bar). |
| 6 | `activeJob.status === 'processing'` | **Chip**: spinner + "Processando áudio…" + elapsed time (`Intl.RelativeTimeFormat`-style "há Xmin", ticking via a 1-min interval, from `activeJob.createdAt`) + cancel (same confirm dialog, copy warns processing work is discarded). |
| 7 | `activeJob.status === 'done'` | **Highlighted button** (`variant="default"`, this IS the moment the header's primary attention goes to the audio flow): "Revisar ata gerada" → `Link` to `revisao-ata`. |
| 8 | `activeJob.status === 'failed'` | **Error chip**: destructive-toned icon + `activeJob.errorMessage` (already pt-BR) + a **"Tentar novamente"** button that opens `MinutesUploadDialog` fresh (a new job, not a retry-in-place — `startMinutesJob` mints a new row; D13 confirms a new attempt is always available). |

`cancelled`/`applied` never reach this table as `activeJob.status` — per §3.1's contract,
`getActiveMinutesJob` already collapses those to `null`, landing back on row 4's plain button. This
keeps the component's own logic a flat switch over 5 possibilities (`null` handled by rows 3/4 on
`meetingStatus`, then the 4 live/failed statuses) instead of a 6-way switch with two branches that
alias to the same render — simpler to keep correct.

**Live-update note:** while a job is `uploading`/`processing` (rows 5–6), the plan specifies a light
`router.refresh()` poll (~45 s) "only while a job is active on the open page" — implemented as a
`useEffect` in `MinutesAudioSlot` itself (`setInterval` armed only when `activeJob?.status` is
`'uploading'` or `'processing'`, cleared on unmount/status change), not a page-level poller. The
durable signal stays the notification (B7); this refresh is a nicety for someone watching the tab.

---

## 5. pt-BR copy

All strings centralized in `minutes-labels.ts` (§2), never inlined ad hoc, so review/QA can audit
copy in one file — mirrors `meeting-labels.ts`/`MEETING_MESSAGES`'s convention.

| Key | Copy | Where |
| --- | --- | --- |
| `nudgeScheduled` | "Marque a reunião como realizada para usar áudio." | F1 row 3 |
| `startButton` | "Usar áudio" | F1 row 4 |
| `uploadingChip` | "Enviando áudio…" | F1 row 5 |
| `processingChip` | "Processando áudio…" | F1 row 6 |
| `elapsedPrefix` | "há {n} min" / "há {n} h" | F1 row 6 elapsed |
| `reviewButton` | "Revisar ata gerada" | F1 row 7 |
| `retryButton` | "Tentar novamente" | F1 row 8 |
| `cancelConfirmTitle` | "Cancelar o processamento do áudio?" | F1 cancel dialog |
| `cancelConfirmUploading` | "O envio será interrompido. O arquivo enviado até aqui será descartado." | F1 cancel, uploading |
| `cancelConfirmProcessing` | "O processamento em andamento será descartado. Você poderá enviar o áudio novamente depois." | F1 cancel, processing |
| `cancelConfirmAction` | "Cancelar processamento" | F1 cancel dialog action button |
| `dialogTitle` | "Gerar ata a partir do áudio" | F2 dialog title |
| `step1Title` | "Confirme a lista de participantes" | F2 step 1 |
| `step1Warning` | "A atribuição de falas na ata gerada usa esta lista de participantes. Revise-a antes de continuar." | F2 D12 warning |
| `step1LinkToAttendees` | "Editar participantes" | F2 step 1 link |
| `step1ZeroAttendees` | "Adicione ao menos um participante antes de gerar a ata por áudio." | F2 zero-attendee block |
| `step1MultiPart` | "Se a gravação está dividida em vários arquivos, junte-os em um único arquivo antes de continuar — o envio aceita apenas um arquivo por vez." | F2 D13 note |
| `step1Continue` | "Continuar" | F2 step 1 → 2 |
| `step2Title` | "Envie o arquivo de áudio" | F2 step 2 |
| `step2Accept` | "Formatos aceitos: M4A, AAC, MP3, WAV, OGG, WebM — até 500 MB." | F2 file hint |
| `step2FileTooLarge` | "O arquivo excede o limite de 500 MB." | F2 client-side size check |
| `step2FileTypeInvalid` | "Envie um arquivo de áudio em um dos formatos aceitos." | F2 client-side type check |
| `step2Uploading` | "Enviando… {percent}%" | F2 progress |
| `step2UploadFailed` | "Não foi possível enviar o áudio. Verifique sua conexão e tente novamente." | F2 upload failure |
| `step2Submit` | "Enviar e gerar ata" | F2 submit button |
| `step2Cancel` | "Cancelar" | F2 dialog cancel |
| `overwriteWarningTitle` | "Esta reunião já tem uma ata registrada" | F3 ata-editor.tsx |
| `overwriteWarningBody` | "Concluir a revisão substituirá o texto atual da ata pelo texto gerado abaixo. O texto atual continuará disponível para consulta até você concluir." | F3 overwrite banner |
| `overwriteShowCurrent` | "Ver ata atual" | F3 collapsible toggle |
| `speakersNote` | "As falas identificadas aqui são uma estimativa do áudio e **não substituem a lista de presença**. Elas não alteram os registros de participação da reunião." | F3 D12 speakers note |
| `transcriptCollapsed` | "Transcrição completa" | F3 transcript-panel trigger |
| `transcriptLoading` | "Carregando transcrição…" | F3 first expand |
| `transcriptError` | "Não foi possível carregar a transcrição." | F3 audited-read failure |
| `concludeButton` | "Concluir revisão" | F3 conclude-bar |
| `concludeConfirmTitle` | "Concluir a revisão da ata?" | F3 confirm dialog |
| `concludeConfirmCounts` | "{agendaUpdated} itens de pauta atualizados, {agendaCreated} criados, {actionsCreated} itens de ação criados." | F3 confirm dialog counts |
| `concludeConfirmOverwrite` | "O texto atual da ata será substituído." (shown only when the meeting had non-empty minutes) | F3 confirm dialog |
| `concludeSuccessBanner` | "Ata aplicada com sucesso." | post-apply banner |
| `applyFailed` | "Não foi possível concluir a revisão. Tente novamente." | apply generic fallback |
| `nextMeetingCta` | "Agendar próxima reunião" | F3 next-meeting-card |
| `dirtyIndicator` | "Alterações não salvas" / "Salvo" | F3 review-shell autosave indicator |
| `f4BadgeProcessing` | "Áudio em processamento" | F4 list badge (icon + `sr-only` or visible text — small pill, text kept short: "Processando") |
| `f4BadgeDone` | "Ata gerada — revisar" | F4 list badge, `done` |

Error-code mapping: F2/F3 need pt-BR text for the B2 RPCs' failure modes (no-active-job race,
wrong job status, wrong meeting status, `action_items` flag/assignee errors surfaced through
`apply_minutes_review`). Per the house convention (`src/lib/meetings/messages.ts`), this mapping
belongs in `src/lib/minutes-jobs/messages.ts` — **backend's** file (it owns the SQLSTATE constants,
same as `HC_ASSIGNEE_NOT_MEMBER` etc. in the meetings module) — frontend only ever renders
`ActionState.error`, never a raw code. Flagged as open question §7.3 so backend publishes the
`HC0xx` constants + pt-BR strings in the same shape.

---

## 6. Accessibility + motion plan

### 6.1 Keyboard path (hard gate — at least one full keyboard-only flow)

1. Tab to "Usar áudio" (F1 row 4) → `Enter` opens `MinutesUploadDialog` (Radix `Dialog`, focus
   trapped + returned on close automatically, same as every existing dialog in this tree).
2. Step 1: focus lands on the dialog's first focusable element (Radix default — the close button or
   first interactive child); `Tab` reaches "Editar participantes" (a real `Link`, opens in place —
   confirm at build whether this should open a NEW tab so step 1's progress isn't lost, §7.6) then
   "Continuar" (disabled + `aria-disabled` when zero attendees, with the block reason as
   `aria-describedby` text next to it, not color alone).
3. Step 2: `Tab` to the native `<input type="file">` (keyboard-operable by default), `Enter`/`Space`
   opens the OS file picker (native behavior, nothing custom to build), then to "Enviar e gerar ata".
   Progress announces via a `role="status" aria-live="polite"` region (percentage text, not just a
   visual bar — mirrors `FormBanner`'s `aria-live` pattern).
4. On success the dialog closes and focus returns to the F1 slot's new chip (Radix handles the
   trigger-return by default since the button that opened it is still in the DOM).
5. Later, "Revisar ata gerada" (`Tab` + `Enter`) navigates to `revisao-ata`; `<h1>` there receives
   programmatic focus on mount (a `useEffect` `ref.current?.focus()` with `tabIndex={-1}`, the
   standard SPA-navigation focus-management fix — needed because a `Link` navigation to a new route
   doesn't reset focus to the top like a full page load would).
6. Through the review sections via `Tab` (every input has a visible `focus-visible:ring-[3px]
   focus-visible:ring-ring/40` per the design system) — section nav (if implemented as anchor links)
   is a secondary jump mechanism, not required for linear completion.
7. `transcript-panel.tsx`'s disclosure trigger is a real `<button aria-expanded>` — `Enter`/`Space`
   toggles, matching `SectionTextEditor`'s `role="tab"` precedent for interactive-toggle patterns in
   this codebase.
8. "Concluir revisão" → `Enter` opens the `AlertDialog` confirm (same trap/return behavior as
   `ConfirmDeleteButton`) → `Tab` to the "Concluir" action → `Enter` applies and redirects; the
   success banner is `role="status" aria-live="polite"` so a screen-reader user hears it without
   having to find it visually post-redirect.

Every select (`actions-review.tsx`'s owner picker) is the existing `NativeSelect` — real `<select>`,
full native keyboard support, no custom listbox to build or get wrong.

### 6.2 Focus management specifics

- Two-step dialog (F2): moving from step 1 to step 2 is a **re-render inside the same `Dialog`**,
  not a route change or a second `Dialog` mount — so Radix's focus trap stays intact automatically.
  On the step-1→2 transition, move focus explicitly to step 2's first control (the file input) via a
  `ref` + `useEffect` keyed on the step value, so a screen-reader user isn't left on a now-invisible
  "Continuar" button.
- `review-shell.tsx`'s autosave must **never** steal focus — it's a background `saveMinutesDraft`
  call on a debounce; the dirty/saved indicator updates via `aria-live="polite"` text, never a focus
  move or a modal.
- The conclude confirm dialog is the one point where a genuinely destructive/overwriting action
  happens — its focus-trap + explicit "Cancelar"/"Concluir" pair (never a bare "OK") follows
  `ConfirmDeleteButton`'s exact shape.

### 6.3 Motion — tokens from `src/components/motion/`

- **F1 chip transitions** (button → uploading chip → processing chip → done button): a quick
  cross-fade using `--dur-fast` (180 ms) — NOT a GSAP timeline, just the CSS `.animate-fade-in`
  utility on the new state's root element, keyed by `activeJob?.status` so React remounts (and
  re-triggers the CSS animation) on each transition. This is exactly the "review screens, swaps,
  banners" case `.animate-fade-in` is documented for — no GSAP needed for a two-element swap.
- **F2 dialog**: Radix's own open/close animation (already the house default via `dialog.tsx`); the
  step 1→2 transition inside the dialog gets a small horizontal cross-fade
  (`gsap.fromTo(stepRoot, {opacity:0, x:8}, {opacity:1, x:0, duration: durFast, ease:
  MOTION_EASE.outSoft})`), dynamically imported, wrapped in try/catch, no-op under
  `useReducedMotion()` — decorative only, the step change is fully functional without it.
- **F3 review-shell entrance**: wrap the section stack in `RiseInGroup` (reused as-is, same as the
  meetings list's `.animate-fade-in` wrapper but for a taller stack of cards) with `[data-rise]` on
  each section card — the existing shared component, zero new motion code, `--rise-delay` stagger
  automatic.
- **`conclude-bar.tsx`**'s sticky bar: no entrance animation (it's present from first paint, sticky
  scroll position) — only the confirm-dialog open/close (Radix default) and a brief `--dur-fast`
  pulse/highlight on the counts text when they update (debounced draft edits change the live count
  preview) — a GSAP `gsap.fromTo(countsEl, {scale:1.04}, {scale:1, duration: durFast})`, same
  dynamic-import/try-catch/reduced-motion guard as everywhere else in this system.
- **F4 badge**: no motion — it's a static pill in a table row, consistent with every other
  `meeting-badges.tsx` pill (none animate).
- **Elapsed-time tick** (F1 row 6): a plain `setInterval` text update, not a motion concern — no
  animation on the number changing (a ticking number is exactly the kind of "attention-grabbing"
  effect the design system's Do/Don't list warns against; it just updates).

All GSAP usage above is a dynamic import behind interaction/`useEffect`, registered per the shared
`motion-tokens.ts` durations/easings (never a hand-approximated number), and every one is
best-effort — a motion failure never blocks the underlying state change or navigation, per the
system's binding rule.

---

## 7. Open questions for the lead / backend

1. **F4 data shape** — is extending `MeetingListItem` with `minutesJobStatus` (a lateral join inside
   the existing `listMeetings` read, §3.1) backend's preferred approach, or would a separate batched
   `getActiveMinutesJobsByMeeting(meetingIds)` be cleaner on that side? Either is fine for the list
   component; flagging so backend picks the shape it wants to maintain.
2. **`reconcileMinutesJob`'s call site** — is it invoked internally by `getActiveMinutesJob`/
   `getMinutesJobForReview` before they return (so frontend never calls it directly), or does
   `page.tsx` need to call it explicitly before reading job state? The plan's "called from page loads
   on stale jobs" reads either way; the contract in §3.3 currently omits it from the frontend-facing
   surface on the assumption it's internal — confirm.
3. **RPC error vocabulary** — please publish the `HC0xx` constants + pt-BR strings for the two new
   doors (`apply_minutes_review`'s wrong-status/no-active-job/mapped `HC000`/`HC021` cases;
   `create_minutes_job`'s no-active-job-race/wrong-meeting-status cases) in
   `src/lib/minutes-jobs/messages.ts`, same shape as `src/lib/meetings/messages.ts` — F2/F3 render
   `ActionState.error` as-is and need it to already be pt-BR.
4. **Upload progress mechanics** — the plan itself flags this as verify-at-build (TUS/resumable
   support against a signed URL in the installed `@supabase/supabase-js`/`storage-js` version). If
   resumable upload isn't available, `minutes-upload-dialog.tsx` falls back to a plain
   `XMLHttpRequest`-based PUT with `upload.onprogress` (the standard way to get progress without
   TUS) rather than the supabase-js helper — noting this now so it isn't a surprise mid-F2 build;
   either path keeps the same `step2Uploading` copy/UI, only the implementation underneath differs.
5. **Success-banner delivery after redirect** — `conclude-bar.tsx` redirects to the meeting page
   after apply; no existing pattern in this codebase was found for "one-shot success banner across a
   redirect" (checked `documentos`/`itens-de-acao` — none carry a post-action banner across a
   navigation). Proposed: a `?ata_aplicada=1` search param the meeting `page.tsx` reads once to
   render `concludeSuccessBanner`, stripped via `router.replace` after render so a refresh doesn't
   re-show it. Flagging for lead sign-off since it's a small new pattern, not because it's risky.
6. **"Editar participantes" link target in F2 step 1** — same tab (loses upload-dialog progress
   through step 1, though step 1 has no destructive state yet, so this is low-cost) vs. a new tab
   (`target="_blank"`, keeps the dialog's step-1 state intact for one-handed back-and-forth). Leaning
   new tab given the explicit "revise before continuing" framing, but it's the one deviation from
   every other in-app `Link` in this codebase (none use `target="_blank"`) — want a decision before
   introducing the platform's first one.

---

## 8. Summary for the lead

Design-only turn, `docs/design/audio-minutes-ui.md` is the only file touched. §3 is the contract to
hand `backend` for B5 (`MinutesJobSummary`, `MinutesReviewData`, `MinutesDraft` + its four nested
shapes, and the six action signatures under §3.3). Six open questions (§7) need answers before F3 in
particular can start cleanly — none block F1/F2, which only need §3.1's `getActiveMinutesJob` +
§3.3's `startMinutesJob`/`submitMinutesJob`/`cancelMinutesJob`. Once B5 lands with real signatures
matching (or correcting, with this doc updated to match) §3, F1 → F2 → F3 → F4 → F5 can proceed in
the plan's stated order.

---

## 9. Lead answers to §7 (2026-08-06)

Authored by the lead, appended to the frontend teammate's brief. These are
decisions, not suggestions — §7's questions are closed by them.

1. **F4 data shape → lateral join inside `listMeetings`.** The plan's F4 text
   already calls for "one join/lateral in the list read"; a separate batched
   call re-opens the N+1 risk the moment someone forgets to batch it. Backend
   extends `MeetingListItem` with `minutesJobStatus`.
   ⚠ Rider for backend: adding a second FK path to an already-reachable table
   has broken un-hinted PostgREST embeds elsewhere in this codebase (PGRST201).
   If the read goes through an embed rather than a view/lateral, **pin the
   embed to the intended FK**.
2. **`reconcileMinutesJob` is internal.** `getActiveMinutesJob` and
   `getMinutesJobForReview` call it before returning; it is **not** exported to
   the frontend. Lazy reconciliation that a page has to remember to invoke is
   reconciliation that silently stops running. Keep it off the §3.3 surface.
3. **Yes — backend publishes `src/lib/minutes-jobs/messages.ts`** mirroring
   `src/lib/meetings/messages.ts`, covering every code the two new doors can
   raise plus the mapped `HC000`/`HC021` from `create_committee_action_item`.
   Already inside B5's scope; now explicit.
4. **Resolved as fact, not a fallback — use XHR.** Verified against the
   installed `@supabase/storage-js` **2.108.1**: `uploadToSignedUrl(path, token,
   fileBody, fileOptions?)` exists, but `FileOptions` is
   `{cacheControl, contentType, upsert, duplex, metadata, headers}` — there is
   **no `onUploadProgress`**, and the implementation is `fetch`-based, which
   cannot report upload progress at all. TUS/resumable is not available against
   a signed URL here either. So F2 does a plain `XMLHttpRequest` PUT to the
   signed URL with `upload.onprogress`. For a 500 MB file this is not cosmetic:
   a progressless 20-minute upload reads as a hung app. Document the
   retry-from-scratch behaviour in the dialog copy.
5. **Approved — `?ata_aplicada=1`, stripped via `router.replace`.** Small, and
   the alternative (a toast surviving a redirect) has no precedent here either.
   Ensure the strip runs in an effect keyed to the param so a back-navigation
   cannot resurrect the banner.
6. **Same tab — do not introduce `target="_blank"`.** Being the platform's first
   is reason enough to decline: consistency across every in-app link is worth
   more than preserving step-1 state that, as noted, holds nothing destructive.
   Re-opening the dialog after editing attendees costs two clicks.
