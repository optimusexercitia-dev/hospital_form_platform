# Accreditation & Quality-Governance Track — Phases 13–21

The detailed phase plan and per-phase acceptance criteria for the
accreditation-readiness track. This is the companion detail file to the
top-level **[PHASES.md](../../PHASES.md)** (which keeps the core-platform plan,
Phases 0–12, and the index of this track) — split out so the per-spawn read of
PHASES.md stays small. Each phase is gated by the Phase Gate in
**[CLAUDE.md](../../CLAUDE.md)** (§6) exactly like the core track; the ordering
hard-rule (no phase begins until the previous passes the gate and the human
approves) applies here too.

**Orientation first:** before building in this track, read
**[../quality-track-context.md](../quality-track-context.md)** — it carries the
track-wide context (fixed positioning, the conventions inherited by every phase,
the data-coupling map to the committee track, and the ADR/feature-flag index)
and defers to CLAUDE.md / ARCHITECTURE.md for the binding rules. The canonical
schema and architecture rules remain in **[ARCHITECTURE.md](../../ARCHITECTURE.md)**.

---

## Why this track exists

The platform is being positioned for hospitals that must satisfy — or want to
*prepare for* — accreditation (ONA in Brazil; JCI/Joint Commission internationally;
the ANVISA/RDC regulatory backdrop). Phases 0–12 make the platform an excellent
**committee-operations system**; this track makes it an **accreditation-readiness
system** by adding the three things surveyors actually score — a tamper-evident
audit trail, a closed PDCA/CAPA improvement loop, managed quality indicators — and
the engine that maps everything the platform produces to a specific accreditation
standard.

**Positioning: a governance / quality LAYER, now on HIPAA-compliant infrastructure.**
The platform documents committee *process, measurement, and improvement* beside the EHR.
As of ADR [0030](../decisions/0030-patient-safety-phi-and-pqs-architecture.md) it runs on
**Supabase's HIPAA-compliant offering (under a BAA)** and **PHI is in scope where the
clinical-governance domain requires it** — notably the **Phase-14 patient-safety / NSP
module**, which records patient context for events, RCAs, and CAPAs under HIPAA safeguards
(minimum-necessary RLS, isolated PHI tables, PHI-access auditing — ARCHITECTURE.md **Rule 12**).
Every *other* phase below stays **process/measurement-focused and PHI-free by design**, so
the no-patient-data discipline still holds everywhere it isn't needed. This **supersedes** the
blanket no-patient-data rule and 0028's rejected "minimal-identifiers" alternative.

**Conventions inherited by every phase here** (do not re-litigate per phase):
each new feature is **feature-flagged** (inserted OFF, flipped ON in-phase, mirror
the `meetings`/`interviews` pattern); custom errors continue the **`HC0xx`** class
from `HC042` upward; all writes go through RLS as the authority with narrow
`SECURITY DEFINER` exceptions documented in an ADR; all user-facing text pt-BR;
all explanatory/free text is **sanitized Markdown, never raw HTML** (Rule 7); every
mutation **emits an audit row** once Phase 13 lands (Architecture Rule 11); one
keyboard-only flow per phase; types regenerated after every migration. Built ahead
of Phase 9 (Deployment) — with the agreed plan (revised 2026-07-05, ADR
[0057](../decisions/0057-indicators-doc-control-replan.md)) to build the remaining
pre-pilot phases in order **15 → 17 → 16** (documents pulled PRE-pilot so the Phase-16
evidence picker ships with real controlled documents) and **deploy a pilot after
Phase 16**, then sequence Phases **18–19** on pilot feedback. **Phases 20–21, Referrals v2,
Interviews v2, Ethics E1–E3, action-items satellites + cross-link, §6.1, and the supersession
engine were pulled pre-pilot 2026-07-12 (ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md)) — the pilot now follows that
whole block.** Phase numbers are stable identifiers — only the build order changed.

---

### Phase 13 — Audit Trail (Trilha de Auditoria)
A system-wide, **append-only, tamper-evident** audit log: who did what, to which
entity, when. This is the data-integrity backbone (ALCOA+: Attributable, Legible,
Contemporaneous, Original, Accurate, **Complete, Enduring**) that JCI `MOI` and ONA
all lean on, and the cross-cutting contract every later phase honors. **No patient
data**: the log stores actor + action + entity reference + a non-sensitive field
diff, never answer payloads or free-text bodies. Establishes Architecture **Rule 11**.
Full design + rationale in ADR [0028](../decisions/0028-accreditation-governance-roadmap.md).
Feature-flagged behind `audit_trail`.
- **Schema** (migration `…120000`): `public.audit_log`
  (`id`, `occurred_at`, `actor_id → profiles` (nullable for system/service-role
  actions), `actor_is_admin` snapshot, `commission_id` (nullable for global/admin
  actions), `action` text (`'<entity>.<verb>'`, e.g. `form_version.published`,
  `member.added`, `case.status_changed`, `meeting.signed`, `signoff.recorded`,
  `response.opened_foreign`), `entity_type`, `entity_id`, `summary` (pt-BR short
  string), `metadata jsonb` (old→new for a curated allow-list of non-sensitive
  columns; NEVER `answers.value` or any `*_md`/free-text body), `seq bigint`
  (per-commission monotone via sequence), `prev_hash`, `row_hash`). **Tamper-evidence:**
  `row_hash = sha256(prev_hash || canonical(seq,occurred_at,actor,action,entity,metadata))`
  forming a per-commission (and a global) hash chain, computed in the DEFINER writer.
  **Append-only:** `app.guard_audit_immutable` BEFORE UPDATE OR DELETE raises (no row
  is ever mutated or removed, even by service role). New SQLSTATE `HC042`
  (append-only violation — internal, never user-facing).
- **Capture mechanism:** a single DEFINER writer `app.audit_write(action, entity_type,
  entity_id, commission, summary, metadata)` (advisory-locked per commission to serialize
  the chain). Writes are driven by **AFTER INSERT/UPDATE/DELETE triggers on a curated set
  of high-value tables** (forms/versions/sections/items, commission_members, responses
  status flips, signoffs, cases + case_phases status, meetings + signatures, interviews,
  controlled docs/CAPA/indicators/evidence as those land) so coverage is **path-independent**
  (catches both RPC and direct-table writes). Service-role paths that bypass RLS (invites)
  call `app.audit_write` explicitly. **Sensitive READS** that the triggers can't see —
  staff_admin opening another member's submitted response, dashboard CSV export, the
  Phase-19 surveyor portal — log via an explicit `app.audit_write(... '.read'/'.export')`
  call in the query/route layer (a defined, finite set; not every read).
- **RLS**: `audit_log` SELECT = `is_admin()` (all rows) **OR** `is_staff_admin_of(commission_id)`
  (their commission's rows only); **no INSERT/UPDATE/DELETE policy for anyone** (writes only
  through the DEFINER writer; the guard trigger backstops UPDATE/DELETE). Plain `staff` and
  `anon` get nothing.
