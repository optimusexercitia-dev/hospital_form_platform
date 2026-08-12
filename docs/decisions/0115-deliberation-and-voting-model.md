# 0115 — Deliberation & Voting Model (DLB): typed committee decisions with vote arithmetic the database owns

**Date:** 2026-08-12 · **Status:** proposed (requirements interview / grilling with the PO, 2026-08-12;
20 questions resolved; binds the future DLB build plan). **Owner:** platform lead → `backend`
(contract-first) → `frontend`.
**Track:** new (post-pilot-scope candidate); build plan to follow in `docs/plans/deliberations.md`
after ratification.
**Binding rules:** Rule 1 (RLS is the boundary; every new gate is a DEFINER door beside
`pg_policies`), Rule 2 (extend the canonical schema), Rule 8 (regen types), Rule 9 (queries layer),
Rule 10 (pt-BR UI / English storage keys), Rule 11 (audited mutations + audited free-text reads),
Rule 12 (WS-B free-text posture — see D16; this ADR creates **no** new Class-1 PHI module).
**Related:** ADR [0080](./0080-committee-charters-cadence-model.md) (charters stay cadence-only —
the governance policy is a sibling, not a charter extension), ADR
[0097](./0097-hospital-affiliation-person-identity.md)/[0100](./0100-quality-office-oversight.md)
(oversight reads stay container-level), ADR
[0114](./0114-document-model-redesign.md) (document model redesign — D14 dependency), ADR
[0078](./0078-authorization-capability-model.md)/[0079](./0079-authz-door-blindness-standing-invariant.md)
(every new door enters the census/keystone estate).

## Context

Today a committee "decision" is free text in two places: `meeting_agenda_items.resolution` (one
nullable column — at most one untyped outcome per pauta item) and `meeting_cases.decision`. There is
no motion, no vote, no tally, no per-decision quorum, no recusal record, and no enumerable outcome —
so decisions are invisible to dashboards and weak as ONA/JCI evidence, on a platform whose premise
is that governance rolls up to dashboards. Hospital committees (and the IRB tradition the PO
invoked) deliberate formally: motions are discussed and amended, conflicts of interest are recorded,
quorum must exist *while the decision is made*, ballots are cast under a written rule, and
corrections never overwrite the historical record.

Substrate this ADR reconciles against (verified in-repo 2026-08-12; **catalog literals must be
re-verified at build time** — baseline migration text is stale by design; e.g. `meeting_action_items`
in the baseline was folded into the `action_items` hub, and meeting status keys were anglicized
after D11):

- `commission_meeting_settings` — one unversioned quorum row per commission (subsumed by D3).
- `commission_charters` (ADR 0080) — cadence config only; carry-forward reads
  `resolution IS NULL` (interplay: D18/D19).
- `meetings` — meeting-level quorum snapshot columns; child-lock guard on post-conclusion statuses.
- `commission_member_titles` + `memberships.title_id` — structured but semantically opaque titles
  (no machine-readable "chair"); `case_types` (org-scoped) and `commission_meeting_types`
  (commission-scoped) — both vocabulary precedents.
- `controlled_documents` — commission-scoped, versioned, e-signed, effective-dated lifecycle
  (D14 promotes resolutions into it).
- C7 removed the org-admin/org-user meeting surface; agenda free text is WS-B PHI-bearing
  (reads audited via `meeting.viewed`).

## Decision

**A `Deliberation` is a first-class, commission-scoped governance object — seated onto meetings,
put to vote under a frozen rule, and closed into an append-only decision record whose arithmetic
PostgreSQL computes and stores.** `Pauta` remains the informal topic container beside it.

