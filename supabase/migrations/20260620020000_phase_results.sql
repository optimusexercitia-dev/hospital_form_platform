-- ----------------------------------------------------------------------------
-- phase_results — Per-phase CATEGORICAL RESULT for multi-phase cases (+ override)
-- ----------------------------------------------------------------------------
-- Each case phase may emit a configurable categorical RESULT when its form is
-- submitted (e.g. Conforme / Parcial / Não-conforme; Pass/Fail is the 2-value
-- default). The result is computed from the phase's OWN submitted answers against
-- an ordered rule set authored on the template phase, reusing the platform's
-- existing condition evaluator (app.eval_condition, UNCHANGED — no drift, shared
-- vectors untouched), with a default fallback. A human (the phase assignee OR a
-- staff_admin) may OVERRIDE the computed result at the final step of the fill
-- wizard, before submit, while the phase is still 'ativa'; the conclusion trigger
-- honors the override and never recomputes over it.
--
-- SCOPE (the safe first cut): record & surface only. No auto-routing, no gating of
-- case conclusion, no unlocking of remediation phases. Humans read the signal.
--
-- House style mirrors 20260620017000_case_patient.sql / 20260620005000_cases.sql:
-- public.* objects OWNER postgres, RLS enabled, this file carries its OWN grants.
-- Forward-only / additive: the cross-cutting create_case_from_template /
-- sync_case_phase_on_submit / get_case_detail / list_cases_board /
-- add_template_phase / update_template_phase / publish_process_template /
-- trg_audit_case_phases are applied here by CREATE OR REPLACE, NOT by editing the
-- already-applied files. The `case_phase_results` flag ships OFF (the E2E suite
-- flips it ON, like audit_trail / case_access / case_referrals / case_patient).
--
-- AUDIT (Rule 11): the conclude-trigger computed result rides the existing
-- case_phase.status_changed row (result_id / result_override_id added to the
-- trg_audit_case_phases allow-list). The manual OVERRIDE write happens on an
-- 'ativa' phase with NO status change, so that status-gated trigger does NOT fire
-- for it — set_case_phase_result_override therefore emits its OWN audit row
-- explicitly (fact + chosen option id; the free-text result_override_reason is
-- NEVER copied into the payload). [APPROVED deviation from the plan's "rides the
-- same audit row" wording, for the override case only.]
--
-- SQLSTATEs (HC0xx, ADR 0018) introduced here:
--   HC057 — result override attempted on a phase not in ('ativa','concluida')
--   HC058 — override result option not found / archived / wrong commission
--   HC059 — template result ruleset references a result option not in the
--           template's commission (or archived) [publish/save validation]
--   HC060 — post-conclusion correction attempted on a TERMINAL case
--   HC017 (reused) — a ruleset slot's pinned form is not published.
--
-- Manual override has TWO entry points (by phase status), both through
-- set_case_phase_result_override (human-approved scope addition):
--   - 'ativa'     — end-of-wizard, pre-submit; authz assignee OR staff_admin; the
--                   conclude trigger honors the stashed override later.
--   - 'concluida' — post-conclusion correction; authz staff_admin/admin ONLY, and
--                   ONLY while the case is non-terminal; the RPC recomputes IN THE
--                   SAME txn (compute_case_phase_result) so the correction applies
--                   immediately. Clearing the override → recompute from the ruleset.

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- Flag assert (mirror app.assert_case_patient_enabled) + boolean probe.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_phase_results_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('case_phase_results') then
    raise exception 'o recurso de resultado por fase não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_phase_results_enabled"() OWNER TO "postgres";

-- Convenience boolean probe used by the query layer (phaseResultsEnabled()).
CREATE OR REPLACE FUNCTION "public"."case_phase_results_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_phase_results');
$$;

ALTER FUNCTION "public"."case_phase_results_enabled"() OWNER TO "postgres";

-- ===========================================================================
-- phase_results — per-commission RESULT vocabulary (mirror case_outcomes minus
-- requires_action_plan). unique(commission_id, label); constrained colour token.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "public"."phase_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "color_token" "text" DEFAULT 'muted'::"text" NOT NULL,
    "is_adverse" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "phase_results_color_token_check" CHECK (("color_token" = ANY (ARRAY['muted'::"text", 'slate'::"text", 'blue'::"text", 'amber'::"text", 'green'::"text", 'red'::"text", 'violet'::"text"]))),
    CONSTRAINT "phase_results_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."phase_results" OWNER TO "postgres";

ALTER TABLE ONLY "public"."phase_results"
    ADD CONSTRAINT "phase_results_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."phase_results"
    ADD CONSTRAINT "phase_results_commission_id_label_key" UNIQUE ("commission_id", "label");
ALTER TABLE ONLY "public"."phase_results"
    ADD CONSTRAINT "phase_results_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "phase_results_commission_idx" ON "public"."phase_results" USING "btree" ("commission_id");

-- ===========================================================================
-- case_phase_offered_results — per-case FROZEN reachable set (mirror
-- case_offered_outcomes). The computed-path guard reads THIS.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "public"."case_phase_offered_results" (
    "case_id" "uuid" NOT NULL,
    "result_id" "uuid" NOT NULL
);

ALTER TABLE "public"."case_phase_offered_results" OWNER TO "postgres";

ALTER TABLE ONLY "public"."case_phase_offered_results"
    ADD CONSTRAINT "case_phase_offered_results_pkey" PRIMARY KEY ("case_id", "result_id");
ALTER TABLE ONLY "public"."case_phase_offered_results"
    ADD CONSTRAINT "case_phase_offered_results_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."case_phase_offered_results"
    ADD CONSTRAINT "case_phase_offered_results_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."phase_results"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "case_phase_offered_results_result_idx" ON "public"."case_phase_offered_results" USING "btree" ("result_id");

-- ===========================================================================
-- process_template_phases.result_ruleset (additive, nullable) — the AUTHORED
-- ruleset. Structural CHECK mirrors recommend_when_shape: object with a `rules`
-- array + a `default_result_id` key (string or null). Deep validation (keys exist,
-- result options resolve) is done at publish time. Draft-only mutability is
-- already enforced by the existing template-edit guards (add/update_template_phase
-- raise on a non-draft template).
-- ===========================================================================
ALTER TABLE "public"."process_template_phases"
  ADD COLUMN IF NOT EXISTS "result_ruleset" "jsonb";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_template_phases_result_ruleset_shape'
  ) THEN
    ALTER TABLE "public"."process_template_phases"
      ADD CONSTRAINT "process_template_phases_result_ruleset_shape"
      CHECK ((
        ("result_ruleset" IS NULL) OR (
          ("jsonb_typeof"("result_ruleset") = 'object'::"text")
          AND ("result_ruleset" ? 'rules'::"text")
          AND ("jsonb_typeof"(("result_ruleset" -> 'rules'::"text")) = 'array'::"text")
          AND ("result_ruleset" ? 'default_result_id'::"text")
          AND ("jsonb_typeof"(("result_ruleset" -> 'default_result_id'::"text")) = ANY (ARRAY['string'::"text", 'null'::"text"]))
        )
      ));
  END IF;
