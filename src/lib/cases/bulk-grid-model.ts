/**
 * Pure, client-safe model for the bulk-case GRID ("Múltiplos casos", ADR 0084).
 *
 * Holds every non-React concern of the grid step so the `"use client"` components
 * stay thin and these rules stay unit-testable: the row shape, auto-title, the
 * target-column model shared by the grid AND the paste mapping panel, spreadsheet
 * paste parsing + per-type coercion, the in-grid validators, and serialization into
 * the `bulk_create_cases` action's row shape.
 *
 * PURITY CONTRACT (the `cases/types.ts` discipline + the client-bundle gotcha): this
 * module imports ONLY TYPES (all erased at compile time) — never `@/lib/supabase/*`,
 * `next/*`, a `"use server"` action module's runtime, or a server query module's
 * runtime. That is what lets the client grid import it without dragging the server
 * supabase client into the browser bundle.
 */

import type {
  CustomFieldDef,
  CustomFieldType,
} from "@/lib/queries/process-templates";
// Type-only — the runtime lives in a `"use client"` component; the import is erased.
import type { CustomFieldValueDraft } from "@/components/cases/custom-field-input";
import type { CasePatientSex, SetCasePatientInput } from "@/lib/cases/types";
// Type-only: `@/lib/queries/cases` is a server query module and this file is
// imported by the client grid — a VALUE import would abort `next build` (Rule 9,
// `lint:client-server-imports`).
import type { PatientRequiredField } from "@/lib/queries/cases";

// ---------------------------------------------------------------------------
// PHI columns (the grid spreads the patient block across compact columns)
// ---------------------------------------------------------------------------

/** The PHI columns the grid offers (a subset of {@link SetCasePatientInput} —
 * `unit` is dropped, matching the Novo-caso `hideUnit` convention). */
export type PatientColumnKey =
  | "name"
  | "mrn"
  | "dateOfBirth"
  | "ageYears"
  | "sex"
  | "encounterRef"
  | "attending";

/** How a PHI column's cell is edited (drives which control the grid renders). */
export type PatientColumnKind = "text" | "date" | "number" | "sex";

export interface PatientColumnDef {
  key: PatientColumnKey;
  /** pt-BR header (Rule 10). */
  label: string;
  kind: PatientColumnKind;
}

/** The ordered PHI columns. Name + Prontuário first — the name-or-MRN floor. */
export const PATIENT_COLUMNS: readonly PatientColumnDef[] = [
  { key: "name", label: "Nome", kind: "text" },
  { key: "mrn", label: "Prontuário", kind: "text" },
  { key: "dateOfBirth", label: "Nascimento", kind: "date" },
  { key: "ageYears", label: "Idade", kind: "number" },
  { key: "sex", label: "Sexo", kind: "sex" },
  { key: "encounterRef", label: "Atendimento", kind: "text" },
  { key: "attending", label: "Profissional", kind: "text" },
] as const;

export const VALID_SEX: readonly CasePatientSex[] = [
  "female",
  "male",
  "other",
  "unknown",
];

/** The PHI columns selected by default (E1) — the common minimum-necessary pair. */
export const DEFAULT_PHI_KEYS: readonly PatientColumnKey[] = ["name", "mrn"];

/**
 * `patient_required_fields` (snake_case, the DB vocabulary) → the grid's column key
 * (camelCase). Two vocabularies for one set of identifiers, so the translation lives
 * in ONE place rather than at each of the three call sites that need it.
 *
 * ⛔ TOTAL over {@link PatientRequiredField} by TYPE. `age_years` and `unit` are
 * absent from that union BY CONSTRUCTION (ADR 0137 D2/D9 — a DB CHECK on both
 * `process_template_versions` and `cases` says so), so widening the union reds `tsc`
 * here rather than silently dropping a field the DB will then refuse. That is the
 * whole reason this is a typed `Record` and not a lookup with a fallback.
 */
export const REQUIRED_FIELD_COLUMN: Record<PatientRequiredField, PatientColumnKey> = {
  name: "name",
  mrn: "mrn",
  date_of_birth: "dateOfBirth",
  sex: "sex",
  encounter_ref: "encounterRef",
  attending: "attending",
}

/** The grid columns a `required`-mode template forces, in canonical column order. */
export function requiredPhiColumns(
  requiredFields: readonly PatientRequiredField[],
): PatientColumnKey[] {
  const wanted = new Set(requiredFields.map((f) => REQUIRED_FIELD_COLUMN[f]))
  return PATIENT_COLUMNS.map((c) => c.key).filter((k) => wanted.has(k))
}

