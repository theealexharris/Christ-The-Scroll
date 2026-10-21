import { CSV_MAX_ROWS } from "@workspace/dealpilot-core";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "./ui/button";
import { Field, Textarea } from "./ui/form";
import { Callout } from "./ui/primitives";

type ImportResult = { dryRun: boolean; validCount: number; createdIds: string[]; errors: { row: number; messages: string[] }[]; unknownHeaders: string[] };

export function CsvImport({ onImported }: { onImported: (count: number) => void }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);

  async function run(dryRun: boolean) {
    setError(null);
    setBusy(dryRun ? "check" : "import");
    try {
      const res = await api.post<ImportResult>("/api/properties/import", { csv, dryRun });
      if (dryRun) setPreview(res);
      else onImported(res.createdIds.length);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Callout tone="info" title="Import only data you're permitted to use">
        Upload a CSV you created or exported from a source whose terms allow it. Imported rows are labelled “User-imported”. Up to {CSV_MAX_ROWS} rows per file.{" "}
        <a href="/api/properties/import/template" className="font-medium underline">
          Download the template
        </a>
        .
      </Callout>
      <Field label="CSV file" htmlFor="csv-file" hint="Required columns: address, city, state. Optional: title, zip, category, type, price, beds, baths, units, sqft, year_built, rent, taxes, source, url.">
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-800"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1_000_000) {
              setError("File is larger than 1 MB. Split it into smaller files.");
              return;
            }
            setCsv(await file.text());
            setPreview(null);
          }}
          aria-describedby="csv-file-hint"
        />
      </Field>
      <Field label="…or paste CSV text" htmlFor="csv-text">
        <Textarea
          id="csv-text"
          className="font-mono text-xs"
          rows={6}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          placeholder="title,address,city,state,price,rent"
        />
      </Field>
      {error && <Callout tone="error">{error}</Callout>}
      {preview && (
        <div className="space-y-2">
          <Callout tone={preview.errors.length ? "warning" : "success"} title={`${preview.validCount} row(s) ready to import`}>
            {preview.errors.length > 0 && <p>{preview.errors.length} row(s) have problems and will be skipped.</p>}
            {preview.unknownHeaders.length > 0 && <p>Ignored columns: {preview.unknownHeaders.join(", ")}</p>}
          </Callout>
          {preview.errors.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              {preview.errors.map((e) => (
                <li key={e.row}>
                  <strong>Row {e.row}:</strong> {e.messages.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => run(true)} disabled={!csv.trim() || busy !== null} loading={busy === "check"}>
          Check file
        </Button>
        <Button onClick={() => run(false)} disabled={!preview || preview.validCount === 0 || busy !== null} loading={busy === "import"} title={!preview ? "Check the file first" : undefined}>
          Import {preview?.validCount ?? ""} row(s)
        </Button>
      </div>
    </div>
  );
}
