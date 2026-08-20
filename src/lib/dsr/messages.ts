/**
 * DSR ("Direitos do Titular") pt-BR message catalogue + SQLSTATE mapping.
 *
 * Architecture Rule 10 (user-facing text pt-BR) and CLAUDE.md §8 (raw
 * Supabase/Postgres errors NEVER reach the UI). Mirrors
 * `src/lib/{safety,referrals}/messages.ts`.
 *
 * SQLSTATE family minted for this program (ADR 0130 Amendment 2):
 *   HCDS1 flag off · HCDS2 unroutable/unresolvable xref row ·
 *   HCDS3 task not completable · HCDS4 close refused, work outstanding ·
 *   HCDS5 illegal DSR state transition.
 */

/** The `dsr` feature flag is OFF — every door is parked. */
export const HCDS_FLAG_OFF = 'HCDS1'
/** A record of the subject could not be attributed to a commission/case. */
export const HCDS_UNROUTABLE = 'HCDS2'
/** The task cannot be completed yet (disposal not done, or attestation empty). */
export const HCDS_NOT_COMPLETABLE = 'HCDS3'
/** Closing as attended was refused because execution tasks are still pending. */
export const HCDS_WORK_OUTSTANDING = 'HCDS4'
/** Illegal transition — already done / already closed. */
export const HCDS_BAD_TRANSITION = 'HCDS5'

export const DSR_MESSAGES = {
  moduleOff:
    'O módulo de Direitos do Titular não está habilitado nesta instalação.',
  forbidden: 'Você não tem permissão para esta ação.',
  notFound: 'Registro não encontrado.',
  missingHospital: 'Selecione o hospital responsável pela solicitação.',
  missingMrn: 'Informe o identificador do paciente (prontuário).',
  missingFileRef: 'Informe a referência do processo físico ou do GED.',
  missingOutcome: 'Selecione o desfecho da solicitação.',
  missingBasis:
    'A recusa precisa do fundamento legal que será informado ao titular.',
  missingLegalRef:
    'Informe a referência da consulta jurídica que fundamentou a decisão.',
  missingNote: 'Descreva o que foi revisado para concluir esta tarefa.',
  missingReviewerName:
    'Informe o nome de quem revisou o conteúdo. A atestação é pessoal e nominal.',
  missingRedactions:
    'Informe quantas menções ao titular foram removidas (use 0 se nenhuma foi encontrada).',
  requestCreated: 'Solicitação registrada e tarefas de execução distribuídas.',
  requestAdjudicated: 'Decisão registrada.',
  requestClosed: 'Solicitação encerrada.',
  taskCompleted: 'Tarefa concluída.',
  attestationRecorded: 'Revisão atestada e registrada.',
  disposalDone: 'Descarte executado.',
  notAdjudicated:
    'Registre a decisão (parecer) antes de encerrar a solicitação como atendida.',
  outcomeMismatch:
    'O desfecho informado difere da decisão já registrada para esta solicitação.',
  alreadyAdjudicated:
    'Esta solicitação já foi decidida. A decisão registrada não pode ser reescrita.',
  useAttestationForm:
    'Esta é uma tarefa de revisão: use o formulário de atestação (revisor e quantidade de menções removidas).',
  notCompletable:
    'O descarte ainda não foi realizado neste registro. Execute o descarte antes de concluir a tarefa.',
  workOutstanding:
    'Ainda há tarefas pendentes. Conclua a execução antes de encerrar a solicitação como atendida.',
  badTransition: 'Esta ação já foi realizada e não pode ser repetida.',
  unroutable:
    'Há registros do titular que não puderam ser atribuídos a uma comissão. Corrija o índice antes de registrar a solicitação.',
  unexpected: 'Não foi possível concluir a operação. Tente novamente.',
} as const

