-- ============================================================================
-- ADR 0136 · Flip `deferred_staff_signoff` ON — the gate flip.
--
-- Same convention as SUP's `20260720000610`, S1·N's `20260720000720` and
-- Phase-15's `quality_indicators` flip: the flag ships OFF in its own creating
-- migration (`20261003001900`), and a SEPARATE one-line migration flips it once
-- the phase gate has closed. `seed.sql` additionally forces it ON for local/E2E,
-- which is redundant after this and is kept deliberately — it keeps the two
-- paths honest if a future edit ever changes this flip's shape.
--
-- ⭐ WHAT AUTHORISES IT, recorded here because "the gate passed" is the whole
-- justification and a later reader cannot reconstruct it from the diff:
-- §6 steps 1–4 closed 2026-08-24 — lint 9/9, `tsc` 0, Vitest 125f/1714,
-- `test:db` 7228/7228 on a fresh reset, the four authz ARMs exit 0 (read
-- unpiped) plus a diff-scoped door sweep (2 COVERED), QA APPROVED
-- (`docs/reviews/adr-0136-deferred-signoff-review.md`), and explicit human
-- approval. E2E: see the qualification below.
--
-- ⛔ THE ONE THING A READER SHOULD NOT TAKE ON TRUST. The full `e2e:prod` run
-- exited **5** — "red, NOTHING proven" — with 0 assertion failures but 33 tests
-- never executed (`server_dead` in two batches). A targeted re-run of exactly
-- those specs was green. So the suite is green BY COMPOSITION of two runs, not
-- by one, and the batches carrying this ADR's own surface (`deferred-staff-signoff`,
-- `phase6-signoffs`) were clean and fully accounted. That is the evidence this
-- flip rests on; it is not a clean single full run, and the approval was given
-- with that stated.
--
-- ⚠ THIS MIGRATION IS THE ONLY THING THAT CHANGES PRODUCTION BEHAVIOUR, and it
-- does so only when it is PUSHED. Until `supabase db push` reaches the linked
-- project, production still runs the flag OFF regardless of what any document
-- says. Pushing is a separate decision.
--
-- ⚠ WHAT FLIPS, precisely: `submit_response` stops blocking on an unsigned
-- `signoff_role='staff_admin'` section of a CASE-PHASE response (D2 — a
-- standalone response keeps HC012); the phase parks in `awaiting_signoff`; the
-- last signature completes it. ⛔ The status-list widenings (`close_case`,
-- `cancel_case`, `recompute_case_status`, `guard_case_phase_status`,
-- `file_correction_request`) are NOT flag-gated and have been live since
-- `20261003001900` — they are inert while no phase can reach the status, which
-- is why flipping this flag OFF again later does not strand a parked phase.
-- ============================================================================

update app.feature_flags set enabled = true where key = 'deferred_staff_signoff';

-- Prove it landed, from the catalog, in the same transaction. A flip that did
-- not apply otherwise reports green — and this one is the whole migration, so
-- there would be nothing else to notice.
do $mig$
begin
  if not exists (
    select 1 from app.feature_flags
    where key = 'deferred_staff_signoff' and enabled = true
  ) then
    raise exception
      'ADR0136: the deferred_staff_signoff flip did not land (row missing, or still false)';
  end if;
end;
$mig$;
