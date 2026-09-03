# FUP-C2-SUITE-ABORT-ERROR-CLASS — 16 enforcers abort a pgTAP file when neutralized, so they finish the sweep with no verdict

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

Not 🔴 because there is no evidence any is unguarded; not 🟡 because "no verdict" is being counted
nowhere and would otherwise vanish behind a COVERED-heavy summary.

Of run 1's 25 ERROR rows, **16** carry `run SHAPE changed (… → …) — the suite aborted rather than
failed; not a verdict` and are genuine per-door findings. (Of the other 9: **5** are the semicolon
anchor defect, **3** are tail drift, **1** is `save_block_to_library`, all covered by their own
entries.)

**Mechanism, determined without the DB:** `Files=259` is UNCHANGED in every case while `Tests` drops
— so no file failed to *run*; a file ran and **aborted partway**, contributing fewer tests than its
plan. Removing the guard makes a test file raise where it previously did not. The harness refuses to
score this, correctly: a lower test count is not a failing assertion, and calling it COVERED would be
a false positive.

Deltas observed range from 16 to 190 tests. Localizations by plan arithmetic:

| door | tests lost | candidate file | plan |
| --- | ---: | --- | ---: |
| `public.submit_response` | 190 | 4+ files (`100_dashboard` 22, `130_audit` 25, `160_phase_results` 45, `161_recommend_result_source` 20) — wider than these | — |
| `public.resolve_referral` | 101 | `150_referrals.sql` | 218 |
| `public.submit_minutes_job` | 71 | `305_audio_minutes.sql` — the ONLY file naming it | 115 |

⚠ **`public.submit_response` is the sharp one** — the response-lifecycle authority (Architecture
Rule 3, the `submit_response` RPC). It has **no coverage verdict**.

**What would close it:** per door, mutate it, run the suite, and read from the TAP output **which**
file aborted and at which assertion — minutes each, needing only a free DB. Then either fix the test
to fail rather than abort, or record why the abort is itself the signal.

⛔ **What must NOT be mistaken for closing it:** a COVERED verdict for the same door from a *different*
arm — the arms bound their domains differently (ADR 0079), and this class is defined by this arm's
mutation. ⛔ Nor an allowlist entry: the door is not *never called*, it is **never scored**.
