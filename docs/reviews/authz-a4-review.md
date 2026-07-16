# QA Review — ADR 0078 Stage A · A4: Organization admin ceases to be a Case Content source

**Verdict: `APPROVED`** (0 P0, 0 MAJOR, 0 MINOR, 2 INFO)
**Commit:** `bf86711` · **Migration:** `20260730000000_authz_a4_org_admin_not_case_source.sql`
**Reviewer:** `qa` · **Date:** 2026-07-16 · **Method:** live catalog + independent behavioural
reproduction from a made fixture (NOT re-running the author's/lead's harness).
**Environment:** 120 files = 120 registered, A4 migration `20260730000000` present, all flags `t`.

---

## Summary

A4 is a **narrowing** — its danger is over-reach (§7.7: a narrowing that denies too much passes
its negative keystone by construction). I attacked over-reach first (does a legitimate principal
still read?) and confirmed the positive twins hold at both the predicate and RLS-row layers, on a
non-vacuous population, while the org-admin source is genuinely gone. Every claim below is quoted
from the live catalog or reproduced from a fixture I built and rolled back — none taken from the
migration text or the A4 report.

The single most decisive result: **org_admin `orgadmin.a` is genuinely a commission admin**
(`app.is_commission_admin_of_for('a0…a1', '…b1') = true` — the fixture is real, he HELD the arm),
yet post-A4 `app.can_read_case(case, orgadmin) = false`, the wrapper `can_read_case_or_admin`
collapsed to `false`, PHI control `false`, while coordinator and member both still read. The
narrowing landed on a principal who really had the reach, and it took nothing from the twins.

---

## What I verified (independent probes, live catalog)

### 1. The 4 function targets — each edited correctly, nothing else touched
Comment-stripped, **unanchored** `is_commission_admin_of` sweep (catches both the bare policy
form and the `_for` function form — the `\y` prefix trap, §7.2·2) over `app`/`public`:

- `app.can_read_case_or_admin` — **absent from the sweep**: org arm fully removed. Body confirms it
  now `return app.can_read_case(p_case_id, p_uid)` behind the verbatim respondent/recusal deny (F1
  collapse — no longer aspirational for this path).
- `app.can_write_interview` — **absent from the sweep**: org arm removed; deny (`not
  is_case_excluded`) precedes the residual `is_staff_admin_of_for` + interviewer arms.
- `app._case_caps` — retains **one** `is_commission_admin_of` reference: the `v_orgadmin :=
  is_commission_admin_of_for(...)` *detection* assignment. The S2 org branch now confers **only**
  `manage_case_access`; `read_case_content` / `read_case_deliberation` are gone, and the PHI bit was
  never there. Hard deny, NSP arm, `is_active` gate, coordinator + member arms all intact.
