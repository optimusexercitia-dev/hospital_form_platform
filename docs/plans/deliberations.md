# Deliberation & Voting Model (DLB) — Implementation Plan

> **Status: DRAFT — ADR [0115](../decisions/0115-deliberation-and-voting-model.md) is *proposed,
> not ratified*.** This plan is written pre-ratification so the PO can see the build shape; **no
> phase may start before ratification** (Phase 0 gate). Where this plan and the ADR disagree, the
> ADR wins; where either disagrees with the live catalog, the catalog wins.

## Context (one paragraph — the ADR carries the detail)

ADR 0115 makes a `Deliberation` a first-class commission-scoped governance object: seated onto
meetings, put to vote under a frozen rule, closed into an append-only decision record whose
arithmetic Postgres owns. Twenty PO decisions (D1–D20) bind entity anchoring, seating, versioned
governance policies (subsuming `commission_meeting_settings`), org-scoped deliberation types,
chair identity, copy-freeze motions, voting membership, strict quorum, append-only ballots,
read-policy secrecy, two-step close/tiebreak, append-only decisions with supersession, resolution
promotion (dependent on ADR 0114), and the drop of `meeting_cases.decision`. **This plan only
sequences that work** — every "D*n*" below refers to the ADR's decision table.

## Program shape

Five build slices + a conditional sixth, contract-first (backend leads each slice by one step;
frontend follows on regenerated types; tester per slice; QA at the end). One feature flag
**`deliberations`** (prod OFF, seed forces ON — the `audio_minutes` pattern) covers everything
**except the D3 subsumption**, which replaces live meeting-settings plumbing and therefore must
land flag-independent and regression-safe.

| Slice | Content | ADR decisions | Risk center |
|---|---|---|---|
| 0 | Ratification + catalog verification | — | stale-text traps |
| 1 | Governance-policy substrate (subsume settings) | D3, D4, D5(cols), D7 | **not behind the flag** — live meeting module |
| 2 | Deliberation core: entity, seating, recusals, read boundary | D1, D2, D15, D16, D17(b), D19 | new RLS estate + WS-B audit |
| 3 | Voting engine: rounds, ballots, secrecy, close, tiebreak | D6, D8–D11, D13, D17(a) | the arithmetic + secret-ballot policies |
| 4 | Decisions + legacy fold | D12, D18 | `meeting_cases.decision` drop ripples through 5+ TS modules |
| 5 | Seating-aware surfaces + dashboards + hardening | D17, D20, Consequences | agenda/ata/carry-forward/audio-minutes each learn seatings |
| 6 | Resolution promotion — **conditional on ADR 0114** | D14 | document substrate mid-redesign |

Serialization: this program shares the local Supabase stack with the document-model program
(DM4 is itself serialized behind other work). **One owner at a time on the shared stack**; the
lead allocates migration-version windows above the highest *registered* version at slice start
(see docs/worktrees.md + the two-sessions-one-DB rule).

---

## Slice 0 — Ratification + catalog verification (lead + backend, ~half day)

Gate for everything below. Nothing here writes app code.

1. **PO ratifies ADR 0115** (status → accepted) and answers the one open build-order question:
   does Slice 6 (D14, resolutions) wait for the ADR 0114 document-model build (0114 is ratified;
   DM1+ not built), or ship v1 without promotion? Recommendation in this plan: **ship v1 without
   Slice 6**; promotion is optional-and-rare by D14's own text, and binding it to a document
   substrate that is ratified but unbuilt is pure risk.
