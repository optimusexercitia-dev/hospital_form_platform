/**
 * pt-BR display copy for MIN — meeting audio → generated ata (ADR 0099).
 *
 * Centralizes every user-facing string for F1–F5 in one place, mirroring
 * `meeting-labels.ts`'s convention: the DB/service carries stable slugs, this file is
 * the single place they become human copy, so every audio-minutes screen agrees.
 * `src/lib/minutes-jobs/messages.ts` owns the SERVER-side error vocabulary
 * (`ActionState.error`, already pt-BR) — this file owns purely presentational UI copy
 * that never comes from an action result.
 */

export const MINUTES_UI = {
  // F1 — Ata card slot
  nudgeScheduled: "Marque a reunião como realizada para usar áudio.",
  startButton: "Usar áudio",
  uploadingChip: "Enviando áudio…",
  processingChip: "Processando áudio…",
  reviewButton: "Revisar ata gerada",
  retryButton: "Tentar novamente",
  cancelChipLabel: "Cancelar processamento de áudio",
  cancelConfirmTitle: "Cancelar o processamento do áudio?",
  cancelConfirmUploading:
    "O envio será interrompido. O arquivo enviado até aqui será descartado.",
  cancelConfirmProcessing:
    "O processamento em andamento será descartado. Você poderá enviar o áudio novamente depois.",
  cancelConfirmAction: "Cancelar processamento",
  cancelConfirmDismiss: "Manter",

  // F2 — Upload dialog
  dialogTitle: "Gerar ata a partir do áudio",
  step1Title: "Confirme a lista de participantes",
  step1Warning:
    "A atribuição de falas na ata gerada usa esta lista de participantes. Revise-a antes de continuar.",
  step1LinkToAttendees: "Editar participantes",
  step1ZeroAttendees:
    "Adicione ao menos um participante antes de gerar a ata por áudio.",
  step1MultiPart:
    "Se a gravação está dividida em vários arquivos, junte-os em um único arquivo antes de continuar — o envio aceita apenas um arquivo por vez.",
  step1Continue: "Continuar",
  step2Title: "Envie o arquivo de áudio",
  step2FileLabel: "Arquivo de áudio",
  step2Accept: "Formatos aceitos: M4A, AAC, MP3, WAV, OGG, Opus, WebM, FLAC — até 500 MB.",
  step2FileMissing: "Selecione um arquivo de áudio.",
  step2FileTooLarge: "O arquivo excede o limite de 500 MB.",
  step2FileTypeInvalid: "Envie um arquivo de áudio em um dos formatos aceitos.",
  step2Uploading: "Enviando…",
  step2UploadFailed:
    "Não foi possível enviar o áudio. Verifique sua conexão e tente novamente.",
  step2RetryFromScratch:
    "Se o envio falhar, será necessário selecionar o arquivo novamente — não há retomada parcial.",
  step2Submit: "Enviar e gerar ata",
  step2Cancel: "Cancelar",
  step2Preparing: "Preparando envio…",
  step2Finalizing: "Finalizando…",
  /** N2: the `role="progressbar"` accessible name — the percentage itself lives outside `aria-live`. */
  step2ProgressLabel: "Progresso do envio",

  // F3 — Review page
  reviewHeading: "Revisão da ata",
  reviewBackToMeeting: "Voltar à reunião",
  overwriteWarningTitle: "Esta reunião já tem uma ata registrada",
  overwriteWarningBody:
    "Concluir a revisão substituirá o texto atual da ata pelo texto gerado abaixo. O texto atual continua disponível para consulta até você concluir.",
  overwriteShowCurrent: "Ver ata atual",
  overwriteHideCurrent: "Ocultar ata atual",
  ataEmpty:
    "O serviço não gerou um texto de ata para este áudio. Escreva a ata manualmente antes de concluir.",
  agendaHeading: "Pauta",
  agendaMatchedTag: "Item existente",
  agendaNewTag: "Novo item",
  agendaExistingLabel: "Texto atual",
  agendaExtractedLabel: "Extraído do áudio",
  agendaIncludeToggle: "Incluir na ata",
  agendaNewTitlePlaceholder: "Título do novo item de pauta",
  /** Stands in for an agenda item's title inside a composed accessible name while it is still untitled. */
  agendaItemFallbackName: "item de pauta",
  agendaNoItems: "Nenhum item de pauta foi extraído do áudio.",
  looseResolutionsHeading: "Decisões sem item de pauta associado",
  looseResolutionsBody:
    "O áudio registrou estas decisões sem uma referência clara a um item de pauta. Anexe cada uma a um item, ou mantenha-a aqui — nenhuma decisão é descartada.",
  looseResolutionAttach: "Anexar a um item",
  looseResolutionAttachTo: "Anexar a…",
  actionsHeading: "Itens de ação",
  actionsNoItems: "Nenhum item de ação foi extraído do áudio.",
  actionOwnerLabel: "Responsável",
  actionOwnerUnassigned: "Sem responsável",
  actionOwnerHint: "Indicado em áudio",
  actionDueLabel: "Prazo",
  actionDueHint: "Indicado em áudio",
  actionAgendaLabel: "Item de pauta relacionado",
  actionAgendaNone: "Nenhum",
  actionIncludeToggle: "Incluir na aplicação",
  nextMeetingHeading: "Próxima reunião",
  nextMeetingSuggested: "Sugestão extraída do áudio",
  nextMeetingCta: "Agendar próxima reunião",
  nextMeetingNoSuggestion: "Nenhuma sugestão de próxima reunião foi extraída.",
  speakersHeading: "Falantes",
  speakersNote:
    "As falas identificadas aqui são uma estimativa do áudio e não substituem a lista de presença. Elas não alteram os registros de participação da reunião.",
  speakersUnidentified: "Voz não identificada",
  /** N5: shown instead of a raw attendee-ref UUID when the service's name lookup missed. */
  speakersUnknownLabel: "Participante não identificado",
  speakersNone: "Nenhum falante foi identificado no áudio.",
  transcriptHeading: "Transcrição completa",
  transcriptLoading: "Carregando transcrição…",
  transcriptEmpty: "Transcrição vazia.",
  concludeButton: "Concluir revisão",
  concludeConfirmTitle: "Concluir a revisão da ata?",
  concludeConfirmOverwrite: "O texto atual da ata será substituído.",
  concludeConfirmAction: "Concluir",
  concludeConfirmCancel: "Cancelar",
  concludeSuccessBanner: "Ata aplicada com sucesso.",
  dirtySaving: "Salvando…",
  dirtySaved: "Salvo",
  dirtySaveFailed: "Não foi possível salvar as alterações automaticamente.",

  // F4 — Meetings list badge
  f4BadgeProcessing: "Processando",
  f4BadgeDone: "Ata gerada",
} as const;

