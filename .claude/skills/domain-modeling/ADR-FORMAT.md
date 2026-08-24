# ADR Format

> ⛔ **In THIS repo, ADRs live in `docs/decisions/`, NOT `docs/adr/`.** There are 136 of
> them. Creating `docs/adr/` would start a second, parallel decision log that nothing
> reads and no gate covers. Numbering, header shape, and the index step below override
> the generic guidance in the rest of this file.
>
> - **File name:** `docs/decisions/NNNN-kebab-slug.md`.
> - **Number:** take the *next free number* from
>   [`docs/decisions/INDEX.md`](../../../docs/decisions/INDEX.md) — never by eyeballing
>   the directory listing. Two sessions eyeballing it on 2026-07-02 both filed an
>   "ADR 0050"; the collision went unnoticed for seven weeks.
> - **Header block** (between the `# ADR NNNN — Title` H1 and the first `##`) is parsed
>   by `scripts/build-adr-index.mjs`. Give it `**Status:**` and `**Date:**`, and — if the
>   decision changes an earlier ADR — a `**Supersedes:**` or `**Amends:**` label naming
>   the ADR numbers. **That label is the only input to the index's `⚠ Changed by`
>   column**, and it is the one fact the ADR being changed cannot record about itself.
> - **Then run `npm run adr:index`.** `npm run lint:adr-index` (gate 9) reds otherwise.

ADRs use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

## Numbering

Read the **next free number** off `docs/decisions/INDEX.md`, then run `npm run adr:index`
after writing the file. Do not scan the directory by hand — the index computes the number
from the same corpus the gate checks, so the two cannot disagree.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.
