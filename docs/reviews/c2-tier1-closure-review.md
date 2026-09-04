# C2-TIER1 closure — QA review

**Verdict: CHANGES REQUESTED**

**Reviewer:** `qa` · **Date:** 2026-09-04 · **Tree:** `main` @ `e6ce6561`, clean
**Subject:** the closure of `C2-TIER1` (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, Critical FUP C2) on ADR
0187 D1's three conditions, at a final tally of **COVERED 170 · BLIND 1 · ERROR 0 = 171**.

⛔ **Required disclosure (ADR 0187 D1), stated because this is a gate record citing this sweep:**
**Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.** Nothing in this work touched
them. The other populations and the anti-promotion sentence are at
`docs/progress/c2-tier1.md` § "The disclosure block", and I have audited them below.

---

## Summary

**The measurement is sound and I could not break it.** Every substantive claim I could check
independently held, and three of them held against my own re-derivation rather than by reading the
record. The three ADR 0187 D1 conditions are, in substance, discharged.

The changes I am requesting are **not** about the measurement. They are two record defects that sit
inside the *conditions of the closure themselves* — the mandated disclosure block misstates the
class-B label count, and a standing rule in `.claude/rules/` still asserts a safety property this
session's own incident falsified — plus a derived artifact that is not clean. None of them needs a
re-sweep. All are hours of work.

I want to be explicit that this is unusually rigorous work: the session found its own errors at a
higher rate than I could find new ones, and several of its self-corrections (Phase B1 correction 6,
the `apenas`-is-a-syntax finding, the "landing a mutation is not producing a verdict" framing) are
the kind of finding a reviewer normally has to supply.

---

## What I verified, and how

Read-only throughout. No application code, migration, spec or harness was touched. I did not run the
mutation harness (per instruction, and because a killed sweep stranded a live gate today).

### V1 — The tally reconciles exactly, and I derived it myself ✅

`docs/reviews/c2-command-door-findings.md`:

| what | my measurement |
| --- | --- |
| data rows (`^\| \``) | **171** |
| `**COVERED**` | **170** |
| `**BLIND**` | **1** |
| `**ERROR**` | **0** |
| the single BLIND | `app.print_source_series(p_source_kind text, p_source_id uuid)`, line **157** |

The merge at `f33d9ba7` changed **exactly 64 rows**, and the transition census is
**39 `BLIND`→`COVERED` + 25 `ERROR`→`COVERED`**, with **zero** rows changed in any other direction
and **zero** pre-existing `COVERED` rows touched. That reconciles arithmetically against the
corrected baseline without my having to trust any figure in the record:

- 106 + 64 = **170 COVERED**
- 40 − 39 = **1 BLIND**
- 25 − 25 = **0 ERROR**  → 171. ✅

### V2 — No note was hand-written (ADR 0153) ✅

Every one of the 171 notes is byte-identical to a string the harness emits:
`c2-command-door-neutralizer.sh:371` (COVERED) and `:374` (BLIND). There are exactly two distinct
note strings in the file and no third. No row carries prose a human could have composed. ✅
(But see **M1** — the file is not *clean*.)

### V3 — Suite baseline, independently re-run ✅

`npx supabase test db` on the current tree: **`Files=262, Tests=8876`, `Result: PASS`, exit 0**,
87 wallclock s. Matches the claimed baseline exactly.

### V4 — The 39 keystones meet all three criteria ✅

39 distinct doors, **42 arms** (`cancel_event`, `add_reserved_item`, `submit_ethics_appeal` each
carry two). Audited against the current tree, not the diff:

- **(a) code *and* message pinned in the door's own body — 42/42.** **Zero** arms pass a NULL
  message. This is a deliberate and load-bearing contrast with the pre-existing weak pins the
  commits explicitly refuse to count (`121:297`, `228:717/736`, `258:94`, `189:241`, `244:72`,
  `322:316`, `237:140/142/156/158`, `264:343–354` — all null-message).
- **(b) an allow leg with an effect assertion — 39/39.** No keystone landed deny-only; no keystone
  is `lives_ok`-only. Three are thin (see **m2**).
- **(c) property labels — 16 labels present.** But on **15** doors, not the 14 the record states.
  See **B1**.

### V5 — The five non-unique pins: the subject claim holds, measured on the live catalog ✅

