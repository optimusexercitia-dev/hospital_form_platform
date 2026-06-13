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

  insert into public.process_template_phases (template_id, position, form_id, title, recommend_when) values
    (v_tpl, 1, v_form_a, 'Fase 1 — Coleta inicial', null),
    (v_tpl, 2, v_form_a, 'Fase 2 — Revisão do comitê',
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'Sim'));

  -- The case (number minted by the trigger). Pin Form A's published version.
  insert into public.cases (id, commission_id, template_id, label, status, created_by)
  values (v_case, v_comm_a, v_tpl, 'Óbito UTI leito 7', 'aberto', v_chefe_a);

  -- Phase 1: concluida + assigned to staff1; Phase 2: pendente + recommended.
  -- The guards permit these seeded statuses under app.in_case_rpc.
  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended, assigned_to, activated_at, completed_at)
  values
    (v_cp1, v_case, 1, v_form_a, v_ver_a, 'Fase 1 — Coleta inicial',
     'concluida', false, v_staff_a1, now(), now());
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, recommended, recommend_when)
  values
    (v_cp2, v_case, 2, v_form_a, v_ver_a, 'Fase 2 — Revisão do comitê',
     'pendente', true,
     jsonb_build_object('from_phase', 1, 'question_key', 'dispensador_disponivel',
                        'op', 'equals', 'value', 'Sim'));
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
