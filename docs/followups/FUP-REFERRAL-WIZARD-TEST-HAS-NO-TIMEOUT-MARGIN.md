# FUP-REFERRAL-WIZARD-TEST-HAS-NO-TIMEOUT-MARGIN — a unit test that flakes on a busy box (owner: frontend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25 (PDF·P3, reported by `frontend` as a not-mine red).**
>
> `referral-send-wizard-mrn-warning.test.tsx` times out at 5000 ms under parallel full-suite load.
> Run **alone** it passes 6/6 — in **5.05 s against a 5000 ms per-test timeout**, i.e. essentially
> **zero margin**. Its subject imports nothing the P3 work touched.
>
> ⚠ **The cost is misattribution, not the red itself.** A test with no margin fails whenever the
> machine is busy, and it fails *during someone else's change* — so it is read as a regression in
> whatever landed most recently. That is expensive twice: once to investigate, once more when the
> real cause is dismissed as "the flaky one" on the day it is genuine.
>
> ⛔ **Do not fix it by raising the timeout alone.** A 5.05 s unit test is the finding; the timeout is
> just what surfaced it. Establish where the 5 s goes first — if it is fake-timer or
> `waitFor`-polling cost the fix is in the test, and if it is render cost the fix is in the subject.
>
> **Owner:** `frontend`.

---