- `app.can_read_attachment` — retains **one** `is_commission_admin_of_for`: the **meeting** arm
  (`commission_of_meeting`), correctly SURVIVING (A8/A9's unit, not A4). The **interview** arm is now
  `can_read_case(case_of_interview(...))` — org term removed.

No other function lost its org arm (≈119 functions still carry it — the case RPCs, meeting arm,
config catalogs — correctly, per §7.5: A4 is not a blanket sweep). ACLs on all 4 touched functions:
`{postgres,authenticated,service_role}=X` — **no PUBLIC**.

### 2. The 18 policies — all narrowed, `pg_policies` quals read live
- 8 A21 case tables: write policies now `is_staff_admin_of(...) AND NOT is_case_excluded(...)`
  (org arm gone); `_select` policies route `can_read_case_or_admin` (collapsed).
- Interview family (7): writes route `can_write_interview` (+ deny); selects route
  `can_read_interview` / `can_read_case_or_admin` — **neither carries an org arm** (both absent from
  the sweep), so no permissive sibling readmits org_admin.
- `action_items_staff_admin_write`: `is_staff_admin_of OR (is_commission_admin_of AND
  visibility_scope IS DISTINCT FROM 'case_restricted')` — scoped, not deleted (K3).
- 2 storage SELECT policies: org arm removed; `is_member_of` retained (the perimeter unit — see
  Out-of-scope below, correctly NOT A4's).

### 3. Behavioural narrowing + positive twins (RLS-row level, `set local role authenticated`)
Ground truth (superuser, no RLS): CCIH has 5 cases, 5 narratives, 2 interview subjects, 1 committee
action_item — a populated denominator, so the org_admin zeros are **real denials, not vacuous**.

| Principal | cases | narratives | interviews | interview_subjects |
|---|---|---|---|---|
| **org_admin** (genuine commission admin) | **0** | **0** | **0** | **0** |
| **coordinator** (staff_admin, twin+) | 5 | 5 | 2 | 2 |
| **member** (staff) `can_read_case` | true | — | — | — |

### 4. K2 — the "one level deeper than the policy" leak, verified independently
`can_write_interview('f2…e1', orgadmin) = false`, `= true` for the coordinator; `can_read_interview`
false/true respectively. Confirms the 4th function target is load-bearing: policy-only removal would
have been a no-op because the FOR ALL interview policies route this predicate (§7.6).

### 5. K3 — action_items SCOPED, not deleted (both directions, one from a fixture)
- **Committee item readable by org_admin**: the 1 real committee action_item is read by org_admin
  (governance preserved — the over-reach direction A4 must NOT trip).
- **case_restricted discriminates** (built a fixture — CCIH had 0 case_restricted rows, so the
  seeded "reads 0" would have been vacuous, §7.10): a `case_restricted` action_item on a coordinator-
  readable case → **org_admin reads 0, coordinator reads 1**. Rolled back; 0 residue.

### 6. PHI control — never widened, never narrowed
`app.can_read_case_patient` carries **no** `is_commission_admin_of` (comment-stripped). org_admin PHI
reach across **all 5** CCIH cases = 0; coordinator = 5 (non-vacuous). A4 did not touch the PHI door.

### 7. `manage_case_access` kept on scope grounds — keystone-23 independence holds
The bit's only references are `_cap_bit` (definition), `_case_caps` (setter), `case_capabilities`
(debug jsonb projection). **No gate reads it** — 0 functional consumers. So retaining it is a pure
scope decision with no behavioural effect, and the grant-door keystone is independent of it (A36 /
A24·2, catalog-confirmed).

### 8. GAINED = 0 (no widening — the P0 safety property)
Argued **structurally**: every A4 edit is a pure OR-term removal or an added AND-narrowing on a
permissive predicate; such edits can only shrink a truth set, so no cell can flip false→true. All 4
function bodies read well-formed from the live catalog with only the intended edits, and the
migration's own POST guards abort on damage to the hard deny / NSP arm / is_active / meeting arm.
See honest limits below re: the full 1960-cell matrix.

### 9. Sibling test edits — relocated discriminating power, not bent to pass
- **144** (INFO below): org_admin interview reads flipped `1→0` per child — the true post-A4 value,
  which I independently reproduced (org_admin reads 0 interviews under RLS).
- **229**: positive twin moved `sa_y`(clean org_admin, whose interview-write A4 legitimately removed)
  → `sa_x`(clean staff_admin A4 left alone). Keeps the M1-durability axis separate from the
  A4-narrowing axis (§7.7); my K2 probe proves staff_admin write=true, so the twin is non-vacuous.
- **228**: MAJOR-1 control flipped `1→0`; the author explicitly documents that the respondent-org-
  admin blocks are now **over-determined** (0 from deny OR removed arm) and relocates the deny's
  isolation to 234 K9.
- **234 K9**: verified it isolates the deny via **non-org arms** — `sa_x` is MADE the respondent
  (full 4-join `is_case_respondent` chain), AND is coordinator, AND holds a write grant (all three
  PRE legs asserted), then `_case_caps = 0`. The ROWS assertion uses `case_participants` (a pure
  `can_read_case` projection), not `cases`, deliberately avoiding the permissive-sibling trap
  (§7.1·2). K2 in 234 correctly inverted to `false` + added the `manage_case_access` positive twin.

---

## Findings

### INFO-1 — "5 sibling test files" undercounts by one; `144_case_access.sql` is a correct 6th edit
The commit message and handoff §5 A4 row both say *"5 sibling test files updated"* and enumerate
228 / 229 / 171 / 234 / a2-audit — but `bf86711` also edits **`supabase/tests/144_case_access.sql`**
(INFO-N1 block: org_admin interview reads `1→0`). The edit is correct (I reproduced its new expected
values), so this is a documentation off-by-one in the enumeration, not a code defect. Worth
correcting in the PROGRESS/handoff record so the next author's population count matches the diff.

### INFO-2 — pre-existing out-of-scope gaps correctly left and documented (NOT A4 holes; do not re-file)
Confirmed still present in the live catalog, and correctly excluded from A4 per PO sequencing:
- **Exclusion perimeter**: `case_documents_select_member` / `interview_attachments_obj_select_member`
  retain the `is_member_of` arm on a **commission-scoped** path (folder[1] is a commission id) that
  cannot test case-level exclusion. A4 removed only the org arm; the `is_member_of` bypass is the
  exclusion-perimeter unit (after A5). In scope of this note only to confirm A4 did **not** widen it.
- **C7 / action_items recusal**: `action_items_staff_admin_write`'s `is_staff_admin_of` arm still
  lacks an `is_case_excluded` term. Flagged in the migration comment for C7's author. Not A4's.

---

## Honest limits of this review (what my probes could NOT see)

- **I did not reproduce the full 1960-cell (28×7×5×2) A/B matrix.** That needs a pre-A4 snapshot on a
  reset I do not own. I verified the **direction** — org_admin loses, twins keep, PHI control
  unchanged — on a representative sample (one org, CCIH; the 4 predicates; a made case_restricted
  fixture) and argue **GAINED=0 structurally** (removals/narrowings only). I did **not** independently
  measure that `LOST` is exactly 120 and nowhere else; I confirmed the losses are org-admin
  case-content cells and that no twin was collaterally denied.
- **I did not run `a4-mutation-audit.sh`.** Mutating live functions on the single-owner shared stack
  is destructive and outside a read-only reviewer's remit. So the "every keystone can fail" property
  (8/8 RED, each caused by its own reverted arm) rests on the lead's independent verification, not
  mine. My contribution is orthogonal: independent behavioural reproduction of the positive and
  negative semantics from a clean fixture, which the mutation audit does not do.
- **I did not re-run the full pgTAP suite** (2898/2898, lead-verified) — re-running risks the shared
  stack's state. I read the relevant keystones' source (144/228/229/234) rather than executing them.
- **Scope sample**: Rede A / CCIH only; cross-org isolation rests on 171 (which A4 updated to 0
  in-org for cases, noun rule intact), not re-measured here.

All probe transactions were `begin … rollback`; a residue check confirms `action_items` is back to
its single seeded row and the fixture id is absent. The catalog was not mutated.
