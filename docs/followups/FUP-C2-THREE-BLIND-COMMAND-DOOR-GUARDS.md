# FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS — 3 BLIND from the first 8 measurements; ⭕ **the full sweep then found 40** (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-31 · status open

⭕ **AMENDED 2026-09-02 — the full 171/171 sweep found **40 BLIND**, not 3.** The ID names the
original three and is kept (a rename orphans every name-keyed verdict). They remain the three with
**written keystone designs** → [authz-c2-blind-keystone-designs.md](../design/authz-c2-blind-keystone-designs.md).
⚠ **`cancel_session`'s anchored raise is `HC038`, a STATE guard** — its authorization is `HC039` in a
separate worklist row the mutation never touches, so the intuitive "non-writer gets HC039" keystone
would **not** flip its verdict. Its blindness mechanism is now known: its only pgTAP mention is a
`has_function_privilege` ACL assertion, which reads `pg_proc.proacl` and is *structurally* incapable
of noticing a body mutation (~60 doors share that profile).
⭐ **The other 37 are NOT uniformly distributed** — ⛔ **the rates below are WRONG, corrected
2026-09-04 (ADR 0187 C5); do not re-quote them:** ~~correction workflow 4 of 5 BLIND, interview 6 of
9, versus referral 3 of 16~~. Measured off the findings table against a **40/171 = 23 %** base rate:
correction workflow **6 of 8** (75 %), interview + session **11 of 21** (52 %), referral **4 of 32**
(13 %). Keystone the clusters, not the list — the conclusion holds and is *stronger*.
⚠ **Some share of the 40 will be STATE guards mislabelled as authz** (`HC038`/`HC043`); classify
`HC0*` by property before reading the number as 40 authorization holes.

⛔ **AMENDED 2026-09-04 — three PO rulings and two measurements (ADR
[0187](../decisions/0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md)).**

- **`app.print_source_series` is ruled OUT of the BLIND set** (D3) — a *defensive bound on a walk,
  not an authorization guard*: its only anchored raise (`HC0H4`) fires at supersession-chain depth
  > 1000, unconstructible under `guard_supersession_coherent` + the one-successor unique index, per
  its own body comment. ⛔ **Nobody is to attempt a 1001-row fixture.** **Keystone count 40 → 39.**
- **The 14 remaining doors with no authorization raise in their own body close via state-guard
  keystones carrying an EXPLICIT PROPERTY LABEL** (D2) — recorded as state/lifecycle/validation
  coverage, ⛔ **never** as authorization coverage. **The label is the condition of the closure.**
  (15 measured with no authz raise, less `print_source_series`.) Split of the 39: **12** raise
  `42501`, **13** raise a permission-worded `HC0*`, **14** are state/lifecycle/validation.
- ⛔ **"They remain the three with written keystone designs" is the whole of that document** —
  `authz-c2-blind-keystone-designs.md` is titled *"…the three BLIND command-door guards"* and has
  three door sections. **36 of 39 have no design** (C1); the hub's "designs complete" was false.
  Its §1.2 is also wrong (C6): the `42501` deny arm in `189_nsp_per_hospital_isolation.sql` §9 is on
  `nsp_org_event_rollup` **only** — `nsp_org_roster` is called once on the allow leg (L215), which
  is exactly why it came back BLIND.
- ⭐ **36 of the 40 BLIND doors are ALREADY invoked by the suite**, across 24 test files; only
  `app.assert_ethics_typed`, `public.add_capa_action_evidence`, `public.cancel_event` and
  `public.nsp_org_capa_rollup` have zero references. ⇒ **the work is adding deny legs to files that
  exist**, not writing 39 new tests. ⚠ An existing deny arm is not coverage of the *mutated* raise:
  `public.assign_narrative` has three `HC0F1` `throws_ok` arms and is still BLIND, because the
  harness removes its `42501`.

**Closes when:** PO to rule

**Register line** (folded in from PROGRESS.md at the 2026-09-02 consolidation): 🟠 **FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS** — the new command-door neutralizer's first 8 measurements found **3 BLIND**: `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and ⚠ `public.cancel_session` — which **has** a test that still does not notice its guard vanish (*presence of coverage is not a verdict*). Each needs a keystone; ⛔ **never allowlist a BLIND here** — floor and this arm would then agree while both measure nothing → [design](../design/authz-c2-command-door-neutralizer.md) §8 — backend

> Filed 2026-08-31, from the subset that PROVED
> [`c2-command-door-neutralizer.sh`](../../supabase/tests/mutation/c2-command-door-neutralizer.sh)
> (design: [authz-c2-command-door-neutralizer.md](../design/authz-c2-command-door-neutralizer.md)).
>
> **Measured** against a full-suite baseline of `Files=248, Tests=8289` (PASS), each verdict carrying
> the red-under-mutation / green-restored pair, committed baseline `cksum`-verified untouched:
>
> | enforcer | Tier-1 doors depending | pgTAP files mentioning it | verdict |
> | --- | ---: | ---: | --- |
> | `public.nsp_org_capa_rollup(p_org_id uuid)` | 1 | **0** | BLIND |
> | `public.cancel_event(p_event_id uuid)` | 1 | **0** | BLIND |
> | `public.cancel_session(p_session_id uuid, p_reason text)` | 1 | **1** | BLIND |
>
> ⚠ **`cancel_session` is the one to read twice.** A test file mentions it and the guard still
> vanished unnoticed — *presence of coverage is not a verdict*. The other two are the ordinary
> shape: nothing touches them at all.
>
> ⛔ **The remedy is a keystone per enforcer, never an allowlist entry.** Allowlisting a BLIND here
> would make `ARM=floor` and this arm AGREE — both would then be measuring nothing, and the
> agreement would read as coverage. That is the `allowlisting-a-door-as-e2e-only-is-what-makes-it-blind`
> failure, arriving through a new door.
>
> ⭐ **How these three were found is the reusable part**: candidates were DERIVED by intersecting the
> neutralizer's worklist with `authz-neverclled-door-allowlist.txt` — a door nothing calls cannot
> have anything notice its guard vanish. 3 of 3 predicted BLIND came back BLIND. ⚠ It is a candidate
> GENERATOR, not a predictor: that allowlist's own header records that a deny-only `throws_ok` never
> registers as a call, so never-called doors can still be COVERED.
>
> ⛔ **Scope.** These are 3 of **171** enforcers; **8 have been measured**. This item is about the
> three named rows, and says nothing about the other 163 — the full sweep, and C2 itself, stay open.
