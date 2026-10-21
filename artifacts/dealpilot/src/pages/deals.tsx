import { DEAL_STAGES, formatCurrency, formatPercent, formatRatio } from "@workspace/dealpilot-core";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { SampleLabel, StageBadge } from "@/components/domain";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, queryString } from "@/lib/api";
import type { DealListItem } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

export default function DealsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const sp = new URLSearchParams(search);
  const stage = sp.get("stage") ?? "";
  const archived = sp.get("archived") === "true";
  const [view, setView] = useState<"board" | "list">("list");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deals", { stage, archived }],
    queryFn: () => api.get<{ items: DealListItem[] }>(`/api/deals${queryString({ stage: stage || undefined, archived: archived ? "true" : undefined })}`),
  });
  const setParam = (patch: Record<string, string | undefined>) => navigate(`/deals${queryString({ stage: stage || undefined, archived: archived ? "true" : undefined, ...patch })}`, { replace: true });

  return (
    <>
      <PageHeader
        title="Deal pipeline"
        description="Every property you've saved for analysis. Metrics reflect each deal's current assumptions."
        actions={
          <Button asChild>
            <Link href="/discover">Find a property</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="stage-filter" className="text-sm text-slate-600">
          Stage
        </label>
        <Select id="stage-filter" className="w-48" value={stage} onChange={(e) => setParam({ stage: e.target.value || undefined })}>
          <option value="">All stages</option>
          {DEAL_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Show">
          {[
            { v: false, label: "Active" },
            { v: true, label: "Archived" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={archived === o.v}
              onClick={() => setParam({ archived: o.v ? "true" : undefined })}
              className={cn("rounded-md px-3 py-1.5 text-sm", archived === o.v ? "bg-navy-900 text-white" : "text-slate-700 hover:bg-slate-100")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")} className={cn("rounded-md p-1.5", view === "list" ? "bg-navy-900 text-white" : "text-slate-600")}>
            <List className="size-4" />
          </button>
          <button type="button" aria-pressed={view === "board"} aria-label="Board view" onClick={() => setView("board")} className={cn("rounded-md p-1.5", view === "board" ? "bg-navy-900 text-white" : "text-slate-600")}>
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      {isLoading && <LoadingBlock rows={4} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Briefcase />}
          title={archived ? "No archived deals" : "No deals yet"}
          description={archived ? "Archived deals appear here." : "Save a property from Discover to start underwriting it."}
          action={
            !archived && (
              <Button asChild>
                <Link href="/discover">Discover deals</Link>
              </Button>
            )
          }
        />
      )}
      {data && data.items.length > 0 && view === "list" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Deals</caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Deal
                </th>
                <th scope="col" className="px-4 py-3">
                  Stage
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Price
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Cash flow / mo
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Cap rate
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  DSCR
                </th>
                <th scope="col" className="px-4 py-3">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/deals/${d.id}`} className="font-medium text-navy-900 hover:underline">
                      {d.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {d.property.city}, {d.property.state} {d.property.isSample && <SampleLabel className="ml-1" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={d.stage} />
                  </td>
                  <td className="tabular px-4 py-3 text-right">{formatCurrency(d.headline?.purchasePrice)}</td>
                  <td className={cn("tabular px-4 py-3 text-right", (d.headline?.monthlyCashFlow ?? 0) < 0 && "text-red-700")}>{formatCurrency(d.headline?.monthlyCashFlow)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatPercent(d.headline?.capRatePct)}</td>
                  <td className="tabular px-4 py-3 text-right">{formatRatio(d.headline?.dscr)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatRelative(d.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.items.length > 0 && view === "board" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DEAL_STAGES.filter((s) => !stage || s.id === stage).map((s) => {
            const items = data.items.filter((d) => d.stage === s.id);
            return (
              <section key={s.id} aria-labelledby={`col-${s.id}`} className="rounded-xl border border-slate-200 bg-slate-100/60 p-3">
                <h2 id={`col-${s.id}`} className="mb-3 flex items-center justify-between text-sm font-semibold text-navy-950">
                  {s.label} <span className="tabular text-slate-500">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((d) => (
                    <li key={d.id}>
                      <Link href={`/deals/${d.id}`} className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-navy-300">
                        <p className="font-medium text-navy-950">{d.name}</p>
                        <p className="text-xs text-slate-500">
                          {d.property.city}, {d.property.state}
                        </p>
                        {d.property.isSample && <SampleLabel className="mt-1" />}
                        {d.headline && <p className="tabular mt-2 text-xs text-slate-700">{formatCurrency(d.headline.monthlyCashFlow)}/mo · cap {formatPercent(d.headline.capRatePct, 1)}</p>}
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && <li className="text-xs text-slate-500">None</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