- **RPCs**: `verify_audit_chain(commission?)` **DEFINER** (`is_staff_admin_of`/admin-gated) —
  recomputes the chain and returns the first broken `seq` or OK; `list_audit(commission, filters)`
  is served by an RLS-scoped query (no RPC needed). `audit_trail_enabled()` DEFINER read.
- **UI**: `/c/[slug]/manage/audit` (staff_admin) + `/admin/audit` (admin cross-commission) —
  a read-only, paginated, filterable timeline (actor, action type, entity type, date range),
  reusing the timeline/feed components; CSV export (itself audited); a "verificar integridade"
  control surfacing `verify_audit_chain`. pt-BR, keyboard-accessible, GSAP rise-in.
- **Acceptance**: E2E: a mutation in each instrumented module writes exactly **one** audit
  row with the correct actor/action/entity/summary (publish a form → row; add a member → row;
  submit a response → row; sign a section → row; change a case status → row; sign a meeting →
  row); `audit_log` **rejects UPDATE and DELETE** (direct attempt fails); staff_admin sees only
  their commission's entries, admin sees all, **`staff` cannot reach the audit view** (RLS +
  route gating); a sensitive read (staff_admin opens a foreign submitted response; CSV export)
  produces a `.read`/`.export` row; actor/action/date filters change results; CSV row count
  matches; one keyboard-only pass. pgTAP: append-only enforcement; per-commission RLS scoping;
  **hash-chain integrity** (intact → `verify_audit_chain` OK; a simulated out-of-band row edit →
  reports the broken `seq`); zero anon-readable audit rows; the writer attributes `auth.uid()`
  correctly and falls back to system on a null actor.

### Phase 14 — Patient-Safety Events, Triage, RCA & CAPA (Eventos de Segurança do Paciente, Triagem, RCA & PDCA/CAPA)
Turns committee action-tracking into a full **Joint-Commission-aligned patient-safety
programme** owned by a central **Patient Quality & Safety department — Núcleo de Segurança
do Paciente (NSP)** (RDC 36/2013). A committee detects an **event** during case analysis
(or stand-alone) and **notifies the NSP**; the NSP **acknowledges** receipt, **triages**
the event through the JC patient-safety-event framework (PSE gate → reach → harm severity →
sentinel screen), determines a **review pathway**, and where warranted runs a **Root Cause
Analysis** and a closed **PDCA/CAPA** loop through **effectiveness verification** and
**closure with lessons learned**. This delivers the "Check/Act" half of PDCA that JCI `QPS`
and ONA Nível 3 require, and seeds the data model for the future full PQS-department module.
**PHI is in scope here** (ADR [0030](../decisions/0030-patient-safety-phi-and-pqs-architecture.md)
— Supabase HIPAA/BAA), **isolated and access-audited** per ARCHITECTURE.md **Rule 12**; the
rest of the track stays PHI-free by design. **Two tiers:** committees keep their lightweight
`case_action_items`/`meeting_action_items` (unchanged) and **escalate** to the NSP for the
heavyweight framework — RCA + effectiveness-verified CAPA + closure live only in the NSP tier.
Feature-flagged behind **`patient_safety`** (supersedes the reserved `capa`). Decomposed into
four individually-gated, E2E-testable sub-phases **14a–14d**; the 15–21 numbering is unchanged.
Design specs: `docs/design/README_triage.md` (triage) + `docs/design/README_rca.md` (RCA/PDCA).

**Sub-phase 14e — Centralized Attachment Substrate** *(planned, not started; supersedes the
earlier narrow "Attachment PHI Classification" plan for this slot)*: a polymorphic `attachments`
core owning the physical file facts + a `sensitivity_tier`, with physically-tiered PHI buckets and
a hard audited PHI-read door (service-role signed), replacing the seven per-domain upload silos.
Authorization stays domain-owned (dispatched per `owner_type`). Folds in case/meeting/interview
docs (closing the PHI-read-audit gap and the reserved "14f" interview coverage), adds action-item
attachments, and reserves form-item uploads (design-only ingress contract). **Sequencing updated
2026-07-10:** now **phase F2 of the [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md)**
— built **after F1 (case-participants, ADR 0064)** because `attachment_subjects` re-keys to the
`participants` registry — and around Phase 16 (15/17 already shipped). Full plan:
`docs/phases/phase-14e-attachment-phi-classification.md`; ADR
[0063](../decisions/0063-centralized-attachments-substrate.md) (written).

#### Phase 14a — NSP Foundation, Event Intake & Hand-off (req. event detection → notification)
The PHI/HIPAA foundation (ADR 0030 + the binding-doc reversal) lands here, plus the NSP entity
and the event record with isolated PHI and a custody ledger so **access follows custody**.
- **Schema** (migrations `…121000+`): `public.pqs_department` (singleton config: name +
  RCA default due-days; vocab lives in its own tables); `public.patient_safety_event` (`id`,
  `code` (per-NSP minted number), `reporting_commission_id`, nullable `case_id`, `discovered_at`,
  `reported_at`, `location`, `reported_by`, reporter-supplied `event_type_id` + `suspected_harm_level`,
  `title`, `description_md`, `status ∈ {reported → acknowledged → triaged → closed | cancelled}`,
  denormalized `current_owner_kind`/`current_owner_commission_id`, `acknowledged_by/at`, `closed_by/at`);
  `public.event_patient` (**0..1, isolated PHI** — name, MRN, DOB/age, sex, admission/encounter ref,
  unit/attending; tightest RLS, encryption-ready); `public.event_custody` (**append-only ledger** —
  `event_id`, `owner_kind ∈ {pqs, commission}`, `owner_commission_id?`, `held_from`, `held_until?`,
  `assigned_by`, `note`). `app.is_pqs_member(uid)` (= `is_admin()` now, membership-ready);
  `app.guard_event_status` (state machine + freeze hooks); `case_events.kind` gains `'safety_event'`.
  `patient_safety` flag inserted **OFF** + `app.assert_patient_safety_enabled()` +
  `public.patient_safety_enabled()`. New SQLSTATEs `HC043` (event wrong-state) / `HC044`
  (not the current custodian — cannot act).
- **RPCs**: `notify_safety_event(...)` (**any member** of the reporting commission — just-culture
  exception; opens the initial custody row at PQS; writes the `case_events` row when case-linked),
  `acknowledge_event`, `transfer_event_custody(event, to_owner, note)` (append a custody row + close
  the prior, update denormalized owner), `update_event` / `set_event_patient` (PHI write, audited),
  `cancel_event`; `pqs_inbox(filters)` **DEFINER** (`is_pqs_member`-gated queue). PHI panel reads emit
  an explicit `.read` audit row (Rule 11/12).
- **RLS**: `patient_safety_event` + children member-READ = **current custodian commission OR
  `reporting_commission_id` (provenance) OR PQS/admin**; writes via the lifecycle RPCs; `event_patient`
  the same scope but **reads audited**; `event_custody` member-read same scope, **append-only** (no
  UPDATE/DELETE). Isolated PHI is never selected on queue/aggregate paths (minimum-necessary).
