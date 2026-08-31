# QA review — Phase AE3: Restricted personal-detail extraction (ADR 0155 D4)

- **Branch:** `authz-ae3-private-details` · **Reviewed:** 2026-08-31 · **Reviewer:** `qa`
- **Contract:** [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § "Phase AE3"
  (authority ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md)
  D4, as amended G2/G3); increment record
  [`docs/progress/authz-ae3.md`](../progress/authz-ae3.md).
- **Method:** every schema/RLS/grant claim below was re-derived from the **live catalog**
  (`pg_class` / `pg_policies` / `pg_policy` / `pg_proc` incl. `prosecdef` / `pg_constraint` /
  `pg_index` / `pg_trigger` / `pg_depend`, privileges asserted positively via
  `has_table_privilege`), never from migration text. The local stack was audited **read-only**
  in the state the phase left it (freshly rebuilt from migrations + seed per the gate record,
  followed only by E2E, which mutates no catalog object). Application-side claims were
  re-derived by sweeping `src/` + `e2e/` for the census property *"names the column ANYWHERE
  in the query"*, and every changed test file was read as a `git diff main`.

---

## 1. Independent catalog audit — figures enumerated, not exit codes

| question | measured | verdict |
| --- | --- | --- |
| Columns gone from `profiles` | `pg_attribute` / `information_schema.columns`: **0** of {`cpf`,`date_of_birth`,`phone`} remain | ✅ |
| New table shape | `profile_private_details(profile_id uuid PK→profiles ON DELETE CASCADE, cpf text, date_of_birth date, phone text, updated_at timestamptz not null default now())` | ✅ matches plan AE3.2.1 |
| CHECK **moved, not re-typed** | live def `CHECK (((cpf IS NULL) OR app.is_valid_cpf(cpf)))` — byte-equal in substance to `profiles_cpf_valid` (`20260909000200:115-116`), calling the **same** `app.is_valid_cpf`, not a copy | ✅ |
| Unique index **moved, PARTIAL preserved** | `CREATE UNIQUE INDEX profile_private_details_cpf_key … USING btree (cpf) WHERE (cpf IS NOT NULL)` — same shape as `profiles_cpf_key` (`20260909000200:119-121`); **not** a re-typed plain `unique` | ✅ |
| RLS | `relrowsecurity = t`, **0** rows in both `pg_policy` and `pg_policies` for the table | ✅ |
| Grants — positive assertion | `has_table_privilege` for SELECT/INSERT/UPDATE/DELETE: `authenticated` **f/f/f/f**, `anon` **f/f/f/f**, `service_role` t/t/t/t. `role_table_grants` lists only `postgres` + `service_role` (14 rows) | ✅ door-only, per rule 4 of the brief — asserted, not inferred from an empty ACL |
| Guard trigger | `guard_profile_privileged_columns_trg` still `BEFORE UPDATE` on `profiles`; live body (read via `pg_get_functiondef`) carries **no** identity disjunct for the three moved columns; remaining arms (`suspended_until`, `email_confirmed_at`, `professional_category_id`, `must_change_password`), the privilege limb, and the CNV-5 demotion backstop all intact | ✅ retired **and** replaced (see §3) |
| Triggers on `profiles` | exactly **2** (`guard_profile_no_delete_trg`, `guard_profile_privileged_columns_trg`), matching census §6 | ✅ |
| Views | **0** `pg_rewrite` entries depend on `profile_private_details` **or on `profiles` at all**; additionally the `006800` drop ran **without `CASCADE`**, so any missed view dependency would have failed the migration loudly — the "0 views" census claim is now structurally guaranteed, not merely swept | ✅ |

## 2. The census, re-derived — it closes

**SQL side.** A comment-stripped `prosrc` sweep (`regexp_replace(prosrc,'--[^\n]*','','g')`,
word-bounded) over all non-system schemas returns **16** functions naming a restricted token.
I read the token-bearing line of each:

- **4** now read/write `profile_private_details` — `app.finalize_invited_person_impl`,
  `app.update_person_fields_impl`, `public.get_own_person_record`, `public.list_org_people`
  (all `prosecdef = t`). These are exactly the census's re-point set; **no other function
  references the new table** (independent sweep for `profile_private_details` in `prosrc`
  returned only these 4).
- **12** touch other relations' same-named columns: patient-PHI jsonb keys and tables
  (`set_event_patient`, `set_referral_patient`, `create_case`/`bulk_create_cases`/
  `create_case_from_template`, `app._set_participant_patient_unchecked`,
  `app.assert_patient_required_fields`, `app.patient_required_missing`,
  `set_template_patient_mode`), `professional_profiles` (`redact_professional_profile`), an
  enum label (`issue_ethics_notification`), and audit copy (`log_cpf_probe_for`). **None
  references `profiles`' dropped columns.** This matters more than usual because plpgsql is
  late-bound: a missed consumer would have survived migration and failed only at runtime.
- The 5th census consumer, `guard_profile_privileged_columns`, correctly no longer matches
  the token sweep at all (arms removed).
- `pg_policies` `qual`/`with_check` token sweep: **0** rows. Matches census §4.

**TS side** — swept at the census's **corrected** grain (*names the column anywhere in the
query*, the exact grain the §8b error was about):

- No `.from('profiles')` site in `src/` or `e2e/` names any restricted column within a
  15-line window (select list, filter, order, or payload).
- The previously-missed collision probe (`users/actions.ts:726` `.eq('cpf', …)`) now reads
  `profile_private_details` and selects `profile_id`.
- The three §8a service sites are re-pointed: `actions.ts:~1134` (change-detection read),
  `person-footprint.ts:~637` (`getPersonAdminView`), `actions.ts:~724` (collision probe).
  `getPersonAdminView`'s existence check is genuinely split onto `profiles.select('id')` —
  defect 1 of the increment record is real and really fixed.
- Generated types: `profiles` Row block carries none of the three; `profile_private_details`
  present (`database.ts:8614`).
- E2E fixtures: no remaining `profiles?…cpf|date_of_birth|phone` REST call; the three broken
  specs named in the record are re-pointed (verified in diff — see §4).

**Verdict: the census is closed on both sides at the corrected grain.** The scope-trap
handling (§0: `professional_profiles.cpf` and the three patient-PHI `date_of_birth` columns
explicitly out of scope; "CPF lives in one place" declared FALSE post-AE3) is correct and
survived into the migration header and runbook §5.

