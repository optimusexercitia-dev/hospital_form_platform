-- Local dev / E2E seed. Idempotent enough to survive `npx supabase db reset`
-- (reset recreates the DB, then runs migrations, then this file once).
--
-- Content rules: all user-facing strings are pt-BR; questions are
-- compliance-checklist style. NO patient data of any kind. Identifiers and
-- comments are English.
--
-- Personas (password for ALL: Test1234!):
--   admin@test.local          global admin
--   chefe.ccih@test.local     staff_admin of commission A (CCIH)
--   staff1.ccih@test.local     staff of A
--   staff2.ccih@test.local     staff of A
--   chefe.farm@test.local     staff_admin of commission B (Farmácia e Terapêutica)
--   staff1.farm@test.local     staff of B
--   staff2.farm@test.local     staff of B
--   multi@test.local          staff of BOTH A and B (exercises the commission picker)

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Auth users. We insert directly into auth.users; the on_auth_user_created
-- trigger creates the matching profiles row. We then patch full_name/is_admin.
-- A confirmed email + bcrypt password lets these users log in locally.
-- ---------------------------------------------------------------------------
do $$
declare
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'email', 'admin@test.local',       'name', 'Administradora Geral'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000002', 'email', 'chefe.ccih@test.local',  'name', 'Chefe CCIH'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000003', 'email', 'staff1.ccih@test.local', 'name', 'Enfermeiro CCIH Um'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000004', 'email', 'staff2.ccih@test.local', 'name', 'Enfermeira CCIH Dois'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000005', 'email', 'chefe.farm@test.local',  'name', 'Chefe Farmácia'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000006', 'email', 'staff1.farm@test.local', 'name', 'Farmacêutico Um'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000007', 'email', 'staff2.farm@test.local', 'name', 'Farmacêutica Dois'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000000008', 'email', 'multi@test.local',       'name', 'Coordenadora Multi')
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
      crypt('Test1234!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u ->> 'name'),
      now(), now(), '', '', '', ''
    );

    -- An identities row is required for email/password sign-in to resolve.
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      (u ->> 'id'),
      (u ->> 'id')::uuid,
      jsonb_build_object('sub', u ->> 'id', 'email', u ->> 'email'),
      'email',
      now(), now(), now()
    );

    -- Patch the trigger-created profile.
    update public.profiles
    set full_name = u ->> 'name'
    where id = (u ->> 'id')::uuid;
  end loop;

  update public.profiles set is_admin = true
  where id = '00000000-0000-0000-0000-000000000001';
end $$;

-- ---------------------------------------------------------------------------
-- Commissions + memberships
-- ---------------------------------------------------------------------------
insert into public.commissions (id, name, slug, created_by) values
  ('a0000000-0000-0000-0000-0000000000a1', 'Comissão de Controle de Infecção Hospitalar', 'ccih', '00000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-0000000000b1', 'Comissão de Farmácia e Terapêutica',          'farmacia', '00000000-0000-0000-0000-000000000001');

insert into public.commission_members (commission_id, user_id, role) values
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'staff_admin'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'staff'),
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000004', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000005', 'staff_admin'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000006', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000007', 'staff'),
  -- multi@test.local: plain staff of BOTH commissions, so the commission picker
  -- is E2E-testable (a single user with >1 membership). Kept as staff in both to
  -- avoid introducing a second staff_admin into either commission.
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000008', 'staff'),
  ('b0000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000008', 'staff');

