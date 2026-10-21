import { DEAL_STAGES, formatCurrency, formatPercent } from "@workspace/dealpilot-core";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, FilePlus2, Upload } from "lucide-react";
import { Link } from "wouter";
import { SampleLabel, StageBadge, WorkflowStatusBadge } from "@/components/domain";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingBlock, Stat } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/api/dashboard") });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your saved deals, analyses in progress and recent activity. Figures below come from your own workspace data."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/discover?new=manual">
                <FilePlus2 /> Add property
              </Link>
            </Button>
            <Button asChild>
              <Link href="/discover">
                <Compass /> Discover deals
              </Link>
            </Button>
          </>
        }
      />
      {isLoading && <LoadingBlock rows={4} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Saved deals" value={data.savedDeals} hint={data.sampleDeals ? `${data.sampleDeals} use sample data` : "Your deals"} />
            <Stat label="Active analyses" value={data.activeAnalyses.length} hint="Running, waiting or failed" />
            <Stat label="Draft offers" value={data.draftOffers} hint="Drafts only — never sent" />
            <Stat label="Open tasks" value={data.openTasks} hint="Due-diligence items" />
          </div>

          {data.savedDeals === 0 && (
            <EmptyState
              icon={<Compass />}
              title="Start your first analysis"
              description="Browse the fictional sample properties to learn the workflow, or add a property you're evaluating by hand or from a CSV file."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href="/discover">Browse sample properties</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/discover?new=csv">
                      <Upload /> Import CSV
                    </Link>
                  </Button>
                </div>
              }
            />
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Pipeline"
                actions={
                  <Link href="/deals" className="text-sm font-medium text-navy-700 hover:underline">
                    View all
                  </Link>
                }
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {DEAL_STAGES.map((s) => (
                    <Link key={s.id} href={`/deals?stage=${s.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-navy-300 hover:bg-navy-50">
                      <span className="text-slate-600">{s.label}</span> <span className="tabular font-semibold text-navy-950">{data.stageCounts[s.id] ?? 0}</span>
                    </Link>
                  ))}
                </div>
                {data.recentDeals.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {data.recentDeals.map((d) => (
                      <li key={d.id}>
                        <Link href={`/deals/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy-950">{d.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {d.property.city}, {d.property.state} {d.property.isSample && <SampleLabel className="ml-1" />}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            {d.headline && (
                              <span className="tabular text-slate-700">
                                {formatCurrency(d.headline.monthlyCashFlow)}/mo · cap {formatPercent(d.headline.capRatePct, 1)}
                              </span>
                            )}
                            <StageBadge stage={d.stage} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No saved deals yet.</p>
                )}
              </CardBody>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Active analyses" />
                <CardBody>
                  {data.activeAnalyses.length === 0 ? (
                    <p className="text-sm text-slate-500">Nothing in progress. Run an analysis from a deal's page.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.activeAnalyses.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2">
                          <Link href={`/deals/${r.dealId}?tab=overview`} className="truncate text-sm font-medium text-navy-800 hover:underline">
                            {r.dealName}
                          </Link>
                          <WorkflowStatusBadge status={r.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Recent activity"
                  actions={
                    <Link href="/activity" className="text-sm font-medium text-navy-700 hover:underline">
                      All <ArrowRight className="inline size-3" aria-hidden />
                    </Link>
                  }
                />
                <CardBody>
                  {data.recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-500">No activity yet.</p>
                  ) : (
                    <ol className="space-y-3">
                      {data.recentActivity.map((a) => (
                        <li key={a.id} className="text-sm">
                          <p className="text-slate-800">{a.message}</p>
                          <p className="text-xs text-slate-500">{formatRelative(a.createdAt)}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
