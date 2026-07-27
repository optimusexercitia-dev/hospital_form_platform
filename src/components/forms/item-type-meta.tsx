import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Clock,
  Grid3x3,
  Group,
  Hash,
  Image as ImageIcon,
  Minus,
  Rows3,
  ShieldAlert,
  Type,
} from "lucide-react";

import type { ItemType } from "@/lib/queries/forms";

/** Display metadata (pt-BR label + icon) for each item type, used by the
 *  block cards and the "Adicionar bloco" picker. Kept in one place so the
 *  builder's vocabulary stays consistent. */
export interface ItemTypeMeta {
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export const ITEM_TYPE_META: Record<ItemType, ItemTypeMeta> = {
  multiple_choice: {
    label: "Múltipla escolha",
    description: "Uma opção entre várias (botões de rádio).",
    Icon: CircleDot,
  },
  dropdown: {
    label: "Lista suspensa",
    description: "Uma opção entre várias (menu).",
    Icon: ChevronDownSquare,
  },
  checkbox: {
    label: "Caixas de seleção",
    description: "Uma ou mais opções.",
    Icon: CheckSquare,
  },
  short_text: {
    label: "Resposta curta",
    description: "Texto de uma linha.",
    Icon: Minus,
  },
  free_text: {
    label: "Resposta longa",
    description: "Texto de várias linhas.",
    Icon: AlignLeft,
  },
  number: {
    label: "Número",
    description: "Valor numérico, com mínimo/máximo opcionais.",
    Icon: Hash,
  },
  date: {
    label: "Data",
    description: "Data, com mínimo/máximo opcionais.",
    Icon: CalendarDays,
  },
  time: {
    label: "Hora",
    description: "Horário no formato 24h.",
    Icon: Clock,
  },
  section_text: {
    label: "Texto explicativo",
    description: "Texto em Markdown, apenas leitura.",
    Icon: Type,
  },
  image: {
    label: "Imagem",
    description: "Imagem ilustrativa, apenas leitura.",
    Icon: ImageIcon,
  },
  // FF-1 (ADR 0087) — the two CONTAINER types. Both collect no answer of their
  // own; they own child blocks. Offered only while the `repeating_groups` flag
  // is ON (see AddBlockMenu), but the metadata is unconditional so an already
  // authored container still renders its label/icon if the flag is flipped off.
  group: {
    label: "Grupo",
    description: "Sub-seção: agrupa perguntas relacionadas, sem repetição.",
    Icon: Group,
  },
  repeating_group: {
    label: "Grupo repetível",
    description: "Conjunto de perguntas que pode ser repetido várias vezes.",
    Icon: Rows3,
  },
  // FF-2 (ADR 0089) — the two MATRIX types. `backend` added the entries as the
  // mechanical half of widening the shared `ItemType` (this Record is exhaustive
  // and every consumer does an UNGUARDED `ITEM_TYPE_META[item.itemType]` lookup,
  // so a missing entry is a runtime crash the moment a matrix block renders).
  // The copy below is the FF-2 authoring wording: each line names the ONE thing
  // the author must understand before choosing the type — a matrix answers by
  // row, a risk matrix answers once and computes.
  matrix: {
    label: "Matriz",
    description: "Vários critérios avaliados na mesma escala, um por linha.",
    Icon: Grid3x3,
  },
  risk_matrix: {
    label: "Matriz de risco",
    description: "Severidade × probabilidade, com pontuação e faixa calculadas.",
    Icon: ShieldAlert,
  },
};

/** The two CONTAINER types, in the order the "Estrutura" picker offers them. */
export const CONTAINER_TYPES: ItemType[] = ["group", "repeating_group"];

/**
 * FF-2 — the two MATRIX types, in the order the "Matrizes" picker offers them.
 * A separate group from "Perguntas" because they answer differently: a matrix
 * has no scalar value at all (its payload is `answer_matrix_cells`), which is
 * also why it is not a condition target.
 */
export const MATRIX_TYPES: ItemType[] = ["matrix", "risk_matrix"];