END $$;

COMMENT ON COLUMN "public"."process_template_phases"."result_ruleset" IS 'Optional per-phase RESULT ruleset (phase-results feature): { "rules": [ { "when": {question_key,op,value}, "result_id": uuid }, … ], "default_result_id": uuid|null }. `when` is a PLAIN condition over THIS phase''s OWN answers (no from_phase). Deep-validated at publish (validate_template_result_ruleset); snapshotted onto case_phases.result_ruleset at case creation. Draft-only.';

-- ===========================================================================
-- case_phases result columns (additive) — the SNAPSHOTTED ruleset + the effective
-- result + the pre-submit override intent. FK -> phase_results ON DELETE SET NULL
-- (a referenced vocabulary row is archived, never deleted; this is belt-and-braces).
-- ===========================================================================
ALTER TABLE "public"."case_phases"
  ADD COLUMN IF NOT EXISTS "result_ruleset" "jsonb",
  ADD COLUMN IF NOT EXISTS "result_id" "uuid",
  ADD COLUMN IF NOT EXISTS "result_computed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "result_source" "text",
  ADD COLUMN IF NOT EXISTS "result_override_id" "uuid",
  ADD COLUMN IF NOT EXISTS "result_override_by" "uuid",
  ADD COLUMN IF NOT EXISTS "result_override_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "result_override_reason" "text";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_phases_result_source_check'
  ) THEN
    ALTER TABLE "public"."case_phases"
      ADD CONSTRAINT "case_phases_result_source_check"
      CHECK (("result_source" IS NULL OR "result_source" = ANY (ARRAY['computed'::"text", 'manual'::"text"])));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_phases_result_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."case_phases"
      ADD CONSTRAINT "case_phases_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."phase_results"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_phases_result_override_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."case_phases"
      ADD CONSTRAINT "case_phases_result_override_id_fkey" FOREIGN KEY ("result_override_id") REFERENCES "public"."phase_results"("id") ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN "public"."case_phases"."result_ruleset" IS 'SNAPSHOT of the template phase''s result_ruleset at case creation (phase-results feature), exactly as recommend_when is snapshotted. compute_case_phase_result reads THIS so concluded phases stay stable against later template edits.';
