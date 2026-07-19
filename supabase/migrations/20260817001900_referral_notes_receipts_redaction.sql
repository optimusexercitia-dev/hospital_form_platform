-- =============================================================================
-- Referrals v2 (RV2) · R5 — Private internal notes, read receipts & redaction.
-- =============================================================================
-- Pre-pilot expansion of the shipped Phase-22 referral module (ADR 0037
-- Amendment 1 — the DEFERRED "private notes, disclosure controls & hardening"
-- increment; plan docs/plans/referrals-v2-dialogue-governance.md §R5). The LAST
-- backend increment. Additive / forward-only (reset-OK; no live referral data).
-- Behind the existing `case_referrals` flag. Binding rules 1/2/9/10/11/12.
--
-- 🔴 SECURITY KEYSTONE (the R5 headline — plan §R5 gate; K-R5-1). Internal notes
-- are owned by exactly ONE committee side (source OR target). A note is readable
-- ONLY by a member of its OWNING side — a source-side member NEVER reads a
-- target-owned note and vice-versa, and a QPS/PQS operator (a member of NEITHER
-- committee) reads NEITHER. Cross-side leakage is STRUCTURALLY impossible: a target
-- member fails the source branch (committee_id = source) and vice-versa; there is
-- deliberately NO QPS arm on `app.can_read_referral_internal_note` (PO: QPS does NOT
-- read internal notes — distinct from `can_read_referral_metadata`, which QPS DOES
-- pass). The note `body` is PHI-bearing free text: its SELECT is column-REVOKED
-- from authenticated (the per-column GRANT omits it, mirroring referral_messages),
-- so EVERY body read routes through the audited DEFINER door
-- `list_referral_internal_notes` (which renders `[redigido]` for a redacted note).
--
-- REDACTION (append-only, audited — DISTINCT from disposal). `redact_referral_note`
-- / `redact_referral_message` (coordinator authority) set redacted_at/by/reason and
-- render the body as `[redigido]` through the door; the real body STAYS in the
-- table (who/why is audited). This is NOT `dispose_referral_phi`, which PURGES the
-- body to `[PHI removido]`. dispose_referral_phi is extended here to also purge
-- internal-note bodies.
--
-- SQLSTATE (ADR 0037 Amendment 1 reserves the HC0A0–HC0A9 block; R5 takes A9):
--   HC0A9 = R5 domain error (blank note body, already-redacted note/message, or an
--           invalid receipt event). Authority failures raise 42501, checked FIRST
--           and with a DISTINCT SQLSTATE (ADR 0078 non-vacuity discipline): a wrong
--           actor on a domain-valid request yields 42501, never HC0A9.
--
-- ⛔ DEFERRED (explicitly OUT of scope — PO-trimmed R5, do NOT build here):
--   * `referral_context_versions` / shared-item versioning ("Compartilhar contexto
--     atualizado") — the re-disclosure of an updated snapshot.
--   * Idempotency (`p_idempotency_key` on command RPCs → a dedup table).
--   Both remain DEFERRED for a later increment.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. referral_internal_notes — a per-committee PRIVATE note (1:N child of
--    case_referral). committee_id is the OWNING side (∈ {source,target}; enforced
--    in the RPC — a CHECK cannot subquery case_referral). body is PHI-bearing free
--    text → column SELECT REVOKED from authenticated. Writes via the DEFINER RPC
--    only (no authenticated write policy). Redaction cols land now (filled by
--    redact_referral_note).
-- -----------------------------------------------------------------------------
create table public.referral_internal_notes (
  id              uuid primary key default gen_random_uuid(),
  referral_id     uuid not null references public.case_referral(id) on delete cascade,
  committee_id    uuid not null references public.commissions(id) on delete cascade,
  author_user_id  uuid references public.profiles(id),
  body            text not null,
  created_at      timestamptz not null default now(),
  redacted_at     timestamptz,
  redacted_by     uuid references public.profiles(id),
  redacted_reason text,
  constraint referral_internal_notes_body_not_blank check (btrim(body) <> '')
);
alter table public.referral_internal_notes owner to postgres;

create index referral_internal_notes_referral_idx
  on public.referral_internal_notes (referral_id, committee_id, created_at);

comment on table public.referral_internal_notes is
  'RV2 R5 (ADR 0037 Amendment 1): a PRIVATE per-committee note on a referral. '
  'committee_id is the OWNING side (∈ {source,target}, RPC-enforced). Readable ONLY '
  'by a member of the owning side — NEVER cross-side, and NEVER by QPS (the R5 '
  'security keystone K-R5-1, via app.can_read_referral_internal_note, which has NO '
  'QPS arm). body is PHI-bearing free text — column SELECT REVOKED from authenticated '
  'and served ONLY via the audited list_referral_internal_notes door (rendered '
  '[redigido] once redacted). Writes via the DEFINER RPC only. Redaction is '
  'append-only + audited; disposal (dispose_referral_phi) purges the body.';
comment on column public.referral_internal_notes.body is
  'PHI-BEARING free text (Rule 12). Column SELECT REVOKED from authenticated; loaded '
  'ONLY via list_referral_internal_notes (can_read_referral_internal_note). Redacted '
  'to [redigido] by redact_referral_note (append-only) and purged to [PHI removido] '
  'by dispose_referral_phi. NEVER copied into the audit log.';

-- Grants — PHI column-lockdown. authenticated gets per-column SELECT OMITTING body
-- (+ no DML: writes are DEFINER-RPC only). service_role full. The explicit REVOKE
-- first guarantees body is not selectable regardless of any default privilege.
revoke all on table public.referral_internal_notes from public;
revoke all on table public.referral_internal_notes from authenticated;
grant select (id, referral_id, committee_id, author_user_id, created_at,
              redacted_at, redacted_by, redacted_reason)
  on table public.referral_internal_notes to authenticated;
grant all on table public.referral_internal_notes to service_role;

-- -----------------------------------------------------------------------------
-- 2. app.can_read_referral_internal_note — THE security keystone predicate. A note
--    is readable ONLY by a member of its OWNING committee side. Cross-side is
--    structurally impossible; there is deliberately NO QPS arm (PO: QPS does NOT
--    read internal notes). The target side reads only once the referral is SENT
--    (status <> 'draft'), matching can_read_referral_metadata's target gate.
-- -----------------------------------------------------------------------------
create or replace function app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)
    returns boolean
    language sql stable security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
  select app.is_active(p_uid) and exists (
    select 1
    from public.referral_internal_notes n
    join public.case_referral r on r.id = n.referral_id
    where n.id = p_note_id and (
      (n.committee_id = r.source_commission_id
        and app.is_member_of_for(r.source_commission_id, p_uid))
      or (n.committee_id = r.target_commission_id
        and r.status <> 'draft'
        and app.is_member_of_for(r.target_commission_id, p_uid))
    )
  );