## 3. The guard trigger — retired AND replaced

Retirement: live body names none of the three (asserted with the same comment-stripped
predicate pgTAP 359 §3.2 now uses — the body's prose *discusses* the move, so an
uncommented regex would false-positive; the test strips comments correctly). Remaining arms
proven to still bite by 359 §3.3 (23514 on `must_change_password`) with attribution twin
§3.4. Replacement: the refusal moved one layer earlier (42501, absent table grant), asserted
by 359 §3.5/3.6 and 382 C17–C20, and proven **able to fail** by mutation case B. The swap is
stated in the tests rather than silently absorbed, including the deliberate SQLSTATE change
(23514 → 42501) with its reason.

## 4. Tests — was anything weakened to pass?

I read the full `git diff main` for all 8 pgTAP suites, both vitest mock files, the seed,
and all 4 touched E2E specs. **No assertion was weakened.** Notable checks:

- **359** (subject moved wholesale): every retired assertion has a named successor, mostly
  stronger — §0 asserts the move as a pair (gone-from + present-on, so a bare DROP can't
  satisfy it); old 1.3's cpf-differential is replaced by an all-columns
  `has_column_privilege` derivation (covers future columns without a name list); §2 gains
  the reachability twin (2.6/2.7: `get_own_person_record` still returns the values — without
  which the section is satisfiable by a broken product); §6.4 pins the index's **partial**
  shape from `pg_index.indpred`, exactly the re-typing trap the brief names. Lost cell,
  judged acceptable: old 3.3's *different-principal* (org_admin) refusal has no direct
  successor — the replacement control is a table-level grant absence, which is
  principal-independent by construction, so the cell is subsumed.
- **301 §0.10**: the executable column-grant rule is retired as **0.10a** (an executable
  assertion that the withheld set on `profiles` is now empty — it reds if a second,
  undocumented mechanism reappears) and replaced by **0.10b**, a hand-list tripwire over
  every `profile_private_details` column with per-member rationale. Both halves executable;
  nothing deleted without successor. §6.2b honestly pins the one behavior AE3 *widened in
  appearance* (`select *` on `profiles` now succeeds) with the correct argument that it
  returns only always-readable columns.
- **382**: the new table enters as the 8th member with full four-verb runtime coverage
  (matching the PHI tables, not the one-verb group), an `anon` SELECT cell argued
  specifically (pre-login enumeration-oracle risk), and — decisively — the **§A0 set-closure
  derivation** now expects 8, so the membership claim in the increment record ("pgTAP 382
  pins the zero-policy set membership") is true in the strong, derived sense.
- **386 §3.4**: same SQLSTATE, different mechanism — the diff states this explicitly instead
  of leaving the expectation coincidentally green, and notes it *did* red at 42703 when left
  pointing at `profiles` (SQLSTATE pinning working as designed).
- **385**: pure re-points; 4.2 becomes a two-relation LEFT JOIN concatenation where a missing
  private-details row yields NULL ≠ expected → red, correctly.
- **361 / 393 / seed / 301 §2**: every re-pointed write is an **upsert or insert**, never a
  re-pointed UPDATE — the "UPDATE against a missing row writes nothing and raises nothing"
  trap is closed in all four places plus the seed (which would otherwise have seeded zero
  CPFs and made every CPF keystone vacuous). Verified in each diff.
- **Vitest mocks**: fixtures split to mirror the two-table substrate; `person-admin-view`
  gains a projection-narrowness arm on the new table (`select *` forbidden, exactly one
  read, `cpf` must not ride on the `profiles` read) — an added assertion, not a relaxation.
  `d14-person-level`'s queue collapse (`[null, null]` → `[null]` + separate table) is
  correct and the comment explains why the stale form would have silently collided.
- **Plan-count arithmetic**: 301 41→44, 359 21→30, 382 72→83 = **+23**, matching the gate
  record's pgTAP delta (8262→8285) exactly; no other suite changed its plan.

## 5. The two targeted mutation cases — judged by reading (not executed, per mandate)

**Case A is a real proof.** The mutation forces `v_identity_changed := false` via a
functiondef rewrite (single occurrence of the anchor string in the live body — verified);
359 §3.3 must then red (the `must_change_password` `throws_ok` becomes a live update).
Fingerprint (md5 of `pg_get_functiondef`) is asserted **moved** after mutation and
**returned** after restore, and the suite is re-run green post-restore — both halves of the
rollback lesson. The container-filesystem `-f` incident is recorded in the script with the
fix (`-f -` + host redirect).

**Case B is a real proof.** The grant genuinely re-opens what AE3 closed; 382 (B29–B31,
C17–C19, §A0) and 359 (§1, §2, §3.5/3.6) each have multiple assertions that must red under
it. Precondition, landing, and restore all asserted via `has_table_privilege::text` (with the
`false` vs `f` trap documented from its own first failure).

**One residual, non-blocking:** `run_suite` counts *any* non-PASS as red, so a transient
infra failure during the mutated run alone would report COVERED falsely. The post-restore
green bounds this (a broken runner would fail there and abort), but only if the blip is
persistent. Worth a one-line comment in the harness someday; not worth blocking.

**The door-sweep exit-1 ruling is sound.** I verified the substance of all five per-function
rulings against the live catalog: the two `_impl` kernels' gates
(`app.can_administer_person_for` arms) and `list_org_people`'s inline predicate are in the
standing sweep's domain and unchanged by AE3 (the census §9 parity table and the diff show
only relation re-points); `get_own_person_record`'s gate is self-scoping; the guard is the
one changed predicate and, returning `trigger`, is genuinely unreachable by the
predicate-neutralizing arm — the targeted case is the correct discharge shape, and treating
exit 1 as a finding to rule on rather than a pass follows ADR 0079 Amdt 8 ruling 2.

## 6. `e2e/ae3-restricted-details.spec.ts` — the D4 assertion is not vacuous

- The roster sweep asserts over the **derived population** of every CPF/phone on file, with
  an explicit non-vacuity guard (`cpfs.length > 0`), against `page.content()` (RSC flight
  payload included), plus the **reachability twin** (search a known CPF-holder, assert they
  are listed, then assert their raw CPF is still absent *on the page that lists them*). This
  defeats the empty-roster / 404 / login-redirect vacuities.
