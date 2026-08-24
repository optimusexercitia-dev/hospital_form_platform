# ADR 0141 — Cases board (`manage/cases`) filter redesign: actionable KPIs, saved views, advanced panel

- **Status:** accepted (implemented on `feat/cases-board-redesign`; design handoff in
  `docs/design/temp/case_dashboard_redesign/`)
- **Context:** The per-commission Casos board carried a five-card KPI strip that was
  purely informational, a full-width outcome breakdown panel that consumed a screenful
  above the board, and a single row of filters: six status chips, a native outcome
  `<select>`, and an "Apenas adversos" toggle. Filtering is the chair's most-used
  affordance and it could not express the questions the board is actually read to
  answer — "what is late", "what did this responsável get", "what happened this
  month". The handoff also asked for a KPI a chair can click, and shipped TWO status-
  filter variants with the choice left open as a product decision.
- **Decision:**
  1. **Status filter = the DROP-CHIP variant** (handoff Variant B), not the fixed
     chip row (Variant A). PO decision, 2026-08-24. Variant A costs one click to any
     status and keeps the counts always visible, but it consumes over half the chip row
     before Desfecho/Período/Atrasada appear; the drop-chip keeps the row uniform and
     moves the counts into the popover, where they still answer "how many are in each
     status" before you commit to one.
  2. **KPI cards apply their own filter**, and the strip therefore MOVED from the server
     page into `CasesView`. A card must read whether its filter is applied and write it
     when clicked. Toggle semantics are deliberately asymmetric: clicking an INACTIVE
     card resets every other filter (search excepted) so the headline number and the
     rows beneath it agree; clicking an ACTIVE one clears only its own fields. The card
     VALUES stay derived from the unfiltered row set — a KPI that moved as you filtered
     could never be clicked to "show me those". A new "Fases atrasadas" card replaces
     "Sem responsável", which moves into the advanced panel.
  3. **The board row carries tags and department.** `listCasesBoard` gained two batched,
     RLS-scoped supplementary reads mirroring the existing `fetchBoardCustomFields` /
     case-type pattern: `case_tag_assignments` → `CaseBoardRow.tags`, and the `cases`
     department columns → the LIVE `hospital_departments` name. No migration, no RPC
     change. ⛔ This RETIRES the mapper's "the department name is a detail-page concern;
     default to null" comment — the board's "Unidade / setor" filter and its tag search
     both need them, and an N+1 per row was the only alternative.
  4. **The advanced panel edits a DRAFT and commits on "Aplicar filtros"**, with a live
     preview count in its footer. Six sections applying live would re-render the board on
     every intermediate state and, worse, would leave the user filtered by a half-built
     selection if they dismissed the sheet. Its option lists are derived from the LOADED
     BOARD ROWS rather than from the full vocabulary, so every option shown has a count
     ≥ 1 — an option matching zero rows could only ever produce an empty board.
  5. **Saved views persist in `localStorage`, per commission** — no `user_case_views`
     table. A view is a private scanning habit, not shared governance state, so it earns
     no schema, no RLS surface and no audit row. Stated trade-off: views do not follow
     the user to another device. They are read through `useSyncExternalStore` (server
     snapshot = empty), never an effect, so the SSR/client difference is reconciled by
     React instead of tearing after hydration.
  6. **The action-item KPI card is a LINK, not a filter** — action items are a different
     entity with their own surface. It points at `meus-itens-de-acao` gated on
     `actionItemsEnabled()`, the same flag the shell gates that nav item on; with the
     flag off it renders as a plain card rather than a link the sidebar does not offer.
- **Consequences:**
  - Six E2E specs were updated, none of them because behaviour regressed: they keyed on
    controls that moved (the outcome `<select>`, "Apenas adversos", the status chips) or
    on CLASS-and-TAG hooks into the old DOM (`div.rounded-xl` → `p.font-bold`,
    `p.text-[1.4rem]`) that named how a card was styled rather than what it is. Their
    replacements query by role + accessible name. Two assertions got STRONGER in the
    rewrite: the status filter is now asserted to offer exactly the five fixed statuses
    (it previously sampled one chip), and the "ADVERSO" row marker is matched with
    `exact: true`, which the old `/Adverso/i` + `.first()` could satisfy from the
    header's "adversos" with the marker missing entirely.
  - The board's result count is now a `role="status"` live region — it is the page's
    single `status` landmark, which is both an accessibility fix (every control here
    changes the result set without moving focus) and the only stable handle for the
    count now that KPI sub-lines also read as "N casos".
  - ⚠ **`supabase/seed.sql` carries ZERO `case_tags` and ZERO `hospital_departments`.**
    The panel's Etiquetas and Unidade/setor sections are therefore ABSENT on a freshly
    reset board, and no spec can currently exercise them — an absence that reads exactly
    like a broken read. Both paths were verified by constructing the rows by hand
    (Sentinela on 2 cases → the panel previewed 2; + UTI Adulto → 1; searching the tag
    name "Medicacao" → 1, with a miss control at 0), then removing them by identity.
    Seed coverage is a follow-up for the tester, not something this change added.
