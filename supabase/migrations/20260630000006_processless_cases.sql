-- ----------------------------------------------------------------------------
-- processless_cases — Create a Case with NO process ("Sem processo")
-- ----------------------------------------------------------------------------
-- A coordinator (staff_admin of the commission, or platform admin) sometimes
-- needs to open a case for an ad-hoc issue that doesn't fit any pre-built
-- process. A process-less case is just `cases.template_id = NULL` with ZERO
-- phases at creation; ad-hoc phases are grown later via the existing
-- `add_ad_hoc_phase`. The case may carry an OPTIONAL hand-picked offered-outcome
-- set (a non-empty set means an outcome is required at conclusion — the existing
-- HC028 gate) and OPTIONAL patient identifiers (PHI) when `patient_enabled`.
--
-- The schema already supports this with no new RLS shape: `cases.template_id`
-- is nullable; `case_offered_outcomes` is a per-case set decoupled from the
-- template (no guard trigger, unlike `process_template_outcomes`); the
-- minting trigger, close gate (HC031 zero-phase pass + HC028), detail view and
-- board all already handle a null `template_id`. So this is just two new
-- SECURITY DEFINER WRITE RPCs that mirror existing approved patterns:
--   - `create_case`              — the template-less minter (mirrors the LATEST
--                                  `create_case_from_template`, dropping all
--                                  template machinery).
--   - `set_case_offered_outcomes`— a coordinator-only editor of a non-terminal
--                                  case's offered-outcome set (mirrors
--                                  `set_process_outcomes`). DELIBERATELY breaks
--                                  the template-case offered-set "freeze": only
--                                  for coordinator, only non-terminal, no DB
--                                  invariant violated (the join table has no
--                                  immutability trigger).
--
-- House style mirrors 20260620017000_case_patient.sql: public.* objects OWNER
-- postgres, this file carries its OWN self-contained grant block (the prior
-- baselines are closed). Forward-only / additive — NOTHING in already-applied
-- migrations is edited. Ships the `processless_cases` flag ON (greenfield: all
-- shipped flags are ON post-20260624130000).

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- Flag assert (mirror app.assert_case_patient_enabled) — every writer's 1st line.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_processless_cases_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('processless_cases') then
    raise exception 'a criação de casos sem processo não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_processless_cases_enabled"() OWNER TO "postgres";

-- Convenience boolean probe used by the query layer (processlessCasesEnabled()).
CREATE OR REPLACE FUNCTION "public"."processless_cases_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('processless_cases');
$$;

ALTER FUNCTION "public"."processless_cases_enabled"() OWNER TO "postgres";