COMMENT ON COLUMN "public"."case_phases"."result_id" IS 'The EFFECTIVE per-phase result option (phase-results feature). Written in the SAME statement that flips the phase to concluida (computed or honored-override); null = not concluded / no ruleset and no override / flag off. Never rewritten afterward.';
COMMENT ON COLUMN "public"."case_phases"."result_source" IS 'computed | manual — whether the effective result_id came from the ruleset walk or a human override. NULL until a result is written.';
COMMENT ON COLUMN "public"."case_phases"."result_override_reason" IS 'Optional human justification for a result override. NOT copied into the audit log (Rule 11) — the override audit row records only the fact + chosen option id.';

-- ===========================================================================
-- RLS — members read, staff_admin write (mirror case_outcomes / case_offered_outcomes).
-- ===========================================================================
ALTER TABLE "public"."phase_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."case_phase_offered_results" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phase_results_select" ON "public"."phase_results";
CREATE POLICY "phase_results_select" ON "public"."phase_results"
  FOR SELECT TO "authenticated"
  USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

DROP POLICY IF EXISTS "phase_results_staff_admin_write" ON "public"."phase_results";
CREATE POLICY "phase_results_staff_admin_write" ON "public"."phase_results"
  TO "authenticated"
  USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()))
  WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

DROP POLICY IF EXISTS "case_phase_offered_results_select" ON "public"."case_phase_offered_results";
CREATE POLICY "case_phase_offered_results_select" ON "public"."case_phase_offered_results"
  FOR SELECT TO "authenticated"
  USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

DROP POLICY IF EXISTS "case_phase_offered_results_staff_admin_write" ON "public"."case_phase_offered_results";
CREATE POLICY "case_phase_offered_results_staff_admin_write" ON "public"."case_phase_offered_results"
  TO "authenticated"
  USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()))
  WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

