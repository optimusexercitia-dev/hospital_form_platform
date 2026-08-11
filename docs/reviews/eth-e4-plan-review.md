# QA Review — ADR 0108 + Build Plan (Ethics E4 · Participant seating)

- **Verdict:** CHANGES REQUESTED (2 critical, 1 major, 2 medium, 2 minor)
- **Reviewed:** `docs/decisions/0108-eth-e4-participant-seating.md` ·
  `docs/phases/ethics-e4-participant-seating.md` (both untracked on
  `worktree-ethics-committee-completion`)
- **Method:** every SQL claim re-verified against the **live catalog** (`pg_proc`,
  `pg_policy`, `information_schema` grants, `pg_indexes`, `pg_constraint`,
  `supabase_migrations.schema_migrations`); code claims verified in-tree.
- **Date:** 2026-08-11

## Critical findings

### C-1 — Premise correction #1 is itself wrong: `public.set_primary_subject` EXISTS

The ADR asserts *"set_primary_subject does not exist as a function at all… No pg_proc
entry in `public` or `app` so much as mentions `primary_subject`"* and the plan repeats
it (§0). The live catalog says otherwise: `public.set_primary_subject(uuid)` exists,
`SECURITY DEFINER`, `search_path` pinned, EXECUTE granted to `authenticated` — shipped in
`20260720001010_ethics_participant_recusal_rpcs.sql`, gate-fixed in
`20260722000000_authz_m1_exclusion_durability.sql` (§W-6 comment is in the live body).
It is load-bearing: pgTAP **228** (t19 ACL keystones), **229** (M1·2 exclusion-gate
keystone + the door census at line 863), **314** (QO wall 11.3) all assert on it; it is
in generated types (`database.ts:15028`) and the `setPrimarySubject` stub's own comment
references it. FUP-ETH-1's original framing (an RPC awaiting a caller) was the closer
one; the "correction" inverted a truth. Likely cause: the concurrent gate's mid-scoping
DB resets — plan §6 itself records two truncated catalog queries.

**What stays true:** the existing body is *set-only* (a second primary raises `HC0E7`
via the partial index — it cannot **move** the primary) and it does **not** re-run
`assert_respondent_linkage_resolved`. So D2's functional gaps are real; only its
premise and shape are wrong.

**Required changes:**
- ADR D2 + premise correction #1: reframe as **modifying a shipped DEFINER door**
  (add clear-before-set move semantics + the linkage re-run), not adding one. The lane
  is short **one** door, not two.
- Plan §1.2: `create or replace`, **not** the "new door + t19 revoke/grant" pattern —
  as written it rewrites a shipped door's ACL, the exact "guards that read right but
  fail open" hazard the ADR cites for the rejected `create_professional_profile` fold.
  Property-diff `prosecdef`/`proconfig`/ACL from the catalog, as §1.3 already mandates.
