-- ============================================================================
-- PDF·P3 — the D15 TRIGGER functions' ACLs. Restores the `app` PUBLIC-executable
-- population to its exact committed baseline.
--
-- ⭐ FOUND BY A GATE THAT ALREADY EXISTED, AND THAT IS THE STORY OF THIS FILE.
--    `supabase/tests/320_act_expiry_and_acl_hardening.sql` carries a SCHEMA-SCOPED
--    RATCHET: it counts every `app` function that is PUBLIC-executable (NULL
--    `proacl`, or an explicit grantee-0 entry) and asserts the count is EXACTLY
--    its measured baseline of **237**, with a create/drop CONTROL either side
--    proving the detector moves. It exists so that "a new app door with a
--    default ACL" cannot land unnoticed.
--
--    PDF·P3 landed 15 new `app` functions. `20261003002700` revoked PUBLIC on
--    the three CALLABLE ones and deliberately left the twelve
--    `app.trg_bump_case_revision*` trigger bodies alone, reasoning that
--    `returns trigger` cannot be invoked directly so their NULL `proacl` grants
--    nothing to anybody, and that revoking there would be "ceremony that implies
--    the opposite".
--
-- ⛔ **THAT REASONING WAS WRONG, AND THE GATE IS WHY.** The count is not a
--    judgement about which functions are dangerous — it is a POPULATION bound,
--    and twelve exemptions widened it by twelve. 237 -> 249, measured. The
--    argument "these particular ones are harmless" is exactly the argument that,
--    repeated, turns a ratchet into a hand-maintained allowlist — the failure
--    mode 320's own header describes when it explains why it replaced an
--    8-name allowlist with a schema-scoped count.
--
-- ⛔ **AND RAISING THE BASELINE TO 249 WOULD HAVE BEEN THE WORSE FIX.** That is
--    bumping a watermark to grandfather what you just wrote — the same move
--    `lint:set-local`'s header forbids by name, and it flips the ratchet's
--    direction from stricter to weaker. The population is restored to 237
--    instead, so **320 needs no edit at all**: the baseline it asserts is still
--    the truth.
--
-- ⚠ SAFETY, MEASURED NOT ASSUMED. All twelve trigger functions are
--    `prosecdef = true, owner = postgres`, and Postgres checks EXECUTE on a
--    trigger function at CREATE TRIGGER time, not at fire time. Verified
--    empirically before this file was written: with the helper chain revoked, a
--    terminal case plus a `case_events` insert still moved the counter
--    `before = 0 -> after = 1`, and the dispatch answered
--    `registers=t · watermark=final · revision=1 · head=t` end to end.
--
-- ⚠ Bounded honestly, as in `20261003002400`'s header: schema `app` is NOT
--    PostgREST-exposed, so none of this was reachable over the API at any ACL.
--    Defence in depth — and worth restoring precisely because a layer everyone
--    believes is there, and which is silently absent, is worth less than none.
-- ============================================================================

revoke execute on function app.trg_bump_case_revision() from public;
revoke execute on function app.trg_bump_case_revision_self() from public;
revoke execute on function app.trg_bump_case_revision_answers_new() from public;
revoke execute on function app.trg_bump_case_revision_answers_old() from public;
revoke execute on function app.trg_bump_case_revision_via_interview() from public;
revoke execute on function app.trg_bump_case_revision_via_participant() from public;
revoke execute on function app.trg_bump_case_revision_documents() from public;
revoke execute on function app.trg_bump_case_revision_tag() from public;
revoke execute on function app.trg_bump_case_revision_outcome() from public;
revoke execute on function app.trg_bump_case_revision_narrative_type() from public;
revoke execute on function app.trg_bump_case_revision_case_type() from public;
revoke execute on function app.trg_bump_case_revision_participant_role() from public;

-- ⚠ A `revoke ... from public` on a NULL `proacl` MATERIALISES the ACL: Postgres
-- expands the implicit default into an explicit array and removes the PUBLIC
-- entry, leaving `{postgres=X/postgres}`. That materialisation is the point — a
-- NULL that "means postgres-only" and a NULL that "means PUBLIC" are the same
-- NULL, and only an explicit array carries the intent to the next reader.
