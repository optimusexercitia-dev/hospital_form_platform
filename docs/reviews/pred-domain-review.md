# PRED-DOMAIN — QA review (Batch 2 of the pre-AE5 remediation)

# ❌ VERDICT: CHANGES REQUESTED

**Reviewer:** `qa` · **Date:** 2026-09-07 · **Subject:** unit `PRED-DOMAIN`, branch
`authz-pred-domain`, tree at **`6f94a634`** (13 commits `388d24f6..6f94a634` on top of `main`
= `244974a1`). ⚠ The repository HEAD moved to **`376d5717`** during this review (the lead's
`docs(lead-playbook): section 4 …` commit, `docs/lead-playbook.md` only, +18 lines). Everything
below is measured at `6f94a634` unless a finding says otherwise; where `376d5717` changes the
answer it is named explicitly.

---

## 0. Headline

This is the strongest engineering record I have reviewed on this program. The selection proof, the
tail-drift diagnosis, the retrofit's control design, the CARRIED disposition-by-script, and the
step-11 self-disclosures are all better than the bar Batches 0 and 1 set. **Nine of the eleven
review questions come back clean under independent measurement.**

It is `CHANGES REQUESTED` for three reasons, all of which are the unit's own failure mode turned on
itself, and all of which are text corrections rather than redesign:

1. A **quantified disclosure in the gate record is false in the reassuring direction** — "0 of the
   24 offenders is false" — and I measured **12 of 24**. It is the sentence that decides how urgent
   the filed follow-up is, it sits in the hub's `## Blockers`, and the PO would approve on it.
2. The three set-valued resolvers' **first verdicts were never filed anywhere the census can read**,
   contrary to the approved plan §3, and the file that keeps `ARM=census` green for one of them
   still asserts, in the present tense, that **no arm can produce a verdict** for it.
3. The `DOMAIN-STATEMENT`'s only **"Measured witness:"** is false — `public.reopen_interview` has
   been **COVERED** since 2026-09-04, one day before ADR 0191's date — and that block is printed on
   every run and, by ADR 0187 D1, quoted into every gate record that cites this sweep.

None touches an RLS boundary, a migration, or `src/`. The scope checks are clean; nothing
production-facing changed.

---

## 1. Method — what I measured, and how

Read-only throughout. I wrote exactly one file: this report.

| what | how |
| --- | --- |
| `PRED_DOMAIN` selection | both predicates re-typed into ONE temporary view on the live catalog (`supabase_db_azkbbhskturikxpgmafq`, discriminated by `authz` schema present, 10 `authz` functions), old/new membership computed per row |
| the lift | `lift_block` extracted verbatim from `scripts/door-sweep-cases.sh:226-241`, applied to the current `p0-authz-door-audit.sh`, three substitutions applied, residual-`$` case tested |
| both SELFTESTs | run, bare exit codes |
| `npm run lint` | run, bare exit code, ratchets read from the output |
| the diff-scoped deriver | run, bare exit code, `SCOPE:` line quoted |
| `ARM=policy`'s offender sets | `blind_from_findings` and `allow_body` **re-implemented from `p0-authz-invariant.sh:130-136` and `:325-326,:344`** and run over `git show main:` and the working tree — I did not run the arm |
| the findings file | parsed with python (pipe-split on column index, never regex over the row), main vs HEAD |
| the registers | two independent read-only sweeps (`difflib` over rotated text; `--numstat` over `docs/followups/`) |
| derived counts (174 / 268 / 5 / 35 / 226) | re-derived on the live catalog with the harness's own queries |
| ADR 0191 | audited decision by decision against the code, the record and the artefacts it cites; every line-number citation into a script re-anchored |
| the reset port | the two `resets_enabled()` bodies and the `RESET_EVERY_EXPLICIT` capture `diff`ed byte-for-byte against `c2-command-door-neutralizer.sh` |

Bare exit codes I observed myself, at `6f94a634`, working tree clean:

```
SELFTEST=1 bash scripts/door-sweep-cases.sh                 -> 0    SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0
SELFTEST=1 bash supabase/tests/mutation/p0-authz-door-audit.sh -> 0 classify 6/6 · resets_enabled 6/6 · emit_result 8/8 · TOTAL 20/20
npm run lint                                                -> 0    eslint 0/0; check-docs-registers: OK; build-features-index: OK
bash scripts/door-sweep-cases.sh main                       -> 3    SCOPE: 0 file(s) … derivation: NOT REACHED
git diff --name-only main...6f94a634 -- supabase/migrations supabase/seed.sql src   -> EMPTY
git diff --name-only main...6f94a634 -- .claude docs/lead-playbook.md CLAUDE.md     -> EMPTY
```

---

## 2. Blocking findings

### ⛔ F-BLOCK-1 — "0 of the 24 offenders is false" is FALSE: **12 of the 24 are false**, and all 12 are rows the follow-up's own sentence predicts

**Where the claim lives** (three places, one wording):

`docs/progress/pred-domain.md:2364`
> ⚠ Today it costs **nothing**: all 38 phantoms are already on the blind allowlist, so **0 of the 24
> offenders is false** (measured, `comm -12`).

`docs/followups/follow-ups-open.md:1707` (`FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`, `**Status:**`)
> ⛔ Today it produces **0** false offenders (all 38 are already on the blind allowlist), which is
> luck, not design: a row that was BLIND-and-unallowlisted and has since been keystoned would go on
> being named as new door-blindness for ever.

`docs/features/pred-domain.md:109-110` (hub `## Blockers`)
> filed as `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`, 0 false offenders today.

**MEASURED, by re-implementing the arm's own two functions rather than re-running it.** `offenders
= comm -23 <blind_from_findings union> <allow_body authz-blind-allowlist.txt>`
(`p0-authz-invariant.sh:344`, selector unchanged by this unit — `git diff main...6f94a634` touches
`p0-authz-invariant.sh` in one hunk only, the `DEGENERATE_PREDICATE` marker):

```
main       : BLIND union 72   allowlist 59   offenders 16   door-section rows 68
6f94a634   : BLIND union 78   allowlist 59   offenders 24   door-section rows 74
offenders NEW ∖ OLD (11) = exactly the 5 capa_*_write + 6 rca_*_write (ALL) flips
offenders OLD ∖ NEW  (3) = app.can_read_document_object, attachment_references_select,
                           attachment_subjects_select
```

⭐ **That half of the disclosure is exactly right** — I reproduce the record's 16 → 24, +11, −3
independently. The false half is the composition:

```
of the 24 offenders at 6f94a634:
   12 carry `BLIND`   in column 4 of docs/reviews/authz-door-audit-findings.md
   12 carry `COVERED` in column 4 of the SAME file, and are named anyway
```

The twelve, each **BLIND at `main` → COVERED at `6f94a634`**, each **absent from
`supabase/tests/mutation/authz-blind-allowlist.txt`** (`grep` rc 1 on samples):

```
accreditation_standards.accreditation_standards_select (SELECT)
answer_selected_options.answer_selected_options_select_targeted (SELECT)
answer_selected_options.answer_selected_options_write_targeted (ALL)
case_assignment_roles.case_assignment_roles_select (SELECT)
case_narrative_revisions.case_narrative_revisions_select (SELECT)
ethics_sanction_types.ethics_sanction_types_select (SELECT)
form_item_options.form_item_options_select_targeted (SELECT)
referral_assignments.referral_assignments_select_metadata (SELECT)
referral_case_links.referral_case_links_select_metadata (SELECT)
referral_internal_notes.referral_internal_notes_select (SELECT)
referral_read_receipts.referral_read_receipts_select_metadata (SELECT)
referral_resolutions.referral_resolutions_select_metadata (SELECT)
```

Witness pair, verbatim:

```
main :123  | accreditation_standards.accreditation_standards_select (SELECT) | policy | open->true | BLIND |  |
HEAD :200  | accreditation_standards.accreditation_standards_select (SELECT) | policy | open->true | COVERED | 298_authz_p0_isolation.sql |
grep 'accreditation_standards' supabase/tests/mutation/authz-blind-allowlist.txt   -> rc 1 (absent)
```

**Why the record's own arithmetic did not catch it.** The "38 phantoms" set and the "24 offenders"
set are different populations: the phantoms include 26 rows that ARE allowlisted and 12 that are
not. `comm -12` over those two files suppresses only column 1, so it prints the union of "common"
and "only in file 2" — a large list that reads as "all accounted for". The right test is
`offenders ∩ phantoms`, which is 12. This is the register's own documented failure mode
(`LEARN-049`: *the error always reads as care*) landing inside the disclosure that describes it.

**Why it blocks.** The sentence is not decorative: it is the reason the follow-up is filed 🟡
"medium — it over-reports … but" rather than as a live defect, and it is the reason the hub says the
disclosure is non-blocking. `ARM=policy` at `6f94a634` names twelve gates as un-keystoned door
blindness that this unit's own run measured COVERED. That is a *stale-finding generator already
generating*, not a latent one. ⛔ **Correcting the sentence is the fix; do NOT "repair" it by
allowlisting the twelve** — the follow-up's own ⛔ bar forbids re-sorting the file, and an
allowlist entry here would be the relabelling PO ruling Q1 prohibits.

**What CHANGES look like** (all text, no code):
1. `docs/progress/pred-domain.md:2364` — replace the claim with the measurement: 24 offenders =
   12 genuine (11 mirror flips + 1) + **12 false**, enumerated.
2. `docs/followups/follow-ups-open.md:1707` — same correction **beside** the original, not over it
   (this unit's own convention), and re-rate severity: the predicted failure has occurred.
3. `docs/features/pred-domain.md:110` — the hub's `## Blockers` line.

