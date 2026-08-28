-- ===========================================================================
-- DEMO SEED — "Comissão de Revisão de Prontuário" (pt-BR sales showcase)
-- ===========================================================================
-- A SELF-CONTAINED demo dataset for presenting the platform to a prospective
-- Brazilian customer. It creates its OWN organization / hospital / commission
-- and does NOT touch the E2E fixtures in supabase/seed.sql. Every user-facing
-- string is pt-BR; code/comments are English (Rule 10).
--
-- WHAT IT SHOWCASES
--   * Tenancy:      Rede São Rafael de Saúde › Hospital São Rafael › a commission
--   * Members:      8 committee members (coordinator + 7) with titles + categories
--   * Process:      "Revisão de Prontuário" template, 2 phases
--       - Fase 1 "Checklist Revisão de Prontuário" — 19 questions, 7 block types,
--         14 multiple-choice, 1 conditional section, 1 respondent sign-off
--       - Fase 2 "Parecer do Comitê" — dropdown/checkbox/number/free-text + a
--         coordinator sign-off
--   * Cases:        20 cases across every status (not_started / in_review /
--                   pending / completed / cancelled), phases assigned to members,
--                   custom fields, outcomes, narratives, filled responses
--   * Action items: concluded + open + overdue + in-progress + cancelled, sourced
--                   from meetings, cases and manual entry
--   * Meetings:     6 meetings — scheduled / held / signed / distributed, all
--                   modalities, quorum, attendees, agenda, minutes, case links
--   * Documents:    6 controlled documents (draft / in_approval / changes_requested
--                   / effective / obsolete) with version history + approvals, plus
--                   the committee Charter (Regimento) + meeting cadence
--   * Indicators:   2 quality indicators with monthly measurements (dashboard)
--
-- HOW TO APPLY (against a database that already has the migrations applied):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 --single-transaction \
--        -f supabase/demo/seed-revisao-prontuario.sql
--   (Cloud: use the project's pooler/direct connection string instead.)
--
-- LOGIN — every user's password is:  Demo1234!
--   ricardo.almeida@saorafael.demo   Coordenador (staff_admin) — Presidente
--   beatriz.carvalho@saorafael.demo  Membro — Vice-Presidente
--   camila.ribeiro@saorafael.demo    Membro — Secretária
--   fernando.souza@saorafael.demo    Membro Efetivo
--   patricia.gomes@saorafael.demo    Membro Efetivo
--   juliana.martins@saorafael.demo   Membro Efetivo
--   marcelo.nunes@saorafael.demo     Membro Consultivo
--   ana.ferreira@saorafael.demo      Membro Consultivo (SAME)
--   eduardo.tavares@saorafael.demo   Administrador da rede (org_admin)
--
-- Re-running: run supabase/demo/reset-revisao-prontuario.sql first to clear it.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Seed helpers (dropped at the end). They mirror the app's write paths so the
-- direct inserts satisfy the same shapes the RPCs produce.
--   seed_opts   — attach options to a form item (resolved by version+question_key)
--   seed_pick   — record a choice answer (parent answer + selected options)
--   seed_scalar — record a scalar answer (free_text / number / date)
--   fill_r1     — fill a full "Checklist" (Fase 1) response for a case
--   fill_r2     — fill a full "Parecer" (Fase 2) response for a case
-- ---------------------------------------------------------------------------
create or replace function app.seed_opts(p_ver uuid, p_qk text, p_codes text[], p_labels text[])
returns void language plpgsql as $seed_opts$
declare v_item uuid;
begin
  select id into v_item from public.form_items where form_version_id = p_ver and question_key = p_qk;
  insert into public.form_item_options (item_id, position, code, label)
  select v_item, i - 1, p_codes[i], p_labels[i] from generate_subscripts(p_codes, 1) i;
end;
$seed_opts$;

create or replace function app.seed_pick(p_resp uuid, p_ver uuid, p_qk text, p_codes text[])
returns void language plpgsql as $seed_pick$
declare v_item uuid; v_answer uuid;
begin
  select id into v_item from public.form_items where form_version_id = p_ver and question_key = p_qk;
  insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
  values (p_resp, v_item, p_qk, null, null)
  on conflict (response_id, item_id) where group_instance_id is null
  do update set question_key = excluded.question_key
  returning id into v_answer;
  insert into public.answer_selected_options (answer_id, option_id)
  select v_answer, o.id from public.form_item_options o
  where o.item_id = v_item and o.code = any (p_codes);
end;
$seed_pick$;

create or replace function app.seed_scalar(p_resp uuid, p_ver uuid, p_qk text, p_value jsonb)
returns void language plpgsql as $seed_scalar$
declare v_item uuid;
begin
  select id into v_item from public.form_items where form_version_id = p_ver and question_key = p_qk;
  insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
  values (p_resp, v_item, p_qk, p_value, null)
  on conflict (response_id, item_id) where group_instance_id is null
  do update set value = excluded.value;
end;
$seed_scalar$;

create or replace function app.fill_r1(p_resp uuid, p_ver uuid, p_seq int, p_nonconf boolean)
returns void language plpgsql as $fill_r1$
declare
  v_tipo text := (array['clinica','cirurgica','obstetricia','pediatria','uti'])[1 + (p_seq % 5)];
begin
  perform app.seed_pick(p_resp, p_ver, 'identificacao_completa',       array[case when p_nonconf then 'parcial' else 'sim' end]);
  perform app.seed_pick(p_resp, p_ver, 'tipo_internacao',              array[v_tipo]);
  perform app.seed_pick(p_resp, p_ver, 'termo_internacao_assinado',    array['sim']);
  perform app.seed_pick(p_resp, p_ver, 'anamnese_presente',            array['sim']);
  perform app.seed_pick(p_resp, p_ver, 'exame_fisico_registrado',      array[case when p_nonconf then 'parcial' else 'sim' end]);
  perform app.seed_pick(p_resp, p_ver, 'evolucao_diaria',              array['sim']);
  perform app.seed_pick(p_resp, p_ver, 'prescricao_legivel',           array[case when p_nonconf then 'nao' else 'sim' end]);
  perform app.seed_pick(p_resp, p_ver, 'registros_enfermagem',         array['sim']);
  perform app.seed_scalar(p_resp, p_ver, 'dias_internacao',            to_jsonb(3 + (p_seq % 12)));
  if v_tipo = 'cirurgica' then
    perform app.seed_pick(p_resp, p_ver, 'descricao_cirurgica',        array['sim']);
    perform app.seed_pick(p_resp, p_ver, 'ficha_anestesica',           array['sim']);
    perform app.seed_pick(p_resp, p_ver, 'consentimento_cirurgico',    array[case when p_nonconf then 'nao' else 'sim' end]);
  end if;
  perform app.seed_pick(p_resp, p_ver, 'resumo_alta',                  array[case when p_nonconf then 'nao' else 'sim' end]);
  perform app.seed_pick(p_resp, p_ver, 'identificacao_todas_folhas',   array['sim']);
  perform app.seed_pick(p_resp, p_ver, 'documentos_ausentes',
    case when p_nonconf then array['resumo_alta'] else array['nenhum'] end);
  perform app.seed_scalar(p_resp, p_ver, 'data_revisao',
    to_jsonb(to_char(current_date - (p_seq || ' days')::interval, 'YYYY-MM-DD')));
  perform app.seed_pick(p_resp, p_ver, 'legibilidade_geral',           array[case when p_nonconf then 'parcial' else 'adequada' end]);
  perform app.seed_pick(p_resp, p_ver, 'nao_conformidade_identificada', array[case when p_nonconf then 'sim' else 'nao' end]);
  perform app.seed_scalar(p_resp, p_ver, 'observacoes', to_jsonb(
    case when p_nonconf
      then 'Identificadas pendências de documentação no prontuário; caso encaminhado ao comitê para parecer.'
      else 'Prontuário revisado de acordo com o checklist, sem não conformidades relevantes.'
    end::text));
end;
$fill_r1$;

create or replace function app.fill_r2(p_resp uuid, p_ver uuid, p_conclusao text)
returns void language plpgsql as $fill_r2$
begin
  perform app.seed_pick(p_resp, p_ver, 'conclusao_parecer', array[p_conclusao]);
  perform app.seed_pick(p_resp, p_ver, 'recomendacoes',
    case p_conclusao
      when 'nao_conforme' then array['feedback','capacitacao','auditoria']
      when 'ressalvas'    then array['feedback']
      else array['nenhuma']
    end);
  perform app.seed_pick(p_resp, p_ver, 'necessita_reauditoria',
    array[case when p_conclusao = 'nao_conforme' then 'sim' else 'nao' end]);
  perform app.seed_scalar(p_resp, p_ver, 'nota_qualidade',
    to_jsonb(case p_conclusao when 'conforme' then 95 when 'ressalvas' then 80 else 55 end));
  perform app.seed_scalar(p_resp, p_ver, 'parecer_md', to_jsonb(
    case p_conclusao
      when 'nao_conforme' then E'O comitê identificou não conformidades relevantes na documentação do prontuário, com impacto potencial na continuidade do cuidado. Recomenda-se feedback ao profissional responsável e reauditoria no próximo ciclo.'
      when 'ressalvas'    then E'O prontuário encontra-se em conformidade, com ressalvas pontuais quanto ao registro. Orienta-se atenção aos itens sinalizados nas próximas admissões.'
      else E'O prontuário encontra-se em conformidade com as normas institucionais e as boas práticas de registro em saúde.'
    end::text));
  perform app.seed_scalar(p_resp, p_ver, 'homologacao_coordenador',
    to_jsonb('Parecer homologado pela coordenação da Comissão de Revisão de Prontuário.'::text));
end;
$fill_r2$;

-- ---------------------------------------------------------------------------
-- Organization + hospital (created before the users so the org exists by the time
-- each persona's `organization_affiliations` row references it — mirrors
-- supabase/seed.sql).
-- ⚠ CORRECTED at the AE2 drop (20261003006500): this said the ordering existed so
--   `home_organization_id` "is satisfiable at handle_new_user trigger time". That
--   column is dropped and the trigger writes no org at all; the ordering still holds,
--   but because of the affiliation FK below, not the column.
-- ---------------------------------------------------------------------------
insert into public.organizations (id, name, slug, created_by) values
  ('d5000000-0000-0000-0000-000000000001', 'Rede São Rafael de Saúde', 'rede-sao-rafael', null);

insert into public.hospitals (id, organization_id, name, slug) values
  ('d5000000-0000-0000-0000-000000000002', 'd5000000-0000-0000-0000-000000000001', 'Hospital São Rafael', 'hospital-sao-rafael');

-- ---------------------------------------------------------------------------
-- Auth users (login-capable). Direct auth.users inserts; on_auth_user_created
-- builds the profiles row from user_metadata (full_name + home org), exactly as
-- the real invite path does. Password for all: Demo1234!
-- ---------------------------------------------------------------------------
do $users$
declare
  v_org text := 'd5000000-0000-0000-0000-000000000001';
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e1','email','ricardo.almeida@saorafael.demo', 'name','Ricardo Almeida'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e2','email','beatriz.carvalho@saorafael.demo','name','Beatriz Carvalho'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e3','email','camila.ribeiro@saorafael.demo',  'name','Camila Ribeiro'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e4','email','fernando.souza@saorafael.demo',  'name','Fernando Souza'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e5','email','patricia.gomes@saorafael.demo',  'name','Patrícia Gomes'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e6','email','juliana.martins@saorafael.demo', 'name','Juliana Martins'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e7','email','marcelo.nunes@saorafael.demo',   'name','Marcelo Nunes'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e8','email','ana.ferreira@saorafael.demo',    'name','Ana Paula Ferreira'),
    jsonb_build_object('id','d5000000-0000-0000-0000-0000000000e0','email','eduardo.tavares@saorafael.demo', 'name','Eduardo Tavares')
  );
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (u ->> 'id')::uuid,
      'authenticated', 'authenticated',
      u ->> 'email',
      crypt('Demo1234!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      -- The `home_organization_id` key left this object at the AE2 drop
      -- (20261003006500): nothing reads it. The org anchor for these personas is the
      -- `organization_affiliations` insert below, which was already the real one.
      jsonb_build_object('full_name', u ->> 'name'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), (u ->> 'id'), (u ->> 'id')::uuid,
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email'),
      'email', now(), now(), now()
    );
    update public.profiles set full_name = u ->> 'name'
    where id = (u ->> 'id')::uuid;
    -- AFF4 · B7 (ADR 0151 D1/D4): the ORG affiliation is the PARENT of the hospital
    -- one and must be inserted FIRST — a hospital affiliation with no active org
    -- affiliation is refused by the containment backstop. The file runs
    -- `--single-transaction` so the deferred trigger would tolerate either order, but
    -- the order is written correctly anyway: a fixture that relies on deferral to be
    -- valid is a fixture that breaks the moment someone runs a statement of it alone.
    insert into public.organization_affiliations (principal_id, organization_id)
    values ((u ->> 'id')::uuid, v_org::uuid);
    -- AFF W1 (ADR 0097 D1/D3): "works at this hospital" is a hospital_affiliations
    -- row — `profiles.home_hospital_id` was dropped by 20260909000300. This file is
    -- applied MANUALLY (`psql --single-transaction -f`), is excluded from
    -- config.toml's `sql_paths`, and is therefore in NO gate: it breaks silently and
    -- only in front of a customer. Owned by `backend` in AFF T1.3 by name (external
    -- audit MEDIUM-2 — the union of scoped sweeps is not a sweep).
    insert into public.hospital_affiliations (principal_id, organization_id, hospital_id)
    values ((u ->> 'id')::uuid, v_org::uuid, 'd5000000-0000-0000-0000-000000000002');
  end loop;
