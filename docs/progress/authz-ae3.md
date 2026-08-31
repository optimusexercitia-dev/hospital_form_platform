# AE3 — Restricted personal-detail extraction (ADR 0155 D4)

Increment detail for Phase **AE3** of [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md).
Live status stays in PROGRESS.md § Now; this file carries the measurements.

- **Branch:** `authz-ae3-private-details` (cut from `main` 2026-08-31).
- **Census (AE3.1):** [authz-evolution-census-ae3.md](../design/authz-evolution-census-ae3.md);
  instrument [`scripts/authz-census-ae3.sql`](../../scripts/authz-census-ae3.sql).
- **Cutover:** [ae3-cutover-runbook.md](../deployment/ae3-cutover-runbook.md).

---

## G2 — re-measured at the branch cut (2026-08-31)

| figure | value | predicate |
| --- | --- | --- |
| remote `auth.users`, total | 36 | `select count(*) from auth.users` |
| remote `auth.users`, **non-test** | **0** | `count(*) filter (where email not like '%@test.local')` |

⭐ **G2 HOLDS** ⇒ AE3 keeps its **single-shot** authorization: one migration set, no dual-write.
⛔ This is a measurement with an expiry, void the moment the pilot loads data. A later session
**re-measures**; it does not quote this row.

Remote head `20261003006500` / 496 migrations = **identical to local**, and the AE3 subject
itself matched element-for-element (census §9) — AE0.3's per-phase parity obligation, discharged
with nothing to explain.

## What shipped

| # | Artifact | Note |
| --- | --- | --- |
| 1 | `20261003006600_ae3_create_profile_private_details.sql` | table + RLS in the same block; CHECK and **partial** unique index **moved**, not re-typed; backfill + keyed per-row verification |
| 2 | `20261003006700_ae3_repoint_restricted_column_consumers.sql` | the 5 census-derived SQL consumers, bodies taken from the **live catalog** |
| 3 | `20261003006800_ae3_drop_profiles_restricted_columns.sql` | the drop, **no `CASCADE`** deliberately |
| 4 | `supabase/seed.sql` | 5 CPF writes: `update` → **`insert`** |
| 5 | `src/lib/users/actions.ts`, `src/lib/users/person-footprint.ts` | 3 raw service-role sites re-pointed |
| 6 | pgTAP `301`, `359`, `361`, `379`, `382`, `385`, `386`, `393` | re-based |
| 7 | `supabase/tests/mutation/ae3-targeted-cases.sh` | the door-sweep finding's discharge |

## Three defects the split surfaced, each fixed rather than worked around

1. **`getPersonAdminView` would have denied every person with nothing on file.** One query used
   to answer two questions — *does this person exist* and *what are their values* — because both
   lived on `profiles`. After the split a null private-details row means only "no restricted
   details on file", a legitimate state. Left alone, `if (!profile) return denied` would have
   returned `personalData: null` plus both authority booleans false — **indistinguishable, to
   the caller, from "you may not administer this person"**. Split into an explicit existence
   check on `profiles`.
2. **`seed.sql` would have seeded ZERO CPFs, silently.** Its five statements were `update
   public.profiles set cpf = …`. An UPDATE against a missing row writes nothing **and raises
   nothing**, so re-pointed updates would have left every CPF-lookup keystone vacuous while
   `db reset` reported success. They are `insert … on conflict` now. The same trap was fixed in
   pgTAP `301` §2, `361` §4 and `393` §1.9 fixtures, where personas `d4`, `d1` and the two
   orphan-detector subjects have no seeded private-details row.
3. **The census's own §8b verdict was wrong at the grain.** It enumerated each `profiles` site's
   **`select` column list** and concluded "15 sites, none affected". `users/actions.ts:720`
   selects only `id` and **filters** on `.eq('cpf', …)`. `tsc` caught it; the census had not.
   Corrected in place, with the property restated: *names the column ANYWHERE in the query*.
   ⚠ Had that site used an explicit `.maybeSingle<T>()` type argument, **no gate would have
   caught it** — that is exactly the shape of `person-footprint.ts:612`.

## Gate AE3 — step 1 (build), measured

⛔ **Enumerations recorded, not exit codes** (`.claude/rules/authz-gate-results-need-a-current-baseline.md`).
All on a stack freshly rebuilt from migrations + seed.

