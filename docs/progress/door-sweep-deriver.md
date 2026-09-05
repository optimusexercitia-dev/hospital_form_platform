# DOOR-SWEEP-DERIVER — progress record

Door-sweep case deriver: pre-AE5 remediation Batch 1. The unit's **summary** is its hub,
[docs/features/door-sweep-deriver.md](../features/door-sweep-deriver.md) § Current state; this file
is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `scripts/door-sweep-cases.sh` (721 lines at open) and the full-run emit path that writes
`docs/reviews/authz-door-audit-findings.md` (in `supabase/tests/mutation/p0-authz-door-audit.sh`;
the sibling harnesses print the same hand-merged-block warning). Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (Amendment 8 — the recipe's
rulings 1–3; ruling 4 in the script header), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md)
(the `door-sweep-targets:` declaration), [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
(subset → scratch; the full run is the residual), [0148](../decisions/0148-ever-held-affiliation-read-visibility.md)
(AFF3 re-derived the diagnosis because the ruling lived in prose), [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md)
(the gate `9a4bbd22` added that the name filter dropped).

## Session log

### 2026-09-05 — unit opened (lead)

**Why now.** Batch 1 of the pre-AE5 batches ruled 2026-09-04. The deriver is §6 step 1 for every
phase and every AE5 per-role increment, and today it: derives **zero cases for a diff that added a
gate** (`BASE=9a4bbd22^ TIP=9a4bbd22` → exit 1, the sweep ran on a hand-widened list
indistinguishable downstream from a derived one); reads only the first line of a multi-line
`door-sweep-targets:` declaration (`…007250` survives on a *different* code path); cannot see
`alter function … security definer` (the exact analogue of ADR 0079 Amendment 8 ruling 1, one
branch over); and selects over the whole working tree so two in-flight increments report a union
(53 derived where AE1.3 owned 1). Batches 2 and 3 each need a **full** re-baseline run, and today a
full run silently destroys the committed findings file's hand-authored material — so that fix is
here, ahead of them.

**Scope.** Five follow-ups, closure on each one's own `Closes when` clause (hub § Acceptance
criteria). Explicitly NOT: `PRED_DOMAIN` (Batch 2); the write-arm 33-of-107 re-baseline and
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3 — Part 1 is already ruling 4 in the
script header); any change to a production function, policy or migration; any full sweep (the fix
that makes a full run safe is proven on a **copy** of the baseline, never by running one).

**Mechanisms at open** (from the follow-up bodies; every line number to be re-measured by the
builder against the file at HEAD, since the script has grown since each was filed):
- name filter in the recipe excludes `app.current_professional_read_organizations` → 0 cases,
  exit 1 (measured 2026-09-04 on a fresh reset at head `20261003007340`);
- marker grep `^[[:space:]]*--[[:space:]]*door-sweep-targets:` is per-line; continuation lines
  `--    app.foo()` unread, no warning;
- function branch selects on the `create function` body matching `security definer` + `returns
  boolean` + the identity regex; an `ALTER` has no body → invisible;
- file set = committed range ∪ `git diff --name-only HEAD` ∪ `git ls-files --others
  --exclude-standard`, reported as one diff with no provenance;
- full run emits the findings file through a truncating redirect; the file carries a hand-merged
  `<!-- … -->` subset block (~line 569), a trailing RENAME note, and annotated skipped-policy
  bullets that no run reproduces.

**Branch:** `authz-door-sweep-deriver` off `main` @ `76d87a4f`.

### 2026-09-05 — backend: build

Plan approved by the lead with rulings Q1–Q5 (build order 1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9).
Everything below is MEASURED at HEAD `53001454` unless it says `inferred`. Exit codes read
BARE (`rc=$?` on the line after the command, never through a pipe).

#### Pre-change baselines (the numbers every later delta is against)

| what | command | measured |
|---|---|---|
| F1 reproducer | `BASE=9a4bbd22^ TIP=9a4bbd22 bash scripts/door-sweep-cases.sh` | **rc 1**, stdout **0 bytes**, name under `⛔ EXCLUDED BY NAME` |
| F2 range | `BASE=731abda0^ TIP=HEAD …` | **rc 0**, **42 case(s)**, 14 file(s) touched |
| hand-block warning, door pattern `^(<!--\|## Note)` on the door baseline | `grep -cE` | **8** |
| hand-block warning, writepath pattern `^(<!--\|## Note\|> ⚠ \*\*HAND\|> ⚠ \*\*DOMAIN)` on the **same** door baseline | `grep -cE` | **16** |
| door baseline, `> ⚠ **HAND-MERGED` blockquotes / `## Note` / `<!--` | `grep -c` | **8 / 7 / 1** |

#### F1 — the NAME-FILTER close condition cannot be met literally inside this batch

`9a4bbd22` re-emits `app.current_professional_read_organizations`. Live catalog, measured:
`typname=uuid`, `prosecdef=t`, `proretset=t` — a DEFINER door returning `setof uuid`. It is
outside `PRED_DOMAIN` (`t.typname='bool'` …), so putting it in `CASES=` makes the whole sweep
UNPROVEN — ADR 0079:161-169 hazard 4. Ruling **Q1**: the close condition's last sentence is
amended in place to "zero DOORS", and the load-bearing proof of the PROPERTY is the
`assert_not_case_excluded` reproducer, not the message on `9a4bbd22`.

#### F2 — the deriver already over-selects into UNPROVEN (live, unfiled at open)

The 42 tokens of `731abda0^..HEAD`, each resolved against the LIVE catalog (read-only:
`pg_policies.policyname`, `pg_proc` ⋈ `pg_namespace` ⋈ `pg_type`, and `PRED_DOMAIN` evaluated
verbatim as the arm writes it):

| class | n | examples |
|---|---|---|
| RLS policy (`pg_policies.policyname`) | 7 | `forms_staff_admin_write`, `professional_profiles_select` |
| `prosecdef` function **IN** `PRED_DOMAIN` | 13 | `can_read_professional_profile`, `has_permission`, `is_active` |
| `prosecdef` function **OUT** of `PRED_DOMAIN` | 18 | `create_professional_profile` (uuid), `entailed_grants` (setof record), `explain_permission` (`permission_explanation`), `candidate_has_permission` (bool, body outside), `scope_reaches` (bool, body outside) |
| **INVOKER** (`prosecdef=f`) — another harness's class | 1 | `save_section_answers` (returns `responses`) |
| **absent from the catalog entirely** | 3 | `explain_direct_permission`, `has_direct_permission` (dropped by a later migration), `form_item_options` |