This was the sharpest vacuity risk and it survives. Multiplicities re-measured against
`pg_proc.prosrc` (public + app, 706 `prosecdef` non-trigger functions — matching the record):

| pin | bodies I counted | record | closure overlap I measured |
| --- | ---: | ---: | --- |
| `HC048` · *você não pode editar…* | 3 | 3 | `add_rca_member` raises it **in its own body** and calls neither `app.assert_rca_writable` nor `complete_evidence_upload_verification` ✅ |
| `HC0J0` · *ação inválida para o status…* | 5 | 5 | `create_case_decision`'s own inline `HC0J0` message is **`'a decisão exige um caso admissível'`** — a *different* string, so the message pin genuinely discriminates the delegate ✅ |
| `HC039` · *sem permissão para editar…* | 5 | 5 | the five raisers do **not** cross-call ✅ |
| `42501` · *…pode ver este relatório* | 2 | 2 | the two rollups do **not** cross-call ✅ |
| `HC0B1` / `HC0B2` | 2 / 2 | 2 / 2 | no cross-calls ✅ |

The `HC0J0` case is the one that mattered — the record's own Phase B2b §1 identified that the pin at
`258:92` passes NULL and is silently absorbed by `create_case_decision`'s inline raise. The new
keystone at `258:199` pins the message, and my catalog read confirms the two strings differ. That
is a correct fix, correctly reasoned.

I also accept the record's structural argument that the sweep is the independent check: a keystone
commit can only add assertions that *pass* under mutation (allow legs, effect assertions, PRE arms)
plus one deny arm; mutation only *removes* raises, so a deny arm is the only assertion that can flip.
A door that was BLIND at shape N and COVERED at shape N+k after exactly one deny arm was added must
have flipped on that arm. The 39 BLIND→COVERED transitions carry that discrimination by construction.

### V6 — No assertion was weakened ✅ (with one caveat)

Forensic diff over `ca328539~1..HEAD` (14 commits) across `supabase/**`:

- **Zero** deleted lines contain a `throws_ok(...)`, a SQLSTATE argument, a `set local role`, a
  `has_function_privilege`, a `cmp_ok` or a `results_eq`.
- **Zero** `'CODE','message'` → `'CODE',NULL` narrowings.
- **Zero** `is`/`ok`/`isnt` expected VALUES changed. Every value-expression rewrite (8 sites) kept
  its expectation byte-identical; `315`, `362` and `305:7.21` are net **stronger** (a new
  `count(*)=1` cardinality pin alongside the aggregate).
- All **31** `plan(N)` changes are **increases**. No plan went down.
- Allowlist deletions: **exactly 10**, all in `2cefae8e`. Removing entries from a never-called
  exemption list tightens the harness.
- The harness change (`ca328539`) is a **tightening**: the old column-6 proxy let 5 unmutable
  functions past the UNMUTABLE guard while refusing 1 mutable one.

Caveat: the `406` preflight conversion is a real assertion-shape change. See **m1**.

### V7 — The 10 allowlist retirements are earned, and the zero-slack warning is accurate ✅

Queried `pg_stat_user_functions` directly. All 10 retired doors carry ≥ 1 recorded call.
**Exactly 8 sit at exactly 1 call** (`add_capa_action_evidence`, `cancel_event`, `cancel_session`,
`set_interview_interviewer_participant`, `set_interview_subject_participant`, `update_interview`,
`update_interview_subject`, `update_session`); `nsp_org_capa_rollup` = 2, `conclude_referral` = 4.
The record's warning is exactly right. `run_arm_floor` (`p0-authz-invariant.sh:370-416`) does
`pg_stat_reset()` then runs the full suite itself, so the *stale-DB* variant of the risk is handled
— but the *fragility* variant is not. See **M2**.

### V8 — Scope and hygiene ✅

- **No migration, no `src/` file** changed anywhere in the range. Only test files, the harness, the
  allowlist and docs. This is a stronger argument for the suite-shape assumption than the one on
  record: with no schema drift, no door body under the 106 un-re-swept rows can have changed.
- ADR **0187** header declares `**Amends:** ADR 0184` correctly and specifically (points 4, 5, and
  the Consequences remedy clause); `0184` carries the generated back-pointer. ADR-index hygiene ✅.
- ADR 0187's number derivation is documented and was checked against every ref, not against
  INDEX.md's next-free line — the correct method after the 0180/0183 collisions.