---

### ⛔ F-BLOCK-2 — the three set-valued resolvers' FIRST verdicts exist nowhere a census can read, and the file that keeps `ARM=census` green still says no arm can produce one

**Two measurements.**

(a) The three functions appear **zero times** in every findings file the census reads
(`verdicts_from_findings`/`verdicts_from_rowfindings` over `$DOOR_FINDINGS`, `$WP_FINDINGS`,
`$ROW_FINDINGS`, `$INV_FINDINGS` — `p0-authz-invariant.sh:542-546`):

```
grep -c 'authorized_scope_ids(\|candidate_authorized_scope_ids(\|current_professional_read_organizations('
  docs/reviews/authz-door-audit-findings.md        -> 0
  docs/reviews/authz-writepath-audit-findings.md   -> 0
  docs/reviews/authz-rowdoor-audit-findings.md     -> 0
  docs/reviews/authz-invoker-audit-findings.md     -> 0
  docs/reviews/c2-command-door-findings.md         -> 0
```

The appendix at `docs/reviews/authz-door-audit-findings.md:951-963` re-files a **different** three
gates (`app.storage_upload_reserved`, `public.commission_cadence_overview`,
`public.document_delete_affordances`). The two rows that DO appear are the boolean newcomers
(`:443` `authz.candidate_has_permission` COVERED, `:487` `authz.scope_reaches` COVERED) — those are
correct and are the schema axis's own product.

(b) `supabase/tests/mutation/authz-unswept-backlog.txt` — untouched by this unit for this family
(`git diff main...6f94a634` on that file has exactly two hunks, `@@ -793` and `@@ -838`, both the
BOOLEAN pair) — still reads, present tense, at `:940-947`:

> `# WHY NO ARM CAN PRODUCE A VERDICT — MEASURED, NOT ASSUMED (2026-09-03):`
> `#   * scripts/door-sweep-cases.sh put it on the ⛔ EXCLUDED-BY-NAME review list.`
> `#   * ARM 1 with the census's own exact key … "=== RESULT: UNPROVEN — NOTHING WAS MEASURED …"`

That sentence is false as of 2026-09-05: this unit shipped
`supabase/tests/mutation/authz-setvalued-targeted-cases.sh`, an arm that produced **COVERED** for
`app.current_professional_read_organizations()` at `Files=262, Tests=8876, PASS`
(`docs/progress/pred-domain.md:475-481`).

**Why this is not merely bookkeeping.** `app.current_professional_read_organizations()` is inside
`ARM=census`'s live domain (`census_proc_domain`, `p0-authz-invariant.sh:479-481`: `p.proretset AND
has_function_privilege('authenticated', …)`; the backlog block itself states this at `:986-995`).
It carries no verdict, so the ONLY thing keeping census green for it is `allow_body "$UNSWEPT"`
consuming a backlog entry whose body now asserts something untrue. The approved plan foresaw exactly
this and ruled against it (plan §3):

> Verdicts live as ROWS in `docs/reviews/authz-door-audit-findings.md` … **NOT a fifth file**
> (`verdicts_from_findings` reads only the four named files; a fifth would leave the resolvers
> UNKNOWN in census).

The delivered state is worse than the rejected option: **no file at all**. The record acknowledged
the step and then dropped it — `docs/progress/pred-domain.md:484-486`:

> ⛔ They are **printed, not written**: the findings file is re-earned only through the door arm's
> merge, and filing them is a human step after the CARRIED ruling.

The CARRIED ruling was applied in `b59d4bbf`; three *other* gates were re-filed; these three were
not, and **no document anywhere records that they are still owed**. The closure note
(`docs/followups/follow-ups-archive.md:9819-9824`) says "All three resolvers earned their FIRST
recorded verdicts there", which is true of the harness and not of any census-readable artefact.
`FUP-AUTHZ-UNSWEPT-BACKLOG-STALE-ENTRY-HAS-NO-ARM` does not reach this case either: its proposed
arm reds on `backlog ∩ verdicted ≠ ∅`, and this gate is in neither intersection precisely because
its verdict was never filed.

**What CHANGES look like:**
1. File the three verdicts as rows using the **same census-readable shape** the appendix already
   proved against the merge's classifier (`… | verdict (earned elsewhere) | evidence …`, column 4
   `COVERED (targeted mutation)`) — `docs/reviews/authz-door-audit-findings.md:951-963` is the
   template and its shape argument at `:955-962` applies verbatim.
2. Rewrite the `app.current_professional_read_organizations()` backlog block into the past tense the
   way the two boolean blocks were rewritten (`authz-unswept-backlog.txt:793-812`, `:838-874` are
   the model), recording the 2026-09-05 verdict and its suite shape; ⚠ do **not** delete the entry
   until the row exists, for the reason the boolean blocks state.
3. If the PO instead rules that the three stay outside the findings file, then the record must say
   so and `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` (or a sibling) must carry the residual
   — a residual living only in a progress record is the shape this unit refused for clause 4.

---

### ⛔ F-BLOCK-3 — the `DOMAIN-STATEMENT`'s only **"Measured witness:"** is false, and it ships in the block every gate record must quote

`supabase/tests/mutation/p0-authz-door-audit.sh:979-983`, reproduced verbatim into the committed
report at `docs/reviews/authz-door-audit-findings.md:55-58`:

```
   BLIND: the first is discharged only by a keystone on a fixture the TRIGGER does not
   already refuse; the second by a keystone on the door. Measured witness:
   `public.reopen_interview` BLIND while `121_interviews.sql` pins its `HC038` — the
   `HC038` observed comes from `app.guard_interview_status`, a trigger on `case_interviews`.
```

**MEASURED contradiction**, in a file this unit did not touch (`git diff main...6f94a634 --
docs/reviews/c2-command-door-findings.md` is empty), i.e. it was already true when the sentence was
written:

```
docs/reviews/c2-command-door-findings.md:61
| `public.reopen_interview(p_interview_id uuid)` | 1 | 1 | **COVERED** | a keystone asserts through this guard (red under mutation, green restored) |
```

The keystone that flipped it landed on **2026-09-04** (`f33d9ba7`, "test(authz): close the last 4 C2
abort sites — findings reach 170 COVERED / 1 BLIND / 0 ERROR"), and `main`'s tip commit
(`7c85e713`) records the PO approving C2's closure at 170/1/0. ADR 0191 is dated **2026-09-05** and
repeats the same sentence at `:63-67`. `supabase/tests/121_interviews.sql:410-416` now carries the
mechanism as *resolved history*, with the message-pinning arm at `:519`.

**Why it blocks, and not merely annoys.**

- The `DOMAIN-STATEMENT` exists to be **quoted verbatim into every gate record** (ADR 0187 D1). A
  false "Measured witness:" therefore propagates into every future §6 step-1 record, not just this
  one — and it says a door is **BLIND** that is **COVERED**. That is `absence of a verdict is not
  absence of coverage` running in the damaging direction, inside the block written to prevent it.
- It is population 4's **only** empirical support, and population 4 is the population
  `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` was closed on. My ruling in Q8 that the
  closure stands leans partly on that witness; with the witness false, the closure rests on the
  bound being *stated* and nothing else. It still closes — but the record must not claim a
  measurement it no longer has.
- ⚠ `public.reopen_interview` is a **C2 command door**, not a predicate-arm subject: it carries no
  row of any kind in `docs/reviews/authz-door-audit-findings.md`. So the door arm never measured it,
  and "Measured witness" was borrowed from another arm's earlier state without a date.

**What CHANGES look like:** replace the witness with one that is live and dated, or state the
population's bound without an empirical witness and say so. ⛔ Do not simply delete the sentence and
leave population 4 unillustrated without saying that is what happened — the closure cites it.

---

## 3. Major findings (non-blocking, all should land with the blocking fixes)

### F-MAJOR-0 — the classifier's own header still asserts the exact sentence D5 Amendment 1 superseded

`supabase/tests/mutation/p0-authz-door-audit.sh:418-421`:

```
  # ⛔ `NOTICED` NEVER COLLAPSES INTO COVERED and is never a pass:
  #   · it has its OWN count on the report line and its own column in the tables;
  #   · it is in the DIRTY test, so a NOTICED case exits 1 exactly like a BLIND;
