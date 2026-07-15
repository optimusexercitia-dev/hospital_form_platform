# ETH·E1 — Ethics Access Spine (the m2 gate release) · track record

**Status:** ✅ **COMPLETE** — human-approved + recorded **2026-07-14** (`phase(E1)`).
**Stage:** S3 of the [Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR
[0071](../decisions/0071-pre-pilot-release-scope-expansion.md)).
**Spec:** ADR [0072](../decisions/0072-ethics-access-spine.md) · build plan
[ethics-e1-access-spine.md](../phases/ethics-e1-access-spine.md) · SQLSTATE block `HC0E0–HC0E9`.
**Review:** [phase-ETH-E1-review.md](../reviews/phase-ETH-E1-review.md) (3 rounds — CHANGES → CHANGES → **APPROVED**).
**Owner:** `backend` (E1 ships **no new ethics UI** — that's E2/E3; it was tested through the existing
case/attachment/meeting screens). `frontend` touched only the IV2 label-map regression + one comment.

---

## 1. What shipped

The access spine that makes the F1 generalized-subject layer **safe to hold real ethics complaint data**, and
then — only once the m2-flip checklist was green — **released the m2 hard gate** (`case_participants` +
`case_types` ON). Local-only; production stays OFF until the deliberate pilot reset.

| Task | What landed |
| ---- | ----------- |
| BE-1 | Typed contract stubs (`cases.ts` types · new `participants/actions.ts` + `case-recusals/actions.ts` · IV2 action additions). |
| BE-2 | `cases.visibility_policy`+`confidentiality_level`; `case_types.default_confidentiality_level`; `case_access.max_confidentiality` (**O1** = the column, not widening `level`); `app.confidentiality_rank()`; optional `p_case_type_id` snapshot param on `create_case_from_template`. |
| BE-3 | `case_conflict_declarations` + `case_recusals` — DEFINER-write-only, the **D4 self/coordinator SELECT asymmetry**, partial-uniques (`HC0E0`/`HC0E2`). |
| **BE-4** | **The m2 core.** `is_case_respondent`/`is_recused_from_case` (R6-safe, base-table, EXPLAIN-index-verified); the 2 hard-deny terms evaluated **first** in `can_read_case`/`can_read_case_patient`/`can_write_case_content`; `explicit_grants_only` flag-OFF fallback suppression (**both** read predicates); the doc-confidentiality ceiling via `attachment_confidentiality_ok` at `open_attachment` (`HC0E6`) + the attachments SELECT policy. |
| BE-5 | 10 DEFINER write RPCs — participant CRUD, professional-profile writers, `set_case_confidentiality`, `declare_conflict`/`record_recusal`/`lift_recusal`. **No `dispose_*`** (M2 §7). |
| BE-6 | IV2 fold-in (X-γ): `participant_id` FKs on the interview family; confidentiality 3→7-value **enforcing** remap (**O3**) via a new `can_read_interview`; `interview_session_attendance`/`interview_topics`/`interview_summaries`; 5 fold-in RPCs; a normalization trigger so IV2's `create/update_interview` keep working un-reproduced. |
| BE-7 | `list_my_cases` explicit respondent/recusal exclusion; `getCaseDetail` ethics fields (TS-side, RLS-scoped). |
| BE-8 | **m2-flip checklist all 7 green** → `case_participants`+`case_types` **ON** (migration, per D10) + `FeatureFlags` interface + seed personas. |

**Migrations:** `20260720000980`–`…001070` (10 files; `…1050`/`…1060`/`…1070` are the QA fix loop). Local-only
(`supabase migration up`) — this phase **never** ran `db push`.

**Commits (14):** `167b269`(BE-1) · `cc4dc15`(BE-2) · `9f45bb9`(BE-3) · `fe1ba18`(BE-4) · `9180a27`(BE-5) ·
`5091d50`(BE-6) · `349379f`(BE-7) · `5fcc442`(BE-8 flip) · `fcbc767`(blank-badge fix) · `28b6cf7`(E2E spec) ·
`1ce93a8`(IV2 stale assertions) · `35d5da5`(QA MAJOR-1/2 + MINOR-1/3) · `3d6b5ae`(QA INFO-1) ·
`6d6eb58`(QA MINOR-2) · `02bd2db`(QA MAJOR-3 + the generic sweep).

**Settled open decisions:** **O1** = `case_access.max_confidentiality` column · **O2** = only `legal_privileged`
+ `credentialing_sensitive` gate above case-read · **O3** = `standard→non_phi_internal`,
`restricted→peer_review_confidential`, `highly_restricted→ethics_investigation` · **O4/M2** = minimise-not-destroy,
retention-pinned, **no erasure path** (PO-signed at S0; QA verified zero erasure RPCs shipped).

---

## 2. Final gate

