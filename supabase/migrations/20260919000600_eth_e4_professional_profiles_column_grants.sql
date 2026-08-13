-- ETH·E4 P0-1 — close the ethics-proceeding disclosure the D5 read arm opened.
--
-- THE DEFECT. ADR 0108 D5's exposure argument — the clause the PO ratified the
-- widening against — promised the arm "discloses no case linkage
-- (`professional_participants` carries no `case_id`)". That is true and irrelevant:
-- the disclosure travels through columns ON `professional_profiles` ITSELF that the
-- argument never enumerated.
--
--   `app.trg_pin_respondent_retention` is the ONLY writer of `retention_pinned_at` /
--   `retention_pin_reason` (catalog-derived). It fires solely on the transition INTO
--   `case_decisions.status = 'issued'`, and solely for participants whose role key is
--   `respondent_doctor`, writing the literal `'ethics_decision_issued'`.
--
-- So `retention_pin_reason` IS a case linkage. Of a named doctor it states: respondent
-- in an ethics proceeding that reached an issued decision — role, stage, and
-- outcome-existence, the three facts sigilo do processo ético exists to protect. Those
-- columns sat inside a TABLE-WIDE `authenticated` SELECT grant, so the D5 arm made them
-- readable by every org manager. Measured live before this migration: a `staff_admin`
-- of an unrelated commission, with no ethics membership and no case access, read the
-- full row.
--
-- ⚠ THIS PHASE OPENS BOTH HALVES, which is why it is ours to close and not a
-- pre-existing condition to inherit: before ETH·E4 nothing could seat a
-- `respondent_doctor` through the product, so the trigger could not fire; E4 opens that
-- write path and widens the read path in the same change.
--
-- ─────────────────────────────────────────────────────────────────────────────────
-- WHY A GRANT ALONE IS NOT ENOUGH — the half a grant-only fix would miss.
--
-- `public.get_case_professional` is SECURITY DEFINER (`prosecdef = true`,
-- catalog-verified), so it executes as its OWNER and column-level grants on
-- `authenticated` DO NOT CONSTRAIN IT. It returned `to_jsonb(<whole row>)`, which
-- re-exposes every column today AND every column added in future — the FUP-PDF-3 shape.
-- `prosecdef` belongs beside `pg_policies`: a grant-only fix here would read as correct
-- and still leak. §2 below rebuilds its projection from an EXPLICIT column list, chosen
-- to be exactly the granted set, so the DEFINER door and the RLS surface cannot diverge.
-- ─────────────────────────────────────────────────────────────────────────────────
--
-- ⚠⚠ THE COLUMN-LIST TRAP, STATED BECAUSE IT HAS BITTEN THIS PROJECT TWICE
-- (`profiles`, `case_referral`): once a table is on COLUMN-LIST grants, a table-wide
-- `grant select` no longer exists to cover new columns. EVERY COLUMN ADDED TO
-- `professional_profiles` FROM NOW ON NEEDS ITS OWN EXPLICIT `GRANT SELECT (col)` IN
-- THE SAME MIGRATION, or reads of it fail with 42501 at runtime — and the failure is a
-- PostgREST error the UI never asked for, not a compile error.
--
-- ─────────────────────────────────────────────────────────────────────────────────
-- ALL 17 COLUMNS AUDITED AND DECIDED INDIVIDUALLY (re-derived from
-- information_schema.columns, not from any prose list).
--
-- REVOKED (5):
--   cpf                  national ID (LGPD sensitive personal data). No RLS-path reader
--                        anywhere in `src`. This is FUP-ETH-CPF-1, closed here.
--   retention_pinned_at  CASE-LINKED — see the defect above.
--   retention_pin_reason CASE-LINKED — and it carries the reason literal itself.
--   user_id             correlates a professional to a platform auth account. The
--                        product reads `link_state` for that, never this; every
--                        consumer that genuinely needs it (`app.is_case_respondent`,
--                        `set_professional_link_state`) is SECURITY DEFINER and
--                        unaffected by grants.
--   redacted_by         names the administrator who performed an LGPD erasure. No
--                        RLS-path reader.
--
-- KEPT (12) — the picker's actual purpose (ADR 0108 D5) plus keys and benign metadata:
--   id, organization_id                     keys / filters
--   full_name, professional_type,
--   license_number, license_region,
--   specialty                               the disambiguation D5 exists for
--   affiliation_status                      benign professional metadata, not case-linked
--   link_state                              read by getCaseDetail + searchParticipants
--   created_at, updated_at                  benign
--   redacted_at   ⚠ KEPT DELIBERATELY: `searchParticipants` FILTERS on it
--                 (`.is('redacted_at', null)`), and PostgREST filtering requires SELECT
--                 on the filtered column — revoking it would 42501 the whole picker.
--                 It discloses only THAT a profile was redacted, never by whom.
--
-- NOT AFFECTED: `service_role` keeps its table-wide grants (the E2E harness reads
-- through it), and every SECURITY DEFINER door continues to see all columns.
-- ─────────────────────────────────────────────────────────────────────────────────