- **UI**: committee **"Notificar evento ao NSP"** on the case detail page (`c/[slug]/manage/cases/[caseId]`)
  + a stand-alone "notificar evento" entry; a `c/[slug]/eventos` read-back list (status of what the
  committee raised); case-linked events on the Phase-12 case timeline. The **NSP inbox/queue** under
  `/admin/nsp` (filters: status, priority, reporting committee) + the **acknowledge** action. pt-BR,
  keyboard-accessible, GSAP.
- **Acceptance**: E2E: a committee member files an event from a case → it lands in the NSP inbox and on
  the case timeline (`kind='safety_event'`) → NSP acknowledges (records who/when) → the reporting committee
  sees status read-back, a **foreign committee sees nothing** → a custody transfer grants the new holder
  access and revokes none from provenance (**access-follows-custody**) → the isolated `event_patient` PHI
  reads only within scope and **every PHI read writes a `.read` audit row** (Phase-13 integration) → a
  stand-alone (case-less) event works. One keyboard-only pass. pgTAP: event-number minting; state-machine +
  freeze guards; access-follows-custody RLS (custodian/reporting/PQS yes, foreign no); custody ledger
  append-only; PHI isolation (no identifiers on queue/aggregate reads); flag-gate.

#### Phase 14b — Triage & Disposition (req. acknowledge → safety-event? → reach → harm → sentinel → pathway)
The structured triage worksheet, the configurable sentinel checklist + event-type vocab, and the
review-pathway determination; freeze-at-triaged makes the decision viewable forever.
- **Schema** (migrations `…1211xx`): `public.event_triage` (**1:1**; structured `is_pse boolean`,
  `pse_closure_reason?`, `reach ∈ {unsafe, near_miss, no_harm, adverse, sentinel}`,
  `harm_severity ∈ {none, mild, moderate, severe, permanent, death}`, `natural_course boolean?`,
  `sentinel_determination boolean`, `review_pathway ∈ {rca, peer_review, mm, fmea, tracking_only}`,
  `disposition_notes_md`, `triaged_by/at`); `public.event_triage_sentinel_flags` (which criteria/
  categories were flagged — the permanent record); `public.pqs_sentinel_criteria` (**configurable**
  always-review checklist; JC defaults seeded); `public.pqs_event_types` (**configurable** vocab;
  NSP/WHO defaults seeded). **Reach (5) + harm (6) are FIXED CHECK enums** (JC/NCC-MERP); only the
  sentinel checklist + event types are configurable. Freeze on `triaged` via `app.guard_event_triage`
  (mirror meetings content-freeze). New SQLSTATEs `HC045` (triage wrong-state/frozen) / `HC046`
  (invalid disposition — reach/harm/pathway inconsistency).
- **RPCs**: `save_triage(event, fields…)` (structured upsert under a session flag; cross-field rules:
  non-harmful reach → harm `none`; sentinel reach → ≥ `severe`; auto `sentinel_determination` from the
  fixed general criteria OR any flagged designated category); `confirm_triage(event)` (→ `triaged`;
  **freezes** the worksheet; if pathway=RCA mints the 45-day due date + the RCA shell; sets disposition);
  `reopen_triage(event)` (`triaged → acknowledged`; unfreezes; audited); sentinel-criteria + event-type
  vocab CRUD (`is_pqs_member`-gated). `triage_disposition(event)` derived verdict (mirror README_triage
  `deriveVerdict`).
- **RLS**: `event_triage` + flags member-READ = event scope; **WRITE = PQS/admin** (triage is an NSP
  activity); the config vocab tables are `is_pqs_member`-WRITE / any-authenticated-READ.
- **UI**: under `/admin/nsp` — the **three-pane triage workstation** (inbox · guided 4-step flow · live
  disposition rail) from `README_triage`, with the de-identified line replaced by the real `event_patient`
  panel; the **NSP config area** (sentinel checklist, event types, RCA due-window). pt-BR, keyboard-accessible.
- **Acceptance**: E2E: NSP triages end-to-end (PSE=yes → reach=sentinel → harm=death → sentinel screen) →
  disposition computes **RCA mandated** with a 45-day due date (assert the values) → confirm freezes the
  worksheet → a frozen worksheet rejects edits (`HC045`) → reopen unfreezes (audited) → a **configured**
  custom designated category auto-qualifies sentinel → a non-PSE path records the closure reason and routes
  to `closed` → cross-field rules fire. One keyboard-only pass. pgTAP: freeze + state guards; fixed reach/harm
  enums; sentinel determination across general-criteria and designated-category paths; configurable-checklist
  scoping; "viewable-forever" (frozen worksheet + audited history).

