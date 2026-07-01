# QA Review — Ad-hoc Narratives (add a narrative to an OPEN case)

**Reviewer:** `qa`
**Date:** 2026-07-01
**Scope:** `add_ad_hoc_narrative` RPC + `case_narratives.is_ad_hoc` + server action
`addAdHocNarrative` + dialog / lifecycle button / card chip + `get_case_detail`
provenance field. Plan: `.claude/plans/validated-sprouting-lake.md`.
References: CLAUDE.md, ARCHITECTURE.md (Rules 1, 7, 8, 9, 10, 11), ADR 0032 / 0033 / 0044.

**Verdict:** **APPROVED** (2026-07-01) — all three findings (1 MAJOR, 2 MINOR) resolved
and re-verified against source. No BLOCKER; the security/RLS/immutability/audit posture
is sound and faithful to the ad-hoc-phase precedent.

> **Resolution (2026-07-01, re-verified):**
> - **M1 (MAJOR) — RESOLVED.** New ADR `docs/decisions/0047-ad-hoc-case-narratives.md`
>   records the decision; its decision 1 reverses ADR 0032 D7 **for open cases only**
>   and explicitly keeps remove/reorder out of scope (alternatives § "Widening the
>   reversal … Rejected"). ADR 0032 D7 (L91-92) carries a supersession-in-part note
>   pointing to 0047. Documented and correctly scoped.
> - **M2 (MINOR) — RESOLVED.** `case-narrative-card.tsx:210` now renders the pt-BR
>   `adicional` chip, matching `case-phase-article.tsx:91`. E2E AC-1 assertion updated
>   to `/adicional/i` (`ad-hoc-narratives.spec.ts:217`). Rule 10 satisfied.
> - **M3 (MINOR) — RESOLVED.** `add_ad_hoc_narrative` ON CONFLICT do-update now sets
>   `archived = false` (migration L89, with rationale comment), so an inline reuse of an
>   archived label un-archives it back into the picker. pgTAP `plan(14)` (+2) test 3b
>   archives the type, reuses it by label, and asserts both no-duplicate and
>   `archived → false`.
>
> Original CHANGES-REQUESTED analysis retained below for the trail.

---

## Summary of the audit

The security core is correct. The new RPC is `SECURITY DEFINER` (consistent with the
narrative-write RPC family — `assign_narrative`, `save_narrative_body` — not with the
INVOKER `add_ad_hoc_phase`), and because it bypasses RLS it fully re-derives every
gate itself:

- **Coordinator gate** (`is_staff_admin_of OR is_org_admin_of_commission`) is explicit
  at `add_ad_hoc_narrative` L75 → `42501`. A plain `staff` member is denied
  (pgTAP assertion 6; E2E AC-4).
- **Terminal-case rejection** (`concluido`/`cancelado` → `HC020`) at L70-72, *before*
  type resolution — so the wrong-type/assignee branches can't run on a frozen case
  (pgTAP 7; E2E AC-3 asserts both button-absent and direct-RPC HC020).
- **Assignee-must-be-member** (`is_member_of_for` → `HC021`) at L116 (pgTAP 4).
- **Wrong-commission type** (`commission_id = v_commission` filter → `HC054`) at L93-99
  (pgTAP 5).
- **Vocabulary write is commission-pinned.** The inline `insert … case_narrative_types`
  (L82-88) hard-codes `commission_id = v_commission` (the case's own, DEFINER path), so a
  coordinator cannot write into another commission's vocabulary. `ON CONFLICT
  (commission_id, label)` matches the real unique constraint
  (`case_narrative_types_commission_label_key`, baseline L18731) and reuses the settled
  `create_case_narrative_type` shape.
- **Anon-revoke guard (t19 gotcha):** `REVOKE ALL … FROM public` (L137) precedes the
  `GRANT … TO authenticated`/`service_role` (L138-139). ✓
- **`search_path` pinned** on both functions (`add_ad_hoc_narrative` L51;
  `get_case_detail` L146). No `format()`/`EXECUTE`/dynamic SQL — no injection surface;
  all label handling is parameter-bound + `btrim`. ✓
- **Rule 11 (audit):** the allow-list `v_cols` (L21-22) adds only the structural
  `is_ad_hoc`; `type_label, display_position, is_expected, status, assigned_to` are the
  established set. `body_md` / `title` / `instructions` stay OUT. pgTAP assertion 12
  proves no narrative audit row carries `title`/`instructions`/`body_md` keys nor the
  free-text `Instruções` value.
- **Rule 7:** the add-dialog collects no body; `body_md` is untouched by this path and
  still flows only through the sanitizing editor RPCs. No new raw-HTML surface. ✓
- **Rule 9 / §8 (pt-BR):** the action routes exclusively through the RPC, resolves +
  re-checks the commission (`commissionOfCase` → `authorizeCommission`) for a clean
  pt-BR forbidden, and maps HC020/HC021/HC054/42501 via `mapNarrativeError`; the
  `default` branch returns `MESSAGES.generic` so no raw Postgres error can reach the UI.
- **Consistency with the ad-hoc-PHASE precedent:** `display_position` allocated over the
  phases+narratives UNION (verbatim from `add_ad_hoc_phase` L5729-5736), `is_ad_hoc=true`,
  `status='aberta'`, `is_expected=false`, title-override snapshot rule — all match. The
  `set_config('app.in_narrative_rpc', …)` window is retained per convention (the case is
  open so `guard_case_narrative_frozen` would pass anyway; HC020 is the real authority
  here).
- **Frontend gating:** the "Adicionar narrativa" button + dialog mount only when
  `narrativesEnabled` AND the case `isOpen`, inside a layout that `notFound()`s any
  non-`staff_admin` (`(detail)/layout.tsx` L57, L200). Defense-in-depth over the RPC.
  Empty-vocab inline-create works (button not disabled on `[]`).
- **A11y:** dialog uses wrapping `<label>`, `aria-invalid`, `role="alert"` error nodes,
  keyboard-operable native selects; E2E AC-5 is a full keyboard-only pass with a
  `:focus-visible` assertion. ✓
- **Rule 8 (types):** `database.ts` regenerated; `CaseNarrative.isAdHoc` +
  `mapNarrativeJson` (`cases.ts` L641, defaulting `?? false` for pre-migration
  envelopes) wired through.
- **pgTAP:** `plan(12)` matches 12 assertions.

---

## Findings

### MAJOR

- **M1 — ADR reversal not recorded (required plan deliverable).**
  `docs/decisions/0032-case-narratives.md` decision 7 (L85-89) still reads
  *"Template-fixed per case (no per-case add/remove/reorder in v1)"* with no v2 note,
  and no `0045-ad-hoc-case-narratives.md` exists (0045 is answer-model-v2). The plan
  (lines 162-164) explicitly required either a "v2: ad-hoc per-case narratives" note on
  ADR 0032 reversing decision 7 for open cases, or a new ADR. CLAUDE.md §8 requires a
  short ADR for non-trivial decisions; a new `SECURITY DEFINER` RPC that reverses a
  documented product constraint qualifies.
  **Fix:** append a "v2" subsection to ADR 0032 (or add `0045-…` renumbered to the next
  free ADR id) stating that open cases now allow an ad-hoc per-case narrative append via
  `add_ad_hoc_narrative` (coordinator-only, `is_ad_hoc=true`, `is_expected=false`),
  narrowing decision 7 to "no remove/reorder per case; add allowed on open cases."

### MINOR (cheap — clear before Record per standing preference)

- **M2 — Provenance chip wording diverges from the phase precedent (Rule 10, pt-BR).**
  `case-narrative-card.tsx` L210 renders the chip literal **`Ad-hoc`**, but the
  established phase provenance chip (`case-phase-article.tsx` L91) renders the pt-BR
  **`adicional`**. All user-facing text must be pt-BR and consistent with the sibling
  surface. The plan's "Ad-hoc chip" phrasing was descriptive, not a literal string spec.
  **Fix:** change the narrative chip text to `adicional` to match the phase card (the E2E
  AC-1 assertion `getByText('Ad-hoc', { exact: true })` at L213 must be updated in lockstep
  by the tester — flag to `tester`, do not edit the spec yourself).

- **M3 — Inline create-or-reuse can silently reuse an *archived* narrative type.**
  `add_ad_hoc_narrative` L82-88: `on conflict (commission_id, label) do update set
  label = excluded.label` reuses an existing row without clearing `archived`. If a
  coordinator inline-creates a label that collides with a previously archived type, the
  narrative attaches to (and leaves) an archived type — while the dropdown deliberately
  lists only non-archived types, so the vocabulary appears inconsistent (a "new" type
  that isn't in the picker). Low-impact (snapshot `type_label` is what renders), but
  surprising.
  **Fix (cheap):** add `archived = false` to the `do update set` so an inline reuse
  un-archives the collided type, bringing it back into the picker; or reject the collision
  with a clear pt-BR message. Either is a one-line change. If intentionally deferred,
  note it in the ADR from M1.

---

## Non-issues verified (called out to show they were checked)

- `get_case_detail` is reproduced verbatim from baseline with only `'is_ad_hoc',
  cn.is_ad_hoc` added (L272); the DEFINER access gate, the non-coordinator `case.opened`
  audit read, and `viewer_capabilities` are intact.
- `PG_CHECK_VIOLATION` in `mapNarrativeError` returns `error.message || generic`; the
  only `check_violation` the RPC can raise ("informe o tipo da narrativa") is already
  guarded client-side and is pt-BR regardless — no raw-error leak.
- `guard_case_narrative_frozen` (HC054) never fires on this insert path because the
  RPC's own HC020 terminal check precedes it; the freeze remains correct for the
  editor RPCs.

---

## Re-review checklist for the fix loop

1. ADR 0032 v2 note (or new ADR) present, reversing decision 7 for open-case adds. (M1)
2. Narrative chip literal changed to `adicional`; tester updates E2E AC-1 accordingly. (M2)
3. Archived-type inline-reuse resolved (un-archive on conflict, or documented). (M3)

No code/security changes are required beyond M2/M3; M1 is documentation. Once M1 lands
(and M2/M3 per the standing MINOR-clearing preference), this is **APPROVED**.
