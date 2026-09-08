# REGISTER-GATE-HYGIENE — progress record

Register and gate hygiene: pre-AE5 remediation **Batch 6**. The unit's **summary** is its hub,
[docs/features/register-gate-hygiene.md](../features/register-gate-hygiene.md) § Current state; this
file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `scripts/check-docs-registers.mjs` (gate 13 — `hubHasLedgerRow`, `REVIEW_VERDICT_APPROVED_RX`,
the archive arm, the ratchets), `scripts/build-adr-index.mjs` (gate 9 — link **targets**),
`docs/progress/phase-ledger.md` (the AE2 row; the workaround bolding),
`supabase/tests/mutation/p0-authz-door-audit.sh` (the empty-`CASES` port and its self-test arm), and
`docs/decisions/0079-authz-door-blindness-standing-invariant.md` § The recipe (the substitution that
discards the exit code). Decisions: ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
(the recipe; exit 1/3 IS the claim), [0185](../decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md)
+ [0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md) (the register homes, the
ratchet idiom, the `complete` gate), [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
+ [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(the deriver's exits; the `BASE_SHAPE_OVERRIDE` knob),
[0192](../decisions/0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md) (the
write arm's `CASES` fix — the thing being **ported, not copied**),
[0193](../decisions/0193-the-enforcement-manifest-declares-what-it-measured.md) (where the live incident surfaced).

## Session log

### 2026-09-08 — unit opened (lead)

**Why now.** Batches 0–5 are concluded and on `main`; the plan's §6 checklist reads *"Batch 6 is
next"*, and it is the lead's own work. The window matters: a gate added mid-phase blocks that phase,
and AE5 adds ≥ 11 ADRs and runs the diff-scoped sweep eleven more times through the very recipe that
produces the empty `CASES` string.

**Preconditions, measured rather than assumed** (plan §6 step 1 — *a clean push state is an instant,
not a lease*): `git status` porcelain empty on `main`; `git rev-list --count origin/main..main` = **0**;
`docs/features/INDEX.md` shows no `in_progress` hub. Branch `authz-register-gate-hygiene` cut off
`main` @ `6810d95b`. ⚠ Gate 13 requires an `in_progress` hub's `branch:` to **resolve against local
branches**, so the branch was cut *before* the hub was written — the plan's §4 step 1 ordering
("commit; cut") would red the gate it tells you to run.

**ADR number.** `0194` — derived as *highest on any live branch + 1*, not the index's next-free:
`main` 0193, `origin/authz-enforcement-manifest` 0193, `origin/authz-c2-tier1` 0180. No collision.

**`program: DOCS`, not `AUTHZ`.** Batches 0–5 were all `AUTHZ` and this batch continues their plan,
but four of its five items are register/gate hygiene and only one touches an authz harness. The
`phase:` field carries the series key, so the batch stays findable from either direction.

---

#### Four read-only recon sweeps (parallel; no tree mutation, no harness executed)

⛔ Every figure below is a **measurement against `main` @ `6810d95b`, dated**. Three of the four
refuted a figure written in the plan or in a follow-up body. In each case the written figure was
**correct when written** — the repair form is a dated note beside it, not a rewrite.

**1 — the gates.** `hubHasLedgerRow` is `scripts/check-docs-registers.mjs:219-223`; it builds
`/^\| *<id> *\|/` per row, where `` *`` is a **space** quantifier, so `| **AE4** |` mismatches at
index 2 (the first `*`). The verdict regex is `REVIEW_VERDICT_APPROVED_RX` at `:250-254`,
`/^#{0,6} *\*{0,2}Verdict:[\s*]{0,4}APPROVED\b/m` — no `i` flag, and the only atoms allowed before
`Verdict:` are `#`, space and `*`. ⭐ A real casualty is already in the tree:
`docs/reviews/authz-ae4-gate-rereview.md:3` is `# ✅ VERDICT: APPROVED`, an unambiguous approval that
fails **twice** (leading emoji; `VERDICT` vs `Verdict`). That is the planted-red fixture, already
written by someone else.
Gate 13 owns register **shape** — gate 7 says so in its own header (`scripts/check-progress-doc.mjs:48-50`).
Both gates open `docs/followups/follow-ups-archive.md`, but only for a Body-link check
(`checkArchiveNoBodyLink`, `:806-817`) and id-collision extraction (`check-progress-doc.mjs:325-327`);
the `**Closes when:**` assertion at `:857-859` lives inside `checkFollowups({ open, … })` and the
archive text is never passed to it. Bounded negative: repo-wide, exactly **two** files contain the
string `Closes when` in code, and neither asserts it over the archive.
Gate 13 already carries the **eight ratchets** (`RATCHETS`, `:157-178`; `checkRatchets`, `:180-189`)
— *"may only be LOWERED"*. ⭐ That is the idiom the `Closes when` fix should reach for.

**2 — the ADR links.** Gate 9 is `scripts/build-adr-index.mjs`. Its only existence check is over the
**number map** (`analyse`, `:256-259`): a citation `[0171](./0171-anything.md)` yields target `'0171'`,
`byNum` has `'0171'`, green — the slug is never looked at, and the self-test bakes that in at `:629`.
Measured today: `npm run lint:adr-index` → rc 0, *"OK (191 ADRs indexed, next free 0194)"*, **with 14
dangling link targets in the tree**.
Re-derivation over 786 intra-`docs/decisions/` path links: **14 broken**, in 8 files, but only **10
distinct wrong strings** — `./0037-inter-committee-referrals.md` alone accounts for 5. Of 168 links
pointing **outside** `docs/decisions/`: **0 broken** (a census of all 168, not a sample). 0 case-only
mismatches, checked by `readdirSync` component walk rather than `existsSync`.
⚠ **13 → 14 is fully accounted**: 13 measured 2026-09-02, −1 (0177 repaired), +2 (ADR 0191, added
2026-09-05, carries two broken targets on one line). ⛔ The entry states *"the other 11 predate this
phase"* **twice**; its own enumeration proves **12**. Any option sized on 11 is sized wrong.
⭐ `0191:20` cites `./0176-ae49-resolver-contract.md` — the **slug of 0177 attached to the number
0176**. It renders as a sensible citation, gate 9 sees a number that exists, and the 2026-09-08 hand
audit that caught the *other* broken link **on that same line** missed it. That is direct evidence
for the entry's own claim that hand audits cannot contain this class.
The gate is not new code: `checkLinks(file, text, exists)` already exists
(`check-docs-registers.mjs:1051`) with fence and code-span blanking, and is already shared across
gates 7 and 13 *"so the two gates run one link checker, not two that could disagree"*. Its domain is
a hand-built `owned` array at `:1684-1688` that simply does not include `docs/decisions/`.
⛔ **The one real trap is Windows:** `exists()` at `:1117` is `existsSync`, which is case-insensitive
on NTFS. Zero wrong-case links today, so no hidden debt — but the gate would be silently
platform-asymmetric unless `exists` becomes a `readdirSync` membership test.
⭐ **The mechanism reproduced inside this very record, minutes after it was described.** The header
block above was first written with **seven** ADR links recalled from memory; **four** of them —
0185, 0191, 0192, 0193 — named slugs that do not exist (e.g. `0192-writepath-baseline-and-the-ported-reset.md`
for the real `0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md`). Every
one carried a **correct number**, so gate 9 would have passed all four, and `npm run lint:adr-index`
would have printed `OK`. They were caught only by an unprompted `ls` — i.e. by exactly the hand check
the entry says cannot contain this class. ⛔ These four are **not** added to the 14 and change no
count in this record: the 14 is a measurement over **committed** links, and these never reached a
commit. They are recorded because they are the cheapest available proof
that the repair is a gate and not a sweep — the corpus was clean of it for about four minutes.

**3 — the ledger.** ⛔ **Both figures in the plan are refuted as statements about the ledger.**
Measured: **81 rows** (lines 49–129), **52 unbolded / 29 bolded** — not 76 and not 6. Bolding starts
at line 95 (`**ETH·E1**`) and runs unbroken to 123 (`**AE3**`); the 46 rows before 95 were never
bolded (that era's convention), and the convention lapses again at 124. The plan's "six" names the
right **class** — the rows unbolded *as the gate workaround* — and that class is derivable as
*unbolded ∧ after the first bolded row* = lines **124–129** (AE4, HARNESS-CRASH-SAFETY,
DOOR-SWEEP-DERIVER, PRED-DOMAIN, WRITEPATH-BASELINE, ENFORCEMENT-MANIFEST). ⭐ Derived from a
property, never from the plan's list — which is what the plan itself instructed.
Three hazards a naive `s/| X |/| **X** |` would hit: line **119** (`**0136**`) has **8 cells, not 9**
— the `Completed` column is missing, so a column-indexed reader silently takes its commit as a date;
line **129** carries backslash-escaped pipes inside a code span, so a splitter ignoring `\|` parses
11 cells; and six rows (83, 88, 90, 91, 92, 95) have an **unbalanced `**`**, so any "is this already
bold?" test that counts asterisks answers wrong. Zero id cells contain a backtick, bracket or link,
so the id cell itself is safe to rewrite.
**AE2 is not the only gap.** Under the follow-up's own literal rule (record + QA verdict, diffed
against the ledger): AE2 is the only member that is simultaneously a self-declared *phase record*,
QA-APPROVED (r3), PO-approved and shipped to the remote (2026-08-29). Beyond it — **10** records with
a QA verdict and no row, a **~14-member UNDECIDED** mass of sub-phases under umbrella rows (`DM`,
`ff-program`, `pre-pilot-release`; `AE4 ↔ c2-tier1` is *resolved*, the row says so), and **5 ledger
rows with no record at all** (lines 68, 73, 75, 87, 119). ⭐ The strongest non-AE2 candidate is
`case-surface-split-increment-1`: increment **2** has a row (`**CS·2**`, line 115) and increment 1
does not, both PO-approved increments of the same split.
⛔ **A matching rule nearly hid the defect it was hunting.** Rule R4 ("slug starts with an id + `-`")
matched `authz-ae2.md` to the `AUTHZ` ledger row, because `AUTHZ` is both a ledger id and the
filename namespace for nine unrelated records. R4 was discarded for `authz-` and `dm-`. The
phase-vs-unit discriminator is the file's own H1, which ⛔ **trusts a title**: `docs-consolidation.md`
calls itself a "unit" while carrying a full APPROVED gate. The title is evidence, not proof.
AE2's evidence for the reconstructed row: record `docs/progress/authz-ae2.md`; reviews
`authz-ae2-review.md` (CR) → `-r2` (CR) → **`-r3` APPROVED**; `docs/progress/2026-Q3.md` lines
492/499/506; commits `28d90212` (`phase(AE2): complete`) and `50df9ec2` (drop `home_organization_id`);
complete 2026-08-28, shipped 2026-08-29. ⚠ **Trap:** `authz-ae2.md`'s own task table is **stale** —
it still shows `AE2.4 — drop the column` as `🔜` although `50df9ec2` performed the drop. Take the
outcome from `2026-Q3.md`, never from the record's status glyphs.

**4 — the archive grain (measured by the lead directly).** `docs/followups/follow-ups-archive.md`:
**174** archived FUP entry headings; **37** `**Closes when:**` occurrences, partitioned **27**
register-style at column 0 + **9** inside blockquote closure notes + **1** inline prose mention
(parts sum to 37). So **27 of 174** carry the field today, against the entry's measured **3** on
2026-09-04. ⛔ That is not a stale number to overwrite: the gap is the interim practice from Batches
1–2 onward actually working, and both figures stand with their dates and grains — the same
grain-not-drift rule Batch 3 recorded for 12-vs-38. It also confirms the entry's *"retrofitting is
explicitly NOT required"*: what must stop is the **next** closure dropping it, and a **ratchet** over
`archived entries lacking the field` is the shape that says exactly that.

**5 — the empty-`CASES` surface.** Both line numbers the follow-up names are still accurate
(`p0-authz-door-audit.sh:128`, `:1097`). Set-ness is destroyed at `:84` (`CASES="${CASES:-}"`, no
`CASES_EXPLICIT` captured first). The write arm's landed fix is `:257-265` (set-ness before the
default, with a `SELECTION_SOURCE` sentence per state), `set_placement()` at `:342-358`, the
three-state `want()` at `:556-566`, the rc-3 gate at `:1615-1624`, and the proving arm `sel_case` at
`:1283-1306` whose ⭐ control is *trial A (unset) vs trial C (set-and-empty)* — **the same value
reached two ways, with opposite selection and opposite placement**.
⛔ **Four things a copy would get wrong, and they are why the plan says *ported, not copied*:**
(i) the door's placement branch at `:128` has a **second disjunct**, `BASE_SHAPE_OVERRIDE` — a
self-proof knob that must stay in the subset set; dropping it re-opens the hole `:116` says once
pointed a fault-injected run at the committed baseline. (ii) `verify_baseline_untouched()` at `:233`
returns early unless `SUBSET_RUN=1`, so the cksum second lock is **disabled for exactly the case that
needs it**. (iii) fixing `CASES` flips `resets_enabled()` at `:179` for `CASES=""` (it becomes a
subset run, so the default `RESET_EVERY=20` stops firing) — a behaviour change the fix must
**intend**, not discover. (iv) the door's selection totals come from a file-reading `count_sel`
(`:1127-1141`) the write arm has no analogue for, and its self-test total is a **hardcoded `23`** at
`:656` that a new arm must move.
A third `$CASES` value test sits at `:1372` — the `PARTIAL RUN` blockquote written into the report
body, silent for `CASES=""`.
⛔ **The close condition names two homes that cannot host the fix.**
(a) `scripts/door-sweep-selftest.sh`'s `scenario()` (`:101`) only ever runs
`bash scripts/door-sweep-cases.sh` (`:125`) — the **deriver**, which has no `CASES` input. It never
executes either audit harness; it copies them in only so the deriver's `PRED_DOMAIN` lift has
something to read. And the door harness has **no `DRYRUN` mode** (only the write arm does), so an
end-to-end `CASES=""` → bare rc 3 assertion has nowhere to run without a live DB.
(b) Neither `docs/lead-playbook.md` §4 (`:98-105`) nor `CLAUDE.md` §6 step 1 (`:174-179`) contains a
`CASES="$(…)"` substitution. Both only **assert** that exit 1/3 is the claim. The substitution that
produced the incident is `docs/decisions/0079-…:106-109`, where the exit codes are a **comment** and
line 4 passes `$CASES` on unconditionally. ⭐ `scripts/door-sweep-cases.sh:36` already documents the
correct `|| <handle the exit code>` form that the ADR does not.
Confirmed in code that **exit 1 FINDING prints no case list**: the `case "$ARM"` block at `:1374-1378`
is the sole stdout `printf` in the deriver and is lexically after the `if [ -z "$CASES_LIST" ] … finish 1`
block, so a FINDING assigns the **empty string** and the guarding fact goes out on stderr, which
command substitution discards.
⛔ The follow-up's **write-arm** citations (`:315`, `:201`, `:1064`) are pre-ADR-0192 and now rot;
current sites are `:560` (`want`), `:347` (`set_placement`), `:1058`. The **door-arm** citations all
still resolve.

---

#### PO rulings (AskUserQuestion, 2026-09-08) — taken **before** the build, because each changes scope

1. **ADR cross-links** (`Closes when` was literally `PO to rule`) → **gate + repair all 14 as one
   work item**, with `exists` hardened so the gate is not platform-asymmetric. ⛔ Not allowlisted
   past its own findings.
2. **AE2** → **AE2's row + record the derivation here**; the non-AE2 gaps get a **task chip** to run
   on a separate worktree (`task_b5c3de2a`), carrying the derived sets, the discarded-R4 warning and
   the 8-cell row at line 119. ⛔ Batch 6 does not become a ledger project.
3. **Empty-`CASES` proof home** → **put the proof where it can run**: a `sel_case` arm in the door
   harness's own `SELFTEST=1` block mirroring ADR 0192's Arm 3, and **EDIT ADR 0079 § The recipe** to
   the exit-code-first form with the superseded text quoted (an operational instruction is edited,
   not annotated — R45). ADR 0194 records that the clause named two wrong homes and why.
4. **Re-bolding** → **the 6 workaround rows only**, derived as a property; the 46 legacy rows are
   left alone and the 81/52/29 derivation is recorded so the refuted figures are not re-quoted.

---

#### A sixth defect, found by the act of opening the unit — gate 13 could not pass on Windows

Opening the hub redded gate 13 with ``[HUBS] … — branch `authz-register-gate-hygiene` does not
exist`` **while the branch existed and was checked out**. Diagnosed, not guessed:
`check-docs-registers.mjs:1192` called `git("branch --list --format='%(refname:short)'")` through
`git()`, which interpolates into a **shell string**; `execSync` on Windows uses `cmd.exe`, which does
**not** strip single quotes, so every branch arrived quoted — measured directly:
`"'authz-register-gate-hygiene'\n'claude/zen-vaughan-7dcae2'\n'main'\n"`. `.includes(fm.branch)` is
then false for every possible value, so **no `in_progress` hub could pass gate 13 on this platform**.

⭐ **The quotes were not an accident — they were the fix for the other platform.** `git log -L` on
that one line: commit `3057ac1c`, *"gate 13 quotes its git --format so /bin/sh on macOS lists
branches — every in_progress hub redded as 'branch does not exist'"*. Bare, `/bin/sh` reads `(` as a
subshell; quoted, `cmd.exe` keeps the quotes. **The same check, the same symptom, the same message,
on the opposite platform** — one quoting choice cannot be right on both. This is
[[re-predicating-one-gate-can-invert-another-gates-failure-mode]] and
[[a-fix-correct-at-most-sites-hides-that-it-is-wrong]] in one line of code.

**Fix:** a shell-free `gitArgs(args)` using `execFileSync` with an argv array, so **no shell parses
anything** and neither platform's quoting rules apply. The commented rationale is at the helper.
⛔ It is deliberately a *second* helper, not a change to `git()`: `git()` has many string callers and
re-plumbing them all is not this unit's scope.

**Proven both directions, exit codes read bare, never through a pipe:**

| Arm | Hub `branch:` | Expect | Measured |
|---|---|---|---|
| 1 — discrimination | `authz-register-gate-hygiene` (real) | rc 0 | **rc 0**, `OK (… 12 hubs, … 81 ledger rows …)` |
| 2 — planted red | `authz-NO-SUCH-BRANCH-planted` | rc 1 | **rc 1**, ``branch `authz-NO-SUCH-BRANCH-planted` does not exist`` |
| 3 — clean-tree control, plant reverted | real again | rc 0 | **rc 0** |

⛔ A pass on arm 1 alone would have been indistinguishable from deleting the check; arm 2 is what
says the check still exists. ⓘ `git diff --stat` on the hub is **not** evidence the plant was
reverted — the hub is untracked, so that diff is empty either way. Arm 3's rc 0 is the evidence,
because gate 13 cannot return 0 unless the real branch name is present and resolves.

⭐ Arm 1's banner independently corroborates the ledger derivation: **81 ledger rows**, from a gate
that has no stake in the argument — the plan's "76" is refuted a second way.
⚠ Ratchets are printed at three caps already **at their limit** (`severityUnrated=29/29`,
`revisitWhenPoToRule=38/38`, `longHeadings=97/97`, `bugsUntriaged=10/10`, `bugsUnrated=40/40`,
`lessonsProseOnly=52/52`). ⛔ Consequence for this unit: a new LESSONS row whose Enforcement is
`prose only` **reds gate 13 immediately**. Any lesson written here must name a real enforcer.

**Not filed as a follow-up** — found and fixed inside one session, so the register would gain an
entry that is already closed. It is recorded here and belongs in ADR 0194.

**Also owed by this unit, found while reading (not in any register):** the plan's §6 step 2 says
*"four follow-ups"* — the table has had **five** rows since the empty-`CASES` item was batched in on
2026-09-08.

**Next.** ⛔ Plan the empty-`CASES` port **in full** before any edit to the harness — it opens a live
gate, and the batch's *"cheap, and the window is structural"* reasoning explicitly does not cover it.

### 2026-09-08 — build: four parallel streams, and the corrections each one forced (lead + backend)

**Streams and file ownership** (binding; no two streams shared a file). `gate13-fix` →
`scripts/check-docs-registers.mjs`. `adr-links` → `scripts/build-adr-index.mjs` + `docs/decisions/**`.
`cases-plan`/`cases-build` (backend) → `supabase/tests/mutation/*`, `scripts/door-sweep-selftest.sh`,
`docs/lead-playbook.md`, `docs/followups/follow-ups-open.md`. Lead → `docs/progress/phase-ledger.md`,
the plan, `docs/lint-gates.md`, this record, the hub. ⚠ `docs/decisions/` was held by `adr-links`, so
the ADRs were delivered as scratch drafts and applied by the lead afterwards (ruling R4).

#### The recurring shape: a fix correct in DIRECTION and unmeasured in MAGNITUDE

Three of this unit's own repairs shipped a first cut that read as complete and was not.

1. **The verdict regex.** `375726b2` admitted decoration BEFORE `Verdict:` and left `[\s*]{0,4}`
   after it — so `Verdict: ✅ APPROVED`, a backticked verdict, and even `**Verdict:** **APPROVED**`
   (five characters where four were allowed) stayed unreadable. Measured over `docs/reviews/`:
   **65 of 169** readable. Widening the middle to the identical class → **102 of 169** (`405523f3`).
   ⭐ Found only because AE2's own r3 verdict is backticked, so the ledger row being written was
   itself the counter-example. ⚠ BOUNDED: **14** files still unreadable — they put WORDS before the
   label (`## Re-review (2026-07-17) — VERDICT:`); admitting those readmits `Prior verdict: APPROVED`,
   so it is FILED, not fixed. Measured: no `complete` hub depends on one.
2. **The archive ratchet's domain.** Its first cut selected `^### ` only — a **syntax**, not the
   property. ⛔ **The lead's critique of it was itself bounded by a syntax:** the brief said 5 genuine
   `##` entries and used `#{2,4}`; the re-derivation found **27** (the 22 `## ⬛ FUP-0137-…` headings
   are real entries, read to confirm) plus five more at `#`. Real population **179**, not 174. Cap
   **108 → 121**, parts summing per level (144 ids = 23 with + 121 without; 27 h2 + 117 h3). ⛔ A
   truer number, not a regression. ⭐ The 13 newly-visible are led by
   `FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE`, archived at `##` with its body moved *"VERBATIM"*,
   `Filed`/`Owner`/`Severity` intact and `Closes when` dropped — a live instance of the exact defect
   the arm exists for (`577637b4`).
3. **Gate 11's diagnosis** — see the CRLF section below.

#### gate13-fix — the two `complete` regexes and the ratchet (`375726b2`, `202106ab`)

⭐ **A finding that made the lead's sequencing load-bearing rather than cautious:** *four* complete
hubs (AE4, DOOR-SWEEP-DERIVER, HARNESS-CRASH-SAFETY, PRED-DOMAIN) pass on their **ledger row alone**
today, their genuine APPROVED reviews unreadable to the old regex. Re-bolding any one of them before
the regex landed would have redded the gate — not just AE4's. The re-bolding was held until after
`375726b2`.
⚠ The stream caught its own error mid-flight by reconciling two censuses (`202106ab`): the counter
first read the leading field block, which sees only 9 of the 27 column-0 fields, setting the cap 15
too high **and** guaranteeing a red on the next correctly-written closure.

#### adr-links — gate 9 resolves TARGETS (`af9cf1e4`)

Gate 9's only existence check was over the **number** map: `[0171](./0171-anything.md)` was green
because `0171` exists, and the slug was never read. 14 dangling ADR-to-ADR links sat in the tree
while it printed `OK`. Independently re-derived by a sweep that does not import the shared checker;
a census, not a sample — 959 raw link openers, 1 blanked inside code, 958 matched, **zero
unmatched**; 786 intra-`docs/decisions/`, 168 outbound of which **0** broken. The register's
twice-written *"the other 11 predate this phase"* is refuted by its own enumeration: **12**.
⭐ The proof that matters is the mutation arm: a planted wrong-case link reds (**rc 1**), and with
`exists` reverted to naive `existsSync` the self-test reds **rc 2 — `links-wrong-case-detect (cannot
fire)`**, while bypassing the self-test ships it green. `existsSync` measured `true` on that plant,
so the NTFS trap is live, not theoretical.
⛔ Findings are `--check`-only, deliberately not in `hardFindings()`: routing them into the generated
`INDEX.md` would surface a broken link first as *"INDEX.md is out of date"*, sending the reader to a
regeneration that fixes nothing, and would commit a normalised list of the defect — an allowlist in
all but name.
⚠ New coupling: gate 9 now imports `checkLinks` from `check-docs-registers.mjs`.
⚠ Residual: gates 7 and 13 still use the case-insensitive `exists`. Zero wrong-case links today
(measured), so a gap, not debt.

#### The ledger (`8b194439`) and the spun-off session (`7e8618e5`)

Re-bolding was derived as a **property** — *unbolded ∧ after the first bolded row* — selecting
exactly lines 124–129 without being taken from the plan's list. ⛔ The plan's figures are refuted as
statements about the ledger: **81 rows, 52 unbolded / 29 bolded**, not "six of 76"; the "six" named
the right class and the wrong population. AE2's row is marked **reconstructed** and says in its own
cells that every figure is transcribed, not measured here; it carries a ⛔ against the stale task
table in `authz-ae2.md`. All 16 of its links verified **case-exactly**, not by `existsSync`.
Clause (b) was spun out to a separate worktree and returned six further reconstructed rows, merged
`--ff-only`. Verified **after** the merge: 88 rows, every one 9 cells (the 8-cell row that made a
column-indexed reader take a commit sha as a date is repaired), no duplicate ids, 41 + 47 = 88.
⭐ Their best finding: a name-agnostic join matched a record to a row when both cited the same review
file, silently linking `authz-ae2` through a **shared audit-findings file** — hiding the one subject
the derivation existed to find. **Citation is relevance, not identity**, and the rule failed toward a
clean result.

#### Gate 11 — a false "`main` is broken", and the real defect underneath (`bc8a27b0`, `654bdbb0`)

That session recorded ⛔ *"`npm run lint` reds on `main` itself"*, proven by `.claude/` being
byte-identical to `main`. **Not reproducible here**: `lint:rules` → **rc 0** on the primary tree, and
**rc 1 with the identical 24 findings** when the same script runs from their worktree. Cause: their
`.claude/rules/*.md` are **CRLF** — 47 CR bytes vs 0, 2058 vs 2011 bytes, same 47 lines. That +47 is
exactly what carries three files past the 2048 cap, and `paths:`/`anchors:` "go missing" because the
parser is handed a trailing CR on the key line.
⛔ **Their measurement was right and the conclusion was not.** `.gitattributes` carries
`* text=auto eol=lf`, so the clean filter normalises CR **on the way in**: `git hash-object` returns
the same blob and `git status` is clean in both trees. Every git-mediated comparison agrees they are
identical while the bytes on disk differ. **A claim about a file's CONTENT is not a claim about the
BYTES A GATE READS**, and on Windows git cannot show you the difference.
⭐ The defect that survives is **attribution**: the gate blamed each rule's content for its own
reader's assumption. Fixed to name CRLF as CRLF and to normalise before parsing **and** before the
byte cap. Four arms, exit codes bare, in a scratch worktree with genuinely CRLF files:

| arm | observed |
|---|---|
| unfixed gate, CRLF tree | **rc 1**, 24 findings, **zero** mentioning CRLF |
| fixed gate, same tree | **rc 1**, 10 findings, **all** naming CRLF, 0 spurious, 0 byte-cap |
| fixed gate, LF restored | **rc 0** — discrimination; not always-red |
| primary tree | **rc 0** |

Five fixtures, deliberately two-sided — the defect was attribution, not detection, so a one-sided
"it reds" fixture would have passed on the broken version too. Proven able to fail: dropping the
finding from the accumulator makes the self-test exit **2** naming the three arms that die.
The false claim was corrected **in the merged files**: a dated note beside the original in the
append-only record, and a replacement of the hub's live `### Blockers` block.

#### cases-build — the empty-`CASES` port across four harnesses (`8f87a7c3`, `1b580e4e`)

**Red-first held** (plan §8 step 2). The new arm, its row 0 and the counter rework landed against
**unmodified** decision logic and rows **C** and **E3** were observed RED, bare rc 1, `8/10 ok`:
`C CASES="" EXPLICIT -> selects=yes writes=committed (expected no / subset)`.
⛔ **The build corrected the lead's own ruling.** R1 restated the plan's claim that row **D** would
also be red at step 2. It was green — because D's mutation target is *dropping the
`BASE_SHAPE_OVERRIDE` disjunct*, and that disjunct **exists pre-fix**. The stream treated
green-on-first-run as a finding, checked the **assertion** rather than the code, found the plan had
filed D under the wrong mutation, and proved D **by selection** instead: dropping the disjunct reds
**D and only D**. ⭐ That is the correct response to a ruling that does not match the code.
After the fix, all four harnesses exit **0** in both states (door 33/33, writepath 27/27, rowdoor
9/9, invoker 10/10), row 0 printing the startup capture as `0` unset / `1` empty in each. The new
`door-sweep-selftest.sh` runner: **rc 0**, `PASS 42 · FAIL 0`, groups deriver 16 · merge helper 18 ·
audit startup capture 8 — proven able to fire by hard-wiring the captured bit (**rc 1**, and *only*
the empty half failing, which is why the pair is the control).
⛔ **Every port proven by selection, never by inheritance:** reverting one harness's own predicates
reds only that harness (`1/0/0`, then `0/1/0`, then `0/0/1`). This is the mis-scope that cost Batch 2
a voided run, and it was checked rather than assumed.
⚠ **Scope call, ratified by the lead:** `rowdoor` and `invoker` had **no domain gate at all**, so the
three named sites alone would have swapped a silent full sweep for a silent **zero** sweep at exit 0
— a run that measured nothing reading as a pass. Each got a domain gate (zero selected → UNPROVEN,
exit 3). Beyond the clause, written up as a partial touch on a separate follow-up; BLIND-bearing runs
still exit 0.
⚠ A mechanical trap the plan missed: `want()`/`count_sel()` were defined ~450 lines **below** the
self-test block, so the arm as specified would have died with `want: command not found`. The
definitions were relocated rather than copied — a harness holding a hand-written copy of production
text proves nothing.
Baselines untouched: `git diff --stat` on both committed findings files, bare, **empty**, across
`af9cf1e4..HEAD`.
Beyond brief: the **write arm had the identical row-0 vacuity** — its own fixture assigned the
set-ness variable, so ADR 0192's capture was asserted by nothing. It now carries the handle.

#### ADRs (`82af2a33`)

ADR **0194** (amends 0192) placed from the backend draft; `INDEX.md` regenerated to 192 ADRs,
back-pointer written into 0192. ⭐ Gate 9's new target resolution **passes on 0194** — the gate
checking the ADR that documents the batch that built it.
ADR **0079 § The recipe EDITED** to the two-step form (R45: an operational instruction is edited, not
annotated), with the superseded one-liner quoted inside the dated note **below** the correction so a
reader cannot act on it. ⛔ That is where the substitution actually lived — neither `lead-playbook`
nor `CLAUDE.md` ever contained one, so the follow-up's clause named two files that could not host its
fix. `lead-playbook.md` §4 now carries the two-step recipe, and its hardcoded scenario counts were
replaced by a pointer to what the harness itself prints.

#### Lead errors, recorded because they cost real time

- ⛔ **The lead damaged the shared `node_modules`.** A `git worktree remove --force` was run on a
  worktree containing a **junction to the real `node_modules`**; its *"Filename too long"* failure was
  git deleting **through** the junction. `.bin/` and `@eslint-community/eslint-utils` were destroyed,
  which is why the build stream could not complete `npm run lint` and reported the gate as owed.
  Repaired with `npm install` (202 packages restored, `package.json`/`package-lock.json`
  **unmodified** — verified). **Lesson: remove the junction before removing the worktree.**
- ⛔ **Two mutation attempts silently failed to apply, and each green meant nothing.** Once because
  Windows Python could not resolve `/tmp` while Node could (so the "mutant" was the unmutated file);
  once because the shell ate a backslash level. Both caught only by verifying the mutation was
  **present in the file** before trusting its result — now the standing practice here.
- ⚠ The lead wrote **four broken ADR links from memory** into this record, each with a correct
  number, so gate 9 would have passed all four. Caught by an unprompted directory listing. They never
  reached a commit and change no count; recorded because they are the cheapest proof that the repair
  had to be a gate and not a sweep.
- ⚠ An exit code was read **through a pipe** early in the session and reported 0 for a command whose
  status was not 0. Every exit code in this record was re-read bare or from a redirect.

#### Gate at the tip so far (lead, not the builder)

`npm run lint` **rc 0**, eslint running, 0 errors / 0 warnings · `npm run typecheck` **rc 0** ·
`npm run lint:adr-index` **rc 0** (192 ADRs) · gate 13 **rc 0**, ratchets all at or under cap
(`archiveMissingClosesWhen=121/121`, `longHeadings` back to 97/97) ·
`git diff --name-only main... -- supabase/migrations supabase/seed.sql src` **EMPTY** — no migration
and no `src/` change, so the diff-scoped sweep is not owed both arms and E2E is not implicated.
**Still owed:** `npm run test`, `npm run test:db` on a fresh reset, the four authz arms with domains
quoted, `SELFTEST=1` on the deriver and the door harness, and the diff-scoped deriver over
`main...HEAD` with its `SCOPE:` line quoted and its exit read **bare before any substitution**.

**Not yet done, and deliberately:** the five follow-ups remain `open`. Closure is a Record-step action
after PO approval, and closing them earlier would assert an approval that has not happened.