- Hub `## Current state` is 30 lines (cap 60); `docs/features/INDEX.md` row is in sync at `gated`;
  tree clean; `reviews:` frontmatter awaits this file.
- LEARN-081 / 082 / 083 are all present in `docs/learning/LESSONS.md`.

### V9 — The disclosure obligation is substantively met ✅

The record's disclosure block states Tier 2's sentence **verbatim**, and it does **not** repeat ADR
0184's three bullets: bullet 2 is explicitly re-diagnosed ("*ADR 0184's diagnosis of it was wrong*",
8 functions not "60 raises + 6", none excluded by the `:153` filter) and bullet 3's "~10" is
corrected to 22 → 0. A fourth population (trigger enforcers) is added. The hub carries the Tier 2
sentence verbatim in its Blockers. This is the requirement met properly, not restated. ✅

---

## Findings

### BLOCKING

#### B1 — The mandated disclosure misstates the class-B label count. 14 vs a measured 15.

`docs/progress/c2-tier1.md:1043-1046` (the ADR 0187 D1 disclosure block, required verbatim):

> The 39 keystoned doors split **A1 12 / A2 13 / B 14** by the caller-input rule; the **14 class-B
> doors' COVERED is state / lifecycle / validation coverage** and says so in its test-name string.

The tree carries **16 `[PROPERTY: … — NOT authorization]` labels on 15 distinct doors.** I counted
them twice by independent methods:

| door | label | arm |
| --- | --- | --- |
| `cancel_event` | state | `140_patient_safety.sql:422` |
| `conclude_referral` | validation | `150_referrals.sql:1668` |
| `update_interview` | validation | `121_interviews.sql:478` |
| `update_session` | lifecycle | `121_interviews.sql:517` |
| `cancel_session` | lifecycle | `121_interviews.sql:521` |
| `no_show_session` | lifecycle | `121_interviews.sql:525` |
| `update_interview_subject` | validation | `121_interviews.sql:544` |
| `cancel_interview` | lifecycle | `121_interviews.sql:560` |
| `reopen_interview` | lifecycle | `121_interviews.sql:564` |
| `submit_rca_for_review` | lifecycle | `142_rca.sql:411` |
| `reopen_rca` | lifecycle | `142_rca.sql:415` |
| `reopen_capa_plan` | lifecycle | `143_capa.sql:534` |
| `add_capa_action_evidence` | validation | `143_capa.sql:569` |
| `app.assert_ethics_typed` | validation | `258_ethics_e2_rpcs.sql:199` |
| `submit_ethics_appeal` | lifecycle **and** validation | `258:215` / `258:220` |

**15 doors. 12 + 13 + 15 = 40, not 39.** The unlabelled remainder is **24**, not the 25 that
`A1 12 + A2 13` implies. The record's own two figures are already mutually inconsistent: the hub says
both *"**16** D2 property labels"* (`docs/features/c2-tier1.md:31` and `:72`) and *"**14** class-B
keystones carry `[PROPERTY: …]`"* (`:53`). 16 labels on 14 doors is only possible if two doors carry
two arms each; only `submit_ethics_appeal` does.

