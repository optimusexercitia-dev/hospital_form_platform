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

  -- ----- 1 in_progress response (Form A, staff1) with partial answers. The
  -- Phase-5 wizard resume fixture — kept intact.
  v_resp := gen_random_uuid();
  insert into public.responses (id, form_version_id, commission_id, created_by, status, last_section_id, started_at)
  values (v_resp, v_form_a, v_comm_a, v_staff_a1, 'in_progress',
          'c0000000-0000-0000-0000-00000000a001', now());
  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, ia_disp, 'dispensador_disponivel', to_jsonb('Sim'::text));

  -- ----- Phase 6: 1 in_progress response on Form B (Farmácia) by staff1.farm,
  -- SUBMIT-READY and AWAITING the staff_admin sign-off, so the E2E exercises BOTH
  -- sign-off flows end-to-end:
  --   * the respondent section ("Conformidade e validades", respondent role) is
  --     already SIGNED by the respondent (staff1.farm);
  --   * the staff_admin section ("Revisão da chefia", staff_admin role) is
  --     UNSIGNED, so this response surfaces in chefe.farm's "pendentes de
  --     assinatura" queue and can be counter-signed then submitted.
  -- Deterministic id so specs can target it directly. Takes the 'Não' branch
  -- (possui_termolabeis='Não'), so the conditional temperature section is hidden
  -- and requires nothing — the response is fully submit-ready bar the staff_admin
  -- sign-off. last_section_id points at the staff_admin section (resume there).
  v_resp := 'e0000000-0000-0000-0000-0000000000e1';
  insert into public.responses (id, form_version_id, commission_id, created_by, status, last_section_id, started_at, updated_at)
  values (v_resp, v_form_b, v_comm_b, v_staff_b1, 'in_progress',
          (select id from public.form_sections
             where form_version_id = v_form_b and signoff_role = 'staff_admin'),
          now(), now());

  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, ib_org,   'organizacao_estoque', to_jsonb('Sim'::text)),
    (v_resp, ib_termo, 'possui_termolabeis',  to_jsonb('Não'::text)),
    (v_resp, ib_venc,  'sem_vencidos',        to_jsonb('Sim'::text));

  -- Respondent sign-off already recorded (signed_by the respondent themselves).
  insert into public.response_section_signoffs (response_id, section_id, signed_by)
  select v_resp, s.id, v_staff_b1
  from public.form_sections s
  where s.form_version_id = v_form_b
    and s.requires_signoff
    and s.signoff_role = 'respondent';
end $$;

-- ===========================================================================
-- Phase 7: Multi-phase cases fixture (commission A / CCIH)
-- ===========================================================================
-- A published process template "Investigação de Óbito (M&M)" with two phase-
-- slots, both bound to Form A (the published CCIH checklist). Phase 2 carries a
-- recommend_when over Phase 1's `dispensador_disponivel = 'Sim'`. One mid-flight
-- case (deterministic id, "Caso 0001 — Óbito UTI leito 7", a NON-identifying
-- pseudonym): Phase 1 is CONCLUIDA (a submitted response by staff1.ccih answering
-- 'Sim'), Phase 2 is PENDENTE and flagged RECOMMENDED (the condition is met).
--
-- The seed runs as superuser (RLS bypassed) and inserts directly, like the
-- responses above — it does NOT call the flag-gated RPCs (the cases_multi_phase
-- flag ships OFF until phase completion). The case-number minting trigger still
-- fires on the cases insert; the case/phase state-machine guards are satisfied by
-- setting app.in_case_rpc for the seeded terminal transitions.
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_form_a   uuid := 'f0000000-0000-0000-0000-00000000a001';  -- forms.id (parent)
  v_ver_a    uuid := '50000000-0000-0000-0000-00000000a001';  -- published version
  v_admin    uuid := '00000000-0000-0000-0000-000000000001';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_tpl      uuid := gen_random_uuid();
  v_case     uuid := 'd0000000-0000-0000-0000-0000000000c1';   -- deterministic
  v_cp1      uuid := gen_random_uuid();
  v_cp2      uuid := gen_random_uuid();
  v_resp     uuid := gen_random_uuid();
  ia_disp    uuid;
  ia_turno   uuid;
