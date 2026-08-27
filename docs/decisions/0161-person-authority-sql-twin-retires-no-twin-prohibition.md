# 0161 — The person-authority SQL twin: ADR 0133 D4's "no SQL twin" is retired

**Status:** Accepted
**Date:** 2026-08-27
**Amends:** 0133
**Context:** AE1.3 (ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) G11 →
[`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § AE1.3 →
[`docs/plans/authz-ae1-person-doors.md`](../plans/authz-ae1-person-doors.md), finding F-C, ruled R2)

## Decision

ADR 0133 **D4's prohibition — "a SQL twin of `personScopeAllows` is deliberately NOT
built" — is retired.** The twin now exists as
**`app.can_administer_person_for(p_capability text, p_user uuid, p_actor uuid) → boolean`**
(migration `20261003004600`; `SECURITY DEFINER`, `STABLE`, owner-only), and it is the
authority on the service-role write path. The TS half (`src/lib/users/person-scope.ts`)
stays as defense in depth and for the pt-BR message.

## Why the prohibition was right then and is wrong now

D4's reasoning was not vague — it was a **premise**, and the premise has become false:

> *"No RLS policy consumes this rule — every affected path is service-role — and a dead DB
> predicate is a standing census/sweep liability forever."*

Both halves changed in AE1.3:

1. **A consumer now exists.** The six `public.<name>_for` person doors
   (`finalize_invited_person`, `update_person_fields`, `set_person_active`,
   `suspend_person`, `upsert_credential`, `delete_credential`) call the predicate from
   their `app.<name>_impl` kernels. It is not dead; it is on the hot path of all nine
   converted write sites.
2. **It is not a sweep liability — it is the opposite.** A `public` `SECURITY DEFINER`
   door returning `void`/`uuid` and granted to `service_role` only is in **NO** authz sweep
   arm's domain (out of `census`: not `bool`; out of `policy`: not `bool`; out of `floor`:
   no `authenticated` EXECUTE; out of `wrapper`: `prosecdef = t`). Lifting the authority
   DECISION into an `app` + `prosecdef` + `boolean` object named with the `^can_` prefix is
   what puts it inside `census`'s live set and `policy`'s predicate domain. The twin is the
   mechanism by which this surface becomes swept at all.

D4 also assumed the rule would remain UI/TS-enforced. That is precisely the exposure
ADR 0155 G11 exists to close: on a service-role path there is no RLS backstop, so a
forgotten gate on a new call path, a wrong `capability` argument, or a future raw
`.from()` write is an unguarded write. The predicate is the backstop.

## What D4 was right about, and what we owe because of it

⚠ **D4's stated risk was real: a mirror is a drift liability.** Building the mirror without
a drift control would accept exactly the liability the prohibition warned about, so
Architecture Rule 3 now genuinely attaches to `personScopeAllows` ↔
`app.can_administer_person_for` and is enforced by a **shared case list**, not by vigilance:

| Artefact | Role |
| --- | --- |
| `src/lib/users/__fixtures__/person-scope-vectors.json` | the single source of truth (32 vectors) |
| `scripts/gen-person-scope-vectors.mjs` | compiles it; stamps the JSON's `sha256` |
| `supabase/tests/vectors/person_scope_vectors.psql` | GENERATED; loaded by pgTAP 384 §9 |
| `src/lib/users/person-scope-vectors.test.ts` | drives the TS half **and** verifies the sha |

Two independently-authored case lists drift in silence because nothing compares them; one
list, consumed by both, cannot. The shape that carries the weight is a person whose
footprint `{H1,H2}` **exceeds** the caller's coverage `{H1}` — a sole-footprint person
satisfies BOTH bounds, so no sole-footprint vector can ever detect an
INTERSECTION/SUBSET swap.

## Consequences

- The **semantics of ADR 0133 are unchanged.** D1–D3, D9, D10, Amendment 1 ruling 1
  (`fields`/`credentials` = INTERSECTION; `cpf_change`/`lifecycle` = SUBSET) and
  Amendment 3 (the CPF grain is "actually changes", not "the key is present") are mirrored
  branch for branch. **Only D4 is retired.** This ADR widens nothing.
- ⛔ The prohibition is removed **in the file that carries it**, not only here. Leaving
  *"a SQL twin is deliberately not built"* in `person-scope.ts` while the twin runs in
  production is the only-the-amending-document-knows-about-the-amendment failure, sited in
  the file most likely to be read by the next author of this rule. That header now states
  the inverted obligation: both halves exist and must not drift.
- ⚠ A `42501` reaching a converted call site means TS and SQL **disagree** — a drift event,
  not a legitimate deny — so it maps to `MESSAGES.generic` and is surfaced, never swallowed.
- `HC0T6` (`registro profissional não encontrado para esta pessoa`) is minted and joins the
  ADR 0156 door-SQLSTATE registry. `HC0T7` (unknown capability, the mirror-drift tripwire)
  is deliberately **outside** that registry: the predicate is `STABLE` and the gate's kernel
  clause requires `provolatile = 'v'`. It is keystoned directly in pgTAP 384 §7 instead.
  ⛔ Do not make the predicate `VOLATILE` to enter that gate — that is shaping a volatility
  marker to game a domain, and it would block the planner from hoisting it.
- ⛔ The predicate must keep the `can_` **name prefix**. The body-based escape hatch
  (`prosrc ~ 'app\.is_|memberships|principal_id'`) would admit it today too, but that is a
  BODY property a refactor can evict silently; a name prefix cannot be refactored away.

## Alternatives rejected

- **Keep D4 and gate only in TS.** This is the status quo ADR 0155 G11 was written to end.
- **Make the doors return `boolean` so they enter the sweeps directly.** A command door
  that returns `true` or raises is a semantic lie, and it would pollute the predicate
  sweep's population with objects that are not predicates. Shaping a return type to enter
  a sweep is the sweep's failure mode, not its use.
- **Mint `app.person_footprint_for` as a separate helper.** It would be in no arm's domain
  (`census`'s set-returning clause needs `authenticated` EXECUTE, which an owner-only helper
  does not have), so it would add an unswept object for no benefit. The footprint is a CTE
  inside the predicate.
- **A separate inviter-authority predicate for the invite flow.** Rejected in favour of
  reordering `registerUser` so affiliation precedes the profile patch. A second authority
  rule in the increment whose whole purpose is to collapse duplicated authority knowledge
  would contradict the programme's own thesis — and the alternative widened `hospital_admin`
  authority over the hospital-less `novato.pendente` class, which cannot be accepted
  silently (ADR 0154).
