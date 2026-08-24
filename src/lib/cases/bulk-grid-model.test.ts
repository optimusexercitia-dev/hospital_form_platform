import { describe, expect, it } from "vitest";

import type { CustomFieldDef } from "@/lib/queries/process-templates";
import {
  DEFAULT_PHI_KEYS,
  PATIENT_COLUMNS,
  autoTitle,
  buildRowsFromPaste,
  buildTargetColumns,
  coerceCustomField,
  coercePatientCell,
  defaultPasteMapping,
  emptyPatientCells,
  isBulkPaste,
  makeEmptyRow,
  missingRequiredPhi,
  normalizeDateInput,
  parsePasteMatrix,
  REQUIRED_FIELD_COLUMN,
  requiredPhiColumns,
  phiFloorSatisfied,
  phiSelectionValid,
  resolveLabel,
  serializeDraftCase,
  serializePatientCells,
  validateGrid,
  type BulkGridRow,
} from "./bulk-grid-model";

const ALL_PHI = new Set<string>(PATIENT_COLUMNS.map((c) => c.key));

function textField(key: string, required = false): CustomFieldDef {
  return {
    id: `id-${key}`,
    templateVersionId: "tpl",
    key,
    label: key.toUpperCase(),
    fieldType: "short_text",
    options: [],
    required,
    showInList: false,
    position: 0,
  };
}

function choiceField(key: string): CustomFieldDef {
  return {
    id: `id-${key}`,
    templateVersionId: "tpl",
    key,
    label: key.toUpperCase(),
    fieldType: "dropdown",
    options: [
      { code: "ay", label: "Ala Y" },
      { code: "az", label: "Ala Z" },
    ],
    required: false,
    showInList: false,
    position: 1,
  };
}

