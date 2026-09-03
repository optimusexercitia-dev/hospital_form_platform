# FUP-ETH-A11Y-1 — the ETH·E4 dialogs: error text is never `aria-describedby`-wired, and the typeahead announces neither loading nor result count (QA m3 + m4; owner: frontend + tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

> ✅ **BUILT in the working tree 2026-08-12 (`frontend`) — NOT committed. Awaiting the tester
> batch.** m3: both files now pass `hasError`/`hasDescription` into `useFieldIds`, spread
> `controlProps`, and put `id={errorId}` / `id={descriptionId}` on `FieldError` /
> `FieldDescription`; the checkbox-GROUP error in `case-participant-role-manager.tsx` hangs off
> the `<fieldset>`'s own `aria-describedby` (a 3rd site QA's count of 2 did not include).
> Verified live by submitting an empty "Novo papel": every emitted `aria-describedby` resolves to
> a real `role="alert"` node carrying the pt-BR message.
> **m4 route chosen: (a) a separate `sr-only` `role="status" aria-live="polite"` region, worded
> so it duplicates NO visible string** — the listbox's `aria-label` (`Opções para {label}`), which
> `pickFromTypeahead` scopes on, is byte-for-byte unchanged, and route (b) was rejected for that
> reason. New strings, all `sr-only` and all previously absent from the DOM:
> `"Carregando resultados…"` · `"1 opção disponível. Use as setas para navegar e Enter para
> escolher."` / `"{n} opções disponíveis. …"` · `"Nenhuma opção disponível."`. The error path
> announces nothing (the visible message already carries `role="alert"`), and a query below the
> 2-character floor announces nothing (a `null` `emptyAnnouncement`), so no claim is made about a
> search that never ran. Verified live: `"Nenhum resultado. Você pode cadastrar um novo."`,
> `"Digite ao menos 2 letras para buscar."` and `"Buscando…"` each still match exactly ONCE.

**m3 — `aria-describedby` never reaches the error id.** `useFieldIds`
(`src/components/ui/field.tsx:103-133`) already emits `descriptionId`, `errorId` and a
composed `aria-describedby`, but every ETH·E4 call site passes only `.controlProps.id` and
hand-sets `aria-invalid`: `add-participant-dialog.tsx` (2 sites) and
`case-participant-role-manager.tsx` (2 sites, one of which wires `descriptionId` but never
`errorId`). `FieldError` carries `role="alert"`, so the message **is** announced when it
first appears — the gap is that a user who tabs **back** to the invalid field hears the label
and nothing else. CLAUDE.md §8 requires accessible inputs.
Fix shape: pass `hasError`/`hasDescription` into `useFieldIds`, spread `controlProps` instead
of picking `.id`, and put `id={errorId}` on `FieldError` / `id={descriptionId}` on
`FieldDescription` (neither auto-wires — both are plain `<p>` pass-throughs).

**m4 — the typeahead popup has no live region.** `add-participant-dialog.tsx:391-407`:
*"Buscando…"*, the empty hint and the result list are plain nodes **outside** the listbox
that `aria-controls` points at, with no `aria-live`/`role="status"`. Only the error path is
announced (it has `role="alert"`). Keyboard operation and the rest of the ARIA structure are
complete and correct.

⚠ **Why this was filed rather than fixed inside ETH·E4 (lead, 2026-08-11).** m4 cannot be
closed without either (a) new visually-hidden text, which risks duplicating the existing
visible strings — `"Nenhum resultado. Você pode cadastrar um novo."` and `"Buscando…"` — into
a second `getByText` match and redding the suite on strict mode, or (b) folding the count into
the listbox's `aria-label`, which is the exact string `pickFromTypeahead` scopes on (QA r2
confirmed the app really does set it). **Either route needs a coordinated spec change, which
is tester-owned**, so doing it as a lead edit at the tail of the gate would have put churn
into the locators this phase had just finished stabilizing. m3 is attribute-only and safe on
its own, but it belongs with m4 as one a11y pass. Both are QA-rated MINOR and non-blocking.
