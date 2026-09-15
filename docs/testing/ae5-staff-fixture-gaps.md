# AE5 increment 1 (`staff`) — fixture-gap report

**Phase:** AE5 increment 1 · **unit:** [`AE5-STAFF`](../features/ae5-staff.md) · **task:** T13 (the
read-only half) · **input to:** backend's T4 (seed migration) · **owner:** tester · **status:**
read-only, no DB write, no `supabase db reset` this round · **derived:** 2026-09-13 · **stack:**
local, the reset backend holds; every query below is a read-only
`docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`,
no transaction opened, nothing mutated · **sources:**
[`authz-ae5-staff-permission-matrix.md`](../design/authz-ae5-staff-permission-matrix.md) §§ 4.3, 5.2,
5.3, 8.2, 9.1a, 11 ·
[`authz-ae5-staff-deny-class-effects.md`](../design/authz-ae5-staff-deny-class-effects.md) §§ 3–4 ·
`supabase/tests/vectors/authz-matrix-axes.json` · `supabase/seed.sql:590-660`.

> ⛔ **Read this as a work list, not a narrative.** Each coordinate is marked **SEEDED** (a live
> principal/resource already sits there — email + uuid + `seed.sql` line quoted) or **FIXTURE
> NEEDED** (the exact rows to insert, stated so T4 can act without re-deriving anything). ⛔ Per the
> plan (`docs/plans/authz-evolution.md:1144-1147`): **no fixture id may be shared across cases.**

---

## 0. Method

Every SEEDED claim below was either (a) read verbatim from `supabase/seed.sql` and cross-checked
against the live `memberships` / `profiles` / `cases` / `meetings` / `action_items` /
`case_access_grants` / `accreditation_frameworks` tables, or (b) taken from the matrix's own
measurement (§ 8.2, § 4.3) and independently re-verified this round where noted. Every FIXTURE
NEEDED claim was checked against the live catalog first — several of these tables hold far fewer
rows than the matrix's prose implies, and that sparsity is itself the finding.

---

## 1. `persona` axis (`authz-matrix-axes.json` § `axes.persona`)

