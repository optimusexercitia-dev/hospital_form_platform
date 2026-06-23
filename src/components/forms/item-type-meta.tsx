import {
  AlignLeft,
  CalendarDays,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Clock,
  Hash,
  Image as ImageIcon,
  Minus,
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
};
