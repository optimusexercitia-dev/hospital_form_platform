import {
  AlignLeft,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  Image as ImageIcon,
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
  free_text: {
    label: "Texto livre",
    description: "Resposta escrita pela pessoa.",
    Icon: AlignLeft,
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
