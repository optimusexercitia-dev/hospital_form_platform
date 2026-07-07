/**
 * Render tests for the {@link PublishedOutcomesCard} (grouped-adjustments §G):
 * the read-only "Desfechos disponíveis" card shown for a published/archived
 * process. Confirms it resolves offered ids against the vocabulary (in position
 * order), surfaces the adverse / action-plan markers, and shows the pt-BR empty
 * state when the process offers none.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { PublishedOutcomesCard } from "./published-outcomes-card";

const OUTCOMES: CaseOutcome[] = [
  {
    id: "o1",
    commissionId: "c1",
    label: "Evento adverso",
    colorToken: "red",
    requiresActionPlan: true,
    isAdverse: true,
    archived: false,
    position: 1,
  },
  {
    id: "o2",
    commissionId: "c1",
    label: "Near miss",
    colorToken: "amber",
    requiresActionPlan: false,
    isAdverse: false,
    archived: false,
    position: 2,
  },
  {
    id: "o3",
    commissionId: "c1",
    label: "Sem dano",
    colorToken: "green",
    requiresActionPlan: false,
    isAdverse: false,
    archived: false,
    position: 3,
  },
];

describe("PublishedOutcomesCard", () => {
  it("lists the offered outcomes with their markers", () => {
    render(
      <PublishedOutcomesCard
        outcomes={OUTCOMES}
        offeredOutcomeIds={["o1", "o3"]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Desfechos disponíveis" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento adverso")).toBeInTheDocument();
    expect(screen.getByText("Sem dano")).toBeInTheDocument();
    // Not offered → not shown.
    expect(screen.queryByText("Near miss")).toBeNull();
    // Adverse + action-plan markers surface for the adverse outcome.
    expect(screen.getByText("Adverso")).toBeInTheDocument();
    expect(screen.getByText("Plano de ação")).toBeInTheDocument();
  });

  it("shows a pt-BR empty state when no outcome is offered", () => {
    render(<PublishedOutcomesCard outcomes={OUTCOMES} offeredOutcomeIds={[]} />);
    expect(
      screen.getByText(/não oferece desfechos/i),
    ).toBeInTheDocument();
  });
});
