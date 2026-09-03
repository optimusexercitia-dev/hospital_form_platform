# FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED — the mandated per-phase sweep had a FOUR-part hole: the deriver names ONE arm for a TWO-arm list; arm 2 reports success at exit 0 having measured nothing; 9 policies fall outside both arms; and a killed run leaves an RLS policy WIDE OPEN with nothing reporting it (owner: backend/lead; filed 2026-08-27 by `backend`, all four measured during AE1.5)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> ⭕ **DOWNGRADED 🔴→🟠 2026-08-29 — all four instrument defects FIXED, each fix PROVEN able
> to fire. See § REPAIR at the end of this item.** ⛔ **Deliberately not closed:** Parts 1–4
> were about the apparatus *lying about its own domain*; the nine write policies outside the
> embedded worklist are still **unswept**. The harness now says so out loud, and being told
> is not being covered — that is precisely the distinction this item exists to defend.

> ## PART 1 — the deriver names one arm for a two-arm list
>
> **Measured 2026-08-27.** `scripts/door-sweep-cases.sh` derived **53** cases from AE1.5's
> migration. Handed to the command the deriver itself prints
> (`supabase/tests/mutation/p0-authz-door-audit.sh`), **22 of them matched no gate**:
> *"REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM"*. They were exactly the **non-SELECT**
> policies.
>
> **Cause, from the harness headers rather than inferred:**
> - `p0-authz-door-audit.sh` audits **the READ layer** — *"boolean predicates + SELECT/ALL read
>   policies"*.
> - `p0-authz-writepath-audit.sh` audits **the WRITE layer** — *"the value-returning authz
>   RAISE-GUARDS **and the INSERT/UPDATE/DELETE policies**"* — and its own header states that a
>   `CASES=` run is *"the diff-scoped run CLAUDE.md §6 step 1 mandates EVERY PHASE"*.
>
> ⛔ **The deriver greps `create policy` / `alter policy` without regard to command, so its case
> list spans both arms — but the paste-able command it prints names only the READ harness.** An
> operator who follows the deriver's own output sweeps the read half; the write half goes
> unmeasured. AE1.5's clause census of its own 52: **31 `USING`-only, 8 `WITH CHECK`-only, 13
> both** — the 30/22 split falls straight out of it.
>
> **The fix is PRINT-ONLY and that is what makes it safe:** emit both commands, or split stdout
> by arm. It cannot change *what* is derived, only *what an operator is told to run*. ⚠ Keep
> stdout a bare token list for `CASES=$(...)` composability — if the output is split by arm, the
> arms need separate invocations or a documented key, not two lists concatenated into one.
>
> ⚠ **Why this survived so long:** the read harness *does* report its unmatched cases and
> **refuses to end CLEAN** (exit 3, `UNPROVEN (PARTIAL)`) — which is the only reason AE1.5 saw it
> at all. A phase whose migration happened to alter only SELECT policies would derive a
> fully-matching list and never notice the recipe is half-aimed.
>
> ---
>
> ## ⛔ PART 2 — arm 2 reports SUCCESS at exit 0 having measured NOTHING
>
> **Measured 2026-08-27.** `supabase/tests/mutation/p0-authz-writepath-audit.sh`, run with
> `CASES=` over AE1.5's 52 altered policies, printed:
>
> ```
> BLIND: 0   ERROR(harness): 13   SKIPPED(vacuous): 0   (COVERED = the rest)
> ```
> **and exited 0.**
>
> **It measured ZERO of the requested cases.** Of AE1.5's 22 write-layer cases: **13** were in the
> harness's embedded 33-policy worklist and every one hit the **§7.2 drift tripwire** (the wrap
> changed their `qual`/`with_check` text, so the embedded snapshot no longer matched and the
> harness correctly refused to neutralize); the other **9** are absent from the worklist entirely.
> **COVERED: 0.**
>
> ⛔ **Two defects, and the tripwire is NOT one of them** — refusing to neutralize against a stale
> snapshot is exactly right:
> 1. **The exit code.** 13 `ERROR`s and nothing measured yields **exit 0**. CLAUDE.md §6 says in
>    terms that *"`ERROR` is not a pass"*, and here the exit code says pass. This is the
>    *"a gate that never SETS a non-zero exit"* mechanism.
> 2. **`(COVERED = the rest)`** computes a positive-sounding residual against a set that, on a
>    fully-ERRORed subset run, is **empty** — so the summary line reads like coverage.
>
> ⭐ **The sharpest fact: its sibling already does this correctly.** `p0-authz-door-audit.sh`, in
> the identical situation, exits **3 `UNPROVEN (PARTIAL)`** with *"A clean verdict over a subset of
> what was asked for is the finding this gate exists to prevent. NOT a pass."* **Two harnesses
> meant to be halves of one gate, the same class of shortfall, opposite handling.** Port the door
> audit's PARTIAL/UNPROVEN accounting into the write-path audit rather than inventing a second
> scheme.
>
> ## PART 3 — the harness lies about its own domain, and 9 policies fall in the hole
>
> ⭐⭐ **`p0-authz-writepath-audit.sh` cannot distinguish "I swept your case" from "your case
> is not in my worklist", and reports the second as the first.**
>
> That is worse than Part 2. Exit-0-on-nothing is a bad summary line; **silently dropping
> requested cases and reporting the remainder as the whole** is an instrument that lies about
> its own domain — every consumer of its output inherits a coverage claim it never made.
>
> ⛔ **MEASURED ABSENCE, not an assumption.** The harness was grepped for `never swept`,
> `matched no gate` and `requested but`: **zero hits.** There is no "requested but never
> swept" reporting of any kind.
> A `CASES=` entry that is absent from its embedded 33-policy worklist is **silently ignored**:
> no ERROR, no warning, no mention in the summary. So handing it 52 cases and receiving
> `13 COVERED, exit 0` reads as coverage of **52**.
>
> ⭐ **The harness cannot distinguish "I swept your case" from "your case is not in my
> worklist", and reports the second as though it were the first.** Its sibling
> `p0-authz-door-audit.sh` prints `REQUESTED CASES THAT MATCHED NO GATE IN EITHER ARM` and
> **refuses to end CLEAN** — which is the only reason AE1.5 ever learned these 9 exist.
> Porting that accounting across is the same fix as Part 2 and should land with it.
>
> **THE 9, NAMED INDIVIDUALLY — never as a count, and never in brace shorthand.** A count is
> what let them hide, and brace shorthand is not greppable: someone searching for one of these
> policy names must land on this item.
>
> 1. `answers_insert_targeted` (`answers`, INSERT)
> 2. `answers_update_targeted` (`answers`, UPDATE)
> 3. `case_events_staff_admin_insert` (`case_events`, INSERT)
> 4. `case_events_staff_admin_update` (`case_events`, UPDATE)
> 5. `case_events_staff_admin_delete` (`case_events`, DELETE)
> 6. `case_events_writer_insert` (`case_events`, INSERT)
> 7. `case_events_writer_update` (`case_events`, UPDATE)
> 8. `case_events_writer_delete` (`case_events`, DELETE)
> 9. `responses_update_targeted` (`responses`, UPDATE)
>
> All nine sit in **neither arm's domain**. Pre-existing, **not caused by AE1.5** — it
> **revealed** them by altering policies that happen to fall in the hole. Same family as
> `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2): an apparatus gap, not a defect in the policies.
> ⚠ Bound any fix by the **property** (write-command policies absent from the embedded
> worklist), never by this list — the list is here so a grep lands, not so it can be swept.
>
> ## ⛔ PART 4 — the harness is NOT SAFE TO KILL, and a killed run leaves a gate OPEN
>
> **Measured the hard way, 2026-08-27.** `p0-authz-writepath-audit.sh` (and its door-audit
> sibling) mutate LIVE policies and rely on a `trap … EXIT` to restore them. A run killed
> between "open the gate" and "restore it" does **not** run the trap. AE1.5 killed a
> contaminated run and left **`meeting_cases.meeting_cases_staff_admin_update` at
> `qual=true wc=true`** — a `FOR UPDATE` policy fully open to `authenticated` on the shared
> local stack, with **nothing anywhere reporting it**. Recovered by `supabase db reset`.
>
> ⭐ **It was nearly missed by a count.** The degenerate-policy check returned **11**, of which
> **ten are `qual = true` BY DESIGN** (vocabulary `SELECT` policies: `action_item_statuses`,
> `referral_types`, `reply_outcomes`, `professional_categories`, `pqs_*`, `document_retention`).
> "Is it zero?" returns 11 and reads as a pre-existing baseline. Only ENUMERATING them showed
> the eleventh was an `UPDATE` policy with `wc=true`, which no lookup table has.
>
> **Owed:** either a documented recovery step ("if you kill a run, do X"), or a restore that
> does not depend on a signal-catchable trap. Until then the operational rule is: **a
> contaminated run must be allowed to FINISH and its verdicts discarded — never killed.**
>
> ⛔ **And the contamination surface is the WORKING TREE, not the database.** The baseline is
> the suite's SHAPE (`Files=`/`Tests=`), so **adding a test file invalidates a sweep exactly as
> effectively as touching the DB** — and nothing about doing so looks like DB activity to the
> person doing it. AE1.5 asked its siblings for "DB silence"; that request was insufficient.
> A sibling added one pgTAP file mid-run (+1 file, +62 tests) and every gate after it ERRORed.
>
> ⚠ **Operational note for whoever maintains the worklist:** it embeds exact predicate text, so
> **any** future predicate rewrite — even a provably identity one — drifts it. Regenerate those
> rows **from the live catalog**, never by hand.
>
> ---
>
> ## § REPAIR 2026-08-29 — all four parts, each proven able to fire
>
> ⛔ **Every claim below was measured, not inspected.** A repair to a detector that is only read
> is the same class of artefact as the defect it repairs.
>
> **PART 1 — the arm split (`scripts/door-sweep-cases.sh`, "ruling 4").** The deriver now
> classifies each case by POLICY COMMAND and prints **both** paste-able commands:
> `FOR SELECT` → read arm · `INSERT/UPDATE/DELETE` → write arm · `FOR ALL` or no `FOR` → **both**
> (an ALL policy genuinely IS in both domains — correct, not merely conservative).
> ⭐ **An `ALTER POLICY` does not carry its command in the diff text**, and without help the split
> degenerated to everything-in-both: measured 52/52 on AE1.5, doubling the sweep. `ALTER` cannot
> change a policy's command, so it is resolved from **`pg_policies`** — the one catalog read in a
> script that otherwise derives selection from diff text, legitimate under its own stated rule
> (selection from the diff, CLAIMS from the catalog). It is **optional**: no DB reachable → fall
> back to both arms, announced. ⚠ For a HISTORICAL range the catalog describes HEAD, which is
> stated in the output rather than assumed away.
> ✅ **Cross-check that makes this more than a plausible refactor:** re-run on AE1.5's own
> migration it derives **read 30 / write 27** with **5 in both**. This item independently measured
> **30** read and **22** that matched no read gate. 25 read-only + 22 write-only + 5 both = 52. ✓
> ⛔ **Stated bound: a RAISE-GUARD the phase touched is in NEITHER derived list** — the function
> filter demands `returns boolean` and the write harness's arm 1 is value-returning. The split
> stops the recipe being aimed at one half; it does not make the derivation complete, and the
> output now says so.
> ⚠ STDOUT is unchanged by default (the union), so every existing `CASES=$(...)` caller keeps
> working; `ARM=read` / `ARM=write` is the documented key this item asked for.
>
> **PARTS 2 + 3 — the write harness's accounting.** Ported from the sibling, not re-invented (as
> this item requires): the §7.17 domain gate, the `REQUESTED CASES THAT MATCHED NO GATE` block
> with a per-token catalog diagnostic, the ARM-DOMAIN line, an explicit **COVERED count** in place
> of `(COVERED = the rest)`, and **an exit code where the file previously just ended on an echo**.
> The worklist is now materialised **before** the preflight so an UNPROVEN run costs seconds
> instead of a full suite run.
> ✅ **All four exit paths proven, on the live stack:**
> - `CASES="answers_insert_targeted case_events_writer_delete"` (two of this item's own nine) →
>   **exit 3**, both named, each diagnosed from the catalog as `POLICY public.<t> FOR INSERT|DELETE`.
>   ⭐ **The same input previously exited 0 and mentioned neither.**
> - one real case + one unmatched → **exit 3 UNPROVEN (PARTIAL)**, `SWEPT: 1 COVERED: 1`.
> - one real COVERED case alone → **exit 0 CLEAN**.
> - a known-BLIND policy (`notifications_update_own`) → **exit 1 DIRTY**, reproducing its
>   committed verdict.
>
> **PART 4 — kill safety, in BOTH harnesses.** ⛔ Ported to the door-audit sibling too: this item
> names both, and repairing one of two reads as repairing the class.
> Two layers, because neither alone suffices: (i) `INT`/`TERM`/`HUP` traps, covering Ctrl-C and an
> ordinary `kill`; (ii) a **crash sentinel** holding the restore SQL, written before each gate
> opens and removed only once its restore verifies — it survives SIGKILL, a power cut and a killed
> container, which no trap does. The next run **REFUSES to start (exit 2)** and prints the SQL;
> `RECOVER=1` applies it.
> ⚠ **The sentinel path is FIXED and deliberately NOT under `$WORK`** — the recipe hands out a
> fresh `WORK=…/authz-audit-$(date +%s)` per run, so a `$WORK`-relative sentinel would be invisible
> to the very next run and the check would pass **vacuously**.
> ⛔ **A defect found in this repair, by its own author, before it shipped:** the first version
> cleared the sentinel in the `INFLIGHT=""` **initializer**, which runs *before* the startup check
> — a control deleting its own witness. The sentinel is now dropped at exactly one kind of moment:
> after a restore has been applied.
> ✅ **Proven end-to-end without killing anything** (the standing rule forbids it and it was not
> necessary): a real run was polled and the sentinel **observed mid-run** holding the actual
> restore SQL, then **gone after a clean exit**. Then a policy was genuinely opened to `true` with
> a matching sentinel — the next run **ABORTed exit 2** naming it, `RECOVER=1` **restored** it, and
> the catalog was re-read to confirm: predicate back, `degenerate_NON_SELECT` = **0**.
> ⚠ Verified with this repo's own discriminator, not a count: 10 policies are `qual = true` BY
> DESIGN, so "is it zero?" returns 11 and walks past an open gate.
>
> **Record updated with it:** `.claude/rules/mutation-harnesses-are-not-killable.md` — its
> mechanism sentence ("restores gates from an EXIT trap") had gone false, and no gate can catch a
> rule whose claim goes false. ⚠ It was 2038 bytes against a 2048 cap, so this was a rewrite; the
> volume gate red twice during it. Every qualifier was preserved — the enumerate-never-count
> discriminator, the ~10-by-design figure, "verify, the message is not proof", and the DB-silence
> section — because compressing a record to fit a cap selects against exactly those.

⭐ **PART 3's DOMAIN HALF IS FIXED — 2026-09-02 (`d2069603`).** The write arm was bounded by an
embedded 33-row snapshot whose rows were all `cmd in (INSERT,UPDATE,DELETE)` — a **syntax**, not the
property, and `FOR ALL` is a write command. Live catalog: **107** write-capable policies (62 `ALL` +
17 + 17 + 11), so **74** were reported as *"matched no gate"*. Re-bounded to every `pg_policy` row with
`polcmd <> 'r'`, lifted at run time, in every schema; an `ALL` policy opens its **`with check` half
alone**, because the read arm already opens `using` and opening it here would let a READ keystone earn
a false WRITE `COVERED`. Proven in both directions before use. ⛔ **Parts 1, 2 and 4 are untouched**
(repaired 2026-08-29), and Part 3's own *reporting* half was already done — this closed the domain half
only. ⚠ Consequence recorded: a full write-path sweep now costs **~19 → ~50 min** (120 cases).
