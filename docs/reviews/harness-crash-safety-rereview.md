# ✅ VERDICT: APPROVED

**Unit:** HARNESS-CRASH-SAFETY (pre-AE5 remediation, Batch 0) — **fix-loop re-review**
**Reviewed commit:** `f8a11a61` on `authz-harness-crash-safety` (clean tree; six commits
`c57f8931 … f8a11a61` since the first review's `6b6aee64`)
**Reviewer:** `qa` · **Date:** 2026-09-04
**Prior report:** `docs/reviews/harness-crash-safety-review.md` (APPROVED, 4 MAJOR / 4 REC) — kept
as history with its own header; this file is the re-review, not an edit of it.

**Disposition:** **all four MAJOR findings are FIXED and each fix is MEASURED**, three of four
RECOMMENDED are fixed and the fourth is filed as a follow-up with a measurable close condition.
All seven §5 re-check items resolve clean. Six new observations, all **RECOMMENDED** (five are
documentation precision, one is a pre-existing two-polarity gap in a disclosure note); **none is
blocking, and none touches a production function, policy, grant, migration or seed** — the scope
diff is still empty, measured.

---

## 0. Method

Every claim is **MEASURED** (with the command) or **INFERRED**. Exit codes read bare on the line
after the command, never through a pipe. Read-only throughout: no harness, no mutation, no reset,
no `test:db`. Catalog queries were read-only `select`s against `supabase_db_azkbbhskturikxpgmafq`
(up 17 min at review time, i.e. freshly reset); the only object any of them created was a CTE.
Documents were read at `f8a11a61` from the clean working tree — `git status --porcelain` was
**empty** at the start and end of this review, so the tree-vs-commit trap that bit §0 of the first
review does not apply here.

---

## 1. Disposition of every first-review finding

| # | Finding | Disposition | Measurement |
|---|---|---|---|
| **F-MAJOR-1** | arm 4a blind to a comment-preceded strand | ✅ **FIXED** | See §1.1 — my read-only simulation now returns **439 / 439 / 0**, and arm 4a's exact shipped query returns `C2ARM4A|0|` on the clean tree, rc 0. |
| **F-MAJOR-2** | `RESET_EVERY` fired 8 destructive resets on a `SUITE=` subset | ✅ **FIXED**, then **re-ruled** (iteration 2) | See §1.2 — `resets_enabled ()` encodes exactly the ruled predicate; set-ness captured before the default; interlock precedes the gate; one predicate read by all three sites; all three documents state the rule in force with iteration 1's correction kept beside it and dated. |
| **F-MAJOR-3** | `BASE_S_OVERRIDE` ungated production surface | ✅ **FIXED** | See §1.3 — honoured only under `SELFTEST=1`, joins the SUBSET disjunct, `FINDINGS` assigned at exactly one site, named in ADR 0189 as **D8**. |
| **F-MAJOR-4(a)** | body-hash clause satisfied by something better, undisclosed | ✅ **FIXED** | Struck + dated `**Amended 2026-09-04 (QA F-MAJOR-4a)**` note in the archive, quoting D1 **verbatim**; mirrored on the hub `:38-43`. |
| **F-MAJOR-4(b)** | two closures rode a `PO to rule` placeholder, undisclosed | ✅ **FIXED** | Both closure notes carry `⚠ **Which Closes when was satisfied (added 2026-09-04, QA F-MAJOR-4b)**` naming the placeholder and quoting the body condition used. |
| **F-REC-1** | both preflight arms failed OPEN | ✅ **FIXED** | `psql_c:97` carries `ON_ERROR_STOP=1`; both arms demand an *answer* and return 2 otherwise; all six other `psql_c` callers enumerated and unharmed. |
| **F-REC-2** | `Tests=8764` vs `8876` inside one unit | ✅ **FIXED** (with one new nit, N1) | Header `:65-71` now reads `Tests=8876` with the settling measurement; the two other files carrying `8764` are left alone. I **agree** they should stand — see §1.7. |
| **F-REC-3** | a report note that goes stale | ✅ **FIXED** | `:822` now reads *"…the sentinel is KEPT **unless the EXIT-trap retry verifies it**…"*. |
| **F-REC-4** | closure deletes the `Closes when:` field | ✅ **FILED** (correctly not fixed here) | `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` — body file present, close condition measurable and proof-of-fire-bearing; gate 13's CODES arm accepts the id. |

### 1.1 F-MAJOR-1 — arm 4a, both conjuncts comment-stripped

**MEASURED.** `c2-command-door-neutralizer.sh:415-416`, both conjuncts:

```sql
and regexp_replace(p.prosrc,'--[^\n]*','','g') ~  '(then|else|begin|loop|;)\s*null\s*;'
and regexp_replace(p.prosrc,'--[^\n]*','','g') !~* 'errcode\s*(=|=>)\s*''(42501|HC0[A-Z0-9]{2})'''
```

Re-run of my read-only simulation (one query; `ANCHOR` and `CLASS` copied byte-for-byte from
`mutate()` at `:557-560`, `SHAPE` from the arm; `new_src = regexp_replace(prosrc, ANCHOR,'null;','gi')`):

```
TOTAL_FNS=1081 STRANDABLE=439 VISIBLE_stripped=439 INVISIBLE_stripped=0
                              VISIBLE_unstripped=438 INVISIBLE_unstripped=1
UNSTRIPPED_BLIND: app.assert_patient_required_fields (oid 26675)      -- exit 0
STRIPPED_BLIND:   (zero rows)
```

Clean-tree control, **arm 4a's exact shipped query**, copied out of `:409-417` and run unmodified:

```
C2ARM4A|0|          rc=0
```

So the hole is closed (1 → 0) and the fix reds nothing clean today. **Both numbers the unit claims
reproduce exactly**, and the one previously-invisible function is the one named.

**Does the record cite an observed fire on a real strand, with the HEAD arm's silence beside it?**
**Yes — MEASURED**, `docs/progress/harness-crash-safety.md:535-560`. The plant is on
`app.assert_patient_required_fields` itself (oid 26675, row 161 of the committed baseline,
COVERED, 5 Tier-1 PHI doors), applied with the production `snapshot()` + `mutate()`, and the
discrimination half is explicit and paired in one table:

| arm | against the strand | rc |
|---|---|---|
| arm 4a **as shipped at HEAD** | `arm 4a: 0 residue shapes …` — *a clean tree reported over an OPEN gate* | **0** |
| arm 4a **with the fix** | `*** PREFLIGHT FAILED (arm 4a) — 1 body/bodies carry THIS harness's residue shape:` / `app.assert_patient_required_fields` | **2** |

⭐ Stronger than I asked for: the record also records the *mechanism* as a measured boolean pair
rather than an argument — `shape_raw / shape_stripped = f / f` pre-plant, `f / t` post-plant. That
is the discrimination reduced to two bits. Restore verified three ways afterwards, plus a
clean-tree negative control on **both** versions of the arm in the same session. This item is
closed to a higher standard than the finding asked for.

### 1.2 F-MAJOR-2 → the iteration-2 rule

**MEASURED, clause by clause, at the line numbers the task names.**

`:723-726`:

```bash
resets_enabled () {   # rc 0 = a reset is allowed on this run; rc 1 = suppressed
  [ "$RESET_EVERY" != "0" ] || return 1
  [ "$SUBSET" != "1" ] || [ "$RESET_EVERY_EXPLICIT" = "1" ]
}
```

That is exactly `RESET_EVERY != 0` **AND** (`SUBSET != 1` **OR** explicitly set) — the ruled
predicate, with no third term and no negation slip. ✅

`:717-718`, set-ness captured **before** the default:

```bash
RESET_EVERY_EXPLICIT=0; [ -n "${RESET_EVERY+x}" ] && RESET_EVERY_EXPLICIT=1
RESET_EVERY="${RESET_EVERY:-20}"   # 0 disables
```

`${RESET_EVERY+x}` is set-ness, not value (it is true for `RESET_EVERY=`, `=0`, `=20` alike), and
it sits one line **above** the `:-20` default. ✅ The file states the reason itself at `:715-716`:
*"SET-NESS, NOT VALUE, and it must be captured BEFORE the default is applied — one line later the
two are indistinguishable, which is exactly the fact this gate turns on."*

**Interlock precedes the gate.** ✅ `periodic_reset` at `:727`: step 1 is the in-flight refusal
`:740-744` (`if [ -s "$INFLIGHT" ] … exit 2`), step 2 is `if ! resets_enabled; then … return 0` at
`:747-753`. The comment at `:736-739` names the reason the order is load-bearing (*"reaching this
point with an armed sentinel is a broken invariant whatever kind of run this is"*), and the record
proves it rather than asserting it — **trial D**: `SUBSET=1`, `RESET_EVERY=1` (i.e. resets now
*permitted*), sentinel armed → `*** refusing to reset with a mutation in flight`, **rc 2**, sentinel
9 bytes unchanged. That is the one trial iteration 2 genuinely needed, and it was taken.

**Same predicate at all three sites.** ✅ `resets_enabled` is called at `:747` (gate), `:892` and
`:900` (retry net) and the banner block reads `RESET_EVERY_EXPLICIT` directly at `:923`. The
scheduled call site `:876` does **not** pre-test the predicate — it calls `periodic_reset`
unconditionally on the modulo, and `periodic_reset` refuses internally and says so. That is the
stated design (*"it lives INSIDE periodic_reset so no call site can forget it"*) and is the safer
composition, because it keeps the in-flight interlock on the path even when the reset is
suppressed.

**The three documents.** All three state the rule in force, each with iteration 1's correction kept
in place and dated — the *amendment-visible* discipline this unit set for itself:

- **C2 header `:37-49`**, quoted: *"⛔ RE-RULED 2026-09-04, LATER THE SAME DAY — the line above is
  kept because it is what was written, and it is now TOO BROAD. THE RULE IN FORCE: a NON-SUBSET run
  resets every RESET_EVERY (default 20); a SUBSET run resets only if RESET_EVERY is set EXPLICITLY
  in the environment (set-ness, not value); `0` disables everywhere."*
- **ADR 0189 D6 `:190-213`**, a boxed block *after* both iteration-1 paragraphs: *"The two
  paragraphs above are left in place because they are what was decided, and the rule they state is
  now **too broad**. … **THE RULE IN FORCE.** A **non-subset** run resets every `RESET_EVERY`
  enforcers (default 20). A **subset** run resets **only when `RESET_EVERY` is set EXPLICITLY in
  the environment** — tested as **set-ness, not value** (`[ -n "${RESET_EVERY+x}" ]`, captured
  *before* the `:-20` default is applied …)."*
- **Archived TAIL-DRIFT closure**, `follow-ups-archive.md:8776-8788`: *"**Correction 2026-09-04,
  later the same day (lead ruling, QA fix loop iteration 2)** — the correction above is left in
  place because it is what was written, and its rule is **too broad**. … **THE RULE IN FORCE:** a
  **non-subset** run resets every `RESET_EVERY` (default 20); a **subset** run resets **only if
  `RESET_EVERY` is set EXPLICITLY** … **`0` disables everywhere**."* ⭐ It also names *why this
  entry in particular* needed the re-rule: the too-broad rule made **this closure's own two
  mechanisms** unreproducible, so its four "Proven able to fire" runs could not be re-checked.

**The two surviving iteration-1 strings at `docs/progress/harness-crash-safety.md:598` and `:644`
are QUOTES, not restatements — MEASURED.** `:598` sits inside a fenced block of harness stdout
under the heading *"End to end, detached"*; `:644` sits inside the fenced `E2E-3` block, as part of
a quoted findings-row note. Both are dated witnesses of what the harness printed on 2026-09-04
iteration 1. Correcting them would falsify a record of a measurement; leaving them is right. ✅

### 1.3 F-MAJOR-3 — `BASE_S_OVERRIDE`

**MEASURED.** Honoured only under `SELFTEST=1` at `:625-633`:

```bash
if [ -n "${BASE_S_OVERRIDE:-}" ]; then
  if [ "$SELFTEST" != "1" ]; then
    echo "    ⛔ BASE_S_OVERRIDE ignored — SELFTEST=1 only"
    echo "       (the true captured shape stands: $BASE_S)"
  else
    … BASE_S="$BASE_S_OVERRIDE"
  fi
fi
```

And it joins the SUBSET disjunct at `:128`:
`if [ -n "$CASES" ] || [ -n "$SUITE" ] || [ "$SELFTEST" = "1" ] || [ -n "${BASE_S_OVERRIDE:-}" ]; then`.

**No path lets it reach the committed findings file — MEASURED by enumerating every assignment.**
`FINDINGS` is assigned at exactly **two** sites, `:129` (scratch) and `:131` (committed), both
inside that one `if/else`; there is no later reassignment anywhere in the 955-line file. `emit`
(`:659`) writes only `$FINDINGS`; the committed path is opened read-only by arm 4b at `:448-452`;
and the EXIT trap `:195` runs `verify_baseline_untouched`, which cksums `$FINDINGS_COMMITTED`
against a value captured at `:133` and FATALs on a change. Three independent interlocks; the
override cannot reach the baseline even if honoured. ✅

**Named in ADR 0189?** ✅ Yes — a dedicated section, **D8 — `BASE_S_OVERRIDE` is a SELF-TEST knob,
and it is interlocked twice** (`:214-233`), which also records the finding's own reasoning back:
*"⛔ A production knob that can falsify a verdict's stated precondition belongs in the decision
record, not only in a header comment — it appeared nowhere in this ADR until QA F-MAJOR-3 said
so."*

### 1.4 F-MAJOR-4(a) and (b)

**(a) MEASURED**, `follow-ups-archive.md`, close condition 1 of the sentinel FUP:

> 1. `restore_inflight` verifies the restore before clearing the sentinel — check `psql_f`'s exit
>    status, and ~~re-verify the function's body hash against `$INFLIGHT.body`~~ — and leaves
>    `$INFLIGHT` **intact** on any failure …
>
>    > **Amended 2026-09-04 (QA F-MAJOR-4a)** — the struck phrase is left in place, struck rather
>    > than rewritten, because it is what was filed; it names the **vacuous** form … ADR 0189 D1
>    > gives the reason in its own words: *"The probe never hashes the local restore file: that
>    > file is what we are trying to apply, so comparing it against itself proves nothing about
>    > the database."*

The quoted sentence is **byte-identical** to ADR 0189 D1 `:81-82`. ✅ Mirrored on the hub at
`docs/features/harness-crash-safety.md:27` (strike) and `:38-43` (the dated note with the same D1
quote). The note also volunteers the sharper fact — *"Both halves of clause 1 were vacuous as
filed"* — which is more than the finding asked for.

**(b) MEASURED.** Both closure notes carry the disclosure, each quoting the body condition used:

- `FUP-AUTHZ-HARNESS-PRECONDITIONS` (`:8639-8648`): *"The register entry's `**Closes when:**` field
  read literally `PO to rule` — the bulk-consolidation placeholder … and **no PO ruling was sought
  or given for this entry**. What was satisfied is the **body file's own** condition, quoted
  verbatim: …"* and closes with the reason the disclosure exists: *"a reader comparing this unit's
  four closures would otherwise infer all four `Closes when` clauses were substantive; two were
  placeholders."*
- `FUP-C2-NEUTRALIZER-TAIL-DRIFT-…` (`:8746-8750`): same shape, quoting *"reset the DB periodically
  inside the sweep (every N enforcers) and re-capture …"*.

### 1.5 F-REC-1 — the preflight arms fail CLOSED

**MEASURED.** `psql_c` at `:97` now carries `-v ON_ERROR_STOP=1`. `preflight_degenerate`
(`:238-263`) captures `rc=$?` **bare** and then `case "$d" in ''|*[!0-9]*) … return 2 ;;` — a
non-empty integer is demanded. `preflight_residue` (`:403-...`) asks for a prefixed tally
(`C2ARM4A|<count>|<names>`) and returns 2 on anything else, with the reason stated at `:406-409`:
*"A list is empty both when the tree is clean and when the query never ran, and this arm used to
read the second as the first."* Both fail CLOSED. ✅

**Other `psql_c` callers enumerated** (all seven call sites, `grep -n 'psql_c'`):

| line | caller | effect of `ON_ERROR_STOP=1` |
|---|---|---|
| `:178` | `restore_inflight`'s live md5 probe | already failed closed (`live=""` ⇒ mismatch ⇒ refuse); unchanged |
| `:240` | `preflight_degenerate` | now fails closed — the fix |
| `:409` | `preflight_residue` | now fails closed — the fix |
| `:493` | `hash_of` | string-compared by callers; an error yields `""`, which every caller already treats as a mismatch |
| `:500` / `:503` | `snapshot` sidecars | `|| return 1` now fires one line **earlier** than the `[ -s … ]` guard that used to catch it — same outcome, sooner |
| `:680` | SELFTEST `DEG` echo | informational only; not read as a verdict |

No caller is harmed and none loses a behaviour. ✅ The record's own regression sweep reaches the
same conclusion by the same enumeration.

### 1.6 F-REC-3

**MEASURED**, `:822`, quoted: `⛔ ROLLBACK FAILED — the gate is left OPEN and the sentinel is KEPT
unless the EXIT-trap retry verifies it ($INFLIGHT); RECOVER=1 or 'supabase db reset --local'`.
That is the wording I suggested, and the code comment above it (`:815-820`) states the mechanism
(`exit 2` → EXIT trap → second `restore_inflight`). ✅

### 1.7 F-REC-2 — and my judgement on the two files left carrying `8764`

**MEASURED.** The C2 header `:65-71` now reads `Tests=8876`, with the settling measurement inline
(`npm run test:db` on a fresh reset: `Files=262, Tests=8876, Result: PASS, 84 wallclock s, exit 0`)
and the corrected `8764` kept visible as the stale half. ✅

`docs/progress/c2-tier1.md` (7 hits) and `docs/reviews/c2-suite-abort-diagnosis.md` (6 hits) still
carry `8764`. **I agree they should stand, and more strongly than the header does** — see N1
below. They are not stale restatements of this tree: `8764` is a **named, dated shape in the C2
lineage**, tabulated in ADR 0188 `:26-32` (*"`8764` | the anchor fix's 6-enforcer subset"*) and in
`docs/progress/c2-tier1.md:1074`. ADR 0188 exists precisely to rule a tally composited across six
suite shapes admissible. Correcting those files would destroy the lineage the ADR depends on.

---

## 2. The first review's §5 re-check list, item by item

| §5 | Item | Result |
|---|---|---|
| **1** | Status consistency on `FUP-AUTHZ-HARNESS-TRANSACTIONAL` (hub / ADR D7 / record / archive) | ✅ **CONSISTENT.** Hub `:47-53` **CLOSED 2026-09-04 BY PO RULING**; ADR 0189 D7 *"closed on the ruling, not left open and not parked"*; archive `:8866` `✅ … RESOLVED 2026-09-04`. **MEASURED:** `grep -n 'stays open\|STAYS OPEN'` over ADR 0189 and the hub returns **nothing** (rc 1) — D7 is a wholly new section, not an append beside a surviving "stays open" sentence. The record's `:350` *"stays open, with the pending ruling written onto…"* is inside the **dated iteration-0 log entry** and is superseded by the later entry at `:403` (*"⛔ The PO's Q2 ruling … is DETECT-ONLY"*) and `:410` (*"CLOSED and rotated"*) — correct append-only log behaviour under ADR 0186 D3, where the hub carries the live state. |
| **2** | No id in two registers | ✅ **MEASURED.** `grep` for all four ids over `follow-ups-open.md` returns **zero** hits; all four appear only in `follow-ups-archive.md`. All four body files are **gone** from `docs/followups/` (directory listing). `npm run lint` **rc 0** on this tree, including `check-docs-registers: OK (… 206 follow-ups, 161 follow-up bodies …)`. |
| **3** | PO ruling quoted verbatim, with its re-open trigger, on the archived entry | ✅ **MEASURED.** The quote appears in ADR 0189 D7 `:241-249` and on the archived entry `:8877-8885`; whitespace-normalised `diff` of the two blocks is **identical** (the only residue was my own extraction artefact). Both carry the re-open trigger — the archive restates it separately as *"**Re-open trigger, in the ruling's own words:** re-open if a harness is ever run against a database with more than one owner."* ⭐ The archive also records that the lead's recommendation was the **opposite** and was *"CONSIDERED AND NOT TAKEN"* — the disclosure that keeps a ruling from later reading as a technical limit. |
| **4** | Cost figure consistent (ADR / header / record) | ✅ **MEASURED.** ADR 0189 Consequences `:305`, the record `:326`/`:444`, and the hub `:86-87` all read **≈ +28 min on a ≈ 9.5 h sweep (≈ +5 %)**, all labelled *measured, not estimated*, all naming the same three components. The C2 header does **not** state a cost figure at all (only the ~9.5 h sweep cost), so there is nothing there to disagree. The ADR bullet additionally states that neither the F-MAJOR-2 correction nor the iteration-2 re-rule touches the figure, *because it is a property of a non-subset 171-enforcer sweep at N=20* — correct, and the right thing to say explicitly. F-REC-2's `Tests=` conflict was **not** propagated into it. |
| **5** | The hub's amendment, and F-MAJOR-4(a) after it | ✅ Both landed. The hub now carries **two** amendment blocks on criterion 1 (F1 for the `nraise` clause, QA F-MAJOR-4a for the body-hash clause) and the body-hash phrase is now struck at `:27`. The finding I said "still stands after it" is closed. |
| **6** | `adrs:` frontmatter — `0184` | ✅ **MEASURED.** Hub frontmatter now reads `adrs: ["0079", "0153", "0171", "0189"]`. `0184` is removed; every listed number is referenced by the unit. `build-features-index: OK (7 hubs; index in sync)`. |
| **7** | Ratchets may only go down | ✅ **MEASURED**, `npm run lint:registers`, **rc 0** read bare: `closesWhenPoToRule=140/147 severityPerEmoji=131/135 severityUnrated=29/29 revisitWhenPoToRule=38/38 longHeadings=93/97 bugsUntriaged=10/10 bugsUnrated=40/40 lessonsProseOnly=52/52` — **identical** to my first review's figures. None raised. |

---

## 3. The remaining task items

**7 — ADR 0189 as a whole.** ✅ `**Status:** proposed` (`:3`). `**Amends:** ADR 0171 · ADR 0153`
**with numbers**, so the generated back-pointers stand. **D3** carries the comment-strip and the
numbers `439 … 438 visible, 1 INVISIBLE … With the strip: 439 / 439 / 0`, plus the clean-tree `0,
enumerated to zero rows` — all four figures reproduce against my query. **D6** states the
iteration-2 rule in its boxed re-rule. **D7** records the PO ruling verbatim, states *"Self-healing
is explicitly not a requirement"* twice (once inside the quote, once as decision point 1), and
carries the re-open trigger as decision point 3. **Considered options** lists the marker as
*"⛔ **BUILDABLE — rejected by PO ruling, not by inability**"*, with both its advantage and its
measured cost.

**Any sentence now false against the code?** I found **none that is false and unmarked**. The two
sentences that *are* false at HEAD — D6's `⛔ A SUBSET RUN NEVER RESETS` paragraph and its
`⚠ Consequence … the retry net is no longer provable on a subset run` — are deliberately preserved
under the boxed correction that opens *"The two paragraphs above are left in place because they are
what was decided, and the rule they state is now too broad"*, which is exactly the
amendment-visible discipline this project requires. Two precision nits only (N5, N6 below), neither
a false statement.

**8 — `.claude/rules/mutation-harnesses-are-not-killable.md`.** ✅ **2032 bytes** (`wc -c`), cap
2048. Re-read clause by clause against `f8a11a61`; **no sentence found false**:
- *"C2 + `p0-authz-{door,writepath}-audit.sh`; ⛔ NOT `p0-authz-{invoker,rowdoor}-audit.sh`"* —
  correct; the two named siblings are untouched by this unit.
- *"Believe a restore only when the CATALOG agrees: psql rc **and** live `md5(pg_get_functiondef)`
  = the snapshot"* — matches `:170` exactly.
- *"A failed restore KEEPS the sentinel; the next run REFUSES, exit 2"* — `:181-192` + `:203-227`.
  The F-REC-3 nuance (an EXIT-trap retry may legitimately clear it) does not falsify it: where the
  retry verifies, the gate is closed and there is nothing to refuse.
- *"without `ON_ERROR_STOP=1` psql returns 0 on a SQL ERROR"* — corroborated twice by measurement
  in the record (`select 1/0;` → 0 before, 3 after).
- *"~10 are `true` BY DESIGN … Discriminator: `cmd <> 'SELECT'` — `degenerate_NON_SELECT` must be
  **0**"* — **MEASURED read-only on the live catalog: `total_degenerate=10 non_select=0`, rc 0.**
- Anchors resolve: `check-rules-staleness: OK (10 rule file(s), anchors + globs resolve)`.

**9 — Scope.** ✅ **MEASURED, rc 0 with empty output:**
`git diff --name-only main...f8a11a61 -- supabase/migrations supabase/seed.sql src`. The full
`main...f8a11a61` name list is **24 files**, every one under `docs/`, `.claude/rules/` or
`supabase/tests/mutation/`; the only scripts are the **three** harnesses
(`c2-command-door-neutralizer.sh`, `p0-authz-door-audit.sh`, `p0-authz-writepath-audit.sh`), and
the two `p0-*` files are unchanged since `6b6aee64`. The diff-scoped door sweep is genuinely **not
owed**. The committed baseline `docs/reviews/c2-command-door-findings.md` is **byte-identical to
`main`** (`git diff --stat` empty; `cksum 1556047199 33473`, the same value the record reports
before and after every run). Arm 4b's committed-findings fallback still parses it: the shipped
`sed` at `:450-451` yields **171** `name<TAB>nraise` rows, so the arm is armed on a normal
checkout, not silently `NOT RUN`.

**10 — `npm run lint`.** ✅ **rc 0**, read bare. `eslint --max-warnings=0`;
`check-progress-doc: OK`; `check-rules-staleness: OK (10 rule file(s))`;
`build-adr-index: OK (187 ADRs indexed, next free 0190)`;
`check-mojibake: OK (3326 tracked text files clean)`; `check-docs-registers: OK`;
`build-features-index: OK (7 hubs; index in sync)`.

**11 — Does any iteration-1 proof rest on a run that never ran?**

**No — and I checked this structurally rather than taking the deviation's word for it.** The hazard
is precise: a launch that dies in under a second with zero bytes on both streams is
indistinguishable from a fast success **only for a witness whose content is an ABSENCE**. So I
partitioned iteration 1's witnesses:

1. **Detached runs.** Every iteration-1 witness labelled *"End to end, detached"* quotes **non-empty
   harness stdout**: F-MAJOR-1 (`*** PREFLIGHT FAILED (arm 4a) … EXIT=2`, record `:552-560`);
   F-MAJOR-2 (`(SUBSET run — NOT resetting: …)` ×2 plus the preconditions banner and `EXIT=1`,
   `:590-604`); F-MAJOR-3 E2E-2 and E2E-3 (`⛔ BASE_S_OVERRIDE ignored — SELFTEST=1 only` and the
   full forced-shape chain, `:634-649`). A launch that produced zero bytes cannot have produced
   those lines. **These runs demonstrably executed.**
2. **Absence-shaped witnesses.** The two categories are (i) the `npx`-stub **marker absent** rows in
   the F-MAJOR-2 trial table and (ii) the F-REC-1 table's `preflight_degenerate` HEAD row,
   `*(silence)* rc 0`. Both come from the **in-process** extracted-and-sourced driver, not from a
   detached launch — and, decisively, **each is paired in the same table with a positive row from
   the same driver in the same session** (trial A `FIRED` beside trial B `absent`; the *fixed*
   `preflight_degenerate` printing its error at rc 2 beside the HEAD silence). A dead driver cannot
   produce the positive half. **The instrument is proven live for every absence claimed.**
3. **The gate table** (`:721-734`) reports enumerations, never bare exit codes — census 581/625, hat
   7/7 + 4, floor 63, wrapper 41, `Files=262, Tests=8876`. All non-empty.

So the failure class is genuinely absent from iteration 1's evidence, and the reason is the pairing
discipline the unit already had, not luck. ⭐ Two further points in the unit's favour: it was
iteration 2's own **empty log** that caught the bad launcher (*"an instrument that produces no
output has not necessarily measured nothing — it may not have run"*), and iteration 1's proofs are
therefore verifiable *because* they were written as quoted output rather than as summary verdicts.
This is the single best illustration in the unit of why the project's "quote the output" convention
is not ceremony. My one residual is recorded in §5 item 3.

---

## 4. New observations from this pass — all RECOMMENDED, none blocking

**N1 — The `Tests=8764` note asserts a universal negative that one grep contradicts.** MEASURED.
`c2-command-door-neutralizer.sh:69-71` reads *"⚠ `docs/progress/c2-tier1.md` and
`docs/reviews/c2-suite-abort-diagnosis.md` also carry 8764. They are dated records of THEIR OWN
runs … but **nobody has re-derived when 8764 was true**, so treat them as unverified."* Somebody
has: **ADR 0188 `:26-32`** tabulates the six suite shapes and dates this one — *"`8764` | the
anchor fix's 6-enforcer subset"* — and `docs/progress/c2-tier1.md:1074` repeats the lineage. The
correct note is therefore stronger, not weaker: `8764` is a *dated shape in a ruled composite*, not
an unverified figure. The conclusion (leave them alone) is right; the reason given is false.
*(Before asserting a universal negative, grep for it.)*

**N2 — The "enumerated rather than assumed" six-hit census does not sum by its parts.** MEASURED.
`docs/progress/harness-crash-safety.md:915` states *"`grep -rn "SUBSET run never resets"
--include=*.md .` returns exactly six hits: three in ADR 0189 D6 (all now under the boxed
correction), one in the hub's `Done since start` (**replaced** in this commit), and those two."* I
re-ran the identical command: **six hits — but 2 in ADR 0189 (`:178`, `:182`), 0 in the hub, and 4
in the record (`:598`, `:644`, and `:911`/`:915` — the sentence's own two self-referential lines)**.
The **total is right**; the **attribution is wrong in three of its four terms**, and the census
does not count itself. Cross-checked against the pre-iteration-2 tree (`d828385c`): 2 + 1 + 2 = 5
there, so the stated breakdown was never true at any commit. Harmless in effect — the substantive
claim (*the two quoted-output strings survive on purpose, none in `docs/reviews/`*) is **correct**,
which I confirmed independently. But a census whose parts do not sum is the shape this project
tracks, and it appears here under the label "enumerated rather than assumed".

**N3 — The retry net discloses "NOT retried" in two of four reset polarities.** MEASURED, `:892-901`:

```bash
if ! resets_enabled && [ "$SUBSET" = "1" ] && [ "$RESET_EVERY" != "0" ]; then
  SW_NOTE="$SW_NOTE (drift-shaped; NOT retried — a SUBSET run resets only when RESET_EVERY is set explicitly)"
elif resets_enabled; then
  … retry …
fi
```

When `RESET_EVERY=0` — **either** `SUBSET` value — the first branch's third conjunct is false and
the `elif` is false, so a drift-shaped ERROR row is recorded with **no row-level note** that no
retry was attempted. The precondition *is* on the summary banner (`resets DISABLED everywhere`,
`:922`), so nothing is misstated; but the row-level disclosure the unit added for one suppression
mode is absent for the other. ⚠ **Not a regression** — the same gap exists verbatim at `8d7f01db`
and at `6b6aee64`, so iteration 2 did not introduce it. A one-clause change (`if ! resets_enabled;
then … note`) would make the disclosure total.

**N4 — Line-number citations in the record's iteration-1 entry have rotted.** MEASURED: the script
was **912 lines** when iteration 1 wrote its citations and is **955** now, so the tail shifted by up
to +43. Spot-checked pairs (cited → actual at `f8a11a61`): `psql_c` ON_ERROR_STOP `:88` → **97**;
`preflight_degenerate`'s answer assert `:229` → **251-255**; `preflight_residue` `:394` → **403/409**;
`BASE_S_OVERRIDE` gate `:616-618` → **625-633** (`:616` is now `BASE_OUT=…`); SUBSET disjunct `:119`
→ **128**; `periodic_reset` `:700` → **727**, step 2 `:718` → **747**; retry net `:863` → **892**;
banner `:886` → **921**; the F-REC-3 note `:788` → **822**; the `psql_c` caller list
`:162/:477/:484/:487/:664` → **178/493/500/503/680**. Iteration 2's own entry (`:838-848`) is
**exact** — I verified `:717`, `:723-726`, `:740`, `:747-753`, `:892-900`, `:921-929` all resolve.
The record is append-only, so rewriting the old entry would be wrong; the fix is one dated line
under the iteration-1 heading saying its line numbers predate iteration 2's shift. ⚠ Note the
prompt for this re-review inherited two of the rotted numbers (`:616-618`, `:394`), which is the
concrete cost.

**N5 — ADR 0189 orders D8 before D7.** Cosmetic. `### D8` is at `:214`, `### D7` at `:235`. A
reader scanning D1→D8 meets them out of order.

**N6 — D5's definition of a subset is now narrower than the code.** `:154-157`: *"A run is a subset
when **either** axis is narrowed — the cases swept **or** the domain swept."* At HEAD the SUBSET
condition has a **third** disjunct that narrows neither axis but *falsifies* one
(`BASE_S_OVERRIDE`), which D8 supplies and D5 does not cross-reference. Not false as written ("when",
not "only when"), but a one-clause pointer from D5 to D8 would prevent a later reader deriving the
condition from D5 alone.

---

## 5. Could not verify

1. **`npm run test:db` — not re-run** (write access to the local stack is out of scope; a suite run
   would also disturb a stack I found freshly reset). F-REC-2's conflict is nonetheless **settled**
   for me by three independent things I could check: the record's own bare-rc measurement, the
   corroborating `Files=262` in ADR 0188's shape table, and the fact that `8764` is a *dated shape
   in a documented lineage* rather than a competing claim about this tree.
2. **The four authz arms and `supabase db reset --local` — not re-run.** The record names what each
   arm **enumerated** (census 581 gates / 625 verdicts · hat 7/7 + 4 allowlisted · floor 63 ·
   wrapper BLIND 41) and states they are identical to the pre-unit baseline. Evidence quality: high.
   ⚠ Unchanged from the first review: I cannot confirm the arms ran on a reset *fresh relative to
   the plants*, only that the record says the gate reset preceded them.
3. **Which two launches died in iteration 2 — the record does not enumerate them.** Deviation 1
   says *"Two launches died in under a second with zero bytes on both streams"* without naming
   them or when. I could not check that claim directly. I substituted the structural argument in
   §3 item 11, which does not depend on it. ⚠ For any future session: a dead-launch disclosure is
   most useful when it names the runs, because the reader's real question is *"which recorded
   witness might be affected?"*.
4. **No harness was run** (prohibited, correctly). Every harness behaviour above is derived from
   the shipped script text plus read-only catalog queries.
5. **Arm 4b's `NOT RUN` branch is still unproven** — unchanged, and the unit says so in three
   places (hub Blockers `:118-120`, record `:769-771`, ADR D3). I re-confirmed the code path exists
   (`:457-460`) and fails to `NOT RUN` rather than to "clean". **INFERRED, not measured.**
6. **No full 171-enforcer sweep was ever run** — unchanged. Every run in both iterations was
   `CASES=`- or `SUITE=`-narrowed. The ≈ +28 min / +5 % figure remains arithmetic over measured
   components, which is sound; the end-to-end behaviour of eight real resets across ~9.5 h is
   **projected, not observed**.
7. **My own read-only simulation is a simulation.** It applies `mutate()`'s anchor to `prosrc`
   rather than round-tripping a `CREATE OR REPLACE` through the catalog, so it is evidence about the
   arm's predicate over the rewritten body text — not about `mutate()`'s DDL. That last mile is
   covered by the record's *real* plant on `app.assert_patient_required_fields`, which used the
   production `snapshot()` + `mutate()` and is the stronger witness of the two.

---

## 6. Disposition for the PO

**Is the unit ready for approval and the Record step? Yes.**

All four MAJOR findings are closed, and — this is the part worth noting — **every one is closed by
a measurement, not by an edit**. F-MAJOR-1 was fixed *and* the fix was proven by planting a real
strand on the exact function the finding named, with the pre-fix arm's silence recorded beside the
post-fix arm's rc 2 in the same table; that pairing is the discrimination half a negative control
cannot supply, and it is the difference between "the query changed" and "the detector now sees what
it was blind to". F-MAJOR-2 was fixed, then **re-ruled by the lead** when the first fix proved too
broad — and the re-rule was taken for the right reason: iteration 1's own disclosure said the gate
had made the periodic reset and the retry net provable only by a ~9.5-hour sweep, which is how a
live mechanism quietly becomes an unexercised one. The iteration-2 predicate is a single
`resets_enabled ()` read by all three sites, set-ness captured before the default, and the in-flight
interlock still ahead of the gate — proven by the one trial that mattered (armed sentinel, resets
*permitted*, rc 2, sentinel byte-unchanged). Every superseded sentence in all three documents is
kept in place with a dated correction beneath it, and the two iteration-1 strings that survive are
**quoted run output**, correctly left alone. Documentation discipline in this unit remains the best
I have reviewed on this project.

**Is it safe to run the Batch 1–3 full sweeps? Yes — and the two conditions I attached last time
are both discharged.** Arm 4a's third-layer blind spot is closed and measured 1 → 0 with no
clean-tree false positive; and the reset semantics are now explicit in four announced polarities,
so nobody running a `SUITE=` spike gets an unasked `supabase db reset --local` — while an operator
who *types* `RESET_EVERY=` still gets one, which is what keeps the retry net provable without a
9.5-hour run. The scope diff is empty, measured twice, so no door sweep is owed and no production
surface is at risk. My remaining six observations are documentation precision and one pre-existing
disclosure gap; **fix them at the Record step, not before the sweeps.**

**Two Record-step items for the lead**, neither a review finding: the hub's `reviews:` frontmatter
is still `[]`, so **both** this report and the first one need linking; and ADR 0189 stays
`**Status:** proposed` pending PO approval, as the unit intends.

**What this unit explicitly does not prove.**

- **No self-healing — by PO ruling, not by shortfall.** Process death can still leave an
  authorization gate open. The guarantee is only that it cannot do so *unnoticed*. The ruling's
  re-open trigger rides on the archived entry and is a premise that can go stale: *"re-open if a
  harness is ever run against a database with more than one owner."*
- **`p0-authz-invoker-audit.sh` and `p0-authz-rowdoor-audit.sh` have no sentinel at all** and are
  untouched. A kill during either still leaves an open gate with no record anywhere. Correctly
  scoped out, filed, and named in the rule file.
- **Arm 4b's `NOT RUN` branch is two unexercised `echo` lines.** Reasoned, not measured.
- **No full sweep has ever been run**, so the long-run behaviour — eight real resets, ~9.5 h,
  tail drift actually bounded in practice — is projected from measured parts.
- **Nothing here is a production-code claim.** There is no migration, policy, grant, RPC or `src/`
  change in this unit, so it holds no RLS, immutability or PHI-isolation risk to report.
