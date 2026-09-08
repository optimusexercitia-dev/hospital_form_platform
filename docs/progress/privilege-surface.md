# PRIVILEGE-SURFACE — progress record

Privilege surface: pre-AE5 remediation **Batch 7**. The unit's **summary** is its hub,
[docs/features/privilege-surface.md](../features/privilege-surface.md) § Current state; this file is
its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `docs/backend-state.md` § Privilege budget (`CEILING: 752`, the merge rule, and the
`RE-MEASURED … 759` block), `docs/design/authz-ae1-revoke-partition.md` (the 233-revoke partition
RV0 produced and executed none of), `supabase/config.toml:13` (the one line that bounds the `app`
PUBLIC floor), and — if the PO rules for execution — `supabase/migrations/` plus every authz arm
whose domain a revoke moves. Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the door-audit sweep is a
standing gate; a revoke that evicts a function from an arm's domain is sweep blindness),
[0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md) Amdt 6 (where the `app` PUBLIC floor was found, while
deriving an ACL **by property**), [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9 +
[0160](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md) D3 (the budget's origin and the 843 → 856
correction), [0182](../decisions/0182-statement-scoped-authorized-scope-ids.md) (the **one** of the
seven that carries a named justification),
[0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(the widened `PRED_DOMAIN` that is the stated prerequisite for any revoke), and
[0192](../decisions/0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md)
(**ownership is a proxy, not the property** — the shape a privilege audit is most likely to repeat).

## Session log

### 2026-09-08 — unit opened (lead)

**Tree measured before anything was assumed** (plan §6 step 1, whose parenthetical says to re-run it
because a clean push state is an instant, not a lease):

- `git status --porcelain | wc -l` → **0**
- `git rev-list --count origin/main..main` → **27** (unchanged from Batch 6's close note)
- `docs/features/INDEX.md` → 13 hubs, **in progress 0**
- `git branch --list` → `main` only; `git ls-remote --heads origin` → `authz-c2-tier1`,
  `authz-enforcement-manifest`, `main` — **no Batch 7 branch on either side**, so plan §6 step 3's
  `initiate` is the correct verb, not `resume`. ⚠ Both facts are about this clone and about
  `origin`; neither is evidence about a second machine's clone
  (*an-inference-about-what-you-cannot-measure*), and Batch 4 is the precedent for that mattering.

**The three follow-ups were read in their bodies, not the register.** This is not ceremony: the
register's index entry for `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN` **truncates its own
`Closes when` mid-sentence** — it ends `…converts …` — so the register text is a summary of the
clause, and the batch protocol requires closing on the clause itself.

**⭐ A finding at unit open, before any build: the follow-up's named heads are already stale.** The
`Closes when` clause says to diff the `authenticated`-executable DEFINER set between head
`…005300` and head `…007330`. The live migration head is **`20261003007350`** — Batch 4 landed
`…007340` (`ae49_d6_rekey_remaining_forms_edit_sites`) and `…007350`
(`batch4_rekey_set_item_validations`) after the 759 was measured. Diffing only the clause's pair
would satisfy the clause *and* leave any delta those two migrations introduced unattributed and
invisible: the number put to the PO would be a five-day-old aggregate presented as the current one.
Recorded as a **three-head** run in the hub's acceptance criteria — the clause's own pair is
reproduced (so the finding is shown to reproduce, not merely re-asserted) and the current head is
what the PO is asked to rule against. ⛔ This is *a-partial-fix-reads-as-a-complete-one*: the
direction of the clause is right; its magnitude went stale between filing and execution.

**Why the two PO questions are asked at different times** (protocol §4 step 2 — before the build
where they change scope, after where they need a measurement):

- **Before**: does Batch 7 *execute* revokes at all? This decides whether the unit carries a
  migration, and therefore whether it owes a diff-scoped door sweep over **both arms** rather than
  the empty-diff assertion every docs-and-scripts batch has made. It is answerable without any
  re-derivation.
- **After**: the ceiling's disposition (move it by ruling to the justified number, or revoke the
  unjustified grants) and the `app` PUBLIC floor's three-part decision. Both need numbers that do
  not exist yet, and the AE1 body **forbids** reusing the ones on file.

**Unit opened:** hub `docs/features/privilege-surface.md` (status `in_progress`), this record,
`npm run features:index`, gates 7 + 13, commit, branch `authz-privilege-surface` off `main` at
`412fa4d7`.

### 2026-09-08 — lead, PO rulings R1/R2 taken, and a "grep for X before building X" sweep that moved the design

**Two PO rulings, before the build, because they decide whether this unit carries a migration**
(protocol §4 step 2 — scope questions go first, measurement-dependent ones after). Both recorded in
the unit's rulings file with the option text the PO selected reproduced verbatim, so the ruling is
never re-derived from memory:

- **R1 — revoke execution DEFERRED.** `FUP-AE1-REVOKE-SET-EXECUTION` closes on `PO to rule`; the
  ruling is *rule and defer*. ⇒ **no migration and no ACL change in this unit.** Precedent that a
  defer closes a `PO to rule` clause: Batch 0's `FUP-AUTHZ-HARNESS-TRANSACTIONAL` (detect-only,
  marker **not built by decision**, re-open condition written down). ⇒ This closure owes the same
  shape — **a re-open condition**, not a bare "deferred".
- **R2 — the `app` PUBLIC floor keeps its config bound; the config LINE gets gated.** ⇒ item 1 of
  that follow-up's body is ruled **NO**, which makes its item 2 pgTAP gate **out of scope by ruling**
  rather than skipped work — written down so a later reader does not read it as unfinished.

**⭐ The sweep found an INCUMBENT, which is the substantive result of the session.**
`supabase/tests/320_act_expiry_and_acl_hardening.sql` §U1 **already** pins a privilege population to
a committed number with a merge rule — `is(count(app functions with proacl null or a PUBLIC grant),
236)`, described in-file as *"the schema-wide ratchet"*, with §U2/U2b as its detector-moves control
(236 → 237 on a planted grant, back on drop) and §U3 as the over-revoke twin. Different population
from the budget (`app` × PUBLIC/default-ACL vs `app`+`public` × `authenticated` × `prosecdef`),
**same shape, same ratchet semantics**. ⇒ Building the budget gate naively would put **two ratchets
over overlapping catalog surface, with two merge rules, in two homes**. Ruled R8: argue the boundary
or extend `320`; never silently build the second.

**⭐⭐ And `320` §U1's severity argument already rests on `config.toml:13`** — its own comment block
says the config *"exposes ONLY the `public` schema, so an `app` function with PUBLIC EXECUTE is not
PostgREST-reachable. This is defence-in-depth."* Nothing in the tree notices if that line changes:
the only two files that read `config.toml` match `project_id` only. ⇒ R2's gate does not merely
document a posture — **it protects the premise of a live pgTAP assertion.** Recorded as R9.

**Two constraints that bound the gate's design, both verified against the file rather than taken
from the sweep's summary** (*a-paraphrase-can-invert-the-sentence-it-summarizes*):

- `ARM=census` carries a standing prohibition — *"⚠ DERIVED, NEVER FROZEN … A number a banner states
  about a population NOTHING re-derives is a claim with no owner, and this arm exists to stop exactly
  that shape"* — filed after a literal `(407 reachable)` drifted to 427 **while printing beside four
  green arms**. The lead's reading (R10, and the plan may refute it): a gate that re-derives every
  run and compares to a committed *threshold* is a different object — but **that defence collapses if
  the threshold gets two homes**, since `CEILING: 752` already lives in `docs/backend-state.md`
  prose. ⇒ the ceiling gets ONE home, named.
- ⚠ **The gate cannot buy what the follow-up's ⭐ asks for.** It asks for a `lint:*` step so *"the
  next commit noticed"*; the count needs a live catalog, so the honest home is pgTAP, which runs
  under `test:db` — **not in the `npm run lint` chain**. That buys *"the next Phase Gate noticed"*.
  Recorded as the ⭐ **amended by measurement** (R12), never as delivered-as-asked.

⚠ **A process fact worth recording because it shaped the artefact.** The sweep finished *after* the
plan turn was already briefed, and **SendMessage is disabled in this session**, so the running plan
could not be redirected. R8–R13 were therefore appended to the rulings file as a marked addendum
that says so. ⛔ The plan is incomplete on R8–R13 **by construction, not by oversight**, and its
silence on them must not be read as a judgement that they do not apply; it owes a revision pass.

### 2026-09-08 — backend, Track A: the three-head run, the attribution, and the full AE1 re-derivation

Plan steps 1–4. ⛔ No migration, no ACL change, no `src/` change (R1, R5), and **no budget figure
pinned anywhere** (R14) — the ceiling's disposition is the PO's and is not ruled yet.

**⭐ A METHOD FINDING that dissolved the approved mechanism.** The plan's option (a), approved under
R21, parked later migrations with `mv` and rested recovery on `git checkout -- supabase/migrations`
over a pathspec-clean index (R23). ⛔ **`supabase db reset --local --version <head>` exists** (CLI
v2.115.0, `--version string  Reset up to the specified version`) and reaches a head **without
touching the working tree at all**. Run that way instead: R21.1/R23 kept as a *witness* rather than
a recovery precondition, R21.3/R21.4/R21.5 kept in force, and **R21.2 (park dir empty before/after)
vacuous because there is no park dir**. ⚠ The flag's noun was **not** trusted — the CLI also has a
global `--version` meaning "print the version" — so C1 (head pair) and C3 (two object-level markers)
are what decided whether it truncated the schema or merely the registry.

**Six per-head checks, all four heads, all pass** (R21.5: a head failing any is discarded and
re-run; none was). C1 head **pair** `(max(version), count(*))` per R19 · C2 reset rc read bare ·
C3 two object markers (`app.current_professional_read_organizations` exists? · does
`public.set_item_validations`'s body contain `can_edit_commission_forms`?) — these discriminate all
three heads at the **object** level, which is what proves the schema truncated · C4 positive canary
`app.is_admin()` · C5 negative canary `public.submit_response(p_response_id uuid)` **with its
discrimination half** — it is in the superset as `prosecdef=0/auth_exec=1`, so its exclusion is the
`prosecdef` term's decision and not a dead instrument · C6 two instruments, one number (TSV-derived
count vs an independent psql count).

**Witnesses, bare exit codes.** `git status --porcelain -- supabase/migrations` **0 lines, rc 0**
before the first reset and again after the last (R23) — no migration file moved. Four
`supabase db reset` runs, **rc 0** each. Snapshot/check `psql` via `docker exec -i … < file`
(stdin, never `psql -f <hostpath>`), **rc 0** each. Re-derivation `psql` **rc 0**. Whole detached
run 15:04:54Z → 15:08:14Z.

| head | pair | DEFINER | budget | `app` | `public` | `proacl IS NULL` in budget |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| A `…005300` | 484 | 856 | **752** | 320 | 432 | 159 |
| B `…007330` | 522 | 880 | **759** | 326 | 433 | 159 |
| C `…007350` (`--no-seed`) | 524 | 880 | **759** | 326 | 433 | 159 |
| C′ `…007350` **canonical `supabase db reset --local`** | 524 | 880 | **759** | **326** | **433** | 159 |

A and B reproduce the 2026-08-27 and 2026-09-03 measurements **to the unit** — the reproduction is
what licenses pointing the instrument at new ground, and it is why the clause's own pair was run
and not only the current head. **C ≡ C′ on both the qualifying set and the whole superset**, so
seed mode is not a confound — *measured*, not argued from the fact that `seed.sql`'s one function
is `SECURITY INVOKER`.

**A→B = 7 ADDED, 0 REMOVED. B→C = 0 ADDED, 0 REMOVED.** All seven ADDED are **new functions**
(absent at A under *any* signature and *any* privilege state, so none is a re-key wearing a new
identity), all seven hold an **explicit** `authenticated=X/postgres` grant, and all seven are
attributed to a creating-and-granting migration: **zero `UNATTRIBUTED-BY-TEXT`**. The table is in
`docs/backend-state.md` § Privilege budget; #3 is the ADR 0182 one already named, so **the six
unattributed are now named**. ⇒ The follow-up's predicted mechanism (*"one convenient `grant execute
… to authenticated` at a time"*) is **confirmed**, not falsified.

⛔ **R20, in its own words: a zero count delta is not zero change.** The B→C **set** difference is
what says Batch 4 moved no member of the population — never the observation that 759 == 759.
`…007350` did rewrite `public.set_item_validations`'s body, and marker C3 proves it. An
identity-keyed set diff is structurally blind to a body rewrite under an unchanged signature, so
the honest claim is *"moved no member of the privilege population"*, not *"changed nothing"*.

**R17 — the full AE1 re-derivation, and the warning was right.** The partition at `…007350` is
**44 / 5 / 23 / 161 = 233**, identical to `…005300`, with all 233 still resolving (233 in / 233 out
/ 0 overloads / 0 unresolved). ⛔ But **all six arm predicates had moved**, not the two already
known, and the biggest mover was one nobody had flagged: the write-path arm's **static 33-entry
policy snapshot was replaced by a live-derived worklist of 107 write-capable policies** — 3× the
domain, and the only delta that could have admitted one of the 233 rather than being neutral by
schema. It admits **0 of 233** (CHECK F). *Sweeping one sibling axis reads as sweeping the class*:
had the re-read stopped at the two known-neutral deltas, this arm's rewrite would have gone
unexamined while the partition was published as re-derived.

**⭐ A correction the re-derivation produced: the silent-no-op count is 138, not 137.**
`proacl IS NULL` re-measures at **exactly 137**, so that figure reproduces — but the operational
question is *"for how many is the revoke a silent no-op?"*, and **`app.latest_published_version`**
has a non-NULL `proacl` carrying an **explicit** PUBLIC grant (`=X/postgres`). ⛔ *"`proacl IS NULL`
includes PUBLIC"* is true; its converse *"`NOT NULL` therefore excludes PUBLIC"* is **false**, and
keying the class on the ACL-text predicate instead of the effective one is what hid it.

**Controls, because a partition that reproduces is exactly what a dead instrument reports.** The
`…005300`-shape control was recomputed from raw catalog columns rather than reusing the
current-shape columns (reusing them would launder a predicate change into the control). It reports
**0 moved rows** — and that zero was then **proven able to be non-zero**: planting
`public.handle_new_user` into the current-shape `GUARD_KEYS` moved exactly 1 row, HOLD → PROCEED
(name-rescued), totals 23 → 22 / 5 → 6. CHECK F's detector likewise got a discrimination pair —
positive `is_staff_admin_of` 43, `can_edit_commission_forms` 6, `member_can` 3; negative
`handle_new_user` 0, `guard_submitted_response` 0.

**Dead ends, recorded because each cost a wrong belief for a while.**

- ⛔ `Start-Process` on **`Git\usr\bin\bash.exe`** started **nothing** — no output directory, no log,
  process gone, and *no error anywhere*. The launcher that works is **`Git\bin\bash.exe`**, which
  sets up the environment; `usr\bin\bash.exe` is the bare binary. R7 warns that the `-c` form
  silently starts nothing; **the wrong bash.exe fails the same silent way**, and the only reason it
  was caught is that the run's own first act is to create a directory that was then checked for.
- ⛔ `grep -P` is unusable in this Git Bash (*"-P supports only unibyte and UTF-8 locales"*) in every
  locale available, so two snapshot checks were rewritten in `awk`. A `grep -qP` that errors exits
  **2**, which an `if` reads as false — a check that can only ever fail.
- ⛔ **A `head` truncated the disconfirming line.** `grep -n "seed_select" supabase/seed.sql | head`
  showed the `create` and the call sites and hid **`supabase/seed.sql:2203 drop function if exists
  app.seed_select(...)`** — the very line that explains why the seeded reset has no such function.
  The conclusion drawn without it happened to be right; the reasoning was not. Same family as
  *a pipe erases the exit code*: a pipeline stage silently removing evidence.
- ⚠ A `grep -c $'\r'` probe reported **226 lines with CR** on a file `od`/`awk` both showed as pure
  LF. The probe, not the file, was wrong. A normalisation check that reports a problem which does
  not exist will send the next reader to fix the wrong thing.
- ⚠ **Five of the seven grants are two-line statements**, and the first attribution pass used a
  line-anchored `grep … authenticated` that found **none** of them — reported as five
  `UNATTRIBUTED-BY-TEXT` until a multiline search found all five. Had that stood, five real
  attributions would have been escalated as findings.
- ⚠ The first AE1-shape control **reused the current-shape columns**, which would have laundered
  every predicate change into the control and made "0 moved rows" vacuous by construction. Caught
  before it ran; replaced with a recomputation from raw columns.
- ⛔ **`b657aaf6`'s message is malformed and is NOT amended.** A PowerShell here-string (`@'…'@`)
  was passed to the **Bash** tool, where `@'` is an ordinary literal, so the subject carries a
  leading `@ ` and the body a trailing `@`. Per the standing rule *a subagent must never
  `git commit --amend`* — whose named remedy is *"a bad message gets a follow-up commit"* — it is
  corrected here rather than rewritten. ⭐ **The rule's mechanism was live, not hypothetical:**
  between this turn's `git status` and its `git commit`, the parallel track committed `6fee08ae`
  onto the same branch. `--amend` targets **HEAD**, not "my commit", and a few seconds' different
  timing would have retitled *their* commit with *this* message. The content of `b657aaf6` is
  exactly its three named doc files, +315/−0.

**Not done here, by scope:** §2 pgTAP (blocked on the PO ruling per R14 — ⛔ the pinned literal is
filled in from the ruling, never chosen by the builder), §3's config gate (another track), §5.
⛔ `CEILING: 752` is **unchanged** in `docs/backend-state.md`.

### 2026-09-08 — backend, Track B: the config-line gate (gate 14), its two failure texts, and two findings the build turned up

Scope: the plan §3 config gate plus two §2.7 items. ⛔ No DB command, no migration, no
`supabase/tests/`, no `docs/backend-state.md`, no `docs/design/` — Track A owned the stack and those
files for the whole window. **R5 re-asserted at this commit:** `git diff --name-only main... --
supabase/migrations supabase/seed.sql src` is **EMPTY**. ⚠ `supabase/config.toml` is deliberately
outside that pathspec, so touching it does not weaken the assertion (R5 says so in terms).

**Shipped** (`6fee08ae`): `scripts/check-supabase-config-schemas.mjs` (new gate) ·
`lint:config-schemas` **appended at the END** of `package.json`'s chain as **gate 14** — ⛔ never
inserted, because "gate N" is positional and cited by number across docs, records and reviews, and
an insertion silently renumbers all of them with nothing red · its bullet in `docs/lint-gates.md`
**in the same commit** (nothing gates that file) · the load-bearing block in `supabase/config.toml`
above the assignment · the annotation on `scripts/authz-tier1-threat-review-ae1.sql` · and
`FUP-AUTHZ-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST`.

**Every exit code observed, in order, each read bare or through a redirect (⛔ never a pipe):**

| # | run | rc | what it witnessed |
|---|---|---|---|
| 1 | `--self-test`, first build | **2** | ⭐ `G3-crlf DID NOT APPLY — fixture bytes identical to the baseline`. See finding F1 |
| 2 | `--self-test`, after the G3 pair guard | **0** | 10 bad caught each for its own reason, 4 good clean |
| 3 | planted checker M1 (B8 `[api.tls]` anchor broken) | **2** | `B8 MUTATION APPLIED WRONG — the schemas line must be MOVED, not deleted` |
| 4 | planted checker M2 (B6 comment-out neutered) | **2** | `B6 DID NOT APPLY` |
| 5 | planted checker M3 (B7 multi-line neutered) | **2** | `B7 MUTATION APPLIED WRONG — the array must actually open and not close on its line` |
| 6 | planted config `["public","graphql_public","app"]`, **first build** | **2** | ⛔ the wrong code. See finding F2 |
| 7 | same plant, after the fix | **1** | `⛔⛔ SECURITY EVENT — … "app" HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS` |
| 8 | planted config `[…,"authz"]` | **1** | `REVIEW EVENT — … the pinned [api].schemas list CHANGED VALUE` |
| 9 | real run, clean tree | **0** | prints the parsed list and its own bound |
| 10 | `npm run lint:registers` | **1** | `[CODES] … uses no registered code`. See finding F3 |
| 11 | `npm run lint:registers`, after the rename | **0** | ratchets all at or under cap; `longHeadings=95/97` |
| 12 | `npm run lint` | **0** | **all 14 gates reached** (see below) |

**Gates the full run actually REACHED**, quoted rather than assumed, because `&&` short-circuits and
a run that dies early proves nothing about later gates: `eslint` (silent, 0 findings) · `css-vars` ·
`memberships-door` · `client-server-imports` · `vacuous` · `set-local` · `progress` · `rules` ·
`adr-index` · `mojibake` · `service-role-registry` · `authz-vectors` · `registers` ·
**`config-schemas`** — 14 of 14, rc **0**. R22's correction holds: nothing reds at `lint:rules`.

**⭐ F1 — the CRLF hazard is LIVE on this exact file, not hypothetical.** `git ls-files --eol
supabase/config.toml` → **`i/lf w/crlf`**: the index is LF and the working tree the gate reads is
CRLF (451 CR bytes), while `.gitattributes` says `* text=auto eol=lf`, `git check-attr` agrees and
`git status` is clean. ⇒ The plan's fixture **G3 "the real file with CRLF endings" is byte-identical
to G1** and discriminates nothing — a good fixture that re-runs the control under a new name. It is
now run in **both** directions and the pair is proven against **itself** (they must differ from each
other and each carry the endings it claims), never against a baseline whose endings are an accident
of the checkout. ⛔ The byte-difference guard is the only reason this was visible at all. Same shape
as the Batch 6 lesson, on a new file, one week later.

**⭐⭐ F2 — the positive control contaminated its subject, and it hid the one red the gate exists
for.** Fixtures are mutations of the real file (structurally honest: real tables, real comments, real
endings, never a hand-written copy of production text). But plant `"app"` in the real file and the
fixtures inherit it: B1's mutation becomes a no-op, G1/G2/G3 are all "falsely caught", and the run
exits **2 — the checker is broken** instead of **1 — SECURITY EVENT**. Measured, not reasoned (row 6
above). R16 demands a reader know from one line *which* happened; they would have met a verdict about
the instrument instead. **Fix:** the fixture baseline is the real file **canonicalised** (pinned value
text and sentinel forced on), so the self-test asks *"can this checker fail, and pass?"* — about the
CHECKER — while the real scan asks *"is this file pinned?"* — about the FILE. When the file is clean
the two are byte-identical and G1 **is** the real file's bytes, as the plan asks; when it is not, the
output says so and the real scan reports the finding. ⛔ Conflating the two questions loses the second.

**F3 — the follow-up id in the brief fails gate 13, so it was renamed.**
`FUP-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST` carries no registered code and
`[CODES]` reds on it (rc 1, row 10). Renamed to
**`FUP-AUTHZ-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST`** — `AUTHZ` is the
registered code for the program that owns the property, and the item outlives this unit. All five
citing sites were swept in the same edit (config block, gate header, `lint-gates.md`, the register
entry, the body file + its filename), each replacement verified as applied.

**Design decisions worth a later reader's time.** (a) The pinned artefact is the **value text**
`["public", "graphql_public"]`, character for character; indentation, spacing around `=`, a trailing
comment and line endings are all tolerated. That is the only rule under which the plan's whole §3.4
table is coherent — B2 "no spaces" must red while G2 "extra whitespace" must not — and it makes the
line, quoted verbatim in six documents, byte-stable. **Order is behaviour, not cosmetics**:
PostgREST's first schema is the default profile. (b) P4's sentinel is sought in the maximal run of
comment lines **immediately above** the assignment, not at line N−1 exactly, so the block's prose
stays editable while deleting the warning still reds. (c) ⚠ The block **displaces the assignment**:
`schemas` moved from line 13 to line **51**, so every `config.toml:13` citation in the tree now
points into the block instead of at the line. Mitigated by making the block's **banner** line 13, so
an old citation lands on the explanation — ⛔ but the citations themselves are **not** repointed:
three of them live in files this track does not own. *A cited line number rots when its artifact is
overwritten.*

**Two premise claims verified at their own sites before being cited** (⛔ never from a summary —
*a-paraphrase-can-invert-the-sentence-it-summarizes*): all six prose premises were read and quoted at
their own line; and R12's *"reportedly"* on the removed `rpc/member_can` probe was checked at
`e2e/orphan-administrativo-reachability.spec.ts:306-313` and is **more precise than the summary** —
the probe was wrapped in `if (rpc.ok())` around a permanent `PGRST202`, so *"the assertion inside
NEVER RAN"*. ⇒ The follow-up says a **vacuous** witness was correctly retired and nothing deliberate
replaced it, ⛔ never that a proof was deleted. R12's own claim that no npm script or harness invokes
`authz-tier1-threat-review-ae1.sql` was also re-verified (prose citations in seven documents only).

**⚠ Left uncommitted deliberately:** this record. At the time of `6fee08ae` it carried Track A's
in-flight entries, and committing another agent's file mid-edit is not this track's to do. Whoever
commits the record picks up this entry with theirs.

**Not done here, by scope:** the budget-anchor text check (plan §2.4 — mirrors literals out of a
pgTAP section that does not exist yet, blocked on R14), anything in `supabase/tests/`,
`docs/backend-state.md`, `docs/design/` or `supabase/migrations/`, and ⛔ **no behavioural probe** —
outside R2, and filed instead.

### 2026-09-08 — backend, Track D: repointing the rotted `config.toml:13` citations (R30) and the 137→138 dated note (R26)

Scope: text-only, no DB command, no migration. ⛔ No `supabase/migrations`, `supabase/tests`,
`docs/backend-state.md`, `docs/design/authz-ae1-revoke-partition.md` or `docs/features/privilege-surface.md`
touched — those are other tracks'/the lead's.

**R30.** Verified each of the three owned sites against the file before editing (a cited line number
rots the same way a stale one does): `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md` (two `:13`
occurrences, not one — line 27's severity-bound claim **and** line 47's "to close" item 3, which R2 has
since discharged; both repointed and item 3 noted **done**), `FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE.md`
line 16 (repointed; the line-9 `config.toml:13` citation is inside a block explicitly marked *rotated
VERBATIM* from the retired PROGRESS.md and left untouched — rewriting a verbatim-preserved quote would
break its own integrity claim), `authz-ae4-if9-statement-scoped-review.md` line 63 (a historical QA
verdict — annotated with a dated note below the table, the reviewer's row left exactly as written, per
the same rule Track D was told to apply to review files). All three repointed to the **key**
(`supabase/config.toml`'s `[api].schemas`) rather than a line number.

**Swept the tree** for any other literal `config.toml:13` / `config.toml line 13`. Found, **not edited**
(outside the three owned files, reported for the lead to route): `docs/reviews/case-surface-split-increment-2-review.md:770`,
`docs/reviews/authz-evolution-plan-audit-2026-08-27.md:513`, `docs/reviews/external-db-audit-2026-07-evaluation.md:10`,
`docs/reviews/ff-3-review.md:347`, `docs/reviews/dm4-referrals-review.md:390` — all historical review
records, same shape as the AE4 review. `docs/progress/privilege-surface.md` (this file, lines 9/98/325)
and `docs/features/privilege-surface.md` (the hub) are the unit's own record/hub and out of Track D's
pathspec by the brief. `scripts/authz-tier1-threat-review-ae1.sql:66` and `supabase/config.toml:14`
already carry Track B's annotation (*"historically cited as `config.toml:13`"*) — verified current, not
touched.

**R26.** Added the 138 correction as a dated note beside the original 137 figure in
`FUP-AE1-REVOKE-SET-EXECUTION.md` (the claim's operative sentence, not the title) — both numbers stated
with what each counts (137 = `proacl IS NULL`; 138 = the effective silent-no-op class, the extra member
being `app.latest_published_version`'s non-NULL `proacl` carrying an explicit PUBLIC grant), quoting
Track A's §9.4 wording rather than paraphrasing it, and citing both `docs/design/authz-ae1-revoke-partition.md`
§9.4 and this record instead of restating the six-function list a third time. The original 137 sentence
and the 130/137 UNCHANGED breakdown are untouched.

**Gates:** `npm run lint:registers` — **rc 0** (read bare), ratchets unmoved
(`closesWhenPoToRule=136/147` etc., same as Track B's row). `npm run lint:progress` —
**rc 0** (read bare, `check-progress-doc: OK`).

Commit: `docs(privilege-surface): repoint config.toml:13 citations to the key and correct 137→138 (Track D, R26/R30)`,
explicit pathspec on the four edited docs plus this record.
