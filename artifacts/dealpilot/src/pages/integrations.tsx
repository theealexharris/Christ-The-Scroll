import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Callout, Card, CardBody, ErrorState, LoadingBlock } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { Integration } from "@/lib/types";

const STATE = {
  connected: { label: "Connected", tone: "green" as const, Icon: CheckCircle2 },
  not_configured: { label: "Not configured", tone: "slate" as const, Icon: CircleSlash },
  error: { label: "Error", tone: "red" as const, Icon: XCircle },
};

export default function IntegrationsPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<{ integrations: Integration[] }>("/api/integrations/status") });
  return (
    <>
      <PageHeader title="Integrations" description="What this deployment is connected to. Status is reported by the server; credentials are configured as server environment variables and are never shown here." />
      <Callout tone="info" className="mb-6">
        “Connected” means the integration is configured and implemented in this build. Property-data providers must be licensed or permitted sources; DealPilot does not scrape
        sites or bypass access controls.
      </Callout>
      {isLoading && <LoadingBlock rows={4} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.integrations.map((i) => {
            const s = STATE[i.state];
            return (
              <Card key={i.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-navy-950">{i.name}</h2>
                      <p className="text-sm text-slate-600">{i.purpose}</p>
                    </div>
                    <Badge tone={s.tone}>
                      <s.Icon className="size-3" aria-hidden /> {s.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-800">{i.detail}</p>
                  <dl className="space-y-1 text-xs text-slate-600">
                    {i.envVars.length > 0 && (
                      <div>
                        <dt className="inline font-medium">Environment variables: </dt>
                        <dd className="inline font-mono">{i.envVars.join(", ")}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline font-medium">Fallback: </dt>
                      <dd className="inline">{i.fallback}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