- The detail test asserts **both halves** (masked form present, raw digits and hidden digits
  4–7 absent).
- The audit test is a before/after **delta** of `person.cpf_lookup` (exactly 1), with a
  no-digits-in-metadata assertion, and it waits for the search to resolve before reading the
  delta.
- The keyboard test reaches the field by bounded `Tab` loop (not `.focus()`) and submits by
  `Enter`.

**On D4's full clause** ("list / **aggregate / session-context** outputs"): the spec measures
the list and detail surfaces. The aggregate and session-context cells are discharged
**structurally rather than measured**: the census found zero aggregate or session-context
consumers of the three fields anywhere (no view, no policy, no query site outside the three
person-scoped service reads and the doors), so there is no code path for such a leak short
of someone adding a consumer — at which point the census property, 382 §A0, and the vitest
projection arm are the tripwires. I judge this sufficient, but it should be *stated* that
way rather than left implicit — see finding N4.

## 7. LGPD (the plan's explicit note) — this section is that note

**`public.profile_private_details` is now the single LGPD data-subject-request pointer for a
professional's CPF, date of birth, and personal phone.** Its semantics matter for DSR work:
*a row's existence itself asserts "this person has restricted details on file"* (the
backfill materializes rows only when at least one value exists, and the E2E cleanup
correctly deletes-by-identity rather than leaving an all-null row for exactly this reason).
The table comment declares the DSR-pointer role.

Two facts the DSR lane must absorb, verified by a full-corpus sweep (ADRs 0035/0130/0131/
0132, `dsr-workflow-plan.md`, `dsr-operational-remediation.md`, `dsr-program.md`,
backend-state DSR sections):

1. The existing DSR machinery is **patient-keyed by construction** (`dsr_requests.patient_key`
   NOT NULL; ADR 0131) and never pointed at `profiles.cpf` — so nothing there went *stale*.
   Professional data subjects exercise Art. 18 **administratively** (ADR 0133 Amdt 1 r5,
   out-of-DSR-scope by design, discharged via `/conta` "Meus dados" / `get_own_person_record`
   per ADR 0151).
2. **No LGPD/DSR document anywhere names `profile_private_details`.** The plan's Gate AE3
   line requires exactly this link ("the extraction is the DSR pointer table now — link it
   from the DSR docs"), ADR 0155's consequences section anticipates the workstream, and the
   phase's own record lists it as owed. It is still owed → finding **B1**.

The cutover runbook's rollback artifact is a CSV of all three restricted fields; its handling
paragraph is right, but the command is not → finding **B2**.

## 8. Known open items — rulings assessed

- **Door sweep exit 1** — honestly recorded as a finding, correctly ruled, correctly
  discharged (§5). Accepted.
- **Rules glob narrowing** (`mutation/**` → `mutation/*.sh`) — verified: the 5 files dropped
  from scope are static `.txt` allowlist/backlog data; both rules govern *harness execution*
  (kill safety, baseline currency), and every harness is `.sh`. Residual: a session editing
  only an allowlist `.txt` no longer loads either rule — acceptable, since allowlist edits
  occur in the course of running a harness whose `.sh` is in scope, and the alternative
  (`broad:`) measurably does not fit the size cap. The reasoning is recorded in
  `authz-ae3.md` where the cap forbids it living in the files. Accepted.
- **`FUP-E2E-AE3-TWO-NOVEL-FLAKES`** — filed with entry criteria, refuses one-sighting
  baseline growth, and names the rule-11 instrument gap (name-keyed baseline vs churning
  population) as the finding. Exemplary. Accepted.
- **Stale 407 banner** — the *population correction* (426) is recorded in the C2 FUP and in
  § Now, but the increment record's claim that the stale banner string was "**filed** rather
  than fixed" is **not discharged**: no FUP index line, no follow-ups body line, no
  PROGRESS.md line names the harness banner. As it stands the only witness is a sentence in
  `authz-ae3.md`, which is exactly the invisible-work shape QA finding R3 was about →
  finding **B3**.

## 9. Code quality / conventions (spot-audited)

Typecheck and the 11-gate lint chain are recorded PASS with enumerations; I did not re-run
them (shared stack). The re-pointed app code keeps the Rule 9 exception honest: the
`person-footprint.ts` header docstring was **rewritten, not left stale** — it now derives the
exception from the door-only table rather than the retired column-grant conjunction, and
correctly claims the new mechanism is stronger (the old one was an unstated two-fact
conjunction; the new one is a relation). The migration comments I read (006600, 006800) are
accurate against the catalog, including the candid "verification passes VACUOUSLY on a fresh
local reset" admission with the pgTAP + cutover-runbook compensations. pt-BR user-facing
strings unaffected (error copy unchanged; masked-CPF rendering asserted in E2E).

## 10. Could not verify — stated, not implied

1. **The backfill's real work.** On every local stack it matches zero rows by design; the
   keyed per-row `IS NOT DISTINCT FROM` verification (which does satisfy PA-F2/G2's
   requirement, raise-on-first-mismatch, no values in the message) will first do real work at
   the remote push. The runbook's step 2.4 ("read the notice; 0 rows against a populated
   `profiles` ⇒ stop") is the compensating control. Nothing further is verifiable pre-cutover.
2. **Gate figures** (lint/vitest/pgTAP/ARM counts, both E2E runs) — accepted from the
   increment record, which records enumerations rather than exit codes and documents its own
   near-miss (`echo "E2E_EXIT=$?"` erasing run 1's exit code). Not re-run: re-running
   `test:db` requires a `db reset` on the shared stack, which this review was forbidden.
3. **The mutation harness's recorded run** (fingerprints `fa562686…`→`0f750720…`→back) —
   judged by reading only, per mandate; the script's structure makes a fabricated COVERED
   verdict hard (landing + restore both asserted), but I did not re-execute it.
4. **G2 remote figures** (36 / 0 non-test) — not re-measured here; they carry their own
   expiry and the runbook re-measures them as precondition 1, which is the correct place.

---

## Findings

### Blocking (loop to step 1; all are documentation — no code, schema, or test change is requested)

- **B1 — The DSR/LGPD linkage the plan's Gate AE3 requires does not exist.** Requirement:
  plan § Phase AE3, "Gate AE3: … QA review with an explicit LGPD note (the extraction is the
  DSR pointer table now — **link it from the DSR docs**)"; also ADR 0155 D4 ("gives LGPD/DSR
  work a single table to point at"). Measured: zero LGPD/DSR documents mention
  `profile_private_details`. Required: a short pointer in the DSR corpus — the natural homes
  are ADR 0130's professional-subject boundary (or an amendment note) and/or
  `docs/plans/dsr-workflow-plan.md` — stating that professional restricted-detail requests
  (Art. 18: access/rectification/deletion of CPF/DOB/phone) resolve to
  `public.profile_private_details`, that **row existence is itself the "has data on file"
  fact**, and that the administrative (non-DSR-workflow) discharge path of ADR 0133 Amdt 1
  r5 / ADR 0151 is unchanged.
- **B2 — The rollback artifact's command contradicts its own handling rule**
  (`docs/deployment/ae3-cutover-runbook.md` §4.1). Requirement: the runbook's own paragraph
  ("encrypt **at creation**, store off the app host, destroy, record destruction") and the
  Rule 12-adjacent handling discipline it cites. Measured: the command as written produces a
  **plaintext** `ae3-preimage.csv` of every CPF/DOB/phone in the working directory; the
  encryption is prose the operator must remember under maintenance-window pressure. Required:
  make the command itself produce a protected artifact (pipe through `gpg -c`/`age`, or at
  minimum write to a named non-repo location with the encrypt step as an explicit numbered
  command), so the safe path is the typed path.
- **B3 — The "filed" claim for the stale ARM-banner figure is untrue as recorded.**
  Requirement: PROGRESS.md contract / QA finding R3 (a follow-up with no register line is
  invisible work) and the increment record's own sentence ("The script's string is stale;
  **filed** rather than fixed here" — `authz-ae3.md`). Measured: no FUP line, follow-ups
  entry, or PROGRESS.md line records that `p0-authz-invariant.sh`'s banner prints 407 for
  the C2 population re-derived as 426. Required: either fix the one string, or add the line
  to the register (e.g., inside the existing C2 FUP body) — and make `authz-ae3.md`'s
  sentence true either way.

### Non-blocking — bind at the Record step (listed here so the Record editor need not re-derive them)

- **N1 — `docs/backend-state.md` carries current-tense false claims** and zero mentions of
  `profile_private_details`. This is normal cadence (backend-state updates at Record), but
  the specific stale lines are: `:984-993` ("both columns exist" on `profiles`), `:1021-1025`
  (`list_org_people` reading `date_of_birth` off `profiles`), `:2984-2994` ("the set of
  columns with no `authenticated` SELECT grant must be exactly `{cpf}`" — now contradicted by
  pgTAP 301 §0.10a), `:3006`, and door/ACL cells at `:598, :601, :636, :871, :2371, :2377`.
- **N2 — `ARCHITECTURE.md`'s "audited single doors with ZERO policies" enumeration
  (~`:31-34`)** names only the three PHI stores while the derived zero-policy set (382 §A0)
  now has eight members including `profile_private_details`. Either add the new member (it is
  the first non-PHI restricted-data member of the class, worth naming) or re-scope the
  sentence to say it lists the *PHI* members of a larger class.
- **N3 — Cosmetic description drift in pgTAP 301 §6**: 6.1's description still says "on
  profiles" and 6.2's says "the lock is a column privilege" while both statements now target
  `profile_private_details` under a table-level absence. The assertions are correct; the
  strings are the stale-comment class this repo treats as assertions.
- **N4 — State the structural discharge of D4's aggregate/session-context cells** (one
  sentence in the E2E spec header or the increment record): they are covered by consumer
  absence per the census, not by a measurement — so a future aggregate consumer knows it owes
  a cell here.