-- ===========================================================================
-- FORM A (commission CCIH): UNSECTIONED — default section only.
-- All four input types (>=2 with question_explanation) + one section_text +
-- one image display block. Built as a draft, then published via the RPC.
-- ===========================================================================
do $$
declare
  v_form_id uuid := 'f0000000-0000-0000-0000-00000000a001';
  v_version_id uuid := '50000000-0000-0000-0000-00000000a001';
  v_section_id uuid := 'c0000000-0000-0000-0000-00000000a001';
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form_id, 'a0000000-0000-0000-0000-0000000000a1',
          'Checklist de Higienização das Mãos',
          'Verificação rápida de adesão às práticas de higienização das mãos na unidade.',
          '00000000-0000-0000-0000-000000000002');

  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_version_id, v_form_id, 1, 'draft', '00000000-0000-0000-0000-000000000002');

  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (v_section_id, v_version_id, 0, null, true);

  -- position 0: display section_text (intro)
  insert into public.form_items (section_id, position, item_type, content)
  values (v_section_id, 0, 'section_text',
          jsonb_build_object('markdown',
            '## Higienização das mãos\nResponda com base na observação da unidade no momento da auditoria.'));

  -- position 1: multiple_choice (with explanation)
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, options, required)
  values (v_section_id, 1, 'multiple_choice', 'dispensador_disponivel',
          'Há dispensador de álcool em gel disponível e abastecido no ponto de atendimento?',
          'Considere abastecido quando há volume suficiente para uso imediato.',
          '["Sim", "Não", "Parcialmente"]'::jsonb, true);

  -- position 2: dropdown
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
  values (v_section_id, 2, 'dropdown', 'turno_auditoria',
          'Turno em que a auditoria foi realizada',
          '["Manhã", "Tarde", "Noite"]'::jsonb, true);

  -- position 3: checkbox (with explanation)
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, options, required)
  values (v_section_id, 3, 'checkbox', 'epis_observados',
          'Quais EPIs estavam disponíveis no momento da observação?',
          'Marque todos os itens observados na unidade.',
          '["Luvas", "Avental", "Máscara", "Touca"]'::jsonb, false);

  -- position 4: image display block
  insert into public.form_items (section_id, position, item_type, content)
  values (v_section_id, 4, 'image',
          jsonb_build_object(
            'storage_path', 'a0000000-0000-0000-0000-0000000000a1/exemplo-cartaz-higienizacao.png',
            'alt', 'Cartaz dos cinco momentos da higienização das mãos',
            'caption', 'Referência: cinco momentos para a higienização das mãos.'));

  -- position 5: free_text
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (v_section_id, 5, 'free_text', 'observacoes_gerais',
          'Observações gerais da auditoria', false);

  perform public.publish_form_version(v_version_id);
end $$;

-- ===========================================================================
-- FORM B (commission Farmácia): SECTIONED — 4 sections, one conditional,
-- one requires_signoff(respondent), one requires_signoff(staff_admin).
-- ===========================================================================
do $$
declare
  v_form_id uuid := 'f0000000-0000-0000-0000-00000000b001';
  v_version_id uuid := '50000000-0000-0000-0000-00000000b001';
  s_default uuid := 'c0000000-0000-0000-0000-00000000b000'; -- default (kept, position 0)
  s_armazenamento uuid := 'c0000000-0000-0000-0000-00000000b001';
  s_geladeira uuid := 'c0000000-0000-0000-0000-00000000b002'; -- conditional
  s_conformidade uuid := 'c0000000-0000-0000-0000-00000000b003'; -- respondent sign-off
  s_revisao uuid := 'c0000000-0000-0000-0000-00000000b004'; -- staff_admin sign-off