**Diagnosis (mine).** `A1 12 / A2 13 / B 14` is ADR 0187 D-M2's split, computed *before* the PO's
2026-09-04 ruling that moved `add_capa_action_evidence`, `submit_ethics_appeal` (`HC0J0` #1) and
`app.assert_ethics_typed` into class B provisionally (`docs/progress/c2-tier1.md:513-521`). The tree
carries the post-ruling labels; the disclosure block quotes the pre-ruling split. This is the exact
defect class the unit exists to catch — a number that reads as care because it errs *tighter*, left
standing in the sentence that is the condition of the closure.

**Why blocking, given it is conservative in direction.** ADR 0187 D2 makes the label *"the condition
of the closure, not a nicety"*, and D1 makes the disclosure a conformance condition. A closure whose
mandated disclosure misstates the count of the thing that conditions it is not conformant, however
safe the error's direction. It is also cheap: correct `B 14` → `B 15` and `A1 12 / A2 13` to the
measured split, in the record, the hub `:53`, and anywhere the split is re-quoted; state that the
figure is post-PO-ruling and that ADR 0187 D-M2's 12/13/14 is the pre-ruling derivation.

#### B2 — A standing rule asserts a safety property this session's own incident falsified.

`.claude/rules/mutation-harnesses-are-not-killable.md`, path-scoped to
`supabase/tests/mutation/*.sh` — so it loads for the next agent who touches this harness — still
reads:

> ## Since 2026-08-29 a kill is CAUGHT, not prevented
> `INT`/`TERM`/`HUP` restore on exit; a **crash sentinel** survives what no trap can (SIGKILL,
> power cut, killed container), so the next run **REFUSES to start, exit 2** with the restore SQL.

**That is false for the C2 neutralizer, and this session proved it.** Per
`FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`: `restore_inflight()` (`:88-93`)
truncates its sentinel **unconditionally** without checking `psql_f`'s exit status, so a kill in the
process group erases the sentinel *and* skips the restore in the same breath; and the `DEGEN`
preflight (`:101-106`) matches only whole-body-replaced-by-a-constant, which a `raise → null;`
rewrite never produces. Both crash-safety mechanisms were blind, `public.cancel_event`'s `HC044`
custody gate stood open for ~4 minutes, and the only reason anyone knew was a hand-run comparison of
per-enforcer anchored-raise counts.

The follow-up records this correctly and even says *"the rule alone is not a mitigation"* — but **the
rule itself was not corrected**, and the follow-up's `## Closes when` (three good items, including
the crucial "proven able to fire") does **not** include correcting it. So the register holds the
truth while the artifact that actually gets loaded holds the falsified claim. That is
`only-the-amending-document-knows-about-the-amendment`, in the file class where being wrong opens a
door.

**Fix:** amend the rule to say the sentinel is *disarmed by a process-group kill for the C2 anchor
shape*, cite the follow-up, and add "correct `.claude/rules/mutation-harnesses-are-not-killable.md`"
as a fourth `Closes when` item so the rule and the code are repaired together.

### MAJOR

#### M1 — The findings file is not internally clean: 5 orphaned lines from superseded verdicts.

Lines **32, 35, 84, 87, 105** of `docs/reviews/c2-command-door-findings.md` each read:

```
CONTEXT:  PL/pgSQL function inline_code_block line 12 at RAISE |
```

They are the second line of five two-line `ERROR · MUTATION DID NOT LAND` notes written by the
original sweep (`33d54159`). The row-by-row merge at `f33d9ba7` matched on the enforcer signature at
line start, replaced the **first** line with the new `COVERED` row, and left the continuation. Each
orphan now sits directly beneath a `COVERED` row — `set_referral_patient`,
`set_professional_link_state`, `mint_printed_document`, `log_document_previa`,
`delete_ad_hoc_case_narrative`, i.e. five of the six anchor-fix enforcers — and reads as if attached
to it. Line 32 has no leading `|`, so **the rendered Markdown table breaks into six fragments.**

Two consequences, the second worse than the first:

1. The single artifact that carries the 170/1/0 tally contains residue of verdicts that no longer
   exist. ADR 0153 forbids hand-editing it, so the fix is a regeneration or a merge-tool fix, not an
   edit.
2. **The merge is line-oriented and cannot handle a multi-line note.** It will do this again on the
   next merge, on any row whose note spans a newline. That is a latent defect in the instrument that
   maintains the committed baseline, and nothing in the record notices it.

#### M2 — `ARM=floor`'s zero slack is stated but has no owner, no follow-up, and no mitigation.

Confirmed by my own `pg_stat_user_functions` read (V7): 8 of the 10 retired doors sit at exactly one
recorded call. `run_arm_floor` reds if any authenticated-reachable `prosecdef` `public` door has zero
calls and is not allowlisted. So **deleting or skipping a single `lives_ok` in `121`, `140`, `143`,
`189` or `228` reds a phase-gate arm**, and it reds with a message about an allowlist, at a site far
from the edit — a failure whose cause is invisible from its symptom.

This is a real operational risk and it is worth a stated mitigation. The hub names it in Blockers
(`docs/features/c2-tier1.md:88`) and then stops: no register entry, no owner, no closes-when. Per
`docs/INDEX.md`'s own table a known fragility introduced by this work belongs in
`docs/followups/follow-ups-open.md`. A hub Blockers line disappears when the hub goes `complete`.