/**
 * ⭐ THE RESIDUE LANGUAGE (ADR 0130 Decision 9 / Q12a) — fixed, decided once,
 * NEVER improvised per request by an operator.
 *
 * ⛔ A RULE, NOT A ROSTER: every surface that confirms a disposal — and the outcome
 * record handed to the subject — renders THESE lines verbatim; none writes,
 * paraphrases or extends residue copy of its own, so the platform makes one claim,
 * from one file, wherever it is made. A new dispose surface inherits that obligation.
 * Read this symbol's references for the current callers; a list kept here would go
 * stale the first time one is added.
 *
 * The rule is retrospective: a dispose dialog once promised a permanent wipe of every
 * sensitive field while saying nothing about retained encrypted attachments, the PITR
 * window, or already-distributed copies — the over-claim ADR 0056's narrowed closure
 * forbids. DSR Slice 4 moved that dialog onto this constant and closed
 * `FUP-DISPOSE-DIALOG-OVERCLAIM`.
 *
 * ⚠ THE pt-BR WORDING IS NOT REPRODUCED HERE, but that is now a STYLE CHOICE, not a
 * rule. It used to be load-bearing: the over-claim was policed by a grep over `src/`, so
 * a comment quoting it to warn the next reader was indistinguishable from the defect
 * itself — which happened four times in one day, to authors who knew the rule. That grep
 * was RETIRED on 2026-08-20 (measured record: 0 true, 4 false positives) and replaced by
 * rendered-output assertions, where comments do not exist. ⛔ Do not reinstate the
 * prohibition without reinstating an instrument that could enforce it — see
 * `.claude/rules/ui-copy-forbidden-strings.md`.
 *
 * ⚠ Every line is a NARROWED claim, checked against ADR 0056's narrowed closure:
 * what leaves is the database PHI of the named record, and nothing else does.
 */
export const DSR_RESIDUE_NOTICE = [
  'O descarte apaga os dados do paciente armazenados no banco para este registro e preserva o histórico de governança (numeração, status, trilha de auditoria).',
  'Anexos e arquivos permanecem retidos e cifrados sob o regime de 20 anos; a exclusão de bytes verificada na nuvem é comprovada apenas em nível de metadados.',
  'A janela de recuperação do banco (PITR) ainda contém o conteúdo apagado por alguns dias.',
  'Cópias já impressas ou distribuídas estão fora do alcance da plataforma.',
] as const

/**
 * ⭐ WHAT A MEETING DISPOSAL DELIBERATELY RETAINS (ADR 0056 Amendment 1) — the
 * meeting lane's companion to {@link DSR_RESIDUE_NOTICE}, rendered BESIDE it on the
 * meeting-dispose surfaces, never instead of it.
 *
 * ⛔ IT IS A SEPARATE CONSTANT AND MUST STAY ONE. `DSR_RESIDUE_NOTICE` is shared by the
 * referral and case lanes, whose doors have different reaches; a fifth line about meeting
 * titles or signature notes would be FALSE on those surfaces. Per-lane retention belongs
 * in a per-lane constant.
 *
 * WHY IT EXISTS AT ALL. The rule the widening was built on is that a DESIGNATED PHI column
 * may not be left both unredacted AND unnamed — the forbidden state is the one where
 * neither the redaction nor the disclosure is true. ADR 0056 Amendment 1 widened
 * `dispose_meeting_minutes` to ten further columns; PO ruled the four below stay, so they
 * are named here. Each line corresponds to a column the door was measured NOT to touch.
 *
 * ⛔ THAT RULE SAID "PHI-CAPABLE" UNTIL 2026-08-20, AND THE NARROWING IS THE WHOLE POINT.
 * Read as `PHI-capable`, it obliges every free-text column on a lane — a census measured
 * that at 133 columns across the other three doors. ADR 0131 bounds PHI erasure to
 * DESIGNATED PHI fields, with operator TRAINING as the control for free text that merely
 * may hold PHI. So this constant is NOT a template for the case/referral/event lanes: do
 * not add disclosure lines for their titles and notes, because 0131 does not require the
 * redaction those lines would be disclosing the absence of.
 * ⚠ This block itself stays exactly as it is — 0131 bounds future extension and does not
 * roll back Amendment 1, so these four columns remain both retained AND named.
 *
 * ⚠ THE TITLE DOES HAVE A REMEDY, AND AN EARLIER VERSION OF THIS COMMENT SAID IT DID NOT.
 * That claim was false. It read `update_meeting`'s gate (`scheduled`/`held` only), saw that
 * disposal targets locked meetings, and concluded nothing could reach it — without checking
 * whether another door moves the meeting INTO that state. `reopen_meeting` sets
 * `status = 'held'`. The corridor is the one {@link DSR_ATTEST_PROCEDURE_COMMON} already
 * documents: reopen → edit → re-sign. A gate says what it refuses; only the transition
 * graph says what is reachable.
 *
 * ⚠ These lines still state the retention as a fact rather than promising a fix, because
 * the corridor is expensive and is not universal: reopening revokes every signature and
 * bumps `meetings.revision`, which invalidates registered prints (ADR 0126 D9); it is
 * refused for `distributed` and `cancelled` meetings (`app.guard_meeting_status` has no
 * transition arm leaving either state); and it requires `staff_admin`, while disposal also
 * admits a tenancy admin — so the operator reading this may not be able to walk it.
 *
 * ⚠ Keep each line tied to a column, so that a future widening of the door deletes the
 * line it makes false. A retention disclosure that outlives the retention is the same
 * defect as the over-claim, pointing the other way.
 */
