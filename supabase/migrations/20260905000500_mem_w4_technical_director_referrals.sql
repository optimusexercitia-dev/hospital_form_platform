-- W4 (ADR 0094, decisions 9-10; interview decisions D1-D9) — the Diretor Técnico
-- referral plane: a committee submits a case for the DT's analysis over the EXISTING
-- referral machinery, PHI included and audited.
--
-- The whole design is one sentence: **a referral's target becomes a sum type.** It is
-- either a commission (everything that exists today) or the technical direction of a
-- hospital. Nothing forks — not the status machine, not the dialogue, not the
-- snapshot, not the audit trail. What changes is WHO the target audience resolves to.
--
-- ── What this migration is careful about ──────────────────────────────────────
--
-- Making `target_commission_id` nullable is not a local change: every expression in
-- the referral plane that compared something to it silently acquired a NULL operand,
-- and in SQL a NULL comparison inside `if` / `check` is not `false` — it is "no
-- opinion", which reads as PASS. Four such sites existed and each is closed here by
-- an EXPLICIT test rather than by hoping NULL propagates the way one wants:
--
--   1. `case_referral_waiting_on_check`  — `waiting_on in (source, target)` returns
--      NULL for any other committee once `target` is NULL, and a CHECK that evaluates
--      to NULL PASSES. It would have admitted an arbitrary committee as the waiting
--      party on every DT referral.
--   2. `app.guard_referral_message`      — `sender not in (v_src, v_tgt)` is NULL when
--      `sender` is NULL, so the `if` was not taken and the guard returned NEW. It
--      would have admitted a NULL sender on EVERY referral, DT or not (D3 needs NULL
--      admissible on DT rows ONLY).
--   3. `public.link_referral_case`       — `v_case_commission <> target_commission_id`
--      is NULL for a DT row, so the ownership check did not fire and ANY case in the
--      database could have been attached as `target_case_id`. (A DT referral can never
--      have a target case at all — `cases.commission_id` is NOT NULL and a DT holds no
--      commission — so the correct behaviour is an explicit refusal.)
--   4. `public.link_referral_related_case` — resolves the acting side's commission and
--      inserts it into a NOT NULL column; a DT would have produced a raw 23502 out of
--      an authority check it actually passed.
--
-- Sites 1-4 are NOT in the plan's task list. They were found by asking "what does this
-- expression evaluate to when the operand is NULL", which is the only reliable way to
-- find them: three of the four are single characters of difference from correct, and
-- all four fail OPEN, so no existing test could have gone red.
--
-- A FIFTH site was found by the new CHECK itself, and is worth recording because no
-- amount of reading would have produced it. "Exactly one waiting party" turns every
-- writer of `waiting_on_committee_id` into a writer of BOTH columns: a function that
-- sets its own column and leaves the other alone now produces a row with two waiting
-- parties. `conclude_referral` and `resolve_referral` needed no DT *audience* arm, so
-- they appeared in no DT-shaped enumeration — and conclude_referral was refused
-- outright the first time a DT referral reached it. That is the invariant failing
-- LOUD at build time instead of a silent NULL doing damage at runtime.
--
-- ── What deliberately does NOT change ─────────────────────────────────────────
--
-- * `public.can_dispose_referral_phi` (D6). It already resolves correctly for DT rows
--   through its source arms, and under the same-hospital rule (T4.7) the source
--   hospital IS the DT's hospital. Its third arm — the target-hospital PQS operator —
--   is dead for DT rows, and is LEFT DEAD by decision.
-- * The two PQS arms of `can_read_referral_metadata` / `can_read_referral_phi`, for the
--   same reason: `hospital_of_commission(NULL)` is NULL so the target-side arm is dead
--   on DT rows, while the source-side arm admits exactly the same people. Adding a
--   `coalesce(target_hospital_id, ...)` there would be a new arm that changes no
--   verdict — motion, not safety.
-- * `referral_internal_notes` and both note predicates (D8). Internal notes exist so a
--   multi-member committee can deliberate privately before answering; the DT audience
--   is one office that answers directly. Their DT disposition is "n/a", and it is
--   asserted in pgTAP so the absence is a recorded decision rather than an oversight.

-- ═══════════════════════════════════════════════════════════════════════════════
-- T4.5 — schema: the target sum type
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.case_referral
  alter column target_commission_id drop not null;

alter table public.case_referral
  add column target_type text not null default 'commission',
  add column target_hospital_id uuid references public.hospitals(id),
  add column target_hospital_name text,
  add column waiting_on_hospital_id uuid references public.hospitals(id);

comment on column public.case_referral.target_type is
  'ADR 0094 W4/D7 — which arm of the target sum type this row is: ''commission'' (target_commission_id) or ''technical_director'' (target_hospital_id). Pinned in agreement with the ids by case_referral_target_shape.';
comment on column public.case_referral.target_hospital_name is
  'ADR 0094 W4/D5 — snapshot of the target hospital''s name for DT rows, maintained by snap_referral_commission_names. Deliberately NOT the DT''s person name: that is Class-2 professional identity, and it would go stale the moment the office changes (D4).';
comment on column public.case_referral.waiting_on_hospital_id is
  'ADR 0094 W4/D9 — the DT-side counterpart of waiting_on_committee_id. Without it, "the DT is holding this" is written as waiting_on_committee_id = NULL, which is indistinguishable from "nobody is waiting".';

-- D7 — the discriminator and the shape are ONE constraint pair, so `target_type` can
-- never become a third thing that disagrees with the two ids. The `else false`
-- terminator matches the memberships_scope_shape convention (20260905000400): a value
-- admitted to the vocabulary but missing a shape arm is rejected outright.
alter table public.case_referral
  add constraint case_referral_target_type_check
  check (target_type in ('commission', 'technical_director'));

alter table public.case_referral
  add constraint case_referral_target_shape
  check (
    case target_type
      when 'commission' then
        (target_commission_id is not null and target_hospital_id is null)
      when 'technical_director' then
        (target_hospital_id is not null and target_commission_id is null)
      else false
    end
  );

