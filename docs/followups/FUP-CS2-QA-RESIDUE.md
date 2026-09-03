# FUP-CS2-QA-RESIDUE — the twelve non-blocking QA findings from Increment 2, and four of them are the same class (owner: backend/tester/frontend; filed 2026-08-22 at the Record step; ⭕ **12 → 6 on 2026-08-22** — M-5/M-6/M-7/M-14/M-15/M-16 remediated red-first and QA C-3 discharged; **M-4 STRUCK as already-delivered**. Remaining: M-1, M-8, M-11, M-12, M-13, M-17. Record: [case-split-assertion-integrity.md](../progress/case-split-assertion-integrity.md))

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

⛔ **Filed so the review's findings do not leave with the review.** QA r2 APPROVED with five record
conditions; C-1 (gate figures), C-2, C-4 (verdict rows) and the M-3 / M-4 / M-9 / M-10 items are
**discharged in that delivery**. What remains is **M-1, M-5, M-6, M-7, M-8, M-11 – M-17**, whose full
statements live in [case-surface-split-increment-2-review.md](../reviews/case-surface-split-increment-2-review.md)
§ "M-findings" — that file is authoritative; this entry exists so the items are **reachable from the
register the PO reads**, not restated.

⭐ **Four of them are one class, and it is this increment's own recurring one — an assertion that proves
less than its name claims:**
- **M-5** — `356` §13's door-set pins are **count-keyed, not name-keyed**: `count(*) = 4` passes if one
  door leaves the set and another joins. A **swap** is exactly how this repo's last name-keyed verdict
  went stale.
- **M-7** — `356` §2.1's *"one body, not two"* is bounded to the **`app` schema**, so a hand-copy of the
  predicate into `public` passes it.
- **M-15** — the "read-only shell" E2E claim is a **2-item hand-list against a 16-member derived class**
  (the same class the `/casos` differential had to re-derive by property after being wrong twice).
- **M-16** — the 404 matcher **cannot say which gate fired**, the precise defect a wrong matcher caused
  earlier in this program when it reported a fixed build as broken.

**The rest, one line each:** **M-1** whether any suite exercises the `meetings` **write** path is still
unanswered (A6.4-3) · **M-6** `356` §8.2d can pass on a NULL participant id · **M-8** the
echo-narrowing property (*the server returns no identifier value*) is **unasserted end-to-end** — the
component half is pinned, the corridor is not · **M-11** the appoint dialog does not tell the coordinator
that the **two keys together** unlock bulk, which is now the only way to get it · **M-12** two small UI
items · **M-13** `isAdministrativo` was not narrowed alongside `canInCommission` (**not live** — it can
no longer decide anything, and it is documented as redundant rather than counted as defence in depth) ·
**M-14** `ALL` in `session-capability-mirror.test.ts` is **unenforced exhaustiveness in the file whose
docblock says it must not be** · **M-17** `dbQuery`'s fail-open survives under the one poll that still
needs it.

**Also owed, from QA condition C-3 — and it is the highest-value item here.** The verification that
settled *"S1–S7 and the S3 loop are untouched"* was: take the live `app._case_caps` body, **strip the S8
block, `md5` it, and compare against the pre-change hash the migration header records**. It matched
exactly. ⭐ **Promote it to a pgTAP catalog assertion**, because it is the check that makes the *next*
arm's author prove they changed **only their arm** — today it exists as a one-off a reviewer happened to
run. ⚠ Whatever is built must be **red-first**: mutate a non-S8 arm and require it to fail, or it is a
hash comparison that has never been shown able to disagree.