end;
$users$;

-- ---------------------------------------------------------------------------
-- Commission (insert auto-provisions the default meeting types, quorum settings
-- and member titles via triggers). organization_id is derived from hospital_id.
-- ---------------------------------------------------------------------------
insert into public.commissions (id, name, slug, created_by, hospital_id) values
  ('d5000000-0000-0000-0000-000000000003', 'Comissão de Revisão de Prontuário', 'revisao-prontuario',
   'd5000000-0000-0000-0000-0000000000e1', 'd5000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- Memberships. Org admin (org-tier) + 8 committee members (commission-tier,
-- each carrying a title resolved from the auto-provisioned title vocabulary).
-- ---------------------------------------------------------------------------
insert into public.memberships (organization_id, principal_id, role) values
  ('d5000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-0000000000e0', 'org_admin');

do $mem$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  function_title text;
  r record;
begin
  for r in
    select * from (values
      ('d5000000-0000-0000-0000-0000000000e1', 'staff_admin', 'Presidente'),
      ('d5000000-0000-0000-0000-0000000000e2', 'staff',       'Vice-Presidente'),
      ('d5000000-0000-0000-0000-0000000000e3', 'staff',       'Secretário(a)'),
      ('d5000000-0000-0000-0000-0000000000e4', 'staff',       'Membro Efetivo'),
      ('d5000000-0000-0000-0000-0000000000e5', 'staff',       'Membro Efetivo'),
      ('d5000000-0000-0000-0000-0000000000e6', 'staff',       'Membro Efetivo'),
      ('d5000000-0000-0000-0000-0000000000e7', 'staff',       'Membro Consultivo'),
      ('d5000000-0000-0000-0000-0000000000e8', 'staff',       'Membro Consultivo')
    ) as t(principal_id, role, title_name)
  loop
    insert into public.memberships (commission_id, principal_id, role, title_id, granted_by)
    values (v_comm, r.principal_id::uuid, r.role,
            (select id from public.commission_member_titles
               where commission_id = v_comm and name = r.title_name),
            'd5000000-0000-0000-0000-0000000000e1');
  end loop;
end;
$mem$;

-- ---------------------------------------------------------------------------
-- Professional categories + a couple of verified credentials (directory flavor).
-- ---------------------------------------------------------------------------
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000001'  -- physician
  where id in ('d5000000-0000-0000-0000-0000000000e1','d5000000-0000-0000-0000-0000000000e2',
               'd5000000-0000-0000-0000-0000000000e4','d5000000-0000-0000-0000-0000000000e7',
               'd5000000-0000-0000-0000-0000000000e0');
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000002'  -- nurse
  where id in ('d5000000-0000-0000-0000-0000000000e3','d5000000-0000-0000-0000-0000000000e5');
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000003'  -- pharmacist
  where id = 'd5000000-0000-0000-0000-0000000000e6';
update public.profiles set professional_category_id = 'd1000000-0000-0000-0000-000000000005'  -- administrator
  where id = 'd5000000-0000-0000-0000-0000000000e8';

insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number, verified_at, expires_on) values
  ('d5000000-0000-0000-0000-0000000000e1', 'BR', 'SP', 'CRM',   '54321-SP', now(), null),
  ('d5000000-0000-0000-0000-0000000000e3', 'BR', 'SP', 'COREN', '112233-SP', now(), '2028-06-30');

-- ---------------------------------------------------------------------------
-- Feature flags — ensure every showcased surface is reachable on a fresh DB.
-- Flags are PLATFORM-GLOBAL, not tenant-scoped: flipping one here reaches every
-- tenant on the database, so this is the only demo write that escapes the demo
-- tenant. Record the prior value of each flag we actually change;
-- reset-revisao-prontuario.sql restores them and drops the table. A flag that is
-- already ON is left untouched and not recorded.
-- ---------------------------------------------------------------------------
create table if not exists app.demo_saorafael_flag_backup (
  key           text primary key,
  prior_enabled boolean
);

with targets(key) as (
  select unnest(array[
    'meetings','action_items','cases_multi_phase','cases_extras','case_narratives',
    'case_custom_fields','controlled_docs','charters','quality_indicators',
    'notifications','attachments','audit_trail','processless_cases'
  ])
)
insert into app.demo_saorafael_flag_backup (key, prior_enabled)
select f.key, f.enabled
  from app.feature_flags f
  join targets t on t.key = f.key
 where f.enabled is distinct from true
on conflict (key) do nothing;  -- a re-apply must not overwrite the true original

update app.feature_flags f set enabled = true
  from app.demo_saorafael_flag_backup b
 where b.key = f.key and f.enabled is distinct from true;

