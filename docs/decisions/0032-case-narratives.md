# ADR 0032 — Case Narratives (per-case prose interleaved with phases)

**Status:** Accepted · **Date:** 2026-06-19 · **Feature:** Case Narratives
(additive, feature-flagged increment extending the Cases feature, Phases 7/12).

## Context

A Case (a multi-phase committee evaluation, e.g. an M&M mortality review) is, on
screen, an ordered stack of **phases** (`case_phases`) plus side-rail panels.
Committees have no place to record the *unstructured prose* that frames a case — a
"Resumo Clínico", "Achados e Discussão", "Conclusão do Comitê". They want to
(a) define their own menu of narrative kinds, (b) decide per **Process** which
narratives appear and in what order *relative to the phases*, and (c) fill that
prose in when working a case, so the case reads
`Resumo Clínico → Fase 1 → Fase 2 → Conclusão`.

This is a natural extension of three patterns the platform already has: the
Process template is an ordered list of slots (`process_template_phases`); the form
builder free-interleaves mixed item kinds (`form_items`); and per-commission
vocabularies (`case_outcomes`, `case_tags`) are a settled shape. The closest single
precedent is the Phase-11 interview summary (`case_interviews.summary_md`): a
per-case sanitized-Markdown body frozen on close, saved through a dedicated RPC,
excluded from the audit body, and edited inline. We mirror it.

## Decision

1. **Two-table split (vocabulary + per-case content), like outcomes.**
   `public.case_narrative_types` is the per-commission **vocabulary** (mirror
   `case_outcomes`: `unique(commission_id, label)`, `archived`-only, ordered by
   `position`); `public.process_template_narratives` are the per-template **slots**;
   `public.case_narratives` is the **per-case snapshot + content** (the analogue of
   `case_phases`). A case snapshots the full layout at creation
   (`type_label := coalesce(slot.title, type.label)` — the *effective* label),
   exactly like `case_offered_outcomes`, so later vocabulary edits never rewrite an
   opened case.

2. **A SEPARATE `display_position`, NOT a reused `position`.** Phases keep their
   immutable `position` (= the phase **number**, referenced by `blocks[]` and
   `recommend_when.from_phase`); a new nullable `display_position` column on both
   `process_template_phases` and `case_phases` orders phases *and* narratives in one
   interleaved list. **Why:** `position` is load-bearing identity for the
   cross-phase recommendation/blocker machinery — reusing it to mean "render order"
   would couple presentation to that identity and break a reorder. `display_position`
   is presentation-only and may be freely renumbered. Existing rows are backfilled
   `display_position := position`.

3. **The interleave is RPC-GUARANTEED, not a cross-table unique.** There is no DB
   constraint spanning the two tables; each carries its own deferrable
   `unique(parent, display_position)`, and `reorder_case_layout_template` renumbers
   BOTH 1..N from a single `[{kind,id}]` order (generalizing
   `reorder_case_outcomes`' `unnest … with ordinality` to a two-table join). The
   read side (`mergeCaseLayout`) sorts defensively and tolerates gaps/duplicates
   without throwing. **Why:** a cross-table exclusion constraint is not expressible
   cheaply in Postgres; the RPC is the single writer and is the right place for the
   invariant, consistent with how phase ordering is already managed.

4. **De-identified governance prose; `body_md` OUT of the audit metadata.**
   `body_md` is sanitized Markdown (Architecture Rule 7) and is treated as
   de-identified governance prose, exactly like `case_events.body` and
   `case_interviews.summary_md`. It **is** returned by `get_case_detail` (the
   coordinator read path) but is kept OUT of the audit allow-list (Rule 11) — the
   three audit triggers diff only `[label/type_label, display_position, is_expected]`
   (+ `narrative_type_id` for template slots), NEVER `body_md` / `title` /
   `instructions`. A pgTAP test asserts a saved body value never appears in any
   `audit_log.metadata` row. pt-BR UI guidance reminds authors not to enter patient
   data. (No PHI is introduced; this is not a Rule-12 module.)

5. **Coordinator authors, members read, body frozen on close.**
   `staff_admin` (the coordinator) writes; all members read (RLS member-read /
   staff_admin-write, reusing the existing helpers — no new RLS shape). The body is
   frozen once the parent case is `concluido`/`cancelado`:
   `app.guard_case_narrative_frozen` keys on the **parent case** status (mirror
   `app.guard_interview_child_lock`), and the body-save RPC opens a narrow
   `app.in_narrative_rpc` window for its one legitimate write. The snapshot INSERTs
   run inside `create_case_from_template` while the case is still `aberto`, so they
   pass; `close_case` never writes narratives and is therefore **unchanged**.

6. **Advisory `is_expected`, NOT a close gate.** A slot may be flagged
   `is_expected`; the conclude dialog shows a **non-blocking** warning listing
   expected-but-empty narratives ("Você ainda pode concluir o caso."). `close_case`
   enforcement is untouched — folding narrative completeness into the gate would
   make prose a hard precondition of conclusion, which the stakeholder explicitly did
   not want.

7. **Template-fixed per case (no per-case add/remove/reorder in v1); off the
   timeline.** A case's narrative set is fixed at creation from the template; empty
   narratives are hidden on the read-only (non-coordinator) view. Narratives do not
   write `case_events` (they are not timeline events), but the audit trail still
   records `case_narrative.created/.updated` (body excluded).

8. **New SQLSTATE `HC054`.** The Case-Narratives error: a template/type commission
   mismatch (the `guard_template_narrative_type` INSERT guard), a frozen-case body
   write, and an incomplete reorder set. HC043–HC053 are consumed/reserved by Phase
   14; HC054 is the next free code. Mapped to pt-BR
   ("As narrativas deste caso estão bloqueadas.") in the data layer.

## Alternatives rejected

- **A single unified "case items" table** (phases and narratives in one table, like
  `form_items`). Rejected: a phase IS a response with heavy machinery (pinned
  version, status state-machine, sign-offs, recommendations, blockers); a narrative
  is a prose blob. Unifying them would either bloat the phase row with nullable
  narrative columns or fragment the phase machinery. The additive two-table split
  keeps the phase subsystem untouched (the explicit design goal) at the cost of a
  client-side merge — a good trade.

- **Folding `is_expected` into `close_case` enforcement** (a hard conclude gate).
  Rejected per decision 6 — the stakeholder wants an advisory nudge, not a blocker;
  and it keeps `close_case` unchanged.

- **A per-case snapshot of the narrative TYPE row.** Rejected — only the *effective
  label* is snapshotted (`type_label`), mirroring outcomes (D11): vocabulary edits
  propagate to the library and template slots but not to opened cases, and a single
  snapshotted label is all the case needs.

## Consequences

- The phase subsystem is untouched except two nullable columns; all prior
  `create_case_from_template` / `get_case_detail` behaviour (outcomes + blocks) is
  preserved (the two functions are `CREATE OR REPLACE`d on the 20260614093003 final
  bodies, with the narrative logic added inside the existing windows).
- Cross-table `display_position` integrity rests on the reorder RPC + a defensive
  client sort; a reorder pgTAP test and the `mergeCaseLayout` unit tests guard it.
- The narrative snapshot in `create_case_from_template` is gated on the
  `case_narratives` flag, so existing cases keep working byte-for-byte while the
  feature is dark; it ships OFF and is flipped ON at completion.