Cheapest real mitigation: give each of the 8 a **second** allow leg (they already have a working one
— a second `lives_ok` on a different fixture is a few lines each), which converts a cliff into a
slope. Second-cheapest: a comment block in `authz-neverclled-door-allowlist.txt` naming the 8 and
what reds if their call disappears, plus a follow-up.

#### M3 — The suite-shape argument's load-bearing premise is stated in a form that is literally false.

`docs/progress/c2-tier1.md:1003-1005`:

> the keystone commits' only non-comment, non-`plan()` deletions are the 10 allowlist lines, and no
> `.sql` assertion was removed or weakened anywhere.

The forensic diff over the whole range finds **128 further non-comment, non-`plan()`, non-allowlist
deleted lines** under `supabase/**`. **Every one is benign** — ~105 bare fixture statements re-wrapped
verbatim inside `lives_ok`, 8 value-expression rewrites with byte-identical expectations, 3 CTAS
splits, 7 harness lines — and the *conclusion* survives intact, which I verified independently (V6).
But the sentence as written is the premise the whole no-false-COVERED argument rests on, and it is
the kind of compressed claim this project's own register keeps catching: the bound is cut to fit,
and what survives reads tighter than the fact. It is also scoped to "the keystone commits" when the
argument needs to cover B1's 25 statement edits and `f33d9ba7`'s four files too.

Restate it as measured: *4 comment lines, 31 `plan()` bumps (all upward), 10 allowlist entries,
7 harness-tightening lines, and 128 lines of existing test code re-wrapped or re-sourced with no
expectation changing — verified over `ca328539~1..HEAD`, not over the keystone commits alone.*

#### M4 — Three decisions were made that should have been ADRs, and one ADR's open ruling was discharged with no back-pointer.

Asked directly, my answer is yes — three:

1. ⭐ **The suite-shape compositing ruling.** The final `170/1/0` was **never produced by a single
   sweep**. It is composited across at least five suite shapes (`8685` → `8764` → `8788` → `8819` →
   `8866` → `8876`), with the 106 pre-existing `COVERED` rows last measured at `Files=259,
   Tests=8685`. The ruling that this is acceptable — and its stated condition, that no assertion was
   deleted and the untested direction is conservative — is a **methodological precedent that will
   govern every future sweep of this kind**, and it currently lives only in a progress record. That
   is squarely CLAUDE.md §8's "non-trivial decision". It deserves an ADR that states the condition
   precisely, including the part the record gets right and no ADR yet records: *shape is not monotone
   under adding tests, so the composite can only downgrade a real verdict to unmeasurable, never
   manufacture a false COVERED — provided no migration changed* (which I verified, V8).
2. **The `406:243` conversion**, which introduces the **first and only `skip()` in the entire pgTAP
   suite** (two call sites, both added here). A new test-shape convention with no precedent and no
   written rule for how a `# SKIP` is to be read by anything scoring the suite.
3. **The PO's provisional class-B reassignment** of three doors, which changes ADR 0187 D-M2's
   published split (and is the proximate cause of **B1**). A ruling that reassigns doors between
   classes belongs where D-M2 lives.

Separately: ADR 0187's *"Not measured"* section states *"whether the four absent `HCDS*` doors should
be Tier 1 … **is a ruling owed, not a measurement owed**."* The session discharged it **by
measurement** and concluded *"No gap, and no ruling owed"* (`docs/progress/c2-tier1.md:523-551`). I
checked that reasoning and it is correct — but ADR 0187 carries **no back-pointer**, so a reader of
0187 alone still believes a PO ruling is outstanding. Add an amendment note or a `**Related:**`
pointer to the discharging record entry.

#### M5 — Two register entries are stale in ways that will read as live.

- `FUP-C2-SUITE-ABORT-ERROR-CLASS` (`docs/followups/follow-ups-open.md:1303`) is still 🟠 open and
  still says *"16 enforcers"*; the population grew to **18** and the class is now **0**. Its body
  file also still carries `Files=259` and a localization table the record's Phase A corrections
  falsified (`resolve_referral`, `submit_response` "six files not four").
- `FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000` (`:1289`) is still 🟠 open with the falsified
  *"60 raises"* headline that ADR 0187 C3 retired and the record says "must not be re-quoted".

These are Record-step work rather than closure blockers, but they are named here because the closure
*claims* both are discharged, and the register — which is what the next session reads — says
otherwise, in the retired numbers.

