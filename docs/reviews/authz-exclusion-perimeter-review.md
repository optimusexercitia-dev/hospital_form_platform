# QA Review — ADR 0078 · The Exclusion Perimeter (Units 1 + 2, one pass)

**Reviewer:** `qa` · **Date:** 2026-07-16 · **Branch:** `feat/authorization-capability-model`
**Commits under review:** `f4df6f4` (U1 read/administer) + `49dd014` (U2 content-write)
**Migrations:** `20260731000000_authz_exclusion_perimeter_u1.sql`, `20260801000000_authz_exclusion_perimeter_u2.sql`
**Catalog state at review:** 122 migration files = 122 registered; `git log` head `a9b4399`; all 16 targets present + DEFINER.

## Verdict: **APPROVED** — 0 P0, 0 MAJOR, 0 MINOR (2 INFO, both pre-existing + out of scope)

Both units are a *correct narrowing*. The narrowing's central danger is binding **too much**
(§7.7) — a denial that over-reaches passes its negative keystone by construction. I attacked
that danger directly: **the positive twin was the review.** Every legitimate principal still
performs every guarded action; every excluded-but-authorized principal is stopped with `HC0F1`;
the both-layers raw-table exploits are closed *independently of the RPC*; the storage arm removal
keeps the referral reader; and the `recompute_recommendations` GUARD-not-REVOKE decision is
vindicated by execution. My structural closure cross-check found **no leaker the population missed.**

Everything below was verified against the **live catalog** (comment-stripped `prosrc`, `\y` where
anchored) and by **behavioural probes under `set local role authenticated`**, in `begin…rollback`
transactions (no residue — confirmed 0 recusals / 0 `HACKED` cases / 0 stray interviews after).
Denials are asserted **by effect** (row survives / rows-changed 0 / `HC0F1`), not merely by a
SQLSTATE that could be a deny for the wrong reason (§7.2·6). The made **excluded-AND-authorized**
fixture was verified real before every negative: `is_case_excluded = t`, `is_staff_admin_of = t`,
`can_read_case = f` — so a block is the exclusion guard, not an authority gap (§7.1·3).

---

## What I probed (and it held)

### 1. The positive twins — no over-reach (§7.7, the review)
Clean coordinator `chefe.ccih` (staff_admin CCIH, **not** recused) on real case `d0…c1`, all
SUCCEED: `grant`/`list`/`revoke_case_access`, `create_interview`, `update_case_meta`,
`add_ad_hoc_narrative`, `assign`/`unassign`/`conclude`/`reopen_narrative`,
`activate`/`reassign_phase`, `delete_committee_action_item` (null-anchor committee item),
`recompute_recommendations`, `save_narrative_body`, `update_interview`. **No guard fires on a
legitimate principal.**

### 2. The negative — every guard fires `HC0F1`
With `chefe.ccih` **recused** from `d0…c1` (still staff_admin, so authority passes and the *only*
thing that can stop her is exclusion), all **16** raise `HC0F1`: the 10 §2a uniform guards
(`activate_phase`, `reassign_phase`, `set_case_phase_result_override`, `add_ad_hoc_narrative`,
`assign`/`conclude`/`reopen`/`unassign_narrative`, `update_case_meta`, `set_case_offered_outcomes`),
the U1 doors (`grant`/`revoke`/`list_case_access`, `create_interview`),
`delete_committee_action_item` (case-anchored), and `recompute_recommendations`. Control
`set_participant_patient` (already guarded pre-U2) also raises `HC0F1` — the fixture discriminates.

### 3. Close-case flow (item 2) — no legitimate close is caught
`close_case` is `prosecdef = f` (INVOKER) and self-contained; it does **not** call any guarded RPC.
The "close flow" is the coordinator's *sequence* of guarded RPCs, each single-case. A non-recused
coordinator passes every inner guard (auth.uid() unchanged by DEFINER; non-excluded). Confirmed by
the twin battery above. No over-reach.

### 4. `recompute_recommendations` — both directions (item 3)
- (a) recused coordinator, direct call → `HC0F1`.
- (b) INVOKER caller `skip_phase` (`prosecdef = f`, reaches `recompute`) run by a **clean**
  coordinator → **SUCCESS**. This is the exact path the lead's proposed REVOKE would have broken
  (7 files red per the U2 record); the GUARD keeps it working. `add_ad_hoc_phase` is the same class
  (INVOKER, calls `recompute`) — covered by the same mechanism.
- (c) submit-trigger path: `sync_case_phase_on_submit` is DEFINER on `responses`, calls `recompute`;
  `auth.uid()` = the submitter (a non-excluded phase assignee), so the guard is a no-op for a
  legitimate submit. `assert_not_case_excluded` also no-ops on a null uid. An *excluded* submitter
  would be transitively aborted by the now-guarded `recompute`. (Verified wiring + reasoning; see Limits.)

### 5. C7 both-layers — the gap is fully closed (item 4)
- **RLS layer:** a recused staff_admin's **raw PostgREST DELETE** of a `case_restricted`
  `action_items` row removed **0 rows** (`action_items_staff_admin_write` USING term blocks it) —
  proven independently of the RPC.
- **RPC layer:** `delete_committee_action_item` on the same case-anchored item → `HC0F1`.
- **Twin (§7.7):** a `source_case_id IS NULL` **committee** item stays deletable by the recused
  coordinator (the `coalesce(...) is null OR not is_case_excluded(...)` term does not over-reach).
- `action_items_staff_admin_write` is the **sole** write policy on the table (no permissive sibling,
  §7.1·6) — the exclusion is not bypassable via another policy. `action_items_select` is read-only.

