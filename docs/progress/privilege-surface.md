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

### 2026-09-08 — backend, Track C: the three unproven grants traced, the ceiling moved by ruling, §U4–§U6, and gate 15

Scope: rulings **R24** (the ceiling moves to 759) and **R25** (the reachability analysis), plus the
plan's §2.3/§2.6 pgTAP work and §2.4's budget-anchor gate. ⛔ **R1's defer held throughout: no
revoke was executed, no migration exists, no ACL change is committed.** **R5 re-asserted at this
commit, BOTH halves read bare** — `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` is **EMPTY (rc 0)** *and* `git status --porcelain` over the same pathspec is
**0 lines (rc 0)**. ⚠ The committed half alone would have been a weaker claim than it reads: this
track's edits were uncommitted at the time of the check, so `main...HEAD` could not have seen them
whatever they were. `supabase/tests/` and `package.json` are deliberately outside that pathspec.

**R25 — the three verdicts, each with a live discrimination half.** Full transcript:
`docs/design/authz-ae1-revoke-partition.md` **§10** (a new section that opens by stating it is a
**different population** from AE1's 233 and why the two cannot overlap).

| # | function | verdict | what decided it |
| --- | --- | --- | --- |
| 6 | `app.person_has_active_org_affiliation(uuid,uuid)` | **REQUIRED** | its one caller `public.list_linkable_org_users` is **SECURITY INVOKER**, so the inner call is checked against the caller. Revoked → the production read path (`src/lib/queries/members.ts:258`) raises `permission denied` from inside its `RETURN QUERY` |
| 7 | `public.recover_orphan_person_to_org(uuid,uuid,date)` | **REQUIRED** | a `public` door clients call by design (ADR 0168), exercised **five times as `authenticated`** by `398_adr0168_three_doors.sql` incl. a `lives_ok` positive control. Revoked → the call dies at the ACL instead of at the door |
| 5 | `app.is_affiliated_with_hospital_for(uuid,uuid)` | **UNNECESSARY** | its one caller across **every schema** is a **SECURITY DEFINER** wrapper, so the inner call is checked against `postgres`. Revoked → wrapper still works, and the real policied `select … from public.hospitals` still works |

⭐ **The whole analysis turns on one mechanism, and it was DEMONSTRATED on these exact objects
rather than recalled from the manual**: EXECUTE is checked against the role current *at the moment
of the call*, which inside a DEFINER body is the owner. ⛔ Reasoning it would have been enough to
get the right answer and no evidence at all.

⭐⭐ **The negative results are believable only because of their discrimination halves.** Verdict #5
rests on two calls that *did not raise*, and a call that does not raise is exactly what a dead
instrument produces. So: (a) the same revoke was shown to make a **direct** call raise, and (b)
revoking the grant the policy genuinely needs — the wrapper's own — makes the **identical**
`public.hospitals` read raise `permission denied for function is_affiliated_with_hospital`. Every
probe ran inside `begin … rollback`.

⛔ **No verdict is UNDECIDED, and §10.5 says why that is a result and not an omission** — with the
two things that *would* have forced one (a caller reached through dynamically assembled SQL; a
production call site no channel can see), so a later reader can see the bound rather than infer it.

⚠ **A trap found while probing #7, recorded because it outlives this analysis.** `398`'s *negative*
assertions use `throws_ok(…, '42501')`, and `permission denied for function` **is also 42501** — so
a revoke would leave those negative assertions **green while changing what they measure entirely**.
Only the `lives_ok` positive control reds. *An earlier guard firing leaves the later one untested*,
in a live suite, today.

**R24 — the ceiling moved, and the record says why that is not the forbidden edit.**
`docs/backend-state.md` § Privilege budget now reads **`CEILING: 759`** with **`CEILING: 752`**
quoted beside it as the superseded value, and a new subsection carrying the PO ruling, its dated
basis, and the seven named with the increment that added each. ⛔ **That subsection opens by
restating the prohibition it is standing on**: the follow-up names this exact edit as the thing to
not mistake for a fix, and it is legitimate here *only* because a ruling exists, is dated, and is
recorded — put **after** the attribution was measured. A later reader tells the two apart by that
paragraph; an edit with no ruling beside it is the forbidden one whatever number it carries.
⚠ **The ruling's own basis was re-measured rather than carried**: "four are structurally required by
live RLS policy expressions" reproduces exactly against `pg_policies` — `can_edit_commission_forms`
**6** · `can_administer_person_via_affiliation` **3** · `current_professional_read_organizations`
**1** · `is_affiliated_with_hospital` **1** · the other three **0**.

**R15 — `320` EXTENDED, not replaced.** `supabase/tests/320_act_expiry_and_acl_hardening.sql` gains
§U4/§U5/§U6, `plan(18)` → **`plan(36)`** (14 `is` + 4 `ok` = 18 new call sites, tagged U4a–U4c ·
U5a–U5g · U6a–U6h). ⛔ No `415_*.sql` and no rename. The section header carries the two arguments
R8/R10/R11 demanded, written for QA as their reader: the **§U1/§U4 boundary** (different
*population* — neither contains the other; different *decision owner* — §U1's 236 moves by triage,
§U4's ceiling only by PO ruling; different *direction of concern*; and neither derives from the
other, both re-deriving from the live catalog every run), the **`ARM=census` reconciliation** with
its three conditions named and the statement that removing gate 15 makes §U4 inherit the
prohibition in full, and the **polarity** choice (exact equality both directions, matching §U1,
because a fall is what a half-applied migration looks like).

**Observed pgTAP output.** `00_setup` + `320` on the fresh reset: **`Result: PASS`, Files=2,
Tests=37, rc 0** — all 18 new assertions green including both controls. The FULL suite, on its own
fresh `supabase db reset --local` (rc **0**), read bare: **`All tests successful.`
Files=262, Tests=8900, `Result: PASS`, rc 0**, with `320 … ok` in the file list. ⚠ **No
before/after Tests delta is quoted here**: this track did not run `test:db` before its edit, so a
"8882 → 8900" line would be 8900 minus a number nobody measured. What IS measured is `plan(18)`
→ `plan(36)` in the file and 18 assertion call sites counted in the new block. The three controls that
matter, in their own words:

- **§U5 rising** — a freshly created `app` DEFINER is *not* `authenticated`-executable (U5a proves
  `…005300`'s default revoke is live, so the grant is what moves the count and not an ambient
  default); creating it alone does **not** move the budget (U5b); the explicit grant moves the
  predicate (U5c) and the count 759 → **760** total / 326 → **327** `app` (U5d/U5e); the drop
  restores both (U5f/U5g).
- **§U6 falling, half 1** — ⭐⭐ **U6b asserts `has_function_privilege` actually MOVED to false
  BEFORE U6c asserts the count fell.** That order is the whole point: a revoke against a
  PUBLIC-routed function moves nothing, and a control that only asserts "the count fell" cannot tell
  the two apart. It is also why a control built the other way round can be satisfied by a DROP, by a
  rollback, or by nothing happening at all.
- **§U6 falling, half 2** — ⭐⭐ the silent no-op is **CONSTRUCTED and ASSERTED**, not warned about:
  a probe granted to PUBLIC is in the budget (U6d), `revoke … from authenticated` leaves the
  effective predicate **TRUE** (U6e), and the count **does not move** (U6f). AE1's 138-of-233 class,
  live, as a property of this database.
- **U6h** closes by asserting **§U1's population is still 236** after §U4–§U6 have created, granted,
  revoked and dropped `app` functions including one granted to PUBLIC — the "did not disturb the
  incumbent" claim made *inside* the file rather than left to a reader's inspection.

**⭐ The pin is PROVEN TO FIRE, in both polarities and per schema** (R4's bar: a gate that has only
ever been green has not been shown to be a gate). Two committed catalog mutations, each restored:

| mutation | what moved | observed |
| --- | --- | --- |
| **M1** — plant a granted `public` DEFINER (`+1`) | `public` 433 → 434 | rc **1**; U4b `have 434 want 433`, U4c `have 760 want 759`, ⭐ **U4a stayed GREEN** |
| **M2** — revoke `authenticated` from a real `app` member (`−1`) | `app` 326 → 325 | rc **1**; U4a `have 325 want 326`, U4c `have 758 want 759`, ⭐ **U4b stayed GREEN** |

⇒ The per-schema pins discriminate, and the **fall** is observable — which is exactly the polarity
R11 warned would otherwise go unproven. Both mutations were verified *applied* before the run
(M2's `has_function_privilege` read **f**), and both restored after.

**Gate 15 — `lint:budget-anchor`, appended at the END of the chain.** ⛔ Not folded into
`lint:config-schemas`: one exit code for two unrelated subjects is what the plan rejected for
`lint:set-local`. `scripts/check-budget-anchor.mjs` reads the **home**
(`docs/backend-state.md`'s `<!-- BUDGET-ANCHOR … -->` plus its prose `**CEILING: N**`, which must
agree with each other) and the **mirror** (`320` §U4's three pinned literals, read from the literal's
own tagged line — ⭐ **never from a comment restating it**, because two comments can agree while the
`is()` literal says something else). Checks: P1–P4 positives · **D** home-agrees-with-itself · **A**
parts sum · **C** `total <= ceiling` · **B** mirror matches home. ⭐ **C is what makes it a gate**:
raising §U4's pin without a ruling forces the doc's `total` up (or B reds), and a total above the
ceiling reds at C — so the only way to pass with a higher population is to also move `CEILING`,
which the merge rule reserves to the PO. ⛔ **C is `<=`, not `==`**, and fixture **G3** (ceiling 800
> ⚠ **2026-09-08 fix loop, R35(a) — a dated note beside the M1 row above, NOT a rewrite of it.**
> The M1 row reports **three** assertions. The independent tip-gate runner re-ran the identical
> mutation and it redded **TEN**: `U4b · U4c · U5b · U5d · U5f · U6a · U6c · U6d · U6f · U6g`. ⛔ The
> three the row names are **correct**; the **account** is not — *a partial account of a measurement
> reads as a complete one*, which is why the number is added here rather than substituted above. The
> seven extra were §U5/§U6 controls pinned on absolute literals, carrying no finding of their own and
> burying the two that do.
> ⭐ **REPAIRED in the same fix loop (R35(b)):** §U5/§U6's control assertions are now **deltas from a
> baseline snapshotted before the first probe** (`pg_temp.budget_baseline` / `pg_temp.base()` in
> `320`); §U4's pins stay **absolute**, because they are the ratchet. Re-measured after the repair —
> see this session's entry for the observed count, which is the only thing that makes the repair a
> claim about the file rather than about the intention.

over a total of 759) is the discrimination half proving the gate does not quietly demand equality.
Its bullet is in `docs/lint-gates.md` **in the same commit** (nothing gates that file), which also
corrects that file's exit-2 list — it had omitted `lint:config-schemas` since Track B landed it.

**Fixture results and every exit code, each read bare or through a redirect (⛔ never a pipe):**

| # | run | rc | what it witnessed |
|---|---|---|---|
| 1 | `--self-test` | **0** | 15 bad pairs each caught **for its own reason**, 5 good pairs each clean; baseline = *"the real files' current bytes"* |
| 2 | real scan, clean tree | **0** | prints ceiling/app/public/total, both mirror line numbers, and its own bound |
| 3 | planted tree: `320`'s `app` literal 326 → 327 | **1** | `THE MIRROR HAS DRIFTED FROM ITS HOME — key app` |
| 4 | planted tree: a **consistent** census over the ceiling (doc `app=327 total=760` + both mirrors) | **1** | ⛔⛔ `THE BUDGET IS OVER ITS CEILING — total 760 > ceiling 759` |
| 5 | planted tree: prose reverts to the superseded 752 | **1** | `THE ONE HOME DISAGREES WITH ITSELF` |
| 6 | planted **checker**: check C neutered | **2** | `B2 NOT CAUGHT (OK)` → `SELF-TEST FAILED` |
| 7 | planted **checker**: check B neutered | **2** | `B3/B4/B5 NOT CAUGHT (OK)` |
| 8 | planted **checker**: check A neutered | **2** | `B1 caught for the WRONG REASON: expected A_PARTS_DO_NOT_SUM, got B_MIRROR_DRIFT` |
| 9 | `npm run lint` | **0** | **all 15 gates reached** (see below) |

⭐⭐ **Rows 3–5 are the R28 test, and they pass it.** Track B measured that fixtures derived from the
real artefact are poisoned by the very plant they exist to detect, which **inverted the exit code**
from 1 (the finding) to 2 (the checker is broken) and made the gate's one real red unreachable. This
gate's baseline is canonicalised the same way, and the proof is that rows 3–5 exit **1** while
printing *"the real files CANONICALISED — the bytes on disk are NOT clean, see the finding below"* —
the self-test correctly reporting on the CHECKER while the scan reports on the FILES.
⭐ Row 8 is the better of the three checker mutations: the fixture still redded, at a *different*
check, and only the per-fixture `expect` code exposed it. A self-test keyed on "did it red?" alone
would have called that green.

**Gates the full `npm run lint` actually REACHED**, quoted rather than assumed because `&&`
short-circuits: `eslint` (silent, 0 findings) · `css-vars` · `memberships-door` ·
`client-server-imports` · `vacuous` · `set-local` · `progress` · `rules` · `adr-index` · `mojibake` ·
`service-role-registry` · `authz-vectors` · `registers` · `config-schemas` · **`budget-anchor`** —
**15 of 15, rc 0**.

**Dead ends and near-misses, each recorded because it cost a wrong belief for a while.**

- ⛔⛔ **A planted-checker mutation SILENTLY DID NOT APPLY and reported green.** The first M-CHK run
  used a `python3 - <<'PY'` heredoc inside a shell function; a Windows shim ran the heredoc under
  **Node**, which died on `import io,sys` — and the run still printed `rc_MCHK=0`, which reads
  exactly like *"the checker survived the mutation"*. It was caught only because the plant's own
  output was inspected rather than its exit code trusted. *A mutation that did not fully apply
  reports green*, in a mutation harness written to test for exactly that. Re-run with a Node planter
  that **exits 9 if the target string is absent or the bytes do not change**, which is what produced
  rows 6–8.
- ⛔ **`psql` without `-v ON_ERROR_STOP=1` exits 0 over a file of errors.** The first ad-hoc run of
  `320` printed `ERROR: function plan(integer) does not exist` followed by ~140
  `current transaction is aborted` lines and still returned **rc 0**. The rc was read bare and was
  still useless. (The real cause: `pgtap` is not installed in the database — `supabase test db`
  creates it, so a bare `psql` run of any pgTAP file is not a shortcut.)
- ⛔ `supabase test db <one file>` cannot run `320` alone: `test_helpers` is created by
  `00_setup.sql`, so the single-file loop is `00_setup.sql` **plus** the target.
- ⚠ A `node - <<'JS'` heredoc **collapsed `\\` to `\`** in a Windows path literal, producing
  `Legacy octal escape is not permitted in strict mode`. Harmless because it was a syntax error, but
  the same collapse inside a *string* would have silently written to the wrong path. Fixed by
  passing paths as argv with forward slashes.
- ⚠ **`ANCHOR_RE` is `^…$` without the `m` flag**, which is correct for the line-by-line scan and
  **matches nothing** when applied to a whole document. Four fixtures used it that way and would all
  have been silent no-ops; caught by the fixture harness's own *"DID NOT APPLY — bytes identical to
  the baseline"* guard before the first green was believed.
- ⚠ **Gate 13's `longHeadings` ratchet rose 95 → 96** on the first run with the new follow-up
  filed, and stayed **under** its cap of 97, so the chain was green. ⛔ Green under cap is not the
  bar — *"a rising ratchet on an otherwise-clean run is the thing to chase"*, and consuming the
  last unit of headroom is how the next filer meets a red they did not cause. The heading was cut
  229 → 150 chars and the ratchet re-measured back to **95/97**.
- ⚠ `pg_depend` returning **0 rows** for these functions is **not** evidence of no callers — a SQL
  function body is a string and records no dependency. It is only evidence there is no CHECK
  constraint, view, default or index depending on them, which is the RV3 hazard and is what it was
  read as.

**Nothing contradicts a ruling.** R14 is discharged exactly as R24 says: the pinned figure is the
ruled one and was not chosen here. R21.2 stayed vacuous (no park dir, per R27) and no parking
apparatus was rebuilt — `supabase db reset --local` alone was sufficient, twice, each rc **0**, with
`git status --porcelain -- supabase/migrations` **0 lines** before and after.

**Not done here, by scope:** the four files **Track D** owns (its `FUP-APP-SCHEMA-…`,
`FUP-UI-AUTHZ-…`, `FUP-AE1-REVOKE-SET-EXECUTION` and the AE4/IF9 review) — ⚠ Track D landed
`a2f9f981` while this track was building, so **this entry was appended AFTER its entry rather than
over it**, and the register edit here is **+13/−0 with zero deleted lines**, checked rather than
assumed because Track D also writes to `docs/followups/`, the
hub's `## Current state` (the lead's), and ⛔ **any revoke** — R1's defer holds, and §10.4's
`UNNECESSARY` verdict is filed as
`FUP-AUTHZ-IS-AFFILIATED-WITH-HOSPITAL-FOR-GRANT-UNNECESSARY` whose `Closes when` requires the
revoke to assert its predicate **moved** *and* to re-pin §U4 and the anchor in the same migration,
because gate 15 reds if they disagree.

### 2026-09-08 — gate at the tip (independent runner)

Run at `bd50dfc9`, branch `authz-privilege-surface`, working tree clean before and after. ⛔ **The
runner built none of the four tracks** (protocol §4 step 4, ruling R34) and **repaired nothing** —
every observation below is a reading, and the only file this turn edits is this record. `npm run
lint` carries **15** gates now, not 13.

**Every command, every exit code read BARE** (own line or a redirected rc file; ⛔ never through a
pipe, never in a `;`-chain that consumes it).

| # | command | rc |
|---|---|---|
| 1 | `npm ci` | **0** (957 packages) |
| 2 | `npm run lint` | **0** — 15 of 15 gates REACHED, eslint silent at 0 findings |
| 3 | `npm run typecheck` | **0** |
| 4 | `npm run test` | **0** — 151 files, 2056 tests |
| 5 | `supabase db reset --local` | **0** — head `20261003007350` |
| 6 | `npm run test:db` | **0** — `All tests successful.` Files=**262**, Tests=**8900**, `Result: PASS` |
| 7 | `ARM=census` | **0** — `=== INVARIANT HOLDS ===` |
| 8 | `ARM=hat` | **0** — `=== INVARIANT HOLDS ===` |
| 9 | `ARM=floor` | **0** — `=== INVARIANT HOLDS ===` |
| 10 | `FROMFINDINGS=1 ARM=wrapper` | **0** — `=== INVARIANT HOLDS ===` |
| 11 | `SELFTEST=1 scripts/door-sweep-selftest.sh` | **0** — `SELF-TEST: PASS 42 · FAIL 0 · SKIPPED 0` |
| 12 | `SELFTEST=1 scripts/door-sweep-cases.sh` | **0** — `SELF-TEST: PASS 42 · FAIL 0 · SKIPPED 0` |
| 13 | `scripts/door-sweep-cases.sh main` | **3** — NOT-APPLICABLE |
| 14 | `authz-setvalued-targeted-cases.sh` (detached) | **0** — `RESULT: CLEAN — 3 resolver(s) measured, all COVERED.` |

⛔ **`&&` short-circuits, so the gates a run REACHED are quoted, never assumed** (R13): `eslint` ·
`css-vars` · `memberships-door` · `client-server-imports` · `vacuous` · `set-local` · `progress` ·
`rules` · `adr-index` · `mojibake` · `service-role-registry` · `authz-vectors` · `registers` ·
`config-schemas` · `budget-anchor` — **15 of 15**. Gates 14 and 15 each ran their self-test ahead of
their scan on this run, so the chain's rc 0 carries *"the checker can fail"* and not only *"the file
is clean"*.

**Each arm's DOMAIN, quoted verbatim, because a verdict without its domain means nothing.**

- **`ARM=census`** — `domain: prosecdef bool | prosecdef set-returning+reachable | public INVOKER
  plpgsql | all RLS policies`, and its own exclusion line, `NOT in domain: prosecdef scalar non-bool
  command doors (427 reachable, DERIVED this run) — FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`. Verdict:
  `OK: no unswept newcomer WITHIN THIS ARM'S DOMAIN`, with five live backlog entries listed as
  outside it and explicitly KEPT.
- **`ARM=hat`** — ⚠ prints **no line labelled `domain:`**; recorded as observed rather than
  paraphrased into one. Its scope statement is `anchors: app.has_role(4-arg) + app.has_role_any +
  authz.holds_role carry the active-role condition`, over `self-test: 7/7 OK`. Verdict:
  `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted`.
- **`ARM=floor`** — `authenticated-reachable prosecdef doors with 0 calls: 63`, derived this run
  from a full pgTAP suite under `track_functions=all`. Both closure directions asserted:
  `OK: every never-called door is on the floor allowlist.` and `OK: every floor-allowlist entry
  resolves to a live door.` ⭐ This is the population R1's defer protects — a revoke would EVICT
  members from it and the arm would go quiet for the honest reason that it can no longer see them.
- **`FROMFINDINGS=1 ARM=wrapper`** — `mode: FROMFINDINGS (comparing COMMITTED findings md, no
  sweep)`, `BLIND set size: 41`. Verdict: `OK: every BLIND wrapper is on the allowlist.`
- **set-valued targeted home** — `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with
  dispositions)`; all three COVERED, and its own three-way restore verification passed
  (`§4a residue: 0 rows` · `suite after restore: Result: PASS (Files=262, Tests=8900)` ·
  `sentinel + sidecars: absent`).

**The diff-scoped door sweep — NOT-APPLICABLE, and the rc was read BEFORE any substitution.**
`bash scripts/door-sweep-cases.sh main` → `rc=$?` on its own line → **3**. ⛔ No `CASES` variable was
ever built from its stdout, so the empty-string third state could not arise. ⚠ This **3 is the
deriver's NOT-APPLICABLE**, which is a different exit from the **3 UNPROVEN** an empty `CASES`
produces inside a sweep; the two share a number and conflating them is its own defect. Neither
sweep arm is owed, because there is no migration for one to have a domain over. The `SCOPE:` line,
verbatim:

```
SCOPE: 0 file(s) — 0 committed (main..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)
       0 case(s) — nothing was derived, and the line above is what the gate record
       quotes to say so.
```

**R5, asserted rather than eyeballed.** `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src > pathspec.txt` (rc **0**), then `wc -c` → **`PATHSPEC_BYTES=0`**. ⚠ Beside
that zero, and required by R5 so no reader wonders whether the check was weakened: this unit **did**
touch five areas the pathspec deliberately does not cover — `supabase/config.toml`,
`supabase/tests/320_act_expiry_and_acl_hardening.sql`, `scripts/` (both new checkers plus the
annotation on `authz-tier1-threat-review-ae1.sql`), `package.json`, and `docs/`. The full
`main...HEAD` name-status is 19 files, **0** of them under `supabase/migrations`, `supabase/seed.sql`
or `src`. ⇒ R1's defer and R2's ruling are honoured, and the emptiness is what says so.

**§U1 is still 236 — verified THREE independent ways, not read off a green bar.** (1) The live
catalog, queried directly on the fresh reset by the runner's own SQL: **236**. (2) The literal in
`320` at line 301 is unchanged at `236`, and `git diff main...` over that file is **+243/−1**, the
single deletion being `plan(18)` → `plan(36)`. (3) `320` §U6h asserts it a second time *after*
§U4–§U6 have created, granted, revoked and dropped `app` functions including one granted to PUBLIC,
and it is the last assertion in the file before `finish()`. The same run re-derived the budget:
`app` **326** · `public` **433** · total **759**, matching all three §U4 pins and the anchor in
`docs/backend-state.md`. The head **pair** (R19) reads `(20261003007350, 524)`, exactly as Track A
recorded it.

**⭐ The two new gates were proven to FIRE by the runner, not taken from the build record.** Both
checkers resolve their subjects from `process.cwd()` and build fixtures in `os.tmpdir()`, so both
halves were provable **without touching the repo** — `git status --porcelain` was **0 lines** before
and after every plant.

| plant | subject | rc | observed |
|---|---|---|---|
| real checker, copied clean tree | control | **0** | reproduces the in-tree run byte for byte |
| `"app"` added to `[api].schemas` | file | **1** | `⛔⛔ SECURITY EVENT — … "app" HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS` |
| `"authz"` added instead | file | **1** | `REVIEW EVENT — … the pinned [api].schemas list CHANGED VALUE` |
| the sentinel line deleted | file | **1** | `the load-bearing comment sentinel is missing…` |
| `320`'s `app` literal 326 → 327 | file | **1** | `THE MIRROR HAS DRIFTED FROM ITS HOME — key app` |
| a **consistent** census over the ceiling | file | **1** | `⛔⛔ THE BUDGET IS OVER ITS CEILING — total 760 > ceiling 759` |
| prose reverts to the superseded 752 | file | **1** | `THE ONE HOME DISAGREES WITH ITSELF` |
| check **C** neutered in a copy of the checker | checker | **2** | `B2 NOT CAUGHT (OK)` → `SELF-TEST FAILED` |
| check **N1** neutered in a copy of the checker | checker | **2** | `B1 caught for the WRONG REASON: expected N1_APP_EXPOSED, got N2A_LIST_CHANGED` |

⭐ R28's fix is confirmed from the outside: with `"app"` planted, the self-test line reads *"G1 = the
real file CANONICALISED — the bytes on disk are NOT clean, see the finding below"* and the run exits
**1**, not 2 — the checker verdict and the file verdict stay separate, which is the whole point.
⭐ The N1 mutation is the better of the two: the fixture still redded, at a *different* check, and
only the per-fixture `expect` code exposed it. A self-test keyed on *"did it red?"* would call that
green.

**⭐ §U4 was proven to fire too, because it had only ever been GREEN in this runner's hands.** A
granted `public` SECURITY DEFINER probe was created in the live catalog (`public` 433 → **434**,
`has_function_privilege` verified **t** before the run), `00_setup` + `320` re-run: **rc 1**,
`Result: FAIL`, `Failed 10/36 subtests`. U4b `have 434 want 433` and U4c `have 760 want 759` both
red while **U4a stayed GREEN** — the per-schema discrimination Track C claims. Probe dropped,
population verified back to `app` 326 / `public` 433 with **0** residue rows, and the pair re-run
**rc 0, `Result: PASS`**.

⚠ **A measured correction to the build record, offered as a finding and not a repair.** Track C's M1
row reports that mutation as *"rc 1; U4b …, U4c …, ⭐ U4a stayed GREEN"* — three assertions. The
runner's identical mutation redded **ten**: `U4b · U4c · U5b · U5d · U5f · U6a · U6c · U6d · U6f ·
U6g`. The seven extra are §U5/§U6's controls, which are pinned on **absolute** literals (`759` →
`760` → `759`) rather than on a delta from a re-derived baseline. ⇒ Two consequences worth the next
reader's time: a single unrelated `+1` anywhere in the population reds **7 control assertions that
carry no finding**, burying the 2 that do; and the controls are **baseline-coupled**, so they stop
measuring *"the detector moves"* the moment the baseline moves. ⛔ Not blocking, not repaired here,
and the pin itself is correct and discriminating — but the build record's account of M1 is
**incomplete**, and *a partial account of a measurement reads as a complete one*.

**Environment traps the earlier tracks recorded, honoured rather than rediscovered:** every `psql`
run went through `docker exec -i … -v ON_ERROR_STOP=1` on stdin; the planter used here **exits 9 if
its target string is absent or the bytes do not change**, and it earned that on the first attempt —
a plant keyed on `**CEILING: 759**` did not match the file's `**CEILING: 759.**` and exited **9**
instead of reporting the green that a silent no-op would have produced (*a mutation that did not
fully apply reports green*). One plant aimed at the wrong string is also recorded: rewriting the
R32 mitigation banner (`THE \`schemas\` LINE BELOW IS LOAD-BEARING`) left gate 14 **green (rc 0)**,
because the pinned sentinel is the separate line `⛔ LOAD-BEARING — DO NOT ADD "app" TO THIS LIST.`
⇒ R32's own stated dependency — *"this ruling depends on something NO GATE ENFORCES"* — is now
**measured** rather than assumed.

**Not run, and why:** the E2E gate. `PATHSPEC_BYTES=0` means no `src`, no migration and no seed
change, so no acceptance criterion moved and the prod-standalone suite is not owed.

⚠ **Four observations handed to the lead for the Record step, none of them gate-blocking.** (1) No
**ADR** exists on this branch, where Batches 0–6 each produced one (0189 · 0190 · 0191 · 0192 ·
0193 · 0194) — while this unit made ADR-shaped decisions (extend `320` vs. a new file with the
§U1/§U4 boundary argued; the two-instrument split that answers `ARM=census`'s standing prohibition;
the polarity choice; the ceiling's one home plus merge rule). (2) The **hub's `## Current state` is
three commits stale**: it lists Tracks C and D under `### In progress` though both are committed
(`a2f9f981`, `5602830d`, `bd50dfc9`), and it says *"31 rulings"* where the rulings file holds
**34**. (3) The hub also says Track B built *"13 fixtures"*; the gate's own self-test reports
**10 bad + 4 good = 14**, and the checker has been touched exactly once (`6fee08ae`), so the figure
was never right rather than having drifted. (4) The record cites R-numbers **62 times** against a
rulings file that lives only in a session temp directory and is in no commit — ⚠ a **pre-existing
program-wide pattern**, not a Batch 7 novelty (`register-gate-hygiene.md` cites R1/R4/R45,
`enforcement-manifest.md` cites R3), so it is raised as a program question, not as this unit's
defect.

⭐ All three follow-ups correctly still read `Status: open` in `docs/followups/follow-ups-open.md`,
which is what R33 requires before PO approval. ⚠ The ceiling entry's heading still describes the
budget as *"759 against a ceiling of 752"*, now superseded by R24 — the closure is the place that
fixes it.

**⛔⛔ `45204ddb`'s message is malformed the SAME way `b657aaf6`'s was, and it is NOT amended.** A
PowerShell here-string (`@'…'@`) was passed to the **Bash** tool, where `@'` is an ordinary literal,
so the subject carries a leading `@ ` and the body a trailing `@`. ⭐ **This is the trap Track A
wrote down in this very file, and it caught the next writer to touch the file — one entry later, by
a different agent, on a turn that had already READ that entry.** ⇒ Recording a hazard in a session
log is demonstrably not the same as being protected from it; the remedy that would actually bind is
a habit or a gate, not a paragraph. Per the standing rule *a subagent must never `git commit
--amend`* — whose named remedy is *"a bad message gets a follow-up commit"* — it is corrected here
rather than rewritten, and the rule's mechanism is not hypothetical even for a sole owner: `--amend`
targets **HEAD**, not *"my commit"*, and this runner cannot prove nothing landed between its
`git status` and its `git commit`. The content of `45204ddb` is exactly this file, **+167/−0**.

**⛔⛔ CORRECTION, same day, measured 6 minutes after the entry above was committed: THE TIP MOVED
UNDER THE GATE, and the rule's mechanism was LIVE, not hypothetical.** `45204ddb`'s parent is
**`42ca7718`**, not `bd50dfc9` — a commit by another agent landed on this branch at **13:32:25**,
while this runner's set-valued arm was still in flight. ⭐ Had `--amend` been used to fix the
malformed message above, it would have targeted **that agent's commit**, retitling their ADR work
with this runner's gate message. The standing rule was not a formality here; it was load-bearing
within one turn of being cited.

⇒ **Two consequences, both measured rather than reasoned.**

1. **A claim in the entry above is now FALSE and is corrected here, not rewritten.** It reads *"No
   **ADR** exists on this branch, where Batches 0–6 each produced one"*. `42ca7718` added
   **ADR 0195 — "A committed number needs ONE home and a GATED mirror, and a ratchet joins its
   incumbent"** (`Status: Proposed`), and updated `docs/decisions/INDEX.md`, `proposed-review.json`
   and the hub's `adrs:` frontmatter to `["0079","0127","0134","0155","0160","0182","0191","0192",
   "0193","0195"]`. ⛔ Worse than stale-after-the-fact: the ADR landed at 13:32 and the sentence was
   *written* at ~13:37, so the claim was **already false when it was written** — the runner derived
   it at ~13:25 and did not re-derive before committing. *Your own measurement goes stale like any
   other.* ⭐ Findings (2), (3) and (4) were **re-checked at the new tip and all still hold**: the
   hub still says *"31 rulings"* against a file of **34**, still says Track B built *"13 fixtures"*
   against a self-test reporting **10 bad + 4 good = 14**, and still lists Tracks C and D under
   `### In progress` — `42ca7718` touched only the hub's frontmatter, not its `## Current state`.
2. **What the gate's verdict now covers, stated exactly rather than left to read as "the tip".**
   Runs 1–14 above were executed at `bd50dfc9`. The diff `bd50dfc9..HEAD` is **five files, all under
   `docs/`**, and that is asserted, not eyeballed: `git diff --name-only bd50dfc9..HEAD -- src
   supabase scripts package.json` is **0 bytes**. ⇒ No arm that reads code, the catalog or the
   package chain can be affected. The one gate the diff *can* move is `npm run lint` (gates 9 and 13
   read `docs/decisions/` and the hub), and it was **re-run twice after `42ca7718` landed** — rc
   **0**, **15 of 15 gates reached**, ratchets unmoved at `longHeadings=95/97`. ⛔ Still recorded as
   a protocol breach rather than waved through: **R34 exists so the tip gate runs on a FROZEN tip**,
   and a builder committing into the window defeats the word *"tip"* whatever the diff turns out to
   contain. The next runner should be told the branch is frozen, and the freeze should be observable
   rather than assumed.
