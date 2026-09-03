# FUP-TITLE-ERASURE-REACH-IS-NOT-UNIFORM — six of the ten annotated `*.title` columns ARE inside a disposal door's reach, and four are not (owner: PO/lead; **filed 2026-08-20 while writing the ADR 0131 Amdt 1 helper text**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-20 · status open

⭐ **THE MEASUREMENT, taken because a shared constant was about to state the opposite.** ADR 0131
Amendment 1 promotes soft helper text on `*.title` inputs, resting on the WS B "title invariant"
(*titles are governance metadata, PHI-free by design*). The natural REASON to give a user for that
instruction is *"titles are not erased when patient data is discarded"*. Measured in the live
catalog against the four `dispose_*` doors' write sets:

| inside a door's redaction reach | NOT inside any door's reach |
|---|---|
| `cases.label` · `case_events.title` (`dispose_case_phi`) | `patient_safety_event.title` |
| `documents.title` (`dispose_case_phi` **and** `dispose_referral_phi`) | `meetings.title` |
| `rca_evidence.title` (`dispose_event_phi`) | `capa_action.title` |
| `case_referral.subject` (`dispose_referral_phi`) | `case_interviews.title` |
| `meeting_agenda_items.title` (`dispose_meeting_minutes`) | |

⛔ **So a single constant claiming EITHER direction ships a false compliance statement on roughly
half its sites** — the exact failure `D12_TITLE_GUIDANCE`'s docblock names (*a false blanket warning
teaches clinicians to skip guidance*). Following the precedent's letter would have violated its
reasoning.

⭕ **Resolved for the copy, open as a record question.** `PHI_TITLE_HINT` /
`PHI_FREE_TEXT_HINT` (`src/components/ui/phi-input-hint.tsx`) give the reason that is true at every
site — **visibility**: a title rides queue, list and dashboard projections and is readable by people
who cannot open the record. A pinned unit assertion forbids either constant from acquiring an
erasure verb, so this cannot regress silently.

**What stays open, for the PO:** the loose reading of "the title invariant" — *titles are outside
erasure* — is **false for six columns**, and ADR 0131 Amdt 1's own framing invites it. Either the
ADR gains a sentence naming the split, or a future reader will cite the invariant for a conclusion
it does not bound. ⚠ Also note the direction: the six are erased *more* than the invariant implies,
so the error is conservative for the data subject and misleading for the record — which is why it
is a documentation item, not a defect.
