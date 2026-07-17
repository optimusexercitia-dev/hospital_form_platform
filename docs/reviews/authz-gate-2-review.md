# ADR 0078 — Gate 2 (Stage C · F1 · N1) — QA Review

**Reviewer:** `qa` · **Date:** 2026-07-17 · **Branch:** `feat/authorization-capability-model`
**Commits under review:** `fee5283` · `456d008` · `ac57a20` · `01d9ef2` · `bb22b45` · `17a8d08`
**Catalog state:** 138 migration files = 138 registered rows (verified — the catalog IS this branch).

## VERDICT: ⛔ **CHANGES REQUESTED**

One **P0** (an Organization User reads a sub-group ethics case's process number and outcome off the
reserved-session door), two **MAJOR**, plus the 228 adjudication — which I resolve **in the lead's
favour, with one correction that matters**.

Every finding below was produced by **execution against the live catalog**, each with a
discriminating control. Reading the code found none of them; the C7 test suite is green over the P0.

---

## 1. The P0 — C7/A8 is implemented in the policies and **reversed in the DEFINER doors**

**Requirement violated:** A8 — *"An Organization User (`org_admin` · `hospital_admin`) reads **no
meeting record** — no metadata, no ata, no agenda, no attendance, no signatures, no meeting
attachments."* Appendix B: Organization User × Meeting metadata = **None**; × Meeting content = **No**.
Plan C7 names `meetings` · `meeting_agenda_items` · `meeting_cases` explicitly.

**The policy layer is correct.** `app.is_commission_admin_of` (= `org_admin OR hospital_admin`,
catalog-verified) is gone from every `meeting*` `_select`, and C8's `FOR ALL` re-cut is real — the
four policies are now split into per-command INSERT/UPDATE/DELETE, so SELECT no longer returns
through the side door. That work is sound.

**Four surfaces put the arm back.** All are `prosecdef = t`, so **RLS never runs** and the policy fix
is bypassed entirely:

| Surface | Live gate |
|---|---|
| `public.get_meeting_agenda_items` | `if not (app.can_reach_meeting(...) **or app.is_commission_admin_of(v_comm)**) then return;` |
| `public.get_meeting_cases` | *idem* |
| `public.get_reserved_session_items` | *idem* |
| `public.meeting_closed_sessions_select` (policy) | `can_reach_meeting(...) **OR app.is_commission_admin_of(...)**` |

**Proven, as `orgadmin.a@test.local` (precondition asserted first: `is_commission_admin_of = t`,
`is_member_of = f`, `can_reach_meeting = f`):**

```
### base-table RLS reads — C7 closed these
 meetings_rls | mcases_rls | agenda_rls | closed_sessions_rls
            0 |          0 |          0 |                   0     ← the suite asserts exactly this

### the DEFINER doors
 agenda_rpc |       title        |             description
          2 | Indicadores do mês | Revisão das ações da última reunião.
 cases_rpc |            decision
         1 | Encaminhar para a próxima fase.
```

And against a made reserved-session fixture on an `explicit_grants_only` ethics case:

```
### ORG ADMIN — get_reserved_session_items
 process_number | withdrawals | substance | decision
              5 |             |           | Arquivado
```

**A non-member Organization User reads the process number and the outcome of a sub-group ethics
case.** That is D11's re-identification triad (number + date + outcome) delivered to a principal
*outside the committee entirely*. A26 licenses number+decision **member-wide**; this principal is not
a member (proven `is_member_of = f`), so A26 does not reach it and A8 forbids it outright.
(`withdrawals` is correctly masked — A26's propriety split is working. The tiering logic is right;
its **outer gate** is wrong.)

**Why the suite is green over it — this is the important part.** `245_authz_c7_org_user_meeting_surface.sql`
K17 asserts:

```sql
select is((select count(*)::int from public.meeting_agenda_items where meeting_id='…c7a0'), 0,
  'K17 ⭐ ROWS: …ZERO agenda items');
```

