# FUP-ADR0121-REASON-VALUE-DRIFT — the `superseded`-vs-`retention_expired` question ADR 0121 Amdt 2 deliberately left open has been silently pre-answered by the D11 register entry (owner: lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status open

Filed 2026-08-19 (lead). ADR [0121](../decisions/0121-disposal-lifecycle-inflow-outflow-and-evidence.md)
Amendment 2: the reason value recorded when the retention clock fires on a superseded version is
**deliberately left open** — *"the implementing slice decides it explicitly and records the choice
here"*, because both candidate values are true and their regulator-facing meanings differ. But the
`FUP-DM5-D11-SUPERSEDED-NEVER-RETIRES` body in this file already states
`disposal_reason_category = 'superseded'` as if chosen. The live CHECK still admits only the
original five values (measured 2026-08-19), so nothing is built on the drift — but the register is
pre-empting an ADR's reserved decision, which is how an open question becomes a "decision" nobody
made. **Fix:** the D11 implementing slice makes the call explicitly, records it in ADR 0121 Amdt 2's
reserved slot, and reconciles the D11 body; until then, neither value may be cited as decided. (ADR
[0130](../decisions/0130-dsr-subject-request-workflow.md) explicitly does **not** settle it.)