| value | status | detail |
| --- | --- | --- |
| `subject_holder` | **SEEDED, clean** | `staff4.ccih@test.local` (`00000000-0000-0000-0000-00000000000a`, `seed.sql:627`) — single CCIH membership, `app._case_caps` = `2` only (§ 8.2), no administrativo, no case grant, no second role. **Recommended default.** Also clean: `ativo.registro@test.local` (`00000000-0000-0000-0000-0000000000d2`, `seed.sql:636`). |
| `other_commission_holder` | **SEEDED, verified clean this round** | `staff1.farm@test.local` (`00000000-0000-0000-0000-000000000006`, profile `seed.sql:162`, membership `seed.sql:618`) or `staff2.farm@test.local` (`00000000-0000-0000-0000-000000000007`, profile `seed.sql:163`, membership `seed.sql:619`) — `staff` of Comissão de Farmácia (`b0000000-0000-0000-0000-0000000000b1`), same org (Rede A) as CCIH, different commission. Live-queried this round: each holds **exactly one** `memberships` row (`b1`, `staff`) — no second commission, no admin role. Neither was covered by the matrix's own § 8.2 sweep (that sweep is CCIH-only); this is new verification. |
| `cross_org_actor` | **FIXTURE NEEDED — true of every role, not staff-specific** | `authz-matrix-axes.json:35,39`: *"NO SEEDED PERSONA HOLDS ANYTHING OUTSIDE ITS HOME ORG … FIXTURE-ONLY, no seeded persona can fill this."* Verified for `staff` specifically: the only org-B `staff` grant is `staff1.qual.b@test.local` (`00000000-0000-0000-0000-0000000000b3`) holding **both** `staff` at Qualidade B (`c0000000-…-c1`, `seed.sql:604`) **and** `staff_admin` at Farmácia B (`c0000000-…-c2`, `seed.sql:631`) — live-queried this round, confirmed two rows, no clean org-B `staff`-only principal exists at all. ⇒ **rows to insert (T4, per 403's own fixture-owned-id convention — new `auth.users` + `profiles` + one `memberships` row, ids that collide with nothing else, never `b3`)**: one principal with `staff` at an org-B commission (`c1` or `c2`) and **no other membership anywhere**. |
| `unprivileged` | **NEEDS CONFIRMATION** | Every obvious "no commission role" candidate carries a contaminating grant of its own for this purpose: `orgadmin.a@test.local` is `is_tenancy_admin_of` CCIH's org (grants via the row 13/14/15/16/22 preserved tenancy arm — masks the "holds nothing" signal on exactly the rows that matter); `platform@test.local` is `is_admin()` (short-circuits `app._audit_access_authorized` and is excluded from this matrix by the noun rule, but untested against the RLS surface this round). No persona with **zero** memberships and **zero** admin roles was confirmed this round. ⇒ recommend T4 either name one from the existing roster (a live query for `profiles` with no `memberships` row and no admin flag, not run this round) or add one, distinct id. |
| `anonymous` | **SEEDED — mechanism, not a row** | The `anon` Postgres role itself; no principal needed. Deny-class doc § 3 Limitation C (re-confirmed by the matrix): `anon` holds no `USAGE` on schema `app`, so `is_member_of` is unreachable **before** the predicate runs — a structural deny, not a data fixture. |

---

## 2. `principalState` axis

| value | status | detail |
| --- | --- | --- |
| `active` | **SEEDED** | Any ordinary persona, e.g. `staff4.ccih@test.local`. |
| `pending` | **FIXTURE NEEDED — confirmed this round** | `novato.pendente@test.local` (`00000000-0000-0000-0000-0000000000d1`) exists (`seed.sql:220`) with `email_confirmed_at IS NULL`, `is_active = true`, and **0** `memberships` rows (live-queried this round: `membership_count = 0` — matches matrix § 8.2 / deny-class § 4(a)). ⇒ T4 must insert one `staff` membership row for `d1` (commission `a0000000-…-a1`, per the deny-class doc's own instruction), **a distinct id from every other case's fixture**. |
| `suspended` | **SEEDED — no gap** | `suspenso.temp@test.local` (`00000000-0000-0000-0000-0000000000d3`) already holds **one** `staff` membership at CCIH (`seed.sql:637`; live-queried this round: `membership_count = 1`, `is_active = true`, `suspended_until` set). ⛔ Correct the deny-class doc's framing if it is read as grouping this with `pending`/`deactivated`: **only `d1` and `d4` lack a membership row** — `d3` (`suspended`) does not, and needs no T4 action. |
| `deactivated` | **FIXTURE NEEDED — confirmed this round** | `desativado.conta@test.local` (`00000000-0000-0000-0000-0000000000d4`) exists (`seed.sql:223`) with `is_active = false` and **0** `memberships` rows (live-queried: `membership_count = 0`). ⇒ same T4 action as `pending`: insert one `staff` membership row, distinct id. |
| `offboarded` | **FIXTURE NEEDED — mechanism not located this round** | No seeded principal matching ADR 0163's last-org-retention shape was found for any role in this pass (not staff-specific). Flag for backend: confirm which table/column encodes "no active affiliation, subset capability" before T4 constructs a `staff` instance of it. |

---

## 3. `activeContext` axis

| value | status | detail |
| --- | --- | --- |
| `matching` / `other_role` / `absent` | **SEEDED — session mechanism, no fixture row** | These are `active_role()` claims set at session/JWT time, not `memberships` rows. Any persona holding `staff` (e.g. `staff4.ccih@test.local`) can be driven through all three by the test driver alone. `other_role` additionally needs the persona to hold a second role to select instead — `dr.john@test.local` (two `staff` memberships, `seed.sql:616,641`) or `pqsdual.a@test.local` (`staff` + NSP, `seed.sql:611`) both work, though both are also case-cap-contaminated (§ 8.2) — fine for `activeContext`-only cells, wrong choice for any cell that also sweeps case reach. |

---

## 4. `scope` axis

| value | status | detail |
| --- | --- | --- |
| `own_commission` | **SEEDED** | CCIH (`a0000000-0000-0000-0000-0000000000a1`) via `staff4.ccih@test.local`. |
| `sibling_commission` | **SEEDED** | Comissão de Farmácia (`b0000000-0000-0000-0000-0000000000b1`) — same hospital/org as CCIH (both Rede A, per `seed.sql:560` vs `:563` hospital ids). |
| `foreign_org_commission` | **SEEDED (scope id only; no persona needs to hold there)** | Qualidade B (`c0000000-…-c1`) or Farmácia B (`c0000000-…-c2`), both org B. The deny-class doc's own measurement (`is_member_of_for('c…c1', staff4) = false`) already uses this shape — test the CCIH clean holder against a foreign-org scope id; no new principal required. |
| `zero_scope` | **N/A by constraint, not a gap** | `memberships_scope_shape`'s `staff` arm forces `commission_id NOT NULL`; `constraintRules.scope_must_match_role_scope_kind` makes this coordinate impossible for `staff`, tier-wide. |

---

## 5. `caseReach` axis

**SEEDED / inert for `staff` — no T4 action.** `caseReach` (`authz-matrix-axes.json:112-119`) coordinates
**one arm of one gate body**, `app.can_read_professional_profile`'s case-committee arm — and the matrix
confirms `staff` holds **no** code whose enforcement predicate consults that function (§ 5.2's row list,
§ 7.1). The generator's own `CONDITIONAL_EXCLUSIONS[('caseReach','inert_outside_the_arm3_gate')]` rule
(cited in the axes file) means every `staff` cell copies this coordinate without it changing the
answer. ⛔ **Do not conflate this with `staff`'s own eleven arm-3 coordinates below** — those are a
*different* mechanism (§ 5.3's criterion, mostly `_case_caps` and RLS conjuncts), not
`can_read_professional_profile`'s arm 3. No fixture is owed here beyond what `403`'s own
participation fixture (`pg_temp.set_case_reach`) already builds for its own representative.

---

## 6. The eleven `staff` arm-3 coordinates (matrix § 5.3 census — rows 1, 4, 6, 7, 8, 9, 11, 12, 15,
16, 19; rows 4 and 11 carry both limbs)

Every row below was checked against the live population this round (not just read from the matrix).

| row | term | grant-side | deny-side | verdict |
| --- | --- | --- | --- | --- |
| 1 (b) | `app.can_access_targeted_version` role-free disjunct | bare membership already seeded | — (limb-b only *adds* grants) | **SEEDED as a non-issue** — but see the control note below: confirm the chosen `subject_holder` carries **no** `case_participants`/`professional_profiles` link, or the disjunct masks the membership signal (the "positive control contaminates its subject" shape). `staff4.ccih` was not found in any `professional_participants` row this round — clean. |
| 4 (a) | co-member leg (target's own memberships) | two CCIH staff reading each other (any pair of the 9) | a CCIH staff reading a Farmácia-only profile (`staff4.ccih` → `staff1.farm`) | **SEEDED, no gap** |
| 4 (b) | self-read disjunct | any persona reading its own profile | n/a (disjunct, not a deny path) | **SEEDED, no gap** |
| 6 | `visibility_policy` / attendee | the one CCIH meeting `f1000000-…-e1` (`commission_default`, `held`) grants any CCIH staff | **FIXTURE NEEDED** — no `participants_only` meeting exists anywhere in the seed (live-queried: all 3 seeded meetings are `commission_default`). Need one `participants_only` meeting at CCIH with a clean staff **as** attendee (grant-by-attendee) and one **not** an attendee (deny-by-policy), distinct meeting ids. |
| 7 | + `is_case_respondent` hard deny | inherits row 6's grant | **FIXTURE NEEDED** — no evidence a clean staff is recorded as a case respondent on any `meeting_cases` row; needs a `meeting_cases` row + a case where the chosen staff is the respondent, distinct ids from row 6/8's fixtures. |
| 8 | `attendance='present' AND status='in_signature'` | **FIXTURE NEEDED** — live-queried: all 3 seeded meetings have `status='held'`; **none** is `in_signature` (the CHECK constraint allows `scheduled/held/in_signature/signed/distributed/cancelled`). Need one CCIH meeting with `status='in_signature'` and a `meeting_attendees` row for the clean staff with `attendance='present'` (grant), plus a second attendee row with `attendance≠'present'` at the same meeting (deny-by-attendance) and/or reuse of the existing `held` meeting (deny-by-status). | | |
| 9 | `v_eg` (`visibility_policy='explicit_grants_only'`) | the 5 `commission_default` CCIH cases already grant deliberation to the 3 clean personas (§ 8.2, re-confirmed) | **SEEDED, no gap** — CCIH already has one `explicit_grants_only` case (`ca000000-0000-0000-0000-0000000000e1`, live-queried). Its `case_access_grants` rows are held only by `staff1.ccih` (`…003`) and `chefe.ccih` (`…002`) — the clean personas (`staff4.ccih`, `ativo.registro`, `dr.john`) hold **no** grant there, live-confirmed. The deny cell is directly testable today. | |
| 11 (a) | `visibility_scope` | the one seeded CCIH action item (`ac3f1301-…`) has `visibility_scope='committee'` (grants any member) | **FIXTURE NEEDED** — no action item at CCIH carries `case_restricted` or `assignees_only` (live-queried: only the one row exists). CHECK constraint allows all three values. Need one action item per non-`committee` value to exercise the deny. |
| 11 (b) | `assigned_to = auth.uid()` role-free disjunct | **FIXTURE NEEDED** — needs an `assignees_only` action item with the clean staff as the `action_item_assignments` assignee, isolated from the `committee` grant path; the one seeded item is `committee`-scoped, so the disjunct is untested in isolation. | | |
| 12 | ethics-case status guard (`HC0J0`) precedes membership | **NOT VERIFIED THIS ROUND** | recommend backend confirm which `cases.ethics_status` (or equivalent) values are votable and whether any seeded CCIH case sits in one; if none, both polarities need a case fixture. | |
| 15 | `owner_commission_id IS NULL` (public arm) | **FIXTURE NEEDED — confirmed this round** | `accreditation_frameworks` is **completely empty** (0 rows, live-queried) system-wide. Every polarity of this coordinate needs a row: one with `owner_commission_id IS NULL` (the vacuous PUBLIC grant — must GRANT for a non-member too, which is the point of the finding), one owned by CCIH (ordinary membership grant), one owned by a different commission (deny-by-scope for a CCIH-only staff). `assert_accreditation_enabled()` must also be on. | |
| 16 | `is_document_approver_of` role-free disjunct | **NOT VERIFIED THIS ROUND** | recommend backend confirm a `document_approvals` fixture exists (or is needed) making a non-member an approver of a CCIH-owned document, to isolate the disjunct from bare membership. | |
| 19 | `cp.source='indicator'` provenance | **NOT VERIFIED THIS ROUND** | recommend backend confirm a CAPA row exists with `source='indicator'` linked to a CCIH indicator (grant) and one with a different source (deny-for-this-row, since event-sourced is row 17's arm, not this one). | |

---

## 7. Matrix § 8.2's five contamination claims — verified against seed.sql and the catalog

Method: `app._case_caps(case, uid)` bit values `1` overview · `2` deliberation · `4` content ·
`32` write, measured by the matrix over every `staff` of CCIH on `commission_default` cases. This
round independently re-checked the **membership shape** (not the case-caps bits themselves, which
the matrix's own transcript already shows the query for) via `memberships` / `case_access_grants`.

| persona | uuid | claimed source | verified this round |
| --- | --- | --- | --- |
| `ativo.registro@test.local` | `…d2` | none (clean) | ✅ 1 membership row (`seed.sql:636`), CCIH only |
| `dr.john@test.local` | `…a1` | none for case-caps, but 2 commissions | ✅ 2 membership rows (`seed.sql:616,641`) — CCIH + Etica (secundário-a); both same org (Rede A), not cross-org |
| `staff4.ccih@test.local` | `…00a` | none (clean) | ✅ 1 membership row (`seed.sql:627`), CCIH only |
| `staff1.ccih@test.local` | `…003` | phase assignment + case grant | ✅ holds a `case_access_grants` row on `ca000000-…-e1` (live-queried this round) |
| `staff2.ccih@test.local` | `…004` | full `administrativo` bundle + narrative assignment | not independently re-queried this round (trusted from the matrix's own live-catalog measurement, same methodology as this report) |
| `staff3.ccih@test.local` | `…009` | case grant (`write_case_content`) | not independently re-queried this round (same trust basis) |
| `multi@test.local` | `…008` | case grant | 2 membership rows confirmed (`seed.sql:623-624`) — CCIH + Farmácia, **both Rede A**, not cross-org (correcting any reading of "multi" as a cross-org persona) |
| `pqsdual.a@test.local` | `…c7` | S6 NSP/PQS second role | not independently re-queried this round (same trust basis) |
| `suspenso.temp@test.local` | `…d3` | `is_active` gate (deliberate) | ✅ 1 membership row, `is_active=false`-equivalent via `suspended_until` (live-queried) |

**The five contaminating mechanisms, named**: (1) phase/narrative assignment · (2) an explicit
`case_access_grants` row · (3) the `administrativo` capability bundle · (4) a second role (NSP/PQS) ·
(5) a second commission (dr.john — not itself case-cap contamination, flagged separately). ⇒ **3 of 9
CCIH `staff` personas are clean for `424`'s `subject_holder`: `ativo.registro@test.local`,
`dr.john@test.local`, `staff4.ccih@test.local`.** `staff1.ccih@test.local` — the name a reader reaches
for first — is contaminated and must not be used.

---

## 8. Summary for backend's T4 — coordinates with NO seeded principal or resource

- `persona=cross_org_actor` for `staff` — new principal, org-B commission, no other membership.
- `principalState=pending` — insert a `staff` membership for `novato.pendente@test.local`.
- `principalState=deactivated` — insert a `staff` membership for `desativado.conta@test.local`.
- `principalState=offboarded` — mechanism not located; needs backend's own knowledge of the ADR 0163
  implementation before a row can be named.
- `persona=unprivileged` — needs a confirmed zero-role, zero-admin, active principal.
- row 6 / row 7 — a `participants_only` meeting at CCIH with a distinct `meeting_cases` respondent
  fixture.
- row 8 — a CCIH meeting with `status='in_signature'`, plus attendee rows for both polarities.
- row 11 (a) and (b) — CCIH action items with `visibility_scope` values other than `committee`, one
  with the clean staff as assignee.
- row 15 — `accreditation_frameworks` is empty; needs a null-owner row, a CCIH-owned row, and a
  foreign-commission-owned row.
- rows 12, 16, 19 — not independently verified this round; each needs a targeted backend query before
  T4 can be scoped precisely.

⛔ Every inserted row above needs an id distinct from every other case's fixture (plan
`:1144-1147`) — none may be shared, including across the two lifecycle-persona insertions (`pending`
and `deactivated` need separate membership-row ids even though both attach to CCIH).

---

## 9. 2026-09-14 addendum (T12, `425_ae5_staff_rekey_differential.sql`) — two more EMPTY tables

Found while wiring 425's live DEFINER-function probes (not part of the original T13 sweep, which
never needed these two tables). Method: bare `select count(*)` as `postgres`, no role switch, no
transaction — same read-only discipline as § 0 above.

| table | measured count | blocks |
| --- | --- | --- |
| `public.accreditation_standards` | **0** | `public.get_standard_assessment`, `public.readiness_evidence`, `public.readiness_report` — all three take a `p_standard uuid` argument with no seeded row to supply. |
| `public.referral_internal_notes` | **0** | `app.can_read_referral_internal_note` — takes a `p_note_id uuid` with no seeded row to supply. |

No fixture ids proposed here — backend's call, in T7's own seed work.

⭐⭐ **CLOSED, 2026-09-15 (tester).** Both rows above are stale — the table is not this doc's format
to rewrite in place (it stays as the dated record of the original finding), so the closure is this
note beside it. T7's seed migration (`2dddd278`) gave `public.accreditation_standards` TWO rows
(`a5f50000-…-b1` "CCIH-1", `a5f50000-…-b2` "FARMA-1") and `public.referral_internal_notes` ONE
(`a5fb0000-…-d1`) — `425` re-pointed all four blocked sites at these ids (L34, finding F1):
`readiness_report` and `can_read_referral_internal_note` discriminate live (`1`→`0`, `true`→`false`
under `staff`'s `commission.accreditation.read` / `commission.referrals.metadata.read` grant
deletion, rolled back). `get_standard_assessment` and `readiness_evidence` did NOT yet discriminate
at that point — they read FROM `public.standard_assessments` / `public.evidence_links`
respectively, and BOTH of those tables were still empty at F1's measurement (not part of this
addendum's original two-table finding — discovered separately, in `425`'s own "Ten of 59"
paragraph). Backend closed THAT residual gap too (L36): one `standard_assessments` row
(`a5f50000-…-c1`, `status='parcial'`) and one `evidence_links` row (`a5f50000-…-d1`), both on
CCIH-1. `get_standard_assessment`, `readiness_evidence`, and their two POLICY siblings
(`standard_assessments_select`, `evidence_links_select`) all now read a genuine `1`→`0` under the
same mutation, live-measured, rolled back. Every site this addendum and `425`'s own discovery ever
named as fixture-blocked on the accreditation/referral surface now has a real fixture row and a
real verdict — nothing here remains fixture-gapped.

⛔ These are DISTINCT from row 15's `accreditation_frameworks` gap (§ 6 above, § 8): frameworks and
standards are different tables (`accreditation_standards` presumably FKs to a framework), and this
addendum's emptiness was not implied by that earlier finding — verify both independently, do not
assume seeding one fixes the other.

**Row 9's residual arm, isolation gap (measured by backend, not this round)**: the seed has **no**
principal holding a `case_access_grants` row with `read_case_deliberation` who is **not also** a
member of the case's commission — count **0**. Matrix row 9's residual `has_case_capability` arm
(kept under L17 as declared `residualLegacyAuthority`) therefore has no persona today that exercises
it **in isolation** from ordinary membership — every seeded grant-holder would read through the
membership path regardless, so a probe against any of them proves nothing about the residual arm
specifically. Backend is seeding one such principal in T7. No fixture id proposed here — backend's
call, in T7's own seed work.

**`public.meeting_closed_session_items` — empty (measured by backend, not this round)**: **0** rows
system-wide, so `get_reserved_session_items` returns nothing for any principal today. The fourth C1
site's witness — withdrawals visible in a `commission_default` session, denied in a restricted one —
is therefore an **empty set, not a decision**: a probe against it today observes absence-of-data, not
a grant/deny answer, and cannot be read as either polarity. Backend seeds one session with two items
in T7. No fixture id proposed here — backend's call, in T7's own seed work.
