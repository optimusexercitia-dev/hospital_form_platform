# REGISTER-GATE-HYGIENE — QA review (pre-AE5 Batch 6)

**Reviewer:** `qa` · **Date:** 2026-09-08 · **Head reviewed:** `46e58bba` (branch
`authz-register-gate-hygiene`, working tree clean at review start and at review end)
**Subject:** pre-AE5 **Batch 6**, unit `REGISTER-GATE-HYGIENE` — five follow-ups, six ids.
**Round:** 1

## Verdict: **CHANGES REQUESTED**

Two MAJOR items, both documentation-grade, both cheap, neither requiring a DB re-run. Every
security-relevant and mechanical claim I could reach reproduced exactly. The blocking half is
that the unit shipped a **fourth** instance of its own named failure shape — *correct in
DIRECTION, unmeasured in MAGNITUDE* — in the one place the unit itself flagged as the residual
bound (MAJOR-1), and that one of the five clauses **cannot be closed on its own text** as the
unit's acceptance criteria require (MAJOR-2).

---

## 0 · Scope of this verdict, written down so it cannot be inferred wrong

I re-derived, from scratch, the figures that carry weight, and I say below which ones I did
**not**. I mutated every new or changed gate arm I could reach and verified each mutation was
**present in the file** before trusting its result — one of my own mutations silently failed to
apply and reported a meaningless green (§6), which is why every result here names its proof.

This review covers `main...46e58bba`: 34 files, `+2979/−149`. It does **not** cover the six
non-AE2 ledger rows as *content* (see MINOR-5).

---

## 1 · What I re-derived, and what reproduced