begin
  insert into public.forms (id, commission_id, title, description, created_by)
  values (v_form_id, 'b0000000-0000-0000-0000-0000000000b1',
          'Inspeção de Armazenamento de Medicamentos',
          'Roteiro de inspeção das condições de armazenamento na farmácia.',
          '00000000-0000-0000-0000-000000000005');

  insert into public.form_versions (id, form_id, version_number, status, created_by)
  values (v_version_id, v_form_id, 1, 'draft', '00000000-0000-0000-0000-000000000005');

  -- Default section (position 0) acts as an intro page here.
  insert into public.form_sections (id, form_version_id, position, title, is_default)
  values (s_default, v_version_id, 0, null, true);
  insert into public.form_items (section_id, position, item_type, content)
  values (s_default, 0, 'section_text',
          jsonb_build_object('markdown',
            '## Inspeção de armazenamento\nPreencha cada seção conforme a área inspecionada.'));

  -- Section 1: Armazenamento geral
  insert into public.form_sections (id, form_version_id, position, title, description)
  values (s_armazenamento, v_version_id, 1, 'Armazenamento geral',
          'Condições gerais do estoque.');
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
  values (s_armazenamento, 0, 'multiple_choice', 'organizacao_estoque',
          'O estoque está organizado e identificado conforme o procedimento?',
          '["Sim", "Não"]'::jsonb, true);
  insert into public.form_items (section_id, position, item_type, question_key, label, question_explanation, options, required)
  values (s_armazenamento, 1, 'multiple_choice', 'possui_termolabeis',
          'A unidade armazena medicamentos termolábeis (refrigerados)?',
          'Se sim, a seção de controle de temperatura será exibida.',
          '["Sim", "Não"]'::jsonb, true);

  -- Section 2 (CONDITIONAL): only when possui_termolabeis = 'Sim'
  insert into public.form_sections (id, form_version_id, position, title, description, visible_when)
  values (s_geladeira, v_version_id, 2, 'Controle de temperatura',
          'Aplicável apenas quando há medicamentos refrigerados.',
          jsonb_build_object('question_key', 'possui_termolabeis', 'op', 'equals', 'value', 'Sim'));
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
  values (s_geladeira, 0, 'multiple_choice', 'temperatura_na_faixa',
          'A temperatura da câmara/refrigerador está dentro da faixa de 2 °C a 8 °C?',
          '["Sim", "Não"]'::jsonb, true);
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (s_geladeira, 1, 'free_text', 'temperatura_registrada',
          'Temperatura registrada no momento da inspeção (°C)', false);

  -- Section 3 (respondent sign-off)
  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_conformidade, v_version_id, 3, 'Conformidade e validades',
          'Verificação de prazos de validade.', true, 'respondent');
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
  values (s_conformidade, 0, 'multiple_choice', 'sem_vencidos',
          'Não foram encontrados medicamentos vencidos no estoque?',
          '["Sim", "Não"]'::jsonb, true);

  -- Section 4 (staff_admin sign-off)
  insert into public.form_sections (id, form_version_id, position, title, description, requires_signoff, signoff_role)
  values (s_revisao, v_version_id, 4, 'Revisão da chefia',
          'Conferência final pela chefia da comissão.', true, 'staff_admin');
  insert into public.form_items (section_id, position, item_type, question_key, label, required)
  values (s_revisao, 0, 'free_text', 'parecer_chefia',
          'Parecer da chefia sobre a inspeção', false);

  perform public.publish_form_version(v_version_id);
end $$;

-- ===========================================================================
-- Responses. ~10 submitted across both forms + 1 in_progress. Inserted as
-- in_progress with answers, then flipped to submitted under the immutability
-- guard (seed runs as a superuser; the submit RPC's ownership check relies on
-- auth.uid(), so we drive the lifecycle directly and deterministically here).
-- ===========================================================================
do $$
declare
  -- Form A answerable items (by question_key)
  ia_disp uuid; ia_turno uuid; ia_epis uuid; ia_obs uuid;
  -- Form B answerable items
  ib_org uuid; ib_termo uuid; ib_temp uuid; ib_tempreg uuid; ib_venc uuid; ib_parecer uuid;
  v_resp uuid;
  v_form_a uuid := '50000000-0000-0000-0000-00000000a001';
  v_form_b uuid := '50000000-0000-0000-0000-00000000b001';
  v_comm_a uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_comm_b uuid := 'b0000000-0000-0000-0000-0000000000b1';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_staff_a2 uuid := '00000000-0000-0000-0000-000000000004';
  v_staff_b1 uuid := '00000000-0000-0000-0000-000000000006';
  v_staff_b2 uuid := '00000000-0000-0000-0000-000000000007';
  i integer;
