# ADR 0135 — Authored refusals get their own SQLSTATE; `42501` stays reserved

- **Status:** ACCEPTED 2026-08-22 (PO ruling) — ⛔ **DEFERRED the same day, by the PO, to a future
  increment. Nothing may start without an explicit build go.**
  ⭐ **The deferral is a DECISION, not an oversight or an unfinished task.** Recorded explicitly because
  an accepted-but-unbuilt ADR is indistinguishable from a forgotten one after a few weeks, and this one
  will look like dropped work to anyone who finds `FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER`
  still open with a ruling attached. The ruling stands; only the build is postponed.
  ⚠ **The follow-ups it would close stay OPEN and keep their index lines** — they are not discharged by
  being ruled on. Sized below; the size is why it is its own increment.
- **Supersedes:** nothing. **Amends in effect:** the app-layer error-mapping convention.
- **Source follow-ups:** `FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER` (the users' half) and
  `FUP-42501-CONFLATES-GRANT-WITH-RLS` (the tests' half). ⭐ They are **one root, two layers** — the
  same ambiguity, seen from the UI and from pgTAP.

## Context

The database authors informative pt-BR refusals and raises them with `errcode = '42501'`. The app layer
**flattens essentially all of them** to a generic string, and that flattening is **correct as a default**:
Postgres raises `42501` both for an authored refusal *and* for a raw *permission denied for table*, so a
`42501` message **cannot be trusted from the code**. A mapper that surfaced it would eventually leak a
Postgres internal string into a pt-BR UI.

The cost is that every authored refusal is invisible. The trigger for the ruling was ADR 0134
**Amendment 7**'s own `all_phases` gate message — a refusal the PO specifically ruled on — which
**never reached the UI**.

The same ambiguity defeats the test layer independently: `throws_ok(…, '42501')` cannot distinguish an
RLS refusal from a missing grant, so the P0 isolation suite *claims* isolation on 12 tables and
*demonstrates* it on 10 — the other two pass on the **grant**, never reaching RLS.

## Decision

**Authored refusals get their own `HC***` SQLSTATE. `42501` stays reserved for refusals the code did not
author** (raw permission errors, and anything Postgres raises on its own).

Consequences that follow directly:

- A mapper may trust an `HC***` message **unconditionally** and surface it. It never needs a per-message
  allow-list, so there is nothing to drift.
- `throws_ok(…, 'HC***')` becomes a real assertion: it can only pass on a refusal the door authored.
- A test still asserting bare `42501` on an authored refusal **reds**, which is the point — it was
  passing without distinguishing the two locks.

### Rejected alternatives, and why

- **A pinned verbatim allow-list of messages.** Cheapest to start and the only one with a *silent*
  failure mode: an entry must be copied verbatim from `pg_get_functiondef` and pinned, and any drift
  makes it **fail exactly as if absent, with nothing red**. That is the defect class the 2026-08-22
  assertion-integrity work spent a day removing; re-introducing it here was declined.
- **Accept the flattening and route Amendment 7's message another way.** Fixes one message and leaves
  the rest invisible, with no mechanism to make the next one visible.

## Size — measured 2026-08-22, re-derive before building

⛔ **These are the figures that make this an increment rather than a task. Do not quote them at build
time — re-derive.** The tree grows, and this ADR's own predecessor recorded a cost basis that was
**25–45× wrong** when re-measured.

| surface | measured |
| --- | --- |
| code lines referencing `42501` in `app` + `public` routines (comments stripped, from the catalog) | **247** |
| TS modules under `src/lib/` referencing `42501` | **69** |
| pgTAP files referencing `42501` | **118** |
| textual `42501` references in pgTAP | **814** |
| textual `42501` references in `e2e/` | **56** |

⚠ **The test surface is the dominant cost, not the doors** — and it is the half that is easy to miss
when scoping from the follow-up, which is written from the UI's point of view.

## Consequences

- **Blast radius is deliberate.** Hundreds of assertions currently assert `42501` on refusals that will
  become `HC***`. Each red is a place where the old assertion could not tell the two locks apart, so the
  migration of the test surface **is** the delivery of `FUP-42501-CONFLATES-GRANT-WITH-RLS`, not overhead
  attached to it.
- ⛔ **Do NOT fix a red by granting the missing privilege.** Where a test passes today on an absent
  grant rather than on RLS, the correct repair is the **assertion**; widening real protection to make a
  test honest is the recorded anti-pattern.
- **Sequencing is not obvious and must be decided at build-start**, because a door and its assertions
  change in different files: either raise both codes during a transition window, or convert door-by-door
  with its tests in the same commit. The second is preferred — it keeps every commit green — but it
  forbids a single sweeping `replace()` migration.
- **Choose the code range once**, record it here, and give it a header explaining that `42501` is
  *reserved* rather than *deprecated* — the distinction is the whole decision, and a later reader who
  reads it as "we renamed 42501" will start converting the raw permission errors too.
