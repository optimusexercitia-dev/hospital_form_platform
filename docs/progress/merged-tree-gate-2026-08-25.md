# Merged-tree full `e2e:prod` gate — 2026-08-25, `3894c667`

The first full gate run on `main` **after** `feat/user-profile-redesign` merged. It exists
to discharge three claims that had no full-suite evidence behind them:

1. the user-profile batch's **gate step 2**, PO-deferred 2026-08-25 (not discharged);
2. *"no full gate has run on the MERGED tree at all"* — the retained § Test Run row
   described `main` before the branch landed;
3. DSR's final increment, whose `e2e:prod` was **never re-run** after slice 4 shipped.

## Verdict

```
GATE SUMMARY: 1239 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run · 21 batches
COVERAGE:     accounted for 1241 of 1252 collected tests
INFRA re-runs performed: 2
GATE_EXIT=0
```

**Arithmetic reconciles independently.** Summing the 21 per-batch result lines by hand:
`passed=1239 · failed=0 · flaky=2 · skipped=11 · did-not-run=0`. Then
`1239 + 2 = 1241` accounted, and `1241 + 11 = 1252` collected. Every batch reported
`accounted N/N`. Same collected total (1252) as the `6394b95a` gate, so no tests went
missing between the two runs.

Config: `REBUILD=1` (forced — the run's purpose was to gate this tree), `BATCH_SIZE=6`,
`RESET=1`, `RETRIES=1`, `INFRA_RETRY=1`. Clean tree, no unmerged paths, no conflict
markers. Node v24.15.0.

## ⚠ `0 infra` is the POST-RETRY state — two batches collapsed

**Batch 2** (`server_dead=1, conn_errors=33`, 17 classified INFRA) and **batch 4**
(`server_dead=1, conn_errors=37`, 19 classified INFRA). Both were re-run by the harness on
a fresh server + DB **inside the same invocation** and both reconciled clean (67/67 and
60/60). Per the gate's contract that counts as a pass, and because the harness recovered
in-invocation this is a **single run, not a human composition** — but the summary's
`0 infra` must never be read as evidence the Windows collapse family has stopped.

⭐ **The collapse moved batches again.** An earlier, session-killed attempt at the same
commit collapsed on **batch 3**; this run collapsed on **2** and **4**; prior recorded runs
collapsed on **1**, **6**, **13**. Batch 13 ran clean here. That is now five distinct
batches across runs — the collapse is **general across batches**, not a property of any
spec set, and "batch N is flaky" remains the wrong frame.

## Flaky tests, by identity, with batch health

Recorded by name because a count cannot be diffed against the next run
(`FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES`).

| flaky test | batch | batch health | vs baseline |
| --- | --- | --- | --- |
| `act-role-assumption.spec.ts:157` | 1 | healthy | ✅ already named — recurring |
| `phase2-auth-shell.spec.ts:268` | 16 | healthy | ✅ already named — recurring |

**No new flaky names, and both flaked in healthy batches.** Two further observations, both
of which are information rather than grounds to edit the baseline:

- `action-items-satellites.spec.ts:609` is a named baseline entry and **did not flake**.
  Do not prune it — absence of a flake is not evidence a spec is stable.
- The session-killed attempt produced `case-surface-split-increment-2.spec.ts:535` as a
  flake, but **inside the retry of a collapsed batch 3**. In this run the same spec set ran
  as a healthy batch 3 with **0 flaky**. That supports reading it as a symptom of the
  collapse, so it is **not admitted** to the baseline.

## The 11 skipped tests, by identity

Skipped tests assert nothing, so they are named rather than folded into a total. The count
matches the `6394b95a` gate's 11, so this set is stable, not new.

| spec | n | note |
| --- | --- | --- |
| `case-access.spec.ts:1279` | 1 | AC-7 PHI boundary — conditional on a safety event being linked |
| `ethics-e1-access-spine.spec.ts:688` | 1 | AC-6 interview fold-in — no seeded fixture; UI deferred to E2/E3. pgTAP `228_ethics_e1` is the authority for this criterion |
| `form-name-attribute-invariant.spec.ts:401` | 5 | password-set-form, create-case-dialog, form-meta-dialog, section-meta-dialog, item-editor-dialog |
| `nsp-per-hospital.spec.ts:853` | 1 | AC-6 dual-hospital same-org referral |
| `phi-remediation.spec.ts:367` / `:411` | 2 | REM-8 `rca.viewed` and REM-9 `capa_plan.viewed` audit rows |
| `user-registration.spec.ts:296` | 1 | invite-mode activation |

## DSR — discharged, and the assertion it was hiding is already fixed

The DSR hold was checked rather than assumed, because a `0 failed` that silently never ran
the spec is the standard trap. `dsr-slice3-adjudication.spec.ts` ran in batch 5: **11 tests,
all `ok`, no failures.**

The known pre-existing failure at `:728` — a Slice-3-vintage assertion pinning
`meeting_agenda_items.title` as *surviving* `dispose_meeting_minutes` — **no longer exists**.
It was corrected on `main`, and the spec now carries the explanation in place: `meetings.title`
is the column PO Amdt 1 discloses, the agenda item's own title carries no such exemption, and
`3d5e9a9c` widened the door to redact it. That file runs `mode: 'serial'`, so while the stale
assertion stood it aborted every test after it — which is why nothing downstream of it had
been exercised.

## Non-regression: two formerly-deterministic reds stayed green

Neither is a new closure — both were fixed before this run. Recorded because each was once
a **deterministic** red, so a green here is worth more than a flake's silence.

- `quality-oversight.spec.ts` ran **21/21**. `BUG-QO-STALE-CASOS` / `-2` (resolved
  2026-08-21, Step 0 of the case-surface-split program) do not reproduce. ⭐ The repair was
  checked for **vacuity**, not just for green: the standing warning was that if `/casos` is
  read-only for everyone, pairing a coordinator against `quality.a` on the same URL passes
  while proving nothing. It does not — `:655` pairs the coordinator *having* "Reabrir caso"
  on `/manage/cases` against `quality.a` *lacking* it on the `/casos` read view of the
  **same completed case**, asserts content renders there (so the absence is not "nothing
  loaded"), and its own title records why the pending case would have been vacuous.
- The `open_document_version` 500 seen on the macOS gate did not reproduce. It was
  **exercised, not skipped**: 81 tests across `phase17-documents`,
  `documents-changes-requested`, `dm4-referral-documents`, `dm3-wave-b-documents`,
  `documents-redesign`, `phase-f2-attachments` and `quality-oversight`, 0 failures.
  ⛔ State this as *did not reproduce on Windows prod-standalone at `3894c667`* —
  platform-attributed, **not closed**. One platform's silence does not bound the other's
  defect.

⚠ **Measure these against FINAL logs only.** Batches 2 and 4 collapsed and their reruns
supersede them, so globbing `batch-*.log` counts the collapsed attempts' failures and
reports phantom reds — it did, twice, while this document was being written.

## Environment traps hit while producing this run

Both would have produced failures that read as product defects.

- ⛔ **The `gotenberg-pdf` sidecar was down at the start, and went down again mid-session**
  when Docker Desktop recycled (~21:18): Supabase's containers auto-restarted, gotenberg's
  restart policy was `no`, so it stayed dead. The print specs assert real PDF bytes with no
  skip guard. `scripts/e2e-prod-gate.sh` warns per batch (`renderer_ok`) but does **not**
  start it. Its restart policy is now `unless-stopped` — revert with
  `docker update --restart=no gotenberg-pdf`.
- ⛔ **A first attempt at this same gate was killed mid-batch-7** when the session ended; its
  `gate-exit` still read `GATE_EXIT=RUNNING`. It was **restarted from batch 1**, not resumed,
  so this row is one run rather than two partial runs added together. The re-run was launched
  detached so a session teardown could not take it down again.

Run-scoped logs (per-batch + per-server) were kept for this run rather than left in the
gate's default non-run-scoped directory, where the next run overwrites them by batch number.