revoke select on public.professional_profiles from authenticated;

grant select (
  id,
  organization_id,
  full_name,
  professional_type,
  license_number,
  license_region,
  specialty,
  affiliation_status,
  created_at,
  updated_at,
  link_state,
  redacted_at
) on public.professional_profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────
-- §2 — the DEFINER half. `create or replace`, NEVER DROP+CREATE (the ACL argument
-- from 20260919000300 applies identically). Only the projection changes: the gate,
-- the audit call, the NULL-out-of-scope contract and the ACL are untouched.
-- ─────────────────────────────────────────────────────────────────────────────────

create or replace function public.get_case_professional(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_profile public.professional_profiles;
  v_profile_id uuid;
  v_case uuid;
  v_comm uuid;
begin
  select professional_profile_id into v_profile_id
    from public.professional_participants where participant_id = p_participant_id;
  if v_profile_id is null then
    return null;
  end if;
  if not app.can_read_professional_profile(v_profile_id, auth.uid()) then
    return null;  -- out of scope → NULL, no audit row
  end if;

  select * into v_profile from public.professional_profiles where id = v_profile_id;

  v_case := (
    select cp.case_id from public.case_participants cp
    where cp.participant_id = p_participant_id and cp.removed_at is null
    order by cp.added_at asc limit 1
  );
  v_comm := case when v_case is not null then app.commission_of_case(v_case) else null end;

  perform public.log_audit_access(
    'professional_profile.read', 'professional_profile', v_profile_id, v_comm,
    'Leitura da identidade profissional', '{}'::jsonb
  );

  -- ⚠ EXPLICIT PROJECTION, deliberately NOT `to_jsonb(v_profile)`. This door is
  -- SECURITY DEFINER, so it is not constrained by the column grant above; a wholesale
  -- row-to-json re-exposed `cpf`, the retention (case-linked) columns and `user_id`
  -- through the DEFINER, and would silently re-expose EVERY COLUMN ADDED IN FUTURE.
  -- The key set below is exactly the granted set, so the two surfaces cannot diverge:
  -- if you add a column here, add it to the GRANT, and vice versa.
  return jsonb_build_object(
    'id',                 v_profile.id,
    'organization_id',    v_profile.organization_id,
    'full_name',          v_profile.full_name,
    'professional_type',  v_profile.professional_type,
    'license_number',     v_profile.license_number,
    'license_region',     v_profile.license_region,
    'specialty',          v_profile.specialty,
    'affiliation_status', v_profile.affiliation_status,
    'link_state',         v_profile.link_state,
    'redacted_at',        v_profile.redacted_at,
    'created_at',         v_profile.created_at,
    'updated_at',         v_profile.updated_at
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────────
-- §3 — LGPD erasure completeness. `redact_professional_profile` nulls full_name,
-- license, specialty, professional_type, affiliation_status and user_id, but LEFT
-- `cpf` in place — an erasure that preserves the national ID is not an erasure. The
-- grant above closes the EXPOSURE; this closes the ERASURE gap, which is a different
-- defect that happened to be hidden behind the same column.
--
-- `create or replace`, one added assignment inside the existing UPDATE. The HC0J7
-- gate, the `app.in_redaction_rpc` escape and the audit call are untouched.
-- ─────────────────────────────────────────────────────────────────────────────────
do $do$
declare v_def text;
begin
  select pg_get_functiondef('public.redact_professional_profile(uuid,text)'::regprocedure)
    into v_def;

  if position('cpf' in v_def) > 0 then
    raise notice 'redact_professional_profile already mentions cpf — leaving it alone';
    return;
  end if;

  v_def := replace(
    v_def,
    'user_id            = null,',
    'user_id            = null,' || E'\n    cpf                = null,'
  );
  if position('cpf                = null,' in v_def) = 0 then
    raise exception 'ETH·E4 P0: could not splice the cpf scrub into redact_professional_profile — '
                    'the shipped body changed shape; fix this migration rather than skipping it';
  end if;
  execute v_def;
end
$do$;