-- ===========================================================================
-- FORM R1 — "Checklist Revisão de Prontuário" (Fase 1). Sectioned: intro +
-- Identificação + Registros clínicos + Registros cirúrgicos (CONDITIONAL on
-- tipo de internação = Cirúrgica) + Alta (respondent sign-off). 19 questions,
-- 14 multiple-choice, plus dropdown / checkbox / number / date / free_text.
-- ===========================================================================
do $formr1$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_form uuid := 'd5000000-0000-0000-0000-00000000f001';
  v_ver  uuid := 'd5000000-0000-0000-0000-00000000f011';
  v_chefe uuid := 'd5000000-0000-0000-0000-0000000000e1';
  s_intro   uuid := gen_random_uuid();
  s_ident   uuid := gen_random_uuid();
  s_clin    uuid := gen_random_uuid();
  s_cirurg  uuid := gen_random_uuid();
  s_alta    uuid := gen_random_uuid();
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form, v_comm, 'Checklist Revisão de Prontuário',
          'Roteiro de verificação da qualidade e da completude dos registros do prontuário do paciente.',
          v_chefe);
  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_ver, v_form, 1, 'draft', v_chefe);

  -- Intro (default section)
  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (s_intro, v_ver, 0, null, true);
  insert into public.form_items (section_id, position, item_type, content)
  values (s_intro, 0, 'section_text', jsonb_build_object('markdown',
    E'## Revisão de Prontuário\nPreencha o checklist com base na análise documental do prontuário selecionado. Os campos assinalados são obrigatórios.'));

  -- Section: Identificação e admissão
  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_ident, v_ver, 1, 'Identificação e admissão', 'Dados de identificação e documentos de entrada.');
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, required) values
    (s_ident, 0, 'multiple_choice', 'identificacao_completa',
     'A identificação do paciente está completa e legível em todas as folhas?',
     'Considere nome completo, registro e data de nascimento.', true);
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_ident, 1, 'dropdown', 'tipo_internacao', 'Tipo de internação', true),
    (s_ident, 2, 'multiple_choice', 'termo_internacao_assinado', 'O termo de internação está presente e assinado?', true);

  -- Section: Registros clínicos
  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_clin, v_ver, 2, 'Registros clínicos', 'Anamnese, evolução e prescrição.');
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_clin, 0, 'multiple_choice', 'anamnese_presente',       'A anamnese e o exame clínico de admissão estão registrados?', true),
    (s_clin, 1, 'multiple_choice', 'exame_fisico_registrado', 'O exame físico está adequadamente documentado?', true),
    (s_clin, 2, 'multiple_choice', 'evolucao_diaria',         'Há evolução médica diária durante a internação?', true);
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, required) values
    (s_clin, 3, 'multiple_choice', 'prescricao_legivel', 'As prescrições estão legíveis, datadas e assinadas?',
     'Inclui carimbo e identificação do prescritor.', true);
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_clin, 4, 'multiple_choice', 'registros_enfermagem', 'Os registros de enfermagem estão completos?', true),
    (s_clin, 5, 'number', 'dias_internacao', 'Número de dias de internação', true);

  -- Section: Registros cirúrgicos (CONDITIONAL: tipo_internacao = cirurgica)
  insert into public.form_sections (id, form_version_id, position, title, description, visible_when)
  values (s_cirurg, v_ver, 3, 'Registros cirúrgicos e anestésicos',
          'Aplicável apenas às internações cirúrgicas.',
          jsonb_build_object('question_key', 'tipo_internacao', 'op', 'equals', 'value', 'cirurgica'));
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_cirurg, 0, 'multiple_choice', 'descricao_cirurgica',    'A descrição cirúrgica está presente e completa?', true),
    (s_cirurg, 1, 'multiple_choice', 'ficha_anestesica',       'A ficha anestésica está presente e completa?', true),
    (s_cirurg, 2, 'multiple_choice', 'consentimento_cirurgico','O termo de consentimento cirúrgico está assinado?', true);

  -- Section: Alta e encerramento (respondent sign-off)
  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_alta, v_ver, 4, 'Alta e encerramento', 'Documentos de alta e conclusão da revisão.', true, 'respondent');
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_alta, 0, 'multiple_choice', 'resumo_alta',                'O resumo/relatório de alta está presente?', true),
    (s_alta, 1, 'multiple_choice', 'identificacao_todas_folhas', 'Todas as folhas do prontuário estão identificadas?', true),
    (s_alta, 2, 'checkbox',        'documentos_ausentes',        'Assinale os documentos ausentes (se houver)', false),
    (s_alta, 3, 'date',            'data_revisao',               'Data da revisão do prontuário', true),
    (s_alta, 4, 'multiple_choice', 'legibilidade_geral',         'Avaliação geral da legibilidade do prontuário', true);
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, required) values
    (s_alta, 5, 'multiple_choice', 'nao_conformidade_identificada',
     'Foi identificada não conformidade que exija análise do comitê?',
     'Se "Sim", a fase de parecer do comitê é recomendada automaticamente.', true);
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_alta, 6, 'free_text', 'observacoes', 'Observações da revisão', false);

  -- Options (resolved by version + question_key)
  perform app.seed_opts(v_ver, 'identificacao_completa',       array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'tipo_internacao',              array['clinica','cirurgica','obstetricia','pediatria','uti'],
                                                               array['Clínica','Cirúrgica','Obstétrica','Pediátrica','UTI']);
  perform app.seed_opts(v_ver, 'termo_internacao_assinado',    array['sim','nao','nao_aplica'], array['Sim','Não','Não se aplica']);
  perform app.seed_opts(v_ver, 'anamnese_presente',            array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'exame_fisico_registrado',      array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'evolucao_diaria',              array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'prescricao_legivel',           array['sim','nao'], array['Sim','Não']);
  perform app.seed_opts(v_ver, 'registros_enfermagem',         array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'descricao_cirurgica',          array['sim','nao','nao_aplica'], array['Sim','Não','Não se aplica']);
  perform app.seed_opts(v_ver, 'ficha_anestesica',             array['sim','nao','nao_aplica'], array['Sim','Não','Não se aplica']);
  perform app.seed_opts(v_ver, 'consentimento_cirurgico',      array['sim','nao'], array['Sim','Não']);
  perform app.seed_opts(v_ver, 'resumo_alta',                  array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'identificacao_todas_folhas',   array['sim','parcial','nao'], array['Sim','Parcial','Não']);
  perform app.seed_opts(v_ver, 'documentos_ausentes',
    array['termo_consentimento','resumo_alta','evolucao_medica','prescricao','exames','nenhum'],
    array['Termo de consentimento','Resumo de alta','Evolução médica','Prescrição','Exames','Nenhum']);
  perform app.seed_opts(v_ver, 'legibilidade_geral',           array['adequada','parcial','inadequada'], array['Adequada','Parcial','Inadequada']);
  perform app.seed_opts(v_ver, 'nao_conformidade_identificada', array['sim','nao'], array['Sim','Não']);

  perform public.publish_form_version(v_ver);
end;
$formr1$;

-- ===========================================================================
-- FORM R2 — "Parecer do Comitê" (Fase 2). Parecer técnico (dropdown / checkbox /
-- MC / number) + conclusão descritiva + homologação (staff_admin sign-off).
-- ===========================================================================
do $formr2$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_form uuid := 'd5000000-0000-0000-0000-00000000f002';
  v_ver  uuid := 'd5000000-0000-0000-0000-00000000f012';
  v_chefe uuid := 'd5000000-0000-0000-0000-0000000000e1';
  s_intro    uuid := gen_random_uuid();
  s_parecer  uuid := gen_random_uuid();
  s_concl    uuid := gen_random_uuid();
  s_homolog  uuid := gen_random_uuid();
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form, v_comm, 'Parecer do Comitê',
          'Parecer técnico da comissão sobre a revisão do prontuário.', v_chefe);
  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_ver, v_form, 1, 'draft', v_chefe);

  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (s_intro, v_ver, 0, null, true);
  insert into public.form_items (section_id, position, item_type, content)
  values (s_intro, 0, 'section_text', jsonb_build_object('markdown',
    E'## Parecer do Comitê\nConsolide a conclusão do comitê sobre a revisão realizada na fase anterior.'));

  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_parecer, v_ver, 1, 'Parecer técnico', 'Conclusão e recomendações do comitê.');
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_parecer, 0, 'dropdown',        'conclusao_parecer',     'Conclusão do comitê', true),
    (s_parecer, 1, 'checkbox',        'recomendacoes',         'Recomendações', false),
    (s_parecer, 2, 'multiple_choice', 'necessita_reauditoria', 'O prontuário deve entrar em reauditoria?', true),
    (s_parecer, 3, 'number',          'nota_qualidade',        'Nota de qualidade do registro (0 a 100)', false);

  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_concl, v_ver, 2, 'Conclusão descritiva', 'Fundamentação do parecer.');
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_concl, 0, 'free_text', 'parecer_md', 'Parecer descritivo do comitê', true);

  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_homolog, v_ver, 3, 'Homologação da coordenação', 'Conferência final pela coordenação.', true, 'staff_admin');
  insert into public.form_items (section_id, position, item_type, question_key, label, required) values
    (s_homolog, 0, 'free_text', 'homologacao_coordenador', 'Homologação da coordenação', false);

  perform app.seed_opts(v_ver, 'conclusao_parecer', array['conforme','ressalvas','nao_conforme'],
                                                    array['Conforme','Conforme com ressalvas','Não conforme']);
  perform app.seed_opts(v_ver, 'recomendacoes',
    array['feedback','capacitacao','revisao_processo','auditoria','nenhuma'],
    array['Feedback ao profissional','Capacitação da equipe','Revisão de processo','Auditoria de acompanhamento','Nenhuma']);
  perform app.seed_opts(v_ver, 'necessita_reauditoria', array['sim','nao'], array['Sim','Não']);

  perform public.publish_form_version(v_ver);
end;
$formr2$;