| Check | Result |
| ----- | ------ |
| pgTAP | **91 files / 2537 tests — all pass** (fresh reset). `228_ethics_e1` grew **111 → 125**. |
| E2E | `ethics-e1-access-spine` **13/13 + 1 justified skip** · `phase11-interviews` **13/13** (both fresh build+reset; 26/26 combined). |
| Quality | typecheck clean · lint **0/0** · Vitest **369/369**. |
| QA | ✅ **APPROVED** — 0 Blocker · 0 Major · 2 Minor (sweep coverage, deferred to E2). |

**Full `e2e:prod` was run once** (38 reds → triaged: 1 real regression, since fixed; 3 clusters proven
environmental via isolated repro with server-log capture). **A second full run was skipped by PO instruction**;
the gate rests instead on that run + isolated re-confirmation of every touched spec + an independently-run full
pgTAP suite. **QA explicitly endorsed this evidence composition** (the fix's blast radius was exactly the two
re-run specs; the Majors were coverage-*shape* gaps no re-run would have caught).

---

## 3. The QA fix loop — three RLS-leak shapes, found three different ways

The headline lesson of this phase. `can_read_case` was **correct from BE-4 onward**; the leaks were all in the
**policies consuming it**, and each shape was invisible to the method that found the previous one.

| # | Shape | Found by | Reachable as |
| - | ----- | -------- | ------------ |
| **MAJOR-1(a)** | 9 `*_select` policies (+ `can_read_interview`) OR `is_commission_admin_of(...)` **outside** the DEFINER → the hard-deny never gets the last word. | QA, by grepping `can_read_case`. | `org_admin`/`hospital_admin` |
| **MAJOR-1(b)** | `*_staff_admin_write` policies are **`FOR ALL` PERMISSIVE with a bare admin `USING` and no case predicate at all** — never name `can_read_case`, so no grep finds them; `FOR ALL` covers SELECT and permissive policies OR together → row handed back regardless of `cases_select`. | **backend**, after fixing (a) and finding `cases`/`case_phases` *still* leaking. | `org_admin`/`hospital_admin` |
| **MAJOR-3** | `meeting_cases` (the case↔meeting join, carrying `summary`+`decision` **deliberation free text**) keys on the **meeting** dimension with **zero** case predicate. | **QA**, only by *sweeping all 15 `case_id` tables* — invisible to both greps. | **plain `staff`** — ADR 0072's canonical persona |
| **MAJOR-2** | `record_recusal`'s self-arm had **no authority gate** → cross-tenant write into another org's case **and** its hash-chained audit trail; plus a case-existence oracle. | QA. | any `org_admin`, any org |

**Fixes:** `app.can_read_case_or_admin()` (denies first, then ORs admin) for (a) · `app.is_case_excluded()` as an
`AND NOT` conjunct on 8 case-scoped `FOR ALL` write policies + 3 interview-family write policies +
`case_access_select` (self-arm preserved) for (b) · `app.can_reach_case_on_member_surface()` on
`meeting_cases_select` for MAJOR-3 · a reach gate on `record_recusal`'s self-arm for MAJOR-2 (closed *better than
asked* — real-but-unreachable and random-UUID now return byte-identical SQLSTATE **and** message, killing the oracle).

### 3.1 The MAJOR-3 fix — backend correctly overrode QA's recommendation

QA prescribed `and can_read_case_or_admin(case_id, auth.uid())`. Backend **tested it against the seed before
implementing** and found it closes both proofs **but silently regresses ordinary meetings**:

```
staff4.ccih (plain CCIH member, no grant, seeded commission_default meeting-linked case)
  is_member_of_for                 → true
  can_read_case_or_admin           → FALSE   ← QA's conjunct would have deleted their reach
  can_reach_case_on_member_surface → true    ← the shipped predicate preserves it
  meeting_cases actually read      → 1       ← the no-op, empirically
```

`can_read_case` has **no plain-member arm** on the `case_access`-ON path **by design** — member-wide reach for
ordinary cases comes from the member-facing surfaces, not the predicate. The correct semantics were **already in
ADR 0072 D2·8**, which names *"meeting case-labels"* a member-facing reach surface and specifies the three clauses
verbatim (incl. *"no `commission_default` case loses reach"*). QA verified the override on re-review and
**concluded it had been wrong**: *"My fix would have silently deleted ordinary members' reach… Backend tested my
recommendation before implementing it rather than complying. That's correct engineering and it caught my mistake."*

QA's decisive structural point on faithfulness: the prior meeting-arms are preserved **verbatim** and the new
predicate is **AND**-ed on — a conjunction is monotonically narrower than its first conjunct, so the policy can
only return a **subset** of what it returned before. Widening is structurally impossible.

### 3.2 The coverage-shape gap — why 2523 green assertions missed MAJOR-1

The pgTAP asserted the **predicate** (`is(app.can_read_case(...), false)`) but **never performed a table-level
`select` under `set local role authenticated`**, and every respondent/recusal persona was a plain staff user,
never an admin. Tests green, requirement unmet. Fixed: `228` gained **policy-layer** assertions (real `select`
under an assumed role) with respondent/recused personas who are **also org_admins**, each verified
**fail-before/pass-after** (before: 7 then 4 failing; after: 125/125).

### 3.3 The generic leak sweep (lead-directed, brought forward from E2)

