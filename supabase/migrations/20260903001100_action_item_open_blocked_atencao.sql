-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — targeted fix:
-- action_item categories `open` and `blocked` report `atencao`, not
-- `vencida` (ADR 0093 Amendment 3, A3·3). Redefines app.evidence_status_of;
-- every arm is byte-identical to the live pg_proc body (re-derived from
-- `pg_get_functiondef` on the running instance — this body has now been
-- rewritten twice; each rewrite is re-verified against the LIVE catalog, not
-- against the previous migration file, to avoid a silent drift) EXCEPT the
-- action_item arm below.
--
-- A3·3 — action_item: completed -> valida · open / in_progress /
-- waiting_review / blocked -> atencao (CHANGED — open and blocked were
-- bucketed vencida with draft/cancelled in the first pass) · draft /
-- cancelled -> vencida. The A3·1 CAPA ruling ("an open CAPA is a live
-- commitment, not an abandoned one") surfaced an inconsistency on a second
-- reading of the arms side by side: the SAME word, 'open', meant "live
-- commitment" for capa_plan and "absent proof" for action_item. The PO
-- aligned them. `blocked` moves to atencao too — considered the MOST
-- attention-worthy state of the set, since it is live AND signals an
-- impediment; leaving it in vencida would have re-created the exact
-- inconsistency A3·3 exists to close. The alternative reading (a CAPA is a
-- formal raised commitment, an action item a lightweight typed task, so the
-- asymmetry is meaningful) was considered and explicitly rejected.
--
-- FORWARD-LOOKING NOTE (ADR 0093 A3·3, binding on future edits): a future
-- lifecycle arm added to this function (a new artifact kind, or a new
-- status/category value on an existing one) must be bucketed against the
-- A3·1/A3·3 RATIONALE — "does this state represent a live, tracked
-- commitment (atencao) or an abandoned/never-started one (vencida)?" — not
-- against whichever sibling arm the author happened to copy from. That is
-- exactly the failure mode A3·3 corrected: the action_item arm was written
-- before A3·1 existed and inherited a bucketing nobody had re-checked.

create or replace function app.evidence_status_of(p_kind text, p_artifact uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_due date;
  v_freq text;
  v_cutoff date;
  v_bylaws uuid;
  v_category text;
begin
  case p_kind
    when 'controlled_document' then
      select v.status, v.review_due_date into v_status, v_due
      from public.controlled_documents d
      join public.controlled_document_versions v on v.id = d.current_version_id
      where d.id = p_artifact;

      if v_status is null then
        return 'vencida'; -- no current version -> no evidence
      elsif v_status = 'in_approval' then
        return 'atencao';
      elsif v_status in ('changes_requested', 'draft', 'obsolete') then
        return 'vencida';
      elsif v_status = 'effective' then
        if v_due is null or v_due >= current_date then
          return 'valida';
        else
          return 'vencida'; -- overdue
        end if;
      else
        raise exception 'evidence_status_of: unrecognized controlled_document status %', v_status;
      end if;

    when 'form' then
      select fv.status, fv.review_due_date into v_status, v_due
      from public.form_versions fv
      where fv.form_id = p_artifact and fv.status = 'published';

      if v_status is null then
        return 'vencida'; -- no currently-published version
      elsif v_due is null or v_due >= current_date then
        return 'valida';
      else
        return 'vencida'; -- overdue
      end if;

    when 'form_version' then
      select fv.status, fv.review_due_date into v_status, v_due
      from public.form_versions fv
      where fv.id = p_artifact;

      if v_status is null then
        return 'vencida'; -- not found
      elsif v_status <> 'published' then
        return 'vencida'; -- draft or archived (publish_form_version always
                           -- archives the prior published row first — there
                           -- is no persistent superseded-but-published state)
      elsif v_due is null or v_due >= current_date then
        return 'valida';
      else
        return 'vencida'; -- overdue
      end if;

    when 'indicator' then
      select i.status, i.frequency into v_status, v_freq
      from public.indicators i
      where i.id = p_artifact;

      if v_status is null or v_status = 'archived' then
        return 'vencida';
      elsif v_status <> 'active' then
        raise exception 'evidence_status_of: unrecognized indicator status %', v_status;
      end if;

      v_cutoff := current_date - case v_freq
        when 'mensal' then interval '1 month'
        when 'bimestral' then interval '2 months'
        when 'trimestral' then interval '3 months'
        when 'semestral' then interval '6 months'
        when 'anual' then interval '12 months'
      end;
      if v_cutoff is null then
        raise exception 'evidence_status_of: unrecognized indicator frequency %', v_freq;
      end if;

      select m.status into v_status
      from public.indicator_measurements m
      where m.indicator_id = p_artifact
        and coalesce(m.period_start, m.entered_at::date) >= v_cutoff
      order by m.period_start desc nulls last, m.period_label desc
      limit 1;

      if v_status is null then
        return 'vencida'; -- no measurement inside the current frequency window
      elsif v_status = 'on_target' then
        return 'valida';
      elsif v_status in ('off_target', 'no_data') then
        return 'atencao';
      else
        raise exception 'evidence_status_of: unrecognized measurement status %', v_status;
      end if;

    when 'action_item' then
      select ais.category into v_category
      from public.action_items ai
      join public.action_item_statuses ais on ais.id = ai.status_id
      where ai.id = p_artifact;

      if v_category is null then
        return 'vencida';
      elsif v_category = 'completed' then
        return 'valida';
      elsif v_category in ('open', 'in_progress', 'waiting_review', 'blocked') then
        -- ADR 0093 A3·3: 'open' and 'blocked' moved here (were bucketed
        -- vencida with draft/cancelled) — aligns with capa_plan's A3·1
        -- ruling ('open' = a live commitment, not absent proof). 'blocked'
        -- is arguably the MOST attention-worthy of the four: live, and
        -- flagging an impediment.
        return 'atencao';
      elsif v_category in ('draft', 'cancelled') then
        return 'vencida';
      else
        raise exception 'evidence_status_of: unrecognized action_item category %', v_category;
      end if;

    when 'capa_plan' then
      select cp.status into v_status from public.capa_plan cp where cp.id = p_artifact;

      if v_status is null then
        return 'vencida';
      elsif v_status = 'completed' then
        return 'valida';
      elsif v_status in ('in_execution', 'in_verification', 'open') then
        -- ADR 0093 A3·1: 'open' moved here (was bucketed with 'cancelled' as
        -- vencida) — an open CAPA is tracked, a live commitment, not an
        -- abandoned one.
        return 'atencao';
      elsif v_status = 'cancelled' then
        return 'vencida';
      else
        raise exception 'evidence_status_of: unrecognized capa_plan status %', v_status;
      end if;

    when 'meeting' then
      -- ADR 0093 A3·2 (confirmed, no change): signature is the evidentiary
      -- act — a held-but-unsigned ata is not valid proof, so `held` stays
      -- atencao, not valida. The more lenient reading was considered and
      -- rejected.
      select m.status into v_status from public.meetings m where m.id = p_artifact;

      if v_status is null then
        return 'vencida';
      elsif v_status in ('signed', 'distributed') then
        return 'valida';
      elsif v_status in ('held', 'in_signature') then
        return 'atencao';
      elsif v_status in ('scheduled', 'cancelled') then
        return 'vencida';
      else
        raise exception 'evidence_status_of: unrecognized meeting status %', v_status;
      end if;

    when 'charter' then
      select cc.controlled_document_id into v_bylaws
      from public.commission_charters cc
      where cc.commission_id = p_artifact;

      if v_bylaws is null then
        return 'vencida'; -- no bylaws document linked yet
      else
        return app.evidence_status_of('controlled_document', v_bylaws);
      end if;

    when 'case', 'ethics_procedure' then
      return 'valida';

    else
      raise exception 'evidence_status_of: unrecognized artifact_kind %', p_kind;
  end case;
end;
$$;

comment on function app.evidence_status_of(text, uuid) is
  'Phase 16 (ADR 0093 D5, corrected by Amendment 2, capa_plan/action_item buckets corrected by Amendment 3 A3·1/A3·3). Computes valida|atencao|vencida from an artifact''s OWN current lifecycle — never stored on evidence_links. A link is a claim, not proof (D5); stale evidence never silently counts. capa_plan open -> atencao (A3·1); action_item open/blocked -> atencao, aligned with capa_plan (A3·3); meeting held/in_signature -> atencao, signed/distributed -> valida (A3·2 — signature is the evidentiary act). A future lifecycle arm buckets against the A3·1/A3·3 rationale (live commitment vs abandoned/never-started), not against a copied sibling arm. Every arm fails CLOSED on an unrecognized status value (ELSE raise), never defaults to valida.';
