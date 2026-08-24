# ADR 0137 — MRN as the LGPD erasure key; the case/referral usability batch

- **Status:** ACCEPTED 2026-08-23 (PO ruling on 12 questions). ⛔ **Build NOT started** — the
  implementation plan is separate: [case-referral-usability-batch.md](../plans/case-referral-usability-batch.md).
- **Amends in effect:** ADR [0038](0038-case-patient-identifiers.md) (the process PHI switch stops
  being a boolean), ADR [0037](0037-inter-committee-case-referrals.md) (referral PHI stops being
  optional), ADR [0134](0134-case-surface-split-and-administrativo-case-read.md) (D1's
  *second* sentence gains the affordance it always implied). **Supersedes:** nothing.
- **Does NOT change** Rule 12's perimeter: still exactly three patient-PHI modules, same isolation,
  same audited doors. This batch changes *how much* is collected and *when it is required* — never
  *who may read it* and never *where it lives*.

## Context

Two unrelated pressures arrived together and are ratified together because they touch the same
surfaces.

**1. The regulatory one, and it is the load-bearing half.** The platform's PHI posture (Rule 12,
ADRs 0030/0035) was written around *minimum-necessary collection*. It was not written around
**erasure**. LGPD gives a data subject a right to erasure, and ADR
[0131](0131-phi-erasure-reach-bounded-to-designated-fields.md) already bounded the *reach* of an
erasure to designated fields. What neither ADR settled is the **lookup**: to erase a patient's
records you must first be able to *find* them, across three isolated modules, without a shared
patient master (which D5/§6.2 of ADR 0064 explicitly dropped).

A patient **name** cannot do this job. It is not unique, it is transcribed inconsistently, and it
is exactly the field an erasure removes — so a name-keyed index is destroyed by the first erasure
it serves. The **MRN (prontuário)** is the hospital's own stable, unique patient key. It is the
only identifier the platform collects that can answer *"which rows are this person's?"* on demand.

⭐ **PO ruling: the MRN is the erasure key, and the platform's compliance posture depends on it
being present.** The current floor — `name OR mrn`, enforced in the action layer of all three
modules — permits a name-only record, which is a record the platform **cannot later erase on
request**. That is not a minor gap; it is a compliance hole dressed as flexibility.

⭐ **This is deliberately NOT a weakening of the PHI posture, and the reasoning must survive.** The
platform already spent the isolation, the RLS, the audited doors and the at-rest encryption. Having
paid for the safe, refusing to store the one field that makes the contents retrievable buys no
privacy — it only buys unusability plus an unerasable archive. Requiring the MRN *increases* the
number of records that can be honoured under an erasure request.

**2. The operational one.** Six usability defects reported against the case and referral surfaces,
each small, several sharing the same files. They are batched with the MRN work because the process
PHI configuration, the Novo-caso dialog and the referral wizard are exactly where both land.

## Decisions

### The MRN / PHI-collection model

