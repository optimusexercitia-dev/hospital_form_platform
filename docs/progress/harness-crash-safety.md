# HARNESS-CRASH-SAFETY — progress record

Mutation-harness crash safety: pre-AE5 remediation Batch 0. The unit's **summary** is its hub,
[docs/features/harness-crash-safety.md](../features/harness-crash-safety.md) § Current state; this
file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/c2-command-door-neutralizer.sh`,
`supabase/tests/mutation/p0-authz-door-audit.sh`, `supabase/tests/mutation/p0-authz-writepath-audit.sh`,
and whichever sibling harness `FUP-AUTHZ-HARNESS-PRECONDITIONS` names (its `SUITE` defaulted to
`00_setup + 350`). Decisions: ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md),
[0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md),
[0171](../decisions/0171-c2-tier1-regrain-and-the-command-door-neutralizer.md).

## Session log

### 2026-09-04 — unit opened (lead)

**Why now.** Batch 0 of the pre-AE5 follow-up batches ruled this day: the batches that follow
(deriver, `PRED_DOMAIN`, write-arm baseline) each need a multi-hour full sweep, and on
2026-09-04 a sweep killed by a 10-minute tool timeout left `public.cancel_event`'s two anchored
raises at `null;` for ~4 min with **no sentinel and no preflight red**
(`FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`). Running those sweeps first on a
harness that can strand a door silently is the realised risk, not a hypothetical one.

**Scope.** Four follow-ups, closure on each one's own `Closes when` clause (hub § Acceptance
criteria). Explicitly NOT: the door-sweep deriver (`scripts/door-sweep-cases.sh`, Batch 1),
`PRED_DOMAIN` (Batch 2), the write-arm re-baseline (Batch 3), the 296-site value-assertion
triage (`FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE` — a lint pass may ride along
only if it costs nothing), any change to a production function, policy or migration.

**Mechanisms measured at open** (catalog-independent; read from the scripts at `7c85e713`):
- `c2-command-door-neutralizer.sh:88-93` — `restore_inflight` truncates `$INFLIGHT`
  unconditionally after `psql_f`, ignoring its exit status; traps at `:94-95` cover
  `EXIT INT TERM HUP` only. `:101-106` — `DEGEN` matches three whole-body constant shapes; the
  neutralizer's own `raise … ;` → `null;` rewrite matches none. `BASE_S` captured once at `:299`.
- `p0-authz-door-audit.sh:263-298` — the sibling's crash sentinel with `RECOVER=1`; `:300-351`
  the §7.16 degenerate-body preflight over `app`/`public`/`authz`, three forms. This is the
  design the neutralizer lacks.

**Branch:** `authz-harness-crash-safety` off `main` @ `7c85e713`.

### 2026-09-04 — backend: plan + build

**Plan** written this session and APPROVED by the lead with rulings Q1–Q5 (build order
1 → 2 → 3 → 4 → 6 → 7 → 8; commit 5, the §2.3 transactional residual, withheld pending a PO
ruling on Q2). The four findings below are **measurements**, not restatements of the follow-ups.

#### F1 (blocking) — the `DEGEN` arm as `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`
specifies it is **vacuous by construction**

Close condition 2 asks for *"an enforcer in the derived worklist whose current anchored-raise
count is below its recorded `nraise`"* and calls that *"per-run derivable"*. It is not.
`c2-command-door-neutralizer.sh:183` derives **both** columns from the **live** `pg_proc.prosrc`
in the same `\copy`, in the same instant: column 5 `nraise` (errcodes of the class) and column 6
`nanchored` (anchor matches). On a stranded stack the worklist therefore records the
**already-reduced** count and "live vs recorded" compares a number to itself. Worse: a *fully*
stranded enforcer loses its last errcode occurrence, drops out of the `c2n.gatefn` population
filter (`:166-169`) and **leaves the worklist entirely** — `TOTAL` slides 171 → 170 and the arm
has nothing to compare against. A detector built to the letter of the close condition would pass
its own proof only if the strand were planted *after* derivation, which is not the failure mode.
Corrected to two halves (residue shape + persisted worklist baseline); the follow-up's close
condition is **amended in place, visibly** (lead ruling Q3), never rewritten.

#### F2 (blocking) — the exit-status half of close condition 1 is **also vacuous** without a second change

`c2-command-door-neutralizer.sh:61-66` `psql_f` carried **no `-v ON_ERROR_STOP=1`**, so psql exits
**0** on a SQL ERROR. C2 was the only authz harness missing it (`p0-authz-door-audit.sh:187`,
`p0-authz-writepath-audit.sh:281`, `p0-authz-invoker-audit.sh:200`,
`p0-authz-rowdoor-audit.sh:146` all carry it). "Check `psql_f`'s exit status", bolted onto the old
`psql_f`, could only ever read 0 — a dead instrument wearing the name of a guard. Fixed in
commit 1 and **proven** by plant C (the vacuity control) below.

#### F3 (scope) — the trap-path restore is a **class** defect, not a C2 one

| harness | trap-path restore | verifies? | sentinel | `INT/TERM/HUP` trap |
|---|---|---|---|---|
| `c2-command-door-neutralizer.sh:88-93` | `psql_f …; : > "$INFLIGHT"` | **no** | `$INFLIGHT` **is** the sentinel | yes |
| `p0-authz-door-audit.sh:198-206` | `psql_f …; rm -f "$SENTINEL"` | **no** | separate file, `RECOVER=1` | yes |
| `p0-authz-writepath-audit.sh:803-811` | `psql_f …; cp → .attempted; rm -f "$SENTINEL"` | **no** ("attempted", not verified) | separate file, `RECOVER=1` | yes |
| `p0-authz-invoker-audit.sh:211-217` | `psql_f …` | no | **none** | **none** |
| `p0-authz-rowdoor-audit.sh:152-158` | `psql_f …` | no | **none** | **none** |

The two `p0-*` siblings survive a **SIGKILL** (no trap runs, so the sentinel survives) but **not**
the incident's actual signal: a job-tree **SIGTERM**, where the trap does run, its `psql` child
dies with the group, the restore fails, and the sentinel is erased anyway. `invoker` and `rowdoor`
have **no sentinel at all**. Commit 7 folds the two sentinel-bearing siblings in (lead ruling Q1);
`invoker`/`rowdoor` are filed as `FUP-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL` and NOT
built here.

#### F4 (found in passing) — `SUITE=` narrows the suite but **not** the report target

`c2-command-door-neutralizer.sh:70-74` set `SUBSET=1` for `CASES` or `SELFTEST` — **not** for
`SUITE`. A `SUITE=` run therefore swept the full 171 with a one-file suite (every BLIND
meaningless) **and truncated the committed baseline** `docs/reviews/c2-command-door-findings.md`.
An ADR 0153 violation and a live instance of `FUP-AUTHZ-HARNESS-PRECONDITIONS`'s *"the domain did
not contain the subject"*. Fixed in commit 4.

#### Which harness `FUP-AUTHZ-HARNESS-PRECONDITIONS` is about — answered

**No committed harness has the `00_setup + 350` default the entry describes.** `SUITE` appears in
`c2-command-door-neutralizer.sh:53` (default empty = the whole suite) and
`cnv5-demotion-backstop-mutation-audit.sh:22-23` (hard-wired to `400_adr0166…` with `00_setup` as
`$SETUP`). `git log --diff-filter=D` over `supabase/tests/mutation/` since 2026-08-15 shows no
deleted harness. The DSR Slice 3 battery was **ad-hoc and never committed**; the fix therefore
lands as a *property* of the harnesses that can still be narrowed.

#### Build — commits, and every proof-of-fire with the exit code and message observed

⛔ Every detached run below was launched **outside the tool's job tree** (PowerShell
`Start-Process` on `C:\Program Files\Git\bin\bash.exe`, output redirected to the scratchpad and
polled) with its own `WORK` and `C2_INFLIGHT`. ⚠ `nohup setsid` was the planned mechanism and
**does not exist in Git Bash on this machine** (`nohup: failed to run command 'setsid'`);
`Start-Process` is the equivalent that genuinely detaches on Windows. No harness ever ran under a
tool timeout.

**Commit 1 `18e9d7db` — `fix(harness): psql_f fails loudly — ON_ERROR_STOP=1`**
(`supabase/tests/mutation/c2-command-door-neutralizer.sh:64-79`)

*Plant C, the F2 vacuity control* — `select 1/0;` through psql in the container, **exit code read
bare** (`rc=$?` on the next line, never through a pipe):

```
without ON_ERROR_STOP : psql:/tmp/_plantC.sql:1: ERROR:  division by zero   -> exit 0
with    ON_ERROR_STOP : psql:/tmp/_plantC.sql:1: ERROR:  division by zero   -> exit 3
```

So the exit-status half of close condition 1 could only ever have read 0. It is real only from
this commit onward.

**Commit 2 `fbe4954b` — `fix(harness): a failed restore KEEPS the sentinel; port RECOVER=1 to C2`**
(`restore_inflight` at `:124-160`, `snapshot` sidecars at `:245-257`, the startup `RECOVER=1`
block at `:162-193`, the SELFTEST plant-A arms at `:459-481`)

*Plant A — witnessed inside the harness's own `SELFTEST=1` arm*, target
`public.withdraw_referral`, detached, on a fresh reset:

```
  ok   probe MOVES the hash (public.withdraw_referral)
  ok   restore returns the hash EXACTLY                      <- NEGATIVE CONTROL, clean tree
  ok   a FAILED restore REFUSES — rc=2 | *** RESTORE FAILED (psql rc=3,
       body hash live=c787e3dd172b73a8fe6dd976fb47e758
                 want=1636bd89ace0f96b515d9b9924413390)
  ok   a FAILED restore KEEPS the sentinel (…/c2-INFLIGHT-st1.sql)
  ok   the gate is still open AND the sentinel still says so
  ok   a VERIFIED restore clears the sentinel and returns the hash EXACTLY
  ok   post-restore degenerate-body count = 0