`p0-authz-door-audit.sh` then reports every unmatched token under "REQUESTED CASES THAT MATCHED
NO GATE" and the run ends UNPROVEN. So the paste-able command this script prints today makes an
AE5 increment touching the authz resolvers unprovable. ⭐ `form_item_options` is a *table* name:
`20261003007340`'s marker declares a POLICY (`public.form_item_options / form_item_options_staff_admin_write`)
and the parser extracts the table half — a different mechanism, filed separately, NOT fixed here.

⚠ 2 of 22 function names over the last 15 migrations are absent from the catalog because a later
migration dropped them. That refutes the brief's "absent → exit 2": it would ABORT ordinary
historical ranges. Absent is an `UNRESOLVED` obligation block, never exit 2 (lead ACCEPTED).

#### The `assert_not_case_excluded` drift — LEARN-024 live, inside the artefact that forbids it

`PRED_DOMAIN` (`supabase/tests/mutation/p0-authz-door-audit.sh:466-475`) carries
`or p.proname = 'assert_not_case_excluded'` OUTSIDE the `t.typname='bool'` clause. Catalog:
`typname=void`, `prosecdef=t`, and the domain evaluates **IN**. The deriver's hand-copy
(`scripts/door-sweep-cases.sh:310-315`) has no such exception and demands `returns[ ]+boolean`,
so a migration touching that function derives ZERO cases while the arm would sweep it. The
script's own header (`:127-134`) forbids exactly this. That is the reproducer the property fix
must be able to fire on, and it is a derivation the old script CANNOT produce.

#### The eight hand-authored categories in `docs/reviews/authz-door-audit-findings.md` (924 lines)

The follow-up names three; by the property ("any line the generator did not produce") there are
eight: 1 `<!-- … -->` block · 7 `## Note` sections · **8** `> ⚠ **HAND-MERGED` blockquotes ·
**~~39~~ 37** table rows carrying hand prose in column 5 (corrected 2026-09-05, QA F-REC-6 —
re-measured below) · an annotated skipped-bullet continuation ·
2 bare `---` rules · 20 rows ABOVE the COVERED delimiter · a nested blockquote inside a note.
The door script's own warning pattern sees 8 of these; the writepath twin's wider pattern sees
16 **on the same file** — measured both ways above. A warning whose number comes from a filter
is only as true as the filter (the writepath comment at `:257-266` says so about itself).

#### Commit 1 — `bd5a8080` `refactor(door-sweep): lift PRED_DOMAIN, never re-type the arm's domain`

`scripts/door-sweep-cases.sh:138-227` — `lift_block()` (multi-line lift), the `PRED_DOMAIN`
lift, three EXPLICIT substitutions (never `eval`), residual-`$` ABORT; `:238` header line.

| arm | command | OBSERVED |
|---|---|---|
| normal | `BASE=731abda0^ TIP=HEAD` | **rc 0**, 42 cases (unchanged), header `PRED_DOMAIN lifted whole (8 line(s)), 3 sub-vars expanded, no residual $` — ⚠ the **8** is an off-by-one on a 9-line block (`wc -l` counts newlines and the value has no trailing one); corrected 2026-09-05, QA F-REC-2, and the line now prints **9** |
| NEGATIVE CONTROL | `AUDIT_SRC=<copy>` where `cmp` proves the copy byte-identical | **rc 0**, no abort, same header line |
| PROOF OF FIRE | the same copy with `$PRED_NAME_RE` → `$PRED_FUTURE_AXIS` (a **one-token** `diff`) | **rc 2**, stdout **0 bytes**, `=== RESULT: ABORT (2) — PRED_DOMAIN LIFTED WITH AN UNEXPANDED VARIABLE. ===` then the unresolved domain printed |

DISCRIMINATION: the control and the fire differ by that one token and by nothing else
(`diff` shown in the session); rc 0 vs rc 2.

#### Commit 2 — `0a0d3489` `fix(door-sweep): select doors by prosecdef, split sweepable from identified`

`:392-478` section 4c (catalog classification, four buckets) · `:565-575` CASES = tier 2 ·
`:640-720` the printed blocks · `:800-840` exit-1 sub-cases.

| arm | OBSERVED |
|---|---|
| ⭐ **LOAD-BEARING** — planted `app.assert_not_case_excluded` in a fake repo | **rc 0**, stdout `assert_not_case_excluded`, tier 1 = 1, tier 2 = 1 |
| ⭐ **VACUITY CHECK** — the SAME plant under the deriver at `53001454` | **rc 1**, stdout **empty**, the name under `⛔ EXCLUDED BY NAME` |
| F1 message — `BASE=9a4bbd22^ TIP=9a4bbd22` | **rc 1** (unchanged), stdout **0 bytes**, `DOORS IDENTIFIED: 1. SWEEPABLE BY THIS ARM: 0.` naming `current_professional_read_organizations (prosecdef, returns setof uuid — outside PRED_DOMAIN)` |
| NEGATIVE CONTROL — plant names a catalog INVOKER (`save_section_answers`) | **rc 1**, tier 1 = **0**, DOORS block **ABSENT**, `NO DOORS AT ALL` |
| DISCRIMINATION — ONE token changed to `assert_hospital_affiliation_has_org` | **rc 1**, tier 1 = **1**, DOORS block **PRESENT**, `returns trigger — outside PRED_DOMAIN` |
| UNRESOLVED — plant names `app.no_such_function_anywhere` | **rc 1**, UNRESOLVED block naming both causes |
| NO-CATALOG FALLBACK — `DOOR_SWEEP_DB=no_such_container_xyz` | **rc 0**, **42** tokens, `diff` against the pre-change derivation **byte-identical** |

⭐ The vacuity check is the load-bearing half: the new arm produced a derivation the old
script CANNOT produce, so it was not green on its first run.

**F2 measured**: `731abda0^..HEAD` 42 → **20** cases; tier 1 = 41 doors identified; **0**
tokens resolve to neither `pg_policies.policyname` nor `pg_proc.proname` (pre-change: 3).
21 doors are identified-but-not-sweepable, including three the NAME FILTER dropped entirely
(`current_professional_read_organizations`, `authorized_scope_ids`,
`candidate_authorized_scope_ids`) — so F1's class closes past the one name that raised it.

#### Commit 3 — `6234677d` `fix(door-sweep): read ALTER FUNCTION … SECURITY DEFINER like ALTER POLICY`

`:365-390` section 4d (the grep + name extraction) · `:640-656` the ruling-3-analogue block ·
`:705-712` the no-catalog obligation.

