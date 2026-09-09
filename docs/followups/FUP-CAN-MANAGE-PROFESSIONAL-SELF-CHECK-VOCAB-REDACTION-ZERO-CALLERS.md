# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-VOCAB-REDACTION-ZERO-CALLERS

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** `redactProfessionalProfile`, `createEthicsAllegationCategory`,
`archiveEthicsAllegationCategory`, `createCaseAssignmentRole` and `archiveCaseAssignmentRole` are
exported `'use server'` functions in `src/lib/participants/actions.ts` and
`src/lib/ethics/actions.ts` with **no caller anywhere in `src/`**, yet a Server Action export is
POST-reachable regardless of whether any component calls it. That is LEARN-018 ("a designated
authority with zero callers is a conformance finding") in its Server-Action form: the gates
exercise a door production never opens, so nothing would notice if its authorization drifted.

**Closes when:** each of the five is either wired to a caller in `src/` (a UI affordance, verified
by an E2E that reaches it) or removed from the module's exports; a repeat of the zero-caller sweep
over the module's `'use server'` exports returns an empty set. ⛔ Not closed by "the RPC beneath it
is gated" — the finding is about reachability of the action, not the correctness of the gate.

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK`, found while tracing `app.can_manage_professional`'s callers
up through `update_professional_profile`/`redact_professional_profile` and the ethics/case-role
vocabulary doors. Full record:
[`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).