- Consequences bullet: "two new DEFINER gates" → **one new + one modified**. `ARM=census`
  covers the new one; the modified one is precisely what the diff-scoped sweep exists
  for (the plan's sweep list of three remains correct by count).
- Plan §5: state explicitly that suites 228/229/314 must stay green after the semantics
  change (229's M1·2 and 314's 11.3 assert the gate, not set-only semantics, so they
  should — but say it, don't assume it), and keystone 6 becomes a red-first test against
  today's set-only behavior.

### C-2 — The mint door is in the `app` schema, so nothing can call it

Plan §1.1 creates `app.ensure_professional_participant`; §2 has `addCaseParticipant`
call it via `.rpc()`. `supabase/config.toml` exposes only `["public", "graphql_public"]`,
there are zero `schema('app')` call sites in `src/`, and every callable door in this
lane is `public.*`. An `app.*` RPC is a PostgREST 404 — the "correct door nothing can
reach" failure already on record for this repo. **Fix:** create it as
`public.ensure_professional_participant` (internal predicates stay in `app`). The green
pgTAP bar would never catch this — pgTAP calls functions in-database — only E2E would.

## Major finding

### M-3 — Four of the seven seeded roles remain unfillable after E4

Seeded `case_participant_roles`: `complainant` {external_person, professional} ·
`witness` {external_person, professional} · `legal_representative` {external_person} ·
`external_regulatory_body` {regulatory_body} · plus respondent/investigator/patient.
After E4 the writer census is patient lane + professional lane — **no door mints
`external_person`, `regulatory_body`, `department`, `institution`, or `other`
participants**. A sindicância's **denunciante** (unless coincidentally an org
professional), an external **testemunha**, a **representante legal**, and the CRM as an
external body all stay unseatable — the same "seeded role over an unfillable panel"
shape FUP-ETH-1 was filed about, one lane over.

For a feature whose purpose is adequacy for real ethics committees, the complainant is
not optional: nearly every processo ético starts with one. Recommend either:
- **(preferred)** a third lane in this track: `public.ensure_external_participant(p_org,
  p_type, p_display_name)` — `non_sensitive` class, no linkage machinery, no profile
  table; a fraction of the professional lane's complexity, same
  `can_manage_professional` gate; or
- an explicit **"not decided here"** in the ADR + a filed follow-up, with the note that
  the FUP-FF5-2 writer-census keystone (count **and** name) will churn when the lane
  lands.

Either way the ADR should decide this consciously rather than by omission.

## Medium findings

### M-4 — D5's exposure argument holds but omits one *new* inference

Checked as invited: the widening itself is correctly argued (names already org-readable
per 0091 D2; the arm adds CRM/specialty to managers only; no case linkage). What it
omits: post-E4, a professional's `participants` row is minted **only at seating time** —
so existence in the org-readable registry newly implies *"was involved in at least one
case"* (role, case, and count invisible). Pre-E4 no product path created that inference.
Under sigilo do processo ético this deserves one sentence in the ADR: accept it (with
the mitigations named) or note the alternatives (tighten `participants_select` for the
`professional` type; decouple mint from seating). PO-decision material, not a defect.

Related, worth one line in D5: `can_manage_professional`'s `is_org_admin_of` disjunct
reads the **caller's** `auth.uid()`, not `p_uid` (recorded in its header comment). Fine
where the policies bind `p_uid = auth.uid()`, but D5 propagates the asymmetry into a
second predicate — cite it so a future non-caller `p_uid` call site can't inherit it
silently.

### M-5 — Get-or-create race + a data-dependent unique index

(a) Two concurrent mints of the same profile both pass the "existing?" check; the new
unique index turns the loser into a raw `unique_violation` reaching the UI. Specify the
arm: **targeted** `on conflict (professional_participants.professional_profile_id)` (an
untargeted `do nothing` is a known trap here) or catch-and-reselect — and mind the
insert order: the `participants` row lands first, so the losing branch must not strand
an orphan registry row. (b) The index is data-dependent: local resets see seed data
only, but the remote may hold `professional_participants` rows (the seed writes the
table directly at `seed.sql:2756`; service-role paths could too). Verify no duplicate
`professional_profile_id` on the **remote** before `db push` — the
backfill-guard-wrap failure shape (passes local 0-row reset, fails 23514 on push).

## Minor findings

- **m-6 — `display_name` staleness.** D3 copies `full_name` at mint;
  `update_professional_profile` can change `full_name` later while get-or-create keeps
  returning the old row — roster (registry name) and dialog (profile join) then
  disagree. Either sync `display_name` inside `update_professional_profile` or state
  the divergence is accepted and render from the profile join when readable.
- **m-7 — text nits.** Plan §7 Record: `graphify update` is lead-only, post-merge —
  fine as placed, but name the lead. Plan §5.1 item 6's "moves the flag" phrasing
  should acknowledge it is *changing* shipped behavior (C-1).

## Verified correct (all against the live catalog)

- Writer census: exactly **one** function inserts into `participants`
  (`set_participant_patient`); **zero** into `professional_participants`; all four
  tables SELECT-only for `authenticated`. ✅
- No unique index on `professional_participants.professional_profile_id` (pkey is
  `participant_id`) — the D1 index is genuinely needed. ✅
- `case_participants_one_primary_subject` partial index (the `HC0E7` substrate) exists
  as described. ✅
- `add_case_participant` gates exactly as tabulated (`HC0E4`/`HC0F1`/`HC0E3`/`HC0F0`,
  audited); `assert_respondent_linkage_resolved` bites only for `respondent_doctor` —
  the D2 promotion re-check is sensible defense-in-depth. ✅
- `can_read_professional_profile` today = `is_admin` ∨ seated-on-a-readable-case;
  `can_manage_professional` disjuncts as claimed; `participants_select` org-scoped —
  D5's premise ("bare name at the moment of seating") is real. ✅
- Premise correction #2 confirmed: `evidence_links.artifact_kind` CHECK includes
  `ethics_procedure`; E3b needs no build. ✅
- Plan §4's "frontend-only" claim: both vocabulary tables carry full `authenticated`
  DML grants + an org-admin `FOR ALL` policy. ✅
- Migration window (> `20260918003100`, files **and** registered), pgTAP `321` free,
  flags ON, 3 `dbInsert` sites in the E3a spec, 7 stubs + helper with the frozen
  signatures, `getCaseDetail` participants wiring — all as stated. ✅
- D1 (separate mint door, both rejections well-grounded), D4 (invoker-rights search),
  D6 (un-defaulted linkage choice, audited `no_account` assertion, `unknown`-profile
  remediation), D7 (roster in main column, rail card untouched) — sound, and D6 in
  particular is the right shape for committee accountability. ✅

## Summary

The architecture direction is right and most of the scoping is genuinely
catalog-verified. But the track's central premise ("the lane is short two doors") is
half-false — `set_primary_subject` exists, is keystoned three times over, and must be
*modified*, not minted — and the one door the track does mint is placed in a schema
PostgREST cannot reach. Fix those two, decide the external-participant lane consciously
(M-3), and add the D5 sentence (M-4), and this is ready to build.
