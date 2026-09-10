# QA Re-review — AE5-OPENING-ADR (pre-AE5 remediation Batch 9, fix loop iteration 1)

**Reviewed:** branch `authz-ae5-opening-adr`, tip `b58549fe` (15 commits ahead of `main` @
`55e440c3`; iteration 1 landed as `acb11148` + `b58549fe`). **Reviewer:** qa. **Date:** 2026-09-10.
⛔ **This file does not replace [`ae5-opening-adr-review.md`](./ae5-opening-adr-review.md); both stand.**

**Verdict: CHANGES REQUESTED**

**0 BLOCK · 3 MAJOR · 2 MINOR.** ⭐ **Both BLOCKs are discharged, and discharged properly** — R11
and R12 are in the corpus, not just the log, with the superseded text quoted in place rather than
overwritten, and no surface in `docs/decisions`, `docs/followups`, `docs/plans` or `docs/features`
still routes Batch 10 at two sites. Nine of the eleven findings are **FIXED**. What blocks this round
is not a survival: it is that **the fix loop introduced three new defects of the same class it was
sent to repair** — a false universal negative displayed with its own queries, a refuted sentence left
in place and silently re-parented under a new list item, and a `## Current state` that went stale
inside the loop that replaced it. Every one is a one-to-three-line edit and none touches the
pathspec.

⭐ **And two of my own findings were wrong.** All three of the builder's refutations hold; I verified
each independently and own both errors below.

---

## Re-run at the tip, exit codes read BARE (zsh — `pipestatus`, never piped)