--- SELF-TEST PASSED — the harness can mutate, can undo, and REFUSES a bad undo ---
```

⭐ `psql rc=3` is the ON_ERROR_STOP fix carrying the plant. Pre-commit-1 this arm would have read
`rc=0` and the md5 half alone would have carried it.

*Plant D — the incident's ACTUAL signal.* `kill -TERM -<pgid>` against the running harness's whole
process group (PGID 376) at 19:36:15, while `public.withdraw_correction` was mutated and its
sentinel armed (2743 bytes, sidecars `.body`/`.md5`/`.oid` present). Observed:

```
    !! INFLIGHT mutation found — restoring …/c2-INFLIGHT-st1.sql
    restore VERIFIED in the catalog (psql rc=0, md5=334ae40795bd91b6dabc779f5e2439ae)
    committed baseline VERIFIED unchanged (cksum)
```

sentinel truncated to 0 bytes **legitimately** (the restore verified), every process in PGID 376
gone, and the live md5 of oid 24531 equal to the pre-mutation snapshot. This is plant D's
*restore-succeeded* branch; plant A is its *restore-failed* branch, and together they cover both
outcomes. ⚠ The prohibition in `.claude/rules/mutation-harnesses-are-not-killable.md` was suspended
once, deliberately, under the approved plan, and is recorded here.

*Catalog verification after the plants*, three ways, on the live catalog:

| check | result |
|---|---|
| md5 of both touched enforcers vs their pre-mutation snapshots | `withdraw_referral 1636bd89…`, `withdraw_correction 334ae407…` — **equal** |
| live `nraise`/`nanchored` vs the worklist's recorded columns | `withdraw_referral 2/2`, `withdraw_correction 4/4` — **equal** |
| `pg_policies` with `qual`/`with_check` = `'true'` **and** `cmd <> 'SELECT'`, **ENUMERATED** | **zero rows** |
| the three `DEGEN` forms | **0** |

*Rule files, in the commit where their claim became false:*
`.claude/rules/c2-neutralizer-has-no-crash-safety.md` retired **verbatim** into
`docs/progress/rules-archive.md` (ADR 0127 disposition — never deleted outright), and
`mutation-harnesses-are-not-killable.md` corrected. ⚠ Its 2048-byte cap is a hard gate and the file
was already at 2038: `lint:rules` was **witnessed RED** at 2082 bytes
(`rule file is 2082 bytes (cap 2048)`) and green at 2047. Compression cut *sentences*, never
bounds — the SIGKILL-vs-SIGTERM correction, the catalog-verification rule, the ON_ERROR_STOP
clause, the two uncovered harnesses, the `cmd <> 'SELECT'` discriminator and the suite-shape
warning are all still there.

**Commit 3 `bbb86bca` — `feat(harness): DEGEN arm 4`** (`preflight_residue` + arm 4b at `:336-410`)

⛔ **Half A's clean-tree count was MEASURED on a fresh reset before the shape was chosen — the
number the plan required be reported whatever it was:**

| candidate predicate (public+app, 1081 functions) | clean-tree matches |
|---|---|
| `then\s*null\s*;\s*end\s+if` (the obvious narrow shape) | **1** — `public.confirm_triage` |
| `(then\|else\|begin\|loop\|;)\s*null\s*;` (shape alone) | **3** |
| the same **AND** no errcode of the anchor class | **0**, ENUMERATED to zero rows |

So the obvious shape would have red-flagged a **clean** tree on its first run. `confirm_triage`
carries a deliberate `if v_pathway = 'rca' then null; end if;` **and 6 anchor-class errcodes** — it
is excluded by the *property*, not by a name. ⛔ An allowlist was rejected: it would blind the arm
to a real strand of that very function.

*Proofs of fire* (detached; exit codes bare):

- **Negative control** — clean tree, `CASES=public.withdraw_referral`, full suite:
  `arm 4a: 0 residue shapes`; `arm 4b: worklist matches its recorded expectation (171 enforcers,
  source: committed findings docs/reviews/c2-command-door-findings.md)`; `COVERED=1 BLIND=0
  ERROR=0`, **exit 0**, 320 s — and the verdict **matches the committed baseline row** for that
  enforcer. No regression from the `ON_ERROR_STOP` change (the §2.1e obligation).
- **Plant B (arm 4a)** — `public.cancel_event`, the 2026-09-04 incident's own function, stranded
  exactly as this harness strands it, with **no sentinel** (the erased-evidence scenario), then the
  harness run fresh in a second process:
  `*** PREFLIGHT FAILED (arm 4a) — a body carries THIS harness's residue shape: public.cancel_event`,
  **exit 2**, before the baseline capture and any suite run.
