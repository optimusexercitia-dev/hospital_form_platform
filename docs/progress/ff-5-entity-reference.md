# FF-5 — Entity Reference (ADR 0091) — phase record

**Status:** ✅ complete · human-approved 2026-07-28 · **not merged to `main`**, not deployed.
**Branch:** `ff/flexible-forms-program` · **commits:** `f0cc3ac`…`82c62a5` (22)
**Flag:** `entity_refs` — seeded OFF in `20260902000000`, flipped ON by `20260902000600`.
**ADR:** [0091](../decisions/0091-ff5-entity-reference.md) (+ Amendments 1–2) ·
**QA:** [phase-FF-5-review.md](../reviews/phase-FF-5-review.md) — r1 CHANGES REQUESTED → r2 **APPROVED**.

Rotated out of PROGRESS.md at Record (CLAUDE.md §7). PROGRESS.md keeps the one-line
phase-status row; everything else is here.

---

## 1. What shipped

Reference form items pointing at one of three lanes — **participant | commission | user** —
single-target (v1), typeahead picker, working at top level **and** inside repeating groups.

**Migrations** `20260902000000`–`…000900` (9):

| Migration | Contents |
|---|---|
| `…000000` | 3-lane `reference_kind`; `commission_id`/`profile_id`; kind↔target XOR; `unique (answer_id)`; relaxed the `reference` arm of `form_items_input_vs_display`; **SELECT door parity** (base + corrector + targeted); flag seeded OFF |
| `…000100` | `app.ensure_answer_rows` (extracted); `app.assert_reference_answer_writable`; `app.guard_reference_coherent` (trigger); `app.save_reference_answers`; `public.reference_candidates` (**INVOKER**) |
| `…000200` | `save_section_answers` gains `p_references` (11th param, DROP+CREATE); `app.save_instance_answers` gains the per-instance arm |
| `…000300` | `app.item_required_satisfied` + `app.instance_is_empty` reference arms |
| `…000400` | **`app.copy_response_answers`** — extracted; both correction RPCs delegate |
| `…000500` | `app.references_by_item` sign-off projection + dashboard aggregation |
| `…000600` | flag flip |
| `…000700`/`…000800` | pt-BR participant labels at all 3 emission sites; the `anon` revoke (Amendment 2) |
| `…000900` | sign-off: top-level `other_text_by_item` projection **+ the observation-scope fix** |

**Tests:** `supabase/tests/276_ff5_references.sql` (73 assertions) · `e2e/ff5-references.spec.ts`
(10) · `reference-picker.test.tsx` (10) · `reference-answers.test.ts` (7) · `item-type-sets.test.ts`.

**Final bar:** pgTAP **4240/4240** fresh reset · Vitest **851/851** · lint 0/0 · typecheck clean ·
`next build` · FF-5 E2E 10/10 ×2 · neighbours 21/21 · full `e2e:prod` 863 passed (see §5).

---

## 2. The decision that changed the phase

The program plan required a **PHI-read audit door** for the participant lane and a **Rule 12
module-list amendment**. Both rest on the premise that resolving a participant reference reads
PHI. Checked against the live catalog at phase start, the premise is **false**:

- `set_participant_patient` — the only door that creates a patient participant — **hardcodes**
  `'Paciente'`. It accepts a `p_name` and routes it to `patient_identifiers`, so the surrogate
  holds *even though a real name crosses the door*.
- `dispose_case_phi` is the only other writer; it assigns the constant `'[PHI removido]'`.
- `authenticated` holds **SELECT only** on `participants`.
- `patient_identifiers` / `patient_participants`: RLS on, **zero policies, zero grants**.

So FF-5 reads no PHI, needs no door, and **Rule 12 still enumerates exactly three PHI modules**.
QA attacked this specifically in both rounds and it held.

