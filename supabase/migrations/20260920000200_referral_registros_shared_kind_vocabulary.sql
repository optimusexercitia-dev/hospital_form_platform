-- =============================================================================
-- Referral "Registros internos" — file under the CASE Registro vocabulary.
--
-- Replaces the per-commission `referral_note_types` vocabulary (ADR 0109 D2 —
-- the `case_narrative_types` mirror) with the SAME six manual kinds the case
-- timeline uses (`case_events.kind`), pinned by an identical CHECK. The type
-- becomes REQUIRED (NOT NULL, default 'note'); the "untyped" state disappears.
--
-- Forward-only, reset-OK. Pre-launch, so existing rows take the default rather
-- than being mapped from their free-text `type_label` snapshot — there is no
-- production data to preserve.
--
-- ⚠ Ordering matters: the FK column is dropped BEFORE the table it points at, and
-- the two writers change SIGNATURE (uuid → text), so they are DROP + CREATE, not
-- CREATE OR REPLACE. A DROP discards the function's ACL — every one is re-issued
-- below, matching the live grant set exactly (postgres/service_role/authenticated
-- EXECUTE; never public or anon).
-- =============================================================================

-- --- 1. the shared `kind` column --------------------------------------------
alter table public.referral_internal_notes
  add column kind text not null default 'note';

alter table public.referral_internal_notes
  add constraint referral_internal_notes_kind_check
    check (kind = any (array[
      'note', 'meeting', 'decision', 'update', 'follow_up', 'other'
    ]));

comment on column public.referral_internal_notes.kind is
  'Registro kind — the SAME six manual values as case_events.kind (the shared vocabulary mirrored by src/lib/cases/registro-kinds.ts). Required; defaults to ''note''. Replaces the note_type_id/type_label pair: there is no per-commission vocabulary any more, so no label snapshot is needed — the label is resolved in the UI (Rule 10).';

-- `referral_internal_notes` has NO table-level `authenticated` ACL: the absence of
-- a grant on `body_md` IS the K-R5-2 hardening (ADR 0109 D1). Every readable column
-- therefore needs its OWN grant, and a new column without one reads 42501.
grant select (kind) on public.referral_internal_notes to authenticated;

-- --- 2. retire the vocabulary pointer + snapshot ----------------------------
alter table public.referral_internal_notes
  drop column note_type_id,
  drop column type_label;

-- --- 3. create_referral_internal_note (p_note_type_id uuid → p_kind text) ----
-- Body is the LIVE definition with only the type-vocabulary block swapped; every
-- other guard (authority-first 42501, the `is distinct from` NULL-hole fix for a
-- technical_director referral, the blank-body HC0A9, the assignee membership
-- check, the audit_write) is carried over unchanged.
drop function public.create_referral_internal_note(uuid, uuid, text, text, uuid, uuid);