Enumerates every `case_id`-bearing base table **from `information_schema`** (never a hand-maintained list) +
`cases`, under `set local role authenticated`, for **both** persona classes (plain-staff respondent **and**
non-granted member on an `explicit_grants_only` case — MAJOR-3 proved these are different reach paths), and
**names** offenders. **Fail-closed**: a future table with the wrong shape fails automatically, with nobody
having to predict it. It caught MAJOR-3's residue on its first run plus the two exclusions below.

---

## 4. Known gaps — **PO-directed 2026-07-14: log for E2, don't act now**

All three are **pre-existing scope decisions E1 does not own**, made *visible* by E1's stricter model. QA and
backend independently judged each out of E1's scope; the PO agreed and routed all three to **ETH·E2**.

1. **`action_items` `assignees_only` arm** — never consults `can_read_case`, so a respondent-who-is-org_admin
   could see an assignees-only item on their own case. AI's shipped item-visibility model; org_admin-only; no case
   content.
2. **`patient_safety_event`** — `can_read_event` has three event-dimension arms and **zero case arm**; an
   independent NSP record that merely *links* to a case and carries its **own** incident narrative, not case
   deliberation (QA: *"the decisive contrast with MAJOR-3"*). Residual exposure = link-existence inference only.
   Gating it would rewrite the NSP/PHI-module-1 model E1 doesn't own.
3. **Privileged-doc ceiling has no coordinator arm** — a `staff_admin` needs a `case_access.max_confidentiality`
   clearance to open a `legal_privileged`/`credentialing_sensitive` doc, so the coordinator who *uploads* one must
   self-grant clearance to reopen it. **Correct per D5's grant-based model**; the E2/E3 UX affordance
   (self-clearance-on-upload) is the follow-up.

**Two QA Minors (non-blocking, test-coverage only) → E2:** **MINOR-A** the sweep can pass **vacuously** — measured
10/14 covered, 4/14 vacuous (`action_items`, `case_phase_offered_results`, `case_tag_assignments`, and **E1's own
`case_conflict_declarations`** — safe by construction but unproven); report zero-row tables as *uncovered* rather
than silently passing. **MINOR-B** `action_items` passes the sweep by **fixture accident**, not by documented
exclusion — when someone seeds one it'll fail and look like a regression. Make it a decision, not an accident.

**Deferred by design:** participant-roles M2M (D7·4) → E2 (no §4 gate criterion covers it; its shape depends on
E2's decision model — nothing half-built was left behind, QA-verified).

---

## 5. Incidents worth remembering

- **The IV2 blank-badge regression** (`fcbc767`) — BE-6's O3 remap made `case_interviews.confidentiality_level`
  return `non_phi_internal`, a value outside IV2's shipped 3-value TS union, so `CONFIDENTIALITY_LABEL[level]`
  resolved `undefined` and **every** interview's badge rendered **blank**. Caught by the full `e2e:prod` gate, not
  by pgTAP. Fixed by aliasing `InterviewConfidentiality` to the canonical client-safe `ConfidentialityLabel`
  (`src/lib/attachments/constants.ts` — one taxonomy, no parallel copies, X-δ) + widening the label/style/order maps
  to all 7 values. The `Record<InterviewConfidentiality, string>` typing now makes a missing key a **compile
  error** — the bug can't recur. The stale *"não restringe o acesso"* helper copy was corrected in the same pass
  (it became false the moment the tier started gating).
- **`CONFIDENTIALITY_ORDER` is display order, NOT sensitivity order** (`6d6eb58`) — `app.confidentiality_rank()`
  ranks `ethics_investigation`(4) **below** `legal_privileged`(5); the array's order is the reverse. **Never
  reorder the array to "match" the rank** — that would let an `ethics_investigation` clearance open
  `legal_privileged` docs. The comment now says so explicitly, because the failure mode is a future reader
  "helpfully" sorting it.
- **Stray-branch incident** — the working tree was silently checked out onto an unrelated stale branch
  (`claude/question-block-form-error-b224b1` @ `b0387d3`) mid-phase, reverting all 8 migrations off disk and
  landing 2 tester commits on the wrong branch. Nothing was lost (history intact); recovered by stash → checkout
  → stash pop → cherry-pick. Reflog showed a second stray `checkout HEAD`. **Verify `git branch --show-current`
  before committing** in this environment.
- **The gate that wouldn't die** — stopping the tracked `e2e:prod` task did **not** reap the `e2e-prod-gate.sh`
  process tree (cmd → bash → npx → playwright → chromium). It kept running for ~30 min, its per-batch `db reset`
  corrupting backend's concurrent work (empty `gen types`, "planned N, ran 0") while backend's resets corrupted
  the gate. **Kill by PID and verify**; a single shared local stack tolerates exactly one owner.

---

## 6. Where the surface is documented

`docs/backend-state.md` — the durable backend map (new tables/RPCs/predicates + the flag flip).
ADR [0072](../decisions/0072-ethics-access-spine.md) — **As-built** section carries the deltas + Q-rulings.
