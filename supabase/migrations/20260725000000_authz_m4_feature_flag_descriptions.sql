-- =============================================================================
-- AUTHZ · M4 — the gated-off myth: correct FIVE flag DESCRIPTIONS (not six — see §1).
-- ⛔ DOCUMENTATION ONLY. `app.feature_flags.description` is the ONLY column this
-- migration writes. NO `enabled` value changes — flipping a flag is a product
-- decision and would be a behaviour change smuggled inside a doc migration.
--
-- WHY THIS IS NOT COSMETIC. THREE flags (case_patient · case_referrals · patient_index)
-- are force-set `true` by baseline via `on conflict … do update set enabled =
-- excluded.enabled`, so their gated-off prose has never matched the column in ANY
-- environment. Two more (case_participants · case_types) describe a gate that a later
-- migration RELEASED. (One — attachments — is accurate; see §1. My "6 for 6" was wrong.)
--
-- That prose is what put a FALSE CLAIM INTO A PERMANENT ADR: `case_referrals` was
-- declared "inert" — in the urgency-SUPPRESSING direction — while its PQS arm was
-- LIVE and conferring patient identifiers. Prose in the database is a landmine for
-- exactly the catalog-driven audits this program mandates. `text is not truth`
-- applies to the text stored IN the database, not only to migration files.
--
-- RULE, adopted: **a flag's `description` is prose; only `enabled` is the flag.**
-- A reading is not a fact until it is pinned to the state you are claiming about.
-- =============================================================================

-- ⚠ NOTE ON WORDING, and it is not stylistic: none of the text below QUOTES the
-- literal claim it replaces. The self-check greps for that exact string, so quoting
-- it — even to narrate its removal — re-creates it and fails the check. My first
-- draft did precisely that in three of the six rows. Third instance of this trap on
-- this program (M2's admin-arm comment, M3's table names, now this), and the first
-- inside a migration whose whole PURPOSE is deleting the string. Paraphrase history;
-- never quote the thing you are asserting the absence of.