```

`:421` is directly contradicted by `emit_result()` at `:497-505` in the **same file** (`return 0`
under `CLEAN WITH DISCLOSURE`), and it is word-for-word the sentence ADR 0191 D5 Amendment 1 quotes
as superseded (`docs/decisions/0191-…:220-221`).

The sting is that the amendment's own argument is *"The ruling changes an **exit code**, so it is
encoded where the RESULT line is computed **and not only in the prose that describes it**"* — and the
prose that describes it was left saying the opposite, eight lines above the classifier a reader
reaches first. This is `LEARN-075` inside the change that cites `LEARN-075`. One-line fix; MAJOR
rather than blocking only because the *behaviour* is right and tested 8/8.

### F-MAJOR-1 — the `DOMAIN-STATEMENT` paraphrases the sentence ADR 0187 D1 requires **verbatim**, while asserting it is in those words

`supabase/tests/mutation/p0-authz-door-audit.sh:965-966` prints:

```
1. **Tier 2 — 190 doors, deferred by ADR 0171, not cleared.** (ADR 0187 D1: every gate
   record citing this sweep must say so in those words.)
```

ADR 0187 D1 (`docs/decisions/0187-…:70` and its Consequences at `:233-234`) requires:

> Tier 2's **190 doors stay deferred by ADR 0171 and are NOT cleared** … Every gate record citing
> this sweep carries the Tier-2 sentence verbatim

The delivered text is a reordering. It is not wrong in substance, and the parenthetical claiming
compliance is what makes it a finding: a block designed to be quoted verbatim into every gate record
asserts it satisfies an obligation it does not. One-line fix in the emitter, then the header of the
findings file regenerates on the next run — until then the committed file at
`docs/reviews/authz-door-audit-findings.md:40-41` carries the paraphrase too.

*(Reviewer note, unranked: `docs/decisions/0191-…:127` heads D3 "…with a committed, **scheduled**
home", and the same word appears in the `DOMAIN-STATEMENT` set-valued bullet, while the unit's own
`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` exists because it was not scheduled. That word
became TRUE at `376d5717`, so I do not rank it — but it was false in a printed block at the reviewed
commit, and the disclosure discipline that made the follow-up necessary should have reached it.)*

### F-MAJOR-2 — the hand disposition produced one corrupted note, and its own verifier could not see it

`docs/reviews/authz-door-audit-findings.md:392`:

```
| commissions.commissions_select_member_or_admin (SELECT) | policy | open->true | COVERED | 171_cross_org_isolation.sql,…,310_quality_board_door.sql,40_rls.sqlERROR at whole-policy neutralization (run-shape); covered ARM-SCOPED by q1 open_commissions_reviewer_arm → 310 §3.1/§3.6 RED-PROVEN (see the QO·A note above) |
```

The re-attached hand suffix was concatenated onto the run-2 file list with **no separator**,
manufacturing the token `40_rls.sqlERROR`. MEASURED: it is the **only** such row in the file (regex
`\.sql(?=[A-Za-z⭐⚠⛔])` over every column-5, 1 hit). It is precisely the row the record flagged as
the one boundary that could not be derived (`docs/progress/pred-domain.md:2020-2025`: *"whose column
5 is hand prose end to end (prefix length 0)"*).

`verify.py`'s assertion was "each suffix present byte-for-byte" — true here — so the verifier is
blind to a malformed **join**. Any consumer that splits the note on `,` now reads a filename that
does not exist; I hit it myself while measuring the NOTICED attribution.

### F-MAJOR-3 — RULING on the `commissions.commissions_select_member_or_admin` re-attach: **keep it, but date it and repair it**

The builder asked for a ruling (`docs/progress/pred-domain.md:2044-2054`). My ruling:

- **The re-attach is correct.** Rule R was applied consistently, and the distinction drawn against
  row #215 holds: #215's note names *"ERROR under the harness's force-to-TRUE neutralization"* —
  the mutation still in force — while this note names the **whole-policy** mutation (`using` **and**
  `with check`), which the mirror fix retired on 2026-09-05. The note's live half (the ARM-SCOPED
  coverage by `q1 open_commissions_reviewer_arm` → 310 §3.1/§3.6) is real evidence and archiving it
  would lose it. MEASURED corroboration: at `main` this key carried **two** rows with conflicting
  verdicts (`main:340` COVERED, `main:496` ERROR); HEAD collapses them into one, which is a genuine
  improvement.
- **But it must not ship as it stands.** A `COVERED` row whose note now *opens* with the word
  `ERROR`, run together with a filename, is the "a comment is an assertion that goes stale silently"
  shape sitting inside the arm's own baseline. Fix the separator (F-MAJOR-2) **and** prefix the
  historical clause with its era, e.g. `[pre-2026-09-05, whole-policy neutralization]`, so the
  clause is legible as history rather than as a contradiction of column 4.

### F-MAJOR-4 — the write arm's description of the read arm is now false, and the unit changed the read arm

`supabase/tests/mutation/p0-authz-writepath-audit.sh` is unmodified by this unit (absent from the
diffstat). Two sentences it carries are now wrong:

`:82-85`
> ⭐ **WHY `ALL` OPENS THE WITH-CHECK HALF ALONE** … `p0-authz-door-audit.sh` already sweeps it: its
> policy arm's domain is `pol.polcmd in ('r','*')` and it opens `using (true)` **(plus `with check
> (true)` when one exists)**.

`:88-91`
> It is opened by the read arm, whose COVERED for an `ALL` policy is **correspondingly ambiguous in
> the other direction**.

Both describe the pre-fix door arm. The second is the exact ambiguity
`FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` closed. The plan cited these very lines as
the authority for the split (`plan §2C(a)`, "the write arm already owns the other half and says
so"), so leaving them is the "only the amending document knows about the amendment" shape one file
over. Two-line correction.

### F-MAJOR-5 — "For all **23/23** the `reddened:` set is a STRICT SUPERSET of the aborting set" is **21/23**

`docs/progress/pred-domain.md:1466-1467`. MEASURED by parsing every NOTICED row's column 5 (split on
`|` by index, then `aborting file(s): … ; reddened: …`):

```
21/23 strict superset.  Two are not:
  app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)
      5 of its 7 aborting files are ABSENT from `reddened:`
      (227_action_item_satellites, 265_reopen_void_narrative, 267_ethics_e3a_autoderive,
       272_ff2_door_parity, 347_correction_conclusion_gate)
  cases.cases_staff_admin_write (ALL)
      its ONLY aborting file, 205_administrativo.sql, is ABSENT from `reddened:`
