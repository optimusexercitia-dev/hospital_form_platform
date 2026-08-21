/**
 * ADR 0131's soft preventive control is RENDERED and WIRED — asserted on rendered
 * output, never on source.
 *
 * ⛔ `.claude/rules/ui-copy-forbidden-strings.md` is binding here and it cuts BOTH ways.
 * It was written about proving the UI does NOT say something, and the measured lesson
 * was that source cannot separate live copy from prose about it (0 true / 4 false
 * positives). The same holds for proving the UI DOES say something: every component
 * annotated this round carries a docblock quoting the hint, so a grep for the sentence
 * would go green on a file where the JSX was deleted and only the comment survived.
 * These assertions therefore run against the DOM, where comments do not exist.
 *
 * ⭐ AND PRESENCE ALONE IS NOT THE PROPERTY. Text on screen that no control points at
 * is invisible to a screen-reader user, who meets the field and not the paragraph. Every
 * claim below resolves the control's `aria-describedby` to a real element and reads THAT
 * element's text — so deleting the wiring reds even though the sentence still renders.
 *
 * THE ROSTER, and what it does and does not cover. Fourteen title/free-text sites were
 * annotated; mounting all fourteen would mean fourteen action-mock harnesses for one
 * sentence. Pinned here instead: the PRIMITIVE (which all twelve legacy sites share, so
 * a regression in it reds once for all of them) plus one real consumer per WIRING SHAPE —
 * the render-prop path (`AgendaItemForm`, `AttachmentLinkForm`) and the
 * already-`useFieldIds` path (`DsrAttestForm`). ⚠ Stated plainly so this is not read as
 * "all fourteen are pinned": a site that forgot to spread `hintId` onto its control would
 * NOT be caught here. That gap is real; the primitive cannot close it, because
 * `aria-describedby` is the one part a render prop cannot apply for its child.
 */

import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