| gate | result | enumerated | AE0 baseline |
| --- | --- | --- | --- |
| `npm run lint` | **PASS** (exit 0) | 11/11 gates; eslint 0 errors 0 warnings | — |
| `npm run typecheck` | **PASS** | 0 errors | — |
| `npm run test` (vitest) | **PASS** (exit 0) | 148 files / **2016** tests | 2016 |
| `npm run test:db` (pgTAP) | **PASS** (exit 0) | 248 files / **8285** tests | 8262 → +23, exactly this phase's additions |
| `ARM=census` | **INVARIANT HOLDS** (exit 0) | **569** live authz gates / **605** verdicts; no unswept newcomer in domain | 564 / 600 |
| `ARM=hat` | **INVARIANT HOLDS** (exit 0) | self-test **6/6**; 3 findings, all reasoned-allowlisted (pre-existing) | 6/6 |
| `ARM=floor` | **INVARIANT HOLDS** (exit 0) | **72** never-called reachable doors, all allowlisted; every allowlist entry resolves | 72 |
| `FROMFINDINGS=1 ARM=wrapper` | **INVARIANT HOLDS** (exit 0) | BLIND set **41**, all allowlisted | 41 |

⛔ **Domain qualifier, stated beside the green** (plan rule 2): the **427** reachable command
doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) are outside every arm's domain. "All arms green"
is no claim about them.

⚠ **CORRECTED after QA (finding B3).** This paragraph first said the harness's banner printed a
stale **407** and that the drift was *"filed rather than fixed here"* — **and nothing had been
filed**, which is the shape where a follow-up with no register line is invisible work. Three
things were then measured rather than assumed:

- the banner's `407` was a **frozen literal** in an `echo`, not a derived figure — so it could
  not be right or stale by measurement, only by typing;
- a live re-derivation returned **427** (345 `public` + 82 `app`), so the banner had drifted by
  **20** while printing beside four green arms;
- the register's own figure (**426**, re-derived at the AE1 Record step) had itself drifted by
  **one**, because doors landed in migrations `006000`–`006500` after that step.

Fixed rather than filed: `ARM=census` now **DERIVES** the count each run from the predicate that
defines the out-of-domain class, so the figure and the class can never disagree again; the frozen
number is gone from the banner and from the comment beside it; PROGRESS.md C2 carries the
re-derived 427 with its predicate. ⛔ Historical artifacts (ADRs, earlier reviews, archives) that
say 407 are **dated records and were left alone** — they were true when written.

### The diff-scoped door sweep — exit 1, a FINDING, ruled

`scripts/door-sweep-cases.sh main` derived **ZERO** cases from 3 touched migrations and exited
**1**. Per ADR 0079 Amendment 8 ruling 2 that is not a pass. It EXCLUDED-BY-NAME the five changed
functions (the recipe's filter selects `^is_|can_|has_|…` boolean gates; the door sweep can only
neutralize a boolean predicate). Ruling, per function:

| function | ruling |
| --- | --- |
| `app.finalize_invited_person_impl` | **not a gate** — it CALLS `app.can_administer_person_for('cpf_change')`, which is in the sweep's domain and is **unchanged** |
| `app.update_person_fields_impl` | same, for the `fields` and `cpf_change` arms |
| `public.list_org_people` | its gate is the inline D10 predicate, **byte-identical**; only the CPF probe's relation moved |
| `public.get_own_person_record` | self-scoped; the gate is `auth.uid() is null`, **unchanged** |
| `public.guard_profile_privileged_columns` | ⛔ **the one whose predicate AE3 actually changed.** Returns `trigger`, so no arm can neutralize it — **owes a targeted case** |

Discharged by `supabase/tests/mutation/ae3-targeted-cases.sh`, **both cases COVERED**:

| case | mutation | landed? | verdict |
| --- | --- | --- | --- |
| **A** — the edited guard | force `v_identity_changed := false` | fingerprint `fa562686…` → `0f750720…` | **COVERED** — 359 RED under mutation |
| **B** — the NEW control (an **absence**, so no predicate arm can reach it) | `grant select, update on profile_private_details to authenticated` | `has_table_privilege` false → true | **COVERED** — 382 and 359 both RED |