- **Plant B2 (arm 4b)** — a strand arm 4a *cannot* see (`raise …;` → `perform 1;`, so no `null;`
  residue but every anchor-class errcode gone). In the same run:
  `arm 4a: 0 residue shapes` (correctly silent — that is the discrimination) then
  `*** PREFLIGHT FAILED (arm 4b) — the derived worklist LOST authz raises vs sidecar …:
  LEFT THE POPULATION  public.cancel_event   recorded nraise=2, now absent`, **exit 2**.
- ⭐ **Arm 4a also fired against a strand nobody planted**: while the first detached run held
  `public.withdraw_correction` mutated, the arm's query returned exactly that function; before and
  after, `(none)`. A live proof that the predicate sees the real mutation shape.
- **Both baseline sources exercised**: the committed findings table (first run, no sidecar) and the
  scratch sidecar (later runs). ⚠ **NOT proven able to fire: arm 4b's `NOT RUN` branch** — it needs
  both the sidecar and the committed findings absent, and the committed file cannot be removed from
  a working tree without a change this unit is not allowed to make. Two echo lines, unexercised.

**Commit 4 `3cb7a0d3` — `feat(harness): assert BOTH verdict preconditions`**

*Discrimination, the same enforcer under the two domains* (this is the proof — a `COVERED` under a
narrowed domain must stay a verdict, only the negative needs the full domain):

