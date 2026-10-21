import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Card, CardBody, CardHeader, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/api";
import type { ActivityEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function ActivityTab({ dealId, notes, onSaveNotes }: { dealId: string; notes: string | null; onSaveNotes: (notes: string) => Promise<unknown> }) {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["deal-activity", dealId], queryFn: () => api.get<{ items: ActivityEvent[] }>(`/api/deals/${dealId}/activity`) });
  const [draft, setDraft] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(notes ?? ""), [notes]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Deal notes" description="Private to you." />
        <CardBody className="space-y-3">
          <label htmlFor="deal-notes" className="sr-only">
            Deal notes
          </label>
          <Textarea id="deal-notes" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={draft === (notes ?? "")}
              loading={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveNotes(draft);
                  toast.success("Notes saved");
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save notes
            </Button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Activity log" />
        <CardBody>
          {isLoading && <LoadingBlock rows={3} />}
          {error && <ErrorState error={error} onRetry={() => refetch()} />}
          {data && (
            <ol className="space-y-3">
              {data.items.map((a) => (
                <li key={a.id} className="border-l-2 border-navy-200 pl-3 text-sm">
                  <p className="text-slate-800">{a.message}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
              {data.items.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