export const DSR_MEETING_RESIDUE_RETAINED = [
  'O título da reunião é preservado como identificação do registro e não é apagado pelo descarte.',
  'As observações registradas nas assinaturas da ata são preservadas como evidência da validade da assinatura.',
  'O resumo e a decisão de cada caso discutido nesta reunião pertencem ao descarte do próprio caso e não são apagados aqui.',
  'A gravação de áudio da reunião, se houver, permanece retida e cifrada sob o regime de 20 anos; a transcrição armazenada no banco é apagada.',
] as const

/**
 * ⭐ THE ATTESTED TIER'S PROCEDURE (ADR 0130 Decision 7 / Q10a) — the ONLY lawful
 * way to remove a mention from locked content, written once here.
 *
 * ⛔ There is deliberately NO in-place redaction door for locked content: ADR 0130
 * Decision 7 names that "the child-lock defect's evil twin, a bypass that works".
 * The corridor is `reopen_meeting` (→ `revoked`, children unlock) → edit → re-sign;
 * the revision bump correctly invalidates registered prints (ADR 0126).
 */
const DSR_ATTEST_PROCEDURE_COMMON = [
  'Localize o titular pela referência do processo físico/GED — a plataforma nunca exibe a identidade do titular (ADR 0130 Q6).',
  'Para remover uma menção em conteúdo já bloqueado: reabra a reunião, edite o trecho e assine novamente. A nova revisão invalida as impressões já registradas.',
  'Não existe remoção parcial de conteúdo bloqueado por outro caminho.',
  'Registre o seu nome e a quantidade de menções removidas — a atestação é nominal e entra no registro de desfecho entregue ao titular.',
  // ⛔ THE RULE 12 CONTROL. `dsr_tasks.completion_note` is free text in a `dsr_*`
  // table and no CHECK can police its contents; a reviewer who transcribes the
  // passage writes cleartext patient identity into a row that must hold none,
  // which is the fourth-PHI-module state Rule 12 forbids. Copy is the ONLY control
  // on this axis, so it is stated last, where it is read last before writing.
  '⚠ Descreva apenas O QUE FOI FEITO. Não transcreva o trecho encontrado nem qualquer dado que identifique o titular — este registro é mantido sem dados de paciente.',
] as const

/**
 * ⚠ TWO FLAVOURS, DIFFERENT SUBJECTS — do not render them under one procedure.
 *
 * The fan-out mints entity-BEARING attestations (one ata, whose link to the
 * subject's case is mechanical) and entity-LESS ones (a whole commission's
 * non-case free text, for which no signal exists in either direction). A reviewer
 * shown the wrong scope attests to the wrong thing, and an attestation is a named
 * human's statement entering a legal record. Pick with
 * {@link dsrAttestProcedure}.
 */
export const DSR_ATTEST_PROCEDURE_MEETING = [
  DSR_ATTEST_PROCEDURE_COMMON[0],
  'Revise ESTA ata — o texto da ata e os itens de pauta — em busca de menções ao titular.',
  ...DSR_ATTEST_PROCEDURE_COMMON.slice(1),
] as const

export const DSR_ATTEST_PROCEDURE_COMMISSION = [
  DSR_ATTEST_PROCEDURE_COMMON[0],
  'Revise o conteúdo em texto livre DESTA COMISSÃO — respostas de formulários fora de casos, atas e anotações — em busca de menções ao titular.',
  'Esta revisão não tem apoio mecânico: o índice de pacientes não encontra um nome digitado em texto livre, e é por isso que ela é atestada por uma pessoa.',
  ...DSR_ATTEST_PROCEDURE_COMMON.slice(1),
] as const

/** The procedure for one attestation task, by its subject. */
export function dsrAttestProcedure(
  module: string | null,
): readonly string[] {
  return module === 'meeting'
    ? DSR_ATTEST_PROCEDURE_MEETING
    : DSR_ATTEST_PROCEDURE_COMMISSION
}