begin
  select id into ia_disp  from public.form_items where form_version_id = v_ver_a and question_key = 'dispensador_disponivel';
  select id into ia_turno from public.form_items where form_version_id = v_ver_a and question_key = 'turno_auditoria';

  -- Published template + two phase-slots.
  insert into public.process_templates (id, commission_id, title, description, status, created_by)
  values (v_tpl, v_comm_a, 'Investigação de Óbito (M&M)',
          'Processo de avaliação multifásica de óbito. Sem dados de paciente.',
          'active', v_chefe_a);

  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days) values
    (v_tpl, 1, v_form_a, 'Fase 1 — Coleta inicial', null, 7),
    (v_tpl, 2, v_form_a, 'Fase 2 — Revisão do comitê',
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'Sim'),
     14);

  -- The case (number minted by the trigger). Pin Form A's published version.
  -- status is LEFT to the column default 'nao_iniciado' (the FIXED five-value
  -- model; the configurable-status vocabulary R2 introduced was removed). The
  -- recompute trigger on case_phases then auto-advances the macro status as the
  -- phases below are inserted: once Phase 1 lands 'concluida' (and none 'ativa'),
  -- the case computes to 'pendente' (>=1 concluida, none ativa) — matching the
  -- mid-flight fixture the dashboard/board E2E expects.
  insert into public.cases (id, commission_id, template_id, label, created_by)
  values (v_case, v_comm_a, v_tpl, 'Óbito UTI leito 7', v_chefe_a);

  -- Phase 1: concluida + assigned to staff1; Phase 2: pendente + recommended.
  -- The guards permit these seeded statuses under app.in_case_rpc.
  perform set_config('app.in_case_rpc', 'on', true);
  -- default_due_days are the SNAPSHOT copies of the template slot defaults
  -- (ADR 0017). Phase 2 carries a past due_date so the board renders an OVERDUE
  -- example for the frontend/tester (a due_date in the past on an open phase).
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     assigned_to, activated_at, completed_at, default_due_days)
  values
    (v_cp1, v_case, 1, v_form_a, v_ver_a, 'Fase 1 — Coleta inicial',
     'concluida', false, v_staff_a1, now(), now(), 7);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     recommend_when, default_due_days, due_date)
  values
    (v_cp2, v_case, 2, v_form_a, v_ver_a, 'Fase 2 — Revisão do comitê',
     'pendente', true,
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'Sim'),
     14, current_date - 3);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Phase 1's SUBMITTED response (staff1.ccih), answering the gate 'Sim' so the
  -- recommend_when for Phase 2 is satisfied (matches the seeded recommended=true).
  -- Both required items answered so it is a valid submission. The submitted-
  -- immutability trigger blocks answer inserts on a submitted parent unless
  -- app.in_submit_rpc is on (the same path submit_response uses), so we set it
  -- for the duration — exactly as the Phase-6 submitted responses above do.
  perform set_config('app.in_submit_rpc', 'on', true);
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id, started_at, updated_at, submitted_at)
  values
    (v_resp, v_ver_a, v_comm_a, v_staff_a1, 'submitted', v_cp1, now(), now(), now());
  insert into public.answers (response_id, item_id, question_key, value) values
    (v_resp, ia_disp,  'dispensador_disponivel', to_jsonb('Sim'::text)),
    (v_resp, ia_turno, 'turno_auditoria',        to_jsonb('Manhã'::text));
  perform set_config('app.in_submit_rpc', 'off', true);
end $$;

-- ===========================================================================
-- Case OUTCOMES fixture (commission A / CCIH) — for the % adverse dashboard +
-- the outcome E2E. A per-commission outcome vocabulary; the M&M process OFFERS
-- them; Caso 0001 snapshots the offered set; a NEW concluded "Caso 0002" carries
-- an adverse outcome so the dashboard breakdown has real data. No patient data.
-- ===========================================================================
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_form_a   uuid := 'f0000000-0000-0000-0000-00000000a001';
  v_ver_a    uuid := '50000000-0000-0000-0000-00000000a001';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_case2    uuid := 'd0000000-0000-0000-0000-0000000000c2';  -- new concluded Caso 0002
  v_tpl      uuid;
  v_oc_evit  uuid := 'e1000000-0000-0000-0000-0000000000d1';  -- Óbito evitável (adverse + plan)
  v_oc_nevit uuid := 'e1000000-0000-0000-0000-0000000000d2';  -- Óbito não evitável (adverse)
  v_oc_alta  uuid := 'e1000000-0000-0000-0000-0000000000d3';  -- Alta sem intercorrências (neither)
  v_cp1      uuid := gen_random_uuid();
