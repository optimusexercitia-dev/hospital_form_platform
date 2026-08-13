# Seed de demonstração — Comissão de Revisão de Prontuário

Conjunto de dados **autocontido**, em português, para apresentar a plataforma a um
cliente. Cria a própria organização, hospital e comissão — **não interfere** nos
dados de teste (E2E) de `supabase/seed.sql`.

## Como aplicar

Pré-requisito: um banco com as **migrações já aplicadas** (local via
`supabase start` + `supabase db reset`, ou um projeto na nuvem).

```bash
# Aplicar o seed de demonstração (local)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -v ON_ERROR_STOP=1 --single-transaction \
     -f supabase/demo/seed-revisao-prontuario.sql
```

Para **remover** a demonstração (necessário antes de reaplicar):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -v ON_ERROR_STOP=1 --single-transaction \
     -f supabase/demo/reset-revisao-prontuario.sql
```

> Na nuvem, troque a string de conexão pela do projeto (conexão direta / pooler).
> O `reset` roda como **superusuário** (suspende gatilhos e checagens de FK para a
> limpeza completa).

> ⚠ **Feature flags são globais da plataforma, não do inquilino.** Para que todas as
> telas da demonstração fiquem acessíveis, o seed liga as flags que encontrar
> desligadas — o que alcança **todos os inquilinos do banco**. Ele guarda o valor
> anterior de cada flag que alterou em `app.demo_saorafael_flag_backup`, e o `reset`
> restaura esses valores e remove a tabela. Rode sempre o `reset` ao encerrar a
> demonstração em um banco compartilhado.

## Acessos (senha de todos: `Demo1234!`)

| E-mail                              | Papel                                   |
| ----------------------------------- | --------------------------------------- |
| `ricardo.almeida@saorafael.demo`    | Coordenador (staff_admin) — Presidente  |
| `beatriz.carvalho@saorafael.demo`   | Membro — Vice-Presidente                |
| `camila.ribeiro@saorafael.demo`     | Membro — Secretária                     |
| `fernando.souza@saorafael.demo`     | Membro Efetivo                          |
| `patricia.gomes@saorafael.demo`     | Membro Efetivo                          |
| `juliana.martins@saorafael.demo`    | Membro Efetivo                          |
| `marcelo.nunes@saorafael.demo`      | Membro Consultivo                       |
| `ana.ferreira@saorafael.demo`       | Membro Consultivo (SAME)                |
| `eduardo.tavares@saorafael.demo`    | Administrador da rede (org_admin)       |

> Para ver a área do administrador de organização (gestão de hospitais/comissões),
> entre como `eduardo.tavares@saorafael.demo`. Para a operação da comissão, entre
> como `ricardo.almeida@saorafael.demo`.

## O que a demonstração cobre

- **Estrutura**: Rede São Rafael de Saúde › Hospital São Rafael › Comissão de
  Revisão de Prontuário, com **8 membros** (títulos + categorias profissionais).
- **Processo "Revisão de Prontuário"** (2 fases):
  - **Fase 1 — Checklist Revisão de Prontuário**: 19 perguntas, **14 de múltipla
    escolha**, além de lista suspensa, caixas de seleção, número, data e texto
    livre; uma seção **condicional** (registros cirúrgicos) e uma seção com
    **assinatura** do responsável.
  - **Fase 2 — Parecer do Comitê** (recomendada automaticamente quando a Fase 1
    sinaliza não conformidade), com homologação da coordenação.
- **20 casos** em todos os status (não iniciado / em análise / pendente /
  concluído / cancelado), com fases **atribuídas a membros**, **campos
  personalizados** (nº do prontuário, setor, data da alta), **desfechos** de
  conformidade e **respostas preenchidas** nos casos de destaque.
- **Itens de ação**: concluídos, em aberto, atrasados, em andamento e cancelado —
  originados de reuniões, de casos e manuais.
- **6 reuniões**: agendada / realizada / assinada / distribuída, nas modalidades
  presencial, remota e híbrida, com quórum, participantes (presente / ausente /
  justificado / convocado), pauta, ata e casos discutidos.
- **6 documentos controlados**: rascunho, em aprovação, alterações solicitadas,
  vigente e obsoleto (histórico de versões), incluindo o **Regimento Interno**
  (Estatuto) e o **Regimento** vinculado à **cadência de reuniões** da comissão.
- **2 indicadores de qualidade** com medições mensais (painel).

## Observações

- **Sem dados de paciente (PHI)**: a comissão trabalha com descritores
  administrativos (nº do prontuário, setor) — coerente com o posicionamento da
  plataforma como camada de governança/qualidade.
- Os documentos referenciam `storage_path` nulo (um seed SQL não injeta os bytes
  reais no bucket); a tela mostra "Sem arquivo". O upload real é feito pela
  interface.
- As datas de reuniões/indicadores usam 2026 (março a setembro) para a linha do
  tempo fazer sentido na apresentação.
