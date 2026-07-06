import type {
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  TargetComparator,
} from "@/lib/indicators/types";

/**
 * Static in-app pt-BR template catalog (F2 — "Criar a partir de modelo").
 *
 * A code-level constant (NO schema, NO backend call) of commonly-tracked hospital
 * quality indicators — the ANVISA/NSP obligatory set plus common CCIH /
 * quality-committee metrics — that PREFILL the builder's definition fields
 * (name, kind, direction, comparator, target, unit, numerator/denominator labels,
 * suggested frequency). The coordinator picks a template, the builder opens
 * pre-populated, and they adjust + bind the data source themselves.
 *
 * Deliberately data-source-agnostic: templates seed the *definition* only. Whether
 * the indicator is measured manually, derived from a form, or hybrid is chosen in
 * the builder (a template can't know which form a given hospital uses). A `taxa`
 * template therefore leaves `dataSource` for the builder — its default is manual,
 * and the coordinator switches to híbrido if they want a derived numerator.
 *
 * Easy to extend: append an entry to {@link INDICATOR_TEMPLATES}. Grouped by
 * `category` for the picker. All strings pt-BR (Rule 10).
 */

/** The definition fields a template prefills (a subset of the builder form). */
export interface IndicatorTemplate {
  /** Stable id (kebab-case) — the picker's React key + selection value. */
  id: string;
  /** Grouping bucket for the picker (pt-BR). */
  category: string;
  /** The prefilled indicator name. */
  name: string;
  /** A short pt-BR description of what the indicator measures + its source basis. */
  description: string;
  kind: IndicatorKind;
  direction: IndicatorDirection;
  targetComparator: TargetComparator;
  /** Suggested target value (the coordinator confirms/adjusts). */
  targetValue: number;
  /** Unit label (e.g. "%", "por 1.000 pacientes-dia", "dias"). */
  unit: string;
  numeratorLabel: string;
  denominatorLabel: string;
  frequency: IndicatorFrequency;
}

export const INDICATOR_TEMPLATE_CATEGORIES = [
  "Segurança do paciente (NSP)",
  "Controle de infecção (CCIH)",
  "Gestão hospitalar",
] as const;

