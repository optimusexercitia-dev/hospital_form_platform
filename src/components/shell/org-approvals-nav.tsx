"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { orgHref } from "@/lib/routing";

/**
 * Top navigation for the org-level approvals area (`/o/[org]/documentos-pendentes`).
 * A single entry — "Aprovações pendentes" — that reads as the active/current
 * location via a prefix match (so the approver detail page keeps it highlighted).
 *
 * This shell is deliberately NOT the commission-scoped `AppSidebar`: the approvals
 * queue is an ORG-level surface an approver may reach from OUTSIDE their commission,
 * so there is no single commission to seed a commission nav with. Visibility here is
 * convenience only — the route enforces its own server-side gate + RLS.
 */
export function OrgApprovalsNav({ org }: { org: string }) {
  const pathname = usePathname();
  const href = orgHref(org, "documentos-pendentes");
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Navegação da organização"
      className="ml-4 hidden items-center gap-1 sm:flex"
    >
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <ClipboardCheck aria-hidden="true" className="size-4" />
        Aprovações pendentes
      </Link>
    </nav>
  );
}
