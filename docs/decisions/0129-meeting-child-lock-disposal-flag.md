# ADR 0129 — A narrow disposal flag through the meeting child lock

**Status:** **Accepted — BUILT 2026-08-19** (design PO-ratified the same day in the DSR
design session; implemented as DSR plan **Slice 1**, migration
`20260930000100_disposal_flag_through_meeting_child_lock.sql`, suite
`supabase/tests/348_disposal_flag_meeting_child_lock.sql`) · **Date:**
2026-08-19 · **Feature:** fix for `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` (🔴; ⛔ its
recorded "blocks Critical FUP C1a/C1b" was **wrong in grain** — Consequences) · **Relates:** ADR
[0056](./0056-phi-disposal-closure-narrowed-claim.md) (the door), ADR
[0126](./0126-print-series-and-derived-currency.md) §E/§F (the guard's load-bearing
refusal + the disposal registration conjunct), ADR
[0130](./0130-dsr-subject-request-workflow.md) (the workflow this unblocks), Rule 12.

## Context

`public.dispose_meeting_minutes` — the LGPD-erasure door for meeting minutes (ADR 0056 §2)
— **cannot complete on any locked meeting that has agenda items**, i.e. exactly the
population that carries PHI. Measured from the live catalog (never the migration text):

- The door sets `app.in_meeting_rpc` with the comment *"bypass the meeting freeze guards"*.
- **`app.guard_meeting_child_lock` does not read that flag** — its body contains no
  reference to `app.in_meeting_rpc` at all. It raises unconditionally when the parent
  meeting is `in_signature` / `signed` / `distributed` / `cancelled`, on all four child
  tables (`meeting_agenda_items`, `meeting_attendees`, `meeting_cases`,
  `meeting_closed_sessions`).
- So the door nulls `minutes_md` (the parent honours the flag), then raises on the
  `meeting_agenda_items` UPDATE, and the whole transaction rolls back. Constructed with
  three probes: locked-with-agenda ⛔ raises · locked-agenda-less ✅ disposes.

The comment asserts a bypass the guard it names does not implement — the
guards-that-read-right-but-fail-open family, except here it fails **closed** against a
legal obligation. Three fix shapes were on the table (FUP body,
`docs/progress/follow-ups.md`); the PO ruled in the 2026-08-19 design session (Q11).

## Decision

**Shape 2 — a new, narrow flag.** Rejected: shape 1 (teach the guard to honour
`app.in_meeting_rpc`) is a widening — every meeting RPC would gain child-write power over
locked meetings, and ADR 0126 §E leans on the guard's refusal *inside* RPCs as the reason
agenda/attendee/closed-session content is not a currency exposure. A widening cannot be
wrong-and-safe. Rejected: shape 3 (a DEFINER path around the trigger) duplicates redaction
outside the door that audits it.

1. New transaction-local GUC **`app.in_disposal_rpc`** — **set only** by
   `dispose_meeting_minutes` (immediately before its child UPDATE, reset after), **read
   only** by `app.guard_meeting_child_lock`, which stands aside iff the flag is `'on'`.
   No other guard reads it; no other door sets it.
2. The false comment in `dispose_meeting_minutes` is corrected in the same migration. The
   `app.in_meeting_rpc` set/reset pair stays (the parent-table guards do honour it).
