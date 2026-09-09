# BACKEND-STATE-SPLIT — QA review (§6 step 3)

**Verdict: CHANGES REQUESTED**

**Reviewer:** `qa` · **Date:** 2026-09-09 · **Branch:** `main` · **Base:** `2b4fa89b`
**Subject:** `aa8eac1a` · `195454c6` · `d68cc3ba`
**Contract:** ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md) D1–D10 and the
acceptance criteria in [`docs/features/backend-state-split.md`](../features/backend-state-split.md).

Read-only review. Every gate mutation below was reverted; `git status --porcelain` was empty at the
end of every mutation block and is empty now.

---

## Summary

The split's central claim — **nothing was lost** — is **TRUE**, and I re-derived it independently
rather than reusing the implementer's instrument. The gate is real: all four checks fire against the
real corpus, the warn/fail line discriminates, and the 17-arm self-test is **not** vacuous (neutering
each check function reds it). Gates 12 and 15 moved correctly and both fail loud on a corrupted or
absent subject. `npm run lint` and `npm run typecheck` are both rc=0 taken bare. The four cross-seam
pointers all resolve, and none became a copy. The authorization sections are **byte-identical**.

Two findings block, and they are the same failure family this repo tracks: a claim that reads as care
while being wrong.

1. **B1** — ADR 0196's `**Amends:**` label swallows the blockquote beneath it, so the generated
   back-pointer machinery has planted a **false "amended by 0196"** banner in ADR **0078**, the
   authorization capability model. The sentence it mis-parsed is the one saying 0196 changes nothing's
   authority rank. Gate 9 is green because the index is *consistent* with the wrong parse.
2. **B2** — ADR 0196 reports the corpus **shrank ~10 KB**. It **grew 7,587 bytes**. The figure mixes
   decimal KB with binary KiB, and the ADR then explains the non-existent delta causally.

Four MAJORs follow, all about gate coverage the ADR promises and does not have.

| # | Rank | Finding | Requirement violated |
|---|---|---|---|
| B1 | **BLOCKING** | False `amends 0078` edge planted in the authorization ADR | ADR 0196 header block; CLAUDE.md §8 "that label is the ONLY input"; ADR 0196's own ⛔ disclaimer |
| B2 | **BLOCKING** | "742 KB became 732 KB" — it became 749,842 B, a 1.02% increase | ADR 0196 Consequences bullet 3 |
| M1 | MAJOR | Gate 16 is blind to a DELETED seam file and to the dangling router row it leaves; `docs/backend-state/` is outside every link gate | ADR 0196 D10 ("a pointer that resolves nowhere is worse than none"); D3 (the router is the entry point) |
| M2 | MAJOR | D2 has **no enforcer**: a routed, date-stamped, phase-named file passes green | ADR 0196 D2 |
| M3 | MAJOR | D3 has no enforcer; check B is a bare substring test | ADR 0196 D3 |
| M4 | MAJOR | `docs/quality-track-context.md:13` — a live CLAUDE.md-referenced doc — now dangles at the surface map | ADR 0196 D10; the ADR 0105 exemption does not reach it |
| m1–m14 | MINOR | see §5 | — |

---

## 1. Claim 1 — "Nothing was lost." **VERIFIED**, both directions