**No assertion in the file calls any of the three RPCs as the org_admin.** K17 asserts zero on the
path the product does not use, while `src/lib/queries/meetings.ts:660` (`get_meeting_agenda_items`),
`:772` (`get_meeting_cases`) and `:991` (`get_reserved_session_items`) — the path it *does* use —
return the data. This is handoff §7 verbatim: **`prosecdef` belongs beside `pg_policies`; a DEFINER's
gate replaces RLS, so a policy-shaped audit is structurally blind to it.** The C7 keystone is a
policy-shaped test over a DEFINER-door surface.

**The only thing standing between an Org User and this data today is a Next.js 404.** `01d9ef2`'s own
message: *"the 'Reunioes' nav item and the /meetings routes are hidden (404) for non-members"*. These
RPCs are `authenticated`-granted and PostgREST-reachable at `/rest/v1/rpc/…`. That is **Architecture
Rule 1** — *never rely on UI hiding* — and it is phase-blocking.

**The design intent is not in doubt.** `open_reserved_session`'s own body says
`-- coordinator-only: NOT administrativo, NOT Organization User.` The write door states the rule the
read door breaks.

### Required
1. Drop `or app.is_commission_admin_of(v_comm)` from `get_meeting_agenda_items`,
   `get_meeting_cases`, `get_reserved_session_items`.
2. Drop the `OR app.is_commission_admin_of(...)` arm from `meeting_closed_sessions_select`.
3. Drop the same arm from `get_case_meeting_links`' inner filter. **Latent, not live** — its
   `can_read_case` pre-gate denies the org admin (verified `can_read_case = f` on both an ordinary and
   the ethics case, so A4 holds). Remove the dead arm rather than leave a re-arming trap.
4. **Extend 245 to call each DEFINER door as `st_y`**, not just the base tables — otherwise the fix is
   unfalsifiable and this recurs. Keep K20's no-over-reach twin (configuration must survive — A10).

---

## 2. MAJOR-1 — `meeting_agenda_items.description` is unmasked, and PHI-BEARING by its own comment

C2/A3 gates `discussion_notes` and `.resolution`. `app._project_meeting_agenda_item` masks exactly
those two plus `title`, and the base table REVOKEs the same three from `authenticated`. **`description`
is neither masked nor revoked** — and it carries the *identical* column comment:

> `PHI-BEARING free text (WS B; Rule 11/12). Planned agenda-item content (multi-line); audited via meeting.viewed; never copied into the audit log.`

**Proven** — as a **made** respondent (`staff4.ccih`, `is_case_respondent = t`, `can_read_case = f`,
`reaches_meeting = t`) on the agenda item linking his own ethics case:

```
 position |          title          |             description              | discussion_notes | resolution
        1 |                         | Apresentação das taxas de infecção.  |                  |
```

`title` correctly masked (O6 working); `discussion_notes`/`resolution` correctly masked; **`description`
returned in full**. This is A3's own argument one column over: with the other three boxes closed,
`description` is now the **only** free-text field on a case-linked agenda item, i.e. the natural place
to type. The set was **enumerated to the brief's two names, not closed over the population** — §7.5,
and A11's *"adjacent-column route"*.

**Required:** mask `description` on the substance tier in `_project_meeting_agenda_item` (same
predicate as `discussion_notes`), REVOKE it from `authenticated`, and keystone it in `242`. If the PO
rules `description` is pauta-planning rather than substance, the **column comment must lose
"PHI-BEARING"** — a rule and its data cannot disagree.

---

## 3. MAJOR-2 — reserved-session content escapes the meeting child lock

`app.guard_meeting_child_lock` is attached to `meeting_agenda_items`, `meeting_attendees` and
`meeting_cases`. It is **not** attached to `meeting_closed_sessions`, `meeting_closed_session_items`
or `_item_readers`, and `open_reserved_session` / `add_reserved_item` gate on `is_staff_admin_of`
alone with **no meeting-status check**.

**Proven on a `distributed` meeting, one transaction, with the sibling as the control:**

```
>>> AGENDA INSERT BLOCKED: 23514 / o conteúdo desta reunião está bloqueado (distributed)
>>> open_reserved_session SUCCEEDED on a distributed meeting
>>> add_reserved_item SUCCEEDED on a distributed meeting — INTEGRITY GAP
```