```

The claim the ruling actually needs — *a NOTICED row's suite DID redden* — survives: `reddened:` is
non-empty for **23/23** (measured). But "strict superset" is the stronger statement and it is not
true; and the second case is the interesting one, because the aborting file itself did not redden.
Correct the figure and keep the two named, the way the four weak rows are named two paragraphs
later.

### F-MAJOR-6 — the unit produced at least two generalizable lessons and registered none

`docs/learning/LESSONS.md` is untouched by this branch (absent from the diffstat; 85 rows before and
after, `lessonsProseOnly=52/52` unchanged). Two lessons are stated in the record in lesson form:

- `docs/progress/pred-domain.md:664-665` — *"⭐ The lesson is the harness's own, arrived at from the
  other side: **never hand-derive the path of a restore file — list it, or refuse to mutate.**"*
- `docs/followups/follow-ups-archive.md:8821` — *"a fix correct at most of its sites reads as a
  complete one"*, offered in the amendment's own italics as the generalization of the mis-scoped
  Batch 0 closure.

CLAUDE.md §7 and `docs/INDEX.md` route a lesson to `docs/learning/LESSONS.md`; the register's own
preamble says a lesson written anywhere else is not available to the next session. Both have an
enforcer available (the first: `supabase/tests/mutation/authz-setvalued-targeted-cases.sh` /
`c2-command-door-neutralizer.sh`; the second: `prose only`).

### F-MAJOR-7 — the `DOMAIN-STATEMENT` labels itself "derived from the live catalog … never literal"; four of its five populations are literals

`p0-authz-door-audit.sh:963` (and, verbatim, `docs/reviews/authz-door-audit-findings.md:38`):

```
(§7.17c — derived from the live catalog on every run; quote this block, not the script.)
```

ADR 0191 `:266-268` generalises it further: *"It states, **derived from the live catalog each run,
never literal**"*. MEASURED — only **population 4's two counts** (`$TRIG_SECDEF`, `$TRIG_WIRED`,
derived at `:953-956`) and `$PRED_OUT` / `$SETVALUED_N` are catalog-derived. Populations 1, 2, 3 and
5 are hard-coded `echo` literals at `:965`, `:967`, `:971` and `:984-991` — including 190, 60, 6,
~10 and 39.

The script's own comment scopes the guarantee correctly (`:949`: *"⚠ DERIVED EVERY RUN, NEVER
LITERAL. **The counts below**…"*, sitting immediately above the trigger block alone); the block
header and the ADR widen it to the whole statement. Literal is a defensible choice for figures that
come from ADR 0171/0184 decisions — the defect is the label. ⚠ Note the sibling arm's warning on
exactly this shape, `p0-authz-invariant.sh:513-518`: *"a number a banner states about a population
NOTHING re-derives is a claim with no owner, and this arm exists to stop exactly that shape."*

### F-MAJOR-8 — ADR 0191 D8's run-1 narrative carries three figures the record contradicts, and one bound run 2 has since settled

All MEASURED against `docs/progress/pred-domain.md`, which is the authority for run 1:

| ADR 0191 | says | the record says |
| --- | --- | --- |
| `:357-358` | "held the captured baseline shape `Files=262, Tests=8876` for **274** cases" | `:1416` — **104 of 353** run-1 rows carried an off-baseline shape; `:1086` — row 274 itself was at `Tests=8723`. The ADR contradicts itself 20 lines later at `:380` ("Drift reached at least as far back as case 274") |
| `:359-361` | "…the **identical** nine aborting referral files on every one of the **79** remaining cases" | `:1077` — **78** rows carried `Tests=8470`; `:1428` — the 79th (`process_template_versions_select`) was run 1's ERROR at `Files=0 Tests=0` |
| `:380-382` | "of the **23** `NOTICED` rows outside the tail … the other **22** are unclassified" | `:1078` — **24** outside the tail; `:1063` — 1 genuine + **1 proven drift (row 274)** + 22 unclassified. ⚠ 23 is run **2**'s NOTICED count, which appears three lines earlier in the same ADR |
| `:426-428` | the read-half work-list is "bounded below by 5 and above by 21 **until run 2 measures them**" | run 2 measured them: **11** (`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS.md:80`, `pred-domain.md:1482`). The ADR carries two 2026-09-07 amendments but never updates this bound |

None of these changes a verdict — run 1 is void and the work-list is settled elsewhere — but ADR
0191 is the durable artefact a later session will read, and the record it contradicts is the one it
cites. The last row is the "amendment recorded only in the new document" shape inside a single
document.

---

## 4. Recommendations (no action required for approval)

- **F-REC-1** — `supabase/tests/mutation/act-hat-blind-sweep.sh:23` says the executed query is at
  `:195`; the same edit that added the correction pushed it to **`:202`**. A cited line number that
  rots inside the correction that cites it.
- **F-REC-2** — all five closure notes cite `commit b59d4bbf` as the closing commit; the closures
  are in **`6f94a634`** (`b59d4bbf` is the re-baseline). Five identical one-word fixes.
- **F-REC-3** — three of the new entries carry **no body file and no `**Body:**` pointer**
  (`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`,
  `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`,
  `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT`). Their substance rides in the
  `**Status:**` line. `lint:registers` passes, so this is judgement, not a gate breach — but the
  register template at `follow-ups-open.md:52-62` asks for one or the other.
- **F-REC-4** — `docs/reviews/authz-door-audit-findings.md:975-976` puts *"the **3** above re-filed"*
  next to *"31 hand-prose rows in, 31 preserved"*, which reads as `15+15+3 = 33 ≠ 31`. The record
  disambiguates (`:2013`: `15 + 15 + 1 = 31`; only one of the three re-files was a hand-prose row).
  One clause in the findings file would remove the apparent contradiction.
- **F-REC-5** — `TRIG_SECDEF` (`p0-authz-door-audit.sh:953-955`) bounds to `('app','public')` while
  the arm's domain is `('app','public','authz')`. MEASURED: identical today (174 either way, no
  `prosecdef` trigger function in `authz`), so it is a latent drift, not an error.
- **F-REC-6** — `resets_enabled()` and `periodic_reset()` are now a **second hand-kept copy** of C2's
  (byte-identical but for `SUBSET` → `SUBSET_RUN`). `FUP-DOOR-DEGENERATE-PREDICATE-TWO-HAND-COPIES`
  names only `DEGENERATE_PREDICATE`; the reset pair is the same class and is unnamed.
- **F-REC-7** — the merged findings file carries two `## COVERED …` headings (`:263` the new one with
  `+ NOTICED`, `:341` the baseline's `+ ERROR (harness bug)` preserved as prose, above a table with
  **0** ERROR rows). Harmless to every consumer I checked (nothing selects on a `## COVERED`
  section), but a reader meets two "COVERED tables".
- **F-REC-8** — `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`'s **register line** is
  byte-identical to `main` while its body gained the 23-row work-list; the archived BROAD-GATE
  closure says the follow-up "**now carries** run 2's 23 rows", which a reader working from the
  register alone cannot see.
- **F-REC-10** — ADR 0191 `:118-120` renders the PO-accepted bound ending "…in §7.17b and in **the
  `DOMAIN-STATEMENT`**" while the emitter it calls "stated verbatim" ends "…in §7.17b and in **this
  statement**" (`p0-authz-door-audit.sh:996`). Semantically identical, not byte-identical, under a
  "verbatim" label.
- ~~**F-REC-11**~~ — **withdrawn on measurement.** ADR `:142` cites "ADR 0173 **§4's**" where
  `authz-setvalued-targeted-cases.sh:33` cites "ADR 0173 **D4's**". Both resolve to the same place:
  ADR 0173's decisions are `### 1`…`### 5` under `## Decisions`, and the *"iterate → recipients;
  branch → authority"* discharge sits inside `### 4 — ⛔ PRED_DOMAIN is NOT widened…` (`:100`). The
  two labels are the project's two conventions for one decision. No defect.
- **F-REC-12** — ADR `:214` says the classifier is "proven on **four** constructed strings"; six
  ship (`p0-authz-door-audit.sh:539-548`), the two extra being the `Dubious` path and the missing
  `Result:` path. Understated, not false — but the two extra cases are the ones that make the
  classifier's *other* code path evidence, so they are worth the ADR's ink.
- **F-REC-13** — ADR `:251-253` says the follow-up carries "23 aborting-file signatures"; it carries
  **15 distinct signatures over 23 rows** (`FUP-C2-TIER1-…:73-74`), and the four weak rows it says
  are "a keystone entry" here actually live in the separate
  `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`.
- **F-REC-14** — ADR `:458` still lists "the set-valued home **needs** a scheduling line in the lead
  playbook" as an open consequence; `docs/lead-playbook.md:127-133` satisfies it as of `376d5717`.
- **F-REC-9 (lead, Record step)** — at `376d5717` the lead landed both §4 lines, so
  `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`'s close condition ("closes by pasting") is
  **satisfied** while the entry still reads `**Status:** open`. Close it in the Record step, and note
  that its landing also makes the `DOMAIN-STATEMENT`'s word "scheduled" true.

---

## 5. The eleven review questions, answered

### Q1 — Selection (ADR 0173 §4's criterion) ✅ MEASURED, clean

Both predicates enumerated over `pg_proc ⋈ pg_namespace ⋈ pg_type` where
`nspname in ('app','public','authz') and prosecdef`:

```
pred_total_new 127 | pred_total_old 125 | delta_added 2 | delta_removed 0 | pred_out_new 35 | pred_out_old 37
ADDED   : authz.candidate_has_permission(p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text)  [bool]
          authz.scope_reaches(p_assignment_kind text, p_assignment_id uuid, p_resolution_kind text, p_requested_id uuid) [bool]
REMOVED : (0 rows)
```

