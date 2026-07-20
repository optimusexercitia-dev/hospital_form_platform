import type { CadenceStatus, MeetingFrequency } from "@/lib/charters/types";

/**
 * Committee Charters & Meeting Cadence (S4·CH, Phase 21) — pt-BR label maps for the
 * two storage unions (Rule 10). The `meeting_frequency` values and the cadence
 * `status` keys are CONTRACT values (CHECK-constrained / RPC-returned), Portuguese
 * by storage coincidence — these maps resolve the USER-FACING labels the UI shows.
 *
 * Pure + client-safe (type-only import from the frozen `@/lib/charters/types`): the
 * server-rendered cadence badge and the client charter form both import from here,
 * so a single source of truth localizes both. No PHI (Rule 12).
 */

/** The meeting-frequency select labels (ADR 0080 D4). */
export const MEETING_FREQUENCY_LABELS: Record<MeetingFrequency, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
};

/**
 * The cadence window each frequency implies, phrased for helper/context text
 * (semanal → "a cada semana" … trimestral → "a cada três meses"). Mirrors the
 * server-side interval windows (plan §4) for display only — the compliance
 * computation stays in the DEFINER RPC.
 */
export const MEETING_FREQUENCY_WINDOW_LABELS: Record<MeetingFrequency, string> = {
  semanal: "a cada semana",
  quinzenal: "a cada duas semanas",
  mensal: "a cada mês",
  bimestral: "a cada dois meses",
  trimestral: "a cada três meses",
};

/** The cadence status badge labels (ADR 0080 D5). */
export const CADENCE_STATUS_LABELS: Record<CadenceStatus, string> = {
  em_dia: "Em dia",
  em_atraso: "Reunião em atraso",
  sem_reunioes: "Sem reuniões registradas",
  sem_regimento: "Regimento/cadência não configurado",
};