### Observations (no action required)

- The mutation harness's `run_suite` cannot distinguish an infra failure from a red under
  mutation (§5); bounded by the post-restore green requirement.
- 359's old different-principal cell (org_admin refusal) is subsumed rather than reproduced;
  correct, given the replacement control is principal-independent.
- The runbook §4.3 note that the re-added columns would be "unreadable to the old build too"
  slightly overstates (the old build never read them as `authenticated`), erring safe.

---

## Verdict

The schema move, the door-only posture, the census closure, the guard swap, and the test
re-base are all **verified sound at the catalog and diff level** — nothing was weakened to
pass, both mutation cases are genuine, the D4 gate assertion is measured rather than
asserted, and the phase's self-reporting is unusually honest (its three recorded defects are
real and really fixed). The three blocking items are documentation, but each is an explicit
requirement of this phase's gate or of the phase's own recorded claims: the DSR link is named
in the plan's Gate AE3 line, the rollback artifact is restricted personal data whose written
procedure contradicts itself, and one "filed" claim is currently false.

**CHANGES REQUESTED**

---
---

# Round 2 — re-review of the B1–B3 / N1–N4 fixes (2026-08-31, same reviewer)

**Method:** everything re-derived, nothing carried forward — the tree changed since round 1
(a `db reset` ran; a script and test strings changed). Catalog claims re-measured live;
every fix read as a diff; the B3 derivation predicate executed by me against the catalog,
decomposed four ways. Same read-only mandate: no reset, no harness run, no grants.

## R2.1 — B1 (DSR/LGPD link): FIXED, and the home is sufficient

`docs/plans/dsr-workflow-plan.md` §3 now carries the pointer. Judged **sufficient without an
ADR 0130 amendment**: I swept `0130-dsr-subject-request-workflow.md` for `professional`,
`cpf`, and `profiles` — **zero occurrences** — so AE3 falsifies no sentence in it, and its
patient-keyed subject boundary (`patient_key NOT NULL`) is untouched. §3 is that program's
out-of-scope catalog, which is exactly where a different-subject-class pointer belongs; the
entry explicitly declines to decide whether professional requests enter the program's inbox
("a POINTER, not a decision"), so it creates no undecided-authority problem.

The three claims, each re-verified true: **(1)** row existence = has-data-on-file, deletion =
`DELETE` — matches the backfill's materialize-only-nonempty rule, every reader's LEFT join,
and the E2E cleanup's delete-by-identity; **(2)** CPF not consolidated —
`professional_profiles.cpf` re-measured this round: still present, still
`has_column_privilege('authenticated', …) = false`, its own `redact_professional_profile`
door intact; **(3)** storage moved, not authority — consistent with the door-sweep ruling
(gates byte-identical) and the E2E audit-delta test. The reach bullet's door list matches the
catalog's actual reader/writer set exactly.