The same finding produced the practical problem the plan missed: every patient's label is the
identical string `'Paciente'`, so an org-wide patient typeahead is unusable *and* enumerates the
org's whole patient population. **PO ruling: patients are case-scoped, other participant types
stay org-scoped** (ADR 0091 ruling 2).

---

## 3. Defects found, and what each proves

**Four defects were invisible to every automated gate.** All four passed pgTAP + Vitest + tsc +
lint + `next build`.

| Bug | What | Found by |
|---|---|---|
| **BUG-FF5-001** | `reference` missing from `ALL_ITEM_TYPES`, `ANSWERABLE_TYPES` **and** `parseItemFields` — the builder could not create a reference item at all, and `updateItem` was broken independently | E2E |
| **BUG-FF5-002** | the submissions page never passed `referencesByItemId`; the prop was optional-with-default, so tsc could not object and every reference rendered "Sem resposta" | E2E |
| QA m-3 (a) | `get_response_for_signoff` never projected top-level `other_text` — the signer saw the chip without the typed text | making a prop **required** |
| QA m-3 (b) | its top-level `observations_by_item` had **no `group_instance_id` filter** — an instance's observation could render attached to a top-level question, `jsonb_object_agg` picking arbitrarily | making a prop **required** |

(b) is the serious one: **wrong** data, not missing data, on an attestation surface. No
reader-side test could have caught it — the TS filters were correct throughout; only the DEFINER
door was wrong. That is the structural blindness ADR 0079 exists for.

Both BUG-FF5-\* were fixed at the **mechanism**: type sets single-sourced in `item-tree.ts` with a
DB-authority test; **all six** answer-payload props made required (four — `matrixCellsByItemId`,
`riskMatrixByItemId`, `observationsByItemId`, `otherTextByItemId` — carried the identical latent
exposure since FF-1/FF-2 and merely happened to be passed).

### The sign-off projection is now a three-phase pattern

FF-1 added `instances`, FF-2 added the grids, FF-5 added references **and** the `other_text` that
had been missing the whole time. **Every new answer shape owes this projection at both scopes.**
`276 §N` pins the projection's **key set**, not one key — a single-key test would have passed for
all three shapes that went missing before it.

---

## 4. Eight checks that were vacuous by construction

Each *looked* exactly like verification while being incapable of failing for the reason it claimed
to pass. **Review found none. Mutation found all.**

1. §B door-parity joined `answers` — widening `answer_references_select` to `using (true)` stayed **green** (it measured a different table's door).
2. §G PHI check used `pg_depend` — which records **no table dependencies for plpgsql bodies**, so it passes for every function ever written.
3. §C's six XOR negatives inserted against **zero rows** — nothing raised, so nothing failed.
4. A cross-tenant fixture resolved its target **under RLS** → got `null` → the writer read that as "clear" → nothing raised.
5. `ITEM_TYPE_AUTHORITY` built from `readonly string[]`, whose `[number]` is `string` — `Exclude` collapsed to `never` and passed for **any** union.
6. **§F's control used a `department` participant**, which short-circuits before the case-scoping branch — so ruling 2's whole mechanism could be **inert (always-deny)** and the section stayed fully green.
7. **§N's fixture had no `other_text`** — deleting the filter it exists to pin left N1–N5 green; and N5 asserted *cardinality*, so an **inverted** filter (returning exactly one key — the wrong one) also passed.
8. **`r2-m-1`, still open** — §O pins the behaviour of the door that exists, not the **closure of the writer set** ADR 0091's substrate paragraph claims. A rogue *unqualified* INVOKER writer stays green (O5's regex only matches `public.`-qualified writes), as does a third DEFINER writer taking a caller-supplied label.

Three catalog probes outside test files had the same defect: an `insert into`-only sweep labelled
"writers of `display_name`" (could never return an UPDATE writer), a `display_name\s*=` regex
(cannot separate assignment from a `WHERE` comparison), and a proposed replacement predicate that
inherited the ambiguity.