The control discriminates: ordinary agenda content **cannot** be authored into a signed and
distributed ata; the **most confidential content in the model can**. The composed ata renders the
reserved tiers (`01d9ef2`) and `meeting_signatures.content_hash` signs the record — so a coordinator
can append deliberation to an ata that has already been signed and distributed, without invalidating
the signature. For an accreditation product whose entire value is the integrity of the governance
record, that is a MAJOR.

This answers the lead's question directly: **yes, coordinator-gated-but-not-status-gated is a real
integrity gap vs agenda/case authoring**, and it is measurable, not theoretical.

**Required:** attach `guard_meeting_child_lock` to the three reserved tables (it keys on `meeting_id`,
which all three reach — `_item_readers` needs a join or its own guard), and keystone the
post-distribution write in `243`.

---

## 4. THE 228 ADJUDICATION (tests 115–118) — **the lead's read is CORRECT; one correction is load-bearing**

**Disposition: Proof 1 — the CODE is wrong. Proof 2 — the TEST is wrong. Both, but not symmetrically.**

### Proof 2 (tests 117, 118) — **the test is wrong. Delete the row-count assertion.**

Test 117 asserts a non-granted member reads **ZERO** `meeting_cases` rows for an
`explicit_grants_only` case. **A26 (PO-ruled), A5's decision tier, A6, and keystone 16 all say the
opposite** — keystone 16: *"a member without substance reach on a sub-group case **still reads the
decision**."* If 117 were satisfied, keystone 16 would necessarily fail. Two keystones from the same
ADR cannot both hold; A26 is the later PO ruling and wins.

**⚠ My first Proof-2 probe was poisoned and read the way the test wants.** I used `staff1.ccih` and
got `decision = NULL` — apparent confirmation that the code already denies. It does not:
`staff1.ccih` carries a **seeded recusal on that exact case** (`case_recusals` row `fe000000-…e1`), so
`is_case_excluded = t` and I was measuring the **recusal** arm, not the non-granted arm. §7.1 trap #1,
in the falsely-confirming direction. Re-run with a **clean** persona (`staff2.ccih` — precondition
asserted: `excluded = f`, `respondent = f`, `read_case_deliberation = f`, `member = t`):

```
### CLEAN NON-GRANTED MEMBER (staff2) — 228 test 117 asserts ZERO rows:
 meeting_cases_rows: 1
### live projection:
 summary | decision
         | Sancao: advertencia      ← summary masked (A15/C1 ✓), decision visible (A5/A26/K16 ✓)
```

**The live code is exactly right here.** `summary` masked, `decision` projected, and the base table
REVOKEs both columns from `authenticated` (`permission denied for table meeting_cases` on a raw
select) — column-REVOKE **plus** RPC projection, genuine defence in depth.

**Fix 117/118:** replace the row-count with **column-level** assertions — the row IS readable;
`summary` masked; `decision` **non-null** (pinning A26/K16, which nothing currently pins). Give the
118 sweep a documented `meeting_cases` exclusion in the same style as its existing
`patient_safety_event` / `case_recusals` / `case_access_grants` notes, stating that A6 rules meeting
linkage a **procedural record** and that the payload is column-masked — then assert the masking.
Do **not** silently drop it; the sweep's fail-closed design is good and worth preserving.

### Proof 1 (tests 115, 116) — **the code is wrong. The test stands.**

**Proven** with the made respondent fixture:

```
### RESPONDENT (staff4) reads meeting_cases for HIS OWN case — test 115 asserts 0:
 rows | own_case_id_leaked                   | agenda_link_leaked
    1 | ca000000-…-e1                        | a89c2c65-…
```

`summary`/`decision` are correctly masked, so the payload is safe — but the **linkage** is not.
A7/O6 rules the respondent gets the **bare stub only — no number, no withdrawal list, no times**.
`meeting_cases` has no stub role: its unmasked columns *are* the linkage
(`case_id`/`meeting_id`/`agenda_item_id`), which is the process number's UUID equivalent. And the
linkage is not inert — `agenda_item_id` walks straight to that item's **unmasked `description`**
(MAJOR-1), so the two findings compose into a live chain from "my case was on the pauta" to
free text about it.