2. Merge the ADR branch to main; open the build worktree/branch per docs/worktrees.md.
3. **Catalog verification checklist** — all against the *live catalog* (`pg_proc` incl.
   `prosecdef`, `pg_policies`, live CHECKs, ACLs, `information_schema.column_privileges`);
   migration file text and the ADR's substrate notes are explicitly *not* evidence. Record results
   as amendments A1… at the top of this plan (the referral-redesign plan's Phase-0 pattern):
   - Highest **registered** migration version + registered==files parity (fresh `supabase db
     reset` must be clean first) → allocate this program's migration window.
   - Free pgTAP suite numbers → allocate one suite per slice (expect 4–5 new suites).
   - **`HC0V` SQLSTATE prefix unused** (the ADR reserves it; the 0080 `HC0D` collision lesson).
   - Live shape of: `commission_meeting_settings` (columns to migrate into policy v1),
     `meetings` quorum-snapshot columns + the post-conclusion child-lock guard (name + covered
     tables), `meeting_cases` (confirm `decision` exists and who reads it), `commission_member_titles`,
     `memberships` (confirm no `is_voting_member`), `controlled_documents.doc_type` CHECK,
     the charter carry-forward predicate (`resolution IS NULL` — where it actually lives),
     where `eligible_member_count` is computed (function or trigger).
   - `btree_gist` extension availability (the D3 `tstzrange` exclusion constraint needs it).
   - Grant style per touched table — which are on **column-list grants** (every new column then
     needs its own `GRANT` or reads fail 42501; `memberships`, `profiles` precedents).
4. **TS reader inventory** (grep now, re-verify at each slice): `commission_meeting_settings` →
   `src/lib/queries/meetings.ts` + generated types; `meeting_cases` → `src/lib/queries/meetings.ts`,
   `src/lib/queries/rca.ts`, `src/lib/queries/case-timeline.ts`, `src/lib/timeline/event-model.ts`;
   ata PDF → `src/lib/meetings/pdf-payload.ts` + `src/lib/pdf/documents/meeting.ts`; audio-minutes
   mapper → `src/lib/minutes-jobs/context.ts` / `normalize.ts`. Sweep with identifier-boundary care
   (`\y` does not match `_for` variants — sweep the underscore forms too).

**Exit:** ADR accepted; amendments table written; migration + suite windows allocated; Slice-6
go/no-go decided.

---

## Slice 1 — Governance-policy substrate (backend ~3–4 d, frontend ~2–3 d)

**⚠ This slice is NOT behind the `deliberations` flag** (D20: the quorum panel needs the policy
read regardless). It rewires a live module; its own regression bar is therefore the full meeting
E2E set, not just new specs.

### Backend (contract-first)

1. Migration(s), in the allocated window:
   - `commission_governance_policies` — append-only versions: `effective_from`/`effective_until`,
     `supersedes_policy_id`, per-commission **`tstzrange` exclusion constraint** (btree_gist) for
     non-overlap. Columns: meeting-quorum fields (migrated from settings) **and** decision
     defaults (method, vote visibility, quorum type/value, threshold type/value,
     `abstentions_in_denominator`, `chair_votes_normally`, `chair_has_tiebreaker`). **No**
     `remote_voting_allowed`/`asynchronous_voting_allowed` (D13 dropped them — declared-param
     lesson).
   - Data migration: each commission's `commission_meeting_settings` row → policy v1
     (`effective_from` = a fixed past epoch, open-ended). Then **drop `commission_meeting_settings`**.
     Guard-wrap any data-dependent CHECK (the backfill-guard-wrap lesson: local reset has 0 rows,
     remote push has data).
   - `deliberation_types` — org-scoped vocabulary, the `case_types` pattern (`organization_id`,
     `key`, `display_name`, `is_active`), platform-seeded defaults. English keys, pt-BR labels
     (D19/D20 — final vocabulary now, never re-keyed).
   - `commission_decision_rules` — per policy version, keyed by deliberation type (method, quorum,
     threshold, visibility, chair tiebreak). Policy-version defaults are the mandatory fallback
     rule (resolution can never return NULL — pin in pgTAP).
   - `commission_member_titles.governance_role` (`chair`|`vice_chair`|`secretary`, CHECK, nullable)
     + partial unique index ≤1 chair per commission. `memberships.is_voting_member boolean NOT
     NULL DEFAULT true`. `meetings.presided_by` (nullable FK, defaulting behavior in the door, not
     the column).
   - RLS + doors: policy/rule/type reads for members; **writes are staff_admin doors** (D19), with
     the write path chosen to mirror the live vocabulary sibling (verify `case_types`' actual
     pattern — direct RLS-gated writes vs DEFINER — from the catalog, per the A6 precedent in the
     referral plan). Every new DEFINER door: `prosecdef` recorded beside its policies; audited
     mutation (Rule 11).
2. **Rewire meeting quorum**: the quorum panel/computation reads the policy **active at
   `scheduled_start`**; `eligible_member_count` switches to **voting members only** (D7).
   Historical snapshot columns on `meetings` stay. Re-pin the meeting-quorum pgTAP.
3. `npm run gen:types`; update `src/lib/queries/meetings.ts` (drop the settings read, add policy
   reads + a policy-resolution query) and any settings action.
4. pgTAP (new suite): exclusion-constraint non-overlap; settings→policy migration equivalence;
   rule-resolution fallback never NULL; chair partial-unique; voting-member denominator change;
   grants matrix for every new column/table.

### Frontend

5. **Rebuild the meeting-settings UI as the governance-policy editor** (versioned: show the active
   policy, "new version" flow with effective-date, per-type rule rows; pt-BR). `frontend-design`
   skill first. The quorum panel display change (voting members) rides along.

### Tester

6. Update/extend meeting E2E: settings→policy editor flows, quorum panel vs a policy version
   boundary, keyboard-only pass on the editor. **Run the existing meetings/charters/minutes spec
   files in full** — this slice's blast radius is the live module.

**Exit:** Phase-gate step 1 checks (lint ×5, typecheck, vitest, pgTAP on fresh reset, `ARM=census`
/ `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper`) + diff-scoped door sweep over every policy/gate
this slice added (derive the list from the migration diff; **check the sweep's case count, not
just BLIND count** — the empty-snapshot lesson).

---

## Slice 2 — Deliberation core (backend ~3–4 d, frontend ~3–4 d)

Everything from here on is behind the **`deliberations`** flag (seed forces ON locally/E2E).

### Backend

1. Migration:
   - `deliberations` — `commission_id NOT NULL`, `deliberation_type_id`, `motion_text` (live
     draft) + monotonic `motion_version`, status ∈ `open → tabled ⇄ open → decided | withdrawn`
     (English keys), origin FKs `case_id` / `controlled_document_id` / `referral_id` (all
     nullable, no exactly-one CHECK — D15).
   - `deliberation_seatings` — `deliberation_id`, `meeting_id`, nullable `agenda_item_id`,
     `position`, seated/disposed timestamps. Guards: deliberation ∧ meeting share a commission
     (the `guard_meeting_cases` pattern — copy the *live* guard shape from the catalog); ≤1 open
     seating per (meeting, deliberation) partial unique.
   - `deliberation_recusals` — deliberation-scoped (COI spans rounds), `member_id`, `reason`
     (WS-B free text), recorded_by/at.
2. **Read boundary (D16)** — `app.can_read_deliberation(d)` = active commission membership ∧
   (`case_id IS NULL` ∨ case-ACL access). Every policy on the three tables composes it — one
   keystone predicate, a **named door-sweep target**. Vertical arms: platform_admin nothing
   (noun rule), org/hospital_admin nothing content-level. WS-B audited reads of `motion_text`
   surfaces (*that + who*, never payloads); **recusal reads get a distinct audit event**.
3. Doors (all staff_admin per D19, all audited): create/edit deliberation (bump `motion_version`
   per edit), seat/unseat onto a meeting, table, withdraw (+ staff_admin-reversible un-withdraw,
   both acts audited — D17), record/withdraw recusal.
4. Child-lock extension (D17b): the meeting's post-conclusion lock covers that meeting's
   **seatings** (rounds arrive in Slice 3); the deliberation *entity* stays mutable. Guard lists
   the append-only children explicitly so `ARM=floor` sees denials, not assumptions.
5. pgTAP (new suite): predicate composition incl. case-ACL arm (assert **rows under
   `set local role`** — the three-RLS-shapes lesson, and remember a `FOR ALL` policy is a read
   policy); cross-commission seating guard; one-open-seating; status operator matrix
   (staff_admin vs chair vs member vs platform_admin); audit rows emitted.

### Frontend

6. Deliberation surfaces inside the commission area (`frontend-design` first): list + detail
   (motion draft, origins, recusals, seating history), "seat onto meeting" flow from both the
   deliberation and the meeting agenda side. pt-BR labels per D20 (Deliberação, Proposta,
   Impedimento…).
7. **Interleaving rule (D2's open cost)** — proposed here, PO confirms during slice review:
   a seating with `agenda_item_id` renders under that pauta item; a free seating interleaves
   with top-level pauta items by `position` in a single shared ordering sequence owned by the
   meeting agenda editor. One rule, stated once, reused by the ata PDF and carry-forward in
   Slice 5.

### Tester

8. E2E: CRUD + seating + recusal flows; cross-commission denial; case-origin confidentiality
   (member without case access cannot read the deliberation); flag-OFF invisibility.

**Exit:** same gate battery as Slice 1 (diff-scoped sweep over the D16 predicate + every new
door — these are ADR-named sweep targets).

---

## Slice 3 — Voting engine (backend ~5–6 d, frontend ~4–5 d) — the heart

### Backend

1. Migration:
   - `vote_rounds` — `deliberation_id`, **`meeting_id NOT NULL`** (D13), seating ref, frozen
     snapshot: `motion_text` + `motion_version` copy, resolved rule columns (method, quorum
     type/value, threshold type/value, `abstentions_in_denominator`, chair flags, visibility),
     `chair_user_id` (frozen from `meetings.presided_by`), status
     (`open | closed | cancelled | tied_pending_tiebreak`), and the **result columns** (D11):
     `tally_for/against/abstain`, `participants`, `denominator`, `threshold_applied`,
     `quorum_met`, `tiebreak_choice`, `outcome`, `closed_at/by`.
   - `vote_round_eligibility` — frozen eligible-voter snapshot rows at open.
   - `vote_ballots` — append-only: `round_id`, `voter_id`, `recorded_by` (default voter),
     choice ∈ FOR/AGAINST/ABSTAIN, `cast_at`. No UPDATE/DELETE for anyone (policy + trigger
     belt-and-suspenders; the guard names them for `ARM=floor`).
2. Doors:
   - `open_vote_round(deliberation, meeting, …)` — **open gate**: live attendance ∩ voting ∩
     non-recused ≥ quorum, else refuse; resolves the rule (type rule → policy defaults fallback),
     freezes snapshot + eligibility + chair.
   - `cast_ballot(round, choice, [voter])` — validity in the door: voter in frozen snapshot, not
     recused, round open at `cast_at`; **transcription** (`recorded_by ≠ voter_id`) allowed only
     on open-visibility rounds and only by staff_admin; **secret rounds require self-cast**.
   - `close_vote_round(round)` — recomputes everything server-side: participants (distinct
     snapshotted-eligible ballot-holders), quorum first (`no_quorum` short-circuits), latest-valid
     ballot per voter, denominator + threshold per the ADR's normative table; finalizes or lands
     `tied_pending_tiebreak`.
   - `cast_tiebreak(round, choice)` — chair-only against the **frozen** `chair_user_id`; recorded
     on the result, never as a ballot row. No tiebreaker in rule ⇒ close yields `rejected` on tie.
   - `cancel_vote_round(round)` — void: recorded, never deleted, excluded from arithmetic.
   - Meeting `Concluir` guard (D17a): refuse while any seated round is `open`/`tied_pending_tiebreak`.
3. **Secrecy policies (D10)** — the named sweep targets. `SECRET`: a voter reads only their own
   ballot ever; no role has a read path to another's choice; post-close aggregates only.
   `SECRET_UNTIL_CLOSED`: + individuals member-readable after close. Mid-round secret modes
   expose only "N of M voted" (a counting view/door that leaks no choices, not even totals).
4. pgTAP (new suite — the largest): **pin the ADR's normative threshold table row-by-row**
   (every threshold type × `abstentions_in_denominator` × tie/edge values), all three quorum
   types, quorum-before-threshold precedence, latest-ballot-wins, recusal breaking quorum,
   transcription vs secret self-cast denial, secrecy under `set local role` for **every** role
   (member/chair/secretary/staff_admin/org_admin/platform_admin — assert zero rows), tiebreak
   authority (frozen chair, not current title-holder), close-once, cancelled-round exclusion,
   conclude-refusal. Include an **inverted control**: temporarily neutralize one gate in a
   transaction and require the suite to redden (a detector that finds nothing must prove it can
   find something).

### Frontend

5. Round lifecycle UI: open dialog (shows resolved rule + live quorum check), voting surface
   (self-cast; show-of-hands transcription grid for the secretary on open rounds), live view
   (open: individual votes; secret: "N of M"), close + result card (tally, quorum, threshold,
   outcome), tiebreak prompt for the chair, void with confirmation. pt-BR: Votação, Voto,
   Voto de qualidade.

### Tester

6. E2E: full vote lifecycle per visibility mode as multiple personas; secrecy assertions from a
   second member's session; tiebreak; no-quorum; meeting-conclude refusal; keyboard-only casting
   flow. Seed additions (backend owns `seed.sql`): a chair `governance_role` title in CCIH, at
   least one non-voting member, personas documented in the seed header. **Seed is a contract with
   ~900 tests — additive only; assert seed rows survive.**

**Exit:** gate battery + diff-scoped sweep over the secrecy policies and all six doors.

---

## Slice 4 — Decisions + legacy fold (backend ~3 d, frontend ~2–3 d)

### Backend

1. Migration:
   - `committee_decisions` — append-only: `deliberation_id`, `source`
     (`vote|consensus|chair_determination|external_authority`), `vote_round_id`
     (`NOT NULL ⟺ source='vote'` CHECK), `outcome`, `decision_text`, `dissent_note`, seating,
     `decided_at`, `recorded_by`, `superseded_by_decision_id`. Non-terminal
     `consensus_not_reached` rows supported (no schema beyond the outcome key).
   - **Drop `meeting_cases.decision`**, folding existing values into `summary` as
     `"Decisão: …"` (data migration; guard-wrap for the data-bearing remote).
2. Doors: decision-from-vote (written inside `close_vote_round`/`cast_tiebreak` finalization),
   `record_consensus` (presiding-chair attestation; requires the seating meeting's meeting-level
   quorum; optional dissent note), `record_chair_determination` / `record_external_authority`
   (mandatory justification), `supersede_decision` (append, never overwrite).
   `deliberations.status` is **derived — written only by these doors** (pin in pgTAP: no other
   write path can set `decided`).
3. **TS reader fold** — the Slice-0 inventory executed: `meetings.ts`, `rca.ts`,
   `case-timeline.ts`, `event-model.ts`, `pdf-payload.ts`, minutes-jobs types/queries all stop
   reading `meeting_cases.decision`. **The lead runs one repo-wide sweep by the changed
   identifier** after the drop (the union-of-scoped-sweeps lesson), including `_`-suffixed
   variants. Regen types; a stale `.select('decision')` string typechecks perfectly — load the
   pages, don't trust green (the wired-seam lesson).
4. pgTAP: source⟺round CHECK, supersession chain, consensus quorum requirement, chair-vs-
   staff_admin operator split (never assume the union — D5/D19), decision reads compose
   `can_read_deliberation`.

### Frontend

5. Decision recording flows: post-close confirmation, **one-dialog consensus** (D18's lightweight
   path replacing the dropped `meeting_cases.decision` — reachable from the meeting's case row),
   attestation dialogs with justification, decision history with supersession + dissent display.

### Tester

6. E2E: consensus one-dialog from a meeting case; supersession append; decision visible on the
   deliberation and the meeting; the ata still shows folded legacy text on old seed meetings.

**Exit:** gate battery + diff-scoped sweep; **meeting/RCA/timeline E2E rerun in full** (the drop's
blast radius).

---

## Slice 5 — Seating-aware surfaces, dashboards, packaging hardening (mixed, ~4–5 d)

The ADR's "surfaces that must learn seatings" — each an explicit work item, not an afterthought:

1. **Agenda rendering** — implement the Slice-2 interleaving rule in the meeting agenda view and
   editor (frontend).
2. **Carry-forward** — a `tabled` deliberation's open disposition is the analogue of
   `resolution IS NULL`; ADR 0080's carry-forward gains this second source (backend query +
   frontend chip). `meeting_agenda_items.resolution` itself **stays**, informal, zero governance
   weight (D18) — dashboards must never count it.
3. **Ata PDF** — `pdf-payload.ts` + `pdf/documents/meeting.ts` render seated deliberations,
   rounds (frozen motion text verbatim), results, decisions, dissent notes, respecting D10
   secrecy (aggregates only for secret rounds).
4. **Audio-minutes context mapper** — `minutes-jobs/context.ts` learns seatings so transcribed
   minutes can reference deliberations.
5. **Dashboards** — decision counts by type/outcome/period (typed substrate only); ADR 0100
   oversight gets **counts only** through its container-level pattern (D16).
6. **Packaging checks** — flag `deliberations` verified prod OFF / seed ON; pt-BR label sweep;
   `HC0V` error codes surfaced as readable pt-BR messages (raw SQLSTATEs never reach the UI).
7. **Docs** — `docs/backend-state.md` updated (new tables, doors, predicate, policies);
   PROGRESS.md rows throughout; a `graphify` refresh only by the lead after the final merge.

### Program gate (Phase Gate §6, full)

- Step 1 battery + **diff-scoped door sweep over the program's cumulative migration diff**.
- Full `npm run e2e:prod` (Git Bash; fresh reset; triage against the known flaky baseline;
  never piped through `tail`).
- QA review → `docs/reviews/deliberations-review.md`; human approval; Record step (rotate,
  name the ARMs, never the script).

---

## Slice 6 — Resolution promotion (D14) — **conditional, default deferred**

Blocked on the ADR 0114 document-model redesign build (the ADR is ratified; DM1+ not built). When
unblocked:
`controlled_documents.source_decision_id` (nullable FK), `doc_type='resolution'` added to the
live CHECK, a minting DEFINER door with **DB-assigned** per-commission-per-year numbering into
`code` (never client-supplied), seeded from `decision_text`; the resolution then rides whatever
document lifecycle 0114 lands. Promotion is optional and rare — **no workflow may require
it**; nothing in Slices 1–5 may take a dependency on this slice.

---

## Cross-cutting risks & standing lessons (checked at every slice)

| Risk | Mitigation |
|---|---|
| Stale text (ADR substrate notes, migration files) | Slice-0 catalog checklist; every slice re-verifies its own touched objects against `pg_proc`/`pg_policies`/CHECKs before writing |
| Column-list-grant tables | Every new column on such a table ships its own GRANT + a post-apply column-privilege matrix check |
| New doors passing gates vacuously | `ARM=census` at every slice exit (it alone catches a brand-new gate); INVOKER wrappers enter the census domain so `ARM=wrapper` isn't vacuous |
| Diff-scoped policy sweep running zero cases | Read the sweep's **case count**; a subset run must not overwrite the committed findings file (restore per lead-playbook §4) |
| Shared local stack | One owner per window; migration versions allocated above highest *registered*; no `db reset` while another session holds applied-uncommitted migrations |
| Seed as a contract | Additive persona/title changes only; assert seed rows survive teardown; header roster updated |
| Rebuilt objects losing properties | Any DROP+CREATE (or param change) diffs ACL/prosecdef/owner property-by-property from the catalog; re-issue EXECUTE grants |
| Remote push | Data migrations (settings→policy, decision→summary fold) guard-wrapped; `db push` needs the user's authorization; remote drift checked after merge |
| pt-BR/EN discipline | English storage keys frozen now (D19/D20); UI labels pt-BR; no re-key later |

## Team & sequencing summary

- **backend** leads every slice (contract-first: migration + doors + pgTAP + regenerated types
  before frontend starts that slice); owns `seed.sql` and shared types.
- **frontend** builds each slice's UI one step behind; `frontend-design` skill before every new
  screen (policy editor, deliberation detail, voting surface, decision dialogs).
- **tester** writes specs per slice, runs failing+current-slice loops, full suite once at the
  program gate; ≥1 keyboard-only flow (ballot casting is the designated one).
- **qa** reviews once at the program gate (security review must specifically attack D10 secrecy
  and the D16 predicate as the two highest-value targets).
- **lead** owns windows, sweeps, PROGRESS.md rotation, the repo-wide identifier sweep after the
  `meeting_cases.decision` drop, and the graphify refresh after the final merge.

Rough total: **~4–5 weeks** of team time across the five unconditional slices.
