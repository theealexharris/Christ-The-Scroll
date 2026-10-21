import { formatCurrency, formatPercent, formatRatio, type CalcWarning, type FormulaLine, type UnderwritingResult } from "@workspace/dealpilot-core";
import { Stat } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function KeyMetrics({ u }: { u: UnderwritingResult }) {
  const m = u.metrics;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat label="Cash flow / month" value={formatCurrency(u.cashFlow.monthly)} hint={`${formatCurrency(u.cashFlow.annual)} / year`} tone={u.cashFlow.monthly >= 0 ? "good" : "bad"} />
      <Stat label="Cap rate" value={formatPercent(m.capRatePct)} hint="NOI ÷ price" />
      <Stat label="Cash-on-cash" value={formatPercent(m.cashOnCashPct)} hint="Year-1 estimate" />
      <Stat label="DSCR" value={formatRatio(m.dscr)} hint={m.dscr === null ? "No loan modeled" : "NOI ÷ debt service"} tone={m.dscr === null ? "neutral" : m.dscr >= 1.2 ? "good" : m.dscr < 1 ? "bad" : "neutral"} />
      <Stat label="Cash required" value={formatCurrency(u.acquisition.totalCashRequired)} hint="At acquisition" />
      <Stat label="Break-even occ." value={formatPercent(m.breakEvenOccupancyPct, 1)} hint="To cover costs + debt" />
    </div>
  );
}

const unitLabel: Record<FormulaLine["unit"], string> = { usd: "", usd_month: "/mo", usd_year: "/yr", pct: "", ratio: "", years: " yrs" };

export function formatFormulaValue(f: FormulaLine): string {
  if (f.value === null) return "—";
  if (f.unit === "pct") return formatPercent(f.value);
  if (f.unit === "ratio") return formatRatio(f.value);
  if (f.unit === "years") return `${f.value} yrs`;
  return `${formatCurrency(f.value)}${unitLabel[f.unit]}`;
}

export function FormulaTable({ formulas }: { formulas: FormulaLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">Formulas used in this analysis</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2 pr-4">
              Metric
            </th>
            <th scope="col" className="py-2 pr-4">
              Formula
            </th>
            <th scope="col" className="py-2 text-right">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {formulas.map((f) => (
            <tr key={f.key}>
              <th scope="row" className="py-2 pr-4 text-left font-medium text-slate-800">
                {f.label}
              </th>
              <td className="py-2 pr-4 font-mono text-xs text-slate-600">{f.formula}</td>
              <td className="tabular py-2 text-right font-medium">{formatFormulaValue(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WarningList({ warnings }: { warnings: CalcWarning[] }) {
  if (warnings.length === 0) return <p className="text-sm text-emerald-700">No calculation warnings for these inputs.</p>;
  const order = { error: 0, warning: 1, info: 2 };
  return (
    <ul className="space-y-2">
      {[...warnings]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((w) => (
          <li
            key={w.code}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              w.severity === "error" ? "border-red-200 bg-red-50 text-red-900" : w.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-900",
            )}
          >
            <span className="mr-2 text-xs font-bold uppercase">{w.severity === "error" ? "Required" : w.severity}</span>
            {w.message}
          </li>
        ))}
    </ul>
  );
}