A6 does **not** license this: A6 licenses *members* seeing that a case exists, and explicitly reserves
the respondent question to A7/O6, which answers it **no**.

Denying the row creates no "gap" — A7's *stub-never-a-gap* requirement is satisfied by the
`meeting_agenda_items` row, which persists with `title` masked and renders as *"3. Sessão reservada"*.

### ⛔ The correction — the fix is `is_case_respondent`, **NOT** `is_case_excluded`

The brief says *"add the **respondent/excluded** denies"*. **Do not add `is_case_excluded` at the row
layer.** `is_case_excluded` = respondent **OR recused**, and A7 states the asymmetry twice, in bold,
because it is the trap:

> *"a reader who reaches for the familiar `is_case_excluded` here will silently blind every recused
> member to the record of their own recusal."*

Keystone 10 requires the recused Ana to see item 4's shell **including her own recorded withdrawal**.
`is_case_excluded` at the row layer would break it. The correct cut:

```sql
-- meeting_cases_select
app.can_reach_meeting(meeting_id, (select auth.uid()))
  AND NOT app.is_case_respondent(case_id, (select auth.uid()))
```

The `is_case_excluded` term belongs on the **`decision` column only**, where
`app._project_meeting_case` **already has it, correctly**. Nothing to change there.

### Verification of the proposed cut against all four properties

| Property | Under `NOT is_case_respondent` |
|---|---|
| **NO-OP** (228:834, plain member × ordinary case) | not respondent → row visible → count 1 ✅ **holds** |
| **Proof 1** (115/116, respondent × own case) | respondent → row denied → 0 ✅ **goes green** |
| **Proof 2** (117/118, non-granted member × ethics) | not respondent → row visible → **still red → rewrite the test** |
| **Keystone 10** (recused sees her own withdrawal) | not respondent → row visible, summary+decision masked ✅ **preserved** |

**Concrete disposition:** one migration adding the `NOT is_case_respondent` conjunct to
`meeting_cases_select`; 228 tests 115/116 flip green unchanged; 117/118 rewritten column-level as
above; add a mutation case (revert the conjunct → 115 must go red) so the fix is falsifiable — per
§7.1, an unmutated keystone is not evidence.

---

## 5. What I verified as sound

- **C8 · `FOR ALL` re-cut** — real. All four policies split per-command; SELECT no longer leaks.
- **C1 tiering** — `_project_meeting_case` splits `summary` (`read_case_deliberation` — A15, *not*
  `read_case_content`) from `decision` (`NOT is_case_excluded`) exactly as the plan's flagged
  reconciliation requires. Keystones 5 and 16 both pass only under this split, and it is what shipped.
- **C5 tiers** — `get_reserved_session_items` implements A26 correctly: number at
  `NOT is_case_respondent`; withdrawal **names** at `NOT is_case_respondent AND (commission_default OR
  read_case_deliberation)`. The `case_id IS NULL` reader-list branch is present on **both** substance
  and decision (A24·4). This is a faithful implementation of a genuinely hard spec.
- **C4/C5 storage** — `meeting_closed_session_items` and `_item_readers` have **no `authenticated`
  grant at all** (`relacl` = postgres/service_role only). The RPC is the sole door, as A7 requires.
- **`ac57a20` VOLATILE** — `get_reserved_session_items.provolatile = 'v'` confirmed; the audited-read
  door writes under PostgREST.
- **`17a8d08` anon-EXEC ACL** — swept: **0** functions in `public` with an `anon=` ACL or a null
  `proacl`. Clean.
- **F1** — all five predicates exist; `set_referral_patient` has **no `authenticated` grant**
  (`{postgres=X,service_role=X}`) → removed from the public API as D7 requires.
- **N1** — correct, and correct in the way A24·2 warned was easy to get wrong: `_case_caps` S6 confers
  `read_case_content | read_case_deliberation` and **not** `read_standard_phi`. NSP keeps content,
  loses PHI; Stage A did not silently revoke NSP content reach.
- **`bb22b45`** — `can_read_case_or_admin` retired; no residual references.
- **Rule 9** — meeting reads flow through `src/lib/queries/meetings.ts`; no inline supabase-js in
  components.
