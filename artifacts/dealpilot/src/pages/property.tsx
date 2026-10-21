import { DEAL_CATEGORIES, formatCurrency, labelFor, PROPERTY_TYPES, SOURCE_STATUSES, type PropertyInput } from "@workspace/dealpilot-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import { Disclaimer, SampleBanner, SourceBadge } from "@/components/domain";
import { PageHeader } from "@/components/layout/app-shell";
import { PropertyForm } from "@/components/property-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge, Callout, Card, CardBody, CardHeader, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { useAnalyzeProperty } from "@/hooks/use-analyze";
import { api, errorMessage } from "@/lib/api";
import type { Property } from "@/lib/types";
import { formatDateTime, formatRelative } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular text-right font-medium text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

export default function PropertyPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const analyze = useAnalyzeProperty();
  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: ["property", id], queryFn: () => api.get<Property>(`/api/properties/${id}`) });

  const update = useMutation({
    mutationFn: (input: PropertyInput) => api.patch<Property>(`/api/properties/${id}`, input),
    onSuccess: (data) => {
      qc.setQueryData(["property", id], data);
      qc.invalidateQueries({ queryKey: ["properties"] });
      setEditing(false);
      toast.success("Property updated");
    },
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => api.post<Property>(`/api/properties/${id}/${archived ? "archive" : "restore"}`),
    onSuccess: (data) => {
      qc.setQueryData(["property", id], data);
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success(data.archivedAt ? "Property archived" : "Property restored");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock rows={4} />;
  if (error || !p) return <ErrorState error={error} onRetry={() => refetch()} />;
  const editable = p.ownerId !== null;
  const ageDays = p.latestSource ? (Date.now() - new Date(p.latestSource.retrievedAt).getTime()) / 86_400_000 : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/discover" className="inline-flex items-center gap-1 hover:text-navy-800">
            <ArrowLeft className="size-3.5" aria-hidden /> Discover
          </Link>
        }
        title={p.title}
        description={`${p.addressLine}, ${p.city}, ${p.state} ${p.postalCode ?? ""}`}
        actions={
          <>
            {editable ? (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </Button>
                <Button variant="secondary" onClick={() => archive.mutate(!p.archivedAt)} loading={archive.isPending}>
                  {p.archivedAt ? (
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
            ) : (
              <Button variant="secondary" disabled title="Sample catalog records are read-only. Analyze it to get your own editable copy.">
                <Pencil /> Edit (read-only sample)
              </Button>
            )}
            <Button onClick={() => analyze.mutate(p)} loading={analyze.isPending} disabled={!!p.archivedAt}>
              Save as deal & analyze
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        {p.isSample && <SampleBanner />}
        {p.archivedAt && <Callout tone="warning">This property is archived. Restore it to analyze it.</Callout>}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Property details" description="As entered by you or the sample dataset. Not verified by DealPilot." />
            <CardBody>
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <Row label="Category" value={labelFor(DEAL_CATEGORIES, p.category)} />
                <Row label="Property type" value={labelFor(PROPERTY_TYPES, p.propertyType)} />
                <Row label="List / asking price" value={p.listPrice !== null ? formatCurrency(p.listPrice) : null} />
                <Row label="Estimated rent (monthly)" value={p.estimatedRentMonthly !== null ? formatCurrency(p.estimatedRentMonthly) : null} />
                <Row label="Property taxes (annual)" value={p.annualTaxes !== null ? formatCurrency(p.annualTaxes) : null} />
                <Row label="Units" value={p.units} />
                <Row label="Beds / baths" value={p.beds !== null || p.baths !== null ? `${p.beds ?? "—"} / ${p.baths ?? "—"}` : null} />
                <Row label="Square feet" value={p.squareFeet?.toLocaleString()} />
                <Row label="Lot size (sq ft)" value={p.lotSizeSqft?.toLocaleString()} />
                <Row label="Year built" value={p.yearBuilt} />
              </dl>
              {p.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{p.description}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Source & freshness" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge status={p.sourceStatus} />
                {ageDays !== null && ageDays > 30 && <Badge tone="amber">Over 30 days old</Badge>}
              </div>
              <p className="text-sm text-slate-600">
                {labelFor(SOURCE_STATUSES, p.sourceStatus)} records reflect what was captured at the time shown. Listing status, price and condition may have changed — verify
                before acting.
              </p>
              <ol className="space-y-3">
                {p.sources.map((s) => (
                  <li key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{s.sourceName ?? "Unnamed source"}</p>
                    <p className="text-xs text-slate-500">
                      Captured {formatDateTime(s.retrievedAt)} ({formatRelative(s.retrievedAt)})
                    </p>
                    {s.sourceUrl && (
                      <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-navy-700 underline">
                        Open source <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                    {s.notes && <p className="mt-1 text-xs text-slate-600">{s.notes}</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
        <Disclaimer />
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent title="Edit property">
          <PropertyForm property={p} submitLabel="Save changes" onSubmit={(input) => update.mutateAsync(input)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
