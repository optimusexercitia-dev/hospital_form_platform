-- =============================================================================
-- DSR Slice 3, part 1 of 2 — THE ONE NAMED WIDENING, isolated.
--
-- ⭐ ADR 0130 Decision 3: `public.search_patient_xref` gains an
-- `app.is_dpo_of(hospital)` arm. This is the ONLY authorization gate the entire
-- DSR program changes. It is in its own migration so the ADR-0079 Amendment 1
-- diff-scoped door sweep has a case list of exactly two objects.
--
-- WHY THE DPO NEEDS IT. `create_dsr_request` derives `patient_key` itself, so
-- Slice 2 needed no search. Slice 3 gives the Encarregado the INTAKE lane: they
-- must be able to see what the hospital holds on the subject BEFORE opening a
-- request, and to adjudicate against a real census rather than a guess. Without
-- the arm the Encarregado — a plain committee member by design (Decision 2's
-- power split) — gets the empty bundle and adjudicates blind.
--
-- ⛔ NOTHING ELSE ABOUT THE DOOR MOVES. Discovery stays EXACT hashed MRN /
-- encounter (no name, no substring, no browse — Q3a). It stays HOSPITAL-SCOPED
-- and SILENTLY so (Decision 4): a DPO of Hospital A passing Hospital B's id gets
-- the empty bundle, and a DPO of Hospital B searching an A-only MRN gets
-- matchCount 0 — never a hint that records exist elsewhere, because that hint IS
-- the cross-tenant inference isolation exists to prevent. The audit write on
-- ≥ 1 match is unchanged and now covers DPO searches too.
--
-- ⚠ THE GATE RETURNS AN EMPTY BUNDLE, IT DOES NOT RAISE — measured, not assumed.
-- That makes "the DPO's call does not raise" VACUOUS BY CONSTRUCTION: it passes
-- identically whether the arm is present or absent. The keystone for this change
-- is therefore a CONTENT DIFFERENTIAL (350 t4/t5/t6/t7), never an absence of
-- raise.
--
-- ---------------------------------------------------------------------------
-- ⭐ AND A LIVE DEFECT IN THE SAME DOOR'S OUTPUT, FIXED HERE.
--
-- `app.patient_trajectory_bundle` computes the `case` entry's display code as
--   select 'Caso ' || cs.case_number from public.cases cs where cs.id = m.entity_id
-- but `patient_xref.entity_id` for module='case' is a **patient_participants**
-- id, not a case id (the Slice-2 grain finding — ADR 0130 Amdt 2 / 349 t10b).
-- The subquery therefore matches nothing and the code has ALWAYS rendered as the
-- em-dash fallback. MEASURED, not inferred: calling the bundle for the seed MRN
-- returns `"module": "case", "entityCode": "—"` while the event and referral
-- entries return `EV-0001` / `ENC-0001`.
--
-- It is display-only and no pgTAP or E2E assertion pins it (swept). It is fixed
-- here rather than filed because this migration exists to put that very bundle in
-- front of the Encarregado at intake: shipping a legal-workflow census in which
-- every case row reads "Caso —" is shipping a known-broken record. `entityId`
-- keeps the documented participant grain — only the DISPLAY code is resolved —
-- because deep links already carry that grain. Pinned by 350 t8.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The bundle's case-code grain. Shared with `get_patient_trajectory_for_entity`
--    (the PQS console's deep-link read), which gains the same correction.
-- ---------------------------------------------------------------------------
create or replace function app.patient_trajectory_bundle(
  p_patient_key text,
  p_encounter_key text,
  p_hospital_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_entries jsonb;
  v_count integer;
  v_any_patient boolean;
  v_any_encounter boolean;
begin
  if p_patient_key is null and p_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  with matched as (
    select
      x.module,
      x.entity_id,
      x.commission_id,
      x.disposed_at,
      x.created_at,
      (p_patient_key is not null and x.patient_key = p_patient_key) as by_patient,
      (p_encounter_key is not null and x.encounter_key = p_encounter_key) as by_encounter
    from public.patient_xref x
    where ((p_patient_key is not null and x.patient_key = p_patient_key)
        or (p_encounter_key is not null and x.encounter_key = p_encounter_key))
      -- HOSPITAL SCOPE: only this hospital's xref rows (no cross-hospital union for a
      -- multi-hospital operator).
      and app.hospital_of_commission(x.commission_id) = p_hospital_id
  ),
  resolved as (
    select
      m.module,
      m.entity_id,
      m.commission_id,
      coalesce(c.name, null) as commission_name,
      app.patient_match_basis(m.by_patient, m.by_encounter) as matched_on,
      (m.disposed_at is not null) as disposed,
      m.disposed_at,
      m.created_at,
      case m.module
        when 'event' then (select e.code from public.patient_safety_event e where e.id = m.entity_id)
        when 'referral' then (select r.code from public.case_referral r where r.id = m.entity_id)
        -- ⚠ GRAIN. For module='case' the xref entity is a patient_participants id
        -- (app.trg_xref_maintain_patient_identifiers indexes the participant), so
        -- it must be resolved to its case before the case_number can be read.
        -- Comparing it to `cases.id` directly matched nothing and always has.
        when 'case' then (
          select 'Caso ' || cs.case_number::text
          from public.cases cs
          where cs.id = app.case_of_patient_participant(m.entity_id)
        )
      end as entity_code,
      m.by_patient,
      m.by_encounter
    from matched m
    left join public.commissions c on c.id = m.commission_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'module', module,
      'entityId', entity_id,
      'entityCode', coalesce(entity_code, '—'),
      'commissionId', commission_id,
      'commissionName', commission_name,
      'matchedOn', matched_on,
      'disposed', disposed,
      'disposedAt', disposed_at,
      'createdAt', created_at
    ) order by created_at desc), '[]'::jsonb),
    count(*),
    bool_or(by_patient),
    bool_or(by_encounter)
  into v_entries, v_count, v_any_patient, v_any_encounter
  from resolved;

  return jsonb_build_object(
    'matchedOn', app.patient_match_basis(coalesce(v_any_patient, false), coalesce(v_any_encounter, false)),
    'matchCount', coalesce(v_count, 0),
    'entries', v_entries
  );