/**
 * ⭐ THE SINGLE MOST IMPORTANT STRING IN THIS SLICE. The hazard ADR 0130
 * Amendment 2 item 3 REFUSED TO AUTOMATE: `dispose_meeting_minutes` nulls
 * `meetings.minutes_md` and overwrites `description`, `discussion_notes` and
 * `resolution` on EVERY agenda item of the meeting (measured from the live door,
 * not inferred). The human escalating is about to erase other committees'
 * unrelated records, and must be told so in those words.
 *
 * ⛔ Never soften this.
 */
export const DSR_MEETING_DISPOSAL_WARNING =
  'O descarte apaga a ata inteira desta reunião — o texto da ata e a descrição, as discussões e as deliberações de TODOS os itens de pauta, inclusive os que não têm relação com o titular. Não existe descarte parcial de uma ata.'

/**
 * ADR 0130 Decision 10 — the deadline is a BADGE, not a promise. ⛔ The day count
 * is deliberately absent: `create_dsr_request` takes `p_due_days default 15`, so a
 * constant asserting "15 dias" would go stale silently against any row created
 * with another value. The badge renders the row's real `due_date`; this string
 * carries only the load-bearing half, which is that nothing is automated.
 */
export const DSR_DUE_DATE_NOTICE =
  'O prazo é um indicador de acompanhamento. A plataforma não envia lembretes nem executa nenhuma ação automaticamente.'

/**
 * ⚠ THE EMPTY STRING MUST NOT VARY BY CAUSE. `search_patient_xref` returns the
 * EMPTY BUNDLE — never an error — for a caller its gate refuses, so a zero-match,
 * a non-DPO and an out-of-hospital-scope search are already indistinguishable IN
 * THE DATABASE, and `empty` is what all three render. A genuine infrastructure
 * failure is a different thing and is allowed to say so (`unavailable`):
 * collapsing real breakage into "nothing found" buys no privacy, because the class
 * that must stay silent structurally cannot reach that branch.
 */
export const DSR_SEARCH = {
  hint: 'A busca é exata, pelo prontuário e/ou atendimento, e limitada aos registros deste hospital.',
  empty: 'Nenhum registro encontrado para os identificadores informados.',
  identifierRequired:
    'Informe o prontuário e/ou o número de atendimento para pesquisar.',
  unavailable: 'Não foi possível realizar a pesquisa no momento. Tente novamente.',
} as const

/**
 * ⚠ WHO MAY EXECUTE EACH TASK KIND — COPY, NOT A PREDICATE (ADR 0130 Amendment 2
 * item 2). `app.can_execute_dsr_task` is deliberately COARSER than the four
 * disposal doors; mirroring the four gate expressions in a fifth place was
 * REJECTED, because a mirror no gate keeps in sync is a liability. So the honest
 * resolution is to name the holder in copy and let the door's own pt-BR refusal be
 * the answer. Nothing below is a boundary.
 */
export const DSR_TASK_EXECUTOR_HINTS: Record<string, string> = {
  dispose_case: 'Executado pela coordenação da comissão (staff_admin) do caso.',
  dispose_event:
    'Executado pela equipe do NSP do hospital ou pela administração da organização.',
  dispose_referral:
    'Executado pela equipe do NSP do hospital ou pela administração da organização.',
  dispose_meeting:
    'Executado pela coordenação da comissão da reunião ou pela administração da organização.',
  attest_review:
    'Atestado por quem revisou o conteúdo em texto livre da comissão.',
  notify_scrub_check: 'Verificado pelo Encarregado ou pela equipe do hospital.',
}

/**
 * ⚠ THE REFUSAL BASIS TEMPLATE — cites the INSTITUTIONAL RETENTION POLICY and
 * ⛔ NEVER CFM 1821/2007. Counsel held (ADR 0035 Amendment 1, holding 1) that the
 * statute does not attach to committee records; citing it to a data subject would
 * be a FALSE LEGAL BASIS. Behind a constant so the next counsel refinement is a
 * one-file change (plan § Slice 3 item 5).
 */
export const DSR_REFUSAL_RETENTION_BASIS =
  'A documentação de comissão é preservada pelo prazo de 20 anos adotado como política institucional de retenção, decisão tomada caso a caso com consulta jurídica.'

/** The task kinds, in the order the inbox lists them. */
export const DSR_TASK_KIND_LABELS: Record<string, string> = {
  dispose_case: 'Descartar dados do caso',
  dispose_event: 'Descartar dados do evento',
  dispose_referral: 'Descartar dados do encaminhamento',
  dispose_meeting: 'Descartar a ata da reunião',
  attest_review: 'Revisar e atestar',
  notify_scrub_check: 'Verificar resíduo em notificações',
}