Rollback proven in both directions: case A's fingerprint returned to `fa562686…` and case B's
privilege to `false`, with the suites green again afterwards.

⚠ **The harness's own first run left the database mutated** — `psql -f <path>` inside
`docker exec` resolves in the **container** filesystem, so the restore silently could not find
its file. Fixed to `-f -` with a host redirect, and the incident is recorded in the script,
because "the restore ran" and "the restore worked" are different claims.

## Two gates that fired on this phase's own additions

Both are the gate working, recorded because neither leaves a trace in the file it changed.

**1. `lint:rules` (gate 8) went RED because the new mutation harness was the 41st file in
`supabase/tests/mutation/`.** Two rules — `authz-gate-results-need-a-current-baseline.md` and
`mutation-harnesses-are-not-killable.md` — declared `paths: supabase/tests/mutation/**`, and the
soft cap is 40. ⛔ **The rules did not widen; the subtree grew.**

Disposition: the gate's option (3), `broad:`, was tried and **does not fit** — both files sat
within ~20 bytes of the 2048-byte rule-size cap, so any justification long enough to be worth
reading blows the other gate. Took option (1) instead and **narrowed both globs to
`supabase/tests/mutation/*.sh`**. That is semantically right rather than merely smaller: both
rules govern **harnesses**, and the 5 files the narrowing drops are static allowlist/backlog
`.txt` **data**. Nothing either rule previously applied to has left its scope, and the new
harness stays covered by both. ⚠ The reason lives here and not in the files because the size cap
forbids it there — which is the cap's stated intent ("rationale belongs in the `source:` it
names"), and is why this paragraph exists.

**2. `door-sweep-cases.sh` exited 1** — recorded above under Gate AE3 step 1.

## Gate AE3 — step 2 (E2E), measured

**`npm run e2e:prod` on the full suite, run TWICE.**

| run | result | flaky | note |
| --- | --- | --- | --- |
| 1 | ⛔ **FAIL** — `1240 passed · 4 failed · 4 flaky · 4 did-not-run` | 4 | **3 of the 4 failures were AE3's own** |
| 2 | ✅ **PASS** — `1251 passed · 0 failed · 0 infra · 5 flaky · 0 did-not-run`, 21 batches | 5 | after the fixes below |