- **D1 — The process PHI switch becomes a three-mode setting.** `process_template_versions
  .collects_patient boolean` (and its snapshot `cases.patient_enabled boolean`) is replaced by an
  explicit `patient_mode ∈ {'none','optional','required'}`:
  - `none` — no PHI block at all (today's `collects_patient = false`).
  - `optional` — the block is offered and may be left empty (today's `collects_patient = true`).
  - `required` — the block must be filled to create the case.
  Backfill is total and mechanical: `true → 'optional'`, `false → 'none'`. ⚠ **`optional` is the
  backfill target, never `required`** — a boolean carries no evidence that any existing process
  intended mandatory collection, and guessing `required` would retroactively invalidate live cases.
- **D2 — `required` carries an explicit field set, and the MRN is welded into it.**
  `patient_required_fields text[]`, snapshotted onto the case alongside the mode. The builder may
  add `name`, `date_of_birth`, `sex`, `encounter_ref`, `attending`; **`mrn` is always present and
  the UI must render it selected and non-interactive.** Excluded from the selectable set by
  construction: `age_years` (removed from every case surface — D9) and `unit` (the case collects a
  non-PHI department instead, which is why `PatientFields` already carries `hideUnit`).
  ⚠ **A set, not a bitmask or a per-field boolean column.** The set is read as a whole by three
  layers; splitting it into columns would let those layers disagree one field at a time.
- **D3 — Enforcement is three-layered, and the DB layer is the one that counts.** The DEFINER
  bodies that mint a case (`create_case_from_template`, `create_case`, `bulk_create_cases`) and the
  one that writes PHI (`set_case_patient`) raise a pt-BR refusal when a `required`-mode case is
  missing any field in its set. The server action pre-checks for a friendly message; the form marks
  the inputs required. ⛔ **The action-layer floor alone is explicitly rejected here**, reversing the
  pattern ADR 0038 shipped and `docs/reviews/case-patient-review.md` recorded: a compliance
  invariant that a direct PostgREST call can walk past is not an invariant. See ADR
  [0135](0135-authored-refusals-get-their-own-sqlstate.md) for the SQLSTATE the refusals take, and
  the `definer-rpc-gate-needs-table-level-enforcement` lesson (BUG-SUP-002) for why the guard must
  also hold against direct-table DML, not only against the RPC.
- **D4 — A referral always concerns a patient; the MRN is mandatory at SEND.** `send_referral`
  refuses a referral whose `referral_patient` carries no MRN. The existing `name OR mrn` floor on
  `save_referral_patient` is **not** tightened, so a partially-entered draft can still be saved.
  ⭐ **The rationale is not symmetry with cases — it is that a referral without a patient key is
  undeliverable work**: the receiving committee has nothing to look up, and a communication that
  needs no patient is a message, not an encaminhamento.
  ⚠ **A `none`-mode source case does not exempt the referral.** Case PHI and referral PHI are
  independently isolated (`patient_identifiers` vs `referral_patient`); the coordinator enters the
  MRN by hand. This is a real friction and is accepted deliberately.

  > ⭐ **MEASURED 2026-08-24, and it bounds what D4 can be cited for.** D4's floor is at *send*, so
  > it governs **entry, not persistence** — a post-review question was whether a later amend could
  > blank the key. Driven through a fixture
  > (`supabase/tests/365_referral_mrn_persistence_floor.sql`, 12 tests) it **cannot**: for any
  > non-`draft` referral, `set_referral_patient`'s own final statement
  > (`update case_referral set has_patient = true`) is refused by `app.guard_referral_status`
  > (**HC070**) and the PHI upsert rolls back with it.
  > ⛔ **Do NOT cite this as "D4 protects the stored MRN".** Nothing in `set_referral_patient`
  > inspects the MRN; a trigger placed there for *status immutability* closes it, three objects
  > away. Neutralized — adding `set_config('app.in_referral_rpc','on')` to that door, which is the
  > obvious way to implement post-send amendment — §1.2 reds with `have: NULL`, i.e. the blanking
  > is real and one edit away. §2.2 is the keystone that reds on that edit.
  > ⚠ Consequence for ADR 0078 D7: its `can_amend_referral_phi_snapshot` branch is unreachable for
  > every non-draft status. Registered as `FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD` — a decision owed,
  > not a hole (the wizard is drafts-only per D6, and the detail page offers no PHI edit).

### The referral wizard

- **D5 — Creation is deferred to the end; the draft becomes an explicit act.** Steps 2–3 buffer
  their picks and PHI **client-side**; nothing is persisted until the coordinator presses `Enviar`
  or `Salvar rascunho`, which flush in order (create draft → add shared items → save patient →
  send, for `Enviar`). `Salvar rascunho` sits left of the primary button on every step and enables
  as soon as step 1's required fields (type, destination, subject) are filled, because
  `create_referral_draft` cannot be called without them.
  ⭐ **A latent defect dies with this change and should not be re-introduced.** Today's
  `toggleNarrative`/`toggleDocument` call `addReferralSharedItem` with **both** source ids null on
  an *un*-pick and ignore the result — the frozen row is never removed server-side, only from local
  state. Buffering removes the round trip that made this possible; the flush only ever ADDs.
- **D6 — A draft referral is edited in the wizard; the detail page serves non-drafts.** Clicking a
  `rascunho` in the case's Encaminhamentos card reopens the wizard prefilled from
  `get_referral_detail` (header, picked items rehydrated from `source_narrative_id` /
  `source_document_id`, PHI via the audited `get_referral_patient` read on reaching the patient
  step). Non-draft statuses keep navigating to the detail page. The detail page keeps its
  discard-draft affordance.
- **D7 — A draft's destination is immutable, and the wizard says so.** `update_referral_draft`
  takes no target argument; the destination is fixed by `create_referral_draft`. On resume the
  destination renders read-only with a note to discard and restart. ⚠ **Accepted limitation, not an
  oversight** — widening the RPC means a new DEFINER arm and its own authz re-verification, which
  this batch does not buy.

### The case surfaces

- **D8 — Attributed work is ACTIONABLE on `/casos/[caseId]`.** An `active` phase whose
  `assigned_to` is the viewer renders a primary **Preencher** action (the existing
  `startOrResumePhase` path); an assigned narrative's affordance is promoted from a ghost icon
  button to a matching primary action. Both are keyed on `assignedTo === viewerId` and on **nothing
  else** — never on `caps`, so `narrowToReadingSurface` cannot take them.
  ⭐ **This is not an exception to ADR 0134 D1, it is the half of D1 that was never built.** D1
  reads *"the case as the committee sees it, PLUS the viewer's own name-attributed work"*, and
  `reading-surface.ts` documents that the assignee tests precede the capability tests precisely so
  this survives. The narrative branch honoured that (`canEditNarrative`); the phase branch never
  did — `CoordinatorPhaseActions` returns `null` for any viewer who is neither coordinator nor
  `assign_case_phases`, so a `staff_admin`, an `administrativo` **and** a plain member all saw an
  assigned phase they could not open. The fix is additive and touches no capability.
  ⛔ **It does NOT claim ADR 0134 Amendment 3's door exception** — that exception is for
  capability-invariant *case-wide* affordances and requires showing the door's guard from the live
  catalog. This is name-attributed work, which Amendment 3's first clause admits directly.
- **D9 — Novo caso drops `Unidade / setor` and `Idade`; existing values stay VISIBLE.** Both inputs
  are removed from every **case** surface (create dialog, edit-meta dialog, bulk wizard, patient
  edit dialog). Safety-event and referral flows keep `Idade`. **No backend change**: the columns,
  the RPC arguments and the stored values are untouched, and any case that already carries a
  department renders it read-only. A commission that needs a unit models it as a **process custom
  field** (ADR 0083). Rationale for `Idade`: a date of birth and a free-typed age are two
  statements of the same fact that drift apart, and only one of them is verifiable.
- **D10 — `case_narratives.type_label` → `display_label`, as a real column rename.**
  > ⛔ **AMENDED 2026-08-23 — the measured list below is WRONG in both directions. Re-measured:
  > 9 bodies reference `type_label`, splitting 6 must-rename / 3 must-not.
  > `public.update_case_narrative_body` does NOT reference the column at all and comes OFF the
  > rename set; `public.add_referral_shared_item`'s only `type_label` is
  > `v_narrative.type_label` — a `case_narratives` reference that MUST be renamed, so the "leave
  > its referral arm alone" caution below would ship a runtime break if obeyed.
  > Authoritative table + the two-sided keystone:
  > [the plan, Migration C step 12](../plans/case-referral-usability-batch.md).
  > ⭐ This is why the "measured cost" label is not a guarantee — the label is what stops the
  > next reader re-deriving it.**

  ⚠ **Measured
  cost, from the live catalog (`pg_get_functiondef`, not migration text — the CLAUDE.md binding
  exception):** seven function bodies mention both `case_narratives` and `type_label` —
  `app.trg_audit_case_narratives`, `public.add_ad_hoc_narrative`,
  `public.add_referral_shared_item`, `public.create_case_from_template`, `public.get_case_detail`,
  `public.list_my_cases`, `public.update_case_narrative_body` — plus the CHECK constraint
  `case_narratives_type_label_not_blank`. A `rename column` does **not** rewrite a stored function
  body, so all seven break at runtime unless re-emitted in the same migration. ⛔ Re-emit from
  `pg_get_functiondef`, never from migration text (`re-emit-definer-body-from-live-def`).
  `case_referral.type_label` is a **different column and is NOT renamed** — four of the functions
  that mention `type_label` (`create_referral_draft`, `update_referral_draft`,
  `get_referral_detail`, and the referral half of `add_referral_shared_item`) refer to that one.
- **D11 — `case_narratives.assignment_role_id` mirrors `case_phases`.** Nullable FK →
  `case_assignment_roles`, plus a `set_case_narrative_assignment_role` DEFINER twin of
  `set_case_phase_assignment_role`. ⚠ **Data model only in this batch — no UI.** The phase column
  has had no UI caller since ethics D10 (`setCasePhaseAssignmentRole` is an orphan action); the
  narrative column lands in the same state, deliberately, so the two stay symmetric and a later
  increment can wire both at once. `process_template_narratives` does **not** get the column, for
  the same reason: `process_template_phases` does not have it either.
- **D12 — `Registros` is redesigned as `Atividade`.** The `docs/design/temp/case_activity_card`
  handoff's chrome is adopted at high fidelity — header + subtitle, `Tudo / Atualizações / Sistema`
  filter pills, an inline composer, a timeline with a connector spine and tinted type icons.
  ⛔ **The handoff's four-type composer vocabulary is NOT adopted** — it is the *action-item*
  vocabulary. The card keeps the case's own six manual kinds (`note`, `meeting`, `decision`,
  `update`, `follow_up`, `other`), which are mirrored by `case_events_kind_check`, by
  `app.is_manual_case_event_kind` (the `kind` arm of four RLS write policies — BUG-CASEKIND-001)
  and by the referral internal-notes picker. Adopting four new kinds would be a three-place
  vocabulary migration for cosmetics.
  **`Sistema` is a client-side partition on `kind`**, over the ten procedural kinds the DB CHECK
  already allows and `listCaseEvents` already returns unfiltered. No new query, no merge of
  lifecycle facts from other tables. ⚠ One typing consequence: `CaseEvent.kind` is still declared
  `CaseEventKind` while the DB returns `AnyCaseEventKind` — the widening BE-5 deferred must land
  with this card, and `EVENT_KIND_LABEL` is already exhaustive over the wider union.
  The `coordinator_only` visibility badge survives the redesign unchanged.
- **D13 — The Process detail page adopts the case's work-shell.** The phase/narrative slot list is
  wrapped in the same titled container as `Trabalho do caso`, with the
  `Adicionar fase` / `Adicionar narrativa` buttons in its footer. **Shell only** — no progress
  meter and no status bar (a template has no progress to report).
- **D14 — `Tipo de caso` becomes draft-only on the Process detail page.** ⭐ **The reversal is
  cheaper than its citation suggests, and the finding is worth keeping:** the comment at
  `template-builder-shell.tsx:340` attributes *"Not draft-gated: … a live untyped process must stay
  fixable"* to **ADR 0064 D4**. ⛔ **This ADR previously said 0064 "contains no numbered decisions at
  all" — that was FALSE, and it is corrected here** (2026-08-23, QA re-measured): 0064 carries
  `### Decision 1` … `### Decision 4`. **The conclusion survives, on a different premise.** 0064 D4
  exists and defines the `case_types` table (`key`, `primary_subject_kind`, terminology overrides) —
  but it says **nothing about when the picker is editable**, so the draft-gating rule really does live
  only in that comment and there is still no ratified decision to overturn. This ADR is where the
  draft-only rule is now recorded, and the dangling citation is removed with it.
  ⚠ Keep the DISTINCTION: `template-builder-shell.tsx:186` cites `ADR 0064 D4` for the case-types
  table itself, which is **correct** and stays. Only the two draft-gating comments were wrong.
  ⚠ **The risk the comment named is real and is accepted:** a published Process with
  `case_type_id = null` becomes unfixable in place and must be re-drafted to be typed.

## Consequences

- **Two migrations, both additive-then-destructive.** The PHI-mode migration adds columns, backfills,
  re-emits the case-minting DEFINERs and only then drops the booleans; the narrative migration
  renames one column and re-emits seven bodies. ⚠ Deploy order is **schema first, then code** —
  additive migrations make old-code/new-schema safe and new-code/old-schema the broken state
  (the AFF2 lesson, PROGRESS.md § Now).
- **New DEFINER gates** (`set_case_narrative_assignment_role`, and the refusal arms added to the
  case-minting bodies) are **in no BLIND set**, so they pass `ARM=policy` vacuously. `ARM=census` is
  the arm that catches them (ADR 0079 Amdt 3), and every new `public.*` RPC needs
  `REVOKE ALL FROM PUBLIC` before its `GRANT` or the dashboard t19 pgTAP guard reds.
- **`required` mode can strand a workflow.** A commission that flips a live process to `required`
  makes case creation impossible for anyone without an MRN to hand. Mitigated by D1's mode living on
  the **template version** (so it is a versioned, publishable change) and by the snapshot onto the
  case (so live cases are unaffected).
- **The `name OR mrn` floors diverge across the three PHI modules.** Cases get a per-process
  required set; referrals get an MRN requirement at send; safety events keep `name OR mrn`
  unchanged. ⚠ **This asymmetry is intentional** — an NSP notification is often filed by someone at
  the bedside who has a name and no chart in hand, and blocking that notification is a patient-safety
  cost, not a compliance win. It is also the most likely thing a future reader will "fix"; do not.

## Open

- **Erasure lookup is not built by this ADR.** D1–D4 guarantee the MRN is *present*; they do not add
  the cross-module lookup that turns it into an erasure workflow. That is ADR 0131's territory and
  needs its own increment.
- **No retro-fill for existing PHI rows.** Records already written with a name and no MRN stay that
  way. Whether they need a remediation sweep is a PO question, not a build one.