begin
  select id into ia_disp  from public.form_items where form_version_id = v_form_a and question_key = 'dispensador_disponivel';
  select id into ia_turno from public.form_items where form_version_id = v_form_a and question_key = 'turno_auditoria';
  select id into ia_epis  from public.form_items where form_version_id = v_form_a and question_key = 'epis_observados';
  select id into ia_obs   from public.form_items where form_version_id = v_form_a and question_key = 'observacoes_gerais';

  select id into ib_org     from public.form_items where form_version_id = v_form_b and question_key = 'organizacao_estoque';
  select id into ib_termo   from public.form_items where form_version_id = v_form_b and question_key = 'possui_termolabeis';
  select id into ib_temp    from public.form_items where form_version_id = v_form_b and question_key = 'temperatura_na_faixa';
  select id into ib_tempreg from public.form_items where form_version_id = v_form_b and question_key = 'temperatura_registrada';
  select id into ib_venc    from public.form_items where form_version_id = v_form_b and question_key = 'sem_vencidos';
  select id into ib_parecer from public.form_items where form_version_id = v_form_b and question_key = 'parecer_chefia';

  perform set_config('app.in_submit_rpc', 'on', true);

  -- ----- Form A: 6 submitted responses (alternating staff, varied answers)
  for i in 1..6 loop
    v_resp := gen_random_uuid();
    insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, started_at)
    values (v_resp, v_form_a, v_comm_a,
            case when i % 2 = 0 then v_staff_a2 else v_staff_a1 end,
            'submitted', now() - (i || ' days')::interval, now() - (i || ' days')::interval);

    insert into public.answers (response_id, item_id, question_key, value) values
      (v_resp, ia_disp,  'dispensador_disponivel',
        to_jsonb((array['Sim','Não','Parcialmente'])[1 + (i % 3)])),
      (v_resp, ia_turno, 'turno_auditoria',
        to_jsonb((array['Manhã','Tarde','Noite'])[1 + (i % 3)])),
      (v_resp, ia_epis,  'epis_observados',
        case when i % 2 = 0 then '["Luvas","Avental"]'::jsonb else '["Luvas","Máscara","Touca"]'::jsonb end),
      (v_resp, ia_obs,   'observacoes_gerais',
        to_jsonb('Auditoria de rotina nº ' || i || '.'));
  end loop;

  -- ----- Form B: 4 submitted responses — 2 take the conditional branch
  -- (possui_termolabeis = 'Sim', answering the temperature section) and 2 do
  -- not (= 'Não', so that section is hidden and collects no answers).
  for i in 1..4 loop
    v_resp := gen_random_uuid();
    insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, started_at)
    values (v_resp, v_form_b, v_comm_b,
            case when i % 2 = 0 then v_staff_b2 else v_staff_b1 end,
            'submitted', now() - (i || ' days')::interval, now() - (i || ' days')::interval);

    insert into public.answers (response_id, item_id, question_key, value) values
      (v_resp, ib_org,   'organizacao_estoque', to_jsonb('Sim'::text)),
      (v_resp, ib_termo, 'possui_termolabeis',  to_jsonb(case when i <= 2 then 'Sim' else 'Não' end)),
      (v_resp, ib_venc,  'sem_vencidos',        to_jsonb('Sim'::text)),
      (v_resp, ib_parecer,'parecer_chefia',     to_jsonb('Inspeção dentro do esperado.'::text));

    -- Conditional-section answers only for the 'Sim' branch.
    if i <= 2 then
      insert into public.answers (response_id, item_id, question_key, value) values
        (v_resp, ib_temp,    'temperatura_na_faixa',  to_jsonb('Sim'::text)),
        (v_resp, ib_tempreg, 'temperatura_registrada', to_jsonb(('' || (4 + i) || ' °C'))::jsonb);
    end if;

    -- Both sign-off sections are visible here. Sign-off enforcement is OFF in
    -- Phase 1, but we seed sign-off rows so read-only views have data.
    insert into public.response_section_signoffs (response_id, section_id, signed_by)
    select v_resp, s.id,
           case when s.signoff_role = 'staff_admin' then '00000000-0000-0000-0000-000000000005'::uuid
                else (case when i % 2 = 0 then v_staff_b2 else v_staff_b1 end) end
    from public.form_sections s
    where s.form_version_id = v_form_b and s.requires_signoff;
  end loop;

  perform set_config('app.in_submit_rpc', 'off', true);

  -- ----- 1 in_progress response (Form A, staff1) with partial answers
  v_resp := gen_random_uuid();
  insert into public.responses (id, form_version_id, commission_id, created_by, status, last_section_id, started_at)
  values (v_resp, v_form_a, v_comm_a, v_staff_a1, 'in_progress',
          'c0000000-0000-0000-0000-00000000a001', now());
  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, ia_disp, 'dispensador_disponivel', to_jsonb('Sim'::text));
end $$;