#### Phase 14c — RCA Workspace (req. RCA team & roles · timeline · evidence · findings · fishbone & 5-Whys)
The RCA investigation: team with roles, incident timeline, evidence, and the structured causal analysis.
- **Schema** (migrations `…1212xx`): `public.rca` (**1:1** with the event when pathway=RCA;
  `status ∈ {draft → in_progress → in_review → completed}`, problem fields `what_md`/`expected_md`/
  `detected`/`impact`/`scope`, `summary_md` findings narrative, `due_date`, stamps); `public.rca_members`
  (`user_id` XOR `external_name`; **fixed role** `∈ {lead, facilitator, sme, reviewer, executive_sponsor,
  observer}`); `public.rca_timeline_entries` (incident chronology — `occurred_at`, `description`, `position`);
  `public.rca_evidence` (`kind ∈ {document, link, citation}`; uploaded file in a new immutable `nsp-evidence`
  bucket XOR `external_url` XOR denormalized citation to an existing interview/meeting/document);
  `public.rca_factors` (fishbone — **fixed** `category ∈ {people, communication, process, equipment,
  environment, policy}`, `text`, `is_key`); `public.rca_why_chains` (one per key factor; ordered ≤5
  `steps jsonb` + `root_text`); `public.rca_root_causes` (`text`, `category`, **fixed** `classification ∈
  {system, human, environment, external}`, **fixed** `type ∈ {root, contributing}` — **FK'd by `capa_action`**).
  `app.can_write_rca(rca, uid)` (**DEFINER** — PQS/admin OR an assigned **non-observer** team member, mirror
  `can_write_interview`). Freeze on `completed` (child-lock). New SQLSTATEs `HC047` (RCA wrong-state/frozen) /
  `HC048` (not entitled to write the RCA).
- **RPCs**: `update_rca` / `submit_rca_for_review` / `complete_rca` / `reopen_rca`; member CRUD; timeline-entry
  CRUD + reorder; evidence insert (upload XOR link XOR citation) + soft-delete; fishbone factor CRUD + key-toggle;
  why-chain set-step/set-root (keyed by factor; lazily created); root-cause CRUD (set `classification`/`type`).
  All authorized by `can_write_rca`.
- **RLS**: `rca` + children member-READ = event scope; **WRITE = `can_write_rca`** (an assigned plain-`staff`
  SME contributes; **Observers read-only**); new immutable `nsp-evidence` Storage bucket (members read,
  writer INSERT keyed on the RCA, **NO update/delete** — Rule 6).
- **UI**: under `/admin/nsp` — the RCA workspace from `README_rca` (4-stage stepper: Problem → Causal analysis
  [Fishbone ↔ 5-Whys] → Root causes → Corrective actions), team panel, incident timeline, evidence collection.
  pt-BR, keyboard-accessible, GSAP (fishbone spine/ribs, PDCA wheel).
- **Acceptance**: E2E: a sentinel triage opens an RCA → assign a Lead + Facilitator + an external SME → write
  the problem statement → add fishbone factors, flag key ones → drill 5-Whys to root causes → classify roots →
  add timeline entries + evidence (a PDF in `nsp-evidence` + a citation to an existing interview) →
  submit-for-review → complete (frozen) → reopen (audited). Security: an assigned **plain-`staff`** team member
  **can** write; an **Observer cannot**; a non-team non-PQS user gets no read; the immutable bucket rejects
  update/delete. One keyboard-only pass. pgTAP: RCA state + freeze/child-lock; `can_write_rca` participant grant
  (incl. observer-read-only); structured causal model; root-cause→action FK readiness.

#### Phase 14d — Corrective Action Plan, Effectiveness & Closure (req. actions+strength · tasks+evidence · measures→results · effectiveness · closure)
The closed PDCA/CAPA loop — `capa_plan` kept as the **reusable primitive** so Phases 15/18 reach it too.
- **Schema** (migrations `…1213xx`): `public.capa_plan` (`source ∈ {rca, event, indicator, audit_finding,
  meeting, manual}` with the matching nullable FK — `source_rca_id`/`source_event_id`/`source_indicator_id`
  (Phase-15 hook)/`source_audit_finding_id` (Phase-18 hook)/`source_meeting_id`; `code`, `classification ∈
  {corretiva, preventiva, melhoria}`, `status ∈ {aberto → em_execucao → em_verificacao → concluido | cancelado}`,
  `lessons_learned_md`, stamps); `public.capa_action` (`title`, `owner`, `due_date`, **`action_strength ∈
  {forte, intermediaria, fraca}`** — fixed JC hierarchy, `success_measure`, `root_cause_id?` → `rca_root_causes`,
  `status`); `public.capa_action_task` (execution steps); `public.capa_action_evidence` (implementation evidence
  — file in `nsp-evidence` XOR link); `public.capa_measure` (`name`, `target`, `definition`, nullable
  `indicator_id` Phase-15 hook); `public.capa_measure_result` (`period`, `value`, `note`); `public.capa_effectiveness`
  (`verified_by`, `verified_at`, `verdict ∈ {eficaz, parcial, ineficaz}`, `method_md`). State machine + child-lock
  via `app.guard_capa_status`. New SQLSTATEs `HC049` (CAPA wrong-state) / `HC050` (advance not entitled —
  assignee-or-PQS) / `HC051` (close: unsettled actions) / `HC052` (close: no effectiveness verdict) / `HC053`
  (cancel already terminal).
- **RPCs**: `open_capa_plan(source…)` (from an RCA, an event, or manual; mint retry), `update_capa_plan`; action
  CRUD + `advance/complete_capa_action` (assignee-OR-PQS gate → `HC050`, reuse `advance_action_item_core` shape);
  task CRUD; implementation-evidence insert/soft-delete; `add/update_capa_measure` + `record_measure_result`;
  `record_capa_effectiveness(verdict, method, indicator?, value?)`; `close_capa_plan` (**conclude gate**: rejects
  unsettled actions `HC051`, requires an effectiveness verdict `HC052`, writes `lessons_learned_md`; terminal-first
  `concluido`; closing the last open plan can close the event); `cancel_capa_plan` (`HC053` if terminal);
  `reopen_capa_plan` (`concluido → em_execucao`, **revokes** the effectiveness row); `capa_kpis(nsp)` **DEFINER**.
- **RLS**: `capa_plan` + children member-READ = the source's scope (event/RCA → NSP + reporting committee);
  **WRITE = PQS/admin**; an action **assignee** who is plain `staff` advances only via the narrow
  `advance/complete_capa_action` DEFINER path (no broad UPDATE) — the action-item rule.
- **UI**: under `/admin/nsp` — the CAPA workspace from `README_rca` stage 4 (PDCA wheel per action, status +
  notes per stage), measures → results grid, effectiveness panel, **closure + lessons-learned** editor. The
  Phase-15 indicator picker renders **disabled** with a "disponível com Indicadores (Fase 15)" hint until that
  flag lands. pt-BR, keyboard-accessible.
- **Acceptance**: E2E: an RCA root cause → open a CAPA → add an action (strength=`forte`, owner, due, success
  measure) → break it into tasks + attach implementation evidence → add a measure → record a result → an
  **assignee who is plain `staff`** advances/completes their action (and **cannot** broadly edit the plan) →
  record effectiveness `eficaz` → close (writes lessons-learned). Negative/lifecycle: **close blocked with an
  open action** (`HC051`) and **with no effectiveness** (`HC052`) in pt-BR; **reopen revokes** the effectiveness
  verdict; a concluded plan rejects edits; a CAPA opened directly from a non-RCA event works; every CAPA mutation
  appears in the **audit trail** (Phase-13 assertion). One keyboard-only pass. pgTAP: status-machine + child-lock;
  conclude-gate (unsettled / effectiveness-required); reopen-revokes; assignee-or-PQS action gate; the
  `source_indicator_id` FK accepts NULL + is deferred-safe for the Phase-15 wiring.

### Phase 15 — Quality Indicators (Indicadores de Qualidade)
Formal, managed quality indicators with **numerator/denominator definitions, targets,
periodicity, and trend-vs-target** — the heart of ONA Nível 3 and JCI `QPS` data
management, and the payoff of the platform's stable cross-version `question_key` +
**option-`code`** spine (form-model normalization). Indicators are entered **manually**
or **derived** from submitted-form aggregates; the classic per-1000 **taxa** is a
**hybrid** (derived numerator + manually supplied denominator). Off-target measurements
wire the Phase-14 hook via **two-tier escalation** (the CAPA remains an NSP instrument);
a CAPA's effectiveness can then cite a later measurement to **close the improvement
loop**. **Commission-owned with a read-only hospital rollup** (multi-tenancy). **No
patient data** — indicators are aggregate process/quality metrics. Feature-flagged
behind `quality_indicators`. *(Revised 2026-07-05, ADR
[0057](../decisions/0057-indicators-doc-control-replan.md) — re-based on multi-tenancy +
the hospital_admin tier, NSP-per-hospital, the normalized option model, answer-model v2,
and the hardened CAPA write surface.)*
- **Schema** (next-dated migrations): `public.indicators`
  (`id`, `commission_id` NOT NULL, `code` (per-commission mint, existing pattern), `name`,
  `description_md`, `kind ∈ {percentual, taxa, contagem, tempo_medio}`, `numerator_label`,
  `denominator_label`, `unit`, `direction ∈ {maior_melhor, menor_melhor}`,
  `target_value numeric`, `target_comparator ∈ {>=, <=, =, >, <}`, `lower_warn?`/`upper_warn?`
  (warning band), `frequency ∈ {mensal, bimestral, trimestral, semestral, anual}`,
  `data_source ∈ {manual, derivado, hibrido}` (`hibrido` = taxa's derived-numerator /
  manual-denominator mode), `derived_config jsonb`, `status ∈ {ativo, arquivado}`);
  `public.indicator_measurements` (`id`, `indicator_id`, `period_label` (e.g. `'2026-06'`),
  `period_start`/`period_end`, `numerator numeric`, `denominator numeric`, `value numeric`,
  `source ∈ {manual, derivado}`, `entered_by`/`entered_at`, `note`,
  `unique(indicator_id, period_label)`). **`derived_config` references option `code`s**
  (never labels or option-row ids — the normalized cross-version identity):
  percentual/contagem = `{form_id, numerator: {question_key, option_codes[]},
  denominator: {question_key} | 'respondentes'}`; tempo_medio = `{form_id,
  value: {question_key}}` over a `number` item (avg of answer-model-v2
  `answers.value_number`); hibrido = the percentual numerator shape with a manual
  denominator. Codes are validated on save against the form's published version (mirror
  `app.version_has_option_code`). Measurements are **editable by staff_admin but every
  change is audited** (Phase 13) — corrections are contemporaneous + attributable rather
  than silently overwritten. Audit AFTER-triggers with non-sensitive column allow-lists
  (never `description_md`). New SQLSTATEs from **`HC084`** (the spec'd `HC054+` range is
  long consumed): invalid/unknown derived config or option code · compute on a manual
  indicator · hybrid denominator required · zero/invalid denominator.
