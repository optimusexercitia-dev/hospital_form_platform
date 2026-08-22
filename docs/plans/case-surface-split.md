# Case surface split — implementation plan (ADR 0134)

**Status: NOT STARTED** · Plan authored 2026-08-21, same session that ratified ADR
[0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md) (read it first —
it is the decision record; this file is the execution handoff and repeats no rationale).
**Nothing here is authorized to touch the remote** (no `db push`; standing discipline).

**Read-first for the build session's lead** (PROGRESS.md is NOT auto-loaded — go get it):
PROGRESS.md § Now · this plan · ADR 0134 · ADR 0033 + 0061 (each now carries an Amendment 1
stub pointing at 0134 — update those stubs to build records when the increments land) ·
`docs/progress/authz-handoff.md` §7 before any Increment-2 work.

**Shape:** three deliveries, strictly ordered. **Step 0** (tester, hours) → **Increment 1**
(frontend + tester, no DB, ~3–5 days) → **Increment 2** (backend + tester, the `_case_caps`
S8 arm, ~2–4 days). Each delivery passes the full CLAUDE.md §6 step-1 gate set before the
next starts. QA reviews at the end of each increment (not step 0).

---

## §1 Verified-facts baseline (measured 2026-08-21 — re-verify, never quote)

Every fact below was measured against the live catalog / code on 2026-08-21. They are the
plan's premises, not its evidence — **re-verify each at build time** (catalog for SQL, file
for TS; graphify first for code exploration).

> ⛔ **READ THIS BEFORE TRUSTING ANY ROW. This baseline was wrong three times in two days, always
> the same way and always in the same direction: it named the instance that was found, never the
> class.** Measured during the build:
> - **F1** named **one** gate site; there were **four** (the layout-only change would have been a
>   no-op that passed every gate).
> - **D8** named **two** stale `/casos` assertions; a **third** surfaced the moment the first was
>   fixed — and a failing assertion masks every assertion after it, so two was a **floor**, not a
>   count.
> - **T6**'s excluded-class list named **`org_admin`**; the resolver arm is
>   `app.is_tenancy_admin_of_for`, which covers **`hospital_admin`** too — one sibling of a
>   two-member axis, which reads as sweeping the class.
> - **F9** stated one disjunct of a guard that has **two branches with different second
>   disjuncts** (a line-filtered `prosrc` extraction, which can only ever *drop* disjuncts).
>
> Each row here is a **hand-list wearing the label "verified"**, and that label is what stops the
> next reader from re-deriving it. So: **re-derive every row by its PROPERTY** — "every gate in
> this route group", "every assertion expecting a case-wide affordance on `/casos`", "every role
> the resolver arm admits" — and never by the file, name, or count the row happens to state. A
> row that matches what you find is not confirmation; it is a sample of size one.