### MINOR

- **m1 — `406`'s fail-open twin becomes unmeasured in the skip branch.** `406:254-261`'s `lives_ok`
  is self-described as *"the only assertion in the whole AE4.7c change set"* measuring the
  **fail-OPEN** direction. The conversion preserves a hard-failing `5.0 ok()` on the same condition
  (so the suite cannot go green on a missing bound), the `position(v_cut in v_src) = 0` predicate is
  byte-identical, and both `skip(…, 1)` calls count toward `plan(19)` — the lead's two conditions
  were met, by measurement. But someone reading only the 5.1 line sees a pass where nothing ran. A
  one-line comment at 5.1 would close that.
- **m2 — three thin allow legs, all in `264_correction_requests.sql`.** `review_correction`
  (`264:592`) and `resubmit_correction` (`264:615`) have **no assertion anywhere in the file that
  isolates their own write**; their nearest effect assertions (`264:235`, `264:286`) are the
  *approve* and *reject* steps' effects, reachable only because the earlier call succeeded.
  `start_correction_draft` (`264:611`) is materially stronger but still read after a four-door
  chain. These satisfy the letter of the allow-leg criterion via chain-effect and I am not blocking
  on them — but a chain-effect assertion cannot distinguish "the door wrote what it should" from
  "the door wrote something the next door tolerated", and `264` is where the correction-draft
  authority lane lives.
- **m3 — `assign_narrative` / `unassign_narrative` (`237:212`, `237:216`)** pin `42501` ·
  *sem permissão*, a pair shared by **94** `public`/`app` bodies (the record's figure; I did not
  re-derive this one). Their subject comes from the PRE arm at `237:206` plus the sweep, not the
  pin. The commit's own comment concedes this. Correct as written, and correctly flagged — recorded
  here so the next reader does not mistake the pin for the discriminator.
- **m4 — `set_professional_link_state`'s COVERED may be attributable to `406:5.0`**, which fires on
  *any* body-text change that removes the bound verbatim — a change detector, not a guard assertion.
  Phase A localizes its clean-fail file as `229`, which would make this moot, but the harness records
  a suite-level flip and not which assertion flipped, so I could not confirm the attribution.

---

## Unverified claims

Per the standing instruction, these are work items, not footnotes.

| # | Claim | Why unverified | What would settle it |
| --- | --- | --- | --- |
| **U1** | ⭐ **`ERROR = 0` holds on the final tree — there is no fifth abort site.** | This is the question I was asked to press hardest and it **cannot be settled without a sweep**, which I am forbidden to run (and rightly — a killed sweep stranded a live gate today). The mechanism is *known to be incomplete-by-construction*: Phase B1's own correction 6 states that wrapping the first of a run of statements moves the abort down, and Phase C then hit exactly that at a second site in four rows, with two of four diagnoses wrong on contact and a third site appearing in `274`. `f33d9ba7` then **added assertions to `203`, `274`, `305`, `312`** — files whose new arms were never present when batch A (shape 8819), batch B (8866) and most of B1's rows were measured. | A full 171-enforcer sweep at the final tree (~8 h at the measured 87 s/run). At minimum, a subset re-sweep of every enforcer the diagnosis localizes to `203` / `274` / `305` / `312` — from the diagnosis's own site list that includes `save_section_answers`' hosts (`203:225`, `274:1101`, `274:1190`), `submit_minutes_job` + `cancel_minutes_job` (`305:358`), `305:638` and `312:885`. |
| **U2** | The anchor fix is `813/813` in Postgres ARE, 0 overmatch, 0 regression; blast radius 21/1081 differing, 6 in the 171. | Not re-derived. I verified the *population* figure it rests on (706 `prosecdef` non-trigger functions in `public`+`app`, matching the record) and that the harness change is a tightening, but not the match counts. | Re-run the two `regexp_replace` corpora against `pg_proc.prosrc`; ~10 minutes, read-only. |
| **U3** | All four authz arms HOLD (`census`, `floor`, `hat`, `FROMFINDINGS=1 wrapper`), exit 0. | Not re-run. `ARM=floor` calls `pg_stat_reset()` and a full suite; the local stack is shared with live agents this session and I would not perturb it. I **did** verify the arm's underlying data independently (V7), which is the part the closure actually changed. | The lead re-runs the four arms at the Record step, on a fresh reset, naming each arm's **domain** (ADR 0079). |
| **U4** | Each of the 39 `COVERED` verdicts is attributable to *its* keystone. | The harness scores a **suite-level** flip and does not record which assertion changed state. The BLIND→COVERED transition plus the "only a deny arm can flip under mutation" argument makes this sound by construction (V5), but there is no direct evidence per door. | Have the harness capture the failing test names on the mutated run and write them into the note. This would also retire m4 and is the single highest-value instrument improvement available. |
| **U5** | The `42501` · *sem permissão* multiplicity of 94. | Taken from the record; not re-derived. | One catalog query. |

