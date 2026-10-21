import { DEAL_CATEGORIES, PROPERTY_TYPES, PropertyInputSchema, type PropertyInput } from "@workspace/dealpilot-core";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { Property } from "@/lib/types";
import { Button } from "./ui/button";
import { describedBy, Field, Input, NumberInput, Select, Textarea } from "./ui/form";
import { Callout } from "./ui/primitives";

type Draft = Omit<PropertyInput, "sourceUrl"> & { sourceUrl: string };

function initial(p?: Property): Draft {
  return {
    title: p?.title ?? "",
    addressLine: p?.addressLine ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    postalCode: p?.postalCode ?? "",
    category: (p?.category as Draft["category"]) ?? "on_market",
    propertyType: (p?.propertyType as Draft["propertyType"]) ?? "single_family",
    listPrice: p?.listPrice ?? null,
    beds: p?.beds ?? null,
    baths: p?.baths ?? null,
    units: p?.units ?? null,
    squareFeet: p?.squareFeet ?? null,
    lotSizeSqft: p?.lotSizeSqft ?? null,
    yearBuilt: p?.yearBuilt ?? null,
    estimatedRentMonthly: p?.estimatedRentMonthly ?? null,
    annualTaxes: p?.annualTaxes ?? null,
    description: p?.description ?? "",
    sourceName: p?.latestSource?.sourceName ?? "",
    sourceUrl: p?.latestSource?.sourceUrl ?? "",
  };
}

/** Create/edit form for a user-owned property, validated with the shared schema. */
export function PropertyForm({ property, onSubmit, submitLabel }: { property?: Property; onSubmit: (input: PropertyInput) => Promise<unknown>; submitLabel: string }) {
  const [draft, setDraft] = useState<Draft>(() => initial(property));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = PropertyInputSchema.safeParse({ ...draft, sourceUrl: draft.sourceUrl.trim() || null, postalCode: draft.postalCode || null });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      setFormError("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else setFormError("Could not save the property.");
    } finally {
      setBusy(false);
    }
  }

  const text = (key: keyof Draft, label: string, opts: { required?: boolean; hint?: string; autoComplete?: string } = {}) => (
    <Field label={label} htmlFor={`pf-${key}`} error={errors[key]} hint={opts.hint} required={opts.required}>
      <Input
        id={`pf-${key}`}
        value={(draft[key] as string | null) ?? ""}
        onChange={(e) => set(key, e.target.value as never)}
        invalid={!!errors[key]}
        aria-describedby={describedBy(`pf-${key}`, errors[key], opts.hint)}
        autoComplete={opts.autoComplete}
      />
    </Field>
  );
  const num = (key: keyof Draft, label: string, opts: { prefix?: string; suffix?: string; step?: string } = {}) => (
    <Field label={label} htmlFor={`pf-${key}`} error={errors[key]}>
      <NumberInput
        id={`pf-${key}`}
        value={draft[key] as number | null}
        onValueChange={(v) => set(key, v as never)}
        allowNull
        prefix={opts.prefix}
        suffix={opts.suffix}
        step={opts.step}
        invalid={!!errors[key]}
        aria-describedby={describedBy(`pf-${key}`, errors[key])}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Callout tone="info">Enter only information you have the right to use. Mark where it came from so the app can show source freshness.</Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{text("title", "Short name", { required: true, hint: "e.g. “Oak St duplex”" })}</div>
        <div className="sm:col-span-2">{text("addressLine", "Street address", { required: true, autoComplete: "street-address" })}</div>
        {text("city", "City", { required: true, autoComplete: "address-level2" })}
        <div className="grid grid-cols-2 gap-4">
          {text("state", "State", { required: true, autoComplete: "address-level1" })}
          {text("postalCode", "ZIP", { autoComplete: "postal-code" })}
        </div>
        <Field label="Category" htmlFor="pf-category" required>
          <Select id="pf-category" value={draft.category} onChange={(e) => set("category", e.target.value as Draft["category"])}>
            {DEAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Property type" htmlFor="pf-propertyType" required>
          <Select id="pf-propertyType" value={draft.propertyType} onChange={(e) => set("propertyType", e.target.value as Draft["propertyType"])}>
            {PROPERTY_TYPES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {num("listPrice", "Asking / list price", { prefix: "$" })}
        {num("estimatedRentMonthly", "Estimated rent (monthly, all units)", { prefix: "$" })}
        {num("annualTaxes", "Property taxes (annual)", { prefix: "$" })}
        {num("units", "Units", { step: "1" })}
        {num("beds", "Bedrooms", { step: "1" })}
        {num("baths", "Bathrooms", { step: "0.5" })}
        {num("squareFeet", "Square feet", { step: "1" })}
        {num("lotSizeSqft", "Lot size (sq ft)", { step: "1" })}
        {num("yearBuilt", "Year built", { step: "1" })}
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="pf-description" error={errors.description}>
            <Textarea id="pf-description" value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
        {text("sourceName", "Source name", { hint: "Where this information came from (e.g. “County assessor”, “Agent email”)." })}
        {text("sourceUrl", "Source URL", { hint: "Optional link (https://…)." })}
      </div>
      {formError && <Callout tone="error">{formError}</Callout>}
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