-- NULL-hole #1 (see the header). Rewritten as explicit equality tests: every arm is
-- decidable because `source_commission_id` is NOT NULL and the `target_commission_id`
-- arm is guarded by an IS NOT NULL, so this CHECK can never evaluate to NULL.
alter table public.case_referral drop constraint case_referral_waiting_on_check;
alter table public.case_referral
  add constraint case_referral_waiting_on_check
  check (
    (
      waiting_on_committee_id is null
      or waiting_on_committee_id = source_commission_id
      or (target_commission_id is not null and waiting_on_committee_id = target_commission_id)
    )
    -- D9: the DT arm. Admitted only on a DT row, and only for that row's own hospital.
    and (
      waiting_on_hospital_id is null
      or (target_type = 'technical_director' and waiting_on_hospital_id = target_hospital_id)
    )
    -- Exactly one party can be waiting. Both set would be two answers to one question.
    and not (waiting_on_committee_id is not null and waiting_on_hospital_id is not null)
  );

-- D3 — NULL sender means "the Diretor Técnico of the referral's target hospital".
-- No sender_hospital_id and no sender_side: the individual is already in
-- sender_user_id, the hospital is on the referral, and the side is derivable. The
-- coherence rule (NULL admissible on DT rows ONLY) cannot be a CHECK — it has to read
-- case_referral — so it lives in the existing guard trigger below.
alter table public.referral_messages
  alter column sender_commission_id drop not null;

comment on column public.referral_messages.sender_commission_id is
  'ADR 0094 W4/D3 — NULL means the message was sent by the Diretor Técnico of the referral''s target hospital. Admissible ONLY on a target_type = ''technical_director'' referral; enforced by app.guard_referral_message.';

-- ⚠ COLUMN-LEVEL SELECT GRANTS. `authenticated` holds table-level INSERT/UPDATE on
-- case_referral (so new columns inherit those) but its SELECT is COLUMN-level — 35 of
-- 40 columns before this migration. A new column therefore reads 42501 unless it is
-- granted explicitly, and it fails at RUNTIME, not at migration time. `postgres` and
-- `service_role` hold table-level SELECT and need nothing here.
grant select (target_type, target_hospital_id, target_hospital_name, waiting_on_hospital_id)
  on public.case_referral to authenticated;

-- The DT inbox is keyed by hospital, exactly as the committee inbox is keyed by
-- commission (case_referral_target_created_keyset_idx). Partial: commission rows carry
-- no target_hospital_id and do not belong in it.
create index case_referral_target_hospital_created_keyset_idx
  on public.case_referral (target_hospital_id, created_at desc, id desc)
  where target_hospital_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- The DT audience predicate — resolved LIVE (D4)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- D1: TITULAR ≡ DEPUTY. One predicate, not two tiers. A substituto who cannot decide
-- is decorative, and the referral would stall whenever the titular is away.
-- Accountability stays per-person through received_by / decided_by / concluded_by.
--
-- D4: ROLE-BASED, LIVE AUDIENCE. The referral targets the OFFICE. Replace the DT and
-- the new holder immediately gains the referral and its PHI; the outgoing one
-- immediately loses both. `app.has_role` reads `memberships` at call time and applies
-- W2's expiry filter, so this needs no machinery of its own.
--
-- ⚠ THE FEATURE FLAG IS FOLDED IN, not left to call sites. Six call sites consume this
-- predicate; a flag check repeated six times is a flag check that will be forgotten
-- once. Folding it in means "flag off ⇒ the DT audience is empty" is true by
-- construction at every site, including sites added after this migration.
create or replace function app.is_technical_director_of_for(
  p_hospital_id uuid,
  p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.feature_enabled('technical_director')
     and app.is_active(p_user_id)
     and (
       app.has_role('hospital', p_hospital_id, 'technical_director', p_user_id)
       or app.has_role('hospital', p_hospital_id, 'technical_director_deputy', p_user_id)
     );
$function$;

comment on function app.is_technical_director_of_for(uuid, uuid) is
  'ADR 0094 W4/D1+D4 — is this user the technical direction of this hospital, right now? Titular and deputy are EQUAL (D1). Resolved live against memberships (D4), so an office handover transfers access immediately in both directions. Returns false while the technical_director flag is off: the flag is folded in here rather than repeated at the six call sites.';

revoke all on function app.is_technical_director_of_for(uuid, uuid) from public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- T4.6 — the target-audience arms
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Enumeration derived from the catalog, not from this file: 21 functions reference
-- `target_commission_id` and 14 policies reference a referral predicate. EVERY policy
-- delegates to one of the three predicates below, so the three arms carry the entire
-- RLS surface; no policy is edited by this migration. The functions split into the
-- arms written here and the explicit "commission-target-only, DT n/a" dispositions
-- recorded in supabase/tests/295.
--
-- Each arm is guarded by `target_type = 'technical_director'` FIRST. That is a cheap
-- column test that is false for every commission row, so the flag lookup and the
-- membership probe are never reached on the existing hot path.

-- ── ARM 1: the whole target-side lifecycle ────────────────────────────────────
--
-- This one predicate carries receive → accept → start_review → conclude, plus decline,
-- reply attachments, deadlines, redaction and assignment management: ten functions
-- reach it, seven of them through app.assert_referral_target_acts. D2 — full lifecycle,
-- inherited, no forked status machine. `decline` is KEPT: wrong_committee and
-- outside_jurisdiction are meaningless same-hospital, but conflict_of_interest and
-- insufficient_information are exactly why a DT must be able to refuse.
create or replace function app.can_manage_referral_target(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        (r.target_type = 'commission'
         and app.is_staff_admin_of_for(r.target_commission_id, p_uid))
        or (r.target_type = 'technical_director'
            and app.is_technical_director_of_for(r.target_hospital_id, p_uid))
      )
  );
$function$;