> **The rule that catches all of them: check that your predicate could have failed for the reason
> you are claiming it passed.** The natural way to write a catalog probe tests *presence of a
> shape*, and presence-of-shape is almost never the property you care about. Same family as the
> repo's existing "a no-regression test passes a widening by construction".

---

## 5. Gate evidence

**pgTAP** 4240/4240 on a fresh `supabase db reset`. ⚠ A second suite run against the same DB gives
**4200 + a hard abort in `161_recommend_result_source`** (that file mutates feature flags). That is
contamination, not a defect — CLAUDE.md §6 step 1's "fresh reset" is load-bearing, and the lead
tripped over it once.

**Full `e2e:prod`** — 863 passed · 53 failed · 1 flaky. **All 53 were one dead server.** Every one of
the 106 errors in batch 5 is `net::ERR_CONNECTION_REFUSED` and **not one is an assertion failure**;
`server.log` shows `The destination stream closed early` after test 8. Batch 5 held the six heaviest
FF specs in a single server lifetime. Re-running the identical 63 at `BATCH_SIZE=2` → **63/63**.

> Triage order that settled it in two steps: **count connection errors per batch first, then look
> for any non-connection error kind.** There were none. Same shape as FF-3's gate (140 raw, 2 real).

**Mutation proofs** (all produced the predicted red; QA re-ran them independently rather than
accepting the relay):

| Neutralisation | Red |
|---|---|
| remove the case-scoping narrowing | F2 + F5 |
| force the patient arm to always-deny | **F6 alone** — F2/F5 green, which *is* defect 6 demonstrated |
| write `p_name` into `display_name` | O1 + O2, **O3 green** (so the pair cannot pass for a door that discarded its input) |
| `grant update on participants to authenticated` | O4 |
| un-scope the top-level `other_text` filter | N6 |

---

## 6. Open items

- **`r2-m-1` (MINOR, filed at PO direction 2026-07-28)** — close §O's writer-set gap: pin the set
  by count **and** name with `(public\.)?participants\y` (`\y`, not `\b` — backspace in Postgres
  regex). Guards ADR 0091 ruling 1, which is why Rule 12 stays at three modules.
- **Patient-lane sublabel degeneracy — PO DEFERRED 2026-07-28.** The picker shows
  `Paciente / Paciente afetado`; the durable submitted record and wizard resume show
  `Paciente / Paciente`, because `buildReferenceAnswers`' input row carries no case data and
  resolves the participant *type* while the picker and sign-off projection resolve the case
  *role*. Two patient references in one case are **indistinguishable in the permanent record**.
  QA rates it MAJOR-but-ship: every disambiguator that would work is PHI and would reverse ruling
  1, so the mitigation is a **workflow rule** (distinct `case_participant_roles` per patient per
  case), not code. ⚠ **The patient lane is live behind `entity_refs` once this deploys** — this
  needs resolving before the lane is offered to a real committee.
- **`app.*` schema-wide PUBLIC EXECUTE** — QA: accept. Narrower than first stated: `app`'s
  `nspacl` has **no PUBLIC entry**, so `anon` lacks schema USAGE entirely; PostgREST exposure
  (`PGRST_DB_SCHEMAS=public,graphql_public`) is the *second* barrier, not the only one.
- Deferred by ADR 0091 and unchanged: conditions on reference answers (ruling 5), multi-target
  (ruling 9), hospital/org lanes.

## 7. Process findings

- **`git add <dir>` is unsafe on a shared worktree — and path-scoping the add is not enough.**
  `git commit` commits the **whole index**, so a concurrent session's staged files ride along
  regardless. Use `git commit -- <paths>`, or check `git status --short` immediately before
  committing. This bit two agents in opposite directions within an hour; `b94785f` still carries
  seven of another teammate's files under the wrong message (nothing lost — verified byte-present).
  Worth adding to the lead-playbook.
- **PROGRESS.md is a contention point** when several teammates run concurrently — one collision
  produced a duplicate block under a mislabeled header.
