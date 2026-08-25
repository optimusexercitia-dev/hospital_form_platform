import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PHI_BAND_NOTICE,
  PHI_CHOICE_HINT,
  PHI_CHOICE_LABEL,
  PREVIA_PHI_HELPER_COPY,
  revokeReasonClassLabel,
  watermarkReasonCopy,
} from "./labels";

/**
 * PDF·P3 — the PHI fork's two claims that NOTHING ELSE CAN CONTRADICT.
 *
 * ⭐ Both are structural, and that is the point. `phiCapable` and the D6 notice
 * are the kind of thing that survives every gate while being wrong:
 *
 * 1. **"Never hardcode the kind in UI"** (ADR 0104 D9 v2-readiness). A
 *    `sourceKind === "case"` test inside a printing component typechecks, lints
 *    clean, and passes every behavioural test — because with only one PHI-capable
 *    kind in existence, the hardcode and the registry read are OBSERVATIONALLY
 *    IDENTICAL. The two diverge for the first time on the day a second kind
 *    declares the capability, which is the day nobody is looking. Only a
 *    structural assertion can distinguish them today.
 *
 * 2. **ADR 0144 D6** — the confidentiality band appears on BOTH variants. A
 *    future edit that trims the notice as "redundant" leaves a screen that is
 *    still correct in every behaviour and misleading in the one way that makes a
 *    user hand out a document they thought was de-identified.
 *
 * ⚠ The call-site sweep ENUMERATES rather than hand-lists. A hand-list of the
 * mount sites is a list that goes stale on the next mount site — and the new one
 * is precisely the one likeliest to have written the literal.
 */

const ROOT = join(__dirname, "..", "..", "..");

/** Strip comments so a rule can be DISCUSSED in prose without tripping its own
 * detector — every file here documents the very patterns being banned. */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function read(relative: string): string {
  return stripComments(readFileSync(join(ROOT, relative), "utf8"));
}

/** Every file under `src/app` that mounts the panel — DERIVED, never listed. */
function findMountSites(): { path: string; source: string }[] {
  const found: { path: string; source: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      const raw = readFileSync(full, "utf8");
      if (raw.includes("<PrintedDocumentsSection")) {
        found.push({ path: full.slice(ROOT.length + 1), source: stripComments(raw) });
      }
    }
  };
  walk(join(ROOT, "src", "app"));
  return found;
}

/**
 * The provider registry's `phiCapable` declarations, read from SOURCE rather
 * than imported: `providers.ts` pulls in the server-side payload builders, and a
 * client-component unit test that value-imports a server query module is the one
 * failure that aborts `next build` while every local gate stays green
 * (`lint:client-server-imports`).
 *
 * Parses on the two things that are the registry's stable API — the entry keys
 * and the `phiCapable` field — never on formatting.
 */
