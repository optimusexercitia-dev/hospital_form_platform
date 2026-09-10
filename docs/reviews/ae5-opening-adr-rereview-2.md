# QA re-review 2 — pre-AE5 remediation Batch 9, unit `AE5-OPENING-ADR`

**Verdict: APPROVED**

**Round:** 3 of the fix loop (cap 5) · **Tip reviewed:** `1d205f64` on `authz-ae5-opening-adr`
**Prior rounds:** [`ae5-opening-adr-review.md`](./ae5-opening-adr-review.md) (2 BLOCK · 2 MAJOR · 7
MINOR) → [`ae5-opening-adr-rereview.md`](./ae5-opening-adr-rereview.md) (0 BLOCK · 3 MAJOR · 2 MINOR)
**This round:** 0 BLOCK · 0 MAJOR · 3 MINOR, all three named below as **Record-step residue**, none
of which changes what a reader of the corpus would do.

Round 2's whole finding was that the fix loop had introduced three new defects of the class it was
repairing. **Iteration 2 did not repeat that.** All five of its findings are discharged, every anchor
it added resolves, both superseded quotes match byte-for-byte what they claim to supersede, and the
one clause I re-derived independently — the load-bearing one — holds on a **stronger** predicate than
the one the fix used. What survives is three counts/attributions in prose.

---

## Re-run at the tip, exit codes read BARE (zsh — `pipestatus`, never `PIPESTATUS`)

| command | exit | note |
| --- | --- | --- |
| `npm run lint` | **0** | full chain; gates 7 and 13 (progress/registers shape) green over the new hub block and the new register entry |
| `npm run typecheck` | **0** | `tsc --noEmit` |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | **0**, output **EMPTY** | ⭐ the batch's defining claim, still true at `1d205f64` |

⛔ Not re-run, per scope: `test:db` and the four authz arms. The branch's only non-doc files are
R13's harness scripts and two `supabase/tests/vectors/*` files, unchanged by iteration 2.

---

## Job 1 — did iteration 2 fix its own five findings?

### N-MAJOR-1 (the orphaned routing tail) — **FIXED**

- **Tail gone from item 5.** `docs/plans/pre-ae5-remediation.md:420-426` (item 5) now ends at
  *"…take **0205** for anything else, or renumber the deferred pair and say so here."* The routing
  sentence is no longer in the terminal position of the banner.