## R2.2 — B2 (rollback artifact): the encryption fix is right; the command targets the WRONG DATABASE

The new pipeline is genuinely plaintext-never-on-disk: one pipe, `gpg --symmetric` as the
only writer, output to `$HOME` outside the repo, and the why-the-command-not-the-prose
paragraph is the correct lesson. Two residuals:

- ⛔ **NEW BLOCKING (B5): the typed command snapshots the LOCAL stack, not production.**
  `docker exec -i supabase_db_<ref> psql …` is the local Docker container pattern — the
  linked remote is Supabase Cloud and has **no docker container to exec into**. Step 2.3's
  snapshot exists to capture the REMOTE's pre-migration data (the thing `db:push` in step
  2.4 is about to change); as typed, the operator gets a confident, encrypted, verified
  artifact **of the wrong database**, which is a false control by the fix's own standard
  ("the typed path is the safe path"). Fix: connect to the linked project (e.g.
  `psql "$SUPABASE_DB_URL" -tA -c "copy (…) to stdout …" | gpg …`). ⚠ **Round 1 missed
  this** — the same `docker exec` shape was present then and I flagged only the plaintext;
  this is my error surfacing late, recorded as such.
- **N5 (non-blocking):** the decrypt-verify (`gpg --decrypt … | head -2`) prints one real
  person's CPF/DOB/phone into the terminal — scrollback and terminal logs are the "do not
  paste into a chat" class. `head -1` (header only) or `wc -l` proves the pipeline equally
  well with zero disclosure.

## R2.3 — B3 (derived banner): the predicate is RIGHT — verified empirically — but the register carry-through left two false figures

**The derivation predicate is correct.** I executed the banner's exact query myself:
**427** (**345** `public` + **82** `app`), matching the claim. Decompositions, each run
against the live catalog:

| probe | result | meaning |
| --- | --- | --- |
| `prokind` of the 427 | all **`'f'`** | dropping the historical `prokind='f'` bound is currently a no-op; a future `SECURITY DEFINER` **procedure** would now be counted — which is arguably the *correct* behavior for a command-door census, noted as a definitional widening |
| `anon`-only members (scalar) | **0** | the added `anon` disjunct changes nothing today and is more honest for a "reachable" figure |
| true-complement members the predicate misses (set-returning non-bool, `anon`-executable but not `authenticated`) | **0** | the census domain's set-returning clause keys on `authenticated` only, so such a function would be in **no** arm's domain **and** uncounted by the banner — empty today, a latent caveat on the *census domain*, not on this fix |
| set-returning non-bool DEFINERs with no `authenticated` EXECUTE | 6 | out of domain **and** unreachable — correctly excluded from a "reachable" figure |

The script diff is confined to the banner `echo` and two comments — the census's invariant
logic (live-domain derivation, accounted set, newcomer comparison) is untouched. The
historical-artifact boundary (ADRs, this review's round 1, archives keep 407 as dated
records) is the right call — those were true when written, and my round 1 is itself now a
dated record.

- ⛔ **NEW BLOCKING (B4): the live register now contradicts itself on the figure it just
  fixed.** Two instances, both in PROGRESS.md: **(a)** § Now's gate-step-1 sentence still
  reads "all outside C2's **426** command doors" while the *same line* later announces the
  427 correction; **(b)** the C2 row decomposes 427 as "**344** are `public` … **82** are
  `app`" — the parts sum to **426**, and the measured `public` count is **345** (no
  `anon`-only or non-`'f'` member exists that could reconcile 344 under the row's own
  predicate; the 344/82 split is the *previous* derivation pasted beside the new headline).
  *A census whose parts do not sum is wrong* — the repo's own lesson, in the row that
  exists to own this figure. Fix: 426→427 in the gate sentence, 344→345 in the row.
- **N6 (non-blocking):** the FUP body (`follow-ups.md:1211ff`) still reads 407/"re-derived
  426" with no 427 link in its parenthetical chain, and its Tier-1 guidance says "expect RED
  with ~407 entries". Dated-and-hedged phrasing, and the C2 index row now names the banner
  as the figure's owner — tolerable, but the next edit of that body should extend the chain
  or point at the banner.

## R2.4 — N1 (backend-state.md): verified by property; the ruling I was asked to confirm is CONFIRMED

- The five corrections and the new § AE3 are **accurate against the live catalog**, measured
  claim by claim: `profiles` has exactly **10** columns and `authenticated` holds SELECT on
  **all 10** (the "withheld set is EMPTY" reversal, matching 301 §0.10a);
  `list_org_people`'s payload DOB join is **LEFT** and its CPF probe join is **INNER**
  (asserted from comment-stripped `prosrc`); the guard/late-binding ordering narrative
  matches the migration sequence; the consumer table matches the actual reader/writer set.
- **The `:2371/:2377` ruling: CONFIRMED, not overturned.** `professional_profiles` grants
  are unchanged (`has_column_privilege('authenticated','…','cpf','SELECT') = false`,
  no table SELECT); the added disambiguation note ("a different `cpf` from the person key")
  is correct and is the right treatment.
- **Property sweep for missed claims:** I swept every `cpf`/`date_of_birth`/`phone` token in
  the file. Every remaining hit is bannered, historical-by-design (the ADR 0048 ledger
  entry, AFF section header), about another relation, or **still true** — including one
  subtle case: the AFF2 "PUSHED 2026-08-23, remote re-measured: both columns exist"
  paragraph sits *above* the new banner and keeps present tense, but it is a claim about
  the **remote**, where AE3 has not been pushed — so it is currently accurate and will be
  superseded by the cutover itself. **No missed claim found.**
