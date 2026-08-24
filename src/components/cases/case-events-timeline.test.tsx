/**
 * Component tests for the **Atividade** card (ADR 0137 D12) — the redesign of
 * "Registros".
 *
 * ⛔ THE PROPERTY THIS PROTECTS, and it is the one the redesign newly risks: the card
 * now renders the TEN procedural kinds that `listCaseEvents` has always returned but
 * that `CaseEvent.kind` used to hide behind a too-narrow type. Those rows must NOT
 * carry edit/delete.
 *
 * ⛔⛔ AND THE SUPPRESSION UNDER TEST IS THE **ONLY** CONTROL — so this file is not
 * belt-and-braces, it is the belt. An earlier version of this header claimed three
 * independent mechanisms refused the write. That was FALSE (corrected 2026-08-23 from
 * the live catalog): all three constrain the **new** kind, none constrains **which
 * row may be touched**. `case_events_writer_update` carries
 * `app.is_manual_case_event_kind` in `WITH CHECK`, not `USING`, so
 * `decision_issued -> note` satisfies it; `case_events_writer_delete` has no kind gate
 * at all; and `updateCaseEvent`'s guard inspects the submitted kind, which would be
 * `note`. Un-suppressed, the edit dialog would SUCCEED and silently rewrite a
 * procedural row's kind — not fail harmlessly, which is how the wrong version read.
 * The underlying authz gap is pre-existing and filed; it is not closed here.
 *
 * ⚠ EVERY ABSENCE ASSERTION BELOW IS PAIRED WITH A PRESENCE ASSERTION IN THE SAME
 * RENDER. "No edit button on the procedural row" passes vacuously if the card
 * rendered nothing at all, or if the query for the button is simply wrong; asserting
 * that the MANUAL row in the same list does have one is what proves the query works
 * and the narrowing is real rather than total. The positive case is also the one that
 * reds if someone later over-narrows and takes the control from manual rows too.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import type { AnyCaseEventKind, CaseEvent } from "@/lib/queries/case-documents";

const createCaseEvent = vi.fn();
const deleteCaseEvent = vi.fn();

// The card imports the `'use server'` actions module (pulls next/headers) — stub it.
vi.mock("@/lib/cases/documents-actions", () => ({
  createCaseEvent: (...args: unknown[]) => createCaseEvent(...args),
  deleteCaseEvent: (...args: unknown[]) => deleteCaseEvent(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// The entrance choreography is decorative, dynamically imports GSAP and bails under
// reduced motion. Stubbed to a plain wrapper so these tests measure STRUCTURE, not
// animation — the motion itself is out of scope here by design.
vi.mock("@/components/motion/rise-in-group", () => ({
  RiseInGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { CaseEventsTimeline } from "./case-events-timeline";

// Radix AlertDialog (the delete affordance) needs ResizeObserver — jsdom lacks it.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

function event(
  id: string,
  kind: AnyCaseEventKind,
  overrides: Partial<CaseEvent> = {},
): CaseEvent {
  return {
    id,
    caseId: "case-1",
    kind,
    title: null,
    body: `Corpo do registro ${id}`,
    visibility: "case_readers",
    occurredAt: null,
    occurredTime: null,
    createdBy: "user-1",
    createdByName: "Ana Souza",
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

/**
 * One manual row and one procedural row — the minimum that can tell them apart.
 *
 * ⚠ The titles are chosen NOT to collide with any `EVENT_KIND_LABEL`. The first
 * draft titled the procedural row "Voto registrado", which is exactly the chip label
 * for `vote_cast`, so `getByText` matched the chip AND the title and three tests
 * failed on ambiguity rather than on behaviour. A fixture that collides with the
 * vocabulary under test measures the collision, not the code.
 */
const MIXED: CaseEvent[] = [
  event("manual-1", "decision", { title: "Decisão da comissão" }),
  event("system-1", "vote_cast", { title: "Voto do relator" }),
];