export const INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  // --- Controle de infecção (CCIH) -----------------------------------------
  {
    id: "taxa-icsrc",
    category: "Controle de infecção (CCIH)",
    name: "Taxa de infecção de corrente sanguínea associada a cateter (ICSRC)",
    description:
      "Densidade de incidência de infecções primárias de corrente sanguínea associadas a cateter venoso central, por 1.000 cateteres-dia. Indicador obrigatório de vigilância de IRAS.",
    kind: "taxa",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 2,
    unit: "por 1.000 cateteres-dia",
    numeratorLabel: "Número de infecções de corrente sanguínea associadas a cateter",
    denominatorLabel: "Cateteres venosos centrais-dia",
    frequency: "mensal",
  },
  {
    id: "densidade-iras",
    category: "Controle de infecção (CCIH)",
    name: "Densidade de incidência de IRAS",
    description:
      "Densidade de incidência global de infecções relacionadas à assistência à saúde, por 1.000 pacientes-dia.",
    kind: "taxa",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 5,
    unit: "por 1.000 pacientes-dia",
    numeratorLabel: "Número de casos de IRAS",
    denominatorLabel: "Pacientes-dia",
    frequency: "mensal",
  },
  {
    id: "adesao-higiene-maos",
    category: "Controle de infecção (CCIH)",
    name: "Taxa de adesão à higiene das mãos",
    description:
      "Percentual de oportunidades de higiene das mãos em que a prática foi realizada, observadas nos cinco momentos preconizados pela OMS.",
    kind: "percentual",
    direction: "maior_melhor",
    targetComparator: ">=",
    targetValue: 80,
    unit: "%",
    numeratorLabel: "Oportunidades com higiene das mãos realizada",
    denominatorLabel: "Total de oportunidades observadas",
    frequency: "mensal",
  },
  {
    id: "taxa-ipcs-vm",
    category: "Controle de infecção (CCIH)",
    name: "Taxa de pneumonia associada à ventilação mecânica (PAV)",
    description:
      "Densidade de incidência de pneumonia associada à ventilação mecânica, por 1.000 ventiladores-dia.",
    kind: "taxa",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 3,
    unit: "por 1.000 ventiladores-dia",
    numeratorLabel: "Número de casos de PAV",
    denominatorLabel: "Ventiladores mecânicos-dia",
    frequency: "mensal",
  },

  // --- Segurança do paciente (NSP) -----------------------------------------
  {
    id: "taxa-queda-com-dano",
    category: "Segurança do paciente (NSP)",
    name: "Taxa de quedas com dano",
    description:
      "Densidade de incidência de quedas de pacientes que resultaram em dano, por 1.000 pacientes-dia. Meta de segurança do paciente do NSP.",
    kind: "taxa",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 1,
    unit: "por 1.000 pacientes-dia",
    numeratorLabel: "Número de quedas com dano",
    denominatorLabel: "Pacientes-dia",
    frequency: "mensal",
  },
  {
    id: "taxa-lesao-por-pressao",
    category: "Segurança do paciente (NSP)",
    name: "Taxa de lesão por pressão adquirida",
    description:
      "Densidade de incidência de lesões por pressão adquiridas na instituição, por 1.000 pacientes-dia.",
    kind: "taxa",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 2,
    unit: "por 1.000 pacientes-dia",
    numeratorLabel: "Número de lesões por pressão adquiridas",
    denominatorLabel: "Pacientes-dia",
    frequency: "mensal",
  },
  {
    id: "conformidade-cirurgia-segura",
    category: "Segurança do paciente (NSP)",
    name: "Conformidade da lista de verificação de cirurgia segura",
    description:
      "Percentual de cirurgias em que a lista de verificação de segurança cirúrgica (checklist) foi integralmente aplicada.",
    kind: "percentual",
    direction: "maior_melhor",
    targetComparator: ">=",
    targetValue: 95,
    unit: "%",
    numeratorLabel: "Cirurgias com checklist completo",
    denominatorLabel: "Total de cirurgias realizadas",
    frequency: "mensal",
  },
  {
    id: "notificacao-incidentes",
    category: "Segurança do paciente (NSP)",
    name: "Número de notificações de incidentes de segurança",
    description:
      "Contagem de incidentes de segurança do paciente notificados ao NSP no período. Uma cultura de notificação alta é desejável.",
    kind: "contagem",
    direction: "maior_melhor",
    targetComparator: ">=",
    targetValue: 20,
    unit: "notificações",
    numeratorLabel: "Notificações registradas",
    denominatorLabel: "",
    frequency: "mensal",
  },

  // --- Gestão hospitalar ----------------------------------------------------
  {
    id: "taxa-ocupacao",
    category: "Gestão hospitalar",
    name: "Taxa de ocupação hospitalar",
    description:
      "Percentual de leitos operacionais ocupados no período — pacientes-dia sobre leitos-dia disponíveis.",
    kind: "percentual",
    direction: "maior_melhor",
    targetComparator: ">=",
    targetValue: 85,
    unit: "%",
    numeratorLabel: "Pacientes-dia",
    denominatorLabel: "Leitos-dia disponíveis",
    frequency: "mensal",
  },
  {
    id: "tempo-medio-permanencia",
    category: "Gestão hospitalar",
    name: "Tempo médio de permanência",
    description:
      "Média de dias de internação por paciente que teve alta no período. Um valor menor indica maior eficiência do cuidado.",
    kind: "tempo_medio",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 5,
    unit: "dias",
    numeratorLabel: "Pacientes-dia de internação",
    denominatorLabel: "Número de altas",
    frequency: "mensal",
  },
  {
    id: "taxa-mortalidade-institucional",
    category: "Gestão hospitalar",
    name: "Taxa de mortalidade institucional",
    description:
      "Percentual de óbitos ocorridos após 24 horas de internação sobre o total de saídas hospitalares.",
    kind: "percentual",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 4,
    unit: "%",
    numeratorLabel: "Óbitos após 24h de internação",
    denominatorLabel: "Total de saídas (altas + óbitos)",
    frequency: "mensal",
  },
  {
    id: "taxa-readmissao-30d",
    category: "Gestão hospitalar",
    name: "Taxa de readmissão em 30 dias",
    description:
      "Percentual de pacientes readmitidos de forma não planejada em até 30 dias após a alta.",
    kind: "percentual",
    direction: "menor_melhor",
    targetComparator: "<=",
    targetValue: 10,
    unit: "%",
    numeratorLabel: "Readmissões não planejadas em 30 dias",
    denominatorLabel: "Total de altas",
    frequency: "mensal",
  },
];
