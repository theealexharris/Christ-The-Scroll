import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardBody, EmptyState, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { ActivityEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function ActivityPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["activity"], queryFn: () => api.get<{ items: ActivityEvent[] }>("/api/activity?limit=200") });
  return (
    <>
      <PageHeader title="Activity" description="Everything that has happened in your workspace, newest first." />
      {isLoading && <LoadingBlock rows={5} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.items.length === 0 && <EmptyState icon={<Activity />} title="No activity yet" description="Actions like saving deals, running analyses and exporting reports appear here." />}
      {data && data.items.length > 0 && (
        <Card>
          <CardBody>
            <ol className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <span className="text-slate-800">
                    {a.dealId ? (
                      <Link href={`/deals/${a.dealId}`} className="hover:underline">
                        {a.message}
                      </Link>
                    ) : a.propertyId ? (
                      <Link href={`/properties/${a.propertyId}`} className="hover:underline">
                        {a.message}
                      </Link>
                    ) : (
                      a.message
                    )}
                  </span>
                  <time dateTime={a.createdAt} className="text-xs text-slate-500">
                    {formatDateTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}
    </>
  );
}