/** `há Xmin` / `há Xh` — F1's elapsed-time chip, from a job's `createdAt`. */
export function formatElapsed(fromIso: string, nowMs: number = Date.now()): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "";
  const minutes = Math.max(0, Math.round((nowMs - from) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `há ${hours} h`;
}

/** The 80-char discipline for one part of a composed accessible name (N3/R1). */
const LABEL_PART_MAX_CHARS = 80;

function truncateLabelPart(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > LABEL_PART_MAX_CHARS
    ? `${trimmed.slice(0, LABEL_PART_MAX_CHARS)}…`
    : trimmed;
}

/**
 * N3 + R1: a UNIQUE accessible name for the agenda card's "attach" buttons.
 *
 * Every button shares the same visible label ("Anexar a um item"), and the same loose
 * resolution renders one button PER agenda card — so naming by resolution alone (N3's
 * first fix) still left a screen-reader user hearing N identically-named buttons with no
 * way to tell which item they were attaching to. R1 folds the TARGET into the name, which
 * is what actually distinguishes the buttons: the pair (resolution, agenda item) is unique
 * across the whole review page.
 *
 * Both parts are truncated independently so a long dictated decision can never push the
 * agenda item — the disambiguating half — out of the name.
 *
 * The name is PREFIXED with the button's own visible label, read from the same constant the
 * button renders, so the two cannot drift apart. That is WCAG 2.5.3 (Label in Name): a
 * speech-input user says "Anexar a um item", and the accessible name must contain that
 * visible text for the command to match. No arrow/symbol characters — screen readers
 * announce them noisily.
 */
export function formatAttachResolutionLabel(
  resolutionText: string,
  agendaItemTitle: string,
): string {
  const resolution = truncateLabelPart(resolutionText);
  const item = truncateLabelPart(agendaItemTitle) || MINUTES_UI.agendaItemFallbackName;
  return `${MINUTES_UI.looseResolutionAttach}: "${resolution}" a "${item}"`;
}

/** A bare UUID (v1–v5 shape) — the machine identifier `normalize.ts` falls back to when a speaker name lookup misses (N5). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** N5: never render a raw attendee-ref UUID as a speaker's name. */
export function displaySpeakerLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed && !UUID_RE.test(trimmed) ? trimmed : MINUTES_UI.speakersUnknownLabel;
}

/** The confirm-dialog counts line for F3's conclude bar. */
export function formatApplyCounts(counts: {
  agendaUpdated: number;
  agendaCreated: number;
  actionsCreated: number;
  actionsUnassigned: number;
}): string {
  const parts = [
    `${counts.agendaUpdated} ${counts.agendaUpdated === 1 ? "item de pauta atualizado" : "itens de pauta atualizados"}`,
    `${counts.agendaCreated} ${counts.agendaCreated === 1 ? "item de pauta criado" : "itens de pauta criados"}`,
    `${counts.actionsCreated} ${counts.actionsCreated === 1 ? "item de ação criado" : "itens de ação criados"}`,
  ];
  if (counts.actionsUnassigned > 0) {
    parts.push(
      `${counts.actionsUnassigned} ${counts.actionsUnassigned === 1 ? "sem responsável" : "sem responsável"}`,
    );
  }
  return `${parts.join(", ")}.`;
}
