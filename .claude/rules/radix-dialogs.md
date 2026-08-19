---
paths:
  - "src/components/ui/dialog.tsx"
  - "src/components/ui/alert-dialog.tsx"
  - "src/components/ui/dialog-focus-restore.tsx"
anchors:
  - src/components/ui/dialog-focus-restore.tsx#onCloseAutoFocus
  - docs/progress/bug-log-archive.md#BUG-RDR-001
source: BUG-RDR-001 · BUG-ETHE4-FOCUS-1
---

# Radix dialog focus — the two halves that replace together

- `onCloseAutoFocus`'s `preventDefault()` **also cancels `FocusScope`'s own restore**.
  If you preventDefault, you own the restore: both halves are replaced together, or
  focus is lost to `<body>` on close.
- A **bubble-phase** `stopPropagation()` cannot beat `DismissableLayer`'s
  **capture-phase** Escape handler. Intercepting Escape requires the capture phase.

Sources: **BUG-RDR-001** and **BUG-ETHE4-FOCUS-1** in `docs/progress/bug-log-archive.md`.
Untested residual: `FUP-ETH-KBD-1`.
