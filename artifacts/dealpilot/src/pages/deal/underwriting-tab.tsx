import {
  computeUnderwriting,
  DealAssumptionsSchema,
  EVIDENCE_LEVELS,
  formatCurrency,
  formatPercent,
  type DealAssumptions,
  type UnderwritingResult,
} from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Disclaimer } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, NumberInput, Select } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { DealDetail } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { FormulaTable, KeyMetrics, WarningList } from "./metrics";

type NumKey = { [K in keyof DealAssumptions]: DealAssumptions[K] extends number | null ? K : never }[keyof DealAssumptions];

const EVIDENCE_LABELS: Record<string, string> = {
  none: "None",
  user_estimate: "My estimate",
  rent_comps: "Rent comparables",
  signed_lease: "Signed lease(s)",
  provider: "Data provider",
  tax_record: "Tax record",
  written_quote: "Written quote",
  contractor_bid: "Contractor bid",
  not_needed: "No work needed",
  sales_comps: "Sales comparables",
  appraisal: "Appraisal",
};

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-navy-950">{title}</legend>
      {description && <p className="-mt-2 text-xs text-slate-500">{description}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function UnderwritingTab({ detail }: { detail: DealDetail }) {
  const qc = useQueryClient();
  const dealId = detail.deal.id;
  const [draft, setDraft] = useState<DealAssumptions>(detail.assumptions);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  useEffect(() => setDraft(detail.assumptions), [detail.assumptions]);

  const parsed = useMemo(() => DealAssumptionsSchema.safeParse(draft), [draft]);
  const clientErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    return e;
  }, [parsed]);
  const errors = { ...serverErrors, ...clientErrors };
  const preview: UnderwritingResult | null = parsed.success ? computeUnderwriting(parsed.data) : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(detail.assumptions);

  const history = useQuery({
    queryKey: ["underwriting-history", dealId],
    queryFn: () => api.get<{ items: { id: string; assumptionVersion: number; createdAt: string; engineVersion: string }[] }>(`/api/deals/${dealId}/underwriting`),
  });
  const save = useMutation({
    mutationFn: (a: DealAssumptions) => api.put<{ version: number }>(`/api/deals/${dealId}/assumptions`, a),
    onSuccess: (res) => {
      setServerErrors({});
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      qc.invalidateQueries({ queryKey: ["underwriting-history", dealId] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success(`Saved assumptions (version ${res.version})`);
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerErrors(err.fieldErrors);
      toast.error(errorMessage(err));
    },
  });

  const set = <K extends keyof DealAssumptions>(k: K, v: DealAssumptions[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const num = (k: NumKey, label: string, opts: { prefix?: string; suffix?: string; hint?: string; allowNull?: boolean; disabled?: boolean } = {}) => {
    const id = `uw-${k}`;
    return (
      <Field label={label} htmlFor={id} error={errors[k]} hint={opts.hint}>
        <NumberInput
          id={id}
          value={draft[k] as number | null}
          onValueChange={(v) => set(k, v as never)}
          prefix={opts.prefix}
          suffix={opts.suffix}
          allowNull={opts.allowNull}
          disabled={opts.disabled}
          invalid={!!errors[k]}
          aria-describedby={describedBy(id, errors[k], opts.hint)}
        />
      </Field>
    );
  };
  const evidence = (k: keyof typeof EVIDENCE_LEVELS, label: string) => (
    <Field label={label} htmlFor={`ev-${k}`}>
      <Select id={`ev-${k}`} value={draft.evidence[k]} onChange={(e) => set("evidence", { ...draft.evidence, [k]: e.target.value })}>
        {EVIDENCE_LEVELS[k].map((v) => (
          <option key={v} value={v}>
            {EVIDENCE_LABELS[v] ?? v}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="space-y-6">
      {preview ? <KeyMetrics u={preview} /> : <Callout tone="error">Fix the highlighted inputs to see results.</Callout>}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Assumptions"
            description={`All money in USD. Results update as you type; save to create version ${detail.assumptionVersion + 1}.`}
            actions={
              <>
                {dirty && <Badge tone="amber">Unsaved changes</Badge>}
                <Button variant="ghost" size="sm" onClick={() => setDraft(detail.assumptions)} disabled={!dirty}>
                  <RotateCcw /> Reset
                </Button>
                <Button size="sm" onClick={() => parsed.success && save.mutate(parsed.data)} disabled={!dirty || !parsed.success} loading={save.isPending}>
                  <Save /> Save
                </Button>
              </>
            }
          />
          <CardBody className="space-y-6">
            <Group title="Acquisition">
              {num("purchasePrice", "Purchase price", { prefix: "$" })}
              {num("closingCosts", "Closing costs", { prefix: "$", hint: "Title, escrow, recording, etc." })}
              {num("renovationCosts", "Renovation costs", { prefix: "$" })}
              {num("afterRepairValue", "After-repair value (optional)", { prefix: "$", allowNull: true, hint: "Used as the exit base value if set." })}
            </Group>
            <Group title="Income (monthly)">
              {num("monthlyRent", "Rent, all units", { prefix: "$", suffix: "/mo" })}
              {num("otherMonthlyIncome", "Other income", { prefix: "$", suffix: "/mo", hint: "Parking, laundry, storage." })}
              {num("vacancyRatePct", "Vacancy & credit loss", { suffix: "%" })}
            </Group>
            <Group title="Operating expenses" description="Maintenance and capex are % of rent; management is % of effective gross income.">
              {num("propertyTaxesAnnual", "Property taxes", { prefix: "$", suffix: "/yr" })}
              {num("insuranceAnnual", "Insurance", { prefix: "$", suffix: "/yr" })}
              {num("hoaMonthly", "HOA dues", { prefix: "$", suffix: "/mo" })}
              {num("utilitiesMonthly", "Owner-paid utilities", { prefix: "$", suffix: "/mo" })}
              {num("maintenancePct", "Maintenance", { suffix: "% rent" })}
              {num("capexReservePct", "Capital-expenditure reserve", { suffix: "% rent" })}
              {num("managementPct", "Property management", { suffix: "% EGI" })}
              {num("otherExpensesMonthly", "Other expenses", { prefix: "$", suffix: "/mo" })}
            </Group>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-navy-950">Financing</legend>
              <Checkbox id="uw-useFinancing" label="Use a loan for this analysis" checked={draft.useFinancing} onChange={(v) => set("useFinancing", v)} description="Compare more structures on the Financing tab." />
              <div className="grid gap-3 sm:grid-cols-2">
                {num("downPaymentPct", "Down payment", { suffix: "%", disabled: !draft.useFinancing })}
                {num("interestRatePct", "Interest rate", { suffix: "%", disabled: !draft.useFinancing })}
                {num("loanTermYears", "Loan term", { suffix: "yrs", disabled: !draft.useFinancing })}
                {num("amortizationYears", "Amortization", { suffix: "yrs", disabled: !draft.useFinancing })}
                {num("loanFees", "Loan fees & points", { prefix: "$", disabled: !draft.useFinancing })}
              </div>
            </fieldset>
            <Group title="Exit scenario (illustrative)" description="Flat rents and expenses, constant appreciation. Not a forecast.">
              {num("holdYears", "Hold period", { suffix: "yrs" })}
              {num("annualAppreciationPct", "Annual appreciation", { suffix: "%" })}
              {num("sellingCostsPct", "Selling costs", { suffix: "%" })}
            </Group>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-navy-950">Evidence behind these numbers</legend>
              <p className="-mt-2 text-xs text-slate-500">Record what supports each input. The analyst and checklist use this to flag gaps.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {evidence("rentSource", "Rent supported by")}
                {evidence("taxSource", "Taxes supported by")}
                {evidence("insuranceSource", "Insurance supported by")}
                {evidence("rehabSource", "Renovation budget supported by")}
                {evidence("valueSource", "Value supported by")}
              </div>
              <div className="flex flex-wrap gap-6">
                <Checkbox id="ev-inspection" label="Inspection completed" checked={draft.evidence.inspectionCompleted} onChange={(v) => set("evidence", { ...draft.evidence, inspectionCompleted: v })} />
                <Checkbox id="ev-title" label="Title search completed" checked={draft.evidence.titleSearchCompleted} onChange={(v) => set("evidence", { ...draft.evidence, titleSearchCompleted: v })} />
              </div>
            </fieldset>
          </CardBody>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {preview && (
            <>
              <Card>
                <CardHeader title="Warnings" />
                <CardBody>
                  <WarningList warnings={preview.warnings} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Monthly vs annual" />
                <CardBody>
                  <table className="w-full text-sm">
                    <caption className="sr-only">Income and expenses, monthly and annual</caption>
                    <thead className="text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th scope="col" className="py-1">
                          Line
                        </th>
                        <th scope="col" className="py-1 text-right">
                          Monthly
                        </th>
                        <th scope="col" className="py-1 text-right">
                          Annual
                        </th>
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-slate-100">
                      {[
                        ["Gross scheduled income", preview.operating.grossScheduledIncomeMonthly],
                        ["Vacancy loss", -preview.operating.vacancyLossMonthly],
                        ["Effective gross income", preview.operating.effectiveGrossIncomeMonthly],
                        ["Operating expenses", -preview.operating.operatingExpensesMonthly],
                        ["Net operating income", preview.operating.noiMonthly],
                        ["Debt service", -preview.debt.monthlyDebtService],
                        ["Cash flow", preview.cashFlow.monthly],
                      ].map(([label, v]) => (
                        <tr key={label as string}>
                          <th scope="row" className="py-1.5 text-left font-normal text-slate-700">
                            {label}
                          </th>
                          <td className="py-1.5 text-right">{formatCurrency(v as number)}</td>
                          <td className="py-1.5 text-right">{formatCurrency((v as number) * 12)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={`Exit at year ${preview.exit.holdYears}`} description={preview.exit.note} />
                <CardBody className="tabular space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span>Projected value</span> <span>{formatCurrency(preview.exit.projectedValue)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Selling costs</span> <span>−{formatCurrency(preview.exit.sellingCosts)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Loan balance</span> <span>−{formatCurrency(preview.exit.loanBalanceAtExit)}</span>
                  </p>
                  <p className="flex justify-between font-semibold">
                    <span>Estimated equity</span> <span>{formatCurrency(preview.exit.equityAtExit)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Cumulative cash flow</span> <span>{formatCurrency(preview.exit.cumulativeCashFlow)}</span>
                  </p>
                  <p className="flex justify-between font-semibold">
                    <span>Estimated total profit</span> <span>{formatCurrency(preview.exit.totalProfit)}</span>
                  </p>
                  <p className="pt-2 text-xs text-slate-500">Expense ratio {formatPercent(preview.metrics.expenseRatioPct, 1)} · GRM {preview.metrics.grossRentMultiplier ?? "—"}</p>
                </CardBody>
              </Card>
            </>
          )}
          <Card>
            <CardHeader title="Saved versions" description="Each save stores an immutable snapshot of inputs and results." />
            <CardBody>
              {history.data?.items.length ? (
                <ul className="space-y-1 text-sm">
                  {history.data.items.slice(0, 10).map((h) => (
                    <li key={h.id} className="flex justify-between gap-2 text-slate-700">
                      <span>Version {h.assumptionVersion}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No snapshots yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      {preview && (
        <Card>
          <CardHeader title="Formulas" description="Exactly how each number is calculated from the assumptions above." />
          <CardBody>
            <FormulaTable formulas={preview.formulas} />
          </CardBody>
        </Card>
      )}
      <Disclaimer />
    </div>
  );
}