- **`useMeetingAction` (Fix #1) — correctly scoped.** `src/components/meetings/use-meeting-action.ts:64`
  re-throws `NEXT_*` digests before the catch-all, so `redirect()`/`notFound()` still reach the
  framework; the fallback is pt-BR (`:10`); and the comment honestly records that it is **hardening,
  not** the fix for the hang. I agree on all three counts. This is the right shape.
- **BUG-PROD-ACTIONS classification — I concur.** Read-only/direct-RPC paths return in 100–900 ms
  while UI mutations hang; reproduced on `phase10-meetings` and `cases-extras`, both of which predate
  Stage C. It is app-wide and not a Gate-2 defect. Its own P0 pre-pilot unit is the right call.

---

## 6. MINOR / INFO

- **MINOR-1 — `get_reserved_session_items` projects `started_at`/`ended_at`/`case_id` to the
  respondent.** A7: the respondent sees the bare stub — *"no number, no withdrawal list, **no
  times**."* A26 later reclassifies *"item reserved, quorum held, times"* as the **non-identifying
  stub**, which licenses times for a **non-granted member** — but A26 was ruling on the member, not
  the respondent, so A7's "no times" for the respondent is unsuperseded. Low severity (times alone
  re-identify nothing once the number is masked). **Either gate times on `NOT is_case_respondent` or
  have the PO amend A7's tier row.** Do not leave the documents contradicting each other.
- **INFO-1 — the A6 widening is correctly implemented and correctly recorded.** `meeting_cases_select`
  member-wide + mask-only is what A26 intends for members. My P0 is not about members; it is about
  a **non-member** reaching the same surface.
- **INFO-2 — `meeting_closed_sessions` has authenticated `r` at table level** while its two children
  have none. Consistent with A4·1 (the block is governance metadata carrying no authorization) — fine
  once the org arm comes off its policy.

---

## 7. Open risks

1. **The DEFINER-door blind spot is a class, not an instance.** C7 was verified against `pg_policies`,
   and three DEFINER doors re-added the arm underneath. Before Gate 2 closes, sweep **every**
   `prosecdef = t` function reachable by `authenticated` whose body mentions `is_commission_admin_of`,
   and classify each as legitimate configuration (A10) or a C7 target. **Classify per-function
   behaviourally — a text filter is not the population** (§7.5; A21's closure error, twice).
2. **Nothing pins A26.** Its member-wide number/decision is a **deliberate widening** with no keystone.
   The rewritten 117/118 should become that pin — otherwise a future reviewer reads the same leak I
   did, "fixes" it, and silently reverses a PO ruling. A6's *"Recorded so it is not 'fixed' later"* is
   prose; a keystone is enforcement.
3. **The composed ata is signed but not frozen** (MAJOR-2). Worth a PO decision on whether
   `content_hash` should cover reserved items at all.

---

## 8. Summary

| # | Severity | Finding |
|---|---|---|
| 1 | **P0** | Org User reads the meeting surface — incl. a sub-group ethics case's process number + outcome — via 3 DEFINER doors + 1 policy. C7 green because the keystone is policy-shaped. Rule 1 (UI-only gating). |
| 2 | **MAJOR** | `meeting_agenda_items.description` unmasked, PHI-BEARING by its own comment; respondent reads it for his own case. |
| 3 | **MAJOR** | Reserved-session content bypasses the meeting child lock — authored into a signed+distributed ata. |
| 4 | **MAJOR-3 adj.** | 228: Proof 1 = code wrong (add `NOT is_case_respondent`, **not** `is_case_excluded`); Proof 2 = test wrong (rewrite column-level; A26/K16 say decision is member-wide). |
| 5 | MINOR | Respondent receives times/`case_id` from the reserved door (A7 vs A26 unreconciled). |

Findings 1–3 are all **new**, all **behaviourally proven**, and all sat under a green suite —
including one that reads the number and outcome of an ethics case to a principal outside the
committee. The Stage-C tiering logic itself is careful, faithful work; what failed is the **outer
gate** and the **closure of the column set** — the program's two recurring shapes.

Re-review on fix: I will re-probe findings 1–3 behaviourally and require the 228 mutation case.
