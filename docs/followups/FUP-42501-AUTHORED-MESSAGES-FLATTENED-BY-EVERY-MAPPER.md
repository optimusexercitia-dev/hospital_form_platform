# FUP-42501-AUTHORED-MESSAGES-FLATTENED-BY-EVERY-MAPPER — 103 authored pt-BR refusals, and the app layer discards essentially all of them (owner: backend/frontend; filed 2026-08-22, found when a PO-ruled message never reached the UI)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-22 · status open

**How it surfaced.** ADR 0134 Amendment 7 §A7.2 requires `bulk_create_cases` to refuse the
`all_phases` scope **at the gate, with its own pt-BR message naming the scope** — so a delegate is
told *which half to change* instead of being handed a generic "forbidden". The door does exactly
that. `src/lib/cases/bulk-actions.ts` then mapped `42501` to a flat constant and **the message never
reached the user**. Fixed narrowly for that one message (see below); the CLASS is what this item is.

**Measured, both sides.**

*Database side* — distinct `raise exception '<msg>' ... errcode = '42501'` across `public` + `app`,
comment-stripped:
```
DISTINCT = 104   |   bare 'sem permissão' = 1   |   INFORMATIVE = 103
```
Almost every authored `42501` in this schema says something specific — *"apenas a coordenação da
comissão de destino pode atribuir responsáveis"*, *"apenas a coordenação pode abrir uma sessão
reservada"*, and 101 more.

*App side* — modules under `src/lib/**` (excluding tests) that map `42501`: **63**. Modules doing ANY
message recognition rather than returning a flat constant: **2** (`dsr/messages.ts`,
`forms/actions.ts`), plus the pair added by this fix.

⇒ **The answer to "does the mapping flatten every `42501` from every door?" is essentially YES**, and
it is 103 authored sentences wide.

**⛔ WHY THIS IS NOT SIMPLY A BUG TO SWEEP.** The flattening is not careless — it is the only
*safe* default, because **`42501` is the one SQLSTATE whose message cannot be trusted from the code
alone**: Postgres raises it both for an authored refusal AND for its own raw-English
`permission denied for table X`. Passing `42501` messages through wholesale would leak raw English to
the UI and breach CLAUDE.md §8 / Rule 10. That is the same conflation recorded in
`FUP-42501-CONFLATES-GRANT-WITH-RLS`, one layer up: there it makes a TEST unable to say which lock
refused; here it makes the UI unable to say what the user should do differently.

**The shape that works, demonstrated by the fix.** An explicit **recognition list** — not an
allowlist on the code, and not a passthrough: only messages named verbatim survive, everything else
still becomes the generic string. `src/lib/cases/bulk-error-map.ts` does this for one message, and
returns the CANONICAL entry rather than the matched text, so no `linha N:` prefix or Postgres
`CONTEXT:` detail can ride along.

**⚠ The test must have BOTH halves or it tests nothing.** `bulk-error-map.test.ts` asserts the
recognised message survives AND that an unrecognised `42501` (including
`permission denied for table patient_identifiers`) still maps to the generic string. Proven by two
neutralizations with **complementary** red sets: emptying the recognition list reds 4 (the anchor +
the three surfacing tests), converting the mapper to a passthrough reds 4 (the canonical-text and
both unrecognised-`42501` tests). Neither mutation alone reds both halves — which is exactly why
both are needed. ⛔ The first attempt at the emptying mutation **did not actually mutate** (the regex
missed; the suite stayed green) and was caught only by grepping the file for the entry afterwards.
A "9 passed" from a no-op probe is not evidence.

**What to decide (not urgent, but it is 103 messages).** Options, increasing cost: (a) leave it and
extend the recognition list per message as product need arises — cheap, but each one is discovered
by a user hitting a dead end, which is how this one was found; (b) mark authored refusals with a
distinguishable SQLSTATE (an `HC***` in the project's own space) so the existing
`PT_BR_SQLSTATES` allowlist handles them structurally and `42501` stays reserved for real
privilege errors — the cleanest, and it makes the trust question decidable from the code, but it is
a 103-site migration touching live doors; (c) a shared recognition registry generated FROM the
catalog, so the list cannot drift from the doors. ⚠ Under (a) or (c) the standing control is that
every entry must be copied from `pg_get_functiondef` verbatim and pinned, or the list silently
degrades to the generic string — failing exactly as if it were not there, with nothing going red.