-- ===========================================================================
-- create_case — the TEMPLATE-LESS case minter. Mirrors the minter mechanics of
-- the LATEST create_case_from_template (20260620020000_phase_results.sql:893),
-- dropping ALL template machinery (no phases, no narratives, no offered-result
-- freeze, no recompute_recommendations — a zero-phase case). status defaults to
-- 'nao_iniciado' (the column default). patient_enabled is taken from the arg
-- (the dialog's explicit "registra identificadores?" toggle), not snapshotted
-- from any template. Emits NO audit row on creation — the template minter emits
-- none either (there is no INSERT audit trigger on cases).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."create_case"("p_commission_id" "uuid", "p_label" "text" DEFAULT NULL::"text", "p_patient_enabled" boolean DEFAULT false, "p_outcome_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "public"."cases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  -- The commission must exist (DEFINER bypasses RLS -> validate explicitly).
  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  -- Authority: staff_admin of THIS commission OR platform admin. (The template
  -- minter omits is_admin(); creating a process-less case adds it so an admin
  -- can open one directly — consistent with the action's authorizeCommission.)
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Validate the optional offered-outcome set: every id must exist, belong to
  -- THIS commission, and be non-archived (the per-case join table has NO guard
  -- trigger, so we validate here — the HC030 same-commission idiom).
  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  -- Insert the case; the mint_case_number_trg BEFORE-INSERT trigger sets
  -- case_number (it fires fine for a null-template insert). status defaults to
  -- 'nao_iniciado'. Bounded unique_violation retry for the per-commission number
  -- race (copied verbatim from the template minter).
  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by, patient_enabled)
      values (p_commission_id, null, nullif(btrim(p_label), ''), auth.uid(), coalesce(p_patient_enabled, false))
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  -- Persist the OFFERED outcome set when non-empty (the PK dedups). The conclude
  -- gate + selector read THIS. NO phases / narratives / offered-results / recompute.
  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  return v_case;
end;
$$;

ALTER FUNCTION "public"."create_case"("p_commission_id" "uuid", "p_label" "text", "p_patient_enabled" boolean, "p_outcome_ids" "uuid"[]) OWNER TO "postgres";

-- ===========================================================================
-- set_case_offered_outcomes — coordinator-only editor of a NON-TERMINAL case's
-- offered-outcome set (mirror set_process_outcomes). DELIBERATELY breaks the
-- offered-set "freeze" that templated cases keep by design: only a coordinator,
-- only while the case is non-terminal, and no DB invariant is violated (the
-- join table has no immutability trigger). Delete-then-insert; '{}' clears the
-- set. EDGE: the currently-ASSIGNED outcome cannot be removed from the offered
-- list (HC029) — change the case outcome first.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."set_case_offered_outcomes"("p_case_id" "uuid", "p_outcome_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
  v_status text;
  v_assigned uuid;
  v_bad uuid;
begin
  perform app.assert_cases_enabled();
  perform app.assert_extras_enabled();

  select commission_id, status, outcome_id
    into v_commission, v_status, v_assigned
  from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- Same-commission + non-archived validation (the HC030 idiom).
  if cardinality(p_outcome_ids) > 0 then
    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = v_commission
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  -- EDGE: the outcome currently ASSIGNED to the case cannot be dropped from the
  -- offered list — change the case's outcome first.
  if v_assigned is not null and not (v_assigned = any(p_outcome_ids)) then
    raise exception 'o desfecho atualmente atribuído a este caso não pode ser removido da lista de desfechos disponíveis; altere o desfecho do caso antes'
      using errcode = 'HC029';
  end if;

  -- Delete-then-insert (no in_case_rpc guard — this touches the join table, not
  -- cases). '{}' clears the set.
  delete from public.case_offered_outcomes where case_id = p_case_id;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select p_case_id, oid from unnest(p_outcome_ids) as oid
  on conflict do nothing;

  -- One PHI-free mutation audit row (no-ops while audit_trail is off).
  perform app.audit_write(
    'case.offered_outcomes_set', 'case', p_case_id, v_commission,
    'Desfechos disponíveis do caso atualizados',
    jsonb_build_object('count', cardinality(p_outcome_ids))
  );
end;
$$;

ALTER FUNCTION "public"."set_case_offered_outcomes"("p_case_id" "uuid", "p_outcome_ids" "uuid"[]) OWNER TO "postgres";

-- ===========================================================================
-- Grants + REVOKE. This file carries its own (the prior baselines are closed).
-- case_offered_outcomes already has GRANT ALL TO authenticated + an RLS write
-- policy (20260620005000_cases.sql / 20260626000000_multitenancy_rls_rewrite.sql)
-- — no new table grant or policy is added here.
-- ===========================================================================

-- --- assert + probe ---------------------------------------------------------
REVOKE ALL ON FUNCTION "app"."assert_processless_cases_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_processless_cases_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_processless_cases_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."processless_cases_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."processless_cases_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processless_cases_enabled"() TO "service_role";

-- --- the DEFINER WRITE RPCs --------------------------------------------------
DO $$
DECLARE
  fn text;
  fns text[] := array[
    'public.create_case(uuid, text, boolean, uuid[])',
    'public.set_case_offered_outcomes(uuid, uuid[])'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- ===========================================================================
-- Feature flag — ships ON (greenfield: every shipped flag is ON after
-- 20260624130000_feature_flags_default_on; the column default is now true).
-- ===========================================================================
INSERT INTO "app"."feature_flags" ("key", "enabled", "description")
VALUES ('processless_cases', true, 'When true, a coordinator can create a Case with NO process ("Sem processo"): cases.template_id NULL, zero phases at creation (ad-hoc phases grown later via add_ad_hoc_phase), an OPTIONAL hand-picked offered-outcome set, and OPTIONAL patient identifiers. Gates the create-dialog "Sem processo" option + create_case + set_case_offered_outcomes.')
ON CONFLICT ("key") DO NOTHING;
