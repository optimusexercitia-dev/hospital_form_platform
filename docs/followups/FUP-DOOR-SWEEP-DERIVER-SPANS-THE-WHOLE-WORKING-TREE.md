# FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE — a diff-scoped sweep for one increment silently selects another increment's cases (owner: backend/lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at the AE1 Record step (obligation 10, AE1.3 gate record).
>
> ⛔ **Not covered by `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED`.** That item shares the number **53** but
> its four parts are different findings (the deriver names one arm for a two-arm list · arm 2 exits 0
> over an empty set · 9 policies fall in neither arm's domain · a killed run leaves a policy wide open).
> Distinct too from `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION`, which is about what the deriver
> **matches**; this is about what it **selects over**.
>
> `scripts/door-sweep-cases.sh` builds its file set from three sources: the committed range
> `git diff --name-only "$BASE".."$TIP"`, the **working tree** `git diff --name-only HEAD`, and
> **untracked** `git ls-files --others --exclude-standard`. ⚠ The last two are deliberate and
> **correct** — the migration under review is normally uncommitted or untracked or both, so a
> committed-range-only recipe sees nothing during the phase it exists to gate; the script's own header
> carries that ⛔ note.
>
> ⚠ **The defect is unattributability, not incorrectness.** In a tree holding two in-flight increments
> the deriver cannot distinguish *"this increment"* from *"this working tree"*, and reports the union
> as the diff. Measured at AE1.3: **53 cases derived where AE1.3 owned 1** — a figure that reads as
> broad coverage of AE1.3 and is nothing of the sort. The Phase Gate records the sweep **against the
> phase**, an attribution the deriver cannot support.
>
> ⛔ **Removing the working-tree and untracked sources is NOT the fix** — that reintroduces exactly the
> blindness the header's note was written to prevent. **Discharged when** the deriver either takes an
> explicit scope (a migration-id floor or path prefix, so a run states *which* increment it swept) or
> prints per-file provenance — committed-range vs working-tree vs untracked — so a 53-case derivation
> can never again be recorded as one increment's coverage.
