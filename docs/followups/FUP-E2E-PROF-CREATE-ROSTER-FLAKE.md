# FUP-E2E-PROF-CREATE-ROSTER-FLAKE — `ethics-e4-participants.spec.ts:765` PROF-CREATE roster row, ONE observation, disposition UNDECIDED (owner: lead + tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟡 **FUP-E2E-PROF-CREATE-ROSTER-FLAKE** — flaked in `e2e:prod` batch 6 on `120478bf`
  (2026-08-27, the first full-suite run of phase AE1), passing on retry. Failing step **:787**:
  `getByRole('region', { name: 'Participantes' }).locator('li').filter({ hasText: 'Dr. Novo
  Respondente (E4)' })` not visible within 10 s — the roster row after an **inline professional
  create** (`possui conta`). ⛔ **Deliberately NOT admitted to `FUP-E2E-REPEAT-FLAKY`'s baseline.**
  That baseline's *"two pre-existing flakes are a floor, not a guarantee"* is a warning about the
  count, not permission to grow it — a baseline that absorbs each new name on sight is how a
  defect becomes furniture. ⚠ **One observation is not a pattern**, and it is a *different*
  mechanism from the two survivors (which both fail on an absent Radix `menuitem` inside the
  account dropdown). Needs a disposition — flake or defect — decided rather than assumed;
  entry criteria if it is ever promoted: a second occurrence with a matching fingerprint — lead/tester