| # | Fact | Where |
| --- | --- | --- |
| F1 | ⛔ **WRONG AS WRITTEN — corrected at build time 2026-08-21.** The `(detail)` route group carries **FOUR** copies of the `staff_admin` gate, not one: `(detail)/layout.tsx:63`, **`(detail)/page.tsx:71` (the Detalhes tab — the layout's DEFAULT CHILD, the one that matters)**, `(detail)/timeline/page.tsx:44`, `(detail)/etica/page.tsx:37`. Converting only the layout ships an increment that still 404s every class it was written to admit — **with all eight lint gates, tsc and pgTAP green**. `CaseTabs` also links all three tabs unconditionally, so a partial conversion offers links that 404. | catalog of the route group, not the one file the fact named |
| F2 | `/casos` narrowing: `readingAsMember = managementElsewhere && rawCaps.canManageLifecycle` → zeroes `canManageLifecycle` + `canWriteContent`; sole host passing `managementElsewhere` is the `/casos` page | `src/components/cases/case-detail-view.tsx:366-369`; host `casos/[caseId]/page.tsx:255` |
| F3 | Three role-implied props bypass the narrowing by construction: `canManagePhaseResults`, `canAssignPhases`, `canEditMeta` | `casos/[caseId]/page.tsx:265-268`; documented `case-detail-view.tsx:374-380` |
| F4 | `manage/cases` (list) is already capability-gated: `canInCommission(access, "create_cases")` + standing check incl. `isAdministrativo` | `manage/cases/page.tsx:84-95` |
| F5 | `multiplos` gate is role-based: `staff_admin ∨ access.context.isAdmin`, + `cases_bulk_create` flag | `manage/cases/multiplos/page.tsx:42-57` |
| F6 | `correcoes` and `fase/respostas` are `staff_admin`-only; interviews detail admits ANY role, write via `viewerCanWrite` | respective `page.tsx` files |
| F7 | `app._case_caps` has arms S1–S7 (coordinator / org_admin `manage_case_access`-only / grants / assignment / member-deliberation-only / NSP / quality_reviewer); **no administrativo / `member_can` arm**. `list_cases_board` filters per-row through `can_read_case` (Gate-2 comment forbids short-circuits) | catalog: `pg_proc` (`app._case_caps`, `public.list_cases_board`) |
| F8 | `get_case_detail` embeds `viewer_capabilities` (`can_read` / `can_write_content` / `can_manage_lifecycle`); a standalone `public.case_viewer_capabilities(p_case_id)` exists with the same keys | catalog; TS mapping `src/lib/queries/cases.ts:~1574` |
| F9 | Action items: `action_items.assigned_to` + side table `action_item_assignments`; advance/complete DEFINER door's first disjunct is `assigned_to = auth.uid()`; side-table assignees can update/checklist but NOT complete (ADR 0134 D10: recorded design) | catalog: `advance_committee_action_item`, `app.can_write_action_item_stake` |
| F10 | Referral attribution = `referral_assignments` (roles, due dates); case route embeds NO referral write UI — links only; "Encaminhar" keys on `canManageLifecycle` | `src/components/referrals/case-outbound-referrals-card.tsx:112,170`; `case-detail-view.tsx:744-763` |
| F11 | `add_ad_hoc_narrative` gates on `app.is_staff_admin_of` (DEFINER body); `add_ad_hoc_phase` runs INVOKER under `case_phases_staff_admin_write` — Adicionar fase/narrativa are role-locked at the DB | catalog (verified in `8675b7cd`'s message; re-verify) |
| F12 | BUG-QO-STALE-CASOS: `e2e/quality-oversight.spec.ts:569` (no-lockout control, header `Editar`) + `:627` ("Reabrir caso" pairing), both on `${CCIH}/casos/<id>`; `main` e2e:prod red for exactly these two | PROGRESS.md Bug Log |

---

## §2 Step 0 — repair BUG-QO-STALE-CASOS (tester; no app code)

**Goal:** `main`'s e2e declare-green baseline stops being red for a known-stale reason,
**before AFF2 pins its baseline** (the AFF2 plan prefers exactly this ordering).

1. Read the two failing tests and map the pairing structure first (which assertions pair a
   coordinator's *presence* against `quality.a`'s *absence*). The repair must preserve the
   pairing — that is the test's purpose, and a URL-swap alone makes it vacuous (the trap
   recorded in the bug).
2. Re-anchor the `/casos` pairing on the surviving differential affordance: **"Gerenciar
   caso" visible for the coordinator, absent for `quality.a`, same `/casos/<id>` URL.** This
   anchor survives Increments 1–2 (the button remains the manage-capable marker; `quality.a`
   never passes the D3 gate).
3. Move the write-affordance assertions (`Editar` header, `Reabrir caso`) to
   `${CCIH}/manage/cases/<id>` as the coordinator — where `8675b7cd` moved the affordances
   (verified present there, F12 context).
4. Locators: role+name based, never `getByText`; expect re-scoping (the affordances live in
   different containers on manage).

**Acceptance:** `npx playwright test e2e/quality-oversight.spec.ts --project=chromium` on a
fresh `supabase db reset` + dev server: **all tests pass** (was 19 passed / 2 failed); no
other file touched; the pairing still asserts presence AND absence. Record the run in
PROGRESS.md (test-run row + move the bug to resolved per the rotation contract — the
open-section-lingering failure is this repo's chronic one).

**Boundary:** tester-owned spec edit; engineers do not touch it; no app code may change in
step 0 — if the tester finds an affordance genuinely missing on manage, that is a new bug to
file, not a spec to bend.

---

## §3 Increment 1 — routing/UI (frontend + tester; no DB, no migrations)

Implements ADR 0134 D1–D5 + D7. RLS is untouched — every change is UX over unchanged DB
rights (Rule 1). Suggested branch: `feat/case-surface-split-1`.

### T1 — manage-detail entry gate (D3)

`(detail)/layout.tsx:63` becomes: pass iff `access.role === "staff_admin"` **∨**
`access.isAdministrativo` **∨** per-case `canWriteContent`. Notes:

- Cheap checks first; only fall through to the per-case capability probe when needed.
- The per-case probe: prefer the existing `public.case_viewer_capabilities(p_case_id)` (F8)
  through a typed helper in `src/lib/queries/cases.ts` (Rule 9 — **backend** adds the helper
  if missing; frontend consumes it). ⚠ Verify from the catalog that the RPC is
  EXECUTE-granted to `authenticated` and actually returns for a non-coordinator — "a correct
  door nothing can reach" is a known trap; if it fails either test, fall back to the
  `get_case_detail` caps the layout's children already fetch, hoisted once.
- **Single-point predicate:** compute "may open manage for this case" in ONE exported helper
  and use it for both the layout gate and the `/casos` button (T2) — two hand-written copies
  of the predicate is how the button and the gate drift apart.
- **V-A (verification, blocks T1):** determine what `access.role` /
  `access.isAdministrativo` resolve to for an `org_admin` viewing a commission
  (`getCommissionAccessByOrg`). Their `_case_caps` arm is `manage_case_access` only (F7) —
  they must NOT silently pass the new gate. Add a fail-closed E2E for it (T6).

### T2 — `/casos` narrowing extended (D1/D2) + button (D4)

- `case-detail-view.tsx:366`: `readingAsMember = managementElsewhere &&
  (rawCaps.canManageLifecycle || rawCaps.canWriteContent)`; narrowed caps zero both (already
  do).
- `casos/[caseId]/page.tsx:265-268`: the three bypass props are no longer passed through
  role/grant-implied on this host — they render on manage now (their carve-out existed only
  because manage 404'd administrativos; T1 removes the reason). After this, `/casos` writes =
  name-attributed **or member-universal** (⭐ **ADR 0134 Amendment 3, PO-ruled 2026-08-22** — the
  two affordances whose doors admit every member who can open the page: `notify_safety_event`,
  membership-only, and `file_correction_request`, keyed on `can_read_case`, which **is** the page's
  own admission test. Both measured from the catalog; a third claimant must show its guard the same
  way). Assignee checks precede capability checks — ADR 0033 Q14 / CA-002 — untouched.
- Button: visibility = the T1 shared predicate (un-narrowed — the escape hatch must not be
  strandable, `8675b7cd`'s own rule). Label stays exactly **"Gerenciar caso"** for every role
  (D4). `isAdministrativo` reaches the component as a server-computed boolean from the page,
  not a client derivation.

### T3 — manage-detail affordances gated per capability (D1/D5)

For non-coordinator entrants (administrativo, write-grantee), on the manage host:

- **Content cards** (Novo item / Adicionar registro / Anexar documento / tags / events):
  render on raw `canWriteContent` — this is where the write-grantee's affordances move.
- **Adicionar fase / Adicionar narrativa** (the work-card `footerActions` slot): stay
  coordinator-only — their DB doors are role-locked (F11); rendering them for others would be
  a lie the door refuses. Keep the `8675b7cd` principle: the dialog data loads stay *absent
  by construction* for viewers who can't open the dialogs (extend the existing `isOpen` guard
  with the capability condition).
- **Lifecycle** (Concluir / Cancelar / Reabrir): raw `canManageLifecycle` (coordinator) —
  unchanged.
- **Meta (Editar)**: **V-B (verification, blocks T3):** confirm from the catalog which
  authority gates `public.update_case_meta` for an administrativo (ADR 0061 widened it —
  which `member_can` capability?) and mirror exactly that in the `canEditMeta` prop on this
  host. Same exercise for `canAssignPhases` (`assign_case_phases` via `canInCommission`) and
  `canManagePhaseResults` (verify its door's authority — do not guess a cap onto it).
- Subroutes: `correcoes`, `fase/respostas` keep their `staff_admin` gates (fail-closed
  default, D5); interviews keeps its own model (F6). No new subroute opens in this program.

✅ **RESOLVED 2026-08-21 by measurement — "Nova entrevista" keying on `canManageLifecycle` is
NOT an under-grant.** Raised during the build as a possible inverse-of-the-dead-end-door: gating
UI on the coordinator bit where the DB door admits more **strips** an entitled affordance, and
unlike a dead-end door (visible `42501`) an under-grant emits **nothing at all** — no error, no
log — so no gate in §6 can catch it. Measured at **both** reachable doors, which agree:
`public.create_interview` (`prosecdef = t`, so its body replaces RLS) has **exactly one authority
branch**, `app.is_staff_admin_of` — no `elsif`, no second disjunct, no `member_can`; and the
direct-INSERT path (`authenticated` does hold table INSERT) is governed by
`case_interviews_insert` with the **identical** predicate. Empirically, rolled back: an
administrativo holding **all four** capabilities, a per-case write-grantee, a phase assignee, and
an `org_admin` are each refused `42501`; only the coordinator creates. **The gate strips nothing;
D5's "interviews keeps its own model" is correct and now measured rather than assumed.**

Why it is not another `canManageLifecycle` instance: interviews carries its width in a *different*
predicate — `app.can_write_interview` has an interviewer arm the coordinator bit doesn't
represent — but that arm governs **editing an existing** interview, and the detail page already
mirrors it via `viewerCanWrite` → `interview_viewer_can_write` (F6). The arm also cannot bootstrap
into create authority: `case_interview_interviewers_write`'s `WITH CHECK` is `can_write_interview`,
so only someone who can already write the interview can add an interviewer. The creating
coordinator seeds the list.

⚠ **Carry forward to whatever ADR next touches the interview surface (not this program):**
interview READ uses `app.can_read_case_committee` = `can_read_case AND NOT is_oversight_only_reader`,
**not** `can_read_case`. So a `quality_reviewer` reads the case but **not** its interviews —
deliberate (QO·A). If a later increment surfaces interviews on the manage host and gates them on
the case-level read bit, it widens interviews to oversight readers **as a side effect**.

### T4 — `multiplos` re-gate (D5) — ⛔ **AMENDED AT BUILD TIME 2026-08-21 (lead ruling); D5's
letter would build a dead-end door**

~~Mirror the list page (F4): `canInCommission(access, "create_cases")` + the same standing
check; drop the role test.~~ **Measured (backend, V-C/V-D round, live catalog):
`public.bulk_create_cases` is gated by `app.is_staff_admin_of(commission)` ONLY — no
`member_can` arm, no admin arm.** D5 assumed an administrativo holding `create_cases`
*should* reach bulk creation but never measured the door. Re-gating the route on a capability
the door refuses admits an administrativo to a wizard whose commit **always 42501s** — "a
correct door nothing can reach", inverted: a reachable door that refuses. Increment 1 has no
DB changes, so nothing can fix that in-increment.

**Ruling — Increment 1 does the narrowing half only:** drop the `access.context.isAdmin`
bypass (that IS the noun-rule fix, and all V-C actually requires); do **not** add the
capability arm. Narrowing can be wrong and safe; widening cannot. The gate must **mirror what
`app.is_staff_admin_of` admits**, expressed in `access` terms — *not* hand-set to
`role === "staff_admin"`, because "hand-set to the role the plan named" is how a TS gate and
its SQL door drift apart in the first place.

**The exact mirror is `access.role === "staff_admin"`** — measured, not assumed.
`app.is_staff_admin_of` is `app.is_active(uid) AND app.has_role('commission', id, 'staff_admin', uid)`,
and `has_role` is a `memberships` existence test closed with the ACT-hat condition. TS side:
`access.role` is `'staff'|'staff_admin'|null`, populated only from the commission-scoped
partition of `context.memberships`, which is **already hat-filtered** (`hatFilteredGrants`,
`session.ts:336`). So the TS gate reproduces the membership arm *and* the hat arm. The one
predicate it does **not** mirror is `app.is_active` (deactivated/suspended) — the shell routes
those to `/conta-inativa` before any commission route, so it is covered **elsewhere, not here**.
Say that in the PR so nobody later "improves" the gate by re-adding it.

⚠ **TWO sites, and they change together** (backend finding 2 — the plan named only the first):
`manage/cases/multiplos/page.tsx:42-57` (the gate) **and** `manage/cases/page.tsx:169` (the
"Múltiplos casos" *link*). Both frontend-owned; one shared predicate, not two copies.

⛔ **The bypass is already DEAD CODE at both sites — removing it has ZERO behavioural change.**
*(Corrected 2026-08-21: an earlier revision of this section claimed removing it at the gate
alone would leave a `platform_admin` a visible link that 404s. Measured false — they never
reach either site.)* `layout.tsx:110` 404s the whole commission area when
`role === null && !isQualityViewer && !isTenancyAdmin`, and a `platform_admin` has all three
false — `isCommissionAdmin` (`src/lib/auth/access.ts:30-38`) is org/hospital-admin membership
only and deliberately excludes `ctx.isAdmin`. Measured, not inferred:
`e2e/phase-multitenancy.spec.ts:149` (MT-3) is a **passing** spec asserting `platform@` → 404 on
`/o/rede-a/c/ccih`. Site 2 is doubly dead (the list gate at `:85` is
`canInCommission(access,'create_cases')`, which `role: null` / `capabilities: []` already fails),
and `bulk_create_cases` refuses them regardless.

⛔ **Consequence for T6 — do not accept a vacuous pin.** A new E2E of the form "platform_admin
404s on `multiplos`" passes **identically before and after** the removal; green on its first run
against unmodified code IS the finding, not the coverage. If the removal is to be pinned, the
honest pin is **source-level** (no `context.isAdmin` in the cases-area gates) or none at all. The
removal is correct as defense-in-depth and as deleting a false statement from the code — it is
**not** closing a live hole, and the gate record must say so.

✅ **OPEN-2 RULED 2026-08-21 — the PO opened it, under the SAME `create_cases` key** (ADR 0134
**Amendment 1 §A1.2**): *"an `administrativo` role is granted to a responsible healthcare
professional; creating many cases carries the same logical responsibility as creating one."* The
magnitude counter-argument below was put and **rejected**; a separate sixth menu key was declined.
⇒ **Increment 2 gains a second migration:** a `member_can(commission,'create_cases')` arm on
`bulk_create_cases`, through the flag-aware chokepoint (so the kill switch darkens it, as it does
`update_case_meta`), with the **same** pgTAP obligations as S8 including the **over-grant twin**.
**Only then** do `multiplos` + the "Múltiplos casos" link re-gate onto the capability.
⚠ **T4's Increment-1 narrowing is SUPERSEDED, not reverted as an error** — it was correct when
shipped, because the route must never out-run the door. A build record showing T4 tighten then
loosen must say which is which. Text below retained as the record of the decision's inputs:

**~~OPEN-2 — PO ruling needed~~ (RULED — see above):** D5's *actual intent*
(administrativo does bulk creation by capability) needs a `member_can('create_cases')` arm
moved onto `bulk_create_cases`. That is a **widening of administrativo write authority**,
which ADR 0134 **D11** places outside the PO's ratified scope, and outside D6's read-only arm.
It is therefore **not** Increment 2 work on a lead's say-so. Until ruled, bulk creation stays
`staff_admin`-only and D5 is **partially implemented by decision, not by omission** — say so
in the build record rather than letting "T4 done" read as full coverage.

⚠ **For the PO when OPEN-2 is ruled — a magnitude argument, not just a yes/no.** `create_cases`
today authorises creating **one** case. `bulk_create_cases` creates **up to 200 in one atomic
call and assigns them across members**. Hanging both on the same capability key means the
existing `create_cases` checkbox in the appoint dialog silently changes meaning for **every
appointee already holding it** — the capability's name would no longer describe its reach. That
is an argument for a **separate menu key** (a sixth ADR 0061 entry) rather than reusing
`create_cases`, and it is a design question for the ADR, not an implementation detail.

### T5 — row links

Board/list rows (both the `/casos` staff board and `manage/cases`) link to manage detail for
viewers passing the T1 predicate, `/casos` detail otherwise — via one helper beside the T1
predicate. (ADR 0061's "Administrativo board rows → staff `casos/[id]` route" note becomes
historical — its Amendment 1 already says so.)

### T6 — E2E re-anchoring + new coverage (tester)

- `administrativo.spec.ts`: rows → manage detail; caps exercised on manage; `/casos` shows
  read view + button.
- `case-access.spec.ts`: write-grantee content affordances asserted on **manage**; add the
  **differential absence** on `/casos` (present-on-manage / absent-on-casos for the same
  user+case — pins D1 the way `8675b7cd`'s control did).
- New fail-closed entries, one test each: read-grantee → direct-nav `manage/cases/[id]` 404;
  plain member → 404; `quality.a` → 404; org_admin **and `hospital_admin`** per V-A
  (⚠ the arm is `app.is_tenancy_admin_of_for`, which covers **both** — the plan originally
  named only `org_admin`, i.e. one sibling of a two-member axis, which would read as sweeping
  the class); cross-commission id → 404.
- Keyboard-only flow requirement (§8 of CLAUDE.md) applies to the new button path.

⛔ **Not every class in that list can PROVE the new gate — know which gate turns each one away**
(measured 2026-08-21). The manage layout has **two** gates: the new T1 entry predicate, and the
pre-existing `getCaseDetail`-returns-null → `notFound()` at `(detail)/layout.tsx:67-70`. A class
that cannot **read** the case 404s at the second gate regardless, so its test **passes with the
T1 gate deleted** — blind as a pin on T1.

Backend's measurement (differential, 9 personas): **a plain committee member does NOT get
`read_case_content`.** `_case_caps` **S5 confers `read_case_deliberation` only**, and
`app.has_case_capability` is a bare bitmask test with **no lattice closure**. Every seed member
who reads a case does so through S3 (grant) or S4 (phase/narrative assignment) — never through
membership. So the `canRead` arm set is **five, not six**: S1 · S3 · S4 · S6 · S7.

| Excluded class | `can_read`? | Which gate turns it away | Proves T1? |
| --- | --- | --- | --- |
| **read-grantee** (S3, read-only) | **true** | **the T1 gate, alone** | ✅ **load-bearing** |
| **`quality.a`** (S7) | **true** | **the T1 gate, alone** | ✅ **load-bearing** |
| plain `staff` member | false | second gate would 404 anyway | ⚠ passes with T1 deleted |
| `org_admin` / `hospital_admin` | false | T1 fires first, but second gate would too | ⚠ passes with T1 deleted |
| `platform_admin` | n/a | `layout.tsx:110`, before either | ⛔ doubly blind |
| cross-commission | false | earlier still | ⛔ blind |

**Keep all of them** — they pin the boundary against future widening, which is real value. But
**the record must say which two are the proof.** The control that makes it non-vacuous: revert
the T1 gate and require the **read-grantee** and **`quality.a`** tests to go **RED**; the others
will stay green, and that is the expected result, not a failure of the control.

⚠ Consequence for ADR 0134 **D3**'s prose ("a pure read-grantee, a plain committee member, and a
quality reviewer 404 — *their surface is `/casos`*"): true for the read-grantee and the quality
reviewer; **false for the plain member**, who has no case surface at all without a grant or an
attribution. That is ADR 0033 Q3's boundary working as designed (D6 amends it only for
administrativos), not a defect — but do not write an E2E asserting a plain member reads the case
on `/casos`, because they do not.

### Increment-1 gate

Full §6 step 1 on a **fresh reset**: pgTAP (must be unchanged — this increment has no DB
diff; any pgTAP movement is a finding), 8 lint gates, `tsc`, vitest, the four cheap authz
ARMs (`census`/`hat`/`floor` + `FROMFINDINGS=1 wrapper`; no diff-scoped sweep — no policy or
`prosecdef` object changes; if that stops being true, the increment mis-scoped itself —
stop). Then tester: failing + touched specs, and **one full `npm run e2e:prod`** to declare
(never pipe the gate's exit code through `tail`/`echo` — read the gate's own exit).

---

## §4 Increment 2 — the S8 arm + `read_cases` capability (backend + tester)

Implements ADR 0134 D6. Read `docs/progress/authz-handoff.md` §7 first. Suggested branch:
`feat/case-surface-split-2`.

### Pre-work verifications (catalog-first; each blocks the migration it feeds)

- **V-D:** how the 4 capabilities are stored/validated — the `commission_administrativo_capabilities`
  shape, any CHECK constraint, and the validation inside the grant RPC(s). The migration must
  extend every validator, not just insert rows ("cutting a table does not cut its doors" —
  same lesson, additive direction).
- **V-E (Rule 12, blocks everything):** prove `app.can_read_case_patient` does **not**
  derive from `_case_caps`' `read_case_content` (or, if it does, S8 must be explicitly
  excluded there). This lands as a pgTAP pin (P7 below), not as a note.
- **V-F:** the `case.opened` access-audit path (`log_audit_access` allow-list) — confirm an
  S8-derived non-coordinator open emits the row (P6).
- **V-G:** `app.member_can` flag-awareness — S8 must route through it so the `administrativo`
  kill switch darkens the arm (P3).

### M1 — capability vocabulary migration

Add `read_cases` to the validated set (per V-D). ✅ **OPEN-1 RULED by the PO 2026-08-21 — NO
BACKFILL** (ADR 0134 Amendment 1 §A1.1), confirming the recommendation below. Existing appointees
do **not** get `read_cases` retroactively; the coordinator opts in per appointee, so every grant
has a coordinator action behind it in the audit trail.
~~Question was: do existing appointees get `read_cases` backfilled?~~
Recommendation (**adopted**): **no backfill** (the coordinator opts in per appointee; a backfill
widens without coordinator action) — and `supabase/seed.sql` DOES grant it to `staff2.ccih` (the
seed is a contract with ~900 tests; changing personas' reach is a fixture decision, so update
the seed header roster note in the same change).

### ✅ OPEN-3 — RESOLVED BY MEASUREMENT 2026-08-21: **shape (a)**. Rule 12 holds; a conditional dead-end door remains.

**`public.set_participant_patient` is coordinator-only.** `SECURITY DEFINER` (so its body replaces
RLS), and the authority region is a **single branch — no `elsif`, no second disjunct**:
`if not app.is_staff_admin_of(v_case.commission_id) then raise 42501 'apenas a coordenação da
comissão pode registrar dados do paciente'`. Everything after it is shape validation
(`patient_enabled`, `phi_disposed_at`, the `sex` vocabulary, the ADR 0038 name-or-MRN floor), never
authority. Comment-stripped body sweep: **no** `member_can`, **no** `can_write_case_content`, **no**
`is_admin`. Verdicts, evaluated read-only under each persona's claims in a rolled-back transaction:
an **administrativo holding all four capabilities → REFUSED**; a **per-case write-grantee →
REFUSED** (`can_write_case_content` is never consulted on this path).

⇒ **Branch (b) is closed entirely: door 2 CANNOT become a PHI-write widening.** An administrativo
admitted to bulk creation gains **no** patient-identifier write, with no change required. Rule 12
holds as-is.

⛔ **But shape (a)'s dead-end is real, and sharper than a plain `42501`.** The `set_case_patient`
call sits at step **(d)** of the per-row loop — *after* `create_case_from_template`, `activate_phase`
and narrative assignment — and the loop's `exception when others` re-raises as `linha %: %`, which
propagates and **rolls back the entire batch**. So an administrativo on a patient-collecting
template fills up to **200 rows**, commits, and loses all of it to a message naming *"a
coordenação"* — a role the UI had just invited them to act in.
**It is conditional, not universal:** a PHI-free batch never reaches step (d) at all
(`if v_patient is not null`), so it bites only when the template collects patient data **and** at
least one row carries it.

**⇒ OPEN-4 (PO): what happens on a patient-collecting template?** Shipping as-is rebuilds precisely
the dead-end door T4 was overruled to avoid. The options are: suppress the wizard's PHI columns for
administrativos (they bulk-create PHI-free cases someone completes later — mirrors the door
exactly, which is this program's standing principle); or block the capability on patient-collecting
templates (blunter — they lose bulk entirely for that template class); or accept the 42501.
⚠ Consideration for the ruling: under option 1, administrativo-created batches on patient templates
yield cases with **no patient attached**, which someone must fill in afterwards — that may make the
delegation less useful for exactly the templates where bulk matters most.

---

#### Original filing, retained as the record of the question's inputs

**~~⛔ OPEN-3 — BLOCKS door 2 (M-bulk)~~ (RESOLVED — see above). A Rule 12 boundary the OPEN-2 ruling did not reach.**

**Measured 2026-08-21 (backend, live catalog).** `public.bulk_create_cases` accepts a **`patient`
object per row** and calls `public.set_case_patient` — **Rule 12 data**. So the moment an
administrativo may call bulk creation, that PHI path becomes reachable by them.
`set_case_patient` is a **thin compat wrapper with no gate of its own**; it delegates to
`public.set_participant_patient`, where the real authority lives. The outcome is one of two, and
they are very different:

- **(a) `set_participant_patient` refuses them** ⇒ an administrativo can bulk-create only PHI-free
  batches, and the wizard's PHI column picker becomes **a dead-end door inside the widened door** —
  fill 200 rows with patient data, `42501` on commit, whole batch rolled back. Exactly the failure
  shape T4 was overruled to avoid.
- **(b) it admits them** ⇒ an administrativo gains **PHI WRITE** as a side effect of a case-
  *creation* capability. That is a **Rule 12 widening far beyond what the PO ruled**, and outside
  D11's scope as extended by Amendment 1 — the PO ruled that creating many cases carries the same
  responsibility as creating one; they were **not** asked about patient-identifier write.

⛔ **`public.set_participant_patient`'s authority gate is UNMEASURED** — the one fact that decides
(a) vs (b). The local stack was mid-reset under the Increment-1 `e2e:prod` gate. It is one query;
it must be run before M-bulk is written, and it must **not** be inferred from the wrapper's comment
(*"reuse the audited coordinator-only single door"*), which lives in `bulk_create_cases`, describes
`set_case_patient`, and is **already imprecise about the very thing it names** — `set_case_patient`
provably has no gate at all.

**Either outcome is a PO question, not a lead call.** (a) needs a ruling on whether the wizard's
PHI affordance is suppressed for administrativos; (b) needs a Rule 12 ruling the PO has not been
asked for.

⚠ **And when M-bulk is written, rewrite the comment in the same migration.** The current authority
block documents the exclusion as **deliberate**: *"DELIBERATELY STRICTER than
create_case_from_template's own gate … bulk dealing is a coordinator act (Design #9)."* OPEN-2
**reverses a recorded design decision**; left as-is that comment asserts the exact opposite of the
truth, in the file a future reader trusts most.

⚠ Pre-existing, outside this program, noted because it sits one call away: `public.create_case`'s
authority carries an **`app.is_admin()` disjunct** (`is_staff_admin_of ∨ is_admin() ∨
member_can('create_cases')`) — a `platform_admin` creating commission content is noun-rule
territory (ADR 0078 A35) — while `create_case_from_template` has **no** such arm. The two
single-case doors already disagree with each other.

### M2 — the S8 arm

`CREATE OR REPLACE` of `app._case_caps` **starting from the live catalog definition**
(`pg_get_functiondef`) — ⛔ never from a prior migration file's text (bodies are rewritten at
runtime in this repo; the file is stale by design). Insert S8 in the function's own style:
appointed administrativo of the case's commission holding `read_cases` (via the flag-aware
chokepoint, V-G) → `read_case_content` **only**, **and bounded by `not v_eg`** (⭐ **ADR 0134
Amendment 4, PO-ruled 2026-08-22** — an `explicit_grants_only` case is invisible to the arm, exactly
as for S5 `if v_member and not v_eg` and S7 `if not v_eg`; reach there rides an explicit grant S3 or
nothing). Position it with the other positive arms, **after** STEP 4's hard denies, so it inherits
them by position as its siblings do. ⛔ **The bound is the half of the arm nothing else in the gate
set can see** — an omitted sibling check is invisible to every ARM; P9-twin is what proves it. Do not touch `list_cases_board` (its Gate-2
comment forbids caller short-circuits; S8 flows through `can_read_case` per-row as designed).
`get_case_detail` / boards / the T1 predicate all inherit the arm with zero TS changes (F7/F8).

### M3 — after migrations

`npm run gen:types` (Rule 8); appoint-dialog checkbox (frontend: fifth entry, default-checked,
pt-BR label — suggest **"Visualizar todos os casos da comissão"** — plus the badge/roster
rendering wherever the four are listed).

### pgTAP (new numbered suite; every pin below is an ADR 0134 obligation)

- **P1 positive:** administrativo with `read_cases`, ZERO grants/assignments, reads a
  grantless case (`can_read_case` true; `list_cases_board` returns it; `get_case_detail`
  succeeds read-only — `can_write_content` false, `can_manage_lifecycle` false).
- **P2 negative ×2:** capability revoked ⇒ read gone; appointment revoked ⇒ read gone.
  ⚠ **Measured caveat (V-D):** `commission_admin_cap_appointment_fk` is
  `ON DELETE CASCADE` to `commission_administrativos`, so "appointment revoked ⇒ capability gone"
  is **structural** — that half of P2 tests **an FK, not S8**, and would pass with the arm removed.
  Say so, or P2 reads as two independent negatives when it is one.
- **P3 flag-dark:** `administrativo` flag off ⇒ S8 confers nothing.
- **P4 over-grant twin (mutation):** with the arm reverted, P1 goes RED — run under the
  neutralization harness with hash-verified restore (probe must MOVE the hash, restore must
  bring it BACK; the harness's own rollback is proven first).
- **P5 cross-commission:** administrativo of commission A gets nothing in commission B.
- **P6 audit** — ⛔ **REWRITTEN 2026-08-21: as originally specified it cannot fail.** V-F measured
  the coupling: `log_audit_access` **raises 42501** when `_audit_access_authorized` is false, and
  the call sits **inside** `get_case_detail`. So the read and the audit row succeed or fail
  **together, on the same predicate** — **P1 entails P6**, and a bare "a row exists" check asserts
  nothing P1 has not already asserted. It must pin what P1 cannot: the row's **actor / commission /
  entity**, that **exactly one** row is emitted, and the differential that gives it teeth — a
  **coordinator** open emits **no** row (the emission site is `if not v_is_coordinator`). That
  pairing is non-vacuous; existence alone is not.
- **P7 PHI non-leak (the Rule-12 keystone)** — ⛔ **REWRITTEN 2026-08-21: as originally specified
  it is theatre, for two independently measured reasons.** V-E confirms the *property* holds:
  `app.can_read_case_patient` keys on **`read_standard_phi`**, not `read_case_content`;
  `has_case_capability` is a bare bitmask test with **no lattice closure**; and only **S1** and
  **S3** set the PHI bits. S8 therefore cannot leak PHI **structurally**. But:
  1. the plan's **"direct DML"** half is denied by **table ACL** — `patient_identifiers` and
     `patient_participants` grant `authenticated` **nothing at all** and carry **zero policies**.
     That half passes with S8, without S8, and would pass **even if S8 leaked PHI through a door**.
     It is the recorded *"a green gate can mean the fixture cannot reach the failing state"* shape.
  2. bit-disjointness is a property **Postgres guarantees structurally**, and a property guaranteed
     structurally cannot be pinned by asserting it.

  **P7 must be a differential, run THROUGH THE DOORS, never against the table:**
  (i) **positive control** — an S3 grantee holding `read_standard_phi` reads **successfully through
  the same door** at which the S8 subject is denied, proving the fixture can reach the success
  state; (ii) the S8 subject **denied** at that door; (iii) the **over-grant twin** — flip S8 to
  also set `read_standard_phi` and require (ii) to go **RED**.
  **Door set, bounded by property** (every routine whose comment-stripped `prosrc` references
  `can_read_case_patient`) = exactly three: `app._audit_access_authorized`,
  `public.get_case_patients`, `public.get_participant_patient`. The SQL comment names the same
  three; that was **verified, not taken**.
- **P8 authorship bound:** S8 holder cannot write content (a narrative/action-item/document
  write through the normal doors refuses without a grant) — pins D6's "read only".
- **P9 locked-case negative** (⭐ ADR 0134 **Amendment 4**) — an appointee with `read_cases` gets
  **nothing** on an `explicit_grants_only` case: `can_read_case` false, absent from
  `list_cases_board`, `get_case_detail` refuses.
- **P9-twin over-grant, in the BOUND's direction** — remove `not v_eg` from the arm and **P9 must go
  RED**. ⛔ Without this the bound is asserted, not proven, and it is precisely the half no ARM can
  see (a door that omits a check its siblings all make is invisible to every sweep).
- **P10 bit-shape** — on an ordinary case the appointee is **not** `is_oversight_only_reader` (holds
  `read_case_content` from S8 **and** `read_case_deliberation` from S5); on a locked case they hold
  neither. Both directions, because Amendment 4 §A4.2's claim is **derived, not executed** — this is
  what turns it into evidence.
- **P11 the grant path survives** — an explicit S3 grant on a locked case still confers reach to the
  same appointee. The bound narrows the **arm**; it must not narrow the **grant**.
- **Door-set enumeration (not a pin, a deliverable)** — every routine whose comment-stripped `prosrc`
  references `is_oversight_only_reader`, recorded with the increment. ⚠ Size **not established**:
  `file_correction_request` is the one member found while measuring something else. Enumerate by the
  property, never by recalling which doors feel oversight-related.

### Authz gates (§6 step 1, full discipline)

All four ARMs. Diff-scoped door sweep over exactly the changed objects, list derived from the
migration diff (ADR 0079 Amendment 1) — expect the recipe's syntax filter to return a thin or
**empty** list for a resolver-body change (ADR 0129's build hit exactly this); in that case
sweep **by the property**: neutralize S8 alone against the full suite and require red (P1/P4
are what make the arm COVERED instead of blind). `ERROR` is not a pass; BLIND blocks.

### E2E (tester)

`administrativo.spec.ts` additions: board now lists commission cases; open an ungranted case
via manage → read-only shell (content cards absent — pins P8 at the UI); appoint-dialog shows
the fifth capability default-checked; unchecking it empties the board again.

### Docs & records (same delivery, not after)

`docs/backend-state.md` (S8 arm + fifth capability + the changed entry surface) · ADR 0033 /
0061 Amendment-1 stubs → build records · ADR 0134 gains its build-record section (mirror ADR
0129's table: obligation → evidence) · PROGRESS.md per the contract (rows in, completed
material rotated out in the same edit) · decisions-log row for OPEN-1's ruling.

---

## §5 File ownership (binding — CLAUDE.md §4)

| Who | Files |
| --- | --- |
| `tester` | `e2e/**` (step 0 + T6 + Increment-2 specs) — never app code |
| `frontend` | `src/app/**/casos/**`, `src/app/**/manage/cases/**`, `src/components/cases/**`, the appoint-dialog component, `src/components/referrals/case-outbound-referrals-card.tsx` if touched |
| `backend` | `supabase/migrations/**`, `supabase/tests/**`, `supabase/seed.sql`, `src/lib/queries/cases.ts` (the T1 helper), `src/lib/types/**` (gen only) |
| `qa` | `docs/reviews/` report per increment |

Two teammates never edit the same file; shared types move only via `backend`.

## §6 Known traps this program walks past (each has burned this repo)

- **Gate exit codes:** never `gate | tail` or `cmd; echo $?` — a pipe erases the exit code
  and both failures land in the reassuring direction.
- **Shared local stack, one owner:** a `db reset` lands silently in another session's
  evidence; fresh reset before pgTAP (E2E leftovers red the commission counts).
- **"Mine or pre-existing?"** for any e2e failure: `git stash -u`, clear `.next`, rebuild,
  re-run the spec alone. `mode: 'serial'` files swallow their tail — `did-not-run 0` is the
  field that answers coverage, not the pass count.
- **Locator re-scoping:** this program moves affordances between containers twice; every
  moved assertion re-scopes (role+name, container-scoped).
- **Worktree preview:** `preview_start` runs the PRIMARY checkout's launch.json — verify
  worktree UI with headless Playwright, and the Browser pane never hydrates (inert HTML reads
  like a working page).
- **Catalog over text:** migration files and comments are stale by design; `pg_proc` /
  `pg_policies` / ACLs are truth; strip `--` comments before regexing `prosrc`.
- **Tracker docs are `.prettierignore`d** — never format PROGRESS.md/CLAUDE.md/`docs/progress/`.

## §7 Acceptance summary

- **Step 0:** quality-oversight spec fully green on fresh stack; pairing still
  presence+absence; bug rotated to archive; e2e:prod baseline expectation updated in
  PROGRESS.md.
- **Increment 1:** D1's sentence is *observably true* — on `/casos`, for every viewer class, the
  only write affordances are name-attributed ones **or member-universal ones whose door admits
  every member who can open the page** (⭐ D1 **as amended 2026-08-22**, Amendment 3; the ratified
  wording said "carve-outs go to zero" and was false on `main` the day it shipped). Differential
  E2E pins it, and each claimed exception carries a **presence** assertion across two member
  classes — absence-only is what makes an exception unmeasured prose. Entry gate fail-closed for
  all five excluded classes; multiplos reachable by capability; §6 step-1 set green with pgTAP
  unchanged; full e2e:prod declared.
- **Increment 2:** P1–P8 **plus P9/P9-twin/P10/P11** (ADR 0134 Amendment 4 — the `not v_eg`
  bound) green, P4 **and P9-twin** mutation-proven both directions, the
  `is_oversight_only_reader` door set enumerated by `prosrc` property and recorded, sweep 0
  BLIND, ARMs HOLD, board fills for the seed administrativo, docs/records updated in the same
  delivery.

## §8 Non-goals (from ADR 0134 — do not scope-creep them back in)

No lifecycle for administrativo (`close_case`/`cancel_case` coordinator-only) · no
write-grant widening, no per-case `manage` level · no change to action-item completion
authority (D10) · no interviews/corrections model changes · no remote `db push` · no
graphify refresh by teammates.