⛔ Re-derived independently. Source: `git show 2b4fa89b:docs/backend-state.md` (742,255 B, sha-verified
against `git cat-file -s`). My own multiset comparison (own script, not the implementer's):

```
src lines (split): 6354   out lines (split): 6587
DISTINCT missing: 54   TOTAL missing occurrences: 54
DISTINCT extra:   95   TOTAL extra occurrences:  287
non-blank lines present in >1 output file: 29
  ... of which output count EXCEEDS source count (true duplication): 13
```

**Loss direction.** All 54 missing occurrences fall inside exactly the two blocks the unit declares
deleted, and nothing else:

- the `## ADR index` section — measured span **47 lines** (source lines 6308–6354), exactly as claimed;
- the H1 + Purpose block — **13 lines** (H1, blank, an 11-line blockquote), exactly as claimed.

Every other source line survives with at least its source multiplicity. **`MISSING = 0` outside the two
declared deletions is confirmed.**

**Duplication direction** — the half the implementer did not report on, and the one I was asked to
press. The 13 lines whose output multiplicity exceeds source are, individually inspected, **all
boilerplate**: the 12 replicated preamble lines (source count 0), the `>` separator (42 → 78), and
`| --- | --- |` (6 → 7, the router's own table). **No substantive content landed in two files.** The 29
non-blank lines appearing in more than one file are the same set plus legitimately repeated table
rules. All 95 distinct extras are accounted for: the router body, 12 preambles, 12 H1s, the four
cross-seam pointers, and the stamp-history header.

**Is the multiset the right instrument?** Partly. It is blind to reordering and to attribution — a
section filed under the wrong seam is invisible to it. I therefore checked attribution separately (§4)
and found five sections whose heading names another seam's noun; none is a loss, and ADR 0196
Considered-options #3 already concedes that the facts span tables. I also verified the four
authorization sections are **byte-identical**, not merely present:

| section | src lines | dst lines | src sha256/16 | dst sha256/16 | |
|---|---|---|---|---|---|
| Privilege budget | 207 | 207 | `8743526d784f4bbc` | `8743526d784f4bbc` | IDENTICAL |
| Service-role DML registry | 224 | 224 | `6f5ac3abe92bd48e` | `6f5ac3abe92bd48e` | IDENTICAL |
| Zero-policy tables | 48 | 48 | `de7fd0388bd55fcd` | `de7fd0388bd55fcd` | IDENTICAL |
| RLS authorization surface | 66 | 66 | `12cdfc2109fbb4cd` | `12cdfc2109fbb4cd` | IDENTICAL |

**No gated number changed.** `lint:budget-anchor` re-reads `ceiling=759 app=326 public=433 total=759`
at `authorization-and-audit.md:88`; `lint:service-role-registry` reports `45 derived == 45 rows`.

⚠ **One figure in the record I could not reproduce.** `docs/progress/backend-state-split.md:39` says
"`MISSING = 0`, **220 added lines** all accounted". I measure 287 extra occurrences, of which 214 are
neither blank nor a bare `>`. Neither is 220. The accounting *direction* is sound and the enumeration
is right; the number is not reproducible from the artifacts. (MINOR, m3-adjacent.)

---

## 2. Claim 2 — "Gate 16 can actually fail." **VERIFIED**, with four blind spots

### 2.1 The self-test is not vacuous

I neutered each check function in turn (`return []` / `return {F:[],W:[]}`) and re-ran `--self-test`
bare:

| neutered | rc | arms reported |
|---|---|---|
| `checkPreambleIdentical` | **1** | "A catches a drifted preamble", "A catches a missing preamble" |
| `checkRouted` | **1** | "B catches an unrouted file", "B catches a missing router" |
| `checkSupersededTargets` | **1** | throws a `TypeError` at `scripts/check-backend-state.mjs:251` (see m12) |
| `checkSizes` | **1** | "D fails over the hard cap", "D warns (not fails) over the warn line" |

Baseline restored: `self-test: OK (17 arms …)`, rc=0. **The detector has been proven able to find
something.**

### 2.2 All four checks fire against the REAL corpus

| mutation | rc | finding |
|---|---|---|
| A — one word cased differently in `notifications.md`'s preamble | **1** | `[A] docs/backend-state/ — preamble differs in notifications.md (the other 11 file(s) agree)` |
| B — `(privacy-and-dsr.md)` broken in the router | **1** | `[B] docs/backend-state/privacy-and-dsr.md — not linked from README.md` |
| C — dangling `See no-such-file.md § 3.` appended | **1** | `[C] docs/backend-state/notifications.md:129 — … points at \`no-such-file.md\`` |
| D — `notifications.md` padded past 200 KB | **1** | `[D] … 211.3 KB exceeds the 200 KB cap` |
| D — padded past 160 KB, under 200 | **0** | WARN only, `171.3 KB is over the 160 KB warn line` — warn correctly does **not** red |

Baseline green after every rollback; tree clean.

### 2.3 Claim 3 — "Check C's region cut does not blind it." **VERIFIED for the mechanism**

The C mutation above landed at true file line **129** of a 129-line file — **the offset arithmetic
reports real line numbers**, and the marker sat below the preamble in the cut region's shadow and was
still caught. LEARN-089's fix is real, not merely asserted.

### 2.4 What gate 16 does NOT check — four measured holes

Each of these was constructed and run; each returned **rc=0**.

| probe | gate 16 result | why it matters |
|---|---|---|
| A real dangling marker `See vanished-seam.md § 4.` appended to the preamble of **all 12** seam files | `OK … preamble identical` | A is silent (they still agree); C is silent (region cut). The README's own rule is "edit it in ONE place and re-copy" — the workflow that would replicate it 12×. |
| A real dangling marker appended to `README.md` | `OK` | The router is skipped whole. It is also the file people edit most. |
| `notifications.md` **deleted** while the router still links to it | `OK — 11 seam file(s) + README.md, **all routed**` | **M1.** See below. |
| `phase-24-2026-09-20.md` created with the correct preamble and routed | `OK — 13 seam file(s) …` | **M2.** D2 is prose. |
| `⚠ **Superseded** — moved. See notifications.md § 9999.` | `OK` | **m1.** The `§ <n>` half of the mandated marker form is never validated. |

---

## 3. Claim 4 — "Gates 12 and 15 moved correctly and re-run green." **VERIFIED**

Both bare, from the repo root:

```
$ node scripts/check-service-role-registry.mjs
Service-role DML registry: OK -- 45 derived site(s) == 45 registry row(s) (census 40 + callDoor() 5).
rc=0
$ node scripts/check-budget-anchor.mjs
budget-anchor self-test: OK (15 bad pairs … 5 good pairs …)
budget-anchor gate: OK — docs/backend-state/authorization-and-audit.md:88 ceiling=759 app=326 public=433 total=759 …
rc=0
```

**Both fail loud when their subject is corrupted** — I did not take this on the ADR's word:

| corruption | gate | rc | result |
|---|---|---|---|
| registry section body emptied | 12 | **1** | `derived 45 service-role write site(s); registry has 0 row(s).` |
| heading prefix broken (`registry` → `register`) | 12 | **2** | `FATAL: no "## Service-role DML registry" heading in …authorization-and-audit.md.` — **the FATAL path is reachable** |
| seam file removed entirely | 12 | **1** | unhandled `readFileSync` ENOENT (see m6) |
| `BUDGET-ANCHOR` app count 326 → 327 | 15 | **1** | `THE PARTS DO NOT SUM TO THE WHOLE.` |
| anchor line deleted | 15 | **1** | `found NO <!-- BUDGET-ANCHOR … --> comment. ⭐ This is the anti-vacuity red` |
| seam file removed entirely | 15 | **1** | `…does not exist. That file is the ceiling's ONE HOME…` |

⚠ **Note the last row of §2.4 against these**: with `authorization-and-audit.md` deleted, gates 12 and
15 both red — but **gate 16 reports `OK`, rc=0, "all routed"**. The gate whose sole job is the
directory's structural integrity is the one that misses it.

**Gate 12's `process.cwd()` sensitivity is real and correctly disclosed.** Run from `scripts/`: rc=**2**
with a `node:internal/modules/cjs/loader` stack. Gates 15 and 16 run clean from the same directory.
`FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD` records this accurately.

---

## 4. Claim 5 — citations and links

**Gates.** 7, 9 and 13 are green (whole `npm run lint` chain rc=0). ADRs genuinely needed zero link
edits: gate 9 is green and the sweep below confirms every ADR mention is a bare code-span, not a link.

**Tree-wide sweep** (excluding `graphify-out/`, `node_modules/`, `.git/`, `worktrees/`): **353 lines**
mention `backend-state.md`; of those exactly **3** are markdown links whose target resolves nowhere.

| # | file:line | link | verdict |
|---|---|---|---|
| 1 | `docs/design/temp/document-model-audit-handoff.md:105` | `[backend capability map](../backend-state.md)` | **pre-existing** — resolves to `docs/design/backend-state.md`, one `../` short; was broken before the split. Not this unit's. |
| 2 | `docs/design/authz-ae1-rpc-rulings.md:8` | `[backend-state.md § Service-role DML registry](../backend-state.md)` | a dated design record. ADR 0105 exemption **defensible**. |
| 3 | `docs/quality-track-context.md:13` | `- **What the backend already provides:** [backend-state.md](backend-state.md)` | **M4 — not defensible.** |

**Ruling on the "historical records are not rewritten" rationalization: it is correct for #2 and wrong
for #3.** ADR 0105 protects a *record of what was true when written*. `docs/quality-track-context.md` is
not a record — CLAUDE.md:153 instructs every reader of the accreditation track to **"read
`docs/quality-track-context.md` first"**, and the broken line is that document's own pointer at the
surface map. ADR 0196 D10 states the principle itself: *"a pointer that resolves nowhere is worse than
none."* Two dangling links in dated design records is a defensible cost; one in a live, CLAUDE.md-cited
orientation document is the very defect D10 names.

**Additionally out of the gated set, and not a link:** `supabase/config.toml:50` still carries
`docs/backend-state.md:3547-3549` — the **identical citation** ADR 0196:143 says was chased down in
`check-supabase-config-schemas.mjs` (that script now cites `docs/backend-state/cases-and-ethics.md
§ PCI + TV`). `config.toml` is not an applied migration, so ADR 0078's freeze does not cover it. This is
the "a fix correct at most sites reads as a fix" shape the unit itself filed a follow-up about. (m7)

**Migrations: the ADR's figure is exact.** Exactly 2 files under `supabase/migrations/` mention the old
path (`20260905000500_mem_w4_technical_director_referrals.sql:1216`,
`20261003005600_ae24_containment_on_the_destructive_event.sql:78`), both SQL comments.

**48 `backend-state.md:<line>` citations remain tree-wide** (36 in `docs/reviews/`, 7 in `docs/progress/`,
2 in `docs/decisions/`, 1 each in followups / backend-state / supabase). ADR 0196's Consequences already
states these are "now unrecoverable"; leaving them in dated reviews and records is correct.

---

## 5. Findings

### BLOCKING

#### B1 — ADR 0196 has planted a FALSE amendment banner in ADR 0078, the authorization capability model

`docs/decisions/0078-authorization-capability-model.md:4` now reads:

> ⬅ **A later ADR changes this one** — it is **superseded by** [0079](…), and **amended by** [0134](…),
> [0167](…), [0169](…), **[0196](0196-backend-state-split-on-the-module-seam-axis.md)**.
> Check what changed before relying on anything below.

**Nobody declared that edge.** ADR 0196's header declares `**Amends:** [0186]` only; 0078 appears under
`**Related:**`. I exercised the generator's own parser to find where it came from:

```
$ node -e "import('./scripts/build-adr-index.mjs').then(m => …parseAdr('0196-….md', text))"
EDGES: [{"verb":"amends","target":"0186"},{"verb":"amends","target":"0078"}]
--- LABEL: "Amends"
    VALUE: "[0186](./0186-…) — 0186 classified `backend-state.md` as an *Outbound* destination … > ⛔
    **This ADR does not change what the map is FOR, and it does not move a single fact into a >
    different authority rank.** The live catalog is still the sole truth for schema, RLS and grants >
    (CLAUDE.md § graphify, ADR 0078); the map is still a map. …"
```

`scripts/build-adr-index.mjs:96` documents the mechanism: *"A value runs to the next label or the end of
the preamble."* ADR 0196's ⛔ blockquote at lines 8–11 carries no colon-bearing bold label, so it is
swallowed into the `**Amends:**` value, and `\b0\d{3}\b` picks up `0078`.

**The sentence that was mis-parsed says the exact opposite of the banner it produced.** The reader of ADR
0078 is now told to check what a documentation-filing decision changed about the capability model, and
`docs/decisions/INDEX.md` records `0196 … amends 0078, 0186` and an inflated edge total (`69 carry an
inbound supersedes/amends edge`).

⛔ **No gate can see this.** `lint:adr-index` is green because the index is *consistent with the wrong
parse*. It is regenerated on every `npm run adr:index`, so it will re-land.

**Requirement violated:** ADR 0196's own ⛔ disclaimer ("it does not move a single fact into a different
authority rank"); CLAUDE.md §8 ("that label is the ONLY input to the generated back-pointers").

**Remedy** (one edit, no code change): move the ⛔ blockquote below `## Context`, or introduce a
colon-bearing bold label between the `**Amends:**` line and the blockquote so the value terminates, or
drop the numeric `0078` from that sentence. Then `npm run adr:index` and confirm 0078's banner loses the
`0196` entry and `INDEX.md` reads `amends 0186`.

#### B2 — ADR 0196 reports a 10 KB reduction; the corpus grew 7,587 bytes

`docs/decisions/0196-backend-state-split-on-the-module-seam-axis.md:132-135`:

> ⚠ **Total volume did not fall** — 742 KB became 732 KB across 13 files, and the ~10 KB delta is the
> deleted ADR index minus twelve added preambles.

Measured:

```
$ wc -c < source.md            742255      (= 724.9 KiB = 742.3 kB)
$ cat docs/backend-state/*.md | wc -c   749842      (= 732.3 KiB = 749.8 kB)
DELTA +7587 bytes (+1.02%)
```

The bullet compares **742 (decimal kB)** against **732 (binary KiB, taken verbatim from gate 16's `732 KB
total` output, which divides by 1024)**. Same corpus, two units. The corpus **grew**, and the sentence
then supplies a causal account — "the deleted ADR index minus twelve added preambles" — for a delta whose
sign is wrong; the deletions (60 lines) are smaller than twelve replicated 14-line preambles plus twelve
H1s plus a 72-line router.

This is precisely the shape the ADR is otherwise careful about. The bullet's headline ("Total volume did
not fall") reads as candour, which is what makes the wrong number pass unread. The same figure is
restated in the ADR's `## Context` growth row in decimal kB, so the ADR is internally inconsistent about
its own unit.

⚠ Related: the growth row's first datum, **"119 KB (2026-07-01)"**, is not reproducible. The first July
commit touching the file (`17df421b`) is **109,765 B**; the last June commit (`9fdd111`) is **115,228 B**.
Neither is 119 KB in either unit. The row's *direction* (superlinear, never shrinking) is unambiguously
true and every other figure in the Context table reproduced exactly (§6).

**Remedy:** state one unit throughout, give the true delta (`742,255 → 749,842 B, +7,587`), and delete or
correct the causal clause. Re-derive the 07-01 datum or drop it.

### MAJOR

#### M1 — Gate 16 cannot see a deleted seam file, and `docs/backend-state/` is outside every link gate

Two independent halves, and together they leave the router ungated in both directions.

**(a) Gate 16's population is the directory listing (D7, correct), so a removed file simply vanishes from
it.** Check B asks *file → is it in the router*; nothing asks *router row → does the file exist*.
Measured, with the file holding §Privilege budget, §Service-role DML registry, §Zero-policy tables and
§RLS authorization surface removed:

```
$ mv docs/backend-state/notifications.md /tmp/ && node scripts/check-backend-state.mjs
backend-state gate: OK — 11 seam file(s) + README.md, all routed, preamble identical, 721 KB total …
rc=0
```

The success line actively asserts **"all routed"** over a router carrying a row that resolves nowhere.

**(b) No link gate covers the new directory.** Verified with a discrimination control, not by reading the
corpus lists:

```
# plant a dangling link in the router
$ printf '\n[dangling](./no-such-seam.md)\n' >> docs/backend-state/README.md
  gate7 rc=0     gate13 rc=0            <- neither notices

# positive control: the same plant in a hub, a known-covered corpus
$ printf '\n[dangling](./no-such-hub-target.md)\n' >> docs/features/backend-state-split.md
  gate13 rc=1  [LINKS] docs/features/backend-state-split.md:92 — link `./no-such-hub-target.md` does not resolve
```

`scripts/check-progress-doc.mjs:113,617-621` fixes the link corpus at `PROGRESS.md`, `CLAUDE.md`,
`docs/progress/*`, the follow-up register and `docs/bugs/*`. `docs/backend-state/` is in none of the
three link-gated corpora — the exact gap
`FUP-REGISTER-GATE-HYGIENE-LINK-CHECKING-HAS-NO-GATE-OUTSIDE-THREE-CORPORA` names, now extended to the
router and to the four cross-seam pointers.

**Requirement violated:** ADR 0196 D10 ("a pointer that resolves nowhere is worse than none") and D3
(the router is the entry point). **Remedy:** either add a reverse arm to check B (every `](x.md)` in the
router names a file in the listing) — cheap, and it is the same population D7 already uses — or add
`docs/backend-state` to gate 7's sweep. Preferably both.

#### M2 — ADR 0196 D2 has no enforcer at all

D2 is called *"the rule that keeps D1 from decaying back into the phase axis one file at a time."* It is
prose. Measured — a file named for a phase, carrying a date, with the correct preamble and a router row:

```
$ node scripts/check-backend-state.mjs
backend-state gate: OK — 13 seam file(s) + README.md, all routed, preamble identical, 733 KB total …
rc=0
```

Checks A and B are satisfied by construction (copy the preamble, add a router row) — the two steps
anyone adding a file would take anyway. D7 forbids a hand-list of legal names, correctly, but a
**filename-shape** check is not a hand-list: reject a basename matching `phase`, a unit code, or a
`YYYY-MM-DD`. Nothing of the sort exists.

**Remedy:** add a check E on filename shape, or record explicitly in ADR 0196 and `docs/lint-gates.md`
that D2 is **prose only, enforced by review** — the Architecture-rules convention ("each rule names its
enforcer, or `prose only`"). Silent non-enforcement of the decision's own anti-decay rule is what must
not stand.

#### M3 — D3 ("the router dispatches on the ACTION") has no enforcer either

`scripts/check-backend-state.mjs:109` is the whole of check B:

```js
if (!routerText.includes(`(${f.name})`)) { … }
```

A bare substring anywhere in the file satisfies it — inside a code fence, a sentence, a comment. Nothing
requires a table row, a "When you are about to…" clause, or that the router is a dispatch table at all.
The router today is well-formed; nothing keeps it so. Same remedy as M2: enforce, or label `prose only`.

#### M4 — a live, CLAUDE.md-referenced document now dangles at the surface map

`docs/quality-track-context.md:13`:

```
- **What the backend already provides:** [backend-state.md](backend-state.md)
```

Resolves to `docs/backend-state.md` — **MISSING**. CLAUDE.md:153 instructs every reader of the
accreditation track to read this file *first*. It is an orientation document, not a record of what was
true when written, so ADR 0105's exemption does not reach it, and ADR 0196 D10's own principle condemns
it. One-line repoint to `backend-state/README.md`.

### MINOR

- **m1 — D5's marker check validates the file, never the section.** `⚠ **Superseded** — moved. See
  notifications.md § 9999.` passes green. D5's stated purpose is that a marker must not "send the reader
  nowhere"; half of the mandated form `See <file> § <n>.` is unchecked.
- **m2 — check C's region cut, exploited.** A dangling marker replicated **identically** into all 12
  preambles is invisible (A agrees, C is cut); one placed in `README.md` is invisible (router skipped
  whole). Both are low-realism, both are the region cut's cost, and neither is stated anywhere. Worth one
  sentence in the script header beside the cut's justification.
- **m3 — the link-repair count has two values.** ADR 0196:99 and the hub:44 say **18**; the record:77
  ("**19**, all repaired (17 in gate 7's corpus, 2 in gate 13's)") and the commit message say **19**.
  A committed number with two homes, in the unit whose `**Related:**` cites ADR 0195 for exactly that.
  Separately, the record's "**220 added lines**" (record:39) is not reproducible — I measure 287 extra
  occurrences, 214 of them non-blank / non-`>`.
- **m4 — `docs/lint-gates.md:35` overstates by one.** *"all four were additionally mutation-run against
  the real corpus (preamble drift, an unrouted file, a dangling marker — each caught …)"* — it says four
  and enumerates three, and the record (`:63-66`) claims only those three. I ran D against the real
  corpus myself and it fires correctly, so this is an accuracy defect, not a coverage hole. Say three, or
  run and record the fourth.
- **m5 — gate 12's failure message was mangled by the move.** `scripts/check-service-role-registry.mjs:461-465`
  now reads *"… and bring / docs/backend-state/authorization-and-audit.md > "Service-role DML registry" /
  a new site needs a row stating owner…"*. The clause `back into agreement --` was dropped with the old
  path line. This is the text a future engineer reads at the moment the gate reds.
- **m6 — gate 12 crashes rather than reporting when its subject is absent.** With
  `authorization-and-audit.md` removed it exits 1 with a raw `node:fs` ENOENT stack, where gate 15 prints
  *"…does not exist. That file is the ceiling's ONE HOME; … a missing subject is a finding, never a
  pass."* Non-zero, so not blind — an ergonomics gap, and a natural companion to the filed cwd follow-up.
- **m7 — `supabase/config.toml:50`** still cites `docs/backend-state.md:3547-3549`, the identical
  citation ADR 0196:143 says was repointed in `check-supabase-config-schemas.mjs`. Not a migration; the
  freeze exemption does not cover it.
- **m8 — `conventions.md:201-204` now instructs the reader to do something impossible.** The frozen
  migration-registry banner says each phase documents its range *"in its `##` section header **above**"*
  and *"add a section"*. Post-split there is one phase section in that file. This is the same breakage
  `stamp-history.md:22` was explicitly patched for (*"'Below' stopped being true at the split"*) — the
  patch was applied at one site and not the other.
- **m9 — `PROGRESS.md:32`** carries a bare prose pointer `→ backend-state.md § "Remote discipline —
  standing rules"` naming a deleted file. Line 29's markdown *target* was repaired but its *link text*
  still reads `backend-state.md`. Gate 7 is green because it checks targets only.
- **m10 — ADR 0196's "119 KB (2026-07-01)"** is not reproducible; see B2.
- **m11 — hub shape (ADR 0186 D3).** The `## Current state` block conforms exactly: five sections in
  order, `**Updated:**` present, well under 60 lines, gate 13 green. But `## Execution note (2026-09-09)`
  is a dated session narrative in a hub, and one fact in it — *"the lead advised deferring this past the
  Batch 7/8 boundary; the PO overrode that"* — has its **only home there** and does not appear in the
  record. At `complete` the hub block is cut into the record; that fact will be cut with it.
  **Move it into the record's Session log before completion.**
- **m12 — `scripts/check-backend-state.mjs:250`** indexes `[0]` on a possibly-empty result, so a broken
  `checkSupersededTargets` throws a `TypeError` instead of naming the failed arm. Exit is still non-zero;
  cosmetic.
- **m13 — the phase axis was re-filed, not retired.** Measured over the 67 `##` sections: **57 are still
  date-stamped or unit-coded phase slices**, and **seven of the eleven seam files** (`cases-and-ethics`,
  `forms-and-responses`, `meetings-and-governance`, `notifications`, `printing`, `privacy-and-dsr`,
  `tenancy-and-identity`) contain **zero** axis-free "what is true now" section. ADR 0196's Consequences
  concede this honestly ("12, not 53"); `README.md:65-72` § *The seam axis, and why it is the seam and not
  the phase* does not, and a reader arriving there will expect a state document. One qualifying sentence
  in the router would close the gap between the two.
- **m14 — pointer arithmetic inherited, not resolved.** `authorization-and-audit.md:18` says *"The
  **three** corrected pt-BR authority messages (`dispose_case_phi`, `revoke_printed_document`)"* and names
  two. The target text (`document-model.md:346-348`) has the same defect. Inherited from the source, but
  the new pointer reproduces it rather than flagging it.

---

## 6. What I checked and found correct

Stated plainly, because an approval-shaped list is as much a finding as a defect list.

**ADR 0196 `## Context` table — every figure re-measured, all exact but the growth row's first datum:**

| claim | measured | |
|---|---|---|
| 742,255 bytes / 6,353 lines | `wc -c` 742255, `wc -l` 6353, `git cat-file -s` 742255 | ✅ |
| 183 commits, 84 in 30 days | `git log --follow --oneline` = 184 today, minus the deletion commit = 183 | ✅ |
| 1 preamble + 66 `##` sections | first `##` at line 382 (preamble 381), `grep -c '^## '` = 66 | ✅ |
| 53 slices + 13 registries = 66; 4,577 + 1,396 + 381 = 6,354 | parts sum | ✅ |
| 33 SUPERSEDED · 45 STALE · 35 "no longer" · 194 ⛔ · 257 ⚠ · 266 date stamps | 33 / 45 / 35 / 194 / 257 / 266 (occurrences) | ✅ |
| line 380 = 67,360 characters | `awk` max = 67360 at NR 380 | ✅ |
| deleted `## ADR index` = 47 lines | span 6308→6354 = 47 | ✅ |
| largest file 114.6 KB | gate output `authorization-and-audit.md at 114.6 KB` | ✅ |
| exactly two migrations carry stale mentions | `rg -l` over `supabase/migrations` = 2 | ✅ |
| 119 KB at 2026-07-01 | 109,765 B (first July commit) / 115,228 B (last June commit) | ⚠ m10 |

**ADR 0186 was genuinely amended and the back-pointer landed.** `0186:3-11` carries the generated
`amended by 0196` block; `INDEX.md` row 0186 reads `⚠ amended by 0196`. Correct. (The *extra* 0078 edge
is B1.)

**Claim 6 — `npm run lint` rc=0 and `npm run typecheck` rc=0, taken bare, not piped.** Confirmed:
`LINT_RC=0`, `TYPECHECK_RC=0`. Gate 16 is last in the `&&` chain in `package.json:12`, so it genuinely
ran. eslint at 0 errors / 0 warnings.

**The four cross-seam pointers are pointers, not copies.** All four resolve into `document-model.md`
§ END STATE (span 18–351): REFNOTE at 293/297–309, the `is_tenancy_admin_of` rename at 283–291, the
cadence surface at 337–345, the pt-BR messages at 346–350. In each pointing file the named identifiers
appear once — in the pointer itself. `revoke_printed_document` is the one partial exception: its
*message* correction is a pointer, but its *arm* ruling has substantive text in both files
(`authorization-and-audit.md:836-839` and `document-model.md:330-331`), stating complementary facts
rather than duplicating one. Acceptable.

**`stamp-history.md` is a legitimate archive, not a dumping ground — with a caveat.** 93% of its 72,345
bytes is line 59, the 67,360-character collapsed stamp chain. It is declared frozen (`:19-20`), it is
routed, and D9's justification (several stamps carry facts appearing nowhere else) is sound and matches
this repo's rule against compressing a record to fit a cap. The caveat is practical: line 59 cannot be
diffed line-wise, linked to by line, or `grep -n`'d usefully. Not a blocker; worth knowing before anyone
is told to "check the stamp history".

**`conventions.md` is a coherent seam, not a leftovers bin.** All six headings map one-to-one onto the
router's declared scope (pgTAP, remote discipline, migration registry, HC0xx SQLSTATEs). Its shape is
lopsided — 65% is the frozen migration registry, 18% the SQLSTATE table — but nothing in it belongs
elsewhere. The only defect is m8.

**Seam assignment, sampled by heading against the router's declared scope.** Five sections name another
seam's noun: `document-model.md:764` ("printed renditions" → printing), `:995` ("referrals" → cases),
`tenancy-and-identity.md:685` (names two seams in one heading), `authorization-and-audit.md:499`
("personal details / `profiles`" → identity), `cases-and-ethics.md:20` ("erasure key" → privacy). All
five are phase slices whose content genuinely spans seams — the case ADR 0196 Considered-options #3
anticipates. None is a misfiling worth undoing; noted for whoever next extends those files.

**Gate 16 is correctly placed and correctly scoped.** Population = the directory listing (D7 honoured);
paths resolved from `import.meta.url`, so it runs clean from a subdirectory; warn returns separately from
fail so a warn cannot red the build and get raised (D4's stated intent); it is the last link of
`package.json`'s `lint` chain and genuinely executes.

**Nothing in the split weakens the authorization posture at the content level.** The four authorization
sections are byte-identical by sha; both gated numbers re-read unchanged; `320` §U4's mirror still agrees.
No RLS policy, DEFINER door, grant or migration was touched — the only `supabase/` edits are comment lines
in four pgTAP files and one mutation shell script. B1 is a documentation-level authorization defect, not a
runtime one.

---

## 7. What must change before this can be approved

Blocking, in order:

1. **B1** — break the `**Amends:**` label's value at the blockquote, regenerate with `npm run adr:index`,
   and verify `0078`'s back-pointer block no longer names 0196 and `INDEX.md` reads `amends 0186`.
2. **B2** — correct ADR 0196's volume figures to one unit and the true sign (`742,255 → 749,842 B,
   +7,587`), and remove or fix the causal clause. Re-derive or drop the 07-01 datum (m10).

Majors — each either fixed or explicitly recorded as unenforced:

3. **M1** — add the reverse arm to check B (router row → file exists), and/or add `docs/backend-state` to
   gate 7's link sweep. The router is the design's single entry point and is currently ungated both ways.
4. **M2 / M3** — enforce D2 and D3, or state `prose only` for them in ADR 0196 and `docs/lint-gates.md`.
   A decision's anti-decay rule silently unenforced is what this ADR exists to stop happening to prose.
5. **M4** — repoint `docs/quality-track-context.md:13`.

Minors m1–m14 are not individually blocking. m3, m4 and m11 should be taken with the majors, because they
are record-accuracy items and this unit's whole subject is record accuracy.

## 8. Notes for the completion step

- The hub is `gated` with `reviews: []`, and the record states no QA review was run. Both are accurate and
  gate 13 refusing `complete` without an APPROVED verdict line is the gate behaving correctly.
- On a future APPROVED verdict: hub → `complete`, `reviews:` gains this report, `## Current state` is cut
  into the record per ADR 0186 D3 — **and m11's Execution-note fact must be moved into the record's
  Session log first, or it is lost with the cut.**
- Not run and therefore not claimed by me either: `npm run test:db` and `npm run e2e:prod`. This unit
  touches no SQL, application code or specs; the record says the same rather than reasoning it away, which
  is the right form.
- ⚠ `scripts/check-service-role-registry.mjs:3` still calls itself "gate 11" while `package.json` and
  `docs/lint-gates.md` order it as gate 12. Pre-existing, not introduced here, and outside this unit's
  subject — recorded so the next reader does not chase it.