-- ===========================================================================
-- PROCESS TEMPLATE "Revisão de Prontuário" — two phases, three outcomes, three
-- custom fields (administrative descriptors — NON-PHI), two narrative slots.
-- Fase 2 is RECOMMENDED automatically when Fase 1 flags a non conformity.
-- ===========================================================================
do $tpl$
declare
  v_comm  uuid := 'd5000000-0000-0000-0000-000000000003';
  v_chefe uuid := 'd5000000-0000-0000-0000-0000000000e1';
  v_r1    uuid := 'd5000000-0000-0000-0000-00000000f001';  -- forms.id (Fase 1)
  v_r2    uuid := 'd5000000-0000-0000-0000-00000000f002';  -- forms.id (Fase 2)
  v_tpl   uuid := 'd5000000-0000-0000-0000-0000000000a1';
  v_tpl_v uuid := 'd5000000-0000-0000-0000-0000000000a2';   -- v1 published version (ADR 0096)
  v_setor_options jsonb := jsonb_build_array(
    jsonb_build_object('code','clinica_medica','label','Clínica Médica'),
    jsonb_build_object('code','clinica_cirurgica','label','Clínica Cirúrgica'),
    jsonb_build_object('code','uti','label','UTI Adulto'),
    jsonb_build_object('code','pediatria','label','Pediatria'),
    jsonb_build_object('code','obstetricia','label','Obstetrícia'),
    jsonb_build_object('code','ps','label','Pronto-Socorro'),
    jsonb_build_object('code','ortopedia','label','Ortopedia'),
    jsonb_build_object('code','cardiologia','label','Cardiologia'));
begin
  -- Published template: the IDENTITY plus its v1 PUBLISHED version (ADR 0096).
  -- title/description/collects_patient live on the version now (D1), and the old
  -- template status 'active' is the version status 'published'.
  insert into public.process_templates (id, commission_id, created_by)
  values (v_tpl, v_comm, v_chefe);

  insert into public.process_template_versions
    (id, template_id, version_number, status, title, description, collects_patient,
     created_by, published_at)
  values (v_tpl_v, v_tpl, 1, 'published', 'Revisão de Prontuário',
          'Fluxo padrão de revisão de prontuários: checklist documental seguido de parecer do comitê.',
          false, v_chefe, now());

  insert into public.process_template_phases (template_version_id, position, form_id, title, recommend_when, default_due_days) values
    (v_tpl_v, 1, v_r1, 'Checklist Revisão de Prontuário', null, 7),
    (v_tpl_v, 2, v_r2, 'Parecer do Comitê',
     jsonb_build_object('from_phase', 1, 'question_key', 'nao_conformidade_identificada', 'op', 'equals', 'value', 'sim'),
     14);
  update public.process_template_phases set display_position = position where template_version_id = v_tpl_v;

  -- Outcome vocabulary (drives the conformity dashboard). One adverse + action plan.
  insert into public.case_outcomes (id, commission_id, label, color_token, requires_action_plan, is_adverse, position) values
    ('d5000000-0000-0000-0000-0000000000b1', v_comm, 'Conforme',                'green', false, false, 1),
    ('d5000000-0000-0000-0000-0000000000b2', v_comm, 'Conforme com ressalvas',  'amber', false, false, 2),
    ('d5000000-0000-0000-0000-0000000000b3', v_comm, 'Não conforme',            'red',   true,  true,  3);
  insert into public.process_template_outcomes (template_version_id, outcome_id, position) values
    (v_tpl_v, 'd5000000-0000-0000-0000-0000000000b1', 1),
    (v_tpl_v, 'd5000000-0000-0000-0000-0000000000b2', 2),
    (v_tpl_v, 'd5000000-0000-0000-0000-0000000000b3', 3);

  -- Custom fields — administrative descriptors surfaced as list columns.
  insert into public.process_template_custom_fields
    (id, template_version_id, key, label, field_type, options, required, show_in_list, position) values
    ('d5000000-0000-0000-0000-00000000cf01', v_tpl_v, 'numero_prontuario', 'Número do prontuário',
     'short_text', '[]'::jsonb, true,  true, 0),
    ('d5000000-0000-0000-0000-00000000cf02', v_tpl_v, 'setor', 'Setor',
     'dropdown', v_setor_options, false, true, 1),
    ('d5000000-0000-0000-0000-00000000cf03', v_tpl_v, 'data_alta', 'Data da alta',
     'date', '[]'::jsonb, false, false, 2);

  -- Narrative slots (free-form committee prose interleaved after the two phases).
  insert into public.case_narrative_types (id, commission_id, label, description, position) values
    ('d5000000-0000-0000-0000-0000000000d1', v_comm, 'Resumo do Caso',
     'Síntese administrativa do caso, sem dados que identifiquem o paciente.', 1),
    ('d5000000-0000-0000-0000-0000000000d2', v_comm, 'Parecer do Comitê',
     'Conclusão descritiva do comitê.', 2);
  insert into public.process_template_narratives
    (template_version_id, narrative_type_id, display_position, title, instructions, is_expected) values
    (v_tpl_v, 'd5000000-0000-0000-0000-0000000000d1', 3, null, null, false),
    (v_tpl_v, 'd5000000-0000-0000-0000-0000000000d2', 4, null, 'Registre a conclusão do comitê sobre o caso.', true);
end;
$tpl$;

-- ===========================================================================
-- 20 CASES across every status. Phases are assigned to members; representative
-- "hero" cases carry fully filled responses; completed cases carry an outcome
-- and (for the heroes) committee narratives. Direct inserts under app.in_case_rpc
-- (the state-machine guards accept the seeded transitions), mirroring seed.sql.
-- ===========================================================================
do $cases$
declare
  v_comm  uuid := 'd5000000-0000-0000-0000-000000000003';
  v_tpl   uuid := 'd5000000-0000-0000-0000-0000000000a1';
  v_tpl_v uuid := 'd5000000-0000-0000-0000-0000000000a2';   -- v1 published version (ADR 0096)
  v_r1f   uuid := 'd5000000-0000-0000-0000-00000000f001';   -- Fase 1 form
  v_r1v   uuid := 'd5000000-0000-0000-0000-00000000f011';   -- Fase 1 published version
  v_r2f   uuid := 'd5000000-0000-0000-0000-00000000f002';   -- Fase 2 form
  v_r2v   uuid := 'd5000000-0000-0000-0000-00000000f012';   -- Fase 2 published version
  v_chefe uuid := 'd5000000-0000-0000-0000-0000000000e1';
  v_members uuid[] := array[
    'd5000000-0000-0000-0000-0000000000e2','d5000000-0000-0000-0000-0000000000e3',
    'd5000000-0000-0000-0000-0000000000e4','d5000000-0000-0000-0000-0000000000e5',
    'd5000000-0000-0000-0000-0000000000e6','d5000000-0000-0000-0000-0000000000e7',
    'd5000000-0000-0000-0000-0000000000e8']::uuid[];
  v_setor_labels jsonb := jsonb_build_object(
    'clinica_medica','Clínica Médica','clinica_cirurgica','Clínica Cirúrgica','uti','UTI Adulto',
    'pediatria','Pediatria','obstetricia','Obstetrícia','ps','Pronto-Socorro',
    'ortopedia','Ortopedia','cardiologia','Cardiologia');
  -- One row per case: seq, prontuario, setor, macro status, outcome, assignee idx (1..7), nonconf, hero
  v_specs jsonb := jsonb_build_array(
    jsonb_build_object('seq', 1, 'prt','PR-482101','setor','clinica_medica',   'macro','completed',  'outcome','conforme',     'a',1,'nonconf',false,'hero',true),
    jsonb_build_object('seq', 2, 'prt','PR-482102','setor','clinica_cirurgica','macro','completed',  'outcome','ressalvas',    'a',2,'nonconf',true, 'hero',true),
    jsonb_build_object('seq', 3, 'prt','PR-482103','setor','uti',              'macro','completed',  'outcome','nao_conforme', 'a',3,'nonconf',true, 'hero',true),
    jsonb_build_object('seq', 4, 'prt','PR-482104','setor','pediatria',        'macro','completed',  'outcome','conforme',     'a',4,'nonconf',false,'hero',false),
    jsonb_build_object('seq', 5, 'prt','PR-482105','setor','obstetricia',      'macro','completed',  'outcome','nao_conforme', 'a',5,'nonconf',true, 'hero',false),
    jsonb_build_object('seq', 6, 'prt','PR-482106','setor','cardiologia',      'macro','completed',  'outcome','ressalvas',    'a',6,'nonconf',true, 'hero',false),
    jsonb_build_object('seq', 7, 'prt','PR-482107','setor','clinica_medica',   'macro','pending',    'outcome',null,          'a',7,'nonconf',true, 'hero',true),
    jsonb_build_object('seq', 8, 'prt','PR-482108','setor','ps',               'macro','pending',    'outcome',null,          'a',1,'nonconf',false,'hero',false),
    jsonb_build_object('seq', 9, 'prt','PR-482109','setor','ortopedia',        'macro','pending',    'outcome',null,          'a',2,'nonconf',true, 'hero',false),
    jsonb_build_object('seq',10, 'prt','PR-482110','setor','clinica_cirurgica','macro','pending',    'outcome',null,          'a',3,'nonconf',false,'hero',false),
    jsonb_build_object('seq',11, 'prt','PR-482111','setor','uti',              'macro','in_review',  'outcome',null,          'a',4,'nonconf',false,'hero',true),
    jsonb_build_object('seq',12, 'prt','PR-482112','setor','clinica_medica',   'macro','in_review',  'outcome',null,          'a',5,'nonconf',false,'hero',false),
    jsonb_build_object('seq',13, 'prt','PR-482113','setor','pediatria',        'macro','in_review',  'outcome',null,          'a',6,'nonconf',false,'hero',false),
    jsonb_build_object('seq',14, 'prt','PR-482114','setor','obstetricia',      'macro','in_review',  'outcome',null,          'a',7,'nonconf',false,'hero',false),
    jsonb_build_object('seq',15, 'prt','PR-482115','setor','ps',               'macro','in_review',  'outcome',null,          'a',1,'nonconf',false,'hero',false),
    jsonb_build_object('seq',16, 'prt','PR-482116','setor','cardiologia',      'macro','not_started','outcome',null,          'a',2,'nonconf',false,'hero',false),
    jsonb_build_object('seq',17, 'prt','PR-482117','setor','clinica_medica',   'macro','not_started','outcome',null,          'a',3,'nonconf',false,'hero',false),
    jsonb_build_object('seq',18, 'prt','PR-482118','setor','ortopedia',        'macro','not_started','outcome',null,          'a',4,'nonconf',false,'hero',false),
    jsonb_build_object('seq',19, 'prt','PR-482119','setor','clinica_cirurgica','macro','cancelled',  'outcome',null,          'a',5,'nonconf',false,'hero',false),
    jsonb_build_object('seq',20, 'prt','PR-482120','setor','uti',              'macro','cancelled',  'outcome',null,          'a',6,'nonconf',false,'hero',false)
  );
  s jsonb;
  v_seq int; v_prt text; v_setor text; v_setor_label text; v_macro text; v_outcome text;
  v_nonconf boolean; v_hero boolean; v_assignee uuid;
  v_case uuid; v_cp1 uuid; v_cp2 uuid; v_resp uuid;
  v_created timestamptz; v_closed timestamptz;
  v_p1_status text; v_p1_activated timestamptz; v_p1_completed timestamptz;
  v_p2_status text; v_p2_activated timestamptz; v_p2_completed timestamptz;
  v_outcome_id uuid;
