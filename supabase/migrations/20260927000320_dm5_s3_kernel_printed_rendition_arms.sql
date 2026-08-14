-- =============================================================================
-- DM5 S3 · M3 — the PRINT ARM in BOTH kernel doors
--
-- ⭐ WHY BOTH, STATED FIRST. S2 added a new home type, shipped the
-- `can_read_document` arm, and MISSED `can_write_document` for an entire slice:
-- `begin_document_upload` refused every user with `P0002` while pgTAP, tsc,
-- lint, vitest and all four authz arms stayed green. `ARM=floor` held because
-- it counts DOORS, not door-arms. The dispatch population was therefore derived
-- from the catalog as a PROPERTY, not from a list of names:
--
--   with b as (select n.nspname, p.proname,
--                     regexp_replace(p.prosrc,'--[^\n]*','','g') src
--                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--               where n.nspname in ('app','public'))
--   select nspname||'.'||proname,
--          (select string_agg(distinct m[1], ',' order by m[1])
--             from regexp_matches(src,
--               '''(case|meeting|interview|action_item|controlled_document|'
--               'case_referral|rca|capa_action|form_response)''','g') m)
--     from b where src ~ 'resource_type' or src ~ 'securable_resource';
--
-- 26 functions touch `resource_type`; EXACTLY TWO enumerate the whole type set
-- (`app.can_read_document`, `app.can_write_document`). Every other one names
-- only its own type or none. Comments are stripped first — `prosrc` includes
-- them and this repo has already had a census inflated by comments three times.
--
-- ⭐ WHY A PRINT ARM AT ALL, RATHER THAN LETTING THE HOME TYPE DECIDE.
-- D13 homes a print on its SOURCE's securable resource, so a meeting print's
-- `documents` row is `meeting`-homed. `can_read_document`'s meeting arm is
-- `app.is_member_of_for(v_commission, p_uid)` — verbatim, catalog-verified —
-- while `printed_documents_select` gates the registry row through
-- `app.can_view_printed_document`, whose meeting arm is
-- `can_reach_meeting AND can_read_full_meeting_content`. Those are DIFFERENT
-- predicates, and the home-type one is WIDER. Leaving the dispatch alone would
-- therefore have handed every commission member the title, minter and version
-- list of a print of a meeting they may not read — reachable with one
-- `GET /documents?home_resource_id=eq.<meeting>`. D18 filters a LIST; it does
-- not change which predicate governs a row, and ADR 0120 says in terms that
-- D18 "must never be recorded as having narrowed anyone's access".
-- So: a print's authority is the PRINT predicate, whatever its home type is.
-- This introduces no widening — the print `documents` row is new in this slice,
-- so there is no prior reach to narrow (ADR 0078 §7.7).
--
-- ⭐ AND IT IS WHAT MAKES D12's CONJUNCTION WELL-FOUNDED. `app.is_active` sits
-- ABOVE the type dispatch, and the print branch goes strictly BELOW it, so
--     can_read_document(print) == is_active AND can_view_printed_document(...)
-- which is strictly NARROWER than the print door alone. Hoisting the print
-- branch above the `is_active` guard would silently drop the account check and
-- re-open BUG-DM5-S3-INACTIVE-PRINT-1 below. Do not move it.
--
-- ⛔ BUG-DM5-S3-INACTIVE-PRINT-1 — the live defect this arm closes.
-- `app.can_view_printed_document` admits a DEACTIVATED account, so
-- `open_printed_document` (SECURITY DEFINER, EXECUTE granted to
-- `authenticated`, so RLS never runs) serves printed bytes to a profile with
-- `is_active = false`. Probed in one rolled-back transaction: creator active ->
-- print door `t` (the control, so the deny is not vacuous); that one profile
-- deactivated and nothing else changed -> print door STILL `t`; core door, same
-- uid -> `f`.
--   THE MECHANISM IS NOT "the `is_active` term is absent" — that would prove
--   nothing, since a callee could carry the check. It is that the
--   `form_response` arm's FIRST DISJUNCT is the bare column comparison
--   `v_resp.created_by = p_uid`, behind an `or`. No callee can supply a check
--   that a disjunction bypasses.
--   LATENT, NOT LIVE: `document_printing` ships OFF (20260913000300:18), so no
--   deployed environment reaches the door. Regression-tested at 342 S3c.
--
-- ⭐ FINDINGS-FILE OBLIGATION DISCHARGED IN THIS COMMIT, NOT LATER. Both doors
-- gain a NINTH arm under an UNCHANGED name, and their rows in
-- docs/reviews/authz-door-audit-findings.md read COVERED from DM1-era suites.
-- That is exactly the STALE-COVERED shape S2 shipped: a rename orphans a
-- verdict loudly, widening one is silent. A GATE KEEPS ITS NAME WHEN ITS ARMS
-- CHANGE — so the rows are updated in this migration's own commit to name 342
-- as the covering suite FOR THE PRINT ARM SPECIFICALLY.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- app.can_read_document — the eight existing arms are reproduced VERBATIM.
-- The only edits are: the print lookup, the `v_ok` indirection that lets the
-- print arm replace the dispatch, and their comments. The rebuild is diffed
-- against the captured pre-change `pg_get_functiondef` outside this file, and
-- the DO block at the end re-asserts every catalog property from the catalog —
-- reading a body carefully is not the same as proving you reproduced it.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_conf text;
  v_case uuid;
  v_print_kind text;
  v_print_source uuid;
  v_ok boolean;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id, d.confidentiality_level
    into v_resource, v_type, v_commission, v_conf
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;

  -- DM5 S3 (ADR 0120 D7/D11/D13): THE PRINT ARM, and it must stay HERE —
  -- below the is_active guard, above the ceiling. A printed rendition is a
  -- `documents` row referenced by `printed_documents`; its authority is the
  -- print predicate, NOT its home type's arm, because D13 homes it on its
  -- source's resource where the home arm can be wider (the meeting case). This
  -- is a relational test, never `documents.kind` — that column has no CHECK
  -- (0 constraints) and unchecked text fails OPEN when it is typo'd or NULL.
  select pd.source_kind, pd.source_id
    into v_print_kind, v_print_source
  from public.printed_documents pd
  where pd.document_id = p_document_id;

  if v_print_source is not null then
    -- Deliberately the SAME predicate `printed_documents_select` uses, so the
    -- D12 conjunction in open_printed_document is a STRICT NARROWING and the
    -- "kernel passes but the print check fails" direction is structurally
    -- unreachable. 342 S3d pins that delegation from the catalog; it is a
    -- fact, not a coincidence to be re-derived by the next reader.
    v_ok := app.can_view_printed_document(v_print_kind, v_print_source, p_uid);
  else
    v_ok := case v_type
      when 'case' then app.can_read_case(v_resource, p_uid)
      when 'meeting' then app.is_member_of_for(v_commission, p_uid)
      when 'interview' then app.can_read_interview(v_resource, p_uid)
      when 'action_item' then app.can_read_action_item(v_resource, p_uid)
      -- DM3 Wave B: the owning commission's members, PLUS the entitled approver
      -- corridor inherited from the retiring bucket policy. v_resource IS the
      -- controlled_documents.id (shared-PK registry link, ADR 0114 D4).
      when 'controlled_document' then
        app.is_member_of_for(v_commission, p_uid)
        or app.is_document_approver_of(v_resource, p_uid)
      -- DM4 Wave C: the referral METADATA tier (broad half of the two-tier
      -- asymmetry — ADR 0119 D2). Bytes are gated separately, and narrower,
      -- in open_document_version.
      when 'case_referral' then app.can_read_referral_metadata(v_resource, p_uid)
      -- DM5 Wave D (ADR 0120 D2): CUSTODY-FOLLOWING, resolved at read time.
      -- ⚠ Deliberately NOT `v_commission` — see the header. The registry pins the
      -- REPORTING commission for tenancy; who may READ follows custody, and
      -- can_read_event is the single place that knows how.
      when 'rca' then app.can_read_event(app.event_of_rca(v_resource), p_uid)
      -- DM5 Wave D (ADR 0120 D14): EXPLICITLY through can_read_capa, which
      -- carries all three of its arms (PQS operator of the plan's hospital, the
      -- event corridor, and the Phase-15 indicator-commission escalation).
      -- v_resource IS the capa_action.id; can_read_capa takes the PLAN id.
      -- Inlined rather than given an `app.capa_of_action` helper on purpose: a
      -- new DEFINER function would have to join the census domain AND the
      -- committed findings file in this same phase (ADR 0079 Am. 7), and this
      -- resolves structure, not authority.
      when 'capa_action' then app.can_read_capa(
        (select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid)
      -- DM5 S3: `form_response` is a securable type ONLY so a print of a form
      -- response has a home (ADR 0120 D1/D6). Nothing else homes there —
      -- begin_document_upload refuses it (M4) — so a non-print document on a
      -- form_response home is unrepresentable and falls to the fail-closed
      -- ELSE rather than being given an arm that could never be exercised.
      else false
    end;
  end if;

  if not v_ok then
    return false;
  end if;
  -- D15 ceiling (ADR 0114 Amendment 1; ADR 0072 D7 semantics): the two
  -- enforcing labels gate ABOVE home-resource read, as an AND-conjunct.
  -- Clearance = case_access_grants.max_confidentiality via the surviving
  -- app.confidentiality_clearance_ok (reused, never reimplemented).
  -- DM5 S3 note: prints reach this in principle but never in practice today —
  -- every print carries confidentiality_level NULL, and
  -- app.guard_document_confidentiality independently refuses an enforcing label
  -- on a form_response or meeting home. So D15 is satisfied VACUOUSLY for S3.
  -- The FUTURE property is the one worth recording: a case- or interview-homed
  -- print carrying an enforcing label resolves v_case and is gated by
  -- clearance; any other home falls to the backstop below and is readable by
  -- NO ONE. Fail-closed, not silently downgraded.
  if v_conf in ('legal_privileged', 'credentialing_sensitive') then
    v_case := case v_type
      when 'case' then v_resource
      when 'interview' then app.case_of_interview(v_resource)
      else null
    end;
    if v_case is null then
      -- Fail-closed backstop: an enforcing label with no clearance plane is
      -- readable by NO ONE. Unrepresentable while the S1 seam guard stands;
      -- this arm governs any bypass and any future home type until the
      -- Phase-19 access plane (D16) absorbs the column. DM3 note: a
      -- controlled_document home lands HERE by design — Wave B documents can
      -- never carry an enforcing label, which is precisely why ethics letters
      -- home on the CASE resource instead (ADR 0114 Amendment 2). DM4 note:
      -- a case_referral home lands here too — and the FREEZE of an
      -- enforcing-labelled case document is refused outright (HC0DC,
      -- ADR 0119 D4), so the ceiling cannot be laundered through a referral.
      -- DM5 note: `rca` and `capa_action` land here too, deliberately — NSP
      -- evidence has no clearance plane, so an enforcing label on it is
      -- unreadable by everyone rather than silently downgraded.
      return false;
    end if;
    return app.confidentiality_clearance_ok(v_case, v_conf, p_uid);
  end if;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- app.can_write_document — the print arm MIRRORS revoke_printed_document's
-- authority verbatim (`is_staff_admin_of_for OR is_tenancy_admin_of_for` on the
-- print's own commission). PARITY, not improvement: over-reach breaks
-- legitimate surface, and inventing a different write authority for the same
-- artifact would leave two answers to one question.
--
-- ⚠ It has to grant SOMETHING. D11 retires superseded print bytes through
-- `file_objects.disposal_state`, whose only entry point is
-- request_document_disposition -> can_write_document. A print arm returning
-- false would have made D11's retirement mechanism a door nothing can reach.
-- What that grant must NOT enable is bounded in M4, structurally.
-- -----------------------------------------------------------------------------
create or replace function app.can_write_document(p_document_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_resource uuid;
  v_type text;
  v_commission uuid;
  v_print_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then
    return false;
  end if;
  select d.home_resource_id, s.resource_type, s.commission_id
    into v_resource, v_type, v_commission
  from public.documents d
  join public.securable_resources s on s.id = d.home_resource_id
  where d.id = p_document_id;
  if v_resource is null then
    return false;
  end if;

  -- DM5 S3: THE PRINT ARM — same position and same reason as in
  -- can_read_document (below is_active, replacing the home dispatch).
  select pd.commission_id into v_print_commission
  from public.printed_documents pd
  where pd.document_id = p_document_id;
  if v_print_commission is not null then
    return app.is_staff_admin_of_for(v_print_commission, p_uid)
        or app.is_tenancy_admin_of_for(v_print_commission, p_uid);
  end if;

  case v_type
    when 'case' then
      if app.is_case_excluded(v_resource, p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      if app.is_case_excluded(app.case_of_action_item(v_resource), p_uid) then
        return false;
      end if;
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = v_resource and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = v_resource and a.user_id = p_uid
                       and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(v_resource, p_uid);
    -- DM3 Wave B: writing a controlled document's files mirrors the authority
    -- the retiring `set_document_version_file` enforced (app.is_staff_admin_of
    -- on the owning commission). The APPROVER arm is deliberately absent here —
    -- an approver reads the artifact he reviews; he does not replace its bytes.
    when 'controlled_document' then
      return app.is_staff_admin_of_for(v_commission, p_uid);
    -- DM4 Wave C (ADR 0119 D6): reply attachments are B-side only, while the
    -- referral still accepts them — the legacy add_referral_reply_attachment
    -- window, preserved exactly.
    when 'case_referral' then
      return app.can_manage_referral_target(v_resource, p_uid)
         and exists (select 1 from public.case_referral r
                      where r.id = v_resource
                        and r.status in ('accepted', 'in_review'));
    -- DM5 S2 M7: the WRITE counterparts. `can_write_rca` = PQS operator of the
    -- event's hospital OR a non-observer rca_member. `can_write_capa` takes the
    -- PLAN id, so the action resolves to its plan first — the same inlining
    -- can_read_document uses, and for the same reason: this resolves STRUCTURE,
    -- not authority, so it must not become a new DEFINER door that would have to
    -- join the census domain and the findings file (ADR 0079 Am. 7).
    when 'rca' then
      return app.can_write_rca(v_resource, p_uid);
    when 'capa_action' then
      return app.can_write_capa(
        (select ca.capa_id from public.capa_action ca where ca.id = v_resource), p_uid);
    else
      -- Includes `form_response`: only prints home there, and a print took the
      -- arm above. A non-print form_response document is unrepresentable (M4).
      return false;
  end case;
end;
$$;

-- -----------------------------------------------------------------------------
-- Faithful-rebuild verification, FROM THE CATALOG.
-- A CREATE OR REPLACE silently loses properties — the ACL on a DROP+CREATE, a
-- volatility class, a search_path pin ([[guards-that-read-right-but-fail-open]]).
-- This converts that class into a loud failure at apply time. It asserts each
-- delegated predicate is STILL named, so a dropped arm cannot hide inside a
-- rebuild that compiles.
-- -----------------------------------------------------------------------------
do $$
declare
  v_src text;
  v_missing text := '';
  v_arm text;
begin
  -- Non-negotiable catalog properties, both doors.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
         and p.proname in ('can_read_document', 'can_write_document')
         and p.prosecdef
         and p.provolatile = 's'
         and p.proconfig @> array['search_path=app, public, pg_catalog']) <> 2 then
    raise exception
      'DM5 S3 M3: a kernel door lost prosecdef / STABLE / the search_path pin in the rebuild';
  end if;

  -- The `authenticated` EXECUTE grant: these back RLS policies on documents,
  -- document_versions, document_version_files and document_placements, so a
  -- lost grant is a total read outage. aclexplode, never a substring.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) x
       where n.nspname = 'app'
         and p.proname in ('can_read_document', 'can_write_document')
         and x.privilege_type = 'EXECUTE'
         and x.grantee = 'authenticated'::regrole) <> 2 then
    raise exception 'DM5 S3 M3: a kernel door lost its authenticated EXECUTE grant';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
                  aclexplode(p.proacl) x
              where n.nspname = 'app'
                and p.proname in ('can_read_document', 'can_write_document')
                and x.privilege_type = 'EXECUTE' and x.grantee = 0) then
    raise exception 'DM5 S3 M3: PUBLIC gained EXECUTE on a kernel door';
  end if;

  -- Every pre-existing delegated predicate must still be reached. Comments are
  -- stripped first: `prosrc` includes them, and a comment naming a predicate
  -- has already faked a census in this repo three times.
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_document';
  foreach v_arm in array array[
    'can_read_case', 'is_member_of_for', 'can_read_interview',
    'can_read_action_item', 'is_document_approver_of',
    'can_read_referral_metadata', 'can_read_event', 'event_of_rca',
    'can_read_capa', 'confidentiality_clearance_ok', 'case_of_interview',
    'is_active', 'can_view_printed_document'
  ] loop
    if position(v_arm in v_src) = 0 then
      v_missing := v_missing || ' ' || v_arm;
    end if;
  end loop;
  if v_missing <> '' then
    raise exception 'DM5 S3 M3: can_read_document lost arm(s):%', v_missing;
  end if;

  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_write_document';
  v_missing := '';
  foreach v_arm in array array[
    'is_case_excluded', 'is_staff_admin_of_for', 'case_of_action_item',
    'action_item_assignments', 'can_write_interview',
    'can_manage_referral_target', 'can_write_rca', 'can_write_capa',
    'is_active', 'is_tenancy_admin_of_for'
  ] loop
    if position(v_arm in v_src) = 0 then
      v_missing := v_missing || ' ' || v_arm;
    end if;
  end loop;
  if v_missing <> '' then
    raise exception 'DM5 S3 M3: can_write_document lost arm(s):%', v_missing;
  end if;

  -- THE POSITION OF THE PRINT BRANCH IS LOAD-BEARING (see the header): it must
  -- sit BELOW the is_active guard in both doors, or the account check is
  -- silently dropped and BUG-DM5-S3-INACTIVE-PRINT-1 re-opens. Asserted
  -- positionally, because "both terms are present" would pass either ordering.
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_document';
  if position('is_active' in v_src) > position('printed_documents' in v_src) then
    raise exception
      'DM5 S3 M3: can_read_document reads printed_documents BEFORE app.is_active — the print arm bypasses the account check';
  end if;
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_write_document';
  if position('is_active' in v_src) > position('printed_documents' in v_src) then
    raise exception
      'DM5 S3 M3: can_write_document reads printed_documents BEFORE app.is_active';
  end if;
end;
$$;

commit;