/**
 * The name-or-MRN floor at the COLUMN-SELECTION level (Step 1; E1): once ANY PHI
 * field is selected as a grid column, at least one of Nome/Prontuário must remain
 * selected (so every PHI row can meet the server's per-row floor). ZERO PHI fields
 * selected is valid — the batch simply collects no patient identifiers.
 */
export function phiSelectionValid(selectedPhiKeys: ReadonlySet<string>): boolean {
  if (selectedPhiKeys.size === 0) return true;
  return selectedPhiKeys.has("name") || selectedPhiKeys.has("mrn");
}

/** pt-BR sex labels ↔ code, for paste coercion (accepts label or code). */
const SEX_ALIASES: Record<string, CasePatientSex> = {
  feminino: "female",
  female: "female",
  f: "female",
  masculino: "male",
  male: "male",
  m: "male",
  outro: "other",
  other: "other",
  "nao informado": "unknown",
  "não informado": "unknown",
  unknown: "unknown",
};

/** The grid holds every PHI cell as a string (sex as its code). */
export type PatientCells = Record<PatientColumnKey, string>;

export function emptyPatientCells(): PatientCells {
  return {
    name: "",
    mrn: "",
    dateOfBirth: "",
    ageYears: "",
    sex: "unknown",
    encounterRef: "",
    attending: "",
  };
}

// ---------------------------------------------------------------------------
// Grid rows
// ---------------------------------------------------------------------------

export interface BulkGridRow {
  /** Stable local id (React key + owner-map key); never sent to the server. */
  id: string;
  /** The editable title; blank renders/serializes as the auto-title. */
  title: string;
  /** Custom-field values keyed by field `key` (only the grid's chosen fields). */
  customFields: Record<string, CustomFieldValueDraft>;
  /** PHI cells (present only for PHI-collecting templates; blank strings otherwise). */
  patient: PatientCells;
}

let localIdCounter = 0;

/** A fresh local row id (session-unique; used as a React key, never persisted). */
export function createRowId(): string {
  localIdCounter += 1;
  return `bulk-row-${localIdCounter}`;
}

export function makeEmptyRow(): BulkGridRow {
  return {
    id: createRowId(),
    title: "",
    customFields: {},
    patient: emptyPatientCells(),
  };
}

/**
 * The auto title for a row: `«prefix» #N` (1-based), or `#N` when no prefix.
 * NEVER derived from the patient name/MRN (Design #9) — a case is identified by its
 * minted number; this is only a human-facing label.
 */
export function autoTitle(prefix: string, rowNumber: number): string {
  const p = prefix.trim();
  return p ? `${p} #${rowNumber}` : `#${rowNumber}`;
}

/** The label sent for a row: the typed title, else the computed auto-title. */
export function resolveLabel(
  row: BulkGridRow,
  prefix: string,
  rowNumber: number,
): string {
  return row.title.trim() || autoTitle(prefix, rowNumber);
}

// ---------------------------------------------------------------------------
// Target columns — shared by the grid layout AND the paste mapping panel
// ---------------------------------------------------------------------------

export type TargetColumnKind = "title" | "custom" | "phi";

export interface TargetColumn {
  /** Unique id: `title` | `cf:<key>` | `phi:<key>`. */
  id: string;
  label: string;
  kind: TargetColumnKind;
  /** Present when `kind === 'custom'`. */
  customField?: CustomFieldDef;
  /** Present when `kind === 'phi'`. */
  phiKey?: PatientColumnKey;
  /** Marks a custom column the user cannot remove (required field, always-on). */
  required?: boolean;
}

/**
 * Build the ordered target columns for the grid: Título first, then the chosen
 * custom fields (required ones are always present), then the SELECTED PHI columns
 * (E1) — only when the template collects patient identifiers and the flag is on.
 * PHI columns follow the canonical {@link PATIENT_COLUMNS} order regardless of the
 * order keys were toggled.
 */
export function buildTargetColumns(
  customFields: CustomFieldDef[],
  collectsPhi: boolean,
  selectedPhiKeys: ReadonlySet<string>,
): TargetColumn[] {
  const columns: TargetColumn[] = [
    { id: "title", label: "Título", kind: "title" },
  ];
  for (const field of customFields) {
    columns.push({
      id: `cf:${field.key}`,
      label: field.label,
      kind: "custom",
      customField: field,
      required: field.required,
    });
  }
  if (collectsPhi) {
    for (const col of PATIENT_COLUMNS) {
      if (!selectedPhiKeys.has(col.key)) continue;
      columns.push({
        id: `phi:${col.key}`,
        label: col.label,
        kind: "phi",
        phiKey: col.key,
      });
    }
  }
  return columns;
}