begin
  for s in select * from jsonb_array_elements(v_specs)
  loop
    v_seq     := (s->>'seq')::int;
    v_prt     := s->>'prt';
    v_setor   := s->>'setor';
    v_setor_label := v_setor_labels->>v_setor;
    v_macro   := s->>'macro';
    v_outcome := s->>'outcome';
    v_nonconf := (s->>'nonconf')::boolean;
    v_hero    := (s->>'hero')::boolean;
    v_assignee := v_members[(s->>'a')::int];
    v_case := ('d5000000-0000-0000-0000-00000000c0' || lpad(v_seq::text, 2, '0'))::uuid;
    v_cp1  := gen_random_uuid();
    v_cp2  := gen_random_uuid();
    v_outcome_id := case v_outcome
      when 'conforme'     then 'd5000000-0000-0000-0000-0000000000b1'
      when 'ressalvas'    then 'd5000000-0000-0000-0000-0000000000b2'
      when 'nao_conforme' then 'd5000000-0000-0000-0000-0000000000b3' end::uuid;

    v_created := now() - ((case v_macro
        when 'completed'   then 30 + v_seq
        when 'cancelled'   then 24 + v_seq
        when 'pending'     then 12 + (v_seq % 6)
        when 'in_review'   then 5 + (v_seq % 7)
        else 1 + (v_seq % 4) end) || ' days')::interval;
    v_closed := now() - ((5 + (v_seq % 10)) || ' days')::interval;

    -- Phase timing / statuses per macro.
    v_p1_status := case v_macro when 'not_started' then 'pending' when 'in_review' then 'active' else 'completed' end;
    v_p1_activated := case when v_macro = 'not_started' then null else v_created + interval '1 day' end;
    v_p1_completed := case when v_p1_status = 'completed' then v_created + interval '4 days' else null end;
    v_p2_status := case when v_macro = 'completed' then 'completed' else 'pending' end;
    v_p2_activated := case when v_macro = 'completed' then v_created + interval '6 days' else null end;
    v_p2_completed := case when v_macro = 'completed' then v_created + interval '9 days' else null end;

    -- Case (non-terminal at first; closed below for completed/cancelled so narratives insert freely).
    insert into public.cases (id, commission_id, template_version_id, label, created_by, patient_enabled, created_at)
    values (v_case, v_comm, v_tpl_v, v_prt || ' — ' || v_setor_label, v_chefe, false, v_created);

    -- Custom field values (frozen snapshot from the template defs).
    insert into public.case_custom_field_values (case_id, template_field_id, key, label, field_type, options, value, position)
    select v_case, d.id, d.key, d.label, d.field_type, d.options,
      case d.key
        when 'numero_prontuario' then to_jsonb(v_prt)
        when 'setor'             then to_jsonb(v_setor)
        when 'data_alta'         then case when v_macro = 'completed' then to_jsonb(to_char(v_closed, 'YYYY-MM-DD')) else null end
      end, d.position
    from public.process_template_custom_fields d
    where d.template_version_id = v_tpl_v;

    -- Offered outcomes snapshot.
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case, id from public.case_outcomes where commission_id = v_comm;

    -- Phases.
    perform set_config('app.in_case_rpc', 'on', true);
    insert into public.case_phases
      (id, case_id, position, form_id, form_version_id, title, status, assigned_to,
       activated_at, completed_at, default_due_days, due_date, display_position)
    values
      (v_cp1, v_case, 1, v_r1f, v_r1v, 'Checklist Revisão de Prontuário', v_p1_status, v_assignee,
       v_p1_activated, v_p1_completed, 7, (v_created + interval '7 days')::date, 1);
    insert into public.case_phases
      (id, case_id, position, form_id, form_version_id, title, status, recommended, recommend_when,
       assigned_to, activated_at, completed_at, default_due_days, due_date, display_position)
    values
      (v_cp2, v_case, 2, v_r2f, v_r2v, 'Parecer do Comitê', v_p2_status, v_nonconf,
       jsonb_build_object('from_phase', 1, 'question_key', 'nao_conformidade_identificada', 'op', 'equals', 'value', 'sim'),
       case when v_macro in ('pending','completed') then v_chefe else null end,
       v_p2_activated, v_p2_completed, 14, (v_created + interval '21 days')::date, 2);
    perform set_config('app.in_case_rpc', 'off', true);

    -- Responses. Heroes get full submitted responses on completed phases; the
    -- in_review hero gets a partial in_progress draft on its active Fase 1.
    if v_hero and v_p1_status = 'completed' then
      v_resp := gen_random_uuid();
      perform set_config('app.in_submit_rpc', 'on', true);
      insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, updated_at, submitted_at)
      values (v_resp, v_r1v, v_comm, v_assignee, 'submitted', v_cp1, v_p1_activated, v_p1_completed, v_p1_completed);
      perform app.fill_r1(v_resp, v_r1v, v_seq, v_nonconf);
      perform set_config('app.in_submit_rpc', 'off', true);
      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases set current_response_id = v_resp where id = v_cp1;
      perform set_config('app.in_case_rpc', 'off', true);
    end if;

    if v_hero and v_p2_status = 'completed' then
      v_resp := gen_random_uuid();
      perform set_config('app.in_submit_rpc', 'on', true);
      insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, updated_at, submitted_at)
      values (v_resp, v_r2v, v_comm, v_chefe, 'submitted', v_cp2, v_p2_activated, v_p2_completed, v_p2_completed);
      perform app.fill_r2(v_resp, v_r2v, coalesce(v_outcome, 'conforme'));
      perform set_config('app.in_submit_rpc', 'off', true);
      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases set current_response_id = v_resp where id = v_cp2;
      perform set_config('app.in_case_rpc', 'off', true);
    end if;

    if v_hero and v_macro = 'in_review' then
      v_resp := gen_random_uuid();
      insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, last_section_id, started_at, updated_at)
      values (v_resp, v_r1v, v_comm, v_assignee, 'in_progress', v_cp1,
              (select id from public.form_sections where form_version_id = v_r1v and title = 'Registros clínicos'),
              v_p1_activated, now());
      perform app.seed_pick(v_resp, v_r1v, 'identificacao_completa', array['sim']);
      perform app.seed_pick(v_resp, v_r1v, 'tipo_internacao', array['uti']);
      perform app.seed_pick(v_resp, v_r1v, 'termo_internacao_assinado', array['sim']);
      perform app.seed_pick(v_resp, v_r1v, 'anamnese_presente', array['sim']);
      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases set current_response_id = v_resp where id = v_cp1;
      perform set_config('app.in_case_rpc', 'off', true);
    end if;

    -- Narratives on hero completed cases (inserted while the case is still open).
    if v_hero and v_macro = 'completed' then
      insert into public.case_narratives
        (case_id, narrative_type_id, type_label, display_position, is_expected, body_md, status, concluded_at, created_by, updated_by, concluded_by)
      values
        (v_case, 'd5000000-0000-0000-0000-0000000000d1', 'Resumo do Caso', 3, false,
         E'Revisão do prontuário ' || v_prt || ' (' || v_setor_label || '). '
         || 'Análise documental conduzida pela comissão, sem dados que identifiquem o paciente.',
         'completed', v_closed, v_chefe, v_chefe, v_chefe),
        (v_case, 'd5000000-0000-0000-0000-0000000000d2', 'Parecer do Comitê', 4, true,
         case v_outcome
           when 'nao_conforme' then E'O comitê concluiu pela **não conformidade** do registro e determinou plano de ação corretiva com reauditoria.'
           when 'ressalvas'    then E'O comitê concluiu pela conformidade **com ressalvas**, orientando melhorias pontuais no registro.'
           else E'O comitê concluiu pela **conformidade** do prontuário revisado.'
         end,
         'completed', v_closed, v_chefe, v_chefe, v_chefe);
    end if;

    -- Close terminal cases (sets outcome + closed_at; recompute early-returns).
    if v_macro in ('completed', 'cancelled') then
      perform set_config('app.in_case_rpc', 'on', true);
      update public.cases
        set status = v_macro, closed_at = v_closed, closed_by = v_chefe,
            outcome_id = case when v_macro = 'completed' then v_outcome_id else null end
      where id = v_case;
      perform set_config('app.in_case_rpc', 'off', true);
    end if;
  end loop;