function providerRegistryEntries(): { kind: string; phiCapable: boolean }[] {
  const source = read("src/lib/pdf-mint/providers.ts");
  const body = source.slice(source.indexOf("export const PDF_PROVIDERS"));
  const keys = [...body.matchAll(/(\w+):\s*\{/g)].map((match) => ({
    kind: match[1],
    at: match.index ?? 0,
  }));
  return keys.map(({ kind, at }, index) => ({
    kind,
    phiCapable: /phiCapable:\s*true/.test(
      body.slice(at, keys[index + 1]?.at ?? body.length),
    ),
  }));
}

// ---------------------------------------------------------------------------

describe("⛔ the capability is READ, never written as a literal (ADR 0104 D9)", () => {
  /**
   * The three components that decide the PHI AFFORDANCE. None may contain a
   * kind-equality test of any shape: what governs the choice is the provider's
   * declaration, and a component that can name a kind can disagree with it.
   */
  const AFFORDANCE_COMPONENTS = [
    "src/components/printing/mint-document-button.tsx",
    "src/components/printing/previa-link.tsx",
    "src/components/printing/printed-documents-panel.tsx",
  ];

  it("⭐ POSITIVE CONTROL: the stripper leaves real code, and the needle CAN match", () => {
    // Without this the sweep below is satisfied by an empty string or a regex
    // that matches nothing anywhere — a stale detector reading as a clean result.
    for (const file of AFFORDANCE_COMPONENTS) {
      expect(read(file), file).toMatch(/export function \w+/);
      expect(read(file), file).toContain("phiCapable");
    }
    // The needle demonstrably matches a kind-equality test where one LEGITIMATELY
    // lives: `labels.ts` selects kind-aware SENTENCES, which is copy, not
    // capability. So "no match in the components" is a real finding about them.
    expect(read("src/components/printing/labels.ts")).toMatch(
      /kind === ["']case["']/,
    );
  });

  it("⛔ no affordance component tests the source KIND", () => {
    for (const file of AFFORDANCE_COMPONENTS) {
      const source = read(file);
      expect(
        /sourceKind\s*===|kind\s*===\s*["'](case|form_response|meeting|interview)["']/.test(
          source,
        ),
        `${file} decides on the KIND instead of the provider capability`,
      ).toBe(false);
    }
  });

  it("⛔ no MOUNT SITE writes phiCapable as a boolean literal", () => {
    const sites = findMountSites();
    // The enumeration found something — otherwise every assertion below is
    // vacuously true over an empty list.
    expect(sites.length).toBeGreaterThanOrEqual(3);

    for (const { path, source } of sites) {
      expect(source, `${path} mounts the panel without passing phiCapable`).toMatch(
        /phiCapable=\{/,
      );
      expect(
        /phiCapable=\{(true|false)\}/.test(source),
        `${path} hardcodes phiCapable instead of reading PDF_PROVIDERS`,
      ).toBe(false);
      expect(
        /phiCapable=\{PDF_PROVIDERS\./.test(source),
        `${path} does not source phiCapable from the provider registry`,
      ).toBe(true);
    }
  });
});

describe("⭐ the case card is gated on the DOOR'S OWN ANSWER (FUP-P3-MINT-AFFORDANCE)", () => {
  /**
   * `getCasePrintContext` returns `null` exactly when the caller cannot mint —
   * `public.print_source_state` is DEFINER and answers a refusal with a bare
   * `return` (zero rows), and its `case` arm is `can_read_case ∧
   * can_read_full_case_content`, ADR 0144 D8's arm. Catalog-verified 2026-08-25.
   *
   * ⛔ So the card must render on the CONTEXT, never on the bare feature flag.
   * The difference is invisible at runtime for an authorised viewer — both
   * render the card — and shows up only for the excluded class, which is the
   * class nobody has a fixture for. Only a structural assertion catches a
   * regression here, and the alternative was a code comment, which is the thing
   * that goes stale silently.
   */
  const caseSite = () => {
    const site = findMountSites().find((s) => s.source.includes('sourceKind="case"'));
    if (!site) throw new Error("no mount site renders sourceKind=\"case\"");
    return site.source;
  };

  it("⭐ POSITIVE CONTROL: the case mount site exists and reads the print context", () => {
    const source = caseSite();
    expect(source).toContain("getCasePrintContext");
    expect(source).toContain("<PrintedDocumentsSection");
  });

  it("⛔ renders on the print CONTEXT, not on the bare feature flag", () => {
    const source = caseSite();
    // The state object is derived from the context and is the render condition.
    expect(source).toMatch(/\{casePrintState \?/);
    // ...and the flag alone is NOT the condition. `documentPrintingOn` still
    // guards the READ (no point calling the door when printing is off), which is
    // a different thing from guarding the CARD.
    expect(source).not.toMatch(/\{documentPrintingOn \? \(\s*<div/);
  });

  it("⛔ manufactures NO state for a caller the door already answered about", () => {
    const source = caseSite();
    // The earlier draft had `caseDisposed: casePrintContext?.caseDisposed ?? true`
    // and a `?? detail.case.status`. Both are dead now, and restoring either
    // would turn an honest absence back into a button that errors on click.
    expect(source).not.toMatch(/caseDisposed:\s*[^,\n]*\?\?/);
    expect(source).not.toMatch(/status:\s*casePrintContext\?\.\w+\s*\?\?/);
  });
});

describe("⭐ ADR 0144 D6 — the band is NOT what the choice governs", () => {
  it("the notice says the band appears on BOTH variants", () => {
    expect(PHI_BAND_NOTICE).toMatch(/nas duas vers[õo]es/i);
  });

  /**
   * The RETIRED wording, kept verbatim as the detector's positive control below.
   *
   * It was true of the DERIVED `contains_phi` and is false of the constitutive
   * one (Amendment 5), and the derived rule is what shipped finding C-1: it
   * counted narratives and answers, not the masked-class title fields
   * `dispose_case_phi` redacts, so a case with a patient name in its label
   * derived `false` and survived the erasure. Keeping the sentence here means the
   * regexes below are provably able to fire on the exact shape being banned.
   */
  const RETIRED_PRESENCE_CLAIM =
    "Ela é acionada pela presença de texto clínico livre no caso — narrativas, deliberações, entrevistas — e não por esta opção.";

  /** Shapes that assert the band tracks the PRESENCE of some content. Every one
   * must fire on {@link RETIRED_PRESENCE_CLAIM} — that is what makes their
   * absence from the live string a finding rather than a stale detector. */
  const PRESENCE_CAUSE_CLAIMS = [
    /texto cl[íi]nico livre/i,
    /presen[çc]a d/i,
    /acionad/i,
    /narrativas/i,
    /delibera[çc][õo]es/i,
  ];

  it("⭐ POSITIVE CONTROL: every presence-cause needle fires on the retired wording", () => {
    expect(PRESENCE_CAUSE_CLAIMS.length).toBeGreaterThanOrEqual(5);
    for (const claim of PRESENCE_CAUSE_CLAIMS) {
      expect(
        claim.test(RETIRED_PRESENCE_CLAIM),
        `${claim} cannot fire — it is a dead needle, not a clean result`,
      ).toBe(true);
    }
  });

  it("⛔ it names NO presence-of-content cause — the band is CONSTITUTIVE", () => {
    // `containsPhi := !caseDisposed`. A sentence that enumerates what the band
    // tracks goes false the moment the classifier's term set moves — which is
    // exactly how C-1 reached a user-facing string.
    for (const claim of PRESENCE_CAUSE_CLAIMS) {
      expect(
        claim.test(PHI_BAND_NOTICE),
        `the notice asserts a presence-derived cause: ${claim}`,
      ).toBe(false);
    }
  });

  it("⭐ it states the rule: the band lifts only on PHI DISPOSAL", () => {
    // Minimal wording check, and deliberately on ONE stem. "descartad" is the
    // platform's fixed vocabulary for the Art. 18 act — `watermarkReasonCopy`'s
    // case arms and the `phi_disposed` revoke label both use it — so it is
    // DECISION vocabulary, not prose a copy edit would move.
    expect(PHI_BAND_NOTICE).toMatch(/descartad/i);
    // The same act, named the same way, in the sibling sentence on the same
    // screen. Two names for one act is how a reader concludes there are two acts.
    expect(watermarkReasonCopy("case", "final")).toMatch(/descartad/i);
    // ⚠ NEGATIVE phrasing is required, not stylistic: the predicate is "not
    // disposed", which is equally true of a case that never held patient data.
    // A positive "enquanto o caso mantiver seus dados de paciente" would assert
    // PHI exists on every live case.
    expect(PHI_BAND_NOTICE).not.toMatch(/mant[ée]m|mantiver|possui/i);
    // ...and it quotes the band as it is actually printed, so a reader can match
    // the sentence to the page in front of them.
    expect(PHI_BAND_NOTICE).toContain("DOCUMENTO CONFIDENCIAL");
  });

  it("⛔ the notice's case-specific wording is REACHABLE only from the case kind", () => {
    // The sentence names a CASE's own lifecycle, which is only honest while
    // `case` is the sole PHI-capable kind. The notice renders under the
    // provider's `phiCapable` declaration, never under a kind test (ADR 0104 D9),
    // so a second kind that declares the capability silently INHERITS this
    // sentence — and a case's disposal lifecycle on a meeting's dialog is the
    // same defect moving. Whoever flips that boolean lands here and must split
    // the copy per kind, as `watermarkReasonCopy` already is.
    const entries = providerRegistryEntries();
    // POSITIVE CONTROL: the parser actually found the registry. An empty or
    // mis-parsed list would satisfy the claim below having read nothing.
    expect(entries.map((e) => e.kind)).toContain("case");
    expect(entries.length).toBeGreaterThanOrEqual(3);

    expect(entries.filter((e) => e.phiCapable).map((e) => e.kind)).toEqual([
      "case",
    ]);
  });

  it("⛔ it denies that the choice removes the band", () => {
    expect(PHI_BAND_NOTICE).toMatch(/n[ãa]o por esta op[çc][ãa]o/i);
    // The bounded claim: the choice governs the STRUCTURED fields only.
    expect(PHI_BAND_NOTICE).toMatch(/campos estruturados/i);
  });

  it("⛔ NO PHI copy promises the de-identified variant is free of patient data", () => {
    // The single most dangerous class of string on this surface. A user who
    // believes it hands the PDF to someone they otherwise would not.
    const ABSENCE_PROMISES = [
      /sem dados do paciente/i,
      /sem informa[çc][õo]es do paciente/i,
      /an[ôo]nim/i,
      /n[ãa]o cont[ée]m dados/i,
      /nenhum dado do paciente/i,
    ];
    const strings = {
      PHI_CHOICE_LABEL,
      PHI_CHOICE_HINT,
      PHI_BAND_NOTICE,
      PREVIA_PHI_HELPER_COPY,
    };
    // ⭐ UNCONDITIONAL, and required: every assertion below sits inside two
    // nested loops, so an empty `strings` (or an empty promise list) would make
    // this test pass having checked nothing. `lint:vacuous` flagged exactly that
    // shape here — the gate was right.
    expect(Object.keys(strings)).toHaveLength(4);
    expect(ABSENCE_PROMISES.length).toBeGreaterThanOrEqual(5);

    for (const [name, copy] of Object.entries(strings)) {
      for (const promise of ABSENCE_PROMISES) {
        expect(promise.test(copy), `${name} promises absence: ${promise}`).toBe(false);
      }
      // Each string is non-trivial, so the negatives above are not vacuous.
      expect(copy.length, name).toBeGreaterThan(20);
    }
  });

  it("the choice is worded around what ticking it ADDS", () => {
    expect(PHI_CHOICE_LABEL).toMatch(/incluir/i);
    // The hint names the added fields AND the de-identification floor that
    // prints either way — strip the floor and the ONA tracer gets a dossier
    // about nobody (ADR 0144 D5).
    expect(PHI_CHOICE_HINT).toMatch(/prontu[áa]rio/i);
    expect(PHI_CHOICE_HINT).toMatch(/idade, sexo e unidade/i);
    // ...and says outright that the floor prints in BOTH. The de-identified
    // variant is IDENTIFIER-free, not patient-data-free, and this clause is what
    // stops the label being read as the stronger claim.
    expect(PHI_CHOICE_HINT).toMatch(/nas duas vers[õo]es/i);
  });

  it("⛔ the audit claim is GENERALISED, not attached to the identified link alone", () => {
    // Both variants read through the audited door — `age_years`/`sex`/`unit` sit
    // on the same Class-1 table as `name`/`mrn`, so a de-identified print by a
    // PHI-capable minter logs a PHI read too. An audit sentence on the
    // identified link ONLY is true in isolation and asserts the opposite by
    // CONTRAST, because the de-identified link beside it carries no such line.
    expect(PREVIA_PHI_HELPER_COPY).toMatch(/como toda leitura/i);
    expect(PREVIA_PHI_HELPER_COPY).toMatch(/trilha de auditoria/i);
    // The differential: it must NOT read as a property of this variant alone.
    expect(PREVIA_PHI_HELPER_COPY).not.toMatch(
      /(apenas|somente|s[óo]) esta (op[çc][ãa]o|vers[ãa]o|pr[ée]via)/i,
    );
  });

  it("⛔ no copy announces that a demographics block is UNAVAILABLE", () => {
    // A minter without PHI capability simply gets a dossier without that block.
    // Printing a line saying so would put the MINTER'S ENTITLEMENT on the page —
    // a worse disclosure than the one it would be flagging.
    for (const copy of [PHI_CHOICE_LABEL, PHI_CHOICE_HINT, PHI_BAND_NOTICE, PREVIA_PHI_HELPER_COPY]) {
      expect(copy).not.toMatch(/indispon[íi]vel|n[ãa]o autorizad|sem permiss|restrito a/i);
    }
  });

  it("⛔ the internal join keys print in NEITHER variant, so they are never named", () => {
    // ADR 0144 D5's third row. Naming them in the UI would imply a variant
    // exists that prints them; none does.
    for (const copy of [PHI_CHOICE_HINT, PHI_BAND_NOTICE]) {
      expect(copy).not.toMatch(/patient_key|encounter_key|chave do paciente/i);
    }
  });
});

describe("⭐ the case watermark arms (ADR 0144 D3)", () => {
  it("the FINAL arm may state both conjuncts — both are known to hold", () => {
    const copy = watermarkReasonCopy("case", "final");
    expect(copy).toMatch(/conclu[íi]do ou cancelado/i);
    expect(copy).toMatch(/descartad/i);
  });

  it("⛔ the DRAFT arm names NO single cause — the negation is a DISJUNCTION", () => {
    // A case fails to register because it is still open OR because its patient
    // data was disposed. A disposed case IS terminal, so "ainda não está em
    // estado final" would be a flat lie about exactly one of the two.
    const copy = watermarkReasonCopy("case", "draft");
    expect(copy.length).toBeGreaterThan(30); // it says something
    expect(copy).not.toMatch(/ainda n[ãa]o est[áa] (em estado final|conclu)/i);
    expect(copy).not.toMatch(/o caso ainda est[áa] aberto/i);
    // It states the REQUIREMENT instead.
    expect(copy).toMatch(/exige/i);
  });

  it("the two arms DIFFER — a constant would satisfy both above", () => {
    expect(watermarkReasonCopy("case", "final")).not.toBe(
      watermarkReasonCopy("case", "draft"),
    );
  });

  it("⛔ the case arms are not the generic fallback", () => {
    // The generic arm says "a origem ainda não está em estado final", which is
    // FALSE for a disposed case. Falling through to it is the defect.
    expect(watermarkReasonCopy("case", "draft")).not.toBe(
      watermarkReasonCopy("interview", "draft"),
    );
  });
});

describe("⭐ phi_disposed reads as an ERASURE, not a withdrawal (ADR 0144 D10)", () => {
  it("has its own label rather than falling through to 'Outro motivo'", () => {
    const label = revokeReasonClassLabel("phi_disposed");
    expect(label).not.toBe("Outro motivo");
    // The DIFFERENTIAL against a function that labels everything: an unknown
    // class still falls back, so this is not satisfied by a broken fallback.
    expect(revokeReasonClassLabel("something_unknown")).toBe("Outro motivo");
    expect(revokeReasonClassLabel(null)).toBe("Outro motivo");
  });

  it("⛔ never reads as an error — the record STANDS, only the bytes went", () => {
    const label = revokeReasonClassLabel("phi_disposed");
    expect(label).not.toMatch(/engano|incorret|err/i);
    // It says what actually happened to the file, and why.
    expect(label).toMatch(/destru[íi]d/i);
    expect(label).toMatch(/LGPD/);
  });

  it("⛔ it is NOT offered as a choice in the revoke dialog", async () => {
    // `dispose_case_phi` assigns this class; nobody picks it. Putting it in the
    // option tuple would offer "discard the patient's data" in a dropdown that
    // does nothing of the sort — and would widen the dialog's own state type.
    const { REVOKE_REASON_CLASSES } = await import("./labels");
    const values = REVOKE_REASON_CLASSES.map((c) => c.value);
    expect(values).not.toContain("phi_disposed");
    // POSITIVE half: the tuple is non-empty and does hold the real choices, so
    // the exclusion above is a finding about `phi_disposed`, not about an empty
    // list.
    expect(values).toContain("wrong_data");
    expect(values.length).toBeGreaterThanOrEqual(3);
  });
});