const attestDsrTask = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/dsr/actions", () => ({
  attestDsrTask: (...a: unknown[]) => attestDsrTask(...a),
}));
vi.mock("@/lib/meetings/actions", () => ({
  createAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
}));
vi.mock("@/lib/interviews/actions", () => ({
  addInterviewLink: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import type { DsrTaskRow } from "@/lib/queries/dsr";
import { PHI_TITLE_HINT, PHI_FREE_TEXT_HINT, PhiInputHint } from "./phi-input-hint";
import { AgendaItemForm } from "@/components/meetings/agenda-item-form";
import { AttachmentLinkForm } from "@/components/interviews/attachment-link-form";
import { DsrAttestForm } from "@/components/dsr/dsr-attest-form";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/** The sentence ADR 0131 Amendment 1 promoted. Both constants open with it. */
const ADR_0131_SENTENCE = "Não inclua dados do paciente.";

/**
 * Resolve a control's `aria-describedby` to the described elements and return their
 * combined text.
 *
 * ⛔ Reads the ATTRIBUTE and follows it, rather than asserting the sentence appears
 * somewhere on screen. The two differ exactly where it matters: a hint rendered beside
 * an unwired control passes the second check and fails this one, and an unwired hint is
 * the failure mode a sighted-only review cannot see.
 *
 * `aria-describedby` is an ID LIST, so every id is resolved — a field carrying both an
 * error and the hint must not lose the hint to the error.
 */
function describedText(control: HTMLElement): string {
  const ids = (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  return ids
    .map((id) => {
      const node = control.ownerDocument.getElementById(id);
      // A dangling describedby is WORSE than none: assistive tech announces nothing
      // and every visual check still passes.
      expect(node, `aria-describedby points at missing id "${id}"`).not.toBeNull();
      return node?.textContent ?? "";
    })
    .join(" ");
}

function task(): DsrTaskRow {
  return {
    id: "task-1",
    requestId: "req-1",
    kind: "attest_review",
    module: "case",
    entityId: "entity-1",
    commissionId: "c1",
    commissionName: "CCIH",
    commissionSlug: "ccih",
    hospitalId: "h1",
    status: "pending",
    note: null,
    completionNote: null,
    attestedByName: null,
    attestedRedactions: null,
    completedAt: null,
    createdAt: "2026-08-20T00:00:00Z",
    canExecute: true,
  };
}

// ---------------------------------------------------------------------------
// Claim 1 — the primitive
// ---------------------------------------------------------------------------

describe("PhiInputHint — the shared primitive", () => {
  it("renders the hint and hands the caller an id that resolves to it", () => {
    render(
      <PhiInputHint>
        {(hintId) => (
          <label className="flex flex-col">
            <span>Título</span>
            <input type="text" aria-describedby={hintId} />
          </label>
        )}
      </PhiInputHint>,
    );

    const control = screen.getByLabelText("Título");
    expect(describedText(control)).toContain(ADR_0131_SENTENCE);
    expect(describedText(control)).toBe(PHI_TITLE_HINT);
  });

  it("serves the free-text reason on the freeText variant, and NOT the title reason", () => {
    render(
      <PhiInputHint variant="freeText">
        {(hintId) => (
          <label>
            <span>Observações</span>
            <textarea aria-describedby={hintId} />
          </label>
        )}
      </PhiInputHint>,
    );

    const control = screen.getByLabelText("Observações");
    expect(describedText(control)).toBe(PHI_FREE_TEXT_HINT);
    // ⛔ The two constants are not interchangeable — the title reason ("aparece em
    // listas") is a claim about a title and is false of a note. If this ever passes,
    // the variants have collapsed into one and half the sites carry a false reason.
    expect(describedText(control)).not.toBe(PHI_TITLE_HINT);
  });

  it("leaves the control's ACCESSIBLE NAME untouched", () => {
    render(
      <PhiInputHint>
        {(hintId) => (
          <label>
            <span>Título</span>
            <input type="text" aria-describedby={hintId} />
          </label>
        )}
      </PhiInputHint>,
    );

    // ⛔ THE REGRESSION THIS EXISTS FOR. The tempting placement — the hint inside the
    // <label>, next to the text — folds the sentence into the accessible NAME, and the
    // whole E2E suite locates these controls by name. `{ exact: true }` is the point:
    // a substring match would pass even with the sentence glued on.
    expect(
      screen.getByLabelText("Título", { exact: true }),
    ).toBeInTheDocument();
  });

  it("makes NO claim about erasure, in either direction", () => {
    // ⛔ Measured 2026-08-20: six of the annotated title columns ARE inside a
    // `dispose_*` door's redaction reach (`cases.label`, `case_events.title`,
    // `documents.title`, `rca_evidence.title`, `case_referral.subject`,
    // `meeting_agenda_items.title`) and four are NOT (`patient_safety_event.title`,
    // `meetings.title`, `capa_action.title`, `case_interviews.title`). A shared
    // constant that promised either would ship a FALSE compliance statement on roughly
    // half its sites. This pins the constants to the one reason true everywhere.
    for (const text of [PHI_TITLE_HINT, PHI_FREE_TEXT_HINT]) {
      expect(text).not.toMatch(/apag|excluí|exclui|descart|remov|elimin/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Claim 2 — real consumers, one per wiring shape
// ---------------------------------------------------------------------------

describe("the hint is wired on real authoring controls", () => {
  it("meeting lane — the agenda item's Título (render-prop path)", () => {
    render(
      <AgendaItemForm
        mode="create"
        open
        onOpenChange={() => {}}
        meetingId="m1"
      />,
    );
    const control = screen.getByLabelText("Título", { exact: true });
    expect(describedText(control)).toContain(ADR_0131_SENTENCE);
  });

  it("interview lane — the link attachment's Título (render-prop path)", () => {
    render(<AttachmentLinkForm interviewId="i1" />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar gravação" }));
    const control = screen.getByLabelText("Título", { exact: true });
    expect(describedText(control)).toContain(ADR_0131_SENTENCE);
  });

  it("DSR lane — the attestation note (useFieldIds path)", () => {
    render(<DsrAttestForm org="rede-a" task={task()} />);
    const control = screen.getByLabelText("O que foi revisado", { exact: true });
    const described = describedText(control);
    expect(described).toContain(ADR_0131_SENTENCE);
    // The free-text reason, not the title one — this is a note, not a title.
    expect(described).toContain(PHI_FREE_TEXT_HINT);
  });
});

// ---------------------------------------------------------------------------
// Vacuity control
// ---------------------------------------------------------------------------

describe("the instrument can fail", () => {
  it("reds on a control whose hint is rendered but NOT wired", () => {
    // ⛔ THE POSITIVE CONTROL FOR `describedText`. An absence-of-wiring bug renders
    // identically on screen, so this constructs exactly that state and requires the
    // helper to reject it. Without this, every claim above could be passing on a
    // helper that silently returned "" for an unwired control.
    render(
      <div>
        <label>
          <span>Sem ligação</span>
          <input type="text" />
        </label>
        <p>{PHI_TITLE_HINT}</p>
      </div>,
    );
    const control = screen.getByLabelText("Sem ligação");
    // The sentence IS on screen…
    expect(screen.getByText(PHI_TITLE_HINT)).toBeInTheDocument();
    // …and the control is still undescribed, which is what must fail.
    expect(() => describedText(control)).toThrow();
  });

  it("reds on a describedby that points at a missing id", () => {
    render(
      <label>
        <span>Órfão</span>
        <input type="text" aria-describedby="nao-existe" />
      </label>,
    );
    expect(() => describedText(screen.getByLabelText("Órfão"))).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scope note — a control this round deliberately did NOT annotate
// ---------------------------------------------------------------------------

describe("the DSR intake 'Atendimento' field is deliberately NOT warned", () => {
  it("keeps its honest description instead of the ADR 0131 sentence", async () => {
    // ⛔ Measured: `create_dsr_request` hashes the encounter through
    // `app.derive_patient_key` into `dsr_requests.encounter_key`; there is NO raw
    // encounter column. The field EXISTS to receive a patient identifier, so
    // "Não inclua dados do paciente" would be false in its reason and contradictory in
    // its instruction. This pins the omission as DELIBERATE — otherwise a later sweep
    // for unannotated title/identifier fields "fixes" it back into a false warning.
    const { DsrIntakePanel } = await import("@/components/dsr/dsr-intake-panel");
    render(<DsrIntakePanel org="rede-a" hospitalId="h1" />);

    const encounter = screen.getByLabelText("Atendimento (opcional)", {
      exact: true,
    });
    const described = describedText(encounter);
    expect(described).toContain("resumo criptográfico");
    expect(described).not.toContain(ADR_0131_SENTENCE);

    // …while the sibling `file_ref` field, which IS stored in the clear and rendered
    // as the request's heading, DOES carry it. Asserted together so the negative above
    // cannot be passing merely because nothing on this panel is annotated.
    const fileRef = screen.getByLabelText("Referência do processo", {
      exact: true,
    });
    expect(describedText(fileRef)).toContain(ADR_0131_SENTENCE);
  });
});

describe("both dispose dialogs' confirm phrase is on the shared field primitives", () => {
  it("wires the confirmation help text via aria-describedby", async () => {
    const { DsrMeetingDisposeDialog } = await import(
      "@/components/dsr/dsr-meeting-dispose-dialog"
    );
    render(
      <DsrMeetingDisposeDialog
        org="rede-a"
        taskId="task-1"
        meetingId="m1"
        label="Reunião de agosto"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Descartar a ata" }));
    const dialog = screen.getByRole("alertdialog");
    // ⛔ The accessible NAME is frozen — E2E locates this control by the phrase.
    const control = within(dialog).getByLabelText("Digite APAGAR para confirmar", {
      exact: true,
    });
    expect(describedText(control)).toContain("outras comissões");
  });
});