end;
$$;

-- ⛔ SERVICE_ROLE ONLY — `authenticated` MUST NOT hold EXECUTE here, and this is
-- NOT the usual `grant to authenticated, service_role` idiom.
--
-- ⚠ THIS EXACT MISTAKE WAS MADE AND CAUGHT WHILE WRITING THIS MIGRATION. The
-- house idiom ("revoke from public, anon; grant to authenticated, service_role")
-- was applied here by reflex; suite 152 §M1 went RED and named it. The bundle is
-- the RAW, UNGATED PHI ASSEMBLER — it carries NO authorization check of its own,
-- and its three public DEFINER callers gate BEFORE invoking it. Granting it to
-- `authenticated` hands any logged-in user holding a patient_key a direct path
-- around every one of those gates. 152 §M1 exists because the 2-arg → 3-arg arity
-- change over-granted it once already; this is the second time.
--
-- ⭐ THE GENERAL LESSON, since it cost a real over-grant: `CREATE OR REPLACE
-- FUNCTION` does NOT reset an ACL — the correct action when rewriting a body is
-- to leave the existing grants ALONE, or to diff the ACL from the catalog BEFORE
-- writing the grant line. "Every new function needs an explicit grant" is a rule
-- about NEW functions; applying it to a rewrite is how a tight ACL gets widened
-- by a migration that meant to change nothing about it.
revoke all on function app.patient_trajectory_bundle(text, text, uuid)
  from public, anon, authenticated;
grant execute on function app.patient_trajectory_bundle(text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. THE WIDENING. One arm, named, and nothing else in the body changes.
-- ---------------------------------------------------------------------------
create or replace function public.search_patient_xref(
  p_mrn text default null,
  p_encounter text default null,
  p_hospital_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_patient_key text;
  v_encounter_key text;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  -- Duty separation + HOSPITAL scope. Two arms, and exactly two:
  --   · PQS operator of this hospital (member OR coordinator) — the original;
  --   · Encarregado (DPO) of this hospital — ADR 0130 Decision 3, the ONE
  --     deliberate widening of this program. The Encarregado runs the LGPD
  --     Art. 18 intake and must see the hospital's census of the subject before
  --     adjudicating; without this arm they adjudicate blind.
  -- A non-operator and non-DPO — including ANOTHER hospital's operator or DPO,
  -- and any non-PQS admin — gets the empty bundle, silently.
  if p_hospital_id is null
     or not (app.is_pqs_operator_of(p_hospital_id) or app.is_dpo_of(p_hospital_id)) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);

  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key, p_hospital_id);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  -- ⚠ The audit write is NOT arm-conditional: a DPO search is audited exactly as
  -- a PQS search is (Rule 11 — every PHI read is logged, records THAT and WHO,
  -- never the payload). Pinned by 350 t7.
  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.searched', 'patient', app.patient_key_to_uuid(v_audit_key), null,
      'Pesquisa de paciente entre comissões (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count),
      app.org_of_hospital(p_hospital_id), p_hospital_id  -- org + hospital -> hospital chain
    );
  end if;

  return v_bundle;
end;
$$;

revoke all on function public.search_patient_xref(text, text, uuid) from public, anon;
grant execute on function public.search_patient_xref(text, text, uuid) to authenticated, service_role;
