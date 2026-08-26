# 0156 — the door-SQLSTATE gate's domain is a structural property, not a list of names

**Status:** Accepted · 2026-08-26
**Amends:** 0098 (AFF substrate & doors — W3.5 states the SQL↔TS error-arm contract and says pgTAP
`304` §6 "asserts the LIVE kernels raise exactly that set"; it never says which functions *are* the
live kernels, and the implementation answered that with a hand list. This ADR supplies the missing
half — the **domain** the live gate ranges over — and records the two departures and the one
rejected alternative that fix it.)

## Context

ADR 0098 W3.5 made the error-arm contract executable in both directions: `door-error-arms.test.ts`
derives the doors' SQLSTATEs from the migration **files**, and pgTAP `304` §6 asserts the **running**
doors raise exactly the declared set. The second half exists because on this project function bodies
are rewritten at runtime via `pg_get_functiondef` + `replace` + `execute` (ADR 0078 A28), so a
source-to-source comparison structurally cannot see a patched body.

W3.5 specified the *comparison* and left the *domain* unspecified. The implementation filled the gap
with `proname in ('affiliate_person_impl','end_affiliation_impl','update_affiliation_impl')` — three
pre-AFF4 names — and matched raises with `errcode = '([A-Z0-9]{5})'`. Both went green for months. Both
were wrong, and in the two shapes this repo already had a name for:

- a **hand list wearing a label**: the section reported on its own list, not on the domain, so AFF4's
  four new doors and five SQLSTATEs (`HC0R6`–`HC0RA`) were simply absent from it;
- an **enumeration bounded by a syntax rather than a property**: `[A-Z0-9]{5}` is blind to every
  named condition, and 11 live sites raise `check_violation`. This is verbatim the defect ADR 0098
  W3.8 F2 had already had to fix on the *TS* half — it survived on the SQL half because nobody
  re-derived the sibling.

One symptom, two defects: fixing only the list would have gone green and stayed blind to names,
indistinguishable from a real fix. That is the reason this decision is recorded rather than left in a
SQL comment — the domain sentence is now the rule deciding what the gate covers, and a rule that
lives only in the artefact it governs cannot be checked against anything.

## Decision

**D1 — the domain is structural, and nothing in it keys on a name.** As a sentence, it

> **INCLUDES** every `app` function that is `SECURITY DEFINER`, **`VOLATILE`**, executable by
> **neither** `authenticated` **nor** `service_role`, and called by at least one `public` function
> that one of those roles may execute — **together with those calling wrappers**.
> **EXCLUDES** `app` helpers no client-callable wrapper reaches; the `STABLE` read/projection
> helpers behind the same split-ACL shape; trigger functions; and any raise that names no errcode.

**D2 — the two departures from the obvious form are load-bearing, and were measured, not reasoned.**

- **`VOLATILE` is what splits a door from a helper.** Measured on the live catalog it separates the
  set 10/10. Drop it and 10 `STABLE` read/projection helpers enter the domain, dragging in 11 further
  errcode sites that no `toState` mapper is responsible for — the gate would then demand pt-BR arms
  for conditions that never reach a door's error path.
- **`service_role` is named alongside `authenticated` so a `_for`-twin-only door cannot escape.**
  Several kernels are reachable only through a `*_for` wrapper on a service path. Bounding
  reachability on `authenticated` alone would have let those leave the domain silently — the domain
  shrinking is the failure mode a coverage gate cannot report on itself, which is why `304` §6.1
  pins the reverse direction (no `_impl` kernel escapes) rather than trusting the forward one.

**D3 — the rejected alternative, and why it is not merely weaker.** Deriving the kernel from the
wrapper by NAME — `app.<x>_impl` behind `public.<x>` — was rejected. It is not that it is less
elegant: **it would have looked identical on today's catalog and still missed
`public.appoint_technical_director`**, a real door that fronts two kernels and shares a base name
with neither. A name-derived domain fails exactly where a door is interesting, and passes everywhere
it is boring.

**D4 — named conditions normalize by asking Postgres, not by a table.** A caller receives `23514`,
never the word `check_violation`, so a named condition must resolve to the SQLSTATE the client
actually sees. The gate raises the condition and reads the state back. There is therefore no
name→code mapping to go stale and no syntax branch at all; a five-character code passes through the
same path unchanged, and an unrecognised name enters the set as a loud `UNKNOWN:<name>` token rather
than dropping out of it. **Dropping out is the dangerous direction** — it makes the domain shrink
quietly, which is the one movement a green gate cannot distinguish from correctness.

**D5 — the two halves are NOT each other's oracle.** The live half's domain is the whole door family
and is therefore strictly **wider** than the affiliation-only set `door-error-arms.test.ts` derives
from `actions.ts` (it carries the membership-role doors' `HC0G*` and the `23514` they reach through
`check_violation`). Each half must equal **its own** declared set; asserting they equal each other
would red on a correct state. `door-error-arms.test.ts`'s header claimed the equivalence and was
corrected in the same commit — a comment laundering a belief into a fact, in the file whose purpose
is to stop that.

## Consequences

- The live set is now **18 codes over 31 bodies** (`23514`, `42501`, `HC0G0`–`HC0G4`, `HC0R0`–`HC0RA`),
  AFF4's five among them, pinned by name in `304` §6.7. That figure is a **measurement, not a
  contract** — the domain is the contract, and the count moves whenever a door is added.
- **A new door is covered by construction.** Adding an owner-only `VOLATILE` kernel behind a
  client-callable wrapper puts it in the domain with no edit here, which is the property the hand
  list did not have.
- The gate is proven able to fail. Five mutations, each run to completion (planned 44 / ran 44) and
  each restored byte-exact by md5: a changed code applied through the exact runtime-patch threat
  mechanism; an unreachable named-condition raise inside a door the *old* list already covered; an
  unrecognised condition name; a bare raise with no errcode; and a kernel granted to `service_role`.
  Two of the five stayed **green under the old assertion**, which is what isolates the two defects
  from each other rather than asserting they were two.
- **Where it can still be wrong:** the domain is bounded by *reachability from a client-callable
  wrapper*. A door reachable only by some future path that is neither `authenticated` nor
  `service_role` would sit outside it — and, as ADR 0079 has it for the authz arms, a domain nothing
  has ever asked about is not the same as one that came back clean.
