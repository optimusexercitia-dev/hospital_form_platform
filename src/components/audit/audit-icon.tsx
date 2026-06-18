import { createElement } from "react";
import {
  CalendarDays,
  ClipboardList,
  FileStack,
  FolderOpen,
  Layers,
  type LucideIcon,
  MessageSquare,
  PenLine,
  Rows3,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { AuditEntityType } from "@/lib/queries/audit";

/**
 * Map an audit entity type to a lucide icon — purely decorative reinforcement of
 * the entity LABEL (state/type is conveyed by icon + text together, never icon
 * alone, a11y §6). A slug with no explicit icon (additive backend growth) falls
 * back to a neutral "rows" glyph so the feed never renders without one.
 */
const ENTITY_ICON: Partial<Record<AuditEntityType, LucideIcon>> = {
  form: ClipboardList,
  form_version: FileStack,
  form_section: Rows3,
  form_item: Rows3,
  commission: FolderOpen,
  commission_member: Users,
  response: Send,
  signoff: PenLine,
  case: FolderOpen,
  case_phase: Layers,
  meeting: CalendarDays,
  meeting_signature: PenLine,
  interview: MessageSquare,
  audit: ShieldCheck,
};

function resolveEntityIcon(entity: AuditEntityType | string): LucideIcon {
  return ENTITY_ICON[entity as AuditEntityType] ?? Rows3;
}

/**
 * Renders the lucide icon for an audit entity type. A module-scope component (not
 * an icon resolved into a `const` at the call site) so it is a stable component
 * reference — mirrors the timeline's `EventIcon` and satisfies
 * `react-hooks/static-components`.
 */
export function EntityIcon({
  entity,
  className,
}: {
  entity: AuditEntityType | string;
  className?: string;
}) {
  // `createElement` (not JSX of a local `const`) keeps
  // `react-hooks/static-components` happy: the icon is resolved from the stable
  // `ENTITY_ICON` map, never a component re-declared during render. Mirrors the
  // timeline's `EventIcon`. Always decorative (`aria-hidden`) — the label carries
  // the meaning.
  return createElement(resolveEntityIcon(entity), {
    "aria-hidden": true,
    className,
  });
}