-- ── ARM 2: the inbox ──────────────────────────────────────────────────────────
--
-- Referrals have NO notification fan-out (`send_referral` enqueues nothing), so this
-- predicate IS how a DT discovers a referral. The `status <> 'draft'` condition mirrors
-- the target-committee arm exactly: a draft is the source's private workspace.
--
-- The two PQS arms are untouched. On a DT row `hospital_of_commission(NULL)` is NULL so
-- the target-side arm is dead — and the source-side arm admits exactly the same people,
-- because T4.7 requires source and target to share a hospital. See the header.
create or replace function app.can_read_referral_metadata(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        -- PQS reads every referral at every status (ADR 0037 D6).
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        -- The SOURCE committee authors the draft and sees it on the case card.
        or app.is_member_of_for(r.source_commission_id, p_uid)
        -- The TARGET committee only once the referral has actually been SENT.
        or (r.status <> 'draft' and app.is_member_of_for(r.target_commission_id, p_uid))
        -- ADR 0094 W4 — the target HOSPITAL's technical direction, same rule.
        or (r.status <> 'draft'
            and r.target_type = 'technical_director'
            and app.is_technical_director_of_for(r.target_hospital_id, p_uid))
      )
  );
$function$;

-- ── ARM 3 (T4.8): the PHI arm ─────────────────────────────────────────────────
--
-- Admits the DT audience to referral PHI for DT-targeted referrals. Every read still
-- travels the EXISTING audited path — get_referral_patient, get_referral_detail,
-- get_referral_attachment_path and the storage policy all consume this predicate, and
-- app._audit_access_authorized validates against it, so nothing about the Rule 12
-- single-door posture changes. There is NO change to patient_identifiers or
-- can_read_case_patient, and no disposal arm (D6).
--
-- `app.referral_target_analyst` is NOT extended: it requires `target_case_id`, and a DT
-- referral can never have one (`cases.commission_id` is NOT NULL and a DT holds no
-- commission). The DT read path is a NEW arm, not a reuse of the analyst arm.
create or replace function app.can_read_referral_phi(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or (r.status <> 'draft' and app.is_staff_admin_of_for(r.target_commission_id, p_uid))
        -- The target analyst arm was a top-level OR outside the EXISTS; folding it in
        -- keeps it identical for non-draft (a target case cannot exist for a draft
        -- anyway) while ensuring a draft never reaches the target side.
        or (r.status <> 'draft' and app.referral_target_analyst(p_referral_id, p_uid))
        -- ADR 0094 W4/T4.8 — the target hospital's technical direction.
        or (r.status <> 'draft'
            and r.target_type = 'technical_director'
            and app.is_technical_director_of_for(r.target_hospital_id, p_uid))
      )
  );
$function$;

