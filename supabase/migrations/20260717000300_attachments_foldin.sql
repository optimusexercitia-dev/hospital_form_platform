-- =============================================================================
-- F2 (ADR 0063 / phase-14e Risk #1 / plan C-θ) — Centralized Attachments,
-- migration 4 of 6 [ATOMIC — do NOT split]: fold case_documents /
-- meeting_attachments / case_interview_attachments into public.attachments.
--
-- On a fresh `db reset` all these tables are EMPTY (seed runs after all migrations),
-- so this is PURE DDL — no data migration. Statement order is load-bearing:
--
--   1. Repoint the two inbound FKs OFF case_documents → attachments, PRESERVING each
--      delete-action verbatim (rca_evidence = RESTRICT; referral_shared_item = SET NULL).
--   2. Rewire the ONE reader that materializes a case_documents row
--      (add_referral_shared_item) to target public.attachments; recreated with t19.
--   3. Drop the legacy write RPCs + the three folded tables (cascade drops their
--      policies/triggers/indexes; the inbound FKs are already repointed away).
--
-- Why atomic (phase-14e Risk #1): if the drop landed in a different migration than the
-- repoint, either the RESTRICT FK blocks the drop, or (had it been SET NULL) the drop
-- would null every referral citation — silent data loss. Single migration only.
--
-- LEGACY BUCKETS (case-documents / meeting-attachments / interview-attachments) + their
-- storage.objects policies are LEFT IN PLACE at cutover (§D) — retired in a later
-- cleanup migration, keeping this risky migration minimal.
--
-- Q6: the fold-in PRESERVES each source's kind/doc_type verbatim (no flatten) — but on a
-- fresh reset there is no data to carry; the per-owner_type kind sets are enforced by
-- create_attachment (migration 3). owner_type='action_item' is a NEW capability (no
-- source table, no repoint) already legal in the core CHECK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Repoint the two inbound FKs: case_documents → attachments (same delete-action).
-- -----------------------------------------------------------------------------
alter table public.rca_evidence drop constraint rca_evidence_cited_document_id_fkey;
alter table public.rca_evidence add constraint rca_evidence_cited_document_id_fkey
  foreign key (cited_document_id) references public.attachments(id) on delete restrict;

alter table public.referral_shared_item drop constraint referral_shared_item_source_document_id_fkey;
alter table public.referral_shared_item add constraint referral_shared_item_source_document_id_fkey
  foreign key (source_document_id) references public.attachments(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 2 · Rewire add_referral_shared_item — the document arm now materializes a
--     public.attachments row (owner_type='case', owner_id=source_case_id) instead of a
--     case_documents row. Body is otherwise VERBATIM from baseline (t19 re-applied since
--     create-or-replace of a body that changed a rowtype var is safest re-granted).
--     get_referral_detail is deliberately NOT recreated: it only echoes the scalar
--     source_document_id and holds no case_documents reference, so the FK repoint is
--     transparent to it (recreating it verbatim would add transcription risk for nil gain).
-- -----------------------------------------------------------------------------
create or replace function public.add_referral_shared_item(
  p_referral_id uuid, p_kind text,
  p_source_narrative_id uuid default null, p_source_document_id uuid default null
) returns public.referral_shared_item
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_referral public.case_referral;
  v_narrative public.case_narratives;
  v_document public.attachments;                      -- was public.case_documents
  v_next_pos integer;
  v_row public.referral_shared_item;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_draft_writable(p_referral_id);

  if p_kind not in ('narrative', 'document') then
    raise exception 'tipo de item inválido' using errcode = 'HC077';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.referral_shared_item where referral_id = p_referral_id;

  perform set_config('app.in_referral_rpc', 'on', true);

  if p_kind = 'narrative' then
    if p_source_narrative_id is null then
      raise exception 'selecione a narrativa a compartilhar' using errcode = 'HC077';
    end if;
    select * into v_narrative from public.case_narratives
      where id = p_source_narrative_id and case_id = v_referral.source_case_id;
    if v_narrative.id is null then
      raise exception 'narrativa não encontrada neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position
    ) values (
      p_referral_id, 'narrative', v_narrative.id,
      coalesce(v_narrative.title, v_narrative.type_label),
      coalesce(v_narrative.body_md, ''), v_next_pos
    )
    returning * into v_row;
  else
    if p_source_document_id is null then
      raise exception 'selecione o documento a compartilhar' using errcode = 'HC077';
    end if;
    -- REWIRED: the shared document is now a case-owned attachment.
    select * into v_document from public.attachments
      where id = p_source_document_id
        and owner_type = 'case'
        and owner_id = v_referral.source_case_id
        and deleted_at is null;
    if v_document.id is null then
      raise exception 'documento não encontrado neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_document_id, frozen_title,
      frozen_storage_path, frozen_mime_type, frozen_size_bytes, position
    ) values (
      p_referral_id, 'document', v_document.id, v_document.title,
      v_document.storage_path, v_document.mime_type, v_document.size_bytes, v_next_pos
    )
    returning * into v_row;
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$$;
alter function public.add_referral_shared_item(uuid, text, uuid, uuid) owner to postgres;
revoke all on function public.add_referral_shared_item(uuid, text, uuid, uuid) from public;
grant execute on function public.add_referral_shared_item(uuid, text, uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · Drop the legacy write RPCs, then the three folded tables (cascade).
-- -----------------------------------------------------------------------------
drop function if exists public.add_meeting_attachment(uuid, text, text, text, text, bigint);
drop function if exists public.delete_meeting_attachment(uuid);
drop function if exists public.add_interview_attachment(uuid, text, text, text, text, text, bigint);
drop function if exists public.delete_interview_attachment(uuid);

drop table if exists public.case_documents cascade;
drop table if exists public.meeting_attachments cascade;
drop table if exists public.case_interview_attachments cascade;
