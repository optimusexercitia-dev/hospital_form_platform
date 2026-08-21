# QA review — Case surface split, **Increment 1** (ADR 0134 D1–D5, D7)

> **CURRENT VERDICT (r2, 2026-08-21): CHANGES REQUESTED** — see **§7 Re-review (r2)** at the
> bottom. All five r1 code findings are genuinely fixed and the new specs are strong; the r2
> blockers are a **red lint gate at HEAD** (`lint:vacuous`, so §6 step 1 is not satisfied), a
> **custom-fields under-grant regression** the increment introduced, and a **PO ruling recorded
> only in a commit message**. §§1–6 below are the r1 review, unchanged.

---

## r1 review (superseded — kept as the record of the round)

**Verdict: CHANGES REQUESTED** · Reviewer: `qa` · Date: 2026-08-21 · Branch
`feat/case-surface-split` @ `ea89aeb0`, diffed against `df88dced` (merge-base with `main`).

**Read the verdict correctly.** The architecture of this increment is sound and I found **no
security defect**: no UI gate claims an authority the DB withholds, and none withholds an
authority the DB grants that was not already withheld before this branch. The four-gate
correction, the single-point predicate, its fail-closed behaviour, the load-bearing second
gate, and T4's narrowing are all **verified correct against the live catalog** — details in §2.
The changes requested are one requirement gap (§3 F-1), one false catalog claim shipped inside a
rewritten docblock (F-3), one stale live-state record (F-2), and three small corrections. None
requires re-architecting anything; F-1 needs a **ruling** more than it needs code.

---

## 1. Method

