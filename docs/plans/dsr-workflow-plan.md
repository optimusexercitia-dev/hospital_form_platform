# DSR ("Direitos do Titular") — implementation plan

**Status: IN PROGRESS — Slices 1, 2 and 3 SHIPPED (2026-08-19 / 2026-08-20 / 2026-08-20);
Slice 4 not started.** ADR 0130 moved **Proposed → Accepted 2026-08-20** on PO instruction, which
lifted the original "nothing may be built" hold. Design ratified by the PO in a structured
sixteen-decision session on 2026-08-19; the binding decisions live in ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) (workflow) and ADR
[0129](../decisions/0129-meeting-child-lock-disposal-flag.md) (prerequisite fix), with
counsel's retention ruling recorded in ADR
[0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amendment 1**. This
document is the *how*; where it disagrees with those ADRs, the ADRs win; where either
disagrees with the live catalog, **the catalog wins** (CLAUDE.md graphify exception).

**For the session that picks this up, in order:**
1. Read ADR 0129 + ADR 0130 + ADR 0035 Amdt 1 (short).
2. Re-measure every "Measured inputs" row below — they were true on 2026-08-19 and
   nothing gates their staleness.
3. ✅ **Counsel's Q14 return ARRIVED 2026-08-19** (ADR 0035 Amdt 1 resolution + ADR 0130
   **Amendment 1**): committee records are NOT prontuário (CFM 1821 does not attach);
   removal requests adjudicated **case by case with legal consultation**; 20-yr retention
   adopted **by default as institutional policy**. Nothing blocks on counsel anymore.
   ✅ **The one open kickoff confirmation is CLOSED (PO, 2026-08-19): `legal_consultation_ref`
   is NOT NULL for `granted` / `granted_partial` / `refused_retention`, optional for
   `refused_identity` / `withdrawn`** — exactly as 0130 Amdt 1 item 3 drafted it, and it is
   **BUILT** (the `dsr_requests_legal_consultation` CHECK + the door's pt-BR refusal, 349 t29/t31).
4. Read `docs/progress/authz-handoff.md §7` before any RLS/gate work (standing ⭐ rule).
5. **Start at Slice 4** — Slices 1, 2 and 3 are shipped. ⛔ Read ADR 0130 **Amendment 3**
   first: six shape changes measurement forced on Slice 3, plus two live defects found in
   passing and one ACL over-grant an existing pin caught. Slice 4 is residue + copy honesty
   (notification scrubbing in the four dispose doors); it is independent of Slice 3.

---

## 0 · Measured inputs (2026-08-19 — RE-MEASURE, never quote)

All from the live local catalog (`pg_get_functiondef` / `information_schema`), not
migration text:

| Fact | Measured value | Why it matters |
|---|---|---|
| `search_patient_xref(p_mrn, p_encounter, p_hospital_id)` | exists; SECURITY DEFINER; gate `app.is_pqs_operator_of(hospital)`; exact hashed match via `app.derive_patient_key`; audits `patient.searched` on ≥1 match | The discovery door. S3 adds the one deliberate widening: an `app.is_dpo_of(hospital)` arm |
| `patient_xref` | `(module, entity_id)` PK; `module ∈ {event, referral, case}`; has `disposed_at`, `disposed_reason` | Mechanical-tier census source; disposal history for idempotence (Q16iv). **Meetings are not in it** — meetings enter DSRs only via the attested tier |
| Disposal-door gates | `dispose_case_phi` → `is_staff_admin_of` only; `dispose_event_phi` / `dispose_referral_phi` → tenancy + PQS/NSP arms; `dispose_meeting_minutes` → `is_staff_admin_of` OR `is_tenancy_admin_of` | Executor assignment routing (S2). ⛔ **None of these gates change** in this program |
| `app.is_tenancy_admin_of_for` | admits `org_admin` (org) and `hospital_admin` (hospital) | hospital_admin already passes 3 of 4 doors; cases are the deliberate exception |
| `app.guard_meeting_child_lock` | reads **no** GUC; raises on `in_signature/signed/distributed/cancelled`; installed on 4 child tables | The 0129 subject. Its raise set does **not** include `revoked` |
| `reopen_meeting` | sets `status = 'revoked'` | The surgical-redaction corridor (Q10a): revoke → edit → re-sign; revision bump invalidates prints (ADR 0126) |
| `notifications` | has `title`, `body` (entity-derived text); **no dispose door touches the table** | The Q12a residue class the doors will scrub |
| Dispose UI census | Only referrals have a component (`referral-dispose-dialog.tsx`); case/event actions exist with **no** caller; meetings have **no action and no UI** | S2/S3 build the single inbox instead of 4 module UIs |
| Feature flags | `app.feature_flags(key, enabled, description)`; one key per module | New key: `dsr` |
| Route precedent | `/o/[org]/nsp` (hospital-scoped internally, has `pacientes/` search UI), `/o/[org]/qualidade` | Mount: `/o/[org]/titulares` |

## 1 · The sixteen ratified decisions (index)

Q1a adjudication workflow, refusal first-class · Q2b split powers, zero door widenings ·
Q3a MRN/encounter-exact discovery only · Q4a hospital-scoped, silent · Q5a two-tier claim
· Q6 hash-only DSR record (Rule 12's "exactly three" survives) · Q7b per-hospital `dpo`
capability grant + the one named search-door widening · Q8b single task inbox, executors
under their own sessions · Q9 outcome enum + required refusal basis + due-date badge (no
scheduler) · Q10a revoke corridor for prose redaction (⛔ no in-place redaction door) ·
Q11 child-lock fix shape 2 (ADR 0129) · Q12a notification scrubbing in doors + fixed
residue language · Q13a slice order below · Q14a counsel-return handling — ✅ RETURNED
same day, settled via ADR 0130 Amdt 1 (nothing blocks) · Q15 the paper trail (this
commit) · Q16 `/o/[org]/titulares`, flag `dsr`, two-phase close, xref-based idempotence.

## 2 · Slices

### Slice 1 — the child-lock fix (ADR 0129). Standalone; FIRST; small.

Backend only. ✅ **SHIPPED 2026-08-19** — migration
`20260930000100_disposal_flag_through_meeting_child_lock.sql`, suite
`supabase/tests/348_disposal_flag_meeting_child_lock.sql` (15 tests). ⛔ **CORRECTION: it does
NOT unblock C1a §3.** That link was wrong in grain — C1a is a run of the disposal runbook, which
is the `file_objects`/Storage path, and `dispose_meeting_minutes` is disjoint from it in the
catalog. What Slice 1 fixes is **meeting-minutes erasure**; C1a's status is unchanged. Full
record: ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md) § Build record +
Consequences.

1. Migration: `app.guard_meeting_child_lock` gains the single
   `current_setting('app.in_disposal_rpc', true) = 'on'` stand-aside;
   `dispose_meeting_minutes` sets/resets that GUC around its child UPDATE and its false
   comment is corrected. **Same migration** amends nothing else.
2. Amend ADR 0126 §E in the same commit (its "reads no RPC flag at all" bound goes
   false — ADR 0129 Decision 3).
3. pgTAP (new numbered suite): the locked-WITH-agenda fixture — success path, the
   no-flag differential, the sibling-RPC over-grant twin (0129 Obligations, all three).
   ⚠ Fixture must enable the meetings flag (pgtap-fixture-flag-gaps).
4. Gates: `npm run test:db` on a **fresh reset**; `ARM=census`, `ARM=hat`, `ARM=floor`,
   `FROMFINDINGS=1 ARM=wrapper`; **diff-scoped door sweep** over exactly the two changed
   objects (derive the list from the migration diff, never by hand — ADR 0079 Amdt 1).
5. Register: move `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` to resolved **only on
   this evidence**; C1a's blocker note in PROGRESS.md § Now comes off in the same edit.

**After S1 (not part of it):** the C1a §3 disposal rehearsal can run
(`docs/deployment/phi-disposal-runbook.md`), and it **must name a locked meeting WITH
agenda items as a fixture**. That rehearsal is PO/lead-sequenced work, not this plan's.

### Slice 2 — minimal execution corridor. ✅ SHIPPED 2026-08-20. Discharges pilot-gate item 0.

The smallest thing that makes "a persona can reach a dispose affordance AND pass the
gate" true (dm5-po-decisions § "Remaining pre-pilot work" item 0) — **run and recorded**
there: `pqs.a@test.local` reaches `/o/rede-a/titulares` and passes `dispose_event_phi`,
both halves executed in a browser.

**Built:** migrations `20261001000000` (the `dpo` capability + `app.is_dpo_of[_for]`),
`20261001000100` (`dsr_requests` / `dsr_tasks` + RLS + the three doors),
`20261001000200` (the two console listers); suite
`supabase/tests/349_dsr_request_workflow.sql` (53 tests); `e2e/dsr-subject-requests.spec.ts`
(5 tests); `/o/[org]/titulares` + `src/lib/dsr/` + `src/lib/queries/dsr.ts`.

**Four shape changes measurement forced, all recorded in ADR 0130 Amendment 2** — read it
before extending any of this: the `dpo` grant moved here from Slice 3; `complete_dsr_task`
verifies the EFFECT rather than mirroring four gate expressions; the fan-out never mints
`dispose_meeting` (so **ADR 0056 Consequence (a)'s meetings-dispose UI is Slice 3's**, not
this one's); an unroutable xref row raises instead of being dropped.

⭐ **Two things the build found that the plan could not have predicted:**
1. **`patient_xref` keys the CASE module on a `patient_participants` id, not a case id**,
   while `dispose_case_phi` takes a CASE id. Believing the module name would have shipped a
   case lane that fails closed forever, silently. Pinned by 349 t10b.
2. **`hospital_dpos_select` was BLIND when first written** — opening it left all 46 tests
   green, in the same slice whose suite header warns about exactly that. Found by the
   neutralization sweep, not by review; t32k/t32l exist because of it.

⚠ **And a harness lesson worth more than either.** The first neutralization sweep's
"restore" was a silent no-op (`docker exec … psql -f <hostpath>` resolves INSIDE the
container), so five neutralizations **accumulated** and each verdict after the first was
meaningless — the rising failure counts were the only tell. The replacement harness proves
both channels before touching anything real: a probe mutation must move
`md5(pg_get_functiondef)`, and the restore must move it back. Its first version's proof was
itself vacuous for the same path reason. **A rollback you have not watched succeed is not a
rollback.**

1. **Schema core** (PHI-free, additive): `dsr_requests` (id, hospital_id, patient_key,
   encounter_key nullable, file_ref text, status
   `open/adjudicated/executing/closed`, outcome nullable
   `granted/granted_partial/refused_retention/refused_identity/withdrawn`,
   outcome_basis text — **NOT NULL when outcome is a refusal** (CHECK),
   **legal_consultation_ref text — NOT NULL for granted/granted_partial/refused_retention**
   (CHECK; ADR 0130 Amdt 1 — confirm the split at kickoff), received_at,
   due_date, closed_at/by, created_by, timestamps) and `dsr_tasks` (id, request_id FK,
   kind `dispose_case/dispose_event/dispose_referral/dispose_meeting/attest_review/
   notify_scrub_check`, module+entity_id (nullable for attestation tasks),
   commission_id/hospital_id for routing, assigned-role descriptor, status
   `pending/done/blocked`, completed_at/by, note). RLS: DPO of the hospital reads/writes
   requests; executors read tasks routed to a scope they hold a qualifying hat in;
   platform_admin sees **neither** (noun rule).
2. **Doors** (all `prosecdef`, all swept): `create_dsr_request` (DPO-gated; resolves
   `patient_key` via `app.derive_patient_key`; fans out `dsr_tasks` from
   `patient_xref` rows for the hospital — the mechanical tier; already-disposed xref
   rows become pre-completed history tasks, Q16iv); `complete_dsr_task` (executor:
   requires the task's own door-gate predicate to pass for the caller — the task is
   *completable* only by someone who could fire the door); `close_dsr_request`
   (DPO-only; refuses while tasks are pending unless outcome is a refusal/withdrawn).
3. **UI minimal**: `/o/[org]/titulares` behind flag `dsr` — an executor task inbox:
   my tasks, each linking the entity and hosting the execute affordance, which calls
   the **existing** module action (`disposeReferralPhi` etc.) under the executor's own
   session, then `complete_dsr_task`. Meetings lane: a thin `disposeMeetingMinutes`
   server action (none exists — ADR 0056 Consequence (a)) called from the same inbox.
   Reuse `referral-dispose-dialog`'s shape but with the S4 copy (if S4 hasn't landed,
   ship with the corrected residue copy from day one — do not propagate the over-claim).
4. pgTAP: gate matrix per door (DPO/non-DPO/cross-hospital/executor-wrong-hat), refusal
   CHECK, fan-out vs xref fixture, pre-completed history behavior. E2E: one corridor —
   DPO creates request → PQS executor disposes a referral from the inbox → task done.
   Keyboard flow included (§8 accessibility bar).
5. **Pilot-gate item 0 check, run and recorded**: name the persona (seed: `nsporg.a` or
   a tenancy admin holding the referral-door arm) who reaches the inbox AND passes
   `dispose_referral_phi` — catalog-verified, written into the item-0 row.

### Slice 3 — adjudication, the attested tier, the one named widening. ✅ SHIPPED 2026-08-20.

**Built:** migrations `20261002000000` (the `search_patient_xref` widening + a case-grain
display fix, isolated so the diff-scoped sweep has a two-object case list) and
`20261002000100` (the decision stamp, the attestation columns, `adjudicate_dsr_request`,
`attest_dsr_task`, `list_dsr_disposable_meetings`, and the three changed doors); suite
`supabase/tests/350_dsr_adjudication_and_attested_tier.sql` (⛔ **count deliberately not restated here — read its `select plan(N)`**; a prose number about a machine-checkable fact has no gate, and this one was stale by six within a day); `src/lib/dsr/*`,
`src/lib/queries/dsr.ts`, `src/lib/meetings/actions.ts` (`disposeMeetingMinutes` — ADR 0056
Consequence (a), never built until now), `src/components/dsr/*` + the console lanes.

**Six shape changes measurement forced — all recorded in ADR 0130 Amendment 3**, read it
before extending any of this. Headlines: `adjudicated` was UNREACHABLE (the lane was a
fiction); close now CONSUMES the decision and the direct path survives only for outcomes
that erase nothing; the `dispose_meeting` escalation is explicit per meeting and bounded by
its own request; and **two of the three attested-tier populations this plan named turned out
to be MECHANICAL** — `dispose_case_phi` already erases narratives and case-linked responses,
so the attested tier is meeting prose plus non-case commission free text, and nothing else.

⭐ **Three things the build found that the plan could not have predicted:**
1. `app.patient_trajectory_bundle` rendered EVERY case entry's code as `—`, always, in the
   PQS console too — it compared a `patient_participants` id to `cases.id` (the Slice-2
   grain). A live display defect inside the door being widened.
2. `complete_dsr_task` OVERWROTE the minted procedure text with the completion note, so an
   attestation task's revoke-corridor instructions were destroyed at the moment they were
   being followed.
3. ⚠ The author over-granted `app.patient_trajectory_bundle` — the raw, ungated PHI
   assembler — to `authenticated`, by applying the house `grant to authenticated,
   service_role` idiom to a **rewrite**. Suite `152` §M1 caught it. `CREATE OR REPLACE
   FUNCTION` does not reset an ACL; leave a rewrite's grants alone.

⚠ **And the authz finding that matters most for the next slice.** All four arms
(`census`/`hat`/`floor`/`FROMFINDINGS=1 wrapper`) HOLD — and **none of them can see this
slice's gate change**. ARMs 1/3/5 bound their domain by boolean-ness, the row-door sweep by
row-returning-ness; `search_patient_xref` and all three new doors are `prosecdef` scalar
non-bool command doors (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`). The diff-scoped recipe's own
`^(is_|can_|has_)` filter yields an **empty** case list here, and a `CASES=`-scoped row-door
run swept **0**. Coverage is a hand-run 37-probe neutralization battery, one at a time, every
restore hash-verified — per-keystone verdicts in `350`'s header. Do not read a green arm as a
verdict for this class.

### Slice 3 — original plan (kept for the record)

1. **`dpo` capability**: per-hospital grant table (ADR 0061 `administrativo` pattern) +
   `app.is_dpo_of(hospital_id)` + grant/revoke doors (org/hospital admin), audited.
2. **The one widening**: `search_patient_xref` gains the `is_dpo_of` arm — full
   ADR-0079 treatment (diff-scoped sweep of that door, census/wrapper arms, pgTAP
   matrix incl. cross-hospital DPO refused).
3. **Intake UI** (DPO lane at `/o/[org]/titulares`): search (MRN/encounter exact only),
   create request (hash + file_ref; the UI **never** shows patient identity — Q6),
   adjudicate (outcome + required basis on refusal), due-date badge (15 days;
   badge only, nothing scheduled), close (two-phase: refuses while tasks pending).
4. **Attested tier** (Q5a): `attest_review` tasks per commission-with-plausible-prose
   (meetings, non-case responses, narratives); completed by that commission's
   staff_admin with reviewer name + redaction count in the note. The **procedure** for a
   found mention is the revoke corridor (Q10a) — document it in the task's UI copy;
   ⛔ build no in-place redaction door.
5. ✅ Counsel-return integration (Q14a) — **settled, nothing waits** (ADR 0130 Amdt 1):
   default stance = 20-yr institutional-policy retention, adjudication case-by-case with
   counsel; `refused_retention` copy cites **the institutional policy, never CFM 1821**
   (counsel held it does not cover these records — citing it to a data subject would be a
   false legal basis); the adjudication UI captures `legal_consultation_ref`. Keep the
   copy behind a constant regardless — the next counsel refinement is then a one-file
   change.

### Slice 4 — residue + copy honesty (Q12a; independent of S3, after S2).

1. Extend all four dispose doors: scrub `notifications.title/body` for the disposed
   entity (`entity_type`,`entity_id`) — one pgTAP pin each (insert a notification for
   the fixture entity, dispose, assert redacted; plus the vacuity control: a sibling
   entity's notification survives).
2. **Fixed residue language** (pt-BR), one shared constant, rendered in the outcome
   record and all disposal confirmations: DB PHI erased; attachment bytes retained
   encrypted under the 20-yr regime (ADR 0056 §4); Cloud byte-deletion verified at
   metadata level only; PITR window retains erased content ~N days; distributed/printed
   copies out of reach. Decided once here — operators never improvise it.
3. Rewrite `referral-dispose-dialog.tsx` copy with it — closes
   `FUP-DISPOSE-DIALOG-OVERCLAIM` (the shipped "apaga permanentemente … todos os campos"
   over-claim vs ADR 0056's narrowed claim).

## 3 · Explicitly out of scope

- Any disposal-gate widening (Q2b). Any name/substring patient search (Q3a). Any
  cross-hospital surface (Q4a). Storing patient identity in DSR rows (Q6). An in-place
  locked-content redaction door (Q10a). A scheduler/cron (Q9iii; C1's finding stands).
- The C1a/C1b rehearsals themselves and the disposal-job decision (Critical FUP C1) —
  unblocked by S1, owned by PO/lead.
- The `superseded` vs `retention_expired` reason value — stays with the D11 implementing
  slice (ADR 0121 Amdt 2).
- `FUP-XREF-PEPPER-ROTATION-ORPHANS` — filed, related (disposal makes pepper rotation
  irreversible for disposed rows), not this program's to fix.

## 4 · Risks & watch-items for the implementing session

- **Rule 12 census language**: `dsr_requests` must never grow a name/MRN column without
  an ADR amending Rule 12 (it would be a fourth PHI module). Guard: a pgTAP pin
  asserting the table has no columns beyond the declared set is cheap and catches the
  well-meant "just add the name" patch (removing-a-subject caveat: pin the positive
  column list, not "has no name column").
- **`complete_dsr_task` must not become a second door**: it verifies the caller *could*
  fire the module door but never fires it — keep execution in the module action under
  the caller's session, or the inbox becomes a DEFINER bypass of four gates.
- **Two sessions, one local DB** while S1 and the rehearsal are in flight — single
  owner for the stack (shared-local-stack rule).
- The E2E suite has a standing flaky baseline and the print corridor needs its sidecar —
  don't read uniform login failures as product defects (`docs/testing/`).
- New doors are new census subjects: every added `prosecdef` function enters
  `ARM=census`'s domain on creation — a NULL `proacl` includes PUBLIC (the
  guards-that-fail-open family); diff from the catalog after each migration.
