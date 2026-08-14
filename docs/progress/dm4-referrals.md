# DM4 — Wave C: referrals · phase record

Rotated out of PROGRESS.md at the §6 step-5 Record, 2026-08-14 (PO-approved). The live
tracker keeps a one-line pointer; this file is the authority for how DM4 was done.

- **Plan:** [dm4-referrals-plan.md](../plans/dm4-referrals-plan.md) · **ADR:** [0119](../decisions/0119-dm4-referral-document-substrate-decisions.md) (D1–D10 + the open security obligation)
- **Step-0 evidence:** [dm4-surface-verification.md](./dm4-surface-verification.md) · **QA:** [dm4-referrals-review.md](../reviews/dm4-referrals-review.md) (r1 CHANGES REQUESTED → r2 APPROVED)
- **Migrations** `20260926000100`–`000500` · **pgTAP** `340` · **matrix** `supabase/tests/mutation/dm4-referral-doors-matrix.sh`

### 🔵 IN PROGRESS — **DM4: Wave C — referrals** (opened 2026-08-14)

> **Step 0 ✅ — the plan's mandatory surface re-verification is DONE.** Full evidence:
> [dm4-surface-verification.md](docs/progress/dm4-surface-verification.md). Derived from the
> **live catalog**, then diffed against the plan text in *both* directions — the second
> direction is where all three of this program's historical drop-list misses lived.
>
> **Everything the plan names is CONFIRMED live** (DM1's deliberately-spared referral surfaces
> have not drifted), with **one rename**: the plan's `getReferralReplyAttachmentUrl` does not
> exist; the live function is **`getReferralAttachmentUrl`** (`src/lib/queries/referrals.ts:1112`).
>
> **6 UNNAMED-BY-PLAN surfaces.** None match `%attachment%`, so the sweep style that built the
> plan's list could not have found them — the same blind spot that missed
> `case_documents_select_member` the first time. The two load-bearing ones:
> **`get_referral_snapshot_document_path`** (the actual RPC behind `getReferralDocumentUrl` — the
> read seam) and **`add_referral_shared_item`'s `document` arm** (fails closed on `HC0DM` today —
> this *is* the write seam plan step 1 must un-park). Retiring either without naming it leaves
> the seam half-migrated.
> ⚠ **`referral_shared_item.source_document_id` carries NO FK** (verified `NONE`, nullable) —
> DM1 dropped it deliberately (ADR 0116 D1). DM4 **creates** that constraint, it does not migrate one.
>
> 🔴 **NEW, and it changes DM4's assurance plan: both DM4 write seams sit in the UNRULED census
> blind class.** `add_referral_shared_item` and `add_referral_reply_attachment` are both
> `prosecdef=true` returning **composite** types and auth-reachable — so **no §6 step-1 arm can
> see them**; `census`/`hat`/`floor`/`wrapper` will all pass no matter what DM4 does to that door.
> DM4 therefore needs **bespoke pgTAP keystones** for these two, exactly as DM2 did for
> `open_document_version` (blind for returning `jsonb`; ADR 0118 §12). Measured class size **150**
> against the recorded **146** — ⚠ delta **unreconciled**, treat as unexplained, not as growth.
> This turns the long-parked "146-function census blind class" open item from abstract into
> directly load-bearing for the next phase.
>
> ℹ️ `add_referral_reply_attachment` has **zero UI callers** — `referral-reply-dialog.tsx` ships a
> disabled placeholder ("Anexos da resposta poderão ser adicionados após concluir"). The reply
> path is inert in the product today, which makes it cheap for DM4 to re-point.
>
> **Baseline E2E: 🔴 RED → ✅ GREEN, and DM4 wrote none of it.** Before DM4's build opened, the
> 4 referral specs ran `51 passed · 2 failed · 36 did-not-run` (coverage 89/89) — ⚠ *2 was a
> FLOOR, not a total*; batches abort at first failure. Both reds **attributable to `87cd1ddb`**
> (DM3's `e2e:prod` was green across these specs; it is the only change since) and both
> **locator/label drift — no authz or data defect, no `.sql`, no `src/lib/**`**. Fixed by
> `9b0a8d85` (tester, **specs only**). **Lead-verified independently**, `RESET=1 RETRIES=0`:
> `89 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run`, coverage **89/89** · lint 5/5
> (`lint:vacuous` 0 findings / 180 spec files) · tsc 0.
> ⚠ **The check that matters: 89 collected BEFORE and AFTER** — a suite can be made green by
> deleting tests; this one was not. Net assertions **+6**.
>
> ⭐ **The reusable lesson — a UI-only commit red-lined the suite and every static gate stayed
> green.** No SQL, no `src/lib/**`; a default-closed dialog plus one renamed pt-BR label
> ("Registro" → "Descrição", PO-confirmed intended) was enough, and `registroForm()` was shared by
> 4 tests. tsc + lint 5/5 were green throughout. Three collisions surfaced that nobody predicted:
> the new `Descrição` label collides with the referral's own description `<section>`;
> `NativeSelect` folds **every `<option>`'s text** into the wrapping `<label>`'s accessible name,
> so `exact: true` can *never* match (use `/^Tipo/`); and "Vincular caso" matches both the button
> and its own empty-state hint.
> ⚠ **Assertions were removed against a component DOC COMMENT** (the Detalhes card's "Nothing
> else" note). The comment was accurate *this time* — verified against `thread-events.ts`, which
> genuinely synthesizes `sent`/`received`/`decided_accepted`/`concluded`/`withdrawn` with 11 unit
> tests, and `referral-thread-event.tsx:45` emits `data-thread-event`. **The verification, not the
> comment, is what made the removals safe** ([[a-comment-is-an-assertion-that-goes-stale-silently]]).
> 🔶 **Residual gap, recorded not blocked:** `received` / `concluded` / `withdrawn` have unit
> coverage for *synthesis* but **no E2E assertion that they reach the screen** (E2E asserts 5
> kinds: `assignment`, `case_linked`, `decided_accepted`, `resolution`, `sent`). The old DET tests
> touched `Recebido`/`Concluído`; that is the one thing genuinely thinner now.
>
> ⚠ **Attribution note:** this S4 block was written by `frontend` but was swept into the lead's
> commit `e7b44bea` by a concurrent `git add` — that commit's message describes **only**
> FUP-PGTAP-VACUOUS and understates what it carries. Content is correct; authorship is
> misattributed. **Not amended** (frontend committed on top of it, and rewriting history under a
> live teammate is how HEAD moves out from under someone). Recorded instead, per the standing
> scar: *a commit's own message is not a report of what it committed* — blame by measuring the
> commit, never by reading it. **Two agents sharing one worktree share one index.**
>
> **S4 (frontend) — ✅ BUILT** 2026-08-14, against `backend`'s S0 contract (`67c0fe04`); no
> provisional local shapes. Bar: tsc 0 · lint **5/5** · vitest **1258** · `next build` EXIT=0.
> ⚠ Runtime unproven by design — the S1/S3 action bodies still throw `not implemented`.
> - **R1 discharged**: the disabled placeholder is gone; `referral-reply-attachments.tsx` is a real
>   begin → PUT → finalize control (reusing Wave A/B's `uploadDocumentFile` credential transport,
>   incl. its MAJOR-3 `terminal` no-retry contract). It lives INSIDE the reply dialog because the
>   write authority is `accepted`/`in_review` — the old copy ("após concluir") named the one window
>   the DB refuses.
> - **F-14 discharged**: both detail pages stopped pre-signing at render (a 120 s PHI credential is
>   dead before the reader reaches it, and signing on render hands out bytes with no audited open).
>   Opens are now click-time via `referral-open-file-button.tsx`.
> - **Corridor gate, not last-step**: the whole three-step corridor lives in ONE component with ONE
>   mount site, behind `attachments.enabled` — grep-verifiable. Flag OFF ⇒ no control, no `begin`,
>   no reservation, no bytes; `listReferralReplyDocuments` is **not called**.
> - **`canOpen: false` renders visible + explained + non-interactive** (badge + sentence, never a
>   hidden row, never a probe of the open door). ⚠ Deliberately UNLIKE Wave A, which deleted that
>   branch as unreachable — here visibility and bytes are two DIFFERENT predicates by design, so
>   the state is reachable and hiding the row would misreport the reply's contents.
> - 🔶 **Contract gap for the lead**: `SharedItem` has no `canOpen` twin, so a metadata-tier reader
>   still gets an open affordance on a frozen document that refuses at click time (pt-BR mapped,
>   not raw). Symmetry with `ReferralReplyDocument.canOpen` would close it.
> - 🔶 **Open question**: the DT page offers the upload control (the DT *is* the target side);
>   whether `can_write_document`'s referral arm admits the DT office is backend's to confirm.
>
> **S0–S3 + S5 (backend) — ✅ BUILT** 2026-08-14 (ADR [0119](docs/decisions/0119-dm4-referral-document-substrate-decisions.md);
> M1–M4 lead-approved; both S4 🔶 items above are CLOSED — `SharedItem.canOpen` shipped
> (`5788352e`, door-equivalent predicate, lane-consistent) and the DT office IS admitted
> (catalog-verified: `can_manage_referral_target` carries the `technical_director` arm; the
> legacy gate was predicate-identical — pinned by 340 B5b/B5c).
> - **Migrations `20260926000100`–`000400`** (`72c6c49c`): registry + kernel arms + freeze
>   seam + retirement. M5 DELETED (PO reset ruling — a reconciler no buildable DB needs is
>   born caller-less); its semantics live inline in M3. `frozen_storage_path` DROPPED
>   (21 refs/7 files swept by identifier; 197 §4 re-expressed deliberately, its
>   pass-by-absence hole closed with a positive control).
> - **Red-first record** (`ed759d15`, log `scratchpad/340-red-first-run.log`): 340 authored
>   pre-migration; **44/44 ⭐ keystones observed RED for the right reason** (wrong SQLSTATE /
>   wrong value / arm-denied — not mere object-absence: throws_ok code mismatches and
>   value asserts, with `pg_temp` late-binding + guarded fixtures so the file RAN to
>   completion, 68 executed / 44 red / 24 = only [CONTROL]+[MATRIX] greens).
> - **Neutralization matrix `supabase/tests/mutation/dm4-referral-doors-matrix.sh`** —
>   ⛔ the original "16/16 (`66084b4f`)" verdict was ORPHANED by M5's body rewrite (QA r1
>   MAJOR-1, the a-rename-orphans-a-name-keyed-verdict class). **Rebuilt + re-run at HEAD
>   `f8052575`: 18/18 RED-PROVEN, control green** — every mutation now carries a no-match
>   guard that RAISES; N10b re-pointed at the live M5 body; NEW narrowing cases N14a
>   (source-only gate ⇒ C11d red, C10a measured-green — the ③TWIN polarity, QA MAJOR-2)
>   + N14b (welded shut ⇒ every serve-half red). N10a corrected per QA MINOR-2: ONE
>   predicate (`can_read_referral_phi`) applied at TWO points, not two independent
>   locks — the registry raise proves the audit layer refuses, nothing about the door's
>   gate; N10b bypasses both applications. A matrix verdict is citable only with the
>   HEAD it was measured at.
> - **Gate numbers on a FRESH reset:** registry 390 == disk 390 (max `20260926000400`) ·
>   pgTAP **191 files / 6203 tests — exactly ONE red: `236`** (its `case-documents`
>   boundary + the u1 harness's injection target were retired by M4 — **stop-and-tell filed
>   with the lead; 236/u1 deliberately NOT adapted unilaterally**) · tsc 0 · lint 5/5 ·
>   vitest 1258. Authz arms + diff-scoped sweep: **not yet run — lead sequences them.**
> - **Contract changes relayed:** `SharedItem.frozenStoragePath` REMOVED;
>   `DocumentHomeResourceTypeDb` minted (API = 5 UI homes + `case_referral`) so per-home UI
>   maps stay total; legacy `addReferralReplyAttachment` removed (RPC/table gone); both
>   legacy signed-URL getters neutered to `null` until S4 removes their call sites.
> - HC072's stale message text: NOT touched (outside the diff, per lead ruling).

> ## ✅ GATE STEP 1 (Build complete) — **GREEN, LEAD-VERIFIED** 2026-08-14 @ `48662f64`
>
> ⚠ **Every figure below was re-run by the lead**, not accepted from the teammate report — the
> backend numbers were produced after a session of mutation runs and sweeps against the same
> shared stack, and this project has previously left an authz gate OPEN that way.
>
> | check | result |
> | --- | --- |
> | fresh `supabase db reset --local` | **exit 0**, clean |
> | `npm run test:db` | **Files=191 · Tests=6229 · Result: PASS**, 0 failing files |
> | `npm run typecheck` | 0 |
> | `npm run lint` (5 gates) | 5/5 · `lint:vacuous` 180 files / 0 findings |
> | `npm run test` (vitest) | 86 files · **1258/1258** |
> | `npx next build` | **EXIT=0** (frontend-run — the gate a client→server value-import aborts while tsc/lint/vitest stay green) |
> | `ARM=census` *(has anything ever asked?)* | **HOLDS** — 569 gates carry a verdict, no unswept newcomer |
> | `ARM=hat` *(any door reading `memberships` hatless?)* | **HOLDS** |
> | `FROMFINDINGS=1 ARM=wrapper` | **HOLDS** — BLIND set 41, all allowlisted |
> | `ARM=floor` *(is every door called?)* | **HOLDS** — 74 never-called doors, all on the floor allowlist |
> | diff-scoped door sweep | **2 cases run** (not 0 — the NO-OP trap did not bite): `can_read_document` **COVERED**; `can_write_document` **ERROR**, dispositioned below |
> | neutralization matrix | ⛔ **the 16/16 recorded here was STALE — see the correction below**; now **18/18 RED-PROVEN at `f4d03f44`** |
> | catalog left unmutated? | ✅ verified — neither kernel gate carries a blanket `return true` |
> | findings file restored? | ✅ 594 lines, not the 28-line subset stub |
>
> **⭐ `ARM=floor` was VIOLATED on its first run — a genuine catch, not a formality.**
> `list_referral_reply_documents` shipped with **no keystone caller**. Fixed with a **driving
> keystone (340 E4a/E4b), NOT an allowlist entry** — allowlisting would have turned the arm green
> while the door stayed uncalled, which is precisely the blindness the arm exists to detect.
>
> **The one sweep `ERROR` is dispositioned, not waved through.** `can_write_document`'s blanket
> neutralization **was noticed** (DM1-era keystones M1·4b + DEVIATION-2 went red) but also aborted
> a file (6188 < 6229) ⇒ `run-shape≠baseline`. §6 requires an ERROR be covered by the phase's
> mutation audit: matrix **N4/N5** open its two referral barriers with **targeted** mutations,
> both RED-PROVEN. The runlog was read rather than the verdict taken at face value.
>
> **Red-first evidence, classified rather than counted.** 340 ran against the *unmigrated* catalog:
> **68 assertions, 44 red, 24 green — the 24 greens are exactly the labeled [CONTROL]/[MATRIX] set,
> zero unexplained.** The 44 split into the **strong** class (ran against live code and returned the
> *wrong answer* — registry probes, kernel `else false` arms, `get_referral_detail` missing successor
> keys, `throws_ok` catching a *different* SQLSTATE) and the **weak** class (red merely by *absence*).
> ⚠ Absence-red proves authorship-before, **not falsifiability** — which is why every one of those
> was separately proven post-migration by opening its gate and requiring red.
>
> **Getting to zero surfaced 2 further DM4-caused reds, both fixed at the right layer:** `326 t1`
> refused a precautionary `securable_type` column GRANT (grant-set ≡ view is the pinned invariant —
> the **grant** was removed, the pin was not widened); and `330 DM3·B3`'s positive control had been
> anchored on the very `case-documents` policy DM4 retires — re-anchored, the
> [[vacuity-control-anchored-on-a-defect]] class.
>
> **E2E flag reachability confirmed:** `seed.sql` forces `documents_wave_c = true` for local/E2E
> (prod ships OFF), and both detail pages **server-resolve** it. ⚠ Naming hazard for QA, briefly
> fooled the lead: the dialog prop is named **`attachments`** and its `.enabled` carries
> `documents_wave_c`, while a feature-flag key **literally named `attachments`** sits at `false`.
> Confusing, not defective.
>
> **↻ Re-confirmed at HEAD `91b8b842` after M5 + the E2E commits (backend, exclusive stack):**
> fresh reset → **Files=191 · Tests=6231 · Result: PASS**, 0 failing files, **0 `# Failed test`,
> 0 `deadlock detected`, 0 `Bad plan`**. Arithmetic closes exactly: **6229 + C10c + D8c = 6231**.
> Registry **391 == 391** files on disk, max `20260926000500`. **All four arms HOLD** —
> `ARM=census` re-run *specifically* because `5ac8d849`/`b121740e` landed after the previous arm
> pass, and census is the arm that catches a gate nobody has asked about yet; confirmed, not assumed.
> ⚠ **The earlier `test:db` deadlock aborts (7 then 10 files) are now proven to be contention, in
> both directions:** same tree, same reset discipline — with an 11-connection pool attached they
> abort, with the stack exclusive they vanish. **No real finding behind them.**
>
> ## ⛔ GATE STEP 3 (QA) r1 — **CHANGES REQUESTED**: 0 P0 · 3 MAJOR (2 blocking) · 8 MINOR · 6 INFO
> Review: [dm4-referrals-review.md](docs/reviews/dm4-referrals-review.md). **Both blockers
> discharged in `f4d03f44`**; r2 pending.
>
> ⚠ **MAJOR-1 was the lead's error and is the phase's sharpest lesson.** I recorded "matrix 16/16
> RED-PROVEN", then wrote "↻ Re-confirmed at HEAD" after re-running **pgTAP, the arms and the
> build — but NOT the matrix**, carrying a stale verdict forward under a heading that claimed
> otherwise. QA measured it: `N10b`'s `replace()` needle searched for the **pre-M5** `'{}'::jsonb`
> call, and **M5 itself rewrote that body** to `jsonb_build_object(…)` ⇒ needle dead, N10b silently
> degenerated into N10a, `[C11b]=ABSENT`, exit non-zero. ⭐ *A rename orphans a name-keyed verdict —
> policies follow a rewrite by OID, **`prosrc` does not**.* **M5's own commit message cited that
> lesson while breaking it.** QA bounded the blast radius by measurement (the other 13 needles still
> matched), so the write seam's proofs survived.
> **Structural fix, harness-wide, not just N10b:** every mutation now runs through a guarded `mut()`
> — **a `replace()` matching nothing RAISES** (*"orphaned by a body rewrite — fix the needle against
> the LIVE catalog"*) — and the verdict line now **prints its own HEAD**, because *a matrix verdict
> is citable only with the commit it was measured at*.
>
> **MAJOR-2 — a false coverage claim standing over correctly-deleted proofs.** `u1-mutation-audit.sh`
> asserted the deleted injections were matrix-covered by N10a/N10b/N11; the matrix contained **no
> C10a, no C11d, no D4a — zero of four**, and only C11d carries ③TWIN's polarity (C10a reads as the
> *source* coordinator, the wrong side). Closed by **N14a** (gate narrowed to source-only ⇒ **C11d
> red while C10a stays GREEN**, with must-stay-green patterns so the polarity is *measured*, not
> prose) and **N14b** (door welded shut). Comments now claim only what is measured; retirement pins
> (D4a, 325-t4) are recorded as a **different category**, no longer counted as mutation coverage.
>
> **MAJOR-3 → PO ruling: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16**), which must
> cover both widening and narrowing. `add_referral_shared_item` checks referral-**source** authority
> but never `can_read_case` / `can_read_document`, so a **recused** coordinator can freeze a case's
> PHI documents into a referral — QA demonstrated it live in a rolled-back txn (`can_read_case=false`
> **and** `can_read_referral_phi=true` for the same user+case). ⚠ **The gap stands, behind a flag
> that will eventually be turned on** — filed as **FUP-DM4-RECUSAL** and named in Phase 19's scope.
> Not P0 (flag ships OFF). D4 reasoned about this seam for the D15 *clearance* plane and never
> considered the *case-capability* plane.
>
> **Two records corrected by QA — both were mine, both reported to the PO as fact:**
> 1. **Census delta resolved: neither figure reproduces.** The exact recorded definition yields
>    **141** at HEAD (144 allowing `proretset`, 145 including `app`); DM4 removed one member ⇒ **142
>    pre-DM4**. I had reported 150 vs a recorded 146 as "unexplained growth" — *the discrepancy was
>    in the recording, not the population.*
> 2. **N10a is NOT two independent locks.** `app._audit_access_authorized`'s `referral.viewed` arm
>    **IS `can_read_referral_phi`** — **one predicate applied twice**. Same observable behaviour,
>    far less security value: one predicate wrong breaks both checks. I recorded the engineer's
>    reassuring reading without probing the second guard's predicate.
>
> **Still owed:** QA **r2** → step 4 human → step 5 Record (PROGRESS rotation · `docs/backend-state.md`
> · **graphify refresh, outstanding since the DM0–DM3 merge**).

> ## ✅ GATE STEP 2 (Test pass) — **GREEN, LEAD-RUN** 2026-08-14 @ `5ac8d849`
>
> ```
> batch 1 -> 69 passed · 0 failed · 0 flaky · 0 did-not-run · accounted 69/69
> batch 2 -> 30 passed · 0 failed · 0 flaky · 0 did-not-run · accounted 30/30
> GATE SUMMARY: 99 passed · 0 failed · 0 infra · 0 flaky · 0 did-not-run · 2 batches
> COVERAGE: accounted for 99 of 99 collected tests          RESET=1 REBUILD=1 RETRIES=0
> ```
>
> **No regressions:** the 4-spec baseline is **89/89**, identical to the pre-DM4 measurement taken
> before a line of DM4 existed. **0 did-not-run** — the 9 tests hidden behind the earlier failure
> all ran and passed.
>
> ### What the runtime pass proved that nothing before it could
>
> Everything prior was DB-layer, static-gate or **absence** proof. Now:
> - ⭐ **Byte round trip** — real browser file input → client PUT → finalize → **click-time** door,
>   `Buffer.compare(returned, sent) === 0`, sha256 match.
> - ⭐ **Derivation** — a **lie declared at `begin`** (`declaredSize: 1`, `text/plain`) is discarded;
>   the server's derived size / MIME / sha256 win. *A round trip that trusts the client's declared
>   metadata proves far less than it appears to.*
> - **Click-time doors survive a real ~125 s wait past the 120 s PHI TTL** — the regression that
>   design exists to prevent, tested against the actual clock rather than a mock.
> - **`canOpen: false`** renders visible + explained + non-interactive, and **route interception
>   counted 0 calls** to either audited RPC — the UI does not call the door to learn the answer.
> - **Flag-off refuses at `begin_document_upload` (`HC0D7`) before any `documents` row exists**
>   (count unchanged) — the corridor gated at its FIRST residue-producing step, which is exactly
>   the defect DM3 shipped.
> - **DT admission + both negatives**; **R3** (`HC0DC` refuses an enforcing label, 0 rows created),
>   **R4** (a later label does not retract), **R5** (soft-delete keeps, disposal refuses `HC0DD`).
> - **Audit exactness** on the new `metadata->>'kind'` discriminator, exact counts, unweakened.
>
> ### 🐞 One real defect found and fixed — BUG-DM4-DUP-1 (`5ac8d849`)
>
> The reply-attachment list rendered the just-uploaded file **twice** (strict-mode violation, *not* a
> timeout). `finalize` → `revalidatePath` → RSC refetch returns `initialDocuments` **already
> containing** the new row, while the still-mounted dialog holds its optimistic copy of the same
> `documentId`; the list **concatenated** the two. ⚠ **A race, not a condition** — it survived the
> engineer's whole dev loop and surfaced only on **prod-standalone**; a green run had *lost* the
> race, not avoided the bug. Fixed by merging through a `Map` keyed on `documentId`.
> ⭐ **The engineer caught a SIBLING race the lead never asked about:** seeding the map from
> `initialDocuments` would put a fresh upload at the END pre-refetch and the FRONT after (the query
> returns newest-first) — a second timing-dependent DOM change of the same family. Optimistic rows
> are seeded **first** so each already holds its final position. **It flagged this as a deviation
> from the instruction rather than doing it silently.**
> ⛔ **The spec was never weakened.** The tester refused to relax the locator and traced the cause
> into a file it does not own without touching it. **Strict mode doing its job is the feature.**
>
> ### ⚠ Process record: 3 shared-stack collisions, 2 of them the lead's
>
> Multiple agents, **one worktree and one database, with no lock**. (1) A concurrent `git add` swept
> a teammate's PROGRESS.md block into the lead's commit, whose message then understated its content.
> (2) The lead resumed `backend` mid-batch; its migration restarted the DB under a running suite
> (4 timeouts). (3) The lead told `tester` the stack was exclusively its, then ran its own gate on
> it — producing a **contaminated GATE RED (3 failures)** that was discarded. **Every collision was
> caught by artifacts** (container `StartedAt`, row counts, a strict-mode violation), **never by an
> agent reporting it.** ⭐ `tester` refused to hand over a number it could not trust — *"I don't want
> to give you a false green OR a false red"* — and that refusal is what prevented a false report.
> Standing rule for the rest of the phase: **the lead runs every gate, alone; no teammate touches
> the database.**