| Claim (record / hub / source comment) | My measurement | Verdict |
|---|---|---|
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` **EMPTY** | empty; the only commit after the gate run (`46e58bba`) touches `docs/progress/register-gate-hygiene.md` alone | ✅ E2E genuinely not owed |
| `npm run lint` rc 0, 0 errors / 0 warnings, eslint running | **rc 0**, read bare, all 13 gates, eslint present | ✅ |
| `npm run typecheck` rc 0 | **rc 0** | ✅ |
| `npm run test` — 151 files / 2,056 tests | **rc 0, 151 files / 2,056 passed** | ✅ |
| ledger on `main`: **81 rows, 52 unbolded / 29 bolded** | 81 data rows (lines 49–129), 52/29 | ✅ (plan's "six of 76" refuted, correctly) |
| the 6 workaround rows = *unbolded ∧ after the first bolded row* = lines 124–129 | exactly `AE4`, `HARNESS-CRASH-SAFETY`, `DOOR-SWEEP-DERIVER`, `PRED-DOMAIN`, `WRITEPATH-BASELINE`, `ENFORCEMENT-MANIFEST`; **0 unbolded rows after the boundary at HEAD** | ✅ derived, not hand-listed |
| ledger at HEAD: **88 rows, all 9 cells**, no duplicate ids | 88 rows, **88 with 9 cells**, 0 duplicates; `main`'s 8-cell row (`0136`, line 119) repaired by inserting the missing `Completed` cell | ✅ |
| **14** broken ADR link targets on `main`, **0** at HEAD, 0 wrong-case | independent census (no repo code imported): 954 relative links on `main` → **14 broken**; 962 at HEAD → **0 broken**, **0** wrong-case-only. Case-exactness proven live (`existsSync` returns `true` on a wrong-case ADR where my `readdirSync` walk returns mismatch) | ✅ |
| gate 9's `exists` is a `readdirSync` membership test, not `existsSync` | `makeCaseExactExists`, `scripts/build-adr-index.mjs:419-445`; line 436 refuses to fall back for out-of-root targets; funnelled through one seam at `:476-478` so self-test and gate cannot diverge | ✅ the NTFS trap is genuinely closed |
| readable review files **65 → 102** of 169, **none lost** | 169 files; `main` regex **49**, the `375726b2` intermediate **65**, HEAD **102**; **0 files matched before and not now** | ✅ exact |
| archive ratchet census: **144 ids = 23 with + 121 without**, `27 h2 + 117 h3` | 144 ids, 23 + 121 (parts sum), byLevel `{2:27, 3:117}` summing to 144, 170 entry headings, 0 undecided | ✅ |
| real population **179**, not 174 | my independent crude count of headings naming a `FUP-` id at levels 1–4: `{1:5, 2:34, 3:139, 4:1}` = **179** | ✅ |
| `SELFTEST=1 door-sweep-selftest.sh` → PASS 42 · FAIL 0 · SKIPPED 0, groups 16 · 18 · 8 | **rc 0**, `PASS 42 · FAIL 0 · SKIPPED 0`; `--- GROUP deriver: 16`, `merge helper: 18`, `audit startup capture: 8`, all derived, no literal | ✅ |
| harness self-tests: door 33/33, writepath 27/27, rowdoor 9/9, invoker 10/10 | all four **rc 0** at those totals, read bare, each printing `SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=0` and `SELECTION-SOURCE: CASES UNSET -> FULL run` | ✅ |
| committed findings baselines and the BLIND allowlist untouched | `git diff --stat main...HEAD -- docs/reviews/` **empty**; `-- supabase/tests/mutation/*.txt` **empty** | ✅ |
| the five follow-ups remain `open`; closure deferred to the Record step | all six ids `**Status:** open`; `docs/followups/follow-ups-archive.md` **untouched** on this branch | ✅ nothing closed early |

### 1a · The rc 3 / rc 3 distinction is correct

The record distinguishes the deriver's `rc 3 NOT-APPLICABLE` (no migration in the diff) from the
`rc 3 UNPROVEN` an empty `CASES` now produces *inside a sweep*. That distinction holds: they are
produced by different programs (`scripts/door-sweep-cases.sh` vs `p0-authz-*-audit.sh`), from
different predicates, and the quoted `SCOPE:` line says `derivation: NOT REACHED`, which the
UNPROVEN exit never says. Conflating them would indeed be its own defect, and the record does not.

### 1b · The load-bearing half of the residual claim is TRUE

`scripts/check-docs-registers.mjs:345` — *"No `complete` hub depends on one."* I measured it
against `checkHub`'s actual predicate (`:579-581`, `inLedger || approved`):

- **9** `complete` hubs. Every one passes, and none passes *only* through an unreadable review.
- `c2-tier1` is the only one with **no ledger row**; it passes on `c2-tier1-closure-review.md`,
  which the HEAD regex reads as APPROVED.
- Every "not-readable" review linked from a `complete` hub is a genuine **CHANGES REQUESTED**
  earlier round (`authz-ae4-review.md`, `authz-ae4-gate-review.md`, `door-sweep-deriver-review.md`,
  `enforcement-manifest-review.md`, `enforcement-manifest-rereview.md`, `pred-domain-review.md`,
  `c2-command-door-findings.md`, `c2-suite-abort-diagnosis.md`) — correctly unreadable.

This is the half that would have been a BLOCKER, and it holds.

---

## 2 · Proven-able-to-fire — the mutations I ran

Every mutation below was applied to a **copy**, verified present in the file by a `grep -F` on
the replacement text before the run, and its exit code read **bare**. The tree was verified clean
(`git status --porcelain` empty) after each batch; no mutant survived.

### Gate 13 (`check-docs-registers.mjs --self-test`), baseline rc 0

| # | Mutation | Bare rc | Self-test named it? |
|---|---|---|---|
| M1 | `hubHasLedgerRow` reverted to the space-only quantifier | **2** | ✅ `hubHasLedgerRow ACCEPTS "\| **AE4** \| x \|"` + `HUBS complete via BOLDED ledger row ok` |
| M2 | verdict regex middle reverted to `[\s*]{0,4}` (the `375726b2` partial) | **2** | ✅ 5 acceptance rows, incl. ``**Verdict: `APPROVED`**`` and `**Verdict:** **APPROVED**` |
| M3 | verdict regex `i` flag dropped | **2** | ✅ 4 rows, incl. `# ✅ VERDICT: APPROVED` and `verdict: approved` |
| M4 | verdict regex middle **over**-widened to `.{0,8}` | **2** | ✅ 8 **rejection** rows: `**Verdict: NOT APPROVED**`, `**Verdict:** ~~APPROVED~~`, `# ⛔ VERDICT: NOT APPROVED`, … |

M4 is the one that matters most: the safety argument (*"`NOT` and `CHANGES REQUESTED` are
letters, so no decoration can span them"*) is not prose — it is pinned by rejection fixtures that
red the moment the class is widened. This is a genuine two-sided gate, not a widening.

### The archive ratchet, mutated on its DOMAIN

Cap is `121` with **zero headroom** (live count 121), which is exactly what the follow-up's clause
asks for (*"what must stop is the next closure dropping it"*).

| Plant | `missing` | ratchet reds? |
|---|---|---|
| a field-less archived entry at `###` | 121 → **122** | ✅ `[RATCHET] archiveMissingClosesWhen is 122, cap 121 — may only be lowered` |
| a **correct** archived entry *with* the field (discrimination half) | 121 → **121** | ✅ does **not** red |
| a field-less entry at `##` | 121 → **122** | ✅ reds — the level the old `^### ` domain missed |
| a field-less entry at `####` | 121 → **122** | ✅ reds |

The domain re-derivation from a *syntax* to the *property* is real and I confirmed it fires on
exactly the levels the first cut was blind to.

### The four sweeps

| # | Mutation | Bare rc | Named? |
|---|---|---|---|
| H2 | door `want()` reverted to the value test (`[ -z "$CASES" ] && return 0`) | **1** | ✅ **only** rows `C CASES="" EXPLICIT ⭐ THE FIX, vs A` and `E3 … count_sel = 0` |
| H3 | door `set_placement()` drops the `BASE_SHAPE_OVERRIDE` disjunct | **1** | ✅ **only** row `D BASE_SHAPE_OVERRIDE, CASES unset ⭐ trap 1` |
| H1 | door startup set-ness capture destroyed (the exact pre-fix defect) | **0** | ❌ by the door's own self-test (33/33) — **by design**, see below |
| H4 | rowdoor startup capture forced to `0` | **0** | ❌ by rowdoor's own self-test (9/9) — same |

H1/H4 are the interesting pair. The harness comments (`p0-authz-door-audit.sh:101-105`) say
outright that an in-harness fixture cannot catch this, because every fixture assigns
`CASES_EXPLICIT` itself — *the instrument primed by its own fixture*. The compensating control is
the two-process group. **I proved that control works**: I built mutants of the door and rowdoor
harnesses with the startup capture destroyed (verified present), re-pointed a **copy** of the
shipped `door-sweep-selftest.sh` at them, and ran the shipped group:

```
FAIL  zz-qa-mdoor CASES empty -> startup=1   CASES="" must capture 1  ⭐ the polarity one process cannot see
FAIL  zz-qa-mrow  CASES empty -> startup=1   CASES="" must capture 1  ⭐ the polarity one process cannot see
--- GROUP audit startup capture: scenarios 8 (pass 6 · fail 2 · skipped 0)
```

Bare rc 1, failing **only** the mutated harnesses and **only** the `empty → 1` polarity, while the
two unmutated harnesses stayed green. The "pair is the control" claim is not prose; it is
measured. *(The 14 deriver-group failures in the same run are noise from my re-pointing, which
broke the fake-repo build — my instrument, not a finding.)*

### Gate 11 (CRLF)

Design is sound: CRLF named first, normalisation before parsing **and** before the byte cap, the
no-frontmatter early-return path covered, and both polarities in the self-test (`crlf-named` red /
`lf-not-accused` green) — correct, because the defect was **attribution**, not detection. But see
MINOR-2: the *detection* half is unwired from any assertion.

---

## 3 · Clause-by-clause: does each follow-up's OWN text close?

I read the six clauses **in the register**, not the hub's paraphrase.

**(1) `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE`** (`follow-ups-open.md:1296`)
— *"`hubHasLedgerRow` tolerates `**` … and the verdict regex becomes case-insensitive and tolerant
of a leading emoji, both **proven able to fire**; then the AE4 row is re-bolded so no row is
load-bearing on its formatting. ⛔ Not by rewriting 76 rows to drop their bold."*
✅ **CLOSES.** Both regexes widened; both proven able to fire (M1–M4, both polarities); AE4 and
the five siblings re-bolded, derived as a property; no row unbolded to make the gate pass. The
"76" is refuted with a dated derivation rather than a rewrite. The sequencing finding — *four*
complete hubs, not just AE4, were passing on their ledger row alone — is real: I reproduced it,
and re-bolding any of them before `375726b2` would indeed have redded the gate.

**(2) `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE`** (`follow-ups-open.md:995`) — *"**Closes when:** PO to rule."*
⚠ **The substance is delivered; the clause is not closable as written.** See **MAJOR-2**.

**(3) `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER`** (`follow-ups-open.md:470`)
✅ **CLOSES.** (a) AE2's row exists at ledger line 127, 9 cells, self-describing as
`ROW RECONSTRUCTED 2026-09-08`, with every cell marked *transcribed, not measured here* and a ⛔
against the stale task table in `authz-ae2.md`. I confirmed `28d90212 phase(AE2): complete` exists.
(b) discharged by derivation with the rules and their failure modes recorded — including the
discarded R4 rule and the *citation-is-relevance-not-identity* join defect, which is the kind of
finding that only comes from actually deriving.

**(4) `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD`** (`follow-ups-open.md:1706`)
✅ **CLOSES.** The clause's own instruction — *"confirm which gate owns register shape first"* —
was followed (gate 13; gate 7 disclaims it at `check-progress-doc.mjs:48-50`). The ratchet route
was taken, is proven able to fire in both directions, and retrofitting was correctly **not**
done. The `27 of 174` (2026-09-04's `3`) is treated as a grain/date difference, not a rewrite —
correct, and consistent with the 12-vs-38 precedent.

**(5+6) `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` + `…-WRITEPATH-BASELINE-CASES-EMPTY-STRING-…`**
(`follow-ups-open.md:1096`)
✅ **CLOSES — and closes more literally than the hub claims.** The clause names four things:

- *both harnesses distinguish unset from set-and-empty* → ✅ all **four** sweeps do (H2 reds only
  on reversion; door row C is the `A`-vs-`C` control the twin clause demands: same value, opposite
  selection, opposite placement, bare exit).
- *proven able to fire by a `scripts/door-sweep-selftest.sh` scenario that passes `CASES=""`* →
  ✅ `scripts/door-sweep-selftest.sh:547` (`CASES="" bash "$1"`). The recon said this home *could
  not host the fix*; the build **made it able to**, by launching the real harnesses under
  `SELFTEST=1` from a second process. That is better than the PO ruling, not a deviation from it.
- *the lead-playbook §4 recipe reads the deriver's EXIT CODE before substituting its stdout* →
  ✅ `docs/lead-playbook.md:101-117` now carries the two-step form with `rc` read bare.
- *(widened)* *every parent invocation asks for a full run with `unset CASES &&`* → ✅ all four
  sites in `p0-authz-invariant.sh` (`:339`, `:340`, `:341`, `:773`). I swept the repo: **zero**
  executable `CASES= <cmd>` invocations remain; every remaining hit is prose or a warning string.

⭐ ADR **0079 § The recipe** was additionally edited to the two-step form with the superseded
one-liner quoted **below** the correction so a reader cannot act on it (R45). That is where the
substitution actually lived, and editing it is the correct call.

**Scope beyond the clauses — both justified.** (i) The `p0-authz-invariant.sh` caller repair was
PO-ruled and the clause was widened in the register itself, with the latent-not-observed bound
written down honestly (`:1103`). (ii) The `rowdoor`/`invoker` domain gate was a builder call: the
named fix alone would have swapped a silent **full** sweep for a silent **zero** sweep at exit 0.
That reasoning is correct, and the partial nature is written up on
`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` with the bound stated three ways
(*"exit 3 for the EMPTY-SELECTION case ONLY"*, *"a run with BLINDs still exits 0"*, *"not claimed
as observed"*). The residuals it leaves are filed with measured detail, not gestured at:
`FUP-AUTHZ-C2-NEUTRALIZER-EMPTY-CASES-NOT-PORTED` (with the four-disjunct divergence at `:134`
and the `case`-glob selector at `:880` measured, which is why a template port would have been the
copy-not-port error) and `FUP-DOOR-PARTIAL-RUN-BLOCKQUOTE-KEYED-OFF-PLACEMENT` (which explicitly
refuses to call itself proven because the line is now unreachable for `CASES=""`). This is the
right shape.

---

## 4 · MAJOR findings

### MAJOR-1 — the residual bound is a fourth *direction-fixed, magnitude-unmeasured* claim, and its stated MECHANISM is wrong for half the class

**Where:** `scripts/check-docs-registers.mjs:342-345`; the identical claim in
`docs/lint-gates.md:29` (*"14 remain unreadable because they put *words* before the label"*); and
`docs/progress/register-gate-hygiene.md:276-278`.

**The claim:** *"⚠ BOUNDED, STATED: **14** files remain unreadable because they put WORDS before
the label (`## Re-review (2026-07-17) — VERDICT:`, `**Reviewer:** … · **Verdict:**`,
`TOP-LINE VERDICT:`). Admitting those means admitting arbitrary leading words, which readmits
`Prior verdict: APPROVED` — so it is FILED, not fixed."*

**My measurement.** 67 of 169 review files are unreadable to the HEAD regex. Of those, **20**
carry a genuine, non-negated APPROVED verdict. Not 14. And they fall into **three** shapes, not one:

| Shape | Count | Example |
|---|---|---|
| **A — words before the label** (the shape the comment names) | **9** | `authz-gate-2-review.md:12` `## Re-review (2026-07-17) — VERDICT: ✅ **APPROVED**`; `f-cleanup-review.md:15` `## TOP-LINE VERDICT: ✅ APPROVED`; also `authz-m1-review.md`, `case-surface-split-increment-2-review.md`, `memberships-collapse-review.md`, `phase-16-review.md`, `phase-17-review.md`, `phase-AI-review.md`, `phase-FF-1-review.md` |
| **B — the label is a bare heading, the verdict is the NEXT LINE** | **10** | `pre-pilot-hardening-wave1-review.md:9` `## Verdict` → `**APPROVED.**`; also `adr-0136-deferred-signoff-review.md:131`, `aff-review.md:12`, `dm5-phase-review.md:484`, `ff-2-review-r2.md:7`, `phase-14-review.md:13`, `phase-p3-review.md:1269`, `referral-detail-redesign-review.md:11`, and the second occurrences in `phase-16`/`phase-17` |
| **C — deliberately excluded by design** | **1** | `dm5-s5-review-r2.md:3` `> **Verdict: ✅ APPROVED (r2)**` — blockquoted, and `>` is excluded on purpose |

Parts sum: 9 + 10 + 1 = 20. *(A twenty-first, `eth-e4-review.md:920` `# VERDICT (r3): **APPROVED**`,
is class A by a digit rather than a word.)*

**Why this is MAJOR, not cosmetic.** Three reasons, in ascending order:

1. The figure is understated by ~43 % and is committed in **two** places, one of them
   `docs/lint-gates.md`, which is the file a future session reads to size this decision.
2. The stated **mechanism** — *"they put WORDS before the label"* — is false for **10 of the 20**.
   Class B has nothing before the label at all.
3. Consequently the stated **reason not to fix** — *"admitting those means admitting arbitrary
   leading words, which readmits `Prior verdict: APPROVED`"* — **does not apply to class B**.
   A heading that is `## Verdict` and nothing else, whose next non-blank line begins with
   `APPROVED`, cannot be reached by `Prior verdict: APPROVED`. Half the residual was filed under
   a rationale that is not true of it. That is a decision made on a wrong premise, which is more
   than a wrong number.

This is the same shape the unit itself catalogues three times in its own record (the verdict
regex, the ratchet's domain, gate 11's diagnosis) — *correct in DIRECTION, unmeasured in
MAGNITUDE*. It is the fourth, and it is in the residual note of the very repair that produced the
other three.

**What I am asking for (not a re-run of anything):**
- (a) Re-derive the residual and correct the figure and the mechanism in all three places, with
  the partition stated (class A / class B / deliberate exclusion) so the parts sum.
- (b) State separately whether class B is being fixed or filed. If filed, give a reason that is
  true of class B. ⛔ I am **not** asking for the widening — if you take it, it needs its own
  rejection fixtures. The blocking item is the false bound, not the unfixed residual.
- (c) The load-bearing sentence *"No `complete` hub depends on one"* is **correct** and I verified
  it; keep it, and it stays correct at 20.

### MAJOR-2 — one of the five clauses cannot be closed on its own text

**Where:** `docs/followups/follow-ups-open.md:995` — `**Closes when:** PO to rule`, **unchanged on
this branch**.

The unit's own acceptance criterion (`docs/features/register-gate-hygiene.md:21-25`) is explicit:
*"each on its own `Closes when` clause, quoted **there**, not paraphrased here. Nothing else
counts as closure."* The PO ruling of 2026-09-08 (gate + repair all 14 as one work item, `exists`
hardened, ⛔ not allowlisted past its own findings) is recorded in the **hub** and the **record**
— but not in the entry. At the Record step, whoever closes this entry must quote a clause that
reads `PO to rule`, which discharges nothing and is exactly what the `closesWhenPoToRule=137/147`
ratchet counts.

Compare the treatment the other four got: `FUP-AE2` gained inline `✅ DONE`/`✅ DISCHARGED`
annotations on its clause (`:470`), and the empty-`CASES` twin gained an explicit
`⭐ … the Closes when above is WIDENED` block (`:1101`). This entry got neither.

**Ask:** write the PO ruling into the entry as its `Closes when` (or as a dated `⭐ RULED
2026-09-08 …` annotation on it, matching the pattern used at `:1101`), preserving the entry's own
bar — *"the gate may not be allowlisted past its own findings"* — so the closure quotes a
condition that can be checked. This lowers `closesWhenPoToRule` by one, which the ratchet permits.

---

## 5 · MINOR findings

**MINOR-1 — gate 9's own header comment miscounts the corpus it repaired.**
`scripts/build-adr-index.mjs:389` reads *"14 dangling targets in **8** files"*. It is **9** files:
`0053`, `0056`, `0063`, `0064`, `0072`, `0073`, `0078` (5 links), `0105`, `0191` (2 links).
Independently derived, and corroborated by `git diff --stat main...HEAD -- docs/decisions`, which
shows exactly nine files carrying link repairs. The 14 and the 954 are both right; only the file
count is wrong. Same family as MAJOR-1, in the same batch, in the sibling gate.

**MINOR-2 — gate 11's CRLF *detection* is wired to nothing that can red.**
`scripts/check-rules-staleness.mjs:386` computes `const crlf = /\r\n/.test(raw)` and passes it to
`checkRule(..., crlf)`. The self-test drives `checkRule` with a **literal boolean**
(`red('crlf-named', checkRule('r', good, ok, 0, true))`), so it proves the *reporting* half and
says nothing about the *detection* half or the normalisation wiring. I severed the caller —
`const crlf = false /* QA MUTANT */`, mutation verified present in the file — and measured:
`--self-test` → **bare rc 0**, `self-test OK (all checkers proven able to fail)`; the gate itself
→ **bare rc 0**, `OK (10 rule file(s))`. The four-arm CRLF-worktree verification in the record is
real and I do not doubt it, but it was a **hand run recorded in prose**; nothing gates it. This is
`a-green-bar-misses-the-wired-seam` / `declared-param-no-caller-blind-spot`. A one-line fixture —
a CRLF byte string written to a temp file, read through the same path — would close it. Not
blocking: gate 11 repairs a diagnostic message, not a boundary, and `crlf=false` is the correct
value on an LF tree, so the mutation is behaviourally invisible here by construction.

**MINOR-3 — the startup-capture group can silently shrink to fewer scenarios at exit 0.**
`scripts/door-sweep-selftest.sh:550` — `[ -f "$h" ] || continue` — is evaluated *before*
`audit_polarity`, whose own "harness not found" FAIL branch (`:530-531`) is therefore **dead
code**. If a sweep is renamed or moved, the loop drops that harness silently: the group prints
`scenarios 6` instead of `8` and the suite still exits 0. The only anti-vacuity guard is the
whole-suite `PASS+FAIL+SKIP == 0` check at `:573-577`, which cannot see a *partially* empty group.
Given this batch's own thesis — *a run that measured nothing must not read as a run that measured
everything* — the group deserves the same guard at group grain (assert the loop ran four
harnesses, or delete the `|| continue` so the existing FAIL branch becomes reachable).

**MINOR-4 — the record attributes content to ADR 0194 that ADR 0194 does not carry.**
`docs/progress/register-gate-hygiene.md:199` states *"ADR 0194 records that the clause named two
wrong homes and why."* It does not. 0194 records the **caller** widening well (`§ Problem 2`,
`:40-45`) and the ADR 0079 recipe edit (`:96`), but contains nothing about
`scripts/door-sweep-selftest.sh`, `docs/lead-playbook.md` or `CLAUDE.md` being unable to host the
fix. Grepped for `cannot host` / `wrong home` / `two homes`: zero hits.
⭐ The right repair here is probably **deletion, not addition**: as built, both named homes *do*
host the fix (§3, item 5+6), so there is no live deviation for 0194 to record — and the hub's
`docs/features/register-gate-hygiene.md:57-59` and record `:167-177` currently describe a
deviation that did not ship, which will read to a later session as an unfixed gap. Say instead
that the clause's homes were *made* able to host the fix.

**MINOR-5 — `LEDGER-COMPLETENESS` arrives on this merge as an unreviewed, still-`in_progress` unit.**
`docs/features/ledger-completeness.md:4` is `status: in_progress` with `reviews: []`, while its own
`### In progress` block reads *"Nothing — the ruled work is written"*. Its branch
`claude/zen-vaughan-7dcae2` still exists locally, which is the only reason gate 13 passes; delete
it and gate 13 reds. Substantively: **six of the seven ledger rows this merge adds** (`AI`,
`QO·FUP`, `CS·1`, `DSR`, `DOCS-RESTRUCTURE`, `DOCS-CONSOLIDATION`) are its deliverable, and Batch
6's acceptance criteria cover only AE2's. I verified them **structurally** (88 rows, all 9 cells,
no duplicate ids, all seven marked reconstructed, and `phase(x): complete` commits exist for
`AE2` `28d90212`, `AI` `b0387d31`, `case-split-1` `0ab4b2da`, `QO·FUP` `38b4f3a7`, `DSR`
`96a46231`) — I did **not** review their cell contents. The unit needs a disposition at the
Record step: flip it `complete` with a ledger row or a review, or fold it into Batch 6's record
and retire the hub. Leaving it `in_progress` also blocks the next unit's own stated precondition
(*"`docs/features/INDEX.md` shows no `in_progress` hub"*).

