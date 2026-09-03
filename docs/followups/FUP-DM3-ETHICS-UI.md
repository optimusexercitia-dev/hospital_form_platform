# FUP-DM3-ETHICS-UI — no UI can attach a decision letter to an ethics case; DM3 ships both seams writable via the API only (owner: PO, a feature phase)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-13 · status parked

Filed 2026-08-13 at DM3 open, as the recorded half of a PO scope ruling. **This is a
decision, not an omission** — a later reader finding two write-only columns must land here
rather than infer neglect.

**What DM3 does ship** (ADR 0114 Amendment 2 / D17, conditions 1–5): both
`ethics_decision_details.decision_letter_document_id` and
`ethics_notifications.related_document_id` get a real FK to `documents(id)`;
`issue_ethics_notification`'s fail-closed rejection is removed and keystone K8 with it;
and `set_ethics_decision_details` gains `p_decision_letter_document_id`, forwarded from
`src/lib/ethics/actions.ts`. After DM3 the seams are genuinely writable document-model
citizens **through the API**.

**What it does not ship, and why.** No attach-a-letter affordance. None has ever existed —
verified 2026-08-13 on five independent lines: no writer passes either field (the only
callers are `ethics-decisions-panel.tsx`'s 10-key payload and
`ethics-notifications-panel.tsx`'s 5-key payload); no form control exists in either dialog;
`type="file"` appears in 7 components repo-wide and **none** under `src/components/ethics/`;
nothing in `src/` *reads* either field off a value, so even a populated column would change
no pixel; and `e2e/ethics-e2-procedure.spec.ts:55-56` already declares the Stage-E
legal-privileged decision letter unbuilt.

A decision letter is the **archetypal `legal_privileged` document**. Its UI is therefore not
a form field — it needs the ADR 0072 / ETH·E1 access spine (`case_access_grants` +
`max_confidentiality` + recusal), the D15 confidentiality ceiling, and E2E coverage that
does not exist today. Appending that to a migration wave is how the most security-sensitive
surface in the phase gets the least design attention.

**Discharge = a feature phase that designs the affordance against the ETH·E1 spine**, with
its own threat model and E2E. Until then the columns are write-only by design.