| arm | OBSERVED |
|---|---|
| PROOF OF FIRE — `alter function app.can_read_professional_profile(uuid, uuid) security definer;` | **rc 0**, stdout `can_read_professional_profile` |
| VACUITY CHECK — the same plant at `53001454` | **rc 1**, stdout empty, the name absent from the whole transcript |
| NEGATIVE CONTROL — `owner to postgres` instead | **rc 1**, ALTERED-BY block **ABSENT**, `NO DOORS AT ALL` |
| DISCRIMINATION — the tree's ONLY real instance (`20261003004300`, a trigger door) | identified as a door, **EXCLUDED** from CASES, printed reason `returns trigger — outside PRED_DOMAIN` |
| BULK CONTROL — `20260620000000_baseline.sql` | naive `alter function` lines **449**, committed regex matches **0** |

#### Commit 4 — `1ba83bff` `fix(door-sweep): parse the whole door-sweep-targets declaration`

`:480-540` the unconditional two-state awk + grammar · `:556-566` the dedup moved OUT of the
rewrite guard · `:568-575` the named parse-error block.

⛔ **Structural blocker the follow-up does not name, measured**: `20261003007250` contains
`pg_get_functiondef` **0** times, and the whole marker block sat inside
`if … grep -qiE 'pg_get_functiondef'`. The declaration path never executed for the migration
the follow-up is about; its targets survived on the unrelated `create or replace` name path.

| arm | OBSERVED |
|---|---|
| DECLARATION PATH ALONE — `…007250` with its 4 `create or replace function` lines removed | **rc 0**, all four declared targets derived (`has_permission` → CASES; the other three → DOORS-NOT-SWEEPABLE), tier 1 = 4 |
| VACUITY CHECK — the same file at `53001454` | **rc 1**, stdout empty, **none** of the four anywhere in the transcript |
| CONTROL — marker line deleted, continuations kept | **rc 1**, nothing derived, `candidate_has_permission` count 0 |
| DISCRIMINATION — that ONE line restored | **rc 0**, all three derived |
| CONSUME-OR-STOP — `-- we also touched app.is_active()` after a bare `--` | `is_active` **not** derived, count 0 |
| LOUD NARROW CASE — a continuation ending `, app.` | named parse error `content line 2: schema prefix with no function name`, **rc 0** (the run continues) |

**MARKER-READ DELTA on `731abda0^..HEAD`, as owed: 42 (pre-unit) → 20 (tier split) → 20
(this commit).** The wider read added **zero** cases and exactly **one** new UNRESOLVED token,
`form_item_validations` — a TABLE name from `…007340`'s policy-shaped marker. Over all **11**
marker-bearing migrations in the tree: **0** parse errors.

#### Commit 6 — `9ba4cc35` `feat(harness): merge generated rows into the findings baseline, preserve hand-authored material`

NEW `scripts/lib/merge-findings-baseline.sh` (shared by all four sweeps) · four call sites:
`p0-authz-door-audit.sh` (`emit_body`/`emit_report` split, snapshot at startup, DONE-line
stale warning), `p0-authz-writepath-audit.sh`, `p0-authz-rowdoor-audit.sh`,
`p0-authz-invoker-audit.sh` — same shape in each.

⛔ **No sweep was run.** `git diff --stat -- docs/reviews/` empty: the four committed
baselines are byte-identical. Everything below ran on COPIES under the scratchpad, driving
the PRODUCTION `emit_body` **LIFTED** out of each harness (the same anti-drift idiom the
deriver uses on `PRED_DOMAIN` — a harness must never hold a hand-written copy of production
text) over a synthetic `progress.tsv`.

| call site | baseline | OBSERVED |
|---|---|---|
| door | 924 lines, 8+7+1 hand blocks | **rc 0**; rows generated **401** → merged **401**; `> ⚠ **HAND-MERGED` 8→8, `## Note` 7→7, `---` 2→2, `<!--` 1→**2** (the CARRIED block, exactly +1); 425 hand prose lines + 34 suffixes preserved; CARRIED 2 |
| writepath | 137 lines, 3 hand blocks | **rc 0**; 53→53 rows; 3→3 blocks; 51 prose + 3 suffixes |
| invoker | 165 lines, 2 hand blocks | **rc 0**; 91→91 rows; 2→2 blocks; 42 prose + 4 suffixes |
| rowdoor | 87 lines, **0** hand blocks → **one PLANTED** | **rc 0**; 54→54 rows; 1→1 block. A detector with nothing to find proves nothing |