end;
$cases$;

-- ===========================================================================
-- MEETINGS (6) — every status + modality, with quorum, attendees (present /
-- absent / excused / summoned), agenda items, minutes and case links. Direct
-- inserts (the lifecycle guards are UPDATE/DELETE-only). meeting_number is minted
-- by trigger. Meeting types (Ordinária / Extraordinária) were auto-provisioned.
-- ===========================================================================
do $mtg$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_e1 uuid := 'd5000000-0000-0000-0000-0000000000e1';  -- Presidente
  v_e3 uuid := 'd5000000-0000-0000-0000-0000000000e3';  -- Secretária
  v_e6 uuid := 'd5000000-0000-0000-0000-0000000000e6';
  v_e7 uuid := 'd5000000-0000-0000-0000-0000000000e7';
  v_e8 uuid := 'd5000000-0000-0000-0000-0000000000e8';
  v_ord uuid := (select id from public.commission_meeting_types where commission_id = 'd5000000-0000-0000-0000-000000000003' and name = 'Ordinária');
  v_ext uuid := (select id from public.commission_meeting_types where commission_id = 'd5000000-0000-0000-0000-000000000003' and name = 'Extraordinária');
  v_m1 uuid := 'd5000000-0000-0000-0000-000000009001';
  v_m2 uuid := 'd5000000-0000-0000-0000-000000009002';
  v_m3 uuid := 'd5000000-0000-0000-0000-000000009003';
  v_m4 uuid := 'd5000000-0000-0000-0000-000000009004';
  v_m5 uuid := 'd5000000-0000-0000-0000-000000009005';
  v_m6 uuid := 'd5000000-0000-0000-0000-000000009006';
  v_ag1 uuid := gen_random_uuid();  -- M1 agenda "Casos revisados"
  v_ag2 uuid := gen_random_uuid();  -- M1 agenda "Indicadores"
  v_ag4 uuid := gen_random_uuid();  -- M4 agenda "Caso não conforme"
begin
  -- === M1 — Ordinária Março/2026 — DISTRIBUÍDA (presencial) =================
  -- Content-locked states (in_signature+) reject child inserts, so the meeting is
  -- created 'held', its children added, then the status is walked forward through
  -- the valid transitions under app.in_meeting_rpc (mirrors the meeting RPCs).
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, location_text,
     minutes_md, quorum_met, quorum_rule_type, present_count, eligible_member_count, held_at, held_end, created_by)
  values
    (v_m1, v_comm, v_ord, 'Reunião Ordinária — Março/2026', 'held',
     '2026-03-12 14:00-03', '2026-03-12 15:30-03', 'presencial', 'Sala de reuniões da Diretoria Clínica',
     E'## Ata — Reunião Ordinária de Março/2026\n\nRevisão dos prontuários do mês e acompanhamento das ações. Quórum atingido. **Sem dados de paciente.**',
     true, 'maioria_simples', 7, 8, '2026-03-12 14:00-03', '2026-03-12 15:30-03', v_e1);
  insert into public.meeting_agenda_items (id, meeting_id, position, title, description, discussion_notes, resolution, created_by) values
    (v_ag1, v_m1, 1, 'Prontuários revisados no mês', 'Apresentação dos prontuários revisados.',
     'Discutidos os casos com não conformidade documental.', 'Encaminhar feedback aos setores envolvidos.', v_e1),
    (v_ag2, v_m1, 2, 'Indicadores de conformidade', 'Taxa de conformidade e pendências.',
     'Taxa de conformidade em elevação frente ao mês anterior.', 'Manter meta de 90% de conformidade.', v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m1, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end,
    case m.principal_id when v_e7 then 'excused' else 'present' end
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision) values
    (v_m1, 'd5000000-0000-0000-0000-00000000c001', v_ag1, 'Prontuário conforme, revisão concluída.', 'Arquivar.'),
    (v_m1, 'd5000000-0000-0000-0000-00000000c002', v_ag1, 'Conforme com ressalvas — orientar registro.', 'Enviar feedback ao profissional.');
  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set status = 'in_signature', concluded_at = '2026-03-12 15:40-03' where id = v_m1;
  update public.meetings set status = 'signed' where id = v_m1;
  update public.meetings set status = 'distributed', distributed_at = '2026-03-13 09:00-03' where id = v_m1;
  perform set_config('app.in_meeting_rpc', 'off', true);

  -- === M2 — Ordinária Abril/2026 — ASSINADA (híbrido) ======================
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, location_text, meeting_url,
     minutes_md, quorum_met, quorum_rule_type, present_count, eligible_member_count, held_at, held_end, created_by)
  values
    (v_m2, v_comm, v_ord, 'Reunião Ordinária — Abril/2026', 'held',
     '2026-04-16 14:00-03', '2026-04-16 15:20-03', 'hibrido', 'Sala de reuniões / videoconferência', 'https://meet.example.com/crp-abril',
     E'## Ata — Reunião Ordinária de Abril/2026\n\nConsolidação dos indicadores do trimestre e revisão das ações pendentes.',
     true, 'maioria_simples', 6, 8, '2026-04-16 14:00-03', '2026-04-16 15:20-03', v_e1);
  insert into public.meeting_agenda_items (meeting_id, position, title, description, discussion_notes, resolution, created_by) values
    (v_m2, 1, 'Consolidação de indicadores do 1º trimestre', 'Fechamento trimestral.',
     'Indicadores dentro do esperado; uma meta ainda abaixo do alvo.', 'Elaborar plano para o indicador fora da meta.', v_e1),
    (v_m2, 2, 'Ações pendentes', 'Acompanhamento das ações em aberto.', null, null, v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m2, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end,
    case m.principal_id when v_e8 then 'absent' when v_e6 then 'excused' else 'present' end
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');
  insert into public.meeting_cases (meeting_id, case_id, summary, decision) values
    (v_m2, 'd5000000-0000-0000-0000-00000000c004', 'Prontuário conforme.', 'Arquivar.');
  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set status = 'in_signature', concluded_at = '2026-04-16 15:30-03' where id = v_m2;
  update public.meetings set status = 'signed' where id = v_m2;
  perform set_config('app.in_meeting_rpc', 'off', true);

  -- === M3 — Ordinária Maio/2026 — REALIZADA (remoto, ata em elaboração) =====
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, meeting_url,
     minutes_md, quorum_met, quorum_rule_type, present_count, eligible_member_count, held_at, held_end, created_by)
  values
    (v_m3, v_comm, v_ord, 'Reunião Ordinária — Maio/2026', 'held',
     '2026-05-14 14:00-03', '2026-05-14 15:00-03', 'remoto', 'https://meet.example.com/crp-maio',
     E'## Ata (rascunho) — Maio/2026\n\nPauta discutida; ata em elaboração pela secretaria.',
     true, 'maioria_simples', 8, 8, '2026-05-14 14:00-03', '2026-05-14 15:00-03', v_e1);
  insert into public.meeting_agenda_items (meeting_id, position, title, description, discussion_notes, resolution, created_by) values
    (v_m3, 1, 'Revisão de prontuários de alta complexidade', 'Casos de UTI e cirúrgicos.',
     'Revisados os prontuários encaminhados pela auditoria.', 'Manter fluxo de revisão semanal.', v_e1),
    (v_m3, 2, 'Atualização do checklist', 'Proposta de revisão do checklist.', null, null, v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m3, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end, 'present'
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');
  insert into public.meeting_cases (meeting_id, case_id, summary, decision) values
    (v_m3, 'd5000000-0000-0000-0000-00000000c007', 'Caso em andamento — parecer do comitê pendente.', 'Aguardar parecer.'),
    (v_m3, 'd5000000-0000-0000-0000-00000000c009', 'Caso em andamento.', 'Reavaliar na próxima reunião.');

  -- === M4 — Extraordinária Junho/2026 — REALIZADA (não conformidade) =========
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, location_text,
     minutes_md, quorum_met, quorum_rule_type, present_count, eligible_member_count, held_at, held_end, created_by)
  values
    (v_m4, v_comm, v_ext, 'Reunião Extraordinária — Análise de Não Conformidade', 'held',
     '2026-06-25 16:00-03', '2026-06-25 17:00-03', 'presencial', 'Sala de reuniões da Diretoria Clínica',
     E'## Ata — Reunião Extraordinária\n\nAnálise de prontuário classificado como **não conforme** e definição de plano de ação corretiva.',
     true, 'maioria_simples', 5, 8, '2026-06-25 16:00-03', '2026-06-25 17:00-03', v_e1);
  insert into public.meeting_agenda_items (id, meeting_id, position, title, description, discussion_notes, resolution, created_by) values
    (v_ag4, v_m4, 1, 'Prontuário não conforme — UTI', 'Análise do caso e plano de ação.',
     'Identificadas falhas de registro com risco assistencial.', 'Abrir plano de ação corretiva e reauditoria.', v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m4, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end,
    case m.principal_id when v_e6 then 'absent' when v_e7 then 'absent' when v_e8 then 'excused' else 'present' end
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision) values
    (v_m4, 'd5000000-0000-0000-0000-00000000c003', v_ag4, 'Prontuário não conforme — plano de ação definido.', 'Abrir ação corretiva com reauditoria.');

  -- === M5 — Ordinária Agosto/2026 — AGENDADA (híbrido, futura) ==============
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, location_text, meeting_url, created_by)
  values
    (v_m5, v_comm, v_ord, 'Reunião Ordinária — Agosto/2026', 'scheduled',
     '2026-08-13 14:00-03', '2026-08-13 15:30-03', 'hibrido', 'Sala de reuniões / videoconferência', 'https://meet.example.com/crp-agosto', v_e1);
  insert into public.meeting_agenda_items (meeting_id, position, title, description, created_by) values
    (v_m5, 1, 'Revisão mensal de prontuários', 'Prontuários selecionados pela amostragem.', v_e1),
    (v_m5, 2, 'Acompanhamento do plano de ação', 'Status das ações corretivas.', v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m5, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end, 'summoned'
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');

  -- === M6 — Ordinária Setembro/2026 — AGENDADA (presencial, futura) =========
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end, modality, location_text, created_by)
  values
    (v_m6, v_comm, v_ord, 'Reunião Ordinária — Setembro/2026', 'scheduled',
     '2026-09-10 14:00-03', '2026-09-10 15:30-03', 'presencial', 'Sala de reuniões da Diretoria Clínica', v_e1);
  insert into public.meeting_agenda_items (meeting_id, position, title, description, created_by) values
    (v_m6, 1, 'Revisão mensal de prontuários', 'Prontuários selecionados pela amostragem.', v_e1);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select v_m6, m.principal_id,
    case m.principal_id when v_e1 then 'presidente' when v_e3 then 'secretario' else 'membro' end, 'summoned'
  from public.memberships m where m.commission_id = v_comm and m.role in ('staff_admin','staff');