-- ===========================================================================
-- Vocabulary CRUD (staff_admin settings — the `resultados de fase` manager).
-- Mirror create/update/reorder/archive_case_outcome; flag- + is_staff_admin_of-gated.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text" DEFAULT 'muted'::"text", "p_is_adverse" boolean DEFAULT false) RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do resultado' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.phase_results where commission_id = p_commission_id;

  insert into public.phase_results
    (commission_id, label, color_token, is_adverse, position)
  values
    (p_commission_id, btrim(p_label), p_color_token, coalesce(p_is_adverse, false), v_position)
  returning * into v_result;

  perform app.audit_write('phase_result.created', 'phase_result', v_result.id,
    p_commission_id, 'Resultado de fase criado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();

  select commission_id into v_commission_id
  from public.phase_results where id = p_result_id;
  if v_commission_id is null then
    raise exception 'resultado não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do resultado' using errcode = 'check_violation';
  end if;

  update public.phase_results
  set label = btrim(p_label), color_token = p_color_token,
      is_adverse = coalesce(p_is_adverse, false), updated_at = now()
  where id = p_result_id returning * into v_result;

  perform app.audit_write('phase_result.updated', 'phase_result', v_result.id,
    v_commission_id, 'Resultado de fase atualizado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_phase_results_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.phase_results d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") RETURNS "public"."phase_results"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.phase_results;
begin
  perform app.assert_phase_results_enabled();

  select commission_id into v_commission_id
  from public.phase_results where id = p_result_id;
  if v_commission_id is null then
    raise exception 'resultado não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.phase_results set archived = true, updated_at = now()
  where id = p_result_id returning * into v_result;

  perform app.audit_write('phase_result.archived', 'phase_result', v_result.id,
    v_commission_id, 'Resultado de fase arquivado: ' || v_result.label, '{}'::jsonb);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- validate_template_result_ruleset — mirror validate_template_recommend_when, but
-- resolve THIS slot's pinned published version and assert each rule's when.qkey
-- exists there; assert every result_id / default_result_id resolves to a
-- non-archived phase_results row in the template's commission. The authoritative
-- gate is publish_process_template (below).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."validate_template_result_ruleset"("p_template_id" "uuid", "p_position" integer, "p_result_ruleset" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_form_id uuid;
  v_version uuid;
  r_rule jsonb;
  v_qkey text;
  v_result_id uuid;
  v_default_id uuid;
begin
  if p_result_ruleset is null then
    return true;
  end if;

  -- Resolve this slot's commission + pinned published version.
  select t.commission_id, ph.form_id
    into v_commission_id, v_form_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.template_id = p_template_id and ph.position = p_position;

  if v_form_id is null then
    raise exception 'fase % não encontrada no processo', p_position
      using errcode = 'no_data_found';
  end if;

  v_version := app.published_version_of_form(v_form_id);
  if v_version is null then
    raise exception 'o formulário da fase % ainda não foi publicado', p_position
      using errcode = 'HC017';
  end if;

  -- Each rule: when.question_key must exist as an input item in the pinned
  -- version; result_id must be a non-archived option in the commission.
  for r_rule in select * from jsonb_array_elements(p_result_ruleset -> 'rules')
  loop
    v_qkey := r_rule -> 'when' ->> 'question_key';
    if v_qkey is null or not app.version_has_input_key(v_version, v_qkey) then
      raise exception
        'o resultado da fase % referencia a pergunta "%", que não existe no formulário publicado',
        p_position, coalesce(v_qkey, 'nula')
        using errcode = 'HC016';
    end if;

    v_result_id := (r_rule ->> 'result_id')::uuid;
    if v_result_id is null or not exists (
      select 1 from public.phase_results
      where id = v_result_id and commission_id = v_commission_id and archived = false
    ) then
      raise exception
        'o resultado da fase % referencia uma opção de resultado inválida ou arquivada',
        p_position
        using errcode = 'HC059';
    end if;
  end loop;

  -- default_result_id (when present) must also resolve in-commission, non-archived.
  v_default_id := (p_result_ruleset ->> 'default_result_id')::uuid;
  if v_default_id is not null and not exists (
    select 1 from public.phase_results
    where id = v_default_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception
      'o resultado padrão da fase % é uma opção inválida ou arquivada', p_position
      using errcode = 'HC059';
  end if;

  return true;
end;
$$;

ALTER FUNCTION "app"."validate_template_result_ruleset"("p_template_id" "uuid", "p_position" integer, "p_result_ruleset" "jsonb") OWNER TO "postgres";

-- ===========================================================================
-- compute_case_phase_result — the conclude-time evaluator. SECURITY DEFINER.
-- Override-then-computed; reuses app.eval_condition UNCHANGED. Writes under
-- app.in_case_rpc='on' so it rides the existing guard_case_phase_status flag path.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."compute_case_phase_result"("p_case_phase_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_ruleset jsonb;
  v_override_id uuid;
  v_answers jsonb;
  r_rule jsonb;
  v_chosen uuid;
begin
  -- No-op when the feature is off (keeps the conclude hook safe with the flag down).
  if not app.feature_enabled('case_phase_results') then
    return;
  end if;

  select case_id, result_ruleset, result_override_id
    into v_case_id, v_ruleset, v_override_id
  from public.case_phases where id = p_case_phase_id;

  if v_case_id is null then
    return;
  end if;

  -- Override path: honor a stashed override verbatim (validated at set-time
  -- against live vocabulary, so the offered-set guard is skipped here).
  if v_override_id is not null then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.case_phases
    set result_id = v_override_id,
        result_source = 'manual',
        result_computed_at = now(),
        updated_at = now()
    where id = p_case_phase_id;
    perform set_config('app.in_case_rpc', 'off', true);
    return;
  end if;

  -- Computed path. No override AND no ruleset: clear the effective result. This is
  -- a no-op on first conclude (result_id already null) but is what makes a
  -- post-conclusion override CLEAR on a no-ruleset phase null the result instead of
  -- leaving the stale manual value.
  if v_ruleset is null then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.case_phases
    set result_id = null, result_source = null, result_computed_at = null,
        updated_at = now()
    where id = p_case_phase_id
      and (result_id is not null or result_source is not null);
    perform set_config('app.in_case_rpc', 'off', true);
    return;
  end if;

  v_answers := app.case_phase_answer_map(p_case_phase_id);

  -- Walk rules in order; first true wins (eval_condition UNCHANGED — `when` is a
  -- plain condition, no qualifier to strip).
  v_chosen := null;
  for r_rule in select * from jsonb_array_elements(v_ruleset -> 'rules')
  loop
    if app.eval_condition(r_rule -> 'when', v_answers) then
      v_chosen := (r_rule ->> 'result_id')::uuid;
      exit;
    end if;
  end loop;

  -- Fall back to the default when no rule matched.
  if v_chosen is null then
    v_chosen := (v_ruleset ->> 'default_result_id')::uuid;
  end if;

  -- Guard the computed choice against the case's FROZEN offered set; else leave null.
  if v_chosen is not null and not exists (
    select 1 from public.case_phase_offered_results
    where case_id = v_case_id and result_id = v_chosen
  ) then
    v_chosen := null;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  if v_chosen is null then
    -- No rule matched and no (valid/offered) default: clear the effective result.
    -- A no-op on first conclude; clears a stale value on recompute-after-clear.
    update public.case_phases
    set result_id = null, result_source = null, result_computed_at = null,
        updated_at = now()
    where id = p_case_phase_id
      and (result_id is not null or result_source is not null);
  else
    update public.case_phases
    set result_id = v_chosen,
        result_source = 'computed',
        result_computed_at = now(),
        updated_at = now()
    where id = p_case_phase_id;
  end if;
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "app"."compute_case_phase_result"("p_case_phase_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- set_case_phase_result_override — the override write, TWO entry points by phase
-- status. SECURITY DEFINER; sets app.in_case_rpc='on' (consistent with the
-- existing case RPCs — reassign_phase / activate_phase: the GUC is transaction-
-- local and scoped to this statement, and guard_case_phase_status only honors it
-- for the duration of this RPC; result_* are non-status fields so the guard's
-- :323 branch passes for both 'ativa' and 'concluida'). Emits its OWN audit row
-- (fact + option id; NO reason — Rule 11), because the status-gated
-- trg_audit_case_phases does not fire for this non-status write.
--
--   - 'ativa'     — end-of-wizard, pre-submit. authz assignee OR staff_admin/admin.
--                   The conclude trigger honors the stashed override later.
--   - 'concluida' — post-conclusion correction. authz staff_admin/admin ONLY, and
--                   ONLY while the case is non-terminal. Recomputes IN THE SAME txn
--                   so the corrected result_id/result_source apply immediately
--                   (clearing the override → recompute from the snapshotted ruleset).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_phase_status text;
  v_case_status text;
  v_assigned_to uuid;
  v_position integer;
  v_is_staff_admin boolean;
begin
  perform app.assert_phase_results_enabled();

  select cp.case_id, cp.status, cp.assigned_to, cp.position, c.commission_id, c.status
    into v_case_id, v_phase_status, v_assigned_to, v_position, v_commission_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_admin();

  -- Precondition: override is only meaningful while filling ('ativa') or as a
  -- post-conclusion correction ('concluida'). Reject pendente / nao_necessaria.
  if v_phase_status not in ('ativa', 'concluida') then
    raise exception 'o resultado só pode ser ajustado em uma fase ativa ou concluída'
      using errcode = 'HC057';
  end if;

  if v_phase_status = 'ativa' then
    -- End-of-wizard, pre-submit: the assignee OR a staff_admin.
    if not (v_assigned_to = auth.uid() or v_is_staff_admin) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    -- Post-conclusion correction: staff_admin/admin ONLY, non-terminal case ONLY.
    if not v_is_staff_admin then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    if v_case_status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC060';
    end if;
  end if;

  -- Validation: a non-null override must resolve to a NON-ARCHIVED phase_results
  -- row in the case's commission (any valid label — NOT constrained to the offered
  -- set). null clears the override.
  if p_result_id is not null and not exists (
    select 1 from public.phase_results
    where id = p_result_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception 'opção de resultado inválida para esta comissão'
      using errcode = 'HC058';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set result_override_id = p_result_id,
      result_override_by = case when p_result_id is null then null else auth.uid() end,
      result_override_at = case when p_result_id is null then null else now() end,
      result_override_reason = case when p_result_id is null then null else nullif(btrim(p_reason), '') end,
      updated_at = now()
  where id = p_case_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  -- AUDIT (Rule 11): the fact + the chosen option id only — NEVER the free-text
  -- reason. result_override_id is the non-PHI label ref.
  perform app.audit_write(
    'case_phase.result_override_set', 'case_phase', p_case_phase_id, v_commission_id,
    'Resultado da fase ' || v_position || ' ajustado manualmente',
    jsonb_build_object('result_override_id', p_result_id));

  -- Post-conclusion correction: recompute NOW so the corrected result applies
  -- immediately (clearing the override → recompute from the ruleset). For an
  -- 'ativa' phase we do NOT recompute here — the conclude trigger does it at submit.
  if v_phase_status = 'concluida' then
    perform app.compute_case_phase_result(p_case_phase_id);
  end if;
end;
$$;

ALTER FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") OWNER TO "postgres";

-- ===========================================================================
-- CROSS-CUTTING REPLACES (additive; supersede the cases.sql / audit.sql defs).
-- ===========================================================================

-- add_template_phase — additive p_result_ruleset param + publish-grade validation.
-- DROP the prior 6-arg signature first: adding a param changes the arg-count, so a
-- bare CREATE OR REPLACE would leave the old overload callable (PostgREST resolves
-- overloads by arg name → ambiguity). Forward-only; the old def is superseded here.
DROP FUNCTION IF EXISTS "public"."add_template_phase"("uuid", "uuid", "text", "jsonb", integer, integer[]);
CREATE OR REPLACE FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_default_due_days" integer DEFAULT NULL::integer, "p_blocks" integer[] DEFAULT '{}'::integer[], "p_result_ruleset" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."process_template_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_status, v_commission_id
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.forms
    where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.process_template_phases
  where template_id = p_template_id;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days, blocks, result_ruleset)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks, p_result_ruleset)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_id, v_position, v_blocks);
  perform app.validate_template_result_ruleset(p_template_id, v_position, p_result_ruleset);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb") OWNER TO "postgres";

-- update_template_phase — additive p_result_ruleset / p_clear_result_ruleset (same
-- clear/replace/keep machinery as recommend_when). DROP the prior 9-arg signature
-- (see add_template_phase note).
DROP FUNCTION IF EXISTS "public"."update_template_phase"("uuid", "uuid", "text", "jsonb", boolean, integer, boolean, integer[], boolean);
CREATE OR REPLACE FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_clear_recommend_when" boolean DEFAULT false, "p_default_due_days" integer DEFAULT NULL::integer, "p_clear_default_due_days" boolean DEFAULT false, "p_blocks" integer[] DEFAULT NULL::integer[], "p_clear_blocks" boolean DEFAULT false, "p_result_ruleset" "jsonb" DEFAULT NULL::"jsonb", "p_clear_result_ruleset" boolean DEFAULT false) RETURNS "public"."process_template_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_commission_id uuid;
  v_new_recommend jsonb;
  v_new_due_days integer;
  v_new_blocks integer[];
  v_new_ruleset jsonb;
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status, t.commission_id
    into v_template_id, v_position, v_status, v_commission_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_blocks then
    v_new_blocks := '{}';
  elsif p_blocks is not null then
    v_new_blocks := coalesce(
      (select array_agg(distinct b order by b)
       from unnest(p_blocks) as b
       where b is not null),
      '{}');
  else
    select blocks into v_new_blocks
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- result_ruleset with the SAME clear/replace/keep logic.
  if p_clear_result_ruleset then
    v_new_ruleset := null;
  elsif p_result_ruleset is not null then
    v_new_ruleset := p_result_ruleset;
  else
    select result_ruleset into v_new_ruleset
    from public.process_template_phases where id = p_phase_id;
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days,
      blocks = v_new_blocks,
      result_ruleset = v_new_ruleset
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_template_id, v_position, v_new_blocks);
  perform app.validate_template_result_ruleset(v_template_id, v_position, v_new_ruleset);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean) OWNER TO "postgres";

-- publish_process_template — extend the validation loop to also validate every
-- phase whose result_ruleset is not null (the authoritative gate).
CREATE OR REPLACE FUNCTION "public"."publish_process_template"("p_template_id" "uuid") RETURNS "public"."process_templates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_phase_count integer;
  r record;
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.process_templates where id = p_template_id;
  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser publicados'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_phase_count
  from public.process_template_phases where template_id = p_template_id;
  if v_phase_count < 1 then
    raise exception 'um processo precisa de ao menos uma fase para ser publicado'
      using errcode = 'HC016';
  end if;

  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_id = p_template_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(p_template_id, r.position, r.recommend_when);
  end loop;

  for r in
    select position, result_ruleset
    from public.process_template_phases
    where template_id = p_template_id and result_ruleset is not null
  loop
    perform app.validate_template_result_ruleset(p_template_id, r.position, r.result_ruleset);
  end loop;

  update public.process_templates
  set status = 'active', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."publish_process_template"("p_template_id" "uuid") OWNER TO "postgres";

-- create_case_from_template — snapshot result_ruleset onto case_phases + freeze the
-- offered result set. Re-stated from the LATEST definition
-- (20260620017000_case_patient.sql) VERBATIM, with ONLY: (a) result_ruleset added
-- to the slot select + case_phases insert, (b) the offered-result-set snapshot
-- beside the offered-outcomes snapshot.
CREATE OR REPLACE FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text" DEFAULT NULL::"text") RETURNS "public"."cases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by, patient_enabled)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(), coalesce(v_collects, false))
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      v_source_version := app.published_version_of_form(
        (select form_id from public.process_template_phases
         where template_id = p_template_id and position = v_from_phase)
      );
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) não está publicado',
          v_from_phase using errcode = 'HC017';
      end if;
      if not app.version_has_input_key(v_source_version, v_qkey) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", ausente no formulário publicado',
          r_slot.position, v_qkey using errcode = 'HC016';
      end if;
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset);
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- Freeze the OFFERED RESULT set: the distinct result options referenced by any
  -- phase's result_ruleset (rule result_ids + default_result_id). The computed-
  -- path guard reads THIS.
  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from public.process_template_phases ph
  cross join lateral (
    select (r ->> 'result_id')::uuid as rid
    from jsonb_array_elements(coalesce(ph.result_ruleset -> 'rules', '[]'::jsonb)) as r
    union
    select (ph.result_ruleset ->> 'default_result_id')::uuid
  ) ids
  where ph.template_id = p_template_id
    and ph.result_ruleset is not null
    and ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