- **RPCs** (gate `quality_indicators`): indicator CRUD `create/update/archive_indicator`,
  `set_indicator_target`; `record_indicator_measurement(indicator, period, num, den, note)`
  (computes `value`; off-target detection); `compute_derived_measurement(indicator, period,
  p_denominator := null)` **DEFINER** — derived kinds compute fully; **hybrid taxa is
  one-step** (denominator passed in the same call; the measurement row is born complete; a
  recompute re-derives the numerator and **preserves the stored denominator** unless
  re-passed — no partial-measurement state; `sem dados` stays the only empty state). Reads
  the submitted-only aggregate via the **existing Phase-8 spine**
  (`app.submitted_form_responses` + option-`code` grouping, the `dashboard_distributions`
  logic) so a derived value **equals** the dashboard for the same window;
  `indicator_series(indicator, from?, to?)` **DEFINER** (trend points + target line);
  `indicator_kpis(commission)` **DEFINER** (`is_staff_admin_of OR is_commission_admin_of`:
  na-meta / fora-da-meta / sem-dados counts); `hospital_indicator_rollup(hospital)`
  **DEFINER** (`is_hospital_admin_of`/org-admin-gated) — a PHI-free per-commission
  scorecard (counts + status only; mirror the `nsp_org_*` rollup pattern) giving the
  hospital tier read-only visibility without a new write surface.
- **RLS**: `indicators` + `indicator_measurements` member-READ / staff_admin-WRITE
  (`is_staff_admin_of OR is_commission_admin_of` — the post-ADR-0051 combined predicate),
  commission-scoped; the hospital tier reads ONLY via the rollup DEFINER (no table grant).
- **CAPA hook (two-tier escalation — ADR 0057)**: the existing FK-less forward hooks
  `capa_plan.source_indicator_id` + `capa_measure.indicator_id` gain **real FKs**;
  `open_capa_plan`'s indicator arm derives the mandatory `hospital_id` **from the
  indicator's commission** (no manual `p_hospital_id` for this source); CAPA **write stays
  PQS-operator-gated** (`can_write_capa` untouched — the WS-3c hardened posture);
  `can_read_capa` gains an indicator arm so the **indicator's commission members read**
  the resulting plan (mirror of the event-source reporting-committee rule). An off-target
  measurement shows **"Abrir plano de ação (CAPA)"** ONLY to PQS operators of the
  hospital (capability-gated); non-operator staff_admins get **"Criar item de ação"**
  pre-filled into the shared Action-Items Hub (no schema change) — the same
  committees-escalate-to-NSP two-tier model Phase 14 established.
- **UI**: `manage/indicators/**` — indicator builder (definition, target/comparator,
  frequency, data source manual / derivado-por-`question_key` / híbrido) with **"Criar a
  partir de modelo"** — a static in-app pt-BR template catalog (ANVISA/NSP obligatory +
  common CCIH/quality indicators) that prefills the builder (code-level, no schema);
  measurement entry grid (the hybrid compute dialog shows the derived numerator and asks
  for the denominator); indicator detail with a **run chart / trend-vs-target** (Recharts)
  + warning bands + a status chip (`na meta` / `fora da meta` / `sem dados`); an
  **Indicadores** panel on the commission dashboard; the hospital scorecard on the
  hospital-admin surface.
- **Acceptance**: E2E: a **manual** indicator (target ≥ 90%) with monthly measurements
  renders a trend whose on/off-target classification matches the seeded numbers
  **exactly** (assert values, not just rendering); a **derived** indicator bound to option
  `code`s → `compute_derived_measurement` **equals** the Phase-8 dashboard aggregate for
  that period (assert equality); a **tempo_medio** indicator equals the average of the
  seeded `value_number` answers; a **hybrid taxa** computes in one step (derived numerator
  + typed denominator) and a recompute preserves the stored denominator; an off-target
  measurement shows **"Abrir CAPA" to a PQS operator** (the created plan carries
  `source_indicator_id` + the derived `hospital_id`, and the indicator's commission
  members can read it) and **only the action-item fallback to a non-operator staff_admin**;
  a CAPA effectiveness row cites the indicator + a later (improved) measurement — the
  **loop closes end-to-end across Phases 14+15**; editing a measurement writes an audit
  row (Phase 13); `staff` cannot edit indicators; a foreign-commission user gets no read;
  `hospital_admin` sees the rollup across its commissions and a foreign hospital_admin
  sees nothing; one keyboard-only pass. pgTAP: derived-compute equals the canonical
  aggregate (parity lock); an unknown option `code` is rejected at save; hybrid
  denominator-required + preserve-on-recompute; RLS scoping + rollup scope and PHI-free
  SELECT-list; off-target detection across both `direction` values; KPI counts; the
  `source_indicator_id` / `capa_measure.indicator_id` FKs resolve.

