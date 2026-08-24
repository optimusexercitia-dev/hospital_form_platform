# ADR 0139 — Quarterly home for concluded § Now rotations

- **Status:** accepted (PO, 2026-08-24)
- **Amends:** ADR 0124 (the rotation-destination register gains a registered fifth
  category; the contract itself is unchanged)
- **Context:** Concluded § Now bullets — the highest-traffic rotation category in
  August (six rotations in four days) — had no registered destination.
  `now-concluded-2026-08.md` was created ad hoc, and being unregistered it was also
  **absent from `LINK_CHECKED_DOCS`** in `check-progress-doc.mjs`, so the broken-link
  class the gate exists for (474 + 41 measured) was live for exactly this category;
  every rotation into it relied on manual "N of N resolve" prose checks.
- **Decision:** Concluded § Now bullets and narrative fragments rotate **verbatim** to
  `docs/progress/<YYYY>-Q<n>.md`, keyed to the **rotation date** (the day the cut is
  made), not the conclusion date. `lint:progress` link-checks quarterly archives **by
  pattern** (`^\d{4}-Q[1-4]\.md$`) with a zero-match positive control (`2026-Q3.md`
  exists from 2026-08-24 and archives never delete, so an empty match means the
  discovery broke, not that nothing is there). Every other category keeps its
  registered home — phase rows → `phase-ledger.md`, resolved follow-up lines →
  `follow-ups-archive.md`, closed bugs → `bug-log-archive.md` — and per-topic
  narrative files stay per-topic (quarterly consolidation would fragment one
  program's story and orphan name-keyed references). `now-concluded-2026-08.md` is
  **frozen** with a successor pointer and joins the static link-checked list: it has
  inbound references by name **and by line number**, so a rename or merge is lossy.
- **Consequences:** The destination is predictable, and each new quarter is
  gate-covered before its file exists (pattern discovery — no script edit per
  quarter). August 2026 is split across two files by decision, not accident.
  ⚠ Bounded, stated: the gate cannot force a rotation INTO the quarterly file — a
  session can still invent an ad-hoc destination, and a new ad-hoc file is
  indistinguishable from a legitimate per-topic narrative file. That half lives in
  `.claude/rules/progress-contract.md` + lead-playbook §5 — a hint, not a gate — and
  is acceptable because the failure cost is a misplaced archive, not a false green.