/**
 * The label for ONE task. ⚠ `attest_review` covers two different subjects — one
 * specific ata vs. a whole commission's non-case free text — and the bare kind
 * label cannot tell them apart. Rendering both as "Revisar e atestar" invites the
 * reviewer to attest to the wrong scope.
 */
export function dsrTaskLabel(kind: string, module: string | null): string {
  if (kind === 'attest_review') {
    return module === 'meeting'
      ? 'Revisar e atestar a ata'
      : 'Revisar e atestar o texto livre da comissão'
  }
  return DSR_TASK_KIND_LABELS[kind] ?? kind
}

export const DSR_OUTCOME_LABELS: Record<string, string> = {
  granted: 'Atendida',
  granted_partial: 'Atendida parcialmente',
  refused_retention: 'Recusada — retenção obrigatória',
  refused_identity: 'Recusada — identidade não comprovada',
  withdrawn: 'Desistência do titular',
}

export const DSR_STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  adjudicated: 'Decidida',
  executing: 'Em execução',
  closed: 'Encerrada',
}

/**
 * ⭐ THE ALLOWLIST BEHIND `mapDsrError`'s 23514 arm — every pt-BR message a DSR
 * door raises with `check_violation`, verbatim.
 *
 * Enumerated from the migrations that raise them (`20261001000100`,
 * `20261002000100`, `20261002000300`), all five static strings with no
 * interpolation. Anything NOT in this set is assumed to be a bare Postgres
 * constraint violation and is replaced with a generic pt-BR message.
 */
const DSR_DOOR_CHECK_MESSAGES: ReadonlySet<string> = new Set([
  'a referência do processo é obrigatória',
  'o identificador do paciente é inválido',
  'desfecho inválido',
  'a recusa exige o fundamento legal informado ao titular',
  'informe a referência da consulta jurídica que fundamentou a decisão',
])

/**
 * Map a PostgREST/Postgres error onto pt-BR. The RPCs already raise pt-BR text,
 * so that is preferred; these constants are the fallback for the codes whose
 * message could be a bare constraint violation.
 */
export function mapDsrError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case HCDS_FLAG_OFF:
      return DSR_MESSAGES.moduleOff
    case HCDS_UNROUTABLE:
      return error.message || DSR_MESSAGES.unroutable
    case HCDS_NOT_COMPLETABLE:
      return error.message || DSR_MESSAGES.notCompletable
    case HCDS_WORK_OUTSTANDING:
      return error.message || DSR_MESSAGES.workOutstanding
    case HCDS_BAD_TRANSITION:
      return error.message || DSR_MESSAGES.badTransition
    case '42501':
      return DSR_MESSAGES.forbidden
    case 'P0002':
      return DSR_MESSAGES.notFound
    // 23514 covers BOTH the doors' own pt-BR input refusals and a bare table
    // CHECK. Only the former may reach a user (CLAUDE.md §8).
    //
    // ⛔ THIS WAS A DENYLIST AND IT WENT STALE EXACTLY AS A DENYLIST DOES. It read
    // `!error.message.includes('dsr_requests_')` — recognising a bare CHECK by one
    // table's name prefix. Slice 3 then added three CHECKs on the OTHER table
    // (`dsr_tasks_attested_redactions_nonneg`, `dsr_tasks_attestation_shape`,
    // `dsr_tasks_attestation_only_on_attest`), whose Postgres text contains no
    // `dsr_requests_`, so every one of them was returned VERBATIM to the UI.
    //
    // ⭐ THE FIX IS THE DIRECTION, NOT THE ENUMERATION. A denylist of things that
    // are unsafe fails OPEN on anything new — a raw Postgres string in front of a
    // user. An allowlist of the doors' OWN messages fails CLOSED: an unrecognised
    // 23514 degrades to a generic pt-BR sentence, which is wrong-but-harmless.
    // Adding `dsr_tasks_` to the denylist would have fixed today's three and left
    // the next table's CHECKs leaking, which is the same defect one migration
    // later.
    //
    // ⚠ The cost, stated: if a door's wording changes without this list, the user
    // gets the generic message instead of the specific one. That is a degradation
    // in helpfulness, not a leak — the failure direction this trade buys.
    case '23514':
      return error.message && DSR_DOOR_CHECK_MESSAGES.has(error.message.trim())
        ? error.message
        : DSR_MESSAGES.unexpected
    default:
      return DSR_MESSAGES.unexpected
  }
}