| run | verdict | exit | banner |
|---|---|---|---|
| `CASES=public.withdraw_referral`, full suite | `COVERED=1 BLIND=0 ERROR=0` | 0 | `preconditions: baseline GREEN (shape=Files=262, Tests=8876) · domain=full suite` |
| same enforcer, `SUITE="00_setup.sql 212_status_keys_g1.sql"` | `COVERED=0 BLIND=0 **ERROR=1**` | 1 | `preconditions: baseline GREEN (shape=Files=2, Tests=7) · domain=SUITE=…` |

the row read
`**ERROR** | NARROWED DOMAIN — the mutated run passed, but SUITE=… ran only part of the suite;
'nothing noticed' and 'nothing that COULD notice ran' are indistinguishable here.`
⛔ **F4's ADR 0153 guard, measured:** the `SUITE=` run wrote
`$WORK/c2-command-door-findings.SUBSET.md`, printed `committed baseline VERIFIED unchanged
(cksum)`, and the committed file's cksum was `1556047199 33473` after it — unchanged. Before this
commit that run would have **truncated** the committed baseline.

**Commit 6 `a8148126` — `feat(harness): bound tail drift`** (`RESET_EVERY`, `periodic_reset` at
`:585-635`, `sweep_one` at `:641-…`)

The per-enforcer body is extracted into `sweep_one()` so the retry runs the **same** code, not a
second copy of it; `preflight_degenerate`, `preflight_residue` and `derive_worklist` become
functions for the same reason — `periodic_reset` must re-run them, and a duplicate of production
text drifts silently.