### 6. Interview both-layers (U1 ②)
- Raw INSERT into `case_interviews` for the recused case → **RLS with_check violation** (blocked
  independently of the RPC). `case_interviews_insert` is the sole INSERT policy.
- The direct-path narrowing to `is_staff_admin_of` was **A4's** (`bf86711`, pre-U1); U1 added *only*
  `and not is_case_excluded(...)`. No new over-reach introduced here.

### 7. OUT rulings spot-checked by execution — no missed leaker (item 5)
`save_narrative_body` (recused → 42501 / clean → SUCCESS ⇒ the 42501 *is* the exclusion via
`can_write_case_narrative`), `update_interview` + `conclude_interview` (recused → HC039 / clean →
SUCCESS ⇒ the deny is `can_write_interview`), `declare_conflict` (recused → P0002, denied by
`can_read_case`). All deny a recused coordinator; the clean twin proves the deny is the exclusion,
not a pre-existing gap.

### 8. Storage (U1 ③)
`case_documents_select_member` now = `bucket_id='case-documents' AND can_read_snapshot_document(...)`
— the `is_member_of([1])` leak arm is gone, the **referral-snapshot reader survives** (the twin the
brief flagged as load-bearing). `interview_attachments_obj_select_member` +
`case_documents_insert_staff_admin` + `interview_attachments_obj_insert_writable` — all **absent**.
The live `attachments`/`referral-attachments` buckets keep their guarded `can_read/write_attachment`
+ `can_read/can_manage_referral` policies. (Storage half is LATENT — not re-filed as an active P0,
per the brief.)

### 9. Guard placement (item 6)
Read all 10 §2a bodies: `assert_not_case_excluded` sits **after** the 42501 authority raise and
**before** the mutating write in every one. Where a state pre-check precedes authority
(`set_case_phase_result_override`'s HC057), the guard still precedes the UPDATE, so an excluded
user is stopped before any state change — confirmed: the negative battery raised `HC0F1` (never a
state code) on all 10.

### 10. §7.13 closure cross-check — the population is closed
Structural sweep: DEFINER `public` functions that DML any of 11 case-content tables and carry
**neither** `assert_not_case_excluded` **nor** a gated helper. Result — exactly 5, **all already
ruled OUT**: `create_case`, `create_case_from_template`, `notify_safety_event` (creation — no prior
recusal can exist), `sync_case_phase_on_submit` (trigger, not independently callable; its
`recompute` is now guarded), and `conclude_meeting` (the **PO-ruled meeting-family residual** —
verified it writes **only** a `case_events` stamp, not narratives/cases/phases, so severity matches
the recorded residual; **not re-filed**). **No new leaker.** This corroborates `backend`'s
behavioural closure of the 65-candidate set from a different angle.

---

## INFO (pre-existing, out of the exclusion-perimeter scope — not blockers)

- **INFO-1.** `set_case_offered_outcomes` authority is `is_staff_admin_of OR is_admin()`
  (platform_admin). Setting offered outcomes is *case content*, which the noun rule says
  platform_admin MAY NOT touch. This is **pre-existing** (U2 did not add it) and orthogonal to the
  exclusion perimeter; the U2 guard is correctly a no-op for platform_admin (never a case
  participant), so the unit did not worsen it. Noise for A30 / the noun-rule sweep, not this gate.
- **INFO-2.** `create_interview` RPC admits `is_staff_admin_of OR is_commission_admin_of`, but the
  direct-path `case_interviews_insert` with_check admits only `is_staff_admin_of`. Intentional (A4
  removed the org arm from the direct path; the DEFINER RPC retains it). Not a defect — noted for
  completeness.

---

## Limits — what my probes could NOT see (read this)

1. **I did not re-run the full pgTAP suite (`2966/2966`) or the `u1`/`u2` mutation audits (8/8, 13/13)
   on a fresh reset.** I do not own the reset and the local stack has one owner (§3·3); the DB is
   shared. My independent behavioural probes corroborate that the guards fire and the twins pass,
   but I did **not** re-prove that those specific mutation keystones *ran* (§7.1 `red ≠ abort`) — I
   rely on the lead-verified figures for the harness itself. I did confirm the keystone `237` is
   *structurally* right (makes both excluded-AND-authorized principals, PRE-flight-asserts the
   fixture, separates `HC0F1` from 42501, carries the clean twins, asserts the raw DELETE by
   *effect* — the row survives).
2. **I exercised exclusion via the RECUSAL leg only, on my own fixture.** The RESPONDENT leg routes
   the *identical* `is_case_excluded` predicate inside every guard, and `237` asserts both legs; I
   did not independently build a respondent fixture.
3. **I did not execute a full end-to-end phase-response SUBMIT** to observe
   `sync_case_phase_on_submit → recompute` for a legitimate submit. I verified the wiring (DEFINER,
   calls `recompute`, `auth.uid()` = submitter, guard no-ops on non-excluded/null uid) and reasoned
   the legitimate path passes and the excluded path is transitively aborted. This is the one path I
   validated by reasoning + wiring rather than a live submit.
4. **The DEFINER content-write population closure** rests on `backend`'s behavioural closure of 65
   candidates *plus* my structural cross-check (§10). A structural sweep false-positives and
   false-negatives (§7.13); mine returned only known-OUT members over the **11 case-content tables I
   named**. If a case-content table exists that I did not name *and* `backend`'s behavioural
   enumeration also missed its writer, neither check would catch it — I judge this low-probability
   given the convergence, but it is the residual I cannot fully close from a read-only seat.

## Scope discipline
Per the brief, I did **not** re-file the meeting-family residual (PO scope ruling; confirmed
`case_events`-stamp severity), the storage-arm latency (removal is correct), or `manage_case_access`
(A5-passed). Per the brief I did **not** touch `PROGRESS.md`.
