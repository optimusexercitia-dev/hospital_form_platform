-- =============================================================================
-- AUTHZ · M1·4b — THE GATE HELPERS CARRY THE DENY (ADR 0078 A29; review §W-6).
--
-- D5's frame, and the reason it is the one that closes: enumerating CALL SITES
-- never converged (five rounds, five floors: 37 → 30 → 35/49 → 10 → 57), because
-- "is this caller gated?" is a per-function judgement no filter makes. The GATE
-- HELPER set is finite, bounded and checkable — 16 helpers, of which 5 carried
-- the deny and 11 did not, across 48 callers. Fix the helpers and every caller is
-- fixed for free (the closure argument, §W-2.3).
--
-- ⚠ BUT: "fix the 11 helpers and we're done" WOULD SHIP WITH THE P0s INTACT.
-- The self-serving mutators check `is_staff_admin_of` DIRECTLY and carry none of
-- the helpers' strings — they are closed by 20260722000000 (M1·2), not by this
-- file. M1 = helpers ∪ direct-check doors. Both required; neither sufficient.
-- `reclassify_attachment` below is the second member of that direct-check set.
--
-- SCOPE — this file adds the DENY ONLY. It does NOT remove arms, split
-- predicates, or repoint policies:
--   · A21's admin-arm removal (can_read_attachment ×2, assert_meeting_staff_admin)
--     is EXCLUDED from M1 — D4·3 requires the resolver first.
--   · B3's attachment_confidentiality_ok / confidentiality_clearance_ok repoint
--     and the can_read_referral{,_phi} split are Stage-B/F-min, not durability.
-- Keeping an arm and adding the deny are ORTHOGONAL (C6, proven twice).
--
-- D5's SCOPING RULE, written down so this boundary is checkable rather than
-- hand-drawn (§W-7·1): a helper takes the deny iff it gates CASE-scoped content
-- AND a case_id is resolvable from its arguments. That rule — not a hand-written
-- IN list — is why the members below are what they are, and it is what excludes
-- the meeting arm (a meeting is not a case) and the referral helpers.
--
-- ⭐ FIXED FOR FREE, and deliberately NOT double-patched (§W-7·3):
--   · can_read_attachment's `case` and `interview` arms already delegate to
--     can_read_case, which carries the deny. Its `action_item` arm is fixed by
--     can_read_action_item below. Its remaining gap is the MEETING arm, which is
--     not case-scoped ⇒ out of scope by the rule above, not by omission.
--   · can_write_attachment's `interview` arm delegates to can_write_interview.
-- =============================================================================