| proof | observed |
|---|---|
| **reset fires** — `RESET_EVERY=1`, 3 enforcers, narrowed suite | two `--- PERIODIC RESET (scheduled — N enforcer(s) swept since the last baseline) ---`, each with `arm 4a: 0 residue shapes` and `post-reset baseline: PASS (shape=Files=2, Tests=7) \| worklist re-derived: 171 (unchanged)`; banner `resets=2 (RESET_EVERY=1)`; **exit 1** (3 NARROWED-DOMAIN ERRORs, correct under a narrowed suite); 217 s |
| **the interlock** — driven against `periodic_reset`'s own text, eval'd out of the production file | `*** refusing to reset with a mutation in flight: …/c2-INFLIGHT-testB.sql`, **exit 2**, sentinel byte-unchanged (10 → 10) |
| **the retry net** — `BASE_S_OVERRIDE="Files=1, Tests=1"`, `RESET_EVERY=1`, full suite | `drift suspected — resetting and retrying public.withdraw_referral ONCE` → reset → `post-reset baseline: PASS (shape=Files=262, Tests=8876)` → retry scored **COVERED**, row suffixed `(retried after reset)`; `COVERED=1 BLIND=0 ERROR=0 … resets=1`, **exit 0**, 605 s |
| **negative control** — `RESET_EVERY=0`, same enforcer, full suite, no knob | `COVERED=1 BLIND=0 ERROR=0 … resets=0 (RESET_EVERY=0)`, **exit 0**, 329 s, no suffix, verdict identical to the committed baseline row |

⭐ The retry proof is the follow-up's own *"would have recovered all three automatically"*, measured:
a verdict that run 1 would have lost came back COVERED.

⚠ `BASE_S_OVERRIDE` is new **production surface added for testability**, documented in the USAGE
block as a self-test knob and never to be set for a real sweep. The approved plan sanctioned it
(§2.4 proposed exactly this); without it the retry branch is one nobody can show firing.

**Commit 7 `e31af593` — `fix(harness): inherit the verified-restore trap in the two p0 siblings`**

`arm_inflight` / `disarm_inflight` / a verifying `restore_inflight` in
`p0-authz-door-audit.sh:210-252` and `p0-authz-writepath-audit.sh:802-855`, with the probe recorded
beside the sentinel (`$SENTINEL.probe` / `.want`) so `RECOVER=1` in a **later process** can verify
too. Both `RECOVER=1` blocks now say plainly when they **cannot** verify — a sentinel written before
this protocol carries no probe, and "cannot verify" must not read as "verified".

Each sibling got its **own** plant — a fix correct at most sites hides that it is wrong at one — and
the helpers were `eval`'d out of the production file (`sed -n '/^arm_inflight () {/,/^}$/p'`), never
retyped, so the proof is about the shipped text:

```
p0-authz-door-audit.sh (function probe, public.cancel_event)
  armed: want=6a5aa2df9859f5ef032f45008417f5cb  sentinel 1196 B, probe sidecar 42 B
  gate OPEN: live md5=de5d27d2e436dfc0c629835c890715d1
  ok   a FAILED restore REFUSES - rc=2
  ok   a FAILED restore KEEPS the sentinel AND its probe sidecar
  ok   the gate is still open AND the sentinel still says so
  restore VERIFIED against the catalog (psql rc=0, probe=6a5aa2df…)
  ok   a VERIFIED restore clears the sentinel and returns the hash EXACTLY
p0-authz-writepath-audit.sh — identical arms, same target, rc=0
p0-authz-door-audit.sh (POLICY probe, public.accreditation_frameworks ::
                        accreditation_frameworks_select, a SELECT policy)
  armed: want=7e1b0b98c8bb0928f5ff68918cd92247
  policy OPEN: probe now=eb28d87532d6edd9b635727493ef89f7, live qual = true
  ok   a FAILED policy restore REFUSES - rc=2
  ok   a FAILED policy restore KEEPS the sentinel AND its probe sidecar
  ok   the policy is still OPEN and the sentinel still says so
  restore VERIFIED against the catalog (psql rc=0, probe=7e1b0b98…)
  ok   a VERIFIED policy restore clears the sentinel and returns the qual EXACTLY
```

⚠ **A dead end worth recording, because it read exactly like a live defect.** The policy plant's
FIRST run reported `NOT OK: policy not restored` — a **test** bug, not a production one: the check
compared the live probe against `$INFLIGHT_WANT`, which `disarm_inflight` had just cleared to `""`
on the successful restore. The production line immediately above it already read
`restore VERIFIED against the catalog (psql rc=0, probe=7e1b0b98…)` with the value equal to the
armed `want`, and the catalog agreed: `accreditation_frameworks_select` was **absent** from the
enumeration of every `qual`/`with_check` = `'true'` policy. Matcher fixed, re-run, rc=0.
⭐ *A wrong matcher reads exactly like a live defect* — the enumeration is what told them apart.

`FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL` filed (🟠, backend) with the F3 table as
its measurement; ⛔ deliberately **not built**. ⚠ Its id is `FUP-AUTHZ-…`, not the
`FUP-INVOKER-…` the ruling named: gate 13's CODES arm (watermark **2026-09-04** — this is the first
id it binds) requires a registered code prefix, and `AUTHZ` is one. Witnessed red before the rename:
`FUP-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL uses no registered code`.