Every claim below was re-derived by **property**, not from any hand-list — including the lists in
my own task prompt and in `docs/plans/case-surface-split.md` §1, whose ⛔ warning ("wrong three
times, always naming the instance found rather than the class") I treated as a live hazard rather
than history.

- **SQL: live catalog only.** `pg_proc` (incl. `prosecdef`), `proacl`, function bodies read with
  `--` comments stripped by `regexp_replace(prosrc,'--[^\n]*','','g')` and **never line-filtered**.
  Local stack was already up; **I ran no `supabase db reset`** — no reset was needed and none would
  have been safe to spring on other sessions.
- **Route gates: enumerated, not grepped for a name.** `find` over the whole `manage/cases` and
  `casos` subtrees, then a single grep for *every* authority token
  (`access.role`, `isAdministrativo`, `canInCommission`, `context.isAdmin`, `isTenancyAdmin`,
  `isQualityViewer`, `canOpenCaseManagement`) across both subtrees.
- **Absence claims carry a positive control.** Examples: "no administrativo arm in `_case_caps`"
  is stated beside `read_case_content` → **8 hits** from the same probe on the same text; "no
  `is_admin()` arm" beside `is_staff_admin_of_for` → **1 hit**; "no second copy of the manage-entry
  predicate" beside a probe that *did* find five other `role === "staff_admin"` gates in the same
  subtrees.
- **Gate evidence re-run, exit codes read directly (never piped):** `npm run lint` **exit 0**
  (all 8), `npm run typecheck` **exit 0**, `npm run test` **1506/1506, 106 files**,
  `git diff --stat <merge-base>...HEAD -- supabase/` **empty**. pgTAP and `e2e:prod` were not
  re-run — see §5.

---

## 2. What I verified as correct

### 2.1 The four-gate correction is complete — enumerated, not taken on trust

The `(detail)` route group contains exactly five files. Every authority gate in it:

| File | Gate | Status |
| --- | --- | --- |
| `(detail)/layout.tsx:87,98-101,105-109` | `!access` → 404 · `getCaseDetail` null / wrong commission → 404 · `canOpenCaseManagement` | converted ✅ |
| `(detail)/page.tsx:77,85-88,93-96` | same three | converted ✅ |
| `(detail)/timeline/page.tsx:46,57-60,62-65` | same three | converted ✅ |
| `(detail)/etica/page.tsx:47` | `access.role !== "staff_admin"` | **deliberately unchanged** ✅ |
| `(detail)/etica/loading.tsx` | none | n/a |

`etica`'s divergence is matched at the tab bar: `layout.tsx:167` is now
`showEthics = ethicsProcedure !== null && isCoordinator`, and `case-tabs.tsx:43-47` builds exactly
three tabs with ethics conditional — so the tab is never *offered* to a viewer `etica/page.tsx`
would then 404. This is pinned end-to-end by the new **GATE-C2** in `e2e/ethics-e2-procedure.spec.ts`,
which additionally direct-navs `/etica` so the tab's absence cannot be a UI-only omission, and
which carries GATE-C as its paired positive control. That is the correct shape.

### 2.2 The single-point predicate really is single-point

`canOpenCaseManagement` (`src/lib/queries/cases.ts:1198-1225`) is the only implementation. Call
sites: `(detail)/layout.tsx`, `(detail)/page.tsx`, `(detail)/timeline/page.tsx`,
`casos/[caseId]/page.tsx:220` (the button), `manage/cases/page.tsx:121` (row links). I enumerated
every `commissionHref(..., "manage", "cases", <id>)` in `src/` — the other hits are navigation
targets (`case-tabs`, `cases-kanban`/`cases-table` via `staffCaseRoute`, `create-case-dialog`,
`interview-header`, `meetings/case-linker`, `referral-draft-delete`, `encaminhamentos/[referralId]`),
not re-expressions of the predicate. `staffCaseRoute` has exactly one host
(`manage/cases/page.tsx:340`), so the `false` default cannot silently point some other board at a
route it would 404 on.

Two notes in the same breath:
- `create-case-dialog.tsx:237` pushes to `/manage/cases/[id]` after creation. Before this branch
  that push **404'd an administrativo**; D3 closes that pre-existing dead-end. Improvement, unpinned.
- `interview-header.tsx:50` forks on a *hand-written* `isCoordinator` (from
  `interviews/[interviewId]/page.tsx:68`). It is now **narrower** than the manage gate, so it cannot
  produce a 404 — it just sends a non-coordinator "back" to the commission home instead of the case.
  Pre-existing, low value, listed in §4 as an observation only.

### 2.3 Fail-closed — confirmed on every path

`probeCaseWriteContent` (`cases.ts:1140-1153`) returns `false` on RPC error, on a non-object /
null / array payload, on a missing or non-`true` key, and inside `catch`. `canOpenCaseManagement`
returns `true` only from three explicit positive arms; there is no default-true fall-through.
The RPC's own contract matches the docblock — I read it: `public.case_viewer_capabilities(uuid)`
returns all-false for an unknown case rather than raising.

The docblock's reachability claim also checks out from the catalog rather than from migration
text: `prosecdef = true`, and the ACL is an **explicit** `authenticated=X/postgres` (not a NULL /
default ACL). "A correct door nothing can reach" genuinely does not apply.

### 2.4 The second gate is present — no P0

`getCaseDetail`-returns-null → `notFound()` is present and **above** the predicate in all three
converted files (`layout.tsx:98-101`, `page.tsx:85-88`, `timeline/page.tsx:57-60`), each with the
"do not delete this" note. It is load-bearing, and I confirmed *why* from the catalog rather than
from the comment: `app._case_caps` contains **zero** references to `member_can` and **zero** to
`administrativo` (probe control: `read_case_content` → 8 hits in the same body), so
`isAdministrativo` is entirely independent of per-case read reach until S8 lands. Arm 2 of the
predicate is therefore wider than reachability by design, and this line is the only thing bounding
it. **Not removed. No P0.**

### 2.5 T4 is correct **for Increment 1**, and the comments say why truthfully

Catalog: `public.bulk_create_cases(uuid,date,text,jsonb)` is `prosecdef = t` and its only authority
branch is `if not (app.is_staff_admin_of(v_commission_id)) then raise … 42501`. No `member_can`
arm, no admin arm. So the shipped gate — `access.role !== "staff_admin"` at
`multiplos/page.tsx:69` and the mirrored `isStaffAdmin` at `manage/cases/page.tsx:213` — is the
exact TS mirror of the door, and the capability gate D5's letter asked for **would** have built a
dead-end door. The in-code comments state precisely this reason (including that `app.is_active`
is mirrored *elsewhere*, at the shell, and must not be re-added here), and both sites changed
together. Amendment 1 §A1.2's supersession is correctly deferred to Increment 2.

`app.is_staff_admin_of` body confirms the mirror argument:
`app.is_active(auth.uid()) AND app.has_role('commission', id, 'staff_admin', auth.uid())`.

### 2.6 The excluded classes, verified from the catalog rather than from the spec

`app._case_caps`' tenancy-admin arm is `v_orgadmin → manage_case_access` **only**; there is no
`is_admin()` arm anywhere in the body. So an `org_admin`/`hospital_admin` fails `can_read_case`
and 404s at the **read** gate, *and* fails all three predicate arms (`access.role` is membership-
only since ADR 0100 D12). Both gates deny — the V-A obligation is met by measurement, not
assumption. The commission shell (`c/[commission]/layout.tsx:107-112`) additionally 404s any
principal with `role === null && !isQualityViewer && !isTenancyAdmin`, which is what keeps a
hypothetical non-member write-grantee from reaching the widened manage host at all.

`e2e/case-manage-entry-gate.spec.ts` is the best spec on this branch: six classes, a positive
control **inside each test**, an explicit statement of which two (read-grantee, `quality.a`) are
load-bearing and which four pass with T1 deleted, and a recorded manual differential
(short-circuit the helper → exactly those two flip red). That is the plan's §3-T6 control,
honoured rather than paraphrased.

### 2.7 Per-affordance authority on the widened manage host

Each control was re-measured against its door, not inferred from the route:

| Affordance | Shipped gate | Catalog authority | Verdict |
| --- | --- | --- | --- |
| Editar meta | `canInCommission(access,'create_cases')` | `update_case_meta`: `is_staff_admin_of` **elsif** `member_can(…,'create_cases')` | exact mirror ✅ |
| Concluir / Cancelar | `isCoordinator` | coordinator-only | ✅ |
| Access roster | `isCoordinator` (+ load made conditional) | coordinator-only | ✅ |
| Ativar / Alterar responsável | `canInCommission(access,'assign_case_phases')` | `activate_phase`/`reassign_phase` admit that capability | ✅ |
| Adicionar fase / narrativa (fuel) | `isOpen && canManageLifecycle` | `add_ad_hoc_narrative` `prosecdef=t`; `add_ad_hoc_phase` `prosecdef=f` under a `staff_admin` policy | ✅ |
| Ver respostas → `fase/…/respostas` | `canManageLifecycle` (`coordinator-phase-actions.tsx:110`) | route is `staff_admin`-only | no dead-end ✅ |
| Comparar → `correcoes/[id]` | `caps.canApprove = caps.canManageLifecycle` (`case-detail-view.tsx:459`) | route is `staff_admin`-only | no dead-end ✅ |
| Content cards | raw `canWriteContent` (manage passes no `managementElsewhere`) | `_case_caps` S1 ∨ S3 write column | ✅ |

Data loads were split by affordance rather than left riding on the old role guarantee — dialogs a
viewer cannot open are absent **by construction**, which is the right pattern and was applied
consistently (`layout.tsx:145-149,194-210`; `page.tsx:157,176,211-218`).

### 2.8 The five stale comments

All five are corrected and each is now **true against the catalog** (I re-measured rather than
re-read): the `case-detail-view` "administrativo has no other surface" rationale; the
`interviews-panel` "canCreate implies a coordinator" claim; `multiplos`' "commission-admins resolve
to `staff_admin`"; `manage/cases/page.tsx`'s tenancy-admin coercion paragraph; and the
`CaseViewerCapabilities` docblock in `cases.ts`, whose new arm list I checked line-by-line against
`app._case_caps` (five read arms: coordinator, grant, assignment, PQS-referral, quality reviewer;
`write_case_content` from exactly S1-membership and the S3 **column**; no admin arm; hard denies for
inactive / respondent / recused all present at the top of the body). A **sixth** was not fixed —
F-3 below.

### 2.9 Out-of-plan but correct: the `docs/**` eslint ignore

`eslint.config.mjs` was not assigned to anyone in the plan's §5 ownership table, so this landed
un-owned — but it is right, and its reason is serious: eslint is link 1 of the 8-gate `&&` chain,
so from `2b50f83f` until this commit **seven gates never ran**. Bounded by the property
(documentation is not first-party source) rather than by the one failing path. Endorsed. Worth a
one-line follow-up so the window (2026-08-20 → 2026-08-21) is recorded somewhere durable — any
"lint green" claim made in that window was unobtainable.

---

## 3. Findings

### F-1 · **BLOCKING (requirement)** — D1's sentence is **not** observably true on the `/casos` subtree: `narrativa/[narrativeId]` was never narrowed

**Requirement violated:** plan §7 Acceptance, Increment 1, bullet 1 — *"D1's sentence is
**observably true** — on `/casos`, for every viewer class, the only write affordances are
name-attributed ones"*; ADR 0134 **D2** ("the `/casos` narrowing extends to every case-wide
capability").

`src/app/o/[org]/c/[commission]/casos/[caseId]/narrativa/[narrativeId]/page.tsx` is the **second**
route file under `/casos`. It is untouched by this branch, and at line 60 it takes the **raw**
envelope:

```ts
const caps = detail.viewerCapabilities;          // :60 — never narrowed
const canEdit = canEditNarrative(narrative, caps, caseOpen, viewerId);   // :65
const canConclude = caseOpen && narrative.status === "open" &&
  (caps.canManageLifecycle || isAssignee);       // :67-70
```

and `canEditNarrative` (`src/components/cases/narrative-access.ts:40-45`) is:

```ts
if (caps.canManageLifecycle) return true;                                   // ANY narrative
if (viewerId != null && narrative.assignedTo === viewerId) return true;     // name-attributed
if (caps.canWriteContent && narrative.assignedTo === null) return true;     // ANY un-attributed one
```

So on a `/casos` URL a **coordinator** still edits and concludes *any* narrative, and a **per-case
write-grantee** still edits *un-attributed* narratives — the precise carve-out D1/D2 exist to
abolish, surviving one directory below the page that was converted. This is the plan's own §1
hazard recurring for a fifth time: T2 named two files (`case-detail-view.tsx:366`,
`casos/[caseId]/page.tsx:265-268`) — the instances — where the class is *"every route under
`/casos` that renders a write affordance"*, and that class has two members.

Practical reach is deep-link / direct-URL: `my-case-card.tsx:239` is the only in-app link and it
is name-attributed (`list_my_cases` is the viewer's own work), and the detail page's narrative
panel gates on the narrowed `caps.canWriteContent` (`case-detail-view.tsx:772,800`). That bounds
the exposure; it does not repair the claim, and `e2e/case-access.spec.ts` AC-3b's new
`toHaveCount(0)` on `/casos/[caseId]` reads as a class-wide pin that this route falsifies.

**Not a security defect** (Rule 1 — the DB rights are identical either way), and **not a
one-liner**: there is no narrative-editor route under `manage/**`, so narrowing here would
*delete* the affordance rather than relocate it, which D2 explicitly does not intend.

**Requested:** a recorded decision, either way, before this increment is called done —
 (a) narrow `caps` on this route and add a `manage/cases/[caseId]/narrativa/[narrativeId]` host
 (relocation, matching D1), or
 (b) record it as a **stated exception** to D1 in ADR 0134 and in the increment's build record,
 with the reason, so "D1 is observably true" is never read as unqualified.

**Same bullet, second counterexample, for completeness:** `NotifyEventDialog`
(`case-detail-view.tsx:626-630`) is a genuine write on `/casos` gated on the **feature flag alone**
— no capability check for any viewer class. It is pre-existing and ADR 0100 D7 documents it in
code, but it is a second exception to the same sentence and belongs in the same exception list if
(b) is chosen.

### F-2 · **BLOCKING (hygiene, §7 / CLAUDE.md §7)** — PROGRESS.md § Now contradicts its own Test Run Summary

`PROGRESS.md:23-25` still reads: *"**T6 specs NOT written and no `e2e:prod` run**, so the increment
is **not** gated."* Both halves are false as of `0d839242` and `ea89aeb0`, and the Test Run Summary
in the **same file** records the green gate. A reader who opens § Now first — which is what § Now
is for — gets the stale answer.

Secondary, same section: **OPEN-2 appears twice with opposite statuses** — "✅ OPEN-2 RULED by the
PO" and, ~20 lines later, "⛔ **OPEN-2 — a second PO ruling** … Until the PO rules, D5 is partially
implemented". `lint:progress` passes on both (it cannot see a claim that went false), so nothing
but this review will catch either.

Lead-owned section; listed here because §7 makes PROGRESS.md's accuracy a gate condition.

### F-3 · **BLOCKING (false catalog claim, in a docblock this branch rewrote)** — `member_can` does **not** gate on the capability row alone

`src/app/o/[org]/c/[commission]/manage/cases/page.tsx:69-75` states:

> *"nothing REVOKES the appointment when that membership is later removed … and `app.member_can`
> gates on the capability row alone. Such an orphaned Administrativo **keeps `create_cases` at the
> DB** … so a membership-only predicate would 404 someone the database still serves rows to."*

Measured, comment-stripped body of `app.member_can(uuid,text)` (`prosecdef = t`):

```sql
select app.feature_enabled('administrativo')
   and app.is_active(auth.uid())
   and app.is_member_of(p_commission_id)          -- ← the clause the comment denies
   and exists (select 1 from public.commission_administrativo_capabilities c
               where c.commission_id = p_commission_id
                 and c.user_id = auth.uid()
                 and c.capability = p_capability);
```

`app.is_member_of` is `app.is_active(uid) AND app.has_role_any('commission', id, uid)`. So a
membership-less appointee holds `create_cases` at **no** DB door — the paragraph's load-bearing
justification is inverted.

The consequence is the *opposite* of what the paragraph concludes and belongs in the same fix:
`canInCommission(access,'create_cases')` (`session.ts:670-675`) is TS-side and checks **no**
membership, so such a principal passes the route gate at `:94` and the `hasCaseStanding` check at
`:101-104` (via `isAdministrativo`), reaches the board, and is offered "Novo caso" — whose door
refuses. That is a **dead-end door**, and it is **pre-existing**, not introduced here. But the
branch rewrote this docblock and left the false half standing, which is exactly how a false claim
outlives the correction pass around it.

**Requested:** correct the sentence to what the catalog says, and state the real consequence
(orphan ⇒ dead-end door on "Novo caso", pre-existing, follow-up filed) rather than the reverse.
The `hasCaseStanding` administrativo arm may well still be right for the *read* half — `_case_caps`
S3/S4 genuinely need no membership — so the arm need not change; only the reason must.

### F-4 · Low — stale comment **introduced by this branch**

`(detail)/page.tsx:173` closes the `canManagePhaseResults` block with *"`/casos` hand-sets the same
coordinator-only test."* False as of the same commit: `casos/[caseId]/page.tsx` no longer computes
or passes `canManagePhaseResults` at all (that removal is 20 lines of this diff). Delete or
rewrite the sentence.

### F-5 · Low — ruling requested on the orphaned seam (`canEditMeta` / `departments`)

`case-detail-view.tsx:142-143, 248-250` declare `canEditMeta` and `departments`; **no host passes
either** (both mount sites — `casos/[caseId]/page.tsx:227` and `(detail)/page.tsx:244` — were
checked prop-by-prop). Consequences today: `effectiveCanEditMeta` (`:421`) is structurally
`false`, so `:543`'s derivation, the header meta branch at `:644-651`, and the third disjunct of
the cluster condition at `:623-624` are all dead, and the `Department` import at `:31` exists only
for a dead default.

**My ruling: delete them**, in a follow-up commit on this branch or a `chore:` after merge — not
a merge blocker. The meta-edit affordance has a real, tested home in `(detail)/layout.tsx:341-347`
(`EditCaseMetaDialog`), nothing in ADR 0134 or its Amendment 1 re-hosts it inside `CaseDetailView`,
and Increment 2 is the S8 read arm plus the bulk-create arm — neither touches this. A prop whose
name reads as a live capability while being structurally `false` is a comment-shaped assertion in
prop form: it will be believed by the next reader and nothing can contradict it. If the lead
prefers to keep the seam, keep it **with an explicit `⛔ NO HOST — retained for X` note**, so the
next reader does not have to re-derive its deadness the way I just did.

### F-6 · Low — recorded under-grant (pre-existing; `/manage` is now its only host)

`set_case_phase_result_override` admits `assigned_to = auth.uid() **or** is_staff_admin_of` while
the phase is `active` (coordinator-only once `completed`). Both hosts gate on
`access.role === "staff_admin"` alone, so an **active phase's own assignee** is never offered
"Corrigir resultado" though the door grants it. The `(detail)/page.tsx:165-175` comment names this
honestly and defers it as a product question — correct handling. I am recording it as a
**follow-up line** rather than leaving it as a code comment, because an under-grant emits nothing
at all: no error, no log, no gate will ever surface it.

### F-7 · Low — T5 shipped narrower than its text, unrecorded

T5 says *"Board/list rows (**both the `/casos` staff board** and `manage/cases`)"*. `staffCaseRoute`
is passed at exactly one host; Meus Casos rows link unconditionally to `/casos/[id]`
(`my-case-card.tsx:50`), as does the quality board (`quality-case-board.tsx:195-200`). That is
arguably **more** correct than T5's text — D4 is "button, never redirect", and landing on `/casos`
with "Gerenciar caso" is the design — but nothing records the divergence, so "T5 done" reads as
full coverage of a sentence half of which was not implemented. One line in the build record fixes it.

### F-8 · Low — the board call passes a commission id into a parameter documented as a case id

`manage/cases/page.tsx:121-125` calls `canOpenCaseManagement(access, access.commission.id, {…})`.
It is safe today and the comment says why (the board's audience — coordinator ∨ appointee —
always answers on arms 1/2; and capability rows cascade from the appointment, so `capabilities`
non-empty ⇒ `isAdministrativo`, which I checked in `session.ts:624-641`). It is also fail-closed
if the third argument were ever dropped. But it is a type-safe lie at the one call site whose
purpose is to be the single point of truth. Suggest `caseId: string | null` with an explicit
`null` for the board grain.

---

## 4. Observations (no action requested)

- **`boardRowsOpenManagement` is a constant `true` for every principal who can reach that board.**
  Not a defect — but any E2E that "pins" it will pass identically with T5 reverted, the same
  vacuity shape the plan warns about for the `context.isAdmin` removal. Do not record such a spec
  as coverage.
- **`interview-header.tsx:50`'s `isCoordinator` route fork** is now narrower than the manage gate:
  an administrativo or write-grantee viewing an interview is sent to the commission home rather
  than back to the case. Pre-existing, cosmetic, no 404 produced.
- **A recused coordinator cannot be stranded**: `_case_caps` hard-denies zero the envelope, so
  `getCaseDetail` returns null and `/casos` itself 404s before the button can render.
- **The gate record in `docs/progress/test-run-archive.md` is exemplary** — the per-batch census
  (1176 + 2 + 11 = 1189 = collected) rather than the summary line, the infra-rerun
  reclassification confirmed against the error signature rather than assumed, and the pgTAP-count
  drift explained as `main`'s growth with the empty `supabase/` diff as the proof. It names the
  four ARMs rather than the script, as §6 step 5 requires.

---

## 5. Could not verify (work items, not coverage)

1. **pgTAP `6795/6795 F=206` was not re-run by me.** I verified its *premise* instead — the
   branch's `supabase/` diff against the merge base is empty, so no DB object changed — which
   makes the recorded figure sound but leaves it un-reproduced at this commit. Re-running needs a
   fresh `supabase db reset`, which I deliberately did not spring on a shared local stack.
2. **`e2e:prod` (1176 p / 0 f / did-not-run 0) was not re-run by me.** A full gate is a
   lead-run artifact; I read the record and its per-batch census reasoning, which is internally
   consistent, but I did not independently execute it.
3. **The four authz ARMs were not re-run.** Their domain is unchanged this increment (empty
   `supabase/` diff ⇒ no policy and no `prosecdef` object touched), so I accept the recorded
   HOLDs on that basis — an argument, not a measurement.
4. **The manual T1 differential control** (short-circuit `canOpenCaseManagement` → the two
   load-bearing tests flip red) is documented in
   `e2e/case-manage-entry-gate.spec.ts`'s header as measured 2026-08-21 by the tester. I did not
   re-execute it. It is not, and cannot be, an executable in-repo step — that limitation is stated
   honestly in the spec and I am repeating it here so the record does not read as automated.
5. **Runtime rendering was not exercised by me at all.** Every UI claim in §2 is from source plus
   the catalog; the RSC boundary fails at render, not at any static gate. The E2E suite is what
   covers that, and it is green — but my own contribution here is static.
6. **F-1's practical reach** is bounded by my link census (`my-case-card.tsx:239` is the only
   in-app link to the narrative editor). I did not enumerate notification / email deep-link
   payloads, so "direct URL only" is my measurement of the *UI*, not of every path a user can
   arrive by.

---

## 6. Verdict

**CHANGES REQUESTED.**

Blocking: **F-1** (D1's headline acceptance bullet is falsified inside the `/casos` subtree —
needs a narrowing **or** a written exception, not silence), **F-2** (PROGRESS.md § Now asserts the
increment is ungated and unspecced, contradicting its own gate row), **F-3** (a catalog claim that
is false in the direction that makes a dead-end door read as a served capability, shipped inside a
docblock this branch rewrote).

Non-blocking, requested in the same pass because they are all one-line edits: **F-4** (stale
comment introduced here), **F-5** (rule on the orphaned seam — my ruling is delete), **F-6** and
**F-7** (record as follow-ups so a deliberate partial reads as deliberate).

Nothing here impugns the engineering. The four-gate correction, the single-point predicate, the
fail-closed helper, the preserved read gate, the per-affordance authority mirroring, T4's
narrowing, and the entry-gate spec's load-bearing/blind split are all correct and, where they make
a DB claim, correct **against the catalog**. Re-review should be fast.

---

# 7. Re-review (r2) — 2026-08-21

**Verdict: CHANGES REQUESTED** · Branch `feat/case-surface-split` @ `78d14cce`, still diffed
against `df88dced`. New since r1: `3475c4d6` (F-1/F-3/F-4/F-5/F-8), `134138af` (specs), plus
`63fb888f` / `748836d1` / `84d2fa60` / `78d14cce` (docs).

**The r1 findings are fixed — all five code ones properly, and two of them better than I asked
for.** The verdict turns on three *new* items, one of which I found by re-running a gate rather
than by reading the diff.

## 7.1 Method (r2)

Same discipline as r1: catalog-only for SQL with `--` stripped and never line-filtered; every
absence claim carries a positive control; every hand-list re-derived by property — including the
lists in the lead's re-review message, one of which turned out to be half-true (§7.7). Gates
re-run with exits read directly: `tsc` **0**, `vitest` **1506/1506 (106 files)**,
`npm run lint` **exit 1** (§7.4). I did not re-run pgTAP or `e2e:prod` (§7.11).

## 7.2 F-1 — fixed, both halves, and the harder half holds

**The single definition is real.** Property probe — every expression in `src/` that zeroes a
case-wide capability — returns exactly **one** implementation,
`src/components/cases/reading-surface.ts:68`. (The other two hits are prose in comments; the
`manage/cases/page.tsx:220` hit is the `{ canWriteContent: false }` *argument* to
`canOpenCaseManagement`, a different thing.) Both consumers call it and neither re-narrows inline:
`case-detail-view.tsx:384-387` and `casos/[caseId]/narrativa/[narrativeId]/page.tsx:78`. The
`/casos` subtree has exactly two route files and both are converted.

The refactor is also **behaviour-preserving**, which is worth stating because it changed shape:
`caps = managementElsewhere ? narrowToReadingSurface(rawCaps) : rawCaps` is equivalent to the old
`readingAsMember ? {…zeroed} : rawCaps`, because `narrowToReadingSurface` returns its argument
unchanged when `isReadingAsMember` is false.

**The assignee arm survived — verified, not assumed.** `canEditNarrative`
(`narrative-access.ts:40-45`) tests `caps.canManageLifecycle` → assignee → `caps.canWriteContent`
in that order, so narrowing the *caps* cannot reach attributed work; and `canConclude` is
`caps.canManageLifecycle || isAssignee`, so a narrowed coordinator keeps concluding their own.
`AC-4`'s new framing pins exactly this, using the seeded administrativo/assignee as the subject —
the right choice, because she is the viewer most likely to be over-narrowed by accident.

**The new manage host — gate census by property, since it is outside `(detail)`.** The
`manage/cases/[caseId]/narrativa/` subtree contains exactly one file, and `find` over
`manage/**` confirms **no layout** sits above it (only `acreditacao`, `documentos`, `indicadores`
carry layouts), so it inherits nothing but the commission shell. Its own gates, in order:
`!access` → `!flagOn` → **read gate** (`getCaseDetail` null / commission mismatch) → **entry
predicate** → narrative-belongs-to-case. That is the correct order and the read gate is above the
predicate, as in the three `(detail)` files.

Two classes I checked against the catalog rather than the comment:

- **quality reviewer** — passes `!access` (role null but `isQualityViewer`), passes the read gate
  (S7 confers `read_case_content`), then `canOpenCaseManagement` returns false on all three arms →
  404. So the missing `role === null && !isQualityViewer` check that the `/casos` twin carries is
  **not** a gap: the predicate subsumes it.
- **appointed administrativo, no grant, no assignment** — enters, and `canEditNarrative` gives
  `false` on every arm, so read-only. The docblock's claim is accurate.

`caseAccessEnabled()` is `return true` (`src/lib/case-access/actions.ts:102-104`), so the
`!flagOn` gate cannot dark the corridor — checked because a flag-gated new route that is silently
off would make every new spec vacuous.

**One caveat on the claim the lead asked me to test hardest.** "A third `/casos` route reading raw
`viewerCapabilities` is now a *visible anomaly*" is true about **reader attention** and false about
**mechanism**: nothing detects it. The module's `⚠ A NEW ROUTE UNDER /casos MUST CALL THIS` is a
standing prohibition with no resolution event and no gate — precisely the shape CLAUDE.md §8 says
belongs in `.claude/rules/`, path-scoped, and even there is "a strong hint and never a substitute
for a gate". The extraction is still a real improvement (one definition instead of N re-derivations)
and I am **not** blocking on this. Recommendation, cheap and within the rules' volume bounds: a
rule scoped to `src/app/**/casos/**` with checkable anchors (`reading-surface.ts`,
`narrowToReadingSurface`). Not required for this increment.

## 7.3 F-3, F-4, F-5, F-8 — fixed

- **F-3** — the catalog fact is now stated as measured, and the consequence is correctly inverted
  (TS mirror **wider** than the door ⇒ dead-end door, not lock-out). Ruling on the OPEN
  disposition: **§7.8**.
- **F-4** — corrected, with the meta-lesson kept ("a stale comment introduced by the pass that was
  fixing stale comments").
- **F-5** — seam deleted. I re-derived the consumer set from the **pre-branch** file rather than
  trusting the fix: `effectiveCanEditMeta` had exactly three consumers (custom fields, the header
  cluster condition, the meta dialog). Two of the three are correctly handled. The third is
  **§7.5**, and it is a blocker.
- **F-8** — fixed with a real row id and an empty-board short-circuit; the comment names the
  latent failure ("the moment someone drops `knownCapabilities`") rather than just the fix.

## 7.4 🔴 R-1 (BLOCKING) — `npm run lint` is RED at HEAD; §6 step 1 is not satisfied

```
scanned 210 spec files · 1 test(s) with NO unconditional assertion
e2e/case-access.spec.ts  (1)
  L941   ALL-ASSERTIONS-CONDITIONAL
         T6 keyboard-only: Tab-only from the /casos narrative into "Gerenciar narrativa" …
vacuous-assertion gate: FAILED   ·   exit 1
```

Measured at `78d14cce` on a clean tree (`git status` empty). CLAUDE.md §8: all eight gates must
pass, and the eight are chained with `&&`, so `lint` exits 1. §6 step 1 requires lint green.

**The recorded "lint 8/8" for the re-gate is not reproducible at HEAD, and I can date the
regression.** `git diff --stat 134138af..HEAD -- e2e/` is **empty**, so the specs at HEAD are
byte-identical to the specs at `134138af`. My own r1 run — same script, same 210 files, **0
findings**, at `ea89aeb0` — is the control. Therefore the re-gate's lint step ran on a tree
**without the specs the same record's step 2 executed**. That is the reassuring direction again,
and it is the one gate in the eight whose entire purpose is to catch a test that proves nothing.

**The flagged test is not actually vacuous — this is a detector false positive, and I located the
mechanism** so the fix is not guesswork. `containsTestExitingReturn`
(`scripts/check-vacuous-assertions.mjs:284-299`) skips **child** arrow / function-expression /
function-declaration nodes, but when the statement *itself* is a `FunctionDeclaration` it is walked
directly: `forEachChild` hands back its `Block` body, which is not one of the skipped kinds, so the
`return` inside `focusTrace` counts as a test-exiting return. That revokes `guaranteed` for every
statement after it — including the three real `expect(...).toBe(true)` calls. Any test that declares
a helper with `async function` inside its body hits this.

**Two valid fixes; my recommendation is the second, with a condition.**

1. *Tester-side:* hoist `focusTrace` to module scope (it closes over `page`, so it takes `page` as a
   parameter). Smallest change, matches other specs in the file, no gate is touched.
2. *Script-side:* return `false` from `containsTestExitingReturn` when the node itself is a function
   declaration / expression / arrow. This fixes the **class**, which will recur — a helper defined
   inside a test body is idiomatic. ⛔ **Condition, non-negotiable:** loosening a detector requires a
   new case in the script's own self-test (currently 42/42) proving it still flags a genuinely
   conditional-only test that happens to declare a nested function first. A gate relaxed without a
   red-first proof is how the gate stops gating.

Either way this is minutes of work. It blocks because the gate is the authority, not because the
test is bad — the test is good.

## 7.5 🔴 R-2 (BLOCKING) — an under-grant regression: custom-field editing for a `create_cases` administrativo now exists on no surface

Catalog, comment-stripped: `public.update_case_custom_field_values(uuid,jsonb)` (`prosecdef = t`)
carries the **same** two-arm authority as `update_case_meta` —

```sql
if app.is_staff_admin_of(v_commission) then null;
elsif app.member_can(v_commission, 'create_cases') then perform app.assert_administrativo_enabled();
else raise exception 'sem permissão' using errcode = '42501';
```

`app.feature_flags` shows `case_custom_fields = t`, so this is live, not theoretical.

**Before this branch**, on `/casos`, for an appointed administrativo holding `create_cases`:
`readingAsMember` was `managementElsewhere && rawCaps.canManageLifecycle` → **false** (not a
coordinator), so `effectiveCanEditMeta = canEditMeta = canInCommission(access,'create_cases')` →
**true**, and `canEditCustomFields = (caps.canManageLifecycle || effectiveCanEditMeta) && isOpen`
→ **true**. They could edit custom fields.

**After this branch:** `/casos` narrows every case-wide arm, and the manage host computes
`canEditCustomFields = caps.canManageLifecycle && isOpen` (`case-detail-view.tsx:537`), which is
`is_staff_admin_of_for` — coordinator only. **Neither surface offers it.** The DB grants it and no
UI exposes it: an under-grant, the direction that emits nothing at all — no error, no log, no
failing test, no §6 gate.

This is D2's relocation promise unmet for one of `canEditMeta`'s three consumers. The *meta* half
relocated correctly (`(detail)/layout.tsx:341-347`, gated on
`canInCommission(access,'create_cases')` — an exact mirror). The *custom-fields* half did not travel
with it, and the F-5 comment at `case-detail-view.tsx:528-534` now documents the loss as a no-op:
*"removing it changes nothing here … The `create_cases` administrativo's meta authority did not
disappear with it: it lives on the manage host."* True of **meta**; false of **custom fields**,
which the same block covers. That is the "a partial fix reads as a complete one" shape — the
sentence is right about the affordance it names and wrong about the one it silently includes.

**Fix shape:** thread the same `canInCommission(access, 'create_cases')` the layout already computes
into the manage host's `CaseDetailView` as an explicit prop and OR it into `canEditCustomFields`
there — i.e. relocate the second consumer the way the first was relocated. Do **not** restore it on
`/casos`: that would re-open the carve-out D1 abolishes. And please add the differential the way
AC-3b is built, since nothing currently asserts this affordance for this class on either host —
which is exactly why the loss was invisible.

**Bounded by property, so this is the only member:** I enumerated every consumer of the three
removed props in the **pre-branch** `case-detail-view.tsx`. `canAssignPhases` → relocated
(`(detail)/page.tsx:271`) ✅ · `canManagePhaseResults` → relocated (`:175`) ✅ · `canEditMeta` →
three consumers, two handled, one lost. No other affordance is in this class.

## 7.6 🔴 R-3 (BLOCKING, records) — the F-1 PO ruling exists only in a commit message

`63fb888f`'s body carries: *"F-1 ruled: narrow the narrative route AND build the manage narrative
host…"*. Positive control: `OPEN-4` — ruled in the same commit — appears **8 times** across ADR
0134, the plan and PROGRESS.md, with its scope written out ("authorizes exactly §A2.7's list … NOT
authorized: …"). The F-1 ruling appears **zero** times in all three files.

This matters more than the usual records nit because the ruling **authorized a new route**. ADR 0134
D11 bounds the ratified scope; Amendment 1 extended it once and said so; Amendment 2 extended it
again and said so. A new surface at `manage/cases/[caseId]/narrativa/[narrativeId]` now exists with
no decision record behind it, in a program whose own § Now paragraph is titled *"Approval scope,
written down because it is a new fact."* This is the recorded lead failure mode exactly — the
receiver remembers the ruling, so nobody writes it down — and the same commit that avoided it for
OPEN-4 fell into it for F-1, one paragraph later.

**Fix:** one paragraph — an ADR 0134 Amendment 3, or a plan §3-T2 note plus a § Now line — stating
what was asked, what was ruled, and that the ruling authorized building the mirrored manage host
inside Increment 1's routing/UI scope.

## 7.7 Non-blocking findings

**R-4 — `FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT` quotes the door at the wrong grain.** The filing
states the authority as *"`v_assigned_to = auth.uid()` ∨ `app.is_staff_admin_of(commission)`"*
unconditionally. Measured body: that disjunction applies **only while `v_phase_status = 'active'`**;
once `completed` the door is `is_staff_admin_of` **only** (plus an `HC060` terminal-case check).
Since the feature is *post-conclusion result correction*, the assignee arm covers the narrower and
less common case, so the residue is smaller than the filing implies. The finding is real; its
magnitude is overstated. Add the status condition — a predicate cited without the clause that bounds
it reads as a proof.

**R-5 — the corrected `FUP-CASE-TAGS-AND-OUTCOME-SELECTOR-NO-CASOS-DIFFERENTIAL` is still half
wrong, and its class is larger than two.** I verified the two coverage citations and the mechanism
paragraph: both are accurate, and the "a grep bounded by a label is a proxy for the property, not the
property" lesson is exactly right. But the corrected claim *"Both are case-wide, so Increment 1
narrowed them off `/casos`"* holds for **tags** and not for the **outcome selector**:

- Tags gate on `caps.canWriteContent` (`case-detail-view.tsx:830`). On `main` a write-grantee was
  **not** narrowed (`readingAsMember` was lifecycle-only), so Increment 1 did remove them. ✅
- The outcome selector gates on `caps.canManageLifecycle` (`:872`). On `main` a coordinator on
  `/casos` was **already** narrowed by that same bit, so it was **already absent** before this
  branch. Increment 1 changed nothing for it.

And the class — *affordances Increment 1 newly narrowed off `/casos` with no absence assertion* —
has more members than the two named: **Novo item** (action items), **Adicionar registro** (events),
**Anexar documento** (documents), **custom fields**, **Corrigir resultado**, and **Ativar e
atribuir** for the administrativo. Narrative edit *is* covered (AC-3b's `Editar` count, plus the new
T6 differential). This is the same instance-vs-class shape the correction itself diagnoses, surviving
into the correction — worth fixing in the filing, because a follow-up that names two members of a
six-member class will be closed by covering two.

**R-6 — the third flaky is unnamed in a record that promises naming; I resolved it, and it is not
this branch's.** The archive says *"named, not left as a number"* and then names two
(`act-role-assumption.spec.ts:157`, `bulk-case-creation.spec.ts:756`) and locates the third only as
"batch 15". I reproduced the gate's own packing (`pack_batches`, `BATCH_TESTS=70`, glob order) from a
fresh `--list`: **1191 tests over 104 files → 19 batches**, matching both recorded numbers, so the
reproduction is validated. **Batch 15 = `phase2-auth-shell.spec.ts` + `phase22-referrals-governance.spec.ts`.**
Neither is touched by this branch. The branch's own specs sit in **batch 2** (`case-access` ·
`case-manage-entry-gate` · …), which was not flagged flaky, and `administrativo.spec.ts` is in batch
1 but is not either of the two named. **Conclusion: none of the three flaky is in a spec this
increment authored or modified; no evidence of a real intermittent introduced here.** Still name the
third in the record — the reason the promise exists is that "one in batch 15" is where a real
intermittent would hide, and answering it took a batch-packing simulation rather than a glance.

**R-7 — § Now lags its own Test Run Summary again.** F-2's two contradictions are fixed and
annotated (good — including the note that `lint:progress` cannot see a claim that went false). But
§ Now still describes the branch at `ea89aeb0`: *"§6 steps 1+2 PASSED (`ea89aeb0`) … ⛔ Step 3 QA:
CHANGES REQUESTED … the increment is NOT gated"*, with no mention of `3475c4d6`, `134138af`, or the
re-gate — while the Test Run Summary two sections down is headed **RE-GATE**. The verdict half is
legitimately unchanged until this review lands; the missing half is that the remediation exists and
steps 1–2 were re-run. Fix it in the same edit as the r2 verdict row.

## 7.8 Ruling requested — is an unresolved OPEN in a docblock a defect?

**No, and `frontend` was right to decline the instruction. I over-claimed in r1 and the pushback
corrected me.** My F-3 wrote that an orphan "reaches the board and is offered Novo caso" — I
asserted a reachability I had not constructed either, in the served direction, which is the same
error class as the claim I was fixing.

A docblock OPEN is sound when three conditions hold, and all three hold here: **(a)** it separates
what is measured from what is not, in those words; **(b)** it names a tracked follow-up, so the OPEN
cannot become permanent; **(c)** no code behaviour depends on the unresolved half — the
`hasCaseStanding` arm stays either way, so the OPEN decides no gate. If (c) failed — if the OPEN were
deciding whether a guard exists — it would be a defect. Replacing a false claim with a second
unverified claim in the same spot is exactly how the first one survived for weeks; naming it OPEN is
the honest alternative.

**But I can sharpen the question, and the FUP should start from the sharper version.** The plain
orphan case is *derivable*, not merely suggestive: `access.role` is populated only from this
commission's membership row, and the shell 404s
`role === null && !isQualityViewer && !isTenancyAdmin` (`c/[commission]/layout.tsx:107-112`) — so a
plain orphan cannot reach any commission route. What is genuinely open is the **composite**: an
orphan who *also* holds tenancy-admin or quality-reviewer standing passes the shell on the other
disjunct, and then `canInCommission(access,'create_cases')` admits them on the capability rows alone
(which survive the membership deletion), and `hasCaseStanding` admits them on `isAdministrativo`.
**That** principal reaches the board and gets the dead-end door.
`FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED` should say "construct orphan × tenancy-admin and
orphan × quality-reviewer", not "construct an orphan" — otherwise it will be closed by testing the
one composition that provably cannot reach.

## 7.9 Ruling requested — the D1 refinement for `NotifyEventDialog`

**Sound. Adopt it, with two wording conditions.** I re-measured the door rather than taking it:
`public.notify_safety_event(...)` (`prosecdef = t`) opens with
`if not (app.is_member_of(p_reporting_commission_id)) then raise … 42501` — membership only, no
capability arm. The lead's measurement is correct.

The proposed wording — *"name-attributed **or member-universal**; nothing on `/casos` varies by
capability"* — is not a weakening. It is a **more accurate statement of the property the design
actually protects**, and it is *stronger as a test target*: the differential E2E works by comparing
two viewer classes on the same URL, and its power comes entirely from the second clause. A
member-universal affordance is invariant across those classes, so it is outside the differential's
domain **by construction** and cannot dilute it. The original wording, by contrast, would force
deleting a member affordance with nowhere to relocate — deleting an authority to satisfy a sentence.

Two conditions on the wording:

1. **"Member-universal" must be earned at the door, not asserted.** Any affordance claiming the
   exception has to show its door's predicate is membership-only, measured from the catalog. Without
   that, the exception becomes the hole through which capability-varying affordances re-enter
   `/casos` one at a time.
2. **Say "member-universal", not "universal".** `NotifyEventDialog` renders on
   `patientSafetyEnabled && !isOversight` — a quality reviewer is excluded, correctly (ADR 0100 D7:
   notifying is a write and its pre-fill bridge carries PHI). The refinement is about members, and
   the oversight exclusion is a separate, already-correct rule.

Refer the refined wording to the PO as an ADR 0134 amendment — D1 is PO-ratified text, so QA cannot
adopt it, and it should not live only in a review.

## 7.10 New coverage — judged, including the vacuity question

**The T6 narrative differential genuinely pins D1, and would fail against pre-`3475c4d6` code** —
three independent ways: the `/casos` textbox would be present (`toHaveCount(0)` red), the "Gerenciar
narrativa" link would not exist, and the manage URL would 404. Not vacuous.

**AC-4's manage-host additions are non-vacuous only because of the control that follows them**, and
the spec knows it: staff3's `toHaveCount(0)` assertions would pass on a 404 page, so against
pre-`3475c4d6` code they would go green for the wrong reason — but the coordinator positive control
immediately after (`toBeVisible`) would fail on that same 404. The pair is what carries it. Correct
construction, correctly explained in the comment.

**AC-4's reframing is the strongest single addition in this round**: using the seeded administrativo
who is *also* the assignee as the over-reach proof turns an absence-heavy test file into one that
also proves the narrowing removed **nothing it should not have**. That is the assertion most
increments of this shape never write.

**The keyboard test** is the weakest of the three — bounded Tab loops with tuned limits (35/15/10)
and a comment admitting the limits were measured against one persona's sidebar. It is honest about
that, and the focus-trace-per-Tab design is the right response to the earlier false "NOT REACHABLE".
I would still expect it to be the first of these to drift when the sidebar changes. Not a blocker,
and it is not among the three flaky (§7.6). It is, however, the test that trips R-1.

## 7.11 Could not verify (r2)

1. **pgTAP `6795/6795 F=206` — not re-run.** Premise re-checked instead: the branch's `supabase/`
   diff against the merge base is still empty, so no DB object changed. An argument, not a
   measurement.
2. **`e2e:prod` — not re-run.** I verified the *collected* count independently (`--list` → **1191**,
   matching the record) and reproduced the batch packing (19 batches, matching), which is what let me
   resolve R-6. The pass/fail figures themselves I read from the record.
3. **The four authz ARMs — not re-run.** Same empty-`supabase/`-diff argument as r1.
4. **R-1's blast radius across the suite is unmeasured.** I confirmed one finding at HEAD; I did not
   check whether other specs declare nested functions inside test bodies and currently pass only
   because they also happen to assert before that declaration. If fix (2) is chosen, that sweep is
   free; if fix (1) is chosen, the class stays live.
5. **The custom-fields regression (R-2) was measured statically** — pre-branch expression, current
   expression, catalog door, flag state. I did not drive a browser as an administrativo to watch the
   panel become read-only. The four measurements compose, but the observation is not first-hand.
6. **Runtime rendering, again, not exercised by me at all.** Every UI claim here is source + catalog.

## 7.12 r2 verdict

**CHANGES REQUESTED.**

Blocking: **R-1** (`npm run lint` exits 1 at HEAD — §6 step 1 unsatisfied, and the recorded green
predates the specs it is quoted for), **R-2** (an under-grant regression this increment introduced:
the DB grants a `create_cases` administrativo custom-field editing and no surface offers it),
**R-3** (the F-1 PO ruling, which authorized a new route, is recorded only in a commit message).

Non-blocking, same pass: **R-4**, **R-5**, **R-6**, **R-7** — all filing/record corrections, each a
few lines.

Rulings issued: the docblock OPEN is **acceptable** as written, with a sharpened follow-up question
(§7.8); the D1 refinement is **sound and should be adopted** via a PO amendment, with two wording
conditions (§7.9).

None of the three blockers is an architecture problem, and none is a security defect — I again found
no UI gate claiming an authority the DB withholds. F-1's remediation in particular is better than
what I asked for: the extracted module, the mirrored manage host, and AC-4's over-reach proof
together close the finding at the level of the *class* rather than the instance. Re-review should be
quick.
