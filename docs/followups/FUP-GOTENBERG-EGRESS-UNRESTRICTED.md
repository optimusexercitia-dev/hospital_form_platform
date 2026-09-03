# FUP-GOTENBERG-EGRESS-UNRESTRICTED — the print sidecar's only mitigation is an application-layer allowlist (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 out of PDF·P3 finding C-2.** P3 is the first path that puts
> author-controlled Markdown inside **Gotenberg — a headless Chromium on the server network.**
> `![](https://attacker/beacon)` in a case narrative made that browser issue the GET on every
> prévia and every mint: SSRF reach from inside the private network, a per-render exfiltration
> beacon on a Rule 12 document, and a `content_hash` that depends on a third party.
>
> **The live vector is CLOSED at the application layer** — ADR
> [0145](../decisions/0145-print-path-markdown-is-stricter-than-screen.md) drops `<img>` from the
> print sanitize schema, mutation-proven, and no other render-time fetcher survives on an allowed
> tag. ⛔ **What is missing is the layer below it:** the dev recipe is a bare `docker run` with no
> egress restriction, and the Coolify configuration constrains **inbound only**. So a single
> future change — enabling `rehype-raw`, allowing one more tag, adding a template that emits a
> remote URL — reopens the whole class with **nothing at the network layer to stop it.**
>
> ⚠ **`srcSet` is the concrete instance of that risk, not a hypothetical.**
> `hast-util-sanitize` protocol-filters only `cite`/`href`/`longDesc`/`src`, and
> `defaultSchema.attributes.source` **already** lists `srcSet` while `source` and `picture` are
> **already** allowed tags. Enabling `rehype-raw` **alone** would open it, with no attribute grant
> needed. Assertions pin both facts so a library bump reddens them — but an assertion is not a
> network control.
>
> **PO-DEFERRED 2026-08-25 with the gap named — not closed, not descoped.** The PO chose
> follow-up over in-phase work because the known live vector is already closed and the phase's
> gate-2 re-run is owed; this is defence in depth, and it touches outward-facing infrastructure.
>
> **Owed, in order:** (1) **measure** what the sidecar can actually reach — in dev, and on Coolify
> — rather than assuming either way; a claim about an external system's reachability goes stale
> silently, so the measurement is the deliverable, not the assumption. (2) Deny outbound egress on
> the sidecar in both environments. (3) A positive control proving the denial is real: a template
> that *deliberately* emits a remote URL must fail to fetch it, because a denial that was never
> observed refusing anything is indistinguishable from a misconfigured flag.
