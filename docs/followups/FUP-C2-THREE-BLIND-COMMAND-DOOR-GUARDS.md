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
⭐ **The other 37 are NOT uniformly distributed** — correction workflow **4 of 5** BLIND, interview
**6 of 9**, versus referral **3 of 16**. Keystone the clusters, not the list.
⚠ **Some share of the 40 will be STATE guards mislabelled as authz** (`HC038`/`HC043`); classify
`HC0*` by property before reading the number as 40 authorization holes.

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
