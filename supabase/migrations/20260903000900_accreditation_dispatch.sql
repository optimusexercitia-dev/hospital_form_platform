-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration B:
-- dispatch + freshness predicates. ADR 0093 D4/D5 + Amendment 2 (A2·2/A2·3) +
-- docs/plans/phase-16-standards-crosswalk-program.md (Wave 1). Two STABLE
-- SECURITY DEFINER functions the Wave 2 RPCs/doors will call:
--
--   app.artifact_belongs_to_commission(p_kind, p_artifact, p_commission)
--     -> boolean. One arm per evidence_links.artifact_kind CHECK value (the
--     SAME 10 values as ArtifactKind in src/lib/accreditation/types.ts).
--     Precedent: app.commission_of_attachment's owner-dispatch (live body
--     read from pg_proc, not the migration file). UNLIKE that precedent
--     (which returns NULL for an unknown owner_type — form_upload is
--     deliberately inert), an unknown artifact_kind here RAISES: D4's "every
--     sibling arm" rule means a CHECK value with no matching arm is a build
--     defect, not a legitimate inert case, and pgTAP 279 proves arm parity
--     by construction so this branch should be unreachable in practice.
--
--     ⚠ FAIL-CLOSED CARE: a plain `v_owner = p_commission` comparison
--     returns SQL NULL (not false) when the artifact row does not exist —
--     and `if not (null) then` in plpgsql treats NULL as falsy, SKIPPING a
--     caller's guard clause. That is exactly the "guard reads right but
--     fails open" trap (a nonexistent artifact would silently read as
--     "belongs"). Every column-lookup arm below wraps its comparison in
--     coalesce(..., false) so a missing artifact is an explicit FALSE, never
--     a NULL that a caller's `if not ...` would skip past.
--
--   app.evidence_status_of(p_kind, p_artifact) -> 'valida'|'atencao'|'vencida'
--     per the D5 freshness matrix, corrected by Amendment 2:
--       - controlled_document mirrors documents_due_for_review
--         (20260713000200) via controlled_document_versions (NOT the
--         document's own denormalized .status — the version is the single
--         source of truth review_due_date lives on too). effective +
--         (review_due_date is null or >= current_date) = valida ·
--         in_approval = atencao · changes_requested (PO ruling, ADR 0093
--         A2·3 — a refused document is absent proof) / draft / obsolete /
--         overdue = vencida. No current version = vencida.
--       - form / form_version via form_versions.review_due_date. 'form'
--         resolves the form's CURRENTLY PUBLISHED version (at most one,
--         form_versions_one_published_idx); publish_form_version always
--         archives the prior published row first, so there is no persistent
--         "superseded-but-still-published" state to special-case. Not
--         published (draft/archived/none) = vencida; published +
--         (review_due_date is null or >= current_date) = valida; overdue =
--         vencida. No atencao tier for forms (D5).
--       - indicator: active + a measurement inside the CURRENT frequency
--         window with the LATEST status = on_target -> valida;
--         off_target/no_data (same window) -> atencao; archived, or no
--         measurement in the window at all -> vencida. ⚠ AMENDMENT 2 A2·2:
--         indicator_measurements.status is ENGLISH
--         (on_target/off_target/no_data) — D5's na_meta/fora_da_meta/
--         sem_dados are UI labels only (src/lib/indicators/types.ts
--         MEASUREMENT_STATUS_LABELS); keying off the pt-BR names would match
--         nothing and fail OPEN. The "current window" check is NEW — Phase
--         15's indicator_kpis takes the latest measurement regardless of
--         age (a dashboard-panel concern); evidence freshness is stricter by
--         design (D5's whole point is that a link is a claim, not proof).
--       - action_item: NO status CHECK — dispatches on
--         action_item_statuses.category (a fixed 7-value vocabulary;
--         key/label are free tenant text, Amendment 2 A2·2). completed ->
--         valida; in_progress/waiting_review -> atencao; draft/open/
--         blocked/cancelled -> vencida.
--       - capa_plan: completed -> valida; in_execution/in_verification ->
--         atencao; open/cancelled -> vencida (plan Wave 1 names the live
--         CHECK but does not spell out the bucket per value — this mapping
--         is this migration's own reasonable reading, flagged for the lead:
--         "closed and proven effective" is full proof, "abandoned or not yet
--         started" is none, everything else is in-flight).
--       - meeting: signed/distributed -> valida (the ata is finalized and
--         durable); held/in_signature -> atencao (happened, not yet
--         finalized); scheduled/cancelled -> vencida (same reasoning as
--         capa_plan — flagged likewise, the plan names the CHECK but not the
--         per-value bucket).
--       - charter: inherits its linked bylaws document's status
--         (commission_charters.controlled_document_id) via a recursive call
--         to the controlled_document arm; no bylaws linked yet = vencida.
--       - case / ethics_procedure: always valida (D5, explicit).
--     Invariant (D5): stale evidence never silently counts. Every arm fails
--     CLOSED on an unrecognized status VALUE (a defensive ELSE raise —
--     should be unreachable given the live CHECKs, but a future CHECK widen
--     without a matching arm here must not silently promote to valida).

create function app.artifact_belongs_to_commission(p_kind text, p_artifact uuid, p_commission uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_owner uuid;
begin
  case p_kind
    when 'form' then
      select f.commission_id into v_owner from public.forms f where f.id = p_artifact;
      return coalesce(v_owner = p_commission, false);

    when 'form_version' then
      v_owner := app.commission_of_version(p_artifact);
      return coalesce(v_owner = p_commission, false);

    when 'meeting' then
      v_owner := app.commission_of_meeting(p_artifact);
      return coalesce(v_owner = p_commission, false);

    when 'case' then
      v_owner := app.commission_of_case(p_artifact);
      return coalesce(v_owner = p_commission, false);

    when 'indicator' then
      select i.commission_id into v_owner from public.indicators i where i.id = p_artifact;
      return coalesce(v_owner = p_commission, false);

    when 'controlled_document' then
      v_owner := app.commission_of_document(p_artifact);
      return coalesce(v_owner = p_commission, false);

    when 'action_item' then
      v_owner := app.commission_of_action_item(p_artifact);
      return coalesce(v_owner = p_commission, false);

    when 'charter' then
      -- Identity: the "artifact" IS the commission (commission_charters is
      -- keyed 1:1 on commission_id — there is no separate charter id).
      return p_artifact = p_commission
        and exists (
          select 1 from public.commission_charters cc where cc.commission_id = p_artifact
        );

    when 'ethics_procedure' then
      return exists (
        select 1 from public.ethics_case_details ecd where ecd.case_id = p_artifact
      ) and coalesce(app.commission_of_case(p_artifact) = p_commission, false);

    when 'capa_plan' then
      -- PO ruling 1 (Amendment 1 A1·1): hospital match only. capa_plan has no
      -- commission column and event/RCA-sourced plans resolve to no
      -- commission, so a commission-derived match would make them
      -- unlinkable by construction. The can_read_capa half of the guard is
      -- the Wave 2 link_evidence RPC's job, not this predicate's.
      return exists (
        select 1
        from public.capa_plan cp
        where cp.id = p_artifact
          and cp.hospital_id = app.hospital_of_commission(p_commission)
      );

    else
      -- Never silent false on an unknown kind (D4) — a CHECK value with no
      -- matching arm is a build defect. Plain raise (no HC0xx mapping): this
      -- is an internal arm-parity guard, not a user-facing business error —
      -- pgTAP 279 proves every live CHECK value IS handled, so a caller only
      -- reaches this branch if the CHECK was widened without a matching arm.
      raise exception 'artifact_belongs_to_commission: unrecognized artifact_kind %', p_kind;
  end case;
end;
$$;

comment on function app.artifact_belongs_to_commission(text, uuid, uuid) is
  'Phase 16 (ADR 0093 D4). One arm per evidence_links.artifact_kind CHECK value — resolves whether an artifact belongs to a commission for evidence-linking purposes. Every column-lookup arm coalesces to FALSE (never NULL) so a missing artifact fails closed. Raises on an unrecognized kind (D4 "every sibling arm" rule; pgTAP 279 proves arm parity by construction).';

create function app.evidence_status_of(p_kind text, p_artifact uuid)
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
      elsif v_category in ('in_progress', 'waiting_review') then
        return 'atencao';
      elsif v_category in ('draft', 'open', 'blocked', 'cancelled') then
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
      elsif v_status in ('in_execution', 'in_verification') then
        return 'atencao';
      elsif v_status in ('open', 'cancelled') then
        return 'vencida';
      else
        raise exception 'evidence_status_of: unrecognized capa_plan status %', v_status;
      end if;

    when 'meeting' then
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
  'Phase 16 (ADR 0093 D5, corrected by Amendment 2). Computes valida|atencao|vencida from an artifact''s OWN current lifecycle — never stored on evidence_links. A link is a claim, not proof (D5); stale evidence never silently counts. Every arm fails CLOSED on an unrecognized status value (ELSE raise), never defaults to valida.';
