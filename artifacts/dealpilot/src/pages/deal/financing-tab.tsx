import {
  computeFinancingScenario,
  defaultFinancingParams,
  FINANCING_DISCLAIMER,
  FINANCING_KINDS,
  FinancingParamsSchema,
  formatCurrency,
  formatPercent,
  formatRatio,
  labelFor,
  type FinancingKind,
  type FinancingParams,
} from "@workspace/dealpilot-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, NumberInput, Select } from "@/components/ui/form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { DealDetail, Scenario } from "@/lib/types";
import { cn } from "@/lib/utils";

function ScenarioEditor({ detail, initial, onDone }: { detail: DealDetail; initial: FinancingParams; onDone: (p: FinancingParams) => Promise<unknown> }) {
  const [p, setP] = useState<FinancingParams>(initial);
  const [busy, setBusy] = useState(false);
  const parsed = FinancingParamsSchema.safeParse(p);
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
  const preview = parsed.success ? computeFinancingScenario(detail.assumptions, parsed.data) : null;
  const set = <K extends keyof FinancingParams>(k: K, v: FinancingParams[K]) => setP((x) => ({ ...x, [k]: v }));
  const n = (k: keyof FinancingParams, label: string, suffix?: string, allowNull?: boolean) => (
    <Field label={label} htmlFor={`fs-${k}`} error={errors[k]}>
      <NumberInput id={`fs-${k}`} value={p[k] as number | null} onValueChange={(v) => set(k, v as never)} suffix={suffix} allowNull={allowNull} invalid={!!errors[k]} />
    </Field>
  );
  const isCash = p.kind === "cash";
  const usesSeller = p.kind === "hybrid";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed.success) return;
    setBusy(true);
    try {
      await onDone(parsed.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scenario type" htmlFor="fs-kind">
          <Select
            id="fs-kind"
            value={p.kind}
            onChange={(e) => {
              const kind = e.target.value as FinancingKind;
              setP({ ...defaultFinancingParams(kind, detail.assumptions), name: p.name === labelFor(FINANCING_KINDS, p.kind) ? labelFor(FINANCING_KINDS, kind) : p.name });
            }}
          >
            {FINANCING_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="fs-name" error={errors.name}>
          <Input id="fs-name" value={p.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
        </Field>
        {!isCash && (
          <>
            {n("downPaymentPct", "Down payment", "%")}
            {n("interestRatePct", p.kind === "seller" ? "Seller note rate" : "Interest rate", "%")}
            {n("termYears", "Term", "yrs")}
            {n("amortizationYears", "Amortization", "yrs")}
            {p.kind !== "seller" && n("lenderFeesPct", "Lender fees / points", "% of loan")}
            {n("balloonYears", "Balloon due (optional)", "yr", true)}
            <div className="sm:col-span-2">
              <Checkbox id="fs-io" label="Interest-only payments" checked={p.interestOnly} onChange={(v) => set("interestOnly", v)} />
            </div>
          </>
        )}
        {p.kind === "dscr" && n("minDscr", "Illustrative minimum DSCR", "x", true)}
        {usesSeller && (
          <>
            <p className="text-sm font-semibold text-navy-950 sm:col-span-2">Seller carry (second position)</p>
            {n("sellerCarryPct", "Seller carry", "% of price")}
            {n("sellerRatePct", "Seller rate", "%")}
            {n("sellerAmortizationYears", "Seller amortization", "yrs")}
            {n("sellerBalloonYears", "Seller balloon (optional)", "yr", true)}
            <div className="sm:col-span-2">
              <Checkbox id="fs-sio" label="Seller carry is interest-only" checked={p.sellerInterestOnly} onChange={(v) => set("sellerInterestOnly", v)} />
            </div>
          </>
        )}
      </div>
      {preview && (
        <div className="tabular grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Cash to close</p>
            <p className="font-semibold">{formatCurrency(preview.cashToClose)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Payment / mo</p>
            <p className="font-semibold">{formatCurrency(preview.monthlyDebtService)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cash flow / mo</p>
            <p className={cn("font-semibold", preview.monthlyCashFlow < 0 && "text-red-700")}>{formatCurrency(preview.monthlyCashFlow)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">DSCR</p>
            <p className="font-semibold">{formatRatio(preview.dscr)}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">{FINANCING_DISCLAIMER}</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={!parsed.success} loading={busy}>
          Save scenario
        </Button>
      </div>
    </form>
  );
}

export function FinancingTab({ detail }: { detail: DealDetail }) {
  const qc = useQueryClient();
  const dealId = detail.deal.id;
  const [editing, setEditing] = useState<{ scenario?: Scenario; params: FinancingParams } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["deal", dealId] });

  const save = useMutation({
    mutationFn: ({ id, params }: { id?: string; params: FinancingParams }) =>
      id ? api.put(`/api/deals/${dealId}/financing-scenarios/${id}`, params) : api.post(`/api/deals/${dealId}/financing-scenarios`, params),
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast.success("Scenario saved");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/deals/${dealId}/financing-scenarios/${id}`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const scenarios = detail.scenarios;
  const best = useMemo(() => {
    if (scenarios.length === 0) return null;
    return {
      cashFlow: scenarios.reduce((a, b) => (b.result.monthlyCashFlow > a.result.monthlyCashFlow ? b : a)).id,
      cash: scenarios.reduce((a, b) => (b.result.cashToClose < a.result.cashToClose ? b : a)).id,
    };
  }, [scenarios]);

  const rows: { label: string; get: (s: Scenario) => string; highlight?: "cashFlow" | "cash" }[] = [
    { label: "Down payment", get: (s) => formatCurrency(s.result.downPayment) },
    { label: "Total financed", get: (s) => formatCurrency(s.result.totalLoanAmount) },
    { label: "Lender fees", get: (s) => formatCurrency(s.result.lenderFees) },
    { label: "Cash to close", get: (s) => formatCurrency(s.result.cashToClose), highlight: "cash" },
    { label: "Debt service / mo", get: (s) => formatCurrency(s.result.monthlyDebtService) },
    { label: "NOI / mo", get: (s) => formatCurrency(s.result.noiMonthly) },
    { label: "Cash flow / mo", get: (s) => formatCurrency(s.result.monthlyCashFlow), highlight: "cashFlow" },
    { label: "Cash flow / yr", get: (s) => formatCurrency(s.result.annualCashFlow) },
    { label: "DSCR", get: (s) => formatRatio(s.result.dscr) },
    { label: "Cash-on-cash", get: (s) => formatPercent(s.result.cashOnCashPct) },
  ];

  return (
    <div className="space-y-6">
      <Callout tone="warning" title="Illustrative scenarios only">
        {FINANCING_DISCLAIMER} Every scenario uses the NOI from your saved underwriting assumptions.
      </Callout>
      <Card>
        <CardHeader
          title="Compare financing"
          actions={
            <Button size="sm" onClick={() => setEditing({ params: defaultFinancingParams("conventional", detail.assumptions) })}>
              <Plus /> Add scenario
            </Button>
          }
        />
        <CardBody>
          {scenarios.length === 0 ? (
            <EmptyState title="No scenarios yet" description="Add cash, loan, DSCR, seller-financing or hybrid scenarios to compare." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Financing scenario comparison</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="w-44 py-2 pr-3 text-xs uppercase text-slate-500">
                      Metric
                    </th>
                    {scenarios.map((s) => (
                      <th key={s.id} scope="col" className="py-2 pr-3 align-bottom">
                        <div className="font-semibold text-navy-950">{s.name}</div>
                        {s.name !== labelFor(FINANCING_KINDS, s.kind) && <div className="text-xs font-normal text-slate-500">{labelFor(FINANCING_KINDS, s.kind)}</div>}
                        <div className="no-print mt-1 flex gap-1">
                          <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${s.name}`} onClick={() => setEditing({ scenario: s, params: s.params })}>
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete ${s.name}`}
                            onClick={() => {
                              if (window.confirm(`Delete scenario “${s.name}”?`)) remove.mutate(s.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-slate-600">
                        {r.label}
                      </th>
                      {scenarios.map((s) => {
                        const isBest = r.highlight && best?.[r.highlight] === s.id && scenarios.length > 1;
                        return (
                          <td key={s.id} className={cn("py-2 pr-3", isBest && "font-semibold text-emerald-700")}>
                            {r.get(s)}
                            {isBest && <span className="sr-only"> (best)</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <Card key={s.id}>
            <CardHeader title={s.name} description={s.name !== labelFor(FINANCING_KINDS, s.kind) ? labelFor(FINANCING_KINDS, s.kind) : undefined} actions={<Badge tone="amber">Illustrative</Badge>} />
            <CardBody className="space-y-3 text-sm">
              {s.result.loans.length > 0 && (
                <ul className="space-y-1">
                  {s.result.loans.map((l) => (
                    <li key={l.label} className="tabular flex flex-wrap justify-between gap-2">
                      <span className="text-slate-700">{l.label}</span>
                      <span>
                        {formatCurrency(l.amount)} · {formatCurrency(l.monthlyPayment)}/mo{l.balloonBalance !== null && ` · balloon ${formatCurrency(l.balloonBalance)} (yr ${l.balloonYears})`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                {s.result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {s.result.warnings.length > 0 && (
                <ul className="space-y-1">
                  {s.result.warnings.map((w) => (
                    <li key={w.code + w.message} className={cn("rounded px-2 py-1 text-xs", w.severity === "info" ? "bg-sky-50 text-sky-900" : w.severity === "error" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-950")}>
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.scenario ? "Edit scenario" : "Add financing scenario"}>
          {editing && <ScenarioEditor detail={detail} initial={editing.params} onDone={(params) => save.mutateAsync({ id: editing.scenario?.id, params })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
