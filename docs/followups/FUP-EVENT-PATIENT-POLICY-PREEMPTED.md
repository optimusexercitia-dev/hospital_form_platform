# FUP-EVENT-PATIENT-POLICY-PREEMPTED — a PHI policy that never runs, and would arm silently (owner: backend + lead)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-EVENT-PATIENT-POLICY-PREEMPTED** — surfaced 2026-08-31 by QA's AE3 round-2 review
  (finding B6, an out-of-scope observation), while correcting ARCHITECTURE.md's zero-policy class
  list. Measured on the live catalog, not read off a migration:

  - `public.event_patient` carries **one live policy**, `event_patient_select` (`SELECT`, `TO
    authenticated`);
  - `has_table_privilege('authenticated', 'public.event_patient', 'SELECT')` is **false**.

- ⭐ **The policy is therefore PRE-EMPTED DEAD CODE.** Table privilege is checked *before* RLS, so
  the gate never executes: the confidentiality of this Class-1 PHI store rests entirely on the
  **absent grant**, and the policy contributes nothing today. ⛔ **This is not a defect and nothing
  is exposed** — the current posture is strictly closed. It is filed because of what a single
  future statement does to it.

- ⛔ **THE FAILURE MODE IS A SILENT ARMING.** A `grant select on public.event_patient to
  authenticated` — the kind of line added to "fix a 42501" — does not merely open the table; it
  **activates a predicate nobody has evaluated against current requirements**, written when the
  surrounding model was different. The result is not an obvious hole (which review catches) but a
  gate whose correctness was never the thing being reviewed. ⚠ The reviewer of that grant would be
  looking at a table that *has* a policy, which reads as protected.

- ⚠ **It sits in a blind spot between two instruments, which is why nothing has reported it.**
  `382` § A0 derives the ZERO-policy set, so `event_patient` is correctly outside it and A0 stays
  green. The door/ACL arms bound on reachability, and an unreachable table is out of their domain.
  **No arm asks "is this policy pre-empted by its own table grant?"** — the question falls between
  the policy census and the grant census, both of which are individually correct.

- **Owed:** a ruling — (a) drop the policy as dead, making the absent grant the single stated
  control; (b) keep it and pin the pre-emption executably (assert the grant is absent, so a future
  `grant` reds *here* with the reason attached); or (c) re-derive the predicate against current
  requirements and keep it as a live belt beside the braces. ⛔ **Do not close this by observing
  that nothing is currently exposed** — that is the premise, not the disposition. ⚠ Also worth
  deriving the general property once: **how many other policies are pre-empted by an absent
  table grant?** This one was found by eye, which is not a method — backend + lead
