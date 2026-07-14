-- =============================================================================
-- Referrals v2 (RV2) · R1 — Dialogue core: schema, RLS, PHI column-lockdown.
-- =============================================================================
-- Pre-pilot expansion of the shipped Phase-22 referral module (ADR 0037
-- Amendment 1; plan docs/plans/referrals-v2-dialogue-governance.md). Adds a shared
-- two-way message thread (`referral_messages`) + the `awaiting_information` waiting
-- state so the target committee (B) can ask the source (A) a clarifying question
-- and receive an answer mid-review. Additive / forward-only (reset-OK; no live
-- referral data). Behind the existing `case_referrals` flag (OFF; seed forces ON).
-- Binding rules 1/2/9/10/11/12. SQLSTATE HC0A0-HC0A9 (R1: HC0A0/HC0A1).
--
-- 🔴 PHI GATING (plan §2.1). `referral_messages.body` is PHI-bearing by
-- classification. Protection = the shipped `can_read_referral_phi` row RLS
-- (mirrors referral_reply/referral_shared_item) PLUS, per the ratified Option B, a
-- column-level lockdown: `body` SELECT is REVOKED from authenticated (the per-column
-- GRANT omits it). This forces EVERY body read — even a PHI-cleared user's — through
-- the audited DEFINER door `get_referral_detail` (extended in the R1 RPC migration),
-- closing the un-audited direct-`select` that result_md/frozen_body_md still permit.
-- Writes go ONLY through the DEFINER command RPCs (no INSERT/UPDATE/DELETE grant to
-- authenticated).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. referral_messages — the shared thread (1:N child of case_referral).
--    R5-reserved-inert cols (in_reply_to / supersedes / redaction) land now so R5
--    adds behaviour with no re-migration.
-- -----------------------------------------------------------------------------
create table if not exists public.referral_messages (
  id                     uuid primary key default gen_random_uuid(),
  referral_id            uuid not null references public.case_referral(id) on delete cascade,
  sequence_number        integer not null,
  sender_commission_id   uuid not null,
  sender_user_id         uuid references public.profiles(id),
  message_type           text not null default 'general',
  body                   text not null,
  created_at             timestamptz not null default now(),
  -- R5-reserved-inert (no behaviour in R1):
  in_reply_to_message_id uuid,
  supersedes_message_id  uuid,
  redacted_at            timestamptz,
  redacted_by            uuid,
  redacted_reason        text,
  constraint referral_messages_type_check
    check (message_type = any (array['general', 'information_request',
                                     'information_response', 'clarification'])),
  constraint referral_messages_body_not_blank
    check (btrim(body) <> ''),
  constraint referral_messages_referral_seq_key
    unique (referral_id, sequence_number)
);
alter table public.referral_messages owner to postgres;

create index referral_messages_referral_seq_idx
  on public.referral_messages using btree (referral_id, sequence_number);

comment on table public.referral_messages is
  'RV2 R1 (ADR 0037 Amendment 1): the shared inter-committee message thread. body '
  'is PHI-bearing free text — column SELECT is REVOKED from authenticated (Option B) '
  'and served ONLY via the audited get_referral_detail door (nulled for a '
  'metadata-only reader; PHI reads ride the existing referral.viewed audit). Writes '
  'only through the DEFINER command RPCs (post/request/provide). sender_commission_id '
  'is validated ∈ {source,target} by app.guard_referral_message (a column CHECK '
  'cannot see the parent).';
comment on column public.referral_messages.body is
  'PHI-BEARING free text (Rule 12). Column SELECT REVOKED from authenticated; loaded '
  'ONLY via get_referral_detail (can_read_referral_phi) and redacted by '
  'dispose_referral_phi. NEVER copied into the audit log.';

-- -----------------------------------------------------------------------------
-- 2. Grants — Option B PHI column-lockdown. authenticated gets per-column SELECT
--    OMITTING body (+ no DML: writes are DEFINER-RPC only). service_role full.
--    Explicit REVOKE first guarantees `body` is not selectable regardless of any
--    default privilege.
-- -----------------------------------------------------------------------------
revoke all on table public.referral_messages from public;
revoke all on table public.referral_messages from authenticated;
grant select (id, referral_id, sequence_number, sender_commission_id, sender_user_id,
              message_type, created_at, in_reply_to_message_id, supersedes_message_id,
              redacted_at, redacted_by, redacted_reason)
  on table public.referral_messages to authenticated;
