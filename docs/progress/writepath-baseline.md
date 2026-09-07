# WRITEPATH-BASELINE — progress record

Write-arm baseline: pre-AE5 remediation Batch 3. The unit's **summary** is its hub,
[docs/features/writepath-baseline.md](../features/writepath-baseline.md) § Current state; this file
is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: `supabase/tests/mutation/p0-authz-writepath-audit.sh` (the write arm: its domain lifted
at run time as every `pg_policy` row with `polcmd <> 'r'`, its accounting, its exit paths, its
crash safety), the committed baseline `docs/reviews/authz-writepath-audit-findings.md` (re-earned
through `scripts/lib/merge-findings-baseline.sh`), and the deriver `scripts/door-sweep-cases.sh`
only as the thing that prints the write-arm command. Decisions: ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (a green arm bounds its own
domain), [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) (a subset run writes to
scratch), [0173](../decisions/0173-door-sweep-deriver-blind-to-runtime-rewrite-migrations.md) §4
(selection is the success criterion), [0189](../decisions/0189-one-crash-safety-protocol-across-the-mutation-harnesses.md) (the
in-flight sentinel and `RESET_EVERY`), [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
(the merge), [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(D8: the reset design ported into the door arm; NOTICED as evidence). ADR **0192** is reserved
for this unit (plan §3, Batch 4 note 4).

## Session log

### 2026-09-07 — unit opened (lead)

**Why now.** Batch 3 of the pre-AE5 batches ruled 2026-09-04. Every AE5 re-key is a write-policy
re-key, and the write arm's committed baseline holds verdicts for 37 of the 107 policies its
widened domain selects; a `FROMFINDINGS=1` arm compares against committed rows and cannot see an
absent one, so 70 policies pass it vacuously. Batches 0–2 made this run safe and its merge
proven: the crash sentinel (Batch 0), the merge that preserves hand-authored material (Batch 1),
and the door arm's full run through that merge with the tail-drift lesson (Batch 2). This is the
**first** full write-arm run through the merge.

**Scope.** Three follow-ups (hub § Acceptance criteria). Explicitly NOT: any change to a
production function, policy or migration (Batch 4 owns re-keys, on another machine); the
`FROMFINDINGS=1 ARM=policy` red (unreadable until its own FUP lands; ⛔ never allowlist its
twelve); Tier 2's 190 doors (deferred by ADR 0171, **not** cleared).

**Facts at open** (from the follow-up bodies and the tree; every figure to be re-measured by the
builder on a fresh reset — the catalog has moved since each was filed):
- Domain, as filed 2026-09-02 (`d2069603`): `pg_policy` rows with `polcmd <> 'r'`, every schema,
  lifted at run time — 107 = 62 `ALL` + 17 INSERT + 17 UPDATE + 11 DELETE. An `ALL` policy opens
  its `with check` half alone. A full run was measured at ~50 min for 120 cases **before** any
  reset design; the plan budgets ~13 h with `RESET_EVERY`, which is a guess to be re-derived.
- The committed findings file is 137 lines, 37 verdict rows (33 with hand-merged annotations,
  4 AE4.9 D6 rows that are `snapshot:ABSENT`). Hand material the merge must preserve: 2 `## Note`
  sections, 1 blockquote region, ~9 annotated rows, a `---`. All of it will land in CARRIED.
- `p0-authz-writepath-audit.sh` has **0** `RESET_EVERY` hits; `p0-authz-door-audit.sh` has 33.
  The reset design is owed here first, proven as Batch 2 proved it (record § 2026-09-06 retrofit).
- The three `storage.objects` INSERT policies hold no verdict from any arm, ever.
- `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` § REPAIR 2026-08-29 claims all four exit paths proven and
  kill safety in both harnesses; Part 3's domain half was fixed 2026-09-02. What the plan still
  names: exit over an EMPTY case set, the nine Part-3 policies against the widened domain, and
  crash behaviour re-verified on this harness after Batch 0.
- Batch 4 runs in parallel on a separate machine; merge order is Batch 3 first; ADR 0192 is ours.

**Branch:** `authz-writepath-baseline` off `main` @ `23ec1fa5`.