-- 1 · attachments — ⛔ NOT TOUCHED, AND THAT IS THE FINDING.
--     My sweep reported "6 for 6" and the lead ratified it. **BOTH OF US WERE WRONG**,
--     and we were wrong the same way: the lead re-ran MY `ilike '%Ships OFF%'` query,
--     so it confirmed my PATTERN-MATCH, not the MECHANISM. Two people running the same
--     wrong query agree. (A0's rule — "whoever draws a boundary is not the only one who
--     checks it" — only works if the second check is INDEPENDENT.)
--
--     The mechanisms are three, not one:
--       · case_patient / case_referrals / patient_index — baseline force-sets `true`,
--         never gated anywhere ⇒ the prose is FLATLY FALSE. Rewritten below.
--       · case_participants / case_types — inserted false, then flipped true by
--         20260720001040_ethics_m2_flag_flip AFTER E1 landed ⇒ the gate was REAL and was
--         RELEASED AS DESIGNED. Stale TENSE, not a falsehood. Reworded below.
--       · attachments — inserted **false** by 20260717000500; `seed.sql` sets it true.
--         Its description ("Ships OFF (pre-pilot); enabled via seed.sql for E2E,
--         production flip deferred to the pilot cutover") is **ACCURATE — it describes
--         exactly that mechanism.** Rewriting it would have replaced a TRUE description
--         with a FALSE one ("baseline force-sets this flag true"), which my first draft
--         did. A migration to delete false claims that adds one is the whole disease.
--         ⇒ LEFT EXACTLY AS IS.

-- 2 · case_participants — ⚠ the m2 HARD GATE records a REAL safety decision. Do not
--     erase it: state that its precondition has since been met, and by what.
update app.feature_flags set description =
  'When true, the generalized case participant layer (ADR 0064 E0) is reachable: the participants '
  'typed-identity registry, case_participants links, role vocabulary, the Class-2 professional reader '
  '(professional_profile.read), and the N-aware patient panel. STATE: ENABLED — inserted disabled, '
  'then RELEASED by migration 20260720001040 (the m2 flag flip). (Historical gate, RESOLVED — the '
  'record is kept because the decision was real: this was an m2 HARD GATE, not to be flipped on real '
  'ethics data until E1 respondent-exclusion RLS landed. E1 HAS LANDED, ADR 0078 M1 made that '
  'exclusion DURABLE, and the flip migration released the gate as designed. ADR 0078 M4.)'
where key = 'case_participants';

-- 3 · case_patient — TWO false claims. The "Ships OFF" myth, AND the read-scope
--     sentence that ADR 0078 M3 invalidated. This is that sentence's LAST live copy
--     (the same claim was corrected in src/lib/queries/cases.ts, src/lib/cases/types.ts,
--     and a component's doc-comments).
update app.feature_flags set description =
  'When true, the Cases module captures an OPTIONAL minimum-necessary set of patient identifiers (the '
  'THIRD PHI module; ADR 0038): a per-template collects_patient toggle gates the create-dialog PHI '
  'block, identifiers live on the isolated patient store behind the audited single-door '
  'get_case_patient (case_patient.read), and dispose_case_phi provides LGPD erasure. READ SCOPE: '
  'app.can_read_case_patient — coordinator (staff_admin) or an unexpired case_access grant. It is NOT '
  'app.can_read_case, and it is NOT "broad": ADR 0078 defect ① / M3 removed the bare phase/narrative '
  'assignment arms, so an ASSIGNEE DOES NOT GET THE MRN (assignment is content reach, never PHI — '
  'Context·1 / D10). WRITES stay coordinator-only. STATE: ENABLED — baseline force-sets this flag true '
  'in every environment. (Historical intent: gated off until feature completion; that gating never '
  'took effect. ADR 0078 M4.)'
where key = 'case_patient';

-- 4 · case_referrals — the flag whose prose put a false claim into the ADR.
update app.feature_flags set description =
  'When true, Inter-Committee Case Referrals (Phase 22) are live: a committee sends a frozen '
  'point-in-time SNAPSHOT of a case to another committee as a Notification or Analysis Request, the '
  'target replies (structured outcome + result, optional linked case), QPS gets the cross-commission '
  'macro view, and a source case stays unconcludable while an expected reply is in flight (close_case '
  'HC076). Referrals MAY carry isolated PHI on referral_patient behind the audited single-door (Rule '
  '12; ADR 0037). STATE: ENABLED — baseline force-sets this flag true in every environment, and it has '
  'never been gated off in practice. ⚠ CONSEQUENCE: the PQS/NSP referral arm in app.can_read_case / '
  'app.can_read_case_patient is LIVE and confers PATIENT IDENTIFIERS, though ADR 0078''s source table '
  'says nsp_referral_touched should confer CONTENT ONLY; its removal is D8/N1 (Gate 2). This flag''s '
  'old description claimed the flag was gated off, which was read as proof the arm was inert and put '
  'that false claim into ADR 0078 A36·3 (since retracted). (Historical intent: enable at Phase 22 '
  'completion. ADR 0078 M4.)'
where key = 'case_referrals';

-- 5 · case_types
update app.feature_flags set description =
  'When true, the case-type config layer (ADR 0064 Decision 4) is reachable: case_types + '
  'case_type_terminology drive per-committee terminology/workflow/default-visibility and subject kind. '
  'STATE: ENABLED — inserted disabled, then RELEASED by migration 20260720001040 (the m2 flag flip), '
  'in-phase with case_participants. (Historical gate, RESOLVED: an m2 HARD GATE; see case_participants '
  '— E1 has landed and its precondition is met. ADR 0078 M4.)'
where key = 'case_types';

-- 6 · patient_index
update app.feature_flags set description =
  'When true, a NON-IDENTIFYING patient-identity layer links the same patient across committees (Phase '
  '23; ADR 0039): a deterministic, non-reversible keyed hash (patient_key/encounter_key = HMAC-SHA256 '
  'under the app.app_secrets pepper) is derived by a trigger on the three isolated PHI tables, mirrored '
  'into the KEY-ONLY QPS-only public.patient_xref, transmitted on referrals (with a count-only receiver '
  'hint), and reassembled into a PHI-free cross-committee trajectory + access audit by QPS-only DEFINER '
  'doors — every reassembly audited on the global chain, key-only, never the raw MRN. Adds no fourth '
  'PHI store. STATE: ENABLED — baseline force-sets this flag true in every environment. (Historical '
  'intent: gated off until feature completion; that gating never took effect. ADR 0078 M4.)'
where key = 'patient_index';

-- =============================================================================
-- SELF-VERIFICATION — prove the migration did what it says, from the catalog, in
-- the same transaction. A doc migration that silently no-ops leaves the landmine
-- armed AND a green suite behind, which is strictly worse than not running it.
-- =============================================================================
do $mig$
declare
  v_stale int;
  v_enabled int;
begin
  -- No description may carry the gated-off claim FALSELY. `attachments` is exempt on
  -- purpose: it IS gated off in migrations and enabled by seed.sql, so its claim is TRUE.
  -- Exempting it is the finding, not a workaround.
  select count(*) into v_stale from app.feature_flags
   where description ilike '%Ships OFF%' and key <> 'attachments';
  if v_stale <> 0 then
    raise exception 'M4: % flag description(s) still carry the gated-off claim falsely', v_stale;
  end if;

  -- The read-scope sentence M3 invalidated must be gone.
  if exists (select 1 from app.feature_flags
             where description ilike '%assignees need the MRN%'
                or description ilike '%BROAD can_read_case%') then
    raise exception 'M4: case_patient still carries the pre-M3 read-scope claim';
  end if;

  -- ⛔ SCOPE FENCE — this migration must not move a single flag.
  -- ⚠ PINNED TO MIGRATION TIME, which is BEFORE seed.sql runs. My first draft asserted
  -- "all six enabled" here and fired: `attachments` is legitimately DISABLED at this
  -- point (seed.sql enables it afterwards). That fence asserted a POST-SEED fact at a
  -- PRE-SEED moment — my own rule, broken by me: a reading is not a fact until it is
  -- pinned to the state you are claiming about. The fence caught the real mechanism.
  select count(*) into v_enabled from app.feature_flags
   where key in ('case_participants','case_patient','case_referrals','case_types','patient_index')
     and enabled;
  if v_enabled <> 5 then
    raise exception 'M4 SCOPE FENCE: expected 5 enabled flags at migration time, found % — a doc migration moved behaviour', v_enabled;
  end if;
  -- Guard the malformed-text defect I just made: my edit collided with the preceding
  -- line and produced "STATE: ENABLED — baseline force-sets STATE: ENABLED — ...".
  -- A doc migration whose OUTPUT is garbled is no better than the prose it replaced.
  if exists (select 1 from app.feature_flags
             where (length(description) - length(replace(description, 'STATE:', ''))) / length('STATE:') > 1) then
    raise exception 'M4: a description contains STATE: more than once — garbled text';
  end if;
  if (select enabled from app.feature_flags where key = 'attachments') then
    raise exception 'M4 SCOPE FENCE: attachments should still be DISABLED at migration time (seed.sql enables it) — mechanism changed';
  end if;
end;
$mig$;