describe("paste parsing", () => {
  it("splits lines and tab-separated cells, trimming a trailing newline", () => {
    const matrix = parsePasteMatrix("a\tb\tc\n1\t2\t3\n");
    expect(matrix).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("treats a single cell as a non-bulk paste", () => {
    expect(isBulkPaste(parsePasteMatrix("hello"))).toBe(false);
    expect(isBulkPaste(parsePasteMatrix("a\tb"))).toBe(true);
    expect(isBulkPaste(parsePasteMatrix("a\nb"))).toBe(true);
  });
});

describe("coercion", () => {
  it("coerces numbers, dates and choices; blanks to null", () => {
    const num: CustomFieldDef = { ...textField("n"), fieldType: "number" };
    expect(coerceCustomField(num, "42")).toBe(42);
    expect(coerceCustomField(num, "3,5")).toBe(3.5);
    expect(coerceCustomField(num, "")).toBeNull();

    const dt: CustomFieldDef = { ...textField("d"), fieldType: "date" };
    expect(coerceCustomField(dt, "01/02/2026")).toBe("2026-02-01");
    expect(coerceCustomField(dt, "2026-02-01")).toBe("2026-02-01");
    expect(coerceCustomField(dt, "garbage")).toBeNull();

    const ch = choiceField("ala");
    expect(coerceCustomField(ch, "Ala Y")).toBe("ay");
    expect(coerceCustomField(ch, "az")).toBe("az");
    expect(coerceCustomField(ch, "nope")).toBeNull();
  });

  it("coerces PHI cells (date, age, sex aliases)", () => {
    expect(coercePatientCell("dateOfBirth", "31/12/1990")).toBe("1990-12-31");
    expect(coercePatientCell("ageYears", "77")).toBe("77");
    expect(coercePatientCell("ageYears", "-3")).toBe("");
    expect(coercePatientCell("sex", "Feminino")).toBe("female");
    expect(coercePatientCell("sex", "M")).toBe("male");
    expect(coercePatientCell("sex", "")).toBe("unknown");
    expect(coercePatientCell("name", "  Maria  ")).toBe("Maria");
  });

  it("normalizeDateInput handles both formats and rejects others", () => {
    expect(normalizeDateInput("2026-07-23")).toBe("2026-07-23");
    expect(normalizeDateInput("5/7/2026")).toBe("2026-07-05");
    expect(normalizeDateInput("not a date")).toBe("");
  });
});

describe("target columns + paste import", () => {
  it("builds title + custom + PHI columns and imports a matrix (explicit mapping)", () => {
    const fields = [textField("motivo"), choiceField("ala")];
    const columns = buildTargetColumns(fields, true, ALL_PHI);
    // title + 2 custom + 7 PHI
    expect(columns).toHaveLength(1 + 2 + 7);
    expect(columns[0]).toMatchObject({ id: "title", kind: "title" });

    const matrix = [
      ["Caso A", "Sepse", "Ala Y", "Maria", "0001"],
      ["Caso B", "Queda", "az", "João", "0002"],
    ];
    const mapping = {
      title: { mode: "source", sourceIndex: 0 } as const,
      "cf:motivo": { mode: "source", sourceIndex: 1 } as const,
      "cf:ala": { mode: "source", sourceIndex: 2 } as const,
      "phi:name": { mode: "source", sourceIndex: 3 } as const,
      "phi:mrn": { mode: "source", sourceIndex: 4 } as const,
    };
    const rows = buildRowsFromPaste(matrix, columns, mapping);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("Caso A");
    expect(rows[0].customFields.motivo).toBe("Sepse");
    expect(rows[0].customFields.ala).toBe("ay");
    expect(rows[0].patient.name).toBe("Maria");
    expect(rows[0].patient.mrn).toBe("0001");
    expect(rows[1].customFields.ala).toBe("az");
  });

  it("default mapping keeps Título auto and flows sources into data columns", () => {
    const columns = buildTargetColumns(
      [textField("motivo")],
      true,
      new Set(["name", "mrn"]),
    );
    // title ignored; source 0 → cf:motivo, source 1 → phi:name, source 2 → phi:mrn…
    const mapping = defaultPasteMapping(columns, 3);
    expect(mapping.title).toEqual({ mode: "ignore" });
    expect(mapping["cf:motivo"]).toEqual({ mode: "source", sourceIndex: 0 });
    expect(mapping["phi:name"]).toEqual({ mode: "source", sourceIndex: 1 });

    // With no data columns, the paste fills the title instead.
    const titleOnly = buildTargetColumns([], false, new Set());
    expect(defaultPasteMapping(titleOnly, 1).title).toEqual({
      mode: "source",
      sourceIndex: 0,
    });
  });
});

describe("selectable PHI columns (E1)", () => {
  it("derives PHI columns from the selection, in canonical order", () => {
    // Toggle order is mrn-then-name; the columns still follow PATIENT_COLUMNS order.
    const cols = buildTargetColumns([], true, new Set(["mrn", "name"]));
    const phi = cols.filter((c) => c.kind === "phi").map((c) => c.phiKey);
    expect(phi).toEqual(["name", "mrn"]);

    // Zero selected → no PHI columns.
    expect(
      buildTargetColumns([], true, new Set()).some((c) => c.kind === "phi"),
    ).toBe(false);

    // All selected → all 7.
    expect(
      buildTargetColumns([], true, ALL_PHI).filter((c) => c.kind === "phi"),
    ).toHaveLength(7);

    // collectsPhi === false → never any PHI column, regardless of the selection.
    expect(
      buildTargetColumns([], false, ALL_PHI).some((c) => c.kind === "phi"),
    ).toBe(false);
  });

  it("enforces the name-or-MRN floor at the selection level", () => {
    expect(phiSelectionValid(new Set())).toBe(true); // no PHI collected
    expect(phiSelectionValid(new Set(["name"]))).toBe(true);
    expect(phiSelectionValid(new Set(["mrn"]))).toBe(true);
    expect(phiSelectionValid(new Set(["name", "dateOfBirth"]))).toBe(true);
    expect(phiSelectionValid(new Set(["dateOfBirth"]))).toBe(false);
    expect(phiSelectionValid(new Set(["ageYears", "sex"]))).toBe(false);
  });

  it("defaults to Nome + Prontuário", () => {
    expect(new Set(DEFAULT_PHI_KEYS)).toEqual(new Set(["name", "mrn"]));
  });
});

describe("titles", () => {
  it("auto-titles with and without a prefix; typed title wins", () => {
    expect(autoTitle("Auditoria", 3)).toBe("Auditoria #3");
    expect(autoTitle("", 3)).toBe("#3");
    const row = { ...makeEmptyRow(), title: "  Custom  " };
    expect(resolveLabel(row, "Auditoria", 5)).toBe("Custom");
    expect(resolveLabel(makeEmptyRow(), "Auditoria", 5)).toBe("Auditoria #5");
  });
});

describe("PHI floor + validation", () => {
  it("requires name or MRN once any PHI is present", () => {
    const cells = emptyPatientCells();
    expect(phiFloorSatisfied(cells)).toBe(true); // no PHI at all
    expect(phiFloorSatisfied({ ...cells, ageYears: "80" })).toBe(false); // age only
    expect(phiFloorSatisfied({ ...cells, name: "Ana" })).toBe(true);
    expect(phiFloorSatisfied({ ...cells, mrn: "0001" })).toBe(true);
  });

  it("blocks on required-blank and PHI floor; warns on duplicates; caps at 200", () => {
    const req = ["motivo"];
    const rowA: BulkGridRow = {
      ...makeEmptyRow(),
      title: "Caso",
      customFields: { motivo: "Sepse" },
      patient: { ...emptyPatientCells(), name: "Ana" },
    };
    const rowMissing: BulkGridRow = {
      ...makeEmptyRow(),
      title: "Caso",
      customFields: { motivo: null },
      patient: { ...emptyPatientCells(), ageYears: "50" }, // floor violated
    };
    const v = validateGrid([rowA, rowMissing], req, "Lote");
    expect(v.canAdvance).toBe(false);
    expect(v.invalidRows).toHaveLength(1);
    expect(v.invalidRows[0].index).toBe(1);
    expect(v.invalidRows[0].missingRequired).toEqual(["motivo"]);
    expect(v.invalidRows[0].phiFloorViolated).toBe(true);
    // Both share the title "Caso" → duplicate warning on rows 1 and 2.
    expect(v.duplicateLabelRows).toEqual([1, 2]);

    // A clean single row advances.
    const clean = validateGrid([rowA], req, "Lote");
    expect(clean.canAdvance).toBe(true);

    // Empty grid cannot advance.
    expect(validateGrid([], req, "Lote").canAdvance).toBe(false);
  });
});

/**
 * ADR 0137 D2/D3 on the BULK path (FUP-0137-BULK-WIZARD-STILL-BOOLEAN).
 *
 * ⛔ EVERY TEST HERE PAIRS THE REQUIRED CASE WITH THE `[]` CASE. The whole risk of
 * adding a fourth `validateGrid` parameter is that it changes behaviour for the
 * batches that do NOT use it, and a suite that only exercises the new mode would
 * never see that. `[]` must stay byte-identical to the pre-parameter behaviour.
 */
describe("required patient fields (ADR 0137 D2/D3)", () => {
  const requiredRow = (over: Partial<ReturnType<typeof emptyPatientCells>> = {}) => ({
    ...makeEmptyRow(),
    title: "Caso",
    patient: { ...emptyPatientCells(), ...over },
  });

  it("maps every required field to a grid column, and only to columns that exist", () => {
    // TOTALITY, not a spot check: `REQUIRED_FIELD_COLUMN`'s value set must be a
    // subset of the columns the grid can actually render, or a "required" field
    // would be unfillable. `age_years`/`unit` are absent from the union by
    // construction, which is what makes the Record exhaustive-by-type.
    const columnKeys = new Set(PATIENT_COLUMNS.map((c) => c.key));
    for (const column of Object.values(REQUIRED_FIELD_COLUMN)) {
      expect(columnKeys.has(column)).toBe(true);
    }
    expect(requiredPhiColumns(["mrn", "date_of_birth"])).toEqual([
      "mrn",
      "dateOfBirth",
    ]);
    // Canonical COLUMN order, not the caller's argument order.
    expect(requiredPhiColumns(["attending", "name"])).toEqual(["name", "attending"]);
    expect(requiredPhiColumns([])).toEqual([]);
  });

  it("reports the missing required identifiers in canonical order", () => {
    const row = requiredRow({ name: "Ana" });
    expect(missingRequiredPhi(row.patient, ["mrn", "name"])).toEqual(["mrn"]);
    expect(missingRequiredPhi(row.patient, ["attending", "mrn"])).toEqual([
      "mrn",
      "attending",
    ]);
    // The negative half — a satisfied set reports nothing.
    const full = requiredRow({ name: "Ana", mrn: "0001" });
    expect(missingRequiredPhi(full.patient, ["name", "mrn"])).toEqual([]);
    // …and no required set means nothing is ever missing.
    expect(missingRequiredPhi(requiredRow().patient, [])).toEqual([]);
  });

  it("treats sex = 'unknown' as MISSING — the DB's sentinel rule", () => {
    // ⛔ THE ONE THAT CANNOT BE INFERRED FROM THE OTHERS. `coercePatientCell('sex',
    // '')` writes `'unknown'`, so a naive "is the cell blank?" check would find
    // every row satisfied and the wizard would advance a batch the door refuses
    // row by row. Mirrors `app.patient_required_missing`.
    expect(coercePatientCell("sex", "")).toBe("unknown");
    const row = requiredRow({ name: "Ana", mrn: "1", sex: "unknown" });
    expect(missingRequiredPhi(row.patient, ["sex"])).toEqual(["sex"]);

    const known = requiredRow({ name: "Ana", mrn: "1", sex: "female" });
    expect(missingRequiredPhi(known.patient, ["sex"])).toEqual([]);
  });

  it("blocks the grid on an incomplete row and reports which fields", () => {
    const complete = requiredRow({ name: "Ana", mrn: "0001" });
    const short = { ...requiredRow({ name: "Bruno" }), title: "Outro" };

    const v = validateGrid([complete, short], [], "Lote", ["name", "mrn"]);
    expect(v.canAdvance).toBe(false);
    expect(v.invalidRows).toHaveLength(1);
    expect(v.invalidRows[0].index).toBe(1);
    expect(v.invalidRows[0].missingRequiredPhi).toEqual(["mrn"]);
    // The OTHER two blocking reasons are untouched — this row is short of a
    // required identifier only.
    expect(v.invalidRows[0].missingRequired).toEqual([]);
    expect(v.invalidRows[0].phiFloorViolated).toBe(false);
  });

  it("is INERT for a template with no required set — the regression half", () => {
    // Same grid, same rows, no required fields: the short row must be perfectly
    // valid, exactly as it was before this parameter existed.
    const short = requiredRow({ name: "Bruno" });
    const v = validateGrid([short], [], "Lote", []);
    expect(v.canAdvance).toBe(true);
    expect(v.invalidRows).toEqual([]);

    // …and the default argument must behave the same as an explicit `[]`.
    expect(validateGrid([short], [], "Lote").canAdvance).toBe(true);
  });
});

describe("serialization to the action shape", () => {
  it("sends every chosen custom field (blank → null) and PHI above the floor", () => {
    const row: BulkGridRow = {
      ...makeEmptyRow(),
      title: "",
      customFields: { motivo: "Sepse", ala: null },
      patient: { ...emptyPatientCells(), name: "Ana", mrn: "0001", sex: "female" },
    };
    const draft = serializeDraftCase(row, "Lote", 4, ["motivo", "ala"], true);
    expect(draft.label).toBe("Lote #4");
    expect(draft.customFields).toEqual([
      { key: "motivo", value: "Sepse" },
      { key: "ala", value: null },
    ]);
    expect(draft.patient).toMatchObject({ name: "Ana", mrn: "0001", sex: "female", unit: null });
  });

  it("drops PHI below the name-or-MRN floor", () => {
    expect(serializePatientCells(emptyPatientCells())).toBeNull();
    expect(
      serializePatientCells({ ...emptyPatientCells(), ageYears: "50" }),
    ).toBeNull();
    expect(
      serializePatientCells({ ...emptyPatientCells(), name: "Ana" }),
    ).not.toBeNull();
  });
});