3. **ADR 0126 §E is amended in the same change** — its positively-stated bound
   (*"`guard_meeting_child_lock` … reads **no** RPC flag at all, so it refuses even inside
   RPCs"*) becomes *"reads exactly one flag, `app.in_disposal_rpc`, settable only by the
   disposal door"*. Leaving §E as written would plant the next stale-comment defect in the
   ADR that documented this one.

## Obligations (each blocks the phase that ships this)

- **pgTAP, with the fixture the FUP demands**: a **locked meeting WITH agenda items** —
  (a) disposal succeeds end-to-end (`minutes_md` null, agenda columns `[PHI removido]`,
  `phi_disposed_at` stamped, status unchanged); (b) **differential**: with the flag absent,
  a direct child UPDATE on the same fixture still raises (the guard still refuses
  everything else — the over-grant twin, or the test passes by construction); (c) a
  sibling meeting RPC (e.g. `sign_meeting`) still **cannot** write children of a locked
  meeting — shape 1's widening is pinned out.
- **Diff-scoped door sweep** over exactly `guard_meeting_child_lock` +
  `dispose_meeting_minutes` (ADR 0079 Amendment 1 recipe); `ARM=census` + `ARM=wrapper`
  (`FROMFINDINGS=1`) — a changed DEFINER body re-enters both domains.
- **ADR 0126 §F re-check**: the meeting **registration** predicate (`status ∈
  registering ∧ phi_disposed_at is null`) is untouched by this change — disposal already
  un-registers. Assert the watermark tandem rule is not tripped (no lock-predicate
  refinement occurs; record that this was checked, not assumed).
- The C1a §3 disposal rehearsal (blocked on this) **must use the with-agenda fixture** —
  a green over agenda-less meetings proves nothing about the case this ADR exists for.

## Build record (2026-08-19) — what the obligations actually returned

All on a **fresh `supabase db reset`**. Suite `348` is 15 tests; the four gates below are
CLAUDE.md §6 step 1.

| Obligation | Evidence |
|---|---|
| (a) locked **WITH agenda items** disposes end-to-end | `348` t9 + t10–t13: `minutes_md` null, both agenda rows `[PHI removido]` in all three columns, `phi_disposed_at` stamped with the reason, **status unchanged**. ⚠ The seed has **no** such meeting — its only meeting with children is `held` — so `348` **constructs** the population rather than searching for it |
| (b) the no-flag differential | `348` t5. Verified by **neutralization**, not by reading: with the stand-aside removed, t9 dies `23514 … está bloqueado` and t5/t6/t8/t15 stay green — the fix is red-without / green-with, in both directions |
| (c) a sibling RPC still cannot write children | `348` t6 (the `app.in_meeting_rpc` flag all **26** sibling doors set) and t8 (`update_meeting_agenda_item`, past its own gate). Shape 1's widening is pinned out |
| ADR 0126 §E amended in the same change | Done — §E now reads "exactly one flag"; §F's "not fixed here" note is marked resolved |
| Diff-scoped door sweep | ADR 0079 Amdt 1's recipe filters the diff to `^(is_\|can_\|has_)` + RLS policies, and by that **syntax** this diff's case list is **empty** (a trigger function and a plain `if not (...)` inside a door). Swept by the **property** instead — see the finding below |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` | All four **HOLD**. No new census subject: both objects already existed |
| ADR 0126 §F re-check | Checked, not assumed: the registration predicate (`status ∈ registering ∧ phi_disposed_at is null`) is untouched, no lock-predicate refinement occurs, so the watermark tandem rule is not tripped. t13 pins that disposal leaves `status` alone |

⭐ **The sweep found something the obligations did not ask for.** Rewriting
`dispose_meeting_minutes`'s authorization gate to `if false then` — so **any** caller
passes — left the full **6548-test** suite **GREEN**. The gate was correct; nothing would
have noticed its removal. That is door-blindness (ADR 0079) on a PHI-erasure door, and it
had been that way since ADR 0056. `348` **t7** is the missing keystone: a plain commission
member is refused `42501`, and it goes RED under exactly that mutation. The lesson is the
recipe's: **a syntax-derived case list is not the property** — this door matched no filter
and was blind anyway.

## Consequences

- PHI erasure becomes possible for the population that carries PHI, and the DSR workflow
  (ADR 0130) gains a working meeting lane.
- ⛔ **CORRECTION — this does NOT unblock Critical FUP C1a/C1b.** The FUP, this ADR's Context,
  and four other documents recorded the defect as *blocking* C1a/C1b. Measured 2026-08-19 at
  build time, that link does not hold: **C1a is a run of
  [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md)**, which is the
  **`file_objects` / Storage-bytes** completion mechanism (its § 0 says so: it exists because
  `complete_document_disposal` has no automated caller). The paths are **disjoint in the
  catalog** — `dispose_meeting_minutes` writes no `file_objects` row and never sets
  `disposal_pending`; `complete_document_disposal` never touches meetings; the runbook contains
  **zero** occurrences of "meeting", "minutes_md", or `dispose_meeting_minutes`. ⭐ **A real
  defect was cited for a conclusion it did not bound** — [[a-predicate-quoted-at-the-wrong-grain]]
  — and it failed in the *reassuring* direction, making C1a read as blocked-then-released instead
  of never started. C1a's status is unchanged by this build.
- ⭐ **The correction exposed a larger gap, filed as `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES`:**
  the disposal runbook covers **one of the two PHI-disposal substrates**. All four `dispose_*`
  doors erase PHI **in columns**, and no operational procedure covers them at all.
- The guard's refusal stays load-bearing for every non-disposal writer — the §E bound
  narrows by exactly one named, audited door.
- ✅ `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` is **RESOLVED 2026-08-19** on the build
  record above — the pgTAP + sweep evidence, not this text. ⛔ **For the MEETING lane only —
  see Amendment 2**: the same shape was measured live on 2026-08-20 in
  `guard_rca_child_lock`, `guard_capa_child_lock` and `guard_interview_child_lock`, and it
  still aborts `dispose_event_phi` / `dispose_case_phi`.
- ⚠ **Two residues found while building, filed rather than fixed** (neither is this ADR's
  subject, and Decision 1 binds the migration to amend nothing else):
  `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` (the door redacts three of
  `meeting_agenda_items`' four text columns — `title` survives, as do
  `meeting_attendees.{note,external_name}` and `meeting_closed_sessions.label`; ADR 0056 §2
  declares that scope, so the defect is the *claim*, not a regression) and
  `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`.
- ⭐ **The sibling question was measured rather than filed as a question**, and the answer was
  not the reassuring one: opening each disposal door's gate in turn shows `dispose_case_phi`
  (151, 314) and `dispose_referral_phi` (189) are **covered**, while **`dispose_event_phi` is
  BLIND** — its gate opened alone leaves the full suite **PASS**. So **2 of the 4** PHI-disposal
  doors were door-blind; this build closes one and files the other with its evidence. Neither is
  *vulnerable* — every gate is present and correct — but neither would have gone red if a
  refactor dropped it.

## Amendment 1 — `app.in_disposal_rpc` now has TWO readers (still one setter)

**2026-08-20 · PO-approved · migration `20261002000400` · pgTAP `351` t31/t32 ·
driven by ADR [0056](./0056-phi-disposal-closure-narrowed-claim.md) Amendment 1.**

> **The sentence this contradicts** is Decision 1, of `app.in_disposal_rpc`: "**read only**
> by `app.guard_meeting_child_lock` … **No other guard reads it**; no other door sets it."
> The second clause still holds. The first is now false.
>
> **Decision 1 is amended** to: set **only** by `public.dispose_meeting_minutes`, read by
> `app.guard_meeting_child_lock` **and `app.guard_reserved_child_lock`**, each of which
> stands aside iff the flag is `'on'`. **One setter, two readers.**
>
> **Why the widening was necessary rather than convenient.** ADR 0056 Amendment 1 widened
> the erasure to `meeting_closed_session_items.{substance, decision, withdrawals}` — the
> reserved-deliberation text, the most sensitive free text in the meeting aggregate. Those
> rows are guarded by `app.guard_reserved_child_lock`, a *different* function that had **no
> stand-aside branch at all**. On a locked meeting — precisely the population disposal
> targets — the widened UPDATE raised `check_violation` and rolled the whole erasure back:
> **the identical failure shape this ADR exists to fix, one table over.** The original
> build fixed the guard it was looking at; the sibling guard, protecting a table two levels
> down, was never in view.
>
> ⚠ **The invariant this ADR actually protects is unchanged.** It was never "exactly one
> guard reads the flag" — it is *only the disposal door bypasses the child lock*, and that
> is preserved exactly: the setter count is what bounds the bypass, and it is still one.
> Decision 1's arithmetic was a description of the implementation, not the guarantee. It is
> corrected here rather than left to rot, because a stale bound in the ADR that documented a
> stale comment is the defect this ADR was written about.
>
> ⛔ **The rejected shape stays rejected.** This is NOT widened to `app.in_meeting_rpc`,
> which 26 `public.*` doors set. `351` t32 pins that on the *second* guard exactly as `348`
> t6 pins it on the first: a closed-session-item UPDATE with `app.in_meeting_rpc = on` is
> still refused. Mutation-proven — flipping the new branch to read `app.in_meeting_rpc`
> turns t32 red and nothing else.
>
> ⭐ **Both directions of the new branch were mutation-proven, because "disposal can now
> write closed-session items" is the weak half.** That claim is satisfied just as well by
> deleting the guard outright. Removing the stand-aside makes the door abort (`351` t8 red,
> and every downstream pin with it); widening it to `in_meeting_rpc` reds t32 alone. The
> pair is the over-grant twin — without it the stand-aside has no upper bound.
>
> **ADR 0126 §E** is unaffected in substance: each guard still reads exactly one flag,
> settable only by the disposal door, so the currency-exposure argument for
> agenda/attendee/closed-session content is undisturbed. The count of guards holding that
> property changed; the property did not.

## Amendment 2 — the class this ADR closed was closed for ONE lane; three siblings still have it

**2026-08-20 · measured (lead) while measuring
`FUP-CORRECTION-CORRIDOR-COVERAGE-UNMEASURED` · filed as
`BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW` · NOT yet fixed.**

> ⛔ **Consequences above record `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` as RESOLVED.
> That is true of the meeting lane and of nothing else.** `app.guard_rca_child_lock`,
> `app.guard_capa_child_lock` and `app.guard_interview_child_lock` read **no `app.in_*` GUC
> at all** — the identical body shape this ADR's Context describes — and they sit on tables
> `dispose_event_phi` and `dispose_case_phi` write. Measured by **execution**, each against a
> matched positive control:
>
> - `dispose_event_phi` raises **`HC047`** when the lane's RCA is `completed` (the normal end
>   state of a finished investigation), and **`HC049`** when the CAPA plan is `completed` or
>   `cancelled`.
> - `dispose_case_phi` raises **`23514`** when the case has a `completed`/`cancelled` interview
>   with subject rows.
> - Controls: the same doors succeed with rca `in_progress` / interview `awaiting_follow_up`,
>   and `dispose_meeting_minutes` on a `distributed` meeting succeeds (this ADR's fix working).
>
> The raise aborts the RPC, so **nothing is erased** — the same fail-closed-against-a-legal-
> obligation this ADR was written to remove.
>
> ⭐ **How it survived this build.** The Consequences DO carry a sibling sweep — but it asks
> *"which of the four disposal doors is gate-BLIND?"*. The question never asked was *"which
> other child locks lack the stand-aside?"*. **Two different sibling axes; sweeping one reads
> as having swept the class.** The enumeration was bounded by the **instance** (this door, this
> guard), not by the **property** (a state-locking child guard on any table an erasure door
> writes). Re-run by property, that crossing returns **15** candidate guards, **3 confirmed**;
> the remaining twelve are unproven either way, not cleared — a candidate count is not a defect
> count.
>
> **The fix shape is this ADR's own Decision 1, repeated per lane** — extend
> `app.in_disposal_rpc` (still set only by disposal doors) to the three child locks. Shape 1
> stays rejected for exactly the reason given above: honouring each lane's own RPC flag would
> grant every safety/interview RPC child-write power over locked parents. Carry the same
> obligations, per lane: the no-flag differential, and the sibling-RPC over-grant twin.

## Amendment 3 — the three siblings are FIXED, and the population was TEN across FOUR guards

**2026-08-20 · `backend` · migration `20261003000000_disposal_flag_through_sibling_child_locks.sql`
· suite `supabase/tests/353_disposal_child_lock_siblings.sql` (60 tests) · census
[`docs/reviews/disposal-guard-crossing-census.md`](../reviews/disposal-guard-crossing-census.md).**

> **Amendment 2's fix shape, executed.** `app.in_disposal_rpc`'s stand-aside — copied VERBATIM from
> `app.guard_meeting_child_lock` — is now in `app.guard_rca_child_lock`,
> `app.guard_capa_child_lock` and `app.guard_interview_child_lock`, and both remaining doors set
> the flag around their own guarded child writes. Shape 1 stays rejected.
>
> ### The population was larger than Amendment 2 recorded, in two ways
>
> **1. TEN statements across FOUR guards, not nine across three.** The tenth —
> `dispose_case_phi` → `update public.meeting_cases` — needed **no guard change**:
> `app.guard_meeting_child_lock` has read `app.in_disposal_rpc` since Decision 1, and
> `dispose_case_phi` simply never set it, while carrying the inline comment
> `-- for meeting_cases child-lock` beside its `app.in_meeting_rpc` line. That comment was
> **false against the live guard** (the flag it names reaches the parent-table guards only) and is
> corrected in the same migration, per Decision 2. ⭐ **The defect this ADR exists to document — a
> comment asserting a bypass the guard it names does not implement — was sitting in the sibling
> door the whole time, written by the same fix.**
>
> **2. The candidate crossing is 48, not 15 — and 51 with the cascade closure.** Amendment 2's
> "15 candidates, 3 confirmed" was bounded to `dispose_event_phi` + `dispose_case_phi`. Re-derived
> across all four doors, with `--` comments stripped before the regex and with the DELETE targets
> followed through `ON DELETE CASCADE`, the property returns **51**, verdicted
> **14 CONFIRMED-reachable / 9 STRUCTURALLY-UNREACHABLE / 28 NON-BLOCKING** (the parts sum). The
> census file carries the per-row verdict, the mask bit that proves each unreachable row, and the
> query to re-run it.
>
> ### Four windows, not one — tighter than the shape ruled for
>
> The guarded child writes in each door form **two non-adjacent runs**, so each door opens a narrow
> window per run. No window spans `capa_plan`, `cases`, `documents` or `file_objects` at all, which
> **removes** the "a future trigger inside a wide window would stand aside silently" residual rather
> than documenting it. Measured after the change, from `pg_trigger`: every table inside a window
> carries exactly its intended child lock, and **no excluded table carries any trigger that reads
> the flag**. The bound remains the setter count: **3 setters (all disposal doors) · 5 readers (all
> child-lock guards)**, both re-derived from `pg_proc` after the migration.
>
> ### Mutation-proven in BOTH directions, per lane
>
> Green-on-first-run is not evidence, so each direction was executed, each restore hash-verified
> before the next ran:
>
> | mutation | suite `353` result |
> |---|---|
> | stand-aside REMOVED from `guard_rca_child_lock` | RED t5, t6, t7, t9 |
> | …from `guard_capa_child_lock` | RED t18-20, t22, t29-30 (both `completed` and `cancelled`) |
> | …from `guard_interview_child_lock` | RED t35-37, t39, t46-47 (both terminal states) |
> | `dispose_case_phi` window 2 never opens (the pre-fix state for #10) | RED t52-54 |
> | `guard_rca_child_lock` WIDENED to `app.in_safety_rpc` (shape 1) | RED t13-14 |
> | `guard_interview_child_lock` WIDENED to `app.in_interview_rpc` (shape 1) | RED t43-44 |
>
> ⭐ **Every lane's keystone asserts the CLASS-1 PHI IS GONE** (`event_patient` / `patient_identifiers`
> at zero, `phi_disposed_at` stamped), not merely that free text redacted. On the failing path
> NOTHING is written — including the redaction — so a redaction-only suite goes **green while the
> PHI survives**. That is the trap this bug is made of, and t6/t19/t36/t53 are what avoid it.
>
> ### The legal-hold sibling, settled rather than left implicit
>
> The census's other CONFIRMED-reachable class is `HC0D3`: with an unreleased
> `document_legal_holds` row, `app.guard_file_object_transition` aborts `dispose_case_phi` and
> `dispose_referral_phi` — **the identical fail-closed shape, with PHI surviving**, executed with a
> matched control (no hold ⇒ door completes, `patient_identifiers` = 0; hold ⇒ HC0D3,
> `patient_identifiers` = 1). ⛔ **The INTENT is opposite**: a live retention obligation outranks an
> Art. 18 erasure. `dispose_referral_phi` already said so in its body; `dispose_case_phi` did not,
> and now does. No pin is added here — the guard arm is pinned three times already, and pinning
> *"erasure is refused"* would freeze a **policy**, not a mechanism; that needs a PO reading first.
>
> ### Gates
>
> Fresh `supabase db reset`: pgTAP **6789/6789** (205 files; +60 from `353`, +12 from `354`) ·
> lint 8/8 · `tsc` clean · vitest 1512/1512. `ARM=census` · `ARM=hat` · `ARM=floor` ·
> `FROMFINDINGS=1 ARM=wrapper` all HOLD. The diff-scoped door sweep's case list is **EMPTY by the
> recipe's syntax filter** (trigger functions and `if not (...)` inside a door match no
> `^(is_|can_|has_)` pattern; zero RLS policies in the diff) — exactly as it was for this ADR's
> first build — so the three rewritten `public.*` doors were swept **by the property** instead,
> each gate opened in turn against the full suite: `dispose_event_phi` **COVERED**,
> `dispose_case_phi` **COVERED**, `create_dsr_request` **COVERED**. **0 BLIND.**
