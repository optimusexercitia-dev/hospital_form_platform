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
  requestCreated: 'Solicitação registrada e tarefas de execução distribuídas.',
  requestClosed: 'Solicitação encerrada.',
  taskCompleted: 'Tarefa concluída.',
  disposalDone: 'Descarte executado.',
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
 * Slice 4 owns rewriting the referral dispose dialog with it and closing
 * `FUP-DISPOSE-DIALOG-OVERCLAIM` (the shipped "apaga permanentemente … todos os
 * campos" over-claim). It is written HERE, in Slice 2, so this surface never
 * ships the over-claim in the first place — the plan's explicit instruction.
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

/** The task kinds, in the order the inbox lists them. */
export const DSR_TASK_KIND_LABELS: Record<string, string> = {
  dispose_case: 'Descartar dados do caso',
  dispose_event: 'Descartar dados do evento',
  dispose_referral: 'Descartar dados do encaminhamento',
  dispose_meeting: 'Descartar a ata da reunião',
  attest_review: 'Revisar e atestar',
  notify_scrub_check: 'Verificar resíduo em notificações',
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
    // 23514 covers both the doors' own pt-BR input refusals and a bare table
    // CHECK. The door's message is user-readable; a bare CHECK's is not, and it
    // is recognisable by the constraint name Postgres puts in it.
    case '23514':
      return error.message && !error.message.includes('dsr_requests_')
        ? error.message
        : DSR_MESSAGES.unexpected
    default:
      return DSR_MESSAGES.unexpected
  }
}