ALTER FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") OWNER TO "postgres";

-- sync_case_phase_on_submit — invoke compute_case_phase_result after the flip,
-- beside recompute_recommendations.
CREATE OR REPLACE FUNCTION "public"."sync_case_phase_on_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_case_status text;
begin
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  if v_case_status in ('concluido', 'cancelado') then
    return new;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'concluida', completed_at = now(), updated_at = now()
  where id = new.case_phase_id and status = 'ativa';
  perform set_config('app.in_case_rpc', 'off', true);

  -- Compute (or honor the override for) the phase result, in the same conclude
  -- transition. No-op when the case_phase_results flag is off.
  perform app.compute_case_phase_result(new.case_phase_id);

  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$$;

ALTER FUNCTION "public"."sync_case_phase_on_submit"() OWNER TO "postgres";

-- trg_audit_case_phases — add result_id + result_override_id to the diff allow-list
-- so the conclude-time computed result rides the existing status_changed row. (The
-- manual override is audited separately by set_case_phase_result_override.)
CREATE OR REPLACE FUNCTION "app"."trg_audit_case_phases"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  if new.status is distinct from old.status then
    v_comm := app.commission_of_case(new.case_id);
    perform app.audit_write('case_phase.status_changed', 'case_phase', new.id, v_comm,
      'Status da fase ' || new.position || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status', 'position', 'result_id', 'result_override_id']));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_phases"() OWNER TO "postgres";

-- list_cases_board — project each phase's effective result, resolved LIVE.
CREATE OR REPLACE FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") RETURNS TABLE("case_id" "uuid", "case_number" integer, "label" "text", "status" "text", "outcome_id" "uuid", "outcome" "jsonb", "created_at" timestamp with time zone, "closed_at" timestamp with time zone, "phases" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  select c.id,
         c.case_number,
         c.label,
         c.status,
         c.outcome_id,
         case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end as outcome,
         c.created_at,
         c.closed_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
               'position', cp.position,
               'title', cp.title,
               'status', cp.status,
               'recommended', cp.recommended,
               'assigned_to', cp.assigned_to,
               'assignee_name', pr.full_name,
               'due_date', cp.due_date,
               'result', case when prr.id is null then null else jsonb_build_object(
                 'id', prr.id,
                 'label', prr.label,
                 'color_token', prr.color_token,
                 'is_adverse', prr.is_adverse,
                 'source', cp.result_source
               ) end
             ) order by cp.position)
            from public.case_phases cp
            left join public.profiles pr on pr.id = cp.assigned_to
            left join public.phase_results prr on prr.id = cp.result_id
            where cp.case_id = c.id),
           '[]'::jsonb) as phases
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
  order by c.case_number desc;