| gate | result |
| --- | --- |
| `npm run lint` | **rc 0**, all **17** arms (`package.json`'s `lint` splits to 17 on `&&`), eslint **0 errors / 0 warnings** |
| `npm run typecheck` | **rc 0** |
| `SELFTEST=1 bash scripts/door-sweep-selftest.sh` | **rc 0**, `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0`, groups `20/20 · 18/18 · 8/8`, on `/bin/bash` **3.2.57(1)-release (arm64-apple-darwin25)** — the shell that produced the original red |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | **0 bytes, EMPTY** — the batch's defining assertion still holds |

**Not re-run, per instruction:** `test:db`, the four authz arms, vitest, `e2e:prod`.

**Nothing the fix loop touched broke a gate.** Diff scope over the fix loop (`ed80da4c..HEAD`) is
`docs/{decisions,features,followups,learning,plans,progress,reviews}`, `docs/lead-playbook.md` and
`supabase/tests/vectors` (two qualifier fields plus two derived sha stamps). Line counts and diff
figures the record quotes reproduce exactly: `0201` **+76 / −17**, 353 → **412**; `0203` **+113 /
−29**, 253 → **337**.

---

## Per-finding verdicts

### ⛔ BLOCK-1 (R11 recorded only in the log) — **FIXED**

Measured in the corpus, not accepted from the message:

- `0203:3` `**Status:**` now reads *"⭐ **All three Decisions are RULED.** D3 travelled as `PO to
  rule` and was **ruled 2026-09-10 by PO ruling R11**: option **(C)**"*.
- `0203:177-216` is D3 as a ruling, carrying all three conditions the record logged: a **named**
  layer-3 consumer per column with its shape stated, each arriving **RED-first**; **sequenced after
  AE5 increment 1**; `session_selectable` as the **worked** precedent (fourth column on `0176:45-47`'s
  list, now read by `public.assume_role`, gated by `408` § 3's mutation twin).
- `0203:226` § Considered options is now `✅ **Decision: (C), PO ruling R11**`, with all three options
  retained and an explicit ban on deleting the rejected ones because *"the rejected consequences are
  the ruling's stated basis"*.
- `⛔ No default applies while D3 is open` is **gone**; the reason it existed (D8's clause is a
  disjunction with no third branch) is **kept** as why *"leave them, nobody is hurt"* was never
  available.
- The `Amends:` header now states D8 is discharged on the ***"a consumer appears"*** branch, ⛔ not on
  *"leaves with a named reason"*.

`grep -n "PO to rule\|deliberately open\|UNRULED\|not in scope here"` over both ADRs returns **three**
hits, and every one is inside a quoted-superseded block or the ruling statement itself. The decline is
re-anchored and I re-verified each: `401:369` **is** `§7 — THE PHI / WRITE SEPARATION INVARIANTS`,
`:380` the PHI edge, `:390` the read→write edge, `:408` the `7.3 DISCRIMINATION CONTROL`.

⚠ One residue, graded **N-MINOR-1** below: the register row this ruling owes still does not exist.

### ⛔ BLOCK-2 (R12, and D5's sufficiency) — **FIXED**

- `0201:132` D4 heading: *"**ALL THREE SITES are gated: both admin predicates AND the door that mints
  the hat**"*; `:145-148` ⇒ *"Batch 10 owes the `is_active` term on all three sites … each with its
  **own** pgTAP cell … ⛔ One cell over one site does not discharge three."*
- `0201:154-161` records R12 with **the superseded wording quoted**, and I checked the quote against
  the pre-edit file (`git show ed80da4c:…0201…`, `:152-154`): verbatim, with one elided sentence
  correctly marked `…`. `:166` retires the phrase explicitly — *"`both admin predicates` is no longer
  a complete statement of it anywhere in this corpus."*
- `0201:391-398` replaces the § *What this ADR does not do* bullet, quoting its draft and naming both
  closures (R12; D5 by **reaffirmation**). The pre-edit bullet at `:344-345` matches the quote.
- The register clause and the follow-up **body's own `Closes when:` field** both now name all three
  sites with the superseded original quoted — closing the gap the builder found, which was my
  acceptance-box-2 ⚠ (*"the operative field remains the refuted one"*).
- Plan §3 banner item 4 rewritten to `R3 + R12` over three sites. ⚠ But see **N-MAJOR-1** — the
  refuted routing sentence it claims to have retired is still in the same banner.

### ⚠ MAJOR-1 (the hub's `## Current state`) — **PARTLY FIXED** → **N-MAJOR-3**

The block was **replaced**, not appended, and the four stale sections are corrected: *"Fourteen PO
rulings taken (R1–R14)"*, the `SELFTEST` blocker removed, the tip gate figures stated, LEARN-095/096
no longer listed as owed. All correct as measured.

⛔ **But the replacement went stale inside the same fix loop** — see **N-MAJOR-3**.

### ⚠ MAJOR-2 (three miscitations in ADR 0203) — **FIXED, and my own characterisation of one was wrong**

| limb | measured now |
| --- | --- |
| `0172:102` | replaced by **`0172:112`** = `### 4 — Three classification columns are NOT CREATED; risk_class is (PO override).` ✅ and **`0172:115`** = the `**Not-created is chosen for**` sentence ✅ |
| `0172:114-119` | replaced by **`0172:124-136`** — the `⭐ AMENDED 2026-09-01` block begins at `:124` and ends at `:136` (`:137` blank) ✅. The builder's added **end** is right; I had supplied only the start |
| the *"fuse"* attribution | corrected in **both** places it appeared (`:31` seam table and `:252`, formerly `:181`), re-attributed to **§ 2.3's own message** at `410:129-131`, quoted verbatim against the file, with the **two-hit** grep count stated ✅ |

The draft sentence is quoted accurately against the pre-edit file (`0203:31`). ⭐ Precision worth
noting: `:254`'s *"three `authz` domains (`risk_class`, `resource_kind`, `sensitivity_class`)"* is
**correct and not an inconsistency with D3's `sensitivity_ceiling`** — I checked `pg_type`:
`authz.sensitivity_class` is the domain (`typtype = 'd'`), `sensitivity_ceiling` the column.

### MINOR-1 (hub `adrs:` omits the produced ADRs) — **FIXED**

`docs/features/ae5-opening-adr.md:12` now carries `"0201", "0203"` with an inline note naming the
finding. `npm run lint` (gate 13) green.

### MINOR-2 (the staging prohibition had no durable home) — **FIXED. Ruling requested: the promotion is ADEQUATE, and it is the better home, not a downgrade**

Measured: `.claude/rules/` holds **11** files and the fix loop added **none** — `git diff --stat
main...HEAD -- .claude/rules` shows only the pre-existing `prosrc-is-not-the-whole-function.md`, so the
new rule file was written and deleted as described. `docs/lead-playbook.md:104-121` now carries the
prohibition: a two-row table naming **both** race directions and which was guarded, the measured
incident (`354fd6b0`, seven files where four were named), the forbidden command set (`git add -A`,
`git add .`, `git commit -a` while a subagent runs), the `git status --short` reconciliation, and the
⛔ do-not-amend-a-reported-sha clause. `LEARN-097`'s Enforcer cell names that file.

**Ruling — adequate, on four grounds:**

1. **The subject is behaviour, not a path.** ADR 0127's admission bar for `.claude/rules/` is
   *path-scoped*; a prohibition whose subject is "any commit while an agent runs" has no path, which
   is exactly why gate 8 fired twice (149 files vs the 40 soft cap; 2,055 bytes vs 2,048). The rule
   file was the wrong **shape**, not merely oversized.
2. **The actor is the lead, and this is the lead's always-on surface.** CLAUDE.md §4 designates
   `docs/lead-playbook.md` as the lead-only protocol. A glob wide enough to catch the hazard would
   load on every teammate spawn and be paid for by agents who never commit.
3. **It is placed at the point of use** — inside the Record-step / commit sequence, not an appendix.
4. **No enforcement was lost.** CLAUDE.md §8 says a rule is a hint, never a substitute for a gate;
   the playbook is prose and so was the rule file. Nothing reds either way, and the register no longer
   names an enforcer that cannot reach the actor.

⚠ **Observation, not a finding:** gate 8's disposition (4) reads *"PROMOTE it to CLAUDE.md or
ARCHITECTURE.md"* (`scripts/check-rules-staleness.mjs:214`) and does **not** list the lead-playbook,
so an auditor checking "was (4) taken?" against the gate's own text finds a target that is not there.
The record states the reasoning (lead-only, no per-spawn cost), and promoting a lead-only rule into
CLAUDE.md would contradict that file's own *"every spawn pays for it"*. A one-line widening of the
gate's disposition-(4) text to name `docs/lead-playbook.md` would make the route discoverable; it is
follow-up shaped, not this batch's.

### MINOR-3 (LEARN-096's enforcer cannot fire where the incident happened) — **FIXED, adequate**

`docs/learning/LESSONS.md:119`'s Enforcer cell now carries the bound in the cell itself: the rule's
`paths:` reach the five `p0-authz-*.sh` harnesses, ⛔ **not** the ADR/decision surface, *"it covers the
next harness author, not the next drafter"*, and ⛔ *"for a drafter this row is `prose only` in
effect."* That is what I asked for — either state the bound or widen the glob — and stating it is the
honest branch, since `docs/decisions/*.md` (~200 files) fails gate 8 and `broad:` was rightly declined.
It converts an enforcer-that-cannot-fire into an honestly-bounded one, which is the register's purpose.

⚠ **Observation:** the `lessonsProseOnly` ratchet still counts this row as **enforced** (its Enforcer
cell names a path), while the row's own text says it is prose-only for the actor who caused the
incident. The gate's figure and the row's statement therefore disagree. Disclosed rather than hidden,
so not a finding — but if a third such row appears, the ratchet is measuring the wrong thing.

### MINOR-4 (the hand-list negative) — **PARTLY FIXED** → **N-MAJOR-2**

The hand-list is gone and a derivation with its queries is in its place. ⭐ **I re-derived D1 and D2
independently and both reproduce exactly:**

- **D1** — `grep -lE "update +public\.profiles +set +(is_active *= *false|suspended_until *= *now\(\) *\+)" supabase/tests/*.sql`
  ⇒ **21 files**, the exact list the body prints. ⚠ **The builder's 21 is right and my 5 was wrong** —
  my figure came from a narrower pattern (it even included `200_controlled_documents.sql`, which does
  not match the stated predicate at all). Neither *"the superseded 9"* nor the looser 26/28 is this set.
- **D2** — of those 21, the files also naming `platform_admin` **and** (`\bis_admin`|`can_manage_professional`)
  ⇒ **exactly 7**: `180 · 328 · 395 · 396 · 397 · 401 · 409`. Reproduces.
- `231_authz_m5_is_active_gate.sql` — the omission that made MINOR-4 — holds **0** occurrences of
  `is_admin` or `platform`, so it could not have changed the answer. Reproduces.

⛔ **But D3's conclusion sentence is false as stated** — see **N-MAJOR-2**.

### MINOR-5 (the qualifier quoted the pre-change `401` run) — **FIXED**

Both `legacyEquivalence.qualifier` fields now quote `00_setup 401 403 410` → `Files=4, Tests=189`,
`Result: PASS`, 0 `not ok`, **exit 0**, and say so explicitly: *"this is the run that POST-DATES this
comment."* The substitution is disclosed with the superseded figure (`Files=2, Tests=122`) and its
reason named. Nothing else in either field moved; the `--- HISTORY` verbatim block and the ⛔ standing
prohibition (*"19.2b MUST STILL RED ON A FOURTH SPLIT"*) survive intact. The added run-mechanics note
(`401` alone dies at `Bad plan`, exit 3, a harness result never a finding) is a real improvement.

### MINOR-6 (`0202` unfillable, `0204` reserved) — **FIXED as to placement**

Plan §3 banner item 5 states the hole where a numberer reads it: no `0202` ever, `0204` reserved,
*"take **0205** for anything else, or renumber the deferred pair and say so here."* ⚠ Item 5 is also
where **N-MAJOR-1** now lives.

### MINOR-7 (two off-by-one anchors in ADR 0201) — **FIXED**

- `0201:348` now `315:246-249`; measured, `315_act_stage3_hat_condition.sql:245` is `reset role;` and
  the `select ok(` cell runs `246-249`. ✅ Siblings `:203-208`, `:209-212`, `:226-230` unchanged and
  still exact.
- `0201:360` now `401:940-941`; measured, the quoted sentence spans `940-941` and `§§16.8-16.11` is on
  `:941`. ✅

**Anchor sweep over everything the fix loop added.** I extracted every `file:line` and `NNN:NNN`
citation from the added lines across `docs/decisions`, `docs/plans`, `docs/followups`,
`docs/lead-playbook.md`, `docs/learning` and `docs/features` and resolved each against its target:
`0172:112` · `0172:115` · `0172:124-136` · `0176:45-47` · `315:212` · `315:246-249` · `401:369` ·
`401:380` · `401:390` · `410:118-133` · `410:129-131` · `gen-authz-matrix-cells.mjs:704` — **all
resolve.** (`0172:102`, `0172:114-119` and `0203:198` appear only inside correction notes as the
*wrong* anchors being retired, which is correct usage.)

---

## The three refutations — **all three hold**

### 1. My BLOCK-1 anchors were miscited — **CONFIRMED, and the error is mine**

Measured against the pre-edit committed file (`git show 7365c2e6:docs/decisions/0203-…md`):

- D3 was at **`:149`**, not `:198`. `grep -n` confirms: `149:**D3 — the disposition of \`risk_class\`, \`sensitivity_ceiling\` and \`resource_kind\`: \`PO to rule\`.**`
- The § Considered options header was at **`:157`**, not `:203`. `## Considered options` is `:155`.
- **`:203` is a blank line** — `awk 'NR==203{print length($0)}'` ⇒ **0**. `:198` sits inside option
  (B)'s consequences (*"from a substring test on a permission CODE … to a join on a COLUMN"*).

The quoted text was verbatim right in both cases; only the pointers were wrong. ⭐ **The builder's
reading of what that means is also right**: it is the identical class I filed as MAJOR-2, produced by
prose review without a `sed`, and therefore not one role's habit. I accept the correction without
qualification.

### 2. *"The watching relation is INVERTED"* was wrong — **CONFIRMED, misattribution only**

The draft read *"the lint arm at `…mjs:704`, whose own comment calls § 2.3 'the fuse' that gives it
teeth"*. Parsed on its content, that asserts **§ 2.3 is the fuse and the lint arm gets the teeth** —
which is precisely what `410:129-131` says (*"This is also the fuse that gives lint's `axes.sensitivity
== catalog.sensitivityCeiling` arm real teeth"*). **The direction matches the tree.** I read *"whose
own comment"* as relocating the vouching party and wrote "inverted"; that was over-reading. The defect
is **misattribution of the phrase's home** and nothing more, and the ADR's correction says exactly
that. My error, and it was relayed rather than caught — worth noting that the correction is stronger
than my finding was.

### 3. `grep -rn "the fuse"` returns **two** hits — **CONFIRMED**

Over `scripts supabase src`: `410:129` and
`supabase/migrations/20261003007200_ae46_cutover_staff_admin.sql:18` (*"with AE5 as the fuse"*).
*"The phrase lives at `410:129`"* is true but not unique, and the ADR now states the count so the next
checker's grep matches the claim. ✅ The generator's M9 comment at `:699-700` says something
compatible but weaker and never uses the word — I re-read it.

---

## New findings

### ⚠ N-MAJOR-1 — the refuted Batch-10 routing sentence is still in the plan, silently re-parented under item 5, and item 4's correction describes it in the **past tense**

**Requirement violated:** the same one BLOCK-2 named — plan §3's hand-off must not route Batch 10 at
sources that under-name its scope — plus this repo's own convention that a correction sits **beside**
the text it corrects rather than being asserted to have removed it.

**Measured** (`git diff ed80da4c..HEAD -- docs/plans/pre-ae5-remediation.md`). Before the fix, banner
item 4 ended:

> *"⛔ Stated rather than fixed: … whoever opens Batch 10 derives its scope from the unit record's
> R3/R4 entries and the corrected register clauses, not from a placeholder."*

The fix rewrote item 4's body and appended item 5 — but that tail was **left in the file** and now
terminates **item 5**. So at HEAD the banner contains both of these, four lines apart:

- item 4: *"⇒ derive Batch 10's scope from **ADR 0201 + ADR 0203 + the unit record's R11/R12
  entries**, and ⛔ **never from R3/R4 alone**."*
- item 5's tail: *"whoever opens Batch 10 derives its scope from the unit record's **R3/R4** entries
  and the corrected register clauses, not from a placeholder."*

Three separate problems, and the third is the reason this is MAJOR:

1. **The banner contradicts itself**, and the forbidden version is in the **terminal** position — the
   last thing a reader of the banner is told.
2. **The tail is now orphaned from its subject.** *"⛔ Stated rather than fixed: a block written by a
   passing batch for work it is not doing…"* was item 4's conclusion about Batch 10; under item 5 it
   reads as a statement about ADR **numbering**, which it is not.
3. **Item 4's correction is itself now inaccurate.** It says *"This item **previously** … routed a
   reader to *'the unit record's R3/R4 entries and the corrected register clauses'*"* — past tense,
   about a sentence still live in the same banner. That is a claim about a document's state that the
   document contradicts: the exact defect class this batch exists to police, and the reason BLOCK-2
   was a BLOCK.

**Why not a BLOCK.** No surface asserts the third site is out of scope any more — both ADRs, the
register clause and the follow-up body all name three sites — so a reader following even the stale
sentence lands on a corrected clause and cannot lose `assume_role`. The exposure is a contradictory
hand-off, not a scope hole.

**Owed:** delete or re-word the tail so item 4's routing is the only routing in the banner, and re-word
item 4's *"previously"* to match whatever survives.

### ⚠ N-MAJOR-2 — MINOR-4's replacement derivation asserts a **universal negative that is false**, and it hides a reusable fixture

**Requirement violated:** ADR 0078 / the ledger's standing lesson *re-derive, never quote* — and this
batch's own recurring lesson that **a text match is not a semantic property** (LEARN-096's twin;
`docs/learning/LESSONS.md` *"text is not truth"*). The clause is load-bearing: it licenses *"the
RED-first cell the clause demands does not exist to be reused"*, which shapes Batch 10.

`FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE.md:126` states:

> *"⇒ **Not one of the 21 deactivates a `platform_admin`**, so no existing cell measures an admin arm
> under a deactivated admin."*

**Measured — the first clause is false.** `145_pqs_membership.sql` is one of the 21, and it deactivates
the bootstrap `admin` principal:

- `supabase/tests/00_setup.sql:152` — `update public.profiles set full_name = 'Admin', is_admin = true where id = admin_id;`
- `00_setup.sql:290` — `test_helpers.bootstrap()` returns that id under the key `'admin'`, which
  `145:31` binds as `admin`.
- `145:416` — `update public.profiles set is_active = false where id = (select admin from k);`
  restored at `145:425`. `145:236` says so in its own words: *"Bootstrap sets admin as the bootstrap
  persona (is_admin=true)"*.

So a principal carrying `profiles.is_admin = true` — the exact column `public.assume_role`'s
platform branch tests, and the fallback branch of `app.is_admin()` (live body: the JWT `is_admin`
claim **or** `profiles.is_admin = true`, **and** `app.active_role() is not distinct from
'platform_admin'`) — **is** deactivated inside the suite, twice.

**The cause is the instrument.** D2's filter requires the literal string `platform_admin`, and `145`
never contains it. A platform admin in this tree is a **flag on `profiles`**, not a role string, so
keying the filter on the string cannot see one. That is the batch's own lesson, one commit later,
inside the fix written to replace a hand-list.

**The finding survives, and I verified how.** `145` seats `test_helpers.claims_for(admin, false)`, and
`00_setup.sql:422` adds `'platform_admin'` to the role list only `where p_is_admin` — so no hat is
seated, `app.is_admin()`'s ACT conjunct is false, and the only door asserted is
`public.list_my_nsp_hospitals()` (`145:408`, `:420`, `:428`). **No cell measures an admin arm under a
deactivated admin.** The clause's conclusion holds; its stated evidence does not.

**And the false clause costs Batch 10 something concrete.** It tells the next author that no
deactivate-an-admin fixture exists. One does: `145:414-425` is a complete
deactivate → assert → reactivate cycle on an `is_admin = true` principal, directly adaptable to the
RED-first cell R3/R12 demand.

**Owed:** restate D3's conclusion as what was measured — *no cell **measures an admin arm** under a
deactivated admin* — say that `145` deactivates a `profiles.is_admin = true` principal while asserting
only a PQS operator door, and record that the D2 filter keys on the role **string** while a
platform_admin is a **flag**, so the filter cannot see a flag-only admin.

⚠ **Related observation, not a finding.** Eight of the 21 mention `platform_admin`; D2 lists 7. The
eighth, `384_person_scope_sql_predicate.sql`, drops out on the second conjunct (no admin predicate),
which is sound — a file exercising no admin predicate cannot hold the cell — but the derivation does
not disclose the drop. One clause would.

### ⚠ N-MAJOR-3 — the hub's replaced `## Current state` went stale **inside the fix loop**, and its § Blockers asserts both BLOCKs are open at a tip where they are discharged

**Requirement violated:** CLAUDE.md §7 / ADR 0186 D3 — the hub's `## Current state` **is** the unit's
summary, replaced never appended, and it is the surface the Phase Gate **step 4** presentation is built
from. `lint:progress` and `lint:registers` enforce shape, never truth. This is MAJOR-1's own finding,
one commit later, on the same file.

`docs/features/ae5-opening-adr.md` is stamped **Updated: 2026-09-10 (QA fix loop, iteration 1)** and,
at tip `b58549fe`:

| section | what it says | measured at the tip |
| --- | --- | --- |
| In progress | *"`backend` half in flight: the two BLOCKs (R11 into ADR 0203 D3, R12 + D5 into ADR 0201) plus MAJOR-2's three miscitations, MINOR-5 and MINOR-7"* | **landed** in `b58549fe`; I verified every one above |
| Blockers | *"⛔ **The two QA BLOCKs, both open until `backend` returns**: PO rulings R11 and R12 live only in the progress log, and the ADRs state the **opposite** — 0203 still reads `D3 is PO to rule` and 0201 still reads that `public.assume_role` is 'deliberately left UNRULED here'"* | **false on all four claims.** `0203:3` states R11; `0203:177` is the ruling; `0201:154` states R12; both draft sentences survive only as quoted-superseded text |
| Done since start | ends at *"QA reviewed: `CHANGES REQUESTED`"* | omits that iteration 1 completed, and omits the fix-loop gate re-run |

The block was written in the lead-half commit `acb11148` and never refreshed when the backend half
landed. A human approving at step 4 from this hub is told the batch's two **blocking** findings are
open — the same failure mode MAJOR-1 named, in the same section, with the polarity reversed.

**Owed:** replace the block (never append) — § In progress and § Blockers to the tip state, § Done
since start to include iteration 1 and its gate figures.

### MINOR — N-MINOR-1 — ADR 0203 § Consequences asserts a follow-up register entry that **does not exist**

`0203:303-311`: *"⇒ **the follow-up register keeps a `Status: open` entry**, but its closing condition
is now **concrete** … it closes when each of `risk_class`, `resource_kind` and `sensitivity_ceiling`
has a **named runtime consumer inside `authz`** with a gate asserting it."* Present tense.

**Measured:** `grep -rln "risk_class\|resource_kind" docs/followups/` ⇒ **nothing**. No entry in
`docs/followups/follow-ups-open.md` (222 entries) concerns the three columns; the branch's only
register edits are the two `Closes when` corrections. So R11's obligation — three named consumers, each
RED-first, sequenced after increment 1 — is tracked **only** inside 0203 itself, and a reader who
follows the ADR to the register finds no row.

This is a **surviving** sub-item of BLOCK-1's *"Owed"* (⚠ *"`FUP-…` routing for the three named
consumers needs a home"*), not a regression: the draft's vaguer *"an open entry pointing at D3"* was
false in the same way. It is graded MINOR rather than blocking because (a) R11 itself is now in the
corpus, which was the blocking half, (b) `0203:218-221` correctly says the routing is *"owed at the
Record step"*, and (c) the record states the builder deliberately did not invent a `FUP-` code, leaving
the row to the lead — a sound division. **Owed:** file the row at the Record step, or make the
Consequences sentence future-tense until it exists. ⛔ Do not let the ADR go `accepted` with a
present-tense claim about a register row that is absent — that is the sentence-shape both BLOCKs were.

### MINOR — N-MINOR-2 — the hub says **eight** named findings are owed at Record; the record's only enumeration is **five**

`docs/features/ae5-opening-adr.md:167` — *"the ledger row, and the **eight** named findings filed."*
`docs/progress/ae5-opening-adr.md:692` — *"the Record step's filings — the **five** named findings…"*,
and `:579-589` enumerates exactly five (0175 D3's forward promise · `0176:45`'s stale no-reader list ·
the `D`-fanout refutation · the `search_path` figures · `authz-matrix-coverage.json`'s stale
`migrationHead`). No list of eight exists anywhere in the record. Later entries do add Record-step
**obligations** (two lessons, the rulings-vs-corpus reconciliation, the two-place-clause lesson, the
`assume_role` allowlist re-derivation, the register row above), so eight may be a recount — but it is
unsourced, and at the Record step the operator will look for three items that were never named.
**Owed:** restate as five, or enumerate the eight.

---

## What the fix loop got right that it was not asked for

Recorded because both were flagged rather than slipped in, and both are improvements:

- **The ADR 0195 one-home pointer** at the end of `0203`'s D3 decline — the `401 § 7` anchors would
  otherwise have had two homes inside a document whose own § Consequences polices exactly that. The
  *"an editor who moves one of these anchors moves both"* clause is the right instrument.
- **A durable home for the `hat`-arm allowlist re-derivation** (`0201` § Consequences). I had noted
  that only the record said `public.assume_role`'s allowlist reason predates R12; an arm that holds
  rc 0 today needed that somewhere that is not a gate log.
- `0201:405-412` also repairs the acceptance-audit ⚠ I raised but did not grade — *"ADR 0203 and the
  next unit"* is now un-paired explicitly, so a reader cannot mis-split the four deferred subjects.

## Observations carried, not graded

- `reviews:` in the hub frontmatter is still `[]`. Linking my reports is the lead's Record-step job
  (both files exist), so this is not a finding — but it is owed for **two** reports now.
- `0203`'s H1 still reads *"…and their disposition is the PO's."* I agree with the decision to leave
  it: it names **whose** call it was, which R11 confirms rather than contradicts, and it is the
  slug-bearing line.
- `test:db`, the four arms, vitest and the deriver are accepted on the record's quoted bare exits and
  were **not** re-run. Nothing in the fix loop's diff reaches `supabase/migrations`, `supabase/seed.sql`
  or `src/`, and the two `supabase/tests/vectors` edits are a JSON comment plus its derived sha stamps,
  with gate 12 green in my own `lint` run. **E2E is still not owed**, for the reasons in the first
  review, unchanged and re-measured (the pathspec assertion is EMPTY at this tip).

---

## Bottom line

**Loop back to step 1 with three MAJORs and two MINORs — none blocking, all textual.** Both BLOCKs are
properly discharged and the batch's product is now internally consistent on the two rulings that
mattered; nine of eleven findings are closed, and the two that are not are closed in substance and
wrong in evidence. The pattern in this round is worth naming because it is the batch's own: **every
new defect is a claim about a document's state, made in the document, that the document contradicts** —
a plan banner asserting it retired a sentence still in it, a derivation asserting a negative its own
filter could not see, and a hub asserting a blocker its own commit discharged. Fix those three
sentences, refresh the hub block, and this is approvable without a further measurement.