| # | Decision | Choice |
|---|----------|--------|
| 1 | Entity anchoring | **First-class, commission-scoped** `deliberations` (`commission_id NOT NULL`). Meetings are sessions it passes through — `TABLED` is a status, not a dead end; multi-meeting history has one spine. Not an agenda-item child. |
| 2 | Seating | **Explicit `deliberation_seatings` join** (`deliberation_id`, `meeting_id`, nullable `agenda_item_id`, position, seated/disposed timestamps). Guards: deliberation and meeting share a commission (the `guard_meeting_cases` pattern); at most one open seating per (meeting, deliberation). Cost accepted: agenda rendering, carry-forward, the ata PDF, and the audio-minutes mapper each learn a second container, and pauta↔seating interleaving needs an ordering rule (build plan). |
| 3 | Governance policy | **Versioned `commission_governance_policies` subsumes `commission_meeting_settings`** (table dropped; rows migrate into each commission's policy v1). Append-only versions: `effective_from`/`effective_until`, `supersedes_policy_id`; non-overlap enforced by a per-commission `tstzrange` **exclusion constraint**, not prose. Carries meeting-quorum fields **and** decision defaults (method, vote visibility, quorum type/value, threshold type/value, `abstentions_in_denominator`, `chair_votes_normally`, `chair_has_tiebreaker`). The meeting quorum panel reads the policy active at `scheduled_start`; the historical snapshot columns on `meetings` stay. |
| 4 | Types & rules | **`deliberation_types` = org-scoped vocabulary** (the `case_types` pattern: `organization_id`, `key`, `display_name`, `is_active`, platform-seeded defaults) so the type is a cross-committee reporting axis. **Rules are commission-scoped**: `commission_decision_rules` rows per policy version keyed by type (method, quorum, threshold, visibility, chair tiebreak); each policy version's own default fields act as the **mandatory fallback rule**, so rule resolution can never return NULL at vote time. Vocabulary/rule edits cannot rewrite history — the resolved rule is frozen into the round (D6/D11). |
| 5 | Chair identity | **Semantic titles + per-session presiding + frozen round snapshot.** `commission_member_titles.governance_role` (`chair` \| `vice_chair` \| `secretary`, CHECK-constrained, nullable; partial unique index: ≤1 chair-title per commission) gives the standing chair. `meetings.presided_by` records who presided the session (defaults to the standing chair; overridable for a substitute). Each vote round freezes `chair_user_id` from the session — authority acts bind to who actually presided, immune to later title churn. `governance_role` is an **authorization input** → checked in DEFINER doors, never UI. Policy-version chair designation rejected (chairs rotate faster than rules). Chair ≠ `staff_admin` — never assume the union (D19). |
| 6 | Motion revisions | **Copy-freeze.** `deliberations.motion_text` is the live draft (+ monotonic `motion_version` bumped per edit). Opening a round copies text + version + resolved rule into the round — immutability by **value snapshot**, no lock triggers, no revisions table. History = the sequence of round snapshots; what was actually put to vote is preserved verbatim forever. Pre-vote wordsmithing stays unversioned (it is minutes content, like agenda `description` edits today). |
| 7 | Voting membership | **`is_voting_member boolean` on commission memberships** (default `true`). The denominator root = active voting members. Meeting-level `eligible_member_count` switches to voting members only so the two quorum computations cannot disagree. Titular/suplente pairing **declined** (a suplente is just a voting member; activation discipline is procedural). |
| 8 | Quorum semantics | **Strict denominator; ballots are the close-time truth.** Recusals never shrink the roster denominator — they reduce who can be *counted present* (the recused "leave the room" and can break quorum for that item). **Open gate** (DEFINER): live attendance ∩ voting ∩ non-recused ≥ quorum, else the round cannot open. **Close gate** (authoritative, inside the closing transaction): participants = distinct snapshotted-eligible voters with any ballot (FOR/AGAINST/ABSTAIN); participants < quorum ⇒ round outcome `no_quorum` regardless of tally. Accepted consequence, stated openly: present-but-silent counts as absent for that decision — `ABSTAIN` exists for the present-but-unwilling case. |
| 9 | Ballots | **Append-only; latest valid ballot per voter wins at close; no retraction without recasting.** Rows carry `voter_id` + `recorded_by` (defaults to voter). **Transcription** (`recorded_by ≠ voter_id`, a secretary recording a show of hands) is allowed for **open** rounds only — the row is an auditable attestation, exactly what a paper ata is today. **Secret rounds require self-cast.** Aggregate-only tally entry **declined** (it would fork the result pipeline and defeat ballot-based quorum). Validity (voter in the frozen eligibility snapshot, not recused, round open at `cast_at`) is enforced in the casting door **and** re-verified at close — never trusted from the client. |
| 10 | Secret ballots | **Read-policy secrecy, not cryptographic anonymity.** `voter_id` always stored (latest-wins, eligibility, quorum all need it). On `SECRET` rounds: a voter reads only their own ballot, ever; **no role in the application** — member, chair, secretary, staff_admin, org_admin, platform_admin — has a read path to another's choice; post-close the stored result exposes aggregates only. `SECRET_UNTIL_CLOSED` differs in one clause: individuals become member-readable after close. **No auditor capability exists, deliberately** — legal/surveyor access to individual secret ballots is an operator-level act under legal process, outside the application. Mid-round: open rounds show live individual votes (a show of hands); secret modes show only "N of M voted" (no running totals — early-tally bias). The ADR states plainly: secrecy is *through the application* (Rule 1); the infrastructure operator is outside the threat model, as everywhere else on the platform. |
| 11 | Close & tiebreak | **Two-step close, each step atomic.** `close_vote_round()` recomputes everything server-side (quorum from ballot participation, latest-valid ballots, denominator, threshold) and finalizes when determinate (`approved`/`rejected`/`no_quorum`). A tie under a rule granting `chair_has_tiebreaker` lands in **`tied_pending_tiebreak`** (aggregates visible, individuals per D10); `cast_tiebreak(choice)` — chair-only, the frozen `chair_user_id` — finalizes atomically. Tiebreak is recorded **on the result, never as a ballot row** (the chair may already hold a normal ballot when `chair_votes_normally`). No tiebreaker in the rule ⇒ **tie = rejected** (motion fails on a tie), stated so nobody expects a re-vote. Result snapshot = **columns on `vote_rounds`** (`tally_for/against/abstain`, `participants`, `denominator`, `threshold_applied`, `quorum_met`, `tiebreak_choice`, `outcome`, `closed_at/by`) — a round closes exactly once; a 1:1 results table is ceremony. |
| 12 | Decisions | **Append-only `committee_decisions` with supersession.** `deliberation_id`, `source` (`vote` \| `consensus` \| `chair_determination` \| `external_authority`), `vote_round_id` (NOT NULL ⟺ source = `vote`, CHECK-constrained), `outcome`, `decision_text` (operative wording, distinct from the motion), `dissent_note`, seating, `decided_at`, `recorded_by`, `superseded_by_decision_id`. Reconsideration **appends** a superseding row; the original stays forever. `deliberations.status` is **derived** — written only by the decision-writing doors. Consensus = the presiding chair's **attestation** (optional dissent note; requires the seating meeting's meeting-level quorum; rests on attestation the way today's paper ata does — no ballot proof exists for consensus, said openly). `chair_determination`/`external_authority` = attestations with a mandatory justification note. `CONSENSUS_THEN_VOTE` needs no schema: a failed attempt is recorded as a **non-terminal** `consensus_not_reached` decision row (does not set entity status), then a round opens. |
| 13 | Meeting binding | **`vote_rounds.meeting_id NOT NULL`** — every round anchors to a seating on a real session ("quorum while deciding" is only coherent inside a session). `remote_voting_allowed` / `asynchronous_voting_allowed` are **dropped from the v1 policy schema** — declined until enforceable (a config boolean nothing enforces is the declared-param blind spot this repo has already been burned by). Videoconference participation needs no flag: the member is marked present and casts from wherever they are. Async voting returns, if ever, as its own ADR with its own quorum theory. |
| 14 | Formal resolutions | **Promotion into controlled documents.** A sufficiently important decision mints a `controlled_documents` row with new `doc_type = 'resolution'`, seeded from the decision's operative text; provenance = nullable `controlled_documents.source_decision_id`. Numbering ("RES-003/2026") is **DB-assigned** per commission + year inside the minting DEFINER door (never client-supplied), stored in `code`. The resolution then rides the shipped doc lifecycle (sign, effective-date, supersede, print). **Promotion is optional and rare** — no workflow may require it; the decision record is complete without one. ⚠ **Dependency:** the document model is mid-redesign (ADR 0114 ratified 2026-08-12, build not started) — this decision binds to whichever document substrate is ratified, not to today's exact shape. |
| 15 | Origins | **Typed nullable FKs on `deliberations`**: `case_id`, `controlled_document_id`, `referral_id` — all nullable, no exactly-one CHECK (a free-standing matter has none). Polymorphic `(origin_type, origin_id)` rejected (no FK integrity, invisible to sweeps). Multi-origin **declined** for v1 (workaround: one deliberation per case, or primary-case origin with the rest named in the motion). **An origin FK is a confidentiality edge** — see D16. |
| 16 | Read boundary & PHI class | **One composable predicate**: `app.can_read_deliberation(d)` = active commission membership ∧ (`case_id IS NULL` ∨ case-ACL access). Every read surface (entity, seatings, rounds, decisions, ballots-per-D10) composes it — one keystone for the door sweep. No deliberation-level ACL in v1 (sensitivity comes from the case; the case ACL is the shipped, audited restriction machinery). `motion_text`, `decision_text`, `dissent_note`, recusal `reason` = **WS-B PHI-bearing free text** (reads audited as *that + who*, payloads never copied into the audit log). This is **not** a fourth Rule-12 Class-1 module — free text that may reference patients, like agenda items; no `referral_patient`-style single door. Vertical arms: `platform_admin` — nothing (noun rule; ballots above all); `org_admin`/`hospital_admin` — nothing content-level; ADR 0100 oversight may gain **counts only** through its container-level pattern. Recusal reasons get a **distinct audit event** (they are sensitive about the *member*). Recusals: `deliberation_recusals` (deliberation-scoped — COI attaches to the matter, spans rounds). |
| 17 | Meeting-lock interplay | **(a)** `Concluir reunião` refuses while any seated round is `open`/`tied_pending_tiebreak` — close it or void it (`cancelled` round: recorded, never deleted, excluded from arithmetic). **(b)** The child lock extends to that meeting's seatings and rounds (ata content), **not** the deliberation entity — the lock follows session artifacts, as `meeting_cases` freezes while the Case lives. **(c)** Ballots/decisions are already append-only; the guard still lists them explicitly so `ARM=floor` sees a denial, not an assumption. **Invariant (one sentence): no deliberation state is a hard lock; immutability lives entirely in the children.** Even `withdrawn` is staff_admin-reversible, both acts audited. |
| 18 | Legacy free text | **Asymmetric ruling: topics may end informally; cases may not.** `meeting_agenda_items.resolution` **stays** — an informal outcome note with *no governance weight* (feeds ata text only; dashboards count decisions, never `resolution` strings; keeps ADR 0080's carry-forward semantics intact). `meeting_cases.decision` is **dropped** — a case disposition is exactly what surveyors trace, so it is forced through the typed substrate; the lightweight path is D12's consensus flow (one dialog). `meeting_cases` survives as the discussion link with `summary`; existing `decision` values fold into `summary` ("Decisão: …") so no ata text regresses. |
| 19 | Lifecycle & operators | `deliberations.status` ∈ **`open` → `tabled` ⇄ `open` → `decided` \| `withdrawn`** — nothing else; outcomes live on rounds/decisions. Storage keys **English**, labels pt-BR (post-D11 direction; final vocabulary picked now, pre-pilot, never re-keyed). Operators: **`staff_admin`** (the secretary in practice) creates/edits/seats deliberations, opens/closes/voids rounds, records transcribed open ballots, tables/withdraws; **the presiding chair** does authority acts only (consensus verdict, tiebreak, chair determination); **voting members** cast their own ballot and read per D16. Member-proposed deliberations **declined** in v1 (ask the secretary — matches curated-pauta practice, keeps the write surface small). Every door checks its own requirement; chair and staff_admin are never assumed to coincide. |
| 20 | Packaging | Flag **`deliberations`**, prod OFF, seed forces ON for local/E2E (the `audio_minutes` pattern). Everything sits behind it except the D3 subsumption (the quorum panel needs the policy read regardless). pt-BR labels: **Deliberação** (entity), **Proposta** (motion text), **Votação** (round), **Voto** (ballot), **Impedimento** (recusal — the regimental term), **Consenso**, **Decisão**, **Resolução**, **Voto de qualidade** (tiebreak). SQLSTATE prefix: reserve **`HC0V`** (verify unused against the catalog at build time — the 0080 `HC0D` collision lesson). Build plan lands separately in `docs/plans/deliberations.md` after ratification. |

### Threshold arithmetic (normative — pgTAP pins this table)

Let F/A/B = latest-valid FOR/AGAINST/ABSTAIN counts, C = F+A+B (cast), E = frozen eligible-roster
size. Quorum (D8) is checked first; a failed quorum ⇒ `no_quorum`, no threshold is evaluated.

| Threshold type | Passes iff | Denominator note |
|---|---|---|
| `simple_majority` | F > A | Among cast votes; abstentions never count against (the `abstentions_in_denominator` flag does not apply). Tie ⇒ D11 tiebreak path or `rejected`. |
| `absolute_majority` | F > E / 2 | Of the frozen eligible roster — abstaining or not voting works against the motion by construction. |
| `supermajority` | F / D ≥ 2/3 | D = C if `abstentions_in_denominator` else F+A. Strict ≥. |
| `custom_percentage` | F / D ≥ p | Same D rule; p from the frozen rule (0 < p ≤ 1). |
| `unanimous` | A = 0 ∧ F ≥ 1 | Abstentions permitted unless `abstentions_in_denominator`, in which case B = 0 too. |

Quorum types: `fixed_number` (participants ≥ n), `percent_eligible` (participants ≥ ⌈p·E⌉),
`absolute_majority` (participants > E/2). "Participants" per D8 = ballot-holders.

## Consequences

- **New tables**: `commission_governance_policies`, `commission_decision_rules`,
  `deliberation_types`, `deliberations`, `deliberation_seatings`, `deliberation_recusals`,
  `vote_rounds` (+ eligibility snapshot rows, e.g. `vote_round_eligibility`), `vote_ballots`,
  `committee_decisions`. **Dropped**: `commission_meeting_settings` (subsumed),
  `meeting_cases.decision` (folded into `summary`). **Changed**: `commission_member_titles`
  (+`governance_role`), `memberships` (+`is_voting_member`), `meetings` (+`presided_by`),
  `controlled_documents` (+`source_decision_id`, +`doc_type='resolution'`).
- **Security estate grows by design**: every new DEFINER door (open/close/void round, cast ballot,
  cast tiebreak, record consensus/attestation, record recusal, mint resolution, policy/rule writes)
  enters the ADR 0079 census/keystone estate from day one — `ARM=census` is the arm that catches a
  brand-new gate. The D10 secret-ballot policies and the D16 predicate are **named door-sweep
  targets**; the diff-scoped sweep at the phase gate derives its list from the migration diff.
  `prosecdef` belongs beside `pg_policies` (standing corollary).
- **Surfaces that must learn seatings**: agenda rendering (interleaving rule), carry-forward
  (a `tabled` deliberation's seating is the analogue of `resolution IS NULL` — ADR 0080 D7 gains a
  second source), the ata PDF, and the audio-minutes context mapper. Each is a build-plan work item,
  not an afterthought.
- **The meeting-settings UI is rebuilt** as the governance-policy editor (versioned, with per-type
  rules); the quorum panel reads the policy active at `scheduled_start`. `eligible_member_count`
  semantics change to voting-members-only (D7) — pgTAP over the meeting quorum computation must be
  re-pinned.
- **Honest-limitation statements carried in-product docs/ADR, not hidden**: consensus rests on chair
  attestation (D12); secrecy is read-policy through the application (D10); present-but-silent counts
  as absent for that decision (D8); discussion-phase wordsmithing is unversioned (D6).
- **Declined scope (do not re-litigate casually)**: async/remote voting flags (D13), aggregate-only
  tally entry (D9), titular/suplente pairing (D7), member-proposed deliberations (D19),
  deliberation-level ACL without a case (D16), an auditor unmasking capability (D10), multi-origin
  (D15), explicit revisions table (D6).
- **Rule 12 posture**: WS-B free-text class only; no new Class-1 module, no new single-door PHI
  read path. The three-module inventory in CLAUDE.md §1 is unchanged by this ADR.
- **Stale-text discipline**: this ADR names concepts, not catalog literals, wherever the catalog is
  authoritative (meeting status keys, action-items hub, doc_type CHECK). Build tasks verify against
  `pg_proc`/`pg_policies`/the live CHECKs, never against migration file text or this document.