// ---------------------------------------------------------------------------
// Per-type coercion (pasted raw string → typed cell value)
// ---------------------------------------------------------------------------

/** Normalize a pasted date to `YYYY-MM-DD`; accepts `DD/MM/YYYY` too. `""` when unparseable. */
export function normalizeDateInput(raw: string): string {
  const s = raw.trim();
  if (s === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) {
    const [, d, m, y] = br;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    const iso = `${y}-${mm}-${dd}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
  }
  return "";
}

/** Resolve a pasted value to a choice option `code` (matches code or label). `null` when no match. */
function coerceChoice(field: CustomFieldDef, raw: string): string | null {
  const s = raw.trim();
  if (s === "") return null;
  const lower = s.toLowerCase();
  const match = field.options.find(
    (o) => o.code.toLowerCase() === lower || o.label.toLowerCase() === lower,
  );
  return match ? match.code : null;
}

/** Coerce a pasted raw string into a typed custom-field value for `fieldType`. */
export function coerceCustomField(
  field: CustomFieldDef,
  raw: string,
): CustomFieldValueDraft {
  const type: CustomFieldType = field.fieldType;
  switch (type) {
    case "number": {
      const s = raw.trim();
      if (s === "") return null;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return normalizeDateInput(raw) || null;
    case "dropdown":
    case "multiple_choice":
      return coerceChoice(field, raw);
    case "short_text":
    default: {
      const s = raw.trim();
      return s === "" ? null : s;
    }
  }
}

/** Coerce a pasted raw string into a PHI cell value (stored as a string). */
export function coercePatientCell(key: PatientColumnKey, raw: string): string {
  const s = raw.trim();
  switch (key) {
    case "dateOfBirth":
      return normalizeDateInput(raw);
    case "ageYears": {
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) && n >= 0 ? String(n) : "";
    }
    case "sex": {
      if (s === "") return "unknown";
      return SEX_ALIASES[s.toLowerCase()] ?? "unknown";
    }
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Custom-field blank check (mirrors custom-field-input.isCustomFieldBlank so the
// model has no runtime dependency on the client component)
// ---------------------------------------------------------------------------

export function isCellBlank(value: CustomFieldValueDraft): boolean {
  return value === null || value === "";
}

// ---------------------------------------------------------------------------
// PHI floor + validation
// ---------------------------------------------------------------------------

/** Whether a row carries ANY patient identifier (drives the name-or-MRN floor). */
export function rowHasAnyPhi(patient: PatientCells): boolean {
  return Boolean(
    patient.name.trim() ||
      patient.mrn.trim() ||
      patient.dateOfBirth.trim() ||
      patient.ageYears.trim() ||
      patient.encounterRef.trim() ||
      patient.attending.trim() ||
      (patient.sex !== "unknown" && patient.sex !== ""),
  );
}

/** The name-or-MRN floor: a row with any PHI must carry a name or a prontuário. */
export function phiFloorSatisfied(patient: PatientCells): boolean {
  if (!rowHasAnyPhi(patient)) return true;
  return Boolean(patient.name.trim() || patient.mrn.trim());
}

/** The required custom fields a row leaves blank (empty array = row is complete). */
export function missingRequiredFields(
  row: BulkGridRow,
  requiredKeys: readonly string[],
): string[] {
  return requiredKeys.filter((key) => isCellBlank(row.customFields[key] ?? null));
}

/**
 * The `patient_required_fields` this ROW leaves empty (ADR 0137 D2/D3, bulk path),
 * in the canonical order the DB reports them in.
 *
 * ⚠ MIRRORS `app.patient_required_missing`, INCLUDING its `sex = 'unknown'`
 * SENTINEL: the column always carries a value, so a required `sex` would be
 * satisfied on every row by the coercion default unless `'unknown'` counts as
 * missing. `coercePatientCell` writes exactly that default for a blank cell, so
 * without this arm a `required`-sex batch would advance and then be refused row by
 * row at the door.
 *
 * ⛔ UX ONLY, and NOT the authority (D3 — "the DB layer is the one that counts").
 * `app.assert_patient_required_fields` refuses with HC0T1 either way; this only
 * stops the wizard offering a submit already known to fail. Never move an
 * enforcement decision here.
 */
export function missingRequiredPhi(
  patient: PatientCells,
  requiredFields: readonly PatientRequiredField[],
): PatientRequiredField[] {
  if (requiredFields.length === 0) return [];
  const wanted = new Set(requiredFields);
  return PATIENT_REQUIRED_FIELD_ORDER.filter((field) => {
    if (!wanted.has(field)) return false;
    const cell = patient[REQUIRED_FIELD_COLUMN[field]] ?? "";
    if (field === "sex") return cell.trim() === "" || cell === "unknown";
    return cell.trim() === "";
  });
}

/**
 * The canonical field order the DB reports missing fields in.
 *
 * ⚠ Re-declared here rather than imported from `@/lib/queries/cases`: that module is
 * server-only and this one is in the client bundle, so only its TYPES may cross.
 * `Record<PatientRequiredField, …>` above is what keeps the two key sets identical —
 * this array only fixes the ORDER.
 */
const PATIENT_REQUIRED_FIELD_ORDER: readonly PatientRequiredField[] = [
  "name",
  "mrn",
  "date_of_birth",
  "sex",
  "encounter_ref",
  "attending",
]

export interface RowValidation {
  /** 0-based index into the grid rows. */
  index: number;
  missingRequired: string[];
  phiFloorViolated: boolean;
  /**
   * The `patient_required_fields` this row leaves empty (ADR 0137 D2/D3). Always
   * `[]` for an `optional`/`none` template, so every pre-D1 batch is byte-identical.
   */
  missingRequiredPhi: PatientRequiredField[];
}

export interface GridValidation {
  /** Rows with a blocking problem (required blank OR PHI floor). */
  invalidRows: RowValidation[];
  /** 1-based row numbers that share a non-blank title (non-blocking warning). */
  duplicateLabelRows: number[];
  /** 1-based row numbers that share a non-blank MRN (non-blocking warning). */
  duplicateMrnRows: number[];
  /** True when the batch exceeds the hard cap. */
  overCap: boolean;
  /** Whether advancing is allowed (≥1 row, ≤cap, no invalid rows). */
  canAdvance: boolean;
}

export const MAX_BULK_ROWS = 200;

/**
 * Validate the whole grid. BLOCKING: at least one row, ≤ {@link MAX_BULK_ROWS},
 * every required custom field filled, and the PHI name-or-MRN floor per row.
 * NON-BLOCKING warnings: duplicate titles / MRNs within the batch (a sample can
 * legitimately repeat, so these caution but never block — Design #6).
 */
export function validateGrid(
  rows: BulkGridRow[],
  requiredKeys: readonly string[],
  prefix: string,
  /**
   * The template's `patient_required_fields` (ADR 0137 D2/D3). Defaults to `[]`, so
   * every existing caller — and every `optional`/`none` template — behaves exactly
   * as before this parameter existed.
   */
  requiredPhiFields: readonly PatientRequiredField[] = [],
): GridValidation {
  const invalidRows: RowValidation[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const missingRequired = missingRequiredFields(row, requiredKeys);
    const phiFloorViolated = !phiFloorSatisfied(row.patient);
    const missingPhi = missingRequiredPhi(row.patient, requiredPhiFields);
    if (missingRequired.length > 0 || phiFloorViolated || missingPhi.length > 0) {
      invalidRows.push({
        index: i,
        missingRequired,
        phiFloorViolated,
        missingRequiredPhi: missingPhi,
      });
    }
  }

  const duplicateLabelRows = duplicateRowNumbers(
    rows.map((row, i) => resolveLabel(row, prefix, i + 1).toLowerCase()),
  );
  const duplicateMrnRows = duplicateRowNumbers(
    rows.map((row) => row.patient.mrn.trim().toLowerCase()),
  );

  const overCap = rows.length > MAX_BULK_ROWS;
  const canAdvance = rows.length > 0 && !overCap && invalidRows.length === 0;

  return {
    invalidRows,
    duplicateLabelRows,
    duplicateMrnRows,
    overCap,
    canAdvance,
  };
}

/** 1-based row numbers whose (non-blank) key appears more than once. */
function duplicateRowNumbers(keys: string[]): number[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (key === "") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes: number[] = [];
  keys.forEach((key, i) => {
    if (key !== "" && (counts.get(key) ?? 0) > 1) dupes.push(i + 1);
  });
  return dupes;
}

// ---------------------------------------------------------------------------
// Spreadsheet paste → matrix → rows
// ---------------------------------------------------------------------------

/** Parse clipboard text into a row-major matrix (lines × tab-separated cells). */
export function parsePasteMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (normalized === "") return [];
  return normalized.split("\n").map((line) => line.split("\t"));
}

/** Whether a pasted matrix is "bulk" (worth the mapping panel vs a single cell). */
export function isBulkPaste(matrix: string[][]): boolean {
  if (matrix.length === 0) return false;
  return matrix.length > 1 || matrix.some((r) => r.length > 1);
}

/** How each target column draws its value when importing a pasted matrix. */
export type CellSource =
  | { mode: "source"; sourceIndex: number }
  | { mode: "constant"; value: string }
  | { mode: "ignore" };

/** A mapping keyed by {@link TargetColumn.id}. */
export type PasteMapping = Record<string, CellSource>;

/**
 * A safe default mapping: pasted columns flow, in order, into the DATA columns
 * (custom fields then PHI); the Título column stays AUTO (ignored) so a pasted
 * patient name never lands in a title (Design #9) — unless there are no data
 * columns at all, in which case the paste fills the title. The user overrides any
 * of these in the panel before applying.
 */
export function defaultPasteMapping(
  columns: TargetColumn[],
  sourceColCount: number,
): PasteMapping {
  const mapping: PasteMapping = {};
  const hasDataColumns = columns.some((c) => c.kind !== "title");
  let sourceCursor = 0;
  for (const col of columns) {
    if (col.kind === "title") {
      mapping[col.id] =
        !hasDataColumns && sourceColCount > 0
          ? { mode: "source", sourceIndex: 0 }
          : { mode: "ignore" };
    } else {
      mapping[col.id] =
        sourceCursor < sourceColCount
          ? { mode: "source", sourceIndex: sourceCursor }
          : { mode: "ignore" };
      sourceCursor += 1;
    }
  }
  return mapping;
}

/** Resolve one target column's raw string for a given source row. */
function resolveRaw(source: CellSource | undefined, sourceRow: string[]): string {
  if (!source) return "";
  if (source.mode === "constant") return source.value;
  if (source.mode === "source") return sourceRow[source.sourceIndex] ?? "";
  return "";
}

/**
 * Build grid rows from a pasted matrix under a column mapping. Each matrix row
 * becomes one grid row; values are coerced per target-column type. Fresh row ids.
 */
export function buildRowsFromPaste(
  matrix: string[][],
  columns: TargetColumn[],
  mapping: PasteMapping,
): BulkGridRow[] {
  return matrix.map((sourceRow) => {
    const row = makeEmptyRow();
    for (const col of columns) {
      const raw = resolveRaw(mapping[col.id], sourceRow);
      if (col.kind === "title") {
        row.title = raw.trim();
      } else if (col.kind === "custom" && col.customField) {
        row.customFields[col.customField.key] = coerceCustomField(
          col.customField,
          raw,
        );
      } else if (col.kind === "phi" && col.phiKey) {
        row.patient[col.phiKey] = coercePatientCell(col.phiKey, raw);
      }
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Serialization → the bulk_create_cases action row shape
// ---------------------------------------------------------------------------

/** A grid row serialized to the action's per-case payload (owner attached later). */
export interface BulkDraftCase {
  label: string;
  customFields: { key: string; value: CustomFieldValueDraft }[];
  patient: SetCasePatientInput | null;
}

/** Serialize the grid's PHI cells into the minimum-necessary PHI input, or null. */
export function serializePatientCells(
  patient: PatientCells,
): SetCasePatientInput | null {
  const name = patient.name.trim() || null;
  const mrn = patient.mrn.trim() || null;
  // Mirror the action's floor: nothing to write without a name or prontuário.
  if (!name && !mrn) return null;
  const ageRaw = patient.ageYears.trim();
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : NaN;
  const sex: CasePatientSex = VALID_SEX.includes(patient.sex as CasePatientSex)
    ? (patient.sex as CasePatientSex)
    : "unknown";
  return {
    name,
    mrn,
    dateOfBirth: patient.dateOfBirth.trim() || null,
    ageYears: Number.isFinite(age) ? age : null,
    sex,
    encounterRef: patient.encounterRef.trim() || null,
    unit: null,
    attending: patient.attending.trim() || null,
  };
}

/**
 * Serialize one grid row into the action's per-case draft. `customFieldKeys` is the
 * grid's chosen field set (required ∪ selected) — every one is sent (blank → null),
 * matching the Novo-caso dialog's hidden-mirror behavior so the RPC's required-check
 * sees them. The label falls back to the auto-title; PHI is omitted below the floor.
 */
export function serializeDraftCase(
  row: BulkGridRow,
  prefix: string,
  rowNumber: number,
  customFieldKeys: readonly string[],
  collectsPhi: boolean,
): BulkDraftCase {
  return {
    label: resolveLabel(row, prefix, rowNumber),
    customFields: customFieldKeys.map((key) => ({
      key,
      value: row.customFields[key] ?? null,
    })),
    patient: collectsPhi ? serializePatientCells(row.patient) : null,
  };
}
