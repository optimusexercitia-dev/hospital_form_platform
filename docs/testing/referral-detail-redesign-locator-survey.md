# Referral Detail Redesign — E2E Locator Impact Survey

Read-only survey. No spec edits, no app code edits. Scope: the Phase 3 rebuild of
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx` (header `<dl>` +
chips removed, "Notas internas" → "Registros internos", `Responsáveis`/`Casos
relacionados` move from the main column to the rail, a new "Detalhes" card added to the
rail). Ground truth for what changes was supplied by the requester and used as a lookup
table, not re-derived — except where noted under "Ground-truth discrepancy" below, which
was verified against the live component source because the survey could not be done
accurately otherwise.

## 1. Coverage denominator

**Files swept (9 — full sweep, every file below was fully searched, not sampled):**

The task named 7 files directly plus "any other file under e2e/ that navigates to the
referral detail route (find with a grep for `encaminhamentos`)". That grep (case-sensitive,
across `e2e/`) returned 8 files; combined with the 7 named files (one of which, below,
the grep did *not* match) the full denominator is 9:

| # | File | Found via | encaminhamentos grep? |
|---|------|-----------|------------------------|
| 1 | `e2e/phase22-referrals.spec.ts` | named | yes |
| 2 | `e2e/phase22-referrals-governance.spec.ts` | named | yes |
| 3 | `e2e/technical-direction-referrals.spec.ts` | named | **no** — see below |
| 4 | `e2e/case-patient.spec.ts` | named | yes |
| 5 | `e2e/patient-index.spec.ts` | named | yes |
| 6 | `e2e/perf-sweep-wave2.spec.ts` | named | yes |
| 7 | `e2e/nsp-per-hospital.spec.ts` | named | yes |
| 8 | `e2e/qob-org-admin-content-wall.spec.ts` | "any other" grep | yes |
| 9 | `e2e/nsp-cross-org-isolation.spec.ts` | "any other" grep | yes |

`technical-direction-referrals.spec.ts` was read in full (230 lines, not sampled)
specifically because it didn't match the `encaminhamentos` grep despite being named in the
task. Finding: it exercises a **structurally different route**,
`/o/[org]/direcao-tecnica/[referralId]` (its own `page.tsx` under
`src/app/o/[org]/direcao-tecnica/[referralId]/`), not
`/o/[org]/c/[commission]/encaminhamentos/[referralId]`. None of its 23 `referral`/`Referral`
occurrences are route paths into the redesigned file, and none of its locators touch any
target string (it asserts on the subject `<h1>`, "Receber"/"Aceitar" buttons, and the DT
inbox heading — none of which the redesign brief touches). Zero hits, and structurally
out of reach of this change, not merely "no hits by luck."

**Target strings searched** (regex alternation per file, case-sensitive, `-n`, run against
each file's full content — not sampled, not restricted to any one locator syntax so that
`getByText`, `getByRole(... {name})`, `getByLabel`, `filter({hasText})`, `toHaveText`,
raw-string variables, and comments were all caught by the same string-content search):

- Tier 1 (distinctive phrases): `Notas internas`, `Registros internos`, `Responsáveis`,
  `Casos relacionados`, `Diálogo`, `Prazo de resposta`, `Motivo da recusa`, `Enviado em`,
  `Criado em`, `Recebidos`, `Enviados`, `saída`, `entrada`, `Detalhes`
- Tier 2 (short/generic words, word-boundary `\b…\b` to cut noise from prose/comments):
  `Origem`, `Enviado`, `Criado`, `Status`, `Prioridade`, `De`, `Para`, `Recebido`,
  `Decidido`, `Concluído`

**Indirection check**: confirmed no spec pulls these labels from a shared constant in
`e2e/helpers/` — grepped the whole `e2e/helpers/` directory for every Tier-1 string
(zero matches), and confirmed `phase22-referrals-governance.spec.ts`'s only local import
is `cachedSignIn` from `./helpers/auth`. All target-string usage in the 9 files is a
literal string in the spec file itself, so the per-file regex sweep is exhaustive — there
is no helper-file indirection this method could have missed.

**No partial sweeps** — every one of the 9 files was searched to completion for every
target string; every non-empty result had its surrounding code read for container-scope
context (not just the matched line) before classification.

**Ground-truth discrepancy found and corrected**: the task's prose describes the deleted
direction chip as "('saída' / 'entrada')". The live label map
(`src/lib/referrals/types.ts` `REFERRAL_DIRECTION_LABELS`) is
`{ incoming: 'Recebidos', outgoing: 'Enviados' }` — the chip never renders "saída" or
"entrada" literally; those words don't appear anywhere in `src/components/referrals/`.
Grepping the gloss instead of the real string would have produced a false negative (missed
the real chip text) and, separately, a false positive (`entrada` substring-matches an
unrelated NSP heading, "Fila de entrada de eventos" — see perf-sweep-wave2.spec.ts:782 in
the table). The sweep below searches the actual rendered strings, `Recebidos`/`Enviados`.

## 2. Summary counts

| Class | Count |
|---|---|
| BREAKS | 6 |
| RE-SCOPED | 0 (see note) |
| AMBIGUITY RISK | 0 currently-broken hits; 3 named forward-looking risks — see §4 |
| SAFE | 20 |
| **Total hits classified** | **26** |

**RE-SCOPED note**: the ground truth explicitly lists `Responsáveis` and `Casos
relacionados` under "text that moves." Both do move columns. But every current spec hit on
either string (`phase22-referrals-governance.spec.ts:880` and `:964`) is a bare, unscoped
`page.getByRole('heading', { name: … })` — nothing chains a `.locator()`/`within` off the
panel's *old* container. Per this survey's own classification rule ("RE-SCOPED —
element survives but moves containers, so a **chained** `.locator()`/`within` scope
changes"), a query with no chain to begin with doesn't meet that bar; it meets SAFE's
second clause instead ("a page-level query unaffected by container moves"). So the
literal count is 0 RE-SCOPED / 2 SAFE-despite-moving. This is not a claim that the column
move is risk-free — see §4, which names both strings as traps regardless of today's zero
count, because the *next* spec written against either panel is not guaranteed to stay
unscoped.

## 3. Table of every hit

Files with **zero hits** after a full sweep (not listed as rows below, since there is
nothing to classify): `case-patient.spec.ts` (one hit was a code *comment* mentioning "the
encaminhamentos hub" at line 963, no locator), `nsp-per-hospital.spec.ts` (navigates to the
detail route at lines 807/860/917/1067 for its own AC-6/AC-7 PHI-reveal and
`dispose_referral_phi` tests, but asserts only the reveal button and dispose-dialog
controls — never a target string), `qob-org-admin-content-wall.spec.ts` (`'encaminhamentos'`
is one entry in a `CUT_ROUTES` slug array at line 187, walked at line 313-321 — it
`.goto()`s the **hub** route with no id and asserts a not-found heading, never reaching the
detail page's body), `nsp-cross-org-isolation.spec.ts` (`/o/rede-b/nsp/encaminhamentos` at
line 105 is a **different** NSP-namespaced route, unrelated to `case_referral`; the
assertion is `res?.status()).toBe(404)` — HTTP status only, no DOM query at all), and
`technical-direction-referrals.spec.ts` (see §1).

| spec:line | Locator expression | Anchors on | Class | Required action |
|---|---|---|---|---|
| `phase22-referrals.spec.ts:451` | comment: `// Hub renders; the "Enviados" section…` | hub-page prose, not a locator | SAFE | None — comment only, describes the hub list, not the detail page. |
| `phase22-referrals.spec.ts:535` | comment: `// The referral appears in "Recebidos"` | hub-page prose, not a locator | SAFE | None — comment only. |
| `phase22-referrals.spec.ts:1378` | `page.getByRole('region', { name: 'Diálogo' })` (R1-1) | preserved heading, region a11y name | SAFE | None. |
| `phase22-referrals.spec.ts:1402` | same pattern (R1-2) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1436` | same pattern (R1-3) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1463` | same pattern (R1-4a) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1484` | same pattern (R1-4b) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1626` | same pattern (R1-7a) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1650` | same pattern (R1-7b) | preserved heading | SAFE | None. |
| `phase22-referrals.spec.ts:1659` | same pattern (**R1-9, keyboard-only flow**) | preserved heading | SAFE | None. |
| `phase22-referrals-governance.spec.ts:521` | `wizard.getByRole('combobox', { name: /Prioridade/ })` (R2-1) | send-wizard field, scoped to `wizard` dialog | SAFE | None — send wizard is a different route/component, untouched by this redesign. |
| `phase22-referrals-governance.spec.ts:524` | `wizard.getByRole('textbox', { name: /Prazo de resposta/ })` (R2-1) | send-wizard field, scoped to `wizard` | SAFE | None — out of scope. |
| `phase22-referrals-governance.spec.ts:553` | `page.getByText(/Prazo de resposta:/i)` (R2-1, on detail page) | header `<dl>` row, unscoped, **colon required** | **BREAKS** | Header row deleted outright. Rewrite against the new Detalhes card once shipped; do not reuse a colon-suffixed regex — the ground truth's bare-word phrasing ("Prazo de resposta", not "Prazo de resposta:") suggests a label/value row split, not inline prose. |
| `phase22-referrals-governance.spec.ts:598` | `page.getByText(/Prazo de resposta:.*vencido/i)` (R2-3) | header `<dl>` row + overdue suffix, unscoped, colon required | **BREAKS** | Same mechanism as line 553; also re-check where the "· vencido" suffix relocates. |
| `phase22-referrals-governance.spec.ts:627` | `dialog.getByLabel(/Motivo da recusa/)` (R2-5) | decline-dialog form label, scoped to `dialog` | SAFE | None — this is `referral-actions.tsx`'s own "Recusar encaminhamento" dialog field, not the page-header banner; untouched by the redesign. |
| `phase22-referrals-governance.spec.ts:635` | `page.getByText(/Motivo da recusa:\s*Informações insuficientes/i)` (R2-5) | standalone decline banner, unscoped, **label+value in one regex** | **BREAKS** | Banner deleted outright per ground truth. A combined label+value regex requires both substrings in one element's flattened text — a dt/dd-style Detalhes row splits them into separate elements, so even a scoped replacement can't reuse this exact pattern; assert label and value as two separate expectations. |
| `phase22-referrals-governance.spec.ts:640` | same pattern, 2nd persona (R2-5) | standalone decline banner, unscoped | **BREAKS** | Same as line 635. |
| `phase22-referrals-governance.spec.ts:658` | `dialog.getByRole('heading', { name: 'Prazo de resposta' })` (R2-6) | SLA dialog's own `DialogTitle`, scoped to `dialog` | SAFE | None — `referral-actions.tsx:1001`'s "Definir/Alterar prazo" dialog title, untouched. |
| `phase22-referrals-governance.spec.ts:663` | `page.getByText(/Prazo de resposta:/i)` (R2-6, after dialog closes) | header `<dl>` row, unscoped, colon required | **BREAKS** | Same mechanism as line 553. |
| `phase22-referrals-governance.spec.ts:880` | `page.getByRole('heading', { name: 'Responsáveis' })` (R4-1) | preserved heading text; panel moves main→rail | SAFE (see RE-SCOPED note, §2) | None today — unscoped role query is unaffected by the column move. Flag for the engineer anyway: see §4 trap. |
| `phase22-referrals-governance.spec.ts:964` | `page.getByRole('heading', { name: 'Casos relacionados' })` (R4-6) | preserved heading text; panel moves main→rail | SAFE (see RE-SCOPED note, §2) | None today — same reasoning as line 880. |
| `phase22-referrals-governance.spec.ts:1048` | `page.getByRole('heading', { name: 'Notas internas' })` (R5-1) | panel heading, **being renamed** | **BREAKS** | Update the expected name to "Registros internos". See §4 trap — do not "fix" this by dropping the role scope for a plain `getByText`, the disclaimer paragraph is a second, unrelated match. |
| `phase22-referrals-governance.spec.ts:1122` | `page.getByRole('region', { name: 'Diálogo' })` (R5-4) | preserved heading, region a11y name | SAFE | None. |
| `phase22-referrals-governance.spec.ts:1152` | same pattern (R5-5) | preserved heading | SAFE | None. |
| `perf-sweep-wave2.spec.ts:624` | comment: `// then split client-side into the "Recebidos"/"Enviados" tables` | hub-page prose, not a locator (the actual test at line 618 navigates to the **hub**, `/o/${ORG_A}/c/ccih/encaminhamentos`, no id) | SAFE | None — comment only, and about the hub's pagination tables, not the detail page. |
| `perf-sweep-wave2.spec.ts:782` | `page.getByRole('heading', { name: /entrada de eventos/i }).first()` | **false positive** — an unrelated NSP "Fila de entrada de eventos" heading; matched only because the sweep (correctly, per the task's instruction) searched the ground truth's informal gloss "entrada" too | SAFE | None — different feature entirely (NSP event queue, not the referral direction chip). Documented here to show the gloss-string search was run and its one hit triaged, not silently dropped. |

## 4. Traps

**Strings that move rather than disappear** (survive, but the ground truth calls these out
by name as ambiguity traps — even though today's specific hits happen to be unscoped and
therefore don't break, see §2):

- **`Responsáveis`** — assignment panel heading, main column → rail
  (`referral-assignment-panel.tsx:126`). Only spec dependency today is the unscoped
  `phase22-referrals-governance.spec.ts:880`, which survives the move untouched. Risk is
  forward-looking: any new assertion that assumes this panel's position relative to
  siblings (DOM order, "renders before the notes panel", a bounding-box check) breaks.
- **`Casos relacionados`** — related-cases panel heading, main column → rail
  (`referral-related-cases-panel.tsx:83`). Same shape as above
  (`phase22-referrals-governance.spec.ts:964`).
- **`Prazo de resposta`** — the sharpest trap in this survey. It currently exists in
  **three independent places** in the rendered app, not one:
  1. the page-header `<dl>` row (`page.tsx:332`, deleted, moves into the new Detalhes card);
  2. `referral-actions.tsx:1001`, the `DialogTitle` of the pre-existing, **untouched**
     "Definir prazo"/"Alterar prazo" SLA dialog (opens on the same detail page);
  3. `referral-send-wizard.tsx:724`/`:1047`, a field label in the (different-route) send
     wizard.
  Only (1) is touched by this redesign, but (2) coexists on the **same page** as whatever
  the new Detalhes card renders. No current spec's unscoped query collides with (2) — the
  one test that opens that dialog (`R2-6`) scopes its dialog check to `dialog.getByRole(…)`
  and only runs the page-level `Prazo de resposta:` check *after* the dialog closes
  (`phase22-referrals-governance.spec.ts:658` vs `:663`). But that is a property of how
  today's spec happens to be sequenced, not a structural guarantee. The moment anyone
  writes a **new**, unscoped `getByText('Prazo de resposta')` (no role restriction, no
  container scope) and runs it while that dialog is open on a referral that already has a
  due date, it will strict-mode-violate on 2 matches (dialog title + Detalhes row). Any
  replacement locator for the BREAKS rows above must be container- or role-scoped from the
  start, not just have its expected text updated.
- **`Motivo da recusa`** — exists in two places: the deleted standalone banner
  (`page.tsx:349-353`, moving into the Detalhes card) and `referral-actions.tsx:550`, the
  untouched "Recusar encaminhamento" dialog's own reason-select label. The current spec
  (`R2-5`) scopes the dialog hit correctly (`dialog.getByLabel(...)`, line 627) and only
  asserts the unscoped page-level text after the dialog has closed and the referral is
  already `rejected` — so no current collision, but the same forward-looking caution as
  above applies once the Detalhes card exists.
- **`Notas internas` → `Registros internos`** — a **false-safety** trap, distinct from the
  others above. The string "Notas internas" occurs **twice** today in
  `referral-internal-notes-panel.tsx`: the `<h2>` (line 101, the one being renamed) *and*
  the disclaimer paragraph (line 110: "Notas internas — visíveis apenas à sua comissão…").
  The ground truth specifies only the **panel heading** renames; it says nothing about the
  disclaimer copy, and this survey has no way to verify the disclaimer's fate from the
  branch as it stands (the new markup doesn't exist yet). Concretely: today's spec
  (`phase22-referrals-governance.spec.ts:1048`) correctly uses
  `getByRole('heading', {name: 'Notas internas'})`, so it cleanly BREAKS (0 matches) once
  the heading renames — good, loud failure. But if whoever fixes it reaches for a
  simpler-looking `page.getByText('Notas internas')` instead of updating the role-scoped
  query to `'Registros internos'`, and the disclaimer paragraph text is untouched, **the
  test will pass again — silently anchored on the disclaimer paragraph instead of the
  heading**. That is a false-positive-passing rewrite, worse than the loud break it would
  replace. Whoever fixes this BREAKS row should keep the `getByRole('heading', …)` scope,
  not loosen it.
- **Direction chip deletion carries zero E2E risk**: despite being explicitly named as
  deleted in the ground truth, no spec in any of the 9 swept files anchors on the chip's
  rendered text (`Recebidos`/`Enviados`) on the **detail** page — the only two occurrences
  of those words in the entire sweep are code comments about the **hub** page's tables
  (`phase22-referrals.spec.ts:451`/`535`, `perf-sweep-wave2.spec.ts:624`). Worth recording
  precisely because it's the one deletion in the ground truth that turned out to be
  E2E-inert — flagging it also prevents anyone from "fixing" a phantom failure here later.

---

## 5. Lead reconciliation — a second, independent sweep

`phase22-referrals-governance.spec.ts` was swept **twice, independently** (this survey, and a
separate agent that read all 1213 lines). The two passes disagreed. Both disagreements are
recorded here rather than resolved by picking a winner, because the divergence is itself the
finding: a single sweep of this file would have shipped an incomplete inventory either way.

### 5.1 MISSED BY §3 — confirmed BREAKS, and a gap in the plan itself

**`phase22-referrals-governance.spec.ts:552`** —
`await expect(page.getByText(r2RequestedAction.label).first()).toBeVisible()`

Verified by hand at the source: the assertion sits after
`waitForURL(/\/encaminhamentos\/[0-9a-f-]+$/)`, so it is a **detail-page** assertion, and its
target is the `ReferralRequestedActionChip` rendered in the header chip tail
(`page.tsx:294–296`). D1 reduces the header to Status + Type chips only, so the chip is
**deleted** — and the Details-card field list in the plan (§ "New components" →
`referral-details-card.tsx`) has **no requested-action row**.

This is therefore **not a locator fix**: the field has nowhere to go. It needs a product
decision — add a "Ação solicitada" row to the Details card, or drop the field from the UI and
retire the assertion. Tracked as an open question on the plan. The sibling hub-page assertion
(R2-2, line ~558 onward) is unaffected; only the detail-page one is homeless.

### 5.2 Classification disagreement — lines 553, 598, 663, 635, 640

| Pass | Class | Reasoning |
|---|---|---|
| §3 (this survey) | **BREAKS** | The *text shape* changes: `getByText(/Prazo de resposta:/i)` needs a literal colon, and `getByText(/Motivo da recusa:\s*…/i)` needs label+value in **one** element. A `dt`/`dd` card row splits them apart and drops the colon. |
| Second sweep | RE-SCOPED (safe) | The queries are page-wide unscoped, so *container* relocation cannot hurt them. |

**The shape-based reading (§3) is the sharper one and should be treated as authoritative**:
being unscoped protects a locator from a container move, but not from the label and value being
split into two elements. The second sweep reasoned only about relocation and missed the split.
Both agree these rows need attention; they disagree only on severity.

⚠ Both classifications are **predictions** — `referral-details-card.tsx` does not exist on this
branch yet. Re-verify all five rows against the real markup once Phase 3 lands, and prefer
scoped replacements (`getByRole`/card-scoped) over unscoped text queries regardless of outcome.

### 5.3 Corrected coverage counts

BREAKS **7** (not 6) — the six in §3 plus line 552. All seven remain in
`phase22-referrals-governance.spec.ts`.