---

## 6 · INFO

**INFO-1 — my own mutation harness reproduced the batch's warning, live.** My first attempt at
MINOR-2's mutation used a shell heredoc; the shell ate a backslash level, the anchor was not
found, and the run that followed executed the **unmutated** copy and reported `BARE RC=0`. Had I
not printed the anchor-not-found line and re-grepped, I would have recorded a green that meant
nothing — the exact failure the record documents twice. Every result in §2 names the proof that
its mutation was present.

**INFO-2 — the record's honesty about what was not run is correct and should be preserved.**
`ARM=policy` in FULL SWEEP mode (~105 min) was deliberately not run, and the caller repair in
`p0-authz-invariant.sh` is therefore verified by construction and self-test rather than by
execution. That is stated rather than implied, which is right. I reached the same conclusion
independently: no Phase Gate arm reaches that branch.

**INFO-3 — the `node_modules` incident and the re-certification.** The re-run discipline is
adequate and, more importantly, correct in principle: `lint` and `typecheck` were re-run **after**
`npm ci` and reported from that run, because *a green from a damaged tree is not a claim about the
commit*. I independently reproduced `lint` rc 0 (0/0), `typecheck` rc 0 and `test` 151/2,056 at
`46e58bba` on a tree I did not repair, which is the strongest available confirmation.