end;
$mtg$;

-- ===========================================================================
-- ACTION ITEMS — concluded / open / overdue / in-progress / cancelled, sourced
-- from meetings, cases and manual entry. Statuses + urgencies resolve to the
-- shared (global) vocabularies.
-- ===========================================================================
do $ai$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_e1 uuid := 'd5000000-0000-0000-0000-0000000000e1';
  v_e2 uuid := 'd5000000-0000-0000-0000-0000000000e2';
  v_e4 uuid := 'd5000000-0000-0000-0000-0000000000e4';
  v_e5 uuid := 'd5000000-0000-0000-0000-0000000000e5';
  v_e6 uuid := 'd5000000-0000-0000-0000-0000000000e6';
  v_e7 uuid := 'd5000000-0000-0000-0000-0000000000e7';
  v_e8 uuid := 'd5000000-0000-0000-0000-0000000000e8';
  v_m1 uuid := 'd5000000-0000-0000-0000-000000009001';
  v_m2 uuid := 'd5000000-0000-0000-0000-000000009002';
  st_open uuid := (select id from public.action_item_statuses where key = 'open'        and commission_id is null);
  st_prog uuid := (select id from public.action_item_statuses where key = 'in_progress' and commission_id is null);
  st_done uuid := (select id from public.action_item_statuses where key = 'done'        and commission_id is null);
  st_canc uuid := (select id from public.action_item_statuses where key = 'cancelled'   and commission_id is null);
  ur_low  uuid := (select id from public.action_item_urgency_levels where key = 'low'      and commission_id is null);
  ur_norm uuid := (select id from public.action_item_urgency_levels where key = 'normal'   and commission_id is null);
  ur_high uuid := (select id from public.action_item_urgency_levels where key = 'high'     and commission_id is null);
  ur_crit uuid := (select id from public.action_item_urgency_levels where key = 'critical' and commission_id is null);
begin
  -- 1) Meeting-sourced, CONCLUÍDA.
  insert into public.action_items (commission_id, source_type, source_meeting_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, completed_at, completed_by, created_at)
  values (v_comm, 'meeting', v_m1, 'Padronizar carimbo e assinatura nos prontuários',
    'Revisar o padrão de identificação do profissional em todas as folhas.',
    st_done, ur_norm, current_date - 20, v_e4, v_e1, now() - interval '18 days', v_e4, now() - interval '40 days');

  -- 2) Meeting-sourced, EM ABERTO e ATRASADA.
  insert into public.action_items (commission_id, source_type, source_meeting_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, created_at)
  values (v_comm, 'meeting', v_m1, 'Elaborar treinamento sobre resumo de alta',
    'Preparar material e agenda de capacitação sobre preenchimento do resumo de alta.',
    st_open, ur_high, current_date - 5, v_e5, v_e1, now() - interval '40 days');

  -- 3) Case-sourced (não conforme), EM ANDAMENTO, CRÍTICA.
  insert into public.action_items (commission_id, source_type, source_case_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, visibility_scope, created_at)
  values (v_comm, 'case', 'd5000000-0000-0000-0000-00000000c003',
    'Plano de ação corretiva — prontuário não conforme (UTI)',
    'Executar as ações corretivas definidas na reunião extraordinária e agendar reauditoria.',
    st_prog, ur_crit, current_date + 10, v_e2, v_e1, 'case_restricted', now() - interval '26 days');

  -- 4) Case-sourced, CONCLUÍDA.
  insert into public.action_items (commission_id, source_type, source_case_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, completed_at, completed_by, created_at)
  values (v_comm, 'case', 'd5000000-0000-0000-0000-00000000c005',
    'Feedback ao médico assistente', 'Registrar devolutiva ao profissional sobre as ressalvas identificadas.',
    st_done, ur_norm, current_date - 12, v_e1, v_e1, now() - interval '10 days', v_e1, now() - interval '28 days');

  -- 5) Manual, EM ABERTO.
  insert into public.action_items (commission_id, source_type, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, created_at)
  values (v_comm, 'manual', 'Revisar o checklist de revisão de prontuário',
    'Propor atualização do checklist com base nas não conformidades recorrentes.',
    st_open, ur_norm, current_date + 21, v_e1, v_e1, now() - interval '6 days');

  -- 6) Meeting-sourced, CONCLUÍDA.
  insert into public.action_items (commission_id, source_type, source_meeting_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, completed_at, completed_by, created_at)
  values (v_comm, 'meeting', v_m2, 'Consolidar indicadores do trimestre',
    'Fechar os indicadores do 1º trimestre e publicar no painel.',
    st_done, ur_low, current_date - 30, v_e8, v_e1, now() - interval '28 days', v_e8, now() - interval '45 days');

  -- 7) Case-sourced, EM ABERTO.
  insert into public.action_items (commission_id, source_type, source_case_id, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, created_at)
  values (v_comm, 'case', 'd5000000-0000-0000-0000-00000000c001',
    'Anexar termo de consentimento ao prontuário', 'Solicitar ao setor a digitalização do termo faltante.',
    st_open, ur_norm, current_date + 7, v_e6, v_e1, now() - interval '9 days');

  -- 8) Manual, EM ANDAMENTO.
  insert into public.action_items (commission_id, source_type, title, description,
    status_id, urgency_id, due_date, assigned_to, created_by, created_at)
  values (v_comm, 'manual', 'Atualizar o POP de revisão de prontuário de óbito',
    'Revisar o procedimento operacional padrão e submeter à aprovação.',
    st_prog, ur_high, current_date + 14, v_e7, v_e1, now() - interval '15 days');

  -- 9) Meeting-sourced, CANCELADA.
  insert into public.action_items (commission_id, source_type, source_meeting_id, title, description,
    status_id, urgency_id, assigned_to, created_by, created_at)
  values (v_comm, 'meeting', v_m1, 'Solicitar parecer jurídico',
    'Consulta ao setor jurídico — considerada desnecessária após reavaliação.',
    st_canc, ur_low, v_e2, v_e1, now() - interval '35 days');
end;
$ai$;

