# Case surface split — the assertion-integrity group (2026-08-22)

_Remediation of one **class** of defect left open by ADR 0134 Increments 1–2: **an assertion that
proves less than its name claims.** Grouped deliberately — QA r2 named four of its own findings as
this class, and once grouped, three more open follow-ups turned out to be the same shape. Live status
stays in [PROGRESS.md](../../PROGRESS.md); this file is the record._

⛔ **Nothing here was accepted on a report.** Every item below was re-measured by the lead against the
live catalog or a re-run, and one delivered claim was **struck as already-done** rather than
"fixed" — see § What was struck.

## Why these belong in one group

The members do not share a subsystem — they span pgTAP suites, a mutation shell script, an E2E spec
and a TypeScript unit test. They share a **failure mode**, which is the axis that matters: each one
is a check that goes green while the property it names is untested or false. A count that survives a
swap. A domain bounded by a name. A subselect that returns NULL. A hand-list standing in for a
derived class. A gate that exits 0 on its own failure verdict.

⭐ Grouping by failure mode, not by file, is what surfaced the two biggest items — neither was
filed as an assertion defect, and both are.

## Gate figures (lead-run, fresh `supabase db reset`)

| gate | result |
| --- | --- |
| `npm run test:db` | **Files=209, Tests=6966, Result: PASS**, exit 0 (was 208 / 6941 → **+1 file, +25 assertions**) |
| `npm run lint` | exit 0, all 8 gates |
| `npm run typecheck` | exit 0 |
| `npm run test` (vitest) | **112 files / 1556 tests**, exit 0 |
| door-audit sweep, `CASES="can_read_case"` | `ARM-DOMAIN predicate=1/101 policy=0/225` · SWEPT 1 · COVERED 1 · **CLEAN, exit 0** |

⚠ `npm run e2e:prod` was **NOT** run. Only the touched specs were exercised (16 passed). The
Increment-2 union with 75 unrun still stands as the last full-suite word.

## What changed

### The 🔴 — `FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME`

`p0-authz-door-audit.sh`'s predicate arm is bounded by a **name prefix**, not a property. The
consequence QA argued — and the reason it was raised 🟠→🔴 — is not a coverage gap but that **an
empty-domain run printed the byte-identical line a clean run prints**. It had already produced a §6
step-1 record reading *"all four ARMs HOLD"* for a change that added a PHI writer.

**Reproduced before fixing:** driving the old summary tail with a 0-case state and a 326-row
all-COVERED state gave `diff` empty, `cmp -s` identical, **both exit 0**.

Fixed by a **four-way partition** — `0` CLEAN · `1` DIRTY · `2` ABORT · `3` UNPROVEN — plus a
machine-greppable `ARM-DOMAIN predicate=N/M policy=N/M out-of-domain-bool=K` line printed at start and
end, and a per-arm `⚠ EMPTY DOMAIN — it did not hold; it did not run` in both console and findings
file. An unmatched `CASES` token is now resolved **against the catalog** and reported with its return
type and `prosecdef`. Verified by the lead on the incident verbatim (`CASES="member_can_for"` →
**exit 3**, no BLIND/ERROR count printed, findings file untouched).

⭐⭐ **A second, larger defect fell out, and it is the one worth remembering: the old script's last
statement was `echo "BLIND: …"` with no `exit` after it, so it returned 0 on `BLIND: 5`.** §6 says
BLIND blocks the phase; the gate's exit code had been saying *pass*. Only abort/contamination paths
were ever non-zero. Confirmed by the lead against `git show HEAD:` — the script's final line is 446
and nothing follows it.

⛔ **The name→property widening was deliberately NOT done, and the measurement is why.** Of the 42
out-of-domain `prosecdef` booleans, `app.enqueue_notification` and `public.remind_document_approver`
are **side-effecting writers** — neutralizing them to `select true` silently deletes a notification
enqueue mid-suite; ~12 more are feature-flag readers where neutralizing turns features **on**. Auto-
widening trades a silent gap for silent `ERROR`s. The gap is instead **censused on every run** with
its own bound stated in the artifact: *outside this arm ≠ unswept, and 42 is the size of the
UNCLASSIFIED set, never a defect count.*