create function public.create_referral_internal_note(
  p_referral_id uuid,
  p_committee_id uuid,
  p_body_md text,
  p_title text default null,
  p_kind text default 'note',
  p_assigned_to uuid default null
) returns public.referral_internal_notes
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'note');
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (42501, distinct SQLSTATE). The committee must be one of the
  -- referral's two sides AND the caller a member of THAT side.
  if (p_committee_id is distinct from v_ref.source_commission_id
      and p_committee_id is distinct from v_ref.target_commission_id)
     or not app.is_member_of_for(p_committee_id, auth.uid()) then
    raise exception 'apenas um membro da comissão de origem ou destino pode registrar uma nota interna'
      using errcode = '42501';
  end if;

  -- DOMAIN validation (after authority).
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;

  -- Shared case-Registro vocabulary; the CHECK is the backstop, this is the
  -- pt-BR-speaking front door.
  if v_kind <> all (array['note', 'meeting', 'decision', 'update', 'follow_up', 'other']) then
    raise exception 'tipo de registro inválido' using errcode = 'HC0A9';
  end if;

  if p_assigned_to is not null
     and not app.is_member_of_for(p_committee_id, p_assigned_to) then
    raise exception 'o responsável deve ser um membro ativo desta comissão'
      using errcode = 'HC0A9';
  end if;

  insert into public.referral_internal_notes
    (referral_id, committee_id, author_user_id, body_md, title,
     kind, assigned_to, updated_by)
  values
    (p_referral_id, p_committee_id, auth.uid(), btrim(p_body_md),
     nullif(btrim(p_title), ''), v_kind, p_assigned_to, auth.uid())
  returning * into v_row;

  perform app.audit_write(
    'referral.note_created', 'referral', p_referral_id, p_committee_id,
    'Nota interna registrada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_row.id, 'committee_id', p_committee_id));

  return v_row;
end;
$function$;

revoke all on function public.create_referral_internal_note(uuid, uuid, text, text, text, uuid) from public;
revoke all on function public.create_referral_internal_note(uuid, uuid, text, text, text, uuid) from anon;
grant execute on function public.create_referral_internal_note(uuid, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.create_referral_internal_note(uuid, uuid, text, text, text, uuid) to service_role;

-- --- 4. update_referral_internal_note (p_note_type_id uuid → p_kind text) ----
drop function public.update_referral_internal_note(uuid, text, text, uuid);

create function public.update_referral_internal_note(
  p_note_id uuid,
  p_title text,
  p_body_md text,
  p_kind text default 'note'
) returns public.referral_internal_notes
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_note public.referral_internal_notes;
  v_ref  public.case_referral;
  v_row  public.referral_internal_notes;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'note');
begin
  perform app.assert_referrals_enabled();

  select * into v_note from public.referral_internal_notes where id = p_note_id for update;
  if v_note.id is null then
    raise exception 'nota interna não encontrada' using errcode = 'no_data_found';
  end if;
  select * into v_ref from public.case_referral where id = v_note.referral_id;

  -- AUTHORITY FIRST (42501).
  if not app.can_edit_referral_internal_note(p_note_id, auth.uid()) then
    raise exception 'apenas o autor, o responsável ou a coordenação desta comissão pode editar este registro'
      using errcode = '42501';
  end if;

  -- DOMAIN (after authority).
  if v_note.status <> 'open' then
    raise exception 'este registro já foi concluído e não pode ser editado'
      using errcode = 'HC0A9';
  end if;
  if v_note.redacted_at is not null then
    raise exception 'este registro foi redigido e não pode ser editado' using errcode = 'HC0A9';
  end if;
  if nullif(btrim(p_body_md), '') is null then
    raise exception 'a nota interna não pode estar vazia' using errcode = 'HC0A9';
  end if;
  if v_kind <> all (array['note', 'meeting', 'decision', 'update', 'follow_up', 'other']) then
    raise exception 'tipo de registro inválido' using errcode = 'HC0A9';
  end if;

  -- `title` remains a CLEARING field (blank/NULL stores NULL); `kind` is now
  -- required, so an omitted/blank value falls back to 'note' rather than clearing.
  update public.referral_internal_notes
     set title      = nullif(btrim(p_title), ''),
         body_md    = btrim(p_body_md),
         kind       = v_kind,
         updated_by = auth.uid()
   where id = p_note_id
   returning * into v_row;

  perform app.audit_write(
    'referral.note_updated', 'referral', v_note.referral_id, v_note.committee_id,
    'Nota interna atualizada no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('note_id', v_note.id, 'committee_id', v_note.committee_id));

  return v_row;
end;
$function$;

revoke all on function public.update_referral_internal_note(uuid, text, text, text) from public;
revoke all on function public.update_referral_internal_note(uuid, text, text, text) from anon;
grant execute on function public.update_referral_internal_note(uuid, text, text, text) to authenticated;
grant execute on function public.update_referral_internal_note(uuid, text, text, text) to service_role;

-- --- 5. list_referral_internal_notes — emit `kind` --------------------------
-- SAME signature ⇒ CREATE OR REPLACE, so the ACL is preserved by construction.
-- Rebuilt from the live definition; only the two vocabulary keys change.
create or replace function public.list_referral_internal_notes(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
  v_count  int;
  v_ref    public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'referral_id', n.referral_id,
           'committee_id', n.committee_id,
           'author_user_id', n.author_user_id,
           'author_name', (select full_name from public.profiles where id = n.author_user_id),
           'title', n.title,
           'kind', n.kind,
           -- Redacted notes render [redigido] (the real body stays in the table,
           -- append-only + audited); distinct from disposal's [PHI removido].
           'body_md', case when n.redacted_at is not null then '[redigido]' else n.body_md end,
           'assigned_to', n.assigned_to,
           'assigned_to_name', (select full_name from public.profiles where id = n.assigned_to),
           'status', n.status,
           'concluded_at', n.concluded_at,
           'concluded_by', n.concluded_by,
           'concluded_by_name', (select full_name from public.profiles where id = n.concluded_by),
           'created_at', n.created_at,
           'updated_at', n.updated_at,
           'redacted_at', n.redacted_at,
           'redacted_by', n.redacted_by,
           'redacted_by_name', (select full_name from public.profiles where id = n.redacted_by),
           'redacted_reason', n.redacted_reason
         ) order by (n.status = 'concluded'), n.created_at desc), '[]'::jsonb)
    into v_result
  from public.referral_internal_notes n
  where n.referral_id = p_referral_id
    and app.can_read_referral_internal_note(n.id, v_uid);

  -- Rule 11: a served note body is a PHI read → log THAT + WHO (never the payload).
  -- No notes served (cross-side / unauthorized reader) → nothing read → no audit.
  v_count := jsonb_array_length(v_result);
  if v_count > 0 then
    select * into v_ref from public.case_referral where id = p_referral_id;
    perform public.log_audit_access(
      'referral.note_viewed', 'referral', p_referral_id,
      v_ref.source_commission_id,
      'Leitura de ' || v_count || ' nota(s) interna(s) do encaminhamento '
        || coalesce(v_ref.code, ''),
      jsonb_build_object('referral_id', p_referral_id, 'note_count', v_count)
    );
  end if;

  return v_result;
end;
$function$;

-- --- 6. drop the per-commission vocabulary machinery ------------------------
-- Nothing else in the live catalog references it: no policy, no view, and the
-- only function bodies mentioning it were the two writers rewritten above plus
-- the reorder RPC and audit trigger dropped here (swept over pg_proc.prosrc,
-- pg_policies and pg_views before writing this migration).
drop trigger audit_referral_note_types_trg on public.referral_note_types;
drop trigger touch_referral_note_types_updated_at on public.referral_note_types;
drop function app.trg_audit_referral_note_types();
drop function public.reorder_referral_note_types(uuid, uuid[]);
drop table public.referral_note_types;
