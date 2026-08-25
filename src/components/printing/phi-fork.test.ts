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

describe("⭐ ADR 0144 D6 — the band is NOT what the choice governs", () => {
  it("the notice says the band appears on BOTH variants", () => {
    expect(PHI_BAND_NOTICE).toMatch(/nas duas vers[õo]es/i);
  });

  it("it names the CAUSE the band actually tracks — free clinical text", () => {
    expect(PHI_BAND_NOTICE).toMatch(/texto cl[íi]nico livre/i);
    // ...and quotes the band as it is actually printed, so a reader can match
    // the sentence to the page in front of them.
    expect(PHI_BAND_NOTICE).toContain("DOCUMENTO CONFIDENCIAL");
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