- The superseded-banner treatment of the AFF2 block (dated record + per-affected-paragraph
  correction banners, matching the doc's AE2 convention) is the right treatment. **N7
  (cosmetic):** the banner says "The guard itself is untouched" one sentence after
  describing the arms that left its body — 006700 *rewrote* the body; what is untouched is
  the trigger attachment and the remaining arms. One word, but in a correction banner.

## R2.5 — N2 (ARCHITECTURE.md): the rewrite contradicts the authority it cites

⛔ **NEW BLOCKING (B6).** The rewritten paragraph names **nine** tables for a class it
counts as **8**, and one of the nine is wrong: **`event_patient` is NOT a zero-policy
table** — measured this round, it carries a live gated SELECT policy
(`event_patient_select`, qual `app.can_read_event_patient(event_id, auth.uid())`, roles
`{authenticated}`), and 382 §A0's derived set (re-derived by me: 8 members) has never
included it. The "0 policies" claim about `event_patient` was **already false in the old
prose** — this round's rewrite carried it forward while adding both a member count and a
"§A0 is the authority" sentence that now visibly contradict it. Fix: move `event_patient`
out of the zero-policy enumeration (it is an audited single door with **one** policy and no
`authenticated` table grant — a different, adjacent shape), keep the count at 8. The
self-deprecating "never trust this list — it is prose" sentence is good, but it does not
license the prose being wrong on the day it was written, in the binding architecture doc.

*Observation, out of AE3 scope, worth a follow-up:* `event_patient_select` admits
`authenticated` rows via a real capability gate while `authenticated` holds **no** SELECT
grant on the table — the policy is currently pre-empted dead code, and a future
`grant select` would silently arm it. Whether that pair is intended deserves its own line
in the register.

## R2.6 — N3 / N4: verified fixed

- 301 §6.1/§6.2 descriptions now name `profile_private_details` and the table-level
  mechanism, matching the statements they run (read from the current file, lines ~491/495);
  the 6.2b inverted twin is unchanged. `plan(44)` unchanged — the edit was strings only.
- The E2E header now states the aggregate / session-context discharge as consumer-absence
  with an explicit expiry. Its two new factual claims were independently verified:
  `src/lib/queries/session.ts` (`getSessionContext`) names none of the three fields and
  never touches `profile_private_details`, and it is a server module with no API route.

## R2.7 — Posture re-check after the fresh reset

Re-measured this round: `profile_private_details` still RLS-on / **0** policies /
`authenticated` and `anon` `has_table_privilege = false` on all verbs; the guard's
comment-stripped body still names none of the three tokens. The AE3 substance is unchanged
by the round-2 work.

**Could not verify (stated, not implied):** the re-run gate figures (4 ARMs, lint,
typecheck, `test:db` 8285, AE3 spec 4/4) are accepted from the record — re-running them
needs the shared stack or the harness, both outside my mandate. The banner's actual printed
"427, DERIVED this run" output was not observed by me; I verified the stronger thing (the
query it prints is correct), which is what the fix was for.

---

## Round 2 verdict

B1 is fixed well, B3's substantive fix (the derived banner) is verified correct by
independent execution of its predicate, and N1–N4 are done with care — the N1 property
sweep found nothing missed and the ruling I was asked to check is confirmed. But three new
blocking items stand, two of them *inside this round's own fixes*: the live register's C2
figures contradict themselves (B4: 426 residue + a 344/82 decomposition that sums to the
old total), the rollback snapshot command targets the local Docker stack instead of the
production database it exists to protect (B5 — a false safety control, and a round-1 miss
of mine now on the record), and ARCHITECTURE.md's rewritten class list names a table its
own cited authority excludes (B6: `event_patient` is not zero-policy — measured). All three
are small text edits; none touches code, schema, or tests.

**CHANGES REQUESTED**

---
---

# Round 3 — re-review of the B4/B5/B6 fixes (2026-08-31, same reviewer)

**Method:** every "fixed" claim treated as a claim. The B6 element-wise check was re-derived by
me, not read; the FUP's premise (my own round-2 observation) was re-measured one grain deeper
than I measured it in round 2; the lint figure was re-run by me with the exit code read
directly (no pipe on it); the B5 procedure was attacked as requested. Same read-only mandate.

## R3.1 — B4 (register self-contradiction): FIXED, and the boundary holds — except one copy in the LIVE PLAN

- § Now's gate sentence now reads **427**; the C2 row decomposes **345 + 82** and records the
  pasted-old-decomposition catch; the follow-ups chain now ends at 427 **with the reason the
  chain ends** (the banner derives it per-run) — all verified in the current text.
- **The boundary hunt:** I swept PROGRESS.md, follow-ups, authz-ae3.md, backend-state,
  the harness, `docs/design/`, `docs/plans/`, and `.claude/rules/`. Residual 426/407 mentions
  in `authz-ae3.md` (the incident narrative), the harness comment, and the AE1 classification
  doc are dated records — correctly left. `backend-state.md`'s 426 is the migration-registry
  parity history (unrelated figure). The follow-ups **body** still says "the 407" in four
  places of running prose (`:1217, :1233, :1303, :1312`) — tolerable now that the header
  chain corrects it at the top (**N9**, non-blocking, next body edit).
- ⛔ **NEW BLOCKING (B8): the live plan's own binding rules carry TWO frozen figures.**
  `docs/plans/authz-evolution.md` rule 2 — the very rule that mandates stating the uncovered
  population — teaches it with "**the 407 reachable** command doors … are outside every arm's
  domain until that FUP closes". That is not a dated record: it is the instruction every
  future gate record of this program follows, and it now contradicts the register and the
  banner it coexists with. And rule 1 says "lint (**all ten**)" — the chain is **eleven**
  (verified by me this round, exit 0), the same drift CLAUDE.md §9 documents about its own
  old copy. Fix both the way B3 was fixed: **don't write 428** — name the FUP and say the
  figure is derived per-run by `ARM=census`'s banner; and point rule 1 at `package.json`
  rather than a count. ⚠ The plan carries its own correction convention (`[PA-F#]` tags bind
  via ADR 0162) — whether a figure repair needs a tag is the lead's call, but the edit should
  follow that convention, not bypass it.

## R3.2 — B5 (rollback snapshot): both round-2 defects are genuinely fixed; the attack found one new leak path

Read as the 2am operator, per request:

- **The wrong-database defect is closed, twice over.** The command now targets
  `$REMOTE_DB_URL` with the dashboard-fetch instruction and the `localhost ⇒ STOP` guard —
  and it gains an **accidental failsafe worth keeping on purpose**: post-AE3 the *local*
  stack has no `profiles.cpf` column, so mis-targeting the snapshot at local now fails
  **loudly** (42703) instead of producing a plausible artifact. The binding check (decrypted
  data-row count, `tail -n +2` correctly skipping the header, vs the **remote's** `profiles`
  count) binds the artifact to the right database — and doubles as the decrypt-verify.
- **"Counts, never rows" is real** — verified in the current text; the disclosure rationale
  is stated. Both verification reads go pipe-to-`wc`; no plaintext reaches disk anywhere in
  the typed pipeline.
- **Ruling on `$REMOTE_DB_URL` vs my round-2 `$SUPABASE_DB_URL` suggestion: the coordinator
  is right, and my suggestion was worse.** No such variable exists in this repo, and an
  operator using it unset would hand `psql` an **empty string** — which falls back to libpq
  defaults, i.e. a local-connect attempt: the exact wrong-database failure mode B5 was about,
  minus the loud name. An explicitly-fetched value with a STOP guard beats an
  official-looking variable that resolves to nothing. Acknowledged as a round-2 reviewer
  error in the suggestion (the finding itself stands).
- ⛔ **NEW BLOCKING (B7): the typed path persists the production superuser password to
  disk.** `REMOTE_DB_URL='postgresql://postgres.<ref>:<password>@…'` typed at an interactive
  prompt is written to the shell's history file (`~/.bash_history` / PSReadLine's
  `ConsoleHost_history.txt`) — plaintext, indefinitely, with **no destroy step**, on the same
  machine the runbook tells the operator to move the artifact off of. By this fix's own
  standard ("a rule a command contradicts is not a rule"), the credential that decrypts every
  CPF on the platform outlives the window in a file nothing in §4 mentions. Same class as
  B2, third instance. Fix in the command block itself: `read -rs REMOTE_DB_URL` (prompted,
  no echo, no history) before the `psql` lines — and one line telling the operator to rotate
  the database password after the window closes, which also retires the `ps`-argv exposure
  during the run.