#### Timings, measured this session (never quoted)

| operation | measured |
|---|---|
| `supabase db reset --local`, fresh | **49 s** and **54 s** on two measurements |
| worklist derivation (171 enforcers from 1081 functions) | **≈ 60 s**, from the run-to-run deltas |
| one full pgTAP suite run, `Files=262, Tests=8876` | **87 wallclock s** measured directly by `npm run test:db` (90 s including npm/CLI start-up); the RESET_EVERY=0 control ran derivation + 3 suite runs in **329 s**, which agrees |
| one enforcer, full suite, no reset (derivation + baseline + mutated + restored) | **329 s** |
| one enforcer, full suite, one reset + retry | **605 s** |
| `RESET_EVERY` cost, projected on a 171-enforcer sweep at N=20 | 8 resets × (49 s reset + 60 s re-derivation + 100 s baseline) ≈ **+28 min** on ≈ 9.5 h (**≈ +5 %**) — the plan's estimate was +40 min / 7 %, so the ADR's figure is the measured one |

#### Gate — every exit code read BARE, on the line after the command, never through a pipe

| step | rc | what it enumerated |
|---|---|---|
| `npm run lint` | **0** | eslint 0 errors AND 0 warnings; `check-rules-staleness: OK (10 rule files)`; `check-docs-registers: OK`; ratchets `closesWhenPoToRule=141/147 severityPerEmoji=132/135 longHeadings=94/97 lessonsProseOnly=52/52` — every one **down**, none raised |
| `supabase db reset --local` (fresh, before the suite) | **0** | 54 s |
| `npm run test:db` | **0** | `Files=262, Tests=8876`, `Result: PASS`, 87 wallclock s. ⭐ **The shape did not move** — identical to the baselines captured before any change, and no `.sql` was added under `supabase/tests/` |
| `ARM=census` | **0** | `INVARIANT HOLDS` — live authz gates **581**, gates carrying a verdict **625**; domain note printed (`427` reachable command doors are C2's, not this arm's) |
| `ARM=hat` | **0** | `INVARIANT HOLDS` — detector self-test **7/7**, `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` |
| `ARM=floor` | **0** | `INVARIANT HOLDS` — **63** authenticated-reachable `prosecdef` doors with 0 calls, every one on the floor allowlist, and every allowlist entry resolving to a live door |
| `FROMFINDINGS=1 ARM=wrapper` | **0** | `INVARIANT HOLDS` — BLIND set **41**, all allowlisted |

⛔ **No BLIND and no ERROR anywhere in the four arms.** Each arm's own degenerate-body preflight
(`FUP-AUTHZ-HARNESS-TRANSACTIONAL`'s §7.16 guard) passed before it ran.

⛔ **The diff-scoped door sweep is NOT owed**, measured rather than asserted:
`git diff --name-only main... -- supabase/migrations supabase/seed.sql src` prints **nothing**
(0 lines). No production function, policy, migration or seed changed anywhere in this unit.

#### What was NOT done, and why

- **Commit 5 (§2.3, the transactional residual / DB marker) is not built** — the PO's Q2 ruling is
  pending. `FUP-AUTHZ-HARNESS-TRANSACTIONAL` stays **open**, with the pending ruling written onto
  its `**Status:**` line and nothing else touched.
- **Arm 4b's `NOT RUN` branch is not proven able to fire.** It needs *both* the scratch sidecar and
  the committed findings table absent, and the committed file cannot be removed from a working tree
  without a change outside this unit's scope. Two echo lines, unexercised — stated rather than
  counted as covered.
- **No full sweep**, as the plan required. Every run was `CASES=`- or `SUITE=`-narrowed.

#### Deviations from the approved plan

1. **`nohup setsid` does not exist in Git Bash here.** Detachment used PowerShell `Start-Process`
   on `C:\Program Files\Git\bin\bash.exe` with redirected output — a genuine detach on Windows, and
   the first (failed) `nohup setsid` attempt started nothing.
2. **A malformed commit message on the first attempt at commit 1** — a PowerShell here-string
   (`@'…'@`) was passed to the *Bash* tool, so the subject gained a leading `@` and the
   `Co-Authored-By` trailer stopped being the last line. Fixed by `git reset --soft HEAD~1` **after
   verifying `HEAD` was exactly the commit made seconds earlier** (`c8351de1`, parent `9c934039`),
   then re-committing from a message **file**. ⛔ `git commit --amend` was NOT used. Every later
   commit used `git commit -F <file>`.
3. **Commit 1's proof run was contaminated and re-done.** The first plant-B run was launched while I
   edited the *same script it was executing*; bash re-reads a script as it runs, the control flow
   scrambled, and the arm-4a message printed after a derivation that had already failed. The result
   was **discarded**, `public.cancel_event` restored and verified three ways, and the plant re-run
   cleanly. ⭐ **Never edit a script a detached job is executing** — the lesson of this session.
4. **The new follow-up's id** — `FUP-AUTHZ-INVOKER-…` rather than `FUP-INVOKER-…` (gate 13 CODES,
   above).