---

## Recommendations

**To clear this review (all cheap, none needs a sweep):**

1. **B1** — correct the class-B count to the measured **15 doors / 16 labels** in the disclosure
   block, the hub `:53`, and every re-quotation of the `A1 / A2 / B` split; note that 12/13/14 is
   ADR 0187 D-M2's *pre-PO-ruling* derivation.
2. **B2** — correct `.claude/rules/mutation-harnesses-are-not-killable.md`'s "a kill is CAUGHT"
   section and add its repair as a fourth `Closes when` item on
   `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`.
3. **M1** — remove the 5 orphaned `CONTEXT:` lines **by regenerating or by fixing the merge tool**,
   never by hand (ADR 0153), and record that the merge is line-oriented and cannot carry a
   multi-line note.
4. **M2** — file the `ARM=floor` zero-slack follow-up with an owner and a closes-when; prefer a
   second allow leg on each of the 8 over a documentation-only mitigation.
5. **M3** — restate the deletion premise as measured over `ca328539~1..HEAD`.
6. **M4** — write the suite-shape ADR; add 0187's missing back-pointer; decide whether the `406`
   `skip()` and the provisional class-B reassignment want their own ADR or a paragraph in the
   suite-shape one.
7. **M5** — bring the two stale register entries into line at the Record step.

**Not required to clear, but I would want these before the next sweep:**

8. **U4's instrument change** — capture the failing test names on the mutated run. It converts every
   future `COVERED` from "something noticed" into "*this* assertion noticed", which is the
   discrimination this whole unit has been buying by hand.
9. **U1's residual sweep**, scoped to the four `f33d9ba7` files, before anyone treats `ERROR = 0` as
   a property of the tree rather than of a composite.

**On the four remaining open follow-ups (question 7): correctly scoped. ✅** I checked each against
what this closure actually measured. `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` is
structural — a trigger has no call edge, so it can never enter the worklist, and
`app.guard_interview_status` is in 0 of the 171 while being the enforcer that actually refuses
`reopen_interview`; nothing here touches it. `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`
is a live harness defect (see **B2**). `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` names
296 latent sites across 60 of 262 files and is the mechanism behind **U1** — closing it is what would
make `ERROR = 0` structural rather than incidental. `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`
is untouched and its three rows now carry full-scale verdicts, which the record states plainly. None
is discharged by this closure, and the hub says so.

**On the incident record (asked directly): adequately recorded, insufficiently closed.** The
follow-up is excellent — it names both mechanisms, quotes the code verbatim, gives the file-timestamp
evidence, scopes the exposure honestly to the local stack, and its third `Closes when` item ("*prove
both arms can fire; a detector that has never been shown to fire is exactly what this register keeps
finding*") is the item most such entries omit. Its gap is **B2**: it does not close the loop on the
standing rule that still tells the next operator the kill is caught. Add that and the closes-when is
sufficient.

---

## Closing

The measurement behind this closure is the strongest I have reviewed in this project. It found and
corrected its own instrument twice, refused three tempting shortcuts (the `apenas` word list, the
migration-text validation, the "pin any anchored raise" shortcut at `approve_correction`), and
disclosed the cost of what it did not re-sweep instead of burying it. My independent re-derivations
of the tally, the label set, the five non-unique pins' call closures, the allowlist retirements and
the suite baseline all agree with the record.

I am requesting changes on the record layer, not the measurement layer — because in this unit the
record *is* a condition of the closure, and two of the three ADR 0187 D1 conditions are stated in
sentences that are currently wrong or falsified. Fix **B1** and **B2**, regenerate **M1**, file
**M2**, and this is an APPROVED closure.