$$;
alter function app.can_read_referral_internal_note(uuid, uuid) owner to postgres;

comment on function app.can_read_referral_internal_note(uuid, uuid) is
  'RV2 R5 (ADR 0037 Amendment 1) — THE security keystone (K-R5-1). A referral '
  'internal note is readable ONLY by a member of its OWNING committee side (source '
  'members read source notes; target members read target notes once sent). Cross-side '
  'is structurally impossible (a target member fails the source branch and vice-versa) '
  'and there is NO QPS arm (PO: QPS does NOT read internal notes). Broadening this '
  '(dropping the committee_id match OR adding a QPS arm) flips the cross-side + QPS '
  'denial keystones RED.';

alter table public.referral_internal_notes enable row level security;

-- SELECT = the keystone predicate. No INSERT/UPDATE/DELETE policy: DML is revoked,
-- so the DEFINER RPCs (owner postgres) are the only writers.
create policy "referral_internal_notes_select" on public.referral_internal_notes
  for select to authenticated
  using (app.can_read_referral_internal_note(id, (select auth.uid())));

-- -----------------------------------------------------------------------------
-- 3. referral_read_receipts — per (message, user) delivery/read/ack timestamps.
--    PHI-FREE (ids + timestamps only). RLS SELECT = a metadata-tier reader of the
--    message's referral. Writes via the DEFINER RPC only (the caller records ONLY
--    their OWN receipt — user_id = auth.uid(), never forgeable; K-R5-5).
-- -----------------------------------------------------------------------------
create table public.referral_read_receipts (
  message_id      uuid not null references public.referral_messages(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  delivered_at    timestamptz,
  read_at         timestamptz,
  acknowledged_at timestamptz,
  primary key (message_id, user_id)
);
alter table public.referral_read_receipts owner to postgres;

comment on table public.referral_read_receipts is
  'RV2 R5 (ADR 0037 Amendment 1): per (message, user) delivery/read/ack timestamps. '
  'PHI-FREE. Writes via record_referral_message_receipt (DEFINER) only, which records '
  'ONLY the caller''s OWN receipt (user_id = auth.uid()) — a user can never forge '
  'another''s (K-R5-5). RLS SELECT = a metadata-tier reader of the message''s referral.';

grant select on table public.referral_read_receipts to authenticated;
grant all on table public.referral_read_receipts to service_role;

alter table public.referral_read_receipts enable row level security;

create policy "referral_read_receipts_select_metadata" on public.referral_read_receipts
  for select to authenticated
  using (app.can_read_referral_metadata(
           (select m.referral_id from public.referral_messages m where m.id = message_id),
           (select auth.uid())));
-- No authenticated INSERT/UPDATE/DELETE policy: writes only via the DEFINER RPC.

-- -----------------------------------------------------------------------------
-- 4. create_referral_internal_note — a member of the OWNING committee side authors
--    a private note. AUTHORITY FIRST (42501): p_committee_id must be one of the
--    referral's two sides AND the caller must be a member of THAT side (a QPS
--    operator of neither committee is denied). DOMAIN (after authority): the body
--    is required (HC0A9 if blank).
-- -----------------------------------------------------------------------------
create or replace function public.create_referral_internal_note(
  p_referral_id uuid,
  p_committee_id uuid,
  p_body text
) returns public.referral_internal_notes
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_row public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE). The committee must be one of the
  -- referral's two sides AND the caller a member of THAT side. A note is owned by
  -- ONE side; the other side can never read it (K-R5-1), so only an owning-side
  -- member may author it. A non-member (incl. a QPS operator of neither) → 42501.
  if p_committee_id not in (v_ref.source_commission_id, v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode registrar uma nota interna'
      using errcode = '42501';
  end if;

  -- DOMAIN validation (after authority).
  if nullif(btrim(p_body), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  insert into public.referral_internal_notes (referral_id, committee_id, author_user_id, body)
  values (p_referral_id, p_committee_id, auth.uid(), btrim(p_body))
  returning * into v_row;

  perform app.audit_write(
    'referral.note_created', 'referral', p_referral_id, p_committee_id,
    'Nota interna registrada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_row.id, 'committee_id', p_committee_id));

  return v_row;
end;
$$;
alter function public.create_referral_internal_note(uuid, uuid, text) owner to postgres;
revoke all on function public.create_referral_internal_note(uuid, uuid, text) from public;
grant execute on function public.create_referral_internal_note(uuid, uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. list_referral_internal_notes — the caller's readable notes (their side only)
--    with the PHI body served through the audited door. A redacted note renders
--    '[redigido]' (even to the owning side); the real body stays in the table.
--    Self-filters each row on can_read_referral_internal_note (DEFINER bypasses RLS,
--    so the predicate is applied explicitly — K-R5-1 holds regardless of the door).
-- -----------------------------------------------------------------------------
create or replace function public.list_referral_internal_notes(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform app.assert_referrals_enabled();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'referral_id', n.referral_id,
           'committee_id', n.committee_id,
           'author_user_id', n.author_user_id,
           'author_name', (select full_name from public.profiles where id = n.author_user_id),
           -- Redacted notes render [redigido] (the real body stays in the table,
           -- append-only + audited); distinct from disposal's [PHI removido].
           'body', case when n.redacted_at is not null then '[redigido]' else n.body end,
           'created_at', n.created_at,
           'redacted_at', n.redacted_at,
           'redacted_by', n.redacted_by,
           'redacted_by_name', (select full_name from public.profiles where id = n.redacted_by),
           'redacted_reason', n.redacted_reason
         ) order by n.created_at), '[]'::jsonb)
    into v_result
  from public.referral_internal_notes n
  where n.referral_id = p_referral_id
    and app.can_read_referral_internal_note(n.id, v_uid);

  return v_result;
end;
$$;
alter function public.list_referral_internal_notes(uuid) owner to postgres;
revoke all on function public.list_referral_internal_notes(uuid) from public;
grant execute on function public.list_referral_internal_notes(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. redact_referral_note — a coordinator of the note's OWNING side redacts it.
--    AUTHORITY FIRST (42501): note.committee = source → can_manage_referral_source,
--    else can_manage_referral_target. DOMAIN: an already-redacted note → HC0A9.
--    APPEND-ONLY: sets redacted_at/by/reason; the body is UNCHANGED.
-- -----------------------------------------------------------------------------
create or replace function public.redact_referral_note(p_note_id uuid, p_reason text)
    returns public.referral_internal_notes
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_note public.referral_internal_notes;
  v_ref public.case_referral;
  v_row public.referral_internal_notes;
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE) — a coordinator of the note's OWNING
  -- committee side.
  if v_note.committee_id = v_ref.source_commission_id then
    if not app.can_manage_referral_source(v_note.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de origem pode redigir o conteúdo desta nota'
        using errcode = '42501';
    end if;
  else
    if not app.can_manage_referral_target(v_note.referral_id, auth.uid()) then
      raise exception 'apenas a coordenação da comissão de destino pode redigir o conteúdo desta nota'
        using errcode = '42501';
    end if;
  end if;

  -- DOMAIN: append-only — a second redaction is rejected.
  if v_note.redacted_at is not null then
    raise exception 'esta nota já foi redigida' using errcode = 'HC0A9';
  end if;

  update public.referral_internal_notes
     set redacted_at = now(), redacted_by = auth.uid(), redacted_reason = p_reason
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.message_redacted', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna redigida no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id));

  return v_row;
end;
$$;
alter function public.redact_referral_note(uuid, text) owner to postgres;
revoke all on function public.redact_referral_note(uuid, text) from public;
grant execute on function public.redact_referral_note(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. redact_referral_message — a coordinator of EITHER side redacts a thread
--    message. AUTHORITY FIRST (42501): source OR target coordinator. DOMAIN: an
--    already-redacted message → HC0A9. APPEND-ONLY: sets redacted_at/by/reason on
--    referral_messages; the body is UNCHANGED (get_referral_detail renders it
--    [redigido]). The message row has no BEFORE-UPDATE guard, so no set_config dance.
-- -----------------------------------------------------------------------------
create or replace function public.redact_referral_message(p_message_id uuid, p_reason text)
    returns public.referral_messages
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_msg public.referral_messages;
  v_ref public.case_referral;
  v_row public.referral_messages;
begin
  perform app.assert_referrals_enabled();

  select * into v_msg from public.referral_messages where id = p_message_id for update;
  if v_msg.id is null then
    raise exception 'mensagem não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_msg.referral_id;

  -- AUTHORITY FIRST (42501) — a coordinator of EITHER side may redact a thread message.
  if not (app.can_manage_referral_source(v_msg.referral_id, auth.uid())
          or app.can_manage_referral_target(v_msg.referral_id, auth.uid())) then
    raise exception 'apenas a coordenação de origem ou destino pode redigir esta mensagem'
      using errcode = '42501';
  end if;

  -- DOMAIN: append-only — a second redaction is rejected.
  if v_msg.redacted_at is not null then
    raise exception 'esta mensagem já foi redigida' using errcode = 'HC0A9';
  end if;

  update public.referral_messages
     set redacted_at = now(), redacted_by = auth.uid(), redacted_reason = p_reason
   where id = p_message_id
   returning * into v_row;

  perform app.audit_write(
    'referral.message_redacted', 'referral', v_msg.referral_id, v_ref.source_commission_id,
    'Mensagem nº ' || v_msg.sequence_number || ' redigida no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg.id, 'sequence_number', v_msg.sequence_number));

  return v_row;
end;
$$;
alter function public.redact_referral_message(uuid, text) owner to postgres;
revoke all on function public.redact_referral_message(uuid, text) from public;
grant execute on function public.redact_referral_message(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. record_referral_message_receipt — the caller records THEIR OWN receipt on a
--    message. AUTHORITY (42501): a metadata-tier reader of the message's referral.
--    Self-scoped: user_id = auth.uid() always (never forgeable — K-R5-5). Upserts
--    the matching timestamp, keeping the EARLIEST for an idempotent replay.
-- -----------------------------------------------------------------------------
create or replace function public.record_referral_message_receipt(p_message_id uuid, p_event text)
    returns public.referral_read_receipts
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_msg public.referral_messages;
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_row public.referral_read_receipts;
begin
  perform app.assert_referrals_enabled();

  if p_event is null or p_event not in ('delivered', 'read', 'acknowledged') then
    raise exception 'evento de recibo inválido' using errcode = 'HC0A9';
  end if;

  select * into v_msg from public.referral_messages where id = p_message_id;
  if v_msg.id is null then
    raise exception 'mensagem não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_msg.referral_id;

  -- AUTHORITY (42501): only a metadata-tier reader of the referral may record a
  -- receipt — and only ever their OWN (user_id = auth.uid(), never forgeable).
  if not app.can_read_referral_metadata(v_msg.referral_id, v_uid) then
    raise exception 'você não pode registrar recibos neste encaminhamento' using errcode = '42501';
  end if;

  insert into public.referral_read_receipts (message_id, user_id, delivered_at, read_at, acknowledged_at)
  values (p_message_id, v_uid,
          case when p_event = 'delivered' then now() end,
          case when p_event = 'read' then now() end,
          case when p_event = 'acknowledged' then now() end)
  on conflict (message_id, user_id) do update
    set delivered_at = case when p_event = 'delivered'
                            then least(coalesce(public.referral_read_receipts.delivered_at, now()), now())
                            else public.referral_read_receipts.delivered_at end,
        read_at = case when p_event = 'read'
                       then least(coalesce(public.referral_read_receipts.read_at, now()), now())
                       else public.referral_read_receipts.read_at end,
        acknowledged_at = case when p_event = 'acknowledged'
                               then least(coalesce(public.referral_read_receipts.acknowledged_at, now()), now())
                               else public.referral_read_receipts.acknowledged_at end
  returning * into v_row;

  perform app.audit_write(
    'referral.message_viewed', 'referral', v_msg.referral_id, v_ref.source_commission_id,
    'Recibo (' || p_event || ') da mensagem nº ' || v_msg.sequence_number
      || ' no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', p_message_id, 'event', p_event));

  return v_row;
end;
$$;
alter function public.record_referral_message_receipt(uuid, text) owner to postgres;
revoke all on function public.record_referral_message_receipt(uuid, text) from public;
grant execute on function public.record_referral_message_receipt(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. get_referral_detail — AMEND: (a) render a redacted message body as '[redigido]'
--    (the real body stays; distinct from disposal) + expose per-message redacted_at;
--    (b) add the PHI-free `read_receipts` array (metadata-tier). LIVE R4 body
--    reproduced verbatim; the ONLY changes are the message body CASE + redacted_at
--    and the new read_receipts array (after `links`).
-- -----------------------------------------------------------------------------
create or replace function public.get_referral_detail(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
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
  v_can_compose_target := app.is_staff_admin_of(v_referral.target_commission_id)
                          or app.referral_target_analyst(p_referral_id, auth.uid());

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
$$;
alter function public.get_referral_detail(uuid) owner to postgres;
revoke all on function public.get_referral_detail(uuid) from public;
grant execute on function public.get_referral_detail(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. dispose_referral_phi — AMEND: also purge internal-note bodies to the
--     '[PHI removido]' marker (matching the existing convention for messages /
--     shared items / reply). LIVE R3 body reproduced verbatim; the ONLY change is
--     the one internal-notes UPDATE line (after the referral_messages purge).
-- -----------------------------------------------------------------------------
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
    returns void
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_commission_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
          or app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.referral_patient where referral_id = p_referral_id;

  update public.case_referral
     set subject = v_redacted, description_md = null, decline_note = null
   where id = p_referral_id;
  update public.referral_reply set result_md = null where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;
  -- RV2 R3: the resolution narrative is PHI — purge it.
  update public.referral_resolutions set summary_md = null where referral_id = p_referral_id;
  -- RV2 R5: internal-note bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_internal_notes set body = v_redacted where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_referral_id;

  perform app.audit_write(
    'referral_patient.disposed', 'referral_patient', p_referral_id, v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$$;
alter function public.dispose_referral_phi(uuid, text) owner to postgres;
revoke all on function public.dispose_referral_phi(uuid, text) from public;
grant execute on function public.dispose_referral_phi(uuid, text) to authenticated, service_role;