grant all on table public.referral_messages to service_role;

-- -----------------------------------------------------------------------------
-- 3. RLS — SELECT = can_read_referral_phi (mirrors referral_reply_select_phi /
--    referral_shared_item_select_phi). No INSERT/UPDATE/DELETE policy: DML is
--    revoked, so the DEFINER RPCs (owner postgres) are the only writers.
-- -----------------------------------------------------------------------------
alter table public.referral_messages enable row level security;

create policy "referral_messages_select_phi" on public.referral_messages
  for select to authenticated
  using (app.can_read_referral_phi(referral_id, (select auth.uid())));

-- -----------------------------------------------------------------------------
-- 4. guard_referral_message — sender_commission_id ∈ {source,target} of the parent
--    (a column CHECK cannot reference the parent row). Defence-in-depth alongside
--    the RPCs (which set it correctly).
-- -----------------------------------------------------------------------------
create or replace function app.guard_referral_message() returns trigger
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_src uuid;
  v_tgt uuid;
begin
  select source_commission_id, target_commission_id into v_src, v_tgt
  from public.case_referral where id = new.referral_id;
  if v_src is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if new.sender_commission_id not in (v_src, v_tgt) then
    raise exception 'o remetente da mensagem deve ser a comissão de origem ou de destino'
      using errcode = 'HC0A0';
  end if;
  return new;
end;
$$;
alter function app.guard_referral_message() owner to postgres;

create or replace trigger guard_referral_message_trg
  before insert on public.referral_messages
  for each row execute function app.guard_referral_message();

-- -----------------------------------------------------------------------------
-- 5. case_referral — the waiting state + inbox cache; status CHECK widened with
--    awaiting_information.
-- -----------------------------------------------------------------------------
alter table public.case_referral
  add column waiting_on_committee_id uuid,
  add column last_message_at timestamptz;

alter table public.case_referral add constraint case_referral_waiting_on_check
  check (waiting_on_committee_id is null
         or waiting_on_committee_id in (source_commission_id, target_commission_id));

alter table public.case_referral drop constraint if exists case_referral_status_check;
alter table public.case_referral add constraint case_referral_status_check
  check (status = any (array['draft', 'sent', 'received', 'accepted', 'rejected',
                             'in_review', 'awaiting_information', 'completed', 'withdrawn']));

comment on column public.case_referral.waiting_on_committee_id is
  'RV2 R1: which committee the referral is waiting on while awaiting_information '
  '(= source or target). NULL otherwise. PHI-free metadata.';
comment on column public.case_referral.last_message_at is
  'RV2 R1: inbox/last-activity cache (updated by the message RPCs). PHI-free '
  'metadata — never a body preview (Decision 16).';

-- -----------------------------------------------------------------------------
-- 6. guard_referral_status — reproduce the LIVE (English-key) guard, extended for
--    the R1 waiting state: in_review ⇄ awaiting_information + awaiting_information
--    → withdrawn. (Live body pulled via pg_get_functiondef at build; the only edits
--    are the two added arcs.)
-- -----------------------------------------------------------------------------
create or replace function app.guard_referral_status() returns trigger
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_referral_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status <> 'draft' then
      raise exception 'apenas rascunhos podem ser excluídos' using errcode = 'HC070';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do encaminhamento devem passar pelas RPCs'
        using errcode = 'HC070';
    end if;

    if not (
      (old.status = 'draft'      and new.status in ('sent', 'withdrawn'))
      or (old.status = 'sent'     and new.status in ('received', 'withdrawn'))
      or (old.status = 'received' and new.status in ('accepted', 'rejected', 'withdrawn'))
      or (old.status = 'accepted' and new.status in ('in_review', 'withdrawn'))
      or (old.status = 'in_review' and new.status in ('completed', 'withdrawn', 'awaiting_information'))
      or (old.status = 'awaiting_information' and new.status in ('in_review', 'withdrawn'))
    ) then
      raise exception 'transição de estado de encaminhamento inválida: % -> %', old.status, new.status
        using errcode = 'HC070';
    end if;

    return new;
  end if;

  -- No status change. Under the flag the RPCs are the authority (any field edit
  -- allowed). Outside the flag, freeze a referral that has left draft.
  if v_in_rpc then
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception 'encaminhamentos enviados são imutáveis fora das RPCs' using errcode = 'HC070';
  end if;
  return new;
end;
$$;
alter function app.guard_referral_status() owner to postgres;