- **`n.nspname='authz'` sits INSIDE the `typname='bool'` conjunct** — read at
  `p0-authz-door-audit.sh:821-830`, and independently confirmed by the negative: all six non-boolean
  `authz` `prosecdef` functions (`assignment_facts`, `authorized_scope_ids`,
  `candidate_authorized_scope_ids`, `entailed_grants`, `explain_permission`,
  `rebuild_implication_closure`) score `new_in = f`. The plan's predicted "6 guaranteed ERROR rows"
  is therefore averted, measured rather than argued.
- **The `!~ '^is_valid_'` clause is NOT new.** ⚠ The plan's ⚠ was wrong about this: `git show
  main:…:499` already carries `(p.proname ~ '$PRED_NAME_RE' and p.proname !~ '^is_valid_')`. The
  unit's diff adds one line, `n.nspname = 'authz'`, and nothing else. MEASURED: on the live catalog
  the clause excludes **zero** functions (no `is_valid_*` `prosecdef` function exists in the three
  schemas), so it cannot have narrowed anything. The record's step-4 handling is correct; the plan's
  worry was unfounded and the unit did not need to justify it.
- **The lift** — `scripts/door-sweep-cases.sh` is **unmodified** by this unit (absent from the
  diffstat), and `lift_block PRED_DOMAIN` now returns **10 lines** (was 9); after the three explicit
  substitutions the `case … *'$'*` test finds **no residual `$`**. Deriver SELFTEST **34/0, rc 0**.

### Q2 — the targeted home ⚠ scope and crash safety clean; **the verdict rows do not exist** (F-BLOCK-2)

- **Scope**: explicit list of 3 (`authz-setvalued-targeted-cases.sh:24-27`) with the 2 out-of-scope
  `SETOF uuid` functions named beside their disposition (`:28-33`), and `§4b` asserting the live
  cardinality is exactly 5. ✅
- **Crash safety inherited, traced**: distinct sentinel `authz-setvalued-INFLIGHT.sql` (`:91`) with
  `.probe`/`.want` sidecars (`:120-122`); the restore is believed only when **psql rc 0 AND a
  catalog re-read equals the pre-mutation value** (`:135`) — the 2026-09-04 sibling fix, not the old
  unconditional `rm -f`; traps on `EXIT` and `INT TERM HUP` (`:147-148`); a crash-sentinel check
  before any mutation with `RECOVER=1` and a verified re-apply (`:155-180`); `psql_f` uses
  `docker exec -i … -f - < "$1"` (`:106`) with the `ae3` host-path bug documented at `:101-105`.
  §4a (residue by property, baseline-free) and §4b (persisted cardinality expectation) both run as
  preflights. The neutralization is the **universal set**, header and dollar-tag taken from
  `pg_get_functiondef` so signature/`SETOF uuid`/`stable`/DEFINER/`search_path` are preserved by
  construction (`:290-318`). ✅
- **`DEGENERATE_PREDICATE` gained `P0-SETVALUED-NEUTRALIZED` in BOTH hand-kept copies** —
  `p0-authz-door-audit.sh:699-702` and `p0-authz-invariant.sh:235-238`, `diff` rc 0 between them.
  MEASURED, and this was the plan's explicit LEARN-082 requirement. ✅
- **The three verdict rows: absent.** See F-BLOCK-2. ⛔
- **No `SELFTEST` (disclosed at `docs/progress/pred-domain.md:2372-2381`) — my judgement: ACCEPTABLE
  RISK, and correctly disclosed.** The harness's two controls are in-run preflights that gate the
  first case, so they cannot silently not-run; the failure they could hide is a §4a/§4b that has
  itself broken, and §4a's discrimination half was exercised on the 2026-09-05 run (it named the
  mutated function on each of the three cases while the mutation was live, and enumerated to 0 rows
  before and after — `docs/progress/pred-domain.md:503-507`). What is genuinely untested offline is
  the **classifier and the exit-code chain**, which is exactly the gap that shipped in the door arm
  and that D5 Amendment 1 had to repair with `emit_result()`. I would not block on it; I would ask
  that the scheduling entry's successor carry "add a no-DB SELFTEST arm" as its next increment.
- **`FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE` acceptable?** ✅ Yes at `6f94a634` — the
  residual is real, it is owned by the only role that may write the file, and the follow-up closes
  by pasting a sentence drafted verbatim. At `376d5717` it is satisfied and should be closed
  (F-REC-9).

### Q3 — `NOTICED` ✅ MEASURED, clean

- Classifier split read at `p0-authz-door-audit.sh` `classify()`; the four outcomes and their two
  discrimination halves are asserted on constructed strings. I ran it: `classify 6/6`,
  `resets_enabled 6/6`, `emit_result 8/8`, **TOTAL 20/20, bare rc 0**, and the run leaves the
  committed baseline `cksum`-verified unchanged.
- **The `(0 BLIND, 0 ERROR, >0 NOTICED) → rc 0 with the disclosure` case is proven with its control
  pair**, which is what makes it evidence: `er_case "0 BLIND, 0 ERROR, 1 NOTICED" → 0` and
  `er_case "1 BLIND, 0 ERROR, 1 NOTICED" → 1` — same NOTICED count, opposite code — plus a separate
  row asserting the disclosure text is actually printed (a silent rc 0 would be worse than the DIRTY
  it replaces, and the file says so at `:571-576`).
- **RESULT line's three classes**: `SWEPT · COVERED · BLIND · NOTICED · ERROR(harness)`
  (`:1665`) and the verdict line separates `BLIND (blocks)` / `NOTICED (disclosed, non-blocking …)` /
  `ERROR (not a pass)`.
- **`NOTICED` never collapses into COVERED**: MEASURED across the harness (`:419`, `:986`, `:1307`)
  and the merge — `scripts/lib/merge-findings-baseline.sh` derives its verdict-token set from the
  generated file (`:319-330`, "none of them hand-listed here"), so a fourth token is handled without
  a code change, and a verdict change forces CARRIED rather than a splice (`:166-175`). ⚠ I also
  checked the sibling risk: NOTICED rows live under a heading that *begins* `## COVERED` (`:263`),
  but **nothing anywhere selects on a `## COVERED` section** (grep over `supabase/tests/mutation/*.sh`,
  `scripts/*.mjs`, `scripts/lib/*.sh`), so the section-vs-verdict bug of F-BLOCK-1 has no COVERED-side
  twin.
- **ADR 0191 records the ruling** at `docs/decisions/0191-…:218-243`, including the one D5 sentence
  it supersedes, quoted rather than rewritten, and the before/after exit-code table. Its content
  matches the harness behaviour I executed. ⚠ Two qualifications on "records the PO ruling
  **verbatim**": (a) the ADR never claims verbatim — its rendering (`:225-228`) is unquoted prose in
  the ADR's own voice, and it differs in wording from the harness's rendering at `:451-454` (the
  triad "disclosed, non-blocking, **work-listed**" survives only in the amendment's heading) and
  from the drafted playbook line at `pred-domain.md:2443-2450`; (b) **no verbatim PO utterance
  exists anywhere in the tree to compare against** — the closest first-person record
  (`pred-domain.md:1991-1992`) is itself a paraphrase. So "verbatim" is unverifiable in principle
  here. The three renderings are semantically consistent, which is the checkable property, and they
  are.
- ⛔ **But the classifier's own header still asserts the superseded rule** — F-MAJOR-0.
- **Run 2's 23 NOTICED — all retried, all reproduced.** MEASURED from
  `…/scratchpad/pd/full2/full.log`: `grep -c 'PERIODIC RESET'` = **40**, `grep -c 'PERIODIC RESET
  (retry'` = **23**, `grep -c 'PERIODIC RESET (scheduled'` = **17**, `grep -c 'drift suspected'` =
  **23**; the findings file carries **23** rows with `(retried after reset)` and **23** NOTICED rows.
  Two verbatim lines from that log:

  ```
  full.log:292   drift suspected — resetting and retrying app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid) ONCE
  full.log:326   drift suspected — resetting and retrying app.can_sign_meeting(p_attendee_id uuid, p_signer uuid) ONCE
  ```

- **"zero abort in an authz meta-test" — REPRODUCED from the rows' notes.** Parsing each NOTICED
  row's `aborting file(s):` segment: `250_authz_p0_isolation`, `290_authz_never_called_door_floor`
  and `246_authz_f1_referral_split` appear **zero** times (grep rc 1). 15 distinct aborting-file
  signatures over 23 rows; the largest *signature* group is 4 (`140_patient_safety.sql`) — the
  record's phrase is about signatures, and its per-file frequency table (6 `205_administrativo`, 5
  `225_supersession`, 5 `140_patient_safety`, …) reproduces exactly. Every row's **run shape** is
  `Files=262` (the only other `Files=` tokens in those cells are inside re-attached hand notes).
  The one overstatement is F-MAJOR-5.

