# Question Editor Dialog — Layout Refactor Spec

A **layout refactor of the existing `ItemEditorDialog`** (the add/edit-a-block dialog). It reorganizes
the presentation to be less cluttered and less tall; it does **not** change the data model, the server
actions, validation, or the hidden-field contract. Treat this as "same component, new arrangement."

The reference implementation shown to the team is `Question Dialog.html` (the `multiple_choice` case).
This document targets the real component and its stack (Next.js, shadcn/ui, Tailwind).

**The three moves that fix the clutter**
1. **Score + analytics-code are progressively disclosed** — hidden behind a toggle in the options
   header (most questions don't score), so the default view is clean.
2. **Two conceptual groups** — left **Conteúdo** (what the question *is*), right **Comportamento** (how
   it *behaves*), which roughly halves the dialog height. Header and footer become sticky; only the
   body scrolls.

---

## 0. What must NOT change (preserve exactly)

Refactor the JSX arrangement only. Keep all of the following byte-for-byte in behavior:

- `useActionState(action, undefined)` with `action = mode === "edit" ? updateItem : addItem`, the
  single `<form action={formAction} noValidate>`, and the routing hidden fields (`itemId` in edit;
  `sectionId` + `itemType` in add).
- **The options → hidden-fields sync**: the parallel `optionCode` / `option` / `optionColor` /
  `optionScore` / `optionAnalyticsCode` inputs emitted per `cleanOptions` entry at the **same index**,
  including the option-**code preservation** semantics (existing option carries its stable `code`;
  new rows mint a code on first label keystroke — BUG-AMV2-002; server still backfills empty codes).
- `configMin` / `configMax`, `defaultValue` (JSON string), `markdown`, `storagePath` / `caption` /
  `alt`, and `visibleWhen` (JSON) hidden fields, emitted under the same conditions as today.
- `effectiveDefaultValue` (the `useMemo` that prunes a default value whose option code was removed),
  `initialDefaultValue`, `supportsDefaultValue`, and the `cleanOptions` filter.
- **The "conditional ⇒ never required" rule**: `isConditional = visibleWhen !== null` disables the
  required control and shows the note.
- **Image upload blocks submit**: `imageUploading` disables the submit button.
- Validation surfacing: `state.fieldErrors.label` / `.alt`, the non-field `FormBanner`, and the
  `Field` / `FieldLabel` / `FieldError` / `FieldDescription` / `useFieldIds` a11y wiring (ids,
  `aria-describedby`, error links).
- The success effect (`state.ok` → `onOpenChange(false)` + `router.refresh()`).
- **All Portuguese copy** and the submit-label states (`Salvando…` / `Enviando imagem…` / `Salvar` /
  `Adicionar`).
- The per-type dispatch: which editors render for which `itemType` (choice → options; number/date →
  min/max; `section_text` → `SectionTextEditor`; `image` → `ImageItemEditor`; etc.).

If a change below appears to conflict with one of these, the item above wins — keep the wiring, restyle
the container.

---

## 1. Dialog shell

```
┌─ DialogContent (max-w-4xl for input/choice · max-w-xl for section_text/image) ─┐
│ HEADER  (sticky)   [◧ type-icon]  Múltipla escolha / Editar…        [×]        │
│                    description                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ BODY  (overflow-y-auto, max-h-[85vh])                                          │
│   CONTEÚDO ─────────────────────      │  COMPORTAMENTO ──────────────────      │
│   Enunciado · Opções · Texto apoio    │  (muted panel)  Valor · Obrigatória ·  │
│   (+ Limites for number/date)         │  Aparência condicional                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER  (sticky)   N opções · condicional        [Cancelar]  [Adicionar]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Width**: widen `DialogContent` to `max-w-4xl` for the two-column types (`INPUT_TYPES`). Keep it
  narrow (`max-w-xl`) and single-column for `section_text` and `image`, which have no behavior column.
- **Sticky chrome / scroll body**: today the whole `DialogContent` is one flow. Restructure to three
  regions — header, a scrollable body (`flex-1 overflow-y-auto`), and footer (`DialogFooter`,
  `border-t`, sticky). Cap body height (`max-h-[85vh]`) so the footer is always reachable regardless of
  option/condition count.
- **Header**: keep `DialogTitle` (`titleText`) + `DialogDescription` (`descriptionText`). Add a small
  type-icon chip to their left — extend `ITEM_TYPE_META[itemType]` with an `icon` (a lucide component)
  and render it in a `size-9 rounded-lg bg-accent text-accent-foreground grid place-items-center`
  badge. Optionally add a tiny uppercase type eyebrow (`meta.label`) above the title.

---

## 2. Two-column body

```tsx
<div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
  <section aria-label="Conteúdo"> …left… </section>
  <section aria-label="Comportamento"
           className="rounded-xl border bg-muted/40 p-5 md:p-6"> …right… </section>
</div>
```

- Precede each column with a **group eyebrow**: a row of `text-[11px] font-semibold uppercase
  tracking-wider text-muted-foreground` + a `flex-1 h-px bg-border` hairline. Left = "Conteúdo",
  right = "Comportamento".
- The right column is a subtly tinted panel (`bg-muted/40 border rounded-xl`) so behavior reads as a
  distinct region.
- Inner vertical rhythm: `flex flex-col gap-4` (comfortable) — the fields keep their current `Field`
  structure.

**Left — Conteúdo** (only the arrangement changes; components are today's):
- **Enunciado da pergunta** — the label `Input` + `FieldError` (unchanged; keep `autoFocus`, `required`,
  `labelField` ids). Render slightly larger (`h-11 text-base`) as the primary field.
- **Opções** — the redesigned `OptionsEditor` (§3). Choice types only.
- **Limites (opcional)** — the number/date min/max `fieldset` moves here, directly under options/label
  for bounded types.
- **Texto de apoio (opcional)** — the `questionExplanation` `Textarea` + its `FieldDescription`
  (unchanged), made compact (`min-h-16`).

**Right — Comportamento** (§4): Valor padrão, Resposta obrigatória, Aparência condicional.

**Non-input display types** (`section_text`, `image`): **no two columns**. Single column in a
`max-w-xl` dialog; the type-specific editor (`SectionTextEditor` / `ImageItemEditor` + alt/caption)
fills the body exactly as today.

---

## 3. `OptionsEditor` redesign — the core change

This changes the `OptionsEditor` component's presentation. Its `options` / `onChange` / `colorable`
contract and `blankOption` stay the same.

**From** (today): each option is a card — a label row with ⊘ / ↑ / ↓ / 🗑 controls, then a second row
repeating "Pontuação (opcional)" + "Código de análise (opcional)" labels with two inputs.

**To**: one bordered table; column labels shown **once**; one compact row per option.

```
┌───────────────────────────────────────────────── Opções de resposta  2   ◎ Pontuação e código [⚪]│
│        OPÇÃO                          PONTOS   CÓDIGO           AÇÕES                               │  ← header (once)
│ ⠿  [ Conforme                    ]   [  —  ]  [ conforme   ]   ↑ ↓ 🗑                               │  ← one row / option
│ ⠿  [ Não conforme                ]   [  —  ]  [            ]   ↑ ↓ 🗑                               │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
  [+ Adicionar opção]
```

### 3.1 Progressive disclosure of score + code
- Add local state `const [showScoring, setShowScoring] = useState(initial)` where `initial` is **true if
  any existing option already has a `score !== null` or a non-empty `analyticsCode`** (so editing a
  scored question reveals them), else false.
- A toggle in the options-section header: an icon + "Pontuação e código" + a `Switch`. Off by default.
- **Critical**: hiding the columns must **not drop data**. Keep score/`analyticsCode` in `options`
  state and keep emitting the `optionScore` / `optionAnalyticsCode` hidden fields regardless of
  `showScoring`. The toggle controls *visibility only*.

### 3.2 Row layout (CSS grid)
- `showScoring` **off**: `grid-cols-[24px_minmax(0,1fr)_auto]` → grip · label · actions.
- `showScoring` **on**: `grid-cols-[24px_minmax(0,1fr)_80px_128px_auto]` → grip · label · score · code · actions.
- **Header row** mirrors the same columns with tiny uppercase muted labels: (blank) · `Opção` ·
  `Pontos` · `Código` · `Ações` (right-aligned). Only the header carries these labels — never repeat
  per row.
- Row height ~44px comfortable / ~40px compact; `hover:bg-muted/50`; `divide-y` between rows; the
  whole table in `rounded-xl border`.
- Inputs inside cells are borderless-ish compact (`h-8`, `bg-background`); score cell `text-center
  inputMode="numeric"`; code cell `font-mono text-xs`.

### 3.3 Colour (COLOR_OPTION_TYPES only)
- Keep the colour control, made inline & compact: a `size-5 rounded-full` swatch button at the **start
  of the label cell** (before the text input) opening the existing colour picker. Non-colorable types
  (`dropdown`) omit it. The `optionColor` hidden field logic is unchanged (`colorable ? color : ""`).

### 3.4 Row actions
- Compact icon buttons, `text-muted-foreground`, darken on row-hover: **↑ / ↓ / 🗑** (reorder + delete).
  Delete disabled when only one option remains.
- The current **disable-option (⊘)** control is niche and adds noise — move it into a per-row overflow
  (`•••` `DropdownMenu`) or drop it if unused. (Confirm with product before removing outright.)
- A drag handle (`⠿`, `GripVertical`) at row start signals reordering; wire real dnd only if you
  already have a dnd primitive, otherwise the ↑/↓ buttons are the functional reorder.

### 3.5 Add
- `[+ Adicionar opção]` as a secondary/subtle button **below** the table (`variant="ghost"` or a soft
  `bg-accent text-accent-foreground`), full-left. Appends `blankOption(options.length)`.

---

## 4. Behavior column (right panel)

Three stacked blocks separated by `h-px bg-border` dividers.

- **Valor padrão** — the existing `DefaultValueEditor` (gated by `supportsDefaultValue(itemType)`) +
  its helper text, moved into this panel. `effectiveDefaultValue` + the hidden `defaultValue` input
  unchanged.
- **Resposta obrigatória** — present as a **switch row**: label + one-line helper on the left, control
  on the right. Keep `disabled={isConditional}` and show the existing note when disabled.
  - ⚠️ **Form-submission caveat**: today it's `<Checkbox name="required" value="on" defaultChecked=…>`,
    which submits `required=on` when checked. If you swap to a shadcn `Switch` (which does not emit a
    form value the same way), you **must** preserve submission — either keep the `Checkbox` (restyled
    to read as a switch) or mirror the switch's boolean into a hidden `<input name="required"
    value="on">` rendered only when on. Do not lose the `required` field.
- **Aparência condicional** — a switch row titled "Aparência condicional" / "Exibir somente sob
  condições" (matches today's toggle). When on, render the existing `ConditionBuilder`
  (`context="question"`, `targets={conditionTargets}`, `value`, `onChange`) inside a nested
  `rounded-lg border bg-background p-3` card. Keep the `visibleWhen` hidden field and the
  required-interlock (`onChange` that clears `visibleWhen` ⇒ required re-enables). The builder's
  target/operator/value selects stack vertically — fine in the narrower column.

---

## 5. Footer

`DialogFooter`, `border-t`, sticky. Left: an optional muted live summary — `${cleanOptions.length}
opções${showScoring ? " · com pontuação" : ""}${isConditional ? " · condicional" : ""}`. Right:
`Cancelar` (`variant="outline"`) + submit (`Button`) with the **existing** disabled state
(`isPending || imageUploading`) and label logic.

---

## 6. Responsive

- `< md`: single column — the `md:grid-cols-[1.4fr_1fr]` collapses; the Comportamento panel drops
  below Conteúdo but keeps its `bg-muted/40 border` styling so it still reads as a group.
- Dialog goes near-full-width with padding; body still scrolls; header/footer stay sticky.
- The options table stays a grid; on very narrow widths let the code column drop first (hide `Código`
  below `sm` when `showScoring`, or wrap it under the label) — never crush the label input.

---

## 7. Tokens & primitives

Use the project's existing shadcn/Tailwind tokens — **introduce no new colors**. Mapping of the roles
used above to standard shadcn tokens you already have:

| Role in this spec | shadcn/Tailwind token |
|---|---|
| Card / input surface | `background` / `card` |
| Behavior panel fill | `muted` (`bg-muted/40`) |
| Hairlines, table borders | `border` |
| Primary / secondary / tertiary text | `foreground` / `muted-foreground` / `muted-foreground` |
| Primary action, active toggle, type badge | `primary` (+ `primary-foreground`), `accent` |
| Destructive (delete, errors) | `destructive` |
| Focus ring | `ring` |
| Radii | your `--radius` scale (`rounded-lg` / `rounded-xl`) |

Reuse existing primitives: `Dialog*`, `Field`/`FieldLabel`/`FieldError`/`FieldDescription`, `Input`,
`Textarea`, `Button`, `Switch`, `Checkbox`, `DropdownMenu` (overflow), and the type icons from lucide.
No bespoke inputs.

---

## 8. Acceptance checklist

- [ ] Add and edit both still submit correctly; every hidden field from §0 is still emitted; option
      **codes are preserved** across a label rename.
- [ ] Score + analytics-code columns are **hidden by default**, revealed by the toggle, and their
      **values persist** (and still submit) when hidden; the toggle defaults on when editing an
      already-scored question.
- [ ] Options render as one table with headers shown once; one compact row per option; reorder +
      delete work; colour swatch present only for `multiple_choice` / `checkbox`.
- [ ] Two columns on `md+`, single column below; header + footer sticky, body scrolls, footer always
      reachable with many options/conditions.
- [ ] `section_text` and `image` render single-column in the narrow dialog, unchanged in behavior.
- [ ] Conditional ⇒ required disabled (+ note); `required` still submits `on` when checked; image
      upload still blocks submit; validation errors still surface on label/alt and as a banner.
- [ ] No new tokens or colors; only existing shadcn primitives; all Portuguese copy intact.
```