**INFO-4 — the `DSR` ledger row is a PO decision already banked and is explicitly not mine to
rule on.** I note only that the row invites its own removal in its own text and says so in cell 3,
which is the right way to hand a PO a decision.

---

## 7 · What I could NOT verify — a work item list, not a footnote

⛔ Each of these is an open item for the lead to discharge or to accept explicitly. None is a
finding; all are gaps in **my** coverage.

1. **`npm run test:db` — 262 files / 8,882 tests on a fresh reset.** Not run. `supabase db reset`
   is forbidden to me for this review. The record's rc 0 stands on the lead's run alone. ⚠ Note
   the batch changed **no** migration and **no** `src/` file, so the pgTAP figure is not a claim
   about this diff — but it is also not a figure I checked.
2. **The four authz arms** (`census` 581/608, `hat` 7/7 + 4 allowlisted, `floor`,
   `FROMFINDINGS=1 wrapper` BLIND 41). Not run — each needs the live stack and minutes to tens of
   minutes. ⚠ These matter more than usual here because this batch **edited their entry point**
   (`p0-authz-invariant.sh`). The four edited call sites are all inside the `else` branch that no
   arm reaches, which I confirmed by reading, but I did not confirm it by running.
3. **`ARM=policy` FULL SWEEP.** Not run (~105 min); see INFO-2.
4. **The content of the six non-`AE2` reconstructed ledger rows.** Structure verified, cells not
   reviewed. See MINOR-5.
