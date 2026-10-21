import { DEAL_STAGES } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { SampleBanner, SourceBadge } from "@/components/domain";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Callout, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api";
import type { Deal, DealDetail } from "@/lib/types";
import { ActivityTab } from "./activity-tab";
import { AnalystTab } from "./analyst-tab";
import { DocumentsTab } from "./documents-tab";
import { FinancingTab } from "./financing-tab";
import { OfferTab } from "./offer-tab";
import { OverviewTab } from "./overview-tab";
import { TasksTab } from "./tasks-tab";
import { UnderwritingTab } from "./underwriting-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "underwriting", label: "Underwriting" },
  { id: "financing", label: "Financing" },
  { id: "analyst", label: "AI analyst" },
  { id: "tasks", label: "Due diligence" },
  { id: "offer", label: "Offer" },
  { id: "documents", label: "Reports" },
  { id: "activity", label: "Activity" },
] as const;

export function useDeal(id: string) {
  return useQuery({ queryKey: ["deal", id], queryFn: () => api.get<DealDetail>(`/api/deals/${id}`) });
}

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const tab = new URLSearchParams(search).get("tab") ?? "overview";
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useDeal(id);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  const patch = useMutation({
    mutationFn: (body: Partial<Pick<Deal, "name" | "stage" | "notes">>) => api.patch<Deal>(`/api/deals/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      setEditingName(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => api.post<Deal>(`/api/deals/${id}/${archived ? "archive" : "restore"}`),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["deal", id] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(d.archivedAt ? "Deal archived" : "Deal restored");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock rows={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;
  const { deal, property } = data;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/deals" className="inline-flex items-center gap-1 hover:text-navy-800">
            <ArrowLeft className="size-3.5" aria-hidden /> Pipeline
          </Link>
        }
        title={
          editingName ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) patch.mutate({ name: name.trim() });
              }}
            >
              <label htmlFor="deal-name" className="sr-only">
                Deal name
              </label>
              <Input id="deal-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 text-xl" maxLength={160} autoFocus />
              <Button type="submit" size="icon" aria-label="Save name" loading={patch.isPending}>
                <Check />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditingName(false)}>
                <X />
              </Button>
            </form>
          ) : (
            <span className="inline-flex items-center gap-2">
              {deal.name}
              <button
                type="button"
                className="no-print rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Rename deal"
                onClick={() => {
                  setName(deal.name);
                  setEditingName(true);
                }}
              >
                <Pencil className="size-4" />
              </button>
            </span>
          )
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Link href={`/properties/${property.id}`} className="hover:underline">
              {property.addressLine}, {property.city}, {property.state}
            </Link>
            <SourceBadge status={property.sourceStatus} retrievedAt={property.latestSource?.retrievedAt} />
            {deal.archivedAt && <Badge>Archived</Badge>}
          </span>
        }
        actions={
          <>
            <label htmlFor="deal-stage" className="sr-only">
              Stage
            </label>
            <Select id="deal-stage" className="w-44" value={deal.stage} onChange={(e) => patch.mutate({ stage: e.target.value })} disabled={patch.isPending}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => archive.mutate(!deal.archivedAt)} loading={archive.isPending}>
              {deal.archivedAt ? (
                <>
                  <ArchiveRestore /> Restore
                </>
              ) : (
                <>
                  <Archive /> Archive
                </>
              )}
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        {property.isSample && <SampleBanner />}
        {deal.archivedAt && <Callout tone="warning">This deal is archived. You can still view and edit it, or restore it to the active pipeline.</Callout>}
        <Tabs value={tab} onValueChange={(t) => navigate(`/deals/${id}?tab=${t}`, { replace: true })}>
          <TabsList aria-label="Deal sections">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab detail={data} onNavigate={(t) => navigate(`/deals/${id}?tab=${t}`, { replace: true })} />
          </TabsContent>
          <TabsContent value="underwriting">
            <UnderwritingTab detail={data} />
          </TabsContent>
          <TabsContent value="financing">
            <FinancingTab detail={data} />
          </TabsContent>
          <TabsContent value="analyst">
            <AnalystTab dealId={id} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksTab dealId={id} />
          </TabsContent>
          <TabsContent value="offer">
            <OfferTab dealId={id} isSample={property.isSample} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab dealId={id} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab dealId={id} notes={deal.notes} onSaveNotes={(notes) => patch.mutateAsync({ notes })} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