**`verdicts_from_findings` (ARM 3's own extractor) over the door baseline vs the merged
output**: 392 keys each; only-in-baseline = exactly the 2 rows the synthetic run dropped,
only-in-merged = exactly the 2 it added. Nothing else moved.

⭐ **THE VERIFIER IS PROVEN ABLE TO FAIL** — at all four call sites,
`MERGE_FAULT=drop-hand-block` → **rc 2**, `MERGE-ABORT: the merge LOST hand-authored
material`, and the output file **NOT written**; on the door file
`MERGE_FAULT=drop-suffix` → **rc 2**, naming the lost 401-character suffix.
NEGATIVE CONTROL: the same inputs with no fault → **rc 0**, written, `cmp`-identical to the
earlier merge. Merging twice is byte-identical (idempotent, which is what makes a per-case
emit safe). No baseline → copies the generated report, rc 0. Bad args → rc 2.

**CONTROL, an identical emit** (same stats, same rows): 27 changed lines vs the baseline,
and every one is a declared side effect — 1 regenerated statistic, the two generated
sections the committed file lacks (`**Domain of this run**`, `## OUTSIDE …`), the missing
`|---|---|---|---|---|` delimiter restored (repairing the stranded 20-row region), 4 stray
blank lines, and 3 duplicate rows re-ordered. Nothing lost.

⚠ **DEVIATION FROM THE PLAN, MEASURED.** The plan's discrimination half was "delete one hand
block from the INPUT copy → verification non-empty and ABORT". Measured: it does **NOT**
fire (**rc 0**, 8 blockquotes → 7 in and 7 out). The verifier is keyed on its own input, so
removing material from the input moves the expectation with it. Only a fault in the MERGE
can fire it — which is exactly what `MERGE_FAULT` was added for, and what the four
proofs-of-fire above use. ⭐ A discrimination half that cannot distinguish is the shape this
whole unit is about; recording it rather than quietly substituting.

⚠ **A DEFECT THIS HELPER HAD IN ITS FIRST RUN, caught by its own row-count check.** Rows were
keyed on column 1 alone; the door baseline carries `app.can_sign_section(…)` TWICE (a gate
swept in two passes leaves two rows in `progress.tsv`; the invoker baseline's own header says
it ran in four passes). The second occurrence collided with the first and **5 rows vanished
silently** — the prose check reported clean. Rows are now keyed on NAME + ORDINAL and the
verification asserts the merged row multiset equals the generated one.

⚠ **The one heuristic in the file, disclosed.** Inside a diff CHANGED group an old line is
dropped when some new line in the same group is identical once digits and repeated blanks are
removed (`Baseline: Files=156, Tests=4796` → `Files=256, Tests=8579`). Without it a
regenerated statistic is duplicated rather than replaced. It decides PLACEMENT, never
PRESERVATION: every line it drops is printed as `REPLACED … (the only legitimate drop)` and
excluded from the survival set explicitly, so a wrong replacement is visible. Its first
version had no such exclusion and the verification correctly ABORTED on the two statistic
lines — the instrument fired before it was asked to.

Also in this commit: `p0-authz-door-audit.sh:461` cited **ADR 0079 Amendment 8** for
`FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`, which is **Amendment 9** (Amendment 8 is
the ALTER-POLICY / stale-verdict ruling). Verified against the ADR's own headings.

#### Commit 5 — `b08b5734` `feat(door-sweep): per-case provenance and an explicit SCOPE`

`scripts/door-sweep-cases.sh` §1b (`SCOPE=`/`PATHS=` filter + `filter :` header line) · §2b
(`extract_one()` + the per-file loop + the aggregate union + `$TMP/prov`) · the cross-file
reconciliation kept global · the `SCOPE:` line and the PROVENANCE block before the
paste-able commands. **BOTH halves of §2.4 landed** — per-CASE assembly, not only the
per-FILE fallback ruling Q3 allowed.

| arm | OBSERVED |
|---|---|
| two untracked migrations, one policy each, different tables | **rc 0**; `SCOPE: 2 file(s) — 0 committed (HEAD..HEAD), 0 worktree, 2 untracked | filter: none`; PROVENANCE maps each case to its own file |
| `SCOPE=20990101000020` | **rc 0**; stdout is ONLY `professional_profiles_select`; header `filter : SCOPE=20990101000020 PATHS=· (2 file(s) -> 1)` |
| `PATHS=supabase/migrations/20990101000010` | **rc 0**; stdout is ONLY `forms_staff_admin_write` |
| CONTROL — one file | `SCOPE: 1 file(s) — … 0 worktree, 1 untracked | filter: none` |
| DISCRIMINATION — the SAME two policies in ONE file | `1 file(s)`, **both** attributed to it (the count follows FILES, not cases) |
| ⭐ VACUITY CHECK — the same tree under `53001454` | **0** `SCOPE:` lines, **0** PROVENANCE blocks, and `SCOPE=` silently IGNORED — the undifferentiated union |

**ADR 0173's array-gate over-selection, CLOSED as a side effect.** 0173:387-393 measured it
and declined the fix as benign; per-file assembly (needed here for attribution) brings it.
Targeted proof — a fake repo holding `…007180` (builds an array) + `…007190` (does not):

- pre-unit deriver → 6 tokens: `can_manage_professional compute_due_charter_notifications
  compute_due_document_review_notifications compute_due_notifications is_active
  save_section_answers`
- this commit → **1** in CASES (`can_manage_professional`, which is `…007190`'s own declared
  marker target), with all four of `…007180`'s array targets still derived into their
  classification blocks (`compute_due_*` as unsweepable doors, `save_section_answers` as an
  INVOKER).

⚠ `is_active` is a **replacement literal** (`'and app.is_active(p_uid)'`) in `…007190`, not a
rewrite target — read the migration, not the token. `has_role`,
`explain_direct_permission` and `has_direct_permission` are quoted `replace()` OPERANDS in
`…007200/007210/007250`. None is a door the range touched.

**Case-count ledger for `731abda0^..HEAD`** (catalog reachable): 42 (pre-unit) → 20 (tier
split, commit 2) → 20 (marker, commit 4) → **18** (per-file array gate, this commit).
No-catalog floor: 42 → 39 (the same four operands out, `form_item_validations` in).

REGRESSION BATTERY re-run after the restructure, all bare: F1 message **rc 1** with the
`DOORS IDENTIFIED: 1 / SWEEPABLE: 0` line · `assert_not_case_excluded` **rc 0** deriving ·
`alter function … security definer` **rc 0** deriving · `…007250` declaration-path-alone
**rc 0** with all four targets · `PRED_DOMAIN` drift **rc 2** · no-catalog **rc 0**.

#### Commit 7 — `8ca0d9ba` `test(door-sweep): SELFTEST=1 over committed fixtures`

NEW `scripts/door-sweep-selftest.sh` + 12 fixtures under `scripts/fixtures/door-sweep/` ·
`scripts/door-sweep-cases.sh:98-107` the `SELFTEST=1` dispatch. ⛔ NOT in `npm run lint`
(ruling Q4) — Phase Gate step 1, beside the four authz arms.

| run | OBSERVED (bare) |
|---|---|
| this branch | **PASS 15 · FAIL 0 · SKIPPED 0**, rc 0 |
| ⭐ the PRE-UNIT deriver (`53001454`), same fixtures, same assertions | **PASS 3 · FAIL 12**, rc **1** — including the ADR 0173 pin failing with exactly `is_active must NOT be in CASES`. The 3 that pass there are genuinely unchanged behaviours (`owner to` → nothing, no migration → rc 3, bad ARM → rc 2) |
| SKIP path (`DOOR_SWEEP_DB` pointed at nothing) | **PASS 5 · SKIPPED 10**, rc 0, the ten named and `⛔ A PASS over 5 scenario(s) with 10 skipped is NOT a pass over all of them` |

⚠ **It failed twice for real while being written, and both are recorded rather than tidied
away.** (1) **rc 127 on every scenario** — the copied deriver in the fake repo re-dispatched on
the inherited `SELFTEST=1` into a self-test file the fake repo does not contain; fixed by
forcing `SELFTEST=0` for the child. (2) Two wrong expectations, one of which was a real finding:
with no catalog, `assert_not_case_excluded` is **not** derived (the property fix is
catalog-based and the text heuristics demand `returns boolean`), so the scenario now pins that
honest bound explicitly instead of asserting a rc 0 the design does not promise.

⚠ **The first version of the ADR 0173 pin was VACUOUS.** Its fixture wrote the literal as
`'and app.is_active(p_uid)'`, where the quote does not immediately precede `app.`, so the array
fallback's regex never matched it and the pin passed on the OLD deriver too. Caught by running
the suite against `53001454` — the discrimination half doing its job on the suite itself. The
fixture now reproduces `20261003007190`'s real shape (`position('app.is_active(' in v_src)`).

#### Commit 8 — `d8ef85df` `docs(adr): 0190`

`docs/decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md`,
`**Amends:** 0173, 0079` · `**Related:** 0153`. D1–D12. `npm run adr:index` regenerated the
back-pointers in 0079 and 0173; `npm run lint:adr-index` **bare rc 0**.

**Number 0190 verified two ways** — enumerated across every `refs/heads` and `refs/remotes`
(`authz-door-sweep-deriver` 0189, `main` 0189, `origin/main` 0186, `origin/HEAD` 0186,
`origin/authz-c2-tier1` 0180) *and* against the index's next-free line. Both said 0190.

#### Follow-up filings and closures

**FILED (2 new).**
- `FUP-AUTHZ-DOOR-SWEEP-DERIVER-OVERSELECTS-INTO-UNPROVEN` 🟠 — filed, then CLOSED in this unit
  on the tier split, per the lead's ruling. The fix needs a name; a defect closed without an
  entry is a defect nobody can audit the closure of.
- `FUP-AUTHZ-DOOR-SWEEP-MARKER-DECLARES-POLICIES-TOO` 🟡 — **filed only**, owner backend, not
  fixed here. `20261003007340`'s marker declares POLICIES in a `schema.table / policyname` form
  ADR 0173 §2 does not define, so the parser derives the TABLE name.

**CLOSED (6), each on its own `Closes when`, quoted and satisfied clause by clause in the
archived entry.** ⚠ **DISCLOSED**: three of them (`…BLIND-TO-ALTER-FUNCTION`,
`…SPANS-THE-WHOLE-WORKING-TREE`, `…FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS`) carried
`**Closes when:** PO to rule` in the REGISTER, so the condition satisfied is each one's BODY
text (`**Fix shape:**` / `**Discharged when**` / `**Fix: the register's option (b)**`) — Batch
0's QA F-MAJOR-4 standard. ⚠ **These closures are written at the BUILD step; the unit's QA
review and PO approval are still owed.**

⚠ **Q1 amendment, applied BEFORE the closure and kept VISIBLE.** The NAME-FILTER item's last
close-condition sentence is struck (`~~Either way `9a4bbd22` must stop producing zero cases.~~`)
in both the register entry and the body, with a dated
`**Amended 2026-09-05 (Q1, ADR 0079 hazard 4):**` paragraph naming the catalog facts, the
UNPROVEN hazard, and the hand-off: because the deriver LIFTS `PRED_DOMAIN`, Batch 2's widening
admits the door with no deriver change.

**Rotation mechanics** (lead-playbook §5): each entry and body was byte-EXTRACTED, assembled
into `follow-ups-archive.md` under a `### ✅ … — **RESOLVED 2026-09-05**` heading, `cmp`-checked
at the destination (12/12 comparisons byte-identical), and only then cut from
`follow-ups-open.md` and the body file deleted. ⚠ **ONE line per entry is deliberately NOT
verbatim** — the pointer-to-body line, because `lint:registers` (ADR 0185 D5) reds on that
literal token surviving into the archive; the banner discloses it. ⭐ The entry BLOCK is
archived alongside the body, which is what
`FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` asks for — that item stays open
(one instance is not the rotation being changed, and it is the lead's).

`npm run lint:registers` **bare rc 0** after the rotation; ratchets moved in the allowed
direction only (`closesWhenPoToRule` 140→137, `severityPerEmoji` 131→128, `longHeadings`
95→91); follow-ups 208→202, bodies 163→157.

#### Dead ends and things that did NOT work

- **A merge that keyed rows on column 1 alone.** Silently dropped 5 rows on the real door
  baseline (duplicate keys). Found by adding a row-count check to the self-verification — the
  prose check reported clean throughout. Rows are keyed NAME + ORDINAL.
- **A verification that treated every non-generated baseline line as hand-authored.** It
  ABORTED on the two regenerated statistic lines — correctly, by its own rule. Fixed by making
  the narrow REPLACED set explicit and printed, not by widening the rule.
- **The plan's `helper_x` control for the tier split** cannot work under catalog classification:
  a made-up name is UNRESOLVED whether or not its text says `security definer`, so it does not
  discriminate. Replaced with a control/discrimination pair built on real catalog facts
  (`save_section_answers`, prosecdef=f, vs `assert_hospital_affiliation_has_org`, prosecdef=t).
- **The plan's "delete a hand block from the INPUT copy" discrimination** does not fire (rc 0,
  measured). Replaced by `MERGE_FAULT` injection, which does.
- **A whole-history derivation** (`BASE=<root commit> TIP=HEAD`) did not finish in ~50 minutes
  and was killed. The per-candidate catalog lookup is a subprocess triple; a 14-file range takes
  ~10 s. The parse-safety question it was asked was answered instead by deriving over all **11**
  marker-bearing migrations (0 parse errors), which is complete for that question — a file with
  no marker cannot produce a marker parse error.

#### Gate — 2026-09-05, every exit code read BARE

Run on `authz-door-sweep-deriver` @ `62829c79` with `git status --short` **empty**, after a
fresh `supabase db reset --local` (**rc 0**).

| step | command | bare rc | what it says |
|---|---|---|---|
| lint | `npm run lint` | **0** | eslint 0 errors / 0 warnings; all 13 gates including `lint:registers`, `lint:progress`, `lint:adr-index` |
| typecheck | `npm run typecheck` | **0** | — |
| pgTAP | `npm run test:db` | **0** | `Files=262, Tests=8876, Result: PASS` |
| authz arm | `ARM=census …p0-authz-invariant.sh` | **0** | `=== INVARIANT HOLDS ===` |
| authz arm | `ARM=hat …` | **0** | `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` · `INVARIANT HOLDS` |
| authz arm | `ARM=floor …` | **0** | `INVARIANT HOLDS` |
| authz arm | `FROMFINDINGS=1 ARM=wrapper …` | **0** | `BLIND set size: 41` · `every BLIND wrapper is on the allowlist` · `INVARIANT HOLDS` |
| selftest | `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **0** | `PASS 15 · FAIL 0 · SKIPPED 0` |
| diff-scoped sweep | `BASE=main TIP=HEAD bash scripts/door-sweep-cases.sh` | **3** | NOT-APPLICABLE — **derived, not asserted** |

**Suite shape did NOT move.** `Files=262, Tests=8876` is byte-for-byte the last known-good run
(Batch 0's gate, 2026-09-04). No `.sql` was added under `supabase/tests/`; the branch's only
changes there are the four `.sh` harnesses.

⚠ **TWO RED test:db RUNS BEFORE THE GREEN ONE, and neither is hidden.**
1. The first run: `Files=262, Tests=8761, Result: FAIL` — **four files aborted with
   `ERROR: deadlock detected` inside `test_helpers.bootstrap()`'s
   `truncate table public.organizations cascade`** (`365`, `383`, `401`, `61`). That is the
   known, parked `FUP-PGTAP-WORKER-DEADLOCK`, non-deterministic and unrelated to this branch —
   which touches no `.sql`, no migration and no seed. Its own mitigation is the reason the shape
   comparison above is in this table: the flake **LOST 115 assertions** (8761 vs 8876) while
   keeping `Files=262`, so a trailing summary line alone would not have shown it.
2. The second run: `Tests=2615, Result: FAIL` — **my error, recorded as such.** I started it
   against the DB the first (aborted) run had left truncated by `257_ethics_e2_retention.sql`.
   ⭐ "Shared local stack, single owner" applies to my own two runs, not only to two sessions.
   The fix was a fresh reset, then ONE foreground run with the exit code read bare.

**THE DERIVATION THIS UNIT OWES — the instrument's first use on its own diff.** Not owed as a
sweep (`git diff --name-only main...HEAD -- supabase/migrations` is empty), and that claim is
now **derived** rather than asserted:

⛔ **The block that stood here was a PARAPHRASE inside a code fence** — its line order was
inverted against the script's actual `say()` sequence and three explanatory lines were dropped
with no ellipsis, in the unit whose own `SCOPE:` line says "Quote it; do not paraphrase it"
(QA F-REC-7). Replaced 2026-09-05 with the REAL stderr tail, captured at `4d5c6bd9`, bare
rc **3**, stdout **0 bytes**:

```
  migrations : 0 file(s) touched
---------------------------------------------------------------------------
=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ===
    The diff-scoped sweep has no domain, so it does not apply. ⚠ This is NOT the
    same observation as 'the recipe printed nothing' (that is exit 1) and it is
    NOT a pass: it is a CHECKABLE claim. If the phase DID add a migration, the
    <phase-base> is wrong — re-run with the right one before recording anything.

SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
       0 case(s) — nothing was derived, and the line above is what the gate record
       quotes to say so.
---------------------------------------------------------------------------
```

⭐ **That run found a gap in the new output and it is fixed in commit 10.** The exit-3 path
printed **no `SCOPE:` line at all**, so the one line the gate record is told to quote verbatim
did not exist for the outcome a no-migration branch produces. "There was nothing to scope" is
itself a scope, and it is exactly the claim exit 3 asks the operator to check. `scope_line()` is
now shared by both paths; exit 3 is unchanged and `SELFTEST=1` scenario 11 still passes
(re-run after the change: PASS 15 · FAIL 0 · SKIPPED 0, rc 0).

---

### 2026-09-05 — backend: QA fix loop, iteration 1 of ≤5

QA reviewed `de955981` and returned **CHANGES REQUESTED — F-BLOCK-1 + 6 MAJOR + 8 REC**. This
entry is per finding: fix (file:line) · proof with the OBSERVED bare exit code and output ·
negative control. Three commits: `6474a625` (merge helper), `4d5c6bd9` (deriver), this one.

⛔ **Every merge run in this session was on COPIES under the scratch dir.** No full sweep ran.
`git diff --stat main... -- docs/reviews/` shows only the QA review file; the four committed
findings baselines are byte-identical to `main`.

#### F-BLOCK-1 — the merge helper destroyed hand-authored material and could not see it

**Reproduced FIRST, on `de955981`'s helper** (`git show de955981:… > old-helper.sh`, `cmp`-equal
to the tip's) before any fix — all three of QA's witnesses, exactly:

| witness | pre-fix helper | after |
|---|---|---|
| A — an escaped pipe inside a note | rc **0**, `is_signoff_deferral_open` 727 → **579** B, `can_manage_professional` 1106 → **570** B, "PRESERVED 0 … 2 hand suffix(es)"; the row ends mid-sentence | rc 0, **727** and **1106** B, **0** baseline lines missing |
| B — a hand-written 3-column table | rc **0**, 165 → **161** lines, "PRESERVED 0 … CARRIED 0", header + delimiter + both rows LOST, surrounding prose PRESENT (control) | rc 0, 165 → **165**, all four present |
| C — a hand row with an EMPTY note | rc **0**, `app.handrow(uuid)` gone from the table AND from CARRIED | rc 0, carried verbatim |

**Fix — three rules, `scripts/lib/merge-findings-baseline.sh`:**

1. §1a/§1b — a baseline line is a verdict row only if it has the generator's own shape, and the
   three signals that decide it (table HEADER text · VERDICT tokens · gate KEYS) are DERIVED
   from the generated file, never hand-listed. The header signal is what makes it survive a run
   in which some verdict simply did not occur.
2. §0 `seps`/`rowsplit` — columns split at UNESCAPED `|` only, and CAP at five, so the note
   survives whole.
3. §5 — the protected set is the complement of the generated output over the WHOLE baseline,
   computed by the same classifier that built the file, pipe-leading lines included.

**The discrimination half is not a knob.** The pre-fix helper's OWN output on each witness is
committed under `scripts/fixtures/door-sweep/merge/*.prefix-output.md` and fed to the current
verifier through `MERGE_VERIFY`: **rc 2** on all three, naming `SUFFIX: …`, `PROSE: | gate |
evidence | reading |`, `CARRIED ROW: | app.handrow_empty_note…`. Positive control: the new
helper's own output on the same pairs → **rc 0**. Idempotence `merge(b,b) == b` byte-identical
on all five fixture baselines, and `merge(merge(b,g), g) == merge(b,g)`.

#### F-MAJOR-4 — nothing tested the merge helper; `MERGE_FAULT` was ungated

18 merge scenarios added to `scripts/door-sweep-selftest.sh` (plus 1 deriver scenario for
F-MAJOR-3): **PASS 34 · FAIL 0 · SKIPPED 0**, bare rc 0.

⭐ **Negative control, and this is the one that matters:** the SAME suite — `cmp`-verified
identical selftest and fixtures — with only the helper swapped to `de955981`'s → **13 FAIL**,
bare rc **1**. The five idempotence scenarios pass there too, which is correct: the pre-fix
helper was idempotent, it was just lossy.

`MERGE_FAULT` / `MERGE_VERIFY` are now refused unless `SELFTEST=1` (observed rc 2, the refusal
naming SELFTEST), abort when asked to inject and unable to (observed rc 2, and the
"FAULT INJECTED" line is NOT printed), and `cmp`-verify that the injection landed.

⚠ **Two defects found in my own fix, both by an assertion doing its job** — recorded because a
suite that catches its own vacuity is the standard, not the exception:

- `MERGE_FAULT=drop-suffix` passed the victim through `awk -v`, which DECODES escapes. Against
  the door note carrying an escaped pipe it searched for an already-unescaped string, matched
  nothing, printed "FAULT INJECTED" and the verifier then passed at **rc 0** — the exact shape
  QA had flagged one layer out. The victim now travels through `ENVIRON` and every injector
  `cmp`s the file it claims to have damaged.
- The scenario "MERGE_FAULT refused when SELFTEST!=1" went green on the WRONG CAUSE: the suite
  runs with `SELFTEST=1` in its own environment, the child inherited it, and the run exited 2
  for the unrelated "nothing to inject" reason. The rc matched; the message assertion did not.
  `SELFTEST=0` is now set explicitly for that scenario.

#### F-MAJOR-5 — a merge abort did not reach the exit code

`p0-authz-{door,writepath}-audit.sh`: `MERGE_FAILED` is now the FIRST branch of the graded
block — `=== RESULT: ERROR — the findings MERGE ABORTED`, **exit 2** — ahead of the verdict
counts, which are printed either way. `p0-authz-{rowdoor,invoker}-audit.sh` get minimal
propagation only (`MERGE_FAILED -> exit 2`, else `exit 0`): they have no graded verdict block
at all, which is **filed, not fixed** —
`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡, owner backend, body + register
entry, `lint:registers` bare rc 0 after filing. `scripts/door-sweep-cases.sh`'s hazard text now
says an empty `git diff` on a FULL run must be read together with the merge banner and the exit
code, because an aborted merge produces the same empty diff.

#### F-MAJOR-1 — the `SCOPE:` line could not distinguish catalog from provisional

Reproduced QA's two runs — SAME range, SAME filter, both bare rc 0: catalog reachable → **18**
cases; `DOOR_SWEEP_DB` pointed at nothing → **39** cases. Their `SCOPE:` lines were
byte-identical. They now end `| derivation: catalog` and `| derivation: PROVISIONAL (no
catalog — text heuristics; the tier split did NOT run)`.

⚠ **THREE states, not two** — found by running the NOT-APPLICABLE path after the first version
of this fix, which wore a PROVISIONAL badge it had not earned: `CATALOG_OK` is UNSET until the
probe runs, so that path now says `NOT REACHED (this run ended before the catalog was probed)`.

#### F-MAJOR-2 — the `SCOPE:` line was missing on both exit-1 paths and every exit-2 path

Made STRUCTURAL rather than fixed at the measured site: `scope_line` and one `finish <rc>` are
defined above every validation in `scripts/door-sweep-cases.sh`, and all **18** exit paths go
through `finish`. Assertion: `grep -n 'exit [0-9]' scripts/door-sweep-cases.sh` returns **8**
hits — 7 prose lines and one `END { if (!found) exit 9 }` inside `lift`'s single-quoted awk
program, which is awk's exit, not the script's. Reproduced, each printing exactly one line:

| path | command | bare rc | the SCOPE line |
|---|---|---|---|
| exit 1 | `BASE=9a4bbd22^ TIP=9a4bbd22` | **1** | `1 file(s) — 1 committed (9a4bbd22^..9a4bbd22) … derivation: catalog` |
| exit 3 | `BASE=HEAD TIP=HEAD` | **3** | `0 file(s) … derivation: NOT REACHED` |
| exit 2, scope known | the lift-drift copy (`cmp`-verified to differ) | **2** | `(none — this run ABORTED before the file set was built)` |
| exit 2, before the file set | `ARM=sideways` | **2** | same |

#### F-MAJOR-3 — a bare schema prefix ended the declaration silently

A `--` line is a continuation if it carries a SCHEMA PREFIX, whether or not its tokens parse;
only a prefix-free `--` line ends it; and a dangling `app.` at end-of-line CARRIES to the next
line, so a declaration wrapped mid-token parses. On QA's own four-line example, in a fake repo
with a `cmp`-verified deriver copy:

| deriver | bare rc | CASES | `PARSE ERROR` | the wrapped token |
|---|---|---|---|---|
| pre-fix `7df0bd9b` | 0 | `is_admin` | **0** | `is_commission_admin_of` absent from the entire output |
| now | 0 | `can_sign_section is_admin` | **1** — `…:2: schema prefix with no function name` | reaches UNRESOLVED (`no pg_proc row in app/public/authz`) |

Committed as `scripts/fixtures/door-sweep/09-marker-dangling-prefix.sql`, which also closes
F-REC-8's numbering gap. ⚠ The three names are deliberately of three kinds: `is_admin` is what
the PRE-FIX run already derived, so on its own it discriminates nothing; `is_commission_admin_of`
has no `pg_proc` row at all, so reaching UNRESOLVED is the only way it can witness that the
parser read past the break; `can_sign_section` is two lines past the break and in `PRED_DOMAIN`.

**Negative control on the committed tree** — the pre-fix deriver (`7df0bd9b`) and this one over
`731abda0^..HEAD`, both rooted in the real repo: tier 1 = **39**, tier 2 = **18**,
**byte-identical case lists**, 0 parse errors. The parse change moves nothing that is committed.
The two committed bare-`--` migrations (`…007180`, `…007190`) still parse.

#### F-MAJOR-6 / F-REC-1 / F-REC-6 — the numbers

- **F-MAJOR-6.** ADR 0190's P3 read "3 + 1 + 21" against its own total of 42. Re-measured at a
  PINNED tip rather than patched — the PRE-UNIT deriver (`main` @ `76d87a4f`) over
  `731abda0^..4d5c6bd9`: bare rc 0, **42** tokens, all 42 emitted as `CASES`; resolved against
  the live catalog they are **18** in `PRED_DOMAIN` + **21** outside it + **1** INVOKER
  (`save_section_answers`) + **2** unresolved (`form_item_options`, `form_item_validations`)
  = **42**.
- **F-REC-1.** Every `731abda0^..HEAD` citation in ADR 0190 and in `door-sweep-cases.sh` is now
  pinned to `4d5c6bd9`. The old "42 → 20, tier 1 = 41" was true of a MID-UNIT build: the tier
  split alone gives 20/41, and D7's per-file `array[` gate then drops `is_active` and
  `has_role`, taking it to 18/39 — the same −2 in both columns, which is what makes the pair
  consistent rather than a discrepancy. The Consequences bullet had paired the post-gate 18
  with the pre-gate 41; it now reads 18 against 39.
- **F-REC-6.** MEASURED, not chosen: counting column 5 for any of `⭐ ⚠ ⛔ ** [merged` over the
  399 verdict rows of the committed door baseline gives **37** under a capped escape-aware
  split, under a naive split, and under symbols-only. The helper's 37 was right; this record's
  39 was stale. ⛔ **The first pass of this fix loop got it backwards** — it edited the helper
  to 39 to match the record, without measuring. Corrected, and written down because it is the
  register lesson happening inside the fix for the register lesson.

#### F-REC-2 / 3 / 5 / 7 / 8

`wc -l` counts newlines and `printf '%s'` writes none, so a 9-line `PRED_DOMAIN` printed as 8 —
now counted with `awk 'END{print NR}'`. `eval "val=\$$v"` → `val="${!v}"`. Self-test scenario 5's
assertions were all negative; it now also asserts the fixture was SCANNED and that the run
reached the no-doors FINDING. The commit-10 witness in this record was a paraphrase inside a
code fence and is replaced above with the real stderr tail, captured at `4d5c6bd9`, bare rc 3,
stdout 0 bytes. Fixture numbering is contiguous.
**F-REC-4 is the lead's** — `docs/lead-playbook.md` is untouched by this branch.

#### QA's could-not-verify list — what was settled, and how

- **#2 — the merge against a REAL generator's output. SETTLED BY MEASUREMENT, and it REFUTED
  the assumption the merge rested on.** A 2-case door subset run, launched DETACHED with its own
  `WORK` (`CASES="is_signoff_deferral_open can_manage_professional"`): bare rc **0**,
  `RESULT: CLEAN — 2 gate(s) measured, all COVERED`, and the harness's own second lock reported
  `committed baseline VERIFIED unchanged (cksum)` — confirmed independently by `md5sum` taken
  before and after. Comparing the generated column 5 with the committed note for those gates:

  | gate | byte-exact prefix? | whitespace-insensitive? | first divergence |
  |---|---|---|---|
  | `app.is_signoff_deferral_open` | **no** | **yes** | byte 20 — a space a hand editor added after a comma |
  | `app.can_manage_professional` | **no** | **no** | byte 422 — an annotation spliced INTO the file list, plus two files the generator has added since |

  So the generator's file list is **not** in general a prefix of the committed note: 0 of 2
  byte-exact. The splice rule is now whitespace-tolerant (`wsprefix`), which recovers the first
  row byte-for-byte; the second correctly takes the CARRY branch and its whole committed row is
  preserved verbatim. Both are pinned as fixture `D-real-generator`.
  ⚠ **Consequence for Batches 2–3, stated now rather than discovered later:** on a real full
  re-baseline most hand-annotated door rows will be CARRIED rather than spliced. Nothing is lost
  and everything is flagged, but it is a large block for a human to re-file.
- **#5 — `20261003004300`'s `alter function` derivation, end to end on the real migration.
  SETTLED.** Its adding commit is `89793d43` (`git log --diff-filter=A`); derived over
  `89793d43^..89793d43`: bare rc **1**, the `ALTERED BY 'alter function … security definer'`
  block fires, tier 1 = **1**, `CASES` empty, and the exclusion printed as
  `assert_hospital_affiliation_has_org (prosecdef, returns trigger — outside PRED_DOMAIN)`.
- **#1** is the gate below, re-read at the tip. **#3** (rotation fidelity for the sixth closure)
  is unchanged and remains a PO eye, self-disclosed in the entry itself. **#4** is addressed by
  the committed fixtures: an injector that demonstrably aborts on real material is now three
  self-test scenarios over committed inputs, one of them the real door rows.

⚠ **Catalog hygiene, and an error of mine worth recording.** The post-run degenerate-policy
check was first run against `supabase_db_escalume` — a SECOND Supabase stack running on this
machine — because `docker ps | grep supabase_db | head -1` picked it. Its schema is a different
project's (74 `app` functions, no `authz` schema), so the "0" it returned was a claim about the
wrong database. Re-run against `supabase_db_azkbbhskturikxpgmafq` and **ENUMERATED, not
counted**: `pg_policies` degenerate non-SELECT → **0 rows**. The container name is not a detail;
`head -1` over a `grep` chose the subject.

⚠ **Out of scope, observed:** `docs/followups/follow-ups-archive.md` carries five more
`731abda0^..HEAD` citations with the same HEAD-relative rot. They are archived closure text and
were not rewritten.

#### Iteration-1 gate — fresh `supabase db reset --local`, every code read BARE

`git status --short` was **empty** before the reset, and empty after every step below. The
reset itself: bare rc **0**, `Finished supabase db reset on branch authz-door-sweep-deriver`.

| step | command | OBSERVED |
|---|---|---|
| lint | `npm run lint` | bare rc **0** — eslint at `--max-warnings=0` plus all 13 chained gates, including `lint:adr-index` and `lint:registers` (ratchets unchanged: `closesWhenPoToRule=137/147`, `severityPerEmoji=128/135`, `longHeadings=91/97`) |
| typecheck | `npm run typecheck` | bare rc **0** |
| pgTAP | `npm run test:db` | bare rc **0**, `Files=262, Tests=8876, Result: PASS` — byte-for-byte the last known-good shape; ⚠ compared as a SHAPE, not as a summary line, because the parked `FUP-PGTAP-WORKER-DEADLOCK` flake keeps `Files=262` while losing assertions |
| arm — census | `ARM=census bash …/p0-authz-invariant.sh` | bare rc **0**, `live authz gates (catalog): 581`, `gates carrying a verdict: 625`, `=== INVARIANT HOLDS ===` |
| arm — hat | `ARM=hat …` | bare rc **0**, `self-test: 7/7 OK`, `=== INVARIANT HOLDS ===` |
| arm — floor | `ARM=floor …` | bare rc **0**, `authenticated-reachable prosecdef doors with 0 calls: 63`, `OK: every never-called door is on the floor allowlist`, `=== INVARIANT HOLDS ===` |
| arm — wrapper | `FROMFINDINGS=1 ARM=wrapper …` | bare rc **0**, `BLIND set size: 41`, `OK: every BLIND wrapper is on the allowlist`, `=== INVARIANT HOLDS ===` |
| self-test | `SELFTEST=1 bash scripts/door-sweep-cases.sh` | bare rc **0**, `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0`, catalog REACHABLE (so no scenario skipped vacuously) |
| the sweep, DERIVED | `BASE=main TIP=HEAD bash scripts/door-sweep-cases.sh` | bare rc **3**, stdout **0 bytes**, `=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ===` and `SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked \| filter: none \| derivation: NOT REACHED (this run ended before the catalog was probed)` |

⭐ This settles QA could-not-verify **#1**: `test:db` and all four arms are re-read AT THE TIP,
not carried forward from `62829c79` on a delta argument.

**Scope guards, all measured after the gate:**

- `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` → **0 files**.
- `git diff --stat main... -- docs/reviews/` → **only** `door-sweep-deriver-review.md`; the four
  committed findings baselines `cmp` **byte-identical** to `main`, one by one.
- `git diff --name-only main... -- .claude/rules docs/lead-playbook.md CLAUDE.md` → **0 files**.
- Catalog after the arms (which run the full suite): `pg_policies` degenerate non-SELECT
  **ENUMERATED** — ⛔ never counted — → **0 rows**. No `authz-*INFLIGHT*` sentinel anywhere.
