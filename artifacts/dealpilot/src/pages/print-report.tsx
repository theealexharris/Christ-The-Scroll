import { BRAND, DEAL_CATEGORIES, formatCurrency, formatPercent, formatRatio, labelFor, PROPERTY_TYPES, SOURCE_STATUSES } from "@workspace/dealpilot-core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { DealDetail, Task } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { FormulaTable } from "./deal/metrics";

/** Browser-printable report (use the browser's "Save as PDF" for a quick export). */
export default function PrintReportPage() {
  const { id } = useParams<{ id: string }>();
  const deal = useQuery({ queryKey: ["deal", id], queryFn: () => api.get<DealDetail>(`/api/deals/${id}`) });
  const tasks = useQuery({ queryKey: ["tasks", id], queryFn: () => api.get<{ items: Task[] }>(`/api/deals/${id}/tasks`) });
  if (deal.isLoading) return <LoadingBlock />;
  if (deal.error || !deal.data) return <ErrorState error={deal.error} />;
  const { property: p, underwriting: u, assumptions: a, scenarios, evidenceGaps, deal: d } = deal.data;

  return (
    <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-sm text-slate-900 print:px-0 print:py-0">
      <div className="no-print mb-6 flex justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/deals/${id}?tab=documents`}>
            <ArrowLeft /> Back
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>
      {p.isSample && <p className="mb-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center font-bold text-amber-900">{BRAND.sampleLabel}</p>}
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{BRAND.name} · Investment report</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">{d.name}</h1>
        <p className="text-slate-600">
          {p.addressLine}, {p.city}, {p.state} · {labelFor(PROPERTY_TYPES, p.propertyType)} · {labelFor(DEAL_CATEGORIES, p.category)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Source: {labelFor(SOURCE_STATUSES, p.sourceStatus)} {p.latestSource?.sourceName && `— ${p.latestSource.sourceName}`} · captured {formatDateTime(p.latestSource?.retrievedAt)} · printed{" "}
          {formatDateTime(new Date())} · assumptions v{deal.data.assumptionVersion}
        </p>
      </header>
      <section className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Purchase price", formatCurrency(u.acquisition.purchasePrice)],
          ["Cash required", formatCurrency(u.acquisition.totalCashRequired)],
          ["NOI / yr", formatCurrency(u.operating.noiAnnual)],
          ["Cash flow / mo", formatCurrency(u.cashFlow.monthly)],
          ["Cap rate", formatPercent(u.metrics.capRatePct)],
          ["Cash-on-cash", formatPercent(u.metrics.cashOnCashPct)],
          ["DSCR", formatRatio(u.metrics.dscr)],
          ["Break-even occupancy", formatPercent(u.metrics.breakEvenOccupancyPct)],
          [`Equity at yr ${u.exit.holdYears}`, formatCurrency(u.exit.equityAtExit)],
        ].map(([l, v]) => (
          <div key={l} className="rounded border border-slate-200 p-2">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="tabular font-semibold">{v}</p>
          </div>
        ))}
      </section>
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-semibold text-navy-950">Key assumptions</h2>
        <p>
          Rent {formatCurrency(a.monthlyRent)}/mo, vacancy {a.vacancyRatePct}%, taxes {formatCurrency(a.propertyTaxesAnnual)}/yr, insurance {formatCurrency(a.insuranceAnnual)}/yr,
          maintenance {a.maintenancePct}%, capex {a.capexReservePct}%, management {a.managementPct}%.{" "}
          {a.useFinancing ? `${a.downPaymentPct}% down at ${a.interestRatePct}% over ${a.amortizationYears} years.` : "Cash purchase."}
        </p>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-semibold text-navy-950">Formulas</h2>
        <FormulaTable formulas={u.formulas} />
      </section>
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-semibold text-navy-950">Financing scenarios (illustrative — not loan offers)</h2>
        <ul className="list-disc space-y-1 pl-5">
          {scenarios.map((s) => (
            <li key={s.id}>
              {s.name}: cash to close {formatCurrency(s.result.cashToClose)}, payment {formatCurrency(s.result.monthlyDebtService)}/mo, cash flow {formatCurrency(s.result.monthlyCashFlow)}/mo, DSCR{" "}
              {formatRatio(s.result.dscr)}
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-semibold text-navy-950">Warnings & missing evidence</h2>
        <ul className="list-disc space-y-1 pl-5">
          {u.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
          {evidenceGaps.map((g) => (
            <li key={g.key}>
              {g.item} — {g.whyItMatters}
            </li>
          ))}
        </ul>
      </section>
      {tasks.data && tasks.data.items.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-navy-950">Due-diligence checklist</h2>
          <ul className="space-y-1">
            {tasks.data.items.map((t) => (
              <li key={t.id}>
                [{t.status === "done" ? "x" : " "}] {t.category}: {t.title}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="border-t border-slate-300 pt-3 text-xs text-slate-600">
        <p>{BRAND.disclaimer}</p>
        <p className="mt-1">{u.exit.note}</p>
      </footer>
    </div>
  );
}