### The pgTAP half

| finding | was | now |
| --- | --- | --- |
| **M-5** `356` §13 | `count(*) = 4`; names only in the description | name-keyed `array_agg(… order by …)`, per `276` O5b; `321` K8's *added-vs-renamed* header convention copied |
| **M-6** `356` §8.2d | subselect returns NULL when the chain is absent, and `get_participant_patient(NULL)` is NULL ⇒ satisfied either way | precondition + its own positive control |
| **M-7** `356` §2.1 | "one body, not two" bounded to schema `app` | domain widened to all namespaces |
| **QA C-3** | V-1 was a check a human had to remember to run | `356` §14 — see the increment record's § V-1 |
| `FUP-GRANT-CASE-ACCESS-UNCHECKED` | the precedent every `app` unchecked writer is modelled on, untested since 2026-07 | `358` §A pins both class members' ACL + `prosecdef`, and the 3-caller set |
| `FUP-RESET-ROLE` | `reset role` leaves `request.jwt.claims` standing | `test_helpers.reset_role_and_claims()` + a red-first gate; adopted in `356`/`357` |

**Red-first, with the neutralizations that matter:** renaming `public.record_recusal` left the M-5
**count at 4** — the old assertion passing while the set was wrong. Forcing the participant fixture
empty left 8.2d **GREEN**. Planting a `public` hand-copy gave old-query `1`, widened-query `2`. Each
is the defect demonstrated, not argued.

**Two pre-existing defects found while working:**
1. `356` §2.2 was a **scalar subquery**, so the moment a second body existed — *the exact event §2
   exists to catch* — it would raise *"more than one row returned by a subquery"* and **abort the
   file**. An abort is not a red. Converted to the array form.
2. `356` §8.2d's `limit 1` ran over `case_participants` with **no `ORDER BY` and no patient join** —
   it would silently answer about the wrong subject the day a case has two participants.

⚠ **Methodology, and it cost time:** `docker exec psql … > file` on Windows adds CRLF (9734 vs 9328
bytes), so a shell-captured `pg_get_functiondef` is **unusable as a restore source**. Do catalog
mutations in-SQL.

### The E2E / TS half

- **M-16** — `/não encontr/i` matched **both** 404 copies, so five assertions passed whichever
  boundary refused. All five now use a KIND-returning `notFoundKind()`, extracted to
  `e2e/helpers/not-found.ts` and upgraded from `innerText` phrase-matching to **ROLE + NAME on the
  level-1 heading**. `:248` gained the same-path positive control it lacked. All five proven RED
  individually — the fifth only after isolating it, because the first flip aborted its test and
  *"did not run" is not a verdict*.
- **M-15** — "read-only" was a **2-item hand-list against a 16-member derived class**. Class extracted
  to `e2e/helpers/case-affordance-class.ts`, all **16 covered and structure-verified**, with a
  `FULL_CLASS.length === 16` census guard so a shrinking class reds.
  ⭐ **The decisive counterfactual (P2b):** with the old hand-list's G6 clause removed — the world
  where only a non-hand-listed member regressed — it stays **GREEN while G4 is measurably present
  (`count=1`)**. Blind by construction, the two scopes being disjoint.
  ⚠ **The first draft of the fix had the same disease:** the commission 404 page renders
  `<h1>Página não encontrada</h1>`, so an "an h1 is visible" anchor is *satisfied by the 404 page* and
  all 16 absence checks would have passed for free against a boundary. Replaced with a KIND-returning
  `detailState`.
  The inert helper was **measured, not quoted**: on an absent element `isVisible({timeout:5000})`
  returned in **12 ms**; `waitFor` consumed **5013 ms**.
