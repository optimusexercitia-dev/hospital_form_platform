import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "./format";

/**
 * Small assignee avatar for the cases table/kanban. Initials on the soft accent
 * tint when assigned; a dashed circle with an em-dash when unassigned (the
 * design-system "null assignee" convention).
 */
export function AssigneeAvatar({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  if (!name) {
    return (
      <span
        role="img"
        aria-label="Não atribuído"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-muted-foreground/40 text-xs text-muted-foreground",
          className,
        )}
      >
        —
      </span>
    );
  }
  return (
    <Avatar className={cn("size-7", className)}>
      <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
