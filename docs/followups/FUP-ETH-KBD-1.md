# FUP-ETH-KBD-1 — the professional lane's `TypeaheadField` mount is keyboard-UNTESTED, so BUG-ETHE4-FOCUS-1's defect is not ruled out there (owner: frontend + tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

Carried out of **BUG-ETHE4-FOCUS-1** when that bug was rotated to
[bug-log-archive.md](../bugs/archive.md) on 2026-08-12. It was filed inside the bug as *"not
confirmed, flagged as a hypothesis for whoever fixes it"*; archiving it under the bug's ✅ would
have converted an open question into an apparent closure.

**The gap.** `TypeaheadField` is shared by three mounts — "Buscar profissional", "Buscar
participante externo", "Usuário da plataforma". The FOCUS-1 fix (defer `setOpen(false)` one tick +
`suppressEscapeWhilePopupOpen`) was applied at the component root and all three mounts were
tab-counted after the fix, so this is **not** a suspected live regression. What is untested is the
*pre-fix* question the bug never answered: `PROF-PICK` / `PROF-CREATE` drive the professional lane
**by mouse only**, so no spec has ever keyboard-navigated it end-to-end. There is no KBD-1
equivalent guarding that lane against a future reintroduction.

**Why it is worth an item rather than a shrug.** QA's **m8** found *both* FOCUS-1 root causes
(synchronous `onBlur={settle}` at `evidence-picker.tsx:437`, no `onEscapeKeyDown` suppressor) in a
second, unrelated dialog — flagged structurally, never verified live. The pattern recurs in places
nobody has keyboard-tested; the mouse-only coverage is how it stays invisible.

**Disposition (cheap):** extend the professional lane with a KBD-1-shaped assertion — tab-stop
count plus Escape-does-not-reset-the-lane — and decide separately whether `evidence-picker.tsx`
gets the same treatment. Needs a tester-owned spec change; note FUP-ETH-A11Y-1's m4 warning that
these routes collide with `pickFromTypeahead`'s locators, so the two items should be scheduled
together.