end;
$$;

ALTER FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") OWNER TO "postgres";

-- get_case_detail — project each phase's result_id / result_computed_at + a
-- live-resolved `result` object. Re-stated from the LATEST definition
-- (20260620017000_case_patient.sql) verbatim, with only the phase-projection
-- additions. SECURITY DEFINER; VOLATILE (audit write side-effect — CA-001 guard).
CREATE OR REPLACE FUNCTION "public"."get_case_detail"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_admin();

  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at,
          -- phase-results: the effective result id/stamp + a LIVE-resolved object.
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_case_detail"("p_case_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- GRANTS — this file carries its own (the 005000 / 017000 grant blocks are closed).
-- ===========================================================================
GRANT ALL ON TABLE "public"."phase_results" TO "authenticated";
GRANT ALL ON TABLE "public"."phase_results" TO "service_role";
GRANT ALL ON TABLE "public"."case_phase_offered_results" TO "authenticated";
GRANT ALL ON TABLE "public"."case_phase_offered_results" TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_phase_results_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_phase_results_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_phase_results_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_phase_result"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_phase_result"("p_result_id" "uuid", "p_label" "text", "p_color_token" "text", "p_is_adverse" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_phase_results"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_phase_result"("p_result_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") TO "service_role";

-- Re-state grants for the CHANGED add/update_template_phase signatures (additive).
REVOKE ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean) TO "service_role";

-- app.* helpers are postgres-owned DEFINER; no authenticated grant needed (called
-- internally), consistent with validate_template_recommend_when / eval_condition.

-- ===========================================================================
-- Feature flag — ships OFF (the E2E suite flips it ON).
-- ===========================================================================
INSERT INTO app.feature_flags (key, enabled, description)
VALUES ('case_phase_results', false, 'When true, the per-phase categorical RESULT feature is live: template phases may carry a result_ruleset, case creation snapshots it + the offered result set, the conclude trigger computes/honors the result, and the end-of-wizard override RPC runs. compute_case_phase_result early-returns when off, so the conclude hook stays a no-op. Record-&-surface only (no routing/gating).')
ON CONFLICT (key) DO NOTHING;