-- ===========================================================================
-- CONTROLLED DOCUMENTS (6) — draft / in_approval / changes_requested / effective
-- / obsolete, with version history + approvals. The Regimento (bylaws) is the
-- committee Charter's controlled document. storage_path is NULL on purpose
-- (a SQL seed cannot place real object bytes; signature_hash is computed over the
-- empty path, self-consistently — same convention as supabase/seed.sql).
-- ===========================================================================
do $docs$
declare
  v_comm  uuid := 'd5000000-0000-0000-0000-000000000003';
  v_e1 uuid := 'd5000000-0000-0000-0000-0000000000e1';  -- coordinator / author
  v_e2 uuid := 'd5000000-0000-0000-0000-0000000000e2';
  v_e4 uuid := 'd5000000-0000-0000-0000-0000000000e4';
  v_d1 uuid := 'd5000000-0000-0000-0000-00000000d001';
  v_d2 uuid := 'd5000000-0000-0000-0000-00000000d002';
  v_d3 uuid := 'd5000000-0000-0000-0000-00000000d003';
  v_d4 uuid := 'd5000000-0000-0000-0000-00000000d004';
  v_d5 uuid := 'd5000000-0000-0000-0000-00000000d005';
  v_d6 uuid := 'd5000000-0000-0000-0000-00000000d006';
  v_v1 uuid; v_v2 uuid;
  function_sig text;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_e1, 'role', 'authenticated')::text, true);
  perform set_config('app.in_controlled_docs_rpc', 'on', true);

  -- D1 — Regimento Interno (bylaws): v1 obsolete (superseded) + v2 effective.
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, review_cycle_months, status, created_by)
  values (v_d1, v_comm, 'REG-0001', 'Regimento Interno da Comissão de Revisão de Prontuário', 'bylaws',
          'Documento constitutivo da comissão: composição, competências e funcionamento.', 24, 'effective', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, effective_date, review_due_date, status, obsolete_kind, created_by)
  values (v_d1, 1, null, 'Versão inicial do regimento.', date '2024-02-01', date '2026-02-01', 'obsolete', 'superseded', v_e1)
  returning id into v_v1;
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, effective_date, review_due_date, status, created_by)
  values (v_d1, 2, null, 'Revisão bienal: atualização de competências e da periodicidade das reuniões.', date '2026-02-15', date '2028-02-15', 'effective', v_e1)
  returning id into v_v2;
  update public.controlled_documents set current_version_id = v_v2 where id = v_d1;
  insert into public.document_approvals (document_version_id, approver_id, approver_title, decision, decided_at, signature_hash) values
    (v_v2, v_e1, 'Presidente da Comissão', 'approved', '2026-02-14 10:00-03', encode(extensions.digest('' || ':' || v_e1::text || ':approved', 'sha256'), 'hex')),
    (v_v2, v_e2, 'Vice-Presidente',        'approved', '2026-02-14 11:00-03', encode(extensions.digest('' || ':' || v_e2::text || ':approved', 'sha256'), 'hex'));

  -- D2 — Política de Revisão de Prontuários (policy): effective, review due ahead.
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, review_cycle_months, status, created_by)
  values (v_d2, v_comm, 'POL-0001', 'Política de Revisão de Prontuários', 'policy',
          'Diretrizes gerais para a revisão da qualidade dos registros do prontuário.', 12, 'effective', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, effective_date, review_due_date, status, created_by)
  values (v_d2, 1, null, 'Versão inicial da política.', date '2026-01-10', date '2027-01-10', 'effective', v_e1)
  returning id into v_v1;
  update public.controlled_documents set current_version_id = v_v1 where id = v_d2;
  insert into public.document_approvals (document_version_id, approver_id, approver_title, decision, decided_at, signature_hash) values
    (v_v1, v_e1, 'Presidente da Comissão', 'approved', '2026-01-09 09:00-03', encode(extensions.digest('' || ':' || v_e1::text || ':approved', 'sha256'), 'hex'));

  -- D3 — POP de Revisão de Óbito (sop): effective, review OVERDUE (surfaces in the review-due list).
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, review_cycle_months, status, created_by)
  values (v_d3, v_comm, 'POP-0001', 'POP — Revisão de Prontuário de Óbito', 'sop',
          'Procedimento operacional padrão para a revisão de prontuários de pacientes que evoluíram a óbito.', 12, 'effective', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, effective_date, review_due_date, status, created_by)
  values (v_d3, 1, null, 'Versão inicial do POP.', date '2025-05-01', date '2026-05-01', 'effective', v_e1)
  returning id into v_v1;
  update public.controlled_documents set current_version_id = v_v1 where id = v_d3;
  insert into public.document_approvals (document_version_id, approver_id, approver_title, decision, decided_at, signature_hash) values
    (v_v1, v_e1, 'Presidente da Comissão', 'approved', '2025-04-30 15:00-03', encode(extensions.digest('' || ':' || v_e1::text || ':approved', 'sha256'), 'hex'));

  -- D4 — Protocolo de Auditoria Mensal (protocol): EM APROVAÇÃO (approvers pending).
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, review_cycle_months, status, created_by)
  values (v_d4, v_comm, 'PRT-0001', 'Protocolo de Auditoria Mensal de Prontuários', 'protocol',
          'Protocolo de amostragem e auditoria mensal dos prontuários.', 24, 'in_approval', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, status, created_by)
  values (v_d4, 1, null, 'Primeira versão submetida à aprovação.', 'in_approval', v_e1)
  returning id into v_v1;
  update public.controlled_documents set current_version_id = v_v1 where id = v_d4;
  insert into public.document_approvals (document_version_id, approver_id, approver_title) values
    (v_v1, v_e2, 'Vice-Presidente'),
    (v_v1, v_e4, 'Membro Efetivo');

  -- D5 — Manual de Preenchimento (manual): RASCUNHO.
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, status, created_by)
  values (v_d5, v_comm, 'MAN-0001', 'Manual de Preenchimento do Prontuário', 'manual',
          'Orientações práticas para o correto preenchimento do prontuário do paciente.', 'draft', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, status, created_by)
  values (v_d5, 1, null, 'Rascunho inicial em elaboração.', 'draft', v_e1)
  returning id into v_v1;
  update public.controlled_documents set current_version_id = v_v1 where id = v_d5;

  -- D6 — POP de Registro de Alta (sop): ALTERAÇÕES SOLICITADAS (approver rejected).
  insert into public.controlled_documents (id, commission_id, code, title, doc_type, description, review_cycle_months, status, created_by)
  values (v_d6, v_comm, 'POP-0002', 'POP — Registro de Alta Hospitalar', 'sop',
          'Procedimento para o registro do resumo/relatório de alta no prontuário.', 12, 'changes_requested', v_e1);
  insert into public.controlled_document_versions (document_id, version_number, storage_path, summary_of_changes_md, status, created_by)
  values (v_d6, 1, null, 'Versão submetida; ajustes solicitados pela revisão.', 'changes_requested', v_e1)
  returning id into v_v1;
  update public.controlled_documents set current_version_id = v_v1 where id = v_d6;
  insert into public.document_approvals (document_version_id, approver_id, approver_title, decision, decided_at, note, signature_hash) values
    (v_v1, v_e2, 'Vice-Presidente', 'rejected', '2026-06-20 14:00-03',
     'Incluir o fluxo de conferência do resumo de alta antes da liberação do paciente.',
     encode(extensions.digest('' || ':' || v_e2::text || ':rejected', 'sha256'), 'hex'));

  perform set_config('app.in_controlled_docs_rpc', 'off', true);
  perform set_config('request.jwt.claims', '', true);
end;
$docs$;

-- ---------------------------------------------------------------------------
-- Committee Charter (Regimento + meeting cadence). Links the cadence to the
-- effective Regimento controlled document (D1).
-- ---------------------------------------------------------------------------
insert into public.commission_charters (commission_id, meeting_frequency, controlled_document_id, created_by)
values ('d5000000-0000-0000-0000-000000000003', 'mensal', 'd5000000-0000-0000-0000-00000000d001',
        'd5000000-0000-0000-0000-0000000000e1');

-- ===========================================================================
-- QUALITY INDICATORS (2) with monthly measurements (dashboard). Manual data
-- source (derived_config NULL). One percentage indicator (higher-is-better) and
-- one count indicator (lower-is-better).
-- ===========================================================================
do $ind$
declare
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_e1 uuid := 'd5000000-0000-0000-0000-0000000000e1';
  v_i1 uuid := 'd5000000-0000-0000-0000-000000009101';
  v_i2 uuid := 'd5000000-0000-0000-0000-000000009102';
begin
  insert into public.indicators (id, commission_id, code, name, description_md, kind,
    numerator_label, denominator_label, unit, direction, target_value, target_comparator,
    frequency, data_source, status, created_by)
  values
    (v_i1, v_comm, 'IND-0001', 'Taxa de conformidade na revisão de prontuários',
     'Percentual de prontuários revisados classificados como conformes.', 'percentual',
     'Prontuários conformes', 'Prontuários revisados', '%', 'maior_melhor', 90, '>=',
     'mensal', 'manual', 'active', v_e1);
  insert into public.indicator_measurements (indicator_id, period_label, period_start, period_end, numerator, denominator, value, status, source, entered_by) values
    (v_i1, 'Março/2026',   date '2026-03-01', date '2026-03-31', 41, 50, 82, 'off_target', 'manual', v_e1),
    (v_i1, 'Abril/2026',   date '2026-04-01', date '2026-04-30', 44, 50, 88, 'off_target', 'manual', v_e1),
    (v_i1, 'Maio/2026',    date '2026-05-01', date '2026-05-31', 46, 50, 92, 'on_target',  'manual', v_e1),
    (v_i1, 'Junho/2026',   date '2026-06-01', date '2026-06-30', 47, 50, 94, 'on_target',  'manual', v_e1);

  insert into public.indicators (id, commission_id, code, name, description_md, kind,
    numerator_label, unit, direction, target_value, target_comparator,
    frequency, data_source, status, created_by)
  values
    (v_i2, v_comm, 'IND-0002', 'Prontuários pendentes de revisão',
     'Número de prontuários aguardando revisão ao final do mês.', 'contagem',
     'Prontuários pendentes', 'prontuários', 'menor_melhor', 10, '<=',
     'mensal', 'manual', 'active', v_e1);
  insert into public.indicator_measurements (indicator_id, period_label, period_start, period_end, numerator, value, status, source, entered_by) values
    (v_i2, 'Março/2026',   date '2026-03-01', date '2026-03-31', 18, 18, 'off_target', 'manual', v_e1),
    (v_i2, 'Abril/2026',   date '2026-04-01', date '2026-04-30', 14, 14, 'off_target', 'manual', v_e1),
    (v_i2, 'Maio/2026',    date '2026-05-01', date '2026-05-31', 11, 11, 'off_target', 'manual', v_e1),
    (v_i2, 'Junho/2026',   date '2026-06-01', date '2026-06-30',  8,  8, 'on_target',  'manual', v_e1);
end;
$ind$;

-- ---------------------------------------------------------------------------
-- Drop the seed helpers.
-- ---------------------------------------------------------------------------
drop function if exists app.seed_opts(uuid, text, text[], text[]);
drop function if exists app.seed_pick(uuid, uuid, text, text[]);
drop function if exists app.seed_scalar(uuid, uuid, text, jsonb);
drop function if exists app.fill_r1(uuid, uuid, int, boolean);
drop function if exists app.fill_r2(uuid, uuid, text);

-- ===========================================================================
-- Fim do seed de demonstração — "Comissão de Revisão de Prontuário".
-- ===========================================================================