-- One door, one message, one SQLSTATE. Callers below use it so that "excluded"
-- can never again be spelled five slightly different ways.
create or replace function app.assert_not_case_excluded(p_case_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if p_case_id is not null and app.is_case_excluded(p_case_id, auth.uid()) then
    raise exception 'você está impedido neste caso e não pode exercer a coordenação sobre ele'
      using errcode = 'HC0F1';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 · can_write_case_narrative ⭐ (D6 — found in A0 v3, invisible to every prior
--     sweep: the RPC carries no arm string, and it was not among qa's five
--     hand-picked wrapper names).
--
-- save_narrative_body's own "Q14 write predicate (the authority)". A RECUSED
-- COORDINATOR WRITES NARRATIVE BODIES on the case she is recused from, and
-- case_narratives.body_md is PHI-BEARING free text by its own column comment.
--
-- It is also SELF-INCONSISTENT today, which is the tell: arm 3 routes through
-- can_write_case_content and therefore DOES carry the deny, while arms 1 and 2
-- do not. So the same principal is denied or allowed depending only on whether
-- the narrative happens to be assigned. After this change the arms agree.
--
-- ⚠ Note arm 2 (the assignee arm) is a raw `v_assigned_to = p_uid` with NO
-- exclusion AND NO is_active check — lead-verified. The deny is added here; the
-- MISSING is_active is NOT a durability defect and is left for the Stage-A/G
-- sweep rather than smuggled in. Flagged, not silently fixed.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_case_narrative(p_narrative_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case_id     uuid;
  v_commission  uuid;
  v_assigned_to uuid;
begin
  select cn.case_id, c.commission_id, cn.assigned_to
    into v_case_id, v_commission, v_assigned_to
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative_id;

  if v_case_id is null then
    return false;
  end if;

  -- THE HARD DENY, BEFORE EVERY POSITIVE ARM (the resolver's fail-closed order,
  -- A2). This is what makes arm 1 and arm 3 agree.
  if app.is_case_excluded(v_case_id, p_uid) then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    -- NULL-safe assignee check: an UN-assigned narrative (v_assigned_to IS NULL)
    -- must NOT make this term NULL (which would poison the boolean OR and yield
    -- NULL instead of a clean false). `is not distinct from` would be true for
    -- (null, null) — wrong — so require non-null explicitly.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null
        and app.can_write_case_content(v_case_id, p_uid));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · can_write_interview (8 callers). No deny today; also no is_active on the
--     interviewer arm (flagged, not fixed here — same reasoning as above).
--     case_interviews.case_id makes the deny writable.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_interview(p_interview_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.case_interviews i
    where i.id = p_interview_id
      and not app.is_case_excluded(i.case_id, p_uid)   -- ⬅ the deny, before every arm
      and (
        app.is_staff_admin_of_for(i.commission_id, p_uid)
        or app.is_commission_admin_of_for(i.commission_id, p_uid)
        or exists (
          select 1 from public.case_interview_interviewers iv
          where iv.interview_id = i.id and iv.user_id = p_uid
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3 · can_write_attachment (D7 — qa's insight; 4 callers, and they include
--     dispose_attachment_phi (PHI DESTRUCTION) and soft_delete_attachment).
--     Only the `case` arm is case-scoped; `interview` delegates to
--     can_write_interview (fixed above ⇒ free); `meeting` / `action_item` are
--     not case-scoped ⇒ excluded by D5's scoping rule.
-- ---------------------------------------------------------------------------
create or replace function app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  -- HONOR THE EXPLICIT p_uid (backend fix, reset-OK local-only pass — same rationale as
  -- can_read_attachment's meeting/interview arms): use the _for explicit-uid variants
  -- rather than the implicit-auth.uid() single-arg predicates.
  case p_owner_type
    when 'case' then
      -- ⬅ the deny: p_owner_id IS the case_id on this arm.
      if app.is_case_excluded(p_owner_id, p_uid) then
        return false;
      end if;
      v_commission := app.commission_of_case(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      v_commission := app.commission_of_meeting(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'action_item' then
      -- Q5b: staff_admin / org-admin OR the assignee (assigned_to OR active assignment).
      -- Case-scoped ONLY when the item is anchored to a case; the deny is applied
      -- there and nowhere else (D5's scoping rule — a committee item is not a case).
      if app.is_case_excluded(app.case_of_action_item(p_owner_id), p_uid) then
        return false;
      end if;
      v_commission := app.commission_of_action_item(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid)
          or app.is_commission_admin_of_for(v_commission, p_uid)
          or exists (select 1 from public.action_items ai
                     where ai.id = p_owner_id and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = p_owner_id and a.user_id = p_uid and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(p_owner_id, p_uid);   -- carries the deny ⇒ free
    else
      return false;                                  -- form_upload / unknown: reserved-inert
  end case;
end;
$$;

-- The case anchor an action_item may or may not have. Null for a committee item —
-- and app.is_case_excluded(null, …) is false, so a non-case item is unaffected.
create or replace function app.case_of_action_item(p_action_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(ai.source_case_id, ai.case_id)
  from public.action_items ai where ai.id = p_action_item_id;
$$;

-- ---------------------------------------------------------------------------
-- 4 · can_read_action_item (A22 + A24·5; 3 callers, and it is also
--     can_read_attachment's `action_item` arm ⇒ that arm is fixed for free).
--
--     Its `case_restricted` scope ALREADY carries the deny via can_read_case.
--     Its `committee` and `assignees_only` scopes do not — so an excluded party
--     reads action items of the case she is excluded from whenever the item is
--     filed under either of those scopes. The deny is applied ONLY when the item
--     actually anchors to a case (D5's rule): a committee item with no case is
--     not case content and must keep working.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
  v_anchor_case uuid;
begin
  select commission_id, visibility_scope, source_case_id, case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  -- ⬅ the deny, before every arm, but ONLY where a case anchor exists.
  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null and app.is_case_excluded(v_anchor_case, p_uid) then
    return false;
  end if;

  if v_scope = 'committee' then
    return app.is_member_of_for(v_commission_id, p_uid)
        or app.is_commission_admin_of_for(v_commission_id, p_uid);

  elsif v_scope = 'case_restricted' then
    return app.can_read_case(v_anchor_case, p_uid);

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)
        or app.is_commission_admin_of_for(v_commission_id, p_uid)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$$;

-- =============================================================================
-- M1·4 · reclassify_attachment — THE DIRECT-CHECK RESIDUE (§W-2.5).
--
-- Why it needs its own patch, and why no content filter found it: its DECLASSIFY
-- arm (phi → standard) checks `is_staff_admin_of OR is_commission_admin_of`
-- DIRECTLY rather than going through can_write_attachment, so the helper fix
-- above does NOT reach it. Every other tier transition DOES route through the
-- helper and is fixed for free — which is exactly what made this arm invisible.
--
-- Consequence: a recused/respondent coordinator DOWNGRADES a PHI attachment on
-- her own case out of `attachments-phi`, stripping its Rule 12 protection.
-- =============================================================================
create or replace function public.reclassify_attachment(
  p_id uuid,
  p_new_tier text,
  p_new_label text default null::text
)
returns public.attachments
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_row public.attachments;
  v_commission uuid;
  v_new_bucket text;
  v_new_label text;
begin
  perform app.assert_attachments_enabled();

  if p_new_tier not in ('phi', 'standard') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  select * into v_row from public.attachments where id = p_id;
  if v_row.id is null then
    raise exception 'anexo não encontrado' using errcode = 'P0002';
  end if;
  v_commission := app.commission_of_attachment(v_row.owner_type, v_row.owner_id);

  -- Directional authz: declassify (phi→standard) is staff_admin/org-admin only.
  if p_new_tier = 'standard' and v_row.sensitivity_tier = 'phi' then
    if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
      raise exception 'apenas a coordenação pode reduzir a classificação de um anexo'
        using errcode = '42501';
    end if;
    -- ⬅ THE DENY. This arm never touches can_write_attachment, so it carries the
    -- deny itself or not at all. AUTHORITY FIRST, EXCLUSION SECOND — same order,
    -- same reason, as the M1·2 mutators.
    if v_row.owner_type = 'case' then
      perform app.assert_not_case_excluded(v_row.owner_id);
    elsif v_row.owner_type = 'interview' then
      perform app.assert_not_case_excluded(app.case_of_interview(v_row.owner_id));
    end if;
  else
    if not app.can_write_attachment(v_row.owner_type, v_row.owner_id, auth.uid()) then
      raise exception 'sem permissão para reclassificar este anexo' using errcode = '42501';
    end if;
  end if;

  v_new_bucket := case when p_new_tier = 'phi' then 'attachments-phi' else 'attachments' end;

  -- Resolve a label consistent with the new tier (defence in depth). A patient-PHI
  -- label cannot survive a declassify.
  v_new_label := coalesce(p_new_label, v_row.confidentiality_label);
  if p_new_tier = 'standard' and v_new_label in ('phi_standard', 'phi_restricted') then
    v_new_label := 'non_phi_internal';
  end if;
  if v_new_label in ('phi_standard', 'phi_restricted') and p_new_tier <> 'phi' then
    raise exception 'rótulo incompatível com a classificação' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_attachments_rpc', 'on', true);
  update public.attachments
     set sensitivity_tier = p_new_tier,
         storage_bucket = v_new_bucket,
         confidentiality_label = v_new_label,
         updated_at = now()
   where id = p_id
  returning * into v_row;
  perform set_config('app.in_attachments_rpc', 'off', true);

  return v_row;
end;
$$;

-- =============================================================================
-- M1·4 · §3.6·A2 · set_participant_patient — the THIRD direct-check door.
--
-- DEFINER · `is_staff_admin_of` ONLY · NO read gate · `on conflict do update` ⇒ a
-- DESTRUCTIVE PHI OVERWRITE (qa V-6.1). It carries no is_commission_admin_of arm,
-- so A21's arm removal would never have touched it, and it routes through no gate
-- helper, so M1·4b would never have reached it either. It is patched here or not
-- at all — the same lesson as reclassify_attachment.
--
-- Rule 12: this writes `case_patient`. An excluded principal — the respondent
-- himself — must not overwrite the patient identity of the case in which he is
-- the accused.
--
-- ⚠ Patched by surgical rewrite of the AUTHORITY BLOCK ONLY, via
-- pg_get_functiondef + replace + execute, rather than by restating an ~80-line
-- PHI-writing body I would have to keep byte-accurate. The repo already uses this
-- idiom, and it is why "migration file text is stale" is a standing rule here:
-- VERIFY THIS FROM pg_proc, NOT FROM THIS FILE.
-- ⚠ SINGLE-LINE ANCHOR, DELIBERATELY. My first attempt anchored on the whole
-- multi-line authority block and the guard below correctly REFUSED it: the stored
-- body uses CRLF, this file uses LF, so a multi-line anchor never matches. Any
-- anchor that spans a newline is hostage to line-ending drift on this repo
-- (cf. the sed-strips-CRLF lesson). One line, no newline, no hostage.
--
-- The deny is inserted immediately AFTER the authority check (which ends at the
-- line below) — preserving AUTHORITY FIRST, EXCLUSION SECOND.
do $mig$
declare
  v_def  text := pg_get_functiondef('public.set_participant_patient(uuid,uuid,text,text,date,integer,text,text,text,text,uuid)'::regprocedure);
  v_from text := 'if not v_case.patient_enabled then';
  v_to   text := 'perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (§3.6·A2)'
                 || chr(10) || '  if not v_case.patient_enabled then';
begin
  -- Verified from pg_proc at author time: exactly ONE occurrence. Assert it here
  -- so a future body drift FAILS LOUDLY instead of silently patching the wrong
  -- place — or, worse, patching nothing and leaving a green suite behind.
  if (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from) <> 1 then
    raise exception 'M1·4: set_participant_patient anchor is not unique/present — body drifted; '
                    'RE-READ pg_proc AND RE-ANCHOR rather than forcing this patch';
  end if;
  execute replace(v_def, v_from, v_to);
  -- Prove the patch actually landed, from the catalog, in the same transaction.
  if (select p.prosrc not like '%assert_not_case_excluded%'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'set_participant_patient') then
    raise exception 'M1·4: set_participant_patient patch did not take';
  end if;
end;
$mig$;

-- =============================================================================
-- M1·4 · dispose_case_phi — THE FOURTH DIRECT-CHECK DOOR (qa B2; my miss).
--
-- I triaged this to the carry list. That was WRONG, and qa proved it live: the
-- accused CANNOT READ the patient identifiers (can_read_case_patient = f) and yet
-- IRREVERSIBLY DESTROYS them ('[PHI removido]'). It is squarely inside M1·4 by
-- D5's own rule — case-scoped, case_id resolvable — and I fixed its exact twin
-- (can_write_attachment → dispose_attachment_phi) while missing this one. The
-- asymmetry is the tell: attachment-PHI disposal routes through a gate helper;
-- case-PHI disposal checks the role DIRECTLY, so nothing in M1·4b reached it.
--
-- ⚠ AND THE TRAP qa NAMED: this function's `check_violation` (23514) is the
-- REASON-CODE validation, which sits AFTER the authority gate. A probe passing an
-- invalid reason catches 23514 and looks "denied" while never touching the gate.
-- The keystone MUST pass a VALID reason to reach it, and must assert the PHI
-- SURVIVES — behaviourally, not by the error code that comes back.
--
-- Placed immediately AFTER the authority check and BEFORE the reason check:
-- AUTHORITY FIRST (42501), EXCLUSION SECOND (HC0F1).
do $mig$
declare
  v_def  text := pg_get_functiondef('public.dispose_case_phi(uuid,text)'::regprocedure);
  v_from text := 'if p_reason is null or p_reason not in';
  v_to   text := 'perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (qa B2)'
                 || chr(10) || '  if p_reason is null or p_reason not in';
begin
  -- Single-line anchor, for the CRLF reason documented above. Uniqueness verified
  -- from pg_proc at author time; asserted here so a body drift fails LOUDLY rather
  -- than silently patching nothing and leaving a green suite behind.
  if (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from) <> 1 then
    raise exception 'M1·4: dispose_case_phi anchor is not unique/present — body drifted; '
                    'RE-READ pg_proc AND RE-ANCHOR rather than forcing this patch';
  end if;
  execute replace(v_def, v_from, v_to);
  if (select p.prosrc not like '%assert_not_case_excluded%'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'dispose_case_phi') then
    raise exception 'M1·4: dispose_case_phi patch did not take';
  end if;
end;
$mig$;

-- =============================================================================
-- M1·4 · set_case_confidentiality — THE FIFTH DIRECT-CHECK DOOR.
--
-- qa refused to record this as "safe" on the strength of the HC0E5 it returns,
-- and was right. PROVEN BEHAVIOURALLY (excluded party, VALID level, rolled back):
--
--   PRE  | excluded=true | staff_admin=true | level=non_phi_internal
--   RESULT >>> CALL SUCCEEDED — NO DENY
--   POST | level=legal_privileged        ← the excluded party wrote it
--
-- HC0E5 is the LEVEL-VALIDATION precondition (`confidentiality_rank(p_level) is
-- null`), and it sits AFTER the authority check — it never masked anything.
-- There simply was no exclusion term.
--
-- ⚖ CONSEQUENCE, MEASURED — NOT INFLATED (the D2 lesson, applied to myself). This
-- is NOT a Rule 12 door like dispose_case_phi. `cases.confidentiality_level` does
-- NOT feed the document ceiling (confidentiality_clearance_ok reads the
-- ATTACHMENT's label, not the case's) and does NOT feed create_interview's default
-- (that is a parameter). What it is: the governance CLASSIFICATION RECORD of the
-- case — and the respondent rewrites his own. That is authority he must not hold;
-- it needs no bigger story than that to land, and it does not get one.
-- =============================================================================
create or replace function public.set_case_confidentiality(p_case_id uuid, p_level text)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_case public.cases;
begin
  perform app.assert_case_participants_enabled();
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação pode alterar a confidencialidade deste caso'
      using errcode = 'HC0E4';
  end if;
  -- ⬅ ADR 0078 M1·4. AUTHORITY FIRST (HC0E4), EXCLUSION SECOND (HC0F1), and both
  -- BEFORE the HC0E5 level validation — so a keystone cannot mistake the
  -- precondition for the gate, which is exactly how this door stayed open.
  perform app.assert_not_case_excluded(p_case_id);
  if app.confidentiality_rank(p_level) is null then
    raise exception 'nível de confidencialidade inválido' using errcode = 'HC0E5';
  end if;
  -- in_case_rpc bypasses the terminal-case immutability guard (a closed case may still
  -- be reclassified); the confidentiality-only update emits NO auto case audit (that
  -- trigger only fires on a status change) — so the explicit verb below is the one row.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.cases set confidentiality_level = p_level where id = p_case_id;
  perform set_config('app.in_case_rpc', 'off', true);
  perform app.audit_write('case.confidentiality_changed', 'case', p_case_id, v_case.commission_id,
    'Confidencialidade do caso alterada',
    jsonb_build_object('confidentiality_level', p_level));
end;
$$;

comment on function app.assert_not_case_excluded(uuid) is
  'ADR 0078 M1. Raises HC0F1 when the CALLER is excluded (respondent/recused) from '
  'p_case_id. Null-safe: a non-case-scoped door passes null and is unaffected. Callers '
  'MUST check authority FIRST (HC0E4) and this SECOND — a keystone whose principal '
  'lacks the staff_admin precondition then fails loudly instead of passing vacuously.';
