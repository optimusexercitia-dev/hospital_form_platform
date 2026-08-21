# DSR ("Direitos do Titular") — the program record

**Closed 2026-08-20.** All four slices built and gated; §6 steps 1–5 complete, PO-approved,
merged. Rotated **verbatim** from PROGRESS.md § Now at the Record step (links repointed for
this directory). This file is history; live state is PROGRESS.md § Now.

⛔ **The program closed under ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md)**,
which bounded PHI erasure to designated PHI fields *after* these slices shipped. Passages
below describing a wider intended reach — the free-text census, the "successor filed"
framing — are preserved as written and are **superseded by 0131**. Read them as the state at
the time, not as outstanding work.

---

- **🆕 DSR ("Direitos do Titular") — designed 2026-08-19; ✅ ALL FOUR SLICES BUILT (19th / 20th
  ×3); there is no Slice 5. ⛔ What is pending is the GATE, not the build** — steps 4 (PO approval)
  and 5 (record + rotation) are owed, and nothing is merged or pushed.
  ⚠ *Corrected 2026-08-20: this bullet read "the program is complete" while a sentence 50 lines below
  it said Slice 4 was at QA r1 — **three conflicting statuses written into one commit** (`3d5e9a9c`).
  A tracker that contradicts itself in one section is read by whichever line the reader reaches first.*
  Sixteen PO-ratified decisions in a structured
  design session: an **adjudicated DSR workflow** (refusal-with-basis first-class), a per-hospital
  **`dpo` capability**, one task inbox at `/o/[org]/titulares` (flag `dsr`), hash-only DSR record
  (Rule 12's "exactly three" survives), two-tier erasure claim, zero disposal-gate widenings, and
  the **child-lock fix ruled as shape 2** (narrow `app.in_disposal_rpc`). ADRs
  [0129](../decisions/0129-meeting-child-lock-disposal-flag.md) +
  [0130](../decisions/0130-dsr-subject-request-workflow.md) — **0129 Accepted/BUILT**; **0130
  moved Proposed → Accepted 2026-08-20 on PO instruction, lifting the build hold**;
  ✅ **counsel's Q14 return ARRIVED same day** (ADR
  [0035](../decisions/0035-lgpd-anvisa-regulatory-posture.md) **Amdt 1**, resolved): committee
  records are **NOT prontuário** (CFM 1821 does not attach); removal requests **case-by-case with
  legal consultation** (supersedes the blanket override); **20-yr retention adopted by default as
  institutional policy**. Refusal guidance settled via ADR 0130 **Amdt 1** (+
  `legal_consultation_ref` on adjudicated outcomes — required/optional split to confirm at
  kickoff). **Nothing blocks on counsel.**
  ✅ **SLICE 1 SHIPPED 2026-08-19** — migration `20260930000100`, suite `348` (15 tests); gate green
  on a fresh reset, fix verified by **neutralization in both directions**. ⛔ **It does NOT unblock
  C1a** — that link was wrong in grain (§ Now item 1); what it fixes is **meeting-minutes erasure**.
  ⭐ The sweep found a second thing: `dispose_meeting_minutes`'s own authz gate was **door-blind**
  (opened, 6548 tests stayed green) — keystoned as `348` t7; sibling census filed
  `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND`, **still open** (349 exercises the referral door, not the event door).
  ✅ **SLICE 2 SHIPPED 2026-08-20** — migrations `20261001000000`–`…000200`, suite `349` (53 tests),
  E2E `dsr-subject-requests.spec.ts` (5), `/o/[org]/titulares` + `src/lib/dsr/`. Gate on a fresh
  reset: pgTAP **200f/6603 PASS** · eight lint gates · `tsc` · vitest **1447** · **all four authz
  ARMs HOLD** · diff-scoped door sweep over the 6 new in-domain gates: **6 COVERED, 0 BLIND**.
  ⛔ **Gate step 3 (QA review) was NOT run, and steps 1–2 were run by the lead, not by the
  `tester`/`qa` teammates** — no independent review of this slice exists. Stated here because a
  gate record that names only what passed reads as full coverage.
  ✅ **Pilot-gate item 0 (`FUP-ACT-DISPOSE-UI`) is DISCHARGED** — `pqs.a@test.local` reaches the
  inbox AND passes `dispose_event_phi`, both halves executed **in a browser**; written into its own
  row ([dm5-po-decisions.md](../progress/dm5-po-decisions.md) item 0), bounded to the **event**
  lane, meetings explicitly NOT claimed.
  ⭐ **Three things the build found, none of them its subject:** `patient_xref` keys the **case**
  module on a `patient_participants` id, not a case id (believing the module name would have shipped
  a case lane failing **closed forever and silently**); `hospital_dpos_select` was **BLIND** when
  first written; and the first neutralization harness's **"restore" was a silent no-op**, so five
  sweeps accumulated — *a rollback you have not watched succeed is not a rollback*. Four shape
  changes are in **ADR 0130 Amendment 2**; read it before extending.
  ✅ **SLICE 3 SHIPPED 2026-08-20 — QA APPROVED (r2), PO-approved.** Migrations `20261002000000`–`…000300`,
  suite `350` (**75 tests**), 4 E2E specs (**37**), the DPO lane + `/o/[org]/titulares/[requestId]`, the
  attested tier, the refusal-retirement, and `disposeMeetingMinutes` — **ADR 0056 Consequence (a), never
  built until now and now reachable** (it shipped *unreachable*: adjudication posted the wrong id, BUG-DSR-S3-001).
  Plus the **`useFieldIds` `name` inversion** (43 files, 30 annotated call sites, PO-ruled).
  **Declaring gate, tree HASH-VERIFIED unchanged throughout:** pgTAP **6678/6678** · 8 lint gates · `tsc` ·
  vitest **1448** · **all four authz ARMs hold** · `e2e:prod` with **only the 2 pre-existing
  `quality-oversight` failures** (BUG-QO-STALE-CASOS) — **no DSR spec failed**.
  ⛔ **Do NOT cite "all four authz ARMs hold" as coverage for this slice.** The diff-scoped case list came
  back **EMPTY** — every changed object is a `prosecdef` scalar non-bool command door, outside every arm's
  domain (**Critical FUP C2**). Coverage is a **48-probe battery: 47 RED + 1 GREEN**, the GREEN recorded as a
  **finding, not a pass**. ⚠ **A RED is sound IFF its baseline was verified green** — a red baseline also
  yields a red post-probe run, which reads as COVERED (`FUP-AUTHZ-HARNESS-PRECONDITIONS`). All 48 clear that bar.
  **10 bugs found and closed inside the slice** (8 product, 2 spec) → [bug-log-archive.md](../progress/bug-log-archive.md);
  ⭐ **four were visible only by EXECUTING something** — no static gate saw them. Build detail, the ARM bound,
  the ACL over-grant and the harness proofs → [dsr-slice-3.md](../progress/dsr-slice-3.md).
  ✅ **SLICE 4 BUILT 2026-08-20 — QA APPROVED at r3** (r1 + r2 were CHANGES REQUESTED). **Its item 1 was
  WITHDRAWN, not built.** Measuring the premise
  before building falsified it: `notifications.entity_type`'s CHECK admits eight values and **`case`,
  `referral`, `event` are not among them**, so the prescribed scrub matched **zero rows by
  construction** for three of the four doors and its pgTAP pin would have been vacuous *by CHECK
  constraint*. The item's own cited evidence was false — **no notification writer reads `cases.label`**
  — and **no** notification text source is erased by **any** door. Established by constructing the
  state (both inserts refused; `meeting` insert as positive control), not by reading the constraint.
  Items 2+3 collapsed into one real change: `referral-dispose-dialog.tsx` now renders the shared
  `DSR_RESIDUE_NOTICE` with both over-claims **replaced**. ⭐ *The design was inferred from column
  names — `entity_type`/`entity_id` read as a polymorphic handle to the disposed entity — and was
  internally coherent the whole time.* ADR [0130](../decisions/0130-dsr-subject-request-workflow.md)
  **Amdt 4**; successor was `FUP-DOOR-ERASURE-FREETEXT-CENSUS` — ✅ **censused, then RULED OUT OF
  SCOPE 2026-08-20** (ADR [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md):
  erasure reaches **designated PHI fields only**; free text is a **training** control). ⛔ Closed by
  ruling, **not** by "nothing found" — 133 columns measured and **accepted**, record retained.
  **r2 → r3.** ✅ **B1 + B2 both discharged.** B1 (a false ACL claim in an Accepted ADR)
  corrected in all three copies — ⭐ *`attacl` belongs beside `relacl`*: a **column** grant
  (`read_at = authenticated=w`) is invisible in `pg_class.relacl`, and it slipped into the very
  sentence claiming the enumeration was *bounded*. B2: the meeting door was **WIDENED** (PO-ruled) —
  10 columns, not the 4 the follow-up listed, incl. depth-2 closed-session prose and **jsonb**
  minutes text (*free text is not a type*). ⛔ **Biggest find of the slice:** a minutes job resting in
  **`done`** kept the **verbatim meeting transcript** indefinitely — falsifying ADR 0056 **§4**, not
  just the residue copy; now purged unconditionally. pgTAP `351` (lead-verified: 202 files / **6711**
  / PASS), 17/17 probes RED on a **locked** fixture. ⛔ `ARM=census`/`wrapper` are green and
  **vacuous here** — neither changed function is in *those two* arms' domains (the guards return
  `trigger`, the door returns `void`); ⚠ **not "no arm"** — `ARM=floor` does contain
  `dispose_meeting_minutes` (QA r2). Cite pgTAP **351**, never the arms.
  ⚠ **No E2E reaches the changed dialog at all** (`BUG-DISPOSE-DIALOG-NO-BROWSER-COVERAGE`), so the
  15 mutation-proven component tests are the only executable proof — a jsdom render is not a browser.
  ⭐ **QA r3's three non-blocking findings N12/N13/N14 were BUILT and recorded NOWHERE** — an APPROVED
  verdict absorbed them, and they survived only because someone re-read the review. Measured in the tree
  2026-08-20, all three already in `3d5e9a9c`: `351`'s anchor comment now says Farmácia B **"ranked 4 of
  4"** (N12); `351` t7 asserts `app.is_staff_admin_of` **under the persona's own claims**, plus a
  SINGLE-ROLE anchor clause — *a membership row is not the door's gate* (N13); both `grantable` copies
  read **GRANTED** (N14). ⛔ What was owed was the **record**, not the work — yet "filed nowhere" was
  carried for a day as "unbuilt", which would have re-done all three.
  **▶ Resume: gate step 4 (PO approval) → step 5 (record + rotation) → merge + push.**
  ⛔ **Not merged, not pushed**; local `main` is separately ahead, unpushed. ⛔ **No commit count
  appears here, deliberately** — measure it (`git rev-list --count origin/main..HEAD`). This line
  carried **9** with "4 uncommitted files" (both false within the day), was corrected to **13**, and
  the correcting commit made it **14** in the same act. A count in a tracked file is stale by
  construction; § Bug Log declines to carry one for the same reason.
  ✅ branch renamed 2026-08-20 to `feat/dsr-subject-request-workflow` — the old name said "slice-2"
  while carrying all four slices.
