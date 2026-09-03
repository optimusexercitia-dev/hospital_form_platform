# FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS — a long sweep degrades its own DB, and the harness's baseline is captured once at the top

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

and refused to score), so it is not 🔴. It is not 🟡 because the protection is a **detector, not a
preventer**: it converts late verdicts into ERROR rather than preserving them, and a longer worklist
loses a longer tail.

The full sweep runs the pgTAP suite **twice per enforcer — ~342 consecutive runs over ~5 h** against
**one** database that is reset only at the start. The suite mutates data; the drift accumulates.

**Measured, run 1:** the suite ran at `Files=259, Tests=8685, PASS` for **168** enforcers, then
degraded to `Tests=8288` at enforcer **169** and never recovered. The final three
(`app.assert_accreditation_enabled`, `app.affiliate_person_to_org_impl`, `app.affiliate_person_impl`)
all recorded **ERROR**, not verdicts.

⭐ **Proof it is drift and NOT a property of those doors — the falsification is the evidence.** The
first hypothesis was that neutralizing the *feature-flag* gate `assert_accreditation_enabled` let the
suite perform writes the gate exists to prevent, which then persisted. **That is FALSE.** Re-measured
in isolation after a fresh reset, each of the three came back **COVERED** with the suite green:

| enforcer | in the full sweep | re-measured in isolation |
| --- | --- | --- |
| `app.affiliate_person_impl` | ERROR (SHAPE → 8288) | **COVERED** |
| `app.affiliate_person_to_org_impl` | ERROR (SHAPE → 8288) | **COVERED** |
| `app.assert_accreditation_enabled` | ERROR (restored run not green) | **COVERED** |

Same mutation, same door, clean DB → a verdict. **The door was never the variable; run position was.**

⛔ **Why the existing guards are not a fix.** `BASE_S` is captured **once, at the top of a 5-hour
run**, and every later comparison is against that frozen shape. The guards (`S != BASE_S` → ERROR;
COVERED demands a restored run green at `BASE_S`) make drift *visible* and keep it from becoming a
false COVERED — which is why run 1 lost no correctness. But they cannot keep a verdict: **drift is
converted into ERROR, and the tail is simply not measured.**

**What would close it:** reset the DB periodically inside the sweep (every N enforcers) and re-capture
`BASE_S` after each reset, so drift is *bounded* instead of merely detected. A cheaper partial: after
any ERROR whose note is `SHAPE changed` or `did not come back green`, reset and retry that enforcer
once before recording — which would have recovered all three automatically.

⛔ **What must NOT be mistaken for closing it:**
- **Run 1's clean correctness record.** No wrong verdict was produced, and that is *the guards
  working*, not the absence of the defect.
- **Re-measuring these three.** Done (they are COVERED), but that fixes the three, not the mechanism.
  The next full sweep will lose a different tail.
- ⛔ **Reading the committed findings file as final.** Three of its 25 ERROR rows are this artifact,
  not door findings. Corrected tally: **COVERED 109 · BLIND 40 · ERROR 22.**