5. **`BASE_S_OVERRIDE`** is production surface added to make the retry net provable (§2.4 proposed
   it as `BASE_S_OVERRIDE`; built under that name).
6. **`.claude/rules/mutation-harnesses-are-not-killable.md` had to be COMPRESSED** to fit gate 8's
   hard 2048-byte cap (it was already at 2038). The cut fell on sentences, never on bounds — the
   SIGKILL-vs-SIGTERM correction, the catalog-verification rule, the ON_ERROR_STOP clause, the two
   uncovered harnesses, the `cmd <> 'SELECT'` discriminator and the suite-shape warning are all
   still present.
7. **Commits 3 and 4 touch one file**, so the file was rolled back to its commit-3 state with a
   scripted inverse of the commit-4 hunks, committed, then restored — rather than editing the
   script between two proof runs (see deviation 3). Both commits' behaviour was proven against the
   **final** text.

### 2026-09-04 — backend: PO ruling landed; ADR + hub corrections

⛔ **DOCS ONLY.** No script, migration, rule file or `docs/reviews/` file was touched in this turn;
the harnesses are byte-identical to `6b6aee64`. QA is reviewing in parallel and owns
`docs/reviews/`.

#### The four lead/PO rulings recorded

| # | question | ruling | where it landed |
|---|---|---|---|
| **Q1** | ADR 0189 review | read by the lead; the ADR **stays proposed** until PO approval at the Record step, with two corrections (the PO's detect-only ruling into D7, and the measured `RESET_EVERY` cost) | the ADR, below |
| **Q2** | `RESET_EVERY` default 20, on by default? | **APPROVED on by default** — bounding drift on the full sweep is the point, and subsets never fire it (the counter cannot fire on a worklist shorter than N) | already the built default; unchanged |
| **Q3** | arm 4b auto-refreshes on **growth**, reds on **reduction** | **APPROVED** — a strand can only *reduce*, so accepting growth silences nothing; the refresh stays **LOUD** (which enforcer grew, old → new) as ADR 0189 D3 already says | already built; unchanged |
| **Q4** | the 2026-09-04 forensic `INFLIGHT.sql.body` left in `/tmp` | **approved to leave**; its path and size recorded here so it can be found or deliberately deleted later | measured below |

⛔ **The PO's Q2 ruling on `FUP-AUTHZ-HARNESS-TRANSACTIONAL` is DETECT-ONLY** — a different Q2 from
the `RESET_EVERY` one above, and the two must not be conflated. Nothing was built for it: the
`c2n_sentinel` marker was **measured buildable and not built by decision**, and the entry is closed
on the ruling rather than parked.

#### What this commit did

1. **`FUP-AUTHZ-HARNESS-TRANSACTIONAL` CLOSED and rotated**, by the sibling mechanics of `6b6aee64`:
   a `### ✅ … — **RESOLVED 2026-09-04**` entry appended to `docs/followups/follow-ups-archive.md`
   carrying (a) the PO ruling **quoted verbatim** and attributed to the PO, (b) the lead's
   recommendation to BUILD the marker, recorded as **considered and not taken**, with the one
   advantage it had (a marker cannot be separated from the damage; a file sentinel can, by a
   different `TMPDIR`, machine or cleaned scratch dir) and its cost (a persistent scratch schema),
   and (c) the re-open trigger; then the filed body **verbatim**.
2. **Rotation witness — byte-extracted, `cmp`'d at the destination, and only then cut** (playbook
   §5). The body was quoted with `sed -e 's/^/> /' -e 's/^> $/>/'`; the destination lines were
   de-quoted with the **inverse** transform `sed -e 's/^>$/> /' -e 's/^> //'` and compared:

   ```
   cmp /tmp/hcs2/roundtrip-body.md docs/followups/FUP-AUTHZ-HARNESS-TRANSACTIONAL.md
   cmp rc=0        5763 bytes both sides
   ```

   ⚠ **The first round-trip attempt reported `differ: char 1516, line 20` and that was MY
   INSTRUMENT, not the move.** The body contains blockquote lines that are exactly `>`; quoting
   makes them `> >`, and my first de-quote (`s/^> //; s/^>$//`) blanked them. A naive inverse is not
   an inverse — the `cmp` earned its place by failing first.