### Phase 16 — Standards Crosswalk & Readiness/Gap Engine (Mapa de Padrões & Prontidão)
The **strategic differentiator**: make the platform *aware of accreditation standards* and
let a commission **link the artifacts it already produces** — published forms, meetings,
cases, indicators, CAPA plans, controlled documents — as **evidence** against a specific
standard, then compute a **readiness / gap report** ("for standard X: evidence present /
partial / missing"). This is what turns "we run committees" into "we are prepared for the
survey" and directly serves *facilitating accreditation for hospitals that don't yet have it*.
Frameworks are admin-curated reference packs (ONA + a JCI chapter skeleton seeded);
hospitals may add custom frameworks. **No patient data.** Feature-flagged behind `accreditation`.
*(Build order 15 → 17 → 16 — ADR 0057 — so indicators AND controlled documents exist when the
evidence picker ships; no dead `artifact_kind`.)*
- **Schema** (migrations `…123000–123001`): `public.accreditation_frameworks`
  (`id`, `key` (`'ona'`/`'jci'`/custom), `name`, `version`, `description`, `owner_commission_id`
  nullable (NULL = global/admin-curated), `status ∈ {ativo, arquivado}`);
  `public.accreditation_standards` (`id`, `framework_id`, `parent_id` (self-ref hierarchy:
  capítulo → padrão → elemento de mensuração), `code` (e.g. `QPS.1`), `title`, `description_md`,
  `position`); `public.evidence_links` (`id`, `commission_id`, `standard_id`,
  `artifact_kind ∈ {form, form_version, meeting, case, indicator, capa_plan, controlled_document,
  action_item}`, `artifact_id`, `note`, `linked_by`/`linked_at`,
  `unique(commission_id, standard_id, artifact_kind, artifact_id)`);
  `public.standard_assessments` (`id`, `commission_id`, `standard_id`,
  `status ∈ {conforme, parcial, nao_conforme, nao_aplicavel}`, `assessed_by`/`assessed_at`,
  `note_md`, `unique(commission_id, standard_id)`). New SQLSTATEs from `HC056`.
- **RPCs** (gate `accreditation`): framework + standard admin CRUD (`is_admin`-gated for global packs;
  `is_staff_admin_of` for a commission's custom framework) + seed packs; `link_evidence` / `unlink_evidence`
  + `set_standard_assessment` (staff_admin); `readiness_report(commission, framework)` **DEFINER**
  (per-standard evidence count + assessment + chapter rollup + overall %); `hospital_readiness(framework)`
  **DEFINER** (`is_admin`: cross-commission rollup = hospital readiness). An `app.artifact_belongs_to_commission`
  guard rejects linking a foreign artifact.
- **RLS**: `accreditation_frameworks` + `accreditation_standards` SELECT to any authenticated user
  (reference data); `evidence_links` + `standard_assessments` member-READ / staff_admin-WRITE,
  commission-scoped.
- **UI**: `manage/accreditation/**` — pick a framework → standards **tree** with status chips
  (conforme/parcial/não-conforme/N.A.) + evidence count; a per-standard panel to **assess** status and
  **link evidence** via an artifact picker that searches the commission's forms/meetings/cases/indicators/
  CAPA/documents; a **readiness dashboard** (rollup gauges per chapter + a **gap list** of standards with
  no evidence or `nao_conforme`). `/admin/accreditation` — hospital-wide readiness across commissions.
- **Acceptance**: E2E: a seeded framework (ONA + a JCI skeleton) renders as a tree; linking a published
  form + a meeting + an indicator to a standard marks it evidenced and removes it from the gap list;
  assessing a standard `nao_conforme` puts it in the gap list and the rollup % reflects it (assert the
  computed value); the admin hospital-wide view aggregates two commissions' readiness correctly; an
  attempt to link a **foreign-commission artifact** is rejected; `staff` cannot edit; evidence links are
  audited (Phase 13); one keyboard-only pass. pgTAP: evidence-link uniqueness + foreign-artifact rejection;
  RLS scoping; readiness + hospital rollup correctness.

### Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)
Policy/procedure documents (políticas, POPs, protocolos, regimentos, manuais) under a
**controlled-document lifecycle**: named-approver e-signature workflow, effective/expiry
dates, a **scheduled review cycle**, and a controlled-document register — the core of
JCI `MOI` document control. Reuses the immutable-storage pattern (Rule 6) and the
meetings e-signature primitive. **Commission-owned with a hospital-wide register
rollup**; approvers may be **any active user of the document's hospital** (a pending
approval row grants read — the `case_access`-style arm), so institutional signers
(technical director, quality office) sign without joining the committee. Form publishing
gains the same approver + review-due **metadata** (capture-only — no e-sign workflow on
the form lifecycle). **No patient data.** Feature-flagged behind `controlled_docs`.
*(Revised 2026-07-05, ADR [0057](../decisions/0057-indicators-doc-control-replan.md) —
pulled PRE-pilot; build order 15 → 17 → 16 so Phase 16 links real documents as evidence
from day one.)*
- **Schema** (next-dated migrations): `public.controlled_documents`
  (`id`, `commission_id` NOT NULL, `code` (per-commission mint), `title`, `doc_type ∈
  {politica, pop, protocolo, regimento, manual, outro}`, `review_cycle_months?`,
  `status ∈ {rascunho → em_aprovacao → vigente → obsoleto}` (derived from the current
  version), `current_version_id`); `public.controlled_document_versions` (`id`,
  `document_id`, `version_number`, `storage_path` (immutable, new path per upload —
  Rule 6), `summary_of_changes`, `effective_date`, `review_due_date` (computed
  `effective_date + review_cycle_months` at publish, manually overridable),
  `expiry_date?`, `status ∈ {rascunho, em_aprovacao, vigente, obsoleto}` — version-level,
  so superseded versions stay retained + downloadable); `public.document_approvals`
  (`id`, `document_version_id`, `approver_id` (**any active same-hospital user**, named
  per version at submit; the set is frozen while `em_aprovacao` — changing it means
  resubmitting), `approver_title`, `decision ∈ {aprovado, rejeitado}` (NULL while
  pending), `decided_at`, `note`, `signature_hash` — sha256 of the storage object +
  decision, mirroring `meeting_signatures.content_hash`). Additive on `form_versions`:
  `approved_by`, `approved_at`, `effective_date`, `review_due_date` — **metadata-only,
  captured inside `publish_form_version`** (compatible with post-publish immutability).
  State machine via `app.guard_controlled_document_status` + child locks. Audit
  AFTER-triggers (allow-listed; never document bodies). New SQLSTATEs continuing after
  Phase 15's `HC084+` block: wrong-state · publish with pending/rejected approvals ·
  approver not entitled (foreign-hospital/inactive) · duplicate approver · frozen
  approver set.
- **RPCs** (gate `controlled_docs`): document CRUD + `add_document_version` (immutable
  upload); `submit_document_for_approval(version, approvers[1..n])` (→ `em_aprovacao`;
  creates the pending approval rows — which **grant read**); `approve_document` /
  `reject_document` (**sign-own-approval-row**, computes `signature_hash`; a `rejeitado`
  returns the version to `rascunho` with the note); `publish_document` (**requires ALL
  named approvers `aprovado`** → `vigente`, sets effective + review-due);
  `supersede_document` (new version replaces; prior → `obsoleto` but retained +
  downloadable); `mark_document_obsolete`; `documents_due_for_review(commission)`
  **DEFINER** (documents + **overdue published form versions**);
  `hospital_document_register(hospital, filters)` **DEFINER**
  (`is_hospital_admin_of`/org-admin-gated) — the institution-wide register
  (type/status/review-due filters) that document control is actually scored on. Form
  publish gains optional approver + review-due capture.
- **RLS**: documents + versions member-READ / staff_admin-WRITE (`is_staff_admin_of OR
  is_commission_admin_of`) **plus an approver read arm** (holding an approval row on a
  version grants read of that document/version — precedented by `case_access`);
  approvals **sign-own-row** (no broad write); new immutable **`controlled-documents`**
  Storage bucket (members + entitled approvers read via a DEFINER predicate, staff_admin
  INSERT, NO update/delete; path `{commission_id}/{document_id}/{uuid}.{ext}`;
  signed-URL reads); the hospital tier reads ONLY via the register DEFINER.
- **UI**: `manage/documents/**` — controlled-document **register** (filter
  type/status/review-due), a detail page (versions, approvals + signature state,
  effective/expiry, download), an **approval queue** ("pendentes de aprovação" —
  per-user, including approvers from outside the commission), and a **review-due list**
  (drives Phase-20 reminders; includes overdue forms). The publish-form flow gains
  optional approver + review-due fields; the hospital-wide register renders on the
  hospital-admin surface.
- **Acceptance**: E2E: full lifecycle — draft → submit naming **two approvers, one an
  active same-hospital user who is NOT a commission member** → that approver sees ONLY
  this document (opens + downloads it; no other commission data) → both **e-sign**
  (`aprovado`) → publish (`vigente`, dates set) → a new version **supersedes** it (prior
  retained, flagged obsolete, still downloads) → a past-due `review_due_date` surfaces
  the doc in the review-due list AND the hospital register; publish is **rejected**
  while any approval is pending or `rejeitado` (pt-BR error); a rejection returns the
  version to `rascunho`; the storage object gets a **new path per version** (Rule 6);
  publishing a form captures approver + review-due metadata and an overdue form version
  joins the review-due list; a foreign-hospital user cannot be named approver; documents
  are audited (Phase 13); a foreign-commission user gets no read; `hospital_admin` sees
  the register across its commissions; one keyboard-only pass. pgTAP: status-machine +
  frozen-approver-set guards; all-must-approve publish gate; approver read arm
  (version-scoped, no broad grant); sign-own-approval RLS; immutable storage (no
  update/delete); review-due computation (`effective + review_cycle_months`, override
  wins); register rollup scope; review-due + approver metadata on `form_versions`
  (settable only via the publish RPC).

### Phase 18 — Self-Assessment, Internal Audit & Mock Tracer (Autoavaliação & Auditoria Interna)
**Scored** internal-audit checklists mapped to accreditation standards (Phase 16), with
audit scheduling, a per-round auditor assignment, and a weighted conformity score —
supporting mock-tracer rounds and gap closure. A non-conforming finding opens a CAPA
(Phase 14) and updates the standard's assessment (Phase 16), wiring the
measure → improve → re-assess loop. **No patient data.** Feature-flagged behind `internal_audit`.
- **Schema** (migrations `…125000–125001`): `public.audit_rounds`
  (`id`, `commission_id`, nullable `framework_id`, `title`, `round_type ∈ {autoavaliacao,
  auditoria_interna, tracer}`, `scheduled_for`, `status ∈ {agendada → em_andamento → concluida |
  cancelada}`, `auditor_id` (any assigned member — **per-round assignment, not a new global role**;
  a true `auditor` role is a deferred ADR option), `score numeric` snapshot on conclude);
  `public.audit_findings` (`id`, `round_id`, nullable `standard_id`, `item` text,
  `result ∈ {conforme, parcial, nao_conforme, nao_aplicavel}`, `weight numeric`, `evidence_note_md`,
  nullable `capa_plan_id` (Phase-14 link)). Weighted score = `Σ(result_factor × weight)` over
  applicable findings. State machine via `app.guard_audit_round_status`. New SQLSTATEs from `HC060`.
- **RPCs** (gate `internal_audit`): round CRUD + `schedule_audit_round`, finding CRUD,
  `conclude_audit_round` (snapshots `score`, freezes findings), `link_finding_to_capa(finding)`
  (creates/links a CAPA with `source_audit_finding_id`), `sync_finding_to_standard(finding)`
  (writes the Phase-16 `standard_assessment`). `audit_round_score(round)` is computed.
- **RLS**: rounds + findings member-READ; WRITE = staff_admin **OR** the round's assigned `auditor_id`
  (a narrow per-round grant, mirror the interview participant-write shape via a definer predicate).
- **UI**: `manage/audits/**` — schedule rounds, **conduct** a round (a checklist of items, each scored
  conforme/parcial/não-conforme/N.A. with weight + evidence note; a standard picker per item), a live
  **score rollup**, and "abrir CAPA" on a non-conforme finding. A mock-tracer is a `round_type`.
- **Acceptance**: E2E: schedule a round → assign an auditor → conduct (score items) → the weighted score
  computes correctly (assert the value) → a `nao_conforme` finding **opens a CAPA** (`source_audit_finding_id`
  set) and **flags the standard** `nao_conforme` (Phase-16 assessment updated) → conclude snapshots the
  score and freezes findings; the assigned auditor (plain `staff`) can score their round, a non-assigned
  `staff` cannot; rounds are audited (Phase 13); a foreign-commission user gets no read; one keyboard-only
  pass. pgTAP: status-machine + freeze-on-conclude; per-round auditor write grant; weighted-score
  correctness across all four results; finding→CAPA + finding→standard links.

### Phase 19 — Surveyor Access & Evidence Export (Acesso de Auditor Externo & Pacote de Evidências)
A **time-boxed, scoped, read-only external-surveyor** access path and a curated
**evidence-export bundle** — so an accreditation surveyor can review readiness + linked
evidence without a full account and without any write path, with **every access audited**.
This is the most security-sensitive phase in the track and requires a **full plan review**
(new external-access shape). **No patient data** ever crosses the boundary. Feature-flagged
behind `surveyor_access`.
- **Schema** (migration `…126000`): `public.surveyor_grants`
  (`id`, `commission_id` (or NULL = admin/hospital-wide), `grantee_name`, `grantee_email`,
  `scope jsonb` (`{framework_ids, commission_ids, from, to}`), `token_hash` (a hashed,
  single-use-mintable opaque token — never stored in clear), `expires_at`, `created_by`/`created_at`,
  `revoked_at`/`revoked_by`, `last_accessed_at`). New SQLSTATEs from `HC062`.
- **RPCs / routes**: `create_surveyor_grant` / `revoke_surveyor_grant` (staff_admin/admin); a **read-only
  surveyor portal** at a separate route group (`/survey/[token]`) served by `SECURITY DEFINER`
  scope-checked reads (readiness report + the standards tree + linked-evidence summaries — **answer-free,
  download-by-signed-URL only where a document is explicitly linked as evidence**); **every portal view
  and every export emits an audit `.read`/`.export` row** (Phase 13). An evidence-export bundle route
  (server, grant-scoped or staff_admin cookie) renders a readiness package (PDF/zip) per framework.
- **RLS / security**: a surveyor grant unlocks ONLY the DEFINER scope-checked reads — **no table write path,
  no PostgREST table access**; the token is validated server-side, expiry + revocation enforced on every
  request; out-of-scope frameworks/commissions/date-ranges are invisible. The platform's own users are
  unaffected. This phase gets a dedicated **security/RLS review** at the QA gate.
- **UI**: `manage/accreditation/survey` (staff_admin) + `/admin/accreditation/survey` (admin) — create /
  list / revoke grants, copy the access link; the minimal, branded, read-only **surveyor portal**; the
  evidence-export action.
- **Acceptance**: E2E: create a time-boxed grant → open the surveyor portal via the link → see ONLY the
  granted scope, **read-only** (no mutation control reachable; direct write attempts blocked) → access
  **expires** after the window and is **killed by revoke**; every portal view + export writes an audit row;
  the export bundle's contents match the readiness report; an out-of-scope framework/commission is not
  visible through the portal by any path; the regular app's RLS is unchanged for normal users; one
  keyboard-only pass. pgTAP / security: token expiry + revocation enforcement; scope confinement (no
  cross-commission / cross-framework leakage); **zero write capability** from a grant; no answer payloads
  in any surveyor read.

### Phase 20 — Notifications & Escalation (Notificações & Escalonamento) *(**pulled pre-pilot** 2026-07-12 — ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md); built as track **N**, stage **S1**, of the [pre-pilot-release plan](../plans/pre-pilot-release-scope-expansion.md) — first in the block, as the escalation/reminder substrate)*
Email + an in-app **notification center** + scheduled **reminders/escalation**, replacing
the v1 "in-app pending queue only" posture. Timely follow-through is what accreditation
follow-up depends on, and the track has accumulated several due/overdue signals worth
surfacing: pending sign-offs, pending meeting signatures, **overdue CAPA actions**, CAPA
effectiveness due, **document review-due**, **indicator measurement-due**, scheduled audit
rounds. Reuses the Phase-3 Mailpit test harness. **No patient data** in any notification
body. Feature-flagged behind `notifications`.
- **Schema** (migration `…127000`): `public.notifications`
  (`id`, `user_id`, `kind`, `commission_id`, `entity_type`/`entity_id`, `title`, `body`
  (pt-BR, no sensitive content), `read_at`, `created_at`); `public.notification_preferences`
  (`user_id`, `commission_id`, per-channel/per-kind opt-in). New SQLSTATEs from `HC064` (if any).
- **RPCs / jobs**: `mark_notification_read` / `mark_all_read` / `set_notification_preferences`
  (own-row only); `compute_due_notifications()` **DEFINER** batch — scans CAPA actions/effectiveness,
  controlled-document review dates, indicator measurement periodicity, audit-round schedules, sign-off /
  signature queues, and enqueues notifications + email payloads; invoked by **`pg_cron`** (or an external
  cron hitting a server route). A server-only **email sender** route (SMTP/Supabase, service-role,
  `import 'server-only'`) — provider-abstracted, mirror the invite path. **Escalation:** an item still
  unactioned after N days notifies the staff_admin (configurable threshold).
- **RLS**: `notifications` + `notification_preferences` are **own-row only** (`user_id = auth.uid()`).
- **UI**: a notification **bell + center** in the app shell (per-user, unread badge), a per-user
  **preferences** page; due/overdue states surfaced inline on the CAPA / documents / indicators lists.
- **Acceptance**: E2E (Mailpit-intercepted, reuse Phase-3): an **overdue CAPA action** generates an in-app
  notification **and** an email; mark-read clears the badge; **preferences are respected** (a disabled kind
  produces neither channel); **escalation** fires to the staff_admin after the threshold; a user sees ONLY
  their own notifications; the cron batch is idempotent (no duplicate notification for the same due event);
  one keyboard-only pass. pgTAP: own-row RLS; `compute_due_notifications` selects exactly the due/overdue
  set across each source; idempotency guard; escalation threshold.

### Phase 21 — Committee Charters & Meeting Cadence (Regimentos & Periodicidade de Reuniões) *(**pulled pre-pilot** 2026-07-12 — ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md); built as track **CH**, stage **S4**, of the [pre-pilot-release plan](../plans/pre-pilot-release-scope-expansion.md) — soft-depends on Phase 20 for review/cadence reminders)*
Each commission carries a **charter (regimento)** — purpose, scope, authority, membership,
and a **required meeting frequency** — and the platform **tracks adherence to that cadence**
(e.g. CCIH must meet monthly) and **carries forward** unresolved agenda items + open action
items into the next meeting. JCI `GLD` expects every committee to have a defined charter and
to meet on schedule; this closes that governance gap and ties the track back to the Meetings
module. The charter is itself a **controlled document** (Phase 17, `doc_type='regimento'`).
**No patient data.** Feature-flagged behind `charters`.
- **Schema** (migration `…128000`): `public.commission_charters`
  (`commission_id` PK, `purpose_md`, `scope_md`, `authority_md`, `membership_md`,
  `meeting_frequency ∈ {semanal, quinzenal, mensal, bimestral, trimestral}`,
  `effective_date`, `review_due_date`, nullable `controlled_document_id` → the regimento doc).
  (Quorum already lives in `commission_meeting_settings`.) Cadence adherence is **computed** from
  `meetings` history vs `meeting_frequency`. New SQLSTATEs from `HC065` (if any).
- **RPCs** (gate `charters`): `upsert_commission_charter` (staff_admin); `meeting_cadence_status(commission)`
  **DEFINER** (compliant / em atraso vs the last `realizada` meeting + frequency); agenda **carry-forward**
  — `suggest_carry_forward(commission)` pulls open `meeting_action_items` + deferred agenda items for the
  next `create_meeting`.
- **RLS**: `commission_charters` member-READ / staff_admin-WRITE.
- **UI**: `manage/charter` (or under `manage/documents`) — the charter editor (sanitized Markdown) + a
  frequency setting; a **cadence indicator** on the meetings list ("em dia" / "reunião em atraso"); a
  **carry-forward** suggestion step in the schedule-meeting flow.
- **Acceptance**: E2E: define a charter with a **monthly** cadence → the cadence indicator reads compliant
  vs a recent meeting and **em atraso** when the last meeting predates the window (assert against seeded
  meeting dates); scheduling a new meeting **auto-suggests** carried-forward open action items + deferred
  agenda items; the charter renders as a controlled document with a review-due date (Phase 17); charter
  edits are audited (Phase 13); a foreign-commission user gets no read; one keyboard-only pass. pgTAP:
  cadence computation across frequencies; carry-forward selection; RLS scoping; charter↔controlled-document
  link.