5. **The gate-13 Windows branch-check fix on macOS/Linux.** The `execFileSync`-argv rewrite is
   correct by construction and cannot be platform-asymmetric, but I ran it on Windows only. The
   record's macOS claim rests on `3057ac1c`'s history, not on a re-run.
6. **Gate 9's target resolution on a case-sensitive filesystem.** Zero wrong-case links exist
   today (I measured, case-exactly), and the self-test's `links-wrong-case-detect` arm reds against
   the real filesystem — but the CI-side asymmetry itself was not exercised on a case-sensitive
   volume.
7. **The class-B widening I did not ask for.** If MAJOR-1(b) is answered by *fixing* class B
   rather than filing it, that change needs its own rejection fixtures and is outside what I
   reviewed.

---

## 8 · Summary

This is careful, well-instrumented work. Every gate arm this batch added or changed is proven
able to fire, and — the part that distinguishes it — proven able to fire in **both** polarities,
including the over-widening direction that a widening fix almost never tests. The empty-`CASES`
port was proven by **selection** rather than inheritance, the two-process control for the startup
capture is real and I broke it to confirm, the residuals are filed with measured detail and honest
bounds, and the follow-ups were correctly left `open`. The load-bearing claim of the whole batch —
that no `complete` hub depends on an unreadable review — is true.

What blocks it is small and self-similar: the batch that exists to stop *a prose claim about a
measurement that no gate can contradict* shipped one, in the residual note of its own headline
repair, with a mechanism that is wrong for half the class it names (MAJOR-1); and one of the five
clauses it set out to close still reads `PO to rule` in the only place a closure may quote from
(MAJOR-2). Both are documentation edits. Neither needs a DB reset, an E2E run, or a re-derivation
of anything I confirmed above; §1's table stands for the re-review, and I will re-check MAJOR-1's
partition and MAJOR-2's clause plus the five MINORs.

**Verdict: CHANGES REQUESTED**
