# QA review — Case surface split, **Increment 1** (ADR 0134 D1–D5, D7)

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