describe("Atividade — the card's own identity", () => {
  it("is headed 'Atividade' and authors ONLY through the 'Adicionar registro' dialog", () => {
    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);

    // Presence half. Without it the absences below would pass on a card that
    // rendered nothing at all.
    // ⚠ EXACT STRING, never `/Atividade/i`. Testing Library matches a string `name`
    // in full after normalization, so this reds if the name becomes "Atividade 3";
    // a substring regex matches that happily — see the invariance test below.
    expect(screen.getByRole("heading", { name: "Atividade" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Adicionar registro" }),
    ).toBeInTheDocument();

    // Absence half — the INLINE COMPOSER, removed 2026-08-24 (superseding half of
    // ADR 0137 D12). ⛔ Three separate queries, not one: the composer had three
    // distinguishable parts and re-introducing any ONE of them is the regression
    // this guards. A single `queryByRole("button", …)` would go green on a card that
    // had grown its textarea and kind pills back.
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Tipo do registro" })).toBeNull();
  });

  it("names the landmark 'Atividade' INVARIANTLY of the record count", () => {
    // ⛔ THE PROPERTY IS INVARIANCE, NOT THE CURRENT VALUE — and this test exists
    // because the version that did not assert it went GREEN while the defect was
    // live. The count badge sits inside the `h2` that names the `<section>` via
    // `aria-labelledby`, so without `aria-hidden` on it the LANDMARK is renamed by
    // its own data: "Atividade 1", "Atividade 2", … Asserting the name once would
    // pin whichever value the fixture happened to produce; asserting it across two
    // different record counts is what pins that the data cannot reach the name.
    //
    // ⚠ It also has to be the REGION, not only the heading. The heading is where
    // the badge lives, but the landmark name is what E2E scopes to and what a
    // screen-reader user navigates by — it is the thing that actually broke, and it
    // is what forced the shared `case-affordance-class.ts` locator to diverge from
    // every sibling's `^…$` pattern.
    const one = render(
      <CaseEventsTimeline caseId="case-1" events={[event("a", "note")]} canWrite />,
    );
    expect(screen.getByRole("region", { name: "Atividade" })).toBeInTheDocument();
    one.unmount();

    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);
    expect(screen.getByRole("region", { name: "Atividade" })).toBeInTheDocument();
  });

  it("keeps the coordinator_only badge on a restricted row", () => {
    render(
      <CaseEventsTimeline
        caseId="case-1"
        events={[event("m", "note", { visibility: "coordinator_only" })]}
        canWrite
      />,
    );
    expect(screen.getByText(/Somente coordenação/i)).toBeInTheDocument();
  });
});

describe("Atividade — the Tudo / Atualizações / Sistema partition", () => {
  it("shows both kinds under Tudo", () => {
    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);
    expect(screen.getByText("Decisão da comissão")).toBeInTheDocument();
    expect(screen.getByText("Voto do relator")).toBeInTheDocument();
  });

  it("Atualizações keeps the manual kinds and drops the procedural ones", () => {
    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizações" }));
    expect(screen.getByText("Decisão da comissão")).toBeInTheDocument();
    expect(screen.queryByText("Voto do relator")).toBeNull();
  });

  it("Sistema keeps the procedural kinds and drops the manual ones", () => {
    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);
    fireEvent.click(screen.getByRole("button", { name: "Sistema" }));
    expect(screen.getByText("Voto do relator")).toBeInTheDocument();
    expect(screen.queryByText("Decisão da comissão")).toBeNull();
  });

  it("shows the empty-FILTER state, distinct from the empty-CARD state", () => {
    render(
      <CaseEventsTimeline
        caseId="case-1"
        events={[event("m", "note")]}
        canWrite
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sistema" }));
    expect(screen.getByText(/Nada por aqui com este filtro/i)).toBeInTheDocument();
    // The card is NOT empty — proving the two states are different copy, not one
    // string doing double duty.
    expect(screen.queryByText(/Nenhum registro ainda/i)).toBeNull();
  });
});