- **N10 (non-blocking):** the `gpg --symmetric` passphrase has no stated home — an operator
  who loses it has no rollback artifact, and one who writes it beside the file has no
  encryption. One line: "passphrase goes in the password manager, never beside the file."

## R3.3 — B6 (ARCHITECTURE class list): FIXED, re-derived element-wise by me

I re-ran the deriving query and compared **names, not counts**: the live zero-policy set is
exactly the eight the paragraph now names — `case_print_revisions`,
`meeting_closed_session_item_readers`, `meeting_closed_session_items`, `patient_identifiers`,
`patient_participants`, `profile_private_details`, `referral_patient`,
`verification_lookups` — with `event_patient` absent from the derivation and explicitly
excluded in the prose with its reason and the FUP link. The count-vs-names mechanism note in
the record is the right lesson. **N8 (cosmetic):** the exclusion says `event_patient`
"belongs to the DEFINER-write-door bullet above", whose stated property is "grant
`authenticated` **SELECT only**" — `event_patient` grants `authenticated` nothing at table
level, so it fits neither bullet exactly; since the very next sentence states its true
posture precisely, one clause ("reached through its DEFINER doors; its grant shape matches
neither bullet") would finish it.

## R3.4 — The new FUP, and my own round-2 claim re-tested one grain deeper

`FUP-EVENT-PATIENT-POLICY-PREEMPTED` exists as index line + body; the body is disciplined
(three-option disposition, refuses closure on the premise, names the general property —
"how many other policies are pre-empted by an absent table grant?" — as owed). **And I
re-tested the premise itself, since it was my claim:** round 2 measured only
`has_table_privilege`, and this repo's own `profiles` history proves column grants can live
under a false table-level check. Measured this round: `event_patient` has **zero** column
grants to `authenticated`/`anon` and **zero** positively-selectable columns — the
"pre-empted dead code" premise holds at both grains.

## R3.5 — Independently re-verified this round

Lint chain: **exit 0**, read directly (my first check piped the code away — the repo's own
pipe lesson, caught and re-run). The AFF2 banner now says precisely what "untouched" means
(trigger not dropped, other arms not edited, body rewritten — stated in one breath).
Diff footprint since round 2 is confined to the seven documents under review — no code,
schema, or test changed. **Could not verify:** the 4-ARM re-run and the banner's printed
"427, DERIVED this run" (harness off-limits; the query it prints was verified by execution
in round 2 and its figure re-confirmed against the register this round).

---

## Round 3 verdict

The loop is converging: all three round-2 blocking items are genuinely fixed — B4's register
is consistent, B5's snapshot now targets the right database and verifies without disclosure,
B6's list now matches its authority element-for-element — and the fixes carry their
mechanism lessons rather than just their edits. The two remaining blocking items are narrow
and new: the rollback command's credential line persists the production password to shell
history with no destroy step (**B7** — found by the attack the coordinator requested, same
class as B2), and the live plan's binding rules still teach with two frozen figures, "the
407" in the very rule about stating populations and "all ten" for an eleven-gate chain
(**B8** — the fourth live copy the boundary hunt was asked to find). Both are a few lines;
neither touches code, schema, or tests.

**CHANGES REQUESTED**

---
---

# Round 4 — re-review of the B7/B8 fixes (2026-08-31, same reviewer)

**Method:** per the coordinator's own instruction, this round's weight went onto the round-3
fix text — §4.1 read end-to-end as an operator (not as a diff against B7), the plan's rule
edits read in full, and every "fixed"/"verified" claim re-measured rather than adopted:
the lint chain re-run by me after this round's edits (exit code read directly), the chain
length counted by me from `package.json`, the follow-ups cleanup re-grepped line by line.

## R4.1 — B7: FIXED, and §4.1 survived the end-to-end operator read

- `read -rsp 'Remote DB URI: ' REMOTE_DB_URL; echo` replaces the inline assignment —
  nothing reaches history or the screen; a paste error surfaces as a loud psql connection
  failure. The gpg passphrase now has a stated home and a stated lifetime bound to the
  artifact's ("destroying one without the other discharges nothing" is exactly right), the
  post-window **password rotation** is present with the correct rationale ("treat it as
  exposed rather than reasoning about whether it was" — which also retires the residual
  `ps`-argv exposure), and the accidental failsafe is recorded as a *backstop only*, with
  its expiry condition (holds only while local is post-AE3) stated.
- Read cold, in order, as the 2am operator: fetch-URI guard → snapshot pipeline → failsafe
  note → passphrase rule → rotation rule → handling rule → count-based verify. Each rule is
  carried by the command nearest it. **I found nothing new to attack.** The one inherent
  limit stands and is not a finding: this procedure has never been executed and cannot be
  until the window — the runbook now fails loudly in every mis-execution mode we have
  identified (wrong DB errors at 42703 or is caught by the STOP guard; a bad artifact fails
  the count binding; a lost passphrase is discovered at the verify step, *before* the
  migration runs, while the snapshot can still be retaken).

## R4.2 — B8: FIXED, and the tag form is ruled ACCEPTABLE

- Rule 1 now points at `package.json` and records its own drift; rule 2 states **no figure,
  deliberately**, names the banner and the FUP as the deriving instruments, and records why.
  Verified in the current plan text, both carrying `[QA-AE3-r3 B8]`.
- **Ruling on the tag vs. ADR 0162 ink:** the tag form is sufficient here, and I checked
  0162's actual scope before ruling rather than reasoning from its number: 0162 exists for
  corrections that **amend ADR-family decisions** (it amends 0155 on three points and
  records PO rulings). B8's edits change no decision — the gate composition, the domain
  qualifier requirement, and the population's ownership by the banner all stand exactly as
  decided; what changed is the plan's *citation hygiene* (a frozen figure → the instrument
  that derives it). An in-place tag naming a durable source in the phase record (this
  review) is proportionate. **Boundary, stated:** any plan edit that changes what the
  program *decides* — scope, sequencing, gate membership, a bound — still owes the 0162
  path; a figure-to-instrument repair does not.