begin
  -- Resolve the M&M template seeded in the Phase-7 block above (by title).
  select id into v_tpl
  from public.process_templates
  where commission_id = v_comm_a and title = 'Investigação de Óbito (M&M)'
  limit 1;

  -- Outcome vocabulary (positions 1..3). At least one adverse + one action-plan.
  insert into public.case_outcomes
    (id, commission_id, label, color_token, requires_action_plan, is_adverse, position)
  values
    (v_oc_evit,  v_comm_a, 'Óbito evitável',           'red',   true,  true,  1),
    (v_oc_nevit, v_comm_a, 'Óbito não evitável',       'amber', false, true,  2),
    (v_oc_alta,  v_comm_a, 'Alta sem intercorrências', 'green', false, false, 3);

  -- The process OFFERS all three (the builder selection).
  insert into public.process_template_outcomes (template_id, outcome_id, position)
  values (v_tpl, v_oc_evit, 1), (v_tpl, v_oc_nevit, 2), (v_tpl, v_oc_alta, 3);

  -- Caso 0001 (mid-flight, pendente) snapshots the offered set (no outcome chosen
  -- yet — it is still open; the selector offers these three).
  insert into public.case_offered_outcomes (case_id, outcome_id) values
    (v_case1, v_oc_evit), (v_case1, v_oc_nevit), (v_case1, v_oc_alta);

  -- ---- Caso 0002: a CONCLUDED case with an ADVERSE outcome (dashboard data) ----
  -- Insert the case (status defaults to nao_iniciado; we set it terminal here
  -- under the case-RPC flag, mirroring close_case's terminal-first write). Its
  -- single phase is concluida. outcome_id = the adverse "Óbito evitável".
  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.cases
    (id, commission_id, template_id, label, status, outcome_id, created_by, closed_at, closed_by)
  values
    (v_case2, v_comm_a, v_tpl, 'Óbito UTI leito 3', 'concluido', v_oc_evit, v_chefe_a, now(), v_chefe_a);

  -- One concluida phase (pins Form A's published version). The recompute trigger
  -- fires on the insert but early-returns because the case is already terminal.
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended,
     assigned_to, activated_at, completed_at, default_due_days)
  values
    (v_cp1, v_case2, 1, v_form_a, v_ver_a, 'Fase 1 — Coleta inicial',
     'concluida', false, v_staff_a1, now(), now(), 7);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Caso 0002 also snapshots the offered set (consistency with the model).
  insert into public.case_offered_outcomes (case_id, outcome_id) values
    (v_case2, v_oc_evit), (v_case2, v_oc_nevit), (v_case2, v_oc_alta);
end $$;

-- ===========================================================================
-- Phase 10: Meetings fixture (commission A / CCIH)
-- ===========================================================================
-- A `realizada` meeting "Reunião Ordinária — Junho/2026" authored by chefe.ccih,
-- with two agenda items, the three CCIH personas as `presente` attendees, one
-- meeting_cases link to the existing demo case (Caso 0001), and one action item
-- assigned to staff1.ccih. The two default meeting types + the quorum settings
-- row already exist for commission A (seeded by the …090005 backfill).
--
-- The seed runs as superuser (RLS bypassed) and inserts DIRECTLY (like the cases
-- fixture above) — it does NOT call the flag-gated RPCs (the `meetings` flag
-- ships OFF until phase completion). The meeting-number minting trigger fires on
-- the INSERT; the lifecycle/child-lock guards are UPDATE/DELETE-only, so the
-- direct `realizada` insert + its children are unaffected. The same-commission
-- guards on meeting_cases (HC032) DO fire on insert and pass (case + meeting are
-- both commission A).
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_staff_a2 uuid := '00000000-0000-0000-0000-000000000004';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_mtg      uuid := 'f1000000-0000-0000-0000-0000000000e1';  -- deterministic
  v_type     uuid;
  v_ag1      uuid := gen_random_uuid();
  v_ag2      uuid := gen_random_uuid();
begin
  -- Resolve the "Ordinária" meeting type seeded for commission A.
  select id into v_type
  from public.commission_meeting_types
  where commission_id = v_comm_a and name = 'Ordinária'
  limit 1;

  -- The meeting header (status realizada — held, not yet sent to signature).
  insert into public.meetings
    (id, commission_id, meeting_type_id, title, status, scheduled_start, scheduled_end,
     modality, location_text, minutes_md, created_by)
  values
    (v_mtg, v_comm_a, v_type, 'Reunião Ordinária — Junho/2026', 'realizada',
     now() - interval '2 days', now() - interval '2 days' + interval '90 minutes',
     'presencial', 'Sala de reuniões da CCIH',
     E'## Pauta\n\nDiscussão dos indicadores de infecção do mês e acompanhamento '
     || E'das ações em andamento. **Sem dados de paciente.**',
     v_chefe_a);

  -- Two agenda items.
  insert into public.meeting_agenda_items
    (id, meeting_id, position, title, description, discussion_notes, resolution, created_by)
  values
    (v_ag1, v_mtg, 1, 'Indicadores do mês',
     'Apresentação das taxas de infecção.',
     'Taxas estáveis em relação ao mês anterior.',
     'Manter o monitoramento atual.', v_chefe_a),
    (v_ag2, v_mtg, 2, 'Acompanhamento de ações',
     'Revisão das ações da última reunião.', null, null, v_chefe_a);

  -- The three CCIH personas as PRESENT attendees (chefe = presidente).
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance) values
    (v_mtg, v_chefe_a,  'presidente', 'presente'),
    (v_mtg, v_staff_a1, 'membro',     'presente'),
    (v_mtg, v_staff_a2, 'membro',     'presente');

  -- One case discussed (Caso 0001), attached to the first agenda item.
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision)
  values (v_mtg, v_case1, v_ag1,
          'Caso em investigação revisado pelo comitê.',
          'Encaminhar para a próxima fase.');

  -- One action item assigned to staff1 (sourced from agenda item 2).
  insert into public.meeting_action_items
    (meeting_id, commission_id, source_agenda_item_id, title, description, status,
     assigned_to, due_date, created_by)
  values
    (v_mtg, v_comm_a, v_ag2, 'Atualizar protocolo de higienização',
     'Revisar e redistribuir o protocolo às equipes.', 'open',
     v_staff_a1, current_date + 14, v_chefe_a);