- **Re-homed on item 4** at `:412-419`, together with the half that is still asserted live (*"this
  plan deliberately writes NO Batch 10 block"*), which is where it belonged.
- **Quoted as superseded, verbatim.** `:415-417` quotes *"whoever opens Batch 10 derives its scope
  from the unit record's R3/R4 entries and the corrected register clauses, not from a placeholder."*
  Compared against the text `git show 1d205f64` removes from item 5 — character-identical.
- ⛔ **No third copy anywhere.** `grep -rn "not from a placeholder" --include="*.md"` → 4 hits, all
  accounted for: the plan's quote (`:417`), the record's quote inside the iteration-2 entry
  (`docs/progress/ae5-opening-adr.md:1197`), and my own two reports. `grep -rn "corrected register
  clauses"` adds only `plan:408` (item 4's own past-tense description) and the same reports.
- **Item 4's *"previously"* is now true**: nothing live in the banner routes at R3/R4 alone; `:411`
  reads *"⛔ never from R3/R4 alone"*.

### N-MAJOR-2 (the false universal, and the hidden fixture) — **FIXED** (residue: R2-MINOR-1)

Every sub-claim of the correction at
`docs/followups/FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE.md:126-156`
measures true:

| claim | measured |
| --- | --- |
| superseded quote *"Not one of the 21 deactivates a `platform_admin`"* (`:128`) | matches `:120` verbatim |
| `145:416` deactivates `admin`, flagged at `00_setup.sql:152` | ✓ `update public.profiles set is_active = false where id = (select admin from k);` · `00_setup:152` `… is_admin = true where id = admin_id` |
| `145:418` seats `claims_for(…, false)` — **no third argument, so NO hat** | ✓ `select test_helpers.claims_for((select admin from k), false);` — two arguments against the live signature `claims_for(p_user uuid, p_is_admin boolean default false, p_active_role text default null)` (`00_setup:404-408`); `p_is_admin = false` keeps `'platform_admin'` out of the role list (`00_setup:422`, `where p_is_admin`) and no third argument pins `active_role` ⇒ the hat cannot be seated |
| `app.is_admin()` requires the hat | ✓ **live catalog**, `pg_get_functiondef`, `prosecdef = true`: `return v_is_admin and (app.active_role() is not distinct from 'platform_admin');` |
| `145`'s only asserted door is `list_my_nsp_hospitals()` | ✓ `:409`, `:421`, `:428`; `145`'s sole `is_admin` occurrence is the comment at `:236` |
| `409` seats the hat at § 3.7, deactivates a different principal | ✓ `409:678` `claims_for((select pa from f409), true, 'platform_admin')` under label `3.7`; `409:711` targets `sa` = `chefe.ccih@test.local`, bound `m.role = 'staff_admin'` at `:66`/`:76` |
| `145:414-425` **is** a reusable fixture shape | ✓ and the description matches the file exactly: `:414-415` unexpire the grant → `:416` `is_active = false` → `:418` seat claims → `:420-422` assert → `:425` `is_active = true` restore |

⭐ **And I re-derived the conclusion on a predicate stronger than D2′'s, because it is the clause that
shapes Batch 10.** The live catalog holds exactly **one** profile with `is_admin = true`
(`…0000b0` = `platform@test.local`); `00_setup:152` flags a **second** inside the harness (the
bootstrap `admin`). I read **every** deactivating/suspending write site in all 21 files and checked
its target:

- the only admin-flagged target anywhere is `145:416`'s `admin` — and no hat is seated there;
- `…0000b0` is **never** a deactivation or suspension target in the suite (`grep -rn "0000000000b0"
  supabase/tests/*.sql` → **29** hits, not one of them on an `is_active`/`suspended_until` write);
- `403_ae45_differential_oracle.sql` — the one file that substitutes an **`is_admin` arm** while
  deactivating principals (`:304`, `:272`, `:592`) — states *and measures* at `:551-554` that no
  fixture principal is a platform admin, and calls it a **BOUND, not a pass**.

⇒ *"no existing cell measures an admin arm under a deactivated admin, so the RED-first cell R3/R12
demand still has to be written"* is **TRUE**, and now for reasons that do not depend on any grep of a
role string.

### N-MAJOR-3 (the hub's `## Current state` stale inside the loop) — **FIXED** (residue: R2-MINOR-2)

Read sentence by sentence against `1d205f64`. **No false sentence.** What I measured:

| hub claim | measured at the tip |
| --- | --- |
| **ADR 0201** (412 lines) and **0203** (337) | ✓ `wc -l` → 412 / 337 |
| all fourteen rulings *"landed in the corpus, not only the log"* — ⚠ a **new universal**, so I tried to kill it | every ruling **R1–R14** has at least one non-log home (0201 · 0203 · the plan · `follow-ups-open.md` and four FUP bodies · `LESSONS.md`/lead-playbook · the arm-3 hub). No counter-example found |
| three register clauses corrected, superseded wording quoted, including a follow-up body's own `Closes when` | ✓ (verified in round 2, unchanged) |
| Item 6's five checklist corrections added, *"measured at 0 of 5 first"* | ✓ `docs/plans/authz-evolution.md:1182-1203`, and the pre-measurement is stated in the block itself |
| both deferred censuses written into their follow-up bodies | ✓ `+64` / `+44` lines on the two FUP bodies |
| `AE5-MATRIX-ARM3-CELLS` hub opened | ✓ |
| three lessons (LEARN-095/096/097), one new rule, one prohibition promoted | ✓ `LESSONS.md:118-120`; `.claude/rules/prosrc-is-not-the-whole-function.md`; lead-playbook on the branch diff |
| the classification-columns FUP filed | ✓ (see N-MINOR-1) |
| lint **0**, typecheck **0** | ✓ re-run bare, both 0 |
| QA history: `CHANGES REQUESTED` (2 BLOCK · 2 MAJOR · 7 MINOR) → (0 BLOCK · 3 MAJOR · 2 MINOR) | ✓ matches both reports |
| § Blockers **None** — *"both QA BLOCKs discharged and verified by QA at `b58549fe`"* | ✓ true; that is round 2's finding |
| § In progress = iteration 2's five findings | ✓ describes the commit it ships with |

The block is **60 lines** — at ADR 0186's cap, gated green. The `**Updated:**` stamp now names the
iteration *and* discloses that the block went stale inside iteration 1, which is the right shape.

### N-MINOR-1 (ADR 0203's present-tense register claim) — **FIXED**

`FUP-AE5-OPENING-ADR-CLASSIFICATION-COLUMNS-OWE-A-NAMED-CONSUMER` exists in
`docs/followups/follow-ups-open.md:1893-1901`, `Status: open`, and its `Closes when` matches
`0203:306-310` clause for clause: a **named runtime consumer inside `authz`** per column, each with a
gate, ⛔ not closed by a test or lint reader, ⛔ not by a later batch's say-so, ⛔ not by removal.
⭐ It is **gate-shaped rather than aspirational**: it borrows `408`'s method (*a function whose
comment-stripped `prosrc` reads it* — `408:80-83` does exactly that for `session_selectable`, with
the `§3` mutation twin at `:133-138`), so the closing condition is checkable by construction.

Its measurements, verified against the **live catalog** (not the migration text):

- `pg_proc` readers of `risk_class` / `resource_kind` / `sensitivity_ceiling` → **0 / 0 / 0**;
- the discrimination control — `resolution_scope_kind` → readers exist, and the three named
  (`authz.has_permission`, `authz.candidate_has_permission`, `authz.explain_permission`) are exactly
  the ones inside `authz`;
- the precedent — `session_selectable` → **`public.assume_role`**, and `0176:45-47` does list four
  no-reader columns, of which `session_selectable` is the fourth beyond D3's three ⇒ the set shrank
  4 → 3;
- `authz.permissions`: `relrowsecurity = t`, **0** policies, no grant to `authenticated`; `authz`
  holds **10** functions, **all** `prosecdef = true` ⇒ *"a consumer must be one of the ten"* holds;
- `src/lib/types/database.ts` contains **0** occurrences of `authz`;
- head pair *"(20261003007360, 525)"* → `max(version) = 20261003007360`, `count = 525`. Exact.

### N-MINOR-2 (eight-vs-five) — **FIXED as to naming** (residue: R2-MINOR-2)

The hub now names rather than counts. The count that remains is the residue below.

---

## Job 2 — did iteration 2 introduce anything new?

I hunted the four shapes named in the scope. **Three of the four came back clean:**

- **Superseded quotes** — both match what they claim to supersede, verbatim (plan item 4's tail
  against `git show`; the follow-up's universal against its `:120`).
- **Anchors added by iteration 2** — all resolve: `00_setup.sql:152` · `:404-408` · `:422` ·
  `145:416` · `145:418` · `145:414-425` · `409 § 3.7` (= `:678-683`) · `409:711` · `401 § 7`
  (= `:369`) and `401:408` (= *"7.3 DISCRIMINATION CONTROL"*) · `401 §§ 11/13` (= `:579`, `:659`) ·
  `410:122-124` (the three columns' value pins) · `0176:45-47`. **No broken anchor.**
- **New universals** — the one new universal (*"all of them landed in the corpus"*) survived an
  attempt to falsify it across all fourteen rulings.

**The fourth shape — an inconsistent figure — came back with three MINOR hits.**

### R2-MINOR-1 — *"Of the 21, exactly two qualify"* is a count its own two rows do not agree on

`FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE.md:138-145`. The stated predicate
is *"deactivates an **admin-flagged** principal, OR one wearing the hat."*

- Read **strictly**, exactly **one** file qualifies — `145`. `409`'s own row concedes its deactivation
  *"targets `sa` … a **different principal**"* from the hatted one, so `409` does not satisfy the
  stated predicate; it is a retained near-miss, which is sound practice but not what the sentence
  says.
- Read **loosely enough to admit `409`** (a file that seats the hat anywhere and deactivates someone),
  `328_dm1_document_substrate.sql` qualifies identically and is **not listed**: `:461` seats
  `claims_for('…0000b0', true)` — the hat, on the sole admin-flagged profile — and `:478` deactivates
  `…0002`, re-seated `staff_admin` at `:479`. On the same loose reading `395:353` and `397:259`
  (each admin-flags one principal while deactivating another) are further near-misses.

**The conclusion is unaffected** — I verified it above on a stronger predicate, and `328`'s cell says
so in its own words (`:465` *"platform_admin reads ZERO documents … no is_admin arm"*, asserted
**before** the deactivation). And the omission does not cost Batch 10 the fixture: `145:414-425` is
already named. ⚠ But `328:477-490` is a **second** reusable shape (claims cleared → deactivate →
assert → reactivate → re-assert, the differential `K5f`/`K5g` pair), which the same *"hides a
reusable fixture"* logic would have wanted disclosed.

**Owed (Record step, one clause):** say that `409` — and `328` — are examined because they seat the
hat *elsewhere in the file*, not because they deactivate a hatted principal; strictly, **one** of the
21 deactivates an admin-flagged principal. ⛔ Not a re-derivation: the sweep is right, the label on it
is not.

### R2-MINOR-2 — the hub's § Next accounting: **four** against an enumeration of **five**, and one named item silently dropped

`docs/features/ae5-opening-adr.md:177-179`: *"⚠ **Four** other named findings were **discharged
inline** rather than filed (the two deferred clauses' censuses, and three lessons)…"*

1. **The parenthetical enumerates five items** (2 censuses + 3 lessons) against the count *four* —
   the identical shape as N-MINOR-2, inside the sentence that fixes N-MINOR-2.
2. ***"discharged inline rather than filed"* reads against the same block**, which four sentences
   earlier says *"Three lessons **filed** (LEARN-095/096/097)"*. Two senses of *filed* in one block.
3. ⚠ **The more consequential half:** the hub's *"four follow-ups still to file"* drops **ADR 0175
   D3's undischarged forward promise**, which the record names twice as owed — `:580` (*"findings this
   batch will FILE, not fix"*) and `:613` (*"filed as a follow-up so it cannot go missing"*). Its only
   present home is an **unchecked box** in another unit's hub
   (`docs/features/ae5-matrix-arm3-cells.md:49-51`). That home is arguably the better one under ADR
   0186, which is why this is MINOR and not a MAJOR — but the hub is what step 4 and the Record step
   read, and it now neither lists the item nor says where it went.

**Owed (Record step):** make the two lists add up, and say in one clause that 0175 D3's promise is
homed in the `AE5-MATRIX-ARM3-CELLS` hub instead of the follow-up register.

### R2-MINOR-3 — the record attributes to this reviewer a count and a method it never stated

`docs/progress/ae5-opening-adr.md:1189-1190`: *"And it verified all **12** anchors the fix loop added
resolve, plus the superseded quotes **byte-for-byte** against `ed80da4c`."*

**Measured:** `docs/reviews/ae5-opening-adr-rereview.md` contains no *"12"*, no anchor count of any
kind, and not the phrase *"byte-for-byte"*. The verification happened; the **figure** and the
**method label** are the record's, not the review's, and are presented as the review's. Small, in the
log rather than the corpus, and flattering rather than misleading — but it is a quoted figure whose
source does not carry it, in the batch whose subject is exactly that. **Owed:** drop the *12* and the
attribution, or cite what the report actually says.

---

## Observations carried, not graded

- **`00_setup.sql:152`'s *"only"* is true only as scoped.** Both the follow-up (`:130`) and the record
  say `admin` is *"the **only** principal `00_setup.sql:152` flags `is_admin = true`"* — true of that
  line. The suite nonetheless runs with a **second** admin-flagged principal, seed
  `platform@test.local` (`…0000b0`, live `profiles.is_admin = true`), which is the confounder that
  would have killed the clause. Naming it — and that **no** deactivation site in the 21 targets it —
  makes the clause airtight rather than merely scoped.
- **The control figure is 3 inside `authz`, 4 unscoped** (`app.can_create_professional` also reads
  `resolution_scope_kind`). The entry names the three `authz` ones and its closing condition is
  `authz`-scoped, so *3* is right; only the words *"the identical query family"* are loose.
- **The superseded D2/D3 text stands live above its correction** (`:91-124`, the universal at `:120`), unmarked at its own
  location, with the dated `⛔ CORRECTION` header immediately below. This is the house pattern and
  distinguishable from N-MAJOR-1 (which orphaned a sentence under a *different* heading), but a
  four-word inline marker at `:120` would remove the last version of that trap from this file.

---

## Bottom line

**Verdict: APPROVED.**

Iteration 2's five findings are fixed; iteration 1's pattern did **not** recur. The one clause that
shapes downstream work — *no existing cell measures an admin arm under a deactivated admin* — I
re-derived independently from the live catalog and every deactivation site in the suite, and it holds
more strongly than the fix claims. Every anchor resolves, both superseded quotes are exact, the hub
describes the tip it ships with, and the register entry ADR 0203 promises now exists with a
gate-shaped closing condition.

What remains is three counts/attributions in prose — R2-MINOR-1, R2-MINOR-2, R2-MINOR-3 — none of
which changes a reader's action and none worth a fourth round on a documentation-only batch. ⭐ They
are named here as **Record-step residue**, and R2-MINOR-2 is the one to fix first, because the hub's
§ Next is what the operator works from.
