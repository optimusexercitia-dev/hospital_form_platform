# BACKEND-STATE-SERVICE-ROLE-SEAM — progress record

> Hub: [backend-state-service-role-seam.md](../features/backend-state-service-role-seam.md) ·
> governing decision: ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md)
> D4, applied by PO ruling of 2026-09-11 (register entry
> `FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`). Branch:
> `backend-state-service-role-seam`, cut from `main` at `3c66efb6`.

Subjects: `docs/backend-state/authorization-and-audit.md` (the frozen slice
`## Service-role DML registry (AE1.4 …)` and the `## Current state` block above it),
`docs/backend-state/README.md` (the router), the new `docs/backend-state/service-role-dml.md`, and
`scripts/check-service-role-registry.mjs` (gate 11, which locates the registry by path + heading
regex). ⛔ No migration, no RLS, no `src/`.

## Session log

### 2026-09-11 — unit opened; review queue processed; nothing moved (lead)

**Why now.** The PO ruled the noun on 2026-09-11 and, in the next message, instructed the lead to
open the split unit. The tree was clean on `main` at `3c66efb6` (the rulings commit).

**Measured at open, not quoted.** Gate 16 (`node scripts/check-backend-state.mjs`, rc **0** bare):
`WARN — [D] docs/backend-state/authorization-and-audit.md — 160.4 KB is over the 160 KB warn line
(cap 200 KB)`; `wc -c` **164,204**; block at 97/100. The slice to move, by `awk` byte sum per `##`
heading: **40,694 B**, sub-headings Groups A–H + Summary, **13** outbound links (all
`../design/authz-ae1-rpc-rulings.md` — same directory depth in the new file, so they resolve
unchanged, ⚠ which is exactly why the check must be RUN and mutated rather than reasoned about).
Inbound: the file's own `## Current state` block names the section twice (bullets 17 and 34 of the
block, plus the § list at :89/:98); outside the directory only `docs/design/authz-ae1-rpc-rulings.md:8`
still links the pre-split `backend-state.md` (ADR 0105-exempt, per the split review). Gate 11 hard-codes
`DOC = docs/backend-state/authorization-and-audit.md` and `SECTION_RE = /^## Service-role DML registry\b/`
(`scripts/check-service-role-registry.mjs:62-64`) — ⇒ the unit is docs **plus one gate constant**.
Citations to re-point found by grep: `docs/lint-gates.md:25`,
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9`. `CONTEXT.md:359/374` cite the
file for the **privilege budget** — that noun stays.

**ADR number reserved: 0206**, measured as the highest on any live branch (`0205` on `main`; the
three `origin/*` feature branches carry none higher) + 1, skipping the reserved and unfillable
`0202` / `0204`. ⛔ Re-measure at the rebase stop before the file is created.

**CLAUDE.md review queue processed at open (Record step 7 debt, per-clone file).** Four entries
since the 2026-09-10 marker, dispositions:

| entry | signal | disposition |
|---|---|---|
| `c637a596` (4 bullets, Batch 10) | *stale* in quoted other-repo text; ADR 0200 "declare a tightening" prose; B-1 quoted back and verified; `Arm 1 guards: 7` in an audit front-matter | not a doc problem ×4 — the front-matter line now reads **13** (`docs/reviews/authz-writepath-audit-findings.md:12`), already regenerated (`docs/progress/writepath-baseline.md:694`) |
| `8544d35e` | `0202` absent, so §8's "highest + 1" yields a reserved number | not a CLAUDE.md defect — the rule is *necessary not sufficient*; plan reservations are the plan's, and every AE5 record since carries *never 0202 / never 0204* |
| `6809c28b` | a pre-rebase sha named in a QA review | the arm-3 unit's round-2 MINOR, already discharged (`5ffeed2c`) |
| `825e1912` (this lead, previous message) | *stale* in the PO's own task prompt | hook finding (ii) — the keyword fired on the instruction |

Outcome: **0 doc fixes**, processed marker prepended to the queue. No CLAUDE.md edit proposed.

**Homes written:** hub (`in_progress`, block at open), this record, `docs/features/INDEX.md`
regenerated. Gate 13 run bare after the writes; rc in the commit message.

### 2026-09-11 — the split built: slice moved verbatim, gate 11 followed it, link check mutated (backend)

**Baselines, re-measured at this session and not quoted from the ruling.** Gate 16
(`node scripts/check-backend-state.mjs`, rc **0** bare):
`WARN — [D] docs/backend-state/authorization-and-audit.md — 160.4 KB is over the 160 KB warn line
(cap 200 KB)`, and its headroom line named `authorization-and-audit.md (97, 3 left)`; `wc -c`
**164,204**, `wc -l` **1,443**; `state layer — 11 domain seam(s)`, `15 seam file(s) + README.md`.
The slice by `awk` byte sum per `##` heading: **40,694 B** — the largest heading in the file, ahead
of the privilege budget (18,091), the `authz` catalog (13,492) and quality-office oversight
(11,393 for its largest of three). Extracted as lines **362–584** it is **223 lines / 40,693 B**;
the 1-byte delta is the trailing blank line the `awk` sum attributes to the heading, not a
discrepancy. Outbound links in the slice, enumerated not eyeballed
(`grep -oE '\]\([^)]+\)' | sort | uniq -c`): **13, all** `](../design/authz-ae1-rpc-rulings.md)` —
same directory depth in the new file, so they resolve unchanged, which is exactly why the check was
RUN and MUTATED rather than reasoned about. Gate 11 before, from its own output:
`Service-role DML registry: OK -- 45 derived site(s) == 45 registry row(s) (census 40 + callDoor() 5).`
rc **0**.

**⚠ A frozen inconsistency travelled with the slice, unfixed, deliberately.** The Summary paragraph
says **44/44** and its family totals sum to 44, while the table carries **45** `Key`-bearing rows
(`grep -c '^| \`'`) and gate 11 parses 45. The surplus is in Group D: its heading says *8 sites* and
it lists **9** rows, because `assignOrgAdmin` calls `grant_role_for` twice (org tier + single-hospital
auto-seat) — the legitimate multiset duplicate the gate's own header paragraph describes. ⛔ Not
repaired here: the slice is frozen (ADR 0196 D5) and it already carries its own instruction to
*"re-derive this paragraph from the rows whenever the table changes — never adjust the numbers
arithmetically"*. What the new file's block does instead is point at gate 11's output as the live
count and warn against quoting the tally.

**The move.** `docs/backend-state/service-role-dml.md` built by CONCATENATION, never by retyping:
`title` (a Write-tool H1) + the preamble **extracted** with `sed -n '3,5p'` from
`authorization-and-audit.md` (300 B; `diff` against `notifications.md`'s same region rc **0**, so
check A/C pass by construction) + a `## Current state` block printed by
`node scripts/check-backend-state.mjs --scaffold` and filled from the slice's own sentences + the
slice. Result **316 lines / 47,349 B**, `grep -c $'\r'` = **0**.

**Verbatim, proved by diff and not by eye.** `git show main:docs/backend-state/authorization-and-audit.md
| sed -n '362,584p'` against `sed -n '94,316p' docs/backend-state/service-role-dml.md`: **empty
output, rc 0** read bare.

**The old file.** The heading `## Service-role DML registry (AE1.4; …)` stays as a stub with the
rule-2 forward marker directly under it, naming both the FILE and the HEADING (gate 16 check C
validates both halves since 2026-09-09; `§ 9999` used to pass). Its `## Current state` block was
re-cut: the Surface bullet became a two-line pointer, the Invariants bullet was **deleted whole**
rather than shortened (every clause in it was a bound — *"None found in TS" is not "unaudited"*,
`door: X` is a NAME, the census under-counts BY DESIGN — and README rule 4 says delete-and-point
rather than maim), the Open-edges sentence about `NONE`/`UNCONFIRMED` rows left with the noun, and
§ Where the detail lives now marks the entry as a stub and links the new seam. Each of those bounds
is restated in the NEW file's block, above the frozen text that carries it — the bounds relocated,
they were not compressed away. `**Updated:**` already read 2026-09-11 and stayed. Block **97 → 90
lines** by the gate's own `stateBlockOf` accounting; file **164,204 → 123,224 B**.

**Gate 11 travelled in the same commit**, all three sites: `DOC` (line 62), the header comment
(line 6) and the remediation text the failure path prints (line ~464). ⛔
`FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD`'s subject (`ROOT = process.cwd()`) untouched.
After: `Service-role DML registry: OK -- 45 derived site(s) == 45 registry row(s) (census 40 +
callDoor() 5).` rc **0** — byte-identical to the baseline line, which is the claim. The one
surviving `authorization-and-audit` mention in that script is the history comment I wrote, which is
a dated statement and correct as such.

**Router.** A row for `service-role-dml.md` ("touch a service-role write — a `createAdminClient()`
call site, the `callDoor()` wrapper, or any row gate 11 diffs"); *a service-role write* removed from
the `authorization-and-audit.md` row. § The seam axis's arithmetic **re-measured from the directory
listing, and what was counted is now stated in the sentence**: `ls docs/backend-state/*.md` = **17**,
minus `README.md`, minus the **4** `generated-*.md` exemptions the gate prints on every run = **12**
files that owe a `## Current state` block — 8 domain-mapped + 4 cross-cutting. `service-role-dml` is
filed **cross-cutting**, and the sentence says why the word means something different for it: it
enumerates ONE property across the domains rather than binding them all. The sentence read
*"Eight … eleven … three"*; both prior corrections are kept in place.

**Citations.** Sweep run: `grep -rn "authorization-and-audit" --include=*.md --include=*.mjs
--include=*.sh --include=*.json . | grep -v node_modules`, then filtered to the lines that name the
REGISTRY. Two are pointers and were re-pointed (ADR 0196 D10): `docs/lint-gates.md:25` (now names
`service-role-dml.md` and records the former home for the dated records that still cite it) and
`docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9` (its link text still said
`../backend-state.md` from the pre-split era — fixed too). ⛔ **Left alone as historical claims:**
`docs/reviews/backend-state-split-review.md:92/169/411` (a dated review of the 2026-09-09 split),
`docs/plans/authz-evolution.md:319` (the AE1.4 instruction as written, which already said *"or a
dedicated file"*), `docs/followups/follow-ups-open.md:1959` and the ruling body, the AE-era progress
records, and this unit's own hub/record. **`CONTEXT.md:359` and `:374` stay**: they cite the file for
the **privilege budget**, and that noun did not move — gate 15 confirms, still resolving its anchor
at `docs/backend-state/authorization-and-audit.md:168`.

**The link check RUN and PROVEN ABLE TO FAIL (LEARN-090).** Green first: gate 16 rc **0**, no `[D]`,
no findings. Then one link *inside the moved slice* mutated —
`[rulings §9](../design/authz-ae1-rpc-rulings.md)` → `…-MUTATED.md`, chosen because `rulings §9`
occurs exactly once. ⚠ **The mutation asserted itself applied before the gate ran** (the 2026-09-09
attempt at this proof edited a link the file did not contain and reported rc 0 — a vacuous test that
read like a passing one): `grep -c` = **1** and `git diff --stat` = *1 insertion, 1 deletion*. Gate
16 then: rc **1**, `backend-state gate: FAILED`,
`[LINKS] docs/backend-state/service-role-dml.md:236 — link ../design/authz-ae1-rpc-rulings-MUTATED.md
does not resolve`. ⚠ The finding is labelled `[LINKS]`, not `[F]` — check F is gate 13's `checkLinks`
imported, never re-implemented, and it keeps its own label. Restored with `git checkout --`
(possible because the move was committed first): `grep -c MUTATED` = **0**, `git status` clean, gate
16 rc **0** again. Both readings bare.

**ADR 0206** — `docs/decisions/0206-the-service-role-dml-registry-gets-its-own-seam.md`. Number
**re-measured at reservation, not inherited**: highest on ANY live ref by
`git for-each-ref refs/heads refs/remotes` + `git ls-tree` over `docs/decisions/` across all five
refs (`main`, this branch, `origin/{main,authz-ae5-matrix-arm3-cells,authz-c2-tier1,authz-enforcement-manifest}`)
= **0205**, +1 = **0206**; `0202`/`0204` are reserved and unfillable and were skipped, not counted.
`**Amends:** 0196` (D1 gains a twelfth hand-written seam; D4's remedy applied for the first time).
`npm run adr:index` rebuilt the index and the generated back-pointer on 0196 (its only diff);
`build-adr-index: OK (202 ADRs indexed, next free 0207)`.

**Gate, every rc read bare, never through a pipe.** `npm run lint` → **rc 0**, all 17 gates, eslint
at 0 errors / 0 warnings. Inside it: gate 11 `45 == 45`; gate 13
`check-docs-registers: OK (… 451 md files scanned for retired citations)` + `build-features-index:
OK (24 hubs; index in sync)`; gate 15 `budget-anchor gate: OK — …authorization-and-audit.md:168
ceiling=759`; gate 16 `OK — 16 seam file(s) + README.md, all routed, preamble identical, 1066 KB
total, largest authorization-and-audit.md at 120.3 KB (warn 160 KB / cap 200 KB)` with **no `[D]`
line** and `12 domain seam(s)`. `npm run typecheck` → **rc 0**. `git diff --stat main -- supabase/
migrations src` → **no output**, rc 0. ⛔ **`test:db` and `e2e:prod` are NOT owed and were NOT run**:
this unit adds no migration, no RLS, no `src/` change and no UI — the empty pathspec diff above is
that claim's evidence. Nothing was run against the remote; no `supabase db reset` was issued.

**Dead ends / things not done.** (i) The block for the new file was first drafted with a Rollout
bullet naming *"AE1.3 HAS LANDED"*; dropped the verb — check H's `DEPLOY_VERDICT` regex catches
`\bPUSHED\b` and the neighbouring shape is exactly the deployment claim README rule 8 bans, so the
bullet was rewritten to describe the flagless PATTERN instead. (ii) `sed -i` was not used anywhere;
the two whole-file rewrites went through `head`/`tail`/`cat` with the diff as the check, and every
targeted change through the Edit tool. (iii) The follow-up is **not closed here** — the lead closes
it at the Record step after QA; a `**Landed (pending QA)**` line naming the branch and the unit was
added to its body, with the sha left for the lead (a commit cannot cite its own sha).