### Q4 — the `using`-only mirror ✅ MEASURED, clean (one stale sibling comment, F-MAJOR-4)

- `main:913` issued `using (true)$([ "$has_wc" = "t" ] && echo ' with check (true)')`; HEAD issues
  `alter policy "$polname" on public."$tbl" using (true);` (`:1574`) with the reasoning at
  `:1551-1565` and the run banner at `:1519`.
- **The write arm owns the other half**, quoted: `p0-authz-writepath-audit.sh:80`
  `#   ALL    -> `with check (true)` **ONLY**`, and it does open it (`:789`, `:1318`, `:1327`).
- **Row keys unchanged** — 0 keys changed their parenthetical suffix between `main` and HEAD.
- **Exactly 11 `(ALL)` COVERED → BLIND flips, and ZERO non-`(ALL)` flips.** Independently confirmed;
  the eleven are 5 `capa_*_write` + 6 `rca_*_write`, all enumerated in
  `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` with each policy's `using` qual, the write-half fixture and
  the read-half assertion owed. The earlier "exactly FIVE" stands beside its FLOOR correction
  (`:37`) and the `SETTLED … ELEVEN` section (`:80`), which is the right convention.
- Full transition matrix, `main` → HEAD, keys present in both (354): `COVERED→COVERED 243`,
  `BLIND→COVERED 38`, `BLIND→BLIND 25`, `ERROR→NOTICED 17`, `COVERED→BLIND 11`, `ERROR→COVERED 11`,
  `COVERED→NOTICED 6`, `COVERED→COVERED (targeted mutation) 3`.

### Q5 — tail drift and the port ✅ MEASURED, clean; Batch 0's closure was **mis-scoped, and the amendment says so plainly**

- The drift proof is sound and is a *selection* proof, not an argument: two tail cases run alone on
  a fresh reset came back COVERED at the true shape, three consecutive cases from the drift-onset
  neighbourhood did not reproduce the abort, and case 274 — which run 1 scored NOTICED — was itself
  already drifted. "Name the originating case" has the answer **there is none**, and the record says
  so in those words.
- **The port mirrors Batch 0's design.** Side-by-side `diff` of the two `resets_enabled()` bodies:
  byte-identical except `SUBSET` → `SUBSET_RUN`. The set-ness capture line
  (`RESET_EVERY_EXPLICIT=0; [ -n "${RESET_EVERY+x}" ] && RESET_EVERY_EXPLICIT=1` then
  `RESET_EVERY="${RESET_EVERY:-20}"`) is byte-identical to `c2-command-door-neutralizer.sh:723-724`,
  in the order that makes the SELFTEST's trial A/B′ discrimination meaningful.
- **Two adaptations, both justified**: the retry keys on the promoted global `SHAPE_MOVED` rather
  than on note text (the door arm has four outcomes, two of them drift-shaped), and the OID is
  re-resolved from the function IDENTITY per case because a reset reassigns every `pg_proc.oid`.
  ⭐ The second is a genuine improvement over C2, and the C2 hazard it exposes is filed rather than
  silently fixed (`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-SURVIVE-ITS-OWN-RESET`).
- `resets=40 = 17 scheduled + 23 retries`, and **23 `(retried after reset)` suffixes** — MEASURED
  above. On the "earlier report said `retried=0`": the record carries the correction where it
  matters — it states the decomposition explicitly with the two `grep -c` figures beside it
  (`docs/progress/pred-domain.md:1325-1329`) and re-derives the scheduled count arithmetically. I
  find no surviving `retried=0` claim anywhere on the branch.
- **Was Batch 0's closure of `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` mis-scoped?
  Yes — and the archive amendment says exactly that, in the strongest available terms**
  (`docs/followups/follow-ups-archive.md:8814-8848`): *"THIS CLOSURE COVERED ONE OF THE TWO SITES
  THAT HAVE THE BUG … nothing anywhere recorded the door arm as still exposed: a fix correct at most
  of its sites reads as a complete one."* It amends rather than rewrites, leaves the original
  unedited, gives the measurement, and names the residual C2 OID hazard it does not fix. **Reopening
  is not required**: the second site now has the fix, and the one hazard that remains has its own
  open entry. This is the right disposition. (See F-MAJOR-6 — the generalization deserves a
  `LEARN-` row.)

### Q6 — the re-baseline and the merge ✅ MEASURED, clean apart from F-MAJOR-2

- Merge verified three ways in the record (bare rc 1 = DIRTY not 2; `MERGE_VERIFY` rc 0 reporting
  426 prose lines / 11 suffixes / 275 carried; enumeration on disk), and the pre-run baseline
  `cksum 1895535637 131621` matches the committed file's — I re-read `provenance.txt` and `rc.txt`
  directly and they carry those exact figures with `FULLRUN_BARE_RC=1`.
- **Disposition applied by script**, join 1:1 on (key, both verdicts, a hand flag **recomputed** from
  column 5 and agreeing 31/31) — the join key is not a restatement of what it keys on, which is the
  right control.
- **My own assertions on the artefact:**
  ```
  verdicts_from_findings replica  : 356 keys, 356 unique, 0 'gate / policy' literals
  HAND-MERGED mentions            : main 9  ->  HEAD 9
  '## Note' sections              : main 7  ->  HEAD 7
  duplicated keys                 : main 7  ->  HEAD 0
  CARRIED block                   : absent at HEAD (2 prose mentions, one announcing its removal)
  ```
  ⚠ One nuance worth recording: the 9 `HAND-MERGED` mentions are 8 blockquote notes + 1 in-row
  marker, and the *content* of all 8 notes survives; what changed is blockquote segmentation
  (contiguous `>` runs 9 → 6, blank separators removed). The 9/9 claim is sound on mentions and on
  notes; it is not a claim about contiguous blocks.
- **CARRIED block empty** ✅, and its removal is argued from the merge's own behaviour rather than
  taste.
- **The questionable re-attach: ruled in F-MAJOR-3 (keep, date, repair).**
- ⚠ 38 keys present at `main` are absent at HEAD (13 INSERT/UPDATE/DELETE policy rows retired to the
  write arm, 7 duplicate eliminations, the rest deliberate deletes/retires). This is the PO-ruled
  disposition and the record's census reasoning for it is correct — every RLS policy is in the
  census's domain, so a wrongly-deleted policy row would have reddened `ARM=census` rather than
  passing quietly. I flag it only so the PO sees the size of the deletion (242 rows) against the
  size of the ruling.

### Q7 — `ARM=census` non-vacuity ⚠ / `ARM=policy` ⛔ (F-BLOCK-1) / the 75-vs-36 count ✅

- **Census non-vacuity: I could NOT run the arm.** Assessing the *evidence*: the design of the
  negative control is right — it deletes exactly the five rows whose accounting the change is
  claimed to move (2 resolvers + 3 re-files), expects red **naming all five**, and restores the file
  byte-identically (`md5 8043002f28f125d4d6eee3186720100a` before and after). It is a discrimination
  control, not a bare "does it red", and it is the same shape Batch 1's review asked for. The one
  thing it does not prove is the direction the record itself flags — that no *deleted* key was live,
  in domain and unaccounted; the record's argument for that (the arm compares 581 live gates against
  the verdict-carrying set and named none) is sound. **INFERRED-but-well-argued; on my
  could-not-verify list.**
- **`FROMFINDINGS=1 ARM=policy` RED at rc 1, already red at `main`**: the *disclosure is accurate*
  and I reproduced it independently (16 → 24, +11 = exactly the mirror flips, −3 dead subjects). ⛔
  Its "0 false offenders" half is F-BLOCK-1.
- **75-vs-36 REPRODUCED from the file**: the `## BLIND` section (`:184`–`:262`) holds **75**
  pipe-rows = 1 header + **36 BLIND** + **38 COVERED**; **0** BLIND-verdict rows sit outside the
  section. So `blind_from_findings` returns a door BLIND set of **74** where the run measured **36**.
  The follow-up's mechanism description is exactly right; only its consequence sentence is wrong.

### Q8 — `DOMAIN-STATEMENT` ✅ printed, five populations, counts right — ⛔ its witness is false (F-BLOCK-3), its provenance label overclaims (F-MAJOR-7), population 1 is not verbatim (F-MAJOR-1)

- Emitted by `domain_statement ()` (`p0-authz-door-audit.sh:961-1010`), printed on every run beside
  `ARM-DOMAIN` and written into the findings header (present at
  `docs/reviews/authz-door-audit-findings.md:37-71`).