3. **Body file retired** (`git rm docs/followups/FUP-AUTHZ-HARNESS-TRANSACTIONAL.md`) in the same
   commit as the cut, so no id sits in both registers and no orphan body survives (gate 13's
   `**Body:**` cross-check reds both ways).
4. **The `**Status:** open — ⏸ … awaiting Q2` note added in `6b6aee64` is GONE**, cut with the
   entry and deliberately **not** carried into the archive: it is now false, and an archived copy
   of a superseded pending-ruling line is exactly the prose rot the amendment discipline exists to
   prevent.
5. **ADR 0189** — `**Status:** proposed` kept. **D7 rewritten**: detect-only accepted by PO ruling
   (quoted), self-healing explicitly **not** a requirement, the marker **buildable and not built by
   decision, never by inability**, the re-open trigger, and the note that the §2.4 interlock checks
   `[ ! -s "$INFLIGHT" ]` **only** (a guard querying a table that does not exist is broken, not
   weaker). **Considered options** gained the marker design as *buildable, rejected by PO ruling*
   with its advantage and its cost. **Related** marks the follow-up closed; **Consequences** gained
   the all-four-closed bullet and **replaced the plan's `+40 min (~7 %)` ESTIMATE with the MEASURED
   ≈ +28 min on ≈ 9.5 h (≈ +5 %)**, naming the three measurements behind it (reset 49–54 s, one full
   suite 87 s, worklist re-derivation ≈ 60 s) and keeping the estimate only in parentheses.
   `npm run adr:index` rebuilt the index (187 ADRs, next free 0190; back-pointers already current).
6. **Hub** — the first acceptance bullet's **vacuous** formulation is kept `~~struck~~` with a dated
   `— **amended 2026-09-04 (F1, ADR 0189 D3)**` clause naming what was built instead (arm 4a +
   arm 4b); the `FUP-AUTHZ-HARNESS-TRANSACTIONAL` bullet flipped to `[x]`; the preamble gained a
   dated pointer that all four entries now live in the archive; `## Current state` REPLACED.

#### Q4 — the forensic artifact, measured now (not restated)

```
/tmp/c2-neutralizer-INFLIGHT.sql.body   = C:/Users/micha/AppData/Local/Temp/c2-neutralizer-INFLIGHT.sql.body
    18977 bytes, mtime 2026-09-04 15:00, holds public.mint_printed_document's definition
/tmp/c2-neutralizer-INFLIGHT.sql        = C:/Users/micha/AppData/Local/Temp/c2-neutralizer-INFLIGHT.sql
    0 bytes, mtime 2026-09-04 15:00   (the sentinel: empty = no mutation in flight)
```

⚠ **This is NOT the incident's own artifact any more.** The 09:38 forensic capture cited in ADR
0189's Context — `cancel_event`'s **1194-byte** body — was **overwritten by a later plant run** at
15:00, which is precisely
[[a-cited-line-number-rots-when-its-artifact-is-overwritten]]: a fixed-path scratch file is a
sentinel, not an archive, and this unit's own plants clobbered it. The bytes quoted in the ADR were
read at the time and are not re-derivable from this file. Both files are safe to delete (the
sentinel is empty, so nothing is in flight); left in place, they are harmless.

Also still on disk from this unit, same directory, if a cleanup is wanted:
`/tmp/c2-neutralizer/` (worklist.tsv 22178 B, worklist.sql, progress.tsv,
`c2-command-door-findings.SUBSET.md`, mut.sql), `/tmp/c2-rerun/`, `/tmp/c2probe/`, `/tmp/c2sweep.sh`.

#### What this commit did NOT do

- **No code.** No harness, script, migration, seed, rule file or `src/` change — the diff is
  `docs/` only plus the deleted body file. The diff-scoped door sweep remains not owed for the same
  measured reason as `6b6aee64`.
- **No QA review file.** `qa` is running in parallel and owns `docs/reviews/`; nothing there was
  created or edited.
- **ADR 0189 is NOT accepted** — it stays `**Status:** proposed` by lead ruling Q1, for the PO at
  the Record step.
- **The marker was not built**, and no stub, table, schema or knob for it exists.
- **No gate beyond the lint chain was re-run.** `npm run test:db` and the four authz arms were green
  at `6b6aee64` and nothing in this commit can move them; re-running them would measure the same
  tree.
