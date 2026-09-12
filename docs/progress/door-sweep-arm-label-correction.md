# DOOR-SWEEP-ARM-LABEL-CORRECTION — progress record

> Hub: [door-sweep-arm-label-correction.md](../features/door-sweep-arm-label-correction.md) ·
> branch `door-sweep-arm-label-correction`, cut from `main @ 8949e491` · closes
> `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED` (owner: lead).

## Session log

### 2026-09-11 — unit opened on the PO's "Let's solve"; the claim re-measured; the three halves of the clause built (lead)

**The ruling, and its scope written down.** The PO opened with *"Let's solve 'The arm-2 marker on
the previous unit's record'"* — read as the instruction to discharge that follow-up's *Closes when*
as written, nothing wider. Its owner is `lead`, its clause is fully docs, and it names its three
halves itself; no ADR is owed (nothing here is a decision — ADR 0079 already names `FROMFINDINGS=1`
as the wrapper arm's knob, and ADR 0105's *"Historical documents are NOT rewritten"* already says
how a record is corrected). Highest ADR on any branch: 0209, untouched.

**The claim re-measured before anything was written — and the entry's own instrument was wrong.**
The follow-up body says *"`grep -c FROMFINDINGS scripts/p0-authz-door-audit.sh` → 0"*. That path
does not exist (the harness lives at `supabase/tests/mutation/`), and on the real file:

```
grep -c  FROMFINDINGS               supabase/tests/mutation/p0-authz-door-audit.sh   -> 6
grep -cE '\$\{?FROMFINDINGS'        supabase/tests/mutation/p0-authz-door-audit.sh   -> 0
grep -n  FROMFINDINGS               supabase/tests/mutation/p0-authz-invariant.sh    -> :35 :82 :107 :323 :324 :346 :800 :801
```

The six door-audit mentions (`:130`, `:139`, `:321`, `:339`, `:563`, `:1917`) are comment lines and
`echo` prose warning that *"a FROMFINDINGS arm does NOT cover this run"*; not one is a READ of the
variable. The invariant script reads it at `:107` (default), `:323` and `:800` (the two `= "1"`
branches). So the FACT the entry states holds — the door audit never reads the knob, and
`FROMFINDINGS=1 CASES=…` is the predicate+policy run again — while the instrument it quotes would,
run literally, have returned a file-not-found and, run on the right file with that pattern, **6**,
which reads as the opposite. ⭐ This is LEARN-088's shape (a prose claim ABOUT a measurement is a
second artefact) landing inside a follow-up whose subject is a mislabel — the correct measurement is
the one `definer-search-path-narrow-fix.md:249-251` actually ran (`grep -cE '\$\{?FROMFINDINGS'`), and
the register entry paraphrased it into a bare `grep -c`. Recorded in the closure note beside the
entry (verbatim body kept), never by editing the filed body.

**What was NOT re-run, and why.** The sweep itself was not re-invoked with and without the knob: the
mechanism (the variable is never read) is decided by the script text alone — the same text the run
would execute — and the prior unit already observed the byte-identical-but-for-`ARM2_RC` pair. A
re-run would have measured the same absence at ~1 min per door for no new information.

**AC-1 — the markers.** `docs/progress/arm3-hat-term-fix.md`: one `⚠ CORRECTION 2026-09-11` blockquote
inserted directly under the fence closing each gate block (the build-session block whose row was at
`:137`, and the re-gate block whose row was at `:424`; the rows themselves are byte-unchanged, and
their line numbers moved by the first insert — cite the blocks, not the numbers). Each marker says:
the row was the predicate arm repeated; the knob's owner and the three read sites; the policy arm's
verdict from the same invocation, quoted from the line the record already carried
(`ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35`, i.e. 0 of 226 selected — a true
empty selection, the migration touches no policy); and the bound that no gate was skipped.

**AC-2 — the recipe.** `docs/lead-playbook.md` §4 gained a dated item after the PRED-DOMAIN pair:
the two door-sweep arms are **predicate** and **policy** from ONE invocation, quoted by `ARM-DOMAIN`;
`FROMFINDINGS=1` is `p0-authz-invariant.sh`'s knob, wrapper arm only; the measurement; the row shape
that is forbidden; and that a policy arm at 0/M is a verdict, not a skipped arm, and says nothing
about the write half. ⚠ CLAUDE.md §6 step 1 already reads *"the authz arms (`census`, `hat`,
`floor`, `FROMFINDINGS=1 wrapper`) … plus the diff-scoped door sweep, both arms"* — consistent with
this, so it was NOT edited (and CLAUDE.md is never edited without asking).

**AC-3 — the ledger row.** `ARM3-HAT-TERM-FIX`'s Build cell: a dated re-reading appended after
*"re-gated after each QA round)"* — "both arms" is TRUE as predicate (1/127, COVERED) + policy (0/226)
of one invocation; the two rows were one run; no verdict changes. Row count and cell count unchanged
(the marker sits inside the existing cell — no `|` introduced).

**AC-5 — register, lesson.** Entry cut from `follow-ups-open.md` and appended to the archive: heading
`+ " — ✅ RESOLVED 2026-09-11"` (the archive's precedent shape), a `> **RESOLVED …**` closure note,
then the body **verbatim** — verified by substring containment of the whole body in the archive and
the heading's absence from the open register (the script printed both `True`). LEARN-104 filed in
`docs/learning/LESSONS.md` (`prose only` — no gate can read a row's label against the script it
names). The memory the lead already held on this shape stays as it was.

**Gates.** Docs-only unit: no migration, no `src/`, no schema. `npm run lint` and
`npm run lint:registers` — see the next entry for the witnesses. ⛔ `test:db`, the authz arms, the
door sweep and `e2e:prod` are NOT owed by a change that touches no code, and are not claimed.
