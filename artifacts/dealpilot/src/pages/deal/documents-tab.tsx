import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { GeneratedDocument } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function DocumentsTab({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["documents", dealId], queryFn: () => api.get<{ items: GeneratedDocument[] }>(`/api/deals/${dealId}/documents`) });
  const generate = useMutation({
    mutationFn: (format: "pdf" | "docx") => api.post<GeneratedDocument>(`/api/deals/${dealId}/reports`, { format }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents", dealId] });
      toast.success("Report generated");
      window.location.assign(`/api/documents/${doc.id}/download`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader
        title="Reports & exports"
        description="Each document freezes a snapshot of the data at the moment it was generated, so it won't change if you edit the deal later."
        actions={
          <>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/deals/${dealId}/print`}>
                <Printer /> Printable view
              </Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => generate.mutate("docx")} loading={generate.isPending && generate.variables === "docx"}>
              <FileText /> Word report
            </Button>
            <Button size="sm" onClick={() => generate.mutate("pdf")} loading={generate.isPending && generate.variables === "pdf"}>
              <Download /> PDF report
            </Button>
          </>
        }
      />
      <CardBody>
        {isLoading && <LoadingBlock rows={2} />}
        {error && <ErrorState error={error} onRetry={() => refetch()} />}
        {data && data.items.length === 0 && <EmptyState icon={<FileText />} title="No documents yet" description="Generate a report here, export an offer draft, or approve an analysis run." />}
        {data && data.items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {data.items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{d.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(d.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={d.kind === "offer_draft" ? "red" : "navy"}>{d.kind === "offer_draft" ? "Offer draft" : "Investment report"}</Badge>
                  <Badge>{d.format.toUpperCase()}</Badge>
                  <Button size="sm" variant="secondary" asChild>
                    <a href={`/api/documents/${d.id}/download`}>
                      <Download /> Download
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
