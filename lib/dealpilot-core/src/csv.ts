import { DEAL_CATEGORIES, PROPERTY_TYPES } from "./categories";
import { PropertyInputSchema, type PropertyInput } from "./schemas";

export const CSV_MAX_ROWS = 500;

/** RFC 4180-style CSV parser: quoted fields, escaped quotes ("") and CRLF/LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Accepted header names (case/spacing-insensitive) mapped to PropertyInput fields. */
const HEADER_ALIASES: Record<string, keyof PropertyInput> = {
  title: "title",
  name: "title",
  address: "addressLine",
  addressline: "addressLine",
  street: "addressLine",
  city: "city",
  state: "state",
  zip: "postalCode",
  zipcode: "postalCode",
  postalcode: "postalCode",
  category: "category",
  type: "propertyType",
  propertytype: "propertyType",
  price: "listPrice",
  listprice: "listPrice",
  askingprice: "listPrice",
  beds: "beds",
  bedrooms: "beds",
  baths: "baths",
  bathrooms: "baths",
  units: "units",
  sqft: "squareFeet",
  squarefeet: "squareFeet",
  lotsqft: "lotSizeSqft",
  lotsize: "lotSizeSqft",
  yearbuilt: "yearBuilt",
  rent: "estimatedRentMonthly",
  monthlyrent: "estimatedRentMonthly",
  estimatedrent: "estimatedRentMonthly",
  taxes: "annualTaxes",
  annualtaxes: "annualTaxes",
  description: "description",
  notes: "description",
  sourceurl: "sourceUrl",
  url: "sourceUrl",
  source: "sourceName",
  sourcename: "sourceName",
};

const NUMERIC_FIELDS = new Set<keyof PropertyInput>(["listPrice", "beds", "baths", "units", "squareFeet", "lotSizeSqft", "yearBuilt", "estimatedRentMonthly", "annualTaxes"]);
const INTEGER_FIELDS = new Set<keyof PropertyInput>(["beds", "units", "squareFeet", "lotSizeSqft", "yearBuilt"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchEnum(value: string, list: readonly { id: string; label: string }[]): string | undefined {
  const v = norm(value);
  return list.find((item) => norm(item.id) === v || norm(item.label) === v || norm(item.label).startsWith(v))?.id;
}

export type CsvRowError = { row: number; messages: string[] };
export type CsvImportResult = { valid: { row: number; data: PropertyInput }[]; errors: CsvRowError[]; unknownHeaders: string[] };

/**
 * Maps CSV rows to validated PropertyInput objects. Row numbers in errors are
 * 1-based spreadsheet rows (the header is row 1).
 */
export function mapCsvToProperties(text: string): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { valid: [], errors: [{ row: 1, messages: ["The file needs a header row and at least one data row."] }], unknownHeaders: [] };
  const header = rows[0].map((h) => h.trim());
  const fields = header.map((h) => HEADER_ALIASES[norm(h)]);
  const unknownHeaders = header.filter((_, i) => !fields[i]);
  const dataRows = rows.slice(1);
  const errors: CsvRowError[] = [];
  const valid: CsvImportResult["valid"] = [];
  if (dataRows.length > CSV_MAX_ROWS) {
    return { valid: [], errors: [{ row: 1, messages: [`Import at most ${CSV_MAX_ROWS} rows at a time (found ${dataRows.length}).`] }], unknownHeaders };
  }

  dataRows.forEach((cells, idx) => {
    const rowNumber = idx + 2;
    const messages: string[] = [];
    const raw: Record<string, unknown> = {};
    fields.forEach((field, col) => {
      if (!field) return;
      const value = (cells[col] ?? "").trim();
      if (value === "") return;
      if (NUMERIC_FIELDS.has(field)) {
        const n = Number(value.replace(/[$,\s]/g, ""));
        if (!Number.isFinite(n)) messages.push(`${header[col]}: "${value}" is not a number`);
        else raw[field] = INTEGER_FIELDS.has(field) ? Math.round(n) : n;
      } else if (field === "category") {
        const id = matchEnum(value, DEAL_CATEGORIES);
        if (!id) messages.push(`${header[col]}: unknown category "${value}"`);
        else raw.category = id;
      } else if (field === "propertyType") {
        const id = matchEnum(value, PROPERTY_TYPES);
        if (!id) messages.push(`${header[col]}: unknown property type "${value}"`);
        else raw.propertyType = id;
      } else {
        raw[field] = value;
      }
    });
    raw.category ??= "on_market";
    raw.propertyType ??= "single_family";
    if (!raw.title && typeof raw.addressLine === "string") raw.title = raw.addressLine;
    const parsed = PropertyInputSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) messages.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
    }
    if (messages.length > 0 || !parsed.success) errors.push({ row: rowNumber, messages });
    else valid.push({ row: rowNumber, data: parsed.data });
  });
  return { valid, errors, unknownHeaders };
}

export const CSV_TEMPLATE =
  "title,address,city,state,zip,category,type,price,beds,baths,units,sqft,year_built,rent,taxes,source,url\n" +
  'My lead,123 Main St,Springfield,IL,62701,on_market,single_family,150000,3,2,1,1400,1965,1500,2800,"County MLS export",\n';