end $$;

-- ===========================================================================
-- Phase 11: Interviews fixture (commission A / CCIH)
-- ===========================================================================
-- An `em_andamento` interview "Entrevista sobre o Caso 0001" on the existing demo
-- case (Caso 0001, commission A), authored by chefe.ccih. It records:
--   * chefe.ccih as the REGISTERED interviewer (role entrevistador_principal) —
--     this exercises the participant write grant (a registered interviewer can
--     edit/conclude even if not acting as staff_admin), and one EXTERNAL interviewer.
--   * staff1.ccih as a REGISTERED subject + one EXTERNAL subject (free-text role).
--   * one `file` attachment (a signed-transcript metadata row — the object itself
--     is not seeded; the row is enough for the panel/list) and one `link`
--     attachment (an external https audio-recording URL — audio bytes are never
--     stored).
--
-- The seed runs as superuser (RLS bypassed) and inserts DIRECTLY (like the cases /
-- meetings fixtures) — it does NOT call the flag-gated RPCs. The interview-number
-- minting trigger fires on the INSERT; the lifecycle/child-lock guards are
-- UPDATE/DELETE-only (and the parent is em_andamento, not locked), so the direct
-- inserts pass. app.guard_interview_links DOES fire on insert and passes
-- (commission_id matches Caso 0001's commission; no case_phase_id set). The
-- attachment XOR/https CHECKs fire and pass (each row sets exactly one source).
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_itw      uuid := 'f2000000-0000-0000-0000-0000000000e1';  -- deterministic
begin
  -- The interview header (status em_andamento — being conducted).
  insert into public.case_interviews
    (id, commission_id, case_id, title, status, modality, location_text,
     scheduled_start, conducted_at, summary_md, created_by)
  values
    (v_itw, v_comm_a, v_case1, 'Entrevista sobre o Caso 0001', 'em_andamento',
     'presencial', 'Sala da CCIH',
     now() - interval '1 day', now() - interval '1 day',
     E'## Resumo preliminar\n\nEntrevista com a equipe envolvida no caso. '
     || E'**Sem dados de paciente.** Foco no processo assistencial e nas '
     || E'oportunidades de melhoria.',
     v_chefe_a);

  -- Interviewers: chefe.ccih (REGISTERED, principal) + one external.
  insert into public.case_interview_interviewers
    (interview_id, user_id, external_name, external_org, role, note)
  values
    (v_itw, v_chefe_a, null, null, 'entrevistador_principal', null),
    (v_itw, null, 'Dra. Helena Marques', 'Consultoria Externa', 'observador', null);

  -- Subjects (interviewees): staff1.ccih (REGISTERED) + one external person.
  insert into public.case_interview_subjects
    (interview_id, user_id, external_name, external_org, clinical_role, note)
  values
    (v_itw, v_staff_a1, null, null, 'Enfermeiro(a) da unidade', null),
    (v_itw, null, 'Carlos Pereira', 'Hospital Central', 'Técnico de enfermagem', null);

  -- Attachments: one stored-file metadata row + one external audio link.
  insert into public.case_interview_attachments
    (interview_id, kind, title, storage_path, external_url, mime_type, size_bytes, uploaded_by)
  values
    (v_itw, 'transcricao_assinada', 'Transcrição assinada (rascunho)',
     v_comm_a || '/' || v_itw || '/00000000-0000-0000-0000-0000000000f1.pdf',
     null, 'application/pdf', 12345, v_chefe_a),
    (v_itw, 'gravacao_audio', 'Gravação de áudio (link externo)',
     null, 'https://example.com/recordings/caso-0001-entrevista.mp3', null, null, v_chefe_a);
end $$;

-- ===========================================================================
-- 9. PATIENT-SAFETY / NSP (Phase 14a) — the singleton NSP + sample events
-- ===========================================================================
-- The platform's FIRST PHI (Rule 12; ADR 0030/0031), isolated + access-audited.
-- Direct inserts as the superuser seed owner (mirrors the meetings/interviews seed;
-- the lifecycle RPCs gate on auth.uid(), which is null here). The code-mint BEFORE
-- INSERT trigger assigns EV-0001/EV-0002 automatically, so `code` is omitted.
-- Two events: one CASE-LINKED with an isolated event_patient PHI row, and one
-- STAND-ALONE (case-less). Both start at the NSP (current_owner_kind = 'pqs').
do $$
declare
  v_comm_a   uuid := 'a0000000-0000-0000-0000-0000000000a1';  -- CCIH
  v_chefe_a  uuid := '00000000-0000-0000-0000-000000000002';  -- chefe.ccih (staff_admin)
  v_staff_a1 uuid := '00000000-0000-0000-0000-000000000003';  -- staff1.ccih (just-culture reporter)
  v_case1    uuid := 'd0000000-0000-0000-0000-0000000000c1';  -- existing Caso 0001
  v_ev1      uuid := 'e1000000-0000-0000-0000-0000000000a1';  -- case-linked event (has PHI)
  v_ev2      uuid := 'e2000000-0000-0000-0000-0000000000a2';  -- stand-alone event
  v_ev3      uuid := 'e3000000-0000-0000-0000-0000000000a3';  -- sentinel event (triaged)
  v_crit_id  uuid;                                            -- a flagged sentinel criterion
  v_rca3     uuid := 'f3000000-0000-0000-0000-0000000000a3';  -- the RCA for v_ev3
  v_factor   uuid := 'fac00000-0000-0000-0000-0000000000a1';  -- a key fishbone factor
  v_root3    uuid;                                            -- the RCA's root cause id
  v_capa3    uuid := 'ca000000-0000-0000-0000-0000000000a3';  -- the CAPA for v_ev3
  v_capa_act uuid := 'caa00000-0000-0000-0000-0000000000a1';  -- a corrective action
  v_capa_meas uuid := 'cab00000-0000-0000-0000-0000000000a1'; -- a measure (hex-only)
begin
  -- The singleton NSP department (one row; default name + 45-day RCA window).
  insert into public.pqs_department (name, rca_default_due_days)
  values ('Núcleo de Segurança do Paciente', 45);

  -- Event 1 — CASE-LINKED, reported by a PLAIN staff member (just-culture),
  -- acknowledged by the NSP. Held by the NSP.
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    (v_ev1, v_comm_a, v_case1, current_date - 2, 'UTI Adulto, leito 7', v_staff_a1,
     'moderate', 'Queda de paciente durante transferência',
     E'## Descrição\n\nPaciente sofreu queda durante a transferência da maca para o '
     || E'leito. Avaliado pela equipe; conduta registrada no prontuário.',
     'acknowledged', 'pqs', null, v_chefe_a, now() - interval '1 day');

  -- Its initial custody interval (opened at the NSP).
  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev1, 'pqs', null, v_staff_a1, 'Notificação inicial ao NSP');

  -- The case_events 'safety_event' echo (Phase-12 timeline; deduped off the
  -- timeline against the authoritative patient_safety_event read).
  insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
  values
    (v_case1, 'safety_event', 'Evento de segurança EV-0001',
     'Evento EV-0001 notificado ao NSP: Queda de paciente durante transferência',
     current_date - 2, v_staff_a1);

  -- Its ISOLATED PHI row (minimum-necessary identifiers; Rule 12).
  insert into public.event_patient
    (event_id, name, mrn, date_of_birth, sex, encounter_ref, unit, attending)
  values
    (v_ev1, 'Paciente de Demonstração', 'PRT-0099123', '1958-03-14', 'male',
     'ENC-2026-4471', 'UTI Adulto', 'Dr. Ricardo Antunes');

  -- Event 2 — STAND-ALONE (no case), freshly reported, held by the NSP.
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id)
  values
    (v_ev2, v_comm_a, null, current_date - 1, 'Farmácia central', v_chefe_a,
     'mild', 'Divergência na dispensação de medicamento',
     E'## Descrição\n\nDivergência identificada na conferência de dispensação. '
     || E'Sem alcance ao paciente. Notificado para análise do NSP.',
     'reported', 'pqs', null);

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev2, 'pqs', null, v_chefe_a, 'Notificação inicial ao NSP');

  -- Event 3 — a SENTINEL event, fully TRIAGED (Phase 14b demo). Reported case-less,
  -- acknowledged, then triaged: PSE=yes, reach=sentinel, harm=death, a designated
  -- category flagged → sentinel determination → RCA mandated (shell + 45-day due).
  -- Inserted at 'acknowledged' first, then the worksheet, then flipped to 'triaged'
  -- under app.in_safety_rpc (so the state-machine + freeze guards admit the seed).
  insert into public.patient_safety_event
    (id, reporting_commission_id, case_id, discovered_at, location, reported_by,
     suspected_harm_level, title, description_md, status,
     current_owner_kind, current_owner_commission_id, acknowledged_by, acknowledged_at)
  values
    (v_ev3, v_comm_a, null, current_date - 5, 'Centro cirúrgico, sala 2', v_chefe_a,
     'death', 'Retenção de corpo estranho após cirurgia',
     E'## Descrição\n\nIdentificada retenção de compressa cirúrgica após procedimento; '
     || E'necessário segundo procedimento. Caso encaminhado ao NSP para triagem.',
     'acknowledged', 'pqs', null, v_chefe_a, now() - interval '4 days');

  insert into public.event_custody
    (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values
    (v_ev3, 'pqs', null, v_chefe_a, 'Notificação inicial ao NSP');

  -- The triage worksheet (sentinel determination = true; pathway = rca).
  insert into public.event_triage
    (event_id, is_pse, reach, harm_severity, natural_course, sentinel_determination,
     review_pathway, disposition_notes_md, triaged_by, triaged_at)
  values
    (v_ev3, true, 'sentinel', 'death', false, true, 'rca',
     E'Evento sentinela confirmado. RCA obrigatória em até 45 dias.',
     v_chefe_a, now() - interval '3 days');

  -- The flagged designated category (snapshot key+label — the permanent record).
  select id into v_crit_id from public.pqs_sentinel_criteria where key = 'retained_object';
  insert into public.event_triage_sentinel_flags
    (event_id, criteria_id, criteria_key, criteria_label)
  select v_ev3, v_crit_id, c.key, c.label
  from public.pqs_sentinel_criteria c where c.id = v_crit_id;

  -- Flip the event to 'triaged' (freezes the worksheet) + mint the RCA shell. Both
  -- writes need the safety-RPC session flag so the guards admit the seed transition.
  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event set status = 'triaged', updated_at = now() where id = v_ev3;
  perform set_config('app.in_safety_rpc', 'off', true);

  -- The RCA shell (as confirm_triage would mint it), then fleshed out into a
  -- partially-complete analysis (Phase 14c demo; mirrors README_rca §1.4 depth) so the
  -- workspace shows real content on load: problem statement, a team, a key fishbone
  -- factor + a 5-Whys drill, and a distilled root cause. Status = in_progress.
  insert into public.rca (id, event_id, status, due_date, created_by, what_md, expected_md,
                          detected, impact, scope)
  values (v_rca3, v_ev3, 'in_progress', (current_date - 5) + 45, v_chefe_a,
          E'Compressa cirúrgica retida identificada após colectomia eletiva; '
          || E'necessário segundo procedimento para remoção.',
          E'A contagem de compressas deveria ter sido conferida e conciliada antes do '
          || E'fechamento, conforme protocolo de cirurgia segura.',
          'Centro cirúrgico, ao final do procedimento', 'Óbito · evento sentinela',
          'Perioperatório · Cirurgia Geral');

  -- Team: a Lead (staff_admin) + an SME who is a PLAIN staff member (demonstrates the
  -- participant write grant — a non-observer staff SME can write the RCA).
  insert into public.rca_members (rca_id, user_id, external_name, role) values
    (v_rca3, v_chefe_a, null, 'lead'),
    (v_rca3, v_staff_a1, null, 'sme');

  -- An incident-timeline entry.
  insert into public.rca_timeline_entries (rca_id, occurred_at, description, position) values
    (v_rca3, now() - interval '6 days',
     'Término do procedimento sem conciliação final da contagem de compressas.', 1);

  -- A fishbone factor flagged as KEY (carried into the 5-Whys).
  insert into public.rca_factors (id, rca_id, category, text, is_key, position) values
    (v_factor, v_rca3, 'process',
     'Contagem de compressas não conciliada antes do fechamento', true, 1);

  -- The 5-Whys drill for that key factor + the reached root cause.
  insert into public.rca_why_chains (rca_id, factor_id, steps, root_text) values
    (v_rca3, v_factor,
     to_jsonb(array[
       'A equipe assumiu que a contagem inicial estava correta.',
       'Não havia conferência independente obrigatória ao fechar.',
       'O protocolo de cirurgia segura não definia uma dupla checagem.'
     ]),
     'Ausência de uma dupla checagem padronizada da contagem cirúrgica.');

  -- A distilled root cause (the FK target Phase 14d addresses).
  insert into public.rca_root_causes (rca_id, text, category, classification, type, position)
  values
    (v_rca3,
     'Ausência de processo padronizado de dupla checagem da contagem cirúrgica.',
     'process', 'system', 'root', 1)
  returning id into v_root3;

  -- A CAPA plan opened from that RCA root cause (Phase 14d demo). Left OPEN
  -- (em_execucao) so the close-flow stays demoable: one corrective action with a
  -- task, a measure with a result, and a recorded effectiveness verdict — but NOT
  -- closed (closing requires every action settled, which the open action blocks).
  insert into public.capa_plan (id, source, source_rca_id, classification, status, opened_by)
  values (v_capa3, 'rca', v_rca3, 'corretiva', 'em_execucao', v_chefe_a);

  -- A corrective action assigned to a PLAIN staff member (demonstrates the
  -- assignee-or-PQS advance path); links back to the root cause. Strength = forte.
  insert into public.capa_action
    (id, capa_id, title, owner, assignee_user_id, due_date, action_strength,
     success_measure, root_cause_id, status, position)
  values
    (v_capa_act, v_capa3,
     'Implantar dupla checagem padronizada da contagem cirúrgica',
     'Enf. responsável do CC', v_staff_a1, current_date + 30, 'forte',
     'Conformidade da dupla checagem ≥ 95% nas cirurgias auditadas',
     v_root3, 'em_andamento', 1);

  insert into public.capa_action_task (action_id, description, is_done, position) values
    (v_capa_act, 'Revisar o protocolo de cirurgia segura com a equipe do CC', true, 1),
    (v_capa_act, 'Treinar a equipe na nova rotina de dupla checagem', false, 2);

  insert into public.capa_measure (id, capa_id, name, target, definition, position) values
    (v_capa_meas, v_capa3, 'Conformidade da dupla checagem', '≥ 95%',
     'Percentual de cirurgias auditadas com dupla checagem registrada', 1);

  insert into public.capa_measure_result (measure_id, period, value, note, created_by) values
    (v_capa_meas, '2026-06', 82, 'Linha de base antes do treinamento.', v_chefe_a);

  -- A recorded effectiveness verdict (partial — the plan stays open for re-verification).
  insert into public.capa_effectiveness (capa_id, verdict, method_md, verified_by) values
    (v_capa3, 'parcial',
     E'Conformidade inicial de 82% após a primeira fase. Reavaliar após o treinamento completo.',
     v_chefe_a);
end $$;