- The coordinator's independent count was re-verified by me independently again:
  `package.json`'s `lint` splits into **11** segments on `&&` — the "eleven" is now a
  measured figure three times over, and the plan no longer states it anywhere.

## R4.3 — The two non-blocking items: one fully fixed, one HALF-fixed under a claim of "fixed"

- **`event_patient` clause: fixed, and better than asked.** The clause now says it belongs
  to *neither* bullet ("its own shape: a policy plus no grant") — which is more precise than
  my round-3 suggestion, and the correct resolution pointer (the FUP) is in place.
- ⚠ **The follow-ups cleanup is HALF-done, and the increment record says "also fixed."**
  My round-3 note enumerated four lines (`:1217, :1233, :1303, :1312`). Re-grepped this
  round: **1217 and 1233 are fixed; 1303 ("these 407 doors"), 1312–1313 ("expect RED with
  ~407 entries", "407 is too many to classify honestly"), and 1316 ("not about 407")
  remain** — and they sit in the C2 body's live *Consequences* and *Fix* paragraphs, not in
  dated wrappers. `authz-ae3.md`'s round-3 response nonetheless records "Non-blocking, also
  fixed: the follow-ups body's running-prose 'the 407's." That sentence is not true of the
  tree. ⚠ A likely contributing cause is my own round-3 shorthand — I wrote "says 'the 407'
  in four places", and the two occurrences of the *literal phrase* "the 407" are indeed
  gone; but the enumerated line numbers were the spec, and two of those four (plus two
  neighbors in the same Fix paragraph) still carry the figure. There are also two
  cross-FUP occurrences my note never covered (`:943`, `:1412` — "the 407-door sweep" used
  as a workstream *name* in two other live FUP bodies); renaming those to "the C2 Tier-1
  door sweep" would retire the figure's last live uses, but they function as a label and I
  do not press them.

## R4.4 — The calibration call, made in the open

Is R4.3's discrepancy blocking? The standard I set in B3/B4 blocked on untrue register
sentences — but in both of those, the false sentence was the **figure of record or the only
witness** (B3: a drift nothing tracked; B4: the C2 row's own decomposition). Here, every
figure of record is correct — the FUP header chain, the C2 row, the banner, the plan — and
the residue is hedged, forward-looking prose in one FUP body whose own header now corrects
it, overstated by one summary sentence about a *cosmetic* cleanup. The truth is fully on
this record, which the PO reads beside the increment record at approval. Blocking a phase
on that sentence would be the escalation failure mode the coordinator warned against —
finding something because a round exists — rather than the consistency it would claim to
be. It does, however, carry one **binding obligation**:

⛔ **MUST, at the Record step (same edit that closes the phase):** make the record's
sentence true — either finish the four lines (`:1303, :1312, :1313, :1316` — cite the
banner/FUP instead of the figure, as rule 2 now does) or re-scope the sentence to the two
lines actually fixed. `PROGRESS.md`-contract hygiene ("the record reflects reality") is the
authority; this review is the enumeration. The Record step cannot close with the sentence
and the tree disagreeing.

## R4.5 — Re-verified this round, and what remains open by nature

- `npm run lint` after this round's edits: **exit 0**, read directly — my own run, the
  second direct-exit verification this loop.
- The pattern watched for since round 2 — *each round's blocking defects live in the
  previous round's fix text* — **did not recur on the blocking axis this round**: the B7 and
  B8 fix texts held under an adversarial read aimed specifically at them. The one
  discrepancy found (R4.3) is in the round-3 *response record*, not in the fixes, and it is
  the smallest item of the loop: 3 blocking → 3 → 2 → 0.
- **Open by nature, restated for the PO** (none is a finding): the cutover procedure is
  untested until the window, by construction; G2's single-shot authorization expires the
  moment the pilot loads data (re-measured at cutover, precondition 1);
  `FUP-EVENT-PATIENT-POLICY-PREEMPTED` awaits its ruling, and the general
  pre-empted-policies property is owed; C2 Tier 1 keeps its queue position; the two E2E
  flake FUPs stand with their entry criteria. The AE3 substance itself — the schema move,
  the door-only posture, the census closure, the guard swap, the test re-base — has now
  been stable and catalog-verified across all four rounds.

---

## Round 4 verdict

B7 and B8 are genuinely fixed; the round-3 fix text, read adversarially end-to-end as
instructed, produced no new blocking defect for the first time in the loop; the tag form is
ruled acceptable with its boundary stated; and the phase's substance has been verified
stable since round 1. The single discrepancy — an overstated "also fixed" sentence about a
cosmetic cleanup whose figures of record are all correct — is documented in full above and
converted into a binding Record-step obligation rather than a fifth round, for the reasons
given in R4.4.

**APPROVED** — conditional on the R4.4 obligation being discharged at the Record step, with
this review presented to the PO beside the increment record.