-- ── ARM 4 (D3): message-sender coherence ──────────────────────────────────────
--
-- NULL-hole #2. The previous body tested `new.sender_commission_id not in (v_src,
-- v_tgt)`. Once `v_tgt` can be NULL that expression yields NULL for a NULL sender, the
-- IF is not taken, and the trigger returns NEW — a NULL sender would have been
-- admitted on EVERY referral, including commission-targeted ones. Rewritten as
-- explicit, total tests.
--
-- This trigger is also the backstop for the RPCs below: `post_referral_message` and
-- `request_referral_information` assign a NULL sender for the DT side, and a plpgsql
-- variable that is never assigned is ALSO NULL. Only this guard can tell the two apart.
create or replace function app.guard_referral_message()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_src   uuid;
  v_tgt   uuid;
  v_ttype text;
begin
  select source_commission_id, target_commission_id, target_type
    into v_src, v_tgt, v_ttype
  from public.case_referral where id = new.referral_id;

  if v_src is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- D3: a NULL sender IS the Diretor Técnico of the target hospital — on a DT row.
  if new.sender_commission_id is null then
    if v_ttype is distinct from 'technical_director' then
      raise exception 'o remetente da mensagem deve ser a comissão de origem ou de destino'
        using errcode = 'HC0A0';
    end if;
    return new;
  end if;

  if new.sender_commission_id = v_src then
    return new;
  end if;
  if v_tgt is not null and new.sender_commission_id = v_tgt then
    return new;
  end if;

  raise exception 'o remetente da mensagem deve ser a comissão de origem ou de destino'
    using errcode = 'HC0A0';
end;
$function$;

-- ── ARM 5 (D5): the target-name snapshot ──────────────────────────────────────
--
-- Rendered `Direção Técnica — <hospital>` by src/lib/queries/referrals.ts (Rule 9
-- confines the coalesce to one module). NOT reusing target_commission_name — a column
-- holding a hospital name is a name that lies — and NOT snapshotting the DT's person
-- name, which would copy Class-2 professional identity outside professional_profiles
-- and would go stale the moment the office changes (contra D4).
create or replace function public.snap_referral_commission_names()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
BEGIN
  SELECT name INTO NEW.source_commission_name
    FROM public.commissions WHERE id = NEW.source_commission_id;
  SELECT name INTO NEW.target_commission_name
    FROM public.commissions WHERE id = NEW.target_commission_id;
  SELECT name INTO NEW.target_hospital_name
    FROM public.hospitals WHERE id = NEW.target_hospital_id;
  RETURN NEW;
END;
$function$;

-- The trigger's UPDATE OF list is part of the arm: without target_hospital_id the
-- snapshot would be correct on INSERT and stale forever after.
drop trigger referral_snap_commission_names on public.case_referral;
create trigger referral_snap_commission_names
  before insert or update of source_commission_id, target_commission_id, target_hospital_id
  on public.case_referral
  for each row execute function public.snap_referral_commission_names();

-- ═══════════════════════════════════════════════════════════════════════════════
-- The three RAW inline target checks (they do NOT inherit arm 1)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- `get_referral_detail`, `post_referral_message` and `request_referral_information`
-- each test `app.is_staff_admin_of(<ref>.target_commission_id)` directly instead of
-- going through app.can_manage_referral_target. Found by sweeping `prosrc`; reading the
-- lifecycle would have missed all three, because the lifecycle genuinely does funnel
-- through one predicate — these are the sites that opted out of it.

-- ── get_referral_detail — compose authority + the new projections ─────────────
create or replace function public.get_referral_detail(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_can_compose_target boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());
  -- RV2 R1 fast-follow: compose authority = the EXACT R1 RPC gates (PHI-free).
  -- ADR 0094 W4: the DT of the target hospital composes on the target side.
  v_can_compose_target := (v_referral.target_type = 'commission'
                           and (app.is_staff_admin_of(v_referral.target_commission_id)
                                or app.referral_target_analyst(p_referral_id, auth.uid())))
                          or (v_referral.target_type = 'technical_director'
                              and app.is_technical_director_of_for(
                                    v_referral.target_hospital_id, auth.uid()));

  if v_can_phi and not v_is_source_coord then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    'description_md', case when v_can_phi then v_referral.description_md else null end,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
    -- RV2 R2: PHI-FREE triage/SLA metadata (visible to every metadata-tier reader).
    'priority', v_referral.priority,
    'requested_action_id', v_referral.requested_action_id,
    'requested_action_label', v_referral.requested_action_label,
    'response_due_at', v_referral.response_due_at,
    'decline_reason_code', v_referral.decline_reason_code,
    -- RV2 R3: PHI-FREE lineage pointer (QPS chain view).
    'parent_referral_id', v_referral.parent_referral_id,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    -- ADR 0094 W4/D5+D7: the target sum type. The DISPLAY string
    -- (`Direção Técnica — <hospital>`) is composed in src/lib/queries/referrals.ts —
    -- pt-BR presentation does not belong in the database.
    'target_type', v_referral.target_type,
    'target_hospital_id', v_referral.target_hospital_id,
    'target_hospital_name', v_referral.target_hospital_name,
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    -- PHI free-text decline note stays PHI-gated (distinct from decline_reason_code).
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    'waiting_on_committee_id', v_referral.waiting_on_committee_id,
    -- ADR 0094 W4/D9: the DT-side waiting party. Without it, "the DT is holding this"
    -- is indistinguishable from "nobody is waiting".
    'waiting_on_hospital_id', v_referral.waiting_on_hospital_id,
    'last_message_at', v_referral.last_message_at,
    -- RV2 R1 fast-follow: compose authority for THIS caller (PHI-free).
    'can_compose_as_source', v_is_source_coord,
    'can_compose_as_target', v_can_compose_target,
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        'frozen_storage_path', case when v_can_phi then s.frozen_storage_path else null end,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'referral_id', m.referral_id,
        'sequence_number', m.sequence_number,
        'sender_commission_id', m.sender_commission_id,
        'sender_commission_name', (select name from public.commissions where id = m.sender_commission_id),
        'sender_user_id', m.sender_user_id,
        'sender_user_name', (select full_name from public.profiles where id = m.sender_user_id),
        'message_type', m.message_type,
        -- RV2 R5: a redacted message renders [redigido] to EVERYONE (append-only,
        -- audited who/why); otherwise PHI-gated. Distinct from disposal's purge.
        'body', case when m.redacted_at is not null then '[redigido]'
                     when v_can_phi then m.body else null end,
        'redacted_at', m.redacted_at,
        'created_at', m.created_at
      ) order by m.sequence_number)
      from public.referral_messages m where m.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R3: the resolution history. Non-PHI columns project to every metadata-tier
    -- reader; summary_md is served ONLY to a PHI reader (v_can_phi).
    'resolutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'referral_id', rr.referral_id,
        'resolution_number', rr.resolution_number,
        'resolved_by_commission_id', rr.resolved_by_commission_id,
        'resolved_by_user_id', rr.resolved_by_user_id,
        'resolved_by_name', (select full_name from public.profiles where id = rr.resolved_by_user_id),
        'summary_md', case when v_can_phi then rr.summary_md else null end,
        'follow_up_required', rr.follow_up_required,
        'final_reply_id', rr.final_reply_id,
        'resolved_at', rr.resolved_at,
        'reopened_at', rr.reopened_at,
        'reopened_by', rr.reopened_by,
        'reopened_reason', rr.reopened_reason
      ) order by rr.resolution_number)
      from public.referral_resolutions rr where rr.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: WHO is responsible (PHI-free). Visible to every metadata-tier reader;
    -- an assignment row grants NO access (K-R4-1) — it is a task pointer only.
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'referral_id', a.referral_id,
        'commission_id', a.commission_id,
        'assignee_user_id', a.assignee_user_id,
        'assignee_name', (select full_name from public.profiles where id = a.assignee_user_id),
        'assignment_role', a.assignment_role,
        'status', a.status,
        'due_at', a.due_at,
        'assigned_by', a.assigned_by,
        'assigned_by_name', (select full_name from public.profiles where id = a.assigned_by),
        'assigned_at', a.assigned_at,
        'completed_at', a.completed_at,
        'cancelled_at', a.cancelled_at
      ) order by a.assigned_at)
      from public.referral_assignments a where a.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: TYPED related-case pointers (PHI-free). A pointer ONLY — it grants NO
    -- access to the linked case (K-R4-2).
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'referral_id', l.referral_id,
        'case_id', l.case_id,
        'case_number', (select case_number from public.cases where id = l.case_id),
        'commission_id', l.commission_id,
        'relationship_type', l.relationship_type,
        'created_by', l.created_by,
        'created_by_name', (select full_name from public.profiles where id = l.created_by),
        'created_at', l.created_at
      ) order by l.created_at)
      from public.referral_case_links l where l.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R5: PHI-FREE read receipts (delivery/read/ack per message + user), visible
    -- to every metadata-tier reader. Internal notes are NOT projected here — they are
    -- side-private and served only via list_referral_internal_notes (K-R5-1).
    'read_receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id', rc.message_id,
        'user_id', rc.user_id,
        'user_name', (select full_name from public.profiles where id = rc.user_id),
        'delivered_at', rc.delivered_at,
        'read_at', rc.read_at,
        'acknowledged_at', rc.acknowledged_at
      ) order by rc.message_id, rc.user_id)
      from public.referral_read_receipts rc
      join public.referral_messages m2 on m2.id = rc.message_id
      where m2.referral_id = p_referral_id
    ), '[]'::jsonb),
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', case when v_can_phi then r.result_md else null end,
        'acknowledged_only', r.acknowledged_only,
        'replied_by', r.replied_by,
        'replied_by_name', (select full_name from public.profiles where id = r.replied_by),
        'replied_at', r.replied_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'referral_id', a.referral_id, 'title', a.title,
            'storage_path', a.storage_path, 'mime_type', a.mime_type,
            'size_bytes', a.size_bytes, 'uploaded_by', a.uploaded_by,
            'uploaded_by_name', (select full_name from public.profiles where id = a.uploaded_by),
            'created_at', a.created_at
          ) order by a.created_at)
          from public.referral_reply_attachment a where a.referral_id = p_referral_id
        ), '[]'::jsonb)
      ) end
      from public.referral_reply r where r.referral_id = p_referral_id
    ),
    'sent_at', v_referral.sent_at,
    'received_at', v_referral.received_at,
    'decided_at', v_referral.decided_at,
    'concluded_at', v_referral.concluded_at,
    'withdrawn_at', v_referral.withdrawn_at,
    'created_at', v_referral.created_at,
    'updated_at', v_referral.updated_at
  ) into v_result;

  return v_result;
end;
$function$;

-- ── post_referral_message — the DT is a sender side ───────────────────────────
create or replace function public.post_referral_message(
  p_referral_id uuid,
  p_message_type text default 'general'::text,
  p_body text default null::text)
returns referral_messages
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_seq integer;
  v_result public.referral_messages;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.can_read_referral_phi(p_referral_id, v_uid) then
    raise exception 'você não pode enviar mensagens neste encaminhamento' using errcode = 'HC0A0';
  end if;

  -- Resolve the sender side (source coord | target coord/analyst | target DT). A pure
  -- QPS reader cannot resolve to a side and thus cannot post.
  --
  -- The three branches are made mutually exclusive by pinning target_type, so a future
  -- edit cannot make two of them true at once. v_sender is left NULL for the DT side —
  -- D3 — and app.guard_referral_message is what tells a deliberate NULL apart from an
  -- unassigned variable.
  if app.is_staff_admin_of(v_ref.source_commission_id) then
    v_sender := v_ref.source_commission_id;
  elsif v_ref.target_type = 'technical_director'
        and app.is_technical_director_of_for(v_ref.target_hospital_id, v_uid) then
    v_sender := null;
  elsif v_ref.target_type = 'commission'
        and (app.is_staff_admin_of(v_ref.target_commission_id)
             or app.referral_target_analyst(p_referral_id, v_uid)) then
    v_sender := v_ref.target_commission_id;
  else
    raise exception 'apenas coordenadores ou o analista do destino podem enviar mensagens'
      using errcode = 'HC0A0';
  end if;

  if p_message_type is null or p_message_type not in
       ('general', 'information_request', 'information_response', 'clarification') then
    raise exception 'tipo de mensagem inválido' using errcode = 'HC0A0';
  end if;
  -- QA M-1: the state-driving types are produced ONLY by Solicitar informação /
  -- Responder (which also flip status + waiting_on). A free-form post may not label
  -- itself with them.
  if p_message_type in ('information_request', 'information_response') then
    raise exception 'use Solicitar informação ou Responder para este tipo de mensagem'
      using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'a mensagem não pode estar vazia' using errcode = 'HC0A0';
  end if;
  if v_ref.status not in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information') then
    raise exception 'não é possível enviar mensagens neste estado do encaminhamento'
      using errcode = 'HC0A0';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_sender, v_uid, p_message_type, btrim(p_body))
  returning * into v_result;
  update public.case_referral set last_message_at = now(), updated_at = now()
  where id = p_referral_id;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Mensagem nº ' || v_seq || ' no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_result.id, 'sequence_number', v_seq,
                       'message_type', p_message_type, 'sender_commission_id', v_sender));

  return v_result;
end;
$function$;

-- ── request_referral_information — the DT may ask the source for more ─────────
--
-- D2: insufficient_information is one of the two decline reasons that genuinely apply
-- to a DT, so the DT must be able to ASK before it has to refuse.
create or replace function public.request_referral_information(p_referral_id uuid, p_body text)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if v_ref.target_type = 'technical_director' then
    if not app.is_technical_director_of_for(v_ref.target_hospital_id, v_uid) then
      raise exception 'apenas a direção técnica de destino pode solicitar informações'
        using errcode = 'HC0A0';
    end if;
    v_sender := null;  -- D3
  else
    if not (app.is_staff_admin_of(v_ref.target_commission_id)
            or app.referral_target_analyst(p_referral_id, v_uid)) then
      raise exception 'apenas a comissão de destino pode solicitar informações' using errcode = 'HC0A0';
    end if;
    v_sender := v_ref.target_commission_id;
  end if;

  if nullif(btrim(p_body), '') is null then
    raise exception 'descreva a informação solicitada' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'in_review' then
    raise exception 'só é possível solicitar informações durante a análise' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_sender, v_uid, 'information_request', btrim(p_body))
  returning id into v_msg_id;

  -- The waiting party here is the SOURCE, which is a commission on every referral —
  -- so this arm needs no D9 treatment. (Its mirror, provide_referral_information,
  -- hands the ball back to the target and does.)
  update public.case_referral
  set status = 'awaiting_information',
      waiting_on_committee_id = source_commission_id,
      waiting_on_hospital_id = null,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Solicitação de informação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_request', 'sender_commission_id', v_sender));

  return v_result;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- D9 — the two functions that hand the ball back to the TARGET
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Both write `waiting_on_committee_id = target_commission_id`, which is NULL on a DT
-- row — and the CHECK permits NULL, so "the DT is holding this" would have read as
-- "nobody is waiting". The plan named provide_referral_information; the catalog names
-- BOTH. (Six functions touch waiting_on_committee_id. These two hand the ball to the
-- TARGET and so need the sum-type arm; the other three hand it to the source or to
-- nobody and instead need the "clear the other column" arm added above.)

create or replace function public.provide_referral_information(p_referral_id uuid, p_body text)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_ref.source_commission_id) then
    raise exception 'apenas a comissão de origem pode responder à solicitação' using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'informe a resposta à solicitação' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'awaiting_information' then
    raise exception 'não há solicitação de informação pendente neste encaminhamento' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_ref.source_commission_id, v_uid, 'information_response', btrim(p_body))
  returning id into v_msg_id;

  -- D9: the ball goes back to whichever target this referral has.
  update public.case_referral
  set status = 'in_review',
      waiting_on_committee_id = case when target_type = 'commission' then target_commission_id end,
      waiting_on_hospital_id  = case when target_type = 'technical_director' then target_hospital_id end,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Resposta à solicitação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_response', 'sender_commission_id', v_ref.source_commission_id));

  return v_result;
end;
$function$;

create or replace function public.reopen_referral(p_referral_id uuid, p_reason text)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (distinct SQLSTATE, before the state check).
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode reabrir o encaminhamento'
      using errcode = '42501';
  end if;

  -- STATE second.
  if v_ref.status <> 'resolved' then
    raise exception 'o encaminhamento precisa estar resolvido para ser reaberto'
      using errcode = 'HC0A5';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'informe o motivo da reabertura' using errcode = 'check_violation';
  end if;

  -- Mark the single active resolution reopened (append-only: the row is preserved).
  update public.referral_resolutions
     set reopened_at = now(), reopened_by = auth.uid(), reopened_reason = btrim(p_reason)
   where referral_id = p_referral_id and reopened_at is null;

  perform set_config('app.in_referral_rpc', 'on', true);
  -- D9: same arm as provide_referral_information — reopening hands the ball to the
  -- target, and on a DT row that target is a hospital's technical direction.
  update public.case_referral
     set status = 'in_review',
         waiting_on_committee_id = case when target_type = 'commission' then target_commission_id end,
         waiting_on_hospital_id  = case when target_type = 'technical_director' then target_hospital_id end,
         updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return v_row;
end;
$function$;

-- ── The other two waiting-party writers ──────────────────────────────────────
--
-- "Exactly one party is waiting" turns EVERY writer of one column into a writer of
-- BOTH — a writer that sets its own column and leaves the other alone produces a row
-- with two waiting parties. Neither of these functions needed a DT *audience* arm, so
-- neither appeared in any DT-shaped enumeration; they surfaced because the CHECK
-- refused conclude_referral outright on a DT referral that was already waiting on its
-- hospital. Loud at build time, which is the whole reason the invariant is a CHECK and
-- not a convention.

create or replace function public.conclude_referral(
  p_referral_id uuid,
  p_reply_outcome_id uuid default null::uuid,
  p_result_md text default null::text,
  p_acknowledged_only boolean default false)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_outcome public.reply_outcomes;
  v_ack boolean;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['in_review']);

  -- A reply IS expected unless the referral was marked no-reply AND the caller
  -- explicitly acknowledges only.
  v_ack := coalesce(p_acknowledged_only, false) and not v_referral.response_expected;

  if v_referral.response_expected then
    if btrim(coalesce(p_result_md, '')) = '' then
      raise exception 'descreva o resultado da análise para concluir' using errcode = 'HC075';
    end if;
    if p_reply_outcome_id is null then
      raise exception 'selecione o desfecho da análise para concluir' using errcode = 'HC075';
    end if;
  end if;

  if p_reply_outcome_id is not null then
    select * into v_outcome from public.reply_outcomes where id = p_reply_outcome_id;
    if v_outcome.id is null then
      raise exception 'desfecho de resposta inválido' using errcode = 'HC074';
    end if;
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);

  insert into public.referral_reply (
    referral_id, reply_outcome_id, outcome_label, result_md, acknowledged_only,
    replied_by, replied_at
  ) values (
    p_referral_id, v_outcome.id, v_outcome.label,
    case when v_ack then null else p_result_md end, v_ack,
    auth.uid(), now()
  )
  on conflict (referral_id) do update
  set reply_outcome_id = excluded.reply_outcome_id, outcome_label = excluded.outcome_label,
      result_md = excluded.result_md, acknowledged_only = excluded.acknowledged_only,
      replied_by = excluded.replied_by, replied_at = excluded.replied_at, updated_at = now();

  -- RV2 R3: reply-expected -> 'answered' (A owes the resolution; waiting_on = source);
  -- no-reply acknowledgment -> 'completed' (terminal).
  --
  -- The source is a commission on EVERY referral, so the answer always hands the ball
  -- to a committee — but waiting_on_hospital_id must be cleared in the same statement,
  -- or a DT referral that was waiting on its hospital ends up with both parties set.
  if v_referral.response_expected then
    update public.case_referral
    set status = 'answered',
        waiting_on_committee_id = v_referral.source_commission_id,
        waiting_on_hospital_id = null,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  else
    update public.case_referral
    set status = 'completed',
        waiting_on_committee_id = null,
        waiting_on_hospital_id = null,
        concluded_at = now(), concluded_by = auth.uid(), updated_at = now()
    where id = p_referral_id
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$function$;

create or replace function public.resolve_referral(
  p_referral_id uuid,
  p_summary_md text default null::text,
  p_follow_up boolean default false)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_num integer;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (distinct SQLSTATE, before the state check).
  if not app.can_manage_referral_source(p_referral_id, auth.uid()) then
    raise exception 'apenas a coordenação da comissão de origem pode resolver o encaminhamento'
      using errcode = '42501';
  end if;

  -- STATE second.
  if v_ref.status <> 'answered' then
    raise exception 'o encaminhamento precisa estar respondido para ser resolvido'
      using errcode = 'HC0A5';
  end if;

  select coalesce(max(resolution_number), 0) + 1 into v_num
    from public.referral_resolutions where referral_id = p_referral_id;

  insert into public.referral_resolutions (
    referral_id, resolution_number, resolved_by_commission_id, resolved_by_user_id,
    summary_md, follow_up_required, final_reply_id, resolved_at
  ) values (
    p_referral_id, v_num, v_ref.source_commission_id, auth.uid(),
    nullif(btrim(coalesce(p_summary_md, '')), ''), coalesce(p_follow_up, false),
    (select referral_id from public.referral_reply where referral_id = p_referral_id),
    now()
  );

  perform set_config('app.in_referral_rpc', 'on', true);
  -- Resolution is terminal: NOBODY is waiting. Both columns, for the same reason as
  -- conclude_referral — a stale waiting_on_hospital_id would leave a closed referral
  -- reading as "the technical direction is still holding this".
  update public.case_referral
     set status = 'resolved',
         waiting_on_committee_id = null,
         waiting_on_hospital_id = null,
         updated_at = now()
   where id = p_referral_id
   returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  -- referral.status_changed is emitted by trg_audit_referral on the status change.

  return v_row;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- The two case-linking doors: explicit refusals (NULL-holes #3 and #4)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Finding 3: a DT referral can NEVER have a target case. `cases.commission_id` is NOT
-- NULL and a DT holds no commission, so there is nothing to link and nothing to assign.
-- The plan dispositioned these "n/a" — but "n/a" only holds if the code REFUSES, and
-- both of these let a DT through the authority check (they consume
-- app.can_manage_referral_target, which arm 1 just widened) and then misbehaved.
--
-- `assign_referral_reviewer` needs no edit: `p_commission_id = v_ref.target_commission_id`
-- is NULL for a DT row, so its `elsif` is not taken and it falls to the `else` that
-- raises HC0A7. It fails CLOSED already. That is asserted in pgTAP rather than assumed.

create or replace function public.link_referral_case(p_referral_id uuid, p_target_case_id uuid default null::uuid)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_case_commission uuid;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_target_acts(p_referral_id, array['received', 'accepted', 'in_review']);

  -- NULL-hole #3. Below, `v_case_commission <> v_referral.target_commission_id` yields
  -- NULL on a DT row, the IF is not taken, and ANY case in the database would have been
  -- attached. The refusal has to be explicit and it has to come FIRST.
  if v_referral.target_type = 'technical_director' then
    if p_target_case_id is not null then
      raise exception 'um encaminhamento à direção técnica não pode ser vinculado a um caso'
        using errcode = 'HC079';
    end if;
    -- Clearing is harmless (target_case_id is already NULL) and stays idempotent.
  elsif p_target_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_target_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'HC079';
    end if;
    if v_case_commission <> v_referral.target_commission_id then
      raise exception 'o caso selecionado não pertence à comissão de destino' using errcode = 'HC079';
    end if;
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  update public.case_referral
  set target_case_id = p_target_case_id, updated_at = now()
  where id = p_referral_id
  returning * into v_row;
  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$function$;

create or replace function public.link_referral_related_case(p_referral_id uuid, p_case_id uuid, p_relationship_type text)
returns referral_case_links
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref public.case_referral;
  v_is_source boolean;
  v_is_target boolean;
  v_commission uuid;
  v_row public.referral_case_links;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST — coordinator of EITHER side may link.
  v_is_source := app.can_manage_referral_source(p_referral_id, auth.uid());
  v_is_target := app.can_manage_referral_target(p_referral_id, auth.uid());
  if not (v_is_source or v_is_target) then
    raise exception 'apenas a coordenação de origem ou destino pode vincular casos relacionados'
      using errcode = '42501';
  end if;
  -- The link is attributed to the acting coordinator's side (source preferred).
  v_commission := case when v_is_source then v_ref.source_commission_id
                       else v_ref.target_commission_id end;

  -- NULL-hole #4. A link row is attributed to a COMMISSION, and the DT has none — so
  -- v_commission would be NULL against a NOT NULL column and the caller would receive a
  -- raw 23502 out of an authority check they actually passed. Refuse in pt-BR instead.
  -- (D8's shape: the DT audience is one office, not a committee with a caseload.)
  if v_commission is null then
    raise exception 'a direção técnica não vincula casos relacionados' using errcode = 'HC0A8';
  end if;

  -- DOMAIN validation (after authority).
  if p_relationship_type is null or p_relationship_type <> all (array[
       'related_case', 'follow_up_case', 'escalated_case', 'duplicate_case']) then
    raise exception 'tipo de relação inválido' using errcode = 'HC0A8';
  end if;
  if not exists (select 1 from public.cases where id = p_case_id) then
    raise exception 'caso relacionado não encontrado' using errcode = 'HC0A8';
  end if;
  if exists (select 1 from public.referral_case_links
             where referral_id = p_referral_id and case_id = p_case_id
               and relationship_type = p_relationship_type) then
    raise exception 'este caso já está vinculado com esta relação' using errcode = 'HC0A8';
  end if;

  insert into public.referral_case_links (
    referral_id, case_id, commission_id, relationship_type, created_by
  ) values (
    p_referral_id, p_case_id, v_commission, p_relationship_type, auth.uid()
  )
  returning * into v_row;

  perform app.audit_write(
    'referral_case_link.created', 'referral_case_link', v_row.id, v_commission,
    'Caso relacionado vinculado ao encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('relationship_type', p_relationship_type, 'case_id', p_case_id));

  return v_row;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- T4.7 — the submission door
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The parameter count changes, so this is a DROP + CREATE, not a replace — a
-- CREATE OR REPLACE with an extra argument creates a second OVERLOAD, and PostgREST
-- answers an ambiguous overload with PGRST203. The ACL is re-granted below because
-- DROP takes it with the function.
--
-- THE SAME-HOSPITAL RULE. A committee may only address the technical direction OF ITS
-- OWN HOSPITAL. `commissions.hospital_id` is NOT NULL so the source hospital always
-- resolves, which makes this a total rule rather than one with a NULL escape.
--
-- ⚠ `p_target_hospital_id` has NO product caller yet (W4 ships no frontend). A declared
-- parameter that nobody passes is a known blind spot on this codebase — it survives
-- tsc, lint, unit, pgTAP and E2E alike. It is covered by supabase/tests/295 driving the
-- RPC directly, and recorded in docs/backend-state.md as an un-wired surface.
drop function if exists public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid);

create function public.create_referral_draft(
  p_source_case_id uuid,
  p_target_commission_id uuid,
  p_referral_type_id uuid,
  p_subject text,
  p_response_expected boolean default null::boolean,
  p_description_md text default null::text,
  p_priority text default 'routine'::text,
  p_requested_action_id uuid default null::uuid,
  p_response_due_at timestamp with time zone default null::timestamp with time zone,
  p_parent_referral_id uuid default null::uuid,
  p_target_hospital_id uuid default null::uuid)
returns case_referral
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_source_commission uuid;
  v_source_hospital uuid;
  v_target_type text;
  v_type public.referral_types;
  v_response_expected boolean;
  v_parent public.case_referral;
  v_row public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select commission_id into v_source_commission from public.cases where id = p_source_case_id;
  if v_source_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of_for(v_source_commission, auth.uid())
          or app.is_commission_admin_of_for(v_source_commission, auth.uid())) then
    raise exception 'apenas a coordenação da comissão de origem pode encaminhar o caso'
      using errcode = 'HC071';
  end if;

  -- EXACTLY ONE target, resolved before anything else uses it (D7). Stated as a
  -- two-sided test so neither "both" nor "neither" can slip through.
  if (p_target_commission_id is not null) = (p_target_hospital_id is not null) then
    raise exception 'informe exatamente um destino: uma comissão ou a direção técnica'
      using errcode = 'check_violation';
  end if;
  v_target_type := case when p_target_hospital_id is not null
                        then 'technical_director' else 'commission' end;

  if v_target_type = 'technical_director' then
    perform app.assert_technical_director_enabled();

    -- THE SAME-HOSPITAL RULE. The DT is technically responsible for the committees of
    -- ONE hospital; a committee of another hospital has no standing to address it, and
    -- admitting one would hand that DT the PHI of a hospital they are not responsible
    -- for.
    select hospital_id into v_source_hospital from public.commissions where id = v_source_commission;
    if p_target_hospital_id is distinct from v_source_hospital then
      raise exception 'a comissão só pode encaminhar à direção técnica do seu próprio hospital'
        using errcode = 'HC071';
    end if;
  else
    if v_source_commission = p_target_commission_id then
      raise exception 'a comissão de destino deve ser diferente da origem' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.commissions where id = p_target_commission_id) then
      raise exception 'comissão de destino não encontrada' using errcode = 'no_data_found';
    end if;
    if app.org_of_commission(v_source_commission) is distinct from app.org_of_commission(p_target_commission_id) then
      raise exception 'o encaminhamento deve permanecer dentro da mesma organização'
        using errcode = 'check_violation';
    end if;
  end if;

  if btrim(coalesce(p_subject, '')) = '' then
    raise exception 'informe um assunto para o encaminhamento' using errcode = 'check_violation';
  end if;

  select * into v_type from public.referral_types where id = p_referral_type_id;
  if v_type.id is null or not v_type.is_active then
    raise exception 'tipo de encaminhamento inválido' using errcode = 'check_violation';
  end if;
  v_response_expected := coalesce(p_response_expected, v_type.default_response_expected);

  -- RV2 R2: PHI-free triage. Past-due → HC0A4; requested-action snapshot resolved.
  perform app.assert_referral_due_future(p_response_due_at);

  -- RV2 R3: parent lineage (ADR 0037 D15). Must exist, be same-organization, and be
  -- readable by the creator. The pointer is stored; NOTHING is copied from the parent.
  if p_parent_referral_id is not null then
    select * into v_parent from public.case_referral where id = p_parent_referral_id;
    if v_parent.id is null then
      raise exception 'encaminhamento de origem (lineage) não encontrado' using errcode = 'HC0A6';
    end if;
    if app.org_of_commission(v_parent.source_commission_id)
         is distinct from app.org_of_commission(v_source_commission) then
      raise exception 'o encaminhamento vinculado deve pertencer à mesma organização'
        using errcode = 'HC0A6';
    end if;
    if not app.can_read_referral_metadata(p_parent_referral_id, auth.uid()) then
      raise exception 'sem acesso ao encaminhamento vinculado' using errcode = 'HC0A6';
    end if;
  end if;

  insert into public.case_referral (
    source_case_id, source_commission_id, target_commission_id, referral_type_id,
    type_label, subject, description_md, response_expected, created_by,
    priority, requested_action_id, requested_action_label, response_due_at,
    parent_referral_id, target_type, target_hospital_id
  ) values (
    p_source_case_id, v_source_commission, p_target_commission_id, v_type.id,
    v_type.label, btrim(p_subject), nullif(btrim(coalesce(p_description_md, '')), ''),
    v_response_expected, auth.uid(),
    coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'routine'),
    p_requested_action_id, app.resolve_requested_action_label(p_requested_action_id),
    p_response_due_at,
    p_parent_referral_id, v_target_type, p_target_hospital_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

comment on function public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid) is
  'ADR 0094 W4/T4.7 — opens a referral draft against EITHER a commission (p_target_commission_id) or a hospital''s technical direction (p_target_hospital_id); exactly one is required. A DT target is restricted to the source commission''s OWN hospital.';

revoke all on function public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid) from public;
revoke all on function public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid) from anon;
grant execute on function public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid) to authenticated;
grant execute on function public.create_referral_draft(uuid,uuid,uuid,text,boolean,text,text,uuid,timestamp with time zone,uuid,uuid) to service_role;