⚠ **Run 1's exit code was nearly lost.** It was invoked as `npm run e2e:prod > log 2>&1; echo
"E2E_EXIT=$?"`, so the *task's* reported exit code was **`echo`'s zero** while the gate had
actually exited **1**. The trailing command erases the exit code exactly the way a pipe does.
Run 2 was invoked with no trailing statement so the reported code is the gate's own.

### The three real failures, all AE3's — E2E specs still reading the moved columns

| spec | what it did | fix |
| --- | --- | --- |
| `aff4-registration-dates.spec.ts:126` | `svcSelect('profiles', '…select=date_of_birth')` | → `profile_private_details`, key `profile_id` |
| `aff2-scope-rule.spec.ts:114` | `GET /profiles?id=eq.X&select=cpf` | → `profile_private_details?profile_id=eq.X` |
| `aff-hospital-affiliation.spec.ts:577` | **PATCH** `profiles?id=eq.DESATIVADO` setting `cpf` | → **POST upsert** (`Prefer: resolution=merge-duplicates`) |

⛔ **The third is the seed trap again, in its third costume.** That persona has no
`profile_private_details` row — the spec's own comment says it carries no seeded CPF. A
re-pointed **PATCH matches zero rows, writes nothing, and PostgREST answers 204**, so
`res.ok()` stays true, the fixture reports success, and the test then fails downstream *looking
like a product defect*. The cleanup is a **delete by identity**, not a `cpf: null`: the persona
had no row before, so deleting restores the exact prior state, whereas an all-null row would
newly assert "this person HAS restricted details on file" — which is what a row in this table
means for a data-subject request.

### AE3.3's own spec — `e2e/ae3-restricted-details.spec.ts`, 4 tests, green

- **D4 (roster)** — no raw CPF and no phone anywhere in the directory's payload, checked against
  **every** CPF/phone currently on file (derived, never a hardcoded list) and asserted on
  `page.content()` rather than a visible locator, because a value in the RSC flight payload that
  is never painted is exactly the leak this gate exists to catch.
- **D4 (detail)** — the masked form `111.•••.•77-35` is PRESENT and the raw digits, including
  4–7, are absent. Both halves: absence alone is satisfiable by a broken page.
- ⭐ **The reachability twin** — search for a person known to hold a CPF and assert the page
  really lists them. Without it the sweep passes on an empty roster, a 404, or a redirect to
  `/login`.
- **AUDIT** — one directory CPF search emits exactly ONE `person.cpf_lookup` row (before/after
  delta, never an absolute count), and its metadata carries no digits.
- **KBD** — the CPF field is reached by `Tab` alone (not `.focus()`, which is not auto-waiting
  and would bypass the very tab-order under test), masks as you type, and submits on `Enter`.

### Flaky classification — by NAME + fingerprint, never by count (plan rule 11)

Run 2's five: `act-role-assumption:157` and `phase2-auth-shell:268` are the two established
`FUP-E2E-REPEAT-FLAKY` members, both to fingerprint. The other three —
`case-patient:433`, `ff3-validations:2079`, `phase7-cases:539` — are **novel names**, none
AE3-relevant, all passing on retry.

⚠ **A first count of six was WRONG and is recorded rather than quietly corrected.** Batch 2's
first attempt was classified INFRA (`server_dead=1, conn_errors=33`) and **re-run**; the
extractor read the discarded attempt's flaky line beside the re-run's. The gate's own per-batch
figures sum to 5 and are right. *A census whose parts do not sum is wrong* — here the parts
summing is what found the error.

⭐⭐ **Across the two runs the flake population CHURNED**: 2 stable names, 5 one-shot names, zero
overlap between the two one-shot sets. Filed as `FUP-E2E-AE3-TWO-NOVEL-FLAKES`, including the
consequence that a **name-keyed** baseline cannot represent a churning population — which is a
gap in rule 11's instrument, not a verdict on these tests.

## QA round 1 — `CHANGES REQUESTED`, and the response

Review: [`docs/reviews/authz-ae3-review.md`](../reviews/authz-ae3-review.md), 2026-08-31,
performed on **Fable** (user-assigned; CLAUDE.md §4 forbids agent-selecting it). Read-only on
app code, as the role requires. It confirmed independently — against the live catalog, not this
record — that the census closes at the corrected grain, the CHECK and partial index **moved**
rather than being re-typed, the door-only posture is real, the guard was retired **and**
replaced, both mutation cases are genuine proofs, and **no test was weakened to pass**.

Three blocking findings, **all documentation, no code/schema/test change requested**. All three
addressed:

**B1 — the DSR/LGPD linkage the plan's Gate AE3 line requires did not exist.** Measured: zero
DSR documents mentioned `profile_private_details`. Added to
[`docs/plans/dsr-workflow-plan.md`](../plans/dsr-workflow-plan.md) § 3, which is the
*out-of-scope* section and therefore where a reader asking "where do professional CPF requests
go?" actually lands — that program's subject is the **patient**. The pointer states the three
things an operator would otherwise get wrong: **row existence IS the "has data on file" fact**
(so a deletion discharge is a `DELETE`, not nulling columns, and a missing row answers "nothing
on file", never "person not found"); ⛔ **CPF is NOT consolidated** — `professional_profiles.cpf`
is a separate Class-2 column AE3 did not move, so a CPF request must consider **both** relations;
and AE3 moved **storage, not authority**. Every factual claim in it was verified against the
catalog before writing (FK `confdeltype = 'c'`, both relations present, `redact_professional_profile`
live).

**B2 — the rollback artifact's command contradicted its own handling rule.** The runbook told
the operator to encrypt at creation while the command it gave them wrote a **plaintext** CSV of
every CPF/DOB/phone into the working directory. Now a single pipeline into `gpg --symmetric`
writing outside the repo, plus a decrypt-verify step — *the safe path is the typed path*. ⭐ The
old shape put the safeguard in prose the operator must remember under maintenance-window
pressure, at the moment they are least able to.

**B3 — "filed rather than fixed" was untrue, and chasing it found a bigger drift.** See the
corrected paragraph under *Gate AE3 — step 1*. Short version: the banner's `407` was a **frozen
literal**, the live figure is **427**, the register's own **426** had also drifted, and the fix
was to make `ARM=census` **derive** the count from the predicate that defines the class — so the
figure and the class can never disagree again.

**Non-blocking N3 and N4 were also fixed now, not deferred**, because both are text *this phase
wrote* and both are the stale-assertion class: pgTAP `301` §6.1/§6.2 descriptions still said "on
profiles" / "a column privilege" while the statements beneath them targeted
`profile_private_details` under a table-level absence; and `e2e/ae3-restricted-details.spec.ts`
now states that D4's **aggregate** and **session-context** cells are discharged by **consumer
absence**, not by measurement — so a future author adding either knows they owe a cell.
**N1 and N2 were then also done** (PO instruction, 2026-08-31 — they had been deferred to the
Record step as their normal cadence):

- **N1 `docs/backend-state.md`** — found by PROPERTY (every claim about the moved columns), not by
  walking QA's line numbers, so a stale line QA had not enumerated could not survive. Five
  corrections plus a new first-class **§ AE3** section: the AFF2 block carries a superseded banner
  rather than being rewritten (it is a *dated record*); `list_org_people`'s payload source is
  corrected while noting its signature/ACL/audit are unchanged; the person-key and column-grant
  rule is re-based — ⛔ the old rule *"the withheld set must be exactly `{cpf}`"* is now **false**,
  that set is **EMPTY**, and `301` §0.10a/§0.10b say so executably; the guard-rewrite sentence
  records that AE3 **reversed** its last clause for the same late-binding reason; and
  `professional_profiles` gains an explicit "this is a DIFFERENT cpf" note, re-verified unchanged in
  the catalog (⛔ it was NOT stale — QA flagged it precautionarily, and that reading was correct to
  check).
- **N2 `ARCHITECTURE.md`** — the zero-policy class enumeration named only the three PHI stores. It
  now names all eight members, marks `profile_private_details` as the first **restricted-personal-data**
  (non-PHI) member, and ⛔ says outright that **the prose list is not the authority** — pgTAP `382`
  § A0 derives the membership and reds when it changes. The derived set was measured and matches
  the eight written.

Every figure asserted in the new backend-state section was verified against the catalog or the
suite before writing (plan counts `301`=44 / `359`=30 / `382`=83; FK `ON DELETE CASCADE`;
`updated_at NOT NULL DEFAULT now()`; the 8-member derived zero-policy set).

**Re-verified after the QA fixes** (the harness itself changed, so the arms were re-run):

| gate | result |
| --- | --- |
| `ARM=census` / `hat` / `floor` / `FROMFINDINGS=1 ARM=wrapper` | all **INVARIANT HOLDS**, exit 0; census banner now prints **427, DERIVED this run** |
| `npm run lint` | **11/11**, exit 0 |
| `npm run typecheck` | 0 errors |
| `npm run test:db` on a **fresh `db reset`** | **248 files / 8285 tests, PASS**, exit 0 |
| `e2e/ae3-restricted-details.spec.ts` | 4 passed, 0 failed, exit 0 |

⚠ **A re-review is owed** — QA's verdict was `CHANGES REQUESTED`, and §6 step 3 loops changes
back to step 1. Nothing here may be recorded as `APPROVED` on the strength of this response.

## QA round 2 — `CHANGES REQUESTED`, and the response

Round 2 confirmed B1, B3, N1, N3 and N4 as fixed — **and independently executed my B3 derivation
query**, returning 427 = 345 `public` + 82 `app`, so the predicate I replaced the frozen literal
with is the right one. It found **three new blocking items**, two of which were errors *in the
round-1 fixes themselves*.

**B4 — the register contradicted itself about the very figure B3 had just corrected.** PROGRESS.md
§ Now announced **427** in one clause and cited "C2's **426** command doors" in another; the C2 row
carried the new headline beside the **old decomposition** (`344` + `82`, which sums to 426). ⛔ This
is *fixing a claim's direction without re-deriving its magnitude* — the headline was updated and the
parts underneath it were not, which reads as a completed correction. Now 427 = **345** + 82, with
the catch noted in the row so the next reader sees that the parts are the thing to check.

**B5 — the rollback snapshot targeted the WRONG DATABASE, and round 1 had looked straight at it.**
The command was `docker exec supabase_db_<ref> psql …` — **the local container**. This runbook's
cutover applies to the linked Cloud project, which has no container to exec into. An operator
following it would have produced a correctly-encrypted, confidently-verified artifact **of their
local stack**, and found out only when a rollback restored nothing. ⛔ Worse under B2's own
standard: B2 made the safe path the typed path, and the typed path pointed somewhere else.
⚠ **Round 1 reviewed this exact command and flagged only the plaintext** — the shape survived a
review, which is why the fix now states the constraint (`⛔ NOT 127.0.0.1:54322. If this string
contains "localhost", STOP`) and adds a **binding check**: the artifact's row count must equal the
**remote's** `profiles` count. A verify step that only proves "it decrypts" cannot catch a
right-shaped artifact of the wrong database.

**B6 — my ARCHITECTURE.md rewrite listed NINE tables for a class I labelled as eight.**
`event_patient` is a PHI store but carries a live `event_patient_select` policy, so it has never
been in `382` § A0's derived set. The old prose made the same error; my rewrite carried it forward
*and added the count and the "§ A0 is the authority" sentence that expose it*.

⛔ **This one is mine, and the mechanism is worth naming.** I ran the deriving query, saw `8`, and
wrote *"the derived set matches exactly"* — **comparing the COUNT, not the NAMES.** My list had
nine entries; a count check cannot see a wrong member beside a missing one, and here there was no
missing one to make the totals disagree. The verification is now element-wise (each derived name
must appear, `event_patient` must not), which is the check I should have run the first time and had
already written into `382` § A0 as the reason that assertion exists.

Fixed, plus the three non-blocking items: the decrypt-verify no longer prints a real person's row
(**counts, never rows** — `head -2` renders a live CPF/DOB/phone into scrollback and any
screen-share of the window); the follow-ups C2 chain now ends at 427 and says why it ends; and the
AFF2 banner's "the guard itself is untouched" is made precise (the *trigger* was not dropped and
its other arms were not edited — the body obviously was).

**`FUP-EVENT-PATIENT-POLICY-PREEMPTED` filed** (index + body) for QA's out-of-scope observation:
`event_patient`'s policy never runs, because `authenticated` holds no table grant and table
privilege is checked before RLS. ⛔ Nothing is exposed today — it is filed because a future
`grant select` would not merely open the table, it would **silently arm a predicate nobody has
re-evaluated**, and the reviewer of that grant would be looking at a table that *has* a policy.
⚠ It sits in a blind spot between two individually-correct instruments: `382` § A0 derives the
ZERO-policy set (so this is rightly outside it) and the door arms bound on reachability —
**no arm asks whether a policy is pre-empted by its own grant**, and the general property is owed.

**Re-verified after round 2:** `npm run lint` 11/11, exit 0; the ARCHITECTURE list checked
element-wise against the live derived set (8/8 present, `event_patient` absent).

## QA round 3 — `CHANGES REQUESTED`, and the response

Round 3 closed all three round-2 items with independent verification (it re-derived the
zero-policy set by NAME, and re-tested the `event_patient` FUP's premise one grain deeper than
its own round-2 measurement: zero **column** grants, zero positively-selectable columns, so
"pre-empted dead code" holds at both grains). ⭐ It also recorded that **its own round-2 suggestion
was worse than what I did**: `$SUPABASE_DB_URL`, unset, hands `psql` an empty string, which falls
back to libpq defaults — a *quiet local connect*, which is the exact failure B5 was about.

Two new blocking items, **both again in the previous round's fix text**:

**B7 — my B5 fix persisted the production password to disk.** `REMOTE_DB_URL='postgresql://…:<password>@…'`
typed interactively lands in shell history: plaintext, indefinitely, **on the machine the artifact
is required to leave**. ⛔ **Third instance of B2's class** — a rule the command contradicts is not
a rule — and each instance has been inside the fix for the previous one. Now `read -rsp`, plus a
stated home and lifetime for the gpg passphrase, plus **rotate the DB password after the window**
(it was typed on a workstation during an incident-shaped procedure; treat it as exposed rather
than reasoning about whether it was).

⭐ Round 3 also found an **accidental failsafe worth keeping deliberately**: post-AE3, aiming the
snapshot at the local stack now fails loudly with `42703 column "cpf" does not exist`. Recorded in
the runbook as a *backstop* — ⚠ it holds only while the local stack is post-AE3, so it is never the
reason the explicit guard can be skipped.

**B8 — the fourth live copy of the stale figure was in the PLAN, and it was teaching from it.**
`docs/plans/authz-evolution.md` **rule 2** — the rule that *requires* stating the structurally
uncovered population beside the covered one — said "the **407** reachable command doors". A rule
about stating a population, citing a number 20 stale, in the document governing the phases doing
the stating. Rule 1 likewise said "lint (**all ten**)" for an eleven-gate chain. Both now name
their deriving instrument instead of a figure (the banner; `package.json`), tagged `[QA-AE3-r3 B8]`
in the plan's own in-place correction convention rather than edited silently. ⚠ I verified the
chain length rather than trusting QA's "eleven": `package.json`'s `lint` has 10 `&&`, so 11
commands.

Non-blocking: ⛔ **"the follow-ups body's running-prose 407s are fixed" was HALF TRUE when this
paragraph first said it** — QA r4 (R4.3) measured it: two of the six enumerated lines were fixed
and four were not. The likely cause was a shorthand reading of the finding (the two *literal*
"the 407" phrases were indeed gone) — but the line numbers were the spec, and *"also fixed"* is
the kind of closing clause nobody re-checks. **Discharged in full at r4** and by PROPERTY this
time, not by line number: every remaining `407` in that file is now either the dated header chain,
the **explicitly dated** 2026-08-17 snapshot table (which was the root — live prose was restating
its cells), a verbatim quotation of the item's original scope, or an unrelated line range in a
component path. The two workstream labels QA noted but did not press (`the 407-door sweep`) are
renamed too. Also fixed at r3: the `event_patient` clause, which said it "belongs to the DEFINER-write-door bullet" — ⛔ **it belongs to neither
bullet.** That bullet's property is *`authenticated` holds SELECT only*; `event_patient` holds
**nothing at all**. It is its own shape — a policy plus no grant — which is precisely what
`FUP-EVENT-PATIENT-POLICY-PREEMPTED` exists to resolve.

**The pattern, stated because it is the finding across all three rounds:** every round's blocking
items have been in the *previous round's fix text* — B5/B6 inside the B1–B3 fixes, B7/B8 inside
the B4–B6 fixes. Fixes are not safer than original work; they are written faster, under a sense of
closing something, and reviewed against the finding rather than against the tree. ⭐ The trend is
nonetheless converging — 3 blocking → 3 → 2, each narrower, this round's a few lines each.

**Re-verified after round 3:** `npm run lint` **11/11, exit 0** (read directly, not through a pipe).

## QA round 4 — ✅ **APPROVED**, with one binding Record-step obligation (discharged)

Round 4 confirmed B7 and B8 fixed. It read § 4.1 end-to-end **cold, as the 2am operator** rather
than as a diff against its own finding, and found nothing new: every identified mis-execution mode
now fails loudly, and ⭐ a lost passphrase is discovered at the **verify** step — *before* the
migration runs, while the snapshot can still be retaken. It also ruled the `[QA-AE3-r3 B8]` tag
form **acceptable** after reading ADR 0162's actual scope: 0162 exists for corrections that amend
ADR-family *decisions*, and these edits change no decision — they repair citation hygiene. ⛔ The
boundary it stated stands: anything changing what the program *decides* still owes the 0162 path.

**The one discrepancy was in this record, not in the code** — see the corrected sentence in round
3 above. QA ruled it non-blocking on a calibration it argued in the open (every figure *of record*
was correct; the residue was hedged forward-looking prose; blocking a phase on it would have been
the escalation failure mode) and converted it into a **MUST at the Record step**. ⭐ **It is
discharged now instead**, so the Record step does not inherit it.

⭐ **The three-round pattern broke.** Rounds 2 and 3 each found their blocking items inside the
previous round's fix text; round 4, aimed deliberately at the round-3 fixes, found none there.
**3 blocking → 3 → 2 → 0.**

⚠ **The approval is conditional in one direction only:** it was written against a tree where the
R4.4 obligation was still open. That obligation is now discharged by the same property-based sweep
described above, and the discharge is recorded here rather than asserted in a commit message.

## Still owed at this point

- **QA re-review** (round 1 was `CHANGES REQUESTED`; B1/B2/B3 + N3/N4 addressed above).
- PO approval, then the Record step. ⭐ N1/N2 are **done**, so the Record step no longer owes them.
