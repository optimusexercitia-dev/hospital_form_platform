-- =============================================================================
-- AUTHZ · M2 — A30 BUCKET C: platform_admin loses the referral-PHI destruction arm.
-- ADR 0078 A35 (PO ruling). SUBTRACTIVE ONLY — two arms, ~6 lines.
--
-- THE NOUN RULE (A35, PO-adopted; CLAUDE.md §1 amended to match): platform_admin
-- MAY touch tenancy · identity · vocabulary · audit. It MAY NOT touch commission
-- content or PHI. These two functions are the whole of bucket C.
--
-- ⭐ THE BREACH IS DESTRUCTION, NOT DISCLOSURE — re-proven by execution on the
-- live catalog before this file was written (transaction rolled back):
--
--   padmin is_admin (profiles) = true
--   ref_b PHI rows BEFORE      = 1
--   can_dispose_referral_phi(padmin) = true
--   padmin CAN READ the PHI?   = <<NULL — CANNOT READ>>     ← cannot read it…
--   RESULT >>> platform_admin DISPOSAL SUCCEEDED
--   ref_b PHI rows AFTER       = 0                           ← …but destroys it
--
-- The platform_admin cannot read a single identifier (get_referral_patient → NULL)
-- and irreversibly destroys the row anyway. Disclosure controls never covered this.
--
-- ⭐ MATCH THE SIBLINGS — DO NOT INVENT A SHAPE. Catalog-verified, this migration
-- makes the family uniform rather than novel:
--   BEFORE                              AFTER = the 4 siblings' existing shape
--   can_dispose_referral_phi  ARM       dispose_attachment_phi   no arm
--   dispose_referral_phi      ARM       dispose_case_phi         no arm
--                                       dispose_event_phi        no arm
--                                       dispose_meeting_minutes  no arm
--
-- The pt-BR message already told the truth the code did not — "apenas um
-- administrador da organização ou o NSP" never mentioned the platform admin. It is
-- left byte-for-byte unchanged: it becomes ACCURATE, not different.
--
-- ⛔ SCOPE FENCE: the 2-arm deletion ONLY. No resolver, no case_access_grants, no
-- A21 arm removal, no bucket B, no Class-2 (deferred deliberately — audited reads
-- are a product decision, and over-reach fails keystone 23), no §3.6 carry.
-- Subtractive-only is WHY this lands before the resolver without a merge surface.
--
-- SURVIVING DISPOSAL POPULATION (enumerated from the catalog, not assumed — the
-- over-grant twin exists because a deny that denies EVERYONE also denies
-- platform_admin, and would pass by construction):
--   nspcoord.b@test.local · orgadmin.b@test.local · pqs.b@test.local  (all is_admin=false)
-- i.e. is_commission_admin_of(source) OR is_pqs_operator_of(source|target hospital).
-- =============================================================================

create or replace function public.can_dispose_referral_phi(p_referral_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    -- ⬅ ADR 0078 A35 / M2: the platform-admin bypass is GONE. A platform_admin that
    -- cannot read referral PHI must not be able to destroy it. Matches the four
    -- sibling disposal doors, none of which carry this arm.
    --
    -- ⚠ THIS COMMENT DELIBERATELY DOES NOT SPELL THE ARM. My first draft wrote the
    -- literal call here and my own catalog self-check below failed — matching the
    -- COMMENT, not an arm. That is verbatim the false positive I reported in the A30
    -- census (the brief's "42" was really 40: three "matches" were comments
    -- documenting this very removal), reproduced inside the fix for it. The sibling
    -- helpers dodge it by the same convention — see attachment_confidentiality_ok.
    -- `text is not truth` holds for the text you write while removing the text.
    exists (
      select 1 from public.case_referral r
      where r.id = p_referral_id
        and (
          app.is_commission_admin_of(r.source_commission_id)
          or app.is_pqs_operator_of(app.hospital_of_commission(r.source_commission_id))
          or app.is_pqs_operator_of(app.hospital_of_commission(r.target_commission_id))
        )
    );
$$;

-- dispose_referral_phi — the executing door. Patched by surgical rewrite of the
-- AUTHORITY BLOCK ONLY (pg_get_functiondef + replace + execute) rather than by
-- restating an ~40-line PHI-destroying body I would have to keep byte-accurate.
--
-- ⚠ REGEX, NOT A LITERAL ANCHOR — and this is the second time line endings drove the
-- design here. The arm spans a newline (`app.is_admin()` ⏎ `or …`), and the stored
-- body is CRLF while this file is LF, so a literal anchor either misses or (as my
-- first attempt did) deletes the OPERAND and leaves the dangling OPERATOR:
--     if not (
--             or app.is_commission_admin_of(…)   ← syntax error at or near "or"
-- `\s*` swallows CR/LF/indent alike, so the arm AND its `or` go together.
-- And: migration file text is STALE BY DESIGN on this repo — VERIFY THIS FROM
-- pg_proc AFTER APPLYING, never by re-reading this file.
do $mig$
declare
  v_def text := pg_get_functiondef('public.dispose_referral_phi(uuid,text)'::regprocedure);
  v_new text;
begin
  if (select count(*) from regexp_matches(v_def, 'app\.is_admin\(\)', 'g')) <> 1 then
    raise exception 'M2: dispose_referral_phi is_admin() arm not found/not unique — body drifted; '
                    'RE-READ pg_proc AND RE-ANCHOR rather than forcing this patch';
  end if;
  v_new := regexp_replace(v_def, 'app\.is_admin\(\)\s*or\s+', '');
  if v_new = v_def then
    raise exception 'M2: dispose_referral_phi arm did not match the `is_admin() or` shape — re-read pg_proc';
  end if;
  execute v_new;
  -- Prove the deletion landed, from the catalog, in the same transaction. A patch
  -- that silently no-ops leaves a GREEN suite behind — the worst outcome here.
  if (select p.prosrc ~ 'app\.is_admin\(\)'
      from pg_proc p where p.oid = 'public.dispose_referral_phi(uuid,text)'::regprocedure) then
    raise exception 'M2: dispose_referral_phi still carries the is_admin() arm';
  end if;
  if (select p.prosrc ~ 'app\.is_admin\(\)'
      from pg_proc p where p.oid = 'public.can_dispose_referral_phi(uuid)'::regprocedure) then
    raise exception 'M2: can_dispose_referral_phi still carries the is_admin() arm';
  end if;
end;
$mig$;

comment on function public.can_dispose_referral_phi(uuid) is
  'ADR 0078 A35 / M2 (A30 bucket C). The platform_admin arm is DELETED: the noun rule '
  'permits platform_admin on tenancy/identity/vocabulary/audit, NEVER on PHI. Proven: a '
  'platform_admin could not READ referral PHI (get_referral_patient → NULL) yet DESTROYED '
  'it (1 row → 0). Disposal authority is the source commission-admin or an NSP operator of '
  'the source/target hospital — matching the four sibling disposal doors.';
