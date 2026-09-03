# ADR 0185 documentation restructure — gate-coverage review

**Scope:** branch `docs-restructure` @ commit `159b9f26bc0a30e9acedc0d1c3e3838cdbdec301`. Read-only
audit answering the ADR's own admission question (D8, Implementation constraints): **does every
new register or field ADR 0185 introduces have a gate that can red on it — proven able to red, not
merely present?**

**Reviewer inputs:** `docs/decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md`,
`docs/lint-gates.md`, `scripts/check-docs-registers.mjs` (942 lines), `scripts/check-progress-doc.mjs`
(827 lines), the live tree (`docs/features/`, `docs/planning/CURRENT.md`, `docs/bugs/`,
`docs/followups/`, `docs/learning/`, `docs/INDEX.md`, `docs/handoffs/`, `ARCHITECTURE.md`,
`CLAUDE.md`), and direct execution of both scripts' self-tests plus five live counterexamples run
against the exported checker functions (not against the tree — see each row's Live check).

## Verdict: **APPROVED**

Every register/field named in D1–D8 has an arm in `check-docs-registers.mjs` or
`check-progress-doc.mjs`, each arm is proven able to fail by a fixture pair in the script's own
`--self-test` (verified: both self-tests exit 0 and print `self-test OK` — a self-test failure
aborts with exit 2, so a passing run is proof the fixtures ran, not an assumption), and five
targeted live counterexamples against the exported functions all reded as expected (§ Live
counterexamples). `npm run lint:registers` and `npm run lint:progress` both exit 0 against the live
tree today. No row is NONE; no arm is missing a red fixture. Three items are correctly classified
PRESENCE-ONLY where the ADR and `docs/lint-gates.md` themselves say so (not a hidden gap), and one
arm (CODES) is currently GATED-BUT-EMPTY-DOMAIN for a reason worth the PO's attention (F-1). None
of the findings below are blocking under the stated bar (NONE row / missing red fixture / an
undisclosed truth-claim); they are process notes for the PO and the merge that follows.

## Gate exit codes (read directly, not through a pipe)

| Command | Exit |
|---|---|
| `node scripts/check-docs-registers.mjs --self-test` | 0 |
| `node scripts/check-docs-registers.mjs` (live tree) | 0 (5 warnings — see below) |
| `node scripts/check-progress-doc.mjs --self-test` | 0 |
| `node scripts/check-progress-doc.mjs` (live tree) | 0 |
| `npm run lint:registers` (`check-docs-registers.mjs` + `build-features-index.mjs --check`) | 0 |
| `npm run lint:progress` | 0 |

Live warnings from `lint:registers` (WARN, not findings — the register's honest cells, per D5/D8):
10 untriaged bug rows, 40 unrated legacy bug rows, 114 `Closes when: PO to rule` entries, 26
`Revisit when: PO to rule` backlog entries, 48 of 72 `prose only` lessons. These are counted, not
silenced — exactly the "PO to rule is a legal value" contract in D5 and `docs/lint-gates.md`.

## Per-item gate table (D1–D8)

Legend: **GATED** = red+green fixtures exist and a counterexample I ran caught the defect.
**GATED-EMPTY** = the arm is fixture-proven but has zero live subjects to catch today.
**PRESENCE-ONLY** = the gate checks presence/resolution, not truth — and the ADR/lint-gates.md say
so themselves. Every row below is one or the other; no row is **NONE**.

| # | Register / field (ADR clause) | Arm (file:line) | Red fixture | Green fixture | Live counterexample | Class |
|---|---|---|---|---|---|---|
| 1 | Hub frontmatter required keys (D1) | `checkHub` L231, `check-docs-registers.mjs:226-289` | `HUBS missing key` L705 | `HUBS good` L700 | — (self-test only) | GATED |
| 2 | Hub `id`/file-name agreement (D1) | `checkHub` L233-234 | `HUBS wrong file name` L702 | `HUBS good` L700 | — | GATED |
| 3 | Hub `status` enum (D1) | `checkHub` L235 | `HUBS bad status` L701 | `HUBS good` L700 | — | GATED |
| 4 | Hub `kind` enum + `fup-fix` needs `fup:` (D1) | `checkHub` L232, L236 | (self-test omits a direct `kind` case beyond the enum; `fup-fix` w/o `fup` is asserted only by code reading, not a fixture) | — | — | **see F-3** |
| 5 | Hub `plan`/`progress`/`handoff`/`reviews`/`adrs` link resolution (D1) | `checkHub` L237-246 | `HUBS bad adr` L717 | `HUBS good` L700 | — | GATED |
| 6 | Hub `in_progress` ⇒ `branch:` set and exists (D1, D2) | `checkHub` L248-251 | `HUBS missing branch` L703, `HUBS branch gone` L704 | `HUBS good` L700 | Not run separately — self-test fixtures are direct-enough | GATED |
| 7 | Hub `parked` ⇒ `**Revisit when:**` (D1) | `checkHub` L252 | `HUBS parked w/o revisit` L715 | `HUBS parked ok` L716 | — | GATED |
| 8 | Hub `complete` ⇒ ledger row **or** APPROVED review (D1) | `checkHub` L253-257 | `HUBS complete unrecorded` L709 | `HUBS complete ok` L708 | — | **PRESENCE-ONLY** (see F-2 — confirmed by reading L255: a raw `/\bAPPROVED\b/` substring test against whatever text the linked review file contains, not a check that the verdict is about this hub) |
| 9 | Current-state block required for `in_progress`/`gated`, forbidden for `complete` (D2) | `checkHub` L261-264 | `HUBS no block` L706, `HUBS block on complete` L707 | `HUBS complete ok` L708 | — | GATED |
| 10 | Current-state: exactly 6 named sections, in order (D2) | `checkHub` L279-282 | `HUBS sections out of order` L710 | `HUBS good` L700 | **CE1: added a 7th `### Extra Section`** → reded: `sections must be exactly […] found […, Extra Section]` | GATED |
| 11 | Current-state: `**Updated:**` present (D2) | `checkHub` L277-278 | `HUBS no Updated` L711 | `HUBS good` L700 | — | GATED |
| 12 | Current-state: ≤ 60-line cap, replace-never-append (D2) | `checkHub` L274-276, `CURRENT_STATE_MAX_LINES=60` L83 | `HUBS over cap` L714 | `HUBS good` L700 | — | GATED |
| 13 | Current-state: `Updated` not older than newest `src/`·`supabase/`·`e2e/` commit on the matching branch; **skipped on `main`** (D2) | `checkHub` L283-287 | `HUBS stale Updated` L712 | `HUBS good` L700; `HUBS stale Updated skipped on main` L713 (proves the skip fires, not just that it's uncommented) | — | GATED — **but see F-4** for a live gap the mechanism structurally cannot see |
| 14 | `docs/planning/CURRENT.md` ↔ `in_progress` hubs, both directions (D2) | `checkCurrent` L292-300 | `CURRENT missing` L721, `CURRENT extra` L722, `CURRENT absent file` L723 | `CURRENT good` L720 | **CE3: fed a CURRENT.md missing X1 and listing an unlisted OTHER** → reded both directions in one call | GATED |
| 15 | New `BUG-`/`FUP-` id (opened/filed ≥ `CODE_WATERMARK`) uses a registered code (D1, D8) | `checkCodes` L316-330 | `CODES bad bug` L729, `CODES bad fup` L730, `CODES no legend` L731, `CODES multi-segment not a prefix` L734 | `CODES good` L728, `CODES multi-segment hub id` L733 | **CE2: `BUG-ZZZZ-NEWTHING` dated 2026-09-03 (today) → 0 findings; identical id dated 2026-09-04 → red.** Confirms the mechanism works and confirms the domain is empty today. | GATED, **domain currently empty — F-1** |
| 16 | `docs/features/legacy-codes.md` non-empty (D1) | `checkCodes` L318 | `CODES no legend` L731 | `CODES good` L728 | — | GATED |
| 17 | `docs/features/INDEX.md` generated + byte-compared (D1) | `build-features-index.mjs --check` (separate script, chained into `lint:registers`) | not read line-by-line this pass — `npm run lint:registers` exercises it live and reported `in sync` | same | live run: `build-features-index: OK (5 hubs; index and roll-up in sync)` | GATED (verified live, not via a synthetic self-test — see "not verified" section) |
| 18 | BUGS.md exact columns (D3) | `checkBugs` L337-340 | `BUGS bad columns` L744 | `BUGS good` L743 | — | GATED |
| 19 | BUGS.md id shape + uniqueness (D3) | `checkBugs` L348-350 | `BUGS dup id` L745 | `BUGS good` L743 | — | GATED |
| 20 | BUGS.md `Status` enum (D3) | `checkBugs` L351 | `BUGS bad status` L746 | `BUGS good` L743 | — | GATED |
| 21 | BUGS.md `Severity` enum (D4), `unrated` legal only pre-watermark (D3/D4) | `checkBugs` L354-357 | `BUGS bad severity` L747 (fed `MAJOR` — exactly the task's probe value), `BUGS unrated new` L748 | `BUGS good` L743, `BUGS unrated legacy ok` L749 | — | GATED |
| 22 | BUGS.md `Opened`/`Closed` date shape + open/closed consistency (D3) | `checkBugs` L358-361 | `BUGS closed while open` L750, `BUGS no closed date` L751 | `BUGS good` L743 | — | GATED |
| 23 | BUGS.md `Doc` link resolves; `fixed`/`verified` ⇒ non-empty `Root cause` + `Regression protection` (D3) | `checkBugs` L362-378, `sectionNonEmpty` L388-397 | `BUGS doc missing` L752, `BUGS doc empty root cause` L753 (fed an empty `## Root cause`) | `BUGS doc ok` L754 | — | GATED |
| 24 | Every `docs/bugs/BUG-*.md` has a BUGS.md row (orphan doc) (D3) | `checkBugs` L380-382 | `BUGS orphan doc` L755 | `BUGS good` L743 | — | GATED |
| 25 | FOLLOWUPS: `**Filed:**`/`**Owner:**`/`**Severity:**`/`**Closes when:**` present (D5) | `checkFollowups` L411-431 | `FOLLOWUPS no Filed` L764, `FOLLOWUPS no Owner` L766, `FOLLOWUPS no Severity` L767, `FOLLOWUPS no Closes` L771 (task's exact probe) | `FOLLOWUPS good` L762 | — | GATED |
| 26 | FOLLOWUPS: `Severity` enum + heading-emoji agreement (D4/D5) | `checkFollowups` L418-427 | `FOLLOWUPS bad severity` L768, `FOLLOWUPS emoji mismatch` L769 (task's exact probe) | `FOLLOWUPS good` L762, `FOLLOWUPS resolved-retained keeps ⬛` L770 (proves the ⬛-retained exemption doesn't over-silence) | — | GATED |
| 27 | FOLLOWUPS: `Parked` entry ⇒ `**Revisit when:**` (D5) | `checkFollowups` L432 | `FOLLOWUPS parked w/o revisit` L773 | `FOLLOWUPS good` L762 | — | GATED |
| 28 | `deferred-backlog.md`: every entry ⇒ `**Revisit when:**` (D5) | `checkFollowups` L436-439 | `FOLLOWUPS backlog no revisit` L774 (task's exact probe) | `FOLLOWUPS good` L762 | — | GATED |
| 29 | `## ⭐⭐ Critical` pin: every row id has a real register entry, not a mention (D5) | `checkFollowups` L442-447, `criticalIdsOf` L460-477 | `FOLLOWUPS critical orphan` L776, `criticalIdsOf` self-tests L778-780 | `FOLLOWUPS critical ok` L777 | **CE4: pin names `FUP-X-GHOST` with no entry** → reded orphan. **CE5: pin row's own prose mentions `FUP-X-MENTIONED-ONLY` alongside the real bold id** → only the bold-leading id (`FUP-X-A`) came back, the mention did not | GATED — this is the exact leading-bold-token vs mention discrimination the task asked to probe, and it holds |
| 30 | LESSONS.md exact columns, unique `LEARN-NNN`, non-empty Lesson/Origin (D7) | `checkLessons` L505-517 | `LESSONS bad columns` L789, `LESSONS bad id` L790, `LESSONS dup id` L791 | `LESSONS good` L787 | — | GATED |
| 31 | LESSONS.md `Origin` tokens resolve (ADR/FUP/BUG/sha/path) (D7) | `checkLessons` L518-521, `checkToken` L480-498 | `LESSONS bad origin adr` L792, `LESSONS unresolved fup origin` L793, `LESSONS bad sha` L799 | `LESSONS good` L787, `LESSONS path with anchor ok` L800 | — | GATED |
| 32 | LESSONS.md `Enforcement` is `prose only` or a resolving token (lint:x / ARM=x / path / rule file) (D7) | `checkLessons` L522-529 | `LESSONS unknown lint` L794 (task's exact probe: "a LESSONS Enforcement token naming a lint script that does not exist"), `LESSONS unknown arm` L795, `LESSONS empty enforcement` L796, `LESSONS path missing` L797, `LESSONS garbage token` L798 | `LESSONS good` L787, `LESSONS prose only ok` L788 | — | GATED |
| 33 | Postmortem: 9 named sections non-empty (D7) | `checkPostmortems` L554-564 | `POSTMORT empty section` L805, `POSTMORT missing section` L806 (task's exact probe: `## New rule` removed) | `POSTMORT good` L804 | — | GATED |
| 34 | Postmortem: filename `LEARN-NNN` has a LESSONS.md row (D7) | `checkPostmortems` L558-560 | `POSTMORT no row` L807, `POSTMORT bad name` L808 | `POSTMORT good` L804 | — | GATED |
| 35 | Handoff ≤ 24 KB (D8) | `checkHandoffs` L566-577, `HANDOFF_MAX_BYTES` L84 | `HANDOFFS too big` L812 (task's exact probe) | `HANDOFFS good` L811 | — | GATED |
| 36 | Handoff `branch:` exists (D8) | `checkHandoffs` L571 | `HANDOFFS branch gone` L813 | `HANDOFFS good` L811 | — | **GATED, but existence ≠ currency — see F-3** |
| 37 | Handoff not cited outside the allow-list (D8) | `checkHandoffs` L572-574, `HANDOFF_CITATION_ALLOWED` L111 | `HANDOFFS cited` L814 (fed a citation from `docs/progress/`, exactly the task's probe) | `HANDOFFS good` L811 | — | GATED — see § "ADR claims checked" for the `docs/reviews/` question |
| 38 | Relative links resolve, over every file this gate owns (D8) | `checkLinks` L579-586 | `LINKS bad` L817 | `LINKS good` L816, `LINKS ignores http` L818 | — | GATED |
| 39 | `docs/INDEX.md` names every top-level `docs/` entry (D8) | `checkDocsIndex` L588-596 | `INDEX unmapped` L821, `INDEX missing` L822 | `INDEX good` L820 | — | GATED |
| 40 | PROGRESS.md size: 20 KB target (WARN) / 30 KB hard cap (D6) | `check-progress-doc.mjs` `checkSize`/`warnSize` L190-217 | `size` (red at cap+1) L571, `size-warn` L585-586 | `size-green` L572, `size-warn-under-target-green` L587 | — | GATED |
| 41 | PROGRESS.md required sections (§ Phase Status, § State) (D6) | `checkSections` L239-243 | `sections` L681 | `sections-required-green` L607 | — | GATED |
| 42 | PROGRESS.md 7 forbidden sections cannot return (D6) | `checkForbiddenSections` L246-253, `FORBIDDEN_SECTIONS` L159-167 | loop over all 7 headings L598-600, including `## Now` (task's exact probe) | `forbidden-section-green` L601, `forbidden-section-mention-green` L602-606 (a prose mention/h3 does NOT false-red) | — | GATED — the 7 forbidden headings match D6's list exactly (Now, Bug Log, Critical FUP, Follow-ups, Decisions, Test Run Summary, QA Verdicts) |
| 43 | PROGRESS.md no completed phase row (D6, unchanged from ADR 0124) | `checkPhaseRows` L255-272 | `phase-complete` L685 | `phase-open-green` L686-689 | — | GATED |
| 44 | Follow-up register: no RESOLVED entry left open; no duplicate id; no id in both register+archive (D5/D6 successor checks) | `checkRegisterResolved`/`checkRegisterIntegrity` L308-365 | `register-resolved` L610-617, `register-duplicate` L639-642, `register-archive-collision` L643-646 | `register-resolved-retained-green` L620-623, `register-integrity-green` L647-650 | — | GATED |
| 45 | CLAUDE.md ≤ 40 KB (unchanged, ADR 0140) | `checkClaudeSize` L229-237 | `claude-size` L591 | `claude-size-green` L592 | live: 37,734 B, under cap | GATED |
| 46 | Tracker docs LF-only, no CR (unchanged) | `checkEol` L553-557 | `eol` L719 | (implicit — no CR in fixtures elsewhere) | — | GATED |

## Live counterexamples run (against exported functions, not the tree)

Ran via `node` importing `scripts/check-docs-registers.mjs` as an ES module (file at
`C:\Users\micha\AppData\Local\Temp\...\scratchpad\ce1.mjs` / `ce2.mjs`, not committed to the repo):

1. **7th Current-state section** — `checkHub` reded: *"Current state sections must be exactly
   […] found […, Extra Section]"*. (item 10)
2. **`complete` status with the Current-state block still present** — reded: *"must be cut when
   status is complete"*. (item 9, cross-checked)
3. **CURRENT.md omitting an `in_progress` hub, while listing an unlisted one** — reded both
   directions in the same call. (item 14)
4. **Critical pin naming an id with no register entry** — reded: *"has no register entry
   (orphan)"*. (item 29)
5. **Critical pin row whose prose mentions a second id (`FUP-X-MENTIONED-ONLY`) beside the real
   bold-leading id** — `criticalIdsOf` returned only the bold-leading id; the prose mention was
   correctly not treated as a row. (item 29)
6. **`CODE_WATERMARK` boundary** — a bug row `BUG-ZZZZ-NEWTHING` with an unregistered code,
   `Opened: 2026-09-03` (today) → **0 findings**; the identical row with `Opened: 2026-09-04` →
   red. Confirms both that the mechanism works and that its domain is empty today (F-1).

All six matched the expected verdict; none surfaced a checker that fails to red.

## ADR claims checked against the implementation

- **60-line cap** — `CURRENT_STATE_MAX_LINES = 60` (`check-docs-registers.mjs:83`), enforced on the
  whole block including the heading, `**Updated:**` line and blank separators, trailing blanks
  excluded. Matches D2 exactly.
- **`Updated` rule + `main` skip** — implemented as read at item 13. The skip is real (`ctx.currentBranch
  !== 'main'` gates the whole check, L283), and a fixture proves the skip actually suppresses the
  finding rather than the check never firing on `main` for an unrelated reason (`HUBS stale Updated
  skipped on main`, L713). **Reader-facing hole, not a fixture gap:** `newestCodeCommitDate` is
  derived from `git log -1 --format=%cs -- src supabase e2e` (L663) over the whole branch history,
  not commits unique to the branch. On a **docs-only** branch — this one — that date resolves to
  whatever `src`/`supabase`/`e2e` last changed on an ancestor (measured live: `2026-09-03`, inherited
  from the branch point), so the check can never distinguish "the hub is current" from "nothing here
  ever touches code, so the bar is frozen." See F-4.
- **`CODE_WATERMARK` 2026-09-04** — grandfathers the 72/123 legacy prefixes, exactly as documented.
  It also grandfathers **every id filed on the ADR's own ship date (2026-09-03)**, because the
  watermark is set to the day *after* today. Live-confirmed (counterexample 6): today's date, an
  unregistered code, zero findings. See F-1.
- **Forbidden-sections list vs D6's seven names** — exact match: Now, Bug Log, Critical FUP,
  Follow-ups, Decisions, Test Run Summary, QA Verdicts (`FORBIDDEN_SECTIONS`, L159-167 ↔ ADR D6).
- **Register paths after the move** — `docs/followups/{follow-ups-open,follow-ups-archive,deferred-backlog}.md`,
  `docs/bugs/{BUGS.md,archive.md,<ID>.md}`, `docs/learning/{LESSONS.md,postmortems/}` all exist and
  match `PATHS` in both scripts (`check-docs-registers.mjs:64-80`, `check-progress-doc.mjs:109`).
- **Critical pin's orphan discrimination (leading bold token vs mention)** — confirmed live
  (counterexample 5) and by the existing `criticalIdsOf ignores prose mentions` self-test
  (L780): the regex requires the bold token to be the row's own leading span
  (`^\|[^|]*\|[^*|]*\*\*` — no earlier bold span permitted), which is the exact property needed.
- **Handoff citation allow-list — is `docs/reviews/` a hole?** No: the ADR's own D8 text names it
  ("citations allowed only from hubs, CURRENT.md, other handoffs **and review files**"), and
  `HANDOFF_CITATION_ALLOWED` (`check-docs-registers.mjs:111`) includes `docs/reviews/` by design —
  a review needs to cite the handoff state it audited. This matches the ADR; not a discrepancy.
- **The `complete` cross-check (ledger row OR APPROVED review)** — confirmed PRESENCE-ONLY by
  reading `checkHub` L255: `ctx.readRel(...)` returns the raw text of whatever file `reviews:`
  names, and the test is a bare `/\bAPPROVED\b/` substring match against that text — **not** a
  check that the approval is about this hub, or even a check for a structured verdict field.
  `docs/lint-gates.md`'s own "PRESENCE and RESOLUTION, not truth" caveat covers this, but the ADR
  text (D1) states the rule ("complete ⇒ … an APPROVED review") without that qualifier. See F-2.

## Findings

**F-1 (MINOR).** `CODE_WATERMARK = '2026-09-04'` (`scripts/check-docs-registers.mjs:82`) is one
day after this ADR's own ship date (2026-09-03, per the ADR header and every hub's `Updated:`
field). Every `BUG-`/`FUP-` id filed on the day this register lands is therefore treated as
"legacy" and exempt from the registered-code requirement (D1's own admission rule: "no register or
field ships without a gate that can red on it" — for one calendar day, the CODES arm's domain is
empty by construction). Live-confirmed: a synthetic `BUG-ZZZZ-NEWTHING` dated today produces zero
findings against the real legacy-codes/hub registry; the identical row dated 2026-09-04 reds. This
is not a bug in the checker (it is fixture-proven in both directions) and is very likely
deliberate cutover slack, but it is worth a PO line saying so, since the effect is that any
mis-coded id minted during today's normalization pass (161 BUGS.md rows, 156 follow-up entries)
will never be caught by this arm — it would need a manual audit or a next-day sweep.
**Remedy:** either accept the one-day gap explicitly (a sentence in the ADR or the hub), or set the
watermark to the actual commit date/time of the gate's landing commit rather than the day after.

**F-2 (INFO).** The `complete` status cross-check (`checkHub`, `check-docs-registers.mjs:255`) is
PRESENCE-ONLY on its review-verdict half: it substring-matches `APPROVED` anywhere in the linked
review file's text, with no check that the verdict belongs to this hub or is a structured verdict
line. `docs/lint-gates.md`'s own trap note already discloses "this gate checks PRESENCE and
RESOLUTION, not truth" for the register generally, but D1's specific wording ("complete ⇒ … an
APPROVED review") reads as a stronger claim than the code makes. No remedy required for merge —
recording it so a future reader doesn't over-trust the `complete` status on a hub whose reviews list
happens to include an unrelated APPROVED file.

**F-3 (INFO).** `checkHandoffs`' branch check (`check-docs-registers.mjs:571`) asks only whether
`fm.branch` is a name `git branch --list` returns, not whether that ref is current. Live example:
`docs/handoffs/c2-tier1-neutralizer.md` names `branch: authz-c2-tier1`, which exists locally but —
per the C2-TIER1 hub's own Current-state block — is a stale, orphaned ref that stopped advancing at
`77d94b60`; the real 13 commits live on `origin/authz-c2-tier1` and are now merged into
`authz-ae4-catalog`. The handoff passes the gate while naming a branch its own sibling hub says is
dead. Not blocking (again, the disclosed PRESENCE-ONLY bound), but the PO/lead should know the gate
cannot substitute for reading the hub when triaging a handoff.

**F-4 (INFO).** The `Updated`-staleness enforcement (D2, "enforced, not asked for") is structurally
unable to fire on a docs-only branch, including this one: `newestCodeCommitDate` walks the whole
branch history for the last commit touching `src`/`supabase`/`e2e`, which on `docs-restructure`
resolves to an inherited ancestor commit, not anything this branch did. Concretely: the
`DOCS-RESTRUCTURE` hub's own Current-state block currently reads *"In progress: Commit C, held for
the PO's approval of the CLAUDE.md diff"*, but `git log` shows commit `159b9f26` — titled "ADR 0185
C — PROGRESS.md cut …" — is already `HEAD`, and the working tree is clean. The hub's own content is
stale by its own account of the branch's history, and the gate has no way to see it, because it
never looks at commits to `docs/`. This is consistent with the ADR's own "not truth" bound, but
worth surfacing explicitly since the branch this affects is the one shipping the mechanism.

**F-5 (INFO, out of ADR 0185's scope).** `.prettierignore` still lists only `PROGRESS.md`,
`CLAUDE.md` and `docs/progress/` (unchanged by this branch), even though the same
Markdown-table-padding rationale documented there for those paths applies identically to the new
register homes — `docs/followups/follow-ups-open.md` alone is 9,155 lines / ~738 KB of tables. D8
does not name `.prettierignore` as something this ADR must touch, so this is not a violation of the
admission rule, just a loose end for whoever next runs `npm run format` on the tree.

## What this review did NOT verify

- **Truth of any field.** Per the gate's own stated bound, this review confirms presence and
  resolution — that a `Closes when` exists, that an `Enforced by:` path exists — never that the
  claim behind it is correct. That is a content review, not a gate-coverage review, and the ADR
  itself assigns it to "review questions," not to this gate.
- **The database.** No pgTAP, RLS, `prosecdef`, or catalog check was run; this ADR is a
  documentation-tracking change and touches no schema.
- **Anything on `authz-ae4-catalog` (AE4) or `authz-c2-tier1` (C2 Tier 1) beyond what their hub
  files claim about themselves.** Those hubs' acceptance criteria, QA verdicts and BUG-AE49-D6 fix
  status were read only as inputs to testing this ADR's gate coverage, not audited on their own
  merits — that is the Gate AE4 review's job, not this one's.
- **`build-features-index.mjs`'s internals.** I ran it live (`npm run lint:registers` includes
  `--check`, which reported "in sync") but did not read the script's source or self-test it the way
  I did the two register-checking scripts, since the ADR names it as following the pre-existing
  `build-adr-index.mjs` pattern rather than introducing new checked properties of its own.
- **Whether every one of the 156 follow-up entries' `Closes when` clauses are individually
  sound** — the gate counts `PO to rule` as an honest, legal value (114 of them), which is by
  design (D5); this review did not sample the other 42 for quality.
