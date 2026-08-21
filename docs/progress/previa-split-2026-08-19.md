# `Imprimir prévia` / `Emitir documento` — the completion narrative (rotated from PROGRESS.md)

**Rotated 2026-08-20**, verbatim apart from the mechanical link repoint, at the DSR Slice 3
headroom pass. The work concluded 2026-08-19: SHIPPED, QA **APPROVED** r2, **merged and
pushed** (`9ed197d5`). It is here because § Now holds live state only and this is finished
work — ⛔ not because it stopped mattering. The binding record lives in ADR
[0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) + ADR
[0126](../decisions/0126-print-series-and-derived-currency.md) (**Amendment 1**, eleven
findings) and the [review](../reviews/previa-split-review.md); this file preserves the
narrative those do not carry.

- **✅ SHIPPED 2026-08-19 — the `Imprimir prévia` / `Emitir documento` split (ADR
  [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) +
  [0126](../decisions/0126-print-series-and-derived-currency.md)).** QA **APPROVED** r2
  ([review](../reviews/previa-split-review.md)). ✅ **MERGED and PUSHED** — merge commit
  `9ed197d5`, verified an ancestor of both `main` and `origin/main` on 2026-08-19; the branch
  `feat/previa-split-adr-0125-0126` no longer exists locally or on the remote. ⚠ *This line read
  "**not merged, not pushed** — awaiting the merge call" until 2026-08-19: a claim about git state
  that went stale silently, in the paragraph a new session reads first.* Gate on a **fresh reset**:
  pgTAP **197f/6520** · seven lint gates · `tsc` · vitest **1447** · E2E **20/20** (six corridor
  cases, zero-leftover query) · **all four authz ARMs HOLD** · full 51-door row sweep ·
  **12 new `prosecdef` gates**, catalog-confirmed, none an INVOKER wrapper.
  **What it does:** a **locked** source yields a registered emission (QR, hash-pinned,
  verifiable); anything still editable yields an **ephemeral prévia** (streamed, no bytes at
  rest, no registry row, its own audit row). **The user never chooses** — and the **door**
  enforces it (`HC0DP` mint, `HC0DV` prévia), not the UI. Prints belong to a **series**, not a
  row; **currency is a third derived axis**, read-time and never stamped.
  ⭐ **Three live defects were found that no ADR anticipated**, each invisible to a green suite
  and each found by reading the **CALLER**: re-minting a reopened ata was **impossible through
  the UI** (`p_source_revision` never passed — D9's own corridor); a **locked source could be
  served as a prévia** (the door had no registration term at all — Rule 1); and the panel
  **promised a permanent verifiable record** above the prévia link.
  ⭐⭐ **The lesson, and it is the build's:** *a keystone proves the DOOR works and says nothing
  about whether the ACTION can reach it — the test is a **second caller**, and a second caller
  can satisfy a door the real one cannot even open.*
  ⚠ **ADR 0126 gained Amendment 1 (eleven findings)** — 2 PO-ruled extensions, **4 corrections
  to claims the ADRs state AS MEASURED**, 4 method rules, 1 live defect on the public page.
  **Residue, carried NOT inherited:** the commission-level cascade path stays open (its sibling
  is closed by measurement, 0125 Am. 1 §C), and `case`/`interview`'s lock/watermark/series
  declarations remain deferred to provider activation (0126 D7).
