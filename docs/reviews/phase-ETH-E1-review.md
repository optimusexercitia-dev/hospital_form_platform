# QA Review — ETH·E1 (Ethics Access Spine — the m2 gate release)

> **✅ FINAL VERDICT: APPROVED — [Round 3](#re-review--round-3-2026-07-14-final) (2026-07-14).**
> All three Majors verified closed by hand. **My round-2 recommended fix was wrong and
> backend was right to reject it** — verified. 2 non-blocking Minors (test coverage).
>
> *Round 1 (CHANGES REQUESTED — 2 Majors) and [Round 2](#re-review--round-2-2026-07-14)
> (CHANGES REQUESTED — MAJOR-3) are preserved below as the original record.*

**Reviewer:** `qa` · **Date:** 2026-07-14 · **Branch:** `pre-pilot-release-s0`
**Scope:** S3 of the Pre-Pilot Release Scope Expansion (ADR 0071); ADR
[0072](../decisions/0072-ethics-access-spine.md) D1–D10 + the m2-flip checklist + §7 M2
posture; build plan `docs/phases/ethics-e1-access-spine.md` §2 contract / §3 BE-1…BE-8 /
§4 acceptance.
**Commits reviewed:** `167b269` (BE-1) · `cc4dc15` (BE-2) · `9f45bb9` (BE-3) · `fe1ba18`
(BE-4) · `9180a27` (BE-5) · `5091d50` (BE-6) · `349379f` (BE-7) · `5fcc442` (BE-8 flag
flip) · `fcbc767` (blank-badge fix) · `28b6cf7` + `1ce93a8` (tester).
**Flags:** flips `case_participants` + `case_types` ON (local only — no `db push` this
phase). Additive / reset-OK.

## Verdict: ❌ CHANGES REQUESTED

**2 Major (both blocking) · 3 Minor · 2 Info.**

The phase is, in almost every respect, carefully built: the DEFINER predicates are
R6-clean, the deny-terms are correctly ordered *inside* `can_read_case` /
`can_read_case_patient` / `can_write_case_content`, the `commission_default` path is
byte-for-byte preserved, the new tables are properly write-locked, t19 is clean on every
new RPC, and the M2 posture ships exactly as recommended. The two Majors are not
craftsmanship failures — they are **gaps between "the predicate is correct" and "the
boundary holds"**, and both were empirically reproduced against the local stack during
this review.

**MAJOR-1 is disqualifying for the m2 flip specifically**: the respondent-exclusion
keystone — ADR 0072 D2's "exclusion cannot be out-voted by any positive arm" — is
out-voted at the RLS **policy** layer for any respondent or recused user who is an
`org_admin`/`hospital_admin`. `can_read_case` returns `false`; the row is still readable.
Since the m2 gate exists precisely to make the layer safe to hold real complaint data,
and the flip (`5fcc442`) has already landed, this blocks.

---

## Dimension 1 — Requirements (ADR 0072 D1–D10 + plan §4)

Almost everything lands. Table below; the two Majors are detailed in Dimension 2.

| Requirement | Status | Evidence |
|---|---|---|
| **D1** — `cases.confidentiality_level` + `visibility_policy`, snapshot at create, immutable-by-default | ✅ | `20260720000980`; both columns default to today's behaviour (`commission_default` / `non_phi_internal`); `create_case_from_template` snapshots type→case; `set_case_confidentiality` is the only mutation door (`HC0E5`). pgTAP (11)/(12) lock snapshot + flag-OFF suppression. |
| **D2** — respondent + recusal hard-deny **first** in `can_read_case` | ⚠️ | Correct **inside** the DEFINER (`20260720001000:95-103`, before the QPS arm). **Out-voted at the policy layer** — MAJOR-1. |
| **D2** — `explicit_grants_only` suppresses the flag-OFF member fallback | ✅ | `:115-124`; else-branch is the prior expression verbatim. |
| **D2** — `commission_default` byte-for-byte | ✅ | Diffed arm-for-arm against `20260710000000` L569/L618 and `20260708000000` L165 — the ON-path arms are character-identical; only a new pre-arm + a new branch keyed on a column defaulting to `commission_default`. |
| **D2** — same deny-terms on `can_read_case_patient` (PHI door) | ⚠️ | Present (`:164-170`), same policy-layer caveat. |
| **D3** — `can_write_case_content` honours both denies | ✅ | `:227-233`. |
| **D4** — `case_recusals` + `case_conflict_declarations`, SELECT-only, DEFINER-only writes | ✅ | See Dimension 3 — verified at the grant layer, not just the policy layer. |
| **D4** — the recusal self/coordinator SELECT asymmetry | ✅ | `20260720000990:86-92`; the self-arm exposes only the recusal row, and the recused user cannot pivot to case content (`get_case_detail` raises `não encontrado` — verified). |
| **D5** — document confidentiality ceiling, grant-based, clearance rides `case_access.max_confidentiality` (O1: the column) | ✅ | See "Accepted deviations" below. |
| **D6** — real participant write authority; `case_participants` stays SELECT-only | ✅ | 4 DEFINER RPCs + `HC0E3`/`HC0E4`/`HC0E7`; no write grant exists on the table. |
| **D7** — IV2 fold-in (participant FK, enforcing confidentiality, O3 remap, attendance/topics/summaries) | ✅ | `20260720001020`; the legacy-3-value normalization trigger is a neat touch — it keeps IV2's `create_interview`/`update_interview` callers working with no RPC reproduction. |
| **D8** — `declare_conflict` / `record_recusal` / `lift_recusal` | ⚠️ | Present + audited; `record_recusal`'s self-arm has no authority gate — MAJOR-2. |
| **D9** — `HC0E0`–`HC0E7` + the new audit verbs | ✅ | All wired, pt-BR messages, PHI-free metadata. |
| **D10** — flip LAST, both flags, + `FeatureFlags` interface | ✅ | `5fcc442` is a 2-line migration; `feature-flags.ts` gains both keys. Local-only as intended. |
| **§7 M2 posture** — no erasure RPC, correction-only, retention-pinned | ✅ | **Verified by absence**: zero hits for `dispose_professional_profile` / `redact_professional_profile` / any `delete from professional_profiles` across `supabase/` + `src/`. `update_professional_profile` is a partial-update correction path (null keeps existing), audited `professional_profile.updated`. Matches the recommendation exactly. |
| **Participant-roles M2M deferred to E2** | ✅ | **Nothing half-built** — no `interview_participant_roles` table, no stub, no dangling FK. `interview_topics` + `interview_summaries` (the other half of D7·4) shipped complete with RLS + grants and are honestly commented as write-RPC-less scaffolding for E2/E3. Clean deferral. |

### The two accepted design deviations — both confirmed as *shipped*, not merely claimed

**(1) The privileged-document ceiling requires clearance even for the uploading
coordinator (D5's grant-based model).** Confirmed in code, not just in the comment.
`app.attachment_confidentiality_ok` (`20260720001000:254-291`) has **no** coordinator arm:
for a `legal_privileged`/`credentialing_sensitive` label the only pass is an unexpired
`case_access` row with `max_confidentiality` ranking ≥ the label. A `staff_admin` who
uploaded the document, holding no clearance grant, is denied. The ceiling is correctly
applied at **both** per-row read paths — `open_attachment` (explicit `HC0E6`) and the
`attachments_select` policy (silent absence from the list) — with the honest comment
explaining why it could not live inside `can_read_attachment` (owner-keyed, cannot see a
row's label). `app.confidentiality_rank` correctly makes it a single comparison, and O2's
two-label scope is respected (`ethics_investigation` stays at ordinary case-read).

**(2) Participant-roles M2M deferred to E2.** See the table row above — a clean deferral.

---

## Dimension 2 — Security / RLS (the blocking findings)

### 🔴 MAJOR-1 — The m2 respondent/recusal deny is out-voted at the RLS policy layer (ADR 0072 D2; Architecture Rule 1)

`can_read_case` is correct. The **policies that consume it are not**. Ten case-scoped
SELECT policies OR an admin predicate *outside* the DEFINER, so the hard-deny inside it
never gets the last word:

```sql
-- public.cases (20260711000800:128 — pre-existing, untouched by E1)
create policy cases_select on public.cases for select to authenticated
  using (app.can_read_case(id, (select auth.uid()))
         or app.is_commission_admin_of(app.commission_of_case(id)));   -- ⟵ out-votes the deny
```

and E1's **own** new predicate reproduces the same shape:

```sql
-- app.can_read_interview (20260720001020:113-119 — authored THIS phase)
    where ci.id = p_interview_id
      and (app.can_read_case(ci.case_id, p_uid)
           or app.is_commission_admin_of_for(app.commission_of_case(ci.case_id), p_uid))  -- ⟵
      and app.confidentiality_clearance_ok(...)
```

**Empirically reproduced** (local stack, rolled-back transaction, seed persona
`orgadmin.a@test.local` = `00000000-…-b1`, seeded case `d0000000-…-c1`):

*Scenario A — the m2 keystone itself.* Insert a `professional_profiles` row with
`user_id = b1`, a `professional` participant, and a `case_participants` row with role
`respondent_doctor`:

```
is_case_respondent            → true
can_read_case                 → false      ✅ the predicate denies
--- as authenticated, JWT sub = b1 (i.e. plain PostgREST with the anon key + user session) ---
select from public.cases           → 1 row    ❌ the respondent reads their own case
select from public.case_interviews → 1 row    ❌
select from public.case_narratives → 4 rows   ❌
```

*Scenario B — recusal.* A live `case_recusals` row for `b1`: `can_read_case → false`,
yet `cases` → 1 row, `case_interviews` → 1 row, `case_narratives` → 4 rows.

**Full blast radius** (`pg_policies`, SELECT policies containing `can_read_case` + an
admin OR-arm): `cases`, `case_events`, `case_narratives`, `case_phases`,
`case_phase_offered_results`, `case_phase_allowed_results`, `case_offered_outcomes`,
`case_tag_assignments`, `case_interview_links`, plus the interview family via
`can_read_interview`. (`case_recusals`' own `is_staff_admin_of_for` arm is the
*intentional* D4 asymmetry — not part of this finding.)

**Why this is blocking and not an inherited-debt note:**

- The OR-arm on `cases_select` pre-dates E1 and E1 did not introduce it. But E1's
  deliverable *is* the property it breaks. ADR 0072 D2 states the contract in absolute
  terms — *"a respondent or recused user who is **also** a `staff_admin` / grant-holder /
  QPS operator is still denied. This is the m2 keystone: exclusion cannot be out-voted by
  any positive arm."* For `org_admin`/`hospital_admin` it is out-voted. The m2-flip
  checklist item 1 is therefore satisfied only under a literal reading ("live in
  `can_read_case`"), not under the property that item exists to guarantee — and the flags
  are already flipped (`5fcc442`).
- **It is client-reachable, not a theoretical direct-SQL concern.** `supabase-js` talks to
  PostgREST with the user's own JWT; a `GET /rest/v1/cases?id=eq.…` from the browser gets
  the row. Architecture Rule 1 is explicit that RLS — not the read RPC — is the boundary.
- The scenario is realistic. A *recused* `hospital_admin` sitting on an ethics panel is
  the ordinary COI case, not a contrived one; a respondent who is a clinical director is
  entirely plausible in a single-hospital org.
- **Mitigating (why this is Major, not Blocker-with-data-loss):** the app's own read door
  is safe — `get_case_detail` as the recused admin raises `caso … não encontrado`
  (verified), so the E2E acceptance criteria genuinely pass and no UI surfaces the case.
  Exposure requires the excluded user to hold `org_admin`/`hospital_admin` **and** to
  query PostgREST directly. Real ethics data has not landed anywhere (flip is local-only).

**Why the test suite missed it** — worth recording, because it is the instructive part:
`228_ethics_e1.sql` asserts the **predicate** (`is(app.can_read_case(...), false)`), never
a table-level `select` under `set local role authenticated`; and every respondent/recusal
persona in both pgTAP and the E2E spec is a plain `staff`/`staff_admin`, never a
commission admin. The tests are green and the requirement is unmet — exactly the gap this
review exists to find.

**Requested change.** Make the deny authoritative at the boundary, not only in the
predicate. The cheapest correct fix is to fold the deny into the admin arm itself rather
than re-audit ten policies — e.g. a `app.can_read_case_or_admin(p_case, p_uid)` DEFINER
that applies the two deny-terms *then* ORs the admin arm, and repoint the ten policies +
`can_read_interview` at it (keeping `commission_default` behaviour identical for everyone
who is not a respondent/recused). Add pgTAP that exercises a real table-level `select`
under `set local role authenticated` for a respondent-who-is-`org_admin` and a
recused-`hospital_admin` — the predicate-only assertions cannot catch this class.

### 🔴 MAJOR-2 — `record_recusal`'s self-arm has no authority gate (cross-tenant write)

`20260720001010:400-408`:

```sql
  if p_user_id = auth.uid() then
    v_source := 'self';                    -- ⟵ no membership / no can_read_case check
  elsif app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then
    v_source := 'coordinator';
  else
    raise exception '…' using errcode = 'HC0E4';
  end if;
```

The self-arm accepts **any** authenticated user for **any** `case_id` in **any**
organization. The sibling `declare_conflict` gets this right
(`:359-361` — `if not app.can_read_case(p_case_id, auth.uid()) then raise 'caso não
encontrado'`), which makes the omission plainly an oversight rather than a design choice.

**Empirically reproduced** — `orgadmin.b@test.local` (Rede **B**, no relationship
whatsoever to the Rede **A** case):

```
can_read_case (B-user, A-case)        → false
select from public.cases (A-case)     → 0 rows    ✅ correctly walled off
record_recusal(A-case, self, 'probe') → 669f0460-…-9aa4   ❌ row written into Rede A
```

Impact: (a) an unrelated cross-org user writes a row into another tenant's
`case_recusals`; (b) each call emits an `app.audit_write` row into **Rede A's** commission
audit trail — foreign-tenant pollution of a hash-chained, append-only Rule-11 log; (c) the
`caso não encontrado` (`P0002`) vs success distinction is a **case-existence oracle** for
any UUID platform-wide. No privilege escalation and self-denial is self-inflicted, so this
is a tenant-boundary + audit-integrity defect rather than a read leak — but it is a
DEFINER RPC writing across the tenant boundary with no gate, which the phase's own §2.3
contract ("all: assert flag · authority gate") forbids.

**Requested change.** Gate the self-arm on reach, mirroring `declare_conflict` — e.g.
`if p_user_id = auth.uid() and app.can_read_case(p_case_id, auth.uid()) then v_source := 'self'`.
Note the ordering subtlety: a user *already* recused cannot re-recuse (the deny makes
`can_read_case` false) — that is correct and `HC0E0` already covers the duplicate. Add a
pgTAP negative: a cross-org user calling `record_recusal` on a foreign case → denied.

---

## Dimension 3 — What is genuinely right (verified, not assumed)

- **R6 discipline is clean.** Every participant/recusal-derived term
  (`is_case_respondent`, `is_recused_from_case`) is a `SECURITY DEFINER` traversing
  `case_participants` → `case_participant_roles` → `professional_participants` →
  `professional_profiles` as **base tables**. No RLS-gated `case_participants` read
  anywhere inside the predicates; no recursion path exists. The ADR-0064 R6
  pre-commitment is honoured, and the `professional_profiles(user_id) where user_id is not
  null` partial index backs the traversal.
- **New-table write lockdown — correct in both directions** (the F1 MAJOR-1 class, checked
  for the *reverse* too, as requested). `information_schema.role_table_grants`:
  `case_recusals`, `case_conflict_declarations`, `interview_session_attendance`,
  `interview_topics`, `interview_summaries` → **`authenticated: SELECT` only**. No
  `anon`, no `PUBLIC`, no INSERT/UPDATE/DELETE to anyone. So the DEFINER-only intent is
  enforced by the *grant*, not merely by the absence of a write policy — a direct
  `INSERT` is denied at the privilege layer before RLS is consulted. No grant is wider
  than the RLS intends.
- **t19 clean on all 13 new RPCs.** `pg_proc.proacl` shows
  `postgres=X service_role=X authenticated=X` for every one — no `DEFAULT (PUBLIC)`
  survivor, no `anon`.
- **Flag-OFF byte-for-byte.** Verified by arm-for-arm diff against the three prior
  definitions **and** locked by pgTAP (11)/(12), which flips `case_types` OFF mid-file and
  asserts the snapshot reverts to `commission_default`.
- **The blank-badge fix (`fcbc767`) is complete and correct.**
  `src/components/interviews/interview-labels.ts` — `CONFIDENTIALITY_LABEL`,
  `CONFIDENTIALITY_STYLE`, `CONFIDENTIALITY_ORDER` each have **all 7 keys, no gaps**
  (`Record<InterviewConfidentiality, …>` where `InterviewConfidentiality =
  ConfidentialityLabel`, so the compiler now enforces exhaustiveness — the type-widen is
  what makes the fix durable rather than a patch). `CONFIDENTIALITY_HELPER_TEXT` no longer
  makes the false claim: the old "não restringe acesso ainda" is replaced with copy that
  correctly scopes enforcement to the two gating labels. pt-BR throughout (Rule 10).
- **M2 posture** — as detailed in Dimension 1: no erasure path exists anywhere. Correct.

---

## Dimension 4 — Minor / Info

- **MINOR-1 — stale "non-enforcing" doc comment (same class as the fixed helper text).**
  `src/lib/queries/interviews.ts:165` still reads `/** IV2: NON-ENFORCING confidentiality
  tag (does not gate access yet). */` on `confidentialityLevel`. BE-6 made it enforcing;
  `fcbc767` fixed the user-facing copy but not this developer-facing one. It is now a
  false statement about a security-relevant field, on the type the E2/E3 implementer will
  read first. Fix with the MAJOR round.
- **MINOR-2 — two orderings of one taxonomy disagree.** `CONFIDENTIALITY_ORDER`
  (`interview-labels.ts:196-205`) is documented "Ascending-sensitivity order" and puts
  `legal_privileged` **before** `ethics_investigation`; `app.confidentiality_rank`
  (`20260720000980:82-97`) ranks `ethics_investigation`=4 **below** `legal_privileged`=5.
  The array does faithfully mirror the canonical `ConfidentialityLabel` union, so the
  *code* is consistent — but the "ascending-sensitivity" **comment** is false against the
  DB's own rank, which is the definition that gates access. Cosmetic today (ordering only
  drives picker order); worth correcting the comment or the array before E2 builds a
  confidentiality picker on it.
- **MINOR-3 — `app.confidentiality_rank` skips the t19 REVOKE→GRANT pattern.** Every other
  new `app.*` function in the phase (`is_case_respondent`, `is_recused_from_case`,
  `attachment_confidentiality_ok`, `confidentiality_clearance_ok`,
  `can_manage_professional`, `can_read_interview`) does `revoke all … from public` then
  grants; `confidentiality_rank` only sets the owner, leaving the default PUBLIC EXECUTE.
  Harmless in substance — it is an `immutable` pure `case` expression over a literal, it
  touches no data, and reaching it needs `app` schema USAGE — but it is an inconsistency
  in a guard the project applies uniformly, and uniformity is what makes the guard
  auditable. Add the two lines.
- **INFO-1 — the `is_admin()` bypass in the two clearance helpers is inert but
  undocumented.** `attachment_confidentiality_ok:271` and `confidentiality_clearance_ok:89`
  both grant on `coalesce(app.is_admin(), false)`. Today this can never *cause* a read:
  both are applied as an **AND** conjunct after `can_read_attachment` / `can_read_case`,
  neither of which grants `platform_admin` (correctly walled off from tenant data per
  §1/ADR 0041), so the first conjunct always denies first. But ADR 0072 D5 does not
  mention an admin bypass, and if any future arm ever gives `platform_admin` case reach,
  this silently becomes a privileged-document grant. Either drop the arm or document why
  the vendor superuser clears legal privilege.
- **INFO-2 — test-evidence composition (flagging as instructed, not objecting).** The
  gate rests on: one full `e2e:prod` run (38 failures — 1 real regression, since fixed; 3
  clusters triaged as the repo's documented Windows standalone-server / GoTrue-warmup
  patterns) + isolated re-confirmation of every touched spec on fresh resets
  (`phase11-interviews` 13/13, `ethics-e1-access-spine` 13/13 + 1 justified skip) + an
  independent full pgTAP run (91 files / 2523 tests, 0 failures). **For the regression
  question this is sufficient** — the fix is a type-widen plus a label map, its blast
  radius is exactly the two specs that were re-run, and a second 38-minute suite would
  re-test untouched surface. The skip of the second full run is a reasonable call and I
  would not block on it. The AC-6 E2E skip is well-reasoned and honestly documented
  (no ethics-interview fixture; the UI wiring is genuinely E2/E3; pgTAP is named as the
  authority) — I accept it. **What the evidence does not cover is MAJOR-1's class**, and
  no amount of re-running the existing suite would have: the assertions test the
  predicate, and the personas are never admins. That is a coverage-shape gap, not a
  run-count gap.
- **Git history** — spot-checked: all 11 commits present, in the stated order, on
  `pre-pilot-release-s0`. The mid-phase branch mishap left no trace. Not a factor.

---

## What is required to clear this review

1. **MAJOR-1** — make the respondent/recusal deny authoritative at the RLS policy layer
   (the ten `can_read_case`-OR-admin SELECT policies + `can_read_interview`), so the m2
   keystone holds for a respondent/recused `org_admin`/`hospital_admin`. Add table-level
   pgTAP (under `set local role authenticated`, admin persona) — not predicate-level.
2. **MAJOR-2** — gate `record_recusal`'s self-arm on `can_read_case`, mirroring
   `declare_conflict`. Add a cross-org negative to pgTAP.
3. **MINOR-1/2/3** — the stale non-enforcing comment, the ordering-comment contradiction,
   the missing t19 pair on `confidentiality_rank`.
4. Re-run `228_ethics_e1.sql` on a fresh reset + the two touched E2E specs. A third full
   `e2e:prod` is **not** requested — the fixes are DB-layer and the affected surface is
   pgTAP's.

Both Majors are contained fixes to a fundamentally sound phase; I expect a fast loop. The
m2 flag flip (`5fcc442`) should be treated as **provisional** until MAJOR-1 lands — which
is harmless in practice, since the flip is local-only and no environment holds real ethics
data (ADR 0064 §m2 respected).

**Re-review requested after the fix loop.**

---
---

# Re-review — Round 2 (2026-07-14)

**Commits re-reviewed:** `35d5da5` (MAJOR-1 + MAJOR-1b + MAJOR-2 + MINOR-1 + MINOR-3) ·
`3d6b5ae` (INFO-1).
**Method:** I did **not** rely on backend's test numbers. Every claim below was
re-established by hand against the local stack (rolled-back transactions, `set local role
authenticated` + a real JWT claim — i.e. the PostgREST path a browser actually takes).

## Verdict: ❌ CHANGES REQUESTED

**1 Major (blocking, NEW) · 0 Minor open · everything from round 1 verified fixed.**

Round 1's findings are **all genuinely closed** — verified with my own exploits, not
asserted. Backend's own **(b)** discovery is real, correctly reasoned, and correctly
fixed; it was a better catch than my enumeration. But the property still does not hold:
an **exhaustive sweep of every case-scoped table** — rather than a grep for either known
shape — surfaced a **third shape** that both of us missed, and it is materially worse than
either original Major, because it needs only **plain `staff` membership** (the canonical
m2 persona) instead of `org_admin`, and what it leaks is **deliberation text**.

---

## 1 — Round-1 findings: verified fixed (by my own hand)

**MAJOR-1 — CLOSED.** Re-ran my exact original exploit (a `respondent_doctor` participant
linked to `orgadmin.a@test.local`, read via the authenticated/PostgREST path):

| Table | Round 1 | Round 2 |
|---|---|---|
| `cases` | 1 row ❌ | **0** ✅ |
| `case_interviews` | 1 row ❌ | **0** ✅ |
| `case_narratives` | 4 rows ❌ | **0** ✅ |
| `case_phases` / `case_events` | — | **0 / 0** ✅ |

Same result for the **recusal** variant. The D4 asymmetry is intact — the recused user
still sees their own `case_recusals` row (1) and cannot pivot from it to case content.
`app.can_read_case_or_admin` is the right shape: denies first, *then* ORs the admin arm,
built on the existing R6-safe DEFINER helpers, with the `revoke…/grant` pair applied.

**MAJOR-1(b) — backend's finding is correct, and the reasoning holds.** I verified the
mechanism independently: PERMISSIVE policies are **OR**-ed and `FOR ALL` **includes
SELECT**, so a `*_staff_admin_write` policy with a bare admin `USING` and no case
predicate hands the row straight back no matter how correct `cases_select` is. My round-1
grep keyed on `can_read_case` and structurally *could not* surface a policy that never
mentions it — backend was right to go past my enumeration, and right that fixing only (a)
would have left `cases`/`case_phases` leaking. `app.is_case_excluded()` is applied as an
`AND NOT` conjunct across 11 write policies + `case_access_select` (self-arm preserved);
my interview-family sweep (`case_interview_subjects` / `_interviewers` /
`interview_sessions` / `case_interview_links`) returns **0/0/0/0** for the excluded user.
That surface is sealed.

**MAJOR-2 — CLOSED, and better than requested.** The cross-tenant write is gone
(`orgadmin.b` → Rede A case now raises `P0002 caso não encontrado`). The **existence
oracle is also closed** — I checked explicitly, and a real-but-unreachable case and a
random nonexistent UUID are now **indistinguishable** (identical SQLSTATE *and* message).
That was the subtler half of the finding and it was handled without being asked.

**MINOR-1 / MINOR-3 — fixed** (including the sibling stale comment in
`interviews/actions.ts` that I missed). **INFO-1 — fixed**: I read the live `prosrc` of
both clearance helpers; the `is_admin()` arm is genuinely gone and clearance now rides
`case_access.max_confidentiality` only. *(Correction to my own method: my first check
pattern-matched `is_admin` and reported a false positive — it was matching the comment
recording the removal. The removal is real.)*

**No-op / regression claim — VERIFIED.** A **non-excluded** `org_admin` retains full
normal access: `cases` 1, `case_narratives` 4, `case_interviews` 1, `case_phases` 2,
`case_events` 3 — and the **write** path still works (`UPDATE 4` on `case_narratives`,
which matters because the `FOR ALL` policies gained a conjunct). `staff_admin`
(`chefe.ccih`) reads `cases` 1 / `narratives` 4 and **retains read on the
`explicit_grants_only` ethics case** (correct — D2 arm 3). No regression.

**MINOR-2 routing — correct, and the guard-rail held.** `app.confidentiality_rank` is
**unchanged**: `ethics_investigation`=4 < `legal_privileged`=5 < `credentialing_sensitive`=6.
I asserted the safety property directly — an `ethics_investigation` clearance does **not**
open a `legal_privileged` document (`false`). Routing the cosmetic fix to frontend as
comment-only is right; the SQL ordering must not move.

---

## 2 — 🔴 MAJOR-3 (NEW, blocking) — `meeting_cases` leaks case deliberation to excluded users

**The third shape, found by sweeping rather than grepping.** Instead of trusting either
enumeration, I enumerated **every `public` base table carrying a `case_id`** (15 tables +
`cases`) and counted rows visible to the excluded respondent. Fourteen returned 0. One did
not:

```
TABLES SWEPT (case_id + cases): 15
RESULT: LEAKS FOUND:
  LEAK: meeting_cases = 1 rows
```

`meeting_cases` is a **third shape** — its policies key entirely on the **meeting**
dimension, with **no case-read predicate at any layer**:

```sql
meeting_cases_select            SELECT PERMISSIVE
  using ( app.is_member_of(app.commission_of_meeting(meeting_id))
          or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)) )
meeting_cases_staff_admin_write ALL    PERMISSIVE   -- the (b) shape, also uncovered here
```

It mentions neither `can_read_case` (so my grep missed it) nor is it a case-scoped
`*_staff_admin_write` (so backend's (b) enumeration missed it). `app.is_case_excluded` is
applied to 12 policies; **`meeting_cases` is not among them.**

**It carries deliberation content**, not merely a link: `columns = (id, meeting_id,
case_id, agenda_item_id, summary text, decision text, created_at)`.

### Why it is worse than MAJOR-1 — it needs only plain `staff`

`meeting_cases_select` grants to any commission **member**. MAJOR-1 required `org_admin`;
this does not. That is precisely ADR 0072's canonical scenario — *"a respondent who is
also a platform user (an internal doctor complained about by a peer) must never read the
case investigating them, **even though they are a commission member**."*

**Proof 1 — the m2 keystone (checklist item 1), plain-staff respondent
(`staff2.ccih@test.local`, role `staff`):**

```
is_case_respondent  → true
can_read_case       → false
cases               → 0 rows        ✅ the MAJOR-1 fix holds here
>>> meeting_cases   → "Deliberacao: conduta do Dr Respondent analisada pelo comite"
                      || "Encaminhar para sindicancia disciplinar"     ❌
```

The respondent reads the committee's discussion of their own conduct **and** the decision
to refer them to a disciplinary inquiry.

**Proof 2 — `explicit_grants_only` (checklist item 3) — and this one needs no respondent
at all.** A plain member of the ethics commission — **not** a respondent, **not** recused,
holding **no** grant — against the seeded ethics fixture (`Denúncia Ética`,
`visibility_policy = explicit_grants_only`, `confidentiality_level = ethics_investigation`):

```
can_read_case       → false
cases               → 0 rows        ✅ item 3 holds at the `cases` table
>>> meeting_cases   → "Deliberacao etica confidencial sobre o Dr X"
                      || "Sancao proposta: advertencia"                ❌
```

This defeats ADR 0072's third core property — *"ethics deliberation is **not** open to
every commission member by default… access is by explicit grant"* — with no respondent
involved. It is a straight failure of E1's own D2 deliverable, not a respondent edge case.

**Blast radius is bounded and known:** the sweep was exhaustive over `case_id`-keyed
tables and `meeting_cases` is the **only** leak; the interview family (keyed on
`interview_id`) is separately confirmed clean. One table, not an open-ended hunt.

### Disposition vs the `action_items` gap being carried to the PO

**I agree with deferring `action_items`, and MAJOR-3 is not the same class** — the
distinction is what separates a scope decision from a blocker:

| | `action_items` (`assignees_only`) | `meeting_cases` |
|---|---|---|
| Who leaks | respondent **who is org_admin** | any **plain member** |
| Gating | a deliberate item-visibility model (assignee **or** admin) | **no case dimension at all** |
| Content | an action item's title/body | the case's **`summary` + `decision`** — the deliberation and its outcome |
| Breaks | checklist item 1, narrow edge | checklist items **1 and 3**, canonical persona |

`action_items`' arm is a designed scope model E1 legitimately does not own; backend's
scope note in `20260720001050`'s header reasons about it correctly and I endorse leaving
it. `meeting_cases` is the case↔meeting join carrying **case deliberation text** with zero
case-dimension gating — that is E1's own property failing, in the module E1 exists to
protect.

### Requested change

Gate the case dimension on `meeting_cases_select` + `meeting_cases_staff_admin_write`.
**Note the two proofs need different things:** an `is_case_excluded` conjunct alone fixes
Proof 1 but **not** Proof 2 — Proof 2 requires the row to consult case read. A single
`and app.can_read_case_or_admin(case_id, auth.uid())` conjunct on both policies closes
both (it subsumes the deny). **Please verify the no-op for ordinary `commission_default`
cases linked to meetings** — that arm currently gives member-wide reach by design, and it
is the regression risk in this change.

Add pgTAP at the **policy layer** for both proofs, using a **plain-staff** respondent (not
only the org_admin personas added in round 2) and a non-granted member of the ethics
fixture.

---

## 3 — Process note (for the record, not a finding)

Round 2's lesson is round 1's, one level up: **I found the shape I grepped for; backend
found the shape I couldn't grep for; only an exhaustive sweep of the data found the shape
neither of us named.** Three shapes, three detection methods. The durable fix is not a
fourth enumeration — it is the habit backend has now started: assert at the **policy
layer** with a real `select`, and answer "which tables can an excluded user see rows in?"
by **sweeping**, not by reading policies. I'd suggest the E2 gate carry a standing sweep
test (iterate every `case_id` table; assert 0 rows for an excluded persona). It would have
caught all three shapes without anyone predicting any of them — and it will catch the
fourth.

**Test evidence:** backend's 119/119 + 2531/2531 is real and I reproduced its substance,
but note it is **green while MAJOR-3 is open** — the new policy-layer assertions use
`org_admin` personas over the `cases` family, so they cover neither `meeting_cases` nor
the plain-staff respondent. Not a criticism of the fix loop; a reminder that a suite tests
the shapes we thought of.

## What is required to clear round 2

1. **MAJOR-3** — `meeting_cases` (both policies), per above; pgTAP at the policy layer
   with a plain-staff respondent **and** a non-granted ethics-case member.
2. Re-run `228_ethics_e1.sql` on a fresh reset. **No full `e2e:prod` requested** — DB-layer
   only, and no UI surfaces `meeting_cases.summary/decision` to these personas.

Everything else is closed. The phase is one small policy fix from approval; the m2 flip
stays **provisional** until MAJOR-3 lands (harmless in practice — local-only, no real
ethics data).

**Re-review requested after the fix.**

---
---

# Re-review — Round 3 (2026-07-14) — FINAL

**Commits:** `02bd2db` (MAJOR-3 + the generic sweep) · `6d6eb58` (frontend MINOR-2 comment).
**Method:** as before — nothing taken on trust; every claim re-established by hand on the
local stack via the authenticated/PostgREST path.

## Verdict: ✅ APPROVED

**0 Blocker · 0 Major · 2 Minor (non-blocking, test-coverage only) · 0 open findings.**

**E1 is sound. Ship it.** All three Majors are closed — verified by re-running my own
exploits, not by reading the diff. The m2 keystones hold. And the most important outcome
of this round: **backend was right to reject my recommended fix, and I was wrong.** I
verified that claim specifically and it is true.

---

## 1 — I was wrong; backend was right (the crux)

I recommended `and app.can_read_case_or_admin(case_id, auth.uid())` on both
`meeting_cases` policies. Backend rejected it as a silent regression. **Verified, and
backend's claim is exactly right:**

```
staff4.ccih (plain CCIH member, no grant/attribution, seeded commission_default case)
  is_member_of_for(case commission)   → true
  can_read_case_or_admin              → FALSE   ⟵ my conjunct would have removed their reach
  can_reach_case_on_member_surface    → true    ⟵ backend's predicate preserves it
  case visibility_policy              → commission_default
  meeting_cases rows actually read    → 1       ⟵ the no-op, empirically
```

My error was assuming `can_read_case` had a plain-member arm. It does not — **by design**
on the `case_access`-ON path. Member-wide reach for an ordinary case comes from the
member-facing surfaces, not from `can_read_case`. My conjunct would have silently deleted
ordinary members' reach of ordinary meeting deliberation — a real regression in
already-shipped, human-approved behaviour, and one my own round-2 report explicitly warned
was "the regression risk in this change" without my realising I had authored it. Backend
tested the recommendation before implementing it rather than complying with it. That is
the correct behaviour from an engineer and it caught my mistake.

## 2 — Is `can_reach_case_on_member_surface` faithful to D2·8, or a rationalization?

**Faithful.** I checked this two independent ways.

**(a) Against the ADR text, clause by clause.** 0072 D2's third structural point specifies
the member-facing reach model verbatim: *"…every member-facing surface that shows case
reach for `commission_default` cases (board, Meus Casos, **meeting case-labels**, timeline
case refs) … gates on `visibility_policy` so an `explicit_grants_only` case is
grant/attribution-only there, while **no `commission_default` case loses reach** (the
change is a no-op for them)."* The predicate implements precisely those three clauses and
adds only the D2 hard-deny in front:

| Predicate arm | ADR clause |
|---|---|
| excluded → `false` | D2 hard-deny ("cannot be out-voted by any positive arm") |
| `explicit_grants_only` → `can_read_case_or_admin` | D2·8 "grant/attribution-only there" (+ D2 arm 3 coordinator/admin read, which I verified is intended) |
| `commission_default` → `is_member_of_for OR can_read_case_or_admin` | D2·8 "no `commission_default` case loses reach" |

`meeting_cases` is not an analogy to D2·8 — it is **named in it**. This is the ADR's
specified semantics, not a post-hoc rationalization.

**(b) Structurally — it *cannot* widen reach, and this is the decisive point.** The
coordinator's concern was that a predicate granting member-wide reach on
`commission_default` is "by construction more permissive than `can_read_case_or_admin`."
True in isolation — but irrelevant here, because the prior meeting-dimension condition is
**preserved verbatim** and the new predicate is **AND**-ed onto it:

```sql
using ( (app.is_member_of(app.commission_of_meeting(meeting_id))          -- prior, verbatim
         or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
        and app.can_reach_case_on_member_surface(case_id, auth.uid()) )   -- new conjunct
```

A conjunction is **monotonically narrower** than its first conjunct. The new policy can
therefore only ever return a **subset** of the rows the old one returned — it is
incapable, structurally, of granting a row that was previously denied, no matter how
permissive the added predicate is on its own. "Quietly widens reach" is not a risk that
exists in this construction. (It also *narrows* cross-commission links — a member of the
meeting's commission who is not a member of the case's commission — which is a tightening,
not a leak.) The write policy correctly keeps the stricter `can_read_case_or_admin`.

## 3 — Both proofs closed; no-op real; keystones re-verified

| Check | Round 2 | Round 3 |
|---|---|---|
| **Proof 1** — plain-staff respondent reads own deliberation | leaked `summary`+`decision` ❌ | **0 rows** ✅ |
| **Proof 2** — non-granted member reads ethics deliberation | leaked ❌ | **0 rows** ✅ |
| **No-op** — plain member reads ordinary deliberation | 1 | **1** ✅ |

While I was in there I also personally exercised the two m2 keystones I had until now only
read, so the whole checklist is now hand-verified rather than inferred:

- **Keystone 5 (participant write authority):** a case reader who is not a coordinator →
  `HC0E4 apenas a coordenação pode gerenciar participantes deste caso`; direct
  `INSERT` → `42501`. Both doors hold.
- **Keystone 4 (document ceiling / D5 deviation):** a **coordinator without clearance** on
  a `legal_privileged` label → `false` (the accepted grant-based deviation genuinely
  ships); the same coordinator on `ethics_investigation` → `true` (O2's two-label scope
  respected).

## 4 — The two sweep exclusions, reviewed on the merits

**`patient_safety_event` — I agree it is genuinely out of E1's scope. It is not an ethics
leak wearing an NSP hat.** I verified the two load-bearing claims rather than accepting
them:

- **No case arm exists.** Live `app.can_read_event` prosrc: `is_member_of_for(current_owner_commission_id)
  OR is_member_of_for(reporting_commission_id) OR is_pqs_operator_of_for(hospital_of_event(...))`.
  Three arms, all event/NSP-dimensional, **zero** case arm. So case-read denial is simply
  not part of this table's model, and a CCIH member's reach predates E1 and is independent
  of any case.
- **It carries no case deliberation.** Columns are the event's *own* record — `title`,
  `description_md` (the incident narrative), status/owner/PHI-disposal fields, plus a
  `case_id` **link**. Nothing equivalent to `meeting_cases.summary`/`decision`.

That is the decisive contrast with MAJOR-3: `meeting_cases` carried *the case's
deliberation* gated on *nothing case-related*; `patient_safety_event` carries *its own
incident record* gated on *its own module's model*. Gating it on case-read would rewrite
NSP/PHI-module-1 semantics E1 does not own — correctly the same disposition as
`action_items`. **Residual channel, for the PO's decision, not a blocker:** a respondent
who independently holds NSP standing could infer *that* a `case_id` link exists on an
event they were already entitled to read. That is link-existence metadata, materially
different in kind from free-text deliberation. Flagging it rather than silently dropping
it was the right call.

**`case_recusals` / `case_access` self-arm narrowing — legitimate, and it did not weaken
the sweep.** This deserved the hard look it was given, and it survives: the narrowing is
`where case_id = $1 and user_id <> $2` — it excludes **only rows the persona owns**, which
are the deliberate D4 asymmetry (a recused member must see *that* they are recused) and
the round-1-preserved self-grant arm. Any **other** user's recusal or grant row on that
case is **still counted**, so the leak the sweep exists to catch remains catchable. This
is a precise carve-out of two documented invariants, not a "make the test pass" edit.

## 5 — Is the sweep fail-closed? Mostly — with one honest limit (MINOR-A)

**Fail-closed where it counts:** the enumeration is catalog-driven
(`information_schema`, never a hand-maintained list), so a newly-added table is swept
**automatically**; any nonzero count fails; the exclusion list is a single documented
entry; and `exception when insufficient_privilege then c := 0` is correct (a table the
role cannot select at all is genuinely not a leak). A future badly-shaped table **with a
row for a probe case** fails automatically, with nobody predicting it. That is exactly the
property I asked for.

**But it can pass vacuously, and does today.** The sweep counts rows `where case_id =
<probe case>`. A table with **no row for either probe case** returns 0 and passes
regardless of how broken its policy is. I measured it against ground truth (as `postgres`,
RLS-bypassing):

```
COVERED (10/14 — sweep is real here):
  case_access case_events case_interviews case_narratives case_offered_outcomes
  case_participants case_phases case_recusals meeting_cases patient_safety_event
VACUOUS (4/14 — passes trivially):
  action_items case_conflict_declarations case_phase_offered_results case_tag_assignments
```

So "fail-closed" is **conditional on fixture coverage** — real for 10 of 14 tables. Worth
noting that **`case_conflict_declarations`, one of E1's own new tables, is currently swept
vacuously** (it is safe by construction — its policy is a bare `can_read_case`, which
carries the deny — but the sweep does not prove it). **MINOR-A:** have the sweep report
tables with zero rows for the probe case as *uncovered* rather than passing them silently,
or seed a probe row per table. Not blocking — the sweep still caught three real things on
its first run and is strictly better than anything that preceded it.

**MINOR-B — a latent trap worth pre-empting.** `patient_safety_event` is excluded with
documented reasoning; **`action_items` is not excluded** — it passes only because it
happens to have no fixture row for a probe case. Both are the same accepted-gap class. The
day someone seeds an `assignees_only` action item on a probe case, the sweep will fail and
look like a regression, when it is in fact the known gap the PO is already carrying.
Either exclude `action_items` with the same documented reasoning as `patient_safety_event`,
or seed it and let the failure stand as the gap's tracking mechanism — but make it a
decision rather than an accident. Neither is blocking.

---

## Closing

Three rounds, three shapes, three different detection methods — and the phase is better
for each. The security property now holds where it is supposed to: I re-ran every exploit
I wrote and every one returns zero, the no-op is real, the keystones are hand-verified,
and the one thing I got wrong was caught by an engineer who tested my recommendation
instead of implementing it. The two Minors are test-coverage hygiene on a sweep that did
not exist a round ago.

**No fourth round is warranted.** MINOR-A/B can be picked up in E2 alongside the standing
sweep, or now if convenient — neither touches the security property. The m2 flip is no
longer provisional: **the gate is genuinely green.** E1 is approved for human sign-off,
which still needs the ADR 0072 §7 **M2-posture PO decision** (no erasure path,
retention-pinned, correction-only), plus the two known gaps to adjudicate:
`action_items.assignees_only` and the `patient_safety_event` link-existence channel.