describe("Atividade — edit/delete are MANUAL-only", () => {
  it("offers edit + delete on a manual row and NEITHER on a procedural row", () => {
    render(<CaseEventsTimeline caseId="case-1" events={MIXED} canWrite />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);

    const manualRow = rows.find((r) =>
      within(r).queryByText("Decisão da comissão"),
    );
    const systemRow = rows.find((r) => within(r).queryByText("Voto do relator"));
    // Guard the fixture itself: if these were undefined every assertion below
    // would throw rather than pass, but naming it makes the failure legible.
    expect(manualRow).toBeDefined();
    expect(systemRow).toBeDefined();

    // POSITIVE control — this is what reds if the narrowing goes too far.
    expect(
      within(manualRow!).getByRole("button", { name: /^Editar registro/ }),
    ).toBeInTheDocument();
    expect(
      within(manualRow!).getByRole("button", { name: /^Remover registro/ }),
    ).toBeInTheDocument();

    // The narrowing itself.
    expect(
      within(systemRow!).queryByRole("button", { name: /^Editar registro/ }),
    ).toBeNull();
    expect(
      within(systemRow!).queryByRole("button", { name: /^Remover registro/ }),
    ).toBeNull();
  });

  it("offers nothing to a read-only viewer, on either kind", () => {
    render(
      <CaseEventsTimeline caseId="case-1" events={MIXED} canWrite={false} />,
    );
    // Presence half: the feed still renders for a reader.
    expect(screen.getByText("Decisão da comissão")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editar registro/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });
});

/**
 * ⛔ THE INLINE COMPOSER'S TESTS DID NOT DIE WITH IT — they MOVED, intact, to
 * `case-event-form.test.tsx`. Removing a subject removes its assertions in two
 * directions, and a DELETED assertion is invisible to `lint:vacuous`: the gate reads
 * tests that exist. Three properties were asserted here and are now asserted on the
 * dialog, which since 2026-08-24 is the only authoring path:
 *   · the six manual kinds and NOT the handoff's four action-item types;
 *   · Visibilidade offered to a coordinator and to nobody else (ETH·E3a);
 *   · FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME — the body control's accessible name
 *     is invariant across a validation error. ⚠ The dialog HAD this defect live; it
 *     was fixed in the same change, because the composer's fix had never been
 *     carried over and the composer was no longer there to carry it.
 * One property was genuinely retired, deliberately: "disables submit until the body
 * has content". That gate was the composer's controlled `!body.trim()`; the dialog is
 * uncontrolled and validates server-side, surfacing a pt-BR `FieldError` instead.
 */


/**
 * FUP-0137-KIND-VISUAL-NO-FALLBACK.
 *
 * ⛔ THE INPUT IS A KIND THE DB ADMITS AND THIS BUILD DOES NOT KNOW — which is not a
 * hypothetical: `listCaseEvents` asserts its rows into `AnyCaseEventKind` with a
 * `.returns<>()` that verifies nothing, so widening `case_events_kind_check` in SQL
 * puts exactly this value on the wire with `tsc` green. The cast in the fixture is
 * therefore MODELLING the production path, not defeating the type system.
 *
 * On the pre-fix build the `KIND_VISUAL[ev.kind]` destructure throws and the render
 * dies, so every assertion here reds at once — which is the point: the failure was a
 * blank card, not a missing icon.
 */
describe("Atividade — a kind this build has never heard of", () => {
  const FUTURE_KIND = "quantum_leap" as AnyCaseEventKind;

  it("renders the row with a neutral fallback instead of taking the card down", () => {
    render(
      <CaseEventsTimeline
        caseId="case-1"
        events={[
          event("future-1", FUTURE_KIND, { title: "Evento do futuro" }),
          event("manual-1", "note", { title: "Nota da comissão" }),
        ]}
        canWrite
      />,
    );

    // The card survived and BOTH rows are present.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Evento do futuro")).toBeInTheDocument();

    // The chip falls back to the raw kind. An empty chip would be the quieter
    // sibling defect (`EVENT_KIND_LABEL` misses it too), so it is pinned here.
    expect(screen.getByText("quantum_leap")).toBeInTheDocument();

    // POSITIVE CONTROL — a known kind still resolves its real pt-BR label, so the
    // fallback is narrow rather than swallowing the whole vocabulary.
    // ⚠ Scoped to the ROW: "Nota" is also the composer's `note` radio pill, so an
    // unscoped `getByText` matches twice and fails on ambiguity rather than on
    // behaviour — the same fixture-collision this file's header records.
    const manualRow = screen
      .getAllByRole("listitem")
      .find((r) => within(r).queryByText("Nota da comissão"));
    expect(manualRow).toBeDefined();
    expect(within(manualRow!).getByText("Nota")).toBeInTheDocument();
  });

  it("classifies the unknown kind as Sistema, so it never gains edit/delete", () => {
    render(
      <CaseEventsTimeline
        caseId="case-1"
        events={[
          event("future-1", FUTURE_KIND, { title: "Evento do futuro" }),
          event("manual-1", "note", { title: "Nota da comissão" }),
        ]}
        canWrite
      />,
    );

    const unknownRow = screen
      .getAllByRole("listitem")
      .find((r) => within(r).queryByText("Evento do futuro"));
    expect(unknownRow).toBeDefined();

    // ⛔ The write controls are the ONLY control over a procedural row (see this
    // file's header), so an unknown kind must inherit the suppression rather than
    // fall through it. `isCaseEventKind` already answers this — the assertion pins
    // that the fallback did not change the answer.
    expect(
      within(unknownRow!).queryByRole("button", { name: /^Editar registro/ }),
    ).toBeNull();
    expect(
      within(unknownRow!).queryByRole("button", { name: /^Remover registro/ }),
    ).toBeNull();

    // POSITIVE CONTROL — the manual row in the same render still has both.
    const manualRow = screen
      .getAllByRole("listitem")
      .find((r) => within(r).queryByText("Nota da comissão"));
    expect(
      within(manualRow!).getByRole("button", { name: /^Editar registro/ }),
    ).toBeInTheDocument();
  });
});
