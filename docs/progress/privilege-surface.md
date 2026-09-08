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

**Not done here, by scope:** §2 pgTAP (blocked on the PO ruling per R14 — ⛔ the pinned literal is
filled in from the ruling, never chosen by the builder), §3's config gate (another track), §5.
⛔ `CEILING: 752` is **unchanged** in `docs/backend-state.md`.