- **M-14** — `const ALL: MemberCapability[]` accepted any subset in the file whose own docblock says
  every value must appear. Now `satisfies Record<MemberCapability, true>`. Verified independently by
  the lead: a sixth capability → **typecheck exit 2, `TS1360`**; restored → **exit 0**.
  ⛔ **It does not generalise** — measured, not inferred: the sixth capability produced **exactly one**
  error. `CAPABILITIES` in `src/lib/members/actions.ts`, the appoint-dialog menu and `seed.sql` all
  compiled clean. The technique transfers; each needs its own `satisfies`.
  ⚠ The fix **introduced a correct `lint:vacuous` red** (`Object.keys()` is opaque where a literal
  array was not) — the flag was right: those four loop-only tests could always have passed on an empty
  `ALL`, and the literal merely hid it. Each now opens with an unconditional row.

## What was struck

**M-4 was already delivered** and the finding is stale. At `c85af876`, `357` §8.2 already carried
`8.2b`, a `throws_ok` on `public.create_case` — symmetric with §8.1, with a header naming QA B1 as the
cause. Verified by the lead against `git show HEAD:`. **No change was made.** `357`'s entire diff for
this round is the `reset role` idiom collapsing into the new helper verb.

⭐ Worth keeping: the finding was written confidently, in a review that was otherwise accurate, and it
survived into a work list. *Verify, don't comply* applies to a QA finding exactly as it applies to a
prescribed fix.

## Four corrections to the findings themselves

Measured while implementing, all in the direction of the finding being *less* precise than it read:

1. M-15's *"the `Member[]` tables are **exported**"* is **false** — every table was module-private.
   That is *why* the hand-list existed; reuse required extraction, not import.
2. M-15 cites the hand-list at `casos-reading-surface-differential.spec.ts:374-517`; those lines are
   the **tables**. The hand-list was in `case-surface-split-increment-2.spec.ts` (B3).
3. M-15's soft-helper line refs are **~24 lines off**.
4. M-15 says *"three assertion helpers are soft"* but describes two. The third,
   `assertAbsentOnCasos`, is **correct** for an absence once the structure check has waited.

## What remains open

- **`FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS`** — root fix and gate are done; **step 1 (derive the
  real defect population) and the 134-file sweep are out of scope and still open.** The *capable*
  population drops 136 → 134. ⛔ It was never a defect count and still is not.
- **`FUP-CS2-QA-RESIDUE`** — 12 → **6** (M-1, M-8, M-11, M-12, M-13, M-17).
- **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2)** — untouched. `app._case_caps` returns `int`, so it is in
  **no** arm's domain at all; the new census covers `prosecdef` **booleans** only.
- **`p0-authz-invariant.sh:~418`** still prints the census remediation recipe that produced the
  incident; it should now say the door audit exits `3` and names the offending token.
- **A subset door-audit run still rewrites the whole findings file** from the subset's rows.
  Pre-existing; the mitigation is the `git checkout -- $DOOR_FINDINGS` step, which the lead performed
  and verified by md5 (`27c8d427…` restored).
- **Gate-record language** — records should quote the `ARM-DOMAIN` line rather than a bare verdict.
  The infrastructure now exists; the instruction lives in CLAUDE.md / lead-playbook and needs the
  PO's approval to change.

## Coverage facts, not defects

- `FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE` (already closed) said the G4
  administrativo × custom-fields cell had **no reachable fixture**. It is now **reachable** — measured:
  a `read_cases + create_cases` persona gets the *Campos personalizados* **Editar** on the seeded case.
  Increment 2's S8 made it so.
- On that same widened persona the **G1 `canWriteContent` editors did NOT return** — only G4 and G6.
  `create_cases` does not confer `canWriteContent` on the manage host.
- The `BUG-B5` *"⛔ CURRENTLY RED"* header block was **stale** — fixed by `a514d169`. Comment corrected.