- **Five populations**, the fifth being the NOTICED class added by D5 Amendment 1. Populations 2 and
  3 (`HCDS*` 60 / `28000` 6; the C2 ERROR class) carry ADR 0184 pt 4's figures.
- **The trigger-enforcer counts are DERIVED, not literal** — the query is
  `p0-authz-door-audit.sh:953-958` (`TRIG_SECDEF`, `TRIG_WIRED`, `SETVALUED_N`). I re-ran all three
  on the live catalog: **174 / 268 / 5**, matching the committed statement exactly; `PRED_OUT` = 35
  and `POL_TOTAL` = 226 (= 236 public `r`/`*` policies − 10 at `qual='true'`) likewise. ⚠ Those are
  the *only* derived figures in the block — see F-MAJOR-7 on the header that says otherwise.
- **Population 1 is a paraphrase of a sentence ADR 0187 D1 requires verbatim** — F-MAJOR-1.
- ⛔ **Population 4's only "Measured witness:" is false** — F-BLOCK-3.
- **The TRIGGER-ENFORCERS closure: my ruling is that it CLOSES, and the disclosure is what makes it
  close.** The follow-up's body (`## Closes when`) asks that the domain statement name trigger
  enforcers out of domain *"so that a BLIND caused by a trigger is distinguishable from a BLIND
  caused by an absent assertion"*, and offers **two routes** to that distinguishability (extend the
  worklist derivation to attribute trigger enforcement to the reaching doors; or a recorded ruling
  that a different arm covers trigger guards, naming which). Neither route was built, and the
  delivered statement asserts the opposite word — `INDISTINGUISHABLE here`. Read literally, the
  clause is not discharged, and the builder says so in numbered clauses rather than letting the ✅
  imply otherwise (`docs/followups/follow-ups-archive.md:10103-10120`).

  I close it anyway, for a reason I want on the record: the clause's *word* asks for the wrong thing.
  A trigger has no call edge from the door that fires it and no boolean this arm can flip — making a
  trigger-caused BLIND distinguishable **inside this arm** is not achievable by a domain statement,
  and route 1 would have required a different instrument. What the FUP was actually written to
  prevent is an unstated bound (its own ⛔ says *"the domain is unstated, which is precisely the ADR
  0079 failure"*), and that is discharged: the bound is now **stated**, its two counts derived per
  run, quoted at every gate, and it names a distinguishable **remedy** (a keystone on a fixture the
  trigger does not already refuse, vs a keystone on the door).

  ⛔ **Two conditions of my ruling.** (1) The archive's clause-3/4 disclosure must stay exactly as
  written — it is the only place the two undelivered routes are recorded; do not tidy it. (2) The
  closure's **witness must be repaired before the statement ships again**: the sentence it leans on
  is false (F-BLOCK-3), and with it gone the closure rests on the bound being stated and on nothing
  measured. If no live witness can be produced, the statement must say population 4 is asserted
  rather than witnessed — which is still a closure, but a smaller one than the current text claims.

### Q9 — closures and registers ✅ MEASURED, clean (three RECs)

- **Rotation is verbatim.** Ten `difflib` comparisons (register entry and body file, for each of the
  five) produce **zero hunks**. The only omissions are the `### `/`# ` heading lines and the
  `**Body:**` pointer, each declared in the archive with its reason (`lint:registers` reds on a
  pointer to a deleted file). ⭐ The A2 truncation (`…they are one apparatus gap with tw…`, a literal
  U+2026) was rotated **including the defect**, and the closure note flags it — which is the correct
  handling.
- **Register-vs-body divergence: THREE of five, not four.** The record's own table is right about
  this (it marks A1 and A3 *"word-identical … so the two agree"*); the "four of five" figure in my
  brief is a paraphrase upstream of the record, not a claim the unit makes. Diverging:
  `…GAP-WIDENED…` (register truncated mid-word), `…BROAD-GATE-ABORTS-A-FILE` (**body states no
  closing condition at all — CONFIRMED**, its only closing-adjacent material is `**Decide
  between:**` with two options; the register field is a flattening with a stray `; or;` joint), and
  `…TRIGGER-ENFORCERS` (register is a strict subset, dropping the two named routes and the ⛔ bar).
  Each closure audits against the **body**, the stricter of the two, and says which and why.
- **Every closed id is gone from the open register** (one provenance citation inside a new entry's
  `**Filed:**` field, which is correct). The archive is a **superset by subsequence** — 4 insert
  opcodes, 0 deletes, 0 replaces — with three of the four landing mid-file as declared additive
  amendments to existing closure notes ("Everything above stands and is left unedited").
- **New entries**: all eight state a measurable close condition naming an artefact and an observable
  transition, each with at least one ⛔ negative bar. Three lack a body file (F-REC-3).
- **Ratchets not raised.** `scripts/check-docs-registers.mjs` is unmodified; I ran `npm run lint`
  (rc 0) and read the ratchet line myself:
  `closesWhenPoToRule=137/147 severityPerEmoji=128/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=90/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52`
  — identical to the record's step-11 figures.
- **ADR 0191**: `**Status:** proposed`; no `**Supersedes:**`; `**Amends:** ADR 0173 … · ADR 0079 …`;
  both generated back-pointers landed (`INDEX.md:103` and `:197` name 0191; `INDEX.md:215` lists
  0191 as `⚠ proposed … amends 0079, 0173`), and the back-pointer line is the **only** change to
  either amended ADR. `0191` added to `proposed-review.json`. ✅
- ⛔ **But the ADR does contain false sentences**, audited decision by decision against the code and
  the record: `:63-67` (the `reopen_interview` witness — F-BLOCK-3), `:266-268` ("derived … never
  literal" — F-MAJOR-7), and `:357-358` / `:359-361` / `:380-382` / `:426-428` (F-MAJOR-8).
  D1, D2, D3, D4/D4a/D4b, D5 Amendment 1, D7/D7 Amendment 1 and the Consequences all verify against
  the code; notably D8's three C2 line citations (`c2-command-door-neutralizer.sh:797`, `:889`,
  `:922`) are exact, and `:922`'s `sweep_one "$foid"` does sit immediately after a `periodic_reset`,
  which is precisely the hazard the ADR claims. Two ADR claims are **not verifiable from the tree**
  and I did not infer them: `:165-166` (0182's increment re-earning a verdict when pgTAP 413 grew
  five assertions) and `:216` ("the pre-change classifier was run over the identical strings").

### Q10 — scope and incidents ✅ clean, both incidents well disclosed

- `git diff --name-only main...6f94a634 -- supabase/migrations supabase/seed.sql src` → **empty**.
  `-- .claude docs/lead-playbook.md CLAUDE.md` → **empty**. MEASURED.
- **The hand-derived restore filename** (`docs/progress/pred-domain.md:655-668`): the account is
  complete and self-incriminating — root cause (the harness's `slug()` appends one more `_`),
  detection (the same command's md5 comparison printed `*** RESTORE FAILED`), exposure (a live local
  stack, policy at `qual = true`, restored within the minute), verification (catalog md5 back to
  `902d7a71f33b627774177f93465071cd`; `pg_policies` with `cmd <> 'SELECT'` and a `true` half
  enumerated to zero; all four degenerate-body forms zero), and the corrective (`[ -f "$R" ]`
  asserted before the second half). **My judgement: disclosed correctly, no residual risk** — a local
  dev stack, under a minute, detected by an instrument rather than noticed. Its lesson belongs in
  LESSONS.md (F-MAJOR-6).
- **The two-agents window / "external revert"** (`:855-884`): nothing was lost, and that is
  measurable rather than asserted — every artefact survived in `$WORK` and re-running the merge
  offline reproduced the run's output **byte-for-byte** (`cksum 2335526635 304176`, `md5
  555b058d…`, 2215 lines, all three equal to the runner's own POST figures). The run in question was
  run 1, which was subsequently voided by tail drift anyway and never committed, so the question is
  doubly moot. ⭐ The record refuses to guess who did it and instead names the mechanism that would
  produce it (the deriver prints `git checkout -- <findings>` as a *subset* run's remedy, which
  applied after a *full* run destroys its product) — that is the more useful disclosure, and it is a
  standing hazard worth a rule or a follow-up in its own right.

### Q11 — gate evidence at `6f94a634`, and which witnesses rest on runs that did not execute

**Witnesses I re-executed myself (MEASURED, bare):** `npm run lint` **0** (with the ratchet line);
deriver `SELFTEST` **0 / 34-0**; door `SELFTEST` **0 / 20-20**; the diff-scoped deriver **3** with the
`SCOPE:` line reproducing the record's quote verbatim; the scope emptiness checks; all catalog-derived
counts (127 / 226 / 35 / 174 / 268 / 5); the run-2 log's reset decomposition and NOTICED attribution;
the findings-file row algebra; the register rotations.

**Witnesses I could not execute, partitioned honestly:**

| witness | status |
| --- | --- |
| `npx supabase db reset --local` rc 0 | out of my permissions — **not re-verified** |
| `npm run test:db` rc 0 at `Files=262, Tests=8876` | out of my permissions. ⚠ Corroborated only indirectly: `ls supabase/tests/*.sql` = **262**, and the shape appears in every harness log I read |
| `npm run typecheck` rc 0 | not run (no `src/` change in the diff, so the risk is nil) |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 wrapper` rc 0 | **not re-verified**. ⭐ I *did* independently re-implement and re-run the `ARM=policy` selector, which is how F-BLOCK-1 was found — so the four arms' figures are the one substantial block of the gate that no second party has re-derived |
| the census non-vacuity control | design assessed, not executed |
| run 2 itself (353 cases, 14 h 53 m) | not re-run; its log, provenance file and merged artefact were read directly and are internally consistent |
| the retrofit's 9 `periodic_reset` trial rows and the `BASE_SHAPE_OVERRIDE` end-to-end proof | not re-run; the extraction method (`sed`-extract the functions, `bash -n`, source with `supabase` stubbed) is sound and each trial records whether the destructive command *would* have been called |

**No proof I relied on rests on a run that did not execute.** The one place where a green figure and
a reality diverge is F-BLOCK-1, and it was found precisely by re-deriving rather than re-reading.

---

## 6. Could-not-verify list (each of these is a work item, not a clearance)

1. **The four §6 arms' rc 0 and their figures** (`census` live 581 / verdicts 602; `hat` 7/7 + 4
   allowlisted findings; `floor` 63 zero-call doors; `wrapper` BLIND 41 ⊆ allowlist). Nobody but the
   builder has run these at this tree. Given F-BLOCK-1 was a mis-taken measurement inside the same
   step-11 block, **the lead should re-run all four on a fresh reset before the PO approves**, and
   quote the bare codes.
2. **`npm run test:db` at `Files=262, Tests=8876`** on a fresh reset.
3. **`ARM=census`'s non-vacuity control** (delete the 5 rows → red naming all five → restore).
4. **The 23 NOTICED rows' attributability** — the unit measures that the suite reddened and that the
   meta-tests are not implicated, and explicitly declines to rule that the reddening belongs to the
   opened gate. That question is still open and is correctly routed to the work-list.
5. **Whether any of the 242 deleted CARRIED rows was live, in domain and unaccounted.** The census's
   silence is the evidence; I did not enumerate the 242 against the live catalog.
6. **The targeted home's three verdicts** cannot be re-derived from any committed artefact today,
   because they were never filed (F-BLOCK-2). Until they are, the only record of them is a paragraph
   in a progress file.
7. **Two ADR 0191 claims have no artefact in the tree**: `:165-166` (ADR 0182's increment re-earning
   a verdict when pgTAP 413 grew five assertions) and `:216` ("the pre-change classifier was run over
   the identical strings"). Neither is load-bearing for a verdict; both are unfalsifiable as written.
8. **The 15-hour run 2 itself**, the retrofit's 9 `periodic_reset` trials, and the mutant that
   "reds exactly the two rows encoding the ruling" — read from their logs and the record, not
   re-executed.

---

## 7. Disposition for the PO

**Not ready for approval or the Record step as it stands. It will be after a short text-only loop.**

Nothing found here touches an RLS boundary, a migration, `src/`, a policy or a `prosecdef` gate.
There is no security regression: `git diff main...6f94a634` over `supabase/migrations`,
`supabase/seed.sql` and `src` is empty, and the diff-scoped deriver's rc 3 is the checkable form of
that claim. Every blocking item is a false or missing *sentence*, and each has a named, bounded fix.

### What the unit PROVES (measured, and I re-derived each of these independently)

- The door arm's domain now admits `authz.candidate_has_permission` and `authz.scope_reaches` and
  **nothing else**: 125 → 127, `PRED_OUT` 37 → 35, reverse delta 0, and the six non-boolean `authz`
  DEFINERs stay out. `candidate_has_permission` has its **first verdict** (COVERED), earned twice at
  the same suite shape.
- The read arm's `FOR ALL` verdicts are now **read-half claims**, and the cost is bounded and
  enumerated: exactly **11** `(ALL)` COVERED → BLIND flips, **zero** non-`(ALL)` flips, no new BLIND
  subject anywhere outside the mirror fix.
- **`NOTICED` exists, fires, cannot become COVERED, and its exit semantics are tested offline** —
  20/20 with the control halves that make each row evidence.
- The **tail drift is diagnosed, not patched**: the failure was run position, no originating case
  exists, Batch 0's reset design is ported faithfully, and run 2 filled in 84 previously unreadable
  cells while moving **zero** run-1 COVERED and **zero** run-1 BLIND rows.
- The findings baseline is **re-earned through the merge**, hand-authored material intact (9 mentions
  / 8 notes / 7 `## Note` sections / 275 carried rows dispositioned by script with a recomputed join
  key), duplicate keys eliminated, `verdicts_from_findings` clean at 356/356/0.

### What the unit does NOT prove, and must be carried forward

- **`NOTICED` is evidence, not a verdict** — 23 gates carry no usable verdict; work-listed in
  `FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE`, with the four weakest split into
  `FUP-AUTHZ-NOTICED-ROWS-WITHOUT-AN-AUTHZ-SHAPED-REDDENING`.
- **11 `(ALL)` read-half BLINDs** are disclosed, never relabelled, and keystoning them is its own
  increment (`FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS`).
- **The set-valued targeted home** was unscheduled at `6f94a634`; the lead landed the §4 sentence at
  `376d5717`, so close that entry in the Record step.
- **`FROMFINDINGS=1 ARM=policy` is red and was red at `main`** — and, corrected, **12 of its 24
  offenders are stale rows this re-baseline created** (F-BLOCK-1).
- **The C2 captured-OID hazard is filed, not fixed** (`FUP-AUTHZ-C2-NEUTRALIZER-CAPTURED-OIDS-…`).
- **Population 4 of the `DOMAIN-STATEMENT` is asserted, not witnessed** once F-BLOCK-3's false
  witness is removed; and populations 1, 2, 3 and 5 are literals, not per-run derivations
  (F-MAJOR-7). The block is still the right instrument — it simply claims more provenance than it has.
- **Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.**

### The change list, in the order I would work it

1. **F-BLOCK-1** — correct the "0 false offenders" claim in three places; enumerate the 12; re-rate
   the follow-up. ⛔ Do not allowlist them.
2. **F-BLOCK-2** — file the three set-valued verdicts as census-readable rows; rewrite the
   `app.current_professional_read_organizations()` backlog block into the past tense.
3. **F-BLOCK-3** — repair or retire the `DOMAIN-STATEMENT`'s `Measured witness:` sentence in the
   emitter, in the committed report header, and in ADR 0191 `:63-67`; note the consequence for the
   TRIGGER-ENFORCERS closure (Q8's condition 2).
4. **F-MAJOR-0..8** — the superseded DIRTY sentence at `p0-authz-door-audit.sh:421`; the ADR 0187
   D1 verbatim sentence; the `40_rls.sqlERROR` note and its era marker; the two write-arm sentences;
   the 23/23 → 21/23 correction; two `LEARN-` rows; the "derived … never literal" label; ADR 0191
   D8's four figures.
5. **F-REC-1..14** as convenient; F-REC-9 is the lead's, at the Record step.
6. **Before the PO decides**: re-run the four §6 arms on a fresh reset and quote the bare codes
   (could-not-verify item 1). Given that F-BLOCK-1 lived inside the same step-11 block, a second
   party's reading of those four figures is worth the twenty minutes.

⚠ **A pattern worth naming for the loop, because it is the same one four times.** F-BLOCK-1,
F-BLOCK-3, F-MAJOR-0, F-MAJOR-7 and F-MAJOR-8 are all the same defect: a **claim about a
measurement**, written beside a correct measurement, that no gate can contradict. The unit's code is
right in every one of those five places; only the sentence describing it is wrong, and in four of
the five the sentence errs in the direction that reads as care. That is `LEARN-049` and `LEARN-075`
exactly, in a unit whose entire subject is measurement domains. I would put that in
`docs/learning/LESSONS.md` alongside F-MAJOR-6's two rows — the generalization is *a prose claim
about a measurement is a second artefact, and only the measurement has an owner*.

Re-review should be quick: every blocking and major item is an assertion I have already measured, so
the re-check is a diff against this report.
